# Forensic Learning Record (Deep Inspection): nanobrowser/nanobrowser

> **Canonical Artifact**: `07_PROJECT_LEARNING/nanobrowser-nanobrowser-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nanobrowser/nanobrowser](https://github.com/nanobrowser/nanobrowser))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:22:15.743Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nanobrowser/nanobrowser`
- **Description**: Open-Source Chrome extension for AI-powered web automation. Run multi-agent workflows using your own LLM API key. Alternative to OpenAI Operator.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 13850 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `chrome-extension/manifest.js`
```
import fs from 'node:fs';
import deepmerge from 'deepmerge';

const packageJson = JSON.parse(fs.readFileSync('../package.json', 'utf8'));

const isFirefox = process.env.__FIREFOX__ === 'true';
const isOpera = process.env.__OPERA__ === 'true';

/**
 * If you want to disable the sidePanel, you can delete withSidePanel function and remove the sidePanel HoC on the manifest declaration.
 *
 * ```js
 * const manifest = { // remove `withSidePanel()`
 * ```
 */
function withSidePanel(manifest) {
  // Firefox does not support sidePanel
  if (isFirefox) {
    return manifest;
  }
  return deepmerge(manifest, {
    side_panel: {
      default_path: 'side-panel/index.html',
    },
    permissions: ['sidePanel'],
  });
}

/**
 * Adds Opera sidebar support using the sidebar_action API.
 * This is compatible with Chrome extensions and won't break Chrome Web Store validation.
 */
function withOperaSidebar(manifest) {
  // Only add Opera sidebar_action if building specifically for Opera
  if (isFirefox || !isOpera) {
    return manifest;
  }

  return deepmerge(manifest, {
    sidebar_action: {
      default_panel: 'side-panel/index.html',
      default_title: 'Nanobrowser',
      default_icon: 'icon-32.png',
    },
  });
}

/**
 * After changing, please reload the extension at `chrome://extensions`
 * @type {chrome.runtime.ManifestV3}
 */
const manifest = withOperaSidebar(
  withSidePanel({
    manifest_version: 3,
    default_locale: 'en',
    /**
     * if you want to support multiple languages, you can use the following reference
     * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Internationalization
     */
    name: '__MSG_app_metadata_name__',
    version: packageJson.version,
    description: '__MSG_app_metadata_description__',
    host_permissions: ['<all_urls>'],
    permissions: ['storage', 'scripting', 'tabs', 'activeTab', 'debugger', 'unlimitedStorage', 'webNavigation'],
    options_page: 'options/index.html',
    background: {
      service_worker: 'background.iife.js',
      type: 'module',
    },
    action: {
      default_icon: 'icon-32.png',
    },
    icons: {
      128: 'icon-128.png',
    },
    content_scripts: [
      {
        matches: ['http://*/*', 'https://*/*', '<all_urls>'],
        all_frames: true,
        js: ['content/index.iife.js'],
      },
    ],
    web_accessible_resources: [
      {
        resources: [
          '*.js',
          '*.css',
          '*.svg',
          'icon-128.png',
          'icon-32.png',
          'permission/index.html',
          'permission/permission.js',
        ],
        matches: ['*://*/*'],
      },
    ],
  }),
);

export default manifest;

```

### Core Architecture Module: `chrome-extension/public/permission/permission.js`
```
document.addEventListener('DOMContentLoaded', () => {
  // Set up i18n text content
  document.getElementById('title').textContent = chrome.i18n.getMessage('permissions_microphone_title');
  document.getElementById('description').textContent = chrome.i18n.getMessage('permissions_microphone_description');

  const requestButton = document.getElementById('requestPermission');
  const statusText = document.getElementById('status');

  requestButton.textContent = chrome.i18n.getMessage('permissions_microphone_grantButton');

  requestButton.addEventListener('click', async () => {
    try {
      statusText.textContent = chrome.i18n.getMessage('permissions_microphone_requesting');
      statusText.className = '';

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Permission granted - stop the tracks immediately
      stream.getTracks().forEach(track => track.stop());

      // Update UI
      statusText.textContent = chrome.i18n.getMessage('permissions_microphone_grantedSuccess');
      statusText.className = 'success';
      requestButton.textContent = chrome.i18n.getMessage('permissions_microphone_grantedButton');
      requestButton.disabled = true;

      // Close window after a short delay
      setTimeout(() => {
        window.close();
      }, 2000);
    } catch (error) {
      console.error('Permission denied or error:', error);

      let errorMessage = chrome.i18n.getMessage('permissions_microphone_denied');

      if (error.name === 'NotAllowedError') {
        errorMessage += chrome.i18n.getMessage('permissions_microphone_allowHelp');
      } else if (error.name === 'NotFoundError') {
        errorMessage += chrome.i18n.getMessage('permissions_microphone_notFound');
      } else {
        errorMessage += error.message;
      }

      statusText.textContent = '❌ ' + errorMessage;
      statusText.className = 'error';
    }
  });

  // Check if permission is already granted
  navigator.permissions
    .query({ name: 'microphone' })
    .then(permissionStatus => {
      if (permissionStatus.state === 'granted') {
        statusText.textContent = chrome.i18n.getMessage('permissions_microphone_alreadyGranted');
        statusText.className = 'success';
        requestButton.textContent = chrome.i18n.getMessage('permissions_microphone_alreadyGrantedButton');
        requestButton.disabled = true;
      }
    })
    .catch(err => {
      console.log('Permission query not supported:', err);
    });
});

```

### Core Architecture Module: `chrome-extension/src/background/agent/actions/schemas.ts`
```
import { z } from 'zod';

export interface ActionSchema {
  name: string;
  description: string;
  schema: z.ZodType;
}

export const doneActionSchema: ActionSchema = {
  name: 'done',
  description: 'Complete task',
  schema: z.object({
    text: z.string(),
    success: z.boolean(),
  }),
};

// Basic Navigation Actions
export const searchGoogleActionSchema: ActionSchema = {
  name: 'search_google',
  description:
    'Search the query in Google in the current tab, the query should be a search query like humans search in Google, concrete and not vague or super long. More the single most important items.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    query: z.string(),
  }),
};

export const goToUrlActionSchema: ActionSchema = {
  name: 'go_to_url',
  description: 'Navigate to URL in the current tab',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    url: z.string(),
  }),
};

export const goBackActionSchema: ActionSchema = {
  name: 'go_back',
  description: 'Go back to the previous page',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
  }),
};

export const clickElementActionSchema: ActionSchema = {
  name: 'click_element',
  description: 'Click element by index',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().describe('index of the element'),
    xpath: z.string().nullable().optional().describe('xpath of the element'),
  }),
};

export const inputTextActionSchema: ActionSchema = {
  name: 'input_text',
  description: 'Input text into an interactive input element',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().describe('index of the element'),
    text: z.string().describe('text to input'),
    xpath: z.string().nullable().optional().describe('xpath of the element'),
  }),
};

// Tab Management Actions
export const switchTabActionSchema: ActionSchema = {
  name: 'switch_tab',
  description: 'Switch to tab by tab id',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    tab_id: z.number().int().describe('id of the tab to switch to'),
  }),
};

export const openTabActionSchema: ActionSchema = {
  name: 'open_tab',
  description: 'Open URL in new tab',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    url: z.string().describe('url to open'),
  }),
};

export const closeTabActionSchema: ActionSchema = {
  name: 'close_tab',
  description: 'Close tab by tab id',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    tab_id: z.number().int().describe('id of the tab'),
  }),
};

// Content Actions, not used currently
// export const extractContentActionSchema: ActionSchema = {
//   name: 'extract_content',
//   description:
//     'Extract page content to retrieve specific information from the page, e.g. all company names, a specific description, all information about, links with companies in structured format or simply links',
//   schema: z.object({
//     goal: z.string(),
//   }),
// };

// Cache Actions
export const cacheContentActionSchema: ActionSchema = {
  name: 'cache_content',
  description: 'Cache what you have found so far from the current page for future use',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    content: z.string().default('').describe('content to cache'),
  }),
};

export const scrollToPercentActionSchema: ActionSchema = {
  name: 'scroll_to_percent',
  description:
    'Scrolls to a particular vertical percentage of the document or an element. If no index of element is specified, scroll the whole document.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    yPercent: z.number().int().describe('percentage to scroll to - min 0, max 100; 0 is top, 100 is bottom'),
    index: z.number().int().nullable().optional().describe('index of the element'),
  }),
};

export const scrollToTopActionSchema: ActionSchema = {
  name: 'scroll_to_top',
  description: 'Scroll the document in the window or an element to the top',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().nullable().optional().describe('index of the element'),
  }),
};

export const scrollToBottomActionSchema: ActionSchema = {
  name: 'scroll_to_bottom',
  description: 'Scroll the document in the window or an element to the bottom',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().nullable().optional().describe('index of the element'),
  }),
};

export const previousPageActionSchema: ActionSchema = {
  name: 'previous_page',
  description:
    'Scroll the document in the window or an element to the previous page. If no index is specified, scroll the whole document.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().nullable().optional().describe('index of the element'),
  }),
};

export const nextPageActionSchema: ActionSchema = {
  name: 'next_page',
  description:
    'Scroll the document in the window or an element to the next page. If no index is specified, scroll the whole document.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().nullable().optional().describe('index of the element'),
  }),
};

export const scrollToTextActionSchema: ActionSchema = {
  name: 'scroll_to_text',
  description: 'If you dont find something which you want to interact with in current viewport, try to scroll to it',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    text: z.string().describe('text to scroll to'),
    nth: z
      .number()
      .int()
      .min(1)
      .default(1)
      .describe('which occurrence of the text to scroll to (1-indexed, default: 1)'),
  }),
};

export const sendKeysActionSchema: ActionSchema = {
  name: 'send_keys',
  description:
    'Send strings of special keys like Backspace, Insert, PageDown, Delete, Enter. Shortcuts such as `Control+o`, `Control+Shift+T` are supported as well. This gets used in keyboard press. Be aware of different operating systems and their shortcuts',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    keys: z.string().describe('keys to send'),
  }),
};

export const getDropdownOptionsActionSchema: ActionSchema = {
  name: 'get_dropdown_options',
  description: 'Get all options from a native dropdown',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().describe('index of the dropdown element'),
  }),
};

export const selectDropdownOptionActionSchema: ActionSchema = {
  name: 'select_dropdown_option',
  description: 'Select dropdown option for interactive element index by the text of the option you want to select',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().describe('index of the dropdown element'),
    text: z.string().describe('text of the option'),
  }),
};

export const waitActionSchema: ActionSchema = {
  name: 'wait',
  description: 'Wait for x seconds default 3, do NOT use this action unless user asks to wait explicitly',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    seconds: z.number().int().default(3).describe('amount of seconds'),
  }),
};

```

### Core Architecture Module: `chrome-extension/src/background/agent/agents/base.ts`
```
import type { z } from 'zod';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { AgentContext, AgentOutput } from '../types';
import type { BasePrompt } from '../prompts/base';
import type { BaseMessage } from '@langchain/core/messages';
import { createLogger } from '@src/background/log';
import type { Action } from '../actions/builder';
import { convertInputMessages, extractJsonFromModelOutput, removeThinkTags } from '../messages/utils';
import { isAbortedError, ResponseParseError } from './errors';
import { ProviderTypeEnum } from '@extension/storage';

const logger = createLogger('agent');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CallOptions = Record<string, any>;

// Update options to use Zod schema
export interface BaseAgentOptions {
  chatLLM: BaseChatModel;
  context: AgentContext;
  prompt: BasePrompt;
  provider?: string;
}
export interface ExtraAgentOptions {
  id?: string;
  toolCallingMethod?: string;
  callOptions?: CallOptions;
}

/**
 * Base class for all agents
 * @param T - The Zod schema for the model output
 * @param M - The type of the result field of the agent output
 */
export abstract class BaseAgent<T extends z.ZodType, M = unknown> {
  protected id: string;
  protected chatLLM: BaseChatModel;
  protected prompt: BasePrompt;
  protected context: AgentContext;
  protected actions: Record<string, Action> = {};
  protected modelOutputSchema: T;
  protected toolCallingMethod: string | null;
  protected chatModelLibrary: string;
  protected modelName: string;
  protected provider: string;
  protected withStructuredOutput: boolean;
  protected callOptions?: CallOptions;
  protected modelOutputToolName: string;
  declare ModelOutput: z.infer<T>;

  constructor(modelOutputSchema: T, options: BaseAgentOptions, extraOptions?: Partial<ExtraAgentOptions>) {
    // base options
    this.modelOutputSchema = modelOutputSchema;
    this.chatLLM = options.chatLLM;
    this.prompt = options.prompt;
    this.context = options.context;
    this.provider = options.provider || '';
    // TODO: fix this, the name is not correct in production environment
    this.chatModelLibrary = this.chatLLM.constructor.name;
    this.modelName = this.getModelName();
    this.withStructuredOutput = this.setWithStructuredOutput();
    // extra options
    this.id = extraOptions?.id || 'agent';
    this.toolCallingMethod = this.setToolCallingMethod(extraOptions?.toolCallingMethod);
    this.callOptions = extraOptions?.callOptions;
    this.modelOutputToolName = `${this.id}_output`;
  }

  // Set the model name
  private getModelName(): string {
    if ('modelName' in this.chatLLM) {
      return this.chatLLM.modelName as string;
    }
    if ('model_name' in this.chatLLM) {
      return this.chatLLM.model_name as string;
    }
    if ('model' in this.chatLLM) {
      return this.chatLLM.model as string;
    }
    return 'Unknown';
  }

  // Set the tool calling method
  private setToolCallingMethod(toolCallingMethod?: string): string | null {
    if (toolCallingMethod === 'auto') {
      switch (this.chatModelLibrary) {
        case 'ChatGoogleGenerativeAI':
          return null;
        case 'ChatOpenAI':
        case 'AzureChatOpenAI':
        case 'ChatGroq':
        case 'ChatXAI':
          return 'function_calling';
        default:
          return null;
      }
    }
    return toolCallingMethod || null;
  }

  // Check if model is a Llama model (only for Llama-specific handling)
  private isLlamaModel(modelName: string): boolean {
    return modelName.includes('Llama-4') || modelName.includes('Llama-3.3') || modelName.includes('llama-3.3');
  }

  // Set whether to use structured output based on the model name
  private setWithStructuredOutput(): boolean {
    if (this.modelName === 'deepseek-reasoner' || this.modelName === 'deepseek-r1') {
      return false;
    }

    // Llama API models don't support json_schema response format
    if (this.provider === ProviderTypeEnum.Llama || this.isLlamaModel(this.modelName)) {
      logger.debug(`[${this.modelName}] Llama API doesn't support structured output, using manual JSON extraction`);
      return false;
    }

    return true;
  }

  async invoke(inputMessages: BaseMessage[]): Promise<this['ModelOutput']> {
    // Use structured output
    if (this.withStructuredOutput) {
      logger.debug(`[${this.modelName}] Preparing structured output call with schema:`, {
        schemaName: this.modelOutputToolName,
        messageCount: inputMessages.length,
        modelProvider: this.provider,
      });

      const structuredLlm = this.chatLLM.withStructuredOutput(this.modelOutputSchema, {
        includeRaw: true,
        name: this.modelOutputToolName,
      });

      let response = undefined;
      try {
        logger.debug(`[${this.modelName}] Invoking LLM with structured output...`);
        response = await structuredLlm.invoke(inputMessages, {
          signal: this.context.controller.signal,
          ...this.callOptions,
        });

        logger.debug(`[${this.modelName}] LLM response received:`, {
          hasParsed: !!response.parsed,
          hasRaw: !!response.raw,
          rawContent: response.raw?.content?.slice(0, 500) + (response.raw?.content?.length > 500 ? '...' : ''),
        });

        if (response.parsed) {
          logger.debug(`[${this.modelName}] Successfully parsed structured output`);
          return response.parsed;
        }
        logger.error('Failed to parse response', response);
        throw new Error('Could not parse response with structured output');
      } catch (error) {
        if (isAbortedError(error)) {
          throw error;
        }

        // Try to extract JSON from raw response manually if possible
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes('is not valid JSON') &&
          response?.raw?.content &&
          typeof response.raw.content === 'string'
        ) {
          const parsed = this.manuallyParseResponse(response.raw.content);
          if (parsed) {
            return parsed;
          }
        }
        logger.error(`[${this.modelName}] LLM call failed with error: \n${errorMessage}`);
        throw new Error(`Failed to invoke ${this.modelName} with structured output: \n${errorMessage}`);
      }
    }

    // Fallback: Without structured output support, need to extract JSON from model output manually
    logger.debug(`[${this.modelName}] Using manual JSON extraction fallback method`);
    const convertedInputMessages = convertInputMessages(inputMessages, this.modelName);

    try {
      const response = await this.chatLLM.invoke(convertedInputMessages, {
        signal: this.context.controller.signal,
        ...this.callOptions,
      });

      if (typeof response.content === 'string') {
        const parsed = this.manuallyParseResponse(response.content);
        if (parsed) {
          return parsed;
        }
      }
    } catch (error) {
      logger.error(`[${this.modelName}] LLM call failed in manual extraction mode:`, error);
      throw error;
    }
    const errorMessage = `Failed to parse response from ${this.modelName}`;
    logger.error(errorMessage);
    throw new ResponseParseError('Could not parse response');
  }

  // Execute the agent and return the result
  abstract execute(): Promise<AgentOutput<M>>;

  // Helper method to validate metadata
  protected validateModelOutput(data: unknown): this['ModelOutput'] | undefined {
    if (!this.modelOutputSchema || !data) return undefined;
    try {
      return this.modelOutputSchema.parse(data);
    } catch (error) {
      logger.error('validateModelOutput', error);
      throw new ResponseParseError('Could not validate model output');
    }
  }

  // Helper method to manually parse the response content
  protected manuallyParseResponse(content: string): this['ModelOutput'] | undefined {
    const cleanedContent
```

### Core Architecture Module: `chrome-extension/src/background/agent/agents/errors.ts`
```
export const LLM_FORBIDDEN_ERROR_MESSAGE =
  'Access denied (403 Forbidden). Please check:\n\n1. Your API key has the required permissions\n\n2. For Ollama: Set OLLAMA_ORIGINS=chrome-extension://* \nsee https://github.com/ollama/ollama/blob/main/docs/faq.md';

export const EXTENSION_CONFLICT_ERROR_MESSAGE = `
  Cannot access a chrome-extension:// URL of different extension.
  
  This is likely due to conflicting extensions. Please use Nanobrowser in a new profile.`;

/**
 * Custom error class for chat model authentication errors
 */
export class ChatModelAuthError extends Error {
  /**
   * Creates a new ChatModelAuthError
   *
   * @param message - The error message
   * @param cause - The original error that caused this error
   */
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ChatModelAuthError';

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ChatModelAuthError);
    }
  }

  /**
   * Returns a string representation of the error
   */
  toString(): string {
    return `${this.name}: ${this.message}${this.cause ? ` (Caused by: ${this.cause})` : ''}`;
  }
}

export class ChatModelForbiddenError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ChatModelForbiddenError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ChatModelForbiddenError);
    }
  }

  /**
   * Returns a string representation of the error
   */
  toString(): string {
    return `${this.name}: ${this.message}${this.cause ? ` (Caused by: ${this.cause})` : ''}`;
  }
}

/**
 * Custom error class for chat model bad request errors (400)
 */
export class ChatModelBadRequestError extends Error {
  /**
   * Creates a new ChatModelBadRequestError
   *
   * @param message - The error message
   * @param cause - The original error that caused this error
   */
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ChatModelBadRequestError';

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ChatModelBadRequestError);
    }
  }

  /**
   * Returns a string representation of the error
   */
  toString(): string {
    return `${this.name}: ${this.message}${this.cause ? ` (Caused by: ${this.cause})` : ''}`;
  }
}

/**
 * Checks if an error is related to API authentication
 *
 * @param error - The error to check
 * @returns boolean indicating if it's an authentication error
 */
export function isAuthenticationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  // Get the error message
  const errorMessage = error.message || '';

  // Get error name - sometimes error.name just returns "Error" for custom errors
  let errorName = error.name || '';

  // Try to extract the constructor name, which often contains the actual error type
  // This works better than error.name for many custom errors
  const constructorName = error.constructor?.name;
  if (constructorName && constructorName !== 'Error') {
    errorName = constructorName;
  }

  // Check if the error name indicates an authentication error
  if (errorName === 'AuthenticationError') {
    return true;
  }

  // Fallback: check the message for authentication-related indicators
  return (
    errorMessage.toLowerCase().includes('authentication') ||
    errorMessage.includes(' 401') ||
    errorMessage.toLowerCase().includes('api key')
  );
}

/**
 * Checks if an error is related 403 Forbidden
 *
 * @param error - The error to check
 * @returns boolean indicating if it's an 403 Forbidden error
 */
export function isForbiddenError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes(' 403') && error.message.includes('Forbidden');
}

/**
 * Checks if an error is related to 400 Bad Request
 *
 * @param error - The error to check
 * @returns boolean indicating if it's a 400 Bad Request error
 */
export function isBadRequestError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  // Get the error message
  const errorMessage = error.message || '';

  // Get error name - sometimes error.name just returns "Error" for custom errors
  let errorName = error.name || '';

  // Try to extract the constructor name, which often contains the actual error type
  // This works better than error.name for many custom errors
  const constructorName = error.constructor?.name;
  if (constructorName && constructorName !== 'Error') {
    errorName = constructorName;
  }

  // Check if the error name indicates a bad request error
  if (errorName === 'BadRequestError') {
    return true;
  }

  // Check for specific patterns in the error message that indicate bad request
  return (
    errorMessage.includes(' 400') ||
    errorMessage.toLowerCase().includes('badrequest') ||
    errorMessage.includes('Invalid parameter') ||
    (errorMessage.includes('response_format') &&
      errorMessage.includes('json_schema') &&
      errorMessage.includes('not supported'))
  );
}

export function isAbortedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'AbortError' || error.message.includes('Aborted');
}

/**
 * Checks if an error is related to extension conflicts
 *
 * @param error - The error to check
 * @returns boolean indicating if it's an extension conflict error
 */
export function isExtensionConflictError(error: unknown): boolean {
  const errorMessage = (error instanceof Error ? error.message : String(error)).toLowerCase();

  return errorMessage.includes('cannot access a chrome-extension') && errorMessage.includes('of different extension');
}

export class RequestCancelledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RequestCancelledError';
  }
}

export class ExtensionConflictError extends Error {
  /**
   * Creates a new ExtensionConflictError
   *
   * @param message - The error message
   * @param cause - The original error that caused this error
   */
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ExtensionConflictError';

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ExtensionConflictError);
    }
  }

  /**
   * Returns a string representation of the error
   */
  toString(): string {
    return `${this.name}: ${this.message}${this.cause ? ` (Caused by: ${this.cause})` : ''}`;
  }
}

/**
 * Custom error class for when maximum execution steps are reached
 */
export class MaxStepsReachedError extends Error {
  /**
   * Creates a new MaxStepsReachedError
   *
   * @param message - The localized error message (should use t('exec_errors_maxStepsReached'))
   * @param cause - The original error that caused this error
   */
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'MaxStepsReachedError';

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MaxStepsReachedError);
    }
  }

  /**
   * Returns a string representation of the error
   */
  toString(): string {
    return `${this.name}: ${this.message}${this.cause ? ` (Caused by: ${this.cause})` : ''}`;
  }
}

/**
 * Custom error class for when maximum consecutive failures are reached
 */
export class MaxFailuresReachedError extends Error {
  /**
   * Creates a new MaxFailuresReachedError
   *
   * @param message - The localized error message (should use t('exec_errors_maxFailuresReached'))
   * @param cause - The original error that caused this error
   */
  constructor(
    message: string,
    p
```

### Core Architecture Module: `chrome-extension/src/background/agent/agents/navigator.ts`
```
import { z } from 'zod';
import { BaseAgent, type BaseAgentOptions, type ExtraAgentOptions } from './base';
import { createLogger } from '@src/background/log';
import { ActionResult, type AgentOutput } from '../types';
import type { Action } from '../actions/builder';
import { buildDynamicActionSchema } from '../actions/builder';
import { agentBrainSchema } from '../types';
import { type BaseMessage, HumanMessage } from '@langchain/core/messages';
import { Actors, ExecutionState } from '../event/types';
import {
  ChatModelAuthError,
  ChatModelBadRequestError,
  ChatModelForbiddenError,
  EXTENSION_CONFLICT_ERROR_MESSAGE,
  ExtensionConflictError,
  isAbortedError,
  isAuthenticationError,
  isBadRequestError,
  isExtensionConflictError,
  isForbiddenError,
  ResponseParseError,
  LLM_FORBIDDEN_ERROR_MESSAGE,
  RequestCancelledError,
} from './errors';
import { calcBranchPathHashSet } from '@src/background/browser/dom/views';
import { type BrowserState, BrowserStateHistory, URLNotAllowedError } from '@src/background/browser/views';
import { convertZodToJsonSchema, repairJsonString } from '@src/background/utils';
import { HistoryTreeProcessor } from '@src/background/browser/dom/history/service';
import { AgentStepRecord } from '../history';
import { type DOMHistoryElement } from '@src/background/browser/dom/history/view';

const logger = createLogger('NavigatorAgent');

interface ParsedModelOutput {
  current_state?: {
    next_goal?: string;
  };
  action?: (Record<string, unknown> | null)[] | null;
}

export class NavigatorActionRegistry {
  private actions: Record<string, Action> = {};

  constructor(actions: Action[]) {
    for (const action of actions) {
      this.registerAction(action);
    }
  }

  registerAction(action: Action): void {
    this.actions[action.name()] = action;
  }

  unregisterAction(name: string): void {
    delete this.actions[name];
  }

  getAction(name: string): Action | undefined {
    return this.actions[name];
  }

  setupModelOutputSchema(): z.ZodType {
    const actionSchema = buildDynamicActionSchema(Object.values(this.actions));
    return z.object({
      current_state: agentBrainSchema,
      action: z.array(actionSchema),
    });
  }
}

export interface NavigatorResult {
  done: boolean;
}

export class NavigatorAgent extends BaseAgent<z.ZodType, NavigatorResult> {
  private actionRegistry: NavigatorActionRegistry;
  private jsonSchema: Record<string, unknown>;
  private _stateHistory: BrowserStateHistory | null = null;

  constructor(
    actionRegistry: NavigatorActionRegistry,
    options: BaseAgentOptions,
    extraOptions?: Partial<ExtraAgentOptions>,
  ) {
    super(actionRegistry.setupModelOutputSchema(), options, { ...extraOptions, id: 'navigator' });

    this.actionRegistry = actionRegistry;

    // The zod object is too complex to be used directly, so we need to convert it to json schema first for the model to use
    this.jsonSchema = convertZodToJsonSchema(this.modelOutputSchema, 'NavigatorAgentOutput', true);
  }

  async invoke(inputMessages: BaseMessage[]): Promise<this['ModelOutput']> {
    // Use structured output
    if (this.withStructuredOutput) {
      const structuredLlm = this.chatLLM.withStructuredOutput(this.jsonSchema, {
        includeRaw: true,
        name: this.modelOutputToolName,
      });

      let response = undefined;
      try {
        response = await structuredLlm.invoke(inputMessages, {
          signal: this.context.controller.signal,
          ...this.callOptions,
        });

        if (response.parsed) {
          return response.parsed;
        }
      } catch (error) {
        if (isAbortedError(error)) {
          throw error;
        }

        // Try to extract JSON from markdown code blocks if parsing failed
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes('is not valid JSON') &&
          response?.raw?.content &&
          typeof response.raw.content === 'string'
        ) {
          const parsed = this.manuallyParseResponse(response.raw.content);
          if (parsed) {
            return parsed;
          }
        }
        throw new Error(`Failed to invoke ${this.modelName} with structured output: \n${errorMessage}`);
      }

      // Use type assertion to access the properties
      const rawResponse = response.raw as BaseMessage & {
        tool_calls?: Array<{
          args: {
            currentState: typeof agentBrainSchema._type;
            action: z.infer<ReturnType<typeof buildDynamicActionSchema>>;
          };
        }>;
      };

      // sometimes LLM returns an empty content, but with one or more tool calls, so we need to check the tool calls
      if (rawResponse.tool_calls && rawResponse.tool_calls.length > 0) {
        logger.info('Navigator structuredLlm tool call with empty content', rawResponse.tool_calls);
        // only use the first tool call
        const toolCall = rawResponse.tool_calls[0];
        return {
          current_state: toolCall.args.currentState,
          action: [...toolCall.args.action],
        };
      }
      throw new ResponseParseError('Could not parse navigator response');
    }

    // Fallback to parent class manual JSON extraction for models without structured output support
    return super.invoke(inputMessages);
  }

  async execute(): Promise<AgentOutput<NavigatorResult>> {
    const agentOutput: AgentOutput<NavigatorResult> = {
      id: this.id,
    };

    let cancelled = false;
    let modelOutputString: string | null = null;
    let browserStateHistory: BrowserStateHistory | null = null;
    let actionResults: ActionResult[] = [];

    try {
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.STEP_START, 'Navigating...');

      const messageManager = this.context.messageManager;
      // add the browser state message
      await this.addStateMessageToMemory();
      const currentState = await this.context.browserContext.getCachedState();
      browserStateHistory = new BrowserStateHistory(currentState);

      // check if the task is paused or stopped
      if (this.context.paused || this.context.stopped) {
        cancelled = true;
        return agentOutput;
      }

      // call the model to get the actions to take
      const inputMessages = messageManager.getMessages();
      // logger.info('Navigator input message', inputMessages[inputMessages.length - 1]);

      const modelOutput = await this.invoke(inputMessages);

      // check if the task is paused or stopped
      if (this.context.paused || this.context.stopped) {
        cancelled = true;
        return agentOutput;
      }

      const actions = this.fixActions(modelOutput);
      modelOutput.action = actions;
      modelOutputString = JSON.stringify(modelOutput);

      // remove the last state message from memory before adding the model output
      this.removeLastStateMessageFromMemory();
      this.addModelOutputToMemory(modelOutput);

      // take the actions
      actionResults = await this.doMultiAction(actions);
      // logger.info('Action results', JSON.stringify(actionResults, null, 2));

      this.context.actionResults = actionResults;

      // check if the task is paused or stopped
      if (this.context.paused || this.context.stopped) {
        cancelled = true;
        return agentOutput;
      }
      // emit event
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.STEP_OK, 'Navigation done');
      let done = false;
      if (actionResults.length > 0 && actionResults[actionResults.length - 1].isDone) {
        done = true;
      }
      agentOutput.result = { done };
      return agentOutput;
    } catch (error) {
      this.removeLastStateMessageFromMemory();
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Check if this is an authentication error
      if (isAuthenticationError(error)) {
        throw new ChatModelAuthError(errorMessage, error);
      } els
```

### Core Architecture Module: `chrome-extension/src/background/agent/agents/planner.ts`
```
import { BaseAgent, type BaseAgentOptions, type ExtraAgentOptions } from './base';
import { createLogger } from '@src/background/log';
import { z } from 'zod';
import type { AgentOutput } from '../types';
import { HumanMessage } from '@langchain/core/messages';
import { Actors, ExecutionState } from '../event/types';
import {
  ChatModelAuthError,
  ChatModelBadRequestError,
  ChatModelForbiddenError,
  isAbortedError,
  isAuthenticationError,
  isBadRequestError,
  isForbiddenError,
  LLM_FORBIDDEN_ERROR_MESSAGE,
  RequestCancelledError,
} from './errors';
import { filterExternalContent } from '../messages/utils';
const logger = createLogger('PlannerAgent');

// Define Zod schema for planner output
export const plannerOutputSchema = z.object({
  observation: z.string(),
  challenges: z.string(),
  done: z.union([
    z.boolean(),
    z.string().transform(val => {
      if (val.toLowerCase() === 'true') return true;
      if (val.toLowerCase() === 'false') return false;
      throw new Error('Invalid boolean string');
    }),
  ]),
  next_steps: z.string(),
  final_answer: z.string(),
  reasoning: z.string(),
  web_task: z.union([
    z.boolean(),
    z.string().transform(val => {
      if (val.toLowerCase() === 'true') return true;
      if (val.toLowerCase() === 'false') return false;
      throw new Error('Invalid boolean string');
    }),
  ]),
});

export type PlannerOutput = z.infer<typeof plannerOutputSchema>;

export class PlannerAgent extends BaseAgent<typeof plannerOutputSchema, PlannerOutput> {
  constructor(options: BaseAgentOptions, extraOptions?: Partial<ExtraAgentOptions>) {
    super(plannerOutputSchema, options, { ...extraOptions, id: 'planner' });
  }

  async execute(): Promise<AgentOutput<PlannerOutput>> {
    try {
      this.context.emitEvent(Actors.PLANNER, ExecutionState.STEP_START, 'Planning...');
      // get all messages from the message manager, state message should be the last one
      const messages = this.context.messageManager.getMessages();
      // Use full message history except the first one
      const plannerMessages = [this.prompt.getSystemMessage(), ...messages.slice(1)];

      // Remove images from last message if vision is not enabled for planner but vision is enabled
      if (!this.context.options.useVisionForPlanner && this.context.options.useVision) {
        const lastStateMessage = plannerMessages[plannerMessages.length - 1];
        let newMsg = '';

        if (Array.isArray(lastStateMessage.content)) {
          for (const msg of lastStateMessage.content) {
            if (msg.type === 'text') {
              newMsg += msg.text;
            }
            // Skip image_url messages
          }
        } else {
          newMsg = lastStateMessage.content;
        }

        plannerMessages[plannerMessages.length - 1] = new HumanMessage(newMsg);
      }

      const modelOutput = await this.invoke(plannerMessages);
      if (!modelOutput) {
        throw new Error('Failed to validate planner output');
      }

      // clean the model output
      const observation = filterExternalContent(modelOutput.observation);
      const final_answer = filterExternalContent(modelOutput.final_answer);
      const next_steps = filterExternalContent(modelOutput.next_steps);
      const challenges = filterExternalContent(modelOutput.challenges);
      const reasoning = filterExternalContent(modelOutput.reasoning);

      const cleanedPlan: PlannerOutput = {
        ...modelOutput,
        observation,
        challenges,
        reasoning,
        final_answer,
        next_steps,
      };

      // If task is done, emit the final answer; otherwise emit next steps
      const eventMessage = cleanedPlan.done ? cleanedPlan.final_answer : cleanedPlan.next_steps;
      this.context.emitEvent(Actors.PLANNER, ExecutionState.STEP_OK, eventMessage);
      logger.info('Planner output', JSON.stringify(cleanedPlan, null, 2));

      return {
        id: this.id,
        result: cleanedPlan,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Check if this is an authentication error
      if (isAuthenticationError(error)) {
        throw new ChatModelAuthError(errorMessage, error);
      } else if (isBadRequestError(error)) {
        throw new ChatModelBadRequestError(errorMessage, error);
      } else if (isAbortedError(error)) {
        throw new RequestCancelledError(errorMessage);
      } else if (isForbiddenError(error)) {
        throw new ChatModelForbiddenError(LLM_FORBIDDEN_ERROR_MESSAGE, error);
      }

      logger.error(`Planning failed: ${errorMessage}`);
      this.context.emitEvent(Actors.PLANNER, ExecutionState.STEP_FAIL, `Planning failed: ${errorMessage}`);
      return {
        id: this.id,
        error: errorMessage,
      };
    }
  }
}

```

### Core Architecture Module: `chrome-extension/src/background/agent/event/manager.ts`
```
import type { AgentEvent, EventType, EventCallback } from './types';
import { createLogger } from '../../log';

const logger = createLogger('event-manager');

export class EventManager {
  private _subscribers: Map<EventType, EventCallback[]>;

  constructor() {
    this._subscribers = new Map();
  }

  subscribe(eventType: EventType, callback: EventCallback): void {
    if (!this._subscribers.has(eventType)) {
      this._subscribers.set(eventType, []);
    }

    const callbacks = this._subscribers.get(eventType);
    if (callbacks && !callbacks.includes(callback)) {
      callbacks.push(callback);
    }
  }

  unsubscribe(eventType: EventType, callback: EventCallback): void {
    if (this._subscribers.has(eventType)) {
      const callbacks = this._subscribers.get(eventType);
      if (callbacks) {
        this._subscribers.set(
          eventType,
          callbacks.filter(cb => cb !== callback),
        );
      }
    }
  }

  clearSubscribers(eventType: EventType): void {
    if (this._subscribers.has(eventType)) {
      this._subscribers.set(eventType, []);
    }
  }

  async emit(event: AgentEvent): Promise<void> {
    const callbacks = this._subscribers.get(event.type);
    if (callbacks) {
      try {
        await Promise.all(callbacks.map(async callback => await callback(event)));
      } catch (error) {
        logger.error('Error executing event callbacks:', error);
      }
    }
  }
}

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

### Incident Patch 1: `e1f8984c` (2025-11-22)
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
 
   '@puppeteer/browser
```

---

### Incident Patch 2: `c8b3fd7a` (2025-11-20)
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

### Incident Patch 3: `c694577d` (2025-11-18)
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
-          logger.error(`[${this.modelN
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

---

### Incident Patch 4: `74b74f46` (2025-11-15)
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
-          logger.error(`[${this.modelN
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

### Incident Patch 5: `69d97d6f` (2025-11-09)
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

### Incident Patch 6: `08940657` (2025-11-01)
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

### Incident Patch 7: `499e9ddf` (2025-10-25)
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

### Incident Patch 8: `beb0146b` (2025-10-24)
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

### Incident Patch 9: `5c2dd009` (2025-10-06)
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

---

### Incident Patch 10: `a9bef035` (2025-10-06)
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
