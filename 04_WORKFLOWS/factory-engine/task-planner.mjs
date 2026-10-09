/**
 * Universal Task Planning & DAG Decomposition Engine
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\task-planner.mjs
 * Purpose: Decomposes tasks into Directed Acyclic Graph (DAG) execution plans
 *          with step-level dependencies, verification probes, and progression tracking.
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import { recordTaskCheckpoint } from './brain-connector.mjs';

/**
 * Validates that an array of execution plan steps forms a valid Directed Acyclic Graph (DAG)
 * 
 * @param {Array<object>} steps - Array of steps with step_id and depends_on
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validatePlanDAG(steps) {
  const errors = [];
  if (!Array.isArray(steps) || steps.length === 0) {
    return { valid: false, errors: ['Execution plan must contain at least one step.'] };
  }

  const stepIds = new Set();
  const graph = new Map(); // step_id -> Array of dependency IDs
  const inDegree = new Map();

  for (const step of steps) {
    if (!step.step_id || typeof step.step_id !== 'number') {
      errors.push(`Step missing valid numeric step_id: ${JSON.stringify(step)}`);
      continue;
    }
    if (stepIds.has(step.step_id)) {
      errors.push(`Duplicate step_id detected: ${step.step_id}`);
    }
    stepIds.add(step.step_id);
    graph.set(step.step_id, Array.isArray(step.depends_on) ? step.depends_on : []);
    inDegree.set(step.step_id, 0);
  }

  // Validate dependencies exist
  for (const [id, deps] of graph.entries()) {
    for (const depId of deps) {
      if (!stepIds.has(depId)) {
        errors.push(`Step ${id} depends on nonexistent step_id: ${depId}`);
      }
      if (depId === id) {
        errors.push(`Step ${id} cannot depend on itself (self-cycle).`);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Circular dependency check using Kahn's algorithm (Topological sort)
  // Build reverse adjacency list: dep -> steps that depend on it
  const adj = new Map();
  for (const id of stepIds) adj.set(id, []);

  for (const [id, deps] of graph.entries()) {
    for (const depId of deps) {
      adj.get(depId).push(id);
      inDegree.set(id, inDegree.get(id) + 1);
    }
  }

  const queue = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  let visitedCount = 0;
  while (queue.length > 0) {
    const current = queue.shift();
    visitedCount++;

    for (const neighbor of adj.get(current)) {
      inDegree.set(neighbor, inDegree.get(neighbor) - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (visitedCount !== stepIds.size) {
    errors.push('Circular dependency cycle detected in plan DAG.');
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

/**
 * Automatically decomposes a Task Contract into a verified DAG execution plan
 * 
 * @param {object} contract - The task contract
 * @returns {object} Updated contract with generated DAG plan
 */
export function planTaskDecomposition(contract) {
  const taskType = contract.task_type || 'FEATURE';
  const steps = [];

  switch (taskType) {
    case 'MICRO_FIX':
      // ⚡ Fast Path: 3 Steps (< 300 Tokens)
      steps.push(
        {
          step_id: 1,
          title: 'Pinpoint Defect & Root Cause',
          action: 'Inspect target file, locate defective line, and identify invariant violation without touching surrounding code.',
          depends_on: [],
          verification_probe: 'file_exists_and_line_located',
          status: 'PENDING'
        },
        {
          step_id: 2,
          title: 'Apply Surgical Non-Destructive Patch',
          action: 'Apply minimal replace_file_content edit. Preserve all domain math, responsive geometry, and existing contracts.',
          depends_on: [1],
          verification_probe: 'syntax_lint_pass',
          status: 'PENDING'
        },
        {
          step_id: 3,
          title: 'Live Runtime & Anti-Regression Verification',
          action: 'Execute test suite or live build. Confirm fix works and zero adjacent features are broken.',
          depends_on: [2],
          verification_probe: 'npm test || npm run build',
          status: 'PENDING'
        }
      );
      break;

    case 'FEATURE':
      // 🛠️ Standard Path: 4 Steps
      steps.push(
        {
          step_id: 1,
          title: 'Resolve Contract & Schema',
          action: 'Define component props, types, and error boundaries before implementation.',
          depends_on: [],
          verification_probe: 'type_check_or_schema_valid',
          status: 'PENDING'
        },
        {
          step_id: 2,
          title: 'Implement Isolated Core Feature',
          action: 'Build component or module adhering to verified Brain engineering rules and design tokens.',
          depends_on: [1],
          verification_probe: 'component_unit_test',
          status: 'PENDING'
        },
        {
          step_id: 3,
          title: 'Wire System Integrations',
          action: 'Connect component to state stores, routes, or APIs without breaking existing contracts.',
          depends_on: [2],
          verification_probe: 'integration_probe',
          status: 'PENDING'
        },
        {
          step_id: 4,
          title: 'Live Build & Multi-Viewport Verification',
          action: 'Run production build (exit 0) and verify visual responsiveness and theme contrast.',
          depends_on: [3],
          verification_probe: 'npm run build',
          status: 'PENDING'
        }
      );
      break;

    case 'SYSTEM_BUILD':
      // 🏗️ Engineered Path: 5 Steps
      steps.push(
        {
          step_id: 1,
          title: 'Environment & Infrastructure Initialization',
          action: 'Execute pre-flight checks, verify runtimes, and establish zero-copy Brain connection.',
          depends_on: [],
          verification_probe: 'node -v && git status',
          status: 'PENDING'
        },
        {
          step_id: 2,
          title: 'Multi-Page Architecture Scaffolding',
          action: 'Scaffold MPA routes, layouts, design tokens (Tailwind v4 CSS-first), and header/footer navigation.',
          depends_on: [1],
          verification_probe: 'astro build || npm run build',
          status: 'PENDING'
        },
        {
          step_id: 3,
          title: 'Subsystem & Dedicated Tools Implementation',
          action: 'Build individual tool pages, calculators, or catalogs on dedicated static URLs.',
          depends_on: [2],
          verification_probe: 'route_crawl_200_ok',
          status: 'PENDING'
        },
        {
          step_id: 4,
          title: 'Multilingual & SEO Completeness Verification',
          action: 'Verify self-canonicals, reciprocal hreflang alternate clusters, sitemap inclusion, and mobile drawer.',
          depends_on: [3],
          verification_probe: 'language_completeness_gate',
          status: 'PENDING'
        },
        {
          step_id: 5,
          title: 'Production Readiness Certification Gate',
          action: 'Execute full audit suite and generate verified production certificate.',
          depends_on: [4],
          verification_probe: 'audit_exit_0',
          status: 'PENDING'
        }
      );
      break;

    case 'AUDIT':
      steps.push(
        {
          step_id: 1,
          title: 'Map System Boundaries & Attack Surfaces',
          action: 'Catalog exposed endpoints, input deserialization thresholds, and environment configs.',
          depends_on: [],
          verification_probe: 'boundary_manifest_generated',
          status: 'PENDING'
        },
        {
          step_id: 2,
          title: 'Execute Verification Matrix Probes',
          action: 'Run automated checks across memory leaks, rate limits, TOCTOU race conditions, and CRLF traps.',
          depends_on: [1],
          verification_probe: 'security_matrix_probe',
          status: 'PENDING'
        },
        {
          step_id: 3,
          title: 'Issue Forensic Audit Report & Mitigation Plan',
          action: 'Formulate concrete invariant patches for all uncovered defects.',
          depends_on: [2],
          verification_probe: 'report_persisted',
          status: 'PENDING'
        }
      );
      break;

    default:
      steps.push(
        {
          step_id: 1,
          title: 'Execute Task Implementation',
          action: contract.objective,
          depends_on: [],
          verification_probe: 'npm run build',
          status: 'PENDING'
        }
      );
      break;
  }

  const dagCheck = validatePlanDAG(steps);
  if (!dagCheck.valid) {
    throw new Error(`Generated plan is an invalid DAG:\n- ${dagCheck.errors.join('\n- ')}`);
  }

  contract.execution_plan = steps;
  contract.checkpoint.total_steps = steps.length;
  contract.checkpoint.current_step = 0;

  return contract;
}

/**
 * Returns all steps in the plan that are ready to execute (all dependencies satisfied)
 * 
 * @param {object} contract - The task contract
 * @returns {Array<object>} Executable steps
 */
export function getNextExecutableSteps(contract) {
  if (!contract.execution_plan || contract.execution_plan.length === 0) {
    return [];
  }

  const completedStepIds = new Set(
    contract.execution_plan
      .filter(s => s.status === 'COMPLETED')
      .map(s => s.step_id)
  );

  return contract.execution_plan.filter(step => {
    if (step.status !== 'PENDING') return false;
    // Check if every dependency is in completedStepIds
    return step.depends_on.every(depId => completedStepIds.has(depId));
  });
}

/**
 * Advances a step in the execution plan upon verified evidence
 * 
 * @param {object} contract - The task contract
 * @param {number} stepId - The ID of the step to advance
 * @param {object} stepEvidence - Evidence proving step completion
 * @returns {object} { success: boolean, advancedStep: object, nextExecutable: Array<object> }
 */
export function advanceStep(contract, stepId, stepEvidence = {}) {
  const step = contract.execution_plan.find(s => s.step_id === stepId);
  if (!step) {
    throw new Error(`Step ID ${stepId} not found in execution plan.`);
  }

  const success = stepEvidence.success !== false;
  step.status = success ? 'COMPLETED' : 'FAILED';
  step.completed_at = success ? new Date().toISOString() : null;
  step.evidence = stepEvidence;

  if (success) {
    contract.checkpoint.current_step = stepId;
  }

  // Update checkpoint in durable storage
  recordTaskCheckpoint(contract, stepId, {
    lastStepAdvanced: stepId,
    stepStatus: step.status
  });

  const nextExecutable = getNextExecutableSteps(contract);

  return {
    success,
    advancedStep: step,
    nextExecutable,
    allStepsCompleted: contract.execution_plan.every(s => s.status === 'COMPLETED')
  };
}
