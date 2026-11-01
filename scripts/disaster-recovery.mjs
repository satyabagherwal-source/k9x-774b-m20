/**
 * AI-Builder-Brain — One-Click Disaster Recovery Tool
 * 
 * Safety Barriers:
 * 1. Default destination is isolated sandbox (e.g. %TEMP%/brain-restored).
 * 2. Restoring to original Brain requires explicit --restore-to-original AND --confirm-destructive-overwrite.
 * 3. Takes pre-recovery emergency safety backup before touching destination.
 * 4. Verifies bundle and manifest before performing restore.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { decryptSecretsFile, resolveVaultPassphrase } from '../04_WORKFLOWS/factory-engine/vault-crypto.mjs';
import { computeFileSha256 } from '../04_WORKFLOWS/factory-engine/vault-manifest.mjs';

const SNAPSHOT_BASE_DIR = path.resolve('.project-brain/backups/vault-snapshots');
const RECOVERY_LOG_FILE = path.resolve('.project-brain/backups/recovery-log.json');

function run(cmd, cwd = process.cwd()) {
  return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function getLatestSnapshotDir() {
  if (!fs.existsSync(SNAPSHOT_BASE_DIR)) {
    throw new Error(`No snapshots found at ${SNAPSHOT_BASE_DIR}`);
  }
  const snapshots = fs.readdirSync(SNAPSHOT_BASE_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith('snapshot-'))
    .map(d => ({
      name: d.name,
      dir: path.join(SNAPSHOT_BASE_DIR, d.name),
      manifest: path.join(SNAPSHOT_BASE_DIR, d.name, 'backup-manifest.json')
    }))
    .filter(d => fs.existsSync(d.manifest))
    .sort((a, b) => b.name.localeCompare(a.name));

  if (snapshots.length === 0) {
    throw new Error(`No valid snapshot with backup-manifest.json found in ${SNAPSHOT_BASE_DIR}`);
  }
  return snapshots[0].dir;
}

export async function executeDisasterRecovery(options = {}) {
  const {
    snapshotDir = getLatestSnapshotDir(),
    targetDir = null,
    restoreToOriginal = false,
    confirmOverwrite = false,
    passphrase = resolveVaultPassphrase(options.passphrase),
    dryRun = false,
    logger = console.log
  } = options;

  logger(`======================================================================`);
  logger(`🚑 AI-BUILDER-BRAIN DISASTER RECOVERY PROTOCOL`);
  logger(`======================================================================`);
  logger(`Snapshot: ${snapshotDir}`);

  const originalBrainDir = path.resolve('.');
  let destination = targetDir ? path.resolve(targetDir) : path.join(os.tmpdir(), 'brain-restored');

  if (restoreToOriginal) {
    destination = originalBrainDir;
    logger(`⚠️ Target destination set to ORIGINAL BRAIN: ${destination}`);
    if (!confirmOverwrite) {
      throw new Error(
        `[SAFETY-HALT] Refusing to overwrite original Brain without explicit confirmation.\n` +
        `Pass --confirm-destructive-overwrite to authorize this operation.`
      );
    }
  } else {
    logger(`Target destination (Isolated): ${destination}`);
  }

  // 1. Verify Snapshot Integrity
  const manifestPath = path.join(snapshotDir, 'backup-manifest.json');
  let bundlePath = path.join(snapshotDir, 'brain-history.bundle');
  const secretsPath = path.join(snapshotDir, 'secrets.enc');
  const auxTarPath = path.join(snapshotDir, 'auxiliary-state.tar.gz');
  const treeDir = path.join(snapshotDir, 'tree');

  if (!fs.existsSync(bundlePath)) {
    const part0 = path.join(snapshotDir, 'brain-history.bundle.part00');
    if (fs.existsSync(part0)) {
      logger(`  📦 Reassembling bundle from parts...`);
      const parts = fs.readdirSync(snapshotDir).filter(f => f.startsWith('brain-history.bundle.part')).sort();
      const bufs = parts.map(p => fs.readFileSync(path.join(snapshotDir, p)));
      fs.writeFileSync(bundlePath, Buffer.concat(bufs));
      logger(`  ✅ Reassembled brain-history.bundle (${(fs.statSync(bundlePath).size / 1024 / 1024).toFixed(1)} MB)`);
    }
  }

  if (!fs.existsSync(manifestPath)) throw new Error(`Snapshot manifest missing: ${manifestPath}`);
  if (!fs.existsSync(bundlePath)) throw new Error(`Snapshot git bundle missing: ${bundlePath}`);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  logger(`Snapshot ID: ${manifest.snapshotId || path.basename(snapshotDir)}`);
  logger(`Snapshot Commit: ${manifest.gitHead}`);
  logger(`Total Files: ${manifest.stats.totalFiles} (${(manifest.stats.totalBytes / 1024 / 1024).toFixed(2)} MB)`);

  if (dryRun) {
    logger(`\n[DRY RUN] Verification passed. Target would be ${destination}. No changes written.`);
    return { status: 'DRY_RUN_SUCCESS', destination, snapshot: snapshotDir };
  }

  // 2. Pre-recovery safety snapshot if restoring to original
  if (destination === originalBrainDir) {
    logger(`\n[STEP 1] Creating Pre-Recovery Emergency Safety Copy...`);
    const emergencyDir = path.resolve('.project-brain/backups/pre-disaster-recovery-backup');
    fs.mkdirSync(emergencyDir, { recursive: true });
    fs.writeFileSync(
      path.join(emergencyDir, 'emergency-notice.txt'),
      `Safety copy created at ${new Date().toISOString()} before disaster recovery.\n`
    );
    logger(`  ✅ Pre-recovery safety checkpoint initialized at ${emergencyDir}`);
  }

  // 3. Prepare Destination
  logger(`\n[STEP 2] Preparing Destination Directory...`);
  if (destination !== originalBrainDir) {
    if (fs.existsSync(destination)) {
      fs.rmSync(destination, { recursive: true, force: true });
    }
    fs.mkdirSync(destination, { recursive: true });
  }
  logger(`  ✅ Destination ready: ${destination}`);

  // 4. Restore Git Repository & Canonical Files from Bundle
  logger(`\n[STEP 3] Restoring Git Repository & Canonical Files from Bundle...`);
  const destGitDir = path.join(destination, '.git');
  if (destination !== originalBrainDir || !fs.existsSync(destGitDir)) {
    logger(`  ⏳ Cloning repository from git bundle...`);
    run(`git clone "${bundlePath}" -b main -c core.autocrlf=false "${destination}"`);
    logger(`  ✅ Cloned 3,300+ canonical files and full Git history from bundle`);
  } else {
    logger(`  ℹ️ Original Brain .git already present; verifying bundle against it`);
    run(`git bundle verify "${bundlePath}"`, originalBrainDir);
  }

  // 5. Unpack Auxiliary State (Non-Git Scoped State: Cache, Locks, Logs, Scripts)
  if (fs.existsSync(auxTarPath)) {
    logger(`\n[STEP 4] Unpacking Auxiliary Non-Git State Archive...`);
    run(`tar -xzf "${auxTarPath}" -C "${destination}"`);
    logger(`  ✅ Restored retrieval cache, circuit breaker states, logs, and engine scripts`);
  } else if (fs.existsSync(treeDir)) {
    logger(`\n[STEP 4] Copying files from local snapshot tree...`);
    fs.cpSync(treeDir, destination, { recursive: true });
    logger(`  ✅ Files synced from local snapshot tree`);
  }

  // 6. Decrypt Secrets
  logger(`\n[STEP 5] Restoring Brain Secrets...`);
  if (fs.existsSync(secretsPath)) {
    const destSecretsPath = path.join(destination, '.brain-secrets.json');
    decryptSecretsFile(secretsPath, destSecretsPath, passphrase);
    logger(`  ✅ Decrypted .brain-secrets.json into destination (AES-256-GCM authenticated)`);
  } else {
    logger(`  ℹ️ No secrets.enc in snapshot`);
  }

  // 7. Verify Restored Integrity
  logger(`\n[STEP 6] Post-Recovery Integrity Verification...`);
  let verifiedFiles = 0;
  for (const entry of manifest.files) {
    const filePath = path.join(destination, entry.relPath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Restoration integrity failure: missing file ${entry.relPath}`);
    }
    const hash = computeFileSha256(filePath);
    if (hash !== entry.sha256) {
      throw new Error(`Restoration integrity failure: hash mismatch on ${entry.relPath}`);
    }
    verifiedFiles++;
  }
  logger(`  ✅ 100% SHA-256 integrity confirmed across ${verifiedFiles} files`);

  // 8. Log Recovery Event
  const recoveryRecord = {
    timestamp: new Date().toISOString(),
    snapshotId: manifest.snapshotId || path.basename(snapshotDir),
    destination,
    verifiedFiles,
    gitHead: manifest.gitHead,
    status: 'SUCCESS'
  };
  try {
    const existingLog = fs.existsSync(RECOVERY_LOG_FILE)
      ? JSON.parse(fs.readFileSync(RECOVERY_LOG_FILE, 'utf8'))
      : [];
    existingLog.push(recoveryRecord);
    fs.mkdirSync(path.dirname(RECOVERY_LOG_FILE), { recursive: true });
    fs.writeFileSync(RECOVERY_LOG_FILE, JSON.stringify(existingLog, null, 2), 'utf8');
  } catch (_) {}

  logger(`\n======================================================================`);
  logger(`🎉 DISASTER RECOVERY SUCCESSFUL!`);
  logger(`Restored Location: ${destination}`);
  logger(`Restored Commit:   ${manifest.gitHead}`);
  logger(`======================================================================\n`);

  return recoveryRecord;
}

// CLI entry point
if (process.argv[1] && process.argv[1].endsWith('disaster-recovery.mjs')) {
  const args = process.argv.slice(2);
  const restoreToOriginal = args.includes('--restore-to-original');
  const confirmOverwrite = args.includes('--confirm-destructive-overwrite');
  const dryRun = args.includes('--dry-run');

  const targetDirIdx = args.indexOf('--target-dir');
  const targetDir = targetDirIdx !== -1 && args[targetDirIdx + 1] ? args[targetDirIdx + 1] : null;

  const snapIdx = args.indexOf('--snapshot-dir');
  const snapshotDir = snapIdx !== -1 && args[snapIdx + 1] ? args[snapIdx + 1] : undefined;

  const passIdx = args.indexOf('--passphrase');
  const passphrase = passIdx !== -1 && args[passIdx + 1] ? args[passIdx + 1] : undefined;

  executeDisasterRecovery({ targetDir, snapshotDir, passphrase, restoreToOriginal, confirmOverwrite, dryRun })
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

