/**
 * Autonomous Harvest Disk Cache
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\harvest-cache.mjs
 * Purpose: Safe, persistent local disk caching for GitHub repository metadata,
 *          directory trees, immutable commit patch diffs, closed issues, and PRs.
 * 
 * Benefits:
 * - Eliminates duplicate GitHub API calls across multiple harvest runs and parallel agents.
 * - Saves up to 80-95% of API quota on re-harvests and incremental updates.
 * - Stores files in `.project-brain/cache/` (already git-ignored).
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

export const DEFAULT_CACHE_DIR = path.join(BRAIN_ROOT, '.project-brain', 'cache');

// Default TTLs in milliseconds
export const CACHE_TTL = {
  METADATA: 24 * 60 * 60 * 1000,   // 24 hours
  ISSUES: 12 * 60 * 60 * 1000,     // 12 hours
  PRS: 12 * 60 * 60 * 1000,        // 12 hours
  TREES: Infinity,                 // Git trees by commit SHA are immutable!
  PATCHES: Infinity                // Git commit patches by full SHA are immutable!
};

// In-memory telemetry counter for performance profiling
const telemetry = {
  hits: 0,
  misses: 0,
  writes: 0,
  savedCalls: 0
};

/**
 * Ensures cache subdirectories exist
 */
function ensureCacheDir(cacheRoot, subDir) {
  const dir = path.join(cacheRoot, subDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Normalizes slug for safe filesystem naming
 */
function sanitizeKey(key) {
  return String(key).replace(/[^a-zA-Z0-9_\-\.]/g, '_').toLowerCase();
}

/**
 * Generic Cache Reader with TTL validation
 */
function readCacheFile(filePath, ttlMs = Infinity) {
  if (!fs.existsSync(filePath)) {
    telemetry.misses++;
    return null;
  }
  try {
    const stats = fs.statSync(filePath);
    const age = Math.max(0, Date.now() - stats.mtimeMs);
    if (ttlMs !== Infinity && (age >= ttlMs || ttlMs <= 0)) {
      telemetry.misses++;
      return null; // Expired
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    telemetry.hits++;
    telemetry.savedCalls++;
    return data;
  } catch (err) {
    telemetry.misses++;
    return null;
  }
}

/**
 * Generic Atomic Cache Writer
 */
function writeCacheFile(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
    telemetry.writes++;
    return true;
  } catch (err) {
    console.warn(`[CACHE WRITE ERROR] ${filePath}: ${err.message}`);
    return false;
  }
}

// -----------------------------------------------------------------------------
// REPOSITORY METADATA CACHE (TTL: 24h)
// -----------------------------------------------------------------------------
export function getCachedRepoMeta(slug, cacheRoot = DEFAULT_CACHE_DIR, ttl = CACHE_TTL.METADATA) {
  const filePath = path.join(cacheRoot, 'metadata', `${sanitizeKey(slug)}.json`);
  return readCacheFile(filePath, ttl);
}

export function setCachedRepoMeta(slug, data, cacheRoot = DEFAULT_CACHE_DIR) {
  const filePath = path.join(cacheRoot, 'metadata', `${sanitizeKey(slug)}.json`);
  return writeCacheFile(filePath, data);
}

// -----------------------------------------------------------------------------
// GIT DIRECTORY TREE CACHE (Keyed by Commit SHA - Immutable)
// -----------------------------------------------------------------------------
export function getCachedTree(commitShaOrBranch, cacheRoot = DEFAULT_CACHE_DIR, ttl = CACHE_TTL.TREES) {
  if (!commitShaOrBranch) return null;
  const isSha = /^[a-f0-9]{7,40}$/i.test(commitShaOrBranch);
  const effectiveTtl = isSha ? Infinity : 6 * 60 * 60 * 1000; // Branches re-check after 6h
  const filePath = path.join(cacheRoot, 'trees', `${sanitizeKey(commitShaOrBranch)}.json`);
  return readCacheFile(filePath, effectiveTtl);
}

export function setCachedTree(commitShaOrBranch, data, cacheRoot = DEFAULT_CACHE_DIR) {
  if (!commitShaOrBranch) return false;
  const filePath = path.join(cacheRoot, 'trees', `${sanitizeKey(commitShaOrBranch)}.json`);
  return writeCacheFile(filePath, data);
}

// -----------------------------------------------------------------------------
// COMMIT PATCH DIFF CACHE (Keyed by SHA - Immutable)
// -----------------------------------------------------------------------------
export function getCachedPatch(commitSha, cacheRoot = DEFAULT_CACHE_DIR) {
  if (!commitSha) return null;
  const filePath = path.join(cacheRoot, 'patches', `${sanitizeKey(commitSha)}.json`);
  return readCacheFile(filePath, CACHE_TTL.PATCHES);
}

export function setCachedPatch(commitSha, data, cacheRoot = DEFAULT_CACHE_DIR) {
  if (!commitSha) return false;
  const filePath = path.join(cacheRoot, 'patches', `${sanitizeKey(commitSha)}.json`);
  return writeCacheFile(filePath, data);
}

// -----------------------------------------------------------------------------
// CLOSED ISSUES & COMMENTS CACHE (TTL: 12h-24h)
// -----------------------------------------------------------------------------
export function getCachedIssueComments(slug, issueNumber, cacheRoot = DEFAULT_CACHE_DIR, ttl = CACHE_TTL.ISSUES) {
  const filePath = path.join(cacheRoot, 'issues', `${sanitizeKey(slug)}-issue-${issueNumber}-comments.json`);
  return readCacheFile(filePath, ttl);
}

export function setCachedIssueComments(slug, issueNumber, data, cacheRoot = DEFAULT_CACHE_DIR) {
  const filePath = path.join(cacheRoot, 'issues', `${sanitizeKey(slug)}-issue-${issueNumber}-comments.json`);
  return writeCacheFile(filePath, data);
}

export function getCachedIssuesList(slug, cacheRoot = DEFAULT_CACHE_DIR, ttl = CACHE_TTL.ISSUES) {
  const filePath = path.join(cacheRoot, 'issues', `${sanitizeKey(slug)}-list.json`);
  return readCacheFile(filePath, ttl);
}

export function setCachedIssuesList(slug, data, cacheRoot = DEFAULT_CACHE_DIR) {
  const filePath = path.join(cacheRoot, 'issues', `${sanitizeKey(slug)}-list.json`);
  return writeCacheFile(filePath, data);
}

// -----------------------------------------------------------------------------
// CLOSED PULL REQUESTS CACHE (TTL: 12h)
// -----------------------------------------------------------------------------
export function getCachedPRs(slug, cacheRoot = DEFAULT_CACHE_DIR, ttl = CACHE_TTL.PRS) {
  const filePath = path.join(cacheRoot, 'prs', `${sanitizeKey(slug)}-prs.json`);
  return readCacheFile(filePath, ttl);
}

export function setCachedPRs(slug, data, cacheRoot = DEFAULT_CACHE_DIR) {
  const filePath = path.join(cacheRoot, 'prs', `${sanitizeKey(slug)}-prs.json`);
  return writeCacheFile(filePath, data);
}

// -----------------------------------------------------------------------------
// TELEMETRY & STATS
// -----------------------------------------------------------------------------
export function getCacheTelemetry() {
  return { ...telemetry };
}

export function resetCacheTelemetry() {
  telemetry.hits = 0;
  telemetry.misses = 0;
  telemetry.writes = 0;
  telemetry.savedCalls = 0;
}
