import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Autonomous Git & GitHub Setup Manager
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\git-manager.mjs
 * Purpose: Initializes independent local Git repository, validates identity,
 *          configures remotes when authorized.
 * 
 * CANONICAL POLICY:
 * Project Factory only sets up Git (git init -b main, identity check, .gitignore).
 * AUTO-COMMIT IS DISABLED.
 * The user controls staging and commits ("commit me karunga bas setup karna h tumhe to").
 */

export function setupGitRepository(targetDir, projectName, options = {}) {
  const root = path.resolve(targetDir);
  const result = {
    initialized: false,
    committed: false,
    commitDeferredToUser: true,
    identityConfigured: false,
    githubLinked: false,
    remoteUrl: null,
    branch: 'main',
    errors: [],
    warnings: []
  };

  const gitDir = path.join(root, '.git');

  // Helper command runner
  function runGit(cmd) {
    return execSync(cmd, { cwd: root, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  }

  // 1. Git Init
  try {
    if (!fs.existsSync(gitDir)) {
      try {
        runGit('git init -b main');
      } catch (e) {
        runGit('git init');
        runGit('git branch -M main');
      }
      result.initialized = true;
    } else {
      result.initialized = true;
    }
    result.branch = 'main';
  } catch (err) {
    result.errors.push(`git init failed: ${err.message}`);
    return result;
  }

  // 2. Git Identity Check & Safe Configuration
  try {
    let userName = null;
    let userEmail = null;
    try { userName = runGit('git config user.name'); } catch (e) {}
    try { userEmail = runGit('git config user.email'); } catch (e) {}

    if (!userName || !userEmail) {
      // Check if gh CLI has username
      let ghUser = 'AI-Builder-Agent';
      try {
        const ghOut = execSync('gh auth status', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        const match = ghOut.match(/account\s+([\w-]+)/i);
        if (match) ghUser = match[1];
      } catch (e) {}

      if (!userName) runGit(`git config user.name "${ghUser}"`);
      if (!userEmail) runGit(`git config user.email "${ghUser}@users.noreply.github.com"`);
      result.identityConfigured = true;
    } else {
      result.identityConfigured = true;
    }
  } catch (err) {
    result.warnings.push(`Git identity check warning: ${err.message}`);
  }

  // 3. User-Managed Commits (Auto-commit disabled)
  // Per canonical policy: "commit me karunga bas setup karna h tumhe to"
  result.committed = false;
  result.commitDeferredToUser = true;

  // 4. Remote Configuration (if explicit remoteUrl provided)
  if (options.remoteUrl) {
    try {
      try {
        runGit(`git remote add origin ${options.remoteUrl}`);
      } catch (e) {
        runGit(`git remote set-url origin ${options.remoteUrl}`);
      }
      result.remoteUrl = options.remoteUrl;
      result.githubLinked = true;
    } catch (err) {
      result.errors.push(`Failed to set git remote: ${err.message}`);
    }
  }

  return result;
}

export function verifyGitStatus(targetDir) {
  const root = path.resolve(targetDir);
  try {
    const isGit = fs.existsSync(path.join(root, '.git'));
    if (!isGit) return { isRepo: false };

    let branch = 'main';
    try {
      branch = execSync('git branch --show-current', { cwd: root, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim() || 'main';
    } catch (e) {}

    let status = '';
    try {
      status = execSync('git status --porcelain', { cwd: root, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    } catch (e) {}

    let remote = null;
    try {
      remote = execSync('git remote get-url origin', { cwd: root, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    } catch (e) {}

    return {
      isRepo: true,
      branch,
      setupReady: true,
      commitDeferredToUser: true,
      clean: status.length === 0,
      modifiedFiles: status ? status.split('\n').map(l => l.trim()) : [],
      remote
    };
  } catch (err) {
    return { isRepo: false, error: err.message };
  }
}
