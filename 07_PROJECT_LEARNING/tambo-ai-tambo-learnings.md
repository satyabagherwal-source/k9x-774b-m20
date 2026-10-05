# Forensic Learning Record (Deep Inspection): tambo-ai/tambo

> **Canonical Artifact**: `07_PROJECT_LEARNING/tambo-ai-tambo-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tambo-ai/tambo](https://github.com/tambo-ai/tambo))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:47:24.186Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tambo-ai/tambo`
- **Description**: Generative UI SDK for React
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 11182 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/api/src/common/utils/extract-context-info.ts`
```
import { BadRequestException } from "@nestjs/common";
import { Request } from "express";
import { SdkVersion } from "../middleware/sdk-version.middleware";
import { ProjectId } from "../../projects/guards/apikey.guard";
import { ContextKey } from "../../projects/guards/bearer-token.guard";

export interface ContextInfo {
  projectId: string;
  contextKey?: string;
  sdkVersion?: string;
}

/**
 * Extracts project ID and context key from the request.
 *
 * The project ID comes from either:
 * - API key authentication (set by ApiKeyGuard)
 * - OAuth bearer token authentication (set by BearerTokenGuard)
 *
 * The context key can come from:
 * - API query parameter (apiContextKey)
 * - OAuth bearer token (set by BearerTokenGuard)
 *
 * If both API parameter and bearer token provide a context key, an exception is thrown
 * as only one source is allowed, with bearer token taking priority.
 *
 * @param request - Express request object
 * @param apiContextKey - Optional context key from API query parameter
 * @returns Object containing projectId and contextKey
 * @throws BadRequestException if project ID is missing or both context key sources are provided
 */
export function extractContextInfo(
  request: Request,
  apiContextKey: string | undefined,
): ContextInfo {
  const projectId = request[ProjectId];
  if (!projectId) {
    throw new BadRequestException("Project ID is required");
  }

  const bearerContextKey = request[ContextKey];

  // Check if both context key sources are provided
  if (apiContextKey && bearerContextKey) {
    throw new BadRequestException(
      "Context key cannot be provided both via API parameter and OAuth bearer token. Use only one method.",
    );
  }

  // Bearer token context key takes priority, treat empty string as falsy
  const contextKey = bearerContextKey || apiContextKey || undefined;

  return {
    projectId,
    contextKey,
    sdkVersion: request[SdkVersion],
  };
}

```

### Core Architecture Module: `apps/api/src/common/utils/generate-context-key.ts`
```
/**
 * Generates a unique context key for OAuth authentication based on the original
 * issuer and organizational claims from various enterprise identity providers.
 *
 * Supports enterprise identity providers with organizational context:
 * - Google Workspace: Uses 'hd' (hosted domain) claim
 * - Microsoft Azure AD: Uses 'tid' (tenant ID) claim
 * - WorkOS: Uses 'org_id' claims
 * - Auth0 Organizations: Uses 'org_id' claims
 * - Generic providers: Falls back to issuer hostname
 *
 * Context key formats:
 * - Google consumer: oauth:user:accounts.google.com:${sub}
 * - Google Workspace: oauth:user:accounts.google.com:${hd}:${sub}
 * - Microsoft Azure AD: oauth:user:login.microsoftonline.com:${tid}:${sub}
 * - WorkOS/Auth0 with org: oauth:user:${hostname}:${org_id}:${sub}
 * - Other providers: oauth:user:${hostname}:${sub}
 * - Legacy fallback: oauth:user:${sub}
 *
 * @param originalIssuer - The original OAuth issuer URL from the token
 * @param orgClaims - Object containing organizational claims from the token
 * @param sub - The subject (user ID) from the token
 * @returns A unique context key string
 */
export function generateContextKey(
  originalIssuer: unknown,
  orgClaims: {
    // Google Workspace
    hd?: unknown;
    // Microsoft Azure AD
    tid?: unknown;
    // WorkOS, Auth0, and other enterprise providers
    org_id?: unknown;
  },
  sub: string,
): string {
  // Legacy fallback if no issuer information is available
  if (!originalIssuer || typeof originalIssuer !== "string") {
    return `oauth:user:${sub}`;
  }

  // Parse the issuer URL safely
  let issuerHostname: string;
  try {
    issuerHostname = new URL(originalIssuer).hostname;
  } catch {
    console.warn("Failed to parse issuer URL from token: ", originalIssuer);
    // If URL parsing fails, use the issuer as-is but sanitized
    issuerHostname = originalIssuer.replace(/[^a-zA-Z0-9.-]/g, "_");
  }

  // Handle Google Workspace vs consumer accounts
  if (
    issuerHostname === "accounts.google.com" &&
    orgClaims.hd &&
    typeof orgClaims.hd === "string" &&
    orgClaims.hd.trim() !== ""
  ) {
    return `oauth:user:${issuerHostname}:${orgClaims.hd}:${sub}`;
  }

  // Handle Microsoft Azure AD/Entra ID with tenant context
  if (
    (issuerHostname === "login.microsoftonline.com" ||
      issuerHostname.endsWith(".microsoftonline.com") ||
      issuerHostname === "sts.windows.net") &&
    orgClaims.tid &&
    typeof orgClaims.tid === "string" &&
    orgClaims.tid.trim() !== ""
  ) {
    return `oauth:user:${issuerHostname}:${orgClaims.tid}:${sub}`;
  }

  // Handle WorkOS, Auth0, and other enterprise providers with org_id
  if (
    orgClaims.org_id &&
    typeof orgClaims.org_id === "string" &&
    orgClaims.org_id.trim() !== ""
  ) {
    return `oauth:user:${issuerHostname}:${orgClaims.org_id}:${sub}`;
  }

  // Standard provider without organizational context
  return `oauth:user:${issuerHostname}:${sub}`;
}

```

### Core Architecture Module: `apps/api/src/common/utils/oauth.ts`
```
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import {
  decryptOAuthSecretKey,
  McpAccessTokenPayload,
  OAuthValidationMode,
  OidcProviderConfig,
  SessionlessMcpAccessTokenPayload,
  TAMBO_MCP_ACCESS_KEY_CLAIM,
} from "@tambo-ai-cloud/core";
import { createHash } from "node:crypto";
import {
  createRemoteJWKSet,
  decodeJwt,
  importJWK,
  importSPKI,
  importX509,
  JWTPayload,
  jwtVerify,
} from "jose";
import { CorrelationLoggerService } from "../services/logger.service";

// Security constants
const ALLOWED_SYMMETRIC_ALGORITHMS = ["HS256", "HS384", "HS512"];
const ALLOWED_ASYMMETRIC_ALGORITHMS = [
  "RS256",
  "RS384",
  "RS512",
  "ES256",
  "ES384",
  "ES512",
  "PS256",
  "PS384",
  "PS512",
];
const FETCH_TIMEOUT_MS = 5000;
const MAX_JSON_SIZE = 10000; // 10KB limit for JSON parsing

// Allowed issuer domains - configure based on your requirements
const _ALLOWED_ISSUER_DOMAINS = [
  "accounts.google.com",
  "login.microsoftonline.com",
  "auth0.com",
  // Add your trusted OAuth providers here
];

/**
 * Creates a synthetic JWTPayload for opaque (non-JWT) access tokens by hashing the token
 * to produce a deterministic subject identifier.
 *
 * @returns A JWTPayload with `sub` set to `opaque:<sha256-hash>` and no other claims.
 */
function createOpaqueTokenPayload(token: string): JWTPayload {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return { sub: `opaque:${tokenHash}` };
}

/**
 * Validates that a URL is safe for external requests (prevents SSRF)
 */
function validateExternalUrl(url: string): void {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new UnauthorizedException("Invalid issuer URL format");
  }

  // Only allow HTTPS
  if (parsedUrl.protocol !== "https:") {
    throw new UnauthorizedException("OAuth issuer must use HTTPS");
  }

  // Prevent internal/private network access
  const hostname = parsedUrl.hostname.toLowerCase();

  // Block localhost and loopback
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("127.")
  ) {
    throw new UnauthorizedException("OAuth issuer cannot be localhost");
  }

  // Block private networks
  if (
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    (hostname.startsWith("172.") && /^172\.(1[6-9]|2\d|3[01])\./.test(hostname))
  ) {
    throw new UnauthorizedException(
      "OAuth issuer cannot be in private network",
    );
  }

  // Block metadata services
  if (
    hostname === "169.254.169.254" ||
    hostname === "metadata.google.internal"
  ) {
    throw new UnauthorizedException("OAuth issuer cannot be metadata service");
  }

  // Optional: Enforce allowed domains (uncomment if you want strict domain allowlist)
  // const isAllowedDomain = _ALLOWED_ISSUER_DOMAINS.some(domain =>
  //   hostname === domain || hostname.endsWith('.' + domain)
  // );
  // if (!isAllowedDomain) {
  //   throw new UnauthorizedException(`OAuth issuer domain not allowed: ${hostname}`);
  // }
}

/**
 * Makes a fetch request with timeout and security checks
 */
async function secureFetch(
  url: string,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  validateExternalUrl(url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Tambo-OAuth-Validator/1.0",
        Accept: "application/json",
        ...extraHeaders,
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new UnauthorizedException("OAuth configuration request timeout");
    }
    throw error;
  }
}

/**
 * Resolves a stable user identity from an opaque access token by calling the
 * provider's userinfo endpoint (e.g., `https://api.github.com/user`).
 *
 * @returns A JWTPayload with `sub` and `iss` on success, or `null` on transient failure (5xx/timeout).
 */
async function resolveUserinfoIdentity(
  token: string,
  userinfoEndpoint: string,
  logger: CorrelationLoggerService,
): Promise<JWTPayload | null> {
  // Validate URL before attempting fetch — SSRF errors must hard-reject, not fall back
  validateExternalUrl(userinfoEndpoint);

  let response: Response;
  try {
    response = await secureFetch(userinfoEndpoint, {
      Authorization: `Bearer ${token}`,
    });
  } catch (error) {
    // Timeout or network error — transient failure, fall back to hash
    logger.warn(
      `Userinfo endpoint request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    return null;
  }

  // 401/403 means the token is revoked/invalid at the provider — hard reject
  if (response.status === 401 || response.status === 403) {
    throw new UnauthorizedException("Token rejected by identity provider");
  }

  // Other non-2xx — transient failure, fall back to hash
  if (!response.ok) {
    logger.warn(
      `Userinfo endpoint returned ${response.status}: ${response.statusText}`,
    );
    return null;
  }

  const text = await response.text();
  if (text.length > MAX_JSON_SIZE) {
    logger.warn("Userinfo response too large, falling back to hash");
    return null;
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    logger.warn("Userinfo response is not valid JSON, falling back to hash");
    return null;
  }

  // Response is typed as Record<string, unknown> because it could be an OIDC UserInfo response
  // or a provider-specific REST response (e.g., GitHub). No shared type exists in jose or the codebase.
  // Extract subject: prefer `sub` (OIDC UserInfo standard — https://openid.net/specs/openid-connect-core-1_0.html#UserInfo),
  // then `id` (GitHub/REST APIs that don't follow OIDC — https://docs.github.com/en/rest/users/users#get-the-authenticated-user)
  const rawSub = body.sub ?? body.id;
  if (rawSub === undefined || rawSub === null) {
    throw new UnauthorizedException(
      "Userinfo response missing both 'sub' and 'id' fields",
    );
  }

  const sub = String(rawSub);
  const iss = new URL(userinfoEndpoint).origin;

  return { sub, iss };
}

/**
 * Validates and verifies an OAuth subject token based on the configured validation mode
 */
export async function validateSubjectToken(
  subjectToken: string,
  validationMode: OAuthValidationMode,
  oauthSettings: {
    secretKeyEncrypted?: string | null;
    publicKey?: string | null;
    userinfoEndpoint?: string | null;
  } | null,
  logger: CorrelationLoggerService,
): Promise<JWTPayload> {
  // Basic input validation
  if (!subjectToken || typeof subjectToken !== "string") {
    throw new BadRequestException("Invalid subject token format");
  }

  if (subjectToken.length > 8192) {
    // 8KB limit for JWTs
    throw new BadRequestException("Subject token too large");
  }

  // Ensure API_KEY_SECRET is available for encryption operations
  if (!process.env.API_KEY_SECRET) {
    logger.error("API_KEY_SECRET environment variable not set");
    throw new UnauthorizedException("Server configuration error");
  }

  switch (validationMode) {
    case OAuthValidationMode.NONE: {
      // Some OAuth providers (e.g., GitHub) issue opaque access tokens instead of JWTs.
      // In NONE mode we accept both formats: try decoding as JWT first, and on failure
      // treat as opaque — resolve identity via userinfo endpoint, or hash as last resort.
      try {
        const payload = decodeJwt(subjectToken);

        // Even in NONE mode, we should check token expiry for security
        if (payload.exp && typeof payload.exp === "number") {
          const currentTime = Math.floor(Date.now() / 1000);
          if (payload.exp < currentTime) {
            throw new UnauthorizedException("Token has expired");
          }
        }

        return payload;
      } catch (error) {
        // Re-throw auth errors (e.g., expired token)
        if (error instanceof UnauthorizedException) {
          throw error;
        }

        // decodeJwt failed — token is not a valid JWT, treat as opaque
        logger.log(
          "Subject token is not a valid JWT, treating as opaque access token",
        );
      }

      // If a userinfo endpoint is configured, it MUST resolve — no silent fallback to hash,
      // which would give the user a different identity and different threads.
      if (oauthSettings?.userinfoEndpoint) {
        const userinfoPayload = await resolveUserinfoIdentity(
          subjectToken,
          oauthSettings.userinfoEndpoint,
          logger,
        );
        if (userinfoPayload) {
          return userinfoPayload;
        }
        throw new UnauthorizedException(
          "Failed to resolve user identity from configured userinfo endpoint",
        );
      }

      // No userinfo endpoint configured — hash fallback is the only option
      return createOpaqueTokenPayload(subjectToken);
    }

    case OAuthValidationMode.SYMMETRIC: {
      if (!oauthSettings?.secretKeyEncrypted) {
        throw new UnauthorizedException(
          "OAuth symmetric validation configured but no secret key found",
        );
      }

      const secretKey = decryptOAuthSecretKey(
        oauthSettings.secretKeyEncrypted,
        process.env.API_KEY_SECRET,
      );

      if (!secretKey || secretKey.length < 32) {
        throw new UnauthorizedException(
          "OAuth secret key too short or invalid",
        );
      }

      const symmetricKey = new TextEncoder().encode(secretKey);
      const { payload } = await jwtVerify(subjectToken, symmetricKey, {
        algorithms: ALLOWED_SYMMETRIC_ALGORITHMS,
      });
      return payload;
    }

    case OAuthValidationMode.ASYMMETRIC_MANUAL: {
      if (!oauthSettings?.publicKey) {
        throw new UnauthorizedExceptio
```

### Core Architecture Module: `apps/api/src/threads/dto/stream-queue-item.ts`
```
import type { BaseEvent } from "@ag-ui/core";
import type { AdvanceThreadResponseDto } from "./advance-thread.dto";

/**
 * Compound type for items in the streaming queue.
 *
 * Contains both the traditional AdvanceThreadResponseDto (for backwards
 * compatibility with existing code) and optional AG-UI events (for V1 API).
 *
 * Producers populate aguiEvents from the AI SDK delta events.
 * Consumers can:
 * - Use `response` for existing advanceThread behavior
 * - Use `aguiEvents` for V1 API streaming
 */
export interface StreamQueueItem {
  /**
   * The traditional response object containing the thread message DTO,
   * generation stage, and status information.
   */
  response: AdvanceThreadResponseDto;

  /**
   * AG-UI events generated from the current streaming delta.
   * May contain 0-N events depending on the delta type.
   *
   * Events use types from @ag-ui/core:
   * - TextMessageStartEvent, TextMessageContentEvent, TextMessageEndEvent
   * - ToolCallStartEvent, ToolCallArgsEvent, ToolCallEndEvent
   * - ThinkingTextMessageStartEvent, etc.
   */
  aguiEvents?: BaseEvent[];
}

```

### Core Architecture Module: `apps/api/src/threads/util/attachment-fetcher.ts`
```
import { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { S3Client } from "@aws-sdk/client-s3";
import { getFile } from "@tambo-ai-cloud/backend";
import { parseAttachmentUri } from "@tambo-ai-cloud/core";

/**
 * Non-text MIME types that should still be treated as text content.
 * The isTextMimeType function also checks for the "text/" prefix,
 * so this set only needs application/* types that are text-based.
 */
const TEXT_MIME_TYPES = new Set([
  "application/json",
  "application/xml",
  "application/javascript",
]);

/**
 * Check if a MIME type should be treated as text content.
 */
function isTextMimeType(mimeType: string): boolean {
  return mimeType.startsWith("text/") || TEXT_MIME_TYPES.has(mimeType);
}

/**
 * Create an attachment fetcher function that can be registered with the ResourceFetcherMap.
 * This fetcher handles attachment:// URIs by retrieving files from S3 storage.
 *
 * The attachment URI format is: attachment://{projectId}/{uniqueId}
 * The actual S3 key includes a signature suffix for security.
 *
 * @param s3Client - Configured S3Client instance
 * @param bucket - S3 bucket name where attachments are stored
 * @param allowedProjectId - The project ID that is allowed to access attachments
 * @param signingSecret - Secret used to verify and reconstruct S3 keys
 * @returns A function that fetches attachment content by URI
 *
 * @example
 * const fetcher = createAttachmentFetcher(s3Client, "user-files", "p_123abc", "secret");
 * const result = await fetcher("attachment://p_123abc/Ab3xY9kLmN");
 */
export function createAttachmentFetcher(
  s3Client: S3Client,
  bucket: string,
  allowedProjectId: string,
  signingSecret: string,
): (uri: string) => Promise<ReadResourceResult> {
  if (!allowedProjectId.trim()) {
    throw new Error("allowedProjectId must be non-empty");
  }

  if (!signingSecret) {
    throw new Error("signingSecret must be non-empty");
  }

  return async (uri: string): Promise<ReadResourceResult> => {
    // Parse the URI and reconstruct the storage key with signature
    const { projectId, storageKey } = parseAttachmentUri(uri, signingSecret);

    // Verify the project ID matches the allowed project
    if (projectId !== allowedProjectId) {
      throw new Error("Attachment access denied");
    }

    // Get file content and ContentType from S3 metadata
    const { buffer, contentType } = await getFile(s3Client, bucket, storageKey);

    if (isTextMimeType(contentType)) {
      return {
        contents: [
          {
            uri,
            mimeType: contentType,
            text: buffer.toString("utf-8"),
          },
        ],
      };
    }

    return {
      contents: [
        {
          uri,
          mimeType: contentType,
          blob: buffer.toString("base64"),
        },
      ],
    };
  };
}

```

### Core Architecture Module: `apps/api/src/threads/util/content.ts`
```
import {
  ChatCompletionContentPart,
  ChatCompletionContentPartComponent,
  ContentPartType,
} from "@tambo-ai-cloud/core";
import { ChatCompletionContentPartDto } from "../dto/message.dto";

/**
 * V1 API-specific content types that should be filtered from legacy API responses
 * but preserved when storing to the database.
 */
const V1_CONTENT_TYPES = ["component", "tool_use", "tool_result"] as const;
type V1ContentType = (typeof V1_CONTENT_TYPES)[number];

function isV1ContentType(type: string): type is V1ContentType {
  return V1_CONTENT_TYPES.includes(type as V1ContentType);
}

/**
 * Convert a serialized content part to a content part that can be consumed by
 * an LLM.
 *
 * this mostly does runtime validation to make sure that the more tolerant Dto
 * type is converted to the more strict internal type.
 */
export function convertContentDtoToContentPart(
  content: string | ChatCompletionContentPartDto[],
): ChatCompletionContentPart[] {
  if (!Array.isArray(content)) {
    return [{ type: ContentPartType.Text, text: content }];
  }
  return content
    .map((part): ChatCompletionContentPart | null => {
      switch (part.type) {
        case ContentPartType.Text:
          // empty strings are ok, but undefined/null is not
          if (!part.text && typeof part.text !== "string") {
            throw new Error("Text content is required for text type");
          }
          return {
            type: ContentPartType.Text,
            text: part.text,
          };
        case ContentPartType.ImageUrl: {
          if (
            !part.image_url ||
            typeof part.image_url.url !== "string" ||
            part.image_url.url.length === 0
          ) {
            throw new Error(
              "image_url with a non-empty 'url' is required for image_url type",
            );
          }
          return {
            type: ContentPartType.ImageUrl,
            image_url: part.image_url,
          };
        }
        case ContentPartType.InputAudio: {
          if (
            !part.input_audio ||
            typeof part.input_audio.data !== "string" ||
            part.input_audio.data.length === 0
          ) {
            throw new Error(
              "input_audio with base64 'data' is required for input_audio type",
            );
          }
          return {
            type: ContentPartType.InputAudio,
            input_audio: part.input_audio,
          };
        }
        case ContentPartType.Resource: {
          if (!part.resource) {
            throw new Error("resource is required for resource type");
          }
          return {
            type: ContentPartType.Resource,
            resource: part.resource,
          };
        }
        default:
          // Pass through V1-specific content types (component, tool_use, tool_result)
          // These are stored in the DB and used by V1 API but filtered from legacy responses
          if (isV1ContentType(part.type)) {
            return part as unknown as ChatCompletionContentPart;
          }
          console.log("Unknown content part type:", part);
          throw new Error(`Unknown content part type: ${part.type}`);
      }
    })
    .filter((part): part is ChatCompletionContentPart => !!part);
}

/**
 * Convert a string or array of LLM content parts to a serialized content part
 * for legacy (pre-V1) API responses.
 *
 * Filters out V1 API-specific content types (component, tool_use, tool_result)
 * which should not be exposed in legacy API responses. These types are stored in
 * the database for V1 API support but legacy clients expect only standard
 * content types (text, image_url, input_audio, resource).
 */
export function convertContentPartToDto(
  part: ChatCompletionContentPart[] | string,
): ChatCompletionContentPartDto[] {
  if (typeof part === "string") {
    return [{ type: ContentPartType.Text, text: part }];
  }
  // Filter out V1 API-specific content types
  return part.filter(
    (p) => !isV1ContentType(p.type),
  ) as ChatCompletionContentPartDto[];
}

/**
 * Prepare content for database storage.
 *
 * Unlike convertContentPartToDto, this function preserves ALL content types
 * including V1-specific types (component, tool_use, tool_result). These types
 * need to be stored in the database so the V1 API can look them up for
 * operations like component state updates.
 *
 * @returns The content array unchanged, preserving all content types
 */
export function contentPartToDbFormat(
  content: ChatCompletionContentPart[] | string,
): ChatCompletionContentPart[] {
  if (typeof content === "string") {
    return [{ type: ContentPartType.Text, text: content }];
  }
  return content;
}

/**
 * Type guard to check if a content part is a component content block.
 */
export function isComponentContentPart(
  part: ChatCompletionContentPart,
): part is ChatCompletionContentPartComponent {
  return part.type === "component";
}

/**
 * Try to parse a string as JSON, returning the original string if it is not valid JSON
 */
export function tryParseJson(text: string): any {
  // we are assuming that JSON is only ever an object or an array,
  // so we don't need to check for other types of JSON structures
  if (!text.startsWith("{") && !text.startsWith("[")) {
    return text;
  }
  try {
    return JSON.parse(text);
  } catch (_error) {
    return text;
  }
}

```

### Core Architecture Module: `apps/api/src/threads/util/messages.ts`
```
import {
  ActionType,
  ComponentDecisionV2,
  ContentPartType,
  LegacyComponentDecision,
  MessageRole,
  ThreadMessage,
  UnsavedThreadMessage,
  validateThreadMessage,
} from "@tambo-ai-cloud/core";
import {
  dbMessageToThreadMessage,
  HydraDb,
  HydraTransaction,
  operations,
  schema,
} from "@tambo-ai-cloud/db";
import { and, eq, isNull } from "drizzle-orm";
import { MessageRequest, ThreadMessageDto } from "../dto/message.dto";
import {
  convertContentDtoToContentPart,
  convertContentPartToDto,
} from "./content";

/**
 * Add a message to a thread
 */
export async function addMessage(
  db: HydraDb,
  threadId: string,
  messageDto: MessageRequest,
  sdkVersion?: string,
): Promise<ThreadMessage> {
  // Build the base message properties
  const baseMessage = {
    content: convertContentDtoToContentPart(messageDto.content),
    component: messageDto.component ?? undefined,
    metadata: messageDto.metadata,
    actionType: messageDto.actionType ?? undefined,
    componentState: messageDto.componentState ?? {},
    error: messageDto.error,
    isCancelled: messageDto.isCancelled ?? false,
    additionalContext: messageDto.additionalContext ?? {},
  };

  // Construct the message based on role to satisfy discriminated union types
  let unsavedMessage: UnsavedThreadMessage;
  if (messageDto.role === MessageRole.Tool) {
    // Tool messages REQUIRE tool_call_id
    if (!messageDto.tool_call_id) {
      throw new Error("Tool messages must have a tool_call_id");
    }
    unsavedMessage = {
      ...baseMessage,
      role: MessageRole.Tool,
      tool_call_id: messageDto.tool_call_id,
    };
  } else if (messageDto.role === MessageRole.Assistant) {
    // Assistant messages can optionally have tool_call_id, toolCallRequest, reasoning
    unsavedMessage = {
      ...baseMessage,
      role: MessageRole.Assistant,
      tool_call_id: messageDto.tool_call_id,
      toolCallRequest: messageDto.toolCallRequest ?? undefined,
      reasoning: messageDto.reasoning ?? undefined,
      reasoningDurationMS: messageDto.reasoningDurationMS ?? undefined,
    };
  } else if (messageDto.role === MessageRole.System) {
    // System messages don't have tool-related fields
    unsavedMessage = {
      ...baseMessage,
      role: MessageRole.System,
    };
  } else {
    // User messages don't have tool-related fields
    unsavedMessage = {
      ...baseMessage,
      role: MessageRole.User,
    };
  }

  const message = await operations.addMessage(
    db,
    threadId,
    unsavedMessage,
    sdkVersion,
  );

  if (messageDto.role === MessageRole.Tool && messageDto.error) {
    //Update the previous request message with the error
    //Find message with matching toolCallId and action is tool call
    await propagateErrorToPreviousToolCall(
      db,
      threadId,
      messageDto.tool_call_id,
      messageDto.error,
    );
  }

  return dbMessageToThreadMessage(message);
}

/**
 * Update a message in a thread
 */
export async function updateMessage(
  db: HydraDb,
  messageId: string,
  messageDto: MessageRequest,
  sdkVersion?: string,
): Promise<ThreadMessageDto> {
  const message = await operations.updateMessage(
    db,
    messageId,
    {
      content: convertContentDtoToContentPart(messageDto.content),
      componentDecision: messageDto.component ?? undefined,
      metadata: messageDto.metadata,
      actionType: messageDto.actionType ?? undefined,
      toolCallRequest: messageDto.toolCallRequest,
      toolCallId: messageDto.tool_call_id ?? undefined,
      error: messageDto.error,
      isCancelled: messageDto.isCancelled,
      additionalContext: messageDto.additionalContext ?? {},
      reasoning: messageDto.reasoning ?? undefined,
      reasoningDurationMS: messageDto.reasoningDurationMS ?? undefined,
    },
    sdkVersion,
  );

  if (messageDto.role === MessageRole.Tool && messageDto.error) {
    //Update the previous request message with the error
    //Find message with matching toolCallId and action is tool call
    await propagateErrorToPreviousToolCall(
      db,
      message.threadId,
      messageDto.tool_call_id,
      messageDto.error,
    );
  }

  return {
    id: message.id,
    threadId: message.threadId,
    role: message.role,
    parentMessageId: message.parentMessageId ?? undefined,
    content: convertContentPartToDto(message.content),
    metadata: message.metadata ?? undefined,
    toolCallRequest: message.toolCallRequest ?? undefined,
    tool_call_id: message.toolCallId ?? undefined,
    actionType: message.actionType ?? undefined,
    componentState: message.componentState ?? {},
    error: message.error ?? undefined,
    isCancelled: message.isCancelled,
    createdAt: message.createdAt,
    additionalContext: message.additionalContext ?? {},
    reasoning: message.reasoning ?? undefined,
    reasoningDurationMS: message.reasoningDurationMS ?? undefined,
  };
}

/**
 * Update the previous tool call message with an error when a tool response fails
 */
async function propagateErrorToPreviousToolCall(
  db: HydraDb,
  threadId: string,
  toolCallId: string | undefined,
  error: string | undefined,
) {
  if (!toolCallId || !error) return;

  const previousMessage = await operations.findPreviousToolCallMessage(
    db,
    threadId,
    toolCallId,
  );

  if (previousMessage) {
    await operations.updateMessage(db, previousMessage.id, {
      error: error,
    });
  }
}

/**
 * Add a response to a thread
 */
export async function addAssistantMessageToThread(
  db: HydraDb,
  component: LegacyComponentDecision,
  threadId: string,
) {
  const serializedMessage: ComponentDecisionV2 = {
    message: component.message,
    componentName: component.componentName,
    props: component.props ?? {},
    componentState: component.componentState,
  };
  return await addMessage(db, threadId, {
    role: MessageRole.Assistant,
    content: [
      {
        type: ContentPartType.Text,
        text: component.message,
      },
    ],
    component: serializedMessage,
    actionType: component.toolCallRequest ? ActionType.ToolCall : undefined,
    toolCallRequest: component.toolCallRequest,
    tool_call_id: component.toolCallId,
    componentState: component.componentState ?? {},
    reasoning: component.reasoning,
    reasoningDurationMS: component.reasoningDurationMS,
  });
}

/**
 * Verify the latest message in a thread is the specified message
 */
export async function verifyLatestMessageConsistency(
  db: HydraTransaction,
  threadId: string,
  newestMessageId: string,
  hasNewMessageId: boolean,
) {
  const latestMessages = await db.query.messages.findMany({
    where: and(
      eq(schema.messages.threadId, threadId),
      isNull(schema.messages.parentMessageId),
    ),
    orderBy: (messages, { desc }) => [desc(messages.createdAt)],
    limit: 2,
    columns: {
      id: true,
    },
  });

  // If we have an in-progress message (streaming), we need to check the message before it
  // Otherwise, we check the latest message
  const messageToCheck = hasNewMessageId
    ? latestMessages[1] // Check message before our in-progress message
    : latestMessages[0]; // Check latest message directly

  if (!(messageToCheck.id === newestMessageId)) {
    throw new Error(
      `Latest message before write is not the same as the added user message: ${messageToCheck.id} !== ${newestMessageId}`,
    );
  }
}

/**
 * Convert a thread message to its DTO representation for HTTP responses
 */
export function threadMessageToDto(message: ThreadMessage): ThreadMessageDto {
  return {
    id: message.id,
    threadId: message.threadId,
    role: message.role,
    parentMessageId: message.parentMessageId,
    createdAt: message.createdAt,
    component: message.component as ComponentDecisionV2 | undefined,
    content: convertContentPartToDto(message.content),
    metadata: message.metadata,
    componentState: message.componentState ?? {},
    toolCallRequest: message.toolCallRequest,
    actionType: message.actionType,
    tool_call_id: message.tool_call_id,
    error: message.error,
    isCancelled: message.isCancelled,
    additionalContext: message.additionalContext ?? {},
    reasoning: message.reasoning,
    reasoningDurationMS: message.reasoningDurationMS,
  };
}

/**
 * Convert a list of serialized thread message DTOs to a list of thread messages
 */
export function threadMessageDtoToThreadMessage(
  messages: ThreadMessageDto[],
): ThreadMessage[] {
  return messages.map((message) =>
    validateThreadMessage({
      ...message,
      content: convertContentDtoToContentPart(message.content),
    }),
  );
}

```

### Core Architecture Module: `apps/api/src/threads/util/retry.ts`
```
/**
 * Retries an async operation with exponential backoff.
 *
 * @returns The result of the operation, or undefined if all retries are exhausted.
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T | undefined>,
  options: {
    maxRetries: number;
    initialDelayMs: number;
    backoffMultiplier: number;
  },
): Promise<T | undefined> {
  const { maxRetries, initialDelayMs, backoffMultiplier } = options;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await operation();
    if (result !== undefined) {
      return result;
    }

    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= backoffMultiplier;
    }
  }

  return undefined;
}

```

### Core Architecture Module: `apps/api/src/threads/util/streaming.ts`
```
import isEqual from "react-fast-compare";
/**
 * The interval at which to send updates to the client.
 *
 * This is to avoid sending too many updates to the client, which can cause
 * performance issues.
 */
const STREAMING_UPDATE_INTERVAL_MS = 50;

/**
 * Throttle the stream to avoid sending too many updates to the client.
 * Implement shouldForceYield when you want to force a chunk to be yielded, even
 * if it's within the default interval. For example, if you want to force a
 * yield every time the item.id changes to make sure you always get the first
 * item of each new id in the stream.
 *
 * @param stream The stream to throttle.
 * @param shouldForceYield A function that returns true if the chunk should be
 *   yielded immediately, false otherwise.
 */
export async function* throttleChunks<T>(
  stream: AsyncIterableIterator<T>,
  shouldForceYield?: (t1: T, t2: T) => boolean,
): AsyncIterableIterator<T> {
  let lastYieldedChunk: T | undefined = undefined;
  let lastChunk: T | undefined = undefined;
  // Start at 0 to make sure the first chunk is yielded immediately
  let lastUpdateTime = 0;
  for await (const chunk of stream) {
    // Save in case we need to yield the last chunk
    lastChunk = chunk;

    // Make sure not to yield duplicate chunks, just a waste of bandwidth
    if (lastYieldedChunk !== undefined && isEqual(chunk, lastYieldedChunk)) {
      continue;
    }

    // Throttle the stream to avoid sending too many updates to the client
    const currentTime = Date.now();
    const shouldYield =
      !lastYieldedChunk || shouldForceYield?.(lastYieldedChunk, chunk);
    if (
      !shouldYield &&
      currentTime - lastUpdateTime < STREAMING_UPDATE_INTERVAL_MS
    ) {
      continue;
    }
    lastUpdateTime = currentTime;
    lastYieldedChunk = chunk;
    yield chunk;
  }
  // The last chunk may have been skipped due to throttling, so we yield it if
  // it's different from the last yielded chunk. Note that we do not need deep
  // equality here because the only real reason to emit here is because of
  // throttling so we're virtually guaranteed to have a different chunk.
  if (lastChunk !== undefined && lastChunk !== lastYieldedChunk) {
    yield lastChunk;
  }
}

```

### Core Architecture Module: `apps/api/src/threads/util/suggestions.ts`
```
import { schema } from "@tambo-ai-cloud/db";
import { SuggestionDto } from "../dto/suggestion.dto";

export function mapSuggestionToDto(
  suggestion: schema.DBSuggestion,
): SuggestionDto {
  return {
    id: suggestion.id,
    messageId: suggestion.messageId,
    title: suggestion.title,
    detailedSuggestion: suggestion.detailedSuggestion,
    description: suggestion.detailedSuggestion,
  };
}

```

### Core Architecture Module: `apps/api/src/threads/util/thread-mcp-handlers.ts`
```
import type { ITamboBackend } from "@tambo-ai-cloud/backend";
import {
  AsyncQueue,
  ChatCompletionContentPart,
  ContentPartType,
  GenerationStage,
  MCPHandlers,
  MessageRole,
  ThreadMessage,
} from "@tambo-ai-cloud/core";
import type { HydraDb } from "@tambo-ai-cloud/db";
import { dbMessageToThreadMessage, operations } from "@tambo-ai-cloud/db";
import type {
  EmbeddedResource,
  ResourceLink,
} from "@modelcontextprotocol/sdk/types.js";
import mimeTypes from "mime-types";
import { StreamQueueItem } from "../dto/stream-queue-item";
import { AudioFormat } from "../dto/message.dto";
import { convertContentPartToDto } from "./content";
import { MCP_PARENT_MESSAGE_ID_META_KEY } from "./tool";

export function createMcpHandlers(
  db: HydraDb,
  tamboBackend: ITamboBackend,
  threadId: string,
  queue: AsyncQueue<StreamQueueItem>,
): MCPHandlers {
  return {
    async sampling(e) {
      let parentMessageId = e.params._meta?.[MCP_PARENT_MESSAGE_ID_META_KEY] as
        | string
        | undefined;

      // Fallback: if parentMessageId is not provided, find the last message
      // in the thread that doesn't have a parent
      if (!parentMessageId) {
        parentMessageId = await operations.findLastMessageWithoutParent(
          db,
          threadId,
        );
      }

      const messages = e.params.messages.map((m) => ({
        // Keep original role for storage
        role: m.role,
        // Cast content to "user" to let audio/image content through to
        // ChatCompletionContentPart type system
        content: mcpContentToContentParts(m.content),
      }));
      // add serially for now and collect the saved messages
      // TODO: add messages in a batch
      const savedMessages: ThreadMessage[] = [];
      for (const m of messages) {
        // MCP sampling messages should only be "user" or "assistant" roles
        // Construct the appropriate UnsavedThreadMessage based on role
        const role =
          m.role === "assistant" ? MessageRole.Assistant : MessageRole.User;
        const message = await operations.addMessage(db, threadId, {
          role,
          content: m.content,
          parentMessageId,
        });

        // Convert DBMessage to ThreadMessage (field name mapping)
        savedMessages.push(dbMessageToThreadMessage(message));

        queue.push({
          response: {
            responseMessageDto: {
              id: message.id,
              parentMessageId,
              role: message.role,
              content: convertContentPartToDto(message.content),
              componentState: message.componentState ?? {},
              threadId: message.threadId,
              createdAt: message.createdAt,
            },
            generationStage: GenerationStage.STREAMING_RESPONSE,
            statusMessage: `Streaming response...`,
          },
          aguiEvents: [], // MCP sampling message, no AG-UI events
        });
      }
      // Filter unsupported parts (resource content) for LLM
      const messagesForLLM: ThreadMessage[] = savedMessages.map((m) => ({
        ...m,
        content: m.content.filter((p) => {
          if (p.type === ContentPartType.Resource) {
            console.warn(
              "Filtering out 'resource' content part for provider call",
            );
            return false;
          }
          return true;
        }),
      }));
      const response = await tamboBackend.llmClient.complete({
        stream: false,
        promptTemplateName: "sampling",
        promptTemplateParams: {},
        messages: messagesForLLM,
      });

      // LLM response is always assistant role
      const message = await operations.addMessage(db, threadId, {
        role: MessageRole.Assistant,
        content: [
          {
            type: "text",
            text: response.message.content ?? "",
          },
        ],
        parentMessageId,
      });

      queue.push({
        response: {
          responseMessageDto: {
            id: message.id,
            parentMessageId,
            role: message.role,
            content: convertContentPartToDto(message.content),
            componentState: message.componentState ?? {},
            threadId: message.threadId,
            createdAt: message.createdAt,
          },
          generationStage: GenerationStage.STREAMING_RESPONSE,
          statusMessage: `Streaming response...`,
        },
        aguiEvents: [], // MCP LLM response, no AG-UI events
      });

      return {
        role: response.message.role,
        content: { type: "text", text: response.message.content ?? "" },
        model: tamboBackend.modelOptions.model,
      };
    },
    elicitation(_e) {
      throw new Error("Not implemented yet");
    },
  };
}
type McpContent = Parameters<
  MCPHandlers["sampling"]
>[0]["params"]["messages"][0]["content"];

// Single content item type from SDK (for when content is not an array)
type McpSdkContentItem = Exclude<McpContent, readonly unknown[]>;

/**
 * Extended content item type that includes resource types.
 * The MCP SDK's SamplingMessageContentBlockSchema doesn't include resource types,
 * but MCP servers can still return them at runtime.
 */
type McpContentItem = McpSdkContentItem | ResourceLink | EmbeddedResource;

function isResourceLink(content: McpContentItem): content is ResourceLink {
  return content.type === "resource_link";
}

function isEmbeddedResource(
  content: McpContentItem,
): content is EmbeddedResource {
  return content.type === "resource";
}

function isMcpContentItem(value: unknown): value is McpContentItem {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  if (!("type" in value)) {
    return false;
  }

  return typeof value.type === "string";
}

function mcpContentItemToContentPart(
  content: McpContentItem,
): ChatCompletionContentPart {
  // Check for resource types first using type guards
  if (isResourceLink(content)) {
    // For sampling messages, we don't have serverKey context to prefix URIs.
    // Log warning and return placeholder - proper handling requires architecture changes.
    console.warn(
      "resource_link in sampling message not yet supported - resource will not be fetched",
      { uri: content.uri, name: content.name },
    );
    return {
      type: ContentPartType.Text,
      text: `[Resource link: ${content.name ?? content.uri}]`,
    };
  }

  if (isEmbeddedResource(content)) {
    // Embedded resource - has inline content already
    const resourceContent = content.resource;
    return {
      type: ContentPartType.Resource,
      resource: {
        uri: resourceContent.uri,
        text: "text" in resourceContent ? resourceContent.text : undefined,
        blob: "blob" in resourceContent ? resourceContent.blob : undefined,
        mimeType: resourceContent.mimeType,
      },
    };
  }

  // Handle SDK-defined content types
  switch (content.type) {
    case "text":
      return { type: ContentPartType.Text, text: content.text };

    case "image":
      return {
        type: ContentPartType.ImageUrl,
        image_url: {
          // this is already base64 encoded
          url: `data:${content.mimeType};base64,${content.data}`,
        },
      };

    case "audio": {
      const format = mimeTypes.extension(content.mimeType);
      if (format !== AudioFormat.MP3 && format !== AudioFormat.WAV) {
        console.warn(
          `Unknown audio format: ${content.mimeType}, returning text content`,
        );
        return {
          type: ContentPartType.Text,
          text: "[Audio content not supported]",
        };
      }
      return {
        type: ContentPartType.InputAudio,
        input_audio: {
          // this is already base64 encoded
          data: content.data,
          // has to be "mp3" or "wav"
          format,
        },
      };
    }

    default:
      // Truly unknown content type
      console.warn(`Unknown content type: ${String(content.type)}`);
      return {
        type: ContentPartType.Text,
        text: `[Unsupported content type: ${String(content.type)}]`,
      };
  }
}

function mcpContentToContentParts(
  content: McpContent,
): ChatCompletionContentPart[] {
  const emptyTextPart: ChatCompletionContentPart[] = [
    { type: ContentPartType.Text, text: "" },
  ];

  // MCP SDK 1.24+ allows content to be either a single item or an array
  if (Array.isArray(content)) {
    if (content.length === 0) {
      return emptyTextPart;
    }

    // Filter to valid content items and convert
    // Note: At runtime, MCP servers may return resource types not in the SDK schema
    const validItems: McpContentItem[] = [];
    for (const item of content) {
      if (isMcpContentItem(item)) {
        validItems.push(item);
      } else {
        console.warn("Unexpected MCP content array element", item);
      }
    }

    const parts = validItems.map(mcpContentItemToContentPart);
    return parts.length > 0 ? parts : emptyTextPart;
  }

  if (!isMcpContentItem(content)) {
    console.warn("Unexpected MCP content value", content);
    return emptyTextPart;
  }

  return [mcpContentItemToContentPart(content)];
}

```

### Core Architecture Module: `apps/api/src/threads/util/thread-state.ts`
```
import { Logger } from "@nestjs/common";
import type { DecisionStreamItem } from "@tambo-ai-cloud/backend";
import {
  ActionType,
  type ChatCompletionContentPart,
  type ChatCompletionContentPartComponent,
  ContentPartType,
  GenerationStage,
  isUiToolName,
  LegacyComponentDecision,
  MessageRole,
  ThreadAssistantMessage,
  ThreadMessage,
  ThreadSystemMessage,
  ThreadToolMessage,
  ThreadUserMessage,
  ToolCallRequest,
} from "@tambo-ai-cloud/core";
import { HydraDb, operations, schema } from "@tambo-ai-cloud/db";
import { eq } from "drizzle-orm";
import { ComponentDecisionV2Dto } from "../dto/component-decision.dto";
import {
  ChatCompletionContentPartDto,
  MessageRequest,
} from "../dto/message.dto";
import { contentPartToDbFormat } from "./content";
import {
  addMessage,
  updateMessage,
  verifyLatestMessageConsistency,
} from "./messages";

/**
 * Update the generation stage of a thread
 */
export async function updateGenerationStage(
  db: HydraDb,
  id: string,
  generationStage: GenerationStage,
  statusMessage?: string,
) {
  return await operations.updateThread(db, id, {
    generationStage,
    statusMessage,
  });
}

/**
 * Add a user message to a thread, making sure that the thread is not already in the middle of processing.
 */
export async function addUserMessage(
  db: HydraDb,
  threadId: string,
  message: MessageRequest,
  logger?: Logger,
  sdkVersion?: string,
) {
  try {
    const result = await db.transaction(
      async (tx) => {
        const currentThread = await tx.query.threads.findFirst({
          where: eq(schema.threads.id, threadId),
        });

        if (!currentThread) {
          throw new Error(`Thread ${threadId} not found`);
        }

        const generationStage = currentThread.generationStage;
        if (isThreadProcessing(generationStage)) {
          throw new Error(
            `Thread is already in processing (${currentThread.generationStage}), only one response can be generated at a time`,
          );
        }

        await updateGenerationStage(
          tx,
          threadId,
          GenerationStage.FETCHING_CONTEXT,
          "Starting processing...",
        );

        return await addMessage(tx, threadId, message, sdkVersion);
      },
      {
        isolationLevel: "read committed",
      },
    );

    return result;
  } catch (error) {
    logger?.error(
      "Transaction failed: Adding user message",
      (error as Error).stack,
    );
    throw error;
  }
}

function isThreadProcessing(generationStage: GenerationStage) {
  return [
    GenerationStage.STREAMING_RESPONSE,
    GenerationStage.HYDRATING_COMPONENT,
    GenerationStage.CHOOSING_COMPONENT,
  ].includes(generationStage);
}

/**
 * Processes a stream of component decisions to handle tool call information.
 *
 * This function preserves tool call info (even if incomplete)in chunks during streaming and uses the
 * `isToolCallFinished` flag to indicate completion status. Sets to false until the final chunk, when it is set to true.
 *
 *
 * Messages will come in from the LLM or agent as a stream of component
 * decisions, as a flat stream or messages, even though there may be more than
 * one actual message, and each iteration of the message may contain an
 * incomplete tool call.
 *
 * For LLMs, this mostly just looks like a stream of messages that ultimately
 * results in a single final message.
 *
 * For agents, this may be a stream of multiple distinct messages, (like a user
 * message, then two assistant messages, then another user message, etc) and we
 * distinguish between them because the `id` of the LegacyComponentDecision will
 * change with each message.
 */
export async function* fixStreamedToolCalls(
  stream: AsyncIterableIterator<DecisionStreamItem>,
): AsyncIterableIterator<DecisionStreamItem> {
  let currentDecisionId: string | undefined = undefined;
  let currentToolCallRequest: ToolCallRequest | undefined = undefined;
  let currentToolCallId: string | undefined = undefined;
  let currentDecision: LegacyComponentDecision | undefined = undefined;
  let currentToolCallProviderOptionsById:
    | DecisionStreamItem["toolCallProviderOptionsById"]
    | undefined = undefined;

  for await (const streamItem of stream) {
    const chunk = streamItem.decision;

    if (currentDecision?.id && currentDecisionId !== chunk.id) {
      // we're on to a new chunk, so if we have a previous tool call request, emit it
      yield {
        decision: {
          ...currentDecision,
          toolCallRequest: currentToolCallRequest,
          toolCallId: currentToolCallId,
          isToolCallFinished: true,
        },
        aguiEvents: [], // No AG-UI events for this synthetic transition chunk
        toolCallProviderOptionsById: currentToolCallProviderOptionsById,
      };
      // and clear the current tool call request and id
      currentToolCallRequest = undefined;
      currentToolCallId = undefined;
      currentToolCallProviderOptionsById = undefined;
    }

    // now emit the next chunk
    const { toolCallRequest, ...incompleteChunk } = chunk;
    currentDecision = incompleteChunk;
    currentDecisionId = chunk.id;
    currentToolCallId = chunk.toolCallId;
    currentToolCallRequest = toolCallRequest;

    if (streamItem.toolCallProviderOptionsById) {
      // Merge per tool call id so provider keys don't overwrite each other.
      currentToolCallProviderOptionsById ??= {};
      for (const [id, providerOptions] of Object.entries(
        streamItem.toolCallProviderOptionsById,
      )) {
        currentToolCallProviderOptionsById[id] = {
          ...(currentToolCallProviderOptionsById[id] ?? {}),
          ...providerOptions,
        };
      }
    }
    yield {
      decision: { ...chunk, isToolCallFinished: false },
      aguiEvents: streamItem.aguiEvents,
      toolCallProviderOptionsById: currentToolCallProviderOptionsById,
    };
  }

  // account for the last iteration
  if (currentDecision) {
    yield {
      decision: {
        ...currentDecision,
        toolCallRequest: currentToolCallRequest,
        toolCallId: currentToolCallId,
        isToolCallFinished: true,
      },
      aguiEvents: [], // No AG-UI events for this synthetic final chunk
      toolCallProviderOptionsById: currentToolCallProviderOptionsById,
    };
  }
}

export function updateThreadMessageFromLegacyDecision(
  initialMessage: ThreadMessage,
  chunk: LegacyComponentDecision,
): ThreadMessage {
  // we explicitly remove certain fields from the component decision to avoid
  // duplication, because they appear in the thread message
  const { reasoning, isToolCallFinished, ...simpleDecisionChunk } = chunk;

  // For UI tools, strip tool call fields from the component field
  // so the client never sees them as tool calls
  let component = simpleDecisionChunk;
  if (chunk.toolCallRequest && isUiToolName(chunk.toolCallRequest.toolName)) {
    const {
      toolCallRequest: _toolCallRequest,
      toolCallId: _toolCallId,
      ...componentWithoutToolCall
    } = simpleDecisionChunk;
    component = componentWithoutToolCall;
  }

  // Build content array: text content + optional component content block.
  // Component content blocks are stored in the content array so V1 API can
  // reference them by componentId for state updates. Legacy API should filter
  // these out if needed.
  const content: ChatCompletionContentPart[] = [
    {
      type: ContentPartType.Text as const,
      text: chunk.message,
    },
  ];

  // Add component content block for V1 API support (legacy API filters these out).
  // The componentId comes from streaming events (e.g., "message-xxxx") and is used
  // by the V1 API to look up components for state updates. This ID is preserved
  // in the DB content array so findMessageWithComponent can find it.
  if (chunk.componentId && chunk.componentName && chunk.props) {
    const componentContent: ChatCompletionContentPartComponent = {
      type: "component",
      id: chunk.componentId,
      name: chunk.componentName,
      props: chunk.props,
      state: chunk.componentState ?? {},
    };
    content.push(componentContent);
  }

  const commonFields = {
    id: initialMessage.id,
    threadId: initialMessage.threadId,
    parentMessageId: initialMessage.parentMessageId,
    isCancelled: initialMessage.isCancelled,
    createdAt: initialMessage.createdAt,
    error: initialMessage.error,
    metadata: initialMessage.metadata,
    additionalContext: initialMessage.additionalContext,
    actionType: initialMessage.actionType,
    componentState: chunk.componentState ?? {},
    content,
    component,
  };

  // Handle reasoning and tool calls based on role
  if (initialMessage.role === MessageRole.Assistant) {
    const currentThreadMessage: ThreadAssistantMessage = {
      ...commonFields,
      role: MessageRole.Assistant,
      reasoning: reasoning,
      reasoningDurationMS: chunk.reasoningDurationMS,
    };

    // Handle tool call fields differently for UI tools vs non-UI tools:
    // - UI tools: Set fields as soon as we have valid toolCallRequest and toolCallId
    //   (so they're tracked as tool calls during streaming)
    // - Non-UI tools: Only set fields when isToolCallFinished is true
    //   (so client SDK doesn't call them until complete)
    if (chunk.toolCallRequest && chunk.toolCallId) {
      const isUITool = isUiToolName(chunk.toolCallRequest.toolName);

      if (isUITool || isToolCallFinished) {
        currentThreadMessage.toolCallRequest = chunk.toolCallRequest;
        currentThreadMessage.tool_call_id = chunk.toolCallId;
        currentThreadMessage.actionType = ActionType.ToolCall;
      }
    }

    return currentThreadMessage;
  }

  // For non-assistant messages, reconstruct based on the role
  switch (initialMessage.role) {
    case MessageRole.User: {
      const msg: ThreadUserMessage = {
        ...commonFields,
        role: MessageRole.User,
      };
      return msg;
    }
    case MessageRole.System: {
      const ms
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2546** (2026-03-07): **[Bug] Hydration error on running tambo dashboard**
  *Symptoms*: Getting Hydration error from nextjs on running tambo dashboard even after disabling all the extensions.  Browser: Firefox operating system: Windows 11  <img width="1918" height="881" alt="Image" src="https://github.com/user-attachments/assets/2caed27b-700d-47ee-b9c4-15e4bd86b110" /> 
  **Post-Mortem & Fix Analysis**:
  > The hydration error is caused by the `<body>` tag in `apps/web/app/layout.tsx` missing `suppressHydrationWarning`. The `<html>` tag already had it, but the app uses `next-themes` which requires it on both elements. Browser extensions (common on Firefox/Windows) inject attributes into `<body>`, causing a mismatch between server and client HTML.  **Fix:** PR #2548 adds `suppressHydrationWarning` to the `<body>` tag — a single-line change. <!-- PULLFROG_DIVIDER_DO_NOT_REMOVE_PLZ --> <sup><a href="https://pullfrog.com"><picture><source media="(prefers-color-scheme: dark)" srcset="https://pullfrog.com/logos/frog-white-full-18px.png"><img src="https://pullfrog.com/logos/frog-green-full-18px.png" width="9px" height="9px" style="vertical-align: middle; " alt="Pullfrog"></picture></a>&nbsp;&nbsp;｜ [View workflow run](https://github.com/tambo-ai/tambo/actions/runs/22658286513/job/65672653999) ｜ Using [Claude Code](https://claude.com/claude-code) ｜ Triggered by [Pullfrog](https://pullfrog.com) ｜ 

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

### Incident Patch 1: `bc30cd7d` (2026-08-05)
**Commit Message**: chore(deps): update dependency js-yaml to v4.3.0 [security] (#2998)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `apps/web/package.json` (modified, +1/-1)
```diff
@@ -75,7 +75,7 @@
     "jiti": "^2.7.0",
     "jose": "^5.10.0",
     "js-tiktoken": "^1.0.21",
-    "js-yaml": "^4.3.0",
+    "js-yaml": "^5.2.2",
     "json-stringify-pretty-compact": "^4.0.0",
     "lucide-react": "^0.577.0",
     "luxon": "^3.7.2",
```

**File**: `cli/package.json` (modified, +1/-1)
```diff
@@ -70,7 +70,7 @@
     "env-paths": "^4.0.0",
     "fast-equals": "^6.0.0",
     "inquirer": "^13.4.3",
-    "js-yaml": "^4.3.0",
+    "js-yaml": "^5.2.2",
     "meow": "^14.1.0",
     "open": "^11.0.0",
     "ora": "^9.4.0",
```

**File**: `package-lock.json` (modified, +74/-7)
```diff
@@ -309,7 +309,7 @@
         "jiti": "^2.7.0",
         "jose": "^5.10.0",
         "js-tiktoken": "^1.0.21",
-        "js-yaml": "^4.3.0",
+        "js-yaml": "^5.2.2",
         "json-stringify-pretty-compact": "^4.0.0",
         "lucide-react": "^0.577.0",
         "luxon": "^3.7.2",
@@ -463,7 +463,7 @@
         "env-paths": "^4.0.0",
         "fast-equals": "^6.0.0",
         "inquirer": "^13.4.3",
-        "js-yaml": "^4.3.0",
+        "js-yaml": "^5.2.2",
         "meow": "^14.1.0",
         "open": "^11.0.0",
         "ora": "^9.4.0",
@@ -6062,6 +6062,29 @@
         "url": "https://github.com/sponsors/sindresorhus"
       }
     },
+    "node_modules/@eslint/eslintrc/node_modules/js-yaml": {
+      "version": "4.3.1",
+      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.1.tgz",
+      "integrity": "sha512-CY6crGq313MX8GkwvB7tzgp99vjQxY1++5y10/BKN/GUfHqWaOGQMNZkBvqSzsZKWk/ijwHlWzzkLulsGHhjWQ==",
+      "dev": true,
+      "funding": [
+        {
+          "type": "github",
+          "url": "https://github.com/sponsors/puzrin"
+        },
+        {
+          "type": "github",
+          "url": "https://github.com/sponsors/nodeca"
+        }
+      ],
+      "license": "MIT",
+      "dependencies": {
+        "argparse": "^2.0.1"
+      },
+      "bin": {
+        "js-yaml": "bin/js-yaml.js"
+      }
+    },
     "node_modules/@eslint/js": {
       "version": "9.39.4",
       "resolved": "https://registry.npmjs.org/@eslint/js/-/js-9.39.4.tgz",
@@ -22193,6 +22216,28 @@
         }
       }
     },
+    "node_modules/cosmiconfig/node_modules/js-yaml": {
+      "version": "4.3.1",
+      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.1.tgz",
+      "integrity": "sha512-CY6crGq313MX8GkwvB7tzgp99vjQxY1++5y10/BKN/GUfHqWaOGQMNZkBvqSzsZKWk/ijwHlWzzkLulsGHhjWQ==",
+      "funding": [
+        {
+          "type": "github",
+          "url": "https://github.com/sponsors/puzrin"
+        },
+        {
+          "type": "github",
+          "url": "https://github.com/sponsors/nodeca"
+        }
+      ],
+      "license": "MIT",
+      "dependencies": {
+        "argparse": "^2.0.1"
+      },
+      "bin": {
+        "js-yaml": "bin/js-yaml.js"
+      }
+    },
     "node_modules/create-require": {
       "version": "1.1.1",
       "license": "MIT"
@@ -26577,6 +26622,28 @@
         "@esbuild/win32-x64": "0.25.12"
       }
     },
+    "node_modules/fumadocs-mdx/node_modules/js-yaml": {
+      "version": "4.3.1",
+      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.1.tgz",
+      "integrity": "sha512-CY6crGq313MX8GkwvB7tzgp99vjQxY1++5y10/BKN/GUfHqWaOGQMNZkBvqSzsZKWk/ijwHlWzzkLulsGHhjWQ==",
+      "funding": [
+        {
+          "type": "github",
+          "url": "https://github.com/sponsors/puzrin"
+        },
+        {
+          "type": "github",
+          "url": "https://github.com/sponsors/nodeca"
+        }
+      ],
+      "license": "MIT",
+      "dependencies": {
+        "argparse": "^2.0.1"
+      },
+      "bin": {
+        "js-yaml": "bin/js-yaml.js"
+      }
+    },
     "node_modules/fumadocs-mdx/node_modules/lru-cache": {
       "version": "11.2.4",
       "license": "BlueOak-1.0.0",
@@ -30728,9 +30795,9 @@
       "license": "MIT"
     },
     "node_modules/js-yaml": {
-      "version": "4.3.1",
-      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.1.tgz",
-      "integrity": "sha512-CY6crGq313MX8GkwvB7tzgp99vjQxY1++5y10/BKN/GUfHqWaOGQMNZkBvqSzsZKWk/ijwHlWzzkLulsGHhjWQ==",
+      "version": "5.2.3",
+      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-5.2.3.tgz",
+      "integrity": "sha512-n+mUVyUX5bVv7G/G2zyIHOhdxfuU1dY2NOFzTQUWiMUbFss8b57NFlgCCaggU78wSw5KVS9cllzeLyzyR+n5nw==",
       "funding": [
         {
           "type": "github",
@@ -30746,7 +30813,7 @@
         "argparse": "^2.0.1"
       },
       "bin": {
-        "js-yaml": "bin/js-yaml.js"
+        "js-yaml": "bin/js-yaml.mjs"
       }
     },
     "node_modules/jsdoc-type-pratt-parser": {
@@ -40692,7 +40759,7 @@
         "@modelcontextprotocol/sdk": "^1.30.0",
         "ipaddr.js": "^1.9.1",
         "jose": "^5.10.0",
-        "js-yaml": "^4.3.0",
+        "js-yaml": "^5.2.2",
         "openai": "^6.16.0",
         "resend": "^6.12.3",
         "undici": "^8.9.0"
```

**File**: `package.json` (modified, +4/-4)
```diff
@@ -88,18 +88,18 @@
     "fast-uri": "3.1.5",
     "hono": "4.13.0",
     "ip-address": "10.4.0",
-    "js-yaml": "4.3.1",
+    "js-yaml": "5.2.2",
     "@istanbuljs/load-nyc-config": {
-      "js-yaml": "3.15.1"
+      "js-yaml": "5.2.2"
     },
     "@nestjs/swagger": {
-      "js-yaml": "5.2.1"
+      "js-yaml": "5.2.2"
     },
     "concurrently": {
       "shell-quote": "1.9.0"
     },
     "gray-matter": {
-      "js-yaml": "3.15.1"
+      "js-yaml": "5.2.2"
     },
     "next": {
       "postcss": "8.5.23",
```

**File**: `packages/core/package.json` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@
     "@modelcontextprotocol/sdk": "^1.30.0",
     "ipaddr.js": "^1.9.1",
     "jose": "^5.10.0",
-    "js-yaml": "^4.3.0",
+    "js-yaml": "^5.2.2",
     "openai": "^6.16.0",
     "resend": "^6.12.3",
     "undici": "^8.9.0"
```

---

### Incident Patch 2: `fbf65b21` (2026-08-05)
**Commit Message**: fix(deps): replace dependency framer-motion with motion ^12.29.0 (#3003)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `apps/web/package.json` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@
     "dompurify": "^3.4.12",
     "drizzle-orm": "^0.45.2",
     "embla-carousel-react": "^8.6.0",
-    "framer-motion": "^12.29.0",
+    "motion": "^12.29.0",
     "geist": "^1.5.1",
     "highlight.js": "^11.11.1",
     "jiti": "^2.7.0",
```

**File**: `docs/package.json` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@
     "@tambo-ai/ui-registry": "*",
     "class-variance-authority": "^0.7.1",
     "dompurify": "^3.4.12",
-    "framer-motion": "^12.29.0",
+    "motion": "^12.29.0",
     "fumadocs-core": "15.8.5",
     "fumadocs-mdx": "^13.0.8",
     "fumadocs-ui": "15.8.5",
```

**File**: `package-lock.json` (modified, +48/-16)
```diff
@@ -42,7 +42,7 @@
         "@ag-ui/client": "0.0.57",
         "@ag-ui/crewai": "^0.0.3",
         "@ag-ui/llamaindex": "^0.1.5",
-        "@ai-sdk/provider": "^3.0.10",
+        "@ai-sdk/provider": "^3.0.8",
         "@anthropic-ai/sdk": "^0.96.0",
         "@nestjs/common": "^11.1.26",
         "@nestjs/config": "^4.0.4",
@@ -87,7 +87,7 @@
         "rxjs": "7.8.2",
         "superjson": "^2.2.6",
         "ts-essentials": "^10.1.1",
-        "uuid": "^14.0.1"
+        "uuid": "^14.0.0"
       },
       "devDependencies": {
         "@nestjs/cli": "^11.0.23",
@@ -304,7 +304,6 @@
         "dompurify": "^3.4.12",
         "drizzle-orm": "^0.45.2",
         "embla-carousel-react": "^8.6.0",
-        "framer-motion": "^12.29.0",
         "geist": "^1.5.1",
         "highlight.js": "^11.11.1",
         "jiti": "^2.7.0",
@@ -314,6 +313,7 @@
         "json-stringify-pretty-compact": "^4.0.0",
         "lucide-react": "^0.577.0",
         "luxon": "^3.7.2",
+        "motion": "^12.29.0",
         "next": "^16.2.12",
         "next-auth": "^4.24.15",
         "next-themes": "^0.4.5",
@@ -461,7 +461,7 @@
         "diff": "^8.0.3",
         "dotenv": "^17.4.0",
         "env-paths": "^4.0.0",
-        "fast-equals": "^6.0.2",
+        "fast-equals": "^6.0.0",
         "inquirer": "^13.4.3",
         "js-yaml": "^4.3.0",
         "meow": "^14.1.0",
@@ -532,14 +532,14 @@
         "@tambo-ai/ui-registry": "*",
         "class-variance-authority": "^0.7.1",
         "dompurify": "^3.4.12",
-        "framer-motion": "^12.29.0",
         "fumadocs-core": "15.8.5",
         "fumadocs-mdx": "^13.0.8",
         "fumadocs-ui": "15.8.5",
         "highlight.js": "^11.11.1",
         "json-stringify-pretty-compact": "^4.0.0",
         "lucide-react": "^0.577.0",
         "mermaid": "^11.15.0",
+        "motion": "^12.29.0",
         "next": "^16.2.12",
         "next-themes": "^0.4.6",
         "posthog-js": "^1.380.0",
@@ -25921,11 +25921,13 @@
       }
     },
     "node_modules/framer-motion": {
-      "version": "12.29.0",
+      "version": "12.43.0",
+      "resolved": "https://registry.npmjs.org/framer-motion/-/framer-motion-12.43.0.tgz",
+      "integrity": "sha512-1eaL3RvR/kAlbG7UYcpMptEyzPoENO0c6w7ZnB3/hh2vSAz/6uGAFn6fdoqTBguNstf3MsFhJHsD/0DHiclG+g==",
       "license": "MIT",
       "dependencies": {
-        "motion-dom": "^12.29.0",
-        "motion-utils": "^12.27.2",
+        "motion-dom": "^12.43.0",
+        "motion-utils": "^12.39.0",
         "tslib": "^2.4.0"
       },
       "peerDependencies": {
@@ -32957,15 +32959,45 @@
       "version": "1.0.4",
       "license": "MIT"
     },
+    "node_modules/motion": {
+      "version": "12.43.0",
+      "resolved": "https://registry.npmjs.org/motion/-/motion-12.43.0.tgz",
+      "integrity": "sha512-BQgQbSa9Hn3/mtbib0MK53y6JSANa+YKUKlaYnWzAVDH424RYQ5LVpV3pNiWH00BA2z4ojsSdMzqT7g2FQwjuQ==",
+      "license": "MIT",
+      "dependencies": {
+        "framer-motion": "^12.43.0",
+        "tslib": "^2.4.0"
+      },
+      "peerDependencies": {
+        "@emotion/is-prop-valid": "*",
+        "react": "^18.0.0 || ^19.0.0",
+        "react-dom": "^18.0.0 || ^19.0.0"
+      },
+      "peerDependenciesMeta": {
+        "@emotion/is-prop-valid": {
+          "optional": true
+        },
+        "react": {
+          "optional": true
+        },
+        "react-dom": {
+          "optional": true
+        }
+      }
+    },
     "node_modules/motion-dom": {
-      "version": "12.29.2",
+      "version": "12.43.0",
+      "resolved": "https://registry.npmjs.org/motion-dom/-/motion-dom-12.43.0.tgz",
+      "integrity": "sha512-azKON4d9S65PEoFUiQTMTgPheEmzf2QngdRc50AKfJp9Q9mmcBVw22c8eMq9k8kxOFHdL7+WZY7N/5F/lwiDag==",
       "license": "MIT",
       "dependencies": {
-        "motion-utils": "^12.29.2"
+        "motion-utils": "^12.39.0"
       }
     },
     "node_modules/motion-utils": {
-      "version": "12.29.2",
+      "version": "12.39.0",
+      "resolved": "https://registry.npmjs.org/motion-utils/-/motion-utils-12.39.0.tgz",
+      "integrity": "sha512-8nadJAJjTtqRkmRF36FoJTrywK9nnFmnPwnSMyxaOCU7GDjN9RTMJIxx9De8ErM+vpPhMccr/6fo5WciyQLnMQ==",
       "license": "MIT"
     },
     "node_modules/ms": {
@@ -40539,7 +40571,7 @@
         "@ai-sdk/mistral": "^3.0.27",
         "@ai-sdk/openai": "^3.0.48",
         "@ai-sdk/openai-compatible": "^2.0.37",
-        "@ai-sdk/provider": "^3.0.10",
+        "@ai-sdk/provider": "^3.0.8",
         "@ai-sdk/provider-utils": "^4.0.23",
         "@anthropic-ai/sdk": "^0.91.1",
         "@aws-sdk/client-s3": "^3.700.0",
@@ -40548,7 +40580,7 @@
         "@mastra/core": "^1.1.0",
         "@tambo-ai-cloud/core": "*",
         "ai": "^6.0.138",
-        "ajv": "^8.20.0",
+        "ajv": "^8.18.0",
         "fast-json-patch": "^3.1.1",
         "gpt-tokenizer": "^3.2.0",
         "langfuse": "^3.38.6",
@@ -40853,11 +40885,11 @@
       "license": "MIT",
       "dependencies": {
         "@ag-ui/core": "^0.0.57",
-        "@modelcontextprotocol/sd
```

**File**: `showcase/package.json` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@
     "autoprefixer": "^10.4.27",
     "class-variance-authority": "^0.7.1",
     "dompurify": "^3.4.12",
-    "framer-motion": "^12.29.0",
+    "motion": "^12.29.0",
     "geist": "^1.5.1",
     "highlight.js": "^11.11.1",
     "json-stringify-pretty-compact": "^4.0.0",
```

---

### Incident Patch 3: `31a94efe` (2026-08-04)
**Commit Message**: chore(deps): update dependency uuid to v14.0.1 (#2986)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `package-lock.json` (modified, +44/-18)
```diff
@@ -87,7 +87,7 @@
         "rxjs": "7.8.2",
         "superjson": "^2.2.6",
         "ts-essentials": "^10.1.1",
-        "uuid": "^14.0.0"
+        "uuid": "^14.0.1"
       },
       "devDependencies": {
         "@nestjs/cli": "^11.0.23",
@@ -230,19 +230,6 @@
         "source-map": "^0.6.0"
       }
     },
-    "apps/api/node_modules/uuid": {
-      "version": "14.0.0",
-      "resolved": "https://registry.npmjs.org/uuid/-/uuid-14.0.0.tgz",
-      "integrity": "sha512-Qo+uWgilfSmAhXCMav1uYFynlQO7fMFiMVZsQqZRMIXp0O7rR7qjkj+cPvBHLgBqi960QCoo/PH2/6ZtVqKvrg==",
-      "funding": [
-        "https://github.com/sponsors/broofa",
-        "https://github.com/sponsors/ctavan"
-      ],
-      "license": "MIT",
-      "bin": {
-        "uuid": "dist-node/bin/uuid"
-      }
-    },
     "apps/docs-mcp": {
       "version": "0.1.0",
       "license": "Apache-2.0",
@@ -988,6 +975,19 @@
         "node": ">= 0.6"
       }
     },
+    "node_modules/@a2a-js/sdk/node_modules/uuid": {
+      "version": "11.1.1",
+      "resolved": "https://registry.npmjs.org/uuid/-/uuid-11.1.1.tgz",
+      "integrity": "sha512-vIYxrBCC/N/K+Js3qSN88go7kIfNPssr/hHCesKCQNAjmgvYS2oqr69kIufEG+O4+PfezOH4EbIeHCfFov8ZgQ==",
+      "funding": [
+        "https://github.com/sponsors/broofa",
+        "https://github.com/sponsors/ctavan"
+      ],
+      "license": "MIT",
+      "bin": {
+        "uuid": "dist/esm/bin/uuid"
+      }
+    },
     "node_modules/@adobe/css-tools": {
       "version": "4.4.2",
       "dev": true,
@@ -1019,6 +1019,19 @@
         "tslib": "^2.1.0"
       }
     },
+    "node_modules/@ag-ui/client/node_modules/uuid": {
+      "version": "11.1.1",
+      "resolved": "https://registry.npmjs.org/uuid/-/uuid-11.1.1.tgz",
+      "integrity": "sha512-vIYxrBCC/N/K+Js3qSN88go7kIfNPssr/hHCesKCQNAjmgvYS2oqr69kIufEG+O4+PfezOH4EbIeHCfFov8ZgQ==",
+      "funding": [
+        "https://github.com/sponsors/broofa",
+        "https://github.com/sponsors/ctavan"
+      ],
+      "license": "MIT",
+      "bin": {
+        "uuid": "dist/esm/bin/uuid"
+      }
+    },
     "node_modules/@ag-ui/core": {
       "version": "0.0.57",
       "resolved": "https://registry.npmjs.org/@ag-ui/core/-/core-0.0.57.tgz",
@@ -33202,6 +33215,19 @@
         "url": "https://github.com/sponsors/panva"
       }
     },
+    "node_modules/next-auth/node_modules/uuid": {
+      "version": "11.1.1",
+      "resolved": "https://registry.npmjs.org/uuid/-/uuid-11.1.1.tgz",
+      "integrity": "sha512-vIYxrBCC/N/K+Js3qSN88go7kIfNPssr/hHCesKCQNAjmgvYS2oqr69kIufEG+O4+PfezOH4EbIeHCfFov8ZgQ==",
+      "funding": [
+        "https://github.com/sponsors/broofa",
+        "https://github.com/sponsors/ctavan"
+      ],
+      "license": "MIT",
+      "bin": {
+        "uuid": "dist/esm/bin/uuid"
+      }
+    },
     "node_modules/next-sitemap": {
       "version": "4.2.3",
       "resolved": "https://registry.npmjs.org/next-sitemap/-/next-sitemap-4.2.3.tgz",
@@ -39581,16 +39607,16 @@
       }
     },
     "node_modules/uuid": {
-      "version": "11.1.1",
-      "resolved": "https://registry.npmjs.org/uuid/-/uuid-11.1.1.tgz",
-      "integrity": "sha512-vIYxrBCC/N/K+Js3qSN88go7kIfNPssr/hHCesKCQNAjmgvYS2oqr69kIufEG+O4+PfezOH4EbIeHCfFov8ZgQ==",
+      "version": "14.0.1",
+      "resolved": "https://registry.npmjs.org/uuid/-/uuid-14.0.1.tgz",
+      "integrity": "sha512-6ZxzVpzDXDa3bJWaHilVayA+BH/1zmxCJoVgvmqJnid/gPoKHxUrS/aC/T6LGQtNHT+XHG9fXPJB4d+IrU30Ew==",
       "funding": [
         "https://github.com/sponsors/broofa",
         "https://github.com/sponsors/ctavan"
       ],
       "license": "MIT",
       "bin": {
-        "uuid": "dist/esm/bin/uuid"
+        "uuid": "dist-node/bin/uuid"
       }
     },
     "node_modules/v8-compile-cache-lib": {
```

---

### Incident Patch 4: `aa63c7dc` (2026-08-04)
**Commit Message**: fix(security): remediate open alerts (#3002)

**File**: `apps/api/package.json` (modified, +2/-2)
```diff
@@ -37,11 +37,11 @@
     "@nestjs/schedule": "^6.1.3",
     "@nestjs/swagger": "^11.4.4",
     "@opentelemetry/api": "^1.9.1",
-    "@opentelemetry/auto-instrumentations-node": "^0.77.0",
+    "@opentelemetry/auto-instrumentations-node": "^0.79.0",
     "@opentelemetry/instrumentation-express": "^0.66.0",
     "@opentelemetry/instrumentation-http": "^0.219.0",
     "@opentelemetry/instrumentation-nestjs-core": "^0.64.0",
-    "@opentelemetry/sdk-node": "^0.219.0",
+    "@opentelemetry/sdk-node": "^0.221.0",
     "@opentelemetry/semantic-conventions": "^1.41.1",
     "@react-email/components": "^1.0.12",
     "@sentry/nestjs": "^10.57.0",
```

**File**: `apps/docs-mcp/package.json` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@
   "dependencies": {
     "@sentry/nextjs": "^10.56.0",
     "mcp-handler": "^1.1.0",
-    "next": "^16.0.0",
+    "next": "^16.2.12",
     "openai": "^6.16.0",
     "react": "^19.1.0",
     "react-dom": "^19.1.0",
```

**File**: `apps/test-mcp-server/cors.test.mjs` (added, +133/-0)
```diff
@@ -0,0 +1,133 @@
+import assert from "node:assert/strict";
+import test from "node:test";
+
+import { createMcpCorsMiddleware, isAllowedCorsOrigin } from "./src/cors.js";
+
+function createResponse() {
+  const headers = new Map();
+
+  return {
+    body: undefined,
+    headers,
+    statusCode: 200,
+    send(body) {
+      this.body = body;
+      return this;
+    },
+    sendStatus(statusCode) {
+      this.statusCode = statusCode;
+      return this;
+    },
+    setHeader(name, value) {
+      headers.set(name.toLowerCase(), value);
+      return this;
+    },
+    status(statusCode) {
+      this.statusCode = statusCode;
+      return this;
+    },
+    vary(field) {
+      headers.set("vary", field);
+      return this;
+    },
+  };
+}
+
+function invokeCors({ allowedOrigins, method = "POST", origin }) {
+  const response = createResponse();
+  let nextCalls = 0;
+
+  createMcpCorsMiddleware(allowedOrigins)(
+    {
+      header(name) {
+        return name.toLowerCase() === "origin" ? origin : undefined;
+      },
+      method,
+    },
+    response,
+    () => {
+      nextCalls += 1;
+    },
+  );
+
+  return { nextCalls, response };
+}
+
+void test("allows only loopback and configured browser origins", () => {
+  const allowedOrigins = ["https://preview.tambo.co"];
+
+  assert.equal(isAllowedCorsOrigin(undefined, allowedOrigins), true);
+  assert.equal(
+    isAllowedCorsOrigin("http://localhost:3000", allowedOrigins),
+    true,
+  );
+  assert.equal(
+    isAllowedCorsOrigin("https://127.0.0.1:3000", allowedOrigins),
+    true,
+  );
+  assert.equal(isAllowedCorsOrigin("http://[::1]:3000", allowedOrigins), true);
+  assert.equal(
+    isAllowedCorsOrigin("https://preview.tambo.co", allowedOrigins),
+    true,
+  );
+  assert.equal(
+    isAllowedCorsOrigin("https://attacker.example", allowedOrigins),
+    false,
+  );
+  assert.equal(
+    isAllowedCorsOrigin("https://localhost.attacker.example", allowedOrigins),
+    false,
+  );
+  assert.equal(isAllowedCorsOrigin("not an origin", allowedOrigins), false);
+});
+
+void test("rejects browser requests from unconfigured origins", () => {
+  const { nextCalls, response } = invokeCors({
+    allowedOrigins: [],
+    origin: "https://attacker.example",
+  });
+
+  assert.equal(nextCalls, 0);
+  assert.equal(response.statusCode, 403);
+  assert.equal(response.body, "Origin is not allowed");
+});
+
+void test("sets CORS headers for allowed browser requests", () => {
+  const origin = "https://preview.tambo.co";
+  const { nextCalls, response } = invokeCors({
+    allowedOrigins: [origin],
+    origin,
+  });
+
+  assert.equal(nextCalls, 1);
+  assert.equal(response.headers.get("access-control-allow-origin"), origin);
+  assert.equal(
+    response.headers.get("access-control-allow-methods"),
+    "GET, POST, DELETE",
+  );
+  assert.equal(
+    response.headers.get("access-control-allow-headers"),
+    "authorization, content-type, mcp-protocol-version, mcp-session-id, last-event-id",
+  );
+  assert.equal(
+    response.headers.get("access-control-expose-headers"),
+    "mcp-session-id, last-event-id, mcp-protocol-version",
+  );
+  assert.equal(response.headers.get("vary"), "Origin");
+});
+
+void test("ends allowed CORS preflight requests", () => {
+  const { nextCalls, response } = invokeCors({
+    allowedOrigins: [],
+    method: "OPTIONS",
+    origin: "http://localhost:3000",
+  });
+
+  assert.equal(nextCalls, 0);
+  assert.equal(response.statusCode, 204);
+  assert.equal(
+    response.headers.get("access-control-allow-origin"),
+    "http://localhost:3000",
+  );
+  assert.equal(response.headers.get("vary"), "Origin");
+});
```

**File**: `apps/test-mcp-server/package.json` (modified, +2/-4)
```diff
@@ -16,21 +16,19 @@
     "dev": "tsx src/index.ts",
     "lint": "eslint",
     "lint:fix": "eslint --fix",
-    "test": "jest --passWithNoTests",
+    "test": "tsx --test *.test.mjs",
     "check-types": "tsc --noEmit"
   },
   "author": "",
   "license": "Apache-2.0",
   "dependencies": {
-    "@modelcontextprotocol/sdk": "^1.27.1",
+    "@modelcontextprotocol/sdk": "^1.30.0",
     "commander": "^14.0.3",
-    "cors": "^2.8.5",
     "express": "^5.1.0"
   },
   "devDependencies": {
     "@tambo-ai/eslint-config": "*",
     "@tambo-ai/typescript-config": "*",
-    "@types/cors": "^2.8.19",
     "@types/express": "^5.0.0",
     "@types/node": "^22.19.15",
     "tsx": "^4.21.0",
```

**File**: `apps/test-mcp-server/src/cors.ts` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+import type { RequestHandler } from "express";
+
+const LOCAL_ORIGIN_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
+
+const ALLOWED_METHODS = "GET, POST, DELETE";
+const ALLOWED_HEADERS =
+  "authorization, content-type, mcp-protocol-version, mcp-session-id, last-event-id";
+const EXPOSED_HEADERS = "mcp-session-id, last-event-id, mcp-protocol-version";
+
+export function isAllowedCorsOrigin(
+  origin: string | undefined,
+  allowedOrigins: readonly string[],
+): boolean {
+  if (!origin || allowedOrigins.includes(origin)) {
+    return true;
+  }
+
+  try {
+    const url = new URL(origin);
+    return (
+      (url.protocol === "http:" || url.protocol === "https:") &&
+      LOCAL_ORIGIN_HOSTS.has(url.hostname)
+    );
+  } catch {
+    return false;
+  }
+}
+
+export function createMcpCorsMiddleware(
+  allowedOrigins: readonly string[],
+): RequestHandler {
+  return (request, response, next) => {
+    const origin = request.header("origin");
+
+    if (!isAllowedCorsOrigin(origin, allowedOrigins)) {
+      response.status(403).send("Origin is not allowed");
+      return;
+    }
+
+    if (!origin) {
+      next();
+      return;
+    }
+
+    response.setHeader("Access-Control-Allow-Origin", origin);
+    response.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
+    response.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
+    response.setHeader("Access-Control-Expose-Headers", EXPOSED_HEADERS);
+    response.vary("Origin");
+
+    if (request.method === "OPTIONS") {
+      response.sendStatus(204);
+      return;
+    }
+
+    next();
+  };
+}
```

**File**: `apps/test-mcp-server/src/index.ts` (modified, +4/-14)
```diff
@@ -11,10 +11,10 @@ import {
   type CallToolRequest,
 } from "@modelcontextprotocol/sdk/types.js";
 import { Command } from "commander";
-import cors from "cors";
 import express from "express";
 import { createServer } from "http";
 import { randomUUID } from "node:crypto";
+import { createMcpCorsMiddleware } from "./cors.js";
 import { McpServiceRegistry } from "./mcp-service.js";
 import { testService } from "./test-service.js";
 // Create MCP service registry and register services
@@ -143,7 +143,7 @@ async function main() {
     )
     .option(
       "--allowed-origins <origins>",
-      "comma-separated list of allowed origins for DNS rebinding protection",
+      "comma-separated configured origins for CORS and DNS rebinding protection (loopback origins are always allowed by CORS)",
     )
     .parse(process.argv);
 
@@ -187,18 +187,8 @@ async function main() {
       serverOptions.enableSessionManagement ?? true;
     app.use(
       "/mcp",
-      cors({
-        origin: "*", // use "*" with caution in production
-        methods: "GET,POST,DELETE",
-        preflightContinue: false,
-        optionsSuccessStatus: 204,
-        exposedHeaders: [
-          "mcp-session-id",
-          "last-event-id",
-          "mcp-protocol-version",
-        ],
-      }),
-    ); // Enable CORS for all routes so Inspector can connect
+      createMcpCorsMiddleware(serverOptions.allowedOrigins ?? []),
+    );
 
     // Handle POST requests for client-to-server communication
     app.post("/mcp", async (req, res) => {
```

**File**: `apps/web/package.json` (modified, +6/-6)
```diff
@@ -18,7 +18,7 @@
   },
   "dependencies": {
     "@hookform/resolvers": "^5.4.0",
-    "@modelcontextprotocol/sdk": "^1.27.1",
+    "@modelcontextprotocol/sdk": "^1.30.0",
     "@radix-ui/react-accordion": "^1.2.12",
     "@radix-ui/react-alert-dialog": "^1.1.15",
     "@radix-ui/react-avatar": "^1.1.11",
@@ -66,7 +66,7 @@
     "clsx": "^2.1.1",
     "cmdk": "^1.1.1",
     "date-fns": "^4.1.0",
-    "dompurify": "^3.4.11",
+    "dompurify": "^3.4.12",
     "drizzle-orm": "^0.45.2",
     "embla-carousel-react": "^8.6.0",
     "framer-motion": "^12.29.0",
@@ -75,12 +75,12 @@
     "jiti": "^2.7.0",
     "jose": "^5.10.0",
     "js-tiktoken": "^1.0.21",
-    "js-yaml": "^4.2.0",
+    "js-yaml": "^4.3.0",
     "json-stringify-pretty-compact": "^4.0.0",
     "lucide-react": "^0.577.0",
     "luxon": "^3.7.2",
-    "next": "^16.2.6",
-    "next-auth": "^4.24.14",
+    "next": "^16.2.12",
+    "next-auth": "^4.24.15",
     "next-themes": "^0.4.5",
     "posthog-js": "^1.380.0",
     "radix-ui": "^1.5.0",
@@ -130,7 +130,7 @@
     "identity-obj-proxy": "^3.0.0",
     "jest": "^30.4.2",
     "jest-environment-jsdom": "^30.4.1",
-    "postcss": "^8.5.15",
+    "postcss": "^8.5.18",
     "tailwindcss": "^3.4.19",
     "ts-jest": "^29.4.11",
     "typescript": "5.9.3"
```

**File**: `cli/AGENTS.md` (modified, +1/-1)
```diff
@@ -192,7 +192,7 @@ CLI utilities use Jest with ESM support and memfs for filesystem mocking:
 - **Location**: Tests live beside the files they cover
 - **Example**: `src/commands/add/index.ts` → `src/commands/add/index.test.ts`
 - Use `memfs` (`vol.fromJSON()`) to mock filesystem operations
-- Mock external dependencies: `child_process.execSync`, `inquirer.prompt`, registry utilities
+- Mock external dependencies: the `execFileSync` wrapper in `src/utils/interactive.ts`, `inquirer.prompt`, registry utilities
 - Helper functions in `src/__fixtures__/mock-fs-setup.ts` for common test scenarios
 - See `src/commands/list/index.test.ts` and `src/commands/add/index.test.ts` for examples
 
```

---

### Incident Patch 5: `8290e431` (2026-08-04)
**Commit Message**: chore(deps): update dependency undici to v8 [security] (#3001)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `.github/scripts/package-lock.json` (modified, +4/-4)
```diff
@@ -749,12 +749,12 @@
       }
     },
     "node_modules/undici": {
-      "version": "6.27.0",
-      "resolved": "https://registry.npmjs.org/undici/-/undici-6.27.0.tgz",
-      "integrity": "sha512-YmfV3YnEDzXRC5lZ2jWtWWHKGUm1zIt8AhesR1tens+HTNv+YZlN/dp6G727LOvMJ8xjP9Be7Y2Sdr96LDm+pg==",
+      "version": "8.10.0",
+      "resolved": "https://registry.npmjs.org/undici/-/undici-8.10.0.tgz",
+      "integrity": "sha512-HvltHd7avK13QIw/oLe4qoOLyoVSoafqJ2jYOrtMRBkbYT31eiBQ8O0ehRKZiEZCMEyLFQNIADpgCWC5fALvYQ==",
       "license": "MIT",
       "engines": {
-        "node": ">=18.17"
+        "node": ">=22.19.0"
       }
     },
     "node_modules/universal-user-agent": {
```

**File**: `.github/scripts/package.json` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@
     "tsx": "^4.20.5"
   },
   "overrides": {
-    "undici": "^6.27.0"
+    "undici": "^8.0.0"
   },
   "engines": {
     "node": ">=22.0.0"
```

---

### Incident Patch 6: `e7e467fb` (2026-08-04)
**Commit Message**: chore(deps): update dependency next to v15.5.21 [security] (#2997)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>
Co-authored-by: CharlieHelps <[REDACTED_EMAIL]>

**File**: `apps/docs-mcp/package.json` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@
   "dependencies": {
     "@sentry/nextjs": "^10.56.0",
     "mcp-handler": "^1.1.0",
-    "next": "^15.5.18",
+    "next": "^16.0.0",
     "openai": "^6.16.0",
     "react": "^19.1.0",
     "react-dom": "^19.1.0",
```

**File**: `docs/package.json` (modified, +2/-2)
```diff
@@ -4,7 +4,7 @@
   "description": "Tambo AI documentation site",
   "license": "MIT",
   "scripts": {
-    "build": "next build",
+    "build": "next build --webpack",
     "check-types": "tsc --noEmit",
     "dev": "next dev -p 8263",
     "lint": "eslint .",
@@ -28,7 +28,7 @@
     "json-stringify-pretty-compact": "^4.0.0",
     "lucide-react": "^0.577.0",
     "mermaid": "^11.15.0",
-    "next": "^15.5.18",
+    "next": "^16.0.0",
     "next-themes": "^0.4.6",
     "posthog-js": "^1.380.0",
     "radix-ui": "^1.5.0",
```

**File**: `package-lock.json` (modified, +43/-417)
```diff
@@ -249,7 +249,7 @@
       "dependencies": {
         "@sentry/nextjs": "^10.56.0",
         "mcp-handler": "^1.1.0",
-        "next": "^15.5.18",
+        "next": "^16.0.0",
         "openai": "^6.16.0",
         "react": "^19.1.0",
         "react-dom": "^19.1.0",
@@ -262,86 +262,6 @@
         "typescript": "^5.9.3"
       }
     },
-    "apps/docs-mcp/node_modules/next": {
-      "version": "15.5.20",
-      "resolved": "https://registry.npmjs.org/next/-/next-15.5.20.tgz",
-      "integrity": "sha512-cvyS3/geydan1xLtE3FA8VCgdoQ/Gg/dlOldFkFCbB5VcVYJV7090hQLBnvTW2PwT76Z/dHdzDZCsVhZpoOlUA==",
-      "license": "MIT",
-      "dependencies": {
-        "@next/env": "15.5.20",
-        "@swc/helpers": "0.5.15",
-        "caniuse-lite": "^1.0.30001579",
-        "postcss": "8.4.31",
-        "styled-jsx": "5.1.6"
-      },
-      "bin": {
-        "next": "dist/bin/next"
-      },
-      "engines": {
-        "node": "^18.18.0 || ^19.8.0 || >= 20.0.0"
-      },
-      "optionalDependencies": {
-        "@next/swc-darwin-arm64": "15.5.20",
-        "@next/swc-darwin-x64": "15.5.20",
-        "@next/swc-linux-arm64-gnu": "15.5.20",
-        "@next/swc-linux-arm64-musl": "15.5.20",
-        "@next/swc-linux-x64-gnu": "15.5.20",
-        "@next/swc-linux-x64-musl": "15.5.20",
-        "@next/swc-win32-arm64-msvc": "15.5.20",
-        "@next/swc-win32-x64-msvc": "15.5.20",
-        "sharp": "^0.34.3"
-      },
-      "peerDependencies": {
-        "@opentelemetry/api": "^1.1.0",
-        "@playwright/test": "^1.51.1",
-        "babel-plugin-react-compiler": "*",
-        "react": "^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0",
-        "react-dom": "^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0",
-        "sass": "^1.3.0"
-      },
-      "peerDependenciesMeta": {
-        "@opentelemetry/api": {
-          "optional": true
-        },
-        "@playwright/test": {
-          "optional": true
-        },
-        "babel-plugin-react-compiler": {
-          "optional": true
-        },
-        "sass": {
-          "optional": true
-        }
-      }
-    },
-    "apps/docs-mcp/node_modules/postcss": {
-      "version": "8.4.31",
-      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.4.31.tgz",
-      "integrity": "sha512-PS08Iboia9mts/2ygV3eLpY5ghnUcfLV/EXTOW1E2qYxJKGGBUtNjN76FYHnMs36RmARn41bC0AZmn+rR0OVpQ==",
-      "funding": [
-        {
-          "type": "opencollective",
-          "url": "https://opencollective.com/postcss/"
-        },
-        {
-          "type": "tidelift",
-          "url": "https://tidelift.com/funding/github/npm/postcss"
-        },
-        {
-          "type": "github",
-          "url": "https://github.com/sponsors/ai"
-        }
-      ],
-      "license": "MIT",
-      "dependencies": {
-        "nanoid": "^3.3.6",
-        "picocolors": "^1.0.0",
-        "source-map-js": "^1.0.2"
-      },
-      "engines": {
-        "node": "^10 || ^12 || >=14"
-      }
-    },
     "apps/test-mcp-server": {
       "name": "@tambo-ai-cloud/test-mcp-server",
       "version": "0.0.1",
@@ -500,7 +420,7 @@
         "json-stringify-pretty-compact": "^4.0.0",
         "lucide-react": "^0.577.0",
         "luxon": "^3.7.2",
-        "next": "^16.2.10",
+        "next": "^16.2.6",
         "next-auth": "^4.24.14",
         "next-themes": "^0.4.5",
         "posthog-js": "^1.380.0",
@@ -850,7 +770,7 @@
         "json-stringify-pretty-compact": "^4.0.0",
         "lucide-react": "^0.577.0",
         "mermaid": "^11.15.0",
-        "next": "^15.5.18",
+        "next": "^16.0.0",
         "next-themes": "^0.4.6",
         "posthog-js": "^1.380.0",
         "radix-ui": "^1.5.0",
@@ -887,86 +807,6 @@
         "undici-types": "~6.21.0"
       }
     },
-    "docs/node_modules/next": {
-      "version": "15.5.20",
-      "resolved": "https://registry.npmjs.org/next/-/next-15.5.20.tgz",
-      "integrity": "sha512-cvyS3/geydan1xLtE3FA8VCgdoQ/Gg/dlOldFkFCbB5VcVYJV7090hQLBnvTW2PwT76Z/dHdzDZCsVhZpoOlUA==",
-      "license": "MIT",
-      "dependencies": {
-        "@next/env": "15.5.20",
-        "@swc/helpers": "0.5.15",
-        "caniuse-lite": "^1.0.30001579",
-        "postcss": "8.4.31",
-        "styled-jsx": "5.1.6"
-      },
-      "bin": {
-        "next": "dist/bin/next"
-      },
-      "engines": {
-        "node": "^18.18.0 || ^19.8.0 || >= 20.0.0"
-      },
-      "optionalDependencies": {
-        "@next/swc-darwin-arm64": "15.5.20",
-        "@next/swc-darwin-x64": "15.5.20",
-        "@next/swc-linux-arm64-gnu": "15.5.20",
-        "@next/swc-linux-arm64-musl": "15.5.20",
-        "@next/swc-linux-x64-gnu": "15.5.20",
-        "@next/swc-linux-x64-musl": "15.5.20",
-        "@next/swc-win32-arm64-msvc": "15.5.20",
-        "@next/swc-win32-x64-msvc": "15.5.20",
-        "sharp": "^0.34.3"
-      },
-      "peerDependencies": {
-        "@opentelemetry/api": "^1.1.0",
-        "@playwright/test": "^1.51.1",
-        "babel-plugin-react-compiler": "*",
-        "react": "^18
```

**File**: `showcase/package.json` (modified, +2/-2)
```diff
@@ -6,7 +6,7 @@
   "license": "MIT",
   "scripts": {
     "dev": "next dev -p 8262",
-    "build": "next build",
+    "build": "next build --webpack",
     "postbuild": "next-sitemap",
     "start": "next start",
     "lint": "eslint",
@@ -48,7 +48,7 @@
     "leaflet.heat": "^0.2.0",
     "leaflet.markercluster": "^1.5.3",
     "lucide-react": "^0.577.0",
-    "next": "^15.5.18",
+    "next": "^16.0.0",
     "next-themes": "^0.4.6",
     "postcss": "^8.5.15",
     "posthog-js": "^1.380.0",
```

---

### Incident Patch 7: `d24882e2` (2026-07-13)
**Commit Message**: fix(client): prevent orphaned ephemeral messages persisting across runs (#2995)

**File**: `packages/client/src/utils/event-accumulator.test.ts` (modified, +177/-0)
```diff
@@ -4,6 +4,9 @@ import {
   type ReasoningMessageEndEvent,
   type ReasoningMessageStartEvent,
   type RunErrorEvent,
+  type RunFinishedEvent,
+  type RunStartedEvent,
+  type TextMessageStartEvent,
 } from "@ag-ui/core";
 import {
   createInitialState,
@@ -182,3 +185,177 @@ describe("streamReducer REASONING_MESSAGE_* handling", () => {
     expect(message.reasoningDurationMS).toBe(5000);
   });
 });
+
+describe("streamReducer ephemeral reasoning message lifecycle", () => {
+  it("clears streaming.messageId when a run finishes", () => {
+    let state = createTestStreamState("thread_1");
+
+    const runStarted: RunStartedEvent = {
+      type: EventType.RUN_STARTED,
+      threadId: "thread_1",
+      runId: "run_1",
+    };
+    const reasoningStart: ReasoningMessageStartEvent = {
+      type: EventType.REASONING_MESSAGE_START,
+      messageId: "reasoning-1",
+      role: "reasoning",
+    };
+    const runFinished: RunFinishedEvent = {
+      type: EventType.RUN_FINISHED,
+      threadId: "thread_1",
+      runId: "run_1",
+    };
+
+    for (const event of [runStarted, reasoningStart, runFinished]) {
+      state = streamReducer(state, {
+        type: "EVENT",
+        event,
+        threadId: "thread_1",
+      });
+    }
+
+    const threadState = state.threadMap.thread_1;
+    // The reasoning event created an ephemeral message that was never adopted.
+    expect(threadState.thread.messages[0].id).toMatch(/^ephemeral_/);
+    // messageId must be cleared so the next run cannot hijack the orphan.
+    expect(threadState.streaming.messageId).toBeUndefined();
+  });
+
+  it("clears streaming.messageId when a run errors", () => {
+    let state = createTestStreamState("thread_1");
+
+    const runStarted: RunStartedEvent = {
+      type: EventType.RUN_STARTED,
+      threadId: "thread_1",
+      runId: "run_1",
+    };
+    const reasoningStart: ReasoningMessageStartEvent = {
+      type: EventType.REASONING_MESSAGE_START,
+      messageId: "reasoning-1",
+      role: "reasoning",
+    };
+    const runError: RunErrorEvent = {
+      type: EventType.RUN_ERROR,
+      message: "boom",
+      code: "INTERNAL_ERROR",
+    };
+
+    for (const event of [runStarted, reasoningStart, runError]) {
+      state = streamReducer(state, {
+        type: "EVENT",
+        event,
+        threadId: "thread_1",
+      });
+    }
+
+    expect(state.threadMap.thread_1.streaming.messageId).toBeUndefined();
+  });
+
+  it("does not adopt an orphaned ephemeral from a previous run", () => {
+    let state = createTestStreamState("thread_1");
+
+    // Run 1: model stalls after emitting reasoning only. An ephemeral is created
+    // to hold the reasoning but never adopted by a TEXT_MESSAGE_START.
+    const run1Started: RunStartedEvent = {
+      type: EventType.RUN_STARTED,
+      threadId: "thread_1",
+      runId: "run_1",
+    };
+    const reasoningStart: ReasoningMessageStartEvent = {
+      type: EventType.REASONING_MESSAGE_START,
+      messageId: "reasoning-1",
+      role: "reasoning",
+    };
+    const reasoningContent: ReasoningMessageContentEvent = {
+      type: EventType.REASONING_MESSAGE_CONTENT,
+      messageId: "reasoning-1",
+      delta: "thinking...",
+    };
+    const run1Finished: RunFinishedEvent = {
+      type: EventType.RUN_FINISHED,
+      threadId: "thread_1",
+      runId: "run_1",
+    };
+
+    // Run 2: a normal assistant text message.
+    const run2Started: RunStartedEvent = {
+      type: EventType.RUN_STARTED,
+      threadId: "thread_1",
+      runId: "run_2",
+    };
+    const textStart: TextMessageStartEvent = {
+      type: EventType.TEXT_MESSAGE_START,
+      messageId: "real-message-1",
+      role: "assistant",
+    };
+
+    for (const event of [
+      run1Started,
+      reasoningStart,
+      reasoningContent,
+      run1Finished,
+      run2Started,
+      textStart,
+    ]) {
+      state = streamReducer(state, {
+        type: "EVENT",
+        event,
+        threadId: "thread_1",
+      });
+    }
+
+    const { messages } = state.threadMap.thread_1.thread;
+    // The orphaned ephemeral must remain untouched at index 0.
+    expect(messages[0].id).toMatch(/^ephemeral_/);
+    expect(messages[0].reasoning).toEqual(["thinking..."]);
+    // A fresh message is created for run 2 rather than hijacking the orphan.
+    expect(messages).toHaveLength(2);
+    expect(messages[1].id).toBe("real-message-1");
+    expect(state.threadMap.thread_1.streaming.messageId).toBe("real-message-1");
+  });
+
+  it("still adopts the current run's ephemeral within the same run", () => {
+    let state = createTestStreamState("thread_1");
+
+    const runStarted: RunStartedEvent = {
+      type: EventType.RUN_STARTED,
+      threadId: "thread_1",
+      runId: "run_1",
+    };
+    const reasoningStart: ReasoningMessageStartEvent = {
+      type: EventType.REASONING_MESSAGE_START,
+      messageId: "reasoning-1",
+      role: "reasoning",
+    };
+    const reasoningContent: ReasoningMe
```

**File**: `packages/client/src/utils/event-accumulator.ts` (modified, +9/-4)
```diff
@@ -742,6 +742,7 @@ function handleRunFinished(
     streaming: {
       ...threadState.streaming,
       status: "idle",
+      messageId: undefined,
     },
   };
 }
@@ -777,6 +778,7 @@ function handleRunError(
     streaming: {
       ...threadState.streaming,
       status: "idle",
+      messageId: undefined,
       error: isCancelled
         ? undefined
         : {
@@ -804,13 +806,16 @@ function handleTextMessageStart(
   const isAssistant = event.role !== "user";
   const messages = threadState.thread.messages;
 
-  // For assistant messages, check if there's an ephemeral message with reasoning
-  // that we should merge into instead of creating a new message.
-  if (isAssistant) {
+  // For assistant messages, check if the current run created an ephemeral
+  // reasoning message that we should merge into instead of creating a new one.
+  // Scope the search to the active streaming messageId so we never adopt an
+  // orphaned ephemeral left behind by a previous run.
+  const activeMessageId = threadState.streaming.messageId;
+  if (isAssistant && activeMessageId?.startsWith("ephemeral_")) {
     const ephemeralIndex = messages.findIndex(
       (m) =>
+        m.id === activeMessageId &&
         m.role === "assistant" &&
-        m.id.startsWith("ephemeral_") &&
         m.reasoning &&
         m.reasoning.length > 0,
     );
```

---

### Incident Patch 8: `16ad0f86` (2026-07-08)
**Commit Message**: fix(deps): update tambo-ai to v0.96.4 (#2970)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `package-lock.json` (modified, +4/-4)
```diff
@@ -17114,9 +17114,9 @@
       "link": true
     },
     "node_modules/@tambo-ai/typescript-sdk": {
-      "version": "0.96.1",
-      "resolved": "https://registry.npmjs.org/@tambo-ai/typescript-sdk/-/typescript-sdk-0.96.1.tgz",
-      "integrity": "sha512-EMd1YhOymlZH9P6c5dOtlJ4SnrjHnezr1J2YYyELvE/BtqwAIkO3cXSt6fnXsSGgjGBva2c+hNe1EdJN4lcjcg==",
+      "version": "0.96.4",
+      "resolved": "https://registry.npmjs.org/@tambo-ai/typescript-sdk/-/typescript-sdk-0.96.4.tgz",
+      "integrity": "sha512-cecP5QuDBt0CV4c2t3oSIGminjw9Y27Dvhzpp9UmWn6AQOK5zoHASGeRXrhMGL2kWoK3E78XNFxNwTrnBh/Lbw==",
       "license": "Apache-2.0",
       "bin": {
         "tambo-ai-typescript-sdk": "bin/cli"
@@ -39923,7 +39923,7 @@
         "@modelcontextprotocol/sdk": "^1.27.1",
         "@standard-community/standard-json": "^0.3.5",
         "@standard-schema/spec": "^1.1.0",
-        "@tambo-ai/typescript-sdk": "0.96.1",
+        "@tambo-ai/typescript-sdk": "0.96.4",
         "fast-json-patch": "3.1.1",
         "partial-json": "0.1.7"
       },
```

**File**: `packages/client/package.json` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@
     "@modelcontextprotocol/sdk": "^1.27.1",
     "@standard-community/standard-json": "^0.3.5",
     "@standard-schema/spec": "^1.1.0",
-    "@tambo-ai/typescript-sdk": "0.96.1",
+    "@tambo-ai/typescript-sdk": "0.96.4",
     "fast-json-patch": "3.1.1",
     "partial-json": "0.1.7"
   },
```

---

### Incident Patch 9: `ef603660` (2026-07-08)
**Commit Message**: fix(deps): update dependency rxjs to v7.8.2 (#2967)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `apps/api/package.json` (modified, +1/-1)
```diff
@@ -70,7 +70,7 @@
     "react-fast-compare": "^3.2.2",
     "reflect-metadata": "^0.2.0",
     "resend": "^6.12.3",
-    "rxjs": "7.8.1",
+    "rxjs": "7.8.2",
     "superjson": "^2.2.6",
     "ts-essentials": "^10.1.1",
     "uuid": "^14.0.0"
```

**File**: `package-lock.json` (modified, +4/-9)
```diff
@@ -84,7 +84,7 @@
         "react-fast-compare": "^3.2.2",
         "reflect-metadata": "^0.2.0",
         "resend": "^6.12.3",
-        "rxjs": "7.8.1",
+        "rxjs": "7.8.2",
         "superjson": "^2.2.6",
         "ts-essentials": "^10.1.1",
         "uuid": "^14.0.0"
@@ -35646,6 +35646,8 @@
     },
     "node_modules/rxjs": {
       "version": "7.8.2",
+      "resolved": "https://registry.npmjs.org/rxjs/-/rxjs-7.8.2.tgz",
+      "integrity": "sha512-dhKf903U/PQZY6boNNtAGdWbG85WAbjT/1xYoZIC7FAY0yWapOBQVsVrDl58W86//e1VpMNBtRV4MaXfdMySFA==",
       "license": "Apache-2.0",
       "dependencies": {
         "tslib": "^2.1.0"
@@ -39770,7 +39772,7 @@
         "nanoid": "^3.3.11",
         "openai": "^6.33.0",
         "partial-json": "^0.1.7",
-        "rxjs": "7.8.1",
+        "rxjs": "7.8.2",
         "zod": "^3.25.76",
         "zod-to-json-schema": "^3.25.1"
       },
@@ -39839,13 +39841,6 @@
       "version": "1.0.0",
       "license": "MIT"
     },
-    "packages/backend/node_modules/rxjs": {
-      "version": "7.8.1",
-      "license": "Apache-2.0",
-      "dependencies": {
-        "tslib": "^2.1.0"
-      }
-    },
     "packages/client": {
       "name": "@tambo-ai/client",
       "version": "1.2.0",
```

**File**: `packages/backend/package.json` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@
     "nanoid": "^3.3.11",
     "openai": "^6.33.0",
     "partial-json": "^0.1.7",
-    "rxjs": "7.8.1",
+    "rxjs": "7.8.2",
     "zod": "^3.25.76",
     "zod-to-json-schema": "^3.25.1"
   },
```

---

### Incident Patch 10: `4e14c18d` (2026-07-08)
**Commit Message**: fix(deps): update ag-ui to v0.0.57 (#2966)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>
Co-authored-by: CharlieHelps <[REDACTED_EMAIL]>

**File**: `apps/api/package.json` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@
     "storage:init": "tsx scripts/storage-init.ts"
   },
   "dependencies": {
-    "@ag-ui/client": "0.0.53",
+    "@ag-ui/client": "0.0.57",
     "@ag-ui/crewai": "^0.0.3",
     "@ag-ui/llamaindex": "^0.1.5",
     "@ai-sdk/provider": "^3.0.8",
```

**File**: `package-lock.json` (modified, +31/-128)
```diff
@@ -39,7 +39,7 @@
       "version": "0.146.1",
       "license": "Apache-2.0",
       "dependencies": {
-        "@ag-ui/client": "0.0.53",
+        "@ag-ui/client": "0.0.57",
         "@ag-ui/crewai": "^0.0.3",
         "@ag-ui/llamaindex": "^0.1.5",
         "@ai-sdk/provider": "^3.0.10",
@@ -112,63 +112,6 @@
         "typescript": "^5.9.3"
       }
     },
-    "apps/api/node_modules/@ag-ui/client": {
-      "version": "0.0.53",
-      "resolved": "https://registry.npmjs.org/@ag-ui/client/-/client-0.0.53.tgz",
-      "integrity": "sha512-Mkup36KUp0KXy9v89QtAOWDUoh8H1s1Vgl4zvQv9HqXuAK1TkbtpXJHpbgZJXIxTqd54KT6yCurmC2UkOP7FDQ==",
-      "dependencies": {
-        "@ag-ui/core": "0.0.53",
-        "@ag-ui/encoder": "0.0.53",
-        "@ag-ui/proto": "0.0.53",
-        "@types/uuid": "^10.0.0",
-        "compare-versions": "^6.1.1",
-        "fast-json-patch": "^3.1.1",
-        "rxjs": "7.8.1",
-        "untruncate-json": "^0.0.1",
-        "uuid": "^11.1.0",
-        "zod": "^3.22.4"
-      }
-    },
-    "apps/api/node_modules/@ag-ui/client/node_modules/uuid": {
-      "version": "11.1.1",
-      "resolved": "https://registry.npmjs.org/uuid/-/uuid-11.1.1.tgz",
-      "integrity": "sha512-vIYxrBCC/N/K+Js3qSN88go7kIfNPssr/hHCesKCQNAjmgvYS2oqr69kIufEG+O4+PfezOH4EbIeHCfFov8ZgQ==",
-      "funding": [
-        "https://github.com/sponsors/broofa",
-        "https://github.com/sponsors/ctavan"
-      ],
-      "license": "MIT",
-      "bin": {
-        "uuid": "dist/esm/bin/uuid"
-      }
-    },
-    "apps/api/node_modules/@ag-ui/core": {
-      "version": "0.0.53",
-      "resolved": "https://registry.npmjs.org/@ag-ui/core/-/core-0.0.53.tgz",
-      "integrity": "sha512-11UocR7fFdMWw503bWCX2IOK15vbWfxT11Mn9xOiPBVO/UVcn57ywGrlLL4UaBlPgmUTvuzr2yYR2ElSqiN2wQ==",
-      "dependencies": {
-        "zod": "^3.22.4"
-      }
-    },
-    "apps/api/node_modules/@ag-ui/encoder": {
-      "version": "0.0.53",
-      "resolved": "https://registry.npmjs.org/@ag-ui/encoder/-/encoder-0.0.53.tgz",
-      "integrity": "sha512-bAOcfVdm6U4H6G6tW+DZfwPEQm1w/snVBTwaFn9nJcEMW69M7/HZuwvEc/7Zo0rK1jRL32N/j60PwTAeky19fw==",
-      "dependencies": {
-        "@ag-ui/core": "0.0.53",
-        "@ag-ui/proto": "0.0.53"
-      }
-    },
-    "apps/api/node_modules/@ag-ui/proto": {
-      "version": "0.0.53",
-      "resolved": "https://registry.npmjs.org/@ag-ui/proto/-/proto-0.0.53.tgz",
-      "integrity": "sha512-swjz22xWT8YUZt5OhmUwkARDQdwt8XM1hmGZbQrhRnNPXKwrKJX9ELlbnQ4iFUQIKkMWpphzE3vA3yNKs2bbKw==",
-      "dependencies": {
-        "@ag-ui/core": "0.0.53",
-        "@bufbuild/protobuf": "^2.2.5",
-        "@protobuf-ts/protoc": "^2.11.1"
-      }
-    },
     "apps/api/node_modules/@ai-sdk/provider": {
       "version": "3.0.10",
       "resolved": "https://registry.npmjs.org/@ai-sdk/provider/-/provider-3.0.10.tgz",
@@ -1443,13 +1386,13 @@
       "license": "MIT"
     },
     "node_modules/@ag-ui/client": {
-      "version": "0.0.44",
-      "resolved": "https://registry.npmjs.org/@ag-ui/client/-/client-0.0.44.tgz",
-      "integrity": "sha512-lYOdVSD/PSzVqY6CuWmQxUFoMEF6mo3CYvy22P/Wgs6bROjc6JDs3N0Lu46ZADJPiS1hcoDPtfMwSF2XisftFg==",
+      "version": "0.0.57",
+      "resolved": "https://registry.npmjs.org/@ag-ui/client/-/client-0.0.57.tgz",
+      "integrity": "sha512-Xap2alG9Z0/j5kb3x4D7oTpe2sw1dfrC9rgJJr2NZu5vKcm8dzIPNd31mF2B4zS3BKqYIu245yxKPhEtT30MHw==",
       "dependencies": {
-        "@ag-ui/core": "0.0.44",
-        "@ag-ui/encoder": "0.0.44",
-        "@ag-ui/proto": "0.0.44",
+        "@ag-ui/core": "0.0.57",
+        "@ag-ui/encoder": "0.0.57",
+        "@ag-ui/proto": "0.0.57",
         "@types/uuid": "^10.0.0",
         "compare-versions": "^6.1.1",
         "fast-json-patch": "^3.1.1",
@@ -1469,21 +1412,13 @@
       }
     },
     "node_modules/@ag-ui/core": {
-      "version": "0.0.44",
-      "resolved": "https://registry.npmjs.org/@ag-ui/core/-/core-0.0.44.tgz",
-      "integrity": "sha512-xX6oSGZ+yqG/qIhzfbGRcenIKoSzWhrYerRZIFwYqa1keN55Zybbp29/zuauWNy0OwffVnWQ5bhR2mRVqgsk/w==",
+      "version": "0.0.57",
+      "resolved": "https://registry.npmjs.org/@ag-ui/core/-/core-0.0.57.tgz",
+      "integrity": "sha512-gho1OWjNE6E3Rl7ZEZ1wr2CEpUHjLFU0FqzCZZk439TicLu+BfLCMkMokB07bMGlRmbJ60hM6LW60iOVauCx+Q==",
       "dependencies": {
-        "rxjs": "7.8.1",
         "zod": "^3.22.4"
       }
     },
-    "node_modules/@ag-ui/core/node_modules/rxjs": {
-      "version": "7.8.1",
-      "license": "Apache-2.0",
-      "dependencies": {
-        "tslib": "^2.1.0"
-      }
-    },
     "node_modules/@ag-ui/crewai": {
       "version": "0.0.3",
       "peerDependencies": {
@@ -1493,12 +1428,12 @@
       }
     },
     "node_modules/@ag-ui/encoder": {
-      "version": "0.0.44",
-      "resolved": "https://registry.npmjs.org/@ag-ui/encoder/-/encoder-0.0.44.tgz",
-      "integrity": "sha512-5jXmWv02ONy7BViMNdx1U9UJAnecAPPefq+Tjva2bXQSZ7NnKmnqLlg/m+d0UFm1Jt5JhIgdgSx2YGg0p8QDxA==",
+      "version": "0.0.57",
+      "resolved": "ht
```

**File**: `packages/backend/package.json` (modified, +2/-2)
```diff
@@ -24,8 +24,8 @@
   "author": "",
   "license": "Apache-2.0",
   "dependencies": {
-    "@ag-ui/client": "0.0.44",
-    "@ag-ui/core": "^0.0.44",
+    "@ag-ui/client": "0.0.57",
+    "@ag-ui/core": "^0.0.57",
     "@ag-ui/crewai": "^0.0.3",
     "@ag-ui/llamaindex": "^0.1.5",
     "@ag-ui/mastra": "^1.0.0",
```

**File**: `packages/backend/src/services/llm/agent-client.test.ts` (modified, +56/-0)
```diff
@@ -877,6 +877,62 @@ describe("AgentClient", () => {
         expect(responses).toMatchSnapshot();
       });
 
+      it("should handle AG-UI reasoning message events", async () => {
+        const queue = new AsyncQueue<EventHandlerParams>();
+        const stream = agentClient.streamRunAgent(queue, {
+          messages: [mockMessage("Think about this")],
+          tools: [],
+        });
+
+        mockGenerator.pushEvent({
+          type: EventType.REASONING_START,
+          messageId: "reasoning-1",
+        });
+
+        mockGenerator.pushEvent({
+          type: EventType.REASONING_MESSAGE_START,
+          messageId: "reasoning-message-1",
+          role: "reasoning",
+        });
+
+        mockGenerator.pushEvent({
+          type: EventType.REASONING_MESSAGE_CONTENT,
+          messageId: "reasoning-message-1",
+          delta: "Let me think about this...",
+        });
+
+        mockGenerator.pushEvent({
+          type: EventType.REASONING_MESSAGE_END,
+          messageId: "reasoning-message-1",
+        });
+
+        mockGenerator.pushEvent({
+          type: EventType.REASONING_END,
+          messageId: "reasoning-1",
+        });
+
+        mockGenerator.pushEvent({
+          type: EventType.RUN_FINISHED,
+          result: "Reasoning completed",
+        });
+
+        const responses: AgentResponse[] = [];
+        for await (const response of stream) {
+          responses.push(response);
+        }
+
+        mockGenerator.finish();
+
+        expect(responses).toHaveLength(4);
+        expect(responses[0].message.reasoning).toEqual([]);
+        expect(responses[1].message.reasoning).toEqual([""]);
+        expect(responses[2].message.reasoning).toEqual([
+          "Let me think about this...",
+        ]);
+        expect(responses[3].message.content).toBe("Reasoning completed");
+        expect(responses[3].complete).toBe(true);
+      });
+
       it("should handle multiple thinking text messages", async () => {
         const queue = new AsyncQueue<EventHandlerParams>();
         const stream = agentClient.streamRunAgent(queue, {
```

**File**: `packages/backend/src/services/llm/agent-client.ts` (modified, +25/-9)
```diff
@@ -12,6 +12,8 @@ import {
 } from "@ag-ui/client";
 import {
   Message as AGUIMessage,
+  ReasoningMessageChunkEvent,
+  ReasoningMessageContentEvent,
   StateDeltaEvent,
   ThinkingTextMessageContentEvent,
   ToolCallEndEvent,
@@ -44,7 +46,10 @@ interface WithReasoning {
   parentMessageId?: string;
 }
 
-type NonActivityMessage = Exclude<AGUIMessage, { role: "activity" }>;
+type NonActivityMessage = Extract<
+  AGUIMessage,
+  { role: "assistant" | "developer" | "system" | "tool" | "user" }
+>;
 
 export type AgentMessage = NonActivityMessage & WithReasoning;
 
@@ -463,7 +468,8 @@ export class AgentClient {
           // this is kind of out-of-band events, not sure what to do with them yet.
           break;
         }
-        case EventType.THINKING_START: {
+        case EventType.THINKING_START:
+        case EventType.REASONING_START: {
           if (!currentMessage) {
             currentMessage = createNewMessage("assistant", generateMessageId());
           }
@@ -477,10 +483,12 @@ export class AgentClient {
           };
           break;
         }
-        case EventType.THINKING_END: {
+        case EventType.THINKING_END:
+        case EventType.REASONING_END: {
           break;
         }
-        case EventType.THINKING_TEXT_MESSAGE_START: {
+        case EventType.THINKING_TEXT_MESSAGE_START:
+        case EventType.REASONING_MESSAGE_START: {
           if (!currentMessage) {
             currentMessage = createNewMessage("assistant", generateMessageId());
           }
@@ -496,8 +504,13 @@ export class AgentClient {
           break;
         }
 
-        case EventType.THINKING_TEXT_MESSAGE_CONTENT: {
-          const e = event as ThinkingTextMessageContentEvent;
+        case EventType.THINKING_TEXT_MESSAGE_CONTENT:
+        case EventType.REASONING_MESSAGE_CONTENT:
+        case EventType.REASONING_MESSAGE_CHUNK: {
+          const e = event as
+            | ThinkingTextMessageContentEvent
+            | ReasoningMessageContentEvent
+            | ReasoningMessageChunkEvent;
           if (!currentMessage) {
             throw new Error("No current message");
           }
@@ -506,7 +519,7 @@ export class AgentClient {
           currentMessage = Object.assign({}, currentMessage, {
             reasoning: [
               ...(currentMessage.reasoning?.slice(0, -1) ?? []),
-              currentReasoningString + e.delta,
+              currentReasoningString + (e.delta ?? ""),
             ],
           });
           yield {
@@ -515,7 +528,9 @@ export class AgentClient {
           };
           break;
         }
-        case EventType.THINKING_TEXT_MESSAGE_END: {
+        case EventType.THINKING_TEXT_MESSAGE_END:
+        case EventType.REASONING_MESSAGE_END:
+        case EventType.REASONING_ENCRYPTED_VALUE: {
           break;
         }
         case EventType.ACTIVITY_SNAPSHOT:
@@ -545,7 +560,8 @@ function invalidEvent(eventType: never) {
 function getLastMessage(messages: AGUIMessage[]): NonActivityMessage | null {
   // Filter out activity messages and get the last non-activity message
   const nonActivityMessages = messages.filter(
-    (m): m is NonActivityMessage => m.role !== "activity",
+    (m): m is NonActivityMessage =>
+      m.role !== "activity" && m.role !== "reasoning",
   );
   return nonActivityMessages.length > 0
     ? nonActivityMessages[nonActivityMessages.length - 1]
```

**File**: `packages/client/package.json` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@
     }
   },
   "dependencies": {
-    "@ag-ui/core": "^0.0.44",
+    "@ag-ui/core": "^0.0.57",
     "@modelcontextprotocol/sdk": "^1.27.1",
     "@standard-community/standard-json": "^0.3.5",
     "@standard-schema/spec": "^1.1.0",
```

**File**: `packages/client/src/utils/event-accumulator.test.ts` (modified, +53/-1)
```diff
@@ -1,4 +1,10 @@
-import { EventType, type RunErrorEvent } from "@ag-ui/core";
+import {
+  EventType,
+  type ReasoningMessageContentEvent,
+  type ReasoningMessageEndEvent,
+  type ReasoningMessageStartEvent,
+  type RunErrorEvent,
+} from "@ag-ui/core";
 import {
   createInitialState,
   createInitialThreadState,
@@ -130,3 +136,49 @@ describe("streamReducer RUN_ERROR handling", () => {
     expect(error?.isRetryable).toBeUndefined();
   });
 });
+
+describe("streamReducer REASONING_MESSAGE_* handling", () => {
+  it("accumulates reasoning content and duration on an assistant message", () => {
+    const state = createTestStreamState("thread_1");
+
+    const startEvent: ReasoningMessageStartEvent = {
+      type: EventType.REASONING_MESSAGE_START,
+      messageId: "reasoning-message-1",
+      role: "reasoning",
+      timestamp: 1704067200000,
+    };
+    const contentEvent: ReasoningMessageContentEvent = {
+      type: EventType.REASONING_MESSAGE_CONTENT,
+      messageId: "reasoning-message-1",
+      delta: "Let me think about this...",
+      timestamp: 1704067201000,
+    };
+    const endEvent: ReasoningMessageEndEvent = {
+      type: EventType.REASONING_MESSAGE_END,
+      messageId: "reasoning-message-1",
+      timestamp: 1704067205000,
+    };
+
+    const afterStart = streamReducer(state, {
+      type: "EVENT",
+      event: startEvent,
+      threadId: "thread_1",
+    });
+    const afterContent = streamReducer(afterStart, {
+      type: "EVENT",
+      event: contentEvent,
+      threadId: "thread_1",
+    });
+    const afterEnd = streamReducer(afterContent, {
+      type: "EVENT",
+      event: endEvent,
+      threadId: "thread_1",
+    });
+
+    const [message] = afterEnd.threadMap.thread_1.thread.messages;
+
+    expect(message.role).toBe("assistant");
+    expect(message.reasoning).toEqual(["Let me think about this..."]);
+    expect(message.reasoningDurationMS).toBe(5000);
+  });
+});
```

**File**: `packages/client/src/utils/event-accumulator.ts` (modified, +35/-5)
```diff
@@ -8,6 +8,10 @@
 import type {
   AGUIEvent,
   CustomEvent,
+  ReasoningMessageChunkEvent,
+  ReasoningMessageContentEvent,
+  ReasoningMessageEndEvent,
+  ReasoningMessageStartEvent,
   RunErrorEvent,
   RunFinishedEvent,
   RunStartedEvent,
@@ -614,15 +618,36 @@ export function streamReducer(
       updatedThreadState = handleCustomEvent(threadState, event);
       break;
 
+    case EventType.REASONING_START:
+      updatedThreadState = {
+        ...threadState,
+        streaming: {
+          ...threadState.streaming,
+          reasoningStartTime:
+            threadState.streaming.reasoningStartTime ??
+            event.timestamp ??
+            Date.now(),
+        },
+      };
+      break;
+
+    case EventType.REASONING_END:
+      updatedThreadState = threadState;
+      break;
+
     case EventType.THINKING_TEXT_MESSAGE_START:
+    case EventType.REASONING_MESSAGE_START:
       updatedThreadState = handleThinkingTextMessageStart(threadState, event);
       break;
 
     case EventType.THINKING_TEXT_MESSAGE_CONTENT:
+    case EventType.REASONING_MESSAGE_CONTENT:
+    case EventType.REASONING_MESSAGE_CHUNK:
       updatedThreadState = handleThinkingTextMessageContent(threadState, event);
       break;
 
     case EventType.THINKING_TEXT_MESSAGE_END:
+    case EventType.REASONING_MESSAGE_END:
       updatedThreadState = handleThinkingTextMessageEnd(threadState, event);
       break;
 
@@ -631,6 +656,7 @@ export function streamReducer(
     case EventType.TOOL_CALL_CHUNK:
     case EventType.THINKING_START:
     case EventType.THINKING_END:
+    case EventType.REASONING_ENCRYPTED_VALUE:
     case EventType.STATE_SNAPSHOT:
     case EventType.STATE_DELTA:
     case EventType.MESSAGES_SNAPSHOT:
@@ -1624,7 +1650,7 @@ function findOrCreateMessageForReasoning(threadState: ThreadState): {
  */
 function handleThinkingTextMessageStart(
   threadState: ThreadState,
-  event: ThinkingTextMessageStartEvent,
+  event: ThinkingTextMessageStartEvent | ReasoningMessageStartEvent,
 ): ThreadState {
   const {
     messageIndex,
@@ -1666,7 +1692,10 @@ function handleThinkingTextMessageStart(
  */
 function handleThinkingTextMessageContent(
   threadState: ThreadState,
-  event: ThinkingTextMessageContentEvent,
+  event:
+    | ThinkingTextMessageContentEvent
+    | ReasoningMessageContentEvent
+    | ReasoningMessageChunkEvent,
 ): ThreadState {
   const {
     messageIndex,
@@ -1677,12 +1706,13 @@ function handleThinkingTextMessageContent(
 
   const message = messages[messageIndex];
   const existingReasoning = message.reasoning ?? [];
+  const delta = event.delta ?? "";
 
   if (existingReasoning.length === 0) {
     // No reasoning chunk started - start one implicitly
     const updatedMessage: TamboThreadMessage = {
       ...message,
-      reasoning: [event.delta],
+      reasoning: [delta],
     };
 
     return {
@@ -1703,7 +1733,7 @@ function handleThinkingTextMessageContent(
   // Append to the last reasoning chunk
   const updatedReasoning = [
     ...existingReasoning.slice(0, -1),
-    existingReasoning[existingReasoning.length - 1] + event.delta,
+    existingReasoning[existingReasoning.length - 1] + delta,
   ];
 
   const updatedMessage: TamboThreadMessage = {
@@ -1726,7 +1756,7 @@ function handleThinkingTextMessageContent(
  */
 function handleThinkingTextMessageEnd(
   threadState: ThreadState,
-  event: ThinkingTextMessageEndEvent,
+  event: ThinkingTextMessageEndEvent | ReasoningMessageEndEvent,
 ): ThreadState {
   const {
     messageIndex,
```

---

### Incident Patch 11: `b73ed83d` (2026-07-08)
**Commit Message**: fix(deps): bump dompurify to ^3.4.11 (#2972)

**File**: `apps/web/package.json` (modified, +1/-1)
```diff
@@ -66,7 +66,7 @@
     "clsx": "^2.1.1",
     "cmdk": "^1.1.1",
     "date-fns": "^4.1.0",
-    "dompurify": "^3.4.9",
+    "dompurify": "^3.4.11",
     "drizzle-orm": "^0.45.2",
     "embla-carousel-react": "^8.6.0",
     "framer-motion": "^12.29.0",
```

**File**: `docs/package.json` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@
     "@tambo-ai/typescript-sdk": "^0.96.1",
     "@tambo-ai/ui-registry": "*",
     "class-variance-authority": "^0.7.1",
-    "dompurify": "^3.4.9",
+    "dompurify": "^3.4.11",
     "framer-motion": "^12.29.0",
     "fumadocs-core": "15.8.5",
     "fumadocs-mdx": "^13.0.8",
```

**File**: `package-lock.json` (modified, +6/-6)
```diff
@@ -471,7 +471,7 @@
         "clsx": "^2.1.1",
         "cmdk": "^1.1.1",
         "date-fns": "^4.1.0",
-        "dompurify": "^3.4.9",
+        "dompurify": "^3.4.11",
         "drizzle-orm": "^0.45.2",
         "embla-carousel-react": "^8.6.0",
         "framer-motion": "^12.29.0",
@@ -1040,7 +1040,7 @@
         "@tambo-ai/typescript-sdk": "^0.96.1",
         "@tambo-ai/ui-registry": "*",
         "class-variance-authority": "^0.7.1",
-        "dompurify": "^3.4.9",
+        "dompurify": "^3.4.11",
         "framer-motion": "^12.29.0",
         "fumadocs-core": "15.8.5",
         "fumadocs-mdx": "^13.0.8",
@@ -22740,9 +22740,9 @@
       }
     },
     "node_modules/dompurify": {
-      "version": "3.4.9",
-      "resolved": "https://registry.npmjs.org/dompurify/-/dompurify-3.4.9.tgz",
-      "integrity": "sha512-4dPSRMRDqHvs0V4YDFCsaIZo4if5u0xM+llyxiM2fwuZFdKArUBAF3VtI2+n8NKg9P870WMdYk0UhqQNoWXbfQ==",
+      "version": "3.4.11",
+      "resolved": "https://registry.npmjs.org/dompurify/-/dompurify-3.4.11.tgz",
+      "integrity": "sha512-zhlUV12GsaRzMsf9q5M254YhA4+VuF0fG+QFqu6aYpoGlKtz+w8//jBcGVYBgQkR5GHjUomejY84AV+/uPbWdw==",
       "license": "(MPL-2.0 OR Apache-2.0)",
       "optionalDependencies": {
         "@types/trusted-types": "^2.0.7"
@@ -40526,7 +40526,7 @@
         "@vercel/og": "^1.0.0",
         "autoprefixer": "^10.4.27",
         "class-variance-authority": "^0.7.1",
-        "dompurify": "^3.4.9",
+        "dompurify": "^3.4.11",
         "framer-motion": "^12.29.0",
         "geist": "^1.5.1",
         "highlight.js": "^11.11.1",
```

**File**: `showcase/package.json` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@
     "@vercel/og": "^1.0.0",
     "autoprefixer": "^10.4.27",
     "class-variance-authority": "^0.7.1",
-    "dompurify": "^3.4.9",
+    "dompurify": "^3.4.11",
     "framer-motion": "^12.29.0",
     "geist": "^1.5.1",
     "highlight.js": "^11.11.1",
```

---

### Incident Patch 12: `69684408` (2026-07-08)
**Commit Message**: fix(api): remove unused @opentelemetry/exporter-otlp-http (#2973)

**File**: `apps/api/package.json` (modified, +0/-1)
```diff
@@ -38,7 +38,6 @@
     "@nestjs/swagger": "^11.4.4",
     "@opentelemetry/api": "^1.9.1",
     "@opentelemetry/auto-instrumentations-node": "^0.77.0",
-    "@opentelemetry/exporter-otlp-http": "^0.26.0",
     "@opentelemetry/instrumentation-express": "^0.66.0",
     "@opentelemetry/instrumentation-http": "^0.219.0",
     "@opentelemetry/instrumentation-nestjs-core": "^0.64.0",
```

**File**: `package-lock.json` (modified, +0/-130)
```diff
@@ -52,7 +52,6 @@
         "@nestjs/swagger": "^11.4.4",
         "@opentelemetry/api": "^1.9.1",
         "@opentelemetry/auto-instrumentations-node": "^0.77.0",
-        "@opentelemetry/exporter-otlp-http": "^0.26.0",
         "@opentelemetry/instrumentation-express": "^0.66.0",
         "@opentelemetry/instrumentation-http": "^0.219.0",
         "@opentelemetry/instrumentation-nestjs-core": "^0.64.0",
@@ -9773,16 +9772,6 @@
         "node": ">=8.0.0"
       }
     },
-    "node_modules/@opentelemetry/api-metrics": {
-      "version": "0.26.0",
-      "license": "Apache-2.0",
-      "engines": {
-        "node": ">=8.0.0"
-      },
-      "peerDependencies": {
-        "@opentelemetry/api": "^1.0.2"
-      }
-    },
     "node_modules/@opentelemetry/auto-instrumentations-node": {
       "version": "0.77.0",
       "resolved": "https://registry.npmjs.org/@opentelemetry/auto-instrumentations-node/-/auto-instrumentations-node-0.77.0.tgz",
@@ -10045,74 +10034,6 @@
         "@opentelemetry/api": "^1.3.0"
       }
     },
-    "node_modules/@opentelemetry/exporter-otlp-http": {
-      "version": "0.26.0",
-      "license": "Apache-2.0",
-      "dependencies": {
-        "@opentelemetry/api-metrics": "0.26.0",
-        "@opentelemetry/core": "1.0.0",
-        "@opentelemetry/resources": "1.0.0",
-        "@opentelemetry/sdk-metrics-base": "0.26.0",
-        "@opentelemetry/sdk-trace-base": "1.0.0"
-      },
-      "engines": {
-        "node": ">=8.0.0"
-      },
-      "peerDependencies": {
-        "@opentelemetry/api": "^1.0.2"
-      }
-    },
-    "node_modules/@opentelemetry/exporter-otlp-http/node_modules/@opentelemetry/core": {
-      "version": "1.0.0",
-      "license": "Apache-2.0",
-      "dependencies": {
-        "@opentelemetry/semantic-conventions": "1.0.0",
-        "semver": "^7.3.5"
-      },
-      "engines": {
-        "node": ">=8.5.0"
-      },
-      "peerDependencies": {
-        "@opentelemetry/api": "^1.0.2"
-      }
-    },
-    "node_modules/@opentelemetry/exporter-otlp-http/node_modules/@opentelemetry/resources": {
-      "version": "1.0.0",
-      "license": "Apache-2.0",
-      "dependencies": {
-        "@opentelemetry/core": "1.0.0",
-        "@opentelemetry/semantic-conventions": "1.0.0"
-      },
-      "engines": {
-        "node": ">=8.0.0"
-      },
-      "peerDependencies": {
-        "@opentelemetry/api": "^1.0.2"
-      }
-    },
-    "node_modules/@opentelemetry/exporter-otlp-http/node_modules/@opentelemetry/sdk-trace-base": {
-      "version": "1.0.0",
-      "license": "Apache-2.0",
-      "dependencies": {
-        "@opentelemetry/core": "1.0.0",
-        "@opentelemetry/resources": "1.0.0",
-        "@opentelemetry/semantic-conventions": "1.0.0",
-        "lodash.merge": "^4.6.2"
-      },
-      "engines": {
-        "node": ">=8.0.0"
-      },
-      "peerDependencies": {
-        "@opentelemetry/api": "^1.0.2"
-      }
-    },
-    "node_modules/@opentelemetry/exporter-otlp-http/node_modules/@opentelemetry/semantic-conventions": {
-      "version": "1.0.0",
-      "license": "Apache-2.0",
-      "engines": {
-        "node": ">=8.0.0"
-      }
-    },
     "node_modules/@opentelemetry/exporter-prometheus": {
       "version": "0.219.0",
       "resolved": "https://registry.npmjs.org/@opentelemetry/exporter-prometheus/-/exporter-prometheus-0.219.0.tgz",
@@ -11874,57 +11795,6 @@
         "@opentelemetry/api": ">=1.9.0 <1.10.0"
       }
     },
-    "node_modules/@opentelemetry/sdk-metrics-base": {
-      "version": "0.26.0",
-      "license": "Apache-2.0",
-      "dependencies": {
-        "@opentelemetry/api-metrics": "0.26.0",
-        "@opentelemetry/core": "1.0.0",
-        "@opentelemetry/resources": "1.0.0",
-        "lodash.merge": "^4.6.2"
-      },
-      "engines": {
-        "node": ">=8.0.0"
-      },
-      "peerDependencies": {
-        "@opentelemetry/api": "^1.0.2"
-      }
-    },
-    "node_modules/@opentelemetry/sdk-metrics-base/node_modules/@opentelemetry/core": {
-      "version": "1.0.0",
-      "license": "Apache-2.0",
-      "dependencies": {
-        "@opentelemetry/semantic-conventions": "1.0.0",
-        "semver": "^7.3.5"
-      },
-      "engines": {
-        "node": ">=8.5.0"
-      },
-      "peerDependencies": {
-        "@opentelemetry/api": "^1.0.2"
-      }
-    },
-    "node_modules/@opentelemetry/sdk-metrics-base/node_modules/@opentelemetry/resources": {
-      "version": "1.0.0",
-      "license": "Apache-2.0",
-      "dependencies": {
-        "@opentelemetry/core": "1.0.0",
-        "@opentelemetry/semantic-conventions": "1.0.0"
-      },
-      "engines": {
-        "node": ">=8.0.0"
-      },
-      "peerDependencies": {
-        "@opentelemetry/api": "^1.0.2"
-      }
-    },
-    "node_modules/@opentelemetry/sdk-metrics-base/node_modules/@opentelemetry/semantic-conventions": {
-      "version": "1.0.0",
-      "license": "Apache-2.0",
-      "engines": {
-        "node": ">=8.0.0"
-      }
-    },
     "node_modules/@ope
```

---

### Incident Patch 13: `66869dc0` (2026-07-08)
**Commit Message**: fix(deps): bump undici to patched versions (#2971)

**File**: `.github/scripts/package-lock.json` (modified, +3/-3)
```diff
@@ -749,9 +749,9 @@
       }
     },
     "node_modules/undici": {
-      "version": "6.24.0",
-      "resolved": "https://registry.npmjs.org/undici/-/undici-6.24.0.tgz",
-      "integrity": "sha512-lVLNosgqo5EkGqh5XUDhGfsMSoO8K0BAN0TyJLvwNRSl4xWGZlCVYsAIpa/OpA3TvmnM01GWcoKmc3ZWo5wKKA==",
+      "version": "6.27.0",
+      "resolved": "https://registry.npmjs.org/undici/-/undici-6.27.0.tgz",
+      "integrity": "sha512-YmfV3YnEDzXRC5lZ2jWtWWHKGUm1zIt8AhesR1tens+HTNv+YZlN/dp6G727LOvMJ8xjP9Be7Y2Sdr96LDm+pg==",
       "license": "MIT",
       "engines": {
         "node": ">=18.17"
```

**File**: `.github/scripts/package.json` (modified, +3/-0)
```diff
@@ -14,6 +14,9 @@
     "@octokit/rest": "^20.0.2",
     "tsx": "^4.20.5"
   },
+  "overrides": {
+    "undici": "^6.27.0"
+  },
   "engines": {
     "node": ">=22.0.0"
   },
```

**File**: `package-lock.json` (modified, +4/-4)
```diff
@@ -38566,9 +38566,9 @@
       "license": "MIT"
     },
     "node_modules/undici": {
-      "version": "8.3.0",
-      "resolved": "https://registry.npmjs.org/undici/-/undici-8.3.0.tgz",
-      "integrity": "sha512-TkUDgb6tl7KOGZ+7e8E3d2FYgUQgF6z5YypqjWmixVQSQERFcVrVg0ySADm2LVLRh5ljAaHTCR5Fmz3Q34rB7Q==",
+      "version": "8.7.0",
+      "resolved": "https://registry.npmjs.org/undici/-/undici-8.7.0.tgz",
+      "integrity": "sha512-N7iQtfyLhIMOFgQubvmLV26svHpO0bqKnAiWotTQCVKCmWrcGbBotPuW1x+xwYZ2VHdSTVUfPQQnlEt1/LouTQ==",
       "license": "MIT",
       "engines": {
         "node": ">=22.19.0"
@@ -40168,7 +40168,7 @@
         "js-yaml": "^4.2.0",
         "openai": "^6.16.0",
         "resend": "^6.12.3",
-        "undici": "^8.3.0"
+        "undici": "^8.5.0"
       },
       "devDependencies": {
         "@tambo-ai/eslint-config": "*",
```

**File**: `packages/core/package.json` (modified, +1/-1)
```diff
@@ -46,6 +46,6 @@
     "js-yaml": "^4.2.0",
     "openai": "^6.16.0",
     "resend": "^6.12.3",
-    "undici": "^8.3.0"
+    "undici": "^8.5.0"
   }
 }
```

---

### Incident Patch 14: `2aee0a3b` (2026-07-06)
**Commit Message**: fix(api): lock message id mapping on first emission in v1 stream (#2975)

Co-authored-by: pullfrog[bot] <226033991+pullfrog[bot]@users.noreply.github.com>

**File**: `apps/api/src/v1/v1-message-id-mapping.test.ts` (added, +96/-0)
```diff
@@ -0,0 +1,96 @@
+import {
+  EventType,
+  type CustomEvent,
+  type RunStartedEvent,
+  type TextMessageEndEvent,
+  type TextMessageStartEvent,
+} from "@ag-ui/core";
+import { transformEventMessageIds } from "./v1.service";
+
+describe("transformEventMessageIds", () => {
+  const start = (messageId: string): TextMessageStartEvent => ({
+    type: EventType.TEXT_MESSAGE_START,
+    role: "assistant",
+    messageId,
+  });
+  const end = (messageId: string): TextMessageEndEvent => ({
+    type: EventType.TEXT_MESSAGE_END,
+    messageId,
+  });
+
+  it("maps a temp ID to the real DB ID when it is available", () => {
+    const mapping = new Map<string, string>();
+
+    const started = transformEventMessageIds(
+      start("message-temp"),
+      "msg_real",
+      mapping,
+    ) as TextMessageStartEvent;
+    const ended = transformEventMessageIds(
+      end("message-temp"),
+      "msg_real",
+      mapping,
+    ) as TextMessageEndEvent;
+
+    expect(started.messageId).toBe("msg_real");
+    expect(ended.messageId).toBe("msg_real");
+  });
+
+  it("keeps the temp ID stable when START precedes persistence, even if END carries the real ID", () => {
+    const mapping = new Map<string, string>();
+
+    // START is emitted before the message is persisted (no real ID yet).
+    const started = transformEventMessageIds(
+      start("message-temp"),
+      undefined,
+      mapping,
+    ) as TextMessageStartEvent;
+    // END arrives after persistence, but the temp ID is already locked in.
+    const ended = transformEventMessageIds(
+      end("message-temp"),
+      "msg_real",
+      mapping,
+    ) as TextMessageEndEvent;
+
+    expect(started.messageId).toBe("message-temp");
+    expect(ended.messageId).toBe("message-temp");
+  });
+
+  it("locks tambo.component.start message IDs the same way", () => {
+    const mapping = new Map<string, string>();
+    const componentStart = (messageId: string): CustomEvent => ({
+      type: EventType.CUSTOM,
+      name: "tambo.component.start",
+      value: { messageId },
+    });
+
+    const first = transformEventMessageIds(
+      componentStart("message-temp"),
+      undefined,
+      mapping,
+    ) as CustomEvent;
+    const second = transformEventMessageIds(
+      end("message-temp"),
+      "msg_real",
+      mapping,
+    ) as TextMessageEndEvent;
+
+    expect((first.value as { messageId: string }).messageId).toBe(
+      "message-temp",
+    );
+    expect(second.messageId).toBe("message-temp");
+  });
+
+  it("leaves events without a message ID untouched", () => {
+    const mapping = new Map<string, string>();
+    const runStarted: RunStartedEvent = {
+      type: EventType.RUN_STARTED,
+      threadId: "thr_1",
+      runId: "run_1",
+    };
+
+    expect(transformEventMessageIds(runStarted, "msg_real", mapping)).toBe(
+      runStarted,
+    );
+  });
+});
```

**File**: `apps/api/src/v1/v1.service.ts` (modified, +18/-20)
```diff
@@ -1524,30 +1524,35 @@ export class V1Service {
  * so the client SDK can correctly reference messages for operations like
  * component state updates.
  *
+ * The mapping is locked on the first event for a given temp ID: if the real
+ * DB ID is not yet available (the message hasn't been persisted when the START
+ * event is emitted), the temp ID maps to itself so every subsequent event for
+ * that message keeps emitting the same ID. Without this, a START emitted with a
+ * temp ID and an END later transformed to the real ID would mismatch and crash
+ * the client's event accumulator.
+ *
  * @param event - The AG-UI event to transform
  * @param realMessageId - The real DB message ID from advanceThread
  * @param mapping - Map tracking temp→real ID associations
  * @returns The event with real message IDs
  */
-function transformEventMessageIds(
+export function transformEventMessageIds(
   event: BaseEvent,
   realMessageId: string | undefined,
   mapping: Map<string, string>,
 ): BaseEvent {
-  if (!realMessageId) {
-    return event;
-  }
-
-  // Handle TEXT_MESSAGE_* events (messageId at top level)
-  if ("messageId" in event && typeof event.messageId === "string") {
-    const tempId = event.messageId;
-
-    // Record mapping on first encounter
+  // Lock the ID on first encounter. If the real DB ID is known, map to it;
+  // otherwise map the temp ID to itself so the whole message stays consistent.
+  const resolveMessageId = (tempId: string): string => {
     if (!mapping.has(tempId)) {
-      mapping.set(tempId, realMessageId);
+      mapping.set(tempId, realMessageId ?? tempId);
     }
+    return mapping.get(tempId)!;
+  };
 
-    return { ...event, messageId: mapping.get(tempId) ?? tempId };
+  // Handle TEXT_MESSAGE_* events (messageId at top level)
+  if ("messageId" in event && typeof event.messageId === "string") {
+    return { ...event, messageId: resolveMessageId(event.messageId) };
   }
 
   // Handle tambo.component.start custom event (messageId in value)
@@ -1561,18 +1566,11 @@ function transformEventMessageIds(
       customEvent.name === "tambo.component.start" &&
       customEvent.value?.messageId
     ) {
-      const tempId = customEvent.value.messageId;
-
-      // Record mapping on first encounter
-      if (!mapping.has(tempId)) {
-        mapping.set(tempId, realMessageId);
-      }
-
       return {
         ...event,
         value: {
           ...customEvent.value,
-          messageId: mapping.get(tempId) ?? tempId,
+          messageId: resolveMessageId(customEvent.value.messageId),
         },
       };
     }
```

---

### Incident Patch 15: `6e3ea9e4` (2026-06-16)
**Commit Message**: chore(main): release @tambo-ai/react-ui-base 0.1.12 (#2954)

Co-authored-by: tambo-bot <[REDACTED_EMAIL]>

**File**: `.config/release-please/.release-please-manifest.json` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
   "create-tambo-app": "0.3.4",
   "docs": "1.34.0",
   "packages/client": "1.2.0",
-  "packages/react-ui-base": "0.1.11",
+  "packages/react-ui-base": "0.1.12",
   "react-sdk": "1.3.0",
   "showcase": "0.37.7"
 }
```

**File**: `package-lock.json` (modified, +1/-1)
```diff
@@ -40317,7 +40317,7 @@
     },
     "packages/react-ui-base": {
       "name": "@tambo-ai/react-ui-base",
-      "version": "0.1.11",
+      "version": "0.1.12",
       "license": "MIT",
       "dependencies": {
         "@base-ui/react": "^1.2.0"
```

**File**: `packages/react-ui-base/CHANGELOG.md` (modified, +7/-0)
```diff
@@ -1,5 +1,12 @@
 # Changelog
 
+## [0.1.12](https://github.com/tambo-ai/tambo/compare/@tambo-ai/react-ui-base-v0.1.11...@tambo-ai/react-ui-base-v0.1.12) (2026-06-16)
+
+
+### Miscellaneous Chores
+
+* **deps:** bump the npm_and_yarn group across 1 directory with 2 updates ([#2953](https://github.com/tambo-ai/tambo/issues/2953)) ([49a0b35](https://github.com/tambo-ai/tambo/commit/49a0b3508f5f5187cd467ef8c1cfe37f54e3ca7d))
+
 ## [0.1.11](https://github.com/tambo-ai/tambo/compare/@tambo-ai/react-ui-base-v0.1.10...@tambo-ai/react-ui-base-v0.1.11) (2026-06-15)
 
 
```

**File**: `packages/react-ui-base/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@tambo-ai/react-ui-base",
-  "version": "0.1.11",
+  "version": "0.1.12",
   "description": "Headless base components/Primitives for Tambo AI",
   "author": {
     "name": "Tambo",
```

#### Recent Merged Pull Requests:
- **PR #3026** (closed): feat(llm): add Atlas Cloud provider (@binyangzhu000-sudo)
- **PR #3014** (closed): chore(deps): update dependency hono to v4.13.7 - autoclosed (@renovate[bot])
- **PR #3004** (2026-08-05): chore(deps): update dependency @ai-sdk/provider to v3.0.14 (@renovate[bot])
- **PR #3003** (2026-08-05): fix(deps): replace dependency framer-motion with motion ^12.29.0 (@renovate[bot])
- **PR #3002** (2026-08-04): fix(security): remediate open alerts (@lachieh)
- **PR #3001** (2026-08-04): chore(deps): update dependency undici to v8 [security] (@renovate[bot])
- **PR #3000** (closed): feat(api): add per-project rate limiting with tiered limits (@soumojit-D48)
- **PR #2998** (2026-08-05): fix(deps): update dependency js-yaml to v5 [security] (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
