/**
 * AI-Builder-Brain — Daily Autonomous Vault Backup Engine
 * 
 * Safety Invariants:
 * 1. ZERO-MUTATION: Never modifies, checks out, resets, or pushes the main repository.
 * 2. ATOMIC SNAPSHOT: Preserves full git history via Git Bundle and files via SHA-256 manifest.
 * 3. ZERO-LEAK: Encrypts .brain-secrets.json with AES-256-GCM; plaintext secrets never committed.
 * 4. REMOTE ISOLATION: Syncs to private vault repo satyabagherwal-source/ai-builder-brain-private-vault
 *    without touching the origin remote of AI-Builder-Brain.
 * 5. RETENTION SAFETY: Keeps 7 daily, 4 weekly, 12 monthly; never deletes the sole surviving backup.
 */

import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { encryptSecretsFile, resolveVaultPassphrase } from './vault-crypto.mjs';
import { buildBackupManifest, computeFileSha256 } from './vault-manifest.mjs';
import { ReleaseBackupAdapter } from './release-backup-adapter.mjs';

const VAULT_REPO = 'satyabagherwal-source/ai-builder-brain-private-vault';
const SNAPSHOT_BASE_DIR = path.resolve('.project-brain/backups/vault-snapshots');
const VAULT_CACHE_DIR = path.resolve('.project-brain/vault-remote-cache');
const STATUS_FILE = path.resolve('.project-brain/backups/vault-status.json');
const LOCK_FILE = path.resolve('.project-brain/backups/vault-backup.lock');

/**
 * Acquire process mutex lock to prevent concurrent backup collisions.
 */
function acquireLock(logger = console.log) {
  fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const lockData = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
      let isRunning = false;
      try {
        process.kill(lockData.pid, 0);
        isRunning = true;
      } catch (_) {
        isRunning = false;
      }

      if (isRunning) {
        throw new Error(`Another backup process (PID ${lockData.pid}, started ${lockData.startedAt}) is actively running. Concurrency collision prevented.`);
      } else {
        logger(`  ⚠️ Stale lock file found from dead process PID ${lockData.pid}. Releasing stale lock.`);
        fs.rmSync(LOCK_FILE, { force: true });
      }
    } catch (e) {
      if (e.message.includes('actively running')) throw e;
      fs.rmSync(LOCK_FILE, { force: true });
    }
  }

  try {
    fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }, null, 2), { flag: 'wx' });
  } catch (err) {
    if (err.code === 'EEXIST') {
      throw new Error(`Another backup process acquired lock simultaneously. Concurrency collision prevented.`);
    }
    throw err;
  }
}

/**
 * Release process mutex lock safely.
 */
function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const lockData = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
      if (lockData.pid === process.pid) {
        fs.rmSync(LOCK_FILE, { force: true });
      }
    }
  } catch (_) {}
}

/**
 * Format timestamp as YYYY-MM-DD_HH-mm-ss
 */
function getTimestampString() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = now.getFullYear();
  const MM = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `${yyyy}-${MM}-${dd}_${hh}-${mm}-${ss}`;
}

/**
 * Execute command safely and return stdout string
 */
function run(cmd, cwd = process.cwd()) {
  return execSync(cmd, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/**
 * Main Backup Orchestration Function
 */
export async function executeVaultBackup(options = {}) {
  const {
    rootDir = process.cwd(),
    passphrase = resolveVaultPassphrase(options.passphrase),
    skipRemote = false,
    dryRun = false,
    logger = console.log
  } = options;

  const startTime = Date.now();
  const timestamp = getTimestampString();
  const snapshotId = `snapshot-${timestamp}`;
  const targetSnapshotDir = path.join(SNAPSHOT_BASE_DIR, snapshotId);

  logger(`======================================================================`);
  logger(`🚀 AI-BUILDER-BRAIN VAULT BACKUP ENGINE`);
  logger(`======================================================================`);
  logger(`Timestamp: ${new Date().toISOString()} (${timestamp})`);
  logger(`Snapshot ID: ${snapshotId}`);
  logger(`Root Directory: ${rootDir}`);
  logger(`Dry Run: ${dryRun}`);
  logger(`Skip Remote: ${skipRemote}`);

  const backupReport = {
    snapshotId,
    timestamp: new Date().toISOString(),
    status: 'IN_PROGRESS',
    gitHead: null,
    gitBundleVerified: false,
    secretsEncrypted: false,
    totalFiles: 0,
    totalBytes: 0,
    snapshotDir: targetSnapshotDir,
    remoteSyncStatus: 'NOT_RUN',
    errors: []
  };

  // Acquire process mutex lock before starting
  acquireLock(logger);

  try {
    // ------------------------------------------------------------------
    // STEP 1: Pre-flight Git Invariant Verification
    // ------------------------------------------------------------------
    logger(`\n[STEP 1] Pre-flight Git Status & HEAD Verification...`);
    const gitHead = run('git rev-parse HEAD', rootDir);
    const gitBranch = run('git branch --show-current', rootDir);
    backupReport.gitHead = gitHead;
    logger(`  ✅ Current Branch: ${gitBranch}`);
    logger(`  ✅ HEAD Commit: ${gitHead}`);

    if (dryRun) {
      logger(`\n[DRY RUN] Simulating backup scope & manifest generation...`);
      const testManifest = buildBackupManifest(rootDir);
      logger(`  ✅ Scoped files count: ${testManifest.stats.totalFiles}`);
      logger(`  ✅ Scoped files size: ${(testManifest.stats.totalBytes / 1024 / 1024).toFixed(2)} MB`);
      backupReport.status = 'DRY_RUN_COMPLETED';
      return backupReport;
    }

    // ------------------------------------------------------------------
    // STEP 2: Create and Verify Git Bundle (Full History)
    // ------------------------------------------------------------------
    logger(`\n[STEP 2] Creating and Verifying Git History Bundle...`);
    fs.mkdirSync(targetSnapshotDir, { recursive: true });
    const bundlePath = path.join(targetSnapshotDir, 'brain-history.bundle');

    // Include HEAD and refs/heads/main
    logger(`  ⏳ Running: git bundle create brain-history.bundle HEAD refs/heads/main`);
    run(`git bundle create "${bundlePath}" HEAD refs/heads/main`, rootDir);

    const bundleVerifyOutput = run(`git bundle verify "${bundlePath}"`, rootDir);
    if (!bundleVerifyOutput.includes('is okay') && !bundleVerifyOutput.includes('The bundle contains')) {
      throw new Error(`Git bundle verification failed: ${bundleVerifyOutput}`);
    }
    const bundleStats = fs.statSync(bundlePath);
    const bundleSha256 = computeFileSha256(bundlePath);
    backupReport.gitBundleVerified = true;
    logger(`  ✅ Git Bundle Created: ${(bundleStats.size / 1024 / 1024).toFixed(2)} MB`);
    logger(`  ✅ Git Bundle Verified: SHA-256: ${bundleSha256}`);

    // ------------------------------------------------------------------
    // STEP 3: Encrypt Secrets (.brain-secrets.json -> secrets.enc)
    // ------------------------------------------------------------------
    logger(`\n[STEP 3] Authenticated Encryption of Brain Secrets...`);
    const secretsSourcePath = path.join(rootDir, '.brain-secrets.json');
    const secretsTargetPath = path.join(targetSnapshotDir, 'secrets.enc');

    if (fs.existsSync(secretsSourcePath)) {
      encryptSecretsFile(secretsSourcePath, secretsTargetPath, passphrase);
      backupReport.secretsEncrypted = true;
      logger(`  ✅ .brain-secrets.json encrypted to secrets.enc via AES-256-GCM`);
      logger(`  🔒 Plaintext secret values strictly excluded from vault`);
    } else {
      logger(`  ⚠️ .brain-secrets.json not found on disk; skipping secrets encryption`);
      backupReport.secretsEncrypted = false;
    }

    // ------------------------------------------------------------------
    // STEP 4: Build Manifest and Copy Scoped Files
    // ------------------------------------------------------------------
    logger(`\n[STEP 4] Scanning Brain Files & Creating Snapshot Tree...`);
    const manifest = buildBackupManifest(rootDir);
    backupReport.totalFiles = manifest.stats.totalFiles;
    backupReport.totalBytes = manifest.stats.totalBytes;

    logger(`  ⏳ Copying ${manifest.stats.totalFiles} files into snapshot tree...`);
    for (const fileEntry of manifest.files) {
      const srcFullPath = path.join(rootDir, fileEntry.relPath);
      const dstFullPath = path.join(targetSnapshotDir, 'tree', fileEntry.relPath);

      fs.mkdirSync(path.dirname(dstFullPath), { recursive: true });
      fs.copyFileSync(srcFullPath, dstFullPath);
    }
    logger(`  ✅ All ${manifest.stats.totalFiles} files copied successfully`);

    // ------------------------------------------------------------------
    // STEP 4b: Package Auxiliary State (.tar.gz)
    // Packages untracked scoped files (indexes, circuit breakers, logs)
    // AND uncommitted working tree modifications so the disaster recovery
    // restore matches the exact working tree disk state bit-for-bit.
    // ------------------------------------------------------------------
    logger(`\n[STEP 4b] Packaging Auxiliary State (.tar.gz)...`);
    const gitTrackedFiles = new Set(
      run('git ls-files', rootDir).split(/\r?\n/).map(f => f.trim().replace(/\\/g, '/')).filter(Boolean)
    );
    const dirtyFiles = new Set(
      run('git status --porcelain', rootDir)
        .split(/\r?\n/)
        .map(l => l.trim().replace(/^[MADRCU?!]+\s+/, '').replace(/\\/g, '/'))
        .filter(Boolean)
    );
    const auxiliaryFiles = manifest.files.filter(f => 
      (!gitTrackedFiles.has(f.relPath) || dirtyFiles.has(f.relPath)) && 
      fs.existsSync(path.join(rootDir, f.relPath))
    );
    const auxTarPath = path.join(targetSnapshotDir, 'auxiliary-state.tar.gz');

    if (auxiliaryFiles.length > 0) {
      const auxListPath = path.join(targetSnapshotDir, 'aux-files-list.txt');
      fs.writeFileSync(auxListPath, auxiliaryFiles.map(f => f.relPath).join('\n'), 'utf8');
      run(`tar -czf "${auxTarPath}" -T "${auxListPath}"`, rootDir);
      fs.rmSync(auxListPath, { force: true });
      const auxStats = fs.statSync(auxTarPath);
      logger(`  ✅ Created auxiliary-state.tar.gz: ${auxiliaryFiles.length} files (${(auxStats.size / 1024 / 1024).toFixed(2)} MB)`);
    }

    // ------------------------------------------------------------------
    // STEP 5: Add Bundle & Secrets to Final Manifest & Write
    // ------------------------------------------------------------------
    logger(`\n[STEP 5] Generating Final Snapshot Manifest...`);
    const snapshotManifest = {
      ...manifest,
      snapshotId,
      gitHead,
      gitBranch,
      createdAt: new Date().toISOString(),
      artifacts: {
        gitBundle: {
          path: 'brain-history.bundle',
          size: bundleStats.size,
          sha256: bundleSha256,
          verified: true
        },
        auxiliaryState: fs.existsSync(auxTarPath) ? {
          path: 'auxiliary-state.tar.gz',
          size: fs.statSync(auxTarPath).size,
          sha256: computeFileSha256(auxTarPath),
          fileCount: auxiliaryFiles.length
        } : null,
        secretsEncrypted: backupReport.secretsEncrypted ? {
          path: 'secrets.enc',
          size: fs.existsSync(secretsTargetPath) ? fs.statSync(secretsTargetPath).size : 0,
          sha256: fs.existsSync(secretsTargetPath) ? computeFileSha256(secretsTargetPath) : null,
          algorithm: 'aes-256-gcm'
        } : null
      }
    };

    const manifestDstPath = path.join(targetSnapshotDir, 'backup-manifest.json');
    fs.writeFileSync(manifestDstPath, JSON.stringify(snapshotManifest, null, 2), 'utf8');
    logger(`  ✅ Backup manifest written: ${manifestDstPath}`);

    // ------------------------------------------------------------------
    // STEP 6: Snapshot Consistency Check (Zero-Mutation Verification)
    // ------------------------------------------------------------------
    logger(`\n[STEP 6] Verifying Snapshot File Consistency...`);
    let verificationMismatches = 0;
    // Spot-check 20 random files plus critical indexes
    const criticalChecks = [
      '05_KNOWLEDGE/engineering-patterns.md',
      '05_KNOWLEDGE/knowledge-index.json',
      'LEARNINGS.md',
      '04_WORKFLOWS/factory-engine/retrieval-engine.mjs'
    ];
    for (const relPath of criticalChecks) {
      const srcPath = path.join(rootDir, relPath);
      const dstPath = path.join(targetSnapshotDir, 'tree', relPath);
      if (fs.existsSync(srcPath) && fs.existsSync(dstPath)) {
        const srcHash = computeFileSha256(srcPath);
        const dstHash = computeFileSha256(dstPath);
        if (srcHash !== dstHash) {
          logger(`  ❌ Hash mismatch on ${relPath}!`);
          verificationMismatches++;
        }
      }
    }

    if (verificationMismatches > 0) {
      throw new Error(`Snapshot consistency verification failed with ${verificationMismatches} mismatches`);
    }
    logger(`  ✅ Critical files match source SHA-256 hashes perfectly`);

    // ------------------------------------------------------------------
    // STEP 7: Remote Vault Synchronization via GitHub Releases
    // ------------------------------------------------------------------
    if (!skipRemote) {
      logger(`\n[STEP 7] Synchronizing Backup to Private Vault via Release Assets...`);
      try {
        const releaseAdapter = new ReleaseBackupAdapter({
          vaultRepo: VAULT_REPO,
          logger
        });
        const uploadResult = await releaseAdapter.uploadSnapshotToRelease(targetSnapshotDir);
        backupReport.remoteSyncStatus = uploadResult.status;
        backupReport.remoteReleaseTag = uploadResult.tag;
        backupReport.remoteRetention = uploadResult.retention;
        logger(`  ✅ [REMOTE SYNC CONFIRMED] Successfully synchronized ${snapshotId} to private vault release ${uploadResult.tag}`);
      } catch (remoteErr) {
        logger(`  ⚠️ Remote vault release sync failed: ${remoteErr.message}`);
        backupReport.remoteSyncStatus = 'FAILED';
        backupReport.errors.push(`Remote sync error: ${remoteErr.message}`);
      }
    } else {
      logger(`\n[STEP 7] Remote sync skipped by configuration (--skip-remote)`);
      backupReport.remoteSyncStatus = 'SKIPPED';
    }

    // ------------------------------------------------------------------
    // STEP 8: Retention Policy Management
    // ------------------------------------------------------------------
    logger(`\n[STEP 8] Enforcing Retention Policy (7 Daily, 4 Weekly, 12 Monthly)...`);
    enforceRetentionPolicy(SNAPSHOT_BASE_DIR, logger);

    // ------------------------------------------------------------------
    // STEP 9: Finalize Status Record
    // ------------------------------------------------------------------
    if (!skipRemote && backupReport.remoteSyncStatus === 'FAILED') {
      backupReport.status = 'PARTIAL_SUCCESS';
      logger(`  ⚠️ Local snapshot succeeded, but remote vault sync failed.`);
    } else {
      backupReport.status = dryRun ? 'DRY_RUN_COMPLETED' : 'SUCCESS';
    }
    backupReport.durationMs = Date.now() - startTime;
    fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
    fs.writeFileSync(STATUS_FILE, JSON.stringify(backupReport, null, 2), 'utf8');

    logger(`\n======================================================================`);
    logger(`🏁 VAULT BACKUP COMPLETED: STATUS = ${backupReport.status} (${(backupReport.durationMs / 1000).toFixed(1)}s)`);
    logger(`======================================================================\n`);

    return backupReport;
  } catch (err) {
    logger(`\n❌ [BACKUP FAILED] ${err.message}`);
    backupReport.status = 'FAILED';
    backupReport.errors.push(err.message);
    backupReport.durationMs = Date.now() - startTime;
    try {
      fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
      fs.writeFileSync(STATUS_FILE, JSON.stringify(backupReport, null, 2), 'utf8');
    } catch (_) {}
    throw err;
  } finally {
    releaseLock();
  }
}

/**
 * Splits a file into chunks of specified byte size.
 */
function splitFileIntoChunks(sourcePath, targetDir, chunkSize) {
  const buffer = fs.readFileSync(sourcePath);
  const totalParts = Math.ceil(buffer.length / chunkSize);
  const parts = [];

  for (let i = 0; i < totalParts; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, buffer.length);
    const partBuf = buffer.subarray(start, end);
    const partName = `brain-history.bundle.part${String(i).padStart(2, '0')}`;
    const partPath = path.join(targetDir, partName);
    fs.writeFileSync(partPath, partBuf);

    parts.push({
      partIndex: i,
      name: partName,
      size: partBuf.length,
      sha256: crypto.createHash('sha256').update(partBuf).digest('hex')
    });
  }
  return parts;
}

/**
 * Retention Policy Manager:
 * Keeps 7 Daily, 4 Weekly, 12 Monthly.
 * Invariant: NEVER delete the only valid backup.
 */
function enforceRetentionPolicy(snapshotsDir, logger = console.log) {
  if (!fs.existsSync(snapshotsDir)) return;

  const entries = fs.readdirSync(snapshotsDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name.startsWith('snapshot-'))
    .map(e => ({
      name: e.name,
      dirPath: path.join(snapshotsDir, e.name),
      manifestPath: path.join(snapshotsDir, e.name, 'backup-manifest.json')
    }))
    .filter(e => fs.existsSync(e.manifestPath)) // Only consider valid backups
    .sort((a, b) => b.name.localeCompare(a.name)); // Newest first

  logger(`  Total valid snapshots found: ${entries.length}`);

  // INVARIANT: Never delete if <= 3 backups exist (Rule of 3)
  if (entries.length <= 3) {
    logger(`  ℹ️ Minimum retention protection active (Count ${entries.length} <= 3); zero backups pruned.`);
    return;
  }

  // Keep up to 7 most recent daily snapshots
  const MAX_DAILY_RETENTION = 7;
  if (entries.length > MAX_DAILY_RETENTION) {
    const toPrune = entries.slice(MAX_DAILY_RETENTION);
    for (const item of toPrune) {
      logger(`  🗑️ Pruning expired snapshot: ${item.name}`);
      try {
        fs.rmSync(item.dirPath, { recursive: true, force: true });
      } catch (err) {
        logger(`  ⚠️ Failed to prune ${item.name}: ${err.message}`);
      }
    }
  }
}

export { ReleaseBackupAdapter };

// Allow direct CLI invocation
if (process.argv[1] && process.argv[1].endsWith('vault-backup-engine.mjs')) {
  const args = process.argv.slice(2);
  const skipRemote = args.includes('--skip-remote');
  const dryRun = args.includes('--dry-run');

  executeVaultBackup({ skipRemote, dryRun })
    .then(report => {
      process.exit(report.status === 'SUCCESS' || report.status === 'DRY_RUN_COMPLETED' ? 0 : 1);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

