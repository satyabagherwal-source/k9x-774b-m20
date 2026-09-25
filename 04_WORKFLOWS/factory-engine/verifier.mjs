import fs from 'fs';
import path from 'path';
import http from 'http';
import { execSync, spawn } from 'child_process';
import { checkEnvironment } from './env-checker.mjs';

export async function runComprehensiveVerification(projectDir) {
  const root = path.resolve(projectDir);
  const report = {
    projectName: path.basename(root),
    timestamp: new Date().toISOString(),
    overallStatus: 'READY',
    pillars: {},
    failures: [],
    warnings: []
  };

  // Pillar 1: Brain Bridge
  const bridgeFile = path.join(root, '.project-brain', 'brain-bridge.json');
  if (fs.existsSync(bridgeFile)) {
    try {
      const bridge = JSON.parse(fs.readFileSync(bridgeFile, 'utf-8'));
      const masterExists = bridge.masterBrainPath && fs.existsSync(bridge.masterBrainPath);
      report.pillars.brainBridge = {
        status: masterExists ? 'PASS' : 'PARTIAL',
        details: masterExists ? `Connected to ${bridge.masterBrainPath}` : 'Bridge configured, Master Brain offline fallback',
        masterBrainPath: bridge.masterBrainPath
      };
      if (!masterExists) {
        report.warnings.push('Master Brain path is currently offline or unreachable.');
      }
    } catch (e) {
      report.pillars.brainBridge = { status: 'FAIL', error: e.message };
      report.failures.push(`Invalid brain-bridge.json: ${e.message}`);
    }
  } else {
    report.pillars.brainBridge = { status: 'FAIL', error: 'Missing .project-brain/brain-bridge.json' };
    report.failures.push('Missing .project-brain/brain-bridge.json');
  }

  // Pillar 2: Environment
  const env = checkEnvironment();
  report.pillars.environment = {
    status: env.status === 'READY' ? 'PASS' : (env.status === 'PARTIAL' ? 'PARTIAL' : 'FAIL'),
    tools: env.tools,
    warnings: env.warnings
  };
  if (env.status === 'BLOCKED') {
    report.failures.push(...env.errors);
  }

  // Pillar 3: Project Context & Rules
  const contextExists = fs.existsSync(path.join(root, 'PROJECT_CONTEXT.md'));
  const rulesExists = fs.existsSync(path.join(root, 'PROJECT_RULES.md'));
  const stateExists = fs.existsSync(path.join(root, 'PROJECT_STATE.json'));
  const designExists = fs.existsSync(path.join(root, 'design.md'));

  const contextPassed = contextExists && rulesExists && stateExists && designExists;
  report.pillars.contextAndGovernance = {
    status: contextPassed ? 'PASS' : 'FAIL',
    details: { contextExists, rulesExists, stateExists, designExists }
  };
  if (!contextPassed) {
    report.failures.push('Missing core governance files (PROJECT_CONTEXT, PROJECT_RULES, PROJECT_STATE, or design.md)');
  }

  // Pillar 4: Architecture & Tailwind v4
  const astroConfigExists = fs.existsSync(path.join(root, 'astro.config.mjs'));
  const globalCss = path.join(root, 'src', 'styles', 'global.css');
  let tailwindV4Valid = false;
  if (fs.existsSync(globalCss)) {
    const cssContent = fs.readFileSync(globalCss, 'utf-8');
    tailwindV4Valid = cssContent.includes('@import "tailwindcss";') && cssContent.includes('@theme');
  }

  report.pillars.architecture = {
    status: (astroConfigExists && tailwindV4Valid) ? 'PASS' : 'FAIL',
    details: { astroConfigExists, tailwindV4Valid }
  };
  if (!astroConfigExists || !tailwindV4Valid) {
    report.failures.push('Architecture invalid: missing astro.config.mjs or Tailwind v4 CSS-first configuration');
  }

  // Pillar 5: Build Verification (Actual execution)
  try {
    const buildOutput = execSync('npm run build', {
      cwd: root,
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    const distIndex = path.join(root, 'dist', 'index.html');
    if (fs.existsSync(distIndex)) {
      const stats = fs.statSync(distIndex);
      report.pillars.build = {
        status: 'PASS',
        details: `dist/index.html generated (${stats.size} bytes)`
      };
    } else {
      report.pillars.build = {
        status: 'FAIL',
        details: 'Build exited 0 but dist/index.html not found'
      };
      report.failures.push('Production build did not output dist/index.html');
    }
  } catch (buildErr) {
    report.pillars.build = {
      status: 'FAIL',
      error: buildErr.stderr || buildErr.stdout || buildErr.message
    };
    report.failures.push(`Build failed: ${buildErr.message}`);
  }

  // Pillar 6: Dev Server & Runtime Verification
  const devPort = 4399; // Isolated probe port
  try {
    const devServerStatus = await probeDevServer(root, devPort);
    report.pillars.runtime = {
      status: devServerStatus.success ? 'PASS' : 'FAIL',
      details: devServerStatus.details
    };
    if (!devServerStatus.success) {
      report.failures.push(`Dev server probe failed: ${devServerStatus.details}`);
    }
  } catch (err) {
    report.pillars.runtime = {
      status: 'FAIL',
      error: err.message
    };
    report.failures.push(`Dev server error: ${err.message}`);
  }

  // Pillar 7: SEO & Design Tokens Check
  const distIndex = path.join(root, 'dist', 'index.html');
  if (fs.existsSync(distIndex)) {
    const html = fs.readFileSync(distIndex, 'utf-8');
    const hasTitle = /<title>[^<]+<\/title>/i.test(html);
    const hasMetaDesc = /<meta\s+name=["']description["']/i.test(html);
    const hasCanonical = /<link\s+rel=["']canonical["']/i.test(html);
    const hasViewport = /<meta\s+name=["']viewport["']/i.test(html);

    const seoValid = hasTitle && hasMetaDesc && hasCanonical && hasViewport;
    report.pillars.seoAndDesign = {
      status: seoValid ? 'PASS' : 'FAIL',
      details: { hasTitle, hasMetaDesc, hasCanonical, hasViewport }
    };
    if (!seoValid) {
      report.failures.push('SEO verification failed: missing title, description, canonical link, or viewport meta');
    }
  } else {
    report.pillars.seoAndDesign = { status: 'SKIPPED', details: 'dist/index.html not available' };
  }

  // Determine Overall Status
  if (report.failures.length > 0) {
    report.overallStatus = 'BLOCKED';
  } else if (report.warnings.length > 0 || Object.values(report.pillars).some(p => p.status === 'PARTIAL')) {
    report.overallStatus = 'PARTIAL';
  } else {
    report.overallStatus = 'READY';
  }

  return report;
}

function probeDevServer(cwd, port) {
  return new Promise((resolve) => {
    let resolved = false;
    let interval = null;
    let overallTimeout = null;

    const proc = spawn('npx.cmd', ['astro', 'dev', '--port', String(port), '--host', '127.0.0.1'], {
      cwd,
      shell: true,
      stdio: 'pipe'
    });

    const cleanup = (success, details) => {
      if (resolved) return;
      resolved = true;
      if (interval) clearInterval(interval);
      if (overallTimeout) clearTimeout(overallTimeout);

      try {
        if (process.platform === 'win32' && proc.pid) {
          execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: 'ignore' });
        } else {
          proc.kill('SIGINT');
        }
      } catch (e) {}

      resolve({ success, details });
    };

    let attempts = 0;
    interval = setInterval(() => {
      attempts++;
      const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
        if (res.statusCode === 200) {
          cleanup(true, `HTTP 200 OK received on port ${port} after ${attempts} attempts`);
        }
      });

      req.on('error', () => {
        if (attempts >= 15) {
          cleanup(false, `Timeout waiting for dev server on port ${port}`);
        }
      });
      req.setTimeout(1000, () => req.destroy());
    }, 1000);

    overallTimeout = setTimeout(() => {
      cleanup(false, `Dev server probe timed out after 18 seconds`);
    }, 18000);
  });
}
