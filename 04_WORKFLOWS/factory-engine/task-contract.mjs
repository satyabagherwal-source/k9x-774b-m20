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
