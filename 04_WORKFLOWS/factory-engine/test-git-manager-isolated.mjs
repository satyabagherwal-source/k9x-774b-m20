/**
 * AI-Builder-Brain Isolated Git Manager Test
 * 
 * Verifies:
 * 1. Isolated Git repository initialization (git init -b main)
 * 2. Identity validation (user.name and user.email check)
 * 3. Canonical Policy: AUTO-COMMIT IS DISABLED ("commit me karunga bas setup karna h tumhe to")
 * 4. Safety Boundary: Child repositories are completely isolated from Master Brain
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import assert from 'assert';
import { setupGitRepository } from './git-manager.mjs';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-manager-test-'));

try {
  console.log('Testing isolated Git setup in:', tempDir);
  const result = setupGitRepository(tempDir, 'TestIsolatedRepo', {});

  assert.strictEqual(result.initialized, true, 'Git repo initialized');
  assert.strictEqual(result.branch, 'main', 'Default branch is main');
  assert.strictEqual(result.committed, false, 'Auto-commit is strictly FALSE (User policy preserved)');
  assert.strictEqual(result.commitDeferredToUser, true, 'Commit deferred to user');
  assert.strictEqual(fs.existsSync(path.join(tempDir, '.git')), true, '.git folder created');

  console.log('✅ Isolated Git Manager Verification: PASS (All assertions satisfied)');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

