/**
 * AI-Builder-Brain — Automatic Project Learning Bridge
 * 
 * Provides a controlled, additive interface for projects built with AI-Builder-Brain
 * to submit reusable learnings, architectural decisions, failure autopsies, and
 * verified implementation patterns back to the Master Brain.
 * 
 * Invariants:
 * 1. Project-specific knowledge remains associated with its originating project.
 * 2. Reusable learning must pass strict 4-pillar validation and human approval rules.
 * 3. Never automatically promote raw project files or unverified model outputs.
 * 4. Deduplication via Normalized Semantic Hash prevents duplicate records.
 * 5. Complete provenance ledger and verification matrix records are preserved.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  KNOWLEDGE_STAGE,
  VALIDATION_PILLARS,
  validateProjectLearningCandidate,
  checkDuplicatesAndConflicts,
  promoteProjectLearningToMasterBrain
} from './project-learning-promotion-bridge.mjs';

import {
  INTELLIGENCE_DOMAINS,
  classifyIntelligenceDomain,
  computeNormalizedSemanticHash,
  loadDomainRegistry
} from './domain-intelligence-engine.mjs';

import {
  HIGH_IMPACT_DOMAINS,
  verifyHumanApprovalToken
} from './human-approval-authority.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

export const SUBMISSION_STAGES = Object.freeze({
  DISCOVERED: 'DISCOVERED',
  EXTRACTED: 'EXTRACTED',
  CANDIDATE: 'CANDIDATE',
  UNVERIFIED: 'UNVERIFIED',
  VALIDATED: 'VALIDATED',
  CONFLICTED: 'CONFLICTED',
  PROJECT_LOCAL_ONLY: 'PROJECT_LOCAL_ONLY',
  CANONICAL: 'CANONICAL',
  DUPLICATE_SKIPPED: 'DUPLICATE_SKIPPED',
  REJECTED: 'REJECTED'
});

/**
 * Generate a unique, stable submission ID
 */
export function generateSubmissionId(projectName, title) {
  const seed = `${projectName}:${title.trim().toLowerCase()}`;
  const hash = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 8).toUpperCase();
  return `PLB-${hash}`;
}

/**
 * Main Bridge Ingestion Function
 * 
 * @param {Object} submission - Project learning data
 * @param {Object} options - Ingestion and promotion options
 * @returns {Object} Submission result with classification and persistence details
 */
export async function submitProjectLearning(submission = {}, options = {}) {
  const brainRoot = options.brainRoot || BRAIN_ROOT;
  const logger = options.logger || console.log;

  // 1. Validation of required submission fields
  const projectName = submission.projectName || submission.project_name;
  if (!projectName || typeof projectName !== 'string') {
    throw new Error('Project learning submission rejected: "projectName" is required.');
  }

  const problemStatement = submission.problemStatement || submission.problem_statement || submission.originalRequirement;
  if (!problemStatement || typeof problemStatement !== 'string' || problemStatement.trim().length < 10) {
    throw new Error('Project learning submission rejected: "problemStatement" (>= 10 chars) is required.');
  }

  const implementationPattern = submission.implementationPattern || submission.implementation_pattern;
  if (!implementationPattern || typeof implementationPattern !== 'string' || implementationPattern.trim().length < 15) {
    throw new Error('Project learning submission rejected: "implementationPattern" (>= 15 chars) is required.');
  }

  const title = submission.title || `${projectName}: ${problemStatement.slice(0, 60)}`;
  const submissionId = submission.submissionId || generateSubmissionId(projectName, title);

  logger(`======================================================================`);
  logger(`🌉 PROJECT LEARNING BRIDGE: INGESTION [${submissionId}]`);
  logger(`   Project:   ${projectName}`);
  logger(`   Title:     ${title}`);
  logger(`   Timestamp: ${new Date().toISOString()}`);
  logger(`======================================================================`);

  // 2. Structured candidate extraction (EXTRACTED)
  const candidate = {
    candidate_id: submissionId,
    stage: SUBMISSION_STAGES.EXTRACTED,
    project_name: projectName,
    product_context: submission.productContext || submission.product_context || {},
    title: title.trim(),
    problem_statement: problemStatement.trim(),
    architecture_decisions: submission.architectureDecisions || submission.architecture_decisions || [],
    universal_invariant: implementationPattern.trim(),
    implementation_pattern: implementationPattern.trim(),
    technical_discoveries: submission.technicalDiscoveries || submission.technical_discoveries || [],
    failed_approaches: submission.failedApproaches || submission.failed_approaches || [],
    reusable_skills: submission.reusableSkills || submission.reusable_skills || [],
    source_uri: submission.sourceUri || submission.source_uri || `project://${projectName}`,
    source_version: submission.sourceVersion || submission.source_version || '1.0.0',
    domains: submission.domains || [],
    confidence: typeof submission.confidence === 'number' ? submission.confidence : 0.9,
    known_limitations: submission.knownLimitations || submission.known_limitations || 'None reported',
    negative_constraint: submission.negativeConstraint || submission.negative_constraint || 'Avoid identified anti-pattern',
    verification_method: submission.verificationMethod || submission.verification_method || 'Automated verification test',
    project_specific_facts: submission.projectSpecificFacts || `Harvested from child project ${projectName}.`,
    created_at: new Date().toISOString()
  };

  // 3. 13-Domain Classification (CANDIDATE)
  const domainClassification = classifyIntelligenceDomain(
    `${candidate.problem_statement} ${candidate.implementation_pattern}`,
    { title: candidate.title, category: candidate.domains?.[0] }
  );
  candidate.classified_domain = domainClassification.primaryDomain;
  candidate.confidence_score = domainClassification.confidence;
  candidate.stage = SUBMISSION_STAGES.CANDIDATE;
  logger(`  🏷️ Domain Classification: [${domainClassification.primaryDomain.letter}] ${domainClassification.primaryDomain.name} (Confidence: ${domainClassification.confidence})`);

  // 4. Duplicate and Conflict Interception
  const duplicateCheck = checkDuplicatesAndConflicts(candidate, brainRoot, options);
  if (duplicateCheck.isDuplicate) {
    logger(`  ⏩ [DUPLICATE INTERCEPTED] Matches existing record: ${duplicateCheck.existingRecordId}`);
    return {
      submissionId,
      status: SUBMISSION_STAGES.DUPLICATE_SKIPPED,
      stage: SUBMISSION_STAGES.DUPLICATE_SKIPPED,
      projectName,
      title,
      existingRecordId: duplicateCheck.existingRecordId,
      message: 'Duplicate submission intercepted; existing knowledge preserved.'
    };
  }

  if (duplicateCheck.isConflicted) {
    logger(`  ⚠️ [CONFLICT DETECTED] Opposes rule: ${duplicateCheck.opposingRuleId}`);
    // Save conflicted record for inspection without promoting
    saveProjectDossier(brainRoot, candidate, SUBMISSION_STAGES.CONFLICTED, duplicateCheck);
    return {
      submissionId,
      status: SUBMISSION_STAGES.CONFLICTED,
      stage: SUBMISSION_STAGES.CONFLICTED,
      projectName,
      title,
      opposingRuleId: duplicateCheck.opposingRuleId,
      reason: duplicateCheck.reason,
      message: 'Submission conflicts with established canonical directive; quarantined in project learning.'
    };
  }

  // 5. Verification Proof Assessment
  const rawProof = submission.verificationProof || submission.verificationEvidence || submission.verification_evidence;
  let isEmpiricallyVerified = false;

  if (rawProof) {
    if (typeof rawProof === 'object') {
      isEmpiricallyVerified = rawProof.verified === true ||
                              rawProof.exitCode === 0 ||
                              rawProof.exit_code === 0 ||
                              rawProof.status === 'PASS' ||
                              rawProof.status === 'VERIFIED';
    } else if (typeof rawProof === 'string') {
      isEmpiricallyVerified = rawProof.includes('PASS') ||
                              rawProof.includes('exit code 0') ||
                              rawProof.includes('VERIFIED');
    }
  }

  if (!isEmpiricallyVerified) {
    logger(`  ⚠️ Verification proof missing or failed. Classifying as UNVERIFIED.`);
    candidate.stage = SUBMISSION_STAGES.UNVERIFIED;
    saveProjectDossier(brainRoot, candidate, SUBMISSION_STAGES.UNVERIFIED);
    return {
      submissionId,
      status: SUBMISSION_STAGES.UNVERIFIED,
      stage: SUBMISSION_STAGES.UNVERIFIED,
      projectName,
      title,
      message: 'Learning recorded in project ledger, but not promoted due to unverified empirical proof.'
    };
  }

  const normalizedProof = typeof rawProof === 'object' && rawProof !== null ? {
    verified: true,
    exit_code: rawProof.exitCode ?? rawProof.exit_code ?? 0,
    test_suite: rawProof.testSuite || rawProof.test_suite || 'automated-test',
    output: rawProof.output || 'Empirical execution pass'
  } : {
    verified: true,
    exit_code: 0,
    test_suite: 'automated-test',
    output: String(rawProof || 'Empirical execution pass')
  };

  // 6. 4-Pillar Validation Barrier
  const bridgeOpts = { skipCorpusSearch: true, ...options };
  const validation = validateProjectLearningCandidate(candidate, normalizedProof, bridgeOpts);
  const isValid = validation.valid === true || validation.passed === true;
  if (!isValid) {
    const reasons = validation.rejection_reasons || validation.rejectionReasons || ['Validation failed'];
    logger(`  ⚠️ 4-Pillar Validation rejected candidate: ${reasons.join('; ')}`);
    candidate.stage = validation.stage || SUBMISSION_STAGES.REJECTED;
    saveProjectDossier(brainRoot, candidate, candidate.stage, { reasons });
    return {
      submissionId,
      status: candidate.stage,
      stage: candidate.stage,
      projectName,
      title,
      rejectionReasons: reasons,
      message: 'Learning preserved in project dossier, but rejected from canonical promotion.'
    };
  }

  // 7. Reusability vs Project-Local Evaluation
  const isUniversalCandidate = submission.isUniversalCandidate === true || options.promoteToCanonical === true;
  if (!isUniversalCandidate) {
    // Verified, high quality, but kept as project-local knowledge
    logger(`  📁 Verified project learning stored locally under 07_PROJECT_LEARNING.`);
    candidate.stage = SUBMISSION_STAGES.PROJECT_LOCAL_ONLY;
    saveProjectDossier(brainRoot, candidate, SUBMISSION_STAGES.PROJECT_LOCAL_ONLY);
    return {
      submissionId,
      status: SUBMISSION_STAGES.VALIDATED,
      stage: SUBMISSION_STAGES.PROJECT_LOCAL_ONLY,
      projectName,
      title,
      domain: domainClassification.primaryDomain.letter,
      message: 'Verified learning successfully saved to project learning store.'
    };
  }

  // 8. Canonical Promotion (for authorized universal candidates)
  logger(`  🚀 Universal candidate passed all 4 validation pillars. Evaluating canonical promotion...`);
  const promotionResult = promoteProjectLearningToMasterBrain(candidate, verificationProof, options);

  // Always update project dossier with promotion reference
  saveProjectDossier(brainRoot, candidate, promotionResult.stage, promotionResult);

  return {
    submissionId,
    status: promotionResult.stage,
    stage: promotionResult.stage,
    projectName,
    title,
    domain: domainClassification.primaryDomain.letter,
    canonicalRecordId: promotionResult.record_id || null,
    message: promotionResult.message || 'Promotion evaluated.'
  };
}

/**
 * Saves or appends learning to project-specific dossier under 07_PROJECT_LEARNING
 */
function saveProjectDossier(brainRoot, candidate, stage, metadata = {}) {
  const learningDir = path.join(brainRoot, '07_PROJECT_LEARNING');
  fs.mkdirSync(learningDir, { recursive: true });

  const sanitizedProject = candidate.project_name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const dossierPath = path.join(learningDir, `${sanitizedProject}-learnings.md`);

  const entryHeader = `\n\n### Learning: ${candidate.title} [${candidate.candidate_id}]\n`;
  const entryBody = [
    `- **Stage**: \`${stage}\``,
    `- **Timestamp**: \`${candidate.created_at || new Date().toISOString()}\``,
    `- **Problem / Requirement**: ${candidate.problem_statement}`,
    `- **Verified Implementation Pattern**: ${candidate.implementation_pattern}`,
    candidate.architecture_decisions?.length ? `- **Architecture Decisions**: ${JSON.stringify(candidate.architecture_decisions)}` : null,
    candidate.failed_approaches?.length ? `- **Failed Approaches / Anti-Patterns**: ${JSON.stringify(candidate.failed_approaches)}` : null,
    candidate.technical_discoveries?.length ? `- **Technical Discoveries**: ${JSON.stringify(candidate.technical_discoveries)}` : null,
    `- **Verification Method**: ${candidate.verification_method}`,
    `- **Negative Constraint**: ${candidate.negative_constraint}`,
    `- **Applicable Domains**: ${candidate.classified_domain?.letter || 'Generic'} (${candidate.classified_domain?.name || 'Systems'})`,
    `- **Known Limitations**: ${candidate.known_limitations}`,
    metadata.record_id ? `- **Canonical Record ID**: \`${metadata.record_id}\`` : null,
    metadata.opposingRuleId ? `- **Quarantine Reason**: Opposes rule \`${metadata.opposingRuleId}\`` : null,
    metadata.reasons?.length ? `- **Rejection Reasons**: ${metadata.reasons.join(', ')}` : null
  ].filter(Boolean).join('\n');

  if (!fs.existsSync(dossierPath)) {
    const fileHeader = `# Project Learning Dossier: ${candidate.project_name}\n\n` +
      `> **Project**: ${candidate.project_name}\n` +
      `> **Source URI**: ${candidate.source_uri}\n` +
      `> **Version Provenance**: ${candidate.source_version}\n` +
      `> **Managed By**: AI-Builder-Brain Project Learning Bridge\n\n` +
      `## 1. Verified Learnings and Architectural Patterns\n`;
    fs.writeFileSync(dossierPath, fileHeader + entryHeader + entryBody, 'utf8');
  } else {
    fs.appendFileSync(dossierPath, entryHeader + entryBody, 'utf8');
  }
}

/**
 * Lists all learnings recorded for a specified project
 */
export function getProjectLearnings(projectName, options = {}) {
  const brainRoot = options.brainRoot || BRAIN_ROOT;
  const sanitizedProject = projectName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const dossierPath = path.join(brainRoot, '07_PROJECT_LEARNING', `${sanitizedProject}-learnings.md`);

  if (!fs.existsSync(dossierPath)) {
    return { projectName, found: false, learningsCount: 0, entries: [] };
  }

  const content = fs.readFileSync(dossierPath, 'utf8');
  const entries = [];
  const regex = /###\s+Learning:\s+([^\n]+)\[([A-Z0-9-]+)\]\n([\s\S]*?)(?=\n###\s+Learning:|$)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    entries.push({
      title: match[1].trim(),
      id: match[2].trim(),
      raw: match[3].trim()
    });
  }

  return {
    projectName,
    found: true,
    learningsCount: entries.length,
    dossierPath,
    entries
  };
}

// CLI Interface
if (process.argv[1] && process.argv[1].endsWith('project-learning-bridge.mjs')) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'submit') {
    const payloadIdx = args.indexOf('--payload');
    if (payloadIdx === -1 || !args[payloadIdx + 1]) {
      console.error('Usage: node project-learning-bridge.mjs submit --payload <json-string-or-file>');
      process.exit(1);
    }
    const rawPayload = args[payloadIdx + 1];
    let payload;
    if (fs.existsSync(rawPayload)) {
      payload = JSON.parse(fs.readFileSync(rawPayload, 'utf8'));
    } else {
      payload = JSON.parse(rawPayload);
    }

    submitProjectLearning(payload)
      .then(res => {
        console.log(JSON.stringify(res, null, 2));
        process.exit(0);
      })
      .catch(err => {
        console.error(err.message);
        process.exit(1);
      });
  } else if (command === 'list') {
    const projIdx = args.indexOf('--project');
    const project = projIdx !== -1 && args[projIdx + 1] ? args[projIdx + 1] : 'unspecified';
    const result = getProjectLearnings(project);
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('AI-Builder-Brain Project Learning Bridge CLI');
    console.log('Commands: submit, list');
  }
}
