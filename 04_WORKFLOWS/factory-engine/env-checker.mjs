import { execSync } from 'child_process';

export function checkEnvironment() {
  const results = {
    timestamp: new Date().toISOString(),
    status: 'READY',
    tools: {},
    warnings: [],
    errors: []
  };

  // 1. Node.js check
  try {
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.replace('v', '').split('.')[0], 10);
    results.tools.node = {
      installed: true,
      version: nodeVersion,
      valid: major >= 18
    };
    if (major < 18) {
      results.errors.push(`Node.js version ${nodeVersion} is below required minimum v18.0.0`);
      results.status = 'BLOCKED';
    }
  } catch (err) {
    results.tools.node = { installed: false, error: err.message };
    results.errors.push('Node.js is not found in PATH');
    results.status = 'BLOCKED';
  }

  // 2. npm check
  try {
    const npmVersion = execSync('npm -v', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    results.tools.npm = {
      installed: true,
      version: npmVersion,
      valid: true
    };
  } catch (err) {
    results.tools.npm = { installed: false, error: err.message };
    results.errors.push('npm is not installed or accessible in PATH');
    results.status = 'BLOCKED';
  }

  // 3. Git check
  try {
    const gitVersion = execSync('git --version', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    results.tools.git = {
      installed: true,
      version: gitVersion,
      valid: true
    };
  } catch (err) {
    results.tools.git = { installed: false, error: err.message };
    results.errors.push('git is not installed or accessible in PATH');
    results.status = 'BLOCKED';
  }

  // 4. GitHub CLI (gh) check & auth
  try {
    const ghVersion = execSync('gh --version', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).split('\n')[0].trim();
    let authUser = null;
    let authStatus = false;
    try {
      const authOutput = execSync('gh auth status', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      authStatus = true;
      const match = authOutput.match(/account\s+([\w-]+)/i);
      if (match) authUser = match[1];
    } catch (authErr) {
      // Sometimes gh auth status outputs to stderr even on success or partial
      const stderr = authErr.stderr?.toString() || authErr.stdout?.toString() || '';
      if (stderr.includes('Logged in to github.com')) {
        authStatus = true;
        const match = stderr.match(/account\s+([\w-]+)/i);
        if (match) authUser = match[1];
      }
    }

    results.tools.gh = {
      installed: true,
      version: ghVersion,
      authenticated: authStatus,
      account: authUser
    };

    if (!authStatus) {
      results.warnings.push('GitHub CLI (gh) is installed but not authenticated. Run "gh auth login".');
      if (results.status === 'READY') results.status = 'PARTIAL';
    }
  } catch (err) {
    results.tools.gh = { installed: false };
    results.warnings.push('GitHub CLI (gh) is not installed. GitHub automated repo creation will be disabled.');
    if (results.status === 'READY') results.status = 'PARTIAL';
  }

  // 5. Vercel check
  try {
    const vercelVersion = execSync('npx --no-install vercel --version', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    results.tools.vercel = { installed: true, version: vercelVersion, runner: 'local/npx' };
  } catch (err) {
    results.tools.vercel = { installed: false, runner: 'npx on-demand' };
    results.warnings.push('Vercel CLI not installed locally; npx vercel can be used on demand.');
  }

  return results;
}
