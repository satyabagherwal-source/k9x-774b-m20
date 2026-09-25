import fs from 'fs';
import path from 'path';
import http from 'http';
import { execSync, spawn } from 'child_process';
import { checkEnvironment } from './env-checker.mjs';
import { verifyGitStatus } from './git-manager.mjs';
import { verifyMCPHealth } from './mcp-registry.mjs';

/**
 * Universal Dynamic Multi-Layer Verification Framework
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\verifier.mjs
 * Purpose: Dynamically composes and executes multi-pillar verification suites
 *          based on the active project profile.
 * 
 * CANONICAL BOUNDARY ENFORCEMENT:
 * Evaluates Pillar 10 (productGenerationBoundary) to verify that the Factory
 * initialized ONLY the development environment and strictly avoided creating
 * actual product components, pages, features, or business logic.
 */

export function verifyProductGenerationBoundary(projectDir, profile = null) {
  const root = path.resolve(projectDir);
  const violations = [];

  // 1. Check for product-specific components in src/components
  const componentsDir = path.join(root, 'src', 'components');
  if (fs.existsSync(componentsDir)) {
    const files = fs.readdirSync(componentsDir).filter(f => !f.startsWith('.') && f !== '.gitkeep');
    if (files.length > 0) {
      violations.push(`Unexpected product components found in src/components: ${files.join(', ')}`);
    }
  }

  // 2. Check for extra product pages in src/pages
  const pagesDir = path.join(root, 'src', 'pages');
  if (fs.existsSync(pagesDir)) {
    const pages = fs.readdirSync(pagesDir).filter(f => !f.startsWith('.') && f !== '.gitkeep');
    // Only the single environment starter index.astro is permitted in Phase A
    const extraPages = pages.filter(p => p !== 'index.astro');
    if (extraPages.length > 0) {
      violations.push(`Unexpected product pages found in src/pages: ${extraPages.join(', ')}`);
    }
  }

  // 3. Check for product features directory
  const featuresDir = path.join(root, 'src', 'features');
  if (fs.existsSync(featuresDir)) {
    const features = fs.readdirSync(featuresDir).filter(f => !f.startsWith('.') && f !== '.gitkeep');
    if (features.length > 0) {
      violations.push(`Unexpected product feature modules found in src/features: ${features.join(', ')}`);
    }
  }

  // 4. Content / domain scan for known forbidden product items
  const forbiddenPatterns = [
    { regex: /class\s+FontExtractor|FontFinder|AdSenseBanner|Protractor|Calculator/i, label: 'Domain product component/logic' },
    { regex: /adsbygoogle/i, label: 'AdSense product ad unit' },
    { regex: /Model Execution Playground|Input Prompt Directive/i, label: 'Interactive AI product playground' }
  ];

  function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === '.astro') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDirectory(full);
      } else if (['.astro', '.tsx', '.jsx', '.ts', '.js', '.vue'].includes(path.extname(entry.name))) {
        const content = fs.readFileSync(full, 'utf-8');
        for (const pattern of forbiddenPatterns) {
          if (pattern.regex.test(content)) {
            violations.push(`Forbidden product code detected in ${path.relative(root, full)}: ${pattern.label}`);
          }
        }
      }
    }
  }

  scanDirectory(path.join(root, 'src'));

  return {
    status: violations.length === 0 ? 'PASS' : 'FAIL',
    violations,
    details: violations.length === 0 
      ? '0 product components, 0 extra product pages, 0 business logic detected. Strict environment boundary verified.'
      : violations.join('; ')
  };
}

export async function runComprehensiveVerification(projectDir, options = {}) {
  const root = path.resolve(projectDir);
  const report = {
    projectName: path.basename(root),
    timestamp: new Date().toISOString(),
    overallStatus: 'READY',
    profileId: 'default',
    pillars: {},
    failures: [],
    warnings: []
  };

  // Determine profile from state or options
  let profile = options.profile || null;
  const stateFile = path.join(root, 'PROJECT_STATE.json');
  if (!profile && fs.existsSync(stateFile)) {
    try {
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      if (state.projectClass) {
        report.profileId = state.projectClass;
      }
    } catch (e) {}
  } else if (profile) {
    report.profileId = profile.id;
  }

  // Pillar 1: Brain Bridge
  const bridgeFile = path.join(root, '.project-brain', 'brain-bridge.json');
  if (fs.existsSync(bridgeFile)) {
    try {
      const bridge = JSON.parse(fs.readFileSync(bridgeFile, 'utf-8'));
      const masterExists = bridge.masterBrainPath && fs.existsSync(bridge.masterBrainPath);
      report.pillars.brainBridge = {
        status: masterExists ? 'PASS' : 'PARTIAL',
        details: masterExists ? `Connected to ${bridge.masterBrainPath}` : 'Bridge configured, Master Brain offline fallback',
        masterBrainPath: bridge.masterBrainPath,
        zeroCopyEnforced: bridge.zeroCopyEnforced !== false
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

  // Pillar 2: System Environment
  const env = checkEnvironment(profile);
  report.pillars.environment = {
    status: env.status === 'READY' ? 'PASS' : (env.status === 'PARTIAL' ? 'PARTIAL' : 'FAIL'),
    tools: env.tools,
    warnings: env.warnings
  };
  if (env.status === 'BLOCKED') {
    report.failures.push(...env.errors);
  }

  // Pillar 3: Project-Local Brain & Governance (All 11 Mandatory Files)
  const mandatoryFiles = [
    'PROJECT_CONTEXT.md',
    'PROJECT_RULES.md',
    'PROJECT_KNOWLEDGE.md',
    'PROJECT_SKILLS.md',
    'PROJECT_STATE.json',
    'PROJECT_LEARNING.md',
    'PROJECT_DECISIONS.md',
    'PROJECT_ARCHITECTURE.md',
    'PROJECT_REQUIREMENTS.md',
    'PROJECT_ENVIRONMENT.md'
  ];

  const missingFiles = [];
  for (const file of mandatoryFiles) {
    const fullPath = path.join(root, file);
    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).size === 0) {
      missingFiles.push(file);
    }
  }

  // 11th file: check for ENVIRONMENT_READY_CERTIFICATE.md or PROJECT_READY_CERTIFICATE.md
  const hasCert = (fs.existsSync(path.join(root, 'ENVIRONMENT_READY_CERTIFICATE.md')) && fs.statSync(path.join(root, 'ENVIRONMENT_READY_CERTIFICATE.md')).size > 0) ||
                  (fs.existsSync(path.join(root, 'PROJECT_READY_CERTIFICATE.md')) && fs.statSync(path.join(root, 'PROJECT_READY_CERTIFICATE.md')).size > 0);
  if (!hasCert) {
    missingFiles.push('ENVIRONMENT_READY_CERTIFICATE.md');
  }

  const incidentsDirExists = fs.existsSync(path.join(root, '.project-brain', 'incidents'));
  const lessonsDirExists = fs.existsSync(path.join(root, '.project-brain', 'lessons'));
  const queueDirExists = fs.existsSync(path.join(root, '.project-brain', 'promotion-queue'));
  const dirsValid = incidentsDirExists && lessonsDirExists && queueDirExists;

  const governancePassed = missingFiles.length === 0 && dirsValid;
  report.pillars.contextAndGovernance = {
    status: governancePassed ? 'PASS' : 'FAIL',
    details: {
      verifiedFilesCount: 11 - missingFiles.length,
      totalMandatory: 11,
      missingFiles,
      directoriesValid: dirsValid
    }
  };
  if (!governancePassed) {
    report.failures.push(`Missing or empty governance files: ${missingFiles.join(', ')}`);
  }

  // Pillar 4: Architecture & Configuration
  const isAstro = fs.existsSync(path.join(root, 'astro.config.mjs'));
  const isVite = fs.existsSync(path.join(root, 'vite.config.ts')) || fs.existsSync(path.join(root, 'vite.config.js'));
  const globalCss = path.join(root, 'src', 'styles', 'global.css');
  let tailwindV4Valid = false;
  if (fs.existsSync(globalCss)) {
    const cssContent = fs.readFileSync(globalCss, 'utf-8');
    tailwindV4Valid = cssContent.includes('@import "tailwindcss";') && cssContent.includes('@theme');
  }

  const archPassed = (isAstro || isVite) && tailwindV4Valid;
  report.pillars.architecture = {
    status: archPassed ? 'PASS' : 'FAIL',
    details: { isAstro, isVite, tailwindV4Valid }
  };
  if (!archPassed) {
    report.failures.push('Architecture invalid: missing framework config (astro.config.mjs / vite.config.ts) or Tailwind v4 @theme tokens');
  }

  // Pillar 5: Production Build Verification
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

  // Pillar 6: Dev Server / Runtime Probe
  const devPort = options.port || (isAstro ? 4399 : 3099);
  try {
    const serverType = isAstro ? 'astro' : (fs.existsSync(path.join(root, 'server', 'server.mjs')) ? 'node-express' : 'vite');
    const runtimeStatus = await probeServer(root, devPort, serverType);
    report.pillars.runtime = {
      status: runtimeStatus.success ? 'PASS' : 'FAIL',
      details: runtimeStatus.details
    };
    if (!runtimeStatus.success) {
      report.failures.push(`Runtime server probe failed: ${runtimeStatus.details}`);
    }
  } catch (err) {
    report.pillars.runtime = {
      status: 'FAIL',
      error: err.message
    };
    report.failures.push(`Runtime server probe error: ${err.message}`);
  }

  // Pillar 7: Environment Readiness & Quality Contracts
  const distIndex = path.join(root, 'dist', 'index.html');
  if (isAstro) {
    if (fs.existsSync(distIndex)) {
      const html = fs.readFileSync(distIndex, 'utf-8');
      const hasTitle = /<title>[^<]+<\/title>/i.test(html);
      const hasViewport = /<meta\s+name=["']viewport["']/i.test(html);

      const envValid = hasTitle && hasViewport;
      report.pillars.environmentQuality = {
        status: envValid ? 'PASS' : 'FAIL',
        details: { hasTitle, hasViewport }
      };
      if (!envValid) {
        report.failures.push('Environment HTML verification failed: missing title or viewport meta in dist/index.html');
      }
    } else {
      report.pillars.environmentQuality = { status: 'SKIPPED', details: 'dist/index.html not available' };
    }
  } else {
    const hasServer = fs.existsSync(path.join(root, 'server', 'server.mjs'));
    const hasClient = fs.existsSync(path.join(root, 'src', 'api', 'ai-client.ts'));
    const envValid = hasServer && hasClient;

    report.pillars.environmentQuality = {
      status: envValid ? 'PASS' : 'FAIL',
      details: { hasServer, hasClient }
    };
    if (!envValid) {
      report.failures.push('Environment Quality check failed: missing server/server.mjs or src/api/ai-client.ts');
    }
  }

  // Pillar 8: Git Repository Setup (Commit Managed by User)
  const gitStatus = verifyGitStatus(root);
  report.pillars.gitStatus = {
    status: gitStatus.isRepo ? 'PASS' : 'FAIL',
    details: gitStatus.isRepo 
      ? `Git repository initialized (${gitStatus.branch || 'main'}). Setup complete. Commit managed by user.`
      : 'Git repository not initialized'
  };
  if (!gitStatus.isRepo) {
    report.failures.push('Git repository not initialized');
  }

  // Pillar 9: MCP Health Check
  const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf-8')) : {};
  const activeMcps = state.capabilities?.mcpServers || [];
  if (activeMcps.length > 0) {
    const mcpResults = {};
    let allMcpsHealthy = true;
    for (const mcpKey of activeMcps) {
      const health = verifyMCPHealth(mcpKey, root);
      mcpResults[mcpKey] = health;
      if (!health.healthy && health.status !== 'CREDENTIALS_MISSING') {
        allMcpsHealthy = false;
      }
    }
    report.pillars.mcpHealth = {
      status: allMcpsHealthy ? 'PASS' : 'PARTIAL',
      servers: mcpResults
    };
  }

  // Pillar 10: PRODUCT GENERATION BOUNDARY (Canonical Check)
  const boundaryCheck = verifyProductGenerationBoundary(root, profile);
  report.pillars.productGenerationBoundary = {
    status: boundaryCheck.status,
    details: boundaryCheck.details,
    violations: boundaryCheck.violations
  };
  if (boundaryCheck.status !== 'PASS') {
    report.failures.push(`FACTORY BOUNDARY VIOLATION: Factory generated actual product code during environment bootstrap: ${boundaryCheck.violations.join('; ')}`);
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

function probeServer(cwd, port, serverType) {
  return new Promise((resolve) => {
    let resolved = false;
    let interval = null;
    let overallTimeout = null;

    let proc = null;
    let probeUrl = `http://127.0.0.1:${port}/`;

    if (serverType === 'astro') {
      proc = spawn('npx.cmd', ['astro', 'dev', '--port', String(port), '--host', '127.0.0.1'], {
        cwd,
        shell: true,
        stdio: 'pipe'
      });
      probeUrl = `http://127.0.0.1:${port}/`;
    } else if (serverType === 'node-express') {
      const env = Object.assign({}, process.env, { PORT: String(port), NODE_ENV: 'development' });
      proc = spawn('node', ['server/server.mjs'], {
        cwd,
        env,
        shell: true,
        stdio: 'pipe'
      });
      probeUrl = `http://127.0.0.1:${port}/api/health`;
    } else {
      proc = spawn('npx.cmd', ['vite', 'preview', '--port', String(port), '--host', '127.0.0.1'], {
        cwd,
        shell: true,
        stdio: 'pipe'
      });
      probeUrl = `http://127.0.0.1:${port}/`;
    }

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
      const req = http.get(probeUrl, (res) => {
        if (res.statusCode === 200) {
          cleanup(true, `HTTP 200 OK received at ${probeUrl} after ${attempts} attempts`);
        }
      });

      req.on('error', () => {
        if (attempts >= 15) {
          cleanup(false, `Timeout waiting for server on ${probeUrl}`);
        }
      });
      req.setTimeout(1000, () => req.destroy());
    }, 1000);

    overallTimeout = setTimeout(() => {
      cleanup(false, `Server probe timed out after 18 seconds`);
    }, 18000);
  });
}
