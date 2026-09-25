import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Autonomous Git & GitHub Lifecycle Manager
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\git-manager.mjs
 * Purpose: Manages complete local Git initialization, identity validation,
 *          initial commit, remote configuration, GitHub repo creation when authorized,
 *          and clean working tree verification.
 */

export function setupGitRepository(targetDir, projectName, options = {}) {
  const root = path.resolve(targetDir);
  const result = {
    initialized: false,
    committed: false,
    identityConfigured: false,
    githubLinked: false,
    remoteUrl: null,
    branch: 'main',
    cleanWorkingTree: false,
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

  // 3. Stage and Initial Commit
  try {
    runGit('git add .');
    const status = runGit('git status --porcelain');
    if (status.length > 0) {
      runGit(`git commit -m "feat: initial project bootstrap by AI Project Factory (${projectName})"`);
      result.committed = true;
    } else {
      result.committed = true; // Clean tree
    }
  } catch (err) {
    result.errors.push(`git commit failed: ${err.message}`);
  }

  // 4. Remote Configuration & Optional GitHub Repo Creation
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
  } else if (options.createGhRepo === true) {
    try {
      const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      runGit(`gh repo create "${sanitizedName}" --private --source=. --remote=origin --push`);
      const remote = runGit('git remote get-url origin');
      result.githubLinked = true;
      result.remoteUrl = remote;
    } catch (err) {
      result.warnings.push(`gh repo create skipped or failed: ${err.message}`);
    }
  }

  // 5. Clean working tree audit
  try {
    const finalStatus = runGit('git status --porcelain');
    result.cleanWorkingTree = finalStatus.length === 0;
    result.branch = runGit('git branch --show-current') || 'main';
  } catch (e) {}

  return result;
}

export function verifyGitStatus(targetDir) {
  const root = path.resolve(targetDir);
  try {
    const isGit = fs.existsSync(path.join(root, '.git'));
    if (!isGit) return { isRepo: false };

    const branch = execSync('git branch --show-current', { cwd: root, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const status = execSync('git status --porcelain', { cwd: root, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    let remote = null;
    try {
      remote = execSync('git remote get-url origin', { cwd: root, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    } catch (e) {}

    return {
      isRepo: true,
      branch,
      clean: status.length === 0,
      modifiedFiles: status ? status.split('\n').map(l => l.trim()) : [],
      remote
    };
  } catch (err) {
    return { isRepo: false, error: err.message };
  }
}
