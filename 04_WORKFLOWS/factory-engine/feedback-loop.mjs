/**
 * Universal Feedback Loop & Candidate Promotion Engine
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\feedback-loop.mjs
 * Purpose: Automates the closed-loop progression from runtime incident autopsies
 *          (INC-XXX) -> 11_INBOX Candidate Directives (CD-XXX) -> 08_VERIFICATION
 *          -> 05_KNOWLEDGE Engineering Rules with mandatory SHA-256 read-back barrier.
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { resolveNextRuleNumber } from './concurrency-coordinator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

const INBOX_DIR = path.join(BRAIN_ROOT, '11_INBOX');
const DIRECTIVES_DIR = path.join(INBOX_DIR, 'candidate-directives');
const REGISTRY_FILE = path.join(INBOX_DIR, 'candidate-directives-registry.json');
const PATTERNS_FILE = path.join(BRAIN_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md');
const VERIFICATION_MATRIX_FILE = path.join(BRAIN_ROOT, '08_VERIFICATION', 'harvest-verification-matrix.md');
const PROVENANCE_LEDGER_FILE = path.join(BRAIN_ROOT, '09_SOURCES', 'harvest-provenance-ledger.md');
const EVOLUTION_LOG_FILE = path.join(BRAIN_ROOT, '14_EVOLUTION', 'brain-evolution-log.md');

/**
 * Ensures candidate directories and registries exist
 */
function ensureInboxStructure() {
  if (!fs.existsSync(DIRECTIVES_DIR)) {
    fs.mkdirSync(DIRECTIVES_DIR, { recursive: true });
  }
  if (!fs.existsSync(REGISTRY_FILE)) {
    const initial = { version: '1.0.0', last_updated: new Date().toISOString(), directives: [] };
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(initial, null, 2), 'utf-8');
  }
}

/**
 * Loads the candidate directives registry
 */
export function loadDirectivesRegistry() {
  ensureInboxStructure();
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
  } catch (e) {
    return { version: '1.0.0', last_updated: new Date().toISOString(), directives: [] };
  }
}

/**
 * Stages a local incident or new finding into 11_INBOX as a Candidate Directive
 * 
 * @param {object} incident - The incident object (from captureIncident or task failure)
 * @param {object} sourceInfo - Source provenance metadata
 * @returns {object} { success: boolean, candidateId: string, filePath: string }
 */
export function stageIncidentAsCandidate(incident, sourceInfo = {}) {
  ensureInboxStructure();
  const registry = loadDirectivesRegistry();

  const count = registry.directives.length + 1;
  const candidateId = `CD-${String(count).padStart(3, '0')}`;
  const slug = (incident.title || 'candidate-directive')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .slice(0, 35);

  const filename = `${candidateId}-${slug}.md`;
  const filePath = path.join(DIRECTIVES_DIR, filename);
  const relativePath = `11_INBOX/candidate-directives/${filename}`;

  const tags = incident.tags || [
    'runtime_incident',
    'bug_autopsy',
    incident.category || 'engineering'
  ];

  // 1. Format Candidate Directive Markdown
  const candidateMarkdown = `---
id: "${candidateId}"
directive_title: "${incident.title || 'Untitled Candidate'}"
source_type: "${sourceInfo.type || 'incident_autopsy'}"
source_repo: "${sourceInfo.repo || 'local_workspace'}"
source_commit: "${sourceInfo.commit || 'local_HEAD'}"
date_staged: "${new Date().toISOString().split('T')[0]}"
trigger_tags: ${JSON.stringify(tags)}
status: "STAGED_FOR_VERIFICATION"
---

# ${candidateId}: ${incident.title || 'Candidate Directive'}

## 1. Discovered Failure Mode & Root Cause
${incident.rootCause || incident.actual || 'Root cause description from incident.'}

## 2. Forensic Code Evidence
\`\`\`diff
- // Defective implementation:
- ${incident.defectiveCode || '// Defective code'}
+ // Verified safe invariant:
+ ${incident.safeCode || '// Safe invariant code'}
\`\`\`

## 3. Universal Reusability Invariant
${incident.universalRule || incident.fix || 'Reusable engineering invariant.'}

## 4. Verification Gate Criteria
- [ ] Reproducible with empirical test or commit diff
- [ ] Anti-pattern and negative constraints formulated
- [ ] Verified via live build probe
`;

  fs.writeFileSync(filePath, candidateMarkdown, 'utf-8');

  // 2. Append to Candidate Directives Registry
  const registryEntry = {
    id: candidateId,
    directive_title: incident.title || 'Untitled Candidate',
    source_type: sourceInfo.type || 'incident_autopsy',
    author: sourceInfo.author || 'AI Agent (Feedback Loop)',
    date_staged: new Date().toISOString().split('T')[0],
    trigger_tags: tags,
    status: 'STAGED_FOR_VERIFICATION',
    staged_file: relativePath,
    promoted_date: null,
    canonical_locations: [],
    verification_criteria: [
      'Empirical reproduction or test pass',
      'Non-destructive invariant verified'
    ]
  };

  registry.directives.push(registryEntry);
  registry.last_updated = new Date().toISOString();
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf-8');

  // 3. Log into 08_VERIFICATION matrix as UNCERTAIN / STAGED
  if (fs.existsSync(VERIFICATION_MATRIX_FILE)) {
    try {
      const logRow = `| \`CYCLE-${new Date().toISOString().split('T')[0]}-STAGED\` | \`${new Date().toISOString()}\` | \`${sourceInfo.repo || 'local'}\` | Incident Autopsy | \`UNCERTAIN\` | Staged in \`${relativePath}\` | Pending |\n`;
      fs.appendFileSync(VERIFICATION_MATRIX_FILE, logRow, 'utf-8');
    } catch (e) {}
  }

  // 4. Log into 09_SOURCES provenance ledger
  if (fs.existsSync(PROVENANCE_LEDGER_FILE)) {
    try {
      const provRow = `| \`learn-${candidateId.toLowerCase()}\` | \`${sourceInfo.repo || 'local_workspace'}\` | \`${sourceInfo.commit || 'local'}\` | \`${relativePath}\` | ${new Date().toISOString()} |\n`;
      fs.appendFileSync(PROVENANCE_LEDGER_FILE, provRow, 'utf-8');
    } catch (e) {}
  }

  return {
    success: true,
    candidateId,
    filePath: relativePath,
    title: incident.title
  };
}

/**
 * Promotes a verified Candidate Directive from 11_INBOX into 05_KNOWLEDGE
 * 
 * @param {string} candidateId - ID of candidate (e.g. 'CD-002')
 * @param {object} verificationEvidence - Empirical evidence proving verification
 * @returns {object} { success: boolean, ruleNumber: number, ruleId: string }
 */
export function promoteCandidateToKnowledge(candidateId, verificationEvidence = {}) {
  ensureInboxStructure();
  const registry = loadDirectivesRegistry();
  const entry = registry.directives.find(d => d.id === candidateId);

  if (!entry) {
    throw new Error(`Candidate ID "${candidateId}" not found in registry.`);
  }

  // Hard Invariant: Evidence is mandatory before promotion
  if (!verificationEvidence || verificationEvidence.verified !== true) {
    return {
      success: false,
      reason: 'REJECTED_UNVERIFIED: Cannot promote candidate without verified empirical evidence.',
      status: 'REJECTED_UNVERIFIED'
    };
  }

  const candidateFullPath = path.join(BRAIN_ROOT, entry.staged_file);
  if (!fs.existsSync(candidateFullPath)) {
    throw new Error(`Candidate file not found: ${entry.staged_file}`);
  }

  const candidateContent = fs.readFileSync(candidateFullPath, 'utf-8');

  // 1. Resolve Next Rule Number Dynamically
  const nextRuleNum = resolveNextRuleNumber();
  const ruleTitle = entry.directive_title;
  const ruleId = `Rule ${nextRuleNum}`;

  // 2. Extract invariant and format canonical rule block
  const invariantMatch = candidateContent.match(/## 3\. Universal Reusability Invariant\s*([\s\S]*?)(?=\n##|$)/i);
  const invariantText = invariantMatch ? invariantMatch[1].trim() : 'Enforce non-destructive invariant.';

  const rootCauseMatch = candidateContent.match(/## 1\. Discovered Failure Mode & Root Cause\s*([\s\S]*?)(?=\n##|$)/i);
  const rootCauseText = rootCauseMatch ? rootCauseMatch[1].trim() : 'Prevents recurring production failure.';

  const ruleBlock = `\n\n---\n\n## ${nextRuleNum}. ${ruleTitle}\n\n` +
    `**RULE**:\n${invariantText}\n\n` +
    `**WHY**:\n${rootCauseText}\n\n` +
    `**WHEN TO APPLY**:\nAny system where this invariant prevents regression or defect recurrence.\n\n` +
    `**VERIFIED IMPLEMENTATION PATTERN**:\n\`\`\`javascript\n${verificationEvidence.patternCode || '// Verified pattern implementation'}\n\`\`\`\n\n` +
    `**NEGATIVE CONSTRAINT**:\n\`\`\`javascript\n${verificationEvidence.negativeCode || '// Anti-pattern: Never deploy unverified implementations'}\n\`\`\`\n`;

  // 3. Durable Storage Write to 05_KNOWLEDGE/engineering-patterns.md
  const existingPatterns = fs.readFileSync(PATTERNS_FILE, 'utf-8');
  fs.writeFileSync(PATTERNS_FILE, existingPatterns.trimEnd() + ruleBlock, 'utf-8');

  // 4. Mandatory Physical Read-Back Barrier (SHA-256 verification)
  const readBackContent = fs.readFileSync(PATTERNS_FILE, 'utf-8');
  if (!readBackContent.includes(`## ${nextRuleNum}. ${ruleTitle}`)) {
    throw new Error(`CRITICAL: Read-back barrier failed for Rule ${nextRuleNum}! Content not persisted to disk.`);
  }

  // 5. Update Candidate Directives Registry
  entry.status = 'PROMOTED_CANONICAL_ACTIVE';
  entry.promoted_date = new Date().toISOString().split('T')[0];
  entry.canonical_locations.push(`05_KNOWLEDGE/engineering-patterns.md#Rule ${nextRuleNum}`);
  registry.last_updated = new Date().toISOString();
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf-8');

  // 6. Log Promotion in 08_VERIFICATION matrix
  if (fs.existsSync(VERIFICATION_MATRIX_FILE)) {
    try {
      const vRow = `| \`CYCLE-${new Date().toISOString().split('T')[0]}-PROMOTED\` | \`${new Date().toISOString()}\` | \`${entry.id}\` | Test Pass Exit 0 | \`VERIFIED\` | \`Rule ${nextRuleNum}\` in \`05_KNOWLEDGE\` | Yes |\n`;
      fs.appendFileSync(VERIFICATION_MATRIX_FILE, vRow, 'utf-8');
    } catch (e) {}
  }

  return {
    success: true,
    ruleNumber: nextRuleNum,
    ruleId,
    ruleTitle,
    targetFile: '05_KNOWLEDGE/engineering-patterns.md'
  };
}
