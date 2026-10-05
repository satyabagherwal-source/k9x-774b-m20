# Forensic Learning Record (Deep Inspection): diegosouzapw/OmniRoute

> **Canonical Artifact**: `07_PROJECT_LEARNING/diegosouzapw-omniroute-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/diegosouzapw/OmniRoute](https://github.com/diegosouzapw/OmniRoute))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:59:01.567Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `diegosouzapw/OmniRoute`
- **Description**: Never stop coding. Free MIT AI gateway: one endpoint, 359 providers (150+ free), 1200+ models Kimi, Claude, GPT, Gemini, GLM, DeepSeek, MiniMax. Works with Claude Code, Codex, Cursor, OpenCode, Cline & Copilot. Quota-aware auto-fallback, RTK+Caveman compression saves 15-95% tokens, MCP/A2A, Desktop/PWA. Built by hundreds of contributors
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 73291 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bin/aliasResolverHook.mjs`
```
/**
 * ESM loader hook for path-alias resolution (#7791 + #7808).
 *
 * This file runs in Node's loader worker thread after being registered via
 * `module.register(url, data)` from `bin/aliasResolver.mjs`. It MUST NOT import
 * anything from the parent module — all inputs arrive through `initialize(data)`.
 *
 * Behaviour:
 * - Rewrites alias specifiers to absolute filesystem paths, mirroring
 *   tsconfig.json `paths`:
 *     - `@/*`                    → <root>/src/*
 *     - `@omniroute/open-sse`     → <root>/open-sse/index.*
 *     - `@omniroute/open-sse/*`   → <root>/open-sse/*
 * - Probes the usual source extensions (`.ts`, `.tsx`, `.js`, `.mjs`, `.cjs`,
 *   `.json`) plus `index.*` for directory imports.
 * - Returns `shortCircuit: true` only when a candidate file exists on disk;
 *   otherwise delegates to the next resolver (tsx/Node) so unrelated imports
 *   and legitimate "module not found" errors pass through unchanged.
 *
 * Why a separate file instead of an inline `data:` URL?
 * CodeQL's `js/incomplete-url-substring-sanitization` flags dynamic `new URL(...)`
 * construction with interpolated strings. A real file URL produced by
 * `pathToFileURL()` is a trusted, fully-parsed URL — no sanitization ambiguity.
 */
import { pathToFileURL } from "node:url";
import { join, relative, isAbsolute } from "node:path";
import { existsSync, statSync } from "node:fs";

let ROOT = "";

export function initialize(data) {
  ROOT = (data && data.root) || "";
}

const EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"];

/**
 * Alias prefix table — mirrors ALIAS_MAP in aliasResolver.mjs and
 * tsconfig.json `paths`. Processed top-to-bottom; first match wins.
 *
 * @type {Array<{prefix: string, target: string, exact: boolean}>}
 */
const ALIAS_TABLE = [
  { prefix: "@/", target: "src", exact: false },
  { prefix: "@omniroute/open-sse/", target: "open-sse", exact: false },
  { prefix: "@omniroute/open-sse", target: "open-sse", exact: true },
];

function tryResolveAliasFsPath(specifier) {
  if (!ROOT || typeof specifier !== "string") return null;

  // Find the first matching alias entry.
  let matchedEntry = null;
  let rest = null;
  for (const entry of ALIAS_TABLE) {
    if (specifier.startsWith(entry.prefix)) {
      const after = specifier.slice(entry.prefix.length);
      if (after.length === 0 && !entry.exact) continue;
      matchedEntry = entry;
      rest = after;
      break;
    }
  }
  if (!matchedEntry) return null;

  const targetDir = join(ROOT, matchedEntry.target);

  // Exact match (e.g. `@omniroute/open-sse`) → resolve to `<target>/index.*`.
  if (rest === "" || rest === undefined) {
    return probeIndex(targetDir);
  }

  // Guard against absolute-ish escapes.
  if (rest.startsWith("/") || rest.startsWith("\\")) return null;
  // Guard against path-traversal escapes.
  const segments = rest.split(/[\\\/]+/);
  if (segments.includes("..")) return null;

  const base = join(targetDir, rest);
  if (!isWithinRoot(targetDir, base)) return null;
  return probeFile(base) ?? probeIndex(base) ?? null;
}

function probeFile(base) {
  // Extension variants first — avoids matching a bare directory name.
  for (const ext of EXTENSIONS) {
    const candidate = base + ext;
    if (existsSync(candidate)) return candidate;
  }
  if (existsSync(base)) {
    try {
      const st = statSync(base);
      if (!st.isDirectory()) return base;
    } catch {}
  }
  return null;
}

function probeIndex(dir) {
  const indexBase = join(dir, "index");
  for (const ext of EXTENSIONS) {
    const candidate = indexBase + ext;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * True when `candidate` resolves to a location inside `ancestor` (or is
 * `ancestor` itself). Path-normalization-aware defense against traversal.
 */
function isWithinRoot(ancestor, candidate) {
  const rel = relative(ancestor, candidate);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function resolve(specifier, context, nextResolve) {
  const fsPath = tryResolveAliasFsPath(specifier);
  if (fsPath) {
    return {
      url: pathToFileURL(fsPath).href,
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}

```

### Core Architecture Module: `bin/cli/commands/webhooks.mjs`
```
import { apiFetch } from "../api.mjs";
import { emit } from "../output.mjs";
import { t } from "../i18n.mjs";

const EVENT_TYPES = [
  "request.completed",
  "request.failed",
  "rate_limit.exceeded",
  "budget.exceeded",
  "quota.reset",
  "provider.down",
  "provider.up",
  "combo.switched",
  "circuit.opened",
  "circuit.closed",
  "skill.executed",
  "memory.added",
  "audit.created",
];

function truncate(v, len = 40) {
  if (v == null) return "-";
  const s = String(v);
  return s.length > len ? s.slice(0, len - 1) + "…" : s;
}

function fmtTs(v) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return String(v);
  }
}

function maskSecret(v) {
  if (!v) return "-";
  return "***";
}

const webhookSchema = [
  { key: "id", header: "ID", width: 22 },
  { key: "url", header: "URL", width: 40, formatter: truncate },
  {
    key: "events",
    header: "Events",
    formatter: (v) => (Array.isArray(v) ? v.join(", ") : String(v ?? "-")),
  },
  { key: "enabled", header: "Enabled", formatter: (v) => (v ? "✓" : "✗") },
  { key: "secret", header: "Secret", formatter: maskSecret },
  { key: "lastDelivery", header: "Last Delivery", formatter: fmtTs },
  { key: "lastStatus", header: "Last Status", width: 10 },
];

function parseHeader(kv) {
  const eq = kv.indexOf("=");
  if (eq === -1) return { name: kv, value: "" };
  return { name: kv.slice(0, eq), value: kv.slice(eq + 1) };
}

async function confirm(q) {
  return new Promise((resolve) => {
    process.stdout.write(`${q} (yes/no) `);
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (c) => resolve(c.toString().trim().toLowerCase().startsWith("y")));
  });
}

export async function runWebhooksList(opts, cmd) {
  const res = await apiFetch("/api/webhooks");
  if (!res.ok) {
    process.stderr.write(`Error: ${res.status}\n`);
    process.exit(1);
  }
  const data = await res.json();
  emit(data.items ?? data, cmd.optsWithGlobals(), webhookSchema);
}

export async function runWebhooksGet(id, opts, cmd) {
  const res = await apiFetch(`/api/webhooks/${id}`);
  if (!res.ok) {
    process.stderr.write(`Not found: ${id}\n`);
    process.exit(1);
  }
  emit(await res.json(), cmd.optsWithGlobals(), webhookSchema);
}

export async function runWebhooksAdd(opts, cmd) {
  const body = {
    url: opts.url,
    events: opts.events,
    ...(opts.secret ? { secret: opts.secret } : {}),
    headers: opts.header ?? [],
    enabled: opts.enabled !== false,
  };
  const res = await apiFetch("/api/webhooks", { method: "POST", body });
  if (!res.ok) {
    process.stderr.write(`Error: ${res.status}\n`);
    process.exit(1);
  }
  emit(await res.json(), cmd.optsWithGlobals(), webhookSchema);
}

export async function runWebhooksUpdate(id, opts, cmd) {
  const body = {};
  if (opts.url !== undefined) body.url = opts.url;
  if (opts.events !== undefined) body.events = opts.events;
  if (opts.secret !== undefined) body.secret = opts.secret;
  if (opts.enabled !== undefined) body.enabled = opts.enabled;
  if (opts.header?.length) body.headers = opts.header.map(parseHeader);
  const res = await apiFetch(`/api/webhooks/${id}`, { method: "PUT", body });
  if (!res.ok) {
    process.stderr.write(`Error: ${res.status}\n`);
    process.exit(1);
  }
  emit(await res.json(), cmd.optsWithGlobals(), webhookSchema);
}

export async function runWebhooksRemove(id, opts, cmd) {
  if (!opts.yes) {
    const ok = await confirm(`Delete webhook ${id}?`);
    if (!ok) return;
  }
  const res = await apiFetch(`/api/webhooks/${id}`, { method: "DELETE" });
  if (!res.ok) {
    process.stderr.write(`Error: ${res.status}\n`);
    process.exit(1);
  }
  process.stdout.write("Removed\n");
}

export async function runWebhooksTest(id, opts, cmd) {
  const body = { event: opts.event ?? "request.completed" };
  const res = await apiFetch(`/api/webhooks/${id}/test`, { method: "POST", body });
  if (!res.ok) {
    process.stderr.write(`Error: ${res.status}\n`);
    process.exit(1);
  }
  const data = await res.json();
  emit(data, cmd.optsWithGlobals());
}

export function registerWebhooks(program) {
  const webhooks = program.command("webhooks").description(t("webhooks.description"));

  webhooks
    .command("events")
    .description(t("webhooks.events.description"))
    .action(async (opts, cmd) => {
      emit(
        EVENT_TYPES.map((e) => ({ event: e })),
        cmd.optsWithGlobals()
      );
    });

  webhooks.command("list").description(t("webhooks.list.description")).action(runWebhooksList);

  webhooks.command("get <id>").description(t("webhooks.get.description")).action(runWebhooksGet);

  webhooks
    .command("add")
    .description(t("webhooks.add.description"))
    .requiredOption("--url <url>", t("webhooks.add.url"))
    .requiredOption("--events <list>", t("webhooks.add.events"), (v) => v.split(","))
    .option("--secret <s>", t("webhooks.add.secret"))
    .option(
      "--header <kv>",
      t("webhooks.add.header"),
      (v, prev) => [...(prev ?? []), parseHeader(v)],
      []
    )
    .option("--no-enabled", t("webhooks.add.no_enabled"))
    .action(runWebhooksAdd);

  webhooks
    .command("update <id>")
    .description(t("webhooks.update.description"))
    .option("--url <url>", t("webhooks.add.url"))
    .option("--events <list>", t("webhooks.add.events"), (v) => v.split(","))
    .option("--secret <s>", t("webhooks.add.secret"))
    .option("--header <kv>", t("webhooks.add.header"), (v, prev) => [...(prev ?? []), v], [])
    .option("--enabled <bool>", t("webhooks.update.enabled"), (v) => v === "true")
    .action(runWebhooksUpdate);

  webhooks
    .command("remove <id>")
    .description(t("webhooks.remove.description"))
    .option("--yes", t("webhooks.remove.yes"))
    .action(runWebhooksRemove);

  webhooks
    .command("test <id>")
    .description(t("webhooks.test.description"))
    .option("--event <e>", t("webhooks.test.event"), "request.completed")
    .action(runWebhooksTest);
}

```

### Core Architecture Module: `bin/cli/utils/cliToken.mjs`
```
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveDataDir } from "../data-dir.mjs";

// #13679 PR B: checked-in literal, used ONLY as a last-resort fallback (see
// getActiveSalt() below) — /etc/machine-id is commonly world-readable, so relying on
// this literal as the real default let any local user derive the same bearer token.
const BUILTIN_DEFAULT_SALT = "omniroute-cli-auth-v1";
const SALT_FILE_NAME = "cli-token-salt.json";
const PERSISTED_SALT_RE = /^[0-9a-f]{64}$/;
export const CLI_TOKEN_HEADER = "x-omniroute-cli-token";

let _cached = null;
let _cachedSalt = null;
let _cachedActiveSalt = null;

/** A `node --test` (or vitest) process that never opted into an explicit DATA_DIR must
 *  not write a salt file into the operator's real home directory. Mirrors
 *  dataPaths.ts::isTestContext() on the TS side. */
function isTestContext() {
  return (
    process.env.NODE_ENV === "test" ||
    !!process.env.VITEST ||
    !!process.env.NODE_TEST_CONTEXT ||
    process.execArgv.includes("--test") ||
    process.argv.includes("--test")
  );
}

function saltFilePath(dataDir) {
  return path.join(dataDir, SALT_FILE_NAME);
}

function readPersistedSalt(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const salt = parsed && typeof parsed === "object" ? parsed.salt : undefined;
    if (typeof salt === "string" && PERSISTED_SALT_RE.test(salt)) return salt;
  } catch {
    // Missing, unreadable, or corrupt — fall through to (re)generation.
  }
  return null;
}

/** Mirrors establishPersistedSalt() in src/lib/machineToken.ts — same resolution
 *  order, same salt file, same `wx`-flag create-race handling — so the CLI and the
 *  server converge on the same bearer token (docs/security/CLI_TOKEN.md). */
function establishPersistedSalt(dataDir) {
  const filePath = saltFilePath(dataDir);
  const existing = readPersistedSalt(filePath);
  if (existing) return existing;

  const generated = crypto.randomBytes(32).toString("hex");
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({ salt: generated }), { flag: "wx", mode: 0o600 });
    return generated;
  } catch (err) {
    if (err && err.code === "EEXIST") return readPersistedSalt(filePath);
    return null;
  }
}

/** Mirrors getActiveSalt() in src/lib/machineToken.ts so a rotated
 *  OMNIROUTE_CLI_SALT reaches the CLI too (docs/security/CLI_TOKEN.md). */
function getActiveSalt() {
  const envSalt = process.env.OMNIROUTE_CLI_SALT;
  if (envSalt) return envSalt;

  if (_cachedActiveSalt) return _cachedActiveSalt;

  const hasExplicitDataDir = !!(process.env.DATA_DIR && process.env.DATA_DIR.trim());
  if (!hasExplicitDataDir && isTestContext()) {
    _cachedActiveSalt = BUILTIN_DEFAULT_SALT;
    return _cachedActiveSalt;
  }

  const dataDir = resolveDataDir();
  const persisted = establishPersistedSalt(dataDir);
  _cachedActiveSalt = persisted || BUILTIN_DEFAULT_SALT;
  return _cachedActiveSalt;
}

export function deriveCliToken(machineIdModule, salt) {
  try {
    // node-machine-id is CommonJS: under `await import()` its exports land on
    // `.default`, so destructuring `machineIdSync` off the namespace yields
    // undefined and calling it throws — which the catch below turned into an
    // empty token, silently disabling CLI auth for every management request.
    // Same resolution order as src/lib/machineToken.ts.
    const machineIdSync = machineIdModule?.machineIdSync || machineIdModule?.default?.machineIdSync;
    if (typeof machineIdSync !== "function") return "";
    // machineIdSync(true) returns the original unhashed hardware ID — mirrors
    // getMachineTokenSync() in src/lib/machineToken.ts (#10148 cliToken hardening).
    const rawId = machineIdSync(true);
    if (!rawId) return "";
    return crypto.createHmac("sha256", rawId).update(salt).digest("hex");
  } catch {
    return "";
  }
}

export async function getCliToken() {
  const salt = getActiveSalt();
  if (_cached !== null && _cachedSalt === salt) return _cached;
  try {
    const imported = await import("node-machine-id");
    const token = deriveCliToken(imported, salt);
    if (!token) {
      // Swallowing here changes control flow (every management call goes out
      // unauthenticated and 401s), so leave a breadcrumb rather than failing mute.
      console.debug("[CLI_TOKEN] machine-id resolution failed, CLI auth disabled");
    }
    _cached = token;
  } catch (e) {
    console.debug("[CLI_TOKEN] machine-id resolution failed, CLI auth disabled:", e);
    _cached = "";
  }
  _cachedSalt = salt;
  return _cached;
}

```

### Core Architecture Module: `bin/cli/utils/clipboard.mjs`
```
import { execSync } from "node:child_process";

export function copyToClipboard(text) {
  try {
    const execOpts = { input: text, stdio: ["pipe", "ignore", "ignore"], timeout: 2000 };
    if (process.platform === "darwin") {
      execSync("pbcopy", execOpts);
    } else if (process.platform === "win32") {
      execSync("clip", execOpts);
    } else {
      try {
        execSync("xclip -selection clipboard", execOpts);
      } catch {
        try {
          execSync("xsel --clipboard --input", execOpts);
        } catch {
          execSync("wl-copy", execOpts);
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function isClipboardSupported() {
  if (process.platform === "darwin" || process.platform === "win32") return true;
  try {
    execSync("which xclip || which xsel || which wl-copy", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

```

### Core Architecture Module: `bin/cli/utils/config-home-guard.mjs`
```
import { printError, printInfo } from "../io.mjs";

/**
 * Container guard for CLI-tool config writes.
 *
 * `omniroute setup-*` writes to `~/.codex`, `~/.claude`, ... — paths that only
 * mean something on the operator's host. Run the same command inside the
 * OmniRoute container and the write "succeeds" into an ephemeral layer that no
 * host CLI ever reads and that disappears with the container. This guard turns
 * that silent no-op into an actionable refusal.
 *
 * Bind-mounted targets (the compose `host` profile) are allowed through: the
 * mount is the operator's explicit statement that the path reaches the host.
 */

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

/** Exit code for a refused write — matches the CLI's usage-error convention. */
export const CONTAINER_WRITE_EXIT_CODE = 2;

function envAllowsContainerWrite(env = process.env) {
  return TRUE_VALUES.has(
    String(env.OMNIROUTE_ALLOW_CONTAINER_CONFIG_WRITE ?? "")
      .trim()
      .toLowerCase()
  );
}

/**
 * Classify a pending config write.
 *
 * @param {string} targetPath Absolute path the command is about to write.
 * @param {{
 *   toolLabel?: string,
 *   hostCommand?: string,
 *   allowContainerWrite?: boolean,
 *   dryRun?: boolean,
 *   env?: NodeJS.ProcessEnv,
 *   deps?: object,
 * }} options
 * @returns {Promise<{ok: boolean, message?: string, warning?: string}>}
 */
export async function assertHostConfigTarget(targetPath, options = {}) {
  const {
    toolLabel,
    hostCommand,
    allowContainerWrite = false,
    dryRun = false,
    env = process.env,
    deps,
  } = options;

  let describeContainerTarget;
  let buildContainerWriteRefusal;
  let CLI_OVERRIDE_HINT;
  try {
    // `.ts` extension is required so the published package (which ships only TS
    // source, resolved through tsx) can load these. See #2509.
    ({ describeContainerTarget } = await import("../../../src/shared/utils/containerEnv.ts"));
    ({ buildContainerWriteRefusal, CLI_OVERRIDE_HINT } =
      await import("../../../src/shared/utils/containerConfigGuard.ts"));
  } catch {
    // Fail open: a guard that cannot load must not block a legitimate host run.
    return { ok: true };
  }

  const info = describeContainerTarget(targetPath, deps);
  if (!info.ephemeral) return { ok: true };

  if (dryRun) {
    return {
      ok: true,
      warning:
        `[dry-run] ${targetPath} is inside the container and is not mounted from the host — ` +
        `a real run would be refused. See --allow-container-write.`,
    };
  }

  if (allowContainerWrite || envAllowsContainerWrite(env)) {
    return {
      ok: true,
      warning:
        `Writing to ${targetPath} inside the container as requested — this file is lost when ` +
        `the container is recreated and host CLIs will not see it.`,
    };
  }

  return {
    ok: false,
    message: buildContainerWriteRefusal(targetPath, {
      toolLabel,
      hostCommand,
      overrideHint: CLI_OVERRIDE_HINT,
    }),
  };
}

/**
 * Container check for commands that write nothing but still print host-oriented
 * instructions (setup-cursor). Fails closed to `false` so a broken import never
 * turns into a spurious warning.
 */
export async function isContainerRuntime(deps) {
  try {
    const { isRunningInContainer } = await import("../../../src/shared/utils/containerEnv.ts");
    return isRunningInContainer(deps);
  } catch {
    return false;
  }
}

/**
 * Guard + report. Returns 0 to continue, or CONTAINER_WRITE_EXIT_CODE when the
 * caller should abort and return that code.
 */
export async function guardHostConfigTarget(targetPath, options = {}) {
  const result = await assertHostConfigTarget(targetPath, options);
  if (result.warning) printInfo(result.warning);
  if (result.ok) return 0;
  printError(result.message);
  return CONTAINER_WRITE_EXIT_CODE;
}

```

### Core Architecture Module: `bin/cli/utils/ensureAndroidCacheDir.mjs`
```
/**
 * Next.js cache-dir prep for Android / Termux.
 *
 * Next.js `getCacheDirectory()` has no dedicated branch for
 * `process.platform === "android"`. On that path it only accepts a cache root
 * that *already* exists (`fs.existsSync` on `~/.cache` or a generic tmp dir).
 * If neither exists it prints `Unsupported platform: android` and exits — the
 * CLI can still look "running" while every request returns a bare HTTP 500
 * because the instrumentation hook never loads (and so neither does logging).
 *
 * Termux Node sometimes reports `platform === "android"` and sometimes
 * `"linux"` with Termux env signals (`TERMUX_VERSION` / `PREFIX`). Creating
 * `~/.cache` (and pointing `XDG_CACHE_HOME` at it when unset) makes the probe
 * succeed on both shapes.
 *
 * Call this *before* spawning or loading Next.js. Safe no-op on desktop
 * platforms that are not Termux.
 */

import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { isTermux } from "../../../scripts/build/postinstallSupport.mjs";

/**
 * @param {string} [platform]
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function needsAndroidCacheDirPrep(platform = process.platform, env = process.env) {
  return platform === "android" || isTermux(env);
}

/**
 * @param {() => string} [homedirFn]
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function resolveAndroidCacheDir(homedirFn = homedir, env = process.env) {
  if (typeof env.XDG_CACHE_HOME === "string" && env.XDG_CACHE_HOME.trim()) {
    return env.XDG_CACHE_HOME;
  }
  return join(homedirFn(), ".cache");
}

/**
 * Ensure a writable cache directory exists for Next.js on Android/Termux.
 *
 * @param {object} [options]
 * @param {string} [options.platform]
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {() => string} [options.homedirFn]
 * @param {typeof mkdirSync} [options.mkdirSyncFn]
 * @param {typeof existsSync} [options.existsSyncFn]
 * @param {boolean} [options.setEnv] When true (default), set `XDG_CACHE_HOME` on `env`
 *   if unset so child processes inherit a known-writable cache root.
 * @returns {{ prepared: boolean, cacheDir: string | null, created: boolean }}
 */
export function ensureAndroidCacheDir(options = {}) {
  const {
    platform = process.platform,
    env = process.env,
    homedirFn = homedir,
    mkdirSyncFn = mkdirSync,
    existsSyncFn = existsSync,
    setEnv = true,
  } = options;

  if (!needsAndroidCacheDirPrep(platform, env)) {
    return { prepared: false, cacheDir: null, created: false };
  }

  const cacheDir = resolveAndroidCacheDir(homedirFn, env);
  let created = false;
  if (!existsSyncFn(cacheDir)) {
    mkdirSyncFn(cacheDir, { recursive: true });
    created = true;
  }

  if (setEnv && !(typeof env.XDG_CACHE_HOME === "string" && env.XDG_CACHE_HOME.trim())) {
    env.XDG_CACHE_HOME = cacheDir;
  }

  return { prepared: true, cacheDir, created };
}

/**
 * Detect Next.js instrumentation-hook failures that leave the server looking
 * "up" while requests get silent HTTP 500s (typical when the Android cache
 * probe failed before logging started).
 *
 * @param {string} text
 * @returns {boolean}
 */
export function isFatalInstrumentationHookFailure(text) {
  if (!text) return false;
  // Next.js wraps ANY throw inside instrumentation.register() with the generic
  // "An error occurred while loading instrumentation hook:" prefix, on every
  // platform (node_modules/next/dist/server/web/globals.js). That prefix alone
  // therefore cannot identify the Android/Termux cache-probe failure — a bare
  // generic instrumentation error on win32/desktop would be misreported as the
  // Android bug and hide the real cause. Only match when the text actually
  // carries the Android platform marker that Next's getCacheDirectory() emits.
  // #10028
  return /Unsupported platform:\s*android/i.test(text);
}

/**
 * Detect any fatal boot-time diagnostic guarded by the `[STARTUP] Fatal:`
 * prefix (`src/instrumentation-node.ts::ensureDbReadyForBoot()`,
 * `src/instrumentation.ts::register()`, and any future guard using the same
 * marker). #13314: in the default `omniroute serve` mode (no `--log`),
 * `ServerSupervisor` only buffers stdout/stderr and flushes it to the real
 * console on exit/crash/readiness-timeout — so if the HTTP listener still
 * comes up after a fatal boot diagnostic was already printed (e.g. the
 * better-sqlite3 / node:sqlite driver cascade failing hard), the operator
 * sees "OmniRoute is running!" with zero visible diagnostic anywhere, and
 * every route 500s. This generalizes the #10028 Android/Termux carve-out to
 * every `[STARTUP] Fatal:` guard, not just that one platform-specific string.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function isFatalStartupDiagnostic(text) {
  if (!text) return false;
  return /^\[STARTUP\] Fatal:/m.test(text);
}

/**
 * Operator-facing hint when that instrumentation failure shows up in child
 * output — defense in depth if prep was skipped or a future Next.js probe
 * regresses.
 *
 * @param {string} [cacheDir]
 * @returns {string}
 */
export function formatAndroidInstrumentationFailureHint(cacheDir) {
  const dir = cacheDir || join(homedir(), ".cache");
  return (
    `\n\x1b[31m✖ Next.js instrumentation failed on Android/Termux (likely missing cache dir).\x1b[0m\n` +
    `  OmniRoute tried to create a writable cache at:\n` +
    `    \x1b[36m${dir}\x1b[0m\n` +
    `  Manual workaround (survives reinstalls — do NOT patch dist/server.js):\n` +
    `    \x1b[36mmkdir -p ~/.cache\x1b[0m\n` +
    `    then restart: \x1b[36momniroute serve\x1b[0m\n` +
    `  See: docs/guides/TERMUX_GUIDE.md → Troubleshooting → Unsupported platform: android\n`
  );
}

```

### Core Architecture Module: `bin/cli/utils/environment.mjs`
```
import { existsSync, readFileSync } from "node:fs";

export function detectRestrictedEnvironment() {
  if (process.env.CODESPACES === "true" || process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN) {
    return { type: "github-codespaces", canOpenBrowser: false, canUseTray: false };
  }

  if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) {
    return {
      type: "wsl",
      canOpenBrowser: true,
      canUseTray: false,
      hint: "Browser opens in Windows host.",
    };
  }

  if (process.env.GITPOD_WORKSPACE_ID) {
    return { type: "gitpod", canOpenBrowser: false, canUseTray: false };
  }

  if (process.env.REPL_ID || process.env.REPL_SLUG) {
    return { type: "replit", canOpenBrowser: false, canUseTray: false };
  }

  if (process.env.CI) {
    return { type: "ci", canOpenBrowser: false, canUseTray: false };
  }

  if (existsSync("/.dockerenv")) {
    return { type: "docker", canOpenBrowser: false, canUseTray: false };
  }

  try {
    if (existsSync("/proc/1/cgroup") && readFileSync("/proc/1/cgroup", "utf8").includes("docker")) {
      return { type: "docker", canOpenBrowser: false, canUseTray: false };
    }
  } catch {}

  if (!process.stdin.isTTY) {
    return { type: "non-interactive", canOpenBrowser: false, canUseTray: false };
  }

  return { type: "desktop", canOpenBrowser: true, canUseTray: true };
}

export function getEnvBanner() {
  const env = detectRestrictedEnvironment();
  if (env.type === "desktop") return null;
  return `[${env.type}] ${env.hint || "limited environment detected"}`;
}

```

### Core Architecture Module: `bin/cli/utils/parseEnvValue.mjs`
```
/**
 * Parse a `.env` value with dotenv-compatible comment handling.
 *
 * Without this, `KEY=value  # note` stored the comment text as part of the
 * value. The shipped .env ships exactly such a line for QUOTA_STORE_DRIVER, and
 * consumers compare it with `===`, so annotating a variable inline silently
 * disabled it (#10100).
 *
 * Quoted values are returned verbatim — a `#` inside quotes is data. For
 * unquoted values a `#` *preceded by whitespace* starts a comment, so
 * `pass#word` is preserved.
 */
export function parseEnvValue(raw) {
  const value = String(raw).trim();

  const quoted = value.match(/^(['"])([\s\S]*)\1\s*(?:#.*)?$/);
  if (quoted) return quoted[2];

  const commentIdx = value.search(/\s#/);
  return (commentIdx === -1 ? value : value.slice(0, commentIdx)).trim();
}

```

### Core Architecture Module: `bin/cli/utils/pid.mjs`
```
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveDataDir } from "../data-dir.mjs";

// #9455: "supervisor" must be tracked so killAllSubprocesses() can stop the
// supervisor process, not just the child server it spawned (and respawns).
const SERVICES = ["server", "supervisor", "mitm", "tunnel/cloudflared", "tunnel/tailscale"];

function getServicePidPath(service) {
  return join(resolveDataDir(), service, ".pid");
}

export function writePidFile(service, pid) {
  try {
    const dir = join(resolveDataDir(), service);
    mkdirSync(dir, { recursive: true });
    writeFileSync(getServicePidPath(service), String(pid), "utf8");
    return true;
  } catch {
    return false;
  }
}

export function readPidFile(service) {
  try {
    const file = getServicePidPath(service);
    if (!existsSync(file)) return null;
    const pid = parseInt(readFileSync(file, "utf8").trim(), 10);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

export function cleanupPidFile(service) {
  try {
    unlinkSync(getServicePidPath(service));
  } catch {}
}

export function killAllSubprocesses() {
  for (const service of SERVICES) {
    const pid = readPidFile(service);
    if (!pid) continue;
    try {
      process.kill(pid, "SIGTERM");
    } catch {}
    cleanupPidFile(service);
  }
}

export function isPidRunning(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// A port that is already owned must be reported, not spawned into. `omniroute
// serve` used to hand the conflict to the child, which died with EADDRINUSE
// twice on the supervisor's restart budget and printed three raw Node stack
// traces without ever saying another instance owned the port. It did that
// AFTER writing the pid files, so the doomed second instance de-registered the
// healthy running one (supervisor/.pid left pointing at the dead starter,
// server/.pid deleted outright).
//
// Discovery mirrors killByPort() in bin/cli/commands/stop.mjs (netstat on
// win32, lsof elsewhere). Both now scope discovery to LISTEN sockets: a bare
// `lsof -ti :PORT` also returns every client connected to the port, so a
// client socket (for example a long-lived gateway connection left in
// CLOSE_WAIT after its peer exited) made the preflight report a free port as
// busy and drove omniroute.service into a restart crash-loop.
export async function findListeningPids(port, deps = {}) {
  const platform = deps.platform || process.platform;
  let exec = deps.execFileAsync;
  if (!exec) {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    exec = promisify(execFile);
  }
  try {
    if (platform === "win32") {
      const { stdout } = await exec("netstat", ["-ano"]);
      return parseNetstatListeningPids(stdout, port);
    }
    const { stdout } = await exec("lsof", ["-nP", "-t", `-iTCP:${port}`, "-sTCP:LISTEN"]);
    return stdout
      .trim()
      .split("\n")
      .map((entry) => parseInt(entry, 10))
      .filter((entry) => Number.isFinite(entry) && entry > 0);
  } catch (err) {
    // POSIX lsof exits 1 with empty output when there are simply no matches.
    // That is the normal "port is free" result, not a discovery failure.
    if (
      platform !== "win32" &&
      err?.code === 1 &&
      !String(err?.stdout ?? "").trim()
    ) {
      return [];
    }
    // Tool missing (ENOENT) or genuinely unusable: "no listener" cannot be
    // distinguished from "cannot look" here, so report null and let the serve
    // preflight bind-probe the port instead (#14518).
    return null;
  }
}

// Bind-probe a port without any external binary: try to listen on it. Answers
// "is anything holding this port" on hosts without lsof/netstat (Termux, slim
// containers) and on any other discovery failure. EADDRINUSE from the probe
// attempt means the port is held; EACCES (privileged port) and friends are
// reported as free — the guard must not block a legitimate start it cannot
// actually observe (#14518 keeps the false-"busy" failure mode the worse one).
export async function probePortFree(port, deps = {}) {
  const net = deps.net || (await import("node:net"));
  const bindable = (host) =>
    new Promise((resolve) => {
      const probe = net.createServer();
      probe.once("error", (err) => {
        probe.close();
        resolve(err.code !== "EADDRINUSE");
      });
      probe.listen({ port, host }, () => {
        probe.close(() => resolve(true));
      });
    });
  // macOS lets a bind on one address succeed while another address holds the
  // port, so a server on 0.0.0.0 (the default), 127.0.0.1 or ::1 (localhost) is
  // only visible to a probe on that same address. A host without one of these
  // addresses gets EADDRNOTAVAIL, which reads as free.
  for (const host of [undefined, "0.0.0.0", "127.0.0.1", "::1"]) {
    if (!(await bindable(host))) return false;
  }
  return true;
}

function parseNetstatListeningPids(stdout, port) {
  const portCol = `:${port}`;
  const pids = [];
  for (const line of stdout.split(/\r?\n/)) {
    const cols = line.trim().split(/\s+/);
    // Proto  LocalAddress  ForeignAddress  State  PID
    if (cols.length < 5) continue;
    if (cols[0] !== "TCP" && cols[0] !== "TCPv6") continue;
    if (!(cols[1] || "").endsWith(portCol)) continue;
    if ((cols[cols.length - 2] || "").toUpperCase() !== "LISTENING") continue;
    const pid = parseInt(cols[cols.length - 1], 10);
    if (Number.isFinite(pid) && pid > 0 && !pids.includes(pid)) pids.push(pid);
  }
  return pids;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A probe that times out is classified "hanging" and never counts toward
// readiness (#6800), so a FIXED per-probe timeout puts a hard ceiling on how
// slow a healthy first response is allowed to be. On a cold Windows boot the
// health route resolves ~10 dynamic imports and reads the DB before it can
// answer; when that first response lands past the ceiling the poll can never
// succeed, because each abort discards the in-flight request before the route
// finishes (its own 1s payload cache is never populated either) and the next
// probe restarts the same work into the same ceiling — for the whole budget.
// The CLI then printed "⚠ Server did not respond within 60s" over a server
// that went on to serve traffic normally. Escalating the timeout keeps #6800's
// guarantee (a socket that never answers still yields "hanging" forever) while
// letting a slow-but-real response actually be observed.
const INITIAL_PROBE_TIMEOUT_MS = 2000;
const MAX_PROBE_TIMEOUT_MS = 15000;
// Floor for the last probe of a budget that is nearly spent — long enough for a
// loopback round-trip, short enough not to overrun the caller's timeout.
const MIN_PROBE_TIMEOUT_MS = 250;

// #2460: Default raised from 15s to 60s so Windows users (slower Next.js
// cold start due to filesystem watchers, antivirus, etc.) get a working
// "server ready" signal instead of a phantom timeout while the server is
// still booting. #13369: Made configurable via OMNIROUTE_READY_TIMEOUT_MS
// so operators on slow cold starts (e.g. 6+ min Windows boots) can raise
// the budget instead of hitting the warning on every start.
//
// TCP fallback marks the server as ready when the port
// has been listening for >= 3s consecutively AND the health route is
// actively rejecting/resetting connections fast (route not mounted yet,
// but the HTTP server is clearly alive and responsive) — never for a
// socket that merely accepts TCP and then hangs without ever completing
// a single request (#6800: that's a still-booting/CPU-bound process, not
// a "route not mounted" gap, and must NOT be reported as ready).
const DEFAULT_READY_TIMEOUT_MS = 60_000;

export function resolveReadyTimeoutMs(overrides = {}) {
  if (typeof overrides.timeoutMs === "number" && overrides.timeoutMs > 0) {
    return overrides.timeoutMs;
  }
  const envValue = Number.parseInt(process.env.OMNIROUTE_READY_TIMEOUT_MS || "", 10);
  return Number.isFinite(envValue) && envValue > 0 ? envValue : DEFAULT_READY_TIMEOUT_MS;
}

// `onOutcome` receives every probe classification so a caller can tell a
// "nothing ever bound the port" timeout apart from a "port is up, the health
// route is just still warming" one when it reports the failure.
export async function waitForServer(port, timeout = 60000, { onOutcome } = {}) {
  const start = Date.now();
  let tcpListeningSince = null;
  let probeTimeout = INITIAL_PROBE_TIMEOUT_MS;
  while (Date.now() - start < timeout) {
    const remaining = timeout - (Date.now() - start);
    const outcome = await pollHealthOnce(
      port,
      Math.max(MIN_PROBE_TIMEOUT_MS, Math.min(probeTimeout, remaining))
    );
    onOutcome?.(outcome);
    if (outcome === "ready") return true;
    if (outcome === "fast-reject") {
      if (tcpListeningSince === null) tcpListeningSince = Date.now();
      if (Date.now() - tcpListeningSince >= 3000) return true;
    } else {
      // "hanging" (request timed out with no response at all) or
      // "not-listening" — neither counts toward the grace window.
      tcpListeningSince = null;
      // Only a hang says "this server may simply need longer to answer";
      // widen the next probe instead of aborting into the same ceiling again.
      if (outcome === "hanging") {
        probeTimeout = Math.min(probeTimeout * 2, MAX_PROBE_TIMEOUT_MS);
      }
    }
    await sleep(500);
  }
  return false;
}

// Polls /api/monitoring/health once and classifies the outcome:
// - "ready": got a 2xx HTTP response.
// - "fast-reject": got a non-2xx HTTP response, or the connection was
//   actively refused/reset (not a timeout) — the HTTP server is alive and
//   answering quickly, just not routing this endpoint yet (#2460).
// - "hanging": the request timed out waiti
```

### Core Architecture Module: `bin/cli/utils/serverHost.mjs`
```
import { hostname, platform } from "node:os";

/**
 * Resolve the bind host passed to the standalone Next.js server.
 *
 * HOSTNAME is a standard shell variable on Unix-like systems, so only the
 * dedicated OmniRoute variable is treated as configuration there. Windows
 * keeps the legacy HOSTNAME fallback for compatibility with existing .env
 * files, while still ignoring the OS-reported machine name.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @param {NodeJS.Platform} [runtimePlatform]
 * @param {string} [machineHostname]
 * @returns {string}
 */
export function resolveServerHost(
  env = process.env,
  runtimePlatform = platform(),
  machineHostname = hostname()
) {
  if (env.OMNIROUTE_SERVER_HOST) return env.OMNIROUTE_SERVER_HOST;
  if (runtimePlatform === "win32" && env.HOSTNAME && env.HOSTNAME !== machineHostname) {
    return env.HOSTNAME;
  }
  return "0.0.0.0";
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/**
 * Boot-time exposure warning (GHSA-wmgv-ph3p-rv57): the shipped default binds
 * all interfaces while the inference plane requires no credentials, so any
 * LAN peer can spend the operator's quota. That local-first posture is a
 * deliberate, documented default — but it must be LOUD at startup so an
 * operator who never read the docs still learns the two escape hatches.
 *
 * Returns the warning text when the server will listen on a non-loopback
 * interface with no API-key requirement, or null when the exposure is closed.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string} [host]
 * @returns {string | null}
 */
export function resolveExposureWarning(env = process.env, host = resolveServerHost(env)) {
  if (LOOPBACK_HOSTS.has(host)) return null;
  const requireKey = String(env.REQUIRE_API_KEY || "")
    .trim()
    .toLowerCase();
  if (requireKey === "true" || requireKey === "1" || requireKey === "yes") return null;
  return (
    `SECURITY: listening on ${host} with NO API-key requirement — the inference ` +
    `plane (/v1/*) is reachable by ANY device that can route to this host, and ` +
    `requests are billed to your configured providers. This local-first default ` +
    `is intentional, but on an untrusted network either set REQUIRE_API_KEY=true ` +
    `or bind loopback with OMNIROUTE_SERVER_HOST=127.0.0.1.`
  );
}

```

### Core Architecture Module: `bin/cli/utils/storageKeyProvision.mjs`
```
/**
 * Decide whether a CLI invocation should provision (generate + persist) the
 * STORAGE_ENCRYPTION_KEY into DATA_DIR/.env.
 *
 * Purely informational invocations must NOT create `~/.omniroute/.env` or write
 * a key — they never touch encrypted storage. Generating a 32-byte key and a
 * `.env` file just to print `omniroute --version` (or `--help`) is a surprising
 * side effect: a read-only command should not mutate the data dir.
 *
 * Returns FALSE only for: `--version`/`-V` or `--help`/`-h` anywhere in the args,
 * and the `help`/`completion` subcommands.
 *
 * Returns TRUE for everything else, INCLUDING a bare `omniroute` (no args) — the
 * `serve` command is `isDefault: true`, so a bare invocation starts the server,
 * which needs the encryption key. This preserves the #1622 persistence fix
 * (key generated on first real run and reused across restarts).
 *
 * @param {string[]} argv - process.argv (node + script + args).
 * @returns {boolean}
 */
const INFO_FLAGS = new Set(["-h", "--help", "-V", "--version"]);
const INFO_COMMANDS = new Set(["help", "completion"]);

export function shouldProvisionStorageKey(argv) {
  const args = Array.isArray(argv) ? argv.slice(2) : [];
  // Bare `omniroute` runs the default `serve` command → must provision.
  if (args.length === 0) return true;
  if (args.some((a) => INFO_FLAGS.has(a))) return false;
  if (INFO_COMMANDS.has(args[0])) return false;
  return true;
}

```

### Core Architecture Module: `bin/cli/utils/versionFastPath.mjs`
```
/**
 * Decide whether a CLI invocation is a bare `--version`/`-V` query that should
 * short-circuit BEFORE the runtime polyfill import, env-file loading, and
 * Commander's command registration (~70 command modules) are loaded.
 *
 * Scope is intentionally narrow — only a single, unambiguous `--version`/`-V`
 * argument fast-paths. Anything else (extra args, a subcommand, `--help`,
 * global options like `--lang`/`--output` alongside it) falls through to the
 * normal Commander flow. Unlike `--version`, OmniRoute's `--help` output is
 * generated dynamically from every registered subcommand, so skipping
 * registration would change (truncate) the help text — that flag is
 * deliberately NOT fast-pathed here.
 *
 * Mirrors the intent of upstream 9router PR #2414 (fast-path help/version
 * before expensive self-heal hooks), adapted to OmniRoute's Commander-based
 * CLI where the equivalent expensive work is eager command registration
 * rather than npm-install-based runtime self-healing.
 *
 * @param {string[]} argv - process.argv (node + script + args).
 * @returns {boolean}
 */
export function isVersionFastPath(argv) {
  const args = Array.isArray(argv) ? argv.slice(2) : [];
  return args.length === 1 && (args[0] === "--version" || args[0] === "-V");
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #15284** (2026-10-01): **fix(docker): published 3.8.51 image was built 6 days before the release, so merged fixes are missing**
  *Symptoms*: ## Summary  The published `3.8.51` image on Docker Hub **was not built from the `v3.8.51` release commit**. Its `Created` timestamp predates the release by six days, so commits merged into `release/v3.8.51` during that window are **absent from the published image** — including everything merged after 2026-09-24.  The tag name and Docker Hub's `last_updated` both say 2026-09-30; only the image's own metadata reveals the real build date.  ## Evidence  | Fact | Value | |---|---| | Image `Created` (from `docker image inspect`) | **2026-09-24T11:12:16.677096833Z** | | Docker Hub `last_updated` for the `3.8.51` tag | 2026-09-30T04:44:45 | | `v3.8.51` release published | 2026-09-30T01:41:50Z | | Image digest | `sha256:8bd462c9f60d8eda79329cfbb6ea7ea723505fe7721beb944f3d43835409e218` |  The digest is **stable across re-pulls**, so this is not a stale local cache — the pushed artifact itself is the old build.  ### Reproducing  ```bash docker pull diegosouzapw/omniroute:3.8.51 docker image inspect diegosouzapw/omniroute:3.8.51 --format '{{.Created}}' # 2026-09-24T11:12:16.677096833Z ```  ### Confirming a specific commit is missing  `#14845` ("fix(compression): share one severity vocabulary across every RTK stage") merged into `release/v3.8.51` on **2026-09-29T00:48:36Z**. Its new file is present in the tag's source and absent from the published image:  ```bash # Present in the tag's source tree (HTTP 200) curl -sI https://raw.githubusercontent.com/diegosouzapw/omniroute/v3.8.51/open-ss
  **Post-Mortem & Fix Analysis**:
  > Thanks, this is a clean and well-documented reproduction. It is the same root cause as #15184 (the `:3.8.51` / `:latest` amd64 digests in the manifest index are stale, built 2026-09-24), so I am closing this as a duplicate to keep the tracking in one place. Your check confirming that `severityVocabulary.ts` is in the v3.8.51 tag but absent from the image is useful evidence; I am keeping it in mind for #15184, and your suggestion to assert in CI that the image build timestamp is not older than the commit it claims to build is a good guardrail that we will track there. Until the images are republished, building from the v3.8.51 tag or using the npm package (`omniroute@3.8.51`) gives you the full release.

- **Issue #15275** (2026-10-01): **fix(backend): omniroute skills execute sends Accept: text/event-stream only, gets HTTP 406 and crashes Node**
  *Symptoms*: **Version:** v3.8.50 (Windows) **Area:** CLI  ## Description `omniroute skills execute <skill> --input '{...}'` fails with HTTP 406 and then crashes the Node process with `assert UV_HANDLE_CLOSING`.  ## Root cause `bin/cli/mcpClient.mjs` (line ~29) sends `Accept: text/event-stream` only, but the server requires `Accept: application/json, text/event-stream`, so it responds 406; the CLI then crashes on teardown.  ## Steps to reproduce 1. Gateway running, skill installed (e.g. built-in `web_search` registered via `POST /api/skills/install`). 2. Run: `omniroute skills execute web_search --input '{"query":"test","max_results":3}'` 3. Observe: HTTP 406, then Node process crash (`assert UV_HANDLE_CLOSING`).  ## Expected CLI sends the correct `Accept` header and the command succeeds.  ## Workaround REST `POST /api/skills/executions` with the inference API key works perfectly (verified: SUCCESS in 1203ms with results).
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report and the root cause. This is already fixed: `bin/cli/mcpClient.mjs` now sends `Accept: application/json, text/event-stream` on every MCP Streamable HTTP POST (`MCP_ACCEPT`) and also handles SSE-framed JSON-RPC responses, so the 406 no longer happens. The fix landed in #14549 and is part of v3.8.51, which is already published on npm (`npm i -g omniroute@3.8.51`). The `UV_HANDLE_CLOSING` assert you saw came right after the failed request, so it should go away with the 406. Please retry `omniroute skills execute web_search --input '{...}'` on 3.8.51 and, if the assert still shows up on a successful call, comment here with the Node version and we will reopen. Closing as fixed.

- **Issue #15264** (2026-10-01): **fix(providers): grok-cli returns 426 because advertised client version (0.2.106) is below upstream minimum (1.0.13)**
  *Symptoms*: ### OmniRoute Version  3.8.50  ### Installation Method  npm (global)  ### Operating System  Windows  ### OS Version  Windows 11  ### Node.js Version  v24.14.1  ### Provider(s) Involved  Grok Build (grok-cli)  ### Model(s) Involved  grok-4.7, grok-4.6, grok-4.5, grok-composer-2.5-fast  ### Client Tool  Claude Code  ### Description  Every request to the grok-cli (Grok Build) provider fails with HTTP 426:  [426]: Your Grok CLI version (0.2.106) is outdated. Please update to version 1.0.13 or later via `grok update` or the installation documentation.  cli-chat-proxy.grok.com now enforces a minimum client version of 1.0.13, but OmniRoute still advertises 0.2.106. Other projects using the same proxy hit the same error today after xAI raised the minimum (e.g. pi-grok-cli, VansRouter#153, sub2api#7778). Updating OmniRoute to the latest version, syncing accounts and testing all models does not help. As a side effect, the dashboard also shows "Model 'grok-composer-2.5-fast' is not available in the active live catalog for provider 'grok-cli'".  ### Steps to Reproduce  1. Connect a Grok Build account (grok-cli) via the import-token flow 2. Send a request to grok-cli/grok-4.7 (e.g. through Claude Code) 3. See 426 error in the request log  ### Expected Behavior  The request succeeds. The advertised client version should be bumped to >= 1.0.13 (ideally overridable via an env var so future minimum-version bumps don't need a code change).  ### Actual Behavior  Every request to grok-cli/grok-4
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. This was fixed by #14626 (merged into release/v3.8.51), which makes the grok-cli executor advertise client version 1.0.41 (`open-sse/config/grokBuild.ts:11`, used for `x-grok-client-version` and the User-Agent), above the 1.0.13 minimum. v3.8.51 is on npm, so please upgrade from 3.8.50 (`npm i -g omniroute@latest`) and re-test; if you run Docker, note that the :3.8.51/:latest amd64 tags are currently stale (#15184), so use npm or build from source until that is republished. The stale-catalog message for grok-composer-2.5-fast was a side effect of the 426 on model sync and should clear once requests succeed. An env var to override the advertised version is not implemented (the version is a constant); feel free to open a separate enhancement if you want that. Closing as fixed; reopen if it still fails on 3.8.51.

- **Issue #15216** (2026-10-02): **fix(api): Responses translator unpaired trailing function_call 400s instead of being dropped/repaired**
  *Symptoms*: ## Summary When a Chat Completions request carries an assistant message with `tool_calls` but one call has no matching trailing `role: tool` output, the Responses translator forwards an unpaired `function_call` item in the Responses input. A strict upstream Responses endpoint rejects it with `400 'No tool output found for function call <id>'`.  ## Package / version - npm `omniroute` 3.8.51  ## Repro steps 1. `POST /v1/chat/completions` with a Chat Completions body:    - a user message (e.g. `Say OK.`)    - an assistant message with `tool_calls: [{ id: 'call_orphan_livecheck', ... }]`    - NO subsequent `role: tool` message with `tool_call_id: 'call_orphan_livecheck'` 2. Translator builds Responses input containing the unpaired `function_call` item in trailing position. 3. Strict upstream (Responses endpoint) answers `400 'No tool output found for function call call_orphan_livecheck'`.  Probe evidence: `live_orphan_and_lane.js` check (c) — same POST shape against a local gateway, unguarded path returns the 400 above, guarded path returns 200.  ## Expected vs actual - Expected: trailing orphaned `function_call` items are dropped or repaired (e.g. synthesized empty output) before hitting upstream, consistent with how mid-history orphans self-heal (observed 200 via synthesized empty output). - Actual: trailing orphans pass through unpaired and the request 400s.  ## Suggested fix Mirror the output-direction filter to the call direction: when building Responses input, drop (or synt
  **Post-Mortem & Fix Analysis**:
  > Thanks for the clear repro. The cause is in `open-sse/translator/request/openai-responses/toResponses.ts` (~293-352): assistant `tool_calls` become `function_call` items, but a `function_call_output` is only emitted when a matching `role: tool` message follows, so a trailing orphan reaches the strict upstream unpaired. A fix is proposed in PR #15231 (pairs unpaired `function_call` items with synthesized outputs, with a regression test), currently open and under review against release/v3.8.52, so it is not released yet. Keeping this open until that PR merges and ships.

- **Issue #15208** (2026-10-02): **fix(api): Combo entries do not expose member capabilities: a vision:true member still yields multimodal:false**
  *Symptoms*: **Version:** OmniRoute 3.8.50 (Windows, local server)  ## What happens  `GET /v1/models` for the member:  ```json {"id":"codex/gpt-6.1-sol","parent":"cx/gpt-6.1-sol","context_length":872000,  "capabilities":{"vision":true,"tool_calling":true,"reasoning":true}} ```  For the combo that routes to it:  ```json {"id":"_gpt Sol Latest combo","owned_by":"combo","context_length":300000,  "max_input_tokens":872000,"capabilities":{"tool_calling":true,"reasoning":true}} ```  No `vision` and no `input_modalities`. `GET /api/combos` for the same combo reports:  ```json "capabilities":{"multimodal":false,"reasoning":true,"caching":false} ```  ## Cause  The combo's `capabilities` block is not stored (`combos.data` has no such key), so it is derived at read time, and that derivation ignores the members' `capabilities.vision`. Note that the combo *does* aggregate `max_input_tokens` from its member, so aggregation exists but is incomplete.  ## Impact  Clients that build a model catalog from these fields (Codex Desktop via `model_catalog_json`) mark the combo as text-only and refuse image attachments for a model that accepts them. The same model reached directly (`cx/gpt-6.1-sol`) is published with `["text","image"]`, so the combo is the only path that loses the capability.  ## Suggestion  Include the members' capability declarations in the combo entry (at least `vision` / `input_modalities`), or make the derived `capabilities` block consider `vision`. A routing combo can only do what its membe
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. The premise needs a check, because member capabilities are aggregated today: `/v1/models` merges `vision` across a combo's members (`mergeComboCapabilities`, `src/app/api/v1/models/catalogHelpers.ts`) and derives `input_modalities` from it (#12799); `/api/combos` reports `multimodal: true` only when EVERY concrete member (including expanded nested combos) proves vision (`src/app/api/v1/combos/projectCombo.ts`). So a missing `vision` most likely means at least one member does not resolve as vision-capable, or one step is not what you expect (a different alias, or a nested combo). Could you share (1) the combo JSON from `GET /api/combos` (the `models` array and any `context_length`), and (2) the `/v1/models` entry for each member id exactly as listed in the combo? Also please retest on 3.8.51, which includes the vision and nested-combo fixes (#12799, #14232). With that we can tell whether this is a data issue on one member or a real resolver gap.
  > Thanks for the report. We reproduced exactly what you describe on 3.8.50: for a Codex model that gets `vision: true` from the synced model list, the direct `/v1/models` entry reported vision, but the combo entry showed only `{tool_calling, reasoning}` and the combo projection derived `multimodal: false`. The combo path never read the synced vision flag.  That was fixed in #14081 (PR #14428), which ships in v3.8.51 (npm latest). With the same setup on the current release branch, the combo entry reports `capabilities.vision: true` with `input_modalities: ["text","image"]` and `multimodal: true`.  One note: a combo only advertises vision when every member supports it. Please update to 3.8.51 and retest; if it still shows `multimodal: false`, comment here with the combo's members and we'll look again.

- **Issue #15207** (2026-09-30): **fix(api): Combo context_length is advertised in /v1/models but the CONTEXT guardrail enforces combo-min**
  *Symptoms*: **Version:** OmniRoute 3.8.50 (Windows, local server)  ## What happens  A combo with `context_length: 1000000` set in the dashboard is published by `/v1/models` as `1000000`, yet a prompt above the smallest member's window is rejected:  ``` 400 Input exceeds context window for ollama-cloud/deepseek-v4.1-flash: estimated 135026 input tokens, limit 128000. Reduce the prompt or route to a model with a larger context window. ```  Server log (`~/.omniroute/logs/application/app.log`):  ``` CONTEXT  Attempting to resolve combo limits for comboName=_Deepseek 4.1 flash combo CONTEXT  Combo context limit: 128000 (source=combo-min) CONTEXT  Input exceeds context window for ollama-cloud/deepseek-v4.1-flash: estimated 135026 input tokens, limit 128000 ```  ## Cause  `resolveComboContextLimit` only considers three sources: `target`, `combo-min` (`Math.min` over the member limits) and `fallback`. There is no `combo-declared` source, so the combo's own `context_length` never reaches enforcement. The dashboard hint for that field describes it as *"Defines the context window for this combo in /v1/models"*, i.e. publication only.  ## Impact  Any client that sizes its context from `/v1/models` (Codex Desktop via `model_catalog_json`, OpenCode, Continue, ...) sends requests that the gateway itself then rejects, and the mismatch is invisible without reading the server log.  ## Repro  1. Combo with two members whose windows are 128000 (e.g. `ollama-cloud/deepseek-v4.1-flash` and `nvidia/deepseek-ai
  **Post-Mortem & Fix Analysis**:
  > Thanks for the clear analysis, and your diagnosis was right for 3.8.50: `resolveComboContextLimit` had no combo-declared source. That was fixed in #12090 (merged 2026-08-30), which adds a `combo-explicit` source: an operator-set `context_length` on the combo now outranks the per-target window and the `combo-min` fallback (`open-sse/services/comboContextLimit.ts`, wired in `open-sse/handlers/chatCore.ts` ~2090-2103). It ships in 3.8.51, which is on npm, so please upgrade; the log line should then read `source=combo-explicit`. Note that an explicit per-model `max_input_tokens` capability override still applies as a separate input cap. If you still see `source=combo-min` on 3.8.51 with `context_length` set on the combo, please reopen with the combo JSON. Closing as fixed.

- **Issue #15150** (2026-10-02): **fix(backend): cache_default_mode='bypass' skips reads but keeps writing entries; semanticCacheEnabled toggle has no request-path consumer**
  *Symptoms*: **OmniRoute 3.8.50** — `cache_default_mode: "bypass"` on an API key skips cache **lookup** but entries keep being **written**, and the persisted `semanticCacheEnabled=false` setting has no consumer on the request path.  Evidence:  1. All API keys set to `cache_default_mode='bypass'` (verified in `api_keys`). After the switch, `semantic_cache` kept accumulating rows (`created_at` timestamps well after the bypass was active): 46 rows at check time. Only after a manual `DELETE FROM semantic_cache` did the table stay empty. 2. `semanticCacheEnabled` (persisted in `key_value`, `databaseSettings` namespace) is read nowhere on the request path — greps for `semanticCacheEnabled` only hit `src/types/databaseSettings.ts`, `src/lib/db/databaseSettings.ts` and `src/shared/validation/settingsSchemas.ts`. Setting it to `false` and restarting did not stop HITs.  Consequences:  - Disk usage grows despite bypass (all rows inert for reads, but written on every cacheable request). - When the signature bug is fixed and users flip back to `legacy`, stale entries accumulated "invisibly" under bypass become live again — a trap.  Suggested fix: make `bypass` skip writes as well (or document it as read-only bypass), and wire `semanticCacheEnabled` to `isCacheableForRead`/`isCacheableForWrite` or drop it from the settings surface. 
  **Post-Mortem & Fix Analysis**:
  > Confirmed on release/v3.8.52. Bypass returns early only on the read side (open-sse/handlers/chatCore/semanticCache.ts:53); the non-streaming and streaming store helpers never see cacheDefaultMode, so rows keep being written. The semanticCacheEnabled value that chatCore reads (chatCore.ts:1248) comes from the 'settings' namespace, not the databaseSettings one the dashboard toggle writes. PR #15155 (open, under review) makes bypass skip writes too and honors the database toggle for reads and writes. It is not merged yet, so it ships in the next release. Meanwhile, purge stale rows before flipping keys back to legacy.

- **Issue #15139** (2026-10-02): **fix(backend): keep the terminal upstream error code in combo error frames**
  *Symptoms*: ### OmniRoute Version  3.8.51  ### Installation Method  Docker / Docker Compose  ### Operating System  Linux  ### OS Version  NixOS (container: `diegosouzapw/omniroute`, `next` tag)  ### Node.js Version  n/a (Docker)  ### Provider(s) Involved  OpenAI Codex, DeepSeek  ### Model(s) Involved  `codex/gpt-6-luna-xhigh`, `deepseek/deepseek-flash`  ### Client Tool  Hermes Agent (Responses API client, `store: false` + `include: ["reasoning.encrypted_content"]`)  ### Description  PR #14636 (merged into `release/v3.8.51`) fixed the *reporting* of a Codex reasoning-replay rejection: it now reaches clients as `code: "invalid_encrypted_content"` instead of the generic `bad_request`, so a Responses client can recognise the recoverable case and resend without the reasoning item. That behaves correctly when the client calls a **single model id**.  The fix is lost as soon as the client calls a **combo**. The combo error wrapper rewrites the final SSE error to `code: "bad_request"` and leaves the recoverable reason only as prose inside `diagnostics.terminalReason`, which clients do not read. A Responses client therefore cannot distinguish the recoverable case, retries the identical payload, exhausts its retries, and fails the turn.  This reproduces with a **codex-only combo** (`poolSize: 1`) on the same payload that the direct model id reports correctly, so it is not caused by a second target — it is the aggregation that discards the terminal upstream code. In our setup this turns a self-heali

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

### Incident Patch 1: `9cd5f18d` (2026-10-02)
**Commit Message**: fix(dashboard): cancel the compression tab's saved-badge timer on unmount (#15350)

The 2s timer that clears the 'saved' badge was never cancelled, so it fired into a torn-down
jsdom tree in CI ('window is not defined' as a vitest unhandled error, failing the UI job on
otherwise green runs).

**File**: `src/app/(dashboard)/dashboard/settings/components/CompressionSettingsTab.tsx` (modified, +17/-1)
```diff
@@ -237,6 +237,16 @@ export default function CompressionSettingsTab() {
   const savedRef = useRef(config);
   const queuedRef = useRef<SettingsPatch<CompressionConfig>[]>([]);
   const saveQueueRef = useRef(Promise.resolve());
+  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
+
+  // The "saved" badge clears itself after 2s; a timer that outlives the tab fires into an
+  // unmounted (or torn-down) React tree.
+  useEffect(
+    () => () => {
+      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
+    },
+    []
+  );
 
   useEffect(() => {
     fetch("/api/settings/compression")
@@ -301,7 +311,13 @@ export default function CompressionSettingsTab() {
       // A failure stays on screen until the next edit, so a queued success or an earlier
       // save's timeout cannot hide a field that just rolled back.
       setStatus((shown) => (ok ? (shown === "error" ? shown : "saved") : "error"));
-      if (ok) setTimeout(() => setStatus((shown) => (shown === "saved" ? "" : shown)), 2000);
+      if (ok) {
+        if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
+        statusTimerRef.current = setTimeout(
+          () => setStatus((shown) => (shown === "saved" ? "" : shown)),
+          2000
+        );
+      }
     });
   };
 
```

**File**: `tests/unit/ui/compression-settings-tab-partial-save.test.tsx` (modified, +26/-0)
```diff
@@ -138,11 +138,37 @@ async function renderTab() {
 }
 
 afterEach(() => {
+  vi.restoreAllMocks();
   vi.useRealTimers();
   vi.unstubAllGlobals();
 });
 
 describe("CompressionSettingsTab saves only what changed", () => {
+  it("clears the saved-badge timer when the tab unmounts", async () => {
+    startServer();
+    const nativeSetTimeout = globalThis.setTimeout;
+    const badgeTimers: unknown[] = [];
+    vi.spyOn(globalThis, "setTimeout").mockImplementation(((
+      fn: TimerHandler,
+      ms?: number,
+      ...args: unknown[]
+    ) => {
+      const id = nativeSetTimeout(fn as () => void, ms, ...(args as []));
+      if (ms === 2000) badgeTimers.push(id);
+      return id;
+    }) as typeof setTimeout);
+    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
+
+    const view = render(<CompressionSettingsTab />);
+    await settle();
+    fireEvent.change(inputFor("compressionCacheTTL"), { target: { value: "10" } });
+    await settle();
+    expect(badgeTimers).toHaveLength(1);
+
+    view.unmount();
+    expect(clearSpy).toHaveBeenCalledWith(badgeTimers[0]);
+  });
+
   // Rendering the whole caveman page takes over 5 seconds on a cold run.
   it(
     "keeps Auto-Clarity off on the caveman page when the embedded tab saves",
```

---

### Incident Patch 2: `06742ac2` (2026-10-02)
**Commit Message**: fix(quality): release-green no longer runs pull_request-only ci.yml steps (#15344)

validate-release-green --full-ci took every 'npm run check:*' line from the ci.yml gate jobs,
including the check:ai-attribution step that is guarded by 'if: github.event_name == pull_request'
and reads PR_BASE_SHA/PR_HEAD_SHA. On a scheduled run those are empty, so it executed
'git log ".."' and opened a hard base-red on every run (#15306).

**File**: `scripts/quality/validate-release-green.mjs` (modified, +5/-0)
```diff
@@ -359,6 +359,11 @@ export function extractCiGates(
     const steps = doc?.jobs?.[job]?.steps;
     if (!Array.isArray(steps)) continue;
     for (const step of steps) {
+      // A step guarded to pull_request events reads the PR's base/head/title/body, which a
+      // scheduled or push validation does not have (check:ai-attribution ran `git log ".."`).
+      if (typeof step?.if === "string" && /event_name\s*==\s*['"]pull_request['"]/.test(step.if)) {
+        continue;
+      }
       const runStr = typeof step?.run === "string" ? step.run : "";
       if (!runStr) continue;
       for (const rawLine of runStr.split("\n")) {
```

**File**: `tests/unit/validate-release-green.test.ts` (modified, +19/-0)
```diff
@@ -549,3 +549,22 @@ test("the --full-ci loop classifies from the curated results, not a hardcoded ki
     "--full-ci must classify each ci.yml gate through fullCiKindFor()"
   );
 });
+
+test("extractCiGates: skips steps guarded to pull_request events (no PR range outside a PR)", () => {
+  const yaml = `
+jobs:
+  lint:
+    steps:
+      - run: npm run check:public-creds
+      - name: AI attribution
+        if: github.event_name == 'pull_request'
+        run: |
+          printf '%s' "$PR_BODY" > "$RUNNER_TEMP/pr-body.md"
+          npm run check:ai-attribution -- --range "$PR_BASE_SHA..$PR_HEAD_SHA"
+      - name: still local
+        if: github.event_name != 'pull_request'
+        run: npm run check:db-rules
+`;
+  const ids = extract(yaml).map((g) => g.id);
+  assert.deepEqual(ids, ["check:public-creds", "check:db-rules"]);
+});
```

---

### Incident Patch 3: `4db3c54e` (2026-10-02)
**Commit Message**: fix(dashboard): list every provider, model, account and API key in the Logs filters (#15160)

Validated in a local merge-train on tomni-proxmox-113 (FAST green on the 31-PR combined tree; FULL unit run showed only load flakes + base-red). skills/omni-usage-logs/SKILL.md hunk (+11, docs only) approved by the owner.
⚠️ base-red inherited: #15306

**File**: `changelog.d/fixes/15160-log-filter-full-options.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- **fix(dashboard):** list every provider, model, account and API key in the Logs tab filters, not only the values in the loaded page, so a key with no row in view (or no traffic yet) can still be selected ([#15160](https://github.com/diegosouzapw/OmniRoute/pull/15160))
```

**File**: `docs/openapi.yaml` (modified, +11/-0)
```diff
@@ -3563,6 +3563,17 @@ paths:
         "200":
           description: Paginated call logs
 
+  /api/usage/call-logs/filters:
+    get:
+      tags: [Usage]
+      summary: Get call log filter options
+      description: >-
+        Distinct providers, models, accounts and API keys seen in call logs, plus every
+        configured API key (id and name only). Feeds the Logs tab filter dropdowns.
+      responses:
+        "200":
+          description: Filter options (providers, models, accounts, apiKeys, configuredKeys)
+
   /api/usage/call-logs/{id}:
     get:
       tags: [Usage]
```

**File**: `skills/omni-usage-logs/SKILL.md` (modified, +11/-0)
```diff
@@ -32,6 +32,17 @@ curl https://localhost:20128/api/usage/call-logs \
   -H "Authorization: Bearer $OMNIROUTE_TOKEN"
 ```
 
+### GET /api/usage/call-logs/filters
+
+Get call log filter options
+
+Distinct providers, models, accounts and API keys seen in call logs, plus every configured API key (id and name only). Feeds the Logs tab filter dropdowns.
+
+```bash
+curl https://localhost:20128/api/usage/call-logs/filters \
+  -H "Authorization: Bearer $OMNIROUTE_TOKEN"
+```
+
 ### GET /api/usage/call-logs/{id}
 
 Get a specific call log
```

**File**: `src/app/api/usage/call-logs/filters/route.ts` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+import { NextResponse } from "next/server";
+export const dynamic = "force-dynamic";
+import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
+import { getCallLogFilterOptions } from "@/lib/usageDb";
+import type { CallLogFilterOptions } from "@/lib/usage/callLogFilterOptions";
+import { getApiKeys } from "@/lib/db/apiKeys";
+
+// The option query scans call_logs synchronously; serve repeat page opens from memory.
+// Values logged after the snapshot still appear: the page merges its loaded rows in.
+const CACHE_TTL_MS = 60_000;
+let cached: { at: number; options: CallLogFilterOptions } | null = null;
+
+async function loadOptions(): Promise<CallLogFilterOptions> {
+  const now = Date.now();
+  if (cached && now - cached.at < CACHE_TTL_MS) return cached.options;
+  const options = await getCallLogFilterOptions();
+  cached = { at: now, options };
+  return options;
+}
+
+/**
+ * Filter dropdown options for the Logs tab: every provider / model / account / API key
+ * seen in call_logs, plus every configured API key (so a key with no traffic yet can
+ * still be picked). Only ids and names are returned — never key material.
+ */
+export async function GET(request: Request) {
+  try {
+    const authError = await requireManagementAuth(request);
+    if (authError) return authError;
+
+    const [options, keys] = await Promise.all([loadOptions(), getApiKeys()]);
+    const configuredKeys = keys
+      .filter((key: any) => typeof key?.id === "string" && key.id.length > 0)
+      .map((key: any) => ({
+        id: key.id as string,
+        name: typeof key.name === "string" && key.name.length > 0 ? key.name : null,
+      }));
+
+    return NextResponse.json({ ...options, configuredKeys });
+  } catch (error) {
+    console.error("[API ERROR] /api/usage/call-logs/filters failed:", error);
+    return NextResponse.json({ error: "Failed to fetch call log filter options" }, { status: 500 });
+  }
+}
```

**File**: `src/lib/usage/callLogFilterOptions.ts` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+import { getDbInstance } from "../db/core";
+import { RESOLVED_ACCOUNT_SQL } from "./callLogs";
+
+export type CallLogFilterOptions = {
+  providers: string[];
+  models: string[];
+  accounts: string[];
+  apiKeys: { id: string | null; name: string | null }[];
+};
+
+function distinctStrings(rows: { value: unknown }[]): string[] {
+  const values = new Set<string>();
+  for (const { value } of rows) {
+    if (typeof value === "string" && value.length > 0 && value !== "-") values.add(value);
+  }
+  return [...values].sort();
+}
+
+/**
+ * Distinct provider / model / account / API-key values over the whole call_logs table,
+ * for the Logs tab filter dropdowns. Building those from the loaded page instead hid
+ * every value without a row in that window. Values are raw column values so they always
+ * match the `LIKE` filters in getCallLogs(); accounts use the same resolution as rows.
+ */
+export async function getCallLogFilterOptions(): Promise<CallLogFilterOptions> {
+  const db = getDbInstance();
+  const providers = db.prepare("SELECT DISTINCT provider AS value FROM call_logs").all() as {
+    value: unknown;
+  }[];
+  const models = db
+    .prepare(
+      "SELECT model AS value FROM call_logs UNION SELECT requested_model AS value FROM call_logs"
+    )
+    .all() as { value: unknown }[];
+  const accounts = db
+    .prepare(
+      `SELECT DISTINCT ${RESOLVED_ACCOUNT_SQL} AS value
+       FROM call_logs cl
+       LEFT JOIN provider_connections pc ON pc.id = cl.connection_id`
+    )
+    .all() as { value: unknown }[];
+  const apiKeys = db
+    .prepare(
+      `SELECT DISTINCT NULLIF(api_key_id, '') AS id, NULLIF(api_key_name, '') AS name
+       FROM call_logs
+       WHERE NULLIF(api_key_id, '') IS NOT NULL OR NULLIF(api_key_name, '') IS NOT NULL
+       ORDER BY id, name`
+    )
+    .all() as { id: string | null; name: string | null }[];
+
+  return {
+    providers: distinctStrings(providers),
+    models: distinctStrings(models),
+    accounts: distinctStrings(accounts),
+    apiKeys,
+  };
+}
```

**File**: `src/lib/usage/callLogs.ts` (modified, +2/-1)
```diff
@@ -137,7 +137,8 @@ type CallLogSummaryRow = {
   usage_provenance?: string | null;
 };
 
-const RESOLVED_ACCOUNT_SQL = "COALESCE(NULLIF(pc.name, ''), NULLIF(pc.email, ''), cl.account)";
+export const RESOLVED_ACCOUNT_SQL =
+  "COALESCE(NULLIF(pc.name, ''), NULLIF(pc.email, ''), cl.account)";
 
 type LegacyInlineRow = {
   request_body: string | null;
```

**File**: `src/lib/usageDb.ts` (modified, +1/-0)
```diff
@@ -36,3 +36,4 @@ export { calculateCost } from "./usage/costCalculator";
 export { getUsageStats } from "./usage/usageStats";
 
 export { saveCallLog, rotateCallLogs, getCallLogs, getCallLogById } from "./usage/callLogs";
+export { getCallLogFilterOptions } from "./usage/callLogFilterOptions";
```

**File**: `src/shared/components/RequestLoggerV2.tsx` (modified, +35/-40)
```diff
@@ -28,6 +28,7 @@ import {
   formatCachePercentage,
 } from "@/shared/utils/formatting";
 import { getProviderDisplayLabel } from "@/shared/utils/providerDisplayLabel";
+import { mergeLogFilterOptions } from "@/shared/utils/logFilterOptions";
 import { buildLogTpsTitle, computeLogTps } from "@/shared/utils/logTps";
 import useEmailPrivacyStore from "@/store/emailPrivacyStore";
 import {
@@ -197,6 +198,7 @@ const RequestLoggerV2 = forwardRef<RequestLoggerV2Handle, RequestLoggerV2Initial
     const loadMoreSentinelRef = useRef(null);
     const hasScrolledRef = useRef(false);
     const [providerNodes, setProviderNodes] = useState([]);
+    const [serverFilterOptions, setServerFilterOptions] = useState(null);
     const visibleRef = useRef(true);
     // Set when handlePrev/handleNext hits the edge of the (possibly stale —
     // list polling pauses while a detail modal is open) in-memory list, so we
@@ -314,6 +316,17 @@ const RequestLoggerV2 = forwardRef<RequestLoggerV2Handle, RequestLoggerV2Initial
         .catch(() => {});
     }, []);
 
+    // Dropdown options come from the whole call_logs table + configured API keys, not
+    // just the loaded page — otherwise a value with no row in view cannot be picked.
+    useEffect(() => {
+      fetch("/api/usage/call-logs/filters")
+        .then((r) => (r.ok ? r.json() : null))
+        .then((d) => {
+          if (d) setServerFilterOptions(d);
+        })
+        .catch(() => {});
+    }, []);
+
     useEffect(() => {
       fetch("/api/logs/detail?limit=1")
         .then(async (res) => {
@@ -848,38 +861,24 @@ const RequestLoggerV2 = forwardRef<RequestLoggerV2Handle, RequestLoggerV2Initial
       }
     };
 
-    const sourceLogsForDropdowns = logs;
-
-    // Unique accounts and providers for dropdowns
-
-    const uniqueAccounts = useMemo(
-      () => [
-        ...new Set(sourceLogsForDropdowns.map((l) => l.account).filter((a) => a && a !== "-")),
-      ],
-      [sourceLogsForDropdowns]
-    );
-    const uniqueModels = useMemo(
-      () =>
-        [
-          ...new Set(
-            sourceLogsForDropdowns.flatMap((l) => [l.model, l.requestedModel]).filter(Boolean)
-          ),
-        ].sort(),
-      [sourceLogsForDropdowns]
+    const filterOptions = useMemo(
+      () => mergeLogFilterOptions(serverFilterOptions, serverFilterOptions?.configuredKeys, logs),
+      [serverFilterOptions, logs]
     );
-    const uniqueProviders = useMemo(
-      () =>
-        [
-          ...new Set(sourceLogsForDropdowns.map((l) => l.provider).filter((p) => p && p !== "-")),
-        ].sort(),
-      [sourceLogsForDropdowns]
+    const uniqueAccounts = filterOptions.accounts;
+    const uniqueModels = filterOptions.models;
+    const uniqueProviders = filterOptions.providers;
+    // Quick-filter chips stay on the loaded rows: one chip per provider ever logged
+    // (including deleted compatible nodes) would flood the toolbar.
+    const loadedProviders = useMemo(
+      () => mergeLogFilterOptions(null, null, logs).providers,
+      [logs]
     );
+    const apiKeyOptions = filterOptions.apiKeys;
+    // The "N keys" stat describes the loaded rows, not the dropdown.
     const uniqueApiKeys = useMemo(
-      () =>
-        [
-          ...new Set(sourceLogsForDropdowns.map((l) => l.apiKeyId || l.apiKeyName).filter(Boolean)),
-        ].sort(),
-      [sourceLogsForDropdowns]
+      () => [...new Set(logs.map((l) => l.apiKeyId || l.apiKeyName).filter(Boolean))],
+      [logs]
     );
 
     // Stats (memoized to avoid re-computation on every render)
@@ -1031,15 +1030,11 @@ const RequestLoggerV2 = forwardRef<RequestLoggerV2Handle, RequestLoggerV2Initial
             className="px-3 py-2 rounded-lg bg-bg-subtle border border-border text-sm text-text-primary focus:outline-none focus:border-primary appearance-none cursor-pointer min-w-[160px]"
           >
             <option value="">{t("allApiKeys")}</option>
-            {uniqueApiKeys.map((value) => {
-              const matched = logs.find((l) => (l.apiKeyId || l.apiKeyName) === value);
-              const label = formatApiKeyLabel(matched?.apiKeyName, matched?.apiKeyId);
-              return (
-                <option key={value} value={value}>
-                  {label}
-                </option>
-              );
-            })}
+            {apiKeyOptions.map((option) => (
+              <option key={option.value} value={option.value}>
+                {formatApiKeyLabel(option.name, option.id)}
+              </option>
+            ))}
           </select>
 
           {/* Stats */}
@@ -1160,10 +1155,10 @@ const RequestLoggerV2 = forwardRef<RequestLoggerV2Handle, RequestLoggerV2Initial
           ))}
 
           {/* Divider */}
-          {uniqueProviders.length > 0 && <span className="w-px h-5 bg-border mx-1" />}
+          {loadedProviders.length > 0 && <span className="w-px h-5 bg-border mx-1" />}
 
           {/* Dynamic Provider Quick Filters (from data) */}
-          {uniqueProviders.ma
```

---

### Incident Patch 4: `3e66ff2e` (2026-10-02)
**Commit Message**: fix(quality): clear two base-reds on release/v3.8.52 (gate-manifest alias + stryker registration) (#15342)

* fix(quality): map check:cycles:ratchet in the gate manifest

* fix(quality): register 2 covering tests missing from stryker tap.testFiles

**File**: `config/quality/gate-manifest.json` (modified, +5/-0)
```diff
@@ -93,6 +93,11 @@
       "command": "node scripts/check/check-cycles.mjs",
       "disposition": "separately-invoked"
     },
+    {
+      "name": "check:cycles:ratchet",
+      "command": "node scripts/check/check-cycles.mjs --ratchet",
+      "disposition": "separately-invoked"
+    },
     {
       "name": "check:dashboard-typecheck",
       "command": "node scripts/check/check-dashboard-typecheck.mjs",
```

**File**: `stryker.conf.json` (modified, +2/-0)
```diff
@@ -42,6 +42,8 @@
   "plugins": ["@stryker-mutator/tap-runner"],
   "tap": {
     "testFiles": [
+      "tests/unit/claude-passthrough-unsigned-thinking-12917.test.ts",
+      "tests/unit/combo-error-code-terminal.test.ts",
       "tests/unit/model-validation-runner.test.ts",
       "tests/unit/bare-403-neutral.test.ts",
       "tests/unit/chat-noauth-model-cooldown.test.ts",
```

---

### Incident Patch 5: `69cb18dc` (2026-10-02)
**Commit Message**: fix(ci): make check-cycles honest — real graph walk + cycles ratchet (#15159 G-01/G-02) (#15281)

check:cycles now walks the real graph and has a blocking ratchet (ceiling 14, matches the 14 cycles found). Protected surface: AGENTS.md changes only document the new check:cycles:ratchet script and mark check:cycles advisory; explicit owner approval given in chat. Revalidated on the current release tip after the 13-PR wave: 21/21 tests, ratchet OK, changelog-integrity, file-size green; actionlint shows no findings beyond the 32 already on the tip.

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -137,7 +137,7 @@ jobs:
           path: .artifacts/eslint-results.json
           if-no-files-found: warn
           retention-days: 7
-      - run: npm run check:cycles
+      - run: npm run check:cycles:ratchet
       - run: npm run check:route-validation:t06
       - run: npm run check:any-budget:t11
       - run: npm run check:provider-consistency
```

**File**: `AGENTS.md` (modified, +2/-1)
```diff
@@ -18,7 +18,8 @@ npm run typecheck:core         # TypeScript check (should be clean)
 npm run typecheck:noimplicit:core  # Strict check (no implicit any)
 npm run test:coverage          # Unit tests + coverage gate (60/60/60/60 — statements/lines/functions/branches)
 npm run check                  # lint + test combined
-npm run check:cycles           # Detect circular dependencies
+npm run check:cycles           # Detect circular dependencies (advisory — lists the SCCs)
+npm run check:cycles:ratchet   # Same scan, blocking above the quality-baseline ceiling
 npm run check:docs-all         # Run after changing documentation (includes fabricated-docs validation)
 ```
 
```

**File**: `config/quality/quality-baseline.json` (modified, +7/-0)
```diff
@@ -190,6 +190,13 @@
       "direction": "down",
       "dedicatedGate": true
     },
+    "cycles": {
+      "value": 14,
+      "direction": "down",
+      "dedicatedGate": true,
+      "_note": "Import-cycle count over src/ + open-sse/ from scripts/check/check-cycles.mjs (#15159 G-02). Before this entry the metric did not exist and the gate was a false green: it scanned 5 subdirectories (450 files), matched only static `import|export … from`, and dropped every `@/` and `@omniroute/open-sse/` specifier — so it could not see the dynamic-import + alias cycles that dominated the repo. Fixed in the same change; the 14 below are the cycles the honest scan finds at release/v3.8.52 @ dbe703a000, not new debt.",
+      "_seed_2026_10_01_g01_g02_false_green": "0 (unmeasured, falsely reported) -> 14. The previous 0 was not a measurement, it was a blind spot. Fixing the three blinds (roots -> src+open-sse, AST-based extraction so `import(\"…\")` counts while type-position `typeof import(\"…\")` does not, tsconfig paths resolution for `@/*` and `@omniroute/open-sse/*`) took the scanned surface from 450 to 5023 files and surfaced 14 strongly connected components. Largest is a 43-file SCC over src/lib/db (settings.ts -> readCache.ts -> settings.ts, closed by the dynamic `await import(\"@/lib/db/settings\")` at src/lib/db/readCache.ts:102 — exactly the shape the old regex + alias filter could not see). Ceiling seeded at the measured 14 so the metric can only fall; burn-down is A-01 (chatCore.ts split) and the open-sse/services+imageGeneration extractions. Measured twice, identical both times. Do NOT raise this ceiling to make a gate green — that is the exact inverse of this ratchet."
+    },
     "bundleSize": {
       "value": 10384,
       "direction": "down",
```

**File**: `docs/architecture/QUALITY_GATES.md` (modified, +2/-2)
```diff
@@ -102,7 +102,7 @@ Runs on every PR to `main`. Blocks merge on failure.
 | Script (`npm run ...`)            | Validates                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Blocking                                 |
 | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
 | `check:node-runtime`              | Node.js version is within the supported range                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Yes                                      |
-| `check:cycles`                    | Circular imports — all `src/` + `open-sse/` modules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Yes                                      |
+| `check:cycles`                    | Circular imports across all of `src/` + `open-sse/` (AST-based, tsconfig `paths` resolved). Bare = advisory, lists the cycles. `check:cycles:ratchet` (what CI runs) blocks when the count exceeds the `metrics.cycles` ceiling in `quality-baseline.json` — currently 14, `direction: down`, so it can only fall (#15159 G-01/G-02)                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Yes (ratchet)                            |
 | `check:route-validation:t06`      | Zod schemas present on all routes (Tier 6 policy)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         
```

**File**: `package.json` (modified, +1/-0)
```diff
@@ -148,6 +148,7 @@
     "test:security": "cross-env DISABLE_SQLITE_AUTO_BACKUP=true node --import tsx/esm --import ./open-sse/utils/setupPolyfill.ts --import ./tests/_setup/isolateDataDir.ts --test tests/unit/security-fase01.test.ts",
     "test:property": "cross-env DISABLE_SQLITE_AUTO_BACKUP=true node --import tsx/esm --test --test-force-exit tests/unit/correctness/*.property.test.ts",
     "check:cycles": "node scripts/check/check-cycles.mjs",
+    "check:cycles:ratchet": "node scripts/check/check-cycles.mjs --ratchet",
     "check:route-validation:t06": "node scripts/check/check-route-validation.mjs",
     "check:any-budget:t11": "node scripts/check/check-t11-any-budget.mjs",
     "check:docs-sync": "node scripts/check/check-docs-sync.mjs",
```

**File**: `scripts/check/check-cycles.mjs` (modified, +413/-88)
```diff
@@ -1,112 +1,342 @@
 #!/usr/bin/env node
+// scripts/check/check-cycles.mjs
+// Gate: intra-repo import cycles (strongly connected components of the module graph).
+//
+// #15159 / G-01 — this gate used to print a FALSE GREEN. It reported
+// "no cycles detected across 450 files" while being structurally unable to see
+// most of the repository. Three independent blinds:
+//
+//   1. `defaultRoots` was five directories (`src/shared/components`, `src/lib/db`,
+//      `src/lib/compliance`, `open-sse/translator`, `open-sse/mcp-server`) instead
+//      of the two source trees. `src/lib/config`, `src/app`, `open-sse/services`,
+//      `open-sse/handlers` … were never scanned. On a checkout without those five
+//      directories it scanned **0 files** and still printed OK.
+//   2. The specifier regex matched `import|export … from` only. Every dynamic
+//      `import("…")` was invisible.
+//   3. `if (!specifier.startsWith(".")) continue` dropped every `@/` and
+//      `@omniroute/open-sse/` alias edge, i.e. most of the repo's own imports.
+//
+// Live casualty: `src/lib/db/settings.ts:359` does
+// `await import("@/lib/config/runtimeSettings")`, and runtimeSettings imports
+// settings back. check-circular-deps.mjs (dpdm, which resolves tsconfig paths)
+// reports it as a real cycle; this gate could never have found it.
+//
+// The fix: walk the two real source trees, resolve tsconfig `paths` aliases, and
+// collect specifiers from the TypeScript AST so dynamic `import()` is counted while
+// type-position `typeof import("…")` is not (a regex cannot tell those apart, and
+// counting them invents cycles that do not exist at runtime).
+//
+// Cycle count is a ratchet, not a hard zero: see config/quality/quality-baseline.json
+// → metrics.cycles (G-02). `check:cycles` alone is advisory, `--ratchet` blocks.
 
 import fs from "node:fs";
 import path from "node:path";
+import { fileURLToPath, pathToFileURL } from "node:url";
+import { createRequire } from "node:module";
 
-const cwd = process.cwd();
-const defaultRoots = [
-  "src/shared/components",
-  "src/lib/db",
-  "src/lib/compliance",
-  "open-sse/translator",
-  "open-sse/mcp-server",
-];
-const roots = process.argv.slice(2).length > 0 ? process.argv.slice(2) : defaultRoots;
-const sourceExtensions = [".ts", ".tsx", ".js", ".mjs", ".jsx", ".mts", ".cts"];
-
-function toPosix(filePath) {
-  return filePath.split(path.sep).join("/");
+const require = createRequire(import.meta.url);
+const __dirname = path.dirname(fileURLToPath(import.meta.url));
+
+// Two source trees, not five directories. Anything else (`bin/`, `scripts/`,
+// `electron/`) is tooling, not the module graph this gate polices.
+export const DEFAULT_ROOTS = ["src", "open-sse"];
+
+const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs"];
+const IGNORED_DIRS = new Set([
+  "node_modules",
+  ".next",
+  ".git",
+  "dist",
+  "build",
+  "coverage",
+  ".claude",
+  "_tasks",
+]);
+
+// ---------------------------------------------------------------------------
+// tsconfig path aliases
+// ---------------------------------------------------------------------------
+
+/**
+ * Read `compilerOptions.baseUrl` + `compilerOptions.paths` from tsconfig.json.
+ * Tolerant by design: a missing/invalid tsconfig yields an empty alias table and
+ * the gate still walks relative edges rather than crashing.
+ *
+ * @param {string} cwd
+ * @returns {{ baseUrl: string, paths: Record<string, string[]> }}
+ */
+export function loadTsconfigAliases(cwd) {
+  const tsconfigPath = path.join(cwd, "tsconfig.json");
+  /** @type {{ baseUrl: string, paths: Record<string, string[]> }} */
+  const empty = { baseUrl: cwd, paths: {} };
+
+  if (!fs.existsSync(tsconfigPath)) return empty;
+
+  try {
+    // tsconfig.json allows comments and trailing commas; JSON.parse does not.
+    const raw = fs
+      .readFileSync(tsconfigPath, "utf8")
+      .replace(/^\s*\/\/.*$/gm, "")
+      .replace(/\/\*[\s\S]*?\*\//g, "")
+      .replace(/,(\s*[}\]])/g, "$1");
+    const parsed = JSON.parse(raw);
+    const options = parsed?.compilerOptions ?? {};
+    return {
+      baseUrl: path.resolve(cwd, options.baseUrl ?? "."),
+      paths: options.paths ?? {},
+    };
+  } catch {
+    return empty;
+  }
 }
 
-function listSourceFiles(rootDir) {
-  const absRoot = path.resolve(cwd, rootDir);
-  if (!fs.existsSync(absRoot)) {
-    return [];
+/**
+ * Match a bare specifier against the tsconfig `paths` table.
+ * Supports the two forms the repo uses: exact (`"@omniroute/open-sse"`) and
+ * single-wildcard (`"@/*"`, `"@omniroute/open-sse/*"`).
+ *
+ * @param {string} specifier
+ * @param {{ paths: Record<string, string[]> }} aliases
+ * @returns {string[] | null} substitution targets, or null when no path matches.
+ */
+export function matchPathAlias(specifier, aliases) {
+  const { paths } = aliases;
+  if (!paths) return null;
+
+  // Exact match wins over wildcard, matching TypeScript's own resolution order.
+
```

**File**: `tests/unit/build/check-cycles-blind-spots.test.ts` (added, +461/-0)
```diff
@@ -0,0 +1,461 @@
+// tests/unit/build/check-cycles-blind-spots.test.ts
+// TDD regression coverage for G-01 (#15159): `check-cycles.mjs` printed a false
+// green — "no cycles detected across 450 files" — while three independent blinds
+// made it structurally unable to see real cycles:
+//
+//   1. `defaultRoots` was five directories, not the repo, so anything outside
+//      them (src/lib/config, src/app, …) was never scanned at all.
+//   2. the specifier regex matched `import|export … from` only, so every dynamic
+//      `import("…")` was missed.
+//   3. `if (!specifier.startsWith(".")) continue` dropped every `@/` and
+//      `@omniroute/open-sse/` alias edge.
+//
+// The live casualty is src/lib/db/settings.ts:359, which does
+// `await import("@/lib/config/runtimeSettings")` — invisible to this gate, but
+// reported as a real cycle by check-circular-deps.mjs (dpdm), which resolves
+// tsconfig paths.
+//
+// These tests drive the gate as a subprocess against synthetic fixture trees,
+// because the defect is in the *whole pipeline* (roots → extract → resolve → SCC),
+// not in one pure function. `analyzeCycles` is exercised directly where possible.
+import test from "node:test";
+import assert from "node:assert/strict";
+import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
+import fs from "node:fs";
+import { join, resolve } from "node:path";
+import { tmpdir } from "node:os";
+import { execFileSync } from "node:child_process";
+import { pathToFileURL } from "node:url";
+
+const SCRIPT = resolve(process.cwd(), "scripts/check/check-cycles.mjs");
+
+type RunResult = { status: number; stdout: string; stderr: string };
+
+/** Run the gate as a subprocess with `root` as cwd and `roots` as argv. */
+function runGate(root: string, roots: string[] = []): RunResult {
+  try {
+    const stdout = execFileSync(process.execPath, [SCRIPT, ...roots], {
+      cwd: root,
+      encoding: "utf8",
+      stdio: ["ignore", "pipe", "pipe"],
+    });
+    return { status: 0, stdout, stderr: "" };
+  } catch (err) {
+    const e = err as { status?: number; stdout?: string; stderr?: string };
+    return { status: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
+  }
+}
+
+/** Minimal tsconfig so the alias resolution has something to read. */
+const TSCONFIG = JSON.stringify({
+  compilerOptions: {
+    baseUrl: ".",
+    paths: {
+      "@/*": ["./src/*"],
+      "@omniroute/open-sse": ["./open-sse"],
+      "@omniroute/open-sse/*": ["./open-sse/*"],
+    },
+  },
+});
+
+function writeFile(root: string, rel: string, contents: string): void {
+  const abs = join(root, rel);
+  mkdirSync(join(abs, ".."), { recursive: true });
+  writeFileSync(abs, contents);
+}
+
+function withTree(fn: (root: string) => void): void {
+  const root = mkdtempSync(join(tmpdir(), "check-cycles-"));
+  try {
+    writeFile(root, "tsconfig.json", TSCONFIG);
+    fn(root);
+  } finally {
+    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
+  }
+}
+
+test("GATE-SANITY: the fixture harness itself works — a relative cycle is detected", () => {
+  withTree((root) => {
+    // Blind spot 1/2/3 are all absent here: same root, static import, relative path.
+    writeFile(root, "src/a.ts", 'import { b } from "./b";\nexport const a = () => b();\n');
+    writeFile(root, "src/b.ts", 'import { a } from "./a";\nexport const b = () => a();\n');
+
+    const result = runGate(root, ["src"]);
+
+    assert.equal(
+      result.status,
+      1,
+      `harness must detect a plain relative cycle; got status=${result.status} out=${result.stdout} err=${result.stderr}`
+    );
+    assert.match(result.stderr, /FAIL/, "must print FAIL, not OK");
+  });
+});
+
+// ---------------------------------------------------------------------------
+// Blind spot 2 — dynamic import() has no regex branch
+// ---------------------------------------------------------------------------
+
+test("blind spot 2: a cycle closed by a dynamic import() is detected", () => {
+  withTree((root) => {
+    // Static edge a -> b is visible today; b -> a is the dynamic one.
+    writeFile(root, "src/a.ts", 'import { b } from "./b";\nexport const a = () => b();\n');
+    writeFile(root, "src/b.ts", 'export const b = async () => (await import("./a")).a();\n');
+
+    const result = runGate(root, ["src"]);
+
+    assert.equal(
+      result.status,
+      1,
+      `dynamic import() must create a graph edge; got status=${result.status} out=${result.stdout}`
+    );
+    assert.match(result.stderr, /src[\\/]b\.ts/, "must name the dynamic-import file");
+  });
+});
+
+test("blind spot 2: await import() inside a function body closes the cycle", () => {
+  withTree((root) => {
+    writeFile(root, "src/a.ts", 'export const a = async () => (await import("./b")).b();\n');
+    writeFile(
+      root,
+      "src/b.ts",
+      'export async function b() {\n  const { a } = await import("./a");\n  return a;
```

---

### Incident Patch 6: `87a75343` (2026-10-02)
**Commit Message**: fix(translator): drop unsigned reasoning on Claude output (#12917)

Validated in a local merge-train on tomni-proxmox-113 (static gates + changed tests + vitest green on the 31-PR combined tree; the FULL unit run on the same set showed only load-timing flakes, the base-red consoleInterceptor-writes, and one regression since fixed in #15087).
⚠️ base-red inherited: #15306

**File**: `changelog.d/fixes/12917-drop-unsigned-reasoning-claude-output.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- **fix(claude):** drop assistant `thinking` / `redacted_thinking` blocks that carry no signature from the history before it is replayed to the genuine Anthropic upstream (Claude passthrough), so reasoning relayed from an OpenAI-compatible leg no longer triggers `Invalid signature in thinking block` on the next turn — signed blocks are forwarded untouched ([#12917](https://github.com/diegosouzapw/OmniRoute/pull/12917)) — thanks @atescivitci-cmd
```

**File**: `open-sse/handlers/chatCore/passthroughHelpers.ts` (modified, +60/-1)
```diff
@@ -152,19 +152,78 @@ export function shouldUseNativeOpenAICompatibleResponsesPassthrough({
  * responses. The redaction is therefore both unnecessary and the cause of the
  * regression, so the blocks are now returned verbatim. The `signature` parameter
  * is kept for call-site compatibility.
+ *
+ * The one exception is a block that carries no signature at all (see
+ * {@link dropUnsignedPassthroughThinkingBlocks}): it was never issued by Anthropic,
+ * so it is dropped instead of forwarded.
  */
 export function redactPassthroughThinkingSignatures(
   messages: unknown,
   _signature: string
 ): unknown {
-  return messages;
+  // Signed blocks stay verbatim; only blocks Anthropic never issued are dropped (#12917).
+  return dropUnsignedPassthroughThinkingBlocks(messages);
 }
 
 type MessageLike = {
   role?: unknown;
   content?: unknown;
 };
 
+/**
+ * True for an assistant `thinking` / `redacted_thinking` block that carries no
+ * signature (`thinking`) or no payload (`redacted_thinking`). Such a block was
+ * never issued by Anthropic — typically an OpenAI-compatible leg's reasoning that
+ * the response translator relayed as `thinking` — so a real Anthropic upstream can
+ * only answer 400 "Invalid signature in thinking block" when it is replayed.
+ */
+function isUnsignedThinkingBlock(block: unknown): boolean {
+  if (!block || typeof block !== "object") return false;
+  const { type, signature, data } = block as {
+    type?: unknown;
+    signature?: unknown;
+    data?: unknown;
+  };
+  const hasText = (value: unknown) => typeof value === "string" && value.trim().length > 0;
+  if (type === "thinking") return !hasText(signature);
+  if (type === "redacted_thinking") return !hasText(data);
+  return false;
+}
+
+/**
+ * Drop assistant thinking blocks that no Anthropic upstream could have signed
+ * (see {@link isUnsignedThinkingBlock}) before the history is replayed to a
+ * genuine Anthropic endpoint. Signed blocks are never touched — Anthropic rejects
+ * any modification of a valid one — and an assistant turn left with no content is
+ * removed (consecutive same-role turns are accepted by the Messages API).
+ *
+ * This is the proactive complement of the exact-error one-shot recovery
+ * (`executeWithAnthropicThinkingSignatureRecovery`), which cannot help when the
+ * unsigned block sits in the still-open tool-use cycle. Returns the original
+ * reference when nothing needs dropping; never mutates its input.
+ */
+export function dropUnsignedPassthroughThinkingBlocks(messages: unknown): unknown {
+  if (!Array.isArray(messages)) return messages;
+
+  let changed = false;
+  const kept: unknown[] = [];
+  for (const message of messages as MessageLike[]) {
+    if (
+      !message ||
+      message.role !== "assistant" ||
+      !Array.isArray(message.content) ||
+      !message.content.some(isUnsignedThinkingBlock)
+    ) {
+      kept.push(message);
+      continue;
+    }
+    changed = true;
+    const content = message.content.filter((block) => !isUnsignedThinkingBlock(block));
+    if (content.length > 0) kept.push({ ...message, content });
+  }
+  return changed ? kept : messages;
+}
+
 type ThinkingSignatureError = {
   provider?: string | null;
   status?: number | null;
```

**File**: `tests/unit/claude-passthrough-unsigned-thinking-12917.test.ts` (added, +172/-0)
```diff
@@ -0,0 +1,172 @@
+// @ts-nocheck
+import assert from "node:assert/strict";
+import fs from "node:fs";
+import os from "node:os";
+import path from "node:path";
+import test from "node:test";
+
+const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-unsigned-thinking-"));
+process.env.DATA_DIR = TEST_DATA_DIR;
+
+const core = await import("../../src/lib/db/core.ts");
+const { handleChatCore } = await import("../../open-sse/handlers/chatCore.ts");
+const { dropUnsignedPassthroughThinkingBlocks } =
+  await import("../../open-sse/handlers/chatCore/passthroughHelpers.ts");
+
+const originalFetch = globalThis.fetch;
+
+function noopLog() {
+  return { debug() {}, info() {}, warn() {}, error() {} };
+}
+
+async function flushAsyncSideEffects() {
+  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
+}
+
+test.afterEach(async () => {
+  globalThis.fetch = originalFetch;
+  await flushAsyncSideEffects();
+  core.resetDbInstance();
+  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
+  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
+});
+
+test.after(() => {
+  globalThis.fetch = originalFetch;
+  core.resetDbInstance();
+  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
+});
+
+function makeMessages() {
+  return [
+    { role: "user", content: [{ type: "text", text: "q1" }] },
+    {
+      // relayed from an OpenAI-compatible leg: reasoning surfaced as an UNSIGNED thinking block
+      role: "assistant",
+      content: [
+        { type: "thinking", thinking: "unsigned relay" },
+        { type: "text", text: "a1" },
+      ],
+    },
+    { role: "user", content: [{ type: "text", text: "q2" }] },
+    {
+      role: "assistant",
+      content: [
+        { type: "thinking", thinking: "empty sig", signature: "" },
+        { type: "redacted_thinking" },
+        { type: "thinking", thinking: "genuine", signature: "GENUINE_SIG" },
+        { type: "redacted_thinking", data: "GENUINE_DATA" },
+        { type: "text", text: "a2" },
+      ],
+    },
+    { role: "user", content: [{ type: "text", text: "q3" }] },
+  ];
+}
+
+test("helper drops thinking/redacted_thinking blocks without a signature and keeps the rest", () => {
+  const messages = makeMessages();
+  const before = JSON.stringify(messages);
+
+  const out = dropUnsignedPassthroughThinkingBlocks(messages);
+
+  assert.equal(JSON.stringify(messages), before, "input is not mutated");
+  assert.deepEqual(out[1].content, [{ type: "text", text: "a1" }]);
+  assert.deepEqual(out[3].content, [
+    { type: "thinking", thinking: "genuine", signature: "GENUINE_SIG" },
+    { type: "redacted_thinking", data: "GENUINE_DATA" },
+    { type: "text", text: "a2" },
+  ]);
+  assert.equal(out[0], messages[0], "untouched messages keep their reference");
+});
+
+test("helper returns the same reference when every thinking block is signed", () => {
+  const messages = [
+    { role: "user", content: "hi" },
+    {
+      role: "assistant",
+      content: [
+        { type: "thinking", thinking: "r", signature: "SIG" },
+        { type: "tool_use", id: "toolu_1", name: "Bash", input: {} },
+      ],
+    },
+  ];
+  assert.equal(dropUnsignedPassthroughThinkingBlocks(messages), messages);
+  assert.equal(dropUnsignedPassthroughThinkingBlocks(undefined), undefined);
+  assert.equal(dropUnsignedPassthroughThinkingBlocks(null), null);
+});
+
+test("helper drops an assistant message whose only content was unsigned thinking", () => {
+  const messages = [
+    { role: "user", content: "a" },
+    { role: "assistant", content: [{ type: "thinking", thinking: "only reasoning" }] },
+    { role: "user", content: "b" },
+  ];
+  const out = dropUnsignedPassthroughThinkingBlocks(messages);
+  assert.deepEqual(
+    out.map((m) => m.role),
+    ["user", "user"]
+  );
+});
+
+test("claude passthrough never replays unsigned thinking history to api.anthropic.com", async () => {
+  let captured = null;
+
+  globalThis.fetch = async (url, init = {}) => {
+    captured = { url: String(url), body: JSON.parse(String(init.body || "{}")) };
+    return new Response(
+      JSON.stringify({
+        id: "msg_test",
+        type: "message",
+        role: "assistant",
+        model: "claude-opus-5",
+        content: [{ type: "text", text: "OK" }],
+        usage: { input_tokens: 4, output_tokens: 1 },
+      }),
+      { status: 200, headers: { "Content-Type": "application/json" } }
+    );
+  };
+
+  const body = {
+    model: "claude-opus-5",
+    max_tokens: 64,
+    system: [{ type: "text", text: "You are Claude." }],
+    messages: makeMessages(),
+    stream: false,
+  };
+
+  const result = await handleChatCore({
+    body: structuredClone(body),
+    modelInfo: { provider: "claude", model: "claude-opus-5", extendedContext: false },
+    credentials: { apiKey: "test-claude-key", providerSpecificData: {} },
+    log: noopLog(),
+    clientRawRequest: {
```

---

### Incident Patch 7: `3345aba6` (2026-10-02)
**Commit Message**: fix(proxy): preserve required egress for no-auth account proxy references (#15087)

Validated in a local merge-train on tomni-proxmox-113 (static gates + changed tests + vitest green on the 31-PR combined tree; the FULL unit run on the same set showed only load-timing flakes, the base-red consoleInterceptor-writes, and one regression since fixed in #15087).
⚠️ base-red inherited: #15306

**File**: `changelog.d/fixes/15087-required-account-proxy.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- **fix(proxy):** Count no-auth account proxy references during deletion and keep unresolved or inactive required proxy bindings from silently dispatching direct ([#15087](https://github.com/diegosouzapw/OmniRoute/pull/15087)) — thanks @xiaoyaner0201
```

**File**: `open-sse/executors/accountRotation.ts` (modified, +2/-0)
```diff
@@ -29,6 +29,8 @@ import { isProxyAvoided, proxyEgressKey } from "../utils/proxyRefusalMemory.ts";
  * stores in `providerSpecificData.fingerprints`). */
 export interface AccountProxyConfig {
   fingerprint: string;
+  /** A configured by-id proxy could not be resolved to a live registry entry. */
+  proxyUnavailable?: boolean;
   proxy: {
     type: string;
     host: string;
```

**File**: `open-sse/executors/opencode.ts` (modified, +5/-6)
```diff
@@ -32,12 +32,9 @@ import {
   resolveOpencodeCliDefaults,
 } from "../utils/opencodeHeaders.ts";
 import { projectOpencodeSessionBody } from "../utils/opencodeSessionIdentity.ts";
-import {
-  listForRequest,
-  releaseRequestList,
-  type ScopedAccount,
-  type ScopedAccountHealth,
-} from "./opencodeAccountScope.ts";
+import { listForRequest, releaseRequestList } from "./opencodeAccountScope.ts";
+import type { ScopedAccount, ScopedAccountHealth } from "./opencodeAccountScope.ts";
+import { guardRequiredAccountProxies } from "./opencodeRequiredProxy.ts";
 import {
   type AccountProxyConfig,
   type RotationAccountSnapshot,
@@ -541,6 +538,8 @@ export class OpencodeExecutor extends BaseExecutor {
       // empty when absent (never n/a/none/fabricated). The existing motif
       // stays byte-identical after the prefix.
       const cid = input.correlationId ? `correlationId=${input.correlationId} ` : "";
+      const proxyGuard = guardRequiredAccountProxies(input.credentials, accounts, log, cid);
+      if (proxyGuard) return proxyGuard;
       // Rotation attribution diagnostics (single flag read per request — the DB
       // override lookup is synchronous SQLite, never in the attempt loop).
       const attributionOn = isRotationAttributionEnabled();
```

**File**: `open-sse/executors/opencodeAccountScope.ts` (modified, +28/-9)
```diff
@@ -28,6 +28,21 @@ const scoped = new WeakMap<object, ScopedAccount[]>();
 
 const isObject = (value: unknown): value is object => typeof value === "object" && value !== null;
 
+/** Accounts whose configured proxy reference cannot provide safe egress. */
+export function requiredProxyUnavailableFingerprints(credentials: ProviderCredentials): string[] {
+  const accountProxies = credentials?.providerSpecificData?.accountProxies;
+  if (!Array.isArray(accountProxies)) return [];
+  return accountProxies
+    .filter(
+      (entry): entry is AccountProxyConfig =>
+        !!entry &&
+        typeof entry === "object" &&
+        typeof entry.fingerprint === "string" &&
+        entry.proxyUnavailable === true
+    )
+    .map((entry) => entry.fingerprint);
+}
+
 /**
  * Rebuild a request list from credentials, carrying over the shared health
  * known for each member. Empty fingerprints keep the single direct member,
@@ -43,23 +58,27 @@ export function syncFromHealth(
     : [];
 
   const accountProxies = psd?.accountProxies as AccountProxyConfig[] | undefined;
+  const unavailable = new Set(requiredProxyUnavailableFingerprints(credentials));
   const proxyMap = Array.isArray(accountProxies)
     ? new Map(accountProxies.map((ap) => [ap.fingerprint, ap.proxy ?? null] as const))
     : null;
 
   if (fingerprints.length === 0) {
+    if (unavailable.size > 0) return [];
     return [{ fingerprint: "", cooldownUntil: 0, consecutiveFails: 0, proxy: null }];
   }
 
-  return fingerprints.map((fp) => {
-    const prior = health.get(fp);
-    return {
-      fingerprint: fp,
-      cooldownUntil: prior?.cooldownUntil ?? 0,
-      consecutiveFails: prior?.consecutiveFails ?? 0,
-      proxy: proxyMap ? (proxyMap.get(fp) ?? null) : null,
-    };
-  });
+  return fingerprints
+    .filter((fp) => !unavailable.has(fp))
+    .map((fp) => {
+      const prior = health.get(fp);
+      return {
+        fingerprint: fp,
+        cooldownUntil: prior?.cooldownUntil ?? 0,
+        consecutiveFails: prior?.consecutiveFails ?? 0,
+        proxy: proxyMap ? (proxyMap.get(fp) ?? null) : null,
+      };
+    });
 }
 
 /** Fold a request list back into the shared store, keyed by member id. */
```

**File**: `open-sse/executors/opencodeRequiredProxy.ts` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+import { buildErrorBody } from "../utils/error.ts";
+import { maskAccountId } from "./accountRotation.ts";
+import {
+  requiredProxyUnavailableFingerprints,
+  type ScopedAccount,
+} from "./opencodeAccountScope.ts";
+import type { ExecutorExecuteResult, ExecutorLog, ProviderCredentials } from "./base.ts";
+
+/** Log blocked accounts and fail closed when none can safely dispatch. */
+export function guardRequiredAccountProxies(
+  credentials: ProviderCredentials,
+  accounts: ScopedAccount[],
+  log: ExecutorLog | null | undefined,
+  correlationPrefix: string
+): ExecutorExecuteResult | null {
+  const blockedAccounts = requiredProxyUnavailableFingerprints(credentials);
+  for (const fingerprint of blockedAccounts) {
+    log?.warn?.(
+      "OPENCODE",
+      `${correlationPrefix}skipping account ${maskAccountId(fingerprint)}: required proxy unavailable`
+    );
+  }
+  if (accounts.length > 0 || blockedAccounts.length === 0) return null;
+
+  return {
+    response: new Response(
+      JSON.stringify(
+        buildErrorBody(503, "Required account proxy is unavailable", undefined, {
+          code: "proxy_unavailable",
+        })
+      ),
+      { status: 503, headers: { "Content-Type": "application/json" } }
+    ),
+    url: "",
+    headers: {},
+    transformedBody: null,
+  };
+}
```

**File**: `src/lib/db/proxies.ts` (modified, +49/-2)
```diff
@@ -520,9 +520,51 @@ export async function getProxyWhereUsed(proxyId: string) {
     .all(proxyId)
     .map(mapAssignmentRow);
 
+  const connectionRows = db
+    .prepare("SELECT id, provider, provider_specific_data FROM provider_connections ORDER BY rowid")
+    .all() as Array<{
+    id?: string;
+    provider?: string;
+    provider_specific_data?: string | null;
+  }>;
+  const accountReferences: Array<{
+    connectionId: string;
+    provider: string;
+    accountCount: number;
+  }> = [];
+  let accountReferenceCount = 0;
+  for (const connection of connectionRows) {
+    if (typeof connection.id !== "string" || typeof connection.provider !== "string") continue;
+    let providerSpecificData: unknown;
+    try {
+      providerSpecificData = connection.provider_specific_data
+        ? JSON.parse(connection.provider_specific_data)
+        : null;
+    } catch {
+      continue;
+    }
+    if (!providerSpecificData || typeof providerSpecificData !== "object") continue;
+    const accountProxies = (providerSpecificData as { accountProxies?: unknown }).accountProxies;
+    if (!Array.isArray(accountProxies)) continue;
+    const accountCount = accountProxies.filter(
+      (entry) =>
+        !!entry && typeof entry === "object" && (entry as { proxyId?: unknown }).proxyId === proxyId
+    ).length;
+    if (accountCount === 0) continue;
+    accountReferenceCount += accountCount;
+    accountReferences.push({
+      connectionId: connection.id,
+      provider: connection.provider,
+      accountCount,
+    });
+  }
+
   return {
-    count: rows.length,
+    count: rows.length + accountReferenceCount,
+    assignmentCount: rows.length,
     assignments: rows,
+    accountReferenceCount,
+    accountReferences,
   };
 }
 
@@ -704,17 +746,22 @@ export async function deleteProxyById(id: string, options?: { force?: boolean })
 
   if (!force && usage.count > 0) {
     const err = new Error(
-      "Proxy is still assigned. Remove assignments first or use force=true"
+      "Proxy is still in use. Remove assignments or account references first, or use force=true"
     ) as Error & {
       status?: number;
       code?: string;
+      details?: unknown;
     };
     err.status = 409;
     err.code = "proxy_in_use";
+    err.details = usage;
     throw err;
   }
 
   if (force && usage.count > 0) {
+    // Account proxyId references intentionally remain as unresolved required bindings.
+    // Only an explicit account edit may unbind them; clearing them here would make
+    // the next request silently fall back to direct egress.
     db.prepare("DELETE FROM proxy_assignments WHERE proxy_id = ?").run(id);
   }
 
```

**File**: `src/lib/db/proxies/guards.ts` (modified, +7/-0)
```diff
@@ -3,6 +3,13 @@ import { getDbInstance } from "../core";
 export const PROXY_ALIVE_PREDICATE =
   "(p.status IS NULL OR LOWER(p.status) NOT IN ('inactive','error','disabled','dead','down'))";
 
+const PROXY_UNAVAILABLE_STATUSES = new Set(["inactive", "error", "disabled", "dead", "down"]);
+
+/** Keep by-id account proxy resolution aligned with the pool alive predicate above. */
+export function isProxyRegistryStatusAlive(status: unknown): boolean {
+  return status == null || !PROXY_UNAVAILABLE_STATUSES.has(String(status).toLowerCase());
+}
+
 export function isGlobalProxyEnabled(db: ReturnType<typeof getDbInstance>): boolean {
   try {
     const row = db
```

**File**: `src/sse/services/noAuthProxyResolution.ts` (modified, +22/-9)
```diff
@@ -1,4 +1,5 @@
 import { getProxyById } from "@/lib/db/proxies";
+import { isProxyRegistryStatusAlive } from "@/lib/db/proxies/guards";
 import { isRelayProxyType, extractRelayAuth } from "@/lib/db/proxies/mappers";
 
 /**
@@ -20,8 +21,9 @@ import { isRelayProxyType, extractRelayAuth } from "@/lib/db/proxies/mappers";
  *   - `proxyId` is looked up in the proxy registry and hydrated to its live
  *     `{ type, host, port, username?, password? }` record;
  *   - an inline `proxy` (custom / legacy) passes through unchanged;
- *   - an unknown/deleted `proxyId` (or any read failure) degrades to `proxy: null`
- *     (direct egress) — never throws.
+ *   - an unknown, inactive, or deleted `proxyId` (or any read failure) is
+ *     marked unavailable so the executor skips that account rather than
+ *     silently changing its required-proxy intent to direct egress.
  */
 
 export interface ResolvedAccountProxy {
@@ -46,6 +48,13 @@ interface ProxyRegistryRecordLike {
   username?: string | null;
   password?: string | null;
   notes?: string | null;
+  status?: string | null;
+}
+
+export interface ResolvedAccountProxyEntry {
+  fingerprint: string;
+  proxy: ResolvedAccountProxy | null;
+  proxyUnavailable?: true;
 }
 
 /** Async lookup of a proxy registry record by id (null when absent). */
@@ -78,27 +87,31 @@ function normalizeRecord(rec: ProxyRegistryRecordLike | Partial<ResolvedAccountP
 export async function resolveAccountProxies(
   entries: unknown,
   lookup: ProxyByIdLookup
-): Promise<Array<{ fingerprint: string; proxy: ResolvedAccountProxy | null }>> {
+): Promise<ResolvedAccountProxyEntry[]> {
   if (!Array.isArray(entries)) return [];
-  const out: Array<{ fingerprint: string; proxy: ResolvedAccountProxy | null }> = [];
+  const out: ResolvedAccountProxyEntry[] = [];
   for (const raw of entries) {
     if (!raw || typeof raw !== "object") continue;
     const entry = raw as AccountProxyEntry;
     if (typeof entry.fingerprint !== "string") continue;
 
     // By-id reference (Proxy Pool): resolve to the live record so a pool edit
-    // propagates to every referencing account. Unknown/deleted id → direct.
+    // propagates to every referencing account. Unknown/dead ids remain a
+    // required-proxy binding and therefore block direct dispatch.
     if (typeof entry.proxyId === "string" && entry.proxyId) {
       let record: ProxyRegistryRecordLike | null = null;
       try {
         record = await lookup(entry.proxyId);
       } catch {
         record = null;
       }
-      out.push({
-        fingerprint: entry.fingerprint,
-        proxy: record ? normalizeRecord(record) : null,
-      });
+      const proxy =
+        record && isProxyRegistryStatusAlive(record.status) ? normalizeRecord(record) : null;
+      out.push(
+        proxy
+          ? { fingerprint: entry.fingerprint, proxy }
+          : { fingerprint: entry.fingerprint, proxy: null, proxyUnavailable: true }
+      );
       continue;
     }
 
```

---

### Incident Patch 8: `b901cff7` (2026-10-02)
**Commit Message**: fix(capabilities): honor model-compat vision overrides in catalog and combos (#15086)

Validated in a local merge-train on tomni-proxmox-113 (static gates + changed tests + vitest green on the 31-PR combined tree; the FULL unit run on the same set showed only load-timing flakes, the base-red consoleInterceptor-writes, and one regression since fixed in #15087).
⚠️ base-red inherited: #15306

**File**: `changelog.d/fixes/15086-model-compat-vision.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- **fix(capabilities):** Apply explicit model-compat vision overrides consistently to model catalog and combo capability projections while preserving provider scope and Custom Models precedence ([#15086](https://github.com/diegosouzapw/OmniRoute/pull/15086)) — thanks @xiaoyaner0201
```

**File**: `src/app/api/v1/combos/projectCombo.ts` (modified, +26/-1)
```diff
@@ -14,7 +14,10 @@
  * capabilities (multimodal / reasoning / caching) so importing clients enable
  * those features instead of requiring manual config after import.
  */
-import { getResolvedModelCapabilities } from "@/lib/modelCapabilities";
+import {
+  createModelCapabilityResolutionSnapshot,
+  getResolvedModelCapabilities,
+} from "@/lib/modelCapabilities";
 import { resolveNestedComboTargets } from "@omniroute/open-sse/services/combo/comboStructure.ts";
 // The shapes live in the combo type module; comboStructure.ts only re-uses them
 // internally, so importing them from there is a TS2459/TS2724 at build time.
@@ -203,3 +206,25 @@ export function projectCombo(
 
   return out;
 }
+
+/** Project one request's combo collection with a single bulk capability snapshot. */
+export function projectComboCollectionWithCapabilities(combos: readonly unknown[]): PublicCombo[] {
+  const allCombos = combos.filter(
+    (combo): combo is Record<string, unknown> => Boolean(combo) && typeof combo === "object"
+  );
+  const snapshot = createModelCapabilityResolutionSnapshot();
+  const resolveCapabilities: ComboCapabilityResolver = (model) => {
+    const caps = getResolvedModelCapabilities(model, undefined, snapshot);
+    return { supportsVision: caps.supportsVision, reasoning: caps.reasoning };
+  };
+
+  return allCombos
+    .map((combo) =>
+      projectCombo(combo, {
+        includeCapabilities: true,
+        resolveCapabilities,
+        allCombos,
+      })
+    )
+    .filter((combo): combo is PublicCombo => combo !== null);
+}
```

**File**: `src/app/api/v1/combos/route.ts` (modified, +4/-13)
```diff
@@ -14,7 +14,7 @@ import { HTTP_STATUS } from "@omniroute/open-sse/config/constants.ts";
 import { extractApiKey, isValidApiKey } from "@/sse/services/auth";
 import { isDashboardSessionAuthenticated } from "@/shared/utils/apiAuth";
 import { isRequireApiKeyEnabled } from "@/shared/utils/featureFlags";
-import { projectCombo, type PublicCombo } from "./projectCombo";
+import { projectComboCollectionWithCapabilities } from "./projectCombo";
 
 export async function OPTIONS() {
   return new Response(null, {
@@ -43,18 +43,9 @@ export async function GET(request: Request) {
 
   try {
     const combos = await getCombos();
-    const data = (Array.isArray(combos) ? combos : [])
-      // #3979: advertise resolved capabilities so importing clients enable them
-      // #14232: pass the collection so combo-ref steps expand the same way the
-      // routing runtime and /v1/models resolve them, keeping the two catalogs
-      // in agreement for nested combos.
-      .map((c) =>
-        projectCombo(c as Record<string, unknown>, {
-          includeCapabilities: true,
-          allCombos: Array.isArray(combos) ? combos : [],
-        })
-      )
-      .filter((c): c is PublicCombo => c !== null);
+    // #3979/#14232: project the full collection through one canonical capability
+    // snapshot so nested combos agree with /v1/models without per-member reads.
+    const data = projectComboCollectionWithCapabilities(Array.isArray(combos) ? combos : []);
 
     return NextResponse.json(
       { object: "list", data },
```

**File**: `src/app/api/v1/vscode/[token]/combos/route.ts` (modified, +2/-12)
```diff
@@ -6,7 +6,7 @@
  * so we re-export /api/version, /api/tags, etc. from the [token] parent route.
  */
 import { getCombos } from "@/lib/db/combos";
-import { projectCombo, type PublicCombo } from "@/app/api/v1/combos/projectCombo";
+import { projectComboCollectionWithCapabilities } from "@/app/api/v1/combos/projectCombo";
 
 // Re-export Ollama-compatible endpoints from the parent [token] route
 // so VS Code can validate the server version and list models normally
@@ -23,17 +23,7 @@ export async function GET(request: Request) {
   try {
     const combos = await getCombos();
     const allCombos = Array.isArray(combos) ? combos : [];
-    const data = allCombos
-      // #3979: advertise resolved capabilities so importing clients enable them
-      // #14232: pass the collection so combo-ref steps expand the same way the
-      // routing runtime resolves them.
-      .map((combo) =>
-        projectCombo(combo as Record<string, unknown>, {
-          includeCapabilities: true,
-          allCombos,
-        })
-      )
-      .filter((combo): combo is PublicCombo => combo !== null);
+    const data = projectComboCollectionWithCapabilities(allCombos);
 
     return new Response(JSON.stringify({ object: "list", data, combos: data }), {
       headers: {
```

**File**: `src/app/api/v1/vscode/raw/[token]/combos/route.ts` (modified, +2/-12)
```diff
@@ -6,7 +6,7 @@
  * so we re-export /api/version, /api/tags, etc. from the [token] parent route.
  */
 import { getCombos } from "@/lib/db/combos";
-import { projectCombo, type PublicCombo } from "@/app/api/v1/combos/projectCombo";
+import { projectComboCollectionWithCapabilities } from "@/app/api/v1/combos/projectCombo";
 
 // Re-export Ollama-compatible endpoints from the parent [token] route
 // so VS Code can validate the server version and list models normally
@@ -23,17 +23,7 @@ export async function GET(request: Request) {
   try {
     const combos = await getCombos();
     const allCombos = Array.isArray(combos) ? combos : [];
-    const data = allCombos
-      // #3979: advertise resolved capabilities so importing clients enable them
-      // #14232: pass the collection so combo-ref steps expand the same way the
-      // routing runtime resolves them.
-      .map((combo) =>
-        projectCombo(combo as Record<string, unknown>, {
-          includeCapabilities: true,
-          allCombos,
-        })
-      )
-      .filter((combo): combo is PublicCombo => combo !== null);
+    const data = projectComboCollectionWithCapabilities(allCombos);
 
     return new Response(JSON.stringify({ object: "list", data, combos: data }), {
       headers: {
```

**File**: `src/lib/db/models/compat.ts` (modified, +77/-0)
```diff
@@ -130,6 +130,9 @@ export type ModelCompatOverride = {
   supportsVision?: boolean;
 };
 
+/** Nested provider → model map of explicit model-compat vision overrides. */
+export type ModelCompatVisionOverrideMap = ReadonlyMap<string, ReadonlyMap<string, boolean>>;
+
 /**
  * Resolve whether an override hides its model for a given modality.
  * Precedence: an explicit `hiddenModalities[modality]` entry always wins;
@@ -188,6 +191,80 @@ export function getModelCompatOverrides(providerId: string): ModelCompatOverride
   return readCompatList(providerId);
 }
 
+/**
+ * Resolve one exact provider/model `supportsVision` compat override.
+ * A supplied bulk map performs no SQLite work.
+ */
+export function getModelCompatVisionOverride(
+  providerId: string,
+  modelIds: readonly string[],
+  bulk?: ModelCompatVisionOverrideMap | null
+): boolean | null {
+  if (!providerId || modelIds.length === 0) return null;
+  const candidates = new Set(modelIds.filter(Boolean));
+  if (candidates.size === 0) return null;
+
+  try {
+    const overrides = bulk
+      ? bulk.get(providerId)
+      : new Map(
+          readCompatList(providerId).flatMap((entry) =>
+            typeof entry.supportsVision === "boolean"
+              ? [[entry.id, entry.supportsVision] as const]
+              : []
+          )
+        );
+    if (!overrides) return null;
+    for (const modelId of candidates) {
+      const value = overrides.get(modelId);
+      if (typeof value === "boolean") return value;
+    }
+  } catch {
+    // Capability resolution must remain available when the override store is unavailable.
+  }
+  return null;
+}
+
+function parseCompatVisionOverrides(value: string): Map<string, boolean> {
+  try {
+    const parsed = JSON.parse(value) as unknown;
+    if (!Array.isArray(parsed)) return new Map<string, boolean>();
+    return new Map(
+      parsed.flatMap((candidate) => {
+        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
+        const { id, supportsVision } = candidate as {
+          id?: unknown;
+          supportsVision?: unknown;
+        };
+        return typeof id === "string" && typeof supportsVision === "boolean"
+          ? [[id, supportsVision] as const]
+          : [];
+      })
+    );
+  } catch {
+    return new Map<string, boolean>();
+  }
+}
+
+/** Bulk-load all explicit model-compat vision overrides with one SQLite query. */
+export function listModelCompatVisionOverrides(): ModelCompatVisionOverrideMap {
+  try {
+    const rows = getDbInstance()
+      .prepare("SELECT key, value FROM key_value WHERE namespace = 'modelCompatOverrides'")
+      .all();
+    const result = new Map<string, Map<string, boolean>>();
+    for (const row of rows) {
+      const { key, value } = getKeyValue(row);
+      if (!key || !value) continue;
+      const byModel = parseCompatVisionOverrides(value);
+      if (byModel.size > 0) result.set(key, byModel);
+    }
+    return result;
+  } catch {
+    return new Map<string, Map<string, boolean>>();
+  }
+}
+
 export type ModelCompatPatch = {
   normalizeToolCallId?: boolean;
   preserveOpenAIDeveloperRole?: boolean | null;
```

**File**: `src/lib/modelCapabilities.ts` (modified, +54/-0)
```diff
@@ -22,9 +22,11 @@ import {
   getModelCapabilityOverride,
   getReasoningEffortsOverride,
 } from "@/lib/db/modelCapabilityOverrides";
+import { getModelCompatVisionOverride } from "@/lib/db/models/compat";
 import { getCustomModelVisionOverride, getSyncedAvailableModelVision } from "@/lib/db/models";
 import type { ModelCapabilityResolutionSnapshot } from "@/lib/modelCapabilityResolutionSnapshot";
 import { resolveAudioCapability, resolveVideoCapability } from "@/lib/modelCapabilityModalities";
+import { getNoAuthHydrationProviderIds } from "@/sse/services/noAuthProviderSiblings";
 
 export type { ModelCapabilityResolutionSnapshot } from "@/lib/modelCapabilityResolutionSnapshot";
 export { createModelCapabilityResolutionSnapshot } from "@/lib/modelCapabilityResolutionSnapshot";
@@ -205,11 +207,13 @@ function resolveCapabilityInput(input: CapabilityInput) {
   if (typeof input === "string") {
     const parsed = parseModel(input);
     const rawModel = toNonEmptyString(parsed.model);
+    const rawProvider = toNonEmptyString(parsed.providerAlias || parsed.provider);
     if (parsed.provider) {
       const canonical = resolveCanonicalProviderModel(parsed.provider, rawModel);
       return {
         provider: canonical.provider,
         model: toNonEmptyString(canonical.model),
+        rawProvider,
         rawModel,
         lookupKey: input,
       };
@@ -218,6 +222,7 @@ function resolveCapabilityInput(input: CapabilityInput) {
     return {
       provider: null,
       model: rawModel,
+      rawProvider,
       rawModel,
       lookupKey: input,
     };
@@ -233,6 +238,7 @@ function resolveCapabilityInput(input: CapabilityInput) {
     return {
       provider: canonical.provider,
       model: toNonEmptyString(canonical.model),
+      rawProvider,
       rawModel,
       lookupKey: rawModel ? `${canonical.provider}/${rawModel}` : canonical.provider,
     };
@@ -241,6 +247,7 @@ function resolveCapabilityInput(input: CapabilityInput) {
   return {
     provider: null,
     model: rawModel,
+    rawProvider,
     rawModel,
     lookupKey: rawModel || "",
   };
@@ -539,6 +546,7 @@ function resolveVisionCapability(
   modalitiesOutput: string[],
   modelId?: string,
   customVisionOverride?: boolean | null,
+  compatVisionOverride?: boolean | null,
   syncedAvailableModelVision?: boolean | null
 ): boolean | null {
   const allModalities = [...modalitiesInput, ...modalitiesOutput].map((entry) =>
@@ -553,6 +561,13 @@ function resolveVisionCapability(
     return customVisionOverride;
   }
 
+  // #14587: the compat-only edit path is the same explicit operator control
+  // runtime routing already consumes. Custom Models stays first; compat then
+  // wins over synced/catalog/heuristic sources, including with explicit false.
+  if (typeof compatVisionOverride === "boolean") {
+    return compatVisionOverride;
+  }
+
   // Hard override FIRST: a wrong synced `attachment:true` (or image modality) must not
   // win for models the vendor documents as text-only. Beats every branch below so an
   // image request can never be routed to a blind model (#4071).
@@ -742,6 +757,40 @@ function getReasoningEffortsCapabilityOverride(
   );
 }
 
+/** Resolve the runtime-compatible provider/model keys for a compat vision override. */
+function getCompatVisionOverride(
+  resolved: {
+    provider: string | null;
+    model: string | null;
+    rawProvider: string | null;
+    rawModel: string | null;
+  },
+  snapshot?: ModelCapabilityResolutionSnapshot | null
+): boolean | null {
+  if (!resolved.provider || !resolved.model) return null;
+  const providerCandidates = Array.from(
+    new Set(
+      [
+        ...getNoAuthHydrationProviderIds(resolved.provider),
+        resolved.rawProvider,
+        resolved.rawProvider ? resolveProviderAlias(resolved.rawProvider) : null,
+      ].filter((value): value is string => Boolean(value))
+    )
+  );
+  const modelCandidates = Array.from(
+    new Set([resolved.model, resolved.rawModel].filter((value): value is string => Boolean(value)))
+  );
+  for (const providerId of providerCandidates) {
+    const value = getModelCompatVisionOverride(
+      providerId,
+      modelCandidates,
+      snapshot?.compatVisionOverrides
+    );
+    if (value !== null) return value;
+  }
+  return null;
+}
+
 export function getExplicitModelOutputCap(
   input: CapabilityInput,
   snapshot?: ModelCapabilityResolutionSnapshot | null
@@ -897,6 +946,10 @@ export function getResolvedModelCapabilities(
         )
       : null;
 
+  const compatVisionOverride = usePersistedOverrides
+    ? getCompatVisionOverride(resolved, snapshot)
+    : null;
+
   // #14081: positive-only vision verdict from a custom node's synced
   // `syncedAvailableModels` row, mirroring the catalog's buildSyncedCapabilities.
   const syncedAvailableModelVision =
@@ -916,6 +969,7 @@ export function getResolvedModelCapabilities(
     modalitiesOutput,
     lookupKey,
     customVisionOverride,
+    compatVisionOverride,
  
```

**File**: `src/lib/modelCapabilityResolutionSnapshot.ts` (modified, +6/-0)
```diff
@@ -11,6 +11,10 @@
 import { listModelCapabilityOverrides } from "@/lib/db/modelCapabilityOverrides";
 import type { ReasoningEffortOverrideValue } from "@/shared/reasoning/reasoningEffortsOverride";
 import { listModelContextOverrides } from "@/lib/db/modelContextOverrides";
+import {
+  listModelCompatVisionOverrides,
+  type ModelCompatVisionOverrideMap,
+} from "@/lib/db/models/compat";
 import {
   listCustomModelVisionOverrides,
   type CustomModelVisionOverrideMap,
@@ -37,6 +41,7 @@ export interface ModelCapabilityResolutionSnapshot {
   readonly reasoningEffortsOverrides: NestedReasoningEffortsOverrideMap;
   readonly contextOverrides: NestedOverrideMap;
   readonly customVisionOverrides: CustomModelVisionOverrideMap;
+  readonly compatVisionOverrides: ModelCompatVisionOverrideMap;
   /** #14081: positive-only vision verdicts from synced custom-node model rows. */
   readonly syncedAvailableModelVision: SyncedAvailableModelVisionMap;
 }
@@ -102,6 +107,7 @@ export function createModelCapabilityResolutionSnapshot(
     reasoningEffortsOverrides,
     contextOverrides,
     customVisionOverrides: listCustomModelVisionOverrides(options.customModelVision),
+    compatVisionOverrides: listModelCompatVisionOverrides(),
     syncedAvailableModelVision: listSyncedAvailableModelVision(),
   };
 }
```

---

### Incident Patch 9: `fca2f868` (2026-10-02)
**Commit Message**: fix(translator): pair unpaired Responses function_call items with synthesized outputs (#15216) (#15231)

Validated in a local merge-train on tomni-proxmox-113 (static gates + changed tests + vitest green on the 31-PR combined tree; the FULL unit run on the same set showed only load-timing flakes, the base-red consoleInterceptor-writes, and one regression since fixed in #15087).
⚠️ base-red inherited: #15306

**File**: `open-sse/translator/request/openai-responses/toResponses.ts` (modified, +31/-1)
```diff
@@ -366,12 +366,42 @@ export function openaiToOpenAIResponsesRequest(
       )
       .map((item: { type?: string; call_id?: string }) => item.call_id)
   );
-  result.input = input.filter((item: { type?: string; call_id?: string }) => {
+  const orphanFilteredInput = input.filter((item: { type?: string; call_id?: string }) => {
     if (item.type === "function_call_output" && item.call_id) {
       return knownCallIds.has(item.call_id);
     }
     return true;
   });
+  result.input = orphanFilteredInput;
+
+  // Mirror of the filter above: a `function_call` whose output never arrived
+  // (truncated history, client crash mid-tool-loop) makes strict Responses
+  // upstreams reject the whole request with 400 "No tool output found for
+  // function call <id>". Pair every unpaired call with a synthesized empty
+  // output in place rather than dropping the call, so the model still sees
+  // that the call happened and the caller's history stays intact (#15216).
+  const pairedOutputCallIds = new Set(
+    orphanFilteredInput
+      .filter(
+        (item: { type?: string; call_id?: string }) =>
+          item.type === "function_call_output" && item.call_id
+      )
+      .map((item: { type?: string; call_id?: string }) => item.call_id)
+  );
+  const pairedInput: JsonRecord[] = [];
+  for (const item of orphanFilteredInput as Array<{ type?: string; call_id?: string }>) {
+    pairedInput.push(item);
+    if (item.type === "function_call" && item.call_id && !pairedOutputCallIds.has(item.call_id)) {
+      pairedInput.push({
+        type: "function_call_output",
+        call_id: item.call_id,
+        output: "",
+        status: "completed",
+      });
+      pairedOutputCallIds.add(item.call_id);
+    }
+  }
+  result.input = pairedInput;
 
   // If no system message, keep empty instructions
   if (!hasSystemMessage) {
```

**File**: `tests/unit/responses-trailing-orphan-function-call-15216.test.ts` (added, +158/-0)
```diff
@@ -0,0 +1,158 @@
+/**
+ * #15216 — Chat Completions → Responses direction: an assistant `tool_calls`
+ * turn with no matching trailing `role: "tool"` output was forwarded as an
+ * unpaired `function_call` item in the Responses input, which strict Responses
+ * upstreams reject with `400 No tool output found for function call <id>`.
+ *
+ * The fix pairs every unpaired `function_call` with a synthesized empty
+ * `function_call_output` in place — the mirror image of the existing
+ * orphan-output filter in the same file, and consistent with how the
+ * reverse direction already repairs orphaned history.
+ *
+ * Run: node --import tsx/esm --test tests/unit/responses-trailing-orphan-function-call-15216.test.ts
+ */
+import test from "node:test";
+import assert from "node:assert/strict";
+
+const { openaiToOpenAIResponsesRequest } =
+  await import("../../open-sse/translator/request/openai-responses.ts");
+
+type InputItem = {
+  type?: string;
+  call_id?: string;
+  output?: unknown;
+  status?: string;
+};
+
+function translate(body: unknown): { input: InputItem[] } {
+  return openaiToOpenAIResponsesRequest("gpt-4", body, true, {}) as { input: InputItem[] };
+}
+
+const ORPHAN_REPRO = {
+  messages: [
+    { role: "user", content: "Say OK." },
+    {
+      role: "assistant",
+      content: null,
+      tool_calls: [
+        {
+          id: "call_orphan_livecheck",
+          type: "function",
+          function: { name: "probe", arguments: '{"q":"alpha"}' },
+        },
+      ],
+    },
+  ],
+};
+
+test("#15216: trailing unpaired function_call is repaired with a synthesized empty output", () => {
+  const result = translate(ORPHAN_REPRO);
+
+  const calls = result.input.filter((item) => item.type === "function_call");
+  const outputs = result.input.filter((item) => item.type === "function_call_output");
+
+  assert.equal(calls.length, 1, "the orphan call itself must survive");
+  assert.equal(calls[0].call_id, "call_orphan_livecheck");
+  assert.equal(
+    outputs.length,
+    1,
+    "exactly one function_call_output must exist — currently the orphan goes out unpaired and strict upstreams 400"
+  );
+  assert.equal(outputs[0].call_id, "call_orphan_livecheck");
+  assert.equal(outputs[0].output, "");
+  assert.equal(outputs[0].status, "completed");
+
+  // The synthesized output must come AFTER its call in the input order.
+  const callIdx = result.input.findIndex((item) => item.type === "function_call");
+  const outputIdx = result.input.findIndex((item) => item.type === "function_call_output");
+  assert.ok(outputIdx > callIdx, "synthesized output must follow its call");
+});
+
+test("#15216: a properly paired call keeps its real output untouched", () => {
+  const result = translate({
+    messages: [
+      { role: "user", content: "Say OK." },
+      {
+        role: "assistant",
+        content: null,
+        tool_calls: [
+          {
+            id: "call_real",
+            type: "function",
+            function: { name: "probe", arguments: "{}" },
+          },
+        ],
+      },
+      { role: "tool", tool_call_id: "call_real", content: "real result" },
+    ],
+  });
+
+  const outputs = result.input.filter((item) => item.type === "function_call_output");
+  assert.equal(outputs.length, 1, "no synthesized output may be added next to a real one");
+  assert.equal(outputs[0].call_id, "call_real");
+  assert.equal(outputs[0].output, "real result");
+});
+
+test("#15216: mid-history unpaired call is paired in place without disturbing later items", () => {
+  const result = translate({
+    messages: [
+      { role: "user", content: "first" },
+      {
+        role: "assistant",
+        content: "calling tool",
+        tool_calls: [
+          {
+            id: "call_lost",
+            type: "function",
+            function: { name: "probe", arguments: "{}" },
+          },
+        ],
+      },
+      { role: "user", content: "continue" },
+    ],
+  });
+
+  const types = result.input.map((item) => item.type);
+  const callIdx = types.indexOf("function_call");
+  const outputIdx = types.indexOf("function_call_output");
+
+  assert.ok(callIdx >= 0, "orphan call must survive translation");
+  assert.notEqual(outputIdx, -1, "an output item must exist for the mid-history orphan");
+  assert.equal(
+    outputIdx,
+    callIdx + 1,
+    "synthesized output must sit immediately after the orphan call"
+  );
+  assert.equal(result.input[outputIdx].call_id, "call_lost");
+  assert.equal(result.input[outputIdx].output, "");
+  // The trailing user message keeps its position after the repaired pair.
+  const continueIdx = types.lastIndexOf("message");
+  assert.equal(continueIdx, outputIdx + 1, "the trailing user message follows the repaired pair");
+});
+
+test("#15216: mixed turn — only the call missing its output is synthesized", () => {
+  const result = translate({
+    messages: [
+      { role: "user", content: "Say OK." },
+      {
+        role: "assistant",
+        content
```

---

### Incident Patch 10: `ee170e8e` (2026-10-02)
**Commit Message**: fix(cache): honor bypass and database toggle for reads and writes (#15155)

Validated in a local merge-train on tomni-proxmox-113 (static gates + changed tests + vitest green on the 31-PR combined tree; the FULL unit run on the same set showed only load-timing flakes, the base-red consoleInterceptor-writes, and one regression since fixed in #15087).
⚠️ base-red inherited: #15306

**File**: `changelog.d/fixes/15155-cache-bypass-skips-writes.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- **fix(cache):** API keys configured with `cache_default_mode=bypass` now skip semantic-cache writes as well as reads, including streaming responses. The persisted database `semanticCacheEnabled` toggle now gates the request path alongside the general settings toggle.
```

**File**: `open-sse/handlers/chatCore.ts` (modified, +2/-2)
```diff
@@ -34,7 +34,7 @@ export {
 } from "./chatCore/claudeSystemRole.ts";
 import { checkIdempotencyCache } from "./chatCore/idempotency.ts";
 import { acquireTurnExecution, createTurnInProgressResult } from "./chatCore/turnExecutionGuard.ts";
-import { checkSemanticCache } from "./chatCore/semanticCache.ts";
+import { checkSemanticCache, isSemanticCacheEnabled } from "./chatCore/semanticCache.ts";
 import { checkLifecycle, resolveLifecycle } from "./chatCore/modelLifecyclePolicy.ts";
 import {
   shouldDefaultAllowClassifier,
@@ -1248,7 +1248,7 @@ async function handleChatCoreInner({
   });
   effectiveServiceTier = resolveEffectiveServiceTier(body);
   setGeminiThoughtSignatureMode(settings.antigravitySignatureCacheMode);
-  const semanticCacheEnabled = settings.semanticCacheEnabled !== false;
+  const semanticCacheEnabled = isSemanticCacheEnabled(settings, apiKeyInfo);
 
   const reqLogger = await createRequestLogger(sourceFormat, targetFormat, model, {
     enabled: detailedLoggingEnabled && !videoBridgeObserved,
```

**File**: `open-sse/handlers/chatCore/semanticCache.ts` (modified, +14/-0)
```diff
@@ -6,13 +6,27 @@ import {
   outputContractOf,
 } from "@/lib/semanticCache";
 import { calculateCost } from "@/lib/usage/costCalculator";
+import { getUserDatabaseSettings } from "@/lib/db/databaseSettings";
 import { finalizePendingScope, type PendingRequestScope } from "@/lib/usage/pendingRequestScope";
 import { synthesizeOpenAiSseFromJson } from "../../utils/jsonToSse.ts";
 import { attachOmniRouteMetaHeaders } from "@/domain/omnirouteResponseMeta";
 import { extractUsageFromResponse } from "../usageExtractor.ts";
 import { OMNIROUTE_RESPONSE_HEADERS } from "@/shared/constants/headers";
 import { getSemanticCacheManager } from "../../services/cache/semanticCacheManager.ts";
 
+export function isSemanticCacheEnabled(
+  settings: Record<string, unknown>,
+  apiKeyInfo?: { cacheDefaultMode?: unknown } | null
+): boolean {
+  // Use the same decision for lookup and both response-store paths. The database
+  // toggle lives outside the general settings namespace.
+  return (
+    apiKeyInfo?.cacheDefaultMode !== "bypass" &&
+    settings.semanticCacheEnabled !== false &&
+    getUserDatabaseSettings().cache.semanticCacheEnabled !== false
+  );
+}
+
 export async function checkSemanticCache({
   semanticCacheEnabled,
   body,
```

**File**: `tests/unit/chatcore-cache-policy.test.ts` (added, +188/-0)
```diff
@@ -0,0 +1,188 @@
+import test from "node:test";
+import assert from "node:assert/strict";
+import fs from "node:fs";
+import os from "node:os";
+import path from "node:path";
+
+const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-cache-policy-"));
+process.env.DATA_DIR = TEST_DATA_DIR;
+process.env.OMNIROUTE_PLUGINS_DIR = path.join(TEST_DATA_DIR, "plugins");
+
+const core = await import("../../src/lib/db/core.ts");
+const { updateDatabaseSettings } = await import("../../src/lib/db/databaseSettings.ts");
+const { clearCache, getCachedResponse, generateSignature } =
+  await import("../../src/lib/semanticCache.ts");
+const { SemanticCacheManager, resetSemanticCacheManager } =
+  await import("../../open-sse/services/cache/semanticCacheManager.ts");
+const { handleChatCore } = await import("../../open-sse/handlers/chatCore.ts");
+const { clearInflight } = await import("../../open-sse/services/requestDedup.ts");
+const { clearPendingRequests } = await import("../../src/lib/usage/usageHistory.ts");
+const { waitForCallLogSaves } = await import("../../src/lib/usage/callLogs.ts");
+const originalFetch = globalThis.fetch;
+
+async function flushAsyncSideEffects() {
+  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
+}
+
+function buildOpenAIResponse(stream: boolean, text: string) {
+  const completion = {
+    id: "chatcmpl-cache-policy",
+    object: stream ? "chat.completion.chunk" : "chat.completion",
+    model: "gpt-4o-mini",
+    choices: [
+      {
+        index: 0,
+        ...(stream
+          ? { delta: { role: "assistant", content: text } }
+          : { message: { role: "assistant", content: text } }),
+        finish_reason: "stop",
+      },
+    ],
+    usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
+  };
+  return new Response(
+    stream ? `data: ${JSON.stringify(completion)}\n\ndata: [DONE]\n\n` : JSON.stringify(completion),
+    { headers: { "Content-Type": stream ? "text/event-stream" : "application/json" } }
+  );
+}
+
+async function invokeChatCore({
+  body,
+  apiKeyInfo,
+  accept,
+  responseFactory,
+}: {
+  body: Record<string, unknown>;
+  apiKeyInfo: { id: string; cacheDefaultMode: string };
+  accept: string;
+  responseFactory: () => Response;
+}) {
+  const calls: unknown[] = [];
+  globalThis.fetch = async () => {
+    calls.push(true);
+    return responseFactory();
+  };
+  const result = await handleChatCore({
+    body: structuredClone(body),
+    modelInfo: { provider: "openai", model: "gpt-4o-mini" },
+    credentials: { apiKey: "sk-test", providerSpecificData: {} },
+    apiKeyInfo,
+    log: { debug() {}, info() {}, warn() {}, error() {} },
+    clientRawRequest: {
+      endpoint: "/v1/chat/completions",
+      body: structuredClone(body),
+      headers: new Headers({ accept }),
+    },
+  } as Parameters<typeof handleChatCore>[0]);
+  await flushAsyncSideEffects();
+  return { result, calls };
+}
+
+test.afterEach(async () => {
+  globalThis.fetch = originalFetch;
+  await waitForCallLogSaves(5000);
+  clearPendingRequests();
+  clearInflight();
+  clearCache();
+  resetSemanticCacheManager(null);
+  core.resetDbInstance();
+  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
+  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
+});
+
+test.after(async () => {
+  await waitForCallLogSaves(5000);
+  core.resetDbInstance();
+  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
+});
+for (const stream of [false, true]) {
+  for (const control of ["key bypass", "database toggle", "legacy database toggle"]) {
+    test(`chatCore skips semantic cache writes with ${control} (stream=${stream})`, async () => {
+      const manager = new SemanticCacheManager({ enabled: true }, undefined, async () => ({
+        embedding: [1, 0],
+        inputTokens: 1,
+      }));
+      resetSemanticCacheManager(manager);
+      const apiKeyInfo = { id: "cache-policy-key", cacheDefaultMode: "legacy" };
+      const body = {
+        model: "gpt-4o-mini",
+        stream,
+        temperature: 0,
+        messages: [{ role: "user", content: `cache policy ${control} ${stream}` }],
+      };
+      const setEnabled = (enabled: boolean) => {
+        if (control === "key bypass") {
+          apiKeyInfo.cacheDefaultMode = enabled ? "legacy" : "bypass";
+        } else if (control === "database toggle") {
+          updateDatabaseSettings({ cache: { semanticCacheEnabled: enabled } });
+        } else {
+          core
+            .getDbInstance()
+            .prepare(
+              "UPDATE key_value SET value = ? WHERE namespace = 'databaseSettings' AND key = 'semanticCacheEnabled'"
+            )
+            .run(JSON.stringify(enabled));
+        }
+      };
+      const invoke = () =>
+        invokeChatCore({
+          body,
+          apiKeyInfo,
+          accept: stream ? "text/event-stream" : "application/json",
+          res
```

---

### Incident Patch 11: `c74037b9` (2026-10-02)
**Commit Message**: fix(combo): preserve terminal upstream error codes (#15154)

Validated in a local merge-train on tomni-proxmox-113 (static gates + changed tests + vitest green on the 31-PR combined tree; the FULL unit run on the same set showed only load-timing flakes, the base-red consoleInterceptor-writes, and one regression since fixed in #15087).
⚠️ base-red inherited: #15306

**File**: `changelog.d/fixes/15154-combo-terminal-error-code.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- **fix(combo):** preserve terminal upstream error codes such as `invalid_encrypted_content` in combo errors so Responses clients can recover from rejected reasoning replay. Mixed failure classes retain their aggregate status and generic code.
```

**File**: `open-sse/services/combo/comboAttemptLoop.ts` (modified, +3/-1)
```diff
@@ -33,6 +33,7 @@ import {
   formatComboOutcomes,
   buildRedactedSummary,
   resolveComboTerminalStatus,
+  resolveComboTerminalCode,
 } from "./comboErrorAggregation.ts";
 import {
   resolveComboCooldownWaitDecision,
@@ -698,7 +699,8 @@ export async function dispatchWithCooldownRetry(opts: {
         errorResponseWithComboDiagnostics(
           status,
           msg,
-          buildComboDiag(state, deps.traceInvocationId, terminalReason, retryAfterSeconds)
+          buildComboDiag(state, deps.traceInvocationId, terminalReason, retryAfterSeconds),
+          { code: resolveComboTerminalCode(state.comboErrors, status) }
         ),
         state.observedFailure ? state.allObservedFailuresQuota : null
       );
```

**File**: `open-sse/services/combo/comboErrorAggregation.ts` (modified, +18/-11)
```diff
@@ -18,20 +18,14 @@
  */
 
 export type ComboOutcomeKind =
-  | "quality"
-  | "auth"
-  | "rate_limit"
-  | "model"
-  | "provider"
-  | "timeout"
-  | "skipped"
-  | "upstream";
+  "quality" | "auth" | "rate_limit" | "model" | "provider" | "timeout" | "skipped" | "upstream";
 
 export interface ComboErrorEntry {
   model: string;
   status: number;
   error: string;
   kind: ComboOutcomeKind;
+  code?: string;
 }
 
 const KIND_LABELS: Record<ComboOutcomeKind, string> = {
@@ -95,7 +89,8 @@ export function redactConnectionLabel(modelStr: string | null | undefined): stri
 /** Build the redacted, collision-free `model (status)` summary used by the
  *  global-combo-timeout diagnostics path. */
 export function buildRedactedSummary(
-  entries: Array<{ model: string; status: number }> | ReadonlyArray<{ model: string; status: number }>
+  entries:
+    Array<{ model: string; status: number }> | ReadonlyArray<{ model: string; status: number }>
 ): string {
   const slice = entries.slice(0, 5);
   const parts = slice.map((e) => `${redactConnectionLabel(e.model)} (${e.status})`).join(", ");
@@ -117,7 +112,7 @@ export function formatComboOutcomes(
   const slice = entries.slice(0, 5);
   const parts = slice.map((e) => {
     const label = redact ? redactConnectionLabel(e.model) : e.model;
-    const kind = e.kind ? KIND_LABELS[e.kind] ?? e.kind : null;
+    const kind = e.kind ? (KIND_LABELS[e.kind] ?? e.kind) : null;
     // #10501: the raw upstream error TEXT can itself carry a connection/account
     // identifier (some openai-compatible proxies echo it back in the error body,
     // e.g. "invalid key for connection <uuid>") — redact it here too, not just
@@ -176,4 +171,16 @@ export function resolveComboTerminalStatus(
   }
 
   return entries.some((e) => e.kind === "timeout") ? 504 : 502;
-}
\ No newline at end of file
+}
+
+/** Preserve the terminal target's code only when it represents the aggregate verdict. */
+export function resolveComboTerminalCode(
+  entries: ReadonlyArray<ComboErrorEntry>,
+  status: number
+): string | undefined {
+  const terminal = entries.at(-1);
+  if (terminal?.status !== status || entries.some((entry) => entry.kind !== terminal.kind)) {
+    return undefined;
+  }
+  return terminal.code;
+}
```

**File**: `open-sse/services/combo/executeTargetAttempt.ts` (modified, +2/-0)
```diff
@@ -935,6 +935,7 @@ export async function executeTargetAttempt(opts: {
         status: result.status,
         error: errorText || String(result.status),
         kind: classifyComboOutcome(result.status, errorText),
+        code: structuredError?.code,
       });
       state.lastStatus = result.status;
       if (i > 0) state.fallbackCount++;
@@ -1160,6 +1161,7 @@ export async function executeTargetAttempt(opts: {
       status: result.status,
       error: errorText || String(result.status),
       kind: classifyComboOutcome(result.status, errorText),
+      code: structuredError?.code,
     });
     state.lastStatus = result.status;
     if (i > 0) state.fallbackCount++;
```

**File**: `open-sse/services/combo/roundRobinCombo.ts` (modified, +4/-3)
```diff
@@ -51,6 +51,7 @@ import {
   formatComboOutcomes,
   redactConnectionLabel,
   resolveComboTerminalStatus,
+  resolveComboTerminalCode,
   type ComboErrorEntry,
 } from "./comboErrorAggregation.ts";
 import { isProviderInCooldown, recordProviderCooldown } from "../providerCooldownTracker.ts";
@@ -1105,6 +1106,7 @@ export async function handleRoundRobinCombo({
             status: result.status,
             error: errorText || String(result.status),
             kind: classifyComboOutcome(result.status, errorText),
+            code: structuredError?.code,
           });
           if (offset > 0) fallbackCount++;
           log.warn("COMBO-RR", `${modelStr} failed, trying next model`, {
@@ -1269,8 +1271,7 @@ export async function handleRoundRobinCombo({
   }
 
   log.warn("COMBO-RR", `All models failed | ${msg}`);
-  return new Response(JSON.stringify({ error: { message: msg } }), {
-    status,
-    headers: { "Content-Type": "application/json" },
+  return errorResponse(status, msg, {
+    code: resolveComboTerminalCode(rrOutcomes, status),
   });
 }
```

**File**: `tests/unit/combo-error-code-terminal.test.ts` (added, +136/-0)
```diff
@@ -0,0 +1,136 @@
+import test from "node:test";
+import assert from "node:assert/strict";
+import fs from "node:fs";
+import os from "node:os";
+import path from "node:path";
+
+import {
+  OPENAI_RESPONSES_ERROR_FRAME,
+  withEarlyStreamKeepalive,
+} from "../../open-sse/utils/earlyStreamKeepalive.ts";
+
+const originalDataDir = process.env.DATA_DIR;
+const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-combo-terminal-code-"));
+process.env.DATA_DIR = testDataDir;
+
+const { handleComboChat } = await import("../../open-sse/services/combo.ts");
+const { resetDbInstance } = await import("../../src/lib/db/core.ts");
+const { resetAllComboMetrics } = await import("../../open-sse/services/comboMetrics.ts");
+const { resetAllCircuitBreakers } = await import("../../src/shared/utils/circuitBreaker.ts");
+const { clearAllModelLockouts } = await import("../../open-sse/services/accountFallback.ts");
+const { resetAll: resetAllSemaphores } =
+  await import("../../open-sse/services/rateLimitSemaphore.ts");
+
+const noop = () => {};
+const log = { info: noop, warn: noop, debug: noop, error: noop };
+const replayMessage = "The encrypted content could not be verified.";
+let comboIndex = 0;
+
+test.beforeEach(() => {
+  resetAllComboMetrics();
+  resetAllCircuitBreakers();
+  clearAllModelLockouts();
+  resetAllSemaphores();
+});
+
+test.after(() => {
+  resetAllComboMetrics();
+  resetAllCircuitBreakers();
+  clearAllModelLockouts();
+  resetAllSemaphores();
+  resetDbInstance();
+  fs.rmSync(testDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
+  if (originalDataDir === undefined) delete process.env.DATA_DIR;
+  else process.env.DATA_DIR = originalDataDir;
+});
+
+function failure(code?: string, message = replayMessage, status = 400) {
+  return new Response(JSON.stringify({ error: { message, code } }), {
+    status,
+    headers: { "Content-Type": "application/json" },
+  });
+}
+
+function runCombo(strategy: string, responses: Response[]) {
+  let attempts = 0;
+  const name = `terminal-code-${strategy}-${comboIndex++}`;
+  return handleComboChat({
+    body: { model: "test-combo", messages: [{ role: "user", content: "hi" }], stream: true },
+    combo: {
+      name,
+      strategy,
+      models: responses.map((_, index) => `${index === 0 ? "codex" : "openai"}/${name}-${index}`),
+      config: { maxRetries: 0 },
+    },
+    handleSingleModel: async () => {
+      assert.ok(attempts < responses.length, "must not retry a request-scoped failure");
+      return responses[attempts++];
+    },
+    isModelAvailable: async () => true,
+    log,
+    settings: {},
+    allCombos: [],
+  });
+}
+
+for (const strategy of ["priority", "round-robin"]) {
+  test(`${strategy}: terminal reasoning replay code reaches the Responses SSE error frame`, async () => {
+    let resolveResponse!: (response: Response) => void;
+    const pending = new Promise<Response>((resolve) => {
+      resolveResponse = resolve;
+    });
+    const stream = await withEarlyStreamKeepalive(pending, {
+      thresholdMs: 1,
+      intervalMs: 10,
+      errorFrame: OPENAI_RESPONSES_ERROR_FRAME,
+    });
+    resolveResponse(await runCombo(strategy, [failure("invalid_encrypted_content")]));
+    assert.equal(stream.status, 200);
+    const frames = [...(await stream.text()).matchAll(/^data: (.+)$/gm)];
+    const frame = JSON.parse(frames.at(-1)![1]);
+    assert.equal(frame.type, "error");
+    assert.equal(frame.code, "invalid_encrypted_content");
+    assert.match(frame.message, /encrypted content could not be verified/);
+    if (strategy === "priority") assert.equal(frame.diagnostics.attempted, 1);
+  });
+
+  test(`${strategy}: aggregation preserves the final target's code after fallback`, async () => {
+    const response = await runCombo(strategy, [
+      failure("bad_request", "Other request rejection"),
+      failure("invalid_encrypted_content"),
+    ]);
+    assert.equal(response.status, 400);
+    const body = await response.json();
+    assert.equal(body.error.code, "invalid_encrypted_content");
+    assert.match(body.error.message, /Other request rejection/);
+    assert.match(body.error.message, /encrypted content could not be verified/);
+  });
+
+  test(`${strategy}: a final uncoded error does not inherit an earlier target's code`, async () => {
+    const response = await runCombo(strategy, [failure("invalid_encrypted_content"), failure()]);
+    assert.equal(response.status, 400);
+    assert.equal((await response.json()).error.code, "bad_request");
+  });
+
+  test(`${strategy}: unrecognized upstream codes still pass through public sanitization`, async () => {
+    const response = await runCombo(strategy, [failure("private_account_identifier")]);
+    assert.equal((await response.json()).error.code, "bad_request");
+  });
+
+  test(`${strategy}: mixed auth and model failures keep the aggregate gateway verdict`, async () => {
+    const response = await runCombo(strategy, [
+      fai
```

---

### Incident Patch 12: `f802445e` (2026-10-02)
**Commit Message**: fix(proxy): switch selector on every set-aside kind, not quota only (#15140)

Validated in a local merge-train on tomni-proxmox-113 (static gates + changed tests + vitest green on the 31-PR combined tree; the FULL unit run on the same set showed only load-timing flakes, the base-red consoleInterceptor-writes, and one regression since fixed in #15087).
⚠️ base-red inherited: #15306

**File**: `changelog.d/fixes/15140-selector-switch-all-setaside-kinds.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- **fix(proxy):** Steer the local core selector off every set-aside pool member, whatever the refusal motive, instead of quota refusals only ([#15140](https://github.com/diegosouzapw/OmniRoute/pull/15140)) — thanks @maxmad64bis
```

**File**: `src/instrumentation-node.ts` (modified, +6/-0)
```diff
@@ -349,6 +349,12 @@ export async function registerNodejs(): Promise<void> {
   // Subscribe the proxy set-aside webhook bridge (side-effect import only).
   await import("@/lib/proxyEvents/proxyTransitionBridge");
 
+  // Steer the local core selector off every set-aside member, whatever the
+  // refusal kind (explicit idempotent registration; safe to call twice).
+  const { registerSelectorTransitionSubscriber } =
+    await import("@/lib/proxySubscription/proxyTransitionSubscriber");
+  registerSelectorTransitionSubscriber();
+
   // Register quota fetchers early so combo routing can use real quota-aware
   // scoring for generic providers in the App Router production runtime.
   await registerQuotaFetchers();
```

**File**: `src/lib/proxySubscription/proxyTransitionSubscriber.ts` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+/**
+ * Selector transition subscriber.
+ *
+ * Subscribes to proxy set-aside transitions from the refusal store and steers
+ * the local core selector off the set-aside member, whatever the refusal kind
+ * (quota, transport, slow, unreachable probe). Fire-and-forget: never throws,
+ * never blocks the notification path. All policy (flag, control cache,
+ * resolution, throttle, fetch-time guard) stays inside `maybeSwitchOnSetAside`,
+ * which owns the single throttle slot per (subscription, selector) — so the
+ * synchronous quota path and this listener collapse to one control call.
+ *
+ * Registered once at server boot (see instrumentation-node); importing this
+ * module has no side effect. No extra store: bounded by the trigger's own
+ * throttle map and the refusal memory bound.
+ */
+
+import { maybeSwitchOnSetAside } from "./selectorTrigger";
+import {
+  onProxyTransition,
+  type ProxyTransition,
+} from "@omniroute/open-sse/utils/proxyTransitionListeners.ts";
+
+function handleTransition(transition: ProxyTransition): void {
+  void maybeSwitchOnSetAside(transition.key, { kind: transition.kind }).catch((e) => {
+    console.warn(`[SelectorControl] trigger failed: ${e instanceof Error ? e.message : e}`);
+  });
+}
+
+let unsubscribe: (() => void) | null = null;
+
+/** Register the selector subscription. Idempotent; safe to call twice. */
+export function registerSelectorTransitionSubscriber(): void {
+  if (unsubscribe !== null) return;
+  unsubscribe = onProxyTransition(handleTransition);
+}
+
+/** Test-only: forget the subscription. */
+export function __resetSubscriberForTesting(): void {
+  unsubscribe?.();
+  unsubscribe = null;
+}
```

**File**: `src/lib/proxySubscription/selectorTrigger.ts` (modified, +6/-4)
```diff
@@ -38,6 +38,7 @@ import {
   isSelectorMemberAvoided,
   leastRecentlySetAside,
   noteProxyMemberRefusal,
+  type ProxyRefusalKind,
 } from "@omniroute/open-sse/utils/proxyRefusalMemory.ts";
 import { parseSelectorTag } from "./selectorEndpoint";
 import { getGroupMembers, switchSelector, type SelectorSwitchReason } from "./selectorClient";
@@ -352,7 +353,8 @@ function readSwitchSecret(secretEnc: string | null): string | null {
 async function runSwitch(
   hit: { controlUrl: string; selector: string; secretEnc: string | null; subscriptionId: string },
   setAsideKey: string,
-  now: number
+  now: number,
+  kind: ProxyRefusalKind
 ): Promise<SelectorTriggerResult> {
   const throttleKey = `${hit.subscriptionId} ${hit.selector}`;
   // Reserve the slot BEFORE the await: two concurrent triggers for the same
@@ -392,7 +394,7 @@ async function runSwitch(
   // key, so the repeat doubles from that key's own streak).
   const live = await currentSelectorChoice(hit.controlUrl, secret, hit.selector);
   const currentName = live?.current ?? null;
-  if (currentName) noteProxyMemberRefusal(setAsideKey, currentName, "ip_quota_429", now);
+  if (currentName) noteProxyMemberRefusal(setAsideKey, currentName, kind, now);
   const res = await switchSelector(
     {
       controlUrl: hit.controlUrl,
@@ -432,7 +434,7 @@ function restoreSlot(throttleKey: string, prev: number | undefined): void {
  */
 export async function maybeSwitchOnSetAside(
   setAsideKey: string,
-  opts?: { nowMs?: number }
+  opts?: { nowMs?: number; kind?: ProxyRefusalKind }
 ): Promise<SelectorTriggerResult> {
   try {
     if (!isProxySkipRecentlyFailedEnabled()) return { switched: false, reason: "flag-off" };
@@ -450,7 +452,7 @@ export async function maybeSwitchOnSetAside(
     if (isThrottled(hit, now)) {
       return { switched: false, reason: "throttled" };
     }
-    return runSwitch(hit, setAsideKey, now);
+    return runSwitch(hit, setAsideKey, now, opts?.kind ?? "ip_quota_429");
   } catch {
     return { switched: false, reason: "network-error" };
   }
```

**File**: `tests/unit/proxySubscription.selectorTransition.test.ts` (added, +257/-0)
```diff
@@ -0,0 +1,257 @@
+import test from "node:test";
+import assert from "node:assert/strict";
+import fs from "node:fs";
+import os from "node:os";
+import path from "node:path";
+import http from "node:http";
+
+// Selector switch on every set-aside kind: the synchronous 429 path and the
+// transition subscriber share one throttle slot per (subscription, selector),
+// so a 429 collapses to a single control call; transport and slow set-asides
+// each drive their own switch with their own refusal kind.
+
+const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-selector-trans-"));
+process.env.DATA_DIR = TEST_DATA_DIR;
+process.env.PROXY_SKIP_RECENTLY_FAILED = "true";
+process.env.PROXY_HEALTH_TCP_TIMEOUT_MS = "50";
+// Shrink only the quota curve so the member write below is kind-observable:
+// a switch recorded under "transport" avoids the member for 60 s, while the
+// hardcoded quota default would only avoid it for 1 s. Read at module load,
+// hence set before the dynamic imports.
+process.env.PROXY_QUOTA_429_BASE_MS = "1000";
+
+const core = await import("../../src/lib/db/core.ts");
+const proxyHealth = await import("../../src/lib/proxyHealth.ts");
+proxyHealth.__setProxyHealthTcpCheckForTesting(async () => true);
+const trigger = await import("../../src/lib/proxySubscription/selectorTrigger.ts");
+const mem = await import("../../open-sse/utils/proxyRefusalMemory.ts");
+const listeners = await import("../../open-sse/utils/proxyTransitionListeners.ts");
+const sub = await import("../../src/lib/proxySubscription/index.ts");
+
+function reset() {
+  core.resetDbInstance();
+  mem.__resetProxyRefusalMemoryForTesting();
+  listeners.__resetProxyTransitionListenersForTesting();
+  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
+  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
+  trigger.__resetSelectorTriggerForTesting();
+}
+
+function startFeedServer(): Promise<{ url: string; close: () => Promise<void> }> {
+  return new Promise((resolve) => {
+    const srv = http.createServer((_req, res) => {
+      res.writeHead(200, { "Content-Type": "text/plain" });
+      res.end(
+        "http://user:pass@203.0.113.9:8080\nss://YWVzLTI1Ni1nY206cGFzcw@203.0.113.9:8388#ss-node"
+      );
+    });
+    srv.listen(0, "127.0.0.1", () => {
+      const addr = srv.address();
+      if (!addr || typeof addr === "string") throw new Error("no addr");
+      resolve({
+        url: `http://127.0.0.1:${addr.port}/list`,
+        close: () => new Promise((r) => srv.close(() => r())),
+      });
+    });
+  });
+}
+
+function startFakeCore(opts: { initial?: string } = {}): Promise<{
+  base: string;
+  state: { current: string; puts: number };
+  close: () => Promise<void>;
+}> {
+  const state = { current: opts.initial ?? "node-1", puts: 0 };
+  return new Promise((resolve) => {
+    const srv = http.createServer((req, res) => {
+      const u = new URL(req.url ?? "/", "http://x");
+      if (req.method === "GET" && u.pathname === "/proxies") {
+        res.writeHead(200, { "Content-Type": "application/json" });
+        res.end(
+          JSON.stringify({
+            proxies: {
+              "group-a": {
+                name: "group-a",
+                type: "Selector",
+                now: state.current,
+                all: ["node-1", "node-2"],
+              },
+            },
+          })
+        );
+        return;
+      }
+      if (req.method === "PUT" && u.pathname === "/proxies/group-a") {
+        let body = "";
+        req.on("data", (c) => (body += c));
+        req.on("end", () => {
+          state.puts++;
+          state.current = (JSON.parse(body) as { name: string }).name;
+          res.writeHead(204);
+          res.end();
+        });
+        return;
+      }
+      res.writeHead(404);
+      res.end("{}");
+    });
+    srv.listen(0, "127.0.0.1", () => {
+      const addr = srv.address();
+      if (!addr || typeof addr === "string") throw new Error("no addr");
+      resolve({
+        base: `http://127.0.0.1:${addr.port}`,
+        state,
+        close: () => new Promise((r) => srv.close(() => r())),
+      });
+    });
+  });
+}
+
+const KEY_NODE1 = "socks5://@127.0.0.1:1080";
+
+async function seedSubscription(
+  controlUrl: string
+): Promise<{ id: string; feedClose: () => Promise<void> }> {
+  const feedSrv = await startFeedServer();
+  const created = await sub.createSubscription({
+    name: "sel-trans",
+    url: feedSrv.url,
+    enabled: false,
+    localCoreEndpoint: "socks5://127.0.0.1:1080 selector=group-a",
+    controlUrl,
+    controlSecret: "trans-secret",
+  });
+  await sub.syncSubscription(created.id);
+  return { id: created.id, feedClose: () => feedSrv.close() };
+}
+
+test("429 sync path and transition subscriber collapse to one control call", async () => {
+  reset();
+  const { registerSelectorTransitionSubscriber } =
+    await import("../../src/lib/proxySubscription/proxyTransitionSubscriber.ts");
+  
```

---

### Incident Patch 13: `f6905489` (2026-10-02)
**Commit Message**: fix(sse): skip model-only lockout for an isolated 5xx after the stream relayed output (#15186)

Validated in a local merge-train on tomni-proxmox-113 (static gates + changed tests + vitest green on the 31-PR combined tree; the FULL unit run on the same set showed only load-timing flakes, the base-red consoleInterceptor-writes, and one regression since fixed in #15087).
⚠️ base-red inherited: #15306

**File**: `changelog.d/fixes/15186-stream-output-model-lockout.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- **fix(sse):** an isolated 5xx after a stream already relayed output no longer records a model-only lockout that benched the model for every other client; three such failures in a row still lock it ([#15186](https://github.com/diegosouzapw/OmniRoute/pull/15186))
```

**File**: `config/quality/file-size-baseline.json` (modified, +5/-4)
```diff
@@ -409,7 +409,7 @@
     "_rebaseline_2026_09_24_14680_reconcile": "PR #14680 own growth, re-measured after merging release/v3.8.51 on 2026-09-24 (merge-batch; the PR's original entry conflicted with the tip's baseline): open-sse/utils/stream.ts 3262->3296. Only files this PR touches are adjusted; tip-level drift is handled in the wave's follow-up rebaseline.",
     "_rebaseline_2026_09_24_14558_reconcile": "PR #14558 own growth, re-measured after merging release/v3.8.51 on 2026-09-24 (merge-batch; the PR's original entry conflicted with the tip's baseline): open-sse/executors/opencode.ts 1318->1338. Only files this PR touches are adjusted; tip-level drift is handled in the wave's follow-up rebaseline.",
     "_rebaseline_2026_09_23_14116_codex_quota_header_leak": "PR #14465 (fix #14116, Codex quota-header leak to a foreign combo/pool account) own growth, re-measured after merging release/v3.8.51 on 2026-09-23 (merge-batch): src/sse/handlers/chat.ts 2560->2561 (+1: one forcedConnectionId field threaded into the dispatchChatWithAffinityEviction call args) and src/sse/handlers/chatHelpers.ts 1257->1258 (+1: one passthrough field into handleChatCore). Irreducible call-site plumbing; the predicate/strip logic lives in the non-frozen open-sse/handlers/chatCore/responseHeaders.ts. Covered by tests/unit/codex-quota-header-leak-14116.test.ts. Structural shrink tracked in #3501.",
-    "src/sse/handlers/chatHelpers.ts": 1285,
+    "src/sse/handlers/chatHelpers.ts": 1286,
     "_rebaseline_2026_09_17_13720_merge_release_v3851": "Merge de release/v3.8.51 na #13720 (2026-09-17). src/sse/handlers/chatHelpers.ts 1246 -> 1253, decomposto: 1246 -> 1250 e crescimento INHERITED do tip (base-red ja presente em origin/release/v3.8.51 no commit 9688032451fc, arquivo com 1250 linhas contra cap 1246 — nao e desta PR e nao foi introduzido por este merge); 1250 -> 1253 sao as MESMAS +3 linhas da propria #13720 ja auditadas e aprovadas pelo dono na entrada _rebaseline_2026_09_16_13720_suffix_effort_propagation abaixo (threading de resolvedThinkingEffort). Nenhum outro teto foi tocado por este merge; tests/unit/chatcore-translation-paths.test.ts (3449 > 3447) permanece vermelho de proposito — e base-red herdado e a PR nao toca o arquivo.",
     "_rebaseline_2026_09_16_13720_suffix_effort_propagation": "OWNER-APPROVED 2026-09-16 (explicit exception for this unit only, chatHelpers.ts only). PR #13720 (HouMinXi, suffix-effort propagation across model attempts): src/sse/handlers/chatHelpers.ts merge-base (before PR's own commit) was 1164; the release tip independently grew it to 1213 (+49, unrelated merged PRs) while the frozen cap sat at 1214 to cover exactly that tip growth. The PR's own diff on this file is +3 lines only (threading resolvedThinkingEffort: one field on resolveModelOrError's return object, one destructured param and one passthrough call-site argument in executeChatWithBreaker — see commit 4fdb0c5851b7f645efbe5627cd0babb0c3d230c3), taking the merged result to 1216 (1217 per check-file-size.mjs's countLines, which counts the trailing newline as an extra split segment). All 3 added lines are single-property additions inside existing multi-line object literals/signatures; there is no redundant or duplicated line in the PR's own hunks to trim, and none of the +3 lines are outside the PR's own diff. Covered by tests/unit/suffix-effort-propagation.test.ts (27/27), tests/unit/chatcore-upstream-body.test.ts + tests/unit/request-dedup-tenant-isolation.test.ts (57/57), all green against this exact head.",
     "_rebaseline_2026_09_17_13947_tip_growth": "Base-red drain da PR #13947 (Refs #13866) — crescimento de PRODUCAO que chegou pelo tip e nunca foi rebaselinado; nenhum destes arquivos e tocado por esta PR. #12906 (d70f43d4, retry empty_response 502 + timeout de inicio de resposta ciente de reasoning): src/sse/handlers/chat.ts 2498->2500, src/sse/handlers/chatHelpers.ts 1231->1245, open-sse/utils/proxyFetch.ts 1275->1276, open-sse/utils/stream.ts 3098->3123. #12904 (f3acf4f8, injecao unica do system prompt global pos-traducao) + #12910 (051576fd, finalizacao de cache semantico por request id exato): open-sse/handlers/chatCore.ts 6181->6203. Anteriores ao lote, ja acima do cap na base 3d5baf13: open-sse/handlers/imageGeneration.ts 3293->3304 (#13748, b97338a8) e open-sse/services/combo/roundRobinCombo.ts 1213->1221 (#13776, aeba6b1a). Registrado contra o estado mergeado; nenhum outro cap e tocado.",
@@ -522,7 +522,7 @@
     "open-sse/executors/codex.ts": 1584,
     "open-sse/executors/cursor.ts": 1868,
     "open-sse/executors/muse-spark-web.ts": 1405,
-    "open-sse/handlers/chatCore.ts": 6441,
+    "open-sse/handlers/chatCore.ts": 6444,
     "open-sse/handlers/imageGeneration.ts": 3334,
     "open-sse/handlers/search.ts": 1789,
     "open-sse/mcp-server/schemas/tools.ts": 1621,
@@ -534,7 +534,7 @@
     "open-sse/translator/response/openai-responses.ts": 1536,
     "open-sse/utils/cursorAgentProtobuf.ts": 1622,
     "open-sse/ut
```

**File**: `open-sse/handlers/chatCore.ts` (modified, +4/-1)
```diff
@@ -159,7 +159,7 @@ import {
   COLORS,
 } from "../utils/stream.ts";
 import { ensureStreamReadiness } from "../utils/streamReadiness.ts";
-import { requestTtftMs } from "../utils/streamTiming.ts";
+import { requestTtftMs, streamEmittedOutput } from "../utils/streamTiming.ts";
 import { resolveSuppressThinkClose, THINKING_MARKER_HEADER } from "../utils/thinkCloseMarker.ts";
 import { resolveStreamReadinessTimeout } from "../utils/streamReadinessPolicy.ts";
 import { resolveAgentGoalPolicy } from "../utils/agentGoalPolicy.ts";
@@ -388,6 +388,7 @@ import {
   recordCoreOwnedAntigravityQuotaState,
   shouldDeferAntigravityQuotaStateToCaller,
 } from "../services/accountFallback.ts";
+import { clearPostOutputFailureStreak } from "../services/accountFallback/postOutputFailureStreak.ts";
 import { saveIdempotency } from "@/lib/idempotencyLayer";
 import {
   isModelUnavailableError,
@@ -6046,6 +6047,7 @@ async function handleChatCoreInner({
     const streamConnectionId = getCurrentConnectionId();
 
     if (normalizedStreamStatus === 200) {
+      clearPostOutputFailureStreak(provider, streamConnectionId, modelInfo.model);
       void maybeSyncClaudeExtraUsageState({
         provider,
         connectionId: streamConnectionId,
@@ -6271,6 +6273,7 @@ async function handleChatCoreInner({
     onStreamComplete,
     persistFailureUsage,
     onStreamFailure,
+    hasEmittedOutput: () => streamEmittedOutput(transformStream),
   });
   const handleStreamFailure = streamFailureFinalizers.handleStreamFailure;
   onPipelineStreamError = streamFailureFinalizers.onPipelineStreamError;
```

**File**: `open-sse/services/accountFallback/postOutputFailureStreak.ts` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+/**
+ * accountFallback/postOutputFailureStreak.ts — when a 5xx AFTER the stream already
+ * relayed output should still lock the model.
+ *
+ * One such failure is per-request: the client response is committed, so a model-only
+ * lockout cannot help that request and only benches the model for every other client.
+ * A model that fails EVERY stream mid-way is broken, though, and must still be locked so
+ * the next requests fail over instead of receiving cut-off answers. So these failures
+ * are counted per provider/connection/model, a completed stream resets the count, and
+ * the lock is recorded only when POST_OUTPUT_FAILURE_STREAK_LOCK of them arrive in a row.
+ */
+
+export const POST_OUTPUT_FAILURE_STREAK_LOCK = 3;
+/** A streak whose last failure is older than this starts over. */
+export const POST_OUTPUT_FAILURE_STREAK_WINDOW_MS = 10 * 60_000;
+
+const streaks = new Map<string, { count: number; lastAt: number }>();
+
+function streakKey(provider: string, connectionId: string, model: string): string {
+  return `${provider}\u0000${connectionId}\u0000${model}`;
+}
+
+/**
+ * Record one post-output 5xx. True when it completes a streak that should lock the model
+ * (the streak then restarts, so the lockout's own backoff takes over).
+ */
+export function postOutputFailureReachesLockout(
+  provider: string,
+  connectionId: string,
+  model: string,
+  now = Date.now()
+): boolean {
+  const key = streakKey(provider, connectionId, model);
+  const prev = streaks.get(key);
+  const count =
+    prev && now - prev.lastAt <= POST_OUTPUT_FAILURE_STREAK_WINDOW_MS ? prev.count + 1 : 1;
+  if (count >= POST_OUTPUT_FAILURE_STREAK_LOCK) {
+    streaks.delete(key);
+    return true;
+  }
+  streaks.set(key, { count, lastAt: now });
+  return false;
+}
+
+/** A stream on this provider/connection/model completed successfully. */
+export function clearPostOutputFailureStreak(
+  provider: string | null | undefined,
+  connectionId: string | null | undefined,
+  model: string | null | undefined
+): void {
+  if (!provider || !connectionId || !model || streaks.size === 0) return;
+  streaks.delete(streakKey(provider, connectionId, model));
+}
+
+/** Test helper. */
+export function resetPostOutputFailureStreaks(): void {
+  streaks.clear();
+}
```

**File**: `open-sse/utils/stream.ts` (modified, +3/-2)
```diff
@@ -87,7 +87,7 @@ import {
 import { restoreClaudeToolName } from "../services/claudeCodeToolRemapper.ts";
 import { normalizeFinalOpenAIStreamChunk } from "./openAIStreamChunk.ts";
 import { collectClaudeDelta } from "./streamClaudeDelta.ts";
-import { createStreamTiming, type StreamTiming } from "./streamTiming.ts";
+import { createStreamTiming, registerStreamTiming, type StreamTiming } from "./streamTiming.ts";
 import { buildUsageOnlyChunk } from "./usageOnlyChunk.ts";
 
 /**
@@ -1356,7 +1356,7 @@ export function createSSEStream(options: StreamOptions = {}) {
     return true;
   };
 
-  return new TransformStream(
+  const sseStream = new TransformStream(
     {
       start(controller) {
         // Start idle watchdog — checks every 10s if provider has stopped sending
@@ -3218,6 +3218,7 @@ export function createSSEStream(options: StreamOptions = {}) {
     { highWaterMark: streamBufferBytes },
     { highWaterMark: streamBufferBytes }
   );
+  return registerStreamTiming(sseStream, timing);
 }
 
 export default createSSEStream;
```

**File**: `open-sse/utils/streamFailureFinalization.ts` (modified, +5/-1)
```diff
@@ -23,6 +23,8 @@ export type StreamFailurePayload = {
   message: string;
   code?: string;
   type?: string;
+  /** The stream had already forwarded text/reasoning/tool output to the client. */
+  outputEmitted?: boolean;
 };
 
 export type PipelineStreamErrorHandler = (event: {
@@ -150,12 +152,14 @@ export function createStreamFailureFinalizers({
   onStreamComplete,
   persistFailureUsage,
   onStreamFailure,
+  hasEmittedOutput = () => false,
 }: {
   isFailureCompletionRecorded: () => boolean;
   isStreamCompletionRecorded?: () => boolean;
   onStreamComplete: (payload: StreamCompletionPayload) => void;
   persistFailureUsage: (status: number, errorCode?: string) => void;
   onStreamFailure?: ((failure: StreamFailurePayload) => void) | null;
+  hasEmittedOutput?: () => boolean;
 }) {
   const handleStreamFailure = (failure: StreamFailurePayload) => {
     if (isStreamCompletionRecorded()) {
@@ -184,7 +188,7 @@ export function createStreamFailureFinalizers({
 
     persistFailureUsage(status, projectedCode);
     try {
-      onStreamFailure?.(failure);
+      onStreamFailure?.({ ...failure, outputEmitted: hasEmittedOutput() });
     } catch {
       // Best-effort fallback state update only.
     }
```

**File**: `open-sse/utils/streamTiming.ts` (modified, +19/-0)
```diff
@@ -100,6 +100,25 @@ export function requestTtftMs(
     : undefined;
 }
 
+const timingByStream = new WeakMap<object, StreamTiming>();
+
+/** Associate a stream with its timing so callers outside the transform can read it. */
+export function registerStreamTiming<T extends object>(stream: T, timing: StreamTiming): T {
+  timingByStream.set(stream, timing);
+  return stream;
+}
+
+/**
+ * True once the stream forwarded a chunk carrying text, reasoning or a tool call to the
+ * client. A failure after that point cannot be retried on another target. Only the first
+ * MAX_OUTPUT_PROBES forwarded chunks are probed, so a stream whose output starts later reads
+ * false here — the conservative answer (callers keep their pre-output behavior).
+ */
+export function streamEmittedOutput(stream: object | null | undefined): boolean {
+  if (!stream) return false;
+  return (timingByStream.get(stream)?.firstOutputAt ?? null) !== null;
+}
+
 export function createStreamTiming(): StreamTiming {
   const outputDecoder = new TextDecoder();
   let outputProbes = 0;
```

**File**: `src/sse/handlers/chatHelpers.ts` (modified, +2/-1)
```diff
@@ -588,14 +588,15 @@ export async function executeChatWithBreaker({
                 );
                 return;
               }
+              const streamOutputEmitted = failure?.outputEmitted === true;
               await markAccountUnavailable(
                 credentials.connectionId,
                 Number(failure?.status || HTTP_STATUS.BAD_GATEWAY),
                 String(failure?.message || failure?.code || "stream failure"),
                 provider,
                 model,
                 providerProfile,
-                buildExhaustionOptions(correlationId ?? null, { isCombo })
+                buildExhaustionOptions(correlationId ?? null, { isCombo, streamOutputEmitted })
               );
             },
           })
```

---

### Incident Patch 14: `77f2ac75` (2026-10-02)
**Commit Message**: fix(combo): wait out a short transient lockout on a pinned native Codex turn (#15168)

Validated in a local merge-train on tomni-proxmox-113 (static gates + changed tests + vitest green on the 31-PR combined tree; the FULL unit run on the same set showed only load-timing flakes, the base-red consoleInterceptor-writes, and one regression since fixed in #15087).
⚠️ base-red inherited: #15306

**File**: `changelog.d/fixes/15168-codex-pin-short-lockout.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- **fix(combo):** a native Codex turn pinned to a model is no longer terminated with `400 NATIVE_CODEX_PINNED_MODEL_UNAVAILABLE` when the model only has a short transient lockout (e.g. a 5s `server_error` set by another client); the router waits it out and continues on the pinned model ([#15168](https://github.com/diegosouzapw/OmniRoute/pull/15168))
```

**File**: `open-sse/services/combo.ts` (modified, +32/-4)
```diff
@@ -5,7 +5,7 @@
  * context-optimized, context-relay, and fusion strategies
  */
 
-import { errorResponseWithComboDiagnostics } from "../utils/error.ts";
+import { errorResponse, errorResponseWithComboDiagnostics } from "../utils/error.ts";
 
 import { recordComboFailure } from "./combo/failureTracker.ts";
 import { buildRecoveryHint } from "./combo/pinRecovery.ts";
@@ -93,8 +93,11 @@ import {
   canAutoResumeNativeCodexTurn,
   createPinnedModelUnavailableResponse,
   getNativeCodexTurnPin,
+  describePinnedTargetsLock,
   releaseNativeCodexTurnPin,
+  resolvePinnedTargetsLockWaitMs,
 } from "./combo/nativeCodexTurnPin.ts";
+import { waitForCooldownAwareRetry } from "../../src/sse/services/cooldownAwareRetry.ts";
 import {
   pinIsDurablyUnhealthy,
   tryFusionDispatch,
@@ -175,6 +178,9 @@ export {
   validateComboDAG,
 } from "./combo/comboStructure.ts";
 
+// The lock check is `until > now`; waking exactly at `until` can still read locked.
+const PINNED_LOCK_WAIT_SLACK_MS = 50;
+
 /**
  * #6692: release a session-stickiness pin the moment its bound connection is
  * the one that just failed. applySessionStickiness() only re-checks health on
@@ -858,6 +864,7 @@ async function handleComboChatInner({
   let orderedTargets = targetResolution.orderedTargets;
   const quotaCutoffResetWindowConfig = resolveResetWindowConfig(config as Record<string, unknown>);
 
+  let pinnedLockWaitMs = 0;
   if (activeNativeTurnPin) {
     const pinnedTargets = applyNativeCodexTurnPin(orderedTargets, activeNativeTurnPin);
     if (pinnedTargets.length === 0) {
@@ -917,7 +924,7 @@ async function handleComboChatInner({
           targetResolution.quotaShareRelease?.();
           log.warn(
             "COMBO",
-            `Native Codex turn cannot continue: pinned model ${activeNativeTurnPin.modelStr} is unavailable (model-scoped); auto-resume rejected (${autoResumeEligibility.reason}); preserving turn pin and terminating turn`
+            `Native Codex turn cannot continue: pinned model ${activeNativeTurnPin.modelStr} is unavailable (model-scoped); auto-resume rejected (${autoResumeEligibility.reason}); model lock: ${describePinnedTargetsLock(pinnedTargets)}; preserving turn pin and terminating turn`
           );
           return createPinnedModelUnavailableResponse();
         } else {
@@ -939,6 +946,21 @@ async function handleComboChatInner({
           "COMBO",
           `Native Codex turn pinned to ${activeNativeTurnPin.modelStr} on connection ${activeNativeTurnPin.connectionId.slice(0, 8)}`
         );
+        pinnedLockWaitMs = resolvePinnedTargetsLockWaitMs(pinnedTargets, resilienceSettings);
+        if (pinnedLockWaitMs > 0) {
+          log.info(
+            "COMBO",
+            `Native Codex turn pin: ${activeNativeTurnPin.modelStr} has a short transient lockout — waiting ${Math.ceil(pinnedLockWaitMs / 1000)}s before dispatch instead of terminating the turn`
+          );
+          const completed = await waitForCooldownAwareRetry(
+            pinnedLockWaitMs + PINNED_LOCK_WAIT_SLACK_MS,
+            signal
+          );
+          if (!completed) {
+            targetResolution.quotaShareRelease?.();
+            return errorResponse(499, "Request aborted");
+          }
+        }
       }
     }
   }
@@ -992,8 +1014,14 @@ async function handleComboChatInner({
     strategy,
     resilienceSettings.comboCooldownWait
   );
-  const comboCooldownAttempt = { current: 0 };
-  const comboCooldownBudgetLeftMs = { current: resilienceSettings.comboCooldownWait.budgetMs };
+  const comboCooldownAttempt = { current: pinnedLockWaitMs > 0 ? 1 : 0 };
+  const comboCooldownBudgetLeftMs = {
+    current: Math.max(
+      0,
+      resilienceSettings.comboCooldownWait.budgetMs -
+        (pinnedLockWaitMs > 0 ? pinnedLockWaitMs + PINNED_LOCK_WAIT_SLACK_MS : 0)
+    ),
+  };
   const comboTimeoutMs = config.comboTimeoutMs || 0;
   const comboStartTime = Date.now();
 
```

**File**: `open-sse/services/combo/nativeCodexTurnPin.ts` (modified, +122/-3)
```diff
@@ -1,6 +1,7 @@
 import { createHash } from "node:crypto";
 import { buildErrorBody } from "../../utils/error.ts";
-import { isModelLocked, hasPerModelQuota } from "../accountFallback.ts";
+import { isModelLocked, hasPerModelQuota, getModelLockoutInfo } from "../accountFallback.ts";
+import { shouldWaitForComboCooldown } from "./comboCooldownRetry.ts";
 import { isProviderInCooldown } from "../providerCooldownTracker.ts";
 import { getCircuitBreaker } from "../../../src/shared/utils/circuitBreaker.ts";
 import type { ResilienceSettings } from "../../../src/lib/resilience/settings";
@@ -252,6 +253,114 @@ export interface CheckPinnedTargetsModelScopedUnusableOptions {
   isModelAvailable?: IsModelAvailable;
 }
 
+/**
+ * Remaining time (ms) of a model lock on this target that is short and transient
+ * enough to wait out — same predicate as the combo cooldown-wait (a retryable
+ * reason such as server_error/rate_limit, within maxWaitMs). 0 when the target
+ * is not locked, the lock is not waitable, or cooldown-wait is disabled.
+ */
+function waitableTransientModelLockMs(
+  provider: string,
+  connectionId: string,
+  rawModel: string,
+  resilienceSettings?: ResilienceSettings | null
+): number {
+  const waitSettings = resilienceSettings?.comboCooldownWait;
+  if (!waitSettings?.enabled) return 0;
+  const info = getModelLockoutInfo(provider, connectionId, rawModel);
+  if (!info) return 0;
+  const decision = shouldWaitForComboCooldown({
+    reason: info.reason,
+    waitMs: info.remainingMs,
+    attempt: 0,
+    budgetLeftMs: waitSettings.budgetMs,
+    settings: waitSettings,
+  });
+  return decision.wait ? decision.waitMs : 0;
+}
+
+function isWaitableTransientModelLock(
+  provider: string,
+  connectionId: string,
+  rawModel: string,
+  resilienceSettings?: ResilienceSettings | null
+): boolean {
+  return waitableTransientModelLockMs(provider, connectionId, rawModel, resilienceSettings) > 0;
+}
+
+/**
+ * Log fragment naming the model lock on each pinned target ("server_error 4s
+ * failureCount=1" / "none"), so a terminated turn tells WHY the pinned model was
+ * judged unusable: a lock too long or of a non-waitable reason, or no lock at all
+ * (quota cutoff, availability check).
+ */
+export function describePinnedTargetsLock(pinnedTargets: ResolvedComboTarget[]): string {
+  return pinnedTargets
+    .map((target) => {
+      const rawModel = parseModel(target.modelStr).model || target.modelStr;
+      const info = target.provider
+        ? getModelLockoutInfo(target.provider, target.connectionId || "", rawModel)
+        : null;
+      const conn = (target.connectionId || "any").slice(0, 8);
+      if (!info || info.remainingMs <= 0) return `${conn}: none`;
+      return `${conn}: ${info.reason} ${Math.ceil(info.remainingMs / 1000)}s failureCount=${info.failureCount}`;
+    })
+    .join(", ");
+}
+
+/**
+ * How long to wait before dispatching the pinned targets: 0 when any pinned
+ * target is dispatchable now (or none is waitable), otherwise the shortest
+ * remaining waitable lock. The pre-dispatch gate skips locked targets without
+ * recording a retry-after, so the attempt loop's own cooldown-wait never engages
+ * for them — the pinned path has to wait before handing them to the loop.
+ */
+export function resolvePinnedTargetsLockWaitMs(
+  pinnedTargets: ResolvedComboTarget[],
+  resilienceSettings?: ResilienceSettings | null
+): number {
+  let shortest = 0;
+  for (const target of pinnedTargets) {
+    const provider = target.provider;
+    const connectionId = target.connectionId || "";
+    const rawModel = parseModel(target.modelStr).model || target.modelStr;
+    if (!provider || !rawModel || !isModelLocked(provider, connectionId, rawModel)) return 0;
+    const waitMs = waitableTransientModelLockMs(
+      provider,
+      connectionId,
+      rawModel,
+      resilienceSettings
+    );
+    if (waitMs > 0 && (shortest === 0 || waitMs < shortest)) shortest = waitMs;
+  }
+  return shortest;
+}
+
+/**
+ * Whether the target's model is locked, and whether that lock is one the pinned
+ * path may wait out. A short transient lock (e.g. a 5s server_error set by ANOTHER
+ * client's failed request) is waited out before dispatch
+ * (resolvePinnedTargetsLockWaitMs), so it must not terminate the turn or force an
+ * auto-resume onto another model.
+ */
+function evaluatePinnedModelLock(
+  target: ResolvedComboTarget,
+  resilienceSettings: ResilienceSettings | null | undefined,
+  allowWaitableLock = false
+): { modelLocked: boolean; lockWaitable: boolean } {
+  const provider = target.provider;
+  const connectionId = target.connectionId || "";
+  const rawModel = parseModel(target.modelStr).model || target.modelStr;
+  const modelLocked = Boolean(
+    provider && rawModel && isModelLocked(provider, connectionId, rawModel)
+  );
+  const lockWaitable =
+    allowWaitableLock &&
+    modelLocked &&
+    isWaitableTransientModelLock(provider, connectionId, rawModel, resilienceSet
```

**File**: `stryker.conf.json` (modified, +1/-0)
```diff
@@ -343,6 +343,7 @@
       "tests/unit/model-lockout-max-cooldown.test.ts",
       "tests/unit/native-codex-turn-pin-10379.test.ts",
       "tests/unit/native-codex-turn-pin-model-scoped-fallback.test.ts",
+      "tests/unit/native-codex-turn-pin-short-lockout.test.ts",
       "tests/unit/no-memory-header.test.ts",
       "tests/unit/noauth-autocombo-lockout-7623.test.ts",
       "tests/unit/noauth-model-lockout.test.ts",
```

**File**: `tests/unit/native-codex-turn-pin-short-lockout.test.ts` (added, +384/-0)
```diff
@@ -0,0 +1,384 @@
+import test, { describe, beforeEach } from "node:test";
+import assert from "node:assert/strict";
+import fs from "node:fs";
+import os from "node:os";
+import path from "node:path";
+
+// Prod 2026-09-30: another client's request hit an upstream "Internal error during
+// token generation" on grok-cli/grok-4.6, which set a 5s `server_error` model-only
+// lockout. A native Codex turn pinned to that model arrived 1.4s later and was
+// terminated with 400 NATIVE_CODEX_PINNED_MODEL_UNAVAILABLE, although the combo
+// cooldown-wait could have waited the 5s out on the pinned model itself.
+
+const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-pin-short-lock-"));
+const ORIGINAL_DATA_DIR = process.env.DATA_DIR;
+process.env.DATA_DIR = TEST_DATA_DIR;
+
+const { handleComboChat } = await import("../../open-sse/services/combo.ts");
+const { lockExactModel, clearAllModelLockouts, isModelLocked } =
+  await import("../../open-sse/services/accountFallback.ts");
+const { clearNativeCodexTurnPinsForTests, NATIVE_CODEX_PINNED_MODEL_UNAVAILABLE_CODE } =
+  await import("../../open-sse/services/combo/nativeCodexTurnPin.ts");
+const { clearCooldownState } = await import("../../open-sse/services/providerCooldownTracker.ts");
+const { resetAllCircuitBreakers } = await import("../../src/shared/utils/circuitBreaker.ts");
+const core = await import("../../src/lib/db/core.ts");
+const providersDb = await import("../../src/lib/db/providers.ts");
+
+function settingsWithCooldownWait(enabled: boolean) {
+  return {
+    resilienceSettings: {
+      providerCooldown: { enabled: true, minRetryCooldownMs: 5000, maxRetryCooldownMs: 300000 },
+      comboCooldownWait: { enabled, maxWaitMs: 3000, maxAttempts: 2, budgetMs: 6000 },
+    },
+  };
+}
+
+function createLog(entries: Array<{ level: string; tag: string; msg: string }> = []) {
+  return {
+    info: (tag: string, msg: string) => entries.push({ level: "info", tag, msg }),
+    warn: (tag: string, msg: string) => entries.push({ level: "warn", tag, msg }),
+    error: (tag: string, msg: string) => entries.push({ level: "error", tag, msg }),
+    debug: (tag: string, msg: string) => entries.push({ level: "debug", tag, msg }),
+    entries,
+  };
+}
+
+test.after(async () => {
+  for (let attempt = 0; attempt < 5; attempt += 1) {
+    try {
+      core.resetDbInstance();
+      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
+      break;
+    } catch {
+      await new Promise((resolve) => setTimeout(resolve, 25));
+    }
+  }
+  process.env.DATA_DIR = ORIGINAL_DATA_DIR;
+});
+
+beforeEach(() => {
+  clearAllModelLockouts();
+  clearCooldownState();
+  resetAllCircuitBreakers();
+  clearNativeCodexTurnPinsForTests();
+});
+
+describe("Native Codex turn pin — short transient model lockout", () => {
+  const grokModel = "grok-cli/grok-4.6";
+  const cursorModel = "cursor/cursor-grok-4.6-medium";
+  const combo = {
+    name: "sc-model-coding",
+    strategy: "priority" as const,
+    models: [grokModel, cursorModel],
+    config: { maxRetries: 0, concurrencyPerModel: 1, queueTimeoutMs: 1000 },
+  };
+  const turnMetadata = JSON.stringify({ thread_id: "thread-short-lock", turn_id: "turn-1" });
+
+  // Mid-turn follow-up that carries provider continuation state, so auto-resume
+  // onto another model is (correctly) rejected as unsafe_provider_state.
+  const midTurnBody = {
+    stream: false,
+    previous_response_id: "resp_grok_pinned_upstream",
+    client_metadata: { "x-codex-turn-metadata": turnMetadata },
+    input: [
+      { type: "message", role: "user", content: "fix the bug" },
+      { type: "function_call", call_id: "c1", name: "shell", arguments: "{}" },
+      { type: "function_call_output", call_id: "c1", output: "ok" },
+    ],
+  };
+
+  async function pinTurnToGrok(connectionId: string, settings: object) {
+    const res = await handleComboChat({
+      body: {
+        stream: false,
+        client_metadata: { "x-codex-turn-metadata": turnMetadata },
+        input: [{ type: "message", role: "user", content: "fix the bug" }],
+      },
+      combo,
+      clientManagedResponsesContext: true,
+      handleSingleModel: async () =>
+        new Response(JSON.stringify({ choices: [{ message: { content: "grok" } }] }), {
+          status: 200,
+          headers: { "x-omniroute-selected-connection-id": connectionId },
+        }),
+      isModelAvailable: async () => true,
+      log: createLog(),
+      settings,
+      allCombos: null,
+    });
+    assert.equal(res.status, 200);
+  }
+
+  // Lock only the pinned connection, like the real lockout path does.
+  function lockGrok(connectionId: string, reason: string, ms: number) {
+    lockExactModel("grok-cli", connectionId, "grok-4.6", reason, ms);
+  }
+
+  test("short server_error lockout keeps the turn on the pinned model instead of 400", async () => {
+    const settings = settingsWithCooldownWait(true);
+    const conn = await providersDb.createProviderConnecti
```

---

### Incident Patch 15: `fea6dad9` (2026-10-02)
**Commit Message**: fix(cursor): keep tool results within Cursor's limits so the model stops re-reading (#15117)

Validated in a local merge-train on tomni-proxmox-113 (static gates + changed tests + vitest green on the 31-PR combined tree; the FULL unit run on the same set showed only load-timing flakes, the base-red consoleInterceptor-writes, and one regression since fixed in #15087).
⚠️ base-red inherited: #15306

**File**: `changelog.d/fixes/15117-cursor-read-range-applied.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- **fix(cursor):** large tool results no longer reach the model cut or empty — MCP text is fitted under Cursor's 40000-byte inline limit and held reads under its 100000-character limit, on a line boundary with a note naming where to continue; held reads set `range_applied` and a `total_lines` that covers the lines before the slice, so ranged reads stop failing with "Offset N is beyond file length" ([#15117](https://github.com/diegosouzapw/OmniRoute/pull/15117)).
```

**File**: `open-sse/executors/cursor.ts` (modified, +10/-0)
```diff
@@ -290,6 +290,8 @@ export type StreamCtx = {
       workingDir: string;
       fileText: string;
       returnFileContentAfterWrite?: boolean;
+      /** The offset/limit of a held read that was forwarded to the client. */
+      readRange?: { offset?: number; limit?: number };
       pattern: string;
       outputMode?: string;
       url?: string;
@@ -780,6 +782,14 @@ export function processFrame(
             command: "command" in event ? event.command : "",
             workingDir: "workingDir" in event ? event.workingDir : "",
             fileText: "fileText" in event ? event.fileText : "",
+            readRange:
+              event.kind === "exec_read" &&
+              ("offset" in bridge.arguments || "limit" in bridge.arguments)
+                ? {
+                    offset: "offset" in bridge.arguments ? event.offset : undefined,
+                    limit: "limit" in bridge.arguments ? event.limit : undefined,
+                  }
+                : undefined,
             returnFileContentAfterWrite:
               event.kind === "exec_write" ? event.returnFileContentAfterWrite : undefined,
             pattern: "pattern" in event ? event.pattern : "",
```

**File**: `open-sse/services/cursorSessionManager.ts` (modified, +4/-1)
```diff
@@ -94,6 +94,8 @@ export type CursorSession = {
       /** Exact text Cursor asked to write, echoed back in WriteSuccess. */
       fileText: string;
       returnFileContentAfterWrite?: boolean;
+      /** The offset/limit of a held read that was forwarded to the client. */
+      readRange?: { offset?: number; limit?: number };
       /** Pattern Cursor searched for, echoed back in GrepSuccess. */
       pattern: string;
       outputMode?: string;
@@ -248,7 +250,8 @@ export class CursorSessionManager {
                             builtin.execMsgId,
                             builtin.execId,
                             builtin.path,
-                            text
+                            text,
+                            builtin.readRange
                           )
                       : builtin.kind === "write"
                         ? writeFailed
```

**File**: `open-sse/utils/cursorAgentProtobuf/execResults.ts` (modified, +56/-4)
```diff
@@ -1,3 +1,8 @@
+import {
+  CURSOR_MCP_TEXT_MAX_BYTES,
+  CURSOR_READ_CONTENT_MAX_BYTES,
+  fitCursorToolOutput,
+} from "./toolOutputLimit.ts";
 import { encodeBoolField, encodeMessage, encodeString, encodeUInt32Field } from "./wire.ts";
 
 export const ECM_MINI_SWE_BASH_RESULT = 55; // ExecClientMessage.mini_swe_agent_bash_result
@@ -48,6 +53,8 @@ const READ_SUCCESS_PATH = 1; // ReadSuccess.path
 const READ_SUCCESS_CONTENT = 2; // ReadSuccess.content
 const READ_SUCCESS_TOTAL_LINES = 3; // ReadSuccess.total_lines
 const READ_SUCCESS_FILE_SIZE = 4; // ReadSuccess.file_size
+const READ_SUCCESS_TRUNCATED = 6; // ReadSuccess.truncated
+const READ_SUCCESS_RANGE_APPLIED = 8; // ReadSuccess.range_applied
 const SHELL_STREAM_STDOUT = 1; // ShellStream.stdout
 const SHELL_STREAM_EXIT = 3; // ShellStream.exit
 const SHELL_STREAM_START = 4; // ShellStream.start
@@ -266,6 +273,42 @@ export function encodeExecWriteShellStdinError(
   return wrapExecClientMessage(execMsgId, execId, ECM_WRITE_SHELL_STDIN_RESULT, errorVariant);
 }
 
+// Clients cap a read without a limit at this many lines (OpenCode; Claude Code
+// when the file is over its size budget), so a result of exactly this size may
+// have been cut.
+const CLIENT_DEFAULT_READ_LINES = 2000;
+// Claude Code, when the offset is past the end of the file.
+const CLIENT_STATED_FILE_LENGTH = /\bThe file has (\d+) lines\b/;
+
+/**
+ * Cursor renders a read against total_lines ("... N lines not shown ..."
+ * before and after the slice) and rejects an offset past it. Its own host
+ * knows the file length; we only see the lines the client returned. So use a
+ * length the client states, mark the end of the file when the client returned
+ * fewer lines than asked for, and otherwise say the file may continue, rather
+ * than let total_lines claim it ends after a full window.
+ */
+function shapeHeldRead(
+  content: string,
+  range?: { offset?: number; limit?: number }
+): { content: string; totalLines: number } {
+  const lines = content ? content.split("\n").length : 0;
+  const stated = CLIENT_STATED_FILE_LENGTH.exec(content)?.[1];
+  if (stated !== undefined) return { content, totalLines: Number(stated) };
+  const first = range?.offset !== undefined && range.offset > 1 ? range.offset : 1;
+  const last = first - 1 + lines;
+  const mayContinue =
+    range?.limit !== undefined ? lines >= range.limit : lines === CLIENT_DEFAULT_READ_LINES;
+  if (!mayContinue) return { content, totalLines: last };
+  return {
+    content:
+      `${content}\n\n[The client returned lines ${first}-${last} and did not report the file ` +
+      `length, so the file may continue after line ${last}. To see more, read from line ` +
+      `${last + 1}.]`,
+    totalLines: last,
+  };
+}
+
 /**
  * Real results for Cursor's built-in tools, carrying what the CLIENT produced.
  *
@@ -279,14 +322,22 @@ export function encodeExecReadSuccess(
   execMsgId: number,
   execId: string,
   path: string,
-  content: string
+  content: string,
+  range?: { offset?: number; limit?: number }
 ): Buffer {
+  const shaped = shapeHeldRead(content, range);
+  const fitted = fitCursorToolOutput(shaped.content, CURSOR_READ_CONTENT_MAX_BYTES);
   const success = encodeMessage(RES_SUCCESS, [
     Buffer.concat([
       encodeString(READ_SUCCESS_PATH, path),
-      encodeString(READ_SUCCESS_CONTENT, content),
-      encodeUInt32Field(READ_SUCCESS_TOTAL_LINES, content ? content.split("\n").length : 0),
+      encodeString(READ_SUCCESS_CONTENT, fitted.text),
+      encodeUInt32Field(READ_SUCCESS_TOTAL_LINES, shaped.totalLines),
       encodeUInt32Field(READ_SUCCESS_FILE_SIZE, Buffer.byteLength(content, "utf8")),
+      ...(fitted.truncated ? [encodeBoolField(READ_SUCCESS_TRUNCATED, true)] : []),
+      // The client already cut the requested offset/limit. Without this flag
+      // Cursor treats the slice as the whole file and applies the range again,
+      // so the model receives nothing and keeps reading.
+      ...(range ? [encodeBoolField(READ_SUCCESS_RANGE_APPLIED, true)] : []),
     ]),
   ]);
   return wrapExecClientMessage(execMsgId, execId, ECM_READ_RESULT, success);
@@ -579,7 +630,8 @@ export function encodeExecMcpResult(
   isError: boolean
 ): Buffer {
   // McpTextContent { text } → McpToolResultContentItem.text
-  const textContent = encodeMessage(MCC_TEXT, [encodeString(MTC_TEXT, content)]);
+  const text = fitCursorToolOutput(content, CURSOR_MCP_TEXT_MAX_BYTES).text;
+  const textContent = encodeMessage(MCC_TEXT, [encodeString(MTC_TEXT, text)]);
   const successFields: Buffer[] = [encodeMessage(MCS_CONTENT, [textContent])];
   if (isError) successFields.push(encodeBoolField(MCS_IS_ERROR, true));
   const success = encodeMessage(MCR_SUCCESS, successFields);
```

**File**: `open-sse/utils/cursorAgentProtobuf/toolOutputLimit.ts` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+/**
+ * Size caps Cursor applies to tool results the agent host sends back.
+ *
+ * Cursor's own host writes an MCP text result over 40000 bytes to a file and
+ * returns its location. A result sent inline above that size is cut at byte
+ * 40000 server-side, with a notice telling the model not to retry and nothing
+ * about where the cut fell, so the model guesses offsets and re-reads. A
+ * ReadSuccess over 100000 characters is rejected outright. We fit results under
+ * both caps ourselves, on a line boundary, and name the line the result stops
+ * at so the model can continue from there.
+ */
+
+/** Below Cursor's 40000-byte inline MCP text limit, with room for its envelope. */
+export const CURSOR_MCP_TEXT_MAX_BYTES = 38_000;
+/** Below Cursor's 100000-character ReadSuccess content limit. */
+export const CURSOR_READ_CONTENT_MAX_BYTES = 95_000;
+
+const NOTICE_RESERVE_BYTES = 512;
+// "12: x" (plain), "    12→x" (Claude Code), "00012| x" (OpenCode), "    12\tx" (cat -n).
+const LINE_NUMBER = /^\s*(\d+)(?::|\||→|\t)/;
+
+export type FittedToolOutput = { text: string; truncated: boolean };
+
+export function fitCursorToolOutput(text: string, maxBytes: number): FittedToolOutput {
+  const totalBytes = Buffer.byteLength(text, "utf8");
+  if (totalBytes <= maxBytes) return { text, truncated: false };
+
+  const lines = text.split("\n");
+  const budget = maxBytes - NOTICE_RESERVE_BYTES;
+  let keptBytes = 0;
+  let kept = 0;
+  while (kept < lines.length) {
+    const next = Buffer.byteLength(lines[kept], "utf8") + (kept > 0 ? 1 : 0);
+    if (keptBytes + next > budget) break;
+    keptBytes += next;
+    kept++;
+  }
+
+  if (kept === 0) {
+    // A single line longer than the budget: cut it by bytes, dropping a
+    // multi-byte character split at the boundary.
+    const head = Buffer.from(lines[0], "utf8").subarray(0, budget).toString("utf8");
+    const body = head.replace(/�$/, "");
+    const notice =
+      `\n\n[Output truncated by the router: the first line alone is longer than Cursor's ` +
+      `${maxBytes}-byte limit for a tool result, so only its first ` +
+      `${Buffer.byteLength(body, "utf8")} of ${totalBytes} bytes are shown. ` +
+      `Request a narrower result to see the rest.]`;
+    return { text: body + notice, truncated: true };
+  }
+
+  const body = lines.slice(0, kept).join("\n");
+  const lastNumber = LINE_NUMBER.exec(lines[kept - 1])?.[1];
+  const size =
+    `first ${kept} of ${lines.length} lines, ${keptBytes} of ${totalBytes} bytes, ` +
+    `because Cursor accepts at most ${maxBytes} bytes per tool result`;
+  const notice =
+    lastNumber !== undefined
+      ? `\n\n[Output truncated by the router: this result ends at line ${Number(lastNumber)} ` +
+        `(${size}). The remaining lines were not sent. To see them, continue from line ` +
+        `${Number(lastNumber) + 1}, e.g. read again starting at that line with a smaller limit.]`
+      : `\n\n[Output truncated by the router: showing the ${size}. The remaining lines were ` +
+        `not sent. To see them, request the part after line ${kept} of this output or a ` +
+        `narrower result.]`;
+  return { text: body + notice, truncated: true };
+}
```

**File**: `tests/unit/cursor-held-read-range.test.ts` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+/**
+ * A held Cursor read that carried a line range is forwarded to the client with
+ * that range, so the client returns only those lines. The ReadSuccess sent back
+ * must say the range is already applied (ReadSuccess.range_applied = 8);
+ * otherwise Cursor treats the slice as the whole file, applies the offset again
+ * and the model gets nothing back, so it keeps reading.
+ * Run: node --import tsx/esm --test tests/unit/cursor-held-read-range.test.ts
+ */
+import assert from "node:assert/strict";
+import test from "node:test";
+
+import { newStreamCtx, processFrame } from "../../open-sse/executors/cursor.ts";
+import { CursorSessionManager } from "../../open-sse/services/cursorSessionManager.ts";
+import { openAIToolsToMcpDefs } from "../../open-sse/utils/cursorAgentProtobuf.ts";
+import {
+  decodeFields,
+  encodeMessage,
+  encodeString,
+  encodeUInt32Field,
+} from "../../open-sse/utils/cursorAgentProtobuf/wire.ts";
+
+const readTool = openAIToolsToMcpDefs([
+  {
+    type: "function",
+    function: {
+      name: "read",
+      parameters: {
+        type: "object",
+        properties: {
+          filePath: { type: "string" },
+          offset: { type: "number" },
+          limit: { type: "number" },
+        },
+        required: ["filePath"],
+      },
+    },
+  },
+]);
+
+// AgentServerMessage.exec_server_message(2) { id:1, exec_id:15, read_args:7 }
+function readRequest(range?: { offset: number; limit: number }) {
+  const args = [encodeString(1, "/repo/huge.py")];
+  if (range) args.push(encodeUInt32Field(4, range.offset), encodeUInt32Field(5, range.limit));
+  return encodeMessage(2, [
+    encodeUInt32Field(1, 3),
+    encodeString(15, "exec-read-3"),
+    encodeMessage(7, args),
+  ]);
+}
+
+function readSuccessFields(range?: { offset: number; limit: number }) {
+  const ctx = newStreamCtx("cursor-grok-4.6-medium", () => {});
+  processFrame(readRequest(range), ctx, new Set(), { mcpTools: readTool });
+  assert.equal(ctx.toolCalls.length, 1);
+
+  const frames: Buffer[] = [];
+  const req = {
+    write: (data: Buffer) => frames.push(data),
+    close: () => {},
+  } as unknown as import("node:http2").ClientHttp2Stream;
+  const client = { close: () => {} } as unknown as import("node:http2").ClientHttp2Session;
+  const manager = new CursorSessionManager();
+  const session = manager.open("held-read", client, req, new Map());
+  session.pendingBuiltinExecs = ctx.pendingBuiltinExecs;
+  assert.equal(
+    manager.sendToolResult(session, ctx.toolCalls[0].id, "2001: a\n2002: b", false),
+    true
+  );
+  assert.equal(frames.length, 1);
+  const acm = decodeFields(frames[0].subarray(5)).find((f) => f.fieldNumber === 2)!;
+  const readResult = decodeFields(acm.bytes).find((f) => f.fieldNumber === 7)!;
+  const success = decodeFields(readResult.bytes).find((f) => f.fieldNumber === 1)!;
+  return { args: JSON.parse(ctx.toolCalls[0].argumentsJson), fields: decodeFields(success.bytes) };
+}
+
+test("a ranged held read tells Cursor the client already applied the range", () => {
+  const { args, fields } = readSuccessFields({ offset: 2001, limit: 2000 });
+  assert.deepEqual(args, { filePath: "/repo/huge.py", offset: 2001, limit: 2000 });
+  assert.equal(fields.find((f) => f.fieldNumber === 8)?.varint, 1n, "range_applied");
+  // Cursor rejects an offset past total_lines ("Offset 2001 is beyond file
+  // length (2 lines)"), so the count must reach the end of the slice.
+  assert.equal(fields.find((f) => f.fieldNumber === 3)?.varint, 2002n, "total_lines");
+  assert.equal(fields.find((f) => f.fieldNumber === 2)?.bytes.toString(), "2001: a\n2002: b");
+});
+
+test("an unranged held read does not claim a range", () => {
+  const { args, fields } = readSuccessFields();
+  assert.deepEqual(args, { filePath: "/repo/huge.py" });
+  assert.equal(
+    fields.find((f) => f.fieldNumber === 8),
+    undefined
+  );
+});
```

**File**: `tests/unit/cursor-tool-output-limit.test.ts` (added, +159/-0)
```diff
@@ -0,0 +1,159 @@
+/**
+ * Cursor caps what a tool result may carry: an MCP text result over 40000
+ * bytes is cut at that byte with a notice that tells the model not to retry and
+ * nothing about where the cut fell, and a ReadSuccess over 100000 characters is
+ * rejected outright. Either way the model loses the lines it asked for and
+ * guesses offsets. The router fits results under those caps itself, on a line
+ * boundary, and says which line the result stops at.
+ * Run: node --import tsx/esm --test tests/unit/cursor-tool-output-limit.test.ts
+ */
+import assert from "node:assert/strict";
+import test from "node:test";
+
+import {
+  encodeExecMcpResult,
+  encodeExecReadSuccess,
+} from "../../open-sse/utils/cursorAgentProtobuf/execResults.ts";
+import {
+  CURSOR_MCP_TEXT_MAX_BYTES,
+  CURSOR_READ_CONTENT_MAX_BYTES,
+  fitCursorToolOutput,
+} from "../../open-sse/utils/cursorAgentProtobuf/toolOutputLimit.ts";
+import { decodeFields } from "../../open-sse/utils/cursorAgentProtobuf/wire.ts";
+
+function numbered(count: number, width: number, format = (n: number) => `${n}: `, first = 1) {
+  return Array.from({ length: count }, (_, i) => {
+    const prefix = format(first + i);
+    return prefix + "x".repeat(Math.max(0, width - prefix.length));
+  }).join("\n");
+}
+
+function field(bytes: Buffer, n: number) {
+  return decodeFields(bytes).find((f) => f.fieldNumber === n);
+}
+
+test("a result under the cap passes through untouched", () => {
+  const text = numbered(10, 20);
+  assert.deepEqual(fitCursorToolOutput(text, 1000), { text, truncated: false });
+});
+
+test("an oversized result is cut on a line boundary and names the last line shown", () => {
+  const text = numbered(3000, 30);
+  const { text: fitted, truncated } = fitCursorToolOutput(text, 38000);
+  assert.equal(truncated, true);
+  assert.ok(Buffer.byteLength(fitted) <= 38000, `${Buffer.byteLength(fitted)} bytes`);
+
+  const [body, notice] = fitted.split("\n\n[");
+  const kept = body.split("\n");
+  const original = text.split("\n");
+  assert.deepEqual(kept, original.slice(0, kept.length), "only whole lines are kept");
+  const last = kept.length;
+  assert.match(notice, new RegExp(`line ${last}\\b`));
+  assert.match(notice, new RegExp(`line ${last + 1}\\b`));
+  assert.match(notice, /3000 lines/);
+});
+
+test("line numbers in Claude Code and OpenCode formats are recognised", () => {
+  for (const format of [
+    (n: number) => `${String(n).padStart(6)}→`,
+    (n: number) => `${String(n).padStart(5, "0")}| `,
+  ]) {
+    // Numbered from 2001, as a ranged read returns it.
+    const { text: fitted } = fitCursorToolOutput(numbered(2000, 40, format, 2001), 30000);
+    const kept = fitted.split("\n\n[")[0].split("\n");
+    assert.match(fitted, new RegExp(`line ${2000 + kept.length}\\b`));
+  }
+});
+
+test("output without line numbers says how many of its lines were kept", () => {
+  const text = Array.from({ length: 3000 }, () => "y".repeat(29)).join("\n");
+  const { text: fitted } = fitCursorToolOutput(text, 38000);
+  const kept = fitted.split("\n\n[")[0].split("\n").length;
+  assert.match(fitted, new RegExp(`first ${kept} of 3000 lines`));
+});
+
+test("the byte cap holds for multi-byte text", () => {
+  const text = Array.from({ length: 3000 }, (_, i) => `${i + 1}: ${"é".repeat(20)}`).join("\n");
+  const { text: fitted, truncated } = fitCursorToolOutput(text, 38000);
+  assert.equal(truncated, true);
+  assert.ok(Buffer.byteLength(fitted) <= 38000);
+});
+
+test("an MCP result over Cursor's inline limit is fitted before it is sent", () => {
+  const text = numbered(2000, 27);
+  assert.ok(Buffer.byteLength(text) > 40000);
+  const frame = encodeExecMcpResult(3, "exec-mcp-3", text, false);
+  const ecm = field(frame.subarray(5), 2)!.bytes;
+  const success = field(field(ecm, 11)!.bytes, 1)!.bytes;
+  const item = field(success, 1)!.bytes;
+  const sent = field(field(item, 1)!.bytes, 1)!.bytes.toString("utf8");
+  assert.ok(Buffer.byteLength(sent) <= CURSOR_MCP_TEXT_MAX_BYTES);
+  assert.ok(CURSOR_MCP_TEXT_MAX_BYTES < 40000);
+  assert.match(sent, /continue from line \d+/);
+});
+
+test("a held read over Cursor's read limit is fitted and marked truncated", () => {
+  const text = numbered(3000, 46);
+  assert.ok(text.length > 100000);
+  const frame = encodeExecReadSuccess(3, "exec-read-3", "/repo/big.txt", text, {
+    offset: 1,
+    limit: 3000,
+  });
+  const ecm = field(frame.subarray(5), 2)!.bytes;
+  const success = field(field(ecm, 7)!.bytes, 1)!.bytes;
+  const content = field(success, 2)!.bytes.toString("utf8");
+  assert.ok(Buffer.byteLength(content) <= CURSOR_READ_CONTENT_MAX_BYTES);
+  assert.ok(CURSOR_READ_CONTENT_MAX_BYTES < 100000);
+  assert.equal(field(success, 6)?.varint, 1n, "truncated");
+  assert.equal(field(success, 3)?.varint, 3000n, "total_lines counts the client's whole result");
+});
+
+// A held read answers Cursor's own read tool, and Cursor renders the slice
+// against total_lines: "... N l
```

#### Recent Merged Pull Requests:
- **PR #15350** (2026-10-02): fix(dashboard): cancel the compression tab's saved-badge timer on unmount (@diegosouzapw)
- **PR #15344** (2026-10-02): fix(quality): release-green no longer runs pull_request-only ci.yml steps (@diegosouzapw)
- **PR #15342** (2026-10-02): fix(quality): clear two base-reds on release/v3.8.52 (gate-manifest alias + stryker registration) (@diegosouzapw)
- **PR #15335** (2026-10-02): docs(i18n): refresh 6 drifted docs and re-translate stale mirrors found by a full audit (@diegosouzapw)
- **PR #15330** (2026-10-02): chore(quality): reconcile the jonlwheat2 audit wave (file-size freeze + stryker registration) (@diegosouzapw)
- **PR #15329** (2026-10-02): docs: correct the db module count to 137 and re-translate stale CLAUDE.md/GEMINI.md mirrors (@diegosouzapw)
- **PR #15324** (2026-10-02): fix(security): never put an escape-folded ACP version probe on a shell command line (@diegosouzapw)
- **PR #15323** (closed): fix(agent-bridge): preserve native transport and isolate lifecycle failures (@developerjillur)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
