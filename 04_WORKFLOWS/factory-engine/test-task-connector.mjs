/**
 * Automated Verification Suite for Universal Task Contract & Connector Interface (Milestone 2)
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-task-connector.mjs
 * Purpose: Verifies Milestone 2: Task Contract validation, Context Resolution with Brain retrieval,
 *          Prompt preparation, Resilient Checkpointing, and Verification Barrier Evaluation.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  createTaskContract, 
  validateTaskContract, 
  TASK_STATUS 
} from './task-contract.mjs';
import { 
  resolveTaskContext, 
  formatExecutionPrompt, 
  recordTaskCheckpoint, 
  loadTaskCheckpoint, 
  verifyExecutionResult 
} from './brain-connector.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');
const CHECKPOINTS_FILE = path.join(BRAIN_ROOT, '.project-brain', 'task-checkpoints.json');

console.log('======================================================================');
console.log('🧪 TEST SUITE: UNIVERSAL TASK CONTRACT & CONNECTOR (MILESTONE 2)');
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
// TEST 1: Task Contract Creation & Schema Validation
// ---------------------------------------------------------------------------
console.log('[TEST 1] Creating and Validating Canonical Task Contract...');

const validContract = createTaskContract({
  task_type: 'MICRO_FIX',
  objective: 'Fix Windows CRLF line ending regex in parser without altering DOM math',
  max_tokens_budget: 600,
  negative_constraints: ['Do not touch canvas transform matrix']
});

assert(validContract.task_id.startsWith('task-'), 'Task ID generated with prefix', validContract.task_id);
assert(validContract.status === TASK_STATUS.CREATED, 'Initial status is CREATED');
assert(validContract.constraints.anti_regression === true, 'Anti-regression defaults to true');
assert(validContract.constraints.negative_constraints.some(c => c.includes('canvas transform')), 'Custom negative constraint merged');
assert(validContract.constraints.negative_constraints.some(c => c.includes('Do not delete or harm')), 'Default safety constraints present');

const validation = validateTaskContract(validContract);
assert(validation.valid === true, 'Contract passes strict schema validator');

// Test Invalid Contract Rejection
let invalidRejected = false;
try {
  createTaskContract({ objective: 'short' }); // < 10 chars
} catch (e) {
  invalidRejected = true;
}
assert(invalidRejected === true, 'Short objective (< 10 chars) is rejected by validator');

// ---------------------------------------------------------------------------
// TEST 2: Knowledge Context Resolution via Milestone 1 Engine
// ---------------------------------------------------------------------------
console.log('\n[TEST 2] Testing Context Resolution via Hybrid Retrieval...');

const resolvedContract = resolveTaskContext(validContract);

assert(resolvedContract.status === TASK_STATUS.CONTEXT_RESOLVED, 'Status advanced to CONTEXT_RESOLVED');
assert(resolvedContract.context.relevant_rules.length > 0, 'Relevant Brain rules resolved', 
  `Found: ${resolvedContract.context.relevant_rules.length} rules`);
assert(resolvedContract.context.retrieved_tokens > 0 && resolvedContract.context.retrieved_tokens <= 600, 
  'Retrieved tokens strictly within 600 budget', `${resolvedContract.context.retrieved_tokens} tokens`);

const topRule = resolvedContract.context.relevant_rules[0];
console.log(`     Top Rule Resolved: [${topRule.id}] ${topRule.title}`);
assert(topRule.filePath.includes('05_KNOWLEDGE') || topRule.filePath.includes('01_CORE'), 
  'Rule links directly to canonical Brain storage');

// ---------------------------------------------------------------------------
// TEST 3: Model Execution Prompt Formatting & Constraint Embedding
// ---------------------------------------------------------------------------
console.log('\n[TEST 3] Formatting Model Execution Instruction & Prompt...');

const promptPackage = formatExecutionPrompt(resolvedContract);

assert(promptPackage.systemInstruction.includes('AI-BUILDER-BRAIN UNIVERSAL EXECUTION PROTOCOL'), 
  'System instruction header present');
assert(promptPackage.systemInstruction.includes('AI-Builder-Brain is DATA, not an AI agent'), 
  'Foundational Brain is Data axiom embedded');
assert(promptPackage.systemInstruction.includes('canvas transform matrix'), 
  'Negative constraint embedded into system instructions');
assert(promptPackage.userPrompt.includes(resolvedContract.task_id), 
  'Task ID included in user prompt');
assert(promptPackage.userPrompt.includes('AI-BUILDER-BRAIN RETRIEVED INTELLIGENCE'), 
  'Retrieved Brain intelligence injected into prompt');
assert(promptPackage.withinBudget === true, 
  'Full prompt package adheres to token envelope', `Total: ~${promptPackage.estimatedTokens} tokens`);

// ---------------------------------------------------------------------------
// TEST 4: Resilient Checkpoint Persistence & Recovery
// ---------------------------------------------------------------------------
console.log('\n[TEST 4] Testing Checkpoint Persistence & State Recovery...');

recordTaskCheckpoint(resolvedContract, 1, {
  filesModified: ['src/parser.js'],
  tempDiffLength: 142
});

assert(resolvedContract.status === TASK_STATUS.IN_PROGRESS, 'Status advanced to IN_PROGRESS');
assert(resolvedContract.checkpoint.current_step === 1, 'Current step recorded as 1');

// Verify read-back from durable storage
const loadedCheckpoint = loadTaskCheckpoint(resolvedContract.task_id);
assert(loadedCheckpoint !== null, 'Checkpoint exists in durable storage');
assert(loadedCheckpoint.task_id === resolvedContract.task_id, 'Loaded task ID matches');
assert(loadedCheckpoint.checkpoint.state_payload.filesModified[0] === 'src/parser.js', 
  'State payload safely recovered from disk');

// ---------------------------------------------------------------------------
// TEST 5: Verification Barrier & Claim Validation
// ---------------------------------------------------------------------------
console.log('\n[TEST 5] Testing Verification Barrier Evaluation...');

// Case A: Failed Build (Must be rejected)
const failedResult = verifyExecutionResult(resolvedContract, {
  buildExitCode: 1,
  terminalOutput: 'SyntaxError: Unexpected token'
});
assert(failedResult.verified === false, 'Non-zero build exit code fails verification barrier');
assert(failedResult.contract.status === TASK_STATUS.FAILED, 'Task status transitioned to FAILED');
assert(failedResult.failureReason.includes('Build failed'), 'Clear failure reason recorded');

// Case B: Successful Build with Terminal Proof & Required Evidence
const successResult = verifyExecutionResult(resolvedContract, {
  buildExitCode: 0,
  terminalOutput: '✓ 14 tests passed, build successful in 180ms',
  evidenceTypes: ['BUILD_EXIT_0', 'TEST_PASS']
});
assert(successResult.verified === true, 'Successful build and test pass passes verification barrier');
assert(successResult.contract.status === TASK_STATUS.VERIFIED, 'Task status transitioned to VERIFIED');
assert(successResult.contract.verification_results.evidence_collected.includes('BUILD_EXIT_0'), 
  'BUILD_EXIT_0 recorded in evidence array');

// Verify checkpoint updated with verified state
const finalCheckpoint = loadTaskCheckpoint(resolvedContract.task_id);
assert(finalCheckpoint.status === TASK_STATUS.VERIFIED, 'Final checkpoint reflects VERIFIED state');

// ---------------------------------------------------------------------------
// CLEANUP TEST RECORD
// ---------------------------------------------------------------------------
try {
  const db = JSON.parse(fs.readFileSync(CHECKPOINTS_FILE, 'utf-8'));
  delete db.tasks[resolvedContract.task_id];
  fs.writeFileSync(CHECKPOINTS_FILE, JSON.stringify(db, null, 2), 'utf-8');
} catch (e) {}

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`🏁 TASK CONTRACT & CONNECTOR VERIFICATION: ${passedTests} PASSED | ${failedTests} FAILED`);
console.log('======================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
