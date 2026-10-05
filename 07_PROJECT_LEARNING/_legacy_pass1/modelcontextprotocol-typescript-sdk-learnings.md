# Forensic Learning Record (Deep Inspection): modelcontextprotocol/typescript-sdk

> **Canonical Artifact**: `07_PROJECT_LEARNING/modelcontextprotocol-typescript-sdk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:34:08.474Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `modelcontextprotocol/typescript-sdk`
- **Description**: The official TypeScript SDK for Model Context Protocol servers and clients
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 13492 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `common/eslint-config/eslint.config.mjs`
```
// @ts-check
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import importPlugin from 'eslint-plugin-import';
import nodePlugin from 'eslint-plugin-n';
import simpleImportSortPlugin from 'eslint-plugin-simple-import-sort';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import { configs } from 'typescript-eslint';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(
    eslint.configs.recommended,
    ...configs.recommended,
    importPlugin.flatConfigs.recommended,
    importPlugin.flatConfigs.typescript,
    eslintPluginUnicorn.configs.recommended,
    {
        languageOptions: {
            parserOptions: {
                // Ensure consumers of this shared config get a stable tsconfig root
                tsconfigRootDir: __dirname
            }
        },
        linterOptions: {
            reportUnusedDisableDirectives: false
        },
        plugins: {
            n: nodePlugin,
            'simple-import-sort': simpleImportSortPlugin
        },
        settings: {
            'import/resolver': {
                typescript: {
                    // Resolve extensionless relative imports (moduleResolution: bundler) to their TS sources
                    extensions: ['.js', '.jsx', '.ts', '.tsx', '.d.ts'],
                    // Use the tsconfig in each package root (when running ESLint from that package)
                    project: 'tsconfig.json'
                }
            }
        },
        rules: {
            'unicorn/prevent-abbreviations': 'off',
            'unicorn/no-null': 'off',
            'unicorn/prefer-add-event-listener': 'off',
            'no-restricted-syntax': [
                'error',
                {
                    selector:
                        ":matches(CallExpression[callee.property.name='includes'], CallExpression[callee.property.name='indexOf'], " +
                        "CallExpression[callee.property.name='startsWith'])[arguments.0.value='application/json']",
                    message:
                        "Substring-matching 'application/json' misclassifies Content-Type values whose media type is different " +
                        "(e.g. 'text/plain; a=application/json') and mishandles parameters and case. " +
                        'Parse the media type instead: isJsonContentType() from core-internal.'
                }
            ],
            'unicorn/no-useless-undefined': ['error', { checkArguments: false }],
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            'n/prefer-node-protocol': 'error',
            '@typescript-eslint/consistent-type-imports': ['error', { disallowTypeAnnotations: false }],
            'simple-import-sort/imports': 'warn',
            'simple-import-sort/exports': 'warn',
            'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
            'import/no-extraneous-dependencies': [
                'error',
                {
                    devDependencies: [
                        '**/test/**',
                        '**/*.test.ts',
                        '**/*.test.tsx',
                        '**/scripts/**',
                        '**/vitest.config.*',
                        '**/tsdown.config.*',
                        '**/eslint.config.*',
                        '**/vitest.setup.*'
                    ],
                    optionalDependencies: false,
                    peerDependencies: true
                }
            ],
            'unicorn/filename-case': [
                'error',
                {
                    case: 'camelCase'
                }
            ]
        }
    },
    {
        // Disable consistent-function-scoping in test files where helper functions are common
        files: ['**/*.test.ts', '**/*.test.tsx', '**/test/**'],
        rules: {
            'unicorn/consistent-function-scoping': 'off'
        }
    },
    {
        // Example files contain intentionally unused functions (one per region)
        files: ['**/*.examples.ts'],
        rules: {
            '@typescript-eslint/no-unused-vars': 'off',
            'no-console': 'off'
        }
    },
    {
        // Ignore build artifacts everywhere (mirrors .prettierignore). A flat-config
        // object with only `ignores` is a global ignore; ESLint does not skip dist by default.
        ignores: ['**/dist/**', '**/build/**', '**/coverage/**']
    },
    {
        // Ignore generated protocol types everywhere
        ignores: ['**/spec.types.2025-11-25.ts', '**/spec.types.2026-07-28.ts']
    },
    {
        files: ['packages/client/**/*.ts', 'packages/server/**/*.ts'],
        ignores: ['**/*.test.ts'],
        rules: {
            'no-console': 'error'
        }
    },
    eslintConfigPrettier
);

```

### Core Architecture Module: `examples/bearer-auth-web/client.ts`
```
/**
 * Asserts a bare request is `401` with a `WWW-Authenticate` challenge (parsed
 * with the SDK's `extractWWWAuthenticateParams`), and that a request with
 * `Authorization: Bearer demo-token` reaches the `whoami` tool with the
 * verified `authInfo`.
 */
import { check, parseExampleArgs } from '@mcp-examples/shared';
import { Client, extractWWWAuthenticateParams, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const { url, era } = parseExampleArgs();

// Unauthenticated → 401 + WWW-Authenticate.
const unauth = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' })
});
check.equal(unauth.status, 401);
check.equal(extractWWWAuthenticateParams(unauth).error, 'invalid_token');

// Authenticated → 200 and the tool sees the authInfo. Bearer auth is
// HTTP-layer and era-agnostic; the client honours `--legacy` via `era`.
const client = new Client(
    { name: 'bearer-auth-web-example-client', version: '1.0.0' },
    { versionNegotiation: { mode: era === 'modern' ? 'auto' : 'legacy' } }
);
await client.connect(new StreamableHTTPClientTransport(new URL(url), { authProvider: { token: async () => 'demo-token' } }));

const result = await client.callTool({ name: 'whoami', arguments: {} });
check.equal(result.content?.[0]?.type === 'text' ? result.content[0].text : '', 'client=demo-client');

await client.close();

```

### Core Architecture Module: `examples/bearer-auth-web/server.ts`
```
/**
 * The web-standard counterpart of `examples/bearer-auth`: the same
 * Resource-Server-only auth built entirely from `@modelcontextprotocol/server`
 * exports — `requireBearerAuth` gating the MCP handler, behind the same
 * DNS-rebinding guards the Express sibling gets from `createMcpExpressApp` —
 * composed as one `fetch(request)` handler.
 *
 * On Cloudflare Workers, Deno, or Bun that handler is the whole server
 * (`export default { fetch: fetchHandler }`); on Node, `toNodeHandler` bridges
 * it onto `node:http`. HTTP-only by definition.
 */
import { createServer } from 'node:http';

import { parseExampleArgs } from '@mcp-examples/shared';
import { toNodeHandler } from '@modelcontextprotocol/node';
import type { AuthInfo, McpServerFactory, OAuthTokenVerifier } from '@modelcontextprotocol/server';
import {
    createMcpHandler,
    hostHeaderValidationResponse,
    localhostAllowedHostnames,
    localhostAllowedOrigins,
    McpServer,
    OAuthError,
    OAuthErrorCode,
    originValidationResponse,
    requireBearerAuth
} from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

const buildServer: McpServerFactory = ctx => {
    const server = new McpServer({ name: 'bearer-auth-web-example', version: '1.0.0' });
    server.registerTool('whoami', { description: 'Returns the authenticated subject.', inputSchema: z.object({}) }, async () => ({
        content: [{ type: 'text', text: `client=${ctx.authInfo?.clientId ?? 'anon'}` }]
    }));
    return server;
};

const { port } = parseExampleArgs();

// Replace with JWT verification, RFC 7662 introspection, etc.
const staticTokenVerifier: OAuthTokenVerifier = {
    async verifyAccessToken(token): Promise<AuthInfo> {
        if (token !== 'demo-token') {
            throw new OAuthError(OAuthErrorCode.InvalidToken, 'unknown token');
        }
        return { token, clientId: 'demo-client', scopes: ['mcp'], expiresAt: Math.floor(Date.now() / 1000) + 3600 };
    }
};

const gate = requireBearerAuth({ verifier: staticTokenVerifier, requiredScopes: ['mcp'] });
const handler = createMcpHandler(buildServer);

async function fetchHandler(request: Request): Promise<Response> {
    const rejected =
        hostHeaderValidationResponse(request, localhostAllowedHostnames()) ?? originValidationResponse(request, localhostAllowedOrigins());
    if (rejected) {
        return rejected;
    }
    const auth = await gate(request);
    if (auth instanceof Response) {
        return auth;
    }
    return handler.fetch(request, { authInfo: auth });
}

// On a web-standard runtime the composition above is the whole server;
// `toNodeHandler` accepts any `{ fetch }` shape and bridges it onto node:http.
createServer(toNodeHandler({ fetch: fetchHandler })).listen(port, () => {
    console.error(`[server] listening on http://127.0.0.1:${port}/mcp`);
});

```

### Core Architecture Module: `examples/bearer-auth/client.ts`
```
/**
 * Asserts a bare request is `401` with a `WWW-Authenticate` header, and that
 * a request with `Authorization: Bearer demo-token` reaches the `whoami` tool
 * with the verified `authInfo`.
 */
import { check, parseExampleArgs } from '@mcp-examples/shared';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const { url, era } = parseExampleArgs();

// Unauthenticated → 401 + WWW-Authenticate.
const unauth = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' })
});
check.equal(unauth.status, 401);
check.match(unauth.headers.get('www-authenticate') ?? '', /Bearer/);

// Authenticated → 200 and the tool sees the authInfo. Bearer auth is
// HTTP-layer and era-agnostic; the client honours `--legacy` via `era`.
const client = new Client(
    { name: 'bearer-auth-example-client', version: '1.0.0' },
    { versionNegotiation: { mode: era === 'modern' ? 'auto' : 'legacy' } }
);
await client.connect(new StreamableHTTPClientTransport(new URL(url), { authProvider: { token: async () => 'demo-token' } }));

const result = await client.callTool({ name: 'whoami', arguments: {} });
check.equal(result.content?.[0]?.type === 'text' ? result.content[0].text : '', 'client=demo-client');

await client.close();

```

### Core Architecture Module: `examples/bearer-auth/server.ts`
```
/**
 * Minimal Resource-Server-only auth: `requireBearerAuth` + `OAuthTokenVerifier`
 * in front of `createMcpHandler`. The verifier accepts a single static
 * `demo-token`; the verified `authInfo` reaches the factory as `ctx.authInfo`.
 *
 * No Authorization Server here, and no metadata endpoints — see `examples/oauth/`
 * for the full RS + AS discovery flow. HTTP-only by definition.
 */
import { parseExampleArgs } from '@mcp-examples/shared';
import type { OAuthTokenVerifier } from '@modelcontextprotocol/express';
import { createMcpExpressApp, requireBearerAuth } from '@modelcontextprotocol/express';
import { toNodeHandler } from '@modelcontextprotocol/node';
import type { AuthInfo, McpServerFactory } from '@modelcontextprotocol/server';
import { createMcpHandler, McpServer, OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

const buildServer: McpServerFactory = ctx => {
    const server = new McpServer({ name: 'bearer-auth-example', version: '1.0.0' });
    server.registerTool('whoami', { description: 'Returns the authenticated subject.', inputSchema: z.object({}) }, async () => ({
        content: [{ type: 'text', text: `client=${ctx.authInfo?.clientId ?? 'anon'}` }]
    }));
    return server;
};

const { port } = parseExampleArgs();

// Replace with JWT verification, RFC 7662 introspection, etc.
const staticTokenVerifier: OAuthTokenVerifier = {
    async verifyAccessToken(token): Promise<AuthInfo> {
        if (token !== 'demo-token') {
            throw new OAuthError(OAuthErrorCode.InvalidToken, 'unknown token');
        }
        return { token, clientId: 'demo-client', scopes: ['mcp'], expiresAt: Math.floor(Date.now() / 1000) + 3600 };
    }
};

// Bearer auth is HTTP-layer (no stdio arm). The MCP handler is the canonical
// `createMcpHandler(buildServer)`; the Express auth middleware in front of it
// is the point of this story.
const handler = createMcpHandler(buildServer);

const app = createMcpExpressApp();
const auth = requireBearerAuth({ verifier: staticTokenVerifier, requiredScopes: ['mcp'] });
// `requireBearerAuth` sets `req.auth`; `toNodeHandler` reads it and passes it
// to the factory as `ctx.authInfo`.
const node = toNodeHandler(handler);
app.all('/mcp', auth, (req, res) => void node(req, res, req.body));

app.listen(port, () => {
    console.error(`[server] listening on http://127.0.0.1:${port}/mcp`);
});

```

### Core Architecture Module: `examples/caching/client.ts`
```
/**
 * Reads the cache hints emitted on cacheable results (2026-07-28 connections
 * only) and asserts the client honours them: a still-fresh cached entry is
 * served without a round trip.
 */
import { check, parseExampleArgs, siblingPath } from '@mcp-examples/shared';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

interface Cacheable {
    ttlMs?: number;
    cacheScope?: 'public' | 'private';
}

async function callCount(client: Client, name: 'read-count' | 'request-count'): Promise<number> {
    const r = await client.callTool({ name });
    return Number((r.content[0] as { text: string }).text);
}

const { transport, url, era } = parseExampleArgs();

const client = new Client(
    { name: 'caching-example-client', version: '1.0.0' },
    { versionNegotiation: { mode: era === 'modern' ? 'auto' : 'legacy' } }
);

await (transport === 'stdio'
    ? client.connect(new StdioClientTransport({ command: 'npx', args: ['-y', 'tsx', siblingPath(import.meta.url, 'server.ts')] }))
    : client.connect(new StreamableHTTPClientTransport(new URL(url))));

check.equal(client.getNegotiatedProtocolVersion(), '2026-07-28');

// The server stamps `tools/list` with `ttlMs: 30_000, cacheScope: 'public'`.
const tools = (await client.listTools()) as Cacheable & Awaited<ReturnType<typeof client.listTools>>;
check.equal(tools.ttlMs, 30_000);
check.equal(tools.cacheScope, 'public');
// `request-count` proves the wire was reached exactly once.
check.equal(await callCount(client, 'request-count'), 1);

// The second call is served from the response cache: the server-side
// `tools/list` counter is unchanged, and the result is a fresh copy of the
// held entry (so mutating it cannot reach the cache).
const toolsAgain = await client.listTools();
check.deepEqual(
    toolsAgain.tools.map(t => t.name),
    tools.tools.map(t => t.name)
);
check.equal(await callCount(client, 'request-count'), 1);

// `cacheMode: 'refresh'` always fetches and re-stores: the counter moves.
await client.listTools(undefined, { cacheMode: 'refresh' });
check.equal(await callCount(client, 'request-count'), 2);

const resources = (await client.listResources()) as Cacheable & Awaited<ReturnType<typeof client.listResources>>;
check.equal(resources.ttlMs, 5000);
check.equal(resources.cacheScope, 'public');

// `readResource`: the resource handler counts how many times it ran, and
// the `read-count` tool exposes that counter.
const read = (await client.readResource({ uri: 'config://app' })) as Cacheable & Awaited<ReturnType<typeof client.readResource>>;
check.equal(read.ttlMs, 60_000);
check.equal(read.cacheScope, 'private');
check.equal(await callCount(client, 'read-count'), 1);

// Within TTL, default `cacheMode: 'use'` → served from cache; the server
// handler does not run.
await client.readResource({ uri: 'config://app' });
check.equal(await callCount(client, 'read-count'), 1);

// `cacheMode: 'refresh'` always fetches and re-stores.
await client.readResource({ uri: 'config://app' }, { cacheMode: 'refresh' });
check.equal(await callCount(client, 'read-count'), 2);

// After the refresh the entry is fresh again — back to cache-served.
await client.readResource({ uri: 'config://app' });
check.equal(await callCount(client, 'read-count'), 2);

await client.close();

```

### Core Architecture Module: `examples/caching/server.ts`
```
/**
 * Cache hints (`CacheableResult`, protocol revision 2026-07-28).
 *
 * The 2026-07-28 revision requires `ttlMs`/`cacheScope` on the cacheable
 * result types (the list operations and `resources/read`). The values are
 * resolved most-specific-author-first:
 *
 *   1. fields the handler returns on the result itself,
 *   2. a per-registration `cacheHint` (here: the resource's read result),
 *   3. the server-level per-operation `ServerOptions.cacheHints`,
 *   4. the conservative defaults (`ttlMs: 0`, `cacheScope: 'private'`).
 *
 * The fields are emitted ONLY toward 2026-era clients — a 2025-era response
 * is byte-for-byte unchanged. One binary, either transport.
 */
import { serve } from '@hono/node-server';
import { parseExampleArgs } from '@mcp-examples/shared';
import { createMcpHonoApp } from '@modelcontextprotocol/hono';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';

// Module-level (process-wide) counters so the values survive the stateless
// HTTP leg (fresh `buildServer()` per request) as well as stdio's single
// per-connection instance. The client asserts against these to prove a
// cache-served call never reached the server.
let readCount = 0;
let listCount = 0;

function buildServer(): McpServer {
    const server = new McpServer(
        { name: 'caching-example', version: '1.0.0' },
        {
            // Server-level per-operation hints: any list/read result that does not
            // override a field gets these.
            cacheHints: {
                'resources/list': { ttlMs: 5000, cacheScope: 'public' },
                'tools/list': { ttlMs: 30_000, cacheScope: 'public' }
            }
        }
    );

    // A direct resource carrying a per-registration hint that wins for its
    // own resources/read result.
    server.registerResource(
        'app-config',
        'config://app',
        {
            mimeType: 'application/json',
            description: 'Static application config (rarely changes)',
            cacheHint: { ttlMs: 60_000, cacheScope: 'private' }
        },
        async uri => {
            readCount++;
            return { contents: [{ uri: uri.href, mimeType: 'application/json', text: '{"feature":true}' }] };
        }
    );

    // A tool, so tools/list has something to cache.
    server.registerTool('noop', { description: 'no-op' }, async () => ({ content: [{ type: 'text', text: 'ok' }] }));

    // Exposes the server-side `resources/read` invocation count so the client
    // can assert that a cache-served call did not reach the wire.
    server.registerTool('read-count', { description: 'Number of resources/read calls that reached this server' }, async () => ({
        content: [{ type: 'text', text: String(readCount) }]
    }));

    // Exposes the server-side `tools/list` invocation count.
    server.registerTool('request-count', { description: 'Number of tools/list requests that reached this server' }, async () => ({
        content: [{ type: 'text', text: String(listCount) }]
    }));

    // Wrap the auto-generated `tools/list` handler so the example can prove a
    // cache-served `listTools()` never reached the wire. `McpServer` registers
    // the handler lazily on the first `registerTool()`; we re-seat it here so
    // every dispatch increments `listCount` before delegating to the original.
    // (Reaches the underlying request-handler map directly — there is no public
    // wrapper hook; acceptable for an instrumentation example.)
    const handlers = (server.server as unknown as { _requestHandlers: Map<string, (...a: unknown[]) => Promise<unknown>> })
        ._requestHandlers;
    const original = handlers.get('tools/list');
    if (original) {
        handlers.set('tools/list', (...a) => {
            listCount++;
            return original(...a);
        });
    }

    return server;
}

const { transport, port } = parseExampleArgs();

if (transport === 'stdio') {
    void serveStdio(buildServer);
    console.error('[server] serving over stdio');
} else {
    const handler = createMcpHandler(buildServer);
    // `createMcpHonoApp()` binds the endpoint behind localhost host/origin
    // validation by default, matching the framework factories' defaults.
    const app = createMcpHonoApp();
    app.all('/mcp', c => handler.fetch(c.req.raw));
    serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, () => {
        console.error(`[server] listening on http://127.0.0.1:${port}/mcp`);
    });
}

```

### Core Architecture Module: `examples/cli-client/cli.ts`
```
#!/usr/bin/env node
/**
 * The interactive entry point: a chat REPL with no built-in tools — everything comes from the
 * MCP servers in your config. Run it from the repo root:
 *
 *   pnpm --filter @mcp-examples/cli-client start                       # sibling todos-server, scripted provider
 *   ANTHROPIC_API_KEY=… pnpm --filter @mcp-examples/cli-client start -- --provider anthropic
 *   pnpm --filter @mcp-examples/cli-client start -- --config ./config.json --provider openai
 *   pnpm --filter @mcp-examples/cli-client start -- --server https://mcp.linear.app/mcp     # one ad-hoc server, OAuth if needed
 */
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';

import type { CliClientConfig } from './host/config';
import { configFromTargets, readConfigFile, todosServerConfig } from './host/config';
import { McpHost } from './host/host';
import { createSession, handleUserInput } from './host/loop';
import { createCompleter, ReadlineUI } from './host/ui';
import { AnthropicProvider } from './providers/anthropic';
import { GeminiProvider } from './providers/gemini';
import { OpenAIProvider } from './providers/openai';
import type { LLMProvider } from './providers/provider';
import { ScriptedProvider } from './providers/scripted';

const USAGE = `usage: tsx cli.ts [options]
  --server <target>       connect to just this server: an http(s) URL (OAuth on demand) or a stdio command line (repeatable)
  --config <path>         mcpServers config file (default: ./config.json, falling back to spawning the sibling todos-server)
  --provider <name>       scripted | anthropic | openai | gemini (default: first one with an API key in the env, else scripted)
  --model <id>            pin a model id (default: the provider's latest mid-tier model)
  --root <path>           workspace root exposed to servers via roots/list (repeatable; default: cwd)
  --callback-port <n>     fixed loopback port for the OAuth callback (default: a free port; set this when port-forwarding over SSH)
  --legacy                use the 2025 initialize handshake instead of probing for 2026-07-28
  --protocol-version <v>  negotiate exactly this revision: 2025-era values (e.g. 2025-06-18) via the legacy handshake, 2026-07-28+ via a modern pin
  --help                  this help`;

function pickProvider(name: string | undefined, model: string | undefined): LLMProvider {
    const chosen =
        name ??
        (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN
            ? 'anthropic'
            : process.env.OPENAI_API_KEY
              ? 'openai'
              : process.env.GEMINI_API_KEY
                ? 'gemini'
                : 'scripted');
    switch (chosen) {
        case 'anthropic': {
            return new AnthropicProvider(model);
        }
        case 'openai': {
            return new OpenAIProvider(model);
        }
        case 'gemini': {
            return new GeminiProvider(model);
        }
        case 'scripted': {
            return new ScriptedProvider();
        }
        default: {
            throw new Error(`Unknown provider "${chosen}" (expected scripted | anthropic | openai | gemini)`);
        }
    }
}

const { values } = parseArgs({
    // `pnpm … start -- --provider anthropic` forwards the literal `--`; drop it so only flags remain.
    args: process.argv.slice(2).filter(argument => argument !== '--'),
    options: {
        server: { type: 'string', multiple: true },
        config: { type: 'string' },
        provider: { type: 'string' },
        model: { type: 'string' },
        root: { type: 'string', multiple: true },
        'callback-port': { type: 'string' },
        legacy: { type: 'boolean' },
        'protocol-version': { type: 'string' },
        help: { type: 'boolean', short: 'h' }
    }
});

if (values.help) {
    console.log(USAGE);
    process.exit(0);
}

// Tab completion needs the host's cached lists, but the host needs the UI — resolve lazily.
const hostRef: { current?: McpHost } = {};
const ui = new ReadlineUI(
    createInterface({ input: process.stdin, output: process.stdout, completer: createCompleter(() => hostRef.current) })
);
const provider = pickProvider(values.provider, values.model);

let config: CliClientConfig;
let configSource: string;
if (values.server && values.server.length > 0) {
    configSource = '--server arguments';
    config = configFromTargets(values.server);
} else if (values.config) {
    configSource = values.config;
    config = await readConfigFile(values.config);
} else if (existsSync('./config.json')) {
    configSource = './config.json';
    config = await readConfigFile('./config.json');
} else {
    configSource = 'sibling todos-server (no config.json found — see config.example.json)';
    config = todosServerConfig();
}

// Show exactly what we are about to connect to before doing it.
ui.status(`config: ${configSource}`);
for (const [serverName, entry] of Object.entries(config.mcpServers)) {
    ui.status(`  ${serverName} → ${'url' in entry ? entry.url : [entry.command, ...(entry.args ?? [])].join(' ')}`);
}

let host: McpHost;
try {
    host = new McpHost({
        ui,
        provider,
        roots: values.root ?? [process.cwd()],
        legacy: values.legacy ?? false,
        protocolVersion: values['protocol-version'],
        oauthCallbackPort: values['callback-port'] ? Number.parseInt(values['callback-port'], 10) : undefined
    });
    hostRef.current = host;
    await host.connect(config);
} catch (error) {
    ui.print(error instanceof Error ? error.message : String(error));
    ui.close();
    process.exit(1);
}

if (provider.name === 'scripted') {
    ui.status(
        'provider: scripted (no API key found — replies are canned; set ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY or pass --provider)'
    );
} else {
    ui.status(`provider: ${provider.name}`);
}
ui.print('cli-client ready — say hi for a tour, /help for commands, /quit to exit.');

const chat = createSession(host, provider, ui);
try {
    for (;;) {
        const input = await ui.readUserInput();
        try {
            const result = await handleUserInput(chat, input);
            if (result === 'exit') break;
        } catch (error) {
            // A provider hiccup or a server error should cost one turn, not the whole session.
            ui.status(`error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
} finally {
    await host.close();
    ui.close();
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

### Incident Patch 1: `433eb413` (2026-09-30)
**Commit Message**: fix(client): follow redirects only within the origin of the request (#2901)

Co-authored-by: Felix Weinberger <3823880+felixweinberger@users.noreply.github.com>

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
             'Content
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
         // transport-managed headers on top. `Headers.set` compares na
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
+        const text = this._redirectPolicy === 'follow' ? undefined : unfollowedRedirect
```

---

### Incident Patch 2: `c0cd01a2` (2026-09-30)
**Commit Message**: fix(client): retry the SSE connection once after onUnauthorized (#2905)

Co-authored-by: Felix Weinberger <3823880+felixweinberger@users.noreply.github.com>
Co-authored-by: Claude <noreply@anthropic.com>

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
    
```

---

### Incident Patch 3: `9350fe0d` (2026-09-30)
**Commit Message**: fix(spec): freeze 2026-07-28 release references (#2858)

Co-authored-by: Felix Weinberger <3823880+felixweinberger@users.noreply.github.com>

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
-                    echo "PR #$EXISTING_PR already exists, up
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
+    `schema/<dir>/schema.json` from that twin's recorded source commit and update `manifest.json` in the same change; the spec example corpus manifest (`test/corpus/fixtures/<revision>/m
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
+ * {@includeCode ./examples/Subsc
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

---

### Incident Patch 4: `e765b3be` (2026-09-30)
**Commit Message**: fix(client): say so when the version probe gets an unusable reply (#2903)

Co-authored-by: Felix Weinberger <3823880+felixweinberger@users.noreply.github.com>
Co-authored-by: Claude <noreply@anthropic.com>

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

---

### Incident Patch 5: `2237555e` (2026-09-30)
**Commit Message**: Typecheck the three test workspace packages, and fix the registerPrompt typing defect they were hiding (#2841)

Signed-off-by: Sharvil Saxena <sharvil.saxena@gmail.com>
Co-authored-by: Felix Weinberger <3823880+felixweinberger@users.noreply.github.com>

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

---

### Incident Patch 6: `5238fba4` (2026-09-30)
**Commit Message**: fix(core): serve tasks/get and tasks/cancel on 2026-07-28 with an explicit schema (#2599)

Co-authored-by: freya0926 <299410795+freya0926@users.noreply.github.com>
Co-authored-by: Felix Weinberger <3823880+felixweinberger@users.noreply.github.com>

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
+            this._customSchemaRequestMethods.add(
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
+                receiver.setRequestHandler('tasks/cancel', { params: z.looseObject({ taskId
```

---

### Incident Patch 7: `7f4c12a6` (2026-09-29)
**Commit Message**: fix(node): make hono a regular dependency (#2897)

Co-authored-by: Claude <noreply@anthropic.com>

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

---

### Incident Patch 8: `4d94e7b1` (2026-09-29)
**Commit Message**: fix(server): convert tool schemas on demand, not at registration (#2889)

Co-authored-by: Claude <noreply@anthropic.com>
Co-authored-by: Felix Weinberger <3823880+felixweinberger@users.noreply.github.com>

**File**: `.changeset/lazy-tool-schema-conversion.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@modelcontextprotocol/server': patch
+---
+
+`registerTool` no longer converts tool schemas up front, so a server built per request stops converting every tool on every request. The warning about an invalid `x-mcp-header` declaration now appears each time tools are listed, not when the tool is registered.
```

**File**: `docs/migration/upgrade-to-v2.md` (modified, +1/-1)
```diff
@@ -672,7 +672,7 @@ codemod inverts the common nesting automatically and flags shapes it cannot rewr
 **Zod v3 is no longer supported** (v1 peer was `^3.25 || ^4.0`). Check the **declared
 range** in your `package.json`, not just the installed version: a zod-3 range that
 satisfied the v1 peer installs and typechecks cleanly under v2 and only fails at
-runtime — and quietly: registration swallows the conversion failure, the server starts
+runtime — and quietly: registration does not convert the schema, the server starts
 and connects normally, and the first `tools/list` (so `client.listTools()`) answers
 with an error pointing at `fromJsonSchema()` while the process keeps running. (Only the
 deprecated unwrapped raw-shape form with zod-3 field values throws at registration,
```

**File**: `packages/server/src/server/mcp.ts` (modified, +24/-45)
```diff
@@ -77,12 +77,7 @@ export class McpServer {
     } = {};
     private _registeredTools: { [name: string]: RegisteredTool } = {};
     private _registeredPrompts: { [name: string]: RegisteredPrompt } = {};
-    /**
-     * Per-tool JSON-converted `inputSchema`, memoized so the SEP-2243
-     * registration-time scan and the pre-dispatch validation step share one
-     * conversion instead of paying it twice per request under the
-     * per-request-factory `createMcpHandler` model.
-     */
+    /** Per-tool JSON-converted `inputSchema`, filled on first use by `toolInputSchemaJson()`. */
     private _toolInputSchemaJson: { [name: string]: Record<string, unknown> } = {};
 
     /**
@@ -98,15 +93,7 @@ export class McpServer {
         if (tool === undefined || !tool.enabled) return undefined;
         if (Object.hasOwn(this._toolInputSchemaJson, name)) return this._toolInputSchemaJson[name];
         if (tool.inputSchema === undefined) return EMPTY_OBJECT_JSON_SCHEMA;
-        // Lazy path: the memo slot is unset because `registerTool`'s eager
-        // conversion threw (and was swallowed per its "warn, never throw"
-        // contract) or `update({paramsSchema})`/rename invalidated it. The
-        // pre-dispatch SEP-2243 caller must not turn that into a 500 for a
-        // `tools/call` whose body-authoritative dispatch would otherwise
-        // succeed — return `undefined` so validation is skipped and the
-        // conversion failure stays where it always surfaced (`tools/list`).
-        // A successful re-derive is memoized so the per-request-factory
-        // `createMcpHandler` model does not re-convert on every call.
+        // A conversion failure returns `undefined` so it surfaces where it always has (`tools/list`).
         try {
             const json = standardSchemaToJsonSchema(tool.inputSchema, 'input');
             this._toolInputSchemaJson[name] = json;
@@ -238,7 +225,7 @@ export class McpServer {
                             title: tool.title,
                             description: tool.description,
                             inputSchema: tool.inputSchema
-                                ? (standardSchemaToJsonSchema(tool.inputSchema, 'input') as Tool['inputSchema'])
+                                ? (convertListedInputSchema(name, tool.inputSchema) as Tool['inputSchema'])
                                 : EMPTY_OBJECT_JSON_SCHEMA,
                             annotations: tool.annotations,
                             icons: tool.icons,
@@ -889,42 +876,21 @@ export class McpServer {
         // Validate tool name according to SEP specification
         validateAndWarnToolName(name);
 
-        // SEP-2243 registration-time declaration-validity check (additive: warn,
-        // never throw — clients enforce by exclusion, servers by header
-        // validation; a malformed declaration here should not block local
-        // development against a stdio client that ignores it). The conversion
-        // is memoized so the pre-dispatch validation step in `createMcpHandler`
-        // (and `toolInputSchemaJson()`) does not repeat it for the same tool.
-        // `standardSchemaToJsonSchema` can throw for schemas it cannot convert
-        // (e.g. a vendor without `~standard.jsonSchema`); the try/catch keeps
-        // the "warn, never throw" contract.
-        if (inputSchema !== undefined) {
-            try {
-                const json = standardSchemaToJsonSchema(inputSchema, 'input');
-                this._toolInputSchemaJson[name] = json;
-                const scan = scanXMcpHeaderDeclarations(json);
-                if (!scan.valid) {
-                    console.warn(
-                        `[mcp-sdk] tool '${name}' carries an invalid x-mcp-header declaration and will be excluded by ` +
-                            `conforming Streamable HTTP clients: ${scan.reason}`
-                    );
-                }
-            } catch {
-                // Conversion failure: leave
```

**File**: `packages/server/test/server/lazyToolSchemaConversion.test.ts` (added, +172/-0)
```diff
@@ -0,0 +1,172 @@
+/**
+ * `registerTool` converts tool schemas to JSON Schema on demand, not at
+ * registration: `tools/list` converts the schemas it emits, and the memoised
+ * `toolInputSchemaJson()` / `outputSchemaJson` slots fill on first use. A server
+ * built per request therefore no longer converts every tool on every request.
+ */
+import type { StandardSchemaWithJSON } from '@modelcontextprotocol/core-internal';
+import { scanXMcpHeaderDeclarations, standardSchemaToJsonSchema } from '@modelcontextprotocol/core-internal';
+import { afterEach, describe, expect, it, vi } from 'vitest';
+import * as z from 'zod/v4';
+
+import { fromJsonSchema } from '../../src/fromJsonSchema';
+import { invoke } from '../../src/server/invoke';
+import { McpServer } from '../../src/server/mcp';
+
+const LEGACY = { classification: { era: 'legacy' as const } };
+
+type Counted = { schema: StandardSchemaWithJSON; calls: { input: number; output: number } };
+
+/** Wraps a schema so every `~standard.jsonSchema` conversion is counted. */
+function counted(inner: StandardSchemaWithJSON): Counted {
+    const calls = { input: 0, output: 0 };
+    const std = inner['~standard'];
+    const schema = {
+        '~standard': {
+            ...std,
+            jsonSchema: {
+                input: (options: Parameters<typeof std.jsonSchema.input>[0]) => {
+                    calls.input++;
+                    return std.jsonSchema.input(options);
+                },
+                output: (options: Parameters<typeof std.jsonSchema.output>[0]) => {
+                    calls.output++;
+                    return std.jsonSchema.output(options);
+                }
+            }
+        }
+    } as unknown as StandardSchemaWithJSON;
+    return { schema, calls };
+}
+
+const listTools = async (server: McpServer): Promise<{ status: number; body: Record<string, unknown> }> => {
+    const response = await invoke(server, { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }, LEGACY);
+    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
+};
+
+const INVALID_HEADER_SCHEMA = fromJsonSchema({
+    type: 'object',
+    properties: { a: { type: 'object', 'x-mcp-header': 'Data' } as Record<string, unknown> }
+});
+
+describe('lazy tool schema conversion', () => {
+    afterEach(() => {
+        vi.restoreAllMocks();
+    });
+
+    it('registerTool converts neither inputSchema nor outputSchema; tools/list converts both', async () => {
+        const input = counted(z.object({ a: z.string() }));
+        const output = counted(z.object({ b: z.number() }));
+        const server = new McpServer({ name: 'lazy', version: '0' });
+
+        server.registerTool('t', { inputSchema: input.schema, outputSchema: output.schema }, async () => ({ content: [] }));
+        expect(input.calls).toEqual({ input: 0, output: 0 });
+        expect(output.calls).toEqual({ input: 0, output: 0 });
+
+        const { body } = await listTools(server);
+        expect((body.result as { tools: unknown[] }).tools).toHaveLength(1);
+        expect(input.calls).toEqual({ input: 1, output: 0 });
+        expect(output.calls).toEqual({ input: 0, output: 1 });
+    });
+
+    it('toolInputSchemaJson() converts on first use and memoises', () => {
+        const input = counted(z.object({ a: z.string() }));
+        const server = new McpServer({ name: 'lazy', version: '0' });
+        server.registerTool('t', { inputSchema: input.schema }, async () => ({ content: [] }));
+        expect(input.calls.input).toBe(0);
+
+        const first = server.toolInputSchemaJson('t');
+        expect(first).toEqual(standardSchemaToJsonSchema(z.object({ a: z.string() }), 'input'));
+        expect(input.calls.input).toBe(1);
+
+        expect(server.toolInputSchemaJson('t')).toBe(first);
+        expect(input.calls.input).toBe(1);
+    });
+
+    it('outputSchemaJson converts on first read and memoises', () => {
+        const output = counted(z.object(
```

**File**: `packages/server/test/server/lazyToolSchemaConversionRequests.test.ts` (added, +141/-0)
```diff
@@ -0,0 +1,141 @@
+// Regression test for #2838: each request converts only the tool schemas it needs.
+import type { JSONRPCMessage, StandardSchemaWithJSON } from '@modelcontextprotocol/core-internal';
+import {
+    CLIENT_CAPABILITIES_META_KEY,
+    CLIENT_INFO_META_KEY,
+    InMemoryTransport,
+    PROTOCOL_VERSION_META_KEY
+} from '@modelcontextprotocol/core-internal';
+import { describe, expect, it } from 'vitest';
+
+import { createMcpHandler } from '../../src/server/createMcpHandler';
+import { McpServer } from '../../src/server/mcp';
+
+const conversions: string[] = [];
+
+function countingSchema(label: string): StandardSchemaWithJSON {
+    const convert = () => {
+        conversions.push(label);
+        return { type: 'object' as const, properties: { value: { type: 'string' as const } } };
+    };
+    return {
+        '~standard': { version: 1, vendor: 'counting', validate: value => ({ value }), jsonSchema: { input: convert, output: convert } }
+    };
+}
+
+const schemas = [countingSchema('a'), countingSchema('b'), countingSchema('c')];
+const outputOfA = countingSchema('out-a');
+
+function buildServer(): McpServer {
+    const server = new McpServer({ name: 'stateless', version: '0' });
+    for (const [i, inputSchema] of schemas.entries()) {
+        server.registerTool(`tool_${i}`, { inputSchema, ...(i === 0 ? { outputSchema: outputOfA } : {}) }, async () => ({
+            content: [{ type: 'text', text: 'ok' }],
+            structuredContent: { value: 'ok' }
+        }));
+    }
+    return server;
+}
+
+function legacy(method: string, params: Record<string, unknown>): Request {
+    return new Request('http://localhost/mcp', {
+        method: 'POST',
+        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
+        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
+    });
+}
+
+function modern(method: string, params: Record<string, unknown>, name?: string): Request {
+    const envelope = {
+        [PROTOCOL_VERSION_META_KEY]: '2026-07-28',
+        [CLIENT_INFO_META_KEY]: { name: 'c', version: '0' },
+        [CLIENT_CAPABILITIES_META_KEY]: {}
+    };
+    return new Request('http://localhost/mcp', {
+        method: 'POST',
+        headers: {
+            'Content-Type': 'application/json',
+            Accept: 'application/json, text/event-stream',
+            'mcp-protocol-version': '2026-07-28',
+            'mcp-method': method,
+            ...(name === undefined ? {} : { 'mcp-name': name })
+        },
+        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: { ...params, _meta: envelope } })
+    });
+}
+
+async function conversionsFor(request: Request): Promise<string[]> {
+    const handler = createMcpHandler(buildServer);
+    conversions.length = 0;
+    const response = await handler.fetch(request);
+    expect(response.status).toBe(200);
+    expect(await response.text()).toContain('"result"');
+    return [...conversions];
+}
+
+// Connects a 2025-era peer to one long-lived server and returns a function that sends a request and resolves with its result.
+async function connect(server: McpServer) {
+    const [peer, serverSide] = InMemoryTransport.createLinkedPair();
+    const waiters = new Map<unknown, (message: JSONRPCMessage) => void>();
+    peer.onmessage = message => waiters.get((message as { id?: unknown }).id)?.(message);
+    await server.connect(serverSide);
+    await peer.start();
+    let id = 0;
+    const request = (method: string, params: Record<string, unknown>) =>
+        new Promise<Record<string, unknown>>(resolve => {
+            waiters.set(++id, message => resolve((message as { result?: Record<string, unknown> }).result ?? {}));
+            void peer.send({ jsonrpc: '2.0', id, method, params });
+        });
+    await request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'c', version: '0' } });
+    await peer.send({ jsonrpc: '2.0', method: 'no
```

---

### Incident Patch 9: `c55efa62` (2026-09-28)
**Commit Message**: fix(server): close a listen stream that has honored nothing (#2651)

Co-authored-by: Felix Weinberger <3823880+felixweinberger@users.noreply.github.com>

**File**: `.changeset/listen-close-when-nothing-honored.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@modelcontextprotocol/server': patch
+---
+
+`createMcpHandler` now ends a `subscriptions/listen` stream right after the acknowledgement when it honored none of the requested notification types, instead of holding the stream open with nothing to deliver. The client receives the acknowledgement and then the `resultType: "complete"` result. Streams that honor at least one type are unchanged.
```

**File**: `packages/server/src/server/listenRouter.ts` (modified, +6/-0)
```diff
@@ -213,6 +213,12 @@ export function createListenRouter(options: ListenRouterOptions): ListenRouter {
                 );
                 writeNotification(ack.method, ack.params);
 
+                // Nothing honored means nothing can ever be delivered: complete the subscription instead of holding the stream.
+                if (Object.keys(honored).length === 0) {
+                    teardown(true);
+                    return;
+                }
+
                 // Only after the ack frame is enqueued does delivery activate.
                 unsubscribe = bus.subscribe(event => {
                     if (closed || !listenFilterAccepts(honored, event)) return;
```

**File**: `packages/server/test/server/createMcpHandlerListen.test.ts` (modified, +54/-0)
```diff
@@ -264,6 +264,60 @@ describe('createMcpHandler — subscriptions/listen', () => {
         });
     });
 
+    it('acks and closes when capabilities honor nothing, instead of holding the stream', async () => {
+        // A server declaring no listChanged and no resources.subscribe honors
+        // nothing, so the stream can never carry a notification: every
+        // listenFilterAccepts({}, event) is false. It should end, not idle.
+        const bareFactory = () => new McpServer({ name: 'listen-test-server', version: '1.0.0' }, { capabilities: {} });
+        const handler = createMcpHandler(bareFactory, { keepAliveMs: 0 });
+        const response = await handler.fetch(
+            listenRequest(7, { toolsListChanged: true, resourcesListChanged: true, resourceSubscriptions: ['file:///a'] })
+        );
+
+        // Reading the body to its end only resolves when the server ends the stream itself.
+        const body = await response.text();
+        const messages = body
+            .split('\n\n')
+            .filter(frame => frame.length > 0)
+            .map(frame => JSON.parse(frame.slice(frame.indexOf('data: ') + 'data: '.length)) as unknown);
+
+        expect(messages).toEqual([
+            {
+                jsonrpc: '2.0',
+                method: 'notifications/subscriptions/acknowledged',
+                params: { notifications: {}, _meta: { [SUBSCRIPTION_ID_META_KEY]: 7 } }
+            },
+            {
+                jsonrpc: '2.0',
+                id: 7,
+                result: {
+                    resultType: 'complete',
+                    _meta: {
+                        [SUBSCRIPTION_ID_META_KEY]: 7,
+                        'io.modelcontextprotocol/serverInfo': { name: 'listen-test-server', version: '1.0.0' }
+                    }
+                }
+            }
+        ]);
+    });
+
+    it('still holds the stream when at least one type is honored', async () => {
+        // The narrowing must not close a stream that can still deliver: tools
+        // is honored here, resources is not.
+        const partialFactory = () =>
+            new McpServer({ name: 'listen-test-server', version: '1.0.0' }, { capabilities: { tools: { listChanged: true } } });
+        const handler = createMcpHandler(partialFactory, { keepAliveMs: 0 });
+        const response = await handler.fetch(listenRequest(8, { toolsListChanged: true, resourcesListChanged: true }));
+
+        const [ack] = await readMessages(response, 1);
+        expect(ack).toEqual({
+            jsonrpc: '2.0',
+            method: 'notifications/subscriptions/acknowledged',
+            params: { notifications: { toolsListChanged: true }, _meta: { [SUBSCRIPTION_ID_META_KEY]: 8 } }
+        });
+        await handler.close();
+    });
+
     it('legacy-classified listen never reaches the entry listen router (no ack delivered)', async () => {
         const handler = createMcpHandler(trivialFactory(), { keepAliveMs: 0 });
         // No envelope claim → classified legacy → dispatched through the
```

**File**: `test/e2e/scenarios/subscriptions.test.ts` (modified, +1/-1)
```diff
@@ -276,7 +276,7 @@ verifies('subscriptions:listen:capacity-guard', async () => {
                     jsonrpc: '2.0',
                     id,
                     method: 'subscriptions/listen',
-                    params: { _meta: modernEnvelopeMeta(), notifications: {} }
+                    params: { _meta: modernEnvelopeMeta(), notifications: { toolsListChanged: true } }
                 })
             })
         );
```

---

### Incident Patch 10: `edd12e28` (2026-09-28)
**Commit Message**: fix(client): deprecate omitting expectedIssuer and apply the SEP-2352 issuer check consistently (#2887)

Co-authored-by: Felix Weinberger <3823880+felixweinberger@users.noreply.github.com>

**File**: `.changeset/expected-issuer-deprecate-omission.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+---
+'@modelcontextprotocol/client': minor
+'@modelcontextprotocol/core': minor
+---
+
+Constructing `ClientCredentialsProvider`, `PrivateKeyJwtProvider`, `StaticPrivateKeyJwtProvider` or `CrossAppAccessProvider` without `expectedIssuer` is deprecated: the constructor logs one `console.warn` and that call signature is marked `@deprecated`. Behaviour is otherwise unchanged. Pass the `issuer` of the authorization server the credentials were registered with.
+
+`fetchToken()` throws `AuthorizationServerMismatchError`, before sending anything, when the provider's client information is bound to a different authorization server than the one it is called with. The `AuthorizationServerMismatchError` message no longer assumes the authorization-code callback; its fields are unchanged.
+
+`OAuthTokensSchema` and `OAuthClientInformationSchema` accept the optional `issuer` stamp, so a provider that reads storage back through them keeps it. `auth()` overwrites it on every save.
```

**File**: `docs/clients/machine-auth.md` (modified, +7/-6)
```diff
@@ -15,7 +15,8 @@ import { Client, ClientCredentialsProvider, StreamableHTTPClientTransport } from
 
 const authProvider = new ClientCredentialsProvider({
     clientId: 'reporting-job',
-    clientSecret: 'reporting-job-secret'
+    clientSecret: 'reporting-job-secret',
+    expectedIssuer: 'https://auth.example.com'
 });
 
 const client = new Client({ name: 'reporting-job', version: '1.0.0' });
@@ -26,9 +27,7 @@ await client.connect(transport);
 
 `connect` discovers the server's authorization server, posts the grant to its token endpoint, and attaches the access token to every request. On a 401 the provider refreshes the token and the transport retries once. No browser, no end user.
 
-::: tip
-Pass `expectedIssuer` to pin the credential to the authorization server it was registered with. If discovery resolves a different issuer, the SDK throws `AuthorizationServerMismatchError` instead of sending the secret.
-:::
+`expectedIssuer` is the `issuer` of the authorization server the credential was registered with. If discovery resolves a different issuer, the SDK throws `AuthorizationServerMismatchError` instead of sending the secret. `PrivateKeyJwtProvider` and `CrossAppAccessProvider` below take it too; omitting it is deprecated, and the credential then goes to whichever authorization server the MCP server advertises.
 
 ## Bring your own bearer token
 
@@ -50,7 +49,8 @@ The transport calls `token()` before every request and sets the `Authorization`
 const authProvider = new PrivateKeyJwtProvider({
     clientId: 'reporting-job',
     privateKey: pemEncodedKey,
-    algorithm: 'RS256'
+    algorithm: 'RS256',
+    expectedIssuer: 'https://auth.example.com'
 });
 
 const transport = new StreamableHTTPClientTransport(new URL('https://api.example.com/mcp'), { authProvider });
@@ -80,7 +80,8 @@ const authProvider = new CrossAppAccessProvider({
         return grant.jwtAuthGrant;
     },
     clientId: 'reporting-job',
-    clientSecret: 'reporting-job-secret'
+    clientSecret: 'reporting-job-secret',
+    expectedIssuer: 'https://auth.example.com'
 });
 
 const transport = new StreamableHTTPClientTransport(new URL('https://api.example.com/mcp'), { authProvider });
```

**File**: `docs/migration/upgrade-to-v2.md` (modified, +8/-5)
```diff
@@ -1155,6 +1155,7 @@ path will not catch them):
 | RFC 9207 `iss` mismatch / RFC 8414 §3.3 issuer-echo mismatch                                                             | `IssuerMismatchError` (`kind`, `expected`, `received`)                                |
 | Transport 403 `insufficient_scope` with `onInsufficientScope: 'throw'`, or default mode without an `OAuthClientProvider` | `InsufficientScopeError` (`requiredScope`, `resourceMetadataUrl`, `errorDescription`) |
 | `auth()` callback leg: discovery resolves a different AS than the recorded redirect target                               | `AuthorizationServerMismatchError` (`recordedIssuer`, `currentIssuer`)                |
+| `auth()` on a provider that cannot re-register, or `fetchToken()`: client information stamped for a different AS         | `AuthorizationServerMismatchError` (`recordedIssuer`, `currentIssuer`)                |
 
 #### Connect-time OAuth retry (`UnauthorizedError`)
 
@@ -1268,7 +1269,8 @@ same handling as the POST send path.
 `auth()` stamps an `issuer` field onto every value it passes to `saveTokens()` /
 `saveClientInformation()` and threads `{ issuer }` as the `ctx` argument to those
 methods plus `tokens()` / `clientInformation()`. On read, a stored value whose `issuer`
-names a different AS is treated as `undefined` and the flow re-registers / re-authorizes.
+names a different AS is treated as `undefined` and the flow re-registers / re-authorizes
+(or throws `AuthorizationServerMismatchError` when the provider has no `saveClientInformation()`).
 **Round-trip the stored object verbatim and you're protected** — single-slot storage
 works. Dropping the stamp is easy to miss: a `saveTokens()` implementation that
 rebuilds the object field-by-field and drops `issuer` leaves the value unstamped —
@@ -1278,14 +1280,15 @@ re-stamps on first use where the provider can persist it). If you see that warni
 repeating after upgrading, check this first. To hold credentials for several authorization servers at once, key your storage
 on `ctx.issuer` (treat **`ctx === undefined` as "return the most-recently-saved token
 set"** — the transport's per-request `Authorization: Bearer` read calls `tokens()` with
-no `ctx`). New TypeScript-only aliases `StoredOAuthTokens` / `StoredOAuthClientInformation`
-add an optional `issuer?: string` field on top of the wire types.
+no `ctx`). `OAuthTokensSchema` / `OAuthClientInformationSchema` keep the optional `issuer`, so
+reading storage back through them is fine; the `StoredOAuthTokens` / `StoredOAuthClientInformation`
+aliases name the stored shape.
 
 `OAuthClientProvider.saveAuthorizationServerUrl()` / `authorizationServerUrl()` are
 `@deprecated` (still written for back-compat, never read by the SDK). The bundled
 `ClientCredentialsProvider`, `PrivateKeyJwtProvider`, `StaticPrivateKeyJwtProvider`, and
-`CrossAppAccessProvider` gain `expectedIssuer?: string` and no longer define
-`saveClientInformation()`. Implement `discoveryState()` / `saveDiscoveryState()` so the
+`CrossAppAccessProvider` gain `expectedIssuer?: string` (omitting it is deprecated) and no
+longer define `saveClientInformation()`. Implement `discoveryState()` / `saveDiscoveryState()` so the
 callback leg can verify it is exchanging the code at the same AS the redirect targeted;
 without it the SDK `console.warn`s once per callback (`discoveryState` must persist with
 the same durability as `codeVerifier`). Both methods are optional on
```

**File**: `examples/guides/clients/machine-auth.examples.ts` (modified, +6/-3)
```diff
@@ -23,7 +23,8 @@ import { Client, ClientCredentialsProvider, StreamableHTTPClientTransport } from
 
 const authProvider = new ClientCredentialsProvider({
     clientId: 'reporting-job',
-    clientSecret: 'reporting-job-secret'
+    clientSecret: 'reporting-job-secret',
+    expectedIssuer: 'https://auth.example.com'
 });
 
 const client = new Client({ name: 'reporting-job', version: '1.0.0' });
@@ -48,7 +49,8 @@ function privateKeyJwt_provider(pemEncodedKey: string) {
     const authProvider = new PrivateKeyJwtProvider({
         clientId: 'reporting-job',
         privateKey: pemEncodedKey,
-        algorithm: 'RS256'
+        algorithm: 'RS256',
+        expectedIssuer: 'https://auth.example.com'
     });
 
     const transport = new StreamableHTTPClientTransport(new URL('https://api.example.com/mcp'), { authProvider });
@@ -76,7 +78,8 @@ function crossAppAccess_provider(getIdToken: () => Promise<string>) {
             return grant.jwtAuthGrant;
         },
         clientId: 'reporting-job',
-        clientSecret: 'reporting-job-secret'
+        clientSecret: 'reporting-job-secret',
+        expectedIssuer: 'https://auth.example.com'
     });
 
     const transport = new StreamableHTTPClientTransport(new URL('https://api.example.com/mcp'), { authProvider });
```

**File**: `examples/oauth-client-credentials/README.md` (modified, +2/-1)
```diff
@@ -34,7 +34,8 @@ import { PrivateKeyJwtProvider } from '@modelcontextprotocol/client';
 const authProvider = new PrivateKeyJwtProvider({
     clientId: 'my-service',
     privateKey: pemEncodedKey,
-    algorithm: 'RS256'
+    algorithm: 'RS256',
+    expectedIssuer: 'https://auth.example.com'
 });
 ```
 
```

#### Recent Merged Pull Requests:
- **PR #2908** (2026-09-30): chore: set the package license field to Apache-2.0 (@claude[bot])
- **PR #2907** (2026-09-30): feat(server): accept <scheme>://* entries in allowedOrigins (@claude[bot])
- **PR #2906** (closed): ci: watch the spec draft with a nightly refresh PR (@claude[bot])
- **PR #2905** (2026-09-30): fix(client): retry the SSE connection once after onUnauthorized (@claude[bot])
- **PR #2904** (2026-09-30): docs(client): scope the probe unusable-reply wording (@claude[bot])
- **PR #2903** (2026-09-30): fix(client): say so when the version probe gets an unusable reply (@claude[bot])
- **PR #2902** (2026-09-30): [v1.x] fix(client): follow redirects only within the endpoint's origin (@claude[bot])
- **PR #2901** (2026-09-30): fix(client): follow redirects only within the origin of the request (@claude[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
