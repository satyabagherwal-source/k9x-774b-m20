import { execSync } from 'child_process';

/**
 * Universal Environment Resolution & Capability Checker
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\env-checker.mjs
 * Purpose: Inspects developer machine environment, validates required tools
 *          against the active project profile, and safely handles missing dependencies.
 */

export function checkEnvironment(profile = null) {
  const results = {
    timestamp: new Date().toISOString(),
    status: 'READY',
    platform: process.platform,
    arch: process.arch,
    tools: {},
    warnings: [],
    errors: [],
    profileId: profile?.id || 'default'
  };

  const requiredToolList = profile?.requiredTools || ['node', 'npm', 'git'];
  const optionalToolList = profile?.optionalTools || ['gh', 'vercel', 'python', 'docker'];

  // Helper command runner
  function runCmd(cmd) {
    try {
      return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    } catch (e) {
      return null;
    }
  }

  // 1. Node.js check
  const nodeVersion = process.version;
  const majorNode = parseInt(nodeVersion.replace('v', '').split('.')[0], 10);
  results.tools.node = {
    installed: true,
    version: nodeVersion,
    valid: majorNode >= 18,
    required: requiredToolList.includes('node')
  };
  if (majorNode < 18 && results.tools.node.required) {
    results.errors.push(`Node.js version ${nodeVersion} is below required minimum v18.0.0`);
    results.status = 'BLOCKED';
  }

  // 2. npm check
  const npmVer = runCmd('npm -v');
  results.tools.npm = {
    installed: Boolean(npmVer),
    version: npmVer,
    valid: Boolean(npmVer),
    required: requiredToolList.includes('npm')
  };
  if (!npmVer && results.tools.npm.required) {
    results.errors.push('npm is not installed or accessible in PATH');
    results.status = 'BLOCKED';
  }

  // 3. Alternative package managers (pnpm, yarn, bun)
  const pnpmVer = runCmd('pnpm -v');
  results.tools.pnpm = { installed: Boolean(pnpmVer), version: pnpmVer, required: requiredToolList.includes('pnpm') };
  const yarnVer = runCmd('yarn -v');
  results.tools.yarn = { installed: Boolean(yarnVer), version: yarnVer, required: requiredToolList.includes('yarn') };
  const bunVer = runCmd('bun -v');
  results.tools.bun = { installed: Boolean(bunVer), version: bunVer, required: requiredToolList.includes('bun') };

  // 4. Git check
  const gitVer = runCmd('git --version');
  results.tools.git = {
    installed: Boolean(gitVer),
    version: gitVer,
    valid: Boolean(gitVer),
    required: requiredToolList.includes('git')
  };
  if (!gitVer && results.tools.git.required) {
    results.errors.push('git is not installed or accessible in PATH');
    results.status = 'BLOCKED';
  }

  // 5. GitHub CLI (gh) check & auth
  const ghVer = runCmd('gh --version');
  if (ghVer) {
    let authUser = null;
    let authStatus = false;
    try {
      const authOutput = execSync('gh auth status', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      authStatus = true;
      const match = authOutput.match(/account\s+([\w-]+)/i);
      if (match) authUser = match[1];
    } catch (authErr) {
      const stderr = authErr.stderr?.toString() || authErr.stdout?.toString() || '';
      if (stderr.includes('Logged in to github.com')) {
        authStatus = true;
        const match = stderr.match(/account\s+([\w-]+)/i);
        if (match) authUser = match[1];
      }
    }

    results.tools.gh = {
      installed: true,
      version: ghVer.split('\n')[0].trim(),
      authenticated: authStatus,
      account: authUser,
      required: requiredToolList.includes('gh')
    };

    if (!authStatus && results.tools.gh.required) {
      results.warnings.push('GitHub CLI (gh) is installed but not authenticated. Run "gh auth login".');
      if (results.status === 'READY') results.status = 'PARTIAL';
    }
  } else {
    results.tools.gh = { installed: false, required: requiredToolList.includes('gh') };
    if (results.tools.gh.required) {
      results.errors.push('GitHub CLI (gh) is required for this profile but not installed.');
      results.status = 'BLOCKED';
    } else {
      results.warnings.push('GitHub CLI (gh) is not installed; automated remote repository creation will be skipped.');
    }
  }

  // 6. Python check
  const pythonVer = runCmd('python --version');
  results.tools.python = {
    installed: Boolean(pythonVer),
    version: pythonVer,
    required: requiredToolList.includes('python')
  };
  if (!pythonVer && results.tools.python.required) {
    results.errors.push('Python is required for this profile but not found in PATH');
    results.status = 'BLOCKED';
  }

  // 7. Docker check
  const dockerVer = runCmd('docker --version');
  results.tools.docker = {
    installed: Boolean(dockerVer),
    version: dockerVer,
    required: requiredToolList.includes('docker')
  };
  if (!dockerVer && results.tools.docker.required) {
    results.errors.push('Docker is required for this profile but not installed or running');
    results.status = 'BLOCKED';
  }

  // 8. Vercel check
  const vercelVer = runCmd('npx --no-install vercel --version');
  results.tools.vercel = {
    installed: Boolean(vercelVer),
    version: vercelVer,
    runner: vercelVer ? 'local' : 'npx on-demand'
  };

  // Determine overall status
  if (results.errors.length > 0) {
    results.status = 'BLOCKED';
  } else if (results.warnings.length > 0 && results.status !== 'BLOCKED') {
    // If only non-blocking warnings exist, status is READY or PARTIAL
    results.status = results.tools.gh.authenticated ? 'READY' : 'PARTIAL';
  }

  return results;
}

/**
 * Evaluates whether a missing dependency can be safely auto-installed.
 * Dangerous, destructive, paid, or credential-sensitive actions are NEVER silently executed.
 */
export function evaluateDependencyResolution(toolName) {
  const safeNpmPackages = ['@astrojs/mcp', 'vercel', 'typescript', 'prettier', 'eslint'];

  if (safeNpmPackages.includes(toolName)) {
    return {
      safeToAutoInstall: true,
      method: 'npm',
      command: `npm install -D ${toolName}`,
      requiresAuth: false
    };
  }

  return {
    safeToAutoInstall: false,
    method: 'manual_or_system',
    message: `Tool "${toolName}" requires system-level or credentialed installation. Silent auto-installation disallowed by Factory Governance.`,
    requiresAuth: true
  };
}
