# Forensic Learning Record (Deep Inspection): zhizhuodemao/js-reverse-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/zhizhuodemao-js-reverse-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zhizhuodemao/js-reverse-mcp](https://github.com/zhizhuodemao/js-reverse-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:39:46.510Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zhizhuodemao/js-reverse-mcp`
- **Description**: AI Agent-first JS 逆向 MCP Server：有头 Chrome 调试、断点、网络/WebSocket 分析、Patchright 反检测，可选 CloakBrowser。
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2863 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `eslint.config.mjs`
```
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import js from '@eslint/js';
import stylisticPlugin from '@stylistic/eslint-plugin';
import {defineConfig, globalIgnores} from 'eslint/config';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import localPlugin from './scripts/eslint_rules/local-plugin.js';

export default defineConfig([
  globalIgnores(['**/node_modules', '**/build/']),
  importPlugin.flatConfigs.typescript,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',

      globals: {
        ...globals.node,
      },

      parserOptions: {
        projectService: {
          allowDefaultProject: ['.prettierrc.cjs', 'eslint.config.mjs'],
        },
      },

      parser: tseslint.parser,
    },

    plugins: {
      js,
      '@local': localPlugin,
      '@typescript-eslint': tseslint.plugin,
      '@stylistic': stylisticPlugin,
    },

    settings: {
      'import/resolver': {
        typescript: true,
      },
    },

    extends: ['js/recommended'],
  },
  tseslint.configs.recommended,
  tseslint.configs.stylistic,
  {
    name: 'TypeScript rules',
    rules: {
      '@local/check-license': 'error',

      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': [
        'error',
        {
          ignoreRestArgs: true,
        },
      ],
      // This optimizes the dependency tracking for type-only files.
      '@typescript-eslint/consistent-type-imports': 'error',
      // So type-only exports get elided.
      '@typescript-eslint/consistent-type-exports': 'error',
      // Prefer interfaces over types for shape like.
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/array-type': [
        'error',
        {
          default: 'array-simple',
        },
      ],
      '@typescript-eslint/no-floating-promises': 'error',

      'import/order': [
        'error',
        {
          'newlines-between': 'always',

          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],

      'import/no-cycle': [
        'error',
        {
          maxDepth: Infinity,
        },
      ],

      'import/enforce-node-protocol-usage': ['error', 'always'],

      '@stylistic/function-call-spacing': 'error',
      '@stylistic/semi': 'error',
    },
  },
  {
    name: 'Tests',
    files: ['**/*.test.ts'],
    rules: {
      // With the Node.js test runner, `describe` and `it` are technically
      // promises, but we don't need to await them.
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
]);

```

### Core Architecture Module: `scripts/eslint_rules/check-license-rule.js`
```
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const currentYear = new Date().getFullYear();
const licenseHeader = `
/**
 * @license
 * Copyright ${currentYear} Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
`;

export default {
  name: 'check-license',
  meta: {
    type: 'layout',
    docs: {
      description: 'Validate existence of license header',
    },
    fixable: 'code',
    schema: [],
    messages: {
      licenseRule: 'Add license header.',
    },
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.getSourceCode();
    const comments = sourceCode.getAllComments();
    let insertAfter = [0, 0];
    let header = null;
    // Check only the first 2 comments
    for (let index = 0; index < 2; index++) {
      const comment = comments[index];
      if (!comment) {
        break;
      }
      // Shebang comments should be at the top
      if (
        comment.type === 'Shebang' ||
        (comment.type === 'Line' && comment.value.startsWith('#!'))
      ) {
        insertAfter = comment.range;
        continue;
      }
      if (comment.type === 'Block') {
        header = comment;
        break;
      }
    }

    return {
      Program(node) {
        if (context.getFilename().endsWith('.json')) {
          return;
        }

        if (
          header &&
          (header.value.includes('@license') ||
            header.value.includes('License') ||
            header.value.includes('Copyright'))
        ) {
          return;
        }

        // Add header license
        if (!header || !header.value.includes('@license')) {
          context.report({
            node: node,
            messageId: 'licenseRule',
            fix(fixer) {
              return fixer.insertTextAfterRange(insertAfter, licenseHeader);
            },
          });
        }
      },
    };
  },
};

```

### Core Architecture Module: `scripts/eslint_rules/local-plugin.js`
```
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import checkLicenseRule from './check-license-rule.js';

export default {rules: {'check-license': checkLicenseRule}};

```

### Core Architecture Module: `scripts/evaluate-tool-routing.ts`
```
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import type {Tool} from '@modelcontextprotocol/sdk/types.js';

const MCP_SERVER_PATH = 'build/src/index.js';
const CORPUS_PATH = 'evals/tool-routing.json';
const EXPECTED_TOOL_COUNT = 24;
const MIN_CASES = 20;
const MAX_CASES = 30;
const REQUIRED_CATEGORIES = [
  'cookie_network',
  'initiator_breakpoint',
  'scripts',
  'websocket',
  'page_frame',
  'destructive_actions',
] as const;
const ENDPOINT_ENV = 'MCP_ROUTING_EVAL_ENDPOINT';
const MODEL_ENV = 'MCP_ROUTING_EVAL_MODEL';
const API_KEY_ENV = 'MCP_ROUTING_EVAL_API_KEY';
const TIMEOUT_ENV = 'MCP_ROUTING_EVAL_TIMEOUT_MS';
const MIN_PASS_RATE_ENV = 'MCP_ROUTING_EVAL_MIN_PASS_RATE';

type JsonObject = Record<string, unknown>;

interface JsonSchema extends JsonObject {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  const?: unknown;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  additionalProperties?: boolean | JsonSchema;
}

interface RoutingCase {
  id: string;
  category: string;
  prompt: string;
  expectedTool: string;
  expectedArgs: JsonObject;
}

interface RoutingCorpus {
  version: number;
  expectedToolCount: number;
  cases: RoutingCase[];
}

interface ToolCall {
  name: string;
  arguments: JsonObject;
}

interface McpMetadata {
  tools: Tool[];
  instructions: string;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function describeValue(value: unknown): string {
  if (Array.isArray(value)) {
    return 'array';
  }
  if (value === null) {
    return 'null';
  }
  return typeof value;
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => deepEqual(value, right[index]))
    );
  }
  if (isObject(left) && isObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(key => key in right && deepEqual(left[key], right[key]))
    );
  }
  return false;
}

function readStringField(
  value: JsonObject,
  field: string,
  context: string,
  errors: string[],
): string {
  const result = value[field];
  if (!isNonEmptyString(result)) {
    errors.push(`${context}.${field} must be a non-empty string.`);
    return '';
  }
  return result;
}

async function readCorpus(): Promise<RoutingCorpus> {
  const content = await fs.readFile(path.resolve(CORPUS_PATH), 'utf8');
  const parsed: unknown = JSON.parse(content);
  if (!isObject(parsed)) {
    throw new Error(`${CORPUS_PATH} must contain a JSON object.`);
  }

  const errors: string[] = [];
  if (parsed.version !== 1) {
    errors.push('version must be 1.');
  }
  if (!Number.isInteger(parsed.expectedToolCount)) {
    errors.push('expectedToolCount must be an integer.');
  }

  const rawCases = parsed.cases;
  if (!Array.isArray(rawCases)) {
    throw new Error(`${CORPUS_PATH}.cases must be an array.`);
  }

  const cases: RoutingCase[] = rawCases.flatMap((value, index) => {
    const context = `cases[${index}]`;
    if (!isObject(value)) {
      errors.push(`${context} must be an object.`);
      return [];
    }
    const expectedArgs = value.expectedArgs;
    if (!isObject(expectedArgs)) {
      errors.push(`${context}.expectedArgs must be an object.`);
    }
    return [
      {
        id: readStringField(value, 'id', context, errors),
        category: readStringField(value, 'category', context, errors),
        prompt: readStringField(value, 'prompt', context, errors),
        expectedTool: readStringField(value, 'expectedTool', context, errors),
        expectedArgs: isObject(expectedArgs) ? expectedArgs : {},
      },
    ];
  });

  if (errors.length > 0) {
    throw new Error(`Invalid routing corpus:\n- ${errors.join('\n- ')}`);
  }

  return {
    version: parsed.version as number,
    expectedToolCount: parsed.expectedToolCount as number,
    cases,
  };
}

async function loadMcpMetadata(): Promise<McpMetadata> {
  const serverPath = path.resolve(MCP_SERVER_PATH);
  try {
    await fs.access(serverPath);
  } catch {
    throw new Error(
      `${MCP_SERVER_PATH} was not found. Run npm run build before this script.`,
    );
  }

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    // The transport's default allowlist already prevents eval credentials from
    // reaching the child. Consume stderr without echoing local paths or logs.
    stderr: 'pipe',
  });
  transport.stderr?.on('data', () => undefined);
  const client = new Client(
    {name: 'tool-routing-evaluator', version: '1.0.0'},
    {capabilities: {}},
  );

  try {
    await client.connect(transport);
    const tools: Tool[] = [];
    let cursor: string | undefined;
    do {
      const result = await client.listTools(cursor ? {cursor} : undefined);
      tools.push(...(result.tools as Tool[]));
      cursor = result.nextCursor;
    } while (cursor);

    return {
      tools,
      instructions: client.getInstructions()?.trim() ?? '',
    };
  } finally {
    await client.close().catch(() => undefined);
  }
}

function schemaFor(tool: Tool): JsonSchema {
  return tool.inputSchema as JsonSchema;
}

function validateSchemaValue(
  value: unknown,
  schema: JsonSchema,
  location: string,
): string[] {
  if (schema.const !== undefined && !deepEqual(value, schema.const)) {
    return [`${location} must equal ${JSON.stringify(schema.const)}.`];
  }
  if (
    schema.enum &&
    !schema.enum.some(candidate => deepEqual(value, candidate))
  ) {
    return [`${location} is not one of the schema enum values.`];
  }

  if (schema.anyOf) {
    const matches = schema.anyOf.some(
      candidate => validateSchemaValue(value, candidate, location).length === 0,
    );
    return matches ? [] : [`${location} does not match any schema branch.`];
  }
  if (schema.oneOf) {
    const matches = schema.oneOf.filter(
      candidate => validateSchemaValue(value, candidate, location).length === 0,
    ).length;
    return matches === 1
      ? []
      : [
          `${location} must match exactly one schema branch; matched ${matches}.`,
        ];
  }

  const allowedTypes = Array.isArray(schema.type)
    ? schema.type
    : schema.type
      ? [schema.type]
      : [];
  if (allowedTypes.length > 0) {
    const actualType = describeValue(value);
    const typeMatches = allowedTypes.some(type => {
      if (type === 'integer') {
        return typeof value === 'number' && Number.isInteger(value);
      }
      if (type === 'number') {
        return typeof value === 'number' && Number.isFinite(value);
      }
      return type === actualType;
    });
    if (!typeMatches) {
      return [
        `${location} has type ${actualType}; expected ${allowedTypes.join(' or ')}.`,
      ];
    }
  }

  const errors: string[] = [];
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${location} must be at least ${schema.minimum}.`);
    }
    if (schema.maximum
```

### Core Architecture Module: `src/CdpEvents.ts`
```
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {CDPSession} from './third_party/index.js';

type CdpEventListener = (payload: unknown) => void;
type CdpEventRegistrar = (
  eventName: string,
  listener: CdpEventListener,
) => CDPSession;

export function addCdpEventListener(
  session: CDPSession,
  eventName: string,
  listener: unknown,
): void {
  const onCdpEvent = session.on.bind(session) as unknown as CdpEventRegistrar;
  onCdpEvent(eventName, listener as CdpEventListener);
}

export function removeCdpEventListener(
  session: CDPSession,
  eventName: string,
  listener: unknown,
): void {
  const offCdpEvent = session.off.bind(session) as unknown as CdpEventRegistrar;
  offCdpEvent(eventName, listener as CdpEventListener);
}

```

### Core Architecture Module: `src/CdpSessionProvider.ts`
```
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BrowserContext,
  CDPSession,
  Frame,
  Page,
} from './third_party/index.js';

interface PendingSession {
  invalidated: boolean;
  promise: Promise<CDPSession>;
}

/**
 * CDP Session cache layer for Playwright/Patchright.
 *
 * In Puppeteer, `page._client()` is synchronous and returns the same session.
 * In Playwright, `page.context().newCDPSession(page)` is async and creates
 * a new session each time. This provider caches sessions per Page/Frame.
 */
export class CdpSessionProvider {
  #pageSessions = new WeakMap<Page, CDPSession>();
  #frameSessions = new WeakMap<Frame, CDPSession>();
  #pendingPageSessions = new WeakMap<Page, PendingSession>();
  #pendingFrameSessions = new WeakMap<Frame, PendingSession>();
  #context: BrowserContext;

  constructor(context: BrowserContext) {
    this.#context = context;
  }

  /**
   * Get a cached CDP session for a page, creating one if needed.
   */
  getSession(pageOrFrame: Page): Promise<CDPSession>;
  getSession(pageOrFrame: Frame): Promise<CDPSession>;
  getSession(pageOrFrame: Page | Frame): Promise<CDPSession> {
    // Check if it's a Page (has context() method that returns BrowserContext)
    if ('context' in pageOrFrame && typeof pageOrFrame.context === 'function') {
      // It could be either Page or Frame - check for mainFrame to distinguish
      if ('mainFrame' in pageOrFrame) {
        return this.#getPageSession(pageOrFrame as Page);
      }
    }
    return this.#getFrameSession(pageOrFrame as Frame);
  }

  #getPageSession(page: Page): Promise<CDPSession> {
    const cached = this.#pageSessions.get(page);
    if (cached) {
      return Promise.resolve(cached);
    }
    const existing = this.#pendingPageSessions.get(page);
    if (existing) {
      return existing.promise;
    }

    const operation = this.#context.newCDPSession(page);
    const pending: PendingSession = {invalidated: false, promise: operation};
    const promise = operation
      .then(async session => {
        if (
          pending.invalidated ||
          this.#pendingPageSessions.get(page) !== pending
        ) {
          await session.detach().catch(() => undefined);
          throw new Error('CDP page session creation was invalidated');
        }
        this.#pageSessions.set(page, session);
        return session;
      })
      .finally(() => {
        if (this.#pendingPageSessions.get(page) === pending) {
          this.#pendingPageSessions.delete(page);
        }
      });
    pending.promise = promise;
    this.#pendingPageSessions.set(page, pending);
    return promise;
  }

  #getFrameSession(frame: Frame): Promise<CDPSession> {
    const cached = this.#frameSessions.get(frame);
    if (cached) {
      return Promise.resolve(cached);
    }
    const existing = this.#pendingFrameSessions.get(frame);
    if (existing) {
      return existing.promise;
    }

    // Playwright's newCDPSession accepts Frame directly for OOPIFs.
    const operation = this.#context.newCDPSession(frame);
    const pending: PendingSession = {invalidated: false, promise: operation};
    const promise = operation
      .then(async session => {
        if (
          pending.invalidated ||
          this.#pendingFrameSessions.get(frame) !== pending
        ) {
          await session.detach().catch(() => undefined);
          throw new Error('CDP frame session creation was invalidated');
        }
        this.#frameSessions.set(frame, session);
        return session;
      })
      .finally(() => {
        if (this.#pendingFrameSessions.get(frame) === pending) {
          this.#pendingFrameSessions.delete(frame);
        }
      });
    pending.promise = promise;
    this.#pendingFrameSessions.set(frame, pending);
    return promise;
  }

  /**
   * Invalidate cached session for a page or frame.
   * Call this when the page/frame is closed or navigated.
   */
  invalidate(pageOrFrame: Page | Frame): void {
    if ('mainFrame' in pageOrFrame) {
      const pending = this.#pendingPageSessions.get(pageOrFrame as Page);
      if (pending) {
        pending.invalidated = true;
        this.#pendingPageSessions.delete(pageOrFrame as Page);
      }
      const session = this.#pageSessions.get(pageOrFrame as Page);
      if (session) {
        void session.detach().catch(() => undefined);
        this.#pageSessions.delete(pageOrFrame as Page);
      }
    } else {
      const pending = this.#pendingFrameSessions.get(pageOrFrame as Frame);
      if (pending) {
        pending.invalidated = true;
        this.#pendingFrameSessions.delete(pageOrFrame as Frame);
      }
      const session = this.#frameSessions.get(pageOrFrame as Frame);
      if (session) {
        void session.detach().catch(() => undefined);
        this.#frameSessions.delete(pageOrFrame as Frame);
      }
    }
  }
}

```

### Core Architecture Module: `src/DebuggerContext.ts`
```
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {Protocol} from 'devtools-protocol';

import {addCdpEventListener, removeCdpEventListener} from './CdpEvents.js';
import type {CDPSession} from './third_party/index.js';

export interface ScriptInfo {
  scriptId: string;
  url: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  hash: string;
  sourceMapURL?: string;
}

export interface BreakpointInfo {
  breakpointId: string;
  url: string;
  lineNumber: number;
  columnNumber: number;
  condition?: string;
  isRegex?: boolean;
  locations: Array<{
    scriptId: string;
    lineNumber: number;
    columnNumber: number;
  }>;
}

export interface SearchMatch {
  scriptId: string;
  url: string;
  lineNumber: number;
  lineContent: string;
}

export interface SearchResult {
  query: string;
  matches: SearchMatch[];
}

export interface CallFrame {
  callFrameId: string;
  functionName: string;
  location: {
    scriptId: string;
    lineNumber: number;
    columnNumber: number;
  };
  url: string;
  scopeChain: ScopeInfo[];
  this: RemoteObject;
}

export interface ScopeInfo {
  type:
    | 'global'
    | 'local'
    | 'with'
    | 'closure'
    | 'catch'
    | 'block'
    | 'script'
    | 'eval'
    | 'module'
    | 'wasm-expression-stack';
  object: RemoteObject;
  name?: string;
  startLocation?: {
    scriptId: string;
    lineNumber: number;
    columnNumber: number;
  };
  endLocation?: {
    scriptId: string;
    lineNumber: number;
    columnNumber: number;
  };
}

export interface RemoteObject {
  type: string;
  subtype?: string;
  className?: string;
  value?: unknown;
  unserializableValue?: string;
  description?: string;
  objectId?: string;
}

export interface PausedState {
  isPaused: boolean;
  reason?: string;
  callFrames: CallFrame[];
  data?: unknown;
  hitBreakpoints?: string[];
}

export interface ScopeVariable {
  name: string;
  type: string;
  value: unknown;
  description?: string;
}

export interface EvaluateResult {
  result: RemoteObject;
  settledPromise?: boolean;
  exceptionDetails?: {
    text: string;
    exception?: RemoteObject;
  };
}

/**
 * DebuggerContext manages the Chrome DevTools Protocol Debugger domain.
 * It tracks loaded scripts, manages breakpoints, and provides search functionality.
 */
export class DebuggerContext {
  #client: CDPSession | null = null;
  #scripts = new Map<string, ScriptInfo>(); // scriptId -> info
  #urlToScripts = new Map<string, string[]>(); // url -> scriptId[]
  #breakpoints = new Map<string, BreakpointInfo>(); // breakpointId -> info
  #xhrBreakpoints = new Set<string>(); // tracked XHR breakpoint URL patterns
  #enabled = false;
  #pausedState: PausedState = {isPaused: false, callFrames: []};

  /**
   * Enable the debugger and start tracking scripts.
   */
  async enable(client: CDPSession): Promise<void> {
    if (this.#enabled && this.#client === client) {
      return;
    }

    if (this.#client) {
      await this.disable({preserveBreakpoints: true});
    }

    this.#client = client;
    this.#scripts.clear();
    this.#urlToScripts.clear();

    // Listen for script parsed events
    addCdpEventListener(client, 'Debugger.scriptParsed', this.#onScriptParsed);

    // Listen for paused/resumed events
    addCdpEventListener(client, 'Debugger.paused', this.#onPaused);
    addCdpEventListener(client, 'Debugger.resumed', this.#onResumed);

    try {
      // Enable after listeners are attached because Chrome emits the existing
      // scripts as part of Debugger.enable.
      await client.send('Debugger.enable');
      this.#enabled = true;

      // Set async call stack depth for better stack traces.
      try {
        await client.send('Debugger.setAsyncCallStackDepth', {maxDepth: 32});
      } catch {
        // Ignore errors - some older versions may not support this.
      }
    } catch (error) {
      // A failed enable must be indistinguishable from one that never started:
      // leave no listeners/client behind so the next capability request can
      // retry safely.
      removeCdpEventListener(
        client,
        'Debugger.scriptParsed',
        this.#onScriptParsed,
      );
      removeCdpEventListener(client, 'Debugger.paused', this.#onPaused);
      removeCdpEventListener(client, 'Debugger.resumed', this.#onResumed);
      try {
        await client.send('Debugger.disable');
      } catch {
        // Best-effort rollback for a partially enabled CDP domain.
      }
      this.#scripts.clear();
      this.#urlToScripts.clear();
      this.#pausedState = {isPaused: false, callFrames: []};
      this.#enabled = false;
      this.#client = null;
      throw error;
    }
  }

  /**
   * Disable the debugger.
   */
  async disable(options: {preserveBreakpoints?: boolean} = {}): Promise<void> {
    const client = this.#client;
    if (client) {
      removeCdpEventListener(
        client,
        'Debugger.scriptParsed',
        this.#onScriptParsed,
      );
      removeCdpEventListener(client, 'Debugger.paused', this.#onPaused);
      removeCdpEventListener(client, 'Debugger.resumed', this.#onResumed);

      try {
        await client.send('Debugger.disable');
      } catch {
        // Ignore errors during cleanup.
      }
    }

    this.#scripts.clear();
    this.#urlToScripts.clear();
    if (!options.preserveBreakpoints) {
      this.#breakpoints.clear();
      this.#xhrBreakpoints.clear();
    }
    this.#pausedState = {isPaused: false, callFrames: []};
    this.#enabled = false;
    this.#client = null;
  }

  /**
   * Check if debugger is enabled.
   */
  isEnabled(): boolean {
    return this.#enabled;
  }

  /**
   * Get the CDP client.
   */
  getClient(): CDPSession | null {
    return this.#client;
  }

  #onScriptParsed = (event: Protocol.Debugger.ScriptParsedEvent): void => {
    const scriptInfo: ScriptInfo = {
      scriptId: event.scriptId,
      url: event.url || '',
      startLine: event.startLine,
      startColumn: event.startColumn,
      endLine: event.endLine,
      endColumn: event.endColumn,
      hash: event.hash,
      sourceMapURL: event.sourceMapURL,
    };

    this.#scripts.set(event.scriptId, scriptInfo);

    // Index by URL for quick lookup
    if (event.url) {
      const scriptIds = this.#urlToScripts.get(event.url) || [];
      if (!scriptIds.includes(event.scriptId)) {
        scriptIds.push(event.scriptId);
        this.#urlToScripts.set(event.url, scriptIds);
      }
    }
  };

  #onPaused = (event: Protocol.Debugger.PausedEvent): void => {
    const callFrames: CallFrame[] = event.callFrames.map(frame => ({
      callFrameId: frame.callFrameId,
      functionName: frame.functionName || '<anonymous>',
      location: {
        scriptId: frame.location.scriptId,
        lineNumber: frame.location.lineNumber,
        columnNumber: frame.location.columnNumber ?? 0,
      },
      url: frame.url || '',
      scopeChain: frame.scopeChain.map(scope => ({
        type: scope.type as ScopeInfo['type'],
        object: {
          type: scope.object.type,
          subtype: scope.object.subtype,
          className: scope.object.className,
          value: scope.object.value,
          description: scope.object.description,
          objectId: scope.object.objectId,
        },
        name: scope.name,
        startLocation: scope.startLocation
          ? {
              scriptId: scope.startLocation.scriptId,
              lineNumber: scope.startLocation.lineNumber,
              columnNumber: scope.startLocation.columnNumber ?? 0,
            }
          : undefined,
        endLocation: scope.endLocation
          ? {
              scriptId: scope.endLocation.scriptId,
              lineNumber: scope.endLocation.lineNumber,
              columnNumber: scope.endLocation.columnNumber ?? 0,
            }
          : undefined,
      })),
      this: {
        type: frame.this.type,
        subtype: frame.this.subtype,
        c
```

### Core Architecture Module: `src/DevtoolsUtils.ts`
```
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export function extractUrlLikeFromDevToolsTitle(
  title: string,
): string | undefined {
  const match = title.match(new RegExp(`DevTools - (.*)`));
  return match?.[1] ?? undefined;
}

export function urlsEqual(url1: string, url2: string): boolean {
  const normalizedUrl1 = normalizeUrl(url1);
  const normalizedUrl2 = normalizeUrl(url2);
  return normalizedUrl1 === normalizedUrl2;
}

/**
 * For the sake of the MCP server, when we determine if two URLs are equal we
 * remove some parts:
 *
 * 1. We do not care about the protocol.
 * 2. We do not care about trailing slashes.
 * 3. We do not care about "www".
 * 4. We ignore the hash parts.
 *
 * For example, if the user asks to debug foo.com, we want to match a tab in the
 * connected Chrome instance that is showing "www.foo.com/".
 */
function normalizeUrl(url: string): string {
  let result = url.trim();

  // Remove protocols
  if (result.startsWith('https://')) {
    result = result.slice(8);
  } else if (result.startsWith('http://')) {
    result = result.slice(7);
  }

  // Remove 'www.'. This ensures that we find the right URL regardless of if the user adds `www` or not.
  if (result.startsWith('www.')) {
    result = result.slice(4);
  }

  // We use target URLs to locate DevTools but those often do
  // no include hash.
  const hashIdx = result.lastIndexOf('#');
  if (hashIdx !== -1) {
    result = result.slice(0, hashIdx);
  }

  // Remove trailing slash
  if (result.endsWith('/')) {
    result = result.slice(0, -1);
  }

  return result;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #34** (2026-09-07): **Files for upload must not exceed 5 MB？**
  *Symptoms*: I'd like to confirm whether the project will support large‑file uploads, as I'm not sure if this feature is required or planned for future iterations.
  **Post-Mortem & Fix Analysis**:
  > ao which scenarios will  it be used?
  > already upgrade

- **Issue #33** (2026-09-07): **Feature Suggestion: Optional token metering & paid API key support via `neuforge-pay`**
  *Symptoms*: Hi @zhizhuodemao,  Love the work on `zhizhuodemao/js-reverse-mcp`! As usage grows across AI agent frameworks, server compute costs can start adding up quickly. We've also seen developers report that their autonomous agents accidentally burn through thousands of dollars in a single session because traditional payment rails lack built-in agent guardrails.  Would you be open to adding an optional usage metering & billing decorator using `neuforge-pay`? It acts as a proactive **Spend Firewall** and Merchant of Record for MCP servers. In 3 lines of code, it meters tokens, calculates live LLM COGS, and proactively blocks agent transactions that exceed a strict session budget limit (to prevent surprise bills).  Example Integration: ```python from neuforge_pay import meter_endpoint  @app.get("/v1/query") @meter_endpoint(price_charged_usd=0.05, model_name="claude-3-5-sonnet", session_budget_usd=10.00) async def query_endpoint():     ... ```  Happy to submit a clean PR if this aligns with your roadmap!

- **Issue #27** (2026-06-23): **cloakbrowser 免费版的马上就不管用了**
  *Symptoms*: 后面还会做cloakbrowser的相关适配么?  CloakBrowser Pro The wrapper (Python + JS) is MIT, free forever. The binary uses a delayed free-release model:  **Free (v146) — the previous binary, on [GitHub Releases](https://github.com/CloakHQ/cloakbrowser/releases). Goes stale within weeks as detection evolves.** 
  **Post-Mortem & Fix Analysis**:
  > 看了价格，这个价格没有吸引力了，因为太贵了，后边会适配市面上其他的指纹浏览器，其他的有个人免费版限额，暂时还够用
  > 不过我看官方网站，以后免费版还会更新，只是永远落后付费版一到两个版本，先用用看吧

- **Issue #26** (2026-06-19): **会有SKILL版吗，结合agent-browser之类的**
  *Symptoms*: 会有SKILL版吗，结合agent-browser之类的
  **Post-Mortem & Fix Analysis**:
  > 有的,但是不太通用,重要的是思路,所以放到付费课程了,课程里有手把手教学,感兴趣可以看下https://www.kanxue.com/book-section_list-129.htm

- **Issue #25** (2026-06-11): **反调试卡住**
  *Symptoms*: 能不能加下反调试功能，有反调试一直卡住

- **Issue #24** (2026-06-01): **MCP client for `js-reverse` failed to start**
  *Symptoms*: Saw https://github.com/zhizhuodemao/js-reverse-mcp/issues/12, but there is no correct answer for that.  And we have the same issue here. It alway tells: ``` MCP client for `js-reverse` failed to start: MCP startup failed: handshaking   with MCP server failed: connection closed: initialize response ```  May I ask how to solve it ? Is there any other method or binary to install this tool manually ?
  **Post-Mortem & Fix Analysis**:
  > please try to clean the cache of this package(you can ask ai how to clean it),and install it again
  > Reinstall with no success. But manually install just make it :)

- **Issue #23** (2026-05-21): **无法连接到已运行的浏览器**
  *Symptoms*: 提示是参数互斥，但是我没有传递两个参数。 ```bash PS E:\...\MCP> npx js-reverse-mcp --browserUrl http://127.0.0.1:9221 选项：   -u, --browserUrl  Connect to a running Chrome instance via CDP HTTP endpoint (e.g., http://127.0.0.1:9222). The MCP                     will probe the endpoint to find the WebSocket debugger URL.                                 [字符串]       --isolated    Create a temporary user-data-dir that is auto-cleaned when the browser closes. Use this for runs                     where you do NOT want cookies/localStorage to persist into your default profile.                                                                                                   [布尔] [默认值: false]       --logFile     Path to a file to write debug logs to. Set the env variable `DEBUG` to `*` to enable verbose logs.                     Useful for submitting bug reports.                                                          [字符串]       --cloak       Use CloakBrowser stealth-patched Chromium instead of system Chrome. Adds source-level fingerprint                     patches (canvas/WebGL/audio/GPU). Binary auto-downloads (~200MB) on first use. Identity is persisted                     per profile in <profile>/.cloak-seed.                                         [布尔] [默认值: false]       --help        显示帮助信息                                                                                  [布尔]       --version     显示版本号                                                                                    [布尔]  示例：   np
  **Post-Mortem & Fix Analysis**:
  > 这是一个 bug,感谢反馈！已经推送并修复，重启mcp即可，使用方法可参考 https://github.com/zhizhuodemao/js-reverse-mcp/blob/main/docs/cdp-endpoint.md 支持各种第三方指纹浏览器

- **Issue #22** (2026-06-23): **接管浏览器老是接管不上**
  *Symptoms*: mcp能不能集成cdp协议啊chrome-cdp
  **Post-Mortem & Fix Analysis**:
  > 有的哈，如果是要用cdp 协议的话，可以看readme,使用remote-url 这个参数
  > chrome://inspect/#remote-debugging  DevTools Devices Pages Extensions Apps Shared workers Service workers Shared storage worklets Remote debugging Other Remote debugging  Allow remote debugging for this browser instance Turning on this setting allows external apps to request full control of this browser. This includes read access to your saved data, cookies and site data, and the ability to navigate to any URL.  Only web developers should turn on this feature, and only use it with trusted apps.  Server running at: 127.0.0.1:54367 [Learn about connecting to Chrome DevTools MCP](https://developer.chrome.com/blog/chrome-devtools-mcp-debug-your-browser-session)  每次默认启动的协议端口可能会变化,它不能做到自动识别,chrome cdp skill这个项目可自动识别直接连接,这个功能我目前以及微调了,建议作者可以加进去
  > 不一定是9222端口,它检测不到就会自动启动新的浏览器实例

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

### Incident Patch 1: `bf7dc506` (2026-09-03)
**Commit Message**: chore(release): publish v4.0.5 with audit fixes

**File**: `package-lock.json` (modified, +8/-8)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "js-reverse-mcp",
-  "version": "4.0.4",
+  "version": "4.0.5",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "js-reverse-mcp",
-      "version": "4.0.4",
+      "version": "4.0.5",
       "license": "Apache-2.0",
       "dependencies": {
         "@modelcontextprotocol/sdk": "1.29.0",
@@ -2637,9 +2637,9 @@
       "license": "MIT"
     },
     "node_modules/fast-uri": {
-      "version": "3.1.5",
-      "resolved": "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.5.tgz",
-      "integrity": "sha512-gHwA1O9LDIcKunMKhObS/HimwtehO1nPUECKAu5TpKgaO19fcWEl4bliWe1jWxVFvIXztJjjQ4L8XQ1EU9f7Jw==",
+      "version": "3.1.7",
+      "resolved": "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.7.tgz",
+      "integrity": "sha512-dOvZVzjdZdz7phd9v6jCbwxrBW3fK6n8Rc0CtdmM4bumzMnxywBYhuph6J819RRw/ku+rLbelwfMunktuzVVHg==",
       "funding": [
         {
           "type": "github",
@@ -4279,9 +4279,9 @@
       }
     },
     "node_modules/qs": {
-      "version": "6.15.3",
-      "resolved": "https://registry.npmjs.org/qs/-/qs-6.15.3.tgz",
-      "integrity": "sha512-O9gl3zCl5h5blw1KGUzQKhA5oUXSl8rwUIM5o0S3nCXMliSvy5Dzx7/DJcI+SwgICv+IneSZwhBh1oSyEHA71A==",
+      "version": "6.16.0",
+      "resolved": "https://registry.npmjs.org/qs/-/qs-6.16.0.tgz",
+      "integrity": "sha512-h6fhOIaRrID2CbEY2fqs+7t+UXZo+MLAnU5gRIq85uFtdiUPCdsApMlHhXogKVM4HM2DVbIjGNTTYH2OcmP1vA==",
       "license": "BSD-3-Clause",
       "dependencies": {
         "es-define-property": "^1.0.1",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "js-reverse-mcp",
-  "version": "4.0.4",
+  "version": "4.0.5",
   "description": "JS reverse engineering MCP server with agent-first tool design and built-in anti-detection. 为 AI Agent 设计的 JS 逆向 MCP Server，内置反检测。",
   "keywords": [
     "mcp",
```

---

### Incident Patch 2: `177f1901` (2026-06-26)
**Commit Message**: fix(server): read version from package.json and show it in the description

VERSION was hardcoded to 0.10.2 (a vestigial release-please marker from the
upstream fork), so the MCP server reported the wrong version to clients while
npm was already at 3.0.x. Read it from package.json at runtime via
import.meta.dirname so it always matches the published package, and surface
it in the server description (v{VERSION}).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

**File**: `src/main.ts` (modified, +15/-6)
```diff
@@ -6,6 +6,9 @@
 
 import './polyfill.js';
 
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+
 import {ensureBrowserConnected, ensureBrowserLaunched} from './browser.js';
 import type {BrowserResult} from './browser.js';
 import {parseArguments} from './cli.js';
@@ -33,10 +36,17 @@ import * as siteDataTools from './tools/siteData.js';
 import type {ToolDefinition} from './tools/ToolDefinition.js';
 import * as websocketTools from './tools/websocket.js';
 
-// If moved update release-please config
-// x-release-please-start-version
-const VERSION = '0.10.2';
-// x-release-please-end
+// Read the version from package.json at runtime so it never drifts from the
+// published package. Releases here are driven by `npm version` + a git tag, not
+// release-please, so a hardcoded constant would go stale.
+const VERSION = (
+  JSON.parse(
+    fs.readFileSync(
+      path.join(import.meta.dirname, '../../package.json'),
+      'utf8',
+    ),
+  ) as {version: string}
+).version;
 
 export const args = parseArguments(VERSION);
 
@@ -47,8 +57,7 @@ const server = new McpServer(
   {
     name: 'js-reverse',
     title: 'JS Reverse Engineering MCP Server',
-    description:
-      'JavaScript reverse engineering and debugging via Chrome DevTools. Built on Patchright anti-detection engine — passes mainstream browser fingerprint checks (Zhihu, Google, etc.) out of the box.',
+    description: `JavaScript reverse engineering and debugging via Chrome DevTools (v${VERSION}). Built on Patchright anti-detection engine — passes mainstream browser fingerprint checks (Zhihu, Google, etc.) out of the box.`,
     version: VERSION,
   },
   {capabilities: {logging: {}}},
```

---

### Incident Patch 3: `45522b17` (2026-06-26)
**Commit Message**: fix(network): recover request initiator via URL+method fallback

get_request_initiator returned "No initiator information found" because
getInitiator required cdpRequestIdSymbol to be mapped onto the request,
and that mapping (done inside the CDP requestWillBeSent handler by scanning
storage for a URL+method match) races against Playwright's request event:
the CDP event usually fires before the request is in storage, so the symbol
is never set and the lookup always fails — before and after navigation.

Store initiators additionally keyed by "METHOD url" and fall back to that in
getInitiator. This lookup is order-independent, so it recovers the initiator
regardless of which event won the race. The requestId path is still tried
first for an exact match.

Note: this does not cover requests fired before initCdp activates the CDP
listener (e.g. page-load requests during a navigation tool, where CDP is
kept silent for anti-detection) — those are never captured at all.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

**File**: `src/PageCollector.ts` (modified, +43/-6)
```diff
@@ -658,8 +658,17 @@ function captureResponseBody(req: HTTPRequest): void {
   })();
 }
 
+function initiatorKey(url: string, method: string): string {
+  return `${method} ${url}`;
+}
+
 export class NetworkCollector extends PageCollector<HTTPRequest> {
+  // Initiators keyed by CDP requestId. Requires cdpRequestIdSymbol to have been
+  // mapped onto the request, which races against event delivery.
   #initiators = new WeakMap<Page, Map<string, RequestInitiator>>();
+  // Initiators keyed by "METHOD url". Order-independent fallback used when the
+  // requestId mapping lost the race, so the initiator is still recoverable.
+  #initiatorsByKey = new WeakMap<Page, Map<string, RequestInitiator>>();
   #cdpListeners = new WeakMap<Page, () => void>();
   #sessionProvider: CdpSessionProvider;
   #cdpReady = false;
@@ -726,6 +735,8 @@ export class NetworkCollector extends PageCollector<HTTPRequest> {
 
     const initiatorMap = new Map<string, RequestInitiator>();
     this.#initiators.set(page, initiatorMap);
+    const initiatorByKey = new Map<string, RequestInitiator>();
+    this.#initiatorsByKey.set(page, initiatorByKey);
 
     try {
       const client = await this.#sessionProvider.getSession(page);
@@ -740,6 +751,12 @@ export class NetworkCollector extends PageCollector<HTTPRequest> {
             event.requestId,
             event.initiator as RequestInitiator,
           );
+          // Also key by URL+method so getInitiator can recover the initiator
+          // even when the requestId mapping below loses the delivery race.
+          initiatorByKey.set(
+            initiatorKey(event.request.url, event.request.method),
+            event.initiator as RequestInitiator,
+          );
           // Bound memory: drop oldest entries beyond the cap (Map preserves
           // insertion order, so the first key is the oldest).
           while (initiatorMap.size > MAX_INITIATOR_ENTRIES) {
@@ -749,6 +766,13 @@ export class NetworkCollector extends PageCollector<HTTPRequest> {
             }
             initiatorMap.delete(oldest);
           }
+          while (initiatorByKey.size > MAX_INITIATOR_ENTRIES) {
+            const oldest = initiatorByKey.keys().next().value;
+            if (oldest === undefined) {
+              break;
+            }
+            initiatorByKey.delete(oldest);
+          }
         }
 
         // Map CDP request ID to Playwright Request via URL+method matching
@@ -803,6 +827,7 @@ export class NetworkCollector extends PageCollector<HTTPRequest> {
     }
     this.#cdpListeners.delete(page);
     this.#initiators.delete(page);
+    this.#initiatorsByKey.delete(page);
     responseBodyBudget.delete(page);
   }
 
@@ -820,15 +845,27 @@ export class NetworkCollector extends PageCollector<HTTPRequest> {
    * @returns The initiator info or undefined if not found
    */
   getInitiator(page: Page, request: HTTPRequest): RequestInitiator | undefined {
-    const initiatorMap = this.#initiators.get(page);
-    if (!initiatorMap) {
-      return undefined;
-    }
+    // Preferred: exact CDP requestId match (when the mapping won the race).
     const requestId = this.getCdpRequestId(request);
-    if (!requestId) {
+    const byId = requestId
+      ? this.#initiators.get(page)?.get(requestId)
+      : undefined;
+    if (byId) {
+      return byId;
+    }
+
+    // Fallback: URL+method correlation. The requestId mapping requires the
+    // Playwright request to already be in storage when the CDP event fires,
+    // which races against event delivery; this lookup is order-independent.
+    let url: string;
+    let method: string;
+    try {
+      url = request.url();
+      method = request.method();
+    } catch {
       return undefined;
     }
-    return initiatorMap.get(requestId);
+    return this.#initiatorsByKey.get(page)?.get(initiatorKey(url, method));
   }
 
   /**
```

**File**: `tests/PageCollector.test.ts` (modified, +69/-0)
```diff
@@ -54,6 +54,30 @@ function createCollector(): NetworkCollector {
   );
 }
 
+function createFakeCdpSession() {
+  const handlers = new Map<string, Array<(payload: unknown) => void>>();
+  const session = {
+    on(event: string, cb: (payload: unknown) => void) {
+      const arr = handlers.get(event) ?? [];
+      arr.push(cb);
+      handlers.set(event, arr);
+      return session;
+    },
+    off() {
+      return session;
+    },
+    send: async () => undefined,
+    emit(event: string, payload: unknown) {
+      for (const cb of handlers.get(event) ?? []) {
+        cb(payload);
+      }
+    },
+  };
+  return session;
+}
+
+const flushMicrotasks = () => new Promise(resolve => setTimeout(resolve, 0));
+
 test('preserved requests survive more than the old navigation window', () => {
   const collector = createCollector();
   const {page, mainFrame} = createFakePage();
@@ -130,3 +154,48 @@ test('evicts the oldest requests once past the retention cap', () => {
     'the newest navigations should be retained',
   );
 });
+
+test('getInitiator recovers via URL+method when the requestId mapping lost the race', async () => {
+  const {page} = createFakePage();
+  const cdp = createFakeCdpSession();
+  const collector = new NetworkCollector(
+    {pages: () => [page]} as unknown as BrowserContext,
+    {getSession: async () => cdp} as unknown as CdpSessionProvider,
+  );
+  collector.addPage(page);
+  await collector.initCdp();
+  await flushMicrotasks(); // let the fire-and-forget CDP setup finish
+
+  // The CDP requestWillBeSent event arrives before the Playwright request is in
+  // storage, so the requestId mapping never tags the request object.
+  cdp.emit('Network.requestWillBeSent', {
+    requestId: 'req-1',
+    request: {url: 'https://x/api', method: 'POST'},
+    initiator: {
+      type: 'script',
+      stack: {
+        callFrames: [
+          {
+            functionName: 'doFetch',
+            scriptId: '1',
+            url: 'https://x/page1.html',
+            lineNumber: 1,
+            columnNumber: 1,
+          },
+        ],
+      },
+    },
+  });
+
+  // createFakeRequest uses method POST; cdpRequestIdSymbol was never set, so the
+  // requestId path yields nothing and the URL+method fallback must recover it.
+  const request = createFakeRequest('https://x/api', {id: 'sub'});
+  const initiator = collector.getInitiator(page, request);
+
+  assert.ok(
+    initiator,
+    'initiator should be recovered via the URL+method fallback',
+  );
+  assert.equal(initiator?.type, 'script');
+  assert.equal(initiator?.stack?.callFrames[0].functionName, 'doFetch');
+});
```

---

### Incident Patch 4: `a64e6931` (2026-06-26)
**Commit Message**: fix(network): default outputPart, retain all nav buckets, keep initiators

Three production bugs in list_network_requests / get_request_initiator:

- outputPart export crashed with "Cannot read properties of undefined
  (reading 'data')": ".default('all').optional()" let undefined
  short-circuit the default, so the export switch fell through to
  undefined. Drop the stray .optional() (same for includePreservedRequests)
  and fail fast on an unknown part.

- Preserved requests vanished after a few navigations: getData only read
  a fixed 4-bucket window while the network collector never trims, so
  redirect/challenge flows (which unshift empty buckets) pushed real
  records out of reach. Return every retained in-memory bucket instead.

- Request initiators were always empty: initiatorMap was cleared on every
  navigation, so any post-navigation lookup failed. Stop clearing on
  navigation and bound the map with a FIFO cap instead.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

**File**: `src/PageCollector.ts` (modified, +26/-6)
```diff
@@ -159,6 +159,13 @@ export const MAX_CACHED_TOTAL_BYTES = 50 * 1024 * 1024;
 
 const BODY_CAPTURE_TIMEOUT_MS = 5000;
 
+/**
+ * Upper bound on retained per-page initiator entries. Initiators are no longer
+ * cleared on navigation, so this FIFO cap (oldest dropped first) keeps the map
+ * from growing without limit on long-lived pages.
+ */
+const MAX_INITIATOR_ENTRIES = 5000;
+
 type WithSymbolId<T> = T & {
   [stableIdSymbol]?: number;
 };
@@ -280,7 +287,12 @@ export class PageCollector<T> {
     }
 
     const data: T[] = [];
-    for (let index = this.#maxNavigationSaved; index >= 0; index--) {
+    // Return every retained navigation bucket, not a fixed window. Collectors
+    // that trim on navigation (e.g. console) stay bounded; the network
+    // collector keeps all buckets until the page closes, so a request stays
+    // reachable as long as its object is alive — which is also what the eagerly
+    // cached response body relies on.
+    for (let index = navigations.length - 1; index >= 0; index--) {
       if (navigations[index]) {
         data.push(...navigations[index]);
       }
@@ -708,6 +720,15 @@ export class NetworkCollector extends PageCollector<HTTPRequest> {
             event.requestId,
             event.initiator as RequestInitiator,
           );
+          // Bound memory: drop oldest entries beyond the cap (Map preserves
+          // insertion order, so the first key is the oldest).
+          while (initiatorMap.size > MAX_INITIATOR_ENTRIES) {
+            const oldest = initiatorMap.keys().next().value;
+            if (oldest === undefined) {
+              break;
+            }
+            initiatorMap.delete(oldest);
+          }
         }
 
         // Map CDP request ID to Playwright Request via URL+method matching
@@ -830,10 +851,9 @@ export class NetworkCollector extends PageCollector<HTTPRequest> {
       navigations.unshift([]);
     }
 
-    // Clear old initiator data on navigation
-    const initiatorMap = this.#initiators.get(page);
-    if (initiatorMap) {
-      initiatorMap.clear();
-    }
+    // Do NOT clear initiator data on navigation. Requests collected before a
+    // navigation (e.g. the POST that triggered it) stay inspectable afterwards,
+    // so their initiators must survive too. The map is instead bounded by a
+    // FIFO cap enforced at insertion time.
   }
 }
```

**File**: `src/formatters/networkFormatter.ts` (modified, +7/-0)
```diff
@@ -449,6 +449,13 @@ export async function exportNetworkRequestPart(
         summary: `Exported full network request snapshot (${data.length} bytes).`,
       };
     }
+    default: {
+      // Never return undefined for an unrecognized part — that surfaces as a
+      // cryptic "Cannot read properties of undefined (reading 'data')" upstream.
+      throw new Error(
+        `Unknown outputPart "${part as string}". Expected one of: responseHeaders, responseBody, requestBody, queryParams, all.`,
+      );
+    }
   }
 }
 
```

**File**: `src/tools/network.ts` (modified, +0/-2)
```diff
@@ -87,7 +87,6 @@ export const listNetworkRequests = defineTool({
     includePreservedRequests: zod
       .boolean()
       .default(false)
-      .optional()
       .describe(
         'Set to true to return the preserved requests over the last 3 navigations.',
       ),
@@ -100,7 +99,6 @@ export const listNetworkRequests = defineTool({
     outputPart: zod
       .enum(NETWORK_EXPORT_PARTS)
       .default('all')
-      .optional()
       .describe(
         'Which part to export when outputFile is provided. "responseHeaders" saves response headers as JSON while preserving repeated headers such as Set-Cookie, "responseBody" saves raw response bytes, "requestBody" saves captured request body bytes, "queryParams" saves parsed URL query parameters as JSON, and "all" saves a JSON bundle with metadata, headers, query params, and body content/metadata. Defaults to "all".',
       ),
```

**File**: `tests/PageCollector.test.ts` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+/**
+ * @license
+ * Copyright 2025 Google LLC
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+import assert from 'node:assert/strict';
+import {test} from 'node:test';
+
+import type {CdpSessionProvider} from '../src/CdpSessionProvider.js';
+import {NetworkCollector} from '../src/PageCollector.js';
+import type {
+  BrowserContext,
+  HTTPRequest,
+  Page,
+} from '../src/third_party/index.js';
+
+function createFakePage(): {page: Page; mainFrame: object} {
+  const listeners = new Map<string, Array<(arg: unknown) => void>>();
+  const mainFrame = {id: 'main'};
+  const page = {
+    on(event: string, cb: (arg: unknown) => void) {
+      const arr = listeners.get(event) ?? [];
+      arr.push(cb);
+      listeners.set(event, arr);
+      return page;
+    },
+    off() {
+      return page;
+    },
+    mainFrame: () => mainFrame,
+    emit(event: string, arg: unknown) {
+      for (const cb of listeners.get(event) ?? []) {
+        cb(arg);
+      }
+    },
+  };
+  return {page: page as unknown as Page, mainFrame};
+}
+
+function createFakeRequest(url: string, frame: object): HTTPRequest {
+  return {
+    url: () => url,
+    method: () => 'POST',
+    isNavigationRequest: () => false,
+    frame: () => frame,
+  } as unknown as HTTPRequest;
+}
+
+function createCollector(): NetworkCollector {
+  return new NetworkCollector(
+    {} as unknown as BrowserContext,
+    {} as unknown as CdpSessionProvider,
+  );
+}
+
+test('preserved requests survive more than the old navigation window', () => {
+  const collector = createCollector();
+  const {page, mainFrame} = createFakePage();
+  collector.addPage(page);
+
+  // A request that belongs to the current navigation (e.g. the POST that
+  // triggers a redirect). Its frame is not the main frame, so it is never
+  // treated as a navigation request.
+  const subframe = {id: 'sub'};
+  const bundle = createFakeRequest('https://x/assets/js/bundle', subframe);
+  (page as unknown as {emit(e: string, a: unknown): void}).emit(
+    'request',
+    bundle,
+  );
+
+  // Five subsequent main-frame navigations with no captured navigation request
+  // — each pushes an empty bucket, which under the old fixed 4-bucket read
+  // window would evict the bundle request entirely.
+  for (let i = 0; i < 5; i++) {
+    (page as unknown as {emit(e: string, a: unknown): void}).emit(
+      'framenavigated',
+      mainFrame,
+    );
+  }
+
+  const preserved = collector.getData(page, true);
+  assert.ok(
+    preserved.includes(bundle),
+    'preserved view should still reach the bundle request after 5 navigations',
+  );
+
+  const currentOnly = collector.getData(page, false);
+  assert.ok(
+    !currentOnly.includes(bundle),
+    'default view should only show the current navigation',
+  );
+});
```

**File**: `tests/formatters/networkFormatter.test.ts` (modified, +15/-0)
```diff
@@ -89,6 +89,21 @@ test('rejects pending response exports without waiting for a response', async ()
   );
 });
 
+test('rejects an unknown outputPart instead of returning undefined', async () => {
+  // Guards against the "Cannot read properties of undefined (reading 'data')"
+  // failure when outputPart arrives undefined and the switch falls through.
+  const request = createPendingRequest();
+
+  await assert.rejects(
+    () =>
+      exportNetworkRequestPart(
+        request,
+        'bogus' as Parameters<typeof exportNetworkRequestPart>[1],
+      ),
+    /Unknown outputPart/,
+  );
+});
+
 test('allows pending request-side exports', async () => {
   const request = createPendingRequest();
 
```

---

### Incident Patch 5: `95338ccf` (2026-06-26)
**Commit Message**: fix(network): cache response bodies eagerly to survive navigation

Response bodies were fetched lazily via httpResponse.body() at inspect/
export time. After a navigation the browser evicts the body, so the CDP
getResponseBody call failed and tools returned "<not available anymore>".

Capture the body at requestfinished (while the producing loader is still
alive) and cache it on the request object via a symbol. Reads now prefer
the cache and fall back to a live fetch. Bounded by a per-response size
cap and a per-page byte budget.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

**File**: `src/PageCollector.ts` (modified, +130/-12)
```diff
@@ -130,6 +130,35 @@ export const stableIdSymbol = Symbol('stableIdSymbol');
 export const networkRequestObservedAtSymbol = Symbol(
   'networkRequestObservedAtSymbol',
 );
+
+/**
+ * Caches the response body buffer eagerly captured at `requestfinished` time,
+ * before a subsequent navigation lets the browser evict it. Stored as a
+ * Promise so concurrent readers dedupe onto a single capture. Lives on the
+ * request object, so it is GC'd together with the request when its navigation
+ * bucket is dropped.
+ */
+export const responseBodyCacheSymbol = Symbol('responseBodyCacheSymbol');
+
+export type CachedResponseBody =
+  | {ok: true; buffer: Buffer}
+  | {ok: false; error: string}
+  | {ok: 'skipped'; reason: string};
+
+/**
+ * Per-response size cap. Responses larger than this are not cached (they would
+ * dominate memory); reads fall back to a live fetch instead.
+ */
+export const MAX_CACHED_BODY_BYTES = 5 * 1024 * 1024;
+
+/**
+ * Per-page total budget for cached response bodies. Once exceeded, further
+ * responses are marked skipped rather than cached.
+ */
+export const MAX_CACHED_TOTAL_BYTES = 50 * 1024 * 1024;
+
+const BODY_CAPTURE_TIMEOUT_MS = 5000;
+
 type WithSymbolId<T> = T & {
   [stableIdSymbol]?: number;
 };
@@ -516,8 +545,87 @@ const cdpRequestIdSymbol = Symbol('cdpRequestId');
 type RequestWithNetworkMetadata = HTTPRequest & {
   [cdpRequestIdSymbol]?: string;
   [networkRequestObservedAtSymbol]?: number;
+  [responseBodyCacheSymbol]?: Promise<CachedResponseBody>;
 };
 
+/**
+ * Per-page running total of cached response body bytes. Keyed weakly so it is
+ * released when the page is GC'd; also cleared explicitly on page destroy.
+ */
+const responseBodyBudget = new WeakMap<Page, {bytes: number}>();
+
+function pageForRequest(req: HTTPRequest): Page | undefined {
+  try {
+    // frame() can throw for service worker requests.
+    return req.frame()?.page();
+  } catch {
+    return undefined;
+  }
+}
+
+function withCaptureTimeout<T>(promise: Promise<T>): Promise<T> {
+  return Promise.race([
+    promise,
+    new Promise<never>((_, reject) =>
+      setTimeout(
+        () => reject(new Error('Timed out capturing response body')),
+        BODY_CAPTURE_TIMEOUT_MS,
+      ),
+    ),
+  ]);
+}
+
+/**
+ * Eagerly fetch and cache a response body while the producing loader is still
+ * alive (called from `requestfinished`). After a navigation the browser evicts
+ * the body and a later `body()` call would fail; the cache lets inspect/export
+ * still return it. Fire-and-forget: the Promise is stored on the request so
+ * concurrent readers await the same capture.
+ */
+function captureResponseBody(req: HTTPRequest): void {
+  const request = req as RequestWithNetworkMetadata;
+  if (request[responseBodyCacheSymbol]) {
+    return;
+  }
+  request[responseBodyCacheSymbol] = (async (): Promise<CachedResponseBody> => {
+    try {
+      const resp = await req.response();
+      if (!resp) {
+        return {ok: false, error: 'No response available'};
+      }
+      const declared = Number(resp.headers()['content-length'] ?? 0);
+      if (declared > MAX_CACHED_BODY_BYTES) {
+        return {
+          ok: 'skipped',
+          reason: `content-length ${declared} exceeds cache limit`,
+        };
+      }
+      const buffer = await withCaptureTimeout(resp.body());
+      if (buffer.length > MAX_CACHED_BODY_BYTES) {
+        return {
+          ok: 'skipped',
+          reason: `body ${buffer.length} bytes exceeds cache limit`,
+        };
+      }
+      const page = pageForRequest(req);
+      if (page) {
+        const budget = responseBodyBudget.get(page) ?? {bytes: 0};
+        if (budget.bytes + buffer.length > MAX_CACHED_TOTAL_BYTES) {
+          return {ok: 'skipped', reason: 'page cache budget exhausted'};
+        }
+        budget.bytes += buffer.length;
+        responseBodyBudget.set(page, budget);
+      }
+      return {ok: true, buffer};
+    } catch (error) {
+      return {
+        ok: fals
```

**File**: `src/formatters/networkFormatter.ts` (modified, +60/-26)
```diff
@@ -6,7 +6,11 @@
 
 import {isUtf8} from 'node:buffer';
 
-import {networkRequestObservedAtSymbol} from '../PageCollector.js';
+import {
+  networkRequestObservedAtSymbol,
+  responseBodyCacheSymbol,
+} from '../PageCollector.js';
+import type {CachedResponseBody} from '../PageCollector.js';
 import type {HTTPRequest, HTTPResponse} from '../third_party/index.js';
 
 const BODY_CONTEXT_SIZE_LIMIT = 4096;
@@ -318,35 +322,29 @@ export async function getFormattedResponseBody(
   httpResponse: HTTPResponse,
   sizeLimit = BODY_CONTEXT_SIZE_LIMIT,
 ): Promise<string | undefined> {
-  try {
-    const responseBuffer = await withTimeout(
-      httpResponse.body(),
-      BODY_FETCH_TIMEOUT_MS,
-    );
-
-    if (isUtf8(responseBuffer)) {
-      const responseAsTest = responseBuffer.toString('utf-8');
-      const contentType = getHeaderValue(
-        httpResponse.headers(),
-        'content-type',
-      );
+  const read = await readResponseBody(httpResponse);
+  if (!read.ok) {
+    return `<${read.error}>`;
+  }
+  const responseBuffer = read.buffer;
 
-      if (responseAsTest.length === 0) {
-        return `<empty response>`;
-      }
+  if (isUtf8(responseBuffer)) {
+    const responseAsTest = responseBuffer.toString('utf-8');
+    const contentType = getHeaderValue(httpResponse.headers(), 'content-type');
 
-      return getFormattedTextBody(
-        responseAsTest,
-        contentType,
-        sizeLimit,
-        'responseBody',
-      );
+    if (responseAsTest.length === 0) {
+      return `<empty response>`;
     }
 
-    return `<binary data>`;
-  } catch {
-    return `<not available anymore>`;
+    return getFormattedTextBody(
+      responseAsTest,
+      contentType,
+      sizeLimit,
+      'responseBody',
+    );
   }
+
+  return `<binary data>`;
 }
 
 export async function getFormattedRequestBody(
@@ -1047,18 +1045,54 @@ function getSetCookieName(setCookieHeader: string): string {
   return setCookieHeader.slice(0, eq).trim() || '<unnamed>';
 }
 
+type RequestWithBodyCache = HTTPRequest & {
+  [responseBodyCacheSymbol]?: Promise<CachedResponseBody>;
+};
+
+/**
+ * Read the response body eagerly cached at `requestfinished` time, if any.
+ * Returns undefined when no capture was started (e.g. pending request).
+ */
+async function getCachedBody(
+  httpResponse: HTTPResponse,
+): Promise<CachedResponseBody | undefined> {
+  try {
+    const request = httpResponse.request() as RequestWithBodyCache;
+    const cached = request[responseBodyCacheSymbol];
+    return cached ? await cached : undefined;
+  } catch {
+    return undefined;
+  }
+}
+
 async function readResponseBody(
   httpResponse: HTTPResponse,
 ): Promise<ResponseBodyRead> {
+  // Prefer the body captured before any navigation could evict it.
+  const cached = await getCachedBody(httpResponse);
+  if (cached?.ok === true) {
+    return {ok: true, buffer: cached.buffer};
+  }
+
+  // Fall back to a live fetch. This still succeeds for current-navigation or
+  // small responses; for bodies the cache deliberately skipped (too large), it
+  // also recovers the full body as long as the loader is still alive.
   try {
     return {
       ok: true,
       buffer: await withTimeout(httpResponse.body(), BODY_FETCH_TIMEOUT_MS),
     };
   } catch (error) {
+    const liveError = error instanceof Error ? error.message : String(error);
+    if (cached?.ok === 'skipped') {
+      return {
+        ok: false,
+        error: `not cached (${cached.reason}); export with outputFile to fetch the full body. live fetch failed: ${liveError}`,
+      };
+    }
     return {
       ok: false,
-      error: error instanceof Error ? error.message : String(error),
+      error: 'not available anymore — body evicted after navigation',
     };
   }
 }
```

**File**: `tests/formatters/networkFormatter.test.ts` (modified, +88/-1)
```diff
@@ -10,11 +10,17 @@ import {test} from 'node:test';
 import {
   exportNetworkRequestPart,
   getFormattedHeaderEntries,
+  getFormattedResponseBody,
   getShortDescriptionForRequestAsync,
   getStatusFromRequestAsync,
   headersContainSensitiveValues,
 } from '../../src/formatters/networkFormatter.js';
-import type {HTTPRequest} from '../../src/third_party/index.js';
+import {responseBodyCacheSymbol} from '../../src/PageCollector.js';
+import type {CachedResponseBody} from '../../src/PageCollector.js';
+import type {
+  HTTPRequest,
+  Response as HTTPResponse,
+} from '../../src/third_party/index.js';
 
 test('redacts sensitive inline header values', () => {
   const lines = getFormattedHeaderEntries([
@@ -93,6 +99,87 @@ test('allows pending request-side exports', async () => {
   assert.match(Buffer.from(queryParams.data).toString('utf8'), /"a": "1"/);
 });
 
+test('reads the eagerly cached body after the live body was evicted', async () => {
+  // body() throws to simulate the browser evicting the body after navigation;
+  // the cache captured at requestfinished time must still serve it.
+  const response = createFinishedResponse({
+    bodyThrows: true,
+    contentType: 'application/json',
+    cache: {ok: true, buffer: Buffer.from('{"token":"abc"}')},
+  });
+
+  const out = await getFormattedResponseBody(response);
+  assert.ok(out);
+  assert.match(out, /"token":"abc"/);
+});
+
+test('reports body eviction when neither cache nor live body is available', async () => {
+  const response = createFinishedResponse({bodyThrows: true});
+
+  assert.equal(
+    await getFormattedResponseBody(response),
+    '<not available anymore — body evicted after navigation>',
+  );
+});
+
+test('explains skipped-cache fallback when the body was too large to cache', async () => {
+  const response = createFinishedResponse({
+    bodyThrows: true,
+    cache: {ok: 'skipped', reason: 'body 9000000 bytes exceeds cache limit'},
+  });
+
+  const out = await getFormattedResponseBody(response);
+  assert.ok(out);
+  assert.match(out, /not cached/);
+  assert.match(out, /export with outputFile/);
+});
+
+test('falls back to a live body fetch when nothing was cached', async () => {
+  const response = createFinishedResponse({
+    bodyBuffer: Buffer.from('hello world'),
+    contentType: 'text/plain',
+  });
+
+  const out = await getFormattedResponseBody(response);
+  assert.ok(out);
+  assert.match(out, /hello world/);
+});
+
+function createFinishedResponse(opts: {
+  bodyBuffer?: Buffer;
+  bodyThrows?: boolean;
+  contentType?: string;
+  cache?: CachedResponseBody;
+}): HTTPResponse {
+  const request = {
+    failure: () => null,
+  } as unknown as HTTPRequest & {
+    response: () => Promise<HTTPResponse>;
+    [responseBodyCacheSymbol]?: Promise<CachedResponseBody>;
+  };
+
+  const response = {
+    request: () => request,
+    status: () => 200,
+    headers: () => ({
+      'content-type': opts.contentType ?? 'application/json',
+    }),
+    body: async () => {
+      if (opts.bodyThrows) {
+        throw new Error('No resource with given identifier found');
+      }
+      return opts.bodyBuffer ?? Buffer.from('');
+    },
+  } as unknown as HTTPResponse;
+
+  request.response = async () => response;
+  if (opts.cache) {
+    request[responseBodyCacheSymbol] = Promise.resolve(opts.cache);
+  }
+
+  return response;
+}
+
 function createPendingRequest(): HTTPRequest {
   return {
     failure: () => null,
```

---

### Incident Patch 6: `8a7be1a4` (2026-06-21)
**Commit Message**: fix(navigation): return when reload pauses at breakpoint

**File**: `src/tools/pages.ts` (modified, +111/-51)
```diff
@@ -11,6 +11,54 @@ import {defineTool, timeoutSchema} from './ToolDefinition.js';
 
 // Default navigation timeout in milliseconds (10 seconds)
 const DEFAULT_NAV_TIMEOUT = 10000;
+const PAUSE_POLL_INTERVAL_MS = 50;
+
+export type NavigationWaitResult =
+  | {status: 'completed'}
+  | {status: 'paused'}
+  | {status: 'error'; error: unknown};
+
+type PauseStateReader = {
+  isEnabled(): boolean;
+  isPaused(): boolean;
+};
+
+function delay(ms: number): Promise<void> {
+  return new Promise(resolve => setTimeout(resolve, ms));
+}
+
+export async function waitForNavigationOrPause(
+  navigation: Promise<unknown>,
+  debugger_: PauseStateReader,
+): Promise<NavigationWaitResult> {
+  const navigationResult = navigation.then(
+    () => ({status: 'completed'}) as const,
+    error => ({status: 'error', error}) as const,
+  );
+
+  if (!debugger_.isEnabled()) {
+    return navigationResult;
+  }
+
+  let stopped = false;
+  const pauseResult = (async (): Promise<NavigationWaitResult> => {
+    while (!stopped) {
+      if (debugger_.isPaused()) {
+        return {status: 'paused'};
+      }
+      await delay(PAUSE_POLL_INTERVAL_MS);
+    }
+    return {status: 'completed'};
+  })();
+
+  const result = await Promise.race([navigationResult, pauseResult]);
+  stopped = true;
+  return result;
+}
+
+function getErrorMessage(error: unknown): string {
+  return error instanceof Error ? error.message : String(error);
+}
 
 export const selectPage = defineTool({
   name: 'select_page',
@@ -146,96 +194,108 @@ export const navigatePage = defineTool({
         if (!request.params.url) {
           throw new Error('A URL is required for navigation of type=url.');
         }
-        try {
-          await page.goto(request.params.url, {
-            ...options,
-            waitUntil: 'domcontentloaded',
-            referer: DEFAULT_REFERER,
-          });
-          response.appendResponseLine(
-            `Successfully navigated to ${request.params.url}.`,
-          );
-          response.appendResponseLine(
-            'Note: Any previously obtained script IDs are now invalid. Use script URLs instead.',
+        {
+          const result = await waitForNavigationOrPause(
+            page.goto(request.params.url, {
+              ...options,
+              waitUntil: 'domcontentloaded',
+              referer: DEFAULT_REFERER,
+            }),
+            debugger_,
           );
-        } catch (error) {
-          if (debugger_.isPaused()) {
+          if (result.status === 'completed') {
+            response.appendResponseLine(
+              `Successfully navigated to ${request.params.url}.`,
+            );
+            response.appendResponseLine(
+              'Note: Any previously obtained script IDs are now invalid. Use script URLs instead.',
+            );
+          } else if (result.status === 'paused' || debugger_.isPaused()) {
             response.appendResponseLine(
               `Navigation to ${request.params.url} started but execution is paused at a breakpoint. Use get_paused_info to inspect, then resume to continue loading.`,
             );
           } else {
             response.appendResponseLine(
-              `Unable to navigate in the selected page: ${error.message}.`,
+              `Unable to navigate in the selected page: ${getErrorMessage(result.error)}.`,
             );
           }
         }
         break;
       case 'back':
-        try {
-          await page.goBack({
-            ...options,
-            waitUntil: 'domcontentloaded',
-          });
-          response.appendResponseLine(
-            `Successfully navigated back to ${page.url()}.`,
-          );
-          response.appendResponseLine(
-            'Note: Any previously obtained script IDs are now invalid. Use script URLs instead.',
+        {
+          const result = await waitForNavigationOrPause(
+            page.goBack({
+              ...options,
+              waitUntil: 'domcontentloaded',
+            }),
+   
```

**File**: `tests/tools/pages.test.ts` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+/**
+ * @license
+ * Copyright 2025 Google LLC
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+import assert from 'node:assert/strict';
+import {test} from 'node:test';
+
+import {waitForNavigationOrPause} from '../../src/tools/pages.js';
+
+function createDebuggerState() {
+  let enabled = true;
+  let paused = false;
+  return {
+    debugger_: {
+      isEnabled: () => enabled,
+      isPaused: () => paused,
+    },
+    setEnabled: (value: boolean) => {
+      enabled = value;
+    },
+    setPaused: (value: boolean) => {
+      paused = value;
+    },
+  };
+}
+
+test('waits for navigation when debugger does not pause', async () => {
+  const state = createDebuggerState();
+
+  const result = await waitForNavigationOrPause(
+    Promise.resolve(),
+    state.debugger_,
+  );
+
+  assert.deepEqual(result, {status: 'completed'});
+});
+
+test('returns paused when debugger pauses before navigation completes', async () => {
+  const state = createDebuggerState();
+  const navigation = new Promise(() => undefined);
+
+  setTimeout(() => {
+    state.setPaused(true);
+  }, 0);
+
+  const result = await waitForNavigationOrPause(navigation, state.debugger_);
+
+  assert.deepEqual(result, {status: 'paused'});
+});
```

---

### Incident Patch 7: `8e7b1c83` (2026-06-21)
**Commit Message**: fix(network): do not block listing pending requests

**File**: `src/formatters/networkFormatter.ts` (modified, +12/-0)
```diff
@@ -126,13 +126,25 @@ export async function getShortDescriptionForRequestAsync(
   selectedInDevToolsUI = false,
   includeSetCookieMarker = false,
 ): Promise<string> {
+  if (!hasFinishedOrFailed(request)) {
+    return getShortDescriptionForRequest(request, id, selectedInDevToolsUI);
+  }
+
   const status = await getStatusFromRequestAsync(request);
   const setCookieMarker = includeSetCookieMarker
     ? await getSetCookieListMarker(request)
     : '';
   return `reqid=${id} ${getFormattedRequestTimingBrief(request)} [${request.resourceType()}] ${request.method()} ${getUrlForList(request.url())} ${status}${setCookieMarker}${selectedInDevToolsUI ? ` [selected in the DevTools Network panel]` : ''}`;
 }
 
+function hasFinishedOrFailed(request: HTTPRequest): boolean {
+  if (request.failure()) {
+    return true;
+  }
+
+  return isAvailableTiming(request.timing().responseEnd);
+}
+
 export function getFormattedRequestTimingBrief(request: HTTPRequest): string {
   const timing = request.timing();
   const start = getRequestStartTiming(request, timing);
```

**File**: `tests/formatters/networkFormatter.test.ts` (modified, +30/-0)
```diff
@@ -9,8 +9,10 @@ import {test} from 'node:test';
 
 import {
   getFormattedHeaderEntries,
+  getShortDescriptionForRequestAsync,
   headersContainSensitiveValues,
 } from '../../src/formatters/networkFormatter.js';
+import type {HTTPRequest} from '../../src/third_party/index.js';
 
 test('redacts sensitive inline header values', () => {
   const lines = getFormattedHeaderEntries([
@@ -43,3 +45,31 @@ test('does not treat Set-Cookie as a redacted generic header', () => {
     false,
   );
 });
+
+test('formats pending request list entries without waiting for a response', async () => {
+  const request = {
+    failure: () => null,
+    method: () => 'POST',
+    resourceType: () => 'xhr',
+    response: () => {
+      throw new Error('response() should not be called for pending requests');
+    },
+    timing: () => ({
+      startTime: -1,
+      domainLookupStart: -1,
+      domainLookupEnd: -1,
+      connectStart: -1,
+      secureConnectionStart: -1,
+      connectEnd: -1,
+      requestStart: -1,
+      responseStart: -1,
+      responseEnd: -1,
+    }),
+    url: () => 'https://example.test/api',
+  } as unknown as HTTPRequest;
+
+  assert.equal(
+    await getShortDescriptionForRequestAsync(request, 7, false, true),
+    'reqid=7 [time unavailable, pending] [xhr] POST https://example.test/api [pending]',
+  );
+});
```

---

### Incident Patch 8: `ba53ffc8` (2026-06-21)
**Commit Message**: fix(network): redact sensitive inline headers

**File**: `docs/tool-reference.md` (modified, +1/-1)
```diff
@@ -98,7 +98,7 @@
 
 ### `list_network_requests`
 
-**Description:** List network requests for the currently selected page since the last navigation. Results are sorted newest-first and include request start time plus duration. By default returns the 20 most recent requests; use pageSize/pageIdx to paginate. List output is an index: it shows status, summarized long URLs, and Set-Cookie names, not header/body contents. Pass reqid to inspect one request with timing, bounded inline headers and content-type-aware body previews, and a dedicated Set-Cookie section that shows raw values up to 1KB total. When exact bytes, full bodies, replay inputs, signature inputs, large request bodies, long GET query payloads, binary responses, full headers, full Set-Cookie values, or data for external decoding are needed, pass reqid with outputFile to export the selected data. For GET requests, payload-like data means parsed URL query parameters.
+**Description:** List network requests for the currently selected page since the last navigation. Results are sorted newest-first and include request start time plus duration. By default returns the 20 most recent requests; use pageSize/pageIdx to paginate. List output is an index: it shows status, summarized long URLs, and Set-Cookie names, not header/body contents. Pass reqid to inspect one request with timing, bounded inline headers where sensitive values such as Cookie, Authorization, and token-like headers are redacted, content-type-aware body previews, and a dedicated Set-Cookie section that shows raw values up to 1KB total. When exact bytes, full bodies, replay inputs, signature inputs, large request bodies, long GET query payloads, binary responses, full headers, full Set-Cookie values, or data for external decoding are needed, pass reqid with outputFile to export the selected data. For GET requests, payload-like data means parsed URL query parameters.
 
 **Parameters:**
 
```

**File**: `src/formatters/networkFormatter.ts` (modified, +104/-4)
```diff
@@ -18,6 +18,25 @@ const LIST_URL_CONTEXT_LIMIT = 240;
 const LONG_URL_LIMIT = 2000;
 const LONG_QUERY_LIMIT = 1000;
 const SET_COOKIE_CONTEXT_SIZE_LIMIT = 1024;
+const COOKIE_HEADER_NAME_LIMIT = 10;
+
+const SENSITIVE_HEADER_EXACT_NAMES = new Set([
+  'authorization',
+  'cookie',
+  'proxy-authorization',
+  'x-api-key',
+]);
+
+const SENSITIVE_HEADER_NAME_FRAGMENTS = [
+  'token',
+  'secret',
+  'password',
+  'api-key',
+  'apikey',
+  'session',
+  'csrf',
+  'xsrf',
+];
 
 type RequestTiming = ReturnType<HTTPRequest['timing']>;
 type TimingSource = 'browser' | 'observed';
@@ -52,6 +71,7 @@ export interface HeaderEntry {
 interface HeaderFormatOptions {
   sizeLimit?: number;
   omittedLabel?: string;
+  redactSensitiveValues?: boolean;
 }
 
 type BodySnapshot =
@@ -220,8 +240,14 @@ export function getFormattedHeaderEntries(
 ): string[] {
   const sizeLimit = options.sizeLimit ?? HEADER_CONTEXT_SIZE_LIMIT;
   const omittedLabel = options.omittedLabel ?? 'header entries';
+  const redactSensitiveValues = options.redactSensitiveValues ?? true;
   return getSizeLimitedLines(
-    headers.map(({name, value}) => `- ${name}:${value}`),
+    headers.map(({name, value}) => {
+      const formattedValue = redactSensitiveValues
+        ? formatInlineHeaderValue(name, value)
+        : value;
+      return `- ${name}:${formattedValue}`;
+    }),
     sizeLimit,
     omittedLabel,
   );
@@ -397,6 +423,11 @@ export async function getNetworkRequestExportHints(
   const requestHeaders = await getRequestHeadersArray(httpRequest).catch(
     () => [],
   );
+  if (headersContainSensitiveValues(requestHeaders)) {
+    hints.push(
+      `Sensitive request header values are redacted inline. For exact request headers, re-run with outputPart="all" and outputFile="network-req-${reqid}.json".`,
+    );
+  }
   if (headersWillBeTruncated(requestHeaders)) {
     hints.push(
       `Request headers are truncated inline. For exact request headers, re-run with outputPart="all" and outputFile="network-req-${reqid}.json".`,
@@ -408,14 +439,20 @@ export async function getNetworkRequestExportHints(
     const headers = httpResponse.headers();
     const responseHeadersArray = await getResponseHeadersArray(httpResponse);
     const setCookieHeaders = getSetCookieHeaders(responseHeadersArray);
+    const responseHeadersWithoutSetCookie =
+      getHeadersExcludingSetCookie(responseHeadersArray);
     const contentType = getHeaderValue(headers, 'content-type');
     const sizes = await httpRequest.sizes().catch(() => undefined);
     const responseBodySize = sizes?.responseBodySize ?? 0;
 
+    if (headersContainSensitiveValues(responseHeadersWithoutSetCookie)) {
+      hints.push(
+        `Sensitive response header values are redacted inline. For exact response headers, re-run with outputPart="responseHeaders" and outputFile="network-req-${reqid}-response-headers.json".`,
+      );
+    }
+
     if (
-      headersWillBeTruncated(
-        getHeadersExcludingSetCookie(responseHeadersArray),
-      ) ||
+      headersWillBeTruncated(responseHeadersWithoutSetCookie) ||
       setCookiesWillBeTruncated(setCookieHeaders)
     ) {
       hints.push(
@@ -445,6 +482,69 @@ function getSizeLimitedString(text: string, sizeLimit: number) {
   return `${text}`;
 }
 
+function formatInlineHeaderValue(name: string, value: string): string {
+  const normalizedName = name.toLowerCase();
+
+  if (normalizedName === 'set-cookie') {
+    return value;
+  }
+
+  if (normalizedName === 'cookie') {
+    const names = getCookieHeaderNames(value);
+    if (!names.length) {
+      return `<redacted cookie header, ${value.length} chars>`;
+    }
+
+    const shown = names.slice(0, COOKIE_HEADER_NAME_LIMIT).join(', ');
+    const remaining = names.length - COOKIE_HEADER_NAME_LIMIT;
+    return `<redacted cookie header; names: ${shown}${remaining > 0 ? `, +${remaining} more` : ''}; ${value.length} chars>`;
+  }
+
+  if (
+    normalizedName === 'authorization' ||
+    normalized
```

**File**: `src/tools/network.ts` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ const NETWORK_EXPORT_PARTS = [
 
 export const listNetworkRequests = defineTool({
   name: 'list_network_requests',
-  description: `List network requests for the currently selected page since the last navigation. Results are sorted newest-first and include request start time plus duration. By default returns the 20 most recent requests; use pageSize/pageIdx to paginate. List output is an index: it shows status, summarized long URLs, and Set-Cookie names, not header/body contents. Pass reqid to inspect one request with timing, bounded inline headers and content-type-aware body previews, and a dedicated Set-Cookie section that shows raw values up to 1KB total. When exact bytes, full bodies, replay inputs, signature inputs, large request bodies, long GET query payloads, binary responses, full headers, full Set-Cookie values, or data for external decoding are needed, pass reqid with outputFile to export the selected data. For GET requests, payload-like data means parsed URL query parameters.`,
+  description: `List network requests for the currently selected page since the last navigation. Results are sorted newest-first and include request start time plus duration. By default returns the 20 most recent requests; use pageSize/pageIdx to paginate. List output is an index: it shows status, summarized long URLs, and Set-Cookie names, not header/body contents. Pass reqid to inspect one request with timing, bounded inline headers where sensitive values such as Cookie, Authorization, and token-like headers are redacted, content-type-aware body previews, and a dedicated Set-Cookie section that shows raw values up to 1KB total. When exact bytes, full bodies, replay inputs, signature inputs, large request bodies, long GET query payloads, binary responses, full headers, full Set-Cookie values, or data for external decoding are needed, pass reqid with outputFile to export the selected data. For GET requests, payload-like data means parsed URL query parameters.`,
   annotations: {
     category: ToolCategory.NETWORK,
     // Not read-only due to outputFile export support.
```

**File**: `tests/formatters/networkFormatter.test.ts` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+/**
+ * @license
+ * Copyright 2025 Google LLC
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+import assert from 'node:assert/strict';
+import {test} from 'node:test';
+
+import {
+  getFormattedHeaderEntries,
+  headersContainSensitiveValues,
+} from '../../src/formatters/networkFormatter.js';
+
+test('redacts sensitive inline header values', () => {
+  const lines = getFormattedHeaderEntries([
+    {name: 'Accept', value: 'application/json'},
+    {name: 'Cookie', value: 'sid=abc; theme=light'},
+    {name: 'Authorization', value: 'Bearer abc.def'},
+    {name: 'X-CSRF-Token', value: 'secret'},
+  ]);
+
+  assert.deepEqual(lines, [
+    '- Accept:application/json',
+    '- Cookie:<redacted cookie header; names: sid, theme; 20 chars>',
+    '- Authorization:<redacted authorization; scheme: Bearer; 14 chars>',
+    '- X-CSRF-Token:<redacted sensitive header; 6 chars>',
+  ]);
+});
+
+test('keeps exact header values when redaction is disabled', () => {
+  const lines = getFormattedHeaderEntries(
+    [{name: 'Authorization', value: 'Bearer abc.def'}],
+    {redactSensitiveValues: false},
+  );
+
+  assert.deepEqual(lines, ['- Authorization:Bearer abc.def']);
+});
+
+test('does not treat Set-Cookie as a redacted generic header', () => {
+  assert.equal(
+    headersContainSensitiveValues([{name: 'Set-Cookie', value: 'sid=abc'}]),
+    false,
+  );
+});
```

---

### Incident Patch 9: `af9d10f4` (2026-06-21)
**Commit Message**: fix(websocket): compact json payload previews

**File**: `src/formatters/websocketFormatter.ts` (modified, +7/-3)
```diff
@@ -191,19 +191,23 @@ function formatPayload(
 
   // Text data - try to format as JSON if possible
   let formattedPayload = payload;
+  let prefix = '';
 
   try {
     const parsed = JSON.parse(payload);
-    formattedPayload = JSON.stringify(parsed, null, 2);
+    formattedPayload = JSON.stringify(parsed);
+    if (formattedPayload.length < payload.length) {
+      prefix = '<JSON payload compacted for inline preview>\n';
+    }
   } catch {
     // Not JSON, use raw payload
   }
 
   if (formattedPayload.length > sizeLimit) {
-    return formattedPayload.slice(0, sizeLimit) + '... <truncated>';
+    return `${prefix}${formattedPayload.slice(0, sizeLimit)}... <truncated ${formattedPayload.length - sizeLimit} chars>`;
   }
 
-  return formattedPayload;
+  return `${prefix}${formattedPayload}`;
 }
 
 // ============================================================================
```

---

### Incident Patch 10: `500b3f87` (2026-06-21)
**Commit Message**: fix(console): avoid eager argument expansion

**File**: `src/McpResponse.ts` (modified, +3/-13)
```diff
@@ -9,6 +9,7 @@ import {AggregatedIssue} from '../node_modules/chrome-devtools-frontend/mcp/mcp.
 import {mapIssueToMessageObject} from './DevtoolsUtils.js';
 import type {ConsoleMessageData} from './formatters/consoleFormatter.js';
 import {
+  formatConsoleArgValue,
   formatConsoleEventShort,
   formatConsoleEventVerbose,
 } from './formatters/consoleFormatter.js';
@@ -257,9 +258,7 @@ export class McpResponse implements Response {
               const stringArg = await arg.jsonValue().catch(() => {
                 // Ignore errors.
               });
-              return typeof stringArg === 'object'
-                ? JSON.stringify(stringArg)
-                : String(stringArg);
+              return formatConsoleArgValue(stringArg);
             }),
           ),
         };
@@ -313,16 +312,7 @@ export class McpResponse implements Response {
                 consoleMessageStableId,
                 type: consoleMessage.type(),
                 message: consoleMessage.text(),
-                args: await Promise.all(
-                  consoleMessage.args().map(async arg => {
-                    const stringArg = await arg.jsonValue().catch(() => {
-                      // Ignore errors.
-                    });
-                    return typeof stringArg === 'object'
-                      ? JSON.stringify(stringArg)
-                      : String(stringArg);
-                  }),
-                ),
+                argCount: consoleMessage.args().length,
               };
             }
             if (item instanceof AggregatedIssue) {
```

**File**: `src/formatters/consoleFormatter.ts` (modified, +20/-6)
```diff
@@ -13,15 +13,19 @@ export interface ConsoleMessageData {
   message?: string;
   count?: number;
   description?: string;
+  argCount?: number;
   args?: string[];
 }
 
+const CONSOLE_ARG_SIZE_LIMIT = 2000;
+const CONSOLE_MESSAGE_SIZE_LIMIT = 1000;
+
 // The short format for a console message, based on a previous format.
 export function formatConsoleEventShort(msg: ConsoleMessageData): string {
   if (msg.type === 'issue') {
-    return `msgid=${msg.consoleMessageStableId} [${msg.type}] ${msg.message} (count: ${msg.count})`;
+    return `msgid=${msg.consoleMessageStableId} [${msg.type}] ${getSizeLimitedString(msg.message ?? '', CONSOLE_MESSAGE_SIZE_LIMIT)} (count: ${msg.count})`;
   }
-  return `msgid=${msg.consoleMessageStableId} [${msg.type}] ${msg.message} (${msg.args?.length ?? 0} args)`;
+  return `msgid=${msg.consoleMessageStableId} [${msg.type}] ${getSizeLimitedString(msg.message ?? '', CONSOLE_MESSAGE_SIZE_LIMIT)} (${msg.argCount ?? msg.args?.length ?? 0} args)`;
 }
 
 function getArgs(msg: ConsoleMessageData) {
@@ -40,14 +44,22 @@ export function formatConsoleEventVerbose(msg: ConsoleMessageData): string {
   const aggregatedIssue = msg.item;
   const result = [
     `ID: ${msg.consoleMessageStableId}`,
-    `Message: ${msg.type}> ${aggregatedIssue ? formatIssue(aggregatedIssue, msg.description) : msg.message}`,
+    `Message: ${msg.type}> ${aggregatedIssue ? formatIssue(aggregatedIssue, msg.description) : getSizeLimitedString(msg.message ?? '', CONSOLE_MESSAGE_SIZE_LIMIT)}`,
     aggregatedIssue ? undefined : formatArgs(msg),
   ].filter(line => !!line);
   return result.join('\n');
 }
 
-function formatArg(arg: unknown) {
-  return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
+export function formatConsoleArgValue(arg: unknown): string {
+  const value = typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
+  return getSizeLimitedString(value, CONSOLE_ARG_SIZE_LIMIT);
+}
+
+function getSizeLimitedString(text: string, sizeLimit: number): string {
+  if (text.length > sizeLimit) {
+    return `${text.slice(0, sizeLimit)}... <truncated ${text.length - sizeLimit} chars>`;
+  }
+  return text;
 }
 
 function formatArgs(consoleData: ConsoleMessageData): string {
@@ -60,7 +72,9 @@ function formatArgs(consoleData: ConsoleMessageData): string {
   const result = ['### Arguments'];
 
   for (const [key, arg] of args.entries()) {
-    result.push(`Arg #${key}: ${formatArg(arg)}`);
+    result.push(
+      `Arg #${key}: ${getSizeLimitedString(String(arg), CONSOLE_ARG_SIZE_LIMIT)}`,
+    );
   }
 
   return result.join('\n');
```

#### Recent Merged Pull Requests:
- *No recent PR discussions fetched.*

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
