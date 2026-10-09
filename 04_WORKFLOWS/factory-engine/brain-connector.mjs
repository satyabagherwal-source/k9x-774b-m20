/**
 * Universal Brain Connector & Service Layer
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\brain-connector.mjs
 * Purpose: Connects any AI model (Claude, Gemini, GPT, DeepSeek, Antigravity, local Ollama)
 *          to Brain services: Precision Knowledge Retrieval, Negative Constraint Injection,
 *          Task Checkpointing, and Empirical Verification Verification.
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { retrieveKnowledge } from './retrieval-engine.mjs';
import { TASK_STATUS, validateTaskContract } from './task-contract.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

const CHECKPOINTS_FILE = path.join(BRAIN_ROOT, '.project-brain', 'task-checkpoints.json');

/**
 * Ensures checkpoint storage directory and file exist
 */
function ensureCheckpointsStorage() {
  const dir = path.dirname(CHECKPOINTS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(CHECKPOINTS_FILE)) {
    fs.writeFileSync(CHECKPOINTS_FILE, JSON.stringify({ version: '1.0.0', tasks: {} }, null, 2), 'utf-8');
  }
}

/**
 * Loads all task checkpoints from durable storage
 */
export function loadAllCheckpoints() {
  ensureCheckpointsStorage();
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINTS_FILE, 'utf-8'));
  } catch (e) {
    return { version: '1.0.0', tasks: {} };
  }
}

/**
 * Resolves context for a Task Contract using Hybrid Retrieval Engine (Milestone 1)
 * 
 * @param {object} contract - The task contract
 * @returns {object} Updated contract with resolved rules and skills
 */
export function resolveTaskContext(contract) {
  const validation = validateTaskContract(contract);
  if (!validation.valid) {
    throw new Error(`Invalid contract passed to resolveTaskContext: ${validation.errors.join(', ')}`);
  }

  const query = contract.context.retrieval_query || contract.objective;
  const budget = contract.constraints.max_tokens_budget || 1200;

  // Retrieve precision knowledge within token budget
  const retrieval = retrieveKnowledge(query, {
    maxTokens: budget,
    topK: contract.task_type === 'MICRO_FIX' ? 2 : 4,
    format: 'compact'
  });

  contract.context.relevant_rules = retrieval.items.map(item => ({
    id: item.id,
    title: item.title,
    category: item.category,
    filePath: item.filePath,
    lineRange: item.lineRange,
    summary: item.summary
  }));

  contract.context.retrieved_tokens = retrieval.estimatedTokens;
  contract.context.retrieval_prompt_block = retrieval.promptBlock;
  contract.status = TASK_STATUS.CONTEXT_RESOLVED;

  return contract;
}

/**
 * Prepares an ultra-dense, token-efficient instruction and execution prompt for any AI model
 * 
 * @param {object} contract - Contract with resolved context
 * @param {object} options - Prompt formatting options
 * @returns {object} { systemInstruction: string, userPrompt: string, estimatedTokens: number }
 */
export function formatExecutionPrompt(contract, options = {}) {
  if (contract.status === TASK_STATUS.CREATED) {
    resolveTaskContext(contract);
  }

  // 1. Mandatory Negative Constraints Block
  const negativeList = contract.constraints.negative_constraints
    .map(c => `- 🛑 **NON-NEGOTIABLE BAN**: ${c}`)
    .join('\n');

  // 2. Verification Criteria Block
  const verificationList = [
    contract.verification_criteria.build_required ? '- 🔨 Production build exit code 0 required (`BUILD_EXIT_0`).' : '',
    contract.verification_criteria.terminal_proof_required ? '- 🖥️ Live terminal execution proof required.' : '',
    `- 📋 Required Evidence Types: [${contract.verification_criteria.evidence_types.join(', ')}]`
  ].filter(Boolean).join('\n');

  // 3. System Instruction
  const systemInstruction = 
`# AI-BUILDER-BRAIN UNIVERSAL EXECUTION PROTOCOL
> **Foundational Axiom**: AI-Builder-Brain is DATA, not an AI agent. You are connecting to the Coding Universe's verified intelligence substrate.
> **Anti-Regression Shield**: Surgical edits only. Never rewrite working files, never break layout geometry, never mutate domain mathematics.

## MANDATORY NEGATIVE CONSTRAINTS (HIGHEST PRIORITY):
${negativeList}

## VERIFICATION CRITERIA (COMPLETION BARRIER):
${verificationList}
`;

  // 4. User Prompt with Precision Retrieved Knowledge
  const userPrompt =
`## TASK CONTRACT: [${contract.task_id}] (${contract.task_type})

### OBJECTIVE:
${contract.objective}

### OUTPUT FORMAT:
${contract.output_format}

${contract.context.retrieval_prompt_block || ''}

### EXECUTION DIRECTIVE:
Execute this task strictly adhering to the retrieved invariants and negative constraints above. Produce the output in ${contract.output_format} format and provide the required verification evidence.`;

  const totalChars = systemInstruction.length + userPrompt.length;
  const estimatedTokens = Math.ceil(totalChars / 4);

  return {
    taskId: contract.task_id,
    taskType: contract.task_type,
    systemInstruction,
    userPrompt,
    estimatedTokens,
    maxBudget: contract.constraints.max_tokens_budget,
    withinBudget: estimatedTokens <= (contract.constraints.max_tokens_budget + 400) // including system prompt overhead
  };
}

/**
 * Records a durable checkpoint for an active Task Contract
 * 
 * @param {object} contract - The task contract
 * @param {number} stepIndex - Current step index reached
 * @param {object} statePayload - Arbitrary state payload (files modified, variables, etc.)
 */
export function recordTaskCheckpoint(contract, stepIndex = 0, statePayload = {}, explicitStatus = null) {
  ensureCheckpointsStorage();
  const db = loadAllCheckpoints();

  contract.checkpoint.current_step = stepIndex;
  contract.checkpoint.last_checkpoint_at = new Date().toISOString();
  contract.checkpoint.state_payload = statePayload;

  if (explicitStatus) {
    contract.status = explicitStatus;
  } else if (contract.status === TASK_STATUS.CREATED || contract.status === TASK_STATUS.CONTEXT_RESOLVED) {
    contract.status = TASK_STATUS.IN_PROGRESS;
  }

  db.tasks[contract.task_id] = {
    task_id: contract.task_id,
    task_type: contract.task_type,
    objective: contract.objective,
    status: contract.status,
    checkpoint: contract.checkpoint,
    created_at: contract.created_at,
    updated_at: new Date().toISOString()
  };

  fs.writeFileSync(CHECKPOINTS_FILE, JSON.stringify(db, null, 2), 'utf-8');
  return contract;
}

/**
 * Loads a specific task checkpoint from durable storage
 * 
 * @param {string} taskId - The unique task ID
 * @returns {object|null} The stored task record or null
 */
export function loadTaskCheckpoint(taskId) {
  const db = loadAllCheckpoints();
  return db.tasks[taskId] || null;
}

/**
 * Verifies execution evidence against the contract's verification criteria
 * 
 * @param {object} contract - The task contract
 * @param {object} executionEvidence - Evidence submitted from live execution
 * @returns {object} { verified: boolean, failureReason: string|null, contract: object }
 */
export function verifyExecutionResult(contract, executionEvidence = {}) {
  const criteria = contract.verification_criteria;
  const collected = [];
  let verified = true;
  let failureReason = null;

  // 1. Check Build Requirement
  if (criteria.build_required) {
    if (executionEvidence.buildExitCode === 0 || executionEvidence.buildSuccess === true) {
      collected.push('BUILD_EXIT_0');
    } else {
      verified = false;
      failureReason = `Build failed or missing: exit code was ${executionEvidence.buildExitCode}`;
    }
  }

  // 2. Check Terminal Proof
  if (criteria.terminal_proof_required && verified) {
    if (executionEvidence.terminalOutput && executionEvidence.terminalOutput.trim().length > 0) {
      collected.push('TERMINAL_PROOF_COLLECTED');
    } else {
      verified = false;
      failureReason = 'Terminal proof required but no terminal output was provided.';
    }
  }

  // 3. Check Specific Evidence Types
  if (verified && criteria.evidence_types) {
    for (const expectedType of criteria.evidence_types) {
      if (executionEvidence.evidenceTypes && executionEvidence.evidenceTypes.includes(expectedType)) {
        collected.push(expectedType);
      } else if (expectedType === 'BUILD_EXIT_0' && collected.includes('BUILD_EXIT_0')) {
        // already verified
      } else {
        verified = false;
        failureReason = `Missing required evidence type: ${expectedType}`;
        break;
      }
    }
  }

  contract.verification_results = {
    verified,
    evidence_collected: collected,
    verified_at: verified ? new Date().toISOString() : null,
    failure_reason: failureReason
  };

  contract.status = verified ? TASK_STATUS.VERIFIED : TASK_STATUS.FAILED;

  // Persist final verification state to checkpoint storage
  recordTaskCheckpoint(contract, contract.checkpoint.current_step, {
    verification: contract.verification_results
  }, contract.status);

  return {
    verified,
    failureReason,
    contract
  };
}
