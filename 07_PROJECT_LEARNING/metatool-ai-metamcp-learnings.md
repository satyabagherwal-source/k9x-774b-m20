# Forensic Learning Record (Deep Inspection): metatool-ai/metamcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/metatool-ai-metamcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/metatool-ai/metamcp](https://github.com/metatool-ai/metamcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:08:35.492Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `metatool-ai/metamcp`
- **Description**: MCP Aggregator, Orchestrator, Middleware, Gateway in one docker
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 2692 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/backend/src/lib/metamcp/utils.ts`
```
import { DatabaseMcpServer, ServerParameters } from "@repo/zod-types";

import logger from "@/utils/logger";

import { oauthSessionsRepository } from "../../db/repositories/oauth-sessions.repo";

/**
 * Environment variables to inherit by default, if an environment is not explicitly given.
 */
export const DEFAULT_INHERITED_ENV_VARS =
  process.platform === "win32"
    ? [
        "APPDATA",
        "HOMEDRIVE",
        "HOMEPATH",
        "LOCALAPPDATA",
        "PATH",
        "PROCESSOR_ARCHITECTURE",
        "SYSTEMDRIVE",
        "SYSTEMROOT",
        "TEMP",
        "USERNAME",
        "USERPROFILE",
      ]
    : /* list inspired by the default env inheritance of sudo */
      [
        "HOME",
        "LOGNAME",
        "PATH",
        "SHELL",
        "TERM",
        "USER",
        // SSL/Certificate variables for corporate proxies and custom CA certificates
        "NODE_EXTRA_CA_CERTS",
        "NODE_TLS_REJECT_UNAUTHORIZED",
        "SSL_CERT_FILE",
        "CERT_FILE",
        "REQUESTS_CA_BUNDLE",
        "REQUESTS_CERT_FILE",
        "CURL_CA_BUNDLE",
        "PIP_CERT",
        "UV_CERT",
        "PYTHONHTTPSVERIFY",
        // Proxy variables
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "NO_PROXY",
        "http_proxy",
        "https_proxy",
        "no_proxy",
      ];

/**
 * Returns a default environment object including only environment variables deemed safe to inherit.
 */
export function getDefaultEnvironment(): Record<string, string> {
  const env: Record<string, string> = {};

  for (const key of DEFAULT_INHERITED_ENV_VARS) {
    const value = process.env[key];
    if (value === undefined) {
      continue;
    }

    if (value.startsWith("()")) {
      // Skip functions, which are a security risk.
      continue;
    }

    env[key] = value;
  }

  return env;
}

export function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "");
}

/**
 * Converts a database MCP server record to ServerParameters format
 * @param server Database MCP server record
 * @returns ServerParameters object or null if conversion fails
 */
export async function convertDbServerToParams(
  server: DatabaseMcpServer,
): Promise<ServerParameters | null> {
  try {
    // Fetch OAuth tokens from OAuth sessions table
    const oauthSession = await oauthSessionsRepository.findByMcpServerUuid(
      server.uuid,
    );
    let oauthTokens = null;

    if (oauthSession && oauthSession.tokens) {
      oauthTokens = {
        access_token: oauthSession.tokens.access_token,
        token_type: oauthSession.tokens.token_type,
        expires_in: oauthSession.tokens.expires_in,
        scope: oauthSession.tokens.scope,
        refresh_token: oauthSession.tokens.refresh_token,
      };
    }

    const params: ServerParameters = {
      uuid: server.uuid,
      name: server.name,
      description: server.description || "",
      type: server.type || "STDIO",
      command: server.command,
      args: server.args || [],
      env: server.env || {},
      url: server.url,
      created_at: server.created_at?.toISOString() || new Date().toISOString(),
      status: "active", // Default status for non-namespace servers
      stderr: "inherit" as const,
      oauth_tokens: oauthTokens,
      bearerToken: server.bearerToken,
      headers: server.headers || {},
      forward_headers: server.forward_headers || {},
    };

    // Process based on server type
    if (params.type === "STDIO") {
      if ("args" in params && !params.args) {
        params.args = undefined;
      }

      params.env = {
        ...getDefaultEnvironment(),
        ...(params.env || {}),
      };
    } else if (params.type === "SSE" || params.type === "STREAMABLE_HTTP") {
      // For SSE or STREAMABLE_HTTP servers, ensure url is present
      if (!params.url) {
        logger.warn(
          `${params.type} server ${params.uuid} is missing url field, skipping`,
        );
        return null;
      }
    }

    return params;
  } catch (error) {
    logger.error(
      `Error converting server ${server.uuid} to parameters:`,
      error,
    );
    return null;
  }
}

/**
 * Resolves environment variable placeholders in an environment object.
 * Replaces values like "${VAR_NAME}" with the actual environment variable value.
 * @param envObject Environment object that may contain placeholder values
 * @returns Environment object with resolved values
 */
// Env values flow from process.env (string | undefined) through the loosely-typed
// stdio spawn chain (createStdioKey/isStdioInCooldown/ProcessManagedStdioTransport),
// so this stays intentionally permissive; tightening it cascades through that chain.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EnvRecord = Record<string, any>;

export function resolveEnvVariables(envObject: EnvRecord): EnvRecord {
  const resolved: EnvRecord = {};

  for (const [key, value] of Object.entries(envObject)) {
    if (
      typeof value === "string" &&
      value.startsWith("${") &&
      value.endsWith("}")
    ) {
      const varName = value.slice(2, -1);
      const envValue = process.env[varName];
      if (envValue) {
        resolved[key] = envValue;
        logger.info(
          `Resolved environment variable: ${key}=${value} -> ${varName}=[REDACTED]`,
        );
      } else {
        resolved[key] = value; // Keep original value if env var not found
        logger.warn(
          `Environment variable not found: ${varName}, keeping original value: ${value}`,
        );
      }
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}

```

### Core Architecture Module: `apps/backend/src/routers/oauth/utils.ts`
```
import { createHash, randomBytes } from "crypto";
import express from "express";

import logger from "@/utils/logger";

// OAuth 2.0 Authorization Parameters interface
export interface OAuthParams {
  client_id: string;
  redirect_uri: string;
  scope?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
}

/**
 * Generate cryptographically secure authorization code
 * Follows OAuth 2.1 security requirements
 */
export function generateSecureAuthCode(): string {
  const randomPart = randomBytes(32).toString("base64url");
  return `mcp_code_${randomPart}`;
}

/**
 * Generate cryptographically secure access token
 * Follows OAuth 2.1 security requirements
 */
export function generateSecureAccessToken(): string {
  const randomPart = randomBytes(32).toString("base64url");
  return `mcp_token_${randomPart}`;
}

/**
 * Generate cryptographically secure refresh token
 * Follows OAuth 2.1 security requirements
 */
export function generateSecureRefreshToken(): string {
  const randomPart = randomBytes(32).toString("base64url");
  return `mcp_refresh_${randomPart}`;
}

/**
 * Generate cryptographically secure client ID
 * Follows OAuth 2.1 security requirements
 */
export function generateSecureClientId(): string {
  const randomPart = randomBytes(16).toString("base64url");
  return `mcp_client_${randomPart}`;
}

/**
 * Generate cryptographically secure client secret
 * Follows OAuth 2.1 security requirements
 */
export function generateSecureClientSecret(): string {
  const randomPart = randomBytes(32).toString("base64url");
  return `mcp_secret_${randomPart}`;
}

/**
 * Validate redirect URI according to OAuth 2.1 security requirements
 * Prevents open redirect vulnerabilities
 */
export function validateRedirectUri(
  uri: string,
  allowedHosts?: string[],
): boolean {
  try {
    const parsedUri = new URL(uri);

    // Only allow secure schemes (no custom: schemes)
    if (!["https:", "http:"].includes(parsedUri.protocol)) {
      return false;
    }

    // For production, only allow HTTPS
    if (
      process.env.NODE_ENV === "production" &&
      parsedUri.protocol !== "https:"
    ) {
      return false;
    }

    // Prevent localhost/private IPs in production
    if (process.env.NODE_ENV === "production") {
      const hostname = parsedUri.hostname.toLowerCase();
      if (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1" ||
        hostname.startsWith("192.168.") ||
        hostname.startsWith("10.") ||
        hostname.startsWith("172.")
      ) {
        return false;
      }
    }

    // Check against allowed hosts if provided
    if (allowedHosts && allowedHosts.length > 0) {
      return allowedHosts.includes(parsedUri.hostname);
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Hash client secret for secure storage
 * Uses SHA-256 with salt
 */
export function hashClientSecret(
  secret: string,
  salt?: string,
): { hash: string; salt: string } {
  const saltToUse = salt || randomBytes(16).toString("hex");
  const hash = createHash("sha256")
    .update(secret + saltToUse)
    .digest("hex");
  return { hash, salt: saltToUse };
}

/**
 * Verify client secret against stored hash
 */
export function verifyClientSecret(
  secret: string,
  storedHash: string,
  salt: string,
): boolean {
  const { hash } = hashClientSecret(secret, salt);
  return hash === storedHash;
}

/**
 * Helper function to get the correct base URL from request
 * Prioritizes APP_URL environment variable, then checks proxy headers
 */
export function getBaseUrl(req: express.Request): string {
  // Prioritize APP_URL environment variable
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }

  // Check for forwarded headers from Next.js proxy
  const forwardedHost = req.headers["x-forwarded-host"] as string;
  const forwardedProto = req.headers["x-forwarded-proto"] as string;

  if (forwardedHost) {
    const protocol = forwardedProto || "http";
    return `${protocol}://${forwardedHost}`;
  }

  // Fallback to request host
  return `${req.protocol}://${req.get("host")}`;
}

/**
 * Middleware to add JSON parsing for OAuth POST endpoints
 */
export function jsonParsingMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  // Only apply JSON parsing for OAuth POST endpoints that need parsed body
  const needsJsonParsing =
    (req.path.startsWith("/oauth/") && req.method === "POST") ||
    (req.path === "/oauth/register" && req.method === "POST");

  if (needsJsonParsing) {
    return express.json({
      limit: "10mb",
      type: "application/json",
    })(req, res, next);
  }
  next();
}

/**
 * Middleware to add URL-encoded form parsing for OAuth POST endpoints
 */
export function urlencodedParsingMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  // Only apply URL-encoded parsing for OAuth POST endpoints
  const needsUrlencodedParsing =
    (req.path.startsWith("/oauth/") && req.method === "POST") ||
    (req.path === "/oauth/register" && req.method === "POST");

  if (needsUrlencodedParsing) {
    return express.urlencoded({
      extended: true,
      limit: "10mb",
    })(req, res, next);
  }
  next();
}

/**
 * Simple in-memory rate limiter for OAuth endpoints
 * In production, use Redis or similar for distributed rate limiting
 */
class RateLimiter {
  private attempts: Map<string, { count: number; resetTime: number }> =
    new Map();
  private maxAttempts: number;
  private windowMs: number;

  constructor(maxAttempts: number = 10, windowMs: number = 15 * 60 * 1000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  isRateLimited(identifier: string): boolean {
    const now = Date.now();
    const record = this.attempts.get(identifier);

    if (!record || now > record.resetTime) {
      // Reset or create new record
      this.attempts.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return false;
    }

    if (record.count >= this.maxAttempts) {
      return true;
    }

    record.count++;
    return false;
  }

  reset(identifier: string): void {
    this.attempts.delete(identifier);
  }

  // Clean up old entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.attempts) {
      if (now > record.resetTime) {
        this.attempts.delete(key);
      }
    }
  }
}

// Create rate limiter instances
const authEndpointLimiter = new RateLimiter(20, 1 * 60 * 1000); // 20 attempts per 1 minute
const tokenEndpointLimiter = new RateLimiter(20, 1 * 60 * 1000); // 10 attempts per 1 minute

// Clean up rate limiter entries every 10 minutes
setInterval(
  () => {
    authEndpointLimiter.cleanup();
    tokenEndpointLimiter.cleanup();
  },
  10 * 60 * 1000,
);

/**
 * Rate limiting middleware for OAuth authorization endpoint
 */
export function rateLimitAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const identifier = req.ip || req.socket?.remoteAddress || "unknown";

  if (authEndpointLimiter.isRateLimited(identifier)) {
    logger.info(
      `[RATE LIMIT] Authorization endpoint rate limited for IP: ${identifier} - Too many authorization attempts`,
    );
    return res.status(429).json({
      error: "too_many_requests",
      error_description:
        "Too many authorization attempts. Please try again later.",
    });
  }

  next();
}

/**
 * Rate limiting middleware for OAuth token endpoint
 */
export function rateLimitToken(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const identifier = req.ip || req.socket?.remoteAddress || "unknown";

  if (tokenEndpointLimiter.isRateLimited(identifier)) {
    logger.info(
      `[RATE LIMIT] Token endpoint rate limited for IP: ${identifier} - Too many token requests`,
    );
    return res.status(429).json({
      error: "too_many_requests",
      error_description: "Too many token requests. Please try again later.",
    });
  }

  next();
}

/**
 * Security headers middleware for OAuth endpoints
 * Prevents common web vulnerabilities
 */
export function securityHeaders(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // XSS protection
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Content Security Policy for OAuth pages
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';",
  );

  // Cache control for sensitive endpoints
  if (req.path.includes("/oauth/")) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }

  next();
}

```

### Core Architecture Module: `apps/backend/src/utils/logger.ts`
```
import { createWriteStream, WriteStream } from "fs";
import { format } from "util";
const { LOG_LEVEL } = process.env;

const validLogLevels = ["all", "info", "errors-only", "none"] as const;
type ValidLogLevel = (typeof validLogLevels)[number];

const getValidLogLevel = (
  level: string | undefined,
): LoggerOptions["shouldConsoleLog"] => {
  if (!level) return "errors-only";
  if (validLogLevels.includes(level as ValidLogLevel)) {
    return level as ValidLogLevel;
  }
  return "errors-only";
};

export interface LoggerOptions {
  logFilePath?: string;
  errorFilePath?: string;
  shouldConsoleLog?: boolean | "all" | "info" | "errors-only" | "none";
}

export class Logger {
  public static readonly defaultLogFilePath = "app.log";
  public static readonly defaultErrorFilePath = "error.log";

  private logFile: WriteStream;
  private errorFile: WriteStream;
  private consoleMode: "all" | "info" | "errors-only" | "none";

  constructor(options: LoggerOptions = {}) {
    const {
      logFilePath = Logger.defaultLogFilePath,
      errorFilePath = Logger.defaultErrorFilePath,
      shouldConsoleLog = "all",
    } = options;

    this.logFile = createWriteStream(logFilePath, { flags: "a" });
    this.errorFile = createWriteStream(errorFilePath, { flags: "a" });

    this.consoleMode =
      typeof shouldConsoleLog === "boolean"
        ? shouldConsoleLog
          ? "all"
          : "none"
        : shouldConsoleLog;
  }

  private formatDate(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, "0");

    return (
      `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} - ` +
      `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    );
  }

  private customLog(
    outputStream: WriteStream,
    level: "DEBUG" | "INFO" | "WARN" | "ERROR",
    ...args: unknown[]
  ) {
    const logMessage = format(...(args as unknown[]));
    const formattedMessage = `[${level}] ${this.formatDate(new Date())} | ${logMessage}\n`;
    outputStream.write(formattedMessage);

    if (this.consoleMode !== "none") {
      const shouldMirror =
        this.consoleMode === "all" ||
        (this.consoleMode === "info" && level === "INFO") ||
        (this.consoleMode === "errors-only" &&
          (level === "WARN" || level === "ERROR"));

      if (shouldMirror) {
        const trimmed = formattedMessage.trim();
        if (level === "INFO") {
          console.info(trimmed);
        } else if (level === "ERROR") {
          console.error(trimmed);
        } else if (level === "WARN") {
          console.warn(trimmed);
        } else {
          console.log(trimmed);
        }
      }
    }
  }

  public debug = (...args: unknown[]) =>
    this.customLog(this.logFile, "DEBUG", ...args);
  public info = (...args: unknown[]) =>
    this.customLog(this.logFile, "INFO", ...args);
  public warn = (...args: unknown[]) =>
    this.customLog(this.logFile, "WARN", ...args);
  public error = (...args: unknown[]) =>
    this.customLog(this.errorFile, "ERROR", ...args);

  public close(): void {
    this.logFile.end();
    this.errorFile.end();
  }
}

const logger = new Logger({
  shouldConsoleLog: getValidLogLevel(LOG_LEVEL),
});

export default logger;

```

### Core Architecture Module: `apps/frontend/hooks/use-mobile.ts`
```
import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

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

### Core Architecture Module: `apps/frontend/hooks/useConnection.ts`
```
import { auth } from "@modelcontextprotocol/sdk/client/auth.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  SSEClientTransport,
  SSEClientTransportOptions,
  SseError,
} from "@modelcontextprotocol/sdk/client/sse.js";
import {
  StreamableHTTPClientTransport,
  StreamableHTTPClientTransportOptions,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { RequestOptions } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  CancelledNotificationSchema,
  ClientNotification,
  ClientRequest,
  CompleteResultSchema,
  CreateMessageRequestSchema,
  ErrorCode,
  ListRootsRequestSchema,
  LoggingMessageNotificationSchema,
  McpError,
  Progress,
  PromptListChangedNotificationSchema,
  PromptReference,
  Request,
  ResourceListChangedNotificationSchema,
  ResourceReference,
  ResourceUpdatedNotificationSchema,
  Result,
  ServerCapabilities,
  ToolListChangedNotificationSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { McpServerType, McpServerTypeEnum } from "@repo/zod-types";
import { useMemoizedFn } from "ahooks";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type * as z3 from "zod/v3";
import type * as z4 from "zod/v4/core";

import { SESSION_KEYS } from "@/lib/constants";

import { ConnectionStatus } from "../lib/constants";
import { getAppUrl } from "../lib/env";
import {
  Notification,
  StdErrNotificationSchema,
} from "../lib/notificationTypes";
import { createAuthProvider } from "../lib/oauth-provider";
import { trpc } from "../lib/trpc";

// Mirror the MCP SDK's zod 3/4 compatibility types. SDK 1.26 result schemas use
// the zod 4 API (surfaced via zod 3.25's zod/v4 export), so request helpers must
// accept both zod-3-classic and zod-4 schemas exactly like Client.request does.
export type AnySchema = z3.ZodTypeAny | z4.$ZodType;
export type SchemaOutput<S> = S extends z3.ZodTypeAny
  ? z3.infer<S>
  : S extends z4.$ZodType
    ? z4.output<S>
    : never;
export type MakeRequestFn = <T extends AnySchema>(
  request: ClientRequest,
  schema: T,
  options?: RequestOptions & { suppressToast?: boolean },
) => Promise<SchemaOutput<T>>;

interface UseConnectionOptions {
  mcpServerUuid: string;
  transportType: McpServerType;
  command: string;
  args: string;
  url: string;
  env: Record<string, string>;
  bearerToken?: string;
  headerName?: string;
  onNotification?: (notification: Notification) => void;
  onStdErrNotification?: (notification: Notification) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onPendingRequest?: (request: any, resolve: any, reject: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getRoots?: () => any[];
  isMetaMCP?: boolean;
  includeInactiveServers?: boolean;
  enabled?: boolean; // Skip hook execution when false
}

export function useConnection({
  mcpServerUuid,
  transportType,
  command,
  args,
  url,
  env,
  bearerToken,
  headerName,
  onNotification,
  onStdErrNotification,
  onPendingRequest,
  getRoots,
  isMetaMCP = false,
  includeInactiveServers = false,
  enabled = true,
}: UseConnectionOptions) {
  const authProvider = createAuthProvider(mcpServerUuid, url);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const [serverCapabilities, setServerCapabilities] =
    useState<ServerCapabilities | null>(null);
  const [mcpClient, setMcpClient] = useState<Client | null>(null);
  const [clientTransport, setClientTransport] = useState<Transport | null>(
    null,
  );
  const [requestHistory, setRequestHistory] = useState<
    { request: string; response?: string }[]
  >([]);
  const [completionsSupported, setCompletionsSupported] = useState(true);

  // Fetch timeout configurations from the database
  const { data: mcpTimeout } = trpc.frontend.config.getMcpTimeout.useQuery(
    undefined,
    { enabled: enabled },
  );
  const { data: mcpMaxTotalTimeout } =
    trpc.frontend.config.getMcpMaxTotalTimeout.useQuery(undefined, {
      enabled: enabled,
    });
  const { data: mcpResetTimeoutOnProgress } =
    trpc.frontend.config.getMcpResetTimeoutOnProgress.useQuery(undefined, {
      enabled: enabled,
    });

  const pushHistory = useMemoizedFn((request: object, response?: object) => {
    setRequestHistory((prev) => [
      ...prev,
      {
        request: JSON.stringify(request),
        response: response !== undefined ? JSON.stringify(response) : undefined,
      },
    ]);
  });

  const makeRequest = useMemoizedFn(
    async <T extends AnySchema>(
      request: ClientRequest,
      schema: T,
      options?: RequestOptions & { suppressToast?: boolean },
    ): Promise<SchemaOutput<T>> => {
      if (!mcpClient) {
        throw new Error("MCP client not connected");
      }
      try {
        const abortController = new AbortController();

        // Get configurable timeout values from database, similar to backend metamcp-proxy.ts
        const mcpRequestOptions: RequestOptions = {
          signal: options?.signal ?? abortController.signal,
          resetTimeoutOnProgress:
            options?.resetTimeoutOnProgress ??
            mcpResetTimeoutOnProgress ??
            true,
          timeout: options?.timeout ?? mcpTimeout ?? 60000,
          maxTotalTimeout:
            options?.maxTotalTimeout ?? mcpMaxTotalTimeout ?? 60000,
        };

        // If progress notifications are enabled, add an onprogress hook to the MCP Client request options
        // This is required by SDK to reset the timeout on progress notifications
        if (mcpRequestOptions.resetTimeoutOnProgress) {
          mcpRequestOptions.onprogress = (params: Progress) => {
            // Add progress notification to `Server Notification` window in the UI
            if (onNotification) {
              onNotification({
                method: "notification/progress",
                params,
              });
            }
          };
        }

        let response;
        try {
          response = await mcpClient.request(
            request,
            schema,
            mcpRequestOptions,
          );

          pushHistory(request, response);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          pushHistory(request, { error: errorMessage });
          throw error;
        }

        return response;
      } catch (e: unknown) {
        if (!options?.suppressToast) {
          const errorString = (e as Error).message ?? String(e);
          toast.error(errorString);
        }
        throw e;
      }
    },
  );

  const handleCompletion = useMemoizedFn(
    async (
      ref: ResourceReference | PromptReference,
      argName: string,
      value: string,
      signal?: AbortSignal,
    ): Promise<string[]> => {
      if (!mcpClient || !completionsSupported) {
        return [];
      }

      const request: ClientRequest = {
        method: "completion/complete",
        params: {
          argument: {
            name: argName,
            value,
          },
          ref,
        },
      };

      try {
        const response = await makeRequest(request, CompleteResultSchema, {
          signal,
          suppressToast: true,
        });
        return response?.completion.values || [];
      } catch (e: unknown) {
        // Disable completions silently if the server doesn't support them.
        // See https://github.com/modelcontextprotocol/specification/discussions/122
        if (e instanceof McpError && e.code === ErrorCode.MethodNotFound) {
          setCompletionsSupported(false);
          return [];
        }

        // Unexpected errors - show toast and rethrow
        toast.error(e instanceof Error ? e.message : String(e));
        throw e;
      }
    },
  );

  const sendNotification = useMemoizedFn(
    async (notification: ClientNotification) => {
      if (!mcpClient) {
        const error = new Error("MCP client not connected");
        toast.error(error.message);
        throw error;
      }

      try {
        await mcpClient.notification(notification);
        // Log successful notifications
        pushHistory(notification);
      } catch (e: unknown) {
        if (e instanceof McpError) {
          // Log MCP protocol errors
          pushHistory(notification, { error: e.message });
        }
        toast.error(e instanceof Error ? e.message : String(e));
        throw e;
      }
    },
  );

  const checkProxyHealth = useMemoizedFn(async () => {
    try {
      const proxyHealthUrl = new URL(`/mcp-proxy/server/health`, getAppUrl());

      // Cookies will be sent automatically by the browser
      const proxyHealthResponse = await fetch(proxyHealthUrl, {
        credentials: "include", // Ensure cookies are sent
      });
      const proxyHealth = await proxyHealthResponse.json();
      if (proxyHealth?.status !== "ok") {
        throw new Error("MCP Proxy Server is not healthy");
      }
    } catch (e) {
      console.error("Couldn't connect to MCP Proxy Server", e);
      throw e;
    }
  });

  const is401Error = useMemoizedFn((error: unknown): boolean => {
    return Boolean(
      (error instanceof SseError && error.code === 401) ||
      (error instanceof Error && error.message.includes("401")) ||
      (error instanceof Error && error.message.includes("Unauthorized")) ||
      // Handle fetch errors that might come from streamable HTTP
      (error instanceof TypeError && error.message.includes("401")) ||
      // Handle response errors
      (error &&
        typeof error === "object" &&
        "status" in error &&
        (error as { status: number }).status === 401),
    );
  });

  const isProxyAuthError = useMemoizedFn((error: unknown): boolean => {
    return (
      error instanceof Error &&
      error.message.includes("Authentication required. Use the session t
```

### Core Architecture Module: `apps/frontend/hooks/useLocale.ts`
```
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { SUPPORTED_LOCALES, SupportedLocale } from "@/lib/i18n";

export function useLocale() {
  const pathname = usePathname();
  const [locale, setLocale] = useState<SupportedLocale>("en");

  useEffect(() => {
    const segments = pathname.split("/").filter(Boolean);
    const firstSegment = segments[0];

    if (SUPPORTED_LOCALES.includes(firstSegment as SupportedLocale)) {
      setLocale(firstSegment as SupportedLocale);
    } else {
      setLocale("en");
    }
  }, [pathname]);

  return locale;
}

```

### Core Architecture Module: `apps/frontend/hooks/useTranslations.ts`
```
import { useEffect, useState } from "react";

import { getTranslation, loadTranslations, Translations } from "@/lib/i18n";

import { useLocale } from "./useLocale";

export function useTranslations() {
  const locale = useLocale();
  const [translations, setTranslations] = useState<Translations | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    loadTranslations(locale)
      .then(setTranslations)
      .finally(() => setIsLoading(false));
  }, [locale]);

  const t = (key: string, params?: Record<string, string | number>) => {
    if (!translations) return key;
    return getTranslation(translations, key, params);
  };

  return { t, isLoading, locale };
}

```

### Core Architecture Module: `apps/frontend/lib/utils.ts`
```
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

```

### Core Architecture Module: `apps/frontend/lib/validation-utils.ts`
```
import { ZodError } from "zod";

// zod v4 no longer exports `ZodIssue`; derive the issue type from ZodError.
type ZodIssue = ZodError["issues"][number];

// Type for translation function
type TranslationFunction = (
  key: string,
  params?: Record<string, string | number>,
) => string;

// Map of Zod issue codes to translation keys
const issueCodeToTranslationKey: Record<string, string> = {
  invalid_type: "validation:invalidFormat",
  invalid_format: "validation:invalidFormat",
  too_small: "validation:minLength",
  too_big: "validation:maxLength",
  custom: "validation:generic.invalid",
};

// Map specific validation messages to translation keys
const messageToTranslationKey: Record<string, string> = {
  "Name is required": "validation:nameRequired",
  "Server name is required": "validation:serverName.required",
  "Server name must only contain letters, numbers, underscores, and hyphens":
    "validation:serverName.invalidCharacters",
  "Server name cannot contain consecutive underscores":
    "validation:serverName.consecutiveUnderscores",
  "Command is required for stdio servers": "validation:command.required",
  "URL is required and must be valid for SSE and Streamable HTTP types":
    "validation:url.required",
  "URL is required for SSE and Streamable HTTP types":
    "validation:url.required",
  "URL must be valid for SSE and Streamable HTTP types":
    "validation:url.invalidUrl",
  "Name must be URL compatible": "validation:endpointName.urlCompatible",
  "Password must be at least 8 characters long": "validation:password.tooShort",
  "Passwords do not match": "validation:password.mismatch",
};

/**
 * Translates a single Zod issue to a localized error message
 */
export function translateZodIssue(
  issue: ZodIssue,
  t: TranslationFunction,
): string {
  // First, check if the message is already a translation key
  if (issue.message && issue.message.startsWith("validation:")) {
    return t(issue.message);
  }

  // Then, try to find a direct message translation
  if (issue.message && messageToTranslationKey[issue.message]) {
    const translationKey = messageToTranslationKey[issue.message]!;
    return t(translationKey);
  }

  // Handle specific issue codes with parameters
  switch (issue.code) {
    case "too_small":
      if (issue.origin === "string") {
        return t("validation:minLength", { min: Number(issue.minimum) });
      }
      break;
    case "too_big":
      if (issue.origin === "string") {
        return t("validation:maxLength", { max: Number(issue.maximum) });
      }
      break;
    case "invalid_format":
      if (issue.format === "email") {
        return t("validation:email");
      }
      if (issue.format === "url") {
        return t("validation:urlFormat");
      }
      break;
    case "custom":
      // Handle custom validation messages
      if (issue.message && messageToTranslationKey[issue.message]) {
        return t(messageToTranslationKey[issue.message]!);
      }
      break;
  }

  // Fall back to issue code translation
  const translationKey = issueCodeToTranslationKey[issue.code];
  if (translationKey) {
    return t(translationKey);
  }

  // Ultimate fallback - return the original message or a generic error
  return issue.message || t("validation:generic.invalid");
}

/**
 * Translates all errors in a ZodError to localized messages
 */
export function translateZodError(
  error: ZodError,
  t: TranslationFunction,
): Record<string, string> {
  const translatedErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const fieldPath = issue.path.join(".");
    const translatedMessage = translateZodIssue(issue, t);

    // If there's already an error for this field, append to it
    if (translatedErrors[fieldPath]) {
      translatedErrors[fieldPath] += "; " + translatedMessage;
    } else {
      translatedErrors[fieldPath] = translatedMessage;
    }
  }

  return translatedErrors;
}

/**
 * Utility to get a translated error message for a specific field from a ZodError
 */
export function getTranslatedFieldError(
  error: ZodError | null,
  fieldName: string,
  t: TranslationFunction,
): string | undefined {
  if (!error) return undefined;

  const issue = error.issues.find(
    (issue) => issue.path.join(".") === fieldName,
  );

  if (!issue) return undefined;

  return translateZodIssue(issue, t);
}

```

### Core Architecture Module: `apps/backend/drizzle.config.ts`
```
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { defineConfig } from "drizzle-kit";
export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    // @ts-expect-error outside dir
    url: process.env.DATABASE_URL!,
  },
});

```

### Core Architecture Module: `apps/backend/eslint.config.js`
```
import { expressConfig } from "@repo/eslint-config/express";

export default expressConfig;

```

### Core Architecture Module: `apps/backend/src/auth.ts`
```
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth, GenericOAuthConfig } from "better-auth/plugins";

import { db } from "./db/index";
import * as schema from "./db/schema";
import { configService } from "./lib/config.service";
import logger from "./utils/logger";

// Provide default values for development
if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET environment variable is required");
}
if (!process.env.APP_URL) {
  throw new Error("APP_URL environment variable is required");
}

const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET;
const BETTER_AUTH_URL = process.env.APP_URL;

// Helper function to create basic auth middleware
const createBasicAuthCheckMiddleware = () => {
  return async (request: unknown) => {
    const isBasicAuthDisabled = await configService.isBasicAuthDisabled();
    if (isBasicAuthDisabled) {
      throw new Error(
        "Basic email/password authentication is currently disabled. Please use SSO/OIDC authentication instead.",
      );
    }
    return { request };
  };
};

// OIDC Provider configuration - optional, only if environment variables are provided
const oidcProviders: GenericOAuthConfig[] = [];

// Add OIDC provider if configured
if (process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET) {
  const oidcConfig: GenericOAuthConfig = {
    providerId: process.env.OIDC_PROVIDER_ID || "oidc",
    clientId: process.env.OIDC_CLIENT_ID,
    clientSecret: process.env.OIDC_CLIENT_SECRET,
    scopes: (process.env.OIDC_SCOPES || "openid email profile").split(" "),
    pkce: process.env.OIDC_PKCE !== "false", // Enable PKCE by default for security
    discoveryUrl: process.env.OIDC_DISCOVERY_URL,
    authorizationUrl: process.env.OIDC_AUTHORIZATION_URL, //this is required due to a bug in better-auth: https://github.com/better-auth/better-auth/issues/3278
  };

  oidcProviders.push(oidcConfig);
  logger.info(`✓ OIDC Provider configured: ${oidcConfig.providerId}`);
}

// Default trusted origins for development
const DEFAULT_TRUSTED_ORIGINS = [
  "http://localhost",
  "http://localhost:3000",
  "http://localhost:12008",
  "http://127.0.0.1",
  "http://127.0.0.1:12008",
  "http://127.0.0.1:3000",
  "http://0.0.0.0",
  "http://0.0.0.0:3000",
  "http://0.0.0.0:12008",
];

// Parse extra trusted origins from environment variable (comma-separated)
const extraTrustedOrigins = process.env.EXTRA_TRUSTED_ORIGINS
  ? process.env.EXTRA_TRUSTED_ORIGINS.split(",")
      .map((origin: string) => origin.trim())
      .filter(Boolean)
  : [];

const trustedOrigins = [...DEFAULT_TRUSTED_ORIGINS, ...extraTrustedOrigins];

export const auth = betterAuth({
  secret: BETTER_AUTH_SECRET,
  baseURL: BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.usersTable,
      session: schema.sessionsTable,
      account: schema.accountsTable,
      verification: schema.verificationsTable,
    },
  }),
  trustedOrigins,
  plugins: [
    // Add generic OAuth plugin for OIDC support
    ...(oidcProviders.length > 0
      ? [genericOAuth({ config: oidcProviders })]
      : []),
  ],
  emailAndPassword: {
    enabled: true, // This will be dynamically controlled by middleware
    requireEmailVerification: false, // Set to true if you want email verification
  },
  account: {
    accountLinking: {
      enabled: true,
      // Allow linking accounts with the same email address
      allowDifferentEmails: false,
      // Trusted providers for automatic linking (add your OIDC provider here)
      trustedProviders: oidcProviders.map((p) => p.providerId),
      // Allow automatic linking for same email addresses
      allowSameEmail: true,
      // Require email verification for account linking
      requireEmailVerification: false,
    },
  },
  session: {
    // Session lifetimes are env-var configurable so deployers can tune
    // how often users re-touch the gateway via SSO without rebuilding
    // the image. Defaults match the previous hardcoded values exactly,
    // so this is a strict superset — no behavior change for existing
    // installs that don't set the env vars.
    expiresIn: (() => {
      const raw = process.env.BETTER_AUTH_SESSION_EXPIRES_IN_SECONDS;
      const parsed = raw ? Number.parseInt(raw, 10) : NaN;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 60 * 60 * 24 * 7; // 7 days (default)
    })(),
    updateAge: (() => {
      const raw = process.env.BETTER_AUTH_SESSION_UPDATE_AGE_SECONDS;
      const parsed = raw ? Number.parseInt(raw, 10) : NaN;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 60 * 60 * 24; // 1 day (default — how often the session expiry is bumped on access)
    })(),
  },
  user: {
    additionalFields: {
      emailVerified: {
        type: "boolean",
        defaultValue: false,
      },
    },
  },
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
    },
  },
  logger: {
    level: "debug", // Enable debug logging
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user, context) => {
          // Check if signup is disabled based on the registration method
          const isSignupDisabled = await configService.isSignupDisabled();
          const isSsoSignupDisabled = await configService.isSsoSignupDisabled();

          // Determine if this is an SSO/OAuth registration by checking the request path
          // OAuth/SSO registrations typically come through callback endpoints
          const isSsoRegistration =
            context?.path?.includes("/callback/") ||
            context?.path?.includes("/oauth/") ||
            context?.path?.includes("/oidc/");

          if (isSsoRegistration) {
            if (isSsoSignupDisabled) {
              throw new Error(
                "New user registration via SSO/OAuth is currently disabled.",
              );
            }
          } else {
            if (isSignupDisabled) {
              throw new Error("New user registration is currently disabled.");
            }
          }

          return { data: user };
        },
      },
    },
  },
  // Add middleware to check basic auth setting
  middleware: [
    {
      path: "/sign-in/email",
      middleware: createBasicAuthCheckMiddleware(),
    },
    {
      path: "/sign-up/email",
      middleware: createBasicAuthCheckMiddleware(),
    },
    {
      path: "/forgot-password",
      middleware: createBasicAuthCheckMiddleware(),
    },
    {
      path: "/reset-password",
      middleware: createBasicAuthCheckMiddleware(),
    },
  ],
});

console.log("✓ Better Auth instance created successfully");
console.log(`✓ OIDC Providers configured: ${oidcProviders.length}`);

export type Session = typeof auth.$Infer.Session;
// Note: User type needs to be inferred from Session.user
export type User = typeof auth.$Infer.Session.user;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #366** (2026-09-08): **fix(frontend): clear rate limit fields when disabled**
  *Symptoms*: ## Summary  - clear rate-limit values when endpoint rate limiting is disabled - clear hidden validation errors for both global and per-client limits - apply the fix to create and edit endpoint forms  ## Why  React Hook Form stores empty number inputs as NaN. After rate limiting is turned off, those inputs are hidden but their NaN values remain in form state, so the Zod resolver rejects the form before the tRPC mutation runs.  ## Validation  - Prettier check - frontend TypeScript check - frontend ESLint

- **Issue #358** (2026-08-30): **Optional Tool Outcome Attestation (TOA) verify gate for MCP CI / promote / register**
  *Symptoms*: ### Summary  [Tool Outcome Attestation](https://github.com/Carmel-Labs-Inc/toa) (`toa/0.1`) is an Apache-2.0 signed JSON evidence format for MCP tool delivery (reach, invoke, functional, shape, and related layers). It is not a wire protocol. It is not meant to run on every live `tools/call`.  Typical use: a CI step or promote/register gate verifies a recent attestation with offline `toa-verify` and a pinned emitter public key. Any party can emit if they sign the schema. AgentStatus is one optional emitter. No AgentStatus account is required to verify.  ### Why it might fit this project  MetaMCP aggregates and gates MCP servers. An optional verify of a recent TOA at add/promote time fits the control-plane role without per-call attestation.  ### Proposed contribution (optional, off by default)  1. Docs and/or example: run `toa-verify` after existing checks, or before promote/register. 2. Config: path to attestation JSON, required layers (for example `functional=pass`), pinned public key, max age. 3. No hard dependency on any commercial emit API.  If this direction is welcome, we can open a small PR shaped to your plugin or policy model. If not, closing this is fine.  ### Links  - Spec and verify: https://github.com/Carmel-Labs-Inc/toa - Pre-prod complementarity note: https://github.com/Carmel-Labs-Inc/toa/blob/main/docs/complementarity-preprod.md  ### Out of scope  - Replacing Inspector, OAuth, protocol conformance, or gateway ACL - Signing every production `tools/call` - Requi
  **Post-Mortem & Fix Analysis**:
  > Closing this issue.  It was filed from the wrong GitHub account by mistake. Sorry for the noise. We may open a replacement later from the correct account if the topic is still useful.

- **Issue #356** (2026-08-26): **test(w2): synthetic conflict with #355**
  *Symptoms*: Synthetic W2 gate test: edits metamcp-proxy.ts differently than #355 — should roll back in the fold.

- **Issue #355** (2026-09-13): **fix: consolidated perf-live + adversarial audit fixes (Dockerfile build crash, leaks, DB tools path)**
  *Symptoms*: ## Goals  Trying to make metamcp reliably support **40+ MCP servers in memory** — fixing a build crash, several memory/connection leaks, and the DB-backed tools hot path.  It's currently a **draft / work-in-progress**: we're validating the fold + image end-to-end before requesting review.  ## Highlights  - **Docker build is reproducible and no longer crashes**   - `ENV CI=true` so pnpm stops aborting the modules-dir removal in non-TTY builds.   - `drizzle-kit` installed as an explicit `--prod` dep at runtime — fixes the `ERR_PNPM_INCLUDED_DEPS_CONFLICT` crash-loop.   - Next.js proxy-request timeout raised 30s → 600s via a **find-based sed** (in both builder and runner stages) instead of a hardcoded `node_modules/.pnpm/...` path, so it survives lockfile bumps.  - **Boot no longer crash-loops on cold start**   - The entrypoint now waits for the backend's own `[startup] backend serving on port 12009` marker (install-aware) before starting the bounded `/health` wait — removes the fixed 90s gate that killed slow-but-healthy boots.  - **Connection-pool hardening (leaks + memory)** — the big one for 40+ servers:   - Bounded spawns, LRU eviction, finite session lifetime, per-server connection cap, default idle timeout 30m → 10m.   - Reuse a live cross-session connection on re-list instead of double-spawning.   - Clean up leaked fresh spawns when a recovery retry fails; bound `getSession`/`stdioCommandCooldowns` fan-out.   - Don't treat `-32601` (optional ping unsu

- **Issue #354** (2026-08-26): **fix(docker): make the Next.js proxy-request sed path-agnostic + fail-open**
  *Symptoms*: The proxy-request timeout bump hardcodes the pnpm store path for `next@15.5.12` with `react-dom@19.1.2`, but the lockfile can resolve a different react-dom (19.2.4) after a bump — the sed then targets a nonexistent file and exits 2, aborting the entire image build and failing :latest for every repo folded through the fork. Glob the store dir with `find` and fail-open so the timeout patch survives any dependency bump and a missing file can never brick the build.
  **Post-Mortem & Fix Analysis**:
  > Closing — stale static-path sed approach, superseded by the find-based sed in #355. Skipped by the fold anyway on conflict; consolidating to the single working PR.

- **Issue #353** (2026-08-26): **perf(proxy): consolidated prewarm + never-spawn-unused + recovery + leak cleanup (backend-only)**
  *Symptoms*: Backend-only consolidation (no Dockerfile/workflow/lockfile changes — the fold's mirror-main owns those, so this folds cleanly):  - runtime package prewarm (npm/uvx/bun) + cache self-heal - never spawn MCPs when unused (health-loop rewrite, Fix 1) - recovery cooldown + circuit-breaker bound on session-lost (Fix 2) - CallToolResult normalize before SDK validation (Fix 3, -32602) - clean up leaked fresh spawn when a recovery retry fails (memory leak) - DB tools/list serving + circuit-open surfacing + quiet DEBUG logging  Typecheck clean, 218 tests pass. Folds cleanly vs ai-dev.
  **Post-Mortem & Fix Analysis**:
  > Closing — this is an older lineage superseded by #355 (fix/consolidated-layer0-clean), which contains all of these fixes PLUS the dedup (cross-session reuse) and bounded-cooldown fixes. Folding both PRs caused #353's -X theirs version of mcp-server-pool.ts/server.ts to revert the dedup+cooldown bodies in :latest. Consolidating to the single working PR per Justin.

- **Issue #352** (2026-08-25): **perf(proxy): consolidated prewarm + never-spawn-unused + leak cleanup (Sindri x Layer0)**
  *Symptoms*: Consolidates the two working PR tracks into one foldable branch.  **From deploy/layer0-all (other bot):** - canonical `build.yml` (fork fold trigger) + reproducible Dockerfile (fail-open sed) - connect-timeout bound (`client.connect` under MCP_STDIO_CONNECT_TIMEOUT_MS) - per-namespace isolation + circuit breaker + quiet DEGRADED logging - tools-sync reap of obsolete tools  **From fix/consolidated-layer0-clean (this bot):** - runtime package prewarm (npm/uvx/bun) + cache self-heal (rule 3/13) - never spawn unused MCPs (health-loop rewrite, Fix 1) - recovery cooldown + circuit breaker bound on session-lost (Fix 2) - CallToolResult normalize before SDK validation (Fix 3, pocket-id -32602) - **leak cleanup**: a recovery retry that times out now kills its fresh spawn   (was leaking a process per failure under pid 47 → 8.45GB/8GB pileup)  Infra files take deploy/layer0-all's canonical versions; backend code takes the superset. Typecheck clean, 218 tests pass. Folds cleanly vs ai-dev.
  **Post-Mortem & Fix Analysis**:
  > Superseded by clean backend-only fold branch clean-fold-pr (no workflow/Dockerfile diff to conflict with the overlay). Reopened as fresh PR.

- **Issue #351** (2026-08-25): **perf(proxy): Layer-0 DB tools, prewarm, pool bounds + reproducible Docker build**
  *Symptoms*: Consolidated fork PR folding all upstream PR #349 + intarweb fork PR #1 work into one change set.  ## What this fixes - **Cold-start storm** — bounded spawn concurrency (`MCP_SPAWN_CONCURRENCY`, default 4) stops ~22 simultaneous spawns blowing past the connect timeout (-32001/-32000 cascade). - **Connect timeout** — `connectWithTimeout` races `client.connect()` against `MCP_STDIO_CONNECT_TIMEOUT_MS` (stdio, 120s) / `MCP_CONNECT_TIMEOUT_MS` (HTTP, 90s); releases the transport on timeout so a slow-booting server doesn't hang the fan-out. - **Connection leak / runaway spawns** — per-server cap (`MAX_CONNECTIONS_PER_SERVER`), per-namespace cap (`MAX_CONNECTIONS_PER_NAMESPACE`), LRU eviction + finite session lifetime (`SESSION_LIFETIME`, `MCP_IDLE_TIMEOUT_MS`). - **`tools/list` fan-out stall** — served from DB (`tools` table) via background sync loop (Layer-0), deadline-bounded `getSession` (`MCP_TOOLS_LIST_TIMEOUT_MS`), circuit breaker (`MCP_BREAKER_*`) so a cold backend can't hang the hot path. Obsolete tools reaped each pass. - **Reproducible Docker build** — IPv4 apt + `curl -4`, `CI=true pnpm install --frozen-lockfile`, `pnpm-lock.yaml` into runner, path-agnostic `find`-based proxy-request sed (survives pnpm store drift), Node 24 + Bun base.  ## Runtime knobs (all opt-in / overridable) `MCP_PREWARM_NPM` / `_UVX` / `_BUN`, `MCP_CACHE_HEAL`, `MCP_SPAWN_CONCURRENCY`, `MCP_STDIO_CONNECT_TIMEOUT_MS`, `MCP_CONNECT_TIMEOUT_MS`, `MAX_CONNECTIONS_PER_SERVER`, `MAX_CONNECTIONS_PER_NAME
  **Post-Mortem & Fix Analysis**:
  > Superseded by PR #352 (consolidated branch joining this + deploy/layer0-all). Content folded into #352.

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

### Incident Patch 1: `e29ce8f9` (2026-06-16)
**Commit Message**: bug fixes

**File**: `apps/backend/src/auth.ts` (modified, +2/-6)
```diff
@@ -117,16 +117,12 @@ export const auth = betterAuth({
     expiresIn: (() => {
       const raw = process.env.BETTER_AUTH_SESSION_EXPIRES_IN_SECONDS;
       const parsed = raw ? Number.parseInt(raw, 10) : NaN;
-      return Number.isFinite(parsed) && parsed > 0
-        ? parsed
-        : 60 * 60 * 24 * 7; // 7 days (default)
+      return Number.isFinite(parsed) && parsed > 0 ? parsed : 60 * 60 * 24 * 7; // 7 days (default)
     })(),
     updateAge: (() => {
       const raw = process.env.BETTER_AUTH_SESSION_UPDATE_AGE_SECONDS;
       const parsed = raw ? Number.parseInt(raw, 10) : NaN;
-      return Number.isFinite(parsed) && parsed > 0
-        ? parsed
-        : 60 * 60 * 24; // 1 day (default — how often the session expiry is bumped on access)
+      return Number.isFinite(parsed) && parsed > 0 ? parsed : 60 * 60 * 24; // 1 day (default — how often the session expiry is bumped on access)
     })(),
   },
   user: {
```

**File**: `apps/backend/src/db/repositories/__tests__/oauth.repo.test.ts` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+import { beforeEach, describe, expect, it, vi } from "vitest";
+
+// Capture the WHERE conditions handed to each delete so we can assert the
+// cleanup issues all of its statements. The db connection is faked; the real
+// drizzle condition builders (lt/and/isNull) run against the real table
+// schemas, which is exactly the code path the regression below exercises.
+const whereCalls: unknown[] = [];
+
+vi.mock("../../index", () => {
+  return {
+    db: {
+      delete: () => ({
+        where: (condition: unknown) => {
+          whereCalls.push(condition);
+          return Promise.resolve(undefined);
+        },
+      }),
+    },
+  };
+});
+
+// Import AFTER vi.mock so the repo binds to the fake db.
+const { oauthRepository } = await import("../oauth.repo");
+
+describe("OAuthRepository.cleanupExpired", () => {
+  beforeEach(() => {
+    whereCalls.length = 0;
+  });
+
+  it("builds and runs every cleanup delete without throwing", async () => {
+    // Regression: the "refresh token is null" branch used
+    // `isNotNull(...).not()`, which throws a TypeError at query-build time
+    // because drizzle's SQL has no `.not()`. It must build via `isNull(...)`.
+    await expect(oauthRepository.cleanupExpired()).resolves.toBeUndefined();
+
+    // Three deletes: expired auth codes, fully-expired tokens, null-refresh
+    // tokens. Each must have built a WHERE condition.
+    expect(whereCalls).toHaveLength(3);
+    for (const condition of whereCalls) {
+      expect(condition).toBeDefined();
+    }
+  });
+});
```

**File**: `apps/backend/src/db/repositories/oauth.repo.ts` (modified, +2/-2)
```diff
@@ -6,7 +6,7 @@ import {
   OAuthClient,
   OAuthClientCreateInput,
 } from "@repo/zod-types";
-import { eq, lt, and, isNotNull } from "drizzle-orm";
+import { and, eq, isNull, lt } from "drizzle-orm";
 
 import { db } from "../index";
 import {
@@ -144,7 +144,7 @@ export class OAuthRepository {
         .where(
           and(
             lt(oauthAccessTokensTable.expires_at, now),
-            isNotNull(oauthAccessTokensTable.refresh_token).not(),
+            isNull(oauthAccessTokensTable.refresh_token),
           ),
         ),
     ]);
```

**File**: `apps/backend/src/index.ts` (modified, +3/-3)
```diff
@@ -120,9 +120,8 @@ const gracefulShutdown = async (signal: string) => {
   console.log(`${signal} received, cleaning up MCP server pools...`);
   try {
     const { mcpServerPool } = await import("./lib/metamcp");
-    const { metaMcpServerPool } = await import(
-      "./lib/metamcp/metamcp-server-pool"
-    );
+    const { metaMcpServerPool } =
+      await import("./lib/metamcp/metamcp-server-pool");
     await Promise.allSettled([
       mcpServerPool.cleanupAll(),
       metaMcpServerPool.cleanupAll(),
@@ -131,6 +130,7 @@ const gracefulShutdown = async (signal: string) => {
   } catch (error) {
     console.error("Error during graceful shutdown:", error);
   }
+  // eslint-disable-next-line no-process-exit -- intentional: terminate the process after async cleanup in the shutdown signal handler
   process.exit(0);
 };
 
```

**File**: `apps/backend/src/lib/admin-mcp/resolve-user.ts` (modified, +1/-2)
```diff
@@ -1,7 +1,6 @@
 import { db } from "../../db/index";
-import { usersTable } from "../../db/schema";
-
 import { ApiKeysRepository } from "../../db/repositories/api-keys.repo";
+import { usersTable } from "../../db/schema";
 
 const apiKeysRepository = new ApiKeysRepository();
 
```

**File**: `apps/backend/src/lib/admin-mcp/tools-registry.ts` (modified, +1/-3)
```diff
@@ -1,3 +1,4 @@
+import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
 import {
   BulkImportMcpServersRequestSchema,
   CreateApiKeyRequestSchema,
@@ -33,9 +34,6 @@ import { mcpServersImplementations } from "../../trpc/mcp-servers.impl";
 import { namespacesImplementations } from "../../trpc/namespaces.impl";
 import { oauthImplementations } from "../../trpc/oauth.impl";
 import { toolsImplementations } from "../../trpc/tools.impl";
-
-import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
-
 import { createToolName } from "../metamcp/tool-name-parser";
 import { zodToMcpInputSchema } from "./zod-to-mcp-schema";
 
```

**File**: `apps/backend/src/lib/metamcp/header-forwarding.test.ts` (modified, +4/-6)
```diff
@@ -348,9 +348,7 @@ describe("serverRequiresForwardedHeaders", () => {
       ),
     ).toBe(false);
     expect(
-      serverRequiresForwardedHeaders(
-        makeServer({ uuid: "s1", name: "test" }),
-      ),
+      serverRequiresForwardedHeaders(makeServer({ uuid: "s1", name: "test" })),
     ).toBe(false);
   });
 });
@@ -427,9 +425,9 @@ describe("extractClientHeaders", () => {
 
 describe("ForwardHeadersRecordSchema - deny-list validation", () => {
   it("should reject forbidden headers at schema level", () => {
-    expect(
-      ForwardHeadersRecordSchema.safeParse({ Host: "Host" }).success,
-    ).toBe(false);
+    expect(ForwardHeadersRecordSchema.safeParse({ Host: "Host" }).success).toBe(
+      false,
+    );
     expect(
       ForwardHeadersRecordSchema.safeParse({ Cookie: "Cookie" }).success,
     ).toBe(false);
```

**File**: `apps/backend/src/lib/metamcp/mcp-server-pool.ts` (modified, +19/-16)
```diff
@@ -51,7 +51,8 @@ export class McpServerPool {
   private healthCheckTimer: NodeJS.Timeout | null = null;
 
   // Background idle sessions by namespace: namespaceUuid -> any
-  private backgroundIdleSessionsByNamespace: Map<string, any> = new Map();
+  private backgroundIdleSessionsByNamespace: Map<string, Map<string, unknown>> =
+    new Map();
 
   // Default number of idle sessions per server UUID
   private readonly defaultIdleCount: number;
@@ -357,7 +358,10 @@ export class McpServerPool {
       const newClient = await this.createNewConnection(params, namespaceUuid);
       if (newClient) {
         const currentGeneration = this.idleSessionGenerations[serverUuid] ?? 0;
-        if (!this.idleSessions[serverUuid] && currentGeneration === generation) {
+        if (
+          !this.idleSessions[serverUuid] &&
+          currentGeneration === generation
+        ) {
           this.idleSessions[serverUuid] = newClient;
           logger.info(`Created idle session for server ${serverUuid}`);
           metamcpLogStore.addLog(
@@ -417,7 +421,11 @@ export class McpServerPool {
     this.createNewConnection(params, namespaceUuid)
       .then((newClient) => {
         const currentGeneration = this.idleSessionGenerations[serverUuid] ?? 0;
-        if (newClient && !this.idleSessions[serverUuid] && currentGeneration === generation) {
+        if (
+          newClient &&
+          !this.idleSessions[serverUuid] &&
+          currentGeneration === generation
+        ) {
           this.idleSessions[serverUuid] = newClient;
           logger.info(
             `Created background idle session for server [${params.name}] ${serverUuid}`,
@@ -595,8 +603,7 @@ export class McpServerPool {
     // Calculate per-server breakdown
     const perServerCounts: Record<string, number> = {};
     for (const serverUuid of Object.keys(this.serverParamsCache)) {
-      perServerCounts[serverUuid] =
-        this.countConnectionsForServer(serverUuid);
+      perServerCounts[serverUuid] = this.countConnectionsForServer(serverUuid);
     }
 
     return {
@@ -656,7 +663,7 @@ export class McpServerPool {
   /**
    * Get background idle sessions by namespace
    */
-  getBackgroundIdleSessionsByNamespace(): Map<string, any> {
+  getBackgroundIdleSessionsByNamespace(): Map<string, Map<string, unknown>> {
     return this.backgroundIdleSessionsByNamespace;
   }
 
@@ -665,7 +672,7 @@ export class McpServerPool {
    */
   setBackgroundIdleSessionsByNamespace(
     namespaceUuid: string,
-    options: any,
+    options: Map<string, unknown>,
   ): void {
     this.backgroundIdleSessionsByNamespace.set(namespaceUuid, options);
   }
@@ -1033,12 +1040,9 @@ export class McpServerPool {
    */
   private startHealthCheckTimer(): void {
     // Check idle session health every 60 seconds
-    this.healthCheckTimer = setInterval(
-      async () => {
-        await this.checkIdleSessionHealth();
-      },
-      60 * 1000,
-    ); // 60 seconds
+    this.healthCheckTimer = setInterval(async () => {
+      await this.checkIdleSessionHealth();
+    }, 60 * 1000); // 60 seconds
   }
 
   /**
@@ -1090,9 +1094,8 @@ export class McpServerPool {
         !this.idleSessions[serverUuid] &&
         !this.creatingIdleSessions.has(serverUuid)
       ) {
-        const isError = await serverErrorTracker.isServerInErrorState(
-          serverUuid,
-        );
+        const isError =
+          await serverErrorTracker.isServerInErrorState(serverUuid);
         if (!isError) {
           // Not in error and no idle session - try to create one
           this.createIdleSessionAsync(serverUuid, params);
```

---

### Incident Patch 2: `e52821ed` (2026-06-16)
**Commit Message**: upgrades and fixes

**File**: `apps/backend/package.json` (modified, +2/-3)
```diff
@@ -22,7 +22,7 @@
     "db:migrate:dev": "dotenv -e ../../.env.local -- drizzle-kit migrate"
   },
   "dependencies": {
-    "@modelcontextprotocol/sdk": "1.16.0",
+    "@modelcontextprotocol/sdk": "1.29.0",
     "@repo/trpc": "workspace:*",
     "@repo/zod-types": "workspace:*",
     "@trpc/server": "^11.4.1",
@@ -39,8 +39,7 @@
     "pg": "^8.16.0",
     "shell-quote": "^1.8.3",
     "spawn-rx": "^5.1.2",
-    "zod": "^3.25.64",
-    "zod-to-json-schema": "^3.25.0"
+    "zod": "^4.4.3"
   },
   "devDependencies": {
     "@repo/eslint-config": "workspace:*",
```

**File**: `apps/backend/src/db/repositories/mcp-servers.repo.ts` (modified, +4/-2)
```diff
@@ -257,9 +257,11 @@ export class McpServersRepository {
     const updated = await db
       .update(mcpServersTable)
       .set({
-        error_status: McpServerErrorStatusEnum.Enum.NONE,
+        error_status: McpServerErrorStatusEnum.enum.NONE,
       })
-      .where(eq(mcpServersTable.error_status, McpServerErrorStatusEnum.Enum.ERROR))
+      .where(
+        eq(mcpServersTable.error_status, McpServerErrorStatusEnum.enum.ERROR),
+      )
       .returning();
 
     return updated.length;
```

**File**: `apps/backend/src/db/schema.ts` (modified, +14/-7)
```diff
@@ -19,17 +19,24 @@ import {
   uuid,
 } from "drizzle-orm/pg-core";
 
+// zod v4 types `ZodEnum.options` as a plain array, but drizzle's pgEnum requires
+// a non-empty tuple. Re-assert the shape while preserving the literal union so
+// the generated columns keep their narrow enum types.
+function toEnumTuple<T extends string>(options: readonly T[]): [T, ...T[]] {
+  return options as unknown as [T, ...T[]];
+}
+
 export const mcpServerTypeEnum = pgEnum(
   "mcp_server_type",
-  McpServerTypeEnum.options,
+  toEnumTuple(McpServerTypeEnum.options),
 );
 export const mcpServerStatusEnum = pgEnum(
   "mcp_server_status",
-  McpServerStatusEnum.options,
+  toEnumTuple(McpServerStatusEnum.options),
 );
 export const mcpServerErrorStatusEnum = pgEnum(
   "mcp_server_error_status",
-  McpServerErrorStatusEnum.options,
+  toEnumTuple(McpServerErrorStatusEnum.options),
 );
 export const mcpRequestAuditStatusEnum = pgEnum("mcp_request_audit_status", [
   "SUCCESS",
@@ -44,7 +51,7 @@ export const mcpServersTable = pgTable(
     description: text("description"),
     type: mcpServerTypeEnum("type")
       .notNull()
-      .default(McpServerTypeEnum.Enum.STDIO),
+      .default(McpServerTypeEnum.enum.STDIO),
     command: text("command"),
     args: text("args")
       .array()
@@ -57,7 +64,7 @@ export const mcpServersTable = pgTable(
     url: text("url"),
     error_status: mcpServerErrorStatusEnum("error_status")
       .notNull()
-      .default(McpServerErrorStatusEnum.Enum.NONE),
+      .default(McpServerErrorStatusEnum.enum.NONE),
     created_at: timestamp("created_at", { withTimezone: true })
       .notNull()
       .defaultNow(),
@@ -321,7 +328,7 @@ export const namespaceServerMappingsTable = pgTable(
       .references(() => mcpServersTable.uuid, { onDelete: "cascade" }),
     status: mcpServerStatusEnum("status")
       .notNull()
-      .default(McpServerStatusEnum.Enum.ACTIVE),
+      .default(McpServerStatusEnum.enum.ACTIVE),
     created_at: timestamp("created_at", { withTimezone: true })
       .notNull()
       .defaultNow(),
@@ -357,7 +364,7 @@ export const namespaceToolMappingsTable = pgTable(
       .references(() => mcpServersTable.uuid, { onDelete: "cascade" }),
     status: mcpServerStatusEnum("status")
       .notNull()
-      .default(McpServerStatusEnum.Enum.ACTIVE),
+      .default(McpServerStatusEnum.enum.ACTIVE),
     override_name: text("override_name"),
     override_title: text("override_title"),
     override_description: text("override_description"),
```

**File**: `apps/backend/src/lib/admin-mcp/zod-to-mcp-schema.ts` (modified, +13/-15)
```diff
@@ -1,19 +1,17 @@
-import type { ZodTypeAny } from "zod";
-import { zodToJsonSchema } from "zod-to-json-schema";
+import { z, type ZodType } from "zod";
 
-export function zodToMcpInputSchema(schema: ZodTypeAny): Record<string, unknown> {
-  // zod-to-json-schema's return-type inference recurses too deeply on some zod
-  // 3.25 schemas (TS2589); the runtime result is unaffected, so call through a
-  // narrowed function signature to stop the deep instantiation.
-  const toJsonSchema = zodToJsonSchema as unknown as (
-    s: ZodTypeAny,
-    opts?: Record<string, unknown>,
-  ) => Record<string, unknown>;
-  const jsonSchema = toJsonSchema(schema, {
-    $refStrategy: "none",
-    target: "openApi3",
-  });
+export function zodToMcpInputSchema(schema: ZodType): Record<string, unknown> {
+  // zod v4 ships native JSON Schema conversion, replacing the external
+  // zod-to-json-schema package. Inline reused subschemas (no $ref/$defs) and
+  // tolerate unrepresentable nodes (e.g. z.any(), z.date()) so the MCP tool
+  // inputSchema stays a single self-contained object.
+  const jsonSchema = z.toJSONSchema(schema, {
+    target: "draft-7",
+    io: "input",
+    reused: "inline",
+    unrepresentable: "any",
+  }) as Record<string, unknown>;
 
-  const { $schema: _, ...rest } = jsonSchema as Record<string, unknown>;
+  const { $schema: _schema, ...rest } = jsonSchema;
   return rest;
 }
```

**File**: `apps/backend/src/lib/bootstrap.service.ts` (modified, +2/-2)
```diff
@@ -989,7 +989,7 @@ export async function initializeEnvironmentConfiguration(): Promise<void> {
   console.log("🔧 Setting registration controls...");
   try {
     await upsertConfig(
-      ConfigKeyEnum.Enum.DISABLE_SIGNUP,
+      ConfigKeyEnum.enum.DISABLE_SIGNUP,
       config.disableUiRegistration.toString(),
       "Whether new user signup is disabled",
     );
@@ -999,7 +999,7 @@ export async function initializeEnvironmentConfiguration(): Promise<void> {
 
   try {
     await upsertConfig(
-      ConfigKeyEnum.Enum.DISABLE_SSO_SIGNUP,
+      ConfigKeyEnum.enum.DISABLE_SSO_SIGNUP,
       config.disableSsoRegistration.toString(),
       "Whether new user signup via SSO/OAuth is disabled",
     );
```

**File**: `apps/backend/src/lib/config.service.ts` (modified, +17/-17)
```diff
@@ -5,95 +5,95 @@ import { configRepo } from "../db/repositories/config.repo";
 export const configService = {
   async isSignupDisabled(): Promise<boolean> {
     const config = await configRepo.getConfig(
-      ConfigKeyEnum.Enum.DISABLE_SIGNUP,
+      ConfigKeyEnum.enum.DISABLE_SIGNUP,
     );
     return config?.value === "true";
   },
 
   async setSignupDisabled(disabled: boolean): Promise<void> {
     await configRepo.setConfig(
-      ConfigKeyEnum.Enum.DISABLE_SIGNUP,
+      ConfigKeyEnum.enum.DISABLE_SIGNUP,
       disabled.toString(),
       "Whether new user signup is disabled",
     );
   },
 
   async isSsoSignupDisabled(): Promise<boolean> {
     const config = await configRepo.getConfig(
-      ConfigKeyEnum.Enum.DISABLE_SSO_SIGNUP,
+      ConfigKeyEnum.enum.DISABLE_SSO_SIGNUP,
     );
     return config?.value === "true";
   },
 
   async setSsoSignupDisabled(disabled: boolean): Promise<void> {
     await configRepo.setConfig(
-      ConfigKeyEnum.Enum.DISABLE_SSO_SIGNUP,
+      ConfigKeyEnum.enum.DISABLE_SSO_SIGNUP,
       disabled.toString(),
       "Whether new user signup via SSO/OAuth is disabled",
     );
   },
 
   async isBasicAuthDisabled(): Promise<boolean> {
     const config = await configRepo.getConfig(
-      ConfigKeyEnum.Enum.DISABLE_BASIC_AUTH,
+      ConfigKeyEnum.enum.DISABLE_BASIC_AUTH,
     );
     return config?.value === "true";
   },
 
   async setBasicAuthDisabled(disabled: boolean): Promise<void> {
     await configRepo.setConfig(
-      ConfigKeyEnum.Enum.DISABLE_BASIC_AUTH,
+      ConfigKeyEnum.enum.DISABLE_BASIC_AUTH,
       disabled.toString(),
       "Whether basic email/password authentication is disabled",
     );
   },
 
   async getMcpResetTimeoutOnProgress(): Promise<boolean> {
     const config = await configRepo.getConfig(
-      ConfigKeyEnum.Enum.MCP_RESET_TIMEOUT_ON_PROGRESS,
+      ConfigKeyEnum.enum.MCP_RESET_TIMEOUT_ON_PROGRESS,
     );
     return config?.value === "true" || true;
   },
 
   async setMcpResetTimeoutOnProgress(enabled: boolean): Promise<void> {
     await configRepo.setConfig(
-      ConfigKeyEnum.Enum.MCP_RESET_TIMEOUT_ON_PROGRESS,
+      ConfigKeyEnum.enum.MCP_RESET_TIMEOUT_ON_PROGRESS,
       enabled.toString(),
       "Whether to reset timeout on progress for MCP requests",
     );
   },
 
   async getMcpTimeout(): Promise<number> {
-    const config = await configRepo.getConfig(ConfigKeyEnum.Enum.MCP_TIMEOUT);
+    const config = await configRepo.getConfig(ConfigKeyEnum.enum.MCP_TIMEOUT);
     return config?.value ? parseInt(config.value, 10) : 60000;
   },
 
   async setMcpTimeout(timeout: number): Promise<void> {
     await configRepo.setConfig(
-      ConfigKeyEnum.Enum.MCP_TIMEOUT,
+      ConfigKeyEnum.enum.MCP_TIMEOUT,
       timeout.toString(),
       "MCP request timeout in milliseconds",
     );
   },
 
   async getMcpMaxTotalTimeout(): Promise<number> {
     const config = await configRepo.getConfig(
-      ConfigKeyEnum.Enum.MCP_MAX_TOTAL_TIMEOUT,
+      ConfigKeyEnum.enum.MCP_MAX_TOTAL_TIMEOUT,
     );
     return config?.value ? parseInt(config.value, 10) : 60000;
   },
 
   async setMcpMaxTotalTimeout(timeout: number): Promise<void> {
     await configRepo.setConfig(
-      ConfigKeyEnum.Enum.MCP_MAX_TOTAL_TIMEOUT,
+      ConfigKeyEnum.enum.MCP_MAX_TOTAL_TIMEOUT,
       timeout.toString(),
       "MCP maximum total timeout in milliseconds",
     );
   },
 
   async getMcpMaxAttempts(): Promise<number> {
     const config = await configRepo.getConfig(
-      ConfigKeyEnum.Enum.MCP_MAX_ATTEMPTS,
+      ConfigKeyEnum.enum.MCP_MAX_ATTEMPTS,
     );
     // Default to 3: a single transient blip (e.g. a slow cold-cache `uvx`
     // spawn) shouldn't immediately flag a server as ERROR.
@@ -102,15 +102,15 @@ export const configService = {
 
   async setMcpMaxAttempts(maxAttempts: number): Promise<void> {
     await configRepo.setConfig(
-      ConfigKeyEnum.Enum.MCP_MAX_ATTEMPTS,
+      ConfigKeyEnum.enum.MCP_MAX_ATTEMPTS,
       maxAttempts.toString(),
       "Maximum number of crash attempts before marking MCP server as ERROR",
     );
   },
 
   async getSessionLifetime(): Promise<number | null> {
     const config = await configRepo.getConfig(
-      ConfigKeyEnum.Enum.SESSION_LIFETIME,
+      ConfigKeyEnum.enum.SESSION_LIFETIME,
     );
     if (!config?.value) {
       // Fallback to env var (milliseconds), then null (infinite sessions)
@@ -128,10 +128,10 @@ export const configService = {
   async setSessionLifetime(lifetime?: number | null): Promise<void> {
     if (lifetime === null || lifetime === undefined) {
       // Remove the config to indicate infinite session lifetime
-      await configRepo.deleteConfig(ConfigKeyEnum.Enum.SESSION_LIFETIME);
+      await configRepo.deleteConfig(ConfigKeyEnum.enum.SESSION_LIFETIME);
     } else {
       await configRepo.setConfig(
-        ConfigKeyEnum.Enum.SESSION_LIFETIME,
+        ConfigKeyEnum.enum.SESSION_LIFETIME,
         lifetime.toString(),
         "Session lif
```

**File**: `apps/backend/src/lib/metamcp/fetch-metamcp.ts` (modified, +2/-2)
```diff
@@ -30,14 +30,14 @@ export async function getMcpServers(
       whereConditions.push(
         eq(
           namespaceServerMappingsTable.status,
-          McpServerStatusEnum.Enum.ACTIVE,
+          McpServerStatusEnum.enum.ACTIVE,
         ),
       );
     }
 
     // Always exclude servers with ERROR status (these are crashed servers)
     whereConditions.push(
-      eq(mcpServersTable.error_status, McpServerErrorStatusEnum.Enum.NONE),
+      eq(mcpServersTable.error_status, McpServerErrorStatusEnum.enum.NONE),
     );
 
     // Fetch MCP servers for the specific namespace using a join query
```

**File**: `apps/backend/src/lib/metamcp/server-error-tracker.ts` (modified, +3/-3)
```diff
@@ -120,7 +120,7 @@ export class ServerErrorTracker {
       // Update the server-level error status
       await mcpServersRepository.updateServerErrorStatus({
         serverUuid,
-        errorStatus: McpServerErrorStatusEnum.Enum.ERROR,
+        errorStatus: McpServerErrorStatusEnum.enum.ERROR,
       });
 
       logger.error(`Server ${serverUuid} marked as ERROR at server level`);
@@ -156,7 +156,7 @@ export class ServerErrorTracker {
   async isServerInErrorState(serverUuid: string): Promise<boolean> {
     try {
       const server = await mcpServersRepository.findByUuid(serverUuid);
-      return server?.error_status === McpServerErrorStatusEnum.Enum.ERROR;
+      return server?.error_status === McpServerErrorStatusEnum.enum.ERROR;
     } catch (error) {
       logger.error(
         `Error checking server error state for ${serverUuid}:`,
@@ -177,7 +177,7 @@ export class ServerErrorTracker {
       // Update the database to clear the error status
       await mcpServersRepository.updateServerErrorStatus({
         serverUuid,
-        errorStatus: McpServerErrorStatusEnum.Enum.NONE,
+        errorStatus: McpServerErrorStatusEnum.enum.NONE,
       });
 
       logger.info(`Reset error state for server ${serverUuid}`);
```

---

### Incident Patch 3: `7559e1c8` (2026-06-15)
**Commit Message**: Merge pull request #301 from raphaelbarreiros/fix/oauth-post-auth-retry-csrf

fix(oauth): post-auth retry + state CSRF validation (closes #298, #299)

Stacked on #295. Adds: retry of the initial tools/list after token exchange to
ride out the upstream session-establishment race (recoverFromPostAuthRace +
attemptConnect refactor in client.ts), per-OAuth-session expected_state
persistence, and server-side state validation at exchangeToken (CSRF defence).

Conflict resolution:
- client.ts: kept #301's attemptConnect / post-auth-race refactor, and grafted
  ai-dev's #311 self-heal (wasInErrorState + resetServerErrorState on success,
  no ERROR-state early-return) and #288 crash logging (metamcpLogStore) into it.
  Updated attemptConnect's doc comment to reflect the self-heal behavior.
- oauth.zod.ts (UpsertOAuthSessionRequestSchema): kept ai-dev's non-nullable
  tokens/code_verifier (#300 atomic-upsert contract) and added #301's
  expected_state; merged both comment notes.

Migration: dropped #301's colliding 0014_same_the_hunter and regenerated
0018_oauth_expected_state from the merged schema.

Verified: backend builds, 186 tests pass (incl. #301's new suites), 0 new type
errors; fron

**File**: `apps/backend/drizzle/0018_oauth_expected_state.sql` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+ALTER TABLE "oauth_sessions" ADD COLUMN "expected_state" text;
\ No newline at end of file
```

**File**: `apps/backend/drizzle/meta/0018_snapshot.json` (added, +2379/-0)
```diff
@@ -0,0 +1,2379 @@
+{
+  "id": "8f3ca21c-c98c-4b39-9596-349b04f52b49",
+  "prevId": "ca103932-8877-40cb-a923-e1aab028cfed",
+  "version": "7",
+  "dialect": "postgresql",
+  "tables": {
+    "public.accounts": {
+      "name": "accounts",
+      "schema": "",
+      "columns": {
+        "id": {
+          "name": "id",
+          "type": "text",
+          "primaryKey": true,
+          "notNull": true
+        },
+        "account_id": {
+          "name": "account_id",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "provider_id": {
+          "name": "provider_id",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "user_id": {
+          "name": "user_id",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "access_token": {
+          "name": "access_token",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "refresh_token": {
+          "name": "refresh_token",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "id_token": {
+          "name": "id_token",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "access_token_expires_at": {
+          "name": "access_token_expires_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "refresh_token_expires_at": {
+          "name": "refresh_token_expires_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "scope": {
+          "name": "scope",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "password": {
+          "name": "password",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "created_at": {
+          "name": "created_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true,
+          "default": "now()"
+        },
+        "updated_at": {
+          "name": "updated_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true,
+          "default": "now()"
+        }
+      },
+      "indexes": {},
+      "foreignKeys": {
+        "accounts_user_id_users_id_fk": {
+          "name": "accounts_user_id_users_id_fk",
+          "tableFrom": "accounts",
+          "tableTo": "users",
+          "columnsFrom": [
+            "user_id"
+          ],
+          "columnsTo": [
+            "id"
+          ],
+          "onDelete": "cascade",
+          "onUpdate": "no action"
+        }
+      },
+      "compositePrimaryKeys": {},
+      "uniqueConstraints": {},
+      "policies": {},
+      "checkConstraints": {},
+      "isRLSEnabled": false
+    },
+    "public.api_keys": {
+      "name": "api_keys",
+      "schema": "",
+      "columns": {
+        "uuid": {
+          "name": "uuid",
+          "type": "uuid",
+          "primaryKey": true,
+          "notNull": true,
+          "default": "gen_random_uuid()"
+        },
+        "name": {
+          "name": "name",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "key": {
+          "name": "key",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "user_id": {
+          "name": "user_id",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "created_at": {
+          "name": "created_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true,
+          "default": "now()"
+        },
+        "is_active": {
+          "name": "is_active",
+          "type": "boolean",
+          "primaryKey": false,
+          "notNull": true,
+          "default": true
+        }
+      },
+      "indexes": {
+        "api_keys_user_id_idx": {
+          "name": "api_keys_user_id_idx",
+          "columns": [
+            {
+              "expression": "user_id",
+              "isExpression": false,
+              "asc": true,
+              "nulls": "last"
+            }
+          ],
+          "isUnique": false,
+          "concurrently": false,
+          "method": "btree",
+          "with": {}
+        },
+        "api_keys_key_idx": {
+          "name": "api_keys_key_idx",
+          "columns": [
+            {
+              "expression": "key",
+              "isExpression": false,
+              "asc": true,
+              "nulls": "last"
+            }
+          ],
+          "isUnique": false,
+          "concurrently": false,
+          "method": "btree",
+          "with"
```

**File**: `apps/backend/drizzle/meta/_journal.json` (modified, +7/-0)
```diff
@@ -127,6 +127,13 @@
       "when": 1781439722147,
       "tag": "0017_audit_public_tool_calls",
       "breakpoints": true
+    },
+    {
+      "idx": 18,
+      "version": "7",
+      "when": 1781531857640,
+      "tag": "0018_oauth_expected_state",
+      "breakpoints": true
     }
   ]
 }
\ No newline at end of file
```

**File**: `apps/backend/src/db/repositories/oauth-sessions.repo.ts` (modified, +26/-0)
```diff
@@ -31,6 +31,9 @@ export class OAuthSessionsRepository {
         }),
         ...(input.tokens && { tokens: input.tokens }),
         ...(input.code_verifier && { code_verifier: input.code_verifier }),
+        ...(input.expected_state && {
+          expected_state: input.expected_state,
+        }),
       })
       .returning();
 
@@ -48,6 +51,9 @@ export class OAuthSessionsRepository {
         }),
         ...(input.tokens && { tokens: input.tokens }),
         ...(input.code_verifier && { code_verifier: input.code_verifier }),
+        ...(input.expected_state && {
+          expected_state: input.expected_state,
+        }),
         updated_at: sql`NOW()`,
       })
       .where(eq(oauthSessionsTable.mcp_server_uuid, input.mcp_server_uuid))
@@ -56,6 +62,26 @@ export class OAuthSessionsRepository {
     return updatedSession;
   }
 
+  // Dedicated clear path for `expected_state`. The truthy-spread upsert
+  // cannot write NULL through `input.expected_state` (a `null` value would
+  // be elided by the `&&` guard), so the one-shot clear after a successful
+  // token exchange goes through this method instead. Returns the updated
+  // row, or undefined if no row exists for the server.
+  async clearExpectedState(
+    mcpServerUuid: string,
+  ): Promise<DatabaseOAuthSession | undefined> {
+    const [updatedSession] = await db
+      .update(oauthSessionsTable)
+      .set({
+        expected_state: null,
+        updated_at: sql`NOW()`,
+      })
+      .where(eq(oauthSessionsTable.mcp_server_uuid, mcpServerUuid))
+      .returning();
+
+    return updatedSession;
+  }
+
   async upsert(input: OAuthSessionUpdateInput): Promise<DatabaseOAuthSession> {
     // Single-statement atomic upsert. Concurrent callers for the same
     // mcp_server_uuid resolve via ON CONFLICT instead of racing a
```

**File**: `apps/backend/src/db/schema.ts` (modified, +6/-0)
```diff
@@ -109,6 +109,12 @@ export const oauthSessionsTable = pgTable(
     // the call sites.
     tokens: jsonb("tokens").$type<UpstreamTokenResponse>(),
     code_verifier: text("code_verifier"),
+    // CSRF defence (RFC 6749 §10.12). Generated server-side at the
+    // authorize-redirect step (`DbOAuthClientProvider.state()`), compared
+    // against the upstream's echoed `state` at token exchange, and cleared
+    // on success (one-shot). NEVER returned to the frontend — the
+    // serializer strips it.
+    expected_state: text("expected_state"),
     created_at: timestamp("created_at", { withTimezone: true })
       .notNull()
       .defaultNow(),
```

**File**: `apps/backend/src/lib/metamcp/client.ts` (modified, +129/-27)
```diff
@@ -7,7 +7,9 @@ import { ServerParameters } from "@repo/zod-types";
 
 import logger from "@/utils/logger";
 
+import { oauthSessionsRepository } from "../../db/repositories";
 import { tryRefreshUpstreamTokens } from "../oauth-upstream/refresh-on-401";
+import { recoverFromPostAuthRace } from "../oauth-upstream/retry-post-auth";
 import { isUpstreamUnauthorizedError } from "../oauth-upstream/token-exchange";
 import { ProcessManagedStdioTransport } from "../stdio-transport/process-managed-transport";
 import { metamcpLogStore } from "./log-store";
@@ -182,7 +184,14 @@ export const connectMetaMcpClient = async (
     `Connecting to server ${serverParams.uuid} with max attempts: ${maxAttempts}`,
   );
 
-  while (retry) {
+  // Build a fresh transport+client and run the SDK's initialize handshake.
+  // Owns its own cleanup-on-failure so the helper can be called multiple
+  // times in a single outer iteration (post-auth fast-retry path) without
+  // leaking orphaned transports. Returns `undefined` only when
+  // `createMetaMcpClient` declines to build a transport (non-retryable); a
+  // server previously flagged ERROR is still attempted and self-heals on
+  // success (see wasInErrorState below).
+  const attemptConnect = async (): Promise<ConnectedClient | undefined> => {
     let transport: Transport | undefined;
     let client: Client | undefined;
 
@@ -197,7 +206,6 @@ export const connectMetaMcpClient = async (
         serverParams.uuid,
       );
 
-      // Create fresh client and transport for each attempt
       const result = createMetaMcpClient(serverParams);
       client = result.client;
       transport = result.transport;
@@ -251,33 +259,28 @@ export const connectMetaMcpClient = async (
         await serverErrorTracker.resetServerErrorState(serverParams.uuid);
       }
 
+      const connectedTransport = transport;
+      const connectedClient = client;
       return {
-        client,
+        client: connectedClient,
         cleanup: async () => {
-          await transport!.close();
-          await client!.close();
+          await connectedTransport.close();
+          await connectedClient.close();
         },
         onProcessCrash: (exitCode, signal) => {
           logger.warn(
             `Process crash detected for server ${serverParams.name} (${serverParams.uuid}): code=${exitCode}, signal=${signal}`,
           );
-
-          // Notify the pool about the crash
           if (onProcessCrash) {
             onProcessCrash(exitCode, signal);
           }
         },
       };
     } catch (error) {
-      metamcpLogStore.addLog(
-        "client",
-        "error",
-        `Error connecting to MetaMCP client (attempt ${count + 1}/${maxAttempts})`,
-        error,
-      );
-
-      // CRITICAL FIX: Clean up transport/process on connection failure
-      // This prevents orphaned processes from accumulating
+      // Clean up transport/process on connection failure so this attempt
+      // does not leave orphaned resources behind. Rethrow so the caller
+      // can decide whether to recover (fast retry / 401 refresh) or
+      // surface the failure.
       if (transport) {
         try {
           await transport.close();
@@ -294,19 +297,63 @@ export const connectMetaMcpClient = async (
       if (client) {
         try {
           await client.close();
-        } catch (cleanupError) {
+        } catch (_cleanupError) {
           // Client may not be fully initialized, ignore
         }
       }
+      throw error;
+    }
+  };
+
+  while (retry) {
+    try {
+      const connected = await attemptConnect();
+      return connected;
+    } catch (error) {
+      metamcpLogStore.addLog(
+        "client",
+        "error",
+        `Error connecting to MetaMCP client (attempt ${count + 1}/${maxAttempts})`,
+        error,
+      );
 
-      // Refresh-on-401: if the upstream MCP server returned an
-      // unauthorized response and we have a refresh_token on file, try a
-      // server-to-server refresh once before counting this as a retry.
-      // On success the next loop iteration rebuilds the transport using
-      // the freshly-rotated access_token from oauth_sessions; on failure
-      // we fall through to the normal retry/backoff path.
       const isHttpServer =
         serverParams.type === "SSE" || serverParams.type === "STREAMABLE_HTTP";
+
+      // Recovery cascade — ORDER IS LOAD-BEARING. Do not reorder without
+      // re-reading the rationale below.
+      //
+      //   refresh-on-401  →  post-auth race recovery  →  count++ / back-off
+      //
+      // Why this order:
+      //
+      //   - 401-refresh MUST run first. An expired access_token surfaces
+      //     as a 401 from the upstream during initialize; the refresh
+      //     helper rotates it server-side and `continue`s the outer
+      //     loop. The post-auth race branch's error matrix refuses 4xx
+      //     as a belt-and-braces second line of defence, but routing
+      //   
```

**File**: `apps/backend/src/lib/oauth-upstream/retry-post-auth.test.ts` (added, +232/-0)
```diff
@@ -0,0 +1,232 @@
+import { describe, expect, it, vi } from "vitest";
+
+import {
+  isInsidePostAuthWindow,
+  isPostAuthRetryableError,
+  recoverFromPostAuthRace,
+} from "./retry-post-auth";
+
+// These tests pin the post-auth-race recovery behaviour from issue #298.
+// The helper's contract is intentionally narrow:
+//   - retry triggers ONLY on the empirical symptom set (empty body /
+//     ECONNREFUSED / 5xx-with-empty-body)
+//   - retry is gated by a "tokens were issued within the last 10s" check
+//   - retry budget is exactly 3 attempts after the initial failure, with
+//     250 / 500 / 1000 ms backoff sleeps
+//   - non-retryable errors (401, 403, 400 + OAuth envelope) short-circuit
+//     so the caller's existing refresh-on-401 / upstream-error paths can
+//     handle them
+//
+// All time-based assertions use a fake `sleep` so the test suite stays
+// in the single-millisecond range.
+
+const ISSUED_AT = new Date("2026-05-20T12:00:00Z");
+const INSIDE_WINDOW_NOW = ISSUED_AT.getTime() + 5_000; // 5s after issue
+const OUTSIDE_WINDOW_NOW = ISSUED_AT.getTime() + 11_000; // 11s after issue
+
+describe("retry-post-auth — isPostAuthRetryableError", () => {
+  it("matches SyntaxError instances thrown by the SDK's consumeBody on empty body", () => {
+    const err = new SyntaxError("Unexpected end of JSON input");
+    expect(isPostAuthRetryableError(err)).toBe(true);
+  });
+
+  it("matches a plain Error carrying the empty-body message (prototype-stripped)", () => {
+    const err = new Error("Unexpected end of JSON input");
+    expect(isPostAuthRetryableError(err)).toBe(true);
+  });
+
+  it("matches Connection refused / ECONNREFUSED on the message or cause.code", () => {
+    expect(
+      isPostAuthRetryableError(
+        new Error("Connection refused. Is the MCP server running?"),
+      ),
+    ).toBe(true);
+    expect(isPostAuthRetryableError(new Error("connect ECONNREFUSED 1.2.3.4:443"))).toBe(true);
+    const withCause = new Error("fetch failed");
+    (withCause as unknown as { cause: { code: string } }).cause = {
+      code: "ECONNREFUSED",
+    };
+    expect(isPostAuthRetryableError(withCause)).toBe(true);
+  });
+
+  it("refuses 401/403 — those belong to refresh-on-401, not this helper", () => {
+    const err401 = Object.assign(new Error("Unauthorized"), { status: 401 });
+    const err403 = Object.assign(new Error("Forbidden"), { status: 403 });
+    expect(isPostAuthRetryableError(err401)).toBe(false);
+    expect(isPostAuthRetryableError(err403)).toBe(false);
+  });
+
+  it("refuses 400 with an OAuth error envelope — terminal client error", () => {
+    const err = Object.assign(new Error("invalid_grant"), { status: 400 });
+    expect(isPostAuthRetryableError(err)).toBe(false);
+  });
+
+  it("accepts 5xx — empty/malformed bodies on 502/503 are part of the race set", () => {
+    const err502 = Object.assign(new Error("Bad Gateway"), { status: 502 });
+    const err503 = Object.assign(new Error("Service Unavailable"), {
+      status: 503,
+    });
+    expect(isPostAuthRetryableError(err502)).toBe(true);
+    expect(isPostAuthRetryableError(err503)).toBe(true);
+  });
+});
+
+describe("retry-post-auth — isInsidePostAuthWindow", () => {
+  it("returns false when tokensIssuedAt is null", () => {
+    expect(isInsidePostAuthWindow(null, INSIDE_WINDOW_NOW)).toBe(false);
+  });
+
+  it("returns true within the default 10s window", () => {
+    expect(isInsidePostAuthWindow(ISSUED_AT, INSIDE_WINDOW_NOW)).toBe(true);
+  });
+
+  it("returns false outside the default 10s window", () => {
+    expect(isInsidePostAuthWindow(ISSUED_AT, OUTSIDE_WINDOW_NOW)).toBe(false);
+  });
+});
+
+describe("retry-post-auth — recoverFromPostAuthRace", () => {
+  const fakeSleep = () => {
+    const sleeps: number[] = [];
+    return {
+      sleep: async (ms: number) => {
+        sleeps.push(ms);
+      },
+      sleeps,
+    };
+  };
+
+  it("succeeds on the first retry when the upstream comes online", async () => {
+    // The caller's initial attempt already failed (that's what produced
+    // initialError). The helper's first retry runs `op()` after sleeping
+    // backoff[0]; the mock resolves on that very first call.
+    const op = vi
+      .fn<() => Promise<string>>()
+      .mockResolvedValueOnce("connected");
+    const { sleep, sleeps } = fakeSleep();
+
+    const result = await recoverFromPostAuthRace(op, {
+      initialError: new SyntaxError("Unexpected end of JSON input"),
+      tokensIssuedAt: ISSUED_AT,
+      now: () => INSIDE_WINDOW_NOW,
+      sleep,
+    });
+
+    expect(result.kind).toBe("succeeded");
+    if (result.kind === "succeeded") {
+      expect(result.value).toBe("connected");
+    }
+    expect(sleeps).toEqual([250]);
+    expect(op).toHaveBeenCalledTimes(1);
+  });
+
+  it("uses the configured backoff schedule (250 → 500 → 1000) when retries continue to fail", async () => {
+    const op = vi
+      .fn<() => Promise<string>>()
+      .mockRejectedValue(new
```

**File**: `apps/backend/src/lib/oauth-upstream/retry-post-auth.ts` (added, +166/-0)
```diff
@@ -0,0 +1,166 @@
+// Post-auth tools/list retry helper.
+//
+// Symptom (issue #298): immediately after `frontend.oauth.exchangeToken`
+// writes the tokens to `oauth_sessions`, MetaMCP opens an idle session
+// against the upstream. The first request lands while the upstream is
+// still wiring up its per-session state, producing one of:
+//
+//   - `SyntaxError: Unexpected end of JSON input` (the MCP SDK's
+//     `consumeBody` on an empty body)
+//   - `Error: Connection refused` / `ECONNREFUSED`
+//   - HTTP 5xx with empty / malformed body
+//
+// A manual reconnect ~1s later always succeeds, so the cure is a short
+// retry envelope, NOT longer back-off in the outer connect loop.
+//
+// Shape: the caller (`connectMetaMcpClient`) already runs `client.connect`
+// once inside its existing try/catch. When that catch fires we ask this
+// helper to recover — if the conditions match it sleeps and retries the
+// op a few times with exponential backoff. The helper does NOT run the
+// op itself the first time; the outer attempt already did. That keeps
+// the cleanup-on-failure path in one place (the caller's catch).
+//
+// Scoping rules — enforced here, not at the call site:
+//   - Active ONLY when tokens were issued within `postAuthWindowMs` of
+//     the failure. Outside the window the helper returns `null`, signalling
+//     "this is not a post-auth race; do your normal retry/backoff".
+//   - Up to `backoffMs.length` retries (default 3: 250 / 500 / 1000 ms).
+//   - Only the error matrix above is retryable. Anything else — and
+//     specifically 401/403/4xx-with-OAuth-error — returns `null` so the
+//     caller's refresh-on-401 / upstream-error paths handle it.
+
+export interface PostAuthRetryOptions {
+  // The error the initial attempt threw. The helper inspects this to
+  // decide whether the symptom is a post-auth race or something else.
+  initialError: unknown;
+  // When the upstream's OAuth tokens were last issued. The retry window
+  // closes `postAuthWindowMs` after this timestamp; outside it the
+  // helper bails and the caller's normal retry path takes over.
+  tokensIssuedAt: Date | null;
+  // Default 10s. Generous enough to cover the upstream's session-init
+  // latency without papering over genuinely-broken servers indefinitely.
+  postAuthWindowMs?: number;
+  // Default [250, 500, 1000]. The number of entries dictates retry count.
+  backoffMs?: number[];
+  // Optional sleep override for tests. Defaults to setTimeout-based.
+  sleep?: (ms: number) => Promise<void>;
+  // Optional clock for tests. Defaults to Date.now().
+  now?: () => number;
+}
+
+// `succeeded` carries the op's return value; `exhausted` means every
+// retry attempt also failed. `skipped` means the helper declined to
+// engage (out-of-window or non-retryable error) and the caller should
+// run its existing retry/backoff path. The errors are surfaced so the
+// caller can log them if useful.
+export type PostAuthRetryResult<T> =
+  | { kind: "succeeded"; value: T }
+  | { kind: "exhausted"; lastError: unknown; attempts: number }
+  | { kind: "skipped"; reason: "out_of_window" | "non_retryable_error" };
+
+const DEFAULT_WINDOW_MS = 10_000;
+const DEFAULT_BACKOFF_MS: readonly number[] = [250, 500, 1000];
+
+const defaultSleep = (ms: number): Promise<void> =>
+  new Promise((resolve) => setTimeout(resolve, ms));
+
+// Predicate over thrown values. The matrix is deliberately narrow:
+// papering over generic 4xx / 5xx would mask real configuration errors
+// (typo'd token endpoint, expired credentials, ...). See issue #298 for
+// the empirical symptom list.
+export function isPostAuthRetryableError(error: unknown): boolean {
+  if (!error) return false;
+
+  // HTTP-status-bearing errors. Refuse to retry anything in the 4xx
+  // range (auth-relevant errors flow through refresh-on-401 / explicit
+  // OAuth envelope handling). Retry 5xx that pair with empty/malformed
+  // bodies; the SyntaxError detection below also covers the 5xx-with-
+  // empty-body sub-case from a different angle.
+  if (typeof error === "object" && error !== null) {
+    const maybeStatus = (error as { status?: unknown }).status;
+    if (typeof maybeStatus === "number") {
+      if (maybeStatus >= 400 && maybeStatus < 500) return false;
+      if (maybeStatus >= 500 && maybeStatus < 600) return true;
+    }
+  }
+
+  // SyntaxError from the SDK's `consumeBody` on an empty/short body.
+  // Match by instanceof OR the message string — depending on where it
+  // bubbles up from we may lose the prototype chain.
+  if (error instanceof SyntaxError) return true;
+  const message =
+    error instanceof Error
+      ? error.message
+      : typeof error === "string"
+        ? error
+        : "";
+  if (/Unexpected end of JSON input/i.test(message)) return true;
+
+  // Connection refused (Node `fetch`/undici surfaces this string in the
+  // wrapped Error message; the underlying cause carries `code:
+  // "ECONNREFUSED"`). Match eith
```

---

### Incident Patch 4: `c01d15dc` (2026-06-15)
**Commit Message**: Merge pull request #295 from raphaelbarreiros/fix/oauth-server-side-token-exchange

fix(oauth): server-side token exchange + pre-registered upstream OAuth clients

Adds backend-side upstream OAuth token exchange (oauth-upstream/ module:
token-exchange, refresh-on-401) so CORS-restricted enterprise providers
(Salesforce/Okta/Auth0/...) work, plus a pre-registered upstream OAuth client
UI (AdvancedOAuthSection) for providers without RFC 7591 dynamic registration.

Conflict resolution (13 conflicts):
- vitest.config.ts: kept ai-dev's @/ alias (already added by #310); #295's was a
  duplicate.
- oauth.zod.ts: took #295's side for the 3 regions — its new exchange schemas and
  the wider UpstreamTokenResponseSchema for oauth_sessions.tokens. #300's
  oauth-sessions.repo is token-type-agnostic (spreads input.tokens with an &&
  guard), so the widening is compatible.
- mcp-servers.zod.ts, mcp-servers.json: union — kept #256's forward-headers
  schemas/strings and #295's pre-registered-OAuth schemas/strings.
- edit-mcp-server.tsx, page.tsx: union — both the forward-headers field/parsing
  (#256) and the AdvancedOAuthSection + oauthClientInfo payload (#295) are wired
  into the form and apiP

**File**: `apps/backend/src/db/schema.ts` (modified, +7/-2)
```diff
@@ -1,9 +1,9 @@
 import { OAuthClientInformation } from "@modelcontextprotocol/sdk/shared/auth.js";
-import { OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
 import {
   McpServerErrorStatusEnum,
   McpServerStatusEnum,
   McpServerTypeEnum,
+  UpstreamTokenResponse,
 } from "@repo/zod-types";
 import { sql } from "drizzle-orm";
 import {
@@ -102,7 +102,12 @@ export const oauthSessionsTable = pgTable(
       .$type<OAuthClientInformation>()
       .notNull()
       .default(sql`'{}'::jsonb`),
-    tokens: jsonb("tokens").$type<OAuthTokens>(),
+    // Typed as UpstreamTokenResponse (RFC 6749 + .passthrough()) rather
+    // than the MCP SDK's narrow OAuthTokens so providers' extra response
+    // fields (Salesforce `instance_url`, OIDC `id_token`, Microsoft
+    // `ext_expires_in`, ...) round-trip without `as unknown as` casts at
+    // the call sites.
+    tokens: jsonb("tokens").$type<UpstreamTokenResponse>(),
     code_verifier: text("code_verifier"),
     created_at: timestamp("created_at", { withTimezone: true })
       .notNull()
```

**File**: `apps/backend/src/db/serializers/oauth-sessions.serializer.ts` (modified, +4/-6)
```diff
@@ -1,13 +1,11 @@
-import {
-  OAuthClientInformation,
-  OAuthTokens,
-} from "@modelcontextprotocol/sdk/shared/auth.js";
+import { OAuthClientInformation } from "@modelcontextprotocol/sdk/shared/auth.js";
+import { UpstreamTokenResponse } from "@repo/zod-types";
 
 type DatabaseOAuthSession = {
   uuid: string;
   mcp_server_uuid: string;
   client_information: OAuthClientInformation | null;
-  tokens: OAuthTokens | null;
+  tokens: UpstreamTokenResponse | null;
   code_verifier: string | null;
   created_at: Date;
   updated_at: Date;
@@ -17,7 +15,7 @@ type SerializedOAuthSession = {
   uuid: string;
   mcp_server_uuid: string;
   client_information: OAuthClientInformation | null;
-  tokens: OAuthTokens | null;
+  tokens: UpstreamTokenResponse | null;
   code_verifier: string | null;
   created_at: string;
   updated_at: string;
```

**File**: `apps/backend/src/lib/metamcp/client.ts` (modified, +54/-0)
```diff
@@ -7,6 +7,8 @@ import { ServerParameters } from "@repo/zod-types";
 
 import logger from "@/utils/logger";
 
+import { tryRefreshUpstreamTokens } from "../oauth-upstream/refresh-on-401";
+import { isUpstreamUnauthorizedError } from "../oauth-upstream/token-exchange";
 import { ProcessManagedStdioTransport } from "../stdio-transport/process-managed-transport";
 import { metamcpLogStore } from "./log-store";
 import { serverErrorTracker } from "./server-error-tracker";
@@ -297,6 +299,58 @@ export const connectMetaMcpClient = async (
         }
       }
 
+      // Refresh-on-401: if the upstream MCP server returned an
+      // unauthorized response and we have a refresh_token on file, try a
+      // server-to-server refresh once before counting this as a retry.
+      // On success the next loop iteration rebuilds the transport using
+      // the freshly-rotated access_token from oauth_sessions; on failure
+      // we fall through to the normal retry/backoff path.
+      const isHttpServer =
+        serverParams.type === "SSE" || serverParams.type === "STREAMABLE_HTTP";
+      if (
+        isHttpServer &&
+        serverParams.oauth_tokens?.refresh_token &&
+        isUpstreamUnauthorizedError(error)
+      ) {
+        try {
+          const refresh = await tryRefreshUpstreamTokens(serverParams);
+          if (refresh.status === "refreshed" && refresh.tokens) {
+            // Update the in-memory serverParams so the next createMetaMcp
+            // call attaches the new bearer token.
+            serverParams.oauth_tokens = {
+              access_token: refresh.tokens.access_token,
+              token_type: refresh.tokens.token_type,
+              expires_in: refresh.tokens.expires_in,
+              scope:
+                typeof refresh.tokens.scope === "string"
+                  ? refresh.tokens.scope
+                  : undefined,
+              refresh_token:
+                typeof refresh.tokens.refresh_token === "string"
+                  ? refresh.tokens.refresh_token
+                  : undefined,
+            };
+            logger.info(
+              `[oauth] upstream 401 refreshed for ${serverParams.name} (${serverParams.uuid}); retrying connect`,
+            );
+            // Loop again immediately — refresh is the recovery, not a
+            // backoff-worthy failure.
+            continue;
+          }
+          logger.warn(
+            `[oauth] upstream 401 refresh did not recover ${serverParams.name} ` +
+              `(${serverParams.uuid}): ${refresh.status}${
+                refresh.error ? ` (${refresh.error})` : ""
+              }`,
+          );
+        } catch (refreshError) {
+          logger.error(
+            `[oauth] upstream 401 refresh threw for ${serverParams.name} (${serverParams.uuid}):`,
+            refreshError,
+          );
+        }
+      }
+
       count++;
       retry = count < maxAttempts;
       if (retry) {
```

**File**: `apps/backend/src/lib/oauth-upstream/refresh-on-401.test.ts` (added, +272/-0)
```diff
@@ -0,0 +1,272 @@
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
+
+vi.mock("../../db/repositories", () => ({
+  oauthSessionsRepository: {
+    findByMcpServerUuid: vi.fn(),
+    upsert: vi.fn(),
+  },
+}));
+
+vi.mock("../../utils/logger", () => ({
+  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
+}));
+
+const jsonResponse = (status: number, body: unknown): Response =>
+  new Response(JSON.stringify(body), {
+    status,
+    headers: { "Content-Type": "application/json" },
+  });
+
+describe("tryRefreshUpstreamTokens", () => {
+  const SERVER = {
+    uuid: "00000000-0000-0000-0000-0000000000aa",
+    name: "test-server",
+    url: "https://api.example.com/mcp",
+  };
+
+  const loadModule = async () => {
+    const repos = await import("../../db/repositories");
+    const mod = await import("./refresh-on-401");
+    return {
+      tryRefreshUpstreamTokens: mod.tryRefreshUpstreamTokens,
+      findByMcpServerUuid: repos.oauthSessionsRepository
+        .findByMcpServerUuid as ReturnType<typeof vi.fn>,
+      upsert: repos.oauthSessionsRepository.upsert as ReturnType<typeof vi.fn>,
+    };
+  };
+
+  beforeEach(() => {
+    vi.clearAllMocks();
+  });
+  afterEach(() => {
+    vi.restoreAllMocks();
+  });
+
+  it("returns refreshed and persists new tokens on upstream 200", async () => {
+    const { tryRefreshUpstreamTokens, findByMcpServerUuid, upsert } =
+      await loadModule();
+
+    findByMcpServerUuid.mockResolvedValue({
+      mcp_server_uuid: SERVER.uuid,
+      client_information: {
+        client_id: "c1",
+        token_endpoint: "https://upstream/token",
+      },
+      tokens: {
+        access_token: "OLD",
+        token_type: "Bearer",
+        refresh_token: "RT_old",
+      },
+      code_verifier: null,
+    });
+    upsert.mockResolvedValue({});
+
+    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
+      const urlStr = typeof url === "string" ? url : (url as URL).toString();
+      if (urlStr.includes("/.well-known/"))
+        return new Response("nope", { status: 404 });
+      return jsonResponse(200, {
+        access_token: "NEW",
+        token_type: "Bearer",
+        expires_in: 3600,
+      });
+    });
+
+    const result = await tryRefreshUpstreamTokens(SERVER);
+    expect(result.status).toBe("refreshed");
+    expect(result.tokens?.access_token).toBe("NEW");
+    // Refresh token preserved per RFC 6749 §6.
+    expect(result.tokens?.refresh_token).toBe("RT_old");
+    expect(upsert).toHaveBeenCalledWith({
+      mcp_server_uuid: SERVER.uuid,
+      tokens: expect.objectContaining({
+        access_token: "NEW",
+        refresh_token: "RT_old",
+      }),
+    });
+  });
+
+  it("returns no_session when no oauth_sessions row exists", async () => {
+    const { tryRefreshUpstreamTokens, findByMcpServerUuid, upsert } =
+      await loadModule();
+    findByMcpServerUuid.mockResolvedValue(undefined);
+    const result = await tryRefreshUpstreamTokens(SERVER);
+    expect(result.status).toBe("no_session");
+    expect(upsert).not.toHaveBeenCalled();
+  });
+
+  it("returns no_refresh_token when session has tokens but no refresh_token", async () => {
+    const { tryRefreshUpstreamTokens, findByMcpServerUuid, upsert } =
+      await loadModule();
+    findByMcpServerUuid.mockResolvedValue({
+      mcp_server_uuid: SERVER.uuid,
+      client_information: { client_id: "c1" },
+      tokens: { access_token: "x", token_type: "Bearer" },
+    });
+    const result = await tryRefreshUpstreamTokens(SERVER);
+    expect(result.status).toBe("no_refresh_token");
+    expect(upsert).not.toHaveBeenCalled();
+  });
+
+  it("collapses concurrent refresh calls into a single upstream POST (mutex)", async () => {
+    const { tryRefreshUpstreamTokens, findByMcpServerUuid, upsert } =
+      await loadModule();
+
+    findByMcpServerUuid.mockResolvedValue({
+      mcp_server_uuid: SERVER.uuid,
+      client_information: {
+        client_id: "c1",
+        token_endpoint: "https://upstream/token",
+      },
+      tokens: {
+        access_token: "OLD",
+        token_type: "Bearer",
+        refresh_token: "RT_rotating",
+      },
+      code_verifier: null,
+    });
+    upsert.mockResolvedValue({});
+
+    // The upstream is intentionally slow so both refresh calls overlap.
+    // It is a rotating-refresh-token provider: the FIRST call sees
+    // RT_rotating in the request and returns a new RT; the SECOND call
+    // would normally see RT_rotating (stale) and 400 invalid_grant.
+    // With the mutex, only ONE upstream POST happens, both callers share
+    // its result.
+    let postCount = 0;
+    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
+      const urlStr = typeof url === "string" ? url : (url as URL).toString();
+      if (urlStr.includes("/.well-known/"))
+        return new Response("nope", { status: 404 });
+      postCount += 1;
+      // 50ms delay so concurrent callers overlap deterministi
```

**File**: `apps/backend/src/lib/oauth-upstream/refresh-on-401.ts` (added, +188/-0)
```diff
@@ -0,0 +1,188 @@
+// Server-side refresh-on-401 helper for the upstream proxy path.
+//
+// The backend's MCP client (`apps/backend/src/lib/metamcp/client.ts`) does
+// not pass an OAuthClientProvider into the SDK transports, so the SDK has
+// no built-in path to refresh tokens when the upstream returns 401. This
+// helper closes that gap: it reads the persisted oauth_sessions row,
+// POSTs `grant_type=refresh_token` to the upstream's token endpoint, and
+// persists the new tokens back into the DB so the next connection attempt
+// picks them up.
+//
+// Concurrency: an in-process per-server mutex (`inFlightRefreshes`)
+// collapses simultaneous refresh attempts for the same MCP server into
+// one upstream POST. Without this, providers that rotate refresh tokens
+// (Google, Microsoft, Okta with rotation enabled) would consume the
+// refresh_token on the first attempt and reject the second with
+// `invalid_grant`, leaving one of the two connections stranded. The
+// mutex is in-process only; multi-instance deployments still race across
+// processes (acceptable cost for now — a DB-level CAS would be the
+// follow-up).
+//
+// Acceptance criterion #3 from the OAuth-CORS-fix PR.
+
+import { ServerParameters } from "@repo/zod-types";
+
+import { oauthSessionsRepository } from "../../db/repositories";
+import logger from "../../utils/logger";
+import {
+  discoverAuthorizationServerMetadata,
+  OAuthTokens,
+  redactToken,
+  refreshAccessToken,
+  resolveTokenEndpoint,
+  resolveTokenEndpointAuthMethod,
+  UpstreamTokenError,
+} from "./token-exchange";
+
+export interface RefreshResult {
+  status:
+    | "refreshed"
+    | "no_refresh_token"
+    | "no_session"
+    | "no_client_id"
+    | "failed";
+  tokens?: OAuthTokens;
+  error?: string;
+  errorDescription?: string;
+  upstreamStatus?: number;
+}
+
+// Per-server in-flight refresh promises. Concurrent callers for the same
+// MCP server share the same upstream POST instead of racing on rotating
+// refresh tokens. The map is cleared in a `finally` so a refresh failure
+// doesn't permanently pin the server. Exposed for tests; do not depend on
+// it from production code.
+export const inFlightRefreshes = new Map<string, Promise<RefreshResult>>();
+
+// Attempt to refresh upstream OAuth tokens for an MCP server. Returns a
+// status describing what happened. Persists new tokens on success.
+//
+// NOTE: This is intentionally safe to call repeatedly — it short-circuits
+// when there is no refresh_token or no client_id to use.
+export async function tryRefreshUpstreamTokens(
+  serverParams: Pick<ServerParameters, "uuid" | "name" | "url">,
+): Promise<RefreshResult> {
+  const inFlight = inFlightRefreshes.get(serverParams.uuid);
+  if (inFlight) {
+    logger.info(
+      `[oauth] refresh already in flight for ${serverParams.uuid}; joining`,
+    );
+    return inFlight;
+  }
+  const promise = (async () => {
+    try {
+      return await doRefresh(serverParams);
+    } finally {
+      inFlightRefreshes.delete(serverParams.uuid);
+    }
+  })();
+  inFlightRefreshes.set(serverParams.uuid, promise);
+  return promise;
+}
+
+async function doRefresh(
+  serverParams: Pick<ServerParameters, "uuid" | "name" | "url">,
+): Promise<RefreshResult> {
+  if (!serverParams.url) {
+    return { status: "no_session" };
+  }
+
+  const session = await oauthSessionsRepository.findByMcpServerUuid(
+    serverParams.uuid,
+  );
+  if (!session) {
+    return { status: "no_session" };
+  }
+
+  const currentTokens = session.tokens as
+    | (OAuthTokens & { refresh_token?: string })
+    | null;
+  if (!currentTokens?.refresh_token) {
+    return { status: "no_refresh_token" };
+  }
+
+  const clientInformation = session.client_information as Record<
+    string,
+    unknown
+  > | null;
+  const clientId =
+    clientInformation && typeof clientInformation.client_id === "string"
+      ? (clientInformation.client_id as string)
+      : null;
+  if (!clientId) {
+    return { status: "no_client_id" };
+  }
+  const clientSecret =
+    typeof clientInformation?.client_secret === "string"
+      ? (clientInformation.client_secret as string)
+      : undefined;
+
+  const discovered = await discoverAuthorizationServerMetadata(
+    serverParams.url,
+  );
+  const tokenEndpoint = resolveTokenEndpoint({
+    clientInformation,
+    discovered,
+    serverUrl: serverParams.url,
+  });
+  const authMethod = resolveTokenEndpointAuthMethod({
+    clientInformation,
+    discovered,
+    hasSecret: Boolean(clientSecret),
+  });
+
+  logger.info(
+    `[oauth] proxy 401 → refreshing tokens — server=${serverParams.uuid} ` +
+      `(${serverParams.name}) token_endpoint=${tokenEndpoint} ` +
+      `auth_method=${authMethod} ` +
+      `refresh_token=${redactToken(currentTokens.refresh_token)}`,
+  );
+
+  let newTokens: OAuthTokens;
+  try {
+    newTokens = await refreshAccessToken({
+      tokenEndpoint,
+      refreshToken: currentTokens.refresh_token,
+      clientId,
```

**File**: `apps/backend/src/lib/oauth-upstream/token-exchange.test.ts` (added, +486/-0)
```diff
@@ -0,0 +1,486 @@
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
+
+import {
+  discoverAuthorizationServerMetadata,
+  exchangeAuthorizationCode,
+  isUpstreamUnauthorizedError,
+  redactToken,
+  refreshAccessToken,
+  resolveTokenEndpoint,
+  resolveTokenEndpointAuthMethod,
+  UpstreamTokenError,
+} from "./token-exchange";
+
+type FetchImpl = typeof fetch;
+
+const jsonResponse = (status: number, body: unknown): Response =>
+  new Response(JSON.stringify(body), {
+    status,
+    headers: { "Content-Type": "application/json" },
+  });
+
+const textResponse = (status: number, body: string): Response =>
+  new Response(body, {
+    status,
+    headers: { "Content-Type": "text/plain" },
+  });
+
+describe("redactToken", () => {
+  it("returns <absent> for null/undefined", () => {
+    expect(redactToken(undefined)).toBe("<absent>");
+    expect(redactToken(null)).toBe("<absent>");
+  });
+  it("returns <short-redacted> for tokens 6 chars or fewer", () => {
+    expect(redactToken("abc")).toBe("<short-redacted>");
+    expect(redactToken("123456")).toBe("<short-redacted>");
+  });
+  it("keeps a short prefix and masks the rest", () => {
+    expect(redactToken("00D5g000xyzabcdef")).toBe("00D5g0***");
+  });
+});
+
+describe("exchangeAuthorizationCode", () => {
+  const baseInput = {
+    tokenEndpoint: "https://login.salesforce.com/services/oauth2/token",
+    code: "AUTH_CODE_FROM_REDIRECT",
+    codeVerifier: "VERIFIER_FROM_SESSION",
+    redirectUri: "https://metamcp.example.com/fe-oauth/callback",
+    clientId: "3MVG9.Salesforce",
+    authMethod: "none" as const,
+  };
+
+  it("POSTs the expected form-encoded body and persists tokens", async () => {
+    const fetchImpl = vi.fn<FetchImpl>(async (url, init) => {
+      expect(String(url)).toBe(baseInput.tokenEndpoint);
+      expect(init?.method).toBe("POST");
+      const body = init?.body as URLSearchParams;
+      expect(body.get("grant_type")).toBe("authorization_code");
+      expect(body.get("code")).toBe(baseInput.code);
+      expect(body.get("code_verifier")).toBe(baseInput.codeVerifier);
+      expect(body.get("redirect_uri")).toBe(baseInput.redirectUri);
+      expect(body.get("client_id")).toBe(baseInput.clientId);
+      const headers = init?.headers as Headers;
+      expect(headers.get("Content-Type")).toBe(
+        "application/x-www-form-urlencoded",
+      );
+      return jsonResponse(200, {
+        access_token: "AT_xyz",
+        token_type: "Bearer",
+        expires_in: 3600,
+        refresh_token: "RT_abc",
+        scope: "api refresh_token",
+      });
+    });
+
+    const tokens = await exchangeAuthorizationCode({ ...baseInput, fetchImpl });
+    expect(tokens.access_token).toBe("AT_xyz");
+    expect(tokens.token_type).toBe("Bearer");
+    expect(tokens.expires_in).toBe(3600);
+    expect(tokens.refresh_token).toBe("RT_abc");
+    expect(tokens.scope).toBe("api refresh_token");
+    expect(fetchImpl).toHaveBeenCalledOnce();
+  });
+
+  it("uses HTTP Basic auth for client_secret_basic", async () => {
+    const fetchImpl = vi.fn<FetchImpl>(async (_url, init) => {
+      const headers = init?.headers as Headers;
+      const auth = headers.get("Authorization");
+      expect(auth).toMatch(/^Basic /);
+      // base64("3MVG9.Salesforce:shh") -> M01WRzkuU2FsZXNmb3JjZTpzaGg=
+      const decoded = Buffer.from(
+        (auth ?? "").replace("Basic ", ""),
+        "base64",
+      ).toString("utf8");
+      expect(decoded).toBe("3MVG9.Salesforce:shh");
+      // client_secret must NOT be in the body when using Basic
+      const body = init?.body as URLSearchParams;
+      expect(body.get("client_secret")).toBeNull();
+      return jsonResponse(200, { access_token: "x", token_type: "Bearer" });
+    });
+
+    await exchangeAuthorizationCode({
+      ...baseInput,
+      authMethod: "client_secret_basic",
+      clientSecret: "shh",
+      fetchImpl,
+    });
+    expect(fetchImpl).toHaveBeenCalledOnce();
+  });
+
+  it("puts secret in body for client_secret_post", async () => {
+    const fetchImpl = vi.fn<FetchImpl>(async (_url, init) => {
+      const headers = init?.headers as Headers;
+      expect(headers.get("Authorization")).toBeNull();
+      const body = init?.body as URLSearchParams;
+      expect(body.get("client_id")).toBe(baseInput.clientId);
+      expect(body.get("client_secret")).toBe("shh");
+      return jsonResponse(200, { access_token: "x", token_type: "Bearer" });
+    });
+
+    await exchangeAuthorizationCode({
+      ...baseInput,
+      authMethod: "client_secret_post",
+      clientSecret: "shh",
+      fetchImpl,
+    });
+  });
+
+  it("throws UpstreamTokenError with parsed OAuth error envelope on 400", async () => {
+    const fetchImpl = vi.fn<FetchImpl>(async () =>
+      jsonResponse(400, {
+        error: "invalid_grant",
+        error_description: "authentication failure",
+      }),
+    );
+
+    const err = await exchangeAuthorizationCode({
+      ...baseInpu
```

**File**: `apps/backend/src/lib/oauth-upstream/token-exchange.ts` (added, +395/-0)
```diff
@@ -0,0 +1,395 @@
+// Server-side OAuth 2.0 authorization-code & refresh-token exchange.
+//
+// MetaMCP cannot run the token POST from the browser: most enterprise OAuth
+// providers (Salesforce, Okta, Auth0, Microsoft Entra, ServiceNow, ...) do
+// not set `Access-Control-Allow-Origin: *` on their token endpoints, so the
+// fetch succeeds upstream but the browser blocks the response body. This
+// module is the server-to-server replacement.
+//
+// This is *not* a generic CORS proxy. It only knows how to do RFC 6749
+// authorization-code and refresh-token grants against a token endpoint that
+// is known ahead of time (either from pre-registered client_information or
+// from discovery against the protected resource).
+
+import logger from "../../utils/logger";
+
+export type TokenEndpointAuthMethod =
+  | "none"
+  | "client_secret_basic"
+  | "client_secret_post";
+
+export interface OAuthTokens {
+  access_token: string;
+  token_type: string;
+  expires_in?: number;
+  scope?: string;
+  refresh_token?: string;
+  // Some providers (Salesforce, Microsoft) include additional fields like
+  // `id_token`, `instance_url`, `signature`, etc. We keep them via index
+  // signature so the jsonb round-trip preserves them.
+  [key: string]: unknown;
+}
+
+export interface UpstreamOAuthError {
+  error: string;
+  error_description?: string;
+  error_uri?: string;
+}
+
+export class UpstreamTokenError extends Error {
+  readonly status: number;
+  readonly oauthError: UpstreamOAuthError | null;
+
+  constructor(
+    status: number,
+    oauthError: UpstreamOAuthError | null,
+    message?: string,
+  ) {
+    super(
+      message ??
+        oauthError?.error_description ??
+        oauthError?.error ??
+        `Upstream returned HTTP ${status}`,
+    );
+    this.name = "UpstreamTokenError";
+    this.status = status;
+    this.oauthError = oauthError;
+  }
+}
+
+interface PostFormInput {
+  tokenEndpoint: string;
+  params: URLSearchParams;
+  authMethod: TokenEndpointAuthMethod;
+  clientId: string;
+  clientSecret?: string;
+  fetchImpl?: typeof fetch;
+}
+
+// Mask a token value for logs. Never log the full token.
+export function redactToken(token: string | undefined | null): string {
+  if (!token) return "<absent>";
+  if (token.length <= 6) return "<short-redacted>";
+  return `${token.slice(0, 6)}***`;
+}
+
+async function postFormToToken({
+  tokenEndpoint,
+  params,
+  authMethod,
+  clientId,
+  clientSecret,
+  fetchImpl,
+}: PostFormInput): Promise<OAuthTokens> {
+  const headers = new Headers({
+    "Content-Type": "application/x-www-form-urlencoded",
+    Accept: "application/json",
+  });
+
+  if (authMethod === "client_secret_basic") {
+    if (!clientSecret) {
+      throw new Error("client_secret_basic requires a client_secret");
+    }
+    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
+    headers.set("Authorization", `Basic ${basic}`);
+  } else if (authMethod === "client_secret_post") {
+    if (!clientSecret) {
+      throw new Error("client_secret_post requires a client_secret");
+    }
+    params.set("client_id", clientId);
+    params.set("client_secret", clientSecret);
+  } else {
+    // Public PKCE clients send client_id in the body and omit the secret.
+    params.set("client_id", clientId);
+  }
+
+  const doFetch = fetchImpl ?? fetch;
+  const response = await doFetch(tokenEndpoint, {
+    method: "POST",
+    headers,
+    body: params,
+  });
+
+  let payload: unknown;
+  try {
+    payload = await response.json();
+  } catch {
+    payload = null;
+  }
+
+  if (!response.ok) {
+    const oauthError =
+      payload &&
+      typeof payload === "object" &&
+      typeof (payload as { error?: unknown }).error === "string"
+        ? (payload as UpstreamOAuthError)
+        : null;
+    throw new UpstreamTokenError(response.status, oauthError);
+  }
+
+  if (!payload || typeof payload !== "object") {
+    throw new UpstreamTokenError(
+      response.status,
+      null,
+      "Upstream token endpoint returned a non-JSON 2xx response",
+    );
+  }
+  const tokens = payload as OAuthTokens;
+  if (
+    typeof tokens.access_token !== "string" ||
+    typeof tokens.token_type !== "string"
+  ) {
+    throw new UpstreamTokenError(
+      response.status,
+      null,
+      "Upstream token endpoint response missing access_token or token_type",
+    );
+  }
+
+  return tokens;
+}
+
+export interface ExchangeAuthorizationCodeInput {
+  tokenEndpoint: string;
+  code: string;
+  codeVerifier: string;
+  redirectUri: string;
+  clientId: string;
+  clientSecret?: string;
+  authMethod: TokenEndpointAuthMethod;
+  fetchImpl?: typeof fetch;
+}
+
+export async function exchangeAuthorizationCode(
+  input: ExchangeAuthorizationCodeInput,
+): Promise<OAuthTokens> {
+  const params = new URLSearchParams({
+    grant_type: "authorization_code",
+    code: input.code,
+    code_verifier: input.codeVerifier,
+    redirect_uri: input.redirectUri,
+  });

```

**File**: `apps/backend/src/trpc/mcp-servers.impl.test.ts` (added, +226/-0)
```diff
@@ -0,0 +1,226 @@
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
+
+import type { OAuthSessionsRepository } from "../db/repositories/oauth-sessions.repo";
+import {
+  buildPreRegisteredClientInformation,
+  persistPreRegisteredOAuthClient,
+  resolveRedirectUri,
+} from "./pre-registered-oauth";
+
+const REDIRECT_URI = "https://metamcp.example.com/fe-oauth/callback";
+
+describe("buildPreRegisteredClientInformation", () => {
+  it("returns null when client_id is missing", () => {
+    expect(
+      buildPreRegisteredClientInformation(
+        {
+          client_secret: "secret",
+          scope: "api",
+          authorization_endpoint: "https://example.com/authorize",
+        },
+        REDIRECT_URI,
+      ),
+    ).toBeNull();
+  });
+
+  it("returns null when client_id is whitespace-only", () => {
+    expect(
+      buildPreRegisteredClientInformation({ client_id: "   " }, REDIRECT_URI),
+    ).toBeNull();
+  });
+
+  it("builds a minimal public client when only client_id is provided", () => {
+    const result = buildPreRegisteredClientInformation(
+      { client_id: "3MVG9.Salesforce" },
+      REDIRECT_URI,
+    );
+
+    expect(result).toEqual({
+      client_id: "3MVG9.Salesforce",
+      redirect_uris: [REDIRECT_URI],
+      grant_types: ["authorization_code", "refresh_token"],
+      response_types: ["code"],
+      token_endpoint_auth_method: "none",
+    });
+  });
+
+  it("includes the secret, endpoints, and scope when supplied", () => {
+    const result = buildPreRegisteredClientInformation(
+      {
+        client_id: "3MVG9.Salesforce",
+        client_secret: "shhh",
+        scope: "api refresh_token",
+        authorization_endpoint:
+          "https://login.salesforce.com/services/oauth2/authorize",
+        token_endpoint: "https://login.salesforce.com/services/oauth2/token",
+        token_endpoint_auth_method: "client_secret_post",
+      },
+      REDIRECT_URI,
+    );
+
+    expect(result).toEqual({
+      client_id: "3MVG9.Salesforce",
+      client_secret: "shhh",
+      redirect_uris: [REDIRECT_URI],
+      grant_types: ["authorization_code", "refresh_token"],
+      response_types: ["code"],
+      token_endpoint_auth_method: "client_secret_post",
+      scope: "api refresh_token",
+      authorization_endpoint:
+        "https://login.salesforce.com/services/oauth2/authorize",
+      token_endpoint: "https://login.salesforce.com/services/oauth2/token",
+    });
+  });
+
+  it("trims whitespace from inputs", () => {
+    const result = buildPreRegisteredClientInformation(
+      {
+        client_id: "  trimmed-id  ",
+        scope: "  api  ",
+        authorization_endpoint: "  https://example.com/authorize  ",
+        token_endpoint: "  https://example.com/token  ",
+      },
+      REDIRECT_URI,
+    );
+
+    expect(result).toMatchObject({
+      client_id: "trimmed-id",
+      scope: "api",
+      authorization_endpoint: "https://example.com/authorize",
+      token_endpoint: "https://example.com/token",
+    });
+  });
+
+  it("never reflects the user's redirect_uri input — it is always MetaMCP's callback", () => {
+    const result = buildPreRegisteredClientInformation(
+      {
+        client_id: "3MVG9.Salesforce",
+      },
+      "https://different.metamcp.example.com/fe-oauth/callback",
+    );
+
+    expect(result?.redirect_uris).toEqual([
+      "https://different.metamcp.example.com/fe-oauth/callback",
+    ]);
+  });
+
+  it("omits client_secret when blank", () => {
+    const result = buildPreRegisteredClientInformation(
+      { client_id: "3MVG9", client_secret: "" },
+      REDIRECT_URI,
+    );
+
+    expect(result).not.toHaveProperty("client_secret");
+  });
+});
+
+describe("resolveRedirectUri", () => {
+  const original = process.env.APP_URL;
+  afterEach(() => {
+    process.env.APP_URL = original;
+  });
+
+  it("composes APP_URL + /fe-oauth/callback", () => {
+    process.env.APP_URL = "https://metamcp.example.com";
+    expect(resolveRedirectUri()).toBe(
+      "https://metamcp.example.com/fe-oauth/callback",
+    );
+  });
+
+  it("strips a trailing slash from APP_URL", () => {
+    process.env.APP_URL = "https://metamcp.example.com/";
+    expect(resolveRedirectUri()).toBe(
+      "https://metamcp.example.com/fe-oauth/callback",
+    );
+  });
+
+  it("throws when APP_URL is not set", () => {
+    delete process.env.APP_URL;
+    expect(() => resolveRedirectUri()).toThrow(/APP_URL/);
+  });
+});
+
+describe("persistPreRegisteredOAuthClient", () => {
+  const SERVER_UUID = "00000000-0000-0000-0000-000000000001";
+  const mockRepo = {
+    findByMcpServerUuid: vi.fn(),
+    create: vi.fn(),
+    update: vi.fn(),
+    upsert: vi.fn(),
+    deleteByMcpServerUuid: vi.fn(),
+  } as unknown as OAuthSessionsRepository & {
+    findByMcpServerUuid: ReturnType<typeof vi.fn>;
+    upsert: ReturnType<typeof vi.fn>;
+    deleteByMcpServerUuid: ReturnType<typeof vi.fn>;
+  };
+
+  beforeEach(() => {
+    process.env.APP
```

---

### Incident Patch 5: `e8e05390` (2026-06-15)
**Commit Message**: Merge pull request #303 from inspicere/fix-max-total-connections-env

fix(mcp-server-pool): read MAX_TOTAL_CONNECTIONS from env in getInstance

getInstance() was passing a hardcoded 100 as maxTotalConnections, which
overrode the constructor's env-based default (added by #273). Since the
constructor is private and only getInstance constructs the pool, the
MAX_TOTAL_CONNECTIONS env var never actually took effect.

Conflict resolution: combined #303's env-reading logic (with NaN / non-positive
guarding) with ai-dev's getInstance signature — passing the resolved maxConn as
maxTotalConnections while keeping the maxConnectionsPerServer argument (#260).

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `apps/backend/src/lib/metamcp/mcp-server-pool.ts` (modified, +3/-1)
```diff
@@ -85,9 +85,11 @@ export class McpServerPool {
     maxConnectionsPerServer: number = 5,
   ): McpServerPool {
     if (!McpServerPool.instance) {
+      const envMax = parseInt(process.env.MAX_TOTAL_CONNECTIONS || "", 10);
+      const maxConn = Number.isFinite(envMax) && envMax > 0 ? envMax : 100;
       McpServerPool.instance = new McpServerPool(
         defaultIdleCount,
-        100,
+        maxConn,
         maxConnectionsPerServer,
       );
     }
```

---

### Incident Patch 6: `5f868084` (2026-06-14)
**Commit Message**: fix(db): journal the orphaned oauth refresh-token migration from #276

#276 hand-wrote drizzle/0014_oauth_refresh_token.sql but never ran
`drizzle-kit generate`, so there was no meta/0014_snapshot.json and no
_journal.json entry. Because docker-entrypoint.sh applies migrations via
`drizzle-kit migrate` (journal-driven), the un-journaled 0014 was silently
never applied — the refresh_token / refresh_token_expires_at columns would be
missing at runtime and the OAuth refresh-token grant (#276) would fail.

Regenerated 0014 from schema.ts so it now has a proper journal entry (idx 14)
and snapshot. SQL is identical to the hand-written version (drizzle emits
CREATE INDEX without IF NOT EXISTS). This also establishes a correct snapshot
baseline so subsequent migrations can be regenerated cleanly.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `apps/backend/drizzle/0014_oauth_refresh_token.sql` (modified, +1/-1)
```diff
@@ -1,3 +1,3 @@
 ALTER TABLE "oauth_access_tokens" ADD COLUMN "refresh_token" text;--> statement-breakpoint
 ALTER TABLE "oauth_access_tokens" ADD COLUMN "refresh_token_expires_at" timestamp with time zone;--> statement-breakpoint
-CREATE INDEX IF NOT EXISTS "oauth_access_tokens_refresh_token_idx" ON "oauth_access_tokens" USING btree ("refresh_token");
+CREATE INDEX "oauth_access_tokens_refresh_token_idx" ON "oauth_access_tokens" USING btree ("refresh_token");
\ No newline at end of file
```

**File**: `apps/backend/drizzle/meta/0014_snapshot.json` (added, +1908/-0)
```diff
@@ -0,0 +1,1908 @@
+{
+  "id": "f8808a0a-e12f-4c80-9666-1b3bfb98308e",
+  "prevId": "06d6c80e-47a8-4720-ba08-ec60b13f1098",
+  "version": "7",
+  "dialect": "postgresql",
+  "tables": {
+    "public.accounts": {
+      "name": "accounts",
+      "schema": "",
+      "columns": {
+        "id": {
+          "name": "id",
+          "type": "text",
+          "primaryKey": true,
+          "notNull": true
+        },
+        "account_id": {
+          "name": "account_id",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "provider_id": {
+          "name": "provider_id",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "user_id": {
+          "name": "user_id",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "access_token": {
+          "name": "access_token",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "refresh_token": {
+          "name": "refresh_token",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "id_token": {
+          "name": "id_token",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "access_token_expires_at": {
+          "name": "access_token_expires_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "refresh_token_expires_at": {
+          "name": "refresh_token_expires_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "scope": {
+          "name": "scope",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "password": {
+          "name": "password",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "created_at": {
+          "name": "created_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true,
+          "default": "now()"
+        },
+        "updated_at": {
+          "name": "updated_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true,
+          "default": "now()"
+        }
+      },
+      "indexes": {},
+      "foreignKeys": {
+        "accounts_user_id_users_id_fk": {
+          "name": "accounts_user_id_users_id_fk",
+          "tableFrom": "accounts",
+          "tableTo": "users",
+          "columnsFrom": [
+            "user_id"
+          ],
+          "columnsTo": [
+            "id"
+          ],
+          "onDelete": "cascade",
+          "onUpdate": "no action"
+        }
+      },
+      "compositePrimaryKeys": {},
+      "uniqueConstraints": {},
+      "policies": {},
+      "checkConstraints": {},
+      "isRLSEnabled": false
+    },
+    "public.api_keys": {
+      "name": "api_keys",
+      "schema": "",
+      "columns": {
+        "uuid": {
+          "name": "uuid",
+          "type": "uuid",
+          "primaryKey": true,
+          "notNull": true,
+          "default": "gen_random_uuid()"
+        },
+        "name": {
+          "name": "name",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "key": {
+          "name": "key",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "user_id": {
+          "name": "user_id",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "created_at": {
+          "name": "created_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true,
+          "default": "now()"
+        },
+        "is_active": {
+          "name": "is_active",
+          "type": "boolean",
+          "primaryKey": false,
+          "notNull": true,
+          "default": true
+        }
+      },
+      "indexes": {
+        "api_keys_user_id_idx": {
+          "name": "api_keys_user_id_idx",
+          "columns": [
+            {
+              "expression": "user_id",
+              "isExpression": false,
+              "asc": true,
+              "nulls": "last"
+            }
+          ],
+          "isUnique": false,
+          "concurrently": false,
+          "method": "btree",
+          "with": {}
+        },
+        "api_keys_key_idx": {
+          "name": "api_keys_key_idx",
+          "columns": [
+            {
+              "expression": "key",
+              "isExpression": false,
+              "asc": true,
+              "nulls": "last"
+            }
+          ],
+          "isUnique": false,
+          "concurrently": false,
+          "method": "btree",
+          "with"
```

**File**: `apps/backend/drizzle/meta/_journal.json` (modified, +7/-0)
```diff
@@ -99,6 +99,13 @@
       "when": 1766064780578,
       "tag": "0013_late_lilith",
       "breakpoints": true
+    },
+    {
+      "idx": 14,
+      "version": "7",
+      "when": 1781435153166,
+      "tag": "0014_oauth_refresh_token",
+      "breakpoints": true
     }
   ]
 }
\ No newline at end of file
```

---

### Incident Patch 7: `19e6b1ff` (2026-06-14)
**Commit Message**: Merge pull request #310 from Exploitacious/fix/list-handler-recovery

fix(proxy): invalidate-and-retry recovery in the aggregate list handlers

Extends the session-recovery pattern (previously only on the tools/call
handler from #283) to the four aggregate list handlers (tools/list,
prompts/list, resources/list, resources/templates/list) via a new
requestWithSessionRecovery() helper, using #293's isRecoverableBackendError
(session-lost OR transport-lost).

Conflict resolution: git auto-merged without markers but that silently
produced a DUPLICATE invalidateServerConnection() (one from #283 already on
ai-dev, one from #310). Kept #310's version — it cascades invalidation
across every session slot for the serverUuid (not just the triggering
session) and uses logger instead of console — and deleted #283's narrower
duplicate. Signatures are identical so all callers are unaffected. The
tools/call handler keeps its existing inline #283 recovery.

session-error.ts/.test.ts were already current from the #293 merge.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `apps/backend/src/lib/metamcp/list-handler-recovery.test.ts` (added, +150/-0)
```diff
@@ -0,0 +1,150 @@
+import { ServerParameters } from "@repo/zod-types";
+import { describe, expect, it, vi } from "vitest";
+
+import { ConnectedClient } from "./client";
+import {
+  RecoverySessionPool,
+  requestWithSessionRecovery,
+} from "./list-handler-recovery";
+
+// The exact envelope shape the backend produces when its session died
+// (matches session-error.test.ts fixtures). isRecoverableBackendError
+// must classify it as recoverable.
+const sessionLostError = () =>
+  new Error(
+    'Error POSTing to endpoint (HTTP 404): {"jsonrpc":"2.0","id":"server-error","error":{"code":-32600,"message":"Session not found"}}',
+  );
+
+const transportLostError = () => new Error("Not connected");
+
+const makeSession = (label: string): ConnectedClient =>
+  ({ label }) as unknown as ConnectedClient;
+
+const params = { uuid: "server-1", name: "test-server" } as ServerParameters;
+
+const makePool = (freshSession: ConnectedClient | undefined) => {
+  const pool: RecoverySessionPool = {
+    invalidateServerConnection: vi.fn().mockResolvedValue(undefined),
+    getSession: vi.fn().mockResolvedValue(freshSession),
+  };
+  return pool;
+};
+
+const baseOpts = (pool: RecoverySessionPool, session: ConnectedClient) => ({
+  pool,
+  sessionId: "session-abc",
+  serverUuid: "server-1",
+  params,
+  namespaceUuid: "ns-1",
+  operation: "tools/list",
+  serverName: "test-server",
+  session,
+});
+
+describe("requestWithSessionRecovery", () => {
+  it("returns the first attempt's result without touching the pool", async () => {
+    const session = makeSession("stale");
+    const pool = makePool(undefined);
+    const attempt = vi.fn().mockResolvedValue(["tool-a"]);
+
+    const result = await requestWithSessionRecovery({
+      ...baseOpts(pool, session),
+      attempt,
+    });
+
+    expect(result).toEqual(["tool-a"]);
+    expect(attempt).toHaveBeenCalledTimes(1);
+    expect(attempt).toHaveBeenCalledWith(session);
+    expect(pool.invalidateServerConnection).not.toHaveBeenCalled();
+    expect(pool.getSession).not.toHaveBeenCalled();
+  });
+
+  it("invalidates, re-acquires, and retries once on a session-lost envelope", async () => {
+    const stale = makeSession("stale");
+    const fresh = makeSession("fresh");
+    const pool = makePool(fresh);
+    const attempt = vi
+      .fn()
+      .mockRejectedValueOnce(sessionLostError())
+      .mockResolvedValueOnce(["tool-b"]);
+    const onFreshSession = vi.fn();
+
+    const result = await requestWithSessionRecovery({
+      ...baseOpts(pool, stale),
+      attempt,
+      onFreshSession,
+    });
+
+    expect(result).toEqual(["tool-b"]);
+    expect(pool.invalidateServerConnection).toHaveBeenCalledWith(
+      "session-abc",
+      "server-1",
+    );
+    expect(pool.getSession).toHaveBeenCalledWith(
+      "session-abc",
+      "server-1",
+      params,
+      "ns-1",
+    );
+    expect(onFreshSession).toHaveBeenCalledWith(fresh);
+    expect(attempt).toHaveBeenNthCalledWith(1, stale);
+    expect(attempt).toHaveBeenNthCalledWith(2, fresh);
+  });
+
+  it("recovers from the SDK transport-lost envelope too", async () => {
+    const stale = makeSession("stale");
+    const fresh = makeSession("fresh");
+    const pool = makePool(fresh);
+    const attempt = vi
+      .fn()
+      .mockRejectedValueOnce(transportLostError())
+      .mockResolvedValueOnce("ok");
+
+    await expect(
+      requestWithSessionRecovery({ ...baseOpts(pool, stale), attempt }),
+    ).resolves.toBe("ok");
+    expect(pool.invalidateServerConnection).toHaveBeenCalledTimes(1);
+  });
+
+  it("rethrows non-recoverable errors without invalidating the pool", async () => {
+    const session = makeSession("stale");
+    const pool = makePool(undefined);
+    const boom = new Error("schema validation failed");
+    const attempt = vi.fn().mockRejectedValue(boom);
+
+    await expect(
+      requestWithSessionRecovery({ ...baseOpts(pool, session), attempt }),
+    ).rejects.toBe(boom);
+    expect(pool.invalidateServerConnection).not.toHaveBeenCalled();
+    expect(attempt).toHaveBeenCalledTimes(1);
+  });
+
+  it("throws a re-init error when no fresh session can be established", async () => {
+    const session = makeSession("stale");
+    const pool = makePool(undefined);
+    const attempt = vi.fn().mockRejectedValue(sessionLostError());
+
+    await expect(
+      requestWithSessionRecovery({ ...baseOpts(pool, session), attempt }),
+    ).rejects.toThrow(
+      /Failed to re-initialize session for server server-1 .* tools\/list/,
+    );
+    expect(attempt).toHaveBeenCalledTimes(1);
+  });
+
+  it("propagates the retry's failure when the fresh session also fails", async () => {
+    const stale = makeSession("stale");
+    const fresh = makeSession("fresh");
+    const pool = makePool(fresh);
+    const secondFailure = new Error("backend exploded after reconnect");
+    const attempt = vi
+      .fn()
+      .mockRejectedValueOnce(sessionLostError())
+      .mockRejectedValueOnc
```

**File**: `apps/backend/src/lib/metamcp/list-handler-recovery.ts` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+import { ServerParameters } from "@repo/zod-types";
+
+import logger from "@/utils/logger";
+
+import { ConnectedClient } from "./client";
+import { isRecoverableBackendError } from "./session-error";
+
+/**
+ * Minimal slice of McpServerPool the recovery wrapper needs. Structural
+ * so tests can drive the wrapper with a fake pool.
+ */
+export interface RecoverySessionPool {
+  invalidateServerConnection(
+    sessionId: string,
+    serverUuid: string,
+  ): Promise<void>;
+  getSession(
+    sessionId: string,
+    serverUuid: string,
+    params: ServerParameters,
+    namespaceUuid?: string,
+  ): Promise<ConnectedClient | undefined>;
+}
+
+export interface RequestWithSessionRecoveryOptions<T> {
+  pool: RecoverySessionPool;
+  sessionId: string;
+  serverUuid: string;
+  params: ServerParameters;
+  namespaceUuid?: string;
+  /** Operation label for log lines, e.g. "tools/list". */
+  operation: string;
+  /** Human-readable server name for log lines. */
+  serverName: string;
+  /** The (possibly stale) pooled session the caller already holds. */
+  session: ConnectedClient;
+  /**
+   * The actual backend request(s). Re-invoked exactly once on a fresh
+   * session if the first invocation fails with a recoverable backend
+   * error (session-lost / transport-lost envelope).
+   */
+  attempt: (session: ConnectedClient) => Promise<T>;
+  /**
+   * Called when recovery swapped in a fresh session — lets the caller
+   * repoint tool/prompt/resource maps to the new client.
+   */
+  onFreshSession?: (session: ConnectedClient) => void;
+}
+
+/**
+ * Invalidate-and-retry-once recovery cascade for the per-server fetch
+ * inside the aggregate list handlers (tools/list, prompts/list,
+ * resources/list, resources/templates/list).
+ *
+ * The aggregate list handlers previously logged-and-continued in their
+ * catch blocks, so a dead pooled session (e.g. after a restart of the
+ * backend container) made the namespace return a "successful" 0-tool
+ * response on every request, forever — the swallowed error meant the
+ * zombie connection was never invalidated.
+ *
+ * Throws when the error is non-recoverable, when no fresh session could
+ * be established, or when the retry on the fresh session fails — the
+ * caller decides whether that excludes one server from an aggregate
+ * response (and tracks it as degraded) or fails the request.
+ */
+export async function requestWithSessionRecovery<T>(
+  opts: RequestWithSessionRecoveryOptions<T>,
+): Promise<T> {
+  try {
+    return await opts.attempt(opts.session);
+  } catch (error) {
+    if (!isRecoverableBackendError(error)) {
+      throw error;
+    }
+
+    logger.warn(
+      `Backend connection lost for server ${opts.serverUuid} (${opts.serverName}) on ${opts.operation}; invalidating pool and retrying once. (envelope: ${
+        error instanceof Error ? error.message : String(error)
+      })`,
+    );
+
+    await opts.pool.invalidateServerConnection(opts.sessionId, opts.serverUuid);
+
+    const fresh = await opts.pool.getSession(
+      opts.sessionId,
+      opts.serverUuid,
+      opts.params,
+      opts.namespaceUuid,
+    );
+    if (!fresh) {
+      throw new Error(
+        `Failed to re-initialize session for server ${opts.serverUuid} after backend session loss during ${opts.operation}`,
+      );
+    }
+
+    opts.onFreshSession?.(fresh);
+    return await opts.attempt(fresh);
+  }
+}
```

**File**: `apps/backend/src/lib/metamcp/mcp-server-pool.ts` (modified, +85/-50)
```diff
@@ -643,6 +643,91 @@ export class McpServerPool {
     this.backgroundIdleSessionsByNamespace.set(namespaceUuid, options);
   }
 
+  /**
+   * Drop the pooled backend connection(s) for a given serverUuid.
+   *
+   * Used when a backend MCP server reports our Mcp-Session-Id is unknown
+   * or our transport is dead (e.g. after the backend container restarts and
+   * loses its in-memory session registry, or a Watchtower swap kills the
+   * socket). No replacement is created here; the next `getSession` call
+   * establishes a fresh connection (and therefore a fresh backend session)
+   * on demand.
+   *
+   * The invalidation CASCADES across every session's slot for the affected
+   * serverUuid, not just the triggering session's slot, plus the idle slot.
+   * When a backend container restarts, EVERY cached ConnectedClient for that
+   * serverUuid is dead — stale clients left in sibling sessions' slots for
+   * the same backend would defeat a single-slot invalidation: a later
+   * `getSession` for one of those siblings would hand back a dead client and
+   * the retry would fail with the same envelope that triggered recovery. So
+   * we drop them all.
+   */
+  async invalidateServerConnection(
+    sessionId: string,
+    serverUuid: string,
+  ): Promise<void> {
+    // Collect every doomed ConnectedClient across all active sessions plus
+    // the idle slot, dropping the map entries as we go.
+    const cleanupPromises: Promise<void>[] = [];
+
+    for (const [sid, sessionServers] of Object.entries(this.activeSessions)) {
+      const cachedClient = sessionServers[serverUuid];
+      if (!cachedClient) {
+        continue;
+      }
+      // Each cleanup is wrapped so one failure can't strand the rest — we
+      // WANT every stale slot dropped from the map regardless.
+      cleanupPromises.push(
+        (async () => {
+          try {
+            await cachedClient.cleanup();
+          } catch (error) {
+            logger.error(
+              `Error cleaning up invalidated active session ${sid}/${serverUuid}:`,
+              error,
+            );
+          }
+        })(),
+      );
+      delete sessionServers[serverUuid];
+      this.sessionToServers[sid]?.delete(serverUuid);
+    }
+
+    const idleClient = this.idleSessions[serverUuid];
+    if (idleClient) {
+      cleanupPromises.push(
+        (async () => {
+          try {
+            await idleClient.cleanup();
+          } catch (error) {
+            logger.error(
+              `Error cleaning up invalidated idle session for ${serverUuid}:`,
+              error,
+            );
+          }
+        })(),
+      );
+      delete this.idleSessions[serverUuid];
+    }
+
+    // Drop the in-flight idle-creation guard so the recovery's getSession
+    // call isn't blocked from spawning a fresh connection.
+    this.creatingIdleSessions.delete(serverUuid);
+
+    await Promise.all(cleanupPromises);
+
+    if (cleanupPromises.length > 0) {
+      logger.warn(
+        `Invalidated ${cleanupPromises.length} pooled backend connection(s) for server ${serverUuid} ` +
+          `(triggered by session ${sessionId}; cascaded across every active + idle slot for this serverUuid)`,
+      );
+    } else {
+      logger.warn(
+        `Invalidated pooled backend connection for server ${serverUuid} (session ${sessionId}) — no clients were cached`,
+      );
+    }
+  }
+
   /**
    * Invalidate and refresh idle session for a specific server
    * This should be called when a server's parameters (command, args, etc.) change
@@ -757,56 +842,6 @@ export class McpServerPool {
     }
   }
 
-  /**
-   * Drop the pooled backend connection(s) for a given (sessionId, serverUuid).
-   *
-   * Used when the backend MCP server reports our Mcp-Session-Id is unknown
-   * (e.g. after the backend container restarts and loses its in-memory session
-   * registry). Both the active session and the paired idle session share the
-   * backend's session registry, so both are closed — if the backend forgot
-   * the active session, it has forgotten the idle one too. No replacement is
-   * created here; the next `getSession` call will establish a fresh
-   * connection (and therefore a fresh backend session) on demand.
-   */
-  async invalidateServerConnection(
-    sessionId: string,
-    serverUuid: string,
-  ): Promise<void> {
-    const activeForSession = this.activeSessions[sessionId];
-    const activeClient = activeForSession?.[serverUuid];
-    if (activeClient) {
-      try {
-        await activeClient.cleanup();
-      } catch (error) {
-        console.error(
-          `Error cleaning up invalidated active session ${sessionId}/${serverUuid}:`,
-          error,
-        );
-      }
-      delete activeForSession[serverUuid];
-      this.sessionToServers[sessionId]?.delete(serverUuid);
-    }
-
-    const idleClient = this.idleSessions[serverUuid];
-    if (idleClient) {
-      try {
-        await idleClient.cleanup();
-      } catch (error) 
```

**File**: `apps/backend/src/lib/metamcp/metamcp-proxy.ts` (modified, +192/-54)
```diff
@@ -28,6 +28,7 @@ import { toolsImplementations } from "../../trpc/tools.impl";
 import { configService } from "../config.service";
 import { ConnectedClient } from "./client";
 import { getMcpServers } from "./fetch-metamcp";
+import { requestWithSessionRecovery } from "./list-handler-recovery";
 import { mcpServerPool } from "./mcp-server-pool";
 import {
   createFilterCallToolMiddleware,
@@ -162,6 +163,12 @@ export const createServer = async (
     );
     const allTools: Tool[] = [];
 
+    // Servers that should have contributed tools but failed even after the
+    // recovery retry (or had no session at all). Drives the degraded-response
+    // tripwire after the fan-out — a swallowed failure returns a "successful"
+    // 0-tool namespace and nobody notices until a manual restart.
+    const failedServers: string[] = [];
+
     // Track visited servers to detect circular references - reset on each call
     const visitedServers = new Set<string>();
 
@@ -213,6 +220,14 @@ export const createServer = async (
         );
         if (!session) {
           console.log(`[DEBUG-TOOLS] ❌ No session for: ${params.name}`);
+          // No pooled session and the pool couldn't create one — server is
+          // ERROR-gated, connection-capped, or unreachable. Error level: this
+          // server is silently missing from the namespace's tool surface
+          // until the pool recovers.
+          logger.error(
+            `tools/list: no session available for server ${params.name || mcpServerUuid} — excluded from namespace response (error state, connection cap, or backend unreachable)`,
+          );
+          failedServers.push(params.name || mcpServerUuid);
           return;
         }
 
@@ -244,32 +259,58 @@ export const createServer = async (
           params.name || session.client.getServerVersion()?.name || "";
 
         try {
-          // Paginated tool discovery - load all pages automatically
-          const allServerTools: Tool[] = [];
-          let cursor: string | undefined = undefined;
-          let hasMore = true;
           const toolFetchStart = performance.now();
 
-          while (hasMore) {
-            const result: z.infer<typeof ListToolsResultSchema> =
-              await session.client.request(
-                {
-                  method: "tools/list",
-                  params: {
-                    cursor: cursor,
-                    _meta: request.params?._meta,
+          // Paginated tool discovery - load all pages automatically
+          const fetchAllToolPages = async (
+            active: ConnectedClient,
+          ): Promise<Tool[]> => {
+            const pages: Tool[] = [];
+            let cursor: string | undefined = undefined;
+            let hasMore = true;
+
+            while (hasMore) {
+              const result: z.infer<typeof ListToolsResultSchema> =
+                await active.client.request(
+                  {
+                    method: "tools/list",
+                    params: {
+                      cursor: cursor,
+                      _meta: request.params?._meta,
+                    },
                   },
-                },
-                ListToolsResultSchema,
-              );
+                  ListToolsResultSchema,
+                );
+
+              if (result.tools && result.tools.length > 0) {
+                pages.push(...result.tools);
+              }
 
-            if (result.tools && result.tools.length > 0) {
-              allServerTools.push(...result.tools);
+              cursor = result.nextCursor;
+              hasMore = !!result.nextCursor;
             }
 
-            cursor = result.nextCursor;
-            hasMore = !!result.nextCursor;
-          }
+            return pages;
+          };
+
+          // Invalidate-and-retry-once on session-lost / transport-lost.
+          // Without it a dead pooled session is never evicted from here and
+          // the namespace serves 0 tools as "success" until a manual restart.
+          let activeSession = session;
+          const allServerTools = await requestWithSessionRecovery({
+            pool: mcpServerPool,
+            sessionId: context.sessionId,
+            serverUuid: mcpServerUuid,
+            params,
+            namespaceUuid,
+            operation: "tools/list",
+            serverName,
+            session,
+            attempt: fetchAllToolPages,
+            onFreshSession: (fresh) => {
+              activeSession = fresh;
+            },
+          });
 
           console.log(
             `[DEBUG-TOOLS] ⏱️  Fetched ${allServerTools.length} tools from ${serverName} in ${(performance.now() - toolFetchStart).toFixed(2)}ms`,
@@ -318,7 +359,7 @@ export const createServer = async (
           // Use original tools for client response (middleware will be applied later)
           const toolsWithSource = allServerTools.map((tool) => {
             const toolName = `${sanitizeName(serverName)}__${tool.name}`;
-            toolToCl
```

**File**: `apps/backend/vitest.config.ts` (modified, +10/-0)
```diff
@@ -1,6 +1,16 @@
+import path from "node:path";
+
 import { defineConfig } from "vitest/config";
 
 export default defineConfig({
+  resolve: {
+    alias: {
+      // Mirror the tsconfig.json `paths` mapping so unit tests can
+      // import modules that use the `@/` prefix without each test
+      // having to hand-mock every transitive logger / utils import.
+      "@": path.resolve(__dirname, "./src"),
+    },
+  },
   test: {
     globals: true,
     environment: "node",
```

---

### Incident Patch 8: `b73829dd` (2026-06-14)
**Commit Message**: Merge pull request #293 from Exploitacious/fix/session-recovery-detectors

fix(session): hardened session-lost + transport-lost recovery detectors

Resolved add/add conflict in session-error.ts / session-error.test.ts by
adopting #293's hardened implementation wholesale. It is a superset of the
naive isBackendSessionLostError() that #283 added: same 404 / "Session not
found" / -32001 / -32600 matching, plus .cause-chain walking (depth 8),
object/string throwable handling, and numeric/string .code inspection.

Also adds isBackendTransportLostError() (-32603 "Not connected") and the
combined isRecoverableBackendError(). These new detectors are additive and
will be wired into the proxy retry paths by the stacked PR #310.

The existing tools/call callsite in metamcp-proxy.ts keeps using
isBackendSessionLostError() with identical (now hardened) behavior.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `apps/backend/src/lib/metamcp/session-error.test.ts` (modified, +195/-3)
```diff
@@ -1,6 +1,10 @@
 import { describe, expect, it } from "vitest";
 
-import { isBackendSessionLostError } from "./session-error";
+import {
+  isBackendSessionLostError,
+  isBackendTransportLostError,
+  isRecoverableBackendError,
+} from "./session-error";
 
 describe("isBackendSessionLostError", () => {
   it("matches the HTTP 404 + JSON-RPC -32600 envelope the SDK produces", () => {
@@ -22,14 +26,202 @@ describe("isBackendSessionLostError", () => {
     expect(isBackendSessionLostError(error)).toBe(false);
   });
 
-  it("does not match transport disconnects", () => {
+  it("does not match transport disconnects (transport-lost detector handles those)", () => {
     const error = new Error("Not connected");
     expect(isBackendSessionLostError(error)).toBe(false);
   });
 
-  it("returns false for non-Error inputs", () => {
+  it("returns false for null / undefined", () => {
     expect(isBackendSessionLostError(undefined)).toBe(false);
     expect(isBackendSessionLostError(null)).toBe(false);
+  });
+
+  it("returns false for unrelated strings", () => {
     expect(isBackendSessionLostError("Session not found")).toBe(false);
+    expect(isBackendSessionLostError("HTTP 404")).toBe(false);
+    expect(isBackendSessionLostError("random text")).toBe(false);
+  });
+
+  it("matches a string throwable carrying the full envelope", () => {
+    const message =
+      'Error POSTing to endpoint (HTTP 404): {"jsonrpc":"2.0","error":{"code":-32600,"message":"Session not found"}}';
+    expect(isBackendSessionLostError(message)).toBe(true);
+  });
+
+  it("matches when the session-lost error is wrapped via .cause", () => {
+    const inner = new Error(
+      'Error POSTing to endpoint (HTTP 404): {"jsonrpc":"2.0","error":{"code":-32600,"message":"Session not found"}}',
+    );
+    const outer = new Error("Failed to dispatch tool call", { cause: inner });
+    expect(isBackendSessionLostError(outer)).toBe(true);
+  });
+
+  it("matches when wrapped two layers deep via .cause", () => {
+    const innermost = new Error(
+      'Error POSTing to endpoint (HTTP 404): {"jsonrpc":"2.0","error":{"code":-32001,"message":"Session not found"}}',
+    );
+    const mid = new Error("Transport rejection", { cause: innermost });
+    const outer = new Error("Outer wrap", { cause: mid });
+    expect(isBackendSessionLostError(outer)).toBe(true);
+  });
+
+  it("matches a JSON-RPC error envelope passed as a plain object", () => {
+    // Some rejection paths surface the parsed RPC error envelope directly
+    // rather than the SDK's wrapped Error. The detector inspects the
+    // structured payload as well as the rendered message.
+    const envelope = {
+      jsonrpc: "2.0",
+      id: "server-error",
+      error: { code: -32600, message: "Session not found" },
+    };
+    expect(isBackendSessionLostError(envelope)).toBe(true);
+  });
+
+  it("matches an Error whose .code carries -32001 even when the message is sparse", () => {
+    const error = Object.assign(new Error("Session not found"), {
+      code: -32001,
+    });
+    expect(isBackendSessionLostError(error)).toBe(true);
+  });
+
+  it("falls back to String(error) for objects with only toString()", () => {
+    class CustomThrowable {
+      toString() {
+        return 'Error POSTing to endpoint (HTTP 404): {"error":{"code":-32600,"message":"Session not found"}}';
+      }
+    }
+    expect(isBackendSessionLostError(new CustomThrowable())).toBe(true);
+  });
+
+  it("does not match objects with unrelated -32600 contexts", () => {
+    // -32600 alone (without 'Session not found') is the JSON-RPC "Invalid
+    // Request" code and means many things. Don't false-positive on it.
+    const error = new Error("MCP error -32600: Invalid Request");
+    expect(isBackendSessionLostError(error)).toBe(false);
+  });
+
+  it("handles circular cause chains without infinite-looping", () => {
+    const a = new Error("Wrapper a") as Error & { cause?: unknown };
+    const b = new Error("Wrapper b") as Error & { cause?: unknown };
+    a.cause = b;
+    b.cause = a;
+    expect(isBackendSessionLostError(a)).toBe(false);
+  });
+});
+
+describe("isBackendTransportLostError", () => {
+  it("matches the bare SDK 'Not connected' Error", () => {
+    // Protocol.request() in the MCP TS SDK rejects with exactly this
+    // message when the underlying transport has been torn down.
+    const error = new Error("Not connected");
+    expect(isBackendTransportLostError(error)).toBe(true);
+  });
+
+  it("matches a 'Not connected' string throwable", () => {
+    expect(isBackendTransportLostError("Not connected")).toBe(true);
+  });
+
+  it("matches the consumer-side -32603 envelope MetaMCP returns to Claude.ai / n8n", () => {
+    // Production observation 2026-05-14: consumer-side connectors see
+    // the tRPC bridge's wrapped envelope rather than the raw SDK Error.
+    const envelope = {
+      jsonrpc: "2.0",
+      id: "server-error",
+      error: { code: -32603, message: "Not c
```

**File**: `apps/backend/src/lib/metamcp/session-error.ts` (modified, +270/-12)
```diff
@@ -12,21 +12,279 @@
  *   Error POSTing to endpoint (HTTP 404):
  *   {"jsonrpc":"2.0","id":"server-error","error":{"code":-32600,"message":"Session not found"}}
  *
- * When this happens, the cached backend connection is dead: MetaMCP must drop
+ * Production observation 2026-05-08: in some flows the SDK error reaches us
+ * wrapped (e.g. via `.cause` from a higher-layer handler, or stringified
+ * after passing through a non-Error rejection). The simple
+ * `error.message.includes(...)` check missed all 138 events emitted between
+ * a backend container restart and a manual MetaMCP restart, even though the
+ * rendered string clearly contained all three matched substrings. To prevent
+ * that gap from re-opening on the next backend deploy, this detector now:
+ *
+ *   1. Walks the `.cause` chain on Error inputs (max depth 8).
+ *   2. Falls back to `String(error)` for non-Error throwables (some SDK
+ *      paths reject with plain objects, McpError wrappers, or strings).
+ *   3. Inspects a numeric/string `.code` field on object inputs (some
+ *      RPC layers strip the message but preserve the code).
+ *
+ * When this fires, the cached backend connection is dead: MetaMCP must drop
  * it, send a new `initialize`, and replay the failed request. The MCP spec
- * states the client MUST start a new session in response to HTTP 404, so this
- * is the normative recovery path, not a workaround.
+ * states the client MUST start a new session in response to HTTP 404, so
+ * this is the normative recovery path, not a workaround.
  */
-export function isBackendSessionLostError(error: unknown): boolean {
-  if (!(error instanceof Error) || !error.message) {
-    return false;
-  }
-  const message = error.message;
-  const mentionsSessionNotFound = message.includes("Session not found");
-  const mentionsHttp404 = message.includes("HTTP 404");
-  const mentionsSessionErrorCode =
-    message.includes("-32001") || message.includes("-32600");
+
+const SESSION_NOT_FOUND = "Session not found";
+const HTTP_404 = "HTTP 404";
+const RPC_CODE_PATTERNS = ["-32001", "-32600"];
+const MAX_CAUSE_DEPTH = 8;
+
+// Transport-disconnect signal raised by the MCP TypeScript SDK's Protocol
+// class when a request is dispatched on a transport that has already been
+// torn down. Produced verbatim ("Not connected") whenever the cached
+// ConnectedClient's underlying StreamableHTTPClientTransport has been
+// closed — either because the backend MCP container restarted (Watchtower
+// image pull, manual `docker restart`, OOM kill) or because the SDK's
+// session manager half-closed the stream after an idle / error condition.
+//
+// Distinct from "Session not found": the session-not-found path means the
+// backend rejected the request because its session registry doesn't know
+// our Mcp-Session-Id (recoverable by sending a new `initialize`). The
+// "Not connected" path means our local transport has no live stream to
+// send anything on (recoverable by invalidating the pool entry, opening
+// a fresh transport, and re-initializing). Both end up at the same
+// recovery action — invalidate + reconnect + retry — but the error
+// envelopes are textually disjoint, so they need separate detectors.
+const NOT_CONNECTED = "Not connected";
+// JSON-RPC code -32603 = "Internal error". MetaMCP's tRPC bridge wraps
+// the SDK-thrown "Not connected" rejection into this envelope before it
+// reaches the consumer (Claude.ai connector, n8n httpRequest node, etc.).
+// Production observation 2026-05-14: consumer-side connectors see
+// `-32603 "Not connected"` rather than the raw SDK Error, and the
+// session-lost detector misses it. Pair the code with the
+// "Not connected" message so we don't false-positive on every -32603
+// from unrelated internal-error paths.
+const RPC_CODE_TRANSPORT_LOST = "-32603";
+
+function stringMatchesSessionLost(value: string): boolean {
+  const mentionsSessionNotFound = value.includes(SESSION_NOT_FOUND);
+  const mentionsHttp404 = value.includes(HTTP_404);
+  const mentionsSessionErrorCode = RPC_CODE_PATTERNS.some((code) =>
+    value.includes(code),
+  );
   return (
     mentionsSessionNotFound && (mentionsHttp404 || mentionsSessionErrorCode)
   );
 }
+
+function objectHasSessionLostCode(candidate: unknown): boolean {
+  if (typeof candidate !== "object" || candidate === null) {
+    return false;
+  }
+  const code = (candidate as { code?: unknown }).code;
+  if (typeof code === "number") {
+    return code === -32001 || code === -32600;
+  }
+  if (typeof code === "string") {
+    return code === "-32001" || code === "-32600";
+  }
+  return false;
+}
+
+function stringMatchesTransportLost(value: string): boolean {
+  // The "Not connected" substring is the load-bearing marker; the
+  // -32603 code is only a confirming signal when present in a JSON-RPC
+  // envelope. A bare "Not connected" message from the SDK is sufficient.
+  return value.includes(NOT_CONNECTED);
+}
+
+function objectHasTransportLostCo
```

---

### Incident Patch 9: `ecf354a8` (2026-06-14)
**Commit Message**: Merge pull request #300 from raphaelbarreiros/fix/oauth-upsert-race-and-ssr-safe

fix(oauth): atomic upsert + SSR-safe OAuth provider (closes #296, #297)

**File**: `apps/backend/src/db/repositories/__tests__/oauth-sessions.repo.test.ts` (added, +167/-0)
```diff
@@ -0,0 +1,167 @@
+import type {
+  OAuthClientInformation,
+  OAuthTokens,
+} from "@modelcontextprotocol/sdk/shared/auth.js";
+import { beforeEach, describe, expect, it, vi } from "vitest";
+
+const valuesCalls: any[] = [];
+const onConflictSetCalls: any[] = [];
+const onConflictTargetCalls: any[] = [];
+
+// In-memory store keyed by mcp_server_uuid that mimics
+// `INSERT ... ON CONFLICT (mcp_server_uuid) DO UPDATE SET ...` semantics.
+// Tests then assert both the persisted result AND the call shape passed
+// to Drizzle, so we pin the conditional-spread behaviour directly.
+const store = new Map<string, any>();
+
+vi.mock("../../index", () => {
+  return {
+    db: {
+      insert: () => ({
+        values: (values: any) => {
+          valuesCalls.push(values);
+          return {
+            onConflictDoUpdate: ({
+              target,
+              set,
+            }: {
+              target: unknown;
+              set: any;
+            }) => {
+              onConflictTargetCalls.push(target);
+              onConflictSetCalls.push(set);
+              return {
+                returning: async () => {
+                  const key = values.mcp_server_uuid;
+                  const now = new Date();
+                  const existing = store.get(key);
+                  if (existing) {
+                    // ON CONFLICT DO UPDATE: merge only the keys present in `set`.
+                    // Strip the sql`NOW()` updated_at because the fake can't
+                    // execute SQL — overwrite with a Date instead.
+                    const { updated_at: _ignored, ...applicable } = set;
+                    const updated = {
+                      ...existing,
+                      ...applicable,
+                      updated_at: now,
+                    };
+                    store.set(key, updated);
+                    return [updated];
+                  }
+                  // Fresh insert: schema-defaulted columns are filled with
+                  // their declared defaults (client_information => {}).
+                  const row = {
+                    uuid: `uuid-${store.size}`,
+                    mcp_server_uuid: values.mcp_server_uuid,
+                    client_information: values.client_information ?? {},
+                    tokens: values.tokens ?? null,
+                    code_verifier: values.code_verifier ?? null,
+                    created_at: now,
+                    updated_at: now,
+                  };
+                  store.set(key, row);
+                  return [row];
+                },
+              };
+            },
+          };
+        },
+      }),
+    },
+  };
+});
+
+// Import AFTER vi.mock so the repo binds to the fake db.
+const { OAuthSessionsRepository } = await import("../oauth-sessions.repo");
+
+describe("OAuthSessionsRepository.upsert", () => {
+  const repo = new OAuthSessionsRepository();
+  const serverId = "00000000-0000-0000-0000-000000000001";
+
+  beforeEach(() => {
+    store.clear();
+    valuesCalls.length = 0;
+    onConflictSetCalls.length = 0;
+    onConflictTargetCalls.length = 0;
+  });
+
+  it("uses a single ON CONFLICT statement (not check-then-insert)", async () => {
+    await repo.upsert({
+      mcp_server_uuid: serverId,
+      client_information: { client_id: "client-A" } as OAuthClientInformation,
+    });
+
+    // Exactly one insert chain per call: this is what makes the upsert
+    // atomic and removes the SELECT-then-INSERT race window.
+    expect(valuesCalls).toHaveLength(1);
+    expect(onConflictSetCalls).toHaveLength(1);
+    expect(onConflictTargetCalls[0]).toBeDefined();
+  });
+
+  it("two sequential upserts produce a single row whose values reflect the last call", async () => {
+    await repo.upsert({
+      mcp_server_uuid: serverId,
+      client_information: { client_id: "client-A" } as OAuthClientInformation,
+    });
+    const second = await repo.upsert({
+      mcp_server_uuid: serverId,
+      client_information: { client_id: "client-B" } as OAuthClientInformation,
+    });
+
+    expect(store.size).toBe(1);
+    expect(second.client_information).toEqual({ client_id: "client-B" });
+  });
+
+  it("partial upsert with only tokens does not write code_verifier into the SET clause", async () => {
+    await repo.upsert({
+      mcp_server_uuid: serverId,
+      tokens: { access_token: "tok", token_type: "Bearer" } as OAuthTokens,
+    });
+
+    const set = onConflictSetCalls[0];
+    expect(set).toHaveProperty("tokens");
+    expect(set).not.toHaveProperty("code_verifier");
+    expect(set).not.toHaveProperty("client_information");
+  });
+
+  it("partial upsert with only code_verifier does not clear an existing tokens column", async () => {
+    await repo.upsert({
+      mcp_server_uuid: serverId,
+      tokens: { access_token: "tok", token_type: "Bearer" } as OAuthTokens,
+    });
+    const second = await repo.upsert({
+      mcp_server_uuid: serverId,
+      code_verifier: "the-verifie
```

**File**: `apps/backend/src/db/repositories/oauth-sessions.repo.ts` (modified, +32/-14)
```diff
@@ -57,22 +57,40 @@ export class OAuthSessionsRepository {
   }
 
   async upsert(input: OAuthSessionUpdateInput): Promise<DatabaseOAuthSession> {
-    // Check if session exists
-    const existingSession = await this.findByMcpServerUuid(
-      input.mcp_server_uuid,
-    );
+    // Single-statement atomic upsert. Concurrent callers for the same
+    // mcp_server_uuid resolve via ON CONFLICT instead of racing a
+    // SELECT-then-INSERT, which previously crashed the loser with a
+    // unique-constraint violation. Only fields present on `input` are written
+    // so a partial update (e.g. tokens only) does not clear unrelated columns
+    // such as code_verifier.
+    const [row] = await db
+      .insert(oauthSessionsTable)
+      .values({
+        mcp_server_uuid: input.mcp_server_uuid,
+        ...(input.client_information && {
+          client_information: input.client_information,
+        }),
+        ...(input.tokens && { tokens: input.tokens }),
+        ...(input.code_verifier && { code_verifier: input.code_verifier }),
+      })
+      .onConflictDoUpdate({
+        target: oauthSessionsTable.mcp_server_uuid,
+        set: {
+          ...(input.client_information && {
+            client_information: input.client_information,
+          }),
+          ...(input.tokens && { tokens: input.tokens }),
+          ...(input.code_verifier && { code_verifier: input.code_verifier }),
+          updated_at: sql`NOW()`,
+        },
+      })
+      .returning();
 
-    if (existingSession) {
-      // Update existing session
-      const updatedSession = await this.update(input);
-      if (!updatedSession) {
-        throw new Error("Failed to update OAuth session");
-      }
-      return updatedSession;
-    } else {
-      // Create new session
-      return await this.create(input);
+    if (!row) {
+      throw new Error("Failed to upsert OAuth session");
     }
+
+    return row;
   }
 
   async deleteByMcpServerUuid(
```

**File**: `apps/frontend/app/[locale]/(sidebar)/mcp-servers/[uuid]/page.tsx` (modified, +9/-2)
```diff
@@ -16,7 +16,7 @@ import {
 } from "lucide-react";
 import Link from "next/link";
 import { notFound, useRouter } from "next/navigation";
-import { use, useEffect, useState } from "react";
+import { use, useEffect, useRef, useState } from "react";
 import { toast } from "sonner";
 
 import { EditMcpServer } from "@/components/edit-mcp-server";
@@ -161,15 +161,22 @@ export default function McpServerDetailPage({
     ),
   });
 
-  // Auto-connect when hook is enabled and not already connected
+  // Auto-connect when hook is enabled and not already connected.
+  // Guarded against React Strict Mode's intentional double-invocation of
+  // effects in dev: without the ref, both fires would race two concurrent
+  // OAuth dynamic registrations and the browser/DB would disagree on
+  // client_id, breaking token exchange.
+  const didAutoConnect = useRef(false);
   useEffect(() => {
+    if (didAutoConnect.current) return;
     if (
       connection &&
       server &&
       !isLoading &&
       server.error_status !== McpServerErrorStatusEnum.Enum.ERROR &&
       connection.connectionStatus === "disconnected"
     ) {
+      didAutoConnect.current = true;
       connection.connect();
     }
   }, [server, connection, isLoading]);
```

**File**: `apps/frontend/lib/oauth-provider.ts` (modified, +16/-2)
```diff
@@ -20,8 +20,19 @@ class DbOAuthClientProvider implements OAuthClientProvider {
   constructor(mcpServerUuid: string, serverUrl: string) {
     this.mcpServerUuid = mcpServerUuid;
     this.serverUrl = serverUrl;
-    // Save the server URL to session storage for consistency
-    sessionStorage.setItem(SESSION_KEYS.SERVER_URL, serverUrl);
+    // No sessionStorage access here: the constructor runs during Next.js SSR
+    // for the MCP server detail page, where sessionStorage is undefined.
+    // The SERVER_URL seed is deferred to ensureServerUrlStored(), called by
+    // the OAuth-flow methods below, all of which are invoked client-side.
+  }
+
+  // Seeds SESSION_KEYS.SERVER_URL on first invocation in the browser. The
+  // OAuth callback page reads this key to recover the upstream serverUrl, so
+  // it must be set before redirectToAuthorization sends the user away. Safe
+  // to call repeatedly; a no-op on the server.
+  private ensureServerUrlStored() {
+    if (typeof window === "undefined") return;
+    sessionStorage.setItem(SESSION_KEYS.SERVER_URL, this.serverUrl);
   }
 
   get redirectUrl() {
@@ -91,6 +102,7 @@ class DbOAuthClientProvider implements OAuthClientProvider {
   }
 
   async saveClientInformation(clientInformation: OAuthClientInformation) {
+    this.ensureServerUrlStored();
     // Save to session storage during OAuth flow
     const key = getServerSpecificKey(
       SESSION_KEYS.CLIENT_INFORMATION,
@@ -159,10 +171,12 @@ class DbOAuthClientProvider implements OAuthClientProvider {
   }
 
   redirectToAuthorization(authorizationUrl: URL) {
+    this.ensureServerUrlStored();
     window.location.href = authorizationUrl.href;
   }
 
   async saveCodeVerifier(codeVerifier: string) {
+    this.ensureServerUrlStored();
     // Save to session storage during OAuth flow
     const key = getServerSpecificKey(
       SESSION_KEYS.CODE_VERIFIER,
```

**File**: `packages/zod-types/src/oauth.zod.ts` (modified, +14/-8)
```diff
@@ -130,12 +130,16 @@ export const GetOAuthSessionResponseSchema = z.union([
   }),
 ]);
 
-// Upsert OAuth Session Request - all fields optional for updates
+// Upsert OAuth Session Request - all fields optional for updates.
+// `tokens` and `code_verifier` are NOT nullable: the atomic upsert in
+// `OAuthSessionsRepository.upsert` drops nullish values via the conditional
+// spread (omit = "do not touch"), so allowing `null` here would advertise a
+// "clear this column" contract the implementation does not honour.
 export const UpsertOAuthSessionRequestSchema = z.object({
   mcp_server_uuid: z.string().uuid(),
   client_information: OAuthClientInformationSchema.optional(),
-  tokens: OAuthTokensSchema.nullable().optional(),
-  code_verifier: z.string().nullable().optional(),
+  tokens: OAuthTokensSchema.optional(),
+  code_verifier: z.string().optional(),
 });
 
 // Upsert OAuth Session Response
@@ -151,19 +155,21 @@ export const UpsertOAuthSessionResponseSchema = z.union([
   }),
 ]);
 
-// Repository-specific schemas
+// Repository-specific schemas. `tokens` and `code_verifier` mirror the upsert
+// contract above: omitted means "leave the column alone"; `null` is not
+// accepted because the impl would silently drop it.
 export const OAuthSessionCreateInputSchema = z.object({
   mcp_server_uuid: z.string(),
   client_information: OAuthClientInformationSchema.optional(),
-  tokens: OAuthTokensSchema.nullable().optional(),
-  code_verifier: z.string().nullable().optional(),
+  tokens: OAuthTokensSchema.optional(),
+  code_verifier: z.string().optional(),
 });
 
 export const OAuthSessionUpdateInputSchema = z.object({
   mcp_server_uuid: z.string(),
   client_information: OAuthClientInformationSchema.optional(),
-  tokens: OAuthTokensSchema.nullable().optional(),
-  code_verifier: z.string().nullable().optional(),
+  tokens: OAuthTokensSchema.optional(),
+  code_verifier: z.string().optional(),
 });
 
 // Export repository types
```

---

### Incident Patch 10: `ad686281` (2026-06-14)
**Commit Message**: Merge pull request #312 from bobbyhyam/fix/persist-uv-cache

Persist uv cache across container recreates

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ RUN apt-get update && apt-get install -y curl postgresql-client && apt-get clean
 # Create non-root user with proper home directory
 RUN addgroup --system --gid 1001 nodejs
 RUN adduser --system --uid 1001 --home /home/nextjs nextjs && \
-    mkdir -p /home/nextjs/.cache/node/corepack && \
+    mkdir -p /home/nextjs/.cache/node/corepack /home/nextjs/.cache/uv && \
     chown -R nextjs:nodejs /home/nextjs
 
 # Copy built applications
```

**File**: `docker-compose.yml` (modified, +10/-0)
```diff
@@ -162,6 +162,14 @@ services:
       postgres:
         condition: service_healthy
     restart: "no"
+    volumes:
+      # Persist the uv cache across container recreates. Without this, every
+      # `docker compose up -d`/recreate wipes the writable layer and the next
+      # `uvx <pkg>@latest` spawn for each STDIO server cold-installs from
+      # scratch — slow enough to trip the crash detector and stick the server
+      # in error_status=ERROR. The image ships /home/nextjs/.cache/uv owned by
+      # nextjs (uid 1001) so a fresh named volume inherits correct ownership.
+      - uv_cache:/home/nextjs/.cache/uv
     networks:
       - metamcp-network
 
@@ -191,6 +199,8 @@ services:
 volumes:
   postgres_data:
     driver: local
+  uv_cache:
+    driver: local
 
 networks:
   metamcp-network:
```

---

### Incident Patch 11: `e36dca38` (2026-06-14)
**Commit Message**: Merge pull request #283 from UmbrellaITSolutions/fix/streamable-http-session-reinit-on-404

fix: re-initialize backend session on HTTP 404 Session not found

Resolved conflict in metamcp-proxy.ts tools/call catch block: adopted
#283's guarded re-initialization flow (only retry when
isBackendSessionLostError(error) is true, otherwise rethrow), while
keeping ai-dev's logger convention — converted #283's console.error/
console.warn calls in this block to logger.error/logger.warn to match.

mcp-server-pool.ts (invalidateServerConnection) and the new
session-error.ts / session-error.test.ts files merged cleanly.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `apps/backend/src/lib/metamcp/mcp-server-pool.ts` (modified, +50/-0)
```diff
@@ -757,6 +757,56 @@ export class McpServerPool {
     }
   }
 
+  /**
+   * Drop the pooled backend connection(s) for a given (sessionId, serverUuid).
+   *
+   * Used when the backend MCP server reports our Mcp-Session-Id is unknown
+   * (e.g. after the backend container restarts and loses its in-memory session
+   * registry). Both the active session and the paired idle session share the
+   * backend's session registry, so both are closed — if the backend forgot
+   * the active session, it has forgotten the idle one too. No replacement is
+   * created here; the next `getSession` call will establish a fresh
+   * connection (and therefore a fresh backend session) on demand.
+   */
+  async invalidateServerConnection(
+    sessionId: string,
+    serverUuid: string,
+  ): Promise<void> {
+    const activeForSession = this.activeSessions[sessionId];
+    const activeClient = activeForSession?.[serverUuid];
+    if (activeClient) {
+      try {
+        await activeClient.cleanup();
+      } catch (error) {
+        console.error(
+          `Error cleaning up invalidated active session ${sessionId}/${serverUuid}:`,
+          error,
+        );
+      }
+      delete activeForSession[serverUuid];
+      this.sessionToServers[sessionId]?.delete(serverUuid);
+    }
+
+    const idleClient = this.idleSessions[serverUuid];
+    if (idleClient) {
+      try {
+        await idleClient.cleanup();
+      } catch (error) {
+        console.error(
+          `Error cleaning up invalidated idle session for ${serverUuid}:`,
+          error,
+        );
+      }
+      delete this.idleSessions[serverUuid];
+    }
+
+    this.creatingIdleSessions.delete(serverUuid);
+
+    console.warn(
+      `Invalidated pooled backend connection for server ${serverUuid} (session ${sessionId})`,
+    );
+  }
+
   /**
    * Handle server process crash
    */
```

**File**: `apps/backend/src/lib/metamcp/metamcp-proxy.ts` (modified, +72/-25)
```diff
@@ -44,6 +44,7 @@ import {
   createToolOverridesListToolsMiddleware,
   mapOverrideNameToOriginal,
 } from "./metamcp-middleware/tool-overrides.functional";
+import { isBackendSessionLostError } from "./session-error";
 import { parseToolName } from "./tool-name-parser";
 import { toolsSyncCache } from "./tools-sync-cache";
 import { sanitizeName } from "./utils";
@@ -448,23 +449,23 @@ export const createServer = async (
       throw new Error(`Server UUID not found for tool: ${name}`);
     }
 
-    try {
-      const abortController = new AbortController();
-
-      // Get configurable timeout values
-      const resetTimeoutOnProgress =
-        await configService.getMcpResetTimeoutOnProgress();
-      const timeout = await configService.getMcpTimeout();
-      const maxTotalTimeout = await configService.getMcpMaxTotalTimeout();
-
-      const mcpRequestOptions: RequestOptions = {
-        signal: abortController.signal,
-        resetTimeoutOnProgress,
-        timeout,
-        maxTotalTimeout,
-      };
-      // Use the correct schema for tool calls
-      const result = await clientForTool.client.request(
+    const abortController = new AbortController();
+
+    // Get configurable timeout values
+    const resetTimeoutOnProgress =
+      await configService.getMcpResetTimeoutOnProgress();
+    const timeout = await configService.getMcpTimeout();
+    const maxTotalTimeout = await configService.getMcpMaxTotalTimeout();
+
+    const mcpRequestOptions: RequestOptions = {
+      signal: abortController.signal,
+      resetTimeoutOnProgress,
+      timeout,
+      maxTotalTimeout,
+    };
+
+    const callOnce = (session: ConnectedClient) =>
+      session.client.request(
         {
           method: "tools/call",
           params: {
@@ -477,16 +478,62 @@ export const createServer = async (
         mcpRequestOptions,
       );
 
-      // Cast the result to CallToolResult type
-      return result as CallToolResult;
+    try {
+      return (await callOnce(clientForTool)) as CallToolResult;
     } catch (error) {
-      logger.error(
-        `Error calling tool "${name}" through ${
-          clientForTool.client.getServerVersion()?.name || "unknown"
-        }:`,
-        error,
+      if (!isBackendSessionLostError(error)) {
+        logger.error(
+          `Error calling tool "${name}" through ${
+            clientForTool.client.getServerVersion()?.name || "unknown"
+          }:`,
+          error,
+        );
+        throw error;
+      }
+
+      logger.warn(
+        `Backend reported session lost for server ${serverUuid} on tool "${name}"; invalidating pool and retrying once.`,
       );
-      throw error;
+
+      await mcpServerPool.invalidateServerConnection(sessionId, serverUuid);
+      delete toolToClient[name];
+
+      const serverParamsMap = await getMcpServers(
+        namespaceUuid,
+        includeInactiveServers,
+      );
+      const params = serverParamsMap[serverUuid];
+      if (!params) {
+        throw new Error(
+          `Cannot re-initialize session: server ${serverUuid} no longer present in namespace ${namespaceUuid}`,
+        );
+      }
+
+      const freshSession = await mcpServerPool.getSession(
+        sessionId,
+        serverUuid,
+        params,
+        namespaceUuid,
+      );
+      if (!freshSession) {
+        throw new Error(
+          `Failed to re-initialize session for server ${serverUuid} after backend session loss`,
+        );
+      }
+
+      toolToClient[name] = freshSession;
+
+      try {
+        return (await callOnce(freshSession)) as CallToolResult;
+      } catch (retryError) {
+        logger.error(
+          `Error calling tool "${name}" through ${
+            freshSession.client.getServerVersion()?.name || "unknown"
+          } after session re-initialize:`,
+          retryError,
+        );
+        throw retryError;
+      }
     }
   };
 
```

**File**: `apps/backend/src/lib/metamcp/session-error.test.ts` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+import { describe, expect, it } from "vitest";
+
+import { isBackendSessionLostError } from "./session-error";
+
+describe("isBackendSessionLostError", () => {
+  it("matches the HTTP 404 + JSON-RPC -32600 envelope the SDK produces", () => {
+    const error = new Error(
+      'Error POSTing to endpoint (HTTP 404): {"jsonrpc":"2.0","id":"server-error","error":{"code":-32600,"message":"Session not found"}}',
+    );
+    expect(isBackendSessionLostError(error)).toBe(true);
+  });
+
+  it("matches the HTTP 404 + JSON-RPC -32001 variant some servers return", () => {
+    const error = new Error(
+      'Error POSTing to endpoint (HTTP 404): {"error":{"code":-32001,"message":"Session not found"},"id":"","jsonrpc":"2.0"}',
+    );
+    expect(isBackendSessionLostError(error)).toBe(true);
+  });
+
+  it("does not match unrelated 404s", () => {
+    const error = new Error("Error POSTing to endpoint (HTTP 404): Not Found");
+    expect(isBackendSessionLostError(error)).toBe(false);
+  });
+
+  it("does not match transport disconnects", () => {
+    const error = new Error("Not connected");
+    expect(isBackendSessionLostError(error)).toBe(false);
+  });
+
+  it("returns false for non-Error inputs", () => {
+    expect(isBackendSessionLostError(undefined)).toBe(false);
+    expect(isBackendSessionLostError(null)).toBe(false);
+    expect(isBackendSessionLostError("Session not found")).toBe(false);
+  });
+});
```

**File**: `apps/backend/src/lib/metamcp/session-error.ts` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+/**
+ * Detect errors that indicate the backend MCP server's session registry no
+ * longer knows our Mcp-Session-Id. Per the MCP Streamable HTTP spec, the
+ * backend SHOULD respond with HTTP 404 when it cannot find the session; most
+ * SDKs also surface a JSON-RPC error body with code -32001 or -32600 and
+ * message "Session not found".
+ *
+ * The MCP TypeScript SDK's StreamableHTTPClientTransport wraps this as a
+ * generic Error whose message embeds the HTTP status and raw JSON-RPC body,
+ * so we match on substrings. Example:
+ *
+ *   Error POSTing to endpoint (HTTP 404):
+ *   {"jsonrpc":"2.0","id":"server-error","error":{"code":-32600,"message":"Session not found"}}
+ *
+ * When this happens, the cached backend connection is dead: MetaMCP must drop
+ * it, send a new `initialize`, and replay the failed request. The MCP spec
+ * states the client MUST start a new session in response to HTTP 404, so this
+ * is the normative recovery path, not a workaround.
+ */
+export function isBackendSessionLostError(error: unknown): boolean {
+  if (!(error instanceof Error) || !error.message) {
+    return false;
+  }
+  const message = error.message;
+  const mentionsSessionNotFound = message.includes("Session not found");
+  const mentionsHttp404 = message.includes("HTTP 404");
+  const mentionsSessionErrorCode =
+    message.includes("-32001") || message.includes("-32600");
+  return (
+    mentionsSessionNotFound && (mentionsHttp404 || mentionsSessionErrorCode)
+  );
+}
```

---

### Incident Patch 12: `1629c438` (2026-06-14)
**Commit Message**: Merge pull request #282 from loris-av/fix/session-lifetime-env-var

fix: read SESSION_LIFETIME from env var for session cleanup



---

### Incident Patch 13: `f3cd11ce` (2026-06-14)
**Commit Message**: Merge pull request #260 from BTForIT/fix/session-pool-idle-timeout

fix: touch session timestamps on access for idle-based cleanup

Resolved conflicts in mcp-server-pool.ts by combining:
- #260's per-server connection cap (canCreateConnectionForServer guard)
- ai-dev's env-driven MAX_TOTAL_CONNECTIONS and generation-counter
  concurrency safety from #273

In createIdleSession(), the per-server cap check now runs before the
generation guard, mirroring the already-merged createIdleSessionAsync().

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `apps/backend/src/db/repositories/mcp-servers.repo.ts` (modified, +16/-0)
```diff
@@ -248,6 +248,22 @@ export class McpServersRepository {
 
     return updatedServer;
   }
+
+  /**
+   * Reset error_status to NONE for all servers that are currently in ERROR state.
+   * Used on startup to give servers a fresh chance.
+   */
+  async resetAllErrorStatuses(): Promise<number> {
+    const updated = await db
+      .update(mcpServersTable)
+      .set({
+        error_status: McpServerErrorStatusEnum.Enum.NONE,
+      })
+      .where(eq(mcpServersTable.error_status, McpServerErrorStatusEnum.Enum.ERROR))
+      .returning();
+
+    return updated.length;
+  }
 }
 
 export const mcpServersRepository = new McpServersRepository();
```

**File**: `apps/backend/src/index.ts` (modified, +23/-0)
```diff
@@ -114,6 +114,29 @@ start().catch((err) => {
   // Do not throw - keep consistent with other startup behavior
 });
 
+// Graceful shutdown: clean up MCP server pools on SIGTERM/SIGINT
+// Prevents orphaned STDIO child processes when backend restarts
+const gracefulShutdown = async (signal: string) => {
+  console.log(`${signal} received, cleaning up MCP server pools...`);
+  try {
+    const { mcpServerPool } = await import("./lib/metamcp");
+    const { metaMcpServerPool } = await import(
+      "./lib/metamcp/metamcp-server-pool"
+    );
+    await Promise.allSettled([
+      mcpServerPool.cleanupAll(),
+      metaMcpServerPool.cleanupAll(),
+    ]);
+    console.log("MCP server pools cleaned up successfully");
+  } catch (error) {
+    console.error("Error during graceful shutdown:", error);
+  }
+  process.exit(0);
+};
+
+process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
+process.on("SIGINT", () => gracefulShutdown("SIGINT"));
+
 app.get("/health", (req, res) => {
   res.json({
     status: "ok",
```

**File**: `apps/backend/src/lib/config.service.ts` (modified, +1/-1)
```diff
@@ -95,7 +95,7 @@ export const configService = {
     const config = await configRepo.getConfig(
       ConfigKeyEnum.Enum.MCP_MAX_ATTEMPTS,
     );
-    return config?.value ? parseInt(config.value, 10) : 1;
+    return config?.value ? parseInt(config.value, 10) : 3;
   },
 
   async setMcpMaxAttempts(maxAttempts: number): Promise<void> {
```

**File**: `apps/backend/src/lib/metamcp/mcp-server-pool.ts` (modified, +232/-25)
```diff
@@ -11,6 +11,8 @@ export interface McpServerPoolStatus {
   active: number;
   activeSessionIds: string[];
   idleServerUuids: string[];
+  perServerCounts?: Record<string, number>;
+  maxConnectionsPerServer?: number;
 }
 
 export class McpServerPool {
@@ -43,6 +45,9 @@ export class McpServerPool {
   // Session cleanup timer
   private cleanupTimer: NodeJS.Timeout | null = null;
 
+  // Health check timer for idle sessions
+  private healthCheckTimer: NodeJS.Timeout | null = null;
+
   // Background idle sessions by namespace: namespaceUuid -> any
   private backgroundIdleSessionsByNamespace: Map<string, any> = new Map();
 
@@ -52,28 +57,108 @@ export class McpServerPool {
   // Maximum total connections (idle + active) to prevent runaway process spawning
   private readonly maxTotalConnections: number;
 
+  // Maximum connections per individual server UUID (prevents per-server process explosion)
+  private readonly maxConnectionsPerServer: number;
+
   private constructor(
     defaultIdleCount: number = 1,
     maxTotalConnections: number = parseInt(
       process.env.MAX_TOTAL_CONNECTIONS || "100",
       10,
     ),
+    maxConnectionsPerServer: number = 5,
   ) {
     this.defaultIdleCount = defaultIdleCount;
     this.maxTotalConnections = maxTotalConnections;
+    this.maxConnectionsPerServer = maxConnectionsPerServer;
     this.startCleanupTimer();
+    this.startHealthCheckTimer();
   }
 
   /**
    * Get the singleton instance
    */
-  static getInstance(defaultIdleCount: number = 1): McpServerPool {
+  static getInstance(
+    defaultIdleCount: number = 1,
+    maxConnectionsPerServer: number = 5,
+  ): McpServerPool {
     if (!McpServerPool.instance) {
-      McpServerPool.instance = new McpServerPool(defaultIdleCount);
+      McpServerPool.instance = new McpServerPool(
+        defaultIdleCount,
+        100,
+        maxConnectionsPerServer,
+      );
     }
     return McpServerPool.instance;
   }
 
+  /**
+   * Count all connections (idle + active + pending) for a specific server UUID
+   */
+  private countConnectionsForServer(serverUuid: string): number {
+    let count = 0;
+
+    // Count idle session
+    if (this.idleSessions[serverUuid]) {
+      count += 1;
+    }
+
+    // Count active sessions across all sessionIds
+    for (const sessionServers of Object.values(this.activeSessions)) {
+      if (sessionServers[serverUuid]) {
+        count += 1;
+      }
+    }
+
+    // Count pending idle creation
+    if (this.creatingIdleSessions.has(serverUuid)) {
+      count += 1;
+    }
+
+    return count;
+  }
+
+  /**
+   * Check if we can create another connection for a specific server
+   */
+  private canCreateConnectionForServer(serverUuid: string): boolean {
+    const count = this.countConnectionsForServer(serverUuid);
+    if (count >= this.maxConnectionsPerServer) {
+      logger.warn(
+        `Per-server connection limit reached for ${serverUuid}: ${count}/${this.maxConnectionsPerServer}`,
+      );
+      return false;
+    }
+    return true;
+  }
+
+  /**
+   * Find the oldest active connection for a server UUID (for reuse when at cap)
+   */
+  private findOldestActiveConnectionForServer(
+    serverUuid: string,
+  ): ConnectedClient | undefined {
+    let oldestSessionId: string | undefined;
+    let oldestTimestamp = Infinity;
+
+    for (const [sessionId, sessionServers] of Object.entries(
+      this.activeSessions,
+    )) {
+      if (sessionServers[serverUuid]) {
+        const timestamp = this.sessionTimestamps[sessionId] || Infinity;
+        if (timestamp < oldestTimestamp) {
+          oldestTimestamp = timestamp;
+          oldestSessionId = sessionId;
+        }
+      }
+    }
+
+    if (oldestSessionId) {
+      return this.activeSessions[oldestSessionId]?.[serverUuid];
+    }
+    return undefined;
+  }
+
   /**
    * Get or create a session for a specific MCP server
    */
@@ -88,6 +173,8 @@ export class McpServerPool {
 
     // Check if we already have an active session for this sessionId and server
     if (this.activeSessions[sessionId]?.[serverUuid]) {
+      // Touch timestamp on every access so SESSION_LIFETIME acts as idle timeout, not hard TTL
+      this.sessionTimestamps[sessionId] = Date.now();
       return this.activeSessions[sessionId][serverUuid];
     }
 
@@ -116,7 +203,20 @@ export class McpServerPool {
       return idleClient;
     }
 
-    // No idle session available, create a new connection
+    // No idle session available — check per-server cap before spawning
+    if (!this.canCreateConnectionForServer(serverUuid)) {
+      // At cap: reuse the oldest active connection instead of spawning
+      const reusable = this.findOldestActiveConnectionForServer(serverUuid);
+      if (reusable) {
+        logger.info(
+          `Reusing existing connection for server ${serverUuid} (at per-server cap ${this.maxConnectionsPerServer})`,
+        );
+        this.activeSessions[sessionId][serverUuid] = reusable;
+        this.sessionToSe
```

**File**: `apps/backend/src/lib/metamcp/metamcp-proxy.ts` (modified, +22/-0)
```diff
@@ -171,6 +171,28 @@ export const createServer = async (
       `[DEBUG-TOOLS] 📋 Processing ${allServerEntries.length} servers`,
     );
 
+    // Cold-start warmup: if pool has 0 idle + 0 active sessions but servers
+    // exist in DB, trigger a blocking warmup before tools/list responds.
+    // This prevents 0-tool responses after idle timeout expires all connections.
+    const poolStatus = mcpServerPool.getPoolStatus();
+    if (
+      poolStatus.idle === 0 &&
+      poolStatus.active === 0 &&
+      allServerEntries.length > 0
+    ) {
+      console.log(
+        `[DEBUG-TOOLS] ⚠️ Cold start: 0 idle, 0 active sessions but ${allServerEntries.length} servers registered. Warming up...`,
+      );
+      for (const [uuid] of allServerEntries) {
+        await mcpServerPool.resetServerErrorState(uuid);
+      }
+      await mcpServerPool.ensureIdleSessions(serverParams, namespaceUuid);
+      const afterStatus = mcpServerPool.getPoolStatus();
+      console.log(
+        `[DEBUG-TOOLS] ✅ Pool warmup complete: ${afterStatus.idle} idle, ${afterStatus.active} active`,
+      );
+    }
+
     await Promise.allSettled(
       allServerEntries.map(async ([mcpServerUuid, params]) => {
         console.log(`[DEBUG-TOOLS] 🔧 Server: ${params.name || mcpServerUuid}`);
```

**File**: `apps/backend/src/lib/metamcp/server-error-tracker.ts` (modified, +8/-1)
```diff
@@ -19,7 +19,7 @@ export class ServerErrorTracker {
   private crashAttempts: Map<string, number> = new Map();
 
   // Default max attempts before marking as ERROR (fallback if config is not available)
-  private readonly fallbackMaxAttempts: number = 1;
+  private readonly fallbackMaxAttempts: number = 3;
 
   // Server-specific max attempts (can be configured per server)
   private serverMaxAttempts: Map<string, number> = new Map();
@@ -136,6 +136,13 @@ export class ServerErrorTracker {
     this.crashAttempts.delete(serverUuid);
   }
 
+  /**
+   * Reset all crash attempts (e.g., on startup for a clean slate)
+   */
+  resetAllAttempts(): void {
+    this.crashAttempts.clear();
+  }
+
   /**
    * Get current crash attempts for a server
    */
```

**File**: `apps/backend/src/lib/startup.ts` (modified, +11/-0)
```diff
@@ -3,6 +3,7 @@ import { ServerParameters } from "@repo/zod-types";
 import { mcpServersRepository, namespacesRepository } from "../db/repositories";
 import { initializeEnvironmentConfiguration } from "./bootstrap.service";
 import { metaMcpServerPool } from "./metamcp";
+import { serverErrorTracker } from "./metamcp/server-error-tracker";
 import { convertDbServerToParams } from "./metamcp/utils";
 
 /**
@@ -48,6 +49,16 @@ export async function initializeIdleServers() {
       "Initializing idle servers for all namespaces and all MCP servers...",
     );
 
+    // Reset all ERROR statuses so servers get a fresh chance on restart
+    const resetCount = await mcpServersRepository.resetAllErrorStatuses();
+    if (resetCount > 0) {
+      console.log(
+        `Reset ${resetCount} server(s) from ERROR to NONE status on startup`,
+      );
+    }
+    // Also clear in-memory crash attempt counters
+    serverErrorTracker.resetAllAttempts();
+
     // Fetch all namespaces from the database
     const namespaces = await namespacesRepository.findAll();
     const namespaceUuids = namespaces.map((namespace) => namespace.uuid);
```

**File**: `apps/backend/src/routers/public-metamcp.ts` (modified, +4/-0)
```diff
@@ -5,6 +5,7 @@ import logger from "@/utils/logger";
 
 import { endpointsRepository } from "../db/repositories/endpoints.repo";
 import { openApiRouter } from "./public-metamcp/openapi";
+import adminRouter from "./public-metamcp/admin";
 import sseRouter from "./public-metamcp/sse";
 import streamableHttpRouter from "./public-metamcp/streamable-http";
 
@@ -43,6 +44,9 @@ publicEndpointsRouter.use(sseRouter);
 // Use OpenAPI router for /api and /openapi.json routes
 publicEndpointsRouter.use(openApiRouter);
 
+// Use Admin router for /admin endpoints (error reset, diagnostics)
+publicEndpointsRouter.use(adminRouter);
+
 // Health check endpoint
 publicEndpointsRouter.get("/health", (req, res) => {
   res.json({
```

---

### Incident Patch 14: `e53eb580` (2026-06-14)
**Commit Message**: Merge pull request #273 from alpha-pet/feature/fix-process-leaks

Fix subprocess leaks from race conditions in STDIO transport lifecycle

**File**: `apps/backend/src/lib/metamcp/mcp-server-pool.ts` (modified, +99/-15)
```diff
@@ -35,6 +35,11 @@ export class McpServerPool {
   // Track ongoing idle session creation to prevent duplicates
   private creatingIdleSessions: Set<string> = new Set();
 
+  // Generation counter per server UUID: incremented by invalidateIdleSession() so
+  // any in-flight createIdleSession / createIdleSessionAsync that resolves with a
+  // stale generation knows to discard its result instead of storing it.
+  private idleSessionGenerations: Record<string, number> = {};
+
   // Session cleanup timer
   private cleanupTimer: NodeJS.Timeout | null = null;
 
@@ -114,6 +119,19 @@ export class McpServerPool {
       return undefined;
     }
 
+    // Re-check after the async gap: a concurrent getSession() call for the same
+    // (sessionId, serverUuid) pair may have stored a connection while we were awaiting
+    // createNewConnection(). If so, discard ours to avoid leaking the spawned process.
+    if (this.activeSessions[sessionId]?.[serverUuid]) {
+      newClient.cleanup().catch((error) => {
+        logger.error(
+          `Error cleaning up duplicate connection for server ${params.uuid}:`,
+          error,
+        );
+      });
+      return this.activeSessions[sessionId][serverUuid];
+    }
+
     this.activeSessions[sessionId][serverUuid] = newClient;
     this.sessionToServers[sessionId].add(serverUuid);
 
@@ -197,15 +215,46 @@ export class McpServerPool {
     params: ServerParameters,
     namespaceUuid?: string,
   ): Promise<void> {
-    // Don't create if we already have an idle session for this server
-    if (this.idleSessions[serverUuid]) {
+    // Don't create if we already have an idle session or are already creating one.
+    // Both checks are synchronous (before any await) so they act as a pre-await
+    // mutex, matching the pattern used by createIdleSessionAsync.
+    if (
+      this.idleSessions[serverUuid] ||
+      this.creatingIdleSessions.has(serverUuid)
+    ) {
       return;
     }
 
-    const newClient = await this.createNewConnection(params, namespaceUuid);
-    if (newClient) {
-      this.idleSessions[serverUuid] = newClient;
-      logger.info(`Created idle session for server ${serverUuid}`);
+    this.creatingIdleSessions.add(serverUuid);
+    const generation = this.idleSessionGenerations[serverUuid] ?? 0;
+
+    try {
+      const newClient = await this.createNewConnection(params, namespaceUuid);
+      if (newClient) {
+        const currentGeneration = this.idleSessionGenerations[serverUuid] ?? 0;
+        if (!this.idleSessions[serverUuid] && currentGeneration === generation) {
+          this.idleSessions[serverUuid] = newClient;
+          logger.info(`Created idle session for server ${serverUuid}`);
+        } else {
+          // Either a concurrent call already stored an idle session, or
+          // invalidateIdleSession() bumped the generation while we were awaiting,
+          // meaning our result is stale. Discard it.
+          newClient.cleanup().catch((error) => {
+            logger.error(
+              `Error cleaning up duplicate idle session for ${serverUuid}:`,
+              error,
+            );
+          });
+        }
+      }
+    } finally {
+      // Only release the guard if we're still the current creation for this
+      // server. If the generation was bumped while we were awaiting (e.g. by
+      // invalidateIdleSession), the guard now belongs to the newer creation
+      // and must not be removed here.
+      if ((this.idleSessionGenerations[serverUuid] ?? 0) === generation) {
+        this.creatingIdleSessions.delete(serverUuid);
+      }
     }
   }
 
@@ -227,11 +276,13 @@ export class McpServerPool {
 
     // Mark that we're creating an idle session for this server
     this.creatingIdleSessions.add(serverUuid);
+    const generation = this.idleSessionGenerations[serverUuid] ?? 0;
 
     // Create the session in the background (fire and forget)
     this.createNewConnection(params, namespaceUuid)
       .then((newClient) => {
-        if (newClient && !this.idleSessions[serverUuid]) {
+        const currentGeneration = this.idleSessionGenerations[serverUuid] ?? 0;
+        if (newClient && !this.idleSessions[serverUuid] && currentGeneration === generation) {
           this.idleSessions[serverUuid] = newClient;
           logger.info(
             `Created background idle session for server [${params.name}] ${serverUuid}`,
@@ -243,7 +294,8 @@ export class McpServerPool {
             );
           }
         } else if (newClient) {
-          // We already have an idle session, cleanup the extra one
+          // Either we already have an idle session, or invalidateIdleSession()
+          // bumped the generation while we were awaiting (stale result). Discard it.
           newClient.cleanup().catch((error) => {
             logger.error(
               `Error cleaning up extra idle session for ${serverUuid}:`,
@@ -259,8 +311,13 @@ export class McpServerPool {
         );
       })
       .finally(() => {
-        //
```

**File**: `apps/backend/src/lib/stdio-transport/process-managed-transport.ts` (modified, +40/-6)
```diff
@@ -182,6 +182,9 @@ export class ProcessManagedStdioTransport implements Transport {
       });
 
       this._process.on("spawn", () => {
+        logger.info(
+          `[transport.start] spawned PID ${this._process?.pid} — command: ${this._serverParams.command}`,
+        );
         resolve();
       });
 
@@ -259,15 +262,46 @@ export class ProcessManagedStdioTransport implements Transport {
 
   async close(): Promise<void> {
     this._isCleanup = true;
-    this._abortController.abort();
 
-    // Kill the entire process group to ensure full cleanup
-    if (this._process?.pid) {
+    const pid = this._process?.pid ?? null;
+
+    if (pid) {
+      const proc = this._process!;
+
+      // Register the "close" listener BEFORE sending any signal so a fast-exiting
+      // child cannot emit "close" in between and cause the promise to time out.
+      const exitedPromise = new Promise<boolean>((resolve) => {
+        const timeout = setTimeout(() => resolve(false), 5000);
+        proc.once("close", () => {
+          clearTimeout(timeout);
+          resolve(true);
+        });
+      });
+
+      this._abortController.abort();
+
       try {
-        process.kill(-this._process.pid, "SIGTERM");
+        process.kill(-pid, "SIGTERM");
+        logger.info(`[transport.close] SIGTERM sent to process group -${pid}`);
       } catch (error) {
-        // Process might already be terminated, ignore errors
-        logger.warn("Failed to kill process group:", error);
+        logger.warn(
+          `[transport.close] SIGTERM failed for process group -${pid}:`,
+          error,
+        );
+      }
+
+      // Wait up to 5 seconds for graceful shutdown, then escalate to SIGKILL
+      const exited = await exitedPromise;
+
+      if (!exited) {
+        logger.warn(
+          `[transport.close] Process ${pid} still alive after 5s — sending SIGKILL`,
+        );
+        try {
+          process.kill(-pid, "SIGKILL");
+        } catch {
+          // Process may have already exited between the timeout check and the kill
+        }
       }
     }
 
```

---

### Incident Patch 15: `566fb5f2` (2026-06-11)
**Commit Message**: fix(proxy): invalidate-and-retry recovery in the aggregate list handlers

The four aggregate list handlers (tools/list, prompts/list,
resources/list, resources/templates/list) logged-and-continued in their
catch blocks, so a dead pooled session -> the backend error was swallowed
-> the zombie connection was never invalidated -> the namespace returned
"successful" empty/partial responses on every request until a manual
restart.

This adds:
- McpServerPool.invalidateServerConnection(sessionId, serverUuid): drops
  the pooled backend connection(s) for a serverUuid, cascading across
  EVERY active session's slot plus the idle slot (stale clients cached
  under sibling sessions for the same backend defeat single-slot
  invalidation). Per-client cleanup() wrapped in try/catch so one failure
  can't strand the rest; map entries deleted.
- A shared requestWithSessionRecovery helper: runs the per-server backend
  request, and on a recoverable error (session-lost / transport-lost
  envelope) invalidates the pool, re-acquires a fresh session, fires an
  onFreshSession callback, and retries exactly once. Throws on
  non-recoverable errors, no-fresh-session, or retry failure.
- Wiring in all fo

**File**: `apps/backend/src/lib/metamcp/list-handler-recovery.test.ts` (added, +150/-0)
```diff
@@ -0,0 +1,150 @@
+import { ServerParameters } from "@repo/zod-types";
+import { describe, expect, it, vi } from "vitest";
+
+import { ConnectedClient } from "./client";
+import {
+  RecoverySessionPool,
+  requestWithSessionRecovery,
+} from "./list-handler-recovery";
+
+// The exact envelope shape the backend produces when its session died
+// (matches session-error.test.ts fixtures). isRecoverableBackendError
+// must classify it as recoverable.
+const sessionLostError = () =>
+  new Error(
+    'Error POSTing to endpoint (HTTP 404): {"jsonrpc":"2.0","id":"server-error","error":{"code":-32600,"message":"Session not found"}}',
+  );
+
+const transportLostError = () => new Error("Not connected");
+
+const makeSession = (label: string): ConnectedClient =>
+  ({ label }) as unknown as ConnectedClient;
+
+const params = { uuid: "server-1", name: "test-server" } as ServerParameters;
+
+const makePool = (freshSession: ConnectedClient | undefined) => {
+  const pool: RecoverySessionPool = {
+    invalidateServerConnection: vi.fn().mockResolvedValue(undefined),
+    getSession: vi.fn().mockResolvedValue(freshSession),
+  };
+  return pool;
+};
+
+const baseOpts = (pool: RecoverySessionPool, session: ConnectedClient) => ({
+  pool,
+  sessionId: "session-abc",
+  serverUuid: "server-1",
+  params,
+  namespaceUuid: "ns-1",
+  operation: "tools/list",
+  serverName: "test-server",
+  session,
+});
+
+describe("requestWithSessionRecovery", () => {
+  it("returns the first attempt's result without touching the pool", async () => {
+    const session = makeSession("stale");
+    const pool = makePool(undefined);
+    const attempt = vi.fn().mockResolvedValue(["tool-a"]);
+
+    const result = await requestWithSessionRecovery({
+      ...baseOpts(pool, session),
+      attempt,
+    });
+
+    expect(result).toEqual(["tool-a"]);
+    expect(attempt).toHaveBeenCalledTimes(1);
+    expect(attempt).toHaveBeenCalledWith(session);
+    expect(pool.invalidateServerConnection).not.toHaveBeenCalled();
+    expect(pool.getSession).not.toHaveBeenCalled();
+  });
+
+  it("invalidates, re-acquires, and retries once on a session-lost envelope", async () => {
+    const stale = makeSession("stale");
+    const fresh = makeSession("fresh");
+    const pool = makePool(fresh);
+    const attempt = vi
+      .fn()
+      .mockRejectedValueOnce(sessionLostError())
+      .mockResolvedValueOnce(["tool-b"]);
+    const onFreshSession = vi.fn();
+
+    const result = await requestWithSessionRecovery({
+      ...baseOpts(pool, stale),
+      attempt,
+      onFreshSession,
+    });
+
+    expect(result).toEqual(["tool-b"]);
+    expect(pool.invalidateServerConnection).toHaveBeenCalledWith(
+      "session-abc",
+      "server-1",
+    );
+    expect(pool.getSession).toHaveBeenCalledWith(
+      "session-abc",
+      "server-1",
+      params,
+      "ns-1",
+    );
+    expect(onFreshSession).toHaveBeenCalledWith(fresh);
+    expect(attempt).toHaveBeenNthCalledWith(1, stale);
+    expect(attempt).toHaveBeenNthCalledWith(2, fresh);
+  });
+
+  it("recovers from the SDK transport-lost envelope too", async () => {
+    const stale = makeSession("stale");
+    const fresh = makeSession("fresh");
+    const pool = makePool(fresh);
+    const attempt = vi
+      .fn()
+      .mockRejectedValueOnce(transportLostError())
+      .mockResolvedValueOnce("ok");
+
+    await expect(
+      requestWithSessionRecovery({ ...baseOpts(pool, stale), attempt }),
+    ).resolves.toBe("ok");
+    expect(pool.invalidateServerConnection).toHaveBeenCalledTimes(1);
+  });
+
+  it("rethrows non-recoverable errors without invalidating the pool", async () => {
+    const session = makeSession("stale");
+    const pool = makePool(undefined);
+    const boom = new Error("schema validation failed");
+    const attempt = vi.fn().mockRejectedValue(boom);
+
+    await expect(
+      requestWithSessionRecovery({ ...baseOpts(pool, session), attempt }),
+    ).rejects.toBe(boom);
+    expect(pool.invalidateServerConnection).not.toHaveBeenCalled();
+    expect(attempt).toHaveBeenCalledTimes(1);
+  });
+
+  it("throws a re-init error when no fresh session can be established", async () => {
+    const session = makeSession("stale");
+    const pool = makePool(undefined);
+    const attempt = vi.fn().mockRejectedValue(sessionLostError());
+
+    await expect(
+      requestWithSessionRecovery({ ...baseOpts(pool, session), attempt }),
+    ).rejects.toThrow(
+      /Failed to re-initialize session for server server-1 .* tools\/list/,
+    );
+    expect(attempt).toHaveBeenCalledTimes(1);
+  });
+
+  it("propagates the retry's failure when the fresh session also fails", async () => {
+    const stale = makeSession("stale");
+    const fresh = makeSession("fresh");
+    const pool = makePool(fresh);
+    const secondFailure = new Error("backend exploded after reconnect");
+    const attempt = vi
+      .fn()
+      .mockRejectedValueOnce(sessionLostError())
+      .mockRejectedValueOnc
```

**File**: `apps/backend/src/lib/metamcp/list-handler-recovery.ts` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+import { ServerParameters } from "@repo/zod-types";
+
+import logger from "@/utils/logger";
+
+import { ConnectedClient } from "./client";
+import { isRecoverableBackendError } from "./session-error";
+
+/**
+ * Minimal slice of McpServerPool the recovery wrapper needs. Structural
+ * so tests can drive the wrapper with a fake pool.
+ */
+export interface RecoverySessionPool {
+  invalidateServerConnection(
+    sessionId: string,
+    serverUuid: string,
+  ): Promise<void>;
+  getSession(
+    sessionId: string,
+    serverUuid: string,
+    params: ServerParameters,
+    namespaceUuid?: string,
+  ): Promise<ConnectedClient | undefined>;
+}
+
+export interface RequestWithSessionRecoveryOptions<T> {
+  pool: RecoverySessionPool;
+  sessionId: string;
+  serverUuid: string;
+  params: ServerParameters;
+  namespaceUuid?: string;
+  /** Operation label for log lines, e.g. "tools/list". */
+  operation: string;
+  /** Human-readable server name for log lines. */
+  serverName: string;
+  /** The (possibly stale) pooled session the caller already holds. */
+  session: ConnectedClient;
+  /**
+   * The actual backend request(s). Re-invoked exactly once on a fresh
+   * session if the first invocation fails with a recoverable backend
+   * error (session-lost / transport-lost envelope).
+   */
+  attempt: (session: ConnectedClient) => Promise<T>;
+  /**
+   * Called when recovery swapped in a fresh session — lets the caller
+   * repoint tool/prompt/resource maps to the new client.
+   */
+  onFreshSession?: (session: ConnectedClient) => void;
+}
+
+/**
+ * Invalidate-and-retry-once recovery cascade for the per-server fetch
+ * inside the aggregate list handlers (tools/list, prompts/list,
+ * resources/list, resources/templates/list).
+ *
+ * The aggregate list handlers previously logged-and-continued in their
+ * catch blocks, so a dead pooled session (e.g. after a restart of the
+ * backend container) made the namespace return a "successful" 0-tool
+ * response on every request, forever — the swallowed error meant the
+ * zombie connection was never invalidated.
+ *
+ * Throws when the error is non-recoverable, when no fresh session could
+ * be established, or when the retry on the fresh session fails — the
+ * caller decides whether that excludes one server from an aggregate
+ * response (and tracks it as degraded) or fails the request.
+ */
+export async function requestWithSessionRecovery<T>(
+  opts: RequestWithSessionRecoveryOptions<T>,
+): Promise<T> {
+  try {
+    return await opts.attempt(opts.session);
+  } catch (error) {
+    if (!isRecoverableBackendError(error)) {
+      throw error;
+    }
+
+    logger.warn(
+      `Backend connection lost for server ${opts.serverUuid} (${opts.serverName}) on ${opts.operation}; invalidating pool and retrying once. (envelope: ${
+        error instanceof Error ? error.message : String(error)
+      })`,
+    );
+
+    await opts.pool.invalidateServerConnection(opts.sessionId, opts.serverUuid);
+
+    const fresh = await opts.pool.getSession(
+      opts.sessionId,
+      opts.serverUuid,
+      opts.params,
+      opts.namespaceUuid,
+    );
+    if (!fresh) {
+      throw new Error(
+        `Failed to re-initialize session for server ${opts.serverUuid} after backend session loss during ${opts.operation}`,
+      );
+    }
+
+    opts.onFreshSession?.(fresh);
+    return await opts.attempt(fresh);
+  }
+}
```

**File**: `apps/backend/src/lib/metamcp/mcp-server-pool.ts` (modified, +85/-0)
```diff
@@ -437,6 +437,91 @@ export class McpServerPool {
     this.backgroundIdleSessionsByNamespace.set(namespaceUuid, options);
   }
 
+  /**
+   * Drop the pooled backend connection(s) for a given serverUuid.
+   *
+   * Used when a backend MCP server reports our Mcp-Session-Id is unknown
+   * or our transport is dead (e.g. after the backend container restarts and
+   * loses its in-memory session registry, or a Watchtower swap kills the
+   * socket). No replacement is created here; the next `getSession` call
+   * establishes a fresh connection (and therefore a fresh backend session)
+   * on demand.
+   *
+   * The invalidation CASCADES across every session's slot for the affected
+   * serverUuid, not just the triggering session's slot, plus the idle slot.
+   * When a backend container restarts, EVERY cached ConnectedClient for that
+   * serverUuid is dead — stale clients left in sibling sessions' slots for
+   * the same backend would defeat a single-slot invalidation: a later
+   * `getSession` for one of those siblings would hand back a dead client and
+   * the retry would fail with the same envelope that triggered recovery. So
+   * we drop them all.
+   */
+  async invalidateServerConnection(
+    sessionId: string,
+    serverUuid: string,
+  ): Promise<void> {
+    // Collect every doomed ConnectedClient across all active sessions plus
+    // the idle slot, dropping the map entries as we go.
+    const cleanupPromises: Promise<void>[] = [];
+
+    for (const [sid, sessionServers] of Object.entries(this.activeSessions)) {
+      const cachedClient = sessionServers[serverUuid];
+      if (!cachedClient) {
+        continue;
+      }
+      // Each cleanup is wrapped so one failure can't strand the rest — we
+      // WANT every stale slot dropped from the map regardless.
+      cleanupPromises.push(
+        (async () => {
+          try {
+            await cachedClient.cleanup();
+          } catch (error) {
+            logger.error(
+              `Error cleaning up invalidated active session ${sid}/${serverUuid}:`,
+              error,
+            );
+          }
+        })(),
+      );
+      delete sessionServers[serverUuid];
+      this.sessionToServers[sid]?.delete(serverUuid);
+    }
+
+    const idleClient = this.idleSessions[serverUuid];
+    if (idleClient) {
+      cleanupPromises.push(
+        (async () => {
+          try {
+            await idleClient.cleanup();
+          } catch (error) {
+            logger.error(
+              `Error cleaning up invalidated idle session for ${serverUuid}:`,
+              error,
+            );
+          }
+        })(),
+      );
+      delete this.idleSessions[serverUuid];
+    }
+
+    // Drop the in-flight idle-creation guard so the recovery's getSession
+    // call isn't blocked from spawning a fresh connection.
+    this.creatingIdleSessions.delete(serverUuid);
+
+    await Promise.all(cleanupPromises);
+
+    if (cleanupPromises.length > 0) {
+      logger.warn(
+        `Invalidated ${cleanupPromises.length} pooled backend connection(s) for server ${serverUuid} ` +
+          `(triggered by session ${sessionId}; cascaded across every active + idle slot for this serverUuid)`,
+      );
+    } else {
+      logger.warn(
+        `Invalidated pooled backend connection for server ${serverUuid} (session ${sessionId}) — no clients were cached`,
+      );
+    }
+  }
+
   /**
    * Invalidate and refresh idle session for a specific server
    * This should be called when a server's parameters (command, args, etc.) change
```

**File**: `apps/backend/src/lib/metamcp/metamcp-proxy.ts` (modified, +192/-54)
```diff
@@ -27,6 +27,7 @@ import { toolsImplementations } from "../../trpc/tools.impl";
 import { configService } from "../config.service";
 import { ConnectedClient } from "./client";
 import { getMcpServers } from "./fetch-metamcp";
+import { requestWithSessionRecovery } from "./list-handler-recovery";
 import { mcpServerPool } from "./mcp-server-pool";
 import {
   createFilterCallToolMiddleware,
@@ -157,6 +158,12 @@ export const createServer = async (
     );
     const allTools: Tool[] = [];
 
+    // Servers that should have contributed tools but failed even after the
+    // recovery retry (or had no session at all). Drives the degraded-response
+    // tripwire after the fan-out — a swallowed failure returns a "successful"
+    // 0-tool namespace and nobody notices until a manual restart.
+    const failedServers: string[] = [];
+
     // Track visited servers to detect circular references - reset on each call
     const visitedServers = new Set<string>();
 
@@ -186,6 +193,14 @@ export const createServer = async (
         );
         if (!session) {
           console.log(`[DEBUG-TOOLS] ❌ No session for: ${params.name}`);
+          // No pooled session and the pool couldn't create one — server is
+          // ERROR-gated, connection-capped, or unreachable. Error level: this
+          // server is silently missing from the namespace's tool surface
+          // until the pool recovers.
+          logger.error(
+            `tools/list: no session available for server ${params.name || mcpServerUuid} — excluded from namespace response (error state, connection cap, or backend unreachable)`,
+          );
+          failedServers.push(params.name || mcpServerUuid);
           return;
         }
 
@@ -217,32 +232,58 @@ export const createServer = async (
           params.name || session.client.getServerVersion()?.name || "";
 
         try {
-          // Paginated tool discovery - load all pages automatically
-          const allServerTools: Tool[] = [];
-          let cursor: string | undefined = undefined;
-          let hasMore = true;
           const toolFetchStart = performance.now();
 
-          while (hasMore) {
-            const result: z.infer<typeof ListToolsResultSchema> =
-              await session.client.request(
-                {
-                  method: "tools/list",
-                  params: {
-                    cursor: cursor,
-                    _meta: request.params?._meta,
+          // Paginated tool discovery - load all pages automatically
+          const fetchAllToolPages = async (
+            active: ConnectedClient,
+          ): Promise<Tool[]> => {
+            const pages: Tool[] = [];
+            let cursor: string | undefined = undefined;
+            let hasMore = true;
+
+            while (hasMore) {
+              const result: z.infer<typeof ListToolsResultSchema> =
+                await active.client.request(
+                  {
+                    method: "tools/list",
+                    params: {
+                      cursor: cursor,
+                      _meta: request.params?._meta,
+                    },
                   },
-                },
-                ListToolsResultSchema,
-              );
+                  ListToolsResultSchema,
+                );
+
+              if (result.tools && result.tools.length > 0) {
+                pages.push(...result.tools);
+              }
 
-            if (result.tools && result.tools.length > 0) {
-              allServerTools.push(...result.tools);
+              cursor = result.nextCursor;
+              hasMore = !!result.nextCursor;
             }
 
-            cursor = result.nextCursor;
-            hasMore = !!result.nextCursor;
-          }
+            return pages;
+          };
+
+          // Invalidate-and-retry-once on session-lost / transport-lost.
+          // Without it a dead pooled session is never evicted from here and
+          // the namespace serves 0 tools as "success" until a manual restart.
+          let activeSession = session;
+          const allServerTools = await requestWithSessionRecovery({
+            pool: mcpServerPool,
+            sessionId: context.sessionId,
+            serverUuid: mcpServerUuid,
+            params,
+            namespaceUuid,
+            operation: "tools/list",
+            serverName,
+            session,
+            attempt: fetchAllToolPages,
+            onFreshSession: (fresh) => {
+              activeSession = fresh;
+            },
+          });
 
           console.log(
             `[DEBUG-TOOLS] ⏱️  Fetched ${allServerTools.length} tools from ${serverName} in ${(performance.now() - toolFetchStart).toFixed(2)}ms`,
@@ -291,7 +332,7 @@ export const createServer = async (
           // Use original tools for client response (middleware will be applied later)
           const toolsWithSource = allServerTools.map((tool) => {
             const toolName = `${sanitizeName(serverName)}__${tool.name}`;
-            toolToCl
```

**File**: `apps/backend/vitest.config.ts` (modified, +10/-0)
```diff
@@ -1,6 +1,16 @@
+import path from "node:path";
+
 import { defineConfig } from "vitest/config";
 
 export default defineConfig({
+  resolve: {
+    alias: {
+      // Mirror the tsconfig.json `paths` mapping so unit tests can
+      // import modules that use the `@/` prefix without each test
+      // having to hand-mock every transitive logger / utils import.
+      "@": path.resolve(__dirname, "./src"),
+    },
+  },
   test: {
     globals: true,
     environment: "node",
```

#### Recent Merged Pull Requests:
- **PR #366** (closed): fix(frontend): clear rate limit fields when disabled (@Drm1804)
- **PR #356** (closed): test(w2): synthetic conflict with #355 (@terafin)
- **PR #355** (closed): fix: consolidated perf-live + adversarial audit fixes (Dockerfile build crash, leaks, DB tools path) (@terafin)
- **PR #354** (closed): fix(docker): make the Next.js proxy-request sed path-agnostic + fail-open (@terafin)
- **PR #353** (closed): perf(proxy): consolidated prewarm + never-spawn-unused + recovery + leak cleanup (backend-only) (@terafin)
- **PR #352** (closed): perf(proxy): consolidated prewarm + never-spawn-unused + leak cleanup (Sindri x Layer0) (@terafin)
- **PR #351** (closed): perf(proxy): Layer-0 DB tools, prewarm, pool bounds + reproducible Docker build (@terafin)
- **PR #350** (closed): perf(proxy): Layer-0 DB tools, prewarm, pool bounds + reproducible Docker build (@terafin)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
