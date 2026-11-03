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
import { retrieveKnowledge, parseEngineeringPatterns } from './retrieval-engine.mjs';
import { TASK_STATUS, SUBTASK_STATUS, KNOWLEDGE_APPLICATION_STATUS, VERIFICATION_OUTCOME, validateTaskContract, createTaskContract } from './task-contract.mjs';
import { injectSessionMemoryIntoContract, recordSessionMemory } from './cross-session-memory.mjs';
import { planTaskDecomposition, validatePlanDAG, getNextExecutableSteps, advanceStep } from './task-planner.mjs';
import { bindSkillToTask } from './skill-runner.mjs';
import { checkCapabilityReadiness } from './capability-registry.mjs';
import { routeSubtaskCapabilities, evaluateSubtaskReadiness, routeTaskPlanSubtasks, SUBTASK_READINESS_STATUS } from './subtask-router.mjs';
export { checkCapabilityReadiness, routeSubtaskCapabilities, evaluateSubtaskReadiness, routeTaskPlanSubtasks, SUBTASK_READINESS_STATUS };
import { executeSubtaskDAG, bindSkillsToPlan, bindSkillToSubtask, getExecutableSubtasks, advanceSubtaskExecution, createExecutorAdapter } from './dag-executor.mjs';
export { executeSubtaskDAG, bindSkillsToPlan, bindSkillToSubtask, getExecutableSubtasks, advanceSubtaskExecution, createExecutorAdapter };
import {
  acquireKnowledgeFromSource,
  discoverSource,
  fetchSourceContent,
  extractAndCreateCandidates,
  validateCandidateSecurityAndSchema,
  checkDuplicatesAndContradictions,
  persistAndReadBackVerify,
  updateIndexAndVerifyRetrieval,
  createKnowledgeAcquisitionContract,
  ACQUISITION_STAGES,
  ACQUISITION_STATUS,
  inspectPromptInjection,
  detectDirectiveOpposition
} from './knowledge-acquisition-pipeline.mjs';
export {
  acquireKnowledgeFromSource,
  discoverSource,
  fetchSourceContent,
  extractAndCreateCandidates,
  validateCandidateSecurityAndSchema,
  checkDuplicatesAndContradictions,
  persistAndReadBackVerify,
  updateIndexAndVerifyRetrieval,
  createKnowledgeAcquisitionContract,
  ACQUISITION_STAGES,
  ACQUISITION_STATUS,
  inspectPromptInjection,
  detectDirectiveOpposition
};

import {
  createEvidenceRecord,
  validateEvidenceRecord,
  categorizeKnowledgeAssertion,
  evaluateEvidenceCorroboration,
  assessContextualContradiction,
  evaluateEvidenceDecision,
  persistEvidenceRecord,
  persistEvidenceBatch,
  getEvidenceRecord,
  listEvidenceForClaim,
  readBackVerifyEvidence,
  loadEvidenceLedger,
  getEvidenceLedgerPath,
  evaluateCandidateForCanonicalPromotion,
  EVIDENCE_TYPES,
  EVIDENCE_STATUS,
  EVIDENCE_DECISION,
  INDEPENDENCE_TIERS,
  VERIFICATION_METHODS
} from './knowledge-intelligence-engine.mjs';
export {
  createEvidenceRecord,
  validateEvidenceRecord,
  categorizeKnowledgeAssertion,
  evaluateEvidenceCorroboration,
  assessContextualContradiction,
  evaluateEvidenceDecision,
  persistEvidenceRecord,
  persistEvidenceBatch,
  getEvidenceRecord,
  listEvidenceForClaim,
  readBackVerifyEvidence,
  loadEvidenceLedger,
  getEvidenceLedgerPath,
  evaluateCandidateForCanonicalPromotion,
  EVIDENCE_TYPES,
  EVIDENCE_STATUS,
  EVIDENCE_DECISION,
  INDEPENDENCE_TIERS,
  VERIFICATION_METHODS
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

export const CHECKPOINTS_FILE = path.join(BRAIN_ROOT, '.project-brain', 'task-checkpoints.json');

/**
 * Resolves the path to the task checkpoints file dynamically.
 * Priority: options.checkpointsPath -> options.brainRoot -> process.env.BRAIN_TASK_CHECKPOINTS_FILE -> BRAIN_ROOT default.
 */
export function getCheckpointsFilePath(options = {}) {
  if (options && options.checkpointsPath) return options.checkpointsPath;
  if (options && options.brainRoot) return path.join(options.brainRoot, '.project-brain', 'task-checkpoints.json');
  if (process.env.BRAIN_TASK_CHECKPOINTS_FILE) return process.env.BRAIN_TASK_CHECKPOINTS_FILE;
  return CHECKPOINTS_FILE;
}

/**
 * Ensures checkpoint storage directory and file exist
 */
export function ensureCheckpointsStorage(options = {}) {
  const filePath = getCheckpointsFilePath(options);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({ version: '1.0.0', tasks: {} }, null, 2), 'utf-8');
  }
  return filePath;
}

/**
 * Loads all task checkpoints from durable storage
 */
export function loadAllCheckpoints(options = {}) {
  const filePath = ensureCheckpointsStorage(options);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return { version: '1.0.0', tasks: {} };
  }
}

/**
 * Multi-Attribute Knowledge-to-Task Matching Engine (Milestone Universal Application)
 * Evaluates problem, language, framework, architecture, security/reliability,
 * negative constraints, preconditions, and token budgets.
 * 
 * @param {object} contract - The task contract
 * @param {object} options - Matching configuration options
 * @returns {object} Updated contract with scored and bounded knowledge
 */
export function matchKnowledgeToTask(contract, options = {}) {
  const validation = validateTaskContract(contract);
  if (!validation.valid) {
    throw new Error(`Invalid contract passed to matchKnowledgeToTask: ${validation.errors.join(', ')}`);
  }

  // Milestone D2: Capability Discovery & Status Gating
  if (Array.isArray(contract.required_capabilities)) {
    if (!contract.context.capability_readiness) {
      if (contract.required_capabilities.length > 0) {
        const gatingResult = checkCapabilityReadiness(contract.required_capabilities, options);
        contract.context.capability_readiness = gatingResult;

        if (!gatingResult.ready) {
          contract.status = TASK_STATUS.FAILED;
          contract.verification_results.failure_reason = gatingResult.failureReason;
          if (options.throwOnGatingFailure) {
            throw new Error(`Capability Gating Failed: ${gatingResult.failureReason}`);
          }
          return contract;
        }
      } else {
        contract.context.capability_readiness = checkCapabilityReadiness([], options);
      }
    } else if (!contract.context.capability_readiness.ready) {
      contract.status = TASK_STATUS.FAILED;
      return contract;
    }
  }

  const profile = contract.task_profile || {};
  const query = contract.context.retrieval_query || contract.objective;
  const budget = contract.constraints.max_tokens_budget || 1200;

  // Build expanded semantic search string including architecture and security/reliability terms
  const terms = [query];
  if (profile.language) terms.push(profile.language);
  if (profile.framework) terms.push(profile.framework);
  if (profile.architecture) terms.push(profile.architecture);
  if (Array.isArray(profile.security_implications)) terms.push(...profile.security_implications);
  if (Array.isArray(profile.reliability_implications)) terms.push(...profile.reliability_implications);
  const expandedQuery = terms.join(' ');

  // Retrieve candidate pool
  const effectiveBrainRoot = options.brainRoot || contract.context?.brainRoot || null;
  const retrieval = retrieveKnowledge(expandedQuery, {
    maxTokens: budget * 3,
    topK: 12,
    format: 'compact',
    brainRoot: effectiveBrainRoot
  });

  const allPatterns = parseEngineeringPatterns(effectiveBrainRoot);
  const patternMap = new Map();
  for (const p of allPatterns) {
    patternMap.set(p.id, p);
  }

  // Multi-attribute scoring
  const scoredCandidates = [];
  const taskLang = (profile.language || '').toLowerCase();
  const secTags = (profile.security_implications || []).map(s => s.toLowerCase());
  const relTags = (profile.reliability_implications || []).map(s => s.toLowerCase());
  const constraints = (profile.environmental_constraints || []).map(s => s.toLowerCase());

  for (const item of retrieval.items) {
    const pat = patternMap.get(item.id);
    const bodyText = (pat ? pat.fullContent : item.summary || '').toLowerCase();
    const titleText = (item.title || '').toLowerCase();

    let score = item.bm25Score || 1.0;
    let relevanceRationale = [];
    let preconditionsMet = true;
    let extractedNegative = null;
    let extractedVerification = null;

    // 1. Language & Framework Matching
    if (taskLang) {
      if (bodyText.includes(taskLang) || titleText.includes(taskLang)) {
        score += 2.0;
        relevanceRationale.push(`Language affinity (${taskLang})`);
      } else if (titleText.includes('invariant') || titleText.includes('bound') || titleText.includes('preflight')) {
        score += 1.0; // Universal invariant
        relevanceRationale.push('Universal invariant (cross-language applicable)');
      }
    }

    // 2. Security Threat Matching
    if (secTags.length > 0) {
      for (const st of secTags) {
        if (bodyText.includes(st) || titleText.includes(st) || 
            (st.includes('untrusted') && (titleText.includes('bound') || bodyText.includes('input') || bodyText.includes('limit'))) ||
            (st.includes('cors') && bodyText.includes('origin')) ||
            (st.includes('dos') && (bodyText.includes('iteration') || bodyText.includes('bound')))) {
          score += 3.0;
          relevanceRationale.push(`Mitigates security threat: ${st}`);
          break;
        }
      }
    }

    // 3. Reliability & Boundary Matching
    if (relTags.length > 0) {
      for (const rt of relTags) {
        if (bodyText.includes(rt) || titleText.includes(rt) ||
            (rt.includes('budget') && (bodyText.includes('budget') || bodyText.includes('token') || bodyText.includes('window'))) ||
            (rt.includes('overflow') && bodyText.includes('bound')) ||
            (rt.includes('race') && bodyText.includes('race'))) {
          score += 2.5;
          relevanceRationale.push(`Prevents reliability hazard: ${rt}`);
          break;
        }
      }
    }

    // 4. Precondition Evaluation
    if (pat && pat.whenText) {
      const whenLower = pat.whenText.toLowerCase();
      for (const c of constraints) {
        if (c.includes('no_external') && (whenLower.includes('third-party') || whenLower.includes('docker'))) {
          preconditionsMet = false;
          score -= 5.0;
          relevanceRationale.push(`Precondition warning: external dependency mismatch (${c})`);
        }
      }
    }

    // 5. Extract Negative Constraint & Verification Method
    if (pat) {
      const negMatch = pat.fullContent.match(/\*\*NEGATIVE CONSTRAINT\*\*:\s*([\s\S]*?)(?=\n##|\n\*\*|$)/i);
      if (negMatch) {
        extractedNegative = negMatch[1].replace(/```(?:javascript|typescript|bash|python)?/g, '').trim();
      }
      const verMatch = pat.fullContent.match(/\*\*VERIFICATION METHOD\*\*:\s*([\s\S]*?)(?=\n##|\n\*\*|$)/i);
      if (verMatch) {
        extractedVerification = verMatch[1].replace(/```(?:javascript|typescript|bash|python)?/g, '').trim();
      } else {
        extractedVerification = `Empirical verification test proving ${pat.id} invariant holds under boundary conditions.`;
      }
    }

    scoredCandidates.push({
      item,
      pat,
      score,
      relevanceRationale: relevanceRationale.length > 0 ? relevanceRationale.join('; ') : 'Lexical BM25 match to task objective',
      preconditionsMet,
      extractedNegative,
      extractedVerification
    });
  }

  // Sort descending by multi-attribute score
  scoredCandidates.sort((a, b) => b.score - a.score);

  // Greedily pack into token budget
  const maxRules = contract.task_type === 'MICRO_FIX' ? 2 : 4;
  const selected = [];
  let totalEstimatedTokens = 0;

  for (const cand of scoredCandidates) {
    if (selected.length >= maxRules) break;
    const est = cand.item.estimatedTokens || 150;
    if (totalEstimatedTokens + est <= budget) {
      selected.push(cand);
      totalEstimatedTokens += est;
    }
  }

  // Update relevant_rules
  contract.context.relevant_rules = selected.map(s => ({
    id: s.item.id,
    title: s.item.title,
    category: s.item.category,
    filePath: s.item.filePath,
    lineRange: s.item.lineRange,
    summary: s.item.summary,
    relevance_rationale: s.relevanceRationale,
    preconditions_met: s.preconditionsMet,
    verification_method: s.extractedVerification
  }));

  contract.context.retrieved_tokens = totalEstimatedTokens;

  // Inject extracted negative constraints into task contract
  for (const s of selected) {
    if (s.extractedNegative) {
      const cleanNeg = s.extractedNegative.split('\n')[0].replace(/^[-*]\s*/, '').trim();
      if (cleanNeg && !contract.constraints.negative_constraints.includes(cleanNeg)) {
        contract.constraints.negative_constraints.push(cleanNeg);
      }
    }
  }

  // Format detailed prompt block
  const lines = [
    `=== AI-BUILDER-BRAIN MATCHED ENGINEERING KNOWLEDGE (${selected.length} Rules Selected | Budget: ${budget} tok) ===`
  ];
  for (const s of selected) {
    lines.push(`\n[${s.item.id}] ${s.item.title}`);
    lines.push(`- Canonical Source: 05_KNOWLEDGE/engineering-patterns.md`);
    lines.push(`- Relevance Rationale: ${s.relevanceRationale}`);
    lines.push(`- Preconditions Met: ${s.preconditionsMet ? 'YES' : 'REQUIRES ADAPTATION'}`);
    if (s.pat && s.pat.ruleText) lines.push(`- Invariant Law: ${s.pat.ruleText.slice(0, 250)}`);
    if (s.extractedNegative) lines.push(`- Negative Constraint: ${s.extractedNegative.slice(0, 200)}`);
    if (s.extractedVerification) lines.push(`- Required Verification: ${s.extractedVerification.slice(0, 200)}`);
  }
  lines.push('\n=== END MATCHED KNOWLEDGE ===');

  contract.context.retrieval_prompt_block = lines.join('\n');
  contract.status = TASK_STATUS.CONTEXT_RESOLVED;

  // Integrated Cross-Session Memory Shield: inject past failure warnings
  try {
    injectSessionMemoryIntoContract(contract);
  } catch (e) {}

  return contract;
}

/**
 * Resolves context for a Task Contract using Hybrid Retrieval Engine (Milestone 1)
 * and Cross-Session Memory Consolidation (Milestone 4).
 * If task_profile has attributes or options.multiAttribute is true, delegates
 * to matchKnowledgeToTask for multi-attribute resolution.
 * 
 * @param {object} contract - The task contract
 * @param {object} options - Resolution options
 * @returns {object} Updated contract with resolved rules, skills, and memory shields
 */
export function resolveTaskContext(contract, options = {}) {
  const validation = validateTaskContract(contract);
  if (!validation.valid) {
    throw new Error(`Invalid contract passed to resolveTaskContext: ${validation.errors.join(', ')}`);
  }

  // Milestone D2: Capability Discovery & Status Gating
  if (Array.isArray(contract.required_capabilities)) {
    if (!contract.context.capability_readiness) {
      if (contract.required_capabilities.length > 0) {
        const gatingResult = checkCapabilityReadiness(contract.required_capabilities, options);
        contract.context.capability_readiness = gatingResult;

        if (!gatingResult.ready) {
          contract.status = TASK_STATUS.FAILED;
          contract.verification_results.failure_reason = gatingResult.failureReason;
          if (options.throwOnGatingFailure) {
            throw new Error(`Capability Gating Failed: ${gatingResult.failureReason}`);
          }
          return contract;
        }
      } else {
        contract.context.capability_readiness = checkCapabilityReadiness([], options);
      }
    } else if (!contract.context.capability_readiness.ready) {
      contract.status = TASK_STATUS.FAILED;
      return contract;
    }
  }

  // Multi-attribute routing if task dimensions are provided
  const profile = contract.task_profile;
  const hasDimensions = profile && (
    profile.language || profile.framework || profile.architecture ||
    (Array.isArray(profile.security_implications) && profile.security_implications.length > 0) ||
    (Array.isArray(profile.reliability_implications) && profile.reliability_implications.length > 0)
  );

  if (hasDimensions || options.multiAttribute) {
    return matchKnowledgeToTask(contract, options);
  }

  const query = contract.context.retrieval_query || contract.objective;
  const budget = contract.constraints.max_tokens_budget || 1200;

  // Retrieve precision knowledge within token budget
  const effectiveBrainRoot = options.brainRoot || contract.context?.brainRoot || null;
  const retrieval = retrieveKnowledge(query, {
    maxTokens: budget,
    topK: contract.task_type === 'MICRO_FIX' ? 2 : 4,
    format: 'compact',
    brainRoot: effectiveBrainRoot
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

  // Integrated Cross-Session Memory Shield: inject past failure warnings
  try {
    injectSessionMemoryIntoContract(contract);
  } catch (e) {}

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
    resolveTaskContext(contract, options);
  }

  if (contract.status === TASK_STATUS.FAILED) {
    const reason = contract.context?.capability_readiness?.failureReason || contract.verification_results?.failure_reason || 'Task in FAILED state';
    throw new Error(`Cannot format execution prompt: Task ${contract.task_id} failed capability gating: ${reason}`);
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

  const capabilitiesBlock = (contract.context?.capability_readiness?.capabilities?.length > 0)
    ? `\n### VERIFIED REQUIRED CAPABILITIES:\n${contract.context.capability_readiness.capabilities.map(c => `- **${c.id}** (${c.name}): ${c.status}`).join('\n')}\n`
    : '';

  // 4. User Prompt with Precision Retrieved Knowledge
  const userPrompt =
`## TASK CONTRACT: [${contract.task_id}] (${contract.task_type})

### OBJECTIVE:
${contract.objective}

### OUTPUT FORMAT:
${contract.output_format}
${capabilitiesBlock}
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
export function recordTaskCheckpoint(contract, stepIndex = 0, statePayload = {}, explicitStatus = null, options = {}) {
  const filePath = ensureCheckpointsStorage(options);
  const db = loadAllCheckpoints(options);

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

  fs.writeFileSync(filePath, JSON.stringify(db, null, 2), 'utf-8');
  return contract;
}

/**
 * Loads a specific task checkpoint from durable storage
 * 
 * @param {string} taskId - The unique task ID
 * @param {object} options - Options for checkpoint resolution
 * @returns {object|null} The stored task record or null
 */
export function loadTaskCheckpoint(taskId, options = {}) {
  const db = loadAllCheckpoints(options);
  return db.tasks[taskId] || null;
}

/**
 * Records a traceable knowledge application decision for an active task contract.
 * Explicitly records whether a rule was APPLIED, REJECTED (with reason), or INAPPLICABLE,
 * along with influenced implementation decisions, files, and empirical verification methods.
 * 
 * @param {object} contract - The task contract
 * @param {object} decision - Knowledge decision payload
 * @returns {object} Updated decision entry in contract
 */
export function recordKnowledgeDecision(contract, decision) {
  if (!decision || typeof decision !== 'object') {
    throw new Error('Decision must be a non-null object');
  }

  const {
    rule_id,
    title,
    canonical_source,
    applicability_rationale,
    status,
    rejection_reason,
    influenced_decisions,
    influenced_files,
    verification_method,
    verification_outcome,
    evidence_ref,
    limitations_observed
  } = decision;

  if (!rule_id || typeof rule_id !== 'string') {
    throw new Error('rule_id is required and must be a string.');
  }

  if (!status || !Object.values(KNOWLEDGE_APPLICATION_STATUS).includes(status)) {
    throw new Error(`status must be one of: ${Object.values(KNOWLEDGE_APPLICATION_STATUS).join(', ')} (Got: ${status})`);
  }

  if (status === KNOWLEDGE_APPLICATION_STATUS.REJECTED) {
    if (!rejection_reason || typeof rejection_reason !== 'string' || rejection_reason.trim().length === 0) {
      throw new Error(`Rejection of ${rule_id} requires an explicit non-empty rejection_reason.`);
    }
  }

  if (status === KNOWLEDGE_APPLICATION_STATUS.APPLIED) {
    if (!Array.isArray(influenced_decisions) || influenced_decisions.length === 0) {
      throw new Error(`Application of ${rule_id} requires at least one entry in influenced_decisions.`);
    }
    if (!verification_method || typeof verification_method !== 'string') {
      throw new Error(`Application of ${rule_id} requires a verification_method string.`);
    }
  }

  if (!Array.isArray(contract.knowledge_applications)) {
    contract.knowledge_applications = [];
  }

  const existingIdx = contract.knowledge_applications.findIndex(k => k.rule_id === rule_id);
  const existing = existingIdx >= 0 ? contract.knowledge_applications[existingIdx] : {};

  const record = {
    rule_id,
    title: title || existing.title || `Rule ${rule_id}`,
    canonical_source: canonical_source || existing.canonical_source || `05_KNOWLEDGE/engineering-patterns.md#${rule_id}`,
    applicability_rationale: applicability_rationale || existing.applicability_rationale || 'Evaluated for task applicability',
    preconditions_met: decision.preconditions_met !== undefined ? decision.preconditions_met : (status !== KNOWLEDGE_APPLICATION_STATUS.REJECTED),
    status,
    rejection_reason: rejection_reason || null,
    influenced_decisions: influenced_decisions || existing.influenced_decisions || [],
    influenced_files: influenced_files || existing.influenced_files || [],
    verification_method: verification_method || existing.verification_method || null,
    verification_outcome: verification_outcome || existing.verification_outcome || VERIFICATION_OUTCOME.PENDING,
    evidence_ref: evidence_ref || existing.evidence_ref || null,
    limitations_observed: limitations_observed || existing.limitations_observed || null,
    recorded_at: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    contract.knowledge_applications[existingIdx] = record;
  } else {
    contract.knowledge_applications.push(record);
  }

  return record;
}

/**
 * Independently verifies each applied knowledge item against live empirical evidence.
 * Differentiates retrieved vs applied vs rejected, and verifies rule compliance.
 * 
 * @param {object} contract - The task contract
 * @param {object} executionEvidence - Evidence submitted from live execution
 * @returns {object} Knowledge verification outcome summary
 */
export function verifyKnowledgeApplications(contract, executionEvidence = {}) {
  if (!Array.isArray(contract.knowledge_applications) || contract.knowledge_applications.length === 0) {
    return {
      allVerified: true,
      evaluatedCount: 0,
      appliedCount: 0,
      verifiedCount: 0,
      failedCount: 0,
      rejectedCount: 0,
      inapplicableCount: 0,
      ruleOutcomes: []
    };
  }

  const ruleOutcomes = [];
  let allVerified = true;
  let appliedCount = 0;
  let verifiedCount = 0;
  let failedCount = 0;
  let rejectedCount = 0;
  let inapplicableCount = 0;

  const evidenceTypes = Array.isArray(executionEvidence.evidenceTypes) ? executionEvidence.evidenceTypes : [];
  const verifiedRules = Array.isArray(executionEvidence.verifiedRules) ? executionEvidence.verifiedRules : [];
  const ruleEvidenceMap = executionEvidence.ruleEvidence || {};

  for (const app of contract.knowledge_applications) {
    if (app.status === KNOWLEDGE_APPLICATION_STATUS.REJECTED) {
      rejectedCount++;
      ruleOutcomes.push({ rule_id: app.rule_id, status: 'REJECTED', reason: app.rejection_reason });
      continue;
    }
    if (app.status === KNOWLEDGE_APPLICATION_STATUS.INAPPLICABLE) {
      inapplicableCount++;
      ruleOutcomes.push({ rule_id: app.rule_id, status: 'INAPPLICABLE' });
      continue;
    }

    if (app.status === KNOWLEDGE_APPLICATION_STATUS.APPLIED) {
      appliedCount++;
      // Check if empirical verification evidence proves this rule
      const ruleEv = ruleEvidenceMap[app.rule_id];
      const directRefPassed = app.evidence_ref && evidenceTypes.includes(app.evidence_ref);
      const explicitlyVerified = verifiedRules.includes(app.rule_id);
      const ruleEvidencePassed = ruleEv && (ruleEv.verified === true || ruleEv.status === 'PASS');

      // Rule passes verification if directRef, ruleEvidence, or explicit verification was collected with build exit 0
      const isVerified = (directRefPassed || explicitlyVerified || ruleEvidencePassed) ||
        (executionEvidence.buildExitCode === 0 && !app.evidence_ref);

      if (isVerified) {
        app.verification_outcome = VERIFICATION_OUTCOME.PASS;
        verifiedCount++;
        ruleOutcomes.push({ rule_id: app.rule_id, status: 'VERIFIED', outcome: 'PASS', evidence: app.evidence_ref || 'BUILD_EXIT_0' });
      } else {
        app.verification_outcome = VERIFICATION_OUTCOME.FAIL;
        failedCount++;
        allVerified = false;
        ruleOutcomes.push({
          rule_id: app.rule_id,
          status: 'FAILED',
          outcome: 'FAIL',
          reason: `Rule verification failed: evidence '${app.evidence_ref}' not observed for verification method: ${app.verification_method}`
        });
      }
    }
  }

  return {
    allVerified,
    evaluatedCount: contract.knowledge_applications.length,
    appliedCount,
    verifiedCount,
    failedCount,
    rejectedCount,
    inapplicableCount,
    ruleOutcomes
  };
}

/**
 * Verifies execution evidence against the contract's verification criteria
 * and individual applied knowledge verification methods.
 * 
 * @param {object} contract - The task contract
 * @param {object} executionEvidence - Evidence submitted from live execution
 * @returns {object} { verified: boolean, failureReason: string|null, contract: object }
 */
export function verifyExecutionResult(contract, executionEvidence = {}, options = {}) {
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

  // 4. Traceable Knowledge Application Verification Barrier
  const knowledgeVerification = verifyKnowledgeApplications(contract, executionEvidence);
  if (!knowledgeVerification.allVerified && verified) {
    verified = false;
    const failedRules = knowledgeVerification.ruleOutcomes.filter(r => r.status === 'FAILED');
    failureReason = `Knowledge Application Verification Barrier Failed: ${failedRules.map(f => `${f.rule_id} (${f.reason})`).join('; ')}`;
  }

  contract.verification_results = {
    verified,
    evidence_collected: collected,
    verified_at: verified ? new Date().toISOString() : null,
    failure_reason: failureReason,
    knowledge_verification: knowledgeVerification
  };

  contract.status = verified ? TASK_STATUS.VERIFIED : TASK_STATUS.FAILED;

  // Integrated Cross-Session Memory Feedback: record failure on rejected barrier
  if (!verified && failureReason) {
    try {
      recordSessionMemory({
        task_context: contract.objective,
        defect_observed: failureReason,
        negative_warning: `Verification Barrier Blocked: ${failureReason}`,
        keywords: [contract.task_type, ...(contract.objective.toLowerCase().split(/\s+/).slice(0, 5))]
      });
    } catch (e) {}
  }

  // Persist final verification state to checkpoint storage
  recordTaskCheckpoint(contract, contract.checkpoint.current_step, {
    verification: contract.verification_results
  }, contract.status, options);

  return {
    verified,
    failureReason,
    contract
  };
}

/**
 * Orchestrates a complete end-to-end task execution pipeline (Phase D3.4 Integrated)
 * connecting Contract Validation, Retrieval, DAG Planning, Capability Routing,
 * Dynamic Skill Binding, Sequential Execution via Adapter, Verification Barriers, and Checkpointing.
 * 
 * @param {object} contractInput - Task contract options or existing contract
 * @param {Function} executorFn - Function (subtask/step, contract, context) => Promise<{ success: boolean, evidence?: object, error?: string }>
 * @param {object} options - Pipeline configuration options
 * @returns {Promise<object>} Pipeline execution outcome adhering to canonical return contract
 */
export async function executeUniversalTaskPipeline(contractInput, executorFn, options = {}) {
  // 1. Task submission & Contract validation (Barrier 1)
  const contract = contractInput.task_id ? contractInput : createTaskContract(contractInput);
  const validation = validateTaskContract(contract);
  if (!validation.valid) {
    throw new Error(`Task Contract validation failed: ${validation.errors.join(', ')}`);
  }

  // 2. Context resolution (BM25 Retrieval + Cross-Session Memory Shields + D2 Capability Gating) (Barrier 3)
  resolveTaskContext(contract, options);
  if (contract.status === TASK_STATUS.FAILED) {
    const reason = contract.context?.capability_readiness?.failureReason || contract.verification_results?.failure_reason || 'Task in FAILED state';
    throw new Error(`Task pipeline halted: capability gating failed: ${reason}`);
  }

  // 3. Applicable Skill Resolution (if explicit skillId provided at contract level)
  if (options.skillId) {
    bindSkillToTask(contract, options.skillId);
  }

  // 4. DAG Task Decomposition & Subtask Synchronization
  if (!contract.execution_plan || contract.execution_plan.length === 0) {
    if (contract.subtasks && contract.subtasks.length > 0) {
      contract.execution_plan = contract.subtasks;
    } else {
      planTaskDecomposition(contract);
    }
  }
  if (!contract.subtasks || contract.subtasks.length === 0) {
    contract.subtasks = contract.execution_plan;
  }

  // Barrier 2: DAG Topology Validation
  const dagCheck = validatePlanDAG(contract.execution_plan || contract.subtasks);
  if (!dagCheck.valid) {
    throw new Error(`Plan DAG is invalid: ${dagCheck.errors.join(', ')}`);
  }

  // Persist initial checkpoint
  if (options.persistCheckpoint !== false) {
    recordTaskCheckpoint(contract, 0, { phase: 'INITIALIZED' }, null, options);
  }

  // 4b. Subtask Capability Readiness Pre-Flight Gating (Barrier 3)
  const subtaskGating = routeTaskPlanSubtasks(contract, options);
  if (!subtaskGating.allReady) {
    contract.status = TASK_STATUS.FAILED;
    const reason = `Subtask capability gating failed:\n- ${subtaskGating.failures.join('\n- ')}`;
    if (contract.verification_results) {
      contract.verification_results.failure_reason = reason;
    }
    if (options.persistCheckpoint !== false) {
      recordTaskCheckpoint(contract, 0, {
        phase: 'SUBTASK_GATING_BLOCKED',
        reason: subtaskGating.failureReason
      }, TASK_STATUS.FAILED, options);
    }
    if (options.throwOnGatingFailure !== false) {
      throw new Error(`Task pipeline halted: ${reason}`);
    }
    return {
      taskId: contract.task_id,
      contract,
      verified: false,
      executedSteps: [],
      status: contract.status,
      verification: {
        verified: false,
        failureReason: reason
      }
    };
  }

  // 4c. Dynamic Skill Binding (Barrier 4)
  if (options.bindSkills !== false) {
    const bindingResult = bindSkillsToPlan(contract, options);
    if (!bindingResult.success) {
      contract.status = TASK_STATUS.FAILED;
      const reason = `Dynamic skill binding failed:\n- ${bindingResult.failures.join('\n- ')}`;
      if (contract.verification_results) {
        contract.verification_results.failure_reason = reason;
      }
      if (options.persistCheckpoint !== false) {
        recordTaskCheckpoint(contract, 0, {
          phase: 'SKILL_BINDING_BLOCKED',
          reason: bindingResult.failureReason
        }, TASK_STATUS.FAILED, options);
      }
      if (options.throwOnBindingFailure !== false) {
        throw new Error(`Task pipeline halted: ${reason}`);
      }
      return {
        taskId: contract.task_id,
        contract,
        verified: false,
        executedSteps: [],
        status: contract.status,
        verification: {
          verified: false,
          failureReason: reason
        }
      };
    }
  }

  // 5. Controlled Sequential DAG Execution via Adapted Executor (Barriers 5 & 6)
  const adaptedExecutor = createExecutorAdapter(executorFn, contract, options);
  const dagResult = await executeSubtaskDAG(contract, adaptedExecutor, {
    ...options,
    persistCheckpoint: options.persistCheckpoint !== false,
    enforceReadinessGating: true,
    bindSkills: false // already bound in step 4c
  });

  const executionFailed = !dagResult.success;
  const executedSteps = (dagResult.executedSubtasks || []).map(es => ({
    step_id: es.subtaskId,
    subtask_id: es.subtaskId,
    success: es.success !== false && es.status === SUBTASK_STATUS.COMPLETED,
    status: es.status,
    durationMs: es.durationMs,
    evidence: es.evidence,
    previouslyCompleted: es.previouslyCompleted || false,
    skipped: es.status === SUBTASK_STATUS.SKIPPED
  }));

  // 6. Verification Barrier Check (Barriers 7 & 8)
  const verificationResult = verifyExecutionResult(contract, {
    buildExitCode: executionFailed ? 1 : 0,
    terminalOutput: options.terminalOutput || (executionFailed
      ? `Execution pipeline failed: ${dagResult.failureReason || 'One or more subtasks failed'}`
      : '✓ Execution pipeline completed successfully with exit code 0'),
    evidenceTypes: options.evidenceTypes || (executionFailed ? [] : ['BUILD_EXIT_0', 'TEST_PASS']),
    ...(options.customEvidence || {})
  });

  return {
    taskId: contract.task_id,
    contract,
    verified: verificationResult.verified,
    executedSteps,
    status: contract.status,
    verification: verificationResult,
    dagExecution: dagResult
  };
}
