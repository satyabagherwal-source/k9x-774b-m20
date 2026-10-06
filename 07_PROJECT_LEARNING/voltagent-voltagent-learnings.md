# Forensic Learning Record (Deep Inspection): VoltAgent/voltagent

> **Canonical Artifact**: `07_PROJECT_LEARNING/voltagent-voltagent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/VoltAgent/voltagent](https://github.com/VoltAgent/voltagent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:16:06.133Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `VoltAgent/voltagent`
- **Description**: AI Agent Engineering Platform built on an Open Source TypeScript AI Agent Framework
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10734 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

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
    return handlePrimitiveType(zodField, "number");
  }
  if (zodField instanceof z.ZodBoolean) {
    return handlePrimitiveType(zodField, "boolean");
  }
  if (zodField instanceof z.ZodArray) {
    return {
      type: "array",
      items: convertZodField(zodField.element),
      ...(zodField.description ? { description: zodField.description } : {}),
    };
  }
  if (zodField instanceof z.ZodEnum) {
    return {
      type: "string",
      enum: zodField._def.values,
      ...(zodField.description ? { description: zodField.description } : {}),
    };
  }
  if (zodField instanceof z.ZodOptional) {
    return convertZodField(zodField.unwrap());
  }
  return { type: "string" };
}

/**
 * Creates a response object from Anthropic's response
 * @param {Message} response - The response from Anthropic
 * @param {string} responseText - The extracted text from the response
 * @param {AnthropicToolCall[]} toolCalls - Tool calls extracted from the response
 * @returns {ProviderTextResponse<any>} A standardized provider response object
 */
export function createResponseObject(
  response: Message,
  responseText: string,
  toolCalls: AnthropicToolCall[],
): ProviderTextResponse<any> {
  return {
    provider: response,
    text: responseText,
    usage: response.usage
      ? {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        }
      : undefined,
    toolCalls: toolCalls,
    finishReason: response.stop_reason as string,
  };
}

/**
 * Creates a step from a chunk of data
 * @param {Object} chunk - The chunk to convert to a step
 * @param {string} chunk.type - The type of the chunk
 * @param {any} chunk[key] - Additional properties of the chunk
 * @returns {StepWithContent|null} A step with content or null if chunk type is unsupported
 */
export function createStepFromChunk(chunk: {
  type: string;
  [key: string]: any;
}): StepWithContent
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
      Include null.              Not included null     type = Type.*.
      [null, Type.*, Type.*]     multiple types.
      [null, Type.*]             [Type.*, Type.*]
            /                                \
      remove null                             \
      add nullable = true                      \
       /                    \                   \
    [Type.*]           [Type.*, Type.*]          \
 only one type left     multiple types left       \
 add type = Type.*.           \                  /
                               \                /
                         not populate the type field in final result
                           and make the types into anyOf fields
                          anyOf:[{type: 'Type.*'}, {type: 'Type.*'}];
*/
function flattenTypeArrayToAnyOf(typeList: string[], resultingSchema: Schema) {
  if (typeList.includes("null")) {
    resultingSchema.nullable = true;
  }
  const listWithoutNull = typeList.filter((type) => type !== "null");

  if (listWithoutNull.length === 1) {
    resultingSchema.type = Object.keys(Type).includes(listWithoutNull[0].toUpperCase())
      ? Type[listWithoutNull[0].toUpperCase() as keyof typeof Type]
      : Type.TYPE_UNSPECIFIED;
  } else {
    resultingSchema.anyOf = [];
    for (const i of listWithoutNull) {
      resultingSchema.anyOf.push({
        type: Object.keys(Type).includes(i.toUpperCase())
          ? Type[i.toUpperCase() as keyof typeof Type]
          : Type.TYPE_UNSPECIFIED,
      });
    }
  }
}

/**
 * Handles the case where a JSONSchema might be nullable via an `anyOf` with 'null'.
 * If it finds such a pattern, it modifies the `genAISchema` to be nullable
 * and returns the non-null schema part. Otherwise, it returns the original schema.
 */
function handleNullableAnyOf(jsonSchema: JSONSchema, genAISchema: Schema): JSONSchema {
  const incomingAnyOf = jsonSchema.anyOf as JSONSchema[] | undefined;
  if (incomingAnyOf?.length === 2) {
    if (incomingAnyOf[0].type === "null") {
      genAISchema.nullable = true;
      return inc
```

### Core Architecture Module: `archive/deprecated-providers/groq-ai/src/utils/index.ts`
```
import type { GroqTools } from "@/types";
import type { Groq } from "groq-sdk";

/**
 * Convert VoltAgent tools to Groq SDK format
 * @param tools Array of agent tools
 * @returns Object mapping tool names to their SDK implementations or undefined if no tools
 */
export const convertToolsForSDK = (tools: any[]): Groq.Chat.ChatCompletionTool[] | undefined => {
  if (!tools || tools.length === 0) {
    return undefined;
  }

  const toolsMap: GroqTools[] = [];

  for (const agentTool of tools) {
    // Wrap the tool with Vercel AI SDK's tool helper
    const sdkTool: GroqTools = {
      type: "function",
      function: {
        name: agentTool.name,
        description: agentTool.description,
        parameters: agentTool.parameters,
      },
    };

    toolsMap.push(sdkTool);
  }

  return toolsMap;
};

```

### Core Architecture Module: `archive/deprecated-providers/vercel-ai/src/utils.ts`
```
import type {
  BaseTool,
  MessageRole,
  StepWithContent,
  StreamPart,
  ToolErrorInfo,
  VoltAgentError,
} from "@voltagent/core";
import { safeStringify } from "@voltagent/internal/utils";
import { type Tool as AiTool, type TextStreamPart, tool as createTool, generateId } from "ai";
import { P, match } from "ts-pattern";

/**
 * Convert VoltAgent tools to Vercel AI SDK format
 * @param tools Array of agent tools
 * @returns Object mapping tool names to their SDK implementations or undefined if no tools
 */
export function convertToolsForSDK(tools: BaseTool[]): Record<string, AiTool> | undefined {
  if (!tools || tools.length === 0) {
    return undefined;
  }
  return tools.reduce<Record<string, AiTool>>((acc, tool) => {
    acc[tool.name] = createTool({
      description: tool.description,
      inputSchema: tool.parameters,
      outputSchema: tool.outputSchema,
      execute: tool.execute,
    });
    return acc;
  }, {});
}

/**
 * Create a step from a chunk
 * @param chunk - The chunk to create a step from
 * @returns The step or null if the chunk is not supported
 */
export function createStepFromChunk(chunk: {
  type: string;
  [key: string]: any;
}): StepWithContent | null {
  return match(chunk)
    .returnType<StepWithContent | null>()
    .when(
      (c) => c.type === "text" && c.text,
      (c) => ({
        id: generateId(),
        type: "text",
        content: c.text,
        role: "assistant" as MessageRole,
        usage: c.usage || undefined,
      }),
    )
    .with({ type: P.union("tool-call", "tool_call") }, (c) => ({
      id: c.toolCallId,
      type: "tool_call",
      name: c.toolName,
      arguments: c.input,
      content: safeStringify([
        {
          type: "tool-call",
          toolCallId: c.toolCallId,
          toolName: c.toolName,
          args: c.input,
        },
      ]),
      role: "assistant" as MessageRole,
      usage: c.usage || undefined,
    }))
    .with({ type: P.union("tool-result", "tool_result") }, (c) => ({
      id: c.toolCallId,
      type: "tool_result",
      name: c.toolName,
      result: c.output,
      content: safeStringify([
        {
          type: "tool-result",
          toolCallId: c.toolCallId,
          toolName: c.toolName,
          result: c.output,
        },
      ]),
      role: "assistant" as MessageRole,
      usage: c.usage || undefined,
    }))
    .otherwise(() => null);
}

export interface AISDKError extends Error {
  toolCallId?: string;
  toolName?: string;
  input?: Record<string, any>;
  code?: string;
}

/**
 * Creates a standardized VoltAgentError from a raw Vercel SDK error object.
 */
export function createVoltagentErrorFromSdkError(
  sdkError: unknown,
  errorStage:
    | "llm_stream"
    | "object_stream"
    | "llm_generate"
    | "object_generate"
    | "tool_execution" = "llm_stream",
): VoltAgentError {
  const originalError = match(sdkError)
    .returnType<AISDKError>()
    .with({ error: P.not(P.nullish) }, (e) => e.error as AISDKError)
    .with(P.instanceOf(Error), (e) => e)
    .otherwise(
      () =>
        new Error(`An unknown error occurred during Vercel AI operation (stage: ${errorStage})`),
    );

  return match(originalError)
    .returnType<VoltAgentError>()
    .with({ toolCallId: P.not(P.nullish), toolName: P.not(P.nullish) }, (e) => ({
      message: `Error during Vercel SDK operation (tool '${e.toolName}'): ${e instanceof Error ? originalError.message : "Unknown tool error"}`,
      originalError: e,
      toolError: {
        toolCallId: e.toolCallId,
        toolName: e.toolName,
        toolArguments: e.input,
        toolExecutionError: e,
      } satisfies ToolErrorInfo,
      stage: "tool_execution",
      code: e.code,
    }))
    .otherwise((e) => ({
      message: e.message,
      originalError: e,
      toolError: undefined,
      stage: errorStage,
      code: e.code,
    }));
}

/**
 * Map Vercel AI TextStreamPart to our standard StreamPart
 * @param part - The part to map
 * @returns The mapped part or null if the part is not supported
 */
export function mapToStreamPart(part: TextStreamPart<Record<string, any>>): StreamPart | null {
  return match(part)
    .returnType<StreamPart | null>()
    .with({ type: "text-delta" }, (p) => ({
      type: "text-delta",
      textDelta: p.text,
    }))
    .with({ type: "reasoning-delta" }, (p) => ({
      type: "reasoning",
      reasoning: p.text,
    }))
    .with({ type: "source", sourceType: "url" }, (p) => ({
      type: "source",
      source: p.url || "",
    }))
    .with({ type: "tool-call" }, (p) => ({
      type: "tool-call",
      toolCallId: p.toolCallId,
      toolName: p.toolName,
      args: p.input as Record<string, any>,
    }))
    .with({ type: "tool-result" }, (p) => ({
      type: "tool-result",
      toolCallId: p.toolCallId,
      toolName: p.toolName,
      result: p.output,
    }))
    .with({ type: "finish" }, (p) => ({
      type: "finish",
      finishReason: p.finishReason,
      usage: match(p)
        .with(
          {
            totalUsage: {
              inputTokens: P.number,
              outputTokens: P.number,
              totalTokens: P.number,
              cachedInputTokens: P.optional(P.number),
              reasoningTokens: P.optional(P.number),
            },
          },
          (p) => ({
            promptTokens: p.totalUsage.inputTokens,
            completionTokens: p.totalUsage.outputTokens,
            totalTokens: p.totalUsage.totalTokens,
            cachedInputTokens: p.totalUsage.cachedInputTokens,
            reasoningTokens: p.totalUsage.reasoningTokens,
          }),
        )
        .otherwise(() => undefined),
    }))
    .with({ type: "error" }, (p) => ({
      type: "error",
      error: p.error as Error,
    }))
    .otherwise(() => null);
}

/**
 * Create mapped fullStream that converts Vercel AI parts to our standard parts
 * @param originalStream - The original stream of parts from the Vercel AI SDK
 * @returns A new stream of parts that are converted to our standard parts
 */
export function createMappedFullStream(
  originalStream: AsyncIterable<TextStreamPart<Record<string, any>>>,
): AsyncIterable<StreamPart> {
  return {
    async *[Symbol.asyncIterator]() {
      for await (const part of originalStream) {
        const mappedPart = mapToStreamPart(part);
        if (mappedPart !== null) {
          yield mappedPart;
        }
      }
    },
  };
}

```

### Core Architecture Module: `archive/deprecated-providers/xsai/src/utils.ts`
```
import type { StreamPart } from "@voltagent/core";
import { P, match } from "ts-pattern";
import type { StreamTextEvent } from "xsai";

/**
 * Map xsAI StreamTextEvent to our standard StreamPart
 * @param part - The part to map
 * @returns The mapped part or null if the part is not supported
 */
export function mapToStreamPart(part: StreamTextEvent): StreamPart | null {
  return (
    match(part)
      .returnType<StreamPart | null>()
      .with({ type: "text-delta" }, (p) => ({
        type: "text-delta",
        textDelta: p.text,
      }))
      .with({ type: "reasoning-delta" }, (p) => ({
        type: "reasoning",
        reasoning: p.text,
      }))
      // TODO: source
      .with({ type: "tool-call" }, (p) => ({
        type: "tool-call",
        toolCallId: p.toolCallId,
        toolName: p.toolName,
        args: JSON.parse(p.args),
      }))
      .with({ type: "tool-result" }, (p) => ({
        type: "tool-result",
        toolCallId: p.toolCallId,
        toolName: p.toolName,
        result: p.result,
      }))
      .with({ type: "finish" }, (p) => ({
        type: "finish",
        finishReason: p.finishReason,
        usage: match(p)
          .with(
            {
              usage: {
                prompt_tokens: P.number,
                completion_tokens: P.number,
                total_tokens: P.number,
              },
            },
            (p) => ({
              promptTokens: p.usage.prompt_tokens,
              completionTokens: p.usage.completion_tokens,
              totalTokens: p.usage.total_tokens,
            }),
          )
          .otherwise(() => undefined),
      }))
      .with({ type: "error" }, (p) => ({
        type: "error",
        error: p.error as Error,
      }))
      .otherwise(() => null)
  );
}

/**
 * Create mapped fullStream that converts xsAI parts to our standard parts
 * @param originalStream - The original stream of parts from the xsAI SDK
 * @returns A new stream of parts that are converted to our standard parts
 */
export function createMappedFullStream(
  originalStream: AsyncIterable<StreamTextEvent>,
): AsyncIterable<StreamPart> {
  return {
    async *[Symbol.asyncIterator]() {
      for await (const part of originalStream) {
        const mappedPart = mapToStreamPart(part);
        if (mappedPart !== null) {
          yield mappedPart;
        }
      }
    },
  };
}

```

### Core Architecture Module: `examples/next-js-chatbot-starter-template/components/ai-elements/queue.tsx`
```
"use client";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, PaperclipIcon } from "lucide-react";
import type { ComponentProps } from "react";

export type QueueMessagePart = {
  type: string;
  text?: string;
  url?: string;
  filename?: string;
  mediaType?: string;
};

export type QueueMessage = {
  id: string;
  parts: QueueMessagePart[];
};

export type QueueTodo = {
  id: string;
  title: string;
  description?: string;
  status?: "pending" | "completed";
};

export type QueueItemProps = ComponentProps<"li">;

export const QueueItem = ({ className, ...props }: QueueItemProps) => (
  <li
    className={cn(
      "group flex flex-col gap-1 rounded-md px-3 py-1 text-sm transition-colors hover:bg-muted",
      className,
    )}
    {...props}
  />
);

export type QueueItemIndicatorProps = ComponentProps<"span"> & {
  completed?: boolean;
};

export const QueueItemIndicator = ({
  completed = false,
  className,
  ...props
}: QueueItemIndicatorProps) => (
  <span
    className={cn(
      "mt-0.5 inline-block size-2.5 rounded-full border",
      completed
        ? "border-muted-foreground/20 bg-muted-foreground/10"
        : "border-muted-foreground/50",
      className,
    )}
    {...props}
  />
);

export type QueueItemContentProps = ComponentProps<"span"> & {
  completed?: boolean;
};

export const QueueItemContent = ({
  completed = false,
  className,
  ...props
}: QueueItemContentProps) => (
  <span
    className={cn(
      "line-clamp-1 grow break-words",
      completed ? "text-muted-foreground/50 line-through" : "text-muted-foreground",
      className,
    )}
    {...props}
  />
);

export type QueueItemDescriptionProps = ComponentProps<"div"> & {
  completed?: boolean;
};

export const QueueItemDescription = ({
  completed = false,
  className,
  ...props
}: QueueItemDescriptionProps) => (
  <div
    className={cn(
      "ml-6 text-xs",
      completed ? "text-muted-foreground/40 line-through" : "text-muted-foreground",
      className,
    )}
    {...props}
  />
);

export type QueueItemActionsProps = ComponentProps<"div">;

export const QueueItemActions = ({ className, ...props }: QueueItemActionsProps) => (
  <div className={cn("flex gap-1", className)} {...props} />
);

export type QueueItemActionProps = Omit<ComponentProps<typeof Button>, "variant" | "size">;

export const QueueItemAction = ({ className, ...props }: QueueItemActionProps) => (
  <Button
    className={cn(
      "size-auto rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted-foreground/10 hover:text-foreground group-hover:opacity-100",
      className,
    )}
    size="icon"
    type="button"
    variant="ghost"
    {...props}
  />
);

export type QueueItemAttachmentProps = ComponentProps<"div">;

export const QueueItemAttachment = ({ className, ...props }: QueueItemAttachmentProps) => (
  <div className={cn("mt-1 flex flex-wrap gap-2", className)} {...props} />
);

export type QueueItemImageProps = ComponentProps<"img">;

export const QueueItemImage = ({ className, ...props }: QueueItemImageProps) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    alt=""
    className={cn("h-8 w-8 rounded border object-cover", className)}
    height={32}
    width={32}
    {...props}
  />
);

export type QueueItemFileProps = ComponentProps<"span">;

export const QueueItemFile = ({ children, className, ...props }: QueueItemFileProps) => (
  <span
    className={cn("flex items-center gap-1 rounded border bg-muted px-2 py-1 text-xs", className)}
    {...props}
  >
    <PaperclipIcon size={12} />
    <span className="max-w-[100px] truncate">{children}</span>
  </span>
);

export type QueueListProps = ComponentProps<typeof ScrollArea>;

export const QueueList = ({ children, className, ...props }: QueueListProps) => (
  <ScrollArea className={cn("-mb-1 mt-2", className)} {...props}>
    <div className="max-h-40 pr-4">
      <ul>{children}</ul>
    </div>
  </ScrollArea>
);

// QueueSection - collapsible section container
export type QueueSectionProps = ComponentProps<typeof Collapsible>;

export const QueueSection = ({ className, defaultOpen = true, ...props }: QueueSectionProps) => (
  <Collapsible className={cn(className)} defaultOpen={defaultOpen} {...props} />
);

// QueueSectionTrigger - section header/trigger
export type QueueSectionTriggerProps = ComponentProps<"button">;

export const QueueSectionTrigger = ({
  children,
  className,
  ...props
}: QueueSectionTriggerProps) => (
  <CollapsibleTrigger asChild>
    <button
      className={cn(
        "group flex w-full items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-left font-medium text-muted-foreground text-sm transition-colors hover:bg-muted",
        className,
      )}
      type="button"
      {...props}
    >
      {children}
    </button>
  </CollapsibleTrigger>
);

// QueueSectionLabel - label content with icon and count
export type QueueSectionLabelProps = ComponentProps<"span"> & {
  count?: number;
  label: string;
  icon?: React.ReactNode;
};

export const QueueSectionLabel = ({
  count,
  label,
  icon,
  className,
  ...props
}: QueueSectionLabelProps) => (
  <span className={cn("flex items-center gap-2", className)} {...props}>
    <ChevronDownIcon className="group-data-[state=closed]:-rotate-90 size-4 transition-transform" />
    {icon}
    <span>
      {count} {label}
    </span>
  </span>
);

// QueueSectionContent - collapsible content area
export type QueueSectionContentProps = ComponentProps<typeof CollapsibleContent>;

export const QueueSectionContent = ({ className, ...props }: QueueSectionContentProps) => (
  <CollapsibleContent className={cn(className)} {...props} />
);

export type QueueProps = ComponentProps<"div">;

export const Queue = ({ className, ...props }: QueueProps) => (
  <div
    className={cn(
      "flex flex-col gap-2 rounded-xl border border-border bg-background px-3 pt-2 pb-2 shadow-xs",
      className,
    )}
    {...props}
  />
);

```

### Core Architecture Module: `examples/next-js-chatbot-starter-template/lib/utils.ts`
```
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

```

### Core Architecture Module: `examples/next-js-chatbot-starter-template/lib/utils/api.ts`
```
/**
 * API Utility Functions
 */

/**
 * Validate required environment variables
 */
export function validateEnvironment(): { valid: boolean; error?: string } {
  // Check if at least one AI provider API key is set
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasGoogle = !!process.env.GOOGLE_API_KEY;
  const hasGroq = !!process.env.GROQ_API_KEY;

  if (!hasOpenAI && !hasAnthropic && !hasGoogle && !hasGroq) {
    return {
      valid: false,
      error: "No AI provider API key found. Please set at least one API key in your .env file.",
    };
  }

  return { valid: true };
}

```

### Core Architecture Module: `examples/with-assistant-ui/hooks/use-mobile.ts`
```
import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

```

### Core Architecture Module: `examples/with-assistant-ui/lib/utils.ts`
```
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

```

### Core Architecture Module: `examples/with-chat-sdk/app/api/webhooks/[platform]/route.ts`
```
import { getBot } from "@/lib/bot";
import { after } from "next/server";

type RouteParams = {
  params: Promise<{
    platform: string;
  }>;
};

export async function POST(request: Request, context: RouteParams) {
  let bot: ReturnType<typeof getBot>;

  try {
    bot = getBot();
  } catch (error) {
    console.error("Failed to initialize Chat SDK bot:", error);
    return new Response(
      "Chat SDK bot is not configured. Set SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET.",
      { status: 500 },
    );
  }

  const { platform } = await context.params;
  const handler = bot.webhooks[platform as keyof typeof bot.webhooks];

  if (!handler) {
    return new Response(`Unknown platform: ${platform}`, { status: 404 });
  }

  return handler(request, {
    waitUntil: (task) => after(() => task),
  });
}

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

Co-Authored-By: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

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
+- [Managed Memory](https://voltagent.dev/docs/agents/memory/managed-memory)
+- [Memory Overview](https://voltagent.dev/docs/agents/memory/overview/)
+
+## License
+
+Licensed under the MIT License, Copyright © 2026-present VoltAgent.
```

---

### Incident Patch 2: `4f50e75e` (2026-08-27)
**Commit Message**: docs(ag-ui): add README with usage examples and CopilotKit integration (#1352)

* docs(ag-ui): add README with usage examples and CopilotKit integration

* docs(ag-ui): add missing @voltagent/core and @ai-sdk/openai to install command

* Update packages/ag-ui/README.md

Co-authored-by: cubic-dev-ai[bot] <191113872+cubic-dev-ai[bot]@users.noreply.github.com>

* Update packages/ag-ui/README.md

Co-authored-by: cubic-dev-ai[bot] <191113872+cubic-dev-ai[bot]@users.noreply.github.com>

* Update packages/ag-ui/README.md

Co-authored-by: cubic-dev-ai[bot] <191113872+cubic-dev-ai[bot]@users.noreply.github.com>

---------

Co-authored-by: Omer Aplak <[REDACTED_EMAIL]>
Co-authored-by: cubic-dev-ai[bot] <191113872+cubic-dev-ai[bot]@users.noreply.github.com>

**File**: `.changeset/ag-ui-readme.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@voltagent/ag-ui": patch
+---
+
+Add README documentation
```

**File**: `packages/ag-ui/README.md` (added, +131/-0)
```diff
@@ -0,0 +1,131 @@
++<div align="center">
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
+[![npm version](https://img.shields.io/npm/v/@voltagent/ag-ui.svg)](https://www.npmjs.com/package/@voltagent/ag-ui)
+[![npm downloads](https://img.shields.io/npm/dm/@voltagent/ag-ui.svg)](https://www.npmjs.com/package/@voltagent/ag-ui)
+[![Discord](https://img.shields.io/discord/1361559153780195478.svg?label=&logo=discord&logoColor=ffffff&color=7389D8&labelColor=6A7EC2)](https://s.voltagent.dev/discord)
+
+</div>
+
+## @voltagent/ag-ui
+
+An [AG-UI](https://github.com/ag-ui-protocol/ag-ui) adapter for VoltAgent. Wrap any VoltAgent `Agent` as an AG-UI `AbstractAgent` that streams VoltAgent events as AG-UI protocol events, and optionally expose it through a [CopilotKit](https://www.copilotkit.ai/) runtime.
+
+---
+
+## Install
+
+```bash
+npm install @voltagent/ag-ui @voltagent/core @ai-sdk/openai @ag-ui/client @ag-ui/core
+# or
+yarn add @voltagent/ag-ui @voltagent/core @ai-sdk/openai @ag-ui/client @ag-ui/core
+# or
+pnpm add @voltagent/ag-ui @voltagent/core @ai-sdk/openai @ag-ui/client @ag-ui/core
+```
+
+Add `@copilotkit/runtime` as well if you plan to use the CopilotKit handlers below.
+
+## Usage
+
+Wrap a VoltAgent agent so it speaks the AG-UI protocol:
+
+```typescript
+import { Agent } from "@voltagent/core";
+import { createVoltAgentAGUI } from "@voltagent/ag-ui";
+import { openai } from "@ai-sdk/openai";
+
+const agent = new Agent({
+  name: "my-agent",
+  instructions: "A helpful assistant",
+  model: openai("gpt-4o-mini"),
+});
+
+const aguiAgent = createVoltAgentAGUI({ agent });
+```
+
+`createVoltAgentAGUI` accepts:
+
+| Option         | Type                                            | Description                                                                          |
+| -------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------ |
+| `agent`        | `Agent`                                         | The VoltAgent agent to expose over AG-UI                                             |
+| `deriveUserId` | `(input: RunAgentInput) => string \| undefined` | Optional function to derive a `userId` for memory/telemetry from the AG-UI run input |
+
+`aguiAgent.run(input)` returns an `Observable<BaseEvent>` that emits AG-UI lifecycle, message, and tool-call events translated from the agent's `streamText` output.
+
+## CopilotKit Integration
+
+Use `createCopilotKitHandler` to get a framework-agnostic fetch handler for a [CopilotKit runtime](https://www.copilotkit.ai/):
+
+```typescript
+import { createCopilotKitHandler, createVoltAgentAGUI } from "@voltagent/ag-ui";
+import { agent } from "./agent"; // a VoltAgent instance
+
+const handler = createCopilotKitHandler({
+  agents: { assistant: createVoltAgentAGUI({ agent }) },
+  endpoint: "/api/copilotkit",
+});
+
+export default {
+  fetch: handler,
+};
+```
+
+Or mount it directly on a Hono-style app with `registerCopilotKitRoutes`, picking agents up from the global `AgentRegistry` instead of wiring them by hand:
+
+```typescript
+import { registerCopilotKitRoutes } from "@voltagent/ag-ui";
+
+registerCopilotKitRoutes({
+  app,
+  resourceIds: ["assistant"], // omit to expose every registered agent
+  path: "/copilotkit",
+});
+```
+
+### `CopilotKitHandlerOptions`
+
+| Option           | Type                                                                            | Default                    | Description                                 |
+| ---------------- | ------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------- |
+| `agents`         | `Record<string, AbstractAgent>`                                                 | —                        | Static map of AG-UI agents                  |
+| `loadAgents`     | `() => Promise<Record<string, AbstractAgent>> \| Record<string, AbstractAgent>` | â€”                        | Lazy loader; overrides `agents` if provided |
+| `serviceAdapter` | `CopilotServiceAdapter`                                        
```

---

### Incident Patch 3: `844939cd` (2026-08-27)
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

### Incident Patch 4: `8dbe100f` (2026-07-13)
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

### Incident Patch 5: `20670754` (2026-07-13)
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
       // Log successful memory operation - PRESERVED
       memoryLogger.debug(`[Memory] Read successful (${messages.length} records)`, {
         event: LogEvents.MEMORY_OPERATION_COMPLETED,
@@ -401,13 +483,17 @@ export class MemoryManager {
         context, // Pass OperationContext to Memory
       );
 
-      memoryLogger.debug(`[Memory] Search successful (${messages.length} records)`, {
+      const filteredMessages = this.filterDelegatedSubAgentMessages(
+        messages as UIMessage<{ createdAt: Date }>[],
+      );
+
+      memoryLogger.debug(`[Memory] Search successful (${filteredMessages.length} records)`, {
         event: LogEvents.MEMORY_OPERATION_COMPLETED,
         operation: "search",
-        messages: messages.length,
+        messages: filteredMessages.length,
       });
 
-      return messages;
+      return filteredMessages;
     } catch (error) {
       memoryLogger.error(
         `Memory search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
@@ -512,6 +598,8 @@ export class MemoryMana
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

**File**: `website/docs/agents/subagents.md` (modified, +1/-0)
```diff
@@ -504,6 +504,7 @@ This tool is automatically added to supervisor agents and handles delegation.
 - **Execution**:
   - Finds the sub-agent instances based on the provided names
   - Calls the `handoffTask` (or `handoffToMultiple`) method internally
+  - Tags delegated sub-agent messages with metadata so supervisor memory reads can exclude sub-agent records
   - Passes the supervisor's agent ID (`parentAgentId`) and history entry ID (`parentHistoryEntryId`) for observability
 - **Returns**:
   - **Always returns an array** of result objects (even for single agent):
```

---

### Incident Patch 6: `6b26a8fb` (2026-07-01)
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

### Incident Patch 7: `9dc0314c` (2026-06-30)
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

### Incident Patch 8: `685f8e4e` (2026-06-08)
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

**File**: `packages/core/src/utils/tool-input.spec.ts` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+import { describe, expect, it } from "vitest";
+
+import { normalizeToolInputForModel } from "./tool-input";
+
+describe("normalizeToolInputForModel", () => {
+  it("keeps plain object tool inputs", () => {
+    const input = { query: "weather" };
+
+    expect(normalizeToolInputForModel(input)).toBe(input);
+  });
+
+  it("parses stringified JSON object tool inputs", () => {
+    expect(normalizeToolInputForModel('{"query":"weather"}')).toEqual({ query: "weather" });
+  });
+
+  it("falls back to an empty object for malformed JSON strings", () => {
+    expect(normalizeToolInputForModel(`{"query":"5'7" woman"}`)).toEqual({});
+  });
+
+  it("falls back to an empty object for non-dictionary values", () => {
+    expect(normalizeToolInputForModel(["weather"])).toEqual({});
+    expect(normalizeToolInputForModel("[1,2,3]")).toEqual({});
+    expect(normalizeToolInputForModel(null)).toEqual({});
+  });
+});
```

**File**: `packages/core/src/utils/tool-input.ts` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+export const isPlainToolInput = (value: unknown): value is Record<string, unknown> => {
+  if (value === null || typeof value !== "object" || Array.isArray(value)) {
+    return false;
+  }
+
+  const prototype = Object.getPrototypeOf(value);
+  return prototype === Object.prototype || prototype === null;
+};
+
+const parseStringifiedToolInput = (value: string): Record<string, unknown> | undefined => {
+  const trimmed = value.trim();
+  if (!trimmed.startsWith("{")) {
+    return undefined;
+  }
+
+  try {
+    const parsed: unknown = JSON.parse(trimmed);
+    return isPlainToolInput(parsed) ? parsed : undefined;
+  } catch {
+    return undefined;
+  }
+};
+
+export const normalizeToolInputForModel = (value: unknown): Record<string, unknown> => {
+  if (isPlainToolInput(value)) {
+    return value;
+  }
+
+  if (typeof value === "string") {
+    return parseStringifiedToolInput(value) ?? {};
+  }
+
+  return {};
+};
```

---

### Incident Patch 9: `9f8c46c1` (2026-05-31)
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

### Incident Patch 10: `a1b44273` (2026-05-31)
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
+            baseFullStreamForPipeline as AsyncIterable<VoltAgentTextStreamPart>,
+            result.textStream,
+            guardrailContext,
+          );
+          void guardrailPipeline.finalizePromise.catch(() => {
+            // The guarded streams surface this error to their consumers. Keep the
+            // internal finalizer promise from leaking when text is never requested.
+          });
         }
 
         const getGuardrailAwareFullStream = (): AsyncIterable<VoltAgentTextStreamPart> => {
@@ -2676,15 +2690,21 @@ export class Agent {
 
         // Create a wrapper that includes context and delegates to the original result
         const resultWithContext: StreamTextResultWithContext = {
-          text: sanitizedTextPromise,
+          get text() {
+            return getSanitizedTextPromise();
+          },
           get textStream() {
             return getGuardrailAwareTextStream();
           },
           get fullStream() {
             return getGuardrailAwareFullStream();
           },
-          usage: result.usage,
-          f
```

---

### Incident Patch 11: `41cad535` (2026-05-29)
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

Co-authored-by: dymux <[REDACTED_EMAIL]>

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

---

### Incident Patch 12: `91abbb45` (2026-05-29)
**Commit Message**: fix(server-core): validate workflow ownership on control endpoints (#1318)

* fix(server-core): validate workflow ownership on control endpoints

* chore(ci): rerun flaky build checks

* fix(server-core): harden workflow control request validation

---------

Co-authored-by: Ruan Chaves <[REDACTED_EMAIL]>

**File**: `.changeset/workflow-control-ownership.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+---
+"@voltagent/server-core": patch
+"@voltagent/server-hono": patch
+"@voltagent/serverless-hono": patch
+"@voltagent/server-elysia": patch
+---
+
+Validate workflow ownership before suspend and cancel control routes act on an execution.
+
+Fixes #1316.
```

**File**: `packages/server-core/src/handlers/workflow.handlers.spec.ts` (modified, +13/-1)
```diff
@@ -1,6 +1,6 @@
 import type { ServerProviderDeps, WorkflowStateEntry } from "@voltagent/core";
 import { describe, expect, it, vi } from "vitest";
-import { handleListWorkflowRuns } from "./workflow.handlers";
+import { createWorkflowControlRequestBody, handleListWorkflowRuns } from "./workflow.handlers";
 
 function createWorkflowState(
   id: string,
@@ -190,3 +190,15 @@ describe("handleListWorkflowRuns", () => {
     );
   });
 });
+
+describe("createWorkflowControlRequestBody", () => {
+  it("rejects primitive JSON bodies and annotates object bodies with the route workflow id", () => {
+    expect(createWorkflowControlRequestBody("invalid", "wf-1")).toBeUndefined();
+    expect(createWorkflowControlRequestBody(1, "wf-1")).toBeUndefined();
+    expect(createWorkflowControlRequestBody(["invalid"], "wf-1")).toBeUndefined();
+    expect(createWorkflowControlRequestBody({ reason: "pause" }, "wf-1")).toEqual({
+      __workflowId: "wf-1",
+      reason: "pause",
+    });
+  });
+});
```

**File**: `packages/server-core/src/handlers/workflow.handlers.ts` (modified, +54/-2)
```diff
@@ -630,13 +630,51 @@ export async function handleAttachWorkflowStream(
   }
 }
 
+async function isWorkflowExecutionOwnedByRoute(
+  body: WorkflowControlRequestBody | undefined,
+  executionId: string,
+  deps: ServerProviderDeps,
+) {
+  const workflowId = body?.__workflowId;
+  if (typeof workflowId !== "string" || workflowId.trim().length === 0) {
+    return false;
+  }
+
+  return (
+    (
+      await deps.workflowRegistry
+        .getWorkflow(workflowId)
+        ?.workflow.memory.getWorkflowState(executionId)
+    )?.workflowId === workflowId
+  );
+}
+
+export type WorkflowControlRequestBody = Record<string, unknown> & {
+  __workflowId: string;
+  reason?: string;
+};
+
+export function createWorkflowControlRequestBody(
+  body: unknown,
+  workflowId: string,
+): WorkflowControlRequestBody | undefined {
+  if (!body || typeof body !== "object" || Array.isArray(body)) {
+    return undefined;
+  }
+
+  return {
+    ...(body as Record<string, unknown>),
+    __workflowId: workflowId,
+  };
+}
+
 /**
  * Handler for suspending a workflow
  * Returns suspension result
  */
 export async function handleSuspendWorkflow(
   executionId: string,
-  body: any,
+  body: WorkflowControlRequestBody | undefined,
   deps: ServerProviderDeps,
   logger: Logger,
 ): Promise<ApiResponse> {
@@ -650,6 +688,13 @@ export async function handleSuspendWorkflow(
       };
     }
 
+    if (!(await isWorkflowExecutionOwnedByRoute(body, executionId, deps))) {
+      return {
+        success: false,
+        error: "Workflow execution not found or already completed",
+      };
+    }
+
     const suspendController = deps.workflowRegistry.activeExecutions.get(executionId);
 
     if (!suspendController) {
@@ -694,7 +739,7 @@ export async function handleSuspendWorkflow(
  */
 export async function handleCancelWorkflow(
   executionId: string,
-  body: any,
+  body: WorkflowControlRequestBody | undefined,
   deps: ServerProviderDeps,
   logger: Logger,
 ): Promise<ApiResponse> {
@@ -708,6 +753,13 @@ export async function handleCancelWorkflow(
       };
     }
 
+    if (!(await isWorkflowExecutionOwnedByRoute(body, executionId, deps))) {
+      return {
+        success: false,
+        error: "No active execution found or workflow already completed",
+      };
+    }
+
     const suspendController = deps.workflowRegistry.activeExecutions.get(executionId);
 
     if (!suspendController) {
```

**File**: `packages/server-core/src/handlers/workflow.stream-attach.handlers.spec.ts` (modified, +125/-2)
```diff
@@ -3,7 +3,12 @@ import type { Logger } from "@voltagent/internal";
 import { describe, expect, it, vi } from "vitest";
 import type { ErrorResponse } from "../types/responses";
 import { isErrorResponse } from "../types/responses";
-import { handleAttachWorkflowStream, handleStreamWorkflow } from "./workflow.handlers";
+import {
+  handleAttachWorkflowStream,
+  handleCancelWorkflow,
+  handleStreamWorkflow,
+  handleSuspendWorkflow,
+} from "./workflow.handlers";
 
 type ParsedSSEEvent = {
   id?: string;
@@ -48,7 +53,7 @@ function createDeps(options?: {
   const stream = options?.streamFactory ? options.streamFactory : vi.fn();
 
   const workflow = {
-    createSuspendController: vi.fn().mockReturnValue(createSuspendController()),
+    createSuspendController: vi.fn().mockImplementation(createSuspendController),
     stream,
     memory: {
       getWorkflowState,
@@ -120,6 +125,65 @@ function assertErrorResponse(
   expect(isErrorResponse(value)).toBe(true);
 }
 
+async function startBlockingWorkflowExecution(action: string) {
+  const logger = createLogger();
+  let releaseStream = () => {};
+  const streamBlocked = new Promise<void>((resolve) => {
+    releaseStream = resolve;
+  });
+  const executionId = `exec-${action}-1`;
+  const { deps } = createDeps({
+    workflowState: {
+      id: executionId,
+      workflowId: "wf-1",
+      workflowName: "Workflow 1",
+      status: "running",
+      createdAt: new Date(),
+      updatedAt: new Date(),
+    },
+    streamFactory: () => ({
+      executionId,
+      [Symbol.asyncIterator]: async function* () {
+        yield {
+          type: "workflow-start",
+          executionId,
+          from: "Workflow 1",
+          status: "running",
+          timestamp: new Date().toISOString(),
+        };
+        await streamBlocked;
+      },
+      result: Promise.resolve({ ok: true }),
+      status: Promise.resolve("completed"),
+      endAt: Promise.resolve(new Date("2026-01-01T00:00:00.000Z")),
+    }),
+  });
+
+  const streamResponse = await handleStreamWorkflow("wf-1", { input: {} }, deps, logger);
+  expect(isErrorResponse(streamResponse)).toBe(false);
+
+  if (isErrorResponse(streamResponse)) {
+    throw new Error("Expected active workflow stream");
+  }
+
+  const streamReader = streamResponse.getReader();
+  await readSSEEvent(streamReader);
+
+  const controller = deps.workflowRegistry.activeExecutions?.get(executionId) as ReturnType<
+    typeof createSuspendController
+  >;
+  expect(controller).toBeDefined();
+
+  return {
+    controller,
+    deps,
+    executionId,
+    logger,
+    releaseStream,
+    streamReader,
+  };
+}
+
 describe("workflow stream attach handler", () => {
   it("returns 404 when workflow does not exist", async () => {
     const logger = createLogger();
@@ -260,4 +324,63 @@ describe("workflow stream attach handler", () => {
     const attachedFinal = await readSSEEvent(attachedReader);
     expect(attachedFinal.data.type).toBe("workflow-result");
   });
+
+  it.each([
+    {
+      action: "suspend",
+      error: "not found",
+      handler: handleSuspendWorkflow,
+      method: "suspend",
+    },
+    {
+      action: "cancel",
+      error: "No active execution found",
+      handler: handleCancelWorkflow,
+      method: "cancel",
+    },
+  ])(
+    "rejects $action requests on the wrong workflow route",
+    async ({ action, error, handler, method }) => {
+      const { controller, deps, executionId, logger, releaseStream, streamReader } =
+        await startBlockingWorkflowExecution(action);
+
+      const wrongRouteResponse = await handler(
+        executionId,
+        { __workflowId: "wf-2", reason: "wrong route" },
+        deps,
+        logger,
+      );
+
+      expect(wrongRouteResponse.success).toBe(false);
+      expect((wrongRouteResponse as ErrorResponse).error).toContain(error);
+      expect(controller[method]).not.toHaveBeenCalled();
+      expect(deps.workflowRegistry.activeExecutions?.has(executionId)).toBe(true);
+
+      const missingRouteResponse = await handler(
+        executionId,
+        { reason: "missing route id" } as any,
+        deps,
+        logger,
+      );
+
+      expect(missingRouteResponse.success).toBe(false);
+      expect((missingRouteResponse as ErrorResponse).error).toContain(error);
+      expect(controller[method]).not.toHaveBeenCalled();
+      expect(deps.workflowRegistry.activeExecutions?.has(executionId)).toBe(true);
+
+      const correctRouteResponse = await handler(
+        executionId,
+        { __workflowId: "wf-1", reason: "correct route" },
+        deps,
+        logger,
+      );
+
+      expect(correctRouteResponse.success).toBe(true);
+      expect(controller[method]).toHaveBeenCalledWith("correct route");
+      expect(deps.workflowRegistry.activeExecutions?.has(executionId)).toBe(false);
+
+      releaseStream();
+      await streamReader.cancel();
+    },
+  );
 });
```

**File**: `packages/server-elysia/src/routes/workflow.routes.ts` (modified, +13/-2)
```diff
@@ -1,6 +1,7 @@
 import type { ServerProviderDeps } from "@voltagent/core";
 import type { Logger } from "@voltagent/internal";
 import {
+  createWorkflowControlRequestBody,
   handleAttachWorkflowStream,
   handleCancelWorkflow,
   handleExecuteWorkflow,
@@ -287,7 +288,12 @@ export function registerWorkflowRoutes(
   app.post(
     "/workflows/:id/executions/:executionId/suspend",
     async ({ params, body, set }) => {
-      const response = await handleSuspendWorkflow(params.executionId, body, deps, logger);
+      const response = await handleSuspendWorkflow(
+        params.executionId,
+        createWorkflowControlRequestBody(body, params.id),
+        deps,
+        logger,
+      );
       if (!response.success) {
         const errorMessage = response.error || "";
         set.status = errorMessage.includes("not found")
@@ -320,7 +326,12 @@ export function registerWorkflowRoutes(
   app.post(
     "/workflows/:id/executions/:executionId/cancel",
     async ({ params, body, set }) => {
-      const response = await handleCancelWorkflow(params.executionId, body, deps, logger);
+      const response = await handleCancelWorkflow(
+        params.executionId,
+        createWorkflowControlRequestBody(body, params.id),
+        deps,
+        logger,
+      );
       if (!response.success) {
         const errorMessage = response.error || "";
         set.status = errorMessage.includes("not found")
```

**File**: `packages/server-hono/src/routes/index.ts` (modified, +3/-2)
```diff
@@ -2,6 +2,7 @@ import type { ServerProviderDeps } from "@voltagent/core";
 import type { Logger } from "@voltagent/internal";
 import {
   UPDATE_ROUTES,
+  createWorkflowControlRequestBody,
   handleAttachWorkflowStream,
   handleCancelWorkflow,
   handleChatStream,
@@ -412,7 +413,7 @@ export function registerWorkflowRoutes(
     if (!executionId) {
       throw new Error("Missing execution id parameter");
     }
-    const body = await c.req.json();
+    const body = createWorkflowControlRequestBody(await c.req.json(), c.req.param("id"));
     const response = await handleSuspendWorkflow(executionId, body, deps, logger);
     if (!response.success) {
       return c.json(response, 500);
@@ -426,7 +427,7 @@ export function registerWorkflowRoutes(
     if (!executionId) {
       throw new Error("Missing execution id parameter");
     }
-    const body = await c.req.json();
+    const body = createWorkflowControlRequestBody(await c.req.json(), c.req.param("id"));
     const response = await handleCancelWorkflow(executionId, body, deps, logger);
     if (!response.success) {
       const errorMessage = response.error || "";
```

**File**: `packages/serverless-hono/src/routes.ts` (modified, +3/-2)
```diff
@@ -33,6 +33,7 @@ import {
   type TriggerHttpRequestContext,
   UPDATE_ROUTES,
   WORKFLOW_ROUTES,
+  createWorkflowControlRequestBody,
   executeA2ARequest,
   executeTriggerHandler,
   getConversationMessagesHandler,
@@ -528,7 +529,7 @@ export function registerWorkflowRoutes(app: Hono, deps: ServerProviderDeps, logg
 
   app.post(WORKFLOW_ROUTES.suspendWorkflow.path, async (c) => {
     const executionId = c.req.param("executionId");
-    const body = await readJsonBody(c, logger);
+    const body = createWorkflowControlRequestBody(await readJsonBody(c, logger), c.req.param("id"));
     if (!body) {
       return c.json({ success: false, error: "Invalid JSON body" }, 400);
     }
@@ -547,7 +548,7 @@ export function registerWorkflowRoutes(app: Hono, deps: ServerProviderDeps, logg
 
   app.post(WORKFLOW_ROUTES.cancelWorkflow.path, async (c) => {
     const executionId = c.req.param("executionId");
-    const body = await readJsonBody(c, logger);
+    const body = createWorkflowControlRequestBody(await readJsonBody(c, logger), c.req.param("id"));
     if (!body) {
       return c.json({ success: false, error: "Invalid JSON body" }, 400);
     }
```

---

### Incident Patch 13: `738e7b05` (2026-05-25)
**Commit Message**: fix(server-core): return workflow execute status (#1301)

Co-authored-by: Ruan Chaves <[REDACTED_EMAIL]>

**File**: `.changeset/bright-penguins-bow.md` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+---
+"@voltagent/server-core": patch
+---
+
+fix(server-core): return workflow execute result status
+
+Fixes #1300
```

**File**: `packages/server-core/src/handlers/workflow.handlers.ts` (modified, +1/-1)
```diff
@@ -468,7 +468,7 @@ export async function handleExecuteWorkflow(
           executionId: result.executionId,
           startAt: result.startAt instanceof Date ? result.startAt.toISOString() : result.startAt,
           endAt: result.endAt instanceof Date ? result.endAt.toISOString() : result.endAt,
-          status: "completed",
+          status: result.status,
           result: result.result,
         },
       };
```

---

### Incident Patch 14: `d2824fa4` (2026-05-22)
**Commit Message**: feat(examples): add Xquik tools example (#1289)

* feat(examples): add Xquik tools example

* docs: add Xquik tool docstrings

---------

Co-authored-by: kriptoburak <[REDACTED_EMAIL]>

**File**: `examples/README.md` (modified, +1/-0)
```diff
@@ -135,6 +135,7 @@ Create a multi-agent research workflow where different AI agents collaborate to
 - [Sub‑agents](./with-subagents) — Supervisor orchestrates focused sub‑agents to divide tasks.
 - [Supabase](./with-supabase) — Use Supabase auth/database in tools and server endpoints.
 - [Tavily Search](./with-tavily-search) — Augment answers with web results from Tavily.
+- [Xquik Tools](./with-xquik-tools) — Research public X/Twitter posts, users, and trends with Xquik tools.
 - [Thinking Tool](./with-thinking-tool) — Structured reasoning via a dedicated “thinking” tool and schema.
 - [Tool Routing](./with-tool-routing) — Route large tool pools through a small set of router tools.
 - [Tools](./with-tools) — Author Zod‑typed tools with cancellation and streaming support.
```

**File**: `examples/with-xquik-tools/.env.example` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+OPENAI_API_KEY=your_openai_api_key_here
+XQUIK_API_KEY=your_xquik_api_key_here
+XQUIK_BASE_URL=https://xquik.com/api/v1
```

**File**: `examples/with-xquik-tools/README.md` (added, +107/-0)
```diff
@@ -0,0 +1,107 @@
+# VoltAgent with Xquik Tools
+
+This example shows how to add Xquik REST API tools to a VoltAgent research agent for public X/Twitter data.
+
+## Features
+
+- Search public posts with X query operators
+- Look up posts by ID with author, metrics, and media
+- Look up public user profiles by username or ID
+- Fetch recent public posts from a user
+- Retrieve public X/Twitter trends by WOEID region
+
+## Prerequisites
+
+1. **Xquik API Key**: Create an API key from the [Xquik dashboard](https://dashboard.xquik.com)
+2. **OpenAI API Key**: Used by the example agent model
+
+## Setup
+
+1. Install dependencies:
+
+   ```bash
+   pnpm install
+   ```
+
+2. Configure environment variables:
+
+   ```bash
+   cp .env.example .env
+   ```
+
+   Then edit `.env`:
+
+   ```env
+   OPENAI_API_KEY=your_openai_api_key_here
+   XQUIK_API_KEY=your_xquik_api_key_here
+   XQUIK_BASE_URL=https://xquik.com/api/v1
+   ```
+
+3. Run the example:
+
+   ```bash
+   pnpm dev
+   ```
+
+The agent runs on the default VoltAgent server port and exposes one agent named `xquikResearchAgent`.
+
+## Tools Available
+
+### 1. Search X Posts
+
+- **Purpose**: Search public X/Twitter posts with X query operators
+- **Endpoint**: `GET /x/tweets/search`
+- **Parameters**:
+  - `query`: Search query string
+  - `queryType`: `Latest` or `Top`
+  - `limit`: Maximum posts to return
+  - `cursor`: Optional pagination cursor
+  - `sinceTime`, `untilTime`: Optional ISO 8601 time bounds
+
+### 2. Get X Post
+
+- **Purpose**: Look up a public post by ID
+- **Endpoint**: `GET /x/tweets/{id}`
+
+### 3. Get X User
+
+- **Purpose**: Look up a public user profile by username or ID
+- **Endpoint**: `GET /x/users/{id}`
+
+### 4. Get X User Posts
+
+- **Purpose**: Fetch recent public posts from a user
+- **Endpoint**: `GET /x/users/{id}/tweets`
+- **Parameters**:
+  - `user`: Username without `@`, or numeric user ID
+  - `cursor`: Optional pagination cursor
+  - `includeReplies`: Include replies
+  - `includeParentTweet`: Include parent posts for replies
+
+### 5. Get X Trends
+
+- **Purpose**: Fetch public trends by WOEID region
+- **Endpoint**: `GET /x/trends`
+- **Parameters**:
+  - `woeid`: Region WOEID, with `1` for worldwide
+  - `count`: Number of trends to return
+
+## Example Queries
+
+- "Search recent posts about AI agent frameworks and summarize the top themes."
+- "Look up @voltagent_dev and summarize recent public posts."
+- "Find worldwide X trends and explain which ones relate to developer tools."
+- "Get this post by ID and extract the author, timestamp, and engagement metrics."
+
+## API Integration
+
+This example uses the Xquik public REST API with the `x-api-key` header and the `xquik-api-contract` header set to `2026-04-29`.
+
+See the [Xquik API reference](https://docs.xquik.com/api-reference/overview) for endpoint details.
+
+## Troubleshooting
+
+- **Missing API key**: Set `XQUIK_API_KEY` in `.env`.
+- **Authentication errors**: Create a fresh API key from the Xquik dashboard.
+- **Empty results**: Try a broader query, switch between `Latest` and `Top`, or remove time bounds.
+- **Regional trends**: Use WOEID `1` for worldwide, `23424977` for the US, or another supported region.
```

**File**: `examples/with-xquik-tools/package.json` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+{
+  "name": "voltagent-example-with-xquik-tools",
+  "author": "",
+  "dependencies": {
+    "@voltagent/cli": "^0.1.21",
+    "@voltagent/core": "^2.7.4",
+    "@voltagent/logger": "^2.0.2",
+    "@voltagent/server-hono": "^2.0.13",
+    "ai": "^6.0.0",
+    "zod": "^3.25.76"
+  },
+  "devDependencies": {
+    "@types/node": "^24.2.1",
+    "tsx": "^4.21.0",
+    "typescript": "^5.8.2"
+  },
+  "keywords": [
+    "agent",
+    "ai",
+    "twitter",
+    "voltagent",
+    "xquik"
+  ],
+  "license": "MIT",
+  "private": true,
+  "repository": {
+    "type": "git",
+    "url": "https://github.com/VoltAgent/voltagent.git",
+    "directory": "examples/with-xquik-tools"
+  },
+  "scripts": {
+    "build": "tsc",
+    "dev": "tsx watch --env-file=.env ./src",
+    "start": "node dist/index.js",
+    "volt": "volt"
+  },
+  "type": "module"
+}
```

**File**: `examples/with-xquik-tools/src/index.ts` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+import { Agent, VoltAgent } from "@voltagent/core";
+import { createPinoLogger } from "@voltagent/logger";
+import { honoServer } from "@voltagent/server-hono";
+import { xquikTools } from "./tools";
+
+const logger = createPinoLogger({
+  name: "xquik-tools-agent",
+  level: "info",
+});
+
+const xquikResearchAgent = new Agent({
+  name: "xquik-research-agent",
+  instructions: `You help developers research public X/Twitter activity with Xquik tools.
+
+Use the tools for post search, post lookup, user lookup, user posts, and trends.
+Prefer concise answers with source IDs, usernames, timestamps, and relevant metrics.
+If a tool reports a missing API key or HTTP error, explain the setup or retry path clearly.`,
+  model: "openai/gpt-4o-mini",
+  tools: xquikTools,
+});
+
+new VoltAgent({
+  agents: {
+    xquikResearchAgent,
+  },
+  logger,
+  server: honoServer(),
+});
```

**File**: `examples/with-xquik-tools/src/tools.ts` (added, +194/-0)
```diff
@@ -0,0 +1,194 @@
+import { createTool } from "@voltagent/core";
+import { z } from "zod";
+
+const XQUIK_API_CONTRACT = "2026-04-29";
+const DEFAULT_XQUIK_BASE_URL = "https://xquik.com/api/v1";
+const XQUIK_REQUEST_TIMEOUT_MS = 20_000;
+
+type XquikQueryParams = Record<string, boolean | number | string | undefined>;
+
+type XquikResult = {
+  data?: unknown;
+  error?: string;
+  status?: number;
+  success: boolean;
+};
+
+const queryTypeSchema = z.enum(["Latest", "Top"]);
+
+/**
+ * Returns the configured Xquik API base URL without a trailing slash.
+ */
+function getXquikBaseUrl(): string {
+  return (process.env.XQUIK_BASE_URL ?? DEFAULT_XQUIK_BASE_URL).replace(/\/+$/, "");
+}
+
+/**
+ * Normalizes an X username or user ID for use in URL path segments.
+ */
+function encodeXIdentifier(value: string): string {
+  const identifier = value.trim().replace(/^@+/, "");
+  if (!identifier) {
+    throw new Error("A username or user ID is required.");
+  }
+  return encodeURIComponent(identifier);
+}
+
+/**
+ * Adds defined query parameters to a request URL.
+ */
+function appendQueryParams(url: URL, params: XquikQueryParams): void {
+  for (const [key, value] of Object.entries(params)) {
+    if (value === undefined || value === "") {
+      continue;
+    }
+
+    url.searchParams.set(key, typeof value === "boolean" ? String(value) : String(value));
+  }
+}
+
+/**
+ * Calls a read-only Xquik REST endpoint and returns a tool-friendly result.
+ */
+async function callXquik(path: string, params: XquikQueryParams = {}): Promise<XquikResult> {
+  const apiKey = process.env.XQUIK_API_KEY;
+  if (!apiKey) {
+    return {
+      success: false,
+      error: "XQUIK_API_KEY is not set. Add it to .env before calling live Xquik tools.",
+    };
+  }
+
+  const url = new URL(`${getXquikBaseUrl()}${path}`);
+  appendQueryParams(url, params);
+
+  const controller = new AbortController();
+  const timeout = setTimeout(() => controller.abort(), XQUIK_REQUEST_TIMEOUT_MS);
+
+  try {
+    const response = await fetch(url, {
+      headers: {
+        "x-api-key": apiKey,
+        "xquik-api-contract": XQUIK_API_CONTRACT,
+      },
+      method: "GET",
+      signal: controller.signal,
+    });
+
+    if (!response.ok) {
+      const body = (await response.text()).slice(0, 500);
+      return {
+        success: false,
+        status: response.status,
+        error: `Xquik API returned HTTP ${response.status}: ${body || response.statusText}`,
+      };
+    }
+
+    return {
+      success: true,
+      data: await response.json(),
+    };
+  } catch (error) {
+    return {
+      success: false,
+      error: error instanceof Error ? error.message : "Xquik request failed.",
+    };
+  } finally {
+    clearTimeout(timeout);
+  }
+}
+
+/**
+ * Searches public X/Twitter posts with Xquik query operators.
+ */
+export const searchXPostsTool = createTool({
+  name: "searchXPosts",
+  description:
+    "Search recent public X/Twitter posts with X query operators, chronological or engagement-ranked sorting, and pagination.",
+  parameters: z.object({
+    query: z
+      .string()
+      .min(1)
+      .describe('Search query, such as "agent frameworks", "from:voltagent_dev", or "#AI".'),
+    queryType: queryTypeSchema.optional().describe('Sort order. Use "Latest" or "Top".'),
+    limit: z.number().int().min(1).max(50).optional().describe("Maximum posts to return."),
+    cursor: z.string().optional().describe("Pagination cursor from a previous response."),
+    sinceTime: z.string().optional().describe("ISO 8601 timestamp to search after."),
+    untilTime: z.string().optional().describe("ISO 8601 timestamp to search before."),
+  }),
+  execute: async ({ query, queryType = "Latest", limit = 10, cursor, sinceTime, untilTime }) =>
+    callXquik("/x/tweets/search", {
+      q: query,
+      queryType,
+      limit,
+      cursor,
+      sinceTime,
+      untilTime,
+    }),
+});
+
+/**
+ * Looks up a public X/Twitter post by ID.
+ */
+export const getXPostTool = createTool({
+  name: "getXPost",
+  description:
+    "Look up a public X/Twitter post by ID and return its text, author, metrics, and media.",
+  parameters: z.object({
+    postId: z.string().min(1).describe("Numeric X/Twitter post ID."),
+  }),
+  execute: async ({ postId }) => callXquik(`/x/tweets/${encodeURIComponent(postId.trim())}`),
+});
+
+/**
+ * Looks up a public X/Twitter user profile by username or ID.
+ */
+export const getXUserTool = createTool({
+  name: "getXUser",
+  description: "Look up a public X/Twitter user profile by username or user ID.",
+  parameters: z.object({
+    user: z.string().min(1).describe("X username without @, or a numeric X user ID."),
+  }),
+  execute: async ({ user }) => callXquik(`/x/users/${encodeXIdentifier(user)}`),
+});
+
+/**
+ * Fetches recent public posts for an X/Twitter user.
+ */
+export const getXUserPostsTool = createTool({
+  name: "getXUserPosts",
+  description: "Fetch recent public posts from an X/Twitter use
```

**File**: `examples/with-xquik-tools/tsconfig.json` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+{
+  "compilerOptions": {
+    "target": "ES2022",
+    "module": "ESNext",
+    "moduleResolution": "bundler",
+    "outDir": "dist",
+    "esModuleInterop": true,
+    "allowSyntheticDefaultImports": true,
+    "strict": true,
+    "skipLibCheck": true,
+    "declaration": true,
+    "declarationMap": true,
+    "sourceMap": true
+  },
+  "include": ["src/**/*"]
+}
```

**File**: `pnpm-lock.yaml` (modified, +31/-0)
```diff
@@ -3566,6 +3566,37 @@ importers:
         specifier: ^5.8.2
         version: 5.9.3
 
+  examples/with-xquik-tools:
+    dependencies:
+      '@voltagent/cli':
+        specifier: ^0.1.21
+        version: link:../../packages/cli
+      '@voltagent/core':
+        specifier: ^2.7.4
+        version: link:../../packages/core
+      '@voltagent/logger':
+        specifier: ^2.0.2
+        version: link:../../packages/logger
+      '@voltagent/server-hono':
+        specifier: ^2.0.13
+        version: link:../../packages/server-hono
+      ai:
+        specifier: ^6.0.0
+        version: 6.0.3(zod@3.25.76)
+      zod:
+        specifier: ^3.25.76
+        version: 3.25.76
+    devDependencies:
+      '@types/node':
+        specifier: ^24.2.1
+        version: 24.6.2
+      tsx:
+        specifier: ^4.21.0
+        version: 4.21.0
+      typescript:
+        specifier: ^5.8.2
+        version: 5.9.3
+
   examples/with-youtube-to-blog:
     dependencies:
       '@voltagent/cli':
```

---

### Incident Patch 15: `23cc35a0` (2026-05-22)
**Commit Message**: fix(core): honor Retry-After header on retried model calls (#1283)

* fix(core): honor Retry-After header on retried model calls

The retry loop in `executeWithModelFallback` always used local exponential
backoff capped at 10 seconds, regardless of what the server asked for.
Under shared provider contention this caused concurrent agents to converge
their retry windows into the same window the provider had just told them
to wait past, amplifying load on already-overloaded endpoints.

Move the retry-delay math into a small `retry-after` module that parses
both delta-seconds and HTTP-date forms (RFC 7231 §7.1.3), takes the server
hint as a floor, keeps the exponential floor as a backpressure baseline,
and caps at 5 minutes so a misconfigured or hostile server cannot pin the
agent for hours.

Closes #1276.

* fix(core): match Retry-After header case-insensitively

`responseHeaders` is normalized to lowercase by the AI SDK, but providers
that build the bag from a raw `fetch` Response can leak any casing
through, so the lookup needs to match RFC 7230 §3.2 case-insensitively
instead of only checking `retry-after` and `Retry-After`.

Adds three regression tests for mixed-case spellings.

**File**: `.changeset/honor-retry-after-header.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@voltagent/core": patch
+---
+
+Honor the provider's `Retry-After` header on retried model calls. The retry loop in `executeWithModelFallback` previously always used local exponential backoff capped at 10 seconds, regardless of what the server asked for; this caused concurrent agents under shared 429/503 contention to converge their retry windows. The delay now uses `Retry-After` (delta-seconds or HTTP-date, RFC 7231) as a floor, keeps the exponential floor as a backpressure baseline, and caps at 5 minutes for safety.
```

**File**: `packages/core/src/agent/agent.spec.ts` (modified, +65/-0)
```diff
@@ -3689,6 +3689,71 @@ Use pandas and summarize findings.`.split("\n"),
       }
     });
 
+    it("should honor the Retry-After header on retried model calls", async () => {
+      const agent = new Agent({
+        name: "RetryAfterAgent",
+        instructions: "Test",
+        model: mockModel as any,
+        maxRetries: 1,
+      });
+
+      const mockResponse = {
+        text: "Retry response",
+        content: [{ type: "text", text: "Retry response" }],
+        reasoning: [],
+        files: [],
+        sources: [],
+        toolCalls: [],
+        toolResults: [],
+        finishReason: "stop",
+        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
+        warnings: [],
+        request: {},
+        response: {
+          id: "retry-after-response",
+          modelId: "test-model",
+          timestamp: new Date(),
+          messages: [],
+        },
+        steps: [],
+      };
+
+      const observedDelays: number[] = [];
+      const originalSetTimeout = global.setTimeout;
+      const setTimeoutSpy = vi.spyOn(global, "setTimeout").mockImplementation(((
+        cb: any,
+        delay: any,
+        ...args: any[]
+      ) => {
+        if (typeof delay === "number") observedDelays.push(delay);
+        return originalSetTimeout(cb, 0, ...args);
+      }) as typeof setTimeout);
+
+      let callCount = 0;
+      vi.mocked(ai.generateText).mockImplementation(async () => {
+        callCount += 1;
+        if (callCount < 2) {
+          const error = new Error("Rate limited");
+          (error as any).isRetryable = true;
+          (error as any).statusCode = 429;
+          (error as any).responseHeaders = { "retry-after": "30" };
+          throw error;
+        }
+        return mockResponse as any;
+      });
+
+      try {
+        const result = await agent.generateText("Test");
+
+        expect(result.text).toBe("Retry response");
+        expect(vi.mocked(ai.generateText)).toHaveBeenCalledTimes(2);
+        // attemptIndex=0: exponential floor=1000ms, server hint=30000ms ⇒ delay=30000.
+        expect(observedDelays).toContain(30_000);
+      } finally {
+        setTimeoutSpy.mockRestore();
+      }
+    });
+
     it("should handle model errors gracefully", async () => {
       const agent = new Agent({
         name: "TestAgent",
```

**File**: `packages/core/src/agent/agent.ts` (modified, +2/-1)
```diff
@@ -120,6 +120,7 @@ import type {
   ToolExecuteOptions,
   UsageInfo,
 } from "./providers/base/types";
+import { computeRetryDelayMs } from "./retry-after";
 import { coerceStringifiedJsonToolArgs } from "./tool-input-coercion";
 export type { AgentHooks } from "./hooks";
 export type {
@@ -5885,7 +5886,7 @@ export class Agent {
           const canRetry = retryEligible && !isLastAttempt;
 
           if (canRetry) {
-            const retryDelayMs = Math.min(1000 * 2 ** attemptIndex, 10000);
+            const retryDelayMs = computeRetryDelayMs(error, attemptIndex);
             logger.debug(`[Agent:${this.name}] - Model attempt failed, retrying`, {
               operation,
               modelName,
```

**File**: `packages/core/src/agent/retry-after.spec.ts` (added, +122/-0)
```diff
@@ -0,0 +1,122 @@
+import { describe, expect, it } from "vitest";
+import { computeRetryDelayMs, getRetryAfterMs, parseRetryAfter } from "./retry-after";
+
+const FIXED_NOW = Date.parse("2026-05-14T20:00:00Z");
+
+describe("parseRetryAfter", () => {
+  it("returns null for missing values", () => {
+    expect(parseRetryAfter(undefined)).toBeNull();
+    expect(parseRetryAfter(null)).toBeNull();
+    expect(parseRetryAfter("")).toBeNull();
+    expect(parseRetryAfter("   ")).toBeNull();
+  });
+
+  it("parses delta-seconds form", () => {
+    expect(parseRetryAfter("0")).toBe(0);
+    expect(parseRetryAfter("1")).toBe(1000);
+    expect(parseRetryAfter("120")).toBe(120 * 1000);
+    expect(parseRetryAfter("  30  ")).toBe(30 * 1000);
+  });
+
+  it("rejects non-integer delta-seconds forms", () => {
+    expect(parseRetryAfter("1.5")).toBeNull();
+    expect(parseRetryAfter("10ms")).toBeNull();
+    expect(parseRetryAfter("-5")).toBeNull();
+    expect(parseRetryAfter("0x10")).toBeNull();
+  });
+
+  it("parses HTTP-date form into a relative delay", () => {
+    const fiveSecondsLater = new Date(FIXED_NOW + 5000).toUTCString();
+    expect(parseRetryAfter(fiveSecondsLater, FIXED_NOW)).toBe(5000);
+  });
+
+  it("returns 0 when the HTTP-date has already passed", () => {
+    const pastDate = new Date(FIXED_NOW - 60_000).toUTCString();
+    expect(parseRetryAfter(pastDate, FIXED_NOW)).toBe(0);
+  });
+
+  it("returns null for malformed HTTP-date strings", () => {
+    expect(parseRetryAfter("Definitely not a date")).toBeNull();
+    expect(parseRetryAfter("Fri, 99 Foo 9999 99:99:99 GMT")).toBeNull();
+  });
+
+  it("clamps very large delta-seconds to the 5-minute safety cap", () => {
+    expect(parseRetryAfter("3600")).toBe(5 * 60 * 1000);
+    expect(parseRetryAfter("999999")).toBe(5 * 60 * 1000);
+  });
+
+  it("clamps very far-future HTTP-dates to the 5-minute safety cap", () => {
+    const farFuture = new Date(FIXED_NOW + 60 * 60 * 1000).toUTCString();
+    expect(parseRetryAfter(farFuture, FIXED_NOW)).toBe(5 * 60 * 1000);
+  });
+});
+
+describe("getRetryAfterMs", () => {
+  it("reads lowercased header from responseHeaders", () => {
+    const err = { responseHeaders: { "retry-after": "10" } };
+    expect(getRetryAfterMs(err)).toBe(10_000);
+  });
+
+  it("accepts the canonical-case spelling too", () => {
+    const err = { responseHeaders: { "Retry-After": "10" } };
+    expect(getRetryAfterMs(err)).toBe(10_000);
+  });
+
+  it("prefers lowercase over canonical when both are present", () => {
+    const err = { responseHeaders: { "retry-after": "5", "Retry-After": "999" } };
+    expect(getRetryAfterMs(err)).toBe(5_000);
+  });
+
+  it("matches the header name case-insensitively", () => {
+    expect(getRetryAfterMs({ responseHeaders: { "Retry-after": "7" } })).toBe(7_000);
+    expect(getRetryAfterMs({ responseHeaders: { "RETRY-AFTER": "8" } })).toBe(8_000);
+    expect(getRetryAfterMs({ responseHeaders: { "rEtRy-AfTeR": "9" } })).toBe(9_000);
+  });
+
+  it("returns null when the header is absent", () => {
+    expect(getRetryAfterMs({ responseHeaders: {} })).toBeNull();
+    expect(getRetryAfterMs({ responseHeaders: { "x-foo": "bar" } })).toBeNull();
+  });
+
+  it("returns null when there are no response headers at all", () => {
+    expect(getRetryAfterMs({})).toBeNull();
+    expect(getRetryAfterMs(null)).toBeNull();
+    expect(getRetryAfterMs(undefined)).toBeNull();
+    expect(getRetryAfterMs(new Error("plain"))).toBeNull();
+  });
+});
+
+describe("computeRetryDelayMs", () => {
+  it("falls back to exponential when no Retry-After is provided", () => {
+    const err = new Error("transient");
+    expect(computeRetryDelayMs(err, 0)).toBe(1000);
+    expect(computeRetryDelayMs(err, 1)).toBe(2000);
+    expect(computeRetryDelayMs(err, 2)).toBe(4000);
+    expect(computeRetryDelayMs(err, 3)).toBe(8000);
+    expect(computeRetryDelayMs(err, 4)).toBe(10_000);
+    expect(computeRetryDelayMs(err, 10)).toBe(10_000);
+  });
+
+  it("uses the server's Retry-After as a floor when it exceeds the exponential floor", () => {
+    const err = { responseHeaders: { "retry-after": "30" } };
+    expect(computeRetryDelayMs(err, 0)).toBe(30_000);
+    expect(computeRetryDelayMs(err, 4)).toBe(30_000);
+  });
+
+  it("keeps the exponential floor when Retry-After is shorter", () => {
+    const err = { responseHeaders: { "retry-after": "0" } };
+    expect(computeRetryDelayMs(err, 0)).toBe(1000);
+    expect(computeRetryDelayMs(err, 3)).toBe(8000);
+  });
+
+  it("honors HTTP-date Retry-After values", () => {
+    const tenSecondsLater = new Date(FIXED_NOW + 10_000).toUTCString();
+    const err = { responseHeaders: { "retry-after": tenSecondsLater } };
+    expect(computeRetryDelayMs(err, 0, FIXED_NOW)).toBe(10_000);
+  });
+
+  it("respects the 5-minute safety cap even when the server asks for longer", () => {
+    const err = { responseHeaders: { "retry-after": "999999" } };
+    expect(computeRetryDelayMs(err, 0
```

**File**: `packages/core/src/agent/retry-after.ts` (added, +112/-0)
```diff
@@ -0,0 +1,112 @@
+/**
+ * Cap how long we'll honor a server-supplied `Retry-After` header.
+ * A misconfigured or hostile server can otherwise pin an agent for hours.
+ */
+const MAX_RETRY_AFTER_MS = 5 * 60 * 1000;
+
+/**
+ * Parse an HTTP `Retry-After` header value (RFC 7231 §7.1.3) into milliseconds.
+ *
+ * Accepts the two RFC-defined forms:
+ *   - delta-seconds: a non-negative integer (e.g. `Retry-After: 120`)
+ *   - HTTP-date:     a fixed-form HTTP date (e.g. `Retry-After: Fri, 31 Dec 1999 23:59:59 GMT`)
+ *
+ * Returns `null` when the value is absent, empty, malformed, or negative.
+ * The result is clamped to {@link MAX_RETRY_AFTER_MS}.
+ *
+ * @param value     The raw header value, or `undefined`/`null` when absent.
+ * @param nowMs     Current time in milliseconds, injected for tests. Defaults to `Date.now()`.
+ */
+export function parseRetryAfter(
+  value: string | undefined | null,
+  nowMs: number = Date.now(),
+): number | null {
+  if (value == null) {
+    return null;
+  }
+
+  const trimmed = value.trim();
+  if (trimmed === "") {
+    return null;
+  }
+
+  if (/^\d+$/.test(trimmed)) {
+    const seconds = Number.parseInt(trimmed, 10);
+    if (!Number.isFinite(seconds) || seconds < 0) {
+      return null;
+    }
+    return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
+  }
+
+  // HTTP-date form mandates a day-name and month-name (RFC 7231 §7.1.1.1),
+  // so an HTTP-date always contains ASCII letters. Reject numeric-looking
+  // values like "1.5", "10ms", or "-5" before falling into `Date.parse`,
+  // which is permissive enough to coerce some of them into past dates.
+  if (!/[A-Za-z]/.test(trimmed)) {
+    return null;
+  }
+
+  const dateMs = Date.parse(trimmed);
+  if (Number.isNaN(dateMs)) {
+    return null;
+  }
+
+  const delta = dateMs - nowMs;
+  if (delta <= 0) {
+    return 0;
+  }
+  return Math.min(delta, MAX_RETRY_AFTER_MS);
+}
+
+/**
+ * Read the `Retry-After` header off an error's `responseHeaders` bag and return
+ * its parsed value in milliseconds, or `null` when absent.
+ *
+ * HTTP header field names are case-insensitive (RFC 7230 §3.2). AI SDK normalizes
+ * its own bag to lowercase, but providers that build `responseHeaders` from a raw
+ * fetch can leak any casing through, so we match the key case-insensitively.
+ */
+export function getRetryAfterMs(error: unknown, nowMs: number = Date.now()): number | null {
+  const headers = (error as { responseHeaders?: Record<string, string> } | undefined)
+    ?.responseHeaders;
+  if (!headers || typeof headers !== "object") {
+    return null;
+  }
+  let raw: string | undefined;
+  for (const key of Object.keys(headers)) {
+    if (key.toLowerCase() === "retry-after") {
+      raw = headers[key];
+      break;
+    }
+  }
+  return parseRetryAfter(raw, nowMs);
+}
+
+/**
+ * Compute the wait between two retry attempts.
+ *
+ * When the provider supplies a `Retry-After` header (typical on 429 and 503),
+ * use it as the floor — the server has just told us the earliest moment it's
+ * willing to serve another request, and ignoring that signal causes
+ * coordinated retry-storms across concurrent agents.
+ *
+ * In every case we keep the exponential floor as a backpressure baseline so a
+ * `Retry-After: 0` (or an absent header on transient errors) still spaces
+ * subsequent attempts out.
+ *
+ * @param error          The error thrown by the model invocation.
+ * @param attemptIndex   Zero-based retry attempt index.
+ * @param nowMs          Current time in ms, injected for tests.
+ */
+export function computeRetryDelayMs(
+  error: unknown,
+  attemptIndex: number,
+  nowMs: number = Date.now(),
+): number {
+  const exponentialMs = Math.min(1000 * 2 ** attemptIndex, 10000);
+  const serverHintMs = getRetryAfterMs(error, nowMs);
+  if (serverHintMs == null) {
+    return exponentialMs;
+  }
+  return Math.max(serverHintMs, exponentialMs);
+}
```

#### Recent Merged Pull Requests:
- **PR #1424** (2026-09-28): ci(changesets): version packages (@voltagent-bot)
- **PR #1423** (2026-09-27): feat(core): allow disabling sandbox command normalization (@jiangjiang248)
- **PR #1405** (closed): feat(internal): add config helpers for configurable defaults and adopt in supabase (@sakaintp)
- **PR #1402** (2026-08-27): fix(core): preserve template replacement tokens (@Iams4kura)
- **PR #1397** (closed): fix(evals): keep sampled-out items out of the experiment pass rate (@CTWalk)
- **PR #1393** (2026-08-27): ci(changesets): version packages (@voltagent-bot)
- **PR #1392** (2026-08-03): ci(changesets): version packages (@voltagent-bot)
- **PR #1380** (2026-07-13): ci(changesets): version packages (@voltagent-bot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
