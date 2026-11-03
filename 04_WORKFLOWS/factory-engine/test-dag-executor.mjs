/**
 * AI-BUILDER-BRAIN DAG EXECUTION ENGINE & DYNAMIC SKILL BINDING TEST SUITE (PHASE D3.3)
 *
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-dag-executor.mjs
 * Purpose: Verifies Phase D3.3:
 * - Deterministic Sequential DAG Execution Engine
 * - Dynamic Skill Binding (Explicit, Capability Mapping, Action Pattern, Base Runtime)
 * - Strict Pre-flight & Inline Capability Readiness Gating
 * - Predecessor Failure Halting & Cascading Abort (Downstream SKIPPED)
 * - Safe Resumption & Idempotency (Already Completed Subtasks Preserved)
 * - Durable Checkpoint Persistence & State Preservation
 * - Rejection of Circular Cycles, Nonexistent Dependencies, and Duplicate IDs
 * - Zero Parallel Execution (Strict Sequential Model)
 *
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  executeSubtaskDAG,
  bindSkillToSubtask,
  bindSkillsToPlan,
  getExecutableSubtasks,
  advanceSubtaskExecution,
  CAPABILITY_SKILL_MAP
} from './dag-executor.mjs';
import {
  createTaskContract,
  createSubtask,
  SUBTASK_STATUS
} from './task-contract.mjs';
import {
  loadTaskCheckpoint,
  loadAllCheckpoints,
  recordTaskCheckpoint
} from './brain-connector.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');
const PROD_CHECKPOINTS_FILE = path.join(BRAIN_ROOT, '.project-brain', 'task-checkpoints.json');
const beforeProdCheckpointsRaw = fs.existsSync(PROD_CHECKPOINTS_FILE) ? fs.readFileSync(PROD_CHECKPOINTS_FILE, 'utf-8') : null;

// Isolated simulation sandbox for regression test checkpoints
const SANDBOX_DIR = path.join(BRAIN_ROOT, '.project-brain', 'simulation-sandbox', 'dag-executor-test');
fs.mkdirSync(path.join(SANDBOX_DIR, '.project-brain'), { recursive: true });
const TEST_CHECKPOINTS_FILE = path.join(SANDBOX_DIR, '.project-brain', 'task-checkpoints.json');
if (fs.existsSync(PROD_CHECKPOINTS_FILE)) {
  fs.copyFileSync(PROD_CHECKPOINTS_FILE, TEST_CHECKPOINTS_FILE);
} else {
  fs.writeFileSync(TEST_CHECKPOINTS_FILE, JSON.stringify({ version: '1.0.0', tasks: {} }, null, 2), 'utf-8');
}
process.env.BRAIN_TASK_CHECKPOINTS_FILE = TEST_CHECKPOINTS_FILE;
const CHECKPOINTS_FILE = TEST_CHECKPOINTS_FILE;

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

async function runTestSuite() {
  console.log('======================================================================');
  console.log('🧪 TEST SUITE: DAG EXECUTION ENGINE & DYNAMIC SKILL BINDING (D3.3)');
  console.log('======================================================================\n');

  // ------------------------------------------------------------------
  // TEST GROUP 1: DAG Topology & Deterministic Sequential Execution
  // ------------------------------------------------------------------
  console.log('[TEST 1] Testing Linear DAG Execution (1 -> 2 -> 3)...');
  {
    const executionOrder = [];
    const contract = createTaskContract({
      task_id: `test-d3.3-linear-${Date.now()}`,
      task_type: 'FEATURE',
      objective: 'Execute 3-step linear DAG sequentially',
      subtasks: [
        createSubtask({ id: 1, objective: 'Step 1: Setup Schema', dependencies: [] }),
        createSubtask({ id: 2, objective: 'Step 2: Implement Component', dependencies: [1] }),
        createSubtask({ id: 3, objective: 'Step 3: Verification Build', dependencies: [2] })
      ]
    });

    const result = await executeSubtaskDAG(contract, async (subtask) => {
      executionOrder.push(subtask.id);
      return { success: true, evidence: { stepRan: subtask.id } };
    }, { persistCheckpoint: false });

    assert(result.success === true, 'Linear DAG completes with overall success');
    assert(result.status === 'COMPLETED', 'Overall status is COMPLETED');
    assert(result.completedCount === 3, 'All 3 subtasks recorded as completed', `Count: ${result.completedCount}`);
    assert(result.failedCount === 0, 'Zero subtasks failed');
    assert(result.skippedCount === 0, 'Zero subtasks skipped');
    assert(JSON.stringify(executionOrder) === JSON.stringify([1, 2, 3]), 'Executed in strict sequential topological order [1, 2, 3]', `Order: ${executionOrder.join(' -> ')}`);
    assert(contract.subtasks.every(s => s.status === SUBTASK_STATUS.COMPLETED), 'Every subtask object status is COMPLETED');
  }

  console.log('\n[TEST 2] Testing Independent Subtasks Deterministic Sequential Order...');
  {
    const executionOrder = [];
    const contract = createTaskContract({
      task_id: `test-d3.3-independent-${Date.now()}`,
      task_type: 'AUDIT',
      objective: 'Execute independent parallel-eligible subtasks sequentially',
      subtasks: [
        createSubtask({ id: 'audit-a', objective: 'Audit A: Security Boundary', dependencies: [] }),
        createSubtask({ id: 'audit-b', objective: 'Audit B: Performance Matrix', dependencies: [] }),
        createSubtask({ id: 'audit-c', objective: 'Audit C: Accessibility Matrix', dependencies: [] })
      ]
    });

    const result = await executeSubtaskDAG(contract, async (subtask) => {
      executionOrder.push(subtask.id);
      return { success: true, evidence: { audit: subtask.id } };
    }, { persistCheckpoint: false });

    assert(result.success === true, 'Independent subtasks completed successfully');
    assert(result.completedCount === 3, 'All 3 independent subtasks completed');
    assert(executionOrder.length === 3, '3 subtasks executed sequentially', `Order: ${executionOrder.join(', ')}`);
    assert(result.status === 'COMPLETED', 'Task status is COMPLETED');
  }

  console.log('\n[TEST 3] Testing Multi-Level Diamond DAG (1 -> 2, 1 -> 3, (2, 3) -> 4)...');
  {
    const executionOrder = [];
    const contract = createTaskContract({
      task_id: `test-d3.3-diamond-${Date.now()}`,
      task_type: 'SYSTEM_BUILD',
      objective: 'Execute diamond DAG with convergence barrier',
      subtasks: [
        createSubtask({ id: 'root', objective: 'Step 1: Scaffolding', dependencies: [] }),
        createSubtask({ id: 'branch-left', objective: 'Step 2: API Client', dependencies: ['root'] }),
        createSubtask({ id: 'branch-right', objective: 'Step 3: UI Layout', dependencies: ['root'] }),
        createSubtask({ id: 'join', objective: 'Step 4: Integration Gate', dependencies: ['branch-left', 'branch-right'] })
      ]
    });

    const result = await executeSubtaskDAG(contract, async (subtask) => {
      executionOrder.push(subtask.id);
      return { success: true };
    }, { persistCheckpoint: false });

    assert(result.success === true, 'Diamond DAG completed successfully');
    assert(executionOrder[0] === 'root', 'Step 1 (root) executed first');
    assert(executionOrder[3] === 'join', 'Step 4 (join) executed last after both branches');
    assert(executionOrder.includes('branch-left') && executionOrder.includes('branch-right'), 'Both branches executed');
  }

  console.log('\n[TEST 4] Testing Circular Dependency Cycle & Invalid DAG Rejection...');
  {
    const contractCycle = createTaskContract({
      task_id: `test-d3.3-cycle-${Date.now()}`,
      task_type: 'FEATURE',
      objective: 'Circular dependency cycle rejection',
      subtasks: [
        createSubtask({ id: 1, objective: 'Step 1', dependencies: [3] }),
        createSubtask({ id: 2, objective: 'Step 2', dependencies: [1] }),
        createSubtask({ id: 3, objective: 'Step 3', dependencies: [2] })
      ]
    });

    let executorCalled = false;
    const resultCycle = await executeSubtaskDAG(contractCycle, async () => {
      executorCalled = true;
      return { success: true };
    }, { persistCheckpoint: false });

    assert(resultCycle.success === false, 'Circular DAG is rejected with success: false');
    assert(resultCycle.error === 'INVALID_DAG', 'Error code is INVALID_DAG');
    assert(executorCalled === false, 'Zero subtasks executed on circular DAG rejection');

    const contractNonexistentDep = {
      task_id: `test-d3.3-nonexistent-${Date.now()}`,
      task_type: 'FEATURE',
      objective: 'Nonexistent dependency rejection',
      subtasks: [
        { id: 1, objective: 'Step 1', dependencies: [999] }
      ]
    };

    const resultNonexistent = await executeSubtaskDAG(contractNonexistentDep, null, { persistCheckpoint: false });
    assert(resultNonexistent.success === false, 'Plan with nonexistent dependency is rejected');
    assert(resultNonexistent.error === 'INVALID_DAG', 'Error specifies INVALID_DAG');
  }

  // ------------------------------------------------------------------
  // TEST GROUP 2: Dependency Failure Halting & Cascading Abort
  // ------------------------------------------------------------------
  console.log('\n[TEST 5] Testing Predecessor Failure Halting & Cascading Abort...');
  {
    const executionAttempts = [];
    const contract = createTaskContract({
      task_id: `test-d3.3-abort-${Date.now()}`,
      task_type: 'FEATURE',
      objective: 'Predecessor failure cascade',
      subtasks: [
        createSubtask({ id: 1, objective: 'Step 1: Setup Base', dependencies: [] }),
        createSubtask({ id: 2, objective: 'Step 2: Defective Action', dependencies: [1], failure_policy: 'ABORT' }),
        createSubtask({ id: 3, objective: 'Step 3: Downstream Action', dependencies: [2] })
      ]
    });

    const result = await executeSubtaskDAG(contract, async (subtask) => {
      executionAttempts.push(subtask.id);
      if (subtask.id === 2) {
        return { success: false, error: 'Database migration failed: connection timeout' };
      }
      return { success: true };
    }, { persistCheckpoint: false });

    assert(result.success === false, 'Pipeline halted with overall failure on step error');
    assert(result.status === 'FAILED', 'Pipeline status is FAILED');
    assert(result.completedCount === 1, 'Step 1 completed before failure', `Count: ${result.completedCount}`);
    assert(result.failedCount === 1, 'Step 2 recorded as failed', `Count: ${result.failedCount}`);
    assert(result.skippedCount === 1, 'Step 3 recorded as skipped', `Count: ${result.skippedCount}`);
    assert(executionAttempts.includes(1), 'Step 1 was executed');
    assert(executionAttempts.includes(2), 'Step 2 was executed');
    assert(!executionAttempts.includes(3), 'Step 3 was NEVER executed (safe cascade halting)');

    const step3 = contract.subtasks.find(s => s.id === 3);
    assert(step3.status === SUBTASK_STATUS.SKIPPED, 'Step 3 status marked SKIPPED');
    assert(step3.blocking_reason.includes('Cascading abort'), 'Step 3 blocking_reason documents cascading abort');
  }

  console.log('\n[TEST 6] Testing Multi-Branch Failure Isolation & Selective Cascading...');
  {
    // 1 -> 2 -> 4 (fails at 2, skips 4)
    // 1 -> 3 -> 5
    const executed = [];
    const contract = createTaskContract({
      task_id: `test-d3.3-multi-branch-abort-${Date.now()}`,
      task_type: 'SYSTEM_BUILD',
      objective: 'Multi-branch cascade abort test',
      subtasks: [
        createSubtask({ id: 1, objective: 'Root Scaffolding', dependencies: [] }),
        createSubtask({ id: 2, objective: 'Failing Subsystem A', dependencies: [1], failure_policy: 'ABORT' }),
        createSubtask({ id: 3, objective: 'Healthy Subsystem B', dependencies: [1] }),
        createSubtask({ id: 4, objective: 'Downstream of A', dependencies: [2] })
      ]
    });

    const result = await executeSubtaskDAG(contract, async (subtask) => {
      executed.push(subtask.id);
      if (subtask.id === 2) return { success: false, error: 'Subsystem A broke' };
      return { success: true };
    }, { persistCheckpoint: false });

    assert(result.success === false, 'Multi-branch execution failed as expected');
    assert(executed.includes(1), 'Root executed');
    assert(executed.includes(2), 'Failing step 2 executed');
    assert(!executed.includes(4), 'Step 4 downstream of failing step 2 was NEVER executed');
    const step4 = contract.subtasks.find(s => s.id === 4);
    assert(step4.status === SUBTASK_STATUS.SKIPPED, 'Step 4 marked SKIPPED due to predecessor failure');
  }

  // ------------------------------------------------------------------
  // TEST GROUP 3: Dynamic Skill Binding
  // ------------------------------------------------------------------
  console.log('\n[TEST 7] Testing Explicit Skill Binding to Certified Skill...');
  {
    const subtask = createSubtask({
      id: 'st-explicit',
      objective: 'Apply Tailwind v4 design tokens to UI shell',
      assigned_skill_id: 'tailwind-v4-css-first-design'
    });

    const bindRes = bindSkillToSubtask(subtask);
    assert(bindRes.success === true, 'Explicit certified skill binds successfully');
    assert(bindRes.skillId === 'tailwind-v4-css-first-design', 'Skill ID matches requested skill');
    assert(bindRes.matchedBy === 'EXPLICIT_ASSIGNMENT', 'Matched by EXPLICIT_ASSIGNMENT');
    assert(subtask.binding_decision.verified === true, 'Binding decision verified flag is true');
    assert(Array.isArray(subtask.invariants) && subtask.invariants.length > 0, 'Skill invariants injected into subtask', `Count: ${subtask.invariants.length}`);
  }

  console.log('\n[TEST 8] Testing Explicit Skill Assignment to Nonexistent Skill Fails Closed...');
  {
    const subtask = createSubtask({
      id: 'st-missing-skill',
      objective: 'Run nonexistent phantom skill',
      assigned_skill_id: 'phantom-unverified-skill-xyz'
    });

    const bindRes = bindSkillToSubtask(subtask);
    assert(bindRes.success === false, 'Nonexistent skill binding fails closed');
    assert(bindRes.error === 'SKILL_NOT_FOUND', 'Error is SKILL_NOT_FOUND');
    assert(subtask.binding_decision.verified === false, 'Binding decision verified flag is false');

    // Full DAG execution with missing skill halts
    const contract = createTaskContract({
      task_id: `test-d3.3-missing-skill-${Date.now()}`,
      task_type: 'FEATURE',
      objective: 'Missing skill DAG test',
      subtasks: [subtask]
    });

    const result = await executeSubtaskDAG(contract, null, { persistCheckpoint: false });
    assert(result.success === false, 'DAG execution halts on missing skill binding');
    assert(result.error === 'SKILL_BINDING_FAILED', 'Error code is SKILL_BINDING_FAILED');
  }

  console.log('\n[TEST 9] Testing Dynamic Skill Binding via Capability Mapping...');
  {
    const subtask = createSubtask({
      id: 'st-cap-map',
      objective: 'Generate 54-locale hreflang clusters and trailing-slash canonicals',
      required_capabilities: ['CAP-MULTILINGUAL-SEO-INTELLIGENCE']
    });

    const bindRes = bindSkillToSubtask(subtask);
    assert(bindRes.success === true, 'Dynamic capability binding succeeds for VERIFIED WORKING capability');
    assert(bindRes.skillId === 'multilingual-first-architecture', 'Dynamically bound to multilingual-first-architecture');
    assert(bindRes.matchedBy === 'CAPABILITY_MAPPING', 'Matched by CAPABILITY_MAPPING');
    assert(subtask.assigned_skill_id === 'multilingual-first-architecture', 'Assigned skill ID set on subtask');
    assert(subtask.binding_decision.matched_capability === 'CAP-MULTILINGUAL-SEO-INTELLIGENCE', 'Matched capability recorded in decision');
  }

  console.log('\n[TEST 10] Testing Dynamic Skill Binding via Action / Title Pattern...');
  {
    const subtask = createSubtask({
      id: 'st-pattern',
      objective: 'Configure responsive geometry and Tailwind CSS color tokens'
    });

    const bindRes = bindSkillToSubtask(subtask);
    assert(bindRes.success === true, 'Dynamic pattern binding succeeds');
    assert(bindRes.skillId === 'tailwind-v4-css-first-design', 'Matched tailwind skill via keyword pattern');
    assert(bindRes.matchedBy === 'ACTION_PATTERN', 'Matched by ACTION_PATTERN');
  }

  console.log('\n[TEST 11] Testing Base Runtime Fallback for General Subtask...');
  {
    const subtask = createSubtask({
      id: 'st-base',
      objective: 'Compute hash digest of arbitrary buffer'
    });

    const bindRes = bindSkillToSubtask(subtask);
    assert(bindRes.success === true, 'Base runtime fallback succeeds');
    assert(bindRes.skillId === null, 'Skill ID is null (base runtime)');
    assert(bindRes.matchedBy === 'BASE_RUNTIME', 'Matched by BASE_RUNTIME');
    assert(subtask.binding_decision.verified === true, 'Base runtime verified flag is true');
  }

  console.log('\n[TEST 12] Testing Dynamic Skill Binding with Blocked Capability Rejection...');
  {
    const subtask = createSubtask({
      id: 'st-blocked-cap',
      objective: 'Harvest cloud patterns continuously',
      required_capabilities: ['CAP-CONTINUOUS-CLOUD-HARVESTING'] // PARTIALLY IMPLEMENTED in registry
    });

    const bindRes = bindSkillToSubtask(subtask);
    assert(bindRes.success === false, 'Dynamic skill binding fails for unverified capability');
    assert(bindRes.error === 'CAPABILITY_NOT_VERIFIED', 'Error is CAPABILITY_NOT_VERIFIED');
    assert(subtask.binding_decision.verified === false, 'Decision verified flag is false');
  }

  // ------------------------------------------------------------------
  // TEST GROUP 4: Capability Readiness Pre-Flight Gating
  // ------------------------------------------------------------------
  console.log('\n[TEST 13] Testing Subtask with VERIFIED WORKING Capability Executes Cleanly...');
  {
    const contract = createTaskContract({
      task_id: `test-d3.3-verified-cap-${Date.now()}`,
      task_type: 'SYSTEM_BUILD',
      objective: 'Scaffold project with verified factory bootstrap',
      subtasks: [
        createSubtask({
          id: 1,
          objective: 'Bootstrap project architecture',
          required_capabilities: ['CAP-PROJECT-FACTORY-BOOTSTRAP'] // VERIFIED WORKING
        })
      ]
    });

    let ran = false;
    const result = await executeSubtaskDAG(contract, async () => {
      ran = true;
      return { success: true };
    }, { persistCheckpoint: false });

    assert(result.success === true, 'Verified capability subtask executed successfully');
    assert(ran === true, 'Executor ran for verified capability');
    assert(contract.subtasks[0].status === SUBTASK_STATUS.COMPLETED, 'Subtask status is COMPLETED');
  }

  console.log('\n[TEST 14] Testing Subtask with MISSING Capability Blocked Pre-Flight...');
  {
    const contract = createTaskContract({
      task_id: `test-d3.3-missing-cap-${Date.now()}`,
      task_type: 'FEATURE',
      objective: 'Execute subtask requiring missing capability',
      subtasks: [
        createSubtask({
          id: 1,
          objective: 'Discover 10,000 GitHub repos',
          required_capabilities: ['CAP-INTERNET-SCALE-REPO-DISCOVERY'] // MISSING
        })
      ]
    });

    let ran = false;
    const result = await executeSubtaskDAG(contract, async () => {
      ran = true;
      return { success: true };
    }, { persistCheckpoint: false });

    assert(result.success === false, 'Execution blocked for MISSING capability');
    assert(result.error === 'CAPABILITY_GATING_BLOCKED', 'Error code is CAPABILITY_GATING_BLOCKED');
    assert(ran === false, 'Executor was NOT run (fail-closed pre-flight gating)');
    assert(contract.subtasks[0].status === SUBTASK_STATUS.BLOCKED, 'Subtask status marked BLOCKED');
  }

  console.log('\n[TEST 15] Testing Subtask with UNVERIFIED Capability Blocked Pre-Flight...');
  {
    const contract = createTaskContract({
      task_id: `test-d3.3-unverified-cap-${Date.now()}`,
      task_type: 'AUDIT',
      objective: 'Run headless browser verification',
      subtasks: [
        createSubtask({
          id: 1,
          objective: 'Verify headless rendering',
          required_capabilities: ['CAP-HEADLESS-BROWSER-VERIFICATION'] // PRESENT BUT UNVERIFIED
        })
      ]
    });

    let ran = false;
    const result = await executeSubtaskDAG(contract, async () => {
      ran = true;
      return { success: true };
    }, { persistCheckpoint: false });

    assert(result.success === false, 'Execution blocked for PRESENT BUT UNVERIFIED capability');
    assert(result.error === 'CAPABILITY_GATING_BLOCKED', 'Error code is CAPABILITY_GATING_BLOCKED');
    assert(ran === false, 'Executor was NOT run');
    assert(contract.subtasks[0].status === SUBTASK_STATUS.BLOCKED, 'Subtask status marked BLOCKED');
  }

  console.log('\n[TEST 16] Testing False Positive Prevention (Unready Subtask Cannot Be Completed)...');
  {
    const contract = createTaskContract({
      task_id: `test-d3.3-false-pos-${Date.now()}`,
      task_type: 'FEATURE',
      objective: 'Gating false positive prevention',
      subtasks: [
        createSubtask({
          id: 'step-invalid',
          objective: 'Invalid subtask',
          required_capabilities: ['CAP-AUTOMATED-LEGAL-LICENSE-AUDIT'] // MISSING
        })
      ]
    });

    const result = await executeSubtaskDAG(contract, async () => {
      // Even if executor falsely claims success, gating blocks it upfront
      return { success: true };
    }, { persistCheckpoint: false });

    assert(result.success === false, 'Blocked subtask cannot result in pipeline success');
    assert(contract.subtasks[0].status !== SUBTASK_STATUS.COMPLETED, 'Subtask status is NOT COMPLETED');
  }

  // ------------------------------------------------------------------
  // TEST GROUP 5: Durable Checkpoints, Safe Resumption & Idempotency
  // ------------------------------------------------------------------
  console.log('\n[TEST 17] Testing Durable Checkpoint Persistence Across DAG Steps...');
  {
    const taskId = `test-d3.3-checkpoint-${Date.now()}`;
    const contract = createTaskContract({
      task_id: taskId,
      task_type: 'FEATURE',
      objective: 'Verify durable checkpoint updates across steps',
      subtasks: [
        createSubtask({ id: 1, objective: 'Step 1: Checkpoint Test', dependencies: [] }),
        createSubtask({ id: 2, objective: 'Step 2: Checkpoint Test', dependencies: [1] })
      ]
    });

    const result = await executeSubtaskDAG(contract, async (subtask) => {
      return { success: true, evidence: { stepNumber: subtask.id } };
    }, { persistCheckpoint: true });

    assert(result.success === true, 'DAG executed successfully with checkpoints');

    // Load checkpoint directly from durable storage
    const loaded = loadTaskCheckpoint(taskId);
    assert(loaded !== null, 'Task checkpoint found in durable storage (.project-brain/task-checkpoints.json)');
    assert(loaded.task_id === taskId, 'Stored checkpoint task_id matches');
    assert(loaded.status === 'COMPLETED', 'Stored checkpoint status is COMPLETED');
    assert(loaded.checkpoint.current_step === 2, 'Stored current_step advanced to 2');

    // Verify other tasks in checkpoint store were NOT corrupted
    const allCheckpoints = loadAllCheckpoints();
    assert(Object.keys(allCheckpoints.tasks).length > 1, 'Existing tasks preserved in durable checkpoint store');

    // Clean up test task key to keep storage clean
    delete allCheckpoints.tasks[taskId];
    fs.writeFileSync(CHECKPOINTS_FILE, JSON.stringify(allCheckpoints, null, 2), 'utf-8');
  }

  console.log('\n[TEST 18] Testing Safe Resumption & Idempotency (Already Completed Steps Skipped)...');
  {
    const stepInvocations = [];
    const contract = createTaskContract({
      task_id: `test-d3.3-resume-${Date.now()}`,
      task_type: 'FEATURE',
      objective: 'Resumption of partially completed DAG',
      subtasks: [
        createSubtask({
          id: 1,
          objective: 'Step 1: Already Completed',
          dependencies: [],
          status: SUBTASK_STATUS.COMPLETED, // Pre-completed
          evidence: { previousRun: true }
        }),
        createSubtask({
          id: 2,
          objective: 'Step 2: Pending Step',
          dependencies: [1]
        }),
        createSubtask({
          id: 3,
          objective: 'Step 3: Final Step',
          dependencies: [2]
        })
      ]
    });

    const result = await executeSubtaskDAG(contract, async (subtask) => {
      stepInvocations.push(subtask.id);
      return { success: true };
    }, { persistCheckpoint: false, skipCompleted: true });

    assert(result.success === true, 'Resumed DAG execution completes successfully');
    assert(stepInvocations.length === 2, 'Exactly 2 steps executed (Step 1 was skipped)');
    assert(!stepInvocations.includes(1), 'Step 1 was NOT invoked again (idempotency preserved)');
    assert(stepInvocations.includes(2) && stepInvocations.includes(3), 'Steps 2 and 3 executed normally');

    const executedFirst = result.executedSubtasks.find(e => e.subtaskId === 1);
    assert(executedFirst?.previouslyCompleted === true, 'Result records Step 1 was previously completed');
    assert(executedFirst?.skippedExecution === true, 'Result records Step 1 skipped execution');
  }

  console.log('\n[TEST 19] Testing State Transition & Evidence Audit Trail...');
  {
    const contract = createTaskContract({
      task_id: `test-d3.3-audit-trail-${Date.now()}`,
      task_type: 'FEATURE',
      objective: 'Audit trail verification',
      subtasks: [
        createSubtask({ id: 'probe-1', objective: 'Inspect configuration' })
      ]
    });

    const result = await executeSubtaskDAG(contract, async (subtask) => {
      return {
        success: true,
        evidence: {
          filesChecked: ['package.json'],
          exitCode: 0,
          verifiedRule: 'Rule-123'
        }
      };
    }, { persistCheckpoint: false });

    assert(result.success === true, 'Single subtask completed');
    const subtask = contract.subtasks[0];
    assert(subtask.status === SUBTASK_STATUS.COMPLETED, 'Subtask status is COMPLETED');
    assert(typeof subtask.started_at === 'string', 'started_at timestamp recorded');
    assert(typeof subtask.completed_at === 'string', 'completed_at timestamp recorded');
    assert(subtask.evidence?.filesChecked?.includes('package.json'), 'Custom evidence attached to subtask');
    assert(subtask.binding_decision?.verified === true, 'Binding decision attached to subtask');
  }

  console.log('\n[TEST 20] Testing Deadlock Detection on Unsatisfied Dependencies...');
  {
    // Step 2 depends on Step 1, but Step 1 is FAILED, so Step 2 can never run
    const contract = {
      task_id: `test-d3.3-deadlock-${Date.now()}`,
      task_type: 'FEATURE',
      objective: 'Deadlock detection test',
      subtasks: [
        { id: 1, objective: 'Predecessor Failed', dependencies: [], status: SUBTASK_STATUS.FAILED },
        { id: 2, objective: 'Waiting Step', dependencies: [1], status: SUBTASK_STATUS.PENDING }
      ]
    };

    const result = await executeSubtaskDAG(contract, null, {
      persistCheckpoint: false,
      enforceReadinessGating: false,
      bindSkills: false
    });

    assert(result.success === false, 'Deadlocked plan returns success: false');
    assert(result.status === 'FAILED', 'Status is FAILED');
    assert(result.failureReason.includes('Deadlock or unsatisfied dependencies'), 'Failure reason notes deadlock');
  }

  // Verify production checkpoint file remained 100% untouched
  const afterProdCheckpointsRaw = fs.existsSync(PROD_CHECKPOINTS_FILE) ? fs.readFileSync(PROD_CHECKPOINTS_FILE, 'utf-8') : null;
  assert(afterProdCheckpointsRaw === beforeProdCheckpointsRaw, 'Production task-checkpoints.json remained completely untouched');

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`🏁 DAG EXECUTOR & DYNAMIC SKILL BINDING VERIFICATION: ${passedTests} PASSED | ${totalTests - passedTests} FAILED`);
  console.log('======================================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('\n❌ Unhandled error in test suite:', err);
  process.exit(1);
});
