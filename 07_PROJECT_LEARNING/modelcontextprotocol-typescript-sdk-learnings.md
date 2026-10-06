# Forensic Learning Record (Deep Inspection): modelcontextprotocol/typescript-sdk

> **Canonical Artifact**: `07_PROJECT_LEARNING/modelcontextprotocol-typescript-sdk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:18:00.020Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `modelcontextprotocol/typescript-sdk`
- **Description**: The official TypeScript SDK for Model Context Protocol servers and clients
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 13522 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/cli-client/host/loop.ts`
```
import { getDisplayName } from '@modelcontextprotocol/client';

import type { ChatMessage, ContentPart, GenerateResult, LLMProvider } from '../providers/provider';
import { textPart } from '../providers/provider';
import { partsToDisplayText } from './content';
import type { McpHost } from './host';
import type { HostUI } from './ui';

/** A model that keeps calling tools forever is a bug, not a feature — bound the loop. */
export const MAX_TOOL_ROUNDS = 8;

const BASE_SYSTEM_PROMPT =
    'You are cli-client, a terminal assistant. You have no built-in tools; every tool available to you comes from a connected MCP server. ' +
    'Use them when they help, report tool failures honestly, and keep answers short — this is a terminal. ' +
    'When the user greets you or asks what you can do, offer a short tour of what the connected servers provide (their instructions may suggest one).';

export interface ChatSession {
    host: McpHost;
    provider: LLMProvider;
    ui: HostUI;
    messages: ChatMessage[];
    maxTokens: number;
    /** Last model id reported by the provider; announced once so users can see what answered. */
    announcedModel?: string;
}

export function createSession(host: McpHost, provider: LLMProvider, ui: HostUI, maxTokens = 1024): ChatSession {
    return { host, provider, ui, messages: [], maxTokens };
}

export function buildSystemPrompt(host: McpHost): string {
    const instructions = host.systemInstructions();
    return instructions ? `${BASE_SYSTEM_PROMPT}\n\n${instructions}` : BASE_SYSTEM_PROMPT;
}

/**
 * The loop at the heart of every MCP host:
 * ask the model → execute every tool call it issued → feed the results back → repeat until
 * the model answers in prose (or the round cap is hit). Tool results go back as `role: 'tool'`
 * messages so each provider can encode them natively, and `isError` results still go to the
 * model — it is allowed to read the error and try something else.
 */
export async function runModelRounds(session: ChatSession): Promise<void> {
    const { host, provider, ui } = session;
    // Server instructions and the aggregated tool list are stable within a single user turn.
    const system = buildSystemPrompt(host);
    const tools = host.toolDefinitions();
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const stopSpinner = ui.spinner();
        let result: GenerateResult;
        try {
            result = await provider.generate({
                system,
                messages: session.messages,
                tools,
                maxTokens: session.maxTokens
            });
        } finally {
            stopSpinner();
        }
        session.messages.push({
            role: 'assistant',
            content: result.text ? [textPart(result.text)] : [],
            ...(result.toolCalls.length > 0 ? { toolCalls: result.toolCalls } : {})
        });
        if (result.model !== session.announcedModel) {
            session.announcedModel = result.model;
            ui.status(`model: ${result.model}`);
        }
        if (result.text) ui.print(result.text);
        if (result.toolCalls.length === 0) return;

        // cli-client executes tool calls without a confirmation gate because an interactive
        // user watches every `→` line and holds Ctrl-C; a host without that live supervision
        // must gate execution on user consent (see the guide's security section).
        for (const call of result.toolCalls) {
            ui.status(`→ ${call.name} ${JSON.stringify(call.arguments)}`);
            // Long-running calls stay cancellable: Ctrl-C aborts this call (the SDK sends
            // notifications/cancelled) and the failure goes back to the model like any other.
            const cancellation = new AbortController();
            ui.setCancelHandler(() => {
                ui.status(`cancelling ${call.name}…`, 'cancel');
                cancellation.abort();
            });
            let parts: ContentPart[];
            let isError: boolean;
            try {
                ({ parts, isError } = await host.executeToolCall(call, { signal: cancellation.signal }));
            } finally {
                ui.setCancelHandler(undefined);
            }
            const summary = partsToDisplayText(parts);
            ui.status(`${isError ? '✗' : '✓'} ${call.name}: ${summary.length > 200 ? `${summary.slice(0, 200)}…` : summary}`);
            session.messages.push({ role: 'tool', toolCallId: call.id, toolName: call.name, content: parts, isError });
        }
    }
    ui.print('(stopped: tool-call round limit reached)');
}

/** Send one user turn (with optional attached-resource context blocks) through the loop. */
export async function runConversationTurn(session: ChatSession, userText: string, attachments: string[] = []): Promise<void> {
    const content: ContentPart[] = [...attachments.map(attachment => textPart(attachment)), textPart(userText)];
    session.messages.push({ role: 'user', content });
    await runModelRounds(session);
}

/** Pull `@server:uri` mentions out of a chat line (server names may contain dots, spaces excepted). */
export function extractMentions(input: string): { text: string; mentions: string[] } {
    const mentions = [...input.matchAll(/@([^\s:@]+:\S+)/g)].map(match => match[1]).filter(mention => mention !== undefined);
    return { text: input.trim(), mentions };
}

/** Parse `key=value` arguments for a `/server:prompt` command. */
export function parsePromptArgs(rest: string): Record<string, string> {
    const args: Record<string, string> = {};
    for (const [, key, raw] of rest.matchAll(/([A-Za-z0-9_-]+)=("[^"]*"|\S+)/g)) {
        if (key && raw !== undefined) {
            args[key] = raw.replaceAll(/^"|"$/g, '');
        }
    }
    return args;
}

const HELP = `cli-client commands:
  /help                       show this help
  /servers                    connected servers and what they offer
  /tools                      every (namespaced) tool the model can call
  /resources                  resources you can attach with @server:uri
  /prompts                    prompts you can run as /server:prompt-name [key=value …]
  /roots                      workspace roots exposed to servers
  /root add <path>            add a workspace root (sends roots/list_changed)
  /watch @server:uri          get a note whenever that resource changes
  /quit                       exit
  @server:uri                 attach a resource to your next message as context
  /server:prompt-name k=v …   run an MCP prompt as a slash command
  Ctrl-C                      cancel the tool call that is currently running (otherwise exit)`;

export type InputResult = 'continue' | 'exit';

/** Print rows as an aligned two-column listing, one line per row, trimmed to the terminal width. */
function printAligned(ui: HostUI, rows: ReadonlyArray<readonly string[]>, emptyMessage: string): void {
    if (rows.length === 0) {
        ui.print(emptyMessage);
        return;
    }
    const nameWidth = Math.min(Math.max(...rows.map(row => row[0]?.length ?? 0), 0), 48);
    const columns = process.stdout.columns ?? 120;
    for (const [name = '', description = ''] of rows) {
        const line = `${name.padEnd(nameWidth)}  ${description}`;
        ui.print(line.length > columns ? `${line.slice(0, columns - 1)}…` : line);
    }
}

/**
 * Dispatch one line of user input: built-in slash commands, `/server:prompt` commands,
 * or a plain chat message (with `@server:uri` attachments resolved first).
 */
export async function handleUserInput(session: ChatSession, input: string): Promise<InputResult> {
    const { host, ui } = session;
    const trimmed = input.trim();
    if (!trimmed) return 'continue';

    if (trimmed === '/quit' || trimmed === '/exit') return 'exit';
    if (trimmed === '/help') {
        ui.print(HELP);
        return 'continue';
    }
    if (trimmed === '/servers') {
        printAligned(
            ui,
            [...host.servers.values()].map(server => [
                server.name,
                `protocol ${server.protocolVersion}, ${server.tools.length} tools, ${server.resources.length} resources (+${server.resourceTemplates.length} templates), ${server.prompts.length} prompts`
            ]),
            '[no servers connected]'
        );
        return 'continue';
    }
    if (trimmed === '/tools') {
        printAligned(
            ui,
            host.toolDefinitions().map(tool => [tool.name, tool.description ?? '']),
            '[no tools found — the connected servers expose none]'
        );
        return 'continue';
    }
    if (trimmed === '/resources') {
        printAligned(
            ui,
            host.listResources().map(({ server, resource }) => [`@${server}:${resource.uri}`, getDisplayName(resource)]),
            '[no resources found — the connected servers expose none]'
        );
        return 'continue';
    }
    if (trimmed === '/prompts') {
        printAligned(
            ui,
            host.listPrompts().map(({ server, prompt }) => {
                const args = (prompt.arguments ?? []).map(argument => `${argument.name}${argument.required ? '' : '?'}`).join(' ');
                return [`/${server}:${prompt.name}${args ? ` ${args}` : ''}`, prompt.description ?? ''];
            }),
            '[no prompts found — the connected servers expose none]'
        );
        return 'continue';
    }
    if (trimmed === '/roots') {
        for (const root of host.listRoots()) ui.print(root);
        return 'continue';
    }
    if (trimmed.startsWith('/root add ')) {
        await host.addRoot(trimmed.slice('/root add '.length).trim());
        ui.status('root added');
        return 'continue';
    }
    if (trimmed === '/watch' || trimmed.startsWith('/watch ')) {
        const reference = trimmed.slice('/watch'.length).trim().replace(/^@/, '');
        if (!reference) {
            ui.print('usage: /watch @server:uri (see /resources)');
            return 'continue';
  
```

### Core Architecture Module: `examples/guides/serving/sessions-state-scaling.examples.ts`
```
// docs: typecheck-only
/**
 * Companion example for `docs/serving/sessions-state-scaling.md`.
 *
 * Every `ts` fence on that page is synced from a `//#region` in this file
 * (`pnpm sync:snippets --check`). The regions are fragments of an HTTP
 * deployment — transport options, an Express route, a handler option — and
 * none of them may bind a port, so the file is typecheck-only.
 *
 *     pnpm --filter @modelcontextprotocol/examples typecheck
 *
 * @module
 */

// "Sessions" lead block — sessionIdGenerator turns sessions on for the
// hand-wired 2025-era Streamable HTTP transport.
//#region sessions_stateful
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { randomUUID } from 'node:crypto';

const transport = new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID()
});
//#endregion sessions_stateful
void transport;

// Imports for the function-wrapped regions below, kept out of the page's lead block.
import type { EventStore, McpServer, ServerEventBus } from '@modelcontextprotocol/server';
import { createMcpHandler, isInitializeRequest } from '@modelcontextprotocol/server';
import type { Express, Request, Response } from 'express';

/**
 * "Sessions" follow-up — one transport per session, routed by `Mcp-Session-Id`
 * (mined from `examples/legacy-routing/server.ts`).
 */
function sessions_routing(app: Express, buildServer: () => McpServer) {
    //#region sessions_routing
    const IDLE_MS = 30 * 60_000;
    const MAX_SESSIONS = 1000;

    type Session = { transport: NodeStreamableHTTPServerTransport; open: number; lastActive: number };
    const sessions = new Map<string, Session>();

    const route = async (req: Request, res: Response) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        const session = sessionId ? sessions.get(sessionId) : undefined;
        if (session) {
            // Count open responses so a long-running request or a listening stream is not treated as idle.
            if (res.socket && !res.destroyed) {
                session.open++;
                res.on('close', () => {
                    session.open--;
                    session.lastActive = Date.now();
                });
            }
            await session.transport.handleRequest(req, res, req.body);
            return;
        }
        if (!sessionId && isInitializeRequest(req.body)) {
            if (sessions.size >= MAX_SESSIONS) {
                res.status(503).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Too many open sessions' }, id: null });
                return;
            }
            const transport = new NodeStreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: id => {
                    sessions.set(id, { transport, open: 0, lastActive: Date.now() });
                }
            });
            transport.onclose = () => {
                if (transport.sessionId) sessions.delete(transport.sessionId);
            };
            await buildServer().connect(transport);
            await transport.handleRequest(req, res, req.body);
            return;
        }
        if (sessionId) {
            // Unknown session id: the client should start a new session.
            res.status(404).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Session not found' }, id: null });
            return;
        }
        // No session header on a non-initialize request: the request is malformed.
        res.status(400).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Bad Request: Session ID required' }, id: null });
    };

    app.post('/mcp', route);
    app.get('/mcp', route);
    app.delete('/mcp', route);

    // Close sessions with nothing open and no activity for IDLE_MS.
    setInterval(() => {
        const cutoff = Date.now() - IDLE_MS;
        for (const { transport, open, lastActive } of sessions.values()) {
            if (open === 0 && lastActive < cutoff) transport.close().catch(console.error);
        }
    }, 60_000).unref();
    //#endregion sessions_routing
}
void sessions_routing;

/** "Resumability" — an EventStore implementation next to sessionIdGenerator. */
function resumability_eventStore(databaseEventStore: EventStore) {
    //#region resumability_eventStore
    const transport = new NodeStreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        eventStore: databaseEventStore
    });
    //#endregion resumability_eventStore
    return transport;
}
void resumability_eventStore;

/** "Multi-node" — every node hands the same pub/sub-backed bus to createMcpHandler. */
function multiNode_bus(buildServer: () => McpServer, redisBus: ServerEventBus) {
    //#region multiNode_bus
    const handler = createMcpHandler(buildServer, { bus: redisBus });
    //#endregion multiNode_bus
    return handler;
}
void multiNode_bus;

```

### Core Architecture Module: `examples/stateless-legacy/client.ts`
```
/**
 * Connects to the minimal `createMcpHandler` deployment as both a plain 2025
 * client (`versionNegotiation: { mode: 'legacy' }` — the `initialize`
 * handshake, served stateless from the factory) and a 2026-capable client
 * (`versionNegotiation: { mode: 'auto' }`, served per request). Asserts the
 * same `greet` tool answers identically either way.
 *
 * HTTP-only — `createMcpHandler`'s `legacy: 'stateless'` posture is an HTTP
 * hosting concern; a stdio leg would bypass it. The story body drives BOTH
 * eras itself, so only `url` is read from argv.
 */
import { check, parseExampleArgs } from '@mcp-examples/shared';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const { url } = parseExampleArgs();

for (const mode of ['legacy', 'auto'] as const) {
    const client = new Client({ name: 'stateless-legacy-client', version: '1.0.0' }, { versionNegotiation: { mode } });
    await client.connect(new StreamableHTTPClientTransport(new URL(url)));
    const tools = await client.listTools();
    check.ok(tools.tools.some(t => t.name === 'greet'));
    const result = await client.callTool({ name: 'greet', arguments: { name: 'world' } });
    check.equal(result.content?.[0]?.type === 'text' ? result.content[0].text : '', 'Hello, world!');
    await client.close();
}

```

### Core Architecture Module: `examples/stateless-legacy/server.ts`
```
/**
 * The minimal `createMcpHandler` deployment, on its default posture.
 *
 * One factory, one endpoint: 2026-07-28 traffic is served per request, and
 * 2025-era (non-envelope) traffic is served stateless from the same factory
 * (`legacy: 'stateless'`, the default). This replaces the hand-wired
 * "new transport + new server per POST" stateless idiom of the 1.x SDK with
 * a one-liner.
 *
 * HTTP-only — `createMcpHandler`'s `legacy: 'stateless'` posture is an HTTP
 * hosting concern; a stdio leg would bypass it. See `dual-era/` for the stdio
 * analogue.
 */
import { serve } from '@hono/node-server';
import { parseExampleArgs } from '@mcp-examples/shared';
import { createMcpHonoApp } from '@modelcontextprotocol/hono';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

function buildServer(): McpServer {
    const server = new McpServer({ name: 'stateless-legacy-example', version: '1.0.0' }, { capabilities: { logging: {} } });
    server.registerTool(
        'greet',
        { description: 'A simple greeting tool', inputSchema: z.object({ name: z.string() }) },
        async ({ name }) => ({ content: [{ type: 'text', text: `Hello, ${name}!` }] })
    );
    return server;
}

const { port } = parseExampleArgs();

const handler = createMcpHandler(buildServer);
// `createMcpHonoApp()` binds the endpoint behind localhost host/origin
// validation by default, matching the framework factories' defaults.
const app = createMcpHonoApp();
app.all('/mcp', c => handler.fetch(c.req.raw));
serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, () => {
    console.error(`[server] listening on http://127.0.0.1:${port}/mcp`);
});

```

### Core Architecture Module: `packages/client/src/shimsWorkerd.ts`
```
/**
 * Cloudflare Workers runtime shims for client package
 *
 * This file is selected via package.json export conditions when running in workerd.
 */
import { preloadSchemas } from '@modelcontextprotocol/core-internal';

export { CfWorkerJsonSchemaValidator as DefaultJsonSchemaValidator } from '@modelcontextprotocol/core-internal/validators/cfWorker';

// Platform asymmetry: isolate platforms like workerd evaluate module scope
// during deployment/isolate warm-up, outside any request's billed CPU, while
// lazy construction would land inside the first request each fresh isolate
// serves. Node and browser shims stay lazy — there, module evaluation is
// process/page startup and boot latency is the cost that matters.
preloadSchemas();

/**
 * Whether `fetch()` may throw `TypeError` due to CORS. CORS is a browser-only concept —
 * in Cloudflare Workers, a `TypeError` from `fetch` is always a real network/configuration
 * error, never a CORS error.
 */
export const CORS_IS_POSSIBLE = false;

```

### Core Architecture Module: `packages/client/src/validators/cfWorker.ts`
```
/** Customisation entry point for the `@cfworker/json-schema` validator. */
export type { CfWorkerSchemaDraft } from '@modelcontextprotocol/core-internal/validators/cfWorker';
export { CfWorkerJsonSchemaValidator } from '@modelcontextprotocol/core-internal/validators/cfWorker';

```

### Core Architecture Module: `packages/codemod/src/utils/astUtils.ts`
```
import type { SourceFile } from 'ts-morph';
import { Node, SyntaxKind } from 'ts-morph';

export function isKeyPositionIdentifier(node: import('ts-morph').Node): boolean {
    const parent = node.getParent();
    if (!parent) return false;
    if (Node.isPropertyAssignment(parent) && parent.getNameNode() === node) return true;
    if (Node.isPropertyAccessExpression(parent) && parent.getNameNode() === node) return true;
    if (Node.isPropertySignature(parent) && parent.getNameNode() === node) return true;
    if (Node.isMethodDeclaration(parent) && parent.getNameNode() === node) return true;
    if (Node.isMethodSignature(parent) && parent.getNameNode() === node) return true;
    if (Node.isPropertyDeclaration(parent) && parent.getNameNode() === node) return true;
    if (Node.isEnumMember(parent) && parent.getNameNode() === node) return true;
    if (Node.isBindingElement(parent) && parent.getPropertyNameNode() === node) return true;
    if (Node.isGetAccessorDeclaration(parent) && parent.getNameNode() === node) return true;
    if (Node.isSetAccessorDeclaration(parent) && parent.getNameNode() === node) return true;
    return false;
}

export function renameAllReferences(sourceFile: SourceFile, oldName: string, newName: string): void {
    sourceFile.forEachDescendant(node => {
        if (Node.isIdentifier(node) && node.getText() === oldName) {
            const parent = node.getParent();
            if (!parent) return;
            if (Node.isImportSpecifier(parent)) return;
            if (Node.isExportSpecifier(parent)) {
                if (parent.getAliasNode() === node) return;
                if (!parent.getAliasNode()) parent.setAlias(oldName);
                parent.getNameNode().replaceWithText(newName);
                return;
            }
            if (isKeyPositionIdentifier(node)) return;
            if (Node.isShorthandPropertyAssignment(parent)) {
                parent.replaceWithText(`${oldName}: ${newName}`);
                return;
            }
            node.replaceWithText(newName);
        }
    });
}

/** First identifier named `name` that is not part of an import declaration. */
export function findFirstIdentifierOutsideImports(sourceFile: SourceFile, name: string): Node | undefined {
    for (const id of sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
        if (id.getText() !== name) continue;
        if (id.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)) continue;
        return id;
    }
    return undefined;
}

```

### Core Architecture Module: `packages/codemod/src/utils/detectFormatter.ts`
```
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** A code formatter the codemod can recommend running after a migration. */
export interface DetectedFormatter {
    /** Display name, e.g. `Prettier`. */
    name: string;
    /** Executable name, e.g. `prettier`. */
    bin: string;
    /** Arguments that write formatting in place; changed file paths are appended after these. */
    writeArgs: readonly string[];
}

const BIOME_CONFIG_FILES = ['biome.json', 'biome.jsonc'];
const PRETTIER_CONFIG_FILES = [
    '.prettierrc',
    '.prettierrc.json',
    '.prettierrc.json5',
    '.prettierrc.yaml',
    '.prettierrc.yml',
    '.prettierrc.toml',
    '.prettierrc.js',
    '.prettierrc.cjs',
    '.prettierrc.mjs',
    '.prettierrc.ts',
    'prettier.config.js',
    'prettier.config.cjs',
    'prettier.config.mjs',
    'prettier.config.ts'
];
const ESLINT_CONFIG_FILES = [
    'eslint.config.js',
    'eslint.config.mjs',
    'eslint.config.cjs',
    'eslint.config.ts',
    'eslint.config.mts',
    'eslint.config.cts',
    '.eslintrc',
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.json',
    '.eslintrc.yml',
    '.eslintrc.yaml'
];

// Precedence order: a configured dedicated formatter wins over ESLint's --fix.
const FORMATTERS = {
    biome: { name: 'Biome', bin: 'biome', writeArgs: ['format', '--write'] },
    prettier: { name: 'Prettier', bin: 'prettier', writeArgs: ['--write'] },
    eslint: { name: 'ESLint', bin: 'eslint', writeArgs: ['--fix'] }
} as const satisfies Record<string, DetectedFormatter>;

function hasAnyFile(dir: string, files: readonly string[]): boolean {
    return files.some(file => existsSync(path.join(dir, file)));
}

interface PackageJsonSignals {
    prettier: boolean;
    eslint: boolean;
}

function readPackageJsonSignals(dir: string): PackageJsonSignals {
    const pkgJsonPath = path.join(dir, 'package.json');
    if (!existsSync(pkgJsonPath)) return { prettier: false, eslint: false };
    try {
        const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as Record<string, unknown>;
        const allDeps = {
            ...(pkgJson.dependencies as Record<string, string> | undefined),
            ...(pkgJson.devDependencies as Record<string, string> | undefined)
        };
        return {
            prettier: 'prettier' in pkgJson || 'prettier' in allDeps,
            eslint: 'eslint' in allDeps
        };
    } catch {
        return { prettier: false, eslint: false };
    }
}

/**
 * Walks up from `startDir` looking for a configured code formatter, so the CLI can suggest the right
 * "format your changed files" command after a migration.
 *
 * The walk is bounded so a user-level global config is never mistaken for the project's. It stops at the
 * repository root (a `.git` directory) or the filesystem root, and — for a project that is not a git
 * checkout (tarball, fresh scaffold, CI workspace) — never ascends into or above `$HOME`, so a
 * `~/.prettierrc`, `~/biome.json`, or `~/package.json` with formatter deps is never matched. (A `.git`
 * boundary alone did not hold this guarantee for non-git projects, which would otherwise walk to `$HOME`.)
 *
 * Detection is config-based and runs nothing. When multiple formatters are configured, precedence is
 * Biome > Prettier > ESLint.
 *
 * @param startDir the directory to start the upward search from.
 * @param homeDir the user's home directory; the walk never reads it or any ancestor. Injectable for tests;
 *   defaults to `os.homedir()`.
 * @returns the detected formatter, or `null` if none is configured.
 */
export function detectFormatter(startDir: string, homeDir: string = os.homedir()): DetectedFormatter | null {
    let dir = path.resolve(startDir);
    const root = path.parse(dir).root;
    const home = path.resolve(homeDir);
    const found = { biome: false, prettier: false, eslint: false };

    while (true) {
        if (hasAnyFile(dir, BIOME_CONFIG_FILES)) found.biome = true;
        if (hasAnyFile(dir, PRETTIER_CONFIG_FILES)) found.prettier = true;
        if (hasAnyFile(dir, ESLINT_CONFIG_FILES)) found.eslint = true;

        const signals = readPackageJsonSignals(dir);
        if (signals.prettier) found.prettier = true;
        if (signals.eslint) found.eslint = true;

        // Stop at the repository root (a `.git` dir) or the filesystem root. For a project that is not a
        // git checkout (tarball, fresh scaffold, CI workspace), also stop before ascending into `$HOME`:
        // the project is a descendant of `$HOME`, so a user-level `~/.prettierrc`, `~/biome.json`, or
        // `~/package.json` with formatter deps must never be read as the project's own config.
        if (existsSync(path.join(dir, '.git')) || dir === root || dir === home || path.dirname(dir) === home) break;
        dir = path.dirname(dir);
    }

    if (found.biome) return FORMATTERS.biome;
    if (found.prettier) return FORMATTERS.prettier;
    if (found.eslint) return FORMATTERS.eslint;
    return null;
}

```

### Core Architecture Module: `packages/codemod/src/utils/diagnostics.ts`
```
import type { Node } from 'ts-morph';

import type { Diagnostic } from '../types';
import { DiagnosticLevel } from '../types';

export const CODEMOD_ERROR_PREFIX = '@mcp-codemod-error';

export function error(file: string, line: number, message: string): Diagnostic {
    return { level: DiagnosticLevel.Error, file, line, message };
}

export function warning(file: string, line: number, message: string): Diagnostic {
    return { level: DiagnosticLevel.Warning, file, line, message };
}

export function info(file: string, line: number, message: string): Diagnostic {
    return { level: DiagnosticLevel.Info, file, line, message };
}

export function v2Gap(file: string, line: number, message: string): Diagnostic {
    return { level: DiagnosticLevel.Warning, file, line, message, category: 'v2-gap' };
}

export function actionRequired(file: string, node: Node, message: string): Diagnostic {
    return {
        level: DiagnosticLevel.Warning,
        file,
        line: node.getStartLineNumber(),
        message,
        insertComment: true,
        resolveCurrentLine: () => node.getStartLineNumber()
    };
}

const LEVEL_PREFIX: Record<DiagnosticLevel, string> = {
    [DiagnosticLevel.Error]: 'ERROR',
    [DiagnosticLevel.Warning]: 'WARNING',
    [DiagnosticLevel.Info]: 'INFO'
};

export function formatDiagnostic(d: Diagnostic): string {
    const prefix = d.category === 'v2-gap' ? 'V2 GAP' : LEVEL_PREFIX[d.level];
    return `  ${d.file}:${d.line} - [${prefix}] ${d.message}`;
}

```

### Core Architecture Module: `packages/codemod/src/utils/importUtils.ts`
```
import type { ExportDeclaration, ImportDeclaration, SourceFile } from 'ts-morph';
import { Node } from 'ts-morph';

const SDK_PREFIX = '@modelcontextprotocol/sdk';

const V2_PACKAGES = new Set([
    '@modelcontextprotocol/client',
    '@modelcontextprotocol/server',
    '@modelcontextprotocol/core-internal',
    '@modelcontextprotocol/core',
    '@modelcontextprotocol/node',
    '@modelcontextprotocol/express'
]);

export function isSdkSpecifier(specifier: string): boolean {
    return specifier === SDK_PREFIX || specifier.startsWith(SDK_PREFIX + '/');
}

/**
 * Mock-framework methods whose first string argument is a module specifier. The single source of
 * truth shared by the mock-paths transform (which rewrites these specifiers), the runner (which
 * detects them), and the project analyzer (which counts them toward project-type inference) —
 * keep the three consumers in sync by editing only this set.
 */
export const MOCK_METHODS: ReadonlySet<string> = new Set([
    'mock',
    'doMock',
    'unmock',
    'dontMock',
    'deepUnmock',
    'requireActual',
    'importActual',
    'requireMock',
    'createMockFromModule'
]);
export const MOCK_CALLERS: ReadonlySet<string> = new Set(['vi', 'jest']);

export function getSdkImports(sourceFile: SourceFile): ImportDeclaration[] {
    return sourceFile.getImportDeclarations().filter(imp => {
        return isSdkSpecifier(imp.getModuleSpecifierValue());
    });
}

export function getSdkExports(sourceFile: SourceFile): ExportDeclaration[] {
    return sourceFile.getExportDeclarations().filter(exp => {
        const specifier = exp.getModuleSpecifierValue();
        return specifier != null && isSdkSpecifier(specifier);
    });
}

export function isTypeOnlyImport(imp: ImportDeclaration): boolean {
    return imp.isTypeOnly();
}

/** A named import to emit: either a bare name, or a `{ name, alias }` pair preserving an `as` alias. */
export type NamedImportSpec = string | { name: string; alias?: string };

function toSpec(n: NamedImportSpec): { name: string; alias?: string } {
    return typeof n === 'string' ? { name: n } : n;
}

/** Local binding a spec introduces — the alias when present, otherwise the imported name. */
function specLocalName(s: { name: string; alias?: string }): string {
    return s.alias ?? s.name;
}

/** Adds the names to an existing import of the module, or inserts a new import; returns true when it inserted one. */
export function addOrMergeImport(
    sourceFile: SourceFile,
    moduleSpecifier: string,
    namedImports: NamedImportSpec[],
    isTypeOnly: boolean,
    insertIndex: number,
    blankLineAbove = false
): boolean {
    if (namedImports.length === 0) return false;

    const specs = namedImports.map(n => toSpec(n));

    const existing = sourceFile.getImportDeclarations().find(imp => {
        if (imp.getNamespaceImport()) return false;
        return imp.getModuleSpecifierValue() === moduleSpecifier && imp.isTypeOnly() === isTypeOnly;
    });

    if (existing) {
        const existingLocals = new Set(existing.getNamedImports().map(n => n.getAliasNode()?.getText() ?? n.getName()));
        const newSpecs = specs.filter(s => !existingLocals.has(specLocalName(s)));
        if (newSpecs.length > 0) {
            existing.addNamedImports(newSpecs.map(s => (s.alias ? { name: s.name, alias: s.alias } : { name: s.name })));
        }
        return false;
    } else {
        const seen = new Set<string>();
        const deduped = specs.filter(s => {
            const local = specLocalName(s);
            if (seen.has(local)) return false;
            seen.add(local);
            return true;
        });
        const clampedIndex = Math.min(insertIndex, sourceFile.getStatementsWithComments().length);
        sourceFile.insertImportDeclaration(clampedIndex, {
            moduleSpecifier,
            namedImports: deduped.map(s => (s.alias ? { name: s.name, alias: s.alias } : { name: s.name })),
            isTypeOnly,
            leadingTrivia: blankLineAbove ? writer => writer.blankLineIfLastNot() : undefined
        });
        return true;
    }
}

/** True when the specifier resolves to one of the published v2 packages (root or subpath). */
export function isV2Specifier(specifier: string): boolean {
    if (V2_PACKAGES.has(specifier)) return true;
    const secondSlash = specifier.indexOf('/', specifier.indexOf('/') + 1);
    return secondSlash !== -1 && V2_PACKAGES.has(specifier.slice(0, secondSlash));
}

export function isAnyMcpSpecifier(specifier: string): boolean {
    if (isSdkSpecifier(specifier)) return true;
    if (V2_PACKAGES.has(specifier)) return true;
    const secondSlash = specifier.indexOf('/', specifier.indexOf('/') + 1);
    return secondSlash !== -1 && V2_PACKAGES.has(specifier.slice(0, secondSlash));
}

export function hasMcpImports(sourceFile: SourceFile): boolean {
    return sourceFile.getImportDeclarations().some(imp => isAnyMcpSpecifier(imp.getModuleSpecifierValue()));
}

export function isImportedFromMcp(sourceFile: SourceFile, symbolName: string): boolean {
    return sourceFile.getImportDeclarations().some(imp => {
        if (!isAnyMcpSpecifier(imp.getModuleSpecifierValue())) return false;
        return imp.getNamedImports().some(n => {
            const localName = n.getAliasNode()?.getText() ?? n.getName();
            return localName === symbolName;
        });
    });
}

export function isOriginalNameImportedFromMcp(sourceFile: SourceFile, exportName: string): boolean {
    return sourceFile.getImportDeclarations().some(imp => {
        if (!isAnyMcpSpecifier(imp.getModuleSpecifierValue())) return false;
        return imp.getNamedImports().some(n => n.getName() === exportName);
    });
}

export function resolveLocalImportName(sourceFile: SourceFile, exportName: string): string | undefined {
    for (const imp of sourceFile.getImportDeclarations()) {
        if (!isAnyMcpSpecifier(imp.getModuleSpecifierValue())) continue;
        for (const n of imp.getNamedImports()) {
            if (n.getName() === exportName) {
                return n.getAliasNode()?.getText() ?? exportName;
            }
        }
    }
    return undefined;
}

export function resolveOriginalImportName(sourceFile: SourceFile, localName: string): string | undefined {
    for (const imp of sourceFile.getImportDeclarations()) {
        for (const n of imp.getNamedImports()) {
            const alias = n.getAliasNode()?.getText();
            if (alias === localName) return n.getName();
            if (!alias && n.getName() === localName) return localName;
        }
    }
    return undefined;
}

export function removeUnusedImport(sourceFile: SourceFile, symbolName: string, onlyMcpImports?: boolean): void {
    let referenceCount = 0;
    sourceFile.forEachDescendant(node => {
        if (Node.isIdentifier(node) && node.getText() === symbolName) {
            const parent = node.getParent();
            if (parent && !Node.isImportSpecifier(parent)) {
                referenceCount++;
            }
        }
    });

    if (referenceCount === 0) {
        for (const imp of sourceFile.getImportDeclarations()) {
            if (onlyMcpImports && !isAnyMcpSpecifier(imp.getModuleSpecifierValue())) continue;
            for (const namedImport of imp.getNamedImports()) {
                if ((namedImport.getAliasNode()?.getText() ?? namedImport.getName()) === symbolName) {
                    namedImport.remove();
                    if (imp.getNamedImports().length === 0 && !imp.getDefaultImport() && !imp.getNamespaceImport()) {
                        imp.remove();
                    }
                    return;
                }
            }
        }
    }
}

```

### Core Architecture Module: `packages/codemod/src/utils/packageJsonUpdater.ts`
```
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import fg from 'fast-glob';

import type { PackageJsonChange } from '../types';
import { V2_PACKAGE_VERSIONS } from '../versions';
import { findPackageJson } from './projectAnalyzer';

const V1_PACKAGE = '@modelcontextprotocol/sdk';
const PRIVATE_PACKAGES = new Set(['@modelcontextprotocol/core-internal']);

type ZodSegmentVerdict = 'ok' | 'v3' | 'v4pre42';

/**
 * Classify one `||` alternative of a zod range by the highest version it can resolve
 * to. 'ok' = can reach >=4.2 (satisfies v2's floor); 'v3' = resolves into 3.x;
 * 'v4pre42' = resolves into 4.0/4.1 (typings predate `~standard.jsonSchema`, so
 * registration calls fail type-checking).
 */
function classifyZodSegment(segment: string): ZodSegmentVerdict {
    const seg = segment
        .replace(/^(?:workspace:|npm:)/, '')
        .replace(/^[=\s]+/, '')
        .trim();
    if (seg === '' || seg === '*' || seg === 'x' || seg === 'latest') return 'ok';

    const classifyUpper = (major: number, minor: number | undefined, inclusive: boolean): ZodSegmentVerdict => {
        if (major > 4) return 'ok';
        if (major < 4) return 'v3';
        // major === 4: an upper bound below 4.2 caps resolution at 4.0/4.1; `<4` and
        // `<4.0` cap it in 3.x. A bare inclusive major (`<=4`, `… - 4`) is an
        // X-range upper bound — it admits every 4.x release and satisfies the floor.
        if (minor === undefined) return inclusive ? 'ok' : 'v3';
        if (minor === 0 && inclusive === false) return 'v3';
        if (minor < 2) return 'v4pre42';
        if (minor === 2 && inclusive === false) return 'v4pre42';
        return 'ok';
    };

    // Hyphen range `A - B`: resolution maxes at B (inclusive).
    const hyphen = seg.match(/^\S+\s+-\s+v?(\d+)(?:\.(\d+))?/);
    if (hyphen) {
        return classifyUpper(Number(hyphen[1]), hyphen[2] === undefined ? undefined : Number(hyphen[2]), true);
    }

    // Comparator sets: an upper `<`/`<=` bound caps resolution; a floor with no upper
    // bound resolves to the latest release.
    const upper = seg.match(/<(=?)\s*v?(\d+)(?:\.(\d+))?/);
    if (upper) {
        return classifyUpper(Number(upper[2]), upper[3] === undefined ? undefined : Number(upper[3]), upper[1] === '=');
    }
    if (seg.startsWith('>')) return 'ok';

    // Caret: `^3.x` cannot reach 4; `^4.x` allows everything below 5.
    const caret = seg.match(/^\^\s*v?(\d+)/);
    if (caret) return Number(caret[1]) < 4 ? 'v3' : 'ok';

    // Tilde and bare/exact versions: `~4.1`/`4.1.x`/`=4.0.2` stay below 4.2; a bare
    // major (`4`, `~4`, `4.x`) allows the whole major line.
    const plain = seg.match(/^~?\s*v?(\d+)(?:\.(x|\*|\d+))?/);
    if (plain) {
        const major = Number(plain[1]);
        if (major < 4) return 'v3';
        if (major > 4) return 'ok';
        const minorRaw = plain[2];
        if (minorRaw === undefined || minorRaw === 'x' || minorRaw === '*') return 'ok';
        return Number(minorRaw) < 2 ? 'v4pre42' : 'ok';
    }
    return 'ok';
}

export interface ManifestInfo {
    /** Directory containing the manifest. */
    dir: string;
    /** Absolute path of the package.json. */
    path: string;
}

export function normalizeToRoot(pkg: string): string {
    const secondSlash = pkg.indexOf('/', pkg.indexOf('/') + 1);
    if (secondSlash === -1) return pkg;
    return pkg.slice(0, secondSlash);
}

/** ts-morph standardizes file paths to forward slashes on every platform; manifests must compare the same way. */
function toPosix(p: string): string {
    return p.replaceAll('\\', '/');
}

function detectIndent(text: string): string {
    const match = text.match(/\n([ \t]+)/);
    return match ? match[1]! : '  ';
}

function readJson(p: string): { raw: string; json: Record<string, unknown> } | undefined {
    try {
        const raw = readFileSync(p, 'utf8');
        return { raw, json: JSON.parse(raw) as Record<string, unknown> };
    } catch {
        return undefined;
    }
}

/** Parse the `packages:` list out of a pnpm-workspace.yaml without a YAML dependency. */
function pnpmWorkspaceGlobs(rootDir: string): string[] {
    const p = path.join(rootDir, 'pnpm-workspace.yaml');
    if (!existsSync(p)) return [];
    const globs: string[] = [];
    let inPackages = false;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
        if (/^packages\s*:/.test(line)) {
            inPackages = true;
            continue;
        }
        if (inPackages) {
            const item = line.match(/^\s+-\s*['"]?([^'"#]+?)['"]?\s*(?:#.*)?$/);
            if (item) {
                globs.push(item[1]!);
                continue;
            }
            if (/^\S/.test(line)) inPackages = false; // next top-level key
        }
    }
    return globs;
}

/** Workspace member globs from the root manifest's `workspaces` field (npm/yarn/bun shape). */
function npmWorkspaceGlobs(rootJson: Record<string, unknown>): string[] {
    const ws = rootJson.workspaces;
    if (Array.isArray(ws)) return ws.filter((g): g is string => typeof g === 'string');
    if (ws && typeof ws === 'object' && Array.isArray((ws as { packages?: unknown }).packages)) {
        return (ws as { packages: unknown[] }).packages.filter((g): g is string => typeof g === 'string');
    }
    return [];
}

/**
 * The manifests a migration run may need to update: the nearest package.json walking
 * up from the target directory, plus every workspace-member manifest it declares
 * (npm/yarn/bun `workspaces` and pnpm-workspace.yaml), so monorepo members do not
 * keep a stale v1 dependency the root swap never sees.
 */
export function discoverManifests(targetDir: string): ManifestInfo[] {
    const rootManifest = findPackageJson(targetDir);
    if (!rootManifest) return [];
    const rootDir = path.dirname(rootManifest);
    const manifests: ManifestInfo[] = [{ dir: toPosix(rootDir), path: rootManifest }];

    const rootJson = readJson(rootManifest)?.json ?? {};
    const memberGlobs = [...npmWorkspaceGlobs(rootJson), ...pnpmWorkspaceGlobs(rootDir)];
    if (memberGlobs.length === 0) return manifests;

    const memberDirs = fg.sync(memberGlobs, {
        cwd: rootDir,
        onlyDirectories: true,
        followSymbolicLinks: false,
        suppressErrors: true,
        ignore: ['**/node_modules/**'],
        absolute: true
    });
    // Workspace members live under the root that declares them; a glob that
    // resolves elsewhere (an absolute pattern, a parent reference) is outside this
    // run's scope and is not reported.
    const resolvedRoot = path.resolve(rootDir);
    for (const dir of memberDirs) {
        if (!path.resolve(dir).startsWith(resolvedRoot + path.sep)) continue;
        const manifest = path.join(dir, 'package.json');
        if (existsSync(manifest) && manifest !== rootManifest) {
            manifests.push({ dir: toPosix(dir), path: manifest });
        }
    }
    return manifests;
}

/** Longest-prefix owner of a file among the discovered manifest directories. */
export function ownerManifest(filePath: string, manifests: readonly ManifestInfo[]): ManifestInfo | undefined {
    const posixFile = toPosix(filePath);
    let best: ManifestInfo | undefined;
    for (const m of manifests) {
        const dir = toPosix(m.dir);
        const prefix = dir.endsWith('/') ? dir : dir + '/';
        if (posixFile.startsWith(prefix) && (!best || dir.length > (best ? toPosix(best.dir).length : 0))) {
            best = m;
        }
    }
    return best;
}

function zodWarning(...depSections: (Record<string, string> | undefined)[]): string | undefined {
    const range = depSections.find(section => section?.zod !== undefined)?.zod;
    if (range === undefined) return undefined;
    // Every `||` alternative must fall short of the floor before we warn — `^3.25 || ^4.5` resolves fine.
    const verdicts = range.split('||').map(seg => classifyZodSegment(seg));
    if (verdicts.length === 0 || verdicts.includes('ok')) return undefined;
    const floor = `zod range '${range}' cannot satisfy v2's floor: zod >=4.2.0 is required. `;
    if (verdicts.every(v => v === 'v4pre42')) {
        return (
            floor +
            `This range resolves to zod 4.0-4.1, which predates ~standard.jsonSchema: registerTool/registerPrompt ` +
            `calls fail type-checking (TS2769: no overload matches), and plain-JavaScript projects run through a ` +
            `bundled fallback that drops .describe() field descriptions.`
        );
    }
    return (
        floor +
        `An older range installs cleanly and then, depending on the zod entry point your code imports, ` +
        `fails type-checking (zod/v4 subpath) or only fails at runtime ` +
        `(main-entry imports: the server starts normally and the first tools/list reports the failure).`
    );
}

interface ParsedManifest {
    raw: string;
    json: Record<string, unknown>;
    deps?: Record<string, string>;
    devDeps?: Record<string, string>;
    peerDeps?: Record<string, string>;
    optionalDeps?: Record<string, string>;
    declaresV1: boolean;
}

function parseManifest(manifestPath: string): ParsedManifest | undefined {
    const parsed = readJson(manifestPath);
    if (!parsed) return undefined;
    const deps = parsed.json.dependencies as Record<string, string> | undefined;
    const devDeps = parsed.json.devDependencies as Record<string, string> | undefined;
    const peerDeps = parsed.json.peerDependencies as Record<string, string> | undefined;
    const optionalDeps = parsed.json.optionalDependencies as Record<string, string> | undefined;
    return {
        raw: parsed.raw,
        json: parsed.json,
        deps,
        devDeps,
        peerDeps,
        optionalDeps,
        declaresV1: (deps !== undefined && V1_PACKAGE in deps) || (devDeps !== undefined && V1_PACKAGE in devDeps)
    };
}

/**
 * Swap the v1 SDK dependency for the v2 packages in the **nearest** manifest (the
 * first 
```

### Core Architecture Module: `packages/codemod/src/utils/projectAnalyzer.ts`
```
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import type { Diagnostic, TransformContext } from '../types';
import { info, warning } from './diagnostics';
import { MOCK_CALLERS, MOCK_METHODS } from './importUtils';

const PROJECT_ROOT_MARKERS = ['.git', 'node_modules'];

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const SCAN_SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'build', '.next', '.nuxt', 'coverage']);
const SCAN_FILE_BUDGET = 5000;

// Matches a quoted v1 SDK client/server subpath — e.g.
//   '@modelcontextprotocol/sdk/client/index.js'   "@modelcontextprotocol/sdk/server/mcp.js"
//   '@modelcontextprotocol/sdk/client'            (extensionless / bare subpath; see the extensionless
//                                                  import matching the codemod already supports)
// — but only in a module-specifier position: after `from` (static imports and re-exports), `import`
// (side-effect and dynamic imports, tolerating webpack-style /* magic comments */ inside `import(`),
// `require(` / `require.resolve(`, or the vi./jest. mock-method calls the mock-paths transform
// rewrites (MOCK_CALLERS/MOCK_METHODS). A bare SDK path in ordinary string data (example text, log
// messages, config values) no longer counts toward project-type inference (#2760).
//
// Known limitation: the scan is lexical, not a parser, so a string whose TEXT embeds a full import
// statement (e.g. help text quoting `from '@modelcontextprotocol/sdk/server/mcp.js'`) still counts —
// the inner `from '` is indistinguishable from a real specifier position without parsing, which the
// budget-bounded scan deliberately avoids.
//
// The tail is anchored to a trailing `/` or closing quote so `…/client` is not confused with
// `…/clientfoo`.
const MOCK_CALL = String.raw`(?:${[...MOCK_CALLERS].join('|')})\s*\.\s*(?:${[...MOCK_METHODS].join('|')})`;
const SPECIFIER_POSITION =
    String.raw`(?:\bfrom\s*` + // static import / re-export
    String.raw`|\bimport\s*\(\s*(?:\/\*[\s\S]*?\*\/\s*)*` + // dynamic import(), optional magic comments
    String.raw`|\bimport\s*` + // side-effect import
    String.raw`|\brequire\s*(?:\.\s*resolve\s*)?\(\s*` + // require() / require.resolve()
    String.raw`|\b${MOCK_CALL}\s*\(\s*` + // vi.mock(...), jest.requireActual(...), ...
    `)`;
const CLIENT_IMPORT_RE = new RegExp(SPECIFIER_POSITION + /['"`]@modelcontextprotocol\/sdk\/client(?:\/|['"`])/.source);
const SERVER_IMPORT_RE = new RegExp(SPECIFIER_POSITION + /['"`]@modelcontextprotocol\/sdk\/server(?:\/|['"`])/.source);

export function findPackageJson(startDir: string): string | undefined {
    let dir = path.resolve(startDir);
    const root = path.parse(dir).root;
    while (true) {
        const candidate = path.join(dir, 'package.json');
        if (existsSync(candidate)) return candidate;
        if (dir === root) return undefined;
        if (PROJECT_ROOT_MARKERS.some(m => existsSync(path.join(dir, m)))) return undefined;
        dir = path.dirname(dir);
    }
}

export function analyzeProject(targetDir: string): TransformContext {
    const pkgJsonPath = findPackageJson(targetDir);
    if (pkgJsonPath) {
        try {
            const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
            const allDeps = {
                ...pkgJson.dependencies,
                ...pkgJson.devDependencies
            };

            const hasClient = '@modelcontextprotocol/client' in allDeps;
            const hasServer = '@modelcontextprotocol/server' in allDeps;

            if (hasClient && hasServer) return { projectType: 'both' };
            if (hasClient) return { projectType: 'client' };
            if (hasServer) return { projectType: 'server' };
            // No v2 split deps — this is almost always a v1 project mid-migration (v1 ships as the single
            // `@modelcontextprotocol/sdk` package). Fall through to inferring the type from source usage.
        } catch {
            // Malformed package.json — fall through to source inference.
        }
    }

    return { projectType: inferProjectTypeFromSource(targetDir) };
}

/**
 * Infer client vs server vs both by scanning the source for v1 SDK subpath imports: a
 * `@modelcontextprotocol/sdk/client/...` specifier means the project will need
 * `@modelcontextprotocol/client`; a `.../server/...` specifier means it needs `@modelcontextprotocol/server`.
 * Files that import only shared paths (`types.js`, `shared/...`) give no signal. The scan matches quoted
 * specifiers (not bare substrings), so comments/prose are ignored. Bounded: skips heavy dirs, caps the
 * file count, and early-exits once both signals are seen.
 */
function inferProjectTypeFromSource(targetDir: string): TransformContext['projectType'] {
    let usesClient = false;
    let usesServer = false;
    let scanned = 0;

    const visit = (dir: string): void => {
        if (usesClient && usesServer) return;
        let entries: import('node:fs').Dirent[];
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (usesClient && usesServer) return;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (SCAN_SKIP_DIRS.has(entry.name)) continue;
                visit(full);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name);
                if (!SCAN_EXTENSIONS.has(ext) || entry.name.endsWith('.d.ts')) continue;
                if (scanned >= SCAN_FILE_BUDGET) return;
                scanned++;
                let content: string;
                try {
                    content = readFileSync(full, 'utf8');
                } catch {
                    continue;
                }
                if (!usesClient && CLIENT_IMPORT_RE.test(content)) usesClient = true;
                if (!usesServer && SERVER_IMPORT_RE.test(content)) usesServer = true;
            }
        }
    };

    let root = targetDir;
    try {
        if (!statSync(targetDir).isDirectory()) root = path.dirname(targetDir);
    } catch {
        return 'unknown';
    }
    visit(root);

    if (usesClient && usesServer) return 'both';
    if (usesClient) return 'client';
    if (usesServer) return 'server';
    return 'unknown';
}

export function resolveTypesPackage(
    context: TransformContext,
    fileHasClientImports: boolean,
    fileHasServerImports: boolean,
    diagnosticSink?: { filePath: string; line: number; diagnostics: Diagnostic[] }
): string {
    if (fileHasClientImports && !fileHasServerImports) {
        return '@modelcontextprotocol/client';
    }
    if (fileHasServerImports && !fileHasClientImports) {
        return '@modelcontextprotocol/server';
    }
    if (context.projectType === 'client') {
        return '@modelcontextprotocol/client';
    }
    if (context.projectType === 'server') {
        return '@modelcontextprotocol/server';
    }
    if (context.projectType === 'both') {
        // Both packages are present and both re-export the shared protocol types (from core), so importing
        // from either compiles. This file has no client/server-specific signal — default to server and note
        // it as an optional preference, not an action-required warning.
        if (diagnosticSink) {
            diagnosticSink.diagnostics.push(
                info(
                    diagnosticSink.filePath,
                    diagnosticSink.line,
                    'Shared protocol types imported from @modelcontextprotocol/server (both client and server ' +
                        're-export them). Switch to @modelcontextprotocol/client if this is client-only code.'
                )
            );
        }
        return '@modelcontextprotocol/server';
    }
    if (diagnosticSink) {
        diagnosticSink.diagnostics.push(
            warning(
                diagnosticSink.filePath,
                diagnosticSink.line,
                'Could not determine project type (client vs server). Defaulting to @modelcontextprotocol/server. ' +
                    'If this is a client-only project, adjust imports manually.'
            )
        );
    }
    return '@modelcontextprotocol/server';
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2657** (2026-09-03): **[v2] classifyNetworkError passes { cause } into SdkError's data slot, so the underlying network error never reaches Error.cause**
  *Symptoms*: ## What happened?  Connecting to an unreachable host with `versionNegotiation: { mode: "auto" }` rejects with an `SdkError` whose **`cause` is `undefined`**. The underlying `TypeError: fetch failed` — and the DNS error beneath it that actually names the failure — is retained, but at `error.data.cause`. Anything walking the standard `.cause` chain stops at the `SdkError`.  `classifyNetworkError` passes `{ cause: error }` as the third argument:  ```js // dist/index.mjs:2400 return { 	kind: "error", 	error: new SdkError(SdkErrorCode.EraNegotiationFailed, `Version negotiation probe failed: ${describeError(error)}`, { cause: error }) }; ```  But `SdkError`'s third parameter is `data`, not `ErrorOptions`, and `super()` is called without it:  ```js // dist/src-D_zzAWoS.mjs:342 var SdkError = class extends Error { 	constructor(code, message, data) { 		super(message);          // <- options never forwarded 		this.code = code; 		this.data = data;        // <- the { cause } object lands here 		this.name = "SdkError"; 		stampErrorBrands(this, new.target); 	} }; ```  So the `{ cause }` ends up in the `data` slot. `data` is a legitimate parameter — `SdkHttpError` reads `status`/`statusText` off it — which is what makes this a call-site mismatch rather than an intended shape.  ### Why it matters  Cause-chain walking is how error detail reaches logs and error trackers: pino's default `err` serializer (`pino-std-serializers`) builds its message by recursing `.cause`, and Sentry links exceptio
  **Post-Mortem & Fix Analysis**:
  > Hi, I'd like to work on this issue.  I'll first add a regression test that verifies the original network error is available through the standard Error.cause chain when version negotiation fails, then make the smallest compatible change around SdkError/classifyNetworkError. I'll keep the PR focused on this issue.

- **Issue #2650** (2026-09-28): **[v2] subscriptions/listen holds a stream open even when it has honoured nothing**
  *Symptoms*: ## What happened?  ### Summary  `listenRouter.serve()` computes `honoredSubset(filter, capabilities)` — the set of notification types it will actually deliver — and then opens the SSE stream, sends the acknowledgement, subscribes to the event bus and arms a keep-alive timer **without ever consulting that set**.  When a server advertises no `listChanged` capabilities and no `resources.subscribe`, `honored` is `{}`. The stream can never carry a single notification, and nothing in the router ever closes it: `teardown` runs only on client disconnect or signal abort. The connection is held open, indefinitely, to deliver a set that is provably empty.  On a long-lived process this costs a socket and a timer. On a request-scoped runtime (Vercel, Lambda, Cloud Run) it consumes the entire invocation until the platform kills it.  ### Where  `@modelcontextprotocol/server` — `listenRouter.serve()`:  ```js const honored = honoredSubset(filter, capabilities);   // may be {} // ... const readable = new ReadableStream({   start(streamController) {     controller = streamController;     const ack = stampSubscriptionId({       method: "notifications/subscriptions/acknowledged",       params: { notifications: honored },              // {} — nothing agreed     }, subscriptionId);     writeNotification(ack.method, ack.params);     unsubscribe = bus.subscribe(/* ... */);            // subscribed anyway     keepAliveTimer = armSseKeepAlive(/* ... */);       // held open anyway     open.add(teardown)
  **Post-Mortem & Fix Analysis**:
  > I’m taking this on. I’ll add a focused regression test covering an empty honoured notification set, then make the smallest change to acknowledge and complete that subscription without creating a bus subscription or keep-alive timer. I’ll keep normal subscribed streams unchanged.
  > @SoulmatelynchVFX — heads up before you spend time on this: #2651 has been open since 12 Aug and does what you described. Flagging it only so the work is not duplicated.  It adds a regression test for the empty honoured set, and makes `serve()` write the acknowledgement and then take the existing graceful `teardown(true)` path when `honoredSubset()` comes back empty — no bus subscription, no keep-alive. Streams that honour at least one type are untouched. CI is green across Node 20/22/24, both conformance suites, bun and deno.  One thing in it worth a second pair of eyes either way: the e2e test `subscriptions:listen:capacity-guard` opened both of its subscriptions with `notifications: {}`, which is precisely the case this closes — so under the fix the first subscription completes and frees its slot, and the second no longer hits the cap. The PR changes that filter to `{ toolsListChanged: true }`, which `makeServer()` advertises, so the guard is still exercised by a subscription a serv
  > Fixed by #2651 for a server that honors none of the requested types. A server with default settings still honors tool changes, so its stream is held as before. That case is tracked in #2873.

- **Issue #2607** (2026-09-28): **createMcpHandler: reused McpServer instance grows an unbounded onclose chain — memory leak, then uncatchable RangeError after ~20k requests**
  *Symptoms*: ## SDK Version  `@modelcontextprotocol/server` 2.0.0 (also present in current `createMcpHandler.ts` on main)  ## Environment  Node.js 26.5.0, macOS (darwin 25.5.0) — but nothing platform-specific  ## Description  `createMcpHandler` wraps `server.onclose` once per handled request (`packages/server/src/server/createMcpHandler.ts`):  ```js const previousOnClose = server.onclose; inflight.add(server); server.onclose = () => {     inflight.delete(server);     previousOnClose?.(); }; ```  If the factory passed to `createMcpHandler` returns the **same** `McpServer` instance for every session, each request adds another layer to this chain. The chain grows without bound:  1. **Memory leak** — every request retains one more closure (plus whatever it captures) for the lifetime of the server. 2. **Process crash** — when the chain eventually runs (session cleanup under sustained load, or `handler.close()`), it recurses one stack frame per accumulated wrapper and dies with `RangeError: Maximum call stack size exceeded`. In our runs the overflow lands at roughly 19–25k accumulated sessions.  Notably, the crash surfaces as an **uncaught async error after `handler.close()` has already resolved**, so the caller can't even `try/catch` around `close()` — the process just dies:  ``` closing handler… closed cleanly          <-- close() resolved RangeError: Maximum call stack size exceeded     at Set.delete (<anonymous>)     at server.onclose (@modelcontextprotocol/server/dist/index.mjs:1295:19)   
  **Post-Mortem & Fix Analysis**:
  > I’m working on a focused fix for this: avoid recursively wrapping a reused server's onclose and add a regression test for repeated createMcpHandler requests using the same McpServer instance.

- **Issue #2604** (2026-09-28): **CODEOWNERS auth paths do not resolve on main, so the auth team is never auto-requested**
  *Symptoms*: ## What  On `main`, none of the five auth paths in `.github/CODEOWNERS` resolve to anything. The `*` catch-all still matches, so reviews are still requested and nothing looks broken. But `@modelcontextprotocol/typescript-sdk-auth` is no longer auto-requested on auth changes.  `v1.x` has a byte-identical CODEOWNERS where all five patterns resolve. The file just wasn't revisited when `main` became a monorepo; its last two commits are #781 and #803, both from July 2025.  ## Evidence  Matches against the full `main` tree (1427 entries, no `src/` at root):  | Pattern | `main` | `v1.x` | | --- | --- | --- | | `/src/server/auth/` | 0 | 17 | | `/src/client/auth*` | 0 | 2 | | `/src/shared/auth*` | 0 | 2 | | `/src/examples/client/simpleOAuthClient.ts` | 0 | 1 | | `/src/examples/server/demoInMemoryOAuthProvider.ts` | 0 | 1 |  A dangling pattern would matter less if code-owner review were advisory, but the org ruleset on the default branch sets `require_code_owner_review: true`. So the catch-all is carrying every auth review.  ## Where auth code lives now  Roughly, if it's useful:  - `packages/core/src/auth.ts` — `SafeUrlSchema`, `OAuthProtectedResourceMetadataSchema` (RFC 9728) - `packages/core-internal/src/auth/errors.ts`, `src/shared/auth.ts`, `src/shared/authUtils.ts` - `packages/client/src/client/auth.ts`, `authErrors.ts`, `authExtensions.ts`, `authSeam.ts` - `packages/server/src/server/middleware/bearerAuth.ts`, `oauthMetadata.ts` - `packages/middleware/express/src/auth/` — `bearer
  **Post-Mortem & Fix Analysis**:
  > @conorbronsdon I had a go at this locally before spotting that you'd offered to send the PR — happy to stand down if you're still on it.  For what it's worth, the mapping does resolve cleanly if it's useful either way. I followed rename history (`git log --follow`) rather than filename similarity, which lands on ten patterns: the `server-legacy` auth tree, the two runtime-neutral server middlewares from #2420/#2422, the express auth glue from #1907, the `core-internal` auth errors, `client/auth*`, `core/src/auth.ts`, `core-internal/shared/auth*`, and the two examples. Checked with git's own gitignore engine (`git -c core.excludesFile=… check-ignore --no-index`), the old block matches 0 files on `main` and the new one matches 35.  The only one that needed a judgement call was `demoInMemoryOAuthProvider.ts`, which has no rename edge — but `examples/shared/test/demoInMemoryOAuthProvider.test.ts` kept the old name while importing `createDemoAuth` from `../src/auth`, so `examples/shared/src

- **Issue #2598** (2026-09-30): **v2: extension methods shadowed by legacy spec-method registry — custom tasks/get & tasks/cancel handlers unreachable (-32601 before handler lookup)**
  *Symptoms*: ### Summary  On SDK v2 (`@modelcontextprotocol/server@2.0.0` + `@modelcontextprotocol/node@2.0.0`), a server implementing the **Tasks extension** (`io.modelcontextprotocol/tasks`, SEP-2663) cannot serve `tasks/get` or `tasks/cancel`: requests to these methods are rejected with `-32601` **before custom request handlers are consulted**, even when a handler is registered and the client declares the tasks extension capability.  ### Root cause  `packages/core-internal/src/shared/protocol.ts` gates incoming requests with:  ```ts if (isSpecRequestMethod(request.method) && !codec.hasRequestMethod(request.method)) {     // → -32601 before custom handler lookup } ```  `isSpecRequestMethod()` (`packages/core-internal/src/wire/codec.ts`) answers against the **union of the 2025 and 2026 method registries**. `tasks/get` and `tasks/cancel` are in that union — they existed in the 2025-11-25 revision as *experimental core* methods — but the 2026-07-28 codec does not contain them, because tasks moved out of core into the extension. Result:  - `tasks/get` / `tasks/cancel` → "spec method" (per the legacy registry) + "not in modern codec" → rejected with `-32601` before the handler table is checked. - `tasks/update` (a name **new** in the redesigned extension, absent from the legacy registry) → passes the gate, and a custom handler registered via `server.server.setRequestHandler(...)` works fine.  So any extension method that happens to collide with a *historical* core method name is unservable i
  **Post-Mortem & Fix Analysis**:
  > Opened a fix: https://github.com/modelcontextprotocol/typescript-sdk/pull/2599  Root cause matches the analysis above — both the inbound and outbound era gates treat the SPEC-METHOD UNIVERSE as the union of every era's registry, so a name like `tasks/get` that a past revision used for a since-removed core method stays gated forever, even for an explicit-schema handler/call registered by the extension. The fix scopes the gate to the TYPED dispatch path only (`setRequestHandler(method, handler)` / `request(method, options)`) and exempts explicit-schema registrations/calls (`setRequestHandler(method, schemas, handler)` / `request(request, resultSchema, options)`), which is the extension-authoring path both directions already require task methods to use.
  > I independently reproduced this against the published `@modelcontextprotocol/server@2.0.0` and `@modelcontextprotocol/node@2.0.0` packages on a `2026-07-28` connection. The runnable reproduction is pinned here:  <https://github.com/AndresSaa/mcp-durable-tasks/blob/27bf8cb9c2a550c95c7d6e5c45ea8e885f24e8e0/examples/conformance-reproductions/era-gate.mts>  It asserts all four parts of the dispatch boundary: `tasks/get` and `tasks/cancel` return `-32601` without reaching their explicit-schema handlers; `tasks/update` and a vendor-named control do reach theirs; an unrelated unknown method reaches `fallbackRequestHandler`; and neither blocked name does. This is the explicit-schema registration path addressed by #2599.  
  > Serving the `io.modelcontextprotocol/tasks` extension (2026-07-28 schema) from a server built on `@modelcontextprotocol/server` 2.0.0, we hit the same wall and measured it against the published bundle, `package/dist/src-CX2iR2pK.mjs`.  What we measured:  * The guard is at `package/dist/src-CX2iR2pK.mjs:6397` (source `packages/core-internal/src/shared/protocol.ts:1003`) and it runs before the handler lookup on the next line. `isSpecRequestMethod` at `:4191-4197` answers against `ALL_CODECS = [rev2025Codec, rev2026Codec]`, i.e. the union. The 2026 request registry at `:3911-3921` holds exactly ten names and no task method; `tasks/get` and `tasks/cancel` sit in the 2025 registry at `:2183-2186`. * On the modern route, with three explicit-schema handlers registered on one server: `tasks/update` returns 200, `tasks/cancel` and `tasks/get` return HTTP 404 with `-32601`. `ping` returns 404 with `-32601` too, so the rule is "in the union, absent from the negotiated era's registry", not anythin

- **Issue #2575** (2026-09-28): **codemod v1-to-v2 hoists rewritten imports above the file's license header**
  *Symptoms*: `v1-to-v2` moves a rewritten import above the file's leading comment block. On a file whose leading comment is a license or copyright header, the header stops being the first thing in the file, and any lint rule that enforces header position (`eslint-plugin-header`, `eslint-plugin-notice`, SPDX scanners) starts failing on a file it previously passed.  The guide's remedy for layout damage is "run your formatter". Prettier does not move the import back, so this survives the documented cleanup step.  ### Repro  ```bash mkdir -p repro/src && cd repro cat > package.json <<'EOF' { "name": "repro", "version": "1.0.0", "type": "module",   "dependencies": { "@modelcontextprotocol/sdk": "^1.29.0" } } EOF cat > src/a.ts <<'EOF' // Copyright (c) 2026 Example Corp. // SPDX-License-Identifier: Apache-2.0  import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';  export const ok = (): CallToolResult => ({ content: [] }); EOF npx @modelcontextprotocol/codemod@2.0.0 v1-to-v2 . cat src/a.ts ```  Actual:  ```ts import type { CallToolResult } from "@modelcontextprotocol/server";  // Copyright (c) 2026 Example Corp. // SPDX-License-Identifier: Apache-2.0 export const ok = (): CallToolResult => ({ content: [] }); ```  Expected: the import stays where it was, below the header.  ```ts // Copyright (c) 2026 Example Corp. // SPDX-License-Identifier: Apache-2.0  import type { CallToolResult } from "@modelcontextprotocol/server";  export const ok = (): CallToolResult => ({ content: [] }
  **Post-Mortem & Fix Analysis**:
  > Adding the specific location, since the original report only showed the symptom.  The insertion happens in **`packages/codemod/src/utils/importUtils.ts`**, in `addOrMergeImport`:  ```ts const clampedIndex = Math.min(insertIndex, sourceFile.getImportDeclarations().length); sourceFile.insertImportDeclaration(clampedIndex, { ... }); ```  `insertIndex` reaches it from **`packages/codemod/src/migrations/v1-to-v2/transforms/importPaths.ts`**, where it is computed against the *pre-removal* import list:  ```ts const insertIndex = sourceFile.getImportDeclarations().indexOf(sdkImports[0]!); ```  and then used further down, after the original declaration has already been dropped by `imp.remove()`, at the `addOrMergeImport(sourceFile, target, [...valueSpecs.values()], false, insertIndex)` call.  That combination is what produces the reordering. A leading comment block is *trivia attached to the first statement*, not a statement of its own, so when the old SDK import is the file's first statement t
  > Both shapes reproduce on `main`. Root cause is the same for each: an index-inserted import is positioned against the *full* start of the declaration it replaces, i.e. ahead of that declaration's leading trivia — so the emitted import lands above the header, or between two lines of a multi-line `//` run.  Picking this up — PR incoming.

- **Issue #2548** (2026-09-28): **Widen @hono/node-server range to ^1.19.9 || ^2 so GHSA-frvp-7c67-39w9 is reachable (npm suggests a breaking downgrade)**
  *Symptoms*: ### Summary  Every `@modelcontextprotocol/sdk` release since **1.25.0** pins `"@hono/node-server": "^1.19.9"`. The advisory **GHSA-frvp-7c67-39w9** (path traversal in `serve-static`) is fixed in `@hono/node-server` **>= 2.0.5**, which that caret cannot reach.  The result: `npm audit` flags the SDK for every downstream consumer, and because no version *forward* clears it, npm's suggested fix resolves **backwards to 1.24.3** — the last release before `@hono/node-server` became a dependency.  ### Why the suggested fix is unusable  `1.24.3` predates `WebStandardStreamableHTTPServerTransport`. Any consumer importing that transport (we do, from Next.js route handlers) fails at build time if they take npm's advice. So the practical options today are "ship with a permanent audit finding" or "break the build."  ### Request  Widen the range so the fixed line is reachable:  ```json "@hono/node-server": "^1.19.9 || ^2" ```  `2.x` keeps the same export map (`.`, `./conninfo`, `./serve-static`, `./utils/*`), the same `hono@^4` peer, and still exports `getRequestListener` — which appears to be the only symbol the SDK imports from it (in `dist/esm/server/streamableHttp.js`). The bump requires Node >= 20.  ### Impact note  For consumers who only use the Web-Standard transport, the vulnerable `serve-static` module is never imported, and the flaw itself is Windows-specific (`%5C` → `\` path resolution). So this is largely an **audit-noise** problem rather than an exploitable one — but it is noi
  **Post-Mortem & Fix Analysis**:
  > I’d like to take this. I’ll keep the change narrowly scoped to the v1.x dependency range, refresh the lockfile, and verify the fixed @hono/node-server 2.x line is resolvable without changing the existing 1.x compatibility floor.
  > I checked this against the stable v1.x engine contract before changing the lockfile. There is a compatibility blocker: v1.x declares Node >=18, while @hono/node-server 2.x requires Node >=20. Widening to ^1.19.9 || ^2 would let Node 18 installs resolve an engine-incompatible major. I’m stepping back from a PR rather than shipping that regression; this likely needs a maintainer decision to either raise the SDK engine floor or use a different remediation.
  > The v1.x half of this shipped in 1.30.0 via #2549. The `main` half is still open: #2549 merged to a branch that doesn't use changesets, so it cannot propagate to the v2 monorepo — `@modelcontextprotocol/node@2.0.0` still declares `^1.19.9`. On `main` the range lives in the `runtimeServerOnly` catalog in `pnpm-workspace.yaml` rather than the package manifest.  I'm opening a PR against `main` with the same range #2549 merged (`^1.19.9 || ^2.0.5`), the lockfile moved to 2.0.11 as that change did, plus a changeset. The engines concern raised above doesn't arise on `main`: `@modelcontextprotocol/node` already declares `engines.node >= 20`, which is exactly `@hono/node-server@2`'s floor.

- **Issue #2532** (2026-08-19): **Default JSON Schema validators reject declared draft-07, which the spec permits**
  *Symptoms*: Both default validators (`AjvJsonSchemaValidator` and `CfWorkerJsonSchemaValidator`) throw on any tool schema that declares a non-2020-12 dialect:  ``` Tool 'example' has an invalid outputSchema: JSON Schema declares an unsupported dialect ("$schema": "http://json-schema.org/draft-07/schema#"). The default validator supports JSON Schema 2020-12 only. ```  Per the spec, 2020-12 is only the **default when `$schema` is absent** — an explicitly declared draft-07 dialect is valid on all protocol versions (the spec's own examples include it). So schemas the spec permits currently hard-fail `tools/call` in the client.  The practical impact is wide: `zod-to-json-schema`, which v1 SDK servers use for `outputSchema`, stamps `"$schema": ".../draft-07/schema#"` on every schema. Any v2-SDK client talking to any v1-SDK server with an output schema fails on every tool call, with no server-side fix available short of rewriting the server.  **Repro:**  ```ts import { AjvJsonSchemaValidator } from "@modelcontextprotocol/client/validators/ajv";  new AjvJsonSchemaValidator().getValidator({   $schema: "http://json-schema.org/draft-07/schema#",   type: "object", }); // throws "unsupported dialect" ```  **Expected:** validate the schema using the dialect it declares (or at minimum draft-07, given its ubiquity via zod), rather than rejecting it.  Seen on `@modelcontextprotocol/client@2.0.0-beta.4`. Happy to contribute a fix — we currently work around this with a dispatching validator that routes on 
  **Post-Mortem & Fix Analysis**:
  > I’d like to take this on with a narrow bug fix and regression coverage. I’ll first reproduce the declared draft-07 path in both default validators, then keep the change limited to dialect selection/registration required for standards-compliant validation. Please assign it to me if that approach is welcome; I’ll wait for assignment before implementation.
  > I ran into this too and can reproduce it on `@modelcontextprotocol/client@2.0.0-beta.4`. Root cause is that both default validators hard-require the 2020-12 meta-schema and throw for any other declared `$schema`, whereas per spec 2020-12 is only the default *when `$schema` is absent* — an explicitly declared dialect (notably draft-07, which `zod-to-json-schema` stamps on every v1-server output schema) should be honored.  The fix I have in mind is to route by the declared dialect rather than reject it: keep 2020-12 as the default when `$schema` is absent, but when a schema declares a dialect the underlying validator supports (draft-07 in particular — Ajv's default build is draft-07, with 2020-12 via `ajv/dist/2020`), compile it against that dialect instead of throwing. That restores v2-client ↔ v1-server interop without loosening validation. I'd add tests covering an explicit draft-07 schema, an absent-`$schema` schema (still 2020-12), and a genuinely unsupported dialect (still rejected
  > Closing: fixed in #2534, released in `2.0.0`  Thanks for the detailed report and repro — this was exactly the v2-client ↔ v1-server interop gap described. It was fixed in #2534 (merged 2026-07-27, ahead of the stable `2.0.0` release later that day): both default validators (`AjvJsonSchemaValidator` and `CfWorkerJsonSchemaValidator`) now dispatch on the declared dialect instead of rejecting it — declared draft-07/draft-06 compiles with classic Ajv, declared 2019-09 with Ajv 2019, and 2020-12 stays the default when `$schema` is absent; only genuinely unknown dialects still produce the typed error. This is also noted in the migration guide ([docs/migration/upgrade-to-v2.md](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration/upgrade-to-v2.md)): "a declared draft-07/06 `$schema` dispatches automatically". If you still hit this on `@modelcontextprotocol/client@2.0.0` or later, please open a new issue.  _This comment and close were reviewed and approved by maintai

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

### Incident Patch 1: `b0225220` (2026-10-05)
**Commit Message**: fix(core): reject x-mcp-header on number-typed parameters (#2762)

Co-authored-by: Claude <[REDACTED_EMAIL]>
Co-authored-by: Felix Weinberger <[REDACTED_EMAIL]>

**File**: `.changeset/x-mcp-header-reject-number.md` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+---
+'@modelcontextprotocol/core-internal': patch
+'@modelcontextprotocol/client': patch
+'@modelcontextprotocol/server': patch
+---
+
+`x-mcp-header` on a `number`-typed tool parameter is now rejected, matching the 2026-07-28 spec ("Parameters with type `number` are not permitted"; clients MUST exclude such tools from `tools/list`). Previously `number` was accepted only to satisfy an older conformance fixture that has since been corrected. `integer`, `string` and `boolean` are unaffected.
```

**File**: `packages/core-internal/src/shared/mcpParamHeaders.ts` (modified, +6/-9)
```diff
@@ -58,16 +58,13 @@ export type XMcpHeaderScanResult = { valid: true; declarations: readonly XMcpHea
 const RFC9110_TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
 
 /**
- * JSON Schema `type` values the spec admits on an `x-mcp-header` property.
- *
- * The spec text names `integer`, `string`, `boolean` and explicitly excludes
- * `number`. The published conformance referee at the pinned release ships its
- * `http-custom-headers` scenario with two `type: "number"` `x-mcp-header`
- * parameters and expects the client to mirror them, so `number` is accepted
- * here so that the conformance gate passes; the discrepancy is tracked
- * upstream. Everything else (`object`, `array`, `null`, absent) is rejected.
+ * JSON Schema `type` values the spec admits on an `x-mcp-header` property:
+ * `integer`, `string` and `boolean`. `number` is explicitly not permitted
+ * (2026-07-28 Streamable HTTP, "Schema Extension"), so a tool that annotates a
+ * `number`-typed property is rejected like any other invalid declaration.
+ * Everything else (`object`, `array`, `null`, absent) is rejected too.
  */
-const PERMITTED_X_MCP_HEADER_TYPES: ReadonlySet<string> = new Set(['string', 'integer', 'boolean', 'number']);
+const PERMITTED_X_MCP_HEADER_TYPES: ReadonlySet<string> = new Set(['string', 'integer', 'boolean']);
 
 /**
  * Scan a tool's JSON-serialized `inputSchema` for `x-mcp-header` declarations
```

**File**: `packages/core-internal/test/shared/mcpParamHeaders.test.ts` (modified, +4/-0)
```diff
@@ -144,6 +144,10 @@ describe('scanXMcpHeaderDeclarations — constraint table', () => {
         expect(invalid({ type: 'object', properties: { a: { type: 'array', [X_MCP_HEADER_KEY]: 'Items' } } })).toMatch(/primitive/);
     });
 
+    test('number-typed property is rejected (only integer, string, boolean are permitted)', () => {
+        expect(invalid({ type: 'object', properties: { a: { type: 'number', [X_MCP_HEADER_KEY]: 'Score' } } })).toMatch(/primitive/);
+    });
+
     test('null-typed property is rejected', () => {
         expect(invalid({ type: 'object', properties: { a: { type: 'null', [X_MCP_HEADER_KEY]: 'Nil' } } })).toMatch(/primitive/);
     });
```

---

### Incident Patch 2: `5a186739` (2026-10-05)
**Commit Message**: feat(server-legacy): add expectedResource to requireBearerAuth (#2952)

Co-authored-by: Felix Weinberger <[REDACTED_EMAIL]>

**File**: `.changeset/server-legacy-expected-resource.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@modelcontextprotocol/server-legacy': patch
+---
+
+`requireBearerAuth` in `@modelcontextprotocol/server-legacy` takes the optional `expectedResource` that `@modelcontextprotocol/server` 2.3.0 and `@modelcontextprotocol/sdk` 1.32.0 added: the resource the token must be issued for (its audience), usually the server's URL. When it is set, a token is accepted only if the verifier reports that value in `AuthInfo.resource`; the two are compared as strings, ignoring a fragment and one trailing slash. A token reported for another value, or for none, is answered `401 invalid_token` with the usual `WWW-Authenticate` challenge. When it is not set, nothing changes. The package stays frozen otherwise; this option is added so that its `requireBearerAuth` matches the 1.x middleware it is a copy of.
```

**File**: `packages/server-legacy/src/auth/middleware/bearerAuth.ts` (modified, +30/-1)
```diff
@@ -19,8 +19,28 @@ export type BearerAuthMiddlewareOptions = {
      * Optional resource metadata URL to include in WWW-Authenticate header.
      */
     resourceMetadataUrl?: string;
+
+    /**
+     * Optional resource the token must be issued for (its audience), usually the server's URL.
+     * When set, the verifier has to report this value in `AuthInfo.resource` (a fragment and one trailing slash
+     * are ignored); any other token is refused with `401 invalid_token`.
+     */
+    expectedResource?: URL;
 };
 
+// The serialized value without its fragment and without one trailing slash.
+function comparableResource(value: URL): string {
+    const text = String(value);
+    const hash = text.indexOf('#');
+    return (hash === -1 ? text : text.slice(0, hash)).replace(/\/$/, '');
+}
+
+// A reported resource matches when it serializes to the same string as the expected one, fragment and one trailing slash aside.
+function sameResource(reported: URL | undefined, expected: URL): boolean {
+    if (!reported) return false;
+    return comparableResource(reported) === comparableResource(expected);
+}
+
 declare module 'express-serve-static-core' {
     interface Request {
         /**
@@ -38,7 +58,12 @@ declare module 'express-serve-static-core' {
  * If resourceMetadataUrl is provided, it will be included in the WWW-Authenticate header
  * for 401 responses as per the OAuth 2.0 Protected Resource Metadata spec.
  */
-export function requireBearerAuth({ verifier, requiredScopes = [], resourceMetadataUrl }: BearerAuthMiddlewareOptions): RequestHandler {
+export function requireBearerAuth({
+    verifier,
+    requiredScopes = [],
+    resourceMetadataUrl,
+    expectedResource
+}: BearerAuthMiddlewareOptions): RequestHandler {
     const buildWwwAuthHeader = (errorCode: string, message: string): string => {
         let header = `Bearer error="${errorCode}", error_description="${message}"`;
         if (requiredScopes.length > 0) {
@@ -64,6 +89,10 @@ export function requireBearerAuth({ verifier, requiredScopes = [], resourceMetad
 
             const authInfo = await verifier.verifyAccessToken(token);
 
+            if (expectedResource !== undefined && !sameResource(authInfo.resource, expectedResource)) {
+                throw new InvalidTokenError('Token was not issued for this resource');
+            }
+
             if (requiredScopes.length > 0) {
                 const hasAllScopes = requiredScopes.every(scope => authInfo.scopes.includes(scope));
 
```

**File**: `packages/server-legacy/test/auth/middleware/bearerAuth.test.ts` (modified, +78/-0)
```diff
@@ -498,4 +498,82 @@ describe('requireBearerAuth middleware', () => {
             expect(nextFunction).not.toHaveBeenCalled();
         });
     });
+
+    describe('with expectedResource', () => {
+        const expectedResource = new URL('https://api.example.com/mcp');
+        const notIssuedForThisResource = { error: 'invalid_token', error_description: 'Token was not issued for this resource' };
+
+        async function handle(reported: string | undefined, options: { expectedResource?: URL; requiredScopes?: string[] } = {}) {
+            const authInfo: AuthInfo = {
+                token: 'valid-token',
+                clientId: 'client-123',
+                scopes: ['read'],
+                expiresAt: Date.now() / 1000 + 3600
+            };
+            if (reported !== undefined) authInfo.resource = new URL(reported);
+            mockVerifyAccessToken.mockResolvedValue(authInfo);
+            const req = { headers: { authorization: 'Bearer valid-token' } } as Request;
+            const res = createExpressResponseMock();
+            const next = vi.fn();
+            await requireBearerAuth({ verifier: mockVerifier, ...options })(req, res, next);
+            return { req, res, next, authInfo };
+        }
+
+        function expectAccepted({ req, res, next, authInfo }: Awaited<ReturnType<typeof handle>>) {
+            expect(req.auth).toEqual(authInfo);
+            expect(next).toHaveBeenCalled();
+            expect(res.status).not.toHaveBeenCalled();
+        }
+
+        function expectUnauthorized({ req, res, next }: Awaited<ReturnType<typeof handle>>) {
+            expect(res.status).toHaveBeenCalledWith(401);
+            expect(res.set).toHaveBeenCalledWith(
+                'WWW-Authenticate',
+                expect.stringMatching(/^Bearer error="invalid_token", error_description="Token was not issued for this resource"/)
+            );
+            expect(res.json).toHaveBeenCalledWith(notIssuedForThisResource);
+            expect(req.auth).toBeUndefined();
+            expect(next).not.toHaveBeenCalled();
+        }
+
+        it('should compare AuthInfo.resource only when expectedResource is set', async () => {
+            expectAccepted(await handle('https://other.example.com/mcp'));
+            expectUnauthorized(await handle('https://other.example.com/mcp', { expectedResource }));
+        });
+
+        it('should reject a token without a reported resource only when expectedResource is set', async () => {
+            expectAccepted(await handle(undefined));
+            expectUnauthorized(await handle(undefined, { expectedResource }));
+        });
+
+        it('should accept a token reported for expectedResource, one trailing slash aside on either value', async () => {
+            expectAccepted(await handle('https://api.example.com/mcp', { expectedResource }));
+            expectAccepted(await handle('https://api.example.com/mcp/', { expectedResource }));
+            expectAccepted(await handle('https://api.example.com/mcp', { expectedResource: new URL('https://api.example.com/mcp/') }));
+            expectAccepted(await handle('HTTPS://API.example.com:443/mcp', { expectedResource }));
+            expectUnauthorized(await handle('https://api.example.com/mcp//', { expectedResource }));
+        });
+
+        it('should ignore a fragment on either value', async () => {
+            expectAccepted(await handle('https://api.example.com/mcp#section', { expectedResource }));
+            expectAccepted(await handle('https://api.example.com/mcp', { expectedResource: new URL(`${expectedResource}#section`) }));
+            expectAccepted(await handle('https://api.example.com/mcp/#section', { expectedResource }));
+            expectUnauthorized(await handle('https://api.example.com/other#section', { expectedResource }));
+        });
+
+        it.each([
+            'https://other.example.com/mcp',
+            'http://api.example.com/mcp',
+            'https://api.example.com:8443/mcp',
+            'https://api.example.com/',
+            'https://api.example.com/mcp/tools',
+            'https://api.example.com/mcp?tenant=a'
+        ])('should return 401 for a token reported for %s', async reported => {
+            expectUnauthorized(await handle(reported, { expectedResource }));
+        });
+
+        it('should return 401 for a token reported for another resource before checking scopes', async () => {
+            expectUnauthorized(await handle('https://other.example.com/mcp', { expectedResource, requiredScopes: ['write'] }));
+        });
+    });
 });
```

---

### Incident Patch 3: `2d731fae` (2026-10-02)
**Commit Message**: fix(client): refresh again when an SSE retry failed for a reason other than 401 (#2934)

Co-authored-by: Felix Weinberger <[REDACTED_EMAIL]>

**File**: `packages/client/src/client/auth.ts` (modified, +2/-1)
```diff
@@ -87,7 +87,8 @@ export interface AuthProvider {
 
     /**
      * Called when the server responds with 401. If provided, the transport will
-     * await this, then retry the request once. If the retry also gets 401, or if
+     * await this, then retry the request once. If the retry also gets 401, the
+     * transport throws `SdkHttpError` (`SdkErrorCode.ClientHttpAuthentication`). If
      * this method is not provided, the transport throws {@linkcode UnauthorizedError}.
      *
      * Implementations should refresh tokens, re-authenticate, etc. — whatever is
```

**File**: `packages/client/src/client/sse.ts` (modified, +5/-3)
```diff
@@ -76,8 +76,8 @@ export type SSEClientTransportOptions = {
      * {@linkcode AuthProvider.token | token()} is called before every request to obtain the
      * bearer token. When the server responds with 401, {@linkcode AuthProvider.onUnauthorized | onUnauthorized()}
      * is called (if provided) to refresh credentials, then the request is retried once. If
-     * the retry also gets 401, or `onUnauthorized` is not provided, {@linkcode UnauthorizedError}
-     * is thrown.
+     * the retry also gets 401, `SdkHttpError` (`SdkErrorCode.ClientHttpAuthentication`) is thrown.
+     * If `onUnauthorized` is not provided, {@linkcode UnauthorizedError} is thrown.
      *
      * For simple bearer tokens: `{ token: async () => myApiKey }`.
      *
@@ -203,7 +203,7 @@ export class SSEClientTransport implements Transport {
     }
 
     private _last401Response?: Response;
-    // True between a 401-triggered reconnect and the next successful open.
+    // True from a 401-triggered refresh until the retry opens or fails.
     private _connectAuthRetried = false;
 
     /** `baseFetch` with redirects handled as `redirectPolicy` says. */
@@ -318,6 +318,8 @@ export class SSEClientTransport implements Transport {
                     return;
                 }
 
+                // A retry that failed for another reason is over: a later 401 may refresh again.
+                this._connectAuthRetried = false;
                 const error = new SseError(event.code, redirect ?? event.message, event);
                 reject(error);
                 this.onerror?.(error);
```

**File**: `packages/client/src/client/streamableHttp.ts` (modified, +2/-2)
```diff
@@ -161,8 +161,8 @@ export type StreamableHTTPClientTransportOptions = {
      * {@linkcode AuthProvider.token | token()} is called before every request to obtain the
      * bearer token. When the server responds with 401, {@linkcode AuthProvider.onUnauthorized | onUnauthorized()}
      * is called (if provided) to refresh credentials, then the request is retried once. If
-     * the retry also gets 401, or `onUnauthorized` is not provided, {@linkcode UnauthorizedError}
-     * is thrown.
+     * the retry also gets 401, `SdkHttpError` (`SdkErrorCode.ClientHttpAuthentication`) is thrown.
+     * If `onUnauthorized` is not provided, {@linkcode UnauthorizedError} is thrown.
      *
      * For simple bearer tokens: `{ token: async () => myApiKey }`.
      *
```

**File**: `packages/client/test/client/sse.test.ts` (modified, +58/-0)
```diff
@@ -1861,6 +1861,64 @@ describe('SSEClientTransport', () => {
             expect(authProvider.onUnauthorized).toHaveBeenCalledTimes(2);
         });
 
+        it('SSE reconnect: a retry that fails at the network level does not use up the refresh — a later 401 refreshes again', async () => {
+            await resourceServer.close();
+
+            let getAttempt = 0;
+            resourceServer = createServer((req, res) => {
+                if (req.method !== 'GET') {
+                    res.writeHead(404).end();
+                    return;
+                }
+                getAttempt++;
+                // 1: opens then drops, 2: 401, 3: connection reset right after the refresh, 4: 401 again, 5: opens and stays.
+                if (getAttempt === 2 || getAttempt === 4) {
+                    res.writeHead(401).end();
+                    return;
+                }
+                if (getAttempt === 3) {
+                    req.socket.destroy();
+                    return;
+                }
+                res.writeHead(200, {
+                    'Content-Type': 'text/event-stream',
+                    'Cache-Control': 'no-cache, no-transform',
+                    Connection: 'keep-alive'
+                });
+                res.write('retry: 10\n');
+                res.write('event: endpoint\n');
+                res.write(`data: ${resourceBaseUrl.href}post\n\n`);
+                if (getAttempt === 1) {
+                    res.end();
+                }
+            });
+            resourceBaseUrl = await listenOnRandomPort(resourceServer);
+
+            const authProvider: AuthProvider = {
+                token: vi.fn(async () => 'token'),
+                onUnauthorized: vi.fn(async () => {})
+            };
+            transport = new SSEClientTransport(resourceBaseUrl, { authProvider });
+            const onerror = vi.fn();
+            transport.onerror = onerror;
+
+            // The EventSource created after a refresh waits its default 3 s before it reconnects: skip that wait.
+            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
+            try {
+                await transport.start();
+                // Two errors so far: the dropped stream (attempt 1) and the reset (attempt 3).
+                await vi.waitFor(() => expect(onerror).toHaveBeenCalledTimes(2));
+                expect(authProvider.onUnauthorized).toHaveBeenCalledTimes(1);
+
+                await vi.advanceTimersByTimeAsync(3000);
+                await vi.waitFor(() => expect(getAttempt).toBe(5));
+                expect(authProvider.onUnauthorized).toHaveBeenCalledTimes(2);
+                expect(onerror).toHaveBeenCalledTimes(2);
+            } finally {
+                vi.useRealTimers();
+            }
+        });
+
         it('retry failure during SSE connect fires onerror exactly once', async () => {
             // Regression: when the retry EventSource rejected, its onerror fired inside, then
             // the outer .then() rejection handler fired onerror AGAIN for the same error.
```

---

### Incident Patch 4: `2fc49eaf` (2026-10-02)
**Commit Message**: fix(server): accept prompts/get requests that omit arguments (#2107)

Co-authored-by: Felix Weinberger <[REDACTED_EMAIL]>

**File**: `.changeset/fix-omitted-prompt-arguments.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@modelcontextprotocol/server': patch
+---
+
+`prompts/get` without `arguments` no longer fails with "Invalid arguments" when every argument of the prompt is optional. A missing `arguments` is now validated as `{}`, as it already is for `tools/call`, so a top-level `.optional()` or `.default(...)` on `argsSchema` no longer sees `undefined`.
```

**File**: `packages/server/src/server/mcp.ts` (modified, +1/-1)
```diff
@@ -1553,7 +1553,7 @@ function createPromptHandler(
         ) => GetPromptResult | InputRequiredResult | Promise<GetPromptResult | InputRequiredResult>;
 
         return async (args, ctx) => {
-            const parseResult = await validateStandardSchema(argsSchema, args);
+            const parseResult = await validateStandardSchema(argsSchema, args ?? {});
             if (!parseResult.success) {
                 throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Invalid arguments for prompt ${name}: ${parseResult.error}`);
             }
```

**File**: `test/integration/test/server/mcp.test.ts` (modified, +85/-0)
```diff
@@ -4174,6 +4174,91 @@ describe('Zod v4', () => {
             ]);
         });
 
+        test('should accept omitted prompt arguments when all schema fields are optional', async () => {
+            const mcpServer = new McpServer({
+                name: 'test server',
+                version: '1.0'
+            });
+
+            const client = new Client({
+                name: 'test client',
+                version: '1.0'
+            });
+
+            mcpServer.registerPrompt(
+                'echo',
+                {
+                    argsSchema: z.object({
+                        context: z.string().optional()
+                    })
+                },
+                ({ context }) => ({
+                    messages: [
+                        {
+                            role: 'user',
+                            content: {
+                                type: 'text',
+                                text: `context: ${context ?? 'none'}`
+                            }
+                        }
+                    ]
+                })
+            );
+
+            const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
+
+            await Promise.all([client.connect(clientTransport), mcpServer.server.connect(serverTransport)]);
+
+            const result = await client.request({
+                method: 'prompts/get',
+                params: {
+                    name: 'echo'
+                }
+            });
+
+            expect(result.messages).toEqual([
+                {
+                    role: 'user',
+                    content: {
+                        type: 'text',
+                        text: 'context: none'
+                    }
+                }
+            ]);
+        });
+
+        test('should reject omitted prompt arguments when a schema field is required', async () => {
+            const mcpServer = new McpServer({
+                name: 'test server',
+                version: '1.0'
+            });
+
+            const client = new Client({
+                name: 'test client',
+                version: '1.0'
+            });
+
+            mcpServer.registerPrompt('echo', { argsSchema: z.object({ context: z.string() }) }, ({ context }) => ({
+                messages: [{ role: 'user', content: { type: 'text', text: `context: ${context}` } }]
+            }));
+
+            const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
+
+            await Promise.all([client.connect(clientTransport), mcpServer.server.connect(serverTransport)]);
+
+            await expect(
+                client.request({
+                    method: 'prompts/get',
+                    params: {
+                        name: 'echo'
+                    }
+                })
+            ).rejects.toMatchObject({
+                code: ProtocolErrorCode.InvalidParams,
+                message: expect.stringContaining('context')
+            });
+        });
+
         /***
          * Test: Prompt Registration with _meta field
          */
```

---

### Incident Patch 5: `63c0fcab` (2026-10-02)
**Commit Message**: fix(client): update eventsource-parser for large SSE responses (#2846)

Co-authored-by: Felix Weinberger <[REDACTED_EMAIL]>

**File**: `.changeset/eventsource-parser-large-sse-memory.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@modelcontextprotocol/client': patch
+---
+
+Receiving a large message as a single SSE event over Streamable HTTP, such as a tool result of tens of megabytes, is now fast: a 50 MB result that took about 13 seconds arrives in under a second. The client now requires `eventsource-parser` 3.0.8 or later. `SSEClientTransport` reads through the `eventsource` package and gets the same speed-up once that also resolves `eventsource-parser` 3.0.8 or later.
```

**File**: `pnpm-lock.yaml` (modified, +4/-10)
```diff
@@ -89,8 +89,8 @@ catalogs:
       specifier: ^3.0.2
       version: 3.0.7
     eventsource-parser:
-      specifier: ^3.0.0
-      version: 3.0.6
+      specifier: ^3.0.8
+      version: 3.0.8
     jose:
       specifier: ^6.1.3
       version: 6.2.2
@@ -1304,7 +1304,7 @@ importers:
         version: 3.0.7
       eventsource-parser:
         specifier: catalog:runtimeClientOnly
-        version: 3.0.6
+        version: 3.0.8
       jose:
         specifier: catalog:runtimeClientOnly
         version: 6.2.2
@@ -4995,10 +4995,6 @@ packages:
     resolution: {integrity: sha512-aIL5Fx7mawVa300al2BnEE4iNvo1qETxLrPI/o05L7z6go7fCw1J6EQmbK4FmJ2AS7kgVF/KEZWufBfdClMcPg==}
     engines: {node: '>= 0.6'}
 
-  eventsource-parser@3.0.6:
-    resolution: {integrity: sha512-Vo1ab+QXPzZ4tCa8SwIHJFaSzy4R6SHf7BY79rFBDf0idraZWAkYrDjDj8uWaSm3S2TK+hJ7/t1CEmZ7jXw+pg==}
-    engines: {node: '>=18.0.0'}
-
   eventsource-parser@3.0.8:
     resolution: {integrity: sha512-70QWGkr4snxr0OXLRWsFLeRBIRPuQOvt4s8QYjmUlmlkyTZkRqS7EDVRZtzU3TiyDbXSzaOeF0XUKy8PchzukQ==}
     engines: {node: '>=18.0.0'}
@@ -9663,13 +9659,11 @@ snapshots:
 
   etag@1.8.1: {}
 
-  eventsource-parser@3.0.6: {}
-
   eventsource-parser@3.0.8: {}
 
   eventsource@3.0.7:
     dependencies:
-      eventsource-parser: 3.0.6
+      eventsource-parser: 3.0.8
 
   expand-template@2.0.3: {}
 
```

**File**: `pnpm-workspace.yaml` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ catalogs:
     runtimeClientOnly:
         cross-spawn: ^7.0.5
         eventsource: ^3.0.2
-        eventsource-parser: ^3.0.0
+        eventsource-parser: ^3.0.8
         jose: ^6.1.3
     runtimeServerOnly:
         '@hono/node-server': ^1.19.9
```

---

### Incident Patch 6: `84804c22` (2026-10-02)
**Commit Message**: fix(server): refuse a second connect and stateless transport reuse (#2918)

Co-authored-by: Felix Weinberger <[REDACTED_EMAIL]>

**File**: `.changeset/one-instance-per-request.md` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+---
+'@modelcontextprotocol/server': minor
+'@modelcontextprotocol/node': patch
+'@modelcontextprotocol/express': patch
+'@modelcontextprotocol/fastify': patch
+'@modelcontextprotocol/hono': patch
+---
+
+A `Server` or `McpServer` now serves one connection at a time, and a Streamable HTTP server transport without sessions (`sessionIdGenerator: undefined`) serves one request. An app that uses one server object, or one stateless transport, for every HTTP request fails on the second request after this upgrade. Build the server and the transport per request instead.
+
+What keeps working without a change:
+
+- `createMcpHandler(buildServer)` and `serveStdio(buildServer)`, where `buildServer` returns a new server on every call.
+- A handler that builds a new server and a new stateless transport for each request.
+- One server and one transport per session (a transport with a `sessionIdGenerator`).
+- Connecting a server again after `close()`.
+- `Client`.
+
+What fails now, how it shows, and what to change:
+
+- One server object with a new stateless transport per request (`const server = new McpServer(...)` outside the handler, `await server.connect(transport)` inside it): the second HTTP request the process receives fails, and so does every later one. `connect()` rejects with an `SdkError` of code `ALREADY_CONNECTED`. If the handler closes the transport when the response ends, requests that arrive one after the other still work and a request that overlaps another one fails. Change: move `new McpServer(...)` and its registrations into the handler.
+- One stateless transport for every request (a transport built once with `sessionIdGenerator: undefined`): the second HTTP request fails. `WebStandardStreamableHTTPServerTransport.handleRequest()` rejects with `Stateless transport cannot be reused across requests. Create a new transport per request.`, and `NodeStreamableHTTPServerTransport.handleRequest()` answers `500`. Change: build the server and the transport inside the handler and connect them there.
+- `createMcpHandler(() => server)` with a server built once: a request that arrives after the previous response has been read to its end still works. A request that arrives while another one is being served is answered `500` with the JSON-RPC error `-32603` (`Internal server error`); the reason is reported only through the `onerror` option. Change: pass a function that builds the server, as in `createMcpHandler(buildServer)`.
+- One server object for every session: the `initialize` request of the second session fails with `ALREADY_CONNECTED`. Change: build a server per session.
+
+What the caller sees when `connect()` or `handleRequest()` rejects depends on the host. Express 5, Fastify and Hono answer `500`. A plain `node:http` listener without its own error handling gets an unhandled rejection, which ends the process.
+
+The README examples of `@modelcontextprotocol/express`, `@modelcontextprotocol/fastify`, `@modelcontextprotocol/hono` and `@modelcontextprotocol/node`, and the handler examples in the JSDoc of `WebStandardStreamableHTTPServerTransport` and `NodeStreamableHTTPServerTransport`, now build a server and a transport per request.
```

**File**: `docs/advanced/low-level-server.md` (modified, +3/-2)
```diff
@@ -113,8 +113,9 @@ Keeping the schema you advertise in `tools/list` identical to the one you valida
 `serveStdio` — from `@modelcontextprotocol/server/stdio` — and `createMcpHandler` each take an `McpServerFactory`, and the factory returns either an `McpServer` or a `Server`.
 
 ```ts source="../../examples/guides/advanced/low-level-server.examples.ts#lowLevel_serve"
-serveStdio(() => server);
-createMcpHandler(() => server);
+// `buildServer` wraps the construction above: the factory runs per connection (stdio) or per request (HTTP).
+serveStdio(buildServer);
+createMcpHandler(buildServer);
 ```
 
 Every serving recipe — [stdio](../serving/stdio.md), [HTTP](../serving/http.md) — applies to this server unchanged.
```

**File**: `examples/guides/advanced/low-level-server.examples.ts` (modified, +5/-2)
```diff
@@ -130,10 +130,13 @@ await server.close();
 // take over this process's stdin/stdout, so the harness never calls this.
 // ---------------------------------------------------------------------------
 
+declare function buildServer(): Server;
+
 function lowLevel_serve() {
     //#region lowLevel_serve
-    serveStdio(() => server);
-    createMcpHandler(() => server);
+    // `buildServer` wraps the construction above: the factory runs per connection (stdio) or per request (HTTP).
+    serveStdio(buildServer);
+    createMcpHandler(buildServer);
     //#endregion lowLevel_serve
 }
 void lowLevel_serve;
```

**File**: `packages/middleware/express/README.md` (modified, +2/-3)
```diff
@@ -48,11 +48,10 @@ import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
 import { McpServer } from '@modelcontextprotocol/server';
 
 const app = createMcpExpressApp();
-const server = new McpServer({ name: 'my-server', version: '1.0.0' });
 
 app.post('/mcp', async (req, res) => {
-    // Stateless example: create a transport per request.
-    // For stateful mode (sessions), keep a transport instance around and reuse it.
+    // Stateless example: create a server and a transport per request (with sessions: one pair per session).
+    const server = new McpServer({ name: 'my-server', version: '1.0.0' });
     const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
     await server.connect(transport);
     await transport.handleRequest(req, res, req.body);
```

**File**: `packages/middleware/fastify/README.md` (modified, +4/-4)
```diff
@@ -42,24 +42,24 @@ import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
 import { McpServer } from '@modelcontextprotocol/server';
 
 const app = createMcpFastifyApp();
-const mcpServer = new McpServer({ name: 'my-server', version: '1.0.0' });
 
 app.post('/mcp', async (request, reply) => {
-    // Stateless example: create a transport per request.
-    // For stateful mode (sessions), keep a transport instance around and reuse it.
+    // Stateless example: create a server and a transport per request (with sessions: one pair per session).
+    const mcpServer = new McpServer({ name: 'my-server', version: '1.0.0' });
     const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
     await mcpServer.connect(transport);
 
     // Clean up when the client closes the connection (e.g. during SSE streaming).
     reply.raw.on('close', () => {
         transport.close();
+        mcpServer.close();
     });
 
     await transport.handleRequest(request.raw, reply.raw, request.body);
 });
 ```
 
-If you create a new `McpServer` per request in stateless mode, also call `mcpServer.close()` in the `close` handler. To reject non-POST requests with 405 Method Not Allowed, add routes for GET and DELETE that send a JSON-RPC error response.
+To reject non-POST requests with 405 Method Not Allowed, add routes for GET and DELETE that send a JSON-RPC error response.
 
 ### Host header validation (DNS rebinding protection)
 
```

**File**: `packages/middleware/hono/README.md` (modified, +7/-5)
```diff
@@ -30,12 +30,14 @@ npm install @modelcontextprotocol/server @modelcontextprotocol/hono hono
 import { McpServer, WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server';
 import { createMcpHonoApp } from '@modelcontextprotocol/hono';
 
-const server = new McpServer({ name: 'my-server', version: '1.0.0' });
-const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
-await server.connect(transport);
-
 const app = createMcpHonoApp();
-app.all('/mcp', c => transport.handleRequest(c.req.raw, { parsedBody: c.get('parsedBody') }));
+app.all('/mcp', async c => {
+    // Stateless example: create a server and a transport per request.
+    const server = new McpServer({ name: 'my-server', version: '1.0.0' });
+    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
+    await server.connect(transport);
+    return transport.handleRequest(c.req.raw, { parsedBody: c.get('parsedBody') });
+});
 ```
 
 ### Host header validation (DNS rebinding protection)
```

**File**: `packages/middleware/node/README.md` (modified, +3/-3)
```diff
@@ -33,10 +33,11 @@ import { createMcpExpressApp } from '@modelcontextprotocol/express';
 import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
 import { McpServer } from '@modelcontextprotocol/server';
 
-const server = new McpServer({ name: 'my-server', version: '1.0.0' });
 const app = createMcpExpressApp();
 
 app.post('/mcp', async (req, res) => {
+    // Stateless example: create a server and a transport per request.
+    const server = new McpServer({ name: 'my-server', version: '1.0.0' });
     const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
     await server.connect(transport);
 
@@ -59,13 +60,12 @@ import { createServer } from 'node:http';
 import { localhostHostValidation, localhostOriginValidation, NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
 import { McpServer } from '@modelcontextprotocol/server';
 
-const server = new McpServer({ name: 'my-server', version: '1.0.0' });
-
 const validateHost = localhostHostValidation();
 const validateOrigin = localhostOriginValidation();
 
 createServer(async (req, res) => {
     if (!validateHost(req, res) || !validateOrigin(req, res)) return;
+    const server = new McpServer({ name: 'my-server', version: '1.0.0' });
     const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
     await server.connect(transport);
     await transport.handleRequest(req, res);
```

**File**: `packages/middleware/node/src/streamableHttp.examples.ts` (modified, +7/-3)
```diff
@@ -47,10 +47,14 @@ declare const app: { post(path: string, handler: (req: IncomingMessage & { body?
 /**
  * Example: Using with a pre-parsed request body (e.g. Express).
  */
-function NodeStreamableHTTPServerTransport_express(transport: NodeStreamableHTTPServerTransport) {
+function NodeStreamableHTTPServerTransport_express() {
     //#region NodeStreamableHTTPServerTransport_express
-    app.post('/mcp', (req, res) => {
-        transport.handleRequest(req, res, req.body);
+    app.post('/mcp', async (req, res) => {
+        // Stateless example: create a server and a transport per request.
+        const server = new McpServer({ name: 'my-server', version: '1.0.0' });
+        const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
+        await server.connect(transport);
+        await transport.handleRequest(req, res, req.body);
     });
     //#endregion NodeStreamableHTTPServerTransport_express
 }
```

---

### Incident Patch 7: `e16d2772` (2026-10-01)
**Commit Message**: docs: close idle sessions and cap the session map in the sessions guide and examples (#2913)

Co-authored-by: Felix Weinberger <[REDACTED_EMAIL]>

**File**: `docs/serving/sessions-state-scaling.md` (modified, +32/-7)
```diff
@@ -23,19 +23,36 @@ The transport answers `initialize` with the generated id in an `Mcp-Session-Id`
 One transport instance is one session, so a sessionful deployment keeps a map: build a transport when `initialize` arrives, store it in `onsessioninitialized`, and route every later request to the transport that owns its `Mcp-Session-Id`. This Express route handles all three verbs — `POST`, the `GET` notification stream, and `DELETE` ([Serve with Express](./express.md) covers the app itself).
 
 ```ts source="../../examples/guides/serving/sessions-state-scaling.examples.ts#sessions_routing"
-const sessions = new Map<string, NodeStreamableHTTPServerTransport>();
+const IDLE_MS = 30 * 60_000;
+const MAX_SESSIONS = 1000;
+
+type Session = { transport: NodeStreamableHTTPServerTransport; open: number; lastActive: number };
+const sessions = new Map<string, Session>();
 
 const route = async (req: Request, res: Response) => {
     const sessionId = req.headers['mcp-session-id'] as string | undefined;
-    if (sessionId && sessions.has(sessionId)) {
-        await sessions.get(sessionId)!.handleRequest(req, res, req.body);
+    const session = sessionId ? sessions.get(sessionId) : undefined;
+    if (session) {
+        // Count open responses so a long-running request or a listening stream is not treated as idle.
+        if (res.socket && !res.destroyed) {
+            session.open++;
+            res.on('close', () => {
+                session.open--;
+                session.lastActive = Date.now();
+            });
+        }
+        await session.transport.handleRequest(req, res, req.body);
         return;
     }
     if (!sessionId && isInitializeRequest(req.body)) {
+        if (sessions.size >= MAX_SESSIONS) {
+            res.status(503).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Too many open sessions' }, id: null });
+            return;
+        }
         const transport = new NodeStreamableHTTPServerTransport({
             sessionIdGenerator: () => randomUUID(),
             onsessioninitialized: id => {
-                sessions.set(id, transport);
+                sessions.set(id, { transport, open: 0, lastActive: Date.now() });
             }
         });
         transport.onclose = () => {
@@ -57,12 +74,20 @@ const route = async (req: Request, res: Response) => {
 app.post('/mcp', route);
 app.get('/mcp', route);
 app.delete('/mcp', route);
+
+// Close sessions with nothing open and no activity for IDLE_MS.
+setInterval(() => {
+    const cutoff = Date.now() - IDLE_MS;
+    for (const { transport, open, lastActive } of sessions.values()) {
+        if (open === 0 && lastActive < cutoff) transport.close().catch(console.error);
+    }
+}, 60_000).unref();
 ```
 
-The map cleans itself up: `transport.onclose` fires when the session ends, whether the client sent `DELETE` or you called `transport.close()`. A request with an unknown `Mcp-Session-Id` gets the `404` above, which tells the client to start a new session; a request with no session header at all gets the `400`, which tells it to re-send the id it already has instead of re-initializing.
+`transport.onclose` removes an entry when the client sends `DELETE`, you call `transport.close()`, or the timer closes a session idle for `IDLE_MS`. At `MAX_SESSIONS`, `initialize` gets a `503`. The limit is shared by all clients and an unused session holds its place for `IDLE_MS`, so pick a `MAX_SESSIONS` that fits in memory, and on a server anyone can reach put authentication or a per-client limit in front of `initialize`. An expired id gets the `404` above, which tells the client to start a new session; a request with no session header at all gets the `400`, which tells it to re-send the id it already has instead of re-initializing.
 
 ::: tip
-On shutdown, close every stored transport — `for (const [, transport] of sessions) await transport.close()` — before exiting; `close()` ends the session's SSE streams and rejects its pending requests.
+On shutdown, close every stored transport — `for (const { transport } of sessions.values()) await transport.close()` — before exiting; `close()` ends the session's SSE streams and rejects its pending requests.
 :::
 
 ## Resume a dropped stream
@@ -102,6 +127,6 @@ Now `handler.notify.resourceUpdated(uri)` on any node publishes through the shar
 
 - `createMcpHandler` builds a fresh server per request and holds nothing between requests, so stateless nodes scale behind any load balancer with no session affinity.
 - Sessions belong to the hand-wired 2025-era transport: `sessionIdGenerator` turns them on, and responses carry `Mcp-Session-Id`.
-- A sessionful deployment keeps one transport per session and routes every request to it by that header; unknown ids get a `404`.
+- A sessionful deployment keeps one transport per session and routes every request to it by that header; it closes idle sessions, caps how many are open, and answers unknown ids with a `404`.
 - An `eventStore` makes a dropped SSE strea
```

**File**: `examples/elicitation/server.ts` (modified, +31/-4)
```diff
@@ -252,16 +252,35 @@ if (transport === 'stdio') {
 
     // --- legacy (2025): sessionful Streamable HTTP — push-style elicitation
     // requires the session (client capabilities + bidirectional SSE stream) ---
-    const sessions = new Map<string, NodeStreamableHTTPServerTransport>();
+    const IDLE_MS = 30 * 60_000;
+    const MAX_SESSIONS = 1000;
+
+    type Session = { transport: NodeStreamableHTTPServerTransport; open: number; lastActive: number };
+    const sessions = new Map<string, Session>();
     const handleLegacy = async (req: IncomingMessage, res: ServerResponse, body: unknown): Promise<void> => {
         const sid = req.headers['mcp-session-id'] as string | undefined;
-        if (sid && sessions.has(sid)) {
-            await sessions.get(sid)!.handleRequest(req, res, body);
+        const session = sid ? sessions.get(sid) : undefined;
+        if (session) {
+            // Count open responses so a long-running request or a listening stream is not treated as idle.
+            if (res.socket && !res.destroyed) {
+                session.open++;
+                res.on('close', () => {
+                    session.open--;
+                    session.lastActive = Date.now();
+                });
+            }
+            await session.transport.handleRequest(req, res, body);
         } else if (!sid && isInitializeRequest(body)) {
+            if (sessions.size >= MAX_SESSIONS) {
+                res.writeHead(503, { 'content-type': 'application/json' }).end(
+                    JSON.stringify({ jsonrpc: '2.0', error: { code: -32_000, message: 'Too many open sessions' }, id: null })
+                );
+                return;
+            }
             const t = new NodeStreamableHTTPServerTransport({
                 sessionIdGenerator: () => randomUUID(),
                 onsessioninitialized: id => {
-                    sessions.set(id, t);
+                    sessions.set(id, { transport: t, open: 0, lastActive: Date.now() });
                 }
             });
             t.onclose = () => t.sessionId && sessions.delete(t.sessionId);
@@ -280,6 +299,14 @@ if (transport === 'stdio') {
         }
     };
 
+    // Close sessions with nothing open and no activity for IDLE_MS.
+    setInterval(() => {
+        const cutoff = Date.now() - IDLE_MS;
+        for (const session of sessions.values()) {
+            if (session.open === 0 && session.lastActive < cutoff) session.transport.close().catch(console.error);
+        }
+    }, 60_000).unref();
+
     // Host/Origin guards for the hand-wired `node:http` server — plain
     // `createServer` has no middleware chain, so compose the boolean-returning
     // guards from `@modelcontextprotocol/node` in front of both arms,
```

**File**: `examples/guides/serving/sessions-state-scaling.examples.ts` (modified, +29/-4)
```diff
@@ -35,19 +35,36 @@ import type { Express, Request, Response } from 'express';
  */
 function sessions_routing(app: Express, buildServer: () => McpServer) {
     //#region sessions_routing
-    const sessions = new Map<string, NodeStreamableHTTPServerTransport>();
+    const IDLE_MS = 30 * 60_000;
+    const MAX_SESSIONS = 1000;
+
+    type Session = { transport: NodeStreamableHTTPServerTransport; open: number; lastActive: number };
+    const sessions = new Map<string, Session>();
 
     const route = async (req: Request, res: Response) => {
         const sessionId = req.headers['mcp-session-id'] as string | undefined;
-        if (sessionId && sessions.has(sessionId)) {
-            await sessions.get(sessionId)!.handleRequest(req, res, req.body);
+        const session = sessionId ? sessions.get(sessionId) : undefined;
+        if (session) {
+            // Count open responses so a long-running request or a listening stream is not treated as idle.
+            if (res.socket && !res.destroyed) {
+                session.open++;
+                res.on('close', () => {
+                    session.open--;
+                    session.lastActive = Date.now();
+                });
+            }
+            await session.transport.handleRequest(req, res, req.body);
             return;
         }
         if (!sessionId && isInitializeRequest(req.body)) {
+            if (sessions.size >= MAX_SESSIONS) {
+                res.status(503).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Too many open sessions' }, id: null });
+                return;
+            }
             const transport = new NodeStreamableHTTPServerTransport({
                 sessionIdGenerator: () => randomUUID(),
                 onsessioninitialized: id => {
-                    sessions.set(id, transport);
+                    sessions.set(id, { transport, open: 0, lastActive: Date.now() });
                 }
             });
             transport.onclose = () => {
@@ -69,6 +86,14 @@ function sessions_routing(app: Express, buildServer: () => McpServer) {
     app.post('/mcp', route);
     app.get('/mcp', route);
     app.delete('/mcp', route);
+
+    // Close sessions with nothing open and no activity for IDLE_MS.
+    setInterval(() => {
+        const cutoff = Date.now() - IDLE_MS;
+        for (const { transport, open, lastActive } of sessions.values()) {
+            if (open === 0 && lastActive < cutoff) transport.close().catch(console.error);
+        }
+    }, 60_000).unref();
     //#endregion sessions_routing
 }
 void sessions_routing;
```

**File**: `examples/legacy-routing/server.ts` (modified, +29/-4)
```diff
@@ -31,16 +31,33 @@ const buildServer = (era: 'legacy' | 'modern') => {
 };
 
 // --- the existing sessionful 2025 deployment, unchanged ---
-const sessions = new Map<string, NodeStreamableHTTPServerTransport>();
+const IDLE_MS = 30 * 60_000;
+const MAX_SESSIONS = 1000;
+
+type Session = { transport: NodeStreamableHTTPServerTransport; open: number; lastActive: number };
+const sessions = new Map<string, Session>();
 const handleLegacy = async (req: Request, res: Response) => {
     const sid = req.headers['mcp-session-id'] as string | undefined;
-    if (sid && sessions.has(sid)) {
-        await sessions.get(sid)!.handleRequest(req, res, req.body);
+    const session = sid ? sessions.get(sid) : undefined;
+    if (session) {
+        // Count open responses so a long-running request or a listening stream is not treated as idle.
+        if (res.socket && !res.destroyed) {
+            session.open++;
+            res.on('close', () => {
+                session.open--;
+                session.lastActive = Date.now();
+            });
+        }
+        await session.transport.handleRequest(req, res, req.body);
     } else if (!sid && isInitializeRequest(req.body)) {
+        if (sessions.size >= MAX_SESSIONS) {
+            res.status(503).json({ jsonrpc: '2.0', error: { code: -32_000, message: 'Too many open sessions' }, id: null });
+            return;
+        }
         const transport = new NodeStreamableHTTPServerTransport({
             sessionIdGenerator: () => randomUUID(),
             onsessioninitialized: id => {
-                sessions.set(id, transport);
+                sessions.set(id, { transport, open: 0, lastActive: Date.now() });
             }
         });
         transport.onclose = () => transport.sessionId && sessions.delete(transport.sessionId);
@@ -54,6 +71,14 @@ const handleLegacy = async (req: Request, res: Response) => {
     }
 };
 
+// Close sessions with nothing open and no activity for IDLE_MS.
+setInterval(() => {
+    const cutoff = Date.now() - IDLE_MS;
+    for (const { transport, open, lastActive } of sessions.values()) {
+        if (open === 0 && lastActive < cutoff) transport.close().catch(console.error);
+    }
+}, 60_000).unref();
+
 // --- the strict modern entry alongside it ---
 const modern = createMcpHandler((ctx: McpRequestContext) => buildServer(ctx.era), { legacy: 'reject' });
 const modernNode = toNodeHandler(modern);
```

**File**: `examples/repl/server.ts` (modified, +30/-5)
```diff
@@ -255,20 +255,37 @@ const { port } = parseExampleArgs();
 // Sessionful 2025-era hosting with an in-memory event store so the REPL
 // client's resumability commands work (reconnect with `Last-Event-ID` replays
 // missed `notifications/message` events).
-const sessions = new Map<string, NodeStreamableHTTPServerTransport>();
+const IDLE_MS = 30 * 60_000;
+const MAX_SESSIONS = 1000;
+
+type Session = { transport: NodeStreamableHTTPServerTransport; open: number; lastActive: number };
+const sessions = new Map<string, Session>();
 const eventStore = new InMemoryEventStore();
 
 const app = createMcpExpressApp();
 app.all('/mcp', async (req: Request, res: Response) => {
     const sid = req.headers['mcp-session-id'] as string | undefined;
-    if (sid && sessions.has(sid)) {
-        await sessions.get(sid)!.handleRequest(req, res, req.body);
+    const session = sid ? sessions.get(sid) : undefined;
+    if (session) {
+        // Count open responses so a long-running request or a listening stream is not treated as idle.
+        if (res.socket && !res.destroyed) {
+            session.open++;
+            res.on('close', () => {
+                session.open--;
+                session.lastActive = Date.now();
+            });
+        }
+        await session.transport.handleRequest(req, res, req.body);
     } else if (!sid && isInitializeRequest(req.body)) {
+        if (sessions.size >= MAX_SESSIONS) {
+            res.status(503).json({ jsonrpc: '2.0', error: { code: -32_000, message: 'Too many open sessions' }, id: null });
+            return;
+        }
         const transport = new NodeStreamableHTTPServerTransport({
             sessionIdGenerator: () => randomUUID(),
             eventStore, // resumability — events are persisted for replay on GET reconnect
             onsessioninitialized: id => {
-                sessions.set(id, transport);
+                sessions.set(id, { transport, open: 0, lastActive: Date.now() });
             }
         });
         transport.onclose = () => transport.sessionId && sessions.delete(transport.sessionId);
@@ -281,9 +298,17 @@ app.all('/mcp', async (req: Request, res: Response) => {
     }
 });
 
+// Close sessions with nothing open and no activity for IDLE_MS.
+setInterval(() => {
+    const cutoff = Date.now() - IDLE_MS;
+    for (const { transport, open, lastActive } of sessions.values()) {
+        if (open === 0 && lastActive < cutoff) transport.close().catch(console.error);
+    }
+}, 60_000).unref();
+
 app.listen(port, () => console.error(`[server] REPL playground listening on http://127.0.0.1:${port}/mcp`));
 
 process.on('SIGINT', async () => {
-    for (const t of sessions.values()) await t.close();
+    for (const { transport } of sessions.values()) await transport.close();
     process.exit(0);
 });
```

**File**: `examples/sse-polling/server.ts` (modified, +29/-4)
```diff
@@ -93,23 +93,40 @@ app.use(cors());
 // Create event store for resumability
 const eventStore = new InMemoryEventStore();
 
+const IDLE_MS = 30 * 60_000;
+const MAX_SESSIONS = 1000;
+
+type Session = { transport: NodeStreamableHTTPServerTransport; open: number; lastActive: number };
 // Track transports by session ID for session reuse
-const transports = new Map<string, NodeStreamableHTTPServerTransport>();
+const transports = new Map<string, Session>();
 
 // Handle all MCP requests (standard sessionful routing: known sid → reuse;
 // no sid + initialize → new session; unknown sid → 404; otherwise → 400).
 app.all('/mcp', async (req: Request, res: Response) => {
     const sid = req.headers['mcp-session-id'] as string | undefined;
-    if (sid && transports.has(sid)) {
-        await transports.get(sid)!.handleRequest(req, res, req.body);
+    const session = sid ? transports.get(sid) : undefined;
+    if (session) {
+        // Count open responses so a long-running request or a listening stream is not treated as idle.
+        if (res.socket && !res.destroyed) {
+            session.open++;
+            res.on('close', () => {
+                session.open--;
+                session.lastActive = Date.now();
+            });
+        }
+        await session.transport.handleRequest(req, res, req.body);
     } else if (!sid && isInitializeRequest(req.body)) {
+        if (transports.size >= MAX_SESSIONS) {
+            res.status(503).json({ jsonrpc: '2.0', error: { code: -32_000, message: 'Too many open sessions' }, id: null });
+            return;
+        }
         const transport = new NodeStreamableHTTPServerTransport({
             sessionIdGenerator: () => randomUUID(),
             eventStore,
             retryInterval: 300, // Default retry interval for priming events
             onsessioninitialized: id => {
                 console.error(`[${id}] Session initialized`);
-                transports.set(id, transport);
+                transports.set(id, { transport, open: 0, lastActive: Date.now() });
             }
         });
         transport.onclose = () => transport.sessionId && transports.delete(transport.sessionId);
@@ -123,6 +140,14 @@ app.all('/mcp', async (req: Request, res: Response) => {
     }
 });
 
+// Close sessions with nothing open and no activity for IDLE_MS.
+setInterval(() => {
+    const cutoff = Date.now() - IDLE_MS;
+    for (const { transport, open, lastActive } of transports.values()) {
+        if (open === 0 && lastActive < cutoff) transport.close().catch(console.error);
+    }
+}, 60_000).unref();
+
 const { port } = parseExampleArgs();
 app.listen(port, () => {
     console.error(`[server] listening on http://127.0.0.1:${port}/mcp`);
```

**File**: `examples/standalone-get/server.ts` (modified, +36/-7)
```diff
@@ -55,18 +55,38 @@ function buildServer(): McpServer {
     return server;
 }
 
-const sessions = new Map<string, NodeStreamableHTTPServerTransport>();
+const IDLE_MS = 30 * 60_000;
+const MAX_SESSIONS = 1000;
+
+type Session = { transport: NodeStreamableHTTPServerTransport; open: number; lastActive: number };
+const sessions = new Map<string, Session>();
 const app = createMcpExpressApp();
 
+// Count open responses so a long-running request or a listening stream is not treated as idle.
+const trackResponse = (session: Session, res: Response) => {
+    if (!res.socket || res.destroyed) return;
+    session.open++;
+    res.on('close', () => {
+        session.open--;
+        session.lastActive = Date.now();
+    });
+};
+
 app.post('/mcp', async (req: Request, res: Response) => {
     const sid = req.headers['mcp-session-id'] as string | undefined;
-    if (sid && sessions.has(sid)) {
-        await sessions.get(sid)!.handleRequest(req, res, req.body);
+    const session = sid ? sessions.get(sid) : undefined;
+    if (session) {
+        trackResponse(session, res);
+        await session.transport.handleRequest(req, res, req.body);
     } else if (!sid && isInitializeRequest(req.body)) {
+        if (sessions.size >= MAX_SESSIONS) {
+            res.status(503).json({ jsonrpc: '2.0', error: { code: -32_000, message: 'Too many open sessions' }, id: null });
+            return;
+        }
         const transport = new NodeStreamableHTTPServerTransport({
             sessionIdGenerator: () => randomUUID(),
             onsessioninitialized: id => {
-                sessions.set(id, transport);
+                sessions.set(id, { transport, open: 0, lastActive: Date.now() });
             }
         });
         transport.onclose = () => transport.sessionId && sessions.delete(transport.sessionId);
@@ -83,16 +103,25 @@ app.post('/mcp', async (req: Request, res: Response) => {
 // session termination per the MCP spec) route to the session's transport.
 const sessionVerb = async (req: Request, res: Response) => {
     const sid = req.headers['mcp-session-id'] as string | undefined;
-    const t = sid ? sessions.get(sid) : undefined;
-    if (!t) {
+    const session = sid ? sessions.get(sid) : undefined;
+    if (!session) {
         res.status(sid ? 404 : 400).send(sid ? 'Session not found' : 'Missing session ID');
         return;
     }
-    await t.handleRequest(req, res);
+    trackResponse(session, res);
+    await session.transport.handleRequest(req, res);
 };
 app.get('/mcp', sessionVerb);
 app.delete('/mcp', sessionVerb);
 
+// Close sessions with nothing open and no activity for IDLE_MS.
+setInterval(() => {
+    const cutoff = Date.now() - IDLE_MS;
+    for (const { transport, open, lastActive } of sessions.values()) {
+        if (open === 0 && lastActive < cutoff) transport.close().catch(console.error);
+    }
+}, 60_000).unref();
+
 const { port } = parseExampleArgs();
 app.listen(port, () => {
     console.error(`[server] listening on http://127.0.0.1:${port}/mcp`);
```

---

### Incident Patch 8: `433eb413` (2026-09-30)
**Commit Message**: fix(client): follow redirects only within the origin of the request (#2901)

Co-authored-by: Felix Weinberger <[REDACTED_EMAIL]>

**File**: `.changeset/redirects-within-origin.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@modelcontextprotocol/client': minor
+---
+
+The HTTP client transports and the OAuth client helpers now follow a redirect only when it stays within the origin of the request (same scheme, host and port, or http to https on the same host with default ports) and keeps the method (a 307 or 308, or any redirect of a GET). Any other redirect is not followed. A transport then fails the request with an error that names the target; the session is kept and later messages still send. OAuth metadata discovery moves on to the next well-known URL, and any other OAuth request fails with an error that gives the status. Same-origin redirects that keep the method keep working on Node, up to five in a row, and no code changes are needed there. If your endpoint redirects to another origin, configure the transport with the URL it redirects to. A `requestInit.redirect` of `'error'` or `'manual'` is passed to fetch as it is for the requests a transport sends to the server (POST, GET and DELETE of the Streamable HTTP transport, POST of the SSE transport); for its OAuth requests, and for any other value, `requestInit.redirect` is not consulted by default. Browsers do not expose the target of a redirect to a page, so there a redirected request fails instead of being followed. Setting `redirectPolicy: 'follow'` on a transport leaves its redirects to the fetch implementation, as before this change.
```

**File**: `packages/client/src/client/auth.ts` (modified, +10/-8)
```diff
@@ -15,6 +15,7 @@ import type {
 import {
     brandedHasInstance,
     checkResourceAllowed,
+    fetchWithinOrigin,
     LATEST_PROTOCOL_VERSION,
     OAuthClientInformationFullSchema,
     OAuthError,
@@ -1672,8 +1673,9 @@ export async function discoverOAuthProtectedResourceMetadata(
  * error object alone, so the swallow-and-fallthrough heuristic is preserved there.
  */
 async function fetchWithCorsRetry(url: URL, headers?: Record<string, string>, fetchFn: FetchLike = fetch): Promise<Response | undefined> {
+    const withinOrigin = fetchWithinOrigin(fetchFn);
     try {
-        return await fetchFn(url, { headers });
+        return await withinOrigin(url, { headers });
     } catch (error) {
         if (!(error instanceof TypeError) || !CORS_IS_POSSIBLE) {
             throw error;
@@ -1682,7 +1684,7 @@ async function fetchWithCorsRetry(url: URL, headers?: Record<string, string>, fe
             // Could be a CORS preflight rejection caused by our custom header. Retry as a simple
             // request: if that succeeds, we've sidestepped the preflight.
             try {
-                return await fetchFn(url, {});
+                return await withinOrigin(url, {});
             } catch (retryError) {
                 if (!(retryError instanceof TypeError)) {
                     throw retryError;
@@ -1728,7 +1730,7 @@ async function tryMetadataDiscovery(url: URL, protocolVersion: string, fetchFn:
 function shouldAttemptFallback(response: Response | undefined, pathname: string): boolean {
     if (!response) return true; // CORS error — always try fallback
     if (pathname === '/') return false; // Already at root
-    return (response.status >= 400 && response.status < 500) || response.status === 502;
+    return (!response.ok && response.status < 500) || response.status === 502;
 }
 
 /**
@@ -1755,7 +1757,7 @@ async function discoverMetadataWithFallback(
 
     let response = await tryMetadataDiscovery(url, protocolVersion, fetchFn);
 
-    // If path-aware discovery fails (4xx or 502 Bad Gateway) and we're not already at root, try fallback to root discovery
+    // If path-aware discovery fails (4xx, 502 or a redirect not followed) and we're not already at root, try fallback to root discovery
     if (!opts?.metadataUrl && shouldAttemptFallback(response, issuer.pathname)) {
         const rootUrl = new URL(`/.well-known/${wellKnownType}`, issuer);
         response = await tryMetadataDiscovery(rootUrl, protocolVersion, fetchFn);
@@ -1933,8 +1935,8 @@ export async function discoverAuthorizationServerMetadata(
 
         if (!response.ok) {
             await response.text?.().catch(() => {});
-            if ((response.status >= 400 && response.status < 500) || response.status === 502) {
-                continue; // Try next URL for 4xx or 502 (Bad Gateway)
+            if (response.status < 500 || response.status === 502) {
+                continue; // Try next URL for 4xx, 502 (Bad Gateway) or a redirect that was not followed
             }
             throw new Error(
                 `HTTP ${response.status} trying to load ${type === 'oauth' ? 'OAuth' : 'OpenID provider'} metadata from ${endpointUrl}`
@@ -2224,7 +2226,7 @@ export async function executeTokenRequest(
             // presented, and the token request is presenting credentials to *obtain* one.
             requestHeaders.set('DPoP', await dpop.buildProof({ htm: 'POST', htu: tokenUrl }));
         }
-        return (fetchFn ?? fetch)(tokenUrl, {
+        return fetchWithinOrigin(fetchFn ?? fetch)(tokenUrl, {
             method: 'POST',
             headers: requestHeaders,
             body: tokenRequestParams
@@ -2547,7 +2549,7 @@ export async function registerClient(
         ...(scope === undefined ? {} : { scope })
     };
 
-    const response = await (fetchFn ?? fetch)(registrationUrl, {
+    const response = await fetchWithinOrigin(fetchFn ?? fetch)(registrationUrl, {
         method: 'POST',
         headers: {
             'Content-Type': 'application/json'
```

**File**: `packages/client/src/client/crossAppAccess.ts` (modified, +3/-2)
```diff
@@ -10,6 +10,7 @@
 
 import type { FetchLike } from '@modelcontextprotocol/core-internal';
 import {
+    fetchWithinOrigin,
     IdJagTokenExchangeResponseSchema,
     OAuthErrorResponseSchema,
     OAuthTokensSchema,
@@ -152,7 +153,7 @@ export async function requestJwtAuthorizationGrant(options: RequestJwtAuthGrantO
         params.set('scope', scope);
     }
 
-    const response = await fetchFn(tokenUrl, {
+    const response = await fetchWithinOrigin(fetchFn)(tokenUrl, {
         method: 'POST',
         headers: {
             'Content-Type': 'application/x-www-form-urlencoded'
@@ -281,7 +282,7 @@ export async function exchangeJwtAuthGrant(options: {
 
     applyClientAuthentication(authMethod, { client_id: clientId, client_secret: clientSecret }, headers, params);
 
-    const response = await fetchFn(tokenUrl, {
+    const response = await fetchWithinOrigin(fetchFn)(tokenUrl, {
         method: 'POST',
         headers,
         body: params.toString()
```

**File**: `packages/client/src/client/sse.ts` (modified, +50/-7)
```diff
@@ -2,11 +2,14 @@ import type { FetchLike, JSONRPCMessage, Transport } from '@modelcontextprotocol
 import {
     brandedHasInstance,
     createFetchWithInit,
+    fetchLeavingRedirects,
+    fetchWithinOrigin,
     JSONRPCMessageSchema,
     SdkError,
     SdkErrorCode,
     SdkHttpError,
-    stampErrorBrands
+    stampErrorBrands,
+    unfollowedRedirect
 } from '@modelcontextprotocol/core-internal';
 import type { ErrorEvent, EventSourceInit } from 'eventsource';
 import { EventSource } from 'eventsource';
@@ -113,13 +116,35 @@ export type SSEClientTransportOptions = {
      * `mcp-protocol-version`. A caller-supplied `Authorization` value is therefore only sent
      * while the provider has no token, which lets a static API key fall back to OAuth once
      * the provider obtains one.
+     *
+     * A `redirect` of `'error'` or `'manual'` is passed to fetch as it is for the `POST`
+     * requests that carry messages. For the OAuth requests, and for any other value,
+     * `redirect` is consulted only when
+     * {@linkcode SSEClientTransportOptions.redirectPolicy | redirectPolicy} is `'follow'`. The
+     * request that begins the stream does not read it.
      */
     requestInit?: RequestInit;
 
     /**
      * Custom fetch implementation used for all network requests.
      */
     fetch?: FetchLike;
+
+    /**
+     * How a redirect of one of the transport's requests is handled, including the OAuth
+     * requests it makes for {@linkcode SSEClientTransportOptions.authProvider | authProvider}.
+     * The option does not reach requests that a provider makes with a fetch of its own, such as
+     * those of the `assertion` callback of a `CrossAppAccessProvider`.
+     *
+     * - `'same-origin'` (default): a redirect is followed only when it stays within the origin
+     *   of the request and keeps the method, and any other redirect fails the request.
+     * - `'follow'`: redirects are left to the fetch implementation, as in earlier versions. It
+     *   follows them to any origin unless `requestInit.redirect` says otherwise, which the
+     *   request that begins the stream does not read.
+     *
+     * @default 'same-origin'
+     */
+    redirectPolicy?: 'same-origin' | 'follow';
 };
 
 /**
@@ -141,6 +166,7 @@ export class SSEClientTransport implements Transport {
     private _skipIssuerMetadataValidation?: boolean;
     private _fetch?: FetchLike;
     private _fetchWithInit: FetchLike;
+    private _redirectPolicy?: 'same-origin' | 'follow';
     private _dpop?: Middleware;
     private _protocolVersion?: string;
 
@@ -171,13 +197,26 @@ export class SSEClientTransport implements Transport {
         } else {
             this._authProvider = opts?.authProvider;
         }
+        this._redirectPolicy = opts?.redirectPolicy;
         this._fetchWithInit = createFetchWithInit(opts?.fetch, opts?.requestInit);
+        if (this._redirectPolicy === 'follow') this._fetchWithInit = fetchLeavingRedirects(this._fetchWithInit);
     }
 
     private _last401Response?: Response;
     // True between a 401-triggered reconnect and the next successful open.
     private _connectAuthRetried = false;
 
+    /** `baseFetch` with redirects handled as `redirectPolicy` says. */
+    private _redirects(baseFetch: FetchLike): FetchLike {
+        return this._redirectPolicy === 'follow' ? baseFetch : fetchWithinOrigin(baseFetch);
+    }
+
+    /** Error text for a redirect `response` that was not followed, or `undefined` for any other response. */
+    private _unfollowedRedirect(url: string | URL, response: Response): string | undefined {
+        const text = this._redirectPolicy === 'follow' ? undefined : unfollowedRedirect(url, response);
+        return text && `${text} (redirectPolicy: 'same-origin')`;
+    }
+
     private async _commonHeaders(): Promise<Headers> {
         // Start from the caller-supplied `requestInit.headers` and `set()` the
         // transport-managed headers on top. `Headers.set` compares names
@@ -211,9 +250,10 @@ export class SSEClientTransport implements Transport {
 
     private _startOrAuth(): Promise<void> {
         const eventSourceFetch = this._eventSourceInit?.fetch;
-        const fetchImpl = (
-            eventSourceFetch ? (this._dpop?.(eventSourceFetch as FetchLike) ?? eventSourceFetch) : (this._fetch ?? fetch)
-        ) as typeof fetch;
+        const fetchImpl = this._redirects(
+            (eventSourceFetch ? (this._dpop?.(eventSourceFetch as FetchLike) ?? eventSourceFetch) : (this._fetch ?? fetch)) as FetchLike
+        );
+        let redirect: string | undefined;
         return new Promise((resolve, reject) => {
             this._eventSource = new EventSource(this._url.href, {
                 ...this._eventSourceInit,
@@ -224,6 +264,7 @@ export class SSEClientTransport implements Transport {
                         ...init,
                         headers
                     });
+                    redirect = this._unfollowedRedirect(url, re
```

**File**: `packages/client/src/client/streamableHttp.ts` (modified, +46/-7)
```diff
@@ -4,6 +4,8 @@ import type { FetchLike, JSONRPCMessage, Transport } from '@modelcontextprotocol
 import {
     createFetchWithInit,
     encodeMcpParamValue,
+    fetchLeavingRedirects,
+    fetchWithinOrigin,
     isInitializedNotification,
     isInitializeRequest,
     isJSONRPCErrorResponse,
@@ -16,7 +18,8 @@ import {
     PROTOCOL_VERSION_META_KEY,
     SdkError,
     SdkErrorCode,
-    SdkHttpError
+    SdkHttpError,
+    unfollowedRedirect
 } from '@modelcontextprotocol/core-internal';
 import { EventSourceParserStream } from 'eventsource-parser/stream';
 
@@ -189,6 +192,11 @@ export type StreamableHTTPClientTransportOptions = {
      * token, `mcp-session-id`, and `mcp-protocol-version`. A caller-supplied `Authorization`
      * value is therefore only sent while the provider has no token, which lets a static API
      * key fall back to OAuth once the provider obtains one.
+     *
+     * A `redirect` of `'error'` or `'manual'` is passed to fetch as it is for the POST, GET and
+     * DELETE requests to the server URL. For the OAuth requests, and for any other value,
+     * `redirect` is consulted only when
+     * {@linkcode StreamableHTTPClientTransportOptions.redirectPolicy | redirectPolicy} is `'follow'`.
      */
     requestInit?: RequestInit;
 
@@ -197,6 +205,21 @@ export type StreamableHTTPClientTransportOptions = {
      */
     fetch?: FetchLike;
 
+    /**
+     * How a redirect of one of the transport's requests is handled, including the OAuth
+     * requests it makes for {@linkcode StreamableHTTPClientTransportOptions.authProvider | authProvider}.
+     * The option does not reach requests that a provider makes with a fetch of its own, such as
+     * those of the `assertion` callback of a `CrossAppAccessProvider`.
+     *
+     * - `'same-origin'` (default): a redirect is followed only when it stays within the origin
+     *   of the request and keeps the method, and any other redirect fails the request.
+     * - `'follow'`: redirects are left to the fetch implementation, as in earlier versions. It
+     *   follows them to any origin unless `requestInit.redirect` says otherwise.
+     *
+     * @default 'same-origin'
+     */
+    redirectPolicy?: 'same-origin' | 'follow';
+
     /**
      * Options to configure the reconnection behavior.
      */
@@ -328,6 +351,7 @@ export class StreamableHTTPClientTransport implements Transport {
     private _skipIssuerMetadataValidation?: boolean;
     private _fetch?: FetchLike;
     private _fetchWithInit: FetchLike;
+    private _redirectPolicy?: 'same-origin' | 'follow';
     private _sessionId?: string;
     private _reconnectionOptions: StreamableHTTPReconnectionOptions;
     private _protocolVersion?: string;
@@ -371,7 +395,9 @@ export class StreamableHTTPClientTransport implements Transport {
         } else {
             this._authProvider = opts?.authProvider;
         }
+        this._redirectPolicy = opts?.redirectPolicy;
         this._fetchWithInit = createFetchWithInit(opts?.fetch, opts?.requestInit);
+        if (this._redirectPolicy === 'follow') this._fetchWithInit = fetchLeavingRedirects(this._fetchWithInit);
         this._sessionId = opts?.sessionId;
         this._protocolVersion = opts?.protocolVersion;
         this._reconnectionOptions = opts?.reconnectionOptions ?? DEFAULT_STREAMABLE_HTTP_RECONNECTION_OPTIONS;
@@ -448,6 +474,17 @@ export class StreamableHTTPClientTransport implements Transport {
         });
     }
 
+    /** `baseFetch` with redirects handled as `redirectPolicy` says. */
+    private _redirects(baseFetch: FetchLike): FetchLike {
+        return this._redirectPolicy === 'follow' ? baseFetch : fetchWithinOrigin(baseFetch);
+    }
+
+    /** Error text for a redirect `response` that was not followed, or `undefined` for any other response. */
+    private _unfollowedRedirect(url: string | URL, response: Response): string | undefined {
+        const text = this._redirectPolicy === 'follow' ? undefined : unfollowedRedirect(url, response);
+        return text && `${text} (redirectPolicy: 'same-origin')`;
+    }
+
     private async _commonHeaders(): Promise<Headers> {
         // Start from the caller-supplied `requestInit.headers` and `set()` the
         // transport-managed headers on top. `Headers.set` compares names
@@ -562,7 +599,7 @@ export class StreamableHTTPClientTransport implements Transport {
                 requestSignal !== undefined && transportSignal !== undefined
                     ? anySignal(transportSignal, requestSignal)
                     : (requestSignal ?? transportSignal);
-            const response = await (this._fetch ?? fetch)(this._url, {
+            const response = await this._redirects(this._fetch ?? fetch)(this._url, {
                 ...this._requestInit,
                 method: 'GET',
                 headers,
@@ -639,7 +676,8 @@ export class StreamableHTTPClientTransport implements Transport {
                     return;
                 }
 
-              
```

**File**: `packages/client/test/client/redirects.test.ts` (added, +606/-0)
```diff
@@ -0,0 +1,606 @@
+import type { IncomingMessage, Server, ServerResponse } from 'node:http';
+import { createServer } from 'node:http';
+
+import type { JSONRPCMessage } from '@modelcontextprotocol/core-internal';
+import { listenOnRandomPort } from '@modelcontextprotocol/test-helpers';
+
+import type { OAuthClientProvider } from '../../src/client/auth';
+import {
+    discoverAuthorizationServerMetadata,
+    discoverOAuthProtectedResourceMetadata,
+    exchangeAuthorization,
+    refreshAuthorization,
+    registerClient
+} from '../../src/client/auth';
+import { exchangeJwtAuthGrant, requestJwtAuthorizationGrant } from '../../src/client/crossAppAccess';
+import type { SSEClientTransportOptions } from '../../src/client/sse';
+import { SSEClientTransport } from '../../src/client/sse';
+import type { StreamableHTTPClientTransportOptions } from '../../src/client/streamableHttp';
+import { StreamableHTTPClientTransport } from '../../src/client/streamableHttp';
+
+type Recorded = { method: string; url: string; headers: IncomingMessage['headers']; body: string };
+type Handler = (req: IncomingMessage, res: ServerResponse, recorded: Recorded) => void;
+
+const REDIRECT_STATUSES = [301, 302, 303, 307, 308];
+const request: JSONRPCMessage = { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} };
+const notification: JSONRPCMessage = { jsonrpc: '2.0', method: 'notifications/roots/list_changed' };
+const clientInformation = { client_id: 'client-1', client_secret: 'client-secret-1' };
+
+/** Two loopback servers: `endpoint` is what the client is configured with, `other` is a different origin. */
+describe('redirects', () => {
+    let endpoint: Server;
+    let other: Server;
+    let endpointUrl: URL;
+    let otherUrl: URL;
+    let endpointRequests: Recorded[];
+    let otherRequests: Recorded[];
+    let handle: Handler;
+    let transport: StreamableHTTPClientTransport | SSEClientTransport | undefined;
+
+    const record = (requests: Recorded[], respond: Handler) =>
+        createServer((req, res) => {
+            let body = '';
+            req.on('data', chunk => (body += chunk));
+            req.on('end', () => {
+                const recorded = { method: req.method ?? '', url: req.url ?? '', headers: req.headers, body };
+                requests.push(recorded);
+                respond(req, res, recorded);
+            });
+        });
+
+    const redirectTo = (location: string | URL, status = 307): Handler => {
+        return (_req, res) => void res.writeHead(status, { location: String(location) }).end();
+    };
+
+    beforeEach(async () => {
+        endpointRequests = [];
+        otherRequests = [];
+        handle = (_req, res) => void res.writeHead(404).end();
+        endpoint = record(endpointRequests, (req, res, recorded) => handle(req, res, recorded));
+        other = record(otherRequests, (_req, res) => void res.writeHead(200, { 'content-type': 'application/json' }).end('{}'));
+        endpointUrl = await listenOnRandomPort(endpoint);
+        otherUrl = await listenOnRandomPort(other);
+    });
+
+    afterEach(async () => {
+        await transport?.close();
+        transport = undefined;
+        endpoint.closeAllConnections();
+        other.closeAllConnections();
+        await new Promise(resolve => endpoint.close(resolve));
+        await new Promise(resolve => other.close(resolve));
+    });
+
+    const streamableHttp = async (): Promise<StreamableHTTPClientTransport> => {
+        const created = new StreamableHTTPClientTransport(new URL('/mcp', endpointUrl), {
+            requestInit: { headers: { 'x-api-key': 'key-1' } },
+            sessionId: 'session-1'
+        });
+        created.onerror = () => {};
+        transport = created;
+        await created.start();
+        return created;
+    };
+
+    describe('to another origin', () => {
+        test('Streamable HTTP POST is not followed, and the next message still sends', async () => {
+            const client = await streamableHttp();
+            handle = redirectTo(new URL('/mcp?from=endpoint', otherUrl));
+
+            const error = await client.send(request).catch((error_: Error) => error_);
+
+            expect(error).toBeInstanceOf(Error);
+            expect((error as Error).message).toContain(`Redirect to ${new URL('/mcp', otherUrl)} not followed`);
+            expect((error as Error).message).not.toContain('from=endpoint');
+            expect(otherRequests).toEqual([]);
+            expect(endpointRequests).toHaveLength(1);
+
+            handle = (_req, res) => void res.writeHead(202).end();
+            await client.send(notification);
+            expect(client.sessionId).toBe('session-1');
+            expect(endpointRequests).toHaveLength(2);
+            expect(endpointRequests[1]!.headers['mcp-session-id']).toBe('session-1');
+            expect(endpointRequests[1]!.headers['x-api-key']).toBe('key-1');
+            expect(otherRequests).toEqual([]);
+        });
+
+        test('Streamab
```

**File**: `packages/core-internal/src/shared/transport.ts` (modified, +66/-0)
```diff
@@ -45,6 +45,72 @@ export function createFetchWithInit(baseFetch: FetchLike = fetch, baseInit?: Req
     };
 }
 
+const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
+const MAX_REDIRECTS = 5;
+
+/** Whether `to` has the scheme, host and port of `from`, or is its https form with both on the default port. */
+export function isWithinOrigin(from: URL, to: URL): boolean {
+    if (from.protocol === to.protocol && from.host === to.host) return true;
+    return from.protocol === 'http:' && to.protocol === 'https:' && from.hostname === to.hostname && !from.port && !to.port;
+}
+
+/** The URL that a redirect `response` to a request for `url` points at, if it names one. */
+function redirectTarget(url: string | URL, response: Response): URL | undefined {
+    const location = REDIRECT_STATUSES.has(response.status) ? response.headers?.get('location') : undefined;
+    if (!location) return undefined;
+    try {
+        return new URL(location, url);
+    } catch {
+        return undefined;
+    }
+}
+
+const leftToFetch = new WeakSet<FetchLike>();
+
+/** A copy of `baseFetch` that `fetchWithinOrigin` returns as it is, which leaves redirects to `baseFetch`. */
+export function fetchLeavingRedirects(baseFetch: FetchLike): FetchLike {
+    const copy: FetchLike = (url, init) => baseFetch(url, init);
+    leftToFetch.add(copy);
+    return copy;
+}
+
+/** Wraps `baseFetch` to follow a redirect only when it keeps the method and stays within the origin of the request. */
+export function fetchWithinOrigin(baseFetch: FetchLike): FetchLike {
+    if (leftToFetch.has(baseFetch)) return baseFetch;
+    return async (url, init) => {
+        // A request that sets `redirect` to 'error' or 'manual' is handed to the base fetch as it is.
+        if (init?.redirect === 'error' || init?.redirect === 'manual') return baseFetch(url, init);
+        const method = (init?.method ?? 'GET').toUpperCase();
+        let current = url;
+        for (let followed = 0; ; followed++) {
+            // Browsers answer a manual redirect with an opaque response (status 0, no Location); it is returned as it is.
+            const response = await baseFetch(current, { ...init, redirect: 'manual' });
+            const target = redirectTarget(current, response);
+            if (!target || followed === MAX_REDIRECTS) return response;
+            const from = new URL(current);
+            const keepsMethod = method === 'GET' || response.status === 307 || response.status === 308;
+            const keepsUserinfo =
+                !(target.username || target.password) || (target.username === from.username && target.password === from.password);
+            if (!keepsMethod || !keepsUserinfo || !isWithinOrigin(from, target)) return response;
+            await response.text?.().catch(() => {});
+            current = target;
+        }
+    };
+}
+
+/** Error text for a redirect `response` to a request for `url` that was not followed, or `undefined` for any other response. */
+export function unfollowedRedirect(url: string | URL, response: Response): string | undefined {
+    if (response.type === 'opaqueredirect') return 'Redirect not followed: this runtime does not expose where it points';
+    const target = redirectTarget(response.url || url, response);
+    if (!target) return undefined;
+    target.username = target.password = target.search = target.hash = '';
+    if (target.protocol === 'http:' && new URL(response.url || url).protocol === 'https:') {
+        target.protocol = 'https:';
+        return `Redirect from https to plain http not followed; try ${target.href} as the endpoint`;
+    }
+    return `Redirect to ${target.href} not followed; use that URL as the endpoint if it is the intended server`;
+}
+
 /**
  * Options for sending a JSON-RPC message.
  */
```

**File**: `packages/core-internal/test/shared/fetchWithinOrigin.test.ts` (added, +203/-0)
```diff
@@ -0,0 +1,203 @@
+import type { FetchLike } from '../../src/shared/transport';
+import { fetchLeavingRedirects, fetchWithinOrigin, isWithinOrigin, unfollowedRedirect } from '../../src/shared/transport';
+
+const redirect = (location: string, status = 307) => new Response(null, { status, headers: { location } });
+const opaqueRedirect = { type: 'opaqueredirect', status: 0, ok: false, headers: new Headers() } as Response;
+
+describe('isWithinOrigin', () => {
+    test.each([
+        ['https://example.com/mcp', 'https://example.com/mcp', true],
+        ['https://example.com/mcp', 'https://example.com/mcp/?a=1', true],
+        ['http://example.com:8080/mcp', 'http://example.com:8080/other', true],
+        ['http://example.com/mcp', 'https://example.com/mcp', true],
+        ['http://example.com:80/mcp', 'https://example.com:443/mcp', true],
+        ['https://example.com/mcp', 'http://example.com/mcp', false],
+        ['https://example.com/mcp', 'https://example.com:8443/mcp', false],
+        ['http://example.com:8080/mcp', 'https://example.com/mcp', false],
+        ['http://example.com/mcp', 'https://example.com:8443/mcp', false],
+        ['https://example.com/mcp', 'https://other.example/mcp', false],
+        ['http://example.com/mcp', 'https://other.example/mcp', false],
+        ['https://example.com/mcp', 'https://sub.example.com/mcp', false]
+    ])('from %s to %s is %s', (from, to, expected) => {
+        expect(isWithinOrigin(new URL(from), new URL(to))).toBe(expected);
+    });
+});
+
+describe('fetchWithinOrigin', () => {
+    const init = { method: 'POST', headers: { 'x-api-key': 'key-1' }, body: '{"id":1}' };
+
+    /** A fetch that answers from `responses` by URL, and 200 for any URL not listed. */
+    const fetchAnswering = (responses: Record<string, () => Response>) =>
+        vi.fn<FetchLike>(async url => responses[String(url)]?.() ?? new Response('ok'));
+    const requested = (baseFetch: ReturnType<typeof fetchAnswering>) => baseFetch.mock.calls.map(([url]) => String(url));
+
+    test('hands the url and init to the base fetch and returns its response', async () => {
+        const response = new Response('ok');
+        const baseFetch = vi.fn<FetchLike>(async () => response);
+        const url = new URL('https://example.com/mcp');
+
+        await expect(fetchWithinOrigin(baseFetch)(url, init)).resolves.toBe(response);
+
+        expect(baseFetch).toHaveBeenCalledTimes(1);
+        expect(baseFetch.mock.calls[0]![0]).toBe(url);
+        expect(baseFetch.mock.calls[0]![1]).toEqual({ ...init, redirect: 'manual' });
+    });
+
+    test.each([307, 308])('follows a %i within the origin with the same method, headers and body', async status => {
+        const baseFetch = fetchAnswering({ 'https://example.com/mcp': () => redirect('/mcp/', status) });
+
+        const response = await fetchWithinOrigin(baseFetch)('https://example.com/mcp', init);
+
+        expect(response.status).toBe(200);
+        expect(requested(baseFetch)).toEqual(['https://example.com/mcp', 'https://example.com/mcp/']);
+        expect(baseFetch.mock.calls[1]![1]).toEqual({ ...init, redirect: 'manual' });
+    });
+
+    test.each([301, 302, 303, 307, 308])('follows a %i of a GET within the origin', async status => {
+        const baseFetch = fetchAnswering({ 'https://example.com/mcp': () => redirect('https://example.com/mcp/', status) });
+
+        const response = await fetchWithinOrigin(baseFetch)('https://example.com/mcp', { headers: init.headers });
+
+        expect(response.status).toBe(200);
+        expect(requested(baseFetch)).toEqual(['https://example.com/mcp', 'https://example.com/mcp/']);
+    });
+
+    test.each([301, 302, 303])('returns a %i of a POST without following it', async status => {
+        const baseFetch = fetchAnswering({ 'https://example.com/mcp': () => redirect('/mcp/', status) });
+
+        const response = await fetchWithinOrigin(baseFetch)('https://example.com/mcp', init);
+
+        expect(response.status).toBe(status);
+        expect(requested(baseFetch)).toEqual(['https://example.com/mcp']);
+    });
+
+    test('follows from http to https on the same host and default ports', async () => {
+        const baseFetch = fetchAnswering({ 'http://example.com/mcp': () => redirect('https://example.com/mcp') });
+
+        const response = await fetchWithinOrigin(baseFetch)('http://example.com/mcp', init);
+
+        expect(response.status).toBe(200);
+        expect(requested(baseFetch)).toEqual(['http://example.com/mcp', 'https://example.com/mcp']);
+    });
+
+    test.each([
+        'https://other.example/mcp',
+        'https://example.com:8443/mcp',
+        'http://example.com/mcp',
+        '//other.example/mcp',
+        'https://user:pass@example.com/mcp/',
+        'ftp://example.com/mcp',
+        'http://['
+    ])('returns a redirect to %s without following it', async location => {
+        const baseFetch = fetchAnswering({ 'https://example.com/mcp': () => redirec
```

---

### Incident Patch 9: `376ff90e` (2026-09-30)
**Commit Message**: docs: validate input-required elicitation examples (#2756)

Co-authored-by: Felix Weinberger <[REDACTED_EMAIL]>

**File**: `docs/servers/input-required.md` (modified, +16/-5)
```diff
@@ -174,20 +174,23 @@ Sampling and roots are deprecated as of protocol revision 2026-07-28 (SEP-2577)
 To run rounds in sequence, return an opaque `requestState` string alongside the requests. The client echoes it back byte-for-byte on the retry, and `ctx.mcpReq.requestState<State>()` reads its decoded payload on re-entry. Mint it with the codec from the next section.
 
 ```ts source="../../examples/guides/servers/input-required.examples.ts#requestState_mint"
+const cacheConfirmationSchema = z.object({ confirm: z.boolean() });
+const cacheScopeSchema = z.object({ scope: z.string() });
+
 server.registerTool(
     'wipe-cache',
     { description: 'Confirm, then pick a scope, then wipe', inputSchema: z.object({}) },
     async (_args, ctx): Promise<CallToolResult | InputRequiredResult> => {
         const state = ctx.mcpReq.requestState<{ step: string }>();
 
         if (state?.step !== 'confirmed') {
-            const confirmed = acceptedContent<{ confirm: boolean }>(ctx.mcpReq.inputResponses, 'confirm');
+            const confirmed = acceptedContent(ctx.mcpReq.inputResponses, 'confirm', cacheConfirmationSchema);
             if (confirmed?.confirm !== true) {
                 return inputRequired({
                     inputRequests: {
                         confirm: inputRequired.elicit({
                             message: 'Really wipe the cache?',
-                            requestedSchema: { type: 'object', properties: { confirm: { type: 'boolean' } }, required: ['confirm'] }
+                            requestedSchema: cacheConfirmationSchema
                         })
                     }
                 });
@@ -197,15 +200,23 @@ server.registerTool(
                 inputRequests: {
                     scope: inputRequired.elicit({
                         message: 'Which scope?',
-                        requestedSchema: { type: 'object', properties: { scope: { type: 'string' } }, required: ['scope'] }
+                        requestedSchema: cacheScopeSchema
                     })
                 },
                 requestState: await stateCodec.mint({ step: 'confirmed' })
             });
         }
 
-        const scope = acceptedContent<{ scope: string }>(ctx.mcpReq.inputResponses, 'scope');
-        return { content: [{ type: 'text', text: `Wiped ${scope?.scope ?? 'all'}` }] };
+        const scope = acceptedContent(ctx.mcpReq.inputResponses, 'scope', cacheScopeSchema);
+        if (scope === undefined) {
+            return inputRequired({
+                inputRequests: {
+                    scope: inputRequired.elicit({ message: 'Which scope?', requestedSchema: cacheScopeSchema })
+                },
+                requestState: await stateCodec.mint({ step: 'confirmed' })
+            });
+        }
+        return { content: [{ type: 'text', text: `Wiped ${scope.scope}` }] };
     }
 );
 ```
```

**File**: `examples/guides/servers/input-required.examples.ts` (modified, +16/-5)
```diff
@@ -125,20 +125,23 @@ server.registerTool(
 
 // "Carry state across rounds with `requestState`" — two sequential rounds.
 //#region requestState_mint
+const cacheConfirmationSchema = z.object({ confirm: z.boolean() });
+const cacheScopeSchema = z.object({ scope: z.string() });
+
 server.registerTool(
     'wipe-cache',
     { description: 'Confirm, then pick a scope, then wipe', inputSchema: z.object({}) },
     async (_args, ctx): Promise<CallToolResult | InputRequiredResult> => {
         const state = ctx.mcpReq.requestState<{ step: string }>();
 
         if (state?.step !== 'confirmed') {
-            const confirmed = acceptedContent<{ confirm: boolean }>(ctx.mcpReq.inputResponses, 'confirm');
+            const confirmed = acceptedContent(ctx.mcpReq.inputResponses, 'confirm', cacheConfirmationSchema);
             if (confirmed?.confirm !== true) {
                 return inputRequired({
                     inputRequests: {
                         confirm: inputRequired.elicit({
                             message: 'Really wipe the cache?',
-                            requestedSchema: { type: 'object', properties: { confirm: { type: 'boolean' } }, required: ['confirm'] }
+                            requestedSchema: cacheConfirmationSchema
                         })
                     }
                 });
@@ -148,15 +151,23 @@ server.registerTool(
                 inputRequests: {
                     scope: inputRequired.elicit({
                         message: 'Which scope?',
-                        requestedSchema: { type: 'object', properties: { scope: { type: 'string' } }, required: ['scope'] }
+                        requestedSchema: cacheScopeSchema
                     })
                 },
                 requestState: await stateCodec.mint({ step: 'confirmed' })
             });
         }
 
-        const scope = acceptedContent<{ scope: string }>(ctx.mcpReq.inputResponses, 'scope');
-        return { content: [{ type: 'text', text: `Wiped ${scope?.scope ?? 'all'}` }] };
+        const scope = acceptedContent(ctx.mcpReq.inputResponses, 'scope', cacheScopeSchema);
+        if (scope === undefined) {
+            return inputRequired({
+                inputRequests: {
+                    scope: inputRequired.elicit({ message: 'Which scope?', requestedSchema: cacheScopeSchema })
+                },
+                requestState: await stateCodec.mint({ step: 'confirmed' })
+            });
+        }
+        return { content: [{ type: 'text', text: `Wiped ${scope.scope}` }] };
     }
 );
 //#endregion requestState_mint
```

**File**: `examples/mrtr/server.ts` (modified, +3/-3)
```diff
@@ -30,7 +30,7 @@ import { acceptedContent, createMcpHandler, createRequestStateCodec, inputRequir
 import { serveStdio } from '@modelcontextprotocol/server/stdio';
 import * as z from 'zod/v4';
 
-const CONFIRM_SCHEMA = { type: 'object' as const, properties: { confirm: { type: 'boolean' as const } }, required: ['confirm'] };
+const CONFIRM_SCHEMA = z.object({ confirm: z.boolean() });
 
 type DeployState = { step: 'confirm' | 'signed-in'; env: string };
 
@@ -67,8 +67,8 @@ function buildServer(): McpServer {
             console.error(`[server] tools/call deploy(${env}) step=${step}`);
 
             if (step === 'confirm') {
-                const confirmed = acceptedContent<{ confirm: boolean }>(ctx.mcpReq.inputResponses, 'confirm');
-                if (!confirmed?.confirm) {
+                const confirmed = acceptedContent(ctx.mcpReq.inputResponses, 'confirm', CONFIRM_SCHEMA);
+                if (confirmed?.confirm !== true) {
                     return inputRequired({
                         inputRequests: {
                             confirm: inputRequired.elicit({ message: `Deploy to ${env}?`, requestedSchema: CONFIRM_SCHEMA })
```

**File**: `packages/core-internal/src/shared/inputRequired.ts` (modified, +4/-3)
```diff
@@ -113,13 +113,14 @@ function buildInputRequired(spec: InputRequiredSpec): InputRequiredResult {
  * @example Write-once tool requesting confirmation
  * ```ts
  * server.registerTool('deploy', { inputSchema: z.object({ env: z.string() }) }, async ({ env }, ctx) => {
- *     const confirmed = acceptedContent<{ confirm: boolean }>(ctx.mcpReq.inputResponses, 'confirm');
- *     if (!confirmed) {
+ *     const confirmationSchema = z.object({ confirm: z.boolean() });
+ *     const confirmed = acceptedContent(ctx.mcpReq.inputResponses, 'confirm', confirmationSchema);
+ *     if (confirmed?.confirm !== true) {
  *         return inputRequired({
  *             inputRequests: {
  *                 confirm: inputRequired.elicit({
  *                     message: `Deploy to ${env}?`,
- *                     requestedSchema: { type: 'object', properties: { confirm: { type: 'boolean' } }, required: ['confirm'] }
+ *                     requestedSchema: confirmationSchema
  *                 })
  *             }
  *         });
```

---

### Incident Patch 10: `c0cd01a2` (2026-09-30)
**Commit Message**: fix(client): retry the SSE connection once after onUnauthorized (#2905)

Co-authored-by: Felix Weinberger <[REDACTED_EMAIL]>
Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `.changeset/sse-connect-retry-once.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@modelcontextprotocol/client': patch
+---
+
+`SSEClientTransport` now retries the SSE connection once after `onUnauthorized()` resolves, as documented. If the retry is also answered with 401, `start()` rejects with `SdkHttpError` (`ClientHttpAuthentication`) instead of calling `onUnauthorized()` again. A 401 on a later reconnect of a stream that had opened still gets one refresh.
```

**File**: `packages/client/src/client/sse.ts` (modified, +17/-2)
```diff
@@ -175,6 +175,8 @@ export class SSEClientTransport implements Transport {
     }
 
     private _last401Response?: Response;
+    // True between a 401-triggered reconnect and the next successful open.
+    private _connectAuthRetried = false;
 
     private async _commonHeaders(): Promise<Headers> {
         // Start from the caller-supplied `requestInit.headers` and `set()` the
@@ -239,9 +241,10 @@ export class SSEClientTransport implements Transport {
 
             this._eventSource.onerror = event => {
                 if (event.code === 401 && this._authProvider) {
-                    if (this._authProvider.onUnauthorized && this._last401Response) {
+                    if (this._authProvider.onUnauthorized && this._last401Response && !this._connectAuthRetried) {
                         const response = this._last401Response;
                         this._last401Response = undefined;
+                        this._connectAuthRetried = true;
                         this._eventSource?.close();
                         this._authProvider.onUnauthorized({ response, serverUrl: this._url, fetchFn: this._fetchWithInit }).then(
                             // onUnauthorized succeeded → retry fresh. Its onerror handles its own onerror?.() + reject.
@@ -250,14 +253,25 @@ export class SSEClientTransport implements Transport {
                             // stamp: covers the SDK's OAuth flow and custom
                             // callbacks alike.
                             (error: unknown) => {
+                                this._connectAuthRetried = false;
                                 markAuthSeamEscape(error);
                                 this.onerror?.(error as Error);
                                 reject(error);
                             }
                         );
                         return;
                     }
-                    const error = markAuthSeamEscape(new UnauthorizedError());
+                    const retried = this._connectAuthRetried;
+                    this._connectAuthRetried = false;
+                    const error = markAuthSeamEscape(
+                        retried
+                            ? new SdkHttpError(SdkErrorCode.ClientHttpAuthentication, 'Server returned 401 after re-authentication', {
+                                  status: 401,
+                                  statusText: this._last401Response?.statusText ?? ''
+                              })
+                            : new UnauthorizedError()
+                    );
+                    this._last401Response = undefined;
                     reject(error);
                     this.onerror?.(error);
                     return;
@@ -270,6 +284,7 @@ export class SSEClientTransport implements Transport {
 
             this._eventSource.onopen = () => {
                 // The connection is open, but we need to wait for the endpoint to be received.
+                this._connectAuthRetried = false;
             };
 
             this._eventSource.addEventListener('endpoint', (event: Event) => {
```

**File**: `packages/client/test/client/sse.test.ts` (modified, +70/-12)
```diff
@@ -1783,10 +1783,43 @@ describe('SSEClientTransport', () => {
             await expect(transport.finishAuth('auth-code')).rejects.toThrow('finishAuth requires an OAuthClientProvider');
         });
 
-        it('SSE connect 401 retry does not poison future 401s — onUnauthorized called on each attempt', async () => {
+        it('SSE connect: a second 401 right after a refresh rejects, onUnauthorized called once', async () => {
+            await resourceServer.close();
+
+            let getAttempt = 0;
+            resourceServer = createServer((req, res) => {
+                if (req.method === 'GET') {
+                    getAttempt++;
+                    res.writeHead(401).end(); // always 401
+                }
+            });
+            resourceBaseUrl = await listenOnRandomPort(resourceServer);
+
+            // Backstop so an unbounded retry ends the test with a clear failure instead of a hang.
+            let calls = 0;
+            const authProvider: AuthProvider = {
+                token: vi.fn(async () => 'still-bad'),
+                onUnauthorized: vi.fn(async () => {
+                    if (++calls >= 10) throw new Error('backstop: onUnauthorized called 10 times');
+                })
+            };
+            transport = new SSEClientTransport(resourceBaseUrl, { authProvider });
+            const onerror = vi.fn();
+            transport.onerror = onerror;
+
+            const error = await transport.start().catch(e => e);
+            expect(error).toBeInstanceOf(SdkHttpError);
+            expect((error as SdkHttpError).code).toBe(SdkErrorCode.ClientHttpAuthentication);
+            expect((error as SdkHttpError).status).toBe(401);
+            expect(authProvider.onUnauthorized).toHaveBeenCalledTimes(1);
+            expect(getAttempt).toBe(2);
+            expect(onerror).toHaveBeenCalledTimes(1);
+        });
+
+        it('SSE connect 401 retry does not poison future 401s — a 401 on a later reconnect refreshes again', async () => {
             // Regression: _startOrAuth(true) baked isAuthRetry=true into the retry EventSource's
             // onerror closure, so a subsequent 401 (token expiry on reconnect) would throw
-            // instead of refreshing. Fix: retry always calls _startOrAuth() fresh.
+            // instead of refreshing. The retry guard resets once the stream opens.
             await resourceServer.close();
 
             let getAttempt = 0;
@@ -1796,7 +1829,8 @@ describe('SSEClientTransport', () => {
                     return;
                 }
                 getAttempt++;
-                if (getAttempt < 3) {
+                // 1: 401, 2: opens then drops, 3: 401 on the automatic reconnect, 4: opens and stays.
+                if (getAttempt === 1 || getAttempt === 3) {
                     res.writeHead(401).end();
                     return;
                 }
@@ -1805,8 +1839,12 @@ describe('SSEClientTransport', () => {
                     'Cache-Control': 'no-cache, no-transform',
                     Connection: 'keep-alive'
                 });
+                res.write('retry: 10\n');
                 res.write('event: endpoint\n');
                 res.write(`data: ${resourceBaseUrl.href}post\n\n`);
+                if (getAttempt === 2) {
+                    res.end();
+                }
             });
             resourceBaseUrl = await listenOnRandomPort(resourceServer);
 
@@ -1816,17 +1854,17 @@ describe('SSEClientTransport', () => {
             };
             transport = new SSEClientTransport(resourceBaseUrl, { authProvider });
 
-            await transport.start(); // should resolve on attempt 3
+            await transport.start(); // resolves on attempt 2
+            expect(authProvider.onUnauthorized).toHaveBeenCalledTimes(1);
 
+            await vi.waitFor(() => expect(getAttempt).toBe(4), { timeout: 3000 });
             expect(authProvider.onUnauthorized).toHaveBeenCalledTimes(2);
-            expect(getAttempt).toBe(3);
         });
 
         it('retry failure during SSE connect fires onerror exactly once', async () => {
             // Regression: when the retry EventSource rejected, its onerror fired inside, then
             // the outer .then() rejection handler fired onerror AGAIN for the same error.
             // Fix: inner retry chains to .then(resolve, reject) — no outer onerror call.
-            // onUnauthorized's own failure is handled separately and fires onerror once.
             await resourceServer.close();
 
             resourceServer = createServer((req, res) => {
@@ -1836,20 +1874,40 @@ describe('SSEClientTransport', () => {
             });
             resourceBaseUrl = await listenOnRandomPort(resourceServer);
 
-            const onUnauthorized: AuthProvider['onUnauthorized'] = vi
-                .fn()
-                .mockResolvedValueOnce(undefined) // first call succeeds → triggers retry
-                .mockRejectedValueOnce(new Error('refresh failed')); // second call (
```

---

### Incident Patch 11: `9350fe0d` (2026-09-30)
**Commit Message**: fix(spec): freeze 2026-07-28 release references (#2858)

Co-authored-by: Felix Weinberger <[REDACTED_EMAIL]>

**File**: `.github/workflows/update-spec-types.yml` (removed, +0/-95)
```diff
@@ -1,95 +0,0 @@
-# Nightly refresh of the draft-tracking spec anchor (2026-07-28).
-#
-# Anchor lifecycle (see packages/core-internal/src/types/README.md for the full policy):
-# - Draft anchors float: this job regenerates the draft-tracking anchor from the
-#   latest upstream draft schema and, on drift, opens a refresh PR for review.
-#   It only ever proposes — it never merges.
-# - Released anchors are frozen: generation for released revisions is pinned in
-#   scripts/fetch-spec-types.ts (RELEASED_REVISION_PINS) and is not refreshed by
-#   this job. Repinning a released revision — including the freeze of a newly
-#   published revision, when its schema moves out of schema/draft/ — must land
-#   in the same commit that retargets this workflow.
-name: Update Spec Types
-
-on:
-    schedule:
-        # Run nightly at 4 AM UTC
-        - cron: '0 4 * * *'
-    workflow_dispatch:
-
-permissions:
-    contents: write
-    pull-requests: write
-
-jobs:
-    update-spec-types:
-        runs-on: ubuntu-latest
-        steps:
-            - name: Checkout repository
-              uses: actions/checkout@v7
-
-            - name: Install pnpm
-              uses: pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320 # v5.0.0
-              id: pnpm-install
-              with:
-                  run_install: false
-
-            - name: Setup Node.js
-              uses: actions/setup-node@v6
-              with:
-                  node-version: 24
-                  cache: pnpm
-                  cache-dependency-path: pnpm-lock.yaml
-
-            - name: Install dependencies
-              run: pnpm install
-
-            - name: Fetch latest spec types
-              run: pnpm run fetch:spec-types 2026-07-28
-
-            - name: Check for changes
-              id: check_changes
-              run: |
-                  if git diff --quiet packages/core-internal/src/types/spec.types.2026-07-28.ts; then
-                    echo "has_changes=false" >> $GITHUB_OUTPUT
-                  else
-                    echo "has_changes=true" >> $GITHUB_OUTPUT
-                    LATEST_SHA=$(grep "Last updated from commit:" packages/core-internal/src/types/spec.types.2026-07-28.ts | cut -d: -f2 | tr -d ' ')
-                    echo "sha=$LATEST_SHA" >> $GITHUB_OUTPUT
-                  fi
-
-            - name: Create Pull Request
-              if: steps.check_changes.outputs.has_changes == 'true'
-              env:
-                  GH_TOKEN: ${{ github.token }}
-                  # Skip lefthook pre-push (typecheck/lint/build); spec drift that breaks
-                  # typecheck should still open a PR so it can be fixed there.
-                  LEFTHOOK: 0
-              run: |
-                  git config user.name "github-actions[bot]"
-                  git config user.email "github-actions[bot]@users.noreply.github.com"
-
-                  git checkout -B update-spec-types
-                  git add packages/core-internal/src/types/spec.types.2026-07-28.ts
-                  git commit -m "chore: update spec.types.2026-07-28.ts from upstream"
-                  git push -f --no-verify origin update-spec-types
-
-                  # Create PR if it doesn't exist, or update if it does
-                  PR_BODY="This PR updates \`packages/core-internal/src/types/spec.types.2026-07-28.ts\` from the Model Context Protocol specification.
-
-                  Source file: https://github.com/modelcontextprotocol/modelcontextprotocol/blob/${{ steps.check_changes.outputs.sha }}/schema/draft/schema.ts
-
-                  This is an automated update triggered by the nightly cron job."
-
-                  # `gh pr view <branch>` matches closed PRs too, so check for an *open* PR explicitly.
-                  EXISTING_PR=$(gh pr list --head update-spec-types --state open --json number --jq '.[0].number // empty')
-                  if [ -n "$EXISTING_PR" ]; then
-                    echo "PR #$EXISTING_PR already exists, updating description..."
-                    gh pr edit "$EXISTING_PR" --body "$PR_BODY"
-                  else
-                    gh pr create \
-                      --title "chore: update spec.types.2026-07-28.ts from upstream" \
-                      --body "$PR_BODY" \
-                      --base main \
-                      --head update-spec-types
-                  fi
```

**File**: `REVIEW.md` (modified, +2/-2)
```diff
@@ -32,7 +32,7 @@ review rounds and grows over time.
 ## Checklist
 
 **Protocol & spec**
-- Types match [`schema.ts`](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/schema/draft/schema.ts) exactly (optional vs required fields)
+- Types match the schema for the protocol revision being changed (`schema/<revision>/schema.ts` for released revisions; `schema/draft/schema.ts` only for unreleased work)
 - Correct `ProtocolError` codes (enum `ProtocolErrorCode`); HTTP status codes match spec (e.g., 404 vs 410)
 - Works for both stdio and Streamable HTTP transports — no transport-specific assumptions
 - Cross-SDK consistency: check what `python-sdk` does for the same feature
@@ -61,7 +61,7 @@ When verifying spec compliance, consult the spec directly rather than relying on
 
 - MCP documentation server: `https://modelcontextprotocol.io/mcp`
 - Full spec text (single file, LLM-friendly): `https://modelcontextprotocol.io/llms-full.txt` — fetch to a temp file and grep for the relevant section
-- Schema source of truth: [`schema.ts`](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/schema/draft/schema.ts)
+- Schema source of truth: the revision-matched `schema.ts` in `modelcontextprotocol/modelcontextprotocol` (`schema/<revision>/schema.ts` for released revisions; `schema/draft/schema.ts` only for unreleased work)
 
 ## Recurring Catches
 
```

**File**: `packages/core-internal/src/types/README.md` (modified, +5/-7)
```diff
@@ -8,19 +8,17 @@ They are reference-only test oracles: the comparison suites in `packages/core-in
 ## Lifecycle policy
 
 1. **Released revisions are frozen.** Once a protocol revision is published under `schema/<revision>/` in the spec repository, its anchor regenerates only from the pinned spec commit recorded in `RELEASED_REVISION_PINS` (`scripts/fetch-spec-types.ts`) — never from the latest
-   upstream commit. Moving that pin, including the freeze of a newly published revision (when its generation source switches from `schema/draft/` to `schema/<revision>/`), must land in the same commit that retargets the nightly update workflow
-   (`.github/workflows/update-spec-types.yml`), so the anchor and the automation that maintains it can never disagree about the source of truth.
+   upstream commit. Moving that pin, including the freeze of a newly published revision (when its generation source switches from `schema/draft/` to `schema/<revision>/`), must land atomically with every checked-in oracle derived from that revision.
 
-2. **Draft anchors float only via reviewed refresh PRs.** The anchor for an unreleased revision tracks the spec repository's `schema/draft/schema.ts`. The nightly workflow regenerates it from the latest upstream commit and, when the result differs from what is checked in, opens
-   (or updates) a refresh PR. Manual refreshes follow the same path: regenerate, then propose the diff in a PR.
+2. **Draft anchors float only while they have an explicit consumer.** An unreleased revision may track the spec repository's `schema/draft/schema.ts`, but refreshes must go through reviewed PRs and update all derived oracles atomically. No currently supported revision uses this mode.
 
 3. **The bot proposes; it never auto-merges.** Automated refreshes always go through a pull request that a maintainer reviews and merges. No automation pushes anchor changes directly to `main` or merges its own PRs. A refresh PR that breaks the comparison suites is the desired
    signal — it is fixed in that PR, not bypassed.
 
 4. **Generated twins update atomically with their anchor.** If artifacts derived from an anchor (for example vendored JSON schemas or generated validators) are checked into this repository, any refresh that changes the anchor must regenerate those artifacts in the same commit.
    The anchor and its derived twins must never be out of sync at any commit on `main`.
 
-    **This clause is OPERATIVE.** The vendored twins are the per-revision `schema.json` copies under `packages/core-internal/test/corpus/schema-twins/` (`<revision>.schema.json` + `manifest.json` recording the source commit and content hashes). They are TEST-ONLY oracles consumed by the
-    schema-twin conformance lock (`test/wire/schemaTwinConformance.test.ts`) — never bundled, never imported by runtime code, and the JSON Schema engines stay optional peer dependencies. A refresh of `spec.types.<revision>.ts` must copy the matching upstream
-    `schema/<dir>/schema.json` (same spec commit) over the twin and update `manifest.json` in the same commit; the spec example corpus manifest (`test/corpus/fixtures/<revision>/manifest.json`) records its own source commit and follows the same atomicity rule when the examples
+    **This clause is OPERATIVE.** The vendored twins are the per-revision `schema.json` copies under `packages/core-internal/test/corpus/schema-twins/` (`<revision>.schema.json` + `manifest.json` recording each twin's source commit and content hashes). They are TEST-ONLY oracles consumed by the
+    schema-twin conformance lock (`test/wire/schemaTwinConformance.test.ts`) — never bundled, never imported by runtime code, and the JSON Schema engines stay optional peer dependencies. A refresh of `spec.types.<revision>.ts` must refresh the matching upstream
+    `schema/<dir>/schema.json` from that twin's recorded source commit and update `manifest.json` in the same change; the spec example corpus manifest (`test/corpus/fixtures/<revision>/manifest.json`) records its own source commit and follows the same atomicity rule when the examples
     are re-vendored. The conformance lock failing after an anchor-only refresh is the desired loud signal of a missed twin update.
```

**File**: `packages/core-internal/src/types/spec.types.2026-07-28.ts` (modified, +21/-8)
```diff
@@ -2,8 +2,8 @@
  * This file is automatically generated from the Model Context Protocol specification.
  *
  * Source: https://github.com/modelcontextprotocol/modelcontextprotocol
- * Pulled from: https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/schema/draft/schema.ts
- * Last updated from commit: 71e306956a4959c9655e5036be215d41986596e6
+ * Pulled from: https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/schema/2026-07-28/schema.ts
+ * Last updated from commit: 271ecc9accafdd9b83a3c869fa67c22953b2af80
  *
  * DO NOT EDIT THIS FILE MANUALLY. Changes will be overwritten by automated updates.
  * To update this file, run: pnpm run fetch:spec-types 2026-07-28
@@ -55,7 +55,7 @@ export const JSONRPC_VERSION = '2.0';
  * - Unless empty, MUST start and end with an alphanumeric character (`[a-z0-9A-Z]`).
  * - Interior characters may be alphanumeric, hyphens (`-`), underscores (`_`), or dots (`.`).
  *
- * @see [General fields: `_meta`](/specification/draft/basic/index#meta) for more details.
+ * @see [General fields: `_meta`](/specification/2026-07-28/basic/index#meta) for more details.
  * @category Common Types
  */
 export type MetaObject = Record<string, unknown>;
@@ -64,7 +64,7 @@ export type MetaObject = Record<string, unknown>;
  * Extends {@link MetaObject} with additional request-specific fields. All key naming rules from `MetaObject` apply.
  *
  * @see {@link MetaObject} for key naming rules and reserved prefixes.
- * @see [General fields: `_meta`](/specification/draft/basic/index#meta) for more details.
+ * @see [General fields: `_meta`](/specification/2026-07-28/basic/index#meta) for more details.
  * @category Common Types
  */
 export interface RequestMetaObject extends MetaObject {
@@ -121,7 +121,7 @@ export interface RequestMetaObject extends MetaObject {
  * Extends {@link MetaObject} with additional notification-specific fields. All key naming rules from `MetaObject` apply.
  *
  * @see {@link MetaObject} for key naming rules and reserved prefixes.
- * @see [General fields: `_meta`](/specification/draft/basic/index#meta) for more details.
+ * @see [General fields: `_meta`](/specification/2026-07-28/basic/index#meta) for more details.
  * @category Common Types
  */
 export interface NotificationMetaObject extends MetaObject {
@@ -144,7 +144,7 @@ export interface NotificationMetaObject extends MetaObject {
  * Extends {@link MetaObject} with additional result-specific fields. All key naming rules from `MetaObject` apply.
  *
  * @see {@link MetaObject} for key naming rules and reserved prefixes.
- * @see [General fields: `_meta`](/specification/draft/basic/index#meta) for more details.
+ * @see [General fields: `_meta`](/specification/2026-07-28/basic/index#meta) for more details.
  * @category Common Types
  */
 export interface ResultMetaObject extends MetaObject {
@@ -1317,7 +1317,7 @@ export interface SubscriptionsListenRequest extends JSONRPCRequest {
  * @see {@link MetaObject} for key naming rules and reserved prefixes.
  * @category `subscriptions/listen`
  */
-export interface SubscriptionsListenResultMeta extends ResultMetaObject {
+export interface SubscriptionsListenResultMetaObject extends ResultMetaObject {
     /**
      * Identifies the subscription stream this response closes, so the client can
      * correlate it with the originating subscription — mirroring the same key on
@@ -1341,7 +1341,20 @@ export interface SubscriptionsListenResultMeta extends ResultMetaObject {
  * @category `subscriptions/listen`
  */
 export interface SubscriptionsListenResult extends Result {
-    _meta: SubscriptionsListenResultMeta;
+    _meta: SubscriptionsListenResultMetaObject;
+}
+
+/**
+ * A successful response from the server for a {@link SubscriptionsListenRequest | subscriptions/listen}
+ * request, sent when the server tears the subscription down gracefully.
+ *
+ * @example Subscription closed gracefully response
+ * {@includeCode ./examples/SubscriptionsListenResultResponse/listen-closed-response.json}
+ *
+ * @category `subscriptions/listen`
+ */
+export interface SubscriptionsListenResultResponse extends JSONRPCResultResponse {
+    result: SubscriptionsListenResult;
 }
 
 /**
```

**File**: `packages/core-internal/src/wire/rev2026-07-28/buildSchemas.ts` (modified, +4/-2)
```diff
@@ -1070,7 +1070,7 @@ function build() {
     const SubscriptionsListenRequestSchema = wireRequest('subscriptions/listen', subscriptionsListenParamsShape);
 
     /**
-     * Anchor SubscriptionsListenResultMeta — required subscriptionId stamp on
+     * Anchor SubscriptionsListenResultMetaObject — required subscriptionId stamp on
      * the graceful-close result. Extends `ResultMetaObject` since spec PR
      * #3002 (composed, so the serverInfo key and its leniency stay single-sourced).
      */
@@ -1276,6 +1276,7 @@ function build() {
     const ReadResourceResultResponseSchema = wireResultResponse(z.union([ReadResourceResultSchema, InputRequiredResultSchema]));
     const CompleteResultResponseSchema = wireResultResponse(CompleteResultSchema);
     const DiscoverResultResponseSchema = wireResultResponse(DiscoverResultSchema);
+    const SubscriptionsListenResultResponseSchema = wireResultResponse(SubscriptionsListenResultSchema);
 
     return {
         JSONValueSchema,
@@ -1411,7 +1412,8 @@ function build() {
         ListResourceTemplatesResultResponseSchema,
         ReadResourceResultResponseSchema,
         CompleteResultResponseSchema,
-        DiscoverResultResponseSchema
+        DiscoverResultResponseSchema,
+        SubscriptionsListenResultResponseSchema
     };
 }
 
```

**File**: `packages/core-internal/src/wire/rev2026-07-28/schemas.ts` (modified, +1/-0)
```diff
@@ -156,3 +156,4 @@ export const ListResourceTemplatesResultResponseSchema = s.ListResourceTemplates
 export const ReadResourceResultResponseSchema = s.ReadResourceResultResponseSchema;
 export const CompleteResultResponseSchema = s.CompleteResultResponseSchema;
 export const DiscoverResultResponseSchema = s.DiscoverResultResponseSchema;
+export const SubscriptionsListenResultResponseSchema = s.SubscriptionsListenResultResponseSchema;
```

**File**: `packages/core-internal/test/corpus/fixtures/2026-07-28/SubscriptionsListenResultResponse/listen-closed-response.json` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+{
+  "jsonrpc": "2.0",
+  "id": "listen-1",
+  "result": {
+    "resultType": "complete",
+    "_meta": {
+      "io.modelcontextprotocol/subscriptionId": "listen-1"
+    }
+  }
+}
```

**File**: `packages/core-internal/test/corpus/fixtures/2026-07-28/manifest.json` (modified, +7/-4)
```diff
@@ -2,12 +2,12 @@
     "revision": "2026-07-28",
     "source": {
         "repo": "modelcontextprotocol/modelcontextprotocol",
-        "path": "schema/draft/examples",
-        "commit": "71e306956a4959c9655e5036be215d41986596e6"
+        "path": "schema/2026-07-28/examples",
+        "commit": "271ecc9accafdd9b83a3c869fa67c22953b2af80"
     },
     "regenerate": "pnpm fetch:spec-examples --spec-dir <spec-checkout>   # or [sha] to fetch from GitHub",
-    "directoryCount": 87,
-    "fileCount": 128,
+    "directoryCount": 88,
+    "fileCount": 129,
     "directories": {
         "AudioContent": [
             "audio-wav-content.json"
@@ -273,6 +273,9 @@
         "SubscriptionsListenResult": [
             "listen-closed.json"
         ],
+        "SubscriptionsListenResultResponse": [
+            "listen-closed-response.json"
+        ],
         "TextContent": [
             "text-content.json"
         ],
```

---

### Incident Patch 12: `e765b3be` (2026-09-30)
**Commit Message**: fix(client): say so when the version probe gets an unusable reply (#2903)

Co-authored-by: Felix Weinberger <[REDACTED_EMAIL]>
Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `.changeset/probe-unusable-2xx-reply-message.md` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+---
+'@modelcontextprotocol/client': patch
+---
+
+With `versionNegotiation` in `'auto'` or pin mode, a `server/discover` probe answered with a 2xx that carries no usable reply (an empty or
+non-JSON body, a `204`, a missing or unexpected content type) still rejects `connect()` with `EraNegotiationFailed`. The message now says
+`the server answered with an unusable reply (...)` instead of reading like a network failure. To connect to a 2025 server behind a front that
+answers the probe this way, pass `connect(transport, { prior: { kind: 'legacy' } })` or use `mode: 'legacy'`.
```

**File**: `docs/migration/support-2026-07-28.md` (modified, +1/-1)
```diff
@@ -79,7 +79,7 @@ falling back — see [Protocol versions](../protocol-versions.md). This holds ev
 a front that answers the probe `403` but would pass `initialize`: relying on a legacy
 fallback there is a deliberate non-goal — fix the auth wall (or pass credentials),
 because auth status never selects an era. A `5xx` on the probe is a server failure,
-also never era evidence: `connect()` rejects with `SdkHttpError(EraNegotiationFailed)`. Probe timeouts are **transport-aware**: on **stdio** a server that does not
+also never era evidence: `connect()` rejects with `SdkHttpError(EraNegotiationFailed)`. A `2xx` probe answer that carries no usable reply (an empty or non-JSON body, a `204`, a missing or unexpected content type) is not era evidence either: `connect()` rejects with `SdkError(EraNegotiationFailed)`. Probe timeouts are **transport-aware**: on **stdio** a server that does not
 answer within `timeoutMs` is treated as legacy and the client falls back to `initialize`
 (some legacy servers never respond to unknown pre-`initialize`
 requests at all); on **HTTP** a probe timeout rejects with `SdkError(RequestTimeout)` —
```

**File**: `docs/protocol-versions.md` (modified, +2/-0)
```diff
@@ -99,6 +99,8 @@ const cli = new Client(
 );
 ```
 
+A `2xx` answer that carries no usable reply (an empty or non-JSON body, a `204`, a missing or unexpected content type) is not era evidence: `connect()` rejects with `SdkError(EraNegotiationFailed)` and the message says `the server answered with an unusable reply`. To connect to a 2025 server behind a front that answers the probe this way, pass `connect(transport, { prior: { kind: 'legacy' } })`.
+
 A probe timeout is transport-aware. On stdio a silent server is a legacy server, so `connect()` falls back to `initialize`; on HTTP silence is an outage, so `connect()` rejects with `SdkError(RequestTimeout)` instead of misreporting a dead server as legacy. One browser exception: an opaque CORS `TypeError` during the probe falls back to the legacy era, because deployed 2025 servers commonly have allow-lists that predate the 2026 headers.
 
 Auth statuses are not era evidence either. An HTTP `401` or `403` rejecting the probe surfaces as a typed authorization failure, never the legacy fallback — and never as `EraNegotiationFailed`, so era-recovery flows keyed on that code (the [gateway guide](./advanced/gateway.md) recipe) cannot consume an auth wall. A plain `401` or `403` — with or without an `authProvider` — rejects `connect()` with an `SdkHttpError` carrying the status: code `ClientHttpAuthentication` for `401`, `ClientHttpForbidden` for `403`. One 403 shape is different: a `WWW-Authenticate` challenge with `error="insufficient_scope"` enters the Streamable HTTP transport's step-up flow regardless of provider, and with none it rejects with the flow's typed `InsufficientScopeError`. With a provider, a `401` (and a `403` `insufficient_scope` challenge) runs the auth flow first, and whatever escapes it reaches you as thrown, identity intact — the transport stamps errors at its auth seams (the `token()` read, `onUnauthorized` including custom callbacks, step-up), so `UnauthorizedError` for `finishAuth()`, the flow's typed failures (`OAuthError`, `InsufficientScopeError`, the 401-after-re-authentication diagnostic), and even an untyped crash inside a callback all propagate unchanged. A `5xx` rejecting the probe is a server failure, not era evidence: `connect()` rejects with `SdkHttpError(EraNegotiationFailed)` naming the status. These status-keyed rows read the transport's typed HTTP rejections — the SDK's Streamable HTTP transport surfaces them with the status attached; the legacy SSE client transport reports a non-2xx POST as a generic error, so over SSE a probe rejection surfaces as the generic `Version negotiation probe failed` connect error instead. Auth settles first, era second: a `401` never decides the era — the auth wall answers before the MCP layer ever sees `server/discover` — and the post-auth re-probe supplies the real era evidence.
```

**File**: `docs/troubleshooting.md` (modified, +1/-0)
```diff
@@ -74,6 +74,7 @@ With the global in place the [client OAuth](./clients/oauth.md) flows run unchan
 - `the server gave no modern evidence and this client supports no pre-2026-07-28 protocol version to fall back to` — or its `the connection closed during the server/discover probe and this client supports no ...` variant — `mode: 'auto'` with a modern-only `supportedProtocolVersions` list removes the legacy fallback: restore a pre-2026 entry.
 - `the connection closed during the server/discover probe (this transport probed in place — the disposable sibling probe requires the SDK's base StdioClientTransport)` — a subclass of `StdioClientTransport`, or a custom stdio-shaped transport, probed in place and met a server that exits on any pre-`initialize` request: use the base `StdioClientTransport` (which probes on a disposable sibling), or `mode: 'legacy'`.
 - `the transport was closed during the server/discover probe` — the caller closed the transport while the probe was in flight; the connect aborted deliberately and the session child was never spawned.
+- `Version negotiation probe failed: the server answered with an unusable reply (...)` — the server, or something in front of it, answered the probe with a `2xx` that carries no usable reply (an empty or non-JSON body, a `204`, a missing or unexpected content type). That is not era evidence, so no legacy fallback is attempted: check the URL and what sits in front of the server. To connect to a 2025 server behind such a front, pass `connect(transport, { prior: { kind: 'legacy' } })` or use `mode: 'legacy'`.
 - `Version negotiation probe failed: ...` — the probe hit a transport failure (network outage, HTTP connection drop): fix connectivity and retry.
 - `the server answered the probe with HTTP 5xx` — the server or a proxy in front of it failed (mid-deploy, crashed backend); not era evidence, so no legacy fallback is attempted: retry once the deployment is healthy.
 
```

**File**: `packages/client/src/client/probeClassifier.ts` (modified, +14/-0)
```diff
@@ -51,6 +51,8 @@ export type ProbeOutcome =
     /** The HTTP layer rejected the probe POST (non-2xx); `body` is the raw response text and `statusText` the HTTP reason phrase, when available. */
     | { kind: 'http-error'; status: number; body?: string; statusText?: string }
     | { kind: 'network-error'; error: unknown }
+    /** The probe was answered 2xx without a usable reply (body is not JSON, or an unaccepted media type); `error` is the transport's failure. */
+    | { kind: 'unusable-reply'; error: unknown }
     /** The transport's auth flow challenged or failed during the probe send — an error stamped at a transport auth seam, or an `UnauthorizedError` (the foreign-transport contract). `error` propagates unchanged. */
     | { kind: 'auth-required'; error: Error }
     /** The transport reported close while the probe awaited its reply. */
@@ -139,6 +141,18 @@ export function classifyProbeOutcome(outcome: ProbeOutcome, context: ProbeClassi
         case 'network-error': {
             return classifyNetworkError(outcome.error, context);
         }
+        case 'unusable-reply': {
+            // An unreadable 2xx is not era evidence: reject and say what was answered, never fall back.
+            return {
+                kind: 'error',
+                error: new SdkError(
+                    SdkErrorCode.EraNegotiationFailed,
+                    `Version negotiation probe failed: the server answered with an unusable reply (${describeError(outcome.error)})`,
+                    { cause: outcome.error },
+                    { cause: outcome.error }
+                )
+            };
+        }
         case 'auth-required': {
             // Not era evidence: propagate the auth challenge unchanged so the
             // caller can run finishAuth() and reconnect — the reconnect probes
```

**File**: `packages/client/src/client/versionNegotiation.ts` (modified, +12/-0)
```diff
@@ -375,6 +375,15 @@ export function buildProbeRequest(
     };
 }
 
+/** True for what the transport throws when the probe was answered 2xx without a usable reply. */
+function isUnusableReplyError(error: unknown): boolean {
+    if (error instanceof SdkError && error.code === SdkErrorCode.ClientHttpUnexpectedContent) {
+        return true;
+    }
+    // By name, not `instanceof`: an injected `fetch` can produce a SyntaxError from another realm.
+    return error instanceof Error && error.name === 'SyntaxError';
+}
+
 function normalizeReply(reply: RawProbeReply, timeoutMs: number): ProbeOutcome {
     switch (reply.kind) {
         case 'response': {
@@ -409,6 +418,9 @@ function normalizeReply(reply: RawProbeReply, timeoutMs: number): ProbeOutcome {
                     statusText: error.data.statusText
                 };
             }
+            if (isUnusableReplyError(error)) {
+                return { kind: 'unusable-reply', error };
+            }
             return { kind: 'network-error', error };
         }
         case 'closed': {
```

**File**: `packages/client/test/client/probeClassifier.test.ts` (modified, +37/-0)
```diff
@@ -346,3 +346,40 @@ describe('row: browser opaque CORS/preflight TypeError, PROBE PHASE ONLY → leg
         expect(verdict.kind).toBe('error');
     });
 });
+
+describe('row: unusable-reply — the HTTP layer answered 2xx with an unusable body → typed connect error', () => {
+    const jsonSyntaxError = () => {
+        try {
+            JSON.parse('');
+            throw new Error('unreachable');
+        } catch (error) {
+            return error;
+        }
+    };
+
+    test.each([true, false])('an empty JSON body is never an era verdict (fallbackAvailable: %s)', fallbackAvailable => {
+        const cause = jsonSyntaxError();
+        const verdict = classify({ kind: 'unusable-reply', error: cause }, { fallbackAvailable });
+        expect(verdict.kind).toBe('error');
+        if (verdict.kind === 'error') {
+            expect(verdict.error).toBeInstanceOf(SdkError);
+            expect((verdict.error as SdkError).code).toBe(SdkErrorCode.EraNegotiationFailed);
+            expect(verdict.error.message).toContain('the server answered with an unusable reply');
+            expect((verdict.error as SdkError).data).toMatchObject({ cause });
+            expect(verdict.error.cause).toBe(cause);
+        }
+    });
+
+    test('an unaccepted media type (bare 204, text/plain) is never an era verdict', () => {
+        const cause = new SdkError(SdkErrorCode.ClientHttpUnexpectedContent, 'Unexpected content type: text/plain', {
+            contentType: 'text/plain'
+        });
+        const verdict = classify({ kind: 'unusable-reply', error: cause });
+        expect(verdict.kind).toBe('error');
+        if (verdict.kind === 'error') {
+            expect((verdict.error as SdkError).code).toBe(SdkErrorCode.EraNegotiationFailed);
+            expect(verdict.error.message).toContain('the server answered with an unusable reply (Unexpected content type: text/plain)');
+            expect(verdict.error.cause).toBe(cause);
+        }
+    });
+});
```

**File**: `packages/client/test/client/probeUnusable2xx.wire.test.ts` (added, +156/-0)
```diff
@@ -0,0 +1,156 @@
+// #2619: the real StreamableHTTPClientTransport against a fetch stub that plays a gateway in front of a 2025 server.
+import { SdkError, SdkErrorCode } from '@modelcontextprotocol/core-internal';
+import { describe, expect, test } from 'vitest';
+
+import { Client } from '../../src/client/client';
+import { StreamableHTTPClientTransport } from '../../src/client/streamableHttp';
+
+const JSON_CT = { 'content-type': 'application/json' };
+const UNUSABLE = 'the server answered with an unusable reply';
+
+function gatewayInFrontOfLegacy(probeAnswer: () => Response | Promise<Response>) {
+    const seen: string[] = [];
+    const fetchStub = async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
+        if (init?.method !== 'POST') return new Response(null, { status: 405 });
+        const message = JSON.parse(String(init.body)) as { id?: unknown; method?: string };
+        seen.push(message.method ?? '(response)');
+        if (message.method === 'server/discover') return probeAnswer();
+        if (message.method === 'initialize') {
+            return Response.json(
+                {
+                    jsonrpc: '2.0',
+                    id: message.id,
+                    result: {
+                        protocolVersion: '2025-11-25',
+                        capabilities: {},
+                        serverInfo: { name: 'legacy-behind-gateway', version: '1.0.0' }
+                    }
+                },
+                { status: 200, headers: JSON_CT }
+            );
+        }
+        return new Response(null, { status: 202 });
+    };
+    return { fetchStub: fetchStub as typeof fetch, seen };
+}
+
+async function connect(
+    options: ConstructorParameters<typeof Client>[1],
+    probeAnswer: () => Response | Promise<Response>,
+    connectOptions?: Parameters<Client['connect']>[1]
+) {
+    const { fetchStub, seen } = gatewayInFrontOfLegacy(probeAnswer);
+    const client = new Client({ name: 'repro-2619', version: '1.0.0' }, options);
+    const transport = new StreamableHTTPClientTransport(new URL('http://gateway.invalid/mcp'), { fetch: fetchStub });
+    const outcome = await client.connect(transport, connectOptions).then(
+        () => 'connected' as const,
+        (error: unknown) => error
+    );
+    const era = outcome === 'connected' ? client.getProtocolEra() : undefined;
+    const server = outcome === 'connected' ? client.getServerVersion()?.name : undefined;
+    await client.close().catch(() => {});
+    return { outcome, era, server, seen };
+}
+
+const AUTO = { versionNegotiation: { mode: 'auto' as const } };
+const emptyJson = () => new Response('', { status: 200, headers: JSON_CT });
+
+describe('#2619: the four rows of the issue table (real transport, injected fetch)', () => {
+    const rows: Array<[string, () => Response, string]> = [
+        ['200, application/json, empty body', emptyJson, 'SyntaxError'],
+        ['200, application/json, whitespace body', () => new Response('  \n', { status: 200, headers: JSON_CT }), 'SyntaxError'],
+        ['204, no content-type', () => new Response(null, { status: 204 }), 'SdkError'],
+        ['200, text/plain', () => new Response('OK', { status: 200, headers: { 'content-type': 'text/plain' } }), 'SdkError']
+    ];
+
+    test.each(rows)('%s -> connect() rejects, says what was answered, and never sends initialize', async (_label, probeAnswer, cause) => {
+        const { outcome, seen } = await connect(AUTO, probeAnswer);
+        expect(outcome).toBeInstanceOf(SdkError);
+        expect((outcome as SdkError).code).toBe(SdkErrorCode.EraNegotiationFailed);
+        expect((outcome as SdkError).message).toContain(UNUSABLE);
+        expect(((outcome as Error).cause as Error | undefined)?.name).toBe(cause);
+        expect(seen).toEqual(['server/discover']);
+    });
+});
+
+describe('#2619: the way out the message points to', () => {
+    test('a known-legacy verdict skips the probe and connects', async () => {
+        const { outcome, era, server, seen } = await connect(AUTO, emptyJson, { prior: { kind: 'legacy' } });
+        expect(outcome).toBe('connected');
+        expect(era).toBe('legacy');
+        expect(server).toBe('legacy-behind-gateway');
+        expect(seen.slice(0, 2)).toEqual(['initialize', 'notifications/initialized']);
+    });
+
+    test('the default mode sends no probe and connects', async () => {
+        const { outcome, era, seen } = await connect(undefined, emptyJson);
+        expect(outcome).toBe('connected');
+        expect(era).toBe('legacy');
+        expect(seen).not.toContain('server/discover');
+    });
+});
+
+describe('#2619: what must not move', () => {
+    test('control from the issue: a 400 with an unrecognized body already falls back', async () => {
+        const { outcome, era } = await connect(AUTO, () => new Response('Bad Request', { status: 400 }));
+        expect(outcome).toBe('connected');
+        expect(era
```

---

### Incident Patch 13: `2237555e` (2026-09-30)
**Commit Message**: Typecheck the three test workspace packages, and fix the registerPrompt typing defect they were hiding (#2841)

Signed-off-by: Sharvil Saxena <[REDACTED_EMAIL]>
Co-authored-by: Felix Weinberger <[REDACTED_EMAIL]>

**File**: `.changeset/register-prompt-context-only-overload.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@modelcontextprotocol/server': patch
+---
+
+`McpServer.registerPrompt()` now types the callback correctly when no `argsSchema` is given: its one parameter is the server context. Before, reading `ctx.mcpReq` there was a type error although it worked at runtime. Prompts registered with an `argsSchema` are unchanged.
```

**File**: `packages/server/src/server/mcp.ts` (modified, +14/-1)
```diff
@@ -1082,6 +1082,19 @@ export class McpServer {
      * );
      * ```
      */
+    registerPrompt(
+        name: string,
+        config: {
+            title?: string;
+            description?: string;
+            argsSchema?: undefined;
+            icons?: Icon[];
+            /** Determines whether this prompt retrieval needs an OAuth scope challenge. */
+            scopeChallenge?: ScopeChallengeHandler;
+            _meta?: Record<string, unknown>;
+        },
+        cb: PromptCallback
+    ): RegisteredPrompt;
     registerPrompt<Args extends StandardSchemaWithJSON>(
         name: string,
         config: {
@@ -1118,7 +1131,7 @@ export class McpServer {
             scopeChallenge?: ScopeChallengeHandler;
             _meta?: Record<string, unknown>;
         },
-        cb: PromptCallback<StandardSchemaWithJSON> | LegacyPromptCallback<ZodRawShape>
+        cb: PromptCallback | PromptCallback<StandardSchemaWithJSON> | LegacyPromptCallback<ZodRawShape>
     ): RegisteredPrompt {
         if (this._registeredPrompts[name]) {
             throw new Error(`Prompt ${name} is already registered`);
```

**File**: `packages/server/test/server/registerPromptNoArgs.test.ts` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+// Pins the types of registerPrompt() without argsSchema: the callback's one parameter is the server context.
+import type { ServerContext } from '@modelcontextprotocol/core-internal';
+import { describe, expect, expectTypeOf, test } from 'vitest';
+
+import { McpServer } from '../../src/server/mcp';
+
+describe('registerPrompt without argsSchema', () => {
+    test('types the callback parameter as the server context', () => {
+        const server = new McpServer({ name: 'test server', version: '1.0' });
+
+        server.registerPrompt('ctx-only', {}, async ctx => {
+            expectTypeOf(ctx).toEqualTypeOf<ServerContext>();
+            return { messages: [{ role: 'assistant' as const, content: { type: 'text' as const, text: String(ctx.mcpReq.id) } }] };
+        });
+
+        expect(server.server).toBeDefined();
+    });
+
+    test('still accepts a callback that ignores the context', () => {
+        const server = new McpServer({ name: 'test server', version: '1.0' });
+
+        server.registerPrompt('no-args', { description: 'takes nothing' }, async () => ({
+            messages: [{ role: 'assistant' as const, content: { type: 'text' as const, text: 'ok' } }]
+        }));
+
+        expect(server.server).toBeDefined();
+    });
+});
```

**File**: `pnpm-lock.yaml` (modified, +9/-0)
```diff
@@ -1972,6 +1972,9 @@ importers:
       '@modelcontextprotocol/vitest-config':
         specifier: workspace:^
         version: link:../../common/vitest-config
+      '@typescript/native-preview':
+        specifier: catalog:devTools
+        version: 7.0.0-dev.20260327.2
       cors:
         specifier: catalog:runtimeServerOnly
         version: 2.8.6
@@ -2083,6 +2086,9 @@ importers:
       '@modelcontextprotocol/vitest-config':
         specifier: workspace:^
         version: link:../../common/vitest-config
+      '@typescript/native-preview':
+        specifier: catalog:devTools
+        version: 7.0.0-dev.20260327.2
       vitest:
         specifier: catalog:devTools
         version: 4.1.2(@opentelemetry/api@1.9.1)(@types/node@25.5.0)(vite@7.3.0(@types/node@25.5.0)(tsx@4.21.0)(yaml@2.8.3))
@@ -2122,6 +2128,9 @@ importers:
       '@modelcontextprotocol/vitest-config':
         specifier: workspace:^
         version: link:../../common/vitest-config
+      '@typescript/native-preview':
+        specifier: catalog:devTools
+        version: 7.0.0-dev.20260327.2
       '@valibot/to-json-schema':
         specifier: catalog:devTools
         version: 1.6.0(valibot@1.3.1(typescript@5.9.3))
```

**File**: `test/conformance/package.json` (modified, +2/-0)
```diff
@@ -22,6 +22,7 @@
         "mcp"
     ],
     "scripts": {
+        "typecheck": "tsgo -p tsconfig.json --noEmit",
         "lint": "eslint src/ && prettier --ignore-path ../../.prettierignore --check .",
         "lint:fix": "eslint src/ --fix && prettier --ignore-path ../../.prettierignore --write .",
         "check": "npm run typecheck && npm run lint",
@@ -51,6 +52,7 @@
         "cors": "catalog:runtimeServerOnly",
         "express": "catalog:runtimeServerOnly",
         "tsx": "catalog:devTools",
+        "@typescript/native-preview": "catalog:devTools",
         "zod": "catalog:runtimeShared"
     }
 }
```

**File**: `test/conformance/src/everythingServer.ts` (modified, +4/-1)
```diff
@@ -200,7 +200,10 @@ function createMcpServer() {
             inputSchema: fromJsonSchema<{ region?: string; level?: number }>({
                 type: 'object',
                 properties: {
-                    region: { type: 'string', description: 'mirrored into Mcp-Param-Region', 'x-mcp-header': 'Region' },
+                    region: { type: 'string', description: 'mirrored into Mcp-Param-Region', 'x-mcp-header': 'Region' } as Record<
+                        string,
+                        unknown
+                    >,
                     level: { type: 'integer', description: 'non-mirrored argument' }
                 }
             })
```

**File**: `test/conformance/tsconfig.json` (modified, +2/-0)
```diff
@@ -13,7 +13,9 @@
                 "./node_modules/@modelcontextprotocol/core-internal/src/exports/public/index.ts"
             ],
             "@modelcontextprotocol/client": ["./node_modules/@modelcontextprotocol/client/src/index.ts"],
+            "@modelcontextprotocol/client/_shims": ["./node_modules/@modelcontextprotocol/client/src/shimsNode.ts"],
             "@modelcontextprotocol/server": ["./node_modules/@modelcontextprotocol/server/src/index.ts"],
+            "@modelcontextprotocol/server/_shims": ["./node_modules/@modelcontextprotocol/server/src/shimsNode.ts"],
             "@modelcontextprotocol/express": ["./node_modules/@modelcontextprotocol/express/src/index.ts"],
             "@modelcontextprotocol/node": ["./node_modules/@modelcontextprotocol/node/src/index.ts"],
             "@modelcontextprotocol/vitest-config": ["./node_modules/@modelcontextprotocol/vitest-config/tsconfig.json"],
```

**File**: `test/helpers/package.json` (modified, +3/-1)
```diff
@@ -22,6 +22,7 @@
         "mcp"
     ],
     "scripts": {
+        "typecheck": "tsgo -p tsconfig.json --noEmit",
         "lint": "eslint src/ && prettier --ignore-path ../../.prettierignore --check .",
         "lint:fix": "eslint src/ --fix && prettier --ignore-path ../../.prettierignore --write .",
         "check": "npm run typecheck && npm run lint"
@@ -32,6 +33,7 @@
         "vitest": "catalog:devTools",
         "@modelcontextprotocol/tsconfig": "workspace:^",
         "@modelcontextprotocol/vitest-config": "workspace:^",
-        "@modelcontextprotocol/eslint-config": "workspace:^"
+        "@modelcontextprotocol/eslint-config": "workspace:^",
+        "@typescript/native-preview": "catalog:devTools"
     }
 }
```

---

### Incident Patch 14: `5238fba4` (2026-09-30)
**Commit Message**: fix(core): serve tasks/get and tasks/cancel on 2026-07-28 with an explicit schema (#2599)

Co-authored-by: freya0926 <[REDACTED_EMAIL]>
Co-authored-by: Felix Weinberger <[REDACTED_EMAIL]>

**File**: `.changeset/era-gate-explicit-schema-handlers.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+'@modelcontextprotocol/client': patch
+'@modelcontextprotocol/server': patch
+---
+
+A server can now serve, and a client can now call, `tasks/get` and `tasks/cancel` of the Tasks extension (SEP-2663) on a 2026-07-28 connection, when the handler is registered and the request is sent with an explicit schema. Every other method that a protocol revision removed is still refused. If one server factory serves both eras and such a handler is meant for 2025-era clients only, register it only when `ctx.era === 'legacy'`.
```

**File**: `docs/migration/support-2026-07-28.md` (modified, +19/-6)
```diff
@@ -349,11 +349,20 @@ mismatch is rejected as an entry/routing error (`-32022 Unsupported protocol ver
 for requests; drop + `onerror` for notifications).
 
 Methods deleted by a protocol revision are **physically absent** from that era's
-registry: an inbound `tasks/get` on a 2026-era connection gets `-32601` even if a
-handler is registered, and sending an era-mismatched spec method (e.g. `server/discover`
-toward a 2025-era peer, or any `tasks/*` method toward a 2026-era peer) throws
+registry: an inbound `ping` or `tasks/result` on a 2026-era connection gets `-32601`
+even if a handler is registered, and sending an era-mismatched spec method (e.g.
+`server/discover` toward a 2025-era peer, or `ping` toward a 2026-era peer) throws
 `SdkError(MethodNotSupportedByProtocolVersion)` before anything reaches the transport.
 
+The one exception is the Tasks extension (SEP-2663), which keeps two names the
+2025-11-25 revision had in core: `tasks/get` and `tasks/cancel`. A handler registered
+for them with an explicit schema (`setRequestHandler('tasks/get', { params, result },
+handler)`) is served, and a request sent with an explicit result schema
+(`request({ method: 'tasks/get', params }, resultSchema)`) is sent, on every era. With
+no handler, or with a method-keyed handler, they still get `-32601`. If one factory
+serves both eras and such a handler is meant for 2025-era clients only, register it only
+when `ctx.era === 'legacy'`; otherwise it answers 2026-07-28 requests too.
+
 If you were on a v2 alpha and consumed wire schemas directly:
 
 | v2-alpha pattern                                                                             | Mechanical fix                                                                                             |
@@ -700,9 +709,13 @@ methods at compile time. `ResultTypeMap['tools/call']` is plain `CallToolResult`
 maps still carry the `tasks/*` entries and the `CreateTaskResult` unions; narrow with
 the `isCallToolResult` guard if you are pinned to one of those alphas. `2.0.0-alpha.4`
 and later include the exclusion.) Where
-task interop is genuinely required, use the explicit-schema custom-method form
-(`request({ method: 'tasks/get', params }, GetTaskResultSchema)`). Inbound `tasks/*`
-requests → `-32601`.
+task interop is genuinely required, use the explicit-schema custom-method form on both
+sides: `request({ method: 'tasks/get', params }, resultSchema)` to send and
+`setRequestHandler('tasks/get', { params, result }, handler)` to serve, with the schemas
+of the revision you are talking to (`GetTaskResultSchema` is the 2025-11-25 shape). On a
+2026-era connection only `tasks/get` and `tasks/cancel`, the two names the Tasks
+extension keeps, are served and sent this way; `tasks/result` and `tasks/list` stay
+refused there. With no handler registered, inbound `tasks/*` requests get `-32601`.
 
 The experimental tasks **interception** layer is removed entirely — see
 [upgrade-to-v2.md › Experimental tasks interception removed](./upgrade-to-v2.md#experimental-tasks-interception-removed).
```

**File**: `packages/core-internal/src/shared/protocol.ts` (modified, +27/-3)
```diff
@@ -50,7 +50,14 @@ import type { StandardSchemaV1 } from '../util/standardSchema';
 import { isStandardSchema, validateStandardSchema } from '../util/standardSchema';
 import { bootstrapOutboundCodec } from '../wire/bootstrap';
 import type { LiftedWireMaterial, WireCodec } from '../wire/codec';
-import { classifiedWireEra, codecForVersion, isSpecNotificationMethod, isSpecRequestMethod, MODERN_WIRE_REVISION } from '../wire/codec';
+import {
+    classifiedWireEra,
+    codecForVersion,
+    isExtensionReusedRequestMethod,
+    isSpecNotificationMethod,
+    isSpecRequestMethod,
+    MODERN_WIRE_REVISION
+} from '../wire/codec';
 import { manualInputRequiredValue, partitionInputResponses } from './inputRequiredEngine';
 import type { Transport, TransportSendOptions } from './transport';
 
@@ -559,6 +566,8 @@ export abstract class Protocol<ContextT extends BaseContext> {
     private _transport?: Transport;
     private _requestMessageId = 0;
     private _requestHandlers: Map<string, (request: JSONRPCRequest, ctx: ContextT) => Promise<Result>> = new Map();
+    /** Methods registered with an explicit schema; the era gate in `_onrequest` reads it for the Tasks extension names. */
+    private _customSchemaRequestMethods = new Set<string>();
     private _requestHandlerAbortControllers: Map<RequestId, AbortController> = new Map();
     private _notificationHandlers: Map<string, (notification: JSONRPCNotification, codec: WireCodec) => Promise<void>> = new Map();
     private _responseHandlers: Map<number, (response: JSONRPCResultResponse | Error) => void> = new Map();
@@ -1000,7 +1009,12 @@ export abstract class Protocol<ContextT extends BaseContext> {
         // shadow a deleted spec method across eras). Methods outside the
         // spec universe are consumer-owned extension methods and stay
         // era-blind.
-        if (isSpecRequestMethod(request.method) && !codec.hasRequestMethod(request.method)) {
+        // Exception: the Tasks extension names (SEP-2663), when registered with an explicit schema.
+        if (
+            isSpecRequestMethod(request.method) &&
+            !codec.hasRequestMethod(request.method) &&
+            !(isExtensionReusedRequestMethod(request.method) && this._customSchemaRequestMethods.has(request.method))
+        ) {
             sendErrorResponse(ProtocolErrorCode.MethodNotFound, 'Method not found');
             return;
         }
@@ -1270,10 +1284,12 @@ export abstract class Protocol<ContextT extends BaseContext> {
     ): Promise<StandardSchemaV1.InferOutput<T>>;
     request(request: Request, schemaOrOptions?: StandardSchemaV1 | RequestOptions, maybeOptions?: RequestOptions): Promise<unknown> {
         const codec = this._resolveOutboundCodec(request.method);
-        this._assertOutboundRequestInEra(codec, request.method);
         if (isStandardSchema(schemaOrOptions)) {
+            // Only the Tasks extension names skip the era gate here; every other spec method stays gated.
+            if (!isExtensionReusedRequestMethod(request.method)) this._assertOutboundRequestInEra(codec, request.method);
             return this._requestWithSchemaViaCodec(codec, request, schemaOrOptions, maybeOptions);
         }
+        this._assertOutboundRequestInEra(codec, request.method);
         const validate = codecResultValidator(codec, request.method);
         if (validate === undefined) {
             throw new TypeError(`'${request.method}' is not a spec method; pass a result schema as the second argument to request().`);
@@ -1751,6 +1767,13 @@ export abstract class Protocol<ContextT extends BaseContext> {
             throw new TypeError('setRequestHandler: handler is required');
         }
 
+        // The era gate reads how the handler was registered; a method-keyed re-registration ends the exemption.
+        if (typeof schemasOrHandler === 'function') {
+            this._customSchemaRequestMethods.delete(method);
+        } else {
+            this._customSchemaRequestMethods.add(method);
+        }
+
         this._requestHandlers.set(method, this._wrapHandler(method, stored));
     }
 
@@ -1787,6 +1810,7 @@ export abstract class Protocol<ContextT extends BaseContext> {
      */
     removeRequestHandler(method: RequestMethod | string): void {
         this._requestHandlers.delete(method);
+        this._customSchemaRequestMethods.delete(method);
     }
 
     /**
```

**File**: `packages/core-internal/src/wire/codec.ts` (modified, +7/-1)
```diff
@@ -33,9 +33,10 @@
  * Custom-handler shadowing policy (both directions): a method that belongs to
  * the SPEC-METHOD UNIVERSE — the union of every codec's registry, derived,
  * not hand-curated — is ALWAYS era-gated, so a custom handler registered for
- * a deleted spec method (e.g. `tasks/get`) serves it only on the era that
+ * a deleted spec method (e.g. `tasks/result`) serves it only on the era that
  * defines it. Methods outside the universe are consumer-owned extension
  * methods: they are era-blind and require explicit schemas, exactly as today.
+ * Exception: `isExtensionReusedRequestMethod`, the Tasks extension names sent or served with an explicit schema.
  *
  * Everything in `wire/` is internal to the bundled, `private: true` core —
  * nothing per-revision is public surface, and nothing here may ever be
@@ -335,4 +336,9 @@ export function isSpecNotificationMethod(method: string): boolean {
     return ALL_CODECS.some(codec => codec.hasNotificationMethod(method));
 }
 
+/** The names SEP-2663 re-defines for the Tasks extension on the era that removed them from core. */
+export function isExtensionReusedRequestMethod(method: string): boolean {
+    return method === 'tasks/get' || method === 'tasks/cancel';
+}
+
 const ALL_CODECS: readonly WireCodec[] = [rev2025Codec, rev2026Codec];
```

**File**: `packages/core-internal/test/wire/eraGates.test.ts` (modified, +191/-8)
```diff
@@ -11,9 +11,13 @@
  * Registry membership is the deletion story, and these tests prove it at the
  * protocol funnels, in both directions:
  *
- *  - inbound: `tasks/get` on a modern-era instance gets −32601 BY ABSENCE —
- *    even with a handler registered (a custom handler cannot shadow a
- *    deleted spec method across eras); era-deleted spec notifications are
+ *  - inbound: a handler cannot shadow a deleted spec method across eras —
+ *    `ping` on a modern-era instance still answers −32601 BY ABSENCE, with
+ *    or without an explicit schema. The one exception (issue #2598): the
+ *    Tasks extension, SEP-2663, keeps `tasks/get` and `tasks/cancel` after
+ *    2026-07-28 moved tasks out of core, so an EXPLICIT-SCHEMA handler
+ *    (`setRequestHandler(method, schemas, handler)`) for those two names is
+ *    served on a modern-era instance. Era-deleted spec notifications are
  *    silently dropped even with a handler registered.
  *  - outbound: an era-mismatched spec method dies locally with
  *    `SdkErrorCode.MethodNotSupportedByProtocolVersion` before anything
@@ -109,31 +113,161 @@ const resultOf = (msg: JSONRPCMessage | undefined) => (msg as { result?: Record<
 
 describe('inbound era gates — deletions are physical, era is instance state', () => {
     const registerTasksGetHandler = (onRun: () => void) => (receiver: TestProtocol) => {
-        // A custom (3-arg) handler deliberately shadowing the deleted
-        // spec method: it may serve the 2025 era only.
+        // An explicit-schema (3-arg) handler for a name the Tasks extension
+        // keeps (#2598): it is served on every era.
         receiver.setRequestHandler('tasks/get', { params: z.looseObject({ taskId: z.string() }) }, () => {
             onRun();
             return {} as Result;
         });
     };
 
-    test('a modern-era instance answers tasks/get with −32601 BY ABSENCE even with a handler registered', async () => {
+    test('a modern-era instance still serves tasks/get through an explicit-schema handler (#2598)', async () => {
         let handlerRan = false;
         const h = await harness({ era: '2026-07-28', setup: registerTasksGetHandler(() => (handlerRan = true)) });
 
         // A matching modern classification rides along untouched — the
-        // handoff check accepts it; the era gate still answers by absence.
+        // handoff check accepts it; the era gate no longer answers by
+        // absence when an explicit-schema handler is registered.
+        h.deliver(
+            { jsonrpc: '2.0', id: 1, method: 'tasks/get', params: { taskId: 't-1', _meta: { ...ENVELOPE } } } as JSONRPCMessage,
+            MODERN
+        );
+        await h.flush();
+
+        expect(handlerRan).toBe(true);
+        expect(resultOf(h.sent[0])).toBeDefined();
+    });
+
+    test('a modern-era instance still answers −32601 BY ABSENCE for a deleted spec method with no handler registered', async () => {
+        const h = await harness({ era: '2026-07-28' });
+
         h.deliver(
             { jsonrpc: '2.0', id: 1, method: 'tasks/get', params: { taskId: 't-1', _meta: { ...ENVELOPE } } } as JSONRPCMessage,
             MODERN
         );
         await h.flush();
 
-        expect(handlerRan).toBe(false);
         expect(h.sent).toHaveLength(1);
         expect(errorOf(h.sent[0])).toMatchObject({ code: -32601, message: 'Method not found' });
     });
 
+    // The built-in `ping` handler (registered via the typed 2-arg overload
+    // in the `Protocol` constructor) demonstrates the typed path stays fully
+    // era-gated — see 'ping on a modern-era instance is −32601 by absence'
+    // below.
+
+    test('a modern-era instance serves tasks/cancel through an explicit-schema handler too (#2598)', async () => {
+        let handlerRan = false;
+        const h = await harness({
+            era: '2026-07-28',
+            setup: receiver =>
+                receiver.setRequestHandler('tasks/cancel', { params: z.looseObject({ taskId: z.string() }) }, () => {
+                    handlerRan = true;
+                    return {} as Result;
+                })
+        });
+
+        h.deliver(
+            { jsonrpc: '2.0', id: 1, method: 'tasks/cancel', params: { taskId: 't-1', _meta: { ...ENVELOPE } } } as JSONRPCMessage,
+            MODERN
+        );
+        await h.flush();
+
+        expect(handlerRan).toBe(true);
+        expect(resultOf(h.sent[0])).toBeDefined();
+    });
+
+    test.each(['ping', 'initialize', 'logging/setLevel', 'resources/subscribe', 'tasks/result', 'tasks/list'])(
+        'the exemption is for the Tasks extension names only: an explicit-schema handler for %s stays −32601 on the modern era',
+        async method => {
+            let handlerRan = false;
+            const h = await harness({
+                era: '2026-07-28',
+                setup: receiver =>
+                    receiver.setRequestHandler(method, { params: z.looseObject({}) }, () => {
+                        ha
```

---

### Incident Patch 15: `7f4c12a6` (2026-09-29)
**Commit Message**: fix(node): make hono a regular dependency (#2897)

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `.changeset/node-hono-regular-dependency.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@modelcontextprotocol/node': patch
+---
+
+`hono` is now a regular dependency of `@modelcontextprotocol/node`, so installs with strict peer-dependency checking no longer fail on the `hono` peer that `@hono/node-server` requires. No runtime change.
```

**File**: `docs/migration/upgrade-to-v2.md` (modified, +3/-3)
```diff
@@ -207,9 +207,9 @@ The framework adapter packages declare their framework as a **peer dependency**
 (`express`, `hono`, `fastify`); v1 shipped them as direct deps. The codemod adds the
 `@modelcontextprotocol/*` packages your imports use, but does not add the framework
 peer — install it explicitly (`pnpm add express` etc.). `@modelcontextprotocol/node`
-depends on `@hono/node-server` at runtime (Node HTTP ↔ Web Standard conversion) but
-does **not** require the `hono` framework — your package manager may emit a harmless
-unmet-peer warning for `hono` (upstream `@hono/node-server` declares it).
+depends on `@hono/node-server` at runtime (Node HTTP ↔ Web Standard conversion) and
+installs `hono` as a regular dependency only because `@hono/node-server` requires it as
+a peer — the adapter does not use the `hono` framework itself.
 
 v2 requires **Node.js 20+**. It is ESM-first but ships a **CommonJS build alongside
 ESM**, so CommonJS projects can `require('@modelcontextprotocol/…')` directly — no
```

**File**: `packages/middleware/node/package.json` (modified, +3/-8)
```diff
@@ -49,16 +49,11 @@
         "test:watch": "vitest"
     },
     "dependencies": {
-        "@hono/node-server": "catalog:runtimeServerOnly"
-    },
-    "peerDependencies": {
-        "@modelcontextprotocol/server": "workspace:^",
+        "@hono/node-server": "catalog:runtimeServerOnly",
         "hono": "catalog:runtimeServerOnly"
     },
-    "peerDependenciesMeta": {
-        "hono": {
-            "optional": true
-        }
+    "peerDependencies": {
+        "@modelcontextprotocol/server": "workspace:^"
     },
     "devDependencies": {
         "@modelcontextprotocol/server": "workspace:^",
```

**File**: `packages/middleware/node/test/packageManifest.test.ts` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+import { readFileSync } from 'node:fs';
+import { dirname, join } from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+import { describe, expect, it } from 'vitest';
+
+interface PackageManifest {
+    dependencies?: Record<string, string>;
+    peerDependencies?: Record<string, string>;
+    peerDependenciesMeta?: Record<string, { optional?: boolean }>;
+}
+
+const manifestPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
+const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as PackageManifest;
+
+describe('package manifest', () => {
+    // Regression test for https://github.com/modelcontextprotocol/typescript-sdk/issues/2882:
+    // `@hono/node-server` declares `hono` as a required peer. If this package only lists
+    // `hono` as an optional peer, strict pnpm installs fail with ERR_PNPM_PEER_DEP_ISSUES.
+    it('declares hono as a regular dependency to satisfy the @hono/node-server peer', () => {
+        expect(manifest.dependencies).toHaveProperty('@hono/node-server');
+        expect(manifest.dependencies).toHaveProperty('hono');
+    });
+
+    it('does not declare hono as a peer dependency', () => {
+        expect(manifest.peerDependencies ?? {}).not.toHaveProperty('hono');
+        expect(manifest.peerDependenciesMeta ?? {}).not.toHaveProperty('hono');
+    });
+});
```

#### Recent Merged Pull Requests:
- **PR #2958** (2026-10-05): [v1.x] fix: allow registering after connect() when the capability was declared (@claude[bot])
- **PR #2956** (2026-10-05): ci: skip the Publish job when every version is already on npm (@claude[bot])
- **PR #2955** (2026-10-05): docs: one opening note in the server and client package READMEs (@claude[bot])
- **PR #2954** (2026-10-05): chore: bump version to 1.32.1 (@claude[bot])
- **PR #2953** (2026-10-05): Version Packages (@github-actions[bot])
- **PR #2952** (2026-10-05): feat(server-legacy): add expectedResource to requireBearerAuth (@claude[bot])
- **PR #2942** (2026-10-05): [v1.x] docs: point the README at v2 and say what v1.x supports (@claude[bot])
- **PR #2940** (2026-10-05): docs: update the README banners (@claude[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
