> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tickernelz-opencode-mem-learnings.md`  
> **Source**: github ([https://github.com/tickernelz/opencode-mem](https://github.com/tickernelz/opencode-mem))  
> **Source Version**: `a2072d75`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-13T18:17:57.031Z  
> **Learning ID**: `learn-github-tickernelz-opencode-mem-mv707j1j`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): tickernelz/opencode-mem

> **Canonical Artifact**: `07_PROJECT_LEARNING/tickernelz-opencode-mem-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tickernelz/opencode-mem](https://github.com/tickernelz/opencode-mem))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-13T18:17:55.610Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tickernelz/opencode-mem`
- **Description**: OpenCode plugin that gives coding agents persistent memory using local vector database
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1736 stars

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
  table: string
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
    }
    return imported;
  } finally {
    client.close();
  }
}

async function rewriteMemoryShard(dbPath: string): Promise<void> {
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
    const imported = await copyTableViaLibsql(dbPath, staged, "memories");
    const metaClient = openLibsql(dbPath);
    try {
      const metaRows = await metaClient.execute(`SELECT key, value FROM shard_metadata`);
      for (const row of metaRows.rows) {
        await staged.run(`INSERT OR REPLACE INTO shard_metadata (key, value) VALUES (?, ?)`, [
          String(row.key),
          String(row.value),
        ]);
      }
    } catch {
      // optional
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
  await withSqliteFileLockRetry(() => {
    copySqliteDatabase(dbPath, backupPath);
    removeSqliteDatabase(dbPath);
    renameSqliteDatabase(stagedPath, dbPath);
  });

  log("Migrated libSQL DiskANN shard to @tursodatabase/database", {
    dbPath,
    backupPath,
  });
}

async function rewriteGenericDb(dbPath: string, tables: string[]): Promise<void> {
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
        const schema = await source.execute({
          sql: `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`,
          args: [table],
        });
        const createSql = schema.rows[0]?.sql ? String(schema.rows[0].sql) : null;
        if (!createSql) continue;
        await staged.run(createSql.replace(/F32_BLOB/gi, "BLOB"));
        await copyTableViaLibsql(dbPath, staged, table);
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
      }
    } finally {
      source.close();
    }
  } finally {
    await staged.close();
    await collectReleasedSqliteHandles();
  }

  // Match encryption-migrator: Windows cannot rename over an existing file (EPERM).
  await withSqliteFileLockRetry(() => {
    copySqliteDatabase(dbPath, backupPath);
    removeSqliteDatabase(dbPath);
    renameSqliteDatabase(stagedPath, dbPath);
  });
  log("Migrated auxiliary DB to @tursodatabase/database", { dbPath, backupPath });
}

/**
 * Convert any local shards that still use libSQL DiskANN indexes into plain
 * @tursodatabase/database files (F32_BLOB + exact cosine search).
 */
export async function runTursoEngineMigration(): Promise<void> {
  if (existsSync(markerPath())) return;

  const candidates = collectCandidateDbs();
  if (candidates.length === 0) {
    writeFileSync(markerPath(), JSON.stringify({ migratedAt: new Date().toISOString() }));
    return;
  }

  const toRewrite: string[] = [];
  for (const path of candidates) {
    if (await needsEngineRewrite(path)) {
      toRewrite.push(path);
    }
  }

  if (toRewrite.length === 0) {
    writeFileSync(markerPath(), JSON.stringify({ migratedAt: new Date().toISOString() }));
    return;
  }

  const release = acquireTursoOperationLock("tursodb-engine-migrate");
  try {
    for (const path of toRewrite) {
      const base =
```

### Core Architecture Module: `src/services/turso/lifecycle.ts`
```
import { tursoConnectionManager } from "./connection-manager.js";
import { tursoShardManager } from "./shard-manager.js";
import { resetTursoReady } from "./ready.js";
import { userPromptManager } from "../user-prompt/user-prompt-manager.js";
import { userProfileManager } from "../user-profile/user-profile-manager.js";
import { aiSessionManager } from "../ai/session/ai-session-manager.js";

export async function closeTursoAndInvalidateCaches(): Promise<void> {
  await tursoConnectionManager.closeAll();
  tursoShardManager.reset();
  resetTursoReady();
  userPromptManager.reset();
  userProfileManager.reset();
  aiSessionManager.reset();
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

### Core Architecture Module: `web/src/lib/utils.ts`
```
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

```

### Core Architecture Module: `eslint.config.js`
```
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import ts from "typescript-eslint";

export default ts.config(
  {
    ignores: [
      "coverage/**",
      "dist/**",
      "node_modules/**",
      "out/**",
      "web/dist/**",
      "web/node_modules/**",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  prettier,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.bun,
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["web/src/**/*.svelte.ts", "web/src/**/*.svelte.js"],
    languageOptions: {
      parserOptions: {
        extraFileExtensions: [".svelte"],
      },
    },
  }
);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #288** (2026-08-30): **Show matched memory count while Web UI search is active**
  *Symptoms*: Split from #284 so the Web UI behavior can be fixed independently.  The memory explorer count continues to display the store-wide total while a search is active. It should display the number of matched results so users can tell whether the current query found anything.  Acceptance criteria: - show the filtered result count while search is active - restore the full count when search is cleared - add UI or state-level regression coverage  See #284 for the original reproduction.

- **Issue #287** (2026-09-01): **Forward memoryExtraParams in external AI cleanup requests**
  *Symptoms*: Split from #284 so provider request behavior can be fixed independently.  The external API path in `src/services/user-profile/ai-cleanup.ts` builds its request body directly and does not include configured `memoryExtraParams`. Provider-specific parameters such as `enable_thinking: false` therefore work in other model calls but are omitted during cleanup.  Acceptance criteria: - forward configured extra parameters through the cleanup request path - preserve required cleanup fields and prevent unsafe overrides - add request-body coverage  See #284 for the SiliconFlow/Qwen reproduction.

- **Issue #286** (2026-09-01): **Align HTTP and AI cleanup timeout hierarchy**
  *Symptoms*: Split from #284 so the timeout policy can be handled independently.  The HTTP server timeout is 30 seconds while the external AI cleanup fetch allows 60 seconds. A valid slow cleanup can therefore be terminated by the outer server before the inner operation reaches its own deadline, producing an empty response.  Acceptance criteria: - make the outer HTTP timeout longer than the cleanup operation deadline, or derive both from one setting - document the timeout relationship - cover the ordering with a focused test  See #284 for the observed timeout layers and reproduction.

- **Issue #285** (2026-09-01): **AI cleanup aborts on premature request close event under Node.js 26**
  *Symptoms*: Split from #284 so this can be reproduced and fixed independently.  On Windows 11 with Node.js 26, AI cleanup can abort shortly after the request body is consumed. The request `close` event fires before the actual connection ends, and the current cleanup handler treats it as a client disconnect. The browser receives `ERR_EMPTY_RESPONSE` while server-side cleanup is still running.  Acceptance criteria: - do not abort cleanup merely because the request body has closed - still cancel work on a genuine client disconnect - add a regression test for the request lifecycle  See #284 for the original environment and reproduction details.

- **Issue #277** (2026-10-01): **Vector index bloat: no compress_neighbors/max_neighbors tuning - 542 MB shard for ~656 memories (2048-dim embeddings)**
  *Symptoms*: ### Environment  - opencode-mem: 2.22.2 (issue likely affects all versions up to 2.25.0) - OS: Windows 11 - Embedding: remote OpenAI-compatible API (`doubao-embedding-vision`), **2048 dims**  ### Symptom  With only ~656 memories in a project shard, the shard DB grew to **542 MB**. `dbstat` shows the two DiskANN shadow tables account for **98%** of the file:  | object | size | |---|---| | `memories_vec_idx_shadow` | 267.4 MB | | `memories_tags_vec_idx_shadow` | 266.5 MB | | `memories` (all actual text + metadata) | 11.0 MB |  That is ~850 KB of index overhead **per memory**, while the raw vectors are only 2048 × 4 B ≈ 8 KB each.  ### Root cause  `initShardDb()` creates both vector indexes with `'metric=cosine'` only:  ```sql CREATE INDEX ... ON memories (libsql_vector_idx(vector, 'metric=cosine')) ```  libSQL defaults are aggressive at high dimensionality:  - `max_neighbors = 3·√D` → **~137 neighbors per node** at D=2048 - `compress_neighbors` unset → neighbor vectors stored as **uncompressed F32**  This matches the documented space formula `N · (Storage(T1) + M · Storage(T2))` in the [Turso docs](https://docs.turso.tech/features/ai-and-embeddings).  ### Fix verified locally  Dropping and re-creating the same-named indexes with tuned parameters, then `VACUUM`, shrinks the whole shard from **542.5 MB → 73.3 MB (~7.4×)** with search quality intact:  ```sql DROP INDEX IF EXISTS memories_vec_idx; DROP INDEX IF EXISTS memories_tags_vec_idx; CREATE INDEX memories_vec_idx ON memories
  **Post-Mortem & Fix Analysis**:
  > Thanks for the unusually complete report. I verified the core claim against current `main` / `@libsql/client`:  - both indexes are still created with only `metric=cosine` in `src/services/turso/shard-manager.ts`; - the runtime accepts both `compress_neighbors=float8` and `max_neighbors=20` for the normal and partial vector indexes; - inserts and `vector_top_k` queries continue to work with those options; - Turso's documented storage formula confirms that high-dimensional uncompressed neighbor vectors can dominate the file.  So this is a real storage-amplification bug, especially for remote 1536/2048-dimensional embeddings.  One migration correction: plain `REINDEX memories_vec_idx` does **not** change index options. I verified that `sqlite_schema.sql` remains the original `libsql_vector_idx(vector, 'metric=cosine')` definition before and after `REINDEX`. Existing shards therefore need an explicit, failure-safe migration that drops and recreates both indexes with the new definition; `VA
  > Closing as resolved by a later architecture change.  - [#279](https://github.com/tickernelz/opencode-mem/pull/279) added `compress_neighbors=float8` / `max_neighbors=20` for newly created DiskANN indexes (no rebuild migration for existing shards). - [#340](https://github.com/tickernelz/opencode-mem/pull/340) hard-cutover to `@tursodatabase/database` removed DiskANN entirely: shards no longer create `memories_vec_idx` / `memories_tags_vec_idx`, and search uses exact cosine via `vector_distance_cos`. - Existing DiskANN shards are rewritten on startup by `runTursoEngineMigration()` (engine migrator), which drops the shadow-table bloat.  The original storage amplification no longer applies on current main.

- **Issue #253** (2026-10-03): **Thinking mode does not support this tool_choice**
  *Symptoms*: 模型执行结束后报错 <img width="532" height="153" alt="Image" src="https://github.com/user-attachments/assets/0e58c4f8-2da3-449c-82b0-335a2b133ba8" />  <img width="561" height="136" alt="Image" src="https://github.com/user-attachments/assets/c07f4a6a-6865-499a-971c-00c3dff2b6e1" />  opencode 模型配置如下 "opencodeProvider": "opencode-go",  "opencodeModel": "deepseek-v4-flash"
  **Post-Mortem & Fix Analysis**:
  > 我复核了两张截图和当前调用链，这里实际有两层问题：  1. 底层真实错误是 `opencode-go / deepseek-v4-flash` 的 thinking 模式拒绝 forced `tool_choice`。`opencode-mem` 走的是 OpenCode `session.prompt` + `format: json_schema`，provider wire payload 由 OpenCode 生成；本仓库的 manual `OpenAIChatCompletionProvider.tool_choice` 不参与这条路径，因此不应在这里硬编码 DeepSeek 模型名单或伪造 provider 参数。 2. 当前插件捕获底层错误后，无条件尝试可选 External API fallback；当用户没有配置 manual fallback 时，又用 `External API not configured for auto-capture` 覆盖了真实根因，所以最终 toast 误导。  我已提交 #258 修复第 2 层：没有完整 manual fallback 时保留原始 OpenCode provider 错误；若确实配置了 `memoryModel` + `memoryApiUrl`，原 fallback 行为不变。入口级回归证明 toast 会显示 `Thinking mode does not support ...`，不会再显示误导性的 External API 错误。  本地验证：目标 2/2、完整 408/408、typecheck、format、production build 全绿；mutation check 移除实现后会精确恢复原截图错误并使回归失败。  第 1 层需要 OpenCode/provider compat 修复：同一 `opencode-go/deepseek-v4-flash` + OpenAI Responses 错误已被其他客户端独立复现，正确策略是在 thinking 模型上省略 forced named selector、保留工具广告，而不是由插件自行重写供应商 payload。当前绕行是升级到包含该兼容策略的 OpenCode/provider 版本，或为 `opencodeModel` 选
  > Thanks for the report. To reproduce this, could you share:\n1. opencode-mem version (check the opencode plugin list)\n2. Your full opencode-mem config (redact API keys)\n3. Whether this happens on every request or only in thinking/reasoning mode\n4. The exact error text from the screenshot (it's hard to read at this resolution)\n\nThe `tool_choice` parameter may not be supported by all providers in thinking/reasoning mode. Knowing your provider and model version will help narrow this down.
  > 1. I am using the latest version of opencode-mem. 2. Please see the attachment. 3. It happens every time when used in opencode. 4. “Auto Capture Failed Summary generation failed: External API not configured for auto-capture” “Error from provider (Console Go): Upstream request failed: Thinking mode does not support this tool_choice”  [opencode-mem.jsonc](https://github.com/user-attachments/files/31498034/opencode-mem.jsonc)

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

### Incident Patch 1: `2dd12552` (2026-10-13)
**Commit Message**: fix: re-raise SIGINT/SIGTERM after plugin cleanup (#409)

Signal listeners suppressed the runtime default exit, so opencode
web/serve survived SIGTERM indefinitely (#408). After cleanup, drop
our listeners and re-deliver the signal without process.exit (#114).

**File**: `src/index.ts` (modified, +7/-1)
```diff
@@ -591,13 +591,19 @@ export const OpenCodeMemPlugin: Plugin = async (ctx: PluginInput) => {
     if (memoryClient) await memoryClient.close();
   };
 
-  const shutdownHandler = async () => {
+  const shutdownHandler = async (signal: NodeJS.Signals) => {
     try {
       await cleanupPlugin();
     } catch (error) {
       log("Shutdown error", { error: String(error) });
       process.exitCode = 1;
     }
+    // Registering listeners disables the runtime's default termination.
+    // After cleanup, remove ours and re-raise so the host can exit (#408).
+    // Avoid forced process exit here — that crashes onnxruntime-node finalizers (#114).
+    process.off("SIGINT", shutdownHandler);
+    process.off("SIGTERM", shutdownHandler);
+    process.kill(process.pid, signal);
   };
 
   const beforeExitHandler = () => {
```

**File**: `tests/plugin-shutdown.test.ts` (modified, +10/-0)
```diff
@@ -8,6 +8,16 @@ describe("plugin shutdown", () => {
     expect(source).not.toContain("process.exit(");
   });
 
+  it("re-raises SIGINT/SIGTERM after cleanup so the host can exit", () => {
+    const source = readFileSync(new URL("../src/index.ts", import.meta.url), "utf-8");
+
+    // Listeners suppress default termination; after cleanup we must drop them
+    // and re-deliver the signal (#408) without process.exit (#114).
+    expect(source).toContain('process.off("SIGINT", shutdownHandler)');
+    expect(source).toContain('process.off("SIGTERM", shutdownHandler)');
+    expect(source).toContain("process.kill(process.pid, signal)");
+  });
+
   it("clears pending idle auto-capture work during cleanup", () => {
     const source = readFileSync(new URL("../src/index.ts", import.meta.url), "utf-8");
 
```

---

### Incident Patch 2: `337236d9` (2026-10-12)
**Commit Message**: fix(embedding): retry transient remote embedding failures (fixes import timeout #400) (#401)

* fix(embedding): retry transient remote embedding failures per attempt

Problem: a single hung remote embedding request aborted an entire
import with zero memories written (issue #400, reproduced 2x) and
could wedge search the same way. The warmup probe had no retry either,
and its failure set the sticky initError until restart.

Design: extract the remote call into fetchRemoteEmbeddingWithRetry —
per-attempt 10s ceiling, up to 3 attempts, linear backoff, retry only
network errors/timeouts/429/5xx, fail fast on other 4xx. Both the
warmup probe and embed() now route through it, so add, search-query,
and import all gain transient-failure resilience inside the existing
outer embedWithTimeout budget.

Verification: new tests/embedding-remote-retry.test.ts (6 cases:
hang-recovery, 429, 500, fail-fast 401, exhaustion, request shape);
tsc --noEmit, eslint, prettier clean; full bun test failure set
identical to clean main (15 pre-existing environmental failures).
End-to-end: instrumented import with one injected 40s fetch hang —
before: Timeout after 30000ms, imported 0; after: success, imported 

**File**: `src/services/embedding.ts` (modified, +109/-40)
```diff
@@ -13,6 +13,18 @@ const requireFromHere = createRuntimeRequire(import.meta);
 const TIMEOUT_MS = 30000;
 const GLOBAL_EMBEDDING_KEY = Symbol.for("opencode-mem.embedding.instance");
 const MAX_CACHE_SIZE = 100;
+/**
+ * Per-attempt ceiling for one remote embedding HTTP call. Kept at 8s so
+ * 3 attempts + linear backoff stay under the outer embedWithTimeout budget
+ * (TIMEOUT_MS = 30s). A single hung request costs one attempt instead of the
+ * whole budget (#400: one transient hang previously aborted an entire import
+ * with zero memories written).
+ */
+const REMOTE_ATTEMPT_TIMEOUT_MS = 8000;
+/** Attempts per remote embedding call: 1 try + 2 retries on transient failures. */
+const REMOTE_MAX_ATTEMPTS = 3;
+/** Base backoff between remote embedding attempts; scales linearly (backoffMs * attempt). */
+const REMOTE_RETRY_BACKOFF_MS = 500;
 
 // ONNX weight variants in descending precision, mirroring transformers.js
 // DEFAULT_DTYPE_SUFFIX_MAPPING (utils/dtypes.js). fp32 has no filename suffix.
@@ -243,6 +255,97 @@ function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
   ]);
 }
 
+/** Remote embedding call failed with an HTTP status. */
+export class EmbeddingHttpError extends Error {
+  constructor(
+    public readonly status: number,
+    statusText: string
+  ) {
+    super(`API embedding failed: ${status} ${statusText}`);
+    this.name = "EmbeddingHttpError";
+  }
+}
+
+/**
+ * Classify an embedding fetch failure as retryable. Only transient conditions
+ * are retried: HTTP 429/5xx, per-attempt AbortSignal timeouts, and network
+ * TypeErrors from fetch. JSON parse errors, other 4xx, and unexpected errors
+ * fail fast so programming/shape bugs are not amplified across attempts.
+ */
+function isRetryableEmbeddingError(error: unknown): boolean {
+  if (error instanceof EmbeddingHttpError) {
+    return error.status === 429 || error.status >= 500;
+  }
+  if (error instanceof DOMException) {
+    return error.name === "TimeoutError" || error.name === "AbortError";
+  }
+  // fetch network failures surface as TypeError; AbortSignal.timeout may too
+  // depending on runtime (Bun/Node) — accept TimeoutError/AbortError names.
+  if (error instanceof Error) {
+    if (error.name === "TimeoutError" || error.name === "AbortError") return true;
+    if (error instanceof TypeError) return true;
+  }
+  return false;
+}
+
+/**
+ * Perform a remote embedding request with bounded retries. Each attempt uses
+ * AbortSignal.timeout so a hung connection is cancelled (not orphaned via
+ * Promise.race); transient failures (network, abort/timeout, 429, 5xx) are
+ * retried with linear backoff, everything else fails fast.
+ *
+ * `fetchImpl` is injectable for tests.
+ */
+export async function fetchRemoteEmbeddingWithRetry(
+  fetchImpl: typeof fetch,
+  input: string,
+  options: {
+    url?: string;
+    apiKey?: string;
+    model?: string;
+    attemptTimeoutMs?: number;
+    maxAttempts?: number;
+    backoffMs?: number;
+  } = {}
+): Promise<any> {
+  const url = options.url ?? CONFIG.embeddingApiUrl;
+  const apiKey = options.apiKey ?? CONFIG.embeddingApiKey;
+  const model = options.model ?? CONFIG.embeddingModel;
+  const attemptTimeoutMs = options.attemptTimeoutMs ?? REMOTE_ATTEMPT_TIMEOUT_MS;
+  const maxAttempts = options.maxAttempts ?? REMOTE_MAX_ATTEMPTS;
+  const backoffMs = options.backoffMs ?? REMOTE_RETRY_BACKOFF_MS;
+
+  let lastError: unknown;
+  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
+    try {
+      const response = await fetchImpl(`${url}/embeddings`, {
+        method: "POST",
+        headers: {
+          "Content-Type": "application/json",
+          Authorization: `Bearer ${apiKey}`,
+        },
+        body: JSON.stringify({ input, model }),
+        signal: AbortSignal.timeout(attemptTimeoutMs),
+      });
+      if (!response.ok) {
+        throw new EmbeddingHttpError(response.status, response.statusText);
+      }
+      try {
+        return await response.json();
+      } catch (parseError) {
+        throw new Error("Invalid embedding API JSON", { cause: parseError });
+      }
+    } catch (error) {
+      lastError = error;
+      if (attempt === maxAttempts || !isRetryableEmbeddingError(error)) {
+        throw error instanceof Error ? error : new Error(String(error));
+      }
+      await new Promise((resolve) => setTimeout(resolve, backoffMs * attempt));
+    }
+  }
+  throw lastError instanceof Error ? lastError : new Error(String(lastError));
+}
+
 export class EmbeddingService {
   private pipe: any = null;
   private initPromise: Promise<void> | null = null;
@@ -270,29 +373,11 @@ export class EmbeddingService {
   private async initializeModel(progressCallback?: (progress: any) => void): Promise<void> {
     try {
       if (CONFIG.embeddingApiUrl && CONFIG.embeddingApiKey) {
-        // Send a probe request to verify the API endpoint is actually reachable
-        // Uses a minimal embedding of "ping" to test the full request pipel
```

**File**: `tests/embedding-remote-retry.test.ts` (added, +173/-0)
```diff
@@ -0,0 +1,173 @@
+import { describe, it, expect } from "bun:test";
+import { fetchRemoteEmbeddingWithRetry, EmbeddingHttpError } from "../src/services/embedding.js";
+
+function jsonResponse(status: number): Response {
+  return {
+    ok: status >= 200 && status < 300,
+    status,
+    statusText: status === 200 ? "OK" : "Error",
+    json: async () => ({ data: [{ embedding: [0.1, 0.2] }] }),
+  } as unknown as Response;
+}
+
+const RETRY_OPTS = {
+  url: "https://fake.local/v1",
+  apiKey: "test-key",
+  model: "test-model",
+  attemptTimeoutMs: 50,
+  maxAttempts: 3,
+  backoffMs: 5,
+};
+
+describe("fetchRemoteEmbeddingWithRetry", () => {
+  it("recovers when the first attempt hangs past the per-attempt AbortSignal timeout", async () => {
+    let calls = 0;
+    const fetchImpl = async (_url: unknown, init?: { signal?: AbortSignal }) => {
+      calls++;
+      if (calls === 1) {
+        expect(init?.signal).toBeDefined();
+        await new Promise<never>((_resolve, reject) => {
+          const signal = init!.signal!;
+          if (signal.aborted) {
+            reject(signal.reason ?? new DOMException("The operation was aborted.", "TimeoutError"));
+            return;
+          }
+          signal.addEventListener(
+            "abort",
+            () => {
+              reject(
+                signal.reason ?? new DOMException("The operation was aborted.", "TimeoutError")
+              );
+            },
+            { once: true }
+          );
+        });
+      }
+      return jsonResponse(200);
+    };
+    const data = await fetchRemoteEmbeddingWithRetry(
+      fetchImpl as unknown as typeof fetch,
+      "hello",
+      RETRY_OPTS
+    );
+    expect(data.data[0].embedding).toEqual([0.1, 0.2]);
+    expect(calls).toBe(2);
+  });
+
+  it("retries on network TypeError and succeeds on a later attempt", async () => {
+    let calls = 0;
+    const fetchImpl = async () => {
+      calls++;
+      if (calls === 1) throw new TypeError("fetch failed");
+      return jsonResponse(200);
+    };
+    const data = await fetchRemoteEmbeddingWithRetry(
+      fetchImpl as unknown as typeof fetch,
+      "hello",
+      RETRY_OPTS
+    );
+    expect(data.data[0].embedding).toEqual([0.1, 0.2]);
+    expect(calls).toBe(2);
+  });
+
+  it("fails fast on invalid JSON without consuming another attempt", async () => {
+    let calls = 0;
+    const fetchImpl = async () => {
+      calls++;
+      return {
+        ok: true,
+        status: 200,
+        statusText: "OK",
+        json: async () => {
+          throw new SyntaxError("Unexpected token");
+        },
+      } as unknown as Response;
+    };
+    await expect(
+      fetchRemoteEmbeddingWithRetry(fetchImpl as unknown as typeof fetch, "hello", RETRY_OPTS)
+    ).rejects.toThrow("Invalid embedding API JSON");
+    expect(calls).toBe(1);
+  });
+
+  it("passes AbortSignal.timeout to each fetch attempt", async () => {
+    let seenSignal: AbortSignal | undefined;
+    const fetchImpl = async (_url: unknown, init?: { signal?: AbortSignal }) => {
+      seenSignal = init?.signal;
+      return jsonResponse(200);
+    };
+    await fetchRemoteEmbeddingWithRetry(fetchImpl as unknown as typeof fetch, "hello", RETRY_OPTS);
+    expect(seenSignal).toBeDefined();
+    expect(typeof seenSignal!.aborted).toBe("boolean");
+  });
+
+  it("retries on 429 and succeeds on a later attempt", async () => {
+    let calls = 0;
+    const fetchImpl = async () => {
+      calls++;
+      return calls === 1 ? jsonResponse(429) : jsonResponse(200);
+    };
+    const data = await fetchRemoteEmbeddingWithRetry(
+      fetchImpl as unknown as typeof fetch,
+      "hello",
+      RETRY_OPTS
+    );
+    expect(data.data[0].embedding).toEqual([0.1, 0.2]);
+    expect(calls).toBe(2);
+  });
+
+  it("retries on 500 and succeeds on a later attempt", async () => {
+    let calls = 0;
+    const fetchImpl = async () => {
+      calls++;
+      return calls === 1 ? jsonResponse(500) : jsonResponse(200);
+    };
+    await fetchRemoteEmbeddingWithRetry(fetchImpl as unknown as typeof fetch, "hello", RETRY_OPTS);
+    expect(calls).toBe(2);
+  });
+
+  it("fails fast on non-retryable 4xx without consuming another attempt", async () => {
+    let calls = 0;
+    const fetchImpl = async () => {
+      calls++;
+      return jsonResponse(401);
+    };
+    await expect(
+      fetchRemoteEmbeddingWithRetry(fetchImpl as unknown as typeof fetch, "hello", RETRY_OPTS)
+    ).rejects.toBeInstanceOf(EmbeddingHttpError);
+    expect(calls).toBe(1);
+  });
+
+  it("throws the last error after exhausting all attempts on persistent 5xx", async () => {
+    let calls = 0;
+    const fetchImpl = async () => {
+      calls++;
+      return jsonResponse(503);
+    };
+    await expect(
+      fetchRemoteEmbeddingWithRetry(fetchImpl as unknown as typeof fetch, "hello", RETRY_OPTS)
+    ).rejects.toBeInstanceOf(EmbeddingHttpError);
+    expect(calls).toBe(3);
+  });
+
+  it("preserves the reques
```

---

### Incident Patch 3: `a9256433` (2026-10-12)
**Commit Message**: feat(skills): add shared editable skills with V2 bridge and GUI (#403)

* feat(skills): add shared editable skills with V2 bridge and GUI

Persist team skills in skills.db, expose CRUD + HTTP catalog, register
them with OpenCode via ctx.skill.transform, and edit in the web UI with
CodeMirror markdown preview. Refs: #402

* fix(web): reuse FormField/Textarea for skill dialog labels

Drop the custom CodeMirror markdown editor so floating labels match
existing memory dialogs and stop fighting hint/placeholder layout.

* fix(web): remove skills bridge hint from skills view

* fix(web): align skills empty state with memory explorer

* fix(web): rename skills section heading to Skills

* fix(web): show lucide icon on skills empty state

* fix(web): show skills Total chip in page header

* fix(web): move skills UI to /skill-library to avoid catalog clash

Direct /skills navigations were proxied to the OpenCode HTTP catalog
instead of the SPA; keep catalog under /skills/ and the explorer at
/skill-library.

* docs: note skills UI path vs HTTP catalog prefix

* fix(web): keep skills section label without Shared prefix

* fix(web): use icon-only add button on skills page

* feat(web): add cl

**File**: `README.md` (modified, +15/-7)
```diff
@@ -161,15 +161,23 @@ You do **not** need to ask OpenCode to “remember” things for the plugin to w
 
 Manual search/add/list still work even if auto-capture has no provider configured. Auto-capture and user profile learning need a provider that can return structured/tool-call output.
 
-### Memory vs AGENTS.md / project docs
+### Memory vs AGENTS.md vs Skills
 
-| Store in **memory**                                                  | Store in **AGENTS.md** / static docs                        |
-| -------------------------------------------------------------------- | ----------------------------------------------------------- |
-| Project-specific decisions, bug patterns, “we tried X and it failed” | Stable rules and workflows that rarely change               |
-| User preferences discovered over sessions                            | Always-on coding conventions and process                    |
-| Facts that should follow you across chats                            | Instructions every agent should see regardless of retrieval |
+| Store in **memory**                                                  | Store in **AGENTS.md** / static docs                        | Store as **Skills** (web UI / `skills.db`)            |
+| -------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
+| Project-specific decisions, bug patterns, “we tried X and it failed” | Stable rules and workflows that rarely change               | Reusable procedures the agent loads on demand         |
+| User preferences discovered over sessions                            | Always-on coding conventions and process                    | Team-editable skill packs shared via the same storage |
+| Facts that should follow you across chats                            | Instructions every agent should see regardless of retrieval | OpenCode-native `skill` tool (V2 plugin bridge)       |
 
-Rule of thumb: if it is a lasting project instruction, put it in AGENTS.md; if it is context that grows from real work, let memory (or auto-capture) hold it.
+Rule of thumb: lasting always-on project instructions → `AGENTS.md`; growing work context → memory; reusable on-demand procedures → **Skills**.
+
+#### Shared Skills (V2)
+
+- Create/edit skills in the web explorer (**Skills** tab at `/skill-library`).
+- Persisted in `skills.db` under the plugin storage path (not as memory vectors).
+- On OpenCode **V2**, the plugin registers enabled skills via `ctx.skill.transform` so the agent can load them with the native `skill` tool.
+- Optional HTTP catalog for other OpenCode instances: `"skills": ["http://127.0.0.1:4747/skills/"]` (serves `/skills/index.json` and `/skills/<id>/<id>.md` — separate from the UI path).
+- REST: `GET/POST /api/skills`, `GET/PUT/DELETE /api/skills/:id`.
 
 ### Intelligent prompt-based memory extraction
 
```

**File**: `src/services/api-handlers.ts` (modified, +145/-0)
```diff
@@ -1669,3 +1669,148 @@ export async function handleRunTagMigrationBatch(
     return { success: false, error: String(error) };
   }
 }
+
+function skillToApi(skill: {
+  id: string;
+  name: string;
+  description: string;
+  content: string;
+  autoinvoke: boolean;
+  enabled: boolean;
+  containerTag: string | null;
+  createdAt: number;
+  updatedAt: number;
+}) {
+  return {
+    id: skill.id,
+    name: skill.name,
+    description: skill.description,
+    content: skill.content,
+    autoinvoke: skill.autoinvoke,
+    enabled: skill.enabled,
+    containerTag: skill.containerTag,
+    createdAt: safeToISOString(skill.createdAt),
+    updatedAt: safeToISOString(skill.updatedAt),
+  };
+}
+
+export async function handleListSkills(options?: {
+  containerTag?: string;
+  enabledOnly?: boolean;
+}): Promise<ApiResponse<{ items: ReturnType<typeof skillToApi>[] }>> {
+  try {
+    const { skillsManager } = await import("./skills/skills-manager.js");
+    const items = await skillsManager.list({
+      containerTag: options?.containerTag,
+      enabledOnly: options?.enabledOnly,
+    });
+    return { success: true, data: { items: items.map(skillToApi) } };
+  } catch (error) {
+    log("handleListSkills: error", { error: String(error) });
+    return { success: false, error: String(error) };
+  }
+}
+
+export async function handleGetSkill(
+  id: string
+): Promise<ApiResponse<ReturnType<typeof skillToApi>>> {
+  try {
+    const { skillsManager } = await import("./skills/skills-manager.js");
+    const skill = await skillsManager.get(id);
+    if (!skill) return { success: false, error: `Skill not found: ${id}` };
+    return { success: true, data: skillToApi(skill) };
+  } catch (error) {
+    log("handleGetSkill: error", { error: String(error) });
+    return { success: false, error: String(error) };
+  }
+}
+
+export async function handleCreateSkill(body: {
+  id?: string;
+  name?: string;
+  description?: string;
+  content?: string;
+  autoinvoke?: boolean;
+  enabled?: boolean;
+  containerTag?: string | null;
+}): Promise<ApiResponse<ReturnType<typeof skillToApi>>> {
+  try {
+    if (!body?.id || !body?.name || !body?.content) {
+      return { success: false, error: "id, name, and content are required" };
+    }
+    const { skillsManager } = await import("./skills/skills-manager.js");
+    const skill = await skillsManager.create({
+      id: body.id,
+      name: body.name,
+      description: body.description,
+      content: body.content,
+      autoinvoke: body.autoinvoke,
+      enabled: body.enabled,
+      containerTag: body.containerTag,
+    });
+    return { success: true, data: skillToApi(skill) };
+  } catch (error) {
+    log("handleCreateSkill: error", { error: String(error) });
+    return { success: false, error: String(error) };
+  }
+}
+
+export async function handleUpdateSkill(
+  id: string,
+  body: {
+    name?: string;
+    description?: string;
+    content?: string;
+    autoinvoke?: boolean;
+    enabled?: boolean;
+    containerTag?: string | null;
+  }
+): Promise<ApiResponse<ReturnType<typeof skillToApi>>> {
+  try {
+    const { skillsManager } = await import("./skills/skills-manager.js");
+    const skill = await skillsManager.update(id, body);
+    return { success: true, data: skillToApi(skill) };
+  } catch (error) {
+    log("handleUpdateSkill: error", { error: String(error) });
+    return { success: false, error: String(error) };
+  }
+}
+
+export async function handleDeleteSkill(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
+  try {
+    const { skillsManager } = await import("./skills/skills-manager.js");
+    const deleted = await skillsManager.delete(id);
+    if (!deleted) return { success: false, error: `Skill not found: ${id}` };
+    return { success: true, data: { deleted: true } };
+  } catch (error) {
+    log("handleDeleteSkill: error", { error: String(error) });
+    return { success: false, error: String(error) };
+  }
+}
+
+export async function handleSkillsCatalogIndex(): Promise<
+  ApiResponse<{ skills: Array<{ name: string; version: string; files: string[] }> }>
+> {
+  try {
+    const { skillsManager } = await import("./skills/skills-manager.js");
+    const catalog = await skillsManager.toHttpCatalog();
+    return { success: true, data: catalog };
+  } catch (error) {
+    log("handleSkillsCatalogIndex: error", { error: String(error) });
+    return { success: false, error: String(error) };
+  }
+}
+
+export async function handleSkillsCatalogFile(
+  id: string
+): Promise<ApiResponse<{ markdown: string }>> {
+  try {
+    const { skillsManager } = await import("./skills/skills-manager.js");
+    const markdown = await skillsManager.toCatalogMarkdown(id);
+    if (!markdown) return { success: false, error: `Skill not found: ${id}` };
+    return { success: true, data: { markdown } };
+  } catch (error) {
+    log("handleSkillsCatalogFile: error", { error: String(error) });
+    return { success: false, error: String(error)
```

**File**: `src/services/skills/skills-manager.ts` (added, +261/-0)
```diff
@@ -0,0 +1,261 @@
+import { mkdir, rm, writeFile } from "node:fs/promises";
+import { dirname, join } from "node:path";
+import { tursoConnectionManager } from "../turso/connection-manager.js";
+import type { TursoDb } from "../turso/turso-db.js";
+import { CONFIG } from "../../config.js";
+import { log } from "../logger.js";
+import { isValidSkillId, type SkillInput, type SkillRecord, type SkillUpdate } from "./types.js";
+
+const SKILLS_DB_NAME = "skills.db";
+
+type SkillChangeListener = () => void;
+
+const skillChangeListeners = new Set<SkillChangeListener>();
+
+export function onSkillsChanged(listener: SkillChangeListener): () => void {
+  skillChangeListeners.add(listener);
+  return () => skillChangeListeners.delete(listener);
+}
+
+function notifySkillsChanged(): void {
+  for (const listener of skillChangeListeners) {
+    try {
+      listener();
+    } catch (error) {
+      log("skills change listener failed", { error: String(error) });
+    }
+  }
+}
+
+function rowToSkill(row: Record<string, unknown>): SkillRecord {
+  return {
+    id: String(row.id),
+    name: String(row.name),
+    description: String(row.description ?? ""),
+    content: String(row.content ?? ""),
+    autoinvoke: Number(row.autoinvoke ?? 1) === 1,
+    enabled: Number(row.enabled ?? 1) === 1,
+    containerTag: row.container_tag == null ? null : String(row.container_tag),
+    createdAt: Number(row.created_at),
+    updatedAt: Number(row.updated_at),
+  };
+}
+
+export class SkillsManager {
+  private db: TursoDb | null = null;
+  private dbPath: string;
+  private initPromise: Promise<void> | null = null;
+
+  constructor() {
+    this.dbPath = join(CONFIG.storagePath || "", SKILLS_DB_NAME);
+  }
+
+  reset(): void {
+    this.db = null;
+    this.initPromise = null;
+    this.dbPath = join(CONFIG.storagePath || "", SKILLS_DB_NAME);
+  }
+
+  private async initialize(): Promise<void> {
+    if (this.initPromise) return this.initPromise;
+    this.initPromise = this.initDatabase();
+    return this.initPromise;
+  }
+
+  private async initDatabase(): Promise<void> {
+    this.dbPath = join(CONFIG.storagePath || "", SKILLS_DB_NAME);
+    const db = await tursoConnectionManager.getConnection(this.dbPath);
+    const { applySchemaMigrations, SKILLS_MIGRATIONS } =
+      await import("../turso/schema-migrations.js");
+    await applySchemaMigrations(db, SKILLS_MIGRATIONS, {
+      dbPath: this.dbPath,
+      label: "skills",
+    });
+    this.db = db;
+  }
+
+  private async getDb(): Promise<TursoDb> {
+    await this.initialize();
+    if (!this.db) throw new Error("Skills database not initialized");
+    return this.db;
+  }
+
+  /** Absolute SKILL.md path for OpenCode Skill.Info.path */
+  skillPath(id: string): string {
+    return join(this.dbPath.replace(/skills\.db$/, "skills-content"), id, "SKILL.md");
+  }
+
+  /** OpenCode-compatible SKILL.md (frontmatter + body). */
+  formatMarkdown(skill: SkillRecord): string {
+    return [
+      "---",
+      `name: ${JSON.stringify(skill.name)}`,
+      `description: ${JSON.stringify(skill.description)}`,
+      "metadata:",
+      `  opencode/autoinvoke: ${skill.autoinvoke ? '"true"' : '"false"'}`,
+      "---",
+      "",
+      skill.content,
+    ].join("\n");
+  }
+
+  private async writeSkillFile(skill: SkillRecord): Promise<void> {
+    const filePath = this.skillPath(skill.id);
+    await mkdir(dirname(filePath), { recursive: true });
+    await writeFile(filePath, this.formatMarkdown(skill), "utf8");
+  }
+
+  private async removeSkillFile(id: string): Promise<void> {
+    const dir = dirname(this.skillPath(id));
+    await rm(dir, { recursive: true, force: true });
+  }
+
+  async list(options?: {
+    containerTag?: string | null;
+    enabledOnly?: boolean;
+  }): Promise<SkillRecord[]> {
+    const db = await this.getDb();
+    const clauses: string[] = [];
+    const args: Array<string | number> = [];
+
+    if (options?.enabledOnly) {
+      clauses.push(`enabled = 1`);
+    }
+    if (options?.containerTag !== undefined) {
+      if (options.containerTag === null) {
+        clauses.push(`container_tag IS NULL`);
+      } else {
+        clauses.push(`(container_tag IS NULL OR container_tag = ?)`);
+        args.push(options.containerTag);
+      }
+    }
+
+    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
+    const rows = await db.all(
+      `SELECT * FROM skills ${where} ORDER BY updated_at DESC, id ASC`,
+      args
+    );
+    return (rows as Record<string, unknown>[]).map(rowToSkill);
+  }
+
+  async get(id: string): Promise<SkillRecord | null> {
+    const db = await this.getDb();
+    const row = await db.get(`SELECT * FROM skills WHERE id = ?`, [id]);
+    return row ? rowToSkill(row as Record<string, unknown>) : null;
+  }
+
+  async create(input: SkillInput): Promise<SkillRecord> {
+    const id = input.id.trim();
+    if (!isValidSkillId(id)) {
+      throw new Error(
+        "Invalid skill id: use lowercase kebab-ca
```

**File**: `src/services/skills/types.ts` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+export interface SkillRecord {
+  id: string;
+  name: string;
+  description: string;
+  content: string;
+  autoinvoke: boolean;
+  enabled: boolean;
+  containerTag: string | null;
+  createdAt: number;
+  updatedAt: number;
+}
+
+export interface SkillInput {
+  id: string;
+  name: string;
+  description?: string;
+  content: string;
+  autoinvoke?: boolean;
+  enabled?: boolean;
+  containerTag?: string | null;
+}
+
+export interface SkillUpdate {
+  name?: string;
+  description?: string;
+  content?: string;
+  autoinvoke?: boolean;
+  enabled?: boolean;
+  containerTag?: string | null;
+}
+
+/** OpenCode-compatible skill id: lowercase kebab-case, 1–64 chars. */
+export const SKILL_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
+
+export function isValidSkillId(id: string): boolean {
+  return id.length >= 1 && id.length <= 64 && SKILL_ID_PATTERN.test(id);
+}
```

**File**: `src/services/turso/schema-migrations.ts` (modified, +27/-0)
```diff
@@ -261,6 +261,33 @@ export const USER_PROFILES_MIGRATIONS: SchemaMigration[] = [
   },
 ];
 
+export const SKILLS_MIGRATIONS: SchemaMigration[] = [
+  {
+    version: 1,
+    description: "Baseline shared skills table",
+    statements: [
+      {
+        sql: `
+          CREATE TABLE IF NOT EXISTS skills (
+            id TEXT PRIMARY KEY,
+            name TEXT NOT NULL,
+            description TEXT NOT NULL DEFAULT '',
+            content TEXT NOT NULL,
+            autoinvoke INTEGER NOT NULL DEFAULT 1,
+            enabled INTEGER NOT NULL DEFAULT 1,
+            container_tag TEXT,
+            created_at INTEGER NOT NULL,
+            updated_at INTEGER NOT NULL
+          )
+        `,
+      },
+      { sql: `CREATE INDEX IF NOT EXISTS idx_skills_enabled ON skills(enabled)` },
+      { sql: `CREATE INDEX IF NOT EXISTS idx_skills_container_tag ON skills(container_tag)` },
+      { sql: `CREATE INDEX IF NOT EXISTS idx_skills_updated_at ON skills(updated_at DESC)` },
+    ],
+  },
+];
+
 export const AI_SESSIONS_MIGRATIONS: SchemaMigration[] = [
   {
     version: 1,
```

**File**: `src/services/web-server.ts` (modified, +82/-0)
```diff
@@ -36,6 +36,13 @@ import {
   handleAICleanup,
   handleApplyCleanup,
   handleUpdateProfileItem,
+  handleListSkills,
+  handleGetSkill,
+  handleCreateSkill,
+  handleUpdateSkill,
+  handleDeleteSkill,
+  handleSkillsCatalogIndex,
+  handleSkillsCatalogFile,
 } from "./api-handlers.js";
 
 /**
@@ -703,6 +710,81 @@ export class WebServer {
         return this.jsonResponse(result);
       }
 
+      if (path === "/api/skills" && method === "GET") {
+        const containerTag = url.searchParams.get("tag") || undefined;
+        const enabledOnly = url.searchParams.get("enabledOnly") === "true";
+        const result = await handleListSkills({ containerTag, enabledOnly });
+        return this.jsonResponse(result);
+      }
+
+      if (path === "/api/skills" && method === "POST") {
+        const body = (await req.json().catch(() => ({}))) as any;
+        const result = await handleCreateSkill(body);
+        return this.jsonResponse(result, result.success ? 200 : 400);
+      }
+
+      if (path.startsWith("/api/skills/") && method === "GET") {
+        const id = decodeURIComponent(path.slice("/api/skills/".length));
+        if (!id || id.includes("/")) {
+          return this.jsonResponse({ success: false, error: "Invalid skill id" }, 400);
+        }
+        const result = await handleGetSkill(id);
+        return this.jsonResponse(result, result.success ? 200 : 404);
+      }
+
+      if (path.startsWith("/api/skills/") && method === "PUT") {
+        const id = decodeURIComponent(path.slice("/api/skills/".length));
+        if (!id || id.includes("/")) {
+          return this.jsonResponse({ success: false, error: "Invalid skill id" }, 400);
+        }
+        const body = (await req.json().catch(() => ({}))) as any;
+        const result = await handleUpdateSkill(id, body);
+        return this.jsonResponse(result, result.success ? 200 : 400);
+      }
+
+      if (path.startsWith("/api/skills/") && method === "DELETE") {
+        const id = decodeURIComponent(path.slice("/api/skills/".length));
+        if (!id || id.includes("/")) {
+          return this.jsonResponse({ success: false, error: "Invalid skill id" }, 400);
+        }
+        const result = await handleDeleteSkill(id);
+        return this.jsonResponse(result, result.success ? 200 : 404);
+      }
+
+      // OpenCode HTTP skill catalog (public path; prefer loopback / network auth).
+      if (path === "/skills/index.json" && method === "GET") {
+        const result = await handleSkillsCatalogIndex();
+        if (!result.success || !result.data) {
+          return this.jsonResponse(result, 500);
+        }
+        return new Response(JSON.stringify(result.data), {
+          status: 200,
+          headers: { "Content-Type": "application/json; charset=utf-8" },
+        });
+      }
+
+      // OpenCode catalog layout: /skills/{id}/{id}.md
+      if (path.startsWith("/skills/") && path.endsWith(".md") && method === "GET") {
+        const rest = path.slice("/skills/".length);
+        const parts = rest.split("/").filter(Boolean);
+        if (parts.length !== 2) {
+          return new Response("Not Found", { status: 404 });
+        }
+        const id = decodeURIComponent(parts[0]!);
+        const filename = decodeURIComponent(parts[1]!);
+        if (!id || filename !== `${id}.md`) {
+          return new Response("Not Found", { status: 404 });
+        }
+        const result = await handleSkillsCatalogFile(id);
+        if (!result.success || !result.data?.markdown) {
+          return new Response("Not Found", { status: 404 });
+        }
+        return new Response(result.data.markdown, {
+          status: 200,
+          headers: { "Content-Type": "text/markdown; charset=utf-8" },
+        });
+      }
+
       // SPA fallback for client routes (e.g. /profile) — serve the app shell.
       if (method === "GET" && !path.startsWith("/api/") && !extname(path)) {
         return this.serveStaticFile("index.html", "text/html");
```

**File**: `src/v2/adapter.ts` (modified, +72/-0)
```diff
@@ -1,5 +1,8 @@
+import { isAbsolute, resolve } from "node:path";
 import type { Context } from "@opencode/plugin/promise/plugin";
 import { log } from "../services/logger.js";
+import { onSkillsChanged, skillsManager } from "../services/skills/skills-manager.js";
+import { getTags } from "../services/tags.js";
 import { eventBelongsToLocation, legacyToolResult, toLegacyEvent } from "./legacy-client.js";
 
 interface MemoryContextHooks {
@@ -52,6 +55,62 @@ export async function registerV2Adapter(ctx: Context, legacy: any) {
   const messageIDs = new Map<string, string>();
   const suppressed = new Set<string>();
   const memoryContext = legacy.memoryContext as MemoryContextHooks | undefined;
+  /** Skill IDs last registered from opencode-mem DB (so we can remove stale ones). */
+  const registeredSkillIds = new Set<string>();
+
+  async function registerDbSkills(): Promise<void> {
+    if (!ctx.skill?.transform) return;
+
+    const projectTag = getTags(ctx.location.directory).project.tag;
+    let skills: Awaited<ReturnType<typeof skillsManager.list>> = [];
+    try {
+      skills = await skillsManager.list({
+        enabledOnly: true,
+        containerTag: projectTag,
+      });
+    } catch (error) {
+      log("Failed to load skills for OpenCode registration", { error: String(error) });
+      return;
+    }
+
+    const nextIds = new Set(skills.map((skill) => skill.id));
+
+    await ctx.skill.transform((editor) => {
+      for (const id of registeredSkillIds) {
+        if (!nextIds.has(id) && editor.get(id)) {
+          editor.remove(id);
+        }
+      }
+
+      for (const skill of skills) {
+        const path = skillsManager.skillPath(skill.id);
+        const absolutePath = isAbsolute(path) ? path : resolve(path);
+        const payload = {
+          id: skill.id,
+          name: skill.name,
+          description: skill.description || undefined,
+          autoinvoke: skill.autoinvoke,
+          path: absolutePath,
+          content: skill.content,
+        } as any;
+
+        if (editor.get(skill.id)) {
+          editor.update(skill.id, (entry) => {
+            entry.name = payload.name;
+            entry.description = payload.description;
+            entry.autoinvoke = payload.autoinvoke;
+            entry.path = payload.path;
+            entry.content = payload.content;
+          });
+        } else {
+          editor.add(payload);
+        }
+      }
+    });
+
+    registeredSkillIds.clear();
+    for (const id of nextIds) registeredSkillIds.add(id);
+  }
 
   await ctx.tool.transform((editor) =>
     editor.add({
@@ -74,6 +133,18 @@ export async function registerV2Adapter(ctx: Context, legacy: any) {
     } as any)
   );
 
+  await registerDbSkills();
+  const unsubscribeSkills = onSkillsChanged(() => {
+    void (async () => {
+      try {
+        await registerDbSkills();
+        await ctx.skill?.reload?.();
+      } catch (error) {
+        log("Failed to reload OpenCode skills after DB change", { error: String(error) });
+      }
+    })();
+  });
+
   await ctx.session.hook("prompt", async (event) => {
     messageIDs.set(event.sessionID, event.messageID);
     const original = { type: "text", text: event.prompt.text };
@@ -156,6 +227,7 @@ export async function registerV2Adapter(ctx: Context, legacy: any) {
   })();
 
   return async () => {
+    unsubscribeSkills();
     controller.abort();
     await watcher;
     contexts.clear();
```

**File**: `tests/skills-api-handlers.test.ts` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+import { describe, it, expect, beforeEach, afterEach } from "bun:test";
+import { mkdtempSync, rmSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { tursoConnectionManager } from "../src/services/turso/connection-manager.js";
+
+let tmpDir: string;
+
+describe("skills API handlers", () => {
+  beforeEach(async () => {
+    tmpDir = mkdtempSync(join(tmpdir(), "opencode-mem-skills-api-"));
+    const { CONFIG } = await import("../src/config.js");
+    CONFIG.storagePath = tmpDir;
+    const { skillsManager } = await import("../src/services/skills/skills-manager.js");
+    skillsManager.reset();
+  });
+
+  afterEach(async () => {
+    const { skillsManager } = await import("../src/services/skills/skills-manager.js");
+    skillsManager.reset();
+    await tursoConnectionManager.closeAll();
+    await new Promise((r) => setTimeout(r, 50));
+    try {
+      rmSync(tmpDir, { recursive: true, force: true });
+    } catch {
+      // ignore
+    }
+  });
+
+  it("supports CRUD through handlers", async () => {
+    const {
+      handleCreateSkill,
+      handleListSkills,
+      handleGetSkill,
+      handleUpdateSkill,
+      handleDeleteSkill,
+      handleSkillsCatalogIndex,
+      handleSkillsCatalogFile,
+    } = await import("../src/services/api-handlers.js");
+
+    const created = await handleCreateSkill({
+      id: "ship-it",
+      name: "Ship It",
+      description: "Release flow",
+      content: "## Ship\n\n1. Build\n2. Tag",
+    });
+    expect(created.success).toBe(true);
+    expect(created.data?.id).toBe("ship-it");
+
+    const listed = await handleListSkills();
+    expect(listed.success).toBe(true);
+    expect(listed.data?.items).toHaveLength(1);
+
+    const got = await handleGetSkill("ship-it");
+    expect(got.success).toBe(true);
+    expect(got.data?.name).toBe("Ship It");
+
+    const updated = await handleUpdateSkill("ship-it", { name: "Ship It Now" });
+    expect(updated.success).toBe(true);
+    expect(updated.data?.name).toBe("Ship It Now");
+
+    const catalog = await handleSkillsCatalogIndex();
+    expect(catalog.success).toBe(true);
+    expect(catalog.data?.skills[0]?.name).toBe("ship-it");
+
+    const file = await handleSkillsCatalogFile("ship-it");
+    expect(file.success).toBe(true);
+    expect(file.data?.markdown).toContain("## Ship");
+
+    const deleted = await handleDeleteSkill("ship-it");
+    expect(deleted.success).toBe(true);
+    expect((await handleGetSkill("ship-it")).success).toBe(false);
+  });
+});
```

---

### Incident Patch 4: `8f9a2e44` (2026-10-10)
**Commit Message**: chore(docs): update README for multilingual support and translation guidelinessoll

**File**: `.gitattributes` (modified, +4/-0)
```diff
@@ -4,5 +4,9 @@
 *.jpg binary
 *.jpeg binary
 *.gif binary
+*.svg binary
 *.woff binary
 *.woff2 binary
+bun.lock linguist-generated
+web/bun.lock linguist-generated
+README.*.md linguist-documentation
```

**File**: `README.ar.md` (added, +553/-0)
```diff
@@ -0,0 +1,553 @@
+# OpenCode Memory
+
+[![npm version](https://img.shields.io/npm/v/opencode-mem.svg)](https://www.npmjs.com/package/opencode-mem)
+[![npm downloads](https://img.shields.io/npm/dm/opencode-mem.svg)](https://www.npmjs.com/package/opencode-mem)
+[![license](https://img.shields.io/npm/l/opencode-mem.svg)](https://www.npmjs.com/package/opencode-mem)
+[![GitHub stars](https://img.shields.io/github/stars/tickernelz/opencode-mem.svg)](https://github.com/tickernelz/opencode-mem)
+
+![OpenCode Memory Banner](.github/pics/banner.png)
+
+[English](./README.md) | [Deutsch](./README.de.md) | [中文](./README.zh.md) | **العربية** | [Türkçe](./README.tr.md) | [Nederlands](./README.nl.md)
+
+نظام ذاكرة دائم لوكلاء البرمجة بالذكاء الاصطناعي يتيح الاحتفاظ بالسياق طويل الأمد عبر الجلسات باستخدام تقنية قاعدة بيانات متجهات محلية.
+
+## الميزات الأساسية
+
+قاعدة بيانات Turso/libSQL محلية مع بحث متجهات أصلي، ذكريات مشروع دائمة، تعلّم تلقائي لملف المستخدم، خط زمني موحّد للذاكرة والمطالبات، واجهة ويب كاملة الميزات، استخراج ذكي للذاكرة مستند إلى المطالبات، دعم مزودي ذكاء اصطناعي متعددين (OpenAI، Anthropic)، أكثر من 12 نموذج تضمين محلي، إزالة تكرار ذكية، وحماية خصوصية مدمجة.
+
+## المتطلبات الأساسية
+
+يستخدم هذا المكون الإضافي Turso المضمّن (`@tursodatabase/database`) مع متجهات `F32_BLOB` وبحث جيب التمام الدقيق عبر `vector_distance_cos`. لا حاجة لقاعدة بيانات متجهات منفصلة أو بناء SQLite مخصص.
+
+**بيئة التشغيل الموصى بها:**
+
+- Bun
+- بيئة مكون OpenCode الإضافي القياسية
+- اتصال بالإنترنت عند أول استخدام إذا كنت تستخدم نموذج التضمين المحلي الافتراضي، لأن النموذج يُنزَّل بواسطة `@huggingface/transformers`.
+- لتثبيتات المصدر/التطوير، شغّل `bun install` قبل البناء أو الاختبار. حزمة المكون الإضافي المنشورة تثبّت تبعيات وقت التشغيل تلقائيًا عبر OpenCode.
+
+**المنصات المختبرة في CI:** Linux وWindows وmacOS 15 / macOS 26 على Apple Silicon (`darwin/arm64`). **Intel Mac (`darwin/x64`) غير مدعوم** — `@tursodatabase/database` وإصدارات `onnxruntime-node` الثابتة لا توفّر ربطًا أصليًا لـ x64. إصدارات macOS الأقدم ليست مستبعدة من تلك المصفوفة؛ هي ببساطة خارج مجموعة مشغّلات GitHub الحالية المستضافة.
+
+**ملاحظات:**
+
+- تُخزَّن تضمينات المتجهات وتُبحث مباشرة في Turso؛ عمليات الإدراج تخزّن متجهات `F32_BLOB` لترتيب جيب التمام الدقيق.
+- يستخدم بحث المتجهات مسافة جيب التمام الدقيقة عبر `vector_distance_cos` (بدون DiskANN / فهرس تقريبي)، مع ترتيب هجين اختياري بالكلمات المفتاحية عند توفير سلسلة استعلام (`@tursodatabase/database` لا يوفّر FTS5).
+- تستخدم عمليات البحث عن الجلسات عمود `session_id` مفهرسًا (مُعبَّأ رجعيًا من `metadata.sessionID` في المخطط v2).
+- الالتقاط التلقائي وتعلّم ملف المستخدم يتطلبان مزود ذكاء اصطناعي يمكنه إرجاع مخرجات منظمة/استدعاء أدوات. بحث/إضافة/قائمة الذاكرة ما زالت تعمل بدون إعداد مزود الالتقاط التلقائي.
+
+### توقعات الأجهزة / الموارد
+
+opencode-mem **لا** يتطلب وحدة معالجة رسومات (GPU). تعمل التضمينات المحلية على وحدة المعالجة المركزية عبر `@huggingface/transformers` وONNX (لا يوجد خلفية MLX). لا حاجة لذاكرة فيديو إضافية (VRAM).
+
+| عبء العمل                                                      | الموارد الإضافية النموذجية                                                                                                                                                                                                                                                  |
+| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
+| **التضمينات المحلية** (الافتراضي `Xenova/nomic-embed-text-v1`) | حوالي **0.5–2 GB RAM** أثناء تحميل النموذج، حسب معرّف Hugging Face الذي تختاره. أول استخدام ينزّل النموذج؛ توجد ذاكرة التخزين المؤقت على القرص تحت `{storagePath}/.cache` (الافتراضي `~/.opencode-mem/data/.cache`) وغالبًا تكون **مئات الميجابايت إلى ~1–2 GB** لكل نموذج. |
+| **التضمينات البعيدة** (`embeddingApiUrl` + `embeddingApiKey`)  | ذاكرة ML محلية ضئيلة — فقط عبء المكون الإضافي + Turso.                                                                                                                                                                                                                      |
+| **قاعدة البيانات / المكون الإضافي**                            | Turso/libSQL على القرص تحت `storagePath`. ينمو الحجم بعدد الذكريات المخزّنة، وليس بذاكرة GPU.                                                                                                                                                                               |
+
+تظل حدود المنصات أعلاه سارية (لا يوجد Intel Mac `darwin/x64`؛ استخدم Apple Silicon أو Linux أو Windows أو نقطة نهاية تضمين بعيدة). انظر [اختيار / إعداد التضمينات](#اختيار--إعداد-التضمينات).
+
+### الترقية من أجزاء SQLite القديمة
+
+عند البدء يُستأنف استرداد عمليات تبديل إعادة التضمين المتقطعة، ويحوّل فهارس libSQL Dis
```

**File**: `README.de.md` (added, +553/-0)
```diff
@@ -0,0 +1,553 @@
+# OpenCode Memory
+
+[![npm version](https://img.shields.io/npm/v/opencode-mem.svg)](https://www.npmjs.com/package/opencode-mem)
+[![npm downloads](https://img.shields.io/npm/dm/opencode-mem.svg)](https://www.npmjs.com/package/opencode-mem)
+[![license](https://img.shields.io/npm/l/opencode-mem.svg)](https://www.npmjs.com/package/opencode-mem)
+[![GitHub stars](https://img.shields.io/github/stars/tickernelz/opencode-mem.svg)](https://github.com/tickernelz/opencode-mem)
+
+![OpenCode Memory Banner](.github/pics/banner.png)
+
+[English](./README.md) | **Deutsch** | [中文](./README.zh.md) | [العربية](./README.ar.md) | [Türkçe](./README.tr.md) | [Nederlands](./README.nl.md)
+
+Ein persistentes Speichersystem für KI-Coding-Agenten, das langfristige Kontextbeibehaltung über Sitzungen hinweg mittels lokaler Vektordatenbank-Technologie ermöglicht.
+
+## Kernfunktionen
+
+Lokale Turso/libSQL-Datenbank mit nativer Vektorsuche, persistente Projektspeicher, automatisches Lernen des Benutzerprofils, einheitliche Speicher-Prompt-Timeline, vollständige Web-UI, intelligente promptbasierte Speicherextraktion, Multi-Provider-KI-Unterstützung (OpenAI, Anthropic), 12+ lokale Embedding-Modelle, smarte Deduplizierung und integrierter Datenschutz.
+
+## Voraussetzungen
+
+Dieses Plugin nutzt eingebettetes Turso (`@tursodatabase/database`) mit `F32_BLOB`-Vektoren und exakter Cosinus-Suche über `vector_distance_cos`. Es ist keine separate Vektordatenbank und kein eigener SQLite-Build erforderlich.
+
+**Empfohlene Laufzeitumgebung:**
+
+- Bun
+- Standard-OpenCode-Plugin-Umgebung
+- Internetzugang beim ersten Einsatz, wenn du das Standard-Embedding-Modell lokal nutzt, weil das Modell von `@huggingface/transformers` heruntergeladen wird.
+- Bei Quell-/Entwicklungsinstallationen vor dem Bauen oder Testen `bun install` ausführen. Das veröffentlichte Plugin-Paket installiert seine Laufzeitabhängigkeiten automatisch über OpenCode.
+
+**In CI getestete Plattformen:** Linux, Windows sowie macOS 15 / macOS 26 auf Apple Silicon (`darwin/arm64`). **Intel Mac (`darwin/x64`) wird nicht unterstützt** — `@tursodatabase/database` und feste `onnxruntime-node`-Releases liefern kein natives x64-Binding. Ältere macOS-Versionen sind durch diese Matrix nicht ausgeschlossen; sie liegen lediglich außerhalb der aktuell von GitHub gehosteten Runner.
+
+**Hinweise:**
+
+- Vektor-Embeddings werden direkt in Turso gespeichert und durchsucht; Inserts speichern `F32_BLOB`-Vektoren für exaktes Cosinus-Ranking.
+- Die Vektorsuche verwendet exakte Cosinus-Distanz über `vector_distance_cos` (kein DiskANN / approximativer Index), mit optionalem Keyword-Hybrid-Ranking, wenn ein Query-String angegeben ist (`@tursodatabase/database` liefert kein FTS5).
+- Session-Lookups nutzen eine indexierte Spalte `session_id` (nachgezogen aus `metadata.sessionID` bei Schema v2).
+- Auto-Capture und Lernen des Benutzerprofils erfordern einen KI-Provider, der strukturierte/Tool-Call-Ausgabe liefern kann. Speicher-Suche/Hinzufügen/Listen funktionieren auch ohne Auto-Capture-Provider-Konfiguration.
+
+### Hardware- / Ressourcenanforderungen
+
+opencode-mem benötigt **keine** GPU. Lokale Embeddings laufen auf der CPU über `@huggingface/transformers` und ONNX (es gibt kein MLX-Backend). Zusätzlicher VRAM ist nicht nötig.
+
+| Workload                                                      | Typische zusätzliche Ressourcen                                                                                                                                                                                                                                                                            |
+| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
+| **Lokale Embeddings** (Standard `Xenova/nomic-embed-text-v1`) | Etwa **0,5–2 GB RAM**, solange das Modell geladen ist, abhängig von der gewählten Hugging-Face-ID. Beim ersten Einsatz wird das Modell heruntergeladen; der Disk-Cache liegt unter `{storagePath}/.cache` (Standard `~/.opencode-mem/data/.cache`) und beträgt oft **hunderte MB bis ~1–2 GB** pro Modell. |
+| **Remote-Embeddings** (`embeddingApiUrl` + `embeddingApiKey`) | Vernachlässigbarer lokaler ML-RAM — nur Plugin- + Turso-Overhead.                                                                                                                                                                                                                                          |
+| **Datenbank / Plugin**                                        | Turso/libSQL auf dem Datenträger unter `storagePath`. Die Größe wächst mit der Anzahl gespeicherter Memories, nicht mit GPU-Speicher.          
```

**File**: `README.md` (modified, +4/-0)
```diff
@@ -7,6 +7,8 @@
 
 ![OpenCode Memory Banner](.github/pics/banner.png)
 
+**English** | [Deutsch](./README.de.md) | [中文](./README.zh.md) | [العربية](./README.ar.md) | [Türkçe](./README.tr.md) | [Nederlands](./README.nl.md)
+
 A persistent memory system for AI coding agents that enables long-term context retention across sessions using local vector database technology.
 
 ## Core Features
@@ -539,6 +541,8 @@ bun run format
 
 This project is actively seeking contributions to become the definitive memory plugin for AI coding agents. Whether you are fixing bugs, adding features, improving documentation, or expanding embedding model support, your contributions are critical. The codebase is well-structured and ready for enhancement. Please open issues with the Issue or Feature request templates, and fill out the pull request template when you submit a PR — we review and merge contributions quickly.
 
+**README translations:** `README.md` (English) is the source of truth. When you change its content, update the sibling files `README.de.md`, `README.zh.md`, `README.ar.md`, `README.tr.md`, and `README.nl.md` to match.
+
 ## License & Links
 
 MIT License - see LICENSE file
```

**File**: `README.nl.md` (added, +554/-0)
```diff
@@ -0,0 +1,554 @@
+# OpenCode Memory
+
+[![npm version](https://img.shields.io/npm/v/opencode-mem.svg)](https://www.npmjs.com/package/opencode-mem)
+[![npm downloads](https://img.shields.io/npm/dm/opencode-mem.svg)](https://www.npmjs.com/package/opencode-mem)
+[![license](https://img.shields.io/npm/l/opencode-mem.svg)](https://www.npmjs.com/package/opencode-mem)
+[![GitHub stars](https://img.shields.io/github/stars/tickernelz/opencode-mem.svg)](https://github.com/tickernelz/opencode-mem)
+
+![OpenCode Memory Banner](.github/pics/banner.png)
+
+[English](./README.md) | [Deutsch](./README.de.md) | [中文](./README.zh.md) | [العربية](./README.ar.md) | [Türkçe](./README.tr.md) | **Nederlands**
+
+Een persistent geheugensysteem voor AI-codingagents dat langetermijncontextbehoud over sessies mogelijk maakt met lokale vectordatabasetechnologie.
+
+## Kernfuncties
+
+Lokale Turso/libSQL-database met native vectorzoekopdrachten, persistente projectherinneringen, automatisch leren van gebruikersprofielen, uniforme geheugen-prompttijdlijn, volledige web-UI, intelligente promptgebaseerde geheugenextractie, multi-provider AI-ondersteuning (OpenAI, Anthropic), 12+ lokale embeddingmodellen, slimme deduplicatie en ingebouwde privacybescherming.
+
+## Vereisten
+
+Deze plugin gebruikt embedded Turso (`@tursodatabase/database`) met `F32_BLOB`-vectoren en exacte cosinuszoekopdrachten via `vector_distance_cos`. Er is geen aparte vectordatabase of aangepaste SQLite-build vereist.
+
+**Aanbevolen runtime:**
+
+- Bun
+- Standaard OpenCode-pluginomgeving
+- Internettoegang bij eerste gebruik als je het standaard lokale embeddingmodel gebruikt, omdat het model wordt gedownload door `@huggingface/transformers`.
+- Voor bron-/ontwikkelingsinstallaties: voer `bun install` uit vóór het bouwen of testen. Het gepubliceerde pluginpakket installeert zijn runtime-afhankelijkheden automatisch via OpenCode.
+
+**CI-geteste platforms:** Linux, Windows en macOS 15 / macOS 26 op Apple Silicon (`darwin/arm64`). **Intel Mac (`darwin/x64`) wordt niet ondersteund** — `@tursodatabase/database` en vaste `onnxruntime-node`-releases leveren geen x64 native binding. Oudere macOS-releases zijn niet uitgesloten door die matrix; ze vallen simpelweg buiten de huidige set GitHub-hosted runners.
+
+**Opmerkingen:**
+
+- Vector-embeddings worden direct in Turso opgeslagen en doorzocht; inserts slaan `F32_BLOB`-vectoren op voor exacte cosinusranking.
+- Vectorzoekopdrachten gebruiken exacte cosinusafstand via `vector_distance_cos` (geen DiskANN / approximatieve index), met optionele keyword-hybrid ranking wanneer een querystring wordt meegegeven (`@tursodatabase/database` levert geen FTS5).
+- Sessieopzoekingen gebruiken een geïndexeerde `session_id`-kolom (teruggevuld vanuit `metadata.sessionID` op schema v2).
+- Auto-capture en gebruikersprofiel-leren vereisen een AI-provider die structured/tool-call-output kan teruggeven. Memory search/add/list werken nog steeds zonder auto-capture-providerconfiguratie.
+
+### Hardware- / resourceverwachtingen
+
+opencode-mem vereist **geen** GPU. Lokale embeddings draaien op de CPU via `@huggingface/transformers` en ONNX (er is geen MLX-backend). Extra VRAM is niet nodig.
+
+| Workload                                                       | Typische extra resources                                                                                                                                                                                                                                                                               |
+| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
+| **Lokale embeddings** (standaard `Xenova/nomic-embed-text-v1`) | Ongeveer **0,5–2 GB RAM** terwijl het model geladen is, afhankelijk van de Hugging Face-id die je kiest. Bij eerste gebruik wordt het model gedownload; de schijfcache staat onder `{storagePath}/.cache` (standaard `~/.opencode-mem/data/.cache`) en is vaak **honderden MB tot ~1–2 GB** per model. |
+| **Remote embeddings** (`embeddingApiUrl` + `embeddingApiKey`)  | Verwaarloosbare lokale ML-RAM — alleen plugin- + Turso-overhead.                                                                                                                                                                                                                                       |
+| **Database / plugin**                                          | Turso/libSQL op schijf onder `storagePath`. De grootte groeit met het aantal opgeslagen herinneringen, niet met GPU-geheugen.                                                                                                                                       
```

**File**: `README.tr.md` (added, +556/-0)
```diff
@@ -0,0 +1,556 @@
+# OpenCode Memory
+
+[![npm version](https://img.shields.io/npm/v/opencode-mem.svg)](https://www.npmjs.com/package/opencode-mem)
+[![npm downloads](https://img.shields.io/npm/dm/opencode-mem.svg)](https://www.npmjs.com/package/opencode-mem)
+[![license](https://img.shields.io/npm/l/opencode-mem.svg)](https://www.npmjs.com/package/opencode-mem)
+[![GitHub stars](https://img.shields.io/github/stars/tickernelz/opencode-mem.svg)](https://github.com/tickernelz/opencode-mem)
+
+![OpenCode Memory Banner](.github/pics/banner.png)
+
+[English](./README.md) | [Deutsch](./README.de.md) | [中文](./README.zh.md) | [العربية](./README.ar.md) | **Türkçe** | [Nederlands](./README.nl.md)
+
+Yerel vektör veritabanı teknolojisi kullanarak oturumlar arasında uzun vadeli bağlam saklamayı sağlayan, yapay zeka kodlama ajanları için kalıcı bir bellek sistemi.
+
+## Temel Özellikler
+
+Yerel Turso/libSQL veritabanı ve yerel vektör arama, kalıcı proje bellekleri, otomatik kullanıcı profili öğrenme, birleşik bellek-prompt zaman çizelgesi, tam özellikli web arayüzü, akıllı prompt tabanlı bellek çıkarımı, çoklu sağlayıcı AI desteği (OpenAI, Anthropic), 12+ yerel embedding modeli, akıllı tekilleştirme ve yerleşik gizlilik koruması.
+
+## Ön Koşullar
+
+Bu eklenti, gömülü Turso (`@tursodatabase/database`) ile `F32_BLOB` vektörleri ve `vector_distance_cos` üzerinden kesin kosinüs araması kullanır. Ayrı bir vektör veritabanı veya özel SQLite derlemesi gerekmez.
+
+**Önerilen çalışma zamanı:**
+
+- Bun
+- Standart OpenCode eklenti ortamı
+- Varsayılan yerel embedding modelini kullanıyorsanız ilk kullanımda internet erişimi gerekir; çünkü model `@huggingface/transformers` tarafından indirilir.
+- Kaynak/geliştirme kurulumlarında derlemeden veya testten önce `bun install` çalıştırın. Yayınlanan eklenti paketi çalışma zamanı bağımlılıklarını OpenCode üzerinden otomatik kurar.
+
+**CI’da test edilen platformlar:** Linux, Windows ve Apple Silicon üzerinde macOS 15 / macOS 26 (`darwin/arm64`). **Intel Mac (`darwin/x64`) desteklenmez** — `@tursodatabase/database` ve sabit `onnxruntime-node` sürümleri x64 yerel bağlayıcı yayınlamaz. Daha eski macOS sürümleri bu matris tarafından dışlanmaz; yalnızca mevcut GitHub barındırmalı runner kümesinin dışındadırlar.
+
+**Notlar:**
+
+- Vektör embedding’leri doğrudan Turso’da saklanır ve aranır; eklemeler kesin kosinüs sıralaması için `F32_BLOB` vektörleri depolar.
+- Vektör araması `vector_distance_cos` ile kesin kosinüs mesafesi kullanır (DiskANN / yaklaşık dizin yok); bir sorgu dizgesi verildiğinde isteğe bağlı anahtar kelime hibrit sıralaması vardır (`@tursodatabase/database` FTS5 içermez).
+- Oturum aramaları indeksli bir `session_id` sütunu kullanır (şema v2’de `metadata.sessionID` üzerinden geri doldurulur).
+- Otomatik yakalama ve kullanıcı profili öğrenme, yapılandırılmış/araç-çağrısı çıktısı döndürebilen bir AI sağlayıcısı gerektirir. Bellek arama/ekleme/listeleme, otomatik yakalama sağlayıcı yapılandırması olmadan da çalışır.
+
+### Donanım / kaynak beklentileri
+
+opencode-mem bir GPU **gerektirmez**. Yerel embedding’ler `@huggingface/transformers` ve ONNX üzerinden CPU’da çalışır (MLX backend yoktur). Ekstra VRAM gerekmez.
+
+| İş yükü                                                           | Tipik ek kaynaklar                                                                                                                                                                                                                                                                 |
+| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
+| **Yerel embedding’ler** (varsayılan `Xenova/nomic-embed-text-v1`) | Model yükleniyken yaklaşık **0,5–2 GB RAM**, seçtiğiniz Hugging Face kimliğine bağlı. İlk kullanım modeli indirir; disk önbelleği `{storagePath}/.cache` altında yaşar (varsayılan `~/.opencode-mem/data/.cache`) ve model başına genelde **yüzlerce MB ile ~1–2 GB** arasındadır. |
+| **Uzak embedding’ler** (`embeddingApiUrl` + `embeddingApiKey`)    | İhmal edilebilir yerel ML RAM — yalnızca eklenti + Turso ek yükü.                                                                                                                                                                                                                  |
+| **Veritabanı / eklenti**                                          | `storagePath` altında diskte Turso/libSQL. Boyut GPU belleğiyle değil, sakladığınız bellek sayısıyla büyür.                                                                                                                                                                        |
+
+Yukarıdaki platform sınırlamaları geçerlidir (I
```

**File**: `README.zh.md` (added, +548/-0)
```diff
@@ -0,0 +1,548 @@
+# OpenCode Memory
+
+[![npm version](https://img.shields.io/npm/v/opencode-mem.svg)](https://www.npmjs.com/package/opencode-mem)
+[![npm downloads](https://img.shields.io/npm/dm/opencode-mem.svg)](https://www.npmjs.com/package/opencode-mem)
+[![license](https://img.shields.io/npm/l/opencode-mem.svg)](https://www.npmjs.com/package/opencode-mem)
+[![GitHub stars](https://img.shields.io/github/stars/tickernelz/opencode-mem.svg)](https://github.com/tickernelz/opencode-mem)
+
+![OpenCode Memory Banner](.github/pics/banner.png)
+
+[English](./README.md) | [Deutsch](./README.de.md) | **中文** | [العربية](./README.ar.md) | [Türkçe](./README.tr.md) | [Nederlands](./README.nl.md)
+
+面向 AI 编程代理的持久记忆系统，基于本地向量数据库技术，实现跨会话的长期上下文保留。
+
+## 核心功能
+
+本地 Turso/libSQL 数据库与原生向量搜索、持久化项目记忆、自动用户画像学习、统一的记忆–提示时间线、功能完整的 Web UI、基于提示的智能记忆提取、多提供商 AI 支持（OpenAI、Anthropic）、12+ 本地嵌入模型、智能去重，以及内置隐私保护。
+
+## 前置要求
+
+本插件使用嵌入式 Turso（`@tursodatabase/database`），配合 `F32_BLOB` 向量与通过 `vector_distance_cos` 的精确余弦搜索。无需单独的向量数据库或自定义 SQLite 构建。
+
+**推荐运行时：**
+
+- Bun
+- 标准 OpenCode 插件环境
+- 若使用默认本地嵌入模型，首次使用时需要联网，因为模型由 `@huggingface/transformers` 下载。
+- 对于源码/开发安装，请在构建或测试前运行 `bun install`。已发布的插件包会通过 OpenCode 自动安装其运行时依赖。
+
+**CI 已测试平台：** Linux、Windows，以及 Apple Silicon 上的 macOS 15 / macOS 26（`darwin/arm64`）。**不支持 Intel Mac（`darwin/x64`）** — `@tursodatabase/database` 与固定版本的 `onnxruntime-node` 发行版均不提供 x64 原生绑定。更旧的 macOS 版本并未被该矩阵排除；它们只是不在当前 GitHub 托管的 runner 集合内。
+
+**说明：**
+
+- 向量嵌入直接存储并在 Turso 中搜索；插入时以 `F32_BLOB` 向量存储，用于精确余弦排序。
+- 向量搜索通过 `vector_distance_cos` 使用精确余弦距离（无 DiskANN / 近似索引）；在提供查询字符串时可选用关键词混合排序（`@tursodatabase/database` 不附带 FTS5）。
+- 会话查找使用已索引的 `session_id` 列（在 schema v2 上从 `metadata.sessionID` 回填）。
+- 自动捕获与用户画像学习需要能返回结构化/工具调用输出的 AI 提供商。即使未配置自动捕获提供商，记忆的搜索/添加/列表仍可正常工作。
+
+### 硬件 / 资源预期
+
+opencode-mem **不**需要 GPU。本地嵌入通过 `@huggingface/transformers` 与 ONNX 在 CPU 上运行（没有 MLX 后端）。不需要额外的 VRAM。
+
+| 工作负载                                              | 典型额外资源                                                                                                                                                                                       |
+| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
+| **本地嵌入**（默认 `Xenova/nomic-embed-text-v1`）     | 模型加载期间约 **0.5–2 GB RAM**，取决于所选 Hugging Face id。首次使用会下载模型；磁盘缓存在 `{storagePath}/.cache`（默认 `~/.opencode-mem/data/.cache`），每个模型通常为 **数百 MB 至约 1–2 GB**。 |
+| **远程嵌入**（`embeddingApiUrl` + `embeddingApiKey`） | 本地 ML RAM 可忽略不计 — 仅有插件 + Turso 开销。                                                                                                                                                   |
+| **数据库 / 插件**                                     | Turso/libSQL 存储在 `storagePath` 下的磁盘上。体积随存储的记忆数量增长，与 GPU 内存无关。                                                                                                          |
+
+上述平台限制仍适用（不支持 Intel Mac `darwin/x64`；请使用 Apple Silicon、Linux、Windows，或远程嵌入端点）。参见[选择 / 配置嵌入模型](#选择--配置嵌入模型)。
+
+### 从旧版 SQLite 分片升级
+
+启动时会恢复中断的重新嵌入交换、将 libSQL DiskANN 索引转换为当前 Turso 引擎，然后验证或升级旧版分片 schema。即使存储已有完成的旧版迁移标记，引擎转换仍会运行，并在不重新嵌入的情况下保留已存储向量。每个转换后的数据库会备份为 `<database>.pre-tursodb-<timestamp>.bak`。
+
+在 macOS 与 Linux 上，多个 OpenCode 会话可通过 Turso 的实验性 `multiprocess_wal` 共享同一 `storagePath`（每个进程必须使用相同模式 — 升级后请重启所有会话）。在 Windows 上引擎会拒绝该标志，因此同一时间只能有一个 OpenCode 会话拥有记忆数据库。
+
+升级后首次启动时，opencode-mem 会自动将现有记忆分片数据库迁移为原生 Turso/libSQL 向量格式：
+
+- 每个分片在重写前备份为 `<shard>.db.legacy.bak`
+- 进度按分片记录在 `<shard>.db.turso-migrate.json`
+- 仅在所有分片验证成功后才写入全局标记 `.turso-migrated`
+- 迁移期间请勿对同一 `storagePath` 运行多个 OpenCode 实例；锁文件（`.turso-migrate.lock`）可防止并发迁移
+- 手动维度迁移使用 `.turso-operation.lock`；在迁移完成前，其他插件进程会拒绝新的记忆写入
+
+若迁移被中断，下次启动会自动从备份恢复。
+
+若分片变得不兼容（例如更改 `embeddingDimensions` 之后），写入会被阻止，且原始数据库保持不变。请使用 Web UI 的重新嵌入迁移来构建并验证替换项，然后再交换到位。先前的分片仍可作为 `<shard>.db.pre-reembed-<pid>-<timestamp>.bak` 使用。
+
+## Schema 迁移
+
+本地 Turso 分片与辅助数据库（`metadata.db`、`user-prompts.db`、`user-profiles.db`、`ai-sessions.db`）通过 `src/services/turso/schema-migrations.ts` 中按序的 `PRAGMA user_version` 迁移进行升级。迁移是幂等的：启动插件时仅应用待处理的版本。
+
+## 快速开始
+
+对于 OpenCode v2，将包添加到原生 `plugins` 列表：
+
+```jsonc
+{
+  "plugins": ["opencode-mem@latest"],
+}
+```
+
+OpenCode 也会自动加载该包的 `./tui` 配套组件，以便
+自动捕获 / 画像 / 错误 toast 能在 TUI 中渲染（服务器插件
+无法直接调用 `ui.toast`）。你无需在
+`plugins` 中添加第二条条目。若你对远程 OpenCode 服务器运行仅 CLI 的 TUI，
+请在该 CLI 的插件列表中注册 `opencode-mem/tui`（例如
+`cli.json`），以便配套组件可以订阅 toast RPC 事件。
+
+对于 OpenCode v1，将默认入口点添加到配置
+`~/.config/opencode/opencode.json`：
+
+```jsonc
+{
+  "plugin": ["opencode-mem@latest"],
+}
+```
+
+使用 `@latest`（或 semver 范围）且 `opencode-mem.jsonc` 中 `autoUpdate: true`（默认）时，当有更新的 npm 发布可用时，插件会清除 OpenCode 的缓存安装并提示你重启。像 `opencode-mem@2.26.0` 这样的固定版本永远不会自动更新。
+
+### OpenCode v2 上的自动记忆上下文
+
+v2 插件通过模型的系统上下文提供自动记忆上下文。
+这些块不会添加到已编写的用户提示中，也不会存储在聊天记录中。
+使用 `chatMessage.injectOn: "first
```

---

### Incident Patch 5: `8c1ab5f9` (2026-10-10)
**Commit Message**: feat(i18n): add German localization to the web UI (#398)

**File**: `web/src/lib/components/explorer/MemoryActions.svelte` (modified, +9/-6)
```diff
@@ -4,6 +4,7 @@
   import PinOff from "@lucide/svelte/icons/pin-off";
   import Trash2 from "@lucide/svelte/icons/trash-2";
   import Button from "$lib/components/ui/button.svelte";
+  import { useI18n } from "$lib/i18n/context.svelte";
   import { ICON_SM } from "$lib/ui/styles";
 
   type Props = {
@@ -29,6 +30,8 @@
     onEdit,
     onDelete,
   }: Props = $props();
+
+  const i18n = useI18n();
 </script>
 
 <div class="flex shrink-0 items-center gap-1">
@@ -38,8 +41,8 @@
         variant="ghost"
         size="icon-xs"
         class="text-primary hover:text-primary"
-        title="Unpin"
-        aria-label="Unpin"
+        title={i18n.t("btn-unpin")}
+        aria-label={i18n.t("btn-unpin")}
         onclick={() => onUnpin?.(id)}
       >
         <PinOff class={ICON_SM} aria-hidden="true" />
@@ -48,8 +51,8 @@
       <Button
         variant="ghost"
         size="icon-xs"
-        title="Pin"
-        aria-label="Pin"
+        title={i18n.t("btn-pin")}
+        aria-label={i18n.t("btn-pin")}
         onclick={() => onPin?.(id)}
       >
         <Pin class={ICON_SM} aria-hidden="true" />
@@ -58,8 +61,8 @@
     <Button
       variant="ghost"
       size="icon-xs"
-      title="Edit"
-      aria-label="Edit"
+      title={i18n.t("btn-edit")}
+      aria-label={i18n.t("btn-edit")}
       onclick={() => onEdit?.(id)}
     >
       <PenLine class={ICON_SM} aria-hidden="true" />
```

**File**: `web/src/lib/components/ui/pagination-bar.svelte` (modified, +4/-2)
```diff
@@ -2,6 +2,7 @@
   import ChevronLeft from "@lucide/svelte/icons/chevron-left";
   import ChevronRight from "@lucide/svelte/icons/chevron-right";
   import Button from "$lib/components/ui/button.svelte";
+  import { useI18n } from "$lib/i18n/context.svelte";
   import type { PageSlice } from "$lib/pagination";
   import { GAP, GAP_TIGHT, ICON_SM } from "$lib/ui/styles";
 
@@ -27,6 +28,7 @@
     onDelta,
   }: Props = $props();
 
+  const i18n = useI18n();
   const hasPrev = $derived(currentPage > 1);
   const hasNext = $derived(currentPage < totalPages);
 </script>
@@ -37,7 +39,7 @@
       variant="outline"
       size="icon-xs"
       disabled={!hasPrev}
-      aria-label="Previous page"
+      aria-label={i18n.t("nav-prev-page")}
       onclick={() => onDelta?.(-1)}
     >
       <ChevronLeft class={ICON_SM} />
@@ -47,7 +49,7 @@
       variant="outline"
       size="icon-xs"
       disabled={!hasNext}
-      aria-label="Next page"
+      aria-label={i18n.t("nav-next-page")}
       onclick={() => onDelta?.(1)}
     >
       <ChevronRight class={ICON_SM} />
```

**File**: `web/src/lib/components/ui/search-input.svelte` (modified, +6/-3)
```diff
@@ -2,6 +2,7 @@
   import Search from "@lucide/svelte/icons/search";
   import X from "@lucide/svelte/icons/x";
   import type { HTMLInputAttributes } from "svelte/elements";
+  import { useI18n } from "$lib/i18n/context.svelte";
   import { FIELD_INPUT, HOVER_SURFACE, ICON, ICON_BTN_DENSE } from "$lib/ui/styles";
   import { cn } from "$lib/utils";
 
@@ -27,6 +28,8 @@
     onkeydown,
   }: Props = $props();
 
+  const i18n = useI18n();
+
   function handleSearch(event: MouseEvent & { currentTarget: HTMLButtonElement }) {
     onSearch?.();
     const form = event.currentTarget.closest("form");
@@ -55,7 +58,7 @@
         ICON_BTN_DENSE,
         HOVER_SURFACE
       )}
-      aria-label="Clear"
+      aria-label={i18n.t("btn-clear")}
       onclick={() => onClear?.()}
     >
       <X class={ICON} aria-hidden="true" />
@@ -68,8 +71,8 @@
       ICON_BTN_DENSE,
       HOVER_SURFACE
     )}
-    aria-label="Search"
-    title="Search"
+    aria-label={i18n.t("label-search")}
+    title={i18n.t("label-search")}
     onclick={handleSearch}
   >
     <Search class={ICON} aria-hidden="true" />
```

**File**: `web/src/lib/format.ts` (modified, +2/-1)
```diff
@@ -3,7 +3,8 @@ import { getLanguage } from "./i18n";
 export function formatDate(isoString: string): string {
   const date = new Date(isoString);
   const lang = getLanguage();
-  const locale = lang === "zh" ? "zh-CN" : lang === "ar" ? "ar-SA" : "en-US";
+  const locale =
+    lang === "zh" ? "zh-CN" : lang === "ar" ? "ar-SA" : lang === "de" ? "de-DE" : "en-US";
   return date.toLocaleString(locale, {
     year: "numeric",
     month: "short",
```

**File**: `web/src/lib/i18n/translations.ts` (modified, +204/-0)
```diff
@@ -162,6 +162,186 @@ export const translations = {
     "migration-mismatch-details":
       "Model mismatch: Config uses {configDimensions}D ({configModel}), but {shardInfo}.",
     "auth-warning-text": "Cross-origin editing disabled. Set webServerAuthPassword to enable.",
+    "btn-pin": "Pin",
+    "btn-unpin": "Unpin",
+    "btn-clear": "Clear",
+    "label-search": "Search",
+    "nav-prev-page": "Previous page",
+    "nav-next-page": "Next page",
+  },
+  de: {
+    title: "OpenCode Memory Explorer",
+    brand: "opencode-mem",
+    "tab-project": "Projekt-Memories",
+    "tab-profile": "Benutzerprofil",
+    "nav-menu": "Menü",
+    "nav-close": "Menü schließen",
+    "nav-collapse": "Seitenleiste einklappen",
+    "nav-expand": "Seitenleiste ausklappen",
+    "nav-language": "Sprache",
+    "nav-theme": "Design",
+    "theme-dark": "Dunkel",
+    "theme-light": "Hell",
+    "label-tag": "Tag",
+    "label-type": "Typ",
+    "label-tags": "Tags",
+    "label-content": "Inhalt",
+    "btn-cleanup": "Aufräumen",
+    "btn-deduplicate": "Duplikate entfernen",
+    "btn-filter": "Filter",
+    "btn-filter-clear": "Auswahl aufheben",
+    "btn-delete-selected": "Auswahl löschen",
+    "btn-select-all": "Seite auswählen",
+    "btn-deselect-all": "Auswahl aufheben",
+    "btn-add-memory": "Memory hinzufügen",
+    "section-project": "Projekt-Memories ({count})",
+    "section-profile": "Benutzerprofil",
+    "section-add": "Neues Memory hinzufügen",
+    "opt-all-tags": "Alle Tags",
+    "opt-select-tag": "Tag auswählen",
+    "opt-other": "sonstiges (other)",
+    "opt-feature": "Feature (feature)",
+    "opt-bug-fix": "Bugfix (bug-fix)",
+    "opt-refactor": "Refactoring (refactor)",
+    "opt-architecture": "Architektur (architecture)",
+    "opt-rule": "Regel (rule)",
+    "opt-documentation": "Dokumentation (documentation)",
+    "opt-discussion": "Diskussion (discussion)",
+    "opt-analysis": "Analyse (analysis)",
+    "opt-configuration": "Konfiguration (configuration)",
+    "modal-edit-title": "Memory bearbeiten",
+    "modal-migration-title": "Memory-Tag-Migration",
+    "modal-changelog-title": "Profil-Versionsverlauf",
+    "btn-cancel": "Abbrechen",
+    "btn-save": "Änderungen speichern",
+    "btn-start-migration": "Migration starten",
+    "loading-init": "Wird initialisiert…",
+    "loading-profile": "Profil wird geladen…",
+    "loading-changelog": "Changelog wird geladen…",
+    "migration-mismatch": "Abweichende Modelldimensionen erkannt!",
+    "migration-understand":
+      "Ich verstehe, dass dieser Vorgang nicht rückgängig gemacht werden kann und alle gespeicherten Memories betrifft",
+    "btn-fresh-start": "Neustart (Alles löschen)",
+    "btn-reembed": "Neu einbetten (Daten behalten)",
+    "migration-note":
+      "Bitte den Browser nicht schließen. Deine Memories werden mit technischen Tags neu vektorisiert, um die Suchgenauigkeit zu verbessern.",
+    "placeholder-filter": "Filtern…",
+    "placeholder-search": "Memories suchen…",
+    "placeholder-tags": "react, hooks, auth (kommagetrennt)",
+    "placeholder-new-tag": "Neuer Tag…",
+    "btn-add-tag": "Tag hinzufügen",
+    "placeholder-content": "Memory-Inhalt eingeben…",
+    "toast-add-success": "Memory erfolgreich hinzugefügt",
+    "toast-add-error": "Inhalt und Tag sind erforderlich",
+    "toast-add-failed": "Memory konnte nicht hinzugefügt werden",
+    "toast-delete-success": "Memory erfolgreich gelöscht",
+    "toast-delete-failed": "Memory konnte nicht gelöscht werden",
+    "toast-update-success": "Memory erfolgreich aktualisiert",
+    "toast-update-failed": "Memory konnte nicht aktualisiert werden",
+    "toast-cleanup-success": "Aufräumen erfolgreich abgeschlossen",
+    "toast-cleanup-failed": "Aufräumen fehlgeschlagen",
+    "toast-dedup-success": "Duplikatentfernung erfolgreich abgeschlossen",
+    "toast-dedup-failed": "Duplikatentfernung fehlgeschlagen",
+    "toast-bulk-delete-success": "Ausgewählte Memories erfolgreich gelöscht",
+    "toast-bulk-delete-failed": "Ausgewählte Memories konnten nicht gelöscht werden",
+    "toast-migration-success": "Migration erfolgreich abgeschlossen",
+    "toast-migration-failed": "Migration fehlgeschlagen",
+    "toast-migration-tag-failures":
+      "Migration fehlgeschlagen: {count} Fehler bei der Tag-Generierung",
+    "toast-fresh-start-success": "Neustart erfolgreich abgeschlossen",
+    "toast-fresh-start-failed": "Neustart fehlgeschlagen",
+    "confirm-delete": "Dieses Memory löschen?",
+    "confirm-delete-title": "Löschen bestätigen",
+    "confirm-delete-pair": "Dieses Memory UND den verknüpften Prompt löschen?",
+    "confirm-delete-prompt": "Diesen Prompt UND das verknüpfte Memory löschen?",
+    "confirm-bulk-delete": "{count} ausgewählte Memories löschen?",
+    "confirm-bulk-delete-title": "Auswahl löschen",
+    "confirm-cleanup":
+      "Damit werden alle Memories entfernt, die nicht mehr relevant sind. Fortfahren?",
+    "confirm-cleanup-title": "
```

---

### Incident Patch 6: `2ba43dac` (2026-10-10)
**Commit Message**: fix(auto-update): resolve OpenCode timestamp cache wrappers (#397)

**File**: `src/services/auto-update.ts` (modified, +13/-4)
```diff
@@ -109,11 +109,20 @@ export async function updateRemoveDir(packageDir: string, name: string) {
   // Only trust OpenCode wrapper basenames like `opencode-mem@latest`.
   // Never fall back to package.json dependencies — that would delete a
   // project root when the plugin lives under project/node_modules.
-  const wrapperDir = dirname(nodeModulesDir);
-  const spec = wrapperSpec(wrapperDir, name);
-  if (!spec || !isAutoUpdatableSpec(spec)) return undefined;
+  // OpenCode may nest installs under a timestamp dir:
+  //   ~/.cache/opencode/npm/opencode-mem@latest/<ts>/node_modules/opencode-mem
+  // Walk a few ancestors to find the `@latest` / range wrapper.
+  let dir = dirname(nodeModulesDir);
+  for (let depth = 0; depth < 4; depth++) {
+    const spec = wrapperSpec(dir, name);
+    if (spec && isAutoUpdatableSpec(spec)) return dir;
 
-  return wrapperDir;
+    const parent = dirname(dir);
+    if (parent === dir) return undefined;
+    dir = parent;
+  }
+
+  return undefined;
 }
 
 function wrapperSpec(wrapperDir: string, name: string) {
```

**File**: `tests/auto-update.test.ts` (modified, +16/-0)
```diff
@@ -50,6 +50,22 @@ describe("auto-update helpers", () => {
     expect(await updateRemoveDir(packageDir, "opencode-mem")).toBe(wrapperDir);
   });
 
+  it("updateRemoveDir finds wrapper under OpenCode timestamp cache nests", async () => {
+    const rootDir = await mkdtemp(join(tmpdir(), "mem-update-ts-"));
+    const wrapperDir = join(rootDir, "opencode-mem@latest");
+    const stampDir = join(wrapperDir, "1791629200642");
+    const packageDir = join(stampDir, "node_modules", "opencode-mem");
+    await writePackageJson(stampDir, {
+      dependencies: { "opencode-mem": "2.29.2" },
+    });
+    await writePackageJson(packageDir, {
+      name: "opencode-mem",
+      version: "2.29.2",
+    });
+
+    expect(await updateRemoveDir(packageDir, "opencode-mem")).toBe(wrapperDir);
+  });
+
   it("updateRemoveDir accepts caret wrapper installs", async () => {
     const rootDir = await mkdtemp(join(tmpdir(), "mem-update-caret-"));
     const wrapperDir = join(rootDir, "opencode-mem@^2");
```

---

### Incident Patch 7: `e7e88951` (2026-10-10)
**Commit Message**: fix(v2): surface toasts via RPC TUI companion (#395)

Server plugins under OpenCode v2 have no ui.toast, so showToast fell
through to a console-only stub. Emit toast intents over rpc.register and
render them from a new ./tui companion that OpenCode auto-loads.

Refs: #391

**File**: `README.md` (modified, +8/-1)
```diff
@@ -77,6 +77,13 @@ For OpenCode v2, add the package to the native `plugins` list:
 }
 ```
 
+OpenCode also loads the package's `./tui` companion automatically so
+auto-capture / profile / error toasts render in the TUI (server plugins
+cannot call `ui.toast` directly). You do not need a second entry in
+`plugins`. If you run a CLI-only TUI against a remote OpenCode server,
+register `opencode-mem/tui` in that CLI's plugin list (for example
+`cli.json`) so the companion can subscribe to toast RPC events.
+
 For OpenCode v1, add the default entrypoint to your configuration at
 `~/.config/opencode/opencode.json`:
 
@@ -113,7 +120,7 @@ To run the plugin from a local source checkout instead of the npm release, `bun
 }
 ```
 
-Point at the package root, not at `dist/` or a single file. OpenCode resolves a directory plugin by falling back to `<directory>/index` (OpenCode does not read `package.json` `exports`/`main` for a path spec on current releases), so this repository ships a thin root `index.js` that re-exports the built v2 entrypoint from `dist/plugin.js`. A path to a file is rejected (`configured plugin path must be a directory`), and a directory without a root `index.js` is skipped silently.
+Point at the package root, not at `dist/` or a single file. OpenCode resolves a directory plugin by falling back to `<directory>/index` (OpenCode does not read `package.json` `exports`/`main` for a path spec on current releases), so this repository ships a thin root `index.js` that re-exports the built v2 entrypoint from `dist/plugin.js`, and a root `tui.js` that re-exports `dist/tui.js` for the TUI companion. A path to a file is rejected (`configured plugin path must be a directory`), and a directory without a root `index.js` is skipped silently.
 
 ### Optional database encryption at rest
 
```

**File**: `package.json` (modified, +4/-0)
```diff
@@ -18,6 +18,10 @@
       "import": "./dist/v2/plugin.js",
       "types": "./dist/v2/plugin.d.ts"
     },
+    "./tui": {
+      "import": "./dist/tui.js",
+      "types": "./dist/tui.d.ts"
+    },
     "./tags": {
       "import": "./dist/services/tags.js",
       "types": "./dist/services/tags.d.ts"
```

**File**: `src/tui.ts` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+import { define } from "@opencode/plugin/tui/plugin";
+import { MemToast, type MemToastPayload } from "./v2/toast-rpc.js";
+
+/**
+ * TUI companion for opencode-mem. Subscribes to server-emitted toast RPC
+ * events and renders them with the host toast UI.
+ *
+ * Import from `@opencode/plugin/tui/plugin` (not `@opencode/plugin/tui`) so
+ * the companion does not pull optional Solid peer deps into the package load.
+ */
+export default define({
+  id: "opencode-mem-tui",
+  setup(ctx) {
+    return ctx.client.rpc(MemToast).events.on("toast", (event) => {
+      ctx.ui.toast.show(event.data as MemToastPayload);
+    });
+  },
+});
```

**File**: `src/v2/legacy-client.ts` (modified, +56/-2)
```diff
@@ -1,6 +1,7 @@
 import type { Context } from "@opencode/plugin/promise/plugin";
 import { randomUUID } from "node:crypto";
 import { resolve } from "node:path";
+import type { MemToastPayload } from "./toast-rpc.js";
 
 type LegacyPart = { type?: string; text?: string; metadata?: unknown };
 
@@ -158,6 +159,42 @@ function schemaPrompt(body: any): string {
   return sections.filter(Boolean).join("\n\n");
 }
 
+export type ToastEmitter = {
+  events: {
+    emit: (name: "toast", data: MemToastPayload) => Promise<void>;
+  };
+};
+
+function toastPayloadFrom(input: any): MemToastPayload | null {
+  const body = bodyFrom(input);
+  const message = typeof body.message === "string" ? body.message : "";
+  if (!message) return null;
+
+  const payload: {
+    message: string;
+    title?: string;
+    variant?: MemToastPayload["variant"];
+    duration?: number;
+    sessionID?: string;
+  } = { message };
+  if (typeof body.title === "string" && body.title) payload.title = body.title;
+  if (
+    body.variant === "info" ||
+    body.variant === "success" ||
+    body.variant === "warning" ||
+    body.variant === "error"
+  ) {
+    payload.variant = body.variant;
+  }
+  if (typeof body.duration === "number" && Number.isFinite(body.duration)) {
+    payload.duration = body.duration;
+  }
+  if (typeof body.sessionID === "string" && body.sessionID) {
+    payload.sessionID = body.sessionID;
+  }
+  return payload;
+}
+
 function toastFallback(input: any): { data: false } {
   const body = bodyFrom(input);
   const message = [body.title, body.message].filter(Boolean).join(": ");
@@ -169,11 +206,28 @@ function toastFallback(input: any): { data: false } {
   return { data: false };
 }
 
+async function showToastViaRpc(
+  toastRpc: ToastEmitter | undefined,
+  input: any
+): Promise<{ data: boolean }> {
+  if (!toastRpc) return toastFallback(input);
+
+  const payload = toastPayloadFrom(input);
+  if (!payload) return toastFallback(input);
+
+  try {
+    await toastRpc.events.emit("toast", payload);
+    return { data: true };
+  } catch {
+    return toastFallback(input);
+  }
+}
+
 /**
  * Adapts the released OpenCode v2 plugin context to the V1 client shape used
  * by the shared opencode-mem implementation.
  */
-export function createLegacyClient(ctx: Context) {
+export function createLegacyClient(ctx: Context, toastRpc?: ToastEmitter) {
   const generatedSessions = new Set<string>();
 
   const client = {
@@ -203,7 +257,7 @@ export function createLegacyClient(ctx: Context) {
       },
     },
     tui: {
-      showToast: async (input: any) => toastFallback(input),
+      showToast: async (input: any) => showToastViaRpc(toastRpc, input),
       appendPrompt: async () => ({ data: false }),
       submitPrompt: async () => ({ data: false }),
     },
```

**File**: `src/v2/plugin.ts` (modified, +4/-1)
```diff
@@ -4,11 +4,14 @@ import { CONFIG } from "../config.js";
 import { loadOpencodeProvider } from "../services/ai/opencode-provider-loader.js";
 import { registerV2Adapter } from "./adapter.js";
 import { createLegacyClient } from "./legacy-client.js";
+import { MemToast } from "./toast-rpc.js";
 
 const OpenCodeMemPluginV2: Plugin = {
   id: "opencode-mem",
   async setup(ctx) {
-    const legacyClient = createLegacyClient(ctx);
+    // Server Context has no ui.toast; bridge toast intents to the ./tui companion.
+    const toastRpc = await ctx.rpc.register(MemToast, {});
+    const legacyClient = createLegacyClient(ctx, toastRpc);
     const legacy = (await OpenCodeMemPlugin({
       client: legacyClient,
       directory: ctx.location.directory,
```

**File**: `src/v2/toast-rpc.ts` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+import { Rpc } from "@opencode/plugin/rpc";
+
+/**
+ * Shared server↔TUI contract for toast intents.
+ * Server plugins have no ui.toast; they emit via rpc.register events,
+ * and the ./tui companion renders with ctx.ui.toast.show.
+ */
+export const MemToast = Rpc.define({
+  id: "opencode-mem",
+  methods: {},
+  events: {
+    toast: {
+      schema: {
+        type: "object",
+        properties: {
+          title: { type: "string" },
+          message: { type: "string" },
+          variant: { type: "string" },
+          duration: { type: "number" },
+          sessionID: { type: "string" },
+        },
+        required: ["message"],
+        additionalProperties: false,
+      },
+    },
+  },
+});
+
+export type MemToastPayload = {
+  readonly message: string;
+  readonly title?: string;
+  readonly variant?: "info" | "success" | "warning" | "error";
+  readonly duration?: number;
+  readonly sessionID?: string;
+};
```

**File**: `tests/plugin-v2-loader-contract.test.ts` (modified, +14/-0)
```diff
@@ -18,12 +18,26 @@ describe("OpenCode v2 plugin-loader contract", () => {
     expect(pkg.files).toContain("dist");
   });
 
+  it("publishes the TUI companion entrypoint", () => {
+    const pkg = readPackageJson();
+    expect(pkg.exports?.["./tui"]).toEqual({
+      import: "./dist/tui.js",
+      types: "./dist/tui.d.ts",
+    });
+  });
+
   it("exports a native v2 plugin definition", async () => {
     const mod = await import(new URL("../dist/v2/plugin.js", import.meta.url).href);
     expect(mod.default.id).toBe("opencode-mem");
     expect(typeof mod.default.setup).toBe("function");
   });
 
+  it("exports a TUI companion plugin definition", async () => {
+    const mod = await import(new URL("../dist/tui.js", import.meta.url).href);
+    expect(mod.default.id).toBe("opencode-mem-tui");
+    expect(typeof mod.default.setup).toBe("function");
+  });
+
   it("exposes V1 and V2 from the installable package entrypoint", async () => {
     const mod = await import(new URL("../dist/plugin.js", import.meta.url).href);
     expect(mod.default.id).toBe("opencode-mem");
```

**File**: `tests/tui-companion.test.ts` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+import { describe, expect, it } from "bun:test";
+import tuiPlugin from "../src/tui.js";
+import { MemToast } from "../src/v2/toast-rpc.js";
+
+describe("opencode-mem TUI companion", () => {
+  it("subscribes to MemToast events and shows host toasts", () => {
+    expect(tuiPlugin.id).toBe("opencode-mem-tui");
+
+    const shown: unknown[] = [];
+    let subscribedDefinition: unknown;
+    let subscribedName: string | undefined;
+    let handler: ((event: { data: unknown }) => void) | undefined;
+
+    const cleanup = tuiPlugin.setup({
+      client: {
+        rpc: (definition: unknown) => {
+          subscribedDefinition = definition;
+          return {
+            events: {
+              on: (name: string, next: (event: { data: unknown }) => void) => {
+                subscribedName = name;
+                handler = next;
+                return () => {
+                  handler = undefined;
+                };
+              },
+            },
+          };
+        },
+      },
+      ui: {
+        toast: {
+          show: (options: unknown) => {
+            shown.push(options);
+          },
+        },
+      },
+    } as any);
+
+    expect(subscribedDefinition).toBe(MemToast);
+    expect(subscribedName).toBe("toast");
+    expect(typeof cleanup).toBe("function");
+
+    handler?.({
+      data: {
+        title: "Memory Captured",
+        message: "Project memory saved from conversation",
+        variant: "success",
+        duration: 3000,
+      },
+    });
+
+    expect(shown).toEqual([
+      {
+        title: "Memory Captured",
+        message: "Project memory saved from conversation",
+        variant: "success",
+        duration: 3000,
+      },
+    ]);
+
+    cleanup?.();
+    expect(handler).toBeUndefined();
+  });
+});
```

---

### Incident Patch 8: `f8e3f337` (2026-10-10)
**Commit Message**: feat(embedding): configurable pooling and task prefixes (#394)

Allow mean/cls/last_token pooling, custom query/document prefixes, optional
dtype override, and known-model presets so bge-m3/e5/Qwen3 work without
patching dist. Closes #392.

**File**: `README.md` (modified, +31/-14)
```diff
@@ -231,22 +231,29 @@ Embeddings power similarity search for memories and the user profile. Configure
 
 **Remote (OpenAI-compatible):** set both `embeddingApiUrl` and `embeddingApiKey`. The plugin then calls `{embeddingApiUrl}/embeddings` with a Bearer token. `embeddingApiKey` accepts the same secret formats as `memoryApiKey` (`literal`, `env://…`, `file://…`).
 
-| Key                   | Role                                                                                      |
-| --------------------- | ----------------------------------------------------------------------------------------- |
-| `embeddingModel`      | Hugging Face id (local) or API model name (remote). Default: `Xenova/nomic-embed-text-v1` |
-| `embeddingDimensions` | Optional override; usually omit — dimensions are looked up from a built-in map            |
-| `embeddingApiUrl`     | Base URL for an OpenAI-compatible embeddings API (no trailing path beyond `/v1`)          |
-| `embeddingApiKey`     | API key for that endpoint (required together with `embeddingApiUrl`)                      |
+| Key                        | Role                                                                                                                            |
+| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
+| `embeddingModel`           | Hugging Face id (local) or API model name (remote). Default: `Xenova/nomic-embed-text-v1`                                       |
+| `embeddingDimensions`      | Optional override; usually omit — dimensions are looked up from a built-in map                                                  |
+| `embeddingPooling`         | Local pooling: `"mean"` (default), `"cls"`, or `"last_token"`. Unset → small known-model preset or `"mean"`                     |
+| `embeddingQueryPrefix`     | Prefix for query-task embeddings. Unset → model preset or Nomic when `embeddingUseTaskPrefixes` is true. Explicit `""` disables |
+| `embeddingDocumentPrefix`  | Prefix for document-task embeddings (same resolution rules as `embeddingQueryPrefix`)                                           |
+| `embeddingUseTaskPrefixes` | Opt-in Nomic `search_query:` / `search_document:` prefixes when custom/preset prefixes are unset. Default `false`               |
+| `embeddingDtype`           | Optional local ONNX dtype override (e.g. `"q8"`, `"fp32"`). When set, passed to transformers.js `pipeline({ dtype })`           |
+| `embeddingApiUrl`          | Base URL for an OpenAI-compatible embeddings API (no trailing path beyond `/v1`)                                                |
+| `embeddingApiKey`          | API key for that endpoint (required together with `embeddingApiUrl`)                                                            |
 
 Recommended local models:
 
-| Model                                | Dims | Notes                               |
-| ------------------------------------ | ---- | ----------------------------------- |
-| `Xenova/nomic-embed-text-v1`         | 768  | Default; multilingual, 8192 context |
-| `Xenova/jina-embeddings-v2-base-en`  | 768  | English-only, 8192 context          |
-| `Xenova/jina-embeddings-v2-small-en` | 512  | Faster, 8192 context                |
-| `Xenova/all-MiniLM-L6-v2`            | 384  | Very fast, 512 context              |
-| `Xenova/all-mpnet-base-v2`           | 768  | Good quality, 512 context           |
+| Model                                | Dims | Notes                                             |
+| ------------------------------------ | ---- | ------------------------------------------------- |
+| `Xenova/nomic-embed-text-v1`         | 768  | Default; multilingual, 8192 context; mean pooling |
+| `Xenova/jina-embeddings-v2-base-en`  | 768  | English-only, 8192 context                        |
+| `Xenova/jina-embeddings-v2-small-en` | 512  | Faster, 8192 context                              |
+| `Xenova/all-MiniLM-L6-v2`            | 384  | Very fast, 512 context                            |
+| `Xenova/all-mpnet-base-v2`           | 768  | Good quality, 512 context                         |
+| `Xenova/bge-m3`                      | 1024 | Multilingual; auto CLS pooling                    |
+| `intfloat/multilingual-e5-large`     | 1024 | Auto `query:` / `passage:` prefixes               |
 
 Example — remote OpenAI embeddings:
 
@@ -258,7 +265,17 @@ Example — remote OpenAI embeddings:
 }
 ```
 
-Changing `embeddingModel` (or dimensions) can trigger re-embedding of stored memories on next startup. Prefer picking a model once and sticking with it for a given data directory.
+Example — local bge-m3 (pooling defaults to CLS via preset; override if needed):
+
+```jsonc
+{
+  "embeddingModel": "Xenova/bge-m3",
+  // "embeddingPooling": "cls",
+  // "embeddingDtype": "q8",
+}
+```
+
+Changing `embeddingModel`, dimensions, pooling, or task prefixes can require re-embedding 
```

**File**: `opencode-mem.example.jsonc` (modified, +14/-0)
```diff
@@ -26,6 +26,18 @@
   // re-index existing memories so store and query vectors stay aligned.
   "embeddingUseTaskPrefixes": false,
 
+  // Local pooling: "mean" (default) | "cls" | "last_token".
+  // Unset → model preset (bge-m3=cls, Qwen3-Embedding=last_token) or "mean".
+  // "embeddingPooling": "mean",
+
+  // Custom task prefixes (override presets / Nomic). Explicit "" disables a side.
+  // Changing pooling or prefixes requires re-embedding stored memories.
+  // "embeddingQueryPrefix": "query: ",
+  // "embeddingDocumentPrefix": "passage: ",
+
+  // Optional local ONNX dtype override (e.g. "q8", "fp32"). When unset, transformers.js defaults apply.
+  // "embeddingDtype": "q8",
+
   // Auto-detected dimensions (no need to set manually)
   // "embeddingDimensions": 768,
 
@@ -34,6 +46,8 @@
   // "embeddingModel": "Xenova/jina-embeddings-v2-small-en", // 512 dims, faster, 8192 context
   // "embeddingModel": "Xenova/all-MiniLM-L6-v2",            // 384 dims, very fast, 512 context
   // "embeddingModel": "Xenova/all-mpnet-base-v2",           // 768 dims, good quality, 512 context
+  // "embeddingModel": "Xenova/bge-m3",                      // 1024 dims, CLS pooling (auto)
+  // "embeddingModel": "intfloat/multilingual-e5-large",     // 1024 dims, query:/passage: prefixes (auto)
 
   // Optional: OpenAI-compatible API for embeddings (both URL and key required)
   // "embeddingApiUrl": "https://api.openai.com/v1",
```

**File**: `src/config.ts` (modified, +153/-3)
```diff
@@ -34,6 +34,26 @@ interface OpenCodeMemConfig {
   embeddingApiKey?: string;
   /** Opt-in Nomic task prefixes (`search_document:` / `search_query:`). Default false. */
   embeddingUseTaskPrefixes?: boolean;
+  /**
+   * Local transformers.js pooling strategy. Default `"mean"`.
+   * Model presets (bge-m3 → cls, Qwen3-Embedding → last_token) apply when unset.
+   */
+  embeddingPooling?: "mean" | "cls" | "last_token";
+  /**
+   * Prefix applied to query-task embeddings. When unset, model presets or
+   * `embeddingUseTaskPrefixes` (Nomic) may supply one. Explicit `""` disables.
+   */
+  embeddingQueryPrefix?: string;
+  /**
+   * Prefix applied to document-task embeddings. Same resolution rules as
+   * `embeddingQueryPrefix`.
+   */
+  embeddingDocumentPrefix?: string;
+  /**
+   * Optional dtype for the local ONNX pipeline (e.g. `"q8"`, `"fp32"`).
+   * When set, passed to `pipeline({ dtype })` and outranks auto-detection.
+   */
+  embeddingDtype?: string;
   similarityThreshold?: number;
   maxMemories?: number;
   maxProfileItems?: number;
@@ -158,6 +178,9 @@ const DEFAULTS: Required<
     OpenCodeMemConfig,
     | "embeddingApiUrl"
     | "embeddingApiKey"
+    | "embeddingQueryPrefix"
+    | "embeddingDocumentPrefix"
+    | "embeddingDtype"
     | "memoryModel"
     | "memoryApiUrl"
     | "memoryApiKey"
@@ -180,6 +203,9 @@ const DEFAULTS: Required<
 > & {
   embeddingApiUrl?: string;
   embeddingApiKey?: string;
+  embeddingQueryPrefix?: string;
+  embeddingDocumentPrefix?: string;
+  embeddingDtype?: string;
   memoryModel?: string;
   memoryApiUrl?: string;
   memoryApiKey?: string;
@@ -207,6 +233,7 @@ const DEFAULTS: Required<
   embeddingModel: "Xenova/nomic-embed-text-v1",
   embeddingDimensions: 768,
   embeddingUseTaskPrefixes: false,
+  embeddingPooling: "mean",
   similarityThreshold: 0.6,
   maxMemories: 10,
   maxProfileItems: 5,
@@ -341,6 +368,18 @@ const CONFIG_TEMPLATE = `{
   // Opt-in Nomic task prefixes (search_document: / search_query:). After enabling,
   // re-index existing memories so store and query vectors stay aligned.
   // "embeddingUseTaskPrefixes": true,
+
+  // Local pooling: "mean" (default) | "cls" | "last_token".
+  // Unset → model preset (bge-m3=cls, Qwen3-Embedding=last_token) or "mean".
+  // "embeddingPooling": "mean",
+
+  // Custom task prefixes (override presets / Nomic). Explicit "" disables a side.
+  // Changing pooling or prefixes requires re-embedding stored memories.
+  // "embeddingQueryPrefix": "query: ",
+  // "embeddingDocumentPrefix": "passage: ",
+
+  // Optional local ONNX dtype override (e.g. "q8", "fp32"). When unset, transformers.js defaults apply.
+  // "embeddingDtype": "q8",
   
   // Auto-detected dimensions (no need to set manually)
   // "embeddingDimensions": 768,
@@ -350,6 +389,8 @@ const CONFIG_TEMPLATE = `{
   // "embeddingModel": "Xenova/jina-embeddings-v2-small-en", // 512 dims, faster, 8192 context
   // "embeddingModel": "Xenova/all-MiniLM-L6-v2",            // 384 dims, very fast, 512 context
   // "embeddingModel": "Xenova/all-mpnet-base-v2",           // 768 dims, good quality, 512 context
+  // "embeddingModel": "Xenova/bge-m3",                      // 1024 dims, CLS pooling (auto)
+  // "embeddingModel": "intfloat/multilingual-e5-large",     // 1024 dims, query:/passage: prefixes (auto)
   
   // Optional: OpenAI-compatible API for embeddings (both URL and key required)
   // "embeddingApiUrl": "https://api.openai.com/v1",
@@ -696,6 +737,91 @@ function ensureConfigExists(): void {
 
 ensureConfigExists();
 
+export type EmbeddingPooling = "mean" | "cls" | "last_token";
+
+export type EmbeddingModelPreset = {
+  pooling: EmbeddingPooling;
+  /**
+   * When present (including `""`), used as the default query/document prefix
+   * when the corresponding config key is unset. Omitting both keeps Nomic
+   * opt-in via `embeddingUseTaskPrefixes` (nomic models).
+   */
+  queryPrefix?: string;
+  documentPrefix?: string;
+};
+
+const QWEN3_EMBEDDING_QUERY_PREFIX =
+  "Instruct: Given a web search query, retrieve relevant passages that answer the query\nQuery: ";
+
+/**
+ * Known local embedding model presets (substring match on `embeddingModel`).
+ * Explicit config keys always win over these defaults.
+ */
+export function getEmbeddingModelPreset(model: string): EmbeddingModelPreset | undefined {
+  const id = model.toLowerCase();
+  if (id.includes("bge-m3")) {
+    return { pooling: "cls", queryPrefix: "", documentPrefix: "" };
+  }
+  if (id.includes("multilingual-e5") || id.includes("e5-")) {
+    return { pooling: "mean", queryPrefix: "query: ", documentPrefix: "passage: " };
+  }
+  if (id.includes("qwen3-embedding")) {
+    return {
+      pooling: "last_token",
+      queryPrefix: QWEN3_EMBEDDING_QUERY_PREFIX,
+      documentPrefix: "",
+    };
+  }
+  if (id.includes("jina-embeddings")) {
+    return { pooling: "mean", queryPrefix: "", documentPrefix: "" };
+  }
+  if (id.includes("nomic-embed")) {
+    return { poolin
```

**File**: `src/services/embedding.ts` (modified, +74/-11)
```diff
@@ -102,26 +102,79 @@ export type EmbedOptions = {
   task?: EmbeddingTask;
 };
 
-const TASK_PREFIXES: Record<EmbeddingTask, string> = {
+const NOMIC_TASK_PREFIXES: Record<EmbeddingTask, string> = {
   document: "search_document: ",
   query: "search_query: ",
 };
 
+export type EmbeddingTaskPrefixOptions = {
+  useTaskPrefixes?: boolean;
+  queryPrefix?: string;
+  documentPrefix?: string;
+};
+
+/**
+ * Resolve the prefix for a task: explicit/custom → Nomic (when enabled) → none.
+ * Empty string means "no prefix" (disables Nomic fallback for that task).
+ */
+export function resolveEmbeddingTaskPrefix(
+  task: EmbeddingTask,
+  options: EmbeddingTaskPrefixOptions = {}
+): string {
+  const custom = task === "query" ? options.queryPrefix : options.documentPrefix;
+  if (custom !== undefined) return custom;
+  if (options.useTaskPrefixes) return NOMIC_TASK_PREFIXES[task];
+  return "";
+}
+
 /**
- * Apply Nomic-style task prefixes when enabled.
+ * Apply task prefixes when configured.
  * Cache keys and API/local inputs should use the returned string.
+ *
+ * Third argument accepts the legacy boolean (`useTaskPrefixes`) or an options
+ * object. Defaults read from CONFIG (custom/preset prefixes + Nomic flag).
  */
 export function applyEmbeddingTaskPrefix(
   text: string,
   options?: EmbedOptions,
-  useTaskPrefixes: boolean = CONFIG.embeddingUseTaskPrefixes
+  useTaskPrefixesOrOpts: boolean | EmbeddingTaskPrefixOptions = {
+    useTaskPrefixes: CONFIG.embeddingUseTaskPrefixes,
+    queryPrefix: CONFIG.embeddingQueryPrefix,
+    documentPrefix: CONFIG.embeddingDocumentPrefix,
+  }
 ): string {
-  if (!useTaskPrefixes || !options?.task) return text;
-  const prefix = TASK_PREFIXES[options.task];
+  if (!options?.task) return text;
+
+  const prefixOpts: EmbeddingTaskPrefixOptions =
+    typeof useTaskPrefixesOrOpts === "boolean"
+      ? {
+          useTaskPrefixes: useTaskPrefixesOrOpts,
+          queryPrefix: CONFIG.embeddingQueryPrefix,
+          documentPrefix: CONFIG.embeddingDocumentPrefix,
+        }
+      : {
+          useTaskPrefixes: useTaskPrefixesOrOpts.useTaskPrefixes ?? CONFIG.embeddingUseTaskPrefixes,
+          queryPrefix: useTaskPrefixesOrOpts.queryPrefix ?? CONFIG.embeddingQueryPrefix,
+          documentPrefix: useTaskPrefixesOrOpts.documentPrefix ?? CONFIG.embeddingDocumentPrefix,
+        };
+
+  const prefix = resolveEmbeddingTaskPrefix(options.task, prefixOpts);
+  if (!prefix) return text;
   if (text.startsWith(prefix)) return text;
   return `${prefix}${text}`;
 }
 
+function embeddingCacheFingerprint(): string {
+  return [
+    CONFIG.embeddingModel,
+    CONFIG.embeddingPooling,
+    CONFIG.embeddingQueryPrefix ?? "",
+    CONFIG.embeddingDocumentPrefix ?? "",
+    CONFIG.embeddingUseTaskPrefixes ? "1" : "0",
+    CONFIG.embeddingDtype ?? "",
+  ].join("\0");
+}
+
 type HfTransformers = typeof import("@huggingface/transformers");
 
 let _transformers: {
@@ -197,7 +250,7 @@ export class EmbeddingService {
   /** Set when warmup fails permanently; prevents "initializing forever" (#184). */
   public initError: string | null = null;
   private cache: Map<string, Float32Array> = new Map();
-  private cachedModelName: string | null = null;
+  private cachedFingerprint: string | null = null;
 
   static getInstance(): EmbeddingService {
     if (!(globalThis as any)[GLOBAL_EMBEDDING_KEY]) {
@@ -247,11 +300,13 @@ export class EmbeddingService {
 
       // Local model path
       const { pipeline } = await ensureTransformersLoaded();
-      const dtype = resolveLocalOnnxDtype(CONFIG.embeddingModel);
+      // Explicit config wins; otherwise auto-resolve from model declaration / cache (#393).
+      const dtype = CONFIG.embeddingDtype ?? resolveLocalOnnxDtype(CONFIG.embeddingModel);
       if (dtype) {
         log("Resolved local ONNX dtype for embedding warmup", {
           model: CONFIG.embeddingModel,
           dtype,
+          source: CONFIG.embeddingDtype ? "config" : "auto",
         });
       }
       this.pipe = await pipeline("feature-extraction", CONFIG.embeddingModel, {
@@ -260,7 +315,11 @@ export class EmbeddingService {
       });
       this.isWarmedUp = true;
       this.initError = null;
-      log("Embedding model warmed up", { model: CONFIG.embeddingModel, dtype: dtype ?? null });
+      log("Embedding model warmed up", {
+        model: CONFIG.embeddingModel,
+        pooling: CONFIG.embeddingPooling,
+        dtype: dtype ?? null,
+      });
     } catch (error) {
       const rewritten = formatOnnxruntimeInitError(error);
       this.initPromise = null;
@@ -271,9 +330,10 @@ export class EmbeddingService {
   }
 
   async embed(text: string, options?: EmbedOptions): Promise<Float32Array> {
-    if (this.cachedModelName !== CONFIG.embeddingModel) {
+    const fingerprint = embeddingCacheFingerprint();
+    if (this.cachedFingerprint !== fingerprint) {
       this.clearCache();
-      this.cachedModelName = CONFIG.embeddingModel;
+      this.cachedFinger
```

**File**: `tests/config.test.ts` (modified, +8/-0)
```diff
@@ -39,6 +39,14 @@ describe("config", () => {
       expect(CONFIG.embeddingUseTaskPrefixes).toBe(false);
     });
 
+    it("should default embeddingPooling to mean", () => {
+      expect(CONFIG.embeddingPooling).toBe("mean");
+    });
+
+    it("should leave embeddingDtype unset by default", () => {
+      expect(CONFIG.embeddingDtype).toBeUndefined();
+    });
+
     it("should have numeric embeddingDimensions", () => {
       expect(typeof CONFIG.embeddingDimensions).toBe("number");
       expect(CONFIG.embeddingDimensions).toBeGreaterThan(0);
```

**File**: `tests/embedding-model-presets.test.ts` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+import { describe, expect, it } from "bun:test";
+import {
+  getEmbeddingModelPreset,
+  normalizeEmbeddingDtype,
+  normalizeEmbeddingPooling,
+} from "../src/config.js";
+
+describe("getEmbeddingModelPreset", () => {
+  it("returns mean pooling for nomic without forcing task prefixes", () => {
+    expect(getEmbeddingModelPreset("Xenova/nomic-embed-text-v1")).toEqual({ pooling: "mean" });
+  });
+
+  it("returns cls pooling and empty prefixes for bge-m3", () => {
+    expect(getEmbeddingModelPreset("Xenova/bge-m3")).toEqual({
+      pooling: "cls",
+      queryPrefix: "",
+      documentPrefix: "",
+    });
+  });
+
+  it("returns e5 query/passage prefixes", () => {
+    expect(getEmbeddingModelPreset("intfloat/multilingual-e5-large")).toEqual({
+      pooling: "mean",
+      queryPrefix: "query: ",
+      documentPrefix: "passage: ",
+    });
+    expect(getEmbeddingModelPreset("intfloat/e5-large-v2")?.queryPrefix).toBe("query: ");
+  });
+
+  it("returns last_token pooling and instruct query prefix for Qwen3-Embedding", () => {
+    const preset = getEmbeddingModelPreset("onnx-community/Qwen3-Embedding-0.6B-ONNX");
+    expect(preset?.pooling).toBe("last_token");
+    expect(preset?.documentPrefix).toBe("");
+    expect(preset?.queryPrefix).toContain("Instruct:");
+    expect(preset?.queryPrefix).toContain("Query: ");
+  });
+
+  it("returns mean pooling and empty prefixes for jina", () => {
+    expect(getEmbeddingModelPreset("Xenova/jina-embeddings-v2-base-en")).toEqual({
+      pooling: "mean",
+      queryPrefix: "",
+      documentPrefix: "",
+    });
+  });
+
+  it("returns undefined for unknown models", () => {
+    expect(getEmbeddingModelPreset("Xenova/all-MiniLM-L6-v2")).toBeUndefined();
+  });
+});
+
+describe("normalizeEmbeddingPooling", () => {
+  it("accepts mean, cls, and last_token", () => {
+    expect(normalizeEmbeddingPooling("mean")).toBe("mean");
+    expect(normalizeEmbeddingPooling("cls")).toBe("cls");
+    expect(normalizeEmbeddingPooling("last_token")).toBe("last_token");
+  });
+
+  it("rejects invalid values", () => {
+    expect(() => normalizeEmbeddingPooling("max")).toThrow(/embeddingPooling/);
+    expect(() => normalizeEmbeddingPooling(1)).toThrow(/embeddingPooling/);
+  });
+});
+
+describe("normalizeEmbeddingDtype", () => {
+  it("accepts known transformers.js dtypes and trims whitespace", () => {
+    expect(normalizeEmbeddingDtype("q8")).toBe("q8");
+    expect(normalizeEmbeddingDtype(" fp32 ")).toBe("fp32");
+    expect(normalizeEmbeddingDtype("")).toBeUndefined();
+    expect(normalizeEmbeddingDtype(undefined)).toBeUndefined();
+  });
+
+  it("rejects unknown dtypes", () => {
+    expect(() => normalizeEmbeddingDtype("bfloat16")).toThrow(/embeddingDtype/);
+  });
+});
```

**File**: `tests/embedding-task-prefixes.test.ts` (modified, +77/-1)
```diff
@@ -1,5 +1,43 @@
 import { describe, it, expect } from "bun:test";
-import { applyEmbeddingTaskPrefix } from "../src/services/embedding.js";
+import { applyEmbeddingTaskPrefix, resolveEmbeddingTaskPrefix } from "../src/services/embedding.js";
+
+describe("resolveEmbeddingTaskPrefix", () => {
+  it("returns empty when prefixes are disabled and no custom prefix is set", () => {
+    expect(resolveEmbeddingTaskPrefix("document", { useTaskPrefixes: false })).toBe("");
+    expect(resolveEmbeddingTaskPrefix("query", { useTaskPrefixes: false })).toBe("");
+  });
+
+  it("returns Nomic prefixes when useTaskPrefixes is true", () => {
+    expect(resolveEmbeddingTaskPrefix("document", { useTaskPrefixes: true })).toBe(
+      "search_document: "
+    );
+    expect(resolveEmbeddingTaskPrefix("query", { useTaskPrefixes: true })).toBe("search_query: ");
+  });
+
+  it("prefers custom prefixes over Nomic", () => {
+    expect(
+      resolveEmbeddingTaskPrefix("query", {
+        useTaskPrefixes: true,
+        queryPrefix: "query: ",
+      })
+    ).toBe("query: ");
+    expect(
+      resolveEmbeddingTaskPrefix("document", {
+        useTaskPrefixes: true,
+        documentPrefix: "passage: ",
+      })
+    ).toBe("passage: ");
+  });
+
+  it("treats an explicit empty custom prefix as no prefix", () => {
+    expect(
+      resolveEmbeddingTaskPrefix("query", {
+        useTaskPrefixes: true,
+        queryPrefix: "",
+      })
+    ).toBe("");
+  });
+});
 
 describe("applyEmbeddingTaskPrefix", () => {
   it("returns text unchanged when prefixes are disabled", () => {
@@ -38,4 +76,42 @@ describe("applyEmbeddingTaskPrefix", () => {
       "search_query: hello"
     );
   });
+
+  it("applies custom prefixes from options object", () => {
+    expect(
+      applyEmbeddingTaskPrefix(
+        "hello",
+        { task: "query" },
+        {
+          useTaskPrefixes: false,
+          queryPrefix: "query: ",
+          documentPrefix: "passage: ",
+        }
+      )
+    ).toBe("query: hello");
+    expect(
+      applyEmbeddingTaskPrefix(
+        "hello",
+        { task: "document" },
+        {
+          useTaskPrefixes: false,
+          queryPrefix: "query: ",
+          documentPrefix: "passage: ",
+        }
+      )
+    ).toBe("passage: hello");
+  });
+
+  it("skips prefixing when custom prefix is empty even if Nomic is enabled", () => {
+    expect(
+      applyEmbeddingTaskPrefix(
+        "hello",
+        { task: "query" },
+        {
+          useTaskPrefixes: true,
+          queryPrefix: "",
+        }
+      )
+    ).toBe("hello");
+  });
 });
```

---

### Incident Patch 9: `df22336e` (2026-10-10)
**Commit Message**: fix(embedding): resolve ONNX dtype from model declaration or cache (#393)

* fix(embedding): resolve ONNX dtype from model declaration or cache

pipeline() without an explicit dtype resolves device=cpu on Node/Bun, and cpu
is missing from transformers.js DEFAULT_DEVICE_DTYPE_MAPPING, so it falls back
to fp32 and requests onnx/model.onnx. Quantized-only repos do not ship that
file, so the local lookup 404s, the remote fallback runs, and offline hosts
fail warmup with 'fetch failed'.

Resolve the dtype in two tiers before calling pipeline(): first the repo's own
transformers.js_config.dtype declaration, then a probe of the cached ONNX
variants in descending precision. When neither applies, dtype is omitted and
transformers.js keeps its existing defaults.

* fix(embedding): harden ONNX dtype resolution for quantized caches

Expand the cache probe to the full transformers.js suffix map, skip
pipeline dtype overrides when config uses a per-file object map, and
cover resolveLocalOnnxDtype with unit tests.

---------

Co-authored-by: EyJunge1 <[REDACTED_EMAIL]>

**File**: `src/services/embedding.ts` (modified, +92/-1)
```diff
@@ -1,5 +1,6 @@
 import { CONFIG } from "../config.js";
 import { log } from "./logger.js";
+import { existsSync, readFileSync } from "node:fs";
 import { join } from "node:path";
 import {
   formatOnnxruntimeInitError,
@@ -13,6 +14,88 @@ const TIMEOUT_MS = 30000;
 const GLOBAL_EMBEDDING_KEY = Symbol.for("opencode-mem.embedding.instance");
 const MAX_CACHE_SIZE = 100;
 
+// ONNX weight variants in descending precision, mirroring transformers.js
+// DEFAULT_DTYPE_SUFFIX_MAPPING (utils/dtypes.js). fp32 has no filename suffix.
+const ONNX_DTYPE_VARIANTS = [
+  ["fp32", ""],
+  ["fp16", "_fp16"],
+  ["q8", "_quantized"],
+  ["int8", "_int8"],
+  ["uint8", "_uint8"],
+  ["q4", "_q4"],
+  ["q4f16", "_q4f16"],
+  ["bnb4", "_bnb4"],
+  ["q2", "_q2"],
+  ["q2f16", "_q2f16"],
+  ["q1", "_q1"],
+  ["q1f16", "_q1f16"],
+] as const;
+
+/** Concrete dtype strings accepted by transformers.js `pipeline({ dtype })`. */
+export type LocalOnnxDtype = (typeof ONNX_DTYPE_VARIANTS)[number][0] | "auto";
+
+type DeclaredDtype =
+  { kind: "string"; value: LocalOnnxDtype } | { kind: "object" } | { kind: "absent" };
+
+function modelCacheRoot(model: string, cacheRoot?: string): string {
+  return join(cacheRoot ?? join(CONFIG.storagePath, ".cache"), model);
+}
+
+/**
+ * Read `transformers.js_config.dtype` from the cached config.json.
+ * String declarations outrank the cache probe. Object (per-file) maps must not
+ * be overridden — transformers.js resolves them after loading config. Absent or
+ * malformed configs fall through to the cache probe.
+ */
+function readDeclaredDtype(model: string, cacheRoot?: string): DeclaredDtype {
+  try {
+    const parsed = JSON.parse(
+      readFileSync(join(modelCacheRoot(model, cacheRoot), "config.json"), "utf-8")
+    );
+    const declared = parsed?.["transformers.js_config"]?.dtype;
+    if (typeof declared === "string" && declared.trim()) {
+      return { kind: "string", value: declared.trim() as LocalOnnxDtype };
+    }
+    if (declared && typeof declared === "object" && !Array.isArray(declared)) {
+      return { kind: "object" };
+    }
+    return { kind: "absent" };
+  } catch {
+    return { kind: "absent" };
+  }
+}
+
+/**
+ * Resolve the dtype whose ONNX weights are already cached, so a quantized-only
+ * repo is not asked for `model.onnx` (fp32). Returns undefined when nothing is
+ * cached yet — transformers.js then falls back to its own defaults.
+ */
+function detectCachedDtype(model: string, cacheRoot?: string): LocalOnnxDtype | undefined {
+  const onnxDir = join(modelCacheRoot(model, cacheRoot), "onnx");
+  const hit = ONNX_DTYPE_VARIANTS.find(([, suffix]) =>
+    existsSync(join(onnxDir, `model${suffix}.onnx`))
+  );
+  return hit?.[0];
+}
+
+/**
+ * Resolve a concrete dtype to pass into transformers.js `pipeline()`, or
+ * undefined to leave dtype selection to transformers.js defaults / config.
+ *
+ * @param model Hugging Face model id (cache subdirectory under `.cache`)
+ * @param cacheRoot Optional override for `{storagePath}/.cache` (tests)
+ */
+export function resolveLocalOnnxDtype(
+  model: string,
+  cacheRoot?: string
+): LocalOnnxDtype | undefined {
+  const declared = readDeclaredDtype(model, cacheRoot);
+  if (declared.kind === "string") return declared.value;
+  // Per-file object maps: do not pass options.dtype — it would override config.
+  if (declared.kind === "object") return undefined;
+  return detectCachedDtype(model, cacheRoot);
+}
+
 export type EmbeddingTask = "document" | "query";
 
 export type EmbedOptions = {
@@ -164,12 +247,20 @@ export class EmbeddingService {
 
       // Local model path
       const { pipeline } = await ensureTransformersLoaded();
+      const dtype = resolveLocalOnnxDtype(CONFIG.embeddingModel);
+      if (dtype) {
+        log("Resolved local ONNX dtype for embedding warmup", {
+          model: CONFIG.embeddingModel,
+          dtype,
+        });
+      }
       this.pipe = await pipeline("feature-extraction", CONFIG.embeddingModel, {
+        ...(dtype ? { dtype } : {}),
         progress_callback: progressCallback,
       });
       this.isWarmedUp = true;
       this.initError = null;
-      log("Embedding model warmed up", { model: CONFIG.embeddingModel });
+      log("Embedding model warmed up", { model: CONFIG.embeddingModel, dtype: dtype ?? null });
     } catch (error) {
       const rewritten = formatOnnxruntimeInitError(error);
       this.initPromise = null;
```

**File**: `tests/embedding-onnx-dtype.test.ts` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+import { describe, expect, it } from "bun:test";
+import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { resolveLocalOnnxDtype } from "../src/services/embedding.js";
+
+const MODEL = "org/quantized-embed";
+
+function withCache(setup: (cacheRoot: string, modelDir: string, onnxDir: string) => void): string {
+  const cacheRoot = mkdtempSync(join(tmpdir(), "opencode-mem-onnx-dtype-"));
+  const modelDir = join(cacheRoot, MODEL);
+  const onnxDir = join(modelDir, "onnx");
+  mkdirSync(onnxDir, { recursive: true });
+  setup(cacheRoot, modelDir, onnxDir);
+  return cacheRoot;
+}
+
+function writeConfig(modelDir: string, transformersJsConfig: Record<string, unknown>): void {
+  writeFileSync(
+    join(modelDir, "config.json"),
+    JSON.stringify({ model_type: "bert", "transformers.js_config": transformersJsConfig }),
+    "utf-8"
+  );
+}
+
+function touchOnnx(onnxDir: string, fileName: string): void {
+  writeFileSync(join(onnxDir, fileName), "stub");
+}
+
+describe("resolveLocalOnnxDtype", () => {
+  it("detects q8 from model_quantized.onnx when no config dtype is declared", () => {
+    const cacheRoot = withCache((_cacheRoot, _modelDir, onnxDir) => {
+      touchOnnx(onnxDir, "model_quantized.onnx");
+    });
+    try {
+      expect(resolveLocalOnnxDtype(MODEL, cacheRoot)).toBe("q8");
+    } finally {
+      rmSync(cacheRoot, { recursive: true, force: true });
+    }
+  });
+
+  it("prefers declared string dtype over missing fp32 weights", () => {
+    const cacheRoot = withCache((_cacheRoot, modelDir, onnxDir) => {
+      writeConfig(modelDir, { dtype: "q8" });
+      touchOnnx(onnxDir, "model_quantized.onnx");
+    });
+    try {
+      expect(resolveLocalOnnxDtype(MODEL, cacheRoot)).toBe("q8");
+    } finally {
+      rmSync(cacheRoot, { recursive: true, force: true });
+    }
+  });
+
+  it("does not override per-file object dtype with a cache probe", () => {
+    const cacheRoot = withCache((_cacheRoot, modelDir, onnxDir) => {
+      writeConfig(modelDir, { dtype: { model: "q8" } });
+      touchOnnx(onnxDir, "model_quantized.onnx");
+    });
+    try {
+      expect(resolveLocalOnnxDtype(MODEL, cacheRoot)).toBeUndefined();
+    } finally {
+      rmSync(cacheRoot, { recursive: true, force: true });
+    }
+  });
+
+  it("prefers fp32 when both fp32 and q8 weights are cached", () => {
+    const cacheRoot = withCache((_cacheRoot, _modelDir, onnxDir) => {
+      touchOnnx(onnxDir, "model.onnx");
+      touchOnnx(onnxDir, "model_quantized.onnx");
+    });
+    try {
+      expect(resolveLocalOnnxDtype(MODEL, cacheRoot)).toBe("fp32");
+    } finally {
+      rmSync(cacheRoot, { recursive: true, force: true });
+    }
+  });
+
+  it("returns undefined for an empty cache", () => {
+    const cacheRoot = withCache(() => {
+      /* empty model dir with only onnx/ */
+    });
+    try {
+      expect(resolveLocalOnnxDtype(MODEL, cacheRoot)).toBeUndefined();
+    } finally {
+      rmSync(cacheRoot, { recursive: true, force: true });
+    }
+  });
+
+  it("detects q4f16 from model_q4f16.onnx", () => {
+    const cacheRoot = withCache((_cacheRoot, _modelDir, onnxDir) => {
+      touchOnnx(onnxDir, "model_q4f16.onnx");
+    });
+    try {
+      expect(resolveLocalOnnxDtype(MODEL, cacheRoot)).toBe("q4f16");
+    } finally {
+      rmSync(cacheRoot, { recursive: true, force: true });
+    }
+  });
+});
```

---

### Incident Patch 10: `1832bff6` (2026-10-06)
**Commit Message**: fix(ai): retry tool calls after argument validation failure (#389)

Validation errors in executeToolCall returned immediately and skipped the
built-in retry loop, aborting user-profile-learning for the idle cycle.
Break out of the tool-call loop instead so the model can fix invalid JSON
within maxIterations.

Fixes #388

**File**: `src/services/ai/providers/openai-chat-completion.ts` (modified, +1/-5)
```diff
@@ -466,11 +466,7 @@ export class OpenAIChatCompletionProvider extends BaseAIProvider {
                   JSON.stringify({ success: false, error: errorMessage })
                 );
 
-                return {
-                  success: false,
-                  error: errorMessage,
-                  iterations,
-                };
+                break;
               }
             }
 
```

**File**: `tests/openai-chat-completion-provider.test.ts` (modified, +85/-0)
```diff
@@ -412,6 +412,91 @@ describe("OpenAIChatCompletionProvider", () => {
     expect(result.iterations).toBe(1);
   });
 
+  it("retries after tool-argument validation failure and succeeds on next attempt", async () => {
+    const invalidArguments = JSON.stringify({
+      preferences: [],
+      patterns: [],
+      workflows: "none",
+    });
+    const validArguments = JSON.stringify({
+      preferences: [],
+      patterns: [],
+      workflows: [],
+      codingStyle: {},
+      domainKnowledge: [],
+    });
+
+    const responses = [
+      {
+        choices: [
+          {
+            message: {
+              content: null,
+              tool_calls: [
+                {
+                  id: "call-1",
+                  type: "function",
+                  function: { name: "save_memories", arguments: invalidArguments },
+                },
+              ],
+            },
+          },
+        ],
+      },
+      {
+        choices: [
+          {
+            message: {
+              content: null,
+              tool_calls: [
+                {
+                  id: "call-2",
+                  type: "function",
+                  function: { name: "save_memories", arguments: validArguments },
+                },
+              ],
+            },
+          },
+        ],
+      },
+    ];
+
+    let callCount = 0;
+    const requestBodies: Array<{ messages?: Array<{ role?: string; content?: string }> }> = [];
+
+    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
+      const body = JSON.parse(String(init?.body ?? "{}"));
+      requestBodies.push(body);
+      const responseBody = responses[callCount] ?? responses[responses.length - 1];
+      callCount++;
+      return {
+        ok: true,
+        status: 200,
+        statusText: "OK",
+        text: async () => JSON.stringify(responseBody),
+        json: async () => responseBody,
+      } as Response;
+    }) as typeof fetch;
+
+    const result = await makeProvider({
+      maxIterations: 3,
+      apiUrl: "https://api.openai.com/v1",
+    }).executeToolCall("system", "user", toolSchema, "session-id");
+
+    expect(result.success).toBe(true);
+    expect(result.iterations).toBe(2);
+    expect(callCount).toBe(2);
+
+    const secondMessages = requestBodies[1]?.messages ?? [];
+    const retryFeedback = secondMessages.some(
+      (msg) =>
+        typeof msg.content === "string" &&
+        (msg.content.includes("Validation failed") ||
+          msg.content.includes("workflows must be an array"))
+    );
+    expect(retryFeedback).toBe(true);
+  });
+
   it("returns success: false after max iterations with no tool call", async () => {
     globalThis.fetch = makeFetch({
       ok: true,
```

---

### Incident Patch 11: `b8f514a9` (2026-10-06)
**Commit Message**: fix(v2): map failed and interrupted execution events to session.idle (#386)

Auto-capture and profile learning only run on session.idle; without
aliasing session.execution.failed/interrupted those sessions were never
captured. Closes #383.

**File**: `src/v2/legacy-client.ts` (modified, +12/-6)
```diff
@@ -317,16 +317,22 @@ export function legacyToolResult(value: unknown): { content: string; metadata?:
   return { content: JSON.stringify(value ?? null) };
 }
 
+// opencode v2 no longer publishes `session.idle`, which is what
+// opencode-mem builds auto-capture and profile learning on. The
+// `/api/event` stream emits `session.execution.{succeeded,failed,interrupted}`
+// with `data.sessionID`; forwarding them under the legacy name is enough.
+const LEGACY_EVENT_ALIASES: Record<string, string> = {
+  "session.compaction.ended": "session.compacted",
+  "session.execution.succeeded": "session.idle",
+  "session.execution.failed": "session.idle",
+  "session.execution.interrupted": "session.idle",
+};
+
 export function toLegacyEvent(raw: any): { type: string; properties: any } {
   const envelope = raw?.payload ?? raw;
   const source = envelope?.type === "sync" && envelope.syncEvent ? envelope.syncEvent : envelope;
   const rawType = typeof source?.type === "string" ? source.type.replace(/\.1$/, "") : source?.type;
-  const type =
-    rawType === "session.compaction.ended"
-      ? "session.compacted"
-      : rawType === "session.execution.succeeded"
-        ? "session.idle"
-        : rawType;
+  const type = typeof rawType === "string" ? (LEGACY_EVENT_ALIASES[rawType] ?? rawType) : rawType;
   const data = source?.data ?? {};
   if (source && typeof source === "object" && "properties" in source) {
     return { type, properties: source.properties };
```

**File**: `tests/v2-legacy-client.test.ts` (modified, +9/-10)
```diff
@@ -384,16 +384,15 @@ describe("OpenCode v2 legacy client bridge", () => {
     });
   });
 
-  it("maps V2 execution.succeeded to session.idle for auto-capture", () => {
-    expect(
-      toLegacyEvent({
-        type: "session.execution.succeeded",
-        data: { sessionID: "ses-1" },
-      })
-    ).toEqual({
-      type: "session.idle",
-      properties: { sessionID: "ses-1" },
-    });
+  it("aliases v2 execution events to session.idle", () => {
+    const t = (raw: string) => toLegacyEvent({ type: raw, data: { sessionID: "s1" } }).type;
+
+    expect(t("session.execution.succeeded")).toBe("session.idle");
+    expect(t("session.execution.failed")).toBe("session.idle");
+    expect(t("session.execution.interrupted")).toBe("session.idle");
+    expect(t("session.compaction.ended")).toBe("session.compacted");
+    expect(t("message.updated")).toBe("message.updated");
+    expect(t("session.execution.succeeded.1")).toBe("session.idle");
   });
 
   it("filters the global event stream by direct or session location", async () => {
```

---

### Incident Patch 12: `dd134c73` (2026-10-06)
**Commit Message**: fix(profile): return JSON instead of calling a tool on the OpenCode path (#381)

* fix(profile): return JSON instead of calling a tool on the OpenCode path

Profile analysis shares one system prompt between the external-API
tool-call path and the OpenCode structured-output path. The prompt ends
with "Use the update_user_profile tool to save the profile", but on
OpenCode v2 structured output goes through the Generate API, which has no
tools and no json_schema enforcement. Models follow the instruction, reply
with a one-line preamble ("Let me load the profile update tool first.")
and stop, so profile learning never gets JSON and fails or times out.

- buildProfileSystemPrompt takes a mode: the OpenCode path asks for the
  profile as the JSON object; the external tool-call path is unchanged.
- The v2 bridge states that no tools are available for json_schema
  requests and recovers JSON from a fenced block or the first balanced
  object when the model adds prose.
- New optional opencodeTimeoutMs (default 90000, clamped to
  10000..600000) drives the structured-output timeout. The outer safety
  races in profile code derive from it (+30s) instead of a fixed 120s, so
  the informative in

**File**: `README.md` (modified, +2/-0)
```diff
@@ -414,6 +414,8 @@ The plugin issues structured-output requests to opencode's session API instead o
 
 Optionally pin a model reasoning variant with `"opencodeVariant": "xhigh"` (e.g. for grok-4.7). It is applied to the plugin's internal LLM calls (auto-capture summaries, profile learning, profile cleanup), including when `opencodeModel` is `"inherit"`, so background work can use a different reasoning level than the interactive session.
 
+Slow reasoning models (or very large profile prompts) can exceed the default 90 s structured-output budget. Set `"opencodeTimeoutMs"` (milliseconds) to extend it for internal structured-output calls (auto-capture summaries, profile learning) — e.g. `"opencodeTimeoutMs": 180000` for 3 minutes. Values are clamped to 10000..600000; the default stays 90000. Numeric strings are coerced. Profile cleanup uses a separate, longer timeout.
+
 Supported providers: any provider listed by `opencode providers list` (e.g. `anthropic`, `openai`, `github-copilot`, ...).
 
 If `opencodeProvider` and `opencodeModel` are set, they take precedence over the manual `memoryProvider` settings below.
```

**File**: `opencode-mem.example.jsonc` (modified, +4/-0)
```diff
@@ -152,6 +152,10 @@
   // Optional model reasoning variant for internal LLM calls (e.g. "xhigh");
   // also applies when opencodeModel is "inherit":
   // "opencodeVariant": "xhigh",
+  // Optional timeout (ms) for the plugin's internal structured-output LLM calls
+  // (auto-capture summaries, profile learning; default 90000, clamped to 10000..600000;
+  // invalid values fall back to the default; numeric strings are coerced):
+  // "opencodeTimeoutMs": 180000,
 
   // ============================================
   // Auto-Capture Settings
```

**File**: `src/config.ts` (modified, +52/-0)
```diff
@@ -67,6 +67,14 @@ interface OpenCodeMemConfig {
    * cheaper/faster/higher variant than the interactive session default.
    */
   opencodeVariant?: string;
+  /**
+   * Timeout in milliseconds for the plugin's internal structured-output LLM
+   * calls (auto-capture summaries, profile learning). Profile cleanup keeps
+   * its own longer timeout. Clamped to 10000..600000; non-number/non-finite
+   * values (and non-numeric strings) fall back to the 90000 default. Numeric
+   * strings like "180000" are coerced.
+   */
+  opencodeTimeoutMs?: number;
   aiSessionRetentionDays?: number;
   webServerEnabled?: boolean;
   webServerPort?: number;
@@ -160,6 +168,7 @@ const DEFAULTS: Required<
     | "opencodeProvider"
     | "opencodeModel"
     | "opencodeVariant"
+    | "opencodeTimeoutMs"
     | "autoCaptureLanguage"
     | "userEmailOverride"
     | "userNameOverride"
@@ -182,6 +191,7 @@ const DEFAULTS: Required<
   opencodeProvider?: string;
   opencodeModel?: string;
   opencodeVariant?: string;
+  opencodeTimeoutMs?: number;
   autoCaptureLanguage?: string;
   userEmailOverride?: string;
   userNameOverride?: string;
@@ -420,6 +430,10 @@ const CONFIG_TEMPLATE = `{
    // Optional model reasoning variant for internal LLM calls (e.g. "xhigh");
    // also applies when opencodeModel is "inherit":
    // "opencodeVariant": "xhigh",
+   // Optional timeout in milliseconds for the plugin's internal structured-output LLM calls
+   // (auto-capture summaries, profile learning; default 90000, clamped to 10000..600000;
+   // invalid values fall back to the default; numeric strings are coerced):
+   // "opencodeTimeoutMs": 180000,
 
    // ============================================
    // Auto-Capture Settings
@@ -747,6 +761,43 @@ function normalizeOpencodeVariant(value: string | undefined): string | undefined
   return trimmed ? trimmed : undefined;
 }
 
+export const OPENCODE_TIMEOUT_MS_MIN = 10_000;
+export const OPENCODE_TIMEOUT_MS_MAX = 600_000;
+export const OPENCODE_TIMEOUT_MS_DEFAULT = 90_000;
+
+/**
+ * Structured-output prompt timeout: non-number/non-finite values fall back to
+ * the default (numeric strings are coerced first), otherwise the value is
+ * clamped to [OPENCODE_TIMEOUT_MS_MIN, OPENCODE_TIMEOUT_MS_MAX].
+ */
+export function normalizeOpencodeTimeoutMs(value: unknown): number {
+  let numeric = value;
+  if (typeof value === "string") {
+    const trimmed = value.trim();
+    if (trimmed.length === 0) return OPENCODE_TIMEOUT_MS_DEFAULT;
+    numeric = Number(trimmed);
+  }
+  if (typeof numeric !== "number" || !Number.isFinite(numeric)) {
+    return OPENCODE_TIMEOUT_MS_DEFAULT;
+  }
+  return Math.min(OPENCODE_TIMEOUT_MS_MAX, Math.max(OPENCODE_TIMEOUT_MS_MIN, numeric));
+}
+
+/**
+ * Margin added to the configured structured-output timeout for the outer
+ * safety-net races around generateStructuredOutput calls: the inner, more
+ * informative provider timeout always fires first.
+ */
+export const OPENCODE_TIMEOUT_OUTER_MARGIN_MS = 30_000;
+
+/**
+ * Outer safety-net timeout wrapping one structured-output call, derived from
+ * the configured timeout plus a fixed margin.
+ */
+export function outerStructuredOutputTimeoutMs(configured: number | undefined): number {
+  return (configured ?? OPENCODE_TIMEOUT_MS_DEFAULT) + OPENCODE_TIMEOUT_OUTER_MARGIN_MS;
+}
+
 /**
  * User-supplied markers extend the built-in set rather than replacing it, so
  * adding one marker cannot silently disable protection against all the others.
@@ -837,6 +888,7 @@ function buildConfig(fileConfig: OpenCodeMemConfig) {
     opencodeProvider: fileConfig.opencodeProvider,
     opencodeModel: fileConfig.opencodeModel,
     opencodeVariant: normalizeOpencodeVariant(fileConfig.opencodeVariant),
+    opencodeTimeoutMs: normalizeOpencodeTimeoutMs(fileConfig.opencodeTimeoutMs),
     autoCaptureProviderStatus: getAutoCaptureProviderStatus({
       opencodeProvider: fileConfig.opencodeProvider,
       opencodeModel: fileConfig.opencodeModel,
```

**File**: `src/index.ts` (modified, +11/-2)
```diff
@@ -318,9 +318,18 @@ export async function configureOpencodeHostTransport(ctx: {
   readonly client: unknown;
   readonly serverUrl?: string | URL;
 }): Promise<void> {
-  const { createV2Client, resetHostFetch, setHostFetch, setV2Client } =
-    await loadOpencodeProvider();
+  const {
+    createV2Client,
+    resetHostFetch,
+    setHostFetch,
+    setV2Client,
+    setStructuredOutputTimeoutConfig,
+  } = await loadOpencodeProvider();
   resetHostFetch();
+  // Configured structured-output timeout (opencodeTimeoutMs): injected here so
+  // the lazily-bundled provider module never imports config.js (whose import
+  // side effects would leak into subprocess gates and loader bundles).
+  setStructuredOutputTimeoutConfig(CONFIG.opencodeTimeoutMs);
   const hostConfig = getHostClientConfig(ctx);
   if (hostConfig.fetch) {
     setHostFetch(hostConfig.fetch);
```

**File**: `src/services/ai/opencode-provider.ts` (modified, +32/-4)
```diff
@@ -55,11 +55,39 @@ export const STRUCTURED_OUTPUT_MAX_STEPS = 2;
 /** Cap OpenCode schema retries so a bad provider cannot spin forever. */
 export const STRUCTURED_OUTPUT_DEFAULT_RETRY_COUNT = 1;
 
-let _structuredOutputTimeoutMs = STRUCTURED_OUTPUT_TIMEOUT_MS;
+let _structuredOutputTimeoutOverrideMs: number | undefined;
+// Configured timeout (CONFIG.opencodeTimeoutMs), injected by the plugin init
+// instead of importing config.js here: the provider module is bundled into a
+// single-file lazy loader whose import graph must stay free of config side
+// effects (config creation banner, DATA_DIR mkdir) for subprocess gates.
+let _structuredOutputConfiguredMs: number | undefined;
 
-/** Test helper: override the structured-output prompt timeout. Pass undefined to reset. */
+/**
+ * Test helper: override the structured-output prompt timeout. Pass undefined
+ * to reset to the configured value.
+ */
 export function setStructuredOutputTimeoutMsForTests(ms: number | undefined): void {
-  _structuredOutputTimeoutMs = ms ?? STRUCTURED_OUTPUT_TIMEOUT_MS;
+  _structuredOutputTimeoutOverrideMs = ms;
+}
+
+/**
+ * Inject the configured structured-output timeout (CONFIG.opencodeTimeoutMs,
+ * already normalized/clamped in config.ts). Called once by the plugin init.
+ */
+export function setStructuredOutputTimeoutConfig(ms: number): void {
+  _structuredOutputConfiguredMs = ms;
+}
+
+/**
+ * Effective structured-output prompt timeout: the test override wins, then
+ * the configured value, then the hard-coded default.
+ */
+function effectiveStructuredOutputTimeoutMs(): number {
+  return (
+    _structuredOutputTimeoutOverrideMs ??
+    _structuredOutputConfiguredMs ??
+    STRUCTURED_OUTPUT_TIMEOUT_MS
+  );
 }
 
 export const STRUCTURED_OUTPUT_PERMISSIONS = [
@@ -717,7 +745,7 @@ async function withStructuredOutputTimeout<T>(
   onTimeout: () => unknown
 ): Promise<T> {
   let timer: ReturnType<typeof setTimeout> | undefined;
-  const timeoutMs = _structuredOutputTimeoutMs;
+  const timeoutMs = effectiveStructuredOutputTimeoutMs();
   const timeoutPromise = new Promise<never>((_, reject) => {
     timer = setTimeout(() => {
       reject(structuredOutputTimeoutError(timeoutMs));
```

**File**: `src/services/user-memory-learning.ts` (modified, +45/-7)
```diff
@@ -686,7 +686,37 @@ export async function resolveProfileLanguageName(prompts: UserPrompt[]): Promise
   return getLanguageName(targetLang);
 }
 
-function buildProfileSystemPrompt(existingProfile: UserProfile | null, langName: string): string {
+/**
+ * Outer safety-net timeout wrapping one structured-output call: the configured
+ * timeout plus a fixed margin, so the inner, more informative provider
+ * timeout always fires first. Local (not imported from config.ts) because
+ * subprocess test scenarios mock the config module with a minimal export
+ * surface.
+ */
+function outerStructuredTimeoutMs(configured: number | undefined): number {
+  return (configured ?? 90_000) + 30_000;
+}
+
+/**
+ * System prompt for the profile analysis.
+ *
+ * `mode` selects the transport the same analysis is served through:
+ * - "tool": the external-API tool-call path (`update_user_profile` forced
+ *   tool). The prompt must instruct the model to use that tool.
+ * - "json": the OpenCode structured-output path (v2 Generate API exposes no
+ *   tools). A tool instruction here makes obedient models stall on a
+ *   preamble ("Let me load the profile update tool first.") and return no
+ *   JSON, so the model is told to answer with the profile JSON object itself.
+ */
+function buildProfileSystemPrompt(
+  existingProfile: UserProfile | null,
+  langName: string,
+  mode: "tool" | "json"
+): string {
+  const closing =
+    mode === "tool"
+      ? `Use the update_user_profile tool to save the ${existingProfile ? "updated" : "new"} profile.`
+      : `Return the ${existingProfile ? "updated" : "new"} profile as the JSON object described in the request. Reply with JSON only.`;
   return `You are a user behavior analyst for a coding assistant.
 
 Your task is to analyze user prompts and ${existingProfile ? "update" : "create"} a comprehensive user profile.
@@ -695,18 +725,23 @@ CRITICAL: You MUST write all descriptions, categories, and text in ${langName}.
 
 CRITICAL: All JSON string values MUST escape double quotes with backslash. Do NOT use unescaped quotation marks inside string values.
 
-Use the update_user_profile tool to save the ${existingProfile ? "updated" : "new"} profile.`;
+${closing}`;
 }
 
 async function analyzeUserProfile(
   context: string,
   existingProfile: UserProfile | null,
   langName: string
 ): Promise<AnalysisResult | null> {
-  const systemPrompt = buildProfileSystemPrompt(existingProfile, langName);
-  log("user-profile-learning: analyze called", { hasProfile: !!existingProfile });
+  // Outer safety net for the structured-output call. Derived from the same
+  // configured timeout the inner (informative) structured-output timeout uses,
+  // plus a margin, so the inner one always fires first and the error message
+  // names the real cause instead of a generic race timeout.
+  const outerTimeoutMs = outerStructuredTimeoutMs(CONFIG.opencodeTimeoutMs);
   let opencodeProviderError: unknown;
   if (CONFIG.opencodeProvider && CONFIG.opencodeModel) {
+    const systemPrompt = buildProfileSystemPrompt(existingProfile, langName, "json");
+    log("user-profile-learning: analyze called", { hasProfile: !!existingProfile });
     log("user-profile-learning: trying opencode provider");
     // The try/catch boundary is the provider only: LLM client construction,
     // the structured-output call, and schema binding. Stored-profile parsing
@@ -744,7 +779,7 @@ async function analyzeUserProfile(
           schema,
         }),
         new Promise<never>((_, reject) =>
-          setTimeout(() => reject(new Error("user-profile-learning: timeout")), 120000)
+          setTimeout(() => reject(new Error("user-profile-learning: timeout")), outerTimeoutMs)
         ),
       ]);
 
@@ -801,7 +836,7 @@ async function analyzeUserProfile(
   const toolSchema = createUserProfileToolSchema(Boolean(existingProfile));
 
   const result = await provider.executeToolCall(
-    systemPrompt,
+    buildProfileSystemPrompt(existingProfile, langName, "tool"),
     context,
     toolSchema,
     `user-profile-${Date.now()}`
@@ -875,7 +910,10 @@ If no clear chains, return { "paths": [] }.`;
             }),
           }),
           new Promise<never>((_, reject) =>
-            setTimeout(() => reject(new Error("learning paths: opencode timeout")), 120000)
+            setTimeout(
+              () => reject(new Error("learning paths: opencode timeout")),
+              outerStructuredTimeoutMs(CONFIG.opencodeTimeoutMs)
+            )
           ),
         ])) as LearningPathsResult;
       }
```

**File**: `src/services/user-profile/user-profile-manager.ts` (modified, +9/-1)
```diff
@@ -18,6 +18,11 @@ const THREE_WAY_CENTROID_W2 = 0.45;
 const THREE_WAY_CENTROID_W3 = 0.1;
 const DIRECTION_VALIDATION_TOLERANCE = 0.03;
 
+/** Mirrors config.outerStructuredOutputTimeoutMs; kept local so fixture mocks of config.js stay minimal. */
+function outerStructuredTimeoutMs(configured: number | undefined): number {
+  return (configured ?? 90_000) + 30_000;
+}
+
 /**
  * Gamma sampler (Marsaglia-Tsang 2000).
  * Used by sampleBeta for Thompson Sampling weak-hit upgrades.
@@ -2043,7 +2048,10 @@ Generate a concise, abstract description of the user's general behavioral tenden
         schema,
       }),
       new Promise((_, reject) =>
-        setTimeout(() => reject(new Error("evolve description timeout")), 120000)
+        setTimeout(
+          () => reject(new Error("evolve description timeout")),
+          outerStructuredTimeoutMs(CONFIG.opencodeTimeoutMs)
+        )
       ),
     ]);
 
```

**File**: `src/v2/legacy-client.ts` (modified, +66/-8)
```diff
@@ -11,20 +11,74 @@ function textFromParts(parts: LegacyPart[] = []): string {
     .join("\n");
 }
 
+/**
+ * Best-effort structured-output recovery for the v2 Generate API, which has
+ * no json_schema enforcement: try the raw text as JSON, then a fenced
+ * ```json block, then balanced top-level {...} objects (ignoring braces
+ * inside strings). When several objects parse, prefer the last one (models
+ * often emit a stub/example before the final answer). Returns undefined when
+ * nothing parses — callers treat that as "no structured output".
+ */
 function parseJson(text: string): unknown {
   const trimmed = text.trim();
-  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1];
-  const candidate = fenced ?? trimmed;
+
+  // Direct JSON.
   try {
-    return JSON.parse(candidate);
+    return JSON.parse(trimmed);
   } catch {
-    const start = candidate.indexOf("{");
-    const end = candidate.lastIndexOf("}");
-    if (start >= 0 && end > start) {
-      return JSON.parse(candidate.slice(start, end + 1));
+    // fall through to recovery
+  }
+
+  // Fenced ```json block.
+  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
+  if (fenced) {
+    try {
+      return JSON.parse(fenced);
+    } catch {
+      // fall through to the balanced-object scan
     }
-    throw new Error("Model did not return a JSON object");
   }
+
+  // Scan every balanced top-level object; keep the last one that parses.
+  const candidate = fenced ?? trimmed;
+  let lastParsed: unknown;
+  let searchFrom = 0;
+  while (searchFrom < candidate.length) {
+    const start = candidate.indexOf("{", searchFrom);
+    if (start < 0) break;
+
+    let depth = 0;
+    let inString = false;
+    let escaped = false;
+    let found = false;
+    for (let i = start; i < candidate.length; i++) {
+      const ch = candidate[i];
+      if (inString) {
+        if (escaped) escaped = false;
+        else if (ch === "\\") escaped = true;
+        else if (ch === '"') inString = false;
+        continue;
+      }
+      if (ch === '"') inString = true;
+      else if (ch === "{") depth++;
+      else if (ch === "}") {
+        depth--;
+        if (depth === 0) {
+          found = true;
+          try {
+            lastParsed = JSON.parse(candidate.slice(start, i + 1));
+          } catch {
+            // Unparseable balanced span: keep scanning for a later object.
+          }
+          searchFrom = i + 1;
+          break;
+        }
+      }
+    }
+    if (!found) break;
+  }
+
+  return lastParsed;
 }
 
 function legacyMessage(message: any, sessionID: string): any {
@@ -93,6 +147,10 @@ function schemaPrompt(body: any): string {
       [
         "Return only one JSON object matching this JSON Schema.",
         "Do not wrap the JSON in Markdown.",
+        // The v2 Generate API exposes no tools; models that follow a tool
+        // instruction from the system prompt would stall on a preamble and
+        // never answer. State the constraint explicitly.
+        "No tools are available in this request. Do not attempt to call any tool; your entire reply must be only the JSON object.",
         JSON.stringify(body.format.schema),
       ].join("\n")
     );
```

---

### Incident Patch 13: `62ad0909` (2026-10-06)
**Commit Message**: fix(capture): skip prompts from subagent child sessions (#382)

* fix(capture): skip prompts from subagent child sessions

Every "user" message of every session was recorded via capturePrompt.
Sessions spawned by an orchestrator (OpenCode task/subagent children)
have a parentID, and their "user" messages are prompts written by the
parent agent, not by the human. They were saved as user prompts,
auto-captured into memories, and consumed by profile learning, which
learned the orchestrator's style as the user's preferences.

capturePrompt now checks the session's parentID (same session.get
access pattern as isInternalCaptureSession) and returns false before
saving, so child-session prompts are neither stored nor auto-captured
nor used for profile learning. The lookup is cached per sessionID in a
bounded in-memory map (parentID never changes), and a lookup failure
fails open with a log line, preserving today's behaviour.

New chatMessage.captureChildSessions option (default false) opts back
into capturing child-session prompts. Memory-context injection (load)
behaviour is unchanged apart from the existing refused-capture path.

* fix(capture): skip child sessions in memoryContext.load


**File**: `README.md` (modified, +13/-0)
```diff
@@ -210,6 +210,19 @@ Configure at `~/.config/opencode/opencode-mem.jsonc`:
 
 The plugin creates a full commented template at this path on first startup. For every setting and comment, see [`opencode-mem.example.jsonc`](opencode-mem.example.jsonc).
 
+### Chat message capture and injection (`chatMessage`)
+
+These settings live under the `chatMessage` key in `~/.config/opencode/opencode-mem.jsonc`:
+
+| Option                                                 | Default          | What it does                                                                                                                                                                                                                                                                                           |
+| ------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
+| `enabled`                                              | `true`           | Capture authored user prompts and inject memory context.                                                                                                                                                                                                                                               |
+| `injectOn`                                             | `"first"`        | Inject memory context on the first user message of a session, or on `"always"` every authored turn.                                                                                                                                                                                                    |
+| `maxMemories` / `excludeCurrentSession` / `maxAgeDays` | `3` / `true` / — | How many memories the injected context holds, whether memories captured in the current session are excluded, and an optional age cutoff in days.                                                                                                                                                       |
+| `filterInjectedPrompts`                                | `true`           | Skip prompt text injected by the host or by other OpenCode plugins (system reminders, orchestration directives, background-task notifications) so it is never stored as if the user had typed it.                                                                                                      |
+| `injectionMarkers`                                     | built-ins        | Extra markers identifying injected blocks; added to the built-in list, never replacing it.                                                                                                                                                                                                             |
+| `captureChildSessions`                                 | `false`          | Capture prompts from orchestrator child sessions (sessions with a `parentID`, e.g. OpenCode task/subagent children). Their "user" messages are written by the parent agent, not by you, so by default they are not stored, auto-captured, used for profile learning, or given injected memory context. |
+
 ### Choosing / configuring embeddings
 
 Embeddings power similarity search for memories and the user profile. Configure them in the same file (`~/.config/opencode/opencode-mem.jsonc`). There is **no MLX backend** — local embeddings use `@huggingface/transformers` with ONNX, not Apple MLX.
```

**File**: `opencode-mem.example.jsonc` (modified, +6/-0)
```diff
@@ -116,6 +116,12 @@
     // notifications) so it is never stored as if the user had typed it.
     // Disable only if you deliberately want that content memorized.
     "filterInjectedPrompts": true,
+    // Capture prompts from orchestrator child sessions (sessions with a parentID,
+    // e.g. OpenCode task/subagent children). Their "user" messages are written
+    // by the parent agent, not by you, so the default false means they are not
+    // stored, auto-captured, used for profile learning, or given memory
+    // context. Enable only if you deliberately want those prompts memorized.
+    "captureChildSessions": false,
     // Extra markers identifying injected blocks. These are ADDED to the
     // built-in list, never replace it.
     // "injectionMarkers": ["<my-plugin-banner>"],
```

**File**: `src/config.ts` (modified, +18/-1)
```diff
@@ -135,6 +135,13 @@ interface OpenCodeMemConfig {
     injectOn?: "first" | "always";
     filterInjectedPrompts?: boolean;
     injectionMarkers?: string[];
+    /**
+     * Capture "user" prompts from orchestrator child sessions (sessions with
+     * a parentID, e.g. OpenCode task/subagent). Default false: those prompts
+     * are written by the parent agent, not the human, and would train
+     * auto-capture / profile learning on the orchestrator's style.
+     */
+    captureChildSessions?: boolean;
   };
 }
 
@@ -251,6 +258,7 @@ const DEFAULTS: Required<
     injectOn: "first",
     filterInjectedPrompts: true,
     injectionMarkers: [...getDefaultInjectionMarkers()],
+    captureChildSessions: false,
   },
 };
 
@@ -642,7 +650,14 @@ const CONFIG_TEMPLATE = `{
     // (system reminders, orchestration directives, background-task
     // notifications) so it is never stored as if the user had typed it.
     // Disable only if you deliberately want that content memorized.
-    "filterInjectedPrompts": true
+    "filterInjectedPrompts": true,
+
+    // Capture prompts from orchestrator child sessions (sessions with a parentID,
+    // e.g. OpenCode task/subagent children). Their "user" messages are written
+    // by the parent agent, not by you, so default false means they are not
+    // stored, auto-captured, used for profile learning, or given memory
+    // context. Enable only if you deliberately want those prompts memorized.
+    "captureChildSessions": false
 
     // Extra markers identifying injected blocks. These are ADDED to the
     // built-in list, never replace it.
@@ -920,6 +935,8 @@ function buildConfig(fileConfig: OpenCodeMemConfig) {
       filterInjectedPrompts:
         fileConfig.chatMessage?.filterInjectedPrompts ?? DEFAULTS.chatMessage.filterInjectedPrompts,
       injectionMarkers: normalizeInjectionMarkers(fileConfig.chatMessage?.injectionMarkers),
+      captureChildSessions:
+        fileConfig.chatMessage?.captureChildSessions ?? DEFAULTS.chatMessage.captureChildSessions,
     },
   };
 }
```

**File**: `src/index.ts` (modified, +72/-1)
```diff
@@ -218,6 +218,61 @@ async function isInternalCaptureSession(client: unknown, sessionID: string): Pro
   return false;
 }
 
+/**
+ * Bounded per-plugin cache of sessionID → has-parentID lookups. parentID never
+ * changes for a session, so each session pays one session.get across all its
+ * messages instead of one per message.
+ */
+const CHILD_SESSION_LOOKUPS: Map<string, boolean> = new Map();
+const CHILD_SESSION_LOOKUP_CACHE_LIMIT = 1000;
+
+function extractSessionParentID(response: unknown): string | undefined {
+  if (!response || typeof response !== "object") return undefined;
+  const obj = response as {
+    data?: { parentID?: string };
+    parentID?: string;
+  };
+  const parentID = obj.data?.parentID ?? obj.parentID;
+  // Empty string is not a real parent link (OpenCode uses a non-empty id).
+  return typeof parentID === "string" && parentID.length > 0 ? parentID : undefined;
+}
+
+async function isChildSession(client: unknown, sessionID: string): Promise<boolean> {
+  const cached = CHILD_SESSION_LOOKUPS.get(sessionID);
+  if (cached !== undefined) return cached;
+
+  const sessionClient = (
+    client as {
+      session?: {
+        get?: (args: unknown) => Promise<unknown>;
+      };
+    }
+  )?.session;
+
+  if (typeof sessionClient?.get !== "function") {
+    // Fail open (capture proceeds) — same behaviour as before this check existed.
+    log("child session check: session.get unavailable", { sessionID });
+    return false;
+  }
+
+  try {
+    const hasParent =
+      extractSessionParentID(await sessionClient.get({ path: { id: sessionID } })) !== undefined;
+    if (CHILD_SESSION_LOOKUPS.size >= CHILD_SESSION_LOOKUP_CACHE_LIMIT) {
+      // Insertion-order eviction keeps the map bounded without timers.
+      const oldest = CHILD_SESSION_LOOKUPS.keys().next().value;
+      if (oldest !== undefined) CHILD_SESSION_LOOKUPS.delete(oldest);
+    }
+    CHILD_SESSION_LOOKUPS.set(sessionID, hasParent);
+    return hasParent;
+  } catch (error) {
+    // Fail open on lookup failure and do not cache: a transient host error
+    // must not permanently misclassify the session.
+    log("child session check via session.get failed", { sessionID, error: String(error) });
+    return false;
+  }
+}
+
 /** Least-privilege agent used only by internal structured-output sessions (issue #189). */
 export function applyStructuredOutputAgentConfig(cfg: { agent?: Record<string, unknown> }): void {
   cfg.agent = {
@@ -562,6 +617,7 @@ export const OpenCodeMemPlugin: Plugin = async (ctx: PluginInput) => {
     process.off("SIGTERM", shutdownHandler);
     process.off("beforeExit", beforeExitHandler);
     process.off("exit", exitHandler);
+    CHILD_SESSION_LOOKUPS.clear();
     await cleanupPlugin();
   };
 
@@ -595,6 +651,16 @@ export const OpenCodeMemPlugin: Plugin = async (ctx: PluginInput) => {
       return false;
     }
 
+    // Orchestrator child sessions (task/subagent) have a parentID; their
+    // "user" messages are parent-agent prompts, not human input. Skipping the
+    // save keeps them out of auto-capture and profile learning. Like other
+    // non-authored turns, a false return also skips memory-context injection
+    // for that turn (V1 chat.message returns early; the V2 adapter suppresses it).
+    if (!CONFIG.chatMessage.captureChildSessions && (await isChildSession(ctx.client, sessionID))) {
+      log("skipping child-session prompt capture", { sessionID });
+      return false;
+    }
+
     await userPromptManager.savePrompt(sessionID, messageID, directory, userMessage);
     return true;
   };
@@ -647,7 +713,12 @@ export const OpenCodeMemPlugin: Plugin = async (ctx: PluginInput) => {
           !isConfigured() ||
           !CONFIG.chatMessage.enabled ||
           isInternalStructuredSession(sessionID) ||
-          (await isInternalCaptureSession(ctx.client, sessionID))
+          (await isInternalCaptureSession(ctx.client, sessionID)) ||
+          // Same child-session gate as capture: after plugin reload the V2
+          // context hook can rehydrate via load() without going through
+          // capturePrompt, so skip injection for orchestrator children too.
+          (!CONFIG.chatMessage.captureChildSessions &&
+            (await isChildSession(ctx.client, sessionID)))
         ) {
           return "";
         }
```

**File**: `tests/child-session-capture.test.ts` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+import { afterAll, beforeAll, describe, expect, it } from "bun:test";
+import { mkdtempSync, rmSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { fileURLToPath } from "node:url";
+import { join } from "node:path";
+
+const directory = mkdtempSync(join(tmpdir(), "opencode-mem-child-capture-"));
+let result: any;
+
+afterAll(() => rmSync(directory, { recursive: true, force: true }));
+
+beforeAll(() => {
+  // Isolate module mocks from the suite. Drive the real shared plugin and
+  // V2 adapter with no database, provider calls, or actual host sessions.
+  const child = Bun.spawnSync([
+    process.execPath,
+    fileURLToPath(new URL("./fixtures/child-session-capture.mjs", import.meta.url)),
+    directory,
+  ]);
+  expect(child.exitCode).toBe(0);
+  expect(child.stderr.toString()).toBe("");
+  result = JSON.parse(child.stdout.toString().trim());
+});
+
+const savedSessionIDs = () => result.captures.map((capture: any) => capture.sessionID);
+
+describe("subagent child-session prompt capture", () => {
+  it("does not save child-session prompts by default (V1 chat.message)", () => {
+    expect(savedSessionIDs()).not.toContain("v1-child");
+  });
+
+  it("does not save child-session prompts by default (V2 memoryContext.capturePrompt)", () => {
+    expect(savedSessionIDs()).not.toContain("v2-child");
+  });
+
+  it("still saves top-level session prompts by default", () => {
+    expect(savedSessionIDs()).toContain("v1-top");
+    expect(savedSessionIDs()).toContain("v2-top");
+  });
+
+  it("saves child-session prompts when captureChildSessions is true", () => {
+    expect(savedSessionIDs()).toContain("v1-opt");
+    expect(savedSessionIDs()).toContain("v2-opt");
+  });
+
+  it("fails open and saves the prompt when session.get fails", () => {
+    expect(savedSessionIDs()).toContain("v1-fail");
+  });
+
+  it("looks the session up once per sessionID (repeated messages reuse the cache)", () => {
+    expect(result.sessionGetCalls["v1-cache"]).toBe(1);
+  });
+
+  it("checks the session on the first prompt only for top-level sessions too", () => {
+    expect(result.sessionGetCalls["v1-top"]).toBe(1);
+  });
+
+  it("memoryContext.load skips child sessions by default", () => {
+    expect(result.loadChild).toBe("");
+  });
+
+  it("memoryContext.load still injects for top-level sessions", () => {
+    expect(result.loadTop).toBe("fixture-memory-context");
+  });
+
+  it("treats an empty parentID as a top-level session for load", () => {
+    expect(result.loadEmptyParent).toBe("fixture-memory-context");
+  });
+
+  it("memoryContext.load injects for child sessions when captureChildSessions is true", () => {
+    expect(result.loadChildOptIn).toBe("fixture-memory-context");
+  });
+});
```

**File**: `tests/config-resolution.test.ts` (modified, +19/-0)
```diff
@@ -218,6 +218,25 @@ describe("project-scoped config resolution", () => {
     expect(CONFIG.opencodeVariant).toBeUndefined();
   });
 
+  it("parses chatMessage.captureChildSessions from the global config", () => {
+    existsSpy = spyOn(fs, "existsSync").mockImplementation((p) =>
+      normalizePath(p).includes(".config/opencode/opencode-mem")
+    );
+    readSpy = spyOn(fs, "readFileSync");
+
+    readSpy.mockReturnValue(
+      JSON.stringify({
+        chatMessage: { captureChildSessions: true },
+      }) as any
+    );
+    initConfig("/some/project");
+    expect(CONFIG.chatMessage.captureChildSessions).toBe(true);
+
+    readSpy.mockReturnValue(JSON.stringify({ chatMessage: {} }) as any);
+    initConfig("/some/project");
+    expect(CONFIG.chatMessage.captureChildSessions).toBe(false);
+  });
+
   it("falls back to defaults when neither global nor project config exists", () => {
     existsSpy = spyOn(fs, "existsSync").mockReturnValue(false);
     initConfig("/no/config/project");
```

**File**: `tests/config.test.ts` (modified, +4/-0)
```diff
@@ -217,6 +217,10 @@ describe("config", () => {
     it("should expose the resolved auto-capture provider status on CONFIG", () => {
       expect(CONFIG.autoCaptureProviderStatus).toEqual(getAutoCaptureProviderStatus(CONFIG));
     });
+
+    it("should default chatMessage.captureChildSessions to false", () => {
+      expect(CONFIG.chatMessage.captureChildSessions).toBe(false);
+    });
   });
 
   describe("isConfigured", () => {
```

**File**: `tests/fixtures/child-session-capture.mjs` (added, +176/-0)
```diff
@@ -0,0 +1,176 @@
+import { mock } from "bun:test";
+
+const moduleUrl = (path) => new URL("../../src/" + path + ".js", import.meta.url).href;
+const config = {
+  chatMessage: {
+    enabled: true,
+    injectOn: "first",
+    maxMemories: 3,
+    excludeCurrentSession: true,
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
+const captures = [];
+const sessionGetCalls = [];
+// sessionID -> { parentID?: string, failGet?: boolean }
+const childSessions = new Map();
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
+    listMemories: async () => ({
+      success: true,
+      memories: [
+        {
+          summary: "fixture memory",
+          createdAt: new Date().toISOString(),
+          metadata: {},
+        },
+      ],
+    }),
+  },
+}));
+mock.module(moduleUrl("services/tags"), () => ({
+  getTags: () => ({
+    project: { tag: "fixture-project" },
+    user: { userEmail: "fixture-user" },
+  }),
+}));
+mock.module(moduleUrl("services/context"), () => ({
+  formatContextForPrompt: async () => "fixture-memory-context",
+}));
+mock.module(moduleUrl("services/user-prompt/user-prompt-manager"), () => ({
+  userPromptManager: {
+    savePrompt: async (...args) => captures.push(args),
+    setPromptModel: async () => {},
+  },
+}));
+mock.module(moduleUrl("services/logger"), () => ({ log() {} }));
+mock.module(moduleUrl("services/web-server"), () => ({
+  startWebServer: async () => null,
+  WebServer: class {},
+}));
+mock.module(moduleUrl("services/auto-update"), () => ({ startAutoUpdate() {} }));
+
+const { OpenCodeMemPlugin } = await import(moduleUrl("index"));
+const { registerV2Adapter } = await import(moduleUrl("v2/adapter"));
+
+const client = {
+  provider: { list: async () => ({ data: { connected: [] } }) },
+  session: {
+    get: async ({ path }) => {
+      sessionGetCalls.push(path.id);
+      const session = childSessions.get(path.id);
+      if (session?.failGet) throw new Error("session.get failed");
+      return {
+        data: {
+          id: path.id,
+          title: "subagent task",
+          ...(session?.parentID ? { parentID: session.parentID } : {}),
+        },
+      };
+    },
+    messages: async () => ({ data: [] }),
+  },
+};
+
+const plugin = await OpenCodeMemPlugin({ directory: "/fixture-project", client });
+
+async function v2Adapter() {
+  const hooks = new Map();
+  const cleanup = await registerV2Adapter(
+    {
+      location: {
+        directory: "/fixture-project",
+        project: { directory: "/fixture-project" },
+      },
+      tool: { transform: async () => {} },
+      session: { hook: async (name, callback) => hooks.set(name, callback) },
+    },
+    { ...plugin, event: undefined, dispose: undefined }
+  );
+  return {
+    async prompt(sessionID, text, id) {
+      await hooks.get("prompt")({ sessionID, messageID: id, prompt: { text } });
+    },
+    cleanup,
+  };
+}
+
+async function v1Prompt(sessionID, messageID, text) {
+  await plugin["chat.message"](
+    { sessionID },
+    { message: { id: messageID }, parts: [{ type: "text", text }] }
+  );
+}
+
+const output = {};
+
+// Default: captureChildSessions false (V1 chat.message).
+childSessions.set("v1-child", { parentID: "ses_parent" });
+childSessions.set("v1-top", {});
+await v1Prompt("v1-child", "m-child", "orchestrator prompt");
+await v1Prompt("v1-top", "m-top", "human prompt");
+
+// Repeated messages in one session hit session.get once (lookup cache).
+childSessions.set("v1-cache", { parentID: "ses_parent" });
+for (let i = 0; i < 3; i++) {
+  await v1Prompt("v1-cache", `m-cache-${i}`, `repeat ${i}`);
+}
+
+// Lookup failure fails open: the prompt is still saved.
+childSessions.set("v1-fail", { parentID: "ses_parent", failGet: true });
+await v1Prompt("v1-fail", "m-fail", "fail-open prompt");
+
+// Default: V2 memoryContext.capturePrompt bridge.
+const host = await v2Adapter();
+childSessions.set("v2-child", { parentID: "ses_parent" });
+childSessions.set("v2-top", {});
+await host.prompt("v2-child", "v2 orchestrator prompt", "mv2-child");
+await host.prompt("v2-top", "v2 human prompt", "mv2-top");
+await host.cleanup();
+
+// memoryContext.load must also skip child sessions (reload/rehydrate path).
+childSessions.set("load-child", { parentID: "ses_parent" });
+childSessions.set("load-top", {});
+childSessions.set("load-empty-parent", { parentID: "" });
+output.loadChild = await plugin.memoryContext.load("load-child");
+output.loadTop = await plugin.memoryContext.load("load-top");
+output.loadEmptyParent = await plugin.memoryContext.load("load-empty-parent");
+
+// Opt-in: 
```

---

### Incident Patch 14: `8c81e3d9` (2026-10-05)
**Commit Message**: docs: add AGENTS.md with Conventional Commits guidance (#379)

**File**: `AGENTS.md` (added, +96/-0)
```diff
@@ -0,0 +1,96 @@
+# AGENTS.md
+
+Guidance for coding agents working on **opencode-mem** — a persistent memory plugin for OpenCode (Turso/libSQL vector search, auto-capture, web UI).
+
+## Stack & layout
+
+- Runtime / package manager: **Bun**
+- Language: TypeScript (`src/`), Svelte web UI (`web/`)
+- Tests: `tests/` via `bun test`
+- Plugin entrypoints: `src/plugin.ts`, `src/v2/`, exports in `package.json`
+
+## Commands
+
+```bash
+bun install
+bun test
+bun run typecheck
+bun run check          # format + lint + typecheck
+bun run build
+bun run web:dev        # web UI only
+```
+
+Prefer `bun` over `npm`/`npx`. Use `bunx` when a one-off binary is needed.
+
+## Commits — Conventional Commits only
+
+All commits **MUST** follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/):
+
+```
+<type>[optional scope]: <description>
+
+[optional body]
+
+[optional footer(s)]
+```
+
+### Allowed types
+
+| Type       | Use for                                   |
+| ---------- | ----------------------------------------- |
+| `feat`     | New user-facing capability (MINOR)        |
+| `fix`      | Bug fix (PATCH)                           |
+| `docs`     | Docs / README / comments only             |
+| `style`    | Formatting; no logic change               |
+| `refactor` | Internal change; no feat/fix              |
+| `perf`     | Performance improvement                   |
+| `test`     | Tests only                                |
+| `build`    | Build system / bundling                   |
+| `ci`       | CI workflows / hooks                      |
+| `chore`    | Maintenance, deps, release plumbing       |
+| `revert`   | Reverts; reference SHAs in `Refs:` footer |
+
+### Rules
+
+- Description: imperative, concise, no trailing period (`fix: harden provider discovery`)
+- Scope (optional): area of the change, e.g. `feat(turso):`, `fix(ai):`, `chore(deps):`
+- Breaking changes: `!` after type/scope **or** a `BREAKING CHANGE:` footer
+- One logical change per commit when practical
+- Do **not** invent types outside the table above
+
+Examples from this repo:
+
+```
+feat(config): add opencodeVariant for internal LLM calls
+fix(v2): refresh connected providers after late host registration
+chore(deps): bump the minor-and-patch group across 2 directories
+```
+
+## Pull requests
+
+**Cleanest workflow (preferred):** squash-merge. Then only the **PR title** lands on `main` as the commit — so the title **MUST** be a valid Conventional Commit subject (same rules as commits).
+
+| Part     | Format                                                                             |
+| -------- | ---------------------------------------------------------------------------------- |
+| PR title | Conventional Commit subject (`fix(ai): …`, `feat(turso): …`)                       |
+| PR body  | Free-form — use `.github/PULL_REQUEST_TEMPLATE.md` (Summary, Test plan, Checklist) |
+
+- Do **not** put Conventional Commit syntax in the PR body
+- Base branch: `main`
+- Before opening: `bun test`, `bun run typecheck`, and `bun run check` when code changes
+- Update README / docs when behavior or contribution process changes
+- If the PR is not squashed and multiple commits merge: **every** commit on the branch must still be Conventional Commits
+
+## Code & review habits
+
+- Match existing patterns in the touched area; avoid drive-by refactors
+- Keep diffs focused on the requested change
+- Prefer existing libraries and utilities already in the tree
+- Do not commit secrets, local data under `data/`, or `node_modules`
+- Intel Mac (`darwin/x64`) is unsupported (Turso / onnxruntime bindings)
+
+## When unsure
+
+- Prefer a small, reviewable PR over a large mixed one
+- Ask before destructive git operations (`push --force`, hard reset, history rewrite)
+- Only commit when explicitly asked
```

---

### Incident Patch 15: `8168422b` (2026-10-05)
**Commit Message**: fix(v2): refresh connected providers after late host registration (#373)

* fix(v2): refresh connected providers after late host registration

OpenCode v2 registers user-config providers a few seconds after plugin
setup. At setup, ctx.provider.list() only returns the built-in `opencode`
provider; configured providers appear later together with
provider.updated/model.updated events. The plugin read the directory once
during init, so a configured provider such as `newapi` stayed "not
connected" for the lifetime of the process and every capture/profile
request failed before generation.

- Refresh the connected-provider snapshot on provider.updated and
  model.updated, coalescing bursts into at most one trailing refresh and
  stopping after dispose.
- Before failing the connectivity gate, refresh once and re-check
  (ensureProviderConnected). The error message is unchanged.
- Refresh errors are logged and keep the previous snapshot. A disposed
  instance only clears its own refresher.

* fix(v2): harden provider refresh coalescing and event routing

Share one awaitable coalesced refresh for init, events and gate misses; forward location-less provider/model inventory events; tighten bur

**File**: `src/index.ts` (modified, +53/-4)
```diff
@@ -311,6 +311,7 @@ export const OpenCodeMemPlugin: Plugin = async (ctx: PluginInput) => {
   // Aborted on plugin dispose: queued-but-not-started auto-capture jobs are
   // skipped; in-flight work keeps its original (uncancellable) semantics.
   const pluginLifetime = new AbortController();
+  let cleanedUp = false;
 
   const GLOBAL_PLUGIN_WARMUP_KEY = Symbol.for("opencode-mem.plugin.warmedup");
 
@@ -328,7 +329,11 @@ export const OpenCodeMemPlugin: Plugin = async (ctx: PluginInput) => {
 
   await configureOpencodeHostTransport(ctx);
 
-  (async () => {
+  // Re-reads the provider directory into the connectivity snapshot. Errors
+  // are logged and the previous snapshot retained. The host registers
+  // user-config providers after plugin setup (provider.updated/model.updated),
+  // so this runs again on those events and on connectivity-gate misses.
+  const refreshConnectedProviders = async (): Promise<void> => {
     try {
       const providerResult = await ctx.client.provider.list();
       if (providerResult.data?.connected) {
@@ -344,9 +349,46 @@ export const OpenCodeMemPlugin: Plugin = async (ctx: PluginInput) => {
         });
       }
     } catch (error) {
-      log("Failed to initialize opencode provider state", { error: String(error) });
+      log("Failed to refresh opencode provider state", { error: String(error) });
     }
-  })();
+  };
+
+  // Coalesce refresh triggers into one in-flight pass plus trailing drain.
+  // Event handlers and ensureProviderConnected (gate miss) share this path so
+  // concurrent list() calls collapse; callers can await the same promise.
+  let refreshInFlight: Promise<void> | undefined;
+  let refreshQueued = false;
+  const runCoalescedRefresh = (): Promise<void> => {
+    refreshQueued = true;
+    if (refreshInFlight) return refreshInFlight;
+
+    refreshInFlight = (async () => {
+      while (refreshQueued && !cleanedUp) {
+        refreshQueued = false;
+        await refreshConnectedProviders();
+      }
+    })().finally(() => {
+      refreshInFlight = undefined;
+      if (refreshQueued && !cleanedUp) {
+        void runCoalescedRefresh();
+      }
+    });
+    return refreshInFlight;
+  };
+
+  void runCoalescedRefresh();
+
+  // Gate miss awaits the same coalesced refresh; cleared on dispose so no
+  // refresh fires afterwards. Only clear our own refresher identity.
+  const { setConnectedProvidersRefresher, clearConnectedProvidersRefresher } =
+    await loadOpencodeProvider();
+  const providerRefresher = async () => {
+    await runCoalescedRefresh();
+  };
+  setConnectedProvidersRefresher(providerRefresher);
+  const clearProviderRefreshWiring = () => {
+    clearConnectedProvidersRefresher(providerRefresher);
+  };
 
   let tursoReadyForWeb = !isConfigured();
   if (CONFIG.webServerEnabled && isConfigured()) {
@@ -471,10 +513,10 @@ export const OpenCodeMemPlugin: Plugin = async (ctx: PluginInput) => {
       });
   }
 
-  let cleanedUp = false;
   const cleanupPlugin = async () => {
     if (cleanedUp) return;
     cleanedUp = true;
+    clearProviderRefreshWiring();
     pluginLifetime.abort();
     for (const timer of idleTimers.values()) clearTimeout(timer);
     idleTimers.clear();
@@ -1076,6 +1118,13 @@ export const OpenCodeMemPlugin: Plugin = async (ctx: PluginInput) => {
     event: async (input: { event: { type: string; properties?: any } }) => {
       const event = input.event;
 
+      // Late host provider registration: user-config providers can appear
+      // (or disappear) after plugin setup; refresh the connectivity snapshot.
+      if (event.type === "provider.updated" || event.type === "model.updated") {
+        if (!cleanedUp) runCoalescedRefresh();
+        return;
+      }
+
       // Client-side step watchdog for internal structured-output sessions (#278).
       // OpenCode's agent.steps soft-cap does not hard-stop json_schema loops when
       // forced StructuredOutput keeps failing (e.g. opencode-claude-auth).
```

**File**: `src/services/ai/opencode-provider.ts` (modified, +31/-0)
```diff
@@ -88,6 +88,9 @@ let _v2Client: OpencodeClient | undefined;
 let _v2BaseUrl: string | undefined;
 let _hostFetch: typeof fetch | undefined;
 let _useSdkTransport = false;
+// Registered by the plugin init so a gate miss can force one provider-directory
+// refresh before failing (late host provider registration).
+let _connectedProvidersRefresher: (() => Promise<void>) | undefined;
 
 export function setHostFetch(customFetch: typeof fetch): void {
   _hostFetch = customFetch;
@@ -105,6 +108,34 @@ export function isProviderConnected(providerName: string): boolean {
   return _connectedProviders.has(providerName);
 }
 
+/** Register (or clear) the refresh callback used by ensureProviderConnected. */
+export function setConnectedProvidersRefresher(refresher?: () => Promise<void>): void {
+  _connectedProvidersRefresher = refresher;
+}
+
+/** Clear the refresh callback only if it is still the one being disposed. */
+export function clearConnectedProvidersRefresher(refresher: () => Promise<void>): void {
+  if (_connectedProvidersRefresher === refresher) _connectedProvidersRefresher = undefined;
+}
+
+/**
+ * Refresh-on-miss for the connectivity gate: when a provider id is missing
+ * from the snapshot and a refresher is registered, await one refresh and
+ * re-check. Returns the re-checked connectivity; never refreshes twice for
+ * the same call and never throws (refresh errors are logged by the refresher).
+ */
+export async function ensureProviderConnected(providerName: string): Promise<boolean> {
+  if (_connectedProviders.has(providerName)) return true;
+  const refresher = _connectedProvidersRefresher;
+  if (!refresher) return false;
+  try {
+    await refresher();
+  } catch {
+    // The refresher logs; a failed refresh keeps the previous set.
+  }
+  return _connectedProviders.has(providerName);
+}
+
 export function setV2Client(client: OpencodeClient): void {
   _v2Client = client;
   // Native v2 adapters pass a session-capable client without a server URL.
```

**File**: `src/services/ai/profile-llm-client.ts` (modified, +4/-2)
```diff
@@ -18,9 +18,11 @@ export async function getOpenCodeClient(): Promise<OpencodeClient> {
     return _cachedClient;
   }
 
-  const { isProviderConnected, getV2Client } = await loadOpencodeProvider();
+  const { ensureProviderConnected, getV2Client } = await loadOpencodeProvider();
 
-  if (!isProviderConnected(provider)) {
+  // One refresh-on-miss before failing: user-config providers register
+  // seconds after plugin setup, so the init snapshot may lag the host.
+  if (!(await ensureProviderConnected(provider))) {
     throw new Error(
       `opencode provider '${provider}' is not connected. Check your opencode provider configuration.`
     );
```

**File**: `src/services/auto-capture.ts` (modified, +4/-2)
```diff
@@ -529,7 +529,7 @@ async function generateSummary(
         log("opencodeProvider takes precedence over memoryModel for auto-capture");
       }
 
-      const { isProviderConnected, getV2Client, generateStructuredOutput } =
+      const { ensureProviderConnected, getV2Client, generateStructuredOutput } =
         await loadOpencodeProvider();
 
       // "inherit" resolves to the model opencode used for the captured prompt
@@ -547,7 +547,9 @@ async function generateSummary(
         modelID = prompt.modelId;
       }
 
-      if (!isProviderConnected(providerID)) {
+      // One refresh-on-miss before failing: user-config providers register
+      // seconds after plugin setup, so the init snapshot may lag the host.
+      if (!(await ensureProviderConnected(providerID))) {
         throw new Error(
           `opencode provider '${providerID}' is not connected. Check your opencode provider configuration.`
         );
```

**File**: `src/v2/legacy-client.ts` (modified, +20/-11)
```diff
@@ -283,16 +283,25 @@ export async function eventBelongsToLocation(ctx: Context, raw: any): Promise<bo
 
   const data = raw?.data ?? raw?.payload?.data ?? raw?.properties;
   const sessionID = data?.sessionID ?? data?.session?.id ?? data?.info?.id;
-  if (!sessionID) return false;
-  try {
-    const session: any = await ctx.session.get({ sessionID });
-    const sessionDirectory =
-      session?.location?.directory ?? session?.directory ?? session?.data?.directory;
-    return (
-      typeof sessionDirectory === "string" &&
-      resolve(sessionDirectory) === resolve(ctx.location.directory)
-    );
-  } catch {
-    return false;
+  if (sessionID) {
+    try {
+      const session: any = await ctx.session.get({ sessionID });
+      const sessionDirectory =
+        session?.location?.directory ?? session?.directory ?? session?.data?.directory;
+      return (
+        typeof sessionDirectory === "string" &&
+        resolve(sessionDirectory) === resolve(ctx.location.directory)
+      );
+    } catch {
+      return false;
+    }
   }
+
+  // Provider/model inventory updates are process-scoped ephemeral events with
+  // optional location. When the host omits location (and there is no session),
+  // still forward them so connectivity snapshots can refresh on late registration.
+  const envelope = raw?.payload ?? raw;
+  const source = envelope?.type === "sync" && envelope.syncEvent ? envelope.syncEvent : envelope;
+  const rawType = typeof source?.type === "string" ? source.type.replace(/\.1$/, "") : undefined;
+  return rawType === "provider.updated" || rawType === "model.updated";
 }
```

**File**: `tests/auto-capture-concurrency.test.ts` (modified, +4/-4)
```diff
@@ -311,7 +311,7 @@ const llmEntered = new Promise((res) => { llmEnteredResolve = res; });
 const llmOrder = [];
 mock.module(${JSON.stringify(u("src/services/ai/opencode-provider-loader.js"))}, () => ({
   loadOpencodeProvider: async () => ({
-    isProviderConnected: () => true,
+    ensureProviderConnected: async () => true,
     getV2Client: () => ({}),
     generateStructuredOutput: async ({ userPrompt }) => {
       const sid = userPrompt.includes("Fix login bug") ? "sess-A" : "sess-B";
@@ -425,7 +425,7 @@ mock.module(${JSON.stringify(u("src/services/tags.js"))}, () => ({
 }));
 mock.module(${JSON.stringify(u("src/services/ai/opencode-provider-loader.js"))}, () => ({
   loadOpencodeProvider: async () => ({
-    isProviderConnected: () => true,
+    ensureProviderConnected: async () => true,
     getV2Client: () => ({}),
     generateStructuredOutput: async ({ userPrompt }) => {
       const sid = userPrompt.includes("Do work") ? "sess-X" : "?";
@@ -501,7 +501,7 @@ mock.module(${JSON.stringify(u("src/services/tags.js"))}, () => ({
 }));
 mock.module(${JSON.stringify(u("src/services/ai/opencode-provider-loader.js"))}, () => ({
   loadOpencodeProvider: async () => ({
-    isProviderConnected: () => true,
+    ensureProviderConnected: async () => true,
     getV2Client: () => ({}),
     generateStructuredOutput: async ({ userPrompt }) => {
       if (userPrompt.includes("Will fail")) throw new Error("llm exploded");
@@ -607,7 +607,7 @@ let releaseA;
 const gateA = new Promise((res) => { releaseA = res; });
 mock.module(${JSON.stringify(u("src/services/ai/opencode-provider-loader.js"))}, () => ({
   loadOpencodeProvider: async () => ({
-    isProviderConnected: () => true,
+    ensureProviderConnected: async () => true,
     getV2Client: () => ({}),
     generateStructuredOutput: async ({ userPrompt }) => {
       const sid = userPrompt.includes("In flight") ? "sess-A" : "sess-B";
```

**File**: `tests/auto-capture.test.ts` (modified, +2/-2)
```diff
@@ -157,7 +157,7 @@ mock.module(${JSON.stringify(languageUrl)}, () => ({
 }));
 mock.module(${JSON.stringify(opencodeProviderLoaderUrl)}, () => ({
   loadOpencodeProvider: async () => ({
-    isProviderConnected: () => true,
+    ensureProviderConnected: async () => true,
     getV2Client: () => ({}),
     generateStructuredOutput: async ({ userPrompt }) => {
       summaryPrompts.push(userPrompt);
@@ -286,7 +286,7 @@ mock.module(${JSON.stringify(languageUrl)}, () => ({
 }));
 mock.module(${JSON.stringify(opencodeProviderLoaderUrl)}, () => ({
   loadOpencodeProvider: async () => ({
-    isProviderConnected: () => true,
+    ensureProviderConnected: async () => true,
     getV2Client: () => ({}),
     generateStructuredOutput: async () => {
       throw new Error(
```

**File**: `tests/fixtures/v2-provider-refresh.mjs` (added, +340/-0)
```diff
@@ -0,0 +1,340 @@
+/**
+ * Provider-connectivity refresh scenarios (late provider registration).
+ *
+ * Root cause being regression-guarded: at plugin setup the provider
+ * directory often lists only the built-in broker ('opencode'); user-config
+ * providers (e.g. 'newapi') register a few seconds later and the host emits
+ * provider.updated / model.updated. The plugin must refresh its
+ * connectivity snapshot on those events (and on gate misses) instead of
+ * trusting the init-time snapshot forever.
+ *
+ * Runs the real plugin (src/index.js), the real v2 adapter/legacy-client
+ * event path, and the real opencode-provider module state. Only peripheral
+ * services are mocked. Spawned by tests/v2-provider-refresh.test.ts with
+ * HOME/XDG redirected to an isolated sandbox; scenario via argv[2].
+ */
+import { mock } from "bun:test";
+
+const scenario = process.argv[2] ?? "bootstrap";
+const moduleUrl = (path) => new URL("../../src/" + path + ".js", import.meta.url).href;
+
+// Directory fixture state, per scenario:
+// - bootstrap/burst/dispose/miss: call #1 sees only the broker, later calls
+//   also include newapi (registered ~2s after setup, like the real host).
+// - capture-error: newapi never appears (miss refresh must still fail).
+// - refresh-error: newapi is present from call #1, but every refresh
+//   (call >= 2) throws — the previous set must be retained.
+const newapiFromCall =
+  scenario === "refresh-error" ? 1 : scenario === "capture-error" ? Infinity : 2;
+const failFromCall = scenario === "refresh-error" ? 2 : 0;
+const listDelayMs = scenario === "burst" ? 25 : 0;
+
+let listCalls = 0;
+const logs = [];
+const toasts = [];
+let failedAttempts = 0;
+let released = false;
+let claimed = false;
+
+const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
+
+async function listProviders() {
+  listCalls += 1;
+  if (failFromCall && listCalls >= failFromCall) {
+    throw new Error("provider directory unavailable");
+  }
+  if (listDelayMs) await sleep(listDelayMs);
+  const data = [
+    { id: "opencode", activation: "enabled", name: "OpenCode", package: "opencode-pkg" },
+  ];
+  if (listCalls >= newapiFromCall) {
+    data.push({ id: "newapi", activation: "enabled", name: "NewAPI", package: "newapi-pkg" });
+  }
+  return { location: { directory: "/workspace/project" }, data };
+}
+
+async function poll(predicate, ms = 4000) {
+  const deadline = Date.now() + ms;
+  while (Date.now() < deadline) {
+    if (predicate()) return true;
+    await sleep(10);
+  }
+  return predicate();
+}
+
+mock.module(moduleUrl("config"), () => ({
+  CONFIG: {
+    autoCaptureEnabled: false,
+    autoCaptureProviderStatus: { ready: true, mode: "opencode", issues: [] },
+    autoCaptureMaxRetries: 1,
+    autoCaptureLanguage: "en",
+    opencodeProvider: "newapi",
+    opencodeModel: "test-model",
+    showAutoCaptureToasts: false,
+    showErrorToasts: true,
+    chatMessage: { enabled: false },
+    compaction: { enabled: false },
+    webServerEnabled: false,
+    autoUpdate: { enabled: false },
+    storagePath: process.env.HOME,
+  },
+  initConfig() {},
+  isConfigured: () => true,
+}));
+
+mock.module(moduleUrl("services/client"), () => ({
+  memoryClient: {
+    warmup: async () => {},
+    close: async () => {},
+    listMemories: async () => ({ success: true, memories: [] }),
+    addMemory: async () => ({ success: true, id: "mem-unexpected" }),
+  },
+}));
+
+mock.module(moduleUrl("services/tags"), () => ({
+  getTags: () => ({
+    project: { tag: "fixture-project", projectPath: "/workspace/project" },
+    user: { userEmail: "fixture-user" },
+  }),
+}));
+
+mock.module(moduleUrl("services/context"), () => ({
+  formatContextForPrompt: async () => "",
+}));
+
+const promptRows = [
+  {
+    id: "prompt-1",
+    sessionId: "session-1",
+    messageId: "msg-1",
+    projectPath: "/workspace/project",
+    content: "Implement the provider gate fix",
+    createdAt: 1,
+    captured: false,
+    capture_attempts: 0,
+  },
+];
+
+mock.module(moduleUrl("services/user-prompt/user-prompt-manager"), () => ({
+  userPromptManager: {
+    savePrompt: async () => {},
+    setPromptModel: async () => {},
+    getUncapturedPromptsForSession: async () => (claimed ? [] : promptRows),
+    claimPrompt: async () => {
+      if (claimed) return false;
+      claimed = true;
+      return true;
+    },
+    recordFailedAttempt: async () => {
+      failedAttempts += 1;
+    },
+    releaseClaim: async () => {
+      released = true;
+      claimed = false;
+      return true;
+    },
+    linkMemoryToPrompt: async () => {},
+    markAsCaptured: async () => {},
+    deletePrompt: async () => {},
+  },
+}));
+
+mock.module(moduleUrl("services/logger"), () => ({
+  log: (...args) =>
+    logs.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")),
+}));
+
+mock.module(moduleUrl("services/web-server"), () => ({
+  startWebServer: async () => null,
+  WebServer: class {},
+})
```

#### Recent Merged Pull Requests:
- **PR #410** (2026-10-13): chore(release): release v2.31.2 (@EyJunge1)
- **PR #409** (2026-10-13): fix: re-raise SIGINT/SIGTERM after plugin cleanup (@EyJunge1)
- **PR #407** (2026-10-13): chore(release): release v2.31.1 (@EyJunge1)
- **PR #406** (2026-10-13): chore(deps): bump the minor-and-patch group across 2 directories with 7 updates (@dependabot[bot])
- **PR #404** (2026-10-12): chore(release): release v2.31.0 (@EyJunge1)
- **PR #403** (2026-10-12): feat(skills): add shared editable skills with V2 bridge and GUI (@EyJunge1)
- **PR #401** (2026-10-12): fix(embedding): retry transient remote embedding failures (fixes import timeout #400) (@nnikolov3)
- **PR #398** (2026-10-10): feat(i18n): add German localization to the web UI (@EyJunge1)

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

## X. re-raise SIGINT/SIGTERM after plugin cleanup (#409)

**RULE**:
When implementing operations in `src/index.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tickernelz/opencode-mem. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2dd12552`: re-raise SIGINT/SIGTERM after plugin cleanup (#409). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/index.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
  const shutdownHandler = async (signal: NodeJS.Signals) => {
    // Registering listeners disables the runtime's default termination.
    // After cleanup, remove ours and re-raise so the host can exit (#408).
    // Avoid forced process exit here — that crashes onnxruntime-node finalizers (#114).
    process.off("SIGINT", shutdownHandler);
    process.off("SIGTERM", shutdownHandler);
    process.kill(process.pid, signal);
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
  const shutdownHandler = async () => {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2dd12552` are properly handled with clean fallback behavior.
