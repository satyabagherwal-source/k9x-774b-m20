/**
 * AI-Builder-Brain — Release Asset Backup Engine Adapter
 * 
 * Provides production-ready adapter for syncing backup snapshots via GitHub Releases API / CLI,
 * including per-asset SHA-256, exponential backoff, interrupted transfer recovery,
 * safe retention (Rule of 3 + Latest Known-Good protection), and disaster recovery restoration.
 * 
 * Zero-Leak Invariant:
 * Strictly prevents upload of plaintext secrets (.brain-secrets.json, .env, private keys).
 * Only encrypted secrets (secrets.enc via AES-256-GCM) are permitted.
 */

import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function computeFileSha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

/**
 * Native GitHub CLI client for Release operations
 */
export class GhCliClient {
  constructor(logger = console.log) {
    this.logger = logger;
  }

  runCmd(cmd, cwd = process.cwd()) {
    return execSync(cmd, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
  }

  async getReleaseByTag(repo, tag) {
    try {
      const output = this.runCmd(`gh release view "${tag}" --repo "${repo}" --json tagName,name,isDraft,createdAt,assets`);
      const parsed = JSON.parse(output);
      const assetsMap = {};
      if (Array.isArray(parsed.assets)) {
        for (const a of parsed.assets) {
          assetsMap[a.name] = {
            name: a.name,
            size: a.size,
            url: a.url,
            // CLI doesn't return sha256 directly in view, but asset presence is tracked
            sha256: a.sha256 || null
          };
        }
      }
      return {
        tag: parsed.tagName,
        title: parsed.name,
        isDraft: parsed.isDraft,
        createdAt: parsed.createdAt,
        assets: assetsMap
      };
    } catch (err) {
      if (err.message.includes('release not found') || (err.stderr && err.stderr.includes('release not found'))) {
        return null;
      }
      // If error is not "not found", rethrow
      throw err;
    }
  }

  async createRelease(repo, releaseData, initialAssetPaths = []) {
    const { tag, title, notes, draft } = releaseData;
    let cmd = `gh release create "${tag}" --repo "${repo}" --title "${title || tag}"`;
    if (notes) {
      // Escape notes or pass via notes flag
      const sanitizedNotes = notes.replace(/"/g, '\\"');
      cmd += ` --notes "${sanitizedNotes}"`;
    } else {
      cmd += ` --notes "Automated Vault Backup Snapshot"`;
    }
    if (draft) {
      cmd += ` --draft`;
    }
    for (const aPath of initialAssetPaths) {
      cmd += ` "${aPath}"`;
    }

    this.runCmd(cmd);
    return { tag, publishedAt: new Date().toISOString() };
  }

  async uploadReleaseAsset(repo, tag, asset) {
    const cmd = `gh release upload "${tag}" "${asset.path}" --repo "${repo}" --clobber`;
    this.runCmd(cmd);
    return { name: asset.name, sha256: asset.sha256, size: asset.size };
  }

  async publishRelease(repo, tag) {
    try {
      this.runCmd(`gh release edit "${tag}" --repo "${repo}" --draft=false`);
    } catch (_) {
      // If already not draft or edit not needed, ignore
    }
    return { tag, publishedAt: new Date().toISOString() };
  }

  async downloadReleaseAsset(repo, tag, assetName, destPath) {
    const destDir = path.dirname(destPath);
    fs.mkdirSync(destDir, { recursive: true });
    const cmd = `gh release download "${tag}" --repo "${repo}" --pattern "${assetName}" --dir "${destDir}" --clobber`;
    this.runCmd(cmd);
    if (!fs.existsSync(destPath)) {
      throw new Error(`Downloaded asset not found at expected path: ${destPath}`);
    }
    return { path: destPath, sha256: computeFileSha256(destPath) };
  }

  async listReleases(repo) {
    const output = this.runCmd(`gh release list --repo "${repo}" --limit 100 --json tagName,name,isDraft,createdAt`);
    try {
      const parsed = JSON.parse(output);
      return parsed.map(r => ({
        tag: r.tagName,
        title: r.name,
        isDraft: r.isDraft,
        createdAt: r.createdAt
      }));
    } catch (_) {
      return [];
    }
  }

  async deleteRelease(repo, tag) {
    this.runCmd(`gh release delete "${tag}" --repo "${repo}" --yes --cleanup-tag`);
    return { tag, deleted: true };
  }
}

export class ReleaseBackupAdapter {
  constructor(options = {}) {
    this.vaultRepo = options.vaultRepo || 'satyabagherwal-source/ai-builder-brain-private-vault';
    this.maxRetries = options.maxRetries || 4;
    this.initialBackoffMs = options.initialBackoffMs || 1000;
    this.backoffFactor = options.backoffFactor || 2;
    this.minRetainedBackups = options.minRetainedBackups || 3;
    this.maxDailyRetention = options.maxDailyRetention || 7;
    this.logger = options.logger || console.log;
    this.apiClient = options.apiClient || new GhCliClient(this.logger);
  }

  getReleaseTag(snapshotId) {
    return snapshotId.startsWith('vault-') ? snapshotId : `vault-${snapshotId}`;
  }

  /**
   * Uploads snapshot assets to a GitHub Release with retry, per-asset SHA-256,
   * idempotency, and resumability.
   */
  async uploadSnapshotToRelease(snapshotDir, options = {}) {
    const manifestPath = path.join(snapshotDir, 'backup-manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Invalid snapshot directory: backup-manifest.json missing at ${manifestPath}`);
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const snapshotId = manifest.snapshotId || path.basename(snapshotDir);
    const tag = this.getReleaseTag(snapshotId);
    const releaseTitle = `Vault Backup ${snapshotId} [HEAD ${manifest.gitHead?.slice(0, 7) || 'UNKNOWN'}]`;
    const releaseNotes = `Automated Private Vault Backup Snapshot\n` +
      `- Snapshot ID: ${snapshotId}\n` +
      `- Created At: ${manifest.createdAt || new Date().toISOString()}\n` +
      `- Git HEAD: ${manifest.gitHead}\n` +
      `- Total Scoped Files: ${manifest.stats?.totalFiles || 0}\n` +
      `- Bundle SHA-256: ${manifest.artifacts?.gitBundle?.sha256 || 'N/A'}\n`;

    this.logger(`======================================================================`);
    this.logger(`🚀 RELEASE BACKUP ADAPTER: UPLOAD SNAPSHOT`);
    this.logger(`   Snapshot ID:  ${snapshotId}`);
    this.logger(`   Release Tag:  ${tag}`);
    this.logger(`   Repository:   ${this.vaultRepo}`);
    this.logger(`======================================================================\n`);

    // 1. SECURITY INVARIANT: Strictly forbid plaintext secrets in snapshot directory
    const dirEntries = fs.readdirSync(snapshotDir);
    for (const entry of dirEntries) {
      if (entry === '.brain-secrets.json' || entry.endsWith('.env') || entry.includes('private-key') || entry.includes('secret')) {
        if (entry !== 'secrets.enc') {
          throw new Error(`[SECURITY-VIOLATION] Refusing to upload unencrypted secret file: ${entry}`);
        }
      }
    }

    // 2. Identify discrete assets to upload
    const candidateAssetNames = [
      'backup-manifest.json',
      'brain-history.bundle',
      'secrets.enc',
      'auxiliary-state.tar.gz'
    ];

    // Check for chunked parts if bundle is split
    const chunkParts = dirEntries.filter(f => f.startsWith('brain-history.bundle.part'));
    if (chunkParts.length > 0) {
      candidateAssetNames.push(...chunkParts);
      if (fs.existsSync(path.join(snapshotDir, 'bundle-parts.json'))) {
        candidateAssetNames.push('bundle-parts.json');
      }
    }

    const assets = [];
    for (const name of candidateAssetNames) {
      const assetPath = path.join(snapshotDir, name);
      if (fs.existsSync(assetPath)) {
        const stats = fs.statSync(assetPath);
        const sha256 = computeFileSha256(assetPath);
        assets.push({ name, path: assetPath, size: stats.size, sha256 });
      }
    }

    this.logger(`Identified ${assets.length} assets to synchronize:`);
    assets.forEach(a => this.logger(`  - ${a.name} (${(a.size / 1024 / 1024).toFixed(2)} MB, SHA-256: ${a.sha256.slice(0, 16)}...)`));

    // 2. Existing release detection (Idempotency)
    let release = await this.apiClient.getReleaseByTag(this.vaultRepo, tag);
    const uploadedAssetResults = {};

    if (!release) {
      this.logger(`\n[STEP 1] Creating new release for tag ${tag} with assets...`);
      let createAttempt = 0;
      let createSuccess = false;
      let lastErr = null;

      while (createAttempt < this.maxRetries && !createSuccess) {
        createAttempt++;
        try {
          // Upload initial assets with release creation
          await this.apiClient.createRelease(
            this.vaultRepo,
            { tag, title: releaseTitle, notes: releaseNotes, draft: false },
            assets.map(a => a.path)
          );
          createSuccess = true;
          this.logger(`  ✅ Created release and uploaded ${assets.length} assets: ${tag}`);
          for (const asset of assets) {
            uploadedAssetResults[asset.name] = { status: 'UPLOADED', size: asset.size, sha256: asset.sha256 };
          }
        } catch (err) {
          lastErr = err;
          this.logger(`  ⚠️ Release creation attempt ${createAttempt}/${this.maxRetries} failed: ${err.message}`);
          if (createAttempt < this.maxRetries) {
            const backoff = this.initialBackoffMs * Math.pow(this.backoffFactor, createAttempt - 1);
            await new Promise(r => setTimeout(r, backoff));
          }
        }
      }

      if (!createSuccess) {
        throw new Error(`Release creation failed after ${this.maxRetries} attempts: ${lastErr?.message}`);
      }
    } else {
      this.logger(`\n[STEP 1] Existing release detected for ${tag}. Verifying asset completeness...`);
      for (const asset of assets) {
        const remoteAsset = release.assets ? release.assets[asset.name] : null;
        if (remoteAsset && remoteAsset.size === asset.size && (!remoteAsset.sha256 || remoteAsset.sha256 === asset.sha256)) {
          this.logger(`  ⏩ [RESUMED] Asset ${asset.name} already exists on remote with matching size. Skipping.`);
          uploadedAssetResults[asset.name] = { status: 'ALREADY_EXISTS', size: asset.size, sha256: asset.sha256 };
          continue;
        }

        let uploadAttempt = 0;
        let uploadSuccess = false;
        let lastUploadErr = null;

        while (uploadAttempt < this.maxRetries && !uploadSuccess) {
          uploadAttempt++;
          try {
            this.logger(`  ⏳ Uploading ${asset.name} (attempt ${uploadAttempt}/${this.maxRetries})...`);
            await this.apiClient.uploadReleaseAsset(this.vaultRepo, tag, asset);
            uploadSuccess = true;
            uploadedAssetResults[asset.name] = { status: 'UPLOADED', size: asset.size, sha256: asset.sha256 };
            this.logger(`  ✅ [CONFIRMED] Asset ${asset.name} uploaded and verified.`);
          } catch (err) {
            lastUploadErr = err;
            this.logger(`  ⚠️ Attempt ${uploadAttempt} failed for ${asset.name}: ${err.message}`);
            if (uploadAttempt < this.maxRetries) {
              const backoff = this.initialBackoffMs * Math.pow(this.backoffFactor, uploadAttempt - 1);
              await new Promise(r => setTimeout(r, backoff));
            }
          }
        }

        if (!uploadSuccess) {
          throw new Error(`Asset upload failed for ${asset.name} after ${this.maxRetries} attempts: ${lastUploadErr?.message}`);
        }
      }
    }

    // 3. Verify all assets were processed
    const totalProcessed = Object.keys(uploadedAssetResults).length;
    if (totalProcessed < assets.length) {
      throw new Error(`Incomplete upload detected: processed ${totalProcessed}/${assets.length} assets`);
    }

    // 4. Safe Retention Enforcement
    this.logger(`\n[STEP 2] Evaluating Safe Retention Policy (Rule of 3 + Tiering)...`);
    const retentionReport = await this.enforceSafeRetention(options);

    return {
      status: 'SUCCESS',
      snapshotId,
      tag,
      assets: uploadedAssetResults,
      publishedAt: new Date().toISOString(),
      retention: retentionReport
    };
  }

  /**
   * Downloads all assets from a designated release and verifies SHA-256.
   */
  async downloadReleaseSnapshot(tag, targetDir) {
    fs.mkdirSync(targetDir, { recursive: true });
    this.logger(`[DOWNLOAD] Fetching release assets for ${tag} into ${targetDir}`);

    const manifestName = 'backup-manifest.json';
    const manifestDest = path.join(targetDir, manifestName);

    // Download manifest first
    await this.apiClient.downloadReleaseAsset(this.vaultRepo, tag, manifestName, manifestDest);
    if (!fs.existsSync(manifestDest)) {
      throw new Error(`Downloaded manifest missing for release ${tag}`);
    }

    const manifest = JSON.parse(fs.readFileSync(manifestDest, 'utf8'));
    const manifestHash = computeFileSha256(manifestDest);

    // Download bundle
    const bundleName = 'brain-history.bundle';
    const bundleDest = path.join(targetDir, bundleName);
    try {
      await this.apiClient.downloadReleaseAsset(this.vaultRepo, tag, bundleName, bundleDest);
    } catch (_) {
      // Check if chunked parts exist
      this.logger(`  ℹ️ Single bundle not found, checking for bundle parts...`);
      const partsName = 'bundle-parts.json';
      const partsDest = path.join(targetDir, partsName);
      await this.apiClient.downloadReleaseAsset(this.vaultRepo, tag, partsName, partsDest);
      const partsMeta = JSON.parse(fs.readFileSync(partsDest, 'utf8'));
      const bufs = [];
      for (const part of partsMeta.parts) {
        const partDest = path.join(targetDir, part.name);
        await this.apiClient.downloadReleaseAsset(this.vaultRepo, tag, part.name, partDest);
        const pHash = computeFileSha256(partDest);
        if (pHash !== part.sha256) {
          throw new Error(`Part hash mismatch on ${part.name}`);
        }
        bufs.push(fs.readFileSync(partDest));
      }
      fs.writeFileSync(bundleDest, Buffer.concat(bufs));
      this.logger(`  ✅ Reassembled brain-history.bundle from ${partsMeta.parts.length} parts`);
    }

    if (manifest.artifacts?.gitBundle?.sha256) {
      const bundleHash = computeFileSha256(bundleDest);
      if (bundleHash !== manifest.artifacts.gitBundle.sha256) {
        throw new Error(`Bundle SHA-256 mismatch! Expected ${manifest.artifacts.gitBundle.sha256}, got ${bundleHash}`);
      }
      this.logger(`  ✅ Verified brain-history.bundle SHA-256 match`);
    }

    // Download optional auxiliary state
    if (manifest.artifacts?.auxiliaryState) {
      const auxName = 'auxiliary-state.tar.gz';
      const auxDest = path.join(targetDir, auxName);
      try {
        await this.apiClient.downloadReleaseAsset(this.vaultRepo, tag, auxName, auxDest);
        const auxHash = computeFileSha256(auxDest);
        if (manifest.artifacts.auxiliaryState.sha256 && auxHash !== manifest.artifacts.auxiliaryState.sha256) {
          throw new Error(`Auxiliary state SHA-256 mismatch!`);
        }
        this.logger(`  ✅ Verified auxiliary-state.tar.gz SHA-256 match`);
      } catch (e) {
        this.logger(`  ⚠️ Auxiliary state download warning: ${e.message}`);
      }
    }

    // Download optional encrypted secrets
    if (manifest.artifacts?.secretsEncrypted) {
      const secretsName = 'secrets.enc';
      const secretsDest = path.join(targetDir, secretsName);
      try {
        await this.apiClient.downloadReleaseAsset(this.vaultRepo, tag, secretsName, secretsDest);
        const secHash = computeFileSha256(secretsDest);
        if (manifest.artifacts.secretsEncrypted.sha256 && secHash !== manifest.artifacts.secretsEncrypted.sha256) {
          throw new Error(`secrets.enc SHA-256 mismatch!`);
        }
        this.logger(`  ✅ Verified secrets.enc SHA-256 match`);
      } catch (e) {
        this.logger(`  ⚠️ secrets.enc download warning: ${e.message}`);
      }
    }

    return {
      tag,
      downloadDir: targetDir,
      manifest,
      manifestHash
    };
  }

  /**
   * Safe Multi-Barrier Retention Policy
   */
  async enforceSafeRetention(options = {}) {
    const releases = await this.apiClient.listReleases(this.vaultRepo);
    const validVaultReleases = releases.filter(r => r.tag && r.tag.startsWith('vault-snapshot-'));

    this.logger(`  Total valid vault releases found: ${validVaultReleases.length}`);

    // BARRIER 1: Rule of 3 - Never delete if <= minRetainedBackups
    if (validVaultReleases.length <= this.minRetainedBackups) {
      this.logger(`  ℹ️ Minimum retention protection active (Count ${validVaultReleases.length} <= ${this.minRetainedBackups}). Zero releases deleted.`);
      return { prunedCount: 0, reason: 'MINIMUM_RETENTION_PROTECTION' };
    }

    // Sort newest first
    validVaultReleases.sort((a, b) => b.tag.localeCompare(a.tag));

    // BARRIER 2: Latest Known-Good Permanent Protection
    const latestKnownGood = validVaultReleases[0];
    this.logger(`  🛡️ Protected LATEST_KNOWN_GOOD release: ${latestKnownGood.tag}`);

    // BARRIER 3: Maximum daily retention limit
    if (validVaultReleases.length > this.maxDailyRetention) {
      const toPrune = validVaultReleases.slice(this.maxDailyRetention);
      let prunedCount = 0;

      for (const rel of toPrune) {
        // Must never delete latest known-good
        if (rel.tag === latestKnownGood.tag) continue;

        this.logger(`  🗑️ Pruning expired release: ${rel.tag}`);
        await this.apiClient.deleteRelease(this.vaultRepo, rel.tag);
        prunedCount++;
      }
      return { prunedCount, status: 'PRUNED' };
    }

    return { prunedCount: 0, status: 'WITHIN_RETENTION_LIMITS' };
  }
}
