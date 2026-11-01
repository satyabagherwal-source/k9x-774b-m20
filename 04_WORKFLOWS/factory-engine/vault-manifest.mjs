/**
 * AI-Builder-Brain — Private Vault Manifest & Scope Classifier
 * Computes streaming SHA-256 digests and enforces rigorous backup scope boundaries.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Computes SHA-256 digest of a file synchronously using streaming buffer.
 */
export function computeFileSha256(filePath) {
  const hash = crypto.createHash('sha256');
  const buffer = fs.readFileSync(filePath);
  hash.update(buffer);
  return hash.digest('hex');
}

/**
 * Evaluates whether a file should be included in the backup snapshot
 * and returns categorization and rationale.
 * 
 * @param {string} relPath - Path relative to Brain root (using forward slashes)
 * @param {fs.Stats} stats - File stats
 * @returns {{ include: boolean, category: string, rationale: string }}
 */
export function classifyPath(relPath, stats) {
  const normalized = relPath.replace(/\\/g, '/');

  // Secrets: MUST NOT be included as plaintext
  if (normalized === '.brain-secrets.json' || normalized.endsWith('/.brain-secrets.json')) {
    return {
      include: false,
      category: 'encrypted_secret_vault',
      rationale: 'Plaintext secrets are excluded from standard tree; encrypted into secrets.enc via AES-256-GCM'
    };
  }

  // Git directory: Preserved atomically via Git Bundle, not raw file tree copy
  if (normalized === '.git' || normalized.startsWith('.git/')) {
    return {
      include: false,
      category: 'git_internal_objects',
      rationale: 'Active Git objects directory; captured atomically via Git Bundle to prevent concurrent corruption'
    };
  }

  // Kilo worktrees: Detached worktree clones duplicating git object storage
  if (normalized.startsWith('.kilo/worktrees/')) {
    return {
      include: false,
      category: 'detached_worktree_clone',
      rationale: 'Detached git worktree clone; all commit history is preserved in the Git Bundle'
    };
  }

  // Transient process locks in .harvest-locks
  if (normalized.startsWith('.harvest-locks/') && normalized.endsWith('.lock')) {
    return {
      include: false,
      category: 'transient_process_lock',
      rationale: 'Transient process lock file; must not persist into restore to prevent deadlocks'
    };
  }

  // Temporary harvest directories and clone sandboxes
  if (normalized.startsWith('.temp-harvest/') || normalized.includes('.shallow-clone/')) {
    return {
      include: false,
      category: 'ephemeral_clone_sandbox',
      rationale: 'Ephemeral clone directory for external repo harvesting'
    };
  }

  // OS files
  const basename = path.basename(normalized);
  if (['.DS_Store', 'Thumbs.db', 'Desktop.ini'].includes(basename)) {
    return {
      include: false,
      category: 'os_metadata',
      rationale: 'Operating system thumbnail / metadata cache'
    };
  }

  // Ephemeral temp files
  if (basename.endsWith('.tmp') || basename.endsWith('.temp') || basename.endsWith('~')) {
    return {
      include: false,
      category: 'ephemeral_temporary',
      rationale: 'Unpersisted temporary scratch file'
    };
  }

  // Existing backup snapshots themselves should not be recursively nested
  if (normalized === '.project-brain/backups' || normalized.startsWith('.project-brain/backups/')) {
    return {
      include: false,
      category: 'existing_backup_archive',
      rationale: 'Previous backup snapshot archives are not recursively re-bundled'
    };
  }

  // Vault remote cache repository should not be bundled
  if (normalized === '.project-brain/vault-remote-cache' || normalized.startsWith('.project-brain/vault-remote-cache/')) {
    return {
      include: false,
      category: 'vault_remote_cache',
      rationale: 'Local clone cache of private vault remote repository'
    };
  }

  // --- INCLUSIONS ---

  // Canonical 16 Folders
  const canonicalFolders = [
    '00_START_HERE', '01_CORE', '02_AGENT_INTELLIGENCE', '03_SKILLS',
    '04_WORKFLOWS', '05_KNOWLEDGE', '06_PROJECT_CONTEXT', '07_PROJECT_LEARNING',
    '08_VERIFICATION', '09_SOURCES', '10_PROMPTS', '11_INBOX',
    '12_DECISIONS', '13_GOVERNANCE', '14_EVOLUTION', '15_METADATA'
  ];
  for (const folder of canonicalFolders) {
    if (normalized === folder || normalized.startsWith(folder + '/')) {
      return {
        include: true,
        category: 'canonical_16_folders',
        rationale: `Core Brain 16-Folder Architecture: ${folder}`
      };
    }
  }

  // Agent Infrastructure
  if (normalized.startsWith('.agents/') || normalized.startsWith('.claude/')) {
    return {
      include: true,
      category: 'agent_infrastructure',
      rationale: 'Agent prompts, skills, commands, and tool configuration'
    };
  }

  // GitHub CI/CD & Harvester Workflows
  if (normalized.startsWith('.github/')) {
    return {
      include: true,
      category: 'ci_cd_harvester',
      rationale: 'Cloud Harvester and continuous autonomous workflows'
    };
  }

  // .harvest-locks persistent circuit breaker / rate limit state (JSON)
  if (normalized.startsWith('.harvest-locks/') && normalized.endsWith('.json')) {
    return {
      include: true,
      category: 'harvester_circuit_state',
      rationale: 'Durable circuit breaker & AI provider quota tracking state'
    };
  }

  // .project-brain: Checkpoints, Memory, Retrieval Cache, Incidents
  if (normalized.startsWith('.project-brain/')) {
    return {
      include: true,
      category: 'project_brain_state',
      rationale: 'Session memory, task checkpoints, retrieval cache, and incident post-mortems'
    };
  }

  // Operational logs with provenance and harvest history
  if (['daemon-harvester.log', 'dossier-distillation.log', 'internal-synthesis.log'].includes(basename)) {
    return {
      include: true,
      category: 'operational_logs',
      rationale: 'Harvesting cycle evidence, distillation provenance, and audit history'
    };
  }

  // Root scripts
  if (normalized.startsWith('scripts/')) {
    return {
      include: true,
      category: 'operational_scripts',
      rationale: 'Automation and verification scripts'
    };
  }

  // Root configuration and operational ledgers
  return {
    include: true,
    category: 'root_configuration',
    rationale: 'Root ledger, configuration, or operational manifest'
  };
}

/**
 * Scans the Brain repository directory and builds a complete backup manifest.
 * @param {string} rootDir - Path to Brain root
 * @returns {object} Full manifest structure
 */
export function buildBackupManifest(rootDir) {
  const includedEntries = [];
  const excludedEntries = [];
  let totalBytes = 0;

  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        const testStats = { isDirectory: () => true, isFile: () => false };
        const classification = classifyPath(relPath, testStats);

        // If whole directory is excluded, record and don't traverse
        if (!classification.include) {
          excludedEntries.push({
            relPath: relPath + '/',
            isDirectory: true,
            category: classification.category,
            rationale: classification.rationale
          });
          continue;
        }

        traverse(fullPath);
      } else if (entry.isFile()) {
        const stats = fs.statSync(fullPath);
        const classification = classifyPath(relPath, stats);

        if (classification.include) {
          const sha256 = computeFileSha256(fullPath);
          totalBytes += stats.size;
          includedEntries.push({
            relPath,
            size: stats.size,
            sha256,
            category: classification.category,
            rationale: classification.rationale
          });
        } else {
          excludedEntries.push({
            relPath,
            isDirectory: false,
            size: stats.size,
            category: classification.category,
            rationale: classification.rationale
          });
        }
      }
    }
  }

  traverse(rootDir);

  return {
    manifestVersion: '1.0.0',
    createdAt: new Date().toISOString(),
    rootDir: path.resolve(rootDir),
    stats: {
      totalFiles: includedEntries.length,
      totalBytes,
      totalExcluded: excludedEntries.length
    },
    files: includedEntries,
    exclusions: excludedEntries
  };
}

