# Forensic Learning Record (Deep Inspection): upstash/context7

> **Canonical Artifact**: `07_PROJECT_LEARNING/upstash-context7-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/upstash/context7](https://github.com/upstash/context7))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:49:35.325Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `upstash/context7`
- **Description**: Context7 Platform -- Up-to-date code documentation for LLMs and AI code editors
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 62710 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/cli/src/utils/api.ts`
```
import type {
  ListSkillsResponse,
  SingleSkillResponse,
  SearchResponse,
  SuggestResponse,
  DownloadResponse,
  LibrarySearchResponse,
  SkillQuestionsResponse,
  StructuredGenerateInput,
  GenerateStreamEvent,
  SkillQuotaResponse,
  ContextResponse,
} from "../types.js";
import { downloadSkillFromGitHub, getSkillFromGitHub } from "./github.js";
import { VERSION } from "../constants.js";

export const DEFAULT_CONTEXT7_BASE_URL = "https://context7.com";

let baseUrl = DEFAULT_CONTEXT7_BASE_URL;

export function getBaseUrl(): string {
  return baseUrl;
}

export function setBaseUrl(url: string): void {
  baseUrl = url;
}

// TODO(deprecate-skills-phase-2): Remove the Skill Hub API helpers in this file
// when deprecated `ctx7 skills ...` commands are deleted.
export async function listProjectSkills(project: string): Promise<ListSkillsResponse> {
  const params = new URLSearchParams({ project });
  const response = await fetch(`${baseUrl}/api/v2/skills?${params}`);
  return (await response.json()) as ListSkillsResponse;
}

export async function getSkill(project: string, skillName: string): Promise<SingleSkillResponse> {
  const params = new URLSearchParams({ project, skill: skillName });
  const response = await fetch(`${baseUrl}/api/v2/skills?${params}`);
  return (await response.json()) as SingleSkillResponse;
}

export async function searchSkills(query: string): Promise<SearchResponse> {
  const params = new URLSearchParams({ query });
  const response = await fetch(`${baseUrl}/api/v2/skills?${params}`);
  return (await response.json()) as SearchResponse;
}

export async function suggestSkills(
  dependencies: string[],
  accessToken?: string
): Promise<SuggestResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  const response = await fetch(`${baseUrl}/api/v2/skills/suggest`, {
    method: "POST",
    headers,
    body: JSON.stringify({ dependencies }),
  });
  return (await response.json()) as SuggestResponse;
}

export async function downloadSkill(project: string, skillName: string): Promise<DownloadResponse> {
  const skillData = await getSkill(project, skillName);

  if (skillData.error) {
    // handle private repo skills with env var
    const ghResult = await getSkillFromGitHub(project, skillName);
    if (ghResult.status !== "ok" || !ghResult.skill) {
      return {
        skill: { name: skillName, description: "", url: "", project },
        files: [],
        error: skillData.message || skillData.error,
      };
    }

    const { files, error } = await downloadSkillFromGitHub(ghResult.skill);
    if (error) {
      return { skill: ghResult.skill, files: [], error };
    }
    return { skill: ghResult.skill, files };
  }

  const skill = {
    name: skillData.name,
    description: skillData.description,
    url: skillData.url,
    project: skillData.project,
  };

  const { files, error } = await downloadSkillFromGitHub(skill);

  if (error) {
    return { skill, files: [], error };
  }

  return { skill, files };
}

export interface GenerateSkillResponse {
  content: string;
  libraryName: string;
  error?: string;
}

export async function searchLibraries(
  query: string,
  accessToken?: string
): Promise<LibrarySearchResponse> {
  const params = new URLSearchParams({ query });
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  const response = await fetch(`${baseUrl}/api/v2/libs/search?${params}`, { headers });
  return (await response.json()) as LibrarySearchResponse;
}

export async function getSkillQuota(accessToken: string): Promise<SkillQuotaResponse> {
  const response = await fetch(`${baseUrl}/api/v2/skills/quota`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      used: 0,
      limit: 0,
      remaining: 0,
      tier: "free",
      resetDate: null,
      error: (errorData as { message?: string }).message || `HTTP error ${response.status}`,
    };
  }

  return (await response.json()) as SkillQuotaResponse;
}

export async function getSkillQuestions(
  libraries: Array<{ id: string; name: string }>,
  motivation: string,
  accessToken?: string
): Promise<SkillQuestionsResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${baseUrl}/api/v2/skills/questions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ libraries, motivation }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      questions: [],
      error: (errorData as { message?: string }).message || `HTTP error ${response.status}`,
    };
  }

  return (await response.json()) as SkillQuestionsResponse;
}

export async function generateSkillStructured(
  input: StructuredGenerateInput,
  onEvent?: (event: GenerateStreamEvent) => void,
  accessToken?: string
): Promise<GenerateSkillResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${baseUrl}/api/v2/skills/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });

  const libraryName = input.libraries[0]?.name || "skill";
  return handleGenerateResponse(response, libraryName, onEvent);
}

async function handleGenerateResponse(
  response: Response,
  libraryName: string,
  onEvent?: (event: GenerateStreamEvent) => void
): Promise<GenerateSkillResponse> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      content: "",
      libraryName,
      error: (errorData as { message?: string }).message || `HTTP error ${response.status}`,
    };
  }

  const reader = response.body?.getReader();
  if (!reader) {
    return { content: "", libraryName, error: "No response body" };
  }

  const decoder = new TextDecoder();
  let content = "";
  let finalLibraryName = libraryName;
  let error: string | undefined;
  let buffer = ""; // Buffer for incomplete lines across chunks

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;

    // Split by newline but keep track of incomplete lines
    const lines = buffer.split("\n");
    // Keep the last element (may be incomplete) in the buffer
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      try {
        const data = JSON.parse(trimmedLine) as GenerateStreamEvent;

        if (onEvent) {
          onEvent(data);
        }

        if (data.type === "complete") {
          content = data.content || "";
          finalLibraryName = data.libraryName || libraryName;
        } else if (data.type === "error") {
          error = data.message;
        }
      } catch {
        // Ignore malformed JSON lines
      }
    }
  }

  // Process any remaining data in the buffer
  if (buffer.trim()) {
    try {
      const data = JSON.parse(buffer.trim()) as GenerateStreamEvent;
      if (onEvent) {
        onEvent(data);
      }
      if (data.type === "complete") {
        content = data.content || "";
        finalLibraryName = data.libraryName || libraryName;
      } else if (data.type === "error") {
        error = data.message;
      }
    } catch {
      // Ignore malformed JSON
    }
  }

  return { content, libraryName: finalLibraryName, error };
}

function getAuthHeaders(accessToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Context7-Source": "cli",
    "X-Context7-Client-IDE": "ctx7-cli",
    "X-Context7-Client-Version": VERSION,
    "X-Context7-Transport": "cli",
  };
  const apiKey = process.env.CONTEXT7_API_KEY;
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  } else if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  return headers;
}

export async function resolveLibrary(
  libraryName: string,
  query?: string,
  accessToken?: string
): Promise<LibrarySearchResponse> {
  const params = new URLSearchParams({ libraryName });
  if (query) {
    params.set("query", query);
  }

  const response = await fetch(`${baseUrl}/api/v2/libs/search?${params}`, {
    headers: getAuthHeaders(accessToken),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    return {
      results: [],
      error: errorData.error || `HTTP error ${response.status}`,
      message: errorData.message,
    };
  }

  return (await response.json()) as LibrarySearchResponse;
}

export interface GetContextOptions {
  type?: "json" | "txt";
}

export async function getLibraryContext(
  libraryId: string,
  query: string,
  options?: GetContextOptions,
  accessToken?: string
): Promise<ContextResponse | string> {
  const params = new URLSearchParams({ libraryId, query });
  if (options?.type) {
    params.set("type", options.type);
  }
  const headers = getAuthHeaders(accessToken);
  const response = await fetch(`${baseUrl}/api/v2/context?${params}`, {
    headers,
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      redirectUrl?: string;
    };

    if (response.status === 301 && errorData.redirectUrl) {
      return {
        codeSnippets: [],
        infoSnippets: [],
        error: errorData.error || "library_redirected",
        message: errorData.message,
        redirectUrl: errorData.redirectUrl,
      };
    }

    
```

### Core Architecture Module: `packages/cli/src/utils/auth.ts`
```
import * as fs from "fs";
import * as os from "os";
import { CLI_CLIENT_ID } from "../constants.js";
import { getBaseUrl } from "./api.js";
import {
  CREDENTIALS_FILE_NAME,
  getConfigDir,
  getCredentialsFilePath,
  getLegacyFilePath,
  migrateLegacyFileSync,
  resolveReadPathSync,
} from "./storage-paths.js";

export interface TokenData {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  expires_at?: number;
  scope?: string;
}

const CONTEXT7_API_KEY_PREFIX = "ctx7sk-";

/** Returns true when a credential uses Context7's API-key format. */
export function isContext7ApiKey(accessToken: string): boolean {
  return accessToken.startsWith(CONTEXT7_API_KEY_PREFIX);
}

function ensureConfigDir(): void {
  const configDir = getConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }
}

// Credentials must never be group/world-readable, even if a migrated or
// pre-existing file carried looser permissions.
const CREDENTIALS_MODE = 0o600;

export function saveTokens(tokens: TokenData): void {
  const credentialsFile = getCredentialsFilePath();
  migrateLegacyFileSync(CREDENTIALS_FILE_NAME, credentialsFile, CREDENTIALS_MODE);
  ensureConfigDir();
  const data = {
    ...tokens,
    expires_at:
      tokens.expires_at ?? (tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined),
  };
  fs.writeFileSync(credentialsFile, JSON.stringify(data, null, 2), { mode: CREDENTIALS_MODE });
  // `mode` is ignored when the file already exists; enforce it explicitly.
  fs.chmodSync(credentialsFile, CREDENTIALS_MODE);
}

export function loadTokens(): TokenData | null {
  const credentialsFile = resolveReadPathSync(
    CREDENTIALS_FILE_NAME,
    getCredentialsFilePath(),
    CREDENTIALS_MODE
  );
  if (!fs.existsSync(credentialsFile)) {
    return null;
  }
  try {
    const data = JSON.parse(fs.readFileSync(credentialsFile, "utf-8"));
    return data as TokenData;
  } catch {
    return null;
  }
}

export function clearTokens(): boolean {
  const credentialsFile = getCredentialsFilePath();
  let removed = false;
  if (fs.existsSync(credentialsFile)) {
    fs.unlinkSync(credentialsFile);
    removed = true;
  }
  const legacyCredentialsFile = getLegacyFilePath(CREDENTIALS_FILE_NAME);
  if (fs.existsSync(legacyCredentialsFile)) {
    fs.unlinkSync(legacyCredentialsFile);
    removed = true;
  }
  return removed;
}

export function isTokenExpired(tokens: TokenData): boolean {
  if (!tokens.expires_at) {
    return false;
  }
  return Date.now() > tokens.expires_at - 60000;
}

async function refreshAccessToken(refreshToken: string): Promise<TokenData> {
  return oauthRequest<TokenData>(
    `${getBaseUrl()}/api/oauth/token`,
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLI_CLIENT_ID,
      refresh_token: refreshToken,
    }),
    "Failed to refresh token"
  );
}

/**
 * Returns a valid access token, refreshing if expired. Returns undefined if no
 * tokens are stored or refresh fails. Pre-0.5 installs may have OAuth tokens
 * with a `refresh_token`; new installs hold long-lived API keys that never
 * expire and skip the refresh path entirely.
 */
export async function getValidAccessToken(): Promise<string | undefined> {
  const tokens = loadTokens();
  if (!tokens) return undefined;

  if (!isTokenExpired(tokens)) {
    return tokens.access_token;
  }

  if (!tokens.refresh_token) {
    return undefined;
  }

  try {
    const newTokens = await refreshAccessToken(tokens.refresh_token);
    // RFC 6749 §6: the response MAY omit refresh_token, and the client then
    // keeps the one it already holds. Writing the response verbatim would
    // drop it and log the user out at the next expiry.
    saveTokens({ refresh_token: tokens.refresh_token, ...newTokens });
    return newTokens.access_token;
  } catch {
    return undefined;
  }
}

interface TokenErrorResponse {
  error?: string;
  error_description?: string;
}

export interface DeviceAuthorizationResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  /** Optional per RFC 8628 §3.2; clients MUST default to 5s when absent. */
  interval?: number;
}

const DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

async function describeErrorResponse(response: Response, fallback: string): Promise<string> {
  const body = await response.text().catch(() => "");

  try {
    const err = JSON.parse(body) as TokenErrorResponse;
    const message = err.error_description || err.error;
    if (message) return message;
  } catch {
    // An interceptor's HTML, not an OAuth error object.
  }

  const excerpt = body.replace(/\s+/g, " ").trim().slice(0, 200);
  const detail = `HTTP ${response.status} from ${response.url}`;
  return excerpt ? `${fallback} (${detail}): ${excerpt}` : `${fallback} (${detail})`;
}

const TLS_HINT =
  "The TLS certificate could not be verified, which usually means a proxy is inspecting HTTPS traffic. Point NODE_EXTRA_CA_CERTS at your organization's root CA.";
const DNS_HINT = "DNS lookup failed. Check your network or VPN connection.";
const BLOCKED_HINT =
  "The connection was refused or reset, which usually means a firewall or proxy is blocking it.";
const TIMEOUT_HINT = "The connection timed out. A proxy or firewall may be dropping the request.";
const DEFAULT_HINT =
  "If you are behind a corporate proxy, note that Node does not use HTTPS_PROXY automatically.";

const CONNECTION_HINTS: Record<string, string> = {
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: TLS_HINT,
  SELF_SIGNED_CERT_IN_CHAIN: TLS_HINT,
  DEPTH_ZERO_SELF_SIGNED_CERT: TLS_HINT,
  CERT_HAS_EXPIRED: TLS_HINT,
  ENOTFOUND: DNS_HINT,
  EAI_AGAIN: DNS_HINT,
  ECONNREFUSED: BLOCKED_HINT,
  ECONNRESET: BLOCKED_HINT,
  EHOSTUNREACH: BLOCKED_HINT,
  ENETUNREACH: BLOCKED_HINT,
  UND_ERR_CONNECT_TIMEOUT: TIMEOUT_HINT,
  ETIMEDOUT: TIMEOUT_HINT,
};

function getErrorCause(error: unknown): { code?: string; message?: string } {
  if (typeof error !== "object" || error === null || !("cause" in error)) return {};
  const cause = (error as { cause: unknown }).cause;
  if (typeof cause !== "object" || cause === null) return {};

  const { code, message } = cause as { code?: unknown; message?: unknown };
  return {
    code: typeof code === "string" ? code : undefined,
    message: typeof message === "string" ? message : undefined,
  };
}

function describeConnectionError(error: unknown, url: string): string {
  const { code, message } = getErrorCause(error);
  const detail = message || (error instanceof Error ? error.message : String(error));
  const hint = (code && CONNECTION_HINTS[code]) || DEFAULT_HINT;

  return `Could not reach ${url}: ${detail}${code ? ` (${code})` : ""}\n${hint}`;
}

async function postForm(url: string, params: URLSearchParams): Promise<Response> {
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch (error) {
    throw new Error(describeConnectionError(error, url));
  }
}

async function oauthRequest<T>(url: string, params: URLSearchParams, fallback: string): Promise<T> {
  const response = await postForm(url, params);
  if (!response.ok) {
    throw new Error(await describeErrorResponse(response, fallback));
  }
  return (await response.json()) as T;
}

/** RFC 8628 §3.2 default poll interval when the server omits `interval`. */
export const DEFAULT_DEVICE_POLL_INTERVAL_SECONDS = 5;

export async function startDeviceAuthorization(
  baseUrl: string,
  clientId: string
): Promise<DeviceAuthorizationResponse> {
  // Hostname is shown on the server's verification page so the user can confirm
  // that the device they're authorizing matches the one running the CLI
  // (RFC 8628 §5.4 phishing resistance). Best-effort.
  const params = new URLSearchParams({ client_id: clientId });
  try {
    const hostname = os.hostname();
    if (hostname) params.set("hostname", hostname);
  } catch {
    // ignore
  }

  return oauthRequest<DeviceAuthorizationResponse>(
    `${baseUrl}/api/oauth/device/code`,
    params,
    "Failed to start device authorization"
  );
}

export interface PollDeviceTokenResult {
  status: "approved" | "pending" | "slow_down" | "denied" | "expired" | "transient";
  tokens?: TokenData;
  errorMessage?: string;
}

export async function pollDeviceToken(
  baseUrl: string,
  clientId: string,
  deviceCode: string
): Promise<PollDeviceTokenResult> {
  let response: Response;
  try {
    response = await postForm(
      `${baseUrl}/api/oauth/device/token`,
      new URLSearchParams({
        grant_type: DEVICE_CODE_GRANT,
        device_code: deviceCode,
        client_id: clientId,
      })
    );
  } catch (error) {
    // Network blip — keep polling.
    return {
      status: "transient",
      errorMessage: error instanceof Error ? error.message : "network error",
    };
  }

  if (response.ok) {
    const tokens = (await response.json()) as TokenData;
    return { status: "approved", tokens };
  }

  // Treat any 5xx as transient so a flaky backend doesn't end the user's session.
  if (response.status >= 500) {
    const err = (await response.json().catch(() => ({}))) as TokenErrorResponse;
    return {
      status: "transient",
      errorMessage: err.error_description || err.error || `HTTP ${response.status}`,
    };
  }

  const err = (await response.json().catch(() => ({}))) as TokenErrorResponse;
  switch (err.error) {
    case "authorization_pending":
      return { status: "pending" };
    case "slow_down":
      return { status: "slow_down" };
    case "access_denied":
      return { status: "denied" };
    case "expired_token":
      return { status: "expired" };
    default:
      throw new Error(err.error_description || err.error || "Device token poll failed");
  }
}

```

### Core Architecture Module: `packages/cli/src/utils/deps.ts`
```
import { readFile } from "fs/promises";
import { join } from "path";

async function readFileOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return null;
  }
}

/** Basic client-side filter. The real SKIP_SET lives on the backend. */
function isSkippedLocally(name: string): boolean {
  return name.startsWith("@types/");
}

async function parsePackageJson(cwd: string): Promise<string[]> {
  const content = await readFileOrNull(join(cwd, "package.json"));
  if (!content) return [];

  try {
    const pkg = JSON.parse(content);
    const names = new Set<string>();

    for (const key of Object.keys(pkg.dependencies || {})) {
      if (!isSkippedLocally(key)) names.add(key);
    }
    for (const key of Object.keys(pkg.devDependencies || {})) {
      if (!isSkippedLocally(key)) names.add(key);
    }

    return [...names];
  } catch {
    return [];
  }
}

async function parseRequirementsTxt(cwd: string): Promise<string[]> {
  const content = await readFileOrNull(join(cwd, "requirements.txt"));
  if (!content) return [];

  const deps: string[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) continue;
    const name = trimmed.split(/[=<>!~;@\s\[]/)[0].trim();
    if (name && !isSkippedLocally(name)) {
      deps.push(name);
    }
  }
  return deps;
}

async function parsePyprojectToml(cwd: string): Promise<string[]> {
  const content = await readFileOrNull(join(cwd, "pyproject.toml"));
  if (!content) return [];

  const deps: string[] = [];
  const seen = new Set<string>();

  const projectDepsMatch = content.match(/\[project\]\s[\s\S]*?dependencies\s*=\s*\[([\s\S]*?)\]/);
  if (projectDepsMatch) {
    const entries = projectDepsMatch[1].match(/"([^"]+)"/g) || [];
    for (const entry of entries) {
      const name = entry
        .replace(/"/g, "")
        .split(/[=<>!~;@\s\[]/)[0]
        .trim();
      if (name && !isSkippedLocally(name) && !seen.has(name)) {
        seen.add(name);
        deps.push(name);
      }
    }
  }

  const poetryMatch = content.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?:\n\[|$)/);
  if (poetryMatch) {
    const lines = poetryMatch[1].split("\n");
    for (const line of lines) {
      const match = line.match(/^(\S+)\s*=/);
      if (match) {
        const name = match[1].trim();
        if (name && !isSkippedLocally(name) && name !== "python" && !seen.has(name)) {
          seen.add(name);
          deps.push(name);
        }
      }
    }
  }

  return deps;
}

export async function detectProjectDependencies(cwd: string): Promise<string[]> {
  const results = await Promise.all([
    parsePackageJson(cwd),
    parseRequirementsTxt(cwd),
    parsePyprojectToml(cwd),
  ]);

  return [...new Set(results.flat())];
}

```

### Core Architecture Module: `packages/cli/src/utils/github.ts`
```
import { execFileSync } from "node:child_process";
import type { SkillFile, Skill } from "../types.js";
import { isSafeSkillName } from "./skill-name.js";

const GITHUB_API = "https://api.github.com";
const GITHUB_RAW = "https://raw.githubusercontent.com";

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
  url: string;
}

interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

function parseGitHubUrl(url: string): {
  owner: string;
  repo: string;
  branch: string;
  path: string;
} | null {
  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split("/").filter(Boolean);

    // Handle raw.githubusercontent.com URLs
    // Format: https://raw.githubusercontent.com/owner/repo/refs/heads/branch/path/SKILL.md
    if (urlObj.hostname === "raw.githubusercontent.com") {
      if (parts.length < 5) return null;

      const owner = parts[0];
      const repo = parts[1];

      // Handle refs/heads/branch format
      if (parts[2] === "refs" && parts[3] === "heads") {
        const branch = parts[4];
        // Get directory path (exclude the filename like SKILL.md)
        const pathParts = parts.slice(5);
        // Remove the last part if it looks like a file (has extension)
        if (pathParts.length > 0 && pathParts[pathParts.length - 1].includes(".")) {
          pathParts.pop();
        }
        const path = pathParts.join("/");
        return { owner, repo, branch, path };
      }

      // Handle direct branch format: owner/repo/branch/path
      const branch = parts[2];
      const pathParts = parts.slice(3);
      if (pathParts.length > 0 && pathParts[pathParts.length - 1].includes(".")) {
        pathParts.pop();
      }
      const path = pathParts.join("/");
      return { owner, repo, branch, path };
    }

    // Handle github.com tree URLs
    // Format: https://github.com/owner/repo/tree/branch/path
    if (urlObj.hostname === "github.com") {
      if (parts.length < 4 || parts[2] !== "tree") return null;

      const owner = parts[0];
      const repo = parts[1];
      const branch = parts[3];
      const path = parts.slice(4).join("/");

      return { owner, repo, branch, path };
    }

    return null;
  } catch {
    return null;
  }
}

function getGitHubToken(): string | undefined {
  const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (envToken) return envToken;
  try {
    // Deliberately shell-free: execSync would wrap this in `cmd.exe /d /s /c` on Windows,
    // which EDR tooling reports as suspicious Node behavior (#2918). Do not add `shell`
    // to make a .cmd/.bat `gh` shim resolve; that reintroduces the flagged process for
    // everyone. Such shims are rare (mainstream Windows installs ship gh.exe) and only
    // cost the fallback to unauthenticated requests.
    return execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

function parseSkillFrontmatter(content: string): { name: string; description: string } | null {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return null;

  const frontmatter = frontmatterMatch[1];

  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  if (!nameMatch) return null;
  const name = nameMatch[1].trim().replace(/^["']|["']$/g, "");
  if (!isSafeSkillName(name)) return null;

  let description = "";
  const multiLineMatch = frontmatter.match(/^description:\s*([|>])-?\s*$/m);

  if (multiLineMatch) {
    const descLineIndex = frontmatter.indexOf("description:");
    const lines = frontmatter.slice(descLineIndex).split("\n").slice(1);
    const indentedLines: string[] = [];
    for (const line of lines) {
      if (line.trim() === "") {
        indentedLines.push("");
        continue;
      }
      if (/^\s+/.test(line)) {
        indentedLines.push(line);
      } else {
        break;
      }
    }
    const firstNonEmpty = indentedLines.find((l) => l.trim().length > 0);
    const indent = firstNonEmpty?.match(/^(\s+)/)?.[1].length ?? 0;
    description = indentedLines
      .map((line) => line.slice(indent))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  } else {
    const singleMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (singleMatch) {
      const value = singleMatch[1].trim();
      if (!["|", ">", "|-", ">-"].includes(value)) {
        description = value.replace(/^["']|["']$/g, "");
      }
    }
  }

  if (!description) return null;
  return { name, description };
}

function getGitHubHeaders(): Record<string, string> {
  const ghToken = getGitHubToken();
  return {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "context7-cli",
    ...(ghToken && { Authorization: `token ${ghToken}` }),
  };
}

async function extractGitHubError(response: Response): Promise<string> {
  let detail = `HTTP ${response.status}`;
  try {
    const body = (await response.json()) as { message?: string };
    if (body.message) detail += `: ${body.message}`;
  } catch {}
  return detail;
}

async function fetchRepoTree(
  owner: string,
  repo: string,
  branch: string,
  headers: Record<string, string>
): Promise<GitHubTreeResponse | { error: string }> {
  const treeUrl = `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const response = await fetch(treeUrl, { headers });
  if (!response.ok) return { error: await extractGitHubError(response) };
  return (await response.json()) as GitHubTreeResponse;
}

async function fetchDefaultBranch(
  owner: string,
  repo: string,
  headers: Record<string, string>
): Promise<{ branch: string } | { error: string; status: number }> {
  const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, { headers });
  if (!response.ok) return { error: await extractGitHubError(response), status: response.status };
  const data = (await response.json()) as { default_branch: string };
  return { branch: data.default_branch };
}

type GitHubSkillsResult =
  | { status: "ok"; skills: (Skill & { project: string })[] }
  | { status: "repo_not_found" }
  | { status: "error"; error: string };

// TODO(deprecate-skills-phase-2): Remove direct GitHub Skill Hub fallback when
// deprecated `ctx7 skills install/info` commands are deleted.
export async function listSkillsFromGitHub(project: string): Promise<GitHubSkillsResult> {
  try {
    const parts = project.split("/").filter(Boolean);
    if (parts.length < 2) return { status: "error", error: "Invalid project format" };
    const [owner, repo] = parts;

    const headers = getGitHubHeaders();
    const branchResult = await fetchDefaultBranch(owner, repo, headers);
    if ("error" in branchResult) {
      if (branchResult.status === 404) return { status: "repo_not_found" };
      return { status: "error", error: branchResult.error };
    }

    const treeData = await fetchRepoTree(owner, repo, branchResult.branch, headers);
    if ("error" in treeData) return { status: "error", error: treeData.error };

    const skillMdFiles = treeData.tree.filter(
      (item) => item.type === "blob" && item.path.toLowerCase().endsWith("skill.md")
    );

    const skills: (Skill & { project: string })[] = [];
    for (const item of skillMdFiles) {
      const rawUrl = `${GITHUB_RAW}/${owner}/${repo}/${branchResult.branch}/${item.path}`;
      const response = await fetch(rawUrl, { headers });
      if (!response.ok) continue;

      const content = await response.text();
      const meta = parseSkillFrontmatter(content);
      if (!meta) continue;

      const skillDir = item.path.split("/").slice(0, -1).join("/");
      skills.push({
        name: meta.name,
        description: meta.description,
        url: `https://github.com/${owner}/${repo}/tree/${branchResult.branch}/${skillDir}`,
        project,
      });
    }

    return { status: "ok", skills };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "error", error: message };
  }
}

export async function getSkillFromGitHub(
  project: string,
  skillName: string
): Promise<GitHubSkillsResult & { skill?: Skill & { project: string } }> {
  const result = await listSkillsFromGitHub(project);
  if (result.status !== "ok") return result;
  const skill = result.skills.find((s) => s.name.toLowerCase() === skillName.toLowerCase());
  return { ...result, skill };
}

async function downloadSkillTree(
  owner: string,
  repo: string,
  branch: string,
  skillPath: string,
  ghHeaders: Record<string, string>
): Promise<{ files: SkillFile[]; error?: string }> {
  const treeData = await fetchRepoTree(owner, repo, branch, ghHeaders);
  if ("error" in treeData) {
    const hint =
      !ghHeaders["Authorization"] && /403|429|rate/.test(treeData.error)
        ? " — run `gh auth login` or set the GITHUB_TOKEN env var to increase rate limits"
        : "";
    return { files: [], error: `GitHub API error: ${treeData.error}${hint}` };
  }

  const skillFiles = treeData.tree.filter(
    (item) => item.type === "blob" && item.path.startsWith(skillPath + "/")
  );

  if (skillFiles.length === 0) {
    return { files: [], error: `No files found in ${skillPath}` };
  }

  const files: SkillFile[] = [];
  for (const item of skillFiles) {
    const rawUrl = `${GITHUB_RAW}/${owner}/${repo}/${branch}/${item.path}`;
    const fileResponse = await fetch(rawUrl, { headers: ghHeaders });

    if (!fileResponse.ok) {
      console.warn(`Failed to fetch ${item.path}: ${fileResponse.status}`);
      continue;
    }

    const content = await fileResponse.text();
    const relativePath = item.path.slice(skillPath.length + 1);

    // Reject paths that attempt directory traversal
    if (relativePath.includes("..")) {
      console.warn(`Skipping file with unsafe path: ${item.path}`);
      continue;
    }

    files.push({
      p
```

### Core Architecture Module: `packages/cli/src/utils/ide.ts`
```
import pc from "picocolors";
import { select, confirm } from "@inquirer/prompts";
import { access } from "fs/promises";
import { join, dirname } from "path";
import { homedir } from "os";

import { log } from "./logger.js";
import { checkboxWithHover } from "./prompts.js";
import type {
  IDE,
  IDEOptions,
  Scope,
  AddOptions,
  ListOptions,
  RemoveOptions,
  InstallTargets,
} from "../types.js";
import {
  IDE_PATHS,
  IDE_GLOBAL_PATHS,
  IDE_NAMES,
  UNIVERSAL_SKILLS_PATH,
  UNIVERSAL_SKILLS_GLOBAL_PATH,
  UNIVERSAL_AGENTS_LABEL,
  VENDOR_SPECIFIC_AGENTS,
  DEFAULT_CONFIG,
} from "../types.js";

export function getSelectedIdes(options: IDEOptions): IDE[] {
  if (options.allAgents) {
    return ["universal", ...VENDOR_SPECIFIC_AGENTS];
  }

  const ides: IDE[] = [];
  if (options.claude) ides.push("claude");
  if (options.cursor) ides.push("cursor");
  if (options.universal) ides.push("universal");
  if (options.antigravity) ides.push("antigravity");
  return ides;
}

export function hasExplicitIdeOption(options: IDEOptions): boolean {
  return !!(
    options.allAgents ||
    options.claude ||
    options.cursor ||
    options.universal ||
    options.antigravity
  );
}

/** Detect vendor-specific agents whose parent directory exists. */
async function detectVendorSpecificAgents(scope: Scope): Promise<IDE[]> {
  const baseDir = scope === "global" ? homedir() : process.cwd();
  const pathMap = scope === "global" ? IDE_GLOBAL_PATHS : IDE_PATHS;
  const detected: IDE[] = [];

  for (const ide of VENDOR_SPECIFIC_AGENTS) {
    const parentDir = dirname(pathMap[ide]);
    try {
      await access(join(baseDir, parentDir));
      detected.push(ide);
    } catch {}
  }

  return detected;
}

export function getUniversalDir(scope: Scope): string {
  if (scope === "global") {
    return join(homedir(), UNIVERSAL_SKILLS_GLOBAL_PATH);
  }
  return join(process.cwd(), UNIVERSAL_SKILLS_PATH);
}

export async function promptForInstallTargets(
  options: AddOptions,
  forceUniversal = true
): Promise<InstallTargets | null> {
  if (hasExplicitIdeOption(options)) {
    const ides = getSelectedIdes(options);
    const scope: Scope = options.global ? "global" : "project";
    return {
      ides: ides.length > 0 ? ides : [DEFAULT_CONFIG.defaultIde],
      scopes: [scope],
    };
  }

  const scope: Scope = options.global ? "global" : "project";
  const baseDir = scope === "global" ? homedir() : process.cwd();
  const pathMap = scope === "global" ? IDE_GLOBAL_PATHS : IDE_PATHS;
  const universalPath = scope === "global" ? UNIVERSAL_SKILLS_GLOBAL_PATH : UNIVERSAL_SKILLS_PATH;

  // Detect universal (.agents/) and vendor-specific agent directories
  const detectedVendor = await detectVendorSpecificAgents(scope);
  let hasUniversalDir = false;
  try {
    await access(join(baseDir, dirname(universalPath)));
    hasUniversalDir = true;
  } catch {}

  const detectedIdes: IDE[] = [
    ...(hasUniversalDir ? (["universal"] as IDE[]) : []),
    ...detectedVendor,
  ];

  if (detectedIdes.length > 0) {
    // Detected — just confirm
    const pathLines: string[] = [];
    if (hasUniversalDir) {
      pathLines.push(join(baseDir, universalPath));
    }
    for (const ide of detectedVendor) {
      pathLines.push(join(baseDir, pathMap[ide]));
    }

    log.blank();

    let confirmed: boolean;
    if (options.yes) {
      confirmed = true;
    } else {
      try {
        confirmed = await confirm({
          message: `Install to detected location(s)?\n${pc.dim(pathLines.join("\n"))}`,
          default: true,
        });
      } catch {
        return null;
      }
    }

    if (!confirmed) {
      log.warn("Installation cancelled");
      return null;
    }

    return { ides: detectedIdes, scopes: [scope] };
  }

  // Nothing detected — show checkbox to pick
  const universalLabel = `Universal \u2014 ${UNIVERSAL_AGENTS_LABEL} ${pc.dim(`(${universalPath})`)}`;
  const choices: { name: string; value: IDE; checked: boolean }[] = [
    {
      name: `${IDE_NAMES["claude"]} ${pc.dim(`(${pathMap["claude"]})`)}`,
      value: "claude" as IDE,
      checked: false,
    },
    { name: universalLabel, value: "universal", checked: false },
  ];

  for (const ide of VENDOR_SPECIFIC_AGENTS.filter((ide) => ide !== "claude")) {
    choices.push({
      name: `${IDE_NAMES[ide]} ${pc.dim(`(${pathMap[ide]})`)}`,
      value: ide,
      checked: false,
    });
  }

  log.blank();

  let selectedIdes: IDE[];
  try {
    selectedIdes = await checkboxWithHover(
      {
        message: `Which agents do you want to install to?\n${pc.dim(`  ${baseDir}`)}`,
        choices,
        loop: false,
        theme: {
          style: {
            highlight: (text: string) => pc.green(text),
            message: (text: string, status: string) => {
              if (status === "done") return text.split("\n")[0];
              return pc.bold(text);
            },
          },
        },
      },
      { getName: (ide: IDE) => IDE_NAMES[ide] }
    );
  } catch {
    return null;
  }

  const ides: IDE[] = forceUniversal
    ? ["universal", ...selectedIdes.filter((ide) => ide !== "universal")]
    : selectedIdes;

  return { ides, scopes: [scope] };
}

export async function promptForSingleTarget(
  options: ListOptions | RemoveOptions
): Promise<{ ide: IDE; scope: Scope } | null> {
  if (hasExplicitIdeOption(options)) {
    const ides = getSelectedIdes(options);
    const ide = ides[0] || DEFAULT_CONFIG.defaultIde;
    const scope: Scope = options.global ? "global" : "project";
    return { ide, scope };
  }

  log.blank();

  const universalLabel = `Universal ${pc.dim(`(${UNIVERSAL_SKILLS_PATH})`)}`;
  const choices: { name: string; value: IDE }[] = [
    { name: `${IDE_NAMES["claude"]} ${pc.dim(`(${IDE_PATHS["claude"]})`)}`, value: "claude" },
    { name: universalLabel, value: "universal" },
  ];

  for (const ide of VENDOR_SPECIFIC_AGENTS.filter((ide) => ide !== "claude")) {
    choices.push({
      name: `${IDE_NAMES[ide]} ${pc.dim(`(${IDE_PATHS[ide]})`)}`,
      value: ide,
    });
  }

  let selectedIde: IDE;
  try {
    selectedIde = await select({
      message: "Which location?",
      choices,
      default: DEFAULT_CONFIG.defaultIde,
      loop: false,
      theme: { style: { highlight: (text: string) => pc.green(text) } },
    });
  } catch {
    return null;
  }

  let selectedScope: Scope;
  if (options.global !== undefined) {
    selectedScope = options.global ? "global" : "project";
  } else {
    try {
      selectedScope = await select({
        message: "Which scope?",
        choices: [
          {
            name: `Project ${pc.dim("(current directory)")}`,
            value: "project" as Scope,
          },
          {
            name: `Global ${pc.dim("(home directory)")}`,
            value: "global" as Scope,
          },
        ],
        default: DEFAULT_CONFIG.defaultScope,
        loop: false,
        theme: { style: { highlight: (text: string) => pc.green(text) } },
      });
    } catch {
      return null;
    }
  }

  return { ide: selectedIde, scope: selectedScope };
}

export function getTargetDirs(targets: InstallTargets): string[] {
  const hasUniversal = targets.ides.some((ide) => ide === "universal");
  const dirs: string[] = [];

  for (const scope of targets.scopes) {
    const baseDir = scope === "global" ? homedir() : process.cwd();

    if (hasUniversal) {
      const uniPath = scope === "global" ? UNIVERSAL_SKILLS_GLOBAL_PATH : UNIVERSAL_SKILLS_PATH;
      dirs.push(join(baseDir, uniPath));
    }

    for (const ide of targets.ides) {
      if (ide === "universal") continue;
      const pathMap = scope === "global" ? IDE_GLOBAL_PATHS : IDE_PATHS;
      dirs.push(join(baseDir, pathMap[ide]));
    }
  }

  return dirs;
}

export function getTargetDirFromSelection(ide: IDE, scope: Scope): string {
  if (ide === "universal") {
    return getUniversalDir(scope);
  }
  if (scope === "global") {
    return join(homedir(), IDE_GLOBAL_PATHS[ide]);
  }
  return join(process.cwd(), IDE_PATHS[ide]);
}

```

### Core Architecture Module: `packages/cli/src/utils/installer.ts`
```
import { mkdir, writeFile, rm, symlink, lstat } from "fs/promises";
import { resolve, dirname } from "path";

import type { SkillFile } from "../types.js";
import { assertSkillNameInRoot } from "./skill-name.js";

export async function installSkillFiles(
  skillName: string,
  files: SkillFile[],
  skillsRoot: string
): Promise<void> {
  const skillDir = assertSkillNameInRoot(skillsRoot, skillName);

  for (const file of files) {
    const filePath = resolve(skillDir, file.path);

    // Prevent directory traversal — resolved path must stay within skillDir
    if (
      !filePath.startsWith(skillDir + "/") &&
      !filePath.startsWith(skillDir + "\\") &&
      filePath !== skillDir
    ) {
      throw new Error(`Skill file path "${file.path}" resolves outside the target directory`);
    }

    const fileDir = dirname(filePath);

    await mkdir(fileDir, { recursive: true });
    await writeFile(filePath, file.content);
  }
}

export async function symlinkSkill(
  skillName: string,
  sourcePath: string,
  skillsRoot: string
): Promise<void> {
  const targetPath = assertSkillNameInRoot(skillsRoot, skillName);

  try {
    const stats = await lstat(targetPath);
    if (stats.isSymbolicLink() || stats.isDirectory()) {
      await rm(targetPath, { recursive: true });
    }
  } catch {}

  await mkdir(skillsRoot, { recursive: true });
  await symlink(sourcePath, targetPath);
}

```

### Core Architecture Module: `packages/cli/src/utils/library-id.ts`
```
/**
 * Recover a library ID that Git Bash mangled on Windows.
 *
 * Git Bash rewrites a leading-slash argument like "/facebook/react" into a
 * Windows path under the Git install dir, e.g. "C:/Program Files/Git/facebook/react".
 * We undo that so the "/owner/repo" format still works.
 */
export function recoverLibraryId(input: string): string {
  // "//owner/repo" is the Git Bash escape that skips conversion; collapse it.
  if (input.startsWith("//")) return input.replace(/^\/+/, "/");

  // Normal library ID, nothing to recover.
  if (input.startsWith("/")) return input;

  // Only a drive-letter path (e.g. "C:/...") can be a mangled ID.
  if (!/^[A-Za-z]:[\\/]/.test(input)) return input;

  // Strip the Git install dir, keeping the "/owner/repo[/version]" tail.
  const normalized = input.replace(/\\/g, "/");

  // Scoop installs Git under apps/git/<version> with a "current" junction.
  // Discard either form before recovering the library ID.
  const scoopMatch = normalized.match(
    /^[A-Za-z]:\/.*\/apps\/git\/(?:v?\d+(?:\.\d+)+[^/]*|current)\/(.+)$/i
  );
  if (scoopMatch) return `/${scoopMatch[1]}`;

  const match = normalized.match(/^[A-Za-z]:\/.*?\/(?:Git|PortableGit|git-bash)\/(.+)$/i);
  return match ? `/${match[1]}` : input;
}

```

### Core Architecture Module: `packages/cli/src/utils/logger.ts`
```
import pc from "picocolors";

const ANSI_PATTERN = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

function visibleLength(text: string): number {
  return text.replace(ANSI_PATTERN, "").length;
}

function padVisible(text: string, width: number): string {
  const padding = Math.max(0, width - visibleLength(text));
  return text + " ".repeat(padding);
}

export function box(lines: string[], color: (message: string) => string = pc.green): void {
  const contentWidth = Math.max(...lines.map((line) => visibleLength(line)), 0);
  const top = color(`┌${"─".repeat(contentWidth + 2)}┐`);
  const bottom = color(`└${"─".repeat(contentWidth + 2)}┘`);

  console.log(top);
  for (const line of lines) {
    console.log(color("│ ") + padVisible(line, contentWidth) + color(" │"));
  }
  console.log(bottom);
}

export const log = {
  info: (message: string) => console.log(pc.cyan(message)),
  success: (message: string) => console.log(pc.green(`✔ ${message}`)),
  warn: (message: string) => console.log(pc.yellow(`⚠ ${message}`)),
  error: (message: string) => console.log(pc.red(`✖ ${message}`)),
  dim: (message: string) => console.log(pc.dim(message)),
  item: (message: string) => console.log(pc.green(`  ${message}`)),
  itemAdd: (message: string) => console.log(`  ${pc.green("+")} ${message}`),
  plain: (message: string) => console.log(message),
  blank: () => console.log(""),
  box,
};

```

### Core Architecture Module: `packages/cli/src/utils/parse-input.ts`
```
export interface ParsedSkillInput {
  type: "repo" | "url";
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
}

export function parseSkillInput(input: string): ParsedSkillInput | null {
  const urlMatch = input.match(
    /(?:https?:\/\/)?github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)\/(.+)/
  );
  if (urlMatch) {
    const [, owner, repo, branch, path] = urlMatch;
    return { type: "url", owner, repo, branch, path };
  }

  const shortMatch = input.match(/^\/?([^\/]+)\/([^\/]+)$/);
  if (shortMatch) {
    const [, owner, repo] = shortMatch;
    return { type: "repo", owner, repo };
  }

  return null;
}

```

### Core Architecture Module: `packages/cli/src/utils/prompts.ts`
```
import pc from "picocolors";
import { checkbox, type Separator } from "@inquirer/prompts";
import readline from "readline";

type CheckboxConfig<T> = Parameters<typeof checkbox<T>>[0];
type CheckboxChoice<T> = Exclude<CheckboxConfig<T>["choices"][number], Separator | string>;

/**
 * Creates a clickable terminal hyperlink using OSC 8 escape sequence.
 */
export function terminalLink(text: string, url: string, color?: (s: string) => string): string {
  const colorFn = color ?? ((s: string) => s);
  return `\x1b]8;;${url}\x07${colorFn(text)}\x1b]8;;\x07 ${pc.white("↗")}`;
}

/**
 * Formats install count into a popularity star rating (4 stars).
 * 0/unknown → ☆☆☆☆, <100 → ★☆☆☆, <500 → ★★☆☆, <1000 → ★★★☆, 1000+ → ★★★★
 */
export function formatPopularity(count: number | undefined): string {
  const filled = "★";
  const empty = "☆";
  const max = 4;
  let stars: number;
  if (count === undefined || count === 0) stars = 0;
  else if (count < 100) stars = 1;
  else if (count < 500) stars = 2;
  else if (count < 1000) stars = 3;
  else stars = 4;

  const filledPart = filled.repeat(stars);
  const emptyPart = empty.repeat(max - stars);
  if (stars === 0) return pc.dim(emptyPart);
  return pc.yellow(filledPart) + pc.dim(emptyPart);
}

/**
 * Returns the install count as a human-readable range string.
 */
export function formatInstallRange(count: number | undefined): string {
  if (count === undefined || count === 0) return "Unknown";
  if (count < 100) return "<100";
  if (count < 500) return "<500";
  if (count < 1000) return "<1,000";
  return "1,000+";
}

/**
 * Formats trust score as High / Medium / Low label.
 * Uses MCP reputation thresholds: >=7 High, >=4 Medium, <4 Low.
 */
export function formatTrust(score: number | undefined): string {
  if (score === undefined || score < 0) return pc.dim("-");
  if (score >= 7) return pc.green("High");
  if (score >= 4) return pc.yellow("Medium");
  return pc.red("Low");
}

/**
 * Returns the raw trust label string (uncolored) for width calculations.
 */
export function getTrustLabel(score: number | undefined): string {
  if (score === undefined || score < 0) return "-";
  if (score >= 7) return "High";
  if (score >= 4) return "Medium";
  return "Low";
}
export interface CheckboxWithHoverOptions<T> {
  /** Function to extract display name from value. Defaults to (v) => v.name */
  getName?: (value: T) => string;
}

export async function checkboxWithHover<T>(
  config: CheckboxConfig<T>,
  options?: CheckboxWithHoverOptions<T>
): Promise<T[]> {
  const choices = config.choices.filter(
    (c): c is CheckboxChoice<T> =>
      typeof c === "object" && c !== null && !("type" in c && c.type === "separator")
  );
  const values = choices.map((c) => c.value);
  const totalItems = values.length;
  let cursorPosition = choices.findIndex((c) => !c.disabled);
  if (cursorPosition < 0) cursorPosition = 0;

  // Default getName assumes object has 'name' property
  const getName = options?.getName ?? ((v: T) => (v as { name: string }).name);

  const keypressHandler = (_str: string | undefined, key: readline.Key) => {
    if (key.name === "up") {
      let next = cursorPosition - 1;
      while (next >= 0 && choices[next].disabled) next--;
      if (next >= 0) cursorPosition = next;
    } else if (key.name === "down") {
      let next = cursorPosition + 1;
      while (next < totalItems && choices[next].disabled) next++;
      if (next < totalItems) cursorPosition = next;
    }
  };

  readline.emitKeypressEvents(process.stdin);
  process.stdin.on("keypress", keypressHandler);

  const customConfig = {
    ...config,
    theme: {
      ...config.theme,
      style: {
        answer: (text: string) => pc.green(text),
        ...config.theme?.style,
        highlight: (text: string) => pc.green(text),
        renderSelectedChoices: (
          selected: CheckboxChoice<T>[],
          _allChoices: CheckboxChoice<T>[]
        ): string => {
          if (selected.length === 0) {
            return pc.dim(getName(values[cursorPosition]));
          }
          return selected.map((c) => getName(c.value)).join(", ");
        },
      },
    },
  };

  try {
    const selected = await checkbox(customConfig);
    if (selected.length === 0) {
      return [values[cursorPosition]];
    }
    return selected;
  } finally {
    process.stdin.removeListener("keypress", keypressHandler);
  }
}

```

### Core Architecture Module: `packages/cli/src/utils/selectOrInput.ts`
```
import {
  createPrompt,
  useState,
  useKeypress,
  usePrefix,
  isEnterKey,
  isUpKey,
  isDownKey,
} from "@inquirer/core";
import type { KeypressEvent } from "@inquirer/core";
import pc from "picocolors";

export interface SelectOrInputConfig {
  message: string;
  options: string[];
  recommendedIndex?: number;
}

function reorderOptions(options: string[], recommendedIndex: number): string[] {
  if (recommendedIndex === 0) return options;
  const reordered = [options[recommendedIndex]];
  for (let i = 0; i < options.length; i++) {
    if (i !== recommendedIndex) reordered.push(options[i]);
  }
  return reordered;
}

const selectOrInput: (config: SelectOrInputConfig) => Promise<string> = createPrompt<
  string,
  SelectOrInputConfig
>((config, done): string => {
  const { message, options: rawOptions, recommendedIndex = 0 } = config;
  const options = reorderOptions(rawOptions, recommendedIndex);
  const [cursor, setCursor] = useState(0);
  const [inputValue, setInputValue] = useState("");

  const prefix = usePrefix({});

  useKeypress((key: KeypressEvent, rl) => {
    if (isUpKey(key)) {
      setCursor(Math.max(0, cursor - 1));
      return;
    }

    if (isDownKey(key)) {
      setCursor(Math.min(options.length, cursor + 1));
      return;
    }

    if (isEnterKey(key)) {
      if (cursor === options.length) {
        const finalValue = inputValue.trim();
        done(finalValue || options[0]);
      } else {
        done(options[cursor]);
      }
      return;
    }

    // Text input handling (only when on custom input line)
    if (cursor === options.length && key.name !== "return") {
      if ((key.name === "w" && key.ctrl) || key.name === "backspace") {
        if (key.name === "w" && key.ctrl) {
          const words = inputValue.trimEnd().split(/\s+/);
          if (words.length > 0) {
            words.pop();
            setInputValue(
              words.join(" ") + (inputValue.endsWith(" ") && words.length > 0 ? " " : "")
            );
          }
        } else {
          setInputValue(inputValue.slice(0, -1));
        }
      } else if (key.name === "u" && key.ctrl) {
        setInputValue("");
      } else if (key.name === "space") {
        setInputValue(inputValue + " ");
      } else if (key.name && key.name.length === 1 && !key.ctrl) {
        setInputValue(inputValue + key.name);
      }
    } else if (rl.line) {
      rl.line = "";
    }
  });

  let output = `${prefix} ${pc.bold(message)}\n\n`;

  options.forEach((opt: string, idx: number) => {
    const isRecommended = idx === 0;
    const isCursor = idx === cursor;
    const number = pc.cyan(`${idx + 1}.`);
    const text = isRecommended ? `${opt} ${pc.green("✓ Recommended")}` : opt;

    if (isCursor) {
      output += pc.cyan(`❯ ${number} ${text}\n`);
    } else {
      output += `  ${number} ${text}\n`;
    }
  });

  const isCustomCursor = cursor === options.length;
  if (isCustomCursor) {
    output += pc.cyan(`❯ ${pc.yellow("✎")} ${inputValue || pc.dim("Type your own...")}`);
  } else {
    output += `  ${pc.yellow("✎")} ${pc.dim("Type your own...")}`;
  }

  return output;
});

export default selectOrInput;

```

### Core Architecture Module: `packages/cli/src/utils/skill-name.ts`
```
import { resolve, dirname, basename } from "path";

const SAFE_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export function isSafeSkillName(name: string): boolean {
  if (typeof name !== "string") return false;
  if (name.length === 0 || name.length > 128) return false;
  if (name === "." || name === "..") return false;
  if (name.includes("\0")) return false;
  if (!SAFE_NAME.test(name)) return false;
  return true;
}

export function assertSkillNameInRoot(skillsRoot: string, skillName: string): string {
  if (!isSafeSkillName(skillName)) {
    throw new Error(`Unsafe skill name: ${JSON.stringify(skillName)}`);
  }
  const root = resolve(skillsRoot);
  const target = resolve(root, skillName);
  if (dirname(target) !== root || basename(target) !== skillName) {
    throw new Error(`Skill name "${skillName}" escapes the skills root`);
  }
  return target;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3277** (2026-10-05): **[Bug]: installation fails with opencode due to JSON parsing error (?)**
  *Symptoms*: ### MCP Client  Other (specify in description)  ### Context7 MCP Version  0.5.12  ### Bug Description  Installing on opencode causes a\ "MCP server failed" error  ### Steps to Reproduce  Install context7 against an existing opencode install with the following `opencode.jsonc` configuration:  ``` {   "$schema": "https://opencode.ai/config.json",   "lsp": true, } ```  ### Expected Behavior  Should update `opencode.jsonc`  ### Actual Behavior  Did not update due to a JSON parsing error  ### Error Messages / Logs  ```shell ➜  pnpx ctx7 setup (node:39080) [DEP0169] DeprecationWarning: `url.parse()` behavior is not standardized and prone to errors that have security implications. Use the WHATWG URL API instead. CVEs are not issued for `url.parse()` vulnerabilities. (Use `node --trace-deprecation ...` to show where the warning was created) ✔ How should your agent access Context7? MCP server  ✔ Which agents do you want to set up? OpenCode  ✔ Context7 setup complete    OpenCode     ~ MCP server failed: Expected double-quoted property name in JSON at position 65 (line 4 column 1)       /Users/francis/.config/opencode/opencode.jsonc     ~ Rule updated       /Users/francis/.config/opencode/AGENTS.md     + Skill installed (bundled fallback)       /Users/francis/.agents/skills/context7-mcp/SKILL.md ```  ### Transport Method  stdio (default)  ### Node.js Version  26.3.0  ### Operating System  macOS 27.0  ### Configuration  ```json  ```  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > > **Disclosure:** written and posted autonomously by an AI agent at Vibement Inc. ([who we are / contact](https://github.com/sean-park-funda/vibement-agent)). Based on reading ctx7 0.5.12 and reproducing it locally on 2026-10-01 (UTC).  I reproduced this with ctx7 0.5.12 by running `ctx7 setup --mcp --opencode` against a sandboxed `$HOME` with your exact file. I got the same error at the same spot: position 65 (line 4 column 1), which is the `}` right after the trailing comma.  **Cause.** `readJsonConfig` in `packages/cli/src/setup/mcp-writer.ts` strips comments and then calls plain `JSON.parse`:  ```ts return JSON.parse(stripJsonComments(raw)) as Record<string, unknown>; // L43 ```  That handles comments but not trailing commas. OpenCode itself parses its config with `jsonc-parser` and `{ allowTrailingComma: true }` (`packages/opencode/src/config/parse.ts` L10), so your file is valid: `opencode debug config` on 1.18.34 loads it fine.  In ctx7, any trailing comma fails, whether it's to
  > Thanks for the report. The fix is in `ctx7@0.5.13` (#3305): `ctx7 setup` now accepts trailing commas in OpenCode `.jsonc` files. Run `npx ctx7@latest setup` again to add the MCP entry.

- **Issue #3167** (2026-09-23): **[Bug]: context7 Claude Code plugin always fails with HTTP 401 when CONTEXT7_API_KEY is not set**
  *Symptoms*: ## Summary  The official `context7` plugin for Claude Code ships an `.mcp.json` that always sends an `Authorization` header, defaulting to an **empty string** when `CONTEXT7_API_KEY` is unset.  Because the header is present (even though empty), Claude Code considers the server "pre-authenticated" and **disables its OAuth fallback**. The empty header is then rejected by `https://mcp.context7.com/mcp` with HTTP 401, and the server can never connect.  Completing the browser OAuth flow does not help: the token is obtained and stored successfully, but it is never attached to the request because the static header takes precedence.  ## Environment  | Item | Value | | --- | --- | | Plugin | `context7@claude-plugins-official` | | Claude Code | VS Code extension (native extension host) | | OS | Windows 10 Enterprise LTSC 2021 (19044) | | Shell | PowerShell 5.1 | | `CONTEXT7_API_KEY` | not set (process, User and Machine scopes all empty) |  ## Offending configuration  `external_plugins/context7/.mcp.json`:  ```json {   "mcpServers": {     "context7": {       "type": "http",       "url": "https://mcp.context7.com/mcp?client=claude-code-plugin",       "headers": {         "Authorization": "${CONTEXT7_API_KEY:-}"       }     }   } } ```  When `CONTEXT7_API_KEY` is unset, the `:-` default expands to an empty string, so the client sends a literal `Authorization:` header with no value.  ## Steps to reproduce  1. Make sure `CONTEXT7_API_KEY` is **not** defined in the environment. 2. Install th
  **Post-Mortem & Fix Analysis**:
  > Hey @LeXaMeN, we're aware of this issue and talking with Anthropic team to resolve it as soon as possible. 
  > Looks like the issue is with the plugin sending an empty `Authorization` header when `CONTEXT7_API_KEY` isn't set, which prevents the OAuth fallback from kicking in. Have you tried adjusting the `.mcp.json` to avoid sending the header if the key is unset? 
  > This is fixed so closing

- **Issue #3162** (2026-09-21): **[Bug]: Error checking public website during Context7 submission**
  *Symptoms*: ### MCP Client  Other (specify in description)  ### Context7 MCP Version  N/A — remote Streamable HTTP MCP endpoint; no local @upstash/context7-mcp package installed  ### Bug Description  MCP Client: Other (ChatGPT Desktop / Codex Desktop)  Submitting the public Pilot documentation website to Context7 fails with “Error checking website”.  The Context7 API key is valid: library searches succeed. However, submitting either the website root or its static documentation index does not return a library identifier.  This appears to be a website validation/crawling issue rather than an authentication issue.  ### Steps to Reproduce  1. Configure Context7 as a remote Streamable HTTP MCP server at:    https://mcp.context7.com/mcp  2. Authenticate with a valid Context7 API key stored securely outside project files.  3. Confirm authentication works with:    GET /api/v2/libs/search  4. Submit the public website through:    POST /api/v2/add/website     {      "websiteUrl": "https://doc.pilot-gps.com/",      "websiteBaseUrl": "https://doc.pilot-gps.com/"    }  5. Retry with the static documentation index:     {      "websiteUrl": "https://doc.pilot-gps.com/contents.html",      "websiteBaseUrl": "https://doc.pilot-gps.com/"    }  ### Expected Behavior  Context7 should validate and submit the public documentation website successfully, returning a library identifier for later documentation queries.  ### Actual Behavior  Both website-submission requests take approximately 30 seconds and fail. No
  **Post-Mortem & Fix Analysis**:
  > I will take this issue. Please assign it to me.  The problem seems to be with the website validation or crawling process. The error message "Error checking website" suggests this. I will first check the code handling the POST request to `/api/v2/add/website`. I will look for any conditions or exceptions that might cause this error. A small fix might involve adjusting the validation logic or improving error handling to provide more specific feedback. I'll also verify if the absence of llms.txt, sitemap.xml, or robots.txt affects the process. 
  > Hi, sorry for the delay. The issue is now fixed and library is being processed [here](https://context7.com/websites/doc_pilot-gps). Thanks for reporting.

- **Issue #3132** (2026-09-08): **[Bug]: Retrofit documentation is outdated: Context7 returns 2.11.0 instead of latest 3.0.0**
  *Symptoms*: ### MCP Client  Other (specify in description)  ### Context7 MCP Version  latest  ### Bug Description  ## Description  Context7 appears to return outdated documentation for Retrofit.  When using Context7 through the remote MCP server in Codex Desktop, Context7 resolves Retrofit to:  `/lysine-dev/retrofit`  However, the documentation returned by Context7 appears to be based on Retrofit 2.11.0.  The latest stable version of Retrofit is 3.0.0.  ## Steps to reproduce  1. Configure Context7 in Codex Desktop using the remote MCP server:     `https://mcp.context7.com/mcp`  2. Ask Codex:     > Please use Context7 to check the latest version of Retrofit and show me the basic usage of Retrofit.Builder.  3. Context7 resolves Retrofit to:     `/lysine-dev/retrofit`  4. Context7 returns documentation and examples based on Retrofit 2.11.0.  ## Expected behavior  Context7 should return documentation for the latest stable version of Retrofit (3.0.0), or clearly indicate which version the returned documentation belongs to.  If Context7 intentionally provides documentation for an older version, it would be helpful to clearly identify the version so that users do not mistake it for the latest documentation.  ## Actual behavior  Context7 returns documentation based on Retrofit 2.11.0, even though Retrofit 3.0.0 is the latest stable release.  This can potentially cause an AI coding agent to generate code based on outdated APIs or dependencies.  ## Environment  - Client: Codex Desktop - MCP: Conte
  **Post-Mortem & Fix Analysis**:
  > Hi, the latest version uses the default branch's latest code, but i've added version 3.0 for you as well https://context7.com/lysine-dev/retrofit/3.0.0?tab=logs 

- **Issue #3095** (2026-08-28): **[Bug]: pdf upload failed**
  *Symptoms*: ### MCP Client  Other (specify in description)  ### Context7 MCP Version  new  ### Bug Description  when i try to upload a pfd into my pro account it fails  ### Steps to Reproduce  go to upload a pfd in the admin and it wont upload. pdf size is 7mb  ### Expected Behavior  pdf to upload to my account  ### Actual Behavior  pdf failed to upload  ### Error Messages / Logs  ```shell none ```  ### Transport Method  http  ### Node.js Version  _No response_  ### Operating System  _No response_  ### Configuration  ```json  ```  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hey, could you give it another shot? We've just released the new version of our PDF converter. It should be working fine right now.
  > Works thanksCorey WalterOn Aug 28, 2026, at 4:12 AM, Fahreddin Özcan ***@***.***> wrote:﻿fahreddinozcan left a comment (upstash/context7#3095) Hey, could you give it another shot? We've just released the new version of our PDF converter. It should be working fine right now.  —Reply to this email directly, view it on GitHub, or unsubscribe.You are receiving this because you authored the thread.Message ID: ***@***.***>

- **Issue #3074** (2026-08-25): **[Bug]: Error checking website**
  *Symptoms*: ### MCP Client  Other (specify in description)  ### Context7 MCP Version  not applicable  ### Bug Description  I tried using https://context7.com/add-library?tab=website to add official documentation for NTSL language for Nelogica's Profit trading platform. It is hosted at https://ajuda.nelogica.com.br/hc/pt-br/articles/360046443212-Documenta%C3%A7%C3%A3o-NTSL-Compilado-de-fun%C3%A7%C3%B5es-e-instru%C3%A7%C3%B5es-de-usabilidade with a main link to https://www.nelogica.com.br/manualntsl that redirects to (https://downloadserver-cdn.nelogica.com.br/content/profit/manual_ntsl/ManualNTSL.pdf). I tried different combinations of the 3 links but it always lead to "Error checking website If you think this is a mistake, please open an issue."  ### Steps to Reproduce  1. Visit https://context7.com/add-library?tab=website 2. Fill in the URL/advanced fields with any combination of  https://www.nelogica.com.br/manualntsl , https://downloadserver-cdn.nelogica.com.br/content/profit/manual_ntsl/ManualNTSL.pdf , or https://ajuda.nelogica.com.br/hc/pt-br/articles/360046443212-Documenta%C3%A7%C3%A3o-NTSL-Compilado-de-fun%C3%A7%C3%B5es-e-instru%C3%A7%C3%B5es-de-usabilidade  ### Expected Behavior  Accepts documentation  ### Actual Behavior  Error  ### Error Messages / Logs  ```shell  ```  ### Transport Method  stdio (default)  ### Node.js Version  _No response_  ### Operating System  _No response_  ### Configuration  ```json  ```  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report. We investigated this and confirmed the problem. The manualntsl URL redirects directly to a PDF. Our website importer currently expects HTML documentation and does not support direct or redirected PDF URLs, so it incorrectly returns the generic “Error checking website” message. As a workaround, please download ManualNTSL.pdf and add it using the PDF Upload tab on the Add Library page. We’ll track improving the error message and handling PDF redirects more gracefully. Thanks again for reporting this!

- **Issue #2970** (2026-08-02): **[Bug]: OAuth metadata mismatch: token_endpoint_auth_methods_supported says "client_secret_basic" but token endpoint expects client_secret_post**
  *Symptoms*: ### MCP Client  Other (specify in description)  ### Context7 MCP Version  N/A (using remote MCP)  ### Bug Description  `https://context7.com/.well-known/oauth-authorization-server` advertises: ``` "token_endpoint_auth_methods_supported": [     "client_secret_basic",     "client_secret_post" ] ``` Basic authentication exchange fails:  ```shell curl \   --basic \   --user "$CLIENT_ID:$CLIENT_SECRET" \   -X POST https://context7.com/api/oauth/token \   -H 'Content-Type: application/x-www-form-urlencoded' \   --data-urlencode 'grant_type=authorization_code' \   --data-urlencode "code=$CODE" \   --data-urlencode "redirect_uri=$REDIRECT_URI" \   --data-urlencode "code_verifier=$CODE_VERIFIER" ```  ```json {"error":"invalid_request","error_description":"The request is missing a required parameter, includes an invalid parameter value, includes a parameter more than once, or is otherwise malformed. Client credentials missing or malformed in both HTTP Authorization header and HTTP POST body."} ```  ### Steps to Reproduce  1. Configure Basic Authentication ```shell AUTH_METHOD='client_secret_basic' REDIRECT_URI='http://localhost:8765/callback' ```  2. Dynamically Register the Client ```shell REG=$(curl -sS -X POST https://context7.com/api/oauth/register \   -H 'Content-Type: application/json' \   -d "$(jq -n \     --arg redirect "$REDIRECT_URI" \     --arg method "$AUTH_METHOD" \     '{       redirect_uris: [$redirect],       client_name: "curl-oauth-reproduction",       grant_types: ["
  **Post-Mortem & Fix Analysis**:
  > Hey, investigating.
  > We found the root cause. There was a mistake on our proxy causing some headers to be dropped. Will be fixed soon.
  > Should be fixed now!

- **Issue #2963** (2026-08-02): **[Bug]: Codex MCP server enabled but Context7 tools are not exposed**
  *Symptoms*: ### MCP Client  Other (specify in description)  ### Context7 MCP Version  0.5.6  ### Bug Description  After successful `npx ctx7 setup`, Codex recognizes Context7 as an enabled MCP server, but the active Codex task does not expose any Context7 tools. In particular, `resolve-library-id` and `query-docs` are missing, so I cannot perform an end-to-end documentation lookup.  ### Steps to Reproduce  1. Run `npx ctx7 setup`. 2. Choose “MCP server” and “Codex”. 3. Authenticate successfully. 4. Start a Codex task. 5. Attempt to discover or invoke Context7 tools such as `resolve-library-id` or `query-docs`.  ### Expected Behavior  The Context7 MCP server loads into the Codex task and exposes its documentation lookup tools, including `resolve-library-id` and `query-docs`.  ### Actual Behavior  The installer reports success and `codex mcp list` shows Context7 as enabled, but the active task has no callable Context7 tools. Because the tools are absent, no library-resolution or documentation-query request can be made.  ### Error Messages / Logs  ```shell `codex mcp list`:  Name       Url                              Status   Auth context7   https://mcp.context7.com/mcp     enabled  Unsupported  Expected tools missing from the active task: - resolve-library-id - query-docs ```  ### Transport Method  http  ### Node.js Version  Node.js: v26.0.0  ### Operating System  macOS: 26.5.1  ### Configuration  ```json [mcp_servers.context7] type = "http" url = "https://mcp.context7.com/mcp"  [mcp_serv
  **Post-Mortem & Fix Analysis**:
  > Hey, this issue is due to Codex starting an unnecessary OAuth flow in a case where it shouldn't and fail. It behaves against the spec unless you set header as `Authotization: Bearer XXXX`.  If you rerun the `npx ctx7@latest setup` command now with `0.5.7`, your config should be updated and the issue is fixed. Please let me know.

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

### Incident Patch 1: `9b6f702f` (2026-10-05)
**Commit Message**: fix(cli): accept trailing commas in OpenCode JSONC (#3305)

* fix(cli): accept trailing commas in OpenCode JSONC

* chore(cli): add changeset for OpenCode JSONC trailing commas

---------

Co-authored-by: enesgules <[REDACTED_EMAIL]>

**File**: `.changeset/opencode-jsonc-trailing-commas.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"ctx7": patch
+---
+
+Accept trailing commas in OpenCode JSONC config files during setup and removal.
```

**File**: `packages/cli/package.json` (modified, +1/-0)
```diff
@@ -27,6 +27,7 @@
     "boxen": "^8.0.1",
     "commander": "^15.0.0",
     "figlet": "^1.9.4",
+    "jsonc-parser": "^3.3.1",
     "open": "^10.1.0",
     "ora": "^9.4.0",
     "picocolors": "^1.1.1"
```

**File**: `packages/cli/src/__tests__/setup.test.ts` (modified, +21/-0)
```diff
@@ -284,6 +284,27 @@ describe("JSONC support", () => {
     expect(result.mcp).toEqual({});
   });
 
+  test("readJsonConfig accepts trailing commas in OpenCode config", async () => {
+    const path = join(tempDir, "opencode.jsonc");
+    await writeFile(
+      path,
+      '{\n  "$schema": "https://opencode.ai/config.json",\n  "lsp": true,\n}',
+      "utf-8"
+    );
+    const result = await readJsonConfig(path);
+    expect(result.lsp).toBe(true);
+  });
+
+  test("readJsonConfig rejects malformed JSONC", async () => {
+    const path = join(tempDir, "invalid.jsonc");
+    await writeFile(path, '{ "mcp": {', "utf-8");
+    await expect(readJsonConfig(path)).rejects.toThrow(SyntaxError);
+  });
+
+  test("readJsonConfig propagates non-missing file errors", async () => {
+    await expect(readJsonConfig(tempDir)).rejects.toThrow();
+  });
+
   test("readJsonConfig handles block comments", async () => {
     const path = join(tempDir, "config.jsonc");
     await writeFile(path, '{ /* block */ "key": "value" }', "utf-8");
```

**File**: `packages/cli/src/setup/mcp-writer.ts` (modified, +13/-28)
```diff
@@ -1,46 +1,31 @@
 import { access, readFile, writeFile, mkdir } from "fs/promises";
 import { dirname } from "path";
+import { parse, printParseErrorCode, type ParseError } from "jsonc-parser";
 import { STDIO_PACKAGE } from "./agents.js";
 
 export { patchTomlStdioApiKey } from "./toml-editor.js";
 
-function stripJsonComments(text: string): string {
-  let result = "";
-  let i = 0;
-  while (i < text.length) {
-    if (text[i] === '"') {
-      const start = i++;
-      while (i < text.length && text[i] !== '"') {
-        if (text[i] === "\\") i++;
-        i++;
-      }
-      result += text.slice(start, ++i);
-    } else if (text[i] === "/" && text[i + 1] === "/") {
-      i += 2;
-      while (i < text.length && text[i] !== "\n") i++;
-    } else if (text[i] === "/" && text[i + 1] === "*") {
-      i += 2;
-      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
-      i += 2;
-    } else {
-      result += text[i++];
-    }
-  }
-  return result;
-}
-
 export async function readJsonConfig(filePath: string): Promise<Record<string, unknown>> {
   let raw: string;
   try {
     raw = await readFile(filePath, "utf-8");
-  } catch {
-    return {};
+  } catch (error) {
+    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
+    throw error;
   }
 
   raw = raw.trim();
   if (!raw) return {};
 
-  return JSON.parse(stripJsonComments(raw)) as Record<string, unknown>;
+  const errors: ParseError[] = [];
+  const config = parse(raw, errors, { allowTrailingComma: true });
+  if (errors.length > 0) {
+    const firstError = errors[0];
+    throw new SyntaxError(
+      `Invalid JSON config at offset ${firstError.offset}: ${printParseErrorCode(firstError.error)}`
+    );
+  }
+  return config as Record<string, unknown>;
 }
 
 export function mergeServerEntry(
```

**File**: `pnpm-lock.yaml` (modified, +8/-0)
```diff
@@ -63,6 +63,9 @@ importers:
       figlet:
         specifier: ^1.9.4
         version: 1.9.4
+      jsonc-parser:
+        specifier: ^3.3.1
+        version: 3.3.1
       open:
         specifier: ^10.1.0
         version: 10.2.0
@@ -3003,6 +3006,9 @@ packages:
   json-stringify-nice@1.1.4:
     resolution: {integrity: sha512-5Z5RFW63yxReJ7vANgW6eZFGWaQvnPE3WNmZoOJrSkGju2etKA2L5rrOa1sm877TVTFt57A80BH1bArcmlLfPw==}
 
+  jsonc-parser@3.3.1:
+    resolution: {integrity: sha512-HUgH65KyejrUFPvHFPbqOY0rsFip3Bo5wb4ngvdi1EpCYWUQDC5V+Y7mZws+DLkr4M//zQJoanu1SP+87Dv1oQ==}
+
   jsonfile@4.0.0:
     resolution: {integrity: sha512-m6F1R3z8jjlf2imQHS2Qez5sjKWQzbuuhuJ/FKYFRZvPE3PuHcSMVZzfsLhGVOkfd20obL5SWEBew5ShlquNxg==}
 
@@ -7084,6 +7090,8 @@ snapshots:
 
   json-stringify-nice@1.1.4: {}
 
+  jsonc-parser@3.3.1: {}
+
   jsonfile@4.0.0:
     optionalDependencies:
       graceful-fs: 4.2.11
```

---

### Incident Patch 2: `b0bda4f6` (2026-10-01)
**Commit Message**: CTX7-3029: Document Pi built-in MCP support (#3285)

**File**: `docs/clients/pi.mdx` (modified, +89/-51)
```diff
@@ -1,90 +1,128 @@
 ---
 title: Pi
-description: Using Context7 with the Pi coding agent
+description: Use Context7 in Pi with built-in MCP support or the official extension
 ---
 
-Context7 integrates with the [Pi coding agent](https://pi.dev) through the official [`@upstash/context7-pi`](https://github.com/upstash/context7/tree/master/packages/pi) extension. Instead of relying on training data, Pi gets current library documentation directly in your coding sessions.
+Connect the [Pi coding agent](https://pi.dev) to Context7 to get current library documentation and code examples in your coding sessions.
 
-The extension is self-contained — it registers Context7's tools natively in Pi, so there's no separate MCP server to run.
+We recommend [built-in MCP](#built-in-mcp-setup). The Context7 MCP server receives updates more frequently than the Pi extension. The [official extension](#context7-extension) remains an alternative with a documentation skill and the `/c7-docs` prompt.
 
-## Installation
+## Built-in MCP setup
 
-Install the extension with Pi's package command:
+Pi includes MCP support from [version 0.99.0](https://github.com/earendil-works/pi/releases/tag/v0.99.0). Update Pi before you start:
 
 ```bash
-pi install npm:@upstash/context7-pi
+pi update
 ```
 
-## Authentication
+Choose one of the following connection methods. These commands save the server in `~/.pi/agent/mcp.json`. Add `--local` to `pi mcp add` to save it in your project's `.pi/mcp.json` instead. Pi loads project configuration only after you trust the project.
+
+### OAuth
 
-The extension works out of the box at IP-based rate limits — useful for trying it out. For higher quotas and access to private repositories, generate a free key at the [Context7 dashboard](https://context7.com/dashboard) and export it:
+Add the remote server and sign in:
 
 ```bash
-export CONTEXT7_API_KEY=ctx7sk_...
+pi mcp add context7 --url https://mcp.context7.com/mcp/oauth --exposure direct
+pi mcp login context7
 ```
 
-Set it in your shell profile so Pi picks it up on launch.
+Approve access in your browser. Pi stores and refreshes your OAuth tokens. See [Set Up OAuth](/howto/oauth) for more details.
 
----
+### API key
 
-## What it adds
-
-<CardGroup cols={2}>
-<Card title="resolve-library-id" icon="magnifying-glass">
-Converts a package or product name to a Context7 library ID (e.g. `Next.js` → `/vercel/next.js`). The agent calls this first.
-</Card>
-<Card title="query-docs" icon="book">
-Fetches documentation and code examples for a resolved library ID.
-</Card>
-<Card title="context7-docs skill" icon="sparkles">
-Teaches the agent to reach for these tools whenever you ask about a library, framework, SDK, API, CLI tool, or cloud service.
-</Card>
-<Card title="/c7-docs command" icon="terminal">
-Runs the resolve + query flow in one shot for manual lookups.
-</Card>
-</CardGroup>
+Create an API key in the [Context7 dashboard](https://context7.com/dashboard). Export it before you start Pi, then add the remote server:
 
----
+```bash
+export CONTEXT7_API_KEY="YOUR_API_KEY"
+pi mcp add context7 --url https://mcp.context7.com/mcp \
+  --bearer-token-env-var CONTEXT7_API_KEY --exposure direct
+```
+
+Add the export to your shell profile to make the key available in future sessions. Pi saves an environment variable reference in its configuration.
 
-## Using Context7
+To try Context7 without an API key at the anonymous rate limit, omit `--bearer-token-env-var CONTEXT7_API_KEY`.
 
-Once installed, the skill triggers automatically when you ask about libraries — just ask a docs question and the tools are invoked for you:
+### Local server
 
+To run the Context7 MCP server locally over stdio, use this option. It requires Node.js and `npx`:
+
+```bash
+export CONTEXT7_API_KEY="YOUR_API_KEY"
+pi mcp add context7 --exposure direct \
+  --env CONTEXT7_API_KEY='${CONTEXT7_API_KEY}' \
+  -- npx -y @upstash/context7-mcp
 ```
-how do I configure caching in Next.js 16?
-use the Prisma syntax for relations
-what are the Supabase auth methods?
+
+The single quotes keep the environment variable reference in the configuration. Pi resolves it when it starts the server.
+
+### Check the connection
+
+Run this command to check the server connection and list its tools:
+
+```bash
+pi mcp list
 ```
 
-For a manual lookup, use the slash command:
+In an open Pi session, run `/reload` to load the new configuration. Use `/mcp` to inspect the connection, sign in, or reconnect.
+
+The examples use `--exposure direct` so the model can see Context7's tools immediately. Without this option, Pi uses `codemode` by default and discovers tools through tool search. See [Pi's MCP documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/mcp.md) for other options.
+
+### Use Context7
+
+Ask Pi to use Context7 in your prompt:
 
+```text
+Use Context7 to show me how to configure caching in Next.js 16.
 ```
-/c7-docs <library> <question>
+
+Context7 provides two tools
```

**File**: `docs/resources/all-clients.mdx` (modified, +56/-0)
```diff
@@ -127,6 +127,62 @@ Add this to your Opencode configuration file. See [Opencode MCP docs](https://op
 
 </Accordion>
 
+<Accordion title="Pi">
+
+#### Built-in MCP
+
+We recommend built-in MCP because the Context7 MCP server receives updates more frequently than the Pi extension.
+
+Pi has built-in MCP support from version 0.99.0. Run `pi update` to update Pi, then choose one connection method below. See the [Pi guide](/clients/pi) for usage examples and [Pi's MCP documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/mcp.md) for configuration details.
+
+##### OAuth
+
+```sh
+pi mcp add context7 --url https://mcp.context7.com/mcp/oauth --exposure direct
+pi mcp login context7
+```
+
+Approve access in your browser. Pi stores and refreshes the OAuth tokens.
+
+##### Remote server with an API key
+
+Create a key in the [Context7 dashboard](https://context7.com/dashboard) and export it before starting Pi:
+
+```sh
+export CONTEXT7_API_KEY="YOUR_API_KEY"
+pi mcp add context7 --url https://mcp.context7.com/mcp \
+  --bearer-token-env-var CONTEXT7_API_KEY --exposure direct
+```
+
+For anonymous access at a lower rate limit, omit `--bearer-token-env-var CONTEXT7_API_KEY`.
+
+##### Local server connection
+
+With Node.js and `npx` installed, run:
+
+```sh
+export CONTEXT7_API_KEY="YOUR_API_KEY"
+pi mcp add context7 --exposure direct \
+  --env CONTEXT7_API_KEY='${CONTEXT7_API_KEY}' \
+  -- npx -y @upstash/context7-mcp
+```
+
+These commands save the server in `~/.pi/agent/mcp.json`. Add `--local` to `pi mcp add` to use `.pi/mcp.json` for a trusted project. The `--exposure direct` option makes Context7's tools visible to the model immediately.
+
+Run `pi mcp list` to check the connection. In an open Pi session, run `/reload`, then use `/mcp` to inspect the server. Ask Pi to use Context7 for a library documentation question.
+
+#### Context7 extension
+
+The [official Context7 extension](/clients/pi#context7-extension) is an alternative. It includes a documentation skill and the `/c7-docs` prompt. It calls the hosted Context7 HTTP API directly, without using the remote MCP server:
+
+```sh
+pi install npm:@upstash/context7-pi
+```
+
+Run `/reload` or start a new Pi session, then ask a documentation question or use `/c7-docs next.js Cache Components`. It supports anonymous access and the `CONTEXT7_API_KEY` environment variable. Choose either the extension or the MCP setup above to avoid duplicate tools.
+
+</Accordion>
+
 <Accordion title="OpenClaw">
 
 Add the hosted Context7 server with OpenClaw's MCP client registry. See the [OpenClaw MCP documentation](https://docs.openclaw.ai/tools/mcp) for more details.
```

---

### Incident Patch 3: `d812afe2` (2026-09-28)
**Commit Message**: fix(claude-plugin): match the official plugin and drop the API key header (#3252)

* fix(claude-plugin): drop API key header so OAuth works

Match the official marketplace config without the Authorization header,
and prepare the plugin for the Claude directory portal.

* chore(claude-plugin): match the official plugin contents

Remove the skill, agent, and command so the plugin only ships the MCP
server, like the listing in claude-plugins-official.

* docs(claude-plugin): update Claude Code docs for the MCP-only plugin

Remove the skill, agent, command, and CONTEXT7_API_KEY docs, point API
key users to ctx7 setup or a manual MCP config, and narrow the README
data statement to the tool-call parameters the model writes.

**File**: `.claude-plugin/marketplace.json` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
       "name": "context7",
       "source": "./plugins/claude/context7",
       "description": "Up-to-date documentation lookup. Pull version-specific documentation and code examples directly from source repositories into your LLM context.",
-      "version": "1.0.3"
+      "version": "1.0.4"
     }
   ]
 }
```

**File**: `docs/clients/claude-code.mdx` (modified, +5/-123)
```diff
@@ -3,7 +3,7 @@ title: Claude Code
 description: Using Context7 with Claude Code
 ---
 
-Context7 integrates with Claude Code to provide current library documentation instead of relying on training data. Claude Code supports skills, agents, and commands that make documentation lookups more powerful.
+Context7 integrates with Claude Code to provide current library documentation instead of relying on training data. Set it up with `ctx7 setup`, or install the Context7 plugin.
 
 ## Installation
 
@@ -36,30 +36,11 @@ use context7 with /supabase/supabase for authentication docs
 use context7 with /vercel/next.js for app router setup
 ```
 
-<Tip>
-With the [Context7 plugin](#the-context7-plugin) installed, you get additional agents and commands on top of the skill.
-</Tip>
-
 ---
 
 ## The Context7 Plugin
 
-The full Context7 plugin for Claude Code includes more than just the MCP server:
-
-<CardGroup cols={2}>
-<Card title="MCP Server" icon="server">
-The tools for fetching documentation (`resolve-library-id`, `query-docs`)
-</Card>
-<Card title="Skills" icon="sparkles">
-Auto-triggers documentation lookups when you ask about libraries
-</Card>
-<Card title="Agents" icon="robot">
-A `docs-researcher` agent for focused lookups that keep context lean
-</Card>
-<Card title="Commands" icon="terminal">
-`/context7:docs` for manual documentation queries
-</Card>
-</CardGroup>
+The Context7 plugin connects Claude Code to the hosted Context7 MCP server (`https://mcp.context7.com/mcp`). It adds the `resolve-library-id` and `query-docs` tools, with no local Node.js, npm, or npx required.
 
 ### Installing the Plugin
 
@@ -70,109 +51,10 @@ The plugin is available from the Context7 marketplace. Run these commands in Cla
 /plugin install context7@context7-marketplace
 ```
 
-This adds the Context7 marketplace and installs the plugin with skills, agents, and commands.
-
-### Using Your API Key with the Plugin
-
-Without an API key, the plugin connects anonymously and shares the anonymous rate limits. To use your own plan, create an API key in the [Context7 dashboard](https://context7.com/dashboard) and export it as an environment variable before launching Claude Code:
+### Signing In
 
-```bash
-# e.g. in ~/.zshrc or ~/.bashrc
-export CONTEXT7_API_KEY="your-api-key"
-```
-
-The plugin reads `CONTEXT7_API_KEY` from your environment automatically. Restart Claude Code after setting it, then confirm requests are counted against your plan in the [dashboard](https://context7.com/dashboard).
+After installing the plugin, restart Claude Code and run `/mcp`. Select Context7 and follow the browser sign-in flow. No API key is required.
 
 <Note>
-If the variable is not set, the plugin still works — requests just go through the anonymous tier, which has lower rate limits.
+The plugin does not read `CONTEXT7_API_KEY`. To use an API key, for example on a headless, SSH, or CI host, run `npx ctx7 setup --claude` or add the MCP server manually as described in [All MCP Clients](/resources/all-clients).
 </Note>
-
-### Skills
-
-#### Documentation Lookup Skill
-
-This skill triggers automatically when you ask about libraries, frameworks, or need code examples. You don't need to type "use context7" — the skill recognizes when documentation would help.
-
-<AccordionGroup>
-<Accordion title="What triggers the skill">
-- Setup questions: "How do I configure Next.js middleware?"
-- Code generation: "Write a Prisma query for user relations"
-- API references: "What are the Supabase auth methods?"
-- Framework mentions: React, Vue, Svelte, Express, Tailwind, etc.
-</Accordion>
-<Accordion title="How it works">
-1. **Resolve**: Finds the library ID using `resolve-library-id` with your question as context
-2. **Select**: Picks the best match based on name accuracy and quality scores
-3. **Fetch**: Calls `query-docs` with the library ID and your specific question
-4. **Return**: Provides code examples and explanations from current documentation
-</Accordion>
-</AccordionGroup>
-
-### Agents
-
-#### docs-researcher Agent
-
-When you're in the middle of a long task and don't want documentation tool calls cluttering your context, spawn the `docs-researcher` agent. It runs in a separate context and returns just the answer.
-
-<Tabs>
-<Tab title="When to Use" icon="question">
-- You need docs but want to keep your main context clean
-- You're working on something complex and context is getting long
-- You want a focused answer without side effects
-</Tab>
-<Tab title="Examples" icon="code">
-```
-spawn docs-researcher to look up React hooks documentation
-spawn docs-researcher: how do I set up Prisma with PostgreSQL?
-spawn docs-researcher to find Tailwind CSS grid utilities
-```
-</Tab>
-</Tabs>
-
-The agent uses the same tools (`resolve-library-id` and `query-docs`) but runs on a lighter model (Sonnet) to keep things fast.
-
-#### When to Use Agents vs Inline Tools
-
-| Scenario | Use |
-|----------|-----|
-| Deep into a task with long context | Agent |
-|
```

**File**: `packages/cli/src/__tests__/plugin-manifests.test.ts` (modified, +5/-19)
```diff
@@ -1,34 +1,20 @@
 import { describe, test, expect } from "vitest";
 import { readFile } from "fs/promises";
 import { join } from "path";
-import { execFile } from "child_process";
-import { promisify } from "util";
 
 const REPO_ROOT = join(import.meta.dirname, "..", "..", "..", "..");
-const execFileAsync = promisify(execFile);
 
 describe("plugin MCP manifests", () => {
-  test("Claude uses an API key only when one is set", async () => {
+  test("Claude sends no Authorization header so OAuth can run", async () => {
     const relPath = "plugins/claude/context7/.mcp.json";
     const raw = await readFile(join(REPO_ROOT, relPath), "utf-8");
     const config = JSON.parse(raw) as {
-      mcpServers: { context7: { headers?: Record<string, string>; headersHelper: string } };
+      mcpServers: { context7: Record<string, unknown> };
     };
-    expect(config.mcpServers.context7.headers).toBeUndefined();
-    expect(config.mcpServers.context7.headersHelper).toBe(
-      'node "${CLAUDE_PLUGIN_ROOT}/scripts/headers.mjs"'
-    );
-
-    const helper = join(REPO_ROOT, "plugins/claude/context7/scripts/headers.mjs");
-    const withoutKey = await execFileAsync(process.execPath, [helper], {
-      env: { ...process.env, CONTEXT7_API_KEY: "" },
-    });
-    expect(JSON.parse(withoutKey.stdout)).toEqual({});
-
-    const withKey = await execFileAsync(process.execPath, [helper], {
-      env: { ...process.env, CONTEXT7_API_KEY: "ctx7sk-test" },
+    expect(config.mcpServers.context7).toEqual({
+      type: "http",
+      url: "https://mcp.context7.com/mcp?client=claude-code-plugin",
     });
-    expect(JSON.parse(withKey.stdout)).toEqual({ Authorization: "ctx7sk-test" });
   });
 
   test("Copilot passes the raw API key via Authorization", async () => {
```

**File**: `plugins/claude/context7/.claude-plugin/plugin.json` (modified, +9/-3)
```diff
@@ -1,8 +1,14 @@
 {
   "name": "context7",
-  "version": "1.0.3",
+  "version": "1.0.4",
   "description": "Upstash Context7 MCP server for up-to-date documentation lookup. Pull version-specific documentation and code examples directly from source repositories into your LLM context.",
   "author": {
-    "name": "Upstash"
-  }
+    "name": "Upstash",
+    "email": "context7@upstash.com",
+    "url": "https://upstash.com"
+  },
+  "homepage": "https://context7.com",
+  "repository": "https://github.com/upstash/context7",
+  "license": "MIT",
+  "keywords": ["documentation", "context", "mcp", "library-docs"]
 }
```

**File**: `plugins/claude/context7/.mcp.json` (modified, +1/-2)
```diff
@@ -2,8 +2,7 @@
   "mcpServers": {
     "context7": {
       "type": "http",
-      "url": "https://mcp.context7.com/mcp?client=claude-code-plugin",
-      "headersHelper": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/headers.mjs\""
+      "url": "https://mcp.context7.com/mcp?client=claude-code-plugin"
     }
   }
 }
```

**File**: `plugins/claude/context7/README.md` (modified, +6/-20)
```diff
@@ -4,12 +4,7 @@ Context7 solves a common problem with AI coding assistants: outdated training da
 
 ## What's Included
 
-This plugin provides:
-
-- **MCP Server** - Connects Claude Code to Context7's documentation service
-- **Skills** - Auto-triggers documentation lookups when you ask about libraries
-- **Agents** - A dedicated `docs-researcher` agent for focused lookups
-- **Commands** - `/context7:docs` for manual documentation queries
+This plugin connects Claude Code to Context7's hosted MCP server (`https://mcp.context7.com/mcp`), with no local Node.js, npm, or npx required.
 
 ## Installation
 
@@ -30,7 +25,11 @@ After installing the plugin, restart Claude Code and run:
 
 Select Context7 and follow the browser sign-in flow. No API key is required.
 
-To use an API key instead, set `CONTEXT7_API_KEY` before starting Claude Code. The plugin sends the key only when it is present; otherwise it uses OAuth.
+The plugin does not read `CONTEXT7_API_KEY`. To use an API key, for example on a headless, SSH, or CI host, run `npx ctx7 setup --claude` or add the MCP server manually as described in [All MCP Clients](https://context7.com/docs/resources/all-clients).
+
+## Data and Privacy
+
+The plugin sends only the tool-call parameters that the model writes, such as the library name and the question, to the Context7 MCP server, together with your Context7 OAuth token. The plugin does not run local commands or hooks. See the [Context7 privacy policy](https://context7.com/privacy) for how Context7 handles this data.
 
 ## Available Tools
 
@@ -60,19 +59,6 @@ The plugin works automatically when you ask about libraries:
 - "Show me React Server Components examples"
 - "What's the Prisma syntax for relations?"
 
-For manual lookups, use the command:
-
-```
-/context7:docs next.js app router
-/context7:docs /vercel/next.js/v15.1.8 middleware
-```
-
-Or spawn the docs-researcher agent when you want to keep your main context clean:
-
-```
-spawn docs-researcher to look up Supabase auth methods
-```
-
 ## Version Pinning
 
 To get documentation for a specific version, include the version in the library ID:
```

**File**: `plugins/claude/context7/agents/docs-researcher.md` (removed, +0/-41)
```diff
@@ -1,41 +0,0 @@
----
-name: docs-researcher
-description: Lightweight agent for fetching library documentation without cluttering your main conversation context.
-model: sonnet
----
-
-You are a documentation researcher specializing in fetching up-to-date library and framework documentation from Context7.
-
-## Your Task
-
-When given a question about a library or framework, fetch the relevant documentation and return a concise, actionable answer with code examples.
-
-## Process
-
-1. **Identify the library**: Extract the library/framework name from the user's question.
-
-2. **Resolve the library ID**: Call `resolve-library-id` with:
-   - `libraryName`: The library name (e.g., "react", "next.js", "prisma")
-   - `query`: What to look up in the library's documentation for relevance ranking
-
-3. **Select the best match**: From the results, pick the library with:
-   - Exact or closest name match
-   - Highest benchmark score
-   - Appropriate version if the user specified one (e.g., "React 19" → look for v19.x)
-
-4. **Fetch documentation**: Call `query-docs` with:
-   - `libraryId`: The selected Context7 library ID (e.g., `/vercel/next.js`)
-   - `query`: What to look up in the library's documentation for targeted results, scoped to a single concept
-
-5. **Return a focused answer**: Summarize the relevant documentation with:
-   - Direct answer to the question
-   - Code examples from the docs
-   - Links or references if available
-
-## Guidelines
-
-- Describe what to look up in the library's documentation in the query parameter, but keep each query to a single concept
-- If the question spans multiple distinct concepts (e.g. routing and auth and caching), make a separate `query-docs` call per concept with the same library ID, unless the question is about how the concepts interact — combined queries dilute ranking and return shallow results for each topic
-- When the user mentions a version (e.g., "Next.js 15"), use version-specific library IDs if available
-- If `resolve-library-id` returns multiple matches, prefer official/primary packages over community forks
-- Keep responses concise - the goal is to answer the question, not dump entire documentation
```

**File**: `plugins/claude/context7/commands/docs.md` (removed, +0/-45)
```diff
@@ -1,45 +0,0 @@
----
-description: Look up documentation for any library
-argument-hint: <library> [query]
----
-
-# /context7:docs
-
-Fetches up-to-date documentation and code examples for a library.
-
-## Usage
-
-```
-/context7:docs <library> [query]
-```
-
-- **library**: The library name, or a Context7 ID starting with `/`
-- **query**: What you're looking for (optional but recommended; run the command once per distinct concept, unless asking how they interact)
-
-## Examples
-
-```
-/context7:docs react hooks
-/context7:docs next.js authentication
-/context7:docs prisma relations
-/context7:docs /vercel/next.js/v15.1.8 app router
-/context7:docs /supabase/supabase row level security
-```
-
-## How It Works
-
-1. If the library starts with `/`, it's used directly as the Context7 ID
-2. Otherwise, `resolve-library-id` finds the best matching library
-3. `query-docs` fetches documentation relevant to your query
-4. Results include code examples and explanations
-
-## Version-Specific Lookups
-
-Include the version in the library ID for pinned documentation:
-
-```
-/context7:docs /vercel/next.js/v15.1.8 middleware
-/context7:docs /facebook/react/v19.0.0 use hook
-```
-
-This is useful when you're working with a specific version and want docs that match exactly.
```

---

### Incident Patch 4: `f54b106d` (2026-09-21)
**Commit Message**: CTX7-2851: Drop the theme field from the Docs7 quickstart docs.json (#3222)

**File**: `docs/docs7/quickstart.mdx` (modified, +1/-2)
```diff
@@ -13,7 +13,6 @@ You can skip this step if your project already has a `docs.json` or `mint.json`
 
 ```json docs.json
 {
-  "theme": "mint",
   "name": "My docs",
   "colors": {
     "primary": "#16A34A"
@@ -29,7 +28,7 @@ You can skip this step if your project already has a `docs.json` or `mint.json`
 }
 ```
 
-`theme`, `name`, `colors.primary`, and `navigation` are required. The dev server reports a missing field as `docs.json is invalid`.
+`name`, `colors.primary`, and `navigation` are required. `theme` is optional: Docs7 renders every site with the `mint` theme. The dev server reports a missing field as `docs.json is invalid`.
 
 Then add the first page:
 
```

---

### Incident Patch 5: `5772bb05` (2026-09-20)
**Commit Message**: Add the required fields to the Docs7 quickstart docs.json (#3220)

The sample docs.json omitted theme and colors, which the renderer's
docs.json schema requires. Running docs7 dev on it failed with
"theme: Invalid discriminator value", and adding a theme then failed
on the missing colors.

Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `docs/docs7/quickstart.mdx` (modified, +6/-0)
```diff
@@ -13,7 +13,11 @@ You can skip this step if your project already has a `docs.json` or `mint.json`
 
 ```json docs.json
 {
+  "theme": "mint",
   "name": "My docs",
+  "colors": {
+    "primary": "#16A34A"
+  },
   "navigation": {
     "groups": [
       {
@@ -25,6 +29,8 @@ You can skip this step if your project already has a `docs.json` or `mint.json`
 }
 ```
 
+`theme`, `name`, `colors.primary`, and `navigation` are required. The dev server reports a missing field as `docs.json is invalid`.
+
 Then add the first page:
 
 ```mdx index.mdx
```

---

### Incident Patch 6: `ec97797f` (2026-09-09)
**Commit Message**: fix(pnpm): classify ignored dependency builds (#3170)

**File**: `pnpm-workspace.yaml` (modified, +3/-0)
```diff
@@ -2,6 +2,9 @@ packages:
   - "packages/*"
 
 allowBuilds:
+  "@google/genai": false
   esbuild: true
+  msgpackr-extract: false
+  protobufjs: false
 
 minimumReleaseAge: 10080
```

---

### Incident Patch 7: `0087bab2` (2026-09-09)
**Commit Message**: fix(mcp): allow empty Claude plugin API key (#3168)

**File**: `.changeset/tidy-dogs-connect.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@upstash/context7-mcp": patch
+---
+
+Allow the Claude Code plugin to use anonymous access when its API key header is empty.
```

**File**: `packages/mcp/src/index.ts` (modified, +6/-1)
```diff
@@ -37,7 +37,12 @@ function getPluginFromRequest(req: express.Request): typeof CLAUDE_CODE_PLUGIN |
 
 function requiresAuthentication(req: express.Request, plugin?: typeof CLAUDE_CODE_PLUGIN): boolean {
   // The MCP routes live on a router mounted at /mcp, so req.path is relative to it.
-  return `${req.baseUrl}${req.path}` === "/mcp/oauth" || Boolean(plugin);
+  const isOAuthEndpoint = `${req.baseUrl}${req.path}` === "/mcp/oauth";
+  // The current official Claude plugin expands an unset API key to an empty header.
+  const hasEmptyPluginAuthorization =
+    plugin === CLAUDE_CODE_PLUGIN && req.headers.authorization === "";
+
+  return isOAuthEndpoint || (Boolean(plugin) && !hasEmptyPluginAuthorization);
 }
 
 // Parse CLI arguments using commander
```

**File**: `packages/mcp/test/integration.test.ts` (modified, +14/-2)
```diff
@@ -455,10 +455,22 @@ describe("plugin authentication", () => {
     expect(res.wwwAuthenticate).toContain("/.well-known/oauth-protected-resource");
   });
 
+  test("allows the Claude Code plugin's empty API key fallback", async () => {
+    const res = await postMcp(`${httpUrl}?client=claude-code-plugin`, {
+      Authorization: "",
+    });
+
+    expect(res.status).toBe(200);
+  });
+
   test("keeps the OAuth endpoint protected", async () => {
-    const res = await postMcp(httpUrl.replace(/\/mcp$/, "/mcp/oauth"));
+    const oauthUrl = httpUrl.replace(/\/mcp$/, "/mcp/oauth");
+    const emptyHeaderRes = await postMcp(`${oauthUrl}?client=claude-code-plugin`, {
+      Authorization: "",
+    });
 
-    expect(res.status).toBe(401);
+    expect((await postMcp(oauthUrl)).status).toBe(401);
+    expect(emptyHeaderRes.status).toBe(401);
   });
 
   test("tracks authenticated plugin requests separately", async () => {
```

---

### Incident Patch 8: `19185e9a` (2026-09-09)
**Commit Message**: docs: add Cursor Cloud Agents setup guide (#3166)

* docs: add Cursor Cloud Agents setup guide

* docs: show verified Cursor Cloud result

* docs: address Cursor Cloud guide review

**File**: `docs/clients/cursor.mdx` (modified, +147/-0)
```diff
@@ -82,6 +82,153 @@ use context7 with /vercel/next.js for app router setup
 
 ---
 
+## Cursor Cloud Agents
+
+Cursor Cloud Agents use MCP servers configured for the cloud agent, not the MCP configuration from your local Cursor installation. If Context7 works in the IDE but a Cloud Agent reports an anonymous quota, add an authenticated HTTP server in the Cloud Agent UI.
+
+<Note>
+  The MCP connection is independent of the model selected for the agent. You can
+  use the same Context7 server with any model available in Cursor Cloud Agents.
+</Note>
+
+### Before you begin
+
+Create an API key in the [Context7 dashboard](https://context7.com/dashboard). Keep the key available while you complete the steps below, but do not commit it to your repository or include it in screenshots.
+
+### Add Context7 to Cursor Cloud Agents
+
+<Steps>
+<Step title="Open a Cloud Agent">
+Go to [cursor.com/agents](https://cursor.com/agents) and start a new agent. If you start the agent from the Cursor desktop app, select **Cloud** from the environment menu below the agent input.
+
+<Frame>
+  <img src="/images/clients/cursor/cloud-agents/01-new-cloud-agent.png" alt="New Cursor Cloud Agent composer" />
+</Frame>
+</Step>
+
+<Step title="Open the MCP server menu">
+Select **+** (**Add context and tools**), then **MCP Servers** and **Add MCP**.
+
+<Frame>
+  <img src="/images/clients/cursor/cloud-agents/02-open-mcp-servers.png" alt="MCP Servers menu in a Cursor Cloud Agent" />
+</Frame>
+</Step>
+
+<Step title="Choose Custom MCP">
+In the MCP browser, select **Custom MCP**.
+
+<Frame>
+  <img src="/images/clients/cursor/cloud-agents/03-add-custom-mcp.png" alt="Custom MCP option in Cursor's MCP browser" />
+</Frame>
+</Step>
+
+<Step title="Configure the authenticated Context7 server">
+Enter the following values:
+
+| Field | Value |
+| --- | --- |
+| **Name** | `context7-api-key` |
+| **Type** | `URL` |
+| **Server URL** | `https://mcp.context7.com/mcp` |
+| **Header key** | `Context7-API-Key` |
+| **Header value** | Your Context7 API key |
+
+The distinct `context7-api-key` name avoids a namespace collision when the OAuth-based Context7 plugin is also installed. If you do not use the plugin, you can name the server `context7`.
+
+Context7 also accepts `Authorization: Bearer YOUR_API_KEY`, as shown in the general MCP client examples. This guide uses `Context7-API-Key` because that configuration was verified with Cursor Cloud Agents and keeps API-key authentication separate from the plugin's OAuth connection.
+
+<Warning>
+  Use a hyphenated header name in Cursor Cloud. Header names containing
+  underscores, such as `CONTEXT7_API_KEY`, can be dropped by Cursor's proxy.
+  `CONTEXT7_API_KEY` remains the environment variable name for local stdio
+  connections.
+</Warning>
+
+<Frame>
+  <img src="/images/clients/cursor/cloud-agents/04-configure-context7-api-key.png" alt="Context7 URL and API key header in Cursor's custom MCP form" />
+</Frame>
+
+Alternatively, select **Edit JSON** and use this configuration:
+
+```json
+{
+  "mcpServers": {
+    "context7-api-key": {
+      "url": "https://mcp.context7.com/mcp",
+      "headers": {
+        "Context7-API-Key": "YOUR_CONTEXT7_API_KEY"
+      }
+    }
+  }
+}
+```
+
+<Frame>
+  <img src="/images/clients/cursor/cloud-agents/05-context7-json-config.png" alt="Context7 custom MCP JSON configuration in Cursor Cloud Agents" />
+</Frame>
+</Step>
+
+<Step title="Add and enable the server">
+Select **Add MCP**. Before starting the run, open **+** → **MCP Servers** again and confirm that `context7-api-key` is enabled.
+
+A green status confirms that Cursor initialized the MCP server. It does not by itself prove that the request was authenticated.
+</Step>
+
+<Step title="Verify authenticated access">
+Start a new Cloud Agent run and test both tools:
+
+```text
+Use Context7 to resolve the library ID for Next.js, then query its documentation
+for middleware. Tell me which Context7 tools you called.
+```
+
+To verify authentication conclusively, query a private library that belongs to the Context7 account associated with the API key:
+
+```text
+Use Context7 to query <YOUR_PRIVATE_LIBRARY_ID>. Summarize its installation docs.
+```
+
+If the private library can be read, the Cloud Agent is using the API key. If the agent reports **Monthly quota exceeded** even though the key has quota, the request is reaching Context7 anonymously; recheck the header name and start a new run after saving the MCP server.
+
+After the API-key header is applied, the same Cloud Agent should be able to resolve a library and return documentation without the anonymous quota error:
+
+<Frame>
+  <img src="/images/clients/cursor/cloud-agents/06-verify-context7.png" alt="Successful Context7 documentation query from a Cursor Cloud Agent" />
+</Frame>
+</Step>
+</Steps>
+
+### OAuth and the Context7 Cursor plugin
+
+The Context7 plugin uses the OAuth endpoint and does not currently provide a field for an API key. Cursor suppo
```

---

### Incident Patch 9: `4eff2b90` (2026-09-04)
**Commit Message**: feat(sdk): add production HTTP controls and fix review findings (#3137)

* ctx7-2663: address SDK review findings

* ctx7-2663: tighten SDK test architecture

* ctx7-2663: address SDK type review

* feat(sdk): add production HTTP controls

* refactor(sdk): align HTTP conventions with redis-js

* refactor(sdk): decompose HTTP transport

* refactor(sdk): tighten retry API

* ctx7-2663: address latest SDK review

**File**: `.changeset/ctx7-2663-sdk-reviews.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+---
+"@upstash/context7-sdk": minor
+---
+
+Fix response type inference for runtime-selected formats, honor disabled retries, and separate deterministic SDK tests from live API integration tests. Calls that forward options whose response format is selected at runtime now correctly return an array-or-string union and may require result narrowing.
+
+Add production HTTP controls while keeping API-key authentication required: client and per-request timeouts, abort signals, configurable transient HTTP retries, native fetch cache settings, custom fetch/base URL/header/keepalive support, URL validation, response metadata hooks, and structured `Context7Error` fields for status, code, request ID, rate limits, retryability, malformed JSON, and cause.
+
+Requests now time out after 30 seconds by default. Set `timeout: false` on the client or an individual request to disable the timeout.
```

**File**: `.github/workflows/test.yml` (modified, +6/-0)
```diff
@@ -82,3 +82,9 @@ jobs:
         run: pnpm test
         env:
           CONTEXT7_API_KEY: ${{ secrets.CONTEXT7_API_KEY }}
+
+      - name: SDK Integration Test
+        if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository
+        run: pnpm --filter @upstash/context7-sdk test:integration
+        env:
+          CONTEXT7_API_KEY: ${{ secrets.CONTEXT7_API_KEY }}
```

**File**: `docs/sdks/ts/commands/get-context.mdx` (modified, +9/-0)
```diff
@@ -26,6 +26,15 @@ Retrieve documentation context for a specific library. Returns documentation as
 
       Default: `"json"`
     </ParamField>
+    <ParamField path="signal" type="AbortSignal">
+      Abort signal for cancelling this request.
+    </ParamField>
+    <ParamField path="timeout" type="number | false">
+      Per-request timeout in milliseconds. Use `false` to disable the client timeout.
+    </ParamField>
+    <ParamField path="cache" type="CacheSetting">
+      Native fetch cache mode. Use `false` to omit the cache option.
+    </ParamField>
   </Expandable>
 </ParamField>
 
```

**File**: `docs/sdks/ts/commands/search-library.mdx` (modified, +17/-0)
```diff
@@ -17,6 +17,23 @@ Search across available libraries. Returns an array of matching libraries with m
   The library name to search for
 </ParamField>
 
+<ParamField path="options" type="SearchLibraryOptions">
+  <Expandable title="properties">
+    <ParamField path="type" type="'json' | 'txt'">
+      Format of the response. Defaults to `json`.
+    </ParamField>
+    <ParamField path="signal" type="AbortSignal">
+      Abort signal for cancelling this request.
+    </ParamField>
+    <ParamField path="timeout" type="number | false">
+      Per-request timeout in milliseconds. Use `false` to disable the client timeout.
+    </ParamField>
+    <ParamField path="cache" type="CacheSetting">
+      Native fetch cache mode. Use `false` to omit the cache option.
+    </ParamField>
+  </Expandable>
+</ParamField>
+
 ## Response
 
 Returns `Library[]` - an array of library objects.
```

**File**: `docs/sdks/ts/getting-started.mdx` (modified, +45/-1)
```diff
@@ -79,6 +79,42 @@ const client = new Context7({
   `process.env.CONTEXT7_API_KEY`
 </Note>
 
+#### Production HTTP configuration
+
+The SDK applies a 30-second request timeout and retries transient network failures, `408`, `425`,
+`429`, and `5xx` responses. Only `GET` requests are retried; mutating requests remain
+single-attempt.
+
+```typescript
+const client = new Context7({
+  apiKey: "YOUR_API_KEY",
+  timeout: 10_000,
+  retry: {
+    retries: 3,
+    backoff: (attempt) => 100 * 2 ** attempt,
+  },
+  onResponse: ({ status, requestId, rateLimit, attempt }) => {
+    console.log({ status, requestId, rateLimit, attempt });
+  },
+});
+```
+
+You can also configure `baseUrl`, additional `headers`, `keepAlive`, the native fetch `cache` mode,
+a client-wide abort `signal`, or a custom `fetch` implementation. The SDK always sets
+`Authorization` from the configured API key; additional headers cannot override it.
+
+Following the same convention as `@upstash/redis`, a signal factory can provide a fresh timeout
+signal for each request:
+
+```typescript
+const client = new Context7({
+  apiKey: "YOUR_API_KEY",
+  signal: () => AbortSignal.timeout(10_000),
+});
+```
+
+Set `retry: false` to make exactly one request or `timeout: false` to disable the default timeout.
+
 ## Quick Start Example
 
 ```typescript
@@ -104,6 +140,7 @@ console.log(docs[0].title, docs[0].content);
 // Get documentation context as plain text
 const context = await client.getContext("How do I use hooks?", "/facebook/react", {
   type: "txt",
+  timeout: 5_000,
 });
 console.log(context);
 ```
@@ -121,7 +158,14 @@ try {
   const context = await client.getContext("query", "/invalid/library");
 } catch (error) {
   if (error instanceof Context7Error) {
-    console.error("Context7 API Error:", error.message);
+    console.error("Context7 API Error:", {
+      message: error.message,
+      code: error.code,
+      status: error.status,
+      requestId: error.requestId,
+      rateLimit: error.rateLimit,
+      retryable: error.retryable,
+    });
   } else {
     console.error("Unexpected error:", error);
   }
```

**File**: `packages/sdk/README.md` (modified, +63/-9)
```diff
@@ -40,22 +40,15 @@ const client = new Context7({
 });
 
 // Search for libraries
-const libraries = await client.searchLibrary(
-  "I need to build a UI with components",
-  "react"
-);
+const libraries = await client.searchLibrary("I need to build a UI with components", "react");
 console.log(libraries[0].id); // "/facebook/react"
 
 // Get documentation as JSON array (default)
 const docs = await client.getContext("How do I use hooks?", "/facebook/react");
 console.log(docs[0].title, docs[0].content);
 
 // Get documentation context as plain text
-const context = await client.getContext(
-  "How do I use hooks?",
-  "/facebook/react",
-  { type: "txt" }
-);
+const context = await client.getContext("How do I use hooks?", "/facebook/react", { type: "txt" });
 console.log(context);
 ```
 
@@ -75,6 +68,61 @@ Then initialize without options:
 const client = new Context7();
 ```
 
+### Production HTTP options
+
+Requests time out after 30 seconds and retry transient network errors, `408`, `425`, `429`,
+and `5xx` responses by default. You can configure those defaults for the client and override
+timeout, cancellation, and native fetch caching per request:
+
+```ts
+import { Context7, Context7Error } from "@upstash/context7-sdk";
+
+const client = new Context7({
+  apiKey: process.env.CONTEXT7_API_KEY,
+  timeout: 10_000,
+  retry: {
+    retries: 3,
+    backoff: (attempt) => 100 * 2 ** attempt,
+  },
+  onResponse: ({ status, requestId, rateLimit, attempt }) => {
+    console.log({ status, requestId, rateLimit, attempt });
+  },
+});
+
+const controller = new AbortController();
+
+try {
+  const docs = await client.getContext("How do I use hooks?", "/facebook/react", {
+    signal: controller.signal,
+    timeout: 5_000,
+    cache: "no-store",
+  });
+  console.log(docs);
+} catch (error) {
+  if (error instanceof Context7Error) {
+    console.error(error.code, error.status, error.requestId, error.rateLimit);
+  }
+}
+```
+
+The client also accepts `baseUrl`, `headers`, `keepAlive`, and a custom `fetch` implementation for
+proxies, instrumentation, tests, and runtimes that do not expose a global `fetch`. The configured
+API key always controls the `Authorization` header.
+
+As in `@upstash/redis`, you can express a timeout with a fresh signal for every request:
+
+```ts
+const client = new Context7({
+  apiKey: process.env.CONTEXT7_API_KEY,
+  signal: () => AbortSignal.timeout(10_000),
+});
+```
+
+Set `retry: false` to make exactly one request, `timeout: false` to disable the request timeout,
+or `cache: false` to omit the native fetch cache option.
+
+Only `GET` requests are retried. Mutating requests remain single-attempt.
+
 ## Docs
 
 See the [documentation](https://context7.com/docs/sdks/ts/getting-started) for details.
@@ -87,6 +135,12 @@ See the [documentation](https://context7.com/docs/sdks/ts/getting-started) for d
 pnpm test
 ```
 
+Run the live API integration tests separately with a configured API key:
+
+```sh
+pnpm test:integration
+```
+
 ### Building
 
 ```sh
```

**File**: `packages/sdk/package.json` (modified, +1/-0)
```diff
@@ -5,6 +5,7 @@
   "scripts": {
     "build": "tsup",
     "test": "vitest run",
+    "test:integration": "vitest run --config vitest.integration.config.ts",
     "test:watch": "vitest",
     "typecheck": "tsc --noEmit",
     "dev": "tsup --watch",
```

**File**: `packages/sdk/src/client.integration.test.ts` (added, +120/-0)
```diff
@@ -0,0 +1,120 @@
+import { describe, test, expect } from "vitest";
+import { Context7 } from "./client";
+
+describe("Context7 Client integration", () => {
+  const apiKey = process.env.CONTEXT7_API_KEY!;
+
+  describe("searchLibrary", () => {
+    const client = new Context7({ apiKey });
+
+    test("should search for libraries and return array directly", async () => {
+      const result = await client.searchLibrary("I need to build a UI", "react");
+
+      expect(result).toBeDefined();
+      expect(Array.isArray(result)).toBe(true);
+      expect(result.length).toBeGreaterThan(0);
+    });
+
+    test("should return Library objects with all fields", async () => {
+      const result = await client.searchLibrary("I want to use TypeScript", "typescript");
+
+      expect(result.length).toBeGreaterThan(0);
+      const library = result[0];
+
+      expect(library).toHaveProperty("id");
+      expect(library).toHaveProperty("name");
+      expect(library).toHaveProperty("description");
+      expect(library).toHaveProperty("totalSnippets");
+      expect(library).toHaveProperty("trustScore");
+      expect(library).toHaveProperty("benchmarkScore");
+    });
+
+    test("should search with different queries", async () => {
+      const queries = ["vue", "express", "next"];
+
+      for (const query of queries) {
+        const result = await client.searchLibrary(`I want to use ${query}`, query);
+        expect(result.length).toBeGreaterThan(0);
+      }
+    }, 15000);
+  });
+
+  describe("getContext - JSON format (default)", () => {
+    const client = new Context7({ apiKey });
+
+    test("should get context as Documentation array (default)", async () => {
+      const result = await client.getContext("How to use hooks", "/react/react");
+
+      expect(result).toBeDefined();
+      expect(Array.isArray(result)).toBe(true);
+      expect(result.length).toBeGreaterThan(0);
+    });
+
+    test("should get context with explicit json type", async () => {
+      const result = await client.getContext("How to use hooks", "/react/react", {
+        type: "json",
+      });
+
+      expect(result).toBeDefined();
+      expect(Array.isArray(result)).toBe(true);
+      expect(result.length).toBeGreaterThan(0);
+    });
+
+    test("should have correct Documentation structure", async () => {
+      const result = await client.getContext("How to use hooks", "/react/react", {
+        type: "json",
+      });
+
+      expect(result.length).toBeGreaterThan(0);
+      const doc = result[0];
+      expect(doc).toHaveProperty("title");
+      expect(doc).toHaveProperty("content");
+      expect(doc).toHaveProperty("source");
+      expect(typeof doc.title).toBe("string");
+      expect(typeof doc.content).toBe("string");
+      expect(typeof doc.source).toBe("string");
+    });
+  });
+
+  describe("getContext - text format", () => {
+    const client = new Context7({ apiKey });
+
+    test("should get context as text string with type: txt", async () => {
+      const result = await client.getContext("How to use hooks", "/react/react", {
+        type: "txt",
+      });
+
+      expect(result).toBeDefined();
+      expect(typeof result).toBe("string");
+      expect(result.length).toBeGreaterThan(0);
+    });
+  });
+
+  describe("getContext - different libraries", () => {
+    const client = new Context7({ apiKey });
+
+    test("should get context for Vue", async () => {
+      const result = await client.getContext("How to create components", "/vuejs/core");
+
+      expect(result).toBeDefined();
+      expect(Array.isArray(result)).toBe(true);
+      expect(result.length).toBeGreaterThan(0);
+    });
+
+    test("should get context for Express", async () => {
+      const result = await client.getContext("How to create routes", "/expressjs/express");
+
+      expect(result).toBeDefined();
+      expect(Array.isArray(result)).toBe(true);
+      expect(result.length).toBeGreaterThan(0);
+    });
+  });
+
+  describe("live error handling", () => {
+    const client = new Context7({ apiKey });
+
+    test("should handle invalid library ID gracefully", async () => {
+      await expect(client.getContext("test query", "/nonexistent/library")).rejects.toThrow();
+    });
+  });
+});
```

---

### Incident Patch 10: `6d777619` (2026-09-02)
**Commit Message**: Add Docs7 documentation and component guides (#3024)

Co-authored-by: Context7 Agent <[REDACTED_EMAIL]>
Co-authored-by: Josh <[REDACTED_EMAIL]>
Co-authored-by: context7[bot] <236830434+context7[bot]@users.noreply.github.com>

**File**: `docs/docs.json` (modified, +229/-157)
```diff
@@ -23,211 +23,283 @@
     ]
   },
   "navigation": {
-    "groups": [
+    "tabs": [
       {
-        "group": "Overview",
-        "pages": [
-          "overview",
-          "installation",
-          "plans-pricing",
-          "clients/cli",
-          "adding-libraries",
-          "library-owners",
-          "library-updates",
-          "api-guide",
-          "tips"
-        ]
-      },
-      {
-        "group": "How To",
-        "pages": [
-          {
-            "group": "Authentication",
-            "pages": [
-              "howto/api-keys",
-              "howto/oauth"
-            ]
-          },
-          "howto/claiming-libraries",
-          "howto/chat-widget",
-          "howto/verification",
-          "howto/private-sources",
-          "howto/policies",
-          "howto/rules",
-          "howto/usage",
-          "howto/teamspace"
-        ]
-      },
-      {
-        "group": "Enterprise",
-        "pages": [
-          "enterprise",
+        "tab": "Context7",
+        "groups": [
           {
-            "group": "Enterprise-Managed Auth",
+            "group": "Overview",
             "pages": [
-              "enterprise/enterprise-managed-auth/entra",
-              "enterprise/enterprise-managed-auth/okta"
+              "overview",
+              "installation",
+              "plans-pricing",
+              "clients/cli",
+              "adding-libraries",
+              "library-owners",
+              "library-updates",
+              "api-guide",
+              "tips"
             ]
           },
           {
-            "group": "On-Premise",
+            "group": "How To",
             "pages": [
-              "enterprise/on-premise",
-              "enterprise/changelog",
-              {
-                "group": "Integrations",
-                "pages": [
-                  "enterprise/integrations/github",
-                  "enterprise/integrations/other-git",
-                  "enterprise/integrations/gerrit",
-                  "enterprise/integrations/confluence"
-                ]
-              },
               {
-                "group": "Security",
+                "group": "Authentication",
                 "pages": [
-                  "enterprise/security/entra-sso",
-                  "enterprise/security/oidc-sso",
-                  "enterprise/security/library-access"
-                ]
-              },
-              {
-                "group": "Deployment",
-                "pages": [
-                  "enterprise/deployment/docker",
-                  "enterprise/deployment/kubernetes",
-                  "enterprise/deployment/scaling",
-                  "enterprise/deployment/vector-stores"
+                  "howto/api-keys",
+                  "howto/oauth"
                 ]
               },
+              "howto/claiming-libraries",
+              "howto/chat-widget",
+              "howto/verification",
+              "howto/private-sources",
+              "howto/policies",
+              "howto/rules",
+              "howto/usage",
+              "howto/teamspace"
+            ]
+          },
+          {
+            "group": "Enterprise",
+            "pages": [
+              "enterprise",
               {
-                "group": "Features",
+                "group": "Enterprise-Managed Auth",
                 "pages": [
-                  "enterprise/library-import",
-                  "enterprise/automatic-repository-updates",
-                  "enterprise/gitops",
-                  "enterprise/backup-restore"
+                  "enterprise/enterprise-managed-auth/entra",
+                  "enterprise/enterprise-managed-auth/okta"
                 ]
               },
               {
-                "group": "API Reference",
+                "group": "On-Premise",
                 "pages": [
-                  "enterprise/api/authentication",
+                  "enterprise/on-premise",
+                  "enterprise/changelog",
                   {
-                    "group": "Search",
-                    "pages": ["enterprise/api/search/search-for-libraries"]
+                    "group": "Integrations",
+                    "pages": [
+                      "enterprise/integrations/github",
+                      "enterprise/integrations/other-git",
+                      "enterprise/integrations/gerrit",
+                      "enterprise/integrations/confluence"
+                    ]
                   },
                   {
-                    "group": "Context",
-                    "pages": ["enterprise/api/context/get-documentation-context"]
+                    "group": "Security",
+                    "pages": [
+                      "enterprise/security/entra-sso",
+                      "enterprise/security/oidc-sso",
+                      "enterprise/security/library-access"
+                    ]
                   },
                   {
-                    "group": "Parse",
+         
```

**File**: `docs/docs7/agent-readiness.mdx` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+---
+title: Agent readiness
+description: Expose searchable Markdown and structured discovery for AI agents
+---
+
+Docs7 turns each documentation page into clean Markdown for agents and publishes discovery endpoints for the full site.
+
+## Agent-readable endpoints
+
+Every Docs7 site publishes these machine-readable surfaces:
+
+The paths below are relative to the documentation root. For a site mounted at `example.com/docs`, `/llms.txt` is available at `example.com/docs/llms.txt`.
+
+| Endpoint | Purpose |
+| --- | --- |
+| `/llms.txt` | Lists routable pages with their Markdown URL and description. Pages in navigation come first. |
+| `/llms-full.txt` | Combines the complete Markdown content of the site into one file. |
+| `/<page>.md` | Returns the Markdown representation of one page. |
+| `/search?q=<query>` | Searches the site and returns matching pages, headings, and snippets as JSON. |
+| `/.well-known/agent-skills/index.json` | Advertises a site-specific Agent Skill with links to the docs and search. |
+
+An agent can also request a normal page URL with `Accept: text/markdown`. Docs7 returns Markdown when the client prefers it. HTML responses advertise the Markdown page, both `llms.txt` files, and the Agent Skills index through `Link` headers.
+
+If you provide `llms.txt` or `llms-full.txt` at the docs root, your file replaces the generated version.
+
+## Recover from hallucinated URLs
+
+Agents often request URLs that do not exist. They guess a path from a page title, drop a segment, or reuse a URL from an older version of the docs. Instead of returning an empty 404, Docs7 responds with smart suggestions: the pages the agent was most likely looking for, with their Markdown URLs.
+
+<Frame caption="A request for a page that does not exist returns the closest matching pages instead of an empty 404.">
+  <img
+    src="/images/docs7/url-suggestions.png"
+    alt="Docs7 404 page listing suggested pages for a URL that does not exist"
+  />
+</Frame>
+
+For example, an agent that requests `/config.md` on a site whose page lives at `/configuration.md` receives that page as a suggestion. The agent can follow it directly without running a separate search, so a wrong guess costs one extra request instead of a dead end.
+
+## Write content for agents
+
+Use the same source for people and agents whenever possible. When an agent needs extra context, use `Visibility`:
+
+```mdx
+<Visibility for="agents">
+When the API returns 409, read the existing resource before retrying.
+</Visibility>
+```
+
+Content inside `for="agents"` appears in Markdown output but not on the website. Content inside `for="humans"` appears on the website and is removed from Markdown output. See the [Visibility component](/docs7/components/visibility).
+
+For reliable retrieval, use exact API names, configuration keys, error messages, and stable headings. Link to the page that owns a fact instead of copying the same instructions into several pages.
+
+## Add the site to Context7
+
+Enable **Add to Context7** when you connect the repository, or open the **Context7** tab for an existing site. A successful production build then refreshes the corresponding Context7 library.
+
+This makes the documentation available through the Context7 MCP server and lets the site's assistant use the indexed library. Disconnecting stops automatic refreshes but does not remove the library from Context7.
```

**File**: `docs/docs7/agent.mdx` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+---
+title: Agent
+description: Configure autonomous fixes, pull request reviews, and scheduled checks
+---
+
+The Docs7 Agent works from your GitHub repository and keeps every proposed change reviewable. Open **Docs7**, choose a site, then select **Agent**.
+
+<Frame caption="The Context7 Agent keeps suggestions, build issues, its schedule, and run history in one place.">
+  <img
+    src="/images/docs7/dashboard/agent.jpg"
+    alt="Docs7 Agent dashboard showing suggestions, build issues, scheduling, and history"
+  />
+</Frame>
+
+There are three workflows:
+
+- **Context7 Agent** fixes queued suggestions or build issues in a pull request.
+- **PR Review Agent** reviews documentation changes in each eligible pull request.
+- **Monthly Checkup** is a planned full-site review and is not available yet.
+
+## Context7 Agent
+
+The Context7 Agent has two work queues.
+
+### Suggestions
+
+Suggestions come from Context7's analysis of the indexed documentation. Each suggestion points to the source files that support it.
+
+Select up to 10 suggestions and click **Run agent**. The agent verifies each suggestion against the repository and edits only the configured docs path. If it produces supported changes, Docs7 opens one pull request.
+
+### Build issues
+
+Build issues come from the latest live production build. The queue includes fixable page errors, broken internal links, unknown components, and source warnings.
+
+Select up to 20 issues and run the agent. It checks each issue against the repository. If it produces supported fixes, Docs7 opens one pull request.
+
+Ignoring a suggestion or build issue removes it from the queue. It does not remove the issue from an older build's Health report.
+
+### Schedule
+
+New sites start with the schedule disabled. Enable it and choose **Daily** or **Weekly**.
+
+A scheduled run starts only when at least three suggestions are waiting. It handles up to 10 suggestions in one pull request. The schedule does not run the build issue queue automatically.
+
+You can review completed, failed, and running work under **History**.
+
+## PR Review Agent
+
+The PR Review Agent runs after an eligible pull request preview finishes. It reviews only files inside the configured docs path and posts its findings in the pull request's Docs7 summary.
+
+<Frame caption="PR Review Agent settings control its response mode and the checks applied to pull requests.">
+  <img
+    src="/images/docs7/dashboard/agent-pr-review.jpg"
+    alt="PR Review Agent settings with response modes and documentation checks"
+  />
+</Frame>
+
+New sites start with PR reviews disabled and **Comment only** selected.
+
+### Checks
+
+| Check | What it reviews | Default |
+| --- | --- | --- |
+| **Broken links** | Broken internal links, dead external links, and links to missing headings in changed docs files. | On |
+| **Build health issues** | New fixable issues introduced by the preview compared with production. | On |
+| **Grammar and spelling** | Mistakes in text added or changed by the pull request. | On |
+| **Codebase standards in a monorepo** | Changed pages against repository instructions and nearby documentation patterns. | Off |
+
+Build health requires a hosted Docs7 site. The other checks can also run for a repository connected only for the agent.
+
+### Response modes
+
+The findings comment is always posted. The response mode controls what happens to fixes:
+
+- **Comment only** reports findings and does not change files.
+- **Pull request** opens a separate pull request with supported fixes.
+- **Commit** pushes supported fixes to the pull request branch. If the branch refuses the push, Docs7 opens a pull request against it instead.
+
+Docs7 skips pull requests from forks and pull requests that do not change the configured docs path. It also skips commits created by the agent, which prevents review loops.
+
+<Note>
+Do not make **Docs7 PR Review** a required GitHub check. Fork pull requests do not receive that check.
+</Note>
+
+## Monthly Checkup
+
+<Info>
+Monthly Checkup is **coming soon**.
+</Info>
+
+The planned workflow reads the entire site once a month and opens one pull request with 
+- link checks
+- grammar and spelling
+- build health
+- pages that no longer match their source
+- and a code compilation check.
+
+## Safety and scope
+
+Agent runs receive read access to the connected repository. The agent can inspect repository source to verify a documentation change, but trusted Docs7 code publishes the resulting files through GitHub.
+
+Changes are limited to the configured docs path. When the docs path is the repository root, Docs7 still blocks common application paths, package manifests, lockfiles, `.github`, and `.git` from agent changes.
```

**File**: `docs/docs7/ai-visibility.mdx` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+---
+title: AI Visibility
+description: See which AI agents request your docs and what they fetch
+---
+
+AI Visibility shows which AI products visit your Docs7 site. Open **Docs7**, choose a site, then select **AI Visibility**.
+
+Choose a 7, 30, or 90 day window. If the site has branch previews, you can include their traffic. Preview traffic is excluded by default.
+
+<Frame caption="AI Visibility ranks tracked providers and plots their activity.">
+  <img
+    src="/images/docs7/dashboard/ai-visibility.jpg"
+    alt="Docs7 AI Visibility dashboard with provider rankings and request activity"
+  />
+</Frame>
+
+## AI requests
+
+An AI request is one visit from a tracked AI product. It is not a unique person, conversation, citation, or answer. One product can make several requests while researching a question.
+
+The provider ranking groups requests by product. The activity chart shows request volume over time and can be filtered by provider.
+
+## Included providers
+
+Docs7 currently tracks:
+
+- OpenAI
+- Claude
+- Perplexity
+- Cursor
+- OpenCode
+- Meta
+- Mistral
+
+<Note>
+AI Visibility shows which product made the request. It does not show the exact model version.
+</Note>
+
+## WebMCP searches
+
+Docs7 exposes a read-only `search_docs` WebMCP tool in browsers that support WebMCP. The **WebMCP searches** table shows the most common queries sent through that tool.
+
+These are separate from searches typed by people in the website search box. Human search terms appear under [Analytics](/docs7/analytics#searches).
+
+## Top pages
+
+**Top pages** ranks paths by AI request count. Use the path filter to narrow the list, then sort by most or least fetched.
+
+A high request count shows that agents fetch a page often. It does not show whether the page was cited or whether the agent's final answer was correct.
+
+## Recent requests
+
+The recent request table shows:
+
+- the detected agent or provider
+- the requested path
+- the request country, when available
+- the request time
+
+Use this view to confirm that a crawler reaches the expected URL or to investigate a change in provider activity.
```

**File**: `docs/docs7/analytics.mdx` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+---
+title: Analytics
+description: Understand visitors, searches, assistant questions, and referrers
+---
+
+Analytics reports how people use your Docs7 site. Open **Docs7**, choose a site, then select **Analytics**.
+
+Choose a 7, 30, or 90 day window. If the site has branch previews, you can include their traffic. Preview traffic is excluded by default.
+
+<Frame caption="Analytics separates human visitors from AI traffic and shows activity for the selected period.">
+  <img
+    src="/images/docs7/dashboard/analytics.jpg"
+    alt="Docs7 Analytics dashboard with visitor totals and visitor activity"
+  />
+</Frame>
+
+## Visitors and views
+
+Docs7 records a page view for a document navigation from a browser after filtering known AI crawlers and generic bots.
+
+| Metric | Meaning |
+| --- | --- |
+| **Visitors** | Privacy-preserving daily visitor identifiers in the selected window. |
+| **Views** | Document page views in the selected window. |
+| **Country** | The countries with the most visitors. |
+| **Visitor activity** | Visitors or views plotted by day. |
+
+Visitor identifiers are derived from the day, site, IP address, and user agent, then stored as a hash. Docs7 does not store the raw IP address. Because the identifier changes daily, the same browser can count again on a later day.
+
+## Searches
+
+The search report shows what readers type into the site's search box, how many times each query was used, and how many visitors searched for it.
+
+Search runs as the reader types. Docs7 folds short prefixes into the completed query when the same visitor continues typing within ten seconds. For example, `rate`, `rate l`, and `rate limit` count as `rate limit` instead of three separate searches.
+
+A **No results** label means every recorded search for that term returned no result. Use these terms to find missing pages, missing vocabulary, or titles that do not match the words readers use.
+
+## Assistant questions
+
+This report covers questions visitors send to the documentation assistant. It shows the total number of questions and conversations.
+
+Questions are grouped into topics once per day. Expand a topic to see recent examples. Questions that have not been grouped yet appear under **Uncategorized**.
+
+## Top pages and referrers
+
+**Top pages** ranks documentation paths by visitors and views. **Referrers** shows where visitors came from. Requests without a referrer are grouped under **Direct**.
+
+Use Top pages to see what readers rely on, then compare it with Searches and Assistant questions. A frequently requested topic with no strong destination page is a concrete documentation gap.
+
+<Note>
+AI crawler traffic is reported separately under [AI Visibility](/docs7/ai-visibility).
+</Note>
```

**File**: `docs/docs7/builds.mdx` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+---
+title: Builds
+description: Configure production builds, previews, and local builds
+---
+
+Connect a GitHub repository once. Docs7 then reads the configured documentation folder whenever it builds that site.
+
+The folder must contain `docs.json` or `mint.json`. It can also contain MDX pages, assets, snippets, OpenAPI files, and any other files referenced by the documentation.
+
+<Frame caption="The Builds view records the status, branch, commit, and start time for each deployment.">
+  <img
+    src="/images/docs7/dashboard/builds.jpg"
+    alt="Docs7 Builds dashboard with successful deployments across recent documentation commits"
+  />
+</Frame>
+
+## Build settings
+
+Open **Docs7**, choose a site, then open **Settings**.
+
+| Setting | What it controls |
+| --- | --- |
+| **Slug** | The site's `*.docs7.io` hostname. Changing it moves the production site and its previews. |
+| **Production branch** | The branch used for production builds. Leave it on the GitHub default branch, or select another branch. |
+| **Docs path** | The repository-relative folder that contains `docs.json` or `mint.json`. Use `.` for the repository root. |
+
+Branch and docs path changes take effect on the next deployment. You can also serve the site from its own custom domain or from a path such as `example.com/docs`.
+
+## Production builds
+
+Docs7 starts a production build in three cases:
+
+1. You publish a site for the first time.
+2. You push a commit to the production branch.
+3. You click **Redeploy** in Docs7.
+
+For each build, Docs7 resolves the exact commit, checks out the repository, and reads the configured docs path. It then renders the pages, builds the search index, runs documentation health checks, and publishes the completed release.
+
+Publication happens only after the release is ready. If a build fails, the previous successful release stays live.
+
+<Note>
+A push to another branch does not create a preview by itself. Preview builds come from pull requests or a manual preview deployment.
+</Note>
+
+## Pull request previews
+
+Docs7 creates or updates a preview when a pull request:
+
+- comes from a branch in the connected repository
+- uses a head branch other than the site's production branch
+- changes a file inside the configured docs path
+- is opened, reopened, or receives a new commit
+
+Closing or merging the pull request removes its preview. Pull requests from forks do not get a preview because Docs7 cannot check out the fork branch through the connected repository.
+
+Preview responses include `X-Robots-Tag: noindex`, so temporary URLs do not compete with the production site in search results.
+
+You can also create a preview for a selected branch manually. Open a preview build to redeploy it or delete its live preview.
+
+## Inspect a build
+
+Open **Builds**, then select a row. Each build records its branch, commit, trigger, status, and commit message.
+
+The detail view contains:
+
+- **Log** for renderer and deployment output
+- **Files changed** for pull request builds
+- **Health** for page errors, broken internal links, unknown components, source warnings, and deployment failures
+
+Fixable issues from the latest production build also appear in the [Agent work queue](/docs7/agent#context7-agent).
+
+## Build locally
+
+Use the CLI before you push:
+
+```bash
+docs7 dev ./docs
+```
+
+The development server watches the docs folder and reloads changes. Common options are:
+
+```bash
+docs7 dev ./docs --port 4000
+docs7 dev ./docs --host 0.0.0.0
+```
+
+Use `--port` to change the port and `--host` to bind another address. The first run downloads the Docs7 renderer and caches it for later previews.
+
+The public CLI previews documentation but does not publish it. Push the repository or click **Redeploy** to start a hosted build.
+
+<Warning>
+A local preview executes trusted MDX with your local user permissions. Do not run it against a documentation source you do not trust.
+</Warning>
```

**File**: `docs/docs7/components/accordions.mdx` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+---
+title: Accordions
+description: Hide details until the reader opens them
+---
+
+Use `<AccordionGroup>` when several accordions belong together.
+
+## Usage
+
+```mdx
+<AccordionGroup>
+  <Accordion title="Does Docs7 support MDX?">
+    Yes.
+  </Accordion>
+  <Accordion title="Is this open by default?" defaultOpen>
+    Yes.
+  </Accordion>
+</AccordionGroup>
+```
+
+`<Accordion>` also accepts `description`, `icon`, and `iconType`.
+
+## Example
+
+<AccordionGroup>
+  <Accordion title="Does Docs7 support MDX?">
+    Yes.
+  </Accordion>
+  <Accordion title="Is this open by default?" defaultOpen>
+    Yes.
+  </Accordion>
+</AccordionGroup>
```

**File**: `docs/docs7/components/badge.mdx` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+---
+title: Badges
+description: Add a small status or version label
+---
+
+Use `<Badge>` for a short label.
+
+## Usage
+
+```mdx
+<Badge color="green">Stable</Badge>
+<Badge color="purple" shape="pill" stroke>Beta</Badge>
+```
+
+Useful props are `color`, `size`, `shape`, `icon`, `stroke`, and `disabled`.
+
+## Example
+
+<Badge color="green">Stable</Badge>{" "}
+<Badge color="purple" shape="pill" stroke>Beta</Badge>
```

---

### Incident Patch 11: `c05c71c5` (2026-09-01)
**Commit Message**: feat: rebuild mcpb packaging as a self-contained bundle, publish on release (#3099)

**File**: `.github/workflows/mcp-registry.yml` (modified, +33/-1)
```diff
@@ -35,6 +35,33 @@ jobs:
           echo "Publishing version: $VERSION"
           jq --arg v "$VERSION" '.version = $v | .packages[].version = $v' server.json > server.tmp && mv server.tmp server.json
 
+      - name: Add mcpb package to server.json
+        env:
+          GH_TOKEN: ${{ github.token }}
+        run: |
+          VERSION=$(jq -r .version server.json)
+          # Slash-free tag: the registry rejects mcpb URLs whose tag contains '/'
+          TAG="mcpb-v$VERSION"
+          if gh release download "$TAG" --pattern context7.mcpb --output context7.mcpb -R ${{ github.repository }}; then
+            SHA=$(sha256sum context7.mcpb | cut -d' ' -f1)
+            URL="https://github.com/${{ github.repository }}/releases/download/$TAG/context7.mcpb"
+            jq --arg url "$URL" --arg sha "$SHA" --arg v "$VERSION" '.packages += [{
+              "registryType": "mcpb",
+              "identifier": $url,
+              "version": $v,
+              "fileSha256": $sha,
+              "transport": { "type": "stdio" },
+              "environmentVariables": [{
+                "name": "CONTEXT7_API_KEY",
+                "description": "API key for authentication",
+                "isRequired": false,
+                "isSecret": true
+              }]
+            }]' server.json > server.tmp && mv server.tmp server.json
+          else
+            echo "::warning::No context7.mcpb asset on release $TAG — publishing without mcpb package"
+          fi
+
       - name: Install MCP Publisher
         run: |
           curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher
@@ -46,7 +73,12 @@ jobs:
         # Retry to tolerate npm propagation delay when chained after a release
         run: |
           for i in 1 2 3; do
-            ./mcp-publisher publish && exit 0
+            OUT=$(./mcp-publisher publish 2>&1) && { echo "$OUT"; exit 0; }
+            echo "$OUT"
+            if echo "$OUT" | grep -q "duplicate version"; then
+              echo "This version is already in the registry (versions are immutable) — nothing to do."
+              exit 0
+            fi
             echo "Publish failed (attempt $i), retrying in 30s..."
             sleep 30
           done
```

**File**: `.github/workflows/release.yml` (modified, +55/-1)
```diff
@@ -52,9 +52,63 @@ jobs:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
           NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
 
+  publish-mcpb:
+    name: Upload mcpb Bundle to GitHub Release
+    needs: release
+    if: needs.release.outputs.published == 'true' && contains(needs.release.outputs.publishedPackages, '"@upstash/context7-mcp"')
+    runs-on: ubuntu-latest
+    permissions:
+      contents: write
+    steps:
+      - name: Checkout Repo
+        uses: actions/checkout@v7
+
+      - name: Setup Node
+        uses: actions/setup-node@v6
+        with:
+          node-version: "20"
+
+      - name: Setup pnpm
+        uses: pnpm/action-setup@v4
+        with:
+          version: 10
+
+      - name: Install Dependencies
+        run: pnpm install --frozen-lockfile
+
+      - name: Build mcpb bundle
+        working-directory: packages/mcp
+        run: |
+          VERSION=$(node -p "require('./package.json').version")
+          jq --arg v "$VERSION" '.version = $v' mcpb/manifest.json > manifest.tmp && mv manifest.tmp mcpb/manifest.json
+          npm install -g @anthropic-ai/mcpb
+          pnpm run pack-mcpb
+
+      - name: Smoke-test bundle
+        working-directory: packages/mcp
+        run: |
+          unzip -q mcpb/context7.mcpb -d /tmp/mcpb-smoke
+          printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"1"}}}' \
+            | node /tmp/mcpb-smoke/server/dist/index.mjs | grep -q '"serverInfo"'
+
+      - name: Upload to GitHub Release
+        env:
+          GH_TOKEN: ${{ github.token }}
+        # Dedicated slash-free tag: the MCP Registry rejects mcpb URLs whose
+        # release tag contains '/', which changesets tags (@scope/pkg@x.y.z) do.
+        run: |
+          VERSION=$(node -p "require('./packages/mcp/package.json').version")
+          TAG="mcpb-v$VERSION"
+          gh release view "$TAG" -R ${{ github.repository }} >/dev/null 2>&1 || \
+            gh release create "$TAG" --latest=false \
+              --title "context7.mcpb $VERSION" \
+              --notes "MCP Bundle for [@upstash/context7-mcp@$VERSION](https://github.com/${{ github.repository }}/releases/tag/%40upstash%2Fcontext7-mcp%40$VERSION)" \
+              -R ${{ github.repository }}
+          gh release upload "$TAG" packages/mcp/mcpb/context7.mcpb --clobber -R ${{ github.repository }}
+
   publish-mcp-registry:
     name: Publish to MCP Registry
-    needs: release
+    needs: [release, publish-mcpb]
     # changesets pushes tags with GITHUB_TOKEN, which cannot trigger other
     # workflows — so the registry publish must chain off this job directly.
     if: needs.release.outputs.published == 'true' && contains(needs.release.outputs.publishedPackages, '"@upstash/context7-mcp"')
```

**File**: `.gitignore` (modified, +3/-0)
```diff
@@ -185,3 +185,6 @@ prompt.txt
 reports
 reports-old
 src/test/questions*
+
+# mcpb bundles are built in CI and attached to GitHub releases
+*.mcpb
```

**File**: `packages/mcp/mcpb/.mcpbignore` (removed, +0/-25)
```diff
@@ -1,25 +0,0 @@
-# Source (dist/ is sufficient)
-src/
-*.ts
-
-# Config files
-eslint.config.js
-prettier.config.mjs
-smithery.yaml
-tsconfig.json
-
-# Documentation
-*.md
-LICENSE
-
-# Docker
-Dockerfile
-
-# Schema
-schema/
-
-# Assets (icon is copied to root)
-public/*
-
-# MCPB meta (avoid nesting)
-mcpb/
```

**File**: `packages/mcp/mcpb/manifest.json` (modified, +19/-7)
```diff
@@ -1,8 +1,8 @@
 {
-  "manifest_version": "0.3",
+  "manifest_version": "0.4",
   "name": "context7",
   "display_name": "Context7",
-  "version": "2.1.0",
+  "version": "4.0.3",
   "description": "Up-to-date Code Docs For Any Prompt",
   "long_description": "Context7 MCP pulls up-to-date, version-specific documentation and code examples straight from the source — and places them directly into your prompt.",
   "author": {
@@ -17,20 +17,22 @@
   "icon": "icon.png",
   "server": {
     "type": "node",
-    "entry_point": "dist/index.js",
+    "entry_point": "server/dist/index.mjs",
     "mcp_config": {
       "command": "node",
-      "args": ["${__dirname}/dist/index.js"],
-      "env": {}
+      "args": ["${__dirname}/server/dist/index.mjs"],
+      "env": {
+        "CONTEXT7_API_KEY": "${user_config.api_key}"
+      }
     }
   },
   "tools": [
     {
-      "name": "Resolve Context7 Library ID",
+      "name": "resolve-library-id",
       "description": "Resolves a package/product name to a Context7-compatible library ID and returns matching libraries."
     },
     {
-      "name": "Query Documentation",
+      "name": "query-docs",
       "description": "Retrieves and queries up-to-date documentation and code examples from Context7."
     }
   ],
@@ -45,5 +47,15 @@
   "repository": {
     "type": "git",
     "url": "git+https://github.com/upstash/context7.git"
+  },
+  "user_config": {
+    "api_key": {
+      "type": "string",
+      "title": "Context7 API Key",
+      "description": "Optional API key for higher rate limits. Get one at https://context7.com/dashboard",
+      "sensitive": true,
+      "required": false,
+      "default": ""
+    }
   }
 }
```

**File**: `packages/mcp/package.json` (modified, +3/-1)
```diff
@@ -13,7 +13,8 @@
     "format:check": "prettier --check .",
     "dev": "tsc --watch",
     "start": "node dist/index.js --transport http",
-    "pack-mcpb": "pnpm install && pnpm run build && rm -rf node_modules && pnpm install --prod && cp mcpb/manifest.json manifest.json && cp mcpb/.mcpbignore .mcpbignore && cp ../../public/icon.png icon.png && mcpb validate manifest.json && mcpb pack . mcpb/context7.mcpb && rm manifest.json .mcpbignore icon.png && pnpm install"
+    "build:mcpb": "esbuild src/index.ts --bundle --platform=node --target=node20 --format=esm --outfile=mcpb/stage/server/dist/index.mjs --banner:js=\"import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);\"",
+    "pack-mcpb": "rm -rf mcpb/stage && pnpm run build:mcpb && cp package.json mcpb/stage/package.json && cp mcpb/manifest.json mcpb/stage/manifest.json && cp ../../public/icon.png mcpb/stage/icon.png && mcpb validate mcpb/stage/manifest.json && mcpb pack mcpb/stage mcpb/context7.mcpb && rm -rf mcpb/stage"
   },
   "repository": {
     "type": "git",
@@ -57,6 +58,7 @@
   "devDependencies": {
     "@modelcontextprotocol/client": "2.0.0",
     "@types/node": "^25.0.3",
+    "esbuild": "^0.28.2",
     "typescript": "^5.8.2",
     "vitest": "^4.1.9"
   },
```

**File**: `pnpm-lock.yaml` (modified, +272/-16)
```diff
@@ -140,6 +140,9 @@ importers:
       '@types/node':
         specifier: ^25.0.3
         version: 25.0.3
+      esbuild:
+        specifier: ^0.28.2
+        version: 0.28.2
       typescript:
         specifier: ^5.8.2
         version: 5.9.3
@@ -468,6 +471,12 @@ packages:
     cpu: [ppc64]
     os: [aix]
 
+  '@esbuild/aix-ppc64@0.28.2':
+    resolution: {integrity: sha512-XExcO+dvLKvVtNTibSTBej1NCAbaGhWn9Ww1ZPx80qsahhPFe/8jgWP0IchNe0F3HwkU7n8ejhH8bjonqht8mQ==}
+    engines: {node: '>=18'}
+    cpu: [ppc64]
+    os: [aix]
+
   '@esbuild/android-arm64@0.25.12':
     resolution: {integrity: sha512-6AAmLG7zwD1Z159jCKPvAxZd4y/VTO0VkprYy+3N2FtJ8+BQWFXU+OxARIwA46c5tdD9SsKGZ/1ocqBS/gAKHg==}
     engines: {node: '>=18'}
@@ -480,6 +489,12 @@ packages:
     cpu: [arm64]
     os: [android]
 
+  '@esbuild/android-arm64@0.28.2':
+    resolution: {integrity: sha512-5YfKeeI8qWfBZIX+u2xZC3Zlb3Os/gLS2sbEKM+I4ZOcsWmHS2WLysCcQZDAFRslDUU5Oiq44gf6PYN1vGwG5A==}
+    engines: {node: '>=18'}
+    cpu: [arm64]
+    os: [android]
+
   '@esbuild/android-arm@0.25.12':
     resolution: {integrity: sha512-VJ+sKvNA/GE7Ccacc9Cha7bpS8nyzVv0jdVgwNDaR4gDMC/2TTRc33Ip8qrNYUcpkOHUT5OZ0bUcNNVZQ9RLlg==}
     engines: {node: '>=18'}
@@ -492,6 +507,12 @@ packages:
     cpu: [arm]
     os: [android]
 
+  '@esbuild/android-arm@0.28.2':
+    resolution: {integrity: sha512-kXXoiPVVGQcnIYGOeaovwOURpniDBpSq4A03qkQ+BMQqtGG6HYap3xne9C1O1yo4TR3qxlCX5IqqmX6fFo2Lqg==}
+    engines: {node: '>=18'}
+    cpu: [arm]
+    os: [android]
+
   '@esbuild/android-x64@0.25.12':
     resolution: {integrity: sha512-5jbb+2hhDHx5phYR2By8GTWEzn6I9UqR11Kwf22iKbNpYrsmRB18aX/9ivc5cabcUiAT/wM+YIZ6SG9QO6a8kg==}
     engines: {node: '>=18'}
@@ -504,6 +525,12 @@ packages:
     cpu: [x64]
     os: [android]
 
+  '@esbuild/android-x64@0.28.2':
+    resolution: {integrity: sha512-O387ite7SzUyCcy3JQX4P4bLtEA7bLLkx+esve5JHnyYfNTxcVpXZo9jhdB0lTKN44gztELTdU7nS8Nr16Fs1Q==}
+    engines: {node: '>=18'}
+    cpu: [x64]
+    os: [android]
+
   '@esbuild/darwin-arm64@0.25.12':
     resolution: {integrity: sha512-N3zl+lxHCifgIlcMUP5016ESkeQjLj/959RxxNYIthIg+CQHInujFuXeWbWMgnTo4cp5XVHqFPmpyu9J65C1Yg==}
     engines: {node: '>=18'}
@@ -516,6 +543,12 @@ packages:
     cpu: [arm64]
     os: [darwin]
 
+  '@esbuild/darwin-arm64@0.28.2':
+    resolution: {integrity: sha512-n4KqkOQrraxHJcgjM1RvwbigfQKIKJVpM7xp+KsxiyUSrRdIXnt73VhrPAx0fV44hgfmIVKjxMN9J1t5jySVkw==}
+    engines: {node: '>=18'}
+    cpu: [arm64]
+    os: [darwin]
+
   '@esbuild/darwin-x64@0.25.12':
     resolution: {integrity: sha512-HQ9ka4Kx21qHXwtlTUVbKJOAnmG1ipXhdWTmNXiPzPfWKpXqASVcWdnf2bnL73wgjNrFXAa3yYvBSd9pzfEIpA==}
     engines: {node: '>=18'}
@@ -528,6 +561,12 @@ packages:
     cpu: [x64]
     os: [darwin]
 
+  '@esbuild/darwin-x64@0.28.2':
+    resolution: {integrity: sha512-uq6suIWYP37qzGddBKPw5QEQPi6HiLGsO7UmkpfyaYNQ3D+rN6w6WfwH+nuqcGXWvawGwxOEroO4YGnFh95azw==}
+    engines: {node: '>=18'}
+    cpu: [x64]
+    os: [darwin]
+
   '@esbuild/freebsd-arm64@0.25.12':
     resolution: {integrity: sha512-gA0Bx759+7Jve03K1S0vkOu5Lg/85dou3EseOGUes8flVOGxbhDDh/iZaoek11Y8mtyKPGF3vP8XhnkDEAmzeg==}
     engines: {node: '>=18'}
@@ -540,6 +579,12 @@ packages:
     cpu: [arm64]
     os: [freebsd]
 
+  '@esbuild/freebsd-arm64@0.28.2':
+    resolution: {integrity: sha512-n+I0BTSRIoy+d6RPKnEVwql5UwBJolytvY4mAOIEJorKlqgPII8ix6slVVrfZ5Tnj7glIZvloylbB/EJPMWEXw==}
+    engines: {node: '>=18'}
+    cpu: [arm64]
+    os: [freebsd]
+
   '@esbuild/freebsd-x64@0.25.12':
     resolution: {integrity: sha512-TGbO26Yw2xsHzxtbVFGEXBFH0FRAP7gtcPE7P5yP7wGy7cXK2oO7RyOhL5NLiqTlBh47XhmIUXuGciXEqYFfBQ==}
     engines: {node: '>=18'}
@@ -552,6 +597,12 @@ packages:
     cpu: [x64]
     os: [freebsd]
 
+  '@esbuild/freebsd-x64@0.28.2':
+    resolution: {integrity: sha512-78XJTJkvPs0kz2w61301PJjXl4g7q3JqiYMZ/M/yVI73EHBrCRTgkhu9oqG7vPqq+a/yadEW8aD+agKlk5xrmg==}
+    engines: {node: '>=18'}
+    cpu: [x64]
+    os: [freebsd]
+
   '@esbuild/linux-arm64@0.25.12':
     resolution: {integrity: sha512-8bwX7a8FghIgrupcxb4aUmYDLp8pX06rGh5HqDT7bB+8Rdells6mHvrFHHW2JAOPZUbnjUpKTLg6ECyzvas2AQ==}
     engines: {node: '>=18'}
@@ -564,6 +615,12 @@ packages:
     cpu: [arm64]
     os: [linux]
 
+  '@esbuild/linux-arm64@0.28.2':
+    resolution: {integrity: sha512-pW4AC0P3it8c7do9MVM4p51FzHzdM/TZrerurgRcHJ2WTa1VQ1CIq18xncfpBJw4ojkiZZrKW2yIBWBP92j6Ug==}
+    engines: {node: '>=18'}
+    cpu: [arm64]
+    os: [linux]
+
   '@esbuild/linux-arm@0.25.12':
     resolution: {integrity: sha512-lPDGyC1JPDou8kGcywY0YILzWlhhnRjdof3UlcoqYmS9El818LLfJJc3PXXgZHrHCAKs/Z2SeZtDJr5MrkxtOw==}
     engines: {node: '>=18'}
@@ -576,6 +633,12 @@ packages:
     cpu: [arm]
     os: [linux]
 
+  '@esbuild/linux-arm@0.28.2':
+    resolution: {integrity: sha512-XlDnu2q5yoqems+xay6wSAcg9DDD7K9RLKZEBOMZm3ckNpJBvOX20tSfby8KfrrhINDyv9V2YVZKY/SpoGJI8w==}
+    engines: {node: '>=18'}
+    cpu: [arm]
+    os: [linux]
+
   '@esbuild/linux-ia32@0.25.12':
     resolution: {integrity: sha512-0y9KrdVnbMM2/vG8KfU0byhUN+EFCny9+
```

---

### Incident Patch 12: `76140fc3` (2026-08-31)
**Commit Message**: fix(cli): reuse device login API key during setup (#3109)

**File**: `.changeset/fuzzy-ravens-setup.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"ctx7": patch
+---
+
+Use API keys returned by the device login flow directly during MCP setup instead of sending them to a dashboard session endpoint to generate another key.
```

**File**: `docs/clients/cli.mdx` (modified, +1/-1)
```diff
@@ -148,7 +148,7 @@ ctx7 setup --api-key YOUR_API_KEY
 ctx7 setup --oauth
 ```
 
-Without `--api-key` or `--oauth`, setup runs the OAuth device flow: it shows a verification link and short code that you open on any device to sign in, so it works the same locally or on a remote, headless, or SSH host. MCP mode additionally generates a new API key after login. `--oauth` is MCP-only — use it when an IDE handles the auth flow on your behalf.
+Without `--api-key` or `--oauth`, setup runs the OAuth device flow: it shows a verification link and short code that you open on any device to sign in, so it works the same locally or on a remote, headless, or SSH host. The device flow returns an API key that setup uses for authentication. `--oauth` is MCP-only — use it when an IDE handles the auth flow on your behalf.
 
 **What gets written — MCP mode:**
 
```

**File**: `packages/cli/src/__tests__/auth-commands.test.ts` (modified, +26/-8)
```diff
@@ -7,14 +7,17 @@ const mockSaveTokens = vi.fn();
 const mockStartDeviceAuthorization = vi.fn();
 const mockPollDeviceToken = vi.fn();
 
-vi.mock("../utils/auth.js", () => ({
-  getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
-  clearTokens: (...args: unknown[]) => mockClearTokens(...args),
-  saveTokens: (...args: unknown[]) => mockSaveTokens(...args),
-  startDeviceAuthorization: (...args: unknown[]) => mockStartDeviceAuthorization(...args),
-  pollDeviceToken: (...args: unknown[]) => mockPollDeviceToken(...args),
-  DEFAULT_DEVICE_POLL_INTERVAL_SECONDS: 5,
-}));
+vi.mock("../utils/auth.js", async (importOriginal) => {
+  const original = await importOriginal<typeof import("../utils/auth.js")>();
+  return {
+    ...original,
+    getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
+    clearTokens: (...args: unknown[]) => mockClearTokens(...args),
+    saveTokens: (...args: unknown[]) => mockSaveTokens(...args),
+    startDeviceAuthorization: (...args: unknown[]) => mockStartDeviceAuthorization(...args),
+    pollDeviceToken: (...args: unknown[]) => mockPollDeviceToken(...args),
+  };
+});
 
 vi.mock("../utils/tracking.js", () => ({
   trackEvent: vi.fn(),
@@ -148,6 +151,19 @@ describe("whoami command", () => {
     expect(logOutput.some((l) => l.includes("test@example.com"))).toBe(true);
   });
 
+  test("reports API-key authentication without calling the dashboard", async () => {
+    mockGetValidAccessToken.mockResolvedValue("ctx7sk-valid-key");
+    const fetchMock = vi.fn();
+    vi.stubGlobal("fetch", fetchMock);
+
+    await runCommand("whoami");
+
+    expect(logOutput.some((l) => l.includes("Logged in"))).toBe(true);
+    expect(logOutput).toHaveLength(1);
+    expect(logOutput.some((l) => l.includes("Session may be expired"))).toBe(false);
+    expect(fetchMock).not.toHaveBeenCalled();
+  });
+
   test("shows session expired hint when fetch fails", async () => {
     mockGetValidAccessToken.mockResolvedValue("valid-token");
     vi.stubGlobal(
@@ -200,6 +216,8 @@ describe("performLogin", () => {
       access_token: "ctx7sk-x",
       token_type: "bearer",
     });
+    expect(fetch).not.toHaveBeenCalled();
+    expect(mockSpinner.succeed).toHaveBeenCalledWith(expect.stringContaining("API key"));
   });
 
   test("returns null on denied", async () => {
```

**File**: `packages/cli/src/__tests__/auth-utils.test.ts` (modified, +11/-0)
```diff
@@ -22,6 +22,7 @@ import {
   loadTokens,
   clearTokens,
   isTokenExpired,
+  isContext7ApiKey,
   getValidAccessToken,
   startDeviceAuthorization,
   pollDeviceToken,
@@ -220,6 +221,16 @@ describe("isTokenExpired", () => {
   });
 });
 
+describe("isContext7ApiKey", () => {
+  test("recognizes Context7 API keys", () => {
+    expect(isContext7ApiKey("ctx7sk-example")).toBe(true);
+  });
+
+  test("rejects OAuth access tokens", () => {
+    expect(isContext7ApiKey("legacy-oauth-token")).toBe(false);
+  });
+});
+
 describe("getValidAccessToken", () => {
   test("returns undefined when no tokens stored", async () => {
     mfs.existsSync.mockReturnValue(false);
```

**File**: `packages/cli/src/__tests__/setup-auth.test.ts` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+import { beforeEach, describe, expect, test, vi } from "vitest";
+
+const mockGetValidAccessToken = vi.fn();
+vi.mock("../utils/auth.js", async (importOriginal) => {
+  const original = await importOriginal<typeof import("../utils/auth.js")>();
+  return {
+    ...original,
+    getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
+  };
+});
+
+const mockPerformLogin = vi.fn();
+vi.mock("../commands/auth.js", () => ({
+  performLogin: (...args: unknown[]) => mockPerformLogin(...args),
+}));
+
+const mockSpinner = {
+  start: vi.fn().mockReturnThis(),
+  succeed: vi.fn().mockReturnThis(),
+  fail: vi.fn().mockReturnThis(),
+};
+vi.mock("ora", () => ({ default: () => mockSpinner }));
+
+vi.mock("../utils/api.js", async (importOriginal) => {
+  const original = await importOriginal<typeof import("../utils/api.js")>();
+  return {
+    ...original,
+    getBaseUrl: () => "https://test.context7.com",
+  };
+});
+
+import { resolveSetupApiKey } from "../setup/auth.js";
+
+describe("setup authentication", () => {
+  beforeEach(() => {
+    vi.clearAllMocks();
+    vi.unstubAllGlobals();
+  });
+
+  test("uses a stored device-flow API key directly", async () => {
+    mockGetValidAccessToken.mockResolvedValue("ctx7sk-device-key");
+    const fetchMock = vi.fn();
+    vi.stubGlobal("fetch", fetchMock);
+
+    await expect(resolveSetupApiKey()).resolves.toBe("ctx7sk-device-key");
+
+    expect(mockPerformLogin).not.toHaveBeenCalled();
+    expect(fetchMock).not.toHaveBeenCalled();
+    expect(mockSpinner.start).not.toHaveBeenCalled();
+  });
+
+  test("uses a newly authenticated device-flow API key directly", async () => {
+    mockGetValidAccessToken.mockResolvedValue(undefined);
+    mockPerformLogin.mockResolvedValue("ctx7sk-new-key");
+    const fetchMock = vi.fn();
+    vi.stubGlobal("fetch", fetchMock);
+
+    await expect(resolveSetupApiKey()).resolves.toBe("ctx7sk-new-key");
+
+    expect(fetchMock).not.toHaveBeenCalled();
+  });
+
+  test("still exchanges a legacy OAuth access token for an API key", async () => {
+    mockGetValidAccessToken.mockResolvedValue("legacy-oauth-token");
+    const fetchMock = vi.fn().mockResolvedValue({
+      ok: true,
+      json: () => Promise.resolve({ data: { apiKey: "ctx7sk-generated-key" } }),
+    });
+    vi.stubGlobal("fetch", fetchMock);
+
+    await expect(resolveSetupApiKey()).resolves.toBe("ctx7sk-generated-key");
+
+    expect(fetchMock).toHaveBeenCalledWith(
+      "https://test.context7.com/api/dashboard/api-keys",
+      expect.objectContaining({
+        method: "POST",
+        headers: expect.objectContaining({ Authorization: "Bearer legacy-oauth-token" }),
+      })
+    );
+  });
+});
```

**File**: `packages/cli/src/commands/auth.ts` (modified, +7/-0)
```diff
@@ -7,6 +7,7 @@ import {
   saveTokens,
   clearTokens,
   getValidAccessToken,
+  isContext7ApiKey,
   startDeviceAuthorization,
   pollDeviceToken,
   DEFAULT_DEVICE_POLL_INTERVAL_SECONDS,
@@ -95,6 +96,8 @@ function waitForEnter(prompt: string): Promise<void> {
 }
 
 async function announceIdentity(accessToken: string): Promise<string> {
+  if (isContext7ApiKey(accessToken)) return "Authenticated with API key";
+
   try {
     const whoami = await fetchWhoami(accessToken);
     const name = whoami.email || whoami.name;
@@ -228,6 +231,10 @@ async function whoamiCommand(): Promise<void> {
 
   console.log(pc.green("Logged in"));
 
+  if (isContext7ApiKey(accessToken)) {
+    return;
+  }
+
   try {
     const whoami = await fetchWhoami(accessToken);
     if (whoami.name) {
```

**File**: `packages/cli/src/commands/setup.ts` (modified, +3/-37)
```diff
@@ -4,15 +4,15 @@ import ora from "ora";
 import { select } from "@inquirer/prompts";
 import { mkdir, readFile, writeFile } from "fs/promises";
 import { dirname, join } from "path";
-import { randomBytes } from "crypto";
 
 import { log } from "../utils/logger.js";
 import { checkboxWithHover } from "../utils/prompts.js";
 import { trackEvent } from "../utils/tracking.js";
-import { getBaseUrl, downloadSkill } from "../utils/api.js";
+import { downloadSkill } from "../utils/api.js";
 import { installSkillFiles } from "../utils/installer.js";
 import { performLogin } from "./auth.js";
 import { saveTokens, getValidAccessToken } from "../utils/auth.js";
+import { resolveSetupApiKey } from "../setup/auth.js";
 import {
   type SetupAgent,
   type AuthOptions,
@@ -99,45 +99,11 @@ export function registerSetupCommand(program: Command): void {
     });
 }
 
-async function authenticateAndGenerateKey(): Promise<string | null> {
-  const accessToken = (await getValidAccessToken()) ?? (await performLogin());
-
-  if (!accessToken) return null;
-
-  const spinner = ora("Configuring authentication...").start();
-
-  try {
-    const response = await fetch(`${getBaseUrl()}/api/dashboard/api-keys`, {
-      method: "POST",
-      headers: {
-        Authorization: `Bearer ${accessToken}`,
-        "Content-Type": "application/json",
-      },
-      body: JSON.stringify({ name: `ctx7-cli-${randomBytes(3).toString("hex")}` }),
-    });
-
-    if (!response.ok) {
-      const err = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
-      spinner.fail("Authentication failed");
-      log.error(err.message || err.error || `HTTP ${response.status}`);
-      return null;
-    }
-
-    const result = (await response.json()) as { data: { apiKey: string } };
-    spinner.succeed("Authenticated");
-    return result.data.apiKey;
-  } catch (err) {
-    spinner.fail("Authentication failed");
-    log.error(err instanceof Error ? err.message : String(err));
-    return null;
-  }
-}
-
 async function resolveAuth(options: SetupOptions): Promise<AuthOptions | null> {
   if (options.apiKey) return { mode: "api-key", apiKey: options.apiKey };
   if (options.oauth) return { mode: "oauth" };
 
-  const apiKey = await authenticateAndGenerateKey();
+  const apiKey = await resolveSetupApiKey();
   if (!apiKey) return null;
   return { mode: "api-key", apiKey };
 }
```

**File**: `packages/cli/src/setup/auth.ts` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+import { randomBytes } from "crypto";
+import ora from "ora";
+
+import { performLogin } from "../commands/auth.js";
+import { getBaseUrl } from "../utils/api.js";
+import { getValidAccessToken, isContext7ApiKey } from "../utils/auth.js";
+import { log } from "../utils/logger.js";
+
+export async function resolveSetupApiKey(): Promise<string | null> {
+  const accessToken = (await getValidAccessToken()) ?? (await performLogin());
+
+  if (!accessToken) return null;
+  if (isContext7ApiKey(accessToken)) return accessToken;
+
+  const spinner = ora("Configuring authentication...").start();
+
+  try {
+    const response = await fetch(`${getBaseUrl()}/api/dashboard/api-keys`, {
+      method: "POST",
+      headers: {
+        Authorization: `Bearer ${accessToken}`,
+        "Content-Type": "application/json",
+      },
+      body: JSON.stringify({ name: `ctx7-cli-${randomBytes(3).toString("hex")}` }),
+    });
+
+    if (!response.ok) {
+      const err = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
+      spinner.fail("Authentication failed");
+      log.error(err.message || err.error || `HTTP ${response.status}`);
+      return null;
+    }
+
+    const result = (await response.json()) as { data: { apiKey: string } };
+    spinner.succeed("Authenticated");
+    return result.data.apiKey;
+  } catch (err) {
+    spinner.fail("Authentication failed");
+    log.error(err instanceof Error ? err.message : String(err));
+    return null;
+  }
+}
```

---

### Incident Patch 13: `2a851fcd` (2026-08-31)
**Commit Message**: fix(mcp): remove legacy client IP encryption (#3112)

**File**: `.changeset/remove-legacy-client-ip.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@upstash/context7-mcp": patch
+---
+
+Remove the legacy AES-CBC client-IP header now that authenticated assertions are deployed.
```

**File**: `.env.example` (modified, +0/-3)
```diff
@@ -16,9 +16,6 @@ MCP_CLIENT_IP_ASSERTION_KEY=
 # Maximum concurrent MCP subscription streams per HTTP process.
 MCP_MAX_SUBSCRIPTIONS=16000
 
-# Temporary legacy rollout key. Removal is tracked by CTX7-2536.
-CLIENT_IP_ENCRYPTION_KEY=
-
 # Network / certificates
 HTTPS_PROXY=
 NODE_EXTRA_CA_CERTS=
```

**File**: `docs/security/data-privacy.mdx` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ When you use Context7 through an MCP client, the AI assistant (not the user dire
 - API key (if provided, for authentication)
 - MCP client name and version (e.g., IDE info, for analytics)
 - Transport type (`stdio` or `http`)
-- Client IP address, encrypted with AES-256-CBC (HTTP transport only, for rate limiting)
+- Client IP address, sent as a short-lived authenticated AES-256-GCM assertion by hosted HTTP deployments (for rate limiting)
 
 <Note>
   The MCP client formulates search queries on your behalf and is instructed not to include
```

**File**: `packages/mcp/src/lib/encryption.ts` (modified, +4/-27)
```diff
@@ -3,7 +3,6 @@ import { isIP } from "node:net";
 import { SERVER_VERSION } from "./constants.js";
 import type { ClientContext } from "./types.js";
 
-const LEGACY_ALGORITHM = "aes-256-cbc";
 const ASSERTION_ALGORITHM = "aes-256-gcm";
 const ASSERTION_VERSION = "v1";
 let reportedInvalidAssertionKey = false;
@@ -13,26 +12,11 @@ function validateEncryptionKey(key: string): boolean {
   return /^[0-9a-fA-F]{64}$/.test(key);
 }
 
-function encryptionKey(name: "MCP_CLIENT_IP_ASSERTION_KEY" | "CLIENT_IP_ENCRYPTION_KEY") {
-  const key = process.env[name];
+function assertionKey() {
+  const key = process.env.MCP_CLIENT_IP_ASSERTION_KEY;
   return key && validateEncryptionKey(key) ? Buffer.from(key, "hex") : null;
 }
 
-/**
- * Temporary compatibility header for API deployments that predate authenticated assertions.
- * This header is ignored by patched API deployments. Removal is tracked by CTX7-2536.
- */
-function encryptLegacyClientIp(clientIp: string, key: Buffer): string | null {
-  try {
-    const iv = randomBytes(16);
-    const cipher = createCipheriv(LEGACY_ALGORITHM, key, iv);
-    const encrypted = Buffer.concat([cipher.update(clientIp, "utf8"), cipher.final()]);
-    return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
-  } catch {
-    return null;
-  }
-}
-
 /**
  * Create a short-lived, authenticated client-IP assertion.
  * Format: v1:<unix timestamp seconds>:<12-byte nonce hex>:<ciphertext + tag hex>
@@ -42,7 +26,7 @@ export function createClientIpAssertion(
   nowMs = Date.now(),
   nonce = randomBytes(12)
 ): string | null {
-  const key = encryptionKey("MCP_CLIENT_IP_ASSERTION_KEY");
+  const key = assertionKey();
   if (!key) {
     if (!reportedInvalidAssertionKey) {
       reportedInvalidAssertionKey = true;
@@ -79,14 +63,7 @@ export function generateHeaders(context: ClientContext): Record<string, string>
 
   if (context.clientIp) {
     const assertion = createClientIpAssertion(context.clientIp);
-    if (assertion) {
-      headers["mcp-client-ip-assertion"] = assertion;
-
-      // Producer-first rollout compatibility. Removal is tracked by CTX7-2536.
-      const key = encryptionKey("CLIENT_IP_ENCRYPTION_KEY");
-      const legacyValue = key ? encryptLegacyClientIp(context.clientIp, key) : null;
-      if (legacyValue) headers["mcp-client-ip"] = legacyValue;
-    }
+    if (assertion) headers["mcp-client-ip-assertion"] = assertion;
   }
   if (context.sessionId) {
     headers["mcp-session-id"] = context.sessionId;
```

**File**: `packages/mcp/test/encryption.test.ts` (modified, +2/-5)
```diff
@@ -8,12 +8,10 @@ const NONCE = Buffer.from("00112233445566778899aabb", "hex");
 describe("client IP assertions", () => {
   beforeEach(() => {
     process.env.MCP_CLIENT_IP_ASSERTION_KEY = KEY;
-    process.env.CLIENT_IP_ENCRYPTION_KEY = KEY;
   });
 
   afterEach(() => {
     delete process.env.MCP_CLIENT_IP_ASSERTION_KEY;
-    delete process.env.CLIENT_IP_ENCRYPTION_KEY;
   });
 
   test("creates a versioned AES-GCM assertion", () => {
@@ -24,16 +22,15 @@ describe("client IP assertions", () => {
     );
   });
 
-  test("emits authenticated and rollout-compatible headers", () => {
+  test("emits only the authenticated assertion header", () => {
     const headers = generateHeaders({ clientIp: "203.0.113.99" });
 
     expect(headers["mcp-client-ip-assertion"]).toMatch(/^v1:/);
-    expect(headers["mcp-client-ip"]).toMatch(/^[0-9a-f]{32}:[0-9a-f]+$/);
+    expect(headers["mcp-client-ip"]).toBeUndefined();
   });
 
   test("fails closed instead of sending plaintext when the key is absent or invalid", () => {
     delete process.env.MCP_CLIENT_IP_ASSERTION_KEY;
-    delete process.env.CLIENT_IP_ENCRYPTION_KEY;
     expect(
       generateHeaders({ clientIp: "203.0.113.99" })["mcp-client-ip-assertion"]
     ).toBeUndefined();
```

**File**: `packages/mcp/test/integration.test.ts` (modified, +1/-2)
```diff
@@ -118,7 +118,6 @@ beforeAll(async () => {
     ...getDefaultEnvironment(),
     CONTEXT7_API_URL: stubUrl,
     MCP_CLIENT_IP_ASSERTION_KEY: CLIENT_IP_ASSERTION_KEY,
-    CLIENT_IP_ENCRYPTION_KEY: CLIENT_IP_ASSERTION_KEY,
   };
   ({ child: httpChild, url: httpUrl } = await startHttpChild());
 }, 120_000);
@@ -257,7 +256,7 @@ describe.each([
       expect(
         decryptClientIpAssertion(apiCalls[0].headers["mcp-client-ip-assertion"] as string)
       ).toBe("203.0.113.77");
-      expect(apiCalls[0].headers["mcp-client-ip"]).toMatch(/^[0-9a-f]{32}:[0-9a-f]+$/);
+      expect(apiCalls[0].headers["mcp-client-ip"]).toBeUndefined();
     } else {
       expect(apiCalls[0].headers["mcp-client-ip-assertion"]).toBeUndefined();
     }
```

---

### Incident Patch 14: `4e980f6b` (2026-08-28)
**Commit Message**: fix(mcp): increase HTTP subscription capacity (#3101)

* fix(mcp): increase HTTP subscription capacity

* fix(mcp): use benchmarked subscription capacity

* fix(mcp): set subscription ceiling to 24k

* fix(mcp): start subscription ceiling at 16k

* fix(mcp): clarify subscription limit safeguards

**File**: `.changeset/quiet-dodos-listen.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@upstash/context7-mcp": patch
+---
+
+Increase the default HTTP subscription capacity and allow deployments to configure it with `MCP_MAX_SUBSCRIPTIONS`.
```

**File**: `.env.example` (modified, +3/-0)
```diff
@@ -13,6 +13,9 @@ OPENAI_APPS_CHALLENGE_TOKEN=
 # Required for hosted HTTP deployments. Must match context7.com.
 MCP_CLIENT_IP_ASSERTION_KEY=
 
+# Maximum concurrent MCP subscription streams per HTTP process.
+MCP_MAX_SUBSCRIPTIONS=16000
+
 # Temporary legacy rollout key. Removal is tracked by CTX7-2536.
 CLIENT_IP_ENCRYPTION_KEY=
 
```

**File**: `packages/mcp/src/index.ts` (modified, +2/-0)
```diff
@@ -24,6 +24,7 @@ import {
   OPENAI_APPS_CHALLENGE_TOKEN,
 } from "./lib/constants.js";
 import { maybeElicitAuthSignIn } from "./lib/auth/auth-prompt.js";
+import { getMaxSubscriptions } from "./lib/subscriptions.js";
 
 /** Default HTTP server port */
 const DEFAULT_PORT = 3000;
@@ -380,6 +381,7 @@ async function main() {
     // go idle and the gateway reaps them at streamIdleTimeout (300s).
     const mcpHandler = createMcpHandler(() => createMcpServer(), {
       keepAliveMs: 0,
+      maxSubscriptions: getMaxSubscriptions(),
       onerror: (error) => console.error("MCP handler error:", error),
     });
     // Without onerror, request-conversion / handler.fetch throws are answered
```

**File**: `packages/mcp/src/lib/subscriptions.ts` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+// 16k stayed near baseline latency in Docker; 32,768 raised tools/list p95 to ~39 ms.
+export const DEFAULT_MAX_SUBSCRIPTIONS = 16_000;
+
+export function getMaxSubscriptions(value = process.env.MCP_MAX_SUBSCRIPTIONS): number {
+  if (value === undefined) return DEFAULT_MAX_SUBSCRIPTIONS;
+
+  const parsed = Number(value);
+  if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
+
+  console.warn(`Invalid MCP_MAX_SUBSCRIPTIONS; using the default of ${DEFAULT_MAX_SUBSCRIPTIONS}.`);
+  return DEFAULT_MAX_SUBSCRIPTIONS;
+}
```

**File**: `packages/mcp/test/subscriptions.test.ts` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+import { afterEach, describe, expect, test, vi } from "vitest";
+import { DEFAULT_MAX_SUBSCRIPTIONS, getMaxSubscriptions } from "../src/lib/subscriptions.js";
+
+describe("getMaxSubscriptions", () => {
+  afterEach(() => {
+    vi.restoreAllMocks();
+  });
+
+  test("defaults to 16000 subscriptions", () => {
+    expect(getMaxSubscriptions(undefined)).toBe(DEFAULT_MAX_SUBSCRIPTIONS);
+  });
+
+  test("accepts a positive integer override", () => {
+    expect(getMaxSubscriptions("8192")).toBe(8_192);
+  });
+
+  test.each(["0", "-1", "1.5", "invalid", "Infinity"])(
+    "falls back for invalid value %s",
+    (value) => {
+      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
+
+      expect(getMaxSubscriptions(value)).toBe(DEFAULT_MAX_SUBSCRIPTIONS);
+      expect(warn).toHaveBeenCalledOnce();
+    }
+  );
+});
```

---

### Incident Patch 15: `794cc6ba` (2026-08-28)
**Commit Message**: fix(mcp): authenticate forwarded client IP assertions (#3088)

* fix(mcp): sign forwarded client IP assertions

* fix(mcp): trust proxy-derived client addresses

* fix(mcp): preserve legacy rollout key

* fix(mcp): validate asserted client addresses

* fix(mcp): retain CGNAT proxy support

**File**: `.changeset/signed-client-ip-assertions.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@upstash/context7-mcp": patch
+---
+
+Authenticate hosted MCP client-IP forwarding with short-lived AES-GCM assertions.
```

**File**: `.env.example` (modified, +5/-0)
```diff
@@ -9,6 +9,11 @@ OAUTH_JWKS_URL=
 EMA_ISSUER=
 AUTH_SERVER_URL=
 OPENAI_APPS_CHALLENGE_TOKEN=
+
+# Required for hosted HTTP deployments. Must match context7.com.
+MCP_CLIENT_IP_ASSERTION_KEY=
+
+# Temporary legacy rollout key. Removal is tracked by CTX7-2536.
 CLIENT_IP_ENCRYPTION_KEY=
 
 # Network / certificates
```

**File**: `packages/mcp/src/index.ts` (modified, +4/-2)
```diff
@@ -24,7 +24,6 @@ import {
   OPENAI_APPS_CHALLENGE_TOKEN,
 } from "./lib/constants.js";
 import { maybeElicitAuthSignIn } from "./lib/auth/auth-prompt.js";
-import { getClientIp } from "./lib/client-ip.js";
 
 /** Default HTTP server port */
 const DEFAULT_PORT = 3000;
@@ -316,6 +315,9 @@ async function main() {
     const initialPort = CLI_PORT ?? DEFAULT_PORT;
 
     const app = express();
+    // Only private/local infrastructure may supply forwarding headers. Express
+    // then walks the chain right-to-left and ignores attacker-added prefixes.
+    app.set("trust proxy", ["loopback", "linklocal", "uniquelocal", "100.64.0.0/10"]);
     app.use(express.json());
 
     app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
@@ -433,7 +435,7 @@ async function main() {
         }
 
         const context: ClientContext = {
-          clientIp: getClientIp(req),
+          clientIp: req.ip,
           apiKey: apiKey,
           clientInfo: extractClientInfoFromUserAgent(req.headers["user-agent"]),
           transport: "http",
```

**File**: `packages/mcp/src/lib/client-ip.ts` (removed, +0/-78)
```diff
@@ -1,78 +0,0 @@
-import type express from "express";
-
-function stripIpv4MappedPrefix(ip: string): string {
-  return ip.replace(/^::ffff:/i, "");
-}
-
-/**
- * Returns true for RFC1918, CGNAT, loopback, link-local, and IPv6 private ranges.
- */
-export function isPrivateOrLocalIp(ip: string): boolean {
-  const plainIp = stripIpv4MappedPrefix(ip).toLowerCase();
-
-  if (plainIp.includes(".")) {
-    return (
-      plainIp.startsWith("10.") ||
-      plainIp.startsWith("192.168.") ||
-      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(plainIp) ||
-      /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./.test(plainIp) ||
-      plainIp.startsWith("127.") ||
-      plainIp.startsWith("169.254.")
-    );
-  }
-
-  // ::1 loopback in any textual form (e.g. "0::1", "0:0:0:0:0:0:0:1")
-  if (/^[0:]+1$/.test(plainIp)) {
-    return true;
-  }
-
-  // First hextets in fe80::/10 and fc00::/7 start with a non-zero digit, so a
-  // valid textual form always spells out all 4 digits.
-
-  // fe80::/10 link-local
-  if (/^fe[89ab][0-9a-f]:/.test(plainIp)) {
-    return true;
-  }
-
-  // fc00::/7 unique local
-  if (/^f[cd][0-9a-f]{2}:/.test(plainIp)) {
-    return true;
-  }
-
-  return false;
-}
-
-function pickClientIpFromForwardedList(ipList: string[]): string | undefined {
-  for (const ip of ipList) {
-    const plainIp = stripIpv4MappedPrefix(ip);
-    if (!isPrivateOrLocalIp(plainIp)) {
-      return plainIp;
-    }
-  }
-
-  if (ipList.length === 0) {
-    return undefined;
-  }
-
-  return stripIpv4MappedPrefix(ipList[0]);
-}
-
-/**
- * Extract client IP address from request headers.
- * Handles X-Forwarded-For header for proxied requests.
- */
-export function getClientIp(req: express.Request): string | undefined {
-  const forwardedFor = req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"];
-
-  if (forwardedFor) {
-    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
-    const ipList = ips.split(",").map((ip) => ip.trim());
-    return pickClientIpFromForwardedList(ipList);
-  }
-
-  if (req.socket?.remoteAddress) {
-    return stripIpv4MappedPrefix(req.socket.remoteAddress);
-  }
-
-  return undefined;
-}
```

**File**: `packages/mcp/src/lib/encryption.ts` (modified, +62/-16)
```diff
@@ -1,31 +1,69 @@
 import { createCipheriv, randomBytes } from "crypto";
+import { isIP } from "node:net";
 import { SERVER_VERSION } from "./constants.js";
 import type { ClientContext } from "./types.js";
 
-const DEFAULT_ENCRYPTION_KEY = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
-const ENCRYPTION_KEY = process.env.CLIENT_IP_ENCRYPTION_KEY || DEFAULT_ENCRYPTION_KEY;
-const ALGORITHM = "aes-256-cbc";
+const LEGACY_ALGORITHM = "aes-256-cbc";
+const ASSERTION_ALGORITHM = "aes-256-gcm";
+const ASSERTION_VERSION = "v1";
+let reportedInvalidAssertionKey = false;
 
 function validateEncryptionKey(key: string): boolean {
   // Must be exactly 64 hex characters (32 bytes)
   return /^[0-9a-fA-F]{64}$/.test(key);
 }
 
-function encryptClientIp(clientIp: string): string {
-  if (!validateEncryptionKey(ENCRYPTION_KEY)) {
-    console.error("Invalid encryption key format. Must be 64 hex characters.");
-    return clientIp; // Fallback to unencrypted
-  }
+function encryptionKey(name: "MCP_CLIENT_IP_ASSERTION_KEY" | "CLIENT_IP_ENCRYPTION_KEY") {
+  const key = process.env[name];
+  return key && validateEncryptionKey(key) ? Buffer.from(key, "hex") : null;
+}
 
+/**
+ * Temporary compatibility header for API deployments that predate authenticated assertions.
+ * This header is ignored by patched API deployments. Removal is tracked by CTX7-2536.
+ */
+function encryptLegacyClientIp(clientIp: string, key: Buffer): string | null {
   try {
     const iv = randomBytes(16);
-    const cipher = createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "hex"), iv);
-    let encrypted = cipher.update(clientIp, "utf8", "hex");
-    encrypted += cipher.final("hex");
-    return iv.toString("hex") + ":" + encrypted;
-  } catch (error) {
-    console.error("Error encrypting client IP:", error);
-    return clientIp; // Fallback to unencrypted
+    const cipher = createCipheriv(LEGACY_ALGORITHM, key, iv);
+    const encrypted = Buffer.concat([cipher.update(clientIp, "utf8"), cipher.final()]);
+    return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
+  } catch {
+    return null;
+  }
+}
+
+/**
+ * Create a short-lived, authenticated client-IP assertion.
+ * Format: v1:<unix timestamp seconds>:<12-byte nonce hex>:<ciphertext + tag hex>
+ */
+export function createClientIpAssertion(
+  clientIp: string,
+  nowMs = Date.now(),
+  nonce = randomBytes(12)
+): string | null {
+  const key = encryptionKey("MCP_CLIENT_IP_ASSERTION_KEY");
+  if (!key) {
+    if (!reportedInvalidAssertionKey) {
+      reportedInvalidAssertionKey = true;
+      console.error(
+        "MCP_CLIENT_IP_ASSERTION_KEY is missing or invalid; client IP assertions are disabled."
+      );
+    }
+    return null;
+  }
+  if (nonce.length !== 12 || isIP(clientIp) === 0) return null;
+
+  try {
+    const timestamp = Math.floor(nowMs / 1000).toString();
+    const aad = `${ASSERTION_VERSION}:${timestamp}`;
+    const cipher = createCipheriv(ASSERTION_ALGORITHM, key, nonce);
+    cipher.setAAD(Buffer.from(aad, "utf8"));
+    const ciphertext = Buffer.concat([cipher.update(clientIp, "utf8"), cipher.final()]);
+    const ciphertextAndTag = Buffer.concat([ciphertext, cipher.getAuthTag()]);
+    return `${aad}:${nonce.toString("hex")}:${ciphertextAndTag.toString("hex")}`;
+  } catch {
+    return null;
   }
 }
 
@@ -40,7 +78,15 @@ export function generateHeaders(context: ClientContext): Record<string, string>
   };
 
   if (context.clientIp) {
-    headers["mcp-client-ip"] = encryptClientIp(context.clientIp);
+    const assertion = createClientIpAssertion(context.clientIp);
+    if (assertion) {
+      headers["mcp-client-ip-assertion"] = assertion;
+
+      // Producer-first rollout compatibility. Removal is tracked by CTX7-2536.
+      const key = encryptionKey("CLIENT_IP_ENCRYPTION_KEY");
+      const legacyValue = key ? encryptLegacyClientIp(context.clientIp, key) : null;
+      if (legacyValue) headers["mcp-client-ip"] = legacyValue;
+    }
   }
   if (context.sessionId) {
     headers["mcp-session-id"] = context.sessionId;
```

**File**: `packages/mcp/test/client-ip.test.ts` (removed, +0/-96)
```diff
@@ -1,96 +0,0 @@
-import { describe, expect, test } from "vitest";
-import type express from "express";
-import { getClientIp, isPrivateOrLocalIp } from "../src/lib/client-ip.js";
-
-describe("isPrivateOrLocalIp", () => {
-  test.each([
-    "10.0.0.1",
-    "192.168.1.1",
-    "172.16.0.1",
-    "127.0.0.1",
-    "169.254.1.1",
-    "100.64.0.1",
-    "100.127.255.255",
-    "::1",
-    "0::1",
-    "0:0:0:0:0:0:0:1",
-    "fe80::1",
-    "FE80::1",
-    "febf::1",
-    "fc00::1",
-    "fd12::1",
-    "fdff::1",
-    "::ffff:127.0.0.1",
-  ])("treats %s as private or local", (ip) => {
-    expect(isPrivateOrLocalIp(ip)).toBe(true);
-  });
-
-  test.each([
-    "8.8.8.8",
-    "203.0.113.10",
-    "100.63.255.255",
-    "100.128.0.1",
-    "2001:db8::1",
-    "1::1",
-    "::11",
-    "::ffff:8.8.8.8",
-    // abbreviated first hextets that look like fe80::/10 or fc00::/7 but are not
-    "fe8::1",
-    "fc::1",
-    "fd0::1",
-    // fec0::/10 (deprecated site-local) is outside fe80::/10
-    "fec0::1",
-  ])("treats %s as public", (ip) => {
-    expect(isPrivateOrLocalIp(ip)).toBe(false);
-  });
-});
-
-describe("getClientIp", () => {
-  function makeRequest(headers: Record<string, string | string[]>): express.Request {
-    return {
-      headers,
-      socket: undefined,
-    } as express.Request;
-  }
-
-  test("skips loopback and link-local entries in X-Forwarded-For", () => {
-    const req = makeRequest({
-      "x-forwarded-for": "127.0.0.1, 8.8.8.8",
-    });
-
-    expect(getClientIp(req)).toBe("8.8.8.8");
-  });
-
-  test("skips RFC1918 and returns the first public forwarded IP", () => {
-    const req = makeRequest({
-      "x-forwarded-for": "10.0.0.1, 192.168.0.2, 203.0.113.10",
-    });
-
-    expect(getClientIp(req)).toBe("203.0.113.10");
-  });
-
-  test("skips IPv6 loopback and private ranges in X-Forwarded-For", () => {
-    const req = makeRequest({
-      "x-forwarded-for": "::1, fe80::1, fc00::1, 2001:db8::5",
-    });
-
-    expect(getClientIp(req)).toBe("2001:db8::5");
-  });
-
-  test("falls back to the first forwarded IP when all entries are private", () => {
-    const req = makeRequest({
-      "x-forwarded-for": "127.0.0.1, 10.0.0.1",
-    });
-
-    expect(getClientIp(req)).toBe("127.0.0.1");
-  });
-
-  test("uses socket remote address when X-Forwarded-For is absent", () => {
-    const req = {
-      headers: {},
-      socket: { remoteAddress: "::ffff:203.0.113.10" },
-    } as express.Request;
-
-    expect(getClientIp(req)).toBe("203.0.113.10");
-  });
-});
```

**File**: `packages/mcp/test/encryption.test.ts` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+import { afterEach, beforeEach, describe, expect, test } from "vitest";
+import { createClientIpAssertion, generateHeaders } from "../src/lib/encryption.js";
+
+const KEY = "0123456789abcdef".repeat(4);
+const NOW_MS = 1_788_000_000_000;
+const NONCE = Buffer.from("00112233445566778899aabb", "hex");
+
+describe("client IP assertions", () => {
+  beforeEach(() => {
+    process.env.MCP_CLIENT_IP_ASSERTION_KEY = KEY;
+    process.env.CLIENT_IP_ENCRYPTION_KEY = KEY;
+  });
+
+  afterEach(() => {
+    delete process.env.MCP_CLIENT_IP_ASSERTION_KEY;
+    delete process.env.CLIENT_IP_ENCRYPTION_KEY;
+  });
+
+  test("creates a versioned AES-GCM assertion", () => {
+    const value = createClientIpAssertion("203.0.113.99", NOW_MS, NONCE);
+
+    expect(value).toBe(
+      "v1:1788000000:00112233445566778899aabb:8f761fbf38cf8e7ea8dd992aab5e3db53b0f318adfe3d3207e8675d4"
+    );
+  });
+
+  test("emits authenticated and rollout-compatible headers", () => {
+    const headers = generateHeaders({ clientIp: "203.0.113.99" });
+
+    expect(headers["mcp-client-ip-assertion"]).toMatch(/^v1:/);
+    expect(headers["mcp-client-ip"]).toMatch(/^[0-9a-f]{32}:[0-9a-f]+$/);
+  });
+
+  test("fails closed instead of sending plaintext when the key is absent or invalid", () => {
+    delete process.env.MCP_CLIENT_IP_ASSERTION_KEY;
+    delete process.env.CLIENT_IP_ENCRYPTION_KEY;
+    expect(
+      generateHeaders({ clientIp: "203.0.113.99" })["mcp-client-ip-assertion"]
+    ).toBeUndefined();
+    expect(generateHeaders({ clientIp: "203.0.113.99" })["mcp-client-ip"]).toBeUndefined();
+
+    process.env.MCP_CLIENT_IP_ASSERTION_KEY = "not-a-key";
+    expect(createClientIpAssertion("203.0.113.99", NOW_MS, NONCE)).toBeNull();
+  });
+
+  test.each(["999.999.999.999", "1:2:3", "attacker-selected-bucket"])(
+    "refuses to sign an invalid IP address (%s)",
+    (value) => {
+      expect(createClientIpAssertion(value, NOW_MS, NONCE)).toBeNull();
+    }
+  );
+});
```

**File**: `packages/mcp/test/integration.test.ts` (modified, +39/-2)
```diff
@@ -4,6 +4,7 @@ import { StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
 import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/client/stdio";
 import { execSync } from "node:child_process";
 import { spawn, type ChildProcess } from "node:child_process";
+import { createDecipheriv } from "node:crypto";
 import http from "node:http";
 import { fileURLToPath } from "node:url";
 import path from "node:path";
@@ -19,6 +20,23 @@ const PKG_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), ".."
 const DIST = path.join(PKG_ROOT, "dist", "index.js");
 const BASE_PORT = 43117;
 const STUB_DOCS = "stub docs text";
+const CLIENT_IP_ASSERTION_KEY = "0123456789abcdef".repeat(4);
+
+function decryptClientIpAssertion(value: string): string {
+  const [version, timestamp, nonceHex, ciphertextAndTagHex] = value.split(":");
+  const ciphertextAndTag = Buffer.from(ciphertextAndTagHex, "hex");
+  const decipher = createDecipheriv(
+    "aes-256-gcm",
+    Buffer.from(CLIENT_IP_ASSERTION_KEY, "hex"),
+    Buffer.from(nonceHex, "hex")
+  );
+  decipher.setAAD(Buffer.from(`${version}:${timestamp}`, "utf8"));
+  decipher.setAuthTag(ciphertextAndTag.subarray(-16));
+  return Buffer.concat([
+    decipher.update(ciphertextAndTag.subarray(0, -16)),
+    decipher.final(),
+  ]).toString("utf8");
+}
 
 interface RecordedRequest {
   path: string;
@@ -96,7 +114,12 @@ beforeAll(async () => {
   const stubUrl = await startStubApi();
   // getDefaultEnvironment() inherits only safe vars, so a real
   // CONTEXT7_API_KEY in the parent shell cannot leak into the children.
-  childEnv = { ...getDefaultEnvironment(), CONTEXT7_API_URL: stubUrl };
+  childEnv = {
+    ...getDefaultEnvironment(),
+    CONTEXT7_API_URL: stubUrl,
+    MCP_CLIENT_IP_ASSERTION_KEY: CLIENT_IP_ASSERTION_KEY,
+    CLIENT_IP_ENCRYPTION_KEY: CLIENT_IP_ASSERTION_KEY,
+  };
   ({ child: httpChild, url: httpUrl } = await startHttpChild());
 }, 120_000);
 
@@ -115,7 +138,12 @@ async function connect(transportKind: "http" | "stdio", era: "modern" | "legacy"
       ? new StreamableHTTPClientTransport(new URL(httpUrl), {
           // Parseable UA so the legacy-HTTP fallback path (no protocol client
           // info) is observable; modern clients must beat it via the envelope.
-          requestInit: { headers: { "user-agent": "ua-fallback/9.9.9" } },
+          requestInit: {
+            headers: {
+              "user-agent": "ua-fallback/9.9.9",
+              "x-forwarded-for": "attacker-selected-bucket, 203.0.113.77",
+            },
+          },
         })
       : new StdioClientTransport({ command: process.execPath, args: [DIST], env: childEnv });
   await client.connect(transport);
@@ -224,6 +252,15 @@ describe.each([
     expect(apiCalls[0].query.get("libraryId")).toBe("/vercel/next.js");
     expect(apiCalls[0].query.get("query")).toBe("app router");
     expect(apiCalls[0].headers["x-context7-transport"]).toBe(transportKind);
+    if (transportKind === "http") {
+      expect(apiCalls[0].headers["mcp-client-ip-assertion"]).toMatch(/^v1:/);
+      expect(
+        decryptClientIpAssertion(apiCalls[0].headers["mcp-client-ip-assertion"] as string)
+      ).toBe("203.0.113.77");
+      expect(apiCalls[0].headers["mcp-client-ip"]).toMatch(/^[0-9a-f]{32}:[0-9a-f]+$/);
+    } else {
+      expect(apiCalls[0].headers["mcp-client-ip-assertion"]).toBeUndefined();
+    }
   });
 
   test("calls resolve-library-id end to end", async () => {
```

#### Recent Merged Pull Requests:
- **PR #3319** (2026-10-05): chore(release): version packages (@github-actions[bot])
- **PR #3305** (2026-10-05): fix(cli): accept trailing commas in OpenCode JSONC (@lorenzozanee)
- **PR #3304** (2026-10-02): CTX7-3048: Use the published OpenAPI spec in the Context7 docs (@enesgules)
- **PR #3303** (2026-10-02): CTX7-3042: Docs7 Free allows three sites (@enesgules)
- **PR #3301** (2026-10-02): chore(release): version packages (@github-actions[bot])
- **PR #3300** (2026-10-01): CTX7-3039: Support OpenCode v2 in the OpenCode plugin (@ramazanoacar)
- **PR #3298** (closed): chore(deps-dev): bump @openrouter/ai-sdk-provider from 2.10.0 to 3.1.0 (@dependabot[bot])
- **PR #3297** (closed): chore(deps): bump jose from 6.2.3 to 6.2.12 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
