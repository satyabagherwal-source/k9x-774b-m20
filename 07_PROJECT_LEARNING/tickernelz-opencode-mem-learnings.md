> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tickernelz-opencode-mem-learnings.md`  
> **Source**: github ([https://github.com/tickernelz/opencode-mem](https://github.com/tickernelz/opencode-mem))  
> **Source Version**: `83c386bc`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T17:05:13.537Z  
> **Learning ID**: `learn-github-tickernelz-opencode-mem`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): tickernelz/opencode-mem

> **Canonical Artifact**: `07_PROJECT_LEARNING/tickernelz-opencode-mem-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tickernelz/opencode-mem](https://github.com/tickernelz/opencode-mem))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-27T17:05:12.032Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tickernelz/opencode-mem`
- **Description**: OpenCode plugin that gives coding agents persistent memory using local vector database
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1787 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

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

### Core Architecture Module: `web/src/lib/profile-utils.ts`
```
import { jsonrepair } from "jsonrepair";
import type { ProfileItem, UserProfile } from "./types";

export type ProfileField = "preferences" | "patterns" | "workflows";

export type ProfileDataSlice = NonNullable<UserProfile["profileData"]>;

export type CleanupItem = ProfileItem & { _id: string; _type: "pref" | "pat" | "wf" };

export function parseProfileField(field: unknown): ProfileItem[] {
  if (!field) return [];
  let result: unknown = field;
  let lastResult: unknown = null;
  while (typeof result === "string" && result !== lastResult) {
    lastResult = result;
    try {
      result = JSON.parse(jsonrepair(result));
    } catch {
      break;
    }
  }
  if (!Array.isArray(result)) return [];
  const flattened: ProfileItem[] = [];
  const walk = (item: unknown) => {
    if (Array.isArray(item)) item.forEach(walk);
    else if (item && typeof item === "object") flattened.push(item as ProfileItem);
  };
  walk(result);
  return flattened;
}

/** Normalize profileData whether it arrives as object or JSON string. */
export function normalizeProfileData(raw: unknown): ProfileDataSlice | null {
  if (!raw) return null;
  let data: unknown = raw;
  if (typeof data === "string") {
    try {
      data = JSON.parse(jsonrepair(data));
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") return null;
  const obj = data as ProfileDataSlice;
  return {
    preferences: parseProfileField(obj.preferences),
    patterns: parseProfileField(obj.patterns),
    workflows: parseProfileField(obj.workflows),
  };
}

/** Flat list with stable pref_/pat_/wf_ ids for AI cleanup selection. */
export function flattenProfileItems(pd: ProfileDataSlice | null | undefined): CleanupItem[] {
  if (!pd) return [];
  const prefs = (pd.preferences || []).map((p, i) => ({
    ...p,
    _id: `pref_${i}`,
    _type: "pref" as const,
  }));
  const pats = (pd.patterns || []).map((p, i) => ({
    ...p,
    _id: `pat_${i}`,
    _type: "pat" as const,
  }));
  const wfs = (pd.workflows || []).map((w, i) => ({
    ...w,
    _id: `wf_${i}`,
    _type: "wf" as const,
  }));
  return [...prefs, ...pats, ...wfs];
}

function parseProfileItemId(id: string): { prefix: string; index: number } | null {
  if (!id.includes("_")) return null;
  const [prefix, idxStr] = id.split("_");
  const index = parseInt(idxStr, 10);
  if (Number.isNaN(index)) return null;
  return { prefix, index };
}

function itemAt(profileData: ProfileDataSlice | undefined, id: string): ProfileItem | null {
  const parsed = parseProfileItemId(id);
  if (!parsed || !profileData) return null;
  if (parsed.prefix === "pref") return profileData.preferences?.[parsed.index] ?? null;
  if (parsed.prefix === "pat") return profileData.patterns?.[parsed.index] ?? null;
  if (parsed.prefix === "wf") return profileData.workflows?.[parsed.index] ?? null;
  return null;
}

export function findDescById(id: string, profileData?: ProfileDataSlice): string | null {
  return itemAt(profileData, id)?.description ?? null;
}

export function findStepsById(id: string, profileData?: ProfileDataSlice): string[] | null {
  const parsed = parseProfileItemId(id);
  if (!parsed || parsed.prefix !== "wf") return null;
  return itemAt(profileData, id)?.steps || null;
}

export function profileTypeLabel(
  id: string,
  labels: { pref: string; pat: string; wf: string }
): string {
  const parsed = parseProfileItemId(id);
  if (!parsed) return "?";
  if (parsed.prefix === "pref") return labels.pref;
  if (parsed.prefix === "pat") return labels.pat;
  if (parsed.prefix === "wf") return labels.wf;
  return "?";
}

export function confidencePct(item: Pick<ProfileItem, "confidence">): number {
  return Math.round((item.confidence || 0) * 1000) / 10;
}

export function evidenceTitle(item: ProfileItem): string {
  if (!item.evidence) return "";
  return Array.isArray(item.evidence) ? item.evidence.join("\n") : item.evidence;
}

export function evidenceCount(item: ProfileItem): number {
  if (!item.evidence) return 0;
  return Array.isArray(item.evidence) ? item.evidence.length : 1;
}

```

### Core Architecture Module: `web/src/lib/set-utils.ts`
```
/** Immutable Set toggle helper — returns a new Set. */
export function toggleInSet<T>(set: Set<T>, value: T, checked: boolean): Set<T> {
  const next = new Set(set);
  if (checked) next.add(value);
  else next.delete(value);
  return next;
}

export function removeFromSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  next.delete(value);
  return next;
}

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

### Incident Patch 1: `c26bf2c9` (2026-10-27)
**Commit Message**: fix(turso): checkpoint the WAL before closing a database (#440)

* fix(turso): checkpoint the WAL before closing a database

A process killed mid-WAL (SIGKILL after a shutdown timeout, OOM kill,
power-off) can leave a `-wal` that disagrees with turso's `-tshm` index;
every later open then fails with "I/O error: short read on WAL frame",
which takes the whole memory system down because ensureTursoReady()
gates tools, capture and the web server behind it (see #435).

Run `PRAGMA wal_checkpoint(TRUNCATE)` before database.close(), bounded at
1500 ms so a contended checkpoint cannot consume a host shutdown budget,
never throwing, and logging the pragma result row so a partial checkpoint
is visible. Close pooled databases in parallel so N * the bound still fits
inside the window.

Verified: format/lint/typecheck clean; 13 pass across the four turso and
plugin-shutdown test files; against a patched build loaded by a running
server, stopping the service leaves metadata.db 74192 -> 0 and
user-prompts.db 45352 -> 0 bytes of WAL with no process alive to write.

* fix(turso): make shutdown close survive logging failures and the exit path

Review findings on #440:
- checkpointBeforeClose: swall

**File**: `src/services/logger.ts` (modified, +13/-0)
```diff
@@ -141,6 +141,19 @@ export function serializeError(error: unknown): {
   return { error: String(error) };
 }
 
+/**
+ * Log without letting a logger failure escape. `log()` initialises the log
+ * directory lazily and can throw on ENOSPC/EACCES; callers on a teardown path
+ * must never let a diagnostic write skip the work that follows it.
+ */
+export function safeLog(message: string, data?: unknown): void {
+  try {
+    log(message, data);
+  } catch {
+    // swallow — the caller's cleanup matters more than this line
+  }
+}
+
 export function log(message: string, data?: unknown) {
   ensureLoggerInitialized();
 
```

**File**: `src/services/turso/connection-manager.ts` (modified, +15/-11)
```diff
@@ -3,7 +3,7 @@ import type { DatabaseOpts, EncryptionOpts } from "@tursodatabase/database-commo
 import { existsSync, mkdirSync } from "node:fs";
 import { dirname, resolve, relative, isAbsolute, sep } from "node:path";
 import { CONFIG } from "../../config.js";
-import { log } from "../logger.js";
+import { safeLog } from "../logger.js";
 import { collectReleasedSqliteHandles } from "./sqlite-handle-release.js";
 import { TursoDb } from "./turso-db.js";
 import { resolveOrCreateDatabaseEncryptionKey } from "./encryption-key.js";
@@ -387,7 +387,7 @@ export class TursoConnectionManager {
           try {
             await db.close();
           } catch (error) {
-            log("Error closing Turso database", { path: dbPath, error: String(error) });
+            safeLog("Error closing Turso database", { path: dbPath, error: String(error) });
           }
 
           this.connections.delete(dbPath);
@@ -408,13 +408,17 @@ export class TursoConnectionManager {
 
     this.closingPromise = (async () => {
       await Promise.allSettled([...this.pending.values(), ...this.closingConnections.values()]);
-      for (const [path, db] of this.connections) {
-        try {
-          await db.close();
-        } catch (error) {
-          log("Error closing Turso database", { path, error: String(error) });
-        }
-      }
+      // Close in parallel: each close runs a bounded WAL checkpoint, and the
+      // host allows only ~5s between SIGTERM and SIGKILL.
+      await Promise.allSettled(
+        [...this.connections].map(async ([path, db]) => {
+          try {
+            await db.close();
+          } catch (error) {
+            safeLog("Error closing Turso database", { path, error: String(error) });
+          }
+        })
+      );
       this.connections.clear();
       this.pending.clear();
       await collectReleasedSqliteHandles();
@@ -430,9 +434,9 @@ export class TursoConnectionManager {
   closeAllSync(): void {
     for (const [path, db] of this.connections) {
       try {
-        void db.close();
+        db.closeSync();
       } catch (error) {
-        log("Error closing Turso database (sync)", { path, error: String(error) });
+        safeLog("Error closing Turso database (sync)", { path, error: String(error) });
       }
     }
     this.connections.clear();
```

**File**: `src/services/turso/turso-db.ts` (modified, +71/-1)
```diff
@@ -1,4 +1,5 @@
 import type { Database } from "@tursodatabase/database";
+import { safeLog } from "../logger.js";
 
 export type SqlValue = null | string | number | bigint | boolean | Uint8Array | ArrayBuffer;
 export type SqlArgs = SqlValue[] | Record<string, SqlValue>;
@@ -112,8 +113,18 @@ function bindArgs(args?: SqlArgs): SqlValue[] | [Record<string, SqlValue>] {
   return [normalized];
 }
 
+/**
+ * Upper bound for the pre-close WAL checkpoint. The host SIGTERMs and SIGKILLs
+ * the service after ~5s, so a checkpoint that cannot finish (another process
+ * holds a read lock) must not eat the whole shutdown budget.
+ */
+const CHECKPOINT_TIMEOUT_MS = 1500;
+
 export class TursoDb {
-  constructor(private readonly database: Database) {}
+  constructor(
+    private readonly database: Database,
+    private readonly checkpointTimeoutMs: number = CHECKPOINT_TIMEOUT_MS
+  ) {}
 
   getClient(): Database {
     return this.database;
@@ -203,7 +214,66 @@ export class TursoDb {
     return wrapped[txnMode]();
   }
 
+  /**
+   * Checkpoint the WAL into the main DB before closing so a SIGKILL during
+   * teardown cannot leave a 0-byte `-wal` beside a stale `-tshm` (every later
+   * open then fails with "short read on WAL frame"). Never throws: a busy or
+   * slow checkpoint is logged and skipped.
+   *
+   * The timeout only bounds how long we *prefer* to wait before logging a
+   * failure — turso's `close()` does not take `execLock`, so we must still
+   * await settlement of the pragma before returning. Closing under an
+   * in-flight statement would recreate the tear this helper exists to avoid.
+   * A truncate stuck on a foreign reader can therefore still hold shutdown
+   * past the bound until the reader leaves (or the host SIGKILLs).
+   */
+  private async checkpointBeforeClose(): Promise<void> {
+    let timer: ReturnType<typeof setTimeout> | undefined;
+    const checkpoint = this.database.all("PRAGMA wal_checkpoint(TRUNCATE)");
+    try {
+      const rows = await Promise.race([
+        checkpoint,
+        new Promise<never>((_, reject) => {
+          timer = setTimeout(
+            () => reject(new Error(`timed out after ${this.checkpointTimeoutMs}ms`)),
+            this.checkpointTimeoutMs
+          );
+        }),
+      ]);
+      // `PRAGMA wal_checkpoint` returns {busy, log, checkpointed}; busy>0 means a
+      // reader blocked the truncate and the WAL was only partially checkpointed.
+      const result = Array.isArray(rows) ? rows[0] : undefined;
+      safeLog("Turso WAL checkpoint before close", {
+        busy: result?.busy,
+        log: result?.log,
+        checkpointed: result?.checkpointed,
+      });
+    } catch (error) {
+      safeLog("Turso WAL checkpoint before close failed", { error: String(error) });
+    } finally {
+      if (timer !== undefined) clearTimeout(timer);
+      // Always drain the pragma before close(), including after a timeout win:
+      // a late rejection must not escape unhandled, and the native close must
+      // not race an in-flight statement on the same handle.
+      await checkpoint.catch(() => {});
+    }
+  }
+
   async close(): Promise<void> {
+    await this.checkpointBeforeClose();
     await this.database.close();
   }
+
+  /**
+   * Close without the WAL checkpoint, for the synchronous `exit` handler where
+   * async continuations never run. The turso async `close()` calls the native
+   * close in its first statement with nothing awaited before it, so an
+   * un-awaited call really does release the handle — but it leaves the `-wal`
+   * in place, which is unavoidable without an event loop.
+   */
+  closeSync(): void {
+    // Errors surface as a rejected promise (never a throw) and are ignored:
+    // the process is exiting and there is no budget left to act on them.
+    void this.database.close().catch(() => {});
+  }
 }
```

**File**: `tests/turso-close-checkpoint.test.ts` (added, +163/-0)
```diff
@@ -0,0 +1,163 @@
+import { describe, expect, it } from "bun:test";
+import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import type { Database } from "@tursodatabase/database";
+import { CONFIG } from "../src/config.js";
+import { TursoConnectionManager } from "../src/services/turso/connection-manager.js";
+import { TursoDb } from "../src/services/turso/turso-db.js";
+
+function fakeDatabase(all: (sql: string) => Promise<unknown[]>) {
+  const calls: string[] = [];
+  const database = {
+    calls,
+    async all(sql: string) {
+      calls.push(sql);
+      return all(sql);
+    },
+    async run(sql: string) {
+      calls.push(sql);
+      return { changes: 0, lastInsertRowid: 0 };
+    },
+    async get() {
+      return undefined;
+    },
+    async batch() {
+      return [];
+    },
+    async close() {
+      calls.push("close");
+    },
+  };
+  return database as unknown as Database & { calls: string[] };
+}
+
+describe("turso close checkpoint", () => {
+  it("checkpoints the WAL before closing", async () => {
+    const database = fakeDatabase(async () => []);
+    await new TursoDb(database).close();
+
+    expect(database.calls).toEqual(["PRAGMA wal_checkpoint(TRUNCATE)", "close"]);
+  });
+
+  it("still closes when the checkpoint fails", async () => {
+    const database = fakeDatabase(async () => {
+      throw new Error("database is locked");
+    });
+    await new TursoDb(database).close();
+
+    expect(database.calls).toEqual(["PRAGMA wal_checkpoint(TRUNCATE)", "close"]);
+  });
+
+  it("does not leak the checkpoint rejection that lands after the timeout", async () => {
+    // Bun's test runner fails any test that leaks an unhandled rejection, so a
+    // regression here surfaces as a suite failure rather than a silent hang.
+    const unhandled: unknown[] = [];
+    const onUnhandled = (reason: unknown) => {
+      unhandled.push(reason);
+    };
+    process.on("unhandledRejection", onUnhandled);
+    try {
+      const calls: string[] = [];
+      const database = {
+        async all() {
+          calls.push("all");
+          await new Promise((resolve) => setTimeout(resolve, 80));
+          throw new Error("database is locked");
+        },
+        async close() {
+          calls.push("close");
+        },
+      } as unknown as Database;
+
+      const db = new TursoDb(database, 10);
+      await db.close();
+
+      expect(calls).toEqual(["all", "close"]);
+      expect(unhandled).toEqual([]);
+    } finally {
+      process.off("unhandledRejection", onUnhandled);
+    }
+  });
+
+  it("waits for a timed-out checkpoint to settle before closing", async () => {
+    // turso's close() does not take execLock — closing under an in-flight
+    // pragma would race the native handle. After the timeout fires we must
+    // still drain the checkpoint before close runs.
+    let release!: () => void;
+    const gate = new Promise<void>((resolve) => {
+      release = resolve;
+    });
+    const calls: string[] = [];
+    const database = {
+      async all() {
+        calls.push("all");
+        await gate;
+        return [{ busy: 0, log: 0, checkpointed: 0 }];
+      },
+      async close() {
+        calls.push("close");
+      },
+    } as unknown as Database;
+
+    const closing = new TursoDb(database, 10).close();
+    await new Promise((resolve) => setTimeout(resolve, 40));
+    expect(calls).toEqual(["all"]);
+
+    release();
+    await closing;
+    expect(calls).toEqual(["all", "close"]);
+  });
+
+  it("still closes when logging fails", async () => {
+    // Point the log file inside a regular file so the logger's mkdir/write
+    // throws (ENOTDIR) on both the success and failure log calls.
+    const sandbox = mkdtempSync(join(tmpdir(), "turso-log-fail-"));
+    const previousLogFile = process.env.OPENCODE_MEM_LOG_FILE;
+    writeFileSync(join(sandbox, "blocker"), "x");
+    process.env.OPENCODE_MEM_LOG_FILE = join(sandbox, "blocker", "opencode-mem.log");
+    try {
+      const database = fakeDatabase(async () => [{ busy: 0, log: 0, checkpointed: 0 }]);
+      await new TursoDb(database).close();
+
+      expect(database.calls).toEqual(["PRAGMA wal_checkpoint(TRUNCATE)", "close"]);
+    } finally {
+      if (previousLogFile === undefined) {
+        delete process.env.OPENCODE_MEM_LOG_FILE;
+      } else {
+        process.env.OPENCODE_MEM_LOG_FILE = previousLogFile;
+      }
+      rmSync(sandbox, { recursive: true, force: true });
+    }
+  });
+
+  it("closeSync closes without running the checkpoint", () => {
+    const database = fakeDatabase(async () => []);
+    new TursoDb(database).closeSync();
+
+    // No await: the native close still happened on this tick.
+    expect(database.calls).toEqual(["close"]);
+  });
+
+  it("closeAllSync releases the native handle on the exit path", async () => {
+    const previousStoragePath = CONFIG.storagePath;
+    const sandbox = mkdtemp
```

---

### Incident Patch 2: `0ca8b0d4` (2026-10-27)
**Commit Message**: fix(turso): stop stale migration locks from blocking all writes (#437)

* fix(turso): preserve completed migrations after normal writes

Treat complete sidecars as historical import verification, not a live row-count invariant. Keep native vector readiness checks and cover backup restoration for unreadable completed shards.

* fix(turso): bound live-but-inert migration lock staleness

Expire locks after thirty minutes without progress, with timestamp/mtime fallback and audited stale cleanup shared by write gating and legacy acquisition. Heartbeat legacy insert batches and shards plus dimension migration progress; abort on lost ownership instead of continuing concurrently.

* fix(turso): heartbeat remaining long-running operation locks

* fix(turso): verify lock file and acquisition ownership

* fix(turso): preserve successor data after lock ownership loss

* fix(turso): preserve successor re-embed journal after lock loss

Skip unlinking the shared per-shard re-embed swap journal when ownership is lost so a concurrent successor's recovery state survives, and heartbeat before warmup so long model loads refresh the lease.

---------

Co-authored-by: EyJunge1 <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +2/-0)
```diff
@@ -60,8 +60,10 @@ On first startup after upgrading, opencode-mem automatically migrates existing m
 - Each shard is backed up as `<shard>.db.legacy.bak` before rewrite
 - Progress is tracked per shard in `<shard>.db.turso-migrate.json`
 - A global marker `.turso-migrated` is written only after all shards verify successfully
+- Normal inserts and deletes do not invalidate a completed shard migration; startup still checks that its vectors are readable and match its stored dimensions
 - Do not run multiple OpenCode instances against the same `storagePath` during migration; a lock file (`.turso-migrate.lock`) prevents concurrent migration
 - Manual dimension migrations use `.turso-operation.lock`; other plugin processes reject new memory writes until the migration finishes
+- Locks expire after 30 minutes without a progress timestamp update (or file modification time if the timestamp is unavailable), even if the owning process is alive. This lease uses wall-clock time: a forward clock step greater than 30 minutes can expire a progressing operation early; a backward step or future-dated lock can extend an inert lock's life. Locks carry a unique acquisition id, and stale cleanup only removes the exact file it inspected. Migrations heartbeat as they progress and abort if they discover that ownership was lost. Stale-lock cleanup is logged for diagnosis
 
 If migration is interrupted, the next startup resumes from the backup automatically.
 
```

**File**: `src/services/memory-portability-service.ts` (modified, +12/-3)
```diff
@@ -20,7 +20,10 @@ import { extractScopeFromContainerTag } from "./memory-scope.js";
 import { getProjectTagInfo } from "./tags.js";
 import { embeddingService } from "./embedding.js";
 import { ensureTursoReady } from "./turso/ready.js";
-import { acquireTursoOperationLock } from "./turso/operation-lock.js";
+import {
+  acquireTursoOperationLock,
+  isTursoLockOwnershipLostError,
+} from "./turso/operation-lock.js";
 import { tursoShardManager } from "./turso/shard-manager.js";
 import { tursoConnectionManager } from "./turso/connection-manager.js";
 import { tursoVectorSearch } from "./turso/vector-search.js";
@@ -334,6 +337,7 @@ export class MemoryPortabilityService {
           },
           isPinned: Boolean(memory.isPinned),
         });
+        releaseLock.heartbeat();
       }
 
       // Phase B: single transactional write. Avoid getWriteShard() here because it
@@ -355,13 +359,15 @@ export class MemoryPortabilityService {
               });
             }
             insertedIds.push(item.record.id);
+            releaseLock.heartbeat();
           }
         });
 
         await tursoShardManager.setVectorCount(
           shard.id,
           await tursoVectorSearch.countAllVectors(db)
         );
+        releaseLock.heartbeat();
       });
 
       log("Memory import completed", {
@@ -378,8 +384,11 @@ export class MemoryPortabilityService {
         containerTag: target.tag,
       };
     } catch (error) {
-      // Best-effort cleanup if a partial insert somehow escaped the transaction.
-      if (insertedIds.length > 0) {
+      // Best-effort cleanup for ordinary failures only. Ownership loss rolls back
+      // an open transaction, but a successor may already have committed these IDs
+      // (or our transaction may have committed before the final heartbeat).
+      // Never compensate shared rows without current ownership.
+      if (!isTursoLockOwnershipLostError(error) && insertedIds.length > 0) {
         try {
           const shards = await tursoShardManager.getAllShards(scope, hash);
           for (const shard of shards) {
```

**File**: `src/services/migration-service.ts` (modified, +45/-12)
```diff
@@ -8,7 +8,10 @@ import { CONFIG } from "../config.js";
 import { log } from "./logger.js";
 import { formatTagsForEmbedding } from "./turso/vector-utils.js";
 import type { MemoryRecord, ShardInfo } from "./turso/types.js";
-import { acquireTursoOperationLock } from "./turso/operation-lock.js";
+import {
+  acquireTursoOperationLock,
+  isTursoLockOwnershipLostError,
+} from "./turso/operation-lock.js";
 import {
   withSqliteFileLockRetry,
   renameSqliteDatabase,
@@ -105,13 +108,15 @@ export class MigrationService {
     }
 
     this.isRunning = true;
-    let releaseOperationLock: (() => void) | undefined;
+    let releaseOperationLock: ReturnType<typeof acquireTursoOperationLock> | undefined;
     this.progressCallback = progressCallback;
     const startTime = Date.now();
 
     try {
       releaseOperationLock = acquireTursoOperationLock(`dimension-${strategy}`);
+      const heartbeat = releaseOperationLock.heartbeat;
       const mismatch = await this.detectDimensionMismatch();
+      heartbeat();
 
       if (!mismatch.needsMigration) {
         return {
@@ -124,10 +129,10 @@ export class MigrationService {
       }
 
       if (strategy === "fresh-start") {
-        return await this.freshStartMigration(mismatch, startTime);
+        return await this.freshStartMigration(mismatch, startTime, heartbeat);
       }
 
-      return await this.reEmbedMigration(mismatch, startTime);
+      return await this.reEmbedMigration(mismatch, startTime, heartbeat);
     } catch (error) {
       log("Migration: failed", { error: String(error) });
       return {
@@ -147,7 +152,8 @@ export class MigrationService {
 
   private async freshStartMigration(
     mismatch: DimensionMismatch,
-    startTime: number
+    startTime: number,
+    heartbeat: () => void
   ): Promise<MigrationResult> {
     this.reportProgress({
       phase: "preparing",
@@ -158,6 +164,7 @@ export class MigrationService {
     let deletedShards = 0;
 
     for (const [index, shardInfo] of mismatch.shardMismatches.entries()) {
+      heartbeat();
       this.reportProgress({
         phase: "cleanup",
         processed: index,
@@ -174,6 +181,7 @@ export class MigrationService {
         archivePath,
       });
       deletedShards++;
+      heartbeat();
     }
 
     this.reportProgress({
@@ -193,9 +201,13 @@ export class MigrationService {
 
   private async reEmbedMigration(
     mismatch: DimensionMismatch,
-    startTime: number
+    startTime: number,
+    heartbeat: () => void
   ): Promise<MigrationResult> {
+    // Warmup (ONNX load / remote probes) can outlast a single lease window.
+    heartbeat();
     await embeddingService.warmup();
+    heartbeat();
     embeddingService.clearCache();
 
     const totalMemories = mismatch.shardMismatches.reduce(
@@ -213,6 +225,7 @@ export class MigrationService {
     let processedCount = 0;
 
     for (const shardInfo of mismatch.shardMismatches) {
+      heartbeat();
       this.reportProgress({
         phase: "re-embedding",
         processed: processedCount,
@@ -229,7 +242,8 @@ export class MigrationService {
         shard.scope,
         shard.scopeHash,
         () =>
-          this.rebuildShardSafely(shard, (processed) => {
+          this.rebuildShardSafely(shard, heartbeat, (processed) => {
+            heartbeat();
             processedCount++;
             this.reportProgress({
               phase: "re-embedding",
@@ -244,6 +258,7 @@ export class MigrationService {
           })
       );
       reEmbeddedCount += migrated;
+      heartbeat();
     }
 
     this.reportProgress({
@@ -263,6 +278,7 @@ export class MigrationService {
 
   private async rebuildShardSafely(
     shard: ShardInfo,
+    heartbeat: () => void,
     onProcessed: (memoryId: string) => void
   ): Promise<number> {
     const sourceDb = await tursoConnectionManager.getConnection(shard.dbPath);
@@ -331,6 +347,7 @@ export class MigrationService {
           onProcessed(String(memory.id));
         }
 
+        heartbeat();
         await stagedDb.transaction("write", async (tx) => {
           for (const item of stagedBatch) {
             await tursoVectorSearch.insertVectorInTransaction(tx, item.record);
@@ -342,6 +359,7 @@ export class MigrationService {
             }
           }
         });
+        heartbeat();
       }
 
       const countRow = await stagedDb.get(`SELECT COUNT(*) AS count FROM memories`);
@@ -353,12 +371,14 @@ export class MigrationService {
       }
 
       await tursoConnectionManager.closeConnection(stagedPath);
+      heartbeat();
       writeFileSync(
         swapStatePath,
         JSON.stringify({ dbPath: shard.dbPath, stagedPath, backupPath }),
         "utf-8"
       );
       await tursoConnectionManager.closeConnection(shard.dbPath);
+      heartbeat();
       await withSqliteFileLockRetry(() => renameSqliteDatabase(shard.dbPath, backupPath));
       try {
         await withSqliteFileLockRetry(() => renameSqliteDatabase(stagedPath, shard.dbPath));
@@ -377,11 +397,2
```

**File**: `src/services/shard-path-migration-service.ts` (modified, +27/-3)
```diff
@@ -4,7 +4,10 @@ import { CONFIG } from "../config.js";
 import { extractScopeFromContainerTag } from "./memory-scope.js";
 import { getProjectTagInfo } from "./tags.js";
 import { ensureTursoReady } from "./turso/ready.js";
-import { acquireTursoOperationLock } from "./turso/operation-lock.js";
+import {
+  acquireTursoOperationLock,
+  isTursoLockOwnershipLostError,
+} from "./turso/operation-lock.js";
 import { tursoShardManager } from "./turso/shard-manager.js";
 import { tursoConnectionManager } from "./turso/connection-manager.js";
 import { tursoVectorSearch } from "./turso/vector-search.js";
@@ -280,6 +283,7 @@ export class ShardPathMigrationService {
 
     try {
       // Stage complete, updated copies while originals remain untouched.
+      // A gigantic shard's synchronous copy or single UPDATE/count can still delay a heartbeat.
       for (const move of moves) {
         await tursoConnectionManager.closeConnection(move.oldPath);
         if (!existsSync(move.oldPath)) {
@@ -317,9 +321,11 @@ export class ShardPathMigrationService {
           );
         }
         await tursoConnectionManager.closeConnection(move.stagedPath);
+        releaseLock.heartbeat();
       }
 
       writeSwapState(statePath, state);
+      releaseLock.heartbeat();
 
       // Empty targets remain recoverable until the complete swap succeeds.
       for (let index = 0; index < targetShards.length; index++) {
@@ -328,17 +334,20 @@ export class ShardPathMigrationService {
           "pre-path-migrate",
           archivedTargets[index]!.archivePath!
         );
+        releaseLock.heartbeat();
       }
 
       for (const move of moves) {
         await tursoConnectionManager.closeConnection(move.oldPath);
+        releaseLock.heartbeat();
         await withSqliteFileLockRetry(() => renameSqliteDatabase(move.oldPath, move.backupPath));
         try {
           await withSqliteFileLockRetry(() => renameSqliteDatabase(move.stagedPath, move.newPath));
         } catch (error) {
           await withSqliteFileLockRetry(() => renameSqliteDatabase(move.backupPath, move.oldPath));
           throw error;
         }
+        releaseLock.heartbeat();
 
         await tursoShardManager.reassignShardScope(
           move.shardId,
@@ -354,6 +363,7 @@ export class ShardPathMigrationService {
       }
 
       unlinkSync(statePath);
+      releaseLock.heartbeat();
 
       // Prompt metadata is secondary and must not invalidate a completed,
       // recoverable memory migration.
@@ -380,12 +390,26 @@ export class ShardPathMigrationService {
         actions,
       };
     } catch (error) {
-      await this.rollbackSwap(state, statePath);
+      const ownershipLost = isTursoLockOwnershipLostError(error);
+      if (ownershipLost) {
+        // A successor may already be writing to the migrated paths. Only fresh
+        // ownership at startup may recover any journal that remains.
+        log(
+          "WARNING: Path migration interrupted after lock ownership lost; leaving recoverable state untouched",
+          { error: String(error), statePath }
+        );
+      } else {
+        await this.rollbackSwap(state, statePath);
+      }
       return {
         success: false,
         ...resultBase,
         dryRun: false,
-        error: error instanceof Error ? error.message : String(error),
+        error: ownershipLost
+          ? `Path migration interrupted after lock ownership lost and may have completed; state is recoverable. ${String(error)}`
+          : error instanceof Error
+            ? error.message
+            : String(error),
       };
     } finally {
       releaseLock();
```

**File**: `src/services/turso/encryption-migrator.ts` (modified, +12/-2)
```diff
@@ -73,7 +73,7 @@ async function canOpenPlain(dbPath: string): Promise<boolean> {
   }
 }
 
-async function dumpAndReloadEncrypted(dbPath: string): Promise<void> {
+async function dumpAndReloadEncrypted(dbPath: string, heartbeat: () => void): Promise<void> {
   const encryption = resolveDatabaseEncryption();
   if (!encryption) {
     throw new Error("databaseEncryptionKey is required for encryption migration");
@@ -101,6 +101,7 @@ async function dumpAndReloadEncrypted(dbPath: string): Promise<void> {
     );
     const tableNames = tables.map((row) => String(row.name));
     for (const table of tableNames) {
+      heartbeat();
       const create = await sourceDb.get<{ sql?: string }>(
         `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`,
         [table]
@@ -171,6 +172,7 @@ async function dumpAndReloadEncrypted(dbPath: string): Promise<void> {
               ]
             );
           }
+          heartbeat();
         }
         continue;
       }
@@ -184,6 +186,7 @@ async function dumpAndReloadEncrypted(dbPath: string): Promise<void> {
           `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
           columns.map((col) => asSqlValue(row[col]))
         );
+        heartbeat();
       }
     }
 
@@ -201,17 +204,21 @@ async function dumpAndReloadEncrypted(dbPath: string): Promise<void> {
       } catch {
         // may already exist
       }
+      heartbeat();
     }
   } finally {
     await sourceDb.close();
     await stagedDb.close();
   }
 
+  // Pre-swap aborts preserve the plaintext original and may leave a staged temp file.
+  heartbeat();
   await withSqliteFileLockRetry(() => {
     copySqliteDatabase(dbPath, backupPath);
     removeSqliteDatabase(dbPath);
     renameSqliteDatabase(stagedPath, dbPath);
   });
+  heartbeat();
 
   // Verify encrypted open
   const verify = await connect(dbPath, buildConnectOptions(encryption));
@@ -231,17 +238,20 @@ export async function runDatabaseEncryptionMigration(): Promise<void> {
 
   const candidates = collectCandidateDbs();
   const release = acquireTursoOperationLock("tursodb-encrypt");
+  const heartbeat = release.heartbeat;
   try {
     for (const path of candidates) {
+      heartbeat();
       if (await isAlreadyEncrypted(path)) continue;
       if (!(await canOpenPlain(path))) {
         throw new Error(
           `Cannot open ${path} as plaintext for encryption migration. ` +
             `If it is already encrypted with a different key, update databaseEncryptionKey.`
         );
       }
-      await dumpAndReloadEncrypted(path);
+      await dumpAndReloadEncrypted(path, heartbeat);
     }
+    heartbeat();
     writeFileSync(
       markerPath(),
       JSON.stringify({
```

**File**: `src/services/turso/engine-migrator.ts` (modified, +42/-19)
```diff
@@ -95,7 +95,8 @@ async function needsEngineRewrite(dbPath: string): Promise<boolean> {
 async function copyTableViaLibsql(
   sourcePath: string,
   targetDb: TursoDb,
-  table: string
+  table: string,
+  heartbeat: () => void
 ): Promise<number> {
   const client = openLibsql(sourcePath);
   try {
@@ -141,14 +142,15 @@ async function copyTableViaLibsql(
         sqlArgs
       );
       imported += 1;
+      heartbeat();
     }
     return imported;
   } finally {
     client.close();
   }
 }
 
-async function rewriteMemoryShard(dbPath: string): Promise<void> {
+async function rewriteMemoryShard(dbPath: string, heartbeat: () => void): Promise<void> {
   const client = openLibsql(dbPath);
   let dims = CONFIG.embeddingDimensions;
   let model = CONFIG.embeddingModel;
@@ -178,18 +180,24 @@ async function rewriteMemoryShard(dbPath: string): Promise<void> {
   const staged = await tursoConnectionManager.getConnection(stagedPath);
   try {
     await tursoShardManager.initShardDb(staged, dims, model);
-    const imported = await copyTableViaLibsql(dbPath, staged, "memories");
+    const imported = await copyTableViaLibsql(dbPath, staged, "memories", heartbeat);
     const metaClient = openLibsql(dbPath);
     try {
-      const metaRows = await metaClient.execute(`SELECT key, value FROM shard_metadata`);
-      for (const row of metaRows.rows) {
-        await staged.run(`INSERT OR REPLACE INTO shard_metadata (key, value) VALUES (?, ?)`, [
-          String(row.key),
-          String(row.value),
-        ]);
+      const metaRows = await metaClient
+        .execute(`SELECT key, value FROM shard_metadata`)
+        .catch(() => null);
+      for (const row of metaRows?.rows ?? []) {
+        try {
+          await staged.run(`INSERT OR REPLACE INTO shard_metadata (key, value) VALUES (?, ?)`, [
+            String(row.key),
+            String(row.value),
+          ]);
+        } catch {
+          // Metadata is optional; do not swallow ownership failures below.
+          break;
+        }
+        heartbeat();
       }
-    } catch {
-      // optional
     } finally {
       metaClient.close();
     }
@@ -205,19 +213,26 @@ async function rewriteMemoryShard(dbPath: string): Promise<void> {
   }
 
   // Match encryption-migrator: Windows cannot rename over an existing file (EPERM).
+  // Pre-swap aborts preserve the original and may leave a staged temp file.
+  heartbeat();
   await withSqliteFileLockRetry(() => {
     copySqliteDatabase(dbPath, backupPath);
     removeSqliteDatabase(dbPath);
     renameSqliteDatabase(stagedPath, dbPath);
   });
+  heartbeat();
 
   log("Migrated libSQL DiskANN shard to @tursodatabase/database", {
     dbPath,
     backupPath,
   });
 }
 
-async function rewriteGenericDb(dbPath: string, tables: string[]): Promise<void> {
+async function rewriteGenericDb(
+  dbPath: string,
+  tables: string[],
+  heartbeat: () => void
+): Promise<void> {
   const stagedPath = `${dbPath}.tursodb-migrate-${Date.now()}.tmp`;
   const backupPath = `${dbPath}.pre-tursodb-${Date.now()}.bak`;
 
@@ -230,14 +245,15 @@ async function rewriteGenericDb(dbPath: string, tables: string[]): Promise<void>
     const source = openLibsql(dbPath);
     try {
       for (const table of tables) {
+        heartbeat();
         const schema = await source.execute({
           sql: `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`,
           args: [table],
         });
         const createSql = schema.rows[0]?.sql ? String(schema.rows[0].sql) : null;
         if (!createSql) continue;
         await staged.run(createSql.replace(/F32_BLOB/gi, "BLOB"));
-        await copyTableViaLibsql(dbPath, staged, table);
+        await copyTableViaLibsql(dbPath, staged, table, heartbeat);
       }
       const indexes = await source.execute(
         `SELECT sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%'`
@@ -250,6 +266,7 @@ async function rewriteGenericDb(dbPath: string, tables: string[]): Promise<void>
         } catch {
           // index may already exist from CREATE TABLE
         }
+        heartbeat();
       }
     } finally {
       source.close();
@@ -260,11 +277,14 @@ async function rewriteGenericDb(dbPath: string, tables: string[]): Promise<void>
   }
 
   // Match encryption-migrator: Windows cannot rename over an existing file (EPERM).
+  // Pre-swap aborts preserve the original and may leave a staged temp file.
+  heartbeat();
   await withSqliteFileLockRetry(() => {
     copySqliteDatabase(dbPath, backupPath);
     removeSqliteDatabase(dbPath);
     renameSqliteDatabase(stagedPath, dbPath);
   });
+  heartbeat();
   log("Migrated auxiliary DB to @tursodatabase/database", { dbPath, backupPath });
 }
 
@@ -294,23 +314,26 @@ export async function runTursoEngineMigration(): Promise<void> {
   }
 
   const release = acquireTursoOperationLock("tursodb-engine-migrate");
+  const heartbeat = release.heartbeat;
   try {
     for (const path of toRewrite) 
```

**File**: `src/services/turso/legacy-migrator.ts` (modified, +45/-53)
```diff
@@ -7,11 +7,13 @@ import {
   writeFileSync,
 } from "node:fs";
 import { basename, join } from "node:path";
+import { randomUUID } from "node:crypto";
 import { CONFIG } from "../../config.js";
 import { log } from "../logger.js";
 import { tursoConnectionManager } from "./connection-manager.js";
 import { tursoShardManager } from "./shard-manager.js";
 import { runTursoEngineMigration } from "./engine-migrator.js";
+import { heartbeatTursoLock, readLiveTursoLock, releaseTursoLock } from "./operation-lock.js";
 import {
   withSqliteFileLockRetry,
   renameSqliteDatabase,
@@ -42,6 +44,7 @@ interface MigrationMarker {
 }
 
 interface MigrationLock {
+  id: string;
   pid: number;
   timestamp: string;
 }
@@ -91,68 +94,44 @@ function writeMarker(storagePath: string, shards: MigrationMarker["shards"]): vo
   writeFileSync(join(storagePath, MIGRATION_MARKER), JSON.stringify(marker, null, 2), "utf-8");
 }
 
-function isProcessAlive(pid: number): boolean {
-  try {
-    process.kill(pid, 0);
-    return true;
-  } catch {
-    return false;
-  }
-}
-
 function sleep(ms: number): Promise<void> {
   return new Promise((resolve) => setTimeout(resolve, ms));
 }
 
-function acquireMigrationLock(storagePath: string): boolean {
+function acquireMigrationLock(storagePath: string): string | null {
   const lockPath = join(storagePath, MIGRATION_LOCK);
-  if (existsSync(lockPath)) {
-    try {
-      const lock = JSON.parse(readFileSync(lockPath, "utf-8")) as MigrationLock;
-      if (lock.pid && isProcessAlive(lock.pid)) {
-        return false;
-      }
-      unlinkSync(lockPath);
-    } catch {
-      try {
-        unlinkSync(lockPath);
-      } catch {
-        // stale or corrupt lock — try atomic create below
-      }
-    }
-  }
+  if (readLiveTursoLock(lockPath)) return null;
 
-  const lock: MigrationLock = { pid: process.pid, timestamp: new Date().toISOString() };
+  const lock: MigrationLock = {
+    id: randomUUID(),
+    pid: process.pid,
+    timestamp: new Date().toISOString(),
+  };
   try {
     writeFileSync(lockPath, JSON.stringify(lock), { flag: "wx" });
-    return true;
+    return lock.id;
   } catch {
-    return false;
+    return null;
   }
 }
 
-async function acquireMigrationLockWithRetry(storagePath: string, maxAttempts = 3): Promise<void> {
+async function acquireMigrationLockWithRetry(
+  storagePath: string,
+  maxAttempts = 3
+): Promise<string> {
   for (let attempt = 0; attempt < maxAttempts; attempt++) {
-    if (acquireMigrationLock(storagePath)) {
-      return;
+    const id = acquireMigrationLock(storagePath);
+    if (id) {
+      return id;
     }
     await sleep(200 + attempt * 150);
   }
 
   throw new Error("Turso legacy migration locked by another process");
 }
 
-function releaseMigrationLock(storagePath: string): void {
-  const lockPath = join(storagePath, MIGRATION_LOCK);
-  if (!existsSync(lockPath)) return;
-  try {
-    const lock = JSON.parse(readFileSync(lockPath, "utf-8")) as MigrationLock;
-    if (lock.pid === process.pid) {
-      unlinkSync(lockPath);
-    }
-  } catch {
-    unlinkSync(lockPath);
-  }
+function releaseMigrationLock(storagePath: string, id: string): void {
+  releaseTursoLock(join(storagePath, MIGRATION_LOCK), id);
 }
 
 async function countMemories(db: TursoDb): Promise<number> {
@@ -210,11 +189,9 @@ async function isShardMigrationComplete(dbPath: string): Promise<boolean> {
     if (!(await hasMemoriesTable(db))) {
       return sidecar.expectedCount === 0;
     }
-    const count = await countMemories(db);
-    if (count !== sidecar.expectedCount) {
-      return false;
-    }
-    // Sidecar alone is not enough — require native vector index + readable vectors.
+    // Counts are verified before publishing the complete sidecar. Normal
+    // inserts and deletes must not invalidate that historical migration fact.
+    // Sidecar alone is not enough — still require native, readable vectors.
     return isTursoVectorShardReady(db);
   } catch {
     return false;
@@ -314,7 +291,10 @@ function rowToRecord(row: Record<string, unknown>): MemoryRecord | null {
   };
 }
 
-async function migrateMemoryShard(dbPath: string): Promise<ShardMigrationSidecar | null> {
+async function migrateMemoryShard(
+  dbPath: string,
+  heartbeatMigrationLock: () => void
+): Promise<ShardMigrationSidecar | null> {
   if (await isShardMigrationComplete(dbPath)) {
     const sidecar = readSidecar(dbPath);
     return sidecar;
@@ -411,6 +391,7 @@ async function migrateMemoryShard(dbPath: string): Promise<ShardMigrationSidecar
   }
 
   const expectedCount = records.length;
+  heartbeatMigrationLock();
   writeSidecar(dbPath, {
     sourceCount,
     expectedCount,
@@ -421,6 +402,7 @@ async function migrateMemoryShard(dbPath: string): Promise<ShardMigrationSidecar
 
   const backup = backupPath(dbPath);
   await tursoConnectionManager.closeConnection(dbPath);
+  heartbeatMigrationLock();
   if (existsSync(dbPath)) {
     await withSqliteFileLockRetry(() => renameSqlite
```

**File**: `src/services/turso/operation-lock.ts` (modified, +159/-18)
```diff
@@ -1,13 +1,31 @@
-import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
+import {
+  closeSync,
+  fstatSync,
+  openSync,
+  readFileSync,
+  statSync,
+  unlinkSync,
+  writeFileSync,
+  writeSync,
+  type Stats,
+} from "node:fs";
+import { randomUUID } from "node:crypto";
 import { join } from "node:path";
 import { CONFIG } from "../../config.js";
+import { log } from "../logger.js";
 
 const OPERATION_LOCK = ".turso-operation.lock";
 const LEGACY_MIGRATION_LOCK = ".turso-migrate.lock";
 
+// Thirty minutes of progress silence is far longer than a local 50-row insert
+// batch, shard swap, or individual embedding request. Long migrations heartbeat
+// at those boundaries, so total migration duration is not limited by this lease.
+export const TURSO_LOCK_STALE_MS = 30 * 60 * 1000;
+
 interface LockState {
+  id?: string;
   pid: number;
-  timestamp: string;
+  timestamp?: string;
   operation?: string;
 }
 
@@ -20,29 +38,152 @@ function isProcessAlive(pid: number): boolean {
   }
 }
 
-function readLiveLock(path: string): LockState | null {
-  if (!existsSync(path)) return null;
+function lockAgeMs(identity: Stats, state: LockState | null): number | null {
+  let timestamp = typeof state?.timestamp === "string" ? Date.parse(state.timestamp) : NaN;
+  if (!Number.isFinite(timestamp)) {
+    timestamp = identity.mtimeMs;
+  }
+  return Number.isFinite(timestamp) ? Date.now() - timestamp : null;
+}
+
+function sameFile(a: Pick<Stats, "dev" | "ino">, b: Pick<Stats, "dev" | "ino">): boolean {
+  return a.dev === b.dev && a.ino === b.ino;
+}
+
+/** Remove only the file inspected by the caller; cleanup must never throw. */
+export function unlinkTursoLockIfUnchanged(
+  path: string,
+  identity: Pick<Stats, "dev" | "ino">
+): boolean {
   try {
-    const state = JSON.parse(readFileSync(path, "utf-8")) as LockState;
-    if (Number.isInteger(state.pid) && state.pid > 0 && isProcessAlive(state.pid)) {
-      return state;
+    if (!sameFile(identity, statSync(path))) return false;
+    // A nanosecond stat → unlink race remains without interprocess locking.
+    // The true owner bounds it by aborting at its next progress heartbeat.
+    unlinkSync(path);
+    return true;
+  } catch {
+    // Missing or held open (Windows): preserve best-effort cleanup semantics.
+    return false;
+  }
+}
+
+/** Release by acquisition identity, never merely by PID. */
+export function releaseTursoLock(path: string, expectedId: string): void {
+  let fd: number | undefined;
+  try {
+    fd = openSync(path, "r");
+    const identity = fstatSync(fd);
+    const state = JSON.parse(readFileSync(fd, "utf-8")) as LockState | null;
+    if (state?.id === expectedId) unlinkTursoLockIfUnchanged(path, identity);
+  } catch {
+    // Missing, replaced, corrupt, or held open: cleanup must not block writes.
+  } finally {
+    if (fd !== undefined) closeSync(fd);
+  }
+}
+
+export class TursoLockOwnershipLostError extends Error {
+  override name = "TursoLockOwnershipLostError";
+}
+
+export function isTursoLockOwnershipLostError(
+  error: unknown
+): error is TursoLockOwnershipLostError {
+  return error instanceof TursoLockOwnershipLostError;
+}
+
+/** Shared lease check for both write gating and atomic migration acquisition. */
+export function readLiveTursoLock(path: string): LockState | null {
+  let fd: number;
+  try {
+    fd = openSync(path, "r");
+  } catch {
+    return null;
+  }
+  const identity = fstatSync(fd);
+  let state: LockState | null = null;
+  let reason = "corrupt lock";
+  try {
+    state = JSON.parse(readFileSync(fd, "utf-8")) as LockState | null;
+    if (state && Number.isInteger(state.pid) && state.pid > 0) {
+      const age = lockAgeMs(identity, state);
+      if (isProcessAlive(state.pid)) {
+        if (age === null || age <= TURSO_LOCK_STALE_MS) return state;
+        reason = "progress heartbeat expired";
+      } else {
+        reason = "dead PID";
+      }
     }
   } catch {
     // Corrupt locks are stale and removed below.
+  } finally {
+    closeSync(fd);
   }
+  const ageMs = lockAgeMs(identity, state);
+  const removed = unlinkTursoLockIfUnchanged(path, identity);
+  const details = {
+    path,
+    pid: state?.pid ?? null,
+    ageMs,
+    operation: state?.operation,
+    reason,
+    removed,
+  };
   try {
-    unlinkSync(path);
+    log("WARNING: Invalidating stale Turso migration lock", details);
   } catch {
-    // Already removed (race) or held open (Windows) — either way the lock is
-    // gone or unowned; do not let cleanup failure block writes.
+    // Audit even when the log destination is unavailable; logging must not
+    // turn an unowned lock into a permanent write outage.
+    console.warn("WARNING: Invalidating stale Turso migration lock", details);
+  }
+  if (!removed) {
+    try {
+      // A replacement must be evaluated on its own lease, not the stale read.
+      if (!sameFile(identity, statSync(path))) return readLiveTursoLock(path);
+
```

---

### Incident Patch 3: `c4c6abea` (2026-10-27)
**Commit Message**: fix(context): inject profile when project memories are empty (#444)

* fix(turso): restore log import in connection-manager

PR #440 switched close-path logging to safeLog but left other
call sites using log without importing it, which breaks typecheck.

* fix(context): inject profile when project memories are empty

loadMemoryContext short-circuited on an empty memory list, so
injectProfile never ran with chatMessage.maxMemories: 0. Always
call formatContextForPrompt so a standalone <user_profile> block
can still be delivered.

Closes #438

**File**: `src/index.ts` (modified, +2/-2)
```diff
@@ -695,8 +695,8 @@ export const OpenCodeMemPlugin: Plugin = async (ctx: PluginInput) => {
       memories = memories.filter((m: any) => new Date(m.createdAt).getTime() > cutoffDate);
     }
 
-    if (memories.length === 0) return "";
-
+    // Still format an empty project-memory payload so injectProfile can emit
+    // <user_profile> on its own (e.g. chatMessage.maxMemories: 0).
     const projectMemories = {
       results: memories.map((m: any) => ({
         similarity: 1.0,
```

**File**: `src/services/turso/connection-manager.ts` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ import type { DatabaseOpts, EncryptionOpts } from "@tursodatabase/database-commo
 import { existsSync, mkdirSync } from "node:fs";
 import { dirname, resolve, relative, isAbsolute, sep } from "node:path";
 import { CONFIG } from "../../config.js";
-import { safeLog } from "../logger.js";
+import { log, safeLog } from "../logger.js";
 import { collectReleasedSqliteHandles } from "./sqlite-handle-release.js";
 import { TursoDb } from "./turso-db.js";
 import { resolveOrCreateDatabaseEncryptionKey } from "./encryption-key.js";
```

**File**: `tests/fixtures/child-session-capture.mjs` (modified, +1/-0)
```diff
@@ -60,6 +60,7 @@ mock.module(moduleUrl("services/user-prompt/user-prompt-manager"), () => ({
 }));
 mock.module(moduleUrl("services/logger"), () => ({
   log() {},
+  safeLog() {},
   serializeError: (error) => ({ error: error instanceof Error ? error.message : String(error) }),
 }));
 mock.module(moduleUrl("services/web-server"), () => ({
```

**File**: `tests/fixtures/profile-inject-empty-memories.mjs` (added, +105/-0)
```diff
@@ -0,0 +1,105 @@
+import { mock } from "bun:test";
+
+const moduleUrl = (path) => new URL("../../src/" + path + ".js", import.meta.url).href;
+const config = {
+  injectProfile: true,
+  chatMessage: {
+    enabled: true,
+    injectOn: "first",
+    maxMemories: 0,
+    excludeCurrentSession: false,
+    filterInjectedPrompts: true,
+    captureChildSessions: false,
+  },
+  compaction: { enabled: false },
+  autoCaptureEnabled: false,
+  webServerEnabled: false,
+  autoUpdate: { enabled: false },
+  storagePath: process.argv[2],
+  opencodeModel: "inherit",
+};
+const formatCalls = [];
+let listLimit = null;
+
+mock.module(moduleUrl("config"), () => ({
+  CONFIG: config,
+  initConfig() {},
+  isConfigured: () => true,
+}));
+mock.module(moduleUrl("services/client"), () => ({
+  memoryClient: {
+    warmup: async () => {},
+    close: async () => {},
+    listMemories: async (_tag, limit) => {
+      listLimit = limit;
+      return { success: true, memories: [] };
+    },
+  },
+}));
+mock.module(moduleUrl("services/tags"), () => ({
+  getTags: () => ({
+    project: { tag: "fixture-project" },
+    user: { userEmail: "fixture-user@example.com" },
+  }),
+}));
+// Record that loadMemoryContext still formats when project memories are empty.
+mock.module(moduleUrl("services/context"), () => ({
+  formatContextForPrompt: async (userId, projectMemories) => {
+    formatCalls.push({
+      userId,
+      resultCount: projectMemories?.results?.length ?? 0,
+    });
+    return (
+      "<memory_context>\n" +
+      `<user_profile>\nprefs for ${userId}\n</user_profile>\n` +
+      "</memory_context>"
+    );
+  },
+}));
+mock.module(moduleUrl("services/user-prompt/user-prompt-manager"), () => ({
+  userPromptManager: {
+    savePrompt: async () => {},
+    setPromptModel: async () => {},
+  },
+}));
+mock.module(moduleUrl("services/logger"), () => ({
+  log() {},
+  safeLog() {},
+  serializeError: (error) => ({ error: error instanceof Error ? error.message : String(error) }),
+}));
+mock.module(moduleUrl("services/web-server"), () => ({
+  startWebServer: async () => null,
+  WebServer: class {},
+}));
+mock.module(moduleUrl("services/auto-update"), () => ({ startAutoUpdate() {} }));
+
+const { OpenCodeMemPlugin } = await import(moduleUrl("index"));
+
+const client = {
+  provider: { list: async () => ({ data: { connected: [] } }) },
+  session: {
+    get: async ({ path }) => ({ data: { id: path.id, title: "regular task" } }),
+    messages: async () => ({ data: [] }),
+  },
+};
+
+const plugin = await OpenCodeMemPlugin({ directory: "/fixture-project", client });
+
+const loaded = await plugin.memoryContext.load("ses-profile");
+
+const v1Parts = [{ type: "text", text: "hello" }];
+await plugin["chat.message"](
+  { sessionID: "ses-profile-v1" },
+  { message: { id: "msg-1" }, parts: v1Parts }
+);
+
+await plugin.dispose();
+
+console.log(
+  JSON.stringify({
+    listLimit,
+    formatCalls,
+    loaded,
+    v1Parts,
+  })
+);
```

**File**: `tests/fixtures/v2-memory-context.mjs` (modified, +7/-2)
```diff
@@ -46,8 +46,12 @@ mock.module(moduleUrl("services/tags"), () => ({
   }),
 }));
 mock.module(moduleUrl("services/context"), () => ({
-  formatContextForPrompt: async (_user, data) =>
-    "<memory_context>" + data.results.map((m) => m.memory).join("|") + "</memory_context>",
+  // Mirror production: empty project memories yield "" unless a profile block exists.
+  formatContextForPrompt: async (_user, data) => {
+    const results = data?.results ?? [];
+    if (results.length === 0) return "";
+    return "<memory_context>" + results.map((m) => m.memory).join("|") + "</memory_context>";
+  },
 }));
 mock.module(moduleUrl("services/user-prompt/user-prompt-manager"), () => ({
   userPromptManager: {
@@ -57,6 +61,7 @@ mock.module(moduleUrl("services/user-prompt/user-prompt-manager"), () => ({
 }));
 mock.module(moduleUrl("services/logger"), () => ({
   log() {},
+  safeLog() {},
   serializeError: (error) => ({ error: error instanceof Error ? error.message : String(error) }),
 }));
 mock.module(moduleUrl("services/web-server"), () => ({
```

**File**: `tests/memory-provenance.test.ts` (modified, +5/-0)
```diff
@@ -88,6 +88,11 @@ describe("memory provenance formatting", () => {
     expect(result).toContain('<memory relevance="50%">\nFallback chunk\n</memory>');
   });
 
+  it("returns empty string when project memories are empty and no profile applies", async () => {
+    expect(await formatContextForPrompt(null, { results: [] })).toBe("");
+    expect(await formatContextForPrompt(null, {})).toBe("");
+  });
+
   it("renders exact compaction output with provenance", () => {
     expect(
       formatMemoriesForCompaction([
```

**File**: `tests/profile-inject-empty-memories.test.ts` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+import { afterAll, beforeAll, describe, expect, it } from "bun:test";
+import { mkdtempSync, rmSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { fileURLToPath } from "node:url";
+import { join } from "node:path";
+
+const directory = mkdtempSync(join(tmpdir(), "opencode-mem-profile-empty-"));
+let result: any;
+
+afterAll(() => rmSync(directory, { recursive: true, force: true }));
+
+beforeAll(() => {
+  // Isolate module mocks from the suite. Drive the real shared plugin with
+  // maxMemories: 0 so project listing is empty, while injectProfile stays on.
+  const child = Bun.spawnSync([
+    process.execPath,
+    fileURLToPath(new URL("./fixtures/profile-inject-empty-memories.mjs", import.meta.url)),
+    directory,
+  ]);
+  expect(child.exitCode).toBe(0);
+  expect(child.stderr.toString()).toBe("");
+  result = JSON.parse(child.stdout.toString().trim());
+});
+
+describe("profile injection with empty project memories", () => {
+  it("still formats context when chatMessage.maxMemories is 0", () => {
+    expect(result.listLimit).toBe(0);
+    expect(result.formatCalls).toHaveLength(2);
+    expect(result.formatCalls.every((call: any) => call.resultCount === 0)).toBe(true);
+    expect(
+      result.formatCalls.every((call: any) => call.userId === "fixture-user@example.com")
+    ).toBe(true);
+  });
+
+  it("injects a profile-only memory context via memoryContext.load", () => {
+    expect(result.loaded).toContain("<user_profile>");
+    expect(result.loaded).toContain("fixture-user@example.com");
+    expect(result.loaded).toContain("<memory_context>");
+    expect(result.loaded).not.toContain("<project_knowledge>");
+  });
+
+  it("injects the same profile block on the V1 chat.message path", () => {
+    expect(result.v1Parts).toHaveLength(2);
+    expect(result.v1Parts[0].synthetic).toBe(true);
+    expect(result.v1Parts[0].text).toBe(result.loaded);
+  });
+});
```

#### Recent Merged Pull Requests:
- **PR #450** (2026-10-27): chore(release): release v2.36.0 (@EyJunge1)
- **PR #449** (2026-10-27): feat(markdown): add optional vault backend for persistent memories (@EyJunge1)
- **PR #448** (2026-10-27): chore(release): release v2.35.0 (@EyJunge1)
- **PR #447** (2026-10-27): fix(turso): stop dispose closeAll from racing sibling idle handlers (@EyJunge1)
- **PR #446** (2026-10-27): fix(migration): use opencodeProvider for tag migration and stream retry (@EyJunge1)
- **PR #445** (2026-10-27): fix(test): move web-server-health ports below ephemeral range (@EyJunge1)

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

## X. turso): checkpoint the WAL before closing a database (#440)

**RULE**:
When implementing operations in `src/services/logger.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tickernelz/opencode-mem. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c26bf2c9`: turso): checkpoint the WAL before closing a database (#440). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/services/logger.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
/**
 * Log without letting a logger failure escape. `log()` initialises the log
 * directory lazily and can throw on ENOSPC/EACCES; callers on a teardown path
 * must never let a diagnostic write skip the work that follows it.
 */
export function safeLog(message: string, data?: unknown): void {
  try {
    log(message, data);
  } catch {
    // swallow — the caller's cleanup matters more than this line
  }
}

```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c26bf2c9` are properly handled with clean fallback behavior.
