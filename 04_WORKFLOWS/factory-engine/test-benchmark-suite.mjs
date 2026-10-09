/**
 * Automated Verification Suite for Tri-Modal Intelligence Benchmark (Milestone 5)
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-benchmark-suite.mjs
 * Purpose: Verifies Milestone 5: Tri-modal benchmark execution, invariant evaluation,
 *          comparative condition analysis, and benchmark report generation.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  BENCHMARK_TASKS, 
  EVALUATION_CONDITIONS, 
  evaluateCodeAgainstInvariants,
  runBenchmarkTask,
  runFullBenchmarkMatrix,
  formatBenchmarkReport
} from './benchmark-suite.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

console.log('======================================================================');
console.log('🧪 TEST SUITE: TRI-MODAL INTELLIGENCE BENCHMARK (MILESTONE 5)');
console.log('======================================================================\n');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName} ${details ? '(' + details + ')' : ''}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${details ? ': ' + details : ''}`);
    failedTests++;
  }
}

// ---------------------------------------------------------------------------
// TEST 1: Benchmark Tasks Definitions & Schema
// ---------------------------------------------------------------------------
console.log('[TEST 1] Verifying Benchmark Tasks Definition & Schema...');

assert(Array.isArray(BENCHMARK_TASKS) && BENCHMARK_TASKS.length === 3, 'All 3 canonical benchmark tasks present');

const taskIds = BENCHMARK_TASKS.map(t => t.id);
assert(taskIds.includes('BENCH-01-CRLF-SSR'), 'Task 1 (CRLF & SSR Hydration) defined');
assert(taskIds.includes('BENCH-02-MULTILINGUAL-HREFLANG'), 'Task 2 (Multilingual Hreflang & Canonical) defined');
assert(taskIds.includes('BENCH-03-CANVAS-DPR-SHIELD'), 'Task 3 (Canvas Retina DPR & Memory Shield) defined');

for (const task of BENCHMARK_TASKS) {
  assert(task.criticalInvariants.length >= 3, `Task ${task.id} has >= 3 critical invariants`);
  assert(task.simulatedOutputs.CONDITION_A_RAW_BASE !== undefined, `Task ${task.id} has Condition A simulation`);
  assert(task.simulatedOutputs.CONDITION_B_BRAIN_RETRIEVAL !== undefined, `Task ${task.id} has Condition B simulation`);
  assert(task.simulatedOutputs.CONDITION_C_FULL_UNIVERSAL_LAYER !== undefined, `Task ${task.id} has Condition C simulation`);
}

// ---------------------------------------------------------------------------
// TEST 2: Invariant Evaluation Engine & Anti-Pattern Detection
// ---------------------------------------------------------------------------
console.log('\n[TEST 2] Verifying Invariant Evaluation Engine & Anti-Pattern Trap...');

const task1 = BENCHMARK_TASKS[0];
const naiveCode = 'export function parseLines(t) { return t.split("\\n"); }';
const evalNaive = evaluateCodeAgainstInvariants(naiveCode, task1.criticalInvariants);

assert(evalNaive.compliancePercentage < 50, 'Naive code gets low compliance score', `${evalNaive.compliancePercentage}%`);
assert(evalNaive.antiPatternTriggered === true, 'Anti-pattern correctly triggered on naive split("\\n")');
assert(evalNaive.passedAll === false, 'Naive code correctly flagged as failed');

const compliantCode = `
export function parseLines(template) {
  const isServer = typeof window === 'undefined';
  const normalized = template.replace(/\\r\\n?/g, '\\n');
  return normalized.split('\\n');
}
`;
const evalCompliant = evaluateCodeAgainstInvariants(compliantCode, task1.criticalInvariants);
assert(evalCompliant.compliancePercentage >= 80, 'Compliant code achieves high score', `${evalCompliant.compliancePercentage}%`);
assert(evalCompliant.antiPatternTriggered === false, 'Compliant code avoids anti-patterns');

// ---------------------------------------------------------------------------
// TEST 3: Evaluating Condition A (Raw Base Model)
// ---------------------------------------------------------------------------
console.log('\n[TEST 3] Running Task 1 under Condition A (Raw Base Model)...');

const resCondA = runBenchmarkTask(task1, EVALUATION_CONDITIONS.CONDITION_A_RAW_BASE);
assert(resCondA.tokenOverhead === 0, 'Condition A has zero brain token overhead');
assert(resCondA.contractStatus === 'NONE', 'Condition A has no contract');
assert(resCondA.reWorkCycles > 0, 'Condition A requires re-work cycles due to defects', `Cycles: ${resCondA.reWorkCycles}`);
assert(resCondA.antiPatternTriggered === true, 'Condition A triggered known anti-pattern');

// ---------------------------------------------------------------------------
// TEST 4: Evaluating Condition B (Model + Brain Retrieval)
// ---------------------------------------------------------------------------
console.log('\n[TEST 4] Running Task 1 under Condition B (Model + Brain Retrieval)...');

const resCondB = runBenchmarkTask(task1, EVALUATION_CONDITIONS.CONDITION_B_BRAIN_RETRIEVAL);
assert(resCondB.tokenOverhead > 0, 'Condition B has token overhead from retrieved context', `${resCondB.tokenOverhead} tokens`);
assert(resCondB.compliancePercentage > resCondA.compliancePercentage, 'Condition B improves compliance over Condition A',
  `Cond A: ${resCondA.compliancePercentage}% vs Cond B: ${resCondB.compliancePercentage}%`);
assert(resCondB.contractStatus === 'PROMPT_ONLY', 'Condition B operates in prompt-only mode');

// ---------------------------------------------------------------------------
// TEST 5: Evaluating Condition C (Full Universal Intelligence Layer)
// ---------------------------------------------------------------------------
console.log('\n[TEST 5] Running Task 1 under Condition C (Full Universal Layer)...');

const resCondC = runBenchmarkTask(task1, EVALUATION_CONDITIONS.CONDITION_C_FULL_UNIVERSAL_LAYER);
assert(resCondC.compliancePercentage === 100, 'Condition C achieves 100% invariant compliance');
assert(resCondC.passedAllInvariants === true, 'Condition C passed all critical invariants');
assert(resCondC.antiPatternTriggered === false, 'Condition C blocked all anti-patterns');
assert(resCondC.verificationPassed === true, 'Condition C passed empirical verification barrier');
assert(resCondC.reWorkCycles === 0, 'Condition C requires zero re-work cycles');
assert(resCondC.contractStatus === 'VERIFIED', 'Condition C successfully transitioned contract to VERIFIED');
assert(resCondC.dagStepsTotal > 0, 'Condition C planned with DAG steps', `Steps: ${resCondC.dagStepsTotal}`);

// ---------------------------------------------------------------------------
// TEST 6: Running Full 3x3 Tri-Modal Benchmark Matrix
// ---------------------------------------------------------------------------
console.log('\n[TEST 6] Executing Full 3x3 Benchmark Matrix across All Conditions & Tasks...');

const fullMatrix = runFullBenchmarkMatrix();
assert(fullMatrix.runs.length === 9, 'All 9 condition-task permutations executed (3 tasks * 3 conditions)');

const statsA = fullMatrix.aggregateStats[EVALUATION_CONDITIONS.CONDITION_A_RAW_BASE];
const statsB = fullMatrix.aggregateStats[EVALUATION_CONDITIONS.CONDITION_B_BRAIN_RETRIEVAL];
const statsC = fullMatrix.aggregateStats[EVALUATION_CONDITIONS.CONDITION_C_FULL_UNIVERSAL_LAYER];

assert(statsA.avgCompliancePercentage < 40, 'Condition A average compliance is low (<40%)', `${statsA.avgCompliancePercentage}%`);
assert(statsB.avgCompliancePercentage > statsA.avgCompliancePercentage, 'Condition B improves over Condition A', `${statsB.avgCompliancePercentage}%`);
assert(statsC.avgCompliancePercentage === 100, 'Condition C achieves 100% average compliance');
assert(statsC.firstPassSuccessRate === 100, 'Condition C achieves 100% First-Pass Success Rate');
assert(statsC.totalReWorkCycles === 0, 'Condition C incurs 0 total re-work cycles');

// ---------------------------------------------------------------------------
// TEST 7: Formatting Benchmark Report
// ---------------------------------------------------------------------------
console.log('\n[TEST 7] Formatting Benchmark Markdown Report...');

const reportMd = formatBenchmarkReport(fullMatrix);
assert(typeof reportMd === 'string' && reportMd.length > 500, 'Report generated with substantial content');
assert(reportMd.includes('Condition A: Raw Base Model'), 'Report includes Condition A section');
assert(reportMd.includes('Condition B: Model + Brain Retrieval'), 'Report includes Condition B section');
assert(reportMd.includes('Condition C: Full Universal Intelligence Layer'), 'Report includes Condition C section');
assert(reportMd.includes('Zero-Re-work Empirical Determinism'), 'Report includes architectural conclusions');

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`🏁 BENCHMARK SUITE VERIFICATION: ${passedTests} PASSED | ${failedTests} FAILED`);
console.log('======================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
