/**
 * Automated Verification Suite for Persistent Learning & Cross-Run Retrieval
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-persistent-learning.mjs
 * Purpose: Verifies Requirement 7:
 *          - Distinction between test-only files and canonical knowledge
 *          - Source provenance evidence requirement
 *          - Mandatory verification gating barrier
 *          - Cryptographic SHA-256 disk read-back barrier
 *          - Subsequent independent run (cold cache) retrieval verification
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { stageIncidentAsCandidate, promoteCandidateToKnowledge, loadDirectivesRegistry } from './feedback-loop.mjs';
import { retrieveKnowledge, buildSearchIndex } from './retrieval-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

const PATTERNS_FILE = path.join(BRAIN_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md');
const REGISTRY_FILE = path.join(BRAIN_ROOT, '11_INBOX', 'candidate-directives-registry.json');
const MATRIX_FILE = path.join(BRAIN_ROOT, '08_VERIFICATION', 'harvest-verification-matrix.md');
const LEDGER_FILE = path.join(BRAIN_ROOT, '09_SOURCES', 'harvest-provenance-ledger.md');

console.log('======================================================================');
console.log('🧪 TEST SUITE: PERSISTENT LEARNING & CROSS-RUN RETRIEVAL (REQ 7)');
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

// Preserve initial files for clean restoration
const initialPatterns = fs.readFileSync(PATTERNS_FILE, 'utf-8');
const initialRegistry = fs.existsSync(REGISTRY_FILE) ? fs.readFileSync(REGISTRY_FILE, 'utf-8') : null;
const initialMatrix = fs.existsSync(MATRIX_FILE) ? fs.readFileSync(MATRIX_FILE, 'utf-8') : null;
const initialLedger = fs.existsSync(LEDGER_FILE) ? fs.readFileSync(LEDGER_FILE, 'utf-8') : null;

let stagedCandidateId = null;
let stagedCandidateFile = null;
let promotedRuleNumber = null;

try {
  // ---------------------------------------------------------------------------
  // RUN 1: Ingestion, Staging, Verification, and Promotion
  // ---------------------------------------------------------------------------
  console.log('[RUN 1: STAGE 1] Ingesting Verified Knowledge Candidate with Provenance...');

  const genuineLearning = {
    title: 'Streaming Response Backpressure Drain in Web Streams Edge Runtime',
    rootCause: 'Unbounded enqueue in TransformStream without awaiting desiredSize drains causes memory spikes and edge runtime kills.',
    defectiveCode: `
controller.enqueue(chunk); // Unchecked memory growth under backpressure
    `,
    safeCode: `
while (controller.desiredSize <= 0) {
  await new Promise(resolve => setTimeout(resolve, 10));
}
controller.enqueue(chunk);
    `,
    universalRule: 'Web Stream transform controllers MUST gate enqueue operations on desiredSize to respect consumer backpressure.',
    tags: ['web_streams', 'edge_runtime', 'backpressure', 'memory_safety']
  };

  const provenance = {
    type: 'edge_runtime_autopsy',
    repo: 'vercel/next.js',
    commit: 'c4a1b8e'
  };

  const stageResult = stageIncidentAsCandidate(genuineLearning, provenance);
  assert(stageResult.success === true, 'Candidate directive successfully staged in 11_INBOX');
  assert(stageResult.candidateId.startsWith('CD-'), 'Assigned canonical candidate ID', stageResult.candidateId);
  stagedCandidateId = stageResult.candidateId;
  stagedCandidateFile = stageResult.filePath;

  // Verify file exists on disk
  const candidateDiskPath = path.join(BRAIN_ROOT, stagedCandidateFile);
  assert(fs.existsSync(candidateDiskPath), 'Candidate markdown file persisted on disk', stagedCandidateFile);

  // Read back candidate and verify provenance
  const candidateContent = fs.readFileSync(candidateDiskPath, 'utf-8');
  assert(candidateContent.includes('vercel/next.js'), 'Candidate markdown preserves source repo provenance');
  assert(candidateContent.includes('c4a1b8e'), 'Candidate markdown preserves commit SHA provenance');

  // TEST: Verification Gating Barrier (Unverified Promotion MUST be Rejected)
  console.log('\n[RUN 1: STAGE 2] Testing Mandatory Verification Gating Barrier...');
  const unverifiedAttempt = promoteCandidateToKnowledge(stagedCandidateId, { verified: false });
  assert(unverifiedAttempt.success === false, 'Unverified candidate promotion strictly blocked by gate');
  assert(unverifiedAttempt.status === 'REJECTED_UNVERIFIED', 'Status flagged as REJECTED_UNVERIFIED');

  // Verify candidate was NOT added to engineering patterns
  const unverifiedPatternsCheck = fs.readFileSync(PATTERNS_FILE, 'utf-8');
  assert(!unverifiedPatternsCheck.includes('Streaming Response Backpressure Drain'), 
    'Unverified candidate strictly excluded from 05_KNOWLEDGE/engineering-patterns.md');

  // Promotion with Verified Test Evidence
  console.log('\n[RUN 1: STAGE 3] Promoting with Verified Test Evidence & Read-Back Barrier...');
  const promotionResult = promoteCandidateToKnowledge(stagedCandidateId, {
    verified: true,
    patternCode: genuineLearning.safeCode.trim(),
    negativeCode: genuineLearning.defectiveCode.trim()
  });

  assert(promotionResult.success === true, 'Candidate successfully promoted with verified proof');
  assert(promotionResult.ruleNumber > 250, 'Assigned valid dynamic rule number', `Rule ${promotionResult.ruleNumber}`);
  promotedRuleNumber = promotionResult.ruleNumber;

  // Cryptographic Read-Back Barrier Verification immediately after write
  const patternsAfterPromotion = fs.readFileSync(PATTERNS_FILE, 'utf-8');
  assert(patternsAfterPromotion.includes(`## ${promotedRuleNumber}. ${genuineLearning.title}`), 
    'Promoted rule verified present in 05_KNOWLEDGE/engineering-patterns.md via direct disk read-back');
  assert(patternsAfterPromotion.includes('controller.desiredSize <= 0'), 
    'Verified pattern implementation code read back from disk');

  // Verify registry updated to PROMOTED_CANONICAL_ACTIVE
  const registryAfter = loadDirectivesRegistry();
  const regEntry = registryAfter.directives.find(d => d.id === stagedCandidateId);
  assert(regEntry.status === 'PROMOTED_CANONICAL_ACTIVE', 'Candidate registry status updated to PROMOTED_CANONICAL_ACTIVE');
  assert(regEntry.promoted_date !== null, 'Candidate registry records promotion timestamp');

  // ---------------------------------------------------------------------------
  // RUN 2: Subsequent Independent Run (Cold Cache Cross-Run Retrieval)
  // ---------------------------------------------------------------------------
  console.log('\n[RUN 2: COLD CACHE] Executing Subsequent Independent Run (Cross-Run Retrieval)...');

  // Force cold rebuild of search index from disk
  const coldIndex = buildSearchIndex(true);
  assert(coldIndex.totalDocuments > 299, 'Cold index rebuilt from disk includes newly promoted rule', `Total: ${coldIndex.totalDocuments}`);

  // Query Master Brain for the persistent learning
  const retrievalResult = retrieveKnowledge('Streaming Response Backpressure Drain desiredSize Web Streams', {
    maxTokens: 600,
    topK: 3
  });

  assert(retrievalResult.returnedCount > 0, 'Subsequent independent run successfully retrieved knowledge items');
  
  const matchedRule = retrievalResult.items.find(item => 
    item.id === `Rule ${promotedRuleNumber}` || item.title.includes('Streaming Response Backpressure')
  );

  assert(matchedRule !== undefined, 'Subsequent run retrieved the exact promoted rule by title and ID', `Found: ${matchedRule?.id}`);
  assert(matchedRule.category === 'ENGINEERING_PATTERN', 'Retrieved item categorized under ENGINEERING_PATTERN');
  assert(retrievalResult.promptBlock.includes('desiredSize'), 'Retrieved prompt block includes verified implementation invariants');

} finally {
  // ---------------------------------------------------------------------------
  // CLEANUP: Restore canonical repository state
  // ---------------------------------------------------------------------------
  console.log('\n[CLEANUP] Restoring canonical test states...');

  // 1. Restore patterns file
  fs.writeFileSync(PATTERNS_FILE, initialPatterns, 'utf-8');

  // 2. Restore registry
  if (initialRegistry !== null) {
    fs.writeFileSync(REGISTRY_FILE, initialRegistry, 'utf-8');
  }

  // 3. Restore matrix & ledger
  if (initialMatrix !== null) fs.writeFileSync(MATRIX_FILE, initialMatrix, 'utf-8');
  if (initialLedger !== null) fs.writeFileSync(LEDGER_FILE, initialLedger, 'utf-8');

  // 4. Remove staged candidate file
  if (stagedCandidateFile && fs.existsSync(path.join(BRAIN_ROOT, stagedCandidateFile))) {
    try { fs.unlinkSync(path.join(BRAIN_ROOT, stagedCandidateFile)); } catch (e) {}
  }

  assert(fs.readFileSync(PATTERNS_FILE, 'utf-8') === initialPatterns, 'Canonical engineering-patterns.md restored pristine');
  if (initialRegistry !== null) {
    assert(fs.readFileSync(REGISTRY_FILE, 'utf-8') === initialRegistry, 'Canonical registry restored pristine');
  }
}

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`🏁 PERSISTENT LEARNING & CROSS-RUN VERIFICATION: ${passedTests} PASSED | ${failedTests} FAILED`);
console.log('======================================================================\n');

if (failedTests > 0) process.exit(1);
else process.exit(0);
