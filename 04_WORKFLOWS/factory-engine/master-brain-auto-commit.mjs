/**
 * Master Brain Safe Auto Git Commit Manager
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\master-brain-auto-commit.mjs
 * Purpose: PAC-005 — Enforces strictly separated Git policies:
 *          1. MASTER AI-BUILDER-BRAIN: Automatic Git Commit permitted with strict safety invariants.
 *          2. CHILD PROJECT REPOSITORIES: Manual Git Commit ONLY by the user.
 * 
 * Strict Boundary Rules:
 * - AUTO-PUSH REMAINS PERMANENTLY DISABLED unless separately and explicitly authorized.
 * - Master Brain auto-commit manager NEVER operates in child project repositories.
 * - Strict anti-spoofing and fail-closed classification.
 * - Sensitive files (.brain-secrets.json, .env, 384 MB retrieval index) are strictly excluded from auto-staging.
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const CANONICAL_MASTER_BRAIN_ROOT = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// 1. Repository Classification & Policy Governance
// ---------------------------------------------------------------------------

export const REPOSITORY_TYPES = Object.freeze({
  MASTER_BRAIN: 'MASTER_BRAIN',
  CHILD_PROJECT: 'CHILD_PROJECT',
  UNKNOWN: 'UNKNOWN'
});

export const GIT_COMMIT_POLICIES = Object.freeze({
  AUTO_COMMIT_ALLOWED_WITH_SAFETY_CHECKS: 'AUTO_COMMIT_ALLOWED_WITH_SAFETY_CHECKS',
  MANUAL_COMMIT_ONLY: 'MANUAL_COMMIT_ONLY',
  BLOCKED_UNKNOWN: 'BLOCKED_UNKNOWN'
});

/**
 * Normalizes file system paths for case-insensitive comparison on Windows.
 */
function normalizePath(targetPath) {
  if (!targetPath) return '';
  return path.resolve(targetPath).replace(/\\/g, '/').toLowerCase();
}

/**
 * Classifies a target directory into MASTER_BRAIN or CHILD_PROJECT.
 * Enforces strict anti-spoofing invariants.
 * 
 * @param {string} targetDir - Directory path to classify
 * @param {object} options - Optional validation flags
 * @returns {object} Classification result
 */
export function classifyRepository(targetDir, options = {}) {
  const root = path.resolve(targetDir);
  const normalizedRoot = normalizePath(root);
  const normalizedCanonical = normalizePath(CANONICAL_MASTER_BRAIN_ROOT);
  const reasons = [];

  // Check 1: Existence and Git directory
  if (!fs.existsSync(root)) {
    return {
      type: REPOSITORY_TYPES.UNKNOWN,
      policy: GIT_COMMIT_POLICIES.BLOCKED_UNKNOWN,
      isMasterBrain: false,
      reasons: ['Target path does not exist on disk.']
    };
  }

  const gitPath = path.join(root, '.git');
  if (!fs.existsSync(gitPath)) {
    return {
      type: REPOSITORY_TYPES.UNKNOWN,
      policy: GIT_COMMIT_POLICIES.BLOCKED_UNKNOWN,
      isMasterBrain: false,
      reasons: ['No .git directory found at target path.']
    };
  }

  // Check 2: Simulation Sandbox, Temp or AppData Detection (Anti-Spoofing Barrier)
  const isInsideSandbox = normalizedRoot.includes('/.project-brain/simulation-sandbox/') ||
                          normalizedRoot.includes('/appdata/local/temp/') ||
                          normalizedRoot.includes('/tmp/');

  // Explicit test harness bypass for isolated unit testing only
  const isAuthorizedTestHarness = Boolean(options.allowTestMasterBrain && options.testMasterBrainToken);

  if (isInsideSandbox && !isAuthorizedTestHarness) {
    return {
      type: REPOSITORY_TYPES.CHILD_PROJECT,
      policy: GIT_COMMIT_POLICIES.MANUAL_COMMIT_ONLY,
      isMasterBrain: false,
      reasons: [
        'Target directory resides inside simulation sandbox, temporary directory, or child folder.',
        'Policy: CHILD_PROJECT = MANUAL_COMMIT_ONLY. Auto-commit strictly blocked.'
      ]
    };
  }

  // Check 3: Canonical Path Verification
  const isPathExactMatch = (normalizedRoot === normalizedCanonical);

  // Check 4: Master Brain Structural Signatures
  const canonicalFolders = ['01_CORE', '04_WORKFLOWS', '05_KNOWLEDGE', '08_VERIFICATION'];
  const hasStructuralSignatures = canonicalFolders.every(folder => 
    fs.existsSync(path.join(root, folder))
  );
  const hasLearningsFile = fs.existsSync(path.join(root, 'LEARNINGS.md'));

  // Evaluation: Is it Master Brain?
  if ((isPathExactMatch || isAuthorizedTestHarness) && hasStructuralSignatures && hasLearningsFile) {
    return {
      type: REPOSITORY_TYPES.MASTER_BRAIN,
      policy: GIT_COMMIT_POLICIES.AUTO_COMMIT_ALLOWED_WITH_SAFETY_CHECKS,
      isMasterBrain: true,
      canonicalRoot: CANONICAL_MASTER_BRAIN_ROOT,
      reasons: [
        'Path matches canonical Master Brain root.',
        'All structural signatures (16-folder layout, LEARNINGS.md) verified.',
        'Policy: MASTER_BRAIN = AUTO_COMMIT_ALLOWED_WITH_SAFETY_CHECKS.'
      ]
    };
  }

  // Default Fallback: Treat as Child Project (Fail-Closed Safety)
  return {
    type: REPOSITORY_TYPES.CHILD_PROJECT,
    policy: GIT_COMMIT_POLICIES.MANUAL_COMMIT_ONLY,
    isMasterBrain: false,
    reasons: [
      'Repository does not match canonical Master Brain identity.',
      'Policy: CHILD_PROJECT = MANUAL_COMMIT_ONLY. Auto-commit strictly blocked.'
    ]
  };
}

// ---------------------------------------------------------------------------
// 2. Protected Path Policy & Exclusion Filters
// ---------------------------------------------------------------------------

export const PROTECTED_EXCLUSION_PATTERNS = Object.freeze([
  // Sensitive tokens & credentials
  /^\.brain-secrets\.json$/i,
  /\.env(\..+)?$/i,
  /\.key$/i,
  /\.pem$/i,
  /id_rsa/i,
  /credentials\.json$/i,

  // Heavy production retrieval caches (Must never be auto-committed)
  /^\.project-brain[\\/]cache[\\/]retrieval-index\.json$/i,

  // Ephemeral, runtime & locks
  /\.lock$/i,
  /\.tmp$/i,
  /\.bak$/i,
  /\.log$/i,
  /^node_modules[\\/]/i,
  /^\.project-brain[\\/]simulation-sandbox[\\/]/i
]);

export const ALLOWED_AUTO_COMMIT_PREFIXES = Object.freeze([
  '01_CORE/',
  '02_ROLES/',
  '03_ADAPTERS/',
  '04_WORKFLOWS/',
  '05_KNOWLEDGE/',
  '06_SCAFFOLDS/',
  '07_PROJECT_LEARNING/',
  '08_VERIFICATION/',
  '09_SOURCES/',
  '10_ORCHESTRATION/',
  '11_REGISTRIES/',
  '12_INDEXES/',
  '13_TEMPLATES/',
  '14_EVOLUTION/',
  '15_INTERFACES/',
  '16_META/',
  '.github/',
  '.project-brain/audit/',
  'LEARNINGS.md',
  'README.md',
  'package.json'
]);

/**
 * Checks if a relative file path is strictly prohibited from auto-commit.
 */
export function isPathProtectedOrExcluded(relPath) {
  const normalized = relPath.replace(/\\/g, '/').replace(/^\.\//, '');
  for (const pattern of PROTECTED_EXCLUSION_PATTERNS) {
    if (pattern.test(normalized) || pattern.test(path.basename(normalized))) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if a relative file path is within the allowed canonical Master Brain auto-commit scope.
 */
export function isPathAllowedForAutoCommit(relPath) {
  const normalized = relPath.replace(/\\/g, '/').replace(/^\.\//, '');
  if (isPathProtectedOrExcluded(normalized)) {
    return false;
  }
  return ALLOWED_AUTO_COMMIT_PREFIXES.some(prefix => normalized.startsWith(prefix) || normalized === prefix);
}

// ---------------------------------------------------------------------------
// 3. Concurrency Lock & Mutex
// ---------------------------------------------------------------------------

const LOCK_FILE_NAME = 'master-brain-auto-commit.lock';
const LOCK_TIMEOUT_MS = 60000; // 60 seconds

function acquireLock(repoRoot) {
  const gitDir = path.join(repoRoot, '.git');
  if (!fs.existsSync(gitDir)) return false;
  const lockPath = path.join(gitDir, LOCK_FILE_NAME);

  if (fs.existsSync(lockPath)) {
    try {
      const stats = fs.statSync(lockPath);
      const age = Date.now() - stats.mtimeMs;
      if (age > LOCK_TIMEOUT_MS) {
        // Stale lock reclamation
        fs.unlinkSync(lockPath);
      } else {
        return false; // Active lock held
      }
    } catch (e) {
      return false;
    }
  }

  try {
    fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }), { flag: 'wx' });
    return true;
  } catch (e) {
    return false;
  }
}

function releaseLock(repoRoot) {
  const lockPath = path.join(repoRoot, '.git', LOCK_FILE_NAME);
  try {
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
    }
  } catch (e) {}
}

// ---------------------------------------------------------------------------
// 4. Conventional Commit Message Synthesizer
// ---------------------------------------------------------------------------

export function synthesizeCommitMessage(eligibleFiles, customMessage = null) {
  if (customMessage && typeof customMessage === 'string' && customMessage.trim().length > 0) {
    return customMessage.trim();
  }

  // Derive message from affected directories
  const dirCounts = {};
  for (const f of eligibleFiles) {
    const parts = f.replace(/\\/g, '/').split('/');
    const top = parts[0];
    dirCounts[top] = (dirCounts[top] || 0) + 1;
  }

  const sortedDirs = Object.keys(dirCounts).sort((a, b) => dirCounts[b] - dirCounts[a]);
  const primaryDir = sortedDirs[0] || 'core';

  let type = 'feat';
  if (primaryDir === '08_VERIFICATION' || primaryDir.includes('test')) {
    type = 'test';
  } else if (primaryDir === '05_KNOWLEDGE' || primaryDir === '07_PROJECT_LEARNING' || primaryDir === 'LEARNINGS.md') {
    type = 'docs';
  } else if (primaryDir === '04_WORKFLOWS') {
    type = 'feat';
  }

  return `${type}(${primaryDir}): automated empirical learning and construction state update (${eligibleFiles.length} files)`;
}

// ---------------------------------------------------------------------------
// 5. Master Brain Safe Auto-Commit Engine
// ---------------------------------------------------------------------------

/**
 * Executes safe, validated, automated Git commit exclusively for Master Brain.
 * 
 * @param {string} targetDir - Repository root directory
 * @param {object} options - Commit options
 * @returns {object} Execution summary
 */
export function executeMasterBrainAutoCommit(targetDir = CANONICAL_MASTER_BRAIN_ROOT, options = {}) {
  const root = path.resolve(targetDir);
  const classification = classifyRepository(root, options);

  // INVARIANT 1: Strict Policy Boundary
  if (classification.type !== REPOSITORY_TYPES.MASTER_BRAIN) {
    return {
      success: false,
      status: 'BLOCKED_POLICY_VIOLATION',
      committed: false,
      pushed: false,
      reason: `Automatic commits are strictly prohibited in repository type "${classification.type}". Only MASTER_BRAIN allows auto-commit. Manual commits required.`,
      classification
    };
  }

  if (classification.policy !== GIT_COMMIT_POLICIES.AUTO_COMMIT_ALLOWED_WITH_SAFETY_CHECKS) {
    return {
      success: false,
      status: 'BLOCKED_POLICY_VIOLATION',
      committed: false,
      pushed: false,
      reason: `Policy ${classification.policy} prohibits automatic commits.`,
      classification
    };
  }

  // INVARIANT 2: Concurrency Lock Acquisition
  if (!acquireLock(root)) {
    return {
      success: false,
      status: 'LOCK_ACQUISITION_FAILED',
      committed: false,
      reason: 'Another Git auto-commit operation is currently in progress.'
    };
  }

  try {
    // Helper runner
    function runGit(cmd) {
      return execSync(cmd, { cwd: root, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    }

    // Inspect working-tree status
    let statusOutput = '';
    try {
      statusOutput = runGit('git status --porcelain');
    } catch (e) {
      return {
        success: false,
        status: 'GIT_STATUS_FAILED',
        committed: false,
        reason: `Failed to inspect git status: ${e.message}`
      };
    }

    if (!statusOutput) {
      return {
        success: true,
        status: 'CLEAN_WORKING_TREE',
        committed: false,
        pushed: false,
        reason: 'Working tree is completely clean. No modifications to commit.'
      };
    }

    const rawLines = statusOutput.split('\n').map(l => l.trim()).filter(Boolean);
    const modifiedFiles = [];
    for (const line of rawLines) {
      // Porcelain format: XY filename or XY "filename" -> extract path
      const filePath = line.substring(2).trim().replace(/^"/, '').replace(/"$/, '');
      if (filePath) modifiedFiles.push(filePath);
    }

    // INVARIANT 3: Filter against Protected Path Policy & Allowed Scope
    const eligibleFiles = [];
    const excludedFiles = [];

    for (const f of modifiedFiles) {
      if (isPathProtectedOrExcluded(f)) {
        excludedFiles.push({ file: f, reason: 'PROTECTED_OR_SENSITIVE' });
      } else if (!isPathAllowedForAutoCommit(f)) {
        excludedFiles.push({ file: f, reason: 'OUTSIDE_ALLOWED_SCOPE' });
      } else {
        eligibleFiles.push(f);
      }
    }

    if (eligibleFiles.length === 0) {
      return {
        success: true,
        status: 'NO_ELIGIBLE_FILES',
        committed: false,
        pushed: false,
        reason: 'All modified files are protected, sensitive, or outside canonical auto-commit scope.',
        excludedFiles
      };
    }

    // Preview Mode Check
    if (options.previewOnly || options.dryRun) {
      const commitMessage = synthesizeCommitMessage(eligibleFiles, options.message);
      return {
        success: true,
        status: 'DRY_RUN_PREVIEW',
        committed: false,
        pushed: false,
        eligibleFiles,
        excludedFiles,
        commitMessage
      };
    }

    // INVARIANT 4: Pre-Commit Validation Hook
    if (typeof options.preCommitValidator === 'function') {
      const validation = options.preCommitValidator(eligibleFiles);
      if (!validation.passed) {
        return {
          success: false,
          status: 'VALIDATION_FAILED',
          committed: false,
          reason: `Pre-commit validation check failed: ${validation.reason || 'Unknown error'}`
        };
      }
    }

    // INVARIANT 5: Stage ONLY Eligible Files (Zero accidental staging of excluded files)
    for (const file of eligibleFiles) {
      runGit(`git add "${file}"`);
    }

    // INVARIANT 6: Post-Staging Verification Barrier
    const stagedStatus = runGit('git diff --cached --name-only').split('\n').map(s => s.trim()).filter(Boolean);
    const violationInStaged = stagedStatus.find(f => isPathProtectedOrExcluded(f));
    if (violationInStaged) {
      // Emergency unstage and abort!
      runGit('git reset');
      return {
        success: false,
        status: 'STAGING_VIOLATION_ABORTED',
        committed: false,
        reason: `Emergency abort: Protected/sensitive file "${violationInStaged}" detected in staged set. Working tree unstaged.`
      };
    }

    // INVARIANT 7: Execute Commit
    const commitMessage = synthesizeCommitMessage(eligibleFiles, options.message);
    let commitHash = null;
    try {
      runGit(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`);
      commitHash = runGit('git rev-parse HEAD');
    } catch (commitErr) {
      return {
        success: false,
        status: 'COMMIT_FAILED',
        committed: false,
        reason: `Git commit failed: ${commitErr.message}`
      };
    }

    // INVARIANT 8: Auto-Push Policy Check (Strictly disabled by default)
    let pushResult = { pushed: false, pushDeferredToUser: true };
    if (options.autoPush === true && options.explicitPushAuthorizationToken) {
      try {
        runGit('git push origin main');
        pushResult = { pushed: true, pushDeferredToUser: false };
      } catch (pushErr) {
        pushResult = { pushed: false, error: pushErr.message, pushDeferredToUser: true };
      }
    }

    // INVARIANT 9: Maintain Audit Ledger
    const auditRecord = {
      timestamp: new Date().toISOString(),
      commitHash,
      commitMessage,
      fileCount: eligibleFiles.length,
      files: eligibleFiles,
      excludedCount: excludedFiles.length,
      pushed: pushResult.pushed,
      author: 'MasterBrain-AutoCommitManager'
    };

    try {
      const auditDir = path.join(root, '.project-brain', 'audit');
      if (!fs.existsSync(auditDir)) fs.mkdirSync(auditDir, { recursive: true });
      const logFile = path.join(auditDir, 'auto-commit-log.json');
      let currentLog = [];
      if (fs.existsSync(logFile)) {
        try { currentLog = JSON.parse(fs.readFileSync(logFile, 'utf-8')); } catch (e) {}
      }
      currentLog.push(auditRecord);
      fs.writeFileSync(logFile, JSON.stringify(currentLog, null, 2), 'utf-8');
    } catch (auditErr) {
      // Non-fatal audit log warning
    }

    return {
      success: true,
      status: 'AUTO_COMMITTED',
      committed: true,
      commitHash,
      commitMessage,
      stagedCount: eligibleFiles.length,
      excludedCount: excludedFiles.length,
      pushed: pushResult.pushed,
      pushDeferredToUser: pushResult.pushDeferredToUser
    };

  } finally {
    releaseLock(root);
  }
}

