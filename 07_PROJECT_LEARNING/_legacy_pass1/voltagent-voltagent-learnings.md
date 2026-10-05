# Forensic Learning Record (Deep Inspection): VoltAgent/voltagent

> **Canonical Artifact**: `07_PROJECT_LEARNING/voltagent-voltagent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/VoltAgent/voltagent](https://github.com/VoltAgent/voltagent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:34:09.137Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `VoltAgent/voltagent`
- **Description**: AI Agent Engineering Platform built on an Open Source TypeScript AI Agent Framework
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10706 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `archive/deprecated-providers/anthropic-ai/src/index.ts`
```
import Anthropic from "@anthropic-ai/sdk";
import { createAsyncIterableStream } from "@voltagent/core";
import type {
  BaseMessage,
  BaseTool,
  GenerateObjectOptions,
  GenerateTextOptions,
  LLMProvider,
  ProviderObjectResponse,
  ProviderObjectStreamResponse,
  ProviderTextResponse,
  ProviderTextStreamResponse,
  StreamObjectOptions,
  StreamTextOptions,
  VoltAgentError,
} from "@voltagent/core";
import type { z } from "zod";
import type {
  AnthropicMessage,
  AnthropicProviderOptions,
  AnthropicTool,
  AnthropicToolCall,
  StopMessageChunk,
} from "./types";
import {
  createResponseObject,
  createStepFromChunk,
  generateVoltError,
  getSystemMessage,
  handleStepFinish,
  processContent,
  processResponseContent,
  zodToJsonSchema,
} from "./utils";

// Deprecation warning
console.warn(
  "\x1b[33m⚠️  DEPRECATION WARNING: @voltagent/anthropic-ai is deprecated and will no longer receive updates.\x1b[0m\n" +
    "\x1b[33mPlease migrate to @ai-sdk/anthropic with @voltagent/vercel-ai instead.\x1b[0m\n" +
    "\x1b[36mMigration guide: https://voltagent.dev/docs/providers/anthropic-ai/\x1b[0m\n",
);

export class AnthropicProvider implements LLMProvider<string> {
  private anthropic: Anthropic;
  private model: string;

  constructor(options: AnthropicProviderOptions = {}) {
    //mock client for tests
    this.anthropic =
      options.client ?? new Anthropic({ apiKey: options.apiKey ?? process.env.ANTHROPIC_API_KEY });
    this.model = "claude-3-7-sonnet-20250219";

    this.getModelIdentifier = this.getModelIdentifier.bind(this);
    this.toMessage = this.toMessage.bind(this);
    this.toTool = this.toTool.bind(this);
    this.generateText = this.generateText.bind(this);
    this.streamText = this.streamText.bind(this);
    this.generateObject = this.generateObject.bind(this);
    this.streamObject = this.streamObject.bind(this);
  }

  getModelIdentifier(model: string): string {
    return model;
  }

  toMessage = (message: BaseMessage): AnthropicMessage | null => {
    // Special role handling
    if (message.role === "tool") {
      return {
        role: "assistant",
        content: String(message.content),
      };
    }
    if (message.role === "system") {
      return null;
    }

    const processedContent = processContent(message.content);

    return {
      role: message.role,
      content: processedContent,
    };
  };

  private getAnthropicMessages(messages: BaseMessage[]): AnthropicMessage[] {
    return messages.map(this.toMessage).filter((message) => message !== null);
  }

  toTool(tool: BaseTool): AnthropicTool {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: zodToJsonSchema(tool.parameters),
    };
  }

  async generateText(options: GenerateTextOptions<string>): Promise<ProviderTextResponse<any>> {
    try {
      const anthropicMessages = this.getAnthropicMessages(options.messages);
      const anthropicTools = options.tools ? options.tools.map(this.toTool) : undefined;

      const response = await this.anthropic.messages.create({
        messages: anthropicMessages,
        model: this.model,
        max_tokens: options.provider?.maxTokens ?? 1024,
        temperature: options.provider?.temperature ?? 0.7,
        top_p: options.provider?.topP,
        stop_sequences: options.provider?.stopSequences,
        stream: false,
        tools: anthropicTools,
        system: getSystemMessage(options.messages),
      });

      //Processes the response content
      const { responseText, toolCalls } = processResponseContent(response.content);

      //Handles onStepFinish
      await handleStepFinish(options, responseText, toolCalls, response.usage);

      return createResponseObject(response, responseText, toolCalls);
    } catch (error) {
      throw generateVoltError("Error while generating Text in Anthropic AI", error, "llm_generate");
    }
  }

  async streamText(options: StreamTextOptions<string>): Promise<ProviderTextStreamResponse<any>> {
    try {
      const anthropicMessages = this.getAnthropicMessages(options.messages);
      const anthropicTools = options.tools ? options.tools.map(this.toTool) : undefined;

      const { temperature = 0.7, maxTokens = 1024, topP, stopSequences } = options.provider || {};
      const response = await this.anthropic.messages.create({
        messages: anthropicMessages,
        model: options.model || this.model,
        max_tokens: maxTokens,
        temperature: temperature,
        top_p: topP,
        stop_sequences: stopSequences,
        stream: true,
        tools: anthropicTools,
        system: getSystemMessage(options.messages),
      });

      const textStream = createAsyncIterableStream(
        new ReadableStream({
          // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Stream handling requires complex logic
          start: async (controller) => {
            try {
              let currentText = "";
              const currentToolCalls: AnthropicToolCall[] = [];

              for await (const chunk of response) {
                if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
                  currentText += chunk.delta.text;

                  const textChunk = createStepFromChunk({
                    type: "text",
                    text: chunk.delta.text,
                    usage: undefined,
                  });

                  controller.enqueue(chunk.delta.text);

                  if (textChunk) {
                    if (options.onChunk) {
                      options.onChunk(textChunk);
                    }

                    if (options.onStepFinish) {
                      options.onStepFinish(textChunk);
                    }
                  }
                }

                if (
                  chunk.type === "content_block_start" &&
                  chunk.content_block?.type === "tool_use"
                ) {
                  const toolBlock = chunk.content_block;
                  const toolCall: AnthropicToolCall = {
                    type: "tool-call",
                    toolCallId: toolBlock.id,
                    toolName: toolBlock.name,
                    args: toolBlock.input || {},
                  };

                  currentToolCalls.push(toolCall);

                  // Handle onChunk callback for tool call
                  if (options?.onChunk) {
                    const step = createStepFromChunk(toolCall);
                    if (step) await options.onChunk(step);
                  }

                  // Handle onStepFinish for tool call
                  if (options.onStepFinish) {
                    const step = createStepFromChunk(toolCall);
                    if (step) await options.onStepFinish(step);
                  }
                }

                // Handle message completion
                if (chunk.type === "message_stop") {
                  const stopChunk = chunk as StopMessageChunk;
                  // Call onFinish with the final result
                  if (options.onFinish) {
                    const finalResult = {
                      text: currentText,
                      toolCalls: currentToolCalls.map((call) => ({
                        usage: stopChunk?.message?.usage,
                        ...call,
                      })),
                      toolResults: [],
                      finishReason: "stop",
                    };

                    await options.onFinish(finalResult);
                  }

                  // Close the stream
                  controller.close();
                }
              }
            } catch (error) {
              const voltError = generateVoltError(
                "Error while parsing streamed text response from Anthropic API",
                error,
                "llm_stream",
              );
              if (options.onError) {
                options.onError(voltError);
              }
              controller.erro
```

### Core Architecture Module: `archive/deprecated-providers/anthropic-ai/src/types.ts`
```
import type { Message } from "@anthropic-ai/sdk/resources/messages";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

export interface AnthropicProviderOptions {
  apiKey?: string;
  client?: any;
}

export interface AnthropicToolCall {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
}

export interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    [k: string]: unknown;
  };
}

// Use Anthropic SDK types directly
export type AnthropicMessage = MessageParam;

export interface StopMessageChunk {
  type: "message_stop";
  message: Message;
}

```

### Core Architecture Module: `archive/deprecated-providers/anthropic-ai/src/utils/index.ts`
```
import type { AnthropicToolCall } from "@/types";
import { APIError } from "@anthropic-ai/sdk";
import type { ContentBlock, Message, Usage } from "@anthropic-ai/sdk/resources/messages";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import type {
  BaseMessage,
  GenerateTextOptions,
  MessageRole,
  ProviderTextResponse,
  StepWithContent,
  VoltAgentError,
} from "@voltagent/core";
import { z } from "zod";

/**
 * Processes text content into a text content block
 * @param {string} text - The text content to process
 * @returns {ContentBlockParam} A content block with type "text"
 */
export function processTextContent(text: string): ContentBlockParam {
  return {
    type: "text",
    text,
  };
}

/**
 * Processes image content into an image content block
 * @param {any} image - The image content to process (URL, data URI, or base64 string)
 * @param {string} [mimeType] - Optional MIME type for the image
 * @returns {ContentBlockParam|null} A content block with type "image" or null if format is unsupported
 */
export function processImageContent(image: any, mimeType?: string): ContentBlockParam | null {
  // Handle URL objects
  if (image instanceof URL) {
    return {
      type: "image",
      source: {
        type: "url",
        url: image.toString(),
      },
    };
  }

  // Handle string-type image data
  if (typeof image === "string") {
    return processStringImage(image, mimeType);
  }

  console.warn("Unsupported image format in AnthropicProvider");
  return null;
}

/**
 * Processes string-format image data (base64 or data URI)
 * @param {string} image - The image string (either data URI or base64)
 * @param {string} [mimeType] - Optional MIME type for the image, used when image is direct base64
 * @returns {ContentBlockParam|null} A content block with type "image" or null if format is invalid
 */
export function processStringImage(image: string, mimeType?: string): ContentBlockParam | null {
  // Parse data URI
  if (image.startsWith("data:")) {
    const matches = image.match(/^data:([^;]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const mediaType = matches[1];
      const data = matches[2];

      return createImageBlock(mediaType, data);
    }
    console.warn("Invalid data URI format in AnthropicProvider");
    return null;
  }

  // Handle base64 string
  const mediaType = mimeType || "image/jpeg";
  return createImageBlock(mediaType, image);
}

/**
 * Creates an image block with the given media type and data
 * @param {string} mediaType - The MIME type of the image (e.g., image/jpeg)
 * @param {string} data - The base64 encoded image data
 * @returns {ContentBlockParam|null} A content block with type "image" or null if media type is unsupported
 */
export function createImageBlock(mediaType: string, data: string): ContentBlockParam | null {
  if (isSupportedImageType(mediaType)) {
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data,
      },
    };
  }
  console.warn(`Unsupported image format in AnthropicProvider: ${mediaType}`);
  return null;
}

/**
 * Processes file content into a text content block
 * @param {any} file - The file object with filename and mimeType properties
 * @returns {ContentBlockParam} A content block with type "text" describing the file
 */
export function processFileContent(file: any): ContentBlockParam {
  const filename = file.filename || "unnamed";
  const mimeType = file.mimeType || "application/octet-stream";

  return {
    type: "text",
    text: `[File: ${filename} (${mimeType})]`,
  };
}

/**
 * Checks if the given media type is supported by Anthropic's API
 * @param {string} mediaType - The MIME type to check
 * @returns {boolean} True if the media type is supported, false otherwise
 */
export function isSupportedImageType(mediaType: string): boolean {
  return ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mediaType);
}

/**
 * Processes any content type into Anthropic's content format
 * @param {any} content - The content to process (string, array, or other)
 * @returns {ContentBlockParam[]|string} Array of content blocks or string depending on input
 */
export function processContent(content: any): ContentBlockParam[] | string {
  // Handle string content
  if (typeof content === "string") {
    return content;
  }

  // Handle array content (multimodal)
  if (Array.isArray(content)) {
    const contentBlocks: ContentBlockParam[] = [];

    for (const part of content) {
      const block = processContentPart(part);
      if (block) {
        contentBlocks.push(block);
      }
    }

    return contentBlocks;
  }

  // Fallback for any other content format
  return String(content);
}

/**
 * Processes a single content part into an appropriate content block
 * @param {any} part - The content part object with type and data
 * @returns {ContentBlockParam|null} A content block of appropriate type or null if unsupported
 */
export function processContentPart(part: any): ContentBlockParam | null {
  if (part.type === "text") {
    return processTextContent(part.text);
  }

  if (part.type === "image") {
    return processImageContent(part.image, part.mimeType);
  }

  if (part.type === "file") {
    return processFileContent(part);
  }

  return null;
}

/**
 * Converts a Zod schema to JSON Schema format that Anthropic expects
 * @param {z.ZodType<any>} schema - The Zod schema to convert
 * @returns {Object} A JSON Schema object with type, properties, and required fields
 * @throws {Error} If the schema is not a Zod object
 */
export function zodToJsonSchema(schema: z.ZodType<any>): {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
} {
  // Check if it's a ZodObject by checking for the typeName property
  if (
    schema &&
    typeof schema === "object" &&
    "_def" in schema &&
    schema._def &&
    typeof schema._def === "object" &&
    "typeName" in schema._def &&
    schema._def.typeName === "ZodObject"
  ) {
    // Use a safer type assertion approach
    const def = schema._def as unknown as { shape: () => Record<string, z.ZodTypeAny> };
    const shape = def.shape();
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const fieldSchema = convertZodField(value as z.ZodTypeAny);
      properties[key] = fieldSchema;

      // Check if the field is required
      if (!(value instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    return {
      type: "object" as const,
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  throw new Error("Root schema must be a Zod object");
}

/**
 * Helper function to create a base schema with type and optional description
 * @param {z.ZodType} field - The Zod field to extract description from
 * @param {string} type - The type string to use
 * @returns {Object} Schema object with type and optional description
 */
function getBaseSchema(field: z.ZodType, type: string) {
  return {
    type,
    ...(field.description ? { description: field.description } : {}),
  };
}

/**
 * Helper function to handle primitive type fields
 * @param {z.ZodTypeAny} field - The Zod field to process
 * @param {string} type - The type string to use
 * @returns {Object} Schema object with type and optional description
 */
function handlePrimitiveType(field: z.ZodTypeAny, type: string) {
  return getBaseSchema(field, type);
}

/**
 * Converts a Zod field to a JSON Schema field
 * @param {z.ZodTypeAny} zodField - The Zod field to convert
 * @returns {any} The JSON Schema representation of the field
 */
export function convertZodField(zodField: z.ZodTypeAny): any {
  if (zodField instanceof z.ZodString) {
    return handlePrimitiveType(zodField, "string");
  }
  if (zodField instanceof z.ZodNumber) {
    return h
```

### Core Architecture Module: `archive/deprecated-providers/anthropic-ai/tsup.config.ts`
```
import { defineConfig } from "tsup";
import { markAsExternalPlugin } from "../shared/tsup-plugins/mark-as-external";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  splitting: false,
  sourcemap: true,
  clean: false,
  target: "es2022",
  outDir: "dist",
  minify: false,
  dts: true,
  esbuildPlugins: [markAsExternalPlugin],
  esbuildOptions(options) {
    options.keepNames = true;
    return options;
  },
});

```

### Core Architecture Module: `archive/deprecated-providers/google-ai/src/index.ts`
```
import {
  type Content,
  type FunctionCall,
  type FunctionResponse,
  type GenerateContentConfig,
  type GenerateContentParameters,
  type GenerateContentResponse,
  type GenerateContentResponseUsageMetadata,
  GoogleGenAI,
  type GoogleGenAIOptions,
  type Part,
  type Schema,
  createPartFromFunctionResponse,
} from "@google/genai";
import type {
  BaseMessage,
  BaseTool,
  GenerateObjectOptions,
  LLMProvider,
  MessageRole,
  ProviderObjectResponse,
  ProviderTextStreamResponse,
  StepWithContent,
  UsageInfo,
} from "@voltagent/core";
import { createAsyncIterableStream } from "@voltagent/core";
import type { z } from "zod";
import type {
  GoogleGenerateContentStreamResult,
  GoogleGenerateTextOptions,
  GoogleProviderRuntimeOptions,
  GoogleProviderTextResponse,
  GoogleStreamTextOptions,
} from "./types";
import { executeFunctionCalls, prepareToolsForGoogleSDK } from "./utils/function-calling";
import { isZodObject, responseSchemaFromZodType } from "./utils/schema_helper";

// Deprecation warning
console.warn(
  "\x1b[33m⚠️  DEPRECATION WARNING: @voltagent/google-ai is deprecated and will no longer receive updates.\x1b[0m\n" +
    "\x1b[33mPlease migrate to @ai-sdk/google with @voltagent/vercel-ai instead.\x1b[0m\n" +
    "\x1b[36mMigration guide: https://voltagent.dev/docs/providers/google-ai/\x1b[0m\n",
);

type StreamProcessingState = {
  accumulatedText: string;
  finalUsage?: UsageInfo;
  finalFinishReason?: string;
};
export class GoogleGenAIProvider implements LLMProvider<string> {
  private ai: GoogleGenAI;
  private isVertexAI: boolean;

  constructor(options: GoogleGenAIOptions) {
    const apiKey = options?.apiKey || process.env.GEMINI_API_KEY;
    const hasApiKey = !!apiKey;
    const hasVertexAIConfig = !!(options.vertexai && options.project && options.location);

    if (!hasApiKey && !hasVertexAIConfig) {
      throw new Error(
        "Google GenAI API key is required, or if using Vertex AI, both project and location must be specified.",
      );
    }

    if (hasApiKey && hasVertexAIConfig) {
      throw new Error(
        "Google GenAI API key and Vertex AI project/location cannot both be provided.",
      );
    }

    this.isVertexAI = hasVertexAIConfig;
    this.ai = new GoogleGenAI({ ...options, apiKey });

    this.generateText = this.generateText.bind(this);
    this.streamText = this.streamText.bind(this);
    this.toMessage = this.toMessage.bind(this);
    this._createStepFromChunk = this._createStepFromChunk.bind(this);
    this.getModelIdentifier = this.getModelIdentifier.bind(this);
    this._getUsageInfo = this._getUsageInfo.bind(this);
    this._processStreamChunk = this._processStreamChunk.bind(this);
    this._finalizeStream = this._finalizeStream.bind(this);
    this.generateObject = this.generateObject.bind(this);
    this._handleFunctionCalling = this._handleFunctionCalling.bind(this);
  }

  getModelIdentifier = (model: string): string => {
    return model;
  };

  private toGoogleRole(role: MessageRole): "user" | "model" {
    switch (role) {
      case "user":
        return "user";
      case "assistant":
        return "model";
      case "system":
        console.warn(`System role conversion might require specific handling. Mapping to 'model'.`);
        return "model";
      case "tool":
        console.warn(
          `Tool role conversion to Google GenAI format is complex. Mapping to 'model' as placeholder.`,
        );
        return "model";
      default:
        console.warn(`Unsupported role conversion for: ${role}. Defaulting to 'user'.`);
        return "user";
    }
  }

  toMessage = (message: BaseMessage): Content => {
    const role = this.toGoogleRole(message.role);

    // Validate role early, applicable to all content types
    if (role !== "user" && role !== "model") {
      throw new Error(
        `Invalid role '${role}' passed to toMessage. Expected 'user' or 'model' for Google GenAI. Original role: ${message.role}.`,
      );
    }

    if (typeof message.content === "string") {
      // Handle string content
      return { role, parts: [{ text: message.content }] };
    }

    if (Array.isArray(message.content)) {
      // Handle array of content parts
      const parts: Part[] = message.content
        .map((part): Part | null => {
          if (part.type === "text" && typeof part.text === "string") {
            return { text: part.text };
          }
          if (
            part.type === "image" &&
            part.image &&
            part.mimeType &&
            typeof part.image === "string" &&
            typeof part.mimeType === "string"
          ) {
            // Google expects inlineData with base64 string and mimeType
            const base64Data = part.image.startsWith("data:")
              ? part.image.split(",")[1] // Extract base64 data from data URI
              : part.image; // Assume it's already base64 if not a data URI
            return {
              inlineData: {
                data: base64Data,
                mimeType: part.mimeType,
              },
            };
          }
          console.warn(
            `[GoogleGenAIProvider] Unsupported part type in array: ${part.type}. Skipping.`,
          );
          return null;
        })
        .filter((part): part is Part => part !== null);

      if (parts.length === 0) {
        console.warn(
          `[GoogleGenAIProvider] Message content array resulted in zero valid parts. Role: ${role}. Original content:`,
          message.content,
        );
        // Return an empty text part to avoid errors, although this might not be ideal.
        return { role, parts: [{ text: "" }] };
      }

      return { role, parts };
    }

    // Fallback if content is neither string nor array (or unsupported single object)
    console.warn(
      `[GoogleGenAIProvider] Unsupported content type: ${typeof message.content}. Falling back to empty content.`,
    );
    return { role, parts: [{ text: "" }] };
  };

  private _createStepFromChunk = (chunk: {
    type: string;
    [key: string]: any;
  }): StepWithContent | null => {
    if (chunk.type === "text" && chunk.text) {
      return {
        id: chunk.responseId || "",
        type: "text",
        content: chunk.text,
        role: "assistant" as MessageRole,
        usage: chunk.usage || undefined,
      };
    }

    if (chunk.type === "tool-call" || chunk.type === "tool_call") {
      return {
        id: chunk.toolCallId,
        type: "tool_call",
        name: chunk.toolName,
        arguments: chunk.args,
        content: JSON.stringify([
          {
            type: "tool-call",
            toolCallId: chunk.toolCallId,
            toolName: chunk.toolName,
            args: chunk.args,
          },
        ]),
        role: "assistant" as MessageRole,
        usage: chunk.usage || undefined,
      };
    }

    if (chunk.type === "tool-result" || chunk.type === "tool_result") {
      return {
        id: chunk.toolCallId,
        type: "tool_result",
        name: chunk.toolName,
        result: chunk.result,
        content: JSON.stringify([
          {
            type: "tool-result",
            toolCallId: chunk.toolCallId,
            toolName: chunk.toolName,
            result: chunk.result,
          },
        ]),
        role: "assistant" as MessageRole,
        usage: chunk.usage || undefined,
      };
    }

    return null;
  };

  private _getUsageInfo(
    usageInfo: GenerateContentResponseUsageMetadata | undefined,
  ): UsageInfo | undefined {
    if (!usageInfo) return undefined;

    const promptTokens = usageInfo.promptTokenCount ?? 0;
    const completionTokens = usageInfo.candidatesTokenCount ?? 0;
    const totalTokens = usageInfo.totalTokenCount ?? 0;

    if (promptTokens > 0 || completionTokens > 0 || totalTokens > 0) {
      return { promptTokens, completionTokens, totalTokens };
    }

    return undefined;
  }

  private async _handleFunctionCalling(
    initialResponse: GenerateContentResponse,
    functi
```

### Core Architecture Module: `archive/deprecated-providers/google-ai/src/types.ts`
```
import type {
  FunctionCall,
  FunctionResponse,
  GenerateContentConfig,
  GenerateContentResponse,
  Tool,
  ToolConfig,
} from "@google/genai";
import type { BaseMessage, BaseTool, ProviderTextResponse, StepWithContent } from "@voltagent/core";

// Define explicit runtime options to avoid deep generic instantiation
export interface GoogleProviderRuntimeOptions
  extends Pick<
    GenerateContentConfig,
    "temperature" | "topP" | "stopSequences" | "seed" | "presencePenalty" | "frequencyPenalty"
  > {
  extraOptions?: Record<string, any>;
  [key: string]: any;
}

// Tool configuration types based on Google's GenAI SDK
export interface GoogleToolConfig extends ToolConfig {}
export interface GoogleTool extends Tool {}

// Define concrete types instead of using Omit with generics since it was causing
// "Type instantiation is excessively deep and possibly infinite".
type BaseGoogleTextOptions = {
  messages: BaseMessage[];
  model: string;
  provider?: GoogleProviderRuntimeOptions;
  tools?: BaseTool[];
  maxSteps?: number;
  onStepFinish?: (step: StepWithContent) => void | Promise<void>;
  signal?: AbortSignal;
};

export type GoogleGenerateTextOptions = BaseGoogleTextOptions;

export type GoogleStreamTextOptions = BaseGoogleTextOptions & {
  tools?: BaseTool[];
  onChunk?: (chunk: any) => void | Promise<void>;
  onFinish?: (result: { text: string }) => void | Promise<void>;
  onError?: (error: any) => void | Promise<void>;
};

export type GoogleProviderTextResponse = ProviderTextResponse<GenerateContentResponse> & {
  toolCalls?: FunctionCall[];
  toolResults?: FunctionResponse[];
};

export type GoogleGenerateContentStreamResult = AsyncGenerator<
  GenerateContentResponse,
  GenerateContentResponse,
  unknown
>;

```

### Core Architecture Module: `archive/deprecated-providers/google-ai/src/utils/function-calling.ts`
```
import { FunctionCallingConfigMode } from "@google/genai";
import type { FunctionCall, FunctionDeclaration, FunctionResponse } from "@google/genai";
import type { BaseTool } from "@voltagent/core";
import { z } from "zod";
import type { GoogleTool, GoogleToolConfig } from "../types";
import { type ZodFunction, functionDeclarationFromZodFunction } from "./schema_helper";

/**
 * Creates a default tool configuration
 */
export function createDefaultToolConfig(): GoogleToolConfig {
  return {
    functionCallingConfig: {
      // Let the model decide whether to call a function or not
      mode: FunctionCallingConfigMode.AUTO,
    },
  };
}

/**
 * Converts tools using functionDeclarationFromZodFunction and creates tool configuration for Google's GenAI.
 */
export function prepareToolsForGoogleSDK(
  tools: BaseTool[],
  vertexai = false,
): {
  tools: GoogleTool;
  toolConfig: GoogleToolConfig;
} {
  const functionDeclarations: FunctionDeclaration[] = tools.map((tool) => {
    const paramsSchema = tool.parameters;

    const zodFunctionSchema = z
      .function()
      .args(paramsSchema) // functionDeclarationFromZodFunction expects a single ZodObject or ZodVoid for parameters
      .returns(z.void()) // Assuming tools don't have a defined return schema in this context or it's void
      .describe(tool.description);

    const zodFunctionInput: ZodFunction = {
      name: tool.name,
      zodFunctionSchema: zodFunctionSchema,
    };

    // Utility function to convert ZodFunction to FunctionDeclaration from Google AI SDK
    return functionDeclarationFromZodFunction(vertexai, zodFunctionInput);
  });

  return {
    tools: { functionDeclarations },
    toolConfig: createDefaultToolConfig(),
  };
}

/**
 * Executes a list of function calls requested by the model using the provided tools.
 * Supports parallel execution of tool calls.
 *
 * @param functionCalls - Array of FunctionCall objects from the Gemini API response.
 * @param tools - Array of BaseTool objects available for execution.
 * @returns A Promise that resolves to an array of FunctionResponse objects.
 */
export async function executeFunctionCalls(
  functionCalls: FunctionCall[],
  tools: BaseTool[],
): Promise<FunctionResponse[]> {
  // Create an array of promises for each function call execution
  const executionPromises = functionCalls.map(async (functionCall) => {
    const { name, args } = functionCall;
    const id = functionCall.id || name;

    // Ensure required fields are present
    if (!name) {
      console.error("Function call is missing required 'name' field:", functionCall);
      // Returning a FunctionResponse indicating an error might be complex as 'id' is also needed.
      // Throwing might be better, or logging and skipping. Let's log and construct a minimal error response if possible.
      return {
        id: id || `error-${Date.now()}`, // Generate a placeholder ID if missing
        name: name || "unknown", // Use 'unknown' if name is missing
        response: { error: "Function call is missing required 'name' field." },
      };
    }
    if (!id) {
      console.error("Function call is missing required 'id' field:", functionCall);
      return {
        id: `error-${Date.now()}`, // Generate a placeholder ID
        name: name,
        response: { error: "Function call is missing required 'id' field." },
      };
    }

    const tool = tools.find((t) => t.name === name);
    if (!tool) {
      console.error(`Tool with name "${name}" not found.`);
      return {
        id: id,
        name: name,
        response: { error: `Tool with name "${name}" not found.` },
      };
    }

    // Execute the tool
    try {
      const result = await tool.execute(args || {}); // Pass args or an empty object

      // Format the success response
      return {
        id: id,
        name: name,
        response: { output: result },
      };
    } catch (error) {
      console.error(`[GoogleGenAIProvider] Error executing tool "${name}":`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        id: id,
        name: name,
        response: { error: errorMessage },
      };
    }
  });

  // Wait for all tool executions to complete
  const responses = await Promise.all(executionPromises);

  return responses;
}

```

### Core Architecture Module: `archive/deprecated-providers/google-ai/src/utils/schema_helper.ts`
```
import { type ZodObject, type ZodRawShape, z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { type FunctionDeclaration, type Schema, Type } from "@google/genai";

/**
 * Copied over from google-ai repo https://github.com/googleapis/js-genai/blob/main/src/schema_helper.ts
 * This was done because the schema_helper.ts file is not exported from the google-ai package.
 * https://github.com/googleapis/js-genai/blob/main/src/schema_helper.ts
 */

/**
 * A placeholder name for the zod schema when converting to JSON schema. The
 * name is not important and will not be used by users.
 */
const PLACEHOLDER_ZOD_SCHEMA_NAME = "placeholderZodSchemaName";

/**
 * Represents the possible JSON schema types.
 */
export type JSONSchemaType =
  | "string"
  | "number"
  | "integer"
  | "object"
  | "array"
  | "boolean"
  | "null";

/**
 * A subset of JSON Schema according to 2020-12 JSON Schema draft.
 *
 * Represents a subset of a JSON Schema object that can be used by Gemini API.
 * The difference between this interface and the Schema interface is that this
 * interface is compatible with OpenAPI 3.1 schema objects while the
 * types.Schema interface @see {@linkcode Schema} is used to make API call to
 * Gemini API.
 */
export interface JSONSchema {
  /**
   * Validation succeeds if the type of the instance matches the type
   * represented by the given type, or matches at least one of the given types
   * in the array.
   */
  type?: JSONSchemaType | JSONSchemaType[];

  /**
   * Defines semantic information about a string instance (e.g., "date-time",
   * "email").
   */
  format?: string;

  /**
   * A preferably short description about the purpose of the instance
   * described by the schema. This is not supported for Gemini API.
   */
  title?: string;

  /**
   * An explanation about the purpose of the instance described by the
   * schema.
   */
  description?: string;

  /**
   * This keyword can be used to supply a default JSON value associated
   * with a particular schema. The value should be valid according to the
   * schema. This is not supported for Gemini API.
   */
  default?: unknown;

  /**
   * Used for arrays. This keyword is used to define the schema of the elements
   * in the array.
   */
  items?: JSONSchema;

  /**
   * Key word for arrays. Specify the minimum number of elements in the array.
   */
  minItems?: string;

  /**
   * Key word for arrays. Specify the maximum number of elements in the array.e
   */
  maxItems?: string;

  /**
   * Used for specify the possible values for an enum.
   */
  enum?: unknown[];

  /**
   * Used for objects. This keyword is used to define the schema of the
   * properties in the object.
   */
  properties?: Record<string, JSONSchema>;

  /**
   * Used for objects. This keyword is used to specify the properties of the
   * object that are required to be present in the instance.
   */
  required?: string[];

  /**
   * The key word for objects. Specify the minimum number of properties in the
   * object.
   */
  minProperties?: string;

  /**
   * The key word for objects. Specify the maximum number of properties in the
   * object.
   */
  maxProperties?: string;

  /**
   * Used for numbers. Specify the minimum value for a number.
   */
  minimum?: number;

  /**
   * Used for numbers. specify the maximum value for a number.
   */
  maximum?: number;

  /**
   * Used for strings. The keyword to specify the minimum length of the
   * string.
   */
  minLength?: string;

  /**
   * Used for strings. The keyword to specify the maximum length of the
   * string.
   */
  maxLength?: string;

  /**
   * Used for strings. Key word to specify a regular
   * expression (ECMA-262) matches the instance successfully.
   */
  pattern?: string;

  /**
   * Used for Union types and Intersection types. This keyword is used to define
   * the schema of the possible values.
   */
  anyOf?: JSONSchema[];
}

const jsonSchemaTypeValidator = z.enum([
  "string",
  "number",
  "integer",
  "object",
  "array",
  "boolean",
  "null",
]);

// Handles all types and arrays of all types.
const schemaTypeUnion = z.union([jsonSchemaTypeValidator, z.array(jsonSchemaTypeValidator)]);

// Declare the type for the schema variable.
type jsonSchemaValidatorType = z.ZodType<JSONSchema>;

const jsonSchemaValidator: jsonSchemaValidatorType = z.lazy(() => {
  return z
    .object({
      // --- Type ---
      type: schemaTypeUnion.optional(),

      // --- Annotations ---
      format: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      default: z.unknown().optional(),

      // --- Array Validations ---
      items: jsonSchemaValidator.optional(),
      minItems: z.coerce.string().optional(),
      maxItems: z.coerce.string().optional(),
      // --- Generic Validations ---
      enum: z.array(z.unknown()).optional(),

      // --- Object Validations ---
      properties: z.record(z.string(), jsonSchemaValidator).optional(),
      required: z.array(z.string()).optional(),
      minProperties: z.coerce.string().optional(),
      maxProperties: z.coerce.string().optional(),

      // --- Numeric Validations ---
      minimum: z.number().optional(),
      maximum: z.number().optional(),

      // --- String Validations ---
      minLength: z.coerce.string().optional(),
      maxLength: z.coerce.string().optional(),
      pattern: z.string().optional(),

      // --- Schema Composition ---
      anyOf: z.array(jsonSchemaValidator).optional(),

      // --- Additional Properties --- This field is not included in the
      // JSONSchema, will not be communicated to the model, it is here purely
      // for enabling the zod validation strict mode.
      additionalProperties: z.union([z.boolean(), z.object({})]).optional(),
    })
    .strict();
});

/**
 * Converts a Zod object into the Gemini schema format.
 *
 * @param vertexai If true, targets Vertex AI schema format; otherwise, targets
 * the Gemini API format.
 * @param zodSchema The Zod schema object to convert. Its structure is validated
 * against the interface before conversion to JSONSchema
 * schema.
 * @return The resulting Schema object.
 * @throws If the input `zodSchema` does not conform to the expected
 * JSONSchema structure during the initial validation step.
 */
export function responseSchemaFromZodType(vertexai: boolean, zodSchema: z.ZodType): Schema {
  return processZodSchema(vertexai, zodSchema);
}

function processZodSchema(vertexai: boolean, zodSchema: z.ZodType): Schema {
  const jsonSchema = zodToJsonSchema(zodSchema, PLACEHOLDER_ZOD_SCHEMA_NAME).definitions?.[
    PLACEHOLDER_ZOD_SCHEMA_NAME
  ] as Record<string, unknown>;
  const validatedJsonSchema = jsonSchemaValidator.parse(jsonSchema);
  return processJsonSchema(vertexai, validatedJsonSchema);
}

/*
Handle type field:
The resulted type field in JSONSchema form zod_to_json_schema can be either
an array consist of primitive types or a single primitive type.
This is due to the optimization of zod_to_json_schema, when the types in the
union are primitive types without any additional specifications,
zod_to_json_schema will squash the types into an array instead of put them
in anyOf fields. Otherwise, it will put the types in anyOf fields.
See the following link for more details:
https://github.com/zodjs/zod-to-json-schema/blob/main/src/index.ts#L101
The logic here is trying to undo that optimization, flattening the array of
types to anyOf fields.
                                 type field
                                      |
                            ___________________________
                           /                           \
                          /                              \
                         /                                \
                       Array                              Type.*
                /                  \                       |
      Include null.              Not included null     t
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1252** (2026-04-28): **[BUG] auto-index doesn't work for tenant aware filesystem**
  *Symptoms*: ### Describe the bug  ``` [2026-04-27T03:19:07.383Z] before WorkspaceSearch with autoIndexPaths [2026-04-27T03:19:07.384Z] backend factory called { conversationId: undefined } [2026-04-27T03:19:07.384Z] tenant filesystem factory error Tenant filesystem requires operationContext.conversationId [2026-04-27T03:19:07.384Z] after WorkspaceSearch with autoIndexPaths [2026-04-27T03:19:08.386Z] search with conversationId=conv-a after failed auto-index [2026-04-27T03:19:08.386Z] search results after auto-index [] [2026-04-27T03:19:08.386Z] manual index with conversationId=conv-a [2026-04-27T03:19:08.386Z] backend factory called { conversationId: "conv-a" } [2026-04-27T03:19:08.386Z] conv-a.globInfo { pattern: "**/*.ts", path: "/workspace" } [2026-04-27T03:19:08.387Z] backend factory called { conversationId: "conv-a" } [2026-04-27T03:19:08.387Z] conv-a.readRaw { filePath: "/workspace/a.ts" } [2026-04-27T03:19:08.388Z] manual index summary { indexed: 1, vectorIndexed: undefined, skipped: 0, errors: [] } [2026-04-27T03:19:08.388Z] search results after manual tenant index [   {     path: "/workspace/a.ts",     content: "export const tenant = 'a';\nexport const value = 1;"   } ] [2026-04-27T03:19:08.388Z] done ```  ### Steps To Reproduce  ```ts import { 	InMemoryFilesystemBackend, 	Workspace, 	WorkspaceSearch, } from "npm:@voltagent/core";  type FileData = { 	content: string[]; 	created_at: string; 	modified_at: string; };  type OperationContextLike = { 	conversationId?: string; };  type F
  **Post-Mortem & Fix Analysis**:
  > Hi @diluka-pietra, thanks for the clear repro and logs.  I reproduced the tenant-aware filesystem auto-index issue locally and opened a fix in #1257. The fix makes workspace search auto-index retry with the operation context, so tenant-scoped filesystems can index correctly when `conversationId` is available.  We plan to include this in an upcoming release soon.

- **Issue #1242** (2026-04-25): **[BUG] global settings doesn't apply to agents which get from voltagent**
  *Symptoms*: ### Describe the bug  ``` Agent response: Here’s what I have in this session:  Tools/capabilities - Text generation and reasoning - Image understanding (you can send images/screenshots) - No web browsing - No code execution or terminal - No direct filesystem/workspace access - No external plugins or APIs  Files in the workspace - None visible. I don’t have a workspace or access to your files by default. I can only see files you upload or paste here.  If you meant a specific environment (e.g., a repo, Jupyter, or a remote workspace), please share a directory listing or grant access, and I can help list and describe the files. ```  ### Steps To Reproduce  ```ts import {   VoltAgent,   Workspace,   Agent,   InMemoryVectorAdapter,   InMemoryFilesystemBackend, } from 'npm:@voltagent/core';  const volt = new VoltAgent({   agents: {     agent: new Agent({       name: 'MyAgent',       instructions: '',       model: 'openai/gpt-5',     }),   },   workspace: new Workspace({     filesystem: {       backend: new InMemoryFilesystemBackend(         {           '/workspace/example.md': {             content: [               '# Example Markdown File',               'This is an example markdown file in the workspace.',             ],             created_at: new Date().toISOString(),             modified_at: new Date().toISOString(),           },         },         new Set(['/workspace']),       ),     },     search: {       autoIndexPaths: [{ path: '/workspace', glob: '**/*.{md,ts,js,py}' }],
  **Post-Mortem & Fix Analysis**:
  > Thanks for the clear report and repro, @diluka-pietra.  I was able to reproduce the `getAgent` path and opened a fix here: #1245.  The fix registers agents synchronously during `VoltAgent` construction, so agents retrieved with `volt.getAgent(...)` immediately inherit global workspace settings and tools. I also verified the LLM path from your example: the agent now lists workspace files/tools instead of saying it has no workspace access.  We plan to include this in an upcoming patch release soon.

- **Issue #1238** (2026-04-25): **[BUG] custom routes logging mistake**
  *Symptoms*: ### Describe the bug  ``` ══════════════════════════════════════════════════   VOLTAGENT SERVER STARTED SUCCESSFULLY ══════════════════════════════════════════════════   ✓ HTTP Server:  http://localhost:3141   ↪ Share it:    pnpm volt tunnel 3141 (secure HTTPS tunnel for teammates)   ↪ Deploy it:   https://console.voltagent.dev/deployments   ✓ Swagger UI:   http://localhost:3141/ui    ✓ Registered Endpoints: 2 total      Custom Endpoints (2)       GET    /api/api/hello    Test your agents with VoltOps Console: https://console.voltagent.dev ══════════════════════════════════════════════════ request to /api/hello Hello, World! request to /api/api/hello 404 Not Found ```  ### Steps To Reproduce  ```ts import { setTimeout } from 'node:timers/promises'; import { VoltAgent } from 'npm:@voltagent/core'; import { honoServer } from 'npm:@voltagent/server-hono'; import { Hono } from 'npm:hono';  const routes = new Hono();  routes.get('/hello', (c) => c.text('Hello, World!'));  new VoltAgent({   server: honoServer({     configureApp(app) {       app.route('/api', routes);     },   }), });  await setTimeout(1000);  await fetch('http://localhost:3141/api/hello').then(async (resp) => {   console.log('request to /api/hello');   console.log(await resp.text()); }); await fetch('http://localhost:3141/api/api/hello').then(async (resp) => {   console.log('request to /api/api/hello');   console.log(await resp.text()); }); ```  ### Expected behavior  print `/api/hello`  ### Packages  latest  ### A
  **Post-Mortem & Fix Analysis**:
  > Traced this to `packages/server-hono/src/utils/custom-endpoints.ts:43`. Hono merges `basePath` into `route.path` inside `_addRoute` (hono-base.ts), so for your setup `app.routes` holds `{ path: "/api/hello", basePath: "/api" }`. The extractor then prepended `basePath` again, producing `/api/api/hello` for the log while Hono itself routed by `route.path` so the actual request still worked.  PR with fix + two regression tests: #1241.

- **Issue #1236** (2026-04-25): **[BUG] It should be reported that the port is occupied.**
  *Symptoms*: ### Describe the bug  If the specified port is occupied, an error should be reported instead of changing the port without authorization. ``` ══════════════════════════════════════════════════   ✓ HTTP Server:  http://localhost:4310   ↪ Share it:    pnpm volt tunnel 4310 (secure HTTPS tunnel for teammates)   ↪ Deploy it:   https://console.voltagent.dev/deployments   ✓ Swagger UI:   http://localhost:4310/ui    Test your agents with VoltOps Console: https://console.voltagent.dev ══════════════════════════════════════════════════ ```  ### Steps To Reproduce  ```ts import { createServer } from "node:http"; import VoltAgent from "@voltagent/core"; import honoServer from "@voltagent/server-hono";  createServer((_, res) => {     res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });     res.end("3141 is occupied\n"); }).listen(3141, () => {     console.log("Port 3141 is occupied for conflict testing");      new VoltAgent({         agents: {},         server: honoServer({             port: 3141         }),     }); });  ```  ### Expected behavior  stop server, print 3141 is occupied  ### Packages  latest  ### Additional Context  It can switch ports when I don't specify the port, but if the port I specified is occupied, it should report an error.
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this. You were right that silently switching ports is surprising here.  I opened a fix in #1247. With this change, VoltAgent stops when the initial port is already in use and prints a clear message showing how to configure a different port, for example `honoServer({ port: 4310 })`, instead of automatically binding to that port.

- **Issue #1227** (2026-04-23): **[BUG] global workspace doesn't work**
  *Symptoms*: ### Describe the bug  <img width="1023" height="306" alt="Image" src="https://github.com/user-attachments/assets/f440e0f0-1b15-4125-94ce-80506b1ec937" />  ### Steps To Reproduce  ```ts import { Agent, LocalSandbox, VoltAgent, Workspace, createTool } from "@voltagent/core"; import z from "zod";  const currentDate = createTool({     name: 'currentDate',     description: 'Returns the current date in ISO format',     parameters: z.object({}),     execute: async () => {         const date = new Date();         return date.toISOString()     } })  const workspace = new Workspace({     sandbox: new LocalSandbox() })  const agent = new Agent({     name: 'My Agent',     instructions: '',     model: 'openai/gpt-5-mini',     tools: [currentDate],     // workspace });    new VoltAgent({     agents: { agent },     workspace });  const resp = await agent.generateText('List your tool names array') console.log(resp.text) ```  ### Expected behavior  ``` [   "functions.currentDate",   "functions.ls",   "functions.read_file",   "functions.write_file",   "functions.edit_file",   "functions.delete_file",   "functions.stat",   "functions.mkdir",   "functions.rmdir",   "functions.list_tree",   "functions.list_files",   "functions.glob",   "functions.grep",   "functions.execute_command",   "functions.workspace_index",   "functions.workspace_index_content",   "functions.workspace_search",   "functions.workspace_list_skills",   "functions.workspace_search_skills",   "functions.workspace_read_skill",   
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this! I was able to reproduce it in `examples/with-workspace`: when the agent was constructed before `new VoltAgent({ workspace })`, the agent had no workspace and only showed the user-defined tool.  I opened a fix in #1228. With the patch, the same repro shows the global workspace attached and the expected workspace tools (`ls`, `read_file`, `execute_command`, search/skills tools, etc.) are available without passing `workspace` directly to the `Agent` constructor.

- **Issue #1222** (2026-04-22): **[BUG] swagger is empty**
  *Symptoms*: ### Describe the bug  <img width="809" height="560" alt="Image" src="https://github.com/user-attachments/assets/f8f3a487-e717-40a3-b1bc-190aee2e3211" />  ### Steps To Reproduce  ```ts import { VoltAgent, Agent } from 'npm:@voltagent/core'; import { honoServer } from 'npm:@voltagent/server-hono';  const agent = new Agent({   name: 'MyAgent',   instructions: 'An example agent',   model: 'openai/gpt-5-mini', });  new VoltAgent({   agents: { agent },   server: honoServer({     enableSwaggerUI: true,   }), });  ```  ### Expected behavior  show apis  ### Packages  latest  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for the clear repro. I was able to reproduce the empty Swagger UI behavior from the honoServer enableSwaggerUI setup.  I updated the fix in #1224 to address the root cause instead of adding a fallback. The problem was that server-hono was composing OpenAPI schemas from different Zod instances: its own zod-openapi compatibility layer plus already-created schemas imported from server-core. In some package resolution setups, especially around Zod v3/v4, the OpenAPI generator can reject those nested schemas and /doc generation fails.  The PR now makes server-core schemas reusable through a factory, and server-hono creates them with the active Zod instance used by its OpenAPI layer. I also added regression coverage and verified the example flow with Zod v3, Zod v4, and the previously failing mixed resolution case.
  > @omeraplak The error has changed. Is there any problem with the release? ``` error: Uncaught SyntaxError: The requested module '@voltagent/server-core' does not provide an export named 'createServerCoreSchemas' Warning Couldn't format source line: Column 41 is out of bounds (source may have changed at runtime)     at <anonymous> (file:///Users/diluka/Library/Caches/deno/npm/registry.npmmirror.com/@voltagent/server-hono/2.0.12/dist/index.mjs:1:41) ```
  > Yes, this is a release coordination problem. `@voltagent/server-hono@2.0.12` was published with a runtime import for the new `createServerCoreSchemas` export, but `@voltagent/server-core` was not published with that export yet. So some resolvers, including Deno npm cache/mirrors, can pair `server-hono@2.0.12` with `server-core@2.1.14`, and startup fails before the server is created.  I opened a hotfix PR here: #1229  That PR publishes `@voltagent/server-core` as a patch release so the required export is available from the registry. After the hotfix release, a fresh install or Deno cache reload should resolve the matching package. For Deno, if it still uses the cached package, try reloading the npm cache for the app after the release is available. 

- **Issue #1198** (2026-04-11): **[BUG] A2A Server Agent Card displays internal path instead of  /a2a/{serverId}  endpoint and uses relative URL**
  *Symptoms*: ### Describe the bug  The A2A Server Agent Card currently shows the internal agent card path instead of the expected  a2a/{serverId}  endpoint. Additionally, the displayed URL is relative, which causes issues for external/third‑party agents that require a fully qualified absolute URL.  ### Steps To Reproduce  ``` import { Agent, VoltAgent } from '@voltagent/core'; import { A2AServer } from '@voltagent/a2a-server'; import { honoServer } from '@voltagent/server-hono'; import type { A2ARequestContext } from '@voltagent/a2a-server';  const assistant = new Agent({   id: 'assistant',   name: 'Assistant',   purpose: 'A helpful AI assistant powered by Endor.',   instructions: 'You are a helpful assistant.',   model: "" // whatever model placed here, });  const a2aServer = new A2AServer({   id: 'assistant',   name: 'assistant',   version: '1.0.0',   description: 'AI assistant', });  new VoltAgent({   agents: { assistant },   a2aServers: { assistant: a2aServer },   server: honoServer({ port: 3000 }), });   ### Expected behavior  Hopefully 2 potential changes. Allowing us to either.. 1. Pass our own url property into A2AServer to override what is set by VoltAgent 2. Use the correct relative path and allow us to pass a domain to be attached to the beginning of the URL 3. Allow us to override the entire agent card per agent ID (allowing developers full control)  Currently I'm overriding the agent card to work for our use cases by doing the below.. ``` // Override agent card URL — the libr
  **Post-Mortem & Fix Analysis**:
  > Thanks again for the detailed report and for sharing the workaround, that made it much easier to track down. We’ve got a fix up in #1199 now, and if everything looks good on final review we’re planning to merge it soon.
  > Awesome, thanks for the quick response!

- **Issue #1195** (2026-04-15): **[BUG] Tool calls do not work with google-vertex thinking models due to a zod schema mismatch**
  *Symptoms*: ### Describe the bug  I set up the starter project using the Volt CLI and swapped the model provider from the Gemini AIStudio model to the `@ai-sdk/google-vertex` model provider, and I found that the example tool included in the starter project (weather tool) doesn't work with this provider because the providerMetadata in the tool output is not recognized by the zod schema used in @voltagent/core.  This is the error that is produced upon asking the agent the weather: ``` Type validation failed: Value: {"type":"tool-output-available","toolCallId":"Sk185Yue8l5bGqGE","output":{"weather":{"location":"Perth","condition":"Sunny","temperature":25},"message":"Current weather in Perth: is 25 degrees and sunny."},"providerMetadata":{"google":{"thoughtSignature":"CiQBjz1rXwFvT1I/B/3qqqGc2FdAgzW+FJY4Tg/zPaWUtF6imFwKaQGPPWtft4aBRV6rnS2F0o+8IBbuTEO/YYVZhO58OBukMC9JlbloJ7izGBokNw+MSALlDFfgXgF5sStXt7DfI+pfKwfLhMRIq998hqm++ozwfHX51wXnnkSbs5FXJZfUsl7tWTojnMAwiApQAY89a1+oA6zx2kUVrdYmSzGkronf7hKmy3Hxo3otvmO7PBQGx6YGLAdNtFLz9EC3WXgX6zeLA+EXlEPo1xE8LE+S3LOKha/lQg7VW9sOlpY="}}}. Error message: [   {     "code": "invalid_union",     "errors": [       [         {           "code": "invalid_value",           "values": [             "text-start"           ],           "path": [             "type"           ],           "message": "Invalid input"         },         {           "expected": "string",           "code": "invalid_type",           "path": [             "id"           ],           "message": "
  **Post-Mortem & Fix Analysis**:
  > Getting Same issue with ```     "@voltagent/ag-ui": "^1.0.7",     "@voltagent/core": "^2.6.13",     "@voltagent/libsql": "^2.1.2",     "@voltagent/logger": "^2.0.2",     "@voltagent/postgres": "^2.1.2",     "@voltagent/server-hono": "^2.0.8",     "ai": "^6.0.85",     "@copilotkit/runtime": "^1.54.1", ```
  > I think the reporter is pointing at a real mismatch, and the current source narrows it a bit more.  On `main`, `packages/core/src/agent/streaming/guardrail-stream.ts` already preserves `providerMetadata` for several other chunk types, for example `text-*`, `reasoning-*`, `tool-input-available`, and `source-*`. But `tool-output-available` is still treated more narrowly.  That means Google/Vertex thinking metadata is not just random extra noise here - VoltAgent is already carrying provider metadata through the stream in multiple places, and the tool-output path is the one that looks inconsistent.  So the smallest fix probably is:  1. allow `providerMetadata` on the `tool-output-available` chunk schema as well, 2. keep passing it through consistently for tool-result/tool-output events, 3. add one regression test with a `tool-output-available` event that includes `providerMetadata.google.thoughtSignature`.  As a short-term workaround, I would expect this to disappear if you avoid the think
  > @omeraplak Thank you!

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

### Incident Patch 1: `80827c3f` (2026-08-27)
**Commit Message**: docs(voltagent-memory): add README with usage examples and config reference (#1350)

* docs(voltagent-memory): add README with usage examples and config reference

* docs(voltagent-memory): fix inaccurate database fallback description

The README incorrectly stated that the adapter falls back to the first
managed database when neither databaseId nor databaseName is provided.
In reality, findTargetDatabase() returns undefined in that case and
initialize() throws an error. Updated the docs to match actual behavior.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---------

Co-authored-by: Claude Sonnet 4.6 <noreply@anthropic.com>

**File**: `.changeset/voltagent-memory-readme.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@voltagent/voltagent-memory": patch
+---
+
+Add README documentation
```

**File**: `packages/voltagent-memory/README.md` (added, +108/-0)
```diff
@@ -0,0 +1,108 @@
+<div align="center">
+<a href="https://voltagent.dev/">
+<img width="1500" height="276" alt="voltagent" src="https://github.com/user-attachments/assets/d9ad69bd-b905-42a3-81af-99a0581348c0" />
+</a>
+
+<h3 align="center">
+AI Agent Engineering Platform
+</h3>
+
+<div align="center">
+    <a href="https://voltagent.dev">Home Page</a> |
+    <a href="https://voltagent.dev/docs/">Documentation</a> |
+    <a href="https://github.com/voltagent/voltagent/tree/main/examples">Examples</a>
+</div>
+</div>
+
+<br/>
+
+<div align="center">
+
+[![GitHub issues](https://img.shields.io/github/issues/voltagent/voltagent)](https://github.com/voltagent/voltagent/issues)
+[![GitHub pull requests](https://img.shields.io/github/issues-pr/voltagent/voltagent)](https://github.com/voltagent/voltagent/pulls)
+[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
+[![npm version](https://img.shields.io/npm/v/@voltagent/voltagent-memory.svg)](https://www.npmjs.com/package/@voltagent/voltagent-memory)
+[![npm downloads](https://img.shields.io/npm/dm/@voltagent/voltagent-memory.svg)](https://www.npmjs.com/package/@voltagent/voltagent-memory)
+[![Discord](https://img.shields.io/discord/1361559153780195478.svg?label=&logo=discord&logoColor=ffffff&color=7389D8&labelColor=6A7EC2)](https://s.voltagent.dev/discord)
+
+</div>
+
+## @voltagent/voltagent-memory
+
+VoltAgent's managed memory adapter, backed by the VoltOps API. `ManagedMemoryAdapter` stores conversations, messages, working memory, and workflow state without you having to provision or operate a database, and `ManagedMemoryVectorAdapter` provides managed vector storage for RAG/retriever use cases.
+
+---
+
+## Install
+
+```bash
+npm install @voltagent/voltagent-memory
+# or
+yarn add @voltagent/voltagent-memory
+# or
+pnpm add @voltagent/voltagent-memory
+```
+
+## Setup
+
+Managed memory requires a VoltOps project. Set your keys as environment variables, or pass a `voltOpsClient` explicitly:
+
+```bash
+VOLTAGENT_PUBLIC_KEY=...
+VOLTAGENT_SECRET_KEY=...
+```
+
+## Usage
+
+```typescript
+import { Agent, Memory } from "@voltagent/core";
+import { ManagedMemoryAdapter } from "@voltagent/voltagent-memory";
+import { openai } from "@ai-sdk/openai";
+
+const memory = new Memory({
+  storage: new ManagedMemoryAdapter({
+    databaseName: "my-database",
+    // or: databaseId: "db_123"
+  }),
+});
+
+const agent = new Agent({
+  name: "my-agent",
+  instructions: "A helpful assistant",
+  model: openai("gpt-4o-mini"),
+  memory,
+});
+```
+
+### Managed Memory Options
+
+| Option          | Type            | Default | Description                                                           |
+| --------------- | --------------- | ------- | --------------------------------------------------------------------- |
+| `databaseId`    | `string`        | —       | Select a managed database by ID                                       |
+| `databaseName`  | `string`        | —       | Select a managed database by name (used if `databaseId` is not set)   |
+| `voltOpsClient` | `VoltOpsClient` | —       | Explicit VoltOps client; falls back to the globally registered client |
+| `debug`         | `boolean`       | `false` | Enable debug logging                                                  |
+
+Both `databaseId` and `databaseName` are optional individually, but at least one must be provided. If neither is given, `initialize()` throws an error because `findTargetDatabase()` cannot locate a target database and returns `undefined`.
+
+## Vector Adapter
+
+```typescript
+import { ManagedMemoryVectorAdapter } from "@voltagent/voltagent-memory";
+
+const vectorStore = new ManagedMemoryVectorAdapter({
+  databaseName: "my-database",
+});
+```
+
+`ManagedMemoryVectorAdapter` accepts the same options as `ManagedMemoryAdapter` above.
+
+## Documentation
+
+- [VoltAgent Documentation](https://voltagent.dev/docs/)
+- [Managed Memory](https://voltagent.dev
```

---

### Incident Patch 2: `844939cd` (2026-08-27)
**Commit Message**: fix(core): preserve template replacement tokens (#1402)

* fix(core): preserve template replacement tokens

* fix(core): stringify template variables once

**File**: `.changeset/bright-prompts-smile.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@voltagent/core": patch
+---
+
+Preserve JavaScript replacement tokens in simple template variable values.
```

**File**: `packages/core/src/voltops/template-engine.spec.ts` (modified, +22/-0)
```diff
@@ -101,5 +101,27 @@ describe("Template Engine", () => {
 
       expect(result).toBe("Pattern: $1.50 (special)");
     });
+
+    it("should preserve replacement tokens in variable values", () => {
+      const content = "Amount: {{value}}";
+      const variables = { value: "$&" };
+      const result = engine.process(content, variables);
+
+      expect(result).toBe("Amount: $&");
+    });
+
+    it("should convert each variable to a string only once", () => {
+      let conversions = 0;
+      const content = "{{value}}/{{value}}";
+      const variables = {
+        value: {
+          [Symbol.toPrimitive]: () => `value-${++conversions}`,
+        },
+      };
+      const result = engine.process(content, variables);
+
+      expect(result).toBe("value-1/value-1");
+      expect(conversions).toBe(1);
+    });
   });
 });
```

**File**: `packages/core/src/voltops/template-engine.ts` (modified, +2/-1)
```diff
@@ -22,7 +22,8 @@ export const createSimpleTemplateEngine = (): TemplateEngine => ({
     let processed = content;
     for (const [key, value] of Object.entries(variables)) {
       const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
-      processed = processed.replace(regex, String(value));
+      const replacement = String(value);
+      processed = processed.replace(regex, () => replacement);
     }
     return processed;
   },
```

---

### Incident Patch 3: `8dbe100f` (2026-07-13)
**Commit Message**: fix: improve state retrieval in PostgreSQLMemoryAdapter tests

**File**: `packages/postgres/src/index.integration.test.ts` (modified, +6/-4)
```diff
@@ -390,13 +390,15 @@ describe("PostgreSQLMemoryAdapter Integration Tests", () => {
       // Should only return suspended states
       expect(suspended.length).toBeGreaterThanOrEqual(2);
       expect(suspended.every((s) => s.status === "suspended")).toBe(true);
-      expect(suspended[0]?.events).toEqual(states[0].events);
-      expect(suspended[0]?.output).toEqual(states[0].output);
-      expect(suspended[0]?.cancellation).toEqual({
+      const persistedState = suspended.find((state) => state.id === states[0].id);
+      expect(persistedState).toBeDefined();
+      expect(persistedState?.events).toEqual(states[0].events);
+      expect(persistedState?.output).toEqual(states[0].output);
+      expect(persistedState?.cancellation).toEqual({
         reason: states[0]?.cancellation?.reason,
         cancelledAt: states[0]?.cancellation?.cancelledAt?.toISOString(),
       });
-      expect(suspended[0]?.workflowState).toEqual(states[0].workflowState);
+      expect(persistedState?.workflowState).toEqual(states[0].workflowState);
     });
   });
 
```

---

### Incident Patch 4: `20670754` (2026-07-13)
**Commit Message**: fix: prevent delegated sub-agent messages from polluting supervisor memory context (#1037)

**File**: `.changeset/cruel-trains-cut.md` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+---
+"@voltagent/core": patch
+---
+
+fix: prevent delegated sub-agent messages from polluting supervisor memory context
+
+When a supervisor delegated work via `delegate_task`, the sub-agent used the same `conversationId` and persisted its own delegated input/output into that shared thread. On later turns, supervisor memory reads could include those delegated sub-agent messages, which could lead to duplicate/phantom prompts in the parent conversation context.
+
+### Previous behavior
+
+- Sub-agent delegated messages were persisted into the same conversation thread as the supervisor.
+- Supervisor memory reads could load those delegated messages back into the parent prompt context.
+
+### New behavior
+
+- Delegated sub-agent messages are tagged with sub-agent metadata (`subAgentId`, `subAgentName`, `parentAgentId`).
+- Parent memory reads now filter delegated sub-agent records from supervisor conversation context.
+- `conversationId` behavior remains shared (no child/derived conversation IDs introduced).
+
+This keeps supervisor context clean in multi-turn handoff flows while preserving delegated records with metadata for observability/debugging.
```

**File**: `packages/core/src/agent/subagent/index.ts` (modified, +5/-0)
```diff
@@ -377,6 +377,11 @@ ${task}\n\nContext: ${safeStringify(contextObj, { indentation: 2 })}`;
         id: crypto.randomUUID(),
         role: "user",
         parts: [{ type: "text", text: taskContent }],
+        metadata: {
+          subAgentId: targetAgent.id,
+          subAgentName: targetAgent.name,
+          parentAgentId: sourceAgent?.id || parentAgentId,
+        },
       };
 
       // Combine shared context with the new task message
```

**File**: `packages/core/src/memory/manager/memory-manager.spec.ts` (modified, +63/-0)
```diff
@@ -102,6 +102,32 @@ describe("MemoryManager", () => {
       expect(messages[0].id).toBe("msg-1");
     });
 
+    it("should attach delegation metadata for sub-agent writes", async () => {
+      const context = createMockOperationContext();
+      context.parentAgentId = "supervisor-1";
+      context.systemContext.set(Symbol("agent-metadata"), {
+        agentId: "sub-agent-1",
+        agentName: "Sub Agent",
+      });
+
+      const message = createTestUIMessage({
+        id: "msg-sub-1",
+        role: "user",
+        parts: [{ type: "text", text: "delegated task" }],
+      });
+
+      await manager.saveMessage(context, message, "user-1", "conv-sub");
+
+      const messages = await memory.getMessages("user-1", "conv-sub");
+      expect(messages).toHaveLength(1);
+      expect(messages[0].metadata).toMatchObject({
+        operationId: "test-operation-id",
+        parentAgentId: "supervisor-1",
+        subAgentId: "sub-agent-1",
+        subAgentName: "Sub Agent",
+      });
+    });
+
     it("should generate a title when creating a conversation", async () => {
       const context = createMockOperationContext();
       context.input = "Plan a weekend trip to Rome.";
@@ -203,6 +229,43 @@ describe("MemoryManager", () => {
       expect(messages[1].id).toBe("msg-2");
     });
 
+    it("should filter delegated sub-agent messages when reading parent conversation", async () => {
+      const parentContext = createMockOperationContext();
+
+      await manager.saveMessage(
+        parentContext,
+        createTestUIMessage({
+          id: "msg-parent",
+          role: "user",
+          parts: [{ type: "text", text: "parent message" }],
+        }),
+        "user-1",
+        "conv-filter",
+      );
+
+      const delegatedContext = createMockOperationContext();
+      delegatedContext.parentAgentId = "agent-1";
+      delegatedContext.systemContext.set(Symbol("agent-metadata"), {
+        agentId: "sub-agent-1",
+        agentName: "Sub Agent",
+      });
+
+      await manager.saveMessage(
+        delegatedContext,
+        createTestUIMessage({
+          id: "msg-sub",
+          role: "assistant",
+          parts: [{ type: "text", text: "sub-agent result" }],
+        }),
+        "user-1",
+        "conv-filter",
+      );
+
+      const visibleMessages = await manager.getMessages(parentContext, "user-1", "conv-filter");
+      expect(visibleMessages).toHaveLength(1);
+      expect(visibleMessages[0].id).toBe("msg-parent");
+    });
+
     it("should return empty array when memory is disabled", async () => {
       const disabledManager = new MemoryManager("agent-3", false);
 
```

**File**: `packages/core/src/memory/manager/memory-manager.ts` (modified, +102/-17)
```diff
@@ -206,29 +206,109 @@ export class MemoryManager {
   }
 
   private applyOperationMetadata(message: UIMessage, context: OperationContext): UIMessage {
-    const operationId = context.operationId;
-    if (!operationId) {
-      return message;
-    }
-
     const existingMetadata =
       typeof message.metadata === "object" && message.metadata !== null
         ? (message.metadata as Record<string, unknown>)
         : undefined;
 
-    if (existingMetadata?.operationId === operationId) {
+    const nextMetadata: Record<string, unknown> = { ...(existingMetadata ?? {}) };
+    let changed = false;
+
+    const operationId = context.operationId;
+    if (operationId && nextMetadata.operationId !== operationId) {
+      nextMetadata.operationId = operationId;
+      changed = true;
+    }
+
+    const delegationMetadata = this.resolveDelegationMetadata(context);
+    if (delegationMetadata?.parentAgentId && nextMetadata.parentAgentId === undefined) {
+      nextMetadata.parentAgentId = delegationMetadata.parentAgentId;
+      changed = true;
+    }
+    if (delegationMetadata?.subAgentId && nextMetadata.subAgentId === undefined) {
+      nextMetadata.subAgentId = delegationMetadata.subAgentId;
+      changed = true;
+    }
+    if (delegationMetadata?.subAgentName && nextMetadata.subAgentName === undefined) {
+      nextMetadata.subAgentName = delegationMetadata.subAgentName;
+      changed = true;
+    }
+
+    if (!changed) {
       return message;
     }
 
     return {
       ...message,
-      metadata: {
-        ...(existingMetadata ?? {}),
-        operationId,
-      },
+      metadata: nextMetadata,
     };
   }
 
+  private resolveDelegationMetadata(
+    context: OperationContext,
+  ): { parentAgentId: string; subAgentId?: string; subAgentName?: string } | undefined {
+    if (!context.parentAgentId) {
+      return undefined;
+    }
+
+    let subAgentId: string | undefined;
+    let subAgentName: string | undefined;
+
+    for (const value of context.systemContext.values()) {
+      if (!value || typeof value !== "object" || Array.isArray(value)) {
+        continue;
+      }
+
+      const record = value as Record<string, unknown>;
+      if (typeof record.agentId === "string" && record.agentId.trim().length > 0) {
+        subAgentId = record.agentId;
+      }
+      if (typeof record.agentName === "string" && record.agentName.trim().length > 0) {
+        subAgentName = record.agentName;
+      }
+
+      if (subAgentId || subAgentName) {
+        break;
+      }
+    }
+
+    return {
+      parentAgentId: context.parentAgentId,
+      ...(subAgentId ? { subAgentId } : {}),
+      ...(subAgentName ? { subAgentName } : {}),
+    };
+  }
+
+  private filterDelegatedSubAgentMessages(
+    messages: UIMessage<{ createdAt: Date }>[],
+  ): UIMessage<{ createdAt: Date }>[] {
+    return messages.filter((message) => {
+      const metadata =
+        typeof message.metadata === "object" && message.metadata !== null
+          ? (message.metadata as Record<string, unknown>)
+          : undefined;
+      if (!metadata) {
+        return true;
+      }
+
+      const subAgentId =
+        typeof metadata.subAgentId === "string" && metadata.subAgentId.trim().length > 0
+          ? metadata.subAgentId
+          : undefined;
+      const parentAgentId =
+        typeof metadata.parentAgentId === "string" && metadata.parentAgentId.trim().length > 0
+          ? metadata.parentAgentId
+          : undefined;
+
+      // Keep non-delegated records and delegated records from the current agent itself.
+      if (!subAgentId || !parentAgentId) {
+        return true;
+      }
+
+      return subAgentId === this.resourceId;
+    });
+  }
+
   async saveConversationSteps(
     context: OperationContext,
     steps: ConversationStepRecord[],
@@ -349,6 +429,8 @@ export class MemoryManager {
         }
       }
 
+      messages = this.filterDelegatedSubAgentMessages(messages);
+
       // Log successful memory operation - PRES
```

**File**: `website/docs/agents/memory/overview.md` (modified, +2/-0)
```diff
@@ -142,6 +142,8 @@ const agent3 = new Agent({
 
 For stateless sub-agents, set `memory: false` on each sub-agent explicitly.
 
+When a supervisor delegates to sub-agents, delegated messages are tagged with sub-agent metadata so supervisor memory reads can filter sub-agent records from parent conversation context.
+
 ### Global Defaults (VoltAgent)
 
 Set default memory instances once at the VoltAgent entrypoint. Defaults apply only when an agent or workflow does not specify `memory`. If nothing is configured, VoltAgent still falls back to built-in in-memory storage. An explicit `memory: false` on an agent disables memory and bypasses defaults.
```

---

### Incident Patch 5: `6b26a8fb` (2026-07-01)
**Commit Message**: fix(core): use aggregate finish usage consistently (#1366)

**File**: `.changeset/consistent-usage-totals.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@voltagent/core": patch
+---
+
+Use aggregate finish usage consistently across providers.
```

**File**: `packages/core/src/agent/agent.spec.ts` (modified, +2/-2)
```diff
@@ -1161,7 +1161,7 @@ Use pandas and summarize findings.`.split("\n"),
       expect(parts[1]).toEqual(expect.objectContaining({ type: "text-delta", id: "text-1" }));
     });
 
-    it("uses last-step usage for finish events when provider is anthropic", async () => {
+    it("keeps aggregate total usage for finish events when provider is anthropic", async () => {
       const agent = new Agent({
         name: "TestAgent",
         instructions: "You are a helpful assistant",
@@ -1223,7 +1223,7 @@ Use pandas and summarize findings.`.split("\n"),
       }
 
       const finishPart = parts.find((part) => part.type === "finish");
-      expect(finishPart?.totalUsage).toEqual(lastStepUsage);
+      expect(finishPart?.totalUsage).toEqual(summedUsage);
     });
 
     it("keeps fullStream intact after probe for ReadableStream-based providers", async () => {
```

**File**: `packages/core/src/utils/usage-normalizer.spec.ts` (modified, +10/-10)
```diff
@@ -17,7 +17,7 @@ const toAsync = async function* <T>(items: T[]): AsyncIterable<T> {
 };
 
 describe("resolveFinishUsage", () => {
-  it("prefers last-step usage when provider metadata indicates anthropic", () => {
+  it("prefers total usage when provider metadata indicates anthropic", () => {
     const lastStepUsage: LanguageModelUsage = {
       inputTokens: 5,
       outputTokens: 6,
@@ -35,10 +35,10 @@ describe("resolveFinishUsage", () => {
       totalUsage,
     });
 
-    expect(resolved).toBe(lastStepUsage);
+    expect(resolved).toBe(totalUsage);
   });
 
-  it("prefers last-step usage when usage includes cache fields", () => {
+  it("prefers total usage when usage includes cache fields", () => {
     const lastStepUsage = {
       inputTokens: 5,
       outputTokens: 6,
@@ -56,7 +56,7 @@ describe("resolveFinishUsage", () => {
       totalUsage,
     });
 
-    expect(resolved).toBe(lastStepUsage);
+    expect(resolved).toBe(totalUsage);
   });
 
   it("prefers total usage when provider is not anthropic", () => {
@@ -98,7 +98,7 @@ describe("resolveFinishUsage", () => {
 });
 
 describe("normalizeFinishUsageStream", () => {
-  it("overrides finish totalUsage with last-step usage for anthropic streams", async () => {
+  it("keeps finish totalUsage unchanged for anthropic streams", async () => {
     const lastStepUsage: LanguageModelUsage = {
       inputTokens: 10,
       outputTokens: 5,
@@ -121,10 +121,10 @@ describe("normalizeFinishUsageStream", () => {
 
     const normalized = await collectStream(normalizeFinishUsageStream(toAsync(parts)));
 
-    expect(normalized[2].totalUsage).toEqual(lastStepUsage);
+    expect(normalized[2].totalUsage).toEqual(totalUsage);
   });
 
-  it("uses finish metadata to override totalUsage when finish-step metadata is missing", async () => {
+  it("keeps finish totalUsage unchanged when finish-step metadata is missing", async () => {
     const lastStepUsage: LanguageModelUsage = {
       inputTokens: 9,
       outputTokens: 4,
@@ -147,10 +147,10 @@ describe("normalizeFinishUsageStream", () => {
 
     const normalized = await collectStream(normalizeFinishUsageStream(toAsync(parts)));
 
-    expect(normalized[1].totalUsage).toEqual(lastStepUsage);
+    expect(normalized[1].totalUsage).toEqual(totalUsage);
   });
 
-  it("overrides totalUsage when cache fields indicate anthropic usage", async () => {
+  it("keeps finish totalUsage unchanged when cache fields are present", async () => {
     const lastStepUsage = {
       inputTokens: 8,
       outputTokens: 4,
@@ -169,7 +169,7 @@ describe("normalizeFinishUsageStream", () => {
 
     const normalized = await collectStream(normalizeFinishUsageStream(toAsync(parts)));
 
-    expect(normalized[1].totalUsage).toEqual(lastStepUsage);
+    expect(normalized[1].totalUsage).toEqual(totalUsage);
   });
 
   it("keeps finish totalUsage unchanged for non-anthropic streams", async () => {
```

**File**: `packages/core/src/utils/usage-normalizer.ts` (modified, +1/-51)
```diff
@@ -13,69 +13,19 @@ type StreamPartWithUsage = {
   providerMetadata?: unknown;
 };
 
-const shouldUseLastStepUsage = (providerMetadata: unknown, usage?: LanguageModelUsage): boolean => {
-  if (providerMetadata && typeof providerMetadata === "object") {
-    if (Object.prototype.hasOwnProperty.call(providerMetadata, "anthropic")) {
-      return true;
-    }
-  }
-
-  const raw = (usage as { raw?: Record<string, unknown> } | undefined)?.raw;
-  if (raw && typeof raw === "object") {
-    if (
-      Object.prototype.hasOwnProperty.call(raw, "cache_creation_input_tokens") ||
-      Object.prototype.hasOwnProperty.call(raw, "cache_read_input_tokens")
-    ) {
-      return true;
-    }
-  }
-
-  return false;
-};
-
 export const resolveFinishUsage = (input: FinishUsageInput): LanguageModelUsage | undefined => {
-  const { providerMetadata, usage, totalUsage } = input;
+  const { usage, totalUsage } = input;
   if (!usage && !totalUsage) {
     return undefined;
   }
 
-  if (shouldUseLastStepUsage(providerMetadata, usage ?? totalUsage)) {
-    return usage ?? totalUsage;
-  }
-
   return totalUsage ?? usage;
 };
 
 export async function* normalizeFinishUsageStream<T extends StreamPartWithUsage>(
   baseStream: AsyncIterable<T>,
 ): AsyncIterable<T> {
-  let lastStepUsage: LanguageModelUsage | undefined;
-  let useLastStepUsage = false;
-
   for await (const part of baseStream) {
-    if (part.type === "finish-step") {
-      lastStepUsage = part.usage;
-      if (!useLastStepUsage) {
-        useLastStepUsage = shouldUseLastStepUsage(part.providerMetadata, lastStepUsage);
-      }
-    }
-
-    if (part.type === "finish" && !useLastStepUsage) {
-      if (shouldUseLastStepUsage(part.providerMetadata, lastStepUsage)) {
-        useLastStepUsage = true;
-        if (part.usage) {
-          lastStepUsage = part.usage;
-        }
-      }
-    }
-
-    if (part.type === "finish" && useLastStepUsage && lastStepUsage) {
-      if (part.totalUsage !== undefined) {
-        yield { ...part, totalUsage: lastStepUsage };
-        continue;
-      }
-    }
-
     yield part;
   }
 }
```

---

### Incident Patch 6: `9dc0314c` (2026-06-30)
**Commit Message**: fix(core): preserve workflow input after finish (#1362)

WorkflowStateManager.finish() reassigned the stored input to the current
data, so reading state.input after a workflow completed returned the final
output instead of the initial input it documents. update() already preserves
the input during a run; finish() now does too. state.data still reflects the
final value. Adds a regression test.

**File**: `.changeset/workflow-input-preserved-after-finish.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@voltagent/core": patch
+---
+
+Fixed workflow `state.input` being overwritten with the final output once a workflow finished. `finish()` reassigned the stored input to the current data, so reading `state.input` after completion returned the final result instead of the initial input it documents. The initial input is now preserved through completion; `state.data` still reflects the final value.
```

**File**: `packages/core/src/workflow/internal/state.spec.ts` (modified, +11/-0)
```diff
@@ -128,6 +128,17 @@ describe("WorkflowStateManager", () => {
       expect(result.status).toBe("completed");
     });
 
+    it("should preserve the original input after the workflow finishes", () => {
+      stateManager.start({ value: "original" });
+      stateManager.update({ data: { value: "final" } });
+      stateManager.finish();
+
+      // `input` is documented as the initial input and must survive completion;
+      // only `data` should reflect the final value.
+      expect(stateManager.state.input).toEqual({ value: "original" });
+      expect(stateManager.state.data).toEqual({ value: "final" });
+    });
+
     it("should transition from suspended to failed", () => {
       stateManager.start({ data: "test" });
       stateManager.suspend("Pause");
```

**File**: `packages/core/src/workflow/internal/state.ts` (modified, +0/-1)
```diff
@@ -167,7 +167,6 @@ class WorkflowStateManagerInternal<DATA, RESULT> implements WorkflowStateManager
 
   finish() {
     assertCanMutate(this.#state);
-    this.#input = this.#state.data as DATA;
     this.#internalUpdate({
       endAt: new Date(),
       status: "completed",
```

---

### Incident Patch 7: `685f8e4e` (2026-06-08)
**Commit Message**: fix(core): sanitize tool inputs before replay (#1337)

* fix(core): sanitize tool inputs before replay

* chore(examples): remove issue 1336 repro

**File**: `.changeset/clean-tools-sip.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@voltagent/core": patch
+---
+
+Sanitize tool call inputs before model replay so malformed or non-object values cannot break provider history conversion.
```

**File**: `packages/core/src/agent/message-normalizer.spec.ts` (modified, +26/-1)
```diff
@@ -1,4 +1,4 @@
-import type { UIMessage } from "ai";
+import { type UIMessage, convertToModelMessages } from "ai";
 import { describe, expect, it } from "vitest";
 
 import { sanitizeMessageForModel, sanitizeMessagesForModel } from "./message-normalizer";
@@ -93,6 +93,31 @@ describe("message-normalizer", () => {
     });
   });
 
+  it("sanitizes legacy non-object tool inputs before model replay", async () => {
+    const malformedInput = `{"prompts":["Full body portrait of a 5'7" woman"]}`;
+    const message = baseMessage([
+      {
+        type: "tool-createImageFromText",
+        toolCallId: "call-malformed",
+        state: "output-available",
+        input: malformedInput,
+        output: { error: "invalid input" },
+      } as any,
+    ]);
+
+    const sanitized = sanitizeMessagesForModel([message], { filterIncompleteToolCalls: false });
+
+    expect(sanitized).toHaveLength(1);
+    const toolPart = sanitized[0].parts[0] as any;
+    expect(toolPart.input).toEqual({});
+    expect((message.parts[0] as any).input).toBe(malformedInput);
+
+    const modelMessages = await convertToModelMessages(sanitized);
+    const assistantMessage = modelMessages.find((item) => item.role === "assistant");
+    const toolCall = (assistantMessage?.content as any[]).find((part) => part.type === "tool-call");
+    expect(toolCall.input).toEqual({});
+  });
+
   it("preserves provider metadata on text parts", () => {
     const message = baseMessage([
       {
```

**File**: `packages/core/src/agent/message-normalizer.ts` (modified, +4/-1)
```diff
@@ -1,6 +1,7 @@
 import { safeStringify } from "@voltagent/internal";
 import type { UIMessage, UIMessagePart } from "ai";
 
+import { normalizeToolInputForModel } from "../utils/tool-input";
 import {
   hasOpenAIItemIdForPart as hasOpenAIItemIdForPartBase,
   isObject,
@@ -329,7 +330,9 @@ const normalizeToolPart = (part: ToolLikePart): UIMessagePart<any, any> | null =
 
   if (part.toolCallId) normalized.toolCallId = part.toolCallId;
   if (part.state) normalized.state = part.state;
-  if (part.input !== undefined) normalized.input = safeClone(part.input);
+  if (part.input !== undefined || isToolInputState(part.state) || isToolOutputState(part.state)) {
+    normalized.input = safeClone(normalizeToolInputForModel(part.input));
+  }
   if (part.output !== undefined) {
     normalized.output = safeClone(normalizeToolOutputPayload(part.output));
   }
```

**File**: `packages/core/src/utils/message-converter.spec.ts` (modified, +68/-0)
```diff
@@ -142,6 +142,49 @@ describe("convertResponseMessagesToUIMessages", () => {
     });
   });
 
+  it("sanitizes non-object tool call inputs when converting response messages", async () => {
+    const malformedInput = `{"prompts":["Full body portrait of a 5'7" woman"]}`;
+    const messages: (AssistantModelMessage | ToolModelMessage)[] = [
+      {
+        role: "assistant",
+        content: [
+          {
+            type: "tool-call",
+            toolCallId: "call-malformed",
+            toolName: "createImageFromText",
+            input: malformedInput,
+          } as any,
+        ],
+      },
+      {
+        role: "tool",
+        content: [
+          {
+            type: "tool-result",
+            toolCallId: "call-malformed",
+            toolName: "createImageFromText",
+            output: { error: "invalid input" },
+          },
+        ],
+      },
+    ];
+
+    const result = await convertResponseMessagesToUIMessages(messages);
+    const toolPart = result[0].parts[0] as any;
+
+    expect(toolPart).toMatchObject({
+      type: "tool-createImageFromText",
+      toolCallId: "call-malformed",
+      state: "output-available",
+      input: {},
+    });
+
+    const modelMessages = await convertToModelMessages(result);
+    const assistantMessage = modelMessages.find((message) => message.role === "assistant");
+    const toolCall = (assistantMessage?.content as any[]).find((part) => part.type === "tool-call");
+    expect(toolCall.input).toEqual({});
+  });
+
   it("should map tool approval requests to tool parts", async () => {
     const messages: AssistantModelMessage[] = [
       {
@@ -708,6 +751,31 @@ describe("convertModelMessagesToUIMessages (AI SDK v5)", () => {
     });
   });
 
+  it("sanitizes non-object tool call inputs when converting model messages", () => {
+    const messages: ModelMessage[] = [
+      {
+        role: "assistant",
+        content: [
+          {
+            type: "tool-call",
+            toolCallId: "call-string-input",
+            toolName: "createImageFromText",
+            input: `{"prompts":["Full body portrait of a 5'7" woman"]}`,
+          } as any,
+        ],
+      },
+    ];
+
+    const ui = convertModelMessagesToUIMessages(messages);
+    expect(ui).toHaveLength(1);
+    expect(ui[0].parts[0]).toEqual({
+      type: "tool-createImageFromText",
+      toolCallId: "call-string-input",
+      state: "input-available",
+      input: {},
+    });
+  });
+
   it("applies tool approval responses to existing tool parts", () => {
     const messages: ModelMessage[] = [
       {
```

**File**: `packages/core/src/utils/message-converter.ts` (modified, +3/-2)
```diff
@@ -6,6 +6,7 @@ import type { AssistantModelMessage, ModelMessage, ToolModelMessage } from "@ai-
 import type { FileUIPart, ReasoningUIPart, TextUIPart, ToolUIPart, UIMessage } from "ai";
 import { bytesToBase64 } from "./base64";
 import { randomUUID } from "./id";
+import { normalizeToolInputForModel } from "./tool-input";
 
 const hasOpenAIReasoningProviderOptions = (providerOptions: unknown): boolean => {
   if (!providerOptions || typeof providerOptions !== "object") {
@@ -112,7 +113,7 @@ export async function convertResponseMessagesToUIMessages(
               type: `tool-${contentPart.toolName}` as const,
               toolCallId: contentPart.toolCallId,
               state: "input-available" as const,
-              input: contentPart.input || {},
+              input: normalizeToolInputForModel(contentPart.input),
               ...(contentPart.providerOptions
                 ? { callProviderMetadata: contentPart.providerOptions }
                 : {}),
@@ -480,7 +481,7 @@ export function convertModelMessagesToUIMessages(messages: ModelMessage[]): UIMe
             type: `tool-${contentPart.toolName}` as const,
             toolCallId: contentPart.toolCallId,
             state: "input-available" as const,
-            input: contentPart.input || {},
+            input: normalizeToolInputForModel(contentPart.input),
             ...(contentPart.providerOptions
               ? { callProviderMetadata: contentPart.providerOptions as any }
               : {}),
```

---

### Incident Patch 8: `9f8c46c1` (2026-05-31)
**Commit Message**: fix(ci): skip playwright browser downloads

**File**: `.github/workflows/prerelease.yml` (modified, +3/-0)
```diff
@@ -5,6 +5,9 @@ on:
     branches:
       - next
 
+env:
+  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1"
+
 concurrency:
   group: ${{ github.workflow }}-${{ github.ref }}
   cancel-in-progress: true
```

**File**: `.github/workflows/pull-request.yml` (modified, +3/-0)
```diff
@@ -3,6 +3,9 @@ on:
   pull_request:
     types: [opened, synchronize, reopened, ready_for_review]
 
+env:
+  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1"
+
 jobs:
   commit-lint:
     if: ${{ !github.event.pull_request.draft }}
```

**File**: `.github/workflows/release.yml` (modified, +3/-0)
```diff
@@ -5,6 +5,9 @@ on:
     branches:
       - main
 
+env:
+  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1"
+
 jobs:
   test-packages:
     runs-on: ubuntu-latest
```

---

### Incident Patch 9: `a1b44273` (2026-05-31)
**Commit Message**: fix(core): prevent streamText abort unhandled rejections (#1334)

**File**: `.changeset/quiet-stream-abort.md` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+---
+"@voltagent/core": patch
+---
+
+fix: prevent unhandled rejections when aborting `Agent.streamText()` streams
+
+## The Problem
+
+`Agent.streamText()` eagerly read the AI SDK result getters for `text`, `usage`, and `finishReason` while constructing VoltAgent's wrapped result. In AI SDK v6 these fields are lazy promises, so reading them early could materialize promises that the caller never consumes.
+
+When a caller only consumed the UI/full stream and aborted the run, those unconsumed promises could reject globally as `unhandledRejection` events.
+
+## The Solution
+
+VoltAgent now preserves the lazy getter behavior for `text`, `usage`, and `finishReason`. The sanitized text promise is also created only when `result.text` is accessed.
+
+## Impact
+
+- Aborting a consumed `streamText()` stream no longer emits unhandled rejections for unconsumed result fields
+- Callers using only `toUIMessageStream()`, `toUIMessageStreamResponse()`, `fullStream`, or `textStream` do not need to attach defensive `.catch()` handlers to `text`, `usage`, or `finishReason`
+- Matches AI SDK v6's lazy stream result contract more closely
```

**File**: `packages/core/src/agent/agent.spec.ts` (modified, +76/-0)
```diff
@@ -1008,6 +1008,82 @@ Use pandas and summarize findings.`.split("\n"),
       expect(text).toBe("Streamed response");
     });
 
+    it("does not eagerly materialize lazy stream result promises", async () => {
+      const agent = new Agent({
+        name: "TestAgent",
+        instructions: "You are a helpful assistant",
+        model: mockModel as any,
+      });
+
+      const getterAccesses = {
+        text: 0,
+        usage: 0,
+        finishReason: 0,
+      };
+
+      const mockStream = {
+        get text() {
+          getterAccesses.text += 1;
+          return Promise.resolve("Streamed response");
+        },
+        textStream: (async function* () {
+          yield "Streamed response";
+        })(),
+        fullStream: toAsyncIterableStream(
+          convertArrayToReadableStream([
+            {
+              type: "text-delta" as const,
+              id: "text-1",
+              delta: "Streamed response",
+              text: "Streamed response",
+            },
+          ]),
+        ),
+        get usage() {
+          getterAccesses.usage += 1;
+          return Promise.resolve({
+            inputTokens: 10,
+            outputTokens: 5,
+            totalTokens: 15,
+          });
+        },
+        get finishReason() {
+          getterAccesses.finishReason += 1;
+          return Promise.resolve("stop");
+        },
+        warnings: [],
+        toUIMessageStream: vi.fn(),
+        toUIMessageStreamResponse: vi.fn(),
+        pipeUIMessageStreamToResponse: vi.fn(),
+        pipeTextStreamToResponse: vi.fn(),
+        toTextStreamResponse: vi.fn(),
+        partialOutputStream: undefined,
+      };
+
+      vi.mocked(ai.streamText).mockReturnValue(mockStream as any);
+
+      const result = await agent.streamText("Stream this");
+
+      expect(getterAccesses).toEqual({
+        text: 0,
+        usage: 0,
+        finishReason: 0,
+      });
+
+      await expect(result.text).resolves.toBe("Streamed response");
+      await expect(result.usage).resolves.toEqual({
+        inputTokens: 10,
+        outputTokens: 5,
+        totalTokens: 15,
+      });
+      await expect(result.finishReason).resolves.toBe("stop");
+      expect(getterAccesses).toEqual({
+        text: 1,
+        usage: 1,
+        finishReason: 1,
+      });
+    });
+
     it("pre-creates streaming message ids and forwards them to UI streams", async () => {
       const agent = new Agent({
         name: "TestAgent",
```

**File**: `packages/core/src/agent/agent.ts` (modified, +46/-26)
```diff
@@ -1961,7 +1961,7 @@ export class Agent {
         const guardrailStreamingEnabled = guardrailSet.output.length > 0;
 
         let guardrailPipeline: GuardrailPipeline | null = null;
-        let sanitizedTextPromise!: PromiseLike<string>;
+        let sanitizedTextPromise: Promise<string> | undefined;
         const { result, modelName: effectiveModelName } = await this.executeWithModelFallback({
           oc,
           operation: "streamText",
@@ -2190,7 +2190,7 @@ export class Agent {
                     finalText = bailedResult.response;
                   }
                 } else if (guardrailPipeline) {
-                  finalText = await sanitizedTextPromise;
+                  finalText = await getSanitizedTextPromise();
                 } else if (guardrailSet.output.length > 0) {
                   finalText = await executeOutputGuardrails({
                     output: finalResult.text,
@@ -2512,31 +2512,28 @@ export class Agent {
           ? createBaseFullStream()
           : undefined;
 
-        if (guardrailStreamingEnabled) {
-          guardrailPipeline = createGuardrailPipeline(
-            baseFullStreamForPipeline as AsyncIterable<VoltAgentTextStreamPart>,
-            result.textStream,
-            guardrailContext,
-          );
-          sanitizedTextPromise = guardrailPipeline.finalizePromise.then(async () => {
-            const sanitized = guardrailPipeline?.runner?.getSanitizedText();
-            if (typeof sanitized === "string" && sanitized.length > 0) {
-              return sanitized;
-            }
-            // Wait for AI SDK text first (stream must complete)
-            const aiSdkText = await result.text;
+        const createSanitizedTextPromise = (): Promise<string> => {
+          if (guardrailPipeline) {
+            return guardrailPipeline.finalizePromise.then(async () => {
+              const sanitized = guardrailPipeline?.runner?.getSanitizedText();
+              if (typeof sanitized === "string" && sanitized.length > 0) {
+                return sanitized;
+              }
+              // Wait for AI SDK text first (stream must complete)
+              const aiSdkText = await result.text;
+
+              // NOW check for bailed result (set during stream processing)
+              const bailedResult = oc.systemContext.get("bailedResult") as
+                | { agentName: string; response: string }
+                | undefined;
+              return bailedResult?.response || aiSdkText;
+            });
+          }
 
-            // NOW check for bailed result (set during stream processing)
-            const bailedResult = oc.systemContext.get("bailedResult") as
-              | { agentName: string; response: string }
-              | undefined;
-            return bailedResult?.response || aiSdkText;
-          });
-        } else {
           // Wrap result.text with a bail check
           // IMPORTANT: Wait for AI SDK text first (stream must complete/abort)
           // This ensures createStepHandler has processed tool results and set bailedResult
-          sanitizedTextPromise = result.text.then((aiSdkText) => {
+          return Promise.resolve(result.text).then((aiSdkText) => {
             // NOW check if bailed (set by createStepHandler during stream processing)
             const bailedResult = oc.systemContext.get("bailedResult") as
               | { agentName: string; response: string }
@@ -2545,6 +2542,23 @@ export class Agent {
             // Return bailed subagent's result instead of supervisor's (if bailed)
             return bailedResult?.response || aiSdkText;
           });
+        };
+
+        const getSanitizedTextPromise = (): Promise<string> => {
+          sanitizedTextPromise ??= createSanitizedTextPromise();
+          return sanitizedTextPromise;
+        };
+
+        if (guardrailStreamingEnabled) {
+          guardrailPipeline = createGuardrailPipeline(
+            baseFullStreamForPipeline as AsyncIterable<VoltAgentTextStre
```

---

### Incident Patch 10: `41cad535` (2026-05-29)
**Commit Message**: docs: fix broken README links to recipes-and-guides (#1325)

The Airtable Agent and Slack Agent links in README.md and all i18n
variants pointed to /examples/guides/<slug> which returns 404. The
recipes plugin in website/docusaurus.config.ts uses
routeBasePath: 'recipes-and-guides' (line 160), and existing redirects
at lines 467-471 and 531-557 confirm /examples/guides/* was never a
valid route. Updates the 5 README files to use the correct
/recipes-and-guides/<slug> path.

Affected:
- README.md (lines 254-255)
- i18n/README-cn-bsc.md
- i18n/README-cn-traditional.md
- i18n/README-jp.md
- i18n/README-kr.md

Co-authored-by: dymux <putramkti@users.noreply.github.com>

**File**: `README.md` (modified, +2/-2)
```diff
@@ -251,8 +251,8 @@ You can test the pre-built `expenseApprovalWorkflow` directly from the VoltOps c
 
 For more examples, visit our [examples repository](https://github.com/VoltAgent/voltagent/tree/main/examples).
 
-- **[Airtable Agent](https://voltagent.dev/examples/guides/airtable-agent)** - React to new records and write updates back into Airtable with VoltOps actions.
-- **[Slack Agent](https://voltagent.dev/examples/guides/slack-agent)** - Respond to channel messages and reply via VoltOps Slack actions.
+- **[Airtable Agent](https://voltagent.dev/recipes-and-guides/airtable-agent)** - React to new records and write updates back into Airtable with VoltOps actions.
+- **[Slack Agent](https://voltagent.dev/recipes-and-guides/slack-agent)** - Respond to channel messages and reply via VoltOps Slack actions.
 - **[ChatGPT App With VoltAgent](https://voltagent.dev/examples/agents/chatgpt-app)** - Deploy VoltAgent over MCP and connect to ChatGPT Apps.
 - **[WhatsApp Order Agent](https://voltagent.dev/examples/agents/whatsapp-ai-agent)** - Build a WhatsApp chatbot that handles food orders through natural conversation. ([Source](https://github.com/VoltAgent/voltagent/tree/main/examples/with-whatsapp))
 - **[YouTube to Blog Agent](https://voltagent.dev/examples/agents/youtube-blog-agent)** - Convert YouTube videos into Markdown blog posts using a supervisor agent with MCP tools. ([Source](https://github.com/VoltAgent/voltagent/tree/main/examples/with-youtube-to-blog))
```

**File**: `i18n/README-cn-bsc.md` (modified, +2/-2)
```diff
@@ -250,8 +250,8 @@ export const expenseApprovalWorkflow = createWorkflowChain({
 
 有关更多示例，请访问我们的[示例仓库](https://github.com/VoltAgent/voltagent/tree/main/examples)。
 
-- **[Airtable 代理](https://voltagent.dev/examples/guides/airtable-agent)** - 响应新记录并通过 VoltOps 操作将更新写回 Airtable。
-- **[Slack 代理](https://voltagent.dev/examples/guides/slack-agent)** - 响应频道消息并通过 VoltOps Slack 操作进行回复。
+- **[Airtable 代理](https://voltagent.dev/recipes-and-guides/airtable-agent)** - 响应新记录并通过 VoltOps 操作将更新写回 Airtable。
+- **[Slack 代理](https://voltagent.dev/recipes-and-guides/slack-agent)** - 响应频道消息并通过 VoltOps Slack 操作进行回复。
 - **[ChatGPT 应用与 VoltAgent](https://voltagent.dev/examples/agents/chatgpt-app)** - 通过 MCP 部署 VoltAgent 并连接到 ChatGPT 应用。
 - **[WhatsApp 订单代理](https://voltagent.dev/examples/agents/whatsapp-ai-agent)** - 构建一个 WhatsApp 聊天机器人，通过自然对话处理食品订单。([源代码](https://github.com/VoltAgent/voltagent/tree/main/examples/with-whatsapp))
 - **[YouTube 转博客代理](https://voltagent.dev/examples/agents/youtube-blog-agent)** - 使用主管代理与 MCP 工具将 YouTube 视频转换为 Markdown 博客文章。([源代码](https://github.com/VoltAgent/voltagent/tree/main/examples/with-youtube-to-blog))
```

**File**: `i18n/README-cn-traditional.md` (modified, +2/-2)
```diff
@@ -250,8 +250,8 @@ export const expenseApprovalWorkflow = createWorkflowChain({
 
 有關更多範例，請訪問我們的[範例存儲庫](https://github.com/VoltAgent/voltagent/tree/main/examples)。
 
-- **[Airtable 代理](https://voltagent.dev/examples/guides/airtable-agent)** - 響應新記錄並通過 VoltOps 操作將更新寫回 Airtable。
-- **[Slack 代理](https://voltagent.dev/examples/guides/slack-agent)** - 響應頻道訊息並通過 VoltOps Slack 操作進行回覆。
+- **[Airtable 代理](https://voltagent.dev/recipes-and-guides/airtable-agent)** - 響應新記錄並通過 VoltOps 操作將更新寫回 Airtable。
+- **[Slack 代理](https://voltagent.dev/recipes-and-guides/slack-agent)** - 響應頻道訊息並通過 VoltOps Slack 操作進行回覆。
 - **[ChatGPT 應用與 VoltAgent](https://voltagent.dev/examples/agents/chatgpt-app)** - 通過 MCP 部署 VoltAgent 並連接到 ChatGPT 應用。
 - **[WhatsApp 訂單代理](https://voltagent.dev/examples/agents/whatsapp-ai-agent)** - 構建一個 WhatsApp 聊天機器人，通過自然對話處理食品訂單。([原始碼](https://github.com/VoltAgent/voltagent/tree/main/examples/with-whatsapp))
 - **[YouTube 轉部落格代理](https://voltagent.dev/examples/agents/youtube-blog-agent)** - 使用監督者代理與 MCP 工具將 YouTube 視訊轉換為 Markdown 部落格文章。([原始碼](https://github.com/VoltAgent/voltagent/tree/main/examples/with-youtube-to-blog))
```

**File**: `i18n/README-jp.md` (modified, +2/-2)
```diff
@@ -250,8 +250,8 @@ VoltOpsコンソールから直接、事前構築された`expenseApprovalWorkfl
 
 より多くのサンプルについては、[サンプルリポジトリ](https://github.com/VoltAgent/voltagent/tree/main/examples)をご覧ください。
 
-- **[Airtableエージェント](https://voltagent.dev/examples/guides/airtable-agent)** - 新しいレコードに反応し、VoltOpsアクションでAirtableに更新を書き戻します。
-- **[Slackエージェント](https://voltagent.dev/examples/guides/slack-agent)** - チャンネルメッセージに応答し、VoltOps Slackアクションで返信します。
+- **[Airtableエージェント](https://voltagent.dev/recipes-and-guides/airtable-agent)** - 新しいレコードに反応し、VoltOpsアクションでAirtableに更新を書き戻します。
+- **[Slackエージェント](https://voltagent.dev/recipes-and-guides/slack-agent)** - チャンネルメッセージに応答し、VoltOps Slackアクションで返信します。
 - **[ChatGPTアプリとVoltAgent](https://voltagent.dev/examples/agents/chatgpt-app)** - VoltAgentをMCP経由でデプロイし、ChatGPTアプリに接続します。
 - **[WhatsApp注文エージェント](https://voltagent.dev/examples/agents/whatsapp-ai-agent)** - 自然な会話で食品注文を処理するWhatsAppチャットボットを構築します。（[ソースコード](https://github.com/VoltAgent/voltagent/tree/main/examples/with-whatsapp)）
 - **[YouTubeからブログエージェント](https://voltagent.dev/examples/agents/youtube-blog-agent)** - MCPツールを使用したスーパーバイザーエージェントでYouTube動画をMarkdownブログ投稿に変換します。（[ソースコード](https://github.com/VoltAgent/voltagent/tree/main/examples/with-youtube-to-blog)）
```

**File**: `i18n/README-kr.md` (modified, +2/-2)
```diff
@@ -250,8 +250,8 @@ VoltOps 콘솔에서 직접 사전 구축된 `expenseApprovalWorkflow`를 테스
 
 더 많은 예제는 [예제 리포지토리](https://github.com/VoltAgent/voltagent/tree/main/examples)를 방문하세요.
 
-- **[Airtable 에이전트](https://voltagent.dev/examples/guides/airtable-agent)** - 새 레코드에 반응하고 VoltOps 액션으로 Airtable에 업데이트를 작성합니다.
-- **[Slack 에이전트](https://voltagent.dev/examples/guides/slack-agent)** - 채널 메시지에 응답하고 VoltOps Slack 액션으로 답장합니다.
+- **[Airtable 에이전트](https://voltagent.dev/recipes-and-guides/airtable-agent)** - 새 레코드에 반응하고 VoltOps 액션으로 Airtable에 업데이트를 작성합니다.
+- **[Slack 에이전트](https://voltagent.dev/recipes-and-guides/slack-agent)** - 채널 메시지에 응답하고 VoltOps Slack 액션으로 답장합니다.
 - **[ChatGPT 앱과 VoltAgent](https://voltagent.dev/examples/agents/chatgpt-app)** - VoltAgent를 MCP를 통해 배포하고 ChatGPT 앱에 연결합니다.
 - **[WhatsApp 주문 에이전트](https://voltagent.dev/examples/agents/whatsapp-ai-agent)** - 자연스러운 대화로 음식 주문을 처리하는 WhatsApp 챗봇을 구축합니다. ([소스 코드](https://github.com/VoltAgent/voltagent/tree/main/examples/with-whatsapp))
 - **[YouTube to 블로그 에이전트](https://voltagent.dev/examples/agents/youtube-blog-agent)** - MCP 도구를 사용한 감독자 에이전트로 YouTube 비디오를 Markdown 블로그 게시물로 변환합니다. ([소스 코드](https://github.com/VoltAgent/voltagent/tree/main/examples/with-youtube-to-blog))
```

#### Recent Merged Pull Requests:
- **PR #1424** (2026-09-28): ci(changesets): version packages (@voltagent-bot)
- **PR #1423** (2026-09-27): feat(core): allow disabling sandbox command normalization (@jiangjiang248)
- **PR #1405** (closed): feat(internal): add config helpers for configurable defaults and adopt in supabase (@sakaintp)
- **PR #1402** (2026-08-27): fix(core): preserve template replacement tokens (@Iams4kura)
- **PR #1398** (closed): feat: add optional You.com search integration (@mouse-value-add)
- **PR #1397** (closed): fix(evals): keep sampled-out items out of the experiment pass rate (@CTWalk)
- **PR #1393** (2026-08-27): ci(changesets): version packages (@voltagent-bot)
- **PR #1392** (2026-08-03): ci(changesets): version packages (@voltagent-bot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
