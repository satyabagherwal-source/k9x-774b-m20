/**
 * Unified Test Runner for Agentic Knowledge Gateway
 */
import fs from 'fs';
import path from 'path';
import { runUnitTests } from './test-product-unit.mjs';
import { runAdversarialTests } from './test-product-adversarial.mjs';
import { runCliTests } from './test-product-cli.mjs';

console.log('================================================================');
console.log('AGENTIC KNOWLEDGE GATEWAY (agentic-kgw) — INDEPENDENT TEST SUITE');
console.log('================================================================\n');

const allLogs = [];

const unit = runUnitTests();
unit.log.forEach(l => { console.log(l); allLogs.push(l); });

console.log('\n');
const adv = runAdversarialTests();
adv.log.forEach(l => { console.log(l); allLogs.push(l); });

console.log('\n');
const cli = runCliTests();
cli.log.forEach(l => { console.log(l); allLogs.push(l); });

const totalPassed = unit.passed + adv.passed + cli.passed;
const totalTests = unit.total + adv.total + cli.total;

console.log('\n================================================================');
console.log(`AGGREGATE RESULT: ${totalPassed} / ${totalTests} checks passed (${(totalPassed / totalTests * 100).toFixed(1)}%)`);
console.log('================================================================');

// Save test results JSON
const resultsPayload = {
  timestamp: new Date().toISOString(),
  productName: 'agentic-kgw',
  version: '1.0.0',
  suites: {
    unit: { passed: unit.passed, total: unit.total },
    adversarial: { passed: adv.passed, total: adv.total },
    cli: { passed: cli.passed, total: cli.total }
  },
  totalPassed,
  totalTests,
  status: totalPassed === totalTests ? 'ALL_PASSED' : 'SOME_FAILED'
};

fs.writeFileSync(
  '.project-brain/simulation-sandbox/phase-f-construction/tests/test-results.json',
  JSON.stringify(resultsPayload, null, 2),
  'utf8'
);

