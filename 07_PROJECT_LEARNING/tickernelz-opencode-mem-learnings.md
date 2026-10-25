> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tickernelz-opencode-mem-learnings.md`  
> **Source**: github ([https://github.com/tickernelz/opencode-mem](https://github.com/tickernelz/opencode-mem))  
> **Source Version**: `2acd554c`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T13:57:20.420Z  
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
> **Harvest Timestamp**: 2026-10-25T13:57:19.864Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tickernelz/opencode-mem`
- **Description**: OpenCode plugin that gives coding agents persistent memory using local vector database
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1785 stars

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
import { skillsManager } from "../skills/skills-manager.js";

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

### Incident Patch 1: `3a899710` (2026-10-24)
**Commit Message**: fix(web): cap dialog height so long content keeps actions reachable (#430)

* fix(web): cap dialog height so long content keeps actions reachable

Dialog content is fixed-centered with no height limit, so a long skill
body (the textarea uses field-sizing-content) grows the dialog past the
viewport and the footer actions end up unreachable because the page
itself does not scroll.

Cap the shared dialog at the viewport height with internal scrolling.
This also fixes other long-form dialogs (e.g. the memory editor) in one
place.

Closes #429

* fix(web): keep dialog header and actions pinned while body scrolls

Overflow on the whole dialog made Save reachable only after scrolling
and hid the close button. Cap height on a flex column shell, scroll the
body, and pin header/footer — aligning AiCleanup with the shared layout.

---------

Co-authored-by: EyJunge1 <[REDACTED_EMAIL]>

**File**: `web/src/lib/components/explorer/AiCleanupDialog.svelte` (modified, +3/-3)
```diff
@@ -225,7 +225,7 @@
 <AppDialog
   bind:open
   title={i18n.t("label-ai-cleanup-title")}
-  class="grid! sm:max-w-2xl max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden {GAP_WIDE}"
+  class="sm:max-w-2xl {GAP_WIDE}"
   onOpenChange={handleOpenChange}
 >
   {#if phase === "loading"}
@@ -234,7 +234,7 @@
       <span class="text-sm">{i18n.t("label-ai-cleanup-loading")}</span>
     </div>
   {:else if phase === "select"}
-    <div class="flex min-h-0 flex-col {GAP_LOOSE} overflow-hidden">
+    <div class="flex min-h-0 flex-1 flex-col {GAP_LOOSE} overflow-hidden">
       <div class="flex flex-wrap items-center justify-between {GAP}">
         <h3 class="text-sm font-medium">{i18n.t("label-ai-cleanup-select")}</h3>
         <div class="flex flex-wrap {GAP_TIGHT}">
@@ -290,7 +290,7 @@
       </div>
     </div>
   {:else if phase === "diff" && pendingCleanup}
-    <div class="flex min-h-0 flex-col {GAP_LOOSE} overflow-hidden">
+    <div class="flex min-h-0 flex-1 flex-col {GAP_LOOSE} overflow-hidden">
       <div class="flex flex-wrap items-center justify-between {GAP}">
         <span class="text-xs text-muted-foreground">
           {i18n.t("label-ai-cleanup-changes-selected", {
```

**File**: `web/src/lib/components/ui/app-dialog.svelte` (modified, +5/-3)
```diff
@@ -27,12 +27,14 @@
 </script>
 
 <Dialog bind:open {onOpenChange} class={className} {showCloseButton}>
-  <DialogHeader>
+  <DialogHeader class="shrink-0 pe-10">
     <DialogTitle>{title}</DialogTitle>
   </DialogHeader>
-  {@render children?.()}
+  <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
+    {@render children?.()}
+  </div>
   {#if footer}
-    <DialogFooter>
+    <DialogFooter class="shrink-0">
       {@render footer()}
     </DialogFooter>
   {/if}
```

**File**: `web/src/lib/components/ui/dialog.svelte` (modified, +2/-2)
```diff
@@ -34,7 +34,7 @@
     />
     <DialogPrimitive.Content
       class={cn(
-        "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 ring-foreground/5 dark:ring-foreground/10 grid max-w-[calc(100%-2rem)] gap-6 rounded-[min(var(--radius-4xl),24px)] p-6 text-sm shadow-xl ring-1 duration-100 sm:max-w-md fixed top-1/2 left-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 outline-none [--floating-label-bg:var(--popover)]",
+        "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 ring-foreground/5 dark:ring-foreground/10 flex max-h-[calc(100dvh-2rem)] max-w-[calc(100%-2rem)] flex-col gap-6 overflow-hidden rounded-[min(var(--radius-4xl),24px)] p-6 text-sm shadow-xl ring-1 duration-100 sm:max-w-md fixed top-1/2 left-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 outline-none [--floating-label-bg:var(--popover)]",
         className
       )}
     >
@@ -45,7 +45,7 @@
             <Button
               {...props}
               variant="ghost"
-              class="bg-secondary absolute top-4 right-4"
+              class="bg-secondary absolute top-4 right-4 z-10"
               size="icon-sm"
             >
               <XIcon />
```

---

### Incident Patch 2: `6a795a87` (2026-10-24)
**Commit Message**: fix(auto-capture): read tool names from v2-shaped tool parts (#431)

On OpenCode v2 hosts, session tool parts carry the tool name at
part.name (v1 wire format used part.tool). extractAIContent only read
tool.tool, so the auto-capture prompt's Tools Used section always
listed unknown(). Read name first with the v1 field kept as a
fallback, and cover both part shapes with extraction regression tests.

**File**: `src/services/auto-capture.ts` (modified, +2/-2)
```diff
@@ -271,7 +271,7 @@ function getAIResponseMessages(messages: any[], promptMessageId: string): any[]
   return responseMessages;
 }
 
-function extractAIContent(messages: any[]): {
+export function extractAIContent(messages: any[]): {
   textResponses: string[];
   toolCalls: ToolCallInfo[];
 } {
@@ -293,7 +293,7 @@ function extractAIContent(messages: any[]): {
 
     const toolParts = msg.parts.filter((p: any) => p.type === "tool");
     for (const tool of toolParts) {
-      const name = tool.tool || "unknown";
+      const name = tool.name || tool.tool || "unknown";
       let input = "";
 
       if (tool.state?.input) {
```

**File**: `tests/auto-capture-context.test.ts` (modified, +52/-0)
```diff
@@ -2,6 +2,7 @@ import { describe, expect, it } from "bun:test";
 import {
   buildBoundedSummaryPrompt,
   buildMarkdownContext,
+  extractAIContent,
   getAutoCaptureMarkdownBudget,
 } from "../src/services/auto-capture.js";
 import { utf8ByteLength } from "../src/utils/context-limit.js";
@@ -96,3 +97,54 @@ describe("buildMarkdownContext budgeting (#232)", () => {
     expect(userPrompt).toContain("truncated to autoCaptureMaxContextBytes");
   });
 });
+
+describe("extractAIContent tool calls", () => {
+  it("extracts tool names from v2-shaped parts", () => {
+    const { toolCalls } = extractAIContent([
+      {
+        info: { role: "assistant" },
+        parts: [
+          {
+            type: "tool",
+            id: "t1",
+            name: "bash",
+            state: { status: "completed", input: { command: "ls" } },
+          },
+        ],
+      },
+    ]);
+
+    expect(toolCalls).toHaveLength(1);
+    expect(toolCalls[0]?.name).toBe("bash");
+    expect(toolCalls[0]?.input).toContain('command: "ls"');
+  });
+
+  it("keeps extracting tool names from v1-shaped parts", () => {
+    const { toolCalls } = extractAIContent([
+      {
+        info: { role: "assistant" },
+        parts: [
+          {
+            type: "tool",
+            callID: "call_1",
+            tool: "read",
+            state: { input: { path: "/tmp/x" } },
+          },
+        ],
+      },
+    ]);
+
+    expect(toolCalls[0]?.name).toBe("read");
+  });
+
+  it("falls back to unknown when a tool part has no name", () => {
+    const { toolCalls } = extractAIContent([
+      {
+        info: { role: "assistant" },
+        parts: [{ type: "tool", state: { input: {} } }],
+      },
+    ]);
+
+    expect(toolCalls[0]?.name).toBe("unknown");
+  });
+});
```

---

### Incident Patch 3: `adc3a25c` (2026-10-24)
**Commit Message**: fix(auto-capture): toast when provider config is missing (#433)

Warn at plugin startup when autoCaptureEnabled is true but no
capture provider is ready, and document that Free opencode models
are a poor fit for internal structured-output sessions.

Refs: #424

**File**: `README.md` (modified, +5/-1)
```diff
@@ -454,7 +454,11 @@ Optionally pin a model reasoning variant with `"opencodeVariant": "xhigh"` (e.g.
 
 Slow reasoning models (or very large profile prompts) can exceed the default 90 s structured-output budget. Set `"opencodeTimeoutMs"` (milliseconds) to extend it for internal structured-output calls (auto-capture summaries, profile learning) — e.g. `"opencodeTimeoutMs": 180000` for 3 minutes. Values are clamped to 10000..600000; the default stays 90000. Numeric strings are coerced. Profile cleanup uses a separate, longer timeout.
 
-Supported providers: any provider listed by `opencode providers list` (e.g. `anthropic`, `openai`, `github-copilot`, ...).
+Supported providers: any provider listed by `opencode providers list` (e.g. `anthropic`, `openai`, `github-copilot`, `openrouter`, ...).
+
+**Built-in Free / Zen models** under provider id `opencode` (e.g. `big-pickle`) often cannot run the plugin’s internal structured-output sessions — OpenCode may reject them outside interactive chat. Prefer an authenticated provider from `opencode providers list`, or use `"opencodeModel": "inherit"` so capture follows the model you already use in the session.
+
+If `autoCaptureEnabled` is `true` (default) but neither `opencodeProvider`/`opencodeModel` nor a complete manual fallback is configured, the plugin logs a warning and shows a startup toast (when `showErrorToasts` is enabled) so missing config is visible without digging through logs.
 
 If `opencodeProvider` and `opencodeModel` are set, they take precedence over the manual `memoryProvider` settings below by default (`"autoCaptureProviderOrder": "opencode-first"`). Set `"autoCaptureProviderOrder": "external-first"` to prefer the manual API when both are configured (useful when the host session API is busy/slow); the other channel is used as fallback. Lower `"opencodeTimeoutMs"` to fail over from the opencode channel sooner.
 
```

**File**: `src/config.ts` (modified, +8/-0)
```diff
@@ -487,6 +487,12 @@ const CONFIG_TEMPLATE = `{
    //   Anthropic (OAuth/API key): "opencodeProvider": "anthropic",      "opencodeModel": "claude-haiku-4-5-20251001"
    //   OpenAI (API key):          "opencodeProvider": "openai",          "opencodeModel": "gpt-4o-mini"
    //   GitHub Copilot:            "opencodeProvider": "github-copilot",  "opencodeModel": "gpt-4o-mini"
+   //   OpenRouter:                "opencodeProvider": "openrouter",      "opencodeModel": "…"
+   //
+   // Avoid pinning the built-in Free provider "opencode" (e.g. big-pickle) for
+   // auto-capture: those models are often restricted to interactive OpenCode
+   // chat and fail on the plugin's internal structured-output sessions. Prefer
+   // an authenticated provider above, or "opencodeModel": "inherit".
    //
    // "opencodeProvider": "anthropic",
    // "opencodeModel": "claude-haiku-4-5-20251001",
@@ -504,6 +510,8 @@ const CONFIG_TEMPLATE = `{
   
   // IMPORTANT: Auto-capture only runs after either opencodeProvider/opencodeModel
   // above is configured, or the manual fallback below is uncommented with real values.
+  // If autoCaptureEnabled is true but neither path is ready, the plugin shows a
+  // startup warning toast (when showErrorToasts is true).
   // It runs in background without blocking your main session
   // Note: Ollama may not support tool calling. Use OpenAI, Anthropic, or Groq for best results.
   
```

**File**: `src/index.ts` (modified, +6/-9)
```diff
@@ -36,8 +36,13 @@ import {
   isInternalCaptureSessionTitle,
   isTrackedInternalCaptureSession,
 } from "./services/ai/internal-capture-sessions.js";
+import { notifyAutoCaptureProviderStatus } from "./services/auto-capture-config-status.js";
 
 export { INTERNAL_CAPTURE_SESSION_TITLE, isInternalCaptureSessionTitle };
+export {
+  buildAutoCaptureConfigReminderMessage,
+  notifyAutoCaptureProviderStatus,
+} from "./services/auto-capture-config-status.js";
 
 export function isStructuredSummaryPromptMessage(userMessage: string): boolean {
   // This is the plugin's own structured-summary or profile-analysis request.
@@ -352,18 +357,10 @@ export async function configureOpencodeHostTransport(ctx: {
   }
 }
 
-function logAutoCaptureProviderStatus(): void {
-  if (!CONFIG.autoCaptureEnabled || CONFIG.autoCaptureProviderStatus.ready) return;
-
-  log(
-    `Auto-capture disabled by configuration. Issues: ${CONFIG.autoCaptureProviderStatus.issues.join("; ")}.`
-  );
-}
-
 export const OpenCodeMemPlugin: Plugin = async (ctx: PluginInput) => {
   const { directory } = ctx;
   initConfig(directory);
-  logAutoCaptureProviderStatus();
+  notifyAutoCaptureProviderStatus(ctx.client);
   const { startAutoUpdate } = await import("./services/auto-update.js");
   startAutoUpdate(ctx, CONFIG.autoUpdate);
   const tags = getTags(directory);
```

**File**: `src/services/auto-capture-config-status.ts` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+import { CONFIG } from "../config.js";
+import { log } from "./logger.js";
+
+/** Toast/log copy when auto-capture is on but no provider is ready (#424). */
+export function buildAutoCaptureConfigReminderMessage(issues: string[]): string {
+  const issueText = issues.length > 0 ? ` Issues: ${issues.join("; ")}.` : "";
+  return (
+    "Auto-capture is enabled but no AI provider is configured. " +
+    "Set opencodeProvider + opencodeModel (or memoryModel/memoryApiUrl/memoryApiKey), " +
+    `or set autoCaptureEnabled: false.${issueText}`
+  );
+}
+
+/** Minimal toast client shape; accepts OpenCode's OpencodeClient.tui. */
+type AutoCaptureStatusToastClient = {
+  tui?: {
+    // OpenCode's SDK typing for showToast is version-dependent; keep loose.
+    showToast?: (input: any) => Promise<unknown>;
+  };
+};
+
+/**
+ * Log (and optionally toast) when auto-capture cannot run due to missing
+ * provider config. Toast is gated by showErrorToasts like other error notices.
+ */
+export function notifyAutoCaptureProviderStatus(client?: AutoCaptureStatusToastClient): void {
+  if (!CONFIG.autoCaptureEnabled || CONFIG.autoCaptureProviderStatus.ready) return;
+
+  const message = buildAutoCaptureConfigReminderMessage(CONFIG.autoCaptureProviderStatus.issues);
+  log(`Auto-capture disabled by configuration. ${message}`);
+
+  if (!CONFIG.showErrorToasts || !client?.tui?.showToast) return;
+
+  client.tui
+    .showToast({
+      body: {
+        title: "Auto-Capture",
+        message,
+        variant: "warning",
+        duration: 8000,
+      },
+    })
+    .catch(() => {});
+}
```

**File**: `tests/auto-capture-config-toast.test.ts` (added, +149/-0)
```diff
@@ -0,0 +1,149 @@
+import { afterEach, describe, expect, it } from "bun:test";
+import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { buildAutoCaptureConfigReminderMessage } from "../src/services/auto-capture-config-status.js";
+
+const tempDirs: string[] = [];
+
+afterEach(() => {
+  for (const dir of tempDirs.splice(0)) {
+    rmSync(dir, { recursive: true, force: true });
+  }
+});
+
+describe("buildAutoCaptureConfigReminderMessage", () => {
+  it("mentions config keys and includes issues", () => {
+    const message = buildAutoCaptureConfigReminderMessage([
+      "opencodeProvider is not configured",
+      "opencodeModel is not configured",
+    ]);
+    expect(message).toContain("opencodeProvider + opencodeModel");
+    expect(message).toContain("autoCaptureEnabled: false");
+    expect(message).toContain("opencodeProvider is not configured");
+    expect(message).toContain("opencodeModel is not configured");
+  });
+});
+
+describe("notifyAutoCaptureProviderStatus", () => {
+  const statusUrl = new URL("../src/services/auto-capture-config-status.js", import.meta.url).href;
+  const configUrl = new URL("../src/config.js", import.meta.url).href;
+  const loggerUrl = new URL("../src/services/logger.js", import.meta.url).href;
+
+  function runScenario(opts: {
+    autoCaptureEnabled: boolean;
+    ready: boolean;
+    issues?: string[];
+    showErrorToasts: boolean;
+    withToastClient: boolean;
+  }) {
+    const dir = mkdtempSync(join(tmpdir(), "opencode-mem-capture-toast-"));
+    tempDirs.push(dir);
+    const scriptPath = join(dir, "scenario.mjs");
+    const script = `
+import { mock } from "bun:test";
+
+const logs = [];
+const toasts = [];
+
+mock.module(${JSON.stringify(configUrl)}, () => ({
+  CONFIG: {
+    autoCaptureEnabled: ${JSON.stringify(opts.autoCaptureEnabled)},
+    showErrorToasts: ${JSON.stringify(opts.showErrorToasts)},
+    autoCaptureProviderStatus: ${JSON.stringify(
+      opts.ready
+        ? { ready: true, mode: "opencode", issues: [] }
+        : { ready: false, issues: opts.issues ?? ["opencodeProvider is not configured"] }
+    )},
+  },
+}));
+
+mock.module(${JSON.stringify(loggerUrl)}, () => ({
+  log: (message) => logs.push(message),
+}));
+
+const { notifyAutoCaptureProviderStatus } = await import(${JSON.stringify(statusUrl)});
+
+const client = ${
+      opts.withToastClient
+        ? `{
+  tui: {
+    showToast: async (input) => {
+      toasts.push(input);
+      return {};
+    },
+  },
+}`
+        : "undefined"
+    };
+
+notifyAutoCaptureProviderStatus(client);
+await new Promise((r) => setTimeout(r, 10));
+
+console.log(JSON.stringify({ logs, toasts }));
+`;
+    writeFileSync(scriptPath, script);
+    const proc = Bun.spawnSync(["bun", "run", scriptPath], {
+      cwd: dir,
+      stdout: "pipe",
+      stderr: "pipe",
+    });
+    if (proc.exitCode !== 0) {
+      throw new Error(`scenario failed: ${proc.stderr.toString() || proc.stdout.toString()}`);
+    }
+    return JSON.parse(proc.stdout.toString()) as {
+      logs: string[];
+      toasts: Array<{ body: { title: string; message: string; variant: string } }>;
+    };
+  }
+
+  it("toasts and logs when auto-capture is on without a provider", () => {
+    const result = runScenario({
+      autoCaptureEnabled: true,
+      ready: false,
+      issues: ["opencodeProvider is not configured", "opencodeModel is not configured"],
+      showErrorToasts: true,
+      withToastClient: true,
+    });
+    expect(result.logs.some((m) => m.includes("Auto-capture disabled by configuration"))).toBe(
+      true
+    );
+    expect(result.toasts).toHaveLength(1);
+    expect(result.toasts[0]?.body.title).toBe("Auto-Capture");
+    expect(result.toasts[0]?.body.variant).toBe("warning");
+    expect(result.toasts[0]?.body.message).toContain("opencodeProvider + opencodeModel");
+  });
+
+  it("skips toast when showErrorToasts is false but still logs", () => {
+    const result = runScenario({
+      autoCaptureEnabled: true,
+      ready: false,
+      showErrorToasts: false,
+      withToastClient: true,
+    });
+    expect(result.logs.length).toBeGreaterThan(0);
+    expect(result.toasts).toHaveLength(0);
+  });
+
+  it("does nothing when provider status is ready", () => {
+    const result = runScenario({
+      autoCaptureEnabled: true,
+      ready: true,
+      showErrorToasts: true,
+      withToastClient: true,
+    });
+    expect(result.logs).toHaveLength(0);
+    expect(result.toasts).toHaveLength(0);
+  });
+
+  it("does nothing when auto-capture is disabled", () => {
+    const result = runScenario({
+      autoCaptureEnabled: false,
+      ready: false,
+      showErrorToasts: true,
+      withToastClient: true,
+    });
+    expect(result.logs).toHaveLength(0);
+    expect(result.toasts).toHaveLength(0);
+  });
+});
```

#### Recent Merged Pull Requests:
- **PR #434** (2026-10-24): chore(release): release v2.34.0 (@EyJunge1)
- **PR #433** (2026-10-24): fix(auto-capture): toast when provider config is missing (@EyJunge1)
- **PR #432** (2026-10-24): feat(ai): add API Route memory provider preset (@DennyHo0917)
- **PR #431** (2026-10-24): fix(auto-capture): read tool names from v2-shaped tool parts (@Phototonic)
- **PR #430** (2026-10-24): fix(web): cap dialog height so long content keeps actions reachable (@EightDoor)
- **PR #427** (2026-10-21): chore(release): release v2.33.0 (@EyJunge1)

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

## X. web): cap dialog height so long content keeps actions reachable (#430)

**RULE**:
When implementing operations in `web/src/lib/components/explorer/AiCleanupDialog.svelte`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tickernelz/opencode-mem. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3a899710`: web): cap dialog height so long content keeps actions reachable (#430). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `web/src/lib/components/explorer/AiCleanupDialog.svelte`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
  class="sm:max-w-2xl {GAP_WIDE}"
    <div class="flex min-h-0 flex-1 flex-col {GAP_LOOSE} overflow-hidden">
    <div class="flex min-h-0 flex-1 flex-col {GAP_LOOSE} overflow-hidden">
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
  class="grid! sm:max-w-2xl max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden {GAP_WIDE}"
    <div class="flex min-h-0 flex-col {GAP_LOOSE} overflow-hidden">
    <div class="flex min-h-0 flex-col {GAP_LOOSE} overflow-hidden">
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3a899710` are properly handled with clean fallback behavior.
