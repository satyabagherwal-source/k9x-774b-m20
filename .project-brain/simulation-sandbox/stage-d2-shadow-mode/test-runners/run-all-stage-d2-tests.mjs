/**
 * Master Test Runner for Stage D.2 Shadow Mode Verification
 * 
 * Runs all 12 verification tests across 3 suites:
 * - Suite 1: Shadow Isolation & Preservation (Tests 1 - 4)
 * - Suite 2: Semantic Equivalence & Comparator (Tests 6, 7, 8, 11)
 * - Suite 3: Resilience, Security & Resource Limits (Tests 5, 9, 10, 12)
 * 
 * Generates machine-readable results and cryptographic integrity proofs in results/ directory.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

import { runIsolationTests } from './test-shadow-isolation.mjs';
import { runComparatorTests } from './test-shadow-comparator.mjs';
import { runResilienceTests } from './test-shadow-resilience.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SANDBOX_DIR = path.resolve(__dirname, '..');
const RESULTS_DIR = path.join(SANDBOX_DIR, 'results');
const PROD_BRAIN = path.resolve(__dirname, '..', '..', '..', '..');

function hashFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export async function runAllTests() {
  const startTime = Date.now();
  console.log('======================================================================');
  console.log('🧪 STAGE D.2 SHADOW-MODE COMPREHENSIVE VERIFICATION HARNESS');
  console.log(`   Mission ID: UKD-STAGE-D2-SHADOW-MODE-READINESS-01`);
  console.log(`   Sandbox:    ${SANDBOX_DIR}`);
  console.log(`   Timestamp:  ${new Date().toISOString()}`);
  console.log('======================================================================');

  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  // Preflight snapshot of production files
  const domRegPath = path.join(PROD_BRAIN, '05_KNOWLEDGE', 'domain-intelligence', 'domain-registry.json');
  const candRegPath = path.join(PROD_BRAIN, '11_INBOX', 'candidate-directives-registry.json');
  const cachePath = path.join(PROD_BRAIN, '.project-brain', 'cache', 'retrieval-index.json');
  const graphPath = path.join(PROD_BRAIN, '05_KNOWLEDGE', 'domain-intelligence', 'relationship-graph.json');

  const preflightProof = {
    domain_registry: { path: '05_KNOWLEDGE/domain-intelligence/domain-registry.json', sha256: hashFile(domRegPath) },
    candidate_registry: { path: '11_INBOX/candidate-directives-registry.json', sha256: hashFile(candRegPath) },
    relationship_graph: { path: '05_KNOWLEDGE/domain-intelligence/relationship-graph.json', sha256: hashFile(graphPath) }
  };

  // Run the 3 test suites
  const suite1 = await runIsolationTests();
  const suite2 = await runComparatorTests();
  const suite3 = await runResilienceTests();

  const allTests = [
    ...suite1.tests,
    ...suite2.tests,
    ...suite3.tests
  ];

  const totalPassed = allTests.filter(t => t.passed).length;
  const totalFailed = allTests.filter(t => !t.passed).length;
  const totalTests = allTests.length;

  // Postflight verification of production files
  const postflightProof = {
    domain_registry: { path: '05_KNOWLEDGE/domain-intelligence/domain-registry.json', sha256: hashFile(domRegPath) },
    candidate_registry: { path: '11_INBOX/candidate-directives-registry.json', sha256: hashFile(candRegPath) },
    relationship_graph: { path: '05_KNOWLEDGE/domain-intelligence/relationship-graph.json', sha256: hashFile(graphPath) }
  };

  const domainRegIntact = preflightProof.domain_registry.sha256 === postflightProof.domain_registry.sha256;
  const candRegIntact = preflightProof.candidate_registry.sha256 === postflightProof.candidate_registry.sha256;
  const graphIntact = preflightProof.relationship_graph.sha256 === postflightProof.relationship_graph.sha256;

  // Verify git status
  let gitStatusClean = false;
  try {
    const gitStatus = execSync('git status --short', { cwd: PROD_BRAIN, encoding: 'utf8' });
    const trackedChanges = gitStatus.split('\n').filter(line => line && !line.startsWith('??'));
    gitStatusClean = trackedChanges.length === 0;
  } catch (err) {
    gitStatusClean = false;
  }

  const durationMs = Date.now() - startTime;

  const testReport = {
    mission_id: 'UKD-STAGE-D2-SHADOW-MODE-READINESS-01',
    timestamp: new Date().toISOString(),
    execution_duration_ms: durationMs,
    overall_status: totalFailed === 0 && domainRegIntact && candRegIntact ? 'VERIFIED' : 'FAILED',
    summary: {
      total_tests: totalTests,
      passed: totalPassed,
      failed: totalFailed,
      pass_rate_pct: ((totalPassed / totalTests) * 100).toFixed(1)
    },
    suites: [
      { name: suite1.suite, passed: suite1.passed, failed: suite1.failed },
      { name: suite2.suite, passed: suite2.passed, failed: suite2.failed },
      { name: suite3.suite, passed: suite3.passed, failed: suite3.failed }
    ],
    tests: allTests,
    integrity_verification: {
      domain_registry_preserved: domainRegIntact,
      candidate_registry_preserved: candRegIntact,
      relationship_graph_preserved: graphIntact,
      zero_tracked_git_modifications: gitStatusClean,
      production_write_isolation_verified: domainRegIntact && candRegIntact && graphIntact && gitStatusClean
    }
  };

  // Write machine-readable outputs
  const resultsPath = path.join(RESULTS_DIR, 'stage-d2-test-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(testReport, null, 2), 'utf8');

  const proofPath = path.join(RESULTS_DIR, 'stage-d2-integrity-proof.json');
  fs.writeFileSync(proofPath, JSON.stringify({
    mission_id: 'UKD-STAGE-D2-SHADOW-MODE-READINESS-01',
    verified_at: new Date().toISOString(),
    preflight: preflightProof,
    postflight: postflightProof,
    integrity: testReport.integrity_verification
  }, null, 2), 'utf8');

  console.log('\n======================================================================');
  console.log(`🏁 MASTER TEST RUNNER COMPLETE: ${totalPassed}/${totalTests} TESTS PASSED (${testReport.summary.pass_rate_pct}%)`);
  console.log(`   Overall Status:            ${testReport.overall_status}`);
  console.log(`   Production Write Isolation: ${testReport.integrity_verification.production_write_isolation_verified ? 'VERIFIED (0 bytes mutated)' : 'FAILED'}`);
  console.log(`   Results Saved To:          ${resultsPath}`);
  console.log(`   Proof Saved To:            ${proofPath}`);
  console.log('======================================================================\n');

  return testReport;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runAllTests();
}

