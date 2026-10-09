/**
 * Automated Verification Suite for Executable Skill Runner & Task Planning DAG Engine (Milestone 3)
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-skill-planner.mjs
 * Purpose: Verifies Milestone 3: Skill registry discovery, skill invariant extraction,
 *          task DAG generation, circular dependency prevention, and step advancement.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createTaskContract } from './task-contract.mjs';
import { 
  listRegisteredSkills, 
  getSkillDefinition, 
  bindSkillToTask 
} from './skill-runner.mjs';
import { 
  validatePlanDAG, 
  planTaskDecomposition, 
  getNextExecutableSteps, 
  advanceStep 
} from './task-planner.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');
const CHECKPOINTS_FILE = path.join(BRAIN_ROOT, '.project-brain', 'task-checkpoints.json');

console.log('======================================================================');
console.log('🧪 TEST SUITE: SKILL RUNNER & TASK PLANNING DAG ENGINE (MILESTONE 3)');
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
// TEST 1: Skill Registry Discovery & Categorization
// ---------------------------------------------------------------------------
console.log('[TEST 1] Discovering Registered Skills in 03_SKILLS/...');

const skills = listRegisteredSkills();
assert(skills.length >= 15, 'Discovered registered skills', `Total: ${skills.length} skills`);

const tailwindSkill = skills.find(s => s.skill_id.includes('tailwind'));
assert(tailwindSkill !== undefined, 'Tailwind skill present', tailwindSkill?.title);
assert(tailwindSkill?.category === 'FRONTEND_DESIGN', 'Tailwind categorized as FRONTEND_DESIGN');

const multilingualSkill = skills.find(s => s.skill_id.includes('multilingual'));
assert(multilingualSkill !== undefined, 'Multilingual skill present', multilingualSkill?.title);

// ---------------------------------------------------------------------------
// TEST 2: Parsing Executable Skill Specifications
// ---------------------------------------------------------------------------
console.log('\n[TEST 2] Parsing Skill Invariants & Verification Probes...');

const skillDef = getSkillDefinition('tailwind-v4-css-first-design');
assert(skillDef !== null, 'Parsed tailwind-v4-css-first-design definition');
assert(skillDef.invariants.length > 0, 'Invariants extracted from markdown', `Count: ${skillDef.invariants.length}`);
assert(skillDef.verification_probes.length > 0, 'Verification probes extracted', `Probes: ${skillDef.verification_probes.join(', ')}`);

// Nonexistent skill handling
const nullSkill = getSkillDefinition('nonexistent-ghost-skill');
assert(nullSkill === null, 'Nonexistent skill returns null gracefully');

// ---------------------------------------------------------------------------
// TEST 3: Binding Skill to Task Contract
// ---------------------------------------------------------------------------
console.log('\n[TEST 3] Binding Skill to Task Contract...');

const contract = createTaskContract({
  task_type: 'FEATURE',
  objective: 'Build responsive pricing table using Tailwind CSS v4'
});

bindSkillToTask(contract, 'tailwind-v4-css-first-design');
assert(contract.context.applicable_skills.some(s => s.includes('tailwind')), 'Skill attached to contract context');
assert(contract.constraints.negative_constraints.some(c => c.includes('Tailwind')), 'Skill invariants injected into negative constraints');
assert(contract.execution_plan.length > 0, 'Skill generated initial execution plan steps', `Steps: ${contract.execution_plan.length}`);

// ---------------------------------------------------------------------------
// TEST 4: DAG Validation & Cycle Detection
// ---------------------------------------------------------------------------
console.log('\n[TEST 4] Testing Plan DAG Validation & Cycle Detection...');

// Case A: Valid Linear DAG
const validLinearDAG = [
  { step_id: 1, action: 'A', depends_on: [] },
  { step_id: 2, action: 'B', depends_on: [1] },
  { step_id: 3, action: 'C', depends_on: [2] }
];
const valA = validatePlanDAG(validLinearDAG);
assert(valA.valid === true, 'Valid linear DAG passes validation');

// Case B: Valid Branched DAG (1 -> 2, 1 -> 3, [2, 3] -> 4)
const validBranchedDAG = [
  { step_id: 1, action: 'Init', depends_on: [] },
  { step_id: 2, action: 'Backend', depends_on: [1] },
  { step_id: 3, action: 'Frontend', depends_on: [1] },
  { step_id: 4, action: 'Integration', depends_on: [2, 3] }
];
const valB = validatePlanDAG(validBranchedDAG);
assert(valB.valid === true, 'Valid branched DAG passes validation');

// Case C: Self-Cycle (1 depends on 1)
const selfCycle = [
  { step_id: 1, action: 'Self', depends_on: [1] }
];
const valC = validatePlanDAG(selfCycle);
assert(valC.valid === false, 'Self-cycle is rejected by DAG validator');

// Case D: Circular Dependency (1 -> 2 -> 3 -> 1)
const circularDAG = [
  { step_id: 1, action: 'A', depends_on: [3] },
  { step_id: 2, action: 'B', depends_on: [1] },
  { step_id: 3, action: 'C', depends_on: [2] }
];
const valD = validatePlanDAG(circularDAG);
assert(valD.valid === false, 'Circular cycle (1->2->3->1) is caught and rejected');

// ---------------------------------------------------------------------------
// TEST 5: Automatic Complexity-Aware Task Planning
// ---------------------------------------------------------------------------
console.log('\n[TEST 5] Testing Automatic Complexity-Aware Task Planning...');

// Micro-Fix: 3 steps Fast Path
const microContract = createTaskContract({
  task_type: 'MICRO_FIX',
  objective: 'Fix button hover color contrast in dark mode'
});
planTaskDecomposition(microContract);
assert(microContract.execution_plan.length === 3, 'MICRO_FIX decomposed into 3 Fast Path steps');
assert(microContract.execution_plan[0].title.includes('Pinpoint Defect'), 'Step 1 is Pinpoint Defect');
assert(validatePlanDAG(microContract.execution_plan).valid === true, 'Micro plan is valid DAG');

// Feature: 4 steps Standard Path
const featureContract = createTaskContract({
  task_type: 'FEATURE',
  objective: 'Add form validation to newsletter signup'
});
planTaskDecomposition(featureContract);
assert(featureContract.execution_plan.length === 4, 'FEATURE decomposed into 4 Standard Path steps');
assert(validatePlanDAG(featureContract.execution_plan).valid === true, 'Feature plan is valid DAG');

// System Build: 5 steps Engineered Path
const systemContract = createTaskContract({
  task_type: 'SYSTEM_BUILD',
  objective: 'Build complete multilingual micro-tool portal with Astro & Tailwind'
});
planTaskDecomposition(systemContract);
assert(systemContract.execution_plan.length === 5, 'SYSTEM_BUILD decomposed into 5 Engineered Path steps');
assert(validatePlanDAG(systemContract.execution_plan).valid === true, 'System plan is valid DAG');

// ---------------------------------------------------------------------------
// TEST 6: Step Dependency Progression & Step Advancement
// ---------------------------------------------------------------------------
console.log('\n[TEST 6] Testing Step Progression & Dependency Gating...');

// Initial state: Step 1 should be executable, Step 2 & 3 blocked
const initialExecutable = getNextExecutableSteps(microContract);
assert(initialExecutable.length === 1 && initialExecutable[0].step_id === 1, 
  'Initially only Step 1 is executable (dependencies satisfied)');

// Advance Step 1
const advance1 = advanceStep(microContract, 1, { success: true, lineFound: 42 });
assert(advance1.success === true, 'Step 1 advanced successfully');
assert(advance1.nextExecutable.length === 1 && advance1.nextExecutable[0].step_id === 2, 
  'Advancing Step 1 automatically unlocked Step 2');

// Advance Step 2
const advance2 = advanceStep(microContract, 2, { success: true, patchApplied: true });
assert(advance2.nextExecutable.length === 1 && advance2.nextExecutable[0].step_id === 3, 
  'Advancing Step 2 automatically unlocked Step 3');

// Advance Step 3 (Final step)
const advance3 = advanceStep(microContract, 3, { success: true, buildOutput: 'exit 0' });
assert(advance3.allStepsCompleted === true, 'All steps flagged completed upon Step 3 resolution');
assert(microContract.checkpoint.current_step === 3, 'Checkpoint reflects step 3');

// ---------------------------------------------------------------------------
// CLEANUP TEST RECORDS
// ---------------------------------------------------------------------------
try {
  const db = JSON.parse(fs.readFileSync(CHECKPOINTS_FILE, 'utf-8'));
  delete db.tasks[microContract.task_id];
  delete db.tasks[featureContract.task_id];
  delete db.tasks[systemContract.task_id];
  delete db.tasks[contract.task_id];
  fs.writeFileSync(CHECKPOINTS_FILE, JSON.stringify(db, null, 2), 'utf-8');
} catch (e) {}

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`🏁 SKILL RUNNER & TASK PLANNER VERIFICATION: ${passedTests} PASSED | ${failedTests} FAILED`);
console.log('======================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
