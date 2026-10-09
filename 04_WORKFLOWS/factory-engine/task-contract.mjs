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
  VERIFIED: 'VERIFIED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
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
      evidence_types: options.evidence_types || ['BUILD_EXIT_0', 'TEST_PASS'],
      required_exit_codes: [0]
    },

    output_format: options.output_format || 'SURGICAL_PATCH',

    checkpoint: {
      current_step: 0,
      total_steps: (options.execution_plan || []).length,
      last_checkpoint_at: null,
      state_payload: {}
    },

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
