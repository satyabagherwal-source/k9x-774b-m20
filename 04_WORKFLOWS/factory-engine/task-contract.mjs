/**
 * Universal Task Contract Engine
 *
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\task-contract.mjs
 * Purpose: Defines, builds, and validates standardized task execution contracts
 *          for compatible AI models, ensuring objectives, negative constraints,
 *          context, tools, and verification criteria are mathematically bounded.
 *
 * Zero external dependencies. Native Node.js ES Module.
 */

import crypto from 'crypto';

export const CAPABILITY_ID_REGEX = /^CAP-[A-Z0-9-]+$/;

export const TASK_TYPES = [
  'MICRO_FIX',
  'FEATURE',
  'SYSTEM_BUILD',
  'HARVEST',
  'AUDIT',
  'REFACTOR'
];

export const TASK_STATUS = {
  CREATED: 'CREATED',
  CONTEXT_RESOLVED: 'CONTEXT_RESOLVED',
  IN_PROGRESS: 'IN_PROGRESS',
  AWAITING_VERIFICATION: 'AWAITING_VERIFICATION',
  AWAITING_HUMAN_APPROVAL: 'AWAITING_HUMAN_APPROVAL',
  PAUSED: 'PAUSED',
  RETRYING: 'RETRYING',
  VERIFIED: 'VERIFIED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED'
};

export const SUBTASK_STATUS = {
  PENDING: 'PENDING',
  READY: 'READY',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED'
};

export const FAILURE_POLICIES = {
  ABORT: 'ABORT',
  RETRY: 'RETRY',
  CONTINUE: 'CONTINUE'
};

export const FAILURE_CLASSES = {
  SYNTAX_ERROR: 'SYNTAX_ERROR',
  TEST_FAILURE: 'TEST_FAILURE',
  RUNTIME_EXCEPTION: 'RUNTIME_EXCEPTION',
  QUOTA_EXHAUSTED: 'QUOTA_EXHAUSTED',
  RATE_LIMIT: 'RATE_LIMIT',
  AUTH_FAILURE: 'AUTH_FAILURE',
  PROVIDER_OUTAGE: 'PROVIDER_OUTAGE',
  CONTEXT_EXHAUSTION: 'CONTEXT_EXHAUSTION',
  TIMEOUT: 'TIMEOUT',
  SAFETY_BOUNDARY_BLOCKED: 'SAFETY_BOUNDARY_BLOCKED',
  PROCESS_TERMINATED: 'PROCESS_TERMINATED'
};

export const EVIDENCE_TYPES = [
  'BUILD_EXIT_0',
  'HTTP_200',
  'TEST_PASS',
  'DOM_RENDER',
  'FILE_VERIFIED_SHA256',
  'SYNTAX_LINT_PASS'
];

export const OUTPUT_FORMATS = [
  'SURGICAL_PATCH',
  'FULL_FILE',
  'ANALYSIS_REPORT',
  'COMMAND_EXECUTION'
];

export const KNOWLEDGE_APPLICATION_STATUS = {
  APPLIED: 'APPLIED',
  REJECTED: 'REJECTED',
  INAPPLICABLE: 'INAPPLICABLE'
};

export const VERIFICATION_OUTCOME = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  PENDING: 'PENDING'
};

/**
 * Validates a Task Contract against canonical structure and invariants
 *
 * @param {object} contract - The task contract object
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateTaskContract(contract) {
  const errors = [];

  if (!contract || typeof contract !== 'object') {
    return { valid: false, errors: ['Contract must be a non-null object.'] };
  }

  // 1. Task ID
  if (!contract.task_id || typeof contract.task_id !== 'string') {
    errors.push('task_id is required and must be a non-empty string.');
  }

  // 2. Task Type
  if (!contract.task_type || !TASK_TYPES.includes(contract.task_type)) {
    errors.push(`task_type must be one of: ${TASK_TYPES.join(', ')} (Got: ${contract.task_type})`);
  }

  // 3. Objective
  if (!contract.objective || typeof contract.objective !== 'string' || contract.objective.trim().length < 10) {
    errors.push('objective is required and must be at least 10 characters long.');
  }

  // 4. Constraints
  if (!contract.constraints || typeof contract.constraints !== 'object') {
    errors.push('constraints object is required.');
  } else {
    if (!Array.isArray(contract.constraints.negative_constraints)) {
      errors.push('constraints.negative_constraints must be an array of strings.');
    }
    if (typeof contract.constraints.anti_regression !== 'boolean') {
      errors.push('constraints.anti_regression must be a boolean.');
    }
    if (typeof contract.constraints.max_tokens_budget !== 'number' || contract.constraints.max_tokens_budget <= 0) {
      errors.push('constraints.max_tokens_budget must be a positive number.');
    }
    if (!Array.isArray(contract.constraints.allowed_tools)) {
      errors.push('constraints.allowed_tools must be an array of tool names.');
    }
  }

  // 5. Verification Criteria
  if (!contract.verification_criteria || typeof contract.verification_criteria !== 'object') {
    errors.push('verification_criteria object is required.');
  } else {
    if (typeof contract.verification_criteria.build_required !== 'boolean') {
      errors.push('verification_criteria.build_required must be a boolean.');
    }
    if (typeof contract.verification_criteria.terminal_proof_required !== 'boolean') {
      errors.push('verification_criteria.terminal_proof_required must be a boolean.');
    }
    if (!Array.isArray(contract.verification_criteria.evidence_types) || contract.verification_criteria.evidence_types.length === 0) {
      errors.push('verification_criteria.evidence_types must be a non-empty array of valid evidence types.');
    }
  }

  // 6. Output Format
  if (!contract.output_format || !OUTPUT_FORMATS.includes(contract.output_format)) {
    errors.push(`output_format must be one of: ${OUTPUT_FORMATS.join(', ')} (Got: ${contract.output_format})`);
  }

  // 7. Status
  if (!contract.status || !TASK_STATUS[contract.status]) {
    errors.push(`status must be a valid TASK_STATUS (Got: ${contract.status})`);
  }

  // 8. Traceable Knowledge Applications (if specified)
  if (contract.knowledge_applications) {
    if (!Array.isArray(contract.knowledge_applications)) {
      errors.push('knowledge_applications must be an array of knowledge application records.');
    } else {
      contract.knowledge_applications.forEach((app, idx) => {
        if (!app.rule_id || typeof app.rule_id !== 'string') {
          errors.push(`knowledge_applications[${idx}] missing valid rule_id.`);
        }
        if (!app.status || !Object.values(KNOWLEDGE_APPLICATION_STATUS).includes(app.status)) {
          errors.push(`knowledge_applications[${idx}] status must be one of: ${Object.values(KNOWLEDGE_APPLICATION_STATUS).join(', ')} (Got: ${app.status})`);
        }
        if (app.status === KNOWLEDGE_APPLICATION_STATUS.REJECTED) {
          if (!app.rejection_reason || typeof app.rejection_reason !== 'string' || app.rejection_reason.trim().length === 0) {
            errors.push(`knowledge_applications[${idx}] status is REJECTED but rejection_reason is missing or empty.`);
          }
        }
        if (app.status === KNOWLEDGE_APPLICATION_STATUS.APPLIED) {
          if (!Array.isArray(app.influenced_decisions) || app.influenced_decisions.length === 0) {
            errors.push(`knowledge_applications[${idx}] status is APPLIED but influenced_decisions must be a non-empty array.`);
          }
          if (!app.verification_method || typeof app.verification_method !== 'string') {
            errors.push(`knowledge_applications[${idx}] status is APPLIED but verification_method is required.`);
          }
        }
      });
    }
  }

  // 9. Task Profile (if specified)
  if (contract.task_profile && typeof contract.task_profile !== 'object') {
    errors.push('task_profile must be an object representing task dimensions.');
  }

  // 10. Required Capabilities (if specified — Milestone D1)
  if (contract.required_capabilities !== undefined) {
    if (!Array.isArray(contract.required_capabilities)) {
      errors.push('required_capabilities must be an array of capability ID strings.');
    } else {
      const seenCapIds = new Set();
      contract.required_capabilities.forEach((capId, idx) => {
        if (typeof capId !== 'string' || capId.trim() === '') {
          errors.push(`required_capabilities[${idx}] must be a non-empty string.`);
        } else if (!CAPABILITY_ID_REGEX.test(capId)) {
          errors.push(`required_capabilities[${idx}] '${capId}' is invalid. Must match pattern ^CAP-[A-Z0-9-]+$`);
        } else if (seenCapIds.has(capId)) {
          errors.push(`required_capabilities contains duplicate capability ID: '${capId}'.`);
        } else {
          seenCapIds.add(capId);
        }
      });
    }
  }

  // 11. Optional Subtasks (Milestone D3.1)
  if (contract.subtasks !== undefined) {
    const subListValidation = validateSubtaskList(contract.subtasks);
    if (!subListValidation.valid) {
      errors.push(...subListValidation.errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Creates a fully initialized, canonical Task Contract
 *
 * @param {object} options - Contract configuration options
 * @returns {object} Validated Task Contract
 */
export function createTaskContract(options = {}) {
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  const taskId = options.task_id || `task-${Date.now()}-${randomSuffix}`;
  const taskType = options.task_type || 'FEATURE';

  // Apply default negative constraints based on task type
  const defaultNegativeConstraints = [
    'Do not delete or harm existing working layout geometry or domain math.',
    'Do not execute unprompted git commit/push on child project working trees.',
    'Do not output unverified completion claims without live terminal evidence.'
  ];

  if (taskType === 'MICRO_FIX') {
    defaultNegativeConstraints.push('Do not perform full architectural refactors for isolated micro-fixes.');
  }

  const contract = {
    contract_version: '1.0.0',
    task_id: taskId,
    task_type: taskType,
    objective: (options.objective || '').trim(),
    created_at: new Date().toISOString(),
    status: TASK_STATUS.CREATED,

    constraints: {
      negative_constraints: Array.from(new Set([
        ...defaultNegativeConstraints,
        ...(options.negative_constraints || [])
      ])),
      anti_regression: options.anti_regression !== false,
      max_tokens_budget: options.max_tokens_budget || (taskType === 'MICRO_FIX' ? 500 : 1200),
      allowed_tools: options.allowed_tools || ['view_file', 'replace_file_content', 'run_command', 'grep_search']
    },

    context: {
      project_root: options.project_root || null,
      target_files: options.target_files || [],
      relevant_rules: options.relevant_rules || [],
      applicable_skills: options.applicable_skills || [],
      retrieved_tokens: 0,
      retrieval_query: options.retrieval_query || options.objective || ''
    },

    execution_plan: options.execution_plan || [],

    verification_criteria: {
      build_required: options.build_required !== false,
      terminal_proof_required: options.terminal_proof_required !== false,
      evidence_types: options.evidence_types || options.verification_criteria?.evidence_types || ['BUILD_EXIT_0', 'TEST_PASS'],
      required_exit_codes: [0]
    },

    output_format: options.output_format || 'SURGICAL_PATCH',

    checkpoint: {
      current_step: 0,
      total_steps: (options.execution_plan || []).length,
      last_checkpoint_at: null,
      state_payload: {}
    },

    task_profile: options.task_profile || {
      language: options.language || null,
      framework: options.framework || null,
      architecture: options.architecture || null,
      security_implications: options.security_implications || [],
      reliability_implications: options.reliability_implications || [],
      preconditions: options.preconditions || [],
      environmental_constraints: options.environmental_constraints || []
    },

    knowledge_applications: options.knowledge_applications || [],

    ...(options.required_capabilities !== undefined ? { required_capabilities: options.required_capabilities } : {}),

    ...(options.subtasks !== undefined ? { subtasks: options.subtasks } : {}),

    verification_results: {
      verified: false,
      evidence_collected: [],
      verified_at: null,
      failure_reason: null
    }
  };

  const validation = validateTaskContract(contract);
  if (!validation.valid) {
    throw new Error(`Failed to create valid Task Contract:\n- ${validation.errors.join('\n- ')}`);
  }

  return contract;
}

/**
 * Helper to check if two dependency arrays contain equivalent elements
 *
 * @param {Array} arrA
 * @param {Array} arrB
 * @returns {boolean}
 */
export function areDependencyArraysEquivalent(arrA, arrB) {
  if (!Array.isArray(arrA) || !Array.isArray(arrB)) return false;
  if (arrA.length !== arrB.length) return false;
  const setA = [...arrA].map(v => String(v).trim()).sort();
  const setB = [...arrB].map(v => String(v).trim()).sort();
  return setA.every((val, idx) => val === setB[idx]);
}

/**
 * Validates a single Decomposed Subtask Contract (Milestone D3.1)
 *
 * @param {object} subtask - Subtask object to validate
 * @param {object} context - Validation context (e.g. { known_ids: Set })
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateSubtask(subtask, context = {}) {
  const errors = [];

  if (!subtask || typeof subtask !== "object") {
    return { valid: false, errors: ["Subtask must be a non-null object."] };
  }

  // Alias conflict check: id vs step_id
  if (subtask.id !== undefined && subtask.step_id !== undefined) {
    if (String(subtask.id).trim() !== String(subtask.step_id).trim()) {
      errors.push("Conflicting identifier aliases: 'id' (" + JSON.stringify(subtask.id) + ") and 'step_id' (" + JSON.stringify(subtask.step_id) + ") must have matching values.");
    }
  }

  // Alias conflict check: dependencies vs depends_on
  if (subtask.dependencies !== undefined && subtask.depends_on !== undefined) {
    if (!areDependencyArraysEquivalent(subtask.dependencies, subtask.depends_on)) {
      errors.push("Conflicting dependency aliases: 'dependencies' (" + JSON.stringify(subtask.dependencies) + ") and 'depends_on' (" + JSON.stringify(subtask.depends_on) + ") must contain matching elements.");
    }
  }

  // 1. Identifier (id / subtask_id / step_id)
  const id = subtask.id !== undefined ? subtask.id : (subtask.subtask_id !== undefined ? subtask.subtask_id : subtask.step_id);
  if (id === undefined || id === null) {
    errors.push("subtask id is required (id, subtask_id, or step_id).");
  } else if (typeof id === "string") {
    if (id.trim().length === 0) {
      errors.push("subtask id string must be non-empty.");
    }
  } else if (typeof id === "number") {
    if (!Number.isInteger(id) || id <= 0) {
      errors.push("subtask numeric id must be a positive integer (Got: " + id + ").");
    }
  } else {
    errors.push("subtask id must be a string or positive integer (Got: " + (typeof id) + ").");
  }

  // 2. Objective / Title / Action
  const objective = subtask.objective !== undefined ? subtask.objective : (subtask.title !== undefined ? subtask.title : subtask.action);
  if (objective === undefined || objective === null) {
    errors.push("subtask objective is required (objective, title, or action).");
  } else if (typeof objective !== "string" || objective.trim().length < 3) {
    errors.push("subtask objective must be a string of at least 3 characters.");
  }

  // 3. Required Capabilities (if specified)
  if (subtask.required_capabilities !== undefined) {
    if (!Array.isArray(subtask.required_capabilities)) {
      errors.push("subtask.required_capabilities must be an array of capability ID strings.");
    } else {
      const seenCapIds = new Set();
      subtask.required_capabilities.forEach((capId, idx) => {
        if (typeof capId !== "string" || capId.trim() === "") {
          errors.push("subtask.required_capabilities[" + idx + "] must be a non-empty string.");
        } else if (!CAPABILITY_ID_REGEX.test(capId)) {
          errors.push("subtask.required_capabilities[" + idx + "] '" + capId + "' is invalid. Must match pattern ^CAP-[A-Z0-9-]+$");
        } else if (seenCapIds.has(capId)) {
          errors.push("subtask.required_capabilities contains duplicate capability ID: '" + capId + "'.");
        } else {
          seenCapIds.add(capId);
        }
      });
    }
  }

  // 4. Dependencies / depends_on (if specified)
  const deps = subtask.dependencies !== undefined ? subtask.dependencies : subtask.depends_on;
  if (deps !== undefined) {
    if (!Array.isArray(deps)) {
      errors.push("subtask dependencies must be an array of prerequisite subtask IDs.");
    } else {
      const seenDeps = new Set();
      const normSeenDeps = new Set();
      deps.forEach((depId, idx) => {
        if (depId === undefined || depId === null || (typeof depId !== "string" && typeof depId !== "number") || (typeof depId === "string" && depId.trim() === "")) {
          errors.push("subtask dependency at index " + idx + " must be a non-empty string or integer.");
        } else {
          const normDep = String(depId).trim();
          if (id !== undefined && (depId === id || normDep === String(id).trim())) {
            errors.push("subtask cannot depend on itself (self-dependency: " + depId + ").");
          }
          if (seenDeps.has(depId) || normSeenDeps.has(normDep)) {
            errors.push("subtask contains duplicate dependency reference: '" + depId + "'.");
          } else {
            seenDeps.add(depId);
            normSeenDeps.add(normDep);
          }
          if (context.known_ids && !context.known_ids.has(depId) && !context.known_ids.has(normDep)) {
            errors.push("subtask depends on unknown subtask id: '" + depId + "'.");
          }
        }
      });
    }
  }

  // 5. Status (if specified)
  if (subtask.status !== undefined) {
    if (typeof subtask.status !== "string" || !Object.values(SUBTASK_STATUS).includes(subtask.status)) {
      errors.push("subtask status must be one of: " + Object.values(SUBTASK_STATUS).join(", ") + " (Got: " + subtask.status + ")");
    }
  }

  // 6. Failure Policy (if specified)
  if (subtask.failure_policy !== undefined) {
    if (typeof subtask.failure_policy !== "string" || !Object.values(FAILURE_POLICIES).includes(subtask.failure_policy)) {
      errors.push("subtask failure_policy must be one of: " + Object.values(FAILURE_POLICIES).join(", ") + " (Got: " + subtask.failure_policy + ")");
    }
  }

  // 7. Inputs (if specified)
  if (subtask.inputs !== undefined && (typeof subtask.inputs !== "object" || subtask.inputs === null)) {
    errors.push("subtask inputs must be an object or array.");
  }

  // 8. Expected Output (if specified)
  if (subtask.expected_output !== undefined && (typeof subtask.expected_output !== "string" && (typeof subtask.expected_output !== "object" || subtask.expected_output === null))) {
    errors.push("subtask expected_output must be a string or object.");
  }

  // 9. Acceptance Criteria (if specified)
  if (subtask.acceptance_criteria !== undefined) {
    if (!Array.isArray(subtask.acceptance_criteria)) {
      errors.push("subtask acceptance_criteria must be an array of strings.");
    } else {
      subtask.acceptance_criteria.forEach((crit, idx) => {
        if (typeof crit !== "string" || crit.trim().length === 0) {
          errors.push("subtask acceptance_criteria[" + idx + "] must be a non-empty string.");
        }
      });
    }
  }

  // 10. Verification Requirements / Verification Probe (if specified)
  const probe = subtask.verification_requirements !== undefined ? subtask.verification_requirements : subtask.verification_probe;
  if (probe !== undefined && typeof probe !== "string" && (typeof probe !== "object" || probe === null)) {
    errors.push("subtask verification requirements must be a string command or object.");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates a collection of subtasks for a task
 *
 * @param {Array<object>} subtasks - Array of subtask objects
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateSubtaskList(subtasks) {
  const errors = [];

  if (!Array.isArray(subtasks)) {
    return { valid: false, errors: ["subtasks must be an array."] };
  }

  const seenIds = new Set();
  const normIds = new Set();
  const knownIds = new Set();

  // First pass: collect all valid IDs and check uniqueness / collisions
  for (let i = 0; i < subtasks.length; i++) {
    const s = subtasks[i];
    if (s && typeof s === "object") {
      const id = s.id !== undefined ? s.id : (s.subtask_id !== undefined ? s.subtask_id : s.step_id);
      if (id !== undefined && id !== null) {
        const normId = String(id).trim();
        if (seenIds.has(id)) {
          errors.push("Duplicate subtask id detected: '" + id + "'.");
        } else if (normIds.has(normId)) {
          errors.push("Duplicate subtask id detected (ID collision): '" + id + "'.");
        } else {
          seenIds.add(id);
          normIds.add(normId);
          knownIds.add(id);
          knownIds.add(normId);
        }
      }
    }
  }

  // Second pass: validate individual subtasks with knownIds context
  subtasks.forEach((s, idx) => {
    const subValidation = validateSubtask(s, { known_ids: knownIds });
    if (!subValidation.valid) {
      subValidation.errors.forEach(err => {
        errors.push("subtasks[" + idx + "]: " + err);
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Creates and validates a standardized Decomposed Subtask object (Milestone D3.1)
 *
 * @param {object} options - Subtask configuration options
 * @returns {object} Validated Subtask object
 */
export function createSubtask(options = {}) {
  const id = options.id !== undefined
    ? options.id
    : (options.subtask_id !== undefined
      ? options.subtask_id
      : (options.step_id !== undefined ? options.step_id : ("sub-" + crypto.randomBytes(4).toString("hex"))));

  const title = (options.title || options.objective || options.action || "").trim();
  const objective = (options.objective || options.title || options.action || "").trim();
  const action = (options.action || options.objective || options.title || "").trim();

  let deps;
  let conflictingDependsOn;
  if (options.dependencies !== undefined && options.depends_on !== undefined) {
    if (!areDependencyArraysEquivalent(options.dependencies, options.depends_on)) {
      deps = options.dependencies;
      conflictingDependsOn = options.depends_on;
    } else {
      deps = options.dependencies;
    }
  } else if (Array.isArray(options.dependencies)) {
    deps = options.dependencies;
  } else if (Array.isArray(options.depends_on)) {
    deps = options.depends_on;
  } else {
    deps = [];
  }

  const subtask = {
    id,
    step_id: options.step_id !== undefined ? options.step_id : (typeof id === "number" ? id : undefined),
    subtask_id: typeof id === "string" ? id : ("step-" + id),
    title: title || ("Subtask " + id),
    objective: objective || title || ("Subtask " + id),
    action: action || objective || ("Subtask " + id),
    dependencies: deps,
    depends_on: conflictingDependsOn !== undefined ? conflictingDependsOn : deps,
    status: options.status || SUBTASK_STATUS.PENDING,
    failure_policy: options.failure_policy || FAILURE_POLICIES.ABORT,
    ...(options.task_type !== undefined ? { task_type: options.task_type } : {}),
    ...(options.required_capabilities !== undefined ? { required_capabilities: options.required_capabilities } : {}),
    ...(options.assigned_skill_id !== undefined ? { assigned_skill_id: options.assigned_skill_id } : {}),
    ...(options.inputs !== undefined ? { inputs: options.inputs } : {}),
    ...(options.expected_output !== undefined ? { expected_output: options.expected_output } : {}),
    ...(options.acceptance_criteria !== undefined ? { acceptance_criteria: options.acceptance_criteria } : {}),
    ...(options.verification_requirements !== undefined ? { verification_requirements: options.verification_requirements } : {}),
    ...(options.verification_probe !== undefined ? { verification_probe: options.verification_probe } : {})
  };

  const validation = validateSubtask(subtask);
  if (!validation.valid) {
    throw new Error("Failed to create valid Subtask:\n- " + validation.errors.join("\n- "));
  }

  return subtask;
}

/**
 * Creates a standardized Agent Handoff Contract payload.
 * Preserves original objective, criteria, repo/workspace identity, git state,
 * completed & pending steps, artifacts, test evidence, known failures, and safety bounds.
 *
 * @param {object} contract - The task contract
 * @param {object} options - Additional handoff options
 * @returns {object} Standardized handoff payload
 */
export function createAgentHandoffPayload(contract, options = {}) {
  const completedSteps = (contract.execution_plan || [])
    .filter(s => s.status === 'COMPLETED')
    .map(s => ({ step_id: s.step_id, title: s.title, evidence: s.evidence }));

  const pendingSteps = (contract.execution_plan || [])
    .filter(s => s.status === 'PENDING')
    .map(s => ({ step_id: s.step_id, title: s.title, depends_on: s.depends_on }));

  const nextStep = pendingSteps[0] || null;

  return {
    handoff_id: `handoff_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    task_id: contract.task_id,
    timestamp: new Date().toISOString(),
    from_provider: options.from_provider || 'CURRENT_AGENT',
    to_provider: options.to_provider || 'NEXT_CASCADE_AGENT',
    switch_reason: options.switch_reason || 'PROACTIVE_QUOTA_THRESHOLD',
    objective: contract.objective,
    acceptance_criteria: contract.verification_criteria,
    workspace: {
      project_root: options.project_root || contract.context.project_root || process.cwd(),
      git_branch: options.git_branch || 'main',
      git_commit: options.git_commit || null,
      workspace_verified_by_successor: false
    },
    plan_progress: {
      current_step: contract.checkpoint.current_step,
      total_steps: contract.checkpoint.total_steps,
      completed_steps: completedSteps,
      pending_steps: pendingSteps,
      next_action: nextStep ? nextStep.title : null
    },
    changed_files: options.changed_files || contract.checkpoint.state_payload?.changed_files || [],
    artifact_references: options.artifact_references || contract.checkpoint.state_payload?.artifacts || [],
    test_evidence: options.test_evidence || contract.checkpoint.state_payload?.test_evidence || [],
    known_failures: options.known_failures || [],
    unresolved_risks: options.unresolved_risks || [],
    safety_restrictions: [
      'NO_DIRECT_GIT_PUSH',
      'NO_DIRECT_GIT_MERGE',
      'NO_DESTRUCTIVE_RESET',
      'NO_DELETE_USER_DATA_OR_BACKUPS',
      'NO_SECRET_MODIFICATION',
      'WORKSPACE_VERIFICATION_REQUIRED_BEFORE_WRITE'
    ]
  };
}

/**
 * Validates an Agent Handoff Contract
 *
 * @param {object} handoff - Handoff object
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateAgentHandoffContract(handoff) {
  const errors = [];
  if (!handoff || typeof handoff !== 'object') {
    return { valid: false, errors: ['Handoff contract must be a non-null object.'] };
  }
  if (!handoff.handoff_id) errors.push('handoff_id is required.');
  if (!handoff.task_id) errors.push('task_id is required.');
  if (!handoff.objective) errors.push('objective is required.');
  if (!handoff.workspace || !handoff.workspace.project_root) errors.push('workspace.project_root is required.');
  if (!handoff.plan_progress) errors.push('plan_progress is required.');
  if (!Array.isArray(handoff.safety_restrictions) || handoff.safety_restrictions.length === 0) {
    errors.push('safety_restrictions must be a non-empty array.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
