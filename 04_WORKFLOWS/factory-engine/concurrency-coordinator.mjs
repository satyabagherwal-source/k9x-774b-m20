import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');
const LOCKS_DIR = path.join(BRAIN_ROOT, '.harvest-locks');
const CONTROL_PATH = path.join(BRAIN_ROOT, 'harvest-control.json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Execute command safely and return output
 */
function run(cmd, cwd = BRAIN_ROOT) {
  try {
    return execSync(cmd, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
    }).trim();
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString().trim() : '';
    throw new Error(`Command failed: ${cmd} | STDERR: ${stderr} | ${err.message}`);
  }
}

/**
 * Returns concurrency mode from harvest-control.json
 * Options: 'PARALLEL_MULTI_AGENT' (default) or 'SINGLE_AGENT_MUTEX'
 */
export function getConcurrencyMode() {
  if (!fs.existsSync(CONTROL_PATH)) return 'PARALLEL_MULTI_AGENT';
  try {
    const data = JSON.parse(fs.readFileSync(CONTROL_PATH, 'utf-8'));
    return data.concurrencyMode || 'PARALLEL_MULTI_AGENT';
  } catch (e) {
    return 'PARALLEL_MULTI_AGENT';
  }
}

/**
 * Ensures locks directory exists
 */
function ensureLocksDir() {
  if (!fs.existsSync(LOCKS_DIR)) {
    fs.mkdirSync(LOCKS_DIR, { recursive: true });
  }
}

/**
 * Generates an Agent Identifier if not provided
 */
export function generateAgentId(prefix = 'agent') {
  return `${prefix}-${process.pid}-${Date.now().toString(36)}`;
}

/**
 * Target-level Distributed Lock:
 * Prevents multiple agents from harvesting the same repository simultaneously.
 */
export function acquireTargetLock(targetKey, agentId = generateAgentId(), ttlMinutes = 30) {
  ensureLocksDir();
  const safeSlug = targetKey.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const lockFile = path.join(LOCKS_DIR, `${safeSlug}.lock`);

  // Check if global mutex is in effect
  const mode = getConcurrencyMode();
  const globalLockFile = path.join(LOCKS_DIR, 'global-mutex.lock');

  if (mode === 'SINGLE_AGENT_MUTEX') {
    if (fs.existsSync(globalLockFile)) {
      try {
        const globalData = JSON.parse(fs.readFileSync(globalLockFile, 'utf-8'));
        if (Date.now() < globalData.expiresAt && globalData.agentId !== agentId) {
          return {
            acquired: false,
            reason: `GLOBAL_MUTEX_LOCKED_BY_${globalData.agentId}`,
            holder: globalData.agentId
          };
        }
      } catch (e) {}
    }
  }

  // Check target lock
  if (fs.existsSync(lockFile)) {
    try {
      const lockData = JSON.parse(fs.readFileSync(lockFile, 'utf-8'));
      if (Date.now() < lockData.expiresAt && lockData.agentId !== agentId) {
        return {
          acquired: false,
          reason: 'TARGET_LOCKED_BY_ANOTHER_AGENT',
          holder: lockData.agentId,
          expiresAt: new Date(lockData.expiresAt).toISOString()
        };
      }
      // If expired, clean it up
      fs.unlinkSync(lockFile);
    } catch (e) {}
  }

  // Write Lock
  const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
  const lockPayload = {
    target: targetKey,
    agentId,
    acquiredAt: new Date().toISOString(),
    expiresAt,
    ttlMinutes,
    pid: process.pid,
    hostname: os.hostname()
  };

  fs.writeFileSync(lockFile, JSON.stringify(lockPayload, null, 2), 'utf-8');

  // If in SINGLE_AGENT_MUTEX mode, also acquire global lock
  if (mode === 'SINGLE_AGENT_MUTEX') {
    fs.writeFileSync(globalLockFile, JSON.stringify(lockPayload, null, 2), 'utf-8');
  }

  return { acquired: true, agentId, lockFile, expiresAt };
}

/**
 * Releases target lock
 */
export function releaseTargetLock(targetKey) {
  ensureLocksDir();
  const safeSlug = targetKey.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const lockFile = path.join(LOCKS_DIR, `${safeSlug}.lock`);

  if (fs.existsSync(lockFile)) {
    try {
      fs.unlinkSync(lockFile);
    } catch (e) {}
  }

  const globalLockFile = path.join(LOCKS_DIR, 'global-mutex.lock');
  if (fs.existsSync(globalLockFile)) {
    try {
      fs.unlinkSync(globalLockFile);
    } catch (e) {}
  }

  return true;
}

/**
 * Atomic Git Rebase-Retry Push Barrier:
 * When multiple agents push concurrently to GitHub origin main,
 * handles non-fast-forward rejections with auto-rebase and jittered retry.
 */
export async function pushWithRebaseRetry(commitMsg, maxRetries = 5, cwd = BRAIN_ROOT) {
  console.log(`\n[CONCURRENCY SYNC] Staging and pushing with atomic rebase retry...`);

  try {
    run('git add .', cwd);
    const status = run('git status --porcelain', cwd);
    if (!status) {
      console.log(`[CONCURRENCY SYNC] Working tree clean. No changes to commit.`);
      return { success: true, pushed: false };
    }

    run(`git commit -m "${commitMsg}"`, cwd);
  } catch (err) {
    console.warn(`[CONCURRENCY COMMIT NOTICE] ${err.message}`);
  }

  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    try {
      run('git push origin main', cwd);
      console.log(`[CONCURRENCY PUSH SUCCESS] Push confirmed on attempt ${attempt}.`);
      return { success: true, pushed: true, attempt };
    } catch (err) {
      console.warn(`[CONCURRENCY RETRY] Push rejected on attempt ${attempt}/${maxRetries} (concurrent remote change detected).`);
      console.log(`   Running git pull --rebase to merge concurrent agent updates...`);

      try {
        run('git pull --rebase origin main', cwd);
      } catch (pullErr) {
        console.warn(`   Rebase encounter: ${pullErr.message}. Aborting rebase to keep clean tree.`);
        try { run('git rebase --abort', cwd); } catch (e) {}
      }

      // Exponential random jitter to prevent concurrent agents from colliding again
      const jitterMs = 800 + Math.floor(Math.random() * 1500) * attempt;
      await sleep(jitterMs);
    }
  }

  console.error(`[CONCURRENCY ERROR] Exceeded ${maxRetries} push attempts.`);
  return { success: false, pushed: false };
}

/**
 * Resolves the next available engineering pattern rule number dynamically
 * Prevents rule number collisions across concurrent agents.
 */
export function resolveNextRuleNumber() {
  const patternsPath = path.join(BRAIN_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md');
  if (!fs.existsSync(patternsPath)) return 1;

  const content = fs.readFileSync(patternsPath, 'utf-8');
  const matches = [...content.matchAll(/##\s+(\d+)\.\s+/g)];
  if (matches.length === 0) return 1;

  const nums = matches.map((m) => parseInt(m[1], 10)).filter((n) => !isNaN(n));
  return Math.max(...nums) + 1;
}
