# Verification Protocol: Verification Protocol: Empirical Defect Shield for tickernelz/opencode-mem

<!-- PROVENANCE_START
{
  "source_repository": "tickernelz/opencode-mem",
  "source_url": "https://github.com/tickernelz/opencode-mem",
  "source_version": "e38c8744",
  "license": "MIT",
  "timestamp": "2026-11-24T18:17:38.088Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tickernelz-opencode-mem",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tickernelz/opencode-mem](https://github.com/tickernelz/opencode-mem) (Revision: `e38c8744`).  
> **License**: MIT | **Timestamp**: `2026-11-24T18:17:38.088Z`  
> **Learning ID**: `learn-github-tickernelz-opencode-mem`


## 1. Scope & Verification Target
- **Target Repository**: `tickernelz/opencode-mem` (Commit: `e38c8744`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): tickernelz/opencode-mem

> **Canonical Artifact**: `07_PROJECT_LEARNING/tickernelz-opencode-mem-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tickernelz/opencode-mem](https://github.com/tickernelz/opencode-mem))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-24T18:17:36.560Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tickernelz/opencode-mem`
- **Description**: OpenCode plugin that gives coding agents persistent memory using local vector database
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1887 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/services/embedding-worker-protocol.ts`
```
/**
 * JSON-line IPC between the embedding parent and the local-ONNX subprocess.
 *
 * On Windows, loading `onnxruntime-node` inside the OpenCode/Bun host segfaults
 * (#518 / oven-sh/bun#28008). The parent keeps the protocol; the child alone
 * loads transformers + ORT and is SIGKILL'd on dispose so NAPI finalizers
 * never run in the host address space.
 */

export type EmbeddingWorkerWarmupRequest = {
  id: number;
  type: "warmup";
  model: string;
  cacheDir: string;
  pooling: string;
  dtype?: string;
};

export type EmbeddingWorkerEmbedRequest = {
  id: number;
  type: "embed";
  text: string;
  pooling: string;
};

export type EmbeddingWorkerDisposeRequest = {
  id: number;
  type: "dispose";
};

export type EmbeddingWorkerRequest =
  EmbeddingWorkerWarmupRequest | EmbeddingWorkerEmbedRequest | EmbeddingWorkerDisposeRequest;

export type EmbeddingWorkerOkResponse = {
  id: number;
  ok: true;
  vector?: number[];
};

export type EmbeddingWorkerErrorResponse = {
  id: number;
  ok: false;
  error: string;
};

export type EmbeddingWorkerResponse = EmbeddingWorkerOkResponse | EmbeddingWorkerErrorResponse;

export function parseWorkerResponse(line: string): EmbeddingWorkerResponse {
  const parsed = JSON.parse(line) as EmbeddingWorkerResponse;
  if (typeof parsed?.id !== "number" || typeof parsed?.ok !== "boolean") {
    throw new Error(`embedding-worker: invalid response: ${line.slice(0, 200)}`);
  }
  return parsed;
}

```

### Core Architecture Module: `src/services/embedding-worker.ts`
```
/**
 * Local-ONNX embedding worker process.
 *
 * Run with `OPENCODE_MEM_EMBEDDING_WORKER=1` (or as `import.meta.main`). Loads
 * `@huggingface/transformers` / `onnxruntime-node` only in this address space.
 * The parent SIGKILLs us on shutdown so ORT's NAPI finalizer never runs in the
 * OpenCode/Bun host (#518).
 */

import { createInterface } from "node:readline";
import { join } from "node:path";
import {
  prepareOnnxruntimeForTransformers,
  formatOnnxruntimeInitError,
} from "./onnxruntime-resolve.js";
import { createRuntimeRequire } from "./runtime-require.js";
import {
  getTransformersPackageSpecifier,
  resolveTransformersCjsEntry,
} from "./transformers-resolve.js";
import type {
  EmbeddingWorkerRequest,
  EmbeddingWorkerResponse,
} from "./embedding-worker-protocol.js";

const requireFromHere = createRuntimeRequire(import.meta);

type Pipe = {
  (text: string, opts: { pooling: string; normalize: boolean }): Promise<{ data: Float32Array }>;
  dispose?: () => Promise<void>;
};

let pipe: Pipe | null = null;

function send(response: EmbeddingWorkerResponse): void {
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

// Keep stdout reserved for JSON-line IPC; route casual logs to stderr.
console.log = (...args: unknown[]) => {
  process.stderr.write(`${args.map(String).join(" ")}\n`);
};
console.info = console.log;
console.debug = console.log;

async function loadPipeline(model: string, cacheDir: string, dtype?: string): Promise<Pipe> {
  const transformersSpecifier = getTransformersPackageSpecifier();
  const meta = import.meta as ImportMeta & { path?: string; dirname?: string; dir?: string };
  const transformersEntry = resolveTransformersCjsEntry({
    requireFn: requireFromHere,
    specifier: transformersSpecifier,
    startPaths: [meta.url, meta.path, meta.dirname, meta.dir, process.cwd()],
  });

  prepareOnnxruntimeForTransformers();
  const mod = requireFromHere(transformersEntry) as typeof import("@huggingface/transformers");
  mod.env.allowLocalModels = true;
  mod.env.allowRemoteModels = true;
  mod.env.cacheDir = cacheDir;
  try {
    (mod.env as any).backends.onnx.wasm.numThreads = 1;
  } catch {
    // Optional; wasm settings may be absent under the node ORT backend.
  }

  // Parent resolves dtype (config / cache probe) before spawn.
  const created = await mod.pipeline("feature-extraction", model, {
    ...(dtype ? { dtype: dtype as "fp32" | "fp16" | "q8" | "auto" } : {}),
  });
  return created as unknown as Pipe;
}

async function handle(request: EmbeddingWorkerRequest): Promise<void> {
  try {
    switch (request.type) {
      case "warmup": {
        if (pipe?.dispose) {
          try {
            await pipe.dispose();
          } catch {
            // Replace the previous pipeline even if dispose fails.
          }
        }
        pipe = await loadPipeline(
          request.model,
          request.cacheDir || join(process.cwd(), ".cache"),
          request.dtype
        );
        send({ id: request.id, ok: true });
        return;
      }
      case "embed": {
        if (!pipe) {
          send({ id: request.id, ok: false, error: "embedding-worker: not warmed up" });
          return;
        }
        const output = await pipe(request.text, {
          pooling: request.pooling,
          normalize: true,
        });
        send({ id: request.id, ok: true, vector: Array.from(output.data) });
        return;
      }
      case "dispose": {
        const current = pipe;
        pipe = null;
        if (current?.dispose) {
          try {
            await current.dispose();
          } catch {
            // Parent will SIGKILL us; best-effort dispose only.
          }
        }
        send({ id: request.id, ok: true });
        return;
      }
      default: {
        const unknown = request as { id?: number };
        send({
          id: typeof unknown.id === "number" ? unknown.id : -1,
          ok: false,
          error: "embedding-worker: unknown request type",
        });
      }
    }
  } catch (error) {
    const rewritten = formatOnnxruntimeInitError(error);
    send({
      id: request.id,
      ok: false,
      error: rewritten.message,
    });
  }
}

export async function runEmbeddingWorker(): Promise<void> {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let request: EmbeddingWorkerRequest;
    try {
      request = JSON.parse(trimmed) as EmbeddingWorkerRequest;
    } catch (error) {
      send({
        id: -1,
        ok: false,
        error: `embedding-worker: invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }
    await handle(request);
  }
}

const isWorkerMain =
  process.env.OPENCODE_MEM_EMBEDDING_WORKER === "1" ||
  (typeof import.meta !== "undefined" &&
    Boolean((import.meta as ImportMeta & { main?: boolean }).main));

if (isWorkerMain) {
  void runEmbeddingWorker().catch((error) => {
    send({
      id: -1,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  });
}

```

### Core Architecture Module: `src/services/turso/engine-migrator.ts`
```
import { createClient, type Client } from "@libsql/client";
import { connect } from "@tursodatabase/database";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { CONFIG } from "../../config.js";
import { log } from "../logger.js";
import { acquireTursoOperationLock } from "./operation-lock.js";
import {
  withSqliteFileLockRetry,
  renameSqliteDatabase,
  copySqliteDatabase,
  removeSqliteDatabase,
  collectReleasedSqliteHandles,
} from "./sqlite-handle-release.js";
import {
  tursoConnectionManager,
  resolveDatabaseEncryption,
  buildConnectOptions,
} from "./connection-manager.js";
import { TursoDb } from "./turso-db.js";
import { tursoShardManager } from "./shard-manager.js";
import { parseExtractedVector } from "./vector-utils.js";

const ENGINE_MARKER = ".tursodb-engine-v1";
const LIBSQL_VECTOR_INDEX_RE = /libsql_vector_idx/i;

/** libsql 0.18 defaults to a multi-handle pool; keep one connection for file DBs. */
function openLibsql(dbPath: string): Client {
  return createClient({
    url: `file:${dbPath}`,
    concurrency: 1,
    timeout: 5_000,
  });
}

function markerPath(): string {
  return join(CONFIG.storagePath, ENGINE_MARKER);
}

function listDbFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".db") && !name.includes(".bak") && !name.includes(".tmp"))
    .map((name) => join(dir, name));
}

function collectCandidateDbs(): string[] {
  const root = CONFIG.storagePath;
  return [
    ...listDbFiles(root),
    ...listDbFiles(join(root, "users")),
    ...listDbFiles(join(root, "projects")),
  ];
}

async function needsEngineRewrite(dbPath: string): Promise<boolean> {
  try {
    const encryption = resolveDatabaseEncryption();
    const db = await connect(dbPath, buildConnectOptions(encryption));
    try {
      await db.all("SELECT 1");
      return false;
    } finally {
      await db.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      LIBSQL_VECTOR_INDEX_RE.test(message) ||
      /invalid expression in CREATE INDEX/i.test(message)
    ) {
      return true;
    }
    // Unencrypted DB with encryption configured (or vice versa) is handled elsewhere.
    if (/encrypt|cipher|key/i.test(message)) {
      return false;
    }
    // Unknown open failure: try libsql probe for DiskANN indexes.
    try {
      const client = openLibsql(dbPath);
      try {
        const result = await client.execute(
          `SELECT sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL`
        );
        return result.rows.some((row) => LIBSQL_VECTOR_INDEX_RE.test(String(row.sql ?? "")));
      } finally {
        client.close();
      }
    } catch {
      return false;
    }
  }
}

async function copyTableViaLibsql(
  sourcePath: string,
  targetDb: TursoDb,
  table: string,
  heartbeat: () => void
): Promise<number> {
  const client = openLibsql(sourcePath);
  try {
    const tableInfo = await client.execute(`PRAGMA table_info(${table})`);
    if (tableInfo.rows.length === 0) return 0;
    const columns = tableInfo.rows.map((row) => String(row.name));
    const selectCols = columns
      .map((col) =>
        col === "vector" || col === "tags_vector"
          ? `CASE WHEN ${col} IS NOT NULL THEN vector_extract(${col}) ELSE NULL END AS ${col}`
          : col
      )
      .join(", ");
    const rows = await client.execute(`SELECT ${selectCols} FROM ${table}`);
    let imported = 0;
    for (const row of rows.rows) {
      const sqlPlaceholders: string[] = [];
      const sqlArgs: Array<string | number | null> = [];
      for (const col of columns) {
        const raw = row[col];
        if (col === "vector" || col === "tags_vector") {
          if (raw == null) {
            sqlPlaceholders.push("NULL");
          } else {
            const extracted =
              typeof raw === "string"
                ? raw
                : JSON.stringify(Array.from(parseExtractedVector(raw) ?? []));
            sqlPlaceholders.push("vector32(?)");
            sqlArgs.push(extracted);
          }
        } else {
          sqlPlaceholders.push("?");
          if (raw == null) sqlArgs.push(null);
          else if (typeof raw === "number" || typeof raw === "string") sqlArgs.push(raw);
          else if (typeof raw === "bigint") sqlArgs.push(Number(raw));
          else if (typeof raw === "boolean") sqlArgs.push(raw ? 1 : 0);
          else sqlArgs.push(String(raw));
        }
      }
      await targetDb.run(
        `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${sqlPlaceholders.join(", ")})`,
        sqlArgs
      );
      imported += 1;
      heartbeat();
    }
    return imported;
  } finally {
    client.close();
  }
}

async function rewriteMemoryShard(dbPath: string, heartbeat: () => void): Promise<void> {
  const client = openLibsql(dbPath);
  let dims = CONFIG.embeddingDimensions;
  let model = CONFIG.embeddingModel;
  try {
    try {
      const dimRow = await client.execute(
        `SELECT value FROM shard_metadata WHERE key = 'embedding_dimensions'`
      );
      if (dimRow.rows[0]?.value) dims = Number(dimRow.rows[0].value);
      const modelRow = await client.execute(
        `SELECT value FROM shard_metadata WHERE key = 'embedding_model'`
      );
      if (modelRow.rows[0]?.value) model = String(modelRow.rows[0].value);
    } catch {
      // metadata table may be missing on very old shards
    }
  } finally {
    client.close();
  }

  const stagedPath = `${dbPath}.tursodb-migrate-${Date.now()}.tmp`;
  const backupPath = `${dbPath}.pre-tursodb-${Date.now()}.bak`;
  const dir = dirname(stagedPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  await tursoConnectionManager.closeConnection(dbPath);
  const staged = await tursoConnectionManager.getConnection(stagedPath);
  try {
    await tursoShardManager.initShardDb(staged, dims, model);
    const imported = await copyTableViaLibsql(dbPath, staged, "memories", heartbeat);
    const metaClient = openLibsql(dbPath);
    try {
      const metaRows = await metaClient
        .execute(`SELECT key, value FROM shard_metadata`)
        .catch(() => null);
      for (const row of metaRows?.rows ?? []) {
        try {
          await staged.run(`INSERT OR REPLACE INTO shard_metadata (key, value) VALUES (?, ?)`, [
            String(row.key),
            String(row.value),
          ]);
        } catch {
          // Metadata is optional; do not swallow ownership failures below.
          break;
        }
        heartbeat();
      }
    } finally {
      metaClient.close();
    }

    const countRow = await staged.get<{ count?: number }>(`SELECT COUNT(*) as count FROM memories`);
    if (Number(countRow?.count ?? 0) !== imported) {
      throw new Error(
        `Engine migration count mismatch for ${dbPath}: expected ${imported}, got ${countRow?.count}`
      );
    }
  } finally {
    await tursoConnectionManager.closeConnection(stagedPath);
  }

  // Match encryption-migrator: Windows cannot rename over an existing file (EPERM).
  // Pre-swap aborts preserve the original and may leave a staged temp file.
  heartbeat();
  await withSqliteFileLockRetry(() => {
    copySqliteDatabase(dbPath, backupPath);
    removeSqliteDatabase(dbPath);
    renameSqliteDatabase(stagedPath, dbPath);
  });
  heartbeat();

  log("Migrated libSQL DiskANN shard to @tursodatabase/database", {
    dbPath,
    backupPath,
  });
}

async function rewriteGenericDb(
  dbPath: string,
  tables: string[],
  heartbeat: () => void
): Promise<void> {
  const stagedPath = `${dbPath}.tursodb-migrate-${Date.now()}.tmp`;
  const backupPath = `${dbPath}.pre-tursodb-${Date.now()}.bak`;

  await tursoConnectionManager.closeConnection(dbPath);
  const encryption = resolveDatabaseEncryption();
  const stagedNative = await connect(stagedPath, buildConnectOptions(encryption));
  const staged = new TursoDb(stagedNative);
  try {
    // Recreate schema by copying CREATE SQL from source via libsql.
    const source = openLibsql(dbPath);
    try {
      for (const table of tables) {
        heartbeat();
        const schema = await source.execute({
          sql: `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`,
          args: [table],
        });
        const createSql = schema.rows[0]?.sql ? String(schema.rows[0].sql) : null;
        if (!createSql) continue;
        await staged.run(createSql.replace(/F32_BLOB/gi, "BLOB"));
        await copyTableViaLibsql(dbPath, staged, table, heartbeat);
      }
      const indexes = await source.execute(
        `SELECT sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%'`
      );
      for (const row of indexes.rows) {
        const sql = String(row.sql);
        if (LIBSQL_VECTOR_INDEX_RE.test(sql)) continue;
        try {
          await staged.run(sql);
        } catch {
          // index may already exist from CREATE TABLE
        }
        heartbeat();
      }
    } finally {
      source.close();
    }
  } finally {
    await staged.close();
    await collectReleasedSqliteHandles();
  }

  // Match encryption-migrator: Windows cannot rename over an existing file (EPERM).
  // Pre-swap aborts preserve the original and may leave a staged temp file.
  heartbeat();
  await withSqliteFileLockRetry(() => {
    copySqliteDatabase(dbPath, backupPath);
    removeSqliteDatabase(dbPath);
    renameSqliteDatabase(stagedPath, dbPath);
  });
  heartbeat();
  log("Migrated auxiliary DB to @tursodatabase/database", { dbPath, backupPath });
}

/**
 * Convert any local shards that still use libSQL DiskANN indexes into plain
 * @tursodatabase/database files (F32_BLOB + exact cosine search).
 */
export async function runTursoEngineMigration(): Promise<void> {
  if (existsSync(markerPath())) return;

  const candidates = collectCandidateDbs();
  if (candida
```

### Core Architecture Module: `src/services/turso/lifecycle.ts`
```
import { tursoConnectionManager } from "./connection-manager.js";
import { tursoShardManager } from "./shard-manager.js";
import { resetTursoReady } from "./ready.js";
import { userPromptManager } from "../user-prompt/user-prompt-manager.js";
import { userProfileManager } from "../user-profile/user-profile-manager.js";
import { aiSessionManager } from "../ai/session/ai-session-manager.js";
import { skillsManager } from "../skills/skills-manager.js";
import { releasePluginTursoLease } from "./plugin-refs.js";

export {
  retainPluginTurso,
  pluginTursoRefCount,
  resetPluginTursoRefsForTests,
} from "./plugin-refs.js";

/**
 * Drop one plugin-instance lease. Closes the process-wide pool only when the
 * last live instance is gone (or when no retain was recorded — tests / force
 * close via `memoryClient.close()`).
 *
 * @returns `true` when connections were closed and manager caches invalidated
 */
export async function releasePluginTurso(): Promise<boolean> {
  if (!releasePluginTursoLease()) {
    return false;
  }
  await closeTursoAndInvalidateCaches();
  return true;
}

export async function closeTursoAndInvalidateCaches(): Promise<void> {
  await tursoConnectionManager.closeAll();
  tursoShardManager.reset();
  resetTursoReady();
  userPromptManager.reset();
  userProfileManager.reset();
  aiSessionManager.reset();
  skillsManager.reset();
}

```

### Core Architecture Module: `src/services/turso/vector-utils.ts`
```
export function vectorToJson(vector: Float32Array): string {
  return JSON.stringify(Array.from(vector));
}

export function blobToFloat32Array(value: unknown): Float32Array | null {
  if (value == null) return null;

  try {
    if (value instanceof Float32Array) {
      return value;
    }

    if (value instanceof ArrayBuffer) {
      if (value.byteLength === 0 || value.byteLength % 4 !== 0) {
        return null;
      }
      return new Float32Array(value);
    }

    if (ArrayBuffer.isView(value)) {
      const view = value as ArrayBufferView;
      const byteLength = view.byteLength;
      if (byteLength === 0 || byteLength % 4 !== 0) {
        return null;
      }
      return new Float32Array(
        view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength)
      );
    }

    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value) as number[];
        return new Float32Array(parsed);
      } catch {
        return null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

/** Parse libSQL `vector_extract()` JSON output (preferred over raw F32_BLOB bytes). */
export function parseExtractedVector(value: unknown): Float32Array | null {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as number[];
      if (!Array.isArray(parsed) || parsed.length === 0) return null;
      return new Float32Array(parsed);
    } catch {
      return null;
    }
  }
  return blobToFloat32Array(value);
}

export function distanceToSimilarity(distance: number): number {
  const similarity = 1 - Number(distance);
  if (!Number.isFinite(similarity)) return 0;
  // Clamp float artifacts (docs: cos-distance can be slightly negative near exact matches).
  return Math.max(0, Math.min(1, similarity));
}

/** Canonical text used for tag-vector embeddings (must stay consistent across write paths). */
export function formatTagsForEmbedding(tags: string[]): string {
  return `Topics: ${tags.join(", ")}`;
}

/** Split free text into lowercase tokens for keyword / hybrid search. */
export function tokenizeQueryText(text: string | undefined | null): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/[\s,._/-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1)
    .slice(0, 16);
}

/**
 * Escape LIKE wildcards so user tokens are matched literally.
 * Pair with `ESCAPE '\\'` in SQL.
 */
export function escapeLikePattern(token: string): string {
  return token.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function parseSessionIdFromMetadata(metadata: string | undefined | null): string | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata) as Record<string, unknown>;
    return typeof parsed.sessionID === "string" && parsed.sessionID.length > 0
      ? parsed.sessionID
      : null;
  } catch {
    return null;
  }
}

```

### Core Architecture Module: `src/services/user-profile/profile-utils.ts`
```
export const safeArray = <T>(arr: any): T[] => {
  if (!arr) return [];
  let result = arr;
  if (typeof result === "string") {
    try {
      result = JSON.parse(result);
    } catch {
      try {
        result = JSON.parse(result.trim().replace(/,$/, ""));
      } catch {
        return [];
      }
    }
  }
  if (!Array.isArray(result)) return [];

  const flattened: T[] = [];
  const walk = (item: any) => {
    if (Array.isArray(item)) {
      item.forEach(walk);
    } else if (item) {
      flattened.push(item);
    }
  };
  walk(result);
  return flattened;
};

/**
 * Remove per-item embedding vectors (`centroid`/`anchor`) from profile data.
 *
 * Those 768-dim vectors are only used internally for similarity, dedup and
 * drift detection. Returning them to the model or the read-only API inflates
 * the payload by hundreds of KB, so callers that serialize profile data for
 * display must strip them first. Mutates in place and returns the same object.
 */
export const stripProfileEmbeddings = <T>(data: T): T => {
  if (!data || typeof data !== "object") return data;
  const container = data as Record<string, unknown>;
  for (const key of ["preferences", "patterns", "workflows"]) {
    const items = container[key];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (item && typeof item === "object") {
        delete (item as Record<string, unknown>).centroid;
        delete (item as Record<string, unknown>).anchor;
      }
    }
  }
  return data;
};

/**
 * Clone profile data and strip embeddings for public responses.
 * Use this when the original object must keep embeddings (e.g. pending cleanups).
 */
export const toPublicProfileData = <T>(data: T): T => {
  return stripProfileEmbeddings(structuredClone(data));
};

export const safeObject = <T extends object>(obj: any, fallback: T): T => {
  if (!obj) return fallback;
  let result = obj;
  if (typeof result === "string") {
    try {
      result = JSON.parse(result);
    } catch {
      return fallback;
    }
  }
  return result && typeof result === "object" && !Array.isArray(result) ? (result as T) : fallback;
};

```

### Core Architecture Module: `src/utils/context-limit.ts`
```
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** UTF-8 byte length of a string. */
export function utf8ByteLength(text: string): number {
  return encoder.encode(text).byteLength;
}

/** Decode a UTF-8 byte slice without splitting multi-byte characters. */
export function sliceUtf8Bytes(text: string, start: number, end?: number): string {
  const bytes = encoder.encode(text);
  let from = Math.max(0, Math.min(start, bytes.length));
  let to = Math.min(bytes.length, end ?? bytes.length);
  if (to <= from) return "";

  // If `from` lands inside a multi-byte character, advance to the next lead byte.
  while (from < to && (bytes[from]! & 0xc0) === 0x80) {
    from++;
  }

  // If `to` lands inside a multi-byte character, back up to that character's start.
  while (to > from && (bytes[to]! & 0xc0) === 0x80) {
    to--;
  }

  return decoder.decode(bytes.subarray(from, to));
}

/**
 * Truncate text to at most `maxBytes` UTF-8 bytes.
 * Prefers keeping the start and end (head + tail) when space allows,
 * so summaries retain both opening context and closing conclusions.
 */
export function truncateToMaxBytes(
  text: string,
  maxBytes: number,
  marker = "\n[... truncated ...]\n"
): string {
  if (maxBytes <= 0) return "";
  if (utf8ByteLength(text) <= maxBytes) return text;

  const markerBytes = utf8ByteLength(marker);
  if (maxBytes <= markerBytes) {
    return sliceUtf8Bytes(text, 0, maxBytes);
  }

  const available = maxBytes - markerBytes;
  const headBytes = Math.floor(available / 2);
  const tailBytes = available - headBytes;
  const totalBytes = utf8ByteLength(text);

  return sliceUtf8Bytes(text, 0, headBytes) + marker + sliceUtf8Bytes(text, totalBytes - tailBytes);
}

```

### Core Architecture Module: `src/utils/math.ts`
```
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    magA += av * av;
    magB += bv * bv;
  }

  if (magA === 0 || magB === 0) return 0;

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Cosine similarity for number[] (JSON-stored centroids), otherwise
 * identical to the Float32Array version above.
 */
export function cosineSimilarityNumbers(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    magA += av * av;
    magB += bv * bv;
  }

  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function l2Normalize(vec: number[]): number[] {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) {
    norm += (vec[i] ?? 0) * (vec[i] ?? 0);
  }
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

```

### Core Architecture Module: `src/utils/profile.ts`
```
export function isFrozen(item: any): boolean {
  return (item.driftBelowCount || 0) >= 2;
}

export function sortProfileItems(items: any[], metric: "confidence" | "frequency"): any[] {
  return [...items].sort((a, b) => {
    const aFrozen = isFrozen(a) ? 1 : 0;
    const bFrozen = isFrozen(b) ? 1 : 0;
    if (aFrozen !== bFrozen) return aFrozen - bFrozen;
    if (metric === "confidence") {
      return (b.confidence || 0) - (a.confidence || 0) || (b.frequency || 1) - (a.frequency || 1);
    }
    return (b.frequency || 0) - (a.frequency || 0);
  });
}

```

### Core Architecture Module: `web/scripts/render-banner.mjs`
```
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const out = path.join(root, ".github/pics/banner.png");
const fontDir = "/tmp/jetbrains-mono/fonts/ttf";

/** Keep in sync with `web/src/app.css` (.dark) — see `web/README.md`. */
const colors = {
  background: "#0a0a0a",
  panel: "#111111",
  card: "#141414",
  border: "#2a2a2a",
  foreground: "#d4d4d4",
  foregroundBright: "#ffffff",
  muted: "#8a8a8a",
  /** Dark primary — matches `--primary` / Lucide Brain favicon */
  primary: "#c4b5fd",
  /** Dark accent well — matches `--accent` / sidebar ICON_WELL base */
  accentWell: "#1a1428",
};

const W = 1200;
const H = 300;
const CX = W / 2;

/** JetBrains Mono advance ≈ 0.6em */
function monoWidth(text, size) {
  return text.length * size * 0.6;
}

const brainPaths = `
  <path d="M12 18V5"/>
  <path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4"/>
  <path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5"/>
  <path d="M17.997 5.125a4 4 0 0 1 2.526 5.77"/>
  <path d="M18 18a4 4 0 0 0 2-7.464"/>
  <path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517"/>
  <path d="M6 18a4 4 0 0 1-2-7.464"/>
  <path d="M6.003 5.125a4 4 0 0 0-2.526 5.77"/>
`;

const brand = "opencode-mem";
const brandSize = 48;
const logo = 68;
const brandGap = 20;
const brandTextW = monoWidth(brand, brandSize);
const brandGroupW = logo + brandGap + brandTextW;
const brandX = CX - brandGroupW / 2;
const brandY = 78;

const subtitle = "PERSISTENT MEMORY FOR AI CODING AGENTS";
const features = [
  { label: "LOCAL VECTOR DATABASE", color: colors.primary },
  { label: "NO API KEYS REQUIRED", color: colors.primary },
  { label: "CROSS-SESSION CONTEXT", color: colors.primary },
];
const featSize = 13;
const featGap = 36;
const featItems = features.map((f) => ({
  ...f,
  width: 10 + 8 + monoWidth(f.label, featSize),
}));
const featTotal = featItems.reduce((sum, f) => sum + f.width, 0) + featGap * (featItems.length - 1);
let featX = CX - featTotal / 2;

const featRow = featItems
  .map((f) => {
    const chunk = `
    <g transform="translate(${featX}, 0)">
      <circle cx="4" cy="-4" r="4" fill="${f.color}"/>
      <text x="18" y="0">${f.label}</text>
    </g>`;
    featX += f.width + featGap;
    return chunk;
  })
  .join("");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <!-- Image ends at the frame: fill full canvas, stroke sits on the edge -->
  <rect width="${W}" height="${H}" fill="${colors.panel}"/>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="12" fill="${colors.panel}" stroke="${colors.primary}" stroke-width="2"/>

  <g transform="translate(${brandX}, ${brandY})">
    <!-- Same recipe as web ICON_WELL: primary/15 over dark surface + primary icon -->
    <rect width="${logo}" height="${logo}" rx="16" fill="${colors.card}"/>
    <rect width="${logo}" height="${logo}" rx="16" fill="${colors.primary}" fill-opacity="0.15"/>
    <g transform="translate(10, 10)" stroke="${colors.primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <g transform="scale(2)">${brainPaths}</g>
    </g>
    <text
      x="${logo + brandGap}"
      y="${logo / 2}"
      text-anchor="start"
      font-family="JetBrains Mono"
      font-weight="700"
      font-size="${brandSize}"
      fill="${colors.foregroundBright}"
      dominant-baseline="middle"
    >${brand}</text>
  </g>

  <text
    x="${CX}"
    y="188"
    text-anchor="middle"
    font-family="JetBrains Mono"
    font-weight="400"
    font-size="15"
    fill="${colors.muted}"
    letter-spacing="3"
  >${subtitle}</text>

  <g transform="translate(0, 246)" font-family="JetBrains Mono" font-size="${featSize}" fill="${colors.muted}">
    ${featRow}
  </g>
</svg>`;

const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: W },
  font: {
    fontFiles: [
      `${fontDir}/JetBrainsMono-Bold.ttf`,
      `${fontDir}/JetBrainsMono-Regular.ttf`,
      `${fontDir}/JetBrainsMono-SemiBold.ttf`,
    ],
    loadSystemFonts: false,
    defaultFontFamily: "JetBrains Mono",
  },
});

writeFileSync(out, resvg.render().asPng());
console.log("wrote", out, `${resvg.width}x${resvg.height}`);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #288** (2026-08-30): **Show matched memory count while Web UI search is active**
  *Symptoms*: Split from #284 so the Web UI behavior can be fixed independently.  The memory explorer count continues to display the store-wide total while a search is active. It should display the number of matched results so users can tell whether the current query found anything.  Acceptance criteria: - show the filtered result count while search is active - restore the full count when search is cleared - add UI or state-level regression coverage  See #284 for the original reproduction.

- **Issue #287** (2026-09-01): **Forward memoryExtraParams in external AI cleanup requests**
  *Symptoms*: Split from #284 so provider request behavior can be fixed independently.  The external API path in `src/services/user-profile/ai-cleanup.ts` builds its request body directly and does not include configured `memoryExtraParams`. Provider-specific parameters such as `enable_thinking: false` therefore work in other model calls but are omitted during cleanup.  Acceptance criteria: - forward configured extra parameters through the cleanup request path - preserve required cleanup fields and prevent unsafe overrides - add request-body coverage  See #284 for the SiliconFlow/Qwen reproduction.

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

### Incident Patch 1: `a755b1da` (2026-11-24)
**Commit Message**: fix(embedding): isolate Windows local ONNX in a Node subprocess (#521)

* fix(embedding): isolate Windows local ONNX in a Node subprocess

Bun hosts segfault when onnxruntime-node loads in-process on Windows
(#518). Run the transformers/ORT pipeline in a Node child over JSON-line
IPC and SIGKILL it on dispose so NAPI finalizers never run in OpenCode.

* fix(embedding): harden Windows ONNX subprocess isolation

Add start mutex, spawn error handling, request timeouts, package-root
cwd/NODE_PATH, Bun-child fallback when Node is missing, stdout filtering,
and one-shot re-warmup after a worker crash so #518 stays host-safe.

* fix(embedding): harden worker discovery for OpenCode hosts

Resolve the embedding worker via import.meta.path/dirname when url is
empty (#210), search standard Node/Bun install paths beyond PATH, walk
up to the package root for node_modules, and SIGKILL a wedged child on
request timeout.

* fix(embedding): run Windows ONNX worker via OpenCode BUN_BE_BUN

When Node/Bun are not on PATH, re-exec process.execPath with BUN_BE_BUN=1
so a Bun --compile host (OpenCode standalone) acts as the Bun CLI and
runs the embedding worker without a separate runtime install (#518).

**File**: `README.md` (modified, +3/-0)
```diff
@@ -476,6 +476,8 @@ Changing `embeddingModel`, dimensions, pooling, or task prefixes can require re-
 
 Remote embeddings bypass the local ONNX runtime on supported hosts. The plugin still needs the local database binding listed under [Prerequisites](#prerequisites).
 
+**Windows + OpenCode/Bun:** Local embeddings run `onnxruntime-node` in a **subprocess** (never inside the OpenCode host) so Bun↔ORT NAPI segfaults cannot take down `opencode serve` ([#518](https://github.com/tickernelz/opencode-mem/issues/518), [oven-sh/bun#28008](https://github.com/oven-sh/bun/issues/28008)). Runtime order: Node.js → Bun on PATH → the OpenCode binary itself via `BUN_BE_BUN=1` (Bun ≥ 1.2.16; no separate Node install required). Or set `embeddingApiUrl` + `embeddingApiKey` for remote embeddings. Override with `OPENCODE_MEM_EMBEDDING_SUBPROCESS=0` (in-process, not recommended on Windows) or `=1` (force subprocess on other OSes). The parent `SIGKILL`s the worker on dispose/idle/timeout and re-spawns after a worker crash.
+
 On supported platforms, `opencode-mem` pins `onnxruntime-node@1.31.1` (Ort::Env teardown fix from `1.24.1` / #225) and loads transformers through a CJS resolve shim so OpenCode nested installs keep that binding. Transformers is resolved to an absolute path before that shim is installed so OpenCode's Bun `--compile` host does not fail with `Cannot find module '@huggingface/transformers' from ''`. After upgrading, clear OpenCode's nested plugin cache (`~/.cache/opencode/packages/opencode-mem@*`) and reinstall.
 
 ### Memory Scope
@@ -768,6 +770,7 @@ Troubleshooting:
 - For `opencodeProvider` / `opencodeModel` (e.g. DeepSeek V4 thinking), OpenCode still sends forced `tool_choice` for structured output. opencode-mem disables thinking on the internal `opencode-mem-structured` agent (and re-applies that in `chat.params` after variant merge) so auto-capture and profile learning can complete. Your interactive chat agent is unchanged. If capture still fails with a thinking/`tool_choice` error, pick a non-thinking model for `opencodeModel` or configure a complete manual fallback (`memoryModel` + `memoryApiUrl`).
 - **`opencode-claude-auth` / Claude Code:** auto-capture uses OpenCode with your authenticated `anthropic` provider. Forced `format: json_schema` often loops with Claude-auth, so opencode-mem uses an auth-preserving **text-JSON** path for `opencodeProvider: "anthropic"` (no forced `StructuredOutput` tools; reply is parsed with Zod). A step watchdog still aborts runaway internal sessions after 2 steps. If capture still fails, configure a complete manual Anthropic API-key fallback (`memoryProvider: "anthropic"` + `memoryModel` + `memoryApiUrl` + `memoryApiKey`) — Claude Pro/Max OAuth cannot be reused outside OpenCode.
 - **Unsupported platforms:** If the plugin fails to load a native binding, check the [native database requirements](#prerequisites). For containers that use musl, use a glibc-based Linux image. MLX is not supported.
+- **Windows segfault in `onnxruntime_binding.node`:** Local embeddings run ORT in a subprocess (#518), using Node, Bun, or the OpenCode binary (`BUN_BE_BUN=1`). If that still fails, configure remote embeddings (`embeddingApiUrl` + `embeddingApiKey`).
 
 ## Public Subpath Exports
 
```

**File**: `src/services/embedding-subprocess.ts` (added, +442/-0)
```diff
@@ -0,0 +1,442 @@
+/**
+ * Parent-side handle for the local-ONNX embedding subprocess (#518).
+ *
+ * Spawns a Node (preferred) or Bun child that runs `embedding-worker` so
+ * `onnxruntime-node` never loads in the OpenCode/Bun host. Dispose uses
+ * SIGKILL so ORT's NAPI finalizer cannot crash the host on Windows.
+ */
+
+import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
+import { createInterface } from "node:readline";
+import { fileURLToPath } from "node:url";
+import { existsSync } from "node:fs";
+import { homedir } from "node:os";
+import { basename, dirname, join } from "node:path";
+import { log, safeLog } from "./logger.js";
+import {
+  parseWorkerResponse,
+  type EmbeddingWorkerRequest,
+  type EmbeddingWorkerResponse,
+} from "./embedding-worker-protocol.js";
+
+export type EmbeddingSubprocessWarmup = {
+  model: string;
+  cacheDir: string;
+  pooling: string;
+  dtype?: string;
+};
+
+type Pending = {
+  resolve: (value: EmbeddingWorkerResponse) => void;
+  reject: (error: Error) => void;
+  timer: ReturnType<typeof setTimeout>;
+};
+
+type PluginImportMeta = ImportMeta & {
+  path?: string;
+  dirname?: string;
+  dir?: string;
+};
+
+const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
+
+function which(cmd: string): string | null {
+  const pathEnv = process.env.PATH ?? process.env.Path ?? "";
+  const ext =
+    process.platform === "win32"
+      ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";").filter(Boolean)
+      : [""];
+  const sep = process.platform === "win32" ? ";" : ":";
+  for (const dir of pathEnv.split(sep)) {
+    if (!dir) continue;
+    for (const e of ext) {
+      const candidate = join(dir, `${cmd}${e}`);
+      if (existsSync(candidate)) return candidate;
+    }
+  }
+  return null;
+}
+
+/** PATH plus well-known install locations (OpenCode sandboxes often omit PATH entries). */
+export function resolveRuntimeCandidates(cmd: "node" | "bun"): string[] {
+  const found: string[] = [];
+  const seen = new Set<string>();
+  const add = (path: string | null | undefined) => {
+    if (!path || seen.has(path) || !existsSync(path)) return;
+    seen.add(path);
+    found.push(path);
+  };
+
+  add(which(cmd));
+
+  const home = homedir();
+  const local = process.env.LOCALAPPDATA;
+  const pf = process.env.ProgramFiles ?? "C:\\Program Files";
+  const pf86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
+
+  if (cmd === "node") {
+    if (process.platform === "win32") {
+      add(join(pf, "nodejs", "node.exe"));
+      add(join(pf86, "nodejs", "node.exe"));
+      if (local) add(join(local, "Programs", "nodejs", "node.exe"));
+    } else {
+      add("/usr/local/bin/node");
+      add("/usr/bin/node");
+      add(join(home, ".nvm", "current", "bin", "node"));
+    }
+  } else {
+    if (process.platform === "win32") {
+      add(join(home, ".bun", "bin", "bun.exe"));
+      if (local) add(join(local, "bun", "bin", "bun.exe"));
+    } else {
+      add(join(home, ".bun", "bin", "bun"));
+      add("/usr/local/bin/bun");
+    }
+  }
+
+  return found;
+}
+
+function isBunOrNodeExecutable(path: string): boolean {
+  const name = basename(path).toLowerCase();
+  return name === "bun" || name === "bun.exe" || name === "node" || name === "node.exe";
+}
+
+export type EmbeddingWorkerRuntime = {
+  /** Executable to spawn (node, bun, or a bun --compile host such as opencode.exe). */
+  command: string;
+  /** Extra argv before the worker script path. */
+  args: string[];
+  /** Extra env for the child (merged over process.env). */
+  env: Record<string, string>;
+};
+
+/**
+ * Prefer Node so ORT runs outside Bun's NAPI host (#518). Fall back to a Bun
+ * *subprocess* (still isolated from the OpenCode host) when Node is missing —
+ * a child segfault kills only the worker, not `opencode serve`.
+ *
+ * When only a Bun `--compile` host is available (typical OpenCode standalone
+ * install with no Node/Bun on PATH), re-exec `process.execPath` with
+ * `BUN_BE_BUN=1` so the child acts as the Bun CLI and can run our worker
+ * script (Bun ≥ 1.2.16; OpenCode 2.3.x ships Bun 1.4.x).
+ */
+export function resolveEmbeddingWorkerRuntime(): EmbeddingWorkerRuntime | null {
+  const node = resolveRuntimeCandidates("node")[0];
+  if (node) return { command: node, args: [], env: {} };
+
+  const bun = resolveRuntimeCandidates("bun")[0];
+  if (bun) return { command: bun, args: [], env: {} };
+
+  if (typeof process.versions.bun === "string" && process.execPath) {
+    // OpenCode.exe / other bun --compile hosts: ignore the bundled entrypoint
+    // and run our worker as plain `bun <script>`.
+    return {
+      command: process.execPath,
+      args: [],
+      env: { BUN_BE_BUN: "1" },
+    };
+  }
+
+  if (typeof process.versions.node === "string" && isBunOrNodeExecutable(process.execPath)) {
+    return { command: process.execPath, args: [], env: {} };
+  }
+
+  return null;
+}
+
+/** Directories that may contain the sibling embedding-worker script
```

**File**: `src/services/embedding-worker-protocol.ts` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+/**
+ * JSON-line IPC between the embedding parent and the local-ONNX subprocess.
+ *
+ * On Windows, loading `onnxruntime-node` inside the OpenCode/Bun host segfaults
+ * (#518 / oven-sh/bun#28008). The parent keeps the protocol; the child alone
+ * loads transformers + ORT and is SIGKILL'd on dispose so NAPI finalizers
+ * never run in the host address space.
+ */
+
+export type EmbeddingWorkerWarmupRequest = {
+  id: number;
+  type: "warmup";
+  model: string;
+  cacheDir: string;
+  pooling: string;
+  dtype?: string;
+};
+
+export type EmbeddingWorkerEmbedRequest = {
+  id: number;
+  type: "embed";
+  text: string;
+  pooling: string;
+};
+
+export type EmbeddingWorkerDisposeRequest = {
+  id: number;
+  type: "dispose";
+};
+
+export type EmbeddingWorkerRequest =
+  EmbeddingWorkerWarmupRequest | EmbeddingWorkerEmbedRequest | EmbeddingWorkerDisposeRequest;
+
+export type EmbeddingWorkerOkResponse = {
+  id: number;
+  ok: true;
+  vector?: number[];
+};
+
+export type EmbeddingWorkerErrorResponse = {
+  id: number;
+  ok: false;
+  error: string;
+};
+
+export type EmbeddingWorkerResponse = EmbeddingWorkerOkResponse | EmbeddingWorkerErrorResponse;
+
+export function parseWorkerResponse(line: string): EmbeddingWorkerResponse {
+  const parsed = JSON.parse(line) as EmbeddingWorkerResponse;
+  if (typeof parsed?.id !== "number" || typeof parsed?.ok !== "boolean") {
+    throw new Error(`embedding-worker: invalid response: ${line.slice(0, 200)}`);
+  }
+  return parsed;
+}
```

**File**: `src/services/embedding-worker.ts` (added, +170/-0)
```diff
@@ -0,0 +1,170 @@
+/**
+ * Local-ONNX embedding worker process.
+ *
+ * Run with `OPENCODE_MEM_EMBEDDING_WORKER=1` (or as `import.meta.main`). Loads
+ * `@huggingface/transformers` / `onnxruntime-node` only in this address space.
+ * The parent SIGKILLs us on shutdown so ORT's NAPI finalizer never runs in the
+ * OpenCode/Bun host (#518).
+ */
+
+import { createInterface } from "node:readline";
+import { join } from "node:path";
+import {
+  prepareOnnxruntimeForTransformers,
+  formatOnnxruntimeInitError,
+} from "./onnxruntime-resolve.js";
+import { createRuntimeRequire } from "./runtime-require.js";
+import {
+  getTransformersPackageSpecifier,
+  resolveTransformersCjsEntry,
+} from "./transformers-resolve.js";
+import type {
+  EmbeddingWorkerRequest,
+  EmbeddingWorkerResponse,
+} from "./embedding-worker-protocol.js";
+
+const requireFromHere = createRuntimeRequire(import.meta);
+
+type Pipe = {
+  (text: string, opts: { pooling: string; normalize: boolean }): Promise<{ data: Float32Array }>;
+  dispose?: () => Promise<void>;
+};
+
+let pipe: Pipe | null = null;
+
+function send(response: EmbeddingWorkerResponse): void {
+  process.stdout.write(`${JSON.stringify(response)}\n`);
+}
+
+// Keep stdout reserved for JSON-line IPC; route casual logs to stderr.
+console.log = (...args: unknown[]) => {
+  process.stderr.write(`${args.map(String).join(" ")}\n`);
+};
+console.info = console.log;
+console.debug = console.log;
+
+async function loadPipeline(model: string, cacheDir: string, dtype?: string): Promise<Pipe> {
+  const transformersSpecifier = getTransformersPackageSpecifier();
+  const meta = import.meta as ImportMeta & { path?: string; dirname?: string; dir?: string };
+  const transformersEntry = resolveTransformersCjsEntry({
+    requireFn: requireFromHere,
+    specifier: transformersSpecifier,
+    startPaths: [meta.url, meta.path, meta.dirname, meta.dir, process.cwd()],
+  });
+
+  prepareOnnxruntimeForTransformers();
+  const mod = requireFromHere(transformersEntry) as typeof import("@huggingface/transformers");
+  mod.env.allowLocalModels = true;
+  mod.env.allowRemoteModels = true;
+  mod.env.cacheDir = cacheDir;
+  try {
+    (mod.env as any).backends.onnx.wasm.numThreads = 1;
+  } catch {
+    // Optional; wasm settings may be absent under the node ORT backend.
+  }
+
+  // Parent resolves dtype (config / cache probe) before spawn.
+  const created = await mod.pipeline("feature-extraction", model, {
+    ...(dtype ? { dtype: dtype as "fp32" | "fp16" | "q8" | "auto" } : {}),
+  });
+  return created as unknown as Pipe;
+}
+
+async function handle(request: EmbeddingWorkerRequest): Promise<void> {
+  try {
+    switch (request.type) {
+      case "warmup": {
+        if (pipe?.dispose) {
+          try {
+            await pipe.dispose();
+          } catch {
+            // Replace the previous pipeline even if dispose fails.
+          }
+        }
+        pipe = await loadPipeline(
+          request.model,
+          request.cacheDir || join(process.cwd(), ".cache"),
+          request.dtype
+        );
+        send({ id: request.id, ok: true });
+        return;
+      }
+      case "embed": {
+        if (!pipe) {
+          send({ id: request.id, ok: false, error: "embedding-worker: not warmed up" });
+          return;
+        }
+        const output = await pipe(request.text, {
+          pooling: request.pooling,
+          normalize: true,
+        });
+        send({ id: request.id, ok: true, vector: Array.from(output.data) });
+        return;
+      }
+      case "dispose": {
+        const current = pipe;
+        pipe = null;
+        if (current?.dispose) {
+          try {
+            await current.dispose();
+          } catch {
+            // Parent will SIGKILL us; best-effort dispose only.
+          }
+        }
+        send({ id: request.id, ok: true });
+        return;
+      }
+      default: {
+        const unknown = request as { id?: number };
+        send({
+          id: typeof unknown.id === "number" ? unknown.id : -1,
+          ok: false,
+          error: "embedding-worker: unknown request type",
+        });
+      }
+    }
+  } catch (error) {
+    const rewritten = formatOnnxruntimeInitError(error);
+    send({
+      id: request.id,
+      ok: false,
+      error: rewritten.message,
+    });
+  }
+}
+
+export async function runEmbeddingWorker(): Promise<void> {
+  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
+  for await (const line of rl) {
+    const trimmed = line.trim();
+    if (!trimmed) continue;
+    let request: EmbeddingWorkerRequest;
+    try {
+      request = JSON.parse(trimmed) as EmbeddingWorkerRequest;
+    } catch (error) {
+      send({
+        id: -1,
+        ok: false,
+        error: `embedding-worker: invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
+      });
+      continue;
+    }
+    await handle(request);
+  }
+}
+
+const isWorkerMain =
+  process.env.OPENCODE_ME
```

**File**: `src/services/embedding.ts` (modified, +65/-2)
```diff
@@ -11,6 +11,7 @@ import {
   getTransformersPackageSpecifier,
   resolveTransformersCjsEntry,
 } from "./transformers-resolve.js";
+import { EmbeddingSubprocessClient, shouldUseEmbeddingSubprocess } from "./embedding-subprocess.js";
 
 const requireFromHere = createRuntimeRequire(import.meta);
 
@@ -344,6 +345,7 @@ export async function fetchRemoteEmbeddingWithRetry(
 
 export class EmbeddingService {
   private pipe: any = null;
+  private subprocess: EmbeddingSubprocessClient | null = null;
   private initPromise: Promise<void> | null = null;
   public isWarmedUp: boolean = false;
   /** Set when warmup fails permanently; prevents "initializing forever" (#184). */
@@ -356,6 +358,8 @@ export class EmbeddingService {
   private pendingDispose: string | null = null;
   /** Bumped by dispose so a slow initialize cannot resurrect a released pipeline. */
   private generation = 0;
+  /** Windows hosts keep local ONNX in a Node child (#518); elsewhere in-process. */
+  private readonly useSubprocess = shouldUseEmbeddingSubprocess();
 
   static getInstance(): EmbeddingService {
     if (!(globalThis as any)[GLOBAL_EMBEDDING_KEY]) {
@@ -395,9 +399,21 @@ export class EmbeddingService {
     this.generation++;
     const pipe = this.pipe;
     this.pipe = null;
+    const subprocess = this.subprocess;
+    this.subprocess = null;
     this.isWarmedUp = false;
     this.initPromise = null;
     this.initError = null;
+    // Windows/Bun: SIGKILL the child so ORT's NAPI finalizer never runs in-host (#518).
+    if (subprocess) {
+      subprocess.dispose(reason);
+      safeLog("Embedding model released", {
+        reason,
+        model: CONFIG.embeddingModel,
+        via: "subprocess",
+      });
+      return;
+    }
     if (pipe?.dispose) {
       try {
         await pipe.dispose();
@@ -432,8 +448,6 @@ export class EmbeddingService {
 
       // Local model path
       const generation = this.generation;
-      const { pipeline } = await ensureTransformersLoaded();
-      // Explicit config wins; otherwise auto-resolve from model declaration / cache (#393).
       const dtype = CONFIG.embeddingDtype ?? resolveLocalOnnxDtype(CONFIG.embeddingModel);
       if (dtype) {
         log("Resolved local ONNX dtype for embedding warmup", {
@@ -442,6 +456,35 @@ export class EmbeddingService {
           source: CONFIG.embeddingDtype ? "config" : "auto",
         });
       }
+
+      if (this.useSubprocess) {
+        // Keep onnxruntime-node out of the OpenCode/Bun host on Windows (#518).
+        void progressCallback;
+        const client = new EmbeddingSubprocessClient();
+        await client.warmup({
+          model: CONFIG.embeddingModel,
+          cacheDir: join(CONFIG.storagePath, ".cache"),
+          pooling: CONFIG.embeddingPooling,
+          ...(dtype ? { dtype } : {}),
+        });
+        if (generation !== this.generation) {
+          client.dispose("stale-generation");
+          return;
+        }
+        this.subprocess = client;
+        this.isWarmedUp = true;
+        this.initError = null;
+        this.scheduleIdleDispose();
+        log("Embedding model warmed up", {
+          model: CONFIG.embeddingModel,
+          pooling: CONFIG.embeddingPooling,
+          dtype: dtype ?? null,
+          via: "subprocess",
+        });
+        return;
+      }
+
+      const { pipeline } = await ensureTransformersLoaded();
       const pipe = await pipeline("feature-extraction", CONFIG.embeddingModel, {
         ...(dtype ? { dtype } : {}),
         progress_callback: progressCallback,
@@ -495,6 +538,26 @@ export class EmbeddingService {
       if (CONFIG.embeddingApiUrl && CONFIG.embeddingApiKey) {
         const data: any = await fetchRemoteEmbeddingWithRetry(fetch, input);
         result = new Float32Array(data.data[0].embedding);
+      } else if (this.subprocess) {
+        const subprocess = this.subprocess;
+        try {
+          result = await subprocess.embed(input, CONFIG.embeddingPooling);
+        } catch (error) {
+          // Worker may have been SIGKILL'd / segfaulted; drop sticky warmup and
+          // re-spawn once so a single child death does not poison the host (#518).
+          if (subprocess.isReady) throw error;
+          subprocess.dispose("worker-exit");
+          if (this.subprocess === subprocess) this.subprocess = null;
+          this.isWarmedUp = false;
+          this.initPromise = null;
+          this.initError = null;
+          await this.warmup();
+          const restarted: EmbeddingSubprocessClient | null = this.subprocess;
+          if (!restarted) {
+            throw error instanceof Error ? error : new Error(String(error));
+          }
+          result = await restarted.embed(input, CONFIG.embeddingPooling);
+        }
       } else {
         const pipe = this.pipe;
         if (!pipe) {
```

**File**: `tests/embedding-subprocess.test.ts` (added, +163/-0)
```diff
@@ -0,0 +1,163 @@
+import { afterEach, describe, expect, it } from "bun:test";
+import { join } from "node:path";
+import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import {
+  collectEmbeddingWorkerDirs,
+  EmbeddingSubprocessClient,
+  resolveEmbeddingWorkerPackageRoot,
+  resolveEmbeddingWorkerRuntime,
+  resolveEmbeddingWorkerScript,
+  shouldUseEmbeddingSubprocess,
+} from "../src/services/embedding-subprocess.js";
+import { parseWorkerResponse } from "../src/services/embedding-worker-protocol.js";
+
+const originalSubprocessEnv = process.env.OPENCODE_MEM_EMBEDDING_SUBPROCESS;
+const originalPlatform = process.platform;
+
+afterEach(() => {
+  if (originalSubprocessEnv === undefined) {
+    delete process.env.OPENCODE_MEM_EMBEDDING_SUBPROCESS;
+  } else {
+    process.env.OPENCODE_MEM_EMBEDDING_SUBPROCESS = originalSubprocessEnv;
+  }
+  Object.defineProperty(process, "platform", { value: originalPlatform });
+});
+
+describe("shouldUseEmbeddingSubprocess", () => {
+  it("defaults to true on win32 and false elsewhere", () => {
+    delete process.env.OPENCODE_MEM_EMBEDDING_SUBPROCESS;
+    Object.defineProperty(process, "platform", { value: "win32" });
+    expect(shouldUseEmbeddingSubprocess()).toBe(true);
+    Object.defineProperty(process, "platform", { value: "darwin" });
+    expect(shouldUseEmbeddingSubprocess()).toBe(false);
+  });
+
+  it("honours OPENCODE_MEM_EMBEDDING_SUBPROCESS overrides", () => {
+    process.env.OPENCODE_MEM_EMBEDDING_SUBPROCESS = "1";
+    Object.defineProperty(process, "platform", { value: "darwin" });
+    expect(shouldUseEmbeddingSubprocess()).toBe(true);
+    process.env.OPENCODE_MEM_EMBEDDING_SUBPROCESS = "0";
+    Object.defineProperty(process, "platform", { value: "win32" });
+    expect(shouldUseEmbeddingSubprocess()).toBe(false);
+  });
+});
+
+describe("resolveEmbeddingWorkerRuntime", () => {
+  it("falls back to process.execPath with BUN_BE_BUN when no node/bun on PATH", () => {
+    // Under bun test we always have a bun-capable execPath.
+    const runtime = resolveEmbeddingWorkerRuntime();
+    expect(runtime).not.toBeNull();
+    expect(runtime!.command.length).toBeGreaterThan(0);
+    // Prefer real node/bun when present; otherwise OpenCode-style self re-exec.
+    if (runtime!.env.BUN_BE_BUN === "1") {
+      expect(runtime!.command).toBe(process.execPath);
+    }
+  });
+});
+
+describe("EmbeddingSubprocessClient readiness", () => {
+  it("rejects embed before warmup and after worker exit", async () => {
+    const runtime = resolveEmbeddingWorkerRuntime();
+    if (!runtime) return;
+
+    const client = new EmbeddingSubprocessClient({
+      runtime,
+      scriptPath: join(import.meta.dir, "fixtures", "embedding-worker-fake.mjs"),
+      requestTimeoutMs: 5_000,
+    });
+
+    expect(client.isReady).toBe(false);
+    await expect(client.embed("x", "mean")).rejects.toThrow(/not warmed up/);
+
+    await client.warmup({ model: "fake", cacheDir: "/tmp", pooling: "mean" });
+    expect(client.isReady).toBe(true);
+    expect(Array.from(await client.embed("ab", "mean"))).toEqual([2, 3, 4]);
+
+    client.dispose("test-exit");
+    expect(client.isReady).toBe(false);
+  });
+});
+
+describe("parseWorkerResponse", () => {
+  it("accepts ok and error payloads", () => {
+    expect(parseWorkerResponse(JSON.stringify({ id: 1, ok: true, vector: [1, 2] }))).toEqual({
+      id: 1,
+      ok: true,
+      vector: [1, 2],
+    });
+    expect(parseWorkerResponse(JSON.stringify({ id: 2, ok: false, error: "boom" }))).toEqual({
+      id: 2,
+      ok: false,
+      error: "boom",
+    });
+  });
+});
+
+describe("resolveEmbeddingWorkerScript anchors", () => {
+  it("finds the worker via import.meta.path when url is unusable", () => {
+    const root = mkdtempSync(join(tmpdir(), "opencode-mem-worker-"));
+    const services = join(root, "dist", "services");
+    mkdirSync(services, { recursive: true });
+    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "opencode-mem" }));
+    const worker = join(services, "embedding-worker.js");
+    writeFileSync(worker, "export {}\n");
+
+    const resolved = resolveEmbeddingWorkerScript({
+      url: "",
+      path: join(services, "embedding-subprocess.js"),
+    } as ImportMeta & { path?: string });
+    expect(resolved).toBe(worker);
+    expect(resolveEmbeddingWorkerPackageRoot(resolved)).toBe(root);
+  });
+
+  it("collects dirs without throwing on a bad import.meta.url", () => {
+    const dirs = collectEmbeddingWorkerDirs({
+      url: "not-a-file-url",
+      path: "/tmp/opencode-mem/dist/services/embedding-subprocess.js",
+    } as ImportMeta & { path?: string });
+    expect(
+      dirs.some((dir) => dir.includes("dist/services") || dir.includes("dist\\services"))
+    ).toBe(true);
+  });
+});
+
+describe("EmbeddingSubprocessClient with fake worker", () => {
+  it("warms up, embeds, and SIGKILLs on dispose", async () => {
+    const runtime = resol
```

**File**: `tests/fixtures/embedding-worker-fake.mjs` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+/**
+ * Fake embedding worker for subprocess IPC tests. Speaks the same JSON-line
+ * protocol as src/services/embedding-worker.ts without loading ONNX.
+ */
+import { createInterface } from "node:readline";
+
+const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
+let warmed = false;
+
+function send(payload) {
+  process.stdout.write(`${JSON.stringify(payload)}\n`);
+}
+
+for await (const line of rl) {
+  const trimmed = line.trim();
+  if (!trimmed) continue;
+  let request;
+  try {
+    request = JSON.parse(trimmed);
+  } catch (error) {
+    send({ id: -1, ok: false, error: String(error) });
+    continue;
+  }
+  if (request.type === "warmup") {
+    warmed = true;
+    send({ id: request.id, ok: true });
+    continue;
+  }
+  if (request.type === "embed") {
+    if (!warmed) {
+      send({ id: request.id, ok: false, error: "not warmed up" });
+      continue;
+    }
+    const n = Math.max(1, Number(request.text?.length ?? 1));
+    send({ id: request.id, ok: true, vector: [n, n + 1, n + 2] });
+    continue;
+  }
+  if (request.type === "dispose") {
+    warmed = false;
+    send({ id: request.id, ok: true });
+    continue;
+  }
+  send({ id: request.id ?? -1, ok: false, error: "unknown type" });
+}
```

---

### Incident Patch 2: `79630340` (2026-11-24)
**Commit Message**: fix(web): allow tag migration when only external provider is ready (#520)

The model picker blocked Start Migration on OpenCode-model readiness
alone, even though the batch API accepts an external memoryModel +
memoryApiUrl channel. Expose readyForMigration from the catalog API and
gate the dialog on that instead.

**File**: `src/index.ts` (modified, +3/-2)
```diff
@@ -415,8 +415,9 @@ export const OpenCodeMemPlugin: Plugin = async (ctx: PluginInput) => {
 
   await configureOpencodeHostTransport(ctx);
 
-  // Re-reads the provider directory into the connectivity snapshot. Errors
-  // are logged and the previous snapshot retained. The host registers
+  // Re-reads the provider directory into the connectivity snapshot. On success
+  // the snapshot is replaced; on failure the configured opencodeProvider is
+  // seeded so structured-output is still attempted. The host registers
   // user-config providers after plugin setup (provider.updated/model.updated),
   // so this runs again on those events and on connectivity-gate misses.
   const refreshConnectedProviders = async (): Promise<void> => {
```

**File**: `src/services/api-handlers.ts` (modified, +18/-6)
```diff
@@ -1710,8 +1710,12 @@ export async function handleGetTagMigrationProgress(): Promise<ApiResponse<Migra
 }
 
 export interface TagMigrationModelStatus {
-  /** True when the migration path can run without a live session (inherit cannot). */
+  /** True when the OpenCode path can run without a live session (inherit cannot). */
   configured: boolean;
+  /** True when memoryModel + memoryApiUrl are set (external tag-migration channel). */
+  externalConfigured: boolean;
+  /** True when either the OpenCode or external channel can run tag migration. */
+  readyForMigration: boolean;
   providerID: string | null;
   modelID: string | null;
 }
@@ -1735,14 +1739,22 @@ export type ProviderDirectoryEntry = {
   models: Array<{ id: string; name: string }>;
 };
 
-export async function handleGetTagMigrationModel(
-  loadDirectory?: () => Promise<ProviderDirectoryEntry[]>
-): Promise<ApiResponse<TagMigrationModelCatalog>> {
-  const status: TagMigrationModelStatus = {
-    configured: isOpencodeTagMigrationConfigured(),
+function tagMigrationModelStatus(): TagMigrationModelStatus {
+  const configured = isOpencodeTagMigrationConfigured();
+  const externalConfigured = isExternalTagMigrationConfigured();
+  return {
+    configured,
+    externalConfigured,
+    readyForMigration: configured || externalConfigured,
     providerID: CONFIG.opencodeProvider ?? null,
     modelID: CONFIG.opencodeModel ?? null,
   };
+}
+
+export async function handleGetTagMigrationModel(
+  loadDirectory?: () => Promise<ProviderDirectoryEntry[]>
+): Promise<ApiResponse<TagMigrationModelCatalog>> {
+  const status = tagMigrationModelStatus();
 
   try {
     const { loadOpencodeProvider } = await import("./ai/opencode-provider-loader.js");
```

**File**: `web/sim/config-model-provider.json` (modified, +2/-0)
```diff
@@ -3,6 +3,8 @@
   "data": {
     "available": true,
     "configured": false,
+    "externalConfigured": false,
+    "readyForMigration": false,
     "providerID": "opencode",
     "modelID": "inherit",
     "providers": [
```

**File**: `web/src/lib/components/explorer/ModelPicker.svelte` (modified, +17/-2)
```diff
@@ -11,12 +11,16 @@
     idPrefix?: string;
     disabled?: boolean;
     configured?: boolean;
+    /** True when OpenCode or the external memory provider can run tag migration. */
+    readyForMigration?: boolean;
   };
 
   type ModelCatalog = {
     available: boolean;
     reason?: string;
     configured: boolean;
+    externalConfigured?: boolean;
+    readyForMigration?: boolean;
     providerID: string | null;
     modelID: string | null;
     providers: Array<{
@@ -27,7 +31,12 @@
     }>;
   };
 
-  let { idPrefix = "model", disabled = false, configured = $bindable(false) }: Props = $props();
+  let {
+    idPrefix = "model",
+    disabled = false,
+    configured = $bindable(false),
+    readyForMigration = $bindable(false),
+  }: Props = $props();
 
   const i18n = useI18n();
   let catalog = $state<ModelCatalog | null>(null);
@@ -53,15 +62,21 @@
         available: false,
         reason: result.error ?? "",
         configured: false,
+        externalConfigured: false,
+        readyForMigration: false,
         providerID: null,
         modelID: null,
         providers: [],
       };
       configured = false;
+      readyForMigration = false;
       return;
     }
     catalog = result.data;
     configured = result.data.configured;
+    readyForMigration =
+      result.data.readyForMigration ??
+      (result.data.configured || Boolean(result.data.externalConfigured));
     const data = result.data;
     const provider = data.providers.find((entry) => entry.id === data.providerID);
     if (provider) {
@@ -147,7 +162,7 @@
     </p>
   {/if}
 
-  {#if catalog && !catalog.configured}
+  {#if catalog && !(catalog.readyForMigration ?? catalog.configured)}
     <p class="text-xs text-muted-foreground">{i18n.t("migration-model-required")}</p>
   {/if}
 </div>
```

**File**: `web/src/lib/components/explorer/TagMigrationDialog.svelte` (modified, +3/-3)
```diff
@@ -20,7 +20,7 @@
   let running = $state(false);
   let status = $state("");
   let progress = $state(0);
-  let modelConfigured = $state(false);
+  let readyForMigration = $state(false);
 
   $effect(() => {
     if (open && !running) {
@@ -125,7 +125,7 @@
       ></div>
     </div>
 
-    <ModelPicker idPrefix="migration-model" disabled={running} bind:configured={modelConfigured} />
+    <ModelPicker idPrefix="migration-model" disabled={running} bind:readyForMigration />
 
     <p class="text-xs text-muted-foreground">{i18n.t("migration-note")}</p>
   </div>
@@ -134,7 +134,7 @@
       <DialogActions
         onCancel={() => handleOpenChange(false)}
         primaryLabel={i18n.t("btn-start-migration")}
-        primaryDisabled={!modelConfigured}
+        primaryDisabled={!readyForMigration}
         onPrimary={() => void runTagMigration()}
       />
     {/if}
```

**File**: `web/vite-plugins/opencode-mem-sim.ts` (modified, +4/-0)
```diff
@@ -56,6 +56,8 @@ type MarkdownStatus = {
 type ModelProviderCatalog = {
   available: boolean;
   configured: boolean;
+  externalConfigured?: boolean;
+  readyForMigration?: boolean;
   providerID: string | null;
   modelID: string | null;
   providers: Array<{
@@ -242,6 +244,8 @@ export function opencodeMemSimPlugin(simRoot: string): Plugin {
                 modelProvider.providerID = providerID;
                 modelProvider.modelID = modelID;
                 modelProvider.configured = modelID !== "inherit";
+                modelProvider.readyForMigration =
+                  modelProvider.configured || Boolean(modelProvider.externalConfigured);
                 sendJson(res, 200, {
                   success: true,
                   data: { writtenTo: "sim", providerID, modelID, requiresReload: false },
```

---

### Incident Patch 3: `ffd6a2cf` (2026-11-24)
**Commit Message**: fix(provider): keep configured provider connected when directory is unavailable (#513)

* fix(provider): keep configured provider connected when directory is unavailable

Some plugin contexts (notably the V2 host) do not expose the provider directory, so refreshing the connectivity snapshot throws and ensureProviderConnected() denies providers that are actually configured. Fall back to the explicitly configured opencodeProvider so internal structured-output calls are still attempted; an invalid provider id still fails on the call and falls back to the external API.

* fix(provider): load connectivity fallback via opencode provider loader

Use loadOpencodeProvider in the directory-unavailable catch path so
setConnectedProviders updates the same module instance that
ensureProviderConnected reads.

---------

Co-authored-by: EyJunge1 <[REDACTED_EMAIL]>

**File**: `src/index.ts` (modified, +10/-0)
```diff
@@ -435,6 +435,16 @@ export const OpenCodeMemPlugin: Plugin = async (ctx: PluginInput) => {
       }
     } catch (error) {
       log("Failed to refresh opencode provider state", { error: String(error) });
+      // The host provider directory may be unavailable (e.g. a plugin context
+      // without `ctx.provider`). Keep the explicitly configured provider
+      // connected so structured-output calls are attempted instead of being
+      // denied by the connectivity gate; a bad provider id still fails loudly
+      // on the call itself and falls back to the external API.
+      // Use the loader so we hit the same module instance as ensureProviderConnected.
+      if (CONFIG.opencodeProvider) {
+        const { setConnectedProviders } = await loadOpencodeProvider();
+        setConnectedProviders([CONFIG.opencodeProvider]);
+      }
     }
   };
 
```

#### Recent Merged Pull Requests:
- **PR #522** (2026-11-24): chore(release): release v2.44.0 (@EyJunge1)
- **PR #521** (2026-11-24): fix(embedding): isolate Windows local ONNX in a Node subprocess (@EyJunge1)
- **PR #520** (2026-11-24): fix(web): allow tag migration when only external provider is ready (@EyJunge1)
- **PR #519** (2026-11-24): chore(deps-dev): bump the minor-and-patch group across 2 directories with 3 updates (@dependabot[bot])
- **PR #517** (2026-11-24): docs: clarify native database platform requirements (@cloudgpuapp)
- **PR #516** (2026-11-24): feat(ai): add AIGROW memory provider preset (@guglielmo-io)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. embedding): isolate Windows local ONNX in a Node subprocess

**RULE**:
When implementing operations in `README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tickernelz/opencode-mem. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a755b1da`: embedding): isolate Windows local ONNX in a Node subprocess. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
**Windows + OpenCode/Bun:** Local embeddings run `onnxruntime-node` in a **subprocess** (never inside the OpenCode host) so Bun↔ORT NAPI segfaults cannot take down `opencode serve` ([#518](https://github.com/tickernelz/opencode-mem/issues/518), [oven-sh/bun#28008](https://github.com/oven-sh/bun/issues/28008)). Runtime order: Node.js → Bun on PATH → the OpenCode binary itself via `BUN_BE_BUN=1` (Bun ≥ 1.2.16; no separate Node install required). Or set `embeddingApiUrl` + `embeddingApiKey` for remote embeddings. Override with `OPENCODE_MEM_EMBEDDING_SUBPROCESS=0` (in-process, not recommended on Windows) or `=1` (force subprocess on other OSes). The parent `SIGKILL`s the worker on dispose/idle/timeout and re-spawns after a worker crash.

- **Windows segfault in `onnxruntime_binding.node`:** Local embeddings run ORT in a subprocess (#518), using Node, Bun, or the OpenCode binary (`BUN_BE_BUN=1`). If that still fails, configure remote embeddings (`embeddingApiUrl` + `embeddingApiKey`).
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a755b1da` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
