# Forensic Learning Record (Deep Inspection): first-fluke/oh-my-agent

> **Canonical Artifact**: `07_PROJECT_LEARNING/first-fluke-oh-my-agent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/first-fluke/oh-my-agent](https://github.com/first-fluke/oh-my-agent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:14:26.693Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `first-fluke/oh-my-agent`
- **Description**: Mechanical verification for AI coding agents — skills pack or full harness (stop-hook gates, artifact checks, independent judges).
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1333 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/hooks/core/agentmemory-client.ts`
```
#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import type { IncomingHttpHeaders } from "node:http";
import http from "node:http";
import https from "node:https";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { currentMemoryAdapter } from "./memory-adapter.ts";

function endpointUrl(): string | null {
  if (process.env.OMA_NO_AGENTMEMORY === "1") return null;
  if (process.env.AGENTMEMORY_URL) return process.env.AGENTMEMORY_URL;

  const endpointPath = join(homedir(), ".agentmemory", "endpoint.json");
  if (!existsSync(endpointPath)) return null;

  try {
    const cfg = JSON.parse(readFileSync(endpointPath, "utf-8")) as {
      port?: number;
      url?: string;
    };
    if (typeof cfg.port === "number") return `http://127.0.0.1:${cfg.port}`;
    if (typeof cfg.url === "string" && cfg.url.trim()) return cfg.url;
    return null;
  } catch {
    return null;
  }
}

let reachable: boolean | null = null;

/**
 * Test-only: clear the memoized reachability probe so cases that point
 * `AGENTMEMORY_URL` at different endpoints don't leak a cached verdict into each
 * other (the probe is intentionally memoized once per process at runtime).
 */
export function _resetReachableCache(): void {
  reachable = null;
}

function requestAgentMemory(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
  } = {},
): Promise<{ statusCode: number; headers: IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const target = new URL(path, baseUrl);
    const client = target.protocol === "https:" ? https : http;
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      reject(new Error(`unsupported protocol ${target.protocol}`));
      return;
    }

    const body = options.body;
    const headers = { ...(options.headers ?? {}) };
    if (body !== undefined && headers["content-length"] === undefined) {
      headers["content-length"] = String(Buffer.byteLength(body));
    }

    const req = client.request(
      target,
      {
        method: options.method ?? "GET",
        headers,
      },
      (res) => {
        let responseBody = "";
        res.setEncoding("utf-8");
        res.on("data", (chunk) => {
          responseBody += chunk;
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            body: responseBody,
          });
        });
        res.on("error", reject);
      },
    );
    req.setTimeout(options.timeoutMs ?? 500, () => {
      req.destroy(new Error("request timed out"));
    });
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

export async function isAgentMemoryReachable(): Promise<boolean> {
  if (reachable !== null) return reachable;
  const url = endpointUrl();
  if (!url) {
    reachable = false;
    return reachable;
  }

  try {
    const response = await requestAgentMemory(url, "/agentmemory/health");
    // Capability-based acceptance: any 2xx health response from the
    // explicitly configured endpoint counts as reachable. Version pinning
    // proved brittle (the published line already jumped from 0.11/0.12
    // design targets to 0.9.x service builds), so payload shape and version
    // are no longer gating.
    reachable = response.statusCode >= 200 && response.statusCode < 300;
    return reachable;
  } catch {
    reachable = false;
    return reachable;
  }
}

export interface RecalledFact {
  text: string;
  source?: string;
  score?: number;
}

interface SearchResult {
  score?: number;
  timestamp?: unknown;
  created_at?: unknown;
  observation?: {
    narrative?: unknown;
    facts?: unknown;
    title?: unknown;
    type?: unknown;
    timestamp?: unknown;
    created_at?: unknown;
  };
}

/**
 * Recall TTL: facts older than this many days are dropped from the snapshot so
 * stale, long-resolved decisions stop rehydrating every boundary. Default 30
 * days; set `OMA_RECALL_MAX_AGE_DAYS=0` (or a non-positive value) to disable.
 * Returns the max age in ms, or null when disabled.
 */
function recallMaxAgeMs(): number | null {
  const raw = process.env.OMA_RECALL_MAX_AGE_DAYS;
  const days = raw === undefined ? 30 : Number(raw);
  if (!Number.isFinite(days) || days <= 0) return null;
  return days * 24 * 60 * 60 * 1000;
}

/**
 * Best-effort timestamp extraction from a search result. AgentMemory's response
 * envelope is not contractually fixed across versions, so several candidate
 * field names / locations are probed. Numeric epoch seconds are normalised to
 * ms. Returns null when no parseable timestamp is present — callers then keep
 * the fact (TTL filtering is fail-open, never dropping facts of unknown age).
 */
function extractTimestampMs(entry: SearchResult): number | null {
  const obs = entry.observation ?? {};
  const candidates: unknown[] = [
    obs.timestamp,
    obs.created_at,
    entry.timestamp,
    entry.created_at,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate < 1e12 ? candidate * 1000 : candidate;
    }
    if (typeof candidate === "string" && candidate.trim()) {
      const parsed = Date.parse(candidate);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

export function parseSearchResults(
  body: string,
  k: number,
  nowMs: number = Date.now(),
): RecalledFact[] {
  let parsed: { results?: unknown };
  try {
    parsed = JSON.parse(body) as { results?: unknown };
  } catch {
    return [];
  }
  if (!Array.isArray(parsed.results)) return [];

  const minScore = (() => {
    const raw = Number(process.env.OMA_RECALL_MIN_SCORE);
    return Number.isFinite(raw) ? raw : 1;
  })();

  const maxAgeMs = recallMaxAgeMs();
  const cutoffMs = maxAgeMs === null ? null : nowMs - maxAgeMs;

  const facts: RecalledFact[] = [];
  for (const entry of parsed.results as SearchResult[]) {
    const score = typeof entry.score === "number" ? entry.score : 0;
    // Raw `/observe` envelopes score near-zero (~0.006); enriched facts score
    // in the single digits. Drop the noise floor so the snapshot stays useful.
    if (score < minScore) continue;
    // TTL: drop facts older than the cutoff (fail-open on unknown age).
    if (cutoffMs !== null) {
      const tsMs = extractTimestampMs(entry);
      if (tsMs !== null && tsMs < cutoffMs) continue;
    }
    const obs = entry.observation ?? {};
    const narrative =
      typeof obs.narrative === "string" && obs.narrative.trim()
        ? obs.narrative.trim()
        : "";
    const factsText = Array.isArray(obs.facts)
      ? obs.facts.filter((f): f is string => typeof f === "string").join("; ")
      : "";
    const title = typeof obs.title === "string" ? obs.title.trim() : "";
    const text = narrative || factsText || title;
    if (!text) continue;
    const source = typeof obs.type === "string" ? obs.type : undefined;
    facts.push({ text, source, score });
    if (facts.length >= k) break;
  }
  return facts;
}

/**
 * Recall enriched facts from AgentMemory for boundary rehydration. Best-effort:
 * returns [] when the daemon is unreachable, on timeout (recall budget 2s per
 * design D34), or on any parse/transport error — never throws, never blocks L1.
 */
export async function recallFacts(
  query: string,
  k = 5,
  projectDir: string = process.cwd(),
): Promise<RecalledFact[]> {
  if (!query.trim()) return [];
  // The whole body is guarded so this honors its "never throws" contract: the
  // reachability probe and endpoint resolution can throw under load (e.g. a
  // socket error from the shared daemon), and an unguarded throw here blanks the
  // boundary snapshot the hook would otherwise emit. Degrade to local-only.
  try {
    const adapter = currentMemoryAdapter(projectDir);
    if (adapter) return await adapter.recall(query, k, projectDir);
    if (!(await isAgentMemoryReachable())) return [];
    const url = endpointUrl();
    if (!url) return [];
    const response = await requestAgentMemory(url, "/agentmemory/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Match the project identity used by observeWithTimeout. The query's
      // project-name term is a relevance hint, not a scope restriction.
      body: JSON.stringify({
        query,
        limit: k,
        project: basename(projectDir),
        cwd: projectDir,
      }),
      timeoutMs: 2000,
    });
    if (response.statusCode < 200 || response.statusCode >= 300) return [];
    return parseSearchResults(response.body, k);
  } catch {
    return [];
  }
}

export async function observeWithTimeout(payload: {
  sessionId: string;
  content: string;
  source: string;
  projectDir?: string;
}): Promise<boolean> {
  // Fully guarded (best-effort, never throws): the reachability probe and
  // endpoint resolution can throw under load, and a throw here must not abort
  // the hook that fired the observe.
  try {
    const adapter = currentMemoryAdapter(payload.projectDir);
    if (adapter) return await adapter.observe(payload);
    // An explicit opt-out leaves no observation to retry. Injected adapters
    // still own their delivery policy, including non-AgentMemory providers.
    if (process.env.OMA_NO_AGENTMEMORY === "1") return true;
    if (!(await isAgentMemoryReachable())) return false;
    const url = endpointUrl();
    if (!url) return false;
    // AgentMemory's /observe expects a hook-event envelope
    // (hookType, sessionId, project, cwd, timestamp) carrying the content.
    const cwd = payload.projectDir ?? process.cwd();
    const response = await requestAgentMemory(url, "/agentmemory/observe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        hookType: payload.
```

### Core Architecture Module: `.agents/hooks/core/agy-input.ts`
```
/**
 * Shared stdin parsing for the Antigravity CLI (agy) hook contract.
 *
 * agy's hooks (PreInvocation / PreToolUse / PostInvocation / Stop) deliver a
 * common envelope — `conversationId`, `workspacePaths`, `transcriptPath`,
 * `artifactDirectoryPath` — and, unlike every other vendor, DO NOT include the
 * user prompt or a `hook_event_name` field on stdin. The prompt must be
 * recovered from the transcript. Field names are camelCase.
 *
 * Ref: antigravity.google/docs/hooks — "Input/Output Contract".
 */
import { existsSync, readFileSync } from "node:fs";

/**
 * agy is identified by its stdin shape (no hook_event_name to key off): a
 * `workspacePaths` array plus a `conversationId` string. No other supported
 * vendor sends this pair.
 */
export function isAgyInput(input: Record<string, unknown>): boolean {
  return (
    Array.isArray(input.workspacePaths) &&
    typeof input.conversationId === "string"
  );
}

/** agy's project dir is the first mounted workspace path. */
export function agyProjectDir(input: Record<string, unknown>): string | null {
  const ws = input.workspacePaths;
  if (Array.isArray(ws) && typeof ws[0] === "string") return ws[0];
  return null;
}

/** agy's stable session identifier is the conversation UUID. */
export function agyConversationId(
  input: Record<string, unknown>,
): string | null {
  return typeof input.conversationId === "string" ? input.conversationId : null;
}

/**
 * Recover the latest user prompt from an agy transcript.jsonl.
 *
 * Each transcript line is a JSON step; user turns have `type === "USER_INPUT"`
 * with the request wrapped as `<USER_REQUEST>…</USER_REQUEST>` inside `content`
 * (alongside metadata blocks we strip). Returns the most recent request text,
 * or "" when the transcript is missing/unreadable.
 */
export function readAgyPrompt(transcriptPath: unknown): string {
  if (typeof transcriptPath !== "string" || !existsSync(transcriptPath)) {
    return "";
  }
  let content = "";
  try {
    for (const line of readFileSync(transcriptPath, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const step = JSON.parse(trimmed) as Record<string, unknown>;
        if (step.type === "USER_INPUT" && typeof step.content === "string") {
          content = step.content; // keep the last USER_INPUT
        }
      } catch {
        // skip malformed transcript line
      }
    }
  } catch {
    return "";
  }
  const match = content.match(/<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/);
  return (match?.[1] ?? content).trim();
}

```

### Core Architecture Module: `.agents/hooks/core/code-intelligence-guard.ts`
```
// PreToolUse hook — Deny native code search when a code-intelligence provider
// (Serena / Gortex) is configured, so the CLAUDE.md "Code Search" rule is
// enforced mechanically instead of relying on model compliance.
// Works with: Claude Code, Codex CLI, Cursor, Grok, Kimi, Kiro, Qwen Code.
//
// Scope decisions:
//  - Native searches confined to provider-excluded or external paths pass.
//    Other `Grep` / `Glob` calls use the provider. `Read` / `LS`
//    style tools are never touched — the provider contract is about discovery,
//    not reading.
//  - Shell commands are denied only when a segment's leading command is a
//    recursive code search: `rg` / `ag` / `ack` / `fd`, `grep` with a
//    recursive flag, `find` with a name/path predicate, or `git grep`.
//    Non-recursive `grep` (filtering a pipe / a single file) and `find` without
//    a name predicate pass through — they are not discovery.
//  - Gating: only fires when `providers.code_intelligence` resolves (yaml or
//    `.serena/project.yml`) and `providers.code_intelligence_guard` is not
//    `off`. The hook cannot observe whether the MCP server is actually up.
//    The deny reason does not name a bypass: confirmed exclusions and
//    external paths already pass, and project source stays on the provider.
//  - Escape hatch: a shell command containing `OMA_CI_ALLOW_NATIVE=1` passes
//    only when every search path resolves outside the project or is ignored
//    by git — ignored paths the provider listing did not recognize. Project
//    source, or a path the guard cannot resolve, stays blocked with the token.
//    Do not advertise it in the deny reason or shipped config. Grep/Glob have
//    no argument to carry a token, so the hatch stays shell-only.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, relative, resolve } from "node:path";
import {
  type CodeIntelligenceProvider,
  detectCodeIntelligenceGuardMode,
  detectCodeIntelligenceProvider,
} from "./code-intelligence-primer.ts";
import {
  isExcludedSearchScope,
  searchPathRoot,
} from "./code-intelligence-scope.ts";
import { makePreToolDenyOutput } from "./hook-output.ts";
import type { HandlerCtx, HandlerResult, HookInput, Vendor } from "./types.ts";
import { getProjectDir } from "./vendor-detect.ts";

export const BYPASS_TOKEN = "OMA_CI_ALLOW_NATIVE=1";

// --- Tool classification ---

/**
 * Native search tools a provider replaces. Claude Code names only: the other
 * wired vendors register this handler under their shell-tool matcher, so their
 * native search tools (e.g. Qwen `grep_search`) never reach the chain and are
 * deliberately not listed — enforcement there is the shell branch only.
 */
const GREP_TOOLS = new Set(["Grep"]);
const GLOB_TOOLS = new Set(["Glob"]);

/** Shell tools across the wired vendors (same set as scm-guard / test-filter). */
const SHELL_TOOLS = new Set([
  "Bash",
  "run_shell_command",
  "Shell",
  "execute_bash",
]);

// --- Shell command parsing ---

const RECURSIVE_SEARCHERS = new Set(["rg", "ag", "ack", "fd", "fdfind"]);
const GREP_BINARIES = new Set(["grep", "egrep", "fgrep", "ggrep"]);
const FIND_NAME_PREDICATES = new Set([
  "-name",
  "-iname",
  "-path",
  "-ipath",
  "-regex",
  "-iregex",
  "-wholename",
  "-iwholename",
]);

function tokenize(segment: string): string[] {
  return (segment.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map((t) =>
    t.replace(/^["']|["']$/g, ""),
  );
}

function commandSegments(command: string): string[] {
  // Preserve quoted regex alternation, semicolons and spaces.
  return command.match(/(?:"[^"]*"|'[^']*'|[^;|&\n])+/g) ?? [];
}

/**
 * Strip leading env assignments / wrappers (`FOO=1`, `sudo`, `command`,
 * `env`, `time`, `nice`) so the actual binary is at index 0.
 */
function stripPrefixes(tokens: string[]): string[] {
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i] ?? "";
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t)) {
      i++;
      continue;
    }
    if (
      t === "sudo" ||
      t === "command" ||
      t === "env" ||
      t === "time" ||
      t === "nice"
    ) {
      i++;
      // skip their own short options (e.g. `sudo -u root`, `env -i`)
      while (i < tokens.length && (tokens[i] ?? "").startsWith("-")) i++;
      continue;
    }
    break;
  }
  return tokens.slice(i);
}

function basename(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? path : path.slice(idx + 1);
}

function grepIsRecursive(args: string[]): boolean {
  for (const a of args) {
    if (a === "--") break;
    if (a === "--recursive" || a === "--dereference-recursive") return true;
    // Combined short flags: `-r`, `-rn`, `-Rin`, `-nri` … (not `--` long opts)
    if (/^-[A-Za-z]+$/.test(a) && /[rR]/.test(a)) return true;
  }
  return false;
}

function findHasNamePredicate(args: string[]): boolean {
  return args.some((a) => FIND_NAME_PREDICATES.has(a));
}

/**
 * Returns the leading search command of the first shell segment that performs
 * a recursive code search, or null when the command is not a search.
 * Exported for tests.
 */
export function detectNativeSearchCommand(command: string): string | null {
  const segments = commandSegments(command);
  for (const segment of segments) {
    const tokens = stripPrefixes(tokenize(segment.trim()));
    if (tokens.length === 0) continue;
    const bin = basename(tokens[0] ?? "");
    const args = tokens.slice(1);

    if (RECURSIVE_SEARCHERS.has(bin)) return bin;
    if (GREP_BINARIES.has(bin) && grepIsRecursive(args)) return bin;
    if (bin === "find" && findHasNamePredicate(args)) return bin;
    if (bin === "git" && args[0] === "grep") return "git grep";
  }
  return null;
}

// Options with values must not be mistaken for patterns or search roots.
const VALUE_OPTIONS = new Set([
  "-e",
  "-f",
  "-g",
  "-t",
  "-T",
  "-A",
  "-B",
  "-C",
  "-m",
  "-j",
  "-E",
  "--regexp",
  "--file",
  "--glob",
  "--iglob",
  "--type",
  "--type-not",
  "--after-context",
  "--before-context",
  "--context",
  "--max-count",
  "--max-depth",
  "--maxdepth",
  "--max-filesize",
  "--encoding",
  "--threads",
  "--color",
  "--colors",
  "--sort",
  "--sortr",
  "--ignore-file",
  "--include",
  "--exclude",
  "--exclude-dir",
  "--extension",
  "-d",
  "--search-path",
  "--base-directory",
]);
const FD_VALUE_OPTIONS = new Set([
  "-e",
  "--extension",
  "-t",
  "--type",
  "-E",
  "--exclude",
  "-d",
  "--max-depth",
  "--color",
  "-j",
  "--threads",
]);
const FLAG_OPTIONS = new Set([
  "--hidden",
  "--no-ignore",
  "--no-ignore-vcs",
  "--no-ignore-parent",
  "--no-ignore-global",
  "--files",
  "--files-with-matches",
  "--files-without-match",
  "--line-number",
  "--ignore-case",
  "--smart-case",
  "--fixed-strings",
  "--recursive",
  "--dereference-recursive",
  "--heading",
  "--no-heading",
  "--count",
  "--only-matching",
  "--follow",
  "--null",
]);

function searchRoots(bin: string, args: string[]): string[] | null {
  if (bin === "git") return null; // revisions/pathspec magic need the explicit fallback
  if (bin === "find") {
    if (
      args.some((arg) => ["-exec", "-execdir", "-ok", "-okdir"].includes(arg))
    )
      return null;
    const roots: string[] = [];
    for (const arg of args) {
      if (arg.startsWith("-") || arg === "(") break;
      roots.push(arg);
    }
    return roots;
  }
  const positional: string[] = [];
  let hasPattern = false;
  let filesOnly = false;
  let options = true;
  const fd = bin === "fd" || bin === "fdfind";
  const grep = GREP_BINARIES.has(bin);
  const valueOptions = fd ? FD_VALUE_OPTIONS : VALUE_OPTIONS;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? "";
    if (options && arg === "--") {
      options = false;
      continue;
    }
    if (options && arg.startsWith("-")) {
      if (bin === "ag" || bin === "ack") return null;
      const option = arg.split("=", 1)[0] ?? arg;
      if (option === "--search-path" || option === "--base-directory")
        return null;
      if (option === "--files" && bin === "rg") filesOnly = true;
      if (grep && /^-[EF]+$/.test(arg)) continue;
      if (fd && /^-[fFHILlis0]+$/.test(arg)) continue;
      if (valueOptions.has(option)) {
        if (["-e", "-f", "--regexp", "--file"].includes(option) && !fd)
          hasPattern = true;
        if (!arg.includes("=")) i++;
      } else if (
        FLAG_OPTIONS.has(option) ||
        (!fd && /^-[nivwoxlLcrRshuUqFa0]+$/.test(arg))
      ) {
        // Flags with no following value.
      } else if (!fd && /^-[efgABCmjtT].+/.test(arg)) {
        if (/^-[ef]/.test(arg)) hasPattern = true;
      } else {
        return null; // Unknown options may consume the apparent path.
      }
    } else {
      positional.push(arg);
    }
  }
  if (!hasPattern && !filesOnly) positional.shift();
  return positional;
}

/**
 * Redirections that only discard or merge output (`2>/dev/null`, `2>&1`,
 * `&>/dev/null`). They never name a search path, so they must not push an
 * otherwise resolvable search onto the unresolvable path.
 */
const DISCARD_REDIRECTION =
  /(^|\s)(?:[0-9]?>>?|&>>?)\s*(?:\/dev\/null|&[0-9])(?=\s|$|[;|&])/g;

function expandHome(path: string): string {
  if (path === "~") return homedir();
  return path.startsWith("~/") ? resolve(homedir(), path.slice(2)) : path;
}

function shellSearchRoots(
  command: string,
  sessionCwd: string,
): string[] | null {
  const cleaned = command
    .replace(DISCARD_REDIRECTION, "$1")
    // `$HOME` is the one expansion agents routinely use for external paths.
    .replace(/\$\{?HOME\}?(?=\/|\s|$)/g, homedir());
  // Do not guess expansions, other redirections or subshells.
  if (/[$`<>\\()]/.test(cleaned)) return null;
  const roots: string[] = [];
  // A literal `cd <dir>` moves the base later relative paths resolve from.
  let base = sessionCwd;
  for (const segment of commandSegments(cleaned)) {
    const tokens 
```

### Core Architecture Module: `.agents/hooks/core/code-intelligence-primer.ts`
```
#!/usr/bin/env bun
/**
 * oh-my-agent — Code Intelligence Primer Hook (prompt kind)
 *
 * Works with: Claude Code, Codex CLI, Cursor, Qwen Code,
 * Antigravity, Grok, Kiro.
 *
 * Injects a short, vendor-neutral reminder ONCE per session so the selected
 * code-intelligence provider (Serena or Gortex) tools are loaded and preferred.
 *
 * Gating:
 *   - Only fires when a code-intelligence provider is configured:
 *     - "gortex" via providers.code_intelligence in oma-config.yaml
 *     - "serena" via providers.code_intelligence or .serena/project.yml
 *   - Only fires once per session (state file under .agents/state/).
 *
 * Runs on the vendor's prompt event (UserPromptSubmit / BeforeAgent /
 * PreInvocation / beforeSubmitPrompt / userPromptSubmit), after skill-injector.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { agyConversationId, readAgyPrompt } from "./agy-input.ts";
import { makePromptOutput } from "./hook-output.ts";
import { normalizePromptInput } from "./prompt-input.ts";
import type {
  HandlerCtx,
  HandlerResult,
  HookConfig,
  HookInput,
} from "./types.ts";
import { detectVendorFromInput, getProjectDir } from "./vendor-detect.ts";

const SESSION_TTL_MS = 60 * 60 * 1000;

export type CodeIntelligenceProvider = "serena" | "gortex";

// ── Provider Detection ────────────────────────────────────────

/**
 * Read a scalar `providers.<key>` value from oma-config yaml content without a
 * yaml dependency (core handlers must stay standalone). Returns the lowercased
 * value with trailing comments stripped, or null when absent.
 */
export function readProvidersValueFromYaml(
  content: string,
  key: string,
): string | null {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((l) => /^providers:\s*(#.*)?$/.test(l));
  if (start === -1) return null;
  const keyRe = new RegExp(`^\\s+${key}:\\s*(\\S.*)$`);
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^\s*(#|$)/.test(line)) continue;
    if (!/^\s/.test(line)) break;
    const match = line.match(keyRe)?.[1];
    if (match) {
      return match
        .replace(/#.*$/, "")
        .trim()
        .replace(/^["']|["']$/g, "")
        .toLowerCase();
    }
  }
  return null;
}

function readCodeIntelligenceFromYaml(
  content: string,
): CodeIntelligenceProvider | null {
  const val = readProvidersValueFromYaml(content, "code_intelligence");
  if (val === "gortex" || val === "serena") return val;
  return null;
}

/**
 * `providers.<key>` from the config `oma hook run` loaded, normalized like
 * the YAML reader (lowercased; booleans as "true" / "false").
 */
function readProvidersValueFromConfig(
  config: HookConfig,
  key: string,
): string | null {
  const providers = config.providers;
  if (!providers || typeof providers !== "object" || Array.isArray(providers)) {
    return null;
  }
  const value = (providers as Record<string, unknown>)[key];
  if (typeof value === "boolean") return String(value);
  return typeof value === "string" ? value.trim().toLowerCase() : null;
}

/**
 * Resolves the selected code-intelligence provider.
 * Uses `config` (CUE / local overlay aware, from `oma hook run`) when given,
 * otherwise oma-config.local.yaml and oma-config.yaml; falls back to
 * detecting .serena/project.yml.
 */
export function detectCodeIntelligenceProvider(
  projectDir: string,
  config?: HookConfig,
): CodeIntelligenceProvider | null {
  if (config) {
    const val = readProvidersValueFromConfig(config, "code_intelligence");
    if (val === "gortex" || val === "serena") return val;
  } else {
    for (const rel of [
      join(".agents", "oma-config.local.yaml"),
      join(".agents", "oma-config.yaml"),
    ]) {
      const p = join(projectDir, rel);
      if (existsSync(p)) {
        try {
          const val = readCodeIntelligenceFromYaml(readFileSync(p, "utf-8"));
          if (val) return val;
        } catch {
          // fall open
        }
      }
    }
  }
  if (existsSync(join(projectDir, ".serena", "project.yml"))) {
    return "serena";
  }
  return null;
}

/**
 * Backward-compatible helper: true when Serena is the active provider.
 */
export function isSerenaProject(projectDir: string): boolean {
  return detectCodeIntelligenceProvider(projectDir) === "serena";
}

export type CodeIntelligenceGuardMode = "block" | "off";

/**
 * Resolves `providers.code_intelligence_guard` (oma-config.local.yaml wins
 * over oma-config.yaml). `block` (default) makes code-intelligence-guard deny
 * native search tool calls while a provider is configured; `off` disables the
 * guard and leaves the primer advisory-only.
 */
export function detectCodeIntelligenceGuardMode(
  projectDir: string,
  config?: HookConfig,
): CodeIntelligenceGuardMode {
  if (config) {
    const val = readProvidersValueFromConfig(config, "code_intelligence_guard");
    return val === "off" || val === "false" || val === "warn" ? "off" : "block";
  }
  for (const rel of [
    join(".agents", "oma-config.local.yaml"),
    join(".agents", "oma-config.yaml"),
  ]) {
    const p = join(projectDir, rel);
    if (!existsSync(p)) continue;
    try {
      const val = readProvidersValueFromYaml(
        readFileSync(p, "utf-8"),
        "code_intelligence_guard",
      );
      if (val === "off" || val === "false" || val === "warn") return "off";
      if (val === "block" || val === "true") return "block";
    } catch {
      // fall open to the default
    }
  }
  return "block";
}

// ── Session-once State ────────────────────────────────────────

interface PrimerState {
  sessions: Record<string, number>;
}

function getStatePath(projectDir: string): string {
  const newPath = join(
    projectDir,
    ".agents",
    "state",
    "code-intelligence-primer.json",
  );
  if (existsSync(newPath)) return newPath;
  const legacyPath = join(projectDir, ".agents", "state", "serena-primer.json");
  if (existsSync(legacyPath)) return legacyPath;
  return newPath;
}

function readState(projectDir: string): PrimerState {
  const p = getStatePath(projectDir);
  if (!existsSync(p)) return { sessions: {} };
  try {
    const parsed = JSON.parse(readFileSync(p, "utf-8"));
    if (parsed && typeof parsed === "object" && parsed.sessions) {
      return parsed as PrimerState;
    }
  } catch {
    // corrupted — reset
  }
  return { sessions: {} };
}

function writeState(projectDir: string, state: PrimerState): void {
  const p = getStatePath(projectDir);
  try {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(state, null, 2));
  } catch {
    // failing open is acceptable — worst case the primer injects again
  }
}

/**
 * Returns true and records the session when this is the first prompt of the
 * session (within TTL); returns false on subsequent prompts. Expired sessions
 * are pruned. Pure given `now` for testability.
 */
export function claimSession(
  projectDir: string,
  sessionId: string,
  now: number = Date.now(),
): boolean {
  const state = readState(projectDir);

  for (const [id, ts] of Object.entries(state.sessions)) {
    if (now - ts > SESSION_TTL_MS) delete state.sessions[id];
  }

  const last = state.sessions[sessionId];
  if (last !== undefined && now - last <= SESSION_TTL_MS) {
    return false;
  }

  state.sessions[sessionId] = now;
  writeState(projectDir, state);
  return true;
}

// ── Primer Content ────────────────────────────────────────────

/**
 * Vendor-neutral code intelligence priming context. Kept short — it is
 * injected once per session as advisory guidance, not a per-turn reminder.
 */
export function primerContext(
  provider: CodeIntelligenceProvider = "serena",
): string {
  if (provider === "gortex") {
    return [
      "[OMA GORTEX PRIMER]",
      "For code work, use Gortex MCP tools for code search, navigation, impact, contracts and edits.",
      "A PreToolUse hook guards native Grep, Glob and recursive shell search. Searches confined to confirmed provider exclusions or paths outside this project are allowed.",
      "Load deferred tools before use. Native search is only for paths outside this project or ignored paths. Do not use it to search project source. If Gortex is unavailable or times out, do not retry it this session.",
    ].join("\n");
  }
  return [
    "[OMA SERENA PRIMER]",
    "For code work, load deferred Serena tools if needed and read `initial_instructions` once unless already provided.",
    "Use `find_file` instead of Glob, `search_for_pattern` instead of Grep / recursive shell search, and `find_symbol` / `get_symbols_overview` for symbols. Native searches confined to confirmed provider exclusions or paths outside this project are allowed by the PreToolUse guard.",
    "Omit `max_answer_chars`; narrow the query if results exceed the limit.",
    "If Serena is unavailable or times out, do not retry the MCP call this session. Native search is only for paths outside this project or ignored paths. Do not use it to search project source.",
  ].join("\n");
}

// ── Pure handler (canonical ABI) ─────────────────────────────

/**
 * Pure decision function — injects the code intelligence primer on the first
 * prompt of an activated project's session, else returns null.
 * `ctx.cwd` must be the resolved OMA project root.
 */
export async function run(
  input: HookInput,
  ctx: HandlerCtx,
): Promise<HandlerResult | null> {
  if (input.kind !== "prompt") return null;

  const { cwd: projectDir, sid: sessionId = "unknown" } = ctx;

  const provider = detectCodeIntelligenceProvider(projectDir, ctx.config);
  if (!provider) return null;

  // Compaction keeps the session id, so the session-once claim would skip
  // exactly the turn that just lost the primer from context — force re-inject.
  const forced = input.source === "compact";
  if (!claimSession(projectDir, sessionId) && !forced) return null;

  return { type: "context", additionalContext: primerContex
```

### Core Architecture Module: `.agents/hooks/core/code-intelligence-scope.ts`
```
// Provider exclusions, not package directory names, define native-search scope.
// Keep this module dependency-free for standalone hook installations. Unknown
// configuration syntax never grants an exemption; the explicit fallback remains.
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import {
  dirname,
  isAbsolute,
  join,
  matchesGlob,
  relative,
  resolve,
  sep,
} from "node:path";
import type { CodeIntelligenceProvider } from "./code-intelligence-primer.ts";

function read(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** Read simple YAML string lists; aliases, tags and complex YAML stay unknown. */
function stringList(yaml: string, key: string): string[] | null {
  const lines = yaml.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (start < 0) return [];
  const inline = lines[start]
    ?.slice(key.length + 1)
    .replace(/\s+#.*$/, "")
    .trim();
  if (inline === "[]" || inline === "null") return [];
  let values: string[];
  if (inline) {
    // JSON lists are also YAML. Other flow styles use the explicit fallback.
    try {
      const parsed: unknown = JSON.parse(inline);
      return Array.isArray(parsed) && parsed.every((p) => typeof p === "string")
        ? parsed
        : null;
    } catch {
      return null;
    }
  } else {
    values = [];
    for (const line of lines.slice(start + 1)) {
      if (/^\s*(#|$)/.test(line)) continue;
      if (/^[^\s-]/.test(line)) break;
      const match = /^\s*-\s+(.+?)\s*$/.exec(line);
      if (!match) return null;
      values.push(match[1] ?? "");
    }
  }
  const result: string[] = [];
  for (const value of values) {
    const clean = value.replace(/\s+#.*$/, "").trim();
    if (clean.startsWith('"')) {
      try {
        const parsed: unknown = JSON.parse(clean);
        if (typeof parsed !== "string") return null;
        result.push(parsed);
      } catch {
        return null;
      }
    } else if (/^'[^']*'$/.test(clean)) {
      result.push(clean.slice(1, -1));
    } else if (/^[^!&*[{>|'"#][^\s]*$/.test(clean)) {
      result.push(clean);
    } else {
      return null;
    }
  }
  return result;
}

/** Literal directory prefix of a search glob; leading wildcards give no scope. */
export function searchPathRoot(path: string): string | null {
  path = path.split(sep).join("/");
  if (!path || /[$`\n\r\\{}()!]/.test(path)) return null;
  const parts = path.split("/");
  const wildcard = parts.findIndex((part) => /[*?[]/.test(part));
  if (wildcard < 0) return path;
  if (parts.slice(wildcard).includes("..")) return null;
  return parts.slice(0, wildcard).join("/") || null;
}

function excludedByPatterns(
  path: string,
  patterns: string[],
  directory = true,
): boolean {
  // A re-inclusion can make a subtree only partly excluded. Do not broaden the
  // exemption when proving full containment would require a directory walk.
  if (patterns.some((p) => p.startsWith("!"))) return false;
  const ancestors = path
    .split("/")
    .map((_, i, parts) => parts.slice(0, i + 1).join("/"));
  return patterns.some((raw) => {
    // Restrict to the shared gitignore/glob subset; extglobs and escapes differ.
    if (!raw || /[\\{}()[\]!#\s]/.test(raw)) return false;
    const rooted = raw.startsWith("/");
    const pattern = raw.replace(/^\//, "").replace(/\/(?:\*\*)?$/, "");
    if (!pattern) return false;
    const glob = rooted || pattern.includes("/") ? pattern : `**/${pattern}`;
    return ancestors.some(
      (ancestor, index) =>
        (!raw.endsWith("/") || index < ancestors.length - 1 || directory) &&
        matchesGlob(ancestor, glob),
    );
  });
}

function hasReincludedPaths(
  projectDir: string,
  paths: string[],
  names: string[],
): boolean {
  const root = resolve(projectDir);
  for (const path of paths) {
    const target = resolve(root, path);
    let current = target;
    while (current === root || current.startsWith(`${root}${sep}`)) {
      for (const name of names) {
        for (const line of read(join(current, name)).split(/\r?\n/)) {
          if (!line.startsWith("!")) continue;
          const pattern = line.slice(1).trim().replace(/^\//, "");
          const scope = relative(current, target).split(sep).join("/");
          const anchor = searchPathRoot(pattern);
          if (
            !scope ||
            !anchor ||
            !pattern.includes("/") ||
            anchor.startsWith(`${scope}/`) ||
            anchor === scope ||
            excludedByPatterns(scope, [pattern])
          )
            return true;
        }
      }
      if (current === root) break;
      current = dirname(current);
    }
  }
  return false;
}

function serenaExcluded(projectDir: string, paths: string[]): boolean {
  const config = read(join(projectDir, ".serena", "project.yml"));
  if (!config) return false;
  const global = read(
    join(
      process.env.SERENA_HOME || join(homedir(), ".serena"),
      "serena_config.yml",
    ),
  );
  const globalPatterns = stringList(global, "ignored_paths");
  const localPatterns = stringList(config, "ignored_paths");
  if (!globalPatterns || !localPatterns) return false;
  if (/^<<\s*:/m.test(config) || /^<<\s*:/m.test(global)) return false;
  const patterns = [...globalPatterns, ...localPatterns];
  if (patterns.some((p) => p.startsWith("!"))) return false;
  const gitignoreSetting = /^ignore_all_files_in_gitignore:[ \t]*([^#\r\n]*)/m
    .exec(config)?.[1]
    ?.trim()
    .toLowerCase();
  if (
    gitignoreSetting !== undefined &&
    gitignoreSetting !== "true" &&
    gitignoreSetting !== "false"
  )
    return false;
  const respectsGitignore = gitignoreSetting !== "false";
  if (
    respectsGitignore &&
    hasReincludedPaths(projectDir, paths, [".gitignore"])
  )
    return false;
  const remaining = paths.filter((path) => {
    const directory = isDirectory(resolve(projectDir, path));
    // Virtualenv tools often put `*` in the environment's own .gitignore
    // instead of adding the environment name to the parent repository.
    const ignoresContents =
      respectsGitignore &&
      directory &&
      read(join(projectDir, path, ".gitignore"))
        .split(/\r?\n/)
        .some((line) => ["*", "**", "/*", "/**"].includes(line.trim()));
    return !ignoresContents && !excludedByPatterns(path, patterns, directory);
  });
  if (remaining.length === 0) return true;
  if (!respectsGitignore) return false;
  try {
    const output = execFileSync(
      "git",
      ["check-ignore", "--no-index", "--verbose", "-z", "--stdin"],
      {
        cwd: projectDir,
        input: remaining.map((path) => `${path}\0`).join(""),
        encoding: "utf8",
        timeout: 500,
        stdio: ["pipe", "pipe", "ignore"],
      },
    );
    const fields = output.split("\0");
    const ignored = new Set<string>();
    for (let i = 0; i + 3 < fields.length; i += 4) {
      // Serena reads .gitignore files, not Git's global/info exclude files.
      const source = fields[i] ?? "";
      if (
        (source === ".gitignore" || source.endsWith("/.gitignore")) &&
        !fields[i + 2]?.startsWith("!")
      ) {
        ignored.add((fields[i + 3] ?? "").replace(/\/$/, ""));
      }
    }
    return remaining.every((path) => ignored.has(path));
  } catch {
    return false;
  }
}

function gortexExcluded(projectDir: string, paths: string[]): boolean {
  // Use the provider's own layered list rather than copying its builtins or
  // guessing where its global config lives. The CLI read is bounded and read-only.
  // Current list output omits `include`; conservatively reject that override.
  let dir = resolve(projectDir);
  while (true) {
    if (/^include\s*:/m.test(read(join(dir, ".gortex.yaml")))) return false;
    if (dirname(dir) === dir) break;
    dir = dirname(dir);
  }
  try {
    const output = execFileSync("gortex", ["config", "exclude", "list"], {
      cwd: projectDir,
      encoding: "utf8",
      timeout: 500,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const patterns: string[] = [];
    for (const line of output.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const match =
        /^\[(?:builtin|global|repo:[^\]]+|workspace(?: \(legacy (?:index|watch)\.exclude\))?)\s*\]\s+(.+?)\s*$/.exec(
          line,
        );
      if (!match?.[1]) return false;
      patterns.push(match[1]);
    }
    // Per-directory overrides can re-include descendants of an excluded root.
    // Without a provider path-level query those cases need the explicit fallback.
    if (
      hasReincludedPaths(projectDir, paths, [
        ".gortexignore",
        ".ignore",
        ".rgignore",
        ".gitignore",
      ])
    )
      return false;
    return paths.every((path) =>
      excludedByPatterns(
        path,
        patterns,
        isDirectory(resolve(projectDir, path)),
      ),
    );
  } catch {
    return false;
  }
}

export function isExcludedSearchScope(
  provider: CodeIntelligenceProvider,
  projectDir: string,
  roots: string[],
): boolean {
  if (roots.length === 0) return false;
  const paths: string[] = [];
  for (const root of roots) {
    const literal = searchPathRoot(root);
    if (!literal) return false;
    const path = relative(projectDir, resolve(projectDir, literal))
      .split(sep)
      .join("/");
    if (!path) return false;
    // Explicit external paths, such as uv's cache, are outside this project.
    if (path === ".." || path.startsWith(`../`) || isAbsolute(path)) continue;
    paths.push(path);
  }
  return (
    paths.length === 0 ||
    (provider === "serena"
      ? serenaExcluded(projectDir, paths)
      : gortexExcluded(projectDir, paths))
  );
}

```

### Core Architecture Module: `.agents/hooks/core/constants.ts`
```
// Runtime constants for hooks. Mirrors the convention in `cli/constants/`:
// constants here, types in `types.ts`. The `Vendor` type in `types.ts` is
// derived from `VENDORS` below so the value and the type stay in sync.

/**
 * Host LLM CLIs supported by Oma's hook layer. This is the single source of
 * truth for which vendors hooks (keyword-detector, persistent-mode, hud,
 * skill-injector) recognise. Adding a new vendor here propagates to the
 * `Vendor` type and to runtime guards such as `CLI_INVOCATION_AT_START`
 * in `keyword-detector.ts`.
 *
 * Excludes:
 *   - `oma` itself (the project's own CLI, listed separately where needed)
 *   - `copilot` and `hermes` (skill-install targets, not hook runtimes)
 *   - third-party harnesses (omc, omx, omo, ouroboros)
 *
 * MUST mirror `cli/constants/vendors.ts` VENDORS — WITH ONE INTENTIONAL
 * EXCEPTION: `pi`. Hooks run as standalone scripts in user environments and
 * cannot import from cli/, so the value is duplicated here. Keep the two
 * arrays in sync by adding or removing the same vendor in both files; CI does
 * not enforce this.
 *
 * `pi` (Earendil's pi-coding-agent) is hook-layer-only and is deliberately
 * absent from the cli runtime `VENDORS`. pi does not register settings-file
 * hooks like the other vendors; instead it auto-loads an in-process extension
 * (`.pi/extensions/oma/index.ts`) that bridges to these same core scripts via
 * subprocess. It therefore needs a `Vendor` identity for the output dialect
 * (`hook-output.ts`) and script-path detection, but must NOT flow through the
 * cli settings-file install path (`installHooksFromVariant`) — that install is
 * forked to `installPiExtension`. See `.agents/hooks/variants/pi/README.md`.
 */
export const VENDORS = [
  "antigravity",
  "claude",
  "codex",
  "commandcode",
  "cursor",
  "grok",
  "kimi",
  "kiro",
  "pi",
  "qwen",
] as const;

/**
 * Fallback session id used when no vendor session id can be resolved from the
 * hook stdin (`getSessionId`). It is shared across BOTH the keyword-detector and
 * persistent-mode hooks so the two stay in sync.
 *
 * A persistent-mode state file keyed to this value cannot be isolated per
 * session: any later session whose id ALSO resolves to the fallback would
 * inherit the stale workflow's persistent block (a cross-session false
 * positive). Both hooks therefore refuse to write — and refuse to act on —
 * persistent state under this id.
 */
export const UNKNOWN_SESSION_ID = "unknown";

```

### Core Architecture Module: `.agents/hooks/core/event-contract.ts`
```
/** Payload contracts shared by hook writers, CLI verification, and diagnostics. */
export function isEventRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonblankEventText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateEventPayload(kind: string, payload: unknown): string[] {
  const errors: string[] = [];
  const fields =
    kind === "decision.made"
      ? ["subject", "decision", "rationale"]
      : kind === "blocker.raised"
        ? ["summary"]
        : [];
  const record = isEventRecord(payload) ? payload : undefined;
  if (payload !== undefined && !record)
    errors.push("payload must be an object");
  for (const field of fields) {
    if (!isNonblankEventText(record?.[field])) {
      errors.push(`payload.${field} must be a nonblank string`);
    }
  }
  if (
    kind === "session.ended" &&
    record?.status !== "completed" &&
    record?.status !== "failed"
  ) {
    errors.push("payload.status must be completed or failed");
  }
  if (
    record?.instanceId !== undefined &&
    !isNonblankEventText(record.instanceId)
  ) {
    errors.push("payload.instanceId must be a nonblank string");
  }
  return errors;
}

export function validateEventEnvelope(value: unknown): string[] {
  if (!isEventRecord(value)) return ["event must be an object"];
  const errors: string[] = [];
  for (const field of ["eventId", "ts", "sid", "kind"]) {
    if (!isNonblankEventText(value[field])) {
      errors.push(`${field} must be a nonblank string`);
    }
  }
  if (isNonblankEventText(value.ts) && !Number.isFinite(Date.parse(value.ts))) {
    errors.push("ts must be a valid timestamp");
  }
  if (!Number.isInteger(value.writerPid))
    errors.push("writerPid must be an integer");
  if (typeof value.kind === "string") {
    errors.push(...validateEventPayload(value.kind, value.payload));
  }
  return errors;
}

```

### Core Architecture Module: `.agents/hooks/core/evolution-notice.ts`
```
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

/**
 * Session-start notice for the self-improvement loop. The lineage logs are
 * append-only; this reads what was promoted since the last session that
 * showed a notice, renders one line per change, and moves the marker. A
 * change is announced exactly once, and nothing is announced when nothing
 * moved.
 */

const MARKER = ".agents/state/evolution-notice.json";
const SKILL_ROOT = ".agents/results/skill-evolution";

interface SkillRecord {
  schemaVersion: number;
  ts: string;
  action: "apply" | "rollback";
  skillId: string;
  parentHash: string;
  candidateHash: string;
  evidence?: {
    baselineLift?: number;
    finalLift?: number;
    finalTest?: { passed?: boolean };
    edits?: Array<{ op: string; anchor: string; after?: string }>;
    gains?: { train?: [number, number] };
  };
}

interface ProcedureRecord {
  schemaVersion: number;
  ts: string;
  action: "apply" | "rollback";
  target: string;
  parentHash: string;
  candidateHash: string;
  evidence?: { meanDiff?: number; pairs?: number; skills?: string[] };
}

function readLines<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  const out: T[] = [];
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as T & { schemaVersion?: number };
      if (parsed.schemaVersion === 1) out.push(parsed);
    } catch {
      // damaged line: skipped, the log stays append-only evidence
    }
  }
  return out;
}

function readMarker(projectDir: string): string {
  try {
    const parsed = JSON.parse(
      readFileSync(join(projectDir, MARKER), "utf-8"),
    ) as { lastSeen?: unknown };
    return typeof parsed.lastSeen === "string" ? parsed.lastSeen : "";
  } catch {
    return "";
  }
}

function writeMarker(projectDir: string, lastSeen: string): void {
  const path = join(projectDir, MARKER);
  mkdirSync(join(projectDir, ".agents", "state"), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ lastSeen })}\n`, "utf-8");
}

function pct(value: number | undefined): string {
  return value === undefined ? "?" : `${Math.round(value * 100)}%`;
}

function describeSkill(record: SkillRecord): string {
  if (record.action === "rollback")
    return `${record.skillId} rolled back to ${record.parentHash.slice(0, 8)}`;
  const edit = record.evidence?.edits?.[0];
  const what = edit
    ? `${edit.op} "${edit.anchor.replace(/\s+/g, " ").slice(0, 48)}${edit.anchor.length > 48 ? "…" : ""}"${(record.evidence?.edits?.length ?? 0) > 1 ? ` +${(record.evidence?.edits?.length ?? 1) - 1}` : ""}`
    : `${record.parentHash.slice(0, 8)} → ${record.candidateHash.slice(0, 8)}`;
  const train = record.evidence?.gains?.train;
  const gains = [
    train ? `train ${pct(train[0])}→${pct(train[1])}` : "",
    `validation ${pct(record.evidence?.baselineLift)}→${pct(record.evidence?.finalLift)}`,
  ]
    .filter(Boolean)
    .join(", ");
  return `${record.skillId}: ${what} (${gains})`;
}

function describeProcedure(record: ProcedureRecord): string {
  const e = record.evidence;
  const stats = e
    ? ` (mean gain diff ${(e.meanDiff ?? 0) >= 0 ? "+" : ""}${(e.meanDiff ?? 0).toFixed(2)}, ${e.pairs ?? 0} pairs)`
    : "";
  return `${record.target} procedure ${record.parentHash.slice(0, 8)} → ${record.candidateHash.slice(0, 8)}${stats}`;
}

/**
 * Lines to show once for changes since the last notice; `[]` when nothing
 * changed. Moves the marker when `advance` is true (the default).
 */
export function evolutionNoticeLines(
  projectDir: string,
  options: { advance?: boolean; limit?: number } = {},
): string[] {
  const root = join(projectDir, SKILL_ROOT);
  if (!existsSync(root)) return [];
  const since = readMarker(projectDir);
  const skillRecords: SkillRecord[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
    skillRecords.push(
      ...readLines<SkillRecord>(join(root, entry.name, "promotions.jsonl")),
    );
  }
  const procedureRecords = readLines<ProcedureRecord>(
    join(root, "_procedure", "promotions.jsonl"),
  );
  const fresh = [
    ...skillRecords
      .filter((r) => r.ts > since)
      .map((r) => ({ ts: r.ts, line: describeSkill(r) })),
    ...procedureRecords
      .filter((r) => r.ts > since)
      .map((r) => ({ ts: r.ts, line: describeProcedure(r) })),
  ].sort((a, b) => a.ts.localeCompare(b.ts));
  if (fresh.length === 0) return [];
  const latest = fresh[fresh.length - 1]?.ts ?? since;
  if (options.advance !== false) writeMarker(projectDir, latest);
  const limit = options.limit ?? 5;
  const shown = fresh
    .slice(-limit)
    .map((f) => `- ${f.ts.slice(0, 16)} ${f.line}`);
  if (fresh.length > limit) shown.unshift(`- …${fresh.length - limit} earlier`);
  return shown;
}

```

### Core Architecture Module: `.agents/hooks/core/fs-utils.ts`
```
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";

/**
 * Normalize a filesystem path to POSIX (forward-slash) form so output
 * shown to the model and string comparisons stay platform-independent
 * on Windows. Mirrors `cli/utils/fs-utils.ts#toPosixPath`.
 */
export function toPosixPath(p: string): string {
  return sep === "/" ? p : p.split(sep).join("/");
}

const MAX_DEPTH = 20;

/**
 * Walk up from startDir to find the git repository root.
 * This prevents CLAUDE_PROJECT_DIR pointing to a subdirectory
 * (e.g. packages/i18n during a build) from creating state files
 * in the wrong location.
 */
export function resolveGitRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < MAX_DEPTH; i++) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
  return startDir;
}

/**
 * Files under `<dir>/.agents/` that mark an OMA install. A bare `.agents/`
 * holding only runtime output (a stray `state/` or `backup/` tree written from
 * a sub-directory) is not an install and never becomes the project root.
 */
export const OMA_INSTALL_MARKERS = [
  "oma-config.yaml",
  "oma-config.cue",
  "oma-config.local.yaml",
  "oma-config.local.cue",
  join("skills", "_version.json"),
] as const;

export function hasOmaInstall(dir: string): boolean {
  const agentsDir = join(dir, ".agents");
  return OMA_INSTALL_MARKERS.some((marker) =>
    existsSync(join(agentsDir, marker)),
  );
}

function homeDirectory(): string | null {
  try {
    return resolve(homedir());
  } catch {
    return null;
  }
}

/**
 * Resolve the OMA project root. Shared by the hooks (standalone and
 * `oma hook run`) and the CLI so state and config always land in the same
 * place for a given working directory.
 *
 * Walks up from `startDir` and returns the nearest directory whose `.agents/`
 * holds an install marker, without crossing the enclosing git root; otherwise
 * that git root; otherwise `startDir`. A sub-package with its own install
 * (`apps/api/.agents/oma-config.yaml`) is its own root, while a nested
 * directory without one resolves to the repository. Outside a repository the
 * walk stops at the home directory, whose `.agents/` is the global install
 * rather than a project.
 */
export function resolveProjectRoot(startDir: string): string {
  const start = resolve(startDir);
  const home = homeDirectory();
  let dir = start;
  for (let i = 0; i < MAX_DEPTH; i++) {
    const isGitRoot = existsSync(join(dir, ".git"));
    if (dir === home && !isGitRoot) break;
    if (isGitRoot || hasOmaInstall(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

```

### Core Architecture Module: `.agents/hooks/core/hook-output.ts`
```
// Vendor-specific hook output builders.
// Each runtime (Claude Code, Codex CLI, Cursor, Qwen Code)
// expects a slightly different stdout JSON shape; centralize the dialect
// translation here so individual hooks can stay vendor-agnostic.

import type { Vendor } from "./types.ts";

export function makePromptOutput(
  vendor: Vendor,
  additionalContext: string,
  // Native hook event the context is injected for. Defaults to the prompt-submit
  // event; the dispatch layer passes "SessionStart" for session-start injection
  // (commandcode / cursor sessionStart) so the emitted hookSpecificOutput names
  // the correct event. Standalone core-script callers use the default.
  hookEventName: string = "UserPromptSubmit",
): string {
  switch (vendor) {
    case "antigravity":
      // agy (Antigravity) does NOT read `additionalContext`. Per the official
      // contract (antigravity.google/docs/hooks), a PreInvocation hook injects
      // context by returning `injectSteps`, where `ephemeralMessage` is a
      // transient system-message step prepended before the model is called.
      return JSON.stringify({
        injectSteps: [{ ephemeralMessage: additionalContext }],
      });
    case "claude":
    case "commandcode": {
      // Official Claude Code docs (code.claude.com/docs/en/hooks) specify
      // `hookSpecificOutput.additionalContext` — the top-level field is kept
      // for back-compat with older builds that read it.
      // commandcode (Command Code, commandcode.ai) mirrors the Claude hook
      // dialect. It has no prompt-submit event, but DOES inject context on
      // SessionStart (additionalContext) — dispatch passes hookEventName
      // "SessionStart" for that path.
      const hookSpecificOutput: Record<string, unknown> = {
        hookEventName,
        additionalContext,
      };
      // Claude Code re-scans skill/command directories after SessionStart hooks
      // complete when the output sets `reloadSkills` (docs: SessionStart
      // hookSpecificOutput.reloadSkills). It is Claude-only and only meaningful
      // for SessionStart; this builder is called solely when context was
      // actually injected, so the "only when injecting" condition is inherent.
      if (vendor === "claude" && hookEventName === "SessionStart") {
        hookSpecificOutput.reloadSkills = true;
      }
      return JSON.stringify({ additionalContext, hookSpecificOutput });
    }
    case "codex":
      return JSON.stringify({
        hookSpecificOutput: {
          hookEventName,
          additionalContext,
        },
      });
    case "cursor":
      // Cursor reads the top-level `additional_context` (sessionStart) /
      // `additionalContext`; the hookSpecificOutput block is informational.
      return JSON.stringify({
        additionalContext,
        additional_context: additionalContext,
        hookSpecificOutput: {
          hookEventName,
          additionalContext,
        },
      });
    case "grok":
      // Grok hook context injection: return additionalContext; Grok may surface
      // it via hook annotations or ignore for prompt events. State side-effects
      // (mode activation, L1 events) are the primary mechanism.
      return JSON.stringify({ additionalContext });
    case "kiro":
      // Kiro CLI adds stdout directly to the agent context for prompt hooks.
      return additionalContext;
    case "kimi":
      // Kimi Code CLI: a blockable hook that exits 0 has its stdout appended to
      // the model context (kimi.com/code/docs hooks). Plain text injects directly.
      return additionalContext;
    case "pi":
      // pi (Earendil) reads this via the in-process bridge in
      // `.pi/extensions/oma/index.ts`, which lifts `additionalContext` into the
      // `before_agent_start` return as `{ systemPrompt: <prev> + context }`.
      return JSON.stringify({ additionalContext });
    case "qwen":
      // Qwen Code fork uses hookSpecificOutput (same as Codex)
      return JSON.stringify({
        hookSpecificOutput: {
          hookEventName,
          additionalContext,
        },
      });
  }
}

export function makeBlockOutput(vendor: Vendor, reason: string): string {
  switch (vendor) {
    case "claude":
    case "codex":
    case "commandcode":
    case "kiro":
    case "qwen":
      return JSON.stringify({ decision: "block", reason });
    case "cursor":
      // Cursor's `stop` hook ignores Claude-style `{decision:"block"}`. It
      // re-enters the loop via `{followup_message}`, which is auto-submitted as
      // the next turn (capped by the entry's loop_limit). Cursor's only
      // block-producing chain is `stop` — its sole preToolUse handler
      // (test-filter) never blocks, only mutates — so followup_message is
      // always the correct dialect here.
      return JSON.stringify({ followup_message: reason });
    case "antigravity":
      // agy Stop: `decision:"continue"` re-enters the loop (= block the stop);
      // `reason` is injected as a system message. (Any other value allows stop.)
      return JSON.stringify({ decision: "continue", reason });
    case "pi":
      // pi's bridge implements persistent-mode via agent_settled +
      // pi.sendUserMessage: it runs the persistent-mode subprocess (which
      // resolves to the Claude dialect `{decision:"block", reason}`) and also
      // accepts this `{block:true, reason}` shape, re-submitting `reason` as the
      // next turn so the workflow continues.
      return JSON.stringify({ block: true, reason });
    case "grok":
      // Grok Stop hooks are generally advisory. Emit block decision + rich
      // stderr message (persistent-mode already prints the reason to stderr).
      return JSON.stringify({ decision: "block", reason });
    case "kimi":
      // Kimi documents two blocking mechanisms: exit 2 + stderr, and a JSON
      // `hookSpecificOutput.permissionDecision: "deny"` response. The oma hook
      // router always exits 0 and writes the dialect to stdout, so we emit the
      // JSON form. We also include the Claude-style `{decision:"block"}` keys so
      // whichever shape Kimi's Stop handler honours, persistent-mode re-enters.
      return JSON.stringify({
        decision: "block",
        reason,
        hookSpecificOutput: {
          permissionDecision: "deny",
          permissionDecisionReason: reason,
        },
      });
  }
}

/**
 * Post-tool BLOCK dialect — used when a PostToolUse handler wants the tool
 * result fed back to the model with a mandatory instruction (refactor-guard).
 * The tool has already run, so this is feedback, not prevention.
 *
 * Claude Code's current spec (code.claude.com/docs/en/hooks, verified 2026-08)
 * feeds `additionalContext` directly to the model and no longer documents
 * `{decision:"block"}` for PostToolUse; older builds read the decision keys.
 * Codex / Qwen / Command Code document BOTH `decision:"block"` + `reason` and
 * `hookSpecificOutput.additionalContext` on PostToolUse, so emitting the
 * combined shape covers every wired dialect. Vendors without a usable
 * post-tool feedback channel (grok: passive stdout-ignored; kiro: output not
 * processed; antigravity: audit-only `{}`) fall through to the closest
 * best-effort shape — they are not wired for post_tool events.
 */
export function makePostToolBlockOutput(
  vendor: Vendor,
  reason: string,
): string {
  switch (vendor) {
    case "claude":
    case "codex":
    case "commandcode":
    case "qwen":
      return JSON.stringify({
        decision: "block",
        reason,
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: reason,
        },
      });
    case "cursor":
      // Cursor's postToolUse feedback channel is `additional_context` only
      // (no block). Include the snake_case field its dialect documents.
      return JSON.stringify({
        additional_context: reason,
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: reason,
        },
      });
    case "kimi":
    case "kiro":
    case "grok":
    case "antigravity":
    case "pi":
      // Best-effort — no documented post-tool feedback channel (or disputed).
      return makeBlockOutput(vendor, reason);
  }
}

/**
 * Pre-tool DENY dialect — used when a PreToolUse handler blocks a tool call
 * (scm-guard). Distinct from makeBlockOutput, whose dialects are Stop-shaped
 * (e.g. cursor's followup_message re-submits a turn instead of denying).
 * scm-guard is wired for claude/codex/qwen/kimi/kiro/grok/cursor (plus the
 * opencode/pi bridges, which read the claude dialect from the standalone
 * entry); the remaining cases are best-effort so the switch stays exhaustive.
 */
export function makePreToolDenyOutput(vendor: Vendor, reason: string): string {
  switch (vendor) {
    case "claude":
    case "codex":
    case "commandcode":
    case "qwen":
      // Claude-documented PreToolUse deny shape (Codex/Qwen follow the dialect).
      return JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: reason,
        },
      });
    case "kimi":
      // Kimi honours both the Claude-style decision keys and the
      // hookSpecificOutput deny form (same rationale as makeBlockOutput).
      return JSON.stringify({
        decision: "block",
        reason,
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: reason,
        },
      });
    case "kiro":
      return JSON.stringify({ decision: "block", reason });
    case "grok":
      // Grok PreToolUse output is a gate decision (see makePreToolOutput).
      return JSON.stringify({ decision: "deny", reason });
    case "antigravity":
      // agy PreToolUse output is a gate decision; deny analog of the allow gate.
      return JSON.stringify({ decision: "deny", reason });
    case "cur
```

### Core Architecture Module: `.agents/hooks/core/hud.ts`
```
#!/usr/bin/env bun
/**
 * oh-my-agent — HUD
 *
 * Lightweight status display for Claude Code / agy (statusLine): stdin =
 * vendor payload, stdout = ANSI text consumed by the native status-line
 * renderer. Field names line up across both vendors; vendor-specific extras
 * are best-effort.
 *
 * Set `OMA_HUD_DEBUG=1` to dump the raw stdin payload to
 * `<hookDir>/../last-hud-input.json` for schema reverse-engineering.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ModeState } from "./types.ts";

// ── ANSI Colors ───────────────────────────────────────────────

const dim = (s: string) => `\x1b[2m${s}\x1b[22m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;
const green = (s: string) => `\x1b[32m${s}\x1b[39m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[39m`;
const red = (s: string) => `\x1b[31m${s}\x1b[39m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[39m`;

function colorByThreshold(value: number, text: string): string {
  if (value >= 85) return red(text);
  if (value >= 70) return yellow(text);
  return green(text);
}

// ── Stdin ─────────────────────────────────────────────────────

interface RateLimit {
  used_percentage?: number;
  resets_at?: string;
}

interface StatuslineStdin {
  cwd?: string;
  /** Claude / Qwen: the session the statusline is drawn for. */
  session_id?: string;
  model?: { id?: string; display_name?: string };
  context_window?: {
    context_window_size?: number;
    used_percentage?: number;
    // agy 1.0.0 StatusLine adds these — Claude does not.
    total_input_tokens?: number;
    total_output_tokens?: number;
  };
  cost?: {
    total_cost_usd?: number;
    total_lines_added?: number;
    total_lines_removed?: number;
    total_duration_ms?: number;
  };
  rate_limits?: {
    five_hour?: RateLimit;
    seven_day?: RateLimit;
  };
  // Qwen Code statusLine fields (git branch + line metrics live under
  // different keys than Claude/agy). Schema: qwen-code statusLine docs.
  git?: { branch?: string };
  metrics?: {
    files?: { total_lines_added?: number; total_lines_removed?: number };
  };
  // agy StatusLine fields (snake_case; Antigravity hides $cost / rate-limits).
  // Schema: antigravity.google StatusLine "Available JSON fields".
  agent_state?: string;
  sandbox?: { enabled?: boolean; allow_network?: boolean };
  product?: string;
  conversation_id?: string;
  workspace?: { current_dir?: string; project_dir?: string };
  vcs?: { type?: string; branch?: string; client?: string; dirty?: boolean };
  agent?: { name?: string };
  subagents?: Array<{ name?: string; role?: string; status?: string }>;
  background_tasks?: Array<{ name?: string; status?: string; index?: number }>;
  pending_input_count?: number;
  tool_confirmation_pending?: boolean;
  terminal_width?: number;
}

async function readStdin(
  timeoutMs = STDIN_TIMEOUT_MS,
): Promise<StatuslineStdin> {
  // Some vendors (notably agy) spawn the statusline without closing the stdin
  // pipe; a synchronous readFileSync(0) then blocks until the vendor's
  // statusline timeout SIGKILLs the process. Read asynchronously and give up
  // after timeoutMs, letting main() fall back to a payload-less line.
  const read = (async () => {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    const raw = Buffer.concat(chunks).toString("utf-8");
    maybeDumpDebugPayload(raw);
    try {
      return JSON.parse(raw) as StatuslineStdin;
    } catch {
      return {};
    }
  })();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("stdin timeout")), timeoutMs);
  });

  try {
    return await Promise.race([read, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Max time to wait for the vendor to deliver (and close) the stdin payload. */
const STDIN_TIMEOUT_MS = 800;

/**
 * When `OMA_HUD_DEBUG=1`, capture the raw stdin payload to a sibling file so
 * vendor-specific schemas can be reverse-engineered (notably agy's StatusLine,
 * which has no public docs at v1.0.0). Best-effort — failures are swallowed.
 */
function maybeDumpDebugPayload(raw: string): void {
  if (process.env.OMA_HUD_DEBUG !== "1" || !raw) return;
  try {
    const target = join(
      import.meta.dirname ?? process.cwd(),
      "..",
      "last-hud-input.json",
    );
    writeFileSync(target, `${raw.trim()}\n`, "utf-8");
  } catch {
    // intentionally silent
  }
}

// ── Active Workflow Detection ─────────────────────────────────

const STALE_WORKFLOW_MS = 2 * 60 * 60 * 1000;

/**
 * The persistent workflow to show. With a session id (Claude/Qwen
 * `session_id`, agy `conversation_id`) only that session's state file counts,
 * so a concurrent session's workflow never appears here. Each file is judged
 * on its own: one corrupt or half-written file cannot hide the others.
 */
export function getActiveWorkflow(
  projectDir: string,
  sessionId?: string,
): ModeState | null {
  const stateDir = join(projectDir, ".agents", "state");
  if (!existsSync(stateDir)) return null;

  let files: string[];
  try {
    files = readdirSync(stateDir);
  } catch {
    return null;
  }
  const sessionSuffix = sessionId ? `-state-${sessionId}.json` : null;
  for (const file of files) {
    if (!file.endsWith(".json") || !file.includes("-state-")) continue;
    if (sessionSuffix && !file.endsWith(sessionSuffix)) continue;
    let state: ModeState;
    try {
      state = JSON.parse(readFileSync(join(stateDir, file), "utf-8"));
    } catch {
      continue;
    }
    if (!state || typeof state.workflow !== "string") continue;
    const activatedMs = new Date(state.activatedAt).getTime();
    if (!Number.isFinite(activatedMs)) continue;
    if (Date.now() - activatedMs > STALE_WORKFLOW_MS) continue;
    return state;
  }
  return null;
}

function statuslineSessionId(input: StatuslineStdin): string | undefined {
  const id = input.session_id ?? input.conversation_id;
  return typeof id === "string" && id.trim() ? id : undefined;
}

// ── Model Name Shortener ──────────────────────────────────────

export function shortModel(model?: {
  id?: string;
  display_name?: string;
}): string {
  const name = model?.display_name || model?.id || "";
  if (!name) return "";
  // Claude: "Claude Opus 4.6 (1M context)" → "Opus 4.6"
  const claude = name.match(/(Opus|Sonnet|Haiku)[\s.]*([\d.]*)/i);
  if (claude) return `${claude[1]}${claude[2] ? ` ${claude[2]}` : ""}`;
  // Gemini / agy: "Gemini 3.6 Flash (High)" → "Gemini 3.6 Flash"
  const gemini = name.match(
    /(Gemini)\s+([\d.]+)\s+(Pro|Flash|Ultra|Nano|Thinking)/i,
  );
  if (gemini) return `${gemini[1]} ${gemini[2]} ${gemini[3]}`;
  // Gemini / agy slug: "antigravity/gemini-3.6-flash" → "Gemini 3.6 Flash"
  const geminiSlug = name.match(
    /gemini-([\d.]+)-(pro|flash|ultra|nano|thinking)/i,
  );
  if (geminiSlug) {
    const type = geminiSlug[2] ?? "";
    const capType = type.charAt(0).toUpperCase() + type.slice(1);
    return `Gemini ${geminiSlug[1]} ${capType}`;
  }
  return name.split("/").pop()?.slice(0, 20) || "";
}

// ── Rate Limit Helpers ───────────────────────────────────────

function formatCountdown(resetsAt: string): string {
  const remaining = new Date(resetsAt).getTime() - Date.now();
  if (remaining <= 0) return "";
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  return h > 0 ? `${h}h${m}m` : `${m}m`;
}

function formatRateLimit(label: string, rl?: RateLimit): string | null {
  if (!rl || rl.used_percentage == null) return null;
  const pct = Math.round(rl.used_percentage);
  const countdown = rl.resets_at ? formatCountdown(rl.resets_at) : "";
  const text = countdown
    ? `${label}:${pct}%(${countdown})`
    : `${label}:${pct}%`;
  return colorByThreshold(pct, text);
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

// ── Claude / agy statusline ───────────────────────────────────

export function buildClaudeStatusline(input: StatuslineStdin): string {
  const projectDir =
    process.env.CLAUDE_PROJECT_DIR ||
    input.cwd ||
    input.workspace?.current_dir ||
    process.cwd();
  const parts: string[] = [];

  // 1. OMA label
  parts.push(bold(cyan("[OMA]")));

  // 2. Model
  const model = shortModel(input.model);
  if (model) parts.push(dim(model));

  // 3. Context %
  const ctxPct = input.context_window?.used_percentage;
  if (ctxPct != null) {
    parts.push(colorByThreshold(ctxPct, `ctx:${Math.round(ctxPct)}%`));
  }

  // 4. Session cost (Claude)
  const cost = input.cost?.total_cost_usd;
  if (cost != null && cost > 0) {
    parts.push(dim(`$${cost.toFixed(2)}`));
  }

  // 5. Rate limits (Claude)
  const rl5 = formatRateLimit("5h", input.rate_limits?.five_hour);
  const rl7 = formatRateLimit("7d", input.rate_limits?.seven_day);
  if (rl5 || rl7) {
    parts.push([rl5, rl7].filter(Boolean).join(dim(" ")));
  }

  // 6. Lines changed (vendor-provided only; agy doesn't track this and we
  //    intentionally don't synthesize from git — keep what the vendor knows).
  const added =
    input.cost?.total_lines_added ?? input.metrics?.files?.total_lines_added;
  const removed =
    input.cost?.total_lines_removed ??
    input.metrics?.files?.total_lines_removed;
  if (added || removed) {
    const diffParts: string[] = [];
    if (added) diffParts.push(green(`+${added}`));
    if (removed) diffParts.push(red(`-${removed}`));
    parts.push(diffParts.join(dim("/")));
  }

  // 7. agy StatusLine signals (presence-guarded; Claude payloads omit these).
  //    git branch (+dirty marker), live agent state, active subagents,
  //    background tasks, queued inputs, and a pending tool-confirmation flag.
  const branch = input.vcs?.
```

### Core Architecture Module: `.agents/hooks/core/inject-log.ts`
```
#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureSessionStorage } from "./session-storage.ts";
import { withSessionWriteLock } from "./state-index-lock.ts";
import { sessionDir } from "./state-marker.ts";
import type { MemoryFact } from "./vendor-renderer.ts";

/**
 * Per-boundary inject audit log (D52) with privacy guards (D57).
 *
 * Every boundary inject writes
 * `~/.oma/u/<profile>/sessions/{sid}/inject-log/{ISO-ts}.md` (or an existing
 * legacy project session directory) containing the rendered
 * markdown, the recall query, and the facts returned — a forensic trail for
 * debugging "resume context looks wrong" issues.
 *
 * Privacy (D57): logs are local-debug artifacts. They are created with
 * user-only permissions where supported, secret patterns are redacted before
 * write, and they live under `.agents/state/` (gitignored) and are never copied
 * into Serena mirrors (the mirror reads `events.jsonl` only).
 */

// Default secret shapes. Extend at runtime via OMA_REDACT_PATTERNS (comma-
// separated regex sources). Hooks cannot import cli/, so this list is
// self-contained.
const DEFAULT_SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9]{16,}/g, // OpenAI-style keys
  /xox[baprs]-[A-Za-z0-9-]{10,}/g, // Slack tokens
  /gh[pousr]_[A-Za-z0-9]{20,}/g, // GitHub tokens
  /AKIA[0-9A-Z]{16}/g, // AWS access key id
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT
  /\bBearer\s+[A-Za-z0-9._-]{12,}/gi, // bearer tokens
  /(api[_-]?key|secret|token|password|passwd|access[_-]?key)(["']?\s*[:=]\s*["']?)[A-Za-z0-9._\-/+]{8,}/gi,
];

const REDACTION = "[REDACTED]";

function extraPatternsFromEnv(): RegExp[] {
  const raw = process.env.OMA_REDACT_PATTERNS;
  if (!raw) return [];
  const patterns: RegExp[] = [];
  for (const source of raw.split(",")) {
    const trimmed = source.trim();
    if (!trimmed) continue;
    try {
      patterns.push(new RegExp(trimmed, "g"));
    } catch {
      // Ignore invalid user-supplied patterns rather than crashing the hook.
    }
  }
  return patterns;
}

export function redactSecrets(text: string, extra: RegExp[] = []): string {
  let out = text;
  for (const pattern of [
    ...DEFAULT_SECRET_PATTERNS,
    ...extraPatternsFromEnv(),
    ...extra,
  ]) {
    // String.replace passes (match, ...groups, offset, fullString). Keyed
    // patterns capture (key, separator) as strings so the log still shows WHICH
    // secret was redacted; ungrouped patterns get a number offset in arg 1, so
    // type-check before treating args as capture groups.
    out = out.replace(pattern, (...args: unknown[]) => {
      const key = args[1];
      const sep = args[2];
      if (typeof key === "string" && typeof sep === "string") {
        return `${key}${sep}${REDACTION}`;
      }
      return REDACTION;
    });
  }
  return out;
}

export interface InjectLogEntry {
  boundaryAt: string;
  fromVendor: string | null;
  fromVendorSid: string | null;
  toVendor: string;
  toVendorSid: string;
  recallQuery: string | null;
  facts: MemoryFact[];
  rendered: string;
}

export function injectLogDir(projectDir: string, sid: string): string {
  return join(sessionDir(projectDir, sid), "inject-log");
}

/** Filesystem-safe filename from an ISO timestamp (`:`/`.` are unsafe on win32). */
export function injectLogFilename(boundaryAt: string): string {
  return `${boundaryAt.replace(/[:.]/g, "-")}.md`;
}

function renderInjectLog(entry: InjectLogEntry): string {
  const facts =
    entry.facts.length === 0
      ? "- (none)"
      : entry.facts
          .map((fact) => {
            const source = fact.source ? ` (${fact.source})` : "";
            const score =
              typeof fact.score === "number" ? ` [${fact.score}]` : "";
            return `- ${redactSecrets(fact.text)}${source}${score}`;
          })
          .join("\n");

  return [
    `# OMA Inject Log ${entry.boundaryAt}`,
    "",
    `- from: ${entry.fromVendor ?? "(new)"} / ${entry.fromVendorSid ?? "(none)"}`,
    `- to: ${entry.toVendor} / ${entry.toVendorSid}`,
    `- recall query: ${entry.recallQuery ? redactSecrets(entry.recallQuery) : "(none)"}`,
    `- facts: ${entry.facts.length}`,
    "",
    "## Facts",
    facts,
    "",
    "## Rendered",
    "```",
    redactSecrets(entry.rendered),
    "```",
    "",
  ].join("\n");
}

/**
 * Write a boundary inject log. Best-effort: a failure here is debug-only and
 * must never break the hook, so errors are swallowed and `null` is returned.
 */
export function writeInjectLog(
  projectDir: string,
  sid: string,
  entry: InjectLogEntry,
): string | null {
  try {
    return withSessionWriteLock(projectDir, sid, () => {
      ensureSessionStorage(projectDir, sid);
      const dir = injectLogDir(projectDir, sid);
      mkdirSync(dir, { recursive: true, mode: 0o700 });
      const path = join(dir, injectLogFilename(entry.boundaryAt));
      writeFileSync(path, renderInjectLog(entry), {
        encoding: "utf-8",
        mode: 0o600,
      });
      return path;
    });
  } catch {
    return null;
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #815** (2026-09-27): **[Bug] Orchestrate can bypass retry limits through recursive plan-metadata revisions**
  *Symptoms*: ## Summary  The `orchestrate` workflow can enter an unbounded plan-metadata/review loop when a task reaches a product-successful state but its completion evidence (for example, a claim, artifact list, or digest binding) is invalid. By creating a new planning task and task ID for each metadata correction, the workflow-level retry limits can be bypassed.  ## Steps to reproduce  1. Run `orchestrate` with a multi-task executable plan and structured completion evidence. 2. Let the implementation and product verification checks pass, but make the final claim/evidence binding fail. 3. Treat the evidence failure as a request for a new plan revision, create a new PM task ID, and repeat the plan/review/repair sequence. 4. Observe that each new plan revision is accepted as a new execution unit instead of consuming the retry budget for the original logical goal.  ## Expected behavior  - Retry and termination limits are bound to the logical workflow goal and plan lineage, not only to an agent or task ID. - The plan is immutable after the first task dispatch; a contract change starts a clearly separated new run. - Evidence-only failures are classified separately from product failures and do not trigger another product-plan revision. - Recursive planning/review tasks are rejected or stopped after a bounded repair attempt.  ## Actual behavior  In a real OpenCode/OMA run on 2026-09-24–26, a documentation-only change reached a product-successful state, but completion metadata failed with error
  **Post-Mortem & Fix Analysis**:
  > Thank you for the detailed report and reproduction steps. This is now fixed in #816, which has been merged into main with regression tests covering retry limits, plan immutability, and evidence-only recovery. 
  > Thanks!

- **Issue #788** (2026-09-18): **oma link run from $HOME overwrites global settings with $CLAUDE_PROJECT_DIR hook paths, breaking all hooks and the statusline**
  *Symptoms*: ## Summary  Running `oma link <vendor>` with the working directory set to `$HOME` writes **project-scoped** settings into `~/.claude/settings.json` — the global Claude Code settings file — replacing absolute hook paths with `$CLAUDE_PROJECT_DIR`-relative ones. Every hook and the statusline then break in any project that does not have its own `.claude/hooks/` directory.  Version: `oh-my-agent 14.12.2` (global install, `~/.agents/`).  ## What happens  `oma link claude --dry-run` reports it will write:  ``` ~ <root>/.claude/settings.json  claude settings (telemetry) ```  When cwd is a normal project, `<root>/.claude/settings.json` is that project's settings and `$CLAUDE_PROJECT_DIR` resolves correctly. But when cwd is `$HOME`, `<root>` *is* `$HOME`, so `<root>/.claude/settings.json` is the user's **global** settings file. Project-scoped content lands on the global install.  Concretely, these five hook commands were rewritten in `~/.claude/settings.json`:  ```diff - "command": "\"$HOME/.claude/hooks/oma-hook.sh\" --vendor 'claude' --event 'UserPromptSubmit'" + "command": "\"$CLAUDE_PROJECT_DIR/.claude/hooks/oma-hook.sh\" --vendor 'claude' --event 'UserPromptSubmit'" ```  (PreToolUse, PostToolUse, SessionStart, UserPromptSubmit, Stop.)  The `claude-hud` statusline entry was rewritten the same way:  ```diff - "command": "'bun' \"$HOME/.claude/hooks/hud.ts\"" + "command": "'bun' \"$CLAUDE_PROJECT_DIR/.claude/hooks/hud.ts\"" ```  The link step also (correctly) placed `oma-hook.sh` an
  **Post-Mortem & Fix Analysis**:
  > Thanks for the sharp report, the repro and the diff made this a quick fix. `oma link` / `oma update` now refuse to run from $HOME without `--global` (8e9465b4), so the global settings can no longer be clobbered with project-relative hook paths; it ships in the next release.

- **Issue #699** (2026-08-16): **[Bug] doctor --profile checks opencode-go for every OpenCode provider**
  *Symptoms*: ## Summary  `oma doctor --profile` reports `not logged in` for every OpenCode-backed role when the configured models use authenticated providers such as `openai`, `zai-coding-plan`, or `kimi-for-coding`, but no `opencode-go` credential exists.  The profile correctly resolves each custom model to the `opencode` CLI, but the authentication check always uses OpenCode's default `opencode-go` provider instead of the provider from the registered model's `cli_model`.  ## Steps to reproduce  1. Authenticate an OpenCode provider other than `opencode-go`, for example `zai-coding-plan`. 2. Register and select that model in `.agents/oma-config.yaml`:     ```yaml    models:      opencode-zai-coding-plan/glm-5.3:        cli: opencode        cli_model: zai-coding-plan/glm-5.3     custom_presets:      opencode-local:        agent_defaults:          pm: { model: opencode-zai-coding-plan/glm-5.3, effort: high }    ```  3. Confirm that OpenCode lists a credential for `Z.AI Coding Plan` and no credential for `opencode-go`:     ```text    $ opencode auth list    OpenAI             oauth    Kimi For Coding    api    Z.AI Coding Plan   api    ```  4. Run:     ```text    oma doctor --profile    ```  ## Expected behavior  The PM row should check authentication for `zai-coding-plan`, derived from the registered `cli_model`, and report it as logged in. If the selected provider cannot be checked reliably, the status should be `unknown` rather than a definite authentication failure.  ## Actual behavior  
  **Post-Mortem & Fix Analysis**:
  > Fixed in cli v12.3.1. `oma doctor --profile` now derives the provider from the registered model's `cli_model` prefix, so `zai-coding-plan/glm-5.3` is checked against the `zai-coding-plan` credential instead of always checking `opencode-go`.  A row whose model has no registered `provider/model` `cli_model` now reports `? unknown` rather than a definite auth failure. The vendor-level check in `oma doctor` / `oma auth:status` still defaults to `opencode-go` and is tracked separately.
  > Thanks for the fix!

- **Issue #672** (2026-08-06): **ralph workflow: Korean keyword "다 해" false-triggers on ordinary phrases like "둘 다 해줘"**
  *Symptoms*: ## Summary  The Korean keyword `"다 해"` in the `ralph` persistent-workflow trigger list (`.agents/hooks/core/triggers.json`, `workflows.ralph.keywords.ko`) is too short and generic — it matches ordinary conversational Korean that has nothing to do with the ralph workflow.  ## Repro  Any prompt containing the substring "다 해" activates ralph persistent mode. Real example from a user session:  > "둘 **다 해**줘. 그리고 sbt 사용 이력에 공연들이 다 나열되고 바로 연결되면 좋겠는데." > ("Do **both** of them. And I'd like the SBT usage history to list all productions with links.")  Here "다 해줘" is just "do both" — completely unrelated to invoking a workflow. This fired `[OMA PERSISTENT MODE: RALPH]` and blocked session termination until manually cleared (`rm .agents/state/ralph-state-<session>.json`).  ## Root cause  `ko` keyword list for `ralph` (from the installed bundle, `oh-my-agent@9.8.0`):  ```json ["랄프","멈추지마","멈추지 말고","끝까지","완료될때까지","될때까지 해","끝날때까지","다 끝내","다 해","전부 완료","끝까지 해","중단하지마","끝장내","끝까지 해줘","다 끝내줘","계속해","계속 해줘", ...] ```  `"다 해"` (2 syllables, no qualifying context) is a substring of extremely common phrases: "둘 다 해줘", "이거 다 해봤어", "밥 다 해놨어", etc. Unlike its neighbors (`"다 끝내"`, `"완료될때까지"`) it carries no "completion/exhaustive" semantic on its own — the "완료" sense only appears when followed by "줘"/"놨"/etc., which the current keyword doesn't require.  Note: I also suspect `"끝까지"` alone (3 syllables, e.g. "이 얘기 끝까지 들어보자") may be similarly prone to false positives, though I haven't reproduced that one
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed repro and root cause analysis, that made this quick to confirm and fix. Both `다 해` and `끝까지` are now gone from ralph's Korean keyword list (your hunch about `끝까지` was right, it reproduced too), and your note about `triggers.json` being inlined at build time is correct as well, so the fix only takes effect from the next release. Please update once it ships.

- **Issue #657** (2026-07-29): **[Bug] Global install/reinstall repeatedly registers $HOME itself as a Serena project**
  *Symptoms*: ## Summary  Every run of `bunx oh-my-agent@latest --global` (including a reinstall over an existing global install) registers the user's `$HOME` directory itself as a Serena project, creating `~/.serena/project.yml` (auto-detected languages, e.g. `python, typescript`) and adding the literal path `/Users/<user>` to the `projects:` list in `~/.serena/serena_config.yml`.  This is almost certainly unintended: it causes Serena to treat the entire home directory as an indexable codebase, and it recurs even after being manually removed, on the very next global reinstall.  ## Steps to reproduce  1. Manually remove any prior `$HOME`-as-project registration:    ```bash    rm ~/.serena/project.yml    # then edit ~/.serena/serena_config.yml, remove the `- $HOME` line from `projects:`    ``` 2. Confirm it's gone:    ```bash    grep -A5 "^projects:" ~/.serena/serena_config.yml    ``` 3. Run a global reinstall:    ```bash    bunx oh-my-agent@latest --global    ```    (Select OpenCode only in the vendor checklist; decline the cross-vendor model preset prompt.)  4. During install, observe:    ```    ◆  Serena project configured (python, typescript)    ◆  Project registered in Serena    ``` 5. Check again:    ```bash    ls -la ~/.serena/project.yml    grep -A5 "^projects:" ~/.serena/serena_config.yml    ```    `~/.serena/project.yml` exists again (freshly created), and `$HOME` is back in the `projects:` list.  ## Expected behavior  A **global** install should not register the install root (`$H

- **Issue #656** (2026-07-29): **[Bug] `oma doctor --profile` ignores the user's models: registry, misreports custom slugs as unknown**
  *Symptoms*: ## Summary  `oma doctor --profile`'s Auth Status Matrix resolves each role's CLI/auth status purely from the model slug's owner prefix (`cli/platform/model-registry.ts`'s `ownerToVendor`), never consulting the user's `models:` registry in `oma-config.yaml`. Any custom-registered model whose owner isn't one of the small built-in set (`anthropic`/`openai`/`antigravity`/`cursor`/`qwen`/`kiro`/`opencode`, plus the `opencode-` prefix rule) is reported as `cli: unknown` / `? unknown`, even though the model is fully and correctly registered with an explicit `cli: opencode` field and resolves correctly at actual dispatch time.  ## Steps to reproduce  1. Add a custom model to `oma-config.yaml`'s `models:` block for an owner not in the built-in set, e.g.:    ```yaml    models:      moonshotai/kimi-k3:        cli: opencode        cli_model: moonshotai/kimi-k3        auth_hint: "Moonshot AI — run: opencode auth login"        supports:          effort: null          apply_patch: false          task_budget: false          prompt_cache: false          computer_use: false          native_dispatch_from: [opencode]          api_only: false    ``` 2. Reference it from a custom preset's `agent_defaults`:    ```yaml    custom_presets:      my-preset:        agent_defaults:          architecture: { model: moonshotai/kimi-k3 }          # ...other roles...    ``` 3. Set `model_preset: my-preset` and run:    ```bash    oma doctor --profile    ``` 4. Observe the `architecture` row: `Model: moonshotai/
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. Pinpointing `cliFromModelSlug` and noticing that `getModelSpec` was imported but never called there saved us the diagnosis.  Fixed in cli 11.2.1. `oma doctor --profile` now goes through the same registry lookup the dispatch path uses, so a registered custom model shows its real CLI and auth status instead of `unknown`. Your report also caught the same owner-prefix assumption in `oma model:probe`, which was trying to spawn a `moonshotai` binary instead of the `opencode` CLI the spec declares. That one is in the same release.

- **Issue #655** (2026-07-29): **[Bug] Global install migrates .codex/config.toml for Codex before vendor selection**
  *Symptoms*: ## Summary  A global install via `bunx oh-my-agent@latest --global` modifies `.codex/config.toml` to register the Serena MCP, before vendor selection is presented in the "CLI tools to configure" vendor multiselect.  The write is driven entirely by migration `007-codex-qwen-serena.ts`, which gates only on whether `.codex/config.toml` already exists on disk, with no check against the vendor selection made (or about to be made) in the current install run.  This breaks the expectation set by the installer's own prompt copy — "CLI tools to configure (deselect all to skip)" — which implies deselecting a vendor leaves it untouched.  ## Steps to reproduce  1. Have Codex CLI previously installed and authenticated on the machine, with an existing `.codex/config.toml` (unrelated to oh-my-agent). 2. Run `bunx oh-my-agent@latest --global`. 3. Observe the migration step print `✓ .codex/config.toml (Serena MCP registered)` *before* the "CLI tools to configure" vendor multiselect prompt appears. 4. At the vendor multiselect, deselect every vendor except OpenCode. 5. Complete the install.  ## Expected behaviour  Serena MCP registration should occur only for selected vendors, based on the vendor multiselect. Vendor-scoped writes (skills, agents, MCP registration) should all be gated on the same selection set.  ## Actual behaviour  `.codex/config.toml` is modified before vendor selection.  ## Potential root cause  `cli/commands/migrations/007-codex-qwen-serena.ts`:  ```ts const codexConfigPath 
  **Post-Mortem & Fix Analysis**:
  > Thanks for tracing this to `007-codex-qwen-serena.ts`.  Fixed in cli 11.2.2: migrations now receive the vendor selection in force for the run and gate every vendor-scoped write on it, so deselecting a vendor leaves its config untouched. The pass that runs before the multiselect is now allowed no vendor writes at all, and migrations 009, 011, 015, and 019 got the same gating since they shared the pattern. Available via `bunx oh-my-agent@latest --global`.

- **Issue #613** (2026-07-14): **Windows: state:emit fails with EPERM when fsync uses a read-only handle**
  *Symptoms*: ## Summary  On Windows, `oma state:emit` fails with:  ```text EPERM: operation not permitted, fsync ```  This affects events that refresh `meta.json`, including `session.created`, `workflow.phase`, and `session.ended`.  ## Environment  - Windows 11 - OMA 10.11.0 - Bun 1.3.11 - Node.js 24.18.0  ## Reproduction  ```powershell $sid = "debug-fsync-$(Get-Date -Format 'yyyyMMdd-HHmmss')" oma state:emit --sid $sid "session.created" '{"workflow":"debug","category":"fsync-windows"}' ```  Observed result:  ```text EPERM: operation not permitted, fsync ```  After the failure:  - `events.jsonl` exists and already contains the event. - `meta.json` is missing. - A `meta.json.<pid>.<timestamp>.tmp` file remains.  ## Confirmed root cause  `emitEvent()` appends the event before calling `refreshMeta()`. The metadata path eventually calls `atomicWriteJson()`, which writes the temporary file, reopens it read-only, and then calls `fsyncSync()`:  ```ts writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf-8"); const fd = openSync(tmp, "r"); try {   fsyncSync(fd); } finally {   closeSync(fd); } renameSync(tmp, path); ```  On Windows, flushing this read-only handle fails. An isolated probe on the same machine confirms the handle mode is the determining factor:  ```text r: EPERM fsync r+: PASS ```  The same pattern is present in the generated state-marker copies under `.agents/hooks/core/` and `.opencode/plugins/oma/`.  ## Impact  The command reports failure even though the event has already
  **Post-Mortem & Fix Analysis**:
  > Fixed in 13fa956 (`fix(state): use writable handle for atomicWriteJson fsync on Windows`), released in **cli v10.17.3**.  `atomicWriteJson()` now reopens the temp file with a writable handle (`"r+"` instead of `"r"`) before `fsyncSync()`, so the flush no longer hits `EPERM` on Windows. Applied to both the CLI source (`cli/state/events.ts`) and the hook copy (`.agents/hooks/core/state-marker.ts`). Regression tests assert the temp file is opened with a writable handle and that `session.created`/`workflow.phase`/`session.ended` each write `meta.json` and append exactly one event with no leftover `.tmp`.  Thanks for the precise root-cause analysis and the isolated `r`/`r+` probe — made this a one-line fix.
  > much appreciated!

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

### Incident Patch 1: `11f46c88` (2026-10-06)
**Commit Message**: fix(hooks): verify the code-intelligence guard escape hatch

Any shell command carrying the bypass token passed unchecked, and the
shipped oma-config.yaml named the token, so agents learned it and
searched project source natively. The guard also denied legitimate
external searches written with `2>/dev/null`, a leading `cd <dir> &&`
or `$HOME`, which taught agents to reach for the token.

Honor the token only when every search path is outside the project or
ignored by git, resolve discard redirections, a literal leading `cd`
and `$HOME`, and drop the token from the shipped config comments.

Co-Authored-By: First Fluke <[REDACTED_EMAIL]>

**File**: `.agents/hooks/core/code-intelligence-guard.ts` (modified, +73/-15)
```diff
@@ -18,14 +18,17 @@
 //    `off`. The hook cannot observe whether the MCP server is actually up.
 //    The deny reason does not name a bypass: confirmed exclusions and
 //    external paths already pass, and project source stays on the provider.
-//  - Escape hatch: a shell command containing `OMA_CI_ALLOW_NATIVE=1` still
-//    bypasses the guard. That prefix is only for a search of resources
-//    outside the project or ignored paths the guard did not recognize, never
-//    for project source. Do not advertise it in the deny reason. Grep/Glob
-//    have no argument to carry a token, so the hatch stays shell-only.
-
+//  - Escape hatch: a shell command containing `OMA_CI_ALLOW_NATIVE=1` passes
+//    only when every search path resolves outside the project or is ignored
+//    by git — ignored paths the provider listing did not recognize. Project
+//    source, or a path the guard cannot resolve, stays blocked with the token.
+//    Do not advertise it in the deny reason or shipped config. Grep/Glob have
+//    no argument to carry a token, so the hatch stays shell-only.
+
+import { execFileSync } from "node:child_process";
 import { readFileSync } from "node:fs";
-import { isAbsolute, resolve } from "node:path";
+import { homedir } from "node:os";
+import { isAbsolute, relative, resolve } from "node:path";
 import {
   type CodeIntelligenceProvider,
   detectCodeIntelligenceGuardMode,
@@ -289,29 +292,73 @@ function searchRoots(bin: string, args: string[]): string[] | null {
   return positional;
 }
 
+/**
+ * Redirections that only discard or merge output (`2>/dev/null`, `2>&1`,
+ * `&>/dev/null`). They never name a search path, so they must not push an
+ * otherwise resolvable search onto the unresolvable path.
+ */
+const DISCARD_REDIRECTION =
+  /(^|\s)(?:[0-9]?>>?|&>>?)\s*(?:\/dev\/null|&[0-9])(?=\s|$|[;|&])/g;
+
+function expandHome(path: string): string {
+  if (path === "~") return homedir();
+  return path.startsWith("~/") ? resolve(homedir(), path.slice(2)) : path;
+}
+
 function shellSearchRoots(
   command: string,
-  projectDir: string,
+  sessionCwd: string,
 ): string[] | null {
-  // Do not guess expansions, redirections, subshells or changing directories.
-  if (/[$`<>\\()]/.test(command)) return null;
+  const cleaned = command
+    .replace(DISCARD_REDIRECTION, "$1")
+    // `$HOME` is the one expansion agents routinely use for external paths.
+    .replace(/\$\{?HOME\}?(?=\/|\s|$)/g, homedir());
+  // Do not guess expansions, other redirections or subshells.
+  if (/[$`<>\\()]/.test(cleaned)) return null;
   const roots: string[] = [];
-  for (const segment of commandSegments(command)) {
+  // A literal `cd <dir>` moves the base later relative paths resolve from.
+  let base = sessionCwd;
+  for (const segment of commandSegments(cleaned)) {
     const tokens = stripPrefixes(tokenize(segment.trim()));
     const bin = basename(tokens[0] ?? "");
-    if (["cd", "pushd", "popd"].includes(bin)) return null;
+    if (bin === "cd") {
+      const target = tokens[1];
+      if (tokens.length !== 2 || !target || searchPathRoot(target) !== target)
+        return null;
+      base = resolve(base, expandHome(target));
+      continue;
+    }
+    if (["pushd", "popd"].includes(bin)) return null;
     if (!detectNativeSearchCommand(segment)) continue;
     const paths = searchRoots(bin, tokens.slice(1));
     if (!paths?.length) return null;
     for (const path of paths) {
       const literal = searchPathRoot(path);
       if (!literal) return null;
-      roots.push(resolve(projectDir, literal));
+      roots.push(resolve(base, expandHome(literal)));
     }
   }
   return roots;
 }
 
+/** True when `root` is outside the project, or git ignores it. */
+function bypassCovers(projectDir: string, root: string): boolean {
+  const path = relative(projectDir, root);
+  if (path === ".." || path.startsWith("../") || isAbsolute(path)) return true;
+  if (!path) return false;
+  try {
+    // Exit 0 means ignored. Tracked files report as not ignored, so committed
+    // source never qualifies even under an ignore pattern.
+    execFileSync("git", ["-C", projectDir, "check-ignore", "-q", "--", path], {
+      stdio: "ignore",
+      timeout: 5_000,
+    });
+    return true;
+  } catch {
+    return false;
+  }
+}
+
 // --- Deny reasons ---
 
 function providerLabel(provider: CodeIntelligenceProvider): string {
@@ -381,10 +428,11 @@ export async function run(
   if (isShell) {
     const command = toolInput.command as string | undefined;
     if (!command) return null;
-    if (command.includes(BYPASS_TOKEN)) return null;
     searchBin = detectNativeSearchCommand(command);
     if (!searchBin) return null;
   }
+  const bypass =
+    isShell && (toolInput.command as string).includes(BYPASS_TOKEN);
 
   // Config reads happen after the cheap tool/command checks so the common
   // (non-search) path never touches the filesystem.
@@ -409,6 +457,13 @@ export async function run(
     roots = [resolve(se
```

**File**: `.agents/oma-config.yaml` (modified, +2/-4)
```diff
@@ -69,10 +69,8 @@ telemetry: false
 # provider is configured, the PreToolUse hook `code-intelligence-guard` denies
 # native search (Claude `Grep` / `Glob`; shell `rg`, `ag`, `fd`, `grep -r`,
 # `find -name`, `git grep`) and points the agent at the provider's tools. Set
-# `off` to fall back to the advisory-only primer. The hook does not advertise
-# a bypass. A shell command prefixed with `OMA_CI_ALLOW_NATIVE=1` bypasses
-# the guard only for searches outside the project or ignored paths the guard
-# did not recognize, not for project source.
+# `off` to fall back to the advisory-only primer. Searches confined to paths
+# outside the project or provider-excluded paths already pass.
 providers:
   code_intelligence: serena
   # code_intelligence_guard: block
```

**File**: `cli/__tests__/code-intelligence-guard-run.test.ts` (modified, +100/-5)
```diff
@@ -7,7 +7,13 @@
 
 import * as childProcess from "node:child_process";
 import { execFileSync } from "node:child_process";
-import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
+import {
+  mkdirSync,
+  mkdtempSync,
+  readFileSync,
+  rmSync,
+  writeFileSync,
+} from "node:fs";
 import { tmpdir } from "node:os";
 import { join } from "node:path";
 import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
@@ -133,8 +139,88 @@ describe("code-intelligence-guard run() — serena configured", () => {
     }
   });
 
-  it("allows the shell escape hatch", async () => {
-    expect(await runShell(`${BYPASS_TOKEN} rg foo cli`)).toBeNull();
+  it("allows the shell escape hatch for paths outside the project", async () => {
+    expect(await runShell(`${BYPASS_TOKEN} rg foo /external/repo`)).toBeNull();
+  });
+
+  // The hatch used to pass any command carrying the token, so agents that
+  // learned it searched project source natively.
+  it("keeps project source blocked even with the escape hatch", async () => {
+    for (const command of [
+      `${BYPASS_TOKEN} rg foo cli`,
+      `${BYPASS_TOKEN} grep -rn foo .`,
+      `${BYPASS_TOKEN} cd /external && rg foo ${projectDir}/src`,
+    ]) {
+      const result = await runShell(command);
+      expect(result?.type, command).toBe("block");
+      expect((result as { reason: string }).reason).toContain(
+        "The bypass covers only paths outside this project",
+      );
+    }
+  });
+
+  it("keeps the escape hatch blocked when the search path is unresolvable", async () => {
+    expect(
+      (
+        await runShell(
+          `${BYPASS_TOKEN} rg foo $(git rev-parse --show-toplevel)`,
+        )
+      )?.type,
+    ).toBe("block");
+    expect((await runShell(`${BYPASS_TOKEN} git grep foo`))?.type).toBe(
+      "block",
+    );
+  });
+
+  it("allows the escape hatch for git-ignored paths the provider did not list", async () => {
+    execFileSync("git", ["init", "-q", projectDir]);
+    writeFileSync(join(projectDir, ".gitignore"), "generated/\n");
+    mkdirSync(join(projectDir, "generated", "out"), { recursive: true });
+    mkdirSync(join(projectDir, "src"));
+
+    expect((await runShell("rg foo generated/out"))?.type).toBe("block");
+    expect(await runShell(`${BYPASS_TOKEN} rg foo generated/out`)).toBeNull();
+    expect(
+      (await runShell(`${BYPASS_TOKEN} rg foo generated/out src`))?.type,
+    ).toBe("block");
+  });
+
+  it.each([
+    "rg foo /external/repo 2>/dev/null",
+    "grep -rn foo /external/repo 2>&1 | head -20",
+    "rg foo /external/repo &>/dev/null",
+    "cd /external/repo && rg foo src",
+    "cd /external/repo && grep -rn foo apps 2>/dev/null | head",
+    "rg foo $HOME/elsewhere",
+    // biome-ignore lint/suspicious/noTemplateCurlyInString: a literal shell expansion
+    "rg foo ${HOME}/elsewhere",
+  ])(
+    "does not block an external search over shell syntax: %s",
+    async (command) => {
+      expect(await runShell(command)).toBeNull();
+    },
+  );
+
+  it.each([
+    "rg foo cli 2>/dev/null",
+    "rg foo /external/repo > out.txt",
+    "cd cli && rg foo .",
+    "cd - && rg foo src",
+  ])("still blocks project or unresolvable searches: %s", async (command) => {
+    expect((await runShell(command))?.type).toBe("block");
+  });
+
+  it("is not advertised in the shipped config", () => {
+    for (const file of [
+      ".agents/oma-config.yaml",
+      "com.firstfluke.oma/oma-config.yaml",
+    ]) {
+      const content = readFileSync(
+        join(import.meta.dirname, "..", "..", file),
+        "utf8",
+      );
+      expect(content, file).not.toContain(BYPASS_TOKEN);
+    }
   });
 
   it("allows non-search shell commands and non-recursive grep", async () => {
@@ -228,6 +314,7 @@ describe("code-intelligence-guard run() — excluded search scope", () => {
     "fd -e py foo packages/custom-env",
     "rg foo node_modules | head -20",
     "rg foo node_modules && rg bar third-party",
+    "cd packages && rg foo ../node_modules",
   ])("allows searches confined to excluded roots: %s", async (command) => {
     expect(await runShell(command)).toBeNull();
   });
@@ -265,7 +352,6 @@ describe("code-intelligence-guard run() — excluded search scope", () => {
     "rg --files",
     "grep -rE foo src node_modules",
     "fd -f foo src node_modules",
-    "cd src && rg foo ../node_modules",
     "find . -path '*/node_modules/*'",
   ])("keeps project searches guarded: %s", async (command) => {
     expect((await runShell(command))?.type).toBe("block");
@@ -337,6 +423,12 @@ describe("code-intelligence-guard run() — excluded search scope", () => {
       "ignored_paths: *shared\n",
     );
     expect((await runShell("rg foo third-party"))?.type).toBe("block");
+    // The escape hatch is verified too: an unreadable provider rule is not
+    // proof the path is excluded, so only a git-ignored path qualifies.
+    expect((await runShell(`${BYPASS_TOKEN} rg foo third-party`))?.type).toB
```

**File**: `com.firstfluke.oma/oma-config.yaml` (modified, +2/-4)
```diff
@@ -69,10 +69,8 @@ telemetry: false
 # provider is configured, the PreToolUse hook `code-intelligence-guard` denies
 # native search (Claude `Grep` / `Glob`; shell `rg`, `ag`, `fd`, `grep -r`,
 # `find -name`, `git grep`) and points the agent at the provider's tools. Set
-# `off` to fall back to the advisory-only primer. The hook does not advertise
-# a bypass. A shell command prefixed with `OMA_CI_ALLOW_NATIVE=1` bypasses
-# the guard only for searches outside the project or ignored paths the guard
-# did not recognize, not for project source.
+# `off` to fall back to the advisory-only primer. Searches confined to paths
+# outside the project or provider-excluded paths already pass.
 providers:
   code_intelligence: serena
   # code_intelligence_guard: block
```

---

### Incident Patch 2: `ef19460d` (2026-10-06)
**Commit Message**: fix(serena): bound shared daemon logs

Per-port daemon logs were appended forever and never removed (hundreds
of MB). Start each daemon with a fresh log, and let the idle sweep empty
a live daemon's log past 20 MB and delete logs no daemon owns.

Co-Authored-By: First Fluke <[REDACTED_EMAIL]>

**File**: `cli/io/serena-daemon.test.ts` (modified, +70/-1)
```diff
@@ -1,4 +1,13 @@
-import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
+import {
+  existsSync,
+  mkdirSync,
+  mkdtempSync,
+  readFileSync,
+  rmSync,
+  statSync,
+  utimesSync,
+  writeFileSync,
+} from "node:fs";
 import { tmpdir } from "node:os";
 import { join, resolve } from "node:path";
 import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
@@ -9,6 +18,7 @@ import {
   _setOmaStateDirForTests,
   attachClient,
   DAEMON_IDLE_GRACE_MS,
+  DAEMON_LOG_MAX_BYTES,
   daemonKey,
   detachClient,
   ensureSerenaDaemon,
@@ -1039,3 +1049,62 @@ describe("reclaimIdleDaemons — daemons missing from the registry", () => {
     expect(Object.keys(readRegistry())).toEqual([daemonKey("/proj", "ide")]);
   });
 });
+
+describe("reclaimIdleDaemons — daemon logs", () => {
+  const logFile = (port: number) =>
+    join(omaStateDir(), `serena-daemon-${port}.log`);
+  const age = (file: string, ms: number) => {
+    const then = new Date(Date.now() - ms);
+    utimesSync(file, then, then);
+  };
+
+  beforeEach(() => {
+    mkdirSync(omaStateDir(), { recursive: true });
+  });
+
+  it("deletes logs no daemon owns once they are past the grace period", () => {
+    writeFileSync(logFile(12341), "old run\n");
+    age(logFile(12341), DAEMON_IDLE_GRACE_MS + 60_000);
+    writeFileSync(logFile(12342), "starting\n");
+
+    reclaimIdleDaemons(
+      Date.now(),
+      () => {},
+      () => [],
+    );
+
+    expect(existsSync(logFile(12341))).toBe(false);
+    // Fresh: may be a daemon still starting, before it is registered.
+    expect(existsSync(logFile(12342))).toBe(true);
+  });
+
+  it("keeps a live daemon's log and empties it past the size cap", () => {
+    const scan = () => [
+      { pid: process.pid, port: 12389, root: "/proj", context: "ide" },
+      { pid: process.pid, port: 12390, root: "/other", context: "ide" },
+    ];
+    writeFileSync(logFile(12389), Buffer.alloc(DAEMON_LOG_MAX_BYTES + 1));
+    writeFileSync(logFile(12390), "small\n");
+    age(logFile(12389), DAEMON_IDLE_GRACE_MS * 10);
+    age(logFile(12390), DAEMON_IDLE_GRACE_MS * 10);
+
+    reclaimIdleDaemons(Date.now(), () => {}, scan);
+
+    expect(statSync(logFile(12389)).size).toBe(0);
+    expect(readFileSync(logFile(12390), "utf8")).toBe("small\n");
+  });
+
+  it("leaves unrelated files in the state directory alone", () => {
+    const other = join(omaStateDir(), "vault-index.json");
+    writeFileSync(other, "{}");
+    age(other, DAEMON_IDLE_GRACE_MS * 10);
+
+    reclaimIdleDaemons(
+      Date.now(),
+      () => {},
+      () => [],
+    );
+
+    expect(existsSync(other)).toBe(true);
+  });
+});
```

**File**: `cli/io/serena-daemon.ts` (modified, +55/-1)
```diff
@@ -1,12 +1,15 @@
 import { spawn, spawnSync } from "node:child_process";
 import {
   closeSync,
+  constants,
   existsSync,
   mkdirSync,
   openSync,
+  readdirSync,
   readFileSync,
   rmSync,
   statSync,
+  truncateSync,
   writeFileSync,
 } from "node:fs";
 import http from "node:http";
@@ -84,6 +87,11 @@ function daemonLogPath(port: number): string {
   return join(omaStateDir(), `serena-daemon-${port}.log`);
 }
 
+const DAEMON_LOG_PATTERN = /^serena-daemon-(\d+)\.log$/;
+
+/** A live daemon's log is emptied once it passes this size. */
+export const DAEMON_LOG_MAX_BYTES = 20 * 1024 * 1024;
+
 function lockPath(): string {
   return join(omaStateDir(), "serena-daemons.lock");
 }
@@ -381,7 +389,15 @@ function spawnDaemonProcess(
   context: string,
 ): number | null {
   mkdirSync(omaStateDir(), { recursive: true });
-  const log = openSync(daemonLogPath(port), "a");
+  // Fresh per start, and O_APPEND so the cleanup sweep can empty it in place
+  // while the daemon keeps writing.
+  const log = openSync(
+    daemonLogPath(port),
+    constants.O_WRONLY |
+      constants.O_CREAT |
+      constants.O_TRUNC |
+      constants.O_APPEND,
+  );
 
   // Detached on purpose: the daemon outlives the session that happened to start
   // it, so one client exiting does not tear serena out from under its peers.
@@ -853,6 +869,44 @@ export function reclaimIdleDaemons(
       delete registry[key];
     }
 
+    sweepDaemonLogs(registry, running, nowMs);
     return reclaimed;
   });
 }
+
+/**
+ * Bound the per-port daemon logs: empty a live daemon's oversized log and
+ * delete logs no daemon owns. A log touched within the grace period may
+ * belong to a daemon still starting, before it is registered.
+ */
+function sweepDaemonLogs(
+  registry: DaemonRegistry,
+  running: RunningDaemon[],
+  nowMs: number,
+): void {
+  const livePorts = new Set([
+    ...Object.values(registry).map((record) => record.port),
+    ...running.map((daemon) => daemon.port),
+  ]);
+  let names: string[];
+  try {
+    names = readdirSync(omaStateDir());
+  } catch {
+    return;
+  }
+  for (const name of names) {
+    const match = DAEMON_LOG_PATTERN.exec(name);
+    if (!match) continue;
+    const file = join(omaStateDir(), name);
+    try {
+      const stat = statSync(file);
+      if (livePorts.has(Number(match[1]))) {
+        if (stat.size > DAEMON_LOG_MAX_BYTES) truncateSync(file, 0);
+      } else if (nowMs - stat.mtimeMs > DAEMON_IDLE_GRACE_MS) {
+        rmSync(file, { force: true });
+      }
+    } catch {
+      // Removed concurrently, or unreadable: leave it for the next sweep.
+    }
+  }
+}
```

---

### Incident Patch 3: `a6f458ca` (2026-10-06)
**Commit Message**: fix(serena): pin background services to the oma that installs them

The idle-daemon timer ran `/usr/bin/env oma` with a service PATH that has
no version-manager shims, so it resolved a stale global oma without
`serena daemon:gc` and failed on every run, leaving abandoned daemons
resident. Render the running runtime and entry script instead, and have
each bridge start replace a timer whose file no longer matches. The reaper
service had the same lookup.

Co-Authored-By: First Fluke <[REDACTED_EMAIL]>

**File**: `cli/platform/oma-invocation.test.ts` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+import { resolve } from "node:path";
+import { describe, expect, it } from "vitest";
+import { currentOmaInvocation, pinnedServicePath } from "./oma-invocation.js";
+
+describe("currentOmaInvocation", () => {
+  it("pins the running runtime and an absolute entry script", () => {
+    expect(currentOmaInvocation("/opt/node/bin/node", "bin/cli.js")).toEqual([
+      "/opt/node/bin/node",
+      resolve("bin/cli.js"),
+    ]);
+  });
+
+  it("falls back to a PATH lookup without an entry script", () => {
+    expect(currentOmaInvocation("/opt/node/bin/node", "")).toEqual([
+      "oma",
+    ]);
+  });
+});
+
+describe("pinnedServicePath", () => {
+  it("puts the pinned runtime's directory first", () => {
+    expect(pinnedServicePath(["/opt/node/bin/node", "/x"], "/usr/bin")).toBe(
+      "/opt/node/bin:/usr/bin",
+    );
+    expect(pinnedServicePath(["oma"], "/usr/bin")).toBe("/usr/bin");
+  });
+});
```

**File**: `cli/platform/oma-invocation.ts` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+import { dirname, resolve } from "node:path";
+
+/**
+ * Absolute argv that re-runs the oma currently executing: the runtime binary
+ * plus its entry script.
+ *
+ * Background services must not resolve bare `oma` through their own PATH: a
+ * service PATH has no version-manager shims (mise, nvm, …), so it can land on
+ * a stale global install that lacks the subcommand being scheduled. Installers
+ * re-render on each run, so a moved or upgraded install is repointed the next
+ * time oma installs the service.
+ */
+export function currentOmaInvocation(
+  execPath: string = process.execPath,
+  script: string | undefined = process.argv[1],
+): string[] {
+  return script ? [execPath, resolve(script)] : ["oma"];
+}
+
+/** Service PATH with the pinned runtime's directory first. */
+export function pinnedServicePath(
+  invocation: readonly string[],
+  fallbackPath: string,
+): string {
+  const [bin] = invocation;
+  if (!bin || bin === "oma") return fallbackPath;
+  return `${dirname(bin)}:${fallbackPath}`;
+}
+
+export function escapeXml(value: string): string {
+  return value
+    .replace(/&/g, "&amp;")
+    .replace(/</g, "&lt;")
+    .replace(/>/g, "&gt;")
+    .replace(/"/g, "&quot;");
+}
+
+/** launchd `ProgramArguments` entries for the invocation plus `args`. */
+export function launchdProgramArguments(
+  invocation: readonly string[],
+  args: readonly string[],
+): string {
+  return [...invocation, ...args]
+    .map((arg) => `<string>${escapeXml(arg)}</string>`)
+    .join("");
+}
+
+/** systemd `ExecStart` value; every word is quoted so paths may hold spaces. */
+export function systemdExecStart(
+  invocation: readonly string[],
+  args: readonly string[],
+): string {
+  const words = [...invocation, ...args].map(
+    (arg) => `"${arg.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
+  );
+  // A bare `oma` fallback still needs a PATH lookup, which ExecStart lacks.
+  return invocation[0] === "oma"
+    ? `/usr/bin/env ${words.join(" ")}`
+    : words.join(" ");
+}
+
+/** Windows Task Scheduler `<Command>` / `<Arguments>` pair. */
+export function windowsTaskExec(
+  invocation: readonly string[],
+  args: readonly string[],
+): { command: string; arguments: string } {
+  const [command = "oma", ...rest] = invocation;
+  return {
+    command: escapeXml(command),
+    arguments: escapeXml([...rest.map((arg) => `"${arg}"`), ...args].join(" ")),
+  };
+}
```

**File**: `cli/platform/serena-daemon-gc-service.test.ts` (modified, +77/-6)
```diff
@@ -2,6 +2,7 @@ import {
   existsSync,
   mkdirSync,
   mkdtempSync,
+  readFileSync,
   rmSync,
   utimesSync,
   writeFileSync,
@@ -29,22 +30,92 @@ describe("Serena daemon cleanup schedule", () => {
     rmSync(homeDir, { recursive: true, force: true });
   });
 
+  const invocation = ["/opt/node/bin/node", "/opt/oma/bin/cli.js"];
+
   it("runs independently of the optional LSP reaper on macOS", () => {
-    const plist = renderDaemonGcLaunchdPlist(homeDir);
+    const plist = renderDaemonGcLaunchdPlist(homeDir, invocation);
     expect(plist).toContain("dev.oma.serena-daemon-gc");
     expect(plist).toContain("<string>daemon:gc</string>");
     expect(plist).toContain("<key>StartInterval</key><integer>300</integer>");
     expect(plist).not.toContain("<key>KeepAlive</key>");
     expect(plist).not.toContain("serena reap");
   });
 
-  it("uses the same cleanup command on Linux and Windows", () => {
+  // A service PATH has no version-manager shims, so `/usr/bin/env oma` ran a
+  // stale global oma without `daemon:gc` and every cleanup run failed.
+  it("pins the oma that installed it instead of resolving oma on PATH", () => {
+    const plist = renderDaemonGcLaunchdPlist(homeDir, invocation);
+    expect(plist).toContain(
+      "<array><string>/opt/node/bin/node</string><string>/opt/oma/bin/cli.js</string><string>serena</string><string>daemon:gc</string><string>--quiet</string></array>",
+    );
+    expect(plist).not.toContain("/usr/bin/env");
+    expect(plist).toContain("<string>/opt/node/bin:");
+    expect(renderDaemonGcLaunchdPlist(homeDir, ["/a&b/node", "/x"])).toContain(
+      "<string>/a&amp;b/node</string>",
+    );
+  });
+
+  it("uses the same pinned cleanup command on Linux and Windows", () => {
     expect(renderDaemonGcSystemdTimer()).toContain("OnUnitActiveSec=300s");
-    expect(renderDaemonGcSystemdService(homeDir)).toContain(
-      "oma serena daemon:gc --quiet",
+    expect(renderDaemonGcSystemdService(homeDir, invocation)).toContain(
+      'ExecStart="/opt/node/bin/node" "/opt/oma/bin/cli.js" "serena" "daemon:gc" "--quiet"',
+    );
+    const xml = renderDaemonGcWindowsTaskXml([
+      "C:\\node.exe",
+      "C:\\oma\\cli.js",
+    ]);
+    expect(xml).toContain("<Command>C:\\node.exe</Command>");
+    expect(xml).toContain(
+      "<Arguments>&quot;C:\\oma\\cli.js&quot; serena daemon:gc --quiet</Arguments>",
+    );
+  });
+
+  it("falls back to a PATH lookup when the entry script is unknown", () => {
+    expect(renderDaemonGcSystemdService(homeDir, ["oma"])).toContain(
+      'ExecStart=/usr/bin/env "oma" "serena" "daemon:gc" "--quiet"',
     );
-    expect(renderDaemonGcWindowsTaskXml()).toContain(
-      "serena daemon:gc --quiet",
+  });
+
+  it("replaces an active timer that runs a different oma", () => {
+    const path = daemonGcServicePath(homeDir, "darwin") ?? "";
+    mkdirSync(join(homeDir, "Library", "LaunchAgents"), { recursive: true });
+    writeFileSync(
+      path,
+      renderDaemonGcLaunchdPlist(homeDir, ["/old/node", "/old/cli.js"]),
+    );
+    const runner = vi.fn(() => true);
+
+    expect(
+      ensureSerenaDaemonGcService({
+        homeDir,
+        platform: "darwin",
+        runner,
+        invocation,
+      }),
+    ).toBe(true);
+    const calls = runner.mock.calls.map((call) => (call as string[][])[1]?.[0]);
+    expect(calls.indexOf("bootout")).toBeGreaterThan(-1);
+    expect(calls.indexOf("bootout")).toBeLessThan(calls.indexOf("bootstrap"));
+    expect(readFileSync(path, "utf8")).toBe(
+      renderDaemonGcLaunchdPlist(homeDir, invocation),
+    );
+  });
+
+  it("leaves a current, active timer alone", () => {
+    const runner = vi.fn(() => true);
+    const options = {
+      homeDir,
+      platform: "darwin" as const,
+      runner,
+      invocation,
+    };
+    expect(ensureSerenaDaemonGcService(options)).toBe(true);
+    runner.mockClear();
+    expect(ensureSerenaDaemonGcService(options)).toBe(true);
+    expect(runner).toHaveBeenCalledTimes(1);
+    expect(runner).toHaveBeenCalledWith(
+      "launchctl",
+      expect.arrayContaining(["print"]),
     );
   });
 
```

**File**: `cli/platform/serena-daemon-gc-service.ts` (modified, +89/-32)
```diff
@@ -4,17 +4,26 @@ import {
   existsSync,
   mkdirSync,
   openSync,
+  readFileSync,
   rmSync,
   statSync,
   writeFileSync,
 } from "node:fs";
 import { homedir } from "node:os";
 import { dirname, join } from "node:path";
+import {
+  currentOmaInvocation,
+  launchdProgramArguments,
+  pinnedServicePath,
+  systemdExecStart,
+  windowsTaskExec,
+} from "./oma-invocation.js";
 import { servicePathEnvironment } from "./serena-reaper/service-files.js";
 
 const LABEL = "dev.oma.serena-daemon-gc";
 const TASK_NAME = "OMA Serena Daemon GC";
 const INTERVAL_SECONDS = 300;
+const GC_ARGS = ["serena", "daemon:gc", "--quiet"];
 
 type Runner = (bin: string, args: string[]) => boolean;
 
@@ -65,19 +74,19 @@ export function daemonGcServicePath(
   return undefined;
 }
 
-export function renderDaemonGcLaunchdPlist(homeDir: string): string {
+export function renderDaemonGcLaunchdPlist(
+  homeDir: string,
+  invocation: readonly string[] = currentOmaInvocation(),
+): string {
   return `<?xml version="1.0" encoding="UTF-8"?>
 <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
 <plist version="1.0">
 <dict>
   <key>Label</key><string>${LABEL}</string>
   <key>ProgramArguments</key>
-  <array>
-    <string>/usr/bin/env</string><string>oma</string><string>serena</string>
-    <string>daemon:gc</string><string>--quiet</string>
-  </array>
+  <array>${launchdProgramArguments(invocation, GC_ARGS)}</array>
   <key>EnvironmentVariables</key>
-  <dict><key>PATH</key><string>${servicePathEnvironment(homeDir)}</string></dict>
+  <dict><key>PATH</key><string>${pinnedServicePath(invocation, servicePathEnvironment(homeDir))}</string></dict>
   <key>StartInterval</key><integer>${INTERVAL_SECONDS}</integer>
   <key>StandardOutPath</key><string>/tmp/oma-serena-daemon-gc.out.log</string>
   <key>StandardErrorPath</key><string>/tmp/oma-serena-daemon-gc.err.log</string>
@@ -100,43 +109,92 @@ WantedBy=timers.target
 `;
 }
 
-export function renderDaemonGcSystemdService(homeDir: string): string {
+export function renderDaemonGcSystemdService(
+  homeDir: string,
+  invocation: readonly string[] = currentOmaInvocation(),
+): string {
   return `[Unit]
 Description=OMA Serena idle daemon cleanup
 
 [Service]
 Type=oneshot
-Environment=PATH=${servicePathEnvironment(homeDir)}
-ExecStart=/usr/bin/env oma serena daemon:gc --quiet
+Environment=PATH=${pinnedServicePath(invocation, servicePathEnvironment(homeDir))}
+ExecStart=${systemdExecStart(invocation, GC_ARGS)}
 `;
 }
 
-export function renderDaemonGcWindowsTaskXml(): string {
+export function renderDaemonGcWindowsTaskXml(
+  invocation: readonly string[] = currentOmaInvocation(),
+): string {
+  const exec = windowsTaskExec(invocation, GC_ARGS);
   return `<?xml version="1.0" encoding="UTF-8"?>
 <Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
   <RegistrationInfo><Description>OMA Serena idle daemon cleanup</Description></RegistrationInfo>
   <Triggers><TimeTrigger><Repetition><Interval>PT5M</Interval><StopAtDurationEnd>false</StopAtDurationEnd></Repetition><StartBoundary>2000-01-01T00:00:00</StartBoundary><Enabled>true</Enabled></TimeTrigger></Triggers>
   <Principals><Principal id="Author"><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
   <Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><StartWhenAvailable>true</StartWhenAvailable></Settings>
-  <Actions Context="Author"><Exec><Command>oma</Command><Arguments>serena daemon:gc --quiet</Arguments></Exec></Actions>
+  <Actions Context="Author"><Exec><Command>${exec.command}</Command><Arguments>${exec.arguments}</Arguments></Exec></Actions>
 </Task>
 `;
 }
 
-/** Install the idle-daemon timer once. A failed activation is retried next bridge start. */
+/** Every file the service consists of, with the content it should have. */
+function serviceFiles(
+  path: string,
+  homeDir: string,
+  platform: NodeJS.Platform,
+  invocation: readonly string[],
+): Array<[string, string]> {
+  if (platform === "darwin") {
+    return [[path, renderDaemonGcLaunchdPlist(homeDir, invocation)]];
+  }
+  if (platform === "linux") {
+    return [
+      [path, renderDaemonGcSystemdTimer()],
+      [
+        path.replace(/\.timer$/, ".service"),
+        renderDaemonGcSystemdService(homeDir, invocation),
+      ],
+    ];
+  }
+  return [[path, renderDaemonGcWindowsTaskXml(invocation)]];
+}
+
+function filesCurrent(files: Array<[string, string]>): boolean {
+  return files.every(([file, content]) => {
+    try {
+      return readFileSync(file, "utf8") === content;
+    } catch {
+      return false;
+    }
+  });
+}
+
+/**
+ * Install the idle-daemon timer, or repoint one installed by another oma.
+ * A failed activation is retried next bridge start.
+ */
 export function ensureSerenaDaemonGcService(
   options: {
     homeDir?: string;
     platform?: NodeJS.Platform;
     runner?: Runner;
+    /** C
```

**File**: `cli/platform/serena-reaper-service.test.ts` (modified, +23/-12)
```diff
@@ -42,12 +42,15 @@ describe("serena-reaper service-files", () => {
       expect(content).toContain(LAUNCHD_SERENA_REAPER_LABEL);
     });
 
-    it("runs oma serena reap --quiet", () => {
-      const content = renderSerenaReaperLaunchdPlist({ homeDir });
-      expect(content).toContain("<string>oma</string>");
-      expect(content).toContain("<string>serena</string>");
-      expect(content).toContain("<string>reap</string>");
-      expect(content).toContain("<string>--quiet</string>");
+    it("runs serena reap --quiet through the oma that installed it", () => {
+      const content = renderSerenaReaperLaunchdPlist({
+        homeDir,
+        invocation: ["/opt/node/bin/node", "/opt/oma/bin/cli.js"],
+      });
+      expect(content).toContain(
+        "<array><string>/opt/node/bin/node</string><string>/opt/oma/bin/cli.js</string><string>serena</string><string>reap</string><string>--quiet</string></array>",
+      );
+      expect(content).not.toContain("/usr/bin/env");
     });
 
     it("includes PATH in EnvironmentVariables", () => {
@@ -81,9 +84,14 @@ describe("serena-reaper service-files", () => {
       expect(content).toContain("Type=oneshot");
     });
 
-    it("runs oma serena reap --quiet", () => {
-      const content = renderSerenaReaperSystemdService({ homeDir });
-      expect(content).toContain("oma serena reap --quiet");
+    it("runs serena reap --quiet through the oma that installed it", () => {
+      const content = renderSerenaReaperSystemdService({
+        homeDir,
+        invocation: ["/opt/node/bin/node", "/opt/oma/bin/cli.js"],
+      });
+      expect(content).toContain(
+        'ExecStart="/opt/node/bin/node" "/opt/oma/bin/cli.js" "serena" "reap" "--quiet"',
+      );
     });
   });
 
@@ -97,9 +105,12 @@ describe("serena-reaper service-files", () => {
       expect(content).not.toContain("<LogonTrigger>");
     });
 
-    it("runs oma serena reap --quiet", () => {
-      const content = renderSerenaReaperWindowsTaskXml();
-      expect(content).toContain("<Command>oma</Command>");
+    it("runs serena reap --quiet through the oma that installed it", () => {
+      const content = renderSerenaReaperWindowsTaskXml([
+        "C:\\node.exe",
+        "C:\\oma\\cli.js",
+      ]);
+      expect(content).toContain("<Command>C:\\node.exe</Command>");
       expect(content).toContain("serena reap --quiet");
     });
 
```

**File**: `cli/platform/serena-reaper/service-files.ts` (modified, +23/-13)
```diff
@@ -1,5 +1,14 @@
 import { join } from "node:path";
 import { servicePathEnvironment } from "../agentmemory/service-files.js";
+import {
+  currentOmaInvocation,
+  launchdProgramArguments,
+  pinnedServicePath,
+  systemdExecStart,
+  windowsTaskExec,
+} from "../oma-invocation.js";
+
+const REAP_ARGS = ["serena", "reap", "--quiet"];
 
 /**
  * Serena Reaper periodic scheduler service-file rendering.
@@ -61,25 +70,21 @@ export function serenaReaperSystemdServicePath(timerPath: string): string {
  */
 export function renderSerenaReaperLaunchdPlist(args: {
   homeDir: string;
+  invocation?: readonly string[];
 }): string {
+  const invocation = args.invocation ?? currentOmaInvocation();
   return `<?xml version="1.0" encoding="UTF-8"?>
 <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
 <plist version="1.0">
 <dict>
   <key>Label</key>
   <string>${LAUNCHD_SERENA_REAPER_LABEL}</string>
   <key>ProgramArguments</key>
-  <array>
-    <string>/usr/bin/env</string>
-    <string>oma</string>
-    <string>serena</string>
-    <string>reap</string>
-    <string>--quiet</string>
-  </array>
+  <array>${launchdProgramArguments(invocation, REAP_ARGS)}</array>
   <key>EnvironmentVariables</key>
   <dict>
     <key>PATH</key>
-    <string>${servicePathEnvironment(args.homeDir)}</string>
+    <string>${pinnedServicePath(invocation, servicePathEnvironment(args.homeDir))}</string>
   </dict>
   <key>StartInterval</key>
   <integer>${REAPER_INTERVAL_SECONDS}</integer>
@@ -117,14 +122,16 @@ WantedBy=timers.target
  */
 export function renderSerenaReaperSystemdService(args: {
   homeDir: string;
+  invocation?: readonly string[];
 }): string {
+  const invocation = args.invocation ?? currentOmaInvocation();
   return `[Unit]
 Description=OMA Serena Reaper — LSP idle-shutdown
 
 [Service]
 Type=oneshot
-Environment=PATH=${servicePathEnvironment(args.homeDir)}
-ExecStart=/usr/bin/env oma serena reap --quiet
+Environment=PATH=${pinnedServicePath(invocation, servicePathEnvironment(args.homeDir))}
+ExecStart=${systemdExecStart(invocation, REAP_ARGS)}
 StandardOutput=journal
 StandardError=journal
 `;
@@ -134,7 +141,10 @@ StandardError=journal
  * Windows Task Scheduler XML with a TimeTrigger + repetition interval.
  * Uses RepetitionInterval (PT5M) so the task repeats without needing logon.
  */
-export function renderSerenaReaperWindowsTaskXml(): string {
+export function renderSerenaReaperWindowsTaskXml(
+  invocation: readonly string[] = currentOmaInvocation(),
+): string {
+  const exec = windowsTaskExec(invocation, REAP_ARGS);
   return `<?xml version="1.0" encoding="UTF-16"?>
 <Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
   <RegistrationInfo>
@@ -165,8 +175,8 @@ export function renderSerenaReaperWindowsTaskXml(): string {
   </Settings>
   <Actions Context="Author">
     <Exec>
-      <Command>oma</Command>
-      <Arguments>serena reap --quiet</Arguments>
+      <Command>${exec.command}</Command>
+      <Arguments>${exec.arguments}</Arguments>
     </Exec>
   </Actions>
 </Task>
```

---

### Incident Patch 4: `9f3fe934` (2026-10-06)
**Commit Message**: fix(bridge): refuse a shared serena daemon outside any project

resolveProjectRoot falls back to cwd, so a client launched from / or the
home directory started a daemon indexing the whole filesystem. Reject those
roots with an actionable error instead of starting a stack for no project.

Co-Authored-By: First Fluke <[REDACTED_EMAIL]>

**File**: `cli/commands/bridge/bridge.test.ts` (modified, +12/-0)
```diff
@@ -256,6 +256,18 @@ describe("bridge command", () => {
     expect(detachClient).toHaveBeenCalled();
   });
 
+  it.each(["/", "/mock/home"])(
+    "refuses to start a shared daemon for %s outside any project",
+    async (cwd) => {
+      mockFs.existsSync.mockReturnValue(false);
+      await expect(bridge(undefined, { cwd, context: "oma" })).rejects.toThrow(
+        "outside any project",
+      );
+      expect(ensureSerenaDaemon).not.toHaveBeenCalled();
+      expect(child_process.spawn).not.toHaveBeenCalled();
+    },
+  );
+
   it.each(["ide", "codex", "claude-code", "oma-antigravity", "oma"])(
     "uses the same registry context for the managed alias %s",
     async (context) => {
```

**File**: `cli/commands/bridge/run.ts` (modified, +7/-0)
```diff
@@ -10,6 +10,7 @@ import {
   daemonKey,
   detachClient,
   ensureSerenaDaemon,
+  isUnservableProjectRoot,
   resolveProjectRoot,
   STARTUP_PROBE_TIMEOUT_MS,
 } from "../../io/serena-daemon.js";
@@ -79,6 +80,12 @@ export async function bridge(mcpUrlArg?: string, opts: BridgeOptions = {}) {
   if (explicitUrl) {
     MCP_URL = explicitUrl;
   } else {
+    if (isUnservableProjectRoot(root)) {
+      throw new Error(
+        `Shared Serena needs a project directory, but ${root} is outside any project. ` +
+          "Start the session inside a repository (a directory with .git or .serena/project.yml).",
+      );
+    }
     const runtime = context === "oma" ? prepareSerenaRuntime(root) : undefined;
     const daemon = await ensureSerenaDaemon({
       root,
```

**File**: `cli/io/serena-daemon.test.ts` (modified, +17/-1)
```diff
@@ -1,6 +1,6 @@
 import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
 import { tmpdir } from "node:os";
-import { join } from "node:path";
+import { join, resolve } from "node:path";
 import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
 // No module mocks here on purpose: the state dir has a direct test seam, and
 // mocking node:os routed this file's whole import graph through the mock
@@ -12,6 +12,7 @@ import {
   daemonKey,
   detachClient,
   ensureSerenaDaemon,
+  isUnservableProjectRoot,
   omaStateDir,
   parseRunningDaemons,
   preferredPort,
@@ -79,6 +80,21 @@ describe("resolveProjectRoot", () => {
   });
 });
 
+describe("isUnservableProjectRoot", () => {
+  it("rejects the filesystem root and the home directory", () => {
+    expect(isUnservableProjectRoot(resolve("/"), home)).toBe(true);
+    expect(isUnservableProjectRoot(home, home)).toBe(true);
+    expect(isUnservableProjectRoot(join(home, "."), home)).toBe(true);
+  });
+
+  it("accepts a project directory, including one under home", () => {
+    expect(isUnservableProjectRoot(work, home)).toBe(false);
+    expect(isUnservableProjectRoot(join(home, "workspace", "app"), home)).toBe(
+      false,
+    );
+  });
+});
+
 describe("preferredPort", () => {
   it("is stable for a key", () => {
     expect(preferredPort("x::ide")).toBe(preferredPort("x::ide"));
```

**File**: `cli/io/serena-daemon.ts` (modified, +13/-0)
```diff
@@ -208,6 +208,19 @@ export function resolveProjectRoot(cwd: string): string {
   return resolve(cwd);
 }
 
+/**
+ * True when `root` is the filesystem root or the home directory. A client
+ * started outside any project (an app launched from `/`) resolves there, and a
+ * daemon indexing it is a whole stack spent on no project at all.
+ */
+export function isUnservableProjectRoot(
+  root: string,
+  home: string = homedir(),
+): boolean {
+  const dir = resolve(root);
+  return dirname(dir) === dir || dir === resolve(home);
+}
+
 /** Port window for daemons. Wide enough that collisions are rare, bounded so probing terminates. */
 const PORT_BASE = 12341;
 const PORT_RANGE = 100;
```

---

### Incident Patch 5: `ea3b2aac` (2026-10-05)
**Commit Message**: feat(explain): bring draft rendering to full parity with its reference

Flow diagrams are laid out by dagre, so a group frame never holds a node
that is not in the group. Panel prose is parsed by remark with GFM, which
adds reference links and footnotes; the prose lint reads the same tree.

Drafts gain template: doc, a "# Title" fallback, ~~~ fences, written panel
ids, and automatic spans for wide tables and diagrams. Components gain
participant order, wide notes, dividers and numbering (sequence), org-chart
and side-by-side modes (tree), a horizontal mode (timeline), a grid with
wide rows (kv), and kinds with aliases (callout). Pages carry every theme
with a runtime switch, a three-way colour mode, and a copy-draft button.
The row planner keeps diagram scales within one band. Adds oma explain
lint and patch by panel title.

Co-authored-by: First Fluke <[REDACTED_EMAIL]>

**File**: `.agents/skills/oma-explanation/SKILL.md` (modified, +5/-3)
```diff
@@ -119,8 +119,10 @@ outputs:
    locations, await user confirmation for redacted continuation.
 4. **GENERATE**: Write the draft per `draft-format.md` and run `oma explain render`.
    Change mode: Background (two tiers), Intuition (toy data + diagrams), Code walkthrough
-   (comprehension order), Quiz, as panels in that order. Topic mode: lead answer, then 4–9
-   panels, one idea each, a diagram wherever a relation or a sequence is the point.
+   (comprehension order), Quiz, as panels in that order, with `template: doc` (linear, with
+   contents). Topic mode: lead answer, then 4–9 panels, one idea each, a diagram wherever a
+   relation or a sequence is the point; `template: sheet` for an overview, `doc` for a
+   walkthrough.
    Hand-written HTML is a fallback only for content no component can express; say so in
    the report.
 5. **VALIDATE**: Run the grep checklist from `html-contract.md` (including the final-HTML secret
@@ -165,7 +167,7 @@ outputs:
 ### Tools and instruments
 - `git`; optional `gh` (PR refs via `gh pr diff`)
 - Configured `code_intelligence` capability for surrounding-code exploration; native search only for paths outside this project or ignored paths
-- `oma explain render | components | patch | validate`
+- `oma explain render | lint | components | patch | validate`
 - `resources/draft-format.md`, `resources/document-structure.md`, `resources/html-contract.md`
 
 ### Resource scope
```

**File**: `.agents/skills/oma-explanation/resources/draft-format.md` (modified, +56/-23)
```diff
@@ -15,7 +15,9 @@ oma explain render draft.md            # → .agents/results/explain/{YYYY-MM-DD
 oma explain render - < draft.md        # draft from stdin
 oma explain components                 # list the components
 oma explain components flow            # one component's syntax and example
+oma explain lint draft.md              # prose check only, no page
 oma explain patch <page.html> --panel C panel.md   # replace one panel, keep the rest
+oma explain patch <page.html> --panel "Call order" panel.md   # or name it by title
 ```
 
 Write the draft to a scratch location (or pipe it); the HTML is the artifact, and it embeds
@@ -25,11 +27,13 @@ the draft so a later `patch` needs nothing else.
 
 ```markdown
 ---
-title: How the row planner fills a page        # required
+title: How the row planner fills a page        # required (or start the body with "# Title")
 subtitle: One sentence that says what the reader will know afterwards
 slug: row-planner                               # file name; required when the title is not ASCII
-theme: blueprint                                # blueprint (default) | card
-cols: 3                                         # grid the span hints refer to, 1-4
+template: sheet                                 # sheet = grid of panels (default) | doc = one column with contents
+theme: blueprint                                # blueprint (default) | card; the reader can switch on the page
+mode: auto                                      # auto (default) | light | dark
+cols: 3                                         # grid the span hints refer to, 1-12
 style: warn                                     # prose check: off | warn (default) | strict
 Scope: cli/commands/explain/render              # any other key shows in the header meta line
 ---
@@ -43,13 +47,22 @@ Markdown prose, lists, tables, and component blocks.
 ## Next panel
 ```
 
-- One `## ` heading starts one panel. Panels get letters A, B, C in order.
+- One `## ` heading starts one panel. Panels get letters A, B, C in order; a heading may
+  give its own (`## C Title`, `## B1 Title`), and ids must not repeat.
 - Panel attributes, all optional: `span=N` (width hint in grid columns; `span` equal to `cols`
-  keeps the panel on its own row), `note="…"` (small text at the right of the head), `bare`
-  (no head), `archify` (this panel's diagram feeds the interactive sidecar, see section 5).
+  keeps the panel on its own row), `rows=N` (height in the plain grid), `note="…"` (small text
+  at the right of the head), `bare` (no head), `archify` (this panel's diagram feeds the
+  interactive sidecar, see section 5).
 - You do not place panels. The page measures every panel and packs rows so they fill the
-  width with the least blank space, and falls back to one column on a phone.
-- Aim for 4 to 9 panels. One idea per panel: a diagram with two sentences beats a wall of text.
+  width with the least blank space, keeps the diagrams of one page at similar scales, and
+  falls back to one column on a phone. A wide table or diagram gets a wider span by itself,
+  so write `span` only for a panel that must stand out.
+- `template: sheet` suits an overview read at a glance: 4 to 9 panels. `template: doc` suits
+  a linear explanation read top to bottom; it adds a contents list from three panels up.
+- One idea per panel: a diagram with two sentences beats a wall of text.
+- Prose is GitHub-flavoured Markdown, parsed by remark: `###` headings, nested and task
+  lists, tables with alignment, quotes, rules, links (inline or reference style), footnotes. An image shows only as a `data:` URI; any other image
+  becomes a link, because the page loads nothing from outside.
 
 ## 3. Components
 
@@ -58,14 +71,14 @@ A fenced block named after a component renders that component. Any other fence
 
 | Component | Use it for | Draft content |
 | --- | --- | --- |
-| `flow` | architecture, pipelines, decisions | relations: `A -> B: label` |
-| `sequence` | calls between actors over time | `From -> To: message` |
-| `tree` | files, modules, breakdowns | indented names, `# note` |
-| `timeline` | history, phases, rollout | `when \| title \| detail` |
+| `flow` | architecture, pipelines, decisions | relations: `A -> B: label`, `group Name: A, B` |
+| `sequence` | calls between actors over time | `From -> To: message`, `note A, B: text`, `== Phase ==` |
+| `tree` | org chart, breakdown, file tree | indented names, `label \| note`, `*highlight` |
+| `timeline` | history, phases, rollout | `when \| title \| detail`, `*when` for the key event |
 | `limits` | a value against its limit | `label \| value / limit \| unit` |
-| `annot` | a command or line of code, part by part | `[span]{note}` |
-| `kv` | a few facts | `key \| value` |
-| `callout` | the one point not to miss | Markdown text |
+| `annot` | a command or line of code, part by part | `[span]{note}`, `[span]{!wrong}` |
+| `kv` | facts as a grid, or a title block | `key: value`, `* wide key: value`
```

**File**: `bun.lock` (modified, +8/-2)
```diff
@@ -17,13 +17,14 @@
     },
     "cli": {
       "name": "oh-my-agent",
-      "version": "15.0.11",
+      "version": "15.2.0",
       "bin": {
         "oh-my-agent": "./bin/cli.js",
         "oma": "./bin/cli.js",
       },
       "dependencies": {
         "@clack/prompts": "^1.7.0",
+        "@dagrejs/dagre": "^3.1.1",
         "@date-fns/tz": "^1.5.0",
         "@napi-rs/keyring": "^1.3.0",
         "axios": "^1.18.1",
@@ -40,6 +41,7 @@
         "puppeteer-core": "^25.4.0",
         "remark": "^15.0.1",
         "remark-frontmatter": "^5.0.0",
+        "remark-gfm": "^4.0.1",
         "remark-parse": "^11.0.0",
         "smol-toml": "^1.7.1",
         "unified": "^11.0.5",
@@ -63,7 +65,7 @@
     },
     "web": {
       "name": "web",
-      "version": "7.0.1",
+      "version": "7.1.0",
       "dependencies": {
         "@docusaurus/core": "3.10.2",
         "@docusaurus/faster": "3.10.2",
@@ -499,6 +501,10 @@
 
     "@csstools/utilities": ["@csstools/utilities@2.0.0", "", { "peerDependencies": { "postcss": "^8.4" } }, "sha512-5VdOr0Z71u+Yp3ozOx8T11N703wIFGVRgOWbOZMKgglPJsWA54MRIoMNVMa7shUToIhx5J8vX4sOZgD2XiihiQ=="],
 
+    "@dagrejs/dagre": ["@dagrejs/dagre@3.1.1", "", { "dependencies": { "@dagrejs/graphlib": "4.0.5" } }, "sha512-zroZB1dFOFiGgv4Xcrn1DckB1o4aOikPqD2NDQPV0WM//CXGcS6xiD0rNkqHmw6FEg4tabt4nxPLwgCWT+Vb2A=="],
+
+    "@dagrejs/graphlib": ["@dagrejs/graphlib@4.0.5", "", {}, "sha512-7xrBTqIts3o+PMUZX97wSc+7TUbW+/rULzGNCTP6yooNVDXbzw4Wutg/H/xOutTB/c/k0YqOAavgPh4/Zk9PFA=="],
+
     "@date-fns/tz": ["@date-fns/tz@1.5.0", "", {}, "sha512-lwYN/vDPeNRULcepoE/LO2Pgx+7/RV+S9ARfbc9lr2DtGkOD7pAiruHvbR1RX3Qyf6ja47EWJDMsNK5vK08DJg=="],
 
     "@discoveryjs/json-ext": ["@discoveryjs/json-ext@0.5.7", "", {}, "sha512-dBVuXR082gk3jsFp7Rd/JI4kytwGHecnCoTtXFb7DB6CNHp4rg5k1bhg0nWdLGLnOV71lmDzGQaLMy8iPLY0pw=="],
```

**File**: `cli/commands/explain/index.ts` (modified, +36/-1)
```diff
@@ -7,6 +7,7 @@ import {
 } from "../../utils/cli-framework.js";
 import {
   runExplainComponents,
+  runExplainLint,
   runExplainPatch,
   runExplainRender,
 } from "./render/command.js";
@@ -69,6 +70,10 @@ export function registerExplainCommand(program: Command): void {
       "--out <path>",
       "Output file (default: .agents/results/explain/{YYYY-MM-DD}-{slug}.html)",
     )
+    .option(
+      "--template <name>",
+      "Template: sheet (panel grid) | doc (one column with contents)",
+    )
     .option("--theme <name>", "Theme: blueprint | card")
     .option("--mode <mode>", "Colour mode: auto | light | dark")
     .option("--style <level>", "Prose check: off | warn | strict")
@@ -89,6 +94,7 @@ export function registerExplainCommand(program: Command): void {
         file: string | undefined,
         opts: {
           out?: string;
+          template?: string;
           theme?: string;
           mode?: string;
           style?: string;
@@ -113,7 +119,10 @@ export function registerExplainCommand(program: Command): void {
     .description(
       "Replace one panel of a rendered page from its embedded draft (new panel from file or stdin)",
     )
-    .requiredOption("--panel <id>", "Panel letter to replace, e.g. B")
+    .requiredOption(
+      "--panel <id>",
+      'Panel to replace: its letter (B) or its title ("Call order")',
+    )
     .option("--open", "Open the page in the browser");
   addOutputOptions(patchCmd);
   patchCmd.action(
@@ -135,6 +144,31 @@ export function registerExplainCommand(program: Command): void {
     ),
   );
 
+  const lintCmd = explain
+    .command("lint [file]")
+    .description("Check the prose of a draft (file or stdin) without rendering")
+    .option("--style <level>", "warn | strict (strict exits 1 on a warning)")
+    .option(
+      "--lang <code>",
+      "Draft language: en | ko | ja | zh (default: detected)",
+    );
+  addOutputOptions(lintCmd);
+  lintCmd.action(
+    runAction(
+      async (
+        file: string | undefined,
+        opts: { style?: string; lang?: string; json?: boolean },
+      ) => {
+        process.exitCode = runExplainLint({
+          ...opts,
+          file,
+          json: resolveJsonMode(opts),
+        });
+      },
+      { supportsJsonOutput: true },
+    ),
+  );
+
   const componentsCmd = explain
     .command("components [name]")
     .description(
@@ -155,6 +189,7 @@ export function registerExplainCommand(program: Command): void {
 
 export {
   runExplainComponents,
+  runExplainLint,
   runExplainPatch,
   runExplainRender,
 } from "./render/command.js";
```

**File**: `cli/commands/explain/render/archify.ts` (modified, +30/-0)
```diff
@@ -79,6 +79,24 @@ function fromSequence(
   const called = new Set<string>();
   const first = 170;
   const step = 30;
+  const kept = model.messages
+    .map((message, index) => ({ message, index }))
+    .filter(({ message }) => message.from !== message.to)
+    .map(({ index }) => index);
+  const segments = model.phases.flatMap((phase) => {
+    const rows = kept
+      .map((original, row) => ({ original, row }))
+      .filter(({ original }) => original >= phase.from && original <= phase.to)
+      .map(({ row }) => row);
+    if (rows.length === 0) return [];
+    return [
+      {
+        from: first + (rows[0] as number) * step - 12,
+        to: first + (rows[rows.length - 1] as number) * step + 12,
+        label: phase.label,
+      },
+    ];
+  });
   return {
     type: "sequence",
     spec: {
@@ -97,6 +115,9 @@ function fromSequence(
         type: inferComponentType(participant.label),
         label: participant.label,
       })),
+      // A phase covers the rows of its messages; self messages are gone, so
+      // phases are re-counted over the messages that remain.
+      ...(segments.length > 0 ? { segments } : {}),
       messages: messages.map((message, index) => {
         // A dashed arrow back along an earlier call is its return.
         const answers = called.has(`${message.to}>${message.from}`);
@@ -158,6 +179,15 @@ function fromFlow(
         label: node.label,
         ...(cells.get(node.id) ?? { row: 0, col: 0 }),
       })),
+      ...(model.groups.length > 0
+        ? {
+            boundaries: model.groups.map((group) => ({
+              kind: "region",
+              label: group.label,
+              wraps: group.members,
+            })),
+          }
+        : {}),
       connections: model.edges.map((edge, index) => ({
         id: `c${index + 1}`,
         from: edge.from,
```

**File**: `cli/commands/explain/render/command.ts` (modified, +60/-7)
```diff
@@ -11,21 +11,23 @@ import {
 } from "../../diagram/resolve.js";
 import { type ArchifyQuality, toArchifySpec } from "./archify.js";
 import { COMPONENTS, findComponent } from "./components/index.js";
-import { DraftError } from "./draft.js";
+import { DraftError, parseDraft } from "./draft.js";
 import { formatWarning } from "./lint.js";
 import {
   extractDraftSource,
   type PanelDiagram,
   patchDraft,
   type RenderOptions,
   type RenderResult,
+  readPageSettings,
   renderDraft,
   sidecarSource,
 } from "./render.js";
 
 export interface ExplainRenderOptions {
   file?: string;
   out?: string;
+  template?: string;
   theme?: string;
   mode?: string;
   style?: string;
@@ -243,7 +245,9 @@ function finish(
           ok: !strict,
           file: strict ? undefined : outPath,
           lang: result.lang,
+          template: result.template,
           theme: result.theme,
+          components: result.components,
           panels: result.draft.panels.map((panel) => ({
             id: panel.id,
             title: panel.title,
@@ -292,6 +296,7 @@ export async function runExplainRender(
   const label = draftLabel(opts);
   const json = opts.json === true;
   const renderOptions: RenderOptions = {
+    template: opts.template,
     theme: opts.theme,
     mode: opts.mode,
     style: opts.style,
@@ -379,13 +384,11 @@ export async function runExplainPatch(
       { file: opts.file, source: opts.source },
       cwd,
     );
-    const sidecarHref = /class="oe-archify" href="([^"]+)"/.exec(html)?.[1];
-    hadSidecar = sidecarHref !== undefined;
+    // The page keeps the look it was rendered with.
+    const settings = readPageSettings(html);
+    hadSidecar = settings.sidecarHref !== undefined;
     result = renderDraft(patchDraft(draft, opts.panel, replacement), {
-      // The page keeps the look it was rendered with.
-      theme: /data-oe-theme="([a-z]+)"/.exec(html)?.[1],
-      mode: /<html[^>]* data-theme="([a-z]+)"/.exec(html)?.[1],
-      sidecarHref,
+      ...settings,
       date: artifactDate(),
     });
   } catch (error) {
@@ -402,6 +405,56 @@ export async function runExplainPatch(
   return finish(result, htmlPath, sidecar, opts, `${opts.html} (draft)`);
 }
 
+export interface ExplainLintOptions {
+  file?: string;
+  style?: string;
+  lang?: string;
+  json?: boolean;
+  cwd?: string;
+  source?: string;
+}
+
+/** Check a draft's prose without rendering it. */
+export function runExplainLint(opts: ExplainLintOptions): number {
+  const cwd = opts.cwd ?? process.cwd();
+  const label = draftLabel(opts);
+  const json = opts.json === true;
+  try {
+    const source = readSource(opts, cwd);
+    // Rendering resolves the language and reports a malformed draft exactly
+    // as `render` would. A draft that turns its own check off is still
+    // checked here: that is what this command is for.
+    const own = parseDraft(source).meta.style;
+    const result = renderDraft(source, {
+      style: opts.style ?? (own === "off" ? "warn" : own),
+      lang: opts.lang,
+    });
+    const { warnings } = result;
+    const failed = result.style === "strict" && warnings.length > 0;
+    if (json) {
+      console.log(
+        JSON.stringify(
+          { ok: !failed, lang: result.lang, style: result.style, warnings },
+          null,
+          2,
+        ),
+      );
+    } else if (warnings.length === 0) {
+      console.log(`${color.green("✔")} ${label}: no prose warnings`);
+    } else {
+      for (const warning of warnings) {
+        console.log(color.yellow(`${label}: ${formatWarning(warning)}`));
+      }
+      console.log(
+        `${warnings.length} warning(s)${failed ? " — style: strict fails on any warning" : ""}`,
+      );
+    }
+    return failed ? 1 : 0;
+  } catch (error) {
+    return reportDraftError(error, label, json);
+  }
+}
+
 /** List the components, or print one component's syntax and example. */
 export function runExplainComponents(
   name: string | undefined,
```

**File**: `cli/commands/explain/render/components/blocks.ts` (modified, +2/-163)
```diff
@@ -1,4 +1,4 @@
-import { renderInline, renderMarkdown } from "../markdown.js";
+import { renderInline } from "../markdown.js";
 import { escapeHtml, measure } from "../text.js";
 import {
   type Component,
@@ -7,109 +7,7 @@ import {
   fields,
 } from "./types.js";
 
-// The HTML components: they wrap with the panel, so none of them can overflow.
-
-interface TreeNode {
-  name: string;
-  note?: string;
-  children: TreeNode[];
-}
-
-function treeHtml(nodes: TreeNode[]): string {
-  const items = nodes.map((node) => {
-    const folder = node.name.endsWith("/") || node.children.length > 0;
-    const note = node.note
-      ? `<span class="oe-tree-note">${renderInline(node.note)}</span>`
-      : "";
-    const children = node.children.length > 0 ? treeHtml(node.children) : "";
-    return `<li><span class="oe-tree-row"><span class="oe-tree-name${folder ? " oe-tree-dir" : ""}">${escapeHtml(node.name)}</span>${note}</span>${children}</li>`;
-  });
-  return `<ul>${items.join("")}</ul>`;
-}
-
-export const tree: Component = {
-  name: "tree",
-  summary: "Hierarchy by indentation: files, modules, breakdowns",
-  syntax: [
-    "```tree",
-    "cli/",
-    "  commands/          # note after a # is shown beside the name",
-    "    explain/",
-    "      render.ts      # entry point",
-    "```",
-    "- Two spaces per level. Names are shown as written, including <angle> text.",
-  ].join("\n"),
-  example:
-    "```tree\ncli/\n  commands/\n    explain/   # render, validate\n  utils/\n```",
-  render(text) {
-    const lines = contentLines(text);
-    if (lines.length === 0) {
-      throw new ComponentError("tree needs at least one line", 1);
-    }
-    const roots: TreeNode[] = [];
-    const stack: Array<{ indent: number; node: TreeNode }> = [];
-    for (const { text: line, indent } of lines) {
-      const cleaned = line.replace(/^[│├└─|`+\-\s]+(?=\S)/u, "");
-      const depthShift = line.length - cleaned.length;
-      const [name, ...rest] = cleaned.split(/\s+#\s+/);
-      const node: TreeNode = {
-        name: (name ?? "").trim(),
-        note: rest.join(" # ").trim() || undefined,
-        children: [],
-      };
-      const level = indent + depthShift;
-      while (
-        stack.length > 0 &&
-        (stack[stack.length - 1]?.indent ?? 0) >= level
-      ) {
-        stack.pop();
-      }
-      const parent = stack[stack.length - 1]?.node;
-      (parent ? parent.children : roots).push(node);
-      stack.push({ indent: level, node });
-    }
-    return { html: `<div class="oe-tree">${treeHtml(roots)}</div>` };
-  },
-};
-
-export const timeline: Component = {
-  name: "timeline",
-  summary: "Events in order: history, phases, a rollout",
-  syntax: [
-    "```timeline",
-    "when | title | detail (optional)",
-    "when | title*            a trailing * marks the current or key event",
-    "```",
-  ].join("\n"),
-  example:
-    "```timeline\n2023 | Prototype | one vendor\n2024 | Stable* | eleven vendors\n2025 | Next | planned\n```",
-  render(text) {
-    const rows = contentLines(text).map(({ text: line, line: at }) => {
-      const [when, rawTitle, ...detail] = fields(line);
-      if (!when || !rawTitle) {
-        throw new ComponentError(
-          `timeline line must be "when | title | detail": "${line}"`,
-          at,
-        );
-      }
-      const key = rawTitle.endsWith("*");
-      return {
-        when,
-        title: key ? rawTitle.slice(0, -1).trim() : rawTitle,
-        detail: detail.join(" | "),
-        key,
-      };
-    });
-    if (rows.length === 0) {
-      throw new ComponentError("timeline needs at least one line", 1);
-    }
-    const items = rows.map(
-      (row) =>
-        `<li${row.key ? ' class="oe-tl-key"' : ""}><span class="oe-tl-when">${escapeHtml(row.when)}</span><span class="oe-tl-body"><strong>${renderInline(row.title)}</strong>${row.detail ? `<span>${renderInline(row.detail)}</span>` : ""}</span></li>`,
-    );
-    return { html: `<ol class="oe-timeline">${items.join("")}</ol>` };
-  },
-};
+// limits, annot, quiz: HTML components, so they wrap with the panel.
 
 const NICE = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
 
@@ -294,65 +192,6 @@ export const annot: Component = {
   },
 };
 
-export const kv: Component = {
-  name: "kv",
-  summary: "Facts as key and value pairs",
-  syntax: ["```kv", "key | value", "key | value | note (optional)", "```"].join(
-    "\n",
-  ),
-  example:
-    "```kv\nInput | Markdown draft\nOutput | one HTML file | offline\n```",
-  render(text) {
-    const rows = contentLines(text).map(({ text: line, line: at }) => {
-      const [key, value, ...note] = fields(line);
-      if (!key || value === undefined) {
-        throw new ComponentError(
-          `kv line must be "key | value": "${line}"`,
-          at,
-        );
-      }
-      return `<div class="oe-kv-row"><dt>${renderInline(key)}</dt><dd>${renderInline(value)}${note.length > 0 ? `<span class="oe-kv-note">${renderInline(note.join(" | "))}</span>
```

**File**: `cli/commands/explain/render/components/flow.ts` (modified, +118/-110)
```diff
@@ -40,16 +40,23 @@ const LABEL_LINE = 14;
 const DIRECTIONS = new Set(["TB", "LR", "BT", "RL"]);
 const ALIAS_RE = /^([A-Za-z][\w-]*)\s*=\s*(.+)$/;
 const ARROW_RE = /\s*(-->|->)\s*/;
+const GROUP_RE = /^group\s+(.+?)\s*[:：]\s*(.+)$/i;
 
-/** `[(DB)]*` → label, shape, emphasis. */
+/** `*[(DB)]` or `[(DB)]*` → label, shape, emphasis. */
 function parseToken(raw: string): {
   label: string;
   shape?: Shape;
   emphasis: boolean;
 } {
   let token = raw.trim();
-  const emphasis = token.endsWith("*") && token.length > 1;
-  if (emphasis) token = token.slice(0, -1).trim();
+  let emphasis = false;
+  if (token.startsWith("*") && token.length > 1) {
+    emphasis = true;
+    token = token.slice(1).trim();
+  } else if (token.endsWith("*") && token.length > 1) {
+    emphasis = true;
+    token = token.slice(0, -1).trim();
+  }
   const wrapped = (open: string, close: string) =>
     token.startsWith(open) &&
     token.endsWith(close) &&
@@ -76,7 +83,7 @@ function splitLabel(segment: string): [string, string | undefined] {
     const char = segment[index] as string;
     if ("([{".includes(char)) depth++;
     else if (")]}".includes(char)) depth = Math.max(0, depth - 1);
-    else if (char === ":" && depth === 0) {
+    else if ((char === ":" || char === "：") && depth === 0) {
       const label = segment.slice(index + 1).trim();
       return [segment.slice(0, index).trim(), label || undefined];
     }
@@ -91,11 +98,11 @@ function sizeNode(node: FlowNode): void {
   );
   const textHeight = node.lines.length * NODE_LINE;
   if (node.shape === "diamond") {
-    node.width = Math.max(96, textWidth * 1.35 + 44);
-    node.height = textHeight + 36;
+    node.width = Math.max(96, (textWidth + 28) * 1.5);
+    node.height = (textHeight + 18) * 1.6;
   } else {
-    node.width = Math.max(64, textWidth + (node.shape === "pill" ? 36 : 28));
-    node.height = textHeight + (node.shape === "cylinder" ? 30 : 18);
+    node.width = Math.max(64, textWidth + (node.shape === "pill" ? 40 : 28));
+    node.height = textHeight + (node.shape === "cylinder" ? 32 : 18);
   }
 }
 
@@ -112,58 +119,51 @@ function nodeShape(node: FlowNode, x: number, y: number): string {
     return `<polygon class="${cls}" points="${svgRound(x)},${top} ${svgRound(x + node.width / 2)},${svgRound(y)} ${svgRound(x)},${svgRound(y + node.height / 2)} ${left},${svgRound(y)}"/>`;
   }
   if (node.shape === "cylinder") {
-    const cap = 6;
+    const cap = 7;
     const bottom = svgRound(y + node.height / 2);
-    return `<path class="${cls}" d="M${left},${top + cap} a${svgRound(node.width / 2)},${cap} 0 0 1 ${w},0 V${bottom - cap} a${svgRound(node.width / 2)},${cap} 0 0 1 -${w},0 Z"/><path class="oe-node-line" d="M${left},${top + cap} a${svgRound(node.width / 2)},${cap} 0 0 0 ${w},0" fill="none"/>`;
+    const half = svgRound(node.width / 2);
+    return `<path class="${cls}" d="M${left},${top + cap} a${half},${cap} 0 0 1 ${w},0 V${bottom - cap} a${half},${cap} 0 0 1 -${w},0 Z"/><path class="oe-node-line" d="M${left},${top + cap} a${half},${cap} 0 0 0 ${w},0" fill="none"/>`;
   }
   return `<rect class="${cls}" x="${left}" y="${top}" width="${w}" height="${h}" rx="6"/>`;
 }
 
 export const flow: Component = {
   name: "flow",
-  summary: "Boxes and arrows, laid out automatically from relations",
+  summary: "Flowchart or architecture diagram, laid out automatically",
   syntax: [
     "```flow [TB|LR|BT|RL]",
     "A -> B -> C            chain; the nodes are created on first use",
     "A -> B: label          label on the arrow",
     "A --> B                dashed arrow (async, optional, returns)",
     "A -> B & C             one arrow to each target",
-    "(Start)  {Choice?}  [(Store)]  [Box]    pill, diamond, cylinder, box",
-    "Core*                  a trailing * emphasizes the node",
+    "(Start)  {Choice?}  [(Store)]  [text with: a colon]    pill, diamond, cylinder, box",
+    "*Core                  a * before (or after) the name emphasizes the node",
     "api = [(Orders DB)]    short name for a long label",
-    "group Backend: A, B    frame around related nodes",
+    "group Backend: A, B    frame around related nodes; nothing else enters it",
     "```",
     "- Write relations only. Positions are computed; do not try to align.",
+    "- The text of a node is its identity: a later line names the node by that text alone.",
     "- Keep a label under about 20 characters and a diagram under about 12 nodes.",
   ].join("\n"),
   example:
-    "```flow LR\n(Draft) -> Parser -> Layout* -> (HTML)\nParser --> Lint: prose\ngroup oma: Parser, Layout, Lint\n```",
+    "```flow LR\n(Draft) -> Parser -> *Layout -> (HTML)\nParser --> Lint: prose\ngroup oma: Parser, Layout, Lint\n```",
   render(text, args, context) {
-    const direction = (args.split(/\s+/)[0] || "TB").toUpperCase();
-    if (!DIRECTIONS.has(direction)) {
+    const direction = (
+      /\b(TB|LR|BT|RL)\b/i.exec(args)?.[1] ?? "TB"
+    ).toUpperCase();
+    if (args.trim() && !DIREC
```

---

### Incident Patch 6: `316e372d` (2026-10-05)
**Commit Message**: docs(cli): document trajectory vendors and explain render

Co-authored-by: First Fluke <[REDACTED_EMAIL]>

**File**: `web/docs/cli-interfaces/commands.md` (modified, +8/-3)
```diff
@@ -60,7 +60,7 @@ This map keeps the long references below scannable and makes the less frequently
 | `image` | `image`, `image generate`, `image doctor`, `image vendor`, `image vendor list` |
 | `video` | `video`, `video generate`, `video doctor`, `video compose`, `video render`, `video provider`, `video provider list` |
 | `serena` | `serena`, `serena reap`, `serena reaper`, `serena reaper enable`, `serena reaper disable` |
-| `explain` | `explain`, `explain validate` |
+| `explain` | `explain`, `explain render`, `explain patch`, `explain components`, `explain validate` |
 | `diagram` | `diagram`, `diagram resolve`, `diagram update`, `diagram archify` |
 | `help` | `help` |
 | `version` | `version` |
@@ -1655,13 +1655,18 @@ oma scholar lint paper.knows.yaml
 
 ### explain
 
-`/explain` is the authoring workflow. The CLI validates already-created artifacts:
+`/explain` is the authoring workflow. The CLI renders the draft that the workflow writes and validates the result:
 
 ```
+oma explain render draft.md --archify
+oma explain components flow
+oma explain patch .agents/results/explain/2026-09-09-change.html --panel C panel.md
 oma explain validate .agents/results/explain/2026-09-09-change.html
 oma explain validate --input-dir .agents/results/explain --output json --report-file .agents/results/explain/report.json
 ```
 
+`render` turns a Markdown draft (a file, or stdin with `-`) into one self-contained HTML page at `.agents/results/explain/{YYYY-MM-DD}-{slug}.html`; `--output-file` picks another path. The draft holds content only: one panel per `## ` heading, plus component blocks (`flow`, `sequence`, `tree`, `timeline`, `limits`, `annot`, `kv`, `callout`, `quiz`). The renderer computes the diagram layout, packs the panels into rows, and applies the theme (`--theme blueprint|card`, `--mode auto|light|dark`). `--style off|warn|strict` sets the prose check, and `strict` fails the render on any warning. `--archify` derives an interactive archify diagram from a `flow` or `sequence` block and links it; when that step fails, the page is still written. `components [name]` prints the syntax of a component. `patch` replaces one panel from the draft embedded in the page.
+
 Pass a file or `--input-dir`, not both. Validation covers the self-contained HTML contract and reports machine-readable failures; it does not judge the accuracy of the explanation. See [Code Explainer](../guide/code-explainer.md).
 
 ### diagram
@@ -1695,7 +1700,7 @@ oma state archive --older-than 90d --dry-run --json
 oma state purge --older-than 90d --dry-run --json
 ```
 
-`state emit` records one L1 event with explicit category and session metadata. `state migrate` moves legacy sessions to the selected profile. `state repair` repairs malformed state files. `state decisions list` and `state inject-log list|get` inspect required decisions and injection audit entries. `state trajectory` joins a session's L1 events with the transcripts of the vendor sessions it ran on (Claude Code, Codex, Antigravity, and Grok), giving one turn-by-turn ledger of prompts, model responses, tool calls, durations, and token usage; `--open` shows it in the web dashboard at `/trajectory`. Other vendors appear with their L1 events only. Transcripts are read from `CLAUDE_CONFIG_DIR` or `~/.claude`, `CODEX_HOME` or `~/.codex`, `~/.gemini/antigravity-cli`, and `~/.grok`. `state activate`, `state archive`, and `state purge` are explicit actions; the old boolean action flags are rejected. Archive or purge only after reviewing a dry-run, because these commands change local state.
+`state emit` records one L1 event with explicit category and session metadata. `state migrate` moves legacy sessions to the selected profile. `state repair` repairs malformed state files. `state decisions list` and `state inject-log list|get` inspect required decisions and injection audit entries. `state trajectory` joins a session's L1 events with the transcripts of the vendor sessions it ran on, giving one turn-by-turn ledger of prompts, model responses, tool calls, durations, and token usage; `--open` shows it in the web dashboard at `/trajectory`. Transcripts are read from each vendor's own session store: Claude Code, Codex, Antigravity, Grok, Qwen Code, Kiro, pi, Command Code, Kimi, DeepSeek Harness, and Cursor. `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `KIMI_SHARE_DIR`, and `DSH_HOME` are honored. Kiro timestamps only prompts, and Cursor records neither timestamps nor tool results, so a Cursor transcript is shown whole instead of being cut to the session. A vendor without a readable transcript appears with its L1 events only. `state activate`, `state archive`, and `state purge` are explicit actions; the old boolean action flags are rejected. Archive or purge only after reviewing a dry-run, because these commands change local state.
 
 ### model
 
```

**File**: `web/docs/cli-interfaces/options.md` (modified, +5/-1)
```diff
@@ -77,6 +77,7 @@ Set this environment variable to `json` to force JSON output on all commands tha
 | `image generate` / `image doctor` / `image vendor list` | N/A | Yes | Use `--output json`; `vendor list` is the canonical discovery path |
 | `video generate` / `video doctor` / `video compose` / `video render` / `video provider list` | N/A | Yes | Use `--output json` for the run envelope or readiness report |
 | `explain validate` | Yes | Yes | Artifact validation report |
+| `explain render` / `explain patch` / `explain components` | Yes | Yes | Render report: file, warnings, sidecar status |
 | `diagram resolve` / `diagram update` | Yes | Yes | Engine resolution or managed-cache result |
 | `market resolve` / `market update` | Yes | Yes | Managed research-engine status |
 | `docs verify` / `docs sync` / `docs i18n` / `docs lint` | Yes | N/A | Each docs path uses its own report options |
@@ -574,6 +575,9 @@ The following matrix is generated from the checked-in public command registry. I
 | `serena reaper disable` | `--dry-run` | Uninstall the periodic Serena Reaper scheduled task |
 | `explain` | `—` | Explain artifact management and quality validation tools |
 | `explain validate` | `--input-dir <path>, --output <format>, --report-file <path>, --json` | Validate self-contained explain HTML report artifacts |
+| `explain render` | `--output-file <path>, --theme <name>, --mode <mode>, --style <level>, --lang <code>, --archify, --no-archify, --open, --output <format>, --json` | Render a Markdown draft (file or stdin) into one self-contained HTML explanation |
+| `explain patch` | `--panel <id>, --open, --output <format>, --json` | Replace one panel of a rendered page from its embedded draft |
+| `explain components` | `--output <format>, --json` | List the components a draft can use, or print one component's syntax |
 | `diagram` | `—` | Diagram engine helpers (archify interactive HTML or Mermaid fallback) |
 | `diagram resolve` | `--engine <engine>, --refresh, --offline, --json, --output <format>` | Report which diagram engine workflows should use, and where archify lives |
 | `diagram update` | `--json, --output <format>` | Download the latest archify release into oma's managed cache (~/.cache/oma-diagram/archify) |
@@ -601,7 +605,7 @@ The following matrix is generated from the checked-in public command registry. I
 | `state inject-log list` | `--entry <file>, --json, --output <format>` | List or view per-boundary inject audit logs (D52) |
 | `state inject-log get` | `--json, --output <format>` | List or view per-boundary inject audit logs (D52) |
 | `state summary` | `--category <category>, --json, --output <format>` | Export a session summary to the coordination store |
-| `state trajectory` | `--category <category>, --open, --json, --output <format>` | Show a session trajectory: L1 events joined with vendor transcripts |
+| `state trajectory` | `--category <category>, --open, --width <columns>, --sequence, --ascii, --json, --output <format>` | Show a session trajectory: L1 events joined with vendor transcripts |
 | `state heal-check` | `--agent <agentType>, --json, --output <format>` | Check whether self-healing is allowed for an agent |
 | `state activate` | `--category <category>, --archived, --all-projects, --project <project>, --search <text>, --older-than <duration>, --dry-run, --json, --output <format>` | Inspect OMA L1 workflow state |
 | `state archive` | `--category <category>, --archived, --all-projects, --project <project>, --search <text>, --older-than <duration>, --dry-run, --json, --output <format>` | Inspect OMA L1 workflow state |
```

**File**: `web/i18n/de/docusaurus-plugin-content-docs/current/cli-interfaces/commands.md` (modified, +8/-3)
```diff
@@ -60,7 +60,7 @@ Diese Übersicht hält die ausführlichen Referenzen unten überschaubar und mac
 | `image` | `image`, `image generate`, `image doctor`, `image vendor`, `image vendor list` |
 | `video` | `video`, `video generate`, `video doctor`, `video compose`, `video render`, `video provider`, `video provider list` |
 | `serena` | `serena`, `serena reap`, `serena reaper`, `serena reaper enable`, `serena reaper disable` |
-| `explain` | `explain`, `explain validate` |
+| `explain` | `explain`, `explain render`, `explain patch`, `explain components`, `explain validate` |
 | `diagram` | `diagram`, `diagram resolve`, `diagram update`, `diagram archify` |
 | `help` | `help` |
 | `version` | `version` |
@@ -1609,13 +1609,18 @@ oma scholar lint paper.knows.yaml
 
 ### explain
 
-`/explain` ist der Authoring-Workflow. Die CLI validiert bereits erstellte Artefakte:
+`/explain` ist der Workflow zum Verfassen. Die CLI rendert den Entwurf, den der Workflow schreibt, und validiert das Ergebnis:
 
 ```
+oma explain render draft.md --archify
+oma explain components flow
+oma explain patch .agents/results/explain/2026-09-09-change.html --panel C panel.md
 oma explain validate .agents/results/explain/2026-09-09-change.html
 oma explain validate --input-dir .agents/results/explain --output json --report-file .agents/results/explain/report.json
 ```
 
+`render` wandelt einen Markdown-Entwurf (eine Datei oder stdin mit `-`) in eine eigenständige HTML-Seite unter `.agents/results/explain/{YYYY-MM-DD}-{slug}.html` um; `--output-file` wählt einen anderen Pfad. Der Entwurf enthält nur Inhalt: ein Panel pro `## `-Überschrift und darin Komponentenblöcke (`flow`, `sequence`, `tree`, `timeline`, `limits`, `annot`, `kv`, `callout`, `quiz`). Der Renderer berechnet das Diagrammlayout, verteilt die Panels auf Zeilen und wendet das Theme an (`--theme blueprint|card`, `--mode auto|light|dark`). `--style off|warn|strict` legt die Textprüfung fest; bei `strict` schlägt das Rendern schon bei einer Warnung fehl. `--archify` leitet aus einem `flow`- oder `sequence`-Block ein interaktives archify-Diagramm ab und verlinkt es; schlägt dieser Schritt fehl, wird die Seite trotzdem geschrieben. `components [name]` gibt die Syntax einer Komponente aus. `patch` ersetzt ein einzelnes Panel anhand des in die Seite eingebetteten Entwurfs.
+
 Übergib entweder eine Datei oder `--input-dir`, nicht beides. Die Validierung prüft den Vertrag für eigenständiges HTML und meldet maschinenlesbare Fehler; sie bewertet nicht die inhaltliche Richtigkeit der Erklärung. Siehe [Code-Explainer](../guide/code-explainer.md).
 
 ### diagram
@@ -1649,7 +1654,7 @@ oma state archive --older-than 90d --dry-run --json
 oma state purge --older-than 90d --dry-run --json
 ```
 
-`state emit` zeichnet ein L1-Event mit expliziter Kategorie und Sitzungsmetadaten auf. `state migrate` verschiebt veraltete Sitzungen in das ausgewählte Profil. `state repair` repariert fehlerhafte Statusdateien. `state decisions list` sowie `state inject-log list|get` prüfen erforderliche Entscheidungen und Injection-Audit-Einträge. `state trajectory` verbindet die L1-Events einer Sitzung mit den Transkripten der Vendor-Sitzungen, in denen sie ausgeführt wurde (Claude Code, Codex, Antigravity und Grok). Das Ergebnis ist ein nach Turns gegliedertes Protokoll mit Prompts, Modellantworten, Tool-Aufrufen, Dauer und Token-Verbrauch; `--open` zeigt es im Web-Dashboard unter `/trajectory`. Andere Vendoren erscheinen nur mit ihren L1-Events. Transkripte werden aus `CLAUDE_CONFIG_DIR` oder `~/.claude`, `CODEX_HOME` oder `~/.codex`, `~/.gemini/antigravity-cli` und `~/.grok` gelesen. `state activate`, `state archive` und `state purge` sind explizite Aktionen; die alten booleschen Aktionsflags werden abgelehnt. Archiviere oder lösche erst nach einer Dry-Run-Prüfung, da diese Befehle den lokalen Status ändern.
+`state emit` zeichnet ein L1-Event mit expliziter Kategorie und Sitzungsmetadaten auf. `state migrate` verschiebt veraltete Sitzungen in das ausgewählte Profil. `state repair` repariert fehlerhafte Statusdateien. `state decisions list` sowie `state inject-log list|get` prüfen erforderliche Entscheidungen und Injection-Audit-Einträge. `state trajectory` verbindet die L1-Events einer Sitzung mit den Transkripten der Vendor-Sitzungen, in denen sie ausgeführt wurde. Das Ergebnis ist ein nach Turns gegliedertes Protokoll mit Prompts, Modellantworten, Tool-Aufrufen, Dauer und Token-Verbrauch; `--open` zeigt es im Web-Dashboard unter `/trajectory`. Transkripte werden aus dem Sitzungsspeicher des jeweiligen Vendors gelesen: Claude Code, Codex, Antigravity, Grok, Qwen Code, Kiro, pi, Command Code, Kimi, DeepSeek Harness und Cursor. `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `KIMI_SHARE_DIR` und `DSH_HOME` werden berücksichtigt. Kiro versieht nur Prompts mit Zeitstempeln, und Cursor zeichnet weder Zeitstempel noch Tool-Ergebnisse auf; ein Cursor-Transkript wird deshalb vollständig angezeigt statt auf die Sitzung zugeschnitten. Ein
```

**File**: `web/i18n/de/docusaurus-plugin-content-docs/current/cli-interfaces/options.md` (modified, +5/-1)
```diff
@@ -77,6 +77,7 @@ Setze diese Umgebungsvariable auf `json`, um bei allen Befehlen, die dies unters
 | `image generate` / `image doctor` / `image vendor list` | N/A | Yes | `--output json` verwenden; `vendor list` ist der kanonische Discovery-Pfad |
 | `video generate` / `video doctor` / `video compose` / `video render` / `video provider list` | N/A | Yes | `--output json` für das Laufobjekt oder den Bereitschaftsbericht verwenden |
 | `explain validate` | Yes | Yes | Validierungsbericht für Artefakte |
+| `explain render` / `explain patch` / `explain components` | Yes | Yes | Render-Bericht: Datei, Warnungen, Sidecar-Status |
 | `diagram resolve` / `diagram update` | Yes | Yes | Auflösung der Engine oder Ergebnis des verwalteten Caches |
 | `market resolve` / `market update` | Yes | Yes | Status der verwalteten Research-Engine |
 | `docs verify` / `docs sync` / `docs i18n` / `docs lint` | Yes | N/A | Jeder Docs-Pfad verwendet seine eigenen Berichtsoptionen |
@@ -575,6 +576,9 @@ Die folgende Matrix wird aus der eingecheckten öffentlichen Befehlsregistry erz
 | `serena reaper disable` | `--dry-run` | Periodische geplante Serena-Reaper-Aufgabe deinstallieren |
 | `explain` | `—` | Werkzeuge für Artefaktverwaltung und Qualitätsvalidierung erklären |
 | `explain validate` | `--input-dir <path>, --output <format>, --report-file <path>, --json` | Eigenständige Explain-HTML-Berichtsartefakte validieren |
+| `explain render` | `--output-file <path>, --theme <name>, --mode <mode>, --style <level>, --lang <code>, --archify, --no-archify, --open, --output <format>, --json` | Rendert einen Markdown-Entwurf (Datei oder stdin) zu einer eigenständigen HTML-Erklärseite |
+| `explain patch` | `--panel <id>, --open, --output <format>, --json` | Ersetzt ein Panel einer gerenderten Seite anhand des eingebetteten Entwurfs |
+| `explain components` | `--output <format>, --json` | Listet die Komponenten für Entwürfe auf oder gibt die Syntax einer Komponente aus |
 | `diagram` | `—` | Hilfsfunktionen für Diagramm-Engines (interaktives archify-HTML oder Mermaid-Fallback) |
 | `diagram resolve` | `--engine <engine>, --refresh, --offline, --json, --output <format>` | Melden, welche Diagramm-Engine Workflows verwenden sollen und wo archify liegt |
 | `diagram update` | `--json, --output <format>` | Die neueste archify-Version in den verwalteten oma-Cache (`~/.cache/oma-diagram/archify`) laden |
@@ -602,7 +606,7 @@ Die folgende Matrix wird aus der eingecheckten öffentlichen Befehlsregistry erz
 | `state inject-log list` | `--entry <file>, --json, --output <format>` | Injection-Audit-Logs pro Grenze auflisten oder anzeigen (D52) |
 | `state inject-log get` | `--json, --output <format>` | Injection-Audit-Logs pro Grenze auflisten oder anzeigen (D52) |
 | `state summary` | `--category <category>, --json, --output <format>` | Eine Sitzungszusammenfassung in den Coordination Store exportieren |
-| `state trajectory` | `--category <category>, --open, --json, --output <format>` | Eine Sitzungstrajektorie anzeigen: L1-Events, verbunden mit Vendor-Transkripten |
+| `state trajectory` | `--category <category>, --open, --width <columns>, --sequence, --ascii, --json, --output <format>` | Eine Sitzungstrajektorie anzeigen: L1-Events, verbunden mit Vendor-Transkripten |
 | `state heal-check` | `--agent <agentType>, --json, --output <format>` | Prüfen, ob Self-Healing für einen Agenten zulässig ist |
 | `state activate` | `--category <category>, --archived, --all-projects, --project <project>, --search <text>, --older-than <duration>, --dry-run, --json, --output <format>` | OMA-L1-Workflowstatus prüfen |
 | `state archive` | `--category <category>, --archived, --all-projects, --project <project>, --search <text>, --older-than <duration>, --dry-run, --json, --output <format>` | OMA-L1-Workflowstatus prüfen |
```

**File**: `web/i18n/es/docusaurus-plugin-content-docs/current/cli-interfaces/commands.md` (modified, +8/-3)
```diff
@@ -60,7 +60,7 @@ Este mapa facilita recorrer las referencias extensas de abajo y descubrir las fa
 | `image` | `image`, `image generate`, `image doctor`, `image vendor`, `image vendor list` |
 | `video` | `video`, `video generate`, `video doctor`, `video compose`, `video render`, `video provider`, `video provider list` |
 | `serena` | `serena`, `serena reap`, `serena reaper`, `serena reaper enable`, `serena reaper disable` |
-| `explain` | `explain`, `explain validate` |
+| `explain` | `explain`, `explain render`, `explain patch`, `explain components`, `explain validate` |
 | `diagram` | `diagram`, `diagram resolve`, `diagram update`, `diagram archify` |
 | `help` | `help` |
 | `version` | `version` |
@@ -1655,13 +1655,18 @@ oma scholar lint paper.knows.yaml
 
 ### explain {#explain}
 
-`/explain` es el workflow de autoría. El CLI valida artefactos ya creados:
+`/explain` es el flujo de trabajo de autoría. La CLI renderiza el borrador que escribe el flujo y valida el resultado:
 
 ```
+oma explain render draft.md --archify
+oma explain components flow
+oma explain patch .agents/results/explain/2026-09-09-change.html --panel C panel.md
 oma explain validate .agents/results/explain/2026-09-09-change.html
 oma explain validate --input-dir .agents/results/explain --output json --report-file .agents/results/explain/report.json
 ```
 
+`render` convierte un borrador en Markdown (un archivo, o stdin con `-`) en una página HTML autocontenida en `.agents/results/explain/{YYYY-MM-DD}-{slug}.html`; `--output-file` elige otra ruta. El borrador solo contiene contenido: un panel por cada encabezado `## ` y, dentro, bloques de componentes (`flow`, `sequence`, `tree`, `timeline`, `limits`, `annot`, `kv`, `callout`, `quiz`). El renderizador calcula la disposición de los diagramas, reparte los paneles en filas y aplica el tema (`--theme blueprint|card`, `--mode auto|light|dark`). `--style off|warn|strict` fija la revisión de la prosa; con `strict`, una sola advertencia hace fallar el renderizado. `--archify` genera un diagrama interactivo de archify a partir de un bloque `flow` o `sequence` y lo enlaza; si ese paso falla, la página se escribe igualmente. `components [name]` muestra la sintaxis de un componente. `patch` sustituye un solo panel usando el borrador incrustado en la página.
+
 Pasa un archivo o `--input-dir`, pero no ambos. La validación cubre el contrato HTML autocontenido e informa de fallos legibles por máquina; no juzga la precisión de la explicación. Consulta [Explicador de código](../guide/code-explainer.md).
 
 ### diagram {#diagram}
@@ -1695,7 +1700,7 @@ oma state archive --older-than 90d --dry-run --json
 oma state purge --older-than 90d --dry-run --json
 ```
 
-`state emit` registra un evento L1 con categoría y metadatos de sesión explícitos. `state migrate` mueve las sesiones legacy al perfil seleccionado. `state repair` repara los archivos de estado malformados. `state decisions list` y `state inject-log list|get` inspeccionan las decisiones requeridas y las entradas de auditoría de inyección. `state trajectory` combina los eventos L1 de una sesión con las transcripciones de las sesiones de proveedor en las que se ejecutó (Claude Code, Codex, Antigravity y Grok). El resultado es un único registro, turno a turno, de prompts, respuestas del modelo, llamadas a herramientas, duraciones y uso de tokens; `--open` lo muestra en el dashboard web, en `/trajectory`. Los demás proveedores aparecen solo con sus eventos L1. Las transcripciones se leen de `CLAUDE_CONFIG_DIR` o `~/.claude`, `CODEX_HOME` o `~/.codex`, `~/.gemini/antigravity-cli` y `~/.grok`. `state activate`, `state archive` y `state purge` son acciones explícitas; los antiguos flags booleanos de acción se rechazan. Archiva o purga solo después de revisar un dry-run, porque estos comandos cambian el estado local.
+`state emit` registra un evento L1 con categoría y metadatos de sesión explícitos. `state migrate` mueve las sesiones legacy al perfil seleccionado. `state repair` repara los archivos de estado malformados. `state decisions list` y `state inject-log list|get` inspeccionan las decisiones requeridas y las entradas de auditoría de inyección. `state trajectory` combina los eventos L1 de una sesión con las transcripciones de las sesiones de proveedor en las que se ejecutó. El resultado es un único registro, turno a turno, de prompts, respuestas del modelo, llamadas a herramientas, duraciones y uso de tokens; `--open` lo muestra en el dashboard web, en `/trajectory`. Las transcripciones se leen del almacén de sesiones de cada proveedor: Claude Code, Codex, Antigravity, Grok, Qwen Code, Kiro, pi, Command Code, Kimi, DeepSeek Harness y Cursor. Se respetan `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `KIMI_SHARE_DIR` y `DSH_HOME`. Kiro solo registra la hora de los prompts, y Cursor no registra ni horas ni resultados de herramientas, por lo que una transcripción de Cursor se muestra completa en lugar de recortarse a la sesión. Un proveedor sin transcripción l
```

**File**: `web/i18n/es/docusaurus-plugin-content-docs/current/cli-interfaces/options.md` (modified, +5/-1)
```diff
@@ -77,6 +77,7 @@ Establece esta variable de entorno en `json` para forzar la salida JSON en todos
 | `image generate` / `image doctor` / `image vendor list` | N/A | Sí | Usa `--output json`; `vendor list` es la ruta canónica de descubrimiento |
 | `video generate` / `video doctor` / `video compose` / `video render` / `video provider list` | N/A | Sí | Usa `--output json` para el envoltorio de ejecución o el informe de disponibilidad |
 | `explain validate` | Sí | Sí | Informe de validación del artefacto |
+| `explain render` / `explain patch` / `explain components` | Sí | Sí | Informe de renderizado: archivo, advertencias, estado del sidecar |
 | `diagram resolve` / `diagram update` | Sí | Sí | Resolución del motor o resultado de la caché gestionada |
 | `market resolve` / `market update` | Sí | Sí | Estado del motor de investigación gestionado |
 | `docs verify` / `docs sync` / `docs i18n` / `docs lint` | Sí | N/A | Cada ruta de docs usa sus propias opciones de informe |
@@ -574,6 +575,9 @@ La siguiente matriz se genera a partir del registro público de comandos incluid
 | `serena reaper disable` | `--dry-run` | Desinstala la tarea programada periódica de Serena Reaper |
 | `explain` | `—` | Explica las herramientas de gestión de artefactos y validación de calidad |
 | `explain validate` | `--input-dir <path>, --output <format>, --report-file <path>, --json` | Valida artefactos de informes HTML de explain autocontenidos |
+| `explain render` | `--output-file <path>, --theme <name>, --mode <mode>, --style <level>, --lang <code>, --archify, --no-archify, --open, --output <format>, --json` | Renderiza un borrador Markdown (archivo o stdin) como una página HTML explicativa autocontenida |
+| `explain patch` | `--panel <id>, --open, --output <format>, --json` | Sustituye un panel de una página renderizada usando su borrador incrustado |
+| `explain components` | `--output <format>, --json` | Lista los componentes disponibles para un borrador o muestra la sintaxis de uno |
 | `diagram` | `—` | Ayudantes del motor de diagramas (HTML interactivo de archify o fallback a Mermaid) |
 | `diagram resolve` | `--engine <engine>, --refresh, --offline, --json, --output <format>` | Informa de qué motor de diagramas deben usar los workflows y dónde está archify |
 | `diagram update` | `--json, --output <format>` | Descarga la versión más reciente de archify en la caché gestionada de oma (~/.cache/oma-diagram/archify) |
@@ -601,7 +605,7 @@ La siguiente matriz se genera a partir del registro público de comandos incluid
 | `state inject-log list` | `--entry <file>, --json, --output <format>` | Enumera o muestra registros de auditoría de inject por frontera (D52) |
 | `state inject-log get` | `--json, --output <format>` | Enumera o muestra registros de auditoría de inject por frontera (D52) |
 | `state summary` | `--category <category>, --json, --output <format>` | Exporta un resumen de sesión al almacén de coordinación |
-| `state trajectory` | `--category <category>, --open, --json, --output <format>` | Muestra la trayectoria de una sesión: eventos L1 combinados con las transcripciones del proveedor |
+| `state trajectory` | `--category <category>, --open, --width <columns>, --sequence, --ascii, --json, --output <format>` | Muestra la trayectoria de una sesión: eventos L1 combinados con las transcripciones del proveedor |
 | `state heal-check` | `--agent <agentType>, --json, --output <format>` | Comprueba si se permite la autorreparación para un agente |
 | `state activate` | `--category <category>, --archived, --all-projects, --project <project>, --search <text>, --older-than <duration>, --dry-run, --json, --output <format>` | Inspecciona el estado de workflow L1 de OMA |
 | `state archive` | `--category <category>, --archived, --all-projects, --project <project>, --search <text>, --older-than <duration>, --dry-run, --json, --output <format>` | Inspecciona el estado de workflow L1 de OMA |
```

**File**: `web/i18n/fr/docusaurus-plugin-content-docs/current/cli-interfaces/commands.md` (modified, +8/-3)
```diff
@@ -60,7 +60,7 @@ Cette carte permet de parcourir plus facilement les références détaillées ci
 | `image` | `image`, `image generate`, `image doctor`, `image vendor`, `image vendor list` |
 | `video` | `video`, `video generate`, `video doctor`, `video compose`, `video render`, `video provider`, `video provider list` |
 | `serena` | `serena`, `serena reap`, `serena reaper`, `serena reaper enable`, `serena reaper disable` |
-| `explain` | `explain`, `explain validate` |
+| `explain` | `explain`, `explain render`, `explain patch`, `explain components`, `explain validate` |
 | `diagram` | `diagram`, `diagram resolve`, `diagram update`, `diagram archify` |
 | `help` | `help` |
 | `version` | `version` |
@@ -1609,13 +1609,18 @@ oma scholar lint paper.knows.yaml
 
 ### explain
 
-`/explain` est le workflow d’écriture. Le CLI valide les artefacts déjà créés :
+`/explain` est le workflow de rédaction. La CLI effectue le rendu du brouillon écrit par le workflow et valide le résultat :
 
 ```
+oma explain render draft.md --archify
+oma explain components flow
+oma explain patch .agents/results/explain/2026-09-09-change.html --panel C panel.md
 oma explain validate .agents/results/explain/2026-09-09-change.html
 oma explain validate --input-dir .agents/results/explain --output json --report-file .agents/results/explain/report.json
 ```
 
+`render` transforme un brouillon Markdown (un fichier, ou stdin avec `-`) en une page HTML autonome enregistrée dans `.agents/results/explain/{YYYY-MM-DD}-{slug}.html` ; `--output-file` indique un autre chemin. Le brouillon ne contient que le contenu : un panneau par titre `## ` et, à l’intérieur, des blocs de composants (`flow`, `sequence`, `tree`, `timeline`, `limits`, `annot`, `kv`, `callout`, `quiz`). Le moteur de rendu calcule la disposition des diagrammes, répartit les panneaux en lignes et applique le thème (`--theme blueprint|card`, `--mode auto|light|dark`). `--style off|warn|strict` règle la vérification du texte ; avec `strict`, un seul avertissement fait échouer le rendu. `--archify` dérive un diagramme archify interactif d’un bloc `flow` ou `sequence` et ajoute le lien ; si cette étape échoue, la page est tout de même écrite. `components [name]` affiche la syntaxe d’un composant. `patch` remplace un seul panneau à partir du brouillon intégré à la page.
+
 Passez un fichier ou `--input-dir`, jamais les deux. La validation couvre le contrat HTML autonome et signale les échecs lisibles par machine ; elle n’évalue pas l’exactitude de l’explication. Voir [Explicateur de code](../guide/code-explainer.md).
 
 ### diagram
@@ -1649,7 +1654,7 @@ oma state archive --older-than 90d --dry-run --json
 oma state purge --older-than 90d --dry-run --json
 ```
 
-`state emit` enregistre un événement L1 avec une catégorie et des métadonnées de session explicites. `state migrate` déplace les sessions historiques vers le profil sélectionné. `state repair` répare les fichiers d’état malformés. `state decisions list` et `state inject-log list|get` inspectent les décisions obligatoires et les entrées d’audit des injections. `state trajectory` associe les événements L1 d’une session aux transcriptions des sessions des fournisseurs dans lesquelles elle s’est exécutée (Claude Code, Codex, Antigravity et Grok). Le résultat est un journal unique, tour par tour, des prompts, des réponses du modèle, des appels d’outils, des durées et de l’utilisation des tokens ; `--open` l’affiche dans le tableau de bord web, à l’adresse `/trajectory`. Les autres fournisseurs n’apparaissent qu’avec leurs événements L1. Les transcriptions sont lues depuis `CLAUDE_CONFIG_DIR` ou `~/.claude`, `CODEX_HOME` ou `~/.codex`, `~/.gemini/antigravity-cli` et `~/.grok`. `state activate`, `state archive` et `state purge` sont des actions explicites ; les anciens indicateurs booléens sont rejetés. N’archivez ou ne purgez qu’après examen d’un dry-run, car ces commandes modifient l’état local.
+`state emit` enregistre un événement L1 avec une catégorie et des métadonnées de session explicites. `state migrate` déplace les sessions historiques vers le profil sélectionné. `state repair` répare les fichiers d’état malformés. `state decisions list` et `state inject-log list|get` inspectent les décisions obligatoires et les entrées d’audit des injections. `state trajectory` associe les événements L1 d’une session aux transcriptions des sessions des fournisseurs dans lesquelles elle s’est exécutée. Le résultat est un journal unique, tour par tour, des prompts, des réponses du modèle, des appels d’outils, des durées et de l’utilisation des tokens ; `--open` l’affiche dans le tableau de bord web, à l’adresse `/trajectory`. Les transcriptions sont lues dans le stockage de sessions de chaque fournisseur : Claude Code, Codex, Antigravity, Grok, Qwen Code, Kiro, pi, Command Code, Kimi, DeepSeek Harness et Cursor. `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `KIMI_SHARE_DIR` et `DSH_HOME` sont pris en compte. Kiro n’horodate que les prompts, et Cursor n’enre
```

**File**: `web/i18n/fr/docusaurus-plugin-content-docs/current/cli-interfaces/options.md` (modified, +5/-1)
```diff
@@ -77,6 +77,7 @@ Définissez cette variable d’environnement à `json` pour forcer une sortie JS
 | `image generate` / `image doctor` / `image vendor list` | N/A | Oui | Utilisez `--output json` ; `vendor list` est le chemin canonique de découverte |
 | `video generate` / `video doctor` / `video compose` / `video render` / `video provider list` | N/A | Oui | Utilisez `--output json` pour l’enveloppe d’exécution ou le rapport de disponibilité |
 | `explain validate` | Oui | Oui | Rapport de validation de l’artefact |
+| `explain render` / `explain patch` / `explain components` | Oui | Oui | Rapport de rendu : fichier, avertissements, état du sidecar |
 | `diagram resolve` / `diagram update` | Oui | Oui | Résolution du moteur ou résultat du cache géré |
 | `market resolve` / `market update` | Oui | Oui | État du moteur de recherche géré |
 | `docs verify` / `docs sync` / `docs i18n` / `docs lint` | Oui | N/A | Chaque chemin docs possède ses propres options de rapport |
@@ -575,6 +576,9 @@ La matrice suivante est générée depuis le registre public des commandes prés
 | `serena reaper disable` | `--dry-run` | Désinstalle la tâche planifiée périodique du reaper Serena |
 | `explain` | `—` | Gestion et validation qualité des artefacts d’explication |
 | `explain validate` | `--input-dir <path>, --output <format>, --report-file <path>, --json` | Valide les artefacts HTML autonomes de rapports explain |
+| `explain render` | `--output-file <path>, --theme <name>, --mode <mode>, --style <level>, --lang <code>, --archify, --no-archify, --open, --output <format>, --json` | Effectue le rendu d’un brouillon Markdown (fichier ou stdin) en une page HTML explicative autonome |
+| `explain patch` | `--panel <id>, --open, --output <format>, --json` | Remplace un panneau d’une page rendue à partir de son brouillon intégré |
+| `explain components` | `--output <format>, --json` | Liste les composants utilisables dans un brouillon ou affiche la syntaxe de l’un d’eux |
 | `diagram` | `—` | Assistants de moteur de diagrammes (HTML interactif archify ou repli Mermaid) |
 | `diagram resolve` | `--engine <engine>, --refresh, --offline, --json, --output <format>` | Signale le moteur de diagrammes à utiliser par les workflows et l’emplacement d’archify |
 | `diagram update` | `--json, --output <format>` | Télécharge la dernière version archify dans le cache géré d’oma (~/.cache/oma-diagram/archify) |
@@ -602,7 +606,7 @@ La matrice suivante est générée depuis le registre public des commandes prés
 | `state inject-log list` | `--entry <file>, --json, --output <format>` | Liste ou affiche les journaux d’audit d’injection par frontière (D52) |
 | `state inject-log get` | `--json, --output <format>` | Liste ou affiche les journaux d’audit d’injection par frontière (D52) |
 | `state summary` | `--category <category>, --json, --output <format>` | Exporte un résumé de session vers le magasin de coordination |
-| `state trajectory` | `--category <category>, --open, --json, --output <format>` | Affiche la trajectoire d’une session : événements L1 associés aux transcriptions des fournisseurs |
+| `state trajectory` | `--category <category>, --open, --width <columns>, --sequence, --ascii, --json, --output <format>` | Affiche la trajectoire d’une session : événements L1 associés aux transcriptions des fournisseurs |
 | `state heal-check` | `--agent <agentType>, --json, --output <format>` | Vérifie si l’auto-réparation est autorisée pour un agent |
 | `state activate` | `--category <category>, --archived, --all-projects, --project <project>, --search <text>, --older-than <duration>, --dry-run, --json, --output <format>` | Inspecte l’état de workflow OMA L1 |
 | `state archive` | `--category <category>, --archived, --all-projects, --project <project>, --search <text>, --older-than <duration>, --dry-run, --json, --output <format>` | Inspecte l’état de workflow OMA L1 |
```

---

### Incident Patch 7: `ad247797` (2026-10-05)
**Commit Message**: feat(explain): render markdown drafts into self-contained html

Add oma explain render, components, and patch. A draft holds panels and a
closed set of components (flow, sequence, tree, timeline, limits, annot, kv,
callout, quiz); the renderer owns layout, themes, the panel row planner, and
a prose check. --archify derives an archify sidecar from a flow or sequence
block. The oma-explanation skill gains a topic mode and authors through
drafts.

Co-authored-by: First Fluke <[REDACTED_EMAIL]>

**File**: `.agents/skills/oma-explanation/SKILL.md` (modified, +42/-19)
```diff
@@ -1,29 +1,38 @@
 ---
 name: oma-explanation
-description: "Create an offline HTML explanation of a code diff, PR, or branch. Use when an interactive code-change walkthrough is requested."
+description: "Create an offline HTML explanation of a code change (diff, PR, branch) or of a topic, system, or question. Use when a visual walkthrough document is requested."
 ---
 
-# oma-explanation — Interactive HTML Code-Change Explainer
+# oma-explanation — Interactive HTML Explainer
 
 ## Scheduling
 
 ### Goal
-Generate an educational, self-contained interactive HTML document that explains a code change to
-a reader — deep skippable background for newcomers, core intuition with toy data, a comprehension-
-ordered code walkthrough, and a five-question quiz — saved under `.agents/results/explain/` and
-validated against a deterministic checklist.
+Generate an educational, self-contained interactive HTML document, saved under
+`.agents/results/explain/` and validated against a deterministic checklist. Two modes:
+
+- **Change mode** — explains a code change: deep skippable background for newcomers, core
+  intuition with toy data, a comprehension-ordered code walkthrough, and a five-question quiz.
+- **Topic mode** — explains a concept, a system, or the answer to a question as a one-page
+  visual sheet: lead answer, then panels of diagrams, tables, and short prose.
+
+In both modes the model writes a Markdown **draft** and `oma explain render` produces the HTML.
+Layout, theme, diagram geometry, and the quiz script are the renderer's, not the model's.
 
 ### Intent signature
 - User invokes `/explain`, names this skill, or asks for a rich explanation/walkthrough of a
   diff, PR, branch, or commit range (설명서, 해설, コード解説, 代码讲解).
-- Another skill or workflow delegates "explain this change as a document" output.
+- User asks for a visual / HTML explanation of a topic that is not a diff: how a system works,
+  a comparison, an answer worth keeping as a page (`/explain how does the row planner work`).
+- Another skill or workflow delegates "explain this as a document" output.
 - Activation is slash/explicit/delegated only — this skill is intentionally excluded from
   keyword auto-detection ("explain" is everyday vocabulary; `convert` precedent).
 
 ### When to use
 - Explaining a PR, branch, commit range, or the current staged/unstaged change as a document
 - Onboarding a teammate onto a change they did not write
 - Producing a reviewable teaching artifact after a large or subtle change lands
+- Turning an architecture, a protocol, a comparison, or a long answer into one visual page
 
 ### When NOT to use
 - Narrated explainer *video* → use `oma-video` (explainer mode); this skill produces HTML documents
@@ -33,7 +42,11 @@ validated against a deterministic checklist.
   skill narrates a change educationally, it does not evaluate it
 
 ### Expected inputs
-- **Target ref**, resolved in this order:
+- **Mode**: `topic` when the request names a subject and no ref resolves from it; otherwise
+  `change`. An explicit ref always means change mode.
+- **Topic** (topic mode): the question or subject, plus the code or docs it is about. Explore
+  them first; a topic page states facts from the repository, not from memory.
+- **Target ref** (change mode), resolved in this order:
   1. Explicit argument — PR number (`#640`, via `gh pr diff`), branch (`git diff main...{branch}`),
      or SHA range (`a..b` / `a...b`)
   2. Staged changes (`git diff --cached`)
@@ -65,7 +78,8 @@ outputs:
 ```
 
 ### Dependencies
-- `resources/document-structure.md` — WHAT the document contains (sections, diagrams, style)
+- `resources/draft-format.md` — the draft you write and the `oma explain render` commands
+- `resources/document-structure.md` — WHAT a change explainer contains (sections, diagrams, style)
 - `resources/html-contract.md` — HOW the HTML behaves and is validated (self-contained rules,
   quiz JS, grep checklist, secret gates)
 - `git`; optional `gh` CLI for PR refs
@@ -84,13 +98,16 @@ outputs:
   sidecar as incomplete.
 - Oversized diffs: lockfiles/generated files excluded automatically, remaining diff grouped per
   file; exclusions listed in the provenance footer (never silent).
+- Render errors name the draft line and print the failing component's syntax; fix that line
+  and re-render. Prose warnings are fixed by rewriting, not by `style: off`.
 - Validation is supported via the `oma explain validate [file]` CLI command (and deterministic grep checklist in `html-contract.md`).
 
 ## Structural Flow
 
 ### Entry
 1. Resolve the target ref via the Expected-inputs order; never guess an alternative ref.
-2. Read `resources/document-structure.md` and `resources/html-contract.md` before generating.
+2. Read `resources/draft-format.md` before generating; in change mode also
+   `resources/document-structure.md` and `resources/html-contract.md`.
 3. Determine reader level, output language, and quiz count.
 
 ### Scenes
@@ -100,15 +117,19 
```

**File**: `.agents/skills/oma-explanation/resources/document-structure.md` (modified, +6/-0)
```diff
@@ -4,6 +4,12 @@
 > Read this document to understand WHAT content is generated and in what tone.
 > For HOW the HTML is styled and behaves, see `html-contract.md`.
 
+> **Authoring path**: write a draft and render it with `oma explain render` (see
+> `draft-format.md`). The four sections below become panels in the same order; the renderer
+> supplies the page shell, so the TOC and diagram-markup rules in sections 1 and 6 apply
+> literally only to the hand-written HTML fallback. Topic-mode pages follow `draft-format.md`
+> and are not bound to the four sections.
+
 ---
 
 ## 1. Overall Shape
```

**File**: `.agents/skills/oma-explanation/resources/draft-format.md` (added, +166/-0)
```diff
@@ -0,0 +1,166 @@
+# Draft Format — `oma explain render`
+
+> The authoring contract for explanations. You write a Markdown draft; `oma explain render`
+> turns it into the HTML page. You never write HTML, CSS, SVG, or coordinates.
+> For WHAT a change explainer must contain, see `document-structure.md`.
+
+## 1. Why a draft
+
+Layout, theme, diagram geometry, responsiveness, escaping, and the quiz script are the
+renderer's job. They are the same on every page and they are tested. Your job is the content:
+which panels exist, what each one says, and which relations a diagram shows.
+
+```bash
+oma explain render draft.md            # → .agents/results/explain/{YYYY-MM-DD}-{slug}.html
+oma explain render - < draft.md        # draft from stdin
+oma explain components                 # list the components
+oma explain components flow            # one component's syntax and example
+oma explain patch <page.html> --panel C panel.md   # replace one panel, keep the rest
+```
+
+Write the draft to a scratch location (or pipe it); the HTML is the artifact, and it embeds
+the draft so a later `patch` needs nothing else.
+
+## 2. Shape of a draft
+
+```markdown
+---
+title: How the row planner fills a page        # required
+subtitle: One sentence that says what the reader will know afterwards
+slug: row-planner                               # file name; required when the title is not ASCII
+theme: blueprint                                # blueprint (default) | card
+cols: 3                                         # grid the span hints refer to, 1-4
+style: warn                                     # prose check: off | warn (default) | strict
+Scope: cli/commands/explain/render              # any other key shows in the header meta line
+---
+
+One or two lead sentences: the answer first.
+
+## Panel title {span=2 note="12 nodes"}
+
+Markdown prose, lists, tables, and component blocks.
+
+## Next panel
+```
+
+- One `## ` heading starts one panel. Panels get letters A, B, C in order.
+- Panel attributes, all optional: `span=N` (width hint in grid columns; `span` equal to `cols`
+  keeps the panel on its own row), `note="…"` (small text at the right of the head), `bare`
+  (no head), `archify` (this panel's diagram feeds the interactive sidecar, see section 5).
+- You do not place panels. The page measures every panel and packs rows so they fill the
+  width with the least blank space, and falls back to one column on a phone.
+- Aim for 4 to 9 panels. One idea per panel: a diagram with two sentences beats a wall of text.
+
+## 3. Components
+
+A fenced block named after a component renders that component. Any other fence
+(`ts`, `bash`, `json`, …) is shown as code; `diff` colours added and removed lines.
+
+| Component | Use it for | Draft content |
+| --- | --- | --- |
+| `flow` | architecture, pipelines, decisions | relations: `A -> B: label` |
+| `sequence` | calls between actors over time | `From -> To: message` |
+| `tree` | files, modules, breakdowns | indented names, `# note` |
+| `timeline` | history, phases, rollout | `when \| title \| detail` |
+| `limits` | a value against its limit | `label \| value / limit \| unit` |
+| `annot` | a command or line of code, part by part | `[span]{note}` |
+| `kv` | a few facts | `key \| value` |
+| `callout` | the one point not to miss | Markdown text |
+| `quiz` | comprehension check | `? question`, `- wrong`, `+ right`, `> feedback` |
+
+Run `oma explain components <name>` for the exact grammar before the first use in a session.
+The essentials:
+
+````markdown
+```flow LR
+(User) -> API -> Service* -> [(Orders DB)]
+Service --> Queue: order.created
+{Valid?} -> Service: yes
+group Backend: API, Service
+```
+````
+
+- `->` solid, `-->` dashed. A chain creates its nodes. `A -> B & C` fans out.
+- Shapes: `(pill)` for actors and endpoints, `{diamond}` for decisions, `[(cylinder)]` for
+  stores, plain text or `[box]` for everything else. A trailing `*` marks the node the
+  panel is about. `name = Long label` gives a long label a short name.
+- Write relations only. Do not order lines to "place" nodes, and never use ASCII art.
+- Keep a diagram under about 12 nodes and labels under about 20 characters. Split it otherwise.
+- Put example data on the arrows (`: {sid, kind}`) when the data is the point.
+
+````markdown
+```sequence
+Client -> Server: SYN
+Server --> Client: SYN-ACK
+note Server: half-open until the ACK arrives
+```
+````
+
+Tables: a cell that starts with `ok`, `no`, or `warn` becomes a status badge
+(`| Retry | ok idempotent |`). Use this for comparisons and before/after tables.
+
+Text is always shown as written. `<sid>`, `<T>`, and HTML in a draft appear as characters;
+nothing in a draft can inject markup.
+
+## 4. Writing
+
+The renderer checks the prose (`style: warn` prints warnings, `strict` fails the render):
+
+- One fact per sentence. English: at most 25 words (20 in a numbered step). Korean: about
+  70 characters. Japanese 65, Chinese 45. At most
```

**File**: `.agents/skills/oma-explanation/resources/html-contract.md` (modified, +6/-0)
```diff
@@ -2,6 +2,12 @@
 
 This resource specifies HOW the generated HTML file behaves and is validated. For content requirements, refer to the sibling `document-structure.md` file.
 
+> Pages made by `oma explain render` meet sections 1–5 by construction (inline CSS and
+> script under a `default-src 'none'` policy, `<pre>` code, light/dark themes, shuffled quiz
+> with per-option feedback). For those pages this contract reduces to section 6
+> (`oma explain validate`) and section 7 (secret gates). Sections 1–5 remain the rules for
+> hand-written HTML.
+
 ## 1. Self-contained Rule
 The generated HTML file MUST make ZERO external resource loads.
 - No CDN scripts or stylesheets.
```

**File**: `.agents/workflows/explain.md` (modified, +23/-10)
```diff
@@ -1,6 +1,6 @@
 ---
 name: explain
-description: Drive a diff/PR/branch → self-contained interactive HTML explainer via the oma-explanation skill. Resolves the target ref, runs secret gates and the validation checklist, saves under .agents/results/explain/, and reports TL;DR plus path.
+description: Drive a diff/PR/branch or a topic → self-contained interactive HTML explainer via the oma-explanation skill. Resolves the target, writes a draft, renders it with oma explain render, runs secret gates and validation, saves under .agents/results/explain/, and reports TL;DR plus path.
 disable-model-invocation: true
 ---
 
@@ -26,6 +26,12 @@ Resolve at most four inputs. Target ref follows the resolution order in the skil
 | `/explain 640`, `/explain #640` | PR #640 via `gh pr diff` | `onboarding` |
 | `/explain feature-branch for reviewer` | `git diff main...feature-branch` | `reviewer` |
 | `/explain a..b` | SHA range `a..b` | `onboarding` |
+| `/explain how does session windowing work` | **Topic mode** — no ref; the subject is the text | n/a |
+
+- **Topic mode**: the argument names a subject and resolves to no PR, branch, or SHA range.
+  Skip the diff predicate; in Step 3 collect the code and docs the subject is about instead
+  of a diff (the secret gate still runs on whatever will be quoted). If the text could be
+  either a branch name or a subject, check `git rev-parse --verify` first; a ref wins.
 
 - Reader level defaults to `onboarding`; `reviewer` condenses the deep background tier.
 - Output language via i18n-guide order (prompt language → config `language` → en).
@@ -39,19 +45,25 @@ Resolve at most four inputs. Target ref follows the resolution order in the skil
 
 ## Step 2: Load Contracts
 
-Read `.agents/skills/oma-explanation/SKILL.md`, `.agents/skills/oma-explanation/resources/document-structure.md`, and `.agents/skills/oma-explanation/resources/html-contract.md` before generating anything.
+Read `.agents/skills/oma-explanation/SKILL.md` and `.agents/skills/oma-explanation/resources/draft-format.md` before generating anything. In change mode also read `resources/document-structure.md` and `resources/html-contract.md`.
 
 ## Step 3: Collect & Gate
 
 Gather the diff and explore surrounding code for background context. Run the pre-generation secret gate on the diff: on any hit, stop, report masked locations only, and require explicit user confirmation to continue redacted.
 
 ## Step 4: Generate
 
-Author the HTML per the two resource contracts into `.agents/results/explain/{YYYY-MM-DD}-{slug}.html` (date in Asia/Seoul; same date + slug rerun overwrites).
+Write the draft per `draft-format.md` (set `slug:` in the frontmatter), then render it:
+
+```bash
+oma explain render <draft.md> [--archify]
+```
+
+The command writes `.agents/results/explain/{YYYY-MM-DD}-{slug}.html` (date in Asia/Seoul; same date + slug rerun overwrites) and prints the path. A render error names the draft line and the component's syntax: fix that line and re-run. Rewrite sentences the prose check flags. To change one panel afterwards, use `oma explain patch <file> --panel <letter>` instead of regenerating the page.
 
 ## Step 5: Validate
 
-Run the grep checklist from `html-contract.md`, including the final-HTML secret scan. Fix → re-validate at most 3 iterations, then surface the failing items to the user and stop.
+Run `oma explain validate <file>` and the final-HTML secret scan from `html-contract.md`. Fix → re-validate at most 3 iterations, then surface the failing items to the user and stop.
 
 ## Step 6: Deliver
 
@@ -61,11 +73,10 @@ Attempt `open <path>` (warn-only), then report a TL;DR and the file path in the
 
 Trigger when either `diagram.explain_sidecar: true` in `.agents/oma-config.yaml` (surfaced as `explainSidecar` by `oma diagram resolve --json`) or the user asked for it in the prompt (`/explain … with archify`, "archify 다이어그램도"). Then:
 
-1. Read `.agents/skills/_shared/conditional/diagram-engine.md`. If `engine` is `mermaid`, say the sidecar was skipped and why (one line); if `ok: false`, point to `oma diagram update`.
-2. Pick the one System/Data-Flow diagram from the explainer's Intuition section that best captures the change (architecture, sequence, or dataflow type) and author `.agents/results/explain/{YYYY-MM-DD}-{slug}.archify.json` from it.
-3. `oma diagram archify validate` → repair for at most 3 attempts or 10 minutes total, stopping earlier on a repeated diagnostic → `oma diagram archify deliver … {YYYY-MM-DD}-{slug}.archify.html`.
-4. Add a plain anchor inside the explainer (`<a href="./{YYYY-MM-DD}-{slug}.archify.html">Interactive diagram</a>`) — never iframe/embed it — then re-run Step 5's checklist once on the edited explainer.
-5. Report both paths. The explainer stays complete and valid without the sidecar; a sidecar failure never blocks delivery.
+1. Mark the panel whose `flow` or `sequence` block best captures the subject with `{archify}` in the draft.
+2. Render with `oma explain render <
```

**File**: `cli/commands/explain/index.ts` (modified, +102/-0)
```diff
@@ -5,6 +5,11 @@ import {
   resolveJsonMode,
   runAction,
 } from "../../utils/cli-framework.js";
+import {
+  runExplainComponents,
+  runExplainPatch,
+  runExplainRender,
+} from "./render/command.js";
 import { runExplainValidate } from "./validate.js";
 
 export function registerExplainCommand(program: Command): void {
@@ -54,6 +59,103 @@ export function registerExplainCommand(program: Command): void {
       { supportsJsonOutput: true },
     ),
   );
+
+  const renderCmd = explain
+    .command("render [file]")
+    .description(
+      "Render a Markdown draft (file or stdin) into one self-contained HTML explanation",
+    )
+    .option(
+      "--out <path>",
+      "Output file (default: .agents/results/explain/{YYYY-MM-DD}-{slug}.html)",
+    )
+    .option("--theme <name>", "Theme: blueprint | card")
+    .option("--mode <mode>", "Colour mode: auto | light | dark")
+    .option("--style <level>", "Prose check: off | warn | strict")
+    .option(
+      "--lang <code>",
+      "Page language: en | ko | ja | zh (default: detected)",
+    )
+    .option("--archify", "Also build and link an interactive archify diagram")
+    .option(
+      "--no-archify",
+      "Skip the archify diagram even when the config enables it",
+    )
+    .option("--open", "Open the page in the browser");
+  addOutputOptions(renderCmd);
+  renderCmd.action(
+    runAction(
+      async (
+        file: string | undefined,
+        opts: {
+          out?: string;
+          theme?: string;
+          mode?: string;
+          style?: string;
+          lang?: string;
+          archify?: boolean;
+          open?: boolean;
+          json?: boolean;
+        },
+      ) => {
+        process.exitCode = await runExplainRender({
+          ...opts,
+          file,
+          json: resolveJsonMode(opts),
+        });
+      },
+      { supportsJsonOutput: true },
+    ),
+  );
+
+  const patchCmd = explain
+    .command("patch <html> [file]")
+    .description(
+      "Replace one panel of a rendered page from its embedded draft (new panel from file or stdin)",
+    )
+    .requiredOption("--panel <id>", "Panel letter to replace, e.g. B")
+    .option("--open", "Open the page in the browser");
+  addOutputOptions(patchCmd);
+  patchCmd.action(
+    runAction(
+      async (
+        html: string,
+        file: string | undefined,
+        opts: { panel: string; open?: boolean; json?: boolean },
+      ) => {
+        process.exitCode = await runExplainPatch({
+          html,
+          file,
+          panel: opts.panel,
+          open: opts.open,
+          json: resolveJsonMode(opts),
+        });
+      },
+      { supportsJsonOutput: true },
+    ),
+  );
+
+  const componentsCmd = explain
+    .command("components [name]")
+    .description(
+      "List the components a draft can use, or print one component's syntax",
+    );
+  addOutputOptions(componentsCmd);
+  componentsCmd.action(
+    runAction(
+      async (name: string | undefined, opts: { json?: boolean }) => {
+        process.exitCode = runExplainComponents(name, {
+          json: resolveJsonMode(opts),
+        });
+      },
+      { supportsJsonOutput: true },
+    ),
+  );
 }
 
+export {
+  runExplainComponents,
+  runExplainPatch,
+  runExplainRender,
+} from "./render/command.js";
 export { runExplainValidate } from "./validate.js";
```

**File**: `cli/commands/explain/render/archify.ts` (added, +184/-0)
```diff
@@ -0,0 +1,184 @@
+import type {
+  DiagramModel,
+  FlowModel,
+  SequenceModel,
+} from "./components/index.js";
+
+// A flow or sequence block already holds a typed graph, so the archify spec
+// for the interactive sidecar is derived from it — no second authoring pass,
+// and the sidecar cannot disagree with the diagram in the page.
+
+export type ArchifyType = "architecture" | "sequence";
+export type ArchifyQuality = "showcase" | "standard";
+
+export interface ArchifySpec {
+  type: ArchifyType;
+  spec: Record<string, unknown>;
+}
+
+type ComponentType =
+  | "frontend"
+  | "backend"
+  | "database"
+  | "cloud"
+  | "security"
+  | "messagebus"
+  | "external";
+
+const TYPE_HINTS: Array<[ComponentType, RegExp]> = [
+  [
+    "database",
+    /\b(db|database|store|storage|cache|redis|postgres|mysql|sqlite|sql|index|file|disk|jsonl?)\b|저장|캐시|디비|파일|데이터베이스/i,
+  ],
+  [
+    "security",
+    /\b(auth|token|secret|guard|policy|lint|validat\w*|verify|gate|csp)\b|인증|권한|보안|검증|검사|린트/i,
+  ],
+  [
+    "messagebus",
+    /\b(queue|event|events|bus|kafka|stream|topic|pubsub|webhook|emit)\b|이벤트|큐|메시지|스트림/i,
+  ],
+  [
+    "external",
+    /\b(user|users|client|customer|reader|author|vendor|third[- ]party|external|llm|model|agent)\b|사용자|독자|작성자|고객|외부|모델|에이전트/i,
+  ],
+  [
+    "frontend",
+    /\b(ui|web|page|html|browser|view|screen|app|dashboard|svg|css)\b|화면|브라우저|페이지|웹/i,
+  ],
+  ["cloud", /\b(cloud|cdn|s3|aws|gcp|azure|bucket|lambda|edge)\b|클라우드/i],
+];
+
+/** archify component type for a node, from its label and shape. */
+export function inferComponentType(
+  label: string,
+  shape = "box",
+): ComponentType {
+  if (shape === "cylinder") return "database";
+  for (const [type, pattern] of TYPE_HINTS) {
+    if (pattern.test(label)) return type;
+  }
+  return shape === "pill" ? "external" : "backend";
+}
+
+function meta(title: string, output: string, quality: ArchifyQuality) {
+  return { title, output, quality_profile: quality };
+}
+
+function fromSequence(
+  model: SequenceModel,
+  title: string,
+  output: string,
+  quality: ArchifyQuality,
+): ArchifySpec | undefined {
+  // archify draws a message between two lifelines; a self message has none.
+  const messages = model.messages.filter(
+    (message) => message.from !== message.to,
+  );
+  if (model.participants.length < 2 || messages.length === 0) return undefined;
+  const called = new Set<string>();
+  const first = 170;
+  const step = 30;
+  return {
+    type: "sequence",
+    spec: {
+      schema_version: 1,
+      diagram_type: "sequence",
+      meta: {
+        ...meta(title, output, quality),
+        column_fit: "spread",
+        viewBox: [
+          Math.max(640, model.participants.length * 190),
+          Math.max(480, first + messages.length * step + 80),
+        ],
+      },
+      participants: model.participants.map((participant) => ({
+        id: participant.id,
+        type: inferComponentType(participant.label),
+        label: participant.label,
+      })),
+      messages: messages.map((message, index) => {
+        // A dashed arrow back along an earlier call is its return.
+        const answers = called.has(`${message.to}>${message.from}`);
+        called.add(`${message.from}>${message.to}`);
+        return {
+          id: `m${index + 1}`,
+          from: message.from,
+          to: message.to,
+          y: first + index * step,
+          label: message.label || "→",
+          variant: message.dashed ? (answers ? "return" : "dashed") : "default",
+        };
+      }),
+    },
+  };
+}
+
+function fromFlow(
+  model: FlowModel,
+  title: string,
+  output: string,
+  quality: ArchifyQuality,
+): ArchifySpec | undefined {
+  if (model.nodes.length < 2 || model.nodes.length > 24) return undefined;
+  // Ranks from the layout become grid rows (or columns, for a sideways
+  // flow); positions within a rank become the other axis.
+  const ranks = [...new Set(model.nodes.map((node) => node.rank))].sort(
+    (a, b) => a - b,
+  );
+  const horizontal = model.direction === "LR" || model.direction === "RL";
+  const cells = new Map<string, { row: number; col: number }>();
+  let widest = 0;
+  ranks.forEach((rank, rankIndex) => {
+    const members = model.nodes
+      .filter((node) => node.rank === rank)
+      .sort((a, b) => a.order - b.order);
+    widest = Math.max(widest, members.length);
+    members.forEach((node, position) => {
+      cells.set(
+        node.id,
+        horizontal
+          ? { row: position, col: rankIndex }
+          : { row: rankIndex, col: position },
+      );
+    });
+  });
+  const cols = horizontal ? ranks.length : widest;
+  if (cols > 12) return undefined;
+  return {
+    type: "architecture",
+    spec: {
+      schema_version: 1,
+      diagram_type: "architecture",
+      meta: meta(title, output, quality),
+      layout: { mode: "grid", cols },
+      components: model.nodes.map((node) => ({
+        id: node.id,
+        type: inferComponentType(node.label
```

**File**: `cli/commands/explain/render/command.ts` (added, +449/-0)
```diff
@@ -0,0 +1,449 @@
+import { spawnSync } from "node:child_process";
+import { createHash } from "node:crypto";
+import fs from "node:fs";
+import path from "node:path";
+import color from "picocolors";
+import { openUrl } from "../../../utils/open-url.js";
+import {
+  ARCHIFY_ENV_NO_UPDATE,
+  loadDiagramConfig,
+  resolveDiagramEngine,
+} from "../../diagram/resolve.js";
+import { type ArchifyQuality, toArchifySpec } from "./archify.js";
+import { COMPONENTS, findComponent } from "./components/index.js";
+import { DraftError } from "./draft.js";
+import { formatWarning } from "./lint.js";
+import {
+  extractDraftSource,
+  type PanelDiagram,
+  patchDraft,
+  type RenderOptions,
+  type RenderResult,
+  renderDraft,
+  sidecarSource,
+} from "./render.js";
+
+export interface ExplainRenderOptions {
+  file?: string;
+  out?: string;
+  theme?: string;
+  mode?: string;
+  style?: string;
+  lang?: string;
+  open?: boolean;
+  /** true / false from the flag; undefined defers to `diagram.explain_sidecar`. */
+  archify?: boolean;
+  json?: boolean;
+  cwd?: string;
+  /** Test seam: the draft text, instead of reading `file` or stdin. */
+  source?: string;
+}
+
+export interface SidecarReport {
+  status: "linked" | "skipped" | "failed";
+  file?: string;
+  spec?: string;
+  reason?: string;
+}
+
+const RESULTS_DIR = path.join(".agents", "results", "explain");
+const SIDECAR_TIMEOUT_MS = 120_000;
+
+/** Today in Asia/Seoul, the date the explain artifacts are named by. */
+export function artifactDate(now = new Date()): string {
+  return new Intl.DateTimeFormat("en-CA", {
+    timeZone: "Asia/Seoul",
+    year: "numeric",
+    month: "2-digit",
+    day: "2-digit",
+  }).format(now);
+}
+
+/** File-name slug: the draft's `slug`, else its title, else the input's name. */
+export function artifactSlug(
+  slug: string | undefined,
+  title: string,
+  file?: string,
+): string {
+  const tidy = (text: string) =>
+    text
+      .toLowerCase()
+      .replace(/[^a-z0-9]+/g, "-")
+      .replace(/^-+|-+$/g, "")
+      .slice(0, 60)
+      .replace(/-+$/, "");
+  const fromSlug = tidy(slug ?? "");
+  if (fromSlug) return fromSlug;
+  const fromTitle = tidy(title);
+  // A title that is mostly non-ASCII leaves a stub; prefer the file name then.
+  if (fromTitle.length >= Math.min(8, title.trim().length)) return fromTitle;
+  const fromFile = file
+    ? tidy(
+        path
+          .basename(file)
+          .replace(/\.[^.]+$/, "")
+          .replace(/^\d{4}-\d{2}-\d{2}-/, ""),
+      )
+    : "";
+  if (fromFile) return fromFile;
+  const hash = createHash("sha256").update(title).digest("hex").slice(0, 8);
+  return fromTitle ? `${fromTitle}-${hash}` : `explain-${hash}`;
+}
+
+function readSource(opts: ExplainRenderOptions, cwd: string): string {
+  if (opts.source !== undefined) return opts.source;
+  if (!opts.file || opts.file === "-") {
+    if (process.stdin.isTTY) {
+      throw new Error(
+        "no draft given: pass a Markdown file, or pipe the draft to stdin",
+      );
+    }
+    return fs.readFileSync(0, "utf-8");
+  }
+  return fs.readFileSync(path.resolve(cwd, opts.file), "utf-8");
+}
+
+function draftLabel(opts: { file?: string }): string {
+  return opts.file && opts.file !== "-" ? opts.file : "draft";
+}
+
+/**
+ * Build the archify sidecar next to the page. Never throws: a sidecar is an
+ * extra, and the page is complete without it.
+ */
+async function buildSidecar(
+  diagram: PanelDiagram,
+  title: string,
+  htmlPath: string,
+  cwd: string,
+): Promise<SidecarReport> {
+  const resolution = await resolveDiagramEngine({ cwd });
+  if (!resolution.archify) {
+    return { status: "skipped", reason: resolution.reason };
+  }
+  const dir = path.dirname(htmlPath);
+  const stem = path.basename(htmlPath).replace(/\.html$/i, "");
+  const specName = `${stem}.archify.json`;
+  const outName = `${stem}.archify.html`;
+  // Showcase asks for more than a derived spec always carries; fall back to
+  // standard once rather than drop the sidecar.
+  const qualities: ArchifyQuality[] =
+    resolution.quality === "showcase" ? ["showcase", "standard"] : ["standard"];
+  let reason = "";
+  for (const quality of qualities) {
+    const built = toArchifySpec(diagram.model, {
+      title: `${title} — ${diagram.title}`,
+      output: outName,
+      quality,
+    });
+    if (!built) {
+      return {
+        status: "skipped",
+        reason: "the diagram is too small or too large for an archify view",
+      };
+    }
+    fs.writeFileSync(
+      path.join(dir, specName),
+      `${JSON.stringify(built.spec, null, 2)}\n`,
+    );
+    const run = spawnSync(
+      process.execPath,
+      [
+        resolution.archify.bin,
+        "deliver",
+        built.type,
+        specName,
+        outName,
+        "--quality",
+        quality,
+        "--json",
+      ],
+      {
+        cwd: dir,
+        encoding: "utf-8",
+        timeout: SIDECAR_TIMEOUT_MS,
+        env: { ...process.env
```

---

### Incident Patch 8: `14b83878` (2026-10-05)
**Commit Message**: fix(cli): keep piped console output complete under bun

Under Bun, console.log to a pipe dropped everything past the 64 KiB pipe
buffer once process.stdout had been touched, so `bun cli/cli.ts ... --json |
jq` received truncated JSON. Route stdout console output through complete
synchronous writes when running under Bun with a non-TTY stdout. Node
already writes pipes synchronously, so the published CLI is unchanged.

Co-authored-by: First Fluke <[REDACTED_EMAIL]>

**File**: `cli/__tests__/piped-json-output.test.ts` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+import { spawnSync } from "node:child_process";
+import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join, resolve } from "node:path";
+import { afterEach, beforeEach, describe, expect, it } from "vitest";
+import { emitEvent } from "../state/events.js";
+
+const CLI = resolve(import.meta.dirname, "..", "cli.ts");
+// Comfortably past the 64 KiB pipe buffer.
+const EVENTS = 400;
+
+describe("piped --json output", () => {
+  let projectDir: string;
+
+  beforeEach(() => {
+    projectDir = mkdtempSync(join(tmpdir(), "oma-piped-json-"));
+    mkdirSync(join(projectDir, ".agents", "state"), { recursive: true });
+  });
+
+  afterEach(() => {
+    rmSync(projectDir, { recursive: true, force: true });
+  });
+
+  it("is complete when it exceeds the pipe buffer", () => {
+    for (let index = 0; index < EVENTS; index++) {
+      emitEvent(projectDir, "oma-piped", {
+        kind: "workflow.phase",
+        payload: { phase: `phase-${index}`, note: "x".repeat(300) },
+      });
+    }
+
+    const result = spawnSync(
+      "bun",
+      [CLI, "state", "get", "oma-piped", "--json"],
+      {
+        cwd: projectDir,
+        env: process.env,
+        encoding: "utf-8",
+        maxBuffer: 32 * 1024 * 1024,
+      },
+    );
+
+    expect(result.status).toBe(0);
+    expect(result.stdout.length).toBeGreaterThan(64 * 1024);
+    expect(JSON.parse(result.stdout).events).toHaveLength(EVENTS);
+  });
+});
```

**File**: `cli/cli.ts` (modified, +3/-0)
```diff
@@ -6,9 +6,12 @@ import {
   setInstallContext,
 } from "./platform/install-context.js";
 import type { CommandSurface } from "./utils/command-surface.js";
+import { installPipeSafeConsole } from "./utils/pipe-safe-console.js";
 
 const VERSION = pkg.version;
 
+installPipeSafeConsole();
+
 const program = new Command();
 let commandSurface: CommandSurface | undefined;
 
```

**File**: `cli/utils/pipe-safe-console.ts` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+import { writeSync } from "node:fs";
+import { isatty } from "node:tty";
+import { format } from "node:util";
+
+const RETRY_WAIT = new Int32Array(new SharedArrayBuffer(4));
+
+/** Write the whole text to a descriptor, waiting out a full pipe. */
+function writeAllSync(fd: number, text: string): void {
+  const buffer = Buffer.from(text, "utf-8");
+  let offset = 0;
+  while (offset < buffer.length) {
+    try {
+      offset += writeSync(fd, buffer, offset);
+    } catch (error) {
+      const code = (error as NodeJS.ErrnoException).code;
+      if (code === "EAGAIN") {
+        // The reader has not drained the pipe yet.
+        Atomics.wait(RETRY_WAIT, 0, 0, 1);
+        continue;
+      }
+      // The reader went away (`| head`); nothing left to deliver.
+      if (code === "EPIPE") return;
+      throw error;
+    }
+  }
+}
+
+/**
+ * Under Bun, console.log to a pipe silently drops everything past the pipe
+ * buffer (64 KiB) once process.stdout has been touched, so `oma … --json | jq`
+ * received truncated JSON. Route stdout console output through complete
+ * synchronous writes instead. Node already writes pipes synchronously.
+ */
+export function installPipeSafeConsole(): void {
+  // isatty(), not process.stdout.isTTY: reading the stream is what arms the bug.
+  if (!process.versions.bun || isatty(1)) return;
+  const log = (...args: unknown[]): void => {
+    writeAllSync(1, `${format(...args)}\n`);
+  };
+  console.log = log;
+  console.info = log;
+}
```

---

### Incident Patch 9: `3ff93533` (2026-10-05)
**Commit Message**: fix(dsh): canonicalize hook working directories

Match the physical cwd used by DSH for symlinks and relative workdirs.
Recognize aliased OMA workspaces and deny unresolvable pre-tool paths.

Co-authored-by: First Fluke <[REDACTED_EMAIL]>

**File**: `integrations/dsh/README.md` (modified, +5/-4)
```diff
@@ -101,9 +101,10 @@ Override the `oma` row through your profile's `cordis.patch.yml`:
 `command` names one executable. `commandArgs` is a literal argument array,
 not a shell command. The host environment is inherited so OMA can use the
 project's configured tools. Hook processes run in the agent's actual working
-directory, including an explicit Bash `workdir`. Cancellation, agent disposal,
-and plugin unload terminate owned hook
-processes.
+directory, including an explicit Bash `workdir`. Directories are resolved to
+their physical paths so symlinks and relative paths are checked from the same
+location as the tool. Cancellation, agent disposal, and plugin unload terminate
+owned hook processes.
 
 A project without an OMA marker is left alone. In an initialized project, a
 failed, timed-out, or malformed pre-tool hook denies that call. A post-tool
@@ -124,7 +125,7 @@ execution, and agent continuation. Its model responses are deterministic test
 fixtures; it makes no paid model calls.
 
 Verified on macOS with DSH `0.2.0-rc.2`, Cordis `4.0.4`, and OMA `15.0.17`:
-17 tests pass, all 33 project OMA skills are discovered, and the real OMA CLI
+19 tests pass, all 33 project OMA skills are discovered, and the real OMA CLI
 blocks a guarded tool call while allowing a benign call.
 
 ## References
```

**File**: `integrations/dsh/bridge.mjs` (modified, +10/-9)
```diff
@@ -1,4 +1,4 @@
-import { stat } from "node:fs/promises";
+import { realpath, stat } from "node:fs/promises";
 import { dirname, isAbsolute, join } from "node:path";
 import {
   decodeOutput,
@@ -19,15 +19,16 @@ const RUNTIME_NOTE = [
 ].join("\n");
 
 async function initializedWorkspace(agent) {
-  const cwd = agent?.session?.header?.cwd;
+  const sessionCwd = agent?.session?.header?.cwd;
   const id = agent?.id ?? agent?.session?.header?.id;
   if (
-    typeof cwd !== "string" ||
-    !isAbsolute(cwd) ||
+    typeof sessionCwd !== "string" ||
+    !isAbsolute(sessionCwd) ||
     typeof id !== "string" ||
     !id
   )
     return false;
+  const cwd = await realpath(sessionCwd);
   let current = cwd;
   let ancestorMarker = false;
   while (true) {
@@ -81,7 +82,7 @@ export function registerBridge(ctx, config, createUserMessage) {
   async function run(event, agent, signal, execution, result) {
     const stdout = await runner.run(
       event,
-      hookPayload(event, agent, execution, result),
+      await hookPayload(event, agent, execution, result),
       { signal, owner: agent },
     );
     return decodeOutput(stdout, event);
@@ -117,8 +118,8 @@ export function registerBridge(ctx, config, createUserMessage) {
   });
   ctx.on("tools/pre-execute", async (execution, next) => {
     const agent = execution.agent;
-    if (!(await active(agent, execution.signal))) return next();
     try {
+      if (!(await active(agent, execution.signal))) return next();
       const output = await run(
         "PreToolUse",
         agent,
@@ -140,9 +141,9 @@ export function registerBridge(ctx, config, createUserMessage) {
   });
   ctx.on("tools/post-execute", async (execution, result, next) => {
     const agent = execution.agent;
-    if (!(await active(agent, execution.signal))) return next();
     let context;
     try {
+      if (!(await active(agent, execution.signal))) return next();
       context = postContext(
         await run("PostToolUse", agent, execution.signal, execution, result),
       );
@@ -161,7 +162,6 @@ export function registerBridge(ctx, config, createUserMessage) {
     };
   });
   ctx.on("agent/turn-stopping", async ({ agent, turn, signal }) => {
-    if (!(await active(agent, signal))) return;
     let state = stopStates.get(agent);
     if (state?.turn !== turn) {
       state = { turn, blocks: 0, inFlight: false, warned: false };
@@ -171,7 +171,8 @@ export function registerBridge(ctx, config, createUserMessage) {
     state.inFlight = true;
     let reason;
     try {
-      const payload = hookPayload("Stop", agent);
+      if (!(await active(agent, signal))) return;
+      const payload = await hookPayload("Stop", agent);
       const latest = assistantResponses.get(agent.session);
       if (latest?.turn === turn) payload.response = latest.text;
       const stdout = await runner.run("Stop", payload, {
```

**File**: `integrations/dsh/bridge.test.mjs` (modified, +99/-6)
```diff
@@ -1,6 +1,6 @@
 import assert from "node:assert/strict";
-import { mkdir, writeFile } from "node:fs/promises";
-import { join } from "node:path";
+import { mkdir, realpath, symlink, writeFile } from "node:fs/promises";
+import { join, sep } from "node:path";
 import { test } from "node:test";
 import { registerBridge } from "./bridge.mjs";
 import {
@@ -51,7 +51,7 @@ test("tool denial stops dispatch and passes the public hook ABI and OMA tool ali
   ]);
   assert.equal(payload.tool_name, "Bash");
   assert.equal(payload.session_id, agent.id);
-  assert.equal(payload.cwd, f.cwd);
+  assert.equal(payload.cwd, await realpath(f.cwd));
 });
 
 test("allow preserves downstream approval and frozen input; context queues for the next step", async (t) => {
@@ -108,14 +108,107 @@ test("bash hooks resolve relative and absolute workdir without changing tool arg
   const calls = await f.calls();
   assert.equal(calls.length, 7);
   for (const [index, call] of calls.slice(0, 6).entries()) {
-    assert.equal(call.payload.cwd, index < 4 ? workdir : whitespaceWorkdir);
+    assert.equal(
+      call.payload.cwd,
+      await realpath(index < 4 ? workdir : whitespaceWorkdir),
+    );
     assert.equal(call.payload.tool_name, "Bash");
     assert.equal(call.payload.tool_input.command, "rg needle ../..");
   }
   assert.equal(calls[0].payload.tool_input.workdir, "cli/deep");
   assert.equal(calls[2].payload.tool_input.workdir, workdir);
   assert.equal(calls[4].payload.tool_input.workdir, " ");
-  assert.equal(calls[6].payload.cwd, f.cwd);
+  assert.equal(calls[6].payload.cwd, await realpath(f.cwd));
+});
+
+test("external symlinks use physical hook cwd and still activate project guards", async (t) => {
+  const f = await fixture(t, {
+    PreToolUse: {
+      hookSpecificOutput: {
+        permissionDecision: "deny",
+        permissionDecisionReason: "Use Serena.",
+      },
+    },
+  });
+  const external = await fixture(t, {}, false);
+  const nested = join(f.cwd, "cli", "deep");
+  await mkdir(nested, { recursive: true });
+  await mkdir(join(f.cwd, ".git"));
+  const alias = join(external.cwd, "project-link");
+  await symlink(
+    nested,
+    alias,
+    process.platform === "win32" ? "junction" : "dir",
+  );
+  const ctx = install(t, f.config);
+  const agent = fakeAgent(f.cwd);
+  for (const workdir of [alias, `${alias}${sep}..`]) {
+    const args = Object.freeze({ command: "rg needle ../..", workdir });
+    const tool = execution(agent, "bash", args);
+    const decision = await ctx.handlers.get("tools/pre-execute")(
+      tool,
+      async () => assert.fail("denied tool must not execute"),
+    );
+    assert.equal(decision.kind, "deny");
+    await ctx.handlers.get("tools/post-execute")(
+      tool,
+      { isError: false, value: "recorded", content: [] },
+      async () => ({ kind: "accept" }),
+    );
+    assert.equal(tool.arguments, args);
+    assert.deepEqual(args, { command: "rg needle ../..", workdir });
+  }
+  const linkedAgent = fakeAgent(alias);
+  await ctx.handlers.get("agent/created")({
+    agent: linkedAgent,
+    source: "startup",
+  });
+  assert.equal(linkedAgent.contexts.length, 1);
+  const linkedArgs = Object.freeze({ command: "rg needle ../.." });
+  const decision = await ctx.handlers.get("tools/pre-execute")(
+    execution(linkedAgent, "bash", linkedArgs),
+    async () => assert.fail("linked project must keep its guards"),
+  );
+  assert.equal(decision.kind, "deny");
+  await ctx.handlers.get("agent/turn-stopping")({
+    agent: linkedAgent,
+    turn: 1,
+    signal: new AbortController().signal,
+  });
+  const calls = await f.calls();
+  assert.equal(calls.length, 6);
+  for (const call of [calls[0], calls[1], calls[4], calls[5]]) {
+    assert.equal(call.payload.cwd, await realpath(nested));
+  }
+  assert.equal(calls[2].payload.cwd, await realpath(`${alias}${sep}..`));
+  assert.equal(calls[3].payload.cwd, await realpath(`${alias}${sep}..`));
+  assert.equal(calls[0].payload.tool_input.workdir, alias);
+  assert.equal(linkedAgent.session.header.cwd, alias);
+  assert.deepEqual(linkedArgs, { command: "rg needle ../.." });
+});
+
+test("unresolvable workdir or session cwd denies execution before invoking OMA", async (t) => {
+  const f = await fixture(t);
+  const ctx = install(t, f.config);
+  const missing = join(f.cwd, "missing");
+  for (const tool of [
+    execution(
+      fakeAgent(f.cwd),
+      "bash",
+      Object.freeze({ command: "pwd", workdir: missing }),
+    ),
+    execution(fakeAgent(missing)),
+  ]) {
+    const args = tool.arguments;
+    const decision = await ctx.handlers.get("tools/pre-execute")(
+      tool,
+      async () => assert.fail("unresolved cwd must not execute"),
+    );
+    assert.equal(decision.kind, "deny");
+    assert.match(decision.reason, /OMA hook could not validate/);
+    assert.equal(tool.arguments, args);
+  }
+  assert.deepEqual(await f.calls(), []);
 });
 
 test("changed updatedInput denies dispatch because pinned DSH c
```

**File**: `integrations/dsh/protocol.mjs` (modified, +7/-3)
```diff
@@ -1,4 +1,5 @@
-import { resolve } from "node:path";
+import { realpath } from "node:fs/promises";
+import { isAbsolute, sep } from "node:path";
 import { isDeepStrictEqual } from "node:util";
 
 const aliases = {
@@ -10,7 +11,7 @@ const aliases = {
   glob: "Glob",
 };
 
-export function hookPayload(event, agent, execution, result) {
+export async function hookPayload(event, agent, execution, result) {
   const payload = {
     cwd: agent.session.header.cwd,
     session_id: agent.id ?? agent.session.header.id,
@@ -24,7 +25,9 @@ export function hookPayload(event, agent, execution, result) {
       typeof workdir === "string" &&
       workdir.length > 0
     ) {
-      payload.cwd = resolve(payload.cwd, workdir);
+      payload.cwd = isAbsolute(workdir)
+        ? workdir
+        : `${payload.cwd}${sep}${workdir}`;
     }
     payload.tool_name = Object.hasOwn(aliases, execution.name)
       ? aliases[execution.name]
@@ -38,6 +41,7 @@ export function hookPayload(event, agent, execution, result) {
       : { isError: false, value: result.value, content: result.content };
   }
   if (event === "Stop") payload.stop_hook_active = false;
+  payload.cwd = await realpath(payload.cwd);
   return payload;
 }
 
```

---

### Incident Patch 10: `6d962585` (2026-10-05)
**Commit Message**: fix(image): support native Antigravity image generator route

Prefer the built-in image-generator with the legacy tool as fallback.
Wait for generation and preserve original raster bytes at target paths.
Sync canonical skill resources and their emitted copies.

Co-authored-by: First Fluke <[REDACTED_EMAIL]>

**File**: `.agents/skills/oma-image/resources/invocation.md` (modified, +2/-0)
```diff
@@ -12,6 +12,8 @@ This skill follows oh-my-agent's CLI-first concept: whenever a vendor's native C
 
 > The direct Gemini path (`gemini -p` stream, `generativelanguage.googleapis.com` API) is deprecated. `agy` is the supported Gemini image route — it's free with Gemini Code Assist and doesn't require billing on AI Studio.
 
+Since `agy` 1.2.16, native image requests use the built-in `image-generator` subagent. OMA asks agy to use that route when available, with `generate_image` as the fallback for older sessions, and to wait for completion before copying the generated image bytes to the requested paths.
+
 ### Invocation
 
 #### Standalone
```

**File**: `.agents/skills/oma-image/resources/vendor-matrix.md` (modified, +2/-2)
```diff
@@ -27,7 +27,7 @@ Codex requires `--skip-git-repo-check` for invocation inside a git worktree; thi
 
 ## Antigravity
 
-The Antigravity CLI (`agy`) is an agentic CLI that runs against the user's Gemini Code Assist subscription (no separate API key, no per-image charge). It exposes an internal image generation tool that drives Gemini-family image models — including the one currently called "nano-banana" — but does **not** expose a model selector to callers. We deliberately do not pretend to choose: the prompt has no model hint, the manifest records `"model": "agy-internal"`, and the output filename is `antigravity-<runShortid>.<ext>` with no model segment.
+The Antigravity CLI (`agy`) is an agentic CLI that runs against the user's Gemini Code Assist subscription (no separate API key, no per-image charge). Since 1.2.16, it routes native image requests through the built-in `image-generator` subagent; older sessions expose `generate_image` directly. OMA supports both routes and waits for generated image bytes to be saved or copied to the requested target paths. Image model selection remains internal: the prompt has no model hint, the manifest records `"model": "agy-internal"`, and the output filename is `antigravity-<runShortid>.<ext>` with no model segment.
 
 | Field | Value |
 |-------|-------|
@@ -43,7 +43,7 @@ The Antigravity CLI (`agy`) is an agentic CLI that runs against the user's Gemin
 
 - `gemini -p` runs the full agent loop and does not emit raw `inlineData` bytes on stdout (as of Gemini CLI 0.38) — it tries to invoke image-generation tools itself, often recursing back into `oma-image`.
 - The direct `generativelanguage.googleapis.com` API requires `GEMINI_API_KEY` plus billing on AI Studio. Image models are not in the free tier.
-- `agy -p` already wraps Gemini Code Assist credentials in the user's Antigravity session and exposes a working `image_gen` tool. It writes raw bytes to disk for us, so we don't have to capture them from stdout.
+- `agy -p` already wraps Gemini Code Assist credentials in the user's Antigravity session and provides native image generation. It writes raw bytes to disk for us, so we don't have to capture them from stdout.
 
 ### Output format gotcha
 
```

**File**: `cli/commands/image/providers/antigravity.test.ts` (modified, +40/-3)
```diff
@@ -61,7 +61,7 @@ describe("buildInstruction", () => {
     expect(out).toContain("2 distinct images");
   });
 
-  it("invokes generate_image by name without naming a model", () => {
+  it("supports native image-generator routing with legacy tool fallback", () => {
     const out = buildInstruction({
       prompt: "a red apple",
       size: "1024x1024",
@@ -70,7 +70,13 @@ describe("buildInstruction", () => {
       targets: ["/tmp/a/img.img"],
       refPaths: [],
     });
-    expect(out).toContain("generate_image");
+    expect(out).toContain("image-generator");
+    expect(out).toContain("otherwise use the `generate_image` tool");
+    expect(out).toContain("Wait for all image generation to finish");
+    expect(out).toContain("Preserve the original image bytes");
+    expect(out).toContain(
+      "If neither native image-generation route is available",
+    );
     expect(out).not.toMatch(/preferred model/i);
     expect(out).not.toMatch(/nano-banana/i);
     expect(out).not.toMatch(/gemini-\d/i);
@@ -98,7 +104,6 @@ describe("buildInstruction", () => {
       targets: ["/tmp/x.img"],
       refPaths: [],
     });
-    expect(out).toContain("once");
     expect(out).toContain("one image");
     expect(out).not.toContain("distinct images");
   });
@@ -335,6 +340,38 @@ describe("AntigravityProvider.generate", () => {
     expect(results[1]?.filePath).toMatch(/\.jpg$/);
   });
 
+  it("generates when the session only exposes the image-generator route", async () => {
+    vi.mocked(runCapture).mockImplementation(async (_bin, args) => {
+      const instruction = args[args.length - 1] ?? "";
+      if (!instruction.includes("image-generator")) {
+        return { code: 0, stdout: "NO_IMAGE_TOOL\n", stderr: "" };
+      }
+      const fs = await import("node:fs/promises");
+      for (const match of instruction.matchAll(/image\[\d+\]\s+->\s+(\S+)/g)) {
+        if (match[1]) {
+          await fs.writeFile(
+            match[1],
+            Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
+          );
+        }
+      }
+      return { code: 0, stdout: "SAVED", stderr: "" };
+    });
+
+    const results = await new AntigravityProvider().generate({
+      prompt: "a robot with a blue umbrella",
+      size: "auto",
+      quality: "auto",
+      n: 1,
+      outDir: tmp,
+      signal: new AbortController().signal,
+    });
+
+    expect(results).toHaveLength(1);
+    expect(results[0]?.mime).toBe("image/jpeg");
+    expect(results[0]?.filePath).toMatch(/\.jpg$/);
+  });
+
   // Regression for 21141241: agy's `-p` (= `--print`) is a VALUE flag — it
   // consumes the NEXT argv token as the prompt. If `-p` leads the argv (as it
   // once did), agy eats `--dangerously-skip-permissions` as the prompt value
```

**File**: `cli/commands/image/providers/antigravity.ts` (modified, +5/-3)
```diff
@@ -260,14 +260,16 @@ export function buildInstruction(args: {
   const targetLines = args.targets.map((p, i) => `  image[${i}] -> ${p}`);
   const replyLines = args.targets.map((p) => `SAVED:${p}`);
   return [
-    `Call the \`generate_image\` tool ${args.n === 1 ? "once" : `${args.n} times`} to produce ${args.n === 1 ? "one image" : `${args.n} distinct images`}.${sizeHint}${qualityHint} Do not answer in prose, do not explain flags, do not read CLAUDE.md or any source file — just invoke \`generate_image\`.`,
+    `Generate ${args.n === 1 ? "one image" : `${args.n} distinct images`} using Antigravity's native image-generation capability.${sizeHint}${qualityHint}`,
+    "If a built-in `image-generator` subagent is available, use it; otherwise use the `generate_image` tool. Do not draw images with code or use external services.",
     `Image prompt: ${args.prompt}`,
     ...refLines,
-    "Save each result to the EXACT absolute path below — do not change directory, name, or extension. Overwrite any existing file.",
+    "Pass the image prompt, references, and size/quality hints to the native image generator. Wait for all image generation to finish before responding.",
+    "Save or copy each generated raster image to the EXACT absolute path below — do not change directory, name, or extension. Preserve the original image bytes. Overwrite any existing file.",
     ...targetLines,
     "Once every file is saved, reply with these lines and nothing else (no prose, no markdown, no code fences):",
     ...replyLines,
-    "If `generate_image` is unavailable or refuses, reply with exactly ONE of these tokens on its own line and nothing else:",
+    "If neither native image-generation route is available, or generation fails, reply with exactly ONE of these tokens on its own line and nothing else. Use NO_IMAGE_TOOL only when neither route is available:",
     "  NO_IMAGE_TOOL",
     "  CONTENT_POLICY_REFUSAL",
     "  RATE_LIMITED",
```

**File**: `skills/oma-image/resources/invocation.md` (modified, +2/-0)
```diff
@@ -12,6 +12,8 @@ This skill follows oh-my-agent's CLI-first concept: whenever a vendor's native C
 
 > The direct Gemini path (`gemini -p` stream, `generativelanguage.googleapis.com` API) is deprecated. `agy` is the supported Gemini image route — it's free with Gemini Code Assist and doesn't require billing on AI Studio.
 
+Since `agy` 1.2.16, native image requests use the built-in `image-generator` subagent. OMA asks agy to use that route when available, with `generate_image` as the fallback for older sessions, and to wait for completion before copying the generated image bytes to the requested paths.
+
 ### Invocation
 
 #### Standalone
```

**File**: `skills/oma-image/resources/vendor-matrix.md` (modified, +2/-2)
```diff
@@ -27,7 +27,7 @@ Codex requires `--skip-git-repo-check` for invocation inside a git worktree; thi
 
 ## Antigravity
 
-The Antigravity CLI (`agy`) is an agentic CLI that runs against the user's Gemini Code Assist subscription (no separate API key, no per-image charge). It exposes an internal image generation tool that drives Gemini-family image models — including the one currently called "nano-banana" — but does **not** expose a model selector to callers. We deliberately do not pretend to choose: the prompt has no model hint, the manifest records `"model": "agy-internal"`, and the output filename is `antigravity-<runShortid>.<ext>` with no model segment.
+The Antigravity CLI (`agy`) is an agentic CLI that runs against the user's Gemini Code Assist subscription (no separate API key, no per-image charge). Since 1.2.16, it routes native image requests through the built-in `image-generator` subagent; older sessions expose `generate_image` directly. OMA supports both routes and waits for generated image bytes to be saved or copied to the requested target paths. Image model selection remains internal: the prompt has no model hint, the manifest records `"model": "agy-internal"`, and the output filename is `antigravity-<runShortid>.<ext>` with no model segment.
 
 | Field | Value |
 |-------|-------|
@@ -43,7 +43,7 @@ The Antigravity CLI (`agy`) is an agentic CLI that runs against the user's Gemin
 
 - `gemini -p` runs the full agent loop and does not emit raw `inlineData` bytes on stdout (as of Gemini CLI 0.38) — it tries to invoke image-generation tools itself, often recursing back into `oma-image`.
 - The direct `generativelanguage.googleapis.com` API requires `GEMINI_API_KEY` plus billing on AI Studio. Image models are not in the free tier.
-- `agy -p` already wraps Gemini Code Assist credentials in the user's Antigravity session and exposes a working `image_gen` tool. It writes raw bytes to disk for us, so we don't have to capture them from stdout.
+- `agy -p` already wraps Gemini Code Assist credentials in the user's Antigravity session and provides native image generation. It writes raw bytes to disk for us, so we don't have to capture them from stdout.
 
 ### Output format gotcha
 
```

---

### Incident Patch 11: `3321e064` (2026-10-05)
**Commit Message**: fix(dsh): validate bash tools from their effective workdir

Resolve relative and absolute Bash workdir values before OMA hook checks.
Preserve frozen DSH arguments and use the session directory for Stop.

Co-authored-by: First Fluke <[REDACTED_EMAIL]>

**File**: `integrations/dsh/README.md` (modified, +3/-2)
```diff
@@ -101,7 +101,8 @@ Override the `oma` row through your profile's `cordis.patch.yml`:
 `command` names one executable. `commandArgs` is a literal argument array,
 not a shell command. The host environment is inherited so OMA can use the
 project's configured tools. Hook processes run in the agent's actual working
-directory. Cancellation, agent disposal, and plugin unload terminate owned hook
+directory, including an explicit Bash `workdir`. Cancellation, agent disposal,
+and plugin unload terminate owned hook
 processes.
 
 A project without an OMA marker is left alone. In an initialized project, a
@@ -123,7 +124,7 @@ execution, and agent continuation. Its model responses are deterministic test
 fixtures; it makes no paid model calls.
 
 Verified on macOS with DSH `0.2.0-rc.2`, Cordis `4.0.4`, and OMA `15.0.17`:
-16 tests pass, all 33 project OMA skills are discovered, and the real OMA CLI
+17 tests pass, all 33 project OMA skills are discovered, and the real OMA CLI
 blocks a guarded tool call while allowing a benign call.
 
 ## References
```

**File**: `integrations/dsh/bridge.test.mjs` (modified, +41/-0)
```diff
@@ -77,6 +77,47 @@ test("allow preserves downstream approval and frozen input; context queues for t
   assert.equal(agent.contexts[0].content[0].text, "Check the result.");
 });
 
+test("bash hooks resolve relative and absolute workdir without changing tool arguments", async (t) => {
+  const f = await fixture(t);
+  const workdir = join(f.cwd, "cli", "deep");
+  const whitespaceWorkdir = join(f.cwd, " ");
+  await mkdir(workdir, { recursive: true });
+  await mkdir(whitespaceWorkdir);
+  const ctx = install(t, f.config);
+  const agent = fakeAgent(f.cwd);
+  for (const value of ["cli/deep", workdir, " "]) {
+    const args = Object.freeze({ command: "rg needle ../..", workdir: value });
+    const tool = execution(agent, "bash", args);
+    const pre = await ctx.handlers.get("tools/pre-execute")(tool, async () => {
+      assert.equal(tool.arguments, args);
+      return { kind: "allow" };
+    });
+    assert.equal(pre.kind, "allow");
+    await ctx.handlers.get("tools/post-execute")(
+      tool,
+      { isError: false, value: "needle", content: [] },
+      async () => ({ kind: "accept" }),
+    );
+    assert.deepEqual(args, { command: "rg needle ../..", workdir: value });
+  }
+  await ctx.handlers.get("agent/turn-stopping")({
+    agent,
+    turn: 1,
+    signal: new AbortController().signal,
+  });
+  const calls = await f.calls();
+  assert.equal(calls.length, 7);
+  for (const [index, call] of calls.slice(0, 6).entries()) {
+    assert.equal(call.payload.cwd, index < 4 ? workdir : whitespaceWorkdir);
+    assert.equal(call.payload.tool_name, "Bash");
+    assert.equal(call.payload.tool_input.command, "rg needle ../..");
+  }
+  assert.equal(calls[0].payload.tool_input.workdir, "cli/deep");
+  assert.equal(calls[2].payload.tool_input.workdir, workdir);
+  assert.equal(calls[4].payload.tool_input.workdir, " ");
+  assert.equal(calls[6].payload.cwd, f.cwd);
+});
+
 test("changed updatedInput denies dispatch because pinned DSH cannot apply mutation", async (t) => {
   const f = await fixture(t, {
     PreToolUse: { hookSpecificOutput: { updatedInput: { command: "safe" } } },
```

**File**: `integrations/dsh/protocol.mjs` (modified, +10/-0)
```diff
@@ -1,3 +1,4 @@
+import { resolve } from "node:path";
 import { isDeepStrictEqual } from "node:util";
 
 const aliases = {
@@ -16,6 +17,15 @@ export function hookPayload(event, agent, execution, result) {
     hook_event_name: event,
   };
   if (execution) {
+    const workdir = execution.arguments?.workdir;
+    if (
+      (event === "PreToolUse" || event === "PostToolUse") &&
+      execution.name === "bash" &&
+      typeof workdir === "string" &&
+      workdir.length > 0
+    ) {
+      payload.cwd = resolve(payload.cwd, workdir);
+    }
     payload.tool_name = Object.hasOwn(aliases, execution.name)
       ? aliases[execution.name]
       : execution.name;
```

---

### Incident Patch 12: `ff11f05f` (2026-10-04)
**Commit Message**: fix(skills): correct execution contracts and unsafe templates

Correct skill execution and verification contracts, unsafe API and mobile
examples, telemetry policies, and development workflow recipes. Remove
unconditional output quotas and update public CLI examples.

Regenerate skill distribution assets and add regression coverage for
account transitions, Git paths, slide initialization, video run isolation,
calendar boundaries, and public command parsing.

Validation: 82 focused tests pass; 33 skills validate; emit drift is clean.

Co-authored-by: First Fluke <[REDACTED_EMAIL]>

**File**: `.agents/skills/_shared/core/test-approach.md` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ TDD_EVIDENCE:
   green: 12 pass, 0 fail (after implementation)
 ```
 
-Requirements (enforced by `oma verify <agent>` → "TDD Evidence" check):
+Requirements (enforced by `oma verify agent <agent>` → "TDD Evidence" check):
 
 1. Block starts with the literal marker `TDD_EVIDENCE:`
 2. Every `tdd` task id from the plan appears in the block
```

**File**: `.agents/skills/_shared/runtime/event-spec.md` (modified, +5/-1)
```diff
@@ -1,7 +1,11 @@
 # OMA L1 Event Spec
 
 This file defines the minimum durable event contract for cross-runtime workflow state.
-Events are appended to `.agents/state/sessions/{sid}/events.jsonl`.
+Events are appended under the selected home profile:
+`${OMA_STATE_HOME:-~/.oma}/u/{OMA_PROFILE:-0}/sessions/{sid}/events.jsonl`.
+Use `oma state get <sid>` or `oma state list` for inspection rather than assuming
+a project-local path. `.agents/state/sessions/` is the legacy migration source;
+coordination memories and agent-run receipts retain their separate project paths.
 
 ## Common Fields
 
```

**File**: `.agents/skills/oma-academic-writing/SKILL.md` (modified, +9/-9)
```diff
@@ -37,7 +37,7 @@ Produce, revise, and audit publication-grade academic English prose so that ever
 
 ### Expected inputs
 - `mode`: one of `draft` | `revise` | `review`
-- `rubric_or_constraint`: assignment brief, rubric file, or word/structure limits (path or inline text)
+- Optional `rubric_or_constraint`: assignment brief, rubric file, or word/structure limits (path or inline text); draft-only revision/review does not require a rubric
 - `existing_draft`: prior text to revise or audit (path or inline text); required for `revise` and `review`
 - `source_data`: available evidence, figures, citations the writer may use
 - `target_register`: defaults to formal academic English with American spelling (en-US)
@@ -49,15 +49,15 @@ Produce, revise, and audit publication-grade academic English prose so that ever
 
 ### Dependencies
 - `../_shared/core/anti-ai-prose.md` and `resources/anti-ai-checklist.md`: common diagnostics and academic constraints; load together for prose audits
-- `resources/sentence-structure-reference.md`: four sentence types, length targets, common errors
+- `resources/sentence-structure-reference.md`: four sentence types, contextual rhythm guidance, common errors
 - `resources/academic-verb-tiers.md`: meaning- and evidence-based verb guidance
 - `resources/hedging-guide.md`: calibrated certainty expressions matched to evidence strength
 - `../_shared/core/context-loading.md`: task-relevant resource loading
 - `../_shared/core/quality-principles.md`: shared quality bar
 
 ### Control-flow features
 - Mode branching: `draft` vs `revise` vs `review` produce different output formats and pass sequences
-- Rubric-quote gate: refuses to apply a rule until the literal constraint text is quoted from the source
+- Rubric constraints: quote supplied assignment requirements before applying them; draft-only revision/review can proceed without inventing a rubric
 - Citation gap branch: when a claim lacks evidence, weaken or remove rather than fabricate; optionally hand off to `oma-scholar`
 - Language branch: non-English target hands off to `oma-translation` after the English pass
 - Iterative AUDIT: every fix loops back through the anti-AI checklist before emit
@@ -66,7 +66,7 @@ Produce, revise, and audit publication-grade academic English prose so that ever
 
 ### Entry
 1. Identify the mode (`draft`, `revise`, `review`) and the rubric source.
-2. Quote the exact constraint text (word limits, structural requirements, mandatory sections, rubric rows) before applying any rule.
+2. If assignment constraints were supplied, quote their exact text before applying them. Without a rubric, revise/review the draft using the requested register and evidence; do not invent assignment rules.
 3. If revising or reviewing, read the existing draft in full first; if drafting, confirm available source data and citations.
 4. Index `resources/` and identify any claims that need a more precise verb or hedge.
 5. Apply the literal-first principle before any drafting: prefer direct statement over metaphor and flourish. When a literal phrase is available, use it.
@@ -99,7 +99,7 @@ Produce, revise, and audit publication-grade academic English prose so that ever
 ### Exit
 - Success: every protocol PASSes, the Claim-Evidence Map has no unsupported entries, word count complies, and the mode-specific output format is fully populated.
 - Partial success: emit prose with explicit `needs evidence` / `pending citation` markers and report which protocol items remain at risk; flag handoff candidates.
-- Failure: refuse to emit and report the blocking ambiguity (rubric quote missing, source data absent, contradictory constraints).
+- Failure: report a material blocker such as required source data being unavailable or contradictory supplied constraints. The absence of an optional rubric alone does not block draft-only revision/review.
 
 ## Logical Operations
 
@@ -130,7 +130,7 @@ Produce, revise, and audit publication-grade academic English prose so that ever
 - Output-format blocks per mode (Draft / Revision / Review)
 
 ### Canonical workflow path
-1. **READ** rubric/draft and quote the exact literal constraint text; pin word limits, mandatory sections, and rubric rows.
+1. **READ** the draft and any supplied rubric; quote actual assignment constraints and pin their requirements. If no rubric is supplied, use the requested revision/review scope without inventing constraints.
 2. **PLAN** each paragraph as Topic-Support-Conclude; identify where evidence strength or a vague claim calls for a more precise verb.
 3. **DRAFT** prose with sentence variety, clear verb choice, hedging, and Topic-Support-Conclude structure.
 4. **AUDIT** with `../_shared/core/anti-ai-prose.md` and `resources/anti-ai-checklist.md`. Fix supported defects in draft/revise mode; in review mode, quote the passage, identify the defect, and recommend a local fix without a full rewrite or AI-authorship estimate.
@@ -157,10 +157,10 @@ Produce, revise, and audit publica
```

**File**: `.agents/skills/oma-academic-writing/resources/sentence-structure-reference.md` (modified, +9/-12)
```diff
@@ -14,7 +14,7 @@ One independent clause in a subject-verb pattern.
 - This dataset contains 120 years of match records.
 - Performance declined sharply after the 2018 rule changes.
 
-**Target:** 20–30% of sentences per paragraph.
+**Guidance:** Use when a direct assertion is clearest; no paragraph quota.
 
 ### 2. Compound sentence
 
@@ -28,7 +28,7 @@ Two independent clauses connected by a coordinating conjunction (FANBOYS: for, a
 - Match duration increased by 15%, and spectator attendance declined in parallel.
 - Nadal dominated the clay court, yet Djokovic maintained superiority on hard surfaces.
 
-**Target:** 15–25% of sentences per paragraph.
+**Guidance:** Use when the relationship between clauses matters; no paragraph quota.
 
 ### 3. Complex sentence
 
@@ -42,7 +42,7 @@ One independent clause + one dependent clause (introduced by a subordinating con
 - Although the dataset spans 121 seasons, only matches after 1968 include detailed set-level data.
 - Because five-set matches impose greater physical demands, average rally length decreases in the fourth and fifth sets.
 
-**Target:** 30–40% of sentences per paragraph (primary structure for academic prose).
+**Guidance:** Use to state an actual causal, conditional, or temporal relationship; no paragraph quota.
 
 ### 4. Compound-complex sentence
 
@@ -56,19 +56,16 @@ Two or more independent clauses + one or more dependent clauses.
 - While set durations vary considerably between Grand Slam events, the median match length has increased by 12 minutes since 2000, and this trend correlates with advances in racket technology.
 - Because the 1905–1968 era lacked professional circuits, participation remained limited to amateur players; however, match records from this period still provide valuable longitudinal data.
 
-**Target:** 10–20% of sentences per paragraph (use sparingly for maximum impact).
+**Guidance:** Use only when combining the clauses makes the argument clearer; no paragraph quota.
 
 ## Variation rules
 
 ### Within a paragraph
 
-1. Never place 3+ sentences of the same type consecutively
-2. Vary sentence length:
-   - Short: 8–15 words (for impact)
-   - Medium: 16–25 words (for flow)
-   - Long: 26–40 words (for depth)
-3. Paragraphs of 4+ sentences should contain at least 3 of the 4 sentence types; short emphasis paragraphs (2–3 sentences) are exempt
-4. Vary paragraph length (2–8 sentences) where it improves the argument; uniform blocks alone do not identify AI authorship
+1. Review repeated structures where they obscure emphasis or progression.
+2. Let sentence length follow the argument; split overloaded sentences and preserve useful short assertions.
+3. Do not require a fixed mix of sentence types in each paragraph.
+4. Vary paragraph length where it improves the argument; uniform blocks alone do not identify AI authorship.
 
 > For rhythm review and punctuation limits, see `anti-ai-checklist.md`, sections "Rhythm and sentence structure" and "Formatting".
 
@@ -84,7 +81,7 @@ Two or more independent clauses + one or more dependent clauses.
 | Transitional phrase | "By contrast, the women's draw exhibited..." |
 | Inverted structure | "Particularly notable is the decline in..." |
 
-**Rule:** No 3+ consecutive sentences beginning with the same opener type.
+**Diagnostic:** Review repeated openers for clarity and emphasis; keep deliberate repetition when it serves the argument.
 
 ## Common errors to prevent
 
```

**File**: `.agents/skills/oma-architecture/SKILL.md` (modified, +5/-5)
```diff
@@ -123,10 +123,10 @@ outputs:
 ### Canonical workflow path
 Use the configured code-intelligence provider for structure, symbols, references, and integration points. If unavailable, use native search only for paths outside this project or ignored paths:
 
-```bash
-ls .agents/results/architecture/   # prior decisions — read before deciding
-rg --files
-rg "ADR|architecture|boundary|service|module|dependency|owner|interface" .
+```text
+1. Read prior decisions in .agents/results/architecture/.
+2. Discover the configured provider's file, symbol, reference, and pattern tools.
+3. Inspect architecture-relevant modules, ownership, and integration points within the selected scope.
 ```
 
 Then choose Diagnostic, Recommendation, Design-Twice, ATAM-style, CBAM-style, or ADR mode before writing the artifact.
@@ -181,4 +181,4 @@ Then choose Diagnostic, Recommendation, Design-Twice, ATAM-style, CBAM-style, or
 - Context loading: `../_shared/core/context-loading.md`
 - Task decomposition: `../_shared/core/difficulty-guide.md` (unresolved scope or dependencies)
 - Clarification protocol: `../_shared/core/clarification-protocol.md`
-- Quality principles: `../_shared/core/quality-principles.md`
\ No newline at end of file
+- Quality principles: `../_shared/core/quality-principles.md`
```

**File**: `.agents/skills/oma-architecture/resources/execution-protocol.md` (modified, +1/-1)
```diff
@@ -99,7 +99,7 @@ Use the task's scope, existing project conventions, and acceptance criteria. Fol
   - `diagnosis-<topic>.md`
 - Rerunning the same topic updates the existing file; record the revision in the ADR `Status` line rather than creating a copy
 - ADR lifecycle: `Status` is `Proposed`, `Accepted`, or `Superseded by <adr-file>`. Keep a user-owned unresolved choice `Proposed`; a completed artifact or event is not acceptance. Use `Accepted` only when existing decision authority supports it. Update a prior ADR as superseded only when the replacement is authorized.
-- When running as a dispatched subagent, ALSO write the run report to `.agents/results/result-architecture.md` per the agent protocol; the report links to the durable artifact, it does not replace it
+- When dispatched, also write the injected claim and the task/run-scoped report per `../../_shared/runtime/result-contract.md` and `memory-protocol.md`. Use `result-{agentId}-{taskId}-{runId}-{sessionId}.md` under the configured memory base, preserving injected IDs. Link the architecture artifact from this report.
 - In an active OMA workflow, record and verify the actual recommendation with its authority status and current artifact revision. This records completion of the analysis without granting implementation approval:
 
 ```bash
```

**File**: `.agents/skills/oma-backend/SKILL.md` (modified, +8/-7)
```diff
@@ -100,10 +100,11 @@ Implement or review backend APIs, authentication, database integration, server-s
 - Stack-specific templates and snippets when present
 
 ### Canonical workflow path
-```bash
-rg --files
-rg "route|router|service|repository|model|schema|migration" .
-```
+Use the configured code-intelligence provider to locate files and inspect symbols
+or content. For Serena, use `find_file`, `search_for_pattern`,
+`get_symbols_overview`, and `find_symbol`. Native search is limited to the
+provider exclusions and non-code paths permitted by the project's search policy.
+
 
 <!-- oma-docs:ignore-start -->
 Then run the project's discovered verification commands, usually lint/typecheck/tests and migrations when schema changes are involved. Prefer `stack/stack.yaml` `verify:` commands when present.
@@ -167,7 +168,7 @@ Router (HTTP) → Service (Business Logic) → Repository (Data Access) → Mode
 8. **Explicit ORM loading strategy**: do not rely on default relation loading when query shape matters
 9. **Explicit transaction boundaries**: group one business operation into one request/service-scoped unit of work
 10. **Safe ORM lifecycle**: do not share mutable ORM session/entity manager/client objects across concurrent work unless the ORM explicitly supports it
-11. **Config from environment, with graceful fallback**: DB URLs, API keys, secrets, and feature flags come from env vars or secret managers; never hardcode in source. When integrating a third-party API (OpenAI, Anthropic, Stripe, etc.), write BOTH paths: (a) real call when the env key is present, (b) deterministic local fallback when absent, marked with `// TODO(oma-deferred): integrate <vendor> when key is provisioned`. Fallback-only leaves the spec unmet; real-call-only breaks demos when the key is missing
+11. **Validate required configuration**: DB URLs, API keys, secrets, and feature flags come from environment variables or secret managers. Missing credentials fail clearly in default and production modes. Deterministic fixtures require an explicitly selected test/demo mode; label simulated results and never treat simulated payment, authentication, mail, or other effects as completed real operations.
 12. **Stateless services**: no in-memory session or user state between requests; use external stores (DB, Redis, cache) for shared state
 13. **Backing services as resources**: DB, queue, cache, mail are swappable attached resources connected via config; Repository layer must not assume a specific instance
 
@@ -180,7 +181,7 @@ Router (HTTP) → Service (Business Logic) → Repository (Data Access) → Mode
 ### Stack-Specific Reference
 
 <!-- oma-docs:ignore-start -->
-- **Stack manifest (SSOT)**: `stack/stack.yaml`: structured declaration (`language`, `framework`, `orm`) and `verify:` contract consumed by `oma verify backend`. Schema: `variants/stack.schema.json`.
+- **Stack manifest (SSOT)**: `stack/stack.yaml`: structured declaration (`language`, `framework`, `orm`) and `verify:` contract consumed by `oma verify agent backend`. Schema: `variants/stack.schema.json`.
 - Tech stack narrative: `stack/tech-stack.md`: human-readable reference only; `stack.yaml` wins on conflict.
 - Code snippets (copy-paste ready): `stack/snippets.md`
 - API template: `stack/api-template.*`
@@ -197,4 +198,4 @@ Router (HTTP) → Service (Business Logic) → Repository (Data Access) → Mode
 - Clarification: `../_shared/core/clarification-protocol.md`
 - Context budget: `../_shared/core/context-budget.md`
 - Lessons learned: `../_shared/core/lessons-learned.md` (matching prior failure or requested retrospective)
-- Observability handoff: `../oma-observability/SKILL.md` §Integrations — propagators/baggage, span conventions, log correlation, PII redaction
\ No newline at end of file
+- Observability handoff: `../oma-observability/SKILL.md` §Integrations — propagators/baggage, span conventions, log correlation, PII redaction
```

**File**: `.agents/skills/oma-backend/resources/error-playbook.md` (modified, +5/-5)
```diff
@@ -38,7 +38,7 @@ Use the relevant recovery steps. If required information or authority is missing
 
 1. Read the error; is it a conflict with existing migration?
 2. Check current DB state: Check current migration state
-3. If migration conflicts: Rollback one migration step then fix migration script
+3. Inspect applied steps and partial changes first. In production or shared environments, prefer a reviewed forward fix. Roll back only in disposable development databases or with a tested, data-safe down migration; do not rewrite an already-applied migration.
 4. If schema mismatch: compare model with actual DB schema
 5. **NEVER do this**: Force-mark migrations as applied (risk of data loss)
 
@@ -72,10 +72,10 @@ Use the relevant recovery steps. If required information or authority is missing
 
 **Symptoms**: `429`, `RESOURCE_EXHAUSTED`, `rate limit exceeded` (any vendor runtime — Gemini, Claude, Codex, etc.)
 
-1. **Stop immediately**; do not make additional API calls
-2. Save current work to `progress-{agent-id}[-{sessionId}].md`
-3. Record Status: `quota_exceeded` in `result-{agent-id}[-{sessionId}].md`
-4. Specify remaining tasks so orchestrator can retry later
+1. Identify the source. An expected rate-limit response from the application under review is a test result, not an agent-provider quota failure.
+2. For provider quota exhaustion, stop affected provider calls and record the unavailable checks; continue independent authorized work when possible.
+3. Preserve injected session/task/run IDs and the claim path. Save progress/results under the configured memory base using the task/run-scoped names in `../../_shared/runtime/memory-protocol.md`.
+4. Use a valid claim status (`partial`, `blocked`, or `failed`) with the actual cause and unresolved work per `../../_shared/runtime/result-contract.md`; do not invent a `quota_exceeded` status.
 
 ---
 
```

---

### Incident Patch 13: `8c2f1ca6` (2026-10-03)
**Commit Message**: docs(i18n): render CJK bold labels and fix copied table rows

About 230 bold labels in the zh docs, and two in ja, were written as
`**标签：**正文`. CommonMark does not close bold after punctuation that
is directly followed by a letter, so the site showed raw `**`. Move the
punctuation outside the bold.

Also retranslate table rows that had copied their parent's description:
the ko `profile` and `vault` subcommands in options.md and the ja DB
migration row in skills.md.

Co-authored-by: First Fluke <[REDACTED_EMAIL]>

**File**: `web/i18n/ja/docusaurus-plugin-content-docs/current/core-concepts/skills.md` (modified, +2/-2)
```diff
@@ -212,7 +212,7 @@ description: Frontend specialist for React, Next.js, TypeScript with FSD-lite ar
 - 実装エージェント -> oma-qa（実装後にレビュー）
 - oma-backend -> oma-frontend / oma-mobile（API コントラクトが事前定義されていない場合）
 
-**QA は常に最後です。**ただし、ユーザーが特定ファイルだけのレビューを依頼した場合を除きます。
+**QA は常に最後です**。ただし、ユーザーが特定ファイルだけのレビューを依頼した場合を除きます。
 
 ---
 
@@ -248,7 +248,7 @@ context コマンドは、実際に注入されるタスクコンテキストを
 |-----------|-------------------|
 | CRUD API の作成 | 存在する場合は対応する `variants/{node,python,rust}/snippets.md` |
 | 認証 | 対応する `variants` の `snippets.md` と、存在する場合は `tech-stack.md` |
-| DB マイグレーション | 存在する場合は対応する `variants/{node,python,rust}/snippets.md` |
+| DB マイグレーション | 存在する場合は対応するバリアントの `snippets.md` |
 | パフォーマンス最適化 | `orm-reference.md` と、スキルが提供する対応する例 |
 | 既存コードの変更 | プロジェクトのコードインテリジェンスプロバイダーと関連する実行リソース |
 
```

**File**: `web/i18n/ja/docusaurus-plugin-content-docs/current/guide/skill-opt.md` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ description: oma skill optimize を使い、決定的な学習、検証、実行
    - `SKILL.md` のメモリ内コピーに編集を適用します。
    - 候補を検証します（frontmatter の `name` と `description` は残り、本文はパースできなければなりません）。
    - 文章上の学習率予算を適用します。正味の文字変更が `--lr`（デフォルト 600）を超える編集を破棄します。
-   - **検証用保留分割**のすべてのタスク（近隣タスクではベースラインと候補のペア比較を含む）と、**学習分割（held-in）**のすべてのタスク（近隣タスクの比較なし）で候補を再採点します。
+   - **検証用保留分割**のすべてのタスク（近隣タスクではベースラインと候補のペア比較を含む）と、**学習分割（held-in**）のすべてのタスク（近隣タスクの比較なし）で候補を再採点します。
 5. **最良の有効な候補を受け入れます。** held-in/held-out のルールに従い、候補はどちらの分割でも何も失わず（`Δval ≥ 0` かつ `Δtrain ≥ 0`）、少なくとも一方で改善している必要があります。候補は `Δval + Δtrain` で順位付けします。検証での厳密な改善は必須ではありません。すべての検証タスクにすでに合格している本文でも、保留分割の成果を失わずに、学習での失敗を修復できるためです。その修復が一般化するかどうかは、最終テストが決めます。タスクのカバレッジは完全でなければなりません。空でない負の転移サンプルは、完全に測定されている必要があります。`NEG_TRANSFER_FAIL = -0.1` 以下の確認済みの回帰を示す近隣タスクがあってはなりません。ライブ実行では、最初のペア比較で回帰した近隣タスクを 1 回再測定します。記録される差分は 2 回の比較の平均で、再現された回帰（`confirmed: true`）だけが候補を却下します。モック再生は再測定できないため、1 回の試行での回帰がそのまま有効になります。ライブのレポートは `isolation: "enforced"` を宣言していなければなりません。提案ゲートの結果は、`deltaLift`（検証）、`deltaTrainLift`、判定の根拠となった近隣タスクの差分とともに記録されます。
 6. 受け入れられた編集がないエポックが 2 回続いたら早期停止します（`OPT_EARLY_STOP_PATIENCE = 2`）。
 7. **改善後に実行側が所有する最終テストを実行します。** 元の本文と検証の勝者の両方が、すべての最終テストのタスクをカバーしている必要があります。候補は最終テストの改善幅を失ってはならず（`candidateLift >= baselineLift`）、完全で候補固有の負の転移チェックにももう一度合格する必要があります。厳密な改善を求めないのは、受け入れの根拠になった改善がすでに開発用の分割で示されており、小さく固定されたテストで厳密な改善まで求めると、ほとんどの修復が昇格できなくなるためです。`finalTest.findings` には、元の本文と候補のタスクごとの改善幅が一覧されるため、失敗したテストが本物の回帰なのか、ノイズを含む 1 つのタスクによるものなのかを読み取れます。最終テストがない、不完全、または失敗の場合は、昇格できません。測定済みの最終テストの失敗は監査記録として残り、後の最適化に向けた却下の知識にはなりません。
```

**File**: `web/i18n/ko/docusaurus-plugin-content-docs/current/cli-interfaces/options.md` (modified, +10/-10)
```diff
@@ -481,11 +481,11 @@ oma describe "agent spawn" | jq '.command.options[] | {flags, description}'
 | `market run` | `없음` | 해석된 last30days 엔진을 실행합니다. |
 | `doctor` | `--profile, --heal-check <agentType>, --json, --output <format>` | CLI 설치, MCP 설정, 스킬 상태를 점검합니다. |
 | `profile` | `없음` | 로컬 OMA 실행 프로필을 관리합니다. |
-| `profile list` | `--json, --output <format>` | 로컬 OMA 실행 프로필을 관리합니다. |
-| `profile show` | `--json, --output <format>` | 로컬 OMA 실행 프로필을 관리합니다. |
-| `profile create` | `--json, --output <format>` | 로컬 OMA 실행 프로필을 관리합니다. |
-| `profile use` | `--shell <shell>, --json, --output <format>` | 로컬 OMA 실행 프로필을 관리합니다. |
-| `profile run` | `없음` | 로컬 OMA 실행 프로필을 관리합니다. |
+| `profile list` | `--json, --output <format>` | 로컬 프로필 목록을 표시합니다. |
+| `profile show` | `--json, --output <format>` | 로컬 프로필 하나를 표시합니다. |
+| `profile create` | `--json, --output <format>` | 로컬 프로필을 만듭니다. |
+| `profile use` | `--shell <shell>, --json, --output <format>` | 기존 프로필을 활성화하는 셸 코드를 출력합니다. |
+| `profile run` | `없음` | 자식 프로세스에 OMA_PROFILE을 설정해 명령 하나를 실행합니다. |
 | `retro` | `--interactive, --compare, --json, --output <format>` | 메트릭과 추세를 포함한 엔지니어링 회고를 실행합니다. |
 | `recap` | `--window <period>, --date <date>, --tool <tools>, --top <n>, --sort <metric>, --mermaid, --graph, --json, --output <format>` | AI 도구 대화 이력을 요약합니다. |
 | `docs` | `없음` | 문서 드리프트를 검사하고 변경 문서 후보를 찾습니다. |
@@ -499,11 +499,11 @@ oma describe "agent spawn" | jq '.command.options[] | {flags, description}'
 | `verify` | `없음` | 서브에이전트 결과 또는 키워드 트리거 정확도를 검증합니다. |
 | `verify agent` | `-w, --workspace <path>, --json, --output <format>` | 에이전트 출력물을 검증합니다. |
 | `verify triggers` | `--corpus <path>, --max-false-fire <pct>, --max-missed-fire <pct>, --json, --output <format>` | 라벨이 지정된 프롬프트 corpus에서 키워드 트리거 정확도를 측정합니다. |
-| `vault` | `없음` | 운영체제 키체인의 API 키와 시크릿을 관리합니다. |
-| `vault store` | `--value <value>` | 운영체제 키체인의 API 키와 시크릿을 관리합니다. |
-| `vault get` | `없음` | 운영체제 키체인의 API 키와 시크릿을 관리합니다. |
-| `vault list` | `--json` | 운영체제 키체인의 API 키와 시크릿을 관리합니다. |
-| `vault delete` | `없음` | 운영체제 키체인의 API 키와 시크릿을 관리합니다. |
+| `vault` | `없음` | 운영체제 키체인(macOS Keychain / Linux Secret Service / Windows Credential Manager)에서 API 키와 시크릿을 관리합니다. |
+| `vault store` | `--value <value>` | <name> 아래에 시크릿을 저장합니다(대화형 비밀번호 프롬프트). |
+| `vault get` | `없음` | 저장된 값을 stdout으로 출력합니다(용도: export KEY=$(oma vault get <name>)). |
+| `vault list` | `--json` | 저장된 시크릿 이름 목록을 표시합니다(값은 표시하지 않음). |
+| `vault delete` | `없음` | 키체인과 인덱스에서 시크릿을 삭제합니다. |
 | `star` | `없음` | GitHub에서 oh-my-agent에 별을 표시합니다. |
 | `visualize` | `--focus <node-or-path>, --affected <paths...>, --json, --output <format>` | 프로젝트 구조를 의존성 그래프로 시각화합니다. |
 | `search` | `없음` | fetch, meta, rss, media, trust, code 검색 프리미티브를 제공합니다. |
```

**File**: `web/i18n/zh/docusaurus-plugin-content-docs/current/core-concepts/agents.md` (modified, +96/-96)
```diff
@@ -56,11 +56,11 @@ agents 目录下的智能体定义是事实来源。OMA 会将它们投影为支
 ## 详细智能体参考
 
 ### oma-brainstorm
-**领域：**规划或实现之前的设计优先构思。
+**领域**：规划或实现之前的设计优先构思。
 
-**何时使用：**探索新功能想法、理解用户意图、比较方案。在复杂或模糊的请求之前先于 /plan 使用。
+**何时使用**：探索新功能想法、理解用户意图、比较方案。在复杂或模糊的请求之前先于 /plan 使用。
 
-**何时不使用：**需求明确时交给 oma-pm，实现阶段交给领域智能体，代码审查交给 oma-qa。
+**何时不使用**：需求明确时交给 oma-pm，实现阶段交给领域智能体，代码审查交给 oma-qa。
 
 **核心规则：**
 - 设计批准前不进行实现或规划
@@ -69,9 +69,9 @@ agents 目录下的智能体定义是事实来源。OMA 会将它们投影为支
 - 逐节设计，每一步都需要用户确认
 - YAGNI：只设计需要的部分
 
-**工作流：**6 个阶段：上下文探索、提问、方案、设计、文档，保存到 docs/plans/，然后过渡到 /plan。
+**工作流**：6 个阶段：上下文探索、提问、方案、设计、文档，保存到 docs/plans/，然后过渡到 /plan。
 
-**资源：**仅使用共享资源：clarification-protocol、quality-principles、skill-routing。
+**资源**：仅使用共享资源：clarification-protocol、quality-principles、skill-routing。
 
 受保护标识符补充： `/plan`、`docs/plans/`。
 
@@ -121,9 +121,9 @@ agents 目录下的智能体定义是事实来源。OMA 会将它们投影为支
 受保护标识符补充： `../_shared/core/api-contracts/template.md`、`.agents/results/api-contracts/`。
 
 ### oma-frontend
-**领域：**基于 FSD-lite 架构使用 React、Next.js 和 TypeScript 构建 Web UI。
+**领域**：基于 FSD-lite 架构使用 React、Next.js 和 TypeScript 构建 Web UI。
 
-**何时使用：**构建用户界面、组件、客户端逻辑、样式、表单验证和 API 集成。
+**何时使用**：构建用户界面、组件、客户端逻辑、样式、表单验证和 API 集成。
 
 **技术栈：**
 - React + Next.js，默认服务端组件，交互时使用客户端组件
@@ -153,7 +153,7 @@ agents 目录下的智能体定义是事实来源。OMA 会将它们投影为支
 - FCP 目标 < 1s
 - 响应式断点：320px、768px、1024px、1440px
 
-**资源：**execution-protocol.md、tech-stack.md、tailwind-rules.md、snippets.md、angular-rules.md、error-playbook.md 和 checklist.md。
+**资源**：execution-protocol.md、tech-stack.md、tailwind-rules.md、snippets.md、angular-rules.md、error-playbook.md 和 checklist.md。
 
 **质量关卡检查清单：**
 - 无障碍：ARIA 标签、语义化标题、键盘导航
@@ -166,13 +166,13 @@ agents 目录下的智能体定义是事实来源。OMA 会将它们投影为支
 受保护标识符补充： `@/`、`angular-rules.md`、`checklist.md`、`components/ui/*`、`error-playbook.md`、`execution-protocol.md`、`middleware.ts`、`proxy.ts`、`snippets.md`、`src/`、`src/features/*/`、`tailwind-rules.md`、`tech-stack.md`。
 
 ### oma-backend
-**领域：**API、服务端逻辑、认证、数据库操作。
+**领域**：API、服务端逻辑、认证、数据库操作。
 
-**何时使用：**REST/GraphQL API、数据库迁移、认证、服务端业务逻辑和后台任务。
+**何时使用**：REST/GraphQL API、数据库迁移、认证、服务端业务逻辑和后台任务。
 
-**架构：**Router（HTTP）-> Service（业务逻辑）-> Repository（数据访问）-> Models。
+**架构**：Router（HTTP）-> Service（业务逻辑）-> Repository（数据访问）-> Models。
 
-**栈检测：**读取项目清单文件（pyproject.toml、package.json、Cargo.toml、go.mod 等）确定语言和框架。如果缺少项目专用约定，要求用户运行 /stack-set；该命令会根据随附的 schema 和模板将解析后的 stack 参考资料生成到项目中。
+**栈检测**：读取项目清单文件（pyproject.toml、package.json、Cargo.toml、go.mod 等）确定语言和框架。如果缺少项目专用约定，要求用户运行 /stack-set；该命令会根据随附的 schema 和模板将解析后的 stack 参考资料生成到项目中。
 
 **核心规则：**
 - 整洁架构：路由处理器中不放业务逻辑
@@ -183,7 +183,7 @@ agents 目录下的智能体定义是事实来源。OMA 会将它们投影为支
 - 通过集中错误模块处理自定义异常
 - 显式 ORM 加载策略、事务边界和安全生命周期
 
-**资源：**execution-protocol.md、orm-reference.md、checklist.md 和 error-playbook.md。variants/stack.schema.json 定义栈清单形状。
+**资源**：execution-protocol.md、orm-reference.md、checklist.md 和 error-playbook.md。variants/stack.schema.json 定义栈清单形状。
 
 <!-- oma-docs:ignore-start -->
 项目专用的 stack/stack.yaml、stack/tech-stack.md、代码片段和 API 模板由 /stack-set 按需生成；在栈被物化之前这些文件不存在。
@@ -192,11 +192,11 @@ agents 目录下的智能体定义是事实来源。OMA 会将它们投影为支
 受保护标识符补充： `/stack-set`、`checklist.md`、`error-playbook.md`、`execution-protocol.md`、`orm-reference.md`、`stack/`、`stack/stack.yaml`、`stack/tech-stack.md`、`variants/stack.schema.json`。
 
 ### oma-mobile
-**领域：**跨平台和原生移动应用，包括 Flutter、React Native 和 Swift 原生 iOS。
+**领域**：跨平台和原生移动应用，包括 Flutter、React Native 和 Swift 原生 iOS。
 
-**何时使用：**原生移动应用（iOS + Android）、移动端特定 UI 模式、相机、GPS、推送通知等平台功能、离线优先架构；也用于采用 SwiftUI 和 swift-openapi-generator 的 Swift 原生 iOS 应用。
+**何时使用**：原生移动应用（iOS + Android）、移动端特定 UI 模式、相机、GPS、推送通知等平台功能、离线优先架构；也用于采用 SwiftUI 和 swift-openapi-generator 的 Swift 原生 iOS 应用。
 
-**架构：**整洁架构：domain -> data -> presentation。Swift iOS 使用 App/Core/Features/Shared 项目布局。
+**架构**：整洁架构：domain -> data -> presentation。Swift iOS 使用 App/Core/Features/Shared 项目布局。
 
 **技术栈：**
 - Flutter/Dart：Riverpod/Bloc 管理状态，Dio 带拦截器处理 API，GoRouter 负责导航，Android 使用 Material Design 3，iOS 遵循 iOS HIG。
@@ -209,7 +209,7 @@ agents 目录下的智能体定义是事实来源。OMA 会将它们投影为支
 - 目标 60fps，在两个平台上测试
 - Swift：iOS 17+ 使用 @Observable 而不是 ObservableObject；根据 OpenAPI 规范通过 swift-openapi-generator 生成 API 客户端
 
-**资源：**execution-protocol.md、tech-stack.md、screen-template.dart、screen-template.swift、screen-template.tsx、checklist.md 和 error-playbook.md。variants/ 目录包含栈 schema 以及 /stack-set 物化后的平台参考资料。
+**资源**：execution-protocol.md、tech-stack.md、screen-template.dart、screen-template.swift、screen-template.tsx、checklist.md 和 error-playbook.md。variants/ 目录包含栈 schema 以及 /stack-set 物化后的平台参考资料。
 
 受保护标识符补充： `/stack-set`、`@Observable`、`App/Core/Features/Shared`、`checklist.md`、`dispose()`、`error-playbook.md`、`execution-protocol.md`、`ObservableObject`、`screen-template.dart`、`screen-template.swift`、`screen-template.tsx`、`swift-openapi-generator`、`tech-stack.md`、`variants/`。
 
@@ -349,11 +349,11 @@ agents 目录下的智能体定义是事实来源。OMA 会将它们投影为支
 ---
 
 ### oma-debug
-**领域：**Bug 诊断与修复。
+**领域**：Bug 诊断与修复。
 
-**何时使用：**用户报告的 Bug、崩溃、性能问题、间歇性故障、竞态条件和回归 Bug。
+**何时使用**：用户报告的 Bug、崩溃、性能问题、间歇性故障、竞态条件和回归 Bug。
 
-**方法论：**先复现，再诊断。永远不要猜测修复
```

**File**: `web/i18n/zh/docusaurus-plugin-content-docs/current/core-concepts/parallel-execution.md` (modified, +16/-16)
```diff
@@ -254,10 +254,10 @@ oma agent status <session-id> <agent-id>
 
 会话 ID 将处理同一功能的智能体归入一组。建议：
 
-- **每个功能使用一个会话：**处理“用户身份验证”的所有智能体共用 `session-auth-01`
-- **格式：**使用描述性 ID，例如 `session-auth-01`、`session-payment-v2`、`session-20260324-143000`
-- **自动生成：**编排器生成 `session-YYYYMMDD-HHMMSS` 格式的 ID
-- **迭代复用：**使用相同会话 ID 重新启动需要改进的智能体
+- **每个功能使用一个会话**：处理“用户身份验证”的所有智能体共用 `session-auth-01`
+- **格式**：使用描述性 ID，例如 `session-auth-01`、`session-payment-v2`、`session-20260324-143000`
+- **自动生成**：编排器生成 `session-YYYYMMDD-HHMMSS` 格式的 ID
+- **迭代复用**：使用相同会话 ID 重新启动需要改进的智能体
 
 会话 ID 决定：
 
@@ -271,41 +271,41 @@ oma agent status <session-id> <agent-id>
 
 ### 应该做
 
-1. **先锁定 API 契约。**启动实现智能体前运行 `/plan`，让前端和后端智能体对端点、请求与响应模式以及错误格式达成一致。
+1. **先锁定 API 契约**。启动实现智能体前运行 `/plan`，让前端和后端智能体对端点、请求与响应模式以及错误格式达成一致。
 
-2. **每个功能使用一个会话 ID。**这样可以让智能体输出和仪表板监控保持一致。
+2. **每个功能使用一个会话 ID**。这样可以让智能体输出和仪表板监控保持一致。
 
-3. **分配独立工作区。**始终使用 `-w` 隔离智能体：
+3. **分配独立工作区**。始终使用 `-w` 隔离智能体：
    ```bash
    oma agent spawn backend "task" session-01 -w ./apps/api &
    oma agent spawn frontend "task" session-01 -w ./apps/web &
    ```
 
-4. **主动监控。**打开仪表板终端，尽早发现问题。未被及时发现的失败智能体会浪费回合。
+4. **主动监控**。打开仪表板终端，尽早发现问题。未被及时发现的失败智能体会浪费回合。
 
-5. **实现完成后运行 QA。**所有实现智能体结束后按顺序启动 QA 智能体：
+5. **实现完成后运行 QA**。所有实现智能体结束后按顺序启动 QA 智能体：
    ```bash
    oma agent spawn backend "task" session-01 -w ./apps/api &
    oma agent spawn frontend "task" session-01 -w ./apps/web &
    wait
    oma agent spawn qa "Review all changes" session-01
    ```
 
-6. **通过重新启动进行迭代。**如果智能体输出需要改进，带上原始任务和修正上下文重新启动。不要创建新会话。
+6. **通过重新启动进行迭代**。如果智能体输出需要改进，带上原始任务和修正上下文重新启动。不要创建新会话。
 
-7. **不确定时从 `/work` 开始。**工作流会在每个关卡提供用户确认，引导你逐步完成。
+7. **不确定时从 `/work` 开始**。工作流会在每个关卡提供用户确认，引导你逐步完成。
 
 ### 不应该做
 
-1. **不要在同一工作区启动智能体。**两个智能体写入同一目录会造成合并冲突并互相覆盖文件。
+1. **不要在同一工作区启动智能体**。两个智能体写入同一目录会造成合并冲突并互相覆盖文件。
 
-2. **不要超过 MAX_PARALLEL（默认 3）。**更多并发不一定更快。每个智能体都需要内存和 CPU，默认值适合大多数系统。
+2. **不要超过 MAX_PARALLEL（默认 3**）。更多并发不一定更快。每个智能体都需要内存和 CPU，默认值适合大多数系统。
 
-3. **不要跳过计划步骤。**没有计划就启动智能体，会导致实现错位，例如前端和后端使用不同的 API 形状。
+3. **不要跳过计划步骤**。没有计划就启动智能体，会导致实现错位，例如前端和后端使用不同的 API 形状。
 
-4. **不要忽略失败的智能体。**失败智能体的工作不完整。检查其结构化声明或运行范围内的结果文件，修正提示后重新启动。
+4. **不要忽略失败的智能体**。失败智能体的工作不完整。检查其结构化声明或运行范围内的结果文件，修正提示后重新启动。
 
-5. **不要为相关工作混用会话 ID。**如果后端和前端处理同一功能，必须共用会话 ID，以便编排器协调。
+5. **不要为相关工作混用会话 ID**。如果后端和前端处理同一功能，必须共用会话 ID，以便编排器协调。
 
 ---
 
```

**File**: `web/i18n/zh/docusaurus-plugin-content-docs/current/core-concepts/workflows.md` (modified, +46/-46)
```diff
@@ -41,7 +41,7 @@ description: OMA 全部 21 个工作流的完整参考，涵盖斜杠命令、
 
 ### /orchestrate
 
-**说明：**基于 CLI 的自动化并行智能体执行。通过 CLI 启动子智能体，使用持久化运行状态和回执协调它们，监控进度并运行验证循环。
+**说明**：基于 CLI 的自动化并行智能体执行。通过 CLI 启动子智能体，使用持久化运行状态和回执协调它们，监控进度并运行验证循环。
 
 **持久化：** 是。状态文件：`.agents/state/orchestrate-state.json`。
 
@@ -73,19 +73,19 @@ description: OMA 全部 21 个工作流的完整参考，涵盖斜杠命令、
 名词白名单（14 个）：app、api、service、server、cli、tool、website、dashboard、system、backend、frontend、prototype、mvp、bot。单个功能（“implement the login feature”、“로그인 기능 구현해줘”）或已有的东西（“make the API faster”）不会匹配。
 
 **步骤：**
-1. **步骤 0，准备：**读取协调技能、上下文加载指南和内存协议。检测供应商。
-2. **步骤 1，加载或创建计划：**先检查 `.agents/results/plan-{sessionId}.json`，再检查最新的 `plan-*.json`。如果没有计划，或计划尚不可执行（任务缺少智能体、优先级层、依赖关系或验收标准），则在当前流程中内联委派 `/plan` 创建计划，并沿用同一会话 ID。展示计划并沿用已有授权；只有缺少关键决策或需要新增授权时，才在委派前询问。
-3. **步骤 2，初始化会话：**加载 `oma-config.yaml`，显示 CLI 映射表，沿用创建计划时的会话 ID，或生成新的会话 ID（`session-YYYYMMDD-HHMMSS`），并在配置的内存存储中创建 `orchestrator-session-{sessionId}.md` 和 `task-board-{sessionId}.md`。
-4. **步骤 3，启动智能体：**按优先级层处理每个任务（先 P0，再 P1……），使用供应商适配的方法启动智能体（当前运行时和目标供应商相同时使用原生子智能体；外部或跨供应商工作使用 `oma agent spawn`）。绝不超过 MAX_PARALLEL。
-5. **步骤 4，监控：**轮询运行范围内的 `progress-{agentId}-{taskId}-{runId}-{sessionId}.md` 文件和结构化回执，然后更新任务板。留意完成、失败和崩溃。
-6. **步骤 5，验证：**对每个完成的智能体运行 `verify.sh {agent-type} {workspace}`。失败时带上错误上下文重新启动（最多重试 2 次）。反复失败时，可以考虑尝试其他假设，但所有尝试共用同一份恢复总预算。如果预算不足以支撑一轮对比，则保留未解决的证据。
-7. **步骤 6，收集：**读取运行范围内的结果文件和结构化声明，然后编写摘要。
-8. **步骤 7，最终报告：**呈现会话摘要。如果运行了实验，则总结证据和决策；仅在确认了可复用的原因时才记录经验教训。
+1. **步骤 0，准备**：读取协调技能、上下文加载指南和内存协议。检测供应商。
+2. **步骤 1，加载或创建计划**：先检查 `.agents/results/plan-{sessionId}.json`，再检查最新的 `plan-*.json`。如果没有计划，或计划尚不可执行（任务缺少智能体、优先级层、依赖关系或验收标准），则在当前流程中内联委派 `/plan` 创建计划，并沿用同一会话 ID。展示计划并沿用已有授权；只有缺少关键决策或需要新增授权时，才在委派前询问。
+3. **步骤 2，初始化会话**：加载 `oma-config.yaml`，显示 CLI 映射表，沿用创建计划时的会话 ID，或生成新的会话 ID（`session-YYYYMMDD-HHMMSS`），并在配置的内存存储中创建 `orchestrator-session-{sessionId}.md` 和 `task-board-{sessionId}.md`。
+4. **步骤 3，启动智能体**：按优先级层处理每个任务（先 P0，再 P1……），使用供应商适配的方法启动智能体（当前运行时和目标供应商相同时使用原生子智能体；外部或跨供应商工作使用 `oma agent spawn`）。绝不超过 MAX_PARALLEL。
+5. **步骤 4，监控**：轮询运行范围内的 `progress-{agentId}-{taskId}-{runId}-{sessionId}.md` 文件和结构化回执，然后更新任务板。留意完成、失败和崩溃。
+6. **步骤 5，验证**：对每个完成的智能体运行 `verify.sh {agent-type} {workspace}`。失败时带上错误上下文重新启动（最多重试 2 次）。反复失败时，可以考虑尝试其他假设，但所有尝试共用同一份恢复总预算。如果预算不足以支撑一轮对比，则保留未解决的证据。
+7. **步骤 6，收集**：读取运行范围内的结果文件和结构化声明，然后编写摘要。
+8. **步骤 7，最终报告**：呈现会话摘要。如果运行了实验，则总结证据和决策；仅在确认了可复用的原因时才记录经验教训。
 
 **读取文件：**`.agents/results/plan-{sessionId}.json`、`.agents/oma-config.yaml`、运行范围内的进度和结果文件，以及结构化运行回执。
-**写入文件：**配置内存存储中的运行范围会话和任务板状态、结构化回执和声明，以及最终报告。
+**写入文件**：配置内存存储中的运行范围会话和任务板状态、结构化回执和声明，以及最终报告。
 
-**何时使用：**需要最大并行度和自动化协调的大型项目。
+**何时使用**：需要最大并行度和自动化协调的大型项目。
 
 ### /work
 
@@ -125,7 +125,7 @@ description: OMA 全部 21 个工作流的完整参考，涵盖斜杠命令、
 
 ### /ultrawork
 
-**说明：**以质量为核心的工作流。包含 5 个阶段、17 个总步骤和 12 个隔离审查步骤。每个阶段都有必须通过才能继续的关卡。
+**说明**：以质量为核心的工作流。包含 5 个阶段、17 个总步骤和 12 个隔离审查步骤。每个阶段都有必须通过才能继续的关卡。
 
 **持久化：** 是。状态文件：`.agents/state/ultrawork-state.json`。
 
@@ -159,7 +159,7 @@ description: OMA 全部 21 个工作流的完整参考，涵盖斜杠命令、
 
 **REFINE 跳过条件：** 50 行以下的简单任务。
 
-**何时使用：**在决定结果是否达到发布条件前运行完整的审查流程。工作流会记录检查和发现，但不会替你做出生产就绪决定。
+**何时使用**：在决定结果是否达到发布条件前运行完整的审查流程。工作流会记录检查和发现，但不会替你做出生产就绪决定。
 
 ---
 
@@ -203,7 +203,7 @@ description: OMA 全部 21 个工作流的完整参考，涵盖斜杠命令、
 
 ### /plan
 
-**说明：**PM 驱动的任务分解。分析需求，选择技术栈，分解为带依赖关系的优先级任务，并定义 API 契约。
+**说明**：PM 驱动的任务分解。分析需求，选择技术栈，分解为带依赖关系的优先级任务，并定义 API 契约。
 
 **触发关键词：**
 | 语言 | 关键词 |
@@ -214,11 +214,11 @@ description: OMA 全部 21 个工作流的完整参考，涵盖斜杠命令、
 | 日语 | "計画"、"要件分析"、"タスク分解" |
 | 中文 | "计划"、"需求分析"、"任务分解" |
 
-**步骤：**收集需求 -> 使用 MCP 代码分析评估技术可行性 -> 评估复杂度（Simple、Medium、Complex）-> 在跨边界时定义 API 契约 -> 分解任务 -> 与用户审查 -> 保存计划工件（Medium/Complex 时同时保存机器可读 JSON 和人类可读的 Markdown 跟踪文件）。
+**步骤**：收集需求 -> 使用 MCP 代码分析评估技术可行性 -> 评估复杂度（Simple、Medium、Complex）-> 在跨边界时定义 API 契约 -> 分解任务 -> 与用户审查 -> 保存计划工件（Medium/Complex 时同时保存机器可读 JSON 和人类可读的 Markdown 跟踪文件）。
 
 **输出：**`.agents/results/plan-{sessionId}.json`、内存写入，以及 Medium/Complex 任务的 `docs/plans/work/{NNN}-{name}.md`，其中包含任务表、决策日志和进度备注。Markdown 标题中的 `Status` 字段记录生命周期（`Active` -> `Completed`），计划不会在目录间移动。通过 `/brainstorm` 创建的设计保存到 `docs/plans/designs/{NNN}-{name}.md`。
 
-**执行方式：**内联执行（不启动子智能体）。由 `/orchestrate` 或 `/work` 消费，后者会在执行期间更新任务和状态字段。
+**执行方式**：内联执行（不启动子智能体）。由 `/orchestrate` 或 `/work` 消费，后者会在执行期间更新任务和状态字段。
 
 ### /brainstorm
 
@@ -381,7 +381,7 @@ description: OMA 全部 21 个工作流的完整参考，涵盖斜杠命令、
 
 **步骤：** 分析变更（git status、git diff）-> 分离功能（如果超过 5 个文件且跨越不同 scope/type）-> 确定类型（feat/fix/refactor/docs/test/chore/style/perf）-> 确定范围（变更的模块）-> 编写描述（祈使语气，< 72 字符）-> 立即执行提交（不需确认提示）。
 
-**规则：**绝不使用 `git add -A`。绝不提交密钥。多行消息使用 HEREDOC。只有生效的 `scm.co_author` 配置启用并同时提供两个值时，才添加共同作者尾注。
+**规则**：绝不使用 `git add -A`。绝不提交密钥。多行消息使用 HEREDOC。只有生效的 `scm.co_author` 配置启用并同时提供两个值时，才添加共同作者尾注。
 
 ---
 
@@ -417,50 +417,50 @@ description: OMA 全部 21 个工作流的完整参考，涵盖斜杠命令、
 
 ### /docs
 
-**说明：**通过 `oma-docs` 检测文档漂移并同步。验证模式会检查仓库中全部 Markdown（默认 glob 为 `**/*.md`）的损坏引用；同步模式会为受 Git diff 影响的文档提出逐文档补丁。内联执行（不启动子智能体）；所有供应商都直接调用 `oma docs`。
+**说明**：通过 `oma-docs` 检测文档漂移并同步。验证模式会检查仓库中全部 Markdown（默认 glob 为 `**/*
```

**File**: `web/i18n/zh/docusaurus-plugin-content-docs/current/guide/dashboard-monitoring.md` (modified, +30/-30)
```diff
@@ -143,11 +143,11 @@ Web 仪表盘显示与终端仪表盘相同的信息，但使用带样式的深
 
 仪表盘使用多种策略提取信息：
 
-1. **会话检测：**先查找 orchestrator-session.md，然后回退到最近修改的 `session-*.md` 文件。从 RUNNING、`IN PROGRESS`、COMPLETED、`DONE`、FAILED、`ERROR` 等关键词解析状态。
-2. **任务看板解析：**将 task-board.md 作为 Markdown 表格读取，从列中提取智能体名称、状态和任务描述。
-3. **智能体发现：**如果没有任务看板，则扫描所有 Markdown 文件中的 Agent 模式、Agent 行，或文件名中包含 `_agent` 或 `-agent` 的文件。
-4. **回合计数：**对每个发现的智能体读取 progress-{agent}`.md`，从 `turn: N` 模式提取回合号。
-5. **活动信息流：**列出最近修改的 5 个 Markdown 文件，提取最后一行有意义的内容（标题、状态行、操作项）作为活动消息。Web 仪表盘也在 recap 提供回顾视图。
+1. **会话检测**：先查找 orchestrator-session.md，然后回退到最近修改的 `session-*.md` 文件。从 RUNNING、`IN PROGRESS`、COMPLETED、`DONE`、FAILED、`ERROR` 等关键词解析状态。
+2. **任务看板解析**：将 task-board.md 作为 Markdown 表格读取，从列中提取智能体名称、状态和任务描述。
+3. **智能体发现**：如果没有任务看板，则扫描所有 Markdown 文件中的 Agent 模式、Agent 行，或文件名中包含 `_agent` 或 `-agent` 的文件。
+4. **回合计数**：对每个发现的智能体读取 progress-{agent}`.md`，从 `turn: N` 模式提取回合号。
+5. **活动信息流**：列出最近修改的 5 个 Markdown 文件，提取最后一行有意义的内容（标题、状态行、操作项）作为活动消息。Web 仪表盘也在 recap 提供回顾视图。
 
 ---
 
@@ -156,16 +156,16 @@ Web 仪表盘显示与终端仪表盘相同的信息，但使用带样式的深
 ### 会话状态
 
 顶部区域显示：
-- **会话 ID：**从会话文件提取，格式为 `session-YYYYMMDD-HHMMSS`。
-- **状态：**颜色编码，绿色表示 RUNNING，青色表示 COMPLETED，红色表示 FAILED，黄色表示 UNKNOWN。
+- **会话 ID**：从会话文件提取，格式为 `session-YYYYMMDD-HHMMSS`。
+- **状态**：颜色编码，绿色表示 RUNNING，青色表示 COMPLETED，红色表示 FAILED，黄色表示 UNKNOWN。
 
 ### 任务看板
 
 智能体表格显示每个检测到的智能体：
-- **智能体名称：**领域标识符，例如 backend、frontend、mobile、qa、debug、pm。
-- **状态：**当前状态及视觉指示器（running、completed、failed、blocked、pending）。
-- **回合：**智能体当前的回合号，即完成的迭代数，从进度文件提取。
-- **任务：**智能体正在处理的简短描述，截断以适应显示。
+- **智能体名称**：领域标识符，例如 backend、frontend、mobile、qa、debug、pm。
+- **状态**：当前状态及视觉指示器（running、completed、failed、blocked、pending）。
+- **回合**：智能体当前的回合号，即完成的迭代数，从进度文件提取。
+- **任务**：智能体正在处理的简短描述，截断以适应显示。
 
 ### 智能体进度
 
@@ -190,7 +190,7 @@ Web 仪表盘显示与终端仪表盘相同的信息，但使用带样式的深
 
 ### 信号 1：智能体显示 running 但回合没有进展
 
-**症状：**仪表盘显示智能体正在运行，但回合号几分钟没有变化。
+**症状**：仪表盘显示智能体正在运行，但回合号几分钟没有变化。
 
 **可能原因：**
 - 智能体卡在长时间操作上，例如大型代码库扫描或缓慢 API 调用
@@ -219,7 +219,7 @@ Web 仪表盘显示与终端仪表盘相同的信息，但使用带样式的深
 
 ### 信号 3：仪表盘显示 no agents detected yet
 
-**症状：**仪表盘正在运行但未显示任何智能体。
+**症状**：仪表盘正在运行但未显示任何智能体。
 
 **可能原因：**
 - 工作流尚未到达智能体启动步骤
@@ -234,7 +234,7 @@ Web 仪表盘显示与终端仪表盘相同的信息，但使用带样式的深
 
 ### 信号 4：Web 仪表盘显示 disconnected
 
-**症状：**Web 仪表盘的连接徽章显示红色 disconnected。
+**症状**：Web 仪表盘的连接徽章显示红色 disconnected。
 
 **可能原因：**
 - oma dashboard web 进程被终止
@@ -254,12 +254,12 @@ Web 仪表盘显示与终端仪表盘相同的信息，但使用带样式的深
 
 在认为多智能体会话完成之前，通过仪表盘验证：
 
-- [ ] **所有智能体显示 completed：**没有智能体卡在 running 或 blocked 状态
-- [ ] **没有智能体显示 failed：**如有失败，检查日志并重新启动
-- [ ] **QA 智能体已完成审查：**查找 `result-qa-agent.md` 或 `result-qa.md`
-- [ ] **零 CRITICAL 或 HIGH 发现：**检查 QA 结果文件的严重度计数
-- [ ] **会话状态为 COMPLETED：**会话文件应显示最终状态
-- [ ] **活动信息流显示最终报告：**最后一条活动应为摘要报告
+- [ ] **所有智能体显示 completed**：没有智能体卡在 running 或 blocked 状态
+- [ ] **没有智能体显示 failed**：如有失败，检查日志并重新启动
+- [ ] **QA 智能体已完成审查**：查找 `result-qa-agent.md` 或 `result-qa.md`
+- [ ] **零 CRITICAL 或 HIGH 发现**：检查 QA 结果文件的严重度计数
+- [ ] **会话状态为 COMPLETED**：会话文件应显示最终状态
+- [ ] **活动信息流显示最终报告**：最后一条活动应为摘要报告
 
 ---
 
@@ -277,19 +277,19 @@ Web 仪表盘显示与终端仪表盘相同的信息，但使用带样式的深
 
 ### 终端仪表盘（oma dashboard terminal）
 
-- **文件监视：**使用 chokidar，配置 `awaitWriteFinish`（200ms 稳定阈值、50ms 轮询间隔），避免渲染部分写入的文件。
-- **渲染：**每次文件变更事件时清除并重新绘制整个终端，使用 picocolors 输出 ANSI 颜色，使用 Unicode 方框绘制字符作为边框。
-- **内存目录：**从 MEMORIES_DIR、CLI 参数（如提供）或 `{cwd}/.agents/state/memories` 解析。
-- **优雅关闭：**捕获 `SIGINT` 和 `SIGTERM`，关闭 chokidar 监视器并干净退出。
+- **文件监视**：使用 chokidar，配置 `awaitWriteFinish`（200ms 稳定阈值、50ms 轮询间隔），避免渲染部分写入的文件。
+- **渲染**：每次文件变更事件时清除并重新绘制整个终端，使用 picocolors 输出 ANSI 颜色，使用 Unicode 方框绘制字符作为边框。
+- **内存目录**：从 MEMORIES_DIR、CLI 参数（如提供）或 `{cwd}/.agents/state/memories` 解析。
+- **优雅关闭**：捕获 `SIGINT` 和 `SIGTERM`，关闭 chokidar 监视器并干净退出。
 
 ### Web 仪表盘（oma dashboard web）
 
-- **HTTP 服务器：**Node.js `createServer` 在 / 提供 HTML 页面，在 `/recap` 提供回顾页面，在 `/api/state` 提供 JSON 状态，在 `/api/recap` 提供回顾数据。服务器绑定到 127.0.0.1。
-- **WebSocket：**使用 `ws` 库。回环来源的连接必须在查询字符串中包含进程令牌。连接时客户端立即收到完整状态，后续更新作为 update、event、file、data 消息推送。
-- **文件监视：**与终端仪表盘相同的 chokidar 设置。文件变更触发 `broadcast()`，它构建当前状态并发送给所有连接的 WebSocket 客户端。
-- **防抖：**更新以 100ms 防抖，避免快速文件写入时淹没客户端，例如多个智能体同时写入进度。
-- **自动重连：**浏览器客户端在 WebSocket 断开时使用指数退避重连，初始 1 秒，乘数 1.5，最大 10 秒。
-- **端口：**默认 9847，可通过 DASHBOARD_PORT 环境变量配置。API 请求接受 `X-OMA-Dashboard-Token` 或 token=...；缺少或无效令牌返回 401。
+- **HTTP 服务器**：Node.js `createServer` 在 / 提供 HTML 页面，在 `/recap` 提供回顾页面，在 `/api/state` 提供 JSON 状态，在 `/api/recap` 提供回顾数据。服务器绑定到 127.0.0.1。
+- **WebSocket**：使用 `ws` 库。回环来源的连接必须在查询字符串中包含进程令牌。连接时客户端立即收到完整状态，后续更新作为 update、event、file、data 消息推送。
+- **文件监视**：与终端仪表盘相同的 chokidar 设置。文件变更触发 `broadcast()`，它构建当前状态并发送给所有连接的 WebSocket 客户端。
+- **防抖**：更新以 100ms 防抖，避免快速文件写入时淹没客户端，例如多个智能体同时写入进度。
+- **自动重连**：浏览器客户端在 WebSocket 断开时使用指数退避重连，初始 1 秒，乘数 1.5，最大 10 秒。
+- **端口**：默认 9847，可通过 DASHBOARD_PORT 环境变量配置。API 请求接受 `X-OMA-Dashboard-Token` 或 token=...；缺少或无效令牌返回 401。
 - **状态构建：**`buildFullState()` 每次更新都将会话信息、任务看板、智能体状态、回合计数和活动信息流聚合为一个 JSON 对象。
 
 相关命令、路径和标识符： `MEMORIES_DIR=/path/to/.agents/state/memories oma dashboard terminal`、`oma agent spawn {agent-id} "{task}" 
```

**File**: `web/i18n/zh/docusaurus-plugin-content-docs/current/guide/diagram-engine.md` (modified, +1/-1)
```diff
@@ -99,7 +99,7 @@ oma diagram archify visual-check adr-auth.archify.html --json   # exit 2 = no Ch
 1. `oma diagram resolve --json`
 2. 先编写 Mermaid 块（始终如此）。
 3. 如果 `engine: archify`，将 Mermaid 拓扑转换成 archify JSON IR（`architecture` / `sequence` / `dataflow` / `lifecycle` / `workflow`），只阅读安装目录中匹配的 schema 和一个示例。
-4. `validate` → 修复 → `deliver`。**没有固定的迭代上限。**只要 archify 的客观错误数仍在改善，智能体就继续修复；连续两轮没有改善时，才按 archify 自己的收敛规则停止。不得为了通过检查而删除语义标签。
+4. `validate` → 修复 → `deliver`。**没有固定的迭代上限**。只要 archify 的客观错误数仍在改善，智能体就继续修复；连续两轮没有改善时，才按 archify 自己的收敛规则停止。不得为了通过检查而删除语义标签。
 5. 链接到 HTML，绝不嵌入。
 
 ### `/architecture`
```

---

### Incident Patch 14: `3cf73e8b` (2026-10-03)
**Commit Message**: docs: drop stale token figures and fix agent spawn flags

The docs quoted skill-context token medians (2,631, 3,100, or ~800
bytes) and session totals that skills.md no longer backs; it now asks
readers to measure instead. Point to that section rather than quoting
figures, and replace the difficulty-to-file table in agents.md, since
`oma agent context` injects the same entry for every difficulty.

Also match the CLI references to the current command surface:
- parallel-execution.md: `--model <vendor>`/`-m` is now `--vendor`
- commands.md: list all 13 agent ids and add `opencode`,
  `--resumed-from`, and `--task-id` to agent spawn; cover video
  `--timeout`, `--script`, and `-y, --yes`
- video-generation.md: add the `--timeout <duration>` row
- workflows.md: drop "under `language: ko`"; every trigger section loads

Mirror the changes in the 11 locales. The ru, vi, and zh command
references follow in the next commit.

Co-authored-by: First Fluke <[REDACTED_EMAIL]>

**File**: `web/docs/cli-interfaces/commands.md` (modified, +5/-3)
```diff
@@ -522,16 +522,18 @@ oma agent spawn <agent-id> <prompt> <session-id> [--vendor <vendor>] [-w <worksp
 
 | Argument | Required | Description |
 |:---------|:---------|:-----------|
-| `agent-id` | Yes | Agent type. One of: `backend`, `frontend`, `mobile`, `qa`, `debug`, `pm` |
+| `agent-id` | Yes | Agent type. One of: `orchestrator`, `architecture`, `qa`, `pm`, `backend`, `frontend`, `mobile`, `db`, `debug`, `refactor`, `docs`, `tf-infra`, `explore` |
 | `prompt` | Yes | Task description. Can be inline text or a path to a file. |
 | `session-id` | Yes | Session identifier (format: `session-YYYYMMDD-HHMMSS`) |
 
 **Options:**
 
 | Flag | Description |
 |:-----|:-----------|
-| `--vendor <vendor>` | CLI vendor override: `antigravity`, `claude`, `codex`, `cursor`, `qwen`, `grok`, `pi` |
+| `--vendor <vendor>` | CLI vendor override: `antigravity`, `claude`, `codex`, `cursor`, `opencode`, `qwen`, `grok`, `pi` |
 | `-w, --workspace <path>` | Working directory for the agent. Auto-detected from monorepo config if omitted. |
+| `--resumed-from <run-id>` | Link a retry to its preceding run ID. |
+| `--task-id <id>` | Task ID from the session plan. Defaults to the agent ID. |
 | `--isolation <mode>` | Per-spawn isolation mode. Currently supports `worktree`: creates a fresh git worktree at `${tmpdir}/oma-worktrees/{sessionId}/{agentId}` on branch `oma/{sessionId}/{agentId}` and runs the agent there. The worktree is retained after exit; merge or discard commands are printed for manual review (no auto-merge). |
 | `--read-only` | Restrict the spawned agent to non-destructive tools (suppresses auto-approve flags). Used internally by `oma skill eval --live` for both eval arms. |
 | `--fallback-vendors <vendors>` | Opt in to an ordered, comma-separated chain of up to three configured CLI vendors. Continuation requires a recognized quota/rate-limit/transient failure and a fresh safe-handoff checkpoint. |
@@ -1522,7 +1524,7 @@ oma video compose <runDir> --output json
 oma video render <runDir> --output json
 ```
 
-`generate` accepts `--mode shorts|explainer|demo`, `--aspect`, `--locale`, `--captions`, `--visual`, `--voice`, `--music`, `--duration`, `--compositor hyperframes|mpt`, `--capture`, `--source file|web`, `--url`, `--device`, `--ready-selector`, `--show-cursor`, `--polish`, `--capture-timeout`, and `--capture-stop duration:<seconds>|selector:<css>`. Use `--source web --url <url>` for a browser capture; `--source file` is the default. `--output-dir` selects the run root, `--allow-external-output` permits a path outside `$PWD`, `--max-usd` sets a cost ceiling, `--seed` stabilizes planning inputs, and `--no-brief-in-manifest` stores a brief hash instead of its text. `--dry-run` stops after planning. `--output text|json` controls the CLI envelope.
+`generate` accepts `--mode shorts|explainer|demo`, `--aspect`, `--locale`, `--captions`, `--visual`, `--voice`, `--music`, `--duration`, `--compositor hyperframes|mpt`, `--capture`, `--source file|web`, `--url`, `--device`, `--ready-selector`, `--show-cursor`, `--polish`, `--capture-timeout`, and `--capture-stop duration:<seconds>|selector:<css>`. Use `--source web --url <url>` for a browser capture; `--source file` is the default. `--output-dir` selects the run root, `--allow-external-output` permits a path outside `$PWD`, `--max-usd` sets a cost ceiling, `-y, --yes` skips the cost confirmation, `--seed` stabilizes planning inputs, `--timeout` limits each visual and music provider call, `--script` injects an agent-authored `script.json`, and `--no-brief-in-manifest` stores a brief hash instead of its text. `--dry-run` stops after planning. `--output text|json` controls the CLI envelope.
 
 `doctor` checks the cached HyperFrames/MPT toolchain and accepts `--install`, `--upgrade`, `--install-mpt`, and `--install-strudel`. `provider list` reports provider availability and key status. `compose` scaffolds or refreshes the run composition and reports the authoring contract; `render` lints, renders, and probes the output. Missing compositor, composition, or toolchain dependencies are errors. The test-only `OMA_VIDEO_MOCK=1` path is the sole placeholder mode; a normal run never substitutes a text or tiny-file MP4.
 
```

**File**: `web/docs/core-concepts/agents.md` (modified, +3/-9)
```diff
@@ -835,17 +835,11 @@ In subagent mode (CLI-spawned), agents cannot ask users directly. LOW proceeds,
 
 Each agent's knowledge is split across two layers:
 
-**Layer 1: SKILL.md (~3,100 tokens median)**
-Always loaded. Contains frontmatter (name, description), when to use / not use, core rules, architecture overview, library list, and references to Layer 2 resources.
+**Layer 1: SKILL.md (loaded when the skill is routed)**
+Contains frontmatter (name, description), when to use / not use, core rules, architecture overview, library list, and references to Layer 2 resources.
 
 **Layer 2: resources/ (loaded on-demand)**
-Loaded only when the agent is actively working, and only the resources matching the task type and difficulty:
-
-| Difficulty | Resources Loaded |
-|-----------|-----------------|
-| **Simple** | execution-protocol.md only |
-| **Medium** | execution-protocol.md + examples.md |
-| **Complex** | execution-protocol.md + examples.md + tech-stack.md + snippets.md |
+Loaded only when the agent is actively working, and only the resources the task needs. Difficulty sets a soft token budget, not a fixed file list; see [Resource loading by task](./skills.md#resource-loading-by-task).
 
 Additional resources are loaded during execution as needed:
 - `checklist.md`: at the Verify step
```

**File**: `web/docs/core-concepts/parallel-execution.md` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ oma agent spawn <agent-id> <prompt> <session-id> [options]
 | Flag | Short | Description |
 |------|-------|-------------|
 | `--workspace <path>` | `-w` | Working directory for the agent. Agents only modify files within this directory. |
-| `--model <vendor>` | `-m` | Override the CLI vendor for this spawn (`antigravity`, `claude`, `codex`, `cursor`, `opencode`, `qwen`, `grok`, or `pi`). |
+| `--vendor <vendor>` | | Override the CLI vendor for this spawn (`antigravity`, `claude`, `codex`, `cursor`, `opencode`, `qwen`, `grok`, or `pi`). |
 | `--resumed-from <run-id>` | | Link a retry to the preceding evidence-backed run. |
 | `--fallback-vendors <vendors>` | | Ordered comma-separated vendor fallbacks when the primary cannot run. |
 | `--task-id <id>` | | Bind the spawn to a task ID from the session plan. |
```

**File**: `web/docs/core-concepts/project-structure.md` (modified, +1/-1)
```diff
@@ -282,7 +282,7 @@ Where skill expertise lives. There are 33 skill directories plus `_shared` resou
 - `conditional/`: Quality score measurement, experiment ledger tracking, exploration loop protocol (loaded only when triggered)
 
 **`oma-{skill}/`**: Per-skill directories. Each contains:
-- `SKILL.md` (about 2,631 tokens median in the current tree): Layer 1, loaded when the skill is routed. Identity, routing, core rules.
+- `SKILL.md`: Layer 1, loaded when the skill is routed. Identity, routing, core rules.
 - `resources/`: Layer 2, on-demand. Execution protocols, examples, checklists, error playbooks, tech stacks, snippets, templates.
 - Some skills have additional subdirectories: `variants/` (backend/mobile seeds), generated `stack/` references from `/stack-set`, `reference/` (oma-design), and skill-specific scripts/config.
 
```

**File**: `web/docs/core-concepts/workflows.md` (modified, +1/-1)
```diff
@@ -603,7 +603,7 @@ The `informationalPatterns` section of `.agents/hooks/core/triggers.json` define
 
 If the input matches both a workflow trigger and an informational pattern, the informational pattern takes priority and no workflow is triggered. This is what blocks prompts like:
 - `"How do you build a TODO app?"`: `how do` in `*` blocks the orchestrate intent regex
-- `"orchestrate 트리거 해주면 되나요?"` (under `language: ko`): `트리거` in `ko` blocks the orchestrate keyword
+- `"orchestrate 트리거 해주면 되나요?"`: `트리거` in `ko` blocks the orchestrate keyword
 
 ### Excluded workflows
 
```

**File**: `web/docs/getting-started/introduction.md` (modified, +2/-2)
```diff
@@ -144,13 +144,13 @@ The 12 checked-in definition files cover the 13 runtime roles through aliases: `
 
 oh-my-agent uses a two-layer skill architecture to prevent context window exhaustion:
 
-**Layer 1: SKILL.md (~3,100 tokens median, loaded when the skill is routed)**
+**Layer 1: SKILL.md (loaded when the skill is routed)**
 Contains the agent's identity, routing conditions, core rules, and "when to use / when NOT to use" guidance. This is all that is loaded when the agent is not actively working.
 
 **Layer 2: resources/ (loaded on-demand)**
 Contains execution protocols, tech stack references, code snippets, error playbooks, checklists, and examples. These are loaded only when the agent is invoked for a task, and even then, only the resources relevant to the specific task type are loaded (based on the difficulty assessment and task-resource mapping in `context-loading.md`).
 
-Measured across a 5-agent session, this holds roughly 17-19K tokens of skill context for a Simple or Medium task against a 72K ceiling — about 75% of the maximum avoided, falling to ~47% for Complex tasks that pull in stack references. See [token savings math](../core-concepts/skills.md#token-savings-math) for the measured table and the script that reproduces it.
+How much context this saves depends on the skills and the task, so measure it instead of assuming a figure. See [token savings math](../core-concepts/skills.md#token-savings-math) for the script and what its estimates cover.
 
 ---
 
```

**File**: `web/docs/guide/usage.md` (modified, +1/-1)
```diff
@@ -399,7 +399,7 @@ Use 3 terminals:
 
 ### Progressive disclosure
 
-Skills load in two layers to save tokens. Layer 1 (`SKILL.md`, about 2,631 tokens median in the current 33-skill tree) enters context when the host routes the skill — the injector passes a path, not the body. Layer 2 (`resources/`) is read only as the task needs it, per the difficulty tiers. Measured across a 5-agent session, a Simple or Medium task holds about 18-19K tokens of skill context against a 73K ceiling, leaving roughly 109K of a 128K context for actual work; a Complex task holds about 39K, leaving roughly 89K. See [token savings math](../core-concepts/skills.md#token-savings-math) for the table and the script that reproduces it.
+Skills load in two layers to save tokens. Layer 1 (`SKILL.md`) enters context when the host routes the skill — the injector passes a path, not the body. Layer 2 (`resources/`) is read only when the task needs it; difficulty sets a soft budget, not a file list. The savings depend on the skills and the task, so measure them instead of assuming a figure: [token savings math](../core-concepts/skills.md#token-savings-math) has the script and explains what its estimates cover.
 
 ### Token optimization
 
```

**File**: `web/docs/guide/video-generation.md` (modified, +1/-0)
```diff
@@ -96,6 +96,7 @@ oma video provider list         # provider availability + key/fallback status
 | `--dry-run` | Emit script / render-spec / manifest, skip rendering. |
 | `--script <path>` | Agent-authored `script.json` to inject (overrides the skeleton; controls narration, on-screen text, and per-scene visual prompts). |
 | `-y, --yes` | Skip the cost-confirmation prompt. |
+| `--timeout <duration>` | Time limit for each visual and music provider call, such as `90s` or `2m`; a bare number is seconds. |
 | `--output <f>` | CLI output: `text` (default) or `json`. |
 | `--no-brief-in-manifest` | Store a SHA-256 of the brief instead of the raw brief. |
 
```

---

### Incident Patch 15: `2076a2d4` (2026-10-03)
**Commit Message**: docs(cli): stop the /setup paragraph rendering as a heading

The paragraph sat directly above a `---` line, so CommonMark parsed it
as a setext H2. Add a blank line between them.

Co-authored-by: First Fluke <[REDACTED_EMAIL]>

**File**: `web/docs/cli-interfaces/commands.md` (modified, +1/-0)
```diff
@@ -278,6 +278,7 @@ Use this after editing `.agents/agents/`, `.agents/workflows/`, `.agents/rules/`
 ### setup (workflow)
 
 The `/setup` workflow (invoked inside an agent session) provides interactive configuration of language, CLI installations, MCP connections, and agent-CLI mapping. This is different from `oma` (the installer): `/setup` configures an already-installed instance.
+
 ---
 
 ## Monitoring & metrics
```

#### Recent Merged Pull Requests:
- **PR #851** (2026-10-06): chore(main): release cli 15.7.1 (@github-actions[bot])
- **PR #850** (2026-10-06): chore(main): release cli 15.7.0 (@github-actions[bot])
- **PR #849** (2026-10-06): chore(main): release cli 15.6.0 (@github-actions[bot])
- **PR #848** (2026-10-06): chore(main): release cli 15.5.0 (@github-actions[bot])
- **PR #847** (2026-10-05): chore(main): release cli 15.4.1 (@github-actions[bot])
- **PR #846** (2026-10-05): chore(main): release cli 15.4.0 (@github-actions[bot])
- **PR #845** (2026-10-05): chore(main): release web 7.1.2 (@github-actions[bot])
- **PR #844** (2026-10-05): chore(main): release cli 15.3.0 (@github-actions[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
