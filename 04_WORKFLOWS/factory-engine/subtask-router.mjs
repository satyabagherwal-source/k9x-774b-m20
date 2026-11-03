/**
 * Capability-to-Subtask Routing & Subtask Readiness Gating Engine (Milestone D3.2)
 *
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\subtask-router.mjs
 * Purpose: Resolves subtask capability requirements against the canonical Capability Registry,
 *          determines eligibility, evaluates readiness status (READY, BLOCKED, INVALID),
 *          and provides deterministic, fail-closed diagnostics without executing subtasks.
 *
 * Zero external dependencies. Native Node.js ES Module.
 */

import {
  checkCapabilityReadiness,
  getCapabilityById,
  loadRegistry,
  ELIGIBLE_CAPABILITY_STATUSES
} from './capability-registry.mjs';
import {
  validateSubtask,
  SUBTASK_STATUS,
  CAPABILITY_ID_REGEX
} from './task-contract.mjs';

/**
 * Logical outcomes for subtask capability readiness gating
 */
export const SUBTASK_READINESS_STATUS = {
  READY: 'READY',
  BLOCKED: 'BLOCKED',
  INVALID: 'INVALID'
};

/**
 * Deterministically routes a subtask's capability requirements against the canonical registry
 * and returns detailed eligibility, satisfaction, and blocking diagnostics.
 *
 * @param {object} subtask - Subtask object adhering to DecomposedSubtask schema
 * @param {object} options - Configuration options (registry, registryPath, validationContext)
 * @returns {object} Detailed subtask routing and readiness result
 */
export function routeSubtaskCapabilities(subtask, options = {}) {
  // 1. Validate subtask contract shape and invariants
  const validation = validateSubtask(subtask, options.validationContext || {});
  const rawId = subtask?.id !== undefined ? subtask.id : (subtask?.subtask_id !== undefined ? subtask.subtask_id : subtask?.step_id);
  const subtaskId = rawId !== undefined && rawId !== null ? rawId : 'unknown';

  if (!validation.valid) {
    return {
      subtaskId,
      status: SUBTASK_READINESS_STATUS.INVALID,
      ready: false,
      eligible: false,
      totalRequired: 0,
      satisfiedCount: 0,
      failedCount: 0,
      requiredCapabilities: Array.isArray(subtask?.required_capabilities) ? subtask.required_capabilities : [],
      routedCapabilities: [],
      failures: validation.errors.map(e => `Subtask '${subtaskId}' contract invalid: ${e}`),
      failureReason: `Subtask '${subtaskId}' failed contract validation: ${validation.errors.join('; ')}`,
      error: 'SUBTASK_CONTRACT_INVALID'
    };
  }

  const reqCaps = subtask.required_capabilities;

  // 2. Base case: No specialized capabilities required (empty array or omitted)
  // Rule: An empty requirement list means base runtime execution only; subtask is capability-ready.
  if (!reqCaps || reqCaps.length === 0) {
    return {
      subtaskId,
      status: SUBTASK_READINESS_STATUS.READY,
      ready: true,
      eligible: true,
      totalRequired: 0,
      satisfiedCount: 0,
      failedCount: 0,
      requiredCapabilities: [],
      routedCapabilities: [],
      failures: [],
      failureReason: null,
      error: null
    };
  }

  // 3. Resolve required capabilities against canonical Capability Registry
  // Uses checkCapabilityReadiness to guarantee strict status eligibility ('VERIFIED WORKING')
  const effectiveOpts = {
    ...options,
    customRegistryPath: options.customRegistryPath || options.registryPath
  };
  const gating = checkCapabilityReadiness(reqCaps, effectiveOpts);

  if (gating.ready) {
    return {
      subtaskId,
      status: SUBTASK_READINESS_STATUS.READY,
      ready: true,
      eligible: true,
      totalRequired: gating.totalRequired,
      satisfiedCount: gating.satisfiedCount,
      failedCount: 0,
      requiredCapabilities: [...reqCaps],
      routedCapabilities: gating.capabilities,
      failures: [],
      failureReason: null,
      error: null
    };
  } else {
    const formattedFailures = gating.failures.map(f => `Subtask '${subtaskId}' requirement blocked: ${f}`);
    return {
      subtaskId,
      status: SUBTASK_READINESS_STATUS.BLOCKED,
      ready: false,
      eligible: false,
      totalRequired: gating.totalRequired,
      satisfiedCount: gating.satisfiedCount,
      failedCount: gating.failedCount,
      requiredCapabilities: [...reqCaps],
      routedCapabilities: gating.capabilities,
      failures: formattedFailures,
      failureReason: `Subtask '${subtaskId}' blocked by capability gating: ${gating.failureReason}`,
      error: gating.error || 'CAPABILITY_GATING_BLOCKED'
    };
  }
}

/**
 * Evaluates readiness for a single subtask and optionally updates subtask state
 *
 * @param {object} subtask - Subtask object
 * @param {object} options - Options (attachToSubtask, throwOnBlocked, etc.)
 * @returns {object} Readiness evaluation result
 */
export function evaluateSubtaskReadiness(subtask, options = {}) {
  const result = routeSubtaskCapabilities(subtask, options);

  if (options.attachToSubtask && subtask && typeof subtask === 'object') {
    subtask.readiness = result;
    if (result.status === SUBTASK_READINESS_STATUS.READY && subtask.status === SUBTASK_STATUS.PENDING) {
      subtask.status = SUBTASK_STATUS.READY;
    } else if (result.status === SUBTASK_READINESS_STATUS.BLOCKED) {
      subtask.blocking_reason = result.failureReason;
    }
  }

  if (options.throwOnBlocked && !result.ready) {
    throw new Error(result.failureReason);
  }

  return result;
}

/**
 * Routes and evaluates capability readiness across all subtasks in a task contract or execution plan.
 *
 * @param {object|Array} contractOrSubtasks - TaskContract object or array of subtask objects
 * @param {object} options - Options (registry, enforceGate, attachToContract, throwOnBlocked)
 * @returns {object} Execution plan subtask readiness summary
 */
export function routeTaskPlanSubtasks(contractOrSubtasks, options = {}) {
  let subtasks = [];
  let isContract = false;

  if (Array.isArray(contractOrSubtasks)) {
    subtasks = contractOrSubtasks;
  } else if (contractOrSubtasks && typeof contractOrSubtasks === 'object') {
    isContract = true;
    subtasks = contractOrSubtasks.subtasks || contractOrSubtasks.execution_plan || [];
  } else {
    throw new Error('routeTaskPlanSubtasks requires a TaskContract object or an array of subtasks.');
  }

  const results = [];
  const blockingSubtasks = [];
  const allFailures = [];
  let readyCount = 0;
  let blockedCount = 0;
  let invalidCount = 0;

  for (const s of subtasks) {
    const r = evaluateSubtaskReadiness(s, options);
    results.push(r);

    if (r.status === SUBTASK_READINESS_STATUS.READY) {
      readyCount++;
    } else if (r.status === SUBTASK_READINESS_STATUS.BLOCKED) {
      blockedCount++;
      blockingSubtasks.push(r);
      allFailures.push(r.failureReason);
    } else if (r.status === SUBTASK_READINESS_STATUS.INVALID) {
      invalidCount++;
      blockingSubtasks.push(r);
      allFailures.push(r.failureReason);
    }
  }

  const allReady = subtasks.length === 0 || (blockedCount === 0 && invalidCount === 0);
  const summary = {
    totalSubtasks: subtasks.length,
    readyCount,
    blockedCount,
    invalidCount,
    allReady,
    subtasks: results,
    blockingSubtasks,
    failures: allFailures,
    failureReason: allFailures.length > 0 ? allFailures.join(' | ') : null
  };

  if (isContract && (options.attachToContract !== false)) {
    if (!contractOrSubtasks.context) {
      contractOrSubtasks.context = {};
    }
    contractOrSubtasks.context.subtask_readiness = summary;

    if (!allReady && options.enforceGate) {
      contractOrSubtasks.status = 'FAILED';
      if (contractOrSubtasks.verification_results) {
        contractOrSubtasks.verification_results.failure_reason = summary.failureReason;
      }
    }
  }

  if (options.throwOnBlocked && !allReady) {
    throw new Error(`Task Plan subtask gating failed:\n- ${allFailures.join('\n- ')}`);
  }

  return summary;
}
