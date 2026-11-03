/**
 * AI-BUILDER-BRAIN SUBTASK CAPABILITY ROUTING & READINESS GATING TEST SUITE (PHASE D3.2)
 *
 * Verifies Milestone D3.2:
 * - Deterministic Capability-to-Subtask Routing
 * - Subtask Readiness Gating (READY, BLOCKED, INVALID)
 * - Strict Fail-Closed Verification Barrier (only 'VERIFIED WORKING' is eligible)
 * - Handling of empty/omitted capability requirements
 * - Unknown, malformed, duplicate, and ineligible capability rejection
 * - Subtask contract validation integration
 * - Plan-level batch routing (routeTaskPlanSubtasks)
 * - Numeric and string subtask ID support
 * - Determinism: identical inputs produce identical outputs
 * - Non-bypass of Phase D2 capability gating
 */

import {
  routeSubtaskCapabilities,
  evaluateSubtaskReadiness,
  routeTaskPlanSubtasks,
  SUBTASK_READINESS_STATUS
} from './subtask-router.mjs';
import {
  createTaskContract,
  createSubtask,
  validateSubtask,
  SUBTASK_STATUS
} from './task-contract.mjs';
import {
  loadRegistry
} from './capability-registry.mjs';

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
console.log('🧪 TEST SUITE: SUBTASK CAPABILITY ROUTING & READINESS GATING (D3.2)');
console.log('======================================================================');

// ---------------------------------------------------------------------------
// TEST 1: Valid Subtask with VERIFIED WORKING Capability
// ---------------------------------------------------------------------------
console.log('\n[TEST 1] Testing Valid Subtask with Single Verified Capability...');

const subtaskVerified = {
  id: 'sub-01',
  objective: 'Perform disaster recovery backup checkpoint verification',
  required_capabilities: ['CAP-DISASTER-RECOVERY-VAULT']
};

const r1 = routeSubtaskCapabilities(subtaskVerified);
assert(r1.status === SUBTASK_READINESS_STATUS.READY, 'Subtask status is READY');
assert(r1.ready === true, 'Subtask ready flag is true');
assert(r1.eligible === true, 'Subtask eligible flag is true');
assert(r1.totalRequired === 1, 'Total required is 1');
assert(r1.satisfiedCount === 1, 'Satisfied count is 1');
assert(r1.failedCount === 0, 'Failed count is 0');
assert(Array.isArray(r1.routedCapabilities) && r1.routedCapabilities.length === 1, 'Routed capabilities array contains 1 entry');
assert(r1.routedCapabilities[0].id === 'CAP-DISASTER-RECOVERY-VAULT', 'Routed capability ID matches requirement');
assert(r1.routedCapabilities[0].status === 'VERIFIED WORKING', 'Routed capability status is VERIFIED WORKING');
assert(r1.failureReason === null, 'No failure reason recorded');

// ---------------------------------------------------------------------------
// TEST 2: Subtask with Multiple Verified Capabilities
// ---------------------------------------------------------------------------
console.log('\n[TEST 2] Testing Subtask with Multiple Verified Capabilities...');

const subtaskMulti = {
  id: 'sub-multi',
  objective: 'Bootstrap project factory and verify disaster recovery vault',
  required_capabilities: ['CAP-PROJECT-FACTORY-BOOTSTRAP', 'CAP-DISASTER-RECOVERY-VAULT']
};

const r2 = routeSubtaskCapabilities(subtaskMulti);
assert(r2.status === SUBTASK_READINESS_STATUS.READY, 'Multi-capability subtask is READY');
assert(r2.totalRequired === 2, 'Total required is 2');
assert(r2.satisfiedCount === 2, 'Satisfied count is 2');
assert(r2.failedCount === 0, 'Failed count is 0');
assert(r2.routedCapabilities.some(c => c.id === 'CAP-PROJECT-FACTORY-BOOTSTRAP'), 'CAP-PROJECT-FACTORY-BOOTSTRAP routed');
assert(r2.routedCapabilities.some(c => c.id === 'CAP-DISASTER-RECOVERY-VAULT'), 'CAP-DISASTER-RECOVERY-VAULT routed');

// ---------------------------------------------------------------------------
// TEST 3: Subtask with No Explicit Capabilities (Empty Array and Undefined)
// ---------------------------------------------------------------------------
console.log('\n[TEST 3] Testing Subtask with No Explicit Capabilities...');

// 3a: Empty array []
const subtaskEmptyCaps = {
  id: 'sub-empty-caps',
  objective: 'Subtask declaring empty capability array',
  required_capabilities: []
};
const r3a = routeSubtaskCapabilities(subtaskEmptyCaps);
assert(r3a.status === SUBTASK_READINESS_STATUS.READY, 'Subtask with empty capabilities is READY');
assert(r3a.ready === true, 'Ready is true for empty array');
assert(r3a.totalRequired === 0, 'totalRequired is 0');
assert(r3a.routedCapabilities.length === 0, 'routedCapabilities is empty');

// 3b: Undefined required_capabilities
const subtaskNoCaps = {
  id: 'sub-no-caps',
  objective: 'Subtask with omitted capability field'
};
const r3b = routeSubtaskCapabilities(subtaskNoCaps);
assert(r3b.status === SUBTASK_READINESS_STATUS.READY, 'Subtask with omitted capabilities is READY');
assert(r3b.ready === true, 'Ready is true for omitted capabilities');
assert(r3b.totalRequired === 0, 'totalRequired is 0');

// ---------------------------------------------------------------------------
// TEST 4: Unknown Capability ID Rejection (BLOCKED)
// ---------------------------------------------------------------------------
console.log('\n[TEST 4] Testing Unknown Capability ID Rejection (BLOCKED)...');

const subtaskUnknown = {
  id: 'sub-unknown',
  objective: 'Subtask with nonexistent capability requirement',
  required_capabilities: ['CAP-NON-EXISTENT-XYZ']
};

const r4 = routeSubtaskCapabilities(subtaskUnknown);
assert(r4.status === SUBTASK_READINESS_STATUS.BLOCKED, 'Subtask with unknown capability is BLOCKED');
assert(r4.ready === false, 'Ready is false for unknown capability');
assert(r4.failedCount === 1, 'Failed count is 1');
assert(r4.failureReason.includes('not found in registry'), 'Failure reason notes missing from registry');
assert(r4.error === 'CAPABILITY_NOT_FOUND', 'Error code is CAPABILITY_NOT_FOUND');

// ---------------------------------------------------------------------------
// TEST 5: Registered Ineligible Capabilities (MISSING, UNVERIFIED, PARTIAL)
// ---------------------------------------------------------------------------
console.log('\n[TEST 5] Testing Registered Ineligible Capabilities Fail-Closed (BLOCKED)...');

// PRESENT BUT UNVERIFIED
const subtaskUnverified = {
  id: 'sub-unverified',
  objective: 'Subtask requiring unverified accessibility capability',
  required_capabilities: ['CAP-ACCESSIBILITY-COMPLIANCE-AUDIT']
};
const r5a = routeSubtaskCapabilities(subtaskUnverified);
assert(r5a.status === SUBTASK_READINESS_STATUS.BLOCKED, 'Subtask with PRESENT BUT UNVERIFIED capability is BLOCKED');
assert(r5a.ready === false, 'Ready is false for unverified capability');
assert(r5a.failureReason.includes('PRESENT BUT UNVERIFIED'), 'Failure reason cites PRESENT BUT UNVERIFIED status');
assert(r5a.failureReason.includes('Known Gaps'), 'Failure reason preserves documented known gaps');

// MISSING
const subtaskMissing = {
  id: 'sub-missing',
  objective: 'Subtask requiring missing internet scale repo discovery',
  required_capabilities: ['CAP-INTERNET-SCALE-REPO-DISCOVERY']
};
const r5b = routeSubtaskCapabilities(subtaskMissing);
assert(r5b.status === SUBTASK_READINESS_STATUS.BLOCKED, 'Subtask with MISSING capability is BLOCKED');
assert(r5b.failureReason.includes('MISSING'), 'Failure reason cites MISSING status');

// PARTIALLY IMPLEMENTED
const subtaskPartial = {
  id: 'sub-partial',
  objective: 'Subtask requiring partially implemented cloud harvesting',
  required_capabilities: ['CAP-CONTINUOUS-CLOUD-HARVESTING']
};
const r5c = routeSubtaskCapabilities(subtaskPartial);
assert(r5c.status === SUBTASK_READINESS_STATUS.BLOCKED, 'Subtask with PARTIALLY IMPLEMENTED capability is BLOCKED');
assert(r5c.failureReason.includes('PARTIALLY IMPLEMENTED'), 'Failure reason cites PARTIALLY IMPLEMENTED status');

// ---------------------------------------------------------------------------
// TEST 6: Multiple Capabilities with Partial Ineligibility
// ---------------------------------------------------------------------------
console.log('\n[TEST 6] Testing Multiple Capabilities with Partial Ineligibility...');

const subtaskMixed = {
  id: 'sub-mixed',
  objective: 'Subtask with one verified and one unverified capability',
  required_capabilities: ['CAP-DISASTER-RECOVERY-VAULT', 'CAP-ACCESSIBILITY-COMPLIANCE-AUDIT']
};

const r6 = routeSubtaskCapabilities(subtaskMixed);
assert(r6.status === SUBTASK_READINESS_STATUS.BLOCKED, 'Partial ineligibility triggers BLOCKED status');
assert(r6.ready === false, 'Ready is false');
assert(r6.totalRequired === 2, 'totalRequired is 2');
assert(r6.satisfiedCount === 1, 'satisfiedCount is 1');
assert(r6.failedCount === 1, 'failedCount is 1');
assert(r6.failureReason.includes('CAP-ACCESSIBILITY-COMPLIANCE-AUDIT'), 'Failure reason pinpoints the ineligible capability');

// ---------------------------------------------------------------------------
// TEST 7: Invalid Subtask Contract Rejection (INVALID)
// ---------------------------------------------------------------------------
console.log('\n[TEST 7] Testing Invalid Subtask Contract Rejection (INVALID)...');

// 7a: Missing objective
const subtaskNoObj = {
  id: 'sub-invalid-obj',
  required_capabilities: ['CAP-DISASTER-RECOVERY-VAULT']
};
const r7a = routeSubtaskCapabilities(subtaskNoObj);
assert(r7a.status === SUBTASK_READINESS_STATUS.INVALID, 'Subtask missing objective is INVALID');
assert(r7a.ready === false, 'Ready is false for invalid subtask');
assert(r7a.error === 'SUBTASK_CONTRACT_INVALID', 'Error is SUBTASK_CONTRACT_INVALID');
assert(r7a.failureReason.includes('objective is required'), 'Failure reason specifies missing objective');

// 7b: Conflicting aliases (id vs step_id)
const subtaskConflictAliases = {
  id: 'sub-1',
  step_id: 2,
  objective: 'Subtask with conflicting ID aliases'
};
const r7b = routeSubtaskCapabilities(subtaskConflictAliases);
assert(r7b.status === SUBTASK_READINESS_STATUS.INVALID, 'Subtask with conflicting aliases is INVALID');
assert(r7b.failureReason.includes('Conflicting identifier aliases'), 'Failure reason identifies conflicting aliases');

// 7c: Malformed capability pattern in subtask contract
const subtaskBadCapPattern = {
  id: 'sub-bad-cap',
  objective: 'Subtask with malformed capability ID pattern',
  required_capabilities: ['lowercase-cap-id']
};
const r7c = routeSubtaskCapabilities(subtaskBadCapPattern);
assert(r7c.status === SUBTASK_READINESS_STATUS.INVALID, 'Subtask with invalid capability syntax is INVALID');
assert(r7c.failureReason.includes('Must match pattern'), 'Failure reason cites regex requirement');

// 7d: Duplicate capabilities in subtask contract
const subtaskDupCaps = {
  id: 'sub-dup-caps',
  objective: 'Subtask with duplicate capability IDs',
  required_capabilities: ['CAP-DISASTER-RECOVERY-VAULT', 'CAP-DISASTER-RECOVERY-VAULT']
};
const r7d = routeSubtaskCapabilities(subtaskDupCaps);
assert(r7d.status === SUBTASK_READINESS_STATUS.INVALID, 'Subtask with duplicate capability IDs is INVALID');
assert(r7d.failureReason.includes('duplicate capability ID'), 'Failure reason cites duplicate ID');

// ---------------------------------------------------------------------------
// TEST 8: Numeric and String Subtask IDs
// ---------------------------------------------------------------------------
console.log('\n[TEST 8] Testing Numeric and String Subtask IDs...');

// Numeric ID
const numericSubtask = {
  step_id: 1,
  action: 'Step 1 numeric action',
  required_capabilities: ['CAP-DISASTER-RECOVERY-VAULT']
};
const r8a = routeSubtaskCapabilities(numericSubtask);
assert(r8a.subtaskId === 1, 'Numeric subtask ID preserved as 1');
assert(r8a.status === SUBTASK_READINESS_STATUS.READY, 'Numeric subtask routes to READY');

// String ID
const stringSubtask = {
  id: 'sub-task-alpha',
  objective: 'String ID subtask action',
  required_capabilities: ['CAP-DISASTER-RECOVERY-VAULT']
};
const r8b = routeSubtaskCapabilities(stringSubtask);
assert(r8b.subtaskId === 'sub-task-alpha', 'String subtask ID preserved');
assert(r8b.status === SUBTASK_READINESS_STATUS.READY, 'String subtask routes to READY');

// ---------------------------------------------------------------------------
// TEST 9: Determinism: Identical Inputs Yield Identical Results
// ---------------------------------------------------------------------------
console.log('\n[TEST 9] Testing Determinism on Repeated Invocations...');

const testSub = {
  id: 'sub-det',
  objective: 'Test determinism under multiple calls',
  required_capabilities: ['CAP-DISASTER-RECOVERY-VAULT']
};

const runA = routeSubtaskCapabilities(testSub);
const runB = routeSubtaskCapabilities(testSub);
assert(JSON.stringify(runA) === JSON.stringify(runB), 'Identical inputs produce bit-for-bit identical results');

// ---------------------------------------------------------------------------
// TEST 10: evaluateSubtaskReadiness Helper & State Attachment
// ---------------------------------------------------------------------------
console.log('\n[TEST 10] Testing evaluateSubtaskReadiness with attachToSubtask...');

// Ready attachment
const subToAttach = createSubtask({
  id: 'sub-attach-1',
  objective: 'Attach readiness metadata',
  required_capabilities: ['CAP-DISASTER-RECOVERY-VAULT']
});
assert(subToAttach.status === SUBTASK_STATUS.PENDING, 'Initial status is PENDING');

const evalRes = evaluateSubtaskReadiness(subToAttach, { attachToSubtask: true });
assert(evalRes.ready === true, 'evalRes is ready');
assert(subToAttach.status === SUBTASK_STATUS.READY, 'Subtask status updated to READY upon verified gating');
assert(subToAttach.readiness.status === SUBTASK_READINESS_STATUS.READY, 'Readiness object attached to subtask');

// Blocked attachment
const subBlockedAttach = createSubtask({
  id: 'sub-attach-blocked',
  objective: 'Attach blocked metadata',
  required_capabilities: ['CAP-ACCESSIBILITY-COMPLIANCE-AUDIT']
});
const evalBlocked = evaluateSubtaskReadiness(subBlockedAttach, { attachToSubtask: true });
assert(evalBlocked.ready === false, 'evalBlocked ready is false');
assert(subBlockedAttach.blocking_reason.includes('PRESENT BUT UNVERIFIED'), 'blocking_reason recorded on subtask');

// throwOnBlocked option
let threwBlocked = false;
try {
  evaluateSubtaskReadiness(subBlockedAttach, { throwOnBlocked: true });
} catch (e) {
  threwBlocked = e.message.includes('blocked by capability gating');
}
assert(threwBlocked === true, 'evaluateSubtaskReadiness throws when throwOnBlocked is true');

// ---------------------------------------------------------------------------
// TEST 11: routeTaskPlanSubtasks Batch Plan Routing
// ---------------------------------------------------------------------------
console.log('\n[TEST 11] Testing routeTaskPlanSubtasks Batch Plan Routing...');

const planSteps = [
  { id: 'step-1', objective: 'Step 1: Bootstrap factory', required_capabilities: ['CAP-PROJECT-FACTORY-BOOTSTRAP'] },
  { id: 'step-2', objective: 'Step 2: Hybrid retrieval', required_capabilities: [] },
  { id: 'step-3', objective: 'Step 3: Vault backup', required_capabilities: ['CAP-DISASTER-RECOVERY-VAULT'] }
];

const batchRes = routeTaskPlanSubtasks(planSteps);
assert(batchRes.totalSubtasks === 3, 'Total subtasks is 3');
assert(batchRes.readyCount === 3, 'Ready count is 3');
assert(batchRes.blockedCount === 0, 'Blocked count is 0');
assert(batchRes.invalidCount === 0, 'Invalid count is 0');
assert(batchRes.allReady === true, 'allReady is true for verified plan');
assert(batchRes.failures.length === 0, 'No failures recorded');

// Batch plan with one blocked subtask
const planWithBlocked = [
  { id: 'step-ok', objective: 'Step OK', required_capabilities: ['CAP-DISASTER-RECOVERY-VAULT'] },
  { id: 'step-bad', objective: 'Step Bad', required_capabilities: ['CAP-ACCESSIBILITY-COMPLIANCE-AUDIT'] }
];

const batchBlockedRes = routeTaskPlanSubtasks(planWithBlocked);
assert(batchBlockedRes.totalSubtasks === 2, 'Total subtasks is 2');
assert(batchBlockedRes.readyCount === 1, 'Ready count is 1');
assert(batchBlockedRes.blockedCount === 1, 'Blocked count is 1');
assert(batchBlockedRes.allReady === false, 'allReady is false');
assert(batchBlockedRes.blockingSubtasks.length === 1, '1 blocking subtask identified');
assert(batchBlockedRes.blockingSubtasks[0].subtaskId === 'step-bad', 'Identifies step-bad as the blocker');

// ---------------------------------------------------------------------------
// TEST 12: routeTaskPlanSubtasks Contract Integration & enforceGate
// ---------------------------------------------------------------------------
console.log('\n[TEST 12] Testing routeTaskPlanSubtasks with TaskContract...');

const testContract = createTaskContract({
  objective: 'Contract with decomposed subtasks for readiness gating',
  task_type: 'FEATURE',
  subtasks: planWithBlocked
});

routeTaskPlanSubtasks(testContract, { enforceGate: true });
assert(testContract.context.subtask_readiness !== undefined, 'subtask_readiness attached to contract context');
assert(testContract.context.subtask_readiness.allReady === false, 'Context reflects allReady false');
assert(testContract.status === 'FAILED', 'Contract status transitioned to FAILED under enforceGate');
assert(testContract.verification_results.failure_reason.includes('step-bad'), 'Verification failure reason records blocker');

// ---------------------------------------------------------------------------
// TEST 13: Legacy Task Contract Callers (No Subtasks)
// ---------------------------------------------------------------------------
console.log('\n[TEST 13] Testing Legacy Task Contract Callers...');

const legacyContract = createTaskContract({
  objective: 'Legacy contract without subtasks',
  task_type: 'MICRO_FIX'
});

const legacyRes = routeTaskPlanSubtasks(legacyContract);
assert(legacyRes.totalSubtasks === 0, 'Total subtasks is 0 for legacy contract');
assert(legacyRes.allReady === true, 'allReady is true for legacy contract');
assert(legacyRes.blockedCount === 0, 'Blocked count is 0');

// ---------------------------------------------------------------------------
// TEST 14: Custom Registry Fixtures & Registry Load Failure
// ---------------------------------------------------------------------------
console.log('\n[TEST 14] Testing Custom Registry Fixtures & Failures...');

// Registry missing file
const r14MissingFile = routeSubtaskCapabilities(
  { id: 'sub-f', objective: 'Test with nonexistent registry', required_capabilities: ['CAP-DISASTER-RECOVERY-VAULT'] },
  { registryPath: 'C:\\non-existent-path\\registry.json' }
);
assert(r14MissingFile.status === SUBTASK_READINESS_STATUS.BLOCKED, 'Missing registry file yields BLOCKED status');
assert(r14MissingFile.error === 'REGISTRY_FILE_NOT_FOUND', 'Error notes missing registry file');

// Registry with ambiguous duplicate capability
const ambiguousFixture = {
  capabilities: [
    { id: 'CAP-DUP', name: 'Dup 1', domain: 'CORE', status: 'VERIFIED WORKING', version: '1.0.0', stability: 'STABLE' },
    { id: 'CAP-DUP', name: 'Dup 2', domain: 'CORE', status: 'VERIFIED WORKING', version: '1.0.0', stability: 'STABLE' }
  ]
};
const r14Dup = routeSubtaskCapabilities(
  { id: 'sub-dup', objective: 'Test ambiguous duplicate', required_capabilities: ['CAP-DUP'] },
  { registry: ambiguousFixture }
);
assert(r14Dup.status === SUBTASK_READINESS_STATUS.BLOCKED, 'Ambiguous duplicate capability yields BLOCKED');
assert(r14Dup.error === 'REGISTRY_AMBIGUOUS_DUPLICATE', 'Error is REGISTRY_AMBIGUOUS_DUPLICATE');

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
console.log('======================================================================');
console.log(`🏁 SUBTASK CAPABILITY ROUTING TEST SUMMARY: ${passedTests} PASSED | ${totalTests - passedTests} FAILED`);
console.log('======================================================================');

if (totalTests !== passedTests) {
  process.exit(1);
}
