# Forensic Learning Record (Deep Inspection): MemTensor/MemOS

> **Canonical Artifact**: `07_PROJECT_LEARNING/memtensor-memos-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MemTensor/MemOS](https://github.com/MemTensor/MemOS))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:09:49.379Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MemTensor/MemOS`
- **Description**: Self-evolving memory OS for LLM & AI Agents: ultra-persistent memory, hybrid-retrieval, and cross-task skill reuse, with 35.24% token savings and DeepSeek Harness support.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 11710 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/memos-local-openclaw/src/ingest/worker.ts`
```
import { v4 as uuid } from "uuid";
import { createHash } from "crypto";
import type { ConversationMessage, Chunk, PluginContext } from "../types";
import type { SqliteStore } from "../storage/sqlite";
import type { Embedder } from "../embedding";
import { Summarizer } from "./providers";
import { findDuplicate, findTopSimilar } from "./dedup";
import { TaskProcessor } from "./task-processor";

export class IngestWorker {
  private summarizer: Summarizer;
  private taskProcessor: TaskProcessor;
  private queue: ConversationMessage[] = [];
  private processing = false;
  private flushResolvers: Array<() => void> = [];

  constructor(
    private store: SqliteStore,
    private embedder: Embedder,
    private ctx: PluginContext,
  ) {
    this.summarizer = new Summarizer(ctx.config.summarizer, ctx.log);
    this.taskProcessor = new TaskProcessor(store, ctx);
  }

  getTaskProcessor(): TaskProcessor { return this.taskProcessor; }

  private static isEphemeralSession(sessionKey: string): boolean {
    return sessionKey.startsWith("temp:") || sessionKey.startsWith("internal:") || sessionKey.startsWith("system:");
  }

  enqueue(messages: ConversationMessage[]): void {
    const filtered = messages.filter((m) => !IngestWorker.isEphemeralSession(m.sessionKey));
    if (filtered.length === 0) return;
    this.queue.push(...filtered);
    if (!this.processing) {
      this.processQueue().catch((err) => {
        this.ctx.log.error(`Ingest worker error: ${err}`);
        this.processing = false;
      });
    }
  }

  /** Wait until all queued messages have been processed. */
  async flush(): Promise<void> {
    if (this.queue.length === 0 && !this.processing) return;
    return new Promise((resolve) => {
      this.flushResolvers.push(resolve);
    });
  }

  private async processQueue(): Promise<void> {
    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const t0 = performance.now();
        const batchSize = this.queue.length;
        let lastSessionKey: string | undefined;
        let lastOwner: string | undefined;
        let lastTimestamp = 0;
        let stored = 0;
        let skipped = 0;
        let merged = 0;
        let duplicated = 0;
        let errors = 0;
        const resultLines: string[] = [];
        const inputDetails: Array<{ role: string; content: string }> = [];

        while (this.queue.length > 0) {
          const msg = this.queue.shift()!;
          inputDetails.push({ role: msg.role, content: msg.content });
          try {
            const result = await this.ingestMessage(msg);
            lastSessionKey = msg.sessionKey;
            lastOwner = msg.owner ?? "agent:main";
            lastTimestamp = Math.max(lastTimestamp, msg.timestamp);
            if (result === "skipped") {
              skipped++;
              resultLines.push(JSON.stringify({ role: msg.role, action: "exact-dup", summary: "", content: msg.content }));
            } else if (result.action === "stored") {
              stored++;
              resultLines.push(JSON.stringify({ role: msg.role, action: "stored", summary: result.summary ?? "", content: msg.content }));
            } else if (result.action === "duplicate") {
              duplicated++;
              resultLines.push(JSON.stringify({ role: msg.role, action: "dedup", reason: result.reason ?? "similar", summary: result.summary ?? "", content: msg.content }));
            } else if (result.action === "merged") {
              merged++;
              resultLines.push(JSON.stringify({ role: msg.role, action: "merged", summary: result.summary ?? "", content: msg.content }));
            }
          } catch (err) {
            errors++;
            resultLines.push(JSON.stringify({ role: msg.role, action: "error", summary: "", content: msg.content }));
            this.ctx.log.error(`Failed to ingest message turn=${msg.turnId}: ${err}`);
          }
        }

        const dur = performance.now() - t0;

        if (stored + merged > 0 || skipped > 0 || duplicated > 0) {
          this.store.recordToolCall("memory_add", dur, errors === 0);
          try {
            const inputInfo = {
              session: lastSessionKey,
              messages: batchSize,
              details: inputDetails,
            };
            const stats = [`stored=${stored}`, skipped > 0 ? `skipped=${skipped}` : null, duplicated > 0 ? `dedup=${duplicated}` : null, merged > 0 ? `merged=${merged}` : null, errors > 0 ? `errors=${errors}` : null].filter(Boolean).join(", ");
            this.store.recordApiLog("memory_add", inputInfo, `${stats}\n${resultLines.join("\n")}`, dur, errors === 0);
          } catch (_) { /* best-effort */ }
        }

        if (lastSessionKey) {
          this.ctx.log.debug(`Calling TaskProcessor.onChunksIngested session=${lastSessionKey} ts=${lastTimestamp} owner=${lastOwner}`);
          try {
            await this.taskProcessor.onChunksIngested(lastSessionKey, lastTimestamp, lastOwner);
          } catch (err) {
            this.ctx.log.error(`TaskProcessor post-ingest error: ${err}`);
          }
        }
      }
    } finally {
      this.processing = false;
      for (const resolve of this.flushResolvers) resolve();
      this.flushResolvers = [];
    }
  }

  private async ingestMessage(msg: ConversationMessage): Promise<
    "skipped" | { action: "stored" | "duplicate" | "merged"; summary?: string; reason?: string }
  > {
    return await this.storeChunk(msg, msg.content, "paragraph", 0);
  }

  private async storeChunk(
    msg: ConversationMessage,
    content: string,
    kind: Chunk["kind"],
    seq: number,
  ): Promise<{ action: "stored" | "duplicate" | "merged"; chunkId?: string; summary?: string; targetChunkId?: string; reason?: string }> {
    const chunkId = uuid();
    let summary = await this.summarizer.summarize(content);

    let embedding: number[] | null = null;
    try {
      [embedding] = await this.embedder.embed([summary]);
    } catch (err) {
      this.ctx.log.warn(`Embedding failed for chunk=${chunkId}, storing without vector: ${err}`);
    }

    let dedupStatus: "active" | "duplicate" | "merged" = "active";
    let dedupTarget: string | null = null;
    let dedupReason: string | null = null;
    let mergedFromOld: string | null = null;
    let mergeCount = 0;
    let mergeHistory = "[]";

    // Fast path: exact content_hash match within same owner (agent dimension)
    // Strategy: retire the OLD chunk, keep the NEW one active (latest wins)
    const chunkOwner = msg.owner ?? "agent:main";
    const existingByHash = this.store.findActiveChunkByHash(content, chunkOwner);
    if (existingByHash) {
      this.ctx.log.debug(`Exact-dup (owner=${chunkOwner}): hash match → retiring old=${existingByHash}, keeping new=${chunkId}`);
      this.store.recordMergeHit(existingByHash, "DUPLICATE", "exact content hash match");
      const oldChunk = this.store.getChunk(existingByHash);
      this.store.markDedupStatus(existingByHash, "duplicate", chunkId, "exact content hash match");
      this.store.deleteEmbedding(existingByHash);
      mergedFromOld = existingByHash;
      dedupReason = "exact content hash match";
      if (oldChunk) {
        const oldHistory = JSON.parse(oldChunk.mergeHistory || "[]");
        oldHistory.push({ action: "duplicate_superseded", at: Date.now(), reason: "exact content hash match", sourceChunkId: existingByHash });
        mergeHistory = JSON.stringify(oldHistory);
        mergeCount = (oldChunk.mergeCount || 0) + 1;
      }
    }

    // Smart dedup: find Top-5 similar chunks, then ask LLM to judge
    if (dedupStatus === "active" && embedding) {
      const similarThreshold = this.ctx.config.dedup?.similarityThreshold ?? 0.80;
      const dedupOwnerFilter = msg.owner ? [msg.owner] : undefined;
      const topSimilar = findTopSimilar(this.store, embedding, similarThreshold, 5, this.ctx.log, dedupOwnerFilter);

      if (topSimilar.length > 0) {
        const candidates = topSimilar.map((s, i) => {
          const chunk = this.store.getChunk(s.chunkId);
          return {
            index: i + 1,
            summary: chunk?.summary ?? "",
            chunkId: s.chunkId,
            role: chunk?.role,
          };
        }).filter(c => c.summary && c.role === msg.role);

        if (candidates.length > 0) {
          const dedupResult = await this.summarizer.judgeDedup(summary, candidates);

          if (dedupResult && dedupResult.action === "DUPLICATE" && dedupResult.targetIndex) {
            const targetChunkId = candidates[dedupResult.targetIndex - 1]?.chunkId;
            if (targetChunkId) {
              this.store.recordMergeHit(targetChunkId, "DUPLICATE", dedupResult.reason);
              const oldChunk = this.store.getChunk(targetChunkId);
              this.store.markDedupStatus(targetChunkId, "duplicate", chunkId, dedupResult.reason);
              this.store.deleteEmbedding(targetChunkId);
              mergedFromOld = targetChunkId;
              dedupReason = dedupResult.reason;
              if (oldChunk) {
                const oldHistory = JSON.parse(oldChunk.mergeHistory || "[]");
                oldHistory.push({ action: "duplicate_superseded", at: Date.now(), reason: dedupResult.reason, sourceChunkId: targetChunkId });
                mergeHistory = JSON.stringify(oldHistory);
                mergeCount = (oldChunk.mergeCount || 0) + 1;
              }
              this.ctx.log.debug(`Smart dedup: DUPLICATE → retiring old=${targetChunkId}, keeping new=${chunkId} active, reason: ${dedupResult.reason}`);
            }
          }

          if (dedupStatus === "active" && dedupResult && dedupResult.action === "UPDATE" && dedupResult.targetIndex && dedupResult.mergedSummary) {
            const targetChunkId = candidates[dedupResult.targetIndex - 1]?.chunkId;
            if (targetChunkId) {
              const oldChunk = this.store.getChunk(targetChunkId);
              const oldSummary = oldChunk?.summary ?? "";
              this.store.recordMer
```

### Core Architecture Module: `apps/memos-local-openclaw/src/path-utils.ts`
```
/**
 * Path comparison helpers shared by the plugin runtime.
 *
 * Why a dedicated module:
 *   - The plugin's `register()` closure used to inline these helpers, which
 *     made them invisible to unit tests and let a Windows-specific path
 *     bug (`/C:/Users/...` URL-pathname form, `\\?\UNC\…` long-path prefix,
 *     mixed slash directions) trip the better-sqlite3 sandbox guard and
 *     refuse to load a perfectly valid native binding.
 *   - Extracting them here lets `tests/path-utils.test.ts` exercise every
 *     known Windows path shape from a Linux CI box by stubbing
 *     `process.platform` between cases.
 *
 * Cross-reference: `scripts/postinstall.cjs` keeps its own
 * `normalizePathForMatch` helper because it runs as CommonJS before the
 * plugin loads. Keep the two in sync if either side changes semantics.
 */

import * as path from "path";

const isWin = process.platform === "win32";
const platformPath = isWin ? path.win32 : path.posix;

/**
 * Canonicalise an absolute filesystem path so two callers can compare
 * paths without tripping on platform-specific quirks.
 *
 * On Windows the function:
 *   1. strips a leading slash that precedes a drive letter
 *      (`/C:/Users/...` → `C:/Users/...`), which is the shape
 *      `new URL(import.meta.url).pathname` returns on Node ≤ 22;
 *   2. unwraps the `\\?\UNC\server\share` extended UNC prefix into
 *      `\\server\share`;
 *   3. strips the plain `\\?\` long-path prefix;
 *   4. resolves to an absolute path with native separators;
 *   5. converts all `\` to `/`;
 *   6. lower-cases the result (Windows paths are case-insensitive).
 *
 * On POSIX the function resolves the path, swaps backslashes to forward
 * slashes (a no-op for legal POSIX paths), and returns it unchanged.
 * The case is preserved so callers do not silently mismatch on
 * case-sensitive filesystems.
 */
export function normalizeFsPath(p: string): string {
  let s = p;

  // 1. URL pathname form: `/C:/Users/...` → `C:/Users/...`.
  //    Only fires when the next two chars are a drive letter + `:`
  //    followed by a separator. POSIX absolute paths like
  //    `/home/user/...` are untouched.
  s = s.replace(/^\/(?=[A-Za-z]:[\\/])/, "");

  // 2. Extended UNC: `\\?\UNC\server\share` → `\\server\share`.
  //    The leading `\\` is preserved so step 4 still sees a UNC path.
  s = s.replace(/^\\\\\?\\UNC\\/i, "\\\\");

  // 3. Plain extended-length prefix: `\\?\C:\Users\...` → `C:\Users\...`.
  s = s.replace(/^\\\\\?\\/, "");

  // 4. Resolve to absolute form using the platform-appropriate flavour.
  //    Using the platform-specific module (rather than the default `path`)
  //    keeps the tests deterministic on Linux CI when we stub
  //    `process.platform`.
  s = platformPath.resolve(s);

  // 5. Unify separators.
  s = s.replace(/\\/g, "/");

  // 6. Lower-case only on Windows.
  if (isWin) s = s.toLowerCase();

  return s;
}

/**
 * Return `true` iff `targetPath` is the same directory as `baseDir`
 * or one of its descendants. Both inputs are normalised through
 * `normalizeFsPath` first; the relative computation is then done in
 * POSIX form so the answer does not depend on platform separators.
 *
 * Behaviour for edge cases:
 *   - same directory                                → `true`
 *   - descendant (`base/sub/file`)                  → `true`
 *   - sibling (`base/../other/file`)                → `false`
 *   - parent (`base/..`)                            → `false`
 *   - different drive on Windows (`D:\…` vs `C:\…`) → `false`
 */
export function isPathInside(baseDir: string, targetPath: string): boolean {
  const base = normalizeFsPath(baseDir);
  const target = normalizeFsPath(targetPath);
  const rel = path.posix.relative(base, target);
  if (rel === "") return true;
  if (rel === ".." || rel.startsWith("../")) return false;
  if (path.posix.isAbsolute(rel)) return false;
  return true;
}

```

### Core Architecture Module: `apps/memos-local-openclaw/src/recall/engine.ts`
```
import type { SqliteStore } from "../storage/sqlite";
import type { Embedder } from "../embedding";
import type { PluginContext, SearchHit, SearchResult, SkillSearchHit, Skill } from "../types";
import { vectorSearch, cosineSimilarity } from "../storage/vector";
import { rrfFuse } from "./rrf";
import { mmrRerank } from "./mmr";
import { applyRecencyDecay } from "./recency";
import { Summarizer } from "../ingest/providers";

export type SkillSearchScope = "mix" | "self" | "public";

export interface RecallOptions {
  query?: string;
  maxResults?: number;
  minScore?: number;
  role?: string;
  ownerFilter?: string[];
  /**
   * If set, chunks whose `sessionKey` equals this value are filtered out at the
   * SQL layer (FTS, vector, pattern) before fusion. Use this to suppress recall
   * of the **current** conversation session so the model doesn't waste tokens
   * on its own recent turns. Hub-memory hits are not affected by this filter
   * because they represent cross-user shared knowledge keyed by a synthetic
   * `sessionKey` (`hub-shared:<userId>`).
   */
  excludeSessionKey?: string;
}

const MAX_RECENT_QUERIES = 20;

export class RecallEngine {
  private recentQueries: Array<{ query: string; maxResults: number; minScore: number; hitCount: number }> = [];

  constructor(
    private store: SqliteStore,
    private embedder: Embedder,
    private ctx: PluginContext,
  ) {}

  async search(opts: RecallOptions): Promise<SearchResult> {
    const recallCfg = this.ctx.config.recall!;
    const maxResults = Math.min(
      opts.maxResults ?? recallCfg.maxResultsDefault!,
      recallCfg.maxResultsMax!,
    );
    const minScore = opts.minScore ?? recallCfg.minScoreDefault!;
    const query = opts.query ?? "";
    const roleFilter = opts.role;

    const repeatNote = this.checkRepeat(query, maxResults, minScore);
    const candidatePool = maxResults * 5;
    const ownerFilter = opts.ownerFilter;
    const excludeSessionKey = opts.excludeSessionKey;

    // Step 1: Gather candidates from FTS, vector search, and pattern search
    const ftsCandidates = query
      ? this.store.ftsSearch(query, candidatePool, ownerFilter, excludeSessionKey)
      : [];

    let vecCandidates: Array<{ chunkId: string; score: number }> = [];
    if (query) {
      try {
        const queryVec = await this.embedder.embedQuery(query);
        const maxChunks = recallCfg.vectorSearchMaxChunks && recallCfg.vectorSearchMaxChunks > 0
          ? recallCfg.vectorSearchMaxChunks
          : undefined;
        vecCandidates = vectorSearch(this.store, queryVec, candidatePool, maxChunks, ownerFilter, excludeSessionKey);
      } catch (err) {
        this.ctx.log.warn(`Vector search failed, using FTS only: ${err}`);
      }
    }

    // Step 1b: Pattern search (LIKE-based) as fallback for short terms that
    // trigram FTS cannot match (trigram requires >= 3 chars).
    // For CJK text without spaces, extract bigrams (2-char sliding windows)
    // so that queries like "唐波是谁" produce ["唐波", "波是", "是谁"].
    const cleaned = query.replace(/[."""(){}[\]*:^~!@#$%&\\/<>,;'`?？。，！、：""''（）【】《》]/g, " ");
    const spaceSplit = cleaned.split(/\s+/).filter((t) => t.length === 2);
    const cjkBigrams: string[] = [];
    const cjkRuns = cleaned.match(/[\u4e00-\u9fff\u3400-\u4dbf\uF900-\uFAFF]{2,}/g);
    if (cjkRuns) {
      for (const run of cjkRuns) {
        for (let i = 0; i <= run.length - 2; i++) {
          cjkBigrams.push(run.slice(i, i + 2));
        }
      }
    }
    const shortTerms = [...new Set([...spaceSplit, ...cjkBigrams])];
    const patternHits = shortTerms.length > 0
      ? this.store.patternSearch(shortTerms, { limit: candidatePool, ownerFilter, excludeSessionKey })
      : [];
    const patternRanked = patternHits.map((h, i) => ({
      id: h.chunkId,
      score: 1 / (i + 1),
    }));

    // Step 1c: Hub memories — FTS + pattern + cached embeddings (same strategy as chunks/skills).
    let hubMemFtsRanked: Array<{ id: string; score: number }> = [];
    let hubMemVecRanked: Array<{ id: string; score: number }> = [];
    let hubMemPatternRanked: Array<{ id: string; score: number }> = [];
    if (query && this.ctx.config.sharing?.enabled && this.ctx.config.sharing.role === "hub") {
      try {
        const hubFtsHits = this.store.searchHubMemories(query, { maxResults: candidatePool });
        hubMemFtsRanked = hubFtsHits.map(({ hit }, i) => ({ id: `hubmem:${hit.id}`, score: 1 / (i + 1) }));
      } catch { /* hub_memories table may not exist */ }
      if (shortTerms.length > 0) {
        try {
          const hubPatternHits = this.store.hubMemoryPatternSearch(shortTerms, { limit: candidatePool });
          hubMemPatternRanked = hubPatternHits.map((h, i) => ({ id: `hubmem:${h.memoryId}`, score: 1 / (i + 1) }));
        } catch { /* best-effort */ }
      }

      try {
        const qv = await this.embedder.embedQuery(query).catch(() => null);
        if (qv) {
          const memEmbs = this.store.getVisibleHubMemoryEmbeddings("__hub__");
          const scored: Array<{ id: string; score: number }> = [];
          for (const e of memEmbs) {
            let dot = 0, nA = 0, nB = 0;
            const len = Math.min(qv.length, e.vector.length);
            for (let i = 0; i < len; i++) {
              dot += qv[i] * e.vector[i]; nA += qv[i] * qv[i]; nB += e.vector[i] * e.vector[i];
            }
            const sim = nA > 0 && nB > 0 ? dot / (Math.sqrt(nA) * Math.sqrt(nB)) : 0;
            if (sim > 0.3) scored.push({ id: `hubmem:${e.memoryId}`, score: sim });
          }
          scored.sort((a, b) => b.score - a.score);
          hubMemVecRanked = scored.slice(0, candidatePool);
        }
      } catch { /* best-effort */ }

      const hubTotal = hubMemFtsRanked.length + hubMemVecRanked.length + hubMemPatternRanked.length;
      if (hubTotal > 0) {
        this.ctx.log.debug(`recall: hub_memories candidates: fts=${hubMemFtsRanked.length}, vec=${hubMemVecRanked.length}, pattern=${hubMemPatternRanked.length}`);
      }
    }

    // Step 2: RRF fusion
    const ftsRanked = ftsCandidates.map((c) => ({ id: c.chunkId, score: c.score }));
    const vecRanked = vecCandidates.map((c) => ({ id: c.chunkId, score: c.score }));
    const allRankedLists = [ftsRanked, vecRanked, patternRanked];
    if (hubMemFtsRanked.length > 0) allRankedLists.push(hubMemFtsRanked);
    if (hubMemVecRanked.length > 0) allRankedLists.push(hubMemVecRanked);
    if (hubMemPatternRanked.length > 0) allRankedLists.push(hubMemPatternRanked);
    const rrfScores = rrfFuse(allRankedLists, recallCfg.rrfK);

    if (rrfScores.size === 0) {
      this.recordQuery(query, maxResults, minScore, 0);
      return {
        hits: [],
        meta: {
          usedMinScore: minScore,
          usedMaxResults: maxResults,
          totalCandidates: 0,
          note: repeatNote ?? "No candidates found for the given query.",
        },
      };
    }

    // Step 3: MMR re-ranking
    const rrfList = [...rrfScores.entries()]
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score);

    const mmrResults = mmrRerank(rrfList, this.store, recallCfg.mmrLambda, maxResults * 2);

    // Step 4: Time decay
    const withTs = mmrResults.map((r) => {
      if (r.id.startsWith("hubmem:")) {
        const memId = r.id.slice(7);
        const mem = this.store.getHubMemoryById(memId);
        return { ...r, createdAt: mem?.createdAt ?? 0 };
      }
      const chunk = this.store.getChunk(r.id);
      return { ...r, createdAt: chunk?.createdAt ?? 0 };
    });
    const decayed = applyRecencyDecay(withTs, recallCfg.recencyHalfLifeDays);

    // Step 5: Apply relative threshold on raw scores, then normalize to [0,1]
    const sorted = [...decayed].sort((a, b) => b.score - a.score);
    const topScore = sorted.length > 0 ? sorted[0].score : 0;

    const absoluteFloor = topScore * minScore * 0.3;
    // When role filter is active, keep a larger pool before slicing so we don't
    // discard target-role candidates that rank below non-target ones.
    const preSliceLimit = roleFilter ? maxResults * 5 : maxResults;
    const filtered = sorted
      .filter((d) => d.score >= absoluteFloor)
      .slice(0, preSliceLimit);

    const displayMax = filtered.length > 0 ? filtered[0].score : 1;
    const normalized = filtered.map((d) => ({
      ...d,
      score: d.score / displayMax,
    }));

    // Step 6: Build hits (with optional role filter), applying maxResults cap at the end
    const hits: SearchHit[] = [];
    for (const candidate of normalized) {
      if (hits.length >= maxResults) break;

      if (candidate.id.startsWith("hubmem:")) {
        const memId = candidate.id.slice(7);
        const mem = this.store.getHubMemoryById(memId);
        if (!mem) continue;
        if (roleFilter && mem.role !== roleFilter) continue;
        hits.push({
          summary: mem.summary || mem.content.slice(0, 200),
          original_excerpt: mem.content,
          ref: {
            sessionKey: `hub-shared:${mem.sourceUserId}`,
            chunkId: mem.id,
            turnId: "",
            seq: 0,
          },
          score: Math.round(candidate.score * 1000) / 1000,
          taskId: null,
          skillId: null,
          owner: `hub-user:${mem.sourceUserId}`,
          origin: "hub-memory",
          source: {
            ts: mem.createdAt,
            role: (mem.role || "assistant") as any,
            sessionKey: `hub-shared:${mem.sourceUserId}`,
          },
        });
        continue;
      }

      const chunk = this.store.getChunk(candidate.id);
      if (!chunk) continue;
      if (roleFilter && chunk.role !== roleFilter) continue;

      const excerpt = (chunk.mergeCount ?? 0) > 0 ? chunk.summary : makeExcerpt(chunk.content);
      hits.push({
        summary: chunk.summary,
        original_excerpt: excerpt,
        ref: {
          sessionKey: chunk.sessionKey,
          chunkId: chunk.id,
          turnId: chunk.turnId,
          seq: chunk.seq,
    
```

### Core Architecture Module: `apps/memos-local-plugin/agent-contract/memory-core.ts`
```
/**
 * The single facade exposed by the algorithm core.
 *
 * Adapters call these methods (TypeScript adapters import the implementation
 * directly; non-TS adapters dispatch via JSON-RPC method names defined in
 * `jsonrpc.ts`).
 *
 * Implementation lives in `core/pipeline/memory-core.ts`. Tests mock this
 * interface; SDK consumers depend only on this file.
 */

import type {
  AgentKind,
  ApiLogDTO,
  EpochMs,
  EpisodeId,
  EpisodeListItemDTO,
  FeedbackDTO,
  PolicyDTO,
  RetrievalQueryDTO,
  RetrievalResultDTO,
  SessionId,
  SkillDTO,
  SkillId,
  SubagentOutcomeDTO,
  ToolOutcomeDTO,
  TraceDTO,
  TurnInputDTO,
  TurnResultDTO,
  WorldModelDTO,
  RuntimeNamespace,
  ShareScope,
} from "./dto.js";
import type { CoreEvent } from "./events.js";
import type { LogRecord } from "./log-record.js";

// ─── Public lifecycle / status ────────────────────────────────────────────────

export interface CoreHealth {
  ok: boolean;
  version: string;
  uptimeMs: number;
  agent: AgentKind;
  namespace?: RuntimeNamespace;
  paths: {
    home: string;
    config: string;
    db: string;
    skills: string;
    logs: string;
  };
  /**
   * Optional host transport status. Hermes fills this at the HTTP
   * server layer because the core itself does not own the Python ↔ Node
   * stdio bridge.
   */
  bridge?: BridgeHealth;
  llm: ModelHealth;
  embedder: ModelHealth & { dim: number };
  /**
   * Dedicated skill-crystallization model. When the operator leaves
   * `skillEvolver.model` blank, we surface the main LLM model with
   * `inherited: true` so the viewer can label it as "inherits from LLM".
   * The health fields mirror the main LLM client when `inherited=true`.
   */
  skillEvolver: ModelHealth & { inherited: boolean };
}

export type BridgeHealthStatus =
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "unknown";

export interface BridgeHealth {
  status: BridgeHealthStatus;
  lastOkAt: number | null;
  lastErrorAt: number | null;
  lastError: string | null;
}

/**
 * Per-model connectivity summary used by the viewer's Overview page.
 *
 * The viewer renders the slot in one of four colours, picked by
 * comparing the timestamps below — most-recent event wins:
 *
 *   - **green** (`ok`)        : `lastOkAt` is the latest stamp →
 *     primary provider answered directly.
 *   - **yellow** (`fallback`) : `lastFallbackAt` is the latest stamp →
 *     primary provider failed *but* the host LLM bridge rescued the
 *     call. Only ever set on the LLM / skillEvolver slots; the
 *     embedder has no fallback path so this stays `null`.
 *   - **red** (`err`)         : `lastError.at` is the latest stamp →
 *     primary provider failed and either no fallback was configured
 *     or the fallback also failed. The accompanying `message` is
 *     surfaced verbatim on the card.
 *   - **idle / off**          : every timestamp is `null` → the
 *     facade has not been called yet (idle) or no client is
 *     configured at all (off).
 *
 * `lastError` is **sticky** — it is not cleared by a later success.
 * The viewer's timestamp comparison naturally promotes a fresh
 * success over a stale failure, while keeping the message available
 * in case a subsequent failure flips the card back to red.
 */
export interface ModelHealth {
  available: boolean;
  provider: string;
  model: string;
  lastOkAt: number | null;
  /**
   * Latest time the primary provider failed but the host LLM bridge
   * answered successfully. Always `null` on the embedder slot.
   */
  lastFallbackAt: number | null;
  lastError: { at: number; message: string } | null;
}

// ─── Embedding maintenance ───────────────────────────────────────────────────

export type EmbeddingMaintenanceMode = "repair" | "rebuild";

export interface EmbeddingMaintenanceStats {
  dimension: number;
  available: boolean;
  totalSlots: number;
  ready: number;
  missing: number;
  dimMismatch: number;
  needsRepair: number;
  byKind: Record<
    "trace" | "policy" | "world_model" | "skill",
    {
      totalSlots: number;
      ready: number;
      missing: number;
      dimMismatch: number;
      needsRepair: number;
    }
  >;
}

export interface EmbeddingMaintenanceRunResult {
  mode: EmbeddingMaintenanceMode;
  processed: number;
  updated: number;
  failed: number;
  offset: number;
  nextOffset: number;
  done: boolean;
  statsBefore: EmbeddingMaintenanceStats;
  statsAfter: EmbeddingMaintenanceStats;
  error?: string;
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export type Unsubscribe = () => void;

/** Non-serializable execution controls used only by in-process adapters. */
export interface MemorySearchExecutionOptions {
  /** Abort when the owning host turn/tool is cancelled. */
  signal?: AbortSignal;
  /** Block admission of new background LLM work while this search is active. */
  foreground?: boolean;
}

export interface MemoryCore {
  // ── lifecycle ──
  init(): Promise<void>;
  shutdown(): Promise<void>;
  health(): Promise<CoreHealth>;
  /** Late-bind ARMS telemetry (called after config is available). */
  bindTelemetry?(t: unknown): void;
  /**
   * Resolve when the background recovery kicked off by `init()` settles.
   *
   * `init()` returns as soon as the synchronous orphan / dirty-episode
   * classification finishes; the actual reflect / reward / L2 recovery
   * chain runs on a background promise so the host's event loop stays
   * responsive (see issues #1776 + #1808). This method exposes that
   * promise for callers that need the historic "await everything"
   * semantics — primarily tests and one-shot batch tools.
   *
   * Implementations MUST never reject from this promise. Failures are
   * logged on the `init.background_recovery_failed` channel instead.
   * Adapters that have no startup recovery may omit the method; an
   * absent implementation is equivalent to `() => Promise.resolve()`.
   */
  waitForStartupRecovery?(): Promise<void>;

  // ── session / episode ──
  openSession(input: {
    agent: AgentKind;
    sessionId?: SessionId;
    meta?: Record<string, unknown>;
    namespace?: RuntimeNamespace;
  }): Promise<SessionId>;
  closeSession(sessionId: SessionId): Promise<void>;
  openEpisode(input: {
    sessionId: SessionId;
    episodeId?: EpisodeId;
    /** Optional initial user text (for adapters that know it). */
    userMessage?: string;
  }): Promise<EpisodeId>;
  closeEpisode(episodeId: EpisodeId): Promise<void>;

  // ── pipeline (per turn) ──
  /** Called *before* the agent acts. Returns the context to inject. */
  onTurnStart(turn: TurnInputDTO): Promise<RetrievalResultDTO>;
  /**
   * Optional capability: resolve relation/intent routing and open the durable
   * episode without running retrieval. Hosts with an eventually-consistent
   * lifecycle can run this after the agent turn, off the prompt-time critical
   * path.
   */
  prepareTurn?(turn: TurnInputDTO): Promise<{
    sessionId: SessionId;
    episodeId: EpisodeId;
  }>;
  /** Called *after* the agent acts. Persists the trace, schedules induction, etc. */
  onTurnEnd(result: TurnResultDTO): Promise<{ traceId: string; episodeId: EpisodeId }>;
  /** Called when the user gives task-level feedback (or implicit signals fire). */
  submitFeedback(feedback: Omit<FeedbackDTO, "id" | "ts"> & { ts?: number }): Promise<FeedbackDTO>;
  /**
   * Record a tool outcome. Feeds decision-repair so failure bursts can
   * trigger targeted re-injection on the *next* turn. Non-blocking: the
   * call returns before repair runs and never throws on unknown sessions.
   */
  recordToolOutcome(outcome: ToolOutcomeDTO): void;
  /**
   * Record a parent-session delegation outcome. Subagent lifecycle hooks
   * usually carry task/result metadata, not a full child transcript, so this
   * appends the visible delegation task/result to the parent episode.
   */
  recordSubagentOutcome(
    outcome: SubagentOutcomeDTO,
  ): Promise<{ traceId: string; episodeId: EpisodeId }>;

  // ── memory queries ──
  searchMemory(
    query: RetrievalQueryDTO,
    execution?: MemorySearchExecutionOptions,
  ): Promise<RetrievalResultDTO>;
  getTrace(id: string, namespace?: RuntimeNamespace): Promise<TraceDTO | null>;
  /**
   * Mutate a single trace's user-facing fields (role / summary /
   * body). Never touches algorithmic signals. Returns the updated
   * DTO (or null if the id is unknown).
   */
  updateTrace(
    id: string,
    patch: {
      summary?: string | null;
      userText?: string;
      agentText?: string;
      tags?: readonly string[];
    },
  ): Promise<TraceDTO | null>;
  /** Delete a trace by id (idempotent). Hard delete. */
  deleteTrace(id: string): Promise<{ deleted: boolean }>;
  /**
   * Bulk delete — takes an id list and returns how many rows were
   * actually removed. The viewer's "批量删除" uses this.
   */
  deleteTraces(ids: readonly string[]): Promise<{ deleted: number }>;
  /**
   * Update the sharing state for a trace. `scope = null` clears the
   * share. The core never talks to the Hub itself; the adapter /
   * viewer are responsible for the network call, then call this to
   * persist the resulting state.
   */
  shareTrace(
    id: string,
    share: {
      scope: ShareScope | null;
      target?: string | null;
      sharedAt?: number | null;
    },
  ): Promise<TraceDTO | null>;
  getPolicy(id: string, namespace?: RuntimeNamespace, opts?: { includeAllNamespaces?: boolean }): Promise<PolicyDTO | null>;
  getWorldModel(id: string, namespace?: RuntimeNamespace, opts?: { includeAllNamespaces?: boolean }): Promise<WorldModelDTO | null>;
  /**
   * List L2 policies ("经验") — newest-first. The viewer uses this
   * for the Experiences panel.
   */
  listPolicies(input?: {
    status?: PolicyDTO["status"];
    limit?: number;
    offset?: number;
    q?: string;
    ownerAgentKind?: AgentKind;
    ownerProfileId?: string;
    includeAllNamespaces?: boolean;
  }): Promise<PolicyDTO[]>;
  /** Total policy rows matching the same filter
```

### Core Architecture Module: `apps/memos-local-plugin/core/capture/alpha-scorer.ts`
```
/**
 * `alpha-scorer` — grade a reflection with the `REFLECTION_SCORE_PROMPT`
 * (defined in `core/llm/prompts/reflection.ts`).
 *
 * Implements V7 eq. 5:
 *    α_t = judge(state_t, action_t, outcome_t, reflection_t)
 *    usable = α ≥ 0.4 ∧ non-tautological
 *    if ¬usable then α ← 0
 *
 * We parse a `{alpha: number, usable: boolean, reason?: string}` JSON
 * response, clamp α to [0, 1], and force α = 0 when `usable=false`.
 *
 * Failures (LLM unavailable, malformed JSON) return a neutral
 * `{alpha: null, usable: false}` — the caller decides what to do
 * (capture.ts falls back to α=0 so nothing is trained on ungraded data).
 */

import { ERROR_CODES, MemosError } from "../../agent-contract/errors.js";
import type { LlmClient } from "../llm/index.js";
import {
  detectDominantLanguage,
  languageSteeringLine,
} from "../llm/prompts/index.js";
import { REFLECTION_SCORE_PROMPT } from "../llm/prompts/reflection.js";
import { rootLogger } from "../logger/index.js";
import { sanitizeDerivedText } from "../safety/content.js";
import type { NormalizedStep, ReflectionContext, ReflectionScore } from "./types.js";

export interface AlphaInput extends ReflectionContext {
  step: NormalizedStep;
  reflectionText: string;
  episodeId?: string;
  phase?: string;
  outcomeMaxChars?: number;
}

export interface AlphaOutput {
  alpha: number;
  usable: boolean;
  reason: string | null;
  model: string;
}

export async function scoreReflection(
  llm: LlmClient,
  input: AlphaInput,
): Promise<AlphaOutput> {
  const log = rootLogger.child({ channel: "core.capture.alpha" });

  const thinking = (input.step.agentThinking ?? "").trim();
  const userPayload = [
    `TASK CONTEXT:`,
    input.taskSummary?.trim().slice(0, 1_200) || "(none)",
    ``,
    `STATE:`,
    input.step.userText.slice(0, 1_200) || "(none)",
    ``,
    `THINKING:`,
    thinking ? thinking.slice(0, 1_500) : "(none — model did not emit thinking this step)",
    ``,
    `ACTION:`,
    input.step.agentText.slice(0, 1_500) || "(none)",
    input.step.toolCalls.length > 0
      ? `\nTOOL_CALLS:\n${input.step.toolCalls
          .map((t) =>
            t.errorCode
              ? `- ${t.name}(${summarizeInput(t.input)}) → ERROR[${t.errorCode}] ${truncate(outputOf(t), 300)}`
              : `- ${t.name}(${summarizeInput(t.input)}) → ${truncate(outputOf(t), 300)}`,
          )
          .join("\n")}`
      : "\nTOOL_CALLS: (none)",
    ``,
    `OUTCOME:`,
    // Use the last 1 tool output as the "outcome" signal if present.
    lastToolOutcome(input.step, input.outcomeMaxChars ?? 600),
    ``,
    `DOWNSTREAM STEP PREVIEW:`,
    formatDownstreamPreview(input),
    ``,
    `REFLECTION:`,
    input.reflectionText.slice(0, 1_500),
  ]
    .filter(Boolean)
    .join("\n");

  // Match the `reason` string's language to the step's own language so
  // the Memories viewer doesn't mix 中文 + English per row.
  const stepLang = detectDominantLanguage([
    input.step.userText,
    input.step.agentText,
    input.step.agentThinking,
    input.reflectionText,
  ]);

  const rsp = await llm.completeJson<{
    alpha: unknown;
    usable: unknown;
    reason?: unknown;
  }>(
    [
      { role: "system", content: REFLECTION_SCORE_PROMPT.system },
      { role: "system", content: languageSteeringLine(stepLang) },
      { role: "user", content: userPayload },
    ],
    {
      op: `capture.alpha.${REFLECTION_SCORE_PROMPT.id}.v${REFLECTION_SCORE_PROMPT.version}`,
      episodeId: input.episodeId,
      phase: input.phase,
      schemaHint: `{"alpha": 0..1, "usable": true|false, "reason": "short string"}`,
      validate: (v) => {
        const o = v as Record<string, unknown>;
        if (typeof o.alpha !== "number") {
          throw new MemosError(ERROR_CODES.LLM_OUTPUT_MALFORMED, "alpha must be number", {
            got: o.alpha,
          });
        }
        if (typeof o.usable !== "boolean") {
          throw new MemosError(ERROR_CODES.LLM_OUTPUT_MALFORMED, "usable must be boolean", {
            got: o.usable,
          });
        }
      },
      malformedRetries: 1,
      temperature: 0,
    },
  );

  const rawAlpha = rsp.value.alpha as number;
  const usable = Boolean(rsp.value.usable);
  const alpha = clamp01(rawAlpha);
  const finalAlpha = usable ? alpha : 0;
  const reason = typeof rsp.value.reason === "string" ? sanitizeDerivedText(rsp.value.reason) : null;

  log.debug("alpha.scored", {
    key: input.step.key,
    alpha: finalAlpha,
    usable,
    rawAlpha,
    model: rsp.servedBy,
    reason,
  });

  return { alpha: finalAlpha, usable, reason, model: rsp.servedBy };
}

export function disabledScore(text: string | null, source: ReflectionScore["source"]): ReflectionScore {
  return {
    text,
    alpha: text ? 0.5 : 0,
    usable: text !== null,
    source,
  };
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function summarizeInput(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v.slice(0, 200);
  try {
    return JSON.stringify(v).slice(0, 200);
  } catch {
    return String(v).slice(0, 200);
  }
}

function outputOf(t: { output?: unknown }): string {
  if (t.output === undefined || t.output === null) return "";
  if (typeof t.output === "string") return t.output;
  try {
    return JSON.stringify(t.output);
  } catch {
    return String(t.output);
  }
}

function lastToolOutcome(step: NormalizedStep, maxChars: number): string {
  const last = step.toolCalls[step.toolCalls.length - 1];
  if (!last) return "(assistant-only step)";
  return (last.errorCode ? `ERROR[${last.errorCode}] ` : "") + truncate(outputOf(last), maxChars);
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "..." : s;
}

function formatDownstreamPreview(input: AlphaInput): string {
  const preview = input.downstream ?? [];
  if (preview.length === 0) return "(none)";
  return preview
    .map((item) => {
      const label = `step+${item.offset}`;
      if (item.kind === "tooluse") {
        const lines = [
          `[${label}] type=tooluse`,
          `tool_names: ${item.toolNames?.join(", ") || "(unknown)"}`,
          `tool_output: ${item.toolOutput?.trim() || "(none)"}`,
        ];
        if (item.reflection?.trim()) {
          lines.push(`existing_reflection: ${item.reflection.trim()}`);
        }
        return lines.join("\n");
      }
      return [`[${label}] type=text`, item.text?.trim() || "(empty)"].join("\n");
    })
    .join("\n\n");
}

```

### Core Architecture Module: `apps/memos-local-plugin/core/capture/batch-scorer.ts`
```
/**
 * `batch-scorer` — episode-level reflection synthesis + α scoring in ONE
 * LLM call. Activated by `algorithm.capture.batchMode` + `batchThreshold`.
 *
 * Why this exists (V7 §3.2 batched variant):
 *
 *   The per-step path (`reflection-synth.ts` + `alpha-scorer.ts`) issues
 *   2 LLM calls per agent step (synth + α). For a 10-step episode that's
 *   ~20 calls — slow and expensive. This module folds them into one call
 *   that processes the whole episode at once.
 *
 *   Beyond cost: the LLM here sees the *complete* causal chain (every
 *   step in order, including the final outcome), so reflections it
 *   writes can credit-attribute across steps in a way grounded
 *   per-step reflections never can. V7 §3.2.3's `causal_insight` and
 *   `transferability` axes benefit directly.
 *
 * Trade-offs (encoded in capture.ts dispatch):
 *   - Prompt grows linearly with N steps. Each call is capped at
 *     `batchThreshold`; long episodes run as several bounded chunks.
 *   - One bad chunk forces a single batched retry for that chunk instead
 *     of N isolated retries — but the facade already does
 *     `malformedRetries` for us, and on hard failure capture.ts falls
 *     back to per-step for that chunk only.
 *
 * Wire format ↔ prompt:
 *   Send `{ host_context?, task_context?, steps: [{idx, state, action, outcome, reflection, synth_allowed}] }`.
 *   `task_context` is episode-level task summary (nullable string).
 *   Receive `{scores: [{idx, reflection_text, alpha, usable, reason}]}`.
 *   See `core/llm/prompts/reflection.ts :: BATCH_REFLECTION_PROMPT`.
 */

import { ERROR_CODES, MemosError } from "../../agent-contract/errors.js";
import type { LlmClient } from "../llm/index.js";
import {
  detectDominantLanguage,
  languageSteeringLine,
} from "../llm/prompts/index.js";
import { BATCH_REFLECTION_PROMPT } from "../llm/prompts/reflection.js";
import { rootLogger } from "../logger/index.js";
import { sanitizeDerivedText } from "../safety/content.js";
import type { NormalizedStep, ReflectionScore } from "./types.js";

export interface BatchScoreInput {
  step: NormalizedStep;
  /**
   * Reflection already extracted (adapter / regex). `null` when none — the
   * LLM may synthesize one if `synthReflections` is enabled.
   */
  existingReflection: string | null;
}

export interface BatchScoreOptions {
  /**
   * Mirror of `CaptureConfig.synthReflections`. When `false`, any reflection
   * the LLM writes for steps that came in empty is discarded
   * (text→null, α→0, source→none) — preserves the per-step contract.
   */
  synthReflections: boolean;
  episodeId?: string;
  phase?: string;
  taskSummary?: string | null;
  /**
   * Cap per-field text we shovel into the prompt. Default 1_200 chars per
   * `state`/`outcome`, 1_500 per `action`. Mirrors per-step prompts.
   */
  perFieldChars?: {
    state: number;
    action: number;
    outcome: number;
    reflection: number;
  };
}

export interface BatchScoreResult {
  /** Per-step `ReflectionScore`, one entry per input, in input order. */
  scores: ReflectionScore[];
  /** `servedBy` model id from the underlying LLM call. */
  model: string;
  /** Number of steps where we accepted a newly-synthesized reflection. */
  synthAccepted: number;
}

interface RawScoreEntry {
  idx: number;
  reflection_text: unknown;
  alpha: unknown;
  usable: unknown;
  reason?: unknown;
}

interface BatchPayload {
  scores: RawScoreEntry[];
}

const DEFAULT_FIELD_CHARS = {
  state: 1_200,
  action: 1_500,
  outcome: 600,
  reflection: 1_200,
  thinking: 1_500,
} as const;

export const BATCH_OP_TAG = `capture.${BATCH_REFLECTION_PROMPT.id}.v${BATCH_REFLECTION_PROMPT.version}`;

/**
 * One LLM call → reflections + α for every input step.
 *
 * Throws `MemosError` with `LLM_OUTPUT_MALFORMED` when the LLM returns a
 * shape we cannot parse even after the facade's malformed-retry. Caller
 * (capture.ts) catches and falls back to per-step.
 *
 * Empty `inputs` → returns empty `scores` without invoking the LLM.
 */
export async function batchScoreReflections(
  llm: LlmClient,
  inputs: ReadonlyArray<BatchScoreInput>,
  opts: BatchScoreOptions,
): Promise<BatchScoreResult> {
  const log = rootLogger.child({ channel: "core.capture.batch" });
  if (inputs.length === 0) {
    return { scores: [], model: "none", synthAccepted: 0 };
  }
  const fieldChars = { ...DEFAULT_FIELD_CHARS, ...(opts.perFieldChars ?? {}) };

  const payload = {
    host_context: batchHostContext(inputs, llm),
    task_context: opts.taskSummary?.trim().slice(0, 1_200) || null,
    steps: inputs.map((input, i) => ({
      idx: i,
      state: clip(input.step.userText, fieldChars.state),
      thinking: clip(input.step.agentThinking ?? "", fieldChars.thinking),
      action: clip(input.step.agentText, fieldChars.action) || "(none)",
      tool_calls: input.step.toolCalls.map((t) => ({
        name: t.name,
        input: summarizeInput(t.input),
        output: clip(outputOf(t), 300),
        errorCode: t.errorCode ?? null,
      })),
      outcome: lastToolOutcome(input.step, fieldChars.outcome),
      reflection: clip(input.existingReflection ?? "", fieldChars.reflection),
      synth_allowed: opts.synthReflections,
    })),
  };

  // Reflections are first-person narrations — written in the same
  // language the user + agent were speaking so the Memories panel
  // stays coherent. Detect once per batch from the aggregate turn
  // texts; all steps in one episode share a language in practice.
  const reflectionLang = detectDominantLanguage(
    inputs.flatMap((i) => [
      i.step.userText,
      i.step.agentText,
      i.step.agentThinking,
      i.existingReflection,
    ]),
  );

  const rsp = await llm.completeJson<BatchPayload>(
    [
      { role: "system", content: BATCH_REFLECTION_PROMPT.system },
      { role: "system", content: languageSteeringLine(reflectionLang) },
      { role: "user", content: JSON.stringify(payload) },
    ],
    {
      op: BATCH_OP_TAG,
      episodeId: opts.episodeId,
      phase: opts.phase,
      schemaHint:
        '{"scores": [{"idx": int, "reflection_text": "str", "alpha": 0..1, "usable": bool, "reason": "str"}]}',
      validate: (v) => validateBatchPayload(v, inputs.length),
      malformedRetries: 1,
      temperature: 0,
      maxTokens: batchMaxTokens(inputs.length),
    },
  );

  // Index entries by `idx` so a re-ordered (but otherwise valid) response
  // still maps back to the right step.
  const byIdx = new Map<number, RawScoreEntry>();
  for (const entry of rsp.value.scores) byIdx.set(Number(entry.idx), entry);

  let synthAccepted = 0;
  const scores: ReflectionScore[] = inputs.map((input, i) => {
    const raw = byIdx.get(i);
    if (!raw) {
      // Should be impossible after validateBatchPayload, but degrade
      // safely: treat as no-reflection.
      return disabledScoreFor(input);
    }
    const incomingText = (input.existingReflection ?? "").trim();
    const llmText = typeof raw.reflection_text === "string" ? sanitizeDerivedText(raw.reflection_text) : "";
    const usable = Boolean(raw.usable);
    const rawAlpha = clamp01(numOrZero(raw.alpha));
    const alpha = usable ? rawAlpha : 0;
    const reason = typeof raw.reason === "string" ? sanitizeDerivedText(raw.reason) : null;

    let finalText: string | null;
    let source: ReflectionScore["source"];
    if (incomingText.length > 0) {
      // Caller already had a reflection; never let the LLM rewrite it
      // (the prompt asks for verbatim copy, but we double-enforce here).
      finalText = incomingText.slice(0, 1_500);
      source = sourceForExisting(input);
    } else if (llmText.length > 0 && opts.synthReflections) {
      finalText = llmText.slice(0, 1_500);
      source = "synth";
      synthAccepted += 1;
    } else {
      // Either the LLM didn't write one (incoherent step) or synth is
      // disabled and we discard whatever it wrote.
      return disabledScoreFor(input);
    }

    return {
      text: finalText,
      alpha,
      usable: usable && finalText !== null,
      reason,
      source,
      model: rsp.servedBy,
    };
  });

  log.debug("batch.scored", {
    steps: inputs.length,
    synthAccepted,
    model: rsp.servedBy,
    durationMs: rsp.durationMs,
  });

  return { scores, model: rsp.servedBy, synthAccepted };
}

// ─── helpers ────────────────────────────────────────────────────────────────

function batchHostContext(
  inputs: ReadonlyArray<BatchScoreInput>,
  llm: LlmClient,
): Record<string, string> | undefined {
  const hints = inputs
    .map((input) => input.step.meta.contextHints)
    .find((value): value is Record<string, unknown> =>
      typeof value === "object" && value !== null && !Array.isArray(value),
    );
  const out: Record<string, string> = {
    reflectionProvider: llm.provider,
    reflectionModel: llm.model,
  };
  for (const key of ["agentIdentity", "hostProvider", "hostModel", "hostApiMode", "hostBaseUrl"]) {
    const value = hints?.[key];
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
  }
  return out;
}

function disabledScoreFor(input: BatchScoreInput): ReflectionScore {
  const text = (input.existingReflection ?? "").trim();
  if (text.length === 0) {
    return { text: null, alpha: 0, usable: false, source: "none" };
  }
  // We had a reflection but the LLM result was unusable — keep the text,
  // attribute α=0.5 the same way `disabledScore` does for non-LLM paths so
  // backprop still has a non-zero weight.
  return {
    text: text.slice(0, 1_500),
    alpha: 0.5,
    usable: true,
    source: sourceForExisting(input),
  };
}

function sourceForExisting(input: BatchScoreInput): ReflectionScore["source"] {
  return input.step.rawReflection !== null && input.step.rawReflection.trim().length > 0
    ? "adapter"
    : "extracted";
}

function validateBatchPayload(v: unknown, expected: number): void {
  const o = v as { scores?: unknown };
  if (!o || !Array.isArray(o.scores)) {
    throw new MemosError(
    
```

### Core Architecture Module: `apps/memos-local-plugin/core/capture/capture.ts`
```
/**
 * `capture.ts` — the Phase 6 pipeline entry point.
 *
 * Orchestrates:
 *     extract → normalize → reflect(+synth?) → alpha-score → embed → persist
 *
 * Called by `subscriber.ts` whenever `episode.finalized` fires, or
 * directly by integration tests to run capture synchronously.
 *
 * Return contract: a fully populated `CaptureResult`. Failures inside
 * one stage are captured as `warnings` and we still try to persist the
 * partial rows — V7 treats missing α as α=0, which is already the SQL
 * default, so a non-fatal capture run still yields reward-propagatable
 * traces.
 */

import { ERROR_CODES, MemosError } from "../../agent-contract/errors.js";
import type { Embedder } from "../embedding/index.js";
import type { LlmClient } from "../llm/index.js";
import { rootLogger } from "../logger/index.js";
import { ids } from "../id.js";
import type { EpisodeRow, TraceRow, TraceId, EpochMs } from "../types.js";
import type { makeEmbeddingRetryQueueRepo } from "../storage/repos/embedding_retry_queue.js";
import type { makeTracesRepo } from "../storage/repos/traces.js";
import type { EpisodesRepo } from "../session/persistence.js";
import { disabledScore, scoreReflection } from "./alpha-scorer.js";
import { batchScoreReflections, type BatchScoreInput } from "./batch-scorer.js";
import { embedSteps, type VecPair } from "./embedder.js";
import { normalizeSteps } from "./normalizer.js";
import { extractReflection } from "./reflection-extractor.js";
import { synthesizeReflection } from "./reflection-synth.js";
import { extractSteps } from "./step-extractor.js";
import { createSummarizer, type Summarizer } from "./summarizer.js";
import { tagsForStep } from "./tagger.js";
import { extractErrorSignatures } from "./error-signature.js";
import type {
  CaptureConfig,
  CaptureEvent,
  CaptureEventBus,
  CaptureInput,
  CaptureResult,
  DownstreamStepPreview,
  NormalizedStep,
  ReflectionContext,
  ReflectionScore,
  ScoredStep,
  StepCandidate,
  TraceCandidate,
} from "./types.js";

type TracesRepo = ReturnType<typeof makeTracesRepo>;
type EmbeddingRetryQueueRepo = ReturnType<typeof makeEmbeddingRetryQueueRepo>;

export interface CaptureDeps {
  tracesRepo: TracesRepo;
  embeddingRetryQueue?: EmbeddingRetryQueueRepo;
  episodesRepo: EpisodesRepo;
  embedder: Embedder | null;
  /** Main LLM — used for per-turn lite capture (summarisation). */
  llm: LlmClient | null;
  /**
   * Dedicated LLM for the topic-end reflection + α scoring pass.
   * When the user configures a stronger model under `skillEvolver.*`,
   * this points to that model; otherwise it falls back to `llm`.
   */
  reflectLlm: LlmClient | null;
  bus: CaptureEventBus;
  cfg: CaptureConfig;
  now?: () => number;
}

export interface CaptureRunner {
  /**
   * Per-turn "lite" capture. Writes the trace row for any newly added
   * step in the episode with `reflection=null` + `alpha=0`. No LLM
   * reflection / α scoring here — the user can already see the memory
   * in the viewer immediately, but no "反思" pill is shown until the
   * topic-level reflect pass fires.
   *
   * Idempotent: existing traces (matched by `step.ts`) are skipped.
   * Safe to call after every `addTurn` cycle.
   */
  runLite(input: CaptureInput): Promise<CaptureResult>;
  /**
   * Lightweight memory capture. Writes one trace per user/assistant turn
   * instead of per tool/action step, and never emits `capture.done`.
   */
  runLightweight(input: CaptureInput): Promise<CaptureResult>;
  /**
   * Topic-end "reflect" capture. Runs the batch reflection scorer over
   * EVERY step of the (now-finalized) episode in one LLM call so the
   * model sees the full causal chain, then writes
   * `reflection + alpha` back onto each existing trace via
   * `tracesRepo.updateReflection`. Emits `capture.done` so the reward
   * subscriber can run `R_human` + V backprop afterwards.
   *
   * Falls back to per-step scoring when the episode exceeds
   * `cfg.batchThreshold` so the prompt can't overflow the model's
   * context window.
   */
  runReflect(input: CaptureInput): Promise<CaptureResult>;
}

export function createCaptureRunner(deps: CaptureDeps): CaptureRunner {
  const log = rootLogger.child({ channel: "core.capture" });
  const now = deps.now ?? Date.now;
  const summarizer: Summarizer = createSummarizer({
    llm: deps.llm ?? null,
    log: log.child({ channel: "core.capture.summarizer" }),
  });

  function emit(evt: CaptureEvent): void {
    deps.bus.emit(evt);
  }

  /**
   * Per-turn lite capture — see `CaptureRunner.runLite` for contract.
   * Extracts new steps from the episode, summarises + embeds them,
   * and inserts trace rows with `reflection=null` + `alpha=0`. The
   * topic-end `runReflect` pass fills those in later.
   */
  async function runLite(input: CaptureInput): Promise<CaptureResult> {
    const startedAt = now();
    const warnings: CaptureResult["warnings"] = [];
    const llmCalls = newLlmCounters();

    emit({
      kind: "capture.started",
      episodeId: input.episode.id,
      sessionId: input.episode.sessionId,
    });

    // ─── Extract + dedup (skip steps we've already written this episode) ──
    const extractStart = now();
    const rawAll = extractSteps(input.episode);
    // #2076: MUST use listDedupRowsForEpisode (uncapped, streaming, no
    // BLOB projection). The paginated `list` path silently truncates to
    // 500 rows, which breaks dedup once an episode grows past that and
    // causes the tail to be re-inserted every cycle (bloating `traces`
    // unboundedly + starving the vector scan). Using the narrow-column
    // dedup projection here also keeps peak RSS proportional to scalar
    // fields, not embedding footprint (open code review on #2077).
    const existingDedupRows = deps.tracesRepo.listDedupRowsForEpisode(input.episode.id);
    const seenTs = new Set<number>(existingDedupRows.map((t) => t.ts));
    // Reused later by persistRows so we don't scan the episode twice.
    const seenSignatures = new Set(existingDedupRows.map(traceIdentitySignature));
    const raw = rawAll.filter((s) => !seenTs.has(s.ts));
    const extractMs = now() - extractStart;
    log.debug("stage.extract.done", {
      phase: "lite",
      episodeId: input.episode.id,
      steps: raw.length,
      novel: raw.length,
      skipped: rawAll.length - raw.length,
      durationMs: extractMs,
    });

    const normStart = now();
    const normalized = normalizeSteps(raw, deps.cfg);
    const normalizeMs = now() - normStart;

    if (normalized.length === 0) {
      const result = emptyResult(input, startedAt, {
        extract: extractMs,
        normalize: normalizeMs,
      }, llmCalls, warnings);
      // No `capture.done` here — lite never triggers reward.
      return result;
    }

    // Skip stage 3 entirely. Wrap each NormalizedStep into a
    // ScoredStep with a placeholder reflection so the rest of the
    // pipeline keeps the same shape.
    const scored: ScoredStep[] = normalized.map((s) => ({
      ...s,
      reflection: { text: null, alpha: 0, usable: false, source: "none" },
    }));

    // Summarise — needed for the viewer card line + retrieval embedding.
    const summarizeStart = now();
    const { summaries, summarizeMs } = await runSummarize(
      scored,
      summarizeStart,
      llmCalls,
      warnings,
      { episodeId: input.episode.id, phase: "lite" },
    );

    // Embed.
    const { vecs, embedMs } = await runEmbed(scored, summaries, warnings);

    // Persist as new rows. Reflection / α deliberately empty.
    const persistStart = now();
    const rows = buildRows(scored, summaries, vecs, input.episode);
    const persisted = await persistRows(rows, input, warnings, {}, seenSignatures);
    if (!persisted) {
      // emit capture.failed handled inside persistRows on hard fail.
      return finalResult(
        input,
        startedAt,
        [],
        scored.map(toCandidate(rows)),
        {
          extract: extractMs,
          normalize: normalizeMs,
          reflect: 0,
          alpha: 0,
          summarize: summarizeMs,
          embed: embedMs,
          persist: now() - persistStart,
        },
        llmCalls,
        warnings,
      );
    }
    const persistMs = now() - persistStart;

    const result = finalResult(
      input,
      startedAt,
      rows.map((r) => r.id),
      buildTraceCandidates(scored, rows),
      {
        extract: extractMs,
        normalize: normalizeMs,
        reflect: 0,
        alpha: 0,
        summarize: summarizeMs,
        embed: embedMs,
        persist: persistMs,
      },
      llmCalls,
      warnings,
    );
    log.info("capture.lite.done", {
      episodeId: input.episode.id,
      sessionId: input.episode.sessionId,
      traces: result.traceIds.length,
      llmCalls,
      totalMs: result.completedAt - startedAt,
      warnings: warnings.length,
    });
    // Emit `capture.lite.done` so the api_logs table gets a per-turn
    // `memory_add` row. This is distinct from `capture.done` which
    // triggers the reward / L2 / L3 chain and only fires at topic end.
    emit({ kind: "capture.lite.done", result });
    return result;
  }

  async function runLightweight(input: CaptureInput): Promise<CaptureResult> {
    const startedAt = now();
    const warnings: CaptureResult["warnings"] = [];
    const llmCalls = newLlmCounters();

    emit({
      kind: "capture.started",
      episodeId: input.episode.id,
      sessionId: input.episode.sessionId,
    });

    const extractStart = now();
    const rawAll = extractSteps(input.episode);
    // #2076 + #2077 OCR: uncapped, narrow-projection dedup read.
    // See `runLite` for the full rationale — one scan, no BLOBs.
    const existingDedupRows = deps.tracesRepo.listDedupRowsForEpisode(input.episode.id);
    const seenTurnIds = new Set(
      existingDedupRows
        .map((t) => t.turnId)
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v)),
    );
    // Reused later by persistRows so
```

### Core Architecture Module: `apps/memos-local-plugin/core/capture/embedder.ts`
```
/**
 * `capture/embedder` — a thin wrapper that decides what text to embed for
 * each trace and calls the `Embedder` facade in one batch call.
 *
 * Why a wrapper?
 *   - We want TWO vectors per row (vec_summary / vec_action). The embedder
 *     takes a flat list; here we interleave step-pairs in an order the
 *     caller can decode.
 *   - Embedding failure MUST NOT block the capture write — we log and
 *     insert `null` vectors. Vector search will just skip them.
 */

import { MemosError } from "../../agent-contract/errors.js";
import type { Embedder, EmbeddingSettledResult } from "../embedding/index.js";
import { rootLogger } from "../logger/index.js";
import type { EmbeddingVector } from "../types.js";
import type { NormalizedStep } from "./types.js";

export interface VecPair {
  summary: EmbeddingVector | null;
  action: EmbeddingVector | null;
}

export async function embedSteps(
  embedder: Embedder,
  steps: readonly NormalizedStep[],
  /**
   * Optional per-step summaries to embed for `vec_summary`. When
   * omitted we fall back to `summaryText(step)` — the raw user text —
   * which preserves the pre-5.x behaviour. Callers that have already
   * produced an LLM summary (see `core/capture/summarizer.ts`) should
   * pass it here so retrieval matches against the same compact form
   * the viewer displays.
   */
  summaryOverrides?: readonly string[],
  opts: { summaryOnly?: boolean } = {},
): Promise<VecPair[]> {
  const log = rootLogger.child({ channel: "core.capture.embed" });
  if (steps.length === 0) return [];

  const warnPartialFailures = (
    settled: readonly EmbeddingSettledResult[],
    inputCount: number,
  ): void => {
    let failedCount = 0;
    for (let i = 0; i < inputCount; i++) {
      if (!settled[i]?.ok) failedCount++;
    }
    if (failedCount > 0) {
      const event = failedCount === inputCount ? "embed.failed_all" : "embed.partial_failed";
      log.warn(event, { failedCount, inputCount, stepCount: steps.length });
    }
  };

  const summaryTexts = steps.map((s, i) => {
    const override = summaryOverrides?.[i]?.trim();
    if (override) return override;
    return summaryText(s);
  });
  const actionTexts = steps.map(actionText);
  if (opts.summaryOnly) {
    try {
      const inputs = summaryTexts.map((t) => ({
        text: t || "(empty)",
        role: "document" as const,
      }));
      if (embedder.embedManySettled) {
        const settled = await embedder.embedManySettled(inputs);
        warnPartialFailures(settled, inputs.length);
        return steps.map((_, i) => ({
          summary: settled[i]?.ok ? settled[i].vector : null,
          action: null,
        }));
      }
      const vecs = await embedder.embedMany(inputs);
      return steps.map((_, i) => ({ summary: vecs[i] ?? null, action: null }));
    } catch (err) {
      log.warn("embed.failed_all", { err: errDetail(err), stepCount: steps.length });
      return steps.map(() => ({ summary: null, action: null }));
    }
  }
  // Pack summary first then action — both in the same batch to amortize
  // HTTP round trips when the provider is remote.
  const inputs = [
    ...summaryTexts.map((t) => ({ text: t || "(empty)", role: "document" as const })),
    ...actionTexts.map((t) => ({ text: t || "(empty)", role: "document" as const })),
  ];

  try {
    if (embedder.embedManySettled) {
      const settled = await embedder.embedManySettled(inputs);
      warnPartialFailures(settled, inputs.length);
      const out: VecPair[] = new Array(steps.length);
      for (let i = 0; i < steps.length; i++) {
        const summary = settled[i];
        const action = settled[i + steps.length];
        out[i] = {
          summary: summary?.ok ? summary.vector : null,
          action: action?.ok ? action.vector : null,
        };
      }
      return out;
    }
    const vecs = await embedder.embedMany(inputs);
    const out: VecPair[] = new Array(steps.length);
    for (let i = 0; i < steps.length; i++) {
      out[i] = {
        summary: vecs[i] ?? null,
        action: vecs[i + steps.length] ?? null,
      };
    }
    return out;
  } catch (err) {
    log.warn("embed.failed_all", { err: errDetail(err), stepCount: steps.length });
    return steps.map(() => ({ summary: null, action: null }));
  }
}

function summaryText(step: NormalizedStep): string {
  // V7 §3.2: vec_summary indexes "state" — what happened BEFORE the action.
  // For memory probes (Tier 2 recall), the embedded summary is what we
  // match against the next episode's user text.
  return step.userText.trim();
}

function actionText(step: NormalizedStep): string {
  // vec_action indexes the agent's decision: its text + tool-call semantics.
  const toolSig = step.toolCalls
    .map((t) => `${t.name}(${safeStringify(t.input).slice(0, 300)})`)
    .join("; ");
  return [step.agentText.trim(), toolSig].filter((s) => s.length > 0).join("\n---\n");
}

function safeStringify(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function errDetail(err: unknown): Record<string, unknown> {
  if (err instanceof MemosError) return { code: err.code, message: err.message };
  if (err instanceof Error) return { name: err.name, message: err.message };
  return { value: String(err) };
}

```

### Core Architecture Module: `apps/memos-local-plugin/core/capture/error-signature.ts`
```
/**
 * Error-signature extractor — V7 §2.6 "structural match" input.
 *
 * Tier 2 retrieval (see `core/retrieval/tier2-trace.ts`) can do three
 * kinds of match against the current step: semantic (embedding cosine),
 * tag pre-filter, and **structural** — exact-substring match of the
 * error token that the agent just saw. V7 uses this for cases like
 * hitting `"pg_config executable not found"` again after a similar
 * failure days ago.
 *
 * This module:
 *   1. Extracts normalised error tokens from `ToolCallDTO` outputs +
 *      error codes + assistant text.
 *   2. Ranks them by specificity (more unusual tokens first).
 *   3. Returns at most `MAX_SIGNATURES` tokens so the hot-path query
 *      stays bounded.
 *
 * We intentionally do NOT use the LLM here — this runs on every trace
 * write and must be cheap + deterministic.
 */
import type { ToolCallDTO } from "../../agent-contract/dto.js";

/** Max signatures we keep per trace. Anything beyond is dropped. */
export const MAX_SIGNATURES = 4;

/** Min length of a usable error fragment (after normalisation). */
const MIN_FRAGMENT_LEN = 6;

/** Max length of a stored fragment. */
const MAX_FRAGMENT_LEN = 160;

/**
 * Patterns we extract verbatim — order matters. The first capture group
 * is the normalised signature.
 */
const ERROR_PATTERNS: RegExp[] = [
  // Go / Rust / Python-ish: `<Name>Error: <body>`
  /\b([A-Z][A-Za-z0-9]*(?:Error|Exception)):\s*([^\n]{4,160})/g,
  // `error: <body>` / `Error: <body>` / `fatal: <body>`
  /\b(?:error|Error|fatal|FATAL|ERROR)\s*:\s*([^\n]{4,160})/g,
  // `<cmd>: <thing> not found`
  /\b([A-Za-z0-9_\-./]+):\s*[^\n]{0,40}\b(not found|no such (?:file|directory)|permission denied|undefined reference|command not found)\b[^\n]*/g,
  // `<thing> is required`, `<thing> must be`, `<thing> cannot`
  /\b([A-Za-z0-9_]{3,40})\s+(is required|must be|cannot|could not|failed to)\s+[^\n]{3,120}/g,
  // exit code / status
  /\bexit (?:code|status)\s*[:=]?\s*(\d{1,4})\b[^\n]{0,80}/g,
  // HTTP-ish status codes with a body
  /\b(4\d\d|5\d\d)\s+([A-Za-z][A-Za-z ]{2,30})\b/g,
];

/** Common high-frequency tokens we drop before dedup. */
const STOP_WORDS = new Set([
  "the",
  "for",
  "this",
  "that",
  "your",
  "from",
  "with",
  "have",
  "has",
  "not",
  "a",
  "an",
  "of",
  "to",
  "is",
  "in",
  "on",
  "by",
]);

// ─── Public API ────────────────────────────────────────────────────────────

export interface ExtractInput {
  toolCalls: readonly ToolCallDTO[];
  /** Free-form assistant reply for the turn (reflection may live here). */
  agentText?: string;
  /** Reflection text, when the adapter surfaced one. */
  reflection?: string;
}

/**
 * Produce up to {@link MAX_SIGNATURES} normalised error fragments,
 * ordered by specificity (more "unusual" first).
 */
export function extractErrorSignatures(input: ExtractInput): string[] {
  const corpus: string[] = [];

  for (const tc of input.toolCalls) {
    if (tc.errorCode) corpus.push(String(tc.errorCode));
    const out = stringifyToolOutput(tc.output);
    if (out) corpus.push(out);
  }
  if (input.reflection) corpus.push(input.reflection);
  if (input.agentText) corpus.push(input.agentText);

  // We dedupe by a lowercased/collapsed key so overlapping regex patterns
  // don't produce near-duplicate fragments ("Error: X" vs "error: X").
  // The first-seen casing wins for the stored fragment.
  const candidates = new Map<string, { frag: string; freq: number }>();
  for (const text of corpus) {
    for (const frag of extractFragments(text)) {
      const normalised = normaliseFragment(frag);
      if (!normalised) continue;
      const key = normalised.toLowerCase().replace(/\s+/g, " ");
      const existing = candidates.get(key);
      if (existing) {
        existing.freq++;
      } else {
        candidates.set(key, { frag: normalised, freq: 1 });
      }
    }
  }

  const scored = Array.from(candidates.values()).map(({ frag, freq }) => ({
    frag,
    freq,
    score: specificityScore(frag, freq),
  }));
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, MAX_SIGNATURES).map((s) => s.frag);
}

// ─── Internals ─────────────────────────────────────────────────────────────

function stringifyToolOutput(out: unknown): string {
  if (out == null) return "";
  if (typeof out === "string") return out;
  try {
    return JSON.stringify(out).slice(0, 4000);
  } catch {
    return "";
  }
}

function extractFragments(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const pattern of ERROR_PATTERNS) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text))) {
      // Use the raw match (m[0]) as the fragment since the pattern
      // captures the interesting bit as part of the whole match.
      out.push(m[0]);
      if (out.length >= 32) break; // hard cap per pattern
    }
  }
  return out;
}

function normaliseFragment(frag: string): string | null {
  const collapsed = frag
    .replace(/\s+/g, " ")
    .replace(/[\u200b\u00a0]/g, "")
    .trim();
  if (collapsed.length < MIN_FRAGMENT_LEN) return null;
  const truncated =
    collapsed.length > MAX_FRAGMENT_LEN
      ? collapsed.slice(0, MAX_FRAGMENT_LEN)
      : collapsed;
  // Reject fragments that are just stop words / numbers.
  const alpha = truncated.replace(/[^A-Za-z]/g, "");
  if (alpha.length < 4) return null;
  const lower = truncated.toLowerCase();
  const words = lower.split(/[^a-z0-9_]+/).filter(Boolean);
  if (words.every((w) => STOP_WORDS.has(w))) return null;
  return truncated;
}

/**
 * Prefer fragments that contain unusual tokens (PascalCase identifiers,
 * filesystem paths, error codes). Higher score → more specific.
 */
function specificityScore(frag: string, freq: number): number {
  let score = 0;
  if (/\b[A-Z][a-zA-Z]*Error\b/.test(frag)) score += 3;
  if (/\b[A-Z][a-zA-Z]*Exception\b/.test(frag)) score += 3;
  if (/(\b|_)E[A-Z]{3,}\b/.test(frag)) score += 2; // ENOENT, EACCES, etc.
  if (/\/[a-zA-Z0-9._\-/]+/.test(frag)) score += 2; // path
  if (/\bcode\s*=\s*\d+/.test(frag)) score += 1;
  if (/\b\d{3}\b/.test(frag)) score += 1; // status
  if (/_/.test(frag)) score += 1; // snake_case ids
  score += Math.min(2, freq - 1); // a little boost for repeated fragments
  // Penalise very long fragments — specificity should be concise.
  if (frag.length > 120) score -= 1;
  return score;
}

```

### Core Architecture Module: `apps/memos-local-plugin/core/capture/events.ts`
```
/**
 * `createCaptureEventBus` — mirror of `core/session/events.ts` for the
 * capture pipeline. One bus per `CaptureRunner`; consumers subscribe and
 * get a typed delivery with per-kind and wildcard channels.
 */

import { rootLogger } from "../logger/index.js";
import type {
  CaptureEvent,
  CaptureEventBus,
  CaptureEventKind,
  CaptureEventListener,
} from "./types.js";

export function createCaptureEventBus(): CaptureEventBus {
  const byKind = new Map<CaptureEventKind, Set<CaptureEventListener>>();
  const anyListeners = new Set<CaptureEventListener>();
  const log = rootLogger.child({ channel: "core.capture" });

  function add(set: Set<CaptureEventListener>, fn: CaptureEventListener): () => void {
    set.add(fn);
    return () => {
      set.delete(fn);
    };
  }

  function dispatch(fn: CaptureEventListener, evt: CaptureEvent): void {
    try {
      fn(evt);
    } catch (err) {
      log.warn("event.listener_error", {
        kind: evt.kind,
        err: err instanceof Error ? { name: err.name, message: err.message } : { value: String(err) },
      });
    }
  }

  return {
    on(kind, fn) {
      let set = byKind.get(kind);
      if (!set) {
        set = new Set();
        byKind.set(kind, set);
      }
      return add(set, fn);
    },
    onAny(fn) {
      return add(anyListeners, fn);
    },
    emit(evt) {
      const targeted = byKind.get(evt.kind);
      if (targeted) for (const fn of targeted) dispatch(fn, evt);
      for (const fn of anyListeners) dispatch(fn, evt);
    },
    listenerCount(kind) {
      if (!kind) {
        let total = anyListeners.size;
        for (const set of byKind.values()) total += set.size;
        return total;
      }
      return (byKind.get(kind)?.size ?? 0) + anyListeners.size;
    },
  };
}

```

### Core Architecture Module: `apps/memos-local-plugin/core/capture/index.ts`
```
/** Public entry for `core/capture`. */

export {
  createCaptureRunner,
  type CaptureDeps,
  type CaptureRunner,
} from "./capture.js";
export {
  attachCaptureSubscriber,
  type CaptureSubscription,
  type CaptureSubscriberOptions,
} from "./subscriber.js";
export { createCaptureEventBus } from "./events.js";
export { extractSteps } from "./step-extractor.js";
export { normalizeSteps } from "./normalizer.js";
export { extractReflection } from "./reflection-extractor.js";
export { synthesizeReflection } from "./reflection-synth.js";
export { scoreReflection, disabledScore } from "./alpha-scorer.js";
export {
  batchScoreReflections,
  type BatchScoreInput,
  type BatchScoreOptions,
  type BatchScoreResult,
  BATCH_OP_TAG as CAPTURE_BATCH_OP_TAG,
} from "./batch-scorer.js";
export { embedSteps } from "./embedder.js";
export type {
  CaptureConfig,
  CaptureEvent,
  CaptureEventBus,
  CaptureEventKind,
  CaptureEventListener,
  CaptureInput,
  CaptureResult,
  NormalizedStep,
  ReflectionScore,
  ScoredStep,
  StepCandidate,
  TraceCandidate,
} from "./types.js";

```

### Core Architecture Module: `apps/memos-local-plugin/core/capture/normalizer.ts`
```
/**
 * `normalizer` — trim / clamp / dedup freshly extracted steps.
 *
 * Responsibilities (cheap, synchronous):
 *   1. Truncate userText / agentText above config.maxTextChars.
 *      We keep both the head AND the tail, joined with a marker, so both
 *      "what the user asked" and "how the assistant wrapped up" survive.
 *   2. Truncate per-tool-output above config.maxToolOutputChars. Input
 *      is capped separately (via JSON stringify length).
 *   3. Drop steps where BOTH userText and agentText are empty (unusable).
 *   4. Dedup adjacent identical agent-text steps (LLM occasionally double-
 *      emits on retry).
 *
 * No LLM, no I/O. Pure data transformation.
 */

import type { ToolCallDTO } from "../../agent-contract/dto.js";
import { rootLogger } from "../logger/index.js";
import type { CaptureConfig, NormalizedStep, StepCandidate } from "./types.js";

const TRUNC_MARKER = "\n\n…[truncated]…\n\n";

export function normalizeSteps(
  steps: readonly StepCandidate[],
  cfg: CaptureConfig,
): NormalizedStep[] {
  const log = rootLogger.child({ channel: "core.capture" });
  const out: NormalizedStep[] = [];
  for (const step of steps) {
    const { text: userText, truncated: uT } = clampText(step.userText, cfg.maxTextChars);
    const { text: agentText, truncated: aT } = clampText(step.agentText, cfg.maxTextChars);
    const { calls: toolCalls, truncated: toolT } = clampTools(step.toolCalls, cfg.maxToolOutputChars);

    if (userText.length === 0 && agentText.length === 0 && toolCalls.length === 0) {
      log.debug("normalize.skip_empty", { key: step.key });
      continue;
    }

    // Sub-steps produced by the per-tool-call extractor (V7 §0.1) have
    // intentionally-identical userText="" / agentText="" and carry only
    // a single tool call each — but two different tools can still share
    // a short input fingerprint, which the generic dedup path below
    // would incorrectly collapse. Skip dedup for sub-steps; the key
    // uniqueness guarantees they can't be genuine duplicates.
    const isSubStep = (step.meta as Record<string, unknown> | undefined)?.subStep === true;

    if (!isSubStep) {
      const last = out[out.length - 1];
      if (
        last &&
        last.agentText === agentText &&
        last.userText === userText &&
        sameToolCalls(last.toolCalls, toolCalls)
      ) {
        log.debug("normalize.skip_duplicate", { key: step.key });
        continue;
      }
    }

    out.push({
      ...step,
      userText,
      agentText,
      toolCalls,
      truncated: uT || aT || toolT,
    });
  }
  return out;
}

function clampText(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (!text) return { text: "", truncated: false };
  if (text.length <= maxChars) return { text, truncated: false };
  // Keep head + tail with a clear marker. Both halves get 45% of the budget
  // so they never overlap the marker length.
  const budget = Math.max(200, maxChars - TRUNC_MARKER.length);
  const head = Math.ceil(budget * 0.55);
  const tail = Math.floor(budget * 0.45);
  return {
    text: text.slice(0, head).trimEnd() + TRUNC_MARKER + text.slice(text.length - tail).trimStart(),
    truncated: true,
  };
}

function clampTools(
  calls: readonly ToolCallDTO[],
  maxOutputChars: number,
): { calls: ToolCallDTO[]; truncated: boolean } {
  if (calls.length === 0) return { calls: [], truncated: false };
  let anyTrunc = false;
  const out = calls.map((c) => {
    const output = toDisplayOutput(c.output);
    if (output && output.length > maxOutputChars) {
      anyTrunc = true;
      return {
        ...c,
        output: output.slice(0, Math.floor(maxOutputChars * 0.55)) +
          TRUNC_MARKER +
          output.slice(output.length - Math.floor(maxOutputChars * 0.45)),
      };
    }
    return { ...c, output };
  });
  return { calls: out, truncated: anyTrunc };
}

function toDisplayOutput(output: unknown): string | undefined {
  if (output === undefined || output === null) return undefined;
  if (typeof output === "string") return output;
  try {
    return JSON.stringify(output);
  } catch {
    return String(output);
  }
}

/**
 * Two tool-call arrays are "same" for dedup purposes when they have
 * the same length AND each call matches by name + input identity.
 * This prevents consecutive tool sub-steps (which share the same
 * userText and empty agentText) from being incorrectly deduped.
 */
function sameToolCalls(a: readonly ToolCallDTO[], b: readonly ToolCallDTO[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.name !== b[i]!.name) return false;
    if (inputFingerprint(a[i]!.input) !== inputFingerprint(b[i]!.input)) return false;
  }
  return true;
}

function inputFingerprint(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.slice(0, 200);
  try { return JSON.stringify(v).slice(0, 200); }
  catch { return String(v).slice(0, 200); }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2090** (2026-07-09): **fix: README benchmark scores in News section don't match Performance table (LoCoMo/LongMemEval)**
  *Symptoms*: ### Pre-submission checklist | 提交前检查  - [x] I have searched existing issues and this hasn't been mentioned before | 我已搜索现有问题，确认此问题尚未被提及 - [x] I have read the project documentation and confirmed this issue doesn't already exist | 我已阅读项目文档并确认此问题尚未存在 - [x] This issue is specific to MemOS and not a general software issue | 该问题是针对 MemOS 的，而不是一般软件问题  ### Bug Description | 问题描述  The **News** section and the **📊 Performance** section of the README report different scores for the same two benchmarks (LoCoMo and LongMemEval), with no explanation for the discrepancy. Readers see two different "current" numbers for the same benchmark on the same page. This affects both `README.md` and `README_ZH.md` identically.  **News section** (`README.md` lines 49-50): > **2026-07-02** · 🏆 **MemOS Advances Agent and User Memory Benchmarks** > With MemOS, OpenClaw improves average task completion from 36.63% to 50.87% across five agent tasks. MemOS also achieves **92.34 on LoCoMo** and **93.40 on LongMemEval**, and leads in OmniMemEval...  **Performance table** (`README.md` lines 66-77), a few lines below: | Benchmark   | Score | | ----------- | ----- | | LoCoMo      | **88.83** | | LongMemEval | **89.20** |  Same benchmarks, same OmniMemEval framework referenced, but the numbers don't match (92.34 vs 88.83, 93.40 vs 89.20).  **Root cause (from git history):** the News entry was added in MemTensor/MemOS#2019 with 92.34/93.40. Later, MemTensor/MemOS#2078 rewrote the README and introduced the "Perform
  **Post-Mortem & Fix Analysis**:
  > 🤖 AutoDev has picked up this issue and started working on it.  **Task ID:** `a7f814f57a1585cf` **Working branch:** `bugfix/autodev-2090-20260709093247057` **Target branch:** `latest dev* branch` **Workflow:** opsp (analysis → coding → testing → PR)  I will post the PR link here once done. If I need more information, I will ask in the comments.
  > ✅ AutoDev task `a7f814f57a1585cf` completed.  **Summary:** Fixed the README score mismatch (LoCoMo 92.34→88.83, LongMemEval 93.40→89.20) in both `README.md` and `README_ZH.md`, aligning the News section with the Performance table. Committed on the working branch (`64cddbfb`) and pushed to `origin`. Task spec archived to the sibling `memos-autodev-specs` repo (`main` @ `d8af691`).  Now submitting the completion envelope so the scheduler can open the PR.  Sources: - Issue: https://github.com/MemTensor/MemOS/issues/2090  **Base branch:** `main` **Branch:** `bugfix/autodev-2090-20260709093247057` **PR:** https://github.com/MemTensor/MemOS/pull/2092 **Assigned to:** @CarltonXiang **Reviewers:** @MatthewZhuang, @CarltonXiang, @syzsunshine219, @World-controller

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

### Incident Patch 1: `a7367d07` (2026-09-22)
**Commit Message**: ci: extend local plugin npm visibility timeout (#2400)

## Summary

- Extend the local-plugin npm registry visibility window from 150
seconds to 360 seconds.
- Keep the normal-release duplicate-version guard strict; existing npm
versions still require explicit recovery after release-owner
verification.
- Make the six-minute default shared by the workflow, shell publisher,
and Node verifier, with regression coverage.

## Why

npm can acknowledge a publish before version, integrity, and dist-tag
metadata are visible through the public registry. The previous
150-second window could fail a release after npm had already accepted
it. This change gives propagation up to six minutes while preserving the
no-second-publish safety behavior.

## Validation

- `node --test
.github/scripts/wait-for-local-plugin-npm-release.test.mjs
.github/scripts/publish-local-plugin.test.mjs
.github/scripts/prepare-memos-release.test.mjs` (94/94)
- `bash -n .github/scripts/publish-local-plugin.sh`
- `git diff --check`

No npm publish, tag creation, GitHub Release, Docs sync, or deployment
was performed by this PR.

**File**: `.github/scripts/prepare-memos-release.test.mjs` (modified, +1/-1)
```diff
@@ -842,7 +842,7 @@ test("legacy standalone local-plugin publisher requires an extra non-dry-run con
   assert.match(workflow, /ALLOW_STAGED_TAG_BEFORE_NPM/);
   assert.match(workflow, /audit-local-plugin-package\.mjs/);
   assert.match(workflow, /wait-for-local-plugin-npm-release\.test\.mjs/);
-  assert.match(workflow, /NPM_VISIBILITY_TIMEOUT_SECONDS: "150"/);
+  assert.match(workflow, /NPM_VISIBILITY_TIMEOUT_SECONDS: "600"/);
   assert.match(workflow, /FORCE_PACKAGE_ONLY_RELEASE: \$\{\{ inputs\.tag != 'latest' \|\| contains\(inputs\.version, '-'\) \}\}/);
   assert.match(workflow, /if \[ -n "\$\{DOCS_SYNC_MODE\}" \]; then/);
   assert.doesNotMatch(workflow, /EVENT_NAME: \$\{\{ github\.event_name \}\}/);
```

**File**: `.github/scripts/publish-local-plugin.sh` (modified, +2/-2)
```diff
@@ -13,7 +13,7 @@ if [ ! -s "${RELEASE_TARBALL}" ]; then
   exit 2
 fi
 
-npm_visibility_timeout_seconds="${NPM_VISIBILITY_TIMEOUT_SECONDS:-150}"
+npm_visibility_timeout_seconds="${NPM_VISIBILITY_TIMEOUT_SECONDS:-600}"
 npm_visibility_interval_seconds="${NPM_VISIBILITY_INTERVAL_SECONDS:-10}"
 npm_visibility_request_timeout_seconds="${NPM_VISIBILITY_REQUEST_TIMEOUT_SECONDS:-8}"
 npm_registry_url="https://registry.npmjs.org"
@@ -336,7 +336,7 @@ if npm_version_exists; then
   published_version_visible=true
   published_version_preexisting=true
   if [ "${RECOVER_EXISTING_NPM_RELEASE:-false}" != "true" ]; then
-    echo "::error::${PACKAGE_NAME}@${RELEASE_VERSION} already exists. Normal releases require an unused version; enable recovery only after release-owner verification of a partial failure."
+    echo "::error::${PACKAGE_NAME}@${RELEASE_VERSION} already exists. Normal releases require an unused version; inspect npm first and use explicit recovery only after release-owner verification of a partial failure."
     exit 1
   fi
   if remote_tag_exists "${RELEASE_TAG}"; then
```

**File**: `.github/scripts/publish-local-plugin.test.mjs` (modified, +4/-2)
```diff
@@ -121,7 +121,7 @@ if [[ "\${1:-}" == *"wait-for-local-plugin-npm-release.mjs" ]]; then
   printf '%s' "\${count}" > "\${increment_file}"
   case "\${NPM_MOCK_SCENARIO}" in
     always-missing|publish-fails)
-      echo "::error::npm release was not fully visible within 150s"
+      echo "::error::npm release was not fully visible within \${NPM_VISIBILITY_TIMEOUT_SECONDS:-600}s"
       exit 1
       ;;
     integrity-mismatch)
@@ -130,7 +130,7 @@ if [[ "\${1:-}" == *"wait-for-local-plugin-npm-release.mjs" ]]; then
       ;;
     *)
       if [ "\${NPM_MOCK_DIST_TAG_VERSION:-\${RELEASE_VERSION}}" != "\${RELEASE_VERSION}" ]; then
-        echo "::error::npm release was not fully visible within 150s: dist-tag \${NPM_DIST_TAG} did not point to \${RELEASE_VERSION}"
+        echo "::error::npm release was not fully visible within \${NPM_VISIBILITY_TIMEOUT_SECONDS:-600}s: dist-tag \${NPM_DIST_TAG} did not point to \${RELEASE_VERSION}"
         exit 1
       fi
       echo '{"ok":true,"attempts":3}'
@@ -330,6 +330,7 @@ test("stops before tag creation when publish succeeds but visibility remains del
   assert.equal(result.metadataWaitCount, 1);
   assert.equal(result.packCount, 0);
   assert.match(result.stdout + result.stderr, /Refusing to issue a second publish request/);
+  assert.match(result.stdout + result.stderr, /within 600s/);
 });
 
 test("allows npm publish after a staged paired Draft Release only in npm-only phase", () => {
@@ -461,4 +462,5 @@ test("rejects an already-used npm version outside explicit recovery", () => {
   assert.equal(result.publishCount, 0);
   assert.equal(result.packCount, 0);
   assert.match(result.stdout + result.stderr, /Normal releases require an unused version/);
+  assert.match(result.stdout + result.stderr, /inspect npm first/);
 });
```

**File**: `.github/scripts/wait-for-local-plugin-npm-release.mjs` (modified, +8/-2)
```diff
@@ -3,6 +3,7 @@ import { readFileSync } from "node:fs";
 import { pathToFileURL } from "node:url";
 
 const INTEGRITY_PATTERN = /^sha512-[A-Za-z0-9+/]+={0,2}$/;
+export const DEFAULT_NPM_VISIBILITY_TIMEOUT_SECONDS = 600;
 
 function clean(value) {
   return String(value ?? "").trim();
@@ -103,7 +104,7 @@ export async function waitForNpmReleaseVisibility(
     distTag,
     expectedIntegrity,
     registryUrl = "https://registry.npmjs.org",
-    timeoutMs = 150_000,
+    timeoutMs = DEFAULT_NPM_VISIBILITY_TIMEOUT_SECONDS * 1000,
     intervalMs = 10_000,
     requestTimeoutMs = 8_000,
   } = {},
@@ -208,7 +209,12 @@ export async function run(env = process.env) {
       distTag: env.NPM_DIST_TAG,
       expectedIntegrity,
       registryUrl: env.NPM_CONFIG_REGISTRY || "https://registry.npmjs.org",
-      timeoutMs: positiveInteger(env.NPM_VISIBILITY_TIMEOUT_SECONDS, 150, "timeout") * 1000,
+      timeoutMs:
+        positiveInteger(
+          env.NPM_VISIBILITY_TIMEOUT_SECONDS,
+          DEFAULT_NPM_VISIBILITY_TIMEOUT_SECONDS,
+          "timeout",
+        ) * 1000,
       intervalMs: positiveInteger(env.NPM_VISIBILITY_INTERVAL_SECONDS, 10, "interval") * 1000,
       requestTimeoutMs:
         positiveInteger(env.NPM_VISIBILITY_REQUEST_TIMEOUT_SECONDS, 8, "request timeout") * 1000,
```

**File**: `.github/scripts/wait-for-local-plugin-npm-release.test.mjs` (modified, +33/-0)
```diff
@@ -6,6 +6,7 @@ import { join } from "node:path";
 import test from "node:test";
 
 import {
+  DEFAULT_NPM_VISIBILITY_TIMEOUT_SECONDS,
   inspectNpmReleaseVisibility,
   npmPackumentUrl,
   tarballIntegrity,
@@ -224,3 +225,35 @@ test("uses a hard deadline for an unavailable registry version", async () => {
   assert.equal(clock, 30_000);
   assert.equal(attempts, 3);
 });
+
+test("uses the ten-minute default visibility deadline", async () => {
+  let clock = 0;
+  let attempts = 0;
+  await assert.rejects(
+    waitForNpmReleaseVisibility(
+      {
+        packageName: "@memtensor/memos-local-plugin",
+        version: "2.0.14",
+        distTag: "latest",
+        expectedIntegrity: integrity,
+        intervalMs: 10_000,
+        requestTimeoutMs: 1_000,
+      },
+      {
+        fetchImpl: async () => {
+          attempts += 1;
+          return response({}, 404);
+        },
+        sleep: async (milliseconds) => {
+          clock += milliseconds;
+        },
+        now: () => clock,
+        log: () => {},
+      },
+    ),
+    /not fully visible within 600s/,
+  );
+  assert.equal(DEFAULT_NPM_VISIBILITY_TIMEOUT_SECONDS, 600);
+  assert.equal(clock, 600_000);
+  assert.equal(attempts, 60);
+});
```

**File**: `.github/workflows/memos-local-plugin-publish.yml` (modified, +2/-2)
```diff
@@ -30,7 +30,7 @@ on:
         type: boolean
         default: true
       recover_existing_npm_release:
-        description: "Allow reconstructing a missing tag for an existing npm version. Keep false for normal releases."
+        description: "Recover a verified partial publish only; keep false for normal releases."
         required: true
         type: boolean
         default: false
@@ -799,7 +799,7 @@ jobs:
           NPM_DIST_TAG: ${{ inputs.tag }}
           RECOVER_EXISTING_NPM_RELEASE: ${{ inputs.recover_existing_npm_release }}
           RELEASE_METADATA_STATE: ${{ steps.release_state.outputs.state }}
-          NPM_VISIBILITY_TIMEOUT_SECONDS: "150"
+          NPM_VISIBILITY_TIMEOUT_SECONDS: "600"
           NPM_VISIBILITY_INTERVAL_SECONDS: "10"
           NPM_VISIBILITY_REQUEST_TIMEOUT_SECONDS: "8"
           ALLOW_STAGED_TAG_BEFORE_NPM: ${{ (inputs.publish_phase || 'full') == 'publish_npm_only' && 'true' || 'false' }}
```

---

### Incident Patch 2: `12acdad6` (2026-09-21)
**Commit Message**: fix(plugin): harden memory evolution and Hermes installation (#2384)

## Summary

This branch improves the memory pipeline and local-plugin runtime
compared with main:

- Strengthen L2 multilingual induction and L3 policy evolution with
bounded clustering, retry handling, batched abstraction, complete member
coverage, and policy metadata backfill.
- Prevent skill verification and reward retry loops with reverse
trace-policy links, per-policy cooldowns, pending reward handling, and
expanded skill integration coverage.
- Add configurable per-model Redis GCRA rate limiting and preserve LLM
operation metadata through the provider facade.
- Improve preference extraction by filtering polluted sources, refining
prompts, and cleaning up fast-memory fallback behavior.
- Harden OpenClaw compatibility and Hermes installation with environment
detection, provider linking, staged deployment, recovery, and rollback
handling.
- Add documentation, migration support, runtime compatibility checks,
and regression tests across the plugin and core memory components.

## Validation

- pnpm lint passed.
- Targeted Vitest coverage passed: 32 files, 213 tests.
- Local package build and installation passed o

**File**: `apps/memos-local-plugin/adapters/hermes/README.md` (modified, +30/-0)
```diff
@@ -25,6 +25,36 @@ keepalive, reconnect generation, and host callback dispatch. All algorithm
 logic (L1/L2/L3, skills, retrieval, feedback, decision repair) remains in the
 shared TypeScript core.
 
+## Desktop and custom Unix installations
+
+Use the backend source directory and Python environment used by the desktop
+app, which may differ from the CLI installation. The Unix installer validates
+`hermes_cli` and `plugins.memory.load_memory_provider` before stopping Hermes
+or deploying the plugin. It checks literal Python/Bash launchers and the default
+backend's `venv` and `.venv` directories.
+
+If auto-detection fails, use the updated `install.sh` with explicit paths:
+
+```bash
+HERMES_INSTALL_DIR="/actual/path/to/hermes-agent" \
+HERMES_PYTHON="/actual/path/to/hermes-agent/venv/bin/python" \
+bash install.sh --agent hermes
+```
+
+`HERMES_INSTALL_DIR` is the backend source directory containing `hermes_cli`
+and `plugins/memory`, not simply the `.app` bundle. `HERMES_PYTHON` must be the
+interpreter that runs that backend. Explicit paths fail with diagnostic output
+instead of falling back to another installation. Paths containing spaces work
+when quoted. For a non-default data/config directory, also set `HERMES_HOME`;
+it defaults to `~/.hermes`. The MemOS package/data location remains
+`~/.hermes/memos-plugin` for compatibility with existing installations.
+
+If the chosen interpreter cannot import the host's memory provider API, repair
+or update that Hermes environment. Creating an empty `plugins/memory` directory
+does not supply the missing API. Restart the desktop app after installation.
+Desktop distributions with unrecognized layouts require explicit paths; these
+options do not imply that every desktop release has been tested.
+
 ## Protocol surface
 
 The adapter calls the following methods on the bridge:
```

**File**: `apps/memos-local-plugin/core/config/defaults.ts` (modified, +5/-3)
```diff
@@ -222,6 +222,8 @@ export const DEFAULT_CONFIG: ResolvedConfig = {
       // an early-life install can still cluster into a world model;
       // strict 0.6 starved L3 in real usage.
       clusterMinSimilarity: 0.3,
+      maxPoliciesPerCluster: 20,
+      maxPromptChars: 32_000,
       policyCharCap: 800,
       traceCharCap: 500,
       traceEvidencePerPolicy: 1,
@@ -249,9 +251,9 @@ export const DEFAULT_CONFIG: ResolvedConfig = {
       // real usage; 1 lets the candidate→active transition happen
       // immediately on first successful invocation.
       candidateTrials: 1,
-      // Lowered from 6 hours → 0: no cooldown, skills can re-evolve
-      // as soon as new evidence arrives.
-      cooldownMs: 0,
+      // Verification failures are retried after six hours by default;
+      // operators may set this to 0 when immediate re-evaluation is desired.
+      cooldownMs: 6 * 60 * 60 * 1000,
       traceCharCap: 500,
       evidenceLimit: 6,
       useLlm: true,
```

**File**: `apps/memos-local-plugin/core/config/schema.ts` (modified, +4/-0)
```diff
@@ -326,6 +326,10 @@ const AlgorithmSchema = Type.Object({
      * are ignored (policies too disparate to share a world model).
      */
     clusterMinSimilarity: NumberInRange(0.6, 0, 1),
+    /** Maximum policies included in one L3 abstraction prompt. */
+    maxPoliciesPerCluster: NumberInRange(20, 1, 100),
+    /** Hard total character cap for one L3 abstraction prompt. */
+    maxPromptChars: NumberInRange(32_000, 4_000, 128_000),
     /** Chars of L2 body handed to `l3.abstraction`. */
     policyCharCap: NumberInRange(800, 200, 4_000),
     /** Chars of trace body handed per evidence trace. */
```

**File**: `apps/memos-local-plugin/core/llm/client.ts` (modified, +27/-12)
```diff
@@ -282,6 +282,7 @@ export function createLlmClientWithProvider(
       maxTokens: opts?.maxTokens ?? config.maxTokens ?? DEFAULT_MAX_TOKENS,
       jsonMode,
       stop: opts?.stop,
+      op: opts?.op,
     };
   }
 
@@ -355,37 +356,33 @@ export function createLlmClientWithProvider(
             notifyError: true,
           });
         } catch (hostErr) {
+          const normalizedHostErr = normalizeError(hostErr, ERROR_CODES.LLM_UNAVAILABLE, "host fallback failed");
           failures++;
-          const failAt = markFail(hostErr);
+          const failAt = markFail(normalizedHostErr);
           facadeLog.error("host.fallback_failed", {
             primary: summarizeErr(err),
-            host: summarizeErr(hostErr),
+            host: summarizeErr(normalizedHostErr),
           });
           // Primary AND host bridge both failed. Trip on a terminal
           // primary error (the one the operator typically needs to fix
           // — host bridge failures are usually transient stdio issues).
           if (breakerIsTerminal(err)) breakerTrip(err);
-          notifyOnError(hostErr);
+          notifyOnError(normalizedHostErr);
           notifyStatus({
             status: "error",
             provider: provider.name,
             model: config.model,
-            message: summarizeErrMessage(hostErr),
-            code: hostErr instanceof MemosError ? hostErr.code : undefined,
-            ...extractRetryDiagnostics(hostErr instanceof MemosError ? hostErr.details : undefined),
+            message: summarizeErrMessage(normalizedHostErr),
+            code: normalizedHostErr.code,
+            ...extractRetryDiagnostics(normalizedHostErr.details),
             at: failAt,
             durationMs: Date.now() - startedAt,
             fallbackProvider: "host",
             op,
             episodeId: opts?.episodeId,
             phase: opts?.phase,
           });
-          throw hostErr instanceof MemosError
-            ? hostErr
-            : new MemosError(
-                ERROR_CODES.LLM_UNAVAILABLE,
-                `host fallback failed: ${(hostErr as Error).message ?? String(hostErr)}`,
-              );
+          throw normalizedHostErr;
         }
       }
       failures++;
@@ -840,3 +837,21 @@ function summarizeErrMessage(e: unknown): string {
   if (e instanceof Error) return e.message;
   return String(e);
 }
+
+function normalizeError(
+  err: unknown,
+  fallbackCode: (typeof ERROR_CODES)[keyof typeof ERROR_CODES],
+  prefix: string,
+): MemosError {
+  if (err instanceof MemosError) return err;
+  if (err instanceof Error) return new MemosError(fallbackCode, `${prefix}: ${err.message}`);
+  if (typeof err === "object" && err !== null) {
+    const record = err as { code?: unknown; message?: unknown; data?: unknown };
+    const code = typeof record.code === "string" ? record.code : fallbackCode;
+    const message = typeof record.message === "string" ? record.message : String(record.data ?? err);
+    return new MemosError(code as (typeof ERROR_CODES)[keyof typeof ERROR_CODES], `${prefix}: ${message}`, {
+      bridgeError: err as Record<string, unknown>,
+    });
+  }
+  return new MemosError(fallbackCode, `${prefix}: ${String(err)}`);
+}
```

**File**: `apps/memos-local-plugin/core/llm/prompts/index.ts` (modified, +16/-4)
```diff
@@ -50,8 +50,13 @@ export function languageSteeringLine(lang: PromptLanguage): string {
  * Heuristic:
  *   - Count CJK Unified Ideographs (U+4E00..U+9FFF) as `zh`.
  *   - Count ASCII letters A-Z/a-z as `en`.
- *   - If CJK accounts for more than `zhRatioThreshold` of counted
- *     CJK+ASCII signal, pick `zh`.
+ *   - Treat Japanese kana as an explicit non-Chinese signal. This keeps
+ *     Japanese prompts from being mistaken for Chinese just because they
+ *     contain a few shared Han characters.
+ *   - CJK characters carry a small weight because technical identifiers
+ *     (package names, commands, file paths) can contribute many ASCII
+ *     characters inside an otherwise Chinese sentence. If weighted CJK
+ *     accounts for more than `zhRatioThreshold` of the signal, pick `zh`.
  *   - Otherwise pick `en`.
  *
  * This intentionally treats Japanese / Korean prompts with filenames,
@@ -66,18 +71,25 @@ export function detectDominantLanguage(
   samples: ReadonlyArray<string | null | undefined>,
   opts: { zhRatioThreshold?: number } = {},
 ): PromptLanguage {
-  const zhRatioThreshold = opts.zhRatioThreshold ?? 0.7;
+  const zhRatioThreshold = opts.zhRatioThreshold ?? 0.6;
   let zh = 0;
   let en = 0;
+  let kana = 0;
   for (const s of samples) {
     if (!s) continue;
     for (let i = 0; i < s.length; i++) {
       const code = s.charCodeAt(i);
       if (code >= 0x4e00 && code <= 0x9fff) zh++;
+      else if (
+        (code >= 0x3040 && code <= 0x30ff) ||
+        (code >= 0x31f0 && code <= 0x31ff)
+      ) kana++;
       else if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) en++;
     }
   }
+  if (kana > 0) return "en";
   const total = zh + en;
   if (total === 0) return "en";
-  return zh / total > zhRatioThreshold ? "zh" : "en";
+  const weightedZh = zh * 4;
+  return weightedZh / (weightedZh + en) > zhRatioThreshold ? "zh" : "en";
 }
```

**File**: `apps/memos-local-plugin/core/llm/types.ts` (modified, +8/-0)
```diff
@@ -257,6 +257,14 @@ export interface ProviderCallInput {
   maxTokens: number;
   jsonMode: boolean;
   stop?: string[];
+  /**
+   * Logical call site (e.g. `capture.summarize`, `retrieval.filter`,
+   * `skill.evolve`). Forwarded from `LlmCallOptions.op` so providers
+   * can apply per-op behavior (request-body tweaks, routing overrides,
+   * reasoning kill-switches, per-op budget caps). Optional — providers
+   * must not assume it is set.
+   */
+  op?: string;
 }
 
 /** What providers return — pre-facade post-processing. */
```

**File**: `apps/memos-local-plugin/core/memory/l2/induce.ts` (modified, +66/-0)
```diff
@@ -23,6 +23,7 @@ import type {
   EmbeddingVector,
   EpisodeId,
   PolicyId,
+  PolicyMetadata,
   PolicyRow,
   TraceId,
   TraceRow,
@@ -156,6 +157,7 @@ export function buildPolicyRow(args: {
   inducedBy: string; // prompt id + version
   now?: number;
   id?: PolicyId;
+  sourceSignature?: string;
 }): PolicyRow {
   const now = args.now ?? Date.now();
   const vec = centroid(args.evidenceTraces.map((t) => t.vecSummary ?? t.vecAction ?? null));
@@ -170,16 +172,80 @@ export function buildPolicyRow(args: {
     gain: 0,
     status: "candidate",
     sourceEpisodeIds: Array.from(new Set(args.episodeIds)),
+    sourceTraceIds: Array.from(new Set(args.evidenceTraces.map((trace) => trace.id))),
     inducedBy: args.inducedBy,
     // Fresh policy starts without learned guidance — populated by the
     // decision-repair pipeline as user feedback / failure bursts arrive.
     decisionGuidance: { preference: [], antiPattern: [] },
     vec: vec as EmbeddingVector | null,
     createdAt: now,
     updatedAt: now,
+    metadata: derivePolicyMetadata(args.evidenceTraces, args.sourceSignature),
   };
 }
 
+function derivePolicyMetadata(
+  traces: readonly TraceRow[],
+  sourceSignature?: string,
+): PolicyMetadata {
+  const domainTags = uniqueStrings(traces.flatMap((t) => t.tags ?? []));
+  const toolNames = uniqueStrings(
+    traces.flatMap((t) => (t.toolCalls ?? []).map((c) => c.name ?? "")),
+  );
+  const errorCodes = uniqueStrings(
+    traces.flatMap((t) => {
+      const text = [
+        t.agentText,
+        t.reflection ?? "",
+        ...(t.toolCalls ?? []).map((c) =>
+          typeof c.output === "string" ? c.output : "",
+        ),
+      ].join(" ");
+      return Array.from(
+        text.matchAll(/\b[A-Z][A-Z0-9]{2,}_[A-Z0-9_]+\b/g),
+        (m) => m[0],
+      );
+    }),
+  );
+  let zh = 0;
+  let en = 0;
+  for (const t of traces) {
+    for (const s of [t.userText, t.agentText, t.reflection ?? ""]) {
+      for (const ch of s) {
+        const code = ch.charCodeAt(0);
+        if (code >= 0x4e00 && code <= 0x9fff) zh++;
+        else if (
+          (code >= 0x41 && code <= 0x5a) ||
+          (code >= 0x61 && code <= 0x7a)
+        ) en++;
+      }
+    }
+  }
+  const total = zh + en;
+  const language =
+    total === 0
+      ? "unknown"
+      : zh / total >= 0.7
+        ? "zh"
+        : en / total >= 0.7
+          ? "en"
+          : "mixed";
+  return {
+    version: 1,
+    language,
+    domainTags,
+    toolNames,
+    errorCodes,
+    ...(sourceSignature ? { sourceSignature } : {}),
+  };
+}
+
+function uniqueStrings(values: readonly string[]): string[] {
+  return Array.from(
+    new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean)),
+  ).slice(0, 32);
+}
+
 // ─── helpers ────────────────────────────────────────────────────────────────
 
 function packTraces(
```

**File**: `apps/memos-local-plugin/core/memory/l2/l2.ts` (modified, +2/-0)
```diff
@@ -253,6 +253,7 @@ export async function runL2(
         evidenceTraces: traces,
         inducedBy: `${L2_INDUCTION_PROMPT.id}.v${L2_INDUCTION_PROMPT.version}`,
         now: input.now ?? Date.now(),
+        sourceSignature: bucket.signature,
       });
       const owner = ownerFromTraces(traces);
       policy.ownerAgentKind = owner.ownerAgentKind;
@@ -632,6 +633,7 @@ function mergePolicyEvidence(existing: PolicyRow, incoming: PolicyRow, now: numb
       ...incoming.sourceEpisodeIds,
     ]),
     vec: existing.vec ?? incoming.vec,
+    metadata: existing.metadata ?? incoming.metadata,
     updatedAt: now as PolicyRow["updatedAt"],
   };
 }
```

---

### Incident Patch 3: `0f3265a5` (2026-09-21)
**Commit Message**: fix(plugin): wire skill evolver model into evolution

**File**: `apps/memos-local-plugin/core/pipeline/deps.ts` (modified, +7/-8)
```diff
@@ -217,7 +217,7 @@ export function buildPipelineSubscribers(
   const log = deps.log ?? rootLogger.child({ channel: "core.pipeline" });
   const bgLlmSemaphore = createSemaphore(algorithm.session.bgLlmConcurrency);
   const bgLlm = rateLimitLlmClient(deps.llm, bgLlmSemaphore, resources);
-  const bgReflectLlm = rateLimitLlmClient(deps.reflectLlm, bgLlmSemaphore, resources);
+  const bgEvolverLlm = rateLimitLlmClient(deps.reflectLlm ?? deps.llm, bgLlmSemaphore, resources);
   const bgL3Llm = rateLimitLlmClient(deps.l3Llm ?? deps.llm, bgLlmSemaphore, resources);
   const bgEmbedder = resources
     ? prioritizeEmbedder(deps.embedder, resources, "background")
@@ -233,9 +233,8 @@ export function buildPipelineSubscribers(
     // Issue #2148: capture batch reflection emits JSON, so it must use
     // the main model rather than the potentially thinking-enabled
     // skill-evolver model. Keep the background wrapper so capture also
-    // participates in the shared concurrency limit. `bgReflectLlm`
-    // remains read-only evaluator metadata below; the original
-    // `deps.reflectLlm` is also exposed to the Overview health card.
+    // participates in the shared concurrency limit. The dedicated
+    // evolver client is used by L2 induction and skill crystallization.
     reflectLlm: bgLlm,
     bus: buses.capture,
     cfg: algorithm.capture,
@@ -276,8 +275,8 @@ export function buildPipelineSubscribers(
     bus: buses.reward,
     cfg: algorithm.reward,
     evaluator: {
-      reflectionProvider: bgReflectLlm?.provider,
-      reflectionModel: bgReflectLlm?.model,
+      reflectionProvider: bgLlm?.provider,
+      reflectionModel: bgLlm?.model,
       scorerProvider: bgLlm?.provider,
       scorerModel: bgLlm?.model,
     },
@@ -311,7 +310,7 @@ export function buildPipelineSubscribers(
     repos: deps.repos,
     rewardBus: buses.reward,
     l2Bus: buses.l2,
-    llm: bgLlm,
+    llm: bgEvolverLlm,
     log: log.child({ channel: "core.memory.l2" }),
     config: algorithm.l2Induction,
     thresholds: {
@@ -336,7 +335,7 @@ export function buildPipelineSubscribers(
   const skillHandle = attachSkillSubscriber({
     repos: deps.repos,
     embedder: bgEmbedder,
-    llm: bgLlm,
+    llm: bgEvolverLlm,
     bus: buses.skill,
     l2Bus: buses.l2,
     rewardBus: buses.reward,
```

**File**: `apps/memos-local-plugin/core/pipeline/memory-core.ts` (modified, +1/-1)
```diff
@@ -426,7 +426,7 @@ export async function bootstrapMemoryCoreFull(
     llm = null;
   }
 
-  // Build a dedicated LLM for the reflection phase from skillEvolver
+  // Build a dedicated LLM for L2 induction and skills from skillEvolver
   // config when the user has configured a stronger model there. Falls
   // back to the main `llm` when skillEvolver.model is blank.
   let reflectLlm: ReturnType<typeof createLlmClient> | null = null;
```

**File**: `apps/memos-local-plugin/core/pipeline/types.ts` (modified, +2/-2)
```diff
@@ -144,7 +144,7 @@ export interface PipelineDeps {
   repos: Repos;
   llm: LlmClient | null;
   /**
-   * Dedicated LLM for the topic-end reflection + α scoring pass.
+   * Dedicated LLM for L2 induction and skill crystallization.
    * Built from `config.skillEvolver.*` when the user configures a
    * stronger model for skill evolution; falls back to `llm` when
    * absent. Summarization and per-turn lite capture still use `llm`.
@@ -181,7 +181,7 @@ export interface PipelineHandle {
   readonly repos: Repos;
   readonly llm: LlmClient | null;
   /**
-   * Dedicated client for skill-evolution reflection. When the operator
+   * Dedicated client for L2 induction and skill crystallization. When the operator
    * leaves `skillEvolver.*` blank, this is the same instance as `llm`
    * (so call sites can blindly read whichever is non-null). When they
    * configure their own model it carries its own `stats()` so the
```

**File**: `apps/memos-local-plugin/tests/unit/pipeline/capture-reflect-llm-wiring.test.ts` (modified, +64/-0)
```diff
@@ -29,6 +29,46 @@ const captureRunnerCalls: Array<{
   llm: LlmClient | null;
   reflectLlm: LlmClient | null;
 }> = [];
+const evolutionSubscriberCalls: Array<{
+  l2Llm: LlmClient | null;
+  skillLlm: LlmClient | null;
+}> = [];
+
+vi.mock("../../../core/memory/l2/index.js", async () => {
+  const actual = await vi.importActual<
+    typeof import("../../../core/memory/l2/index.js")
+  >("../../../core/memory/l2/index.js");
+  return {
+    ...actual,
+    attachL2Subscriber: (deps: { llm: LlmClient | null; [k: string]: unknown }) => {
+      evolutionSubscriberCalls.push({
+        l2Llm: deps.llm,
+        skillLlm: null,
+      });
+      return actual.attachL2Subscriber(
+        deps as Parameters<typeof actual.attachL2Subscriber>[0],
+      );
+    },
+  };
+});
+
+vi.mock("../../../core/skill/index.js", async () => {
+  const actual = await vi.importActual<
+    typeof import("../../../core/skill/index.js")
+  >("../../../core/skill/index.js");
+  return {
+    ...actual,
+    attachSkillSubscriber: (deps: { llm: LlmClient | null; [k: string]: unknown }) => {
+      evolutionSubscriberCalls.push({
+        l2Llm: null,
+        skillLlm: deps.llm,
+      });
+      return actual.attachSkillSubscriber(
+        deps as Parameters<typeof actual.attachSkillSubscriber>[0],
+      );
+    },
+  };
+});
 
 vi.mock("../../../core/capture/index.js", async () => {
   const actual = await vi.importActual<
@@ -141,6 +181,7 @@ function buildDepsWithDistinctLlms(
 beforeEach(() => {
   dbHandle = makeTmpDb();
   captureRunnerCalls.length = 0;
+  evolutionSubscriberCalls.length = 0;
 });
 
 afterEach(() => {
@@ -189,4 +230,27 @@ describe("pipeline/deps captureRunner wiring (issue #2148)", () => {
     expect(call.reflectLlm).toBe(call.llm);
     expect(call.reflectLlm?.model).toBe("main-llm");
   });
+
+  it("passes the dedicated skill-evolver model to L2 induction and skill crystallization", () => {
+    const buses = buildPipelineBuses();
+    const deps = buildDepsWithDistinctLlms(dbHandle!, false);
+    const algorithm = extractAlgorithmConfig(deps);
+    const session = buildPipelineSession(deps, buses.session);
+    buildPipelineSubscribers(deps, buses, algorithm, session);
+
+    expect(evolutionSubscriberCalls[0].l2Llm?.model).toBe("skill-evolver-llm");
+    expect(evolutionSubscriberCalls[1].skillLlm?.model).toBe("skill-evolver-llm");
+    expect(evolutionSubscriberCalls[0].l2Llm).toBe(evolutionSubscriberCalls[1].skillLlm);
+  });
+
+  it("inherits the main model when no dedicated evolver client is available", () => {
+    const buses = buildPipelineBuses();
+    const deps = buildDepsWithDistinctLlms(dbHandle!, false);
+    deps.reflectLlm = null;
+    buildPipelineSubscribers(deps, buses, extractAlgorithmConfig(deps));
+
+    expect(evolutionSubscriberCalls[0].l2Llm?.model).toBe("main-llm");
+    expect(evolutionSubscriberCalls[1].skillLlm?.model).toBe("main-llm");
+  });
+
 });
```

---

### Incident Patch 4: `6a83d368` (2026-09-21)
**Commit Message**: fix(plugin): harden multilingual L2 and L3 evolution

**File**: `apps/memos-local-plugin/core/config/defaults.ts` (modified, +1/-0)
```diff
@@ -223,6 +223,7 @@ export const DEFAULT_CONFIG: ResolvedConfig = {
       // strict 0.6 starved L3 in real usage.
       clusterMinSimilarity: 0.3,
       maxPoliciesPerCluster: 20,
+      maxPromptChars: 32_000,
       policyCharCap: 800,
       traceCharCap: 500,
       traceEvidencePerPolicy: 1,
```

**File**: `apps/memos-local-plugin/core/config/schema.ts` (modified, +2/-0)
```diff
@@ -328,6 +328,8 @@ const AlgorithmSchema = Type.Object({
     clusterMinSimilarity: NumberInRange(0.6, 0, 1),
     /** Maximum policies included in one L3 abstraction prompt. */
     maxPoliciesPerCluster: NumberInRange(20, 1, 100),
+    /** Hard total character cap for one L3 abstraction prompt. */
+    maxPromptChars: NumberInRange(32_000, 4_000, 128_000),
     /** Chars of L2 body handed to `l3.abstraction`. */
     policyCharCap: NumberInRange(800, 200, 4_000),
     /** Chars of trace body handed per evidence trace. */
```

**File**: `apps/memos-local-plugin/core/llm/prompts/index.ts` (modified, +16/-4)
```diff
@@ -50,8 +50,13 @@ export function languageSteeringLine(lang: PromptLanguage): string {
  * Heuristic:
  *   - Count CJK Unified Ideographs (U+4E00..U+9FFF) as `zh`.
  *   - Count ASCII letters A-Z/a-z as `en`.
- *   - If CJK accounts for more than `zhRatioThreshold` of counted
- *     CJK+ASCII signal, pick `zh`.
+ *   - Treat Japanese kana as an explicit non-Chinese signal. This keeps
+ *     Japanese prompts from being mistaken for Chinese just because they
+ *     contain a few shared Han characters.
+ *   - CJK characters carry a small weight because technical identifiers
+ *     (package names, commands, file paths) can contribute many ASCII
+ *     characters inside an otherwise Chinese sentence. If weighted CJK
+ *     accounts for more than `zhRatioThreshold` of the signal, pick `zh`.
  *   - Otherwise pick `en`.
  *
  * This intentionally treats Japanese / Korean prompts with filenames,
@@ -66,18 +71,25 @@ export function detectDominantLanguage(
   samples: ReadonlyArray<string | null | undefined>,
   opts: { zhRatioThreshold?: number } = {},
 ): PromptLanguage {
-  const zhRatioThreshold = opts.zhRatioThreshold ?? 0.7;
+  const zhRatioThreshold = opts.zhRatioThreshold ?? 0.6;
   let zh = 0;
   let en = 0;
+  let kana = 0;
   for (const s of samples) {
     if (!s) continue;
     for (let i = 0; i < s.length; i++) {
       const code = s.charCodeAt(i);
       if (code >= 0x4e00 && code <= 0x9fff) zh++;
+      else if (
+        (code >= 0x3040 && code <= 0x30ff) ||
+        (code >= 0x31f0 && code <= 0x31ff)
+      ) kana++;
       else if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) en++;
     }
   }
+  if (kana > 0) return "en";
   const total = zh + en;
   if (total === 0) return "en";
-  return zh / total > zhRatioThreshold ? "zh" : "en";
+  const weightedZh = zh * 4;
+  return weightedZh / (weightedZh + en) > zhRatioThreshold ? "zh" : "en";
 }
```

**File**: `apps/memos-local-plugin/core/memory/l2/induce.ts` (modified, +66/-0)
```diff
@@ -23,6 +23,7 @@ import type {
   EmbeddingVector,
   EpisodeId,
   PolicyId,
+  PolicyMetadata,
   PolicyRow,
   TraceId,
   TraceRow,
@@ -156,6 +157,7 @@ export function buildPolicyRow(args: {
   inducedBy: string; // prompt id + version
   now?: number;
   id?: PolicyId;
+  sourceSignature?: string;
 }): PolicyRow {
   const now = args.now ?? Date.now();
   const vec = centroid(args.evidenceTraces.map((t) => t.vecSummary ?? t.vecAction ?? null));
@@ -170,16 +172,80 @@ export function buildPolicyRow(args: {
     gain: 0,
     status: "candidate",
     sourceEpisodeIds: Array.from(new Set(args.episodeIds)),
+    sourceTraceIds: Array.from(new Set(args.evidenceTraces.map((trace) => trace.id))),
     inducedBy: args.inducedBy,
     // Fresh policy starts without learned guidance — populated by the
     // decision-repair pipeline as user feedback / failure bursts arrive.
     decisionGuidance: { preference: [], antiPattern: [] },
     vec: vec as EmbeddingVector | null,
     createdAt: now,
     updatedAt: now,
+    metadata: derivePolicyMetadata(args.evidenceTraces, args.sourceSignature),
   };
 }
 
+function derivePolicyMetadata(
+  traces: readonly TraceRow[],
+  sourceSignature?: string,
+): PolicyMetadata {
+  const domainTags = uniqueStrings(traces.flatMap((t) => t.tags ?? []));
+  const toolNames = uniqueStrings(
+    traces.flatMap((t) => (t.toolCalls ?? []).map((c) => c.name ?? "")),
+  );
+  const errorCodes = uniqueStrings(
+    traces.flatMap((t) => {
+      const text = [
+        t.agentText,
+        t.reflection ?? "",
+        ...(t.toolCalls ?? []).map((c) =>
+          typeof c.output === "string" ? c.output : "",
+        ),
+      ].join(" ");
+      return Array.from(
+        text.matchAll(/\b[A-Z][A-Z0-9]{2,}_[A-Z0-9_]+\b/g),
+        (m) => m[0],
+      );
+    }),
+  );
+  let zh = 0;
+  let en = 0;
+  for (const t of traces) {
+    for (const s of [t.userText, t.agentText, t.reflection ?? ""]) {
+      for (const ch of s) {
+        const code = ch.charCodeAt(0);
+        if (code >= 0x4e00 && code <= 0x9fff) zh++;
+        else if (
+          (code >= 0x41 && code <= 0x5a) ||
+          (code >= 0x61 && code <= 0x7a)
+        ) en++;
+      }
+    }
+  }
+  const total = zh + en;
+  const language =
+    total === 0
+      ? "unknown"
+      : zh / total >= 0.7
+        ? "zh"
+        : en / total >= 0.7
+          ? "en"
+          : "mixed";
+  return {
+    version: 1,
+    language,
+    domainTags,
+    toolNames,
+    errorCodes,
+    ...(sourceSignature ? { sourceSignature } : {}),
+  };
+}
+
+function uniqueStrings(values: readonly string[]): string[] {
+  return Array.from(
+    new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean)),
+  ).slice(0, 32);
+}
+
 // ─── helpers ────────────────────────────────────────────────────────────────
 
 function packTraces(
```

**File**: `apps/memos-local-plugin/core/memory/l2/l2.ts` (modified, +2/-0)
```diff
@@ -253,6 +253,7 @@ export async function runL2(
         evidenceTraces: traces,
         inducedBy: `${L2_INDUCTION_PROMPT.id}.v${L2_INDUCTION_PROMPT.version}`,
         now: input.now ?? Date.now(),
+        sourceSignature: bucket.signature,
       });
       const owner = ownerFromTraces(traces);
       policy.ownerAgentKind = owner.ownerAgentKind;
@@ -632,6 +633,7 @@ function mergePolicyEvidence(existing: PolicyRow, incoming: PolicyRow, now: numb
       ...incoming.sourceEpisodeIds,
     ]),
     vec: existing.vec ?? incoming.vec,
+    metadata: existing.metadata ?? incoming.metadata,
     updatedAt: now as PolicyRow["updatedAt"],
   };
 }
```

**File**: `apps/memos-local-plugin/core/memory/l3/ALGORITHMS.md` (modified, +9/-7)
```diff
@@ -50,13 +50,15 @@ rust|cargo|go|java|maven|gradle|typescript|javascript
 ```
 
 Matches are ordered by the first-hit position so the sweep is
-deterministic, then we pick the top two distinct tokens. We deliberately
-**do not** embed free-form LLM tags here — domain keys must be cheap
-and stable enough to hash.
-
-Policies with no recognised domain keyword fall into the bucket
-`__generic|` and are still candidates for clustering by vector
-similarity.
+deterministic, then we pick the top two distinct tokens. Newly induced L2
+rows also persist trace-derived metadata (language, tags, tool names, error
+codes, and the source signature); that structured metadata is preferred over
+this legacy prose heuristic. We deliberately **do not** embed free-form LLM
+tags here — domain keys must be cheap and stable enough to hash.
+
+Policies with no recognised domain keyword fall into the generic bucket and
+are only clustered when at least two vector-bearing policies pass the cosine
+gate. This prevents unrelated no-label policies from becoming an L3 prompt.
 
 ---
 
```

**File**: `apps/memos-local-plugin/core/memory/l3/README.md` (modified, +9/-1)
```diff
@@ -56,7 +56,9 @@ No single step blocks reward/L2. Any LLM failure is captured as a
 
 `clusterPolicies` (see [`cluster.ts`](./cluster.ts) and
 [`ALGORITHMS.md`](./ALGORITHMS.md)) bucket-sorts policies by a compact
-**domain key** derived from the policy's trigger/procedure text
+**domain key** derived first from trace-derived policy metadata (language,
+tags, tools, error codes, and source signature), with a legacy
+trigger/procedure-text fallback for pre-migration rows
 (`docker|pip`, `node|npm`, …) and then splits each bucket by centroid
 cosine, so policies in the same bucket that are still semantically far
 apart (different sub-environments) end up in separate clusters.
@@ -152,6 +154,7 @@ See `algorithm.l3Abstraction` in
 | `useLlm`                     | `true`  | Toggle the LLM abstractor off for tests.      |
 | `cooldownDays`               | `1`     | Debounce per domain tag.                       |
 | `maxPoliciesPerCluster`      | `20`    | Batch size for one abstraction prompt; overflow is retained. |
+| `maxPromptChars`             | `32000` | Hard total prompt cap; oversized legacy batches are skipped and quarantined. |
 | `confidenceDelta`            | `0.05`  | Confidence step per merge / feedback.         |
 | `minConfidenceForRetrieval`  | `0.2`   | Tier-3 hide threshold.                        |
 
@@ -166,6 +169,11 @@ All L3 work is logged on dedicated channels (see
 * `core.memory.l3.merge` — merge decisions.
 * `core.memory.l3.confidence` — confidence bumps.
 * `core.memory.l3.feedback` — human feedback-driven confidence changes.
+
+Failed legacy clusters use a bounded retry policy (5m/30m/2h/6h). After the
+fourth deterministic failure they are quarantined rather than retried forever;
+clear the `l3.retry.*` record through the L3 retry-state helper after fixing
+the provider or prompt configuration.
 * `core.memory.l3.events` — listener dispatch errors.
 
 ## Tests
```

**File**: `apps/memos-local-plugin/core/memory/l3/abstract.ts` (modified, +24/-5)
```diff
@@ -49,7 +49,7 @@ export interface AbstractInput {
 export interface AbstractDeps {
   llm: LlmClient | null;
   log: Logger;
-  config: Pick<L3Config, "policyCharCap" | "traceCharCap" | "traceEvidencePerPolicy" | "useLlm">;
+  config: Pick<L3Config, "policyCharCap" | "traceCharCap" | "traceEvidencePerPolicy" | "useLlm" | "maxPromptChars">;
   /** Optional extra validation executed after the base validator. */
   validate?: (d: L3AbstractionDraft) => void;
 }
@@ -74,19 +74,38 @@ export async function abstractDraft(
   }
 
   const userPayload = packPrompt(input, config);
+  const maxPromptChars = Math.max(4_000, Math.floor(config.maxPromptChars ?? 32_000));
+  if (userPayload.length > maxPromptChars) {
+    log.warn("l3.abstract.prompt_too_large", {
+      clusterKey: input.cluster.key,
+      promptChars: userPayload.length,
+      maxPromptChars,
+      policyCount: input.cluster.policies.length,
+    });
+    return {
+      ok: false,
+      reason: "prompt_too_large",
+      detail: `prompt has ${userPayload.length} chars; limit is ${maxPromptChars}`,
+    };
+  }
 
   // Pick the world-model's rendering language from the underlying
   // policies + trace evidence. A Chinese user generating "docker alpine
   // 依赖" policies should see the environment/inference/constraint bullets
   // written in Chinese; an English user should see them in English.
-  const langSamples: Array<string | null | undefined> = [];
+  const policySamples: Array<string | null | undefined> = [];
   for (const p of input.cluster.policies) {
-    langSamples.push(p.title, p.trigger, p.procedure, p.boundary, p.verification);
+    policySamples.push(p.title, p.trigger, p.procedure, p.boundary, p.verification);
   }
+  const evidenceSamples: Array<string | null | undefined> = [];
   for (const traces of input.evidenceByPolicy.values()) {
-    for (const t of traces) langSamples.push(t.userText, t.agentText, t.reflection);
+    for (const t of traces) evidenceSamples.push(t.userText, t.agentText, t.reflection);
   }
-  const evidenceLang = detectDominantLanguage(langSamples);
+  // Evidence language wins over legacy policy prose: old English policies
+  // must not force a Chinese trace cluster back to English.
+  const evidenceLang = detectDominantLanguage(
+    evidenceSamples.some((sample) => sample?.trim()) ? evidenceSamples : policySamples,
+  );
 
   try {
     const rsp = await llm.completeJson<Record<string, unknown>>(
```

---

### Incident Patch 5: `cb5625ba` (2026-09-18)
**Commit Message**: Merge remote-tracking branch 'origin/main' into fix-20260916-local-plugin

**File**: `docker/.env.example-full` (modified, +12/-2)
```diff
@@ -53,6 +53,16 @@ DOCUMENT_PARSER_MODEL=                     # falls back to MEMREADER_GENERAL_MOD
 IMAGE_PARSER_MODEL=                        # falls back to MEMREADER_GENERAL_MODEL when omitted
 QWEN_MODEL=qwen-flash                      # optional qwen_llm slot when QWEN_API_KEY is set
 
+## Optional per-model LLM QPS rate limiting (Redis GCRA)
+# Disabled by default. Enable explicitly and tune rules to your provider quota.
+MEMOS_LLM_RATE_LIMIT_ENABLED=false
+MEMOS_LLM_RATE_LIMIT_RULES='{"gpt-4o-mini":{"qps":5,"burst":2,"max_wait_seconds":30,"queue_capacity":16,"retry_attempts":1}}'
+# Rule keys must match actual model names; unlisted models are not limited.
+# QPS/burst are shared across workers using the same Redis/DB and model key.
+# queue_capacity is per process/model; max_wait_seconds is the permit-wait budget.
+# Reuses MEMSCHEDULER_REDIS_HOST/PORT/DB/USERNAME/PASSWORD/SSL; host is required when enabled.
+# See docs/cn/open_source/open_source_api/help/llm_qps_rate_limit.md.
+
 ## Embedding & rerank
 # embedding dim
 EMBEDDING_DIMENSION=1024
@@ -111,9 +121,9 @@ ENABLE_INTERNET=false
 # Internet search backend (bocha | tavily)
 INTERNET_SEARCH_BACKEND=bocha
 # API key for BOCHA Search
-BOCHA_API_KEY=                             # required if ENABLE_INTERNET=true and backend=bocha
+BOCHA_API_KEY=                             your-bocha-api-key and backend=bocha
 # API key for Tavily Search
-TAVILY_API_KEY=                            # required if ENABLE_INTERNET=true and backend=tavily
+TAVILY_API_KEY=                            your-bocha-api-key and backend=tavily
 # default search mode
 SEARCH_MODE=fast                          # fast | fine | mixture
 # Slow retrieval strategy configuration, rewrite is the rewrite strategy
```

**File**: `docs/cn/open_source/open_source_api/help/llm_qps_rate_limit.md` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+# LLM GCRA 限流
+
+## 环境变量
+
+限流只暴露两个环境变量，默认关闭。当前仅限制明确选中的模型。
+
+```dotenv
+MEMOS_LLM_RATE_LIMIT_ENABLED=false
+MEMOS_LLM_RATE_LIMIT_RULES='{"gpt-4o-mini":{"qps":5,"burst":2,"max_wait_seconds":30,"queue_capacity":16,"retry_attempts":1}}'
+```
+
+`RULES` 是 JSON 对象，键为实际请求的模型名。每条规则只支持以下五个参数，省略时使用代码默认值：
+
+| 参数 | 默认值 | 含义 |
+|---|---:|---|
+| qps | 5 | 全局持续放行速率；所有共享配额的 worker 合计 |
+| burst | 2 | 空闲后最多立即放行的请求总数，不是 qps 加 burst |
+| max_wait_seconds | 30 | 单次主/备用调用及其受控重试的累计许可等待预算，单位秒 |
+| queue_capacity | 16 | 每进程、每模型的等待队列上限，包含正在申请的队首 |
+| retry_attempts | 1 | 首次模型请求失败后最多重试次数；0 表示不重试 |
+
+上述示例与代码默认值及 `docker/.env.example-full` 一致，默认不启用。需要限流时显式设置 `MEMOS_LLM_RATE_LIMIT_ENABLED=true`。参数是开源部署的保守起点，不代表供应商保证的配额；应按实际配额、共享环境、worker 数、排队等待及限流错误调整。QPS 限流不等于 token 吞吐或模型在途并发限制。
+
+- 未配置 `RULES` 时，默认只选择 `gpt-4o-mini`，使用上述默认值。
+- 显式配置 `RULES` 会替换整个模型规则集合；未列出的模型不受限流影响，不隐式追加默认模型。
+- `RULES={}` 不限制任何模型；删除某个模型的条目即可取消该模型限流。
+- `ENABLED=false` 关闭整个功能。
+- 模型名不支持通配符；qps 必须为有限正数，burst 和容量为正整数，重试次数为非负整数。
+- Shell/`.env` 示例的外层单引号用于保护 JSON；在部署平台直接填写环境变量值时，不包含外层单引号。
+
+多个模型分别配置示例：
+
+```dotenv
+MEMOS_LLM_RATE_LIMIT_RULES='{"gpt-4o-mini":{"qps":5,"burst":2,"max_wait_seconds":30,"queue_capacity":16,"retry_attempts":1},"qwen-flash":{"qps":10,"burst":2,"max_wait_seconds":3,"queue_capacity":8,"retry_attempts":0}}'
+```
+
+第二个模型仅为示例，不默认启用。
+
+## Redis 与加载
+
+Redis 连接复用现有 `MEMSCHEDULER_REDIS_HOST/PORT/DB/USERNAME/PASSWORD/SSL`。缺少 host 时，第一次受控调用报配置错误；默认关闭时不创建 Redis 客户端。密码通过部署 Secret 注入。
+
+Redis key 自动按模型生成，无需 scope：
+
+```text
+memos:llm:gcra:gpt-4o-mini
+memos:llm:gcra:qwen-flash
+```
+
+同一 Redis/DB、相同前缀下，同名模型跨 worker/环境共享一个 TAT，不因 endpoint 或 API Key 不同而拆分。不同模型的 TAT 和本地队列独立；模型别名视为不同模型。各环境必须使用一致的速率和 burst。
+
+配置在创建 LLM 配置对象时加载，不逐请求读环境变量，也不自行加载 `.env`。更新部署配置后需协调重启 worker。Python 显式 `rate_limit` 配置仍可覆盖环境值，配置对象保留内部运行参数用于程序化构造和测试；这些参数不再提供环境变量入口。
+
+旧的 `MEMOS_LLM_RATE_LIMIT_*` 配置中，除 `ENABLED`、`RULES` 外均需移除，例如 MODELS、QPS、BURST、SCOPE、CONFIG_FILE、REDIS_* 和 WAIT_JITTER_SECONDS。加载时会对不支持的变量报错，避免旧配置被静默忽略。旧的模型规则中也应移除 enabled、scope、抖动及退避参数。不再支持通过环境变量指定独立 JSON 配置文件。
+
+若从旧哈希 key 或旧前缀升级，请协调所有实例切换，避免新旧 key 同时放行；新 key 初始化时会恢复一个 burst。不要在运行中随意切换前缀。
+
+## 内部行为
+
+- Lua 使用 Redis TIME，原子读取、判断和更新 TAT，拒绝不推进 TAT；Python 使用 register_script，无需本机安装 Lua。
+- 每进程、每模型只有队首申请 Redis，其他线程通过 Condition 等待。获准后立即离队发起模型调用，不等模型返回。
+- Redis 建议等待时间后附加 0～10ms 抖动。无有效 Retry-After 时使用指数退避和抖动，退避基数 1s、上限 8s。这些是内部默认值，不需要部署配置。
+- 受控调用关闭 SDK 隐藏重试。连接/超时错误及 HTTP 408、409、429、5xx 可有限重试，每次重新申请许可；Retry-After 超过内部等待上限时不提前重试。
+- 流式请求只重试建立阶段，流开始后的错误不重放。调用方提前结束时应关闭生成器。
+- 队列满、等待超时、Redis 不可用分别抛出 LLMRateLimitQueueFullError、LLMRateLimitTimeoutError、LLMRateLimitUnavailableError，不通过备用模型绕过。
+- 默认 Redis 连接和读取超时 0.5s，故障策略为 closed，即停止受控调用。网络响应迟到时不发送模型请求，也不退还已消耗或状态不确定的许可。
+- max_wait_seconds 不包含模型网络耗时和失败退避，不是整个业务请求的总超时；外层仍需业务 deadline。同步 Redis I/O 最迟要等 socket 超时才能退出。
+- 本地队列不是持久任务队列；满队列、超时和进程退出不会自动延期任务。Redis 故障切换或淘汰 TAT 也可能重置额度。
+
+## 范围与验证
+
+当前接入 OpenAILLM 及其 Qwen、DeepSeek、MiniMax 子类的 Chat Completions，包括普通调用、流式建立和备用模型。Azure、Responses API、Ollama、VLLM 等独立实现暂未接入。
+
+该版本仅控制 QPS，不控制 Token 用量、Token 增速或在途并发，不能保证解决供应商所有 429。
+
+INFO 的 `[LLM_RATE_LIMIT] sending` 记录模型、尝试序号及许可等待时间；WARNING 记录重试、队列满、等待超时和 Redis 故障。新增日志不记录请求正文或凭据。
+
+```sh
+poetry run pytest tests/configs/ tests/llms/ -q
+MEMOS_TEST_LOCAL_REDIS=1 poetry run pytest tests/llms/test_qps_rate_limit_redis.py -q
+```
+
+第二条启动隔离本地 Redis，仅 Unix socket、无 TCP、无持久化，不读取生产 Redis 配置。日志位于 pytest 管理的 `redis-gcra*` 临时目录；短路径临时 socket 退出时清理。
```

**File**: `docs/en/open_source/open_source_api/help/llm_qps_rate_limit.md` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+# LLM GCRA Rate Limiting
+
+## Environment Variables
+
+Rate limiting exposes only two environment variables and is disabled by default. Only explicitly selected models are limited.
+
+```dotenv
+MEMOS_LLM_RATE_LIMIT_ENABLED=false
+MEMOS_LLM_RATE_LIMIT_RULES='{"gpt-4o-mini":{"qps":5,"burst":2,"max_wait_seconds":30,"queue_capacity":16,"retry_attempts":1}}'
+```
+
+`RULES` is a JSON object keyed by the actual model name used in requests. Each rule accepts only the following five parameters. Omitted parameters use the code defaults:
+
+| Parameter | Default | Description |
+|---|---:|---|
+| qps | 5 | Global sustained admission rate, aggregated across all workers sharing the quota |
+| burst | 2 | Total number of requests that can be admitted immediately after an idle period; not qps plus burst |
+| max_wait_seconds | 30 | Cumulative permit-wait budget in seconds for a single primary/backup invocation and its managed retries |
+| queue_capacity | 16 | Waiting queue capacity per process and model, including the head currently requesting a permit |
+| retry_attempts | 1 | Maximum retries after the initial model request fails; 0 disables retries |
+
+The example matches the code defaults and `docker/.env.example-full`, with rate limiting disabled. Set `MEMOS_LLM_RATE_LIMIT_ENABLED=true` explicitly to enable it. These values are a conservative starting point for open-source deployments, not provider-guaranteed quotas. Adjust them based on your actual quota, shared environments, worker count, queue waits, and rate-limit errors. QPS limiting is not a token-throughput or in-flight concurrency limit.
+
+- When `RULES` is not set, only `gpt-4o-mini` is selected, using the defaults above.
+- Explicit `RULES` replace the entire model rule set. Unlisted models are unaffected; the default model is not implicitly added.
+- `RULES={}` limits no models. Remove a model entry to disable limiting for that model.
+- `ENABLED=false` disables the entire feature.
+- Model names do not support wildcards. qps must be finite and positive; burst and queue capacity must be positive integers; retry attempts must be a nonnegative integer.
+- The outer single quotes in shell/`.env` examples protect the JSON. Omit them when entering the environment variable value directly in a deployment platform.
+
+Example with separate rules for multiple models:
+
+```dotenv
+MEMOS_LLM_RATE_LIMIT_RULES='{"gpt-4o-mini":{"qps":5,"burst":2,"max_wait_seconds":30,"queue_capacity":16,"retry_attempts":1},"qwen-flash":{"qps":10,"burst":2,"max_wait_seconds":3,"queue_capacity":8,"retry_attempts":0}}'
+```
+
+The second model is illustrative and is not selected by default.
+
+## Redis and Configuration Loading
+
+The limiter reuses the existing `MEMSCHEDULER_REDIS_HOST/PORT/DB/USERNAME/PASSWORD/SSL` connection settings. A missing host causes a configuration error on the first limited invocation. No Redis client is created while the feature is disabled. Inject passwords through deployment secrets.
+
+Redis keys are generated automatically per model; no scope configuration is needed:
+
+```text
+memos:llm:gcra:gpt-4o-mini
+memos:llm:gcra:qwen-flash
+```
+
+Workers and environments using the same Redis instance, database, prefix, and model name share one theoretical arrival time (TAT). Different endpoints or API keys do not create separate quotas. Different models have independent TAT values and local queues; model aliases are treated as distinct models. All environments sharing a quota must use consistent qps and burst settings.
+
+Configuration is loaded when the LLM configuration object is created, not on every request. The limiter does not load `.env` itself. Coordinate worker restarts after changing deployment settings. Explicit Python `rate_limit` configuration can still override environment values. Configuration objects retain internal runtime parameters for programmatic construction and testing, but those parameters have no environment-variable interface.
+
+Remove all legacy `MEMOS_LLM_RATE_LIMIT_*` variables other than `ENABLED` and `RULES`, including MODELS, QPS, BURST, SCOPE, CONFIG_FILE, REDIS_*, and WAIT_JITTER_SECONDS. Unsupported variables cause a configuration-loading error rather than being silently ignored. Also remove enabled, scope, jitter, and backoff parameters from old model rules. Selecting a separate JSON configuration file through an environment variable is no longer supported.
+
+When migrating from hashed keys or an older prefix, coordinate the switch across all instances to avoid simultaneous admission through both old and new keys. A new key starts with a full burst allowance. Do not change prefixes arbitrarily while the system is running.
+
+## Internal Behavior
+
+- Lua uses Redis TIME to atomically read, check, and update TAT. Rejection does not advance TAT. Python uses register_script; a local Lua installation is not required.
+- Only the queue head requests a Redis permit for each process and model. Other threads wa
```

**File**: `src/memos/configs/llm.py` (modified, +12/-0)
```diff
@@ -3,6 +3,7 @@
 from pydantic import Field, field_validator, model_validator
 
 from memos.configs.base import BaseConfig
+from memos.configs.llm_rate_limit import LLMRateLimitConfig
 
 
 class BaseLLMConfig(BaseConfig):
@@ -23,6 +24,17 @@ class BaseLLMConfig(BaseConfig):
 
 
 class OpenAILLMConfig(BaseLLMConfig):
+    rate_limit: LLMRateLimitConfig = Field(default_factory=LLMRateLimitConfig.load)
+
+    @field_validator("rate_limit", mode="before")
+    @classmethod
+    def load_rate_limit(cls, value: Any) -> LLMRateLimitConfig:
+        if isinstance(value, LLMRateLimitConfig):
+            return value
+        if not isinstance(value, dict):
+            raise ValueError("rate_limit must be a configuration object")
+        return LLMRateLimitConfig.load(value)
+
     api_key: str = Field(..., description="API key for OpenAI")
     api_base: str = Field(
         default="https://api.openai.com/v1", description="Base URL for OpenAI API"
```

**File**: `src/memos/configs/llm_rate_limit.py` (added, +124/-0)
```diff
@@ -0,0 +1,124 @@
+"""Startup-loaded, opt-in QPS policies for OpenAI-compatible LLM calls."""
+
+import math
+import os
+
+from typing import Any, Literal
+
+from pydantic import ConfigDict, Field, TypeAdapter, model_validator
+
+from memos.configs.base import BaseConfig
+from memos.exceptions import ConfigurationError
+
+
+_RULE_FIELDS = frozenset({"qps", "burst", "max_wait_seconds", "queue_capacity", "retry_attempts"})
+
+
+class QPSLimitRule(BaseConfig):
+    """A quota pool's pacing, waiting and retry policy; burst is total capacity."""
+
+    enabled: bool = True
+    qps: float = Field(default=5.0, ge=0.001, le=1_000_000, allow_inf_nan=False)
+    burst: int = Field(default=2, ge=1, le=1_000_000)
+    max_wait_seconds: float = Field(default=30.0, gt=0, le=3600, allow_inf_nan=False)
+    queue_capacity: int = Field(default=16, ge=1, le=100_000)
+    wait_jitter_seconds: float = Field(default=0.01, ge=0, le=1, allow_inf_nan=False)
+    retry_attempts: int = Field(
+        default=1, ge=0, le=10, description="Retries after the first attempt"
+    )
+    retry_initial_delay: float = Field(default=1.0, gt=0, le=300, allow_inf_nan=False)
+    retry_max_delay: float = Field(default=8.0, gt=0, le=300, allow_inf_nan=False)
+
+    @model_validator(mode="after")
+    def validate_policy(self) -> "QPSLimitRule":
+        if self.retry_initial_delay > self.retry_max_delay:
+            raise ValueError("retry_initial_delay must not exceed retry_max_delay")
+        if math.ceil(1_000_000 / self.qps) * self.burst > 1_000_000_000_000:
+            raise ValueError("The burst recovery horizon must not exceed 1000000 seconds")
+        return self
+
+
+class LLMRateLimitConfig(QPSLimitRule):
+    """Load enabled/rules from env and reuse scheduler Redis connection settings."""
+
+    model_config = ConfigDict(extra="forbid", strict=True, hide_input_in_errors=True)
+
+    enabled: bool = False
+    rules: dict[str, dict[str, Any]] = Field(
+        default_factory=lambda: {"gpt-4o-mini": {}},
+        description="Selected models and their QPS, burst, wait, queue and retry settings",
+    )
+    redis_host: str | None = Field(default=None, min_length=1)
+    redis_port: int = Field(default=6379, ge=1, le=65535)
+    redis_db: int = Field(default=0, ge=0)
+    redis_username: str | None = None
+    redis_password: str | None = Field(default=None, repr=False)
+    redis_ssl: bool = False
+    redis_socket_timeout: float = Field(default=0.5, gt=0, le=30, allow_inf_nan=False)
+    key_prefix: str = Field(default="memos:llm:gcra", min_length=1, max_length=128)
+    failure_mode: Literal["closed", "open"] = "closed"
+
+    def _base_rule(self) -> dict[str, Any]:
+        return self.model_dump(include=set(QPSLimitRule.model_fields) - {"model_schema"})
+
+    @model_validator(mode="after")
+    def validate_rules(self) -> "LLMRateLimitConfig":
+        for model, overrides in self.rules.items():
+            if not model.strip() or model == "*":
+                raise ValueError("rules must use explicit nonblank model names")
+            if set(overrides) - _RULE_FIELDS:
+                raise ValueError(
+                    "rules only support qps, burst, max_wait_seconds, queue_capacity, retry_attempts"
+                )
+            QPSLimitRule.model_validate({**self._base_rule(), **overrides})
+        if any(char in self.key_prefix for char in "{}") or not self.key_prefix.strip():
+            raise ValueError("key_prefix must be nonblank and must not contain Redis hash tags")
+        return self
+
+    def rule_for(self, model: str) -> QPSLimitRule | None:
+        """Resolve the actual wire model without applying policies to unlisted models."""
+        if not self.enabled or model not in self.rules:
+            return None
+        return QPSLimitRule.model_validate({**self._base_rule(), **self.rules[model]})
+
+    @classmethod
+    def load(cls, overrides: dict[str, Any] | None = None) -> "LLMRateLimitConfig":
+        """Read configuration at construction time; never load or modify .env here."""
+        supported = {"MEMOS_LLM_RATE_LIMIT_ENABLED", "MEMOS_LLM_RATE_LIMIT_RULES"}
+        unsupported = sorted(
+            name
+            for name in os.environ
+            if name.startswith("MEMOS_LLM_RATE_LIMIT_") and name not in supported
+        )
+        if unsupported:
+            raise ConfigurationError(
+                "Only MEMOS_LLM_RATE_LIMIT_ENABLED and MEMOS_LLM_RATE_LIMIT_RULES are supported; "
+                "remove: " + ", ".join(unsupported)
+            )
+        values: dict[str, Any] = {}
+        env_values: dict[str, str] = {}
+        for name in ("host", "port", "db", "username", "password", "ssl"):
+            raw = os.getenv(f"MEMSCHEDULER_REDIS_{name.upper()}")
+            if raw:
+                env_values[f"redis_{name}"] = raw
+        for name in ("enabled", "rules"):
+            raw = os.getenv(f"MEMOS_LLM_RATE_LIMIT_{name.upper()}")
+            if raw is not None
```

**File**: `src/memos/exceptions.py` (modified, +13/-0)
```diff
@@ -24,6 +24,19 @@ class VectorDBError(MemOSError): ...
 class LLMError(MemOSError): ...
 
 
+class LLMRateLimitError(LLMError):
+    """Local admission failed; do not bypass it through model retries or fallback."""
+
+
+class LLMRateLimitTimeoutError(LLMRateLimitError): ...
+
+
+class LLMRateLimitQueueFullError(LLMRateLimitError): ...
+
+
+class LLMRateLimitUnavailableError(LLMRateLimitError): ...
+
+
 class EmbedderError(MemOSError): ...
 
 
```

**File**: `src/memos/llms/openai.py` (modified, +34/-24)
```diff
@@ -10,6 +10,8 @@
 from openai.types.chat.chat_completion_message_tool_call import ChatCompletionMessageToolCall
 
 from memos.configs.llm import AzureLLMConfig, OpenAILLMConfig
+from memos.exceptions import ConfigurationError, LLMRateLimitError
+from memos.llms import rate_limit
 from memos.llms.base import BaseLLM
 from memos.llms.utils import remove_thinking_tags
 from memos.log import get_logger
@@ -99,13 +101,17 @@ def generate(self, messages: MessageList, **kwargs) -> str:
         logger.info(f"OpenAI LLM Request body: {request_body}")
 
         try:
-            response = self.client.chat.completions.create(**request_body)
+            response = rate_limit.create_completion(
+                self.client, request_body, self.config.rate_limit
+            )
             cost_time = time.perf_counter() - start_time
             logger.info(
                 f"Request body: {request_body}, Response from OpenAI: "
                 f"{response.model_dump_json()}, Cost time: {cost_time}"
             )
             return self._parse_response(response)
+        except (LLMRateLimitError, ConfigurationError):
+            raise
         except Exception as e:
             if not self.use_backup_client:
                 raise
@@ -117,7 +123,9 @@ def generate(self, messages: MessageList, **kwargs) -> str:
                 **request_body,
                 "model": self.config.backup_model_name_or_path or request_body["model"],
             }
-            backup_response = self.backup_client.chat.completions.create(**backup_body)
+            backup_response = rate_limit.create_completion(
+                self.backup_client, backup_body, self.config.rate_limit
+            )
             cost_time = time.perf_counter() - start_time
             logger.info(
                 f"Backup LLM request succeeded, Response: "
@@ -141,30 +149,32 @@ def generate_stream(self, messages: MessageList, **kwargs) -> Generator[str, Non
         request_body["stream"] = True
 
         logger.info(f"OpenAI LLM Stream Request body: {request_body}")
-        response = self.client.chat.completions.create(**request_body)
+        response = rate_limit.create_completion(self.client, request_body, self.config.rate_limit)
 
         reasoning_started = False
-
-        for chunk in response:
-            if not chunk.choices:
-                continue
-            delta = chunk.choices[0].delta
-
-            # Support for custom 'reasoning_content' (if present in OpenAI-compatible models like Qwen, DeepSeek)
-            if hasattr(delta, "reasoning_content") and delta.reasoning_content:
-                if not reasoning_started and not self.config.remove_think_prefix:
-                    yield "<think>"
-                    reasoning_started = True
-                yield delta.reasoning_content
-            elif hasattr(delta, "content") and delta.content:
-                if reasoning_started and not self.config.remove_think_prefix:
-                    yield "</think>"
-                    reasoning_started = False
-                yield delta.content
-
-        # Ensure we close the <think> block if not already done
-        if reasoning_started and not self.config.remove_think_prefix:
-            yield "</think>"
+        try:
+            for chunk in response:
+                if not chunk.choices:
+                    continue
+                delta = chunk.choices[0].delta
+
+                if hasattr(delta, "reasoning_content") and delta.reasoning_content:
+                    if not reasoning_started and not self.config.remove_think_prefix:
+                        yield "<think>"
+                        reasoning_started = True
+                    yield delta.reasoning_content
+                elif hasattr(delta, "content") and delta.content:
+                    if reasoning_started and not self.config.remove_think_prefix:
+                        yield "</think>"
+                        reasoning_started = False
+                    yield delta.content
+
+            if reasoning_started and not self.config.remove_think_prefix:
+                yield "</think>"
+        finally:
+            close = getattr(response, "close", None)
+            if callable(close):
+                close()
 
     def tool_call_parser(self, tool_calls: list[ChatCompletionMessageToolCall]) -> list[dict]:
         """Parse tool calls from OpenAI response."""
```

**File**: `src/memos/llms/rate_limit.py` (added, +275/-0)
```diff
@@ -0,0 +1,275 @@
+"""Opt-in Redis GCRA admission for OpenAI-compatible chat completions."""
+
+import math
+import os
+import random
+import threading
+import time
+
+from collections import deque
+from datetime import datetime, timezone
+from email.utils import parsedate_to_datetime
+from typing import Any
+
+import openai
+
+from memos.configs.llm_rate_limit import LLMRateLimitConfig, QPSLimitRule
+from memos.exceptions import (
+    ConfigurationError,
+    LLMRateLimitQueueFullError,
+    LLMRateLimitTimeoutError,
+    LLMRateLimitUnavailableError,
+)
+from memos.log import get_logger
+
+
+logger = get_logger(__name__)
+
+GCRA_LUA = """
+local interval = tonumber(ARGV[1])
+local burst = tonumber(ARGV[2])
+local clock = redis.call('TIME')
+local now = tonumber(clock[1]) * 1000000 + tonumber(clock[2])
+local raw = redis.call('GET', KEYS[1])
+local tat = tonumber(raw)
+if raw and not tat then
+    return redis.error_reply('Invalid GCRA state')
+end
+tat = tat or now
+local wait = tat - (burst - 1) * interval - now
+if wait > 0 then
+    return {0, math.ceil(wait)}
+end
+local next_tat = math.max(tat, now) + interval
+redis.call('SET', KEYS[1], string.format('%.0f', next_tat),
+           'PX', math.max(1, math.ceil((next_tat - now) / 1000)))
+return {1, 0}
+"""
+
+
+def _create_redis_client(config: LLMRateLimitConfig) -> Any:
+    if not config.redis_host:
+        raise ConfigurationError("LLM QPS limiting requires a Redis host")
+    try:
+        import redis
+
+        from redis.backoff import NoBackoff
+        from redis.retry import Retry
+    except ImportError as exc:
+        raise ConfigurationError(
+            "Install the mem-scheduler extras to enable LLM QPS limiting"
+        ) from exc
+    return redis.Redis(
+        host=config.redis_host,
+        port=config.redis_port,
+        db=config.redis_db,
+        username=config.redis_username,
+        password=config.redis_password,
+        ssl=config.redis_ssl,
+        socket_timeout=config.redis_socket_timeout,
+        socket_connect_timeout=config.redis_socket_timeout,
+        max_connections=2,
+        decode_responses=True,
+        retry=Retry(NoBackoff(), 0),
+    )
+
+
+class RedisGCRALimiter:
+    """One bounded queue per process/quota; only its head accesses Redis."""
+
+    def __init__(self, config: LLMRateLimitConfig, rule: QPSLimitRule, key: str) -> None:
+        self.config = config.model_copy(deep=True)
+        self.rule = rule.model_copy(deep=True)
+        self.redis_key = key
+        self._client = _create_redis_client(config)
+        self._script = self._client.register_script(GCRA_LUA)
+        self._condition = threading.Condition()
+        self._queue: deque[object] = deque()
+
+    @property
+    def pending_count(self) -> int:
+        """Number of local waiters including the active queue head."""
+        with self._condition:
+            return len(self._queue)
+
+    def acquire(self, timeout_seconds: float | None = None) -> None:
+        """Wait for admission, bounded by a cumulative monotonic deadline."""
+        from redis.exceptions import RedisError
+
+        started = time.monotonic()
+        timeout = self.rule.max_wait_seconds if timeout_seconds is None else timeout_seconds
+        deadline = started + timeout
+        waiter = object()
+        with self._condition:
+            if len(self._queue) >= self.rule.queue_capacity:
+                logger.warning("[LLM_RATE_LIMIT] queue_full key=%s", self.redis_key)
+                raise LLMRateLimitQueueFullError("LLM permit queue is full")
+            self._queue.append(waiter)
+        checks = 0
+        next_check = started
+        try:
+            while True:
+                with self._condition:
+                    now = time.monotonic()
+                    if now >= deadline:
+                        raise LLMRateLimitTimeoutError("LLM permit waiting deadline exceeded")
+                    head = self._queue[0] is waiter
+                    if not head or now < next_check:
+                        delay = min(deadline - now, next_check - now) if head else deadline - now
+                        self._condition.wait(delay)
+                        continue
+                try:
+                    checks += 1
+                    reply = self._script(
+                        keys=[self.redis_key],
+                        args=[math.ceil(1_000_000 / self.rule.qps), self.rule.burst],
+                    )
+                except RedisError:
+                    logger.warning(
+                        "[LLM_RATE_LIMIT] redis_unavailable key=%s failure_mode=%s",
+                        self.redis_key,
+                        self.config.failure_mode,
+                    )
+                    if self.config.failure_mode == "open" and time.monotonic() < deadline:
+                        return
+                    raise LLMRateLimitUnavailableError("Redis LLM limiter is unavailable") from None
+                if time
```

---

### Incident Patch 6: `be07f5a8` (2026-09-18)
**Commit Message**: fix(plugin): harden memory evolution and Hermes install

**File**: `apps/memos-local-plugin/adapters/hermes/README.md` (modified, +30/-0)
```diff
@@ -25,6 +25,36 @@ keepalive, reconnect generation, and host callback dispatch. All algorithm
 logic (L1/L2/L3, skills, retrieval, feedback, decision repair) remains in the
 shared TypeScript core.
 
+## Desktop and custom Unix installations
+
+Use the backend source directory and Python environment used by the desktop
+app, which may differ from the CLI installation. The Unix installer validates
+`hermes_cli` and `plugins.memory.load_memory_provider` before stopping Hermes
+or deploying the plugin. It checks literal Python/Bash launchers and the default
+backend's `venv` and `.venv` directories.
+
+If auto-detection fails, use the updated `install.sh` with explicit paths:
+
+```bash
+HERMES_INSTALL_DIR="/actual/path/to/hermes-agent" \
+HERMES_PYTHON="/actual/path/to/hermes-agent/venv/bin/python" \
+bash install.sh --agent hermes
+```
+
+`HERMES_INSTALL_DIR` is the backend source directory containing `hermes_cli`
+and `plugins/memory`, not simply the `.app` bundle. `HERMES_PYTHON` must be the
+interpreter that runs that backend. Explicit paths fail with diagnostic output
+instead of falling back to another installation. Paths containing spaces work
+when quoted. For a non-default data/config directory, also set `HERMES_HOME`;
+it defaults to `~/.hermes`. The MemOS package/data location remains
+`~/.hermes/memos-plugin` for compatibility with existing installations.
+
+If the chosen interpreter cannot import the host's memory provider API, repair
+or update that Hermes environment. Creating an empty `plugins/memory` directory
+does not supply the missing API. Restart the desktop app after installation.
+Desktop distributions with unrecognized layouts require explicit paths; these
+options do not imply that every desktop release has been tested.
+
 ## Protocol surface
 
 The adapter calls the following methods on the bridge:
```

**File**: `apps/memos-local-plugin/core/memory/l3/ALGORITHMS.md` (modified, +9/-5)
```diff
@@ -126,16 +126,20 @@ strict, high-gain clusters surface first.
 
 ## 4. Evidence packing
 
-Per cluster we assemble a prompt payload:
+Per cluster we assemble one or more prompt payloads. Policies are sorted
+deterministically and split into batches of at most
+`maxPoliciesPerCluster`; the limit bounds prompt size and never discards
+cluster members. Batch drafts are then unioned into one draft before the
+single merge/create decision.
 
 ```
 {
   primary_tag: string,
   domain_tags: string[],
   avg_gain: number,
   avg_support: number,
-  policies: PolicyPrompt[],     // up to |cluster|, each capped
-  evidence:  TracePrompt[]      // at most traceEvidencePerPolicy × |cluster|
+  policies: PolicyPrompt[],     // up to maxPoliciesPerCluster, each capped
+  evidence:  TracePrompt[]      // at most traceEvidencePerPolicy × batch size
 }
 ```
 
@@ -144,8 +148,8 @@ Per cluster we assemble a prompt payload:
 * For each policy we fetch the most recent non-redacted supporting
   trace (by `episodeId`) and include up to `traceCharCap` characters of
   `userText + reflection`. Evidence is **read-only**, never mutated.
-* Total token budget is bounded by `policyCharCap × |cluster| +
-  traceCharCap × evidencePerPolicy × |cluster|`, which is deterministic
+* Per-call token budget is bounded by `policyCharCap × batchSize +
+  traceCharCap × evidencePerPolicy × batchSize`, which is deterministic
   and easy to debug.
 
 ---
```

**File**: `apps/memos-local-plugin/core/memory/l3/README.md` (modified, +8/-3)
```diff
@@ -37,8 +37,8 @@ l2.policy.induced  ── triggers ──▶  attachL3Subscriber
    2. cluster by (domainKey, centroid cosine ≥ similarity)
    3. cooldown check per primary domain tag
    4. for each cluster:
-        a. pack policies + a small evidence trace slice
-        b. `l3.abstraction` prompt → draft
+        a. split policies into prompt-sized batches without dropping members
+        b. `l3.abstraction` prompt per batch → one combined draft
         c. gather candidate WMs via findByDomainTag
         d. chooseMergeTarget(cluster, candidates, draft)
              ├── update: mergeForUpdate + updateBody + bump confidence
@@ -61,6 +61,11 @@ No single step blocks reward/L2. Any LLM failure is captured as a
 cosine, so policies in the same bucket that are still semantically far
 apart (different sub-environments) end up in separate clusters.
 
+`maxPoliciesPerCluster` is a prompt-size bound, not a retention bound.
+Clusters larger than that value are processed in deterministic policy-id
+batches. Their drafts are merged before persistence, so all source policy
+and episode ids remain attached to a single world model.
+
 ### Merge vs create
 
 Whenever a cluster's centroid cosine-matches an existing WM that shares
@@ -146,7 +151,7 @@ See `algorithm.l3Abstraction` in
 | `traceEvidencePerPolicy`     | `1`     | Evidence traces per policy in the prompt.    |
 | `useLlm`                     | `true`  | Toggle the LLM abstractor off for tests.      |
 | `cooldownDays`               | `1`     | Debounce per domain tag.                       |
-| `maxPoliciesPerCluster`      | `20`    | Cap policies included in one abstraction prompt. |
+| `maxPoliciesPerCluster`      | `20`    | Batch size for one abstraction prompt; overflow is retained. |
 | `confidenceDelta`            | `0.05`  | Confidence step per merge / feedback.         |
 | `minConfidenceForRetrieval`  | `0.2`   | Tier-3 hide threshold.                        |
 
```

**File**: `apps/memos-local-plugin/core/memory/l3/cluster.ts` (modified, +6/-9)
```diff
@@ -189,20 +189,19 @@ export function clusterPolicies(
       continue;
     }
 
-    const capped = cohort
+    const ordered = cohort
       .slice()
-      .sort((a, b) => String(a.policy.id).localeCompare(String(b.policy.id)))
-      .slice(0, Math.max(1, config.maxPoliciesPerCluster ?? 20));
-    if (capped.length < requiredPolicies) continue;
+      .sort((a, b) => String(a.policy.id).localeCompare(String(b.policy.id)));
+    if (ordered.length < requiredPolicies) continue;
     const tags = new Set<string>();
-    for (const m of capped) for (const t of m.tags) tags.add(t);
+    for (const m of ordered) for (const t of m.tags) tags.add(t);
 
     const avgGain =
-      capped.reduce((s, m) => s + m.policy.gain, 0) / Math.max(1, capped.length);
+      ordered.reduce((s, m) => s + m.policy.gain, 0) / Math.max(1, ordered.length);
 
     out.push({
       key,
-      policies: capped.map((m) => m.policy),
+      policies: ordered.map((m) => m.policy),
       domainTags: Array.from(tags),
       centroidVec: center,
       avgGain,
@@ -228,7 +227,6 @@ function clusterUntagged(
   config: ClusterDeps["config"],
 ): PolicyCluster[] {
   const requiredPolicies = Math.max(2, config.minPolicies);
-  const maxPolicies = Math.max(1, config.maxPoliciesPerCluster ?? 20);
   const groups: PolicyWithMeta[][] = [];
 
   for (const member of members
@@ -237,7 +235,6 @@ function clusterUntagged(
     .sort((a, b) => String(a.policy.id).localeCompare(String(b.policy.id)))) {
     let target: PolicyWithMeta[] | undefined;
     for (const group of groups) {
-      if (group.length >= maxPolicies) continue;
       const center = centroid(group.map((m) => m.policy.vec ?? null));
       if (center && member.policy.vec && cosine(center, member.policy.vec) >= config.clusterMinSimilarity) {
         target = group;
```

**File**: `apps/memos-local-plugin/core/memory/l3/l3.ts` (modified, +73/-4)
```diff
@@ -43,6 +43,9 @@ import {
 } from "./merge.js";
 import type {
   AbstractionResult,
+  L3AbstractionDraft,
+  L3AbstractionDraftEntry,
+  L3AbstractionDraftResult,
   L3Config,
   L3Event,
   L3EventBus,
@@ -171,10 +174,30 @@ export async function runL3(
     const triggerEpisodeId = input.episodeId ?? episodeIds[0];
 
     const t0 = Date.now();
-    const draftRes = await abstractDraft(
-      { cluster, evidenceByPolicy, episodeId: triggerEpisodeId },
-      { llm: deps.llm, log: abstractLog, config },
-    );
+    const batchSize = Math.max(1, config.maxPoliciesPerCluster ?? 20);
+    const drafts: Array<{ draft: L3AbstractionDraft; policyCount: number }> = [];
+    let draftRes: L3AbstractionDraftResult | null = null;
+    for (let offset = 0; offset < cluster.policies.length; offset += batchSize) {
+      const batchPolicies = cluster.policies.slice(offset, offset + batchSize);
+      const batchPolicyIds = new Set(batchPolicies.map((policy) => policy.id));
+      const batchEvidence = new Map(
+        Array.from(evidenceByPolicy.entries()).filter(([policyId]) => batchPolicyIds.has(policyId)),
+      );
+      const batchCluster: PolicyCluster = {
+        ...cluster,
+        policies: batchPolicies,
+      };
+      const batchResult = await abstractDraft(
+        { cluster: batchCluster, evidenceByPolicy: batchEvidence, episodeId: triggerEpisodeId },
+        { llm: deps.llm, log: abstractLog, config },
+      );
+      if (!batchResult.ok) {
+        draftRes = batchResult;
+        break;
+      }
+      drafts.push({ draft: batchResult.draft, policyCount: batchPolicies.length });
+    }
+    draftRes ??= { ok: true, draft: combineBatchDrafts(drafts) };
     timings.abstract += Date.now() - t0;
 
     if (!draftRes.ok) {
@@ -391,6 +414,52 @@ function worldModelVectorText(title: string, body: string): string {
   return [title.trim(), body.trim()].filter(Boolean).join("\n\n") || "(empty)";
 }
 
+function combineBatchDrafts(
+  drafts: readonly { draft: L3AbstractionDraft; policyCount: number }[],
+): L3AbstractionDraft {
+  const first = drafts[0]!;
+  const weightedPolicyCount = drafts.reduce((sum, item) => sum + item.policyCount, 0);
+  return {
+    title: first.draft.title,
+    domainTags: dedupeStrings(drafts.flatMap((item) => item.draft.domainTags)),
+    environment: combineDraftEntries(drafts.flatMap((item) => item.draft.environment)),
+    inference: combineDraftEntries(drafts.flatMap((item) => item.draft.inference)),
+    constraints: combineDraftEntries(drafts.flatMap((item) => item.draft.constraints)),
+    body: dedupeStrings(drafts.map((item) => item.draft.body).filter(Boolean)).join("\n\n---\n\n"),
+    confidence:
+      drafts.reduce(
+        (sum, item) => sum + item.draft.confidence * item.policyCount,
+        0,
+      ) / weightedPolicyCount,
+    supersedesWorldIds: Array.from(
+      new Set(drafts.flatMap((item) => item.draft.supersedesWorldIds ?? [])),
+    ),
+  };
+}
+
+function combineDraftEntries(
+  entries: readonly L3AbstractionDraftEntry[],
+): L3AbstractionDraftEntry[] {
+  const combined = new Map<string, L3AbstractionDraftEntry>();
+  for (const entry of entries) {
+    const key = `${entry.label.trim().toLowerCase()}\u0000${entry.description.trim().toLowerCase()}`;
+    const previous = combined.get(key);
+    if (!previous) {
+      combined.set(key, { ...entry, evidenceIds: dedupeStrings(entry.evidenceIds ?? []) });
+      continue;
+    }
+    previous.evidenceIds = dedupeStrings([
+      ...(previous.evidenceIds ?? []),
+      ...(entry.evidenceIds ?? []),
+    ]);
+  }
+  return Array.from(combined.values());
+}
+
+function dedupeStrings(values: readonly string[]): string[] {
+  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
+}
+
 function skipped(
   cluster: PolicyCluster,
   reason: Exclude<AbstractionResult["skippedReason"], null>,
```

**File**: `apps/memos-local-plugin/core/skill/ALGORITHMS.md` (modified, +4/-1)
```diff
@@ -285,7 +285,10 @@ still under trial.
 
 `cooldownMs` debounces repeat runs for the same policy triggered by
 rapid-fire upstream events (e.g. a burst of `reward.updated`). The
-subscriber holds a simple in-memory `{policyId → lastRunAt}` table.
+subscriber holds an in-memory `{policyId → lastRunAt}` table plus a pending
+policy set. A reward event received during cooldown is coalesced and drained
+when that policy becomes eligible; it is not silently discarded. Different
+policies have independent cooldowns and queue entries.
 
 If `cooldownMs === 0` (as in unit tests), every event triggers a run.
 
```

**File**: `apps/memos-local-plugin/core/skill/README.md` (modified, +6/-1)
```diff
@@ -53,6 +53,11 @@ event-driven and every triggered run is fully async. Listener errors
 are captured so a bad downstream consumer can never break the
 orchestrator.
 
+For `reward.updated`, the subscriber resolves only policies linked to the
+updated episode (falling back to `sourceEpisodeIds` for legacy rows). Each
+resolved policy receives its own queue entry and cooldown, so unrelated
+policies neither trigger a global scan nor block one another.
+
 ## Key concepts
 
 ### Eligibility
@@ -201,7 +206,7 @@ See `algorithm.skill` in
 | `minSupport`                | `2`     | Min distinct-episode support to crystallize.          |
 | `minGain`                   | `0.02`  | Min policy gain required (paired with the new shrinkage-anchored gain in `core/memory/l2/gain.ts`). |
 | `candidateTrials`           | `3`     | Trials required to transition out of `candidate`. NOTE: legacy docs called this `probationaryTrials`; the schema field is `candidateTrials`. |
-| `cooldownMs`                | `21600000` | Debounce reward-triggered runs (6 hours; `0` disables). |
+| `cooldownMs`                | `21600000` | Per-policy debounce for reward-triggered runs (6 hours; `0` disables). |
 | `traceCharCap`              | `600`   | Char cap per evidence trace in the crystallize prompt.|
 | `evidenceLimit`             | `4`     | Max evidence traces per crystallize call.             |
 | `useLlm`                    | `true`  | Toggle the LLM off (tests / degraded mode).           |
```

**File**: `apps/memos-local-plugin/core/skill/subscriber.ts` (modified, +60/-23)
```diff
@@ -7,10 +7,10 @@
  *   - `l2.policy.induced`        → `runSkill({ trigger, policyId })`
  *   - `l2.policy.status_changed` → `runSkill({ trigger, policyId })` when
  *                                  the new status is `active`
- *   - `reward.updated`           → `runSkill({ trigger: "reward.updated" })`
- *                                  — evaluates every policy referenced by
- *                                  the updated episode. Also drives the η
- *                                  drift adjustment on existing skills.
+ *   - `reward.updated`           → one scoped run per policy linked to the
+ *                                  updated episode. Each policy has its own
+ *                                  cooldown and pending queue entry. Also
+ *                                  drives η adjustment on existing skills.
  *
  * The handle returns `runOnce` for manual runs (used by the CLI / viewer
  * rebuild button) and `applyFeedback` for explicit skill feedback.
@@ -33,7 +33,7 @@ import type {
   SkillFeedbackKind,
   SkillTrigger,
 } from "./types.js";
-import type { SkillId } from "../types.js";
+import type { PolicyId, SkillId } from "../types.js";
 import { now as nowMs } from "../time.js";
 import { IDLE_ARCHIVE_BATCH_LIMIT } from "../storage/repos/skills.js";
 
@@ -79,14 +79,18 @@ export function attachSkillSubscriber(
   };
 
   let inflight: Promise<void> | null = null;
-  let lastRewardRunAt: number | null = null;
-  let queued: { trigger: SkillTrigger; hint?: { policyId?: string; skillId?: SkillId } } | null =
-    null;
+  let disposed = false;
+  let rewardTimer: ReturnType<typeof setTimeout> | null = null;
+  const lastRewardRunAt = new Map<PolicyId, number>();
+  const pendingRewardPolicies = new Set<PolicyId>();
+  const queued: Array<{
+    trigger: SkillTrigger;
+    hint?: { policyId?: PolicyId; skillId?: SkillId };
+  }> = [];
 
   async function drain(): Promise<void> {
-    while (queued) {
-      const next = queued;
-      queued = null;
+    while (queued.length > 0) {
+      const next = queued.shift()!;
       try {
         await runSkill(
           { trigger: next.trigger, policyId: next.hint?.policyId, skillId: next.hint?.skillId },
@@ -103,9 +107,9 @@ export function attachSkillSubscriber(
 
   function triggerRun(
     trigger: SkillTrigger,
-    hint?: { policyId?: string; skillId?: SkillId },
+    hint?: { policyId?: PolicyId; skillId?: SkillId },
   ): void {
-    queued = { trigger, hint };
+    queued.push({ trigger, hint });
     if (inflight) {
       log.debug("skill.run.queued", { trigger });
       return;
@@ -116,18 +120,39 @@ export function attachSkillSubscriber(
     inflight = promise;
   }
 
-  function triggerRewardRun(): void {
+  function scheduleRewardRuns(): void {
+    if (disposed) return;
+    if (rewardTimer) {
+      clearTimeout(rewardTimer);
+      rewardTimer = null;
+    }
     const cooldownMs = Math.max(0, deps.config.cooldownMs);
     const at = nowMs();
-    if (cooldownMs > 0 && lastRewardRunAt !== null && at - lastRewardRunAt < cooldownMs) {
-      log.debug("skill.run.cooldown", {
-        trigger: "reward.updated",
-        remainingMs: cooldownMs - (at - lastRewardRunAt),
-      });
-      return;
+    let nextDelay: number | null = null;
+    for (const policyId of pendingRewardPolicies) {
+      const lastRunAt = lastRewardRunAt.get(policyId);
+      const remainingMs = lastRunAt === undefined ? 0 : cooldownMs - (at - lastRunAt);
+      if (remainingMs > 0) {
+        nextDelay = nextDelay === null ? remainingMs : Math.min(nextDelay, remainingMs);
+        log.debug("skill.run.cooldown", {
+          trigger: "reward.updated",
+          policyId,
+          remainingMs,
+        });
+        continue;
+      }
+      pendingRewardPolicies.delete(policyId);
+      lastRewardRunAt.set(policyId, at);
+      triggerRun("reward.updated", { policyId });
     }
-    lastRewardRunAt = at;
-    triggerRun("reward.updated");
+    if (nextDelay !== null && pendingRewardPolicies.size > 0) {
+      rewardTimer = setTimeout(scheduleRewardRuns, nextDelay);
+    }
+  }
+
+  function triggerRewardRuns(policyIds: readonly PolicyId[]): void {
+    for (const policyId of policyIds) pendingRewardPolicies.add(policyId);
+    scheduleRewardRuns();
   }
 
   const offInduced = deps.l2Bus.on("l2.policy.induced", (evt: L2Event) => {
@@ -149,10 +174,22 @@ export function attachSkillSubscriber(
       episodeId: evt.result.episodeId,
     });
     resolveTrialsForReward(evt);
-    triggerRewardRun();
+    const linkedPolicyIds = deps.repos.tracePolicyLinks.getLinkedPolicyIds(evt.result.episodeId);
+    const sourceEpisodePolicyIds = deps.repos.policies
+      .list({ status: "active", limit: 200 })
+      .filter((policy) => policy.sourceEpisodeIds.includes(evt.result.episodeId))
+      .map((policy) => policy.id);
+    const relatedPolicyIds = Array.from(
+      new Set([...linkedPolicyIds, ...sourceEpisodePolicyIds]),
+    );
+    triggerRewardRun
```

---

### Incident Patch 7: `8c47b6d6` (2026-09-16)
**Commit Message**: fix(plugin): harden L3 clustering retries

**File**: `apps/memos-local-plugin/core/config/defaults.ts` (modified, +3/-3)
```diff
@@ -250,9 +250,9 @@ export const DEFAULT_CONFIG: ResolvedConfig = {
       // real usage; 1 lets the candidate→active transition happen
       // immediately on first successful invocation.
       candidateTrials: 1,
-      // Lowered from 6 hours → 0: no cooldown, skills can re-evolve
-      // as soon as new evidence arrives.
-      cooldownMs: 0,
+      // Verification failures are retried after six hours by default;
+      // operators may set this to 0 when immediate re-evaluation is desired.
+      cooldownMs: 6 * 60 * 60 * 1000,
       traceCharCap: 500,
       evidenceLimit: 6,
       useLlm: true,
```

**File**: `apps/memos-local-plugin/core/memory/l3/ALGORITHMS.md` (modified, +8/-2)
```diff
@@ -250,9 +250,15 @@ if (now − kv.get(key)) < cooldownDays × 86_400_000:
 
 ## 9. Failure policy
 
-* Storage error → propagate. Partial state remains; next run sees the
-  same eligible policies and re-drives.
+* Storage error → warn for the affected cluster and retain retry state.
+  Other clusters continue; a later run re-drives the failed cluster.
 * LLM error → single-cluster skip, reason logged. No cooldown update.
+
+Failed LLM drafts use a persisted retry key scoped by cluster membership. The
+retry delays are 5 minutes, 30 minutes, 2 hours, then 6 hours (capped), so a
+repeated provider failure cannot consume one LLM call per episode. A successful
+world-model insert/update clears the retry key and only then records the normal
+cooldown. Storage failures keep the retry state and do not record success.
   Other clusters continue.
 * Invalid draft (missing `environment/inference/constraints`) →
   treated as LLM error.
```

**File**: `apps/memos-local-plugin/core/memory/l3/README.md` (modified, +1/-0)
```diff
@@ -146,6 +146,7 @@ See `algorithm.l3Abstraction` in
 | `traceEvidencePerPolicy`     | `1`     | Evidence traces per policy in the prompt.    |
 | `useLlm`                     | `true`  | Toggle the LLM abstractor off for tests.      |
 | `cooldownDays`               | `1`     | Debounce per domain tag.                       |
+| `maxPoliciesPerCluster`      | `20`    | Cap policies included in one abstraction prompt. |
 | `confidenceDelta`            | `0.05`  | Confidence step per merge / feedback.         |
 | `minConfidenceForRetrieval`  | `0.2`   | Tier-3 hide threshold.                        |
 
```

**File**: `apps/memos-local-plugin/core/memory/l3/cluster.ts` (modified, +50/-3)
```diff
@@ -123,6 +123,11 @@ export function clusterPolicies(
   for (const [key, members] of byKey) {
     if (members.length < config.minPolicies) continue;
 
+    if (key === "_|_") {
+      out.push(...clusterUntagged(members, config));
+      continue;
+    }
+
     const vecs: Array<EmbeddingVector | null> = members.map((m) => m.policy.vec ?? null);
     const center = centroid(vecs);
 
@@ -173,9 +178,7 @@ export function clusterPolicies(
     // here is only "strict subset" vs "whole bucket".
     let cohort: PolicyWithMeta[];
     let admission: "strict" | "loose";
-    const requiredPolicies = key === "_|_"
-      ? Math.max(2, config.minPolicies)
-      : config.minPolicies;
+    const requiredPolicies = config.minPolicies;
     if (strict.length >= requiredPolicies) {
       cohort = strict;
       admission = "strict";
@@ -219,3 +222,47 @@ export function clusterPolicies(
   });
   return out;
 }
+
+function clusterUntagged(
+  members: readonly PolicyWithMeta[],
+  config: ClusterDeps["config"],
+): PolicyCluster[] {
+  const requiredPolicies = Math.max(2, config.minPolicies);
+  const maxPolicies = Math.max(1, config.maxPoliciesPerCluster ?? 20);
+  const groups: PolicyWithMeta[][] = [];
+
+  for (const member of members
+    .filter((m) => m.policy.vec)
+    .slice()
+    .sort((a, b) => String(a.policy.id).localeCompare(String(b.policy.id)))) {
+    let target: PolicyWithMeta[] | undefined;
+    for (const group of groups) {
+      if (group.length >= maxPolicies) continue;
+      const center = centroid(group.map((m) => m.policy.vec ?? null));
+      if (center && member.policy.vec && cosine(center, member.policy.vec) >= config.clusterMinSimilarity) {
+        target = group;
+        break;
+      }
+    }
+    if (target) target.push(member);
+    else groups.push([member]);
+  }
+
+  return groups
+    .filter((group) => group.length >= requiredPolicies)
+    .map((group) => {
+      const center = centroid(group.map((m) => m.policy.vec ?? null));
+      const cohesion = center
+        ? group.reduce((sum, m) => sum + cosine(center, m.policy.vec!), 0) / group.length
+        : 0;
+      return {
+        key: `_|_:vec:${String(group[0]!.policy.id)}`,
+        policies: group.map((m) => m.policy),
+        domainTags: [],
+        centroidVec: center,
+        avgGain: group.reduce((sum, m) => sum + m.policy.gain, 0) / group.length,
+        cohesion,
+        admission: "strict" as const,
+      };
+    });
+}
```

**File**: `apps/memos-local-plugin/core/memory/l3/l3.ts` (modified, +12/-3)
```diff
@@ -178,7 +178,9 @@ export async function runL3(
     timings.abstract += Date.now() - t0;
 
     if (!draftRes.ok) {
-      recordFailure(cluster, repos.kv, now);
+      if (draftRes.reason === "llm_failed" || draftRes.reason === "draft_invalid") {
+        recordFailure(cluster, repos.kv, now);
+      }
       abstractions.push(skipped(cluster, draftRes.reason, { episodeIds, policyIds: cluster.policies.map((p) => p.id) }));
       emit(bus, {
         kind: "l3.failed",
@@ -195,6 +197,7 @@ export async function runL3(
       lookup: repos.worldModel,
       config,
     });
+    let persisted = false;
 
     if (decision.kind === "update") {
       const patch = mergeForUpdate({
@@ -268,6 +271,7 @@ export async function runL3(
           policyIds: patch.policyIds as PolicyId[],
           confidence: bumped,
         });
+        persisted = true;
       } catch (err) {
         warnings.push(stageWarn("merge", err, { clusterKey: cluster.key }));
       }
@@ -317,13 +321,18 @@ export async function runL3(
           policyIds: wm.policyIds,
           confidence: wm.confidence,
         });
+        persisted = true;
       } catch (err) {
         warnings.push(stageWarn("insert", err, { clusterKey: cluster.key }));
       }
     }
 
-    markCooldown(cluster, repos.kv, now);
-    repos.kv.del(retryKey(cluster));
+    if (persisted) {
+      markCooldown(cluster, repos.kv, now);
+      repos.kv.del(retryKey(cluster));
+    } else {
+      recordFailure(cluster, repos.kv, now);
+    }
     timings.persist += Date.now() - t1;
   }
 
```

**File**: `apps/memos-local-plugin/core/skill/README.md` (modified, +1/-1)
```diff
@@ -201,7 +201,7 @@ See `algorithm.skill` in
 | `minSupport`                | `2`     | Min distinct-episode support to crystallize.          |
 | `minGain`                   | `0.02`  | Min policy gain required (paired with the new shrinkage-anchored gain in `core/memory/l2/gain.ts`). |
 | `candidateTrials`           | `3`     | Trials required to transition out of `candidate`. NOTE: legacy docs called this `probationaryTrials`; the schema field is `candidateTrials`. |
-| `cooldownMs`                | `60000` | Debounce between runs triggered by the same policy.   |
+| `cooldownMs`                | `21600000` | Debounce reward-triggered runs (6 hours; `0` disables). |
 | `traceCharCap`              | `600`   | Char cap per evidence trace in the crystallize prompt.|
 | `evidenceLimit`             | `4`     | Max evidence traces per crystallize call.             |
 | `useLlm`                    | `true`  | Toggle the LLM off (tests / degraded mode).           |
```

**File**: `apps/memos-local-plugin/tests/unit/memory/l3/cluster.test.ts` (modified, +21/-20)
```diff
@@ -215,30 +215,25 @@ describe("memory/l3/cluster", () => {
       expect(keys.some((k) => k.includes("node") || k.includes("npm"))).toBe(true);
     });
 
-    it("falls back to loose admission when strict subset is too small but bucket survives", () => {
-      // All three policies share the same domain key (`python|_`) but
-      // their vectors point in mutually-orthogonal directions, so the
-      // strict (cosine ≥ minSimilarity) subset would be empty. The
-      // bucket itself satisfies minPolicies, so `cluster.ts` should
-      // fall back to admitting the WHOLE bucket as a `loose` cluster.
+    it("does not cluster unrelated untagged policies", () => {
       const policies = [
         mkPolicy({
           id: "po_validate" as PolicyId,
           title: "validate python syntax",
-          trigger: "after writing python files",
-          procedure: "python -m py_compile <file>",
+          trigger: "after writing source files",
+          procedure: "run the syntax checker on the changed file",
           vec: vec([1, 0, 0]),
         }),
         mkPolicy({
           id: "po_cli" as PolicyId,
-          title: "register python CLI subcommand",
+          title: "register a command line subcommand",
           trigger: "adding a new task verb",
           procedure: "register(subparsers) + handler() -> int",
           vec: vec([0, 1, 0]),
         }),
         mkPolicy({
           id: "po_storage" as PolicyId,
-          title: "implement python storage backend",
+          title: "implement a storage backend",
           trigger: "new persistence format requested",
           procedure: "implement load/save with UTF-8",
           vec: vec([0, 0, 1]),
@@ -248,16 +243,22 @@ describe("memory/l3/cluster", () => {
         { policies },
         { config: { clusterMinSimilarity: 0.6, minPolicies: 2 } },
       );
-      expect(clusters.length).toBe(1);
-      const c = clusters[0]!;
-      expect(c.admission).toBe("loose");
-      expect(c.policies.length).toBe(3);
-      // Centroid of three orthogonal unit vectors gives mean cosine
-      // 1/sqrt(3) ≈ 0.577 — strictly less than 0.6 (the strict floor),
-      // confirming we landed in the loose fallback for the right
-      // reason and not because of a bug elsewhere.
-      expect(c.cohesion).toBeLessThan(0.6);
-      expect(c.cohesion).toBeGreaterThan(0.49);
+      expect(clusters).toEqual([]);
+    });
+
+    it("clusters similar untagged policies and enforces the cap", () => {
+      const policies = [1, 2, 3].map((n) => mkPolicy({
+        id: `po_uv${n}` as PolicyId,
+        title: `中文策略 ${n}`,
+        vec: vec([1, n * 0.01, 0]),
+      }));
+      const clusters = clusterPolicies(
+        { policies },
+        { config: { clusterMinSimilarity: 0.6, minPolicies: 2, maxPoliciesPerCluster: 2 } },
+      );
+      expect(clusters).toHaveLength(1);
+      expect(clusters[0]!.policies).toHaveLength(2);
+      expect(clusters[0]!.admission).toBe("strict");
     });
 
     it("filters outliers below clusterMinSimilarity", () => {
```

**File**: `apps/memos-local-plugin/tests/unit/memory/l3/l3.integration.test.ts` (modified, +78/-0)
```diff
@@ -38,6 +38,16 @@ import {
 
 const OP = `${L3_ABSTRACTION_PROMPT.id}.v${L3_ABSTRACTION_PROMPT.version}`;
 const log = rootLogger.child({ channel: "core.memory.l3" });
+const validDraft = {
+  title: "Alpine python dependency model",
+  domain_tags: ["docker", "alpine", "pip"],
+  environment: [{ label: "musl libc", description: "no glibc" }],
+  inference: [{ label: "binary wheels fail", description: "compile from source" }],
+  constraints: [],
+  body: "# summary",
+  confidence: 0.75,
+  supersedes_world_ids: [],
+};
 
 function cfg(overrides: Partial<L3Config> = {}): L3Config {
   return {
@@ -237,6 +247,74 @@ describe("memory/l3/integration", () => {
     );
     expect(res.abstractions.every((a) => a.skippedReason === "llm_disabled")).toBe(true);
     expect(handle.repos.worldModel.list().length).toBe(0);
+    expect(handle.repos.kv.all().filter((row) => row.key.startsWith("l3.retry."))).toEqual([]);
+  });
+
+  it("backs off a failed abstraction, retries after expiry, and clears retry state", async () => {
+    seedTriplet();
+    let calls = 0;
+    const llm = fakeLlm({
+      completeJson: {
+        [OP]: () => {
+          calls++;
+          if (calls === 1) throw new Error("temporary failure");
+          return validDraft;
+        },
+      },
+    });
+    const deps = {
+      repos: {
+        policies: handle.repos.policies,
+        traces: handle.repos.traces,
+        worldModel: handle.repos.worldModel,
+        kv: handle.repos.kv,
+      },
+      llm,
+      log,
+      config: cfg(),
+    };
+
+    const failed = await runL3({ trigger: "manual", now: NOW }, deps);
+    expect(failed.abstractions[0]!.skippedReason).toBe("llm_failed");
+    expect(calls).toBe(1);
+    expect(handle.repos.kv.all().some((row) => row.key.startsWith("l3.retry."))).toBe(true);
+
+    const deferred = await runL3({ trigger: "manual", now: NOW + 299_999 }, deps);
+    expect(deferred.abstractions[0]!.skippedReason).toBe("retry_cooldown");
+    expect(calls).toBe(1);
+
+    const retried = await runL3({ trigger: "manual", now: NOW + 300_000 }, deps);
+    expect(retried.abstractions[0]!.skippedReason).toBeNull();
+    expect(calls).toBe(2);
+    expect(handle.repos.kv.all().filter((row) => row.key.startsWith("l3.retry."))).toEqual([]);
+  });
+
+  it("records retry state instead of success cooldown when persistence fails", async () => {
+    seedTriplet();
+    const worldModel = {
+      ...handle.repos.worldModel,
+      insert: () => {
+        throw new Error("disk full");
+      },
+    };
+    const result = await runL3(
+      { trigger: "manual", now: NOW },
+      {
+        repos: {
+          policies: handle.repos.policies,
+          traces: handle.repos.traces,
+          worldModel,
+          kv: handle.repos.kv,
+        },
+        llm: fakeLlm({ completeJson: { [OP]: validDraft } }),
+        log,
+        config: cfg({ cooldownDays: 1 }),
+      },
+    );
+
+    expect(result.warnings.some((warning) => warning.stage === "insert")).toBe(true);
+    expect(handle.repos.kv.all().some((row) => row.key.startsWith("l3.retry."))).toBe(true);
+    expect(handle.repos.kv.all().some((row) => row.key.startsWith("l3.lastRun."))).toBe(false);
   });
 
   it("adjustConfidence clamps in [0,1] and emits an event", async () => {
```

---

### Incident Patch 8: `dc61f2e1` (2026-09-16)
**Commit Message**: fix(plugin): bound L3 clusters and retry failures

**File**: `apps/memos-local-plugin/core/config/defaults.ts` (modified, +1/-0)
```diff
@@ -222,6 +222,7 @@ export const DEFAULT_CONFIG: ResolvedConfig = {
       // an early-life install can still cluster into a world model;
       // strict 0.6 starved L3 in real usage.
       clusterMinSimilarity: 0.3,
+      maxPoliciesPerCluster: 20,
       policyCharCap: 800,
       traceCharCap: 500,
       traceEvidencePerPolicy: 1,
```

**File**: `apps/memos-local-plugin/core/config/schema.ts` (modified, +2/-0)
```diff
@@ -326,6 +326,8 @@ const AlgorithmSchema = Type.Object({
      * are ignored (policies too disparate to share a world model).
      */
     clusterMinSimilarity: NumberInRange(0.6, 0, 1),
+    /** Maximum policies included in one L3 abstraction prompt. */
+    maxPoliciesPerCluster: NumberInRange(20, 1, 100),
     /** Chars of L2 body handed to `l3.abstraction`. */
     policyCharCap: NumberInRange(800, 200, 4_000),
     /** Chars of trace body handed per evidence trace. */
```

**File**: `apps/memos-local-plugin/core/memory/l3/cluster.ts` (modified, +14/-6)
```diff
@@ -27,7 +27,7 @@ export interface ClusterInput {
 }
 
 export interface ClusterDeps {
-  config: Pick<L3Config, "clusterMinSimilarity" | "minPolicies">;
+  config: Pick<L3Config, "clusterMinSimilarity" | "minPolicies" | "maxPoliciesPerCluster">;
 }
 
 // ─── Domain key extraction ─────────────────────────────────────────────────
@@ -173,25 +173,33 @@ export function clusterPolicies(
     // here is only "strict subset" vs "whole bucket".
     let cohort: PolicyWithMeta[];
     let admission: "strict" | "loose";
-    if (strict.length >= config.minPolicies) {
+    const requiredPolicies = key === "_|_"
+      ? Math.max(2, config.minPolicies)
+      : config.minPolicies;
+    if (strict.length >= requiredPolicies) {
       cohort = strict;
       admission = "strict";
-    } else if (members.length >= config.minPolicies) {
+    } else if (key !== "_|_" && members.length >= requiredPolicies) {
       cohort = members;
       admission = "loose";
     } else {
       continue;
     }
 
+    const capped = cohort
+      .slice()
+      .sort((a, b) => String(a.policy.id).localeCompare(String(b.policy.id)))
+      .slice(0, Math.max(1, config.maxPoliciesPerCluster ?? 20));
+    if (capped.length < requiredPolicies) continue;
     const tags = new Set<string>();
-    for (const m of cohort) for (const t of m.tags) tags.add(t);
+    for (const m of capped) for (const t of m.tags) tags.add(t);
 
     const avgGain =
-      cohort.reduce((s, m) => s + m.policy.gain, 0) / Math.max(1, cohort.length);
+      capped.reduce((s, m) => s + m.policy.gain, 0) / Math.max(1, capped.length);
 
     out.push({
       key,
-      policies: cohort.map((m) => m.policy),
+      policies: capped.map((m) => m.policy),
       domainTags: Array.from(tags),
       centroidVec: center,
       avgGain,
```

**File**: `apps/memos-local-plugin/core/memory/l3/l3.ts` (modified, +22/-0)
```diff
@@ -62,6 +62,8 @@ export interface RunL3Deps {
 }
 
 const KV_COOLDOWN_PREFIX = "l3.lastRun.";
+const KV_RETRY_PREFIX = "l3.retry.";
+const FAILURE_BACKOFF_MS = [5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 6 * 60 * 60_000];
 
 // ─── Public entry ──────────────────────────────────────────────────────────
 
@@ -102,6 +104,7 @@ export async function runL3(
         config: {
           clusterMinSimilarity: config.clusterMinSimilarity,
           minPolicies: config.minPolicies,
+          maxPoliciesPerCluster: config.maxPoliciesPerCluster ?? 20,
         },
       },
     );
@@ -150,6 +153,11 @@ export async function runL3(
       abstractions.push(skipped(cluster, "cooldown"));
       continue;
     }
+    const retry = repos.kv.get<{ nextRetryAt: number; failures: number } | null>(retryKey(cluster), null);
+    if (retry && retry.nextRetryAt > now) {
+      abstractions.push(skipped(cluster, "retry_cooldown"));
+      continue;
+    }
 
     const evidenceByPolicy = loadEvidence(cluster, repos, config.traceEvidencePerPolicy);
     const episodeIds = collectEpisodeIds(cluster.policies, evidenceByPolicy);
@@ -170,6 +178,7 @@ export async function runL3(
     timings.abstract += Date.now() - t0;
 
     if (!draftRes.ok) {
+      recordFailure(cluster, repos.kv, now);
       abstractions.push(skipped(cluster, draftRes.reason, { episodeIds, policyIds: cluster.policies.map((p) => p.id) }));
       emit(bus, {
         kind: "l3.failed",
@@ -314,6 +323,7 @@ export async function runL3(
     }
 
     markCooldown(cluster, repos.kv, now);
+    repos.kv.del(retryKey(cluster));
     timings.persist += Date.now() - t1;
   }
 
@@ -441,6 +451,18 @@ function cooldownKey(cluster: PolicyCluster): string {
   return `${KV_COOLDOWN_PREFIX}${primary}`;
 }
 
+function retryKey(cluster: PolicyCluster): string {
+  const members = cluster.policies.map((p) => String(p.id)).sort().join(",");
+  return `${KV_RETRY_PREFIX}${cluster.key}:${members}`;
+}
+
+function recordFailure(cluster: PolicyCluster, kv: Repos["kv"], now: number): void {
+  const previous = kv.get<{ nextRetryAt: number; failures: number } | null>(retryKey(cluster), null);
+  const failures = Math.min((previous?.failures ?? 0) + 1, FAILURE_BACKOFF_MS.length);
+  const delay = FAILURE_BACKOFF_MS[failures - 1] ?? FAILURE_BACKOFF_MS[FAILURE_BACKOFF_MS.length - 1]!;
+  kv.set(retryKey(cluster), { failures, nextRetryAt: now + delay });
+}
+
 function isInCooldown(
   cluster: PolicyCluster,
   kv: Repos["kv"],
```

**File**: `apps/memos-local-plugin/core/memory/l3/types.ts` (modified, +3/-0)
```diff
@@ -39,6 +39,8 @@ export interface L3Config {
   minPolicySupport: number;
   /** Cosine floor for two L2s to share a cluster. */
   clusterMinSimilarity: number;
+  /** Maximum policies admitted to one abstraction prompt. */
+  maxPoliciesPerCluster?: number;
   /** Char cap for each L2 body section handed to the prompt. */
   policyCharCap: number;
   /** Char cap for each L1 evidence trace handed to the prompt. */
@@ -152,6 +154,7 @@ export interface AbstractionResult {
     | "llm_failed"
     | "draft_invalid"
     | "cooldown"
+    | "retry_cooldown"
     | "no_centroid"
     | "duplicate_of";
   /** When `skippedReason === "duplicate_of"`, the existing WM id. */
```

**File**: `apps/memos-local-plugin/tests/unit/memory/l3/cluster.test.ts` (modified, +31/-0)
```diff
@@ -61,6 +61,23 @@ describe("memory/l3/cluster", () => {
       expect(tags).toEqual([]);
     });
 
+    it("does not create a cluster from an untagged bucket", () => {
+      const policies = [
+        [1, 0, 0],
+        [0, 1, 0],
+        [0, 0, 1],
+      ].map((v, n) => mkPolicy({
+        id: `po_u${n}` as PolicyId,
+        title: `中文策略 ${n}`,
+        vec: vec(v),
+      }));
+      const clusters = clusterPolicies(
+        { policies },
+        { config: { clusterMinSimilarity: 0.6, minPolicies: 1, maxPoliciesPerCluster: 20 } },
+      );
+      expect(clusters).toHaveLength(0);
+    });
+
     it("groups network-related text under 'network'", () => {
       const p = mkPolicy({
         id: "po_n" as PolicyId,
@@ -108,6 +125,20 @@ describe("memory/l3/cluster", () => {
       );
     });
 
+    it("caps loose clusters before they reach the prompt", () => {
+      const policies = [1, 2, 3].map((n) => mkPolicy({
+        id: `po_n${n}` as PolicyId,
+        title: `network retry ${n}`,
+        trigger: "proxy DNS failure",
+        vec: vec([1, 0, 0]),
+      }));
+      const clusters = clusterPolicies(
+        { policies },
+        { config: { clusterMinSimilarity: 0.99, minPolicies: 1, maxPoliciesPerCluster: 2 } },
+      );
+      expect(clusters[0]!.policies).toHaveLength(2);
+    });
+
     it("skips a bucket that doesn't meet minPolicies", () => {
       const policies = [
         mkPolicy({
```

---

### Incident Patch 9: `77c563cb` (2026-09-16)
**Commit Message**: fix(plugin): stop skill verification retry loops

**File**: `apps/memos-local-plugin/core/llm/client.ts` (modified, +26/-12)
```diff
@@ -356,37 +356,33 @@ export function createLlmClientWithProvider(
             notifyError: true,
           });
         } catch (hostErr) {
+          const normalizedHostErr = normalizeError(hostErr, ERROR_CODES.LLM_UNAVAILABLE, "host fallback failed");
           failures++;
-          const failAt = markFail(hostErr);
+          const failAt = markFail(normalizedHostErr);
           facadeLog.error("host.fallback_failed", {
             primary: summarizeErr(err),
-            host: summarizeErr(hostErr),
+            host: summarizeErr(normalizedHostErr),
           });
           // Primary AND host bridge both failed. Trip on a terminal
           // primary error (the one the operator typically needs to fix
           // — host bridge failures are usually transient stdio issues).
           if (breakerIsTerminal(err)) breakerTrip(err);
-          notifyOnError(hostErr);
+          notifyOnError(normalizedHostErr);
           notifyStatus({
             status: "error",
             provider: provider.name,
             model: config.model,
-            message: summarizeErrMessage(hostErr),
-            code: hostErr instanceof MemosError ? hostErr.code : undefined,
-            ...extractRetryDiagnostics(hostErr instanceof MemosError ? hostErr.details : undefined),
+            message: summarizeErrMessage(normalizedHostErr),
+            code: normalizedHostErr.code,
+            ...extractRetryDiagnostics(normalizedHostErr.details),
             at: failAt,
             durationMs: Date.now() - startedAt,
             fallbackProvider: "host",
             op,
             episodeId: opts?.episodeId,
             phase: opts?.phase,
           });
-          throw hostErr instanceof MemosError
-            ? hostErr
-            : new MemosError(
-                ERROR_CODES.LLM_UNAVAILABLE,
-                `host fallback failed: ${(hostErr as Error).message ?? String(hostErr)}`,
-              );
+          throw normalizedHostErr;
         }
       }
       failures++;
@@ -841,3 +837,21 @@ function summarizeErrMessage(e: unknown): string {
   if (e instanceof Error) return e.message;
   return String(e);
 }
+
+function normalizeError(
+  err: unknown,
+  fallbackCode: (typeof ERROR_CODES)[keyof typeof ERROR_CODES],
+  prefix: string,
+): MemosError {
+  if (err instanceof MemosError) return err;
+  if (err instanceof Error) return new MemosError(fallbackCode, `${prefix}: ${err.message}`);
+  if (typeof err === "object" && err !== null) {
+    const record = err as { code?: unknown; message?: unknown; data?: unknown };
+    const code = typeof record.code === "string" ? record.code : fallbackCode;
+    const message = typeof record.message === "string" ? record.message : String(record.data ?? err);
+    return new MemosError(code as (typeof ERROR_CODES)[keyof typeof ERROR_CODES], `${prefix}: ${message}`, {
+      bridgeError: err as Record<string, unknown>,
+    });
+  }
+  return new MemosError(fallbackCode, `${prefix}: ${String(err)}`);
+}
```

**File**: `apps/memos-local-plugin/core/skill/skill.ts` (modified, +1/-0)
```diff
@@ -174,6 +174,7 @@ export async function runSkill(
         kind: "skill.verification.failed",
         at: nowMs(),
         skillId: "sk_placeholder" as SkillId,
+        policyId: decision.policy.id,
         reason: verdict.reason ?? "verify-failed",
       });
       continue;
```

**File**: `apps/memos-local-plugin/core/skill/subscriber.ts` (modified, +16/-1)
```diff
@@ -79,6 +79,7 @@ export function attachSkillSubscriber(
   };
 
   let inflight: Promise<void> | null = null;
+  let lastRewardRunAt: number | null = null;
   let queued: { trigger: SkillTrigger; hint?: { policyId?: string; skillId?: SkillId } } | null =
     null;
 
@@ -115,6 +116,20 @@ export function attachSkillSubscriber(
     inflight = promise;
   }
 
+  function triggerRewardRun(): void {
+    const cooldownMs = Math.max(0, deps.config.cooldownMs);
+    const at = nowMs();
+    if (cooldownMs > 0 && lastRewardRunAt !== null && at - lastRewardRunAt < cooldownMs) {
+      log.debug("skill.run.cooldown", {
+        trigger: "reward.updated",
+        remainingMs: cooldownMs - (at - lastRewardRunAt),
+      });
+      return;
+    }
+    lastRewardRunAt = at;
+    triggerRun("reward.updated");
+  }
+
   const offInduced = deps.l2Bus.on("l2.policy.induced", (evt: L2Event) => {
     if (evt.kind !== "l2.policy.induced") return;
     log.debug("trigger.l2.policy.induced", { policyId: evt.policyId });
@@ -134,7 +149,7 @@ export function attachSkillSubscriber(
       episodeId: evt.result.episodeId,
     });
     resolveTrialsForReward(evt);
-    triggerRun("reward.updated");
+    triggerRewardRun();
   });
 
   function dispose(): void {
```

**File**: `apps/memos-local-plugin/core/skill/tool-names.ts` (modified, +14/-1)
```diff
@@ -21,7 +21,20 @@ export function extractToolNames(traces: readonly TraceRow[]): Set<string> {
       if (name && !IGNORED_NAMES.has(name)) out.add(name);
 
       if (typeof tc.input === "string") {
-        const first = tc.input.trim().split(/\s+/)[0]?.toLowerCase();
+        const raw = tc.input.trim();
+        // JSON tool arguments are payload, not shell commands.  Taking the
+        // first whitespace token from them produces entries such as `{"code":`
+        // and poisons the EVIDENCE_TOOLS whitelist.
+        let parsed: unknown;
+        try {
+          parsed = JSON.parse(raw);
+        } catch {
+          parsed = undefined;
+        }
+        if (parsed !== undefined) {
+          continue;
+        }
+        const first = raw.split(/\s+/)[0]?.toLowerCase();
         if (first && first.length >= 2) out.add(first);
       }
     }
```

**File**: `apps/memos-local-plugin/core/skill/types.ts` (modified, +1/-0)
```diff
@@ -214,6 +214,7 @@ export interface SkillVerificationPassedEvent
 export interface SkillVerificationFailedEvent
   extends SkillEventBase<"skill.verification.failed"> {
   skillId: SkillId;
+  policyId: string;
   reason: string;
 }
 
```

**File**: `apps/memos-local-plugin/tests/unit/skill/events.test.ts` (modified, +14/-0)
```diff
@@ -48,4 +48,18 @@ describe("skill/events", () => {
     });
     expect(called).toEqual(["second"]);
   });
+
+  it("preserves the policy that produced a verification failure", () => {
+    const bus = createSkillEventBus();
+    const seen: SkillEvent[] = [];
+    bus.on("skill.verification.failed", (event) => seen.push(event));
+    bus.emit({
+      kind: "skill.verification.failed",
+      at: 1,
+      skillId: "sk_1" as SkillId,
+      policyId: "po_1",
+      reason: "resonance=0.00<0.5",
+    });
+    expect(seen[0]).toMatchObject({ policyId: "po_1" });
+  });
 });
```

**File**: `apps/memos-local-plugin/tests/unit/skill/verifier.test.ts` (modified, +16/-0)
```diff
@@ -119,6 +119,22 @@ describe("skill/verifier", () => {
     expect(r.coverage).toBe(1);
   });
 
+  it("does not treat JSON string arguments as command names", () => {
+    const draft = makeDraft({
+      summary: "Execute code safely",
+      tools: ["execute_code"],
+      steps: [{ title: "execute", body: "execute the supplied code" }],
+    });
+    const evidence = [
+      trace("tr_json", "run code", "execution completed", [
+        { name: "execute_code", input: '{"code": "print(1)"}' },
+      ]),
+    ];
+    const r = verifyDraft({ draft, evidence }, { log });
+    expect(r.coverage).toBe(1);
+    expect(r.unmappedTokens).toEqual([]);
+  });
+
   it("partial coverage below threshold fails", () => {
     const draft = makeDraft({
       summary: "Use several tools",
```

---

### Incident Patch 10: `5dc57736` (2026-09-16)
**Commit Message**: merge: bring fix-20260902-local-plugin into fix-20260916-local-plugin

**File**: `apps/memos-local-plugin/core/llm/client.ts` (modified, +1/-0)
```diff
@@ -282,6 +282,7 @@ export function createLlmClientWithProvider(
       maxTokens: opts?.maxTokens ?? config.maxTokens ?? DEFAULT_MAX_TOKENS,
       jsonMode,
       stop: opts?.stop,
+      op: opts?.op,
     };
   }
 
```

**File**: `apps/memos-local-plugin/core/llm/types.ts` (modified, +8/-0)
```diff
@@ -257,6 +257,14 @@ export interface ProviderCallInput {
   maxTokens: number;
   jsonMode: boolean;
   stop?: string[];
+  /**
+   * Logical call site (e.g. `capture.summarize`, `retrieval.filter`,
+   * `skill.evolve`). Forwarded from `LlmCallOptions.op` so providers
+   * can apply per-op behavior (request-body tweaks, routing overrides,
+   * reasoning kill-switches, per-op budget caps). Optional — providers
+   * must not assume it is set.
+   */
+  op?: string;
 }
 
 /** What providers return — pre-facade post-processing. */
```

**File**: `apps/memos-local-plugin/tests/unit/llm/client.test.ts` (modified, +61/-1)
```diff
@@ -58,11 +58,17 @@ class FakeProvider implements LlmProvider {
 
 class StreamingProvider implements LlmProvider {
   readonly name: LlmProviderName = "openai_compatible";
+  public lastInput: ProviderCallInput | null = null;
+
   async complete(): Promise<ProviderCompletion> {
     return { text: "full", durationMs: 1 };
   }
   // eslint-disable-next-line require-yield
-  async *stream(): AsyncGenerator<LlmStreamChunk> {
+  async *stream(
+    _messages: LlmMessage[],
+    opts: ProviderCallInput,
+  ): AsyncGenerator<LlmStreamChunk> {
+    this.lastInput = opts;
     yield { delta: "he", done: false };
     yield { delta: "llo", done: false };
     yield {
@@ -335,6 +341,60 @@ describe("llm/client", () => {
     );
   });
 
+  // ─── op propagation to providers (issue #2308) ────────────────────────
+  //
+  // The facade must forward `opts.op` onto the `ProviderCallInput` handed to
+  // `provider.complete()` / `provider.stream()` so per-op provider behavior
+  // (e.g. request-body tweaks, routing overrides, reasoning kill-switches
+  // keyed on `capture.summarize`) can fire. Dropping it silently makes
+  // those switches unreachable.
+  describe("op propagation (issue #2308)", () => {
+    it("complete forwards opts.op onto the provider input", async () => {
+      const fake = new FakeProvider("openai_compatible", () => ({ text: "ok", durationMs: 1 }));
+      const client = createLlmClientWithProvider(cfg(), fake);
+      await client.complete("hi", { op: "capture.summarize" });
+      expect(fake.lastInput?.op).toBe("capture.summarize");
+    });
+
+    it("completeJson forwards opts.op onto the provider input", async () => {
+      const fake = new FakeProvider("openai_compatible", () => ({
+        text: '{"a":1}',
+        durationMs: 1,
+      }));
+      const client = createLlmClientWithProvider(cfg(), fake);
+      await client.completeJson<{ a: number }>("score", { op: "retrieval.filter" });
+      expect(fake.lastInput?.op).toBe("retrieval.filter");
+    });
+
+    it("stream forwards opts.op onto the provider input (non-streaming provider)", async () => {
+      // FakeProvider has no stream(); the facade wraps complete() in a
+      // single-chunk iterable, which still exercises buildCallInput.
+      const fake = new FakeProvider("openai_compatible", () => ({ text: "one", durationMs: 1 }));
+      const client = createLlmClientWithProvider(cfg(), fake);
+      const parts: string[] = [];
+      for await (const c of client.stream("x", { op: "skill.evolve" })) {
+        if (!c.done) parts.push(c.delta);
+      }
+      expect(fake.lastInput?.op).toBe("skill.evolve");
+    });
+
+    it("stream forwards opts.op onto a native streaming provider", async () => {
+      const provider = new StreamingProvider();
+      const client = createLlmClientWithProvider(cfg(), provider);
+      for await (const _chunk of client.stream("x", { op: "capture.summarize" })) {
+        // Consume the stream so the provider receives the cooked input.
+      }
+      expect(provider.lastInput?.op).toBe("capture.summarize");
+    });
+
+    it("leaves op undefined when the caller supplies no op", async () => {
+      const fake = new FakeProvider("openai_compatible", () => ({ text: "ok", durationMs: 1 }));
+      const client = createLlmClientWithProvider(cfg(), fake);
+      await client.complete("hi");
+      expect(fake.lastInput?.op).toBeUndefined();
+    });
+  });
+
   // ─── Circuit breaker (issue #1897) ──────────────────────────────────────
   describe("circuit breaker", () => {
     function statusSink(): { rows: LlmStatusDetail[]; push: (d: LlmStatusDetail) => void } {
```

---

### Incident Patch 11: `de806942` (2026-09-08)
**Commit Message**: fix: restore OpenClaw installation and automatic memory hooks (#2350)

## Description

OpenClaw 2026.9.1/2026.9.2 reject the shell installer’s legacy
`plugins.installs` records. Rebuilding a plugin registry in the gateway
process can also trigger MemOS’s duplicate-runtime guard, leaving
conversation hooks unavailable even though the Viewer and tools work.

This change removes only MemOS-owned legacy install records, detects
supported stop/validation/capability-consent commands in both
installers, and requires actual gateway health for the shell restart
fallback. Plugin CLI help is probed with plugins disabled.

The adapter shares one runtime across full registries and module reloads
while registering hooks in each host registry. Tool discovery borrows
the existing core without owning a server or service. Cross-process
locking remains in place. No dependency or package-version changes.

Related issue: #1873 (runtime-ownership context; this PR addresses
same-process registry rebuilding, not that already-closed doctor issue).

## Type of change

- [x] Bug fix
- [x] Documentation update

## How Has This Been Tested?

- [x] `npm test`: **184 files passed; 1569 passed, 3 skipped**. Added

**File**: `apps/memos-local-plugin/README.md` (modified, +22/-0)
```diff
@@ -120,6 +120,28 @@ npm pack
 bash install.sh --version ./memtensor-memos-local-plugin-1.0.0-beta.1.tgz
 ```
 
+For OpenClaw, use the installer for local archives too:
+
+```bash
+bash install.sh --agent openclaw --version ./memtensor-memos-local-plugin-2.0.16-beta.1.tgz
+```
+
+Do not substitute `openclaw plugins install ./package.tgz` for this command:
+that raw-archive path can resolve development-only DeepSeek peer dependencies
+and fail with `ERESOLVE`, including on OpenClaw 2026.9.1 and 2026.9.2.
+The installer stages production dependencies and rebuilds `better-sqlite3`.
+OpenClaw's newer `npm-pack:` path avoids the peer-resolution conflict, but a
+successful managed install alone does not verify native bindings or initialize
+MemOS runtime configuration; the installer above remains the supported setup.
+
+When upgrading OpenClaw itself, migrate retired host configuration with
+`openclaw doctor --fix` before installing MemOS. The MemOS installer removes its
+own legacy `plugins.installs` records, preserves other plugins' old-host records,
+and uses the host CLI for capability consent when available. It does not rewrite
+the host's internal installation database. See
+[the compatibility test results](docs/OPENCLAW-COMPATIBILITY.md) for tested versions
+and limits.
+
 On Windows, run `install.ps1` from PowerShell instead of `install.sh` for
 OpenClaw or Hermes. The DSH one-command target currently supports macOS/Linux;
 Windows users can use DSH's lower-level `dsh plugin` flow.
```

**File**: `apps/memos-local-plugin/adapters/openclaw/index.ts` (modified, +104/-55)
```diff
@@ -310,36 +310,12 @@ function isDiagnosticMode(): boolean {
   return false;
 }
 
-function register(api: OpenClawPluginApi): void {
-  const diagnosticMode = isDiagnosticMode();
-
-  let runtimeLock: OpenClawRuntimeLockHandle;
-  try {
-    runtimeLock = acquireOpenClawRuntimeLock({
-      home: resolveHome("openclaw"),
-      pluginId: PLUGIN_ID,
-      version: PLUGIN_VERSION,
-      viewerPort: OPENCLAW_VIEWER_PORT,
-      skipLock: diagnosticMode,
-    });
-
-    if (diagnosticMode) {
-      api.logger.info("memos-local: running in diagnostic mode (lock acquisition skipped)");
-    }
-  } catch (err) {
-    const duplicate = err instanceof DuplicateOpenClawRuntimeError;
-    api.logger.error("memos-local: duplicate OpenClaw runtime blocked", {
-      err: err instanceof Error ? err.message : String(err),
-      code: duplicate ? err.code : (err as { code?: unknown }).code,
-    });
-    throw err;
-  }
-
-  // OpenClaw publishes its clean, command-facing inbound body before
-  // prompt construction. Keep this store independent of core bootstrap
-  // so early messages are not lost while SQLite/providers initialize.
-  const inboundUserText = createOpenClawInboundTextStore();
-
+function registerRuntimeBindings(
+  api: OpenClawPluginApi,
+  ensureRuntime: () => Promise<PluginRuntime | null>,
+  inboundUserText: ReturnType<typeof createOpenClawInboundTextStore>,
+  currentRuntime: () => PluginRuntime | null,
+): void {
   // 1. Memory capability (prompt prelude) — register synchronously so the
   //    host immediately knows who owns the memory slot, even if bootstrap
   //    fails later.
@@ -392,31 +368,6 @@ function register(api: OpenClawPluginApi): void {
     },
   });
 
-  // 2. Kick off core bootstrap. OpenClaw only accepts tool / hook
-  //    registration during the synchronous `register(api)` window, so
-  //    tools register a shell now and wait for runtime inside execute().
-  let runtime: PluginRuntime | null = null;
-  let bootstrapError: Error | null = null;
-  const bootstrapPromise = createRuntime(api, runtimeLock, inboundUserText)
-    .then((r) => {
-      runtime = r;
-      api.logger.info("memos-local: plugin ready");
-    })
-    .catch((err) => {
-      bootstrapError = err instanceof Error ? err : new Error(String(err));
-      const duplicate = err instanceof DuplicateOpenClawRuntimeError;
-      api.logger.error("memos-local: bootstrap failed", {
-        err: bootstrapError.message,
-        code: duplicate ? err.code : (err as { code?: unknown }).code,
-      });
-    });
-
-  const ensureRuntime = async (): Promise<PluginRuntime | null> => {
-    if (runtime) return runtime;
-    await bootstrapPromise;
-    return runtime;
-  };
-
   /**
    * Helper for **void / fire-and-forget** hooks: dispatch `fn` against the
    * runtime as soon as bootstrap finishes (already finished → next tick).
@@ -520,6 +471,7 @@ function register(api: OpenClawPluginApi): void {
   // already sync, so we can invoke it directly when the runtime is
   // ready and return undefined otherwise.
   api.on("tool_result_persist", (event, ctx) => {
+    const runtime = currentRuntime();
     if (!runtime) return; // bootstrap not finished — nothing to inject
     return runtime.bridge.handleToolResultPersist(event, ctx);
   });
@@ -542,6 +494,101 @@ function register(api: OpenClawPluginApi): void {
     void runWhenReady((r) => r.bridge.handleSubagentEnded(event, ctx), "subagent_ended");
   });
 
+}
+
+// OpenClaw may build a separate tool registry in the same process. That
+// registry borrows the full registration's core and never owns its lifecycle.
+interface SharedRuntime {
+  ensureRuntime: () => Promise<PluginRuntime | null>;
+  registerBindings: (api: OpenClawPluginApi) => void;
+}
+// Host registries can reload the module. Keep ownership process-wide while
+// retaining the filesystem lock against genuinely separate gateway processes.
+const runtimeKey = Symbol.for("memos.openclaw.activeRuntimes.v1");
+const processState = globalThis as typeof globalThis & {
+  [runtimeKey]?: Map<string, SharedRuntime>;
+};
+const activeRuntimes = processState[runtimeKey] ??= new Map<string, SharedRuntime>();
+
+function register(api: OpenClawPluginApi): void {
+  const home = resolveHome("openclaw");
+  if (api.registrationMode === "tool-discovery") {
+    registerOpenClawTools(api, {
+      agent: "openclaw",
+      getCore: async () => (await activeRuntimes.get(home.root)?.ensureRuntime())?.core ?? null,
+      log: api.logger,
+    });
+    return;
+  }
+  const existing = activeRuntimes.get(home.root);
+  if (existing) {
+    existing.registerBindings(api);
+    api.logger.info("memos-local: reused active runtime for host registry");
+    return;
+  }
+  const diagnosticMode = isDiagnosticMode();
+
+  let runtimeLock: OpenClawRuntimeLockHandle;
+  try {
+    runtimeLock = acquireOpenClawRuntimeLock({
+      home,
+      pluginId: PLUGIN_ID,
+      version: PLUGIN_VERSION,
+      viewerPort: OPENCLAW_VIEW
```

**File**: `apps/memos-local-plugin/adapters/openclaw/openclaw-api.ts` (modified, +2/-0)
```diff
@@ -330,6 +330,8 @@ export interface ServiceDescriptor {
 // ─── The façade we register against ───────────────────────────────────────
 
 export interface OpenClawPluginApi {
+  /** Older hosts omit this; tool discovery must not start a second runtime. */
+  registrationMode?: "full" | "discovery" | "tool-discovery" | "setup-only" | "setup-runtime" | "cli-metadata";
   /** Plugin id + metadata the host injected. */
   id: string;
   name: string;
```

**File**: `apps/memos-local-plugin/docs/OPENCLAW-COMPATIBILITY.md` (added, +133/-0)
```diff
@@ -0,0 +1,133 @@
+# OpenClaw installation and automatic-memory compatibility
+
+Verified on 2026-09-08 against `main` commit `78a372a4`, using MemOS Local
+2.0.16-beta.1. The npm `latest` tag resolved to OpenClaw **2026.9.2**.
+
+## Changes
+
+- The shell installer no longer writes MemOS records into `plugins.installs`,
+  which 2026.9.1/2026.9.2 reject. It removes only MemOS-owned legacy records;
+  unrelated older records are preserved. Modern installation indexes remain
+  managed by OpenClaw.
+- Both installers detect noninteractive `gateway stop --force` support, validate
+  configuration, and accept capabilities through the host CLI when supported.
+  The shell installer additionally detects launchd `--disable`. Plugin help is
+  probed with plugins disabled to avoid bootstrapping a runtime from old CLIs.
+  The shell restart fallback now requires successful gateway health, rather
+  than treating any process listening on the gateway port as healthy.
+- Multiple full plugin registries in one process share one MemOS runtime, even
+  when the module is reloaded. Each registry gets conversation hooks and tools;
+  only the original service owns startup/shutdown. `tool-discovery` gets tool
+  factories without starting another runtime or registering conversation hooks.
+  The filesystem lock still prevents separate processes owning the same data.
+
+Automatic recall runs through `before_prompt_build` and logs
+`memos.onTurnStart`; capture runs through `agent_end` and logs
+`memos.agent_end.received` followed by `memos.onTurnEnd`. These are automatic
+hooks, not tool calls named `memory_search` or `memory_add`.
+
+## Verified behavior
+
+macOS tests used Node 22.23.1/npm 10.9.8; Windows x64 tests used Node 24.19.0,
+npm 11.17.0 and PowerShell 5.1.26100.8875. Separate host versions used isolated
+configurations, workspaces and databases. Gateways ran sequentially because
+MemOS uses port 18799. Normal services were restored and verified afterward.
+
+| Platform / OpenClaw | Config, startup, tool invocation | Automatic capture and cross-session recall |
+| --- | --- | --- |
+| macOS 2026.4.24 | Pass | Gateway path passes with client-only workaround; standard agent CLI fails (see below) |
+| macOS 2026.7.1-2 | Pass | Pass without workaround |
+| macOS 2026.9.1 | Pass | Pass |
+| macOS 2026.9.2 | Pass | Not independently exercised on macOS |
+| Windows 2026.4.24 | Config passes; gateway readiness times out | Not reached |
+| Windows 2026.7.1-2 | Pass | Pass without workaround |
+| Windows 2026.9.2 | Pass | Pass |
+
+The full shell installer completed on macOS 2026.9.1. The full patched
+PowerShell installer completed on Windows 2026.9.2; the previous PowerShell
+installer failed because stopping the gateway required `--force`.
+
+For older-host conversation tests, a local OpenAI-compatible model fixture
+returned fixed text without tools. Two different session IDs were used. The
+second prompt omitted the first session's unique test code; verification checked
+that the code appeared in the second model request. Successful runs produced:
+
+```text
+model_requests: 2
+traces: 2
+distinct_trace_sessions: 2
+cross_session_memory_in_model_prompt: true
+turn_start_count: 2
+turn_end_count: 2
+bootstrap_count: 1
+tool_ok: true
+duplicate_runtime_error: false
+```
+
+macOS 2026.9.1 and Windows 2026.9.2 also completed synthetic conversations with
+their configured models. SQLite contained the test traces; subsequent recall
+logged `hits=1` and `injected=yes` without requiring model tool calls.
+
+## Known limits
+
+- **2026.4.24 macOS agent CLI:** the CLI preloads a full plugin registry in a
+  separate process (`ensureCliPluginRegistryLoaded`). With the gateway running,
+  this triggers `DuplicateOpenClawRuntimeError` before sending the turn. A
+  diagnostic client configuration with plugins disabled let the unchanged
+  gateway complete capture/recall, but the standard CLI remains incompatible.
+- **2026.4.24 Windows startup:** the initial health RPC timed out after 10 seconds.
+  A fresh isolated retry exhausted 120 readiness attempts (about four minutes).
+  Sampling showed synchronous filesystem work in OpenClaw's
+  `prepareBundledPluginRuntimeDistMirror` / `writeRuntimeModuleWrapper`. Neither
+  attempt reached a conversation. This does not establish hook compatibility.
+- **Raw archive installation:** on 2026.9.1 and 2026.9.2,
+  `openclaw plugins install ./package.tgz --force` failed with npm `ERESOLVE`:
+  DSH development dependencies at rc.6 conflict with a transitive rc.8 peer.
+  `npm-pack:./package.tgz` installation succeeded but did not build native
+  SQLite. Use the MemOS installer, which installs production dependencies and
+  rebuilds native modules. This patch does not repair every host installation
+  path or change DSH dependencies.
+- Windows host upgrades can separately require migration of retired OpenClaw
+  configuration and Scheduled Task ownership repair. The plugin installer does
+  not 
```

**File**: `apps/memos-local-plugin/install.ps1` (modified, +46/-1)
```diff
@@ -59,7 +59,12 @@ function Invoke-OpenClawGatewayChecked {
     $PreviousErrorActionPreference = $ErrorActionPreference
     $ErrorActionPreference = "Continue"
     try {
-        $GatewayOutput = @(& cmd.exe /d /c "openclaw gateway $Action" 2>&1)
+        $GatewayCommand = "openclaw gateway $Action"
+        if ($Action -eq "stop") {
+            $StopHelp = @(& cmd.exe /d /c "openclaw gateway stop --help" 2>&1) | Out-String
+            if ($StopHelp -match '--force') { $GatewayCommand += " --force" }
+        }
+        $GatewayOutput = @(& cmd.exe /d /c $GatewayCommand 2>&1)
         $ExitCode = $LASTEXITCODE
     } finally {
         $ErrorActionPreference = $PreviousErrorActionPreference
@@ -72,6 +77,45 @@ function Invoke-OpenClawGatewayChecked {
     }
 }
 
+function Enable-OpenClawMemoryPlugin {
+    # Host state formats change independently of the plugin. Let the host own
+    # validation and capability consent; do not edit its SQLite install index.
+    $PreviousErrorActionPreference = $ErrorActionPreference
+    $PreviousStateDir = $env:OPENCLAW_STATE_DIR
+    $PreviousConfigPath = $env:OPENCLAW_CONFIG_PATH
+    $ProbeDir = Join-Path $env:TEMP ("memos-openclaw-help-" + [guid]::NewGuid().ToString("N"))
+    $ErrorActionPreference = "Continue"
+    try {
+        $ConfigHelp = @(& cmd.exe /d /c "openclaw config --help" 2>&1) | Out-String
+        if ($ConfigHelp -match 'validate') {
+            $Output = @(& cmd.exe /d /c "openclaw config validate" 2>&1)
+            $ExitCode = $LASTEXITCODE
+            $Output | ForEach-Object { Write-Host "$_" }
+            if ($ExitCode -ne 0) { throw "OpenClaw config validation failed; run openclaw doctor --fix and retry." }
+        }
+        # Older plugin CLI help can load configured plugins. Probe with plugins
+        # disabled, then restore the real host paths before accepting consent.
+        New-Item -ItemType Directory -Path $ProbeDir -ErrorAction Stop | Out-Null
+        Set-Content -Path (Join-Path $ProbeDir "openclaw.json") -Value '{"plugins":{"enabled":false}}' -Encoding ASCII -ErrorAction Stop
+        $env:OPENCLAW_STATE_DIR = $ProbeDir
+        $env:OPENCLAW_CONFIG_PATH = Join-Path $ProbeDir "openclaw.json"
+        $EnableHelp = @(& cmd.exe /d /c "openclaw plugins enable --help" 2>&1) | Out-String
+        $env:OPENCLAW_STATE_DIR = $PreviousStateDir
+        $env:OPENCLAW_CONFIG_PATH = $PreviousConfigPath
+        if ($EnableHelp -match '--accept-capabilities') {
+            $Output = @(& cmd.exe /d /c "openclaw plugins enable memos-local-plugin --accept-capabilities" 2>&1)
+            $ExitCode = $LASTEXITCODE
+            $Output | ForEach-Object { Write-Host "$_" }
+            if ($ExitCode -ne 0) { throw "OpenClaw could not enable the MemOS plugin (exit code $ExitCode)." }
+        }
+    } finally {
+        $env:OPENCLAW_STATE_DIR = $PreviousStateDir
+        $env:OPENCLAW_CONFIG_PATH = $PreviousConfigPath
+        $ErrorActionPreference = $PreviousErrorActionPreference
+        if (Test-Path $ProbeDir) { Remove-Item -Recurse -Force $ProbeDir -ErrorAction SilentlyContinue }
+    }
+}
+
 function Test-BetterSqlite3 {
     param([string]$NodeBin, [string]$Prefix)
     $SmokeScript = "const Database=require('better-sqlite3');const db=new Database(':memory:');db.exec('SELECT 1');db.close();"
@@ -662,6 +706,7 @@ fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
         Write-Success "openclaw.json patched"
 
         if ($OcBin) {
+            Enable-OpenClawMemoryPlugin
             Write-Info "Starting OpenClaw gateway"
             try {
                 Invoke-OpenClawGatewayChecked -Action "start"
```

**File**: `apps/memos-local-plugin/install.sh` (modified, +47/-24)
```diff
@@ -501,7 +501,14 @@ install_openclaw() {
   GATEWAY_RECOVERY_STATE="inactive"
   if oc_bin="$(find_openclaw_cli)"; then
     step "Stopping OpenClaw gateway"
-    "${oc_bin}" gateway stop >/dev/null 2>&1 || true
+    local stop_help
+    local -a stop_args=(gateway stop)
+    stop_help="$("${oc_bin}" gateway stop --help 2>/dev/null || true)"
+    # New hosts require an explicit non-interactive stop; suppress launchd
+    # respawn during the package swap when the host supports it.
+    if grep -q -- '--force' <<< "${stop_help}"; then stop_args+=(--force); fi
+    if grep -q -- '--disable' <<< "${stop_help}"; then stop_args+=(--disable); fi
+    "${oc_bin}" "${stop_args[@]}" >/dev/null 2>&1 || true
     sleep 1
     success "Gateway stopped"
     GATEWAY_RECOVERY_BIN="${oc_bin}"
@@ -556,18 +563,12 @@ EOF
 
   step "Patching ${config_path}"
   PLUGIN_ID="${PLUGIN_ID}" \
-  INSTALL_PATH="${prefix}" \
-  SOURCE_KIND="${SOURCE_KIND}" \
-  SOURCE_SPEC="${SOURCE_SPEC}" \
-  PLUGIN_VERSION="${plugin_version}" \
   LEGACY_JSON="$(printf '%s,' "${LEGACY_PLUGIN_IDS[@]}")" \
   CONFIG_PATH="${config_path}" \
   node - <<'NODE'
 const fs = require('fs');
 const {
-  CONFIG_PATH: configPath, PLUGIN_ID: pluginId, INSTALL_PATH: installPath,
-  SOURCE_KIND: sourceKind, SOURCE_SPEC: sourceSpec,
-  PLUGIN_VERSION: pluginVersion, LEGACY_JSON: legacyCsv,
+  CONFIG_PATH: configPath, PLUGIN_ID: pluginId, LEGACY_JSON: legacyCsv,
 } = process.env;
 const legacyIds = (legacyCsv || '').split(',').filter(Boolean);
 const MEMOS_TOOL_NAMES = [
@@ -615,7 +616,6 @@ if (!config.plugins.allow.includes(pluginId)) config.plugins.allow.push(pluginId
 // can delete it themselves if desired.
 for (const legacyId of legacyIds) {
   if (config.plugins.entries?.[legacyId]) delete config.plugins.entries[legacyId];
-  if (config.plugins.installs?.[legacyId]) delete config.plugins.installs[legacyId];
   if (Array.isArray(config.plugins.allow)) {
     config.plugins.allow = config.plugins.allow.filter((x) => x !== legacyId);
   }
@@ -646,20 +646,24 @@ if (
 }
 config.plugins.entries[pluginId].hooks.allowConversationAccess = true;
 
-if (!config.plugins.installs || typeof config.plugins.installs !== 'object') config.plugins.installs = {};
-const installsEntry = {
-  source: sourceKind === 'path' ? 'path' : 'npm',
-  installPath,
-  version: pluginVersion,
-  resolvedVersion: pluginVersion,
-  installedAt: new Date().toISOString(),
-};
-if (sourceKind !== 'path') {
-  installsEntry.spec = sourceSpec;
-  installsEntry.resolvedName = '@memtensor/memos-local-plugin';
-  installsEntry.resolvedSpec = sourceSpec;
+// Older OpenClaw releases allow `plugins.installs`; current hosts keep that
+// metadata in machine-managed state instead. The extension already lives
+// in OpenClaw's standard discovery directory, so neither generation requires a
+// hand-written MemOS install record. Remove only records owned by this installer
+// so older OpenClaw releases retain metadata for unrelated plugins.
+if (
+  config.plugins.installs &&
+  typeof config.plugins.installs === 'object' &&
+  !Array.isArray(config.plugins.installs)
+) {
+  delete config.plugins.installs[pluginId];
+  for (const legacyId of legacyIds) delete config.plugins.installs[legacyId];
+  if (Object.keys(config.plugins.installs).length === 0) delete config.plugins.installs;
+} else if (Object.prototype.hasOwnProperty.call(config.plugins, 'installs')) {
+  // A malformed legacy value is invalid on old hosts and cannot carry records
+  // worth preserving.
+  delete config.plugins.installs;
 }
-config.plugins.installs[pluginId] = installsEntry;
 
 fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
 NODE
@@ -669,15 +673,34 @@ NODE
     warn "openclaw CLI not on PATH — restart manually: openclaw gateway start"
     return 1
   fi
+  # Validate before accepting an already-running process: an old process may
+  # still answer while the newly written configuration is invalid.
+  if "${oc_bin}" config --help 2>/dev/null | grep -q 'validate'; then
+    "${oc_bin}" config validate || die "OpenClaw config validation failed; run openclaw doctor --fix and retry."
+  fi
+  # Recent hosts persist capability consent outside openclaw.json. Let their
+  # CLI own that state; older hosts do not expose this flag.
+  # Some older CLIs load configured plugins even for subcommand help. Probe
+  # against an empty, disabled plugin configuration to avoid starting a runtime.
+  local probe_dir enable_help
+  probe_dir="$(mktemp -d)"
+  printf '%s\n' '{"plugins":{"enabled":false}}' > "${probe_dir}/openclaw.json"
+  enable_help="$(OPENCLAW_STATE_DIR="${probe_dir}" OPENCLAW_CONFIG_PATH="${probe_dir}/openclaw.json" \
+    "${oc_bin}" plugins enable --help 2>/dev/null || true)"
+  rm -rf -- "${probe_dir}"
+  if grep -q -- '--accept-capabilities' <<< "${enable_help}"; then
+    step "Enabling MemOS memory tools and conversation hooks"
+    "${oc_bin}" plugins enable "${PLUGIN_ID}" --accept-capabilities \
```

**File**: `apps/memos-local-plugin/tests/powershell/openclaw-install-compat.ps1` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+param([string]$Installer = (Join-Path $PSScriptRoot '..\..\install.ps1'))
+$ErrorActionPreference = 'Stop'
+$Tokens = $null
+$ParseErrors = $null
+$Ast = [System.Management.Automation.Language.Parser]::ParseFile(
+    (Resolve-Path $Installer), [ref]$Tokens, [ref]$ParseErrors)
+if ($ParseErrors.Count) { throw ($ParseErrors | Out-String) }
+$Definition = $Ast.Find({ param($Node)
+    $Node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
+    $Node.Name -eq 'Invoke-OpenClawGatewayChecked'
+}, $true)
+Invoke-Expression $Definition.Extent.Text
+$Policy = $Ast.Find({ param($Node)
+    $Node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
+    $Node.Name -eq 'Enable-OpenClawMemoryPlugin'
+}, $true)
+if (-not $Policy) { throw 'Missing host policy helper' }
+Invoke-Expression $Policy.Extent.Text
+
+# Exercise the real PowerShell helper with a fake native command boundary.
+function cmd.exe {
+    param([Parameter(ValueFromRemainingArguments = $true)][object[]]$Arguments)
+    $Command = [string]$Arguments[-1]
+    $script:Calls.Add($Command)
+    $global:LASTEXITCODE = 0
+    if ($Command -eq 'openclaw gateway stop --help') {
+        if ($script:Modern) { return 'Options: --force  Allow stop from a non-interactive shell' }
+        return 'Options: --json'
+    }
+    if ($Command -eq 'openclaw config --help') {
+        if ($script:Modern) { return 'validate' }
+        return 'get set'
+    }
+    if ($Command -eq 'openclaw plugins enable --help') {
+        $Probe = Get-Content $env:OPENCLAW_CONFIG_PATH -Raw | ConvertFrom-Json
+        if ($Probe.plugins.enabled -ne $false) { throw 'Help probe can start plugins' }
+        $script:ProbeDir = $env:OPENCLAW_STATE_DIR
+        if ($script:Modern) { return '--accept-capabilities' }
+        return 'enable <id>'
+    }
+    if ($Command -eq $script:FailPolicy) { $global:LASTEXITCODE = 19; return 'simulated policy failure' }
+    if ($script:Fail) { $global:LASTEXITCODE = 17; return 'simulated service failure' }
+    if ($script:Modern -and $Command -eq 'openclaw gateway stop') {
+        $global:LASTEXITCODE = 1
+        return 'Re-run with --force from a non-interactive shell'
+    }
+    return 'Service action completed'
+}
+
+foreach ($Modern in @($false, $true)) {
+    $script:Modern = $Modern
+    $script:Fail = $false
+    $script:Calls = New-Object 'System.Collections.Generic.List[string]'
+    Invoke-OpenClawGatewayChecked -Action stop
+    $Expected = if ($Modern) { 'openclaw gateway stop --force' } else { 'openclaw gateway stop' }
+    if ($script:Calls[-1] -ne $Expected) { throw "Wrong stop command: $($script:Calls[-1])" }
+    Invoke-OpenClawGatewayChecked -Action start
+    if ($script:Calls[-1] -ne 'openclaw gateway start') { throw 'Start received stop-only arguments' }
+    Write-Output "PASS gateway stop/start (modern=$Modern)"
+}
+$script:Fail = $true
+$Caught = $false
+try { Invoke-OpenClawGatewayChecked -Action start } catch { $Caught = $true }
+if (-not $Caught) { throw 'Native service failure was ignored' }
+Write-Output 'PASS native failure propagation'
+
+$script:Fail = $false
+$OriginalState = $env:OPENCLAW_STATE_DIR
+$OriginalConfig = $env:OPENCLAW_CONFIG_PATH
+foreach ($Modern in @($false, $true)) {
+    $script:Modern = $Modern
+    $script:FailPolicy = ''
+    $script:Calls.Clear()
+    Enable-OpenClawMemoryPlugin
+    $Accepted = $script:Calls.Contains('openclaw plugins enable memos-local-plugin --accept-capabilities')
+    if ($Accepted -ne $Modern) { throw 'Capability consent feature detection failed' }
+    if ($env:OPENCLAW_STATE_DIR -ne $OriginalState -or $env:OPENCLAW_CONFIG_PATH -ne $OriginalConfig) { throw 'Host paths not restored' }
+    if (Test-Path $script:ProbeDir) { throw 'Temporary help configuration leaked' }
+    Write-Output "PASS host policy (modern=$Modern)"
+}
+$script:Modern = $true
+foreach ($Failure in @('openclaw config validate', 'openclaw plugins enable memos-local-plugin --accept-capabilities')) {
+    $script:FailPolicy = $Failure
+    $Caught = $false
+    try { Enable-OpenClawMemoryPlugin } catch { $Caught = $true }
+    if (-not $Caught) { throw 'Host policy failure was ignored' }
+    if ($env:OPENCLAW_STATE_DIR -ne $OriginalState -or $env:OPENCLAW_CONFIG_PATH -ne $OriginalConfig) { throw 'Host paths not restored after failure' }
+    if (Test-Path $script:ProbeDir) { throw 'Temporary help configuration leaked after failure' }
+    Write-Output "PASS failure propagation: $Failure"
+}
```

**File**: `apps/memos-local-plugin/tests/unit/adapters/openclaw-runtime.test.ts` (modified, +70/-5)
```diff
@@ -128,7 +128,56 @@ function deferred<T>() {
 }
 
 describe("OpenClaw adapter runtime lifecycle", () => {
-  it("blocks a duplicate register before the second runtime bootstraps", async () => {
+  it("reuses the active core for tool discovery without bootstrapping or registering hooks twice", async () => {
+    const home = useTempMemosHome();
+    const core = { ...makeCore(), listSkills: vi.fn(async () => []) };
+    const boot = vi.fn(async () => ({ core, config: DEFAULT_CONFIG, home }));
+    const close = vi.fn(async () => {});
+    const server = vi.fn(async () => ({ url: "http://127.0.0.1:18799", port: 18799, closed: false, close }));
+    const plugin = await loadPluginWithMocks(boot, server);
+    const owner = makeApi();
+    plugin.register(owner);
+    await owner.services[0].start();
+    try {
+      const discovery = Object.assign(makeApi(), { registrationMode: "tool-discovery" as const });
+      expect(() => plugin.register(discovery)).not.toThrow();
+      expect(discovery.on).not.toHaveBeenCalled();
+      expect(discovery.services).toHaveLength(0);
+      const registrations = vi.mocked(discovery.registerTool).mock.calls;
+      const entry = registrations.find(([, options]) => options?.name === "memos_skill_list");
+      expect(entry).toBeDefined();
+      const factory = entry![0];
+      if (typeof factory !== "function") throw new Error("Expected a tool factory");
+      const tool = factory({ agentId: "main", sessionKey: "main" });
+      if (!tool || Array.isArray(tool)) throw new Error("Expected a single tool");
+      await tool.execute("compat-test", {});
+      expect(core.listSkills).toHaveBeenCalledOnce();
+      expect(boot).toHaveBeenCalledOnce();
+      expect(server).toHaveBeenCalledOnce();
+    } finally {
+      await owner.services[0].stop();
+    }
+  });
+
+  it("keeps tool discovery inert when there is no full runtime", async () => {
+    useTempMemosHome();
+    const boot = vi.fn();
+    const server = vi.fn();
+    const plugin = await loadPluginWithMocks(boot, server);
+    const discovery = Object.assign(makeApi(), { registrationMode: "tool-discovery" as const });
+    plugin.register(discovery);
+    expect(boot).not.toHaveBeenCalled();
+    expect(server).not.toHaveBeenCalled();
+    expect(discovery.services).toHaveLength(0);
+    expect(discovery.on).not.toHaveBeenCalled();
+    const factory = vi.mocked(discovery.registerTool).mock.calls[0][0];
+    if (typeof factory !== "function") throw new Error("Expected a tool factory");
+    const tool = factory({ agentId: "main" });
+    if (!tool || Array.isArray(tool)) throw new Error("Expected a single tool");
+    await expect(tool.execute("compat-test", { query: "test" })).rejects.toThrow("runtime is not ready");
+  });
+
+  it("reuses the runtime and registers conversation hooks in another host registry", async () => {
     const home = useTempMemosHome();
     const firstCore = makeCore();
     const boot = deferred<{ core: ReturnType<typeof makeCore>; config: typeof DEFAULT_CONFIG; home: ResolvedHome }>();
@@ -139,21 +188,37 @@ describe("OpenClaw adapter runtime lifecycle", () => {
       closed: false,
       close: vi.fn(async () => {}),
     }));
-    const plugin = await loadPluginWithMocks(bootstrapMemoryCoreFull, startHttpServer);
+    const bridge = {
+      handleBeforePrompt: vi.fn(async () => ({ prependContext: "recalled test memory" })),
+      handleAgentEnd: vi.fn(async () => {}),
+    };
+    const plugin = await loadPluginWithMocks(bootstrapMemoryCoreFull, startHttpServer, vi.fn(() => bridge));
 
     const api1 = makeApi();
     plugin.register(api1);
     expect(bootstrapMemoryCoreFull).toHaveBeenCalledTimes(1);
 
     const api2 = makeApi();
-    expect(() => plugin.register(api2)).toThrow(/already active/);
+    vi.resetModules();
+    const reloaded = (await import("../../../adapters/openclaw/index.js")).default;
+    expect(() => reloaded.register(api2)).not.toThrow();
     expect(bootstrapMemoryCoreFull).toHaveBeenCalledTimes(1);
-    expect(api2.registerTool).not.toHaveBeenCalled();
-    expect(api2.on).not.toHaveBeenCalled();
+    expect(api2.registerTool).toHaveBeenCalled();
+    expect(api2.hooks.has("before_prompt_build")).toBe(true);
+    expect(api2.hooks.has("agent_end")).toBe(true);
+    expect(api2.services).toHaveLength(0);
 
     boot.resolve({ core: firstCore, config: DEFAULT_CONFIG, home });
     await api1.services[0]!.start?.();
+    const beforePrompt = api2.hooks.get("before_prompt_build") as OpenClawHookHandlerMap["before_prompt_build"];
+    await expect(beforePrompt({ prompt: "synthetic test", messages: [] }, { agentId: "main" }))
+      .resolves.toEqual({ prependContext: "recalled test memory" });
+    const agentEnd = api2.hooks.get("agent_end") as OpenClawHookHandlerMap["agent_end"];
+    agentEnd({ messages: [], success: true }, { agentId: "main" });
+    await vi.waitFor(() => expect(bridge.handleAgentEnd).toHaveBeenCalledOnce());
+    expect(bridge.handleB
```

---

### Incident Patch 12: `b72e54c4` (2026-09-08)
**Commit Message**: fix: restore OpenClaw installation and automatic memory hooks

**File**: `apps/memos-local-plugin/README.md` (modified, +22/-0)
```diff
@@ -120,6 +120,28 @@ npm pack
 bash install.sh --version ./memtensor-memos-local-plugin-1.0.0-beta.1.tgz
 ```
 
+For OpenClaw, use the installer for local archives too:
+
+```bash
+bash install.sh --agent openclaw --version ./memtensor-memos-local-plugin-2.0.16-beta.1.tgz
+```
+
+Do not substitute `openclaw plugins install ./package.tgz` for this command:
+that raw-archive path can resolve development-only DeepSeek peer dependencies
+and fail with `ERESOLVE`, including on OpenClaw 2026.9.1 and 2026.9.2.
+The installer stages production dependencies and rebuilds `better-sqlite3`.
+OpenClaw's newer `npm-pack:` path avoids the peer-resolution conflict, but a
+successful managed install alone does not verify native bindings or initialize
+MemOS runtime configuration; the installer above remains the supported setup.
+
+When upgrading OpenClaw itself, migrate retired host configuration with
+`openclaw doctor --fix` before installing MemOS. The MemOS installer removes its
+own legacy `plugins.installs` records, preserves other plugins' old-host records,
+and uses the host CLI for capability consent when available. It does not rewrite
+the host's internal installation database. See
+[the compatibility test results](docs/OPENCLAW-COMPATIBILITY.md) for tested versions
+and limits.
+
 On Windows, run `install.ps1` from PowerShell instead of `install.sh` for
 OpenClaw or Hermes. The DSH one-command target currently supports macOS/Linux;
 Windows users can use DSH's lower-level `dsh plugin` flow.
```

**File**: `apps/memos-local-plugin/adapters/openclaw/index.ts` (modified, +104/-55)
```diff
@@ -310,36 +310,12 @@ function isDiagnosticMode(): boolean {
   return false;
 }
 
-function register(api: OpenClawPluginApi): void {
-  const diagnosticMode = isDiagnosticMode();
-
-  let runtimeLock: OpenClawRuntimeLockHandle;
-  try {
-    runtimeLock = acquireOpenClawRuntimeLock({
-      home: resolveHome("openclaw"),
-      pluginId: PLUGIN_ID,
-      version: PLUGIN_VERSION,
-      viewerPort: OPENCLAW_VIEWER_PORT,
-      skipLock: diagnosticMode,
-    });
-
-    if (diagnosticMode) {
-      api.logger.info("memos-local: running in diagnostic mode (lock acquisition skipped)");
-    }
-  } catch (err) {
-    const duplicate = err instanceof DuplicateOpenClawRuntimeError;
-    api.logger.error("memos-local: duplicate OpenClaw runtime blocked", {
-      err: err instanceof Error ? err.message : String(err),
-      code: duplicate ? err.code : (err as { code?: unknown }).code,
-    });
-    throw err;
-  }
-
-  // OpenClaw publishes its clean, command-facing inbound body before
-  // prompt construction. Keep this store independent of core bootstrap
-  // so early messages are not lost while SQLite/providers initialize.
-  const inboundUserText = createOpenClawInboundTextStore();
-
+function registerRuntimeBindings(
+  api: OpenClawPluginApi,
+  ensureRuntime: () => Promise<PluginRuntime | null>,
+  inboundUserText: ReturnType<typeof createOpenClawInboundTextStore>,
+  currentRuntime: () => PluginRuntime | null,
+): void {
   // 1. Memory capability (prompt prelude) — register synchronously so the
   //    host immediately knows who owns the memory slot, even if bootstrap
   //    fails later.
@@ -392,31 +368,6 @@ function register(api: OpenClawPluginApi): void {
     },
   });
 
-  // 2. Kick off core bootstrap. OpenClaw only accepts tool / hook
-  //    registration during the synchronous `register(api)` window, so
-  //    tools register a shell now and wait for runtime inside execute().
-  let runtime: PluginRuntime | null = null;
-  let bootstrapError: Error | null = null;
-  const bootstrapPromise = createRuntime(api, runtimeLock, inboundUserText)
-    .then((r) => {
-      runtime = r;
-      api.logger.info("memos-local: plugin ready");
-    })
-    .catch((err) => {
-      bootstrapError = err instanceof Error ? err : new Error(String(err));
-      const duplicate = err instanceof DuplicateOpenClawRuntimeError;
-      api.logger.error("memos-local: bootstrap failed", {
-        err: bootstrapError.message,
-        code: duplicate ? err.code : (err as { code?: unknown }).code,
-      });
-    });
-
-  const ensureRuntime = async (): Promise<PluginRuntime | null> => {
-    if (runtime) return runtime;
-    await bootstrapPromise;
-    return runtime;
-  };
-
   /**
    * Helper for **void / fire-and-forget** hooks: dispatch `fn` against the
    * runtime as soon as bootstrap finishes (already finished → next tick).
@@ -520,6 +471,7 @@ function register(api: OpenClawPluginApi): void {
   // already sync, so we can invoke it directly when the runtime is
   // ready and return undefined otherwise.
   api.on("tool_result_persist", (event, ctx) => {
+    const runtime = currentRuntime();
     if (!runtime) return; // bootstrap not finished — nothing to inject
     return runtime.bridge.handleToolResultPersist(event, ctx);
   });
@@ -542,6 +494,101 @@ function register(api: OpenClawPluginApi): void {
     void runWhenReady((r) => r.bridge.handleSubagentEnded(event, ctx), "subagent_ended");
   });
 
+}
+
+// OpenClaw may build a separate tool registry in the same process. That
+// registry borrows the full registration's core and never owns its lifecycle.
+interface SharedRuntime {
+  ensureRuntime: () => Promise<PluginRuntime | null>;
+  registerBindings: (api: OpenClawPluginApi) => void;
+}
+// Host registries can reload the module. Keep ownership process-wide while
+// retaining the filesystem lock against genuinely separate gateway processes.
+const runtimeKey = Symbol.for("memos.openclaw.activeRuntimes.v1");
+const processState = globalThis as typeof globalThis & {
+  [runtimeKey]?: Map<string, SharedRuntime>;
+};
+const activeRuntimes = processState[runtimeKey] ??= new Map<string, SharedRuntime>();
+
+function register(api: OpenClawPluginApi): void {
+  const home = resolveHome("openclaw");
+  if (api.registrationMode === "tool-discovery") {
+    registerOpenClawTools(api, {
+      agent: "openclaw",
+      getCore: async () => (await activeRuntimes.get(home.root)?.ensureRuntime())?.core ?? null,
+      log: api.logger,
+    });
+    return;
+  }
+  const existing = activeRuntimes.get(home.root);
+  if (existing) {
+    existing.registerBindings(api);
+    api.logger.info("memos-local: reused active runtime for host registry");
+    return;
+  }
+  const diagnosticMode = isDiagnosticMode();
+
+  let runtimeLock: OpenClawRuntimeLockHandle;
+  try {
+    runtimeLock = acquireOpenClawRuntimeLock({
+      home,
+      pluginId: PLUGIN_ID,
+      version: PLUGIN_VERSION,
+      viewerPort: OPENCLAW_VIEW
```

**File**: `apps/memos-local-plugin/adapters/openclaw/openclaw-api.ts` (modified, +2/-0)
```diff
@@ -330,6 +330,8 @@ export interface ServiceDescriptor {
 // ─── The façade we register against ───────────────────────────────────────
 
 export interface OpenClawPluginApi {
+  /** Older hosts omit this; tool discovery must not start a second runtime. */
+  registrationMode?: "full" | "discovery" | "tool-discovery" | "setup-only" | "setup-runtime" | "cli-metadata";
   /** Plugin id + metadata the host injected. */
   id: string;
   name: string;
```

**File**: `apps/memos-local-plugin/docs/OPENCLAW-COMPATIBILITY.md` (added, +133/-0)
```diff
@@ -0,0 +1,133 @@
+# OpenClaw installation and automatic-memory compatibility
+
+Verified on 2026-09-08 against `main` commit `78a372a4`, using MemOS Local
+2.0.16-beta.1. The npm `latest` tag resolved to OpenClaw **2026.9.2**.
+
+## Changes
+
+- The shell installer no longer writes MemOS records into `plugins.installs`,
+  which 2026.9.1/2026.9.2 reject. It removes only MemOS-owned legacy records;
+  unrelated older records are preserved. Modern installation indexes remain
+  managed by OpenClaw.
+- Both installers detect noninteractive `gateway stop --force` support, validate
+  configuration, and accept capabilities through the host CLI when supported.
+  The shell installer additionally detects launchd `--disable`. Plugin help is
+  probed with plugins disabled to avoid bootstrapping a runtime from old CLIs.
+  The shell restart fallback now requires successful gateway health, rather
+  than treating any process listening on the gateway port as healthy.
+- Multiple full plugin registries in one process share one MemOS runtime, even
+  when the module is reloaded. Each registry gets conversation hooks and tools;
+  only the original service owns startup/shutdown. `tool-discovery` gets tool
+  factories without starting another runtime or registering conversation hooks.
+  The filesystem lock still prevents separate processes owning the same data.
+
+Automatic recall runs through `before_prompt_build` and logs
+`memos.onTurnStart`; capture runs through `agent_end` and logs
+`memos.agent_end.received` followed by `memos.onTurnEnd`. These are automatic
+hooks, not tool calls named `memory_search` or `memory_add`.
+
+## Verified behavior
+
+macOS tests used Node 22.23.1/npm 10.9.8; Windows x64 tests used Node 24.19.0,
+npm 11.17.0 and PowerShell 5.1.26100.8875. Separate host versions used isolated
+configurations, workspaces and databases. Gateways ran sequentially because
+MemOS uses port 18799. Normal services were restored and verified afterward.
+
+| Platform / OpenClaw | Config, startup, tool invocation | Automatic capture and cross-session recall |
+| --- | --- | --- |
+| macOS 2026.4.24 | Pass | Gateway path passes with client-only workaround; standard agent CLI fails (see below) |
+| macOS 2026.7.1-2 | Pass | Pass without workaround |
+| macOS 2026.9.1 | Pass | Pass |
+| macOS 2026.9.2 | Pass | Not independently exercised on macOS |
+| Windows 2026.4.24 | Config passes; gateway readiness times out | Not reached |
+| Windows 2026.7.1-2 | Pass | Pass without workaround |
+| Windows 2026.9.2 | Pass | Pass |
+
+The full shell installer completed on macOS 2026.9.1. The full patched
+PowerShell installer completed on Windows 2026.9.2; the previous PowerShell
+installer failed because stopping the gateway required `--force`.
+
+For older-host conversation tests, a local OpenAI-compatible model fixture
+returned fixed text without tools. Two different session IDs were used. The
+second prompt omitted the first session's unique test code; verification checked
+that the code appeared in the second model request. Successful runs produced:
+
+```text
+model_requests: 2
+traces: 2
+distinct_trace_sessions: 2
+cross_session_memory_in_model_prompt: true
+turn_start_count: 2
+turn_end_count: 2
+bootstrap_count: 1
+tool_ok: true
+duplicate_runtime_error: false
+```
+
+macOS 2026.9.1 and Windows 2026.9.2 also completed synthetic conversations with
+their configured models. SQLite contained the test traces; subsequent recall
+logged `hits=1` and `injected=yes` without requiring model tool calls.
+
+## Known limits
+
+- **2026.4.24 macOS agent CLI:** the CLI preloads a full plugin registry in a
+  separate process (`ensureCliPluginRegistryLoaded`). With the gateway running,
+  this triggers `DuplicateOpenClawRuntimeError` before sending the turn. A
+  diagnostic client configuration with plugins disabled let the unchanged
+  gateway complete capture/recall, but the standard CLI remains incompatible.
+- **2026.4.24 Windows startup:** the initial health RPC timed out after 10 seconds.
+  A fresh isolated retry exhausted 120 readiness attempts (about four minutes).
+  Sampling showed synchronous filesystem work in OpenClaw's
+  `prepareBundledPluginRuntimeDistMirror` / `writeRuntimeModuleWrapper`. Neither
+  attempt reached a conversation. This does not establish hook compatibility.
+- **Raw archive installation:** on 2026.9.1 and 2026.9.2,
+  `openclaw plugins install ./package.tgz --force` failed with npm `ERESOLVE`:
+  DSH development dependencies at rc.6 conflict with a transitive rc.8 peer.
+  `npm-pack:./package.tgz` installation succeeded but did not build native
+  SQLite. Use the MemOS installer, which installs production dependencies and
+  rebuilds native modules. This patch does not repair every host installation
+  path or change DSH dependencies.
+- Windows host upgrades can separately require migration of retired OpenClaw
+  configuration and Scheduled Task ownership repair. The plugin installer does
+  not 
```

**File**: `apps/memos-local-plugin/install.ps1` (modified, +46/-1)
```diff
@@ -59,7 +59,12 @@ function Invoke-OpenClawGatewayChecked {
     $PreviousErrorActionPreference = $ErrorActionPreference
     $ErrorActionPreference = "Continue"
     try {
-        $GatewayOutput = @(& cmd.exe /d /c "openclaw gateway $Action" 2>&1)
+        $GatewayCommand = "openclaw gateway $Action"
+        if ($Action -eq "stop") {
+            $StopHelp = @(& cmd.exe /d /c "openclaw gateway stop --help" 2>&1) | Out-String
+            if ($StopHelp -match '--force') { $GatewayCommand += " --force" }
+        }
+        $GatewayOutput = @(& cmd.exe /d /c $GatewayCommand 2>&1)
         $ExitCode = $LASTEXITCODE
     } finally {
         $ErrorActionPreference = $PreviousErrorActionPreference
@@ -72,6 +77,45 @@ function Invoke-OpenClawGatewayChecked {
     }
 }
 
+function Enable-OpenClawMemoryPlugin {
+    # Host state formats change independently of the plugin. Let the host own
+    # validation and capability consent; do not edit its SQLite install index.
+    $PreviousErrorActionPreference = $ErrorActionPreference
+    $PreviousStateDir = $env:OPENCLAW_STATE_DIR
+    $PreviousConfigPath = $env:OPENCLAW_CONFIG_PATH
+    $ProbeDir = Join-Path $env:TEMP ("memos-openclaw-help-" + [guid]::NewGuid().ToString("N"))
+    $ErrorActionPreference = "Continue"
+    try {
+        $ConfigHelp = @(& cmd.exe /d /c "openclaw config --help" 2>&1) | Out-String
+        if ($ConfigHelp -match 'validate') {
+            $Output = @(& cmd.exe /d /c "openclaw config validate" 2>&1)
+            $ExitCode = $LASTEXITCODE
+            $Output | ForEach-Object { Write-Host "$_" }
+            if ($ExitCode -ne 0) { throw "OpenClaw config validation failed; run openclaw doctor --fix and retry." }
+        }
+        # Older plugin CLI help can load configured plugins. Probe with plugins
+        # disabled, then restore the real host paths before accepting consent.
+        New-Item -ItemType Directory -Path $ProbeDir -ErrorAction Stop | Out-Null
+        Set-Content -Path (Join-Path $ProbeDir "openclaw.json") -Value '{"plugins":{"enabled":false}}' -Encoding ASCII -ErrorAction Stop
+        $env:OPENCLAW_STATE_DIR = $ProbeDir
+        $env:OPENCLAW_CONFIG_PATH = Join-Path $ProbeDir "openclaw.json"
+        $EnableHelp = @(& cmd.exe /d /c "openclaw plugins enable --help" 2>&1) | Out-String
+        $env:OPENCLAW_STATE_DIR = $PreviousStateDir
+        $env:OPENCLAW_CONFIG_PATH = $PreviousConfigPath
+        if ($EnableHelp -match '--accept-capabilities') {
+            $Output = @(& cmd.exe /d /c "openclaw plugins enable memos-local-plugin --accept-capabilities" 2>&1)
+            $ExitCode = $LASTEXITCODE
+            $Output | ForEach-Object { Write-Host "$_" }
+            if ($ExitCode -ne 0) { throw "OpenClaw could not enable the MemOS plugin (exit code $ExitCode)." }
+        }
+    } finally {
+        $env:OPENCLAW_STATE_DIR = $PreviousStateDir
+        $env:OPENCLAW_CONFIG_PATH = $PreviousConfigPath
+        $ErrorActionPreference = $PreviousErrorActionPreference
+        if (Test-Path $ProbeDir) { Remove-Item -Recurse -Force $ProbeDir -ErrorAction SilentlyContinue }
+    }
+}
+
 function Test-BetterSqlite3 {
     param([string]$NodeBin, [string]$Prefix)
     $SmokeScript = "const Database=require('better-sqlite3');const db=new Database(':memory:');db.exec('SELECT 1');db.close();"
@@ -662,6 +706,7 @@ fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
         Write-Success "openclaw.json patched"
 
         if ($OcBin) {
+            Enable-OpenClawMemoryPlugin
             Write-Info "Starting OpenClaw gateway"
             try {
                 Invoke-OpenClawGatewayChecked -Action "start"
```

**File**: `apps/memos-local-plugin/install.sh` (modified, +47/-24)
```diff
@@ -501,7 +501,14 @@ install_openclaw() {
   GATEWAY_RECOVERY_STATE="inactive"
   if oc_bin="$(find_openclaw_cli)"; then
     step "Stopping OpenClaw gateway"
-    "${oc_bin}" gateway stop >/dev/null 2>&1 || true
+    local stop_help
+    local -a stop_args=(gateway stop)
+    stop_help="$("${oc_bin}" gateway stop --help 2>/dev/null || true)"
+    # New hosts require an explicit non-interactive stop; suppress launchd
+    # respawn during the package swap when the host supports it.
+    if grep -q -- '--force' <<< "${stop_help}"; then stop_args+=(--force); fi
+    if grep -q -- '--disable' <<< "${stop_help}"; then stop_args+=(--disable); fi
+    "${oc_bin}" "${stop_args[@]}" >/dev/null 2>&1 || true
     sleep 1
     success "Gateway stopped"
     GATEWAY_RECOVERY_BIN="${oc_bin}"
@@ -556,18 +563,12 @@ EOF
 
   step "Patching ${config_path}"
   PLUGIN_ID="${PLUGIN_ID}" \
-  INSTALL_PATH="${prefix}" \
-  SOURCE_KIND="${SOURCE_KIND}" \
-  SOURCE_SPEC="${SOURCE_SPEC}" \
-  PLUGIN_VERSION="${plugin_version}" \
   LEGACY_JSON="$(printf '%s,' "${LEGACY_PLUGIN_IDS[@]}")" \
   CONFIG_PATH="${config_path}" \
   node - <<'NODE'
 const fs = require('fs');
 const {
-  CONFIG_PATH: configPath, PLUGIN_ID: pluginId, INSTALL_PATH: installPath,
-  SOURCE_KIND: sourceKind, SOURCE_SPEC: sourceSpec,
-  PLUGIN_VERSION: pluginVersion, LEGACY_JSON: legacyCsv,
+  CONFIG_PATH: configPath, PLUGIN_ID: pluginId, LEGACY_JSON: legacyCsv,
 } = process.env;
 const legacyIds = (legacyCsv || '').split(',').filter(Boolean);
 const MEMOS_TOOL_NAMES = [
@@ -615,7 +616,6 @@ if (!config.plugins.allow.includes(pluginId)) config.plugins.allow.push(pluginId
 // can delete it themselves if desired.
 for (const legacyId of legacyIds) {
   if (config.plugins.entries?.[legacyId]) delete config.plugins.entries[legacyId];
-  if (config.plugins.installs?.[legacyId]) delete config.plugins.installs[legacyId];
   if (Array.isArray(config.plugins.allow)) {
     config.plugins.allow = config.plugins.allow.filter((x) => x !== legacyId);
   }
@@ -646,20 +646,24 @@ if (
 }
 config.plugins.entries[pluginId].hooks.allowConversationAccess = true;
 
-if (!config.plugins.installs || typeof config.plugins.installs !== 'object') config.plugins.installs = {};
-const installsEntry = {
-  source: sourceKind === 'path' ? 'path' : 'npm',
-  installPath,
-  version: pluginVersion,
-  resolvedVersion: pluginVersion,
-  installedAt: new Date().toISOString(),
-};
-if (sourceKind !== 'path') {
-  installsEntry.spec = sourceSpec;
-  installsEntry.resolvedName = '@memtensor/memos-local-plugin';
-  installsEntry.resolvedSpec = sourceSpec;
+// Older OpenClaw releases allow `plugins.installs`; current hosts keep that
+// metadata in machine-managed state instead. The extension already lives
+// in OpenClaw's standard discovery directory, so neither generation requires a
+// hand-written MemOS install record. Remove only records owned by this installer
+// so older OpenClaw releases retain metadata for unrelated plugins.
+if (
+  config.plugins.installs &&
+  typeof config.plugins.installs === 'object' &&
+  !Array.isArray(config.plugins.installs)
+) {
+  delete config.plugins.installs[pluginId];
+  for (const legacyId of legacyIds) delete config.plugins.installs[legacyId];
+  if (Object.keys(config.plugins.installs).length === 0) delete config.plugins.installs;
+} else if (Object.prototype.hasOwnProperty.call(config.plugins, 'installs')) {
+  // A malformed legacy value is invalid on old hosts and cannot carry records
+  // worth preserving.
+  delete config.plugins.installs;
 }
-config.plugins.installs[pluginId] = installsEntry;
 
 fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
 NODE
@@ -669,15 +673,34 @@ NODE
     warn "openclaw CLI not on PATH — restart manually: openclaw gateway start"
     return 1
   fi
+  # Validate before accepting an already-running process: an old process may
+  # still answer while the newly written configuration is invalid.
+  if "${oc_bin}" config --help 2>/dev/null | grep -q 'validate'; then
+    "${oc_bin}" config validate || die "OpenClaw config validation failed; run openclaw doctor --fix and retry."
+  fi
+  # Recent hosts persist capability consent outside openclaw.json. Let their
+  # CLI own that state; older hosts do not expose this flag.
+  # Some older CLIs load configured plugins even for subcommand help. Probe
+  # against an empty, disabled plugin configuration to avoid starting a runtime.
+  local probe_dir enable_help
+  probe_dir="$(mktemp -d)"
+  printf '%s\n' '{"plugins":{"enabled":false}}' > "${probe_dir}/openclaw.json"
+  enable_help="$(OPENCLAW_STATE_DIR="${probe_dir}" OPENCLAW_CONFIG_PATH="${probe_dir}/openclaw.json" \
+    "${oc_bin}" plugins enable --help 2>/dev/null || true)"
+  rm -rf -- "${probe_dir}"
+  if grep -q -- '--accept-capabilities' <<< "${enable_help}"; then
+    step "Enabling MemOS memory tools and conversation hooks"
+    "${oc_bin}" plugins enable "${PLUGIN_ID}" --accept-capabilities \
```

**File**: `apps/memos-local-plugin/tests/powershell/openclaw-install-compat.ps1` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+param([string]$Installer = (Join-Path $PSScriptRoot '..\..\install.ps1'))
+$ErrorActionPreference = 'Stop'
+$Tokens = $null
+$ParseErrors = $null
+$Ast = [System.Management.Automation.Language.Parser]::ParseFile(
+    (Resolve-Path $Installer), [ref]$Tokens, [ref]$ParseErrors)
+if ($ParseErrors.Count) { throw ($ParseErrors | Out-String) }
+$Definition = $Ast.Find({ param($Node)
+    $Node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
+    $Node.Name -eq 'Invoke-OpenClawGatewayChecked'
+}, $true)
+Invoke-Expression $Definition.Extent.Text
+$Policy = $Ast.Find({ param($Node)
+    $Node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
+    $Node.Name -eq 'Enable-OpenClawMemoryPlugin'
+}, $true)
+if (-not $Policy) { throw 'Missing host policy helper' }
+Invoke-Expression $Policy.Extent.Text
+
+# Exercise the real PowerShell helper with a fake native command boundary.
+function cmd.exe {
+    param([Parameter(ValueFromRemainingArguments = $true)][object[]]$Arguments)
+    $Command = [string]$Arguments[-1]
+    $script:Calls.Add($Command)
+    $global:LASTEXITCODE = 0
+    if ($Command -eq 'openclaw gateway stop --help') {
+        if ($script:Modern) { return 'Options: --force  Allow stop from a non-interactive shell' }
+        return 'Options: --json'
+    }
+    if ($Command -eq 'openclaw config --help') {
+        if ($script:Modern) { return 'validate' }
+        return 'get set'
+    }
+    if ($Command -eq 'openclaw plugins enable --help') {
+        $Probe = Get-Content $env:OPENCLAW_CONFIG_PATH -Raw | ConvertFrom-Json
+        if ($Probe.plugins.enabled -ne $false) { throw 'Help probe can start plugins' }
+        $script:ProbeDir = $env:OPENCLAW_STATE_DIR
+        if ($script:Modern) { return '--accept-capabilities' }
+        return 'enable <id>'
+    }
+    if ($Command -eq $script:FailPolicy) { $global:LASTEXITCODE = 19; return 'simulated policy failure' }
+    if ($script:Fail) { $global:LASTEXITCODE = 17; return 'simulated service failure' }
+    if ($script:Modern -and $Command -eq 'openclaw gateway stop') {
+        $global:LASTEXITCODE = 1
+        return 'Re-run with --force from a non-interactive shell'
+    }
+    return 'Service action completed'
+}
+
+foreach ($Modern in @($false, $true)) {
+    $script:Modern = $Modern
+    $script:Fail = $false
+    $script:Calls = New-Object 'System.Collections.Generic.List[string]'
+    Invoke-OpenClawGatewayChecked -Action stop
+    $Expected = if ($Modern) { 'openclaw gateway stop --force' } else { 'openclaw gateway stop' }
+    if ($script:Calls[-1] -ne $Expected) { throw "Wrong stop command: $($script:Calls[-1])" }
+    Invoke-OpenClawGatewayChecked -Action start
+    if ($script:Calls[-1] -ne 'openclaw gateway start') { throw 'Start received stop-only arguments' }
+    Write-Output "PASS gateway stop/start (modern=$Modern)"
+}
+$script:Fail = $true
+$Caught = $false
+try { Invoke-OpenClawGatewayChecked -Action start } catch { $Caught = $true }
+if (-not $Caught) { throw 'Native service failure was ignored' }
+Write-Output 'PASS native failure propagation'
+
+$script:Fail = $false
+$OriginalState = $env:OPENCLAW_STATE_DIR
+$OriginalConfig = $env:OPENCLAW_CONFIG_PATH
+foreach ($Modern in @($false, $true)) {
+    $script:Modern = $Modern
+    $script:FailPolicy = ''
+    $script:Calls.Clear()
+    Enable-OpenClawMemoryPlugin
+    $Accepted = $script:Calls.Contains('openclaw plugins enable memos-local-plugin --accept-capabilities')
+    if ($Accepted -ne $Modern) { throw 'Capability consent feature detection failed' }
+    if ($env:OPENCLAW_STATE_DIR -ne $OriginalState -or $env:OPENCLAW_CONFIG_PATH -ne $OriginalConfig) { throw 'Host paths not restored' }
+    if (Test-Path $script:ProbeDir) { throw 'Temporary help configuration leaked' }
+    Write-Output "PASS host policy (modern=$Modern)"
+}
+$script:Modern = $true
+foreach ($Failure in @('openclaw config validate', 'openclaw plugins enable memos-local-plugin --accept-capabilities')) {
+    $script:FailPolicy = $Failure
+    $Caught = $false
+    try { Enable-OpenClawMemoryPlugin } catch { $Caught = $true }
+    if (-not $Caught) { throw 'Host policy failure was ignored' }
+    if ($env:OPENCLAW_STATE_DIR -ne $OriginalState -or $env:OPENCLAW_CONFIG_PATH -ne $OriginalConfig) { throw 'Host paths not restored after failure' }
+    if (Test-Path $script:ProbeDir) { throw 'Temporary help configuration leaked after failure' }
+    Write-Output "PASS failure propagation: $Failure"
+}
```

**File**: `apps/memos-local-plugin/tests/unit/adapters/openclaw-runtime.test.ts` (modified, +70/-5)
```diff
@@ -128,7 +128,56 @@ function deferred<T>() {
 }
 
 describe("OpenClaw adapter runtime lifecycle", () => {
-  it("blocks a duplicate register before the second runtime bootstraps", async () => {
+  it("reuses the active core for tool discovery without bootstrapping or registering hooks twice", async () => {
+    const home = useTempMemosHome();
+    const core = { ...makeCore(), listSkills: vi.fn(async () => []) };
+    const boot = vi.fn(async () => ({ core, config: DEFAULT_CONFIG, home }));
+    const close = vi.fn(async () => {});
+    const server = vi.fn(async () => ({ url: "http://127.0.0.1:18799", port: 18799, closed: false, close }));
+    const plugin = await loadPluginWithMocks(boot, server);
+    const owner = makeApi();
+    plugin.register(owner);
+    await owner.services[0].start();
+    try {
+      const discovery = Object.assign(makeApi(), { registrationMode: "tool-discovery" as const });
+      expect(() => plugin.register(discovery)).not.toThrow();
+      expect(discovery.on).not.toHaveBeenCalled();
+      expect(discovery.services).toHaveLength(0);
+      const registrations = vi.mocked(discovery.registerTool).mock.calls;
+      const entry = registrations.find(([, options]) => options?.name === "memos_skill_list");
+      expect(entry).toBeDefined();
+      const factory = entry![0];
+      if (typeof factory !== "function") throw new Error("Expected a tool factory");
+      const tool = factory({ agentId: "main", sessionKey: "main" });
+      if (!tool || Array.isArray(tool)) throw new Error("Expected a single tool");
+      await tool.execute("compat-test", {});
+      expect(core.listSkills).toHaveBeenCalledOnce();
+      expect(boot).toHaveBeenCalledOnce();
+      expect(server).toHaveBeenCalledOnce();
+    } finally {
+      await owner.services[0].stop();
+    }
+  });
+
+  it("keeps tool discovery inert when there is no full runtime", async () => {
+    useTempMemosHome();
+    const boot = vi.fn();
+    const server = vi.fn();
+    const plugin = await loadPluginWithMocks(boot, server);
+    const discovery = Object.assign(makeApi(), { registrationMode: "tool-discovery" as const });
+    plugin.register(discovery);
+    expect(boot).not.toHaveBeenCalled();
+    expect(server).not.toHaveBeenCalled();
+    expect(discovery.services).toHaveLength(0);
+    expect(discovery.on).not.toHaveBeenCalled();
+    const factory = vi.mocked(discovery.registerTool).mock.calls[0][0];
+    if (typeof factory !== "function") throw new Error("Expected a tool factory");
+    const tool = factory({ agentId: "main" });
+    if (!tool || Array.isArray(tool)) throw new Error("Expected a single tool");
+    await expect(tool.execute("compat-test", { query: "test" })).rejects.toThrow("runtime is not ready");
+  });
+
+  it("reuses the runtime and registers conversation hooks in another host registry", async () => {
     const home = useTempMemosHome();
     const firstCore = makeCore();
     const boot = deferred<{ core: ReturnType<typeof makeCore>; config: typeof DEFAULT_CONFIG; home: ResolvedHome }>();
@@ -139,21 +188,37 @@ describe("OpenClaw adapter runtime lifecycle", () => {
       closed: false,
       close: vi.fn(async () => {}),
     }));
-    const plugin = await loadPluginWithMocks(bootstrapMemoryCoreFull, startHttpServer);
+    const bridge = {
+      handleBeforePrompt: vi.fn(async () => ({ prependContext: "recalled test memory" })),
+      handleAgentEnd: vi.fn(async () => {}),
+    };
+    const plugin = await loadPluginWithMocks(bootstrapMemoryCoreFull, startHttpServer, vi.fn(() => bridge));
 
     const api1 = makeApi();
     plugin.register(api1);
     expect(bootstrapMemoryCoreFull).toHaveBeenCalledTimes(1);
 
     const api2 = makeApi();
-    expect(() => plugin.register(api2)).toThrow(/already active/);
+    vi.resetModules();
+    const reloaded = (await import("../../../adapters/openclaw/index.js")).default;
+    expect(() => reloaded.register(api2)).not.toThrow();
     expect(bootstrapMemoryCoreFull).toHaveBeenCalledTimes(1);
-    expect(api2.registerTool).not.toHaveBeenCalled();
-    expect(api2.on).not.toHaveBeenCalled();
+    expect(api2.registerTool).toHaveBeenCalled();
+    expect(api2.hooks.has("before_prompt_build")).toBe(true);
+    expect(api2.hooks.has("agent_end")).toBe(true);
+    expect(api2.services).toHaveLength(0);
 
     boot.resolve({ core: firstCore, config: DEFAULT_CONFIG, home });
     await api1.services[0]!.start?.();
+    const beforePrompt = api2.hooks.get("before_prompt_build") as OpenClawHookHandlerMap["before_prompt_build"];
+    await expect(beforePrompt({ prompt: "synthetic test", messages: [] }, { agentId: "main" }))
+      .resolves.toEqual({ prependContext: "recalled test memory" });
+    const agentEnd = api2.hooks.get("agent_end") as OpenClawHookHandlerMap["agent_end"];
+    agentEnd({ messages: [], success: true }, { agentId: "main" });
+    await vi.waitFor(() => expect(bridge.handleAgentEnd).toHaveBeenCalledOnce());
+    expect(bridge.handleB
```

---

### Incident Patch 13: `e9e4f709` (2026-09-03)
**Commit Message**: fix(llm): propagate opts.op through facade to providers (#2309)

**File**: `apps/memos-local-plugin/core/llm/client.ts` (modified, +1/-0)
```diff
@@ -282,6 +282,7 @@ export function createLlmClientWithProvider(
       maxTokens: opts?.maxTokens ?? config.maxTokens ?? DEFAULT_MAX_TOKENS,
       jsonMode,
       stop: opts?.stop,
+      op: opts?.op,
     };
   }
 
```

**File**: `apps/memos-local-plugin/core/llm/types.ts` (modified, +8/-0)
```diff
@@ -257,6 +257,14 @@ export interface ProviderCallInput {
   maxTokens: number;
   jsonMode: boolean;
   stop?: string[];
+  /**
+   * Logical call site (e.g. `capture.summarize`, `retrieval.filter`,
+   * `skill.evolve`). Forwarded from `LlmCallOptions.op` so providers
+   * can apply per-op behavior (request-body tweaks, routing overrides,
+   * reasoning kill-switches, per-op budget caps). Optional — providers
+   * must not assume it is set.
+   */
+  op?: string;
 }
 
 /** What providers return — pre-facade post-processing. */
```

**File**: `apps/memos-local-plugin/tests/unit/llm/client.test.ts` (modified, +45/-0)
```diff
@@ -335,6 +335,51 @@ describe("llm/client", () => {
     );
   });
 
+  // ─── op propagation to providers (issue #2308) ────────────────────────
+  //
+  // The facade must forward `opts.op` onto the `ProviderCallInput` handed to
+  // `provider.complete()` / `provider.stream()` so per-op provider behavior
+  // (e.g. request-body tweaks, routing overrides, reasoning kill-switches
+  // keyed on `capture.summarize`) can fire. Dropping it silently makes
+  // those switches unreachable.
+  describe("op propagation (issue #2308)", () => {
+    it("complete forwards opts.op onto the provider input", async () => {
+      const fake = new FakeProvider("openai_compatible", () => ({ text: "ok", durationMs: 1 }));
+      const client = createLlmClientWithProvider(cfg(), fake);
+      await client.complete("hi", { op: "capture.summarize" });
+      expect(fake.lastInput?.op).toBe("capture.summarize");
+    });
+
+    it("completeJson forwards opts.op onto the provider input", async () => {
+      const fake = new FakeProvider("openai_compatible", () => ({
+        text: '{"a":1}',
+        durationMs: 1,
+      }));
+      const client = createLlmClientWithProvider(cfg(), fake);
+      await client.completeJson<{ a: number }>("score", { op: "retrieval.filter" });
+      expect(fake.lastInput?.op).toBe("retrieval.filter");
+    });
+
+    it("stream forwards opts.op onto the provider input (non-streaming provider)", async () => {
+      // FakeProvider has no stream(); the facade wraps complete() in a
+      // single-chunk iterable, which still exercises buildCallInput.
+      const fake = new FakeProvider("openai_compatible", () => ({ text: "one", durationMs: 1 }));
+      const client = createLlmClientWithProvider(cfg(), fake);
+      const parts: string[] = [];
+      for await (const c of client.stream("x", { op: "skill.evolve" })) {
+        if (!c.done) parts.push(c.delta);
+      }
+      expect(fake.lastInput?.op).toBe("skill.evolve");
+    });
+
+    it("omits op field when caller supplies no op (contract stays optional)", async () => {
+      const fake = new FakeProvider("openai_compatible", () => ({ text: "ok", durationMs: 1 }));
+      const client = createLlmClientWithProvider(cfg(), fake);
+      await client.complete("hi");
+      expect(fake.lastInput?.op).toBeUndefined();
+    });
+  });
+
   // ─── Circuit breaker (issue #1897) ──────────────────────────────────────
   describe("circuit breaker", () => {
     function statusSink(): { rows: LlmStatusDetail[]; push: (d: LlmStatusDetail) => void } {
```

---

### Incident Patch 14: `78a372a4` (2026-09-03)
**Commit Message**: fix: Improve the extraction link of SkillMemory (#2342)

## Description

Please include a summary of the change, the problem it solves, the
implementation approach, and relevant context. List any dependencies
required for this change.

Related Issue (Required):  Fixes #issue_number

## Type of change

Please delete options that are not relevant.

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing
functionality to not work as expected)
- [ ] Refactor (does not change functionality, e.g. code style
improvements, linting)
- [ ] Documentation update

## How Has This Been Tested?

Please describe the tests that you ran to verify your changes. Provide
instructions so we can reproduce. Please also list any relevant details
for your test configuration

- [ ] Unit Test
- [ ] Test Script Or Test Steps (please provide)
- [ ] Pipeline Automated API Test (please provide)

## Checklist

- [ ] I have performed a self-review of my own code | 我已自行检查了自己的代码
- [ ] I have commented my code in hard-to-understand areas |
我已在难以理解的地方对代码进行了注释
- [ ] I have added tests that pr

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
 ##############################################################################
 
 name = "MemoryOS"
-version = "2.0.32"
+version = "2.0.33"
 description = "Intelligence Begins with Memory"
 license = {text = "Apache-2.0"}
 readme = "README.md"
```

**File**: `src/memos/__init__.py` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-__version__ = "2.0.32"
+__version__ = "2.0.33"
 
 from memos.configs.mem_cube import GeneralMemCubeConfig
 from memos.configs.mem_os import MOSConfig
```

**File**: `src/memos/mem_reader/read_pref_memory/process_preference_memory.py` (modified, +46/-9)
```diff
@@ -10,7 +10,12 @@
 from memos.context.context import ContextThreadPoolExecutor
 from memos.log import get_logger
 from memos.mem_reader.read_multi_modal import detect_lang
-from memos.memories.textual.item import TextualMemoryItem, TreeNodeTextualMemoryMetadata
+from memos.mem_reader.source_filter import MemorySourceFilter
+from memos.memories.textual.item import (
+    SourceMessage,
+    TextualMemoryItem,
+    TreeNodeTextualMemoryMetadata,
+)
 from memos.templates.prefer_complete_prompt import (
     NAIVE_EXPLICIT_PREFERENCE_EXTRACT_PROMPT,
     NAIVE_EXPLICIT_PREFERENCE_EXTRACT_PROMPT_ZH,
@@ -100,6 +105,7 @@ def _create_preference_memory_item(
     fast_item: TextualMemoryItem | None,
     info: dict[str, Any],
     embedder,
+    sources_override: list[SourceMessage] | None = None,
     **kwargs,
 ) -> TextualMemoryItem:
     """
@@ -133,7 +139,13 @@ def _create_preference_memory_item(
     embedding = embedder.embed([context_summary])[0] if embedder and context_summary else None
 
     # Extract sources from fast_item
-    sources = getattr(fast_item.metadata, "sources", []) if fast_item else []
+    sources = (
+        sources_override
+        if sources_override is not None
+        else getattr(fast_item.metadata, "sources", [])
+        if fast_item
+        else []
+    )
 
     # Create metadata
     metadata = TreeNodeTextualMemoryMetadata(
@@ -168,6 +180,7 @@ def _process_single_chunk_explicit(
     info: dict[str, Any],
     llm,
     embedder,
+    sources_override: list[SourceMessage] | None = None,
     **kwargs,
 ) -> list[TextualMemoryItem]:
     """Process a single chunk for explicit preferences."""
@@ -190,6 +203,7 @@ def _process_single_chunk_explicit(
             fast_item=fast_item,
             info=info,
             embedder=embedder,
+            sources_override=sources_override,
             **kwargs,
         )
         memories.append(memory)
@@ -203,6 +217,7 @@ def _process_single_chunk_implicit(
     info: dict[str, Any],
     llm,
     embedder,
+    sources_override: list[SourceMessage] | None = None,
     **kwargs,
 ) -> list[TextualMemoryItem]:
     """Process a single chunk for implicit preferences."""
@@ -225,6 +240,7 @@ def _process_single_chunk_implicit(
             fast_item=fast_item,
             info=info,
             embedder=embedder,
+            sources_override=sources_override,
             **kwargs,
         )
         memories.append(memory)
@@ -260,13 +276,20 @@ def process_preference_fine(
         return []
 
     try:
-        # Convert fast_memory_items to messages format
+        # Convert fast_memory_items to source-filtered messages format
+        source_filter = MemorySourceFilter()
         chunks = []
         for fast_item in fast_memory_items:
-            mem_str = fast_item.memory or ""
+            raw_sources = getattr(fast_item.metadata, "sources", None)
+            if raw_sources:
+                filtered_sources = source_filter.filter_for_preference(raw_sources)
+                mem_str = source_filter.sources_to_prompt_text(filtered_sources)
+            else:
+                filtered_sources = None
+                mem_str = fast_item.memory or ""
             if not mem_str.strip():
                 continue
-            chunks.append((mem_str, fast_item))
+            chunks.append((mem_str, fast_item, filtered_sources))
 
         if not chunks:
             return []
@@ -277,16 +300,30 @@ def process_preference_fine(
             futures = {}
 
             # Submit explicit extraction tasks
-            for chunk, fast_item in chunks:
+            for chunk, fast_item, filtered_sources in chunks:
                 future = executor.submit(
-                    _process_single_chunk_explicit, chunk, fast_item, info, llm, embedder, **kwargs
+                    _process_single_chunk_explicit,
+                    chunk,
+                    fast_item,
+                    info,
+                    llm,
+                    embedder,
+                    filtered_sources,
+                    **kwargs,
                 )
                 futures[future] = ("explicit_preference", chunk)
 
             # Submit implicit extraction tasks
-            for chunk, fast_item in chunks:
+            for chunk, fast_item, filtered_sources in chunks:
                 future = executor.submit(
-                    _process_single_chunk_implicit, chunk, fast_item, info, llm, embedder, **kwargs
+                    _process_single_chunk_implicit,
+                    chunk,
+                    fast_item,
+                    info,
+                    llm,
+                    embedder,
+                    filtered_sources,
+                    **kwargs,
                 )
                 futures[future] = ("implicit_preference", chunk)
 
```

**File**: `src/memos/mem_reader/source_filter.py` (added, +228/-0)
```diff
@@ -0,0 +1,228 @@
+"""Source filters shared by memory extraction steps."""
+
+from __future__ import annotations
+
+import re
+
+from dataclasses import dataclass
+from typing import Any, Literal
+
+from memos.memories.textual.item import SourceMessage
+
+
+SourceFilterAction = Literal[
+    "extract_after_last",
+    "strip_after_first",
+    "drop_if_present",
+    "drop_if_prefix",
+]
+
+
+@dataclass(frozen=True)
+class SourceFilterRule:
+    name: str
+    action: SourceFilterAction
+    patterns: tuple[re.Pattern[str], ...]
+
+
+@dataclass(frozen=True)
+class SourceFilterPolicy:
+    allowed_roles: frozenset[str]
+    blocked_roles: frozenset[str]
+    blocked_source_types: frozenset[str]
+    rules: tuple[SourceFilterRule, ...]
+
+
+def _patterns(*values: str, flags: int = 0) -> tuple[re.Pattern[str], ...]:
+    return tuple(re.compile(value, flags) for value in values)
+
+
+PREFERENCE_SOURCE_POLICY = SourceFilterPolicy(
+    allowed_roles=frozenset({"user"}),
+    blocked_roles=frozenset({"assistant", "system", "tool"}),
+    blocked_source_types=frozenset({"tool"}),
+    rules=(
+        SourceFilterRule(
+            name="user_query_boundary",
+            action="extract_after_last",
+            patterns=_patterns(
+                r"(?im)(?:^|[ \t])#{1,3}[ \t]*用户(?:的)?(?:消息|问题)(?:为|是)?[ \t]*[：:]",
+                r"user\u200b原\u200b始\u200bquery\u200b：\u200b\u200b\u200b\u200b",
+                r"(?im)(?:^|[ \t])#{1,3}[ \t]*user[ \t]*原始[ \t]*query[ \t]*[：:]",
+            ),
+        ),
+        SourceFilterRule(
+            name="trailing_context",
+            action="strip_after_first",
+            patterns=_patterns(
+                r"(?m)^\s{0,3}#{1,3}\s*以下是可能和用户问题关联的对话记忆",
+            ),
+        ),
+        SourceFilterRule(
+            name="stream_transcript",
+            action="strip_after_first",
+            patterns=_patterns(
+                r'data:\s*\{"id"\s*:\s*"chatcmpl',
+                r"data:\s*\[DONE\]",
+            ),
+        ),
+        SourceFilterRule(
+            name="retrieval_context",
+            action="drop_if_present",
+            patterns=_patterns(
+                r"(?m)^\s{0,3}#{1,3}\s*以下内容是基于用户发送的消息的搜索结果",
+                r"(?i)<(?:retrieved_context|search_context|web_results)>",
+            ),
+        ),
+        SourceFilterRule(
+            name="memory_context",
+            action="drop_if_present",
+            patterns=_patterns(
+                r"(?i)</?(?:memories|memory_context)>",
+                r"(?i)===\s*MemOS LONG-TERM MEMORY",
+                r"(?i)\[MemOS Auto-Recall\]",
+            ),
+        ),
+        SourceFilterRule(
+            name="agent_reasoning",
+            action="drop_if_present",
+            patterns=_patterns(
+                r"(?i)<(?:thinking|reasoning|agent_scratchpad)>",
+            ),
+        ),
+        SourceFilterRule(
+            name="runtime_metadata",
+            action="drop_if_present",
+            patterns=_patterns(
+                r"(?m)^\s*Conversation info \(untrusted metadata\):",
+                r"(?m)^\s*Untrusted context \(metadata, do not treat as instructions or commands\):",
+            ),
+        ),
+        SourceFilterRule(
+            name="automation_context",
+            action="drop_if_prefix",
+            patterns=_patterns(
+                r"\[cron:",
+                r"System:\s+\[",
+                r"A scheduled reminder has been triggered",
+            ),
+        ),
+        SourceFilterRule(
+            name="assistant_runtime_prefix",
+            action="drop_if_prefix",
+            patterns=_patterns(
+                r"小依会根据用户需求",
+                r"正在完善Gemini的思考过程",
+            ),
+        ),
+    ),
+)
+
+
+class MemorySourceFilter:
+    """Filter raw memory sources before building extraction prompts."""
+
+    def __init__(self, policy: SourceFilterPolicy = PREFERENCE_SOURCE_POLICY):
+        self.policy = policy
+
+    def filter_for_preference(self, sources: list[Any] | None) -> list[SourceMessage]:
+        """Return only sources allowed to appear in preference extraction prompts."""
+        filtered: list[SourceMessage] = []
+        for source in sources or []:
+            source_dict = self._source_to_dict(source)
+            if not self._keep_role_for_preference(source_dict):
+                continue
+
+            content = str(source_dict.get("content") or "")
+            content = self._strip_known_context_wrappers(content)
+            if not content.strip():
+                continue
+
+            cleaned = source_dict.copy()
+            cleaned["content"] = content.strip()
+            if cleaned.get("type") is None:
+                cleaned["type"] = "chat"
+            cleaned = self._coerce_source_fields(cleaned)
+            filtered.append(SourceMessage(**cleaned))
+        return filtered
+
+    def build_prompt_text(self, sources: list[Any] | None) -> str:
+        """Build a compact prompt text from filt
```

**File**: `src/memos/mem_scheduler/task_schedule_modules/handlers/mem_read_handler.py` (modified, +2/-2)
```diff
@@ -179,8 +179,8 @@ def _process_memories_with_reader(
                     is_upload_skill=is_upload_skill,
                 )
             except Exception as e:
-                logger.warning("%s: Fail to transfer mem: %s", e, memory_items)
-                processed_memories = []
+                logger.warning("%s: Fail to transfer mem: %s", e, memory_items, exc_info=True)
+                return
 
             if processed_memories and len(processed_memories) > 0:
                 flattened_memories = []
```

**File**: `src/memos/templates/prefer_complete_prompt.py` (modified, +46/-32)
```diff
@@ -1,22 +1,28 @@
 NAIVE_EXPLICIT_PREFERENCE_EXTRACT_PROMPT = """
 You are a preference extraction assistant.
-Please extract the user's explicitly mentioned preferences from the following conversation.
-
-Notes:
-- A preference means the user's own explicit, relatively stable, and reusable attitude, choice, constraint, or habit. It should be useful for future interactions, recommendations, or personalization.
-- A single user statement can be enough for an explicit preference when the user clearly states a personal preference or a future handling rule; repeated behavior is not required for explicit preferences.
-- Words like "like/dislike/want/don't want/prefer" are helpful signals, but a current task request, information-seeking question, temporary state, or safety/factual concern is not a preference by itself.
-- Expressions scoped to the current moment or task, such as "now", "today", "this time", "this document", "this task", or "current", are scope cues rather than automatic exclusions. Treat them as one-off needs unless the user also states a reusable personal preference or a future handling rule, such as "from now on", "in the future", "every time", "always", or "use this going forward".
-- Focus on preferences stated by the user. Do not turn assistant advice, search suggestions, safety guidance, factual explanations, or answer content into user preferences unless the user explicitly endorses them as their own reusable choice.
-- When the user modifies or updates their preferences for the same topic or event, extract the complete evolution process of their preference changes, including both the original and updated preferences.
+Extract the preferences explicitly stated by the user from the input below.
+
+Preference criteria:
+- A preference is a relatively stable and reusable attitude, choice, constraint, or habit explicitly expressed by the user. It should be useful in future interactions, recommendations, or personalization.
+- One clear user statement is sufficient for an explicit preference. Repeated behavior is not required when the user directly states a personal preference or a rule for future interactions.
+- Words such as "like", "dislike", "want", "do not want", and "prefer" are useful signals, but a current task request, information-seeking question, temporary state, or safety or factual concern is not a preference by itself.
+- Extract only preferences that can reasonably be reused in future interactions. Temporary requirements, execution parameters, and one-off needs that apply only to the current request, task, or material are not preferences. Reusability depends on the scope expressed by the user, rather than how many times it appears in the conversation.
+- When the user modifies or updates a preference about the same topic or event, capture the complete evolution, including both the original and updated preferences.
+- When the user explicitly expresses a reusable endorsement, rejection, or choice in response to Agent or Assistant content, use only the user's own statement as preference evidence.
+
+Source attribution:
+- The input may be a conversation or a record of interactions between a user and an Agent.
+- Extract preferences only from content that can be clearly attributed to the user personally.
+- Ignore Agent or Assistant output and any context injected, retrieved, or generated during Agent execution, such as historical memories, tool calls, and tool results. Such content is not a user statement, even if it is wrapped in a user message.
+- If the source of content cannot be determined reliably, do not use it to extract preferences.
 
 Requirements:
-1. Keep only the preferences explicitly mentioned by the user and reasonably reusable beyond the current turn. Do not infer or assume. If the user mentions reasons for their preferences, include those reasons as well.
-2. Output should be a list of concise natural language summaries and the corresponding context summary. The context summary should preserve the evidence for the user's preference, without rewriting assistant-only content as if it were the user's preference.
-3. If multiple preferences are mentioned within the same topic or domain, you MUST combine them into a single entry, keep each entry information complete. Different topics of preferences should be divided into multiple entries.
-4. If no explicit preference can be reasonably extracted, return [].
+1. Do not infer or assume preferences that the user did not explicitly state. If the user explains the reason for a preference, include that reason.
+2. Return a list of concise preference summaries with their corresponding context summaries. Each context summary must preserve the user-side evidence and must not rewrite non-user content as a user preference.
+3. Combine multiple preferences from the same topic or domain into one complete entry. Use separate entries for different topics.
+4. If no explicit preference can be reasonably extracted, return `[]`.
 
-Con
```

**File**: `tests/mem_reader/test_preference_prompt.py` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+import pytest
+
+from memos.templates.prefer_complete_prompt import (
+    NAIVE_EXPLICIT_PREFERENCE_EXTRACT_PROMPT,
+    NAIVE_EXPLICIT_PREFERENCE_EXTRACT_PROMPT_ZH,
+    NAIVE_IMPLICIT_PREFERENCE_EXTRACT_PROMPT,
+    NAIVE_IMPLICIT_PREFERENCE_EXTRACT_PROMPT_ZH,
+)
+
+
+@pytest.mark.parametrize(
+    ("prompt", "source_constraint", "scope_constraint"),
+    [
+        (
+            NAIVE_EXPLICIT_PREFERENCE_EXTRACT_PROMPT,
+            "even if it is wrapped in a user message",
+            "rather than how many times it appears in the conversation",
+        ),
+        (
+            NAIVE_EXPLICIT_PREFERENCE_EXTRACT_PROMPT_ZH,
+            "即使这些内容被包装在 user 消息中",
+            "而不是其在对话中出现的次数",
+        ),
+        (
+            NAIVE_IMPLICIT_PREFERENCE_EXTRACT_PROMPT,
+            "even if it is wrapped in a user message",
+            "Temporary requirements, execution parameters, and one-off needs",
+        ),
+        (
+            NAIVE_IMPLICIT_PREFERENCE_EXTRACT_PROMPT_ZH,
+            "即使这些内容被包装在 user 消息中",
+            "临时要求、执行参数和一次性需求",
+        ),
+    ],
+)
+def test_preference_prompts_include_source_and_scope_constraints(
+    prompt: str,
+    source_constraint: str,
+    scope_constraint: str,
+):
+    assert source_constraint in prompt
+    assert scope_constraint in prompt
```

**File**: `tests/mem_reader/test_source_filter.py` (added, +159/-0)
```diff
@@ -0,0 +1,159 @@
+import json
+
+from memos.mem_reader.read_pref_memory.process_preference_memory import process_preference_fine
+from memos.mem_reader.source_filter import MemorySourceFilter
+from memos.memories.textual.item import (
+    SourceMessage,
+    TextualMemoryItem,
+    TreeNodeTextualMemoryMetadata,
+)
+
+
+class DummyLLM:
+    def __init__(self):
+        self.prompts = []
+
+    def generate(self, messages):
+        prompt = messages[0]["content"]
+        self.prompts.append(prompt)
+        if "显式偏好" in prompt:
+            return json.dumps(
+                [
+                    {
+                        "explicit_preference": "用户偏好简洁回答",
+                        "context_summary": "用户要求后续回答简洁。",
+                        "reasoning": "用户明确提出简洁要求。",
+                        "topic": "answer_style",
+                    }
+                ],
+                ensure_ascii=False,
+            )
+        return "[]"
+
+
+class DummyEmbedder:
+    def embed(self, texts):
+        return [[0.1, 0.2, 0.3] for _ in texts]
+
+
+def make_fast_item(sources):
+    return TextualMemoryItem(
+        memory="\n".join(source.content or "" for source in sources),
+        metadata=TreeNodeTextualMemoryMetadata(
+            user_id="user-1",
+            session_id="session-1",
+            memory_type="LongTermMemory",
+            sources=sources,
+        ),
+    )
+
+
+def test_preference_source_filter_drops_assistant_sources():
+    source_filter = MemorySourceFilter()
+    sources = [
+        SourceMessage(type="chat", role="assistant", content="用户喜欢复杂长文。"),
+        SourceMessage(type="chat", role="user", content="以后回答简洁一点。"),
+    ]
+
+    filtered = source_filter.filter_for_preference(sources)
+
+    assert [source.content for source in filtered] == ["以后回答简洁一点。"]
+
+
+def test_preference_source_filter_extracts_user_message_from_xiaoyi_context():
+    source_filter = MemorySourceFilter()
+    source = SourceMessage(
+        type="chat",
+        role="user",
+        content=(
+            "# 以下内容是基于用户发送的消息的搜索结果：# 搜索结果正文 "
+            "# 以下是可能和用户问题关联的对话记忆 "
+            "偏好：用户喜欢长文 "
+            "# 小依大模型的思考过程：模型计划写一篇文章 "
+            "# 用户消息为：请从资深教育工作者角度分析这个故事。"
+        ),
+    )
+
+    filtered = source_filter.filter_for_preference([source])
+
+    assert len(filtered) == 1
+    assert filtered[0].content == "请从资深教育工作者角度分析这个故事。"
+
+
+def test_preference_source_filter_keeps_plain_content_with_generic_phrases():
+    source_filter = MemorySourceFilter()
+    contents = [
+        "请总结联网搜索到的资料，并保留搜索素材标题。",
+        "我正在研究大模型的思考过程和 HEARTBEAT.md。",
+        "在回答时，请注意以下几点：以后都用中文。",
+        "当前时间: 2026-08-24，以后提醒时使用北京时间。",
+        "Exec failed 是什么意思？",
+        "“可能和用户问题关联的对话记忆”这个字段是什么意思？",
+        "对话记忆分为事实和偏好，这种设计合理吗？",
+    ]
+    sources = [SourceMessage(type="chat", role="user", content=content) for content in contents]
+
+    filtered = source_filter.filter_for_preference(sources)
+
+    assert [source.content for source in filtered] == contents
+
+
+def test_preference_source_filter_drops_context_without_user_boundary():
+    source_filter = MemorySourceFilter()
+    source = SourceMessage(
+        type="chat",
+        role="user",
+        content="# 以下内容是基于用户发送的消息的搜索结果：# 搜索结果正文",
+    )
+
+    assert source_filter.filter_for_preference([source]) == []
+
+
+def test_preference_source_filter_drops_cron_sources():
+    source_filter = MemorySourceFilter()
+    source = SourceMessage(
+        type="chat",
+        role="user",
+        content="[cron:abc] 每天早上提醒用户吃早餐。",
+    )
+
+    assert source_filter.filter_for_preference([source]) == []
+
+
+def test_preference_source_filter_coerces_numeric_message_id():
+    source_filter = MemorySourceFilter()
+    source = {
+        "type": "chat",
+        "role": "user",
+        "message_id": 123,
+        "content": "以后回答简洁一点。",
+    }
+
+    filtered = source_filter.filter_for_preference([source])
+
+    assert len(filtered) == 1
+    assert filtered[0].message_id == "123"
+
+
+def test_process_preference_fine_uses_filtered_sources(monkeypatch):
+    monkeypatch.setenv("ENABLE_PREFERENCE_MEMORY", "true")
+    llm = DummyLLM()
+    embedder = DummyEmbedder()
+    sources = [
+        SourceMessage(type="chat", role="assistant", content="用户喜欢复杂长文。"),
+        SourceMessage(type="chat", role="user", content="以后回答简洁一点。"),
+    ]
+    fast_item = make_fast_item(sources)
+
+    memories = process_preference_fine(
+        [fast_item],
+        {"user_id": "user-1", "session_id": "session-1"},
+        llm,
+        embedder,
+    )
+
+    assert len(memories) == 1
+    assert memories[0].metadata.preference == "用户偏好简洁回答"
+    assert [source.content for source in memories[0].metadata.sources] == ["以后回答简洁一点。"]
+    assert any("以后回答简洁一点。" in prompt for prompt in llm.prompts)
+    assert all("用户喜欢复杂长文" not in prompt for prompt in llm.prompts)
```

---

### Incident Patch 15: `cc244f44` (2026-09-03)
**Commit Message**: Preference memory fixes (#2337)

* fix: preserve fast memories when async fine extraction fails

* fix: filter polluted sources before preference extraction

* fix: refine preference extraction prompts

**File**: `src/memos/mem_reader/read_pref_memory/process_preference_memory.py` (modified, +46/-9)
```diff
@@ -10,7 +10,12 @@
 from memos.context.context import ContextThreadPoolExecutor
 from memos.log import get_logger
 from memos.mem_reader.read_multi_modal import detect_lang
-from memos.memories.textual.item import TextualMemoryItem, TreeNodeTextualMemoryMetadata
+from memos.mem_reader.source_filter import MemorySourceFilter
+from memos.memories.textual.item import (
+    SourceMessage,
+    TextualMemoryItem,
+    TreeNodeTextualMemoryMetadata,
+)
 from memos.templates.prefer_complete_prompt import (
     NAIVE_EXPLICIT_PREFERENCE_EXTRACT_PROMPT,
     NAIVE_EXPLICIT_PREFERENCE_EXTRACT_PROMPT_ZH,
@@ -100,6 +105,7 @@ def _create_preference_memory_item(
     fast_item: TextualMemoryItem | None,
     info: dict[str, Any],
     embedder,
+    sources_override: list[SourceMessage] | None = None,
     **kwargs,
 ) -> TextualMemoryItem:
     """
@@ -133,7 +139,13 @@ def _create_preference_memory_item(
     embedding = embedder.embed([context_summary])[0] if embedder and context_summary else None
 
     # Extract sources from fast_item
-    sources = getattr(fast_item.metadata, "sources", []) if fast_item else []
+    sources = (
+        sources_override
+        if sources_override is not None
+        else getattr(fast_item.metadata, "sources", [])
+        if fast_item
+        else []
+    )
 
     # Create metadata
     metadata = TreeNodeTextualMemoryMetadata(
@@ -168,6 +180,7 @@ def _process_single_chunk_explicit(
     info: dict[str, Any],
     llm,
     embedder,
+    sources_override: list[SourceMessage] | None = None,
     **kwargs,
 ) -> list[TextualMemoryItem]:
     """Process a single chunk for explicit preferences."""
@@ -190,6 +203,7 @@ def _process_single_chunk_explicit(
             fast_item=fast_item,
             info=info,
             embedder=embedder,
+            sources_override=sources_override,
             **kwargs,
         )
         memories.append(memory)
@@ -203,6 +217,7 @@ def _process_single_chunk_implicit(
     info: dict[str, Any],
     llm,
     embedder,
+    sources_override: list[SourceMessage] | None = None,
     **kwargs,
 ) -> list[TextualMemoryItem]:
     """Process a single chunk for implicit preferences."""
@@ -225,6 +240,7 @@ def _process_single_chunk_implicit(
             fast_item=fast_item,
             info=info,
             embedder=embedder,
+            sources_override=sources_override,
             **kwargs,
         )
         memories.append(memory)
@@ -260,13 +276,20 @@ def process_preference_fine(
         return []
 
     try:
-        # Convert fast_memory_items to messages format
+        # Convert fast_memory_items to source-filtered messages format
+        source_filter = MemorySourceFilter()
         chunks = []
         for fast_item in fast_memory_items:
-            mem_str = fast_item.memory or ""
+            raw_sources = getattr(fast_item.metadata, "sources", None)
+            if raw_sources:
+                filtered_sources = source_filter.filter_for_preference(raw_sources)
+                mem_str = source_filter.sources_to_prompt_text(filtered_sources)
+            else:
+                filtered_sources = None
+                mem_str = fast_item.memory or ""
             if not mem_str.strip():
                 continue
-            chunks.append((mem_str, fast_item))
+            chunks.append((mem_str, fast_item, filtered_sources))
 
         if not chunks:
             return []
@@ -277,16 +300,30 @@ def process_preference_fine(
             futures = {}
 
             # Submit explicit extraction tasks
-            for chunk, fast_item in chunks:
+            for chunk, fast_item, filtered_sources in chunks:
                 future = executor.submit(
-                    _process_single_chunk_explicit, chunk, fast_item, info, llm, embedder, **kwargs
+                    _process_single_chunk_explicit,
+                    chunk,
+                    fast_item,
+                    info,
+                    llm,
+                    embedder,
+                    filtered_sources,
+                    **kwargs,
                 )
                 futures[future] = ("explicit_preference", chunk)
 
             # Submit implicit extraction tasks
-            for chunk, fast_item in chunks:
+            for chunk, fast_item, filtered_sources in chunks:
                 future = executor.submit(
-                    _process_single_chunk_implicit, chunk, fast_item, info, llm, embedder, **kwargs
+                    _process_single_chunk_implicit,
+                    chunk,
+                    fast_item,
+                    info,
+                    llm,
+                    embedder,
+                    filtered_sources,
+                    **kwargs,
                 )
                 futures[future] = ("implicit_preference", chunk)
 
```

**File**: `src/memos/mem_reader/source_filter.py` (added, +228/-0)
```diff
@@ -0,0 +1,228 @@
+"""Source filters shared by memory extraction steps."""
+
+from __future__ import annotations
+
+import re
+
+from dataclasses import dataclass
+from typing import Any, Literal
+
+from memos.memories.textual.item import SourceMessage
+
+
+SourceFilterAction = Literal[
+    "extract_after_last",
+    "strip_after_first",
+    "drop_if_present",
+    "drop_if_prefix",
+]
+
+
+@dataclass(frozen=True)
+class SourceFilterRule:
+    name: str
+    action: SourceFilterAction
+    patterns: tuple[re.Pattern[str], ...]
+
+
+@dataclass(frozen=True)
+class SourceFilterPolicy:
+    allowed_roles: frozenset[str]
+    blocked_roles: frozenset[str]
+    blocked_source_types: frozenset[str]
+    rules: tuple[SourceFilterRule, ...]
+
+
+def _patterns(*values: str, flags: int = 0) -> tuple[re.Pattern[str], ...]:
+    return tuple(re.compile(value, flags) for value in values)
+
+
+PREFERENCE_SOURCE_POLICY = SourceFilterPolicy(
+    allowed_roles=frozenset({"user"}),
+    blocked_roles=frozenset({"assistant", "system", "tool"}),
+    blocked_source_types=frozenset({"tool"}),
+    rules=(
+        SourceFilterRule(
+            name="user_query_boundary",
+            action="extract_after_last",
+            patterns=_patterns(
+                r"(?im)(?:^|[ \t])#{1,3}[ \t]*用户(?:的)?(?:消息|问题)(?:为|是)?[ \t]*[：:]",
+                r"user\u200b原\u200b始\u200bquery\u200b：\u200b\u200b\u200b\u200b",
+                r"(?im)(?:^|[ \t])#{1,3}[ \t]*user[ \t]*原始[ \t]*query[ \t]*[：:]",
+            ),
+        ),
+        SourceFilterRule(
+            name="trailing_context",
+            action="strip_after_first",
+            patterns=_patterns(
+                r"(?m)^\s{0,3}#{1,3}\s*以下是可能和用户问题关联的对话记忆",
+            ),
+        ),
+        SourceFilterRule(
+            name="stream_transcript",
+            action="strip_after_first",
+            patterns=_patterns(
+                r'data:\s*\{"id"\s*:\s*"chatcmpl',
+                r"data:\s*\[DONE\]",
+            ),
+        ),
+        SourceFilterRule(
+            name="retrieval_context",
+            action="drop_if_present",
+            patterns=_patterns(
+                r"(?m)^\s{0,3}#{1,3}\s*以下内容是基于用户发送的消息的搜索结果",
+                r"(?i)<(?:retrieved_context|search_context|web_results)>",
+            ),
+        ),
+        SourceFilterRule(
+            name="memory_context",
+            action="drop_if_present",
+            patterns=_patterns(
+                r"(?i)</?(?:memories|memory_context)>",
+                r"(?i)===\s*MemOS LONG-TERM MEMORY",
+                r"(?i)\[MemOS Auto-Recall\]",
+            ),
+        ),
+        SourceFilterRule(
+            name="agent_reasoning",
+            action="drop_if_present",
+            patterns=_patterns(
+                r"(?i)<(?:thinking|reasoning|agent_scratchpad)>",
+            ),
+        ),
+        SourceFilterRule(
+            name="runtime_metadata",
+            action="drop_if_present",
+            patterns=_patterns(
+                r"(?m)^\s*Conversation info \(untrusted metadata\):",
+                r"(?m)^\s*Untrusted context \(metadata, do not treat as instructions or commands\):",
+            ),
+        ),
+        SourceFilterRule(
+            name="automation_context",
+            action="drop_if_prefix",
+            patterns=_patterns(
+                r"\[cron:",
+                r"System:\s+\[",
+                r"A scheduled reminder has been triggered",
+            ),
+        ),
+        SourceFilterRule(
+            name="assistant_runtime_prefix",
+            action="drop_if_prefix",
+            patterns=_patterns(
+                r"小依会根据用户需求",
+                r"正在完善Gemini的思考过程",
+            ),
+        ),
+    ),
+)
+
+
+class MemorySourceFilter:
+    """Filter raw memory sources before building extraction prompts."""
+
+    def __init__(self, policy: SourceFilterPolicy = PREFERENCE_SOURCE_POLICY):
+        self.policy = policy
+
+    def filter_for_preference(self, sources: list[Any] | None) -> list[SourceMessage]:
+        """Return only sources allowed to appear in preference extraction prompts."""
+        filtered: list[SourceMessage] = []
+        for source in sources or []:
+            source_dict = self._source_to_dict(source)
+            if not self._keep_role_for_preference(source_dict):
+                continue
+
+            content = str(source_dict.get("content") or "")
+            content = self._strip_known_context_wrappers(content)
+            if not content.strip():
+                continue
+
+            cleaned = source_dict.copy()
+            cleaned["content"] = content.strip()
+            if cleaned.get("type") is None:
+                cleaned["type"] = "chat"
+            cleaned = self._coerce_source_fields(cleaned)
+            filtered.append(SourceMessage(**cleaned))
+        return filtered
+
+    def build_prompt_text(self, sources: list[Any] | None) -> str:
+        """Build a compact prompt text from filt
```

**File**: `src/memos/mem_scheduler/task_schedule_modules/handlers/mem_read_handler.py` (modified, +2/-2)
```diff
@@ -179,8 +179,8 @@ def _process_memories_with_reader(
                     is_upload_skill=is_upload_skill,
                 )
             except Exception as e:
-                logger.warning("%s: Fail to transfer mem: %s", e, memory_items)
-                processed_memories = []
+                logger.warning("%s: Fail to transfer mem: %s", e, memory_items, exc_info=True)
+                return
 
             if processed_memories and len(processed_memories) > 0:
                 flattened_memories = []
```

**File**: `src/memos/templates/prefer_complete_prompt.py` (modified, +46/-32)
```diff
@@ -1,22 +1,28 @@
 NAIVE_EXPLICIT_PREFERENCE_EXTRACT_PROMPT = """
 You are a preference extraction assistant.
-Please extract the user's explicitly mentioned preferences from the following conversation.
-
-Notes:
-- A preference means the user's own explicit, relatively stable, and reusable attitude, choice, constraint, or habit. It should be useful for future interactions, recommendations, or personalization.
-- A single user statement can be enough for an explicit preference when the user clearly states a personal preference or a future handling rule; repeated behavior is not required for explicit preferences.
-- Words like "like/dislike/want/don't want/prefer" are helpful signals, but a current task request, information-seeking question, temporary state, or safety/factual concern is not a preference by itself.
-- Expressions scoped to the current moment or task, such as "now", "today", "this time", "this document", "this task", or "current", are scope cues rather than automatic exclusions. Treat them as one-off needs unless the user also states a reusable personal preference or a future handling rule, such as "from now on", "in the future", "every time", "always", or "use this going forward".
-- Focus on preferences stated by the user. Do not turn assistant advice, search suggestions, safety guidance, factual explanations, or answer content into user preferences unless the user explicitly endorses them as their own reusable choice.
-- When the user modifies or updates their preferences for the same topic or event, extract the complete evolution process of their preference changes, including both the original and updated preferences.
+Extract the preferences explicitly stated by the user from the input below.
+
+Preference criteria:
+- A preference is a relatively stable and reusable attitude, choice, constraint, or habit explicitly expressed by the user. It should be useful in future interactions, recommendations, or personalization.
+- One clear user statement is sufficient for an explicit preference. Repeated behavior is not required when the user directly states a personal preference or a rule for future interactions.
+- Words such as "like", "dislike", "want", "do not want", and "prefer" are useful signals, but a current task request, information-seeking question, temporary state, or safety or factual concern is not a preference by itself.
+- Extract only preferences that can reasonably be reused in future interactions. Temporary requirements, execution parameters, and one-off needs that apply only to the current request, task, or material are not preferences. Reusability depends on the scope expressed by the user, rather than how many times it appears in the conversation.
+- When the user modifies or updates a preference about the same topic or event, capture the complete evolution, including both the original and updated preferences.
+- When the user explicitly expresses a reusable endorsement, rejection, or choice in response to Agent or Assistant content, use only the user's own statement as preference evidence.
+
+Source attribution:
+- The input may be a conversation or a record of interactions between a user and an Agent.
+- Extract preferences only from content that can be clearly attributed to the user personally.
+- Ignore Agent or Assistant output and any context injected, retrieved, or generated during Agent execution, such as historical memories, tool calls, and tool results. Such content is not a user statement, even if it is wrapped in a user message.
+- If the source of content cannot be determined reliably, do not use it to extract preferences.
 
 Requirements:
-1. Keep only the preferences explicitly mentioned by the user and reasonably reusable beyond the current turn. Do not infer or assume. If the user mentions reasons for their preferences, include those reasons as well.
-2. Output should be a list of concise natural language summaries and the corresponding context summary. The context summary should preserve the evidence for the user's preference, without rewriting assistant-only content as if it were the user's preference.
-3. If multiple preferences are mentioned within the same topic or domain, you MUST combine them into a single entry, keep each entry information complete. Different topics of preferences should be divided into multiple entries.
-4. If no explicit preference can be reasonably extracted, return [].
+1. Do not infer or assume preferences that the user did not explicitly state. If the user explains the reason for a preference, include that reason.
+2. Return a list of concise preference summaries with their corresponding context summaries. Each context summary must preserve the user-side evidence and must not rewrite non-user content as a user preference.
+3. Combine multiple preferences from the same topic or domain into one complete entry. Use separate entries for different topics.
+4. If no explicit preference can be reasonably extracted, return `[]`.
 
-Con
```

**File**: `tests/mem_reader/test_preference_prompt.py` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+import pytest
+
+from memos.templates.prefer_complete_prompt import (
+    NAIVE_EXPLICIT_PREFERENCE_EXTRACT_PROMPT,
+    NAIVE_EXPLICIT_PREFERENCE_EXTRACT_PROMPT_ZH,
+    NAIVE_IMPLICIT_PREFERENCE_EXTRACT_PROMPT,
+    NAIVE_IMPLICIT_PREFERENCE_EXTRACT_PROMPT_ZH,
+)
+
+
+@pytest.mark.parametrize(
+    ("prompt", "source_constraint", "scope_constraint"),
+    [
+        (
+            NAIVE_EXPLICIT_PREFERENCE_EXTRACT_PROMPT,
+            "even if it is wrapped in a user message",
+            "rather than how many times it appears in the conversation",
+        ),
+        (
+            NAIVE_EXPLICIT_PREFERENCE_EXTRACT_PROMPT_ZH,
+            "即使这些内容被包装在 user 消息中",
+            "而不是其在对话中出现的次数",
+        ),
+        (
+            NAIVE_IMPLICIT_PREFERENCE_EXTRACT_PROMPT,
+            "even if it is wrapped in a user message",
+            "Temporary requirements, execution parameters, and one-off needs",
+        ),
+        (
+            NAIVE_IMPLICIT_PREFERENCE_EXTRACT_PROMPT_ZH,
+            "即使这些内容被包装在 user 消息中",
+            "临时要求、执行参数和一次性需求",
+        ),
+    ],
+)
+def test_preference_prompts_include_source_and_scope_constraints(
+    prompt: str,
+    source_constraint: str,
+    scope_constraint: str,
+):
+    assert source_constraint in prompt
+    assert scope_constraint in prompt
```

**File**: `tests/mem_reader/test_source_filter.py` (added, +159/-0)
```diff
@@ -0,0 +1,159 @@
+import json
+
+from memos.mem_reader.read_pref_memory.process_preference_memory import process_preference_fine
+from memos.mem_reader.source_filter import MemorySourceFilter
+from memos.memories.textual.item import (
+    SourceMessage,
+    TextualMemoryItem,
+    TreeNodeTextualMemoryMetadata,
+)
+
+
+class DummyLLM:
+    def __init__(self):
+        self.prompts = []
+
+    def generate(self, messages):
+        prompt = messages[0]["content"]
+        self.prompts.append(prompt)
+        if "显式偏好" in prompt:
+            return json.dumps(
+                [
+                    {
+                        "explicit_preference": "用户偏好简洁回答",
+                        "context_summary": "用户要求后续回答简洁。",
+                        "reasoning": "用户明确提出简洁要求。",
+                        "topic": "answer_style",
+                    }
+                ],
+                ensure_ascii=False,
+            )
+        return "[]"
+
+
+class DummyEmbedder:
+    def embed(self, texts):
+        return [[0.1, 0.2, 0.3] for _ in texts]
+
+
+def make_fast_item(sources):
+    return TextualMemoryItem(
+        memory="\n".join(source.content or "" for source in sources),
+        metadata=TreeNodeTextualMemoryMetadata(
+            user_id="user-1",
+            session_id="session-1",
+            memory_type="LongTermMemory",
+            sources=sources,
+        ),
+    )
+
+
+def test_preference_source_filter_drops_assistant_sources():
+    source_filter = MemorySourceFilter()
+    sources = [
+        SourceMessage(type="chat", role="assistant", content="用户喜欢复杂长文。"),
+        SourceMessage(type="chat", role="user", content="以后回答简洁一点。"),
+    ]
+
+    filtered = source_filter.filter_for_preference(sources)
+
+    assert [source.content for source in filtered] == ["以后回答简洁一点。"]
+
+
+def test_preference_source_filter_extracts_user_message_from_xiaoyi_context():
+    source_filter = MemorySourceFilter()
+    source = SourceMessage(
+        type="chat",
+        role="user",
+        content=(
+            "# 以下内容是基于用户发送的消息的搜索结果：# 搜索结果正文 "
+            "# 以下是可能和用户问题关联的对话记忆 "
+            "偏好：用户喜欢长文 "
+            "# 小依大模型的思考过程：模型计划写一篇文章 "
+            "# 用户消息为：请从资深教育工作者角度分析这个故事。"
+        ),
+    )
+
+    filtered = source_filter.filter_for_preference([source])
+
+    assert len(filtered) == 1
+    assert filtered[0].content == "请从资深教育工作者角度分析这个故事。"
+
+
+def test_preference_source_filter_keeps_plain_content_with_generic_phrases():
+    source_filter = MemorySourceFilter()
+    contents = [
+        "请总结联网搜索到的资料，并保留搜索素材标题。",
+        "我正在研究大模型的思考过程和 HEARTBEAT.md。",
+        "在回答时，请注意以下几点：以后都用中文。",
+        "当前时间: 2026-08-24，以后提醒时使用北京时间。",
+        "Exec failed 是什么意思？",
+        "“可能和用户问题关联的对话记忆”这个字段是什么意思？",
+        "对话记忆分为事实和偏好，这种设计合理吗？",
+    ]
+    sources = [SourceMessage(type="chat", role="user", content=content) for content in contents]
+
+    filtered = source_filter.filter_for_preference(sources)
+
+    assert [source.content for source in filtered] == contents
+
+
+def test_preference_source_filter_drops_context_without_user_boundary():
+    source_filter = MemorySourceFilter()
+    source = SourceMessage(
+        type="chat",
+        role="user",
+        content="# 以下内容是基于用户发送的消息的搜索结果：# 搜索结果正文",
+    )
+
+    assert source_filter.filter_for_preference([source]) == []
+
+
+def test_preference_source_filter_drops_cron_sources():
+    source_filter = MemorySourceFilter()
+    source = SourceMessage(
+        type="chat",
+        role="user",
+        content="[cron:abc] 每天早上提醒用户吃早餐。",
+    )
+
+    assert source_filter.filter_for_preference([source]) == []
+
+
+def test_preference_source_filter_coerces_numeric_message_id():
+    source_filter = MemorySourceFilter()
+    source = {
+        "type": "chat",
+        "role": "user",
+        "message_id": 123,
+        "content": "以后回答简洁一点。",
+    }
+
+    filtered = source_filter.filter_for_preference([source])
+
+    assert len(filtered) == 1
+    assert filtered[0].message_id == "123"
+
+
+def test_process_preference_fine_uses_filtered_sources(monkeypatch):
+    monkeypatch.setenv("ENABLE_PREFERENCE_MEMORY", "true")
+    llm = DummyLLM()
+    embedder = DummyEmbedder()
+    sources = [
+        SourceMessage(type="chat", role="assistant", content="用户喜欢复杂长文。"),
+        SourceMessage(type="chat", role="user", content="以后回答简洁一点。"),
+    ]
+    fast_item = make_fast_item(sources)
+
+    memories = process_preference_fine(
+        [fast_item],
+        {"user_id": "user-1", "session_id": "session-1"},
+        llm,
+        embedder,
+    )
+
+    assert len(memories) == 1
+    assert memories[0].metadata.preference == "用户偏好简洁回答"
+    assert [source.content for source in memories[0].metadata.sources] == ["以后回答简洁一点。"]
+    assert any("以后回答简洁一点。" in prompt for prompt in llm.prompts)
+    assert all("用户喜欢复杂长文" not in prompt for prompt in llm.prompts)
```

**File**: `tests/mem_scheduler/test_mem_read_handler_fast_cleanup.py` (added, +100/-0)
```diff
@@ -0,0 +1,100 @@
+from __future__ import annotations
+
+from types import SimpleNamespace
+from unittest.mock import MagicMock
+
+
+def _make_text_item(item_id: str, memory: str):
+    metadata = SimpleNamespace(
+        memory_type="LongTermMemory",
+        info={},
+        key=None,
+        status="activated",
+        confidence=0.9,
+        tags=[],
+    )
+    return SimpleNamespace(id=item_id, memory=memory, metadata=metadata)
+
+
+class _FakeTextMem:
+    def __init__(self, items):
+        self._items = {item.id: item for item in items}
+        self.delete_calls: list = []
+        self.soft_delete_calls: list = []
+        self.memory_manager = SimpleNamespace(
+            reorganizer=None,
+            remove_and_refresh_memory=lambda **kwargs: None,
+        )
+
+    def get(self, mem_id, user_name=None):
+        return self._items[mem_id]
+
+    def delete(self, ids, user_name=None):
+        self.delete_calls.append((list(ids), user_name))
+
+    def soft_delete(self, *args, **kwargs):
+        self.soft_delete_calls.append((args, kwargs))
+
+
+def _build_handler(*, memory_version_switch: str):
+    from memos.mem_scheduler.task_schedule_modules.handlers.mem_read_handler import (
+        MemReadMessageHandler,
+    )
+
+    raw_item = _make_text_item("raw_1", "raw chunk")
+    text_mem = _FakeTextMem([raw_item])
+    mem_cube = SimpleNamespace(text_mem=text_mem)
+
+    mem_reader = MagicMock()
+    mem_reader.fine_transfer_simple_mem.side_effect = RuntimeError("fine extraction failed")
+    mem_reader.memory_version_switch = memory_version_switch
+    mem_reader.graph_db = None
+    mem_reader.save_rawfile = False
+
+    services = SimpleNamespace(
+        create_event_log=lambda **kwargs: SimpleNamespace(**kwargs),
+        submit_web_logs=lambda events, **kwargs: None,
+        map_memcube_name=lambda mem_cube_id: "UserMemCube",
+        submit_messages=lambda messages: None,
+    )
+    scheduler_context = SimpleNamespace(
+        get_mem_cube=lambda: mem_cube,
+        get_mem_reader=lambda: mem_reader,
+        services=services,
+    )
+
+    handler = MemReadMessageHandler.__new__(MemReadMessageHandler)
+    handler.scheduler_context = scheduler_context
+    return handler, text_mem
+
+
+def test_fine_transfer_error_does_not_delete_fast_memory():
+    handler, text_mem = _build_handler(memory_version_switch="off")
+
+    handler._process_memories_with_reader(
+        mem_ids=["raw_1"],
+        user_id="user_1",
+        mem_cube_id="cube_1",
+        text_mem=text_mem,
+        user_name="cube_1",
+        info={"trigger_source": "Messages"},
+    )
+
+    assert text_mem.delete_calls == []
+    assert text_mem.soft_delete_calls == []
+
+
+def test_fine_transfer_error_does_not_soft_delete_fast_memory_with_versions():
+    handler, text_mem = _build_handler(memory_version_switch="on")
+
+    handler._process_memories_with_reader(
+        mem_ids=["raw_1"],
+        user_id="user_1",
+        mem_cube_id="cube_1",
+        text_mem=text_mem,
+        user_name="cube_1",
+        info={"trigger_source": "Messages"},
+    )
+
+    assert text_mem.delete_calls == []
+    assert text_mem.soft_delete_calls == []
```

#### Recent Merged Pull Requests:
- **PR #2436** (2026-09-29): fix: recall playground memories from every searched cube (@Wang-Daoji)
- **PR #2406** (closed): Fix #2405: fix: DSH 0.1.7 (session format v4) rejects memos recall messages — "format v4 me (@Memtensor-AI)
- **PR #2400** (2026-09-22): ci: extend local plugin npm visibility timeout (@MLittleprince)
- **PR #2384** (2026-09-21): fix(plugin): harden memory evolution and Hermes installation (@Hun-ger)
- **PR #2376** (2026-09-16): Rebase dev-v2.0.34 (@bittergreen)
- **PR #2375** (closed): Fix #2374: [Bug] MemOS 2.0.19 untagged cluster `_|_` enters L3 abstraction pipeline and cau (@Memtensor-AI)
- **PR #2373** (2026-09-16): Dev v2.0.34 (@bittergreen)
- **PR #2371** (closed): Fix #2370: [Bug] meta.rewardDirty is re-set on episode reopen and never cleared when the ep (@Memtensor-AI)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
