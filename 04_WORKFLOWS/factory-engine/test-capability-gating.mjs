/**
 * AI-BUILDER-BRAIN CAPABILITY GATING & STATUS VERIFICATION TEST SUITE (PHASE D2)
 *
 * Verifies capability discovery and status gating integration across:
 * - checkCapabilityReadiness() in capability-registry.mjs
 * - resolveTaskContext() in brain-connector.mjs
 * - matchKnowledgeToTask() in brain-connector.mjs
 * - formatExecutionPrompt() in brain-connector.mjs
 * - executeUniversalTaskPipeline() in brain-connector.mjs
 *
 * Scenarios Tested:
 * 1. Task without required_capabilities (legacy contract) passes normally (CONTEXT_RESOLVED)
 * 2. Task with empty required_capabilities [] passes normally (CONTEXT_RESOLVED)
 * 3. Single available VERIFIED WORKING capability succeeds
 * 4. Syntactically valid unknown capability ID fails gating (NOT_FOUND)
 * 5. Registered unavailable capabilities fail gating:
 *    a. MISSING status
 *    b. PRESENT BUT UNVERIFIED status
 *    c. PARTIALLY IMPLEMENTED status
 * 6. Multiple available capabilities succeed
 * 7. Multiple capabilities with one failing fails gating and identifies failure
 * 8. Malformed capability record in registry fails with RECORD_SCHEMA_INVALID
 * 9. Ambiguous duplicate ID in registry fails with AMBIGUOUS_DUPLICATE
 * 10. Registry load failure (non-existent path) fails with REGISTRY_FILE_NOT_FOUND
 * 11. formatExecutionPrompt prevents prompt generation on failed gating & injects verified info on success
 * 12. executeUniversalTaskPipeline halts execution before step execution on failed gating
 * 13. throwOnGatingFailure option throws immediately on failed gating
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 
  createTaskContract, 
  TASK_STATUS 
} from './task-contract.mjs';
import { 
  resolveTaskContext, 
  matchKnowledgeToTask, 
  formatExecutionPrompt, 
  executeUniversalTaskPipeline,
  checkCapabilityReadiness 
} from './brain-connector.mjs';
import { 
  loadRegistry, 
  ELIGIBLE_CAPABILITY_STATUSES 
} from './capability-registry.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');
const PROD_CHECKPOINTS_FILE = path.join(BRAIN_ROOT, '.project-brain', 'task-checkpoints.json');
const beforeProdCheckpointsRaw = fs.existsSync(PROD_CHECKPOINTS_FILE) ? fs.readFileSync(PROD_CHECKPOINTS_FILE, 'utf-8') : null;

// Isolated simulation sandbox for regression test checkpoints
const SANDBOX_DIR = path.join(BRAIN_ROOT, '.project-brain', 'simulation-sandbox', 'capability-gating-test');
fs.mkdirSync(path.join(SANDBOX_DIR, '.project-brain'), { recursive: true });
const TEST_CHECKPOINTS_FILE = path.join(SANDBOX_DIR, '.project-brain', 'task-checkpoints.json');
if (fs.existsSync(PROD_CHECKPOINTS_FILE)) {
  fs.copyFileSync(PROD_CHECKPOINTS_FILE, TEST_CHECKPOINTS_FILE);
} else {
  fs.writeFileSync(TEST_CHECKPOINTS_FILE, JSON.stringify({ version: '1.0.0', tasks: {} }, null, 2), 'utf-8');
}
process.env.BRAIN_TASK_CHECKPOINTS_FILE = TEST_CHECKPOINTS_FILE;

let totalTests = 0;
let passedTests = 0;

function assert(condition, message, detail = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${message} ${detail ? `(${detail})` : ''}`);
  } else {
    console.error(`  ❌ [FAIL] ${message} ${detail ? `(${detail})` : ''}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('======================================================================');
console.log('🧪 TEST SUITE: CAPABILITY DISCOVERY & STATUS GATING (PHASE D2)');
console.log('======================================================================');

// ---------------------------------------------------------------------------
// TEST 1: Legacy contract without required_capabilities
// ---------------------------------------------------------------------------
console.log('\n[TEST 1] Task Contract Without required_capabilities (Legacy Compatibility)...');

const legacyContract = createTaskContract({
  objective: 'Perform clean legacy code refactoring without capabilities field',
  task_type: 'REFACTOR'
});

assert(legacyContract.required_capabilities === undefined, 'Legacy contract required_capabilities is undefined');
resolveTaskContext(legacyContract);
assert(legacyContract.status === TASK_STATUS.CONTEXT_RESOLVED, 'Legacy contract resolves to CONTEXT_RESOLVED');
assert(legacyContract.context.capability_readiness === undefined, 'No capability readiness attached for legacy task');

// ---------------------------------------------------------------------------
// TEST 2: Task contract with empty required_capabilities array []
// ---------------------------------------------------------------------------
console.log('\n[TEST 2] Task Contract with Empty required_capabilities Array []...');

const emptyCapContract = createTaskContract({
  objective: 'Execute task with explicit empty required capabilities array',
  task_type: 'MICRO_FIX',
  required_capabilities: []
});

assert(Array.isArray(emptyCapContract.required_capabilities) && emptyCapContract.required_capabilities.length === 0,
  'required_capabilities initialized as empty array');
resolveTaskContext(emptyCapContract);
assert(emptyCapContract.status === TASK_STATUS.CONTEXT_RESOLVED, 'Status resolves to CONTEXT_RESOLVED');
assert(emptyCapContract.context.capability_readiness !== undefined, 'capability_readiness recorded');
assert(emptyCapContract.context.capability_readiness.ready === true, 'Readiness is true for empty array');
assert(emptyCapContract.context.capability_readiness.totalRequired === 0, 'totalRequired is 0');
assert(emptyCapContract.context.capability_readiness.satisfiedCount === 0, 'satisfiedCount is 0');

// ---------------------------------------------------------------------------
// TEST 3: Single Available VERIFIED WORKING Capability
// ---------------------------------------------------------------------------
console.log('\n[TEST 3] Single Available VERIFIED WORKING Capability...');

const singleCapContract = createTaskContract({
  objective: 'Trigger disaster recovery backup procedure using verified capability',
  task_type: 'SYSTEM_BUILD',
  required_capabilities: ['CAP-DISASTER-RECOVERY-VAULT']
});

resolveTaskContext(singleCapContract);
assert(singleCapContract.status === TASK_STATUS.CONTEXT_RESOLVED, 'Status reaches CONTEXT_RESOLVED');
assert(singleCapContract.context.capability_readiness.ready === true, 'Gating check ready is true');
assert(singleCapContract.context.capability_readiness.allSatisfied === true, 'allSatisfied is true');
assert(singleCapContract.context.capability_readiness.totalRequired === 1, 'totalRequired is 1');
assert(singleCapContract.context.capability_readiness.satisfiedCount === 1, 'satisfiedCount is 1');
assert(singleCapContract.context.capability_readiness.failedCount === 0, 'failedCount is 0');
assert(singleCapContract.context.capability_readiness.capabilities[0].id === 'CAP-DISASTER-RECOVERY-VAULT', 'Satisfied capability ID matches');
assert(singleCapContract.context.capability_readiness.capabilities[0].status === 'VERIFIED WORKING', 'Capability status is VERIFIED WORKING');

// ---------------------------------------------------------------------------
// TEST 4: Syntactically Valid Unknown Capability ID
// ---------------------------------------------------------------------------
console.log('\n[TEST 4] Syntactically Valid Unknown Capability ID (NOT_FOUND)...');

const unknownCapContract = createTaskContract({
  objective: 'Attempt to execute task requiring nonexistent capability in registry',
  task_type: 'FEATURE',
  required_capabilities: ['CAP-NON-EXISTENT-XYZ']
});

resolveTaskContext(unknownCapContract);
assert(unknownCapContract.status === TASK_STATUS.FAILED, 'Status transitions to FAILED');
assert(unknownCapContract.context.capability_readiness.ready === false, 'Readiness is false');
assert(unknownCapContract.context.capability_readiness.totalRequired === 1, 'totalRequired is 1');
assert(unknownCapContract.context.capability_readiness.failedCount === 1, 'failedCount is 1');
assert(unknownCapContract.verification_results.failure_reason.includes('CAP-NON-EXISTENT-XYZ'), 'Failure reason mentions missing ID');
assert(unknownCapContract.verification_results.failure_reason.includes('NOT_FOUND'), 'Failure reason specifies NOT_FOUND');

// ---------------------------------------------------------------------------
// TEST 5: Registered Unavailable Capabilities
// ---------------------------------------------------------------------------
console.log('\n[TEST 5] Registered Unavailable Capabilities (MISSING, UNVERIFIED, PARTIAL)...');

// 5a. MISSING status
const missingCapContract = createTaskContract({
  objective: 'Attempt internet-scale repo search with missing crawler capability',
  task_type: 'FEATURE',
  required_capabilities: ['CAP-INTERNET-SCALE-REPO-DISCOVERY']
});

resolveTaskContext(missingCapContract);
assert(missingCapContract.status === TASK_STATUS.FAILED, 'Status transitions to FAILED for MISSING');
assert(missingCapContract.context.capability_readiness.ready === false, 'Readiness is false for MISSING');
assert(missingCapContract.verification_results.failure_reason.includes('MISSING'), 'Failure reason identifies MISSING status');
assert(missingCapContract.verification_results.failure_reason.includes('Known Gap'), 'Failure reason cites Known Gap documentation');

// 5b. PRESENT BUT UNVERIFIED status
const unverifiedCapContract = createTaskContract({
  objective: 'Attempt automated WCAG compliance audit without verified audit engine',
  task_type: 'AUDIT',
  required_capabilities: ['CAP-ACCESSIBILITY-COMPLIANCE-AUDIT']
});

resolveTaskContext(unverifiedCapContract);
assert(unverifiedCapContract.status === TASK_STATUS.FAILED, 'Status transitions to FAILED for PRESENT BUT UNVERIFIED');
assert(unverifiedCapContract.verification_results.failure_reason.includes('PRESENT BUT UNVERIFIED'), 'Failure reason notes PRESENT BUT UNVERIFIED');

// 5c. PARTIALLY IMPLEMENTED status
const partialCapContract = createTaskContract({
  objective: 'Attempt continuous cloud harvesting without full implementation',
  task_type: 'SYSTEM_BUILD',
  required_capabilities: ['CAP-CONTINUOUS-CLOUD-HARVESTING']
});

resolveTaskContext(partialCapContract);
assert(partialCapContract.status === TASK_STATUS.FAILED, 'Status transitions to FAILED for PARTIALLY IMPLEMENTED');
assert(partialCapContract.verification_results.failure_reason.includes('PARTIALLY IMPLEMENTED'), 'Failure reason notes PARTIALLY IMPLEMENTED');

// ---------------------------------------------------------------------------
// TEST 6: Multiple Available Capabilities
// ---------------------------------------------------------------------------
console.log('\n[TEST 6] Multiple Available Capabilities (All Satisfied)...');

const multiCapContract = createTaskContract({
  objective: 'Perform enterprise encrypted backup procedure requiring multiple vault capabilities',
  task_type: 'SYSTEM_BUILD',
  required_capabilities: ['CAP-DISASTER-RECOVERY-VAULT', 'CAP-AUTHENTICATED-SECRETS-VAULT']
});

resolveTaskContext(multiCapContract);
assert(multiCapContract.status === TASK_STATUS.CONTEXT_RESOLVED, 'Status reaches CONTEXT_RESOLVED');
assert(multiCapContract.context.capability_readiness.ready === true, 'Gating check ready is true');
assert(multiCapContract.context.capability_readiness.allSatisfied === true, 'allSatisfied is true');
assert(multiCapContract.context.capability_readiness.totalRequired === 2, 'totalRequired is 2');
assert(multiCapContract.context.capability_readiness.satisfiedCount === 2, 'satisfiedCount is 2');
assert(multiCapContract.context.capability_readiness.failedCount === 0, 'failedCount is 0');

// ---------------------------------------------------------------------------
// TEST 7: Multiple Capabilities With One Failing
// ---------------------------------------------------------------------------
console.log('\n[TEST 7] Multiple Capabilities With Partial Failure...');

const mixedCapContract = createTaskContract({
  objective: 'Attempt composite operation where one capability is verified and one is missing',
  task_type: 'SYSTEM_BUILD',
  required_capabilities: ['CAP-DISASTER-RECOVERY-VAULT', 'CAP-INTERNET-SCALE-REPO-DISCOVERY']
});

resolveTaskContext(mixedCapContract);
assert(mixedCapContract.status === TASK_STATUS.FAILED, 'Status transitions to FAILED');
assert(mixedCapContract.context.capability_readiness.ready === false, 'Readiness is false');
assert(mixedCapContract.context.capability_readiness.totalRequired === 2, 'totalRequired is 2');
assert(mixedCapContract.context.capability_readiness.satisfiedCount === 1, 'satisfiedCount is 1');
assert(mixedCapContract.context.capability_readiness.failedCount === 1, 'failedCount is 1');
assert(mixedCapContract.verification_results.failure_reason.includes('CAP-INTERNET-SCALE-REPO-DISCOVERY'), 'Failure specifically flags the missing capability');

// ---------------------------------------------------------------------------
// TEST 8: Malformed Capability Record in Registry Fixture
// ---------------------------------------------------------------------------
console.log('\n[TEST 8] Malformed Capability Record in Registry Fixture...');

const malformedFixtureRegistry = {
  version: '1.0.0',
  updatedAt: new Date().toISOString(),
  capabilities: [
    {
      id: 'CAP-MALFORMED-RECORD',
      name: 'Corrupted Capability Record',
      // purpose is missing (required by schema)
      domain: 'operations_monitoring_sre',
      status: 'VERIFIED WORKING'
    }
  ]
};

const malformedDirectResult = checkCapabilityReadiness(['CAP-MALFORMED-RECORD'], { customRegistry: malformedFixtureRegistry });
assert(malformedDirectResult.ready === false, 'Readiness is false for malformed record');
assert(malformedDirectResult.failures.some(f => f.includes('RECORD_SCHEMA_INVALID')), 'Failure indicates RECORD_SCHEMA_INVALID');

const malformedContract = createTaskContract({
  objective: 'Attempt task execution using registry with malformed capability record',
  task_type: 'MICRO_FIX',
  required_capabilities: ['CAP-MALFORMED-RECORD']
});

resolveTaskContext(malformedContract, { customRegistry: malformedFixtureRegistry });
assert(malformedContract.status === TASK_STATUS.FAILED, 'Task status set to FAILED for malformed record');
assert(malformedContract.verification_results.failure_reason.includes('RECORD_SCHEMA_INVALID'), 'Contract failure reason records schema validation error');

// ---------------------------------------------------------------------------
// TEST 9: Ambiguous Duplicate ID in Registry Fixture
// ---------------------------------------------------------------------------
console.log('\n[TEST 9] Ambiguous Duplicate ID in Registry Fixture...');

const duplicateFixtureRegistry = {
  version: '1.0.0',
  updatedAt: new Date().toISOString(),
  capabilities: [
    {
      id: 'CAP-DUPLICATE-ENTRY',
      name: 'Duplicate Entry First',
      purpose: 'First instance of duplicate ID in fixture',
      domain: 'core_retrieval_indexing',
      status: 'VERIFIED WORKING'
    },
    {
      id: 'CAP-DUPLICATE-ENTRY',
      name: 'Duplicate Entry Second',
      purpose: 'Second instance of duplicate ID causing ambiguity',
      domain: 'core_retrieval_indexing',
      status: 'VERIFIED WORKING'
    }
  ]
};

const dupDirectResult = checkCapabilityReadiness(['CAP-DUPLICATE-ENTRY'], { customRegistry: duplicateFixtureRegistry });
assert(dupDirectResult.ready === false, 'Readiness is false for ambiguous duplicate');
assert(dupDirectResult.error === 'REGISTRY_AMBIGUOUS_DUPLICATE', 'Error code is REGISTRY_AMBIGUOUS_DUPLICATE');
assert(dupDirectResult.failures.some(f => f.includes('duplicate ID')), 'Failure details report duplicate ID');

// ---------------------------------------------------------------------------
// TEST 10: Registry Load Failure (Non-Existent Path)
// ---------------------------------------------------------------------------
console.log('\n[TEST 10] Registry Load Failure (Non-Existent Path)...');

const nonExistentPath = path.join(BRAIN_ROOT, '15_METADATA', 'non-existent-capability-registry.json');
const loadFailResult = checkCapabilityReadiness(['CAP-DISASTER-RECOVERY-VAULT'], { customRegistryPath: nonExistentPath });
assert(loadFailResult.ready === false, 'Readiness is false when registry file missing');
assert(loadFailResult.error === 'REGISTRY_FILE_NOT_FOUND', 'Error code is REGISTRY_FILE_NOT_FOUND');

const loadFailContract = createTaskContract({
  objective: 'Attempt task with missing registry file path',
  task_type: 'MICRO_FIX',
  required_capabilities: ['CAP-DISASTER-RECOVERY-VAULT']
});

resolveTaskContext(loadFailContract, { customRegistryPath: nonExistentPath });
assert(loadFailContract.status === TASK_STATUS.FAILED, 'Task status set to FAILED when registry file not found');
assert(loadFailContract.verification_results.failure_reason.includes('Registry file not found'), 'Failure reason notes missing registry file');

// ---------------------------------------------------------------------------
// TEST 11: formatExecutionPrompt Prevention & Prompt Injection
// ---------------------------------------------------------------------------
console.log('\n[TEST 11] formatExecutionPrompt Prevention & Capability Prompt Block Injection...');

// 11a: Failed task causes formatExecutionPrompt to throw
const failedTaskContract = createTaskContract({
  objective: 'Attempt to format execution prompt for a task with missing capability',
  task_type: 'MICRO_FIX',
  required_capabilities: ['CAP-NON-EXISTENT-XYZ']
});

let formatThrew = false;
try {
  formatExecutionPrompt(failedTaskContract);
} catch (err) {
  formatThrew = true;
  assert(err.message.includes('failed capability gating'), 'Error specifically notes capability gating failure', err.message);
}
assert(formatThrew === true, 'formatExecutionPrompt threw on failed capability gating');

// 11b: Verified task embeds capability information in prompt
const verifiedTaskContract = createTaskContract({
  objective: 'Format prompt for task with satisfied verified capability requirement',
  task_type: 'SYSTEM_BUILD',
  required_capabilities: ['CAP-DISASTER-RECOVERY-VAULT']
});

const promptResult = formatExecutionPrompt(verifiedTaskContract);
assert(typeof promptResult.userPrompt === 'string', 'userPrompt generated as string');
assert(promptResult.userPrompt.includes('VERIFIED REQUIRED CAPABILITIES'), 'userPrompt includes VERIFIED REQUIRED CAPABILITIES block');
assert(promptResult.userPrompt.includes('CAP-DISASTER-RECOVERY-VAULT'), 'userPrompt includes satisfied capability ID');
assert(promptResult.withinBudget === true, 'Prompt package remains within budget envelope');

// ---------------------------------------------------------------------------
// TEST 12: executeUniversalTaskPipeline Halts on Capability Failure
// ---------------------------------------------------------------------------
console.log('\n[TEST 12] executeUniversalTaskPipeline Halts on Capability Failure...');

let executorCalled = false;
const mockExecutor = async (step, contract) => {
  executorCalled = true;
  return { success: true, evidence: { stepId: step.id } };
};

const pipelineFailingContract = createTaskContract({
  objective: 'Pipeline execution attempt with unverified capability',
  task_type: 'FEATURE',
  required_capabilities: ['CAP-ACCESSIBILITY-COMPLIANCE-AUDIT']
});

let pipelineThrew = false;
try {
  await executeUniversalTaskPipeline(pipelineFailingContract, mockExecutor);
} catch (err) {
  pipelineThrew = true;
  assert(err.message.includes('pipeline halted: capability gating failed'), 'Pipeline threw execution halt error', err.message);
}
assert(pipelineThrew === true, 'executeUniversalTaskPipeline threw and halted');
assert(executorCalled === false, 'Executor was NOT invoked when capability gating failed');

// 12b: Verified task runs through pipeline
executorCalled = false;
const pipelineWorkingContract = createTaskContract({
  objective: 'Pipeline execution with satisfied disaster recovery capability',
  task_type: 'MICRO_FIX',
  required_capabilities: ['CAP-DISASTER-RECOVERY-VAULT']
});

const pipelineSuccessResult = await executeUniversalTaskPipeline(pipelineWorkingContract, mockExecutor);
assert(executorCalled === true, 'Executor was invoked for verified task');
assert(pipelineSuccessResult.verified === true, 'Pipeline completed with verified status');

// ---------------------------------------------------------------------------
// TEST 13: throwOnGatingFailure Option Throws Immediately
// ---------------------------------------------------------------------------
console.log('\n[TEST 13] throwOnGatingFailure Option Throws Immediately...');

const throwContract = createTaskContract({
  objective: 'Task configured to throw immediately on capability gating failure',
  task_type: 'MICRO_FIX',
  required_capabilities: ['CAP-NON-EXISTENT-XYZ']
});

let resolveThrew = false;
try {
  resolveTaskContext(throwContract, { throwOnGatingFailure: true });
} catch (err) {
  resolveThrew = true;
  assert(err.message.includes('Capability Gating Failed'), 'resolveTaskContext threw with throwOnGatingFailure', err.message);
}
assert(resolveThrew === true, 'resolveTaskContext threw immediately');

let matchThrew = false;
const throwMatchContract = createTaskContract({
  objective: 'Task configured to test throwOnGatingFailure in matchKnowledgeToTask',
  task_type: 'FEATURE',
  task_profile: { language: 'javascript' },
  required_capabilities: ['CAP-NON-EXISTENT-XYZ']
});

try {
  matchKnowledgeToTask(throwMatchContract, { throwOnGatingFailure: true });
} catch (err) {
  matchThrew = true;
  assert(err.message.includes('Capability Gating Failed'), 'matchKnowledgeToTask threw with throwOnGatingFailure', err.message);
}
assert(matchThrew === true, 'matchKnowledgeToTask threw immediately');

// Verify production checkpoint file remained 100% untouched
const afterProdCheckpointsRaw = fs.existsSync(PROD_CHECKPOINTS_FILE) ? fs.readFileSync(PROD_CHECKPOINTS_FILE, 'utf-8') : null;
assert(afterProdCheckpointsRaw === beforeProdCheckpointsRaw, 'Production task-checkpoints.json remained completely untouched');

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
console.log('======================================================================');
console.log(`🏁 CAPABILITY GATING TEST SUMMARY: ${passedTests} PASSED | ${totalTests - passedTests} FAILED`);
console.log('======================================================================');

if (totalTests !== passedTests) {
  process.exit(1);
}
