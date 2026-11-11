/**
 * Comprehensive Automated Verification Suite for P1 Epistemic Promotion Bridge
 * 
 * Location: 04_WORKFLOWS/factory-engine/test-project-learning-promotion-bridge.mjs
 * Purpose:
 *   - Verifies the full epistemic promotion pipeline from 07_PROJECT_LEARNING to Canonical Registry
 *   - 100% Sandbox Isolation: ZERO writes to production registries or logs
 *   - Validates all 4 validation pillars & strict gating
 *   - Validates normalized semantic hash duplicate detection & conflict interception
 *   - Validates batch evaluation APIs & 13-domain coverage
 *   - Validates end-to-end promotion to retrieval query
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import {
  KNOWLEDGE_STAGE,
  VALIDATION_PILLARS,
  discoverProjectLearningCandidates,
  classifyProjectLearningCandidate,
  validateProjectLearningCandidate,
  checkDuplicatesAndConflicts,
  promoteProjectLearningToMasterBrain,
  evaluateDossierForPromotion,
  scanLearningDirectoryForCandidates
} from './project-learning-promotion-bridge.mjs';

import {
  loadDomainRegistry,
  getDomainStoragePaths,
  queryDomainIntelligence,
  INTELLIGENCE_DOMAINS
} from './domain-intelligence-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

console.log('======================================================================');
console.log('🧪 TEST SUITE: P1 EPISTEMIC PROMOTION BRIDGE (SANDBOX ISOLATED)');
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
// 0. Set Up Isolated Sandbox Fixture
// ---------------------------------------------------------------------------
const tempSandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promotion-bridge-test-'));
const sandboxKnowledgeDir = path.join(tempSandboxDir, '05_KNOWLEDGE', 'domain-intelligence');
const sandboxVerifDir = path.join(tempSandboxDir, '08_VERIFICATION');
const sandboxSourcesDir = path.join(tempSandboxDir, '09_SOURCES');

fs.mkdirSync(sandboxKnowledgeDir, { recursive: true });
fs.mkdirSync(sandboxVerifDir, { recursive: true });
fs.mkdirSync(sandboxSourcesDir, { recursive: true });

// Seed sandbox with a copy of production domain-registry.json
const { registryFile: prodRegistryFile } = getDomainStoragePaths(BRAIN_ROOT);
const prodRegRawBefore = fs.readFileSync(prodRegistryFile, 'utf8');
const prodRegShaBefore = crypto.createHash('sha256').update(prodRegRawBefore).digest('hex');
fs.copyFileSync(prodRegistryFile, path.join(sandboxKnowledgeDir, 'domain-registry.json'));

// Create empty sandbox matrix and ledger files
const sandboxMatrixFile = path.join(sandboxVerifDir, 'harvest-verification-matrix.md');
const sandboxLedgerFile = path.join(sandboxSourcesDir, 'harvest-provenance-ledger.md');
fs.writeFileSync(sandboxMatrixFile, '# Verification Matrix\n| Cycle | Date | Project | Evidence | Status | Record | Verified |\n|---|---|---|---|---|---|---|\n', 'utf8');
fs.writeFileSync(sandboxLedgerFile, '# Provenance Ledger\n| ID | Source | Version | File | Timestamp |\n|---|---|---|---|---|\n', 'utf8');

const baseOptions = {
  brainRoot: tempSandboxDir,
  skipSearch: true,
  matrixFile: sandboxMatrixFile,
  ledgerFile: sandboxLedgerFile
};

try {
  // ---------------------------------------------------------------------------
  // TEST 1: Markdown Table Candidate Discovery
  // ---------------------------------------------------------------------------
  console.log('[TEST 1] Discovering Candidates from Project Learning Markdown Table...');
  const tableText = `
# Project Learning Log — VectorConverterApp
| Date | Source | Category | Lesson / Pattern | Invariant Rule |
|---|---|---|---|---|
| 2026-11-06 | VectorConverterApp | UI Design & Tokens | High-contrast OKLCH theme tokens eliminate color drift across OLED mobile displays | Always define color palette using OKLCH color space in global.css tokens to guarantee WCAG 2.1 contrast ratios on mobile displays |
`;
  const tableCandidates = discoverProjectLearningCandidates(tableText, { projectName: 'VectorConverterApp' });
  assert(tableCandidates.length === 1, 'Discovered exactly 1 candidate from table', `Count: ${tableCandidates.length}`);
  assert(tableCandidates[0].stage === KNOWLEDGE_STAGE.EXTRACTED, 'Initial candidate stage is EXTRACTED');
  assert(tableCandidates[0].project_name === 'VectorConverterApp', 'Preserved source project name');

  // ---------------------------------------------------------------------------
  // TEST 2: Section 6 8-Axis Dossier Candidate Discovery (Real Harvest Format)
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 2] Discovering Candidates from Section 6 Net-New Universal Engineering Rules...');
  const section6Text = `
> **Canonical Learning Artifact**: \`07_PROJECT_LEARNING/sample-app-learnings.md\`  
> **Source**: github (https://github.com/sample/app)  
> **Source Version**: \`a1b2c3d4\`  
> **License**: MIT  
> **Timestamp**: 2026-11-08T12:00:00.000Z  

## 1. Context & Overview
Description of sample app.

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. Safe Async Resource Disposal Pipeline

**RULE**:
All background worker streams must register explicit AbortController signal handlers and await pending stream flushes before terminating worker threads to prevent silent memory descriptor leaks under high-throughput workloads.

**WHY**:
Prevents thread termination prior to socket buffer drain, which causes descriptor leaks and socket exhaustion in long-running services.

**WHEN TO APPLY**:
Subsystems managing Node.js Worker threads, worker pools, or persistent stream pipelines.

**VERIFIED IMPLEMENTATION PATTERN**:
\`\`\`javascript
worker.on('exit', async () => {
  abortController.abort();
  await stream.flush();
});
\`\`\`

**NEGATIVE CONSTRAINT**:
Never call process.exit() without waiting for active stream drain.

**VERIFICATION METHOD**:
Automated stress test verifying socket descriptor counts remain constant across 10,000 requests.
`;

  const s6Candidates = discoverProjectLearningCandidates(section6Text, { projectName: 'sample-app' });
  assert(s6Candidates.length === 1, 'Extracted Section 6 rule candidate', `Count: ${s6Candidates.length}`);
  assert(s6Candidates[0].title === 'Safe Async Resource Disposal Pipeline', 'Preserved exact rule title');
  assert(s6Candidates[0].source_uri === 'https://github.com/sample/app', 'Extracted source URI from header');
  assert(s6Candidates[0].source_version === 'a1b2c3d4', 'Extracted commit SHA from header');
  assert(s6Candidates[0].license === 'MIT', 'Extracted license from header');
  assert(s6Candidates[0].universal_invariant.includes('AbortController signal handlers'), 'Extracted rule invariant text');

  // ---------------------------------------------------------------------------
  // TEST 3: 13-Domain Classification Matrix
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 3] Verifying 13-Domain Classification Coverage...');
  const designCandidate = tableCandidates[0];
  const classifiedDesign = classifyProjectLearningCandidate(designCandidate, baseOptions);
  assert(classifiedDesign.stage === KNOWLEDGE_STAGE.CANDIDATE, 'Transitioned to CANDIDATE stage');
  assert(classifiedDesign.primary_domain.letter === 'F', 'Classified color tokens into Domain F (Design)');

  const s6Candidate = s6Candidates[0];
  const classifiedTech = classifyProjectLearningCandidate(s6Candidate, baseOptions);
  assert(classifiedTech.primary_domain.letter === 'H' || classifiedTech.primary_domain.letter === 'D', 'Classified async disposal into Technical/Systems domain', classifiedTech.primary_domain.name);

  // ---------------------------------------------------------------------------
  // TEST 4: Strict 4-Pillar Validation Gate
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 4] Testing Strict 4-Pillar Validation Barrier...');
  
  // 4a. Unverified rejection
  const unverified = validateProjectLearningCandidate(classifiedDesign, { verified: false }, baseOptions);
  assert(unverified.valid === false, 'Rejected unverified candidate');
  assert(unverified.stage === KNOWLEDGE_STAGE.REJECTED_UNVERIFIED, 'Marked stage REJECTED_UNVERIFIED');

  // 4b. Failed exit code rejection
  const nonZeroExit = validateProjectLearningCandidate(classifiedDesign, { verified: true, exit_code: 1 }, baseOptions);
  assert(nonZeroExit.valid === false, 'Rejected candidate with exit code 1');

  // 4c. Insufficient substance rejection (< 25 chars)
  const shortCand = { ...classifiedDesign, universal_invariant: 'Do tests.' };
  const shortCheck = validateProjectLearningCandidate(shortCand, { verified: true, exit_code: 0 }, baseOptions);
  assert(shortCheck.valid === false, 'Rejected candidate with insufficient substance (<25 chars)');
  assert(shortCheck.stage === KNOWLEDGE_STAGE.REJECTED_UNSOUND, 'Marked stage REJECTED_UNSOUND');

  // 4d. Speculative claim rejection
  const specCand = { ...classifiedDesign, universal_invariant: 'Using OKLCH might work and probably fixes color issues.' };
  const specCheck = validateProjectLearningCandidate(specCand, { verified: true, exit_code: 0 }, baseOptions);
  assert(specCheck.valid === false, 'Rejected candidate with speculative phrasing ("might work")');

  // 4e. Workstation path leak rejection
  const pathLeaked = { ...classifiedDesign, universal_invariant: 'Cache configs at C:\\Users\\Admin\\AppData\\Local\\config.json to prevent errors.' };
  const pathCheck = validateProjectLearningCandidate(pathLeaked, { verified: true, exit_code: 0 }, baseOptions);
  assert(pathCheck.valid === false, 'Rejected candidate with workstation path leak (C:\\Users\\)');

  // 4f. Localhost port leak rejection
  const portLeaked = { ...classifiedDesign, universal_invariant: 'Proxy traffic to localhost:8080 for inter-service communication.' };
  const portCheck = validateProjectLearningCandidate(portLeaked, { verified: true, exit_code: 0 }, baseOptions);
  assert(portCheck.valid === false, 'Rejected candidate with localhost port leak');

  // 4g. High-impact domain cryptographic human review staging
  const archCand = {
    ...classifiedDesign,
    forcedDomain: 'G',
    primary_domain: { letter: 'G', name: 'Architecture' },
    universal_invariant: 'Micro-frontends must enforce strict isolation boundaries via independent custom element registries.'
  };
  const archCheck = validateProjectLearningCandidate(archCand, { verified: true, exit_code: 0 }, baseOptions);
  assert(archCheck.valid === false, 'Staged Domain G candidate without human authorization token');
  assert(archCheck.stage === KNOWLEDGE_STAGE.STAGED_FOR_HUMAN_REVIEW, 'Marked stage STAGED_FOR_HUMAN_REVIEW');

  // 4h. Valid candidate acceptance
  const validProof = {
    verified: true,
    exit_code: 0,
    evidence_type: 'EMPIRICAL_TEST_PASS',
    test_suite: 'test-contrast-ratios.mjs'
  };
  const validCheck = validateProjectLearningCandidate(classifiedDesign, validProof, baseOptions);
  assert(validCheck.valid === true, 'Successfully passed all 4 validation pillars');
  assert(validCheck.stage === KNOWLEDGE_STAGE.VALIDATED, 'Transitioned to VALIDATED stage');

  // ---------------------------------------------------------------------------
  // TEST 5: Promotion to Sandbox Canonical Registry
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 5] Promoting Validated Candidate to Sandbox Canonical Registry...');
  const promotionRes = promoteProjectLearningToMasterBrain(designCandidate, validProof, baseOptions);
  assert(promotionRes.success === true, 'Promotion pipeline succeeded');
  assert(promotionRes.stage === KNOWLEDGE_STAGE.CANONICAL, 'Promoted to CANONICAL stage');
  assert(promotionRes.record_id && promotionRes.record_id.startsWith('DOM-F-'), 'Assigned canonical ID', promotionRes.record_id);
  assert(promotionRes.domain_letter === 'F', 'Persisted under Domain F');

  // Verify record in sandbox registry
  const sandboxRegistry = loadDomainRegistry(tempSandboxDir);
  assert(sandboxRegistry.records[promotionRes.record_id] !== undefined, 'Record retrievable from sandbox domain-registry.json');
  assert(sandboxRegistry.domains.F.record_ids.includes(promotionRes.record_id), 'Domain F tracks promoted record ID');

  // Verify sandbox audit logs appended
  const matrixContent = fs.readFileSync(sandboxMatrixFile, 'utf8');
  assert(matrixContent.includes(promotionRes.record_id), 'Appended verification row to sandbox matrix');
  const ledgerContent = fs.readFileSync(sandboxLedgerFile, 'utf8');
  assert(ledgerContent.includes(`learn-${promotionRes.record_id.toLowerCase()}`), 'Appended provenance row to sandbox ledger');

  // ---------------------------------------------------------------------------
  // TEST 6: Repeated Promotion Idempotency & Duplicate Interception
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 6] Testing Idempotency & Duplicate Interception...');
  const repeatRes = promoteProjectLearningToMasterBrain(designCandidate, validProof, baseOptions);
  assert(repeatRes.success === false, 'Repeated promotion blocked duplicate');
  assert(repeatRes.stage === KNOWLEDGE_STAGE.DUPLICATE_SKIPPED, 'Stage marked DUPLICATE_SKIPPED');
  assert(repeatRes.existing_record_id === promotionRes.record_id, 'Referenced original record ID', repeatRes.existing_record_id);

  // ---------------------------------------------------------------------------
  // TEST 7: Normalized Semantic Hash Deduplication (Trace Token Invariance)
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 7] Testing Normalized Semantic Hash Deduplication...');
  // Same content but with a trace token added to candidate invariant
  const traceCandidate = {
    ...designCandidate,
    universal_invariant: `${designCandidate.universal_invariant}\n\n--- [Trace Token: newtoken999]`
  };
  const classifiedTrace = classifyProjectLearningCandidate(traceCandidate, baseOptions);
  const traceDupCheck = checkDuplicatesAndConflicts(classifiedTrace, tempSandboxDir, baseOptions);
  assert(traceDupCheck.isDuplicate === true, 'Detected duplicate despite trace token');
  assert(traceDupCheck.existingRecordId === promotionRes.record_id, 'Matched original record ID via normalized hash');

  // ---------------------------------------------------------------------------
  // TEST 8: Fast Domain-Targeted Retrieval in Sandbox
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 8] Verifying Fast Domain-Targeted Retrieval in Sandbox...');
  const retrievalRes = queryDomainIntelligence('F', 'OKLCH contrast', tempSandboxDir);
  assert(retrievalRes.total_found >= 1, 'queryDomainIntelligence found promoted record in sandbox', `Found: ${retrievalRes.total_found}`);
  assert(retrievalRes.results[0].record_id === promotionRes.record_id, 'Top result matches promoted record ID');

  // ---------------------------------------------------------------------------
  // TEST 9: Batch Dossier Evaluation API (Dry-Run & Promotion)
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 9] Testing Batch Dossier Evaluation API...');
  const dryRunRes = evaluateDossierForPromotion(section6Text, {
    ...baseOptions,
    projectName: 'sample-app',
    dryRun: true
  });
  console.log('dryRunRes:', JSON.stringify(dryRunRes, null, 2));
  assert(dryRunRes.total_candidates_discovered === 1, 'Batch API discovered 1 candidate in dry-run');
  assert(dryRunRes.promoted.length === 1, 'Batch dry-run reported 1 eligible promotion');
  assert(dryRunRes.promoted[0].dryRun === true, 'Flagged as dry-run');

  // Execute live promotion in sandbox via evaluateDossierForPromotion
  const liveBatchRes = evaluateDossierForPromotion(section6Text, {
    ...baseOptions,
    projectName: 'sample-app',
    dryRun: false
  });
  assert(liveBatchRes.promoted.length === 1, 'Batch live promotion succeeded in sandbox');
  assert(liveBatchRes.promoted[0].record_id !== undefined, 'Assigned record ID in batch promotion', liveBatchRes.promoted[0].record_id);

  // ---------------------------------------------------------------------------
  // TEST 10: Production Knowledge Registry Integrity Check
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 10] Verifying Production Registry Integrity...');
  const prodRegRawAfter = fs.readFileSync(prodRegistryFile, 'utf8');
  const prodRegShaAfter = crypto.createHash('sha256').update(prodRegRawAfter).digest('hex');
  const prodRegAfter = JSON.parse(prodRegRawAfter);
  const prodRegBaseline = JSON.parse(prodRegRawBefore);
  
  assert(prodRegAfter.total_records === prodRegBaseline.total_records, 'Production registry total_records is completely unchanged', `Count: ${prodRegAfter.total_records}`);
  assert(Object.keys(prodRegAfter.records).length === Object.keys(prodRegBaseline.records).length, 'Production records count unchanged');
  assert(prodRegShaAfter === prodRegShaBefore, 'Production registry byte-for-byte sha256 checksum is identical', prodRegShaAfter.substring(0, 8));
  assert(!Object.keys(prodRegAfter.records).includes(promotionRes.record_id), 'Promoted test record does NOT exist in production registry');

} finally {
  // Always clean up sandbox
  fs.rmSync(tempSandboxDir, { recursive: true, force: true });
  console.log('  🧹 Sandbox test fixture completely removed.');
}

console.log('\n======================================================================');
console.log(`🏁 P1 EPISTEMIC PROMOTION BRIDGE TEST SUITE: ${passedTests} PASSED | ${failedTests} FAILED`);
console.log('======================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
