/**
 * AI-BUILDER-BRAIN SUBTASK DATA CONTRACT & DECOMPOSITION TEST SUITE (PHASE D3.1)
 *
 * Verifies Milestone D3.1:
 * - Subtask schema constants and validation (SUBTASK_STATUS, FAILURE_POLICIES)
 * - validateSubtask() single-subtask validation & constraints
 * - validateSubtaskList() collection-level uniqueness & dependency integrity
 * - createSubtask() normalization and creation helper
 * - TaskContract integration (optional subtasks field & backward compatibility)
 * - task-planner.mjs subtask metadata annotation and DAG compatibility
 */

import { 
  createTaskContract, 
  validateTaskContract, 
  validateSubtask, 
  validateSubtaskList, 
  createSubtask,
  SUBTASK_STATUS,
  FAILURE_POLICIES
} from './task-contract.mjs';
import { 
  validatePlanDAG, 
  planTaskDecomposition, 
  getNextExecutableSteps, 
  advanceStep 
} from './task-planner.mjs';

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
console.log('🧪 TEST SUITE: SUBTASK DATA CONTRACT & DECOMPOSITION EXTENSION (D3.1)');
console.log('======================================================================');

// ---------------------------------------------------------------------------
// TEST 1: Valid Subtask Contract Acceptance
// ---------------------------------------------------------------------------
console.log('\n[TEST 1] Testing Valid Subtask Contract Acceptance...');

const validSubtask = {
  id: 'sub-01',
  objective: 'Inspect configuration schema and locate invalid properties',
  task_type: 'MICRO_FIX',
  required_capabilities: ['CAP-DISASTER-RECOVERY-VAULT'],
  dependencies: [],
  failure_policy: FAILURE_POLICIES.ABORT,
  status: SUBTASK_STATUS.PENDING,
  inputs: { config_path: 'src/config.json' },
  expected_output: { patch_file: 'diff.patch' },
  acceptance_criteria: ['Config passes schema validator'],
  verification_requirements: 'node test-config.mjs'
};

const v1 = validateSubtask(validSubtask);
assert(v1.valid === true, 'Fully specified valid subtask passes validation', `Errors: ${v1.errors.join(', ')}`);

// Numeric ID and depends_on alias
const validNumericSubtask = {
  step_id: 1,
  action: 'Execute fast verification build',
  depends_on: [],
  verification_probe: 'npm test'
};

const v1b = validateSubtask(validNumericSubtask);
assert(v1b.valid === true, 'Subtask with step_id/action/depends_on aliases passes validation');

// ---------------------------------------------------------------------------
// TEST 2: Required Fields Missing Rejected
// ---------------------------------------------------------------------------
console.log('\n[TEST 2] Testing Missing Required Fields Rejection...');

// Missing ID
const noId = { objective: 'Do something without an ID' };
const v2a = validateSubtask(noId);
assert(v2a.valid === false, 'Subtask missing ID is rejected');
assert(v2a.errors.some(e => e.includes('id is required')), 'Error specifies missing id requirement');

// Empty string ID
const emptyId = { id: '   ', objective: 'Valid objective with empty ID' };
const v2b = validateSubtask(emptyId);
assert(v2b.valid === false, 'Subtask with whitespace ID is rejected');

// Missing Objective
const noObj = { id: 'sub-02' };
const v2c = validateSubtask(noObj);
assert(v2c.valid === false, 'Subtask missing objective is rejected');
assert(v2c.errors.some(e => e.includes('objective is required')), 'Error specifies missing objective requirement');

// Short Objective (< 3 chars)
const shortObj = { id: 'sub-03', objective: 'ab' };
const v2d = validateSubtask(shortObj);
assert(v2d.valid === false, 'Subtask with short objective (< 3 chars) is rejected');

// ---------------------------------------------------------------------------
// TEST 3: Invalid Field Types Rejected
// ---------------------------------------------------------------------------
console.log('\n[TEST 3] Testing Invalid Field Types Rejection...');

// Boolean ID
const boolId = { id: true, objective: 'Objective with boolean id' };
assert(validateSubtask(boolId).valid === false, 'Boolean id is rejected');

// String dependencies instead of array
const strDeps = { id: 'sub-04', objective: 'Valid objective', dependencies: 'sub-01' };
const v3b = validateSubtask(strDeps);
assert(v3b.valid === false, 'String dependencies is rejected');
assert(v3b.errors.some(e => e.includes('dependencies must be an array')), 'Error notes array requirement for dependencies');

// String required_capabilities instead of array
const strCaps = { id: 'sub-05', objective: 'Valid objective', required_capabilities: 'CAP-DISASTER-RECOVERY-VAULT' };
const v3c = validateSubtask(strCaps);
assert(v3c.valid === false, 'String required_capabilities is rejected');

// Invalid status string
const badStatus = { id: 'sub-06', objective: 'Valid objective', status: 'RUNNING_NOW' };
assert(validateSubtask(badStatus).valid === false, 'Unknown status string is rejected');

// Invalid failure policy string
const badPolicy = { id: 'sub-07', objective: 'Valid objective', failure_policy: 'IGNORE_ERROR' };
assert(validateSubtask(badPolicy).valid === false, 'Unknown failure_policy is rejected');

// Non-object inputs
const badInputs = { id: 'sub-08', objective: 'Valid objective', inputs: 'invalid_string' };
assert(validateSubtask(badInputs).valid === false, 'Non-object inputs is rejected');

// Non-array acceptance criteria
const badCriteria = { id: 'sub-09', objective: 'Valid objective', acceptance_criteria: 'must pass' };
assert(validateSubtask(badCriteria).valid === false, 'Non-array acceptance_criteria is rejected');

// ---------------------------------------------------------------------------
// TEST 4: Duplicate Subtask IDs Rejected in List
// ---------------------------------------------------------------------------
console.log('\n[TEST 4] Testing Duplicate Subtask IDs in Collection...');

const duplicateList = [
  { id: 'sub-alpha', objective: 'First step in pipeline' },
  { id: 'sub-beta', objective: 'Second step in pipeline' },
  { id: 'sub-alpha', objective: 'Conflicting third step with duplicate id' }
];

const v4 = validateSubtaskList(duplicateList);
assert(v4.valid === false, 'Subtask list with duplicate IDs is rejected');
assert(v4.errors.some(e => e.includes("Duplicate subtask id detected: 'sub-alpha'")), 'Error identifies duplicate subtask ID');

// ---------------------------------------------------------------------------
// TEST 5: Self-Dependency Rejected
// ---------------------------------------------------------------------------
console.log('\n[TEST 5] Testing Self-Dependency Rejection...');

const selfDepSubtask = {
  id: 'sub-self',
  objective: 'Subtask that mistakenly depends on itself',
  dependencies: ['sub-self']
};

const v5 = validateSubtask(selfDepSubtask);
assert(v5.valid === false, 'Self-dependent subtask is rejected');
assert(v5.errors.some(e => e.includes('cannot depend on itself')), 'Error specifically flags self-dependency');

// ---------------------------------------------------------------------------
// TEST 6: Unknown Dependency IDs Rejected in List
// ---------------------------------------------------------------------------
console.log('\n[TEST 6] Testing Unknown Dependency IDs in Collection...');

const unknownDepList = [
  { id: 'sub-01', objective: 'First valid subtask', dependencies: [] },
  { id: 'sub-02', objective: 'Second subtask depending on ghost ID', dependencies: ['sub-ghost-99'] }
];

const v6 = validateSubtaskList(unknownDepList);
assert(v6.valid === false, 'List with reference to unknown dependency ID is rejected');
assert(v6.errors.some(e => e.includes("depends on unknown subtask id: 'sub-ghost-99'")), 'Error cites unknown dependency ID');

// ---------------------------------------------------------------------------
// TEST 7: Duplicate Dependency References Rejected
// ---------------------------------------------------------------------------
console.log('\n[TEST 7] Testing Duplicate Dependency References in Subtask...');

const duplicateDepSubtask = {
  id: 'sub-03',
  objective: 'Subtask with redundant repeated dependency',
  dependencies: ['sub-01', 'sub-01']
};

const v7 = validateSubtask(duplicateDepSubtask);
assert(v7.valid === false, 'Duplicate dependency reference within subtask is rejected');
assert(v7.errors.some(e => e.includes("duplicate dependency reference: 'sub-01'")), 'Error notes duplicate dependency reference');

// ---------------------------------------------------------------------------
// TEST 8: Invalid required_capabilities Pattern Rejected
// ---------------------------------------------------------------------------
console.log('\n[TEST 8] Testing Invalid required_capabilities Pattern Rejection...');

const invalidCapSubtask = {
  id: 'sub-10',
  objective: 'Subtask with malformed capability ID',
  required_capabilities: ['lowercase_cap_id']
};

const v8a = validateSubtask(invalidCapSubtask);
assert(v8a.valid === false, 'Lowercase capability ID is rejected');
assert(v8a.errors.some(e => e.includes('Must match pattern ^CAP-[A-Z0-9-]+$')), 'Error cites CAP pattern');

const underscoreCapSubtask = {
  id: 'sub-11',
  objective: 'Subtask with underscore capability ID',
  required_capabilities: ['CAP_INVALID_UNDERSCORE']
};
assert(validateSubtask(underscoreCapSubtask).valid === false, 'Underscore capability ID is rejected');

// ---------------------------------------------------------------------------
// TEST 9: Duplicate Capability IDs Within Subtask Rejected
// ---------------------------------------------------------------------------
console.log('\n[TEST 9] Testing Duplicate Capability IDs Within Subtask...');

const duplicateCapSubtask = {
  id: 'sub-12',
  objective: 'Subtask with duplicate capability IDs',
  required_capabilities: ['CAP-DISASTER-RECOVERY-VAULT', 'CAP-DISASTER-RECOVERY-VAULT']
};

const v9 = validateSubtask(duplicateCapSubtask);
assert(v9.valid === false, 'Duplicate capability IDs in subtask rejected');
assert(v9.errors.some(e => e.includes('contains duplicate capability ID')), 'Error specifies duplicate capability ID');

// ---------------------------------------------------------------------------
// TEST 10: Valid Capability IDs Accepted Purely on Syntax (No Readiness Claim)
// ---------------------------------------------------------------------------
console.log('\n[TEST 10] Testing Valid Capability IDs Accepted on Syntax (D3.1 Boundary)...');

const syntaxValidSubtask = {
  id: 'sub-13',
  objective: 'Subtask declaring valid syntax capabilities',
  required_capabilities: ['CAP-DISASTER-RECOVERY-VAULT', 'CAP-AUTHENTICATED-SECRETS-VAULT']
};

const v10 = validateSubtask(syntaxValidSubtask);
assert(v10.valid === true, 'Syntactically valid capability IDs pass subtask validation');

// ---------------------------------------------------------------------------
// TEST 11: createSubtask Helper Function
// ---------------------------------------------------------------------------
console.log('\n[TEST 11] Testing createSubtask() Normalization and Helper...');

const createdSubtask = createSubtask({
  id: 'sub-norm-1',
  objective: 'Execute normalization pass',
  required_capabilities: ['CAP-PROJECT-FACTORY-BOOTSTRAP']
});

assert(createdSubtask.id === 'sub-norm-1', 'ID preserved');
assert(createdSubtask.title === 'Execute normalization pass', 'Title populated from objective');
assert(createdSubtask.status === SUBTASK_STATUS.PENDING, 'Default status is PENDING');
assert(createdSubtask.failure_policy === FAILURE_POLICIES.ABORT, 'Default failure policy is ABORT');
assert(Array.isArray(createdSubtask.dependencies), 'Dependencies initialized as array');
assert(createdSubtask.depends_on === createdSubtask.dependencies, 'depends_on mirrors dependencies');

// Auto-generated ID if omitted
const autoIdSubtask = createSubtask({ objective: 'Auto ID generation verification' });
assert(typeof autoIdSubtask.id === 'string' && autoIdSubtask.id.startsWith('sub-'), 'Auto-generated ID created with sub- prefix');

// ---------------------------------------------------------------------------
// TEST 12: Legacy Task Contracts Without Subtasks Remain 100% Valid
// ---------------------------------------------------------------------------
console.log('\n[TEST 12] Testing Legacy Task Contract Backward Compatibility...');

const legacyContract = createTaskContract({
  objective: 'Perform legacy fix without subtasks metadata',
  task_type: 'MICRO_FIX'
});

assert(legacyContract.subtasks === undefined, 'Legacy contract subtasks field is undefined');
assert(validateTaskContract(legacyContract).valid === true, 'Legacy contract validates cleanly');

// ---------------------------------------------------------------------------
// TEST 13: Task Contract With Valid subtasks Array
// ---------------------------------------------------------------------------
console.log('\n[TEST 13] Testing Task Contract with Valid subtasks Collection...');

const contractWithSubtasks = createTaskContract({
  objective: 'Execute composite task with explicit subtask list',
  task_type: 'FEATURE',
  subtasks: [
    { id: 'sub-a', objective: 'Step A: Initialize workspace and verify pre-conditions', dependencies: [] },
    { id: 'sub-b', objective: 'Step B: Implement changes dependent on Step A', dependencies: ['sub-a'] }
  ]
});

assert(Array.isArray(contractWithSubtasks.subtasks), 'subtasks attached as array');
assert(contractWithSubtasks.subtasks.length === 2, 'Two subtasks attached');
assert(validateTaskContract(contractWithSubtasks).valid === true, 'Contract with valid subtasks validates cleanly');

// ---------------------------------------------------------------------------
// TEST 14: Task Contract With Invalid Subtask Fails Contract Validation
// ---------------------------------------------------------------------------
console.log('\n[TEST 14] Testing Task Contract with Invalid Subtask Fails Validation...');

const invalidSubContract = {
  ...legacyContract,
  task_id: 'task-test-invalid-sub',
  subtasks: [
    { id: 'sub-x', objective: 'Valid first subtask', dependencies: [] },
    { id: 'sub-y', objective: 'Invalid second subtask with ghost dependency', dependencies: ['ghost-id'] }
  ]
};

const v14 = validateTaskContract(invalidSubContract);
assert(v14.valid === false, 'Contract with invalid subtask fails contract validation');
assert(v14.errors.some(e => e.includes('unknown subtask id')), 'Error message bubbles up subtask validation failure');

// ---------------------------------------------------------------------------
// TEST 15: Planner Decomposition Annotates Subtask Metadata
// ---------------------------------------------------------------------------
console.log('\n[TEST 15] Testing Task Planner Decomposition Subtask Annotation...');

const plannedContract = createTaskContract({
  objective: 'Verify planner decomposition subtask metadata annotation',
  task_type: 'SYSTEM_BUILD'
});

planTaskDecomposition(plannedContract);

assert(Array.isArray(plannedContract.execution_plan), 'execution_plan generated');
assert(Array.isArray(plannedContract.subtasks), 'subtasks generated and mirrors execution_plan');
assert(plannedContract.subtasks.length === 5, 'SYSTEM_BUILD generates 5 steps');

// Check Step 1 annotation
const step1 = plannedContract.execution_plan[0];
assert(step1.id === 1, 'Step 1 id is 1');
assert(step1.subtask_id.includes('step-1'), 'Step 1 subtask_id generated');
assert(step1.objective.length > 0, 'Step 1 objective populated');
assert(Array.isArray(step1.dependencies), 'Step 1 dependencies array populated');
assert(step1.failure_policy === 'ABORT', 'Step 1 failure_policy is ABORT');
assert(Array.isArray(step1.required_capabilities), 'Step 1 required_capabilities array populated');
assert(step1.required_capabilities.includes('CAP-PROJECT-FACTORY-BOOTSTRAP'), 'Step 1 annotates factory bootstrap capability');

// Verify that execution plan passes both DAG check and subtask list validation
assert(validatePlanDAG(plannedContract.execution_plan).valid === true, 'Decomposed plan passes validatePlanDAG');
assert(validateSubtaskList(plannedContract.execution_plan).valid === true, 'Decomposed plan passes validateSubtaskList');

// ---------------------------------------------------------------------------
// TEST 16: Extended validatePlanDAG with String IDs & Dependency Duplicate Check
// ---------------------------------------------------------------------------
console.log('\n[TEST 16] Testing Extended validatePlanDAG with String IDs & Duplicate Refs...');

// Linear DAG with string IDs
const stringLinearDAG = [
  { id: 'sub-init', action: 'Initialize', dependencies: [] },
  { id: 'sub-build', action: 'Build', dependencies: ['sub-init'] },
  { id: 'sub-test', action: 'Test', dependencies: ['sub-build'] }
];
assert(validatePlanDAG(stringLinearDAG).valid === true, 'Linear DAG with string IDs passes validatePlanDAG');

// Branched DAG with string IDs
const stringBranchedDAG = [
  { id: 'start', action: 'Start', dependencies: [] },
  { id: 'branch-a', action: 'Branch A', dependencies: ['start'] },
  { id: 'branch-b', action: 'Branch B', dependencies: ['start'] },
  { id: 'merge', action: 'Merge', dependencies: ['branch-a', 'branch-b'] }
];
assert(validatePlanDAG(stringBranchedDAG).valid === true, 'Branched DAG with string IDs passes validatePlanDAG');

// Circular cycle with string IDs (A -> B -> A)
const stringCycleDAG = [
  { id: 'node-a', action: 'Node A', dependencies: ['node-b'] },
  { id: 'node-b', action: 'Node B', dependencies: ['node-a'] }
];
assert(validatePlanDAG(stringCycleDAG).valid === false, 'Circular cycle with string IDs is rejected');

// Duplicate dependency reference within step
const dupDepDAG = [
  { id: 'step-1', action: 'Step 1', dependencies: [] },
  { id: 'step-2', action: 'Step 2', dependencies: ['step-1', 'step-1'] }
];
const vDup = validatePlanDAG(dupDepDAG);
assert(vDup.valid === false, 'Duplicate dependency reference within plan step is rejected');
assert(vDup.errors.some(e => e.includes('duplicate dependency reference')), 'Error specifies duplicate dependency reference');

// ---------------------------------------------------------------------------
// TEST 17: Focused Alias Consistency & Conflict Rejection (Issue A)
// ---------------------------------------------------------------------------
console.log('\n[TEST 17] Testing Focused Alias Consistency & Conflict Rejection...');

// Case 1: Matching identifier aliases
const matchingIdSubtask = { id: 1, step_id: 1, objective: 'Valid matching id and step_id' };
const v17a = validateSubtask(matchingIdSubtask);
assert(v17a.valid === true, 'Matching id and step_id aliases pass validation');

// Case 2: Conflicting identifier aliases
const conflictingIdSubtask = { id: 'sub-1', step_id: 2, objective: 'Conflicting id and step_id' };
const v17b = validateSubtask(conflictingIdSubtask);
assert(v17b.valid === false, 'Conflicting id and step_id aliases are rejected');
assert(v17b.errors.some(e => e.includes('Conflicting identifier aliases')), 'Error specifically identifies conflicting identifier aliases');

// Case 3: Legacy alias only
const legacyOnlySubtask = { step_id: 1, action: 'Valid legacy alias only' };
const v17c = validateSubtask(legacyOnlySubtask);
assert(v17c.valid === true, 'Legacy-only step_id/action aliases pass validation');

// Case 4: Canonical alias only
const canonicalOnlySubtask = { id: 'sub-canonical-01', objective: 'Valid canonical alias only' };
const v17d = validateSubtask(canonicalOnlySubtask);
assert(v17d.valid === true, 'Canonical-only id/objective aliases pass validation');

// Case 5: Matching dependency aliases
const matchingDepsSubtask = {
  id: 'sub-match-deps',
  objective: 'Matching dependency aliases',
  dependencies: ['sub-01', 'sub-02'],
  depends_on: ['sub-01', 'sub-02']
};
const v17e = validateSubtask(matchingDepsSubtask);
assert(v17e.valid === true, 'Matching dependencies and depends_on pass validation');

// Case 6: Conflicting dependency aliases
const conflictingDepsSubtask = {
  id: 'sub-conflict-deps',
  objective: 'Conflicting dependency aliases',
  dependencies: ['sub-01'],
  depends_on: ['sub-02']
};
const v17f = validateSubtask(conflictingDepsSubtask);
assert(v17f.valid === false, 'Conflicting dependencies and depends_on aliases are rejected');
assert(v17f.errors.some(e => e.includes('Conflicting dependency aliases')), 'Error specifically identifies conflicting dependency aliases');

// Case 7: createSubtask throws on conflicting identifier aliases
let threwIdConflict = false;
try {
  createSubtask({ id: 'sub-x', step_id: 99, objective: 'Should throw on conflict' });
} catch (e) {
  threwIdConflict = e.message.includes('Conflicting identifier aliases');
}
assert(threwIdConflict === true, 'createSubtask throws on conflicting id and step_id aliases');

// Case 8: createSubtask throws on conflicting dependency aliases
let threwDepConflict = false;
try {
  createSubtask({ dependencies: ['a'], depends_on: ['b'], objective: 'Should throw on dep conflict' });
} catch (e) {
  threwDepConflict = e.message.includes('Conflicting dependency aliases');
}
assert(threwDepConflict === true, 'createSubtask throws on conflicting dependency aliases');

// Case 9: createSubtask succeeds with matching aliases
const createdWithMatching = createSubtask({
  id: 1,
  step_id: 1,
  dependencies: ['sub-init'],
  depends_on: ['sub-init'],
  objective: 'Matching aliases in createSubtask'
});
assert(createdWithMatching.id === 1 && createdWithMatching.step_id === 1, 'createSubtask succeeds with matching aliases');

// ---------------------------------------------------------------------------
// TEST 18: Focused Mixed String/Numeric IDs & DAG Robustness (Issue B)
// ---------------------------------------------------------------------------
console.log('\n[TEST 18] Testing Focused Mixed String/Numeric IDs & DAG Robustness...');

// Case 1: Numeric-only DAG
const numericDAG = [
  { step_id: 1, action: 'Step 1', depends_on: [] },
  { step_id: 2, action: 'Step 2', depends_on: [1] }
];
assert(validatePlanDAG(numericDAG).valid === true, 'Numeric-only DAG passes validatePlanDAG');

// Case 2: String-only DAG
const stringDAG = [
  { id: 'alpha', action: 'Alpha', dependencies: [] },
  { id: 'beta', action: 'Beta', dependencies: ['alpha'] }
];
assert(validatePlanDAG(stringDAG).valid === true, 'String-only DAG passes validatePlanDAG');

// Case 3: Numeric ID with string dependency reference
const mixedRefDAG = [
  { step_id: 1, action: 'Step 1 (numeric)', depends_on: [] },
  { step_id: 2, action: 'Step 2 (numeric)', depends_on: ['1'] } // String reference to numeric step 1
];
const vMixed = validatePlanDAG(mixedRefDAG);
assert(vMixed.valid === true, 'Numeric ID with string dependency reference resolves deterministically', vMixed.errors.join(', '));

// Case 4: Numeric 1 and String "1" collision in same plan
const collisionDAG = [
  { id: 1, action: 'Step 1 (numeric)', dependencies: [] },
  { id: '1', action: 'Step 1 (string)', dependencies: [] }
];
const vCollision = validatePlanDAG(collisionDAG);
assert(vCollision.valid === false, 'Numeric 1 and String "1" collision in same plan is rejected');
assert(vCollision.errors.some(e => e.includes('ID collision')), 'Error specifically notes ID collision');

// Case 5: Exact duplicate IDs
const exactDupDAG = [
  { step_id: 5, action: 'Step 5 original', depends_on: [] },
  { step_id: 5, action: 'Step 5 duplicate', depends_on: [] }
];
const vExactDup = validatePlanDAG(exactDupDAG);
assert(vExactDup.valid === false, 'Exact duplicate numeric IDs are rejected');
assert(vExactDup.errors.some(e => e.includes('Duplicate step_id detected: 5')), 'Error specifies duplicate step_id');

// Case 6: Unknown dependency
const unknownDepDAG = [
  { step_id: 1, action: 'Step 1', depends_on: [999] }
];
const vUnknown = validatePlanDAG(unknownDepDAG);
assert(vUnknown.valid === false, 'Unknown dependency reference is rejected');
assert(vUnknown.errors.some(e => e.includes('depends on nonexistent step_id: 999')), 'Error specifies nonexistent dependency');

// Case 7: Multi-step circular dependency (1 -> 2 -> 3 -> 1)
const multiCycleDAG = [
  { step_id: 1, action: 'Step 1', depends_on: [3] },
  { step_id: 2, action: 'Step 2', depends_on: [1] },
  { step_id: 3, action: 'Step 3', depends_on: [2] }
];
const vMultiCycle = validatePlanDAG(multiCycleDAG);
assert(vMultiCycle.valid === false, 'Multi-step circular dependency (1->2->3->1) is rejected');
assert(vMultiCycle.errors.some(e => e.includes('Circular dependency cycle detected')), 'Error specifies circular cycle');

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
console.log('======================================================================');
console.log(`🏁 SUBTASK DATA CONTRACT TEST SUMMARY: ${passedTests} PASSED | ${totalTests - passedTests} FAILED`);
console.log('======================================================================');

if (totalTests !== passedTests) {
  process.exit(1);
}

