import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export function setupGitRepository(targetDir, projectName, createGitHubRemote = false) {
  const result = {
    initialized: false,
    committed: false,
    githubLinked: false,
    remoteUrl: null,
    errors: []
  };

  const gitDir = path.join(targetDir, '.git');

  // 1. Git init
  try {
    if (!fs.existsSync(gitDir)) {
      execSync('git init -b main', { cwd: targetDir, stdio: 'pipe' });
      result.initialized = true;
    } else {
      result.initialized = true;
    }
  } catch (err) {
    try {
      execSync('git init', { cwd: targetDir, stdio: 'pipe' });
      execSync('git branch -M main', { cwd: targetDir, stdio: 'pipe' });
      result.initialized = true;
    } catch (e2) {
      result.errors.push(`git init failed: ${e2.message}`);
      return result;
    }
  }

  // 2. Initial commit
  try {
    execSync('git add .', { cwd: targetDir, stdio: 'pipe' });
    const status = execSync('git status --porcelain', { cwd: targetDir, encoding: 'utf-8' }).trim();
    if (status.length > 0) {
      execSync('git commit -m "feat: initial project bootstrap by AI Project Factory"', {
        cwd: targetDir,
        stdio: 'pipe'
      });
      result.committed = true;
    } else {
      result.committed = true; // Nothing to commit
    }
  } catch (err) {
    result.errors.push(`git commit failed: ${err.message}`);
  }

  // 3. Optional GitHub repo creation
  if (createGitHubRemote) {
    try {
      const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      execSync(`gh repo create "${sanitizedName}" --private --source=. --remote=origin`, {
        cwd: targetDir,
        stdio: 'pipe'
      });
      const remote = execSync('git remote get-url origin', { cwd: targetDir, encoding: 'utf-8' }).trim();
      result.githubLinked = true;
      result.remoteUrl = remote;
    } catch (err) {
      result.errors.push(`GitHub repo creation via gh failed: ${err.message}`);
    }
  }

  return result;
}

export function verifyGitStatus(targetDir) {
  try {
    const isGit = fs.existsSync(path.join(targetDir, '.git'));
    if (!isGit) return { isRepo: false };

    const branch = execSync('git branch --show-current', { cwd: targetDir, encoding: 'utf-8' }).trim();
    const status = execSync('git status --porcelain', { cwd: targetDir, encoding: 'utf-8' }).trim();
    let remote = null;
    try {
      remote = execSync('git remote get-url origin', { cwd: targetDir, encoding: 'utf-8' }).trim();
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
