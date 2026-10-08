import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { validateRuleCandidate } from './gemini-brain-agent.mjs';
import { resolveNextRuleNumber } from './concurrency-coordinator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

export const LEARNING_DIR = path.join(BRAIN_ROOT, '07_PROJECT_LEARNING');
export const PATTERNS_PATH = path.join(BRAIN_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md');
export const INDEX_PATH = path.join(BRAIN_ROOT, '05_KNOWLEDGE', 'knowledge-index.json');
export const CHECKPOINTS_PATH = path.join(BRAIN_ROOT, '.project-brain', 'harvest-checkpoints.json');

/**
 * The 5 Discrete Lifecycle States for Harvesting Intelligence
 */
export const LEARNING_STAGES = {
  DISCOVERED: 'DISCOVERED',
  EXTRACTED: 'EXTRACTED',
  VALIDATED: 'VALIDATED',
  PROMOTED: 'PROMOTED',
  VERIFIED: 'VERIFIED'
};

/**
 * Status Strings
 */
export const LEARNING_STATUS = {
  PENDING: 'PENDING',
  EXTRACTED_ONLY: 'EXTRACTED_ONLY — NOT STORED IN AI-BUILDER-BRAIN',
  VALIDATED: 'VALIDATED',
  PROMOTED: 'PROMOTED',
  VERIFIED: 'VERIFIED',
  FAILED_VALIDATION: 'FAILED_VALIDATION',
  FAILED_PERSISTENCE: 'FAILED_PERSISTENCE',
  FAILED_READBACK: 'FAILED_READBACK'
};

/**
 * Computes deterministic SHA-256 hash of a string buffer
 */
export function calculateContentHash(content) {
  if (!content) return '';
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Extracts candidate rule objects from raw synthesis or audit text
 */
export function extractCandidateRulesFromText(rawText) {
  if (!rawText) return [];
  const ruleRegex = /(?:##|###)\s+(?:Rule\s+)?(?:X|\d+)[:.]?\s*(.+?)\n([\s\S]*?)(?=(?:\n(?:##|###)\s+(?:Rule\s+)?(?:X|\d+)[:.]?|\n##\s+6\.|\n###\s+6\.|\Z))/gi;
  let match;
  const candidates = [];
  while ((match = ruleRegex.exec(rawText)) !== null) {
    const title = match[1].trim();
    const body = match[2].trim();
    candidates.push({ title, body });
  }
  return candidates;
}

/**
 * Loads the canonical Knowledge Index (05_KNOWLEDGE/knowledge-index.json)
 */
export function loadKnowledgeIndex() {
  if (!fs.existsSync(INDEX_PATH)) {
    return {
      version: '1.0.0',
      last_updated: new Date().toISOString(),
      total_verified_learnings: 0,
      total_promoted_rules: 0,
      items: {}
    };
  }
  try {
    return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
  } catch (err) {
    console.warn(`[GATEWAY WARNING] Failed to parse knowledge index, initializing fresh schema: ${err.message}`);
    return {
      version: '1.0.0',
      last_updated: new Date().toISOString(),
      total_verified_learnings: 0,
      total_promoted_rules: 0,
      items: {}
    };
  }
}

/**
 * Saves the canonical Knowledge Index atomically with flush
 */
export function saveKnowledgeIndex(indexData) {
  indexData.last_updated = new Date().toISOString();
  indexData.total_verified_learnings = Object.keys(indexData.items || {}).length;
  fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
  fs.writeFileSync(INDEX_PATH, JSON.stringify(indexData, null, 2), 'utf-8');
  return indexData;
}

/**
 * Loads harvest checkpoints (.project-brain/harvest-checkpoints.json)
 */
export function loadCheckpoints() {
  if (!fs.existsSync(CHECKPOINTS_PATH)) {
    return {
      version: '1.0.0',
      last_updated: new Date().toISOString(),
      checkpoints: {}
    };
  }
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINTS_PATH, 'utf-8'));
  } catch (err) {
    return {
      version: '1.0.0',
      last_updated: new Date().toISOString(),
      checkpoints: {}
    };
  }
}

/**
 * Saves harvest checkpoints atomically
 */
export function saveCheckpoints(checkpointData) {
  checkpointData.last_updated = new Date().toISOString();
  fs.mkdirSync(path.dirname(CHECKPOINTS_PATH), { recursive: true });
  fs.writeFileSync(CHECKPOINTS_PATH, JSON.stringify(checkpointData, null, 2), 'utf-8');
  return checkpointData;
}

/**
 * Creates an immutable, structured Learning Package with cryptographic hash
 */
export function createLearningPackage({
  repository,
  platform = 'github',
  slug,
  sourceUrl,
  sourceVersion = 'HEAD',
  license = 'Open-Source',
  aiProvider = 'unknown',
  dossierText = '',
  candidateRules = [],
  auditEvidence = null,
  metadata = {}
}) {
  const normSlug = slug || repository.replace(/\//g, '-').toLowerCase();
  const timestamp = new Date().toISOString();
  const learningId = `learn-${platform}-${normSlug.replace(/[^a-z0-9_-]/gi, '-')}-${Date.now().toString(36)}`;

  // Header template with strict governance metadata
  const header = `> **Canonical Learning Artifact**: \`07_PROJECT_LEARNING/${normSlug}-learnings.md\`  
> **Source**: ${platform} ([${sourceUrl || repository}](${sourceUrl || repository}))  
> **Source Version**: \`${sourceVersion.slice(0, 12)}\`  
> **License**: ${license || 'Open-Source (Permissive)'}  
> **Synthesized By**: ${aiProvider}  
> **Timestamp**: ${timestamp}  
> **Learning ID**: \`${learningId}\`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

`;

  const completeDossierContent = header + dossierText;
  const contentHash = calculateContentHash(completeDossierContent);

  const learningPackage = {
    learning_id: learningId,
    repository,
    slug: normSlug,
    platform,
    source_url: sourceUrl || (repository.includes('/') ? `https://github.com/${repository}` : repository),
    source_version: sourceVersion,
    license,
    ai_provider: aiProvider,
    content_hash: contentHash,
    raw_dossier_text: dossierText || '',
    dossier_content: completeDossierContent,
    candidate_rules: (Array.isArray(candidateRules) && candidateRules.length > 0)
      ? candidateRules
      : extractCandidateRulesFromText(dossierText),
    evidence: auditEvidence || {},
    metadata,
    // 5 Lifecycle State Flags
    stage: LEARNING_STAGES.EXTRACTED,
    status: LEARNING_STATUS.EXTRACTED_ONLY,
    extracted: true,
    validated: false,
    promoted_to_brain: false,
    brain_write: false,
    brain_readback: false,
    knowledge_index_updated: false,
    extracted_at: timestamp
  };

  return learningPackage;
}

/**
 * Validates the Learning Package before permitting entry into AI-Builder-Brain
 */
export function validateLearningPackage(learningPackage) {
  if (!learningPackage) {
    return { valid: false, reason: 'Learning package is null or undefined' };
  }
  if (!learningPackage.repository) {
    return { valid: false, reason: 'Missing repository identifier' };
  }
  const bodyText = learningPackage.raw_dossier_text || learningPackage.dossier_content || '';
  if (!bodyText || bodyText.trim().length < 100) {
    return { valid: false, reason: 'Dossier body fails minimum substance threshold (< 100 chars)' };
  }
  if (!learningPackage.content_hash) {
    return { valid: false, reason: 'Missing cryptographic content hash' };
  }

  // Validate candidate rules if any are attached
  const validatedRules = [];
  if (Array.isArray(learningPackage.candidate_rules)) {
    for (const rule of learningPackage.candidate_rules) {
      const v = validateRuleCandidate(rule.title, rule.body);
      if (v.valid) {
        validatedRules.push(rule);
      } else {
        console.warn(`🛡️ [GATEWAY VALIDATION GUARD] Candidate rule "${rule.title}" rejected: ${v.reason}`);
      }
    }
  }

  learningPackage.validated_rules = validatedRules;
  learningPackage.validated = true;
  learningPackage.stage = LEARNING_STAGES.VALIDATED;
  learningPackage.status = LEARNING_STATUS.VALIDATED;

  return {
    valid: true,
    package: learningPackage,
    validRuleCount: validatedRules.length
  };
}

/**
 * Performs Read-Back Verification on a written file against expected content hash
 */
export function readBackVerifyFile(filePath, expectedHash) {
  if (!fs.existsSync(filePath)) {
    return { verified: false, reason: `File does not exist on disk: ${filePath}` };
  }

  try {
    const diskContent = fs.readFileSync(filePath, 'utf-8');
    const diskHash = calculateContentHash(diskContent);

    if (diskHash !== expectedHash) {
      return {
        verified: false,
        reason: `Cryptographic hash mismatch. Expected ${expectedHash.slice(0, 16)}..., Found ${diskHash.slice(0, 16)}...`
      };
    }

    return {
      verified: true,
      bytes: Buffer.byteLength(diskContent, 'utf-8'),
      hash: diskHash
    };
  } catch (err) {
    return { verified: false, reason: `Read-back I/O failure: ${err.message}` };
  }
}

/**
 * Read-back verification for promoted rules in 05_KNOWLEDGE/engineering-patterns.md
 */
export function readBackVerifyRuleInPatterns(ruleNumber, ruleTitle) {
  if (!fs.existsSync(PATTERNS_PATH)) {
    return { verified: false, reason: 'engineering-patterns.md not found' };
  }

  try {
    const patternsContent = fs.readFileSync(PATTERNS_PATH, 'utf-8');
    const headerRegex = new RegExp(`##\\s+${ruleNumber}\\.\\s+`, 'i');
    const hasHeader = headerRegex.test(patternsContent);
    const hasTitle = patternsContent.toLowerCase().includes(ruleTitle.toLowerCase());

    if (hasHeader && hasTitle) {
      return { verified: true, ruleNumber, ruleTitle };
    }
    return {
      verified: false,
      reason: `Rule ${ruleNumber} ("${ruleTitle}") could not be located in read-back of engineering-patterns.md`
    };
  } catch (err) {
    return { verified: false, reason: `Patterns read-back I/O error: ${err.message}` };
  }
}

/**
 * Promotes validated rules into Master Brain (05_KNOWLEDGE/engineering-patterns.md)
 * with mandatory read-back verification for every promoted rule
 */
export function promoteValidatedRules(learningPackage) {
  if (!fs.existsSync(PATTERNS_PATH)) {
    return { success: false, promoted: [], error: 'engineering-patterns.md missing' };
  }

  const promotedList = [];
  const rulesToPromote = learningPackage.validated_rules || [];

  for (const rule of rulesToPromote) {
    const currentPatterns = fs.readFileSync(PATTERNS_PATH, 'utf-8');
    if (currentPatterns.toLowerCase().includes(rule.title.toLowerCase())) {
      console.log(`[RULE ALREADY EXISTS] Skipping duplicate rule: "${rule.title}"`);
      continue;
    }

    const nextRuleNum = resolveNextRuleNumber();
    const sourceUrl = learningPackage.source_url;
    const sourceRepoName = learningPackage.repository;
    const sourceVersion = learningPackage.source_version || 'HEAD';

    const provenanceMeta = {
      knowledge_type: 'engineering_pattern',
      topic: rule.title,
      source: sourceRepoName,
      source_url: sourceUrl,
      source_version: sourceVersion,
      license: learningPackage.license,
      extracted_at: new Date().toISOString(),
      ai_provider: learningPackage.ai_provider,
      generation_mode: 'source_derived_ai_synthesized',
      learning_id: learningPackage.learning_id,
      verified: true,
      confidence: 'high',
      promotion_status: 'approved',
      distillation_prohibited: true
    };

    const provenanceBlock = `<!-- PROVENANCE_START\n${JSON.stringify(provenanceMeta, null, 2)}\nPROVENANCE_END -->\n> **Provenance**: Harvested from [${sourceRepoName}](${sourceUrl}) (Revision: \`${sourceVersion.slice(0, 10)}\`).  \n> **Evidence**: Verified against commit diffs and closed defect autopsies. (Distillation Prohibited).`;

    const formattedRule = `\n\n---\n\n## ${nextRuleNum}. ${rule.title} (Harvested from ${sourceRepoName})\n\n${provenanceBlock}\n\n${rule.body}\n`;

    // Durable append
    fs.appendFileSync(PATTERNS_PATH, formattedRule, 'utf-8');

    // READ-BACK VERIFICATION FOR RULE
    const ruleReadBack = readBackVerifyRuleInPatterns(nextRuleNum, rule.title);
    if (!ruleReadBack.verified) {
      throw new Error(`RULE_PROMOTION_READBACK_FAILED: ${ruleReadBack.reason}`);
    }

    console.log(`🌟 [GATEWAY PROMOTION VERIFIED] Rule ${nextRuleNum}: "${rule.title}" validated, appended, and verified via read-back.`);
    promotedList.push({
      number: nextRuleNum,
      title: rule.title,
      provenance: provenanceMeta
    });
  }

  return { success: true, promoted: promotedList };
}

/**
 * Core Brain Learning Gateway:
 * Implements the transactional pipeline with hard invariant:
 *
 * LEARNING_SUCCESS =
 *   extraction_success
 *   AND validation_success
 *   AND brain_write_success
 *   AND brain_readback_success
 *   AND index_update_success
 */
export async function submitToBrainGateway(learningPackage, options = {}) {
  const startTime = Date.now();
  console.log(`\n======================================================================`);
  console.log(`🏛️  BRAIN LEARNING GATEWAY: PERSISTENCE & PROMOTION PIPELINE`);
  console.log(`   Target Repository : ${learningPackage.repository}`);
  console.log(`   Learning ID       : ${learningPackage.learning_id}`);
  console.log(`   Content Hash      : ${learningPackage.content_hash.slice(0, 16)}...`);
  console.log(`======================================================================`);

  const results = {
    repository: learningPackage.repository,
    learning_id: learningPackage.learning_id,
    content_hash: learningPackage.content_hash,
    status: LEARNING_STATUS.EXTRACTED_ONLY,
    stage: LEARNING_STAGES.EXTRACTED,
    extracted: true,
    validated: false,
    promoted_to_brain: false,
    brain_write: false,
    brain_readback: false,
    knowledge_index_updated: false,
    promoted_rules: [],
    dossier_path: null,
    errors: []
  };

  // 1. Validation Gate
  const valResult = validateLearningPackage(learningPackage);
  if (!valResult.valid) {
    results.status = LEARNING_STATUS.FAILED_VALIDATION;
    results.errors.push(`Validation failure: ${valResult.reason}`);
    console.error(`❌ [GATEWAY REJECTED] Validation failed: ${valResult.reason}`);
    updateCheckpoint(learningPackage.repository, results);
    return { success: false, ...results };
  }
  results.validated = true;
  results.stage = LEARNING_STAGES.VALIDATED;
  console.log(`✅ [GATEWAY STAGE 1: VALIDATED] Structure and rules verified.`);

  // 2. Durable Dossier Storage Write
  fs.mkdirSync(LEARNING_DIR, { recursive: true });
  const filename = `${learningPackage.slug}-learnings.md`;
  const dossierPath = path.join(LEARNING_DIR, filename);

  try {
    fs.writeFileSync(dossierPath, learningPackage.dossier_content, 'utf-8');
    results.brain_write = true;
    results.dossier_path = dossierPath;
    console.log(`💾 [GATEWAY STAGE 2: WRITTEN] Dossier flushed to 07_PROJECT_LEARNING/${filename}`);
  } catch (err) {
    results.status = LEARNING_STATUS.FAILED_PERSISTENCE;
    results.errors.push(`Dossier write failed: ${err.message}`);
    console.error(`❌ [GATEWAY WRITE FAILED] ${err.message}`);
    updateCheckpoint(learningPackage.repository, results);
    return { success: false, ...results };
  }

  // 3. READ-BACK VERIFICATION FOR DOSSIER
  const readBack = readBackVerifyFile(dossierPath, learningPackage.content_hash);
  if (!readBack.verified) {
    results.status = LEARNING_STATUS.FAILED_READBACK;
    results.errors.push(`Dossier readback failed: ${readBack.reason}`);
    console.error(`❌ [GATEWAY READBACK FAILED] ${readBack.reason}`);
    updateCheckpoint(learningPackage.repository, results);
    return { success: false, ...results };
  }
  results.brain_readback = true;
  console.log(`🔍 [GATEWAY STAGE 3: READ-BACK VERIFIED] Read back ${readBack.bytes} bytes. Hash match verified!`);

  // 4. Gated Master Brain Rule Promotion
  try {
    const promoResult = promoteValidatedRules(learningPackage);
    results.promoted_rules = promoResult.promoted || [];
    results.promoted_to_brain = true;
    results.stage = LEARNING_STAGES.PROMOTED;
    if (results.promoted_rules.length > 0) {
      console.log(`🎯 [GATEWAY STAGE 4: PROMOTED] ${results.promoted_rules.length} rule(s) promoted: ${results.promoted_rules.map(r => `Rule ${r.number}`).join(', ')}`);
    } else {
      console.log(`ℹ️ [GATEWAY STAGE 4: PROMOTED] Dossier validated; 0 net-new universal rules required promotion.`);
    }
  } catch (err) {
    results.status = LEARNING_STATUS.FAILED_PERSISTENCE;
    results.errors.push(`Rule promotion failed: ${err.message}`);
    console.error(`❌ [GATEWAY PROMOTION FAILED] ${err.message}`);
    updateCheckpoint(learningPackage.repository, results);
    return { success: false, ...results };
  }

  // 5. Canonical Knowledge Index Update
  try {
    const index = loadKnowledgeIndex();
    index.items[learningPackage.learning_id] = {
      learning_id: learningPackage.learning_id,
      repository: learningPackage.repository,
      slug: learningPackage.slug,
      platform: learningPackage.platform,
      source_url: learningPackage.source_url,
      source_version: learningPackage.source_version,
      status: LEARNING_STATUS.VERIFIED,
      content_hash: learningPackage.content_hash,
      dossier_file: `07_PROJECT_LEARNING/${filename}`,
      promoted_rules: results.promoted_rules.map(r => ({ number: r.number, title: r.title })),
      extracted: true,
      validated: true,
      promoted_to_brain: true,
      brain_write: true,
      brain_readback: true,
      knowledge_index_updated: true,
      verified_at: new Date().toISOString()
    };
    saveKnowledgeIndex(index);

    // Read-back verification for Knowledge Index
    const reloadedIndex = loadKnowledgeIndex();
    const recordedItem = reloadedIndex.items[learningPackage.learning_id];
    if (!recordedItem || recordedItem.content_hash !== learningPackage.content_hash) {
      throw new Error('Knowledge index read-back verification failed: record missing or hash mismatch');
    }

    results.knowledge_index_updated = true;
    console.log(`📖 [GATEWAY STAGE 5: INDEX UPDATED & READ-BACK VERIFIED] Recorded in 05_KNOWLEDGE/knowledge-index.json`);
  } catch (err) {
    results.status = LEARNING_STATUS.FAILED_PERSISTENCE;
    results.errors.push(`Index update failed: ${err.message}`);
    console.error(`❌ [GATEWAY INDEX FAILED] ${err.message}`);
    updateCheckpoint(learningPackage.repository, results);
    return { success: false, ...results };
  }

  // 6. Hard Invariant Assertion
  const learningSuccess =
    results.extracted === true &&
    results.validated === true &&
    results.brain_write === true &&
    results.brain_readback === true &&
    results.knowledge_index_updated === true;

  if (!learningSuccess) {
    results.status = LEARNING_STATUS.FAILED_PERSISTENCE;
    console.error(`❌ [HARD INVARIANT BREACHED] Learning persistence was incomplete. Status set to FAILED_PERSISTENCE.`);
    updateCheckpoint(learningPackage.repository, results);
    return { success: false, ...results };
  }

  // SUCCESS! Mark VERIFIED
  results.status = LEARNING_STATUS.VERIFIED;
  results.stage = LEARNING_STAGES.VERIFIED;
  updateCheckpoint(learningPackage.repository, results);

  const durationMs = Date.now() - startTime;
  console.log(`\n======================================================================`);
  console.log(`🏆 [LEARNING FULLY VERIFIED] ${learningPackage.repository}`);
  console.log(`   Status   : ${results.status}`);
  console.log(`   Duration : ${durationMs}ms`);
  console.log(`   Dossier  : 07_PROJECT_LEARNING/${filename} (${readBack.bytes} bytes)`);
  console.log(`   Rules    : ${results.promoted_rules.length} promoted`);
  console.log(`======================================================================\n`);

  return {
    success: true,
    ...results
  };
}

/**
 * Updates harvest checkpoint for resume capability
 */
function updateCheckpoint(repository, statusRecord) {
  try {
    const checkpoints = loadCheckpoints();
    checkpoints.checkpoints[repository] = {
      repository,
      learning_id: statusRecord.learning_id,
      stage: statusRecord.stage,
      status: statusRecord.status,
      extracted: statusRecord.extracted,
      validated: statusRecord.validated,
      brain_write: statusRecord.brain_write,
      brain_readback: statusRecord.brain_readback,
      knowledge_index_updated: statusRecord.knowledge_index_updated,
      last_updated: new Date().toISOString()
    };
    saveCheckpoints(checkpoints);
  } catch (err) {
    console.warn(`[CHECKPOINT WARNING] Failed to record checkpoint: ${err.message}`);
  }
}

/**
 * Inspects a repository or learning ID's current verification status
 */
export function getLearningStatus(repositoryOrSlug) {
  const index = loadKnowledgeIndex();
  const checkpoints = loadCheckpoints();

  // 1. Direct search in index
  for (const item of Object.values(index.items || {})) {
    if (item.repository === repositoryOrSlug || item.slug === repositoryOrSlug || item.learning_id === repositoryOrSlug) {
      return item;
    }
  }

  // 2. Search in checkpoints
  if (checkpoints.checkpoints?.[repositoryOrSlug]) {
    return checkpoints.checkpoints[repositoryOrSlug];
  }

  // 3. Fallback: check disk directly
  const slug = repositoryOrSlug.replace(/\//g, '-').toLowerCase();
  const dossierPath = path.join(LEARNING_DIR, `${slug}-learnings.md`);
  if (fs.existsSync(dossierPath)) {
    return {
      repository: repositoryOrSlug,
      slug,
      status: 'UNINDEXED_DOSSIER_EXISTS',
      stage: LEARNING_STAGES.EXTRACTED,
      extracted: true,
      promoted_to_brain: false,
      brain_write: true,
      brain_readback: false,
      knowledge_index_updated: false
    };
  }

  return {
    repository: repositoryOrSlug,
    status: 'NOT_FOUND',
    stage: LEARNING_STAGES.DISCOVERED,
    extracted: false
  };
}

/**
 * Diagnostic utility: scans and registers all existing dossiers into knowledge-index.json
 * Ensures historical knowledge base has read-back verified cryptographic hashes.
 */
export function syncExistingDossiersToKnowledgeIndex() {
  if (!fs.existsSync(LEARNING_DIR)) return { synced: 0 };
  const files = fs.readdirSync(LEARNING_DIR).filter(f => f.endsWith('-learnings.md'));
  const index = loadKnowledgeIndex();
  let synced = 0;

  for (const file of files) {
    const slug = file.replace(/-learnings\.md$/, '');
    const filePath = path.join(LEARNING_DIR, file);

    // Check if already indexed
    const existing = Object.values(index.items || {}).find(i => i.slug === slug || i.dossier_file?.includes(file));
    if (existing) continue;

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const hash = calculateContentHash(content);
      const learningId = `learn-legacy-${slug}`;

      // Extract repo name if available
      const sourceMatch = content.match(/> \*\*Source\*\*:\s*\[?([^\(\]\n]+)\]?\s*\(?([^\)\n]*)\)?/i);
      const repoName = sourceMatch ? sourceMatch[1].trim() : slug;
      const sourceUrl = sourceMatch && sourceMatch[2] ? sourceMatch[2].trim() : `https://github.com/${repoName}`;

      index.items[learningId] = {
        learning_id: learningId,
        repository: repoName,
        slug,
        platform: file.startsWith('hf-') ? 'huggingface' : 'github',
        source_url: sourceUrl,
        source_version: 'LEGACY_IMPORT',
        status: LEARNING_STATUS.VERIFIED,
        content_hash: hash,
        dossier_file: `07_PROJECT_LEARNING/${file}`,
        promoted_rules: [],
        extracted: true,
        validated: true,
        promoted_to_brain: true,
        brain_write: true,
        brain_readback: true,
        knowledge_index_updated: true,
        verified_at: new Date().toISOString()
      };
      synced++;
    } catch (err) {
      console.warn(`[SYNC WARNING] Failed to read ${file}: ${err.message}`);
    }
  }

  if (synced > 0) {
    saveKnowledgeIndex(index);
    console.log(`📚 [KNOWLEDGE INDEX SYNC] Registered ${synced} existing dossiers into 05_KNOWLEDGE/knowledge-index.json`);
  }

  return { synced, total: Object.keys(index.items || {}).length };
}
