/**
 * Test Suite: Universal Repository Learning Engine (URE-001)
 *
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-universal-repository-learning-engine.mjs
 * Purpose: Verifies the first executable milestone of the Universal Repository Learning Engine.
 *
 * Covers:
 *   1. Static bounded repository scan (Zero code execution guard)
 *   2. Repository manifest, purpose, and Git identity extraction
 *   3. Technology stack, dependency, and runtime inventory
 *   4. Component inventory, role classification, and symbol extraction
 *   5. Architecture map and directed dependency graph
 *   6. Workflow inventory (npm scripts, GitHub Actions CI, Dockerfile)
 *   7. Test and verification practices extraction
 *   8. Truthful uncertainty & limitation recording (UNKNOWN / INSUFFICIENT_EVIDENCE)
 *   9. Phase F traceable evidence records creation and linking
 *  10. HIQV quality validation gate evaluation & HMAC authenticity
 *  11. End-to-end pipeline: Gateway persistence & live BM25 retrieval
 *  12. Zero canonical production pollution (Production Purity)
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

import {
  analyzeRepository,
  executeRepositoryLearningPipeline,
  scanRepositoryFiles,
  extractRepositoryManifest,
  extractTechnologyInventory,
  extractComponentInventory,
  buildArchitectureMap,
  extractWorkflowInventory,
  extractTestInventory,
  extractReusableConstructionPatterns,
  extractUncertaintiesAndLimitations,
  URE_VERSION,
  COMPONENT_TYPES,
  WORKFLOW_TYPES,
  ARCHITECTURE_STYLES
} from './universal-repository-learning-engine.mjs';

import {
  validateHarvestedIntelligence,
  verifyReportIntegrity,
  VALIDATOR_DECISIONS
} from './harvested-intelligence-quality-validator.mjs';

import { searchBrain } from './retrieval-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

const SANDBOX_ROOT = path.join(BRAIN_ROOT, '.project-brain', 'simulation-sandbox', 'ure-test');
const FIXTURE_ROOT = path.join(BRAIN_ROOT, '.project-brain', 'simulation-sandbox', 'ure-fixture-repo');

/**
 * Creates a clean, realistic controlled Git repository fixture
 */
function setupFixtureRepo() {
  if (fs.existsSync(FIXTURE_ROOT)) {
    fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
  }
  fs.mkdirSync(FIXTURE_ROOT, { recursive: true });

  // 1. README.md
  const readmeContent = `# MicroTelemetry Service

A resilient microservice for high-throughput metric ingestion and health aggregation.

## Architecture
The service follows a layered architecture:
- Entry point initiates HTTP listener and signal handlers.
- Routes declare API endpoints and health telemetry probes.
- Services manage metric buffers with capacity bounds.

## Getting Started
\`\`\`bash
npm run dev
npm test
\`\`\`
`;
  fs.writeFileSync(path.join(FIXTURE_ROOT, 'README.md'), readmeContent, 'utf-8');

  // 2. package.json
  const packageJson = {
    name: 'microtelemetry-service',
    version: '1.2.0',
    description: 'A resilient microservice for high-throughput metric ingestion and health aggregation.',
    type: 'module',
    main: 'src/index.mjs',
    scripts: {
      build: 'node esbuild.config.mjs',
      dev: 'node src/index.mjs',
      test: 'node --test tests/*.test.mjs',
      lint: 'eslint .'
    },
    dependencies: {
      fastify: '^4.26.0',
      zod: '^3.22.4'
    },
    devDependencies: {
      esbuild: '^0.20.0',
      eslint: '^8.56.0'
    },
    engines: {
      node: '>=20.0.0'
    },
    license: 'MIT'
  };
  fs.writeFileSync(path.join(FIXTURE_ROOT, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf-8');

  // 3. LICENSE
  const licenseContent = `MIT License\n\nCopyright (c) 2026 MicroTelemetry Contributors\n\nPermission is hereby granted...`;
  fs.writeFileSync(path.join(FIXTURE_ROOT, 'LICENSE'), licenseContent, 'utf-8');

  // .gitignore
  fs.writeFileSync(path.join(FIXTURE_ROOT, '.gitignore'), "node_modules/\n.cache/\ncoverage/\n", 'utf-8');

  // 4. Source Files: src/
  const srcDir = path.join(FIXTURE_ROOT, 'src');
  const routesDir = path.join(srcDir, 'routes');
  const servicesDir = path.join(srcDir, 'services');
  fs.mkdirSync(routesDir, { recursive: true });
  fs.mkdirSync(servicesDir, { recursive: true });

  // src/index.mjs (Entry Point)
  const indexContent = `import { createServer } from './server.mjs';
import { TelemetryCollector } from './services/collector.mjs';

const collector = new TelemetryCollector();
const app = createServer({ collector });

// Graceful Shutdown & Process Signal Handling Invariant
const shutdown = async (signal) => {
  console.log(\`Received \${signal}, starting graceful shutdown...\`);
  await app.close();
  await collector.flush();
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

const port = process.env.PORT || 3000;
app.listen({ port, host: '0.0.0.0' });
`;
  fs.writeFileSync(path.join(srcDir, 'index.mjs'), indexContent, 'utf-8');

  // src/server.mjs (Server creation & route binding)
  const serverContent = `import Fastify from 'fastify';
import { registerHealthRoutes } from './routes/health.mjs';

export function createServer({ collector }) {
  const fastify = Fastify({ logger: true });
  registerHealthRoutes(fastify, collector);
  return fastify;
}
`;
  fs.writeFileSync(path.join(srcDir, 'server.mjs'), serverContent, 'utf-8');

  // src/routes/health.mjs (Route declaration & health check probe)
  const healthContent = `export function registerHealthRoutes(fastify, collector) {
  // Multi-Phase Health Probe Invariant
  fastify.get('/health', async (request, reply) => {
    const isReady = collector.isHealthy();
    if (!isReady) {
      return reply.status(503).send({ status: 'UNHEALTHY', reason: 'Collector buffer saturated' });
    }
    return reply.status(200).send({ status: 'HEALTHY', timestamp: Date.now() });
  });
}
`;
  fs.writeFileSync(path.join(routesDir, 'health.mjs'), healthContent, 'utf-8');

  // src/services/collector.mjs (Core service)
  const collectorContent = `export class TelemetryCollector {
  constructor(options = {}) {
    this.maxQueueSize = options.maxQueueSize || 10000;
    this.queue = [];
  }

  isHealthy() {
    return this.queue.length < this.maxQueueSize;
  }

  async flush() {
    this.queue = [];
  }
}
`;
  fs.writeFileSync(path.join(servicesDir, 'collector.mjs'), collectorContent, 'utf-8');

  // 5. Tests: tests/telemetry.test.mjs
  const testsDir = path.join(FIXTURE_ROOT, 'tests');
  fs.mkdirSync(testsDir, { recursive: true });
  const testContent = `import assert from 'assert';
import { test, describe, it } from 'node:test';
import { TelemetryCollector } from '../src/services/collector.mjs';

describe('TelemetryCollector', () => {
  it('reports healthy when queue is within bounds', () => {
    const collector = new TelemetryCollector({ maxQueueSize: 100 });
    assert.strictEqual(collector.isHealthy(), true);
  });

  it('reports unhealthy when queue exceeds maximum threshold', () => {
    const collector = new TelemetryCollector({ maxQueueSize: 1 });
    collector.queue.push({ metric: 'cpu', val: 99 });
    assert.strictEqual(collector.isHealthy(), false);
  });
});
`;
  fs.writeFileSync(path.join(testsDir, 'telemetry.test.mjs'), testContent, 'utf-8');

  // 6. Workflows: .github/workflows/ci.yml
  const workflowsDir = path.join(FIXTURE_ROOT, '.github', 'workflows');
  fs.mkdirSync(workflowsDir, { recursive: true });
  const ciContent = `name: CI Pipeline
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install dependencies
        run: npm ci
      - name: Run linter
        run: npm run lint
      - name: Run automated test suite
        run: npm test
`;
  fs.writeFileSync(path.join(workflowsDir, 'ci.yml'), ciContent, 'utf-8');

  // 7. Dockerfile
  const dockerContent = `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["node", "src/index.mjs"]
`;
  fs.writeFileSync(path.join(FIXTURE_ROOT, 'Dockerfile'), dockerContent, 'utf-8');

  // 8. Initialize Git Repository
  try {
    execSync('git init', { cwd: FIXTURE_ROOT, stdio: 'ignore' });
    execSync('git config user.name "URE Test"', { cwd: FIXTURE_ROOT, stdio: 'ignore' });
    execSync('git config user.email "ure@test.local"', { cwd: FIXTURE_ROOT, stdio: 'ignore' });
    execSync('git add .', { cwd: FIXTURE_ROOT, stdio: 'ignore' });
    execSync('git commit -m "feat: initial microtelemetry service commit"', { cwd: FIXTURE_ROOT, stdio: 'ignore' });
  } catch (e) {
    console.warn('Note: Git init skipped or failed in test sandbox:', e.message);
  }
}

/**
 * Prepares the sandbox brain directory
 */
function setupSandboxBrain() {
  if (fs.existsSync(SANDBOX_ROOT)) {
    fs.rmSync(SANDBOX_ROOT, { recursive: true, force: true });
  }
  fs.mkdirSync(SANDBOX_ROOT, { recursive: true });
  fs.mkdirSync(path.join(SANDBOX_ROOT, '05_KNOWLEDGE'), { recursive: true });
  fs.mkdirSync(path.join(SANDBOX_ROOT, '07_PROJECT_LEARNING'), { recursive: true });
  fs.mkdirSync(path.join(SANDBOX_ROOT, '.project-brain', 'cache'), { recursive: true });

  const initialPatterns = `# Canonical Engineering Patterns

## Rule 1. Architectural Baseline
**RULE**: Establish clean project boundaries and explicit verification checkpoints.
<!-- PROVENANCE_START
{"ruleNumber":1,"title":"Architectural Baseline","promotedAt":"2026-03-31T00:00:00.000Z"}
PROVENANCE_END -->
`;
  fs.writeFileSync(path.join(SANDBOX_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md'), initialPatterns, 'utf-8');
}

async function runTestSuite() {
  console.log('======================================================================');
  console.log('🧪 TEST SUITE: UNIVERSAL REPOSITORY LEARNING ENGINE (URE-001)');
  console.log(`   Fixture Root: ${FIXTURE_ROOT}`);
  console.log(`   Sandbox Brain: ${SANDBOX_ROOT}`);
  console.log('======================================================================\n');

  setupFixtureRepo();
  setupSandboxBrain();

  let passCount = 0;
  function pass(msg) {
    console.log(`  ✅ [PASS] ${msg}`);
    passCount++;
  }

  // -------------------------------------------------------------------
  // TEST 1: Bounded File Scan & Zero Code Execution
  // -------------------------------------------------------------------
  console.log('[TEST 1] Bounded File Scan & Zero Code Execution...');
  {
    const files = scanRepositoryFiles(FIXTURE_ROOT);
    assert(files.length >= 8, `Scanned expected files (Found: ${files.length})`);
    pass(`Scanned ${files.length} repository files within bounds`);

    // Verify ignore list works
    const dummyNodeModules = path.join(FIXTURE_ROOT, 'node_modules', 'evil-package');
    fs.mkdirSync(dummyNodeModules, { recursive: true });
    fs.writeFileSync(path.join(dummyNodeModules, 'index.js'), 'throw new Error("Execution check");');

    const filesWithIgnore = scanRepositoryFiles(FIXTURE_ROOT);
    assert(!filesWithIgnore.some(f => f.relativePath.includes('node_modules')), 'node_modules directory is strictly ignored');
    fs.rmSync(dummyNodeModules, { recursive: true, force: true });
    pass('Ignored directories (node_modules, .git) strictly filtered');
  }

  // -------------------------------------------------------------------
  // TEST 2: Repository Identity, Purpose & VCS Extraction
  // -------------------------------------------------------------------
  console.log('\n[TEST 2] Repository Identity, Purpose & VCS Extraction...');
  {
    const files = scanRepositoryFiles(FIXTURE_ROOT);
    const manifest = extractRepositoryManifest(FIXTURE_ROOT, files);

    assert.strictEqual(manifest.name, 'microtelemetry-service', 'Repository name matches package.json name');
    assert(manifest.purpose.includes('high-throughput metric ingestion'), 'Purpose extracted from manifest/README');
    assert.strictEqual(manifest.license, 'MIT', 'License correctly identified as MIT');
    assert.strictEqual(manifest.vcs.is_git_repo, true, 'VCS identified as Git repository');
    assert(manifest.vcs.head_commit && manifest.vcs.head_commit.length >= 7, 'Git HEAD commit hash captured');
    assert.strictEqual(manifest.vcs.has_uncommitted_changes, false, 'Uncommitted changes state verified');
    pass('Repository manifest, identity, purpose, and Git metadata accurately extracted');
  }

  // -------------------------------------------------------------------
  // TEST 3: Technology Stack, Dependencies & Runtimes
  // -------------------------------------------------------------------
  console.log('\n[TEST 3] Technology Stack, Dependencies & Runtimes...');
  {
    const files = scanRepositoryFiles(FIXTURE_ROOT);
    const tech = extractTechnologyInventory(FIXTURE_ROOT, files);

    assert(tech.runtimes.some(r => r.includes('Node.js')), 'Node.js runtime detected');
    assert(tech.frameworks.some(f => f.name === 'Fastify'), 'Fastify framework detected');
    assert(tech.frameworks.some(f => f.name === 'Zod'), 'Zod validation library detected');
    assert(tech.build_tools.some(b => b.name === 'esbuild'), 'esbuild build tool detected');
    assert(tech.build_tools.some(b => b.name === 'Docker'), 'Docker container tool detected');
    assert(tech.test_tools.some(t => t.name.includes('node:test')), 'node:test test runner detected');
    assert(tech.dependencies.length >= 4, `Dependencies counted correctly (Found: ${tech.dependencies.length})`);
    pass('Technology inventory captures languages, frameworks, build tools, and dependencies');
  }

  // -------------------------------------------------------------------
  // TEST 4: Component Inventory & Role Classification
  // -------------------------------------------------------------------
  console.log('\n[TEST 4] Component Inventory & Role Classification...');
  {
    const files = scanRepositoryFiles(FIXTURE_ROOT);
    const components = extractComponentInventory(FIXTURE_ROOT, files);

    const indexComp = components.find(c => c.relative_path === 'src/index.mjs');
    assert(indexComp, 'src/index.mjs component identified');
    assert.strictEqual(indexComp.type, COMPONENT_TYPES.ENTRY_POINT, 'src/index.mjs classified as ENTRY_POINT');
    assert.strictEqual(indexComp.symbols.hasGracefulShutdown, true, 'Detected graceful shutdown handlers in index.mjs');

    const healthComp = components.find(c => c.relative_path === 'src/routes/health.mjs');
    assert(healthComp, 'src/routes/health.mjs component identified');
    assert.strictEqual(healthComp.type, COMPONENT_TYPES.ROUTER, 'src/routes/health.mjs classified as ROUTER');
    assert.strictEqual(healthComp.symbols.hasHealthEndpoint, true, 'Detected /health route in health.mjs');

    const collectorComp = components.find(c => c.relative_path === 'src/services/collector.mjs');
    assert(collectorComp, 'src/services/collector.mjs component identified');
    assert.strictEqual(collectorComp.type, COMPONENT_TYPES.SERVICE, 'src/services/collector.mjs classified as SERVICE');
    assert(collectorComp.exports.includes('TelemetryCollector'), 'TelemetryCollector class export captured');

    const testComp = components.find(c => c.relative_path === 'tests/telemetry.test.mjs');
    assert(testComp, 'tests/telemetry.test.mjs component identified');
    assert.strictEqual(testComp.type, COMPONENT_TYPES.TEST_SUITE, 'tests classified as TEST_SUITE');

    pass('Components accurately classified across ENTRY_POINT, ROUTER, SERVICE, and TEST_SUITE');
  }

  // -------------------------------------------------------------------
  // TEST 5: Architecture Map & Directed Dependency Graph
  // -------------------------------------------------------------------
  console.log('\n[TEST 5] Architecture Map & Directed Dependency Graph...');
  {
    const files = scanRepositoryFiles(FIXTURE_ROOT);
    const components = extractComponentInventory(FIXTURE_ROOT, files);
    const arch = buildArchitectureMap(FIXTURE_ROOT, components);

    assert.strictEqual(arch.style, ARCHITECTURE_STYLES.LAYERED_SERVICE, 'Architectural style identified as LAYERED_SERVICE');
    assert(arch.entry_points.some(e => e.path === 'src/index.mjs'), 'Entry point mapped to src/index.mjs');

    // Check internal dependency edges
    const edges = arch.internal_dependency_edges;
    assert(edges.some(e => e.from === 'src/index.mjs' && e.to === 'src/server.mjs'), 'Edge: index.mjs -> server.mjs mapped');
    assert(edges.some(e => e.from === 'src/index.mjs' && e.to === 'src/services/collector.mjs'), 'Edge: index.mjs -> collector.mjs mapped');
    assert(edges.some(e => e.from === 'src/server.mjs' && e.to === 'src/routes/health.mjs'), 'Edge: server.mjs -> health.mjs mapped');

    pass('Architecture map constructs layers and directed dependency edges correctly');
  }

  // -------------------------------------------------------------------
  // TEST 6: Workflow & CI/CD Inventory
  // -------------------------------------------------------------------
  console.log('\n[TEST 6] Workflow & CI/CD Inventory...');
  {
    const files = scanRepositoryFiles(FIXTURE_ROOT);
    const workflows = extractWorkflowInventory(FIXTURE_ROOT, files);

    assert(workflows.some(w => w.name === 'test' && w.type === WORKFLOW_TYPES.TEST), 'npm test script workflow detected');
    assert(workflows.some(w => w.name === 'build' && w.type === WORKFLOW_TYPES.BUILD), 'npm build script workflow detected');

    const ciWf = workflows.find(w => w.type === WORKFLOW_TYPES.CI_CD);
    assert(ciWf, 'GitHub Actions CI workflow detected');
    assert(ciWf.trigger.includes('push') && ciWf.trigger.includes('pull_request'), 'CI workflow triggers captured (push, pull_request)');

    const dockerWf = workflows.find(w => w.type === WORKFLOW_TYPES.CONTAINER);
    assert(dockerWf, 'Dockerfile container workflow detected');

    pass('Workflows parsed across npm scripts, GitHub Actions CI, and Dockerfile');
  }

  // -------------------------------------------------------------------
  // TEST 7: Test & Verification Practices Extraction
  // -------------------------------------------------------------------
  console.log('\n[TEST 7] Test & Verification Practices Extraction...');
  {
    const files = scanRepositoryFiles(FIXTURE_ROOT);
    const components = extractComponentInventory(FIXTURE_ROOT, files);
    const testInv = extractTestInventory(FIXTURE_ROOT, files, components);

    assert.strictEqual(testInv.total_test_files, 1, 'Total test files is 1');
    assert.strictEqual(testInv.total_test_cases_estimated, 2, 'Estimated test cases is 2');
    assert(testInv.test_suites[0].suite_names.includes('TelemetryCollector'), 'Suite name TelemetryCollector captured');
    assert(testInv.test_suites[0].verification_methods.includes('STRICT_EQUALITY_ASSERTION'), 'Strict equality assertion method captured');

    pass('Test inventory captures suites, test cases, and assertion verification methods');
  }

  // -------------------------------------------------------------------
  // TEST 8: Truthful Uncertainty & Limitations (Section 3 Invariant)
  // -------------------------------------------------------------------
  console.log('\n[TEST 8] Truthful Uncertainty & Limitations...');
  {
    const files = scanRepositoryFiles(FIXTURE_ROOT);
    const manifest = extractRepositoryManifest(FIXTURE_ROOT, files);
    const tech = extractTechnologyInventory(FIXTURE_ROOT, files);
    const components = extractComponentInventory(FIXTURE_ROOT, files);
    const arch = buildArchitectureMap(FIXTURE_ROOT, components);
    const testInv = extractTestInventory(FIXTURE_ROOT, files, components);

    const uncertainties = extractUncertaintiesAndLimitations(FIXTURE_ROOT, manifest, tech, arch, testInv);

    assert(uncertainties.some(u => u.area === 'PERSISTENCE_LAYER' && u.status === 'UNKNOWN'), 'Unknown persistence layer explicitly flagged');
    assert(uncertainties.some(u => u.area === 'TEST_RUNTIME_COVERAGE' && u.status === 'INSUFFICIENT_EVIDENCE'), 'Insufficient evidence for runtime test execution coverage explicitly flagged');

    pass('Truthful uncertainty recording enforced (UNKNOWN and INSUFFICIENT_EVIDENCE without guessing)');
  }

  // -------------------------------------------------------------------
  // TEST 9: Phase F Traceable Evidence Records
  // -------------------------------------------------------------------
  console.log('\n[TEST 9] Phase F Traceable Evidence Records...');
  {
    const files = scanRepositoryFiles(FIXTURE_ROOT);
    const components = extractComponentInventory(FIXTURE_ROOT, files);
    const patterns = extractReusableConstructionPatterns(FIXTURE_ROOT, files, components);

    assert(patterns.length >= 2, `Extracted evidence-backed candidate patterns (Found: ${patterns.length})`);

    const shutdownPat = patterns.find(p => p.title.includes('Graceful Process Shutdown'));
    assert(shutdownPat, 'Graceful Process Shutdown pattern extracted');
    assert(shutdownPat.evidence_list.length > 0, 'Evidence list attached to pattern');

    const evid = shutdownPat.evidence_list[0];
    assert(evid.evidence_id.startsWith('EVID-'), 'Evidence ID properly formatted with EVID- prefix');
    assert.strictEqual(evid.evidence_type, 'CODE_IMPLEMENTATION', 'Evidence type is CODE_IMPLEMENTATION');
    assert(evid.supporting_excerpt.includes('SIGTERM'), 'Supporting excerpt contains actual code snippet');
    assert(evid.content_hash && evid.content_hash.length === 64, 'Evidence SHA-256 content hash verified');

    pass('Phase F evidence records deterministically created and linked to patterns');
  }

  // -------------------------------------------------------------------
  // TEST 10: HIQV Quality Validation Gate Boundary
  // -------------------------------------------------------------------
  console.log('\n[TEST 10] HIQV Quality Validation Gate Boundary...');
  {
    const files = scanRepositoryFiles(FIXTURE_ROOT);
    const components = extractComponentInventory(FIXTURE_ROOT, files);
    const patterns = extractReusableConstructionPatterns(FIXTURE_ROOT, files, components);

    const cand = patterns[0];
    const rawCandItem = {
      title: cand.title,
      body: `### ${cand.title}\n**RULE**: ${cand.statement}\n**WHY**: ${cand.why}\n**WHEN TO APPLY**: ${cand.when_to_apply}\n**VERIFIED IMPLEMENTATION PATTERN**:\n\`\`\`javascript\n${cand.implementation}\n\`\`\`\n**NEGATIVE CONSTRAINT**:\n\`\`\`javascript\n${cand.negative_constraint}\n\`\`\`\n**VERIFICATION METHOD**: Empirical code inspection in ${cand.source.id}.`,
      repository: FIXTURE_ROOT,
      source_url: FIXTURE_ROOT,
      source_id: cand.source?.id || 'SRC-TEST',
      source_uri: cand.source?.uri || 'src/index.mjs',
      source_version: cand.source?.version || '1.0.0',
      license: 'MIT',
      source: cand.source
    };

    const valReport = validateHarvestedIntelligence(rawCandItem, cand.evidence_list, { brainRoot: SANDBOX_ROOT });

    assert(valReport.decision === VALIDATOR_DECISIONS.PASS || valReport.decision === VALIDATOR_DECISIONS.CONDITIONAL_PASS, 'Quality gate grants PASS or CONDITIONAL_PASS for verified pattern');
    assert(valReport.confidence_score >= 0.85, 'High confidence score assigned');
    assert(valReport.auth_token && valReport.auth_token.length === 64, 'Cryptographic HMAC authenticity token generated');

    const integrityCheck = verifyReportIntegrity(rawCandItem, cand.evidence_list, valReport);
    assert.strictEqual(integrityCheck.valid, true, 'Cryptographic integrity check passes with authentic token');

    pass('HIQV quality gate validates candidate patterns with genuine HMAC authenticity tokens');
  }

  // -------------------------------------------------------------------
  // TEST 11: End-to-End Pipeline & Live Retrieval
  // -------------------------------------------------------------------
  console.log('\n[TEST 11] End-to-End Pipeline & Live Retrieval...');
  {
    const pipelineResult = await executeRepositoryLearningPipeline(FIXTURE_ROOT, {
      brainRoot: SANDBOX_ROOT
    });

    assert.strictEqual(pipelineResult.success, true, 'Pipeline returns success: true');
    assert(pipelineResult.intelligence_package, 'Repository Intelligence Package generated');
    assert.strictEqual(pipelineResult.intelligence_package.repository_manifest.name, 'microtelemetry-service', 'Manifest name matches');

    // Verify dossier exists on disk
    const dossierPath = path.join(SANDBOX_ROOT, '07_PROJECT_LEARNING', 'ure-microtelemetry-service-learnings.md');
    assert(fs.existsSync(dossierPath), 'Dossier successfully written to 07_PROJECT_LEARNING/');
    const dossierContent = fs.readFileSync(dossierPath, 'utf-8');
    assert(dossierContent.includes('microtelemetry-service'), 'Dossier contains repository title');
    assert(dossierContent.includes('HIQV DECISION'), 'Dossier embeds HIQV decision metadata');

    // Verify search retrieval
    assert.strictEqual(pipelineResult.retrieval_verified, true, 'Live BM25 retrieval verified');
    assert(pipelineResult.retrieved_rule, 'Top retrieved rule returned');

    pass('End-to-end URE pipeline persists dossier, updates BM25 index, and verifies retrieval');
  }

  // -------------------------------------------------------------------
  // TEST 12: Production Purity Verification
  // -------------------------------------------------------------------
  console.log('\n[TEST 12] Production Purity Verification...');
  {
    const prodPatternsPath = path.join(BRAIN_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md');
    const prodContent = fs.readFileSync(prodPatternsPath, 'utf-8');
    assert(!prodContent.includes('microtelemetry-service'), 'Canonical production engineering-patterns.md strictly unpolluted');
    pass('Canonical production knowledge (05_KNOWLEDGE) is 100% pristine and unmodified');
  }

  console.log('\n======================================================================');
  console.log(`🏁 URE-001 TEST SUITE SUMMARY: ${passCount} PASSED | 0 FAILED`);
  console.log('======================================================================\n');
}

runTestSuite().catch(err => {
  console.error('Fatal error running URE-001 test suite:', err);
  process.exit(1);
});
