# Forensic Learning Record (Deep Inspection): diegosouzapw/OmniRoute

> **Canonical Artifact**: `07_PROJECT_LEARNING/diegosouzapw-omniroute-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/diegosouzapw/OmniRoute](https://github.com/diegosouzapw/OmniRoute))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T13:55:22.050Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `diegosouzapw/OmniRoute`
- **Description**: Never stop coding. Free MIT AI gateway: one endpoint, 359 providers (150+ free), 1200+ models Kimi, Claude, GPT, Gemini, GLM, DeepSeek, MiniMax. Works with Claude Code, Codex, Cursor, OpenCode, Cline & Copilot. Quota-aware auto-fallback, RTK+Caveman compression saves 15-95% tokens, MCP/A2A, Desktop/PWA. Built by hundreds of contributors
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 71622 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `@omniroute/opencode-plugin-v2/server.js`
```
// Root entrypoint for OpenCode host plugin loading.
//
// OpenCode 2.x local installs (`file://` directory in `opencode.json`) never
// read package.json `main`/`exports`: the config scan resolves only the
// subpaths ["server", ""] then ["tui"], ["rpc"] from the package directory.
// With only `dist/index.js` present the scan yields `{}` and the plugin is
// silently dropped (no `loading plugin`, no error). This stable re-export
// keeps `dist/` as the only build output while exposing the module the host
// actually probes for.
export { default } from "./dist/index.js";

```

### Core Architecture Module: `@omniroute/opencode-plugin-v2/src/cache.ts`
```
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  OmniRouteEnrichmentEntry,
  OmniRouteEnrichmentMap,
  OmniRouteProviderConnection,
  OmniRouteRawAutoCombo,
  OmniRouteRawCombo,
  OmniRouteRawModelEntry,
} from "./shared/index.js";
import { isHttpUrl } from "./shared/index.js";

export const DEFAULT_MODEL_CACHE_TTL_MS = 300_000 as const;

/**
 * Breather after a refresh whose models fetch came back empty (gateway down
 * or refusing). Transforms inside the window serve last-known-good without
 * re-firing the fetch suite. Short on purpose: it only guards the
 * pathological case, normal TTL expiry still refetches every window.
 */
export const UNREACHABLE_COOLDOWN_MS = 15_000 as const;

export interface CatalogSnapshot {
  models: OmniRouteRawModelEntry[];
  combos: OmniRouteRawCombo[];
  autoCombos: OmniRouteRawAutoCombo[];
  providers?: OmniRouteProviderConnection[];
  enrichment?: OmniRouteEnrichmentMap;
  fetchedAt: number;
}

export const SNAPSHOT_FORMAT_VERSION = 2 as const;

/**
 * A raw snapshot entry is stale when it cannot be mapped to a publishable
 * model: no string `id` (unroutable), or a pre-mapped `api` block missing a
 * valid `npm` package (the runner would reject it as `Unsupported package`)
 * or a usable `url` (the host would reach the AI SDK with no baseURL).
 * Plain `/v1/models` entries carry no `api` block -- it is synthesized at
 * publish time -- so only a present-but-invalid block drops the entry.
 */
export function isStaleSnapshotModel(entry: unknown): boolean {
  if (!entry || typeof entry !== "object") return true;
  const id = (entry as { id?: unknown }).id;
  if (typeof id !== "string" || id.length === 0) return true;
  const api = (entry as { api?: unknown }).api;
  if (api === undefined) return false;
  if (!api || typeof api !== "object") return true;
  const npm = (api as { npm?: unknown }).npm;
  if (typeof npm !== "string" || npm.length === 0) return true;
  // Same requirement as `npm`, and the same predicate the options schema
  // applies to `baseURL`: a pre-mapped block without a callable `url` publishes
  // a model the host cannot route -- see `legacyApiToInfoApi`.
  return !isHttpUrl((api as { url?: unknown }).url);
}

interface DiskSnapshotV2 {
  v: 2;
  identityFingerprint: string;
  models: OmniRouteRawModelEntry[];
  combos: OmniRouteRawCombo[];
  autoCombos?: OmniRouteRawAutoCombo[];
  providers?: OmniRouteProviderConnection[];
  /**
   * Display names, provider labels, pricing and free-tier budgets, as
   * `[key, entry]` pairs (a Map does not survive JSON). Persisted because a
   * cold start otherwise publishes raw model ids until the first refresh
   * completes — which is the moment the snapshot exists to cover.
   */
  enrichment?: [string, OmniRouteEnrichmentEntry][];
  writtenAt: number;
}

/**
 * Ceiling on what one snapshot may occupy on disk. A gateway with thousands of
 * models makes this file grow without bound otherwise; past the cap the
 * enrichment overlay is dropped first (it is rebuilt on the next refresh)
 * rather than losing the catalog itself.
 */
const MAX_SNAPSHOT_BYTES = 32 * 1024 * 1024;

// Suffix for the temp file each write publishes via rename. Monotone per
// process: two writes for one provider (for example across a credential
// rotation) must not share a temp name. Built after the empty-models and
// size-cap guards, so only real attempts consume a value.
let snapshotWriteCounter = 0;

function trimTrailingSlashes(value: string): string {
  let i = value.length;
  while (i > 0 && value.charCodeAt(i - 1) === 0x2f) i -= 1;
  return i === value.length ? value : value.slice(0, i);
}

function normalizeBaseURL(baseURL: string): string {
  try {
    const parsed = new URL(baseURL);
    parsed.hash = "";
    parsed.pathname = trimTrailingSlashes(parsed.pathname) || "/";
    return parsed.toString();
  } catch {
    return trimTrailingSlashes(baseURL);
  }
}

export function memoryCacheKey(baseURL: string, credentialId: string): string {
  return `${baseURL}::${createHash("sha256").update(credentialId).digest("hex")}`;
}

export function snapshotIdentityFingerprint(
  baseURL: string,
  apiKey: string,
  managementReadToken: string
): string {
  return createHash("sha256")
    .update(JSON.stringify([normalizeBaseURL(baseURL), apiKey, managementReadToken]))
    .digest("hex");
}

export function diskSnapshotPath(providerId: string): string {
  // OPENCODE_DATA_DIR is honoured verbatim when set: whoever controls the
  // process environment already chooses where the process writes, so
  // resolving it further would only surprise. The providerId segment stays
  // bounded by the options schema (letters, digits, '.', '_' and '-'; never
  // "." or ".."), keeping the file inside <dir>/plugins/.
  const dir = process.env.OPENCODE_DATA_DIR ?? join(homedir(), ".local", "share", "opencode");
  return join(dir, "plugins", `omniroute-${providerId}.json`);
}

export async function readDiskSnapshot(
  providerId: string,
  identityFingerprint: string,
  logger?: { warn: (message: string) => void }
): Promise<CatalogSnapshot | undefined> {
  try {
    const body = await readFile(diskSnapshotPath(providerId), "utf8");
    const parsed = JSON.parse(body) as Partial<DiskSnapshotV2>;
    if (
      !parsed ||
      typeof parsed.v !== "number" ||
      parsed.v !== SNAPSHOT_FORMAT_VERSION ||
      typeof parsed.identityFingerprint !== "string" ||
      parsed.identityFingerprint !== identityFingerprint
    ) {
      return undefined;
    }
    if (
      !Array.isArray(parsed.models) ||
      parsed.models.length === 0 ||
      !Array.isArray(parsed.combos)
    ) {
      return undefined;
    }
    const stale = (parsed.models as unknown[]).filter(isStaleSnapshotModel).length;
    const models = (parsed.models as OmniRouteRawModelEntry[]).filter(
      (entry) => !isStaleSnapshotModel(entry)
    );
    if (stale > 0) {
      logger?.warn(`[omniroute-v2] dropping ${stale} stale snapshot entries with an unusable api block`);
    }
    if (models.length === 0) return undefined;
    return {
      models,
      combos: parsed.combos as OmniRouteRawCombo[],
      autoCombos: Array.isArray(parsed.autoCombos)
        ? (parsed.autoCombos as OmniRouteRawAutoCombo[])
        : [],
      providers: Array.isArray(parsed.providers)
        ? (parsed.providers as OmniRouteProviderConnection[])
        : [],
      // A snapshot written before this field existed, or one whose overlay was
      // dropped for size, simply starts unenriched and recovers on the first
      // refresh — the same state as before it was persisted at all.
      enrichment: Array.isArray(parsed.enrichment)
        ? new Map(parsed.enrichment as [string, OmniRouteEnrichmentEntry][])
        : undefined,
      fetchedAt: typeof parsed.writtenAt === "number" ? parsed.writtenAt : Date.now(),
    };
  } catch {
    return undefined;
  }
}

export async function writeDiskSnapshot(
  providerId: string,
  snapshot: CatalogSnapshot,
  identityFingerprint: string,
  logger?: { warn: (message: string) => void }
): Promise<void> {
  // Monotone per-process suffix: two writes for one provider (for example
  // across a credential rotation) must not share a temp name. Declared here
  // so the catch below can clean it up; assigned after the guards so only
  // real attempts consume a counter value.
  let tmp = "";
  try {
    if (snapshot.models.length === 0) return;
    const file = diskSnapshotPath(providerId);
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    const envelope: DiskSnapshotV2 = {
      v: 2,
      identityFingerprint,
      models: snapshot.models,
      combos: snapshot.combos,
      autoCombos: snapshot.autoCombos,
      providers: snapshot.providers ?? [],
      enrichment: snapshot.enrichment ? [...snapshot.enrichment.entries()] : und
```

### Core Architecture Module: `@omniroute/opencode-plugin-v2/src/catalog.ts`
```
import type { Model, Provider } from "@opencode/plugin";
import type { LegacyModel } from "./legacy-model.js";
import {
  isHttpUrl,
  type ApiFormatV2,
  type LogLevel,
  type Logger,
  type OmniRouteAutoCombosFetcher,
  type OmniRouteCombosFetcher,
  type OmniRouteEnrichmentFetcher,
  type OmniRouteEnrichmentMap,
  type OmniRouteModelsFetcher,
  type OmniRouteProviderConnection,
  type OmniRouteProvidersFetcher,
  type OmniRouteRawAutoCombo,
  type OmniRouteRawCombo,
  type OmniRouteRawModelEntry,
  applyEnrichment,
  buildCanonicalToAliasMap,
  canonicalDedupSet,
  createLogger,
  defaultOmniRouteEnrichmentFetcher,
  defaultOmniRouteProvidersFetcher,
  ensureV1Suffix,
  isUsableCombo,
  isUsableRawModelId,
  lookupEnrichment,
  mapAutoComboToModelV2,
  mapComboToModelV2,
  mapRawModelToModelV2,
  usableProviderAliasSet,
} from "./shared/index.js";

export type ModelsFetcher = OmniRouteModelsFetcher;
export type CombosFetcher = OmniRouteCombosFetcher;
export type AutoCombosFetcher = OmniRouteAutoCombosFetcher;
export type ProvidersFetcher = OmniRouteProvidersFetcher;
export type EnrichmentFetcher = OmniRouteEnrichmentFetcher;

export interface EndpointTimeouts {
  models?: number;
  combos?: number;
  autoCombos?: number;
  enrichment?: number;
}

export interface ResolvedOptions {
  providerId: string;
  baseURL: string;
  apiKey: string;
  managementReadToken?: string;
  timeoutMs: number;
  timeouts?: EndpointTimeouts;
  logger?: Logger;
  logLevel?: LogLevel;
  startupDebug?: boolean;
  modelCacheTtlMs: number;
  /** v1 parity: prefix the display name with the upstream provider label. */
  providerTag?: boolean;
  displayName?: string;
  apiFormat?: ApiFormatV2;
  visibleModels?: string[];
  hiddenModels?: string[];
  usableOnly: boolean;
  enrichment?: OmniRouteEnrichmentMap | boolean;
  /**
   * Shared collision-warning dedupe set keyed `cacheKey::comboKey`. When
   * omitted a fresh per-publish set is used. index.ts passes one setup-wide
   * set so a repeated publish (stale replay + refresh) warns once per key.
   */
  collisionWarned?: Set<string>;
}

export interface CatalogFetchers {
  fetcher?: ModelsFetcher;
  combosFetcher?: CombosFetcher;
  autoCombosFetcher?: AutoCombosFetcher;
  providersFetcher?: ProvidersFetcher;
  enrichmentFetcher?: EnrichmentFetcher;
  models?: ModelsFetcher;
  combos?: CombosFetcher;
  autoCombos?: AutoCombosFetcher;
  providers?: ProvidersFetcher;
  enrichment?: EnrichmentFetcher;
  /**
   * Called when a gateway source cannot be read. Without it this function
   * degrades silently — the catalog publishes with raw ids and no combos and
   * nothing says why, which is the failure the plugin path reports.
   */
  onSourceError?: (endpoint: string, reason: string) => void;
}

export type StableModelInfo = Model.Info;
export type StableProviderInfo = Provider.Info;

/**
 * Structural mirror of the stable `ctx.provider.transform` editor, used as
 * the parameter type where the payload is handed to the host (and in tests
 * that fake the editor). Kept as documentation of the contract surface even
 * where only `add` is exercised.
 */
export interface StableProviderEditor {
  add(input: { info: StableProviderInfo; models: readonly StableModelInfo[] }): void;
  get(providerID: string): { provider: StableProviderInfo } | undefined;
  list(): readonly { provider: StableProviderInfo }[];
  update(providerID: string, update: (provider: StableProviderInfo) => void): void;
  remove(providerID: string): void;
  readonly models: {
    set(providerID: string, models: readonly StableModelInfo[]): void;
    update(providerID: string, modelID: string, update: (model: StableModelInfo) => void): void;
    remove(providerID: string, modelID: string): void;
  };
}

/**
 * Project the legacy catalog entry the shared mappers produce onto the
 * stable `Model.Info` shape. The mapper layer stays untouched; only this
 * boundary knows both shapes. Extra legacy-only keys (`api`, `options`,
 * string `release_date`) are dropped, never cast across.
 */
export function legacyToStable(
  providerID: string,
  modelID: string,
  m: LegacyModel,
  apiKey: string,
  baseURL: string
): StableModelInfo {
  if (!m.api || typeof m.api.npm !== "string" || m.api.npm.length === 0) {
    throw new Error(
      "[omniroute-v2] refusing to publish a model without an api block (missing api.npm)"
    );
  }
  if (!isHttpUrl(m.api.url)) {
    throw new Error(
      "[omniroute-v2] refusing to publish a model whose api block carries no http(s) url"
    );
  }
  const stablePackage =
    m.api.npm === "@ai-sdk/anthropic" ? "@opencode/ai/providers/anthropic" : NPM_OPENAI_COMPAT;
  const input: string[] = [];
  if (m.capabilities.input.text) input.push("text");
  if (m.capabilities.input.audio) input.push("audio");
  if (m.capabilities.input.image) input.push("image");
  if (m.capabilities.input.video) input.push("video");
  if (m.capabilities.input.pdf) input.push("pdf");
  const output: string[] = [];
  if (m.capabilities.output.text) output.push("text");
  if (m.capabilities.output.audio) output.push("audio");
  if (m.capabilities.output.image) output.push("image");
  if (m.capabilities.output.video) output.push("video");
  if (m.capabilities.output.pdf) output.push("pdf");
  const variants = Object.entries(m.variants ?? {}).map(([id, body]) => ({
    id,
    settings: { ...(body as Record<string, unknown>) },
    headers: {},
    body: { ...(body as Record<string, unknown>) },
  }));
  const parsed = Date.parse(m.release_date);
  const info = {
    id: modelID,
    modelID,
    providerID,
    ...(m.family !== undefined ? { family: m.family } : {}),
    name: m.name,
    package: stablePackage,
    settings: { baseURL: ensureV1Suffix(baseURL), apiKey },
    headers: { ...m.headers },
    ...(Object.keys(m.options).length > 0 ? { body: { ...m.options } } : {}),
    capabilities: { tools: m.capabilities.toolcall, input, output },
    variants,
    time: { released: Number.isNaN(parsed) ? 0 : parsed },
    cost: [
      { input: m.cost.input, output: m.cost.output, cache: { ...m.cost.cache } },
    ],
    status: m.status,
    enabled: true,
    limit: { ...m.limit },
  } as unknown;
  return info as StableModelInfo;
}

const NPM_OPENAI_COMPAT = "@opencode/ai/providers/openai-compatible";

/**
 * Fail-fast guard for a pre-mapped `api` block: the snapshot filter and the
 * stale-entry suite assert on it, and the beta-replay adapter relies on the
 * same refusal for entries that bypass the mapper. New mapper output always
 * carries a valid block via `resolveApiBlockV2`, so this fires only on stale
 * snapshots or hand-built entries.
 */
export function legacyApiToInfoApi(api: LegacyModel["api"]): {
  id: string;
  type: "aisdk";
  package: string;
  url: string;
} {
  if (!api || typeof api.npm !== "string" || api.npm.length === 0) {
    throw new Error(
      "[omniroute-v2] refusing to publish a model without an api block (missing api.npm)"
    );
  }
  // The host reads `api.url` in `prepareOptions` and never falls back to the
  // provider's own, so a model published without one reaches the AI SDK with no
  // baseURL and fails at call time with a bare `Invalid URL` — no request on the
  // wire, nothing in the gateway logs, no model named.
  if (!isHttpUrl(api.url)) {
    throw new Error(
      "[omniroute-v2] refusing to publish a model whose api block carries no http(s) url"
    );
  }
  return { id: api.id, type: "aisdk", package: api.npm, url: api.url };
}

function legacyCostToInfoCost(cost: LegacyModel["cost"]): StableModelInfo["cost"] {
  const c = [{ input: cost.input, output: cost.output, cache: cost.cache }];
  return c as unknown as StableModelInfo["cost"];
}

function legacyCapabilitiesToInfoCapabilities(
  caps: LegacyModel["capabilities"]
): StableModelInfo["capabilities"] {
  const input: string[] = [];
  if (caps.input.text) input.push("text");
  if (caps.input.audio) input.push("audio");
  if (caps.input.image) input.push("image");
  if
```

### Core Architecture Module: `@omniroute/opencode-plugin-v2/src/compat.ts`
```
/**
 * The stable contract has no `ctx.catalog`: providers publish through
 * `ctx.provider.transform` (`editor.add` with `info` + `models`) and narrow
 * through `ctx.model.transform`. This guard therefore requires the provider
 * and model transforms plus an options object, and nothing else.
 */
export function assertContext(ctx: unknown): void {
  if (!isObject(ctx)) {
    throw new Error("[omniroute-v2] contract breach: ctx must be an object");
  }
  if (!isTransformHolder(ctx.provider) || typeof ctx.provider.transform !== "function") {
    throw new Error("[omniroute-v2] contract breach: ctx.provider.transform must be a function");
  }
  if (!isTransformHolder(ctx.model) || typeof ctx.model.transform !== "function") {
    throw new Error("[omniroute-v2] contract breach: ctx.model.transform must be a function");
  }
  if (!isObject(ctx.options)) {
    throw new Error("[omniroute-v2] contract breach: ctx.options must be an object");
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTransformHolder(value: unknown): value is { transform: unknown } {
  return isObject(value) && "transform" in value;
}

```

### Core Architecture Module: `@omniroute/opencode-plugin-v2/src/credentials.ts`
```
import type { Logger } from "./shared/index.js";

/** Minimal stable context surface this module reads (provider transforms stay untyped here). */
export interface StableCredentialContext {
  integration: {
    connection?: {
      active?: (integrationID: string) => Promise<unknown>;
      resolve?: (connection: unknown) => Promise<unknown>;
    };
  };
}

type StableContext = StableCredentialContext;

/** Where a resolved key came from, so the failure message can name the fix. */
export type ApiKeyOrigin = "connection" | "option" | "env" | "missing";

export interface ResolvedApiKey {
  key: string;
  origin: ApiKeyOrigin;
}

const ENV_VAR = "OMNIROUTE_API_KEY";

/**
 * `ctx.integration.connection` carries the stored credential. Probing the
 * shape keeps the plugin loadable on a host that exposes `integration`
 * without it.
 */
function connectionApi(
  ctx: StableContext
): { active: (id: string) => Promise<unknown>; resolve: (c: unknown) => Promise<unknown> } | undefined {
  const connection = (ctx.integration as unknown as Record<string, unknown>).connection as
    | { active?: unknown; resolve?: unknown }
    | undefined;
  if (
    connection === undefined ||
    typeof connection.active !== "function" ||
    typeof connection.resolve !== "function"
  ) {
    return undefined;
  }
  return connection as {
    active: (id: string) => Promise<unknown>;
    resolve: (c: unknown) => Promise<unknown>;
  };
}

/**
 * Read the credential the user stored through the host's own auth flow.
 *
 * The plugin advertises `key` and `env` methods on its integration, so a user
 * can connect it from the UI; without this lookup that connection would only
 * feed inference and the catalog fetches would still need a key pasted into
 * the config file.
 *
 * Returns `undefined` (never throws) when there is no connection or when the
 * stored credential is an OAuth grant — this plugin authenticates the gateway
 * with a bearer key, and an access token from an unrelated grant is not one.
 */
async function keyFromConnection(
  ctx: unknown,
  integrationID: string,
  log: Logger
): Promise<string | undefined> {
  const connection = connectionApi(ctx as StableCredentialContext);
  if (connection === undefined) return undefined;
  try {
    const active = await connection.active(integrationID);
    if (active === undefined) return undefined;
    const credential = (await connection.resolve(active)) as
      | { type?: unknown; key?: unknown }
      | undefined;
    if (credential === undefined) return undefined;
    if (credential.type !== "key") {
      log.warn(
        `[omniroute-v2] ignoring the stored ${String(credential.type)} credential: this plugin authenticates with an API key`
      );
      return undefined;
    }
    return typeof credential.key === "string" && credential.key.length > 0
      ? credential.key
      : undefined;
  } catch (err) {
    log.warn(
      `[omniroute-v2] could not read the stored credential: ${err instanceof Error ? err.message : String(err)}`
    );
    return undefined;
  }
}

/**
 * Resolve the gateway key, preferring the credential the host holds over one
 * written in config. A key in `opencode.json` still wins over the environment
 * so an explicit per-project override keeps working.
 */
export async function resolveApiKey(
  ctx: unknown,
  integrationID: string,
  optionKey: string | undefined,
  log: Logger
): Promise<ResolvedApiKey> {
  const stored = await keyFromConnection(ctx, integrationID, log);
  if (stored !== undefined) return { key: stored, origin: "connection" };
  if (optionKey !== undefined && optionKey.length > 0) return { key: optionKey, origin: "option" };
  const fromEnv = process.env[ENV_VAR];
  if (fromEnv !== undefined && fromEnv.length > 0) return { key: fromEnv, origin: "env" };
  return { key: "", origin: "missing" };
}

/**
 * A missing key produces an empty catalog and no error the user can see, so
 * say it once, and name the three ways to supply one.
 */
export function warnIfMissing(resolved: ResolvedApiKey, integrationID: string, log: Logger): void {
  if (resolved.origin !== "missing") return;
  log.warn(
    `[omniroute-v2] no API key for "${integrationID}": the catalog will be empty. ` +
      `Connect the integration from opencode, set "apiKey" in the plugin options, ` +
      `or export ${ENV_VAR}.`
  );
}

```

### Core Architecture Module: `@omniroute/opencode-plugin-v2/src/enrichment-report.ts`
```
import type { Logger } from "./shared/index.js";

/** What the catalog loses when a given gateway source cannot be read. */
function consequenceOf(endpoint: string): string {
  if (endpoint.includes("/api/providers")) {
    return "the usable-provider filter is disabled for this refresh, so unprovisioned providers stay listed";
  }
  return "model names, provider tags, canonical dedupe and pricing are degraded";
}

/**
 * A source the gateway refuses is not fatal — the catalog still publishes —
 * but staying quiet about it is: the picker then shows raw ids, or lists
 * providers that cannot serve, with nothing telling the user why. Say it once
 * per endpoint so a refresh loop cannot spam the log.
 *
 * `usingFallbackToken` is true when no `managementReadToken` was configured and
 * the inference key stands in for it, which is the usual reason a gateway
 * answers 401/403 on `/api/*` — the advice differs from a token that was set
 * and still got rejected.
 */
export function createSourceErrorReporter(
  log: Logger,
  usingFallbackToken: boolean
): (endpoint: string, reason: string) => void {
  const warned = new Set<string>();
  return (endpoint, reason) => {
    if (warned.has(endpoint)) return;
    warned.add(endpoint);
    const unauthorized = reason.includes("401") || reason.includes("403");
    const hint = !unauthorized
      ? ""
      : usingFallbackToken
        ? ` These endpoints need a management token: set "managementReadToken" in the plugin options ` +
          `(it currently falls back to "apiKey", which a gateway usually rejects here).`
        : ` The configured "managementReadToken" was rejected — check it grants read access to /api/*.`;
    log.warn(
      `[omniroute-v2] gateway source ${endpoint} unavailable (${reason}): ${consequenceOf(endpoint)}.${hint}`
    );
  };
}

```

### Core Architecture Module: `@omniroute/opencode-plugin-v2/src/gemini-language.ts`
```
import type { LanguageModelV3 } from "@ai-sdk/provider";
import { type Logger, isGeminiModelId, sanitizeToolInputSchemas } from "./shared/index.js";

type CallOptions = Parameters<LanguageModelV3["doGenerate"]>[0];

/**
 * Gemini answers `400 INVALID_ARGUMENT` — for the entire request, not just the
 * offending tool — when a tool declaration carries `$schema` or
 * `additionalProperties`. Anything upstream that emits standard JSON Schema
 * therefore breaks tool calling as soon as the chain routes to Gemini. A
 * `$ref` is forwarded untouched instead: stripping it would widen the schema
 * to "accept anything", which is worse than letting the gateway answer. The
 * v1 plugin dealt with this by wrapping `fetch` and rewriting the JSON body; the
 * v2 home for it is the language model, where the tools are still structured
 * data and no re-parsing is needed.
 *
 * Returns the model untouched when it is not bound for Gemini, so the wrapper
 * costs nothing on every other chain.
 */
export function sanitizeToolSchemasFor<T extends LanguageModelV3 | undefined>(
  language: T,
  modelId: string,
  log: Logger
): T {
  if (language === undefined) return language;
  if (!isGeminiModelId(modelId)) return language;

  const clean = (options: CallOptions): CallOptions => {
    const tools = sanitizeToolInputSchemas(options.tools);
    if (tools === undefined) return options;
    log.debug(
      `[omniroute-v2] stripped Gemini-incompatible schema keywords from ${tools.length} tool declaration(s) for ${modelId}`
    );
    return { ...options, tools } as CallOptions;
  };

  // Prototype-linked so every other member of the model — including accessors
  // and anything a future SDK version adds — keeps working untouched.
  const wrapped: LanguageModelV3 = Object.create(language as object) as LanguageModelV3;
  wrapped.doGenerate = (options) => language.doGenerate(clean(options));
  wrapped.doStream = (options) => language.doStream(clean(options));
  return wrapped as T;
}

```

### Core Architecture Module: `@omniroute/opencode-plugin-v2/src/index.ts`
```
import { Plugin } from "@opencode/plugin";
import {
  optionalTierFingerprint,
  catalogContentFingerprint,
  createLogger,
  defaultOmniRouteAutoCombosFetcher,
  defaultOmniRouteCombosFetcher,
  defaultOmniRouteEnrichmentFetcher,
  defaultOmniRouteModelsFetcher,
  defaultOmniRouteProvidersFetcher,
  type OmniRouteEnrichmentMap,
  type OmniRouteProviderConnection,
} from "./shared/index.js";
import type {
  OmniRouteRawAutoCombo,
  OmniRouteRawCombo,
  OmniRouteRawModelEntry,
} from "./shared/index.js";
import type { ResolvedOptions } from "./catalog.js";
import { buildProviderPayload, collectCatalog } from "./catalog.js";
import {
  DEFAULT_MODEL_CACHE_TTL_MS,
  UNREACHABLE_COOLDOWN_MS,
  memoryCacheKey,
  readDiskSnapshot,
  snapshotIdentityFingerprint,
  writeDiskSnapshot,
  type CatalogSnapshot,
} from "./cache.js";
import { assertContext } from "./compat.js";
import { type ApiKeyOrigin, resolveApiKey, warnIfMissing } from "./credentials.js";
import { createSourceErrorReporter } from "./enrichment-report.js";
import { sanitizeToolSchemasFor } from "./gemini-language.js";
import {
  MANAGEMENT_TOKEN_ENV_VAR,
  PLUGIN_ID,
  parsePluginOptions,
  resolveManagementReadToken,
  resolveTimeouts,
  type PluginOptions,
} from "./options.js";

/**
 * A fetch result that says whether it succeeded. Returning a bare `[]` on
 * failure makes an outage indistinguishable from a gateway that legitimately
 * has no combos — and the difference decides whether the last known value
 * should be kept or dropped.
 */
type SourceResult<T> = { ok: true; value: T } | { ok: false };

interface RefreshState {
  entries: Map<string, CatalogSnapshot>;
  inFlight: Map<string, Promise<CatalogSnapshot>>;
  fingerprint: string | undefined;
  /** Digest of the optional tier, so a reload only follows a real change. */
  optionalFingerprint: string | undefined;
  /**
   * When the last refresh found the gateway unreachable, skip the network
   * until this timestamp and serve last-known-good instead. Without it every
   * transform past TTL re-fires the full fetch suite against a gateway that
   * just proved it cannot answer — a self-inflicted retry storm.
   */
  unreachableUntil: number;
}

function toResolvedOptions(parsed: PluginOptions): ResolvedOptions {
  return {
    providerId: parsed.providerId,
    baseURL: parsed.baseURL,
    apiKey: parsed.apiKey ?? process.env.OMNIROUTE_API_KEY ?? "",
    managementReadToken: resolveManagementReadToken(parsed.managementReadToken),
    timeoutMs: parsed.timeoutMs,
    timeouts: parsed.timeouts,
    logLevel: parsed.logLevel,
    startupDebug: parsed.startupDebug,
    providerTag: parsed.providerTag,
    modelCacheTtlMs:
      typeof parsed.modelCacheTtlMs === "number" && parsed.modelCacheTtlMs > 0
        ? parsed.modelCacheTtlMs
        : DEFAULT_MODEL_CACHE_TTL_MS,
    displayName: parsed.displayName,
    apiFormat: parsed.apiFormat,
    visibleModels: parsed.visibleModels,
    hiddenModels: parsed.hiddenModels,
    usableOnly: parsed.usableOnly,
    enrichment: parsed.enrichment,
  };
}

export default Plugin.define({
  id: PLUGIN_ID,
  setup: async (ctx) => {
    assertContext(ctx);
    const parsed = parsePluginOptions(ctx.options);
    const X = parsed.providerId;
    const resolved = toResolvedOptions(parsed);
    const timeouts = resolveTimeouts(parsed);
    const log = createLogger(parsed.startupDebug ? "debug" : (parsed.logLevel ?? "warn"));
    resolved.logger = log;
    resolved.logLevel = parsed.logLevel;
    resolved.startupDebug = parsed.startupDebug;
    log.info(`[omniroute-v2] init providerId=${X}`);
    // The inference key stands in below when no management token is set, and
    // gateways usually reject that stand-in with 401/403. Say so once here,
    // before any fetch, instead of letting the refusal surface per endpoint.
    if (resolved.managementReadToken === undefined) {
      log.warn(
        `[omniroute-v2] no management token configured: management endpoints (/api/*) will reuse the inference key, ` +
          `which gateways usually reject with 401/403. Set "managementReadToken" in the plugin options ` +
          `or export ${MANAGEMENT_TOKEN_ENV_VAR}.`
      );
    }

    // v1 parity port: in-memory TTL + disk snapshot. The memory key
    // `baseURL::sha256(creds)` isolates credential tuples (prod vs
    // staging); the TTL is checked in the transform before any fetch;
    // concurrent calls share the refresh promise in the setup closure keyed
    // by (providerId, baseURL); the disk snapshot feeds warm-startup and
    // the offline fallback. The existing in-memory keep-last-good is kept.
    const state: RefreshState = {
      entries: new Map(),
      inFlight: new Map(),
      fingerprint: undefined,
      optionalFingerprint: undefined,
      unreachableUntil: 0,
    };

    // The credential the host holds wins over one written in config, so a
    // user who connected the integration from the UI never has to paste a
    // key into `opencode.json`. Reading it is async and the transforms must
    // register synchronously, so the lookup happens on the first publish;
    // until then the option/env key resolved above stands in.
    const credentialsOf = (): { cacheKey: string; identityFingerprint: string } => ({
      cacheKey: memoryCacheKey(
        resolved.baseURL,
        `${resolved.apiKey}\0${resolved.managementReadToken ?? resolved.apiKey}`
      ),
      identityFingerprint: snapshotIdentityFingerprint(
        resolved.baseURL,
        resolved.apiKey,
        resolved.managementReadToken ?? resolved.apiKey
      ),
    });
    let { cacheKey, identityFingerprint } = credentialsOf();

    // Both keys are derived from the credential: two credentials must never
    // share a snapshot, so they are recomputed whenever the key moves.
    let credentialChecked = false;
    let apiKeyOrigin: ApiKeyOrigin = resolved.apiKey.length > 0 ? "option" : "missing";
    const ensureCredential = async (): Promise<void> => {
      // Settled once a key is in hand: re-reading on every refresh would let
      // a mid-session change silently repoint the snapshot keys.
      if (credentialChecked && apiKeyOrigin !== "missing") return;
      const next = await resolveApiKey(ctx, X, parsed.apiKey, log);
      const moved = next.key !== resolved.apiKey;
      resolved.apiKey = next.key;
      apiKeyOrigin = next.origin;
      if (moved) ({ cacheKey, identityFingerprint } = credentialsOf());
      if (!credentialChecked) warnIfMissing(next, X, log);
      else if (moved) log.info(`[omniroute-v2] API key picked up from the ${next.origin} source`);
      credentialChecked = true;
    };

    const fetchModelsSafe = async (): Promise<OmniRouteRawModelEntry[]> => {
      try {
        return await defaultOmniRouteModelsFetcher(
          resolved.baseURL,
          resolved.apiKey,
          timeouts.models
        );
      } catch (err) {
        log.warn(
          `[omniroute-v2] models fetch failed, publishing empty catalog: ${err instanceof Error ? err.message : String(err)}`
        );
        return [];
      }
    };
    // Failures are reported once per endpoint (with the management-token hint
    // when the inference key stands in), so a gated `/api/*` degrades loudly
    // rather than silently. Declared before the wrappers that use it.
    const reportSourceError = createSourceErrorReporter(
      log,
      resolved.managementReadToken === undefined
    );
    const fetchCombosSafe = async (): Promise<SourceResult<OmniRouteRawCombo[]>> => {
      try {
        return {
          ok: true,
          value: await defaultOmniRouteCombosFetcher(
            resolved.baseURL,
            resolved.managementReadToken ?? resolved.apiKey,
            timeouts.combos
          ),
        };
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        reportSourceError("/api/combos", reason);
        log.warn(`[omniroute-v2] combos fetch failed, keeping the l
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #15129** (2026-09-30): **fix: broken link of the VS Code Marketplace extension page**
  *Symptoms*: ### OmniRoute Version  3.8.50  ### Installation Method  Docker / Docker Compose  ### Operating System  Windows  ### OS Version  Windows 11  ### Node.js Version  _No response_  ### Provider(s) Involved  _No response_  ### Model(s) Involved  _No response_  ### Client Tool  _No response_  ### Description  The link behind this banner is broken and does not open the VS Code Marketplace extension page.  It currently redirects to:  https://link.omniroute.online/vsx  which returns:  **This page doesn’t exist**   It may have been moved, removed, or never existed.  `404 DEPLOYMENT_NOT_FOUND`   ### Steps to Reproduce  Install OmniRouter and navigate on the dashboard page, than click on banner button for to go on the VS Code Marketplace extension page  ### Expected Behavior  The button must go to https://marketplace.visualstudio.com/items?itemName=diegosouzapw.omnicopilot  ### Actual Behavior  The link behind this banner is broken and does not open the VS Code Marketplace extension page.  It currently redirects to:  https://link.omniroute.online/vsx  which returns:  **This page doesn’t exist**   It may have been moved, removed, or never existed.  `404 DEPLOYMENT_NOT_FOUND`  ### Test Impact  Unsure  ### Error Logs / Output  ```shell  ```  ### Screenshots   <img width="1640" height="97" alt="Image" src="https://github.com/user-attachments/assets/e76e1a74-1a78-4b1d-b085-453b1d8b538a" />  <img width="981" height="618" alt="Image" src="https://github.com/user-attachments/assets/aa88ebc7-ff97-
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. This is already fixed: #12410 (merged into `release/v3.8.51`) removed the dead `link.omniroute.online` shortener, and the banner button now points straight to https://marketplace.visualstudio.com/items?itemName=diegosouzapw.omnicopilot (`src/app/(dashboard)/dashboard/VscodeCopilotBanner.tsx`). You were on 3.8.50, which predates the change. Please upgrade to 3.8.51 once it is released. Closing as fixed.

- **Issue #15125** (2026-09-30): **fix(backend): replay key does not include the calling API key**
  *Symptoms*: ## Description The composed idempotency key does not include the calling API key: `rawKey|provider|model|digest` (`composeIdempotencyKey` in `open-sse/handlers/chatCore/idempotency.ts`). Two different API keys that send the same `Idempotency-Key` / `X-Request-Id`, the same model and the same request body within the replay window share one cached response. On a replay hit the handler returns before any usage/cost recording, so the second caller's usage is not attributed.  The semantic cache in the same file family is already keyed by `apiKeyId`; the idempotency layer is the odd one out.  ## Steps to Reproduce 1. API key A sends a non-streaming request with `Idempotency-Key: X` and body B. 2. Within the window (default 5s), API key B sends the same header value, model and body.  ## Expected Behavior Key B's request is executed (or at least attributed) independently — a replay should only be served to the caller that produced it.  ## Actual Behavior Key B receives key A's cached response with `X-OmniRoute-Idempotent: true`; nothing is recorded for key B.  ## Notes Exploiting this in practice needs the same header value and a byte-identical body, so severity is low. The header value is client-chosen, so callers that use a fixed string as `X-Request-Id` are the realistic case. A one-line fix (add the API key id to the composed key; retries from the same key still replay) with a regression test is ready and I will open a PR against `release/v3.8.51`.  Observed on `release/v3.8.51` 
  **Post-Mortem & Fix Analysis**:
  > Fixed by #15128, merged into `release/v3.8.51`. The composed idempotency key now includes the calling API key id (`open-sse/handlers/chatCore/idempotency.ts:113`: `rawKey|apiKeyId|provider|model|digest`). Retries from the same key still replay, and a different API key no longer receives another caller's cached response. It will ship with v3.8.51. Thanks for the report and the fix.

- **Issue #15110** (2026-09-30): **fix: stale #14003 vision-bridge regression test fixture contradicts the #14117 model spec**
  *Symptoms*: ## Summary  `tests/unit/guardrails/vision-bridge-bare-id-unknown-vision-14003.test.ts` has 2 failing tests on `release/v3.8.52`. They are **not a production bug** — the test fixture asserts a capability lookup result that a *sibling* commit made false ~2 hours later. The production behavior is correct; the test's premise is stale.  Replaces the (incorrect) diagnosis in #15105.  ## Root cause: two commits that contradict each other  | Commit | Time (2026-09-29) | What it did | | --- | --- | --- | | `143c8a19da` — #14844 | 05:56 | Added the regression test + the `bareIdUnknownVision` gate in `src/lib/guardrails/visionBridge.ts` | | `ebc59f0438` — #14117 | 07:52 | Added `kimi-for-coding` as an **alias of a vision-capable spec** |  `src/shared/constants/modelSpecs.ts:545-559` (from #14117):  ```ts // #14003: Kimi Coding's stable wire ids `kimi-for-coding` and // `kimi-for-coding-highspeed` both resolve to Kimi K2.8 Preview, which // supports vision, tools, and thinking. ... "kimi-k2.8-preview": {   ...   supportsVision: true,   aliases: ["kimi-for-coding", "kimi-for-coding-highspeed"], }, ```  The test file's docblock (lines 6-10) still claims the opposite:  > `kimi-for-coding` has no MODEL_SPECS entry (the Kimi Coding registry deliberately sets no `supportsVision`), so `getResolvedModelCapabilities("kimi-for-coding").supportsVision` resolves to `null` (unknown)  That is now false — #14117 made it resolve to `true`.  ## Resulting failure path  With `supportsVision === true`, `pre
  **Post-Mortem & Fix Analysis**:
  > Your diagnosis was right: #14117 aliased kimi-for-coding to a vision-capable spec (src/shared/constants/modelSpecs.ts:545-559), so preCall short-circuits at the native-vision gate (src/lib/guardrails/visionBridge.ts:315-323) before the #14003 gate is reached. This is already resolved on release/v3.8.52: the fixture now uses deepseek-coder-6.7b / llamagate/deepseek-coder-6.7b, which have no spec and no registry vision flag, and a VB-14003-FIXTURE precondition test pins supportsVision === null so a future spec change fails loudly instead of turning the cases into no-ops. It landed in commit c1021b5a6c (commit c1021b5a6c on release/v3.8.52, bundled into the squash of #15090). Closing as fixed; it ships with the next release.

- **Issue #15029** (2026-09-29): **fix(api): TypeError crash on /v1/messages anonymous-fallback path: 'Cannot read private member #state'**
  *Symptoms*: ## Summary  `POST /v1/messages?beta=true` crashes with a 500 when a request falls through to the anonymous path (`REQUIRE_API_KEY=false`, no valid bearer, zero providers configured).  ## Repro  1. Fresh install from source at commit `a13e82d` (v3.8.51), `npm install`, `npm run dev` 2. No providers configured (`omniroute providers list` → "No providers configured") 3. `omniroute launch --profile <name> -p "<any prompt>"` (Claude Code client), or any `POST /v1/messages?beta=true` with an invalid/missing bearer  ## Observed  Server log:  ``` [clientApiPolicy] invalid bearer presented to /api/v1/messages but REQUIRE_API_KEY=false — falling through to anonymous (key_id=key_auth) ⨯ TypeError: Cannot read private member #state from an object whose class did not declare it     at withDeadlineSignal (open-sse/utils/earlyStreamKeepalive.ts:341:22)     at deadlineAdmittedHandler (src/app/api/v1/messages/route.ts:100:46)   339 |   const token = `dl-${Date.now().toString(36)}-${(deadlineTokenSeq += 1)}`;   340 |   headers.set(DEADLINE_TOKEN_HEADER, token); > 341 |   const wrappedReq = new Request(request, { signal: combined, headers });       |                      ^   342 |   deadlineControllers.set(combined, deadlineController);   343 |   deadlineTokenByController.set(deadlineController, token);  POST /v1/messages?beta=true 500 in 43ms ```  Client-side: the CLI-launched Claude Code process just hangs (no output, exits only on external timeout) instead of surfacing this error — likely re
  **Post-Mortem & Fix Analysis**:
  > Broader/more severe than originally filed: this crash is **not** specific to the anonymous-fallback path. Reproduced repeatedly with a freshly-created, properly-scoped API key (\`POST /api/api-keys\` with \`scopes: ["chat"]\`) passed as \`ANTHROPIC_AUTH_TOKEN\` via \`omniroute launch --token ...\` — server logs still show \`invalid bearer presented ... falling through to anonymous\` for that key, and the identical \`withDeadlineSignal\` TypeError fires on every single \`POST /v1/messages\` call in the log (21/21 in one session), independent of bearer validity.  So there are two stacked problems here: 1. A freshly-minted \`POST /api/api-keys\` key (chat scope, all-model access) is not being recognized as valid by whatever checks the bearer on \`/v1/messages\` — worth its own investigation (key propagation delay? format mismatch? scope requirement not met?). 2. Even setting that aside, \`withDeadlineSignal\` crashes unconditionally on every \`/v1/messages\` request on this build — meanin
  > Confirmed and already fixed. The `withDeadlineSignal` crash was introduced by #14808 and fixed by PR #14886 (`fix(sse): build deadline wrap field-by-field so it survives Next's request proxy`, merged 2026-09-28) -- it stopped passing the inbound (Next.js App Router proxied) `Request` into `new Request(request, ...)` and now rebuilds it field-by-field, which is exactly the private-`#state` access you hit. Please retest on the current tip.  On your point (1) -- a freshly-minted `POST /api/api-keys` key still falling through to anonymous on `/v1/messages` -- that looks like a separate bug from this crash. If it still reproduces after picking up the #14886 fix, could you file it as its own issue with the key's scopes and the exact `clientApiPolicy` log line? Easier to track independently from this crash.
  > Found and verified the fix.  ## Root cause  \`withDeadlineSignal()\` in \`open-sse/utils/earlyStreamKeepalive.ts\` (line 341) builds the wrapped request with the copy-constructor form:  ```ts const wrappedReq = new Request(request, { signal: combined, headers }); ```  \`request\` here is a Next.js \`NextRequest\` (App Router route handler), not a plain undici \`Request\`. The copy-constructor path reads body-internal state off the passed-in object; since \`NextRequest\` doesn't share undici's internal \`Request\`/\`Body\` class, that read fails the private-field brand check — exactly the observed \`TypeError: Cannot read private member #state from an object whose class did not declare it\`. This fires unconditionally on every \`/v1/messages\` call, not just the anonymous-fallback path.  ## Fix  Construct from \`request.url\` with explicit fields instead of the copy-constructor form:  ```ts const wrappedReq = new Request(request.url, {   method: request.method,   headers,   body: reques

- **Issue #15026** (2026-09-29): **fix(providers): Cannot hide models on provider page due to hardcoded modality: chat and UI selector mismatch**
  *Symptoms*: ## Bug: Cannot hide models on provider page (modality mismatch & UI selector bug)  ### Description On provider details pages (e.g. `/dashboard/providers/codex`), clicking the "Hide" toggle on models appears to succeed (returns 200 OK), but the UI immediately shows the model as visible again, and the model is not properly hidden.  ### Root Cause Analysis  Tracing the execution flow in `diegosouzapw/omniroute:next`:  1. **Frontend hardcodes `"modality": "chat"`:**    On `/dashboard/providers/[id]`, the hide toggle handler `handleToggleModelHidden` issues:    ```js    PATCH /api/provider-models?provider=${provider}&modelId=${modelId}    Body: { "isHidden": true, "modality": "chat" }    ```  2. **Backend only sets `hiddenModalities[modality]`, omitting `isHidden`:**    In the `PATCH /api/provider-models` handler (`modelCompatOverrides` updater):    ```js    if ("isHidden" in c) {      let a = typeof c.modality === "string" && c.modality ? c.modality : null;      if (a) {        let b = { ...(f.hiddenModalities || {}) };        null === c.isHidden ? delete b[a] : (b[a] = !!c.isHidden);        f.hiddenModalities = b;      } else {        f.isHidden = !!c.isHidden;      }    }    ```    Because `modality: "chat"` is sent in the body, it only records `f.hiddenModalities = { chat: true }`. Top-level `f.isHidden` remains `undefined` (or unchanged).  3. **Frontend UI selector `B(e)` only reads `e.isHidden`:**    In module `27522`, the helper that determines if a model is hidden:    ```j
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed trace! This is already fixed -- PR #14349 (`fix(models): honor the chat-scoped hidden flag in the provider dashboard`, merged 2026-09-24) added a shared `isHiddenForModality()` helper (`src/shared/utils/modelVisibility.ts`) and wired the dashboard's hidden check (`providerPageHelpers.ts`) to read `hiddenModalities.chat` instead of only the legacy top-level `isHidden` flag -- exactly the mismatch you traced. Closing as already fixed; please re-test on the current `release/v3.8.51` tip and reopen if it still reproduces.

- **Issue #15022** (2026-09-29): **fix(backend): Migration 163 renumber skips radar_feed_cache.generated_at on installs upgraded from v3.8.50**
  *Symptoms*: ## Summary  Upgrading from **v3.8.50** (npm) to current `release/v3.8.51` leaves `radar_feed_cache.generated_at` missing. On disk, migration **163** is now `163_radar_feed_cache_generated_at.sql`. But v3.8.50 shipped `model_capabilities` as version 163 (it's now `169_model_capabilities.sql`), so the runner records 163 as already applied and never runs the ALTER.  Startup logs it on every boot:  ``` [Migration] ⚠️ CRITICAL: 1 migration version(s) have been renumbered! Version 163: applied as "model_capabilities" but disk has "radar_feed_cache_generated_at" … version-only tracking will skip these (version already applied) ```  Resulting schema after the upgrade:  ``` sqlite> select name from pragma_table_info('radar_feed_cache') where name='generated_at'; (no rows) sqlite> select version,name from _omniroute_migrations where version in (163,169); 163|model_capabilities 169|model_capabilities ```  `src/lib/db/radar.ts` inserts `generated_at` into `radar_feed_cache`, so feed-cache writes on these installs fail with `no such column: generated_at`.  ## Expected  Upgrading from a published release applies every schema change. Options: a follow-up migration that adds the column when it's missing (idempotent via `pragma_table_info`), or name-aware reconciliation for renumbered versions.  ## Workaround  ```sql ALTER TABLE radar_feed_cache ADD COLUMN generated_at TEXT DEFAULT NULL; ```  Environment: macOS arm64, Node 22.22.3, upgraded npm 3.8.50 → `release/v3.8.51` @ d4bf564a39. 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed repro — the `[Migration] CRITICAL: ... renumbered` log and the missing `radar_feed_cache.generated_at` column exactly match a known collision: npm `omniroute@3.8.50` was built from `main` at `dea6bb8` where `model_capabilities` still lived at slot 163, and `70f5d4cbf` later moved it to 169 so `163_radar_feed_cache_generated_at.sql` could keep the slot. A DB first migrated by that npm build keeps its old `163=model_capabilities` ledger row, which then shadows the real `163_radar_feed_cache_generated_at` migration under version-only tracking — exactly as you diagnosed.  This is already fixed on `release/v3.8.51` by #14881 (merged shortly after this issue was filed): it adds a `RENAMED_MIGRATION_COMPATIBILITY` entry (`163/model_capabilities -> 169/model_capabilities`) that `reconcileRenumberedMigrations()` uses to rehome the stale ledger row before computing pending migrations, freeing slot 163 so the real migration runs and the column gets added. It ships with a f

- **Issue #14990** (2026-09-29): **fix(resilience): hot-path rate-limit/cooldown writes bust the entire /v1/models catalog cache — missed skipModelCatalog on rateLimit.ts call sites**
  *Symptoms*: Title: [perf] Hot-path rate-limit/cooldown writes bust the entire `/v1/models` catalog cache — missed `skipModelCatalog` on `rateLimit.ts` call sites  ## Summary  #13389 introduced `invalidateDbCache(scope, id, { skipModelCatalog })` so writes that only touch routing/health connection fields (`rate_limited_until`, `test_status`, `backoff_level`, `last_error*`, `error_code`) bust the connections read cache **without** dropping the whole `/v1/models` response cache. The flag was applied to `resetConnectionBackoff` (`src/lib/db/providers.ts:1151`) but the same class of write in `src/lib/db/providers/rateLimit.ts` — which runs on the per-request chat hot path — still calls `invalidateDbCache("connections")` without it.  Every provider 429/cooldown mark therefore bumps `modelCatalogCacheVersion`, which makes `dropCatalogCacheIfStateChanged()` clear **all** cached catalog payloads. The next `GET /v1/models` (or a stale-while-revalidate refresh) then runs the overwhelmingly-synchronous unified catalog builder — measured ~49s on a production-class host (#6408) — which pins the single-threaded App Router event loop and stalls **every** route, including `/api/health/ping` (the MaintenanceBanner probe) and `/healthz`.  ## User impact  - Under rate-limit-heavy traffic (many 429s), the dashboard periodically shows **"Server is unreachable. Reconnecting..."** even though the server is alive — each catalog cache bust converts the next models request into a ~50s event-loop stall. - All other
  **Post-Mortem & Fix Analysis**:
  > ## Resumo da investigação (evidência complementar, pt-BR)  Investigação de reliability/performance executada sobre o SHA `a58000c7` (`release/v3.8.51`) + reprodução local autorizada numa instância systemd (`omniroute` CLI v3.8.50, Next.js 16.3.1, Node v24.16.0, Linux arm64, `~/.omniroute`).  ### Como o banner dispara (contrato exato)  `src/shared/components/MaintenanceBanner.tsx:22-63` (montado em `DashboardLayout.tsx:121`):  - Poll `fetch("/api/health/ping")` a cada 10 s, `AbortController` de **8 s**. - `res.ok` → banner oculto. `!res.ok` (4xx/5xx) → após 2 falhas: mensagem "server issues". `fetch` lançando exceção (rede/timeout/abort) → após 2 falhas: **"Server is unreachable. Reconnecting..."** (`i18n key maintenanceServerUnreachable`, `src/i18n/messages/en.json:74`). - Endpoint: `src/app/api/health/ping/route.ts:21` → `pingDb()` → `SELECT 1` síncrono (`src/lib/db/core.ts:1438`).  ### Reprodução ao vivo (medidas `curl`, localhost)  - `GET /api/health/ping`: p50 ≈ 4–5 ms em regime no
  > @diegosouzapw — poderia validar esta análise e dizer se está de acordo?  Resumo do pedido de revisão:  1. **O defeito**: os 3 call sites de `src/lib/db/providers/rateLimit.ts` (`:47`, `:239`, `:304`) chamam `invalidateDbCache("connections")` sem `{ skipModelCatalog: true }`, embora escrevam apenas campos de roteamento (`rate_limited_until`, `test_status`, `backoff_level`, `last_error*`) que o builder do `/v1/models` não lê — mesma classe de write que o #13389 protegeu em `providers.ts:1151` (`resetConnectionBackoff`). 2. **O impacto**: cada marca de 429/cooldown derruba todo o cache do catálogo → próximo `GET /v1/models` roda o builder síncrono (~49 s) → event loop travado → `/api/health/ping` > 8 s → banner "Server is unreachable. Reconnecting..." (reproduzido em produção local: ~50 s de indisponibilidade). 3. **A correção proposta**: adicionar `{ skipModelCatalog: true }` nesses call sites (e revisar `codexAccountState.ts:117,207,308`, que escreve apenas chaves de cooldown codex em `
  > Confirmado no código: `src/lib/db/providers/rateLimit.ts:47,239,304` chamam `invalidateDbCache("connections")` sem `{ skipModelCatalog: true }`, ao contrário de `resetConnectionBackoff` (`src/lib/db/providers.ts:1151`), que já usa a flag desde a #13389. `readCache.ts:294-312` confirma que `skipModelCatalog` faz o early-return antes de incrementar `modelCatalogCacheVersion` — sua ausência nesses call sites derruba todo o cache do `/v1/models` a cada write de rate-limit/cooldown, exatamente como descrito. Concordo com a leitura e com a correção proposta (adicionar `{ skipModelCatalog: true }` nesses três call sites, e também revisar `codexAccountState.ts:117,207,308`, que tem o mesmo padrão). Encaminhando para o pipeline `/triage-fix-bugs` para implementação com testes de regressão.

- **Issue #14985** (2026-09-29): **fix(providers): global Codex Fast defaults omit GPT-6 models**
  *Symptoms*: ## Problem  On the current default branch `release/v3.8.51` at `a58000c7685f4091c7a6fd8ddf3ebce7d2ec67c3`, enabling global Codex Fast with the built-in model selection does not inject `service_tier: "priority"` for GPT-6 Astra, Sol, or Luna.  #14677 added native GPT-6 Sol/Luna catalog entries and the 2.5x Fast cost multiplier, but `CODEX_FAST_TIER_DEFAULT_SUPPORTED_MODELS` in `src/lib/providers/codexFastTier.ts` still contains only GPT-5.6 Sol/Terra/Luna and GPT-5.5.  The same list is consumed by the VS Code service-tier model expansion, so GPT-6 entries also lack the generated Fast/Flex choices.  ## Minimal reproduction  Run this with the repository's TypeScript runner:  ```ts import { applyCodexGlobalFastServiceTier } from "./src/lib/providers/codexFastTier.ts";  const body: Record<string, unknown> = {}; const result = applyCodexGlobalFastServiceTier(   "codex",   { providerSpecificData: {} },   { codexServiceTier: { enabled: true, tier: "priority" } },   { model: "cx/gpt-6-sol", body } );  console.log(body.service_tier); // undefined console.log(result.providerSpecificData); // {} ```  The same call with `gpt-5.6-sol` injects `priority`.  ## Expected behavior  The built-in selection should include the GPT-6 models already registered and recognized by the Fast cost calculation. Explicit custom `supportedModels` lists and client-supplied tiers should continue to take precedence.  ## Scope  This is an automatic-default/model-selection gap, not a claim that an explicit `servic
  **Post-Mortem & Fix Analysis**:
  > Implemented in [PR #14986](https://github.com/diegosouzapw/OmniRoute/pull/14986), now ready for review at `c0a0e783f` against `release/v3.8.51`.  The fix adds the three GPT-6 families to the shared built-in selection, with regressions for global injection, explicit-tier/custom-list precedence, and VS Code variant expansion. The updated regressions fail on the base; the related suites pass **35/35** with the fix. Full-suite and inherited gate caveats are documented in the PR.  This addresses automatic parameter injection/model selection. Upstream Fast entitlement and actual latency remain separate. 
  > Verified against current code: `CODEX_FAST_TIER_DEFAULT_SUPPORTED_MODELS` in `src/lib/providers/codexFastTier.ts:16-20` still only lists `gpt-5.6-sol/terra/luna` and `gpt-5.5`, so the GPT-6 Astra/Sol/Luna entries from #14677 are correctly excluded from the built-in Fast selection today. This is tracked in PR #14986, which is open against `release/v3.8.51` but not yet merged — keeping this issue open until it lands.
  > Merged: #14986 landed in `release/v3.8.51` on 2026-09-29 at merge commit `b01f5feb4c7e32337ad173b0039765860104824f` (PR head `c0a0e783fb2f0774fc608ede03355814af4e21fe`). This closes the upstream issue; a release tag or downstream upgrade is a separate step. https://github.com/diegosouzapw/OmniRoute/pull/14986 

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

### Incident Patch 1: `79edf940` (2026-09-30)
**Commit Message**: fix(release): let an Electron dispatch build the ref it is dispatched on again (#15165)

Post-release v3.8.51 fix on main (owner-approved): Electron dispatch builds github.ref again (restores #12032), so the v3.8.51 desktop assets can be rebuilt from main. Workflow tests green, zizmor ratchet OK.

(cherry picked from commit fc5e2bccd4f70fecf5aab94dfb8136c74ab5a21b)

**File**: `.github/workflows/electron-release.yml` (modified, +0/-8)
```diff
@@ -85,9 +85,6 @@ jobs:
       - uses: actions/checkout@v7
         with:
           persist-credentials: false
-          # workflow_dispatch: build the tag being (re)built, not the dispatching branch. On a
-          # tag push this resolves to the same commit.
-          ref: ${{ needs.validate.outputs.version }}
       - name: Setup Node
         uses: actions/setup-node@v7
         with:
@@ -173,9 +170,6 @@ jobs:
       - uses: actions/checkout@v7
         with:
           persist-credentials: false
-          # workflow_dispatch: build the tag being (re)built, not the dispatching branch. On a
-          # tag push this resolves to the same commit.
-          ref: ${{ needs.validate.outputs.version }}
       - name: Setup Node
         uses: actions/setup-node@v7
         with:
@@ -378,8 +372,6 @@ jobs:
         with:
           persist-credentials: false
           fetch-depth: 0
-          # Source archives + SBOM come from the tag being released, not the dispatching branch.
-          ref: ${{ needs.validate.outputs.version }}
 
       # `merge-multiple` is deliberately OFF. It resolves same-name collisions by ARRIVAL
       # ORDER, and the two macOS jobs each emit their own `latest-mac.yml` listing only their
```

---

### Incident Patch 2: `cc187bae` (2026-09-30)
**Commit Message**: fix(electron): resync electron/package-lock.json with its package.json (#15157)

Post-release v3.8.51 fix on main: electron lockfile resynced with its package.json (additions only; npm ci --dry-run passes on npm 10.9.8 and 11.15.0). Restores the Windows/Linux desktop builds.

(cherry picked from commit 21f1573d7882aa4a20661d5f0f614480334434e3)

**File**: `electron/package-lock.json` (modified, +195/-0)
```diff
@@ -297,6 +297,45 @@
         "url": "https://github.com/sponsors/isaacs"
       }
     },
+    "node_modules/@electron/windows-sign": {
+      "version": "1.2.2",
+      "resolved": "https://registry.npmjs.org/@electron/windows-sign/-/windows-sign-1.2.2.tgz",
+      "integrity": "sha512-dfZeox66AvdPtb2lD8OsIIQh12Tp0GNCRUDfBHIKGpbmopZto2/A8nSpYYLoedPIHpqkeblZ/k8OV0Gy7PYuyQ==",
+      "dev": true,
+      "license": "BSD-2-Clause",
+      "optional": true,
+      "peer": true,
+      "dependencies": {
+        "cross-dirname": "^0.1.0",
+        "debug": "^4.3.4",
+        "fs-extra": "^11.1.1",
+        "minimist": "^1.2.8",
+        "postject": "^1.0.0-alpha.6"
+      },
+      "bin": {
+        "electron-windows-sign": "bin/electron-windows-sign.js"
+      },
+      "engines": {
+        "node": ">=14.14"
+      }
+    },
+    "node_modules/@electron/windows-sign/node_modules/fs-extra": {
+      "version": "11.4.1",
+      "resolved": "https://registry.npmjs.org/fs-extra/-/fs-extra-11.4.1.tgz",
+      "integrity": "sha512-KYAb4c9BJQI6QqGKthV68OHe0badztdXJWKo0WtBA9IuCFPTKvE5ZdUBglP833aMjhaSPNO4A5j/EkzZtGlKjA==",
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "peer": true,
+      "dependencies": {
+        "graceful-fs": "^4.2.0",
+        "jsonfile": "^6.0.1",
+        "universalify": "^2.0.0"
+      },
+      "engines": {
+        "node": ">=14.14"
+      }
+    },
     "node_modules/@isaacs/fs-minipass": {
       "version": "4.0.1",
       "resolved": "https://registry.npmjs.org/@isaacs/fs-minipass/-/fs-minipass-4.0.1.tgz",
@@ -1091,6 +1130,15 @@
       "dev": true,
       "license": "MIT"
     },
+    "node_modules/cross-dirname": {
+      "version": "0.1.0",
+      "resolved": "https://registry.npmjs.org/cross-dirname/-/cross-dirname-0.1.0.tgz",
+      "integrity": "sha512-+R08/oI0nl3vfPcqftZRpytksBXDzOUveBq/NBVx0sUp1axwzPQrKinNx5yd5sxPu8j1wIy8AfnVQ+5eFdha6Q==",
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "peer": true
+    },
     "node_modules/cross-spawn": {
       "version": "7.0.6",
       "resolved": "https://registry.npmjs.org/cross-spawn/-/cross-spawn-7.0.6.tgz",
@@ -1411,6 +1459,19 @@
         "node": ">=14.0.0"
       }
     },
+    "node_modules/electron-builder-squirrel-windows": {
+      "version": "26.15.3",
+      "resolved": "https://registry.npmjs.org/electron-builder-squirrel-windows/-/electron-builder-squirrel-windows-26.15.3.tgz",
+      "integrity": "sha512-Jc19XPV9y9+2bAdZPkXuVNGNIEFBq9poHC61l8Kv6FdK7DRG3+Ic0rerC0DXOaeHNz8yW0fg/JnF8GQROOF5MA==",
+      "dev": true,
+      "license": "MIT",
+      "peer": true,
+      "dependencies": {
+        "app-builder-lib": "26.15.3",
+        "builder-util": "26.15.3",
+        "electron-winstaller": "5.4.0"
+      }
+    },
     "node_modules/electron-publish": {
       "version": "26.15.3",
       "resolved": "https://registry.npmjs.org/electron-publish/-/electron-publish-26.15.3.tgz",
@@ -1445,6 +1506,66 @@
         "tiny-typed-emitter": "^2.1.0"
       }
     },
+    "node_modules/electron-winstaller": {
+      "version": "5.4.0",
+      "resolved": "https://registry.npmjs.org/electron-winstaller/-/electron-winstaller-5.4.0.tgz",
+      "integrity": "sha512-bO3y10YikuUwUuDUQRM4KfwNkKhnpVO7IPdbsrejwN9/AABJzzTQ4GeHwyzNSrVO+tEH3/Np255a3sVZpZDjvg==",
+      "dev": true,
+      "hasInstallScript": true,
+      "license": "MIT",
+      "peer": true,
+      "dependencies": {
+        "@electron/asar": "^3.2.1",
+        "debug": "^4.1.1",
+        "fs-extra": "^7.0.1",
+        "lodash": "^4.17.21",
+        "temp": "^0.9.0"
+      },
+      "engines": {
+        "node": ">=8.0.0"
+      },
+      "optionalDependencies": {
+        "@electron/windows-sign": "^1.1.2"
+      }
+    },
+    "node_modules/electron-winstaller/node_modules/fs-extra": {
+      "version": "7.0.1",
+      "resolved": "https://registry.npmjs.org/fs-extra/-/fs-extra-7.0.1.tgz",
+      "integrity": "sha512-YJDaCJZEnBmcbw13fvdAM9AwNO
```

---

### Incident Patch 3: `fc5e2bcc` (2026-09-30)
**Commit Message**: fix(release): let an Electron dispatch build the ref it is dispatched on again (#15165)

Post-release v3.8.51 fix on main (owner-approved): Electron dispatch builds github.ref again (restores #12032), so the v3.8.51 desktop assets can be rebuilt from main. Workflow tests green, zizmor ratchet OK.

**File**: `.github/workflows/electron-release.yml` (modified, +0/-8)
```diff
@@ -85,9 +85,6 @@ jobs:
       - uses: actions/checkout@v7
         with:
           persist-credentials: false
-          # workflow_dispatch: build the tag being (re)built, not the dispatching branch. On a
-          # tag push this resolves to the same commit.
-          ref: ${{ needs.validate.outputs.version }}
       - name: Setup Node
         uses: actions/setup-node@v7
         with:
@@ -173,9 +170,6 @@ jobs:
       - uses: actions/checkout@v7
         with:
           persist-credentials: false
-          # workflow_dispatch: build the tag being (re)built, not the dispatching branch. On a
-          # tag push this resolves to the same commit.
-          ref: ${{ needs.validate.outputs.version }}
       - name: Setup Node
         uses: actions/setup-node@v7
         with:
@@ -378,8 +372,6 @@ jobs:
         with:
           persist-credentials: false
           fetch-depth: 0
-          # Source archives + SBOM come from the tag being released, not the dispatching branch.
-          ref: ${{ needs.validate.outputs.version }}
 
       # `merge-multiple` is deliberately OFF. It resolves same-name collisions by ARRIVAL
       # ORDER, and the two macOS jobs each emit their own `latest-mac.yml` listing only their
```

---

### Incident Patch 4: `21f1573d` (2026-09-30)
**Commit Message**: fix(electron): resync electron/package-lock.json with its package.json (#15157)

Post-release v3.8.51 fix on main: electron lockfile resynced with its package.json (additions only; npm ci --dry-run passes on npm 10.9.8 and 11.15.0). Restores the Windows/Linux desktop builds.

**File**: `electron/package-lock.json` (modified, +195/-0)
```diff
@@ -297,6 +297,45 @@
         "url": "https://github.com/sponsors/isaacs"
       }
     },
+    "node_modules/@electron/windows-sign": {
+      "version": "1.2.2",
+      "resolved": "https://registry.npmjs.org/@electron/windows-sign/-/windows-sign-1.2.2.tgz",
+      "integrity": "sha512-dfZeox66AvdPtb2lD8OsIIQh12Tp0GNCRUDfBHIKGpbmopZto2/A8nSpYYLoedPIHpqkeblZ/k8OV0Gy7PYuyQ==",
+      "dev": true,
+      "license": "BSD-2-Clause",
+      "optional": true,
+      "peer": true,
+      "dependencies": {
+        "cross-dirname": "^0.1.0",
+        "debug": "^4.3.4",
+        "fs-extra": "^11.1.1",
+        "minimist": "^1.2.8",
+        "postject": "^1.0.0-alpha.6"
+      },
+      "bin": {
+        "electron-windows-sign": "bin/electron-windows-sign.js"
+      },
+      "engines": {
+        "node": ">=14.14"
+      }
+    },
+    "node_modules/@electron/windows-sign/node_modules/fs-extra": {
+      "version": "11.4.1",
+      "resolved": "https://registry.npmjs.org/fs-extra/-/fs-extra-11.4.1.tgz",
+      "integrity": "sha512-KYAb4c9BJQI6QqGKthV68OHe0badztdXJWKo0WtBA9IuCFPTKvE5ZdUBglP833aMjhaSPNO4A5j/EkzZtGlKjA==",
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "peer": true,
+      "dependencies": {
+        "graceful-fs": "^4.2.0",
+        "jsonfile": "^6.0.1",
+        "universalify": "^2.0.0"
+      },
+      "engines": {
+        "node": ">=14.14"
+      }
+    },
     "node_modules/@isaacs/fs-minipass": {
       "version": "4.0.1",
       "resolved": "https://registry.npmjs.org/@isaacs/fs-minipass/-/fs-minipass-4.0.1.tgz",
@@ -1091,6 +1130,15 @@
       "dev": true,
       "license": "MIT"
     },
+    "node_modules/cross-dirname": {
+      "version": "0.1.0",
+      "resolved": "https://registry.npmjs.org/cross-dirname/-/cross-dirname-0.1.0.tgz",
+      "integrity": "sha512-+R08/oI0nl3vfPcqftZRpytksBXDzOUveBq/NBVx0sUp1axwzPQrKinNx5yd5sxPu8j1wIy8AfnVQ+5eFdha6Q==",
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "peer": true
+    },
     "node_modules/cross-spawn": {
       "version": "7.0.6",
       "resolved": "https://registry.npmjs.org/cross-spawn/-/cross-spawn-7.0.6.tgz",
@@ -1411,6 +1459,19 @@
         "node": ">=14.0.0"
       }
     },
+    "node_modules/electron-builder-squirrel-windows": {
+      "version": "26.15.3",
+      "resolved": "https://registry.npmjs.org/electron-builder-squirrel-windows/-/electron-builder-squirrel-windows-26.15.3.tgz",
+      "integrity": "sha512-Jc19XPV9y9+2bAdZPkXuVNGNIEFBq9poHC61l8Kv6FdK7DRG3+Ic0rerC0DXOaeHNz8yW0fg/JnF8GQROOF5MA==",
+      "dev": true,
+      "license": "MIT",
+      "peer": true,
+      "dependencies": {
+        "app-builder-lib": "26.15.3",
+        "builder-util": "26.15.3",
+        "electron-winstaller": "5.4.0"
+      }
+    },
     "node_modules/electron-publish": {
       "version": "26.15.3",
       "resolved": "https://registry.npmjs.org/electron-publish/-/electron-publish-26.15.3.tgz",
@@ -1445,6 +1506,66 @@
         "tiny-typed-emitter": "^2.1.0"
       }
     },
+    "node_modules/electron-winstaller": {
+      "version": "5.4.0",
+      "resolved": "https://registry.npmjs.org/electron-winstaller/-/electron-winstaller-5.4.0.tgz",
+      "integrity": "sha512-bO3y10YikuUwUuDUQRM4KfwNkKhnpVO7IPdbsrejwN9/AABJzzTQ4GeHwyzNSrVO+tEH3/Np255a3sVZpZDjvg==",
+      "dev": true,
+      "hasInstallScript": true,
+      "license": "MIT",
+      "peer": true,
+      "dependencies": {
+        "@electron/asar": "^3.2.1",
+        "debug": "^4.1.1",
+        "fs-extra": "^7.0.1",
+        "lodash": "^4.17.21",
+        "temp": "^0.9.0"
+      },
+      "engines": {
+        "node": ">=8.0.0"
+      },
+      "optionalDependencies": {
+        "@electron/windows-sign": "^1.1.2"
+      }
+    },
+    "node_modules/electron-winstaller/node_modules/fs-extra": {
+      "version": "7.0.1",
+      "resolved": "https://registry.npmjs.org/fs-extra/-/fs-extra-7.0.1.tgz",
+      "integrity": "sha512-YJDaCJZEnBmcbw13fvdAM9AwNO
```

---

### Incident Patch 5: `a1a2dce1` (2026-09-29)
**Commit Message**: fix(security): require admin for API-key routes and reserve login slots during password checks (#15146)

* fix(security): require admin for API-key routes and reserve login slots during password checks (GHSA-35gq-52m5-wgw2, GHSA-h872-cmwf-8q7v)

- inferRequiredScope: /api/keys mutations and /api/keys/:id/reveal need an admin
  access token, so a write token can no longer mint a manage-scoped key and
  from it an admin token.
- loginGuard: beginLoginAttempt/endLoginAttempt reserve a failure slot before the
  awaited bcrypt compare, so a concurrent burst cannot all pass the check against
  the same stale count. Used by /api/cli/connect and /api/auth/login.

* test(authz): use a real write route for the write-token case and pin /api/keys as admin-only

**File**: `src/app/api/auth/login/route.ts` (modified, +15/-2)
```diff
@@ -12,7 +12,12 @@ import {
 import { isFeatureFlagEnabled } from "@/shared/utils/featureFlags";
 import { loginSchema } from "@/shared/validation/schemas";
 import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
-import { checkLoginGuard, clearLoginAttempts, recordLoginFailure } from "@/server/auth/loginGuard";
+import {
+  beginLoginAttempt,
+  clearLoginAttempts,
+  endLoginAttempt,
+  recordLoginFailure,
+} from "@/server/auth/loginGuard";
 import { AUTHZ_HEADER_TRUSTED_PEER_IP } from "@/server/authz/headers";
 import {
   getDashboardJwtSecret,
@@ -37,6 +42,9 @@ export const authRouteInternals = {
 
 export async function POST(request: NextRequest) {
   const auditContext = getAuditRequestContext(request);
+  // Slot reserved by the guard while the password is verified; released on every exit.
+  let heldSlotKey: string | null | undefined;
+  let holdsSlot = false;
 
   try {
     // Fail-fast if JWT_SECRET is not configured
@@ -113,7 +121,7 @@ export async function POST(request: NextRequest) {
 
     const bruteForceEnabled = settings.bruteForceProtection !== false;
 
-    const guardCheck = checkLoginGuard(lockoutKey, { enabled: bruteForceEnabled });
+    const guardCheck = beginLoginAttempt(lockoutKey, { enabled: bruteForceEnabled });
     if (!guardCheck.allowed) {
       logAuditEvent({
         action: "auth.login.locked",
@@ -134,6 +142,9 @@ export async function POST(request: NextRequest) {
       );
     }
 
+    holdsSlot = true;
+    heldSlotKey = lockoutKey;
+
     const passwordState = await ensurePersistentManagementPasswordHash({
       settings,
       source: "auth.login",
@@ -282,5 +293,7 @@ export async function POST(request: NextRequest) {
       },
     });
     return NextResponse.json({ error: "Internal server error" }, { status: 500 });
+  } finally {
+    if (holdsSlot) endLoginAttempt(heldSlotKey);
   }
 }
```

**File**: `src/app/api/cli/connect/route.ts` (modified, +16/-2)
```diff
@@ -9,7 +9,12 @@ import {
   verifyManagementPassword,
 } from "@/lib/auth/managementPassword";
 import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
-import { checkLoginGuard, clearLoginAttempts, recordLoginFailure } from "@/server/auth/loginGuard";
+import {
+  beginLoginAttempt,
+  clearLoginAttempts,
+  endLoginAttempt,
+  recordLoginFailure,
+} from "@/server/auth/loginGuard";
 import {
   getLoginLockoutKey,
   getLoginSourceScope,
@@ -41,6 +46,10 @@ const connectSchema = z.object({
 
 export async function POST(request: Request) {
   const auditContext = getAuditRequestContext(request);
+  // The guard reserves a failure slot while the password is being verified; release it on
+  // every exit so an aborted request cannot leak budget.
+  let heldSlotKey: string | null | undefined;
+  let holdsSlot = false;
 
   try {
     let rawBody: unknown;
@@ -64,7 +73,7 @@ export async function POST(request: Request) {
     // would hand out a fresh attempt budget on every request.
     const lockoutKey = getLoginLockoutKey(request, clientIp);
 
-    const guardCheck = checkLoginGuard(lockoutKey, { enabled: bruteForceEnabled });
+    const guardCheck = beginLoginAttempt(lockoutKey, { enabled: bruteForceEnabled });
     if (!guardCheck.allowed) {
       logAuditEvent({
         action: "cli.connect.locked",
@@ -87,6 +96,9 @@ export async function POST(request: Request) {
       );
     }
 
+    holdsSlot = true;
+    heldSlotKey = lockoutKey;
+
     const passwordState = await ensurePersistentManagementPasswordHash({
       settings,
       source: "cli.connect",
@@ -195,5 +207,7 @@ export async function POST(request: Request) {
   } catch (error) {
     console.error("[CLI] connect failed:", error);
     return NextResponse.json({ error: "Internal server error" }, { status: 500 });
+  } finally {
+    if (holdsSlot) endLoginAttempt(heldSlotKey);
   }
 }
```

**File**: `src/server/auth/loginGuard.ts` (modified, +37/-0)
```diff
@@ -110,12 +110,49 @@ export function recordLoginFailure(
   return { allowed: true };
 }
 
+// Password checks that have passed the guard but not yet reported a failure. `checkLoginGuard`
+// runs before an `await bcrypt` and `recordLoginFailure` after it, so a concurrent burst would
+// otherwise all pass the check against the same stale count. Each in-flight verification
+// reserves one slot of the failure budget until it resolves (GHSA-h872-cmwf-8q7v).
+const inFlight: Map<string, number> = new Map();
+
+/**
+ * Like `checkLoginGuard`, but also reserves a slot for the verification about to run. Callers
+ * that get `allowed: true` MUST call `endLoginAttempt` with the same key once it finishes.
+ */
+export function beginLoginAttempt(
+  rawIp: string | null | undefined,
+  options: { enabled: boolean }
+): GuardDecision {
+  const decision = checkLoginGuard(rawIp, options);
+  if (!decision.allowed || !options.enabled) return decision;
+  const key = clientKey(rawIp);
+  const state = attempts.get(key);
+  const now = nowMs();
+  const usedInWindow = state && now - state.firstAttemptAt <= WINDOW_MS ? state.count : 0;
+  const pending = inFlight.get(key) || 0;
+  // Only the attempts that could still fail count: a failure at index THRESHOLD locks.
+  if (usedInWindow + pending >= FAILURE_THRESHOLD) {
+    return { allowed: false, retryAfterSeconds: Math.ceil(LOCKOUT_MS / 1000) };
+  }
+  inFlight.set(key, pending + 1);
+  return { allowed: true };
+}
+
+export function endLoginAttempt(rawIp: string | null | undefined): void {
+  const key = clientKey(rawIp);
+  const pending = inFlight.get(key) || 0;
+  if (pending <= 1) inFlight.delete(key);
+  else inFlight.set(key, pending - 1);
+}
+
 export function clearLoginAttempts(rawIp: string | null | undefined): void {
   attempts.delete(clientKey(rawIp));
 }
 
 export function resetLoginGuardForTests(): void {
   attempts.clear();
+  inFlight.clear();
 }
 
 /** Test-only: current number of tracked IP entries. */
```

**File**: `src/server/authz/accessScopes.ts` (modified, +6/-0)
```diff
@@ -34,6 +34,10 @@ export const ADMIN_SCOPE_PREFIXES: readonly string[] = [
 export const ADMIN_MUTATION_PREFIXES: readonly string[] = [
   "/api/providers", // POST add provider / rotate key = admin; GET status = read
   "/api/cli-tools/apply", // writes config onto the host filesystem
+  // Creating/patching/regenerating an API key can attach the `manage` scope, and a
+  // manage-scoped key is full-access on every management route (including token mint),
+  // so a `write` token must not be able to reach it (GHSA-35gq-52m5-wgw2).
+  "/api/keys",
 ];
 
 const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
@@ -54,6 +58,8 @@ export function inferRequiredScope(method: string, path: string): AccessScope {
   const p = path || "/";
 
   if (matchesPrefix(p, ADMIN_SCOPE_PREFIXES)) return "admin";
+  // Revealing a key hands back its plaintext secret — never a `read` operation.
+  if (matchesPrefix(p, ["/api/keys"]) && /\/reveal\/?$/.test(p)) return "admin";
 
   const isMutation = !READ_METHODS.has(m);
   if (isMutation && matchesPrefix(p, ADMIN_MUTATION_PREFIXES)) return "admin";
```

**File**: `tests/unit/access-scopes-infer.test.ts` (modified, +11/-2)
```diff
@@ -9,10 +9,8 @@ test("read methods default to read", () => {
 });
 
 test("mutating methods default to write", () => {
-  assert.equal(inferRequiredScope("POST", "/api/keys"), "write");
   assert.equal(inferRequiredScope("PUT", "/api/config"), "write");
   assert.equal(inferRequiredScope("PATCH", "/api/combo/x"), "write");
-  assert.equal(inferRequiredScope("DELETE", "/api/keys/abc"), "write");
 });
 
 test("admin-prefix routes require admin for ANY method", () => {
@@ -46,3 +44,14 @@ test("prefix matching does not over-match unrelated paths", () => {
   // "/api/services" itself and its children are admin, but a lookalike is not
   assert.equal(inferRequiredScope("GET", "/api/services-catalog"), "read");
 });
+
+test("API-key management needs admin: a write token cannot mint a manage-scoped key (GHSA-35gq)", () => {
+  assert.equal(inferRequiredScope("POST", "/api/keys"), "admin");
+  assert.equal(inferRequiredScope("PATCH", "/api/keys/abc"), "admin");
+  assert.equal(inferRequiredScope("DELETE", "/api/keys/abc"), "admin");
+  assert.equal(inferRequiredScope("POST", "/api/keys/abc/regenerate"), "admin");
+  // listing stays readable, but the plaintext reveal is admin even though it is a GET
+  assert.equal(inferRequiredScope("GET", "/api/keys"), "read");
+  assert.equal(inferRequiredScope("GET", "/api/keys/abc/reveal"), "admin");
+  assert.equal(inferRequiredScope("GET", "/api/keys-catalog"), "read");
+});
```

---

### Incident Patch 6: `2f42a9ac` (2026-09-29)
**Commit Message**: fix(build): derive the pack-boot CLI token against the smoke's DATA_DIR (#15147)

Release-captain fix (v3.8.51 release PR #11442, Package Artifact / dast-smoke): since #13909 the packaged CLI token salt lives in the instance DATA_DIR, but the pack-boot and install-upgrade smokes derived the token without it, so the server rejected the CLI and served the anonymous health view (no version). The smokes now pass their isolated DATA_DIR. New unit test red→green; end-to-end with the CI next-build artifact: version 3.8.51, whoami 200. No production code changed.

**File**: `scripts/check/check-install-upgrade.mjs` (modified, +5/-3)
```diff
@@ -76,7 +76,9 @@ const INTERNAL_SERVICE_HEADER = "x-omniroute-internal-service-token";
  * packaged CLI. Sent alongside the internal-service token so a build that only honours one
  * of the two still answers with the full payload.
  */
-function derivePackagedCliToken(prefix) {
+// The CLI token salt lives under <DATA_DIR> (#13679/#13909): derive against the DATA_DIR the
+// probed server boots on, or the token never matches.
+function derivePackagedCliToken(prefix, dataDir) {
   const cliModuleUrl = pathToFileURL(
     path.join(packageRootFor(prefix), "bin", "cli", "utils", "cliToken.mjs")
   ).href;
@@ -89,7 +91,7 @@ function derivePackagedCliToken(prefix) {
         "import(process.argv[1]).then(async m => process.stdout.write(await m.getCliToken()))",
         cliModuleUrl,
       ],
-      { encoding: "utf8", env: { ...process.env } }
+      { encoding: "utf8", env: { ...process.env, DATA_DIR: dataDir } }
     ).trim();
   } catch {
     // A truncated/broken install cannot derive a token. Returning null keeps the boot
@@ -176,7 +178,7 @@ async function bootAndProbe({ prefix, dataDir, port, expectVersion, label }) {
   if (!fs.existsSync(binPath)) {
     return { ok: false, failures: [`${label}: bin not found at ${binPath}`], tail: [] };
   }
-  const cliToken = derivePackagedCliToken(prefix);
+  const cliToken = derivePackagedCliToken(prefix, dataDir);
   const probeHeaders = {
     [INTERNAL_SERVICE_HEADER]: INTERNAL_SERVICE_TOKEN,
     ...(cliToken ? { "x-omniroute-cli-token": cliToken } : {}),
```

**File**: `scripts/check/check-pack-boot.mjs` (modified, +9/-3)
```diff
@@ -311,7 +311,13 @@ function spawnServer(binPath, port, dataDir) {
   return { child, tail };
 }
 
-function derivePackagedCliToken(packageRoot) {
+/**
+ * Derive the loopback machine token exactly as the installed CLI would for this install.
+ * Since #13679/#13909 the token salt is per-install, persisted under <DATA_DIR>, so the
+ * derivation MUST see the same DATA_DIR the server boots on — otherwise the CLI resolves
+ * a different salt, the server rejects the token and health serves the anonymous view.
+ */
+export function derivePackagedCliToken(packageRoot, dataDir) {
   const cliModuleUrl = pathToFileURL(
     path.join(packageRoot, "bin", "cli", "utils", "cliToken.mjs")
   ).href;
@@ -323,7 +329,7 @@ function derivePackagedCliToken(packageRoot) {
       "import(process.argv[1]).then(async m => process.stdout.write(await m.getCliToken()))",
       cliModuleUrl,
     ],
-    { encoding: "utf8", env: { ...process.env } }
+    { encoding: "utf8", env: { ...process.env, DATA_DIR: dataDir } }
   ).trim();
 }
 
@@ -454,7 +460,7 @@ async function main() {
     const dataDir = path.join(tmp, "data");
     fs.mkdirSync(dataDir, { recursive: true });
     const binPath = path.join(prefix, "bin", "omniroute");
-    const packagedCliToken = derivePackagedCliToken(packageRoot);
+    const packagedCliToken = derivePackagedCliToken(packageRoot, dataDir);
 
     // BOOT #1 — boot, prove the forced sql.js tier, PATCH a setting, then shut down cleanly
     // so the sql.js adapter's graceful persist actually lands on disk. The in-flow stopChild
```

**File**: `tests/unit/check-pack-boot.test.ts` (modified, +33/-1)
```diff
@@ -1,7 +1,8 @@
 import { test } from "node:test";
 import assert from "node:assert/strict";
 import { createHmac } from "node:crypto";
-import { readFileSync } from "node:fs";
+import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
+import os from "node:os";
 import path from "node:path";
 import { fileURLToPath } from "node:url";
 import {
@@ -15,6 +16,7 @@ import {
   evaluateMachineTokenAuth,
   evaluateSqlJsRoundTrip,
   evaluateRestartPersistence,
+  derivePackagedCliToken,
 } from "../../scripts/check/check-pack-boot.mjs";
 
 // WS1.2 (T1, v3.8.49 quality plan) — pure-function guards for the tarball boot-smoke
@@ -244,3 +246,33 @@ test("source guard: final shutdown only deletes the workspace after a CONFIRMED
     "stopChild/waitForHealthy must read authoritative exit state, not a stale boolean"
   );
 });
+
+// #13679/#13909 made the CLI token salt per-install, persisted under <DATA_DIR>. The
+// smoke boots the server on an isolated DATA_DIR, so the token it sends must be derived
+// against that SAME DATA_DIR — derived without it, the CLI resolves a different salt,
+// the server rejects the token, and /api/monitoring/health answers the anonymous view
+// ("version undefined", release PR #11442 Package Artifact).
+test("derivePackagedCliToken derives the token against the server's DATA_DIR salt", () => {
+  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
+  const dataDir = mkdtempSync(path.join(os.tmpdir(), "pack-boot-cli-token-"));
+  const otherDataDir = mkdtempSync(path.join(os.tmpdir(), "pack-boot-cli-token-other-"));
+  const savedCliSalt = process.env.OMNIROUTE_CLI_SALT;
+  delete process.env.OMNIROUTE_CLI_SALT;
+  try {
+    const token = derivePackagedCliToken(repoRoot, dataDir);
+    assert.match(token, /^[0-9a-f]{64}$/);
+    assert.equal(
+      existsSync(path.join(dataDir, "cli-token-salt.json")),
+      true,
+      "the salt must be established inside the smoke's DATA_DIR"
+    );
+    // Stable for the same DATA_DIR, different for another install's DATA_DIR.
+    assert.equal(derivePackagedCliToken(repoRoot, dataDir), token);
+    assert.notEqual(derivePackagedCliToken(repoRoot, otherDataDir), token);
+  } finally {
+    if (savedCliSalt === undefined) delete process.env.OMNIROUTE_CLI_SALT;
+    else process.env.OMNIROUTE_CLI_SALT = savedCliSalt;
+    rmSync(dataDir, { recursive: true, force: true });
+    rmSync(otherDataDir, { recursive: true, force: true });
+  }
+});
```

---

### Incident Patch 7: `3a1523a0` (2026-09-29)
**Commit Message**: fix(idempotency): namespace the replay key by the calling API key (#15128)

Security patch approved for v3.8.51: the idempotency replay key now includes the calling API key, so one caller's cached response is never replayed to another caller sending the same Idempotency-Key. New test fails on the tip (9/10) and passes with the fix (33/33 across the idempotency suites); a neighbouring comment folded to keep chatCore.ts within its frozen ceiling. Thank you @MumuTW!

**File**: `changelog.d/fixes/15128-idempotency-key-caller-scope.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- **fix(idempotency):** the replay key now includes the calling API key, so two API keys sending the same `Idempotency-Key`, model and body no longer share one cached response; retries from the same key still replay ([#15128](https://github.com/diegosouzapw/OmniRoute/pull/15128)) — thanks @MumuTW
```

**File**: `open-sse/handlers/chatCore.ts` (modified, +3/-3)
```diff
@@ -759,10 +759,10 @@ async function handleChatCoreInner({
     clientRawRequest,
     provider,
     model,
-    // NEXA fusion-idempotency fix: body.messages feeds the key digest so combo-internal
-    // sub-requests (fusion panel + judge re-enter chatCore sharing the client's headers)
-    // can never collide on the raw Idempotency-Key/x-request-id header key.
+    // NEXA fusion-idempotency fix: body.messages feeds the key digest so combo-internal sub-requests
+    // (fusion panel + judge share the client's headers) never collide on the raw header key.
     body,
+    apiKeyId: apiKeyInfo?.id ?? null,
     effectiveServiceTier,
     startTime,
     log,
```

**File**: `open-sse/handlers/chatCore/idempotency.ts` (modified, +8/-1)
```diff
@@ -90,12 +90,15 @@ export function composeIdempotencyKey({
   model,
   messages,
   body,
+  apiKeyId,
 }: {
   rawKey: string | null | undefined;
   provider: string;
   model: string;
   messages: unknown;
   body?: unknown;
+  /** The calling API key: keeps one caller's replay from being served to another caller. */
+  apiKeyId?: string | null;
 }): string | null {
   if (!rawKey) return null;
   let digest = "";
@@ -107,7 +110,7 @@ export function composeIdempotencyKey({
   } catch {
     digest = "nodigest";
   }
-  return `${rawKey}|${provider}|${model}|${digest}`;
+  return `${rawKey}|${apiKeyId ?? ""}|${provider}|${model}|${digest}`;
 }
 
 /**
@@ -121,6 +124,7 @@ export async function checkIdempotencyCache({
   provider,
   model,
   body,
+  apiKeyId,
   effectiveServiceTier,
   startTime,
   log,
@@ -130,6 +134,8 @@ export async function checkIdempotencyCache({
   provider: string;
   model: string;
   body?: unknown;
+  /** The calling API key, so replays are never shared across callers. */
+  apiKeyId?: string | null;
   effectiveServiceTier: EffectiveServiceTier | null | undefined;
   startTime: number;
   log: LoggerLike;
@@ -146,6 +152,7 @@ export async function checkIdempotencyCache({
     model,
     messages: (body as { messages?: unknown } | undefined)?.messages,
     body,
+    apiKeyId,
   });
   const cachedIdemp = checkIdempotency(idempotencyKey);
   if (cachedIdemp) {
```

**File**: `tests/unit/idempotency-fusion-collision.test.ts` (modified, +15/-0)
```diff
@@ -145,3 +145,18 @@ test("Chat and Responses generation limits participate in the fingerprint", () =
     composeIdempotencyKey({ ...base, body: { input: "hello", max_output_tokens: 200 } })
   );
 });
+
+test("the same key, model and body from different API keys get DIFFERENT keys", () => {
+  const base = { rawKey: "req-1", provider: "cc", model: "claude-opus-4-6", messages: MSGS };
+  const a = composeIdempotencyKey({ ...base, apiKeyId: "key-a" });
+  const b = composeIdempotencyKey({ ...base, apiKeyId: "key-b" });
+  assert.notEqual(a, b);
+});
+
+test("a retry from the SAME API key still replays (same key)", () => {
+  const base = { rawKey: "req-1", provider: "cc", model: "claude-opus-4-6", messages: MSGS };
+  assert.equal(
+    composeIdempotencyKey({ ...base, apiKeyId: "key-a" }),
+    composeIdempotencyKey({ ...base, apiKeyId: "key-a" })
+  );
+});
```

---

### Incident Patch 8: `453918ab` (2026-09-29)
**Commit Message**: docs(i18n): refresh 19 drifted docs across 66 locales and fix the db module count (#15123)

* docs: correct the src/lib/db module count to 136 in README and REPOSITORY_MAP

* docs(i18n): refresh 19 drifted docs across 66 locales

Re-translates every locale of the 19 docs the base edited without updating
their translations (README, USER_GUIDE, API_REFERENCE, ENVIRONMENT,
FEATURE_FLAGS, PROVIDER_REFERENCE, AUTO-COMBO, REPOSITORY_MAP, CORS and
others). 1254 mirrors; every one passed the output guard and a
structure/leak check against its source.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1275,7 +1275,7 @@ Métricas canônicas em 2026-08-24: **1.029 vídeos únicos** · **11.132.922 vi
   <tr><td nowrap><b>Runtime</b></td><td>Node.js 22.x / 24.x LTS — <code>&gt;=22.22.2 &lt;23 || &gt;=24.0.0 &lt;27</code></td></tr>
   <tr><td nowrap><b>Language</b></td><td>TypeScript 6.0 — <b>100% TypeScript</b> across <code>src/</code> and <code>open-sse/</code> (zero <code>any</code> in core since v2.0)</td></tr>
   <tr><td nowrap><b>Framework</b></td><td>Next.js 16 + React 19 + Tailwind CSS 4</td></tr>
-  <tr><td nowrap><b>Database</b></td><td>better-sqlite3 (SQLite, WAL journaling) + LowDB (JSON legacy) — 122 domain modules, 193 migrations</td></tr>
+  <tr><td nowrap><b>Database</b></td><td>better-sqlite3 (SQLite, WAL journaling) + LowDB (JSON legacy) — 136 domain modules, 193 migrations</td></tr>
   <tr><td nowrap><b>Memory</b></td><td>SQLite FTS5 full-text + int8-quantized vector embeddings, typed decay</td></tr>
   <tr><td nowrap><b>Schemas</b></td><td>Zod 4 — MCP tool I/O validation + API contracts</td></tr>
   <tr><td nowrap><b>Protocols</b></td><td>MCP (stdio / HTTP / SSE) + A2A v0.3 (JSON-RPC 2.0 + SSE)</td></tr>
```

**File**: `docs/architecture/REPOSITORY_MAP.md` (modified, +19/-19)
```diff
@@ -206,7 +206,7 @@ src/
 | `cacheLayer.ts`, `idempotencyLayer.ts`   | Request caching + idempotency                                                                                                                                                                                                                                                                                           |
 | (~30 more top-level files)               | Specialized helpers (logEnv, modelsDevSync, piiSanitizer, etc.)                                                                                                                                                                                                                                                         |
 
-### `src/lib/db/` — Database (122 modules + 168 migrations)
+### `src/lib/db/` — Database (136 modules + 193 migrations)
 
 | Subdir                    | Purpose                                                                                                                                                                    |
 | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
@@ -402,24 +402,24 @@ open-sse/
 
 ### Subsystem deep-dives
 
-| Doc                        | Purpose                                                              |
-| -------------------------- | -------------------------------------------------------------------- |
-| `MCP-SERVER.md`            | MCP server: 110 tools, 3 transports, 33 scopes, REST endpoints       |
-| `A2A-SERVER.md`            | A2A v0.3: JSON-RPC, 6 skills, REST helpers, agent card               |
-| `AGENT_PROTOCOLS_GUIDE.md` | Unified guide: A2A vs ACP vs Cloud Agents                            |
-| `CLOUD_AGENT.md`           | Codex Cloud / Devin / Jules orchestration                            |
-| `SKILLS.md`                | Skills framework (built-in + marketplace + SkillsSH + sandbox)       |
-| `RADAR.md`                 | Radar free-model catalog overlay (`RADAR_ENABLED`, off by default)   |
-| `MEMORY.md`                | Memory system (SQLite FTS5 + Qdrant)                                 |
-| `EVALS.md`                 | Eval framework (suites, runs, rubrics)                               |
-| `GUARDRAILS.md`            | PII masker, prompt injection, vision bridge                          |
-| `COMPLIANCE.md`            | Audit log, retention, noLog opt-out                                  |
-| `WEBHOOKS.md`              | HMAC-signed webhook delivery                                         |
-| `REASONING_REPLAY.md`      | Hybrid memory/SQLite cache for `reasoning_content`                   |
-| `AUTHZ_GUIDE.md`           | Authorization pipeline (`classify` → `policies` → `enforce`)         |
-| `RESILIENCE_GUIDE.md`      | Circuit breaker + cooldown + model lockout                           |
-| `docs/security/STEALTH_GUIDE.md` (git only)         | TLS fingerprinting (JA3/JA4), Claude Code CCH, MITM cert             |
-| `AUTO-COMBO.md`            | Auto Combo engine (16-factor scoring, 6 mode packs, virtual factory) |
+| Doc                                         | Purpose                                                              |
+| ------------------------------------------- | -------------------------------------------------------------------- |
+| `MCP-SERVER.md`                             | MCP server: 110 tools, 3 transports, 33 scopes, REST endpoints       |
+| `A2A-SERVER.md`                             | A2A v0.3: JSON-RPC, 6 skills, REST helpers, agent card               |
+| `AGENT_PROTOCOLS_GUIDE.md`                  | Unified guide: A2A vs ACP vs Cloud Agents                            |
+| `CLOUD_AGENT.md`                            | Codex Cloud / Devin / Jules orchestration                            |
+| `SKILLS.md`                                 | Skills fram
```

**File**: `docs/i18n/am/CONTRIBUTING.md` (modified, +2/-3)
```diff
@@ -429,7 +429,6 @@ docs/
 
 - **አርክቴክቸር**፦ [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md)ን ይመልከቱ
 - **የAPI ማጣቀሻ**፦ [`docs/reference/API_REFERENCE.md`](docs/reference/API_REFERENCE.md)ን ይመልከቱ
-- **የደኅንነት ሰነዶች**፦ [`docs/security/CLI_TOKEN.md`](docs/security/CLI_TOKEN.md), [`docs/security/ROUTE_GUARD_TIERS.md`](docs/security/ROUTE_GUARD_TIERS.md), [`docs/security/ERROR_SANITIZATION.md`](docs/security/ERROR_SANITIZATION.md), [`docs/security/PUBLIC_CREDS.md`](docs/security/PUBLIC_CREDS.md)
-- **የክዋኔ ሰነዶች**፦ [`docs/ops/SQLITE_RUNTIME.md`](docs/ops/SQLITE_RUNTIME.md)
+- **የደህንነት ሰነዶች**፦ [`docs/security/CLI_TOKEN.md`](docs/security/CLI_TOKEN.md)፣ [`docs/security/ROUTE_GUARD_TIERS.md`](docs/security/ROUTE_GUARD_TIERS.md)፣ [`docs/security/ERROR_SANITIZATION.md`](docs/security/ERROR_SANITIZATION.md)፣ [`docs/security/PUBLIC_CREDS.md`](docs/security/PUBLIC_CREDS.md)
+- **የክወና ሰነዶች**፦ [`docs/ops/SQLITE_RUNTIME.md`](docs/ops/SQLITE_RUNTIME.md)
 - **ችግሮች**፦ [github.com/diegosouzapw/OmniRoute/issues](https://github.com/diegosouzapw/OmniRoute/issues)
-- **ADRs**፦ የአርክቴክቸር ውሳኔ መዝገቦችን በ`docs/adr/` ይመልከቱ
```

**File**: `docs/i18n/am/README.md` (modified, +70/-70)
```diff
@@ -345,92 +345,92 @@ curl http://localhost:20128/v1/chat/completions \
 
 </div>
 
-<img src="./docs/diagrams/strategies-grid.svg" width="100%" alt="ሁሉም 19 የኮምቦ ማዘዋወሪያ ስልቶች በእነማ ቀርበዋል — ለእያንዳንዱ ስልት አንድ ሰድር፦ priority, fill-first, weighted, round-robin, p2c, least-used, random, strict-random, cost-optimized, headroom, reset-window, reset-aware, context-relay, context-optimized, cache-optimized, lkgp, auto, fusion, pipeline። እያንዳንዱ ምን እንደሚያደርግ ከላይ ያለውን ሰንጠረዥ ይመልከቱ።"/>
+<img src="./docs/diagrams/strategies-grid.svg" width="100%" alt="ሁሉም 19 የኮምቦ ማስተላለፊያ ስልቶች በእንቅስቃሴ የታዩ — ለእያንዳንዱ ስልት አንድ ሰቅ: priority, fill-first, weighted, round-robin, p2c, least-used, random, strict-random, cost-optimized, headroom, reset-window, reset-aware, context-relay, context-optimized, cache-optimized, lkgp, auto, fusion, pipeline። እያንዳንዱ ምን እንደሚያደርግ ለማየት ከላይ ያለውን ሰንጠረዥ ይመልከቱ።"/>
 
-> **ኮምቦ** OmniRoute **በራስ-ሰር** የሚያዘዋውርባቸው የሞዴሎች ሰንሰለት ነው። ኮታው ካለቀ፣ አቅራቢው ካልሰራ ወይም ወጪዎች በድንገት ከጨመሩ፣ ኮምቦው ወደሚቀጥለው ብቁና ጤናማ ሞዴል መሄድ ይችላል። 🛡️
+> **ኮምቦ** ማለት OmniRoute **በራስ-ሰር** የሚያስተላልፍባቸው የሞዴሎች ሰንሰለት ነው። ኮታው ካለቀ፣ አቅራቢው ካልተሳካ ወይም ወጪዎች በድንገት ከጨመሩ፣ ኮምቦው ወደሚቀጥለው ብቁና ጤናማ ሞዴል ሊዘዋወር ይችላል። 🛡️
 
 ### ⚡ ዜሮ-ውቅር — `auto`ን ብቻ ይጠቀሙ
 
-መፍጠር ያለብዎት ኮምቦ የለም። ሞዴልዎን ወደ `auto` (ወይም አንዱ ተለዋጩ) ያዘጋጁ፤ OmniRoute ከተገናኙት አቅራቢዎችዎ በቀጥታ ነጥብ እየሰጠ ምናባዊ ኮምቦ ይገነባል፦
+መፍጠር ያለብዎት ኮምቦ የለም። ሞዴልዎን ወደ `auto` (ወይም አንድ ልዩነቱ) ያዘጋጁ፤ OmniRoute ከተገናኙ አቅራቢዎችዎ ምናባዊ ኮምቦ ይገነባል እና በቀጥታ ይመዝነዋል፦
 
 <table>
   <tr><th align="left">የሞዴል ID</th><th align="left">የሚያመቻቸው ነገር</th></tr>
-  <tr><td align="left" nowrap><code>auto</code></td><td align="left">🎯 ሚዛናዊ ነባሪ (LKGP — በመጨረሻ ጥሩ ከነበረው አቅራቢዎ ጋር ይቆያል)</td></tr>
-  <tr><td align="left" nowrap><code>auto/coding</code></td><td align="left">🧑💻 ለኮድ ማመንጨት ጥራትን ቅድሚያ የሚሰጡ ክብደቶች</td></tr>
+  <tr><td align="left" nowrap><code>auto</code></td><td align="left">🎯 ሚዛናዊ ነባሪ (LKGP — በመጨረሻ ጥሩ ሆኖ ከሰራው አቅራቢዎ ጋር ይቆያል)</td></tr>
+  <tr><td align="left" nowrap><code>auto/coding</code></td><td align="left">🧑💻 ለኮድ ማመንጨት ጥራትን የሚያስቀድሙ ክብደቶች</td></tr>
   <tr><td align="left" nowrap><code>auto/fast</code></td><td align="left">⚡ በመጀመሪያ ዝቅተኛው መዘግየት</td></tr>
   <tr><td align="left" nowrap><code>auto/cheap</code></td><td align="left">💰 በመጀመሪያ በቶከን ዝቅተኛው ዋጋ</td></tr>
-  <tr><td align="left" nowrap><code>auto/offline</code></td><td align="left">🔋 በመጀመሪያ ከፍተኛው የኮታ / የፍጥነት-ገደብ ትርፍ አቅም</td></tr>
-  <tr><td align="left" nowrap><code>auto/smart</code></td><td align="left">🔭 ጥራትን ቅድሚያ መስጠት + የተሻሉ ሞዴሎችን ለማግኘት 10% ሙከራ</td></tr>
-  <tr><td align="left" nowrap><code>auto/lkgp</code></td><td align="left">📌 ከመጨረሻው ጥሩ አቅራቢ ጋር በግልጽ መቆየት</td></tr>
-  <tr><td align="left" nowrap><code>auto/chaos</code></td><td align="left">🧪 የመቋቋም ችሎታን ለመፈተሽ የስህተት-መወጋት ክብደቶች (የchaos ምህንድስና)</td></tr>
+  <tr><td align="left" nowrap><code>auto/offline</code></td><td align="left">🔋 በመጀመሪያ ከፍተኛው የኮታ / የተመን-ገደብ ትርፍ አቅም</td></tr>
+  <tr><td align="left" nowrap><code>auto/smart</code></td><td align="left">🔭 ጥራትን የሚያስቀድም + የተሻሉ ሞዴሎችን ለማግኘት 10% ሙከራ</td></tr>
+  <tr><td align="left" nowrap><code>auto/lkgp</code></td><td align="left">📌 በግልጽ በመጨረሻ ጥሩ ሆኖ ከሰራው አቅራቢ ጋር መቆየት</td></tr>
+  <tr><td align="left" nowrap><code>auto/chaos</code></td><td align="left">🧪 ወደ ሞዴሎች ፓነል በትይዩ ማሰራጨት (ለእያንዳንዱ አቅራቢ አንድ፣ በነባሪ 5)፤ አንድ መልስ ይመልሳል፤ ለእያንዳንዱ የፓነል ሞዴል አንድ የላይኛው-ምንጭ ጥሪ እንጂ የብልሽት ማስገባት አይደለም</td></tr>
 </table>
 
 ##
 
-### 🔀 ወይም የራስዎን ይገንቡ — 19 የማዘዋወሪያ ስልቶች
+### 🔀 ወይም የራስዎን ይገንቡ — 19 የማስተላለፊያ ስልቶች
 
-ሁሉም **19** ስልቶች — በእያንዳንዱ የኮምቦ ደረጃ እንደፈለጉ ያዋህዱ፦
+ሁሉም **19** ስልቶች — በእያንዳንዱ የኮምቦ ደረጃ ያቀላቅሉና ያዛምዱ፦
 
 <table>
   <tr>
     <th>#</th>
     <th align="left">ስልት</th>
-    <th align="left">የሚያደርገው ነገር</th>
+    <th align="left">የሚያደርገው</th>
   </tr>
   <tr>
     <td align="center">1</td>
     <td nowrap><code>priority</code></td>
-    <td>የመጀመሪያውን ዒላማ የሚያስቀድም ቅደም ተከተላዊ ዝርዝር — ወደሚቀጥለው ከመሄድ በፊት እያንዳንዱን ሙሉ በሙሉ ይጠቀማል 🥇</td>
+    <td>የመጀመሪያውን ዒላማ የሚያስቀድም የተደረደረ ዝርዝር — ወደሚቀጥለው ከመሄድ በፊት እያንዳንዱን ሙሉ በሙሉ ይጠቀማል 🥇</td>
   </tr>
   <tr>
     <td align="center">2</td>
     <td no
```

**File**: `docs/i18n/am/docs/architecture/AUTHZ_GUIDE.md` (modified, +31/-31)
```diff
@@ -13,63 +13,63 @@ OmniRoute እያንዳንዱን የAPI ጥያቄ የሚቆጣጠር፣ መንገ
 
 > ምንጭ፦ [diagrams/authz-pipeline.mmd](../diagrams/authz-pipeline.mmd)
 
-## ሁለት የማረጋገጫ ሁነታዎች
+## ሁለት የማረጋገጫ ሁነቶች
 
 ### 1. API ቁልፍ (Bearer)
 
-ከOpenAI/Anthropic/Gemini ጋር ተኳዃኝ ለሆኑ የደንበኛ APIዎች፣ እንዲሁም ቁልፉ `manage` ወሰን ሲኖረው ለጥቂት የአስተዳደር መስመሮች ይጠቅማል።
+ለOpenAI/Anthropic/Gemini-ተኳሃኝ የደንበኛ APIዎች እና ቁልፉ `manage` ወሰን ሲኖረው ለጥቂት የአስተዳደር መስመሮች ጥቅም ላይ ይውላል።
 
 ```
 Authorization: Bearer <api-key>
 ```
 
-በ`src/sse/services/auth.ts` ውስጥ ባሉት `isValidApiKey()` / `extractApiKey()` የሚረጋገጥ ሲሆን፣ በ`src/shared/utils/apiAuth.ts` በኩል እንደገና ወደ ውጭ ይላካል። አረጋጋጩ `OMNIROUTE_API_KEY` / `ROUTER_API_KEY` የአካባቢ ተለዋዋጮችንም እንደ ቋሚ የማሳለፊያ ቁልፎች ይቀበላል (ጉዳይ #1350)።
+በ`src/sse/services/auth.ts` ውስጥ ባሉት `isValidApiKey()` / `extractApiKey()` የሚረጋገጥ ሲሆን፣ በ`src/shared/utils/apiAuth.ts` በኩል እንደገና ወደ ውጭ ይላካል። አረጋጋጩ የ`OMNIROUTE_API_KEY` / `ROUTER_API_KEY` የአካባቢ ተለዋዋጮችንም እንደ ቋሚ የማሳለፊያ ቁልፎች ይቀበላል (ጉዳይ #1350)።
 
-### 2. የዳሽቦርድ ክፍለ-ጊዜ (auth_token ኩኪ)
+### 2. የዳሽቦርድ ክፍለ ጊዜ (auth_token cookie)
 
-ለዳሽቦርድ ገጾች እና ለአስተዳዳሪ ክዋኔዎች።
+ለዳሽቦርድ ገጾች እና ለአስተዳዳሪ ክንውኖች።
 
 ```
 Cookie: auth_token=<JWT signed with JWT_SECRET>
 ```
 
-JWTው ሲረጋገጥ **እና** `authenticated: true` ሲይዝ ብቻ ኩኪው ክፍለ-ጊዜ ይሆናል
-(`src/shared/utils/dashboardSessionToken.ts` → `verifyDashboardSessionToken`)። ኩኪውን
-የሚጠቀም እያንዳንዱ አካል (የመስመር ጠባቂ፣ የauthz ቧንቧ መስመር ማደስ፣ የWebSocket መጨባበጥ፣ ቀጥታ
-አገልጋይ፣ `/api/settings/require-login`፣ `/api/auth/status`) በዚያ አጋዥ በኩል ያልፋል።
-በ`JWT_SECRET` የተፈረሙ ሌሎች JWTዎች አሉ — የCursor CLI ማሳለፊያው ለቁልፍ ባለቤቶች
-`iss "omniroute" / aud "cursor-cli"` ቶከኖችን ይፈጥራል — እና እነዚህ በፍጹም ክፍለ-ጊዜዎች አይደሉም
+JWTው ሲረጋገጥ **እና** `authenticated: true` ሲይዝ ብቻ cookieው ክፍለ ጊዜ ይሆናል
+(`src/shared/utils/dashboardSessionToken.ts` → `verifyDashboardSessionToken`)። እያንዳንዱ
+የcookieው ተጠቃሚ (የዳሽቦርድ መስመር ጠባቂ (`isDashboardSessionAuthenticated()`)፣ የauthz pipeline እድሳት፣ WebSocket handshake፣ live
+server፣ `/api/settings/require-login`፣ `/api/auth/status`) በዚያ helper በኩል ያልፋል።
+በ`JWT_SECRET` የተፈረሙ ሌሎች JWTዎችም አሉ — የCursor CLI passthrough ለቁልፍ ባለቤቶች
+`iss "omniroute" / aud "cursor-cli"` tokens ይፈጥራል — እነዚህም በፍጹም ክፍለ ጊዜዎች አይደሉም
 (#13298)።
 
-በ`src/shared/utils/apiAuth.ts` ውስጥ ባለው `isDashboardSessionAuthenticated()` ይረጋገጣል። ቧንቧ መስመሩ JWTው ከ30 ቀናት የዕድሜ ገደቡ ውስጥ ከ7 ቀናት ያነሰ ጊዜ ሲቀረው በራስ-ሰር ያድሰዋል።
+በ`src/shared/utils/apiAuth.ts` ውስጥ ባለው `isDashboardSessionAuthenticated()` ይረጋገጣል። በ30 ቀን የሕይወት ጊዜው ውስጥ ከ7 ቀናት ያነሰ ጊዜ ሲቀረው pipelineው JWTውን በራስ-ሰር ያድሳል።
 
-አንዳንድ የአስተዳደር መስመሮች **ከሁለቱ አንዱን** ሁነታ ይቀበላሉ፦ ኩኪ ወይም የAPI ቁልፉ `manage` (ወይም `admin`) ወሰን ሲኖረው `Bearer <key>`። በv3.8 የታከለውን «በAPI ጥሪዎች ሊዋቀር የሚችል» የስራ ፍሰት የሚያስችለው ይህ ነው።
+እያንዳንዱ አመንጪ በ`mintDashboardSessionToken` (የተሰጠበት ጊዜ `iat` እና መለያ `jti`) በኩል ስለሚያልፍ እና አረጋጋጩ ሁለት ቅንብሮችን ስለሚፈትሽ፣ አንድ ክፍለ ጊዜ 30 ቀናቱ ከማለቃቸው በፊትም ሊያበቃ ይችላል፦ `sessionsValidAfter`፣ የይለፍ ቃል ሲቀየር የሚዘጋጅ ሲሆን ከዚያ በፊት የተሰጡ ክፍለ ጊዜዎች በሙሉ እንዳይረጋገጡ ያደርጋል (የይለፍ ቃሉን የቀየረው browser አዲስ cookie ያገኛል)፤ እና `revokedDashboardSessions`፣ `POST /api/auth/logout` ዘግቶ የወጣውን ክፍለ ጊዜ `jti` የሚጨምርበት። በቀድሞ ልቀት የተፈጠሩ ክፍለ ጊዜዎች ከእነዚህ አቤቱታዎች አንዱንም አይይዙም፣ እና የመጀመሪያው የይለፍ ቃል ለውጥ እስኪከሰት ድረስ የሚሰሩ ሆነው ይቆያሉ። ቅንብሮቹ ሊነበቡ ካልቻሉ፣ ክፍለ ጊዜው አይታመንም።
+
+አንዳንድ የአስተዳደር መስመሮች **ከሁለቱ አንዱን** ሁነት ይቀበላሉ፦ cookie ወይም የAPI ቁልፉ `manage` (ወይም `admin`) ወሰን ሲኖረው `Bearer <key>`። ይህም በv3.8 የታከለውን "በAPI ጥሪዎች በኩል ሊዋቀር የሚችል" የሥራ ፍሰት ያስችላል።
 
 #### አማራጭ የOIDC መግቢያ በር (#6973)
 
-የዳሽቦርድ አስተዳዳሪ መግቢያው ከነባሪው የይለፍ ቃል መግቢያ ጎን ለጎን **በምርጫ የሚነቃ** የOIDC (OpenID Connect) ፍሰትንም
-ይደግፋል — የይለፍ ቃል መግቢያው በፍጹም አይወገድም፣ የሚደረገው መጨመር ብቻ
-ነው፦
+የዳሽቦርድ አስተዳዳሪ መግቢያው ከነባሪው የይለፍ ቃል መግቢያ ጎን ለጎን **በፈቃድ የሚነቃ** OIDC (OpenID Connect) ፍሰትንም ይደግፋል — የይለፍ ቃል መግቢያው ፈጽሞ አይወገድም፣ የሚደረገው መደገፍ ብቻ ነው፦
 
-- `settings.oidcEnabled === true` ካልሆነ **እና** `oidcIssuer` /
+- `settings.oidcEnabled === true` **እና** `oidcIssuer` /
   `oidcClientId` / `oidcClientSecret` ሁሉም ካልተዋቀሩ በስተቀር የተሰናከለ ነው (Settings → Auth)።
   ካልሆነ `GET /api/auth/oidc/login` `400` ይመልሳል።
 - `GET /api/auth/oidc/login` `authorization_endpoint`ን ከአውጪው
-  `/.well-known/openid-configuration` ይፈልጋል (`<issuer>/authorize`ን
-  እንደ አማራጭ ይጠቀማል)፣ የመልሶ ማዞሪያ URIውን ከገቢ
```

---

### Incident Patch 9: `ce0d2151` (2026-09-29)
**Commit Message**: fix(release): drain base-reds r7 of v3.8.51 — connection-test operator-disable race, two vitest teardown leaks (#15130)

Release-captain base-red fix (v3.8.51 release PR #11442): production race — a passing connection probe re-enabled a connection the operator had switched off mid-probe (stale cached row; now re-read uncached right before the write); plus two Vitest teardown leaks (unmounted roots / awaited dynamic imports) that surfaced as unhandled rejections. Red→green proofs for each; typecheck, eslint, file-size clean.

**File**: `src/app/api/providers/[id]/test/route.ts` (modified, +20/-19)
```diff
@@ -2,7 +2,7 @@ import { NextResponse } from "next/server";
 import { z } from "zod";
 import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
 import { getCachedProviderConnectionById } from "@/lib/db/readCache";
-import { updateProviderConnection } from "@/lib/db/providers";
+import { getProviderConnectionById, updateProviderConnection } from "@/lib/db/providers";
 import { isCloudEnabled, resolveProxyForConnection } from "@/lib/db/settings";
 import { getConsistentMachineId } from "@/shared/utils/machineId";
 import { syncToCloud } from "@/lib/cloudSync";
@@ -1045,16 +1045,19 @@ export async function testSingleConnection(
     lockModelIfPerModelQuota(provider, connectionId, probedModelId, "credits", 60 * 60 * 1000);
   }
 
-  // Unsupported validation capability is neutral: the probe established that
-  // this provider cannot be verified through the generic test surface, not
-  // that its credential is invalid. Do not mutate persisted credential health
-  // (testStatus/lastError/etc.) — but DO activate it if it isn't already: a
-  // connection that can never be health-checked would otherwise stay hidden
-  // from /v1/models forever under the "only advertise tested connections"
-  // default (isActive starts false on creation — see POST /api/providers),
-  // silently regressing every provider without a test surface. Operator-disabled stays off.
+  // Activation/PSD writes use the row as it is NOW (uncached): an operator may have switched the
+  // connection off during the probe, and the pre-probe snapshot would switch it back on.
+  const latest = ((await getProviderConnectionById(connectionId)) ??
+    connection) as typeof connection;
+  const operatorDisabled = isOperatorDisabled(latest);
+
+  // Unsupported validation capability is neutral: the provider cannot be verified through the
+  // generic test surface, which says nothing about its credential. Do not mutate persisted
+  // credential health (testStatus/lastError/etc.) — but DO activate it if it isn't already: under
+  // the "only advertise tested connections" default (connections start isActive:false, see
+  // POST /api/providers) it would stay hidden from /v1/models forever. Operator-disabled stays off.
   if (result.skipped === true) {
-    if (connection.isActive !== true && !isOperatorDisabled(connection)) {
+    if (latest.isActive !== true && !operatorDisabled) {
       try {
         await updateProviderConnection(connectionId, { isActive: true });
       } catch (activateError) {
@@ -1108,14 +1111,12 @@ export async function testSingleConnection(
 
   const updateData: Record<string, any> = {
     testStatus: clearErrorState ? "active" : result.valid ? connection.testStatus : "error",
-    // A passing test is the sole activation signal under the "only advertise
-    // tested-working connections" default — see POST /api/providers, which
-    // now creates connections isActive:false. Only ever flips ON here: a
-    // failing test intentionally leaves isActive untouched (a transient
-    // failure on an already-active, already-working connection must not take
-    // it out of rotation — that's what the cooldown/rateLimitedUntil below is
-    // for), so this never deactivates anything, nor re-enables an operator-disabled one.
-    ...(result.valid && !isOperatorDisabled(connection) ? { isActive: true } : {}),
+    // A passing test is the sole activation signal under the "only advertise tested-working
+    // connections" default (POST /api/providers creates connections isActive:false). Only ever
+    // flips ON: a failing test leaves isActive untouched (a transient failure must not take a
+    // working connection out of rotation — the cooldown/rateLimitedUntil below handles that), so
+    // this never deactivates anything, nor re-enables an operator-disabled one.
+    ...(result.valid && !operatorDisabled ? { isActive: true } : {}),
     lastError: clearErrorState ? null : result.valid ? connection.lastError : re
```

**File**: `tests/unit/connection-test-respects-operator-disable.test.ts` (modified, +41/-0)
```diff
@@ -28,10 +28,14 @@ process.env.DISABLE_SQLITE_AUTO_BACKUP = "true";
 
 const VALIDATION_BASE_URL = "https://proxy.operator-disable.example.com/v1";
 const originalFetch = globalThis.fetch;
+// When set, every validation probe waits on this promise before answering, so a
+// test can hold a connection test mid-probe while the operator acts.
+let probeGate: Promise<void> | null = null;
 globalThis.fetch = (async (input: string | URL | Request) => {
   const url =
     typeof input === "string" ? input : input instanceof Request ? input.url : input.toString();
   if (url === `${VALIDATION_BASE_URL}/models`) {
+    if (probeGate) await probeGate;
     return new Response(JSON.stringify({ data: [] }), { status: 200 });
   }
   return new Response("not found", { status: 404 });
@@ -192,3 +196,40 @@ test("a skipped (unverifiable) test does not re-enable an operator-disabled conn
     "an unverifiable test must leave an operator-disabled connection disabled"
   );
 });
+
+test("an operator disable during an in-flight probe is not undone when the probe passes", async () => {
+  // The probe of a connection test can take seconds, and POST /api/providers
+  // fires one in the background on create. When the operator switched the
+  // connection off while such a probe was still in flight, the test decided on
+  // the snapshot it read before the probe and turned the connection back on
+  // (this race made the two tests above flaky in CI).
+  let releaseProbe: () => void = () => {};
+  probeGate = new Promise<void>((resolve) => {
+    releaseProbe = resolve;
+  });
+  try {
+    const nodeId = await createCompatibleNode("opdisable-inflight");
+    const connectionId = await createConnection(nodeId, "Operator Disable In-Flight");
+    assert.equal(readRow(connectionId).isActive, 0, "a new connection starts inactive");
+
+    const inFlight = testSingleConnection(connectionId);
+    // Let the test read its snapshot and reach the gated probe.
+    await new Promise((resolve) => setTimeout(resolve, 50));
+
+    await setActive(connectionId, false);
+    assert.equal(typeof readRow(connectionId).psd[OPERATOR_DISABLED_AT_KEY], "string");
+
+    releaseProbe();
+    const result = await inFlight;
+    assert.equal(result.valid, true, `expected a passing test, got ${JSON.stringify(result)}`);
+    // The create route's background auto-test was held by the same gate.
+    await new Promise((resolve) => setTimeout(resolve, 50));
+
+    const row = readRow(connectionId);
+    assert.equal(row.isActive, 0, "an in-flight passing probe must not undo an operator disable");
+    assert.equal(typeof row.psd[OPERATOR_DISABLED_AT_KEY], "string");
+  } finally {
+    releaseProbe();
+    probeGate = null;
+  }
+});
```

**File**: `tests/unit/translator-friendly-raw-json-panel.test.tsx` (modified, +135/-82)
```diff
@@ -1,7 +1,7 @@
 // @vitest-environment jsdom
 import React from "react";
 import { act } from "react";
-import { createRoot } from "react-dom/client";
+import { createRoot, type Root } from "react-dom/client";
 import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
 
 // Minimal i18n stub
@@ -97,44 +97,50 @@ vi.mock("@/shared/components", () => ({
       ))}
     </select>
   ),
-  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string; size?: string; icon?: string; dot?: boolean }) => (
+  Badge: ({
+    children,
+    variant,
+  }: {
+    children: React.ReactNode;
+    variant?: string;
+    size?: string;
+    icon?: string;
+    dot?: boolean;
+  }) => (
     <span data-testid="badge" data-variant={variant}>
       {children}
     </span>
   ),
 }));
 
 // exampleTemplates stub
-vi.mock(
-  "@/app/(dashboard)/dashboard/translator/exampleTemplates",
-  () => ({
-    getExampleTemplates: () => [
-      {
-        id: "simple-chat",
-        name: "Simple Chat",
-        icon: "chat",
-        description: "Simple chat template",
-        formats: {
-          openai: { model: "gpt-4o", messages: [{ role: "user", content: "Hello" }] },
-          claude: {
-            model: "claude-sonnet-4-20250514",
-            messages: [{ role: "user", content: "Hello" }],
-          },
+vi.mock("@/app/(dashboard)/dashboard/translator/exampleTemplates", () => ({
+  getExampleTemplates: () => [
+    {
+      id: "simple-chat",
+      name: "Simple Chat",
+      icon: "chat",
+      description: "Simple chat template",
+      formats: {
+        openai: { model: "gpt-4o", messages: [{ role: "user", content: "Hello" }] },
+        claude: {
+          model: "claude-sonnet-4-20250514",
+          messages: [{ role: "user", content: "Hello" }],
         },
       },
-    ],
-    FORMAT_META: {
-      openai: { label: "OpenAI", color: "blue", icon: "psychology" },
-      claude: { label: "Claude", color: "amber", icon: "auto_awesome" },
-      gemini: { label: "Gemini", color: "green", icon: "smart_toy" },
     },
-    FORMAT_OPTIONS: [
-      { value: "openai", label: "OpenAI" },
-      { value: "claude", label: "Claude" },
-      { value: "gemini", label: "Gemini" },
-    ],
-  }),
-);
+  ],
+  FORMAT_META: {
+    openai: { label: "OpenAI", color: "blue", icon: "psychology" },
+    claude: { label: "Claude", color: "amber", icon: "auto_awesome" },
+    gemini: { label: "Gemini", color: "green", icon: "smart_toy" },
+  },
+  FORMAT_OPTIONS: [
+    { value: "openai", label: "OpenAI" },
+    { value: "claude", label: "Claude" },
+    { value: "gemini", label: "Gemini" },
+  ],
+}));
 
 const cleanupCallbacks: Array<() => void> = [];
 
@@ -145,6 +151,23 @@ function makeContainer(): HTMLElement {
   return container;
 }
 
+/**
+ * createRoot + unmount on cleanup. Unmounting runs the effect cleanups (the
+ * auto-detect debounce clearTimeout); removing the container does not.
+ */
+function mountRoot(container: HTMLElement): Root {
+  const root = createRoot(container);
+  cleanupCallbacks.push(() => {
+    act(() => root.unmount());
+  });
+  return root;
+}
+
+function runCleanup(): void {
+  while (cleanupCallbacks.length > 0) cleanupCallbacks.pop()?.();
+  document.body.innerHTML = "";
+}
+
 describe("RawJsonPanel", () => {
   beforeEach(() => {
     (
@@ -153,24 +176,19 @@ describe("RawJsonPanel", () => {
     vi.resetAllMocks();
   });
 
-  afterEach(() => {
-    while (cleanupCallbacks.length > 0) cleanupCallbacks.pop()?.();
-    document.body.innerHTML = "";
-  });
+  afterEach(runCleanup);
 
   it("exports a default function component", async () => {
-    const mod = await import(
-      "@/app/(dashboard)/dashboard/translator/components/advanced/RawJsonPanel"
-    );
+    const mod =
+      await import("@/app/(dashboard)/dashboard/translator/components/advanced/RawJsonPanel");
     expect(typeof mod.default).toBe("function");
   });
 
   it("renders Collapsible wrapper with correct icon", a
```

**File**: `tests/unit/ui/playground-studio.test.tsx` (modified, +35/-20)
```diff
@@ -2,10 +2,17 @@
 import React from "react";
 import { act } from "react";
 import { createRoot } from "react-dom/client";
-import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
+import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
 
 // ── Mocks ─────────────────────────────────────────────────────────────────────
 
+// The next/dynamic mock below starts each tab's import without awaiting it. A
+// tab module graph (BuildTab → useToolsBuilder → schemas) can still be loading
+// when the synchronous tests finish, and vitest then reports an unhandled
+// EnvironmentTeardownError ("Cannot load … after the environment was torn
+// down"). Every started import is tracked and awaited in afterAll.
+const dynamicImports = vi.hoisted(() => [] as Promise<unknown>[]);
+
 vi.mock("next-intl", () => ({
   useTranslations: () => (key: string, params?: Record<string, unknown>) =>
     params ? `${key}(${JSON.stringify(params)})` : key,
@@ -25,9 +32,11 @@ vi.mock("next/dynamic", () => ({
   ) => {
     // Eagerly resolve the dynamic import in tests
     let Component: React.ComponentType<Record<string, unknown>> | null = null;
-    fn().then((m) => {
-      Component = m.default;
-    });
+    dynamicImports.push(
+      fn().then((m) => {
+        Component = m.default;
+      })
+    );
     return function DynamicWrapper(props: Record<string, unknown>) {
       if (!Component) return <div data-testid="dynamic-loading" />;
       return React.createElement(Component, props);
@@ -118,9 +127,14 @@ vi.mock("react-markdown", () => ({
 
 // ── Import under test ──────────────────────────────────────────────────────────
 
-const { PlaygroundStudio } = await import(
-  "../../../src/app/(dashboard)/dashboard/playground/PlaygroundStudio"
-);
+const { PlaygroundStudio } =
+  await import("../../../src/app/(dashboard)/dashboard/playground/PlaygroundStudio");
+
+// Let every tab import started by the next/dynamic mock settle while the jsdom
+// environment is still alive (see dynamicImports above).
+afterAll(async () => {
+  await Promise.all(dynamicImports);
+});
 
 // ── Helpers ────────────────────────────────────────────────────────────────────
 
@@ -141,8 +155,9 @@ function renderStudio(): HTMLDivElement {
 
 describe("PlaygroundStudio", () => {
   beforeEach(() => {
-    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
-      .IS_REACT_ACT_ENVIRONMENT = true;
+    (
+      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
+    ).IS_REACT_ACT_ENVIRONMENT = true;
   });
 
   afterEach(() => {
@@ -182,7 +197,8 @@ describe("PlaygroundStudio", () => {
   it("switches to API tab when clicked", () => {
     const el = renderStudio();
     const tabButtons = el.querySelectorAll("[role='tab']");
-    const apiTab = Array.from(tabButtons).find((b) => b.textContent?.includes("tabApi")) as HTMLButtonElement | undefined;
+    const apiTab = Array.from(tabButtons).find((b) => b.textContent?.includes("tabApi")) as
+      HTMLButtonElement | undefined;
 
     expect(apiTab).toBeTruthy();
     act(() => {
@@ -196,9 +212,8 @@ describe("PlaygroundStudio", () => {
   it("switches to Compare tab and marks it active", () => {
     const el = renderStudio();
     const tabButtons = el.querySelectorAll("[role='tab']");
-    const compareTab = Array.from(tabButtons).find((b) =>
-      b.textContent?.includes("tabCompare")
-    ) as HTMLButtonElement | undefined;
+    const compareTab = Array.from(tabButtons).find((b) => b.textContent?.includes("tabCompare")) as
+      HTMLButtonElement | undefined;
 
     act(() => {
       compareTab?.click();
@@ -212,9 +227,8 @@ describe("PlaygroundStudio", () => {
   it("switches to Build tab and marks it active", () => {
     const el = renderStudio();
     const tabButtons = el.querySelectorAll("[role='tab']");
-    const buildTab = Array.from(tabButtons).find((b) =>
-      b.textContent?.includes("tabBuild")
-    ) as HTMLButtonEl
```

---

### Incident Patch 10: `fc8e91b1` (2026-09-29)
**Commit Message**: fix(deps): scope two nested overrides so npm 10 accepts the lockfile again (#15122)

Release-captain CI fix (v3.8.51 release PR #11442, Release acceptance): #13661's promptfoo bump made two nested overrides reach the wrong nodes, so the lockfile was only valid for npm 11. Each override is now scoped to the version it was written for (promptfoo > undici@7, rimraf > minimatch@9); npm 10/11/12 resolve the same tree (bisected 602161d; ci --dry-run exits 0 on 10.9.8/11/12; audit unchanged).

**File**: `changelog.d/fixes/0000-lockfile-npm10-override-conflict.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- **fix(deps):** Make `package-lock.json` valid for npm 10 again (the Node 22 `npm ci` in Release acceptance had rejected it since #13661): scope the `promptfoo > undici` override to `undici@7` and the `rimraf > minimatch > brace-expansion` override to `minimatch@9`, so `@ai-sdk/provider-utils` keeps its declared `undici@^6` (6.29.0) and the `minimatch@3` shared with the ESLint plugins keeps `brace-expansion@^1` (1.1.21). npm 10, 11 and 12 now resolve the same tree.
```

**File**: `package-lock.json` (modified, +16/-8)
```diff
@@ -235,13 +235,13 @@
       }
     },
     "node_modules/@ai-sdk/provider-utils/node_modules/undici": {
-      "version": "7.29.1",
-      "resolved": "https://registry.npmjs.org/undici/-/undici-7.29.1.tgz",
-      "integrity": "sha512-RYONW2MeafgYlkVOKYKkA/Ag7BmXqgIWCa8t1m0JcxrQg9pI9lEqRhAOruOBCbAohOa/gkCF+iPi9hrgvTzu6Q==",
+      "version": "6.29.0",
+      "resolved": "https://registry.npmjs.org/undici/-/undici-6.29.0.tgz",
+      "integrity": "sha512-R+RODBqp6i2pPflGdq+xIOUkl+RNfGgHwoinecKu/JCuf2uO06cOKoDbI2P7Dn6KcswdKwrczbU6IYJ6K8X+wg==",
       "dev": true,
       "license": "MIT",
       "engines": {
-        "node": ">=20.18.1"
+        "node": ">=18.17"
       }
     },
     "node_modules/@alcalzone/ansi-tokenize": {
@@ -18039,6 +18039,13 @@
       "integrity": "sha512-VRhuHOLoKYOy4UbilLbUzbYg93XLjv2PncJC50EuTWPA3gaja1UjBsUP/D/9/juV3vQFr6XBEzn9KCAHdUvOHw==",
       "license": "MIT"
     },
+    "node_modules/concat-map": {
+      "version": "0.0.1",
+      "resolved": "https://registry.npmjs.org/concat-map/-/concat-map-0.0.1.tgz",
+      "integrity": "sha512-/Srv4dswyQNBfohGpz9o6Yb3Gz3SrUDqBH5rTuhGR7ahtlbYKnVxw2bCFMRljaA7EXHaXZ8wsHdodFvbkhKmqg==",
+      "dev": true,
+      "license": "MIT"
+    },
     "node_modules/concat-stream": {
       "version": "2.0.0",
       "resolved": "https://registry.npmjs.org/concat-stream/-/concat-stream-2.0.0.tgz",
@@ -29554,13 +29561,14 @@
       }
     },
     "node_modules/minimatch/node_modules/brace-expansion": {
-      "version": "2.1.4",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-2.1.4.tgz",
-      "integrity": "sha512-hGfVzPxthbf3+2yjg/RBs60cB0FhqBS/zvdV/4wn4/BmN0bNMMHPc4V/BbFieqf1TKAGGAHnY4eSjajCl0f2Xg==",
+      "version": "1.1.21",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.21.tgz",
+      "integrity": "sha512-9zeA+KLZNNzglF2TPKRQEDyx6Yby7daAkuy8MiPzpXPsYDWi/DRM8jmwUDxokQjYqBpv5DgPiwD4h4ZZSy1Ujw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "balanced-match": "^1.0.0"
+        "balanced-match": "^1.0.0",
+        "concat-map": "0.0.1"
       }
     },
     "node_modules/minimist": {
```

**File**: `package.json` (modified, +2/-2)
```diff
@@ -520,7 +520,7 @@
     "adm-zip": "^0.6.1",
     "promptfoo": {
       "js-yaml": "^5.2.2",
-      "undici": "^7.29.0"
+      "undici@7": "^7.29.0"
     },
     "socket.io-parser": "^4.2.7",
     "tar": "^7.5.21",
@@ -530,7 +530,7 @@
       }
     },
     "rimraf": {
-      "minimatch": {
+      "minimatch@9": {
         "brace-expansion": "^2.1.4"
       }
     },
```

#### Recent Merged Pull Requests:
- **PR #15165** (2026-09-30): fix(release): let an Electron dispatch build the ref it is dispatched on again (@diegosouzapw)
- **PR #15157** (2026-09-30): fix(electron): resync electron/package-lock.json with its package.json (@diegosouzapw)
- **PR #15147** (2026-09-29): fix(build): derive the pack-boot CLI token against the smoke's DATA_DIR (@diegosouzapw)
- **PR #15146** (2026-09-29): fix(security): require admin for API-key routes and reserve login slots during password checks (@diegosouzapw)
- **PR #15145** (2026-09-29): test(e2e): align four release E2E specs with contracts shipped by #11670/#11798 (@diegosouzapw)
- **PR #15134** (2026-09-29): test(lease): classify the connection re-read #15130 added to the provider test route (@diegosouzapw)
- **PR #15130** (2026-09-29): fix(release): drain base-reds r7 of v3.8.51 — connection-test operator-disable race, two vitest teardown leaks (@diegosouzapw)
- **PR #15128** (2026-09-29): fix(idempotency): namespace the replay key by the calling API key (@MumuTW)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
