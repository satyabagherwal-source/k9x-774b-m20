/**
 * Test Suite: Master Brain Safe Auto-Commit Policy & Child Project Manual Commit Boundary
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-master-brain-git-policy.mjs
 * Purpose: PAC-005 Section 2 — Empirical verification of dual-track Git policy:
 *          1. Master Brain auto-commit operates in an isolated test repo configured as MASTER_BRAIN.
 *          2. Child project auto-commit is strictly blocked.
 *          3. Child project manual commit workflow remains available.
 *          4. Master Brain commit manager cannot cross repository boundaries.
 *          5. A child repository cannot be misclassified as Master Brain through simple path or configuration spoof.
 *          6. Auto-push is not accidentally enabled.
 * 
 * Zero external dependencies. Native Node.js test harness.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execSync } from 'child_process';
import assert from 'assert';

import {
  classifyRepository,
  executeMasterBrainAutoCommit,
  REPOSITORY_TYPES,
  GIT_COMMIT_POLICIES,
  isPathProtectedOrExcluded,
  isPathAllowedForAutoCommit,
  CANONICAL_MASTER_BRAIN_ROOT
} from './master-brain-auto-commit.mjs';
import { setupGitRepository, verifyGitStatus } from './git-manager.mjs';

console.log('======================================================================');
console.log('🧪 TEST SUITE: DUAL-TRACK GIT POLICY & BOUNDARY VERIFICATION (PAC-005)');
console.log('======================================================================\n');

let passedTests = 0;
let failedTests = 0;

function pass(msg) {
  passedTests++;
  console.log(`  ✅ [PASS] ${msg}`);
}

function fail(msg, err) {
  failedTests++;
  console.error(`  ❌ [FAIL] ${msg}: ${err?.message || err}`);
}

// Helper to create clean isolated git repos
function createIsolatedTestGitRepo(prefix) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `git-policy-${prefix}-`));
  execSync('git init -b main', { cwd: tempDir, stdio: 'pipe' });
  execSync('git config user.name "Test Bot"', { cwd: tempDir, stdio: 'pipe' });
  execSync('git config user.email "test@bot.local"', { cwd: tempDir, stdio: 'pipe' });
  return tempDir;
}

function cleanupDir(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (e) {}
}

const testToken = crypto.randomBytes(16).toString('hex');

try {
  // ---------------------------------------------------------------------------
  // [TEST 1] Master Brain Auto-Commit in Authorized Test Repo
  // ---------------------------------------------------------------------------
  console.log('[TEST 1] Verifying Master Brain Auto-Commit in Isolated Test Repo...');
  const masterTestDir = createIsolatedTestGitRepo('master-brain-test');
  try {
    // Scaffold canonical structure in test harness
    fs.mkdirSync(path.join(masterTestDir, '01_CORE'), { recursive: true });
    fs.mkdirSync(path.join(masterTestDir, '04_WORKFLOWS'), { recursive: true });
    fs.mkdirSync(path.join(masterTestDir, '05_KNOWLEDGE'), { recursive: true });
    fs.mkdirSync(path.join(masterTestDir, '08_VERIFICATION'), { recursive: true });
    fs.writeFileSync(path.join(masterTestDir, 'LEARNINGS.md'), '# Canonical Learnings\n', 'utf-8');
    // Initial commit of baseline
    execSync('git add LEARNINGS.md', { cwd: masterTestDir, stdio: 'pipe' });
    execSync('git commit -m "chore: initial baseline"', { cwd: masterTestDir, stdio: 'pipe' });

    // Create a modified file in an allowed canonical folder
    fs.writeFileSync(path.join(masterTestDir, '08_VERIFICATION', 'test-proof.md'), 'Empirical proof verification.\n', 'utf-8');

    // Also create a sensitive/excluded file that must NOT be committed
    fs.writeFileSync(path.join(masterTestDir, '.brain-secrets.json'), '{"secret": "LEAK_PROHIBITED"}', 'utf-8');

    // Execute auto-commit with explicit test authorization token
    const commitResult = executeMasterBrainAutoCommit(masterTestDir, {
      allowTestMasterBrain: true,
      testMasterBrainToken: testToken,
      message: 'test(08_VERIFICATION): automated verification ledger update'
    });

    assert.strictEqual(commitResult.success, true, 'Auto-commit must succeed in authorized MASTER_BRAIN test repo');
    assert.strictEqual(commitResult.committed, true, 'File must be committed');
    assert.strictEqual(commitResult.stagedCount, 1, 'Only the 1 allowed file should be staged and committed');
    assert.strictEqual(commitResult.excludedCount, 1, 'The sensitive .brain-secrets.json must be excluded');

    // Verify git log confirms commit
    const logOutput = execSync('git log -1 --oneline', { cwd: masterTestDir, encoding: 'utf-8' }).trim();
    assert.ok(logOutput.includes('test(08_VERIFICATION)'), 'Commit log must reflect synthesized commit message');

    // Verify .brain-secrets.json remains untracked
    const statusOutput = execSync('git status --porcelain', { cwd: masterTestDir, encoding: 'utf-8' });
    assert.ok(statusOutput.includes('.brain-secrets.json'), 'Sensitive file must remain unstaged and untracked');

    pass('Master Brain auto-commit operates successfully in authorized test environment with strict exclusions');
  } finally {
    cleanupDir(masterTestDir);
  }

  // ---------------------------------------------------------------------------
  // [TEST 2] Child Project Auto-Commit is Strictly Blocked
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 2] Verifying Child Project Auto-Commit is Strictly Blocked...');
  const childTestDir = createIsolatedTestGitRepo('child-project');
  try {
    fs.writeFileSync(path.join(childTestDir, 'package.json'), '{"name": "child-app"}', 'utf-8');
    fs.writeFileSync(path.join(childTestDir, 'index.js'), 'console.log("hello");', 'utf-8');

    // Attempt auto-commit on child project
    const childCommitResult = executeMasterBrainAutoCommit(childTestDir, {});

    assert.strictEqual(childCommitResult.success, false, 'Auto-commit must fail for child project');
    assert.strictEqual(childCommitResult.committed, false, 'Nothing must be committed');
    assert.strictEqual(childCommitResult.status, 'BLOCKED_POLICY_VIOLATION', 'Status must be BLOCKED_POLICY_VIOLATION');
    assert.strictEqual(childCommitResult.classification.type, REPOSITORY_TYPES.CHILD_PROJECT, 'Classification must be CHILD_PROJECT');
    assert.strictEqual(childCommitResult.classification.policy, GIT_COMMIT_POLICIES.MANUAL_COMMIT_ONLY, 'Policy must be MANUAL_COMMIT_ONLY');

    pass('Child project auto-commit is strictly blocked with BLOCKED_POLICY_VIOLATION');
  } finally {
    cleanupDir(childTestDir);
  }

  // ---------------------------------------------------------------------------
  // [TEST 3] Child Project Manual Commit Workflow Remains Available
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 3] Verifying Child Project Manual Commit Workflow Remains Available...');
  const childManualDir = createIsolatedTestGitRepo('child-manual');
  try {
    // Setup child repository via Project Factory Git setup
    const setupResult = setupGitRepository(childManualDir, 'child-manual-tool');
    assert.strictEqual(setupResult.initialized, true, 'Git repo should be initialized');
    assert.strictEqual(setupResult.committed, false, 'Auto-commit must be false per canonical policy');
    assert.strictEqual(setupResult.commitDeferredToUser, true, 'Commit must be explicitly deferred to user');

    // Write child files
    fs.writeFileSync(path.join(childManualDir, 'app.mjs'), 'export const run = () => true;\n', 'utf-8');

    // Manual commit by user simulation
    execSync('git add app.mjs', { cwd: childManualDir, stdio: 'pipe' });
    execSync('git commit -m "feat: user manual commit in child project"', { cwd: childManualDir, stdio: 'pipe' });

    const statusAfterUserCommit = verifyGitStatus(childManualDir);
    assert.strictEqual(statusAfterUserCommit.clean, true, 'Working tree should be clean after user manual commit');
    assert.strictEqual(statusAfterUserCommit.commitDeferredToUser, true, 'Policy flag remains true');

    pass('Child project manual commit workflow remains fully functional without automated interference');
  } finally {
    cleanupDir(childManualDir);
  }

  // ---------------------------------------------------------------------------
  // [TEST 4] Master Brain Commit Manager Cannot Cross Repository Boundaries
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 4] Verifying Boundary Isolation & Cross-Repository Protection...');
  const parentRepoDir = createIsolatedTestGitRepo('parent-repo');
  const subChildRepoDir = path.join(parentRepoDir, 'sub-child-repo');
  try {
    fs.mkdirSync(subChildRepoDir, { recursive: true });
    execSync('git init -b main', { cwd: subChildRepoDir, stdio: 'pipe' });
    execSync('git config user.name "Sub Child"', { cwd: subChildRepoDir, stdio: 'pipe' });
    execSync('git config user.email "child@sub.local"', { cwd: subChildRepoDir, stdio: 'pipe' });

    fs.writeFileSync(path.join(subChildRepoDir, 'child-file.txt'), 'Child data\n', 'utf-8');

    // Attempt to invoke auto-commit targeting the sub-child directory
    const crossResult = executeMasterBrainAutoCommit(subChildRepoDir, {});
    assert.strictEqual(crossResult.success, false, 'Auto-commit must not operate inside sub-child repository');
    assert.strictEqual(crossResult.status, 'BLOCKED_POLICY_VIOLATION', 'Cross-boundary attempt blocked');

    pass('Commit manager respects boundaries and cannot cross into nested or child repositories');
  } finally {
    cleanupDir(parentRepoDir);
  }

  // ---------------------------------------------------------------------------
  // [TEST 5] Anti-Spoofing: Child Repo Cannot Masquerade as Master Brain
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 5] Testing Anti-Spoofing Barriers (Spoofed Hierarchy Rejection)...');
  const spoofedDir = createIsolatedTestGitRepo('spoofed-brain');
  try {
    // Attempt to spoof Master Brain by creating all folders & LEARNINGS.md inside temp folder
    fs.mkdirSync(path.join(spoofedDir, '01_CORE'), { recursive: true });
    fs.mkdirSync(path.join(spoofedDir, '04_WORKFLOWS'), { recursive: true });
    fs.mkdirSync(path.join(spoofedDir, '05_KNOWLEDGE'), { recursive: true });
    fs.mkdirSync(path.join(spoofedDir, '08_VERIFICATION'), { recursive: true });
    fs.writeFileSync(path.join(spoofedDir, 'LEARNINGS.md'), '# Spoofed Learnings\n', 'utf-8');

    // Attempt classification without authorization token
    const spoofClass = classifyRepository(spoofedDir, {});

    // Must be classified as CHILD_PROJECT or fail-closed because path is in temp directory
    assert.strictEqual(spoofClass.type, REPOSITORY_TYPES.CHILD_PROJECT, 'Spoofed repo must be classified as CHILD_PROJECT');
    assert.strictEqual(spoofClass.policy, GIT_COMMIT_POLICIES.MANUAL_COMMIT_ONLY, 'Policy must remain MANUAL_COMMIT_ONLY');
    assert.strictEqual(spoofClass.isMasterBrain, false, 'isMasterBrain must be false');

    // Attempt auto-commit on spoofed repo
    const spoofCommit = executeMasterBrainAutoCommit(spoofedDir, {});
    assert.strictEqual(spoofCommit.success, false, 'Auto-commit on spoofed repo must fail');
    assert.strictEqual(spoofCommit.status, 'BLOCKED_POLICY_VIOLATION', 'Status must be BLOCKED_POLICY_VIOLATION');

    pass('Anti-spoofing barrier successfully detects and blocks spoofed Master Brain attempts');
  } finally {
    cleanupDir(spoofedDir);
  }

  // ---------------------------------------------------------------------------
  // [TEST 6] Auto-Push is Strictly Disabled by Default
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 6] Verifying Auto-Push is Strictly Disabled by Default...');
  const pushTestDir = createIsolatedTestGitRepo('push-test');
  try {
    fs.mkdirSync(path.join(pushTestDir, '01_CORE'), { recursive: true });
    fs.mkdirSync(path.join(pushTestDir, '04_WORKFLOWS'), { recursive: true });
    fs.mkdirSync(path.join(pushTestDir, '05_KNOWLEDGE'), { recursive: true });
    fs.mkdirSync(path.join(pushTestDir, '08_VERIFICATION'), { recursive: true });
    fs.writeFileSync(path.join(pushTestDir, 'LEARNINGS.md'), '# Canonical Learnings\n', 'utf-8');
    fs.writeFileSync(path.join(pushTestDir, '01_CORE', 'data.json'), '{"test": 1}', 'utf-8');

    const result = executeMasterBrainAutoCommit(pushTestDir, {
      allowTestMasterBrain: true,
      testMasterBrainToken: testToken,
      message: 'feat(01_CORE): update data'
    });

    assert.strictEqual(result.success, true, 'Commit succeeds');
    assert.strictEqual(result.pushed, false, 'Auto-push must strictly be false');
    assert.strictEqual(result.pushDeferredToUser, true, 'Push must be deferred to user');

    pass('Auto-push is strictly disabled by default; autoPush=false invariant confirmed');
  } finally {
    cleanupDir(pushTestDir);
  }

  // ---------------------------------------------------------------------------
  // [TEST 7] Protected Exclusion Filter Unit Checks
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 7] Testing Protected File Path Exclusion Policies...');
  assert.strictEqual(isPathProtectedOrExcluded('.brain-secrets.json'), true, 'Must exclude .brain-secrets.json');
  assert.strictEqual(isPathProtectedOrExcluded('.env'), true, 'Must exclude .env');
  assert.strictEqual(isPathProtectedOrExcluded('.env.production'), true, 'Must exclude .env.production');
  assert.strictEqual(isPathProtectedOrExcluded('.project-brain/cache/retrieval-index.json'), true, 'Must exclude 384 MB retrieval index');
  assert.strictEqual(isPathProtectedOrExcluded('.git/auto-commit.lock'), true, 'Must exclude lock files');
  assert.strictEqual(isPathAllowedForAutoCommit('08_VERIFICATION/report.md'), true, 'Must allow 08_VERIFICATION files');
  assert.strictEqual(isPathAllowedForAutoCommit('LEARNINGS.md'), true, 'Must allow LEARNINGS.md');
  assert.strictEqual(isPathAllowedForAutoCommit('.project-brain/cache/retrieval-index.json'), false, 'Must reject 384 MB cache from auto-commit');
  pass('Protected path and exclusion policies function with complete precision');

} catch (globalErr) {
  fail('Unhandled test suite error', globalErr);
}

console.log('\n======================================================================');
console.log(`🏁 DUAL-TRACK GIT POLICY TEST SUMMARY: ${passedTests} PASSED | ${failedTests} FAILED`);
console.log('======================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
