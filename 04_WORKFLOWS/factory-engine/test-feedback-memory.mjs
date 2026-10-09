/**
 * Automated Verification Suite for Feedback Loop & Cross-Session Memory (Milestone 4)
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-feedback-memory.mjs
 * Purpose: Verifies Milestone 4: Incident staging to 11_INBOX, Candidate Directive tracking,
 *          Verification barrier enforcement, promotion to 05_KNOWLEDGE with read-back barrier,
 *          and Cross-Session Memory recall and constraint injection.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  stageIncidentAsCandidate, 
  promoteCandidateToKnowledge, 
  loadDirectivesRegistry 
} from './feedback-loop.mjs';
import { 
  recordSessionMemory, 
  querySessionMemories, 
  injectSessionMemoryIntoContract 
} from './cross-session-memory.mjs';
import { createTaskContract } from './task-contract.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

const REGISTRY_FILE = path.join(BRAIN_ROOT, '11_INBOX', 'candidate-directives-registry.json');
const PATTERNS_FILE = path.join(BRAIN_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md');
const MEMORY_FILE = path.join(BRAIN_ROOT, '.project-brain', 'session-memory.json');

console.log('======================================================================');
console.log('🧪 TEST SUITE: FEEDBACK LOOP & CROSS-SESSION MEMORY (MILESTONE 4)');
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
const initialRegistry = fs.readFileSync(REGISTRY_FILE, 'utf-8');
const MATRIX_FILE = path.join(BRAIN_ROOT, '08_VERIFICATION', 'harvest-verification-matrix.md');
const LEDGER_FILE = path.join(BRAIN_ROOT, '09_SOURCES', 'harvest-provenance-ledger.md');
const initialMatrix = fs.existsSync(MATRIX_FILE) ? fs.readFileSync(MATRIX_FILE, 'utf-8') : null;
const initialLedger = fs.existsSync(LEDGER_FILE) ? fs.readFileSync(LEDGER_FILE, 'utf-8') : null;

let stagedCandidateId = null;
let stagedFileRel = null;

// ---------------------------------------------------------------------------
// TEST 1: Staging Runtime Incident as Candidate Directive in 11_INBOX
// ---------------------------------------------------------------------------
console.log('[TEST 1] Staging Runtime Incident as Candidate Directive in 11_INBOX...');

const incident = {
  title: 'Client-Side Canvas Transform Drift on Mobile Viewports',
  rootCause: 'Interleaved CSS resize observer recalculations caused non-integer DPR coordinate drift.',
  defectiveCode: 'ctx.scale(window.devicePixelRatio, window.devicePixelRatio);',
  safeCode: 'const dpr = Math.round(window.devicePixelRatio || 1); ctx.scale(dpr, dpr);',
  universalRule: 'Canvas 2D transforms MUST round devicePixelRatio to discrete integers to prevent sub-pixel blur.',
  tags: ['canvas', 'subpixel', 'mobile_viewport']
};

const stageResult = stageIncidentAsCandidate(incident, {
  type: 'runtime_bug_autopsy',
  repo: 'test-canvas-portal',
  commit: 'c90a1b2'
});

assert(stageResult.success === true, 'Incident successfully staged');
assert(stageResult.candidateId.startsWith('CD-'), 'Assigned candidate ID with CD- prefix', stageResult.candidateId);
assert(fs.existsSync(path.join(BRAIN_ROOT, stageResult.filePath)), 'Candidate markdown file created on disk', stageResult.filePath);

stagedCandidateId = stageResult.candidateId;
stagedFileRel = stageResult.filePath;

const registryAfterStage = loadDirectivesRegistry();
const stagedEntry = registryAfterStage.directives.find(d => d.id === stagedCandidateId);
assert(stagedEntry !== undefined, 'Registry contains staged candidate entry');
assert(stagedEntry.status === 'STAGED_FOR_VERIFICATION', 'Status is STAGED_FOR_VERIFICATION');

// ---------------------------------------------------------------------------
// TEST 2: Verification Gating Barrier (Unverified Promotion Blocked)
// ---------------------------------------------------------------------------
console.log('\n[TEST 2] Testing Verification Gating Barrier (Unverified Block)...');

const unverifiedAttempt = promoteCandidateToKnowledge(stagedCandidateId, {
  verified: false // Missing proof!
});

assert(unverifiedAttempt.success === false, 'Promotion blocked without verified proof');
assert(unverifiedAttempt.status === 'REJECTED_UNVERIFIED', 'Status flagged as REJECTED_UNVERIFIED');

// Verify that candidate was NOT added to 05_KNOWLEDGE
const patternsCheck = fs.readFileSync(PATTERNS_FILE, 'utf-8');
assert(!patternsCheck.includes('Client-Side Canvas Transform Drift'), 'Unverified candidate was NOT written to engineering-patterns.md');

// ---------------------------------------------------------------------------
// TEST 3: Empirical Promotion with Read-Back Barrier & Rule Resolution
// ---------------------------------------------------------------------------
console.log('\n[TEST 3] Promoting Verified Candidate into 05_KNOWLEDGE with Read-Back Barrier...');

const promotionResult = promoteCandidateToKnowledge(stagedCandidateId, {
  verified: true,
  patternCode: '// Discrete integer DPR transform\nconst dpr = Math.round(window.devicePixelRatio || 1);',
  negativeCode: '// Anti-pattern: Floating point DPR scaling\nctx.scale(window.devicePixelRatio, window.devicePixelRatio);'
});

assert(promotionResult.success === true, 'Candidate promoted successfully with verified proof');
assert(promotionResult.ruleNumber > 250, 'Assigned valid dynamic rule number', `Rule ${promotionResult.ruleNumber}`);

// Verify read-back from durable storage
const updatedPatterns = fs.readFileSync(PATTERNS_FILE, 'utf-8');
assert(updatedPatterns.includes(`## ${promotionResult.ruleNumber}. ${incident.title}`), 
  'Rule persisted and read back from 05_KNOWLEDGE/engineering-patterns.md');
assert(updatedPatterns.includes('Discrete integer DPR transform'), 
  'Verified code pattern included in rule body');

// Verify candidate registry updated
const registryAfterPromotion = loadDirectivesRegistry();
const promotedEntry = registryAfterPromotion.directives.find(d => d.id === stagedCandidateId);
assert(promotedEntry.status === 'PROMOTED_CANONICAL_ACTIVE', 'Registry status advanced to PROMOTED_CANONICAL_ACTIVE');
assert(promotedEntry.promoted_date !== null, 'Promoted date recorded');

// ---------------------------------------------------------------------------
// TEST 4: Cross-Session Memory Consolidation & Storage
// ---------------------------------------------------------------------------
console.log('\n[TEST 4] Recording Cross-Session Defect Memory & User Critique...');

const memoryRecord = recordSessionMemory({
  task_context: 'Canvas UI Mobile Redesign',
  defect_observed: 'Canvas blur on iPhone 15 Pro display',
  user_critique: 'You made the canvas blurry on retina screens again!',
  invariant_lesson: 'Always normalize DPR to integer to prevent blur on retina displays.',
  negative_warning: 'Never use floating-point window.devicePixelRatio in 2D canvas context transforms.',
  keywords: ['canvas', 'retina', 'dpr', 'blur']
});

assert(memoryRecord.memory_id.startsWith('mem-'), 'Memory record assigned unique mem- ID', memoryRecord.memory_id);

const memoryQuery = querySessionMemories('Fix blurry canvas on retina mobile screens');
assert(memoryQuery.length > 0, 'Memory query retrieved relevant past failure warning');
assert(memoryQuery[0].negative_warning.includes('devicePixelRatio'), 'Top memory warning matches defect invariant');

// ---------------------------------------------------------------------------
// TEST 5: Active Memory Shield Injection into Task Contract
// ---------------------------------------------------------------------------
console.log('\n[TEST 5] Injecting Cross-Session Memory Shield into Task Contract...');

const testContract = createTaskContract({
  task_type: 'FEATURE',
  objective: 'Render interactive canvas chart for retina displays'
});

injectSessionMemoryIntoContract(testContract);

const hasMemoryShield = testContract.constraints.negative_constraints.some(c => 
  c.includes('PAST FAILURE SHIELD') && c.includes('devicePixelRatio')
);
assert(hasMemoryShield === true, 'Past failure warning injected into Task Contract negative constraints');

// ---------------------------------------------------------------------------
// CLEANUP & RESTORATION
// ---------------------------------------------------------------------------
console.log('\n[CLEANUP] Restoring canonical test states...');

// 1. Remove candidate markdown file
if (stagedFileRel && fs.existsSync(path.join(BRAIN_ROOT, stagedFileRel))) {
  try { fs.unlinkSync(path.join(BRAIN_ROOT, stagedFileRel)); } catch (e) {}
}

// 2. Restore candidate directives registry
fs.writeFileSync(REGISTRY_FILE, initialRegistry, 'utf-8');

// 3. Restore engineering patterns file
fs.writeFileSync(PATTERNS_FILE, initialPatterns, 'utf-8');

// 4. Restore verification matrix and provenance ledger
if (initialMatrix !== null) fs.writeFileSync(MATRIX_FILE, initialMatrix, 'utf-8');
if (initialLedger !== null) fs.writeFileSync(LEDGER_FILE, initialLedger, 'utf-8');

// 5. Clean up test memory from session-memory.json
try {
  const memDb = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
  memDb.memories = memDb.memories.filter(m => m.memory_id !== memoryRecord.memory_id);
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memDb, null, 2), 'utf-8');
} catch (e) {}

assert(fs.readFileSync(PATTERNS_FILE, 'utf-8') === initialPatterns, 'Canonical engineering-patterns.md restored pristine');
assert(fs.readFileSync(REGISTRY_FILE, 'utf-8') === initialRegistry, 'Canonical registry restored pristine');

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`🏁 FEEDBACK LOOP & MEMORY VERIFICATION: ${passedTests} PASSED | ${failedTests} FAILED`);
console.log('======================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
