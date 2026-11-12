/**
 * Test B: Automatic Backup & Disaster Recovery Verification Test
 * Isolated Sandbox Verification for Pre-Cloud-Harvesting Reliability Audit
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { executeVaultBackup } from '../../../04_WORKFLOWS/factory-engine/vault-backup-engine.mjs';
import { executeDisasterRecovery } from '../../../scripts/disaster-recovery.mjs';
import { computeFileSha256 } from '../../../04_WORKFLOWS/factory-engine/vault-manifest.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SANDBOX_DIR = __dirname;
const RESTORE_TARGET_DIR = path.join(SANDBOX_DIR, 'restored-brain');

console.log('======================================================================');
console.log('🧪 TEST B: AUTOMATIC BACKUP & DISASTER RECOVERY DRILL');
console.log('   Sandbox Target:', RESTORE_TARGET_DIR);
console.log('======================================================================\n');

// 1. Clean previous restore target
if (fs.existsSync(RESTORE_TARGET_DIR)) {
  fs.rmSync(RESTORE_TARGET_DIR, { recursive: true, force: true });
}

// 2. Execute Vault Backup with skipRemote: true
console.log('--- Step 1: Executing Vault Backup (skipRemote: true) ---');
const backupResult = await executeVaultBackup({
  skipRemote: true,
  logger: (msg) => console.log(`[BACKUP ENGINE] ${msg}`)
});

console.log('\n--- Step 2: Verifying Snapshot Creation ---');
console.log('Snapshot ID:', backupResult.snapshotId);
console.log('Status:', backupResult.status);
console.log('Git Bundle Verified:', backupResult.gitBundleVerified);
console.log('Total Files Scoped:', backupResult.totalFiles);
console.log('Total Bytes Scoped:', backupResult.totalBytes);
console.log('Snapshot Dir:', backupResult.snapshotDir);

if (backupResult.status !== 'SUCCESS') {
  throw new Error(`Backup failed with status: ${backupResult.status}`);
}
if (!fs.existsSync(backupResult.snapshotDir)) {
  throw new Error(`Snapshot directory does not exist on disk: ${backupResult.snapshotDir}`);
}

const manifestPath = path.join(backupResult.snapshotDir, 'backup-manifest.json');
const bundlePath = path.join(backupResult.snapshotDir, 'brain-history.bundle');
if (!fs.existsSync(manifestPath)) throw new Error('backup-manifest.json missing from snapshot');
if (!fs.existsSync(bundlePath)) throw new Error('brain-history.bundle missing from snapshot');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
console.log('✅ Snapshot manifest verified:');
console.log('   Git HEAD:', manifest.gitHead);
console.log('   Total Indexed Files:', manifest.stats.totalFiles);
console.log('   Bundle SHA-256:', manifest.artifacts.gitBundle.sha256);

// 3. Execute Disaster Recovery into isolated sandbox
console.log('\n--- Step 3: Executing Disaster Recovery into Sandbox Target ---');
const recoveryResult = await executeDisasterRecovery({
  snapshotDir: backupResult.snapshotDir,
  targetDir: RESTORE_TARGET_DIR,
  restoreToOriginal: false,
  confirmOverwrite: false,
  logger: (msg) => console.log(`[DR ENGINE] ${msg}`)
});

console.log('\n--- Step 4: Verifying Restored State Integrity ---');
console.log('Recovery Status:', recoveryResult.status);
console.log('Restored Location:', recoveryResult.destination);
console.log('Verified Files:', recoveryResult.verifiedFiles);

if (recoveryResult.status !== 'SUCCESS') {
  throw new Error(`Disaster recovery failed with status: ${recoveryResult.status}`);
}

// 4. Compare SHA-256 Hashes between Production Root and Restored Root
const filesToVerify = [
  '05_KNOWLEDGE/engineering-patterns.md',
  '05_KNOWLEDGE/knowledge-index.json',
  'LEARNINGS.md',
  '04_WORKFLOWS/factory-engine/vault-backup-engine.mjs',
  '04_WORKFLOWS/factory-engine/brain-learning-gateway.mjs',
  'harvest-control.json'
];

console.log('\n--- Step 5: Side-by-Side SHA-256 Hash Comparison ---');
let allMatch = true;
const rootDir = process.cwd();

for (const relPath of filesToVerify) {
  const prodPath = path.join(rootDir, relPath);
  const restoredPath = path.join(RESTORE_TARGET_DIR, relPath);

  if (!fs.existsSync(restoredPath)) {
    console.error(`❌ Restored file missing: ${relPath}`);
    allMatch = false;
    continue;
  }

  const prodHash = computeFileSha256(prodPath);
  const restoredHash = computeFileSha256(restoredPath);
  const match = prodHash === restoredHash;

  console.log(`File: ${relPath}`);
  console.log(`  Live Hash:     ${prodHash.slice(0, 16)}...`);
  console.log(`  Restored Hash: ${restoredHash.slice(0, 16)}...`);
  console.log(`  Match:         ${match ? '✅ EQUIVALENT' : '❌ MISMATCH'}`);

  if (!match) allMatch = false;
}

if (!allMatch) {
  throw new Error('One or more restored files failed SHA-256 hash comparison');
}

// 5. Cleanup restored sandbox directory to conserve disk space
console.log('\n--- Step 6: Cleaning up restored sandbox directory ---');
fs.rmSync(RESTORE_TARGET_DIR, { recursive: true, force: true });
console.log('✅ Cleaned up restored sandbox target at:', RESTORE_TARGET_DIR);

console.log('\n======================================================================');
console.log('🎉 TEST B PASSED: AUTOMATIC BACKUP & RESTORATION VERIFIED 100%');
console.log('======================================================================\n');

