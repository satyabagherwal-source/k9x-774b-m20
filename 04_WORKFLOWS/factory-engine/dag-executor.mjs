/**
 * Controlled DAG Execution Engine & Dynamic Skill Binding (Milestone D3.3)
 *
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\dag-executor.mjs
 * Purpose: Executes validated task decomposition plans as a deterministic, sequential
 *          Directed Acyclic Graph (DAG) with dynamic skill binding, readiness gating,
 *          failure halting, cascading dependency protection, and durable checkpointing.
 *
 * Zero external dependencies. Native Node.js ES Module.
 */

import {
  SUBTASK_STATUS,
  validateSubtask,
  validateTaskContract
} from './task-contract.mjs';
import {
  validatePlanDAG
} from './task-planner.mjs';
import {
  checkCapabilityReadiness,
  getCapabilityById
} from './capability-registry.mjs';
import {
  routeSubtaskCapabilities,
  evaluateSubtaskReadiness,
  routeTaskPlanSubtasks,
  SUBTASK_READINESS_STATUS
} from './subtask-router.mjs';
import {
  getSkillDefinition,
  listRegisteredSkills
} from './skill-runner.mjs';
import {
  recordTaskCheckpoint
} from './brain-connector.mjs';

/**
 * Verified capability to canonical skill playbook mapping in 03_SKILLS/
 */
export const CAPABILITY_SKILL_MAP = {
  'CAP-PROJECT-FACTORY-BOOTSTRAP': 'fullstack-ai-saas-architecture',
  'CAP-MULTILINGUAL-SEO-INTELLIGENCE': 'multilingual-first-architecture',
  'CAP-HYBRID-KNOWLEDGE-RETRIEVAL': 'universal-project-profiler',
  'CAP-UNIVERSAL-TASK-CONTRACT': 'agent-error-prevention-protocol',
  'CAP-PERSISTENT-LEARNING-HARVESTING': 'autonomous-project-learning-harvester',
  'CAP-HEADLESS-BROWSER-VERIFICATION': 'zero-dependency-headless-renderer'
};

/**
 * Fallback action / objective patterns for dynamic skill resolution
 */
export const ACTION_SKILL_PATTERNS = [
  { pattern: /\b(tailwind|css|styling|design\s+token|responsive\s+geometry)\b/i, skillId: 'tailwind-v4-css-first-design' },
  { pattern: /\b(multilingual|locale|hreflang|alternate\s+cluster)\b/i, skillId: 'multilingual-seo-54-locales' },
  { pattern: /\b(git|github|lifecycle|commit|branch)\b/i, skillId: 'git-github-lifecycle-skill' },
  { pattern: /\b(compiler|systems?|invariants|high-performance)\b/i, skillId: 'high-performance-systems-and-compiler-invariants' },
  { pattern: /\b(doctor|audit|coverage|forensic)\b/i, skillId: 'agentic-doctor-coverage-audit' },
  { pattern: /\b(adsense|ad\s+unit|monetization)\b/i, skillId: 'astro-adsense-mastery' },
  { pattern: /\b(vercel|deploy|deployment|edge\s+network)\b/i, skillId: 'vercel-deployment-playbook' },
  { pattern: /\b(error\s+prevention|shield|safeguard|anti-regression)\b/i, skillId: 'agent-error-prevention-protocol' },
  { pattern: /\b(correction|regression|defect|patch)\b/i, skillId: 'project-correction-and-regression' },
  { pattern: /\b(pair\s+programming|beginner|micro-teaching)\b/i, skillId: 'beginner-coder-pair-programming' }
];

/**
 * Binds an appropriate verified skill to a single subtask
 *
 * @param {object} subtask - Subtask contract object
 * @param {object} options - Configuration options
 * @returns {object} { success: boolean, subtaskId, skillId, matchedBy, reason, skill, error }
 */
export function bindSkillToSubtask(subtask, options = {}) {
  const rawId = subtask?.id !== undefined ? subtask.id : (subtask?.step_id !== undefined ? subtask.step_id : subtask?.subtask_id);
  const subtaskId = rawId !== undefined && rawId !== null ? rawId : 'unknown';

  // 1. Validate subtask contract shape
  const validation = validateSubtask(subtask, options.validationContext || {});
  if (!validation.valid) {
    const reason = `Subtask '${subtaskId}' contract invalid: ${validation.errors.join('; ')}`;
    return {
      success: false,
      subtaskId,
      skillId: null,
      matchedBy: null,
      reason,
      error: 'INVALID_SUBTASK'
    };
  }

  // 2. Case A: Explicit skill assignment declared on subtask
  if (subtask.assigned_skill_id) {
    const explicitSkillId = String(subtask.assigned_skill_id).trim();
    const skill = getSkillDefinition(explicitSkillId);

    if (!skill) {
      const reason = `Explicitly assigned skill '${explicitSkillId}' not found in 03_SKILLS/ registry`;
      subtask.binding_decision = {
        skill_id: explicitSkillId,
        matched_by: 'EXPLICIT_ASSIGNMENT',
        verified: false,
        error: 'SKILL_NOT_FOUND',
        reason,
        bound_at: new Date().toISOString()
      };
      if (options.throwOnBindingFailure) throw new Error(reason);
      return {
        success: false,
        subtaskId,
        skillId: explicitSkillId,
        matchedBy: 'EXPLICIT_ASSIGNMENT',
        reason,
        error: 'SKILL_NOT_FOUND'
      };
    }

    // Verify capability compatibility if subtask declared capability requirements
    const reqCaps = Array.isArray(subtask.required_capabilities) ? subtask.required_capabilities : [];
    if (reqCaps.length > 0) {
      const gating = checkCapabilityReadiness(reqCaps, {
        customRegistryPath: options.customRegistryPath || options.registryPath
      });
      if (!gating.ready) {
        const reason = `Explicit skill '${explicitSkillId}' cannot bind: required capability gating failed (${gating.failureReason})`;
        subtask.binding_decision = {
          skill_id: explicitSkillId,
          matched_by: 'EXPLICIT_ASSIGNMENT',
          verified: false,
          error: 'CAPABILITY_NOT_VERIFIED',
          reason,
          bound_at: new Date().toISOString()
        };
        if (options.throwOnBindingFailure) throw new Error(reason);
        return {
          success: false,
          subtaskId,
          skillId: explicitSkillId,
          matchedBy: 'EXPLICIT_ASSIGNMENT',
          reason,
          error: 'CAPABILITY_NOT_VERIFIED'
        };
      }
    }

    // Inject skill invariants into subtask
    if (!Array.isArray(subtask.invariants)) subtask.invariants = [];
    for (const inv of skill.invariants) {
      if (!subtask.invariants.includes(inv)) {
        subtask.invariants.push(inv);
      }
    }

    // If parent contract provided, inject into negative constraints
    if (options.contract?.constraints?.negative_constraints) {
      for (const inv of skill.invariants) {
        const tagged = `[${skill.title}] ${inv}`;
        if (!options.contract.constraints.negative_constraints.includes(tagged)) {
          options.contract.constraints.negative_constraints.push(tagged);
        }
      }
    }

    subtask.binding_decision = {
      skill_id: skill.skill_id,
      skill_title: skill.title,
      matched_by: 'EXPLICIT_ASSIGNMENT',
      verified: true,
      invariants_count: skill.invariants.length,
      reason: `Explicitly assigned verified skill '${skill.skill_id}'`,
      bound_at: new Date().toISOString()
    };

    return {
      success: true,
      subtaskId,
      skillId: skill.skill_id,
      matchedBy: 'EXPLICIT_ASSIGNMENT',
      reason: subtask.binding_decision.reason,
      skill
    };
  }

  // 3. Case B: Dynamic skill binding via required capabilities
  const reqCaps = Array.isArray(subtask.required_capabilities) ? subtask.required_capabilities : [];
  if (reqCaps.length > 0) {
    // Check readiness first
    const gating = checkCapabilityReadiness(reqCaps, {
      customRegistryPath: options.customRegistryPath || options.registryPath
    });

    if (!gating.ready) {
      const reason = `Dynamic skill binding blocked: required capability gating failed (${gating.failureReason})`;
      subtask.binding_decision = {
        skill_id: null,
        matched_by: 'CAPABILITY_MAPPING',
        verified: false,
        error: 'CAPABILITY_NOT_VERIFIED',
        reason,
        bound_at: new Date().toISOString()
      };
      if (options.throwOnBindingFailure) throw new Error(reason);
      return {
        success: false,
        subtaskId,
        skillId: null,
        matchedBy: 'CAPABILITY_MAPPING',
        reason,
        error: 'CAPABILITY_NOT_VERIFIED'
      };
    }

    // Find verified skill mapping for the required capabilities
    let matchedSkillId = null;
    let matchedCapId = null;
    for (const cap of reqCaps) {
      if (CAPABILITY_SKILL_MAP[cap]) {
        matchedSkillId = CAPABILITY_SKILL_MAP[cap];
        matchedCapId = cap;
        break;
      }
    }

    if (matchedSkillId) {
      const skill = getSkillDefinition(matchedSkillId);
      if (skill) {
        subtask.assigned_skill_id = matchedSkillId;
        if (!Array.isArray(subtask.invariants)) subtask.invariants = [];
        for (const inv of skill.invariants) {
          if (!subtask.invariants.includes(inv)) {
            subtask.invariants.push(inv);
          }
        }

        subtask.binding_decision = {
          skill_id: skill.skill_id,
          skill_title: skill.title,
          matched_by: 'CAPABILITY_MAPPING',
          matched_capability: matchedCapId,
          verified: true,
          invariants_count: skill.invariants.length,
          reason: `Matched verified skill '${skill.skill_id}' to capability '${matchedCapId}'`,
          bound_at: new Date().toISOString()
        };

        return {
          success: true,
          subtaskId,
          skillId: skill.skill_id,
          matchedBy: 'CAPABILITY_MAPPING',
          reason: subtask.binding_decision.reason,
          skill
        };
      }
    }
  }

  // 4. Case C: Dynamic skill binding via action / title pattern matching
  const searchContent = `${subtask.title || ''} ${subtask.objective || ''} ${subtask.action || ''}`;
  for (const item of ACTION_SKILL_PATTERNS) {
    if (item.pattern.test(searchContent)) {
      const skill = getSkillDefinition(item.skillId);
      if (skill) {
        subtask.assigned_skill_id = skill.skill_id;
        if (!Array.isArray(subtask.invariants)) subtask.invariants = [];
        for (const inv of skill.invariants) {
          if (!subtask.invariants.includes(inv)) {
            subtask.invariants.push(inv);
          }
        }

        subtask.binding_decision = {
          skill_id: skill.skill_id,
          skill_title: skill.title,
          matched_by: 'ACTION_PATTERN',
          verified: true,
          invariants_count: skill.invariants.length,
          reason: `Matched verified skill '${skill.skill_id}' via action pattern`,
          bound_at: new Date().toISOString()
        };

        return {
          success: true,
          subtaskId,
          skillId: skill.skill_id,
          matchedBy: 'ACTION_PATTERN',
          reason: subtask.binding_decision.reason,
          skill
        };
      }
    }
  }

  // 5. Case D: Base runtime execution (no specialized skill required)
  subtask.assigned_skill_id = null;
  subtask.binding_decision = {
    skill_id: null,
    skill_title: null,
    matched_by: 'BASE_RUNTIME',
    verified: true,
    invariants_count: 0,
    reason: 'No specialized skill required; executing under base runtime engineering protocol',
    bound_at: new Date().toISOString()
  };

  return {
    success: true,
    subtaskId,
    skillId: null,
    matchedBy: 'BASE_RUNTIME',
    reason: subtask.binding_decision.reason,
    skill: null
  };
}

/**
 * Dynamically binds verified skills across all subtasks in a task plan or contract
 *
 * @param {object|Array} contractOrPlan - Task contract or array of subtasks
 * @param {object} options - Binding configuration options
 * @returns {object} Summary of dynamic skill binding across plan
 */
export function bindSkillsToPlan(contractOrPlan, options = {}) {
  const subtasks = Array.isArray(contractOrPlan)
    ? contractOrPlan
    : (contractOrPlan?.subtasks || contractOrPlan?.execution_plan || []);

  const results = [];
  const failures = [];
  let boundCount = 0;
  let baseRuntimeCount = 0;
  let failedCount = 0;

  for (const subtask of subtasks) {
    const bindResult = bindSkillToSubtask(subtask, {
      ...options,
      contract: Array.isArray(contractOrPlan) ? null : contractOrPlan
    });
    results.push(bindResult);

    if (bindResult.success) {
      if (bindResult.skillId) {
        boundCount++;
      } else {
        baseRuntimeCount++;
      }
    } else {
      failedCount++;
      failures.push(bindResult.reason || bindResult.error || `Failed binding for subtask ${bindResult.subtaskId}`);
    }
  }

  const success = failedCount === 0;
  const summary = {
    success,
    totalSubtasks: subtasks.length,
    boundCount,
    baseRuntimeCount,
    failedCount,
    failures,
    failureReason: failures.length > 0 ? failures.join('; ') : null,
    subtasks: results
  };

  if (!Array.isArray(contractOrPlan) && contractOrPlan && typeof contractOrPlan === 'object') {
    if (!contractOrPlan.context) contractOrPlan.context = {};
    contractOrPlan.context.skill_binding = summary;
  }

  if (options.throwOnBindingFailure && !success) {
    throw new Error(`Dynamic skill binding failed:\n- ${failures.join('\n- ')}`);
  }

  return summary;
}

/**
 * Returns all subtasks whose dependencies have been completed and are ready to execute
 *
 * @param {object|Array} contractOrSubtasks - TaskContract or array of subtasks
 * @returns {Array<object>} Subtasks ready for execution
 */
export function getExecutableSubtasks(contractOrSubtasks) {
  const subtasks = Array.isArray(contractOrSubtasks)
    ? contractOrSubtasks
    : (contractOrSubtasks?.subtasks || contractOrSubtasks?.execution_plan || []);

  const completedIds = new Set();
  const failedOrSkippedIds = new Set();

  for (const s of subtasks) {
    const rawId = s.id !== undefined ? s.id : (s.step_id !== undefined ? s.step_id : s.subtask_id);
    const normId = String(rawId).trim();
    if (s.status === SUBTASK_STATUS.COMPLETED) {
      completedIds.add(normId);
    } else if (s.status === SUBTASK_STATUS.FAILED || s.status === SUBTASK_STATUS.SKIPPED || s.status === SUBTASK_STATUS.BLOCKED) {
      failedOrSkippedIds.add(normId);
    }
  }

  return subtasks.filter(step => {
    // Only PENDING or READY subtasks can be picked
    if (step.status !== SUBTASK_STATUS.PENDING && step.status !== SUBTASK_STATUS.READY) {
      return false;
    }

    const deps = Array.isArray(step.dependencies)
      ? step.dependencies
      : (Array.isArray(step.depends_on) ? step.depends_on : []);

    // If any dependency failed, was skipped, or is blocked, this step cannot run
    const hasBlockedDep = deps.some(d => failedOrSkippedIds.has(String(d).trim()));
    if (hasBlockedDep) {
      return false;
    }

    // All dependencies must be COMPLETED
    return deps.every(depId => completedIds.has(String(depId).trim()));
  });
}

/**
 * Cascades failure down dependency chain, marking downstream subtasks SKIPPED
 *
 * @param {Array<object>} subtasks - Array of subtasks
 * @param {string} failedNormId - Identifier of failed predecessor
 * @param {string} reason - Abort rationale
 * @returns {Array<string>} List of skipped subtask identifiers
 */
function cascadeSkipDependentSubtasks(subtasks, failedNormId, reason) {
  const toSkip = new Set([failedNormId]);
  let added = true;

  while (added) {
    added = false;
    for (const s of subtasks) {
      const rawId = s.id !== undefined ? s.id : (s.step_id !== undefined ? s.step_id : s.subtask_id);
      const normId = String(rawId).trim();
      if (toSkip.has(normId)) continue;

      const deps = Array.isArray(s.dependencies)
        ? s.dependencies
        : (Array.isArray(s.depends_on) ? s.depends_on : []);

      if (deps.some(d => toSkip.has(String(d).trim()))) {
        toSkip.add(normId);
        added = true;
      }
    }
  }

  const skippedList = [];
  for (const s of subtasks) {
    const rawId = s.id !== undefined ? s.id : (s.step_id !== undefined ? s.step_id : s.subtask_id);
    const normId = String(rawId).trim();
    if (normId !== failedNormId && toSkip.has(normId)) {
      if (s.status === SUBTASK_STATUS.PENDING || s.status === SUBTASK_STATUS.READY) {
        s.status = SUBTASK_STATUS.SKIPPED;
        s.blocking_reason = reason;
        skippedList.push(normId);
      }
    }
  }

  return skippedList;
}

/**
 * Advances a subtask in the execution plan upon verified evidence and records checkpoint
 *
 * @param {object} contract - The task contract
 * @param {number|string} subtaskId - The ID of the subtask to advance
 * @param {object} evidence - Execution evidence
 * @param {object} options - Execution options
 * @returns {object} Progression outcome
 */
export function advanceSubtaskExecution(contract, subtaskId, evidence = {}, options = {}) {
  const subtasks = contract?.subtasks || contract?.execution_plan || [];
  const normSubtaskId = String(subtaskId).trim();
  const subtask = subtasks.find(s => {
    const rawId = s.id !== undefined ? s.id : (s.step_id !== undefined ? s.step_id : s.subtask_id);
    return String(rawId).trim() === normSubtaskId;
  });

  if (!subtask) {
    throw new Error(`Subtask '${subtaskId}' not found in contract plan.`);
  }

  const success = evidence.success !== false;
  subtask.status = success ? SUBTASK_STATUS.COMPLETED : SUBTASK_STATUS.FAILED;
  subtask.completed_at = success ? new Date().toISOString() : null;
  subtask.failed_at = !success ? new Date().toISOString() : null;
  subtask.evidence = evidence;
  if (!success && evidence.error) {
    subtask.error = evidence.error;
  }

  const rawId = subtask.id !== undefined ? subtask.id : (subtask.step_id !== undefined ? subtask.step_id : subtask.subtask_id);
  if (success && contract.checkpoint) {
    contract.checkpoint.current_step = rawId;
  }

  // Record checkpoint to durable storage
  if (options.persistCheckpoint !== false && contract.task_id) {
    recordTaskCheckpoint(contract, contract.checkpoint?.current_step || 0, {
      lastSubtask: rawId,
      subtaskStatus: subtask.status,
      timestamp: new Date().toISOString()
    }, null, options);
  }

  const nextExecutable = getExecutableSubtasks(contract);
  const allCompleted = subtasks.every(s => s.status === SUBTASK_STATUS.COMPLETED);

  return {
    success,
    advancedSubtask: subtask,
    nextExecutable,
    allCompleted
  };
}

/**
 * Executes a task contract's subtask DAG sequentially with dynamic skill binding,
 * readiness gating, and durable checkpointing.
 *
 * @param {object} contract - The task contract containing subtasks or execution_plan
 * @param {Function} executorFn - Function (subtask, context) => Promise<{ success: boolean, evidence: object, error?: string }>
 * @param {object} options - Execution options
 * @returns {Promise<object>} Execution outcome
 */
export async function executeSubtaskDAG(contract, executorFn, options = {}) {
  // 1. Contract / Plan validation
  if (!contract || typeof contract !== 'object') {
    throw new Error('executeSubtaskDAG requires a valid TaskContract or plan object.');
  }

  const subtasks = contract.subtasks || contract.execution_plan || [];
  if (!Array.isArray(subtasks) || subtasks.length === 0) {
    return {
      success: false,
      status: 'FAILED',
      error: 'EMPTY_PLAN',
      failureReason: 'Execution plan contains no subtasks.',
      totalSubtasks: 0,
      completedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      executedSubtasks: [],
      contract
    };
  }

  // 2. DAG Topology & Cycle Validation
  const dagCheck = validatePlanDAG(subtasks);
  if (!dagCheck.valid) {
    const reason = `Plan DAG validation failed: ${dagCheck.errors.join('; ')}`;
    return {
      success: false,
      status: 'FAILED',
      error: 'INVALID_DAG',
      failures: dagCheck.errors,
      failureReason: reason,
      totalSubtasks: subtasks.length,
      completedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      executedSubtasks: [],
      contract
    };
  }

  // 3. Pre-flight Capability Readiness Gating (enabled by default)
  if (options.enforceReadinessGating !== false) {
    const gatingSummary = routeTaskPlanSubtasks(contract, options);
    if (!gatingSummary.allReady) {
      // Mark blocked subtasks
      for (const blocked of gatingSummary.blockingSubtasks) {
        const target = subtasks.find(s => {
          const rawId = s.id !== undefined ? s.id : (s.step_id !== undefined ? s.step_id : s.subtask_id);
          return String(rawId).trim() === String(blocked.subtaskId).trim();
        });
        if (target) {
          target.status = SUBTASK_STATUS.BLOCKED;
          target.blocking_reason = blocked.failureReason;
        }
      }

      // If pre-flight fail-fast is desired (default true)
      if (options.failFastOnPreflightBlocked !== false) {
        return {
          success: false,
          status: 'FAILED',
          error: 'CAPABILITY_GATING_BLOCKED',
          failures: gatingSummary.failures,
          failureReason: `Subtask capability gating blocked execution: ${gatingSummary.failureReason}`,
          totalSubtasks: subtasks.length,
          completedCount: 0,
          failedCount: 0,
          skippedCount: gatingSummary.blockedCount + gatingSummary.invalidCount,
          subtaskReadiness: gatingSummary,
          executedSubtasks: [],
          contract
        };
      }
    }
  }

  // 4. Pre-flight Dynamic Skill Binding (enabled by default)
  if (options.bindSkills !== false) {
    const bindingResult = bindSkillsToPlan(contract, options);
    if (!bindingResult.success) {
      return {
        success: false,
        status: 'FAILED',
        error: 'SKILL_BINDING_FAILED',
        failures: bindingResult.failures,
        failureReason: `Dynamic skill binding failed: ${bindingResult.failureReason}`,
        totalSubtasks: subtasks.length,
        completedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        executedSubtasks: [],
        contract
      };
    }
  }

  // 5. Execution State Initialization
  const executedSubtasks = [];
  const completedSubtaskIds = new Set();
  const failedSubtaskIds = new Set();
  const skippedSubtaskIds = new Set();

  // Populate previously completed steps (Idempotency / Safe Resumption)
  for (const s of subtasks) {
    const rawId = s.id !== undefined ? s.id : (s.step_id !== undefined ? s.step_id : s.subtask_id);
    const normId = String(rawId).trim();

    if (s.status === SUBTASK_STATUS.COMPLETED && options.skipCompleted !== false) {
      completedSubtaskIds.add(normId);
      executedSubtasks.push({
        subtaskId: rawId,
        status: SUBTASK_STATUS.COMPLETED,
        previouslyCompleted: true,
        skippedExecution: true
      });
    } else if (s.status === SUBTASK_STATUS.SKIPPED) {
      skippedSubtaskIds.add(normId);
    }
  }

  // Initial checkpoint recording
  if (options.persistCheckpoint !== false && contract.task_id) {
    recordTaskCheckpoint(contract, contract.checkpoint?.current_step || 0, {
      phase: 'EXECUTION_STARTED',
      totalSubtasks: subtasks.length,
      resumedCompletedCount: completedSubtaskIds.size
    }, SUBTASK_STATUS.IN_PROGRESS, options);
  }

  // 6. Sequential Execution Loop
  let executionHalted = false;
  let haltReason = null;

  while (!executionHalted) {
    const executable = getExecutableSubtasks(subtasks);

    if (executable.length === 0) {
      // Check if unexecuted steps remain
      const remainingUnfinished = subtasks.filter(s =>
        s.status !== SUBTASK_STATUS.COMPLETED &&
        s.status !== SUBTASK_STATUS.SKIPPED &&
        s.status !== SUBTASK_STATUS.FAILED &&
        s.status !== SUBTASK_STATUS.BLOCKED
      );

      if (remainingUnfinished.length > 0) {
        executionHalted = true;
        haltReason = `Deadlock or unsatisfied dependencies for subtasks: ${remainingUnfinished.map(s => s.id || s.step_id || s.subtask_id).join(', ')}`;
      }
      break;
    }

    // Sequential execution: pick first executable subtask
    const subtask = executable[0];
    const rawId = subtask.id !== undefined ? subtask.id : (subtask.step_id !== undefined ? subtask.step_id : subtask.subtask_id);
    const normId = String(rawId).trim();

    // Verify readiness gating immediately before execution
    if (options.enforceReadinessGating !== false) {
      const readiness = evaluateSubtaskReadiness(subtask, options);
      if (!readiness.ready) {
        subtask.status = SUBTASK_STATUS.BLOCKED;
        subtask.blocking_reason = readiness.failureReason;
        failedSubtaskIds.add(normId);

        cascadeSkipDependentSubtasks(subtasks, normId, `Predecessor subtask '${rawId}' blocked by capability gating: ${readiness.failureReason}`);

        executedSubtasks.push({
          subtaskId: rawId,
          status: SUBTASK_STATUS.BLOCKED,
          error: readiness.failureReason,
          ready: false
        });

        executionHalted = true;
        haltReason = readiness.failureReason;
        break;
      }
    }

    // State transition: PENDING/READY -> IN_PROGRESS
    subtask.status = SUBTASK_STATUS.IN_PROGRESS;
    subtask.started_at = new Date().toISOString();

    if (options.persistCheckpoint !== false && contract.task_id) {
      recordTaskCheckpoint(contract, rawId, {
        activeSubtask: rawId,
        subtaskStatus: SUBTASK_STATUS.IN_PROGRESS
      });
    }

    // Execute via executorFn
    let stepEvidence = {};
    let stepSuccess = false;
    let stepError = null;
    const startTime = Date.now();

    try {
      if (typeof executorFn === 'function') {
        const res = await executorFn(subtask, { contract, options });
        stepSuccess = res ? (res.success !== false) : true;
        stepEvidence = (res && res.evidence) ? res.evidence : (res || { success: true });
        if (!stepSuccess) {
          stepError = res?.error || stepEvidence?.error || `Executor returned failure for subtask '${rawId}'`;
        }
      } else {
        stepEvidence = { success: true, simulated: true };
        stepSuccess = true;
      }
    } catch (err) {
      stepSuccess = false;
      stepError = err.message || String(err);
      stepEvidence = { success: false, error: stepError };
    }

    const durationMs = Date.now() - startTime;

    if (stepSuccess) {
      advanceSubtaskExecution(contract, rawId, stepEvidence, options);
      completedSubtaskIds.add(normId);

      executedSubtasks.push({
        subtaskId: rawId,
        status: SUBTASK_STATUS.COMPLETED,
        durationMs,
        evidence: stepEvidence,
        success: true
      });
    } else {
      subtask.status = SUBTASK_STATUS.FAILED;
      subtask.error = stepError;
      subtask.evidence = stepEvidence;
      subtask.failed_at = new Date().toISOString();
      failedSubtaskIds.add(normId);

      executedSubtasks.push({
        subtaskId: rawId,
        status: SUBTASK_STATUS.FAILED,
        durationMs,
        evidence: stepEvidence,
        error: stepError,
        success: false
      });

      // Update checkpoint for failure
      if (options.persistCheckpoint !== false && contract.task_id) {
        recordTaskCheckpoint(contract, rawId, {
          failedSubtask: rawId,
          subtaskStatus: SUBTASK_STATUS.FAILED,
          error: stepError
        }, SUBTASK_STATUS.FAILED, options);
      }

      // Cascade failure handling
      const policy = subtask.failure_policy || 'ABORT';
      if (policy === 'ABORT') {
        const skipped = cascadeSkipDependentSubtasks(subtasks, normId, `Cascading abort: predecessor subtask '${rawId}' failed (${stepError})`);
        skipped.forEach(sId => skippedSubtaskIds.add(sId));
        executionHalted = true;
        haltReason = `Subtask '${rawId}' failed: ${stepError}`;
        break;
      }
    }
  }

  // 7. Final Status Determination
  const allCompleted = subtasks.every(s => s.status === SUBTASK_STATUS.COMPLETED);
  const finalStatus = allCompleted ? 'COMPLETED' : 'FAILED';
  contract.status = finalStatus;

  if (options.persistCheckpoint !== false && contract.task_id) {
    recordTaskCheckpoint(contract, contract.checkpoint?.current_step || 0, {
      phase: 'EXECUTION_FINISHED',
      finalStatus,
      completedCount: completedSubtaskIds.size,
      failedCount: failedSubtaskIds.size,
      skippedCount: skippedSubtaskIds.size,
      haltReason
    }, finalStatus, options);
  }

  return {
    success: allCompleted,
    status: finalStatus,
    totalSubtasks: subtasks.length,
    completedCount: completedSubtaskIds.size,
    failedCount: failedSubtaskIds.size,
    skippedCount: skippedSubtaskIds.size,
    failureReason: haltReason,
    executedSubtasks,
    contract
  };
}

/**
 * Adapts an executor function to provide unified context, skill binding decisions,
 * and robust error handling while maintaining 100% backward compatibility for legacy callers.
 *
 * @param {Function} executorFn - Function (subtask, contract, context) => Promise<{ success: boolean, evidence?: object, error?: string }>
 * @param {object} contract - Parent task contract
 * @param {object} options - Execution options
 * @returns {Function} Adapted async executor function
 */
export function createExecutorAdapter(executorFn, contract, options = {}) {
  return async function adaptedExecutor(subtask, context = {}) {
    const parentContract = context?.contract || contract;
    const rawId = subtask.id !== undefined ? subtask.id : (subtask.step_id !== undefined ? subtask.step_id : subtask.subtask_id);

    // Ensure bidirectional alias synchronization for legacy compatibility
    if (subtask.step_id === undefined && typeof rawId === 'number') {
      subtask.step_id = rawId;
    }
    if (subtask.id === undefined && subtask.step_id !== undefined) {
      subtask.id = subtask.step_id;
    }

    const stepContext = {
      ...context,
      contract: parentContract,
      subtaskId: rawId,
      assignedSkill: subtask.assigned_skill_id || null,
      bindingDecision: subtask.binding_decision || null,
      requiredCapabilities: subtask.required_capabilities || [],
      invariants: subtask.invariants || [],
      options
    };

    let result;
    try {
      if (typeof executorFn === 'function') {
        result = await executorFn(subtask, parentContract, stepContext);
      } else {
        result = { success: true, simulated: true };
      }
    } catch (err) {
      return {
        success: false,
        error: err.message || String(err),
        evidence: { error: err.message || String(err) }
      };
    }

    if (!result || typeof result !== 'object') {
      return {
        success: false,
        error: 'Executor returned non-object response',
        evidence: {}
      };
    }

    const success = result.success !== false;
    const evidence = result.evidence || (result.success !== undefined ? result : { success: true });
    const error = !success ? (result.error || 'Subtask execution failed') : null;

    return {
      success,
      evidence,
      error,
      output: result.output || result.data || null
    };
  };
}
