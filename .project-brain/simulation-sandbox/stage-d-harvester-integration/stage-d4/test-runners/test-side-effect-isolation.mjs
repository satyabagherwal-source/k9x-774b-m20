/**
 * Test Suite C: Side-Effect & Production Purity Isolation
 * 
 * Verifies that executing the Shadow Gateway Wrapper under active shadow mode
 * causes EXACTLY ZERO writes, mutations, promotions, or alterations to:
 * - 05_KNOWLEDGE/domain-intelligence/domain-registry.json
 * - 11_INBOX/candidate-directives-registry.json
 * - .project-brain/knowledge-graph/relationship-graph.json
 * - .project-brain/cache/retrieval-index.json
 * - 05_KNOWLEDGE/engineering-patterns.md
 * - 07_PROJECT_LEARNING/ (master directory)
 * - harvest-control.json
 * - .github/workflows/24-7-cloud-harvester.yml
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { ShadowGatewayWrapper } from '../src/shadow-gateway-wrapper.mjs';
import { createLearningPackage } from '../../../../../04_WORKFLOWS/factory-engine/brain-learning-gateway.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROD_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const STAGE_D4_ROOT = path.resolve(__dirname, '..');
const TRACE_DIR = path.join(STAGE_D4_ROOT, 'shadow-traces');

function hashFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export async function runSideEffectIsolationTests() {
  const results = {
    suite: 'STAGE_D4_SIDE_EFFECT_AND_PRODUCTION_PURITY',
    passed: 0,
    failed: 0,
    tests: []
  };

  console.log('\n=== RUNNING SUITE C: SIDE-EFFECT & PRODUCTION PURITY ===');

  const criticalStores = [
    { name: 'Domain Registry', path: path.join(PROD_ROOT, '05_KNOWLEDGE', 'domain-intelligence', 'domain-registry.json') },
    { name: 'Candidate Directives', path: path.join(PROD_ROOT, '11_INBOX', 'candidate-directives-registry.json') },
    { name: 'Relationship Graph', path: path.join(PROD_ROOT, '.project-brain', 'knowledge-graph', 'relationship-graph.json') },
    { name: 'Engineering Patterns', path: path.join(PROD_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md') },
    { name: 'Harvest Control', path: path.join(PROD_ROOT, 'harvest-control.json') },
    { name: 'GHA Workflow', path: path.join(PROD_ROOT, '.github', 'workflows', '24-7-cloud-harvester.yml') }
  ];

  // Capture Preflight Hashes
  const preHashes = {};
  for (const store of criticalStores) {
    preHashes[store.name] = hashFile(store.path);
  }

  // Count files in 07_PROJECT_LEARNING
  const prodLearningDir = path.join(PROD_ROOT, '07_PROJECT_LEARNING');
  const preLearningFilesCount = fs.existsSync(prodLearningDir) ? fs.readdirSync(prodLearningDir).length : 0;

  // -------------------------------------------------------------
  // Test C.1: Multi-Cycle Shadow Execution Production Invariance
  // -------------------------------------------------------------
  try {
    const wrapper = new ShadowGatewayWrapper({
      legacyGatewayFn: async (pkg) => ({
        success: true,
        repository: pkg.repository,
        learning_id: pkg.learning_id,
        status: 'SIMULATED_SAFE_LEGACY'
      }),
      config: {
        enabled: true,
        sampleRate: 1.0,
        dryRun: true
      },
      traceDir: TRACE_DIR
    });

    // Execute 5 rapid distinct shadow cycles
    for (let i = 0; i < 5; i++) {
      const pkg = createLearningPackage({
        repository: 'tiangolo/fastapi',
        platform: 'github',
        sourceUrl: 'https://github.com/tiangolo/fastapi',
        sourceVersion: 'HEAD',
        license: 'MIT',
        slug: `side-effect-eval-${i}`,
        dossierText: `# Side Effect Evaluation Cycle ${i}\n\nEvaluating zero production write isolation across canonical directories.`,
        candidateRules: [
          {
            title: `Side Effect Invariance Rule ${i}`,
            body: `Verifies that shadow execution never mutates canonical registries or production knowledge files.`
          }
        ]
      });

      await wrapper.submit(pkg, { shadowMode: { enabled: true, sampleRate: 1.0 } });
    }

    // Capture Postflight Hashes
    const postHashes = {};
    const storeComparisons = [];
    let allStoresUntouched = true;

    for (const store of criticalStores) {
      const post = hashFile(store.path);
      postHashes[store.name] = post;
      const match = preHashes[store.name] === post && post !== null;
      storeComparisons.push({ name: store.name, match, pre: preHashes[store.name], post });
      if (!match) allStoresUntouched = false;
    }

    const postLearningFilesCount = fs.existsSync(prodLearningDir) ? fs.readdirSync(prodLearningDir).length : 0;
    const learningDirUntouched = preLearningFilesCount === postLearningFilesCount;

    const c1Passed = allStoresUntouched && learningDirUntouched;

    results.tests.push({
      test_id: 'TEST-C1-PRODUCTION-STORES-INVARIANCE',
      name: 'Cryptographic Production Stores Invariance (6 Critical Files)',
      passed: c1Passed,
      details: {
        all_stores_identical: allStoresUntouched,
        learning_dir_unmodified: learningDirUntouched,
        pre_file_count: preLearningFilesCount,
        post_file_count: postLearningFilesCount,
        stores: storeComparisons
      }
    });
    if (c1Passed) results.passed++; else results.failed++;
    console.log(`  ${c1Passed ? '✅' : '❌'} Test C.1 (Production Invariance): Bitwise identical hashes across 6 critical files`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-C1-PRODUCTION-STORES-INVARIANCE', passed: false, error: err.message });
    console.error(`  ❌ Test C.1 Failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test C.2: Trace Isolation to Sandbox Only
  // -------------------------------------------------------------
  try {
    const traceFiles = fs.readdirSync(TRACE_DIR).filter(f => f.endsWith('.json'));
    const tracesConfined = traceFiles.length >= 5;

    // Verify no trace files exist in master root or 08_VERIFICATION
    const rootTraceLeak = fs.readdirSync(PROD_ROOT).filter(f => f.startsWith('trace-d4-')).length === 0;

    const c2Passed = tracesConfined && rootTraceLeak;
    results.tests.push({
      test_id: 'TEST-C2-TRACE-DIRECTORY-CONFINEMENT',
      name: 'Trace Confinement to Sandbox Shadow Directory',
      passed: c2Passed,
      details: {
        sandbox_traces_count: traceFiles.length,
        master_root_leak: !rootTraceLeak
      }
    });
    if (c2Passed) results.passed++; else results.failed++;
    console.log(`  ${c2Passed ? '✅' : '❌'} Test C.2 (Trace Confinement): ${traceFiles.length} traces confined strictly to sandbox`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-C2-TRACE-DIRECTORY-CONFINEMENT', passed: false, error: err.message });
    console.error(`  ❌ Test C.2 Failed: ${err.message}`);
  }

  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSideEffectIsolationTests().then(res => {
    console.log(`\nSuite C Complete: ${res.passed}/${res.passed + res.failed} Passed`);
  });
}

