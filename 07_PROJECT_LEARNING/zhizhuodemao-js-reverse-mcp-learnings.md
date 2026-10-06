# Forensic Learning Record (Deep Inspection): zhizhuodemao/js-reverse-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/zhizhuodemao-js-reverse-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zhizhuodemao/js-reverse-mcp](https://github.com/zhizhuodemao/js-reverse-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:06:21.844Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zhizhuodemao/js-reverse-mcp`
- **Description**: AI Agent-first JS 逆向 MCP Server：有头 Chrome 调试、断点、网络/WebSocket 分析、Patchright 反检测，可选 CloakBrowser。
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2889 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

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

### Core Architecture Module: `src/utils/keyboard.ts`
```
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Playwright doesn't export KeyInput type; use string
type KeyInput = string;

// See the KeyInput type for the list of supported keys.
const validKeys = new Set([
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'Power',
  'Eject',
  'Abort',
  'Help',
  'Backspace',
  'Tab',
  'Numpad5',
  'NumpadEnter',
  'Enter',
  '\r',
  '\n',
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'Pause',
  'CapsLock',
  'Escape',
  'Convert',
  'NonConvert',
  'Space',
  'Numpad9',
  'PageUp',
  'Numpad3',
  'PageDown',
  'End',
  'Numpad1',
  'Home',
  'Numpad7',
  'ArrowLeft',
  'Numpad4',
  'Numpad8',
  'ArrowUp',
  'ArrowRight',
  'Numpad6',
  'Numpad2',
  'ArrowDown',
  'Select',
  'Open',
  'PrintScreen',
  'Insert',
  'Numpad0',
  'Delete',
  'NumpadDecimal',
  'Digit0',
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
  'Digit7',
  'Digit8',
  'Digit9',
  'KeyA',
  'KeyB',
  'KeyC',
  'KeyD',
  'KeyE',
  'KeyF',
  'KeyG',
  'KeyH',
  'KeyI',
  'KeyJ',
  'KeyK',
  'KeyL',
  'KeyM',
  'KeyN',
  'KeyO',
  'KeyP',
  'KeyQ',
  'KeyR',
  'KeyS',
  'KeyT',
  'KeyU',
  'KeyV',
  'KeyW',
  'KeyX',
  'KeyY',
  'KeyZ',
  'MetaLeft',
  'MetaRight',
  'ContextMenu',
  'NumpadMultiply',
  'NumpadAdd',
  'NumpadSubtract',
  'NumpadDivide',
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
  'F8',
  'F9',
  'F10',
  'F11',
  'F12',
  'F13',
  'F14',
  'F15',
  'F16',
  'F17',
  'F18',
  'F19',
  'F20',
  'F21',
  'F22',
  'F23',
  'F24',
  'NumLock',
  'ScrollLock',
  'AudioVolumeMute',
  'AudioVolumeDown',
  'AudioVolumeUp',
  'MediaTrackNext',
  'MediaTrackPrevious',
  'MediaStop',
  'MediaPlayPause',
  'Semicolon',
  'Equal',
  'NumpadEqual',
  'Comma',
  'Minus',
  'Period',
  'Slash',
  'Backquote',
  'BracketLeft',
  'Backslash',
  'BracketRight',
  'Quote',
  'AltGraph',
  'Props',
  'Cancel',
  'Clear',
  'Shift',
  'Control',
  'Alt',
  'Accept',
  'ModeChange',
  ' ',
  'Print',
  'Execute',
  '\u0000',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
  'Meta',
  '*',
  '+',
  '-',
  '/',
  ';',
  '=',
  ',',
  '.',
  '`',
  '[',
  '\\',
  ']',
  "'",
  'Attn',
  'CrSel',
  'ExSel',
  'EraseEof',
  'Play',
  'ZoomOut',
  ')',
  '!',
  '@',
  '#',
  '$',
  '%',
  '^',
  '&',
  '(',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
  ':',
  '<',
  '_',
  '>',
  '?',
  '~',
  '{',
  '|',
  '}',
  '"',
  'SoftLeft',
  'SoftRight',
  'Camera',
  'Call',
  'EndCall',
  'VolumeDown',
  'VolumeUp',
]);

function throwIfInvalidKey(key: string): KeyInput {
  if (validKeys.has(key)) {
    return key as KeyInput;
  }
  throw new Error(
    `${key} is invalid. Valid keys are: ${Array.from(validKeys.values()).join(',')}.`,
  );
}

/**
 * Returns the primary key, followed by modifiers in original order.
 */
export function parseKey(keyInput: string): [KeyInput, ...KeyInput[]] {
  let key = '';
  const result: KeyInput[] = [];
  for (const ch of keyInput) {
    // Handle cases like Shift++.
    if (ch === '+' && key) {
      result.push(throwIfInvalidKey(key));
      key = '';
    } else {
      key += ch;
    }
  }
  if (key) {
    result.push(throwIfInvalidKey(key));
  }

  if (result.length === 0) {
    throw new Error(`Key ${keyInput} could not be parsed.`);
  }

  if (new Set(result).size !== result.length) {
    throw new Error(`Key ${keyInput} contains duplicate keys.`);
  }

  return [result.at(-1), ...result.slice(0, -1)] as [KeyInput, ...KeyInput[]];
}

```

### Core Architecture Module: `src/utils/pagination.ts`
```
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {PaginationOptions} from './types.js';

export interface PaginationResult<Item> {
  items: readonly Item[];
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startIndex: number;
  endIndex: number;
  invalidPage: boolean;
}

const DEFAULT_PAGE_SIZE = 20;

export function paginate<Item>(
  items: readonly Item[],
  options?: PaginationOptions,
): PaginationResult<Item> {
  const total = items.length;

  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const {currentPage, invalidPage} = resolvePageIndex(
    options?.pageIdx,
    totalPages,
  );

  const startIndex = currentPage * pageSize;
  const pageItems = items.slice(startIndex, startIndex + pageSize);
  const endIndex = startIndex + pageItems.length;

  return {
    items: pageItems,
    currentPage,
    totalPages,
    hasNextPage: currentPage < totalPages - 1,
    hasPreviousPage: currentPage > 0,
    startIndex,
    endIndex,
    invalidPage,
  };
}

function resolvePageIndex(
  pageIdx: number | undefined,
  totalPages: number,
): {
  currentPage: number;
  invalidPage: boolean;
} {
  if (pageIdx === undefined) {
    return {currentPage: 0, invalidPage: false};
  }

  if (pageIdx < 0 || pageIdx >= totalPages) {
    return {currentPage: 0, invalidPage: true};
  }

  return {currentPage: pageIdx, invalidPage: false};
}

```

### Core Architecture Module: `src/utils/types.ts`
```
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PaginationOptions {
  pageSize?: number;
  pageIdx?: number;
}

```

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
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${location} must be at most ${schema.maximum}.`);
    }
    if (
      schema.exclusiveMinimum !== undefined &&
      value <= schema.exclusiveMinimum
    ) {
      errors.push(
        `${location} must be greater than ${schema.exclusiveMinimum}.`,
      );
    }
    if (
      schema.exclusiveMaximum !== undefined &&
      value >= schema.exclusiveMaximum
    ) {
      errors.push(`${location} must be less than ${schema.exclusiveMaximum}.`);
    }
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(
        `${location} must contain at least ${schema.minLength} chars.`,
      );
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(
        `${location} must contain at most ${schema.maxLength} chars.`,
      );
    }
    if (
      schema.pattern !== undefined &&
      !new RegExp(schema.pattern).test(value)
    ) {
      errors.push(`${location} does not match the schema pattern.`);
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(
        `${location} must contain at least ${schema.minItems} items.`,
      );
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${location} must contain at most ${schema.maxItems} items.`);
    }
    if (schema.items) {
      errors.push(
        ...value.flatMap((item, index) =>
          validateSchemaValue(item, schema.items!, `${location}[${index}]`),
        ),
      );
    }
  }
  if (isObject(value)) {
    for (const required of schema.required ?? []) {
      if (!(required in value)) {
        errors.push(`${location}.${required} is required.`);
      }
    }
    for (const [key, child] of Object.entries(value)) {
      const childSchema = schema.properties?.[key];
      if (childSchema) {
        errors.p
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
        className: frame.this.className,
        value: frame.this.value,
        description: frame.this.description,
        objectId: frame.this.objectId,
      },
    }));

    this.#pausedState = {
      isPaused: true,
      reason: event.reason,
      callFrames,
      data: event.data,
      hitBreakpoints: event.hitBreakpoints,
    };
  };

  #onResumed = (): void => {
    this.#pausedState = {isPaused: false, callFrames: []};
  };

  // ==================== Paused State Management ====================

  /**
   * Check if execution is paused.
   */
  isPaused(): boolean {
    return this.#pausedState.isPaused;
  }

  /**
   * Get the current paused state.
   */
  getPausedState(): PausedState {
    return this.#pausedState;
  }

  /**
   * Resume execution.
   */
  async resume(): Promise<void> {
    if (!this.#client) {
      throw new Error('Debugger not enabled');
    }
    if (!this.#pausedState.isPaused) {
      throw new Error('Execution is not paused');
    }
    await this.#client.send('Debugger.resume');
  }

  /**
   * Pause execution.
   */
  async pause(): Promise<void> {
    if (!this.#client) {
      throw new Error('Debugger not enabled');
    }
    await this.#client.send('Debugger.pause');
  }

  /**
   * Wait for the next Debugger.paused event after a step command.
   * Returns the top call frame from the new paused state.
   */
  #waitForPaused(timeoutMs = 10000): Promise<CallFrame> {
    return new Promise<CallFrame>((resolve, reject) => {
      const client = this.#client;
      if (!client) {
        reject(new Error('Debugger not enabled'));
        return;
      }

      const timer = setTimeout(() => {
        removeCdpEventListener(client, 'Debugger.paused', onPaused);
        reject(new Error('Timed out waiting for debugger to pause after step'));
      }, timeoutMs);

      const onPaused = (event: Protocol.Debugger.PausedEvent): void => {
        clearTimeout(timer);
        removeCdpEventListener(client, 'Debugger.paused', onPaused);
 
```

### Core Architecture Module: `src/LocalFileAccess.ts`
```
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

import {ToolError} from './ToolError.js';

let allowedRoots: string[] | undefined;

function isWithinRoot(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== '..' &&
      !path.isAbsolute(relative))
  );
}

function assertWithinAllowedRoots(candidate: string): void {
  if (!allowedRoots) {
    return;
  }
  if (allowedRoots.some(root => isWithinRoot(candidate, root))) {
    return;
  }
  throw new ToolError(
    'PERMISSION_DENIED',
    `Local file access is outside the configured allowed roots: ${candidate}`,
  );
}

/**
 * Configure the optional local-file sandbox. Roots must already exist so their
 * real paths can be pinned before any tool call follows symlinks.
 */
export function configureAllowedRoots(roots?: readonly string[]): void {
  if (!roots?.length) {
    allowedRoots = undefined;
    return;
  }

  allowedRoots = [
    ...new Set(roots.map(root => fs.realpathSync(path.resolve(root)))),
  ];
  for (const root of allowedRoots) {
    if (!fs.statSync(root).isDirectory()) {
      throw new Error(`Allowed root is not a directory: ${root}`);
    }
  }
}

export function getAllowedRoots(): readonly string[] | undefined {
  return allowedRoots;
}

export function assertLocalFileReadAllowed(filePath: string): string {
  const resolved = fs.realpathSync(path.resolve(filePath));
  assertWithinAllowedRoots(resolved);
  return resolved;
}

export async function openLocalFileReadAllowed(filePath: string) {
  const resolved = assertLocalFileReadAllowed(filePath);
  let handle: Awaited<ReturnType<typeof fsPromises.open>> | undefined;
  try {
    handle = await fsPromises.open(
      resolved,
      fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK,
    );
    const stat = await handle.stat();
    if (!stat.isFile()) {
      await handle.close();
      throw new ToolError(
        'INVALID_ARGUMENT',
        `Local file input must be a regular file: ${resolved}`,
      );
    }
    return {handle, resolvedPath: resolved, stat};
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error.code === 'ELOOP' || error.code === 'EMLINK')
    ) {
      throw new ToolError(
        'PERMISSION_DENIED',
        `Refusing to read through a symbolic link: ${resolved}`,
        {cause: error},
      );
    }
    throw error;
  }
}

export function assertLocalFileWriteAllowed(filePath: string): string {
  const resolved = path.resolve(filePath);
  let candidate: string;
  let targetExists = false;
  try {
    const stat = fs.lstatSync(resolved);
    targetExists = true;
    if (stat.isSymbolicLink()) {
      try {
        candidate = fs.realpathSync(resolved);
      } catch (error) {
        throw new ToolError(
          'PERMISSION_DENIED',
          `Refusing to write through an unresolved symbolic link: ${resolved}`,
          {cause: error},
        );
      }
    } else {
      candidate = fs.realpathSync(resolved);
    }
  } catch (error) {
    if (error instanceof ToolError) {
      throw error;
    }
    if (
      typeof error !== 'object' ||
      error === null ||
      !('code' in error) ||
      error.code !== 'ENOENT'
    ) {
      throw error;
    }
    const parent = fs.realpathSync(path.dirname(resolved));
    candidate = path.join(parent, path.basename(resolved));
  }
  assertWithinAllowedRoots(candidate);
  if (targetExists && !fs.statSync(candidate).isFile()) {
    throw new ToolError(
      'INVALID_ARGUMENT',
      `Local file output must target a regular file: ${candidate}`,
    );
  }
  return candidate;
}

function unwrapViewSource(url: string): string {
  let result = url.trim();
  while (/^view-source:/i.test(result)) {
    result = result.slice('view-source:'.length).trimStart();
  }
  return result;
}

export function isBlockedLocalBrowserUrl(url: string): boolean {
  if (!allowedRoots) {
    return false;
  }
  const unwrapped = unwrapViewSource(url);
  try {
    const parsed = new URL(unwrapped);
    return parsed.protocol === 'file:' || /^filesystem:file:/i.test(unwrapped);
  } catch {
    return false;
  }
}

export function assertBrowserUrlAllowed(url: string): void {
  if (!isBlockedLocalBrowserUrl(url)) {
    return;
  }
  throw new ToolError(
    'PERMISSION_DENIED',
    'file: browser pages are disabled while --allowedRoots is configured.',
  );
}

export function formatBrowserUrlForOutput(url: string): string {
  return isBlockedLocalBrowserUrl(url)
    ? '[blocked local file page: --allowedRoots is configured]'
    : url;
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

### Incident Patch 2: `aff290c0` (2026-08-25)
**Commit Message**: docs: format model API guide

**File**: `docs/model-api-setup.md` (modified, +22/-22)
```diff
@@ -68,11 +68,11 @@ gpt-5.6-sol
 
 推荐关系如下：
 
-| 模型 | 适合场景 | 建议 |
-| --- | --- | --- |
-| `gpt-5.6-sol` | 复杂代码库、JS 逆向、长链路调试、高价值任务 | 本教程首选 |
-| `gpt-5.6-terra` | 常规开发、日常调试、效果与成本平衡 | 日常默认可选 |
-| `gpt-5.6-luna` | 快速检索、简单修改、批量低成本任务 | 对速度和成本更敏感时使用 |
+| 模型            | 适合场景                                    | 建议                     |
+| --------------- | ------------------------------------------- | ------------------------ |
+| `gpt-5.6-sol`   | 复杂代码库、JS 逆向、长链路调试、高价值任务 | 本教程首选               |
+| `gpt-5.6-terra` | 常规开发、日常调试、效果与成本平衡          | 日常默认可选             |
+| `gpt-5.6-luna`  | 快速检索、简单修改、批量低成本任务          | 对速度和成本更敏感时使用 |
 
 Sol 更适合复杂、开放式和需要持续推理的工作。若控制台暂时没有该模型，请先用 `/v1/models` 查看当前令牌可用的精确模型 ID，再选择 Terra 或其他可用模型。
 
@@ -304,23 +304,23 @@ new_page → list_scripts → search_in_sources → get_script_source（需要
 
 ## 8. 常见故障排查
 
-| 现象 | 常见原因 | 处理方法 |
-| --- | --- | --- |
-| `401` / `Invalid API Key` | Key 不完整、已删除、变量未在当前终端生效 | 重新复制 Key，检查前后空格；确认令牌仍启用；从设置变量的同一个终端启动客户端 |
-| `402` | 余额不足 | 在钱包管理中充值或兑换额度 |
-| `403` | 令牌分组无模型权限 | 检查令牌分组，或换用该 Key 可见的模型 |
-| `404` | API 地址或模型 ID 错误 | Codex 使用 `https://infistar.cc/v1`；Claude Code 使用 `https://infistar.cc`；模型写 `gpt-5.6-sol` |
-| 模型不存在 | 使用了展示名称，或当前 Key 看不到该模型 | 调用 `GET /v1/models`，复制 `data[].id` 的原始值 |
-| Claude Code 提示未知模型 | 客户端不认识第三方模型的上下文信息 | 使用上文的 `modelOverrides` 映射；这不等同于服务端模型不存在 |
-| MCP 列表中没有 `js-reverse` | 添加命令失败或客户端未重启 | 运行 `codex mcp list` 或 `claude mcp list`；删除后重新添加并重启客户端 |
-| Windows 提示找不到 `npx` | Node.js 未安装或 PATH 未刷新 | 重新安装 Node.js，重开终端；必要时把 MCP 命令中的 `npx` 改成 `npx.cmd` |
-| MCP 首次启动超时 | `npx` 正在下载依赖，网络较慢 | 先手动运行 `npx -y js-reverse-mcp@4.0.3 --help` 完成下载，再重启客户端 |
-| `MCP tool call requires approval, but approval policy is never` | 客户端禁止询问授权，MCP 调用无法获批 | Codex 用 `codex -a on-request` 进入交互会话并批准调用；不要在首次测试时使用 `-a never` |
-| 浏览器没有打开 | Chrome 未安装、旧进程占用或 MCP 启动失败 | 安装稳定版 Chrome，关闭残留测试浏览器，检查 MCP 状态和 stderr 日志 |
-| 工具能启动但读写文件被拒绝 | 文件不在 `--allowedRoots` 下 | 把输出路径改到专用工作目录，或重新添加正确的允许目录 |
-| 第一次使用 `--cloak` 长时间无输出 | 正在下载约 200 MB 浏览器文件 | 先运行 `npx cloakbrowser install`，等待下载完成后再启动 MCP |
-| `429` | 请求频率或并发过高 | 等待 10–30 秒，降低并发，必要时换模型 |
-| `500` / `502` / `503` / `504` | 上游波动或超时 | 等待后重试；持续出现时换模型并查看平台公告 |
+| 现象                                                            | 常见原因                                 | 处理方法                                                                                          |
+| --------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
+| `401` / `Invalid API Key`                                       | Key 不完整、已删除、变量未在当前终端生效 | 重新复制 Key，检查前后空格；确认令牌仍启用；从设置变量的同一个终端启动客户端                      |
+| `402`                                                           | 余额不足                                 | 在钱包管理中充值或兑换额度                                                                        |
+| `403`                                                           | 令牌分组无模型权限                       | 检查令牌分组，或换用该 Key 可见的模型                                                             |
+| `404`                                                           | API 地址或模型 ID 错误                   | Codex 使用 `https://infistar.cc/v1`；Claude Code 使用 `https://infistar.cc`；模型写 `gpt-5.6-sol` |
+| 模型不存在                                                      | 使用了展示名称，或当前 Key 看不到该模型  | 调用 `GET /v1/models`，复制 `data[].id` 的原始值                                                  |
+| Claude Code 提示未知模型                                        | 客户端不认识第三方模型的上下文信息       | 使用上文的 `modelOverrides` 映射；这不等同于服务端模型不存在                                      |
+| MCP 列表中没有 `js-reverse`                                     | 添加命令失败或客户端未重启               | 运行 `codex mcp list` 或 `claude mcp list`；删除后重新添加并重启客户端                            |
+| Windows 提示找不到 `npx`                                        | Node.js 未安装或 PATH 未刷新             | 重新安装 Node.js，重开终端；必要时把 MCP 命令中的 `npx` 改成 `npx.cmd`                            |
+| MCP 首次启动超时                                                | `npx` 正在下载依赖，网络较慢             | 先手动运行 `npx -y js-reverse-mcp@4.0.3 --help` 完成下载，再重启客户端                            |
+| `MCP tool call requires approval, but approval policy is never` | 客户端禁止询问授权，MCP 调用无法获批     | Codex 用 `codex -a on-request` 进入交互会话并批准调用；不要在首次测试时使用 `-a never`            |
+| 浏览器没有打开                                                  | Chrome 未安装、旧进程占用或 MCP 启动失败 | 安装稳定版 Chrome，关闭残留测试浏览器，检查 MCP 状态和 stderr 日志                                |
+| 工具能启动但读写文件被拒绝                                      | 文件不在 `--allowedRoots` 下             | 把输出路径改到专用工作目录，或重新添加正确的允许目录                                              |
+| 第一次使用 `--cloak` 长时间无输出                               | 正在下载约 200 MB 浏览器文件             | 先运行 `npx cloakbrowser install`，等待下载完成后再启动 MCP                                       |
+| `429`                                                           | 请求频率或并发过高                       | 等待 10–30 秒
```

---

### Incident Patch 3: `36944fb2` (2026-08-25)
**Commit Message**: docs: add Infistar model API guide

**File**: `README.md` (modified, +13/-7)
```diff
@@ -20,21 +20,23 @@ IPWO 住宅代理支持灵活的代理配置，开发者可以根据不同任务
 
 👉 [免费测试入口](https://www.ipwo.net/?ref=githubmcp)，9 折优惠码：`0204`
 
-## ☁️ 赞助 · Sponsored by Bloome
+## ☁️ 赞助 · Sponsored by Infistar.cc 无限星河
 
 <p align="center">
-  <a href="https://bloome.im/app?ref=zhizhuodemao&amp;utm_medium=github&amp;utm_source=zhizhuodemao-js-reverse-mcp-ivor-202607">
-    <img src="images/广告图片.png" alt="Bloome：Accelerating the world's transition to human-agent teams" width="100%">
+  <a href="https://www.infistar.cc/register?aff=JJXMRC86&amp;ref_source=link">
+    <img src="images/infistar-model-api.png" alt="Infistar.cc 无限星河：一站式全球大模型 API 服务平台" width="100%">
   </a>
 </p>
 
-Bloome 是一个 AI Agent IM 平台：不是你对着一个 bot 单打独斗，而是让多个 AI agent（Claude、ChatGPT、DeepSeek 等）和你待在同一个群聊里协作。
+js-reverse-mcp × Infistar.cc 无限星河｜全模型 API · 稳定驱动 AI 辅助调试
 
-把任务丢进对话，它们会自动分工——起草、交叉核对、补全细节，彼此挑错、互相补位，直到结果靠谱为止，并直接在对话里生成表格、文档和可视化看板。还能按计划 7×24 自动运行（比如每天定时整理报表发进频道），零本地配置、云端运行，网页和手机都能用；配好的 agent 一键分享给团队，无需各自部署。
+感谢 Infistar.cc 无限星河赞助并为 js-reverse-mcp 提供模型服务支持！⚡ 稳定承载复杂调试任务：提供企业级高并发通道与多节点冗余，价格低至官方渠道 1 折，减少限流、429 和长任务断连问题。
 
-一句话：把"我 + 一个助手"升级成"我的团队 + 一群会协作的 agent"。
+🧠 一个 API Key 接入主流模型：支持 ChatGPT、Claude、Gemini、Kimi、GLM、DeepSeek 等模型，适配 Claude Code、Codex、Cursor 等 AI 编程工具。🔎 助力授权调试与安全研究：适用于脚本检索、断点分析、网络请求追踪、调用栈检查和代码逻辑理解等多步骤任务。
 
-👉 试试 [Bloome](https://bloome.im/app?ref=zhizhuodemao&utm_medium=github&utm_source=zhizhuodemao-js-reverse-mcp-ivor-202607)
+📦 项目用户专属福利：通过 [专属推广链接](https://www.infistar.cc/register?aff=JJXMRC86&ref_source=link) 注册并完成首次调用，即可领取 5 美元等值测试额度 / 首充专属优惠。
+
+定位：Claude Code / Codex 模型 API 配置支持。
 
 ## 功能特点
 
@@ -86,12 +88,16 @@ js-reverse-mcp 不再直接依赖 Patchright 的大众发行包，而是使用
 claude mcp add js-reverse npx js-reverse-mcp
 ```
 
+如果你还没有可用的模型 API，或者需要配置自定义 API 地址，可以参考：[Claude Code / Codex 第三方模型 API 配置教程](docs/model-api-setup.md)。
+
 ### Codex
 
 ```bash
 codex mcp add js-reverse -- npx js-reverse-mcp
 ```
 
+如果你还没有可用的模型 API，或者需要配置自定义 API 地址，可以参考：[Claude Code / Codex 第三方模型 API 配置教程](docs/model-api-setup.md)。
+
 ### Cursor
 
 进入 `Cursor Settings` -> `MCP` -> `New MCP Server`，使用上面的配置。
```

**File**: `README_en.md` (modified, +13/-7)
```diff
@@ -20,21 +20,23 @@ For projects involving JavaScript reverse engineering, browser debugging, and we
 
 👉 [Free trial](https://www.ipwo.net/?ref=githubmcp). Use code `0204` for 10% off.
 
-## ☁️ Sponsored by Bloome
+## ☁️ Sponsored by Infistar.cc
 
 <p align="center">
-  <a href="https://bloome.im/app?ref=zhizhuodemao&amp;utm_medium=github&amp;utm_source=zhizhuodemao-js-reverse-mcp-ivor-202607">
-    <img src="images/广告图片.png" alt="Bloome: Accelerating the world's transition to human-agent teams" width="100%">
+  <a href="https://www.infistar.cc/register?aff=JJXMRC86&amp;ref_source=link">
+    <img src="images/infistar-model-api.png" alt="Infistar.cc: a global all-in-one model API platform" width="100%">
   </a>
 </p>
 
-Bloome is an AI Agent IM platform: instead of working alone with one bot, it lets multiple AI agents (Claude, ChatGPT, DeepSeek, and more) collaborate with you in the same group chat.
+js-reverse-mcp × Infistar.cc｜Model APIs for reliable AI-assisted debugging
 
-Drop a task into the conversation and they automatically divide the work, drafting, cross-checking, filling in details, challenging each other, and covering gaps until the result is reliable. They can also generate tables, documents, and visual dashboards directly in the conversation. Bloome can run 24/7 on a schedule, such as preparing a daily report and sending it to a channel, with zero local setup, cloud execution, and access from web and mobile. Configured agents can be shared with your team in one click, with no need for each person to deploy their own setup.
+Thanks to Infistar.cc for sponsoring js-reverse-mcp and providing model-service support. ⚡ Its enterprise-grade high-concurrency channels and multi-node redundancy are designed for complex debugging tasks, helping reduce rate limits, 429 responses, and long-task disconnections.
 
-In short: upgrade from "me + one assistant" to "my team + a group of collaborative agents".
+🧠 Use one API key with mainstream models including ChatGPT, Claude, Gemini, Kimi, GLM, and DeepSeek, and connect them to AI coding tools such as Claude Code, Codex, and Cursor. 🔎 It supports authorized debugging and security research workflows, including script search, breakpoint analysis, network-request tracing, call-stack inspection, and code-logic understanding.
 
-👉 Try [Bloome](https://bloome.im/app?ref=zhizhuodemao&utm_medium=github&utm_source=zhizhuodemao-js-reverse-mcp-ivor-202607)
+📦 Project-user offer: register through the [dedicated link](https://www.infistar.cc/register?aff=JJXMRC86&ref_source=link), make your first call, and receive either a US$5-equivalent trial credit or an exclusive first-top-up offer.
+
+Positioning: Claude Code / Codex model API configuration support.
 
 ## Features
 
@@ -86,12 +88,16 @@ No installation required. Add to your MCP client configuration:
 claude mcp add js-reverse npx js-reverse-mcp
 ```
 
+If you do not have a model API yet, or need to configure a custom API endpoint, see the [Claude Code / Codex third-party model API setup guide](docs/model-api-setup.md).
+
 ### Codex
 
 ```bash
 codex mcp add js-reverse -- npx js-reverse-mcp
 ```
 
+If you do not have a model API yet, or need to configure a custom API endpoint, see the [Claude Code / Codex third-party model API setup guide](docs/model-api-setup.md).
+
 ### Cursor
 
 Go to `Cursor Settings` -> `MCP` -> `New MCP Server`, and use the configuration above.
```

**File**: `docs/model-api-setup.md` (added, +369/-0)
```diff
@@ -0,0 +1,369 @@
+# 使用无限星河AI 配置 Codex、Claude Code 与 js-reverse-mcp
+
+> 本文由 [无限星河AI（Infistar）](https://infistar.cc/) 赞助。配置、接口调用和网页分析步骤均经过实际测试；赞助不影响对限制、风险和故障的如实说明。
+
+这篇教程解决两层配置问题：
+
+1. **模型接口配置**：把无限星河AI 的 API 地址、API Key 和模型接入 Codex 或 Claude Code。
+2. **MCP 工具配置**：把 [`js-reverse-mcp`](https://github.com/zhizhuodemao/js-reverse-mcp) 接入客户端，让模型能够操作浏览器并分析 JavaScript。
+
+二者缺一不可：API 决定“由哪个模型思考”，MCP 决定“模型可以使用哪些浏览器调试工具”。
+
+## 1. 准备工作
+
+开始前请准备：
+
+- Windows、macOS 或 Linux；
+- [Node.js](https://nodejs.org/) `20.19` 或更高版本；
+- 稳定版 Google Chrome；
+- 一个无限星河AI 账户和可用余额；
+- 只分析自己拥有或已获得明确授权的网页。
+
+检查 Node.js 与 npm：
+
+```bash
+node --version
+npm --version
+```
+
+如果 Node.js 版本低于 `20.19`，请先升级，否则 `js-reverse-mcp` 可能无法启动。
+
+## 2. 注册账户并创建 API Key
+
+1. 打开 [无限星河AI 注册页面](https://infistar.cc/register) 完成注册和登录。
+2. 进入控制台的 [令牌管理](https://infistar.cc/console/token)。
+3. 点击“添加令牌”。建议为本教程单独创建一个令牌，并设置合理的额度上限。
+4. 确认令牌所属分组能够调用准备使用的模型。
+5. 创建后立即复制 API Key，并保存到密码管理器中。
+
+API Key 通常以 `sk-` 开头。它可以消耗账户余额，不要把完整 Key 发到聊天、截图、Issue、日志或 Git 仓库中。
+
+### 验证 Key 和模型权限
+
+Windows PowerShell：
+
+```powershell
+$env:INFISTAR_API_KEY = "你的_API_Key"
+curl.exe https://infistar.cc/v1/models `
+  -H "Authorization: Bearer $env:INFISTAR_API_KEY"
+```
+
+macOS / Linux：
+
+```bash
+export INFISTAR_API_KEY="你的_API_Key"
+curl https://infistar.cc/v1/models \
+  -H "Authorization: Bearer $INFISTAR_API_KEY"
+```
+
+请求成功后，检查返回结果的 `data[].id` 中是否包含 `gpt-5.6-sol`。模型权限以当前 API Key 的实际返回结果为准，不要填写模型中文名或套餐名。
+
+## 3. 模型怎么选
+
+本教程统一使用：
+
+```text
+gpt-5.6-sol
+```
+
+推荐关系如下：
+
+| 模型 | 适合场景 | 建议 |
+| --- | --- | --- |
+| `gpt-5.6-sol` | 复杂代码库、JS 逆向、长链路调试、高价值任务 | 本教程首选 |
+| `gpt-5.6-terra` | 常规开发、日常调试、效果与成本平衡 | 日常默认可选 |
+| `gpt-5.6-luna` | 快速检索、简单修改、批量低成本任务 | 对速度和成本更敏感时使用 |
+
+Sol 更适合复杂、开放式和需要持续推理的工作。若控制台暂时没有该模型，请先用 `/v1/models` 查看当前令牌可用的精确模型 ID，再选择 Terra 或其他可用模型。
+
+## 4. 配置 Codex
+
+### 4.1 安装 Codex CLI
+
+```bash
+npm install -g @openai/codex
+codex --version
+```
+
+### 4.2 设置 API Key
+
+先在当前终端临时设置，测试通过后再决定是否持久保存。
+
+Windows PowerShell：
+
+```powershell
+$env:INFISTAR_API_KEY = "你的_API_Key"
+```
+
+macOS / Linux：
+
+```bash
+export INFISTAR_API_KEY="你的_API_Key"
+```
+
+### 4.3 配置接口和模型
+
+打开 Codex 配置文件：
+
+- Windows：`%USERPROFILE%\.codex\config.toml`
+- macOS / Linux：`~/.codex/config.toml`
+
+加入以下内容：
+
+```toml
+model = "gpt-5.6-sol"
+model_provider = "infistar"
+
+[model_providers.infistar]
+name = "无限星河AI"
+base_url = "https://infistar.cc/v1"
+env_key = "INFISTAR_API_KEY"
+wire_api = "responses"
+```
+
+这里的 `base_url` **必须带 `/v1`**，`wire_api` 使用 `responses`。
+
+### 4.4 验证 Codex
+
+在设置过环境变量的同一个终端运行：
+
+```bash
+codex -a on-request
+```
+
+然后发送：
+
+```text
+请只回复“CODEX_OK”，不要读取或修改文件，也不要运行命令。
+```
+
+收到 `CODEX_OK` 说明 API 地址、Key、模型和 Responses 接口均已生效。
+
+## 5. 配置 Claude Code
+
+### 5.1 安装 Claude Code
+
+```bash
+npm install -g @anthropic-ai/claude-code
+claude --version
+```
+
+### 5.2 临时配置并验证
+
+Claude Code 使用 Anthropic Messages 兼容接口。它的地址与 Codex 不同：**不要添加 `/v1`**。
+
+Windows PowerShell：
+
+```powershell
+$env:ANTHROPIC_BASE_URL = "https://infistar.cc"
+$env:ANTHROPIC_AUTH_TOKEN = "你的_API_Key"
+claude --model gpt-5.6-sol
+```
+
+macOS / Linux：
+
+```bash
+export ANTHROPIC_BASE_URL="https://infistar.cc"
+export ANTHROPIC_AUTH_TOKEN="你的_API_Key"
+claude --model gpt-5.6-sol
+```
+
+进入 Claude Code 后运行 `/status`，确认 API 地址是 `https://infistar.cc`。随后发送：
+
+```text
+请只回复“CLAUDE_OK”，不要读取或修改文件，也不要运行命令。
+```
+
+### 5.3 保存配置并消除“未知模型”提示
+
+当前版本的 Claude Code 可能提示它不认识 `gpt-5.6-sol` 的上下文窗口。这只是 Claude Code 本地的模型识别提示，不代表无限星河AI 没有该模型。
+
+可以在用户配置中把 Claude Code 的内置模型入口映射到实际模型 ID。配置文件位置：
+
+- Windows：`%USERPROFILE%\.claude\settings.json`
+- macOS / Linux：`~/.claude/settings.json`
+
+```json
+{
+  "env": {
+    "ANTHROPIC_BASE_URL": "https://infistar.cc",
+    "ANTHROPIC_AUTH_TOKEN": "你的_API_Key"
+  },
+  "model": "claude-opus-4-6",
+  "modelOverrides": {
+    "claude-opus-4-6": "gpt-5.6-sol"
+  }
+}
+```
+
+这样 Claude Code 仍使用自己认识的模型入口管理上下文，实际请求发送给 `gpt-5.6-sol`。
+
+该文件含有完整 API Key，不要上传到 Git。若系统中曾设置 `ANTHROPIC_API_KEY`，建议删除或确认它不会覆盖当前配置。
+
+## 6. 安装并配置 js-reverse-mcp
+
+推荐用 `npx` 按版本运行，不需要全局安装。本教程锁定已测试版本 `4.0.3`，避免未来版本变化导致命令表现不同。
+
+先创建一个专用输出目录。MCP 只能在这个目录内读写文件：
+
+Windows PowerShell：
+
+```powershell
+New-Item -ItemType Directory -Force "$env:USERPROFILE\js-reverse-work"
+```
+
+macOS / Linux：
+
+```bash
+mkdir -p "$HOME/js-reverse-work"
+```
+
+### 6.1 接入 Codex
+
+Windows：
+
+```powershell
+codex mcp add js-reverse -- npx -y js-reverse-mcp@4.0.3 --isolated --allowedRoots "$env:USERPROFILE\js-reverse-work"
+codex mcp list
+```
+
+macOS / Linux：
+
+```bash
+codex mcp add js-reverse -- npx -y js-reverse-mcp@4.0.3 --isolated --allowedRoots "$HOME/js-reverse-work"
+codex mcp list
+```
+
+重新启动 Codex，并使用允许交互确认的权限策略：
+
+```bash
+codex -a on-request
+```
+
+首次调用 MCP 工具时，检查工具名称和参数，再批准调用。
+
+### 6.2 接入 Claude Code
+
+Windows：
+
+```powershell
+claude mcp add -s user js-reverse -- npx -y js-reverse-mcp@4.0.3 --isolated --allowedRoots "$env:USERPROFILE\js-reverse-work"
+claude mcp list
+```
+
+macOS / Linux：
+
```

---

### Incident Patch 4: `177f1901` (2026-06-26)
**Commit Message**: fix(server): read version from package.json and show it in the description

VERSION was hardcoded to 0.10.2 (a vestigial release-please marker from the
upstream fork), so the MCP server reported the wrong version to clients while
npm was already at 3.0.x. Read it from package.json at runtime via
import.meta.dirname so it always matches the published package, and surface
it in the server description (v{VERSION}).

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

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

### Incident Patch 5: `45522b17` (2026-06-26)
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

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

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

### Incident Patch 6: `a64e6931` (2026-06-26)
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

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

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

**File**: `tests/tools/network.test.ts` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+/**
+ * @license
+ * Copyright 2025 Google LLC
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+import assert from 'node:assert/strict';
+import {test} from 'node:test';
+
+import {zod} from '../../src/third_party/index.js';
+import {listNetworkRequests} from '../../src/tools/network.js';
+
+test('outputPart defaults to "all" when omitted', () => {
+  // Regression: ".default('all').optional()" let undefined short-circuit the
+  // default, so omitting outputPart produced undefined and crashed the export.
+  const schema = zod.object(listNetworkRequests.schema);
+  const parsed = schema.parse({reqid: 1, outputFile: '/tmp/x.json'});
+
+  assert.equal(parsed.outputPart, 'all');
+});
+
+test('includePreservedRequests defaults to false when omitted', () => {
+  const schema = zod.object(listNetworkRequests.schema);
+  const parsed = schema.parse({});
+
+  assert.equal(parsed.includePreservedRequests, false);
+});
```

---

### Incident Patch 7: `95338ccf` (2026-06-26)
**Commit Message**: fix(network): cache response bodies eagerly to survive navigation

Response bodies were fetched lazily via httpResponse.body() at inspect/
export time. After a navigation the browser evicts the body, so the CDP
getResponseBody call failed and tools returned "<not available anymore>".

Capture the body at requestfinished (while the producing loader is still
alive) and cache it on the request object via a symbol. Reads now prefer
the cache and fall back to a live fetch. Bounded by a per-response size
cap and a per-page byte budget.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

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
+        ok: false,
+        error: error instanceof Error ? error.message : String(error),
+      };
+    }
+  })();
+}
+
 export class NetworkCollector extends PageCollector<HTTPRequest> {
   #initiators = new WeakMap<Page, Map<string, RequestInitiator>>();
   #cdpListeners = new WeakMap<Page, () => void>();
@@ -531,19 +639,28 @@ export class NetworkCollector extends PageCollector<HTTPRequest> {
       collector: (item: HTTPRequest) => void,
     ) => ListenerMap<PageEvents>,
   ) {
-    super(
-      context,
+    const baseListeners =
       listeners ??
-        (collect => {
-          return {
-            request: req => {
-              const request = req as RequestWithNetworkMetadata;
-              request[networkRequestObservedAtSymbol] = Date.now();
-              collect(req);
-            },
-          } as ListenerMap;
-        }),
-    );
+      (collect => {
+        return {
+          request: req => {
+            const request = req as RequestWithNetworkMetadata;
+            req
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

### Incident Patch 8: `8a7be1a4` (2026-06-21)
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
+            debugger_,
           );
-        } catch (error) {
-          if (debugger_.isPaused()) {
+          if (result.status === 'completed') {
+            response.appendResponseLine(
+              `Successfully navigated back to ${page.url()}.`,
+            );
+            response.appendResponseLine(
+              'Note: Any previously obtained script IDs are now invalid. Use script URLs instead.',
+            );
+          } else if (result.status === 'paused' || debugger_.isPaused()) {
             response.appendResponseLine(
               `Navigation back started but execution is paused at a breakpoint. Use get_paused_info to inspect, then resume to continue loading.`,
             );
           } else {
             response.appendResponseLine(
-              `Unable to navigate back in the selected page: ${error.message}.`,
+              `Unable to navigate back in the selected page: ${getErrorMessage(result.error)}.`,
             );
           }
         }
       
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

### Incident Patch 9: `8e7b1c83` (2026-06-21)
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

### Incident Patch 10: `ba53ffc8` (2026-06-21)
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
+    normalizedName === 'proxy-authorization'
+  ) {
+    const scheme = value.trim().match(/^([A-Za-z][A-Za-z0-9._~+/-]*)\s+/)?.[1];
+    return `<redacted authorization${scheme ? `; scheme: ${scheme}` : ''}; ${value.length} chars>`;
+  }
+
+  if (isSensitiveHeaderName(normalizedName)) {
+    return `<redacted sensitive header; ${value.length} chars>`;
+  }
+
+  return value;
+}
+
+function getCookieHeaderNames(value: string): string[] {
+  return value
+    .split(';')
+    .map(part => part.trim())
+    .filter(Boolean)
+    .map(part => {
+      const eq = part.indexOf('=');
+      return (eq === -1 ? part : part.slice(0, eq)).trim();
+    })
+    .filter(Boolean);
+}
+
+function isSensitiveHeaderName(normalizedName: string): boolean {
+  if (normalizedName === 'set-cookie') {
+    return false;
+  }
+
+  if (SENSITIVE_HEADER_EXACT_NAMES.has(normalizedName)) {
+    return true;
+  }
+
+  return SENSITIVE_HEADER_NAME_FRAGMENTS.some(fragment =>
+    normalizedName.includes(fragment),
+  );
+}
+
+ex
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

### Incident Patch 11: `af9d10f4` (2026-06-21)
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

### Incident Patch 12: `500b3f87` (2026-06-21)
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

---

### Incident Patch 13: `7582a4e2` (2026-06-21)
**Commit Message**: fix(script): bound inline evaluation results

**File**: `docs/tool-reference.md` (modified, +1/-1)
```diff
@@ -118,7 +118,7 @@
 ### `evaluate_script`
 
 **Description:** Evaluate a JavaScript function inside the currently selected page. Returns the response as JSON
-so returned values have to JSON-serializable. When execution is paused at a breakpoint, automatically evaluates in the paused call frame context. Use localFilePath when the function needs one local data file, commonly a network body or JSON exported by another tool. The MCP server reads the file and passes it as localFile; browser JavaScript does not read local paths.
+so returned values have to JSON-serializable. Inline JSON results are bounded; use outputFile for exact large results. When execution is paused at a breakpoint, automatically evaluates in the paused call frame context. Use localFilePath when the function needs one local data file, commonly a network body or JSON exported by another tool. The MCP server reads the file and passes it as localFile; browser JavaScript does not read local paths.
 
 **Parameters:**
 
```

**File**: `src/tools/script.ts` (modified, +14/-2)
```diff
@@ -16,6 +16,7 @@ import {defineTool} from './ToolDefinition.js';
 
 // Default script evaluation timeout in milliseconds (30 seconds)
 const DEFAULT_SCRIPT_TIMEOUT = 30000;
+const INLINE_EVAL_RESULT_LIMIT = 8192;
 const MAX_LOCAL_FILE_BYTES = 5 * 1024 * 1024;
 const MAX_PAUSED_LOCAL_FILE_BYTES = 512 * 1024;
 
@@ -98,7 +99,7 @@ async function loadLocalFile(filePath: string): Promise<LocalFileInput> {
 export const evaluateScript = defineTool({
   name: 'evaluate_script',
   description: `Evaluate a JavaScript function inside the currently selected page. Returns the response as JSON
-so returned values have to JSON-serializable. When execution is paused at a breakpoint, automatically evaluates in the paused call frame context. Use localFilePath when the function needs one local data file, commonly a network body or JSON exported by another tool. The MCP server reads the file and passes it as localFile; browser JavaScript does not read local paths.`,
+so returned values have to JSON-serializable. Inline JSON results are bounded; use outputFile for exact large results. When execution is paused at a breakpoint, automatically evaluates in the paused call frame context. Use localFilePath when the function needs one local data file, commonly a network body or JSON exported by another tool. The MCP server reads the file and passes it as localFile; browser JavaScript does not read local paths.`,
   annotations: {
     category: ToolCategory.DEBUGGING,
     readOnlyHint: false,
@@ -250,8 +251,19 @@ If localFilePath is provided, the function receives one argument: \`async ({ loc
           `[Binary Data: ${Buffer.from(parsed.data, 'base64').length} bytes. Use outputFile to save to disk.]`,
         );
       } else {
+        const data = parsed.data ?? 'undefined';
+        const truncated = data.length > INLINE_EVAL_RESULT_LIMIT;
+        if (truncated) {
+          response.appendResponseLine(
+            `Result is ${data.length} chars; inline output is truncated to ${INLINE_EVAL_RESULT_LIMIT} chars. Re-run with outputFile to save the exact result.`,
+          );
+        }
         response.appendResponseLine('```json');
-        response.appendResponseLine(`${parsed.data ?? 'undefined'}`);
+        response.appendResponseLine(
+          truncated
+            ? `${data.slice(0, INLINE_EVAL_RESULT_LIMIT)}... <truncated ${data.length - INLINE_EVAL_RESULT_LIMIT} chars>`
+            : data,
+        );
         response.appendResponseLine('```');
       }
     };
```

---

### Incident Patch 14: `9451c750` (2026-06-21)
**Commit Message**: fix(network): compact inline previews

**File**: `docs/tool-reference.md` (modified, +1/-1)
```diff
@@ -98,7 +98,7 @@
 
 ### `list_network_requests`
 
-**Description:** List network requests for the currently selected page since the last navigation. Results are sorted newest-first and include request start time plus duration. By default returns the 20 most recent requests; use pageSize/pageIdx to paginate. List output is an index: it shows status and Set-Cookie names, not header/body contents. Pass reqid to inspect one request with timing, bounded inline headers and bodies, and a dedicated Set-Cookie section that shows raw values up to 1KB total. When exact bytes, full bodies, replay inputs, signature inputs, large request bodies, long GET query payloads, binary responses, full headers, full Set-Cookie values, or data for external decoding are needed, pass reqid with outputFile to export the selected data. For GET requests, payload-like data means parsed URL query parameters.
+**Description:** List network requests for the currently selected page since the last navigation. Results are sorted newest-first and include request start time plus duration. By default returns the 20 most recent requests; use pageSize/pageIdx to paginate. List output is an index: it shows status, summarized long URLs, and Set-Cookie names, not header/body contents. Pass reqid to inspect one request with timing, bounded inline headers and content-type-aware body previews, and a dedicated Set-Cookie section that shows raw values up to 1KB total. When exact bytes, full bodies, replay inputs, signature inputs, large request bodies, long GET query payloads, binary responses, full headers, full Set-Cookie values, or data for external decoding are needed, pass reqid with outputFile to export the selected data. For GET requests, payload-like data means parsed URL query parameters.
 
 **Parameters:**
 
```

**File**: `src/formatters/networkFormatter.ts` (modified, +207/-4)
```diff
@@ -11,8 +11,10 @@ import type {HTTPRequest, HTTPResponse} from '../third_party/index.js';
 
 const BODY_CONTEXT_SIZE_LIMIT = 4096;
 const BODY_FETCH_TIMEOUT_MS = 5000;
+const FORM_FIELD_PREVIEW_LIMIT = 20;
 const HEADER_CONTEXT_SIZE_LIMIT = 4096;
 const LIST_SET_COOKIE_NAME_LIMIT = 5;
+const LIST_URL_CONTEXT_LIMIT = 240;
 const LONG_URL_LIMIT = 2000;
 const LONG_QUERY_LIMIT = 1000;
 const SET_COOKIE_CONTEXT_SIZE_LIMIT = 1024;
@@ -95,7 +97,7 @@ export function getShortDescriptionForRequest(
   id: number,
   selectedInDevToolsUI = false,
 ): string {
-  return `reqid=${id} ${getFormattedRequestTimingBrief(request)} [${request.resourceType()}] ${request.method()} ${request.url()} ${getStatusFromRequest(request)}${selectedInDevToolsUI ? ` [selected in the DevTools Network panel]` : ''}`;
+  return `reqid=${id} ${getFormattedRequestTimingBrief(request)} [${request.resourceType()}] ${request.method()} ${getUrlForList(request.url())} ${getStatusFromRequest(request)}${selectedInDevToolsUI ? ` [selected in the DevTools Network panel]` : ''}`;
 }
 
 export async function getShortDescriptionForRequestAsync(
@@ -108,7 +110,7 @@ export async function getShortDescriptionForRequestAsync(
   const setCookieMarker = includeSetCookieMarker
     ? await getSetCookieListMarker(request)
     : '';
-  return `reqid=${id} ${getFormattedRequestTimingBrief(request)} [${request.resourceType()}] ${request.method()} ${request.url()} ${status}${setCookieMarker}${selectedInDevToolsUI ? ` [selected in the DevTools Network panel]` : ''}`;
+  return `reqid=${id} ${getFormattedRequestTimingBrief(request)} [${request.resourceType()}] ${request.method()} ${getUrlForList(request.url())} ${status}${setCookieMarker}${selectedInDevToolsUI ? ` [selected in the DevTools Network panel]` : ''}`;
 }
 
 export function getFormattedRequestTimingBrief(request: HTTPRequest): string {
@@ -247,12 +249,21 @@ export async function getFormattedResponseBody(
 
     if (isUtf8(responseBuffer)) {
       const responseAsTest = responseBuffer.toString('utf-8');
+      const contentType = getHeaderValue(
+        httpResponse.headers(),
+        'content-type',
+      );
 
       if (responseAsTest.length === 0) {
         return `<empty response>`;
       }
 
-      return `${getSizeLimitedString(responseAsTest, sizeLimit)}`;
+      return getFormattedTextBody(
+        responseAsTest,
+        contentType,
+        sizeLimit,
+        'responseBody',
+      );
     }
 
     return `<binary data>`;
@@ -269,7 +280,8 @@ export async function getFormattedRequestBody(
   const data = httpRequest.postData();
 
   if (data) {
-    return `${getSizeLimitedString(data, sizeLimit)}`;
+    const contentType = getHeaderValue(httpRequest.headers(), 'content-type');
+    return getFormattedTextBody(data, contentType, sizeLimit, 'requestBody');
   }
 
   return;
@@ -433,6 +445,197 @@ function getSizeLimitedString(text: string, sizeLimit: number) {
   return `${text}`;
 }
 
+function getFormattedTextBody(
+  text: string,
+  contentType: string,
+  sizeLimit: number,
+  exactPart: 'requestBody' | 'responseBody',
+): string {
+  const normalizedContentType = contentType.toLowerCase();
+
+  if (isMultipartContentType(normalizedContentType)) {
+    return getMultipartBodySummary(text, contentType, exactPart);
+  }
+
+  if (isHtmlContentType(normalizedContentType)) {
+    const compacted = compactMarkupForPreview(text);
+    return formatPreviewWithNote(
+      `HTML body compacted for inline preview; export ${exactPart} for exact bytes.`,
+      compacted,
+      sizeLimit,
+    );
+  }
+
+  if (isXmlContentType(normalizedContentType)) {
+    const compacted = compactMarkupForPreview(text);
+    return formatPreviewWithNote(
+      `XML body compacted for inline preview; export ${exactPart} for exact bytes.`,
+      compacted,
+      sizeLimit,
+    );
+  }
+
+  if (isJsonContentType(normalizedContentType) || looksLikeJson(text)) {
+    const compacted = compactJsonForPreview(text);
+    if (compacted) {
+      return formatPreviewWithNote(
+        `JSON body compacted for inline preview; export ${exactPart} for exact bytes.`,
+        compacted,
+        sizeLimit,
+      );
+    }
+  }
+
+  if (isFormUrlEncodedContentType(normalizedContentType)) {
+    return getFormUrlEncodedPreview(text, sizeLimit, exactPart);
+  }
+
+  return getSizeLimitedString(text, sizeLimit);
+}
+
+function formatPreviewWithNote(
+  note: string,
+  text: string,
+  sizeLimit: number,
+): string {
+  const prefix = `<${note}>\n`;
+  const textLimit = Math.max(0, sizeLimit - prefix.length);
+  return `${prefix}${getSizeLimitedString(text, textLimit)}`;
+}
+
+function compactJsonForPreview(text: string): string | undefined {
+  try {
+    return JSON.stringify(JSON.parse(text));
+  } catch {
+    return undefined;
+  }
+}
+
+function compactMarkupForPreview(text: string): string {
+  return text
+    .replace(
+      /<(script|style|pre|textarea)\b([^>]*)>[\s\S]*?<\/\1>/gi,
+      (block, tag: string, att
```

**File**: `src/tools/network.ts` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ const NETWORK_EXPORT_PARTS = [
 
 export const listNetworkRequests = defineTool({
   name: 'list_network_requests',
-  description: `List network requests for the currently selected page since the last navigation. Results are sorted newest-first and include request start time plus duration. By default returns the 20 most recent requests; use pageSize/pageIdx to paginate. List output is an index: it shows status and Set-Cookie names, not header/body contents. Pass reqid to inspect one request with timing, bounded inline headers and bodies, and a dedicated Set-Cookie section that shows raw values up to 1KB total. When exact bytes, full bodies, replay inputs, signature inputs, large request bodies, long GET query payloads, binary responses, full headers, full Set-Cookie values, or data for external decoding are needed, pass reqid with outputFile to export the selected data. For GET requests, payload-like data means parsed URL query parameters.`,
+  description: `List network requests for the currently selected page since the last navigation. Results are sorted newest-first and include request start time plus duration. By default returns the 20 most recent requests; use pageSize/pageIdx to paginate. List output is an index: it shows status, summarized long URLs, and Set-Cookie names, not header/body contents. Pass reqid to inspect one request with timing, bounded inline headers and content-type-aware body previews, and a dedicated Set-Cookie section that shows raw values up to 1KB total. When exact bytes, full bodies, replay inputs, signature inputs, large request bodies, long GET query payloads, binary responses, full headers, full Set-Cookie values, or data for external decoding are needed, pass reqid with outputFile to export the selected data. For GET requests, payload-like data means parsed URL query parameters.`,
   annotations: {
     category: ToolCategory.NETWORK,
     // Not read-only due to outputFile export support.
```

---

### Incident Patch 15: `b74533fa` (2026-06-17)
**Commit Message**: fix(browser): report cleared site data details

**File**: `docs/site-state-and-cookie-analysis-plan.md` (modified, +13/-3)
```diff
@@ -214,6 +214,8 @@ Implementation requirements:
   current page's frames.
 - Clear matched cookies through the browser context, not through page
   JavaScript, using exact `name`, `domain`, and `path` filters.
+- Clear matched cookies one scope at a time and report matched, cleared, and
+  failed cookie names. Cookie values must not be printed.
 - Clear browser HTTP cache through CDP `Network.clearBrowserCache`.
 - Clear each selected frame origin's persistent storage through CDP
   `Storage.clearDataForOrigin`.
@@ -229,15 +231,21 @@ Browser state cleanup completed for https://www.example.com
 URL: https://www.example.com/login
 Frame origins targeted: https://www.example.com, https://accounts.example-cdn.com
 
-Cookies cleared: yes (42 matching cookies)
+Cookies cleared: 42/42 matching cookie scopes
 Cookies found before clearing: 42
-Cookie domains: example.com, google.com, doubleclick.net
-Cookie names: _abck, bm_sz, session_id
+Cookie domains matched: example.com, google.com, doubleclick.net
+Cookie names matched: _abck, bm_sz, session_id
+Cookie names cleared: _abck, bm_sz, session_id
+Cookie names failed: none
+Cookie scopes cleared: _abck @ .example.com/, bm_sz @ .example.com/, session_id @ www.example.com/
+Cookie scopes failed: none
 Browser HTTP cache cleared: yes
 Origin storage cleared: 2/2 origins
+Origin storage types attempted: all (localStorage, IndexedDB, Cache Storage, Service Workers, WebSQL, file systems, storage buckets, shared storage, and related CDP-supported data)
 Origin storage cleared for: https://www.example.com, https://accounts.example-cdn.com
 Origin storage failed for: none
 Session storage cleared: 2/2 frames
+Session storage cleared for frames: https://www.example.com/login, https://accounts.example-cdn.com/frame
 Session storage failed for frames: none
 Warnings:
 none
@@ -292,6 +300,8 @@ Site state reset:
 - `clear_site_data` has no parameters.
 - `clear_site_data` clears cookies that affect the selected page's HTTP(S)
   frame URLs, including `HttpOnly` cookies.
+- `clear_site_data` reports matched, cleared, and failed cookie names without
+  printing cookie values.
 - `clear_site_data` does not clear unrelated cookie scopes. Other pages can only
   lose cookie-based login state when they share the same cookie domain/path scope
   as the selected page's frames.
```

**File**: `src/tools/siteData.ts` (modified, +53/-21)
```diff
@@ -7,8 +7,6 @@
 import {ToolCategory} from './categories.js';
 import {defineTool} from './ToolDefinition.js';
 
-const MAX_SUMMARY_ITEMS = 8;
-
 function getHttpUrl(value: string): URL | undefined {
   try {
     const url = new URL(value);
@@ -21,19 +19,21 @@ function getHttpUrl(value: string): URL | undefined {
   return;
 }
 
-function summarizeValues(values: string[]): string {
+function formatValues(values: string[]): string {
   const uniqueValues = [...new Set(values)].sort();
   if (uniqueValues.length === 0) {
     return 'none';
   }
 
-  const visibleValues = uniqueValues.slice(0, MAX_SUMMARY_ITEMS);
-  const remaining = uniqueValues.length - visibleValues.length;
-  if (remaining <= 0) {
-    return visibleValues.join(', ');
-  }
+  return uniqueValues.join(', ');
+}
 
-  return `${visibleValues.join(', ')}, ... and ${remaining} more`;
+function formatCookieScope(cookie: {
+  name: string;
+  domain: string;
+  path: string;
+}): string {
+  return `${cookie.name} @ ${cookie.domain}${cookie.path}`;
 }
 
 export const clearSiteData = defineTool({
@@ -81,6 +81,10 @@ export const clearSiteData = defineTool({
     const failedStorageOrigins: string[] = [];
     const clearedSessionStorageFrames: string[] = [];
     const failedSessionStorageFrames: string[] = [];
+    const clearedCookieNames: string[] = [];
+    const failedCookieNames: string[] = [];
+    const clearedCookieScopes: string[] = [];
+    const failedCookieScopes: string[] = [];
 
     try {
       const cookies = await browserContext.cookies(
@@ -98,14 +102,24 @@ export const clearSiteData = defineTool({
       );
 
       for (const cookie of cookiesByKey.values()) {
-        await browserContext.clearCookies({
-          name: cookie.name,
-          domain: cookie.domain,
-          path: cookie.path,
-        });
+        try {
+          await browserContext.clearCookies({
+            name: cookie.name,
+            domain: cookie.domain,
+            path: cookie.path,
+          });
+          clearedCookieNames.push(cookie.name);
+          clearedCookieScopes.push(formatCookieScope(cookie));
+        } catch (error) {
+          failedCookieNames.push(cookie.name);
+          failedCookieScopes.push(formatCookieScope(cookie));
+          warnings.push(
+            `Failed to clear cookie ${formatCookieScope(cookie)}: ${error instanceof Error ? error.message : String(error)}`,
+          );
+        }
       }
 
-      cookiesStatus = `yes (${cookiesByKey.size} matching cookies)`;
+      cookiesStatus = `${clearedCookieScopes.length}/${cookiesByKey.size} matching cookie scopes`;
       if (cookies.some(cookie => cookie.partitionKey)) {
         warnings.push(
           'Some matched cookies are partitioned. Patchright clearCookies filters by name/domain/path, so matching partitioned cookies may be cleared together.',
@@ -188,17 +202,29 @@ export const clearSiteData = defineTool({
     );
     response.appendResponseLine(`URL: ${pageUrl}`);
     response.appendResponseLine(
-      `Frame origins targeted: ${summarizeValues(frameOrigins)}`,
+      `Frame origins targeted: ${formatValues(frameOrigins)}`,
     );
     response.appendResponseLine(`Cookies cleared: ${cookiesStatus}`);
     response.appendResponseLine(
       `Cookies found before clearing: ${cookieCount ?? 'unknown'}`,
     );
     response.appendResponseLine(
-      `Cookie domains: ${summarizeValues(cookieDomains)}`,
+      `Cookie domains matched: ${formatValues(cookieDomains)}`,
     );
     response.appendResponseLine(
-      `Cookie names: ${summarizeValues(cookieNames)}`,
+      `Cookie names matched: ${formatValues(cookieNames)}`,
+    );
+    response.appendResponseLine(
+      `Cookie names cleared: ${formatValues(clearedCookieNames)}`,
+    );
+    response.appendResponseLine(
+      `Cookie names failed: ${formatValues(failedCookieNames)}`,
+    );
+    response.appendResponseLine(
+      `Cookie scopes cleared: ${formatValues(clearedCookieScopes)}`,
+    );
+    response.appendResponseLine(
+      `Cookie scopes failed: ${formatValues(failedCookieScopes)}`,
     );
     response.appendResponseLine(
       `Browser HTTP cache cleared: ${browserCacheStatus}`,
@@ -207,16 +233,22 @@ export const clearSiteData = defineTool({
       `Origin storage cleared: ${originStorageStatus}`,
     );
     response.appendResponseLine(
-      `Origin storage cleared for: ${summarizeValues(clearedStorageOrigins)}`,
+      `Origin storage types attempted: all (localStorage, IndexedDB, Cache Storage, Service Workers, WebSQL, file systems, storage buckets, shared storage, and related CDP-supported data)`,
     );
     response.appendResponseLine(
-      `Origin storage failed for: ${summarizeValues(failedStorageOrigins)}`,
+      `Origin storage cleared for: ${formatValues(clearedStorageOrigins)}`,
+    );
+    response.appendResponseLine(
+      `Origin storage failed for: ${formatValues(failedStorageOrigins)}`,
     );
     response.appendResponseLine(
       `Session
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
