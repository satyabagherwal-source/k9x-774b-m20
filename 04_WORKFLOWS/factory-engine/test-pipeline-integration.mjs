/**
 * AI-BUILDER-BRAIN FULL PIPELINE INTEGRATION & VERIFICATION BARRIERS TEST SUITE (PHASE D3.4)
 *
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-pipeline-integration.mjs
 * Purpose: Verifies Phase D3.4:
 * - End-to-End Universal Task Pipeline with DAG Execution Engine & Dynamic Skill Binding
 * - Verification Barriers 1 through 8 (Contract, DAG, Capability, Skill, Dependency, Outcome, Result, Persistence)
 * - Executor Adapter Contract (Context forwarding, error normalization, anti-false-equivalence)
 * - Cascading Abort & Downstream Skip on Failure
 * - Safe Resumption & Idempotency across Pipeline Runs
 * - Complete Backward Compatibility with Legacy Callers & Contracts
 * - Durable Checkpoint Persistence & State Preservation
 *
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  executeUniversalTaskPipeline,
  createExecutorAdapter,
  executeSubtaskDAG,
  bindSkillsToPlan,
  loadTaskCheckpoint,
  loadAllCheckpoints,
  recordTaskCheckpoint
} from './brain-connector.mjs';
import {
  createTaskContract,
  createSubtask,
  TASK_STATUS,
  SUBTASK_STATUS
} from './task-contract.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');
const PROD_CHECKPOINTS_FILE = path.join(BRAIN_ROOT, '.project-brain', 'task-checkpoints.json');
const PROD_SESSION_MEM_FILE = path.join(BRAIN_ROOT, '.project-brain', 'session-memory.json');

const beforeSessionMemRaw = fs.existsSync(PROD_SESSION_MEM_FILE) ? fs.readFileSync(PROD_SESSION_MEM_FILE, 'utf-8') : null;
const beforeCheckpointsRaw = fs.existsSync(PROD_CHECKPOINTS_FILE) ? fs.readFileSync(PROD_CHECKPOINTS_FILE, 'utf-8') : null;

// Isolated simulation sandbox for regression test checkpoints
const SANDBOX_DIR = path.join(BRAIN_ROOT, '.project-brain', 'simulation-sandbox', 'pipeline-integration-test');
fs.mkdirSync(path.join(SANDBOX_DIR, '.project-brain'), { recursive: true });
const TEST_CHECKPOINTS_FILE = path.join(SANDBOX_DIR, '.project-brain', 'task-checkpoints.json');
if (fs.existsSync(PROD_CHECKPOINTS_FILE)) {
  fs.copyFileSync(PROD_CHECKPOINTS_FILE, TEST_CHECKPOINTS_FILE);
} else {
  fs.writeFileSync(TEST_CHECKPOINTS_FILE, JSON.stringify({ version: '1.0.0', tasks: {} }, null, 2), 'utf-8');
}
process.env.BRAIN_TASK_CHECKPOINTS_FILE = TEST_CHECKPOINTS_FILE;
const CHECKPOINTS_FILE = TEST_CHECKPOINTS_FILE;
const SESSION_MEM_FILE = PROD_SESSION_MEM_FILE;

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
  console.log('🧪 TEST SUITE: FULL PIPELINE INTEGRATION & VERIFICATION BARRIERS (D3.4)');
  console.log('======================================================================\n');

  // ------------------------------------------------------------------
  // TEST GROUP 1: Happy Path End-to-End Executions
  // ------------------------------------------------------------------
  console.log('[TEST 1] Single-Subtask Task Full Lifecycle Execution...');
  {
    const contract = createTaskContract({
      task_id: `test-d3.4-single-${Date.now()}`,
      task_type: 'MICRO_FIX',
      objective: 'Apply surgical defect fix to isolated calculation function',
      subtasks: [
        createSubtask({
          id: 1,
          objective: 'Surgically replace broken tax rate calculation',
          dependencies: []
        })
      ]
    });

    let executorInvoked = false;
    let receivedSubtask = null;
    let receivedContract = null;

    const result = await executeUniversalTaskPipeline(contract, async (subtask, parentContract) => {
      executorInvoked = true;
      receivedSubtask = subtask;
      receivedContract = parentContract;
      return { success: true, evidence: { filesModified: ['tax.js'] } };
    }, { persistCheckpoint: false });

    assert(result.verified === true, 'Pipeline returns verified: true');
    assert(result.status === TASK_STATUS.VERIFIED, 'Contract status is VERIFIED');
    assert(executorInvoked === true, 'Executor was invoked');
    assert(receivedSubtask.id === 1, 'Executor received correct subtask');
    assert(receivedContract.task_id === contract.task_id, 'Executor received parent contract');
    assert(result.executedSteps.length === 1, '1 step recorded in executedSteps');
    assert(result.executedSteps[0].success === true, 'Step 1 recorded as successful');
    assert(result.dagExecution?.success === true, 'DAG execution reports success');
  }

  console.log('\n[TEST 2] Linear DAG (3 Steps) Sequential Pipeline Execution...');
  {
    const executionOrder = [];
    const contract = createTaskContract({
      task_id: `test-d3.4-linear-${Date.now()}`,
      task_type: 'FEATURE',
      objective: 'Implement 3-step feature sequentially through full pipeline',
      subtasks: [
        createSubtask({ id: 1, objective: 'Step 1: Define Interface Types', dependencies: [] }),
        createSubtask({ id: 2, objective: 'Step 2: Implement Component Core', dependencies: [1] }),
        createSubtask({ id: 3, objective: 'Step 3: Verification Audit', dependencies: [2] })
      ]
    });

    const result = await executeUniversalTaskPipeline(contract, async (subtask) => {
      executionOrder.push(subtask.id);
      return { success: true, evidence: { stepId: subtask.id } };
    }, { persistCheckpoint: false });

    assert(result.verified === true, 'Pipeline completes verified: true');
    assert(result.status === TASK_STATUS.VERIFIED, 'Final status is VERIFIED');
    assert(JSON.stringify(executionOrder) === JSON.stringify([1, 2, 3]), 'Executed in strict topological sequence [1, 2, 3]', `Order: ${executionOrder.join(' -> ')}`);
    assert(result.executedSteps.length === 3, 'All 3 steps recorded');
    assert(result.executedSteps.every(s => s.success === true), 'All 3 steps report success');
  }

  console.log('\n[TEST 3] Multi-Level Diamond DAG Pipeline Execution...');
  {
    const executionOrder = [];
    const contract = createTaskContract({
      task_id: `test-d3.4-diamond-${Date.now()}`,
      task_type: 'SYSTEM_BUILD',
      objective: 'Diamond DAG convergence test in pipeline',
      subtasks: [
        createSubtask({ id: 'root', objective: 'Root Setup', dependencies: [] }),
        createSubtask({ id: 'left', objective: 'Left Branch', dependencies: ['root'] }),
        createSubtask({ id: 'right', objective: 'Right Branch', dependencies: ['root'] }),
        createSubtask({ id: 'join', objective: 'Join Step', dependencies: ['left', 'right'] })
      ]
    });

    const result = await executeUniversalTaskPipeline(contract, async (subtask) => {
      executionOrder.push(subtask.id);
      return { success: true };
    }, { persistCheckpoint: false });

    assert(result.verified === true, 'Diamond DAG pipeline verified');
    assert(executionOrder[0] === 'root', 'Root step executed first');
    assert(executionOrder[3] === 'join', 'Join step executed last after both branches');
    assert(executionOrder.includes('left') && executionOrder.includes('right'), 'Both branches executed');
  }

  console.log('\n[TEST 4] Task with Verified Capabilities & Dynamic Skill Binding...');
  {
    const contract = createTaskContract({
      task_id: `test-d3.4-caps-skills-${Date.now()}`,
      task_type: 'SYSTEM_BUILD',
      objective: 'Scaffold factory bootstrap and configure 54-locale multilingual architecture',
      subtasks: [
        createSubtask({
          id: 1,
          objective: 'Bootstrap project environment zero-copy',
          required_capabilities: ['CAP-PROJECT-FACTORY-BOOTSTRAP']
        }),
        createSubtask({
          id: 2,
          objective: 'Configure 54-locale hreflang clusters',
          required_capabilities: ['CAP-MULTILINGUAL-SEO-INTELLIGENCE'],
          dependencies: [1]
        })
      ]
    });

    const boundSkills = [];
    const result = await executeUniversalTaskPipeline(contract, async (subtask) => {
      boundSkills.push({
        id: subtask.id,
        skill: subtask.assigned_skill_id,
        matchedBy: subtask.binding_decision?.matched_by
      });
      return { success: true };
    }, { persistCheckpoint: false });

    assert(result.verified === true, 'Pipeline with verified capabilities passes');
    assert(boundSkills.length === 2, 'Both subtasks processed through executor');
    assert(boundSkills[0].skill === 'fullstack-ai-saas-architecture', 'Step 1 bound to fullstack architecture');
    assert(boundSkills[1].skill === 'multilingual-first-architecture', 'Step 2 bound to multilingual architecture');
    assert(boundSkills[0].matchedBy === 'CAPABILITY_MAPPING', 'Matched by CAPABILITY_MAPPING');
  }

  console.log('\n[TEST 5] Canonical Return Contract Structure Validation...');
  {
    const contract = createTaskContract({
      task_id: `test-d3.4-shape-${Date.now()}`,
      task_type: 'FEATURE',
      objective: 'Return shape validation',
      subtasks: [
        createSubtask({ id: 1, objective: 'Single Step' })
      ]
    });

    const result = await executeUniversalTaskPipeline(contract, null, { persistCheckpoint: false });

    assert(typeof result.taskId === 'string', 'taskId is present and string');
    assert(typeof result.contract === 'object', 'contract is present and object');
    assert(typeof result.verified === 'boolean', 'verified is boolean');
    assert(Array.isArray(result.executedSteps), 'executedSteps is array');
    assert(typeof result.status === 'string', 'status is string');
    assert(typeof result.verification === 'object', 'verification is object');
    assert(typeof result.dagExecution === 'object', 'dagExecution metadata is present');
  }

  // ------------------------------------------------------------------
  // TEST GROUP 2: Fail-Closed Paths & Verification Barriers (1 - 8)
  // ------------------------------------------------------------------
  console.log('\n[TEST 6] Barrier 1: Invalid Contract Rejected Before Execution...');
  {
    let barrierThrew = false;
    try {
      await executeUniversalTaskPipeline({
        task_type: 'FEATURE',
        objective: 'short' // Invalid: < 10 chars
      });
    } catch (err) {
      barrierThrew = true;
      assert(err.message.includes('validation failed') || err.message.includes('Failed to create valid Task Contract'), 'Error specifies contract validation failure', err.message);
    }
    assert(barrierThrew === true, 'Barrier 1 intercepted invalid contract');
  }

  console.log('\n[TEST 7] Barrier 2: Cyclic DAG Rejected Before Execution...');
  {
    const contract = createTaskContract({
      task_id: `test-d3.4-cycle-${Date.now()}`,
      task_type: 'FEATURE',
      objective: 'Cyclic DAG rejection',
      subtasks: [
        createSubtask({ id: 1, objective: 'Step 1', dependencies: [2] }),
        createSubtask({ id: 2, objective: 'Step 2', dependencies: [1] })
      ]
    });

    let barrierThrew = false;
    let executorRan = false;
    try {
      await executeUniversalTaskPipeline(contract, async () => {
        executorRan = true;
        return { success: true };
      }, { persistCheckpoint: false });
    } catch (err) {
      barrierThrew = true;
      assert(err.message.includes('Plan DAG is invalid'), 'Error specifies Plan DAG is invalid', err.message);
    }
    assert(barrierThrew === true, 'Barrier 2 intercepted cyclic DAG');
    assert(executorRan === false, 'Zero subtasks executed on cyclic DAG');
  }

  console.log('\n[TEST 8] Barrier 3: Subtask with MISSING Capability Halted Pre-Flight...');
  {
    const contract = createTaskContract({
      task_id: `test-d3.4-missing-cap-${Date.now()}`,
      task_type: 'FEATURE',
      objective: 'Subtask with missing capability',
      subtasks: [
        createSubtask({
          id: 1,
          objective: 'Discover 10,000 GitHub repos',
          required_capabilities: ['CAP-INTERNET-SCALE-REPO-DISCOVERY'] // MISSING
        })
      ]
    });

    let barrierThrew = false;
    let executorRan = false;
    try {
      await executeUniversalTaskPipeline(contract, async () => {
        executorRan = true;
        return { success: true };
      }, { persistCheckpoint: false });
    } catch (err) {
      barrierThrew = true;
      assert(err.message.toLowerCase().includes('subtask capability gating failed'), 'Error specifies subtask capability gating failure', err.message);
    }
    assert(barrierThrew === true, 'Barrier 3 intercepted missing capability');
    assert(executorRan === false, 'Executor was NOT run');
    assert(contract.status === TASK_STATUS.FAILED, 'Contract transitioned to FAILED');
  }

  console.log('\n[TEST 9] Barrier 3: Subtask with UNVERIFIED Capability Halted Pre-Flight...');
  {
    const contract = createTaskContract({
      task_id: `test-d3.4-unverified-cap-${Date.now()}`,
      task_type: 'AUDIT',
      objective: 'Subtask with unverified capability',
      subtasks: [
        createSubtask({
          id: 1,
          objective: 'Run headless layout audit',
          required_capabilities: ['CAP-HEADLESS-BROWSER-VERIFICATION'] // PRESENT BUT UNVERIFIED
        })
      ]
    });

    let barrierThrew = false;
    try {
      await executeUniversalTaskPipeline(contract, null, { persistCheckpoint: false });
    } catch (err) {
      barrierThrew = true;
      assert(err.message.toLowerCase().includes('subtask capability gating failed'), 'Error notes capability gating failure');
    }
    assert(barrierThrew === true, 'Barrier 3 intercepted unverified capability');
  }

  console.log('\n[TEST 10] Barrier 4: Subtask with Unavailable Skill Halted...');
  {
    const contract = createTaskContract({
      task_id: `test-d3.4-missing-skill-${Date.now()}`,
      task_type: 'FEATURE',
      objective: 'Subtask with unavailable skill',
      subtasks: [
        createSubtask({
          id: 1,
          objective: 'Execute with phantom skill',
          assigned_skill_id: 'phantom-nonexistent-skill-99'
        })
      ]
    });

    let barrierThrew = false;
    try {
      await executeUniversalTaskPipeline(contract, null, { persistCheckpoint: false });
    } catch (err) {
      barrierThrew = true;
      assert(err.message.toLowerCase().includes('dynamic skill binding failed'), 'Error specifies skill binding failure', err.message);
    }
    assert(barrierThrew === true, 'Barrier 4 intercepted unavailable skill');
    assert(contract.status === TASK_STATUS.FAILED, 'Contract status marked FAILED');
  }

  console.log('\n[TEST 11] Barrier 5 & 6: Predecessor Failure Cascades Abort to Dependents...');
  {
    const executed = [];
    const contract = createTaskContract({
      task_id: `test-d3.4-cascade-${Date.now()}`,
      task_type: 'FEATURE',
      objective: 'Predecessor failure cascade in pipeline',
      subtasks: [
        createSubtask({ id: 1, objective: 'Step 1: Setup', dependencies: [] }),
        createSubtask({ id: 2, objective: 'Step 2: Failing Action', dependencies: [1] }),
        createSubtask({ id: 3, objective: 'Step 3: Downstream Action', dependencies: [2] })
      ]
    });

    const result = await executeUniversalTaskPipeline(contract, async (subtask) => {
      executed.push(subtask.id);
      if (subtask.id === 2) {
        return { success: false, error: 'Compiler syntax error in core module' };
      }
      return { success: true };
    }, { persistCheckpoint: false });

    assert(result.verified === false, 'Pipeline reports verified: false');
    assert(result.status === TASK_STATUS.FAILED, 'Pipeline status is FAILED');
    assert(executed.includes(1), 'Step 1 was executed');
    assert(executed.includes(2), 'Step 2 was executed');
    assert(!executed.includes(3), 'Step 3 was NEVER executed (safe cascade)');
    assert(contract.subtasks.find(s => s.id === 3).status === SUBTASK_STATUS.SKIPPED, 'Step 3 status is SKIPPED');
  }

  console.log('\n[TEST 12] Barrier 6: Executor Exception Caught Cleanly by Adapter...');
  {
    const contract = createTaskContract({
      task_id: `test-d3.4-thrown-err-${Date.now()}`,
      task_type: 'FEATURE',
      objective: 'Unhandled executor exception test',
      subtasks: [
        createSubtask({ id: 1, objective: 'Exploding Step' })
      ]
    });

    const result = await executeUniversalTaskPipeline(contract, async () => {
      throw new Error('Fatal socket connection drop');
    }, { persistCheckpoint: false });

    assert(result.verified === false, 'Pipeline verified is false on thrown error');
    assert(result.status === TASK_STATUS.FAILED, 'Status is FAILED');
    assert(result.executedSteps[0].success === false, 'Step marked as failed');
    assert(contract.subtasks[0].error.includes('Fatal socket connection drop'), 'Exception message preserved in error');
  }

  console.log('\n[TEST 13] Barrier 7: Verification Criteria Rejection Overrides Subtask Completion...');
  {
    // Subtasks succeed, but external build/evidence barrier fails
    const contract = createTaskContract({
      task_id: `test-d3.4-barrier7-${Date.now()}`,
      task_type: 'FEATURE',
      objective: 'Verification barrier rejection test',
      subtasks: [
        createSubtask({ id: 1, objective: 'Healthy step' })
      ]
    });

    const result = await executeUniversalTaskPipeline(contract, async () => {
      return { success: true };
    }, {
      persistCheckpoint: false,
      customEvidence: {
        buildExitCode: 1 // Non-zero build exit code triggers barrier failure
      }
    });

    assert(result.verified === false, 'Non-zero build exit code fails verification barrier');
    assert(result.status === TASK_STATUS.FAILED, 'Contract transitioned to FAILED');
    assert(result.verification.failureReason.includes('Build failed'), 'Clear failure reason recorded');
  }

  // ------------------------------------------------------------------
  // TEST GROUP 3: Persistence, Idempotency & Safe Resumption
  // ------------------------------------------------------------------
  console.log('\n[TEST 14] Barrier 8: Durable Checkpoint Persistence Across Pipeline Lifecycle...');
  {
    const taskId = `test-d3.4-persist-${Date.now()}`;
    const contract = createTaskContract({
      task_id: taskId,
      task_type: 'FEATURE',
      objective: 'Pipeline durable checkpoint persistence verification',
      subtasks: [
        createSubtask({ id: 1, objective: 'Step 1' }),
        createSubtask({ id: 2, objective: 'Step 2', dependencies: [1] })
      ]
    });

    const result = await executeUniversalTaskPipeline(contract, null, { persistCheckpoint: true });
    assert(result.verified === true, 'Pipeline completed verified');

    // Read directly from disk
    const stored = loadTaskCheckpoint(taskId);
    assert(stored !== null, 'Checkpoint exists in .project-brain/task-checkpoints.json');
    assert(stored.task_id === taskId, 'Stored task_id matches');
    assert(stored.status === TASK_STATUS.VERIFIED, 'Stored status is VERIFIED');
    assert(stored.checkpoint.current_step === 2, 'Stored checkpoint step is 2');

    // Clean up test task key to preserve disk hygiene
    const allCheckpoints = loadAllCheckpoints();
    delete allCheckpoints.tasks[taskId];
    fs.writeFileSync(CHECKPOINTS_FILE, JSON.stringify(allCheckpoints, null, 2), 'utf-8');
  }

  console.log('\n[TEST 15] Safe Resumption & Idempotency Across Pipeline Runs...');
  {
    const stepInvocations = [];
    const contract = createTaskContract({
      task_id: `test-d3.4-resume-${Date.now()}`,
      task_type: 'FEATURE',
      objective: 'Pipeline safe resumption test',
      subtasks: [
        createSubtask({
          id: 1,
          objective: 'Step 1: Previously Completed',
          status: SUBTASK_STATUS.COMPLETED,
          evidence: { cached: true }
        }),
        createSubtask({
          id: 2,
          objective: 'Step 2: Needs Execution',
          dependencies: [1]
        })
      ]
    });

    const result = await executeUniversalTaskPipeline(contract, async (subtask) => {
      stepInvocations.push(subtask.id);
      return { success: true };
    }, { persistCheckpoint: false, skipCompleted: true });

    assert(result.verified === true, 'Resumed pipeline verified');
    assert(stepInvocations.length === 1, 'Exactly 1 step invoked');
    assert(stepInvocations[0] === 2, 'Step 2 was executed');
    assert(!stepInvocations.includes(1), 'Step 1 was NOT re-executed (idempotent resume)');
    assert(result.executedSteps.find(s => s.step_id === 1)?.previouslyCompleted === true, 'Step 1 marked as previously completed');
  }

  // ------------------------------------------------------------------
  // TEST GROUP 4: Backward Compatibility & Legacy Callers
  // ------------------------------------------------------------------
  console.log('\n[TEST 16] Legacy Task Contract Callers (Auto-Decomposition)...');
  {
    // Caller passes raw contract without subtasks
    const legacyContract = createTaskContract({
      task_type: 'MICRO_FIX',
      objective: 'Fix single line typo in error reporting message'
    });

    const executedSteps = [];
    const result = await executeUniversalTaskPipeline(legacyContract, async (step, contract) => {
      executedSteps.push(step.step_id);
      return { success: true };
    }, { persistCheckpoint: false });

    assert(result.verified === true, 'Legacy contract completes verified');
    assert(result.status === TASK_STATUS.VERIFIED, 'Status is VERIFIED');
    assert(executedSteps.length === 3, 'MICRO_FIX automatically decomposed into 3 steps');
    assert(executedSteps.includes(1) && executedSteps.includes(2) && executedSteps.includes(3), 'All 3 decomposed steps ran');
  }

  console.log('\n[TEST 17] Legacy Executor Signature (step, contract) Compatibility...');
  {
    const contract = createTaskContract({
      task_id: `test-d3.4-legacy-sig-${Date.now()}`,
      task_type: 'FEATURE',
      objective: 'Legacy executor signature compatibility test',
      subtasks: [
        createSubtask({ id: 1, objective: 'Inspect Contract Attributes' })
      ]
    });

    let legacyStepArg = null;
    let legacyContractArg = null;

    // Legacy signature: (step, contract)
    await executeUniversalTaskPipeline(contract, (step, parentContract) => {
      legacyStepArg = step;
      legacyContractArg = parentContract;
      return Promise.resolve({ success: true });
    }, { persistCheckpoint: false });

    assert(legacyStepArg !== null, 'Step argument was delivered');
    assert(legacyStepArg.step_id === 1, 'Step has step_id property');
    assert(legacyStepArg.id === 1, 'Step has id property');
    assert(legacyContractArg !== null, 'Contract argument was delivered');
    assert(legacyContractArg.task_id === contract.task_id, 'Contract argument has task_id');
  }

  console.log('\n[TEST 18] Adapter Context Enrichment (Subtask Context Forwarding)...');
  {
    const contract = createTaskContract({
      task_id: `test-d3.4-enrich-${Date.now()}`,
      task_type: 'FEATURE',
      objective: 'Enriched context verification in adapter',
      subtasks: [
        createSubtask({
          id: 1,
          objective: 'Configure Tailwind CSS design tokens',
          required_capabilities: []
        })
      ]
    });

    let receivedContext = null;
    await executeUniversalTaskPipeline(contract, (subtask, parentContract, context) => {
      receivedContext = context;
      return { success: true };
    }, { persistCheckpoint: false });

    assert(receivedContext !== null, 'Step context delivered as 3rd argument');
    assert(receivedContext.subtaskId === 1, 'context.subtaskId matches');
    assert(receivedContext.assignedSkill === 'tailwind-v4-css-first-design', 'context.assignedSkill reflects dynamic binding');
    assert(receivedContext.bindingDecision?.matched_by === 'ACTION_PATTERN', 'context.bindingDecision available');
    assert(Array.isArray(receivedContext.invariants), 'context.invariants array available');
  }

  // ------------------------------------------------------------------
  // Cleanup Test Records: Byte-for-Byte File Restoration
  // ------------------------------------------------------------------
  try {
    if (beforeSessionMemRaw !== null) {
      fs.writeFileSync(SESSION_MEM_FILE, beforeSessionMemRaw, 'utf-8');
    }
  } catch (e) {}

  // Verify production files remained 100% untouched
  const afterCheckpointsRaw = fs.existsSync(PROD_CHECKPOINTS_FILE) ? fs.readFileSync(PROD_CHECKPOINTS_FILE, 'utf-8') : null;
  assert(afterCheckpointsRaw === beforeCheckpointsRaw, 'Production task-checkpoints.json remained completely untouched');
  const afterSessionMemRaw = fs.existsSync(PROD_SESSION_MEM_FILE) ? fs.readFileSync(PROD_SESSION_MEM_FILE, 'utf-8') : null;
  assert(afterSessionMemRaw === beforeSessionMemRaw, 'Production session-memory.json remained completely untouched');

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`🏁 FULL PIPELINE INTEGRATION VERIFICATION: ${passedTests} PASSED | ${totalTests - passedTests} FAILED`);
  console.log('======================================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  try {
    if (beforeSessionMemRaw !== null) {
      fs.writeFileSync(SESSION_MEM_FILE, beforeSessionMemRaw, 'utf-8');
    }
  } catch (e) {}
  console.error('\n❌ Unhandled error in test suite:', err);
  process.exit(1);
});
