# Forensic Learning Record (Deep Inspection): nanobrowser/nanobrowser

> **Canonical Artifact**: `07_PROJECT_LEARNING/nanobrowser-nanobrowser-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nanobrowser/nanobrowser](https://github.com/nanobrowser/nanobrowser))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:56:28.243Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nanobrowser/nanobrowser`
- **Description**: Open-Source Chrome extension for AI-powered web automation. Run multi-agent workflows using your own LLM API key. Alternative to OpenAI Operator.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 13983 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/background/agent/messages/utils.ts`
```
import type { ModelMessage } from '@src/background/llm/types';
import { assistantMessage, getToolCalls, textPart, userMessage } from '@src/background/llm/messages';

import { guardrails } from '@src/background/services/guardrails';
import { ResponseParseError } from '../agents/errors';

/**
 * Tag for untrusted content
 */
export const UNTRUSTED_CONTENT_TAG_START = '<nano_untrusted_content>';
export const UNTRUSTED_CONTENT_TAG_END = '</nano_untrusted_content>';

/**
 * Tag for user request
 */
export const USER_REQUEST_TAG_START = '<nano_user_request>';
export const USER_REQUEST_TAG_END = '</nano_user_request>';

export const ATTACHED_FILES_TAG_START = '<nano_attached_files>';
export const ATTACHED_FILES_TAG_END = '</nano_attached_files>';

export const FILE_CONTENT_TAG_START = '<nano_file_content>';
export const FILE_CONTENT_TAG_END = '</nano_file_content>';

/**
 * Remove think tags from model output
 * Some models use <think> tags for internal reasoning that should be removed
 * @param text - The text containing potential think tags
 * @returns Text with think tags removed
 */
export function removeThinkTags(text: string): string {
  // Step 1: Remove well-formed <think>...</think>
  const thinkTagsRegex = /<think>[\s\S]*?<\/think>/g;
  let result = text.replace(thinkTagsRegex, '');

  // Step 2: If there's an unmatched closing tag </think>,
  // remove everything up to and including that.
  const strayCloseTagRegex = /[\s\S]*?<\/think>/g;
  result = result.replace(strayCloseTagRegex, '');

  return result.trim();
}

/**
 * Extract JSON from model output, handling both plain JSON and code-block-wrapped JSON.
 * @param content - The string content that potentially contains JSON.
 * @returns Parsed JSON object
 * @throws Error if JSON parsing fails
 */
export function extractJsonFromModelOutput(content: string): Record<string, unknown> {
  try {
    let processedContent = content;

    // Handle Llama's tool call format first
    if (processedContent.includes('<|tool_call_start_id|>')) {
      // Extract content between tool call tags
      const startTag = '<|tool_call_start_id|>';
      const endTag = '<|tool_call_end_id|>';
      const startIndex = processedContent.indexOf(startTag) + startTag.length;
      let endIndex = processedContent.indexOf(endTag);

      if (endIndex === -1) {
        // If no end tag found, take everything after start tag
        endIndex = processedContent.length;
      }

      processedContent = processedContent.substring(startIndex, endIndex).trim();

      // Parse the tool call structure
      const toolCall = JSON.parse(processedContent);

      // Extract the actual parameters (which contains the agent output)
      if (toolCall.parameters) {
        // The parameters field contains an escaped JSON string
        const parametersJson = JSON.parse(toolCall.parameters);
        return parametersJson;
      }

      throw new Error('Tool call structure does not contain parameters');
    }

    // Handle Llama's python tag format
    if (processedContent.includes('<|python_tag|>')) {
      // Extract content between python tags
      const startTag = '<|python_tag|>';
      const endTag = '<|/python_tag|>';
      const startIndex = processedContent.indexOf(startTag) + startTag.length;
      let endIndex = processedContent.indexOf(endTag);

      if (endIndex === -1) {
        // If no end tag found, take everything after start tag
        endIndex = processedContent.length;
      }

      processedContent = processedContent.substring(startIndex, endIndex).trim();

      // Parse the python tag structure
      const pythonCall = JSON.parse(processedContent);

      // Extract the actual parameters (which contains the agent output)
      if (pythonCall.parameters && pythonCall.parameters.output) {
        // Try to parse the output if it's a JSON string
        if (typeof pythonCall.parameters.output === 'string') {
          try {
            const outputJson = JSON.parse(pythonCall.parameters.output);
            return outputJson;
          } catch (e) {
            // If it's not valid JSON, return as is
            return { output: pythonCall.parameters.output };
          }
        }

        return pythonCall.parameters;
      }

      throw new Error('Python tag structure does not contain valid parameters');
    }

    // Try the text as is first, so code fences inside string values stay intact
    const candidates = [processedContent];
    // If content is wrapped in code blocks, extract just the JSON part
    if (processedContent.includes('```')) {
      let block = processedContent.split('```')[1];
      // Remove language identifier if present (e.g., 'json\n')
      if (block.startsWith('json')) {
        block = block.substring(4).trim();
      }
      candidates.push(block);
    }
    // Text around the object, e.g. a <plan> wrapper copied from the history or a sentence before the JSON
    const start = processedContent.indexOf('{');
    const end = processedContent.lastIndexOf('}');
    if (start !== -1 && end > start) {
      candidates.push(processedContent.slice(start, end + 1));
    }

    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate);
      } catch {
        // try the next candidate
      }
    }
    throw new Error('No JSON object found');
  } catch (e) {
    throw new ResponseParseError(`Could not manually extract JSON from model output`);
  }
}

/**
 * Convert the history's agent-output tool calls and their results to text, so no provider receives replayed
 * tool calls. Successive messages of the same role are merged.
 * @param inputMessages - List of messages to convert
 * @param toolName - The caller's output tool; history calls to it are the caller's own earlier outputs
 * @returns Converted list of messages
 */
export function convertInputMessages(inputMessages: ModelMessage[], toolName: string): ModelMessage[] {
  const convertedInputMessages = convertToolMessagesToText(inputMessages, toolName);
  let mergedInputMessages = mergeSuccessiveMessages(convertedInputMessages, 'user');
  mergedInputMessages = mergeSuccessiveMessages(mergedInputMessages, 'assistant');
  return mergedInputMessages;
}

/**
 * Replace tool calls and tool results with text messages
 * @param inputMessages - List of messages to convert
 * @param toolName - The caller's output tool
 * @returns Converted list of messages
 */
function convertToolMessagesToText(inputMessages: ModelMessage[], toolName: string): ModelMessage[] {
  const outputMessages: ModelMessage[] = [];

  for (const message of inputMessages) {
    switch (message.role) {
      case 'user':
      case 'system':
        outputMessages.push(message);
        break;
      case 'tool': {
        const text = message.content
          .map(part => (part.type === 'tool-result' && part.output.type === 'text' ? part.output.value : ''))
          .join('');
        outputMessages.push(userMessage(text));
        break;
      }
      case 'assistant': {
        const toolCalls = getToolCalls(message);
        if (toolCalls.length === 0) {
          outputMessages.push(message);
          break;
        }
        for (const call of toolCalls) {
          const json = JSON.stringify(call.input);
          // The caller's own outputs stay assistant turns in the format it replies with; another agent's outputs
          // become context, so the model doesn't copy their format (the planner sees the navigator's outputs)
          outputMessages.push(
            call.toolName === toolName ? assistantMessage(json) : userMessage(`Output of another agent:\n${json}`),
          );
        }
        break;
      }
    }
  }

  return outputMessages;
}

/**
 * Join the content of two messages of the same role, keeping non-text parts such as images
 */
function mergeContent(first: ModelMessage, second: ModelMessage): ModelMessage {
  if (typeof first.content === 'string' && typeof second.content === 'string') {
    return { ...first, content: `${first.content}\n\n${second.content}` } as ModelMessage;
  }
  const toParts = (message: ModelMessage) =>
    typeof message.content === 'string' ? [textPart(message.content)] : message.content;
  return { ...first, content: [...toParts(first), ...toParts(second)] } as ModelMessage;
}

/**
 * Merge successive messages of the same role into one message
 * Some models (e.g. DeepSeek in thinking mode) don't allow multiple user messages in a row
 * @param messages - List of messages to merge
 * @param roleToMerge - Message role to merge
 * @returns Merged list of messages
 */
function mergeSuccessiveMessages(messages: ModelMessage[], roleToMerge: 'user' | 'assistant'): ModelMessage[] {
  const mergedMessages: ModelMessage[] = [];
  let streak = 0;

  for (const message of messages) {
    if (message.role === roleToMerge) {
      streak += 1;
      if (streak > 1) {
        const lastMessage = mergedMessages[mergedMessages.length - 1];
        mergedMessages[mergedMessages.length - 1] = mergeContent(lastMessage, message);
      } else {
        mergedMessages.push(message);
      }
    } else {
      mergedMessages.push(message);
      streak = 0;
    }
  }

  return mergedMessages;
}

/**
 * Filter untrusted content to prevent prompt injection using the guardrails service
 * @param rawContent - The raw string of untrusted content
 * @param strict - If true, uses strict mode in guardrails (default: true)
 * @returns Filtered content string with malicious content removed
 */
export function filterExternalContent(rawContent: string | undefined, strict: boolean = true): string {
  if (!rawContent || rawContent.trim() === '') {
    return '';
  }

  const result = guardrails.sanitize(rawContent, { strict });
  return result.sanitized;
}

export function filterExternalContentWithReport(rawContent: string | undefined, strict: boolean = true) {
  if (!rawContent || rawContent.trim() === '') {
    return { sanitized: '', threats: [], modified: false };
  }
  return gua
```

### Core Architecture Module: `src/background/browser/util.ts`
```
/**
 * Checks if a URL is allowed based on firewall configuration
 * @param url The URL to check
 * @param allowList The allow list
 * @param denyList The deny list
 * @returns True if the URL is allowed, false otherwise
 */
export function isUrlAllowed(url: string, allowList: string[], denyList: string[]): boolean {
  // Normalize and validate input
  const trimmedUrl = url.trim();
  if (trimmedUrl.length === 0) {
    return false;
  }

  const lowerCaseUrl = trimmedUrl.toLowerCase();

  // ALWAYS block dangerous/forbidden URLs, even if firewall is disabled
  const DANGEROUS_PREFIXES = [
    'https://chromewebstore.google.com', // scripts are not allowed to be injected into chrome web store
    'chrome-extension://',
    'chrome://',
    'javascript:',
    'data:',
    'file:',
    'vbscript:',
    'ws:',
    'wss:',
  ];

  if (DANGEROUS_PREFIXES.some(prefix => lowerCaseUrl.startsWith(prefix))) {
    return false;
  }

  // If firewall is disabled, allow all other URLs
  if (allowList.length === 0 && denyList.length === 0) {
    return true;
  }

  // Special case: Allow 'about:blank' explicitly
  if (trimmedUrl === 'about:blank') {
    return true;
  }

  try {
    const parsedUrl = new URL(trimmedUrl);

    // 1. Remove protocol prefix for further comparisons
    const urlWithoutProtocol = lowerCaseUrl.replace(/^https?:\/\//, '');

    // 2. First check full URL against deny list
    for (const deniedEntry of denyList) {
      if (urlWithoutProtocol === deniedEntry) {
        return false;
      }
    }

    // 3. Check full URL against allow list
    for (const allowedEntry of allowList) {
      if (urlWithoutProtocol === allowedEntry) {
        return true;
      }
    }

    // 4. Extract domain for domain-based checks
    let domain = parsedUrl.hostname.toLowerCase();

    // Remove port number if present
    const portIndex = domain.indexOf(':');
    if (portIndex > -1) {
      domain = domain.substring(0, portIndex);
    }

    // 5. Check domain against deny list
    for (const deniedEntry of denyList) {
      if (domain === deniedEntry || domain.endsWith(`.${deniedEntry}`)) {
        return false;
      }
    }

    // 6. Check domain against allow list
    for (const allowedEntry of allowList) {
      if (domain === allowedEntry || domain.endsWith(`.${allowedEntry}`)) {
        return true;
      }
    }

    // Default policy
    return allowList.length === 0;
  } catch (error) {
    // Invalid URL format - deny by default
    return false;
  }
}

// Check if a URL is a new tab page (about:blank or chrome://new-tab-page).
export function isNewTabPage(url: string): boolean {
  return url === 'about:blank' || url === 'chrome://new-tab-page' || url === 'chrome://new-tab-page/';
}

export function capTextLength(text: string, maxLength: number): string {
  if (text.length > maxLength) {
    return text.slice(0, maxLength) + '...';
  }
  return text;
}

```

### Core Architecture Module: `src/background/utils.ts`
```
import { jsonrepair } from 'jsonrepair';
import { createLogger } from '@src/background/log';

const logger = createLogger('Utils');

export function getCurrentTimestampStr(): string {
  /**
   * Get the current timestamp as a string in the format yyyy/MM/dd HH:mm:ss
   * using local timezone.
   *
   * @returns Formatted datetime string in local time
   */
  return new Date()
    .toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    .replace(',', '');
}

/**
 * Fix malformed action string using the jsonrepair library
 * Only called when initial JSON.parse fails
 */
export function repairJsonString(actionString: string): string {
  try {
    // Use jsonrepair to fix malformed JSON
    const repairedJson = jsonrepair(actionString.trim());
    logger.info('Successfully repaired JSON string', { original: actionString, repaired: repairedJson });
    return repairedJson;
  } catch (error) {
    // If jsonrepair fails, log the error and return the original string
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warning('jsonrepair failed to fix JSON string', { original: actionString, error: errorMessage });
    return actionString.trim();
  }
}

// Helper function to capitalize first letter and convert to proper title case
function capitalizeFirstLetter(str: string): string {
  // Handle snake_case: convert to Title Case
  if (str.includes('_')) {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // Handle camelCase: add spaces before capital letters and capitalize
  const withSpaces = str.replace(/([a-z])([A-Z])/g, '$1 $2');
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

// Add a title to every property of a JSON schema, recursing into nested objects, arrays and unions
export function addTitlesToProperties(jsonSchema: Record<string, unknown>): Record<string, unknown> {
  if (!jsonSchema || typeof jsonSchema !== 'object') {
    return jsonSchema;
  }

  // If this object has properties, add titles to them
  if (jsonSchema.properties && typeof jsonSchema.properties === 'object') {
    for (const [propertyName, propertySchema] of Object.entries(jsonSchema.properties)) {
      if (propertySchema && typeof propertySchema === 'object') {
        const schema = propertySchema as Record<string, unknown>;
        // Only add title if it doesn't already exist
        if (!schema.title) {
          schema.title = capitalizeFirstLetter(propertyName);
        }
        // Recursively process nested properties
        addTitlesToProperties(schema);
      }
    }
  }

  // Handle array items
  if (jsonSchema.items) {
    addTitlesToProperties(jsonSchema.items as Record<string, unknown>);
  }

  // Handle oneOf, anyOf, allOf
  if (Array.isArray(jsonSchema.oneOf)) {
    for (const schema of jsonSchema.oneOf) {
      addTitlesToProperties(schema as Record<string, unknown>);
    }
  }
  if (Array.isArray(jsonSchema.anyOf)) {
    for (const schema of jsonSchema.anyOf) {
      addTitlesToProperties(schema as Record<string, unknown>);
    }
  }
  if (Array.isArray(jsonSchema.allOf)) {
    for (const schema of jsonSchema.allOf) {
      addTitlesToProperties(schema as Record<string, unknown>);
    }
  }

  return jsonSchema;
}

```

### Core Architecture Module: `src/shared/lib/hooks/index.ts`
```
export * from './useStorage';

```

### Core Architecture Module: `src/shared/lib/hooks/useStorage.tsx`
```
import { useSyncExternalStore } from 'react';
import type { BaseStorage } from '@extension/storage';

type WrappedPromise = ReturnType<typeof wrapPromise>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const storageMap: Map<BaseStorage<any>, WrappedPromise> = new Map();

export function useStorage<
  Storage extends BaseStorage<Data>,
  Data = Storage extends BaseStorage<infer Data> ? Data : unknown,
>(storage: Storage) {
  const _data = useSyncExternalStore<Data | null>(storage.subscribe, storage.getSnapshot);

  if (!storageMap.has(storage)) {
    storageMap.set(storage, wrapPromise(storage.get()));
  }
  if (_data !== null) {
    storageMap.set(storage, { read: () => _data });
  }

  return (_data ?? storageMap.get(storage)!.read()) as Exclude<Data, PromiseLike<unknown>>;
}

function wrapPromise<R>(promise: Promise<R>) {
  let status = 'pending';
  let result: R;
  const suspender = promise.then(
    r => {
      status = 'success';
      result = r;
    },
    e => {
      status = 'error';
      result = e;
    },
  );

  return {
    read() {
      switch (status) {
        case 'pending':
          throw suspender;
        case 'error':
          throw result;
        default:
          return result;
      }
    },
  };
}

```

### Core Architecture Module: `src/shared/lib/utils/index.ts`
```
export * from './shared-types';

```

### Core Architecture Module: `src/shared/lib/utils/shared-types.ts`
```
export type ValueOf<T> = T[keyof T];

```

### Core Architecture Module: `src/side-panel/utils.ts`
```
export function generateNewTaskId(): string {
  /**
   * Generate a new task id based on the current timestamp and a random number.
   */
  return `${Date.now()}-${Math.floor(Math.random() * (999999 - 100000 + 1) + 100000)}`;
}

export function getCurrentTimestampStr(): string {
  /**
   * Get the current timestamp as a string in the format yyyy-MM-dd HH:mm:ss
   * using local timezone.
   *
   * @returns Formatted datetime string in local time
   */
  return new Date()
    .toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    .replace(',', '');
}

```

### Core Architecture Module: `src/ui/lib/utils.ts`
```
import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

```

### Core Architecture Module: `entrypoints/background.ts`
```
import { defineBackground } from 'wxt/utils/define-background';
// Keep existing Chrome listener registration synchronous at service-worker startup.
// WXT strips side-effect imports when evaluating entrypoint options at build time.
import '@src/background/index';

export default defineBackground({ main() {} });

```

### Core Architecture Module: `entrypoints/content.ts`
```
import { defineContentScript } from 'wxt/utils/define-content-script';
import '../src/content/index';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*', '<all_urls>'],
  allFrames: true,
  main() {},
});

```

### Core Architecture Module: `eslint.config.js`
```
import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import prettier from 'eslint-config-prettier/flat';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tailwindcss from 'eslint-plugin-tailwindcss';

export default [
  {
    ignores: [
      'dist/**',
      '.wxt/**',
      '.output/**',
      '**/tailwind.config.ts',
      // Only TypeScript is linted, as with the previous `--ext .ts,.tsx` setup.
      '**/*.{js,mjs,cjs,jsx,mts,cts}',
    ],
  },
  js.configs.recommended,
  react.configs.flat.recommended,
  ...tsPlugin.configs['flat/recommended'],
  importPlugin.flatConfigs.recommended,
  jsxA11y.flatConfigs.recommended,
  ...tailwindcss.configs['flat/recommended'],
  prettier,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    // ESLint 8 didn't report unused eslint-disable comments.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { chrome: 'readonly' },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'import/no-unresolved': 'off',
      '@typescript-eslint/consistent-type-imports': 'error',
      // typescript-eslint 8 started reporting unused catch bindings; keep the v7 behavior.
      '@typescript-eslint/no-unused-vars': ['error', { caughtErrors: 'none' }],
      // react-hooks 7's recommended preset adds the React Compiler rules; keep the two classic rules.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #326** (2026-06-19): **[Bug]: NanoBrowser extracts answer options but misses question text on Chaoxing exam pages**
  *Symptoms*: ### Nanobrowser Version  0.1.13  ### Bug Description  NanoBrowser is able to extract the answer options (A/B/C/D) from Chaoxing exam pages, but it consistently fails to extract the question text.  I attached a reproduction page (testhtml.zip).  The question text exists in the DOM and can be accessed through normal JavaScript selectors. It is not rendered via canvas, image, iframe, or Shadow DOM.  For example: ```javascript document.querySelector("#sigleQuestionDiv_886191570 > h3 > div") ``` returns the question text node.  The answer options are located at: ```javascript document.querySelector("#sigleQuestionDiv_886191570 > form > div > div:nth-child(1) > span") ``` NanoBrowser can read the options but not the question.  Verification: ```javascript document.querySelector("#sigleQuestionDiv_886191570").innerText ``` returns both the question and all answer choices correctly, indicating that the content is available in the DOM. ``` document.querySelector("#sigleQuestionDiv_886191570").innerText "1. (单选题, 5.0 分) 2025年7月14日至15日，中央城市工作会议在北京举行。关于当前和今后一个时期城市工作，下列说法错误的是( )。 A 认真践行人民城市理念 B 以建设创新、宜居、美丽、韧性、文明、智慧的现代化人民城市为目标 C 以推动城市高质量发展为主题，以坚持城市内涵式发展为主线，以推进城市更新为重要抓手 D 牢牢守住就业民生底线"  ```  Relevant DOM paths:  All questions: ```javascript document.querySelectorAll(".whiteDiv")[0].children ``` First question: ```javascript document.querySelector("#sigleQuestionDiv_886191570 > h3 > div") ``` First option: ```javascript document.querySelector("#sigleQuestionDiv_886191570 > form > div > div:nth-
  **Post-Mortem & Fix Analysis**:
  > I fixed this issue in my fork at: https://github.com/xmexg/nanobrowser-fork/tree/cfcaebdddcb8a79750ce76f7b1e28ab9d28fa84c

- **Issue #281** (2025-12-15): **[Bug]:**
  *Symptoms*: ### Nanobrowser Version  0.1.13  ### Bug Description  is not work  ! [Image](https://github.com/user-attachments/assets/df8e05e7-a437-42b2-a5f8-dd3a7f1999a0)   ### Steps to Reproduce  1. 进入 www.google.com  2. 对Nanobrowser 插件发出指令 3. 没有成功执行，报错 ``` System Task failed:   Failed to invoke google/gemini-2.5-pro with structured output:  401 User not found.  Troubleshooting URL: https://js.langchain.com/docs/troubleshooting/errors/MODEL_AUTHENTICATION/ 05:49 PM  ```  ### LLM Service Provider  OpenAI  ### Models Used  System Task failed:   Failed to invoke google/gemini-2.5-pro with structured output:  401 User not found.  Troubleshooting URL: https://js.langchain.com/docs/troubleshooting/errors/MODEL_AUTHENTICATION/ 05:49 PM  ### Screenshots  _No response_

- **Issue #266** (2025-11-15): **[Bug]: Planning failed: Failed to invoke deepseek-chat with structured output**
  *Symptoms*: ### Nanobrowser Version  0.1.12  ### Bug Description  Planning failed: Failed to invoke deepseek-chat with structured output:  Could not parse response with structured output  ### Steps to Reproduce  1.  chat: 搜索关于agent的文章 2. wait planner after Navigator  ### LLM Service Provider  Other (please specify in description)  ### Models Used  Planner: deepseek-chat Navigator: deepseek-chat Validator: deepseek-chat  ### Screenshots  <img width="362" height="750" alt="Image" src="https://github.com/user-attachments/assets/98a1e56a-c597-4a17-9dc1-7c31f312808a" />
  **Post-Mortem & Fix Analysis**:
  > This error is caused by empty response from deepseek API, usually it would not cause a big problem during the task execution.

- **Issue #252** (2025-10-06): **eror**
  *Symptoms*: ### Nanobrowser Version  a  ### Bug Description  System Task failed:   Access denied (403 Forbidden). Please check:  1. Your API key has the required permissions  2. For Ollama: Set OLLAMA_ORIGINS=chrome-extension://*  see https://github.com/ollama/ollama/blob/main/docs/faq.md  ### Steps to Reproduce  aa  ### LLM Service Provider  OpenAI  ### Models Used  a  ### Screenshots  a
  **Post-Mortem & Fix Analysis**:
  > <img width="1210" height="863" alt="Image" src="https://github.com/user-attachments/assets/e7d61b8f-fa8b-479e-ac09-ca6556decfc2" />
  > linux 24
  > Please read the Notes below the provider models, especially the "Read More".

- **Issue #223** (2025-10-06): **[Bug]: Invalid JSON**
  *Symptoms*: ### Nanobrowser Version  0.1.12  ### Bug Description  I am getting the error:  ``` Navigation failed: Failed to invoke gpt-5-mini with structured output:  400 request body is not valid JSON 10:48 PM Navigation failed: Failed to invoke gpt-5-mini with structured output:  400 request body is not valid JSON 10:48 PM Navigation failed: Failed to invoke gpt-5-mini with structured output:  400 request body is not valid JSON ```  I thought maybe it was an issue with my model but I ran inspector and used jsonlint on the request that was sent and it was in fact invalid. I thought maybe it was just that single instance returning invalid code so ran it again and it failed again.   If I run a small query like "Open Google" then it seems to run. But when I even wrote "Open Google and Search Pants" then it didn't work.   Is nano browser doing any json validation?     ### Steps to Reproduce  Open Google and search for men's pants 10:56 PM Planner Planner 1. Navigate to the Google homepage (https://www.google.com). 2. Locate the search bar on the Google homepage. 3. Enter the search query "men's pants" and submit the search. 10:56 PM Navigator Navigator Navigation failed: Failed to invoke gpt-4.1 with structured output:  400 Invalid JSON: unexpected EOF 10:56 PM Navigation failed: Failed to invoke gpt-4.1 with structured output:  400 Invalid JSON: unexpected EOF 10:56 PM Navigation failed: Failed to invoke gpt-4.1 with structured output:  400 Invalid JSON: unexpected EOF 10:56 PM System Syst
  **Post-Mortem & Fix Analysis**:
  > I tested your prompts with OpenAI offcial API, both GPT-5-mini and GPT-4.1 worked well.  Are you using OpenRouter's API ? If so, it may not work. Some OpenRouter's models don't work as the same as the official models, but we can do nothing with it.

- **Issue #207** (2025-08-27): **[Bug]: Not persisting model configuration**
  *Symptoms*: ### Nanobrowser Version  0.1.9  ### Bug Description  The value of the temperature of planner is not being saved (in configurations), every time I change it and open config page again it is back to default value  ### Steps to Reproduce  1. Set up google gemini key 2. set planner to gemini 2.5-flash 3. try to set temperature of planner to 0.3 (or any value but the default) 4. close the page and open again   The value of the temperature of planner will be back to default  ### LLM Service Provider  Google Gemini  ### Models Used  all of them gemini-2.5-flash  ### Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > @diogopublio this is a bug, will fix it soon, thanks!

- **Issue #196** (2025-08-27): **[Bug]: Doesn't work with GPT-5 variants via OpenRouter**
  *Symptoms*: ### Nanobrowser Version  0.1.8  ### Bug Description  NanoBrowser consistently fails when attempting to use GPT-5, GPT-5-mini and GPT-5-nano models.  It produces the following error message:  Planning / Navigation failed: Failed to invoke openai/gpt-5-mini with structured output: Error: 400 Provider returned error  Despite the error, I suspect that the issue has to do with how top-p and temperature are handled. I believe GPT-5 doesn't support the top-p parameter, and temperature has to be set to 1.0.  ### Steps to Reproduce  1. Install NanoBrowser 2. Configure the OpenRouter API key & provider 3. Select GPT-5-mini as the model 4. Attempt to use NanoBrowser with any prompt 5. Observe the error message  ### LLM Service Provider  OpenRouter  ### Models Used  Planner: anthropic/claude-sonnet-4 Navigator: openai/gpt-5-mini Validator: openai/gpt-5-mini  ### Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > You're right, NanoBrowser just kind of crashes out whenever someone tries to run it with GPT-5 versions (like `gpt-5`, `gpt-5-mini`, or `gpt-5-nano`) through OpenRouter.  The thing that blows it up, in fact, is that the code is tossing in `top_p` and `temperature` values by default, but those newer GPT-5 models, well, they totally don’t even understand those knobs at all.    ---  Now, the quick-and-dirty idea would be: okay fine, let’s just slap in an extra `isGPT5Model()` check and kind of special-case everything.    ```ts if (isOpenAIOModel(modelName)) {   // O-series way of doing things } else if (isGPT5Model(modelName)) {   // GPT-5 oddball behavior } else {   // fallback OpenAI way } ```  But, yeah, that could be a bit of a mess, because every time some fresh model family shows up with its own quirks, we’re just going to pile on more if/else spaghetti.  The bigger snag is that we keep pretending all OpenAI-style models share the same set of switches, when that’s clearly not true a
  > @johnbean393 thank you for reporting this issue.  I've already upgraded provider packages to support latest models in latest commit.   With the OpenRouter provider, gpt-4o-2024-11-20, deepseek-chat-v3.1 and gemini-2.5-pro work well in Nanobrowser, but  gpt-5 can not work well in Navigator agent.  But official OpenAI models including gpt-5 series work well in Nanobrowser.  So I think there must be some problems in OpenRouter's gpt-5.  
  > @agryash thank you for your great suggestion, I will try to apply it into new commits.

- **Issue #183** (2025-07-18): **[Bug]:**
  *Symptoms*: ### Nanobrowser Version  x  ### Bug Description  System Task failed: Access denied (403 Forbidden). Please check:  1. Your API key has the required permissions  2. For Ollama: Set OLLAMA_ORIGINS=chrome-extension://*  see https://github.com/ollama/ollama/blob/main/docs/faq.md  ### Steps to Reproduce  x  ### LLM Service Provider  OpenAI  ### Models Used  x  ### Screenshots  x

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

### Incident Patch 1: `0ce70181` (2026-10-02)
**Commit Message**: fix: remove the minimal reasoning effort option

- Drop Minimal from the settings page and the ReasoningEffort type.
- Treat a saved 'minimal' (or legacy 'minimal/none') effort as low via
  normalizeReasoningEffort, shared by the settings page and providers.
- Remove the per-model OpenAI and Grok mappings for minimal.

**File**: `src/background/llm/__tests__/providers.test.ts` (modified, +7/-40)
```diff
@@ -154,7 +154,7 @@ describe('createChatModel', () => {
 
   it.each<[ModelConfig['reasoningEffort'], ModelConfig['reasoningEffort']]>([
     ['none', undefined],
-    ['minimal', 'minimal'],
+    ['low', 'low'],
     ['xhigh', 'xhigh'],
   ])('a saved effort %s is sent as %s', (effort, expected) => {
     expect(getReasoningEffort(provider(), model('anthropic', 'claude-opus-5-5', { reasoningEffort: effort }))).toBe(
@@ -184,52 +184,20 @@ describe('createChatModel', () => {
     });
   });
 
-  it('maps gpt-5.1 minimal to none for OpenAI but not for Azure', () => {
-    const openai = createChatModel(provider(), model('openai', 'gpt-5.1', { reasoningEffort: 'minimal' }));
-    expect(openai.providerOptions?.openai?.reasoningEffort).toBe('none');
+  it.each(['minimal', 'minimal/none'])('treats a saved %s effort as low', effort => {
+    const reasoningEffort = effort as ModelConfig['reasoningEffort'];
+    const openai = createChatModel(provider(), model('openai', 'gpt-5.4-mini', { reasoningEffort }));
+    expect(openai.providerOptions?.openai?.reasoningEffort).toBe('low');
 
-    const azureProvider = provider({
-      baseUrl: 'https://my-instance.openai.azure.com/',
-      azureDeploymentNames: ['gpt-5.1'],
-      azureApiVersion: '2025-04-01-preview',
-    });
-    const azure = createChatModel(azureProvider, model('azure_openai', 'gpt-5.1', { reasoningEffort: 'minimal' }));
-    expect(azure.providerOptions?.openai?.reasoningEffort).toBe('minimal');
-  });
-
-  it.each([
-    ['gpt-5.5', 'minimal'],
-    ['gpt-5.4-mini', 'none'],
-    ['gpt-6-luna', 'none'],
-    ['gpt-6-astra', 'low'],
-    ['gpt-6.1-sol', 'low'],
-  ])('maps minimal effort on %s to %s', (name, expected) => {
-    const chatModel = createChatModel(provider(), model('openai', name, { reasoningEffort: 'minimal' }));
-    expect(chatModel.providerOptions?.openai?.reasoningEffort).toBe(expected);
-  });
-
-  it.each([
-    ['gpt-5', 'minimal'],
-    ['gpt-5.4-mini', 'none'],
-    ['gpt-6.1-sol', 'low'],
-  ])('treats the legacy minimal/none effort on %s as minimal', (name, expected) => {
-    const chatModel = createChatModel(
-      provider(),
-      model('openai', name, { reasoningEffort: 'minimal/none' as ModelConfig['reasoningEffort'] }),
-    );
-    expect(chatModel.providerOptions?.openai?.reasoningEffort).toBe(expected);
-  });
-
-  it('treats the legacy minimal/none effort as minimal on Azure', () => {
     const azure = createChatModel(
       provider({
         baseUrl: 'https://my-instance.openai.azure.com/',
         azureDeploymentNames: ['gpt-5'],
         azureApiVersion: '2025-04-01-preview',
       }),
-      model('azure_openai', 'gpt-5', { reasoningEffort: 'minimal/none' as ModelConfig['reasoningEffort'] }),
+      model('azure_openai', 'gpt-5', { reasoningEffort }),
     );
-    expect(azure.providerOptions?.openai?.reasoningEffort).toBe('minimal');
+    expect(azure.providerOptions?.openai?.reasoningEffort).toBe('low');
   });
 
   it.each<[string, string]>([
@@ -564,7 +532,6 @@ describe('createChatModel', () => {
 
     it.each<[ModelConfig['reasoningEffort'], string | undefined]>([
       [undefined, 'low'],
-      ['minimal', 'low'],
       ['medium', 'medium'],
       ['xhigh', 'xhigh'],
       ['none', undefined],
```

**File**: `src/background/llm/providers.ts` (modified, +9/-30)
```diff
@@ -12,6 +12,7 @@ import {
   ProviderTypeEnum,
   getDefaultReasoningEffort,
   getProviderTypeByProviderId,
+  normalizeReasoningEffort,
 } from '@extension/storage';
 import type { ChatModel, StructuredMode } from './types';
 
@@ -72,8 +73,7 @@ export function getReasoningEffort(
   providerConfig: ProviderConfig,
   modelConfig: ModelConfig,
 ): SentReasoningEffort | undefined {
-  // The settings page used to save OpenAI's Minimal option as 'minimal/none'
-  const saved = (modelConfig.reasoningEffort as string) === 'minimal/none' ? 'minimal' : modelConfig.reasoningEffort;
+  const saved = normalizeReasoningEffort(modelConfig.reasoningEffort);
   const effort =
     saved ?? getDefaultReasoningEffort(providerConfig.type ?? getProviderTypeByProviderId(modelConfig.provider));
   return effort === 'none' ? undefined : effort;
@@ -90,25 +90,9 @@ function acceptsOpenAIXhigh(modelName: string): boolean {
   return /gpt-6/.test(modelName) || /gpt-5\.([2-9]|\d{2,})/.test(modelName);
 }
 
-/**
- * Map an effort an OpenAI reasoning model rejects to the nearest one it accepts.
- * xhigh becomes high where unsupported. With `mapMinimal` (not Azure), gpt-5.1 to gpt-5.4 and gpt-6-luna,
- * which don't support minimal, get none; the other gpt-6 models support neither minimal nor none, so they get low
- */
-function getOpenAIReasoningEffort(modelName: string, effort: SentReasoningEffort, mapMinimal: boolean) {
-  if (effort === 'xhigh') {
-    return acceptsOpenAIXhigh(modelName) ? effort : ('high' as const);
-  }
-  if (!mapMinimal || effort !== 'minimal') {
-    return effort;
-  }
-  if (modelName.includes('gpt-6-luna') || /gpt-5\.[1-4]/.test(modelName)) {
-    return 'none' as const;
-  }
-  if (modelName.includes('gpt-6')) {
-    return 'low' as const;
-  }
-  return effort;
+// Map xhigh to high on OpenAI reasoning models that don't support it
+function getOpenAIReasoningEffort(modelName: string, effort: SentReasoningEffort) {
+  return effort === 'xhigh' && !acceptsOpenAIXhigh(modelName) ? ('high' as const) : effort;
 }
 
 /**
@@ -120,14 +104,14 @@ function getOpenAIReasoningEffort(modelName: string, effort: SentReasoningEffort
 function getOpenAIFamilyOptions(
   modelName: string,
   effort: SentReasoningEffort | undefined,
-  { mapMinimal, anyModelReasons }: { mapMinimal: boolean; anyModelReasons: boolean },
+  { anyModelReasons }: { anyModelReasons: boolean },
 ): Pick<ChatModel, 'settings' | 'providerOptions'> {
   const reasoningModel = isOpenAIReasoningModel(modelName);
   // Custom endpoints serving other models get the chosen effort as is
   const reasoningEffort = !effort
     ? undefined
     : reasoningModel
-      ? getOpenAIReasoningEffort(modelName, effort, mapMinimal)
+      ? getOpenAIReasoningEffort(modelName, effort)
       : anyModelReasons
         ? effort
         : undefined;
@@ -221,9 +205,7 @@ function createAzureChatModel(
     provider: modelConfig.provider,
     modelName: deploymentName,
     model: azure.chat(deploymentName),
-    // Azure never had the minimal effort mapping
     ...getOpenAIFamilyOptions(deploymentName, getReasoningEffort(providerConfig, modelConfig), {
-      mapMinimal: false,
       anyModelReasons: false,
     }),
     structuredMode: getStructuredMode(modelConfig.provider, deploymentName),
@@ -296,10 +278,8 @@ export function createChatModel(
             // The Responses API stores prompts and responses for 30 days by default; history is kept locally instead
             store: false,
             // xAI defaults to high effort, which is slow for every agent step. The effort is sent as is, since
-            // the AI SDK's reasoning setting maps xhigh to high on grok-4.7; xAI has no minimal effort
-            ...(effort && acceptsGrokReasoningEffort(modelName)
-              ? { reasoningEffort: effort === 'minimal' ? 'low' : effort }
-              : {}),
+            // the AI SDK's reasoning setting maps xhigh to high on grok-4.7
+            ...(effort && acceptsGrokReasoningEffort(modelName) ? { reasoningEffort: effort } : {}),
           },
         },
       };
@@ -348,7 +328,6 @@ export function createChatModel(
         ...base,
         model: openai.chat(modelName),
         ...getOpenAIFamilyOptions(modelName, effort, {
-          mapMinimal: true,
           anyModelReasons:
             (providerConfig.type ?? getProviderTypeByProviderId(provider)) === ProviderTypeEnum.CustomOpenAI,
         }),
```

**File**: `src/options/components/ModelSettings.tsx` (modified, +2/-3)
```diff
@@ -19,6 +19,7 @@ import {
   getDefaultDisplayNameFromProviderId,
   getDefaultProviderConfig,
   getDefaultReasoningEffort,
+  normalizeReasoningEffort,
   getProviderTypeByProviderId,
   type ProviderConfig,
   type ReasoningEffort,
@@ -38,7 +39,6 @@ function isOpenAIReasoningModel(modelName: string): boolean {
 
 const reasoningEffortOptions: Array<{ value: ReasoningEffort; label: string }> = [
   { value: 'none', label: 'None' },
-  { value: 'minimal', label: 'Minimal' },
   { value: 'low', label: 'Low' },
   { value: 'medium', label: 'Medium' },
   { value: 'high', label: 'High' },
@@ -117,8 +117,7 @@ export const ModelSettings = ({ isDarkMode = false }: ModelSettingsProps) => {
             if (config.reasoningEffort) {
               setReasoningEffort(prev => ({
                 ...prev,
-                // Older versions saved OpenAI's Minimal option as 'minimal/none'
-                [agent]: (config.reasoningEffort as string) === 'minimal/none' ? 'minimal' : config.reasoningEffort,
+                [agent]: normalizeReasoningEffort(config.reasoningEffort),
               }));
             }
           }
```

**File**: `src/storage/lib/settings/agentModels.ts` (modified, +9/-1)
```diff
@@ -4,7 +4,15 @@ import type { BaseStorage } from '../base/types';
 import { AgentNameEnum } from './types';
 
 // Reasoning effort for a model. 'none' sends no effort, so the model's own default applies
-export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
+export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh';
+
+/**
+ * A saved reasoning effort as the current options. Minimal was removed, so a saved 'minimal'
+ * (or the older 'minimal/none') becomes low.
+ */
+export function normalizeReasoningEffort(saved: string | undefined): ReasoningEffort | undefined {
+  return saved === 'minimal' || saved === 'minimal/none' ? 'low' : (saved as ReasoningEffort | undefined);
+}
 
 // Interface for a single model configuration
 export interface ModelConfig {
```

---

### Incident Patch 2: `82a9ed33` (2026-10-02)
**Commit Message**: chore: drop unused dev deps and fix env typings

- Remove unused cross-env, tslib and @types/ws
- Move eslint-plugin-tailwindcss to devDependencies
- Declare VITE_POSTHOG_API_KEY instead of the unused VITE_EXAMPLE

**File**: `package.json` (modified, +1/-4)
```diff
@@ -33,7 +33,6 @@
     "@openrouter/ai-sdk-provider": "3.1.0",
     "ai": "7.0.126",
     "clsx": "^2.1.1",
-    "eslint-plugin-tailwindcss": "^3.18.2",
     "jsonrepair": "^3.15.0",
     "posthog-js": "^1.434.17",
     "puppeteer-core": "^25.12.0",
@@ -50,12 +49,10 @@
     "@types/node": "^24.19.0",
     "@types/react": "^18.3.27",
     "@types/react-dom": "^18.3.7",
-    "@types/ws": "^8.5.13",
     "@typescript-eslint/eslint-plugin": "^8.71.0",
     "@typescript-eslint/parser": "^8.71.0",
     "@vitejs/plugin-react-swc": "^4.3.3",
     "autoprefixer": "^10.6.1",
-    "cross-env": "^7.0.3",
     "deepmerge": "^4.3.1",
     "esbuild": "^0.28.2",
     "eslint": "9.39.5",
@@ -65,6 +62,7 @@
     "eslint-plugin-prettier": "5.5.6",
     "eslint-plugin-react": "7.37.5",
     "eslint-plugin-react-hooks": "7.1.1",
+    "eslint-plugin-tailwindcss": "^3.18.2",
     "fast-glob": "^3.3.2",
     "fflate": "^0.8.3",
     "husky": "^9.1.4",
@@ -73,7 +71,6 @@
     "prettier": "^3.9.9",
     "rimraf": "^6.1.3",
     "tailwindcss": "^3.4.17",
-    "tslib": "^2.6.3",
     "tsx": "^4.23.15",
     "typescript": "6.0.3",
     "vite": "^8.3.1",
```

**File**: `pnpm-lock.yaml` (modified, +3/-45)
```diff
@@ -35,9 +35,6 @@ importers:
       clsx:
         specifier: ^2.1.1
         version: 2.1.1
-      eslint-plugin-tailwindcss:
-        specifier: ^3.18.2
-        version: 3.18.2(tailwindcss@3.4.18(tsx@4.23.15)(yaml@2.9.1))
       jsonrepair:
         specifier: ^3.15.0
         version: 3.15.0
@@ -81,9 +78,6 @@ importers:
       '@types/react-dom':
         specifier: ^18.3.7
         version: 18.3.7(@types/react@18.3.27)
-      '@types/ws':
-        specifier: ^8.5.13
-        version: 8.18.1
       '@typescript-eslint/eslint-plugin':
         specifier: ^8.71.0
         version: 8.71.0(@typescript-eslint/parser@8.71.0(eslint@9.39.5(jiti@1.21.7))(typescript@6.0.3))(eslint@9.39.5(jiti@1.21.7))(typescript@6.0.3)
@@ -96,9 +90,6 @@ importers:
       autoprefixer:
         specifier: ^10.6.1
         version: 10.6.1(postcss@8.5.28)
-      cross-env:
-        specifier: ^7.0.3
-        version: 7.0.3
       deepmerge:
         specifier: ^4.3.1
         version: 4.3.1
@@ -126,6 +117,9 @@ importers:
       eslint-plugin-react-hooks:
         specifier: 7.1.1
         version: 7.1.1(eslint@9.39.5(jiti@1.21.7))
+      eslint-plugin-tailwindcss:
+        specifier: ^3.18.2
+        version: 3.18.2(tailwindcss@3.4.18(tsx@4.23.15)(yaml@2.9.1))
       fast-glob:
         specifier: ^3.3.2
         version: 3.3.3
@@ -150,9 +144,6 @@ importers:
       tailwindcss:
         specifier: ^3.4.17
         version: 3.4.18(tsx@4.23.15)(yaml@2.9.1)
-      tslib:
-        specifier: ^2.6.3
-        version: 2.8.1
       tsx:
         specifier: ^4.23.15
         version: 4.23.15
@@ -956,9 +947,6 @@ packages:
   '@types/json5@0.0.29':
     resolution: {integrity: sha512-dRLjCWHYg4oaA77cxO64oO+7JwCwnIzkZPdrrC71jQmQtlhM556pwKo5bUzqvZndkVbeFLIIi+9TC40JNF5hNQ==}
 
-  '@types/node@22.19.1':
-    resolution: {integrity: sha512-LCCV0HdSZZZb34qifBsyWlUmok6W7ouER+oQIGBScS8EsZsQbrtFTUrDX4hOl+CS6p7cnNC4td+qrSVGSCTUfQ==}
-
   '@types/node@24.19.0':
     resolution: {integrity: sha512-zY+5tKxXdhGh1PYI0ac+7juvEu4OI6vWtVVoj5i2m42jxAY1U+zHGt6QCyOFwykdP62sM3MJ9stoYYUw5aCWew==}
 
@@ -976,9 +964,6 @@ packages:
   '@types/trusted-types@2.0.7':
     resolution: {integrity: sha512-ScaPdn1dQczgbl0QFTeTOmVHFULt394XJgOQNoyVhZ6r2vLnMLJfBPd53SB52T/3G36VI1/g2MZaX0cwDuXsfw==}
 
-  '@types/ws@8.18.1':
-    resolution: {integrity: sha512-ThVF6DCVhA8kUGy+aazFQ4kXQ7E1Ty7A3ypFOe0IcJV8O/M511G99AW24irKrW56Wt44yG9+ij8FaqoBGkuBXg==}
-
   '@typescript-eslint/eslint-plugin@8.71.0':
     resolution: {integrity: sha512-pqcS9c1HxZTHt7End4nXqd0s5lJrrFzrgCkKFJrsbUnaL6M3+6oBFZaslg6Gjsl3argl2DDRFROnXARaZ2e4Nw==}
     engines: {node: ^18.18.0 || ^20.9.0 || >=21.1.0}
@@ -1421,11 +1406,6 @@ packages:
   core-js@3.50.0:
     resolution: {integrity: sha512-BRWgOLKkFeCgRudR6zrs8p9XJZcE14grzKMMssoYrk6krtuEZ7MTKPIY5RzOnqsEKIR9kst7wNzphttraT+Yqw==}
 
-  cross-env@7.0.3:
-    resolution: {integrity: sha512-+/HKd6EgcQCJGh2PSjZuUitQBQynKor4wrFbRg4DtAgS1aWO+gU52xpH7M9ScGgXSYmAVS9bIJ8EzuaGw0oNAw==}
-    engines: {node: '>=10.14', npm: '>=6', yarn: '>=1'}
-    hasBin: true
-
   cross-spawn@7.0.6:
     resolution: {integrity: sha512-uV2QOWP2nWzsy2aMp8aRibhi9dlzF5Hgh5SHaB9OiTGEyDTiJJyx0uy51QXdyWbtAHNua4XJzUKca3OzKUd3vA==}
     engines: {node: '>= 8'}
@@ -3012,9 +2992,6 @@ packages:
   tsconfig-paths@3.15.0:
     resolution: {integrity: sha512-2Ac2RgzDe/cn48GvOe3M+o82pEFewD3UPbyoUHHdKasHwJKjds4fLXWf/Ux5kATBKN20oaFGu+jbElp1pos0mg==}
 
-  tslib@2.8.1:
-    resolution: {integrity: sha512-oJFu94HQb+KVduSUQL7wnpmqnfmLsOA/nAh6b6EH0wCEoK0/mPeXU6c3wKDV83MkOuHPRHtSXKKU99IBazS/2w==}
-
   tsx@4.23.15:
     resolution: {integrity: sha512-Yiex1Ovn8z2xPpOWckIiysV1SSyRMY9BkLF++q0yKiDxCqRhosKfMg3janKkiLBwZ5c/YryloKwGZcrEmtwxKw==}
     engines: {node: '>=18.0.0'}
@@ -3058,9 +3035,6 @@ packages:
     resolution: {integrity: sha512-nWJ91DjeOkej/TA8pXQ3myruKpKEYgqvpw9lz4OPHj/NWFNluYrjbz9j01CJ8yKQd2g4jFoOkINCTW2I5LEEyw==}
     engines: {node: '>= 0.4'}
 
-  undici-types@6.21.0:
-    resolution: {integrity: sha512-iwDZqg0QAGrg9Rav5H4n0M64c3mkR59cJ6wQp+7C4nI0gsmExaedaYLNO44eT4AtBBwjbTiGPMlt2Md0T9H9JQ==}
-
   undici-types@7.24.6:
     resolution: {integrity: sha512-WRNW+sJgj5OBN4/0JpHFqtqzhpbnV0GuB+OozA9gCL7a993SmU+1JBZCzLNxYsbMfIeDL+lTsphD5jN5N+n0zg==}
 
@@ -3969,10 +3943,6 @@ snapshots:
 
   '@types/json5@0.0.29': {}
 
-  '@types/node@22.19.1':
-    dependencies:
-      undici-types: 6.21.0
-
   '@types/node@24.19.0':
     dependencies:
       undici-types: 7.24.6
@@ -3991,10 +3961,6 @@ snapshots:
   '@types/trusted-types@2.0.7':
     optional: true
 
-  '@types/ws@8.18.1':
-    dependencies:
-      '@types/node': 22.19.1
-
   '@typescript-eslint/eslint-plugin@8.71.0(@typescript-eslint/parser@8.71.0(eslint@9.39.5(jiti@1.21.7))(typescript@6.0.3))(eslint@9.39.5(jiti@1.21.7))(typescript@6.0.3)':
     dependencies:
       '@eslint-community/regexpp': 4.12.2
@@ -4536,10 +4502,6 @@ snapshots:
 
   core-js@3.50.0: {}
 
-  cross-env@7.0.3:
-    dependencies:
-      cross-spawn: 7.0.6
-
   cross-spawn@7.0.6:
     dependenc
```

**File**: `vite-env.d.ts` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 /// <reference types="vite/client" />
 
 interface ImportMetaEnv {
-  readonly VITE_EXAMPLE: string;
+  readonly VITE_POSTHOG_API_KEY?: string;
 }
 
 interface ImportMeta {
```

---

### Incident Patch 3: `7885bf1c` (2026-10-02)
**Commit Message**: build: migrate to a single WXT package and the AI SDK v7

Squash of the wxt branch, without its migration notes.

- Build the extension with WXT 0.21.4 as a single pnpm package; the
  monorepo workspaces now live under src/ and are bundled from source.
- Replace LangChain with the Vercel AI SDK v7 (src/background/llm/),
  upgrade zod to 4.6.5, and build the navigator schema with zodSchema.
- Support Ollama through its OpenAI-compatible API; remove the Groq,
  Cerebras and Llama API providers.
- Use reasoning effort instead of sampling where models support it, and
  fix structured output for Anthropic, Gemini 3, DeepSeek and GPT-6.
- Require Node 24 LTS and pnpm 10 with a 72h minimum release age, and
  upgrade dependencies.

**File**: `.eslintignore` (removed, +0/-4)
```diff
@@ -1,4 +0,0 @@
-dist
-node_modules
-tailwind.config.ts
-buildDomTree.js
\ No newline at end of file
```

**File**: `.eslintrc` (removed, +0/-40)
```diff
@@ -1,40 +0,0 @@
-{
-  "env": {
-    "browser": true,
-    "es6": true,
-    "node": true,
-  },
-  "extends": [
-    "eslint:recommended",
-    "plugin:react/recommended",
-    "plugin:@typescript-eslint/recommended",
-    "plugin:react-hooks/recommended",
-    "plugin:import/recommended",
-    "plugin:jsx-a11y/recommended",
-    "plugin:tailwindcss/recommended",
-    "prettier",
-  ],
-  "parser": "@typescript-eslint/parser",
-  "parserOptions": {
-    "ecmaFeatures": {
-      "jsx": true,
-    },
-    "ecmaVersion": "latest",
-    "sourceType": "module",
-  },
-  "plugins": ["react", "@typescript-eslint", "react-hooks", "import", "jsx-a11y", "prettier"],
-  "settings": {
-    "react": {
-      "version": "detect",
-    },
-  },
-  "rules": {
-    "react/react-in-jsx-scope": "off",
-    "import/no-unresolved": "off",
-    "@typescript-eslint/consistent-type-imports": "error",
-  },
-  "globals": {
-    "chrome": "readonly",
-  },
-  "ignorePatterns": ["watch.js", "dist/**"],
-}
```

**File**: `.gitattributes` (modified, +0/-1)
```diff
@@ -26,7 +26,6 @@
 .prettierrc text
 .nvmrc text
 tsconfig.json text
-turbo.json text
 
 # Chrome extension
 *.crx binary
```

**File**: `.gitignore` (modified, +3/-3)
```diff
@@ -19,13 +19,13 @@
 # etc
 .DS_Store
 .idea
-**/.turbo
 
 # compiled
-chrome-extension/public/manifest.json
 **/tailwind-output.css
 
 .nanobrowser
 .vscode
 .cursor
-*.py
\ No newline at end of file
+*.py
+.wxt/
+.output/
```

**File**: `.npmrc` (modified, +3/-1)
```diff
@@ -1,2 +1,4 @@
 public-hoist-pattern[]=@testing-library/dom
-engine-strict=true
\ No newline at end of file
+engine-strict=true
+# Refuse package versions published less than 72h (4320 min) ago (supply-chain safety).
+minimum-release-age=4320
```

**File**: `.nvmrc` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-22.12.0
```

**File**: `.prettierignore` (modified, +3/-1)
```diff
@@ -8,4 +8,6 @@ node_modules
 .prettierignore
 LICENSE
 *.md
-pnpm-lock.yaml
\ No newline at end of file
+pnpm-lock.yaml
+.wxt/
+.output/
```

**File**: `CLAUDE.md` (modified, +60/-82)
```diff
@@ -8,75 +8,54 @@ Nanobrowser is an open-source AI web automation Chrome extension that runs multi
 
 ## Development Commands
 
-**Package Manager**: Always use `pnpm` (required, configured in Cursor rules)
+**Package Manager**: Always use `pnpm` 10.34.6 (pinned in `package.json`). Use Node.js 24 LTS; any global pnpm 10+ (or `corepack enable`) switches to the pinned version, and `engines` refuses pnpm 9 and npm. `.npmrc` sets `minimum-release-age=4320`, so pnpm refuses package versions published less than 72 hours ago.
 
 **Core Commands**:
 
 - `pnpm install` - Install dependencies
-- `pnpm dev` - Start development mode with hot reload
-- `pnpm build` - Build production version
-- `pnpm type-check` - Run TypeScript type checking
+- `pnpm dev` - Start WXT development mode with page HMR and extension reloads
+- `pnpm build` - Build the Chromium MV3 extension with WXT
+- `pnpm type-check` - Regenerate i18n types and `.wxt/`, then run TypeScript type checking
 - `pnpm lint` - Run ESLint with auto-fix
 - `pnpm prettier` - Format code with Prettier
 
 **Testing**:
 
-- `pnpm e2e` - Run end-to-end tests (builds and zips first)
-- `pnpm zip` - Create extension zip for distribution
-- `pnpm -F chrome-extension test` - Run unit tests (Vitest) for core extension
-  - Targeted example: `pnpm -F chrome-extension test -- -t "Sanitizer"`
-
-### Workspace Tips
-
-- Scope tasks to a single workspace to speed up runs:
-  - `pnpm -F chrome-extension build`
-  - `pnpm -F packages/ui lint`
-- Prefer workspace-scoped commands over root-wide runs when possible.
+- `pnpm zip` - Build and create an extension zip for distribution
+- `pnpm test` - Run unit tests (Vitest)
+  - Targeted example: `pnpm test -t "Sanitizer"`
 
 Targeted examples (fast path):
-- `pnpm -F pages/side-panel build` — build only the side panel
-- `pnpm -F chrome-extension dev` — dev-watch background/service worker
-- `pnpm -F packages/storage type-check` — TS checks for storage package
-- `pnpm -F pages/side-panel lint -- src/components/ChatInput.tsx` — lint a file
-- `pnpm -F chrome-extension prettier -- src/background/index.ts` — format a file
+- `pnpm exec eslint src/side-panel/components/ChatInput.tsx` — lint a file without auto-fix
+- `pnpm exec prettier --write src/side-panel` — format a directory
 
 **Cleaning**:
 
-- `pnpm clean` - Clean all build artifacts and node_modules
-- `pnpm clean:bundle` - Clean just build outputs
-- `pnpm clean:turbo` - Clear Turbo state/cache
-- `pnpm clean:node_modules` - Remove dependencies in current workspace
+- `pnpm clean` - Remove build outputs (`dist/`, `dist-zip/`, `.wxt/`)
+- `pnpm clean:node_modules` - Remove dependencies
 - `pnpm clean:install` - Clean node_modules and reinstall dependencies
-- `pnpm update-version` - Update version across all packages
+- `pnpm update-version` - Update the version in `package.json`
 
 ## Architecture
 
-This is a **monorepo** using **Turbo** for build orchestration and **pnpm workspaces**.
+This is a **single pnpm package** built by **WXT**, with WXT's default layout at the repo root.
 
-### Workspace Structure
+### Project Structure
 
-**Core Extension**:
-
-- `chrome-extension/` - Main Chrome extension manifest and background scripts
-  - `src/background/` - Background service worker with multi-agent system
+- `wxt.config.ts` - Manifest, Vite settings, aliases, and build hooks
+- `entrypoints/` - Thin wrappers importing the background, content, side panel, and options source
+- `public/` - Static files copied into the build: icons, `permission/`, `buildDomTree.js`, and `_locales/`
+- `src/background/` - Background service worker with multi-agent system
   - `src/background/agent/` - AI agent implementations (Navigator, Planner, Validator)
   - `src/background/browser/` - Browser automation and DOM manipulation
-
-**UI Pages** (`pages/`):
-
-- `side-panel/` - Main chat interface (React + TypeScript + Tailwind)
-- `options/` - Extension settings page (React + TypeScript)
-- `content/` - Content script for page injection
-
-**Shared Packages** (`packages/`):
-
-- `shared/` - Common utilities and types
-- `storage/` - Chrome extension storage abstraction
-- `ui/` - Shared React components
-- `schema-utils/` - Validation schemas
-- `i18n/` - Internationalization
-- Others: `dev-utils/`, `zipper/`, `vite-config/`, `tailwind-config/`, `hmr/`,
-  `tsconfig/`
+- `src/side-panel/` - Main chat interface (React + TypeScript + Tailwind)
+- `src/options/` - Extension settings page (React + TypeScript)
+- `src/content/` - Content script for page injection
+- `src/storage/` - Chrome extension storage abstraction (`@extension/storage`)
+- `src/i18n/` - Internationalization (`@extension/i18n`)
+- `src/ui/` - Shared React components and the `withUI` Tailwind helper (`@extension/ui`)
+- `src/shared/` - Common hooks, HOCs, and utilities (`@extension/shared`)
+- `scripts/zip.ts` - Zips `dist/` into `dist-zip/`
 
 ### Multi-Agent System
 
@@ -86,43 +65,46 @@ The core AI system consists of three speci
```

---

### Incident Patch 4: `e1f8984c` (2025-11-22)
**Commit Message**: Merge pull request #278 from nanobrowser/bugfix

Bugfix

**File**: `chrome-extension/package.json` (modified, +2/-2)
```diff
@@ -28,9 +28,9 @@
     "@langchain/ollama": "0.2.4",
     "@langchain/openai": "0.6.16",
     "@langchain/xai": "^0.1.0",
-    "jsonrepair": "3.13.1",
+    "jsonrepair": "^3.13.1",
     "posthog-js": "^1.271.0",
-    "puppeteer-core": "^24.10.1",
+    "puppeteer-core": "^24.31.0",
     "webextension-polyfill": "^0.12.0",
     "zod": "^3.25.76",
     "zod-to-json-schema": "^3.24.6"
```

**File**: `chrome-extension/src/background/index.ts` (modified, +10/-0)
```diff
@@ -24,6 +24,7 @@ const logger = createLogger('background');
 const browserContext = new BrowserContext({});
 let currentExecutor: Executor | null = null;
 let currentPort: chrome.runtime.Port | null = null;
+const SIDE_PANEL_URL = chrome.runtime.getURL('side-panel/index.html');
 
 // Setup side panel behavior
 chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(error => console.error(error));
@@ -75,6 +76,15 @@ chrome.runtime.onMessage.addListener(() => {
 // Setup connection listener for long-lived connections (e.g., side panel)
 chrome.runtime.onConnect.addListener(port => {
   if (port.name === 'side-panel-connection') {
+    const senderUrl = port.sender?.url;
+    const senderId = port.sender?.id;
+
+    if (!senderUrl || senderId !== chrome.runtime.id || senderUrl !== SIDE_PANEL_URL) {
+      logger.warning('Blocked unauthorized side-panel-connection', senderId, senderUrl);
+      port.disconnect();
+      return;
+    }
+
     currentPort = port;
 
     port.onMessage.addListener(async message => {
```

**File**: `package.json` (modified, +6/-5)
```diff
@@ -31,10 +31,10 @@
     "react-dom": "18.3.1"
   },
   "devDependencies": {
-    "@types/chrome": "0.0.326",
+    "@types/chrome": "^0.0.330",
     "@types/node": "^22.5.5",
-    "@types/react": "18.3.23",
-    "@types/react-dom": "18.3.7",
+    "@types/react": "^18.3.27",
+    "@types/react-dom": "^18.3.7",
     "@typescript-eslint/eslint-plugin": "^7.18.0",
     "@typescript-eslint/parser": "^7.18.0",
     "autoprefixer": "^10.4.20",
@@ -52,7 +52,7 @@
     "lint-staged": "^15.2.7",
     "postcss": "^8.4.47",
     "prettier": "^3.3.3",
-    "rimraf": "^6.0.1",
+    "rimraf": "^6.1.2",
     "tailwindcss": "^3.4.17",
     "tslib": "^2.6.3",
     "typescript": "5.5.4",
@@ -74,7 +74,8 @@
       "cross-spawn": "^7.0.5",
       "esbuild": "^0.25.1",
       "nanoid": "3.3.11",
-      "tar-fs": "^3.1.1"
+      "tar-fs": "^3.1.1",
+      "glob": "^11.0.1"
     }
   }
 }
```

**File**: `pnpm-lock.yaml` (modified, +240/-320)
```diff
@@ -9,6 +9,7 @@ overrides:
   esbuild: ^0.25.1
   nanoid: 3.3.11
   tar-fs: ^3.1.1
+  glob: ^11.0.1
 
 importers:
 
@@ -25,17 +26,17 @@ importers:
         version: 18.3.1(react@18.3.1)
     devDependencies:
       '@types/chrome':
-        specifier: 0.0.326
-        version: 0.0.326
+        specifier: ^0.0.330
+        version: 0.0.330
       '@types/node':
         specifier: ^22.5.5
         version: 22.19.1
       '@types/react':
-        specifier: 18.3.23
-        version: 18.3.23
+        specifier: ^18.3.27
+        version: 18.3.27
       '@types/react-dom':
-        specifier: 18.3.7
-        version: 18.3.7(@types/react@18.3.23)
+        specifier: ^18.3.7
+        version: 18.3.7(@types/react@18.3.27)
       '@typescript-eslint/eslint-plugin':
         specifier: ^7.18.0
         version: 7.18.0(@typescript-eslint/parser@7.18.0(eslint@8.57.0)(typescript@5.5.4))(eslint@8.57.0)(typescript@5.5.4)
@@ -88,8 +89,8 @@ importers:
         specifier: ^3.3.3
         version: 3.6.2
       rimraf:
-        specifier: ^6.0.1
-        version: 6.1.0
+        specifier: ^6.1.2
+        version: 6.1.2
       run-script-os:
         specifier: ^1.1.6
         version: 1.1.6
@@ -148,14 +149,14 @@ importers:
         specifier: ^0.1.0
         version: 0.1.0(@langchain/core@0.3.79(openai@5.12.2(ws@8.18.3)(zod@3.25.76)))(ws@8.18.3)
       jsonrepair:
-        specifier: 3.13.1
+        specifier: ^3.13.1
         version: 3.13.1
       posthog-js:
         specifier: ^1.271.0
-        version: 1.293.0
+        version: 1.297.2
       puppeteer-core:
-        specifier: ^24.10.1
-        version: 24.30.0
+        specifier: ^24.31.0
+        version: 24.31.0
       webextension-polyfill:
         specifier: ^0.12.0
         version: 0.12.0
@@ -164,7 +165,7 @@ importers:
         version: 3.25.76
       zod-to-json-schema:
         specifier: ^3.24.6
-        version: 3.24.6(zod@3.25.76)
+        version: 3.25.0(zod@3.25.76)
     devDependencies:
       '@extension/dev-utils':
         specifier: workspace:*
@@ -195,7 +196,7 @@ importers:
         version: 0.30.21
       ts-loader:
         specifier: ^9.5.1
-        version: 9.5.4(typescript@5.5.4)(webpack@5.102.1(esbuild@0.25.12))
+        version: 9.5.4(typescript@5.5.4)(webpack@5.103.0(esbuild@0.25.12))
       vitest:
         specifier: 2.1.9
         version: 2.1.9(@types/node@22.19.1)(terser@5.44.1)
@@ -216,7 +217,7 @@ importers:
         version: link:../tsconfig
       '@rollup/plugin-sucrase':
         specifier: ^5.0.2
-        version: 5.0.2(rollup@4.53.2)
+        version: 5.0.2(rollup@4.53.3)
       '@types/ws':
         specifier: ^8.5.13
         version: 8.18.1
@@ -228,10 +229,10 @@ importers:
         version: 3.3.3
       rollup:
         specifier: ^4.24.0
-        version: 4.53.2
+        version: 4.53.3
       ts-node:
         specifier: ^10.9.2
-        version: 10.9.2(@swc/core@1.15.2)(@types/node@22.19.1)(typescript@5.5.4)
+        version: 10.9.2(@swc/core@1.15.3)(@types/node@22.19.1)(typescript@5.5.4)
       ws:
         specifier: 8.18.0
         version: 8.18.0
@@ -729,16 +730,12 @@ packages:
     resolution: {integrity: sha512-oGB+UxlgWcgQkgwo8GcEGwemoTFt3FIO9ababBmaGwXIoBKZ+GTy0pP185beGg7Llih/NSHSV2XAs1lnznocSg==}
     engines: {node: '>= 8'}
 
-  '@pkgjs/parseargs@0.11.0':
-    resolution: {integrity: sha512-+1VkjdD0QBLPodGrJUeqarH8VAIvQODIbwh9XpP5Syisf7YoQgsJKPNFoqqLQlu+VQ/tVSshMR6loPMn8U+dPg==}
-    engines: {node: '>=14'}
-
   '@pkgr/core@0.2.9':
     resolution: {integrity: sha512-QNqXyfVS2wm9hweSYD2O7F0G06uurj9kZ96TRQE5Y9hU7+tgdZwIkbAKc5Ocy1HxEY2kuDQa6cQ1WRs/O5LFKA==}
     engines: {node: ^12.20.0 || ^14.18.0 || >=16.0.0}
 
-  '@posthog/core@1.5.2':
-    resolution: {integrity: sha512-iedUP3EnOPPxTA2VaIrsrd29lSZnUV+ZrMnvY56timRVeZAXoYCkmjfIs3KBAsF8OUT5h1GXLSkoQdrV0r31OQ==}
+  '@posthog/core@1.5.5':
+    resolution: {integrity: sha512-m7G1EQTgo9xrr3lZxCp9C2egP99MSRpIDD95wYzwUPxMesKxI0xEQ+TC5LS/XOXIdmsNvsx4UcxwmzhSwD2GWA==}
 
   '@puppeteer/browsers@2.10.13':
     resolution: {integrity: sha512-a9Ruw3j3qlnB5a/zHRTkruppynxqaeE4H9WNj5eYGRWqw0ZauZ23f4W2ARf3hghF5doozyD+CRtt7XSYuYRI/Q==}
@@ -766,178 +763,178 @@ packages:
       rollup:
         optional: true
 
-  '@rollup/rollup-android-arm-eabi@4.53.2':
-    resolution: {integrity: sha512-yDPzwsgiFO26RJA4nZo8I+xqzh7sJTZIWQOxn+/XOdPE31lAvLIYCKqjV+lNH/vxE2L2iH3plKxDCRK6i+CwhA==}
+  '@rollup/rollup-android-arm-eabi@4.53.3':
+    resolution: {integrity: sha512-mRSi+4cBjrRLoaal2PnqH82Wqyb+d3HsPUN/W+WslCXsZsyHa9ZeQQX/pQsZaVIWDkPcpV6jJ+3KLbTbgnwv8w==}
     cpu: [arm]
     os: [android]
 
-  '@rollup/rollup-android-arm64@4.53.2':
-    resolution: {integrity: sha512-k8FontTxIE7b0/OGKeSN5B6j25EuppBcWM33Z19JoVT7UTXFSo3D9CdU39wGTeb29NO3XxpMNauh09B+Ibw+9g==}
+  '@rollup/rollup-android-arm64@4.53.3':
+    resolution: {integrity: sha512-CbDGaMpdE9sh7sCmTrTUyllhrg65t6SwhjlMJsLr+J8YjFuPmCEjbBSx4Z/e4SmDyH3aB5hGaJUP2ltV/vcs4w==}
     cpu: [arm64]
     os: [android]
 
-  '@rollup/rollup-darwin-arm64@4
```

---

### Incident Patch 5: `c8b3fd7a` (2025-11-20)
**Commit Message**: Merge pull request #277 from nanobrowser/bugfix

upgrade default Gemini and Grok models

**File**: `packages/storage/lib/settings/types.ts` (modified, +2/-2)
```diff
@@ -36,8 +36,8 @@ export const llmProviderModelNames = {
   ],
   [ProviderTypeEnum.Anthropic]: ['claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4-1'],
   [ProviderTypeEnum.DeepSeek]: ['deepseek-chat', 'deepseek-reasoner'],
-  [ProviderTypeEnum.Gemini]: ['gemini-2.5-flash', 'gemini-2.5-pro'],
-  [ProviderTypeEnum.Grok]: ['grok-3', 'grok-3-fast', 'grok-3-mini', 'grok-3-mini-fast'],
+  [ProviderTypeEnum.Gemini]: ['gemini-3-pro-preview', 'gemini-2.5-flash', 'gemini-2.5-pro'],
+  [ProviderTypeEnum.Grok]: ['grok-4', 'grok-4-fast-non-reasoning', 'grok-3', 'grok-3-fast'],
   [ProviderTypeEnum.Ollama]: ['qwen3:14b', 'falcon3:10b', 'qwen2.5-coder:14b', 'mistral-small:24b'],
   [ProviderTypeEnum.AzureOpenAI]: ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o'],
   [ProviderTypeEnum.OpenRouter]: ['google/gemini-2.5-pro', 'google/gemini-2.5-flash', 'openai/gpt-4o-2024-11-20'],
```

---

### Incident Patch 6: `c694577d` (2025-11-18)
**Commit Message**: Merge pull request #276 from nanobrowser/bugfix

Bugfix

**File**: `chrome-extension/package.json` (modified, +3/-3)
```diff
@@ -19,14 +19,14 @@
     "@extension/i18n": "workspace:*",
     "@extension/shared": "workspace:*",
     "@extension/storage": "workspace:*",
-    "@langchain/anthropic": "0.3.30",
+    "@langchain/anthropic": "0.3.33",
     "@langchain/cerebras": "0.0.4",
-    "@langchain/core": "0.3.78",
+    "@langchain/core": "0.3.79",
     "@langchain/deepseek": "0.1.0",
     "@langchain/google-genai": "0.2.18",
     "@langchain/groq": "0.2.4",
     "@langchain/ollama": "0.2.4",
-    "@langchain/openai": "0.6.14",
+    "@langchain/openai": "0.6.16",
     "@langchain/xai": "^0.1.0",
     "jsonrepair": "3.13.1",
     "posthog-js": "^1.271.0",
```

**File**: `chrome-extension/src/background/agent/agents/base.ts` (modified, +32/-42)
```diff
@@ -115,16 +115,6 @@ export abstract class BaseAgent<T extends z.ZodType, M = unknown> {
       return false;
     }
 
-    // Google Gemini models return markdown-wrapped JSON even with structured output
-    // This applies to both native Google AI SDK and OpenAI-compatible endpoints
-    // Check model name for 'gemini' to catch all variants (gemini-2.5-pro, gemini-1.5-pro, etc.)
-    if (this.chatModelLibrary === 'ChatGoogleGenerativeAI' || this.modelName.toLowerCase().includes('gemini')) {
-      logger.debug(
-        `[${this.modelName}] Google Gemini models return markdown-wrapped JSON, using manual JSON extraction`,
-      );
-      return false;
-    }
-
     return true;
   }
 
@@ -142,9 +132,10 @@ export abstract class BaseAgent<T extends z.ZodType, M = unknown> {
         name: this.modelOutputToolName,
       });
 
+      let response = undefined;
       try {
         logger.debug(`[${this.modelName}] Invoking LLM with structured output...`);
-        const response = await structuredLlm.invoke(inputMessages, {
+        response = await structuredLlm.invoke(inputMessages, {
           signal: this.context.controller.signal,
           ...this.callOptions,
         });
@@ -159,32 +150,27 @@ export abstract class BaseAgent<T extends z.ZodType, M = unknown> {
           logger.debug(`[${this.modelName}] Successfully parsed structured output`);
           return response.parsed;
         }
-
-        // Fallback: Try to extract JSON from raw response (handles markdown-wrapped JSON)
-        if (response.raw && typeof response.raw.content === 'string') {
-          logger.warning(`[${this.modelName}] Structured output parsing failed, attempting manual JSON extraction`);
-          try {
-            const cleanedContent = removeThinkTags(response.raw.content);
-            const extractedJson = extractJsonFromModelOutput(cleanedContent);
-            const parsed = this.validateModelOutput(extractedJson);
-            if (parsed) {
-              logger.debug(`[${this.modelName}] Successfully extracted JSON from raw response`);
-              return parsed;
-            }
-          } catch (extractError) {
-            logger.error(`[${this.modelName}] Manual JSON extraction also failed:`, extractError);
-          }
-        }
-
         logger.error('Failed to parse response', response);
         throw new Error('Could not parse response with structured output');
       } catch (error) {
         if (isAbortedError(error)) {
           throw error;
         }
-        logger.error(`[${this.modelName}] LLM call failed with error:`, error);
-        const errorMessage = `Failed to invoke ${this.modelName} with structured output: \n${error instanceof Error ? error.message : String(error)}`;
-        throw new Error(errorMessage);
+
+        // Try to extract JSON from raw response manually if possible
+        const errorMessage = error instanceof Error ? error.message : String(error);
+        if (
+          errorMessage.includes('is not valid JSON') &&
+          response?.raw?.content &&
+          typeof response.raw.content === 'string'
+        ) {
+          const parsed = this.manuallyParseResponse(response.raw.content);
+          if (parsed) {
+            return parsed;
+          }
+        }
+        logger.error(`[${this.modelName}] LLM call failed with error: \n${errorMessage}`);
+        throw new Error(`Failed to invoke ${this.modelName} with structured output: \n${errorMessage}`);
       }
     }
 
@@ -199,17 +185,9 @@ export abstract class BaseAgent<T extends z.ZodType, M = unknown> {
       });
 
       if (typeof response.content === 'string') {
-        response.content = removeThinkTags(response.content);
-        try {
-          const extractedJson = extractJsonFromModelOutput(response.content);
-          const parsed = this.validateModelOutput(extractedJson);
-          if (parsed) {
-            return parsed;
-          }
-        } catch (error) {
-          logger.error(`[${this.modelName}] Failed to extract JSON from response:`, error);
-          const errorMessage = `Failed to extract JSON from response: ${error}`;
-          throw new Error(errorMessage);
+        const parsed = this.manuallyParseResponse(response.content);
+        if (parsed) {
+          return parsed;
         }
       }
     } catch (error) {
@@ -234,4 +212,16 @@ export abstract class BaseAgent<T extends z.ZodType, M = unknown> {
       throw new ResponseParseError('Could not validate model output');
     }
   }
+
+  // Helper method to manually parse the response content
+  protected manuallyParseResponse(content: string): this['ModelOutput'] | undefined {
+    const cleanedContent = removeThinkTags(content);
+    try {
+      const extractedJson = extractJsonFromModelOutput(cleanedContent);
+      return this.validateModelOutput(extractedJson);
+    } catch (error) {
+      logger.warning('manuallyParseResponse failed', error);
+      return undefined;
+    }
+  }
 }
```

**File**: `chrome-extension/src/background/agent/agents/navigator.ts` (modified, +8/-15)
```diff
@@ -115,23 +115,16 @@ export class NavigatorAgent extends BaseAgent<z.ZodType, NavigatorResult> {
 
         // Try to extract JSON from markdown code blocks if parsing failed
         const errorMessage = error instanceof Error ? error.message : String(error);
-        if (errorMessage.includes('is not valid JSON') && response?.raw?.content) {
-          try {
-            const content =
-              typeof response.raw.content === 'string' ? response.raw.content : JSON.stringify(response.raw.content);
-            // Remove markdown code blocks
-            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
-            if (jsonMatch) {
-              const extractedJson = JSON.parse(jsonMatch[1].trim());
-              const validated = this.modelOutputSchema.parse(extractedJson);
-              logger.info('Successfully extracted JSON from markdown code block');
-              return validated;
-            }
-          } catch (extractError) {
-            logger.error('Failed to extract JSON from markdown:', extractError);
+        if (
+          errorMessage.includes('is not valid JSON') &&
+          response?.raw?.content &&
+          typeof response.raw.content === 'string'
+        ) {
+          const parsed = this.manuallyParseResponse(response.raw.content);
+          if (parsed) {
+            return parsed;
           }
         }
-
         throw new Error(`Failed to invoke ${this.modelName} with structured output: \n${errorMessage}`);
       }
 
```

**File**: `chrome-extension/src/background/agent/helper.ts` (modified, +27/-21)
```diff
@@ -8,8 +8,6 @@ import { ChatCerebras } from '@langchain/cerebras';
 import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
 import { ChatOllama } from '@langchain/ollama';
 import { ChatDeepSeek } from '@langchain/deepseek';
-import { AIMessage } from '@langchain/core/messages';
-import type { BaseMessage } from '@langchain/core/messages';
 
 const maxTokens = 1024 * 4;
 
@@ -83,6 +81,17 @@ function isAnthropicOpusModel(modelName: string): boolean {
   return modelNameWithoutProvider.startsWith('claude-opus');
 }
 
+// check if a model is sonnet-4-5 or haiku-4-5
+function isAnthropic4_5Model(modelName: string): boolean {
+  let modelNameWithoutProvider = modelName;
+  if (modelName.startsWith('anthropic/')) {
+    modelNameWithoutProvider = modelName.substring(10);
+  }
+  return (
+    modelNameWithoutProvider.startsWith('claude-sonnet-4-5') || modelNameWithoutProvider.startsWith('claude-haiku-4-5')
+  );
+}
+
 function createOpenAIChatModel(
   providerConfig: ProviderConfig,
   modelConfig: ModelConfig,
@@ -96,7 +105,7 @@ function createOpenAIChatModel(
     configuration?: Record<string, unknown>;
     modelKwargs?: {
       max_completion_tokens: number;
-      reasoning_effort?: 'minimal' | 'low' | 'medium' | 'high';
+      reasoning_effort?: 'none' | 'minimal' | 'low' | 'medium' | 'high';
     };
     topP?: number;
     temperature?: number;
@@ -128,7 +137,12 @@ function createOpenAIChatModel(
 
     // Add reasoning_effort parameter for o-series models if specified
     if (modelConfig.reasoningEffort) {
-      args.modelKwargs.reasoning_effort = modelConfig.reasoningEffort;
+      // if it's gpt-5.1, we need to convert minimal to none, it doesn't support minimal
+      if (modelConfig.modelName.includes('gpt-5.1') && modelConfig.reasoningEffort === 'minimal') {
+        args.modelKwargs.reasoning_effort = 'none';
+      } else {
+        args.modelKwargs.reasoning_effort = modelConfig.reasoningEffort;
+      }
     }
   } else {
     args.topP = (modelConfig.parameters?.topP ?? 0.1) as number;
@@ -246,23 +260,15 @@ export function createChatModel(providerConfig: ProviderConfig, modelConfig: Mod
       return createOpenAIChatModel(providerConfig, modelConfig, undefined);
     }
     case ProviderTypeEnum.Anthropic: {
-      // For Opus models, only include temperature, not topP
-      const args = isAnthropicOpusModel(modelConfig.modelName)
-        ? {
-            model: modelConfig.modelName,
-            apiKey: providerConfig.apiKey,
-            maxTokens,
-            temperature,
-            clientOptions: {},
-          }
-        : {
-            model: modelConfig.modelName,
-            apiKey: providerConfig.apiKey,
-            maxTokens,
-            temperature,
-            topP,
-            clientOptions: {},
-          };
+      // For Opus models, only support temperature, not topP
+      // For 4.5 models, only support either temperature or topP, not both, so we only use temperature to align with Opus
+      const args = {
+        model: modelConfig.modelName,
+        apiKey: providerConfig.apiKey,
+        maxTokens,
+        temperature,
+        clientOptions: {},
+      };
       return new ChatAnthropic(args);
     }
     case ProviderTypeEnum.DeepSeek: {
```

**File**: `chrome-extension/src/background/agent/messages/utils.ts` (modified, +2/-2)
```diff
@@ -1,6 +1,7 @@
 import { type BaseMessage, AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
 
 import { guardrails } from '@src/background/services/guardrails';
+import { ResponseParseError } from '../agents/errors';
 
 /**
  * Tag for untrusted content
@@ -129,8 +130,7 @@ export function extractJsonFromModelOutput(content: string): Record<string, unkn
     // Parse the cleaned content
     return JSON.parse(processedContent);
   } catch (e) {
-    console.warn(`Failed to parse model output: ${content} ${e instanceof Error ? e.message : String(e)}`);
-    throw new Error('Could not parse response.');
+    throw new ResponseParseError(`Could not manually extract JSON from model output`);
   }
 }
 
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@
     "tslib": "^2.6.3",
     "typescript": "5.5.4",
     "turbo": "^2.5.3",
-    "vite": "6.3.6",
+    "vite": "^6.4.1",
     "run-script-os": "^1.1.6"
   },
   "lint-staged": {
```

**File**: `packages/storage/lib/settings/types.ts` (modified, +10/-6)
```diff
@@ -24,13 +24,17 @@ export enum ProviderTypeEnum {
 
 // Default supported models for each built-in provider
 export const llmProviderModelNames = {
-  [ProviderTypeEnum.OpenAI]: ['gpt-5', 'gpt-5-mini', 'gpt-5-chat-latest', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o'],
-  [ProviderTypeEnum.Anthropic]: [
-    'claude-opus-4-1',
-    'claude-sonnet-4-0',
-    'claude-3-7-sonnet-latest',
-    'claude-3-5-haiku-latest',
+  [ProviderTypeEnum.OpenAI]: [
+    'gpt-5.1',
+    'gpt-5',
+    'gpt-5-pro',
+    'gpt-5-mini',
+    'gpt-5-chat-latest',
+    'gpt-4.1',
+    'gpt-4.1-mini',
+    'gpt-4o',
   ],
+  [ProviderTypeEnum.Anthropic]: ['claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4-1'],
   [ProviderTypeEnum.DeepSeek]: ['deepseek-chat', 'deepseek-reasoner'],
   [ProviderTypeEnum.Gemini]: ['gemini-2.5-flash', 'gemini-2.5-pro'],
   [ProviderTypeEnum.Grok]: ['grok-3', 'grok-3-fast', 'grok-3-mini', 'grok-3-mini-fast'],
```

**File**: `pages/options/src/components/ModelSettings.tsx` (modified, +7/-7)
```diff
@@ -40,7 +40,7 @@ function isOpenAIReasoningModel(modelName: string): boolean {
   );
 }
 
-function isAnthropicOpusModel(modelName: string): boolean {
+function isAnthropicModel(modelName: string): boolean {
   // Extract the model name without provider prefix if present
   let modelNameWithoutProvider = modelName;
 
@@ -49,8 +49,8 @@ function isAnthropicOpusModel(modelName: string): boolean {
     modelNameWithoutProvider = modelName.split('>')[1];
   }
 
-  // Check if the model starts with 'claude-opus'
-  return modelNameWithoutProvider.startsWith('claude-opus');
+  // Check if the model starts with 'claude-'
+  return modelNameWithoutProvider.startsWith('claude-');
 }
 
 interface ModelSettingsProps {
@@ -603,7 +603,7 @@ export const ModelSettings = ({ isDarkMode = false }: ModelSettingsProps) => {
         }
 
         // For Anthropic Opus models, only pass temperature, not topP
-        const parametersToSave = isAnthropicOpusModel(modelValue)
+        const parametersToSave = isAnthropicModel(modelValue)
           ? { temperature: newParameters.temperature }
           : newParameters;
 
@@ -672,7 +672,7 @@ export const ModelSettings = ({ isDarkMode = false }: ModelSettingsProps) => {
 
         if (provider && modelName) {
           // For Anthropic Opus models, only pass temperature, not topP
-          const parametersToSave = isAnthropicOpusModel(selectedModels[agentName])
+          const parametersToSave = isAnthropicModel(selectedModels[agentName])
             ? { temperature: newParameters.temperature }
             : newParameters;
 
@@ -794,7 +794,7 @@ export const ModelSettings = ({ isDarkMode = false }: ModelSettingsProps) => {
         {/* Top P Slider - Only show for non-reasoning models */}
         {selectedModels[agentName] &&
           !isOpenAIReasoningModel(selectedModels[agentName]) &&
-          !isAnthropicOpusModel(selectedModels[agentName]) && (
+          !isAnthropicModel(selectedModels[agentName]) && (
             <div className="flex items-center">
               <label
                 htmlFor={`${agentName}-topP`}
@@ -855,7 +855,7 @@ export const ModelSettings = ({ isDarkMode = false }: ModelSettingsProps) => {
                   handleReasoningEffortChange(agentName, e.target.value as 'minimal' | 'low' | 'medium' | 'high')
                 }
                 className={`flex-1 rounded-md border text-sm ${isDarkMode ? 'border-slate-600 bg-slate-700 text-gray-200' : 'border-gray-300 bg-white text-gray-700'} px-3 py-2`}>
-                <option value="minimal">Minimal</option>
+                <option value="minimal/none">Minimal</option>
                 <option value="low">Low</option>
                 <option value="medium">Medium</option>
                 <option value="high">High</option>
```

---

### Incident Patch 7: `74b74f46` (2025-11-15)
**Commit Message**: fix manully parsing json from model output

**File**: `chrome-extension/src/background/agent/agents/base.ts` (modified, +32/-42)
```diff
@@ -115,16 +115,6 @@ export abstract class BaseAgent<T extends z.ZodType, M = unknown> {
       return false;
     }
 
-    // Google Gemini models return markdown-wrapped JSON even with structured output
-    // This applies to both native Google AI SDK and OpenAI-compatible endpoints
-    // Check model name for 'gemini' to catch all variants (gemini-2.5-pro, gemini-1.5-pro, etc.)
-    if (this.chatModelLibrary === 'ChatGoogleGenerativeAI' || this.modelName.toLowerCase().includes('gemini')) {
-      logger.debug(
-        `[${this.modelName}] Google Gemini models return markdown-wrapped JSON, using manual JSON extraction`,
-      );
-      return false;
-    }
-
     return true;
   }
 
@@ -142,9 +132,10 @@ export abstract class BaseAgent<T extends z.ZodType, M = unknown> {
         name: this.modelOutputToolName,
       });
 
+      let response = undefined;
       try {
         logger.debug(`[${this.modelName}] Invoking LLM with structured output...`);
-        const response = await structuredLlm.invoke(inputMessages, {
+        response = await structuredLlm.invoke(inputMessages, {
           signal: this.context.controller.signal,
           ...this.callOptions,
         });
@@ -159,32 +150,27 @@ export abstract class BaseAgent<T extends z.ZodType, M = unknown> {
           logger.debug(`[${this.modelName}] Successfully parsed structured output`);
           return response.parsed;
         }
-
-        // Fallback: Try to extract JSON from raw response (handles markdown-wrapped JSON)
-        if (response.raw && typeof response.raw.content === 'string') {
-          logger.warning(`[${this.modelName}] Structured output parsing failed, attempting manual JSON extraction`);
-          try {
-            const cleanedContent = removeThinkTags(response.raw.content);
-            const extractedJson = extractJsonFromModelOutput(cleanedContent);
-            const parsed = this.validateModelOutput(extractedJson);
-            if (parsed) {
-              logger.debug(`[${this.modelName}] Successfully extracted JSON from raw response`);
-              return parsed;
-            }
-          } catch (extractError) {
-            logger.error(`[${this.modelName}] Manual JSON extraction also failed:`, extractError);
-          }
-        }
-
         logger.error('Failed to parse response', response);
         throw new Error('Could not parse response with structured output');
       } catch (error) {
         if (isAbortedError(error)) {
           throw error;
         }
-        logger.error(`[${this.modelName}] LLM call failed with error:`, error);
-        const errorMessage = `Failed to invoke ${this.modelName} with structured output: \n${error instanceof Error ? error.message : String(error)}`;
-        throw new Error(errorMessage);
+
+        // Try to extract JSON from raw response manually if possible
+        const errorMessage = error instanceof Error ? error.message : String(error);
+        if (
+          errorMessage.includes('is not valid JSON') &&
+          response?.raw?.content &&
+          typeof response.raw.content === 'string'
+        ) {
+          const parsed = this.manuallyParseResponse(response.raw.content);
+          if (parsed) {
+            return parsed;
+          }
+        }
+        logger.error(`[${this.modelName}] LLM call failed with error: \n${errorMessage}`);
+        throw new Error(`Failed to invoke ${this.modelName} with structured output: \n${errorMessage}`);
       }
     }
 
@@ -199,17 +185,9 @@ export abstract class BaseAgent<T extends z.ZodType, M = unknown> {
       });
 
       if (typeof response.content === 'string') {
-        response.content = removeThinkTags(response.content);
-        try {
-          const extractedJson = extractJsonFromModelOutput(response.content);
-          const parsed = this.validateModelOutput(extractedJson);
-          if (parsed) {
-            return parsed;
-          }
-        } catch (error) {
-          logger.error(`[${this.modelName}] Failed to extract JSON from response:`, error);
-          const errorMessage = `Failed to extract JSON from response: ${error}`;
-          throw new Error(errorMessage);
+        const parsed = this.manuallyParseResponse(response.content);
+        if (parsed) {
+          return parsed;
         }
       }
     } catch (error) {
@@ -234,4 +212,16 @@ export abstract class BaseAgent<T extends z.ZodType, M = unknown> {
       throw new ResponseParseError('Could not validate model output');
     }
   }
+
+  // Helper method to manually parse the response content
+  protected manuallyParseResponse(content: string): this['ModelOutput'] | undefined {
+    const cleanedContent = removeThinkTags(content);
+    try {
+      const extractedJson = extractJsonFromModelOutput(cleanedContent);
+      return this.validateModelOutput(extractedJson);
+    } catch (error) {
+      logger.warning('manuallyParseResponse failed', error);
+      return undefined;
+    }
+  }
 }
```

**File**: `chrome-extension/src/background/agent/agents/navigator.ts` (modified, +8/-15)
```diff
@@ -115,23 +115,16 @@ export class NavigatorAgent extends BaseAgent<z.ZodType, NavigatorResult> {
 
         // Try to extract JSON from markdown code blocks if parsing failed
         const errorMessage = error instanceof Error ? error.message : String(error);
-        if (errorMessage.includes('is not valid JSON') && response?.raw?.content) {
-          try {
-            const content =
-              typeof response.raw.content === 'string' ? response.raw.content : JSON.stringify(response.raw.content);
-            // Remove markdown code blocks
-            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
-            if (jsonMatch) {
-              const extractedJson = JSON.parse(jsonMatch[1].trim());
-              const validated = this.modelOutputSchema.parse(extractedJson);
-              logger.info('Successfully extracted JSON from markdown code block');
-              return validated;
-            }
-          } catch (extractError) {
-            logger.error('Failed to extract JSON from markdown:', extractError);
+        if (
+          errorMessage.includes('is not valid JSON') &&
+          response?.raw?.content &&
+          typeof response.raw.content === 'string'
+        ) {
+          const parsed = this.manuallyParseResponse(response.raw.content);
+          if (parsed) {
+            return parsed;
           }
         }
-
         throw new Error(`Failed to invoke ${this.modelName} with structured output: \n${errorMessage}`);
       }
 
```

**File**: `chrome-extension/src/background/agent/messages/utils.ts` (modified, +2/-2)
```diff
@@ -1,6 +1,7 @@
 import { type BaseMessage, AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
 
 import { guardrails } from '@src/background/services/guardrails';
+import { ResponseParseError } from '../agents/errors';
 
 /**
  * Tag for untrusted content
@@ -129,8 +130,7 @@ export function extractJsonFromModelOutput(content: string): Record<string, unkn
     // Parse the cleaned content
     return JSON.parse(processedContent);
   } catch (e) {
-    console.warn(`Failed to parse model output: ${content} ${e instanceof Error ? e.message : String(e)}`);
-    throw new Error('Could not parse response.');
+    throw new ResponseParseError(`Could not manually extract JSON from model output`);
   }
 }
 
```

---

### Incident Patch 8: `69d97d6f` (2025-11-09)
**Commit Message**: Merge pull request #264 from benzntech/fix/gemini-structured-output-json-parsing

fix: Handle Gemini markdown-wrapped JSON in structured output

**File**: `chrome-extension/src/background/agent/agents/navigator.ts` (modified, +20/-2)
```diff
@@ -112,8 +112,26 @@ export class NavigatorAgent extends BaseAgent<z.ZodType, NavigatorResult> {
         if (isAbortedError(error)) {
           throw error;
         }
-        const errorMessage = `Failed to invoke ${this.modelName} with structured output: \n${error instanceof Error ? error.message : String(error)}`;
-        throw new Error(errorMessage);
+        
+        // Try to extract JSON from markdown code blocks if parsing failed
+        const errorMessage = error instanceof Error ? error.message : String(error);
+        if (errorMessage.includes('is not valid JSON') && response?.raw?.content) {
+          try {
+            const content = typeof response.raw.content === 'string' ? response.raw.content : JSON.stringify(response.raw.content);
+            // Remove markdown code blocks
+            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
+            if (jsonMatch) {
+              const extractedJson = JSON.parse(jsonMatch[1].trim());
+              const validated = this.modelOutputSchema.parse(extractedJson);
+              logger.info('Successfully extracted JSON from markdown code block');
+              return validated;
+            }
+          } catch (extractError) {
+            logger.error('Failed to extract JSON from markdown:', extractError);
+          }
+        }
+        
+        throw new Error(`Failed to invoke ${this.modelName} with structured output: \n${errorMessage}`);
       }
 
       // Use type assertion to access the properties
```

---

### Incident Patch 9: `08940657` (2025-11-01)
**Commit Message**: fix: Handle Gemini models via OpenAI-compatible API endpoints

Fixes JSON parsing errors and schema validation issues when using Gemini
models through OpenAI-compatible API endpoints.

Changes:
- Detect Gemini models by name pattern (gemini-*) in base.ts to skip
  structured output and use manual JSON extraction
- Add fallback markdown extraction in navigator.ts catch block for
  edge cases where Gemini returns ```json wrapped responses
- Make cache_content.content field optional with default value to
  handle incomplete Gemini responses

This prevents double API calls (2x faster) and fixes parsing errors
for users accessing Gemini via OpenAI-compatible endpoints.

**File**: `chrome-extension/src/background/agent/actions/schemas.ts` (modified, +1/-1)
```diff
@@ -108,7 +108,7 @@ export const cacheContentActionSchema: ActionSchema = {
   description: 'Cache what you have found so far from the current page for future use',
   schema: z.object({
     intent: z.string().default('').describe('purpose of this action'),
-    content: z.string().describe('content to cache'),
+    content: z.string().default('').describe('content to cache'),
   }),
 };
 
```

**File**: `chrome-extension/src/background/agent/agents/base.ts` (modified, +28/-1)
```diff
@@ -115,6 +115,16 @@ export abstract class BaseAgent<T extends z.ZodType, M = unknown> {
       return false;
     }
 
+    // Google Gemini models return markdown-wrapped JSON even with structured output
+    // This applies to both native Google AI SDK and OpenAI-compatible endpoints
+    // Check model name for 'gemini' to catch all variants (gemini-2.5-pro, gemini-1.5-pro, etc.)
+    if (this.chatModelLibrary === 'ChatGoogleGenerativeAI' || this.modelName.toLowerCase().includes('gemini')) {
+      logger.debug(
+        `[${this.modelName}] Google Gemini models return markdown-wrapped JSON, using manual JSON extraction`,
+      );
+      return false;
+    }
+
     return true;
   }
 
@@ -149,6 +159,23 @@ export abstract class BaseAgent<T extends z.ZodType, M = unknown> {
           logger.debug(`[${this.modelName}] Successfully parsed structured output`);
           return response.parsed;
         }
+
+        // Fallback: Try to extract JSON from raw response (handles markdown-wrapped JSON)
+        if (response.raw && typeof response.raw.content === 'string') {
+          logger.warning(`[${this.modelName}] Structured output parsing failed, attempting manual JSON extraction`);
+          try {
+            const cleanedContent = removeThinkTags(response.raw.content);
+            const extractedJson = extractJsonFromModelOutput(cleanedContent);
+            const parsed = this.validateModelOutput(extractedJson);
+            if (parsed) {
+              logger.debug(`[${this.modelName}] Successfully extracted JSON from raw response`);
+              return parsed;
+            }
+          } catch (extractError) {
+            logger.error(`[${this.modelName}] Manual JSON extraction also failed:`, extractError);
+          }
+        }
+
         logger.error('Failed to parse response', response);
         throw new Error('Could not parse response with structured output');
       } catch (error) {
@@ -161,7 +188,7 @@ export abstract class BaseAgent<T extends z.ZodType, M = unknown> {
       }
     }
 
-    // Without structured output support, need to extract JSON from model output manually
+    // Fallback: Without structured output support, need to extract JSON from model output manually
     logger.debug(`[${this.modelName}] Using manual JSON extraction fallback method`);
     const convertedInputMessages = convertInputMessages(inputMessages, this.modelName);
 
```

**File**: `chrome-extension/src/background/agent/agents/navigator.ts` (modified, +21/-2)
```diff
@@ -112,8 +112,27 @@ export class NavigatorAgent extends BaseAgent<z.ZodType, NavigatorResult> {
         if (isAbortedError(error)) {
           throw error;
         }
-        const errorMessage = `Failed to invoke ${this.modelName} with structured output: \n${error instanceof Error ? error.message : String(error)}`;
-        throw new Error(errorMessage);
+
+        // Try to extract JSON from markdown code blocks if parsing failed
+        const errorMessage = error instanceof Error ? error.message : String(error);
+        if (errorMessage.includes('is not valid JSON') && response?.raw?.content) {
+          try {
+            const content =
+              typeof response.raw.content === 'string' ? response.raw.content : JSON.stringify(response.raw.content);
+            // Remove markdown code blocks
+            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
+            if (jsonMatch) {
+              const extractedJson = JSON.parse(jsonMatch[1].trim());
+              const validated = this.modelOutputSchema.parse(extractedJson);
+              logger.info('Successfully extracted JSON from markdown code block');
+              return validated;
+            }
+          } catch (extractError) {
+            logger.error('Failed to extract JSON from markdown:', extractError);
+          }
+        }
+
+        throw new Error(`Failed to invoke ${this.modelName} with structured output: \n${errorMessage}`);
       }
 
       // Use type assertion to access the properties
```

---

### Incident Patch 10: `499e9ddf` (2025-10-25)
**Commit Message**: Fix typo— "not exists"

**File**: `chrome-extension/src/background/agent/agents/navigator.ts` (modified, +1/-1)
```diff
@@ -373,7 +373,7 @@ export class NavigatorAgent extends BaseAgent<z.ZodType, NavigatorResult> {
 
         const actionInstance = this.actionRegistry.getAction(actionName);
         if (actionInstance === undefined) {
-          throw new Error(`Action ${actionName} not exists`);
+          throw new Error(`Action ${actionName} does not exist`);
         }
 
         const indexArg = actionInstance.getIndexArg(actionArgs);
```

---

### Incident Patch 11: `beb0146b` (2025-10-24)
**Commit Message**: fix: Handle Gemini markdown-wrapped JSON in structured output

Gemini sometimes returns structured output wrapped in markdown code blocks causing JSON parsing errors. This fix extracts JSON from markdown blocks and validates with schema.

**File**: `chrome-extension/src/background/agent/agents/navigator.ts` (modified, +20/-2)
```diff
@@ -112,8 +112,26 @@ export class NavigatorAgent extends BaseAgent<z.ZodType, NavigatorResult> {
         if (isAbortedError(error)) {
           throw error;
         }
-        const errorMessage = `Failed to invoke ${this.modelName} with structured output: \n${error instanceof Error ? error.message : String(error)}`;
-        throw new Error(errorMessage);
+        
+        // Try to extract JSON from markdown code blocks if parsing failed
+        const errorMessage = error instanceof Error ? error.message : String(error);
+        if (errorMessage.includes('is not valid JSON') && response?.raw?.content) {
+          try {
+            const content = typeof response.raw.content === 'string' ? response.raw.content : JSON.stringify(response.raw.content);
+            // Remove markdown code blocks
+            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
+            if (jsonMatch) {
+              const extractedJson = JSON.parse(jsonMatch[1].trim());
+              const validated = this.modelOutputSchema.parse(extractedJson);
+              logger.info('Successfully extracted JSON from markdown code block');
+              return validated;
+            }
+          } catch (extractError) {
+            logger.error('Failed to extract JSON from markdown:', extractError);
+          }
+        }
+        
+        throw new Error(`Failed to invoke ${this.modelName} with structured output: \n${errorMessage}`);
       }
 
       // Use type assertion to access the properties
```

---

### Incident Patch 12: `5c2dd009` (2025-10-06)
**Commit Message**: Merge pull request #255 from nanobrowser/bugfix

update dependencies and providers

**File**: `chrome-extension/package.json` (modified, +12/-12)
```diff
@@ -19,24 +19,24 @@
     "@extension/i18n": "workspace:*",
     "@extension/shared": "workspace:*",
     "@extension/storage": "workspace:*",
-    "@langchain/anthropic": "^0.3.26",
-    "@langchain/cerebras": "^0.0.3",
-    "@langchain/core": "^0.3.72",
-    "@langchain/deepseek": "^0.1.0",
-    "@langchain/google-genai": "^0.2.16",
-    "@langchain/groq": "^0.2.3",
-    "@langchain/ollama": "^0.2.3",
-    "@langchain/openai": "^0.6.9",
+    "@langchain/anthropic": "0.3.30",
+    "@langchain/cerebras": "0.0.4",
+    "@langchain/core": "0.3.78",
+    "@langchain/deepseek": "0.1.0",
+    "@langchain/google-genai": "0.2.18",
+    "@langchain/groq": "0.2.4",
+    "@langchain/ollama": "0.2.4",
+    "@langchain/openai": "0.6.14",
     "@langchain/xai": "^0.1.0",
-    "jsonrepair": "^3.13.0",
-    "posthog-js": "^1.260.3",
+    "jsonrepair": "3.13.1",
+    "posthog-js": "^1.271.0",
     "puppeteer-core": "^24.10.1",
     "webextension-polyfill": "^0.12.0",
     "zod": "^3.25.76",
     "zod-to-json-schema": "^3.24.6"
   },
   "overrides": {
-    "@langchain/core": "^0.3.72",
+    "@langchain/core": "^0.3.78",
     "form-data": "^4.0.4"
   },
   "devDependencies": {
@@ -50,6 +50,6 @@
     "deepmerge": "^4.3.1",
     "magic-string": "^0.30.10",
     "ts-loader": "^9.5.1",
-    "vitest": "^2.0.5"
+    "vitest": "2.1.9"
   }
 }
```

**File**: `package.json` (modified, +3/-2)
```diff
@@ -57,7 +57,7 @@
     "tslib": "^2.6.3",
     "typescript": "5.5.4",
     "turbo": "^2.5.3",
-    "vite": "6.3.5",
+    "vite": "6.3.6",
     "run-script-os": "^1.1.6"
   },
   "lint-staged": {
@@ -73,7 +73,8 @@
     "overrides": {
       "cross-spawn": "^7.0.5",
       "esbuild": "^0.25.1",
-      "nanoid": "3.3.11"
+      "nanoid": "3.3.11",
+      "tar-fs": "^3.1.1"
     }
   }
 }
```

**File**: `packages/i18n/locales/en/messages.json` (modified, +1/-1)
```diff
@@ -382,7 +382,7 @@
     "message": "Enter Azure model name (e.g. gpt-4o, gpt-4o-mini)"
   },
   "options_models_providers_placeholders_azureApiVersion": {
-    "message": "e.g., 2024-02-15-preview"
+    "message": "e.g., 2024-04-01-preview"
   },
   "options_models_providers_deployment_desc": {
     "message": "Type model name and press Enter or Space to set. Deployment name should match OpenAI model name (e.g., gpt-4o) for best compatibility."
```

**File**: `packages/i18n/locales/zh_TW/messages.json` (modified, +1/-1)
```diff
@@ -377,7 +377,7 @@
     "message": "請輸入 Azure 模型的部署名稱 (例如 gpt-4o, gpt-4o-mini)"
   },
   "options_models_providers_placeholders_azureApiVersion": {
-    "message": "例如：2024-02-15-preview"
+    "message": "例如：2024-04-01-preview"
   },
   "options_models_providers_deployment_desc": {
     "message": "輸入模型名稱後，按下 Enter 或空格鍵以完成設定。為獲得最佳的相容性，部署名稱建議與 OpenAI 的模型名稱 (例如 gpt-4o) 保持一致。"
```

**File**: `packages/storage/lib/settings/llmProviders.ts` (modified, +4/-2)
```diff
@@ -3,6 +3,8 @@ import { createStorage } from '../base/base';
 import type { BaseStorage } from '../base/types';
 import { type AgentNameEnum, llmProviderModelNames, llmProviderParameters, ProviderTypeEnum } from './types';
 
+const AZURE_API_VERSION = '2025-04-01-preview';
+
 // Interface for a single provider configuration
 export interface ProviderConfig {
   name?: string; // Display name in the options
@@ -145,7 +147,7 @@ export function getDefaultProviderConfig(providerId: string): ProviderConfig {
         baseUrl: '', // User needs to provide Azure endpoint
         // modelNames: [], // Not used for Azure configuration
         azureDeploymentNames: [], // Azure deployment names
-        azureApiVersion: '2024-02-15-preview', // Provide a common default API version
+        azureApiVersion: AZURE_API_VERSION, // Provide a common default API version
         createdAt: Date.now(),
       };
     default: // Handles CustomOpenAI
@@ -189,7 +191,7 @@ function ensureBackwardCompatibility(providerId: string, config: ProviderConfig)
     // Ensure Azure fields exist, provide defaults if missing
     if (updatedConfig.azureApiVersion === undefined) {
       // console.log(`[ensureBackwardCompatibility] Adding default azureApiVersion for ${providerId}`);
-      updatedConfig.azureApiVersion = '2024-02-15-preview';
+      updatedConfig.azureApiVersion = AZURE_API_VERSION;
     }
 
     // Initialize azureDeploymentNames array if it doesn't exist yet
```

**File**: `packages/storage/lib/settings/types.ts` (modified, +1/-6)
```diff
@@ -36,12 +36,7 @@ export const llmProviderModelNames = {
   [ProviderTypeEnum.Grok]: ['grok-3', 'grok-3-fast', 'grok-3-mini', 'grok-3-mini-fast'],
   [ProviderTypeEnum.Ollama]: ['qwen3:14b', 'falcon3:10b', 'qwen2.5-coder:14b', 'mistral-small:24b'],
   [ProviderTypeEnum.AzureOpenAI]: ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o'],
-  [ProviderTypeEnum.OpenRouter]: [
-    'deepseek/deepseek-chat-v3.1',
-    'google/gemini-2.5-pro',
-    'google/gemini-2.5-flash',
-    'openai/gpt-4o-2024-11-20',
-  ],
+  [ProviderTypeEnum.OpenRouter]: ['google/gemini-2.5-pro', 'google/gemini-2.5-flash', 'openai/gpt-4o-2024-11-20'],
   [ProviderTypeEnum.Groq]: ['llama-3.3-70b-versatile'],
   [ProviderTypeEnum.Cerebras]: ['llama-3.3-70b'],
   [ProviderTypeEnum.Llama]: [
```

---

### Incident Patch 13: `a9bef035` (2025-10-06)
**Commit Message**: Merge pull request #254 from nanobrowser/p242 together with some minor fixes

P242

**File**: `chrome-extension/src/background/agent/messages/service.ts` (modified, +34/-8)
```diff
@@ -1,7 +1,12 @@
 import { type BaseMessage, AIMessage, HumanMessage, type SystemMessage, ToolMessage } from '@langchain/core/messages';
 import { MessageHistory, MessageMetadata } from '@src/background/agent/messages/views';
 import { createLogger } from '@src/background/log';
-import { filterExternalContent, wrapUserRequest } from '@src/background/agent/messages/utils';
+import {
+  filterExternalContent,
+  wrapUserRequest,
+  splitUserTextAndAttachments,
+  wrapAttachments,
+} from '@src/background/agent/messages/utils';
 
 const logger = createLogger('MessageManager');
 
@@ -139,10 +144,20 @@ export default class MessageManager {
    * @returns A HumanMessage object containing the task instructions
    */
   private static taskInstructions(task: string): HumanMessage {
-    const cleanedTask = filterExternalContent(task);
+    const { userText, attachmentsInner } = splitUserTextAndAttachments(task);
+
+    // Filter and wrap user text
+    const cleanedTask = filterExternalContent(userText);
     const content = `Your ultimate task is: """${cleanedTask}""". If you achieved your ultimate task, stop everything and use the done action in the next step to complete the task. If not, continue as usual.`;
-    const wrappedContent = wrapUserRequest(content, false);
-    return new HumanMessage({ content: wrappedContent });
+    const wrappedUser = wrapUserRequest(content, false);
+
+    // Filter and wrap attachments as untrusted content
+    if (attachmentsInner && attachmentsInner.length > 0) {
+      const wrappedFiles = wrapAttachments(attachmentsInner);
+      return new HumanMessage({ content: `${wrappedUser}\n\n${wrappedFiles}` });
+    }
+
+    return new HumanMessage({ content: wrappedUser });
   }
 
   /**
@@ -158,10 +173,21 @@ export default class MessageManager {
    * @param newTask - The raw description of the new task
    */
   public addNewTask(newTask: string): void {
-    const cleanedTask = filterExternalContent(newTask);
+    const { userText, attachmentsInner } = splitUserTextAndAttachments(newTask);
+
+    // Filter and wrap user text
+    const cleanedTask = filterExternalContent(userText);
     const content = `Your new ultimate task is: """${cleanedTask}""". This is a follow-up of the previous tasks. Make sure to take all of the previous context into account and finish your new ultimate task.`;
-    const wrappedContent = wrapUserRequest(content, false);
-    const msg = new HumanMessage({ content: wrappedContent });
+    const wrappedUser = wrapUserRequest(content, false);
+
+    // Filter and wrap attachments as untrusted content
+    let finalContent = wrappedUser;
+    if (attachmentsInner && attachmentsInner.length > 0) {
+      const wrappedFiles = wrapAttachments(attachmentsInner);
+      finalContent = `${wrappedUser}\n\n${wrappedFiles}`;
+    }
+
+    const msg = new HumanMessage({ content: finalContent });
     this.addMessageWithTokens(msg);
   }
 
@@ -190,7 +216,7 @@ export default class MessageManager {
    * Adds a model output message to the history
    * @param modelOutput - The model output
    */
-  public addModelOutput(modelOutput: Record<string, any>): void {
+  public addModelOutput(modelOutput: Record<string, unknown>): void {
     const toolCallId = this.nextToolId();
     const toolCalls = [
       {
```

**File**: `chrome-extension/src/background/agent/messages/utils.ts` (modified, +53/-0)
```diff
@@ -14,6 +14,12 @@ export const UNTRUSTED_CONTENT_TAG_END = '</nano_untrusted_content>';
 export const USER_REQUEST_TAG_START = '<nano_user_request>';
 export const USER_REQUEST_TAG_END = '</nano_user_request>';
 
+export const ATTACHED_FILES_TAG_START = '<nano_attached_files>';
+export const ATTACHED_FILES_TAG_END = '</nano_attached_files>';
+
+export const FILE_CONTENT_TAG_START = '<nano_file_content>';
+export const FILE_CONTENT_TAG_END = '</nano_file_content>';
+
 /**
  * Remove think tags from model output
  * Some models use <think> tags for internal reasoning that should be removed
@@ -274,3 +280,50 @@ export function wrapUserRequest(rawContent: string, filterFirst = true): string
   const contentToWrap = filterFirst ? filterExternalContent(rawContent) : rawContent;
   return `${USER_REQUEST_TAG_START}\n${contentToWrap}\n${USER_REQUEST_TAG_END}`;
 }
+
+/**
+ * Split a raw task string into user text and attached files inner content.
+ * Attachments start at the first ATTACHED_FILES_TAG_START and end at the last ATTACHED_FILES_TAG_END
+ * (or the end of the string if no closing tag is found).
+ * User text is only the content before the first start tag. Any text after the end tag is ignored.
+ * If no attached files block is found, returns the whole input as user text.
+ * @param raw - The raw string containing user text and potentially attached files
+ * @returns Object with userText and attachmentsInner (null if no attachments found)
+ */
+export function splitUserTextAndAttachments(raw: string): { userText: string; attachmentsInner: string | null } {
+  const firstStartIdx = raw.indexOf(ATTACHED_FILES_TAG_START);
+  if (firstStartIdx === -1) {
+    return { userText: raw, attachmentsInner: null };
+  }
+
+  // User text is only the content before the first start tag
+  const userText = raw.slice(0, firstStartIdx).trimEnd();
+
+  // Find the last occurrence of the end tag
+  const lastEndIdx = raw.lastIndexOf(ATTACHED_FILES_TAG_END);
+
+  let attachmentsInner: string;
+
+  if (lastEndIdx === -1 || lastEndIdx < firstStartIdx) {
+    // No end tag found or it's before the start tag - take everything after start tag as attachments
+    attachmentsInner = raw.slice(firstStartIdx + ATTACHED_FILES_TAG_START.length).trim();
+  } else {
+    // Normal case: we have both start and end tags (any text after end tag is ignored)
+    attachmentsInner = raw.slice(firstStartIdx + ATTACHED_FILES_TAG_START.length, lastEndIdx).trim();
+  }
+
+  return { userText, attachmentsInner };
+}
+
+/**
+ * Wrap attachments content with filtering and security tags.
+ * Filters the raw attachments, optionally wraps as untrusted content, and embeds in attachment tags.
+ * @param rawAttachmentsInner - The raw inner content of attached files
+ * @param untrust - Whether to wrap as untrusted content (default: true)
+ * @returns Complete wrapped attachments block with tags
+ */
+export function wrapAttachments(rawAttachmentsInner: string, filterFirst = true, trusted = false): string {
+  const filteredAttachments = filterFirst ? filterExternalContent(rawAttachmentsInner) : rawAttachmentsInner;
+  const innerContent = trusted ? filteredAttachments : wrapUntrustedContent(filteredAttachments, false);
+  return `${ATTACHED_FILES_TAG_START}\n${innerContent}\n${ATTACHED_FILES_TAG_END}`;
+}
```

**File**: `chrome-extension/src/background/browser/dom/service.ts` (modified, +29/-10)
```diff
@@ -592,23 +592,42 @@ async function scriptInjectedFrames(tabId: number): Promise<Map<number, boolean>
   }
 }
 
-// // Function to inject the buildDomTree script
+// Function to inject the buildDomTree script
 export async function injectBuildDomTreeScripts(tabId: number) {
   try {
     // Check if already injected
     const injectedFrames = await scriptInjectedFrames(tabId);
-    if (injectedFrames.values().every(injected => injected)) {
+
+    // If we couldn't check any frames or all are already injected, try to inject in main frame only
+    if (injectedFrames.size === 0) {
+      // Couldn't check frames, so just try to inject in the main frame
+      try {
+        await chrome.scripting.executeScript({
+          target: { tabId },
+          files: ['buildDomTree.js'],
+        });
+      } catch (injectionErr) {
+        // Silently ignore - script might already be injected or frame might be inaccessible
+      }
       return;
     }
 
-    await chrome.scripting.executeScript({
-      target: {
-        tabId,
-        frameIds: Array.from(injectedFrames.keys()).filter(id => !injectedFrames.get(id)),
-      },
-      files: ['buildDomTree.js'],
-    });
-    console.log('Scripts successfully injected');
+    // Check if all frames already have the script
+    if (Array.from(injectedFrames.values()).every(injected => injected)) {
+      return;
+    }
+
+    // Inject only in frames that don't have the script
+    const frameIdsToInject = Array.from(injectedFrames.keys()).filter(id => !injectedFrames.get(id));
+    if (frameIdsToInject.length > 0) {
+      await chrome.scripting.executeScript({
+        target: {
+          tabId,
+          frameIds: frameIdsToInject,
+        },
+        files: ['buildDomTree.js'],
+      });
+    }
   } catch (err) {
     console.error('Failed to inject scripts:', err);
   }
```

**File**: `chrome-extension/src/background/services/guardrails/patterns.ts` (modified, +13/-2)
```diff
@@ -61,6 +61,12 @@ export const SECURITY_PATTERNS: SecurityPattern[] = [
     description: 'Reference to untrusted content',
     replacement: '',
   },
+  {
+    pattern: /\bnano[-_]+attached[-_]+files\b/gi,
+    type: ThreatType.PROMPT_INJECTION,
+    description: 'Reference to attached files',
+    replacement: '',
+  },
   {
     pattern: /\buser[-_]+request\b/gi,
     type: ThreatType.PROMPT_INJECTION,
@@ -134,14 +140,19 @@ export function getPatterns(strict: boolean = false): SecurityPattern[] {
 /**
  * Tags to preserve during sanitization (wrapped content tags)
  */
-export const PRESERVED_TAGS = ['nano_untrusted_content', 'nano_user_request'];
+export const PRESERVED_TAGS = [
+  'nano_untrusted_content',
+  'nano_user_request',
+  'nano_attached_files',
+  'nano_file_content',
+];
 
 /**
  * Check if a tag should be preserved during sanitization
  * @param tag - The tag to check
  * @returns True if the tag should be preserved
  */
-export function shouldPreserveTag(tag: string): boolean {
+export function isPreserveTag(tag: string): boolean {
   const tagName = tag.replace(/<\/?|\s|>/g, '').toLowerCase();
   return PRESERVED_TAGS.includes(tagName);
 }
```

**File**: `pages/side-panel/src/SidePanel.tsx` (modified, +5/-3)
```diff
@@ -549,7 +549,7 @@ const SidePanel = () => {
     }
   };
 
-  const handleSendMessage = async (text: string) => {
+  const handleSendMessage = async (text: string, displayText?: string) => {
     console.log('handleSendMessage', text);
 
     // Trim the input text first
@@ -582,8 +582,10 @@ const SidePanel = () => {
 
       // Create a new chat session for this task if not in follow-up mode
       if (!isFollowUpMode) {
+        // Use display text for session title if available, otherwise use full text
+        const titleText = displayText || text;
         const newSession = await chatHistoryStore.createSession(
-          text.substring(0, 50) + (text.length > 50 ? '...' : ''),
+          titleText.substring(0, 50) + (titleText.length > 50 ? '...' : ''),
         );
         console.log('newSession', newSession);
 
@@ -595,7 +597,7 @@ const SidePanel = () => {
 
       const userMessage = {
         actor: Actors.USER,
-        content: text,
+        content: displayText || text, // Use display text for chat UI, full text for background service
         timestamp: Date.now(),
       };
 
```

**File**: `pages/side-panel/src/components/ChatInput.tsx` (modified, +153/-6)
```diff
@@ -4,7 +4,7 @@ import { AiOutlineLoading3Quarters } from 'react-icons/ai';
 import { t } from '@extension/i18n';
 
 interface ChatInputProps {
-  onSendMessage: (text: string) => void;
+  onSendMessage: (text: string, displayText?: string) => void;
   onStopTask: () => void;
   onMicClick?: () => void;
   isRecording?: boolean;
@@ -18,6 +18,13 @@ interface ChatInputProps {
   onReplay?: (sessionId: string) => void;
 }
 
+// File attachment interface
+interface AttachedFile {
+  name: string;
+  content: string;
+  type: string;
+}
+
 export default function ChatInput({
   onSendMessage,
   onStopTask,
@@ -32,8 +39,13 @@ export default function ChatInput({
   onReplay,
 }: ChatInputProps) {
   const [text, setText] = useState('');
-  const isSendButtonDisabled = useMemo(() => disabled || text.trim() === '', [disabled, text]);
+  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
+  const isSendButtonDisabled = useMemo(
+    () => disabled || (text.trim() === '' && attachedFiles.length === 0),
+    [disabled, text, attachedFiles],
+  );
   const textareaRef = useRef<HTMLTextAreaElement>(null);
+  const fileInputRef = useRef<HTMLInputElement>(null);
 
   // Handle text changes and resize textarea
   const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
@@ -67,12 +79,38 @@ export default function ChatInput({
   const handleSubmit = useCallback(
     (e: React.FormEvent) => {
       e.preventDefault();
-      if (text.trim()) {
-        onSendMessage(text);
+      const trimmedText = text.trim();
+
+      if (trimmedText || attachedFiles.length > 0) {
+        let messageContent = trimmedText;
+        let displayContent = trimmedText;
+
+        // Security: Clearly separate user input from file content
+        // The background service will sanitize file content using guardrails
+        if (attachedFiles.length > 0) {
+          const fileContents = attachedFiles
+            .map(file => {
+              // Tag file content for background service to identify and sanitize
+              return `\n\n<nano_file_content type="file" name="${file.name}">\n${file.content}\n</nano_file_content>`;
+            })
+            .join('\n');
+
+          // Combine user message with tagged file content (for background service)
+          messageContent = trimmedText
+            ? `${trimmedText}\n\n<nano_attached_files>${fileContents}</nano_attached_files>`
+            : `<nano_attached_files>${fileContents}</nano_attached_files>`;
+
+          // Create display version with only filenames (for UI)
+          const fileList = attachedFiles.map(file => `📎 ${file.name}`).join('\n');
+          displayContent = trimmedText ? `${trimmedText}\n\n${fileList}` : fileList;
+        }
+
+        onSendMessage(messageContent, displayContent);
         setText('');
+        setAttachedFiles([]);
       }
     },
-    [text, onSendMessage],
+    [text, attachedFiles, onSendMessage],
   );
 
   const handleKeyDown = useCallback(
@@ -91,12 +129,93 @@ export default function ChatInput({
     }
   }, [historicalSessionId, onReplay]);
 
+  const handleFileSelect = useCallback(() => {
+    fileInputRef.current?.click();
+  }, []);
+
+  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
+    const files = e.target.files;
+    if (!files || files.length === 0) return;
+
+    const newFiles: AttachedFile[] = [];
+    const allowedTypes = ['.txt', '.md', '.markdown', '.json', '.csv', '.log', '.xml', '.yaml', '.yml'];
+
+    for (let i = 0; i < files.length; i++) {
+      const file = files[i];
+      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
+
+      // Check if file type is allowed
+      if (!allowedTypes.includes(fileExt)) {
+        console.warn(`File type ${fileExt} not supported. Only text-based files are allowed.`);
+        continue;
+      }
+
+      // Check file size (limit to 1MB)
+      if (file.size > 1024 * 1024) {
+        console.warn(`File ${file.name} is too large. Maximum size is 1MB.`);
+        continue;
+      }
+
+      try {
+        const content = await file.text();
+        newFiles.push({
+          name: file.name,
+          content,
+          type: file.type || 'text/plain',
+        });
+      } catch (error) {
+        console.error(`Error reading file ${file.name}:`, error);
+      }
+    }
+
+    if (newFiles.length > 0) {
+      setAttachedFiles(prev => [...prev, ...newFiles]);
+    }
+
+    // Reset file input
+    if (fileInputRef.current) {
+      fileInputRef.current.value = '';
+    }
+  }, []);
+
+  const handleRemoveFile = useCallback((index: number) => {
+    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
+  }, []);
+
   return (
     <form
       onSubmit={handleSubmit}
       className={`overflow-hidden rounded-lg border transition-colors ${disabled ? 'cursor-not-allowed' : 'focus-within:border-sky-400 hover:border-sky-400'} ${isDarkMode ? 'border-slate-700' : ''}`}
       a
```

---

### Incident Patch 14: `62430417` (2025-09-24)
**Commit Message**: Merge pull request #243 from nanobrowser/bugfix

Bugfix

**File**: `chrome-extension/public/buildDomTree.js` (modified, +64/-19)
```diff
@@ -1232,7 +1232,20 @@ window.buildDomTree = (
    * @param {boolean} isParentHighlighted - Whether the parent node is highlighted.
    * @returns {string | null} The ID of the node data object, or null if the node is not processed.
    */
-  function buildDomTree(node, parentIframe = null, isParentHighlighted = false) {
+  const MAX_DEPTH = 100;
+  let visitedNodes;
+
+  function buildDomTree(node, parentIframe = null, isParentHighlighted = false, depth = 0) {
+    // Initialize visited nodes tracking on first call
+    if (!visitedNodes) {
+      visitedNodes = new WeakSet();
+    }
+
+    // Prevent infinite recursion
+    if (depth > MAX_DEPTH) {
+      return null;
+    }
+
     // Fast rejection checks first
     if (
       !node ||
@@ -1242,9 +1255,13 @@ window.buildDomTree = (
       return null;
     }
 
-    if (!node || node.id === HIGHLIGHT_CONTAINER_ID) {
+    // Prevent circular references (only for valid nodes)
+    if (node.nodeType === Node.ELEMENT_NODE && visitedNodes.has(node)) {
       return null;
     }
+    if (node.nodeType === Node.ELEMENT_NODE) {
+      visitedNodes.add(node);
+    }
 
     // Special handling for root node (body)
     if (node === document.body) {
@@ -1256,8 +1273,8 @@ window.buildDomTree = (
       };
 
       // Process children of body
-      for (const child of node.childNodes) {
-        const domElement = buildDomTree(child, parentIframe, false); // Body's children have no highlighted parent initially
+      for (const child of Array.from(node.childNodes)) {
+        const domElement = buildDomTree(child, parentIframe, false, depth + 1); // Body's children have no highlighted parent initially
         if (domElement) nodeData.children.push(domElement);
       }
 
@@ -1390,17 +1407,43 @@ window.buildDomTree = (
         const rect = getCachedBoundingRect(node);
         nodeData.attributes['computedHeight'] = String(Math.ceil(rect.height));
         nodeData.attributes['computedWidth'] = String(Math.ceil(rect.width));
-        try {
-          const iframeDoc = node.contentDocument || node.contentWindow?.document;
-          if (iframeDoc) {
-            for (const child of iframeDoc.childNodes) {
-              const domElement = buildDomTree(child, node, false);
-              if (domElement) nodeData.children.push(domElement);
+
+        // Check if iframe should be skipped (invisible tracking/ad iframes)
+        const shouldSkipIframe =
+          // Invisible iframes (1x1 pixel or similar)
+          (rect.width <= 1 && rect.height <= 1) ||
+          // Positioned off-screen
+          rect.left < -1000 ||
+          rect.top < -1000;
+
+        // Early detection for sandboxed iframes
+        const sandbox = node.getAttribute('sandbox');
+        const isSandboxed = sandbox !== null;
+        const isRestrictiveSandbox = isSandboxed && !sandbox.includes('allow-same-origin');
+
+        if (shouldSkipIframe) {
+          // Skip processing invisible/tracking iframes entirely
+          nodeData.attributes['skipped'] = 'invisible-tracking-iframe';
+        } else if (isRestrictiveSandbox) {
+          // Set error directly for sandboxed iframes we know will fail
+          nodeData.attributes['error'] = 'Cross-origin iframe access blocked by sandbox';
+        } else {
+          // Only attempt access for iframes that might succeed
+          try {
+            const iframeDoc = node.contentDocument || node.contentWindow?.document;
+            if (iframeDoc && iframeDoc.childNodes) {
+              for (const child of Array.from(iframeDoc.childNodes)) {
+                const domElement = buildDomTree(child, node, false, depth + 1);
+                if (domElement) nodeData.children.push(domElement);
+              }
+            }
+          } catch (e) {
+            nodeData.attributes['error'] = e.message;
+            // Only log unexpected errors, not predictable ones
+            if (!e.message.includes('cross-origin') && !e.message.includes('origin "null"')) {
+              console.warn('Unable to access iframe:', e);
             }
           }
-        } catch (e) {
-          nodeData.attributes['error'] = e.message;
-          console.warn('Unable to access iframe:', e);
         }
       }
       // Handle rich text editors and contenteditable elements
@@ -1412,24 +1455,24 @@ window.buildDomTree = (
         (tagName === 'body' && node.getAttribute('data-id')?.startsWith('mce_'))
       ) {
         // Process all child nodes to capture formatted text
-        for (const child of node.childNodes) {
-          const domElement = buildDomTree(child, parentIframe, nodeWasHighlighted);
+        for (const child of Array.from(node.childNodes)) {
+          const domElement = buildDomTree(child, parentIframe, nodeWasHighlighted, depth + 1);
           if (domElement) nodeData.children.push(domElement);
         }
       } else {
         // Handle shadow DOM
         if (node.shadowRoot) {
           nodeData.shadowRoot = true;
-          fo
```

**File**: `chrome-extension/src/background/agent/prompts/templates/planner.ts` (modified, +9/-5)
```diff
@@ -23,12 +23,13 @@ ${commonSecurityRules}
   - Suggest to use the current tab as possible as you can, do NOT open a new tab unless the task requires it.
   - **ALWAYS break down web tasks into actionable steps, even if they require user authentication** (e.g., Gmail, social media, banking sites)
   - **Your role is strategic planning and evaluating the current state, not execution feasibility assessment** - the navigator agent handles actual execution and user interactions
-  - IMPORTANT: 
+  - IMPORTANT:
     - Always prioritize working with content visible in the current viewport first:
     - Focus on elements that are immediately visible without scrolling
     - Only suggest scrolling if the required content is confirmed to not be in the current view
     - Scrolling is your LAST resort unless you are explicitly required to do so by the task
     - NEVER suggest scrolling through the entire page, only scroll maximum ONE PAGE at a time.
+    - If sign in or credentials are required to complete the task, you should mark as done and ask user to sign in/fill credentials by themselves in final answer
     - When you set done to true, you must:
       * Provide the final answer to the user's task in the "final_answer" field
       * Set "next_steps" to empty string (since the task is complete)
@@ -39,13 +40,16 @@ ${commonSecurityRules}
 When determining if a task is "done":
 1. Read the task description carefully - neither miss any detailed requirements nor make up any requirements
 2. Verify all aspects of the task have been completed successfully  
-3. If the task is unclear, you can mark it as done, but if something is clearly missing or incorrect, do NOT mark it as done
-4. If the webpage is asking for username/password, mark as done and ask user to sign in themselves
+3. If the task is unclear, mark as done and ask user to clarify the task in final answer
+4. If sign in or credentials are required to complete the task, you should:
+  - Mark as done
+  - Ask the user to sign in/fill credentials by themselves in final answer
+  - Don't provide instructions on how to sign in, just ask users to sign in and offer to help them after they sign in
+  - Do not plan for next steps
 5. Focus on the current state and last action results to determine completion
 
 # FINAL ANSWER FORMATTING (when done=true):
-- Start with an emoji "✅" 
-- Use markdown formatting if required by the task description
+- Use markdown formatting only if required by the task description
 - Use plain text by default
 - Use bullet points for multiple items if needed
 - Use line breaks for better readability  
```

**File**: `chrome-extension/src/background/browser/dom/clickable/service.ts` (modified, +24/-6)
```diff
@@ -11,18 +11,36 @@ export async function getClickableElementsHashes(domElement: DOMElementNode): Pr
 }
 
 /**
- * Get all clickable elements in the DOM tree
+ * Get all clickable elements in the DOM tree using an iterative approach
+ * to avoid "Maximum call stack size exceeded" errors on deep DOMs.
+ * This maintains the exact same pre-order traversal as the original recursive version.
  */
 export function getClickableElements(domElement: DOMElementNode): DOMElementNode[] {
   const clickableElements: DOMElementNode[] = [];
+  const stack: DOMElementNode[] = [];
 
-  for (const child of domElement.children) {
+  // Start with all direct children of the root element (in reverse order for correct processing)
+  for (let i = domElement.children.length - 1; i >= 0; i--) {
+    const child = domElement.children[i];
     if (child instanceof DOMElementNode) {
-      if (child.highlightIndex !== null) {
-        clickableElements.push(child);
-      }
+      stack.push(child);
+    }
+  }
+
+  while (stack.length > 0) {
+    const node = stack.pop() as DOMElementNode;
 
-      clickableElements.push(...getClickableElements(child));
+    // Process current node first (pre-order: node before children)
+    if (node.highlightIndex !== null) {
+      clickableElements.push(node);
+    }
+
+    // Add children to stack in reverse order so they're processed in document order
+    for (let i = node.children.length - 1; i >= 0; i--) {
+      const child = node.children[i];
+      if (child instanceof DOMElementNode) {
+        stack.push(child);
+      }
     }
   }
 
```

**File**: `chrome-extension/src/background/browser/dom/service.ts` (modified, +4/-1)
```diff
@@ -392,7 +392,10 @@ function _visibleIFramesFailedLoading(result: BuildDomTreeResult): Record<string
       const error = iframeNode.attributes['error'];
       const height = parseInt(iframeNode.attributes['computedHeight']);
       const width = parseInt(iframeNode.attributes['computedWidth']);
-      return error != null && height > 0 && width > 0;
+      const skipped = iframeNode.attributes['skipped'];
+
+      // Only consider iframes that have errors AND are visible AND not skipped
+      return error != null && height > 1 && width > 1 && !skipped;
     }),
   );
 }
```

---

### Incident Patch 15: `3fbdbe97` (2025-09-24)
**Commit Message**: fix planner prompt when sign in is required to complete the task

**File**: `chrome-extension/src/background/agent/prompts/templates/planner.ts` (modified, +9/-5)
```diff
@@ -23,12 +23,13 @@ ${commonSecurityRules}
   - Suggest to use the current tab as possible as you can, do NOT open a new tab unless the task requires it.
   - **ALWAYS break down web tasks into actionable steps, even if they require user authentication** (e.g., Gmail, social media, banking sites)
   - **Your role is strategic planning and evaluating the current state, not execution feasibility assessment** - the navigator agent handles actual execution and user interactions
-  - IMPORTANT: 
+  - IMPORTANT:
     - Always prioritize working with content visible in the current viewport first:
     - Focus on elements that are immediately visible without scrolling
     - Only suggest scrolling if the required content is confirmed to not be in the current view
     - Scrolling is your LAST resort unless you are explicitly required to do so by the task
     - NEVER suggest scrolling through the entire page, only scroll maximum ONE PAGE at a time.
+    - If sign in or credentials are required to complete the task, you should mark as done and ask user to sign in/fill credentials by themselves in final answer
     - When you set done to true, you must:
       * Provide the final answer to the user's task in the "final_answer" field
       * Set "next_steps" to empty string (since the task is complete)
@@ -39,13 +40,16 @@ ${commonSecurityRules}
 When determining if a task is "done":
 1. Read the task description carefully - neither miss any detailed requirements nor make up any requirements
 2. Verify all aspects of the task have been completed successfully  
-3. If the task is unclear, you can mark it as done, but if something is clearly missing or incorrect, do NOT mark it as done
-4. If the webpage is asking for username/password, mark as done and ask user to sign in themselves
+3. If the task is unclear, mark as done and ask user to clarify the task in final answer
+4. If sign in or credentials are required to complete the task, you should:
+  - Mark as done
+  - Ask the user to sign in/fill credentials by themselves in final answer
+  - Don't provide instructions on how to sign in, just ask users to sign in and offer to help them after they sign in
+  - Do not plan for next steps
 5. Focus on the current state and last action results to determine completion
 
 # FINAL ANSWER FORMATTING (when done=true):
-- Start with an emoji "✅" 
-- Use markdown formatting if required by the task description
+- Use markdown formatting only if required by the task description
 - Use plain text by default
 - Use bullet points for multiple items if needed
 - Use line breaks for better readability  
```

#### Recent Merged Pull Requests:
- **PR #325** (closed): fix: handle <think> tags in model responses robustly (@gsrunion)
- **PR #309** (closed): hjg (@jamiereddin-89)
- **PR #307** (closed): chore(ui): remove social media links and promotional prompts (@jamiereddin-89)
- **PR #304** (closed): Feat/veto browse rebrand (@yazcaleb)
- **PR #303** (closed): Implement skills management system with CRUD operations and UI (@Jeyaram-K)
- **PR #292** (closed): 2 add default provider (@phanquanghuy9869)
- **PR #289** (closed): claude/agenthub-export-feature-186Nc (@mhgaber000)
- **PR #288** (closed): Polymath v3 extension 17569350334038751687 (@wangxumarshall)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
