/**
 * Master Test Runner for Stage D.4 Sandbox Patch & Actual Gateway Safety Verification
 * 
 * Executes all 20 safety tests across 6 suites:
 * - Suite A: Actual Gateway Contract Preservation (Real submitToBrainGateway())
 * - Suite B: Mutation & Object Reference Isolation
 * - Suite C: Side-Effect & Production Purity Isolation
 * - Suite D: Failure Handling, Resource Limits & Secret Redaction
 * - Suite E: Configuration Safety, Dynamic Propagation & Rollback Timing
 * - Suite S: Proposed Canary Settings Simulation
 * 
 * Emits comprehensive machine-readable outputs in results/ directory.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

import { runContractPreservationTests } from './test-contract-preservation.mjs';
import { runMutationIsolationTests } from './test-mutation-isolation.mjs';
import { runSideEffectIsolationTests } from './test-side-effect-isolation.mjs';
import { runFailureAndLimitsTests } from './test-failure-and-limits.mjs';
import { runConfigSafetyTests } from './test-config-safety.mjs';
import { runCanarySimulationTests } from './test-canary-simulation.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROD_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const STAGE_D4_ROOT = path.resolve(__dirname, '..');
const RESULTS_DIR = path.join(STAGE_D4_ROOT, 'results');

function hashFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export async function runAllStageD4Tests() {
  const startTime = Date.now();
  console.log('======================================================================');
  console.log('🛡️  STAGE D.4 ACTUAL GATEWAY SAFETY & SANDBOX PATCH VERIFICATION');
  console.log('   Mission ID: UKD-STAGE-D4-SANDBOX-PATCH-SAFETY-01');
  console.log(`   Sandbox:    ${STAGE_D4_ROOT}`);
  console.log(`   Timestamp:  ${new Date().toISOString()}`);
  console.log('======================================================================');

  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  // Preflight snapshot of production stores
  const criticalStores = [
    { name: 'domain_registry', path: path.join(PROD_ROOT, '05_KNOWLEDGE', 'domain-intelligence', 'domain-registry.json') },
    { name: 'candidate_registry', path: path.join(PROD_ROOT, '11_INBOX', 'candidate-directives-registry.json') },
    { name: 'relationship_graph', path: path.join(PROD_ROOT, '.project-brain', 'knowledge-graph', 'relationship-graph.json') },
    { name: 'engineering_patterns', path: path.join(PROD_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md') },
    { name: 'harvest_control', path: path.join(PROD_ROOT, 'harvest-control.json') },
    { name: 'cloud_workflow', path: path.join(PROD_ROOT, '.github', 'workflows', '24-7-cloud-harvester.yml') }
  ];

  const preflightProof = {};
  for (const s of criticalStores) {
    preflightProof[s.name] = { path: s.path, sha256: hashFile(s.path) };
  }

  // Execute all 6 test suites
  const suiteA = await runContractPreservationTests();
  const suiteB = await runMutationIsolationTests();
  const suiteC = await runSideEffectIsolationTests();
  const suiteD = await runFailureAndLimitsTests();
  const suiteE = await runConfigSafetyTests();
  const suiteS = await runCanarySimulationTests();

  const allTests = [
    ...suiteA.tests,
    ...suiteB.tests,
    ...suiteC.tests,
    ...suiteD.tests,
    ...suiteE.tests,
    ...suiteS.tests
  ];

  const totalPassed = allTests.filter(t => t.passed).length;
  const totalFailed = allTests.filter(t => !t.passed).length;
  const totalTests = allTests.length;

  // Postflight verification of production stores
  const postflightProof = {};
  let allStoresUntouched = true;
  for (const s of criticalStores) {
    const postHash = hashFile(s.path);
    postflightProof[s.name] = { path: s.path, sha256: postHash };
    if (preflightProof[s.name].sha256 !== postHash) {
      allStoresUntouched = false;
    }
  }

  // Verify git status (tracked modifications must be 0)
  let gitTrackedClean = false;
  try {
    const statusOut = execSync('git status --porcelain=v1', { cwd: PROD_ROOT, encoding: 'utf8' });
    const trackedLines = statusOut.split('\n').filter(l => l && !l.startsWith('??'));
    gitTrackedClean = trackedLines.length === 0;
  } catch (err) {
    gitTrackedClean = false;
  }

  const durationMs = Date.now() - startTime;

  const testReport = {
    mission_id: 'UKD-STAGE-D4-SANDBOX-PATCH-SAFETY-01',
    timestamp: new Date().toISOString(),
    execution_duration_ms: durationMs,
    verdict: totalFailed === 0 && allStoresUntouched && gitTrackedClean ? 'SANDBOX_PATCH_VERIFIED' : 'FAILED',
    summary: {
      total_tests: totalTests,
      passed: totalPassed,
      failed: totalFailed,
      pass_rate_pct: ((totalPassed / totalTests) * 100).toFixed(1)
    },
    suites: [
      { name: suiteA.suite, passed: suiteA.passed, failed: suiteA.failed },
      { name: suiteB.suite, passed: suiteB.passed, failed: suiteB.failed },
      { name: suiteC.suite, passed: suiteC.passed, failed: suiteC.failed },
      { name: suiteD.suite, passed: suiteD.passed, failed: suiteD.failed },
      { name: suiteE.suite, passed: suiteE.passed, failed: suiteE.failed },
      { name: suiteS.suite, passed: suiteS.passed, failed: suiteS.failed }
    ],
    tests: allTests,
    integrity_verification: {
      all_production_stores_bitwise_identical: allStoresUntouched,
      zero_tracked_git_modifications: gitTrackedClean,
      production_isolation_verified: allStoresUntouched && gitTrackedClean
    }
  };

  const resultsPath = path.join(RESULTS_DIR, 'stage-d4-test-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(testReport, null, 2), 'utf8');

  const proofPath = path.join(RESULTS_DIR, 'stage-d4-integrity-proof.json');
  fs.writeFileSync(proofPath, JSON.stringify({
    mission_id: 'UKD-STAGE-D4-SANDBOX-PATCH-SAFETY-01',
    verified_at: new Date().toISOString(),
    preflight: preflightProof,
    postflight: postflightProof,
    integrity: testReport.integrity_verification
  }, null, 2), 'utf8');

  console.log('\n======================================================================');
  console.log(`🏁 STAGE D.4 MASTER TEST RUNNER COMPLETE: ${totalPassed}/${totalTests} TESTS PASSED (${testReport.summary.pass_rate_pct}%)`);
  console.log(`   Final Verdict:              ${testReport.verdict}`);
  console.log(`   Production Purity Verified: ${testReport.integrity_verification.production_isolation_verified ? 'YES (0 bytes mutated)' : 'FAILED'}`);
  console.log(`   Results Saved To:           ${resultsPath}`);
  console.log(`   Integrity Proof Saved To:   ${proofPath}`);
  console.log('======================================================================\n');

  return testReport;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runAllStageD4Tests();
}

