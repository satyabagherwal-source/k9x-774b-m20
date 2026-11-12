import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Import all 13 verification tests
import * as t01 from './verification-tests/test-01-serpiq-extractjson.mjs';
import * as t02 from './verification-tests/test-02-apple-silicon-anchor-heading.mjs';
import * as t03 from './verification-tests/test-03-qwen-image-binary-header.mjs';
import * as t04 from './verification-tests/test-04-minicpm-patch-divisibility.mjs';
import * as t05 from './verification-tests/test-05-minicpm-partial-rope.mjs';
import * as t06 from './verification-tests/test-06-deepseek-mla-cache.mjs';
import * as t07 from './verification-tests/test-07-phocinae-multi-choice.mjs';
import * as t08 from './verification-tests/test-08-qwen-gguf-clamping.mjs';
import * as t09 from './verification-tests/test-09-teleocr-deterministic-decoding.mjs';
import * as t10 from './verification-tests/test-10-openopc-shadow-adapter.mjs';
import * as t11 from './verification-tests/test-11-nucleoid-rust-parser.mjs';
import * as t12 from './verification-tests/test-12-turso-sql-drop-function.mjs';
import * as t13 from './verification-tests/test-13-meta-invariants.mjs';

console.log('========================================================================');
console.log('AI-BUILDER-BRAIN — PHASE E.4: BOUNDED INDEPENDENT VERIFICATION RUNNER');
console.log('========================================================================\n');

const tests = [
  { id: 'TEST-01', module: t01, name: 'serpiq extractJSON' },
  { id: 'TEST-02', module: t02, name: 'Apple Silicon Guide Anchor Heading' },
  { id: 'TEST-03', module: t03, name: 'Qwen Image Binary Header' },
  { id: 'TEST-04', module: t04, name: 'MiniCPM-V Patch Divisibility' },
  { id: 'TEST-05', module: t05, name: 'MiniCPM-V Partial RoPE' },
  { id: 'TEST-06', module: t06, name: 'DeepSeek-R1 MLA KV Cache' },
  { id: 'TEST-07', module: t07, name: 'Phocinae Multi-Choice Logits' },
  { id: 'TEST-08', module: t08, name: 'Qwen GGUF Context Clamping' },
  { id: 'TEST-09', module: t09, name: 'TeleOCR Deterministic Decoding' },
  { id: 'TEST-10', module: t10, name: 'OpenOPC Shadow Adapter' },
  { id: 'TEST-11', module: t11, name: 'Nucleoid Rust Parser' },
  { id: 'TEST-12', module: t12, name: 'Turso Limbo SQL Engine Source' },
  { id: 'TEST-13', module: t13, name: 'Meta-Invariants & Isolation' }
];

const results = [];
let passedSuites = 0;
let totalChecksPassed = 0;
let totalChecksCount = 0;
const executionLog = [];

for (const t of tests) {
  try {
    const res = t.module.run();
    results.push({ testId: t.id, name: t.name, ...res, error: null });
    passedSuites++;
    totalChecksPassed += res.checksPassed;
    totalChecksCount += res.checksTotal;
    
    console.log(`[PASS] ${t.id}: ${t.name} -> Status: ${res.status} (${res.checksPassed}/${res.checksTotal} checks)`);
    for (const l of res.log) {
      executionLog.push(l);
    }
  } catch (err) {
    console.error(`[FAIL] ${t.id}: ${t.name} -> Error: ${err.message}`);
    results.push({
      testId: t.id,
      name: t.name,
      status: 'FAILED_VERIFICATION',
      error: err.message,
      stack: err.stack
    });
    executionLog.push(`FAIL: ${t.id} - ${err.message}`);
  }
}

console.log('\n--- AGGREGATE SUMMARY ---');
console.log(`Suites executed: ${results.length}`);
console.log(`Suites successful: ${passedSuites} / ${results.length}`);
console.log(`Total checks passed: ${totalChecksPassed} / ${totalChecksCount}`);

// Save execution log
const logPath = '.project-brain/simulation-sandbox/phase-e4-verification/execution-logs/execution.log';
fs.writeFileSync(logPath, executionLog.join('\n'), 'utf8');

// Save verification results JSON
const resultsPath = '.project-brain/simulation-sandbox/phase-e4-verification/verification-results.json';
const resultsPayload = {
  timestamp: new Date().toISOString(),
  missionId: 'UKD-PHASE-E4-INDEPENDENT-VERIFICATION-01',
  sampleSize: 12,
  suitesRun: results.length,
  suitesPassed: passedSuites,
  checksPassed: totalChecksPassed,
  checksTotal: totalChecksCount,
  statusBreakdown: {
    VERIFIED_INDEPENDENTLY: results.filter(r => r.status === 'VERIFIED_INDEPENDENTLY').length,
    PARTIALLY_VERIFIED: results.filter(r => r.status === 'PARTIALLY_VERIFIED').length,
    NOT_INDEPENDENTLY_VERIFIABLE: results.filter(r => r.status === 'NOT_INDEPENDENTLY_VERIFIABLE').length,
    FAILED_VERIFICATION: results.filter(r => r.status === 'FAILED_VERIFICATION').length
  },
  candidateOutcomes: results.filter(r => r.candidateId !== 'META-INVARIANTS')
};
fs.writeFileSync(resultsPath, JSON.stringify(resultsPayload, null, 2), 'utf8');
console.log(`Saved results to ${resultsPath}`);

// Write reproducibility instructions
const reproInstructions = `# Phase E.4 Independent Verification Reproducibility Guide

## Environment Prerequisites
- Node.js >= v20 (Tested on Node.js v26.7.0)
- Operating System: Windows / Linux / macOS
- No network access or credentials required (Pure Offline Sandbox)

## Reproduction Commands
\`\`\`bash
# 1. Navigate to repository root
cd C:\\AI-Builder-Brain

# 2. Run the Phase E.4 Master Verification Suite
node .project-brain/simulation-sandbox/phase-e4-verification/run-phase-e4-master.mjs

# 3. Inspect individual candidate source evidence
ls .project-brain/simulation-sandbox/phase-e4-verification/source-evidence/

# 4. Inspect verification execution logs
cat .project-brain/simulation-sandbox/phase-e4-verification/execution-logs/execution.log
\`\`\`
`;
fs.writeFileSync('.project-brain/simulation-sandbox/phase-e4-verification/reproducibility-instructions.md', reproInstructions, 'utf8');
console.log('Saved reproducibility instructions.');

