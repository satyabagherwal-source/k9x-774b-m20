/**
 * 04_WORKFLOWS/factory-engine/destination-router.mjs
 *
 * Universal Knowledge Destination Router (Model-Independent)
 * Governing Architecture: AI-Builder-Brain Continuous Intelligence
 *
 * Routes verified intelligence and candidate items into their proper 16 canonical folders
 * based on knowledge type, domain, and structural role, rather than dumping all rules into
 * a single monolithic text file.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { classifyKnowledgeContent } from './domain-classifier.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_BRAIN_ROOT = path.resolve(__dirname, '..', '..');

/**
 * 16 Canonical Folders Responsibility Registry
 */
export const CANONICAL_FOLDERS = {
  '00_START_HERE': {
    name: '00_START_HERE',
    responsibility: 'Onboarding, quickstart orientation, architecture sitemap, beginner pair-programming primer',
    allowedTypes: ['orientation_guide', 'sitemap', 'onboarding_primer'],
    isIndexable: false
  },
  '01_CORE': {
    name: '01_CORE',
    responsibility: 'Immutable system rules, operating laws, non-negotiable safety invariants',
    allowedTypes: ['core_law', 'system_invariant', 'operating_protocol'],
    isIndexable: true
  },
  '02_AGENT_INTELLIGENCE': {
    name: '02_AGENT_INTELLIGENCE',
    responsibility: 'Agent role contracts, multi-agent fleet specs, prompt chains, subagent definitions',
    allowedTypes: ['agent_contract', 'fleet_roster', 'subagent_spec'],
    isIndexable: true
  },
  '03_SKILLS': {
    name: '03_SKILLS',
    responsibility: 'Reusable, model-independent execution playbooks and procedural domain skills',
    allowedTypes: ['skill_playbook', 'procedural_guide', 'execution_recipe'],
    isIndexable: true
  },
  '04_WORKFLOWS': {
    name: '04_WORKFLOWS',
    responsibility: 'Deterministic automation scripts, Project Factory engines, testing harnesses',
    allowedTypes: ['automation_engine', 'factory_workflow', 'test_suite'],
    isIndexable: true
  },
  '05_KNOWLEDGE': {
    name: '05_KNOWLEDGE',
    responsibility: 'Curated facts, verified domain patterns, professional disciplines, taxonomy',
    allowedTypes: ['engineering_pattern', 'domain_fact', 'discipline_profile', 'taxonomy_def'],
    isIndexable: true
  },
  '06_PROJECT_CONTEXT': {
    name: '06_PROJECT_CONTEXT',
    responsibility: 'Active project state, ephemeral build variables, child repo bridge configuration',
    allowedTypes: ['project_context', 'workspace_bridge', 'environment_state'],
    isIndexable: false
  },
  '07_PROJECT_LEARNING': {
    name: '07_PROJECT_LEARNING',
    responsibility: 'Raw harvested dossiers, repository extraction artifacts, commit forensic logs',
    allowedTypes: ['raw_dossier', 'commit_forensic', 'extraction_archive'],
    isIndexable: true
  },
  '08_VERIFICATION': {
    name: '08_VERIFICATION',
    responsibility: 'Test reports, independent audit trails, capability verification contracts, knowledge gaps',
    allowedTypes: ['audit_report', 'verification_contract', 'knowledge_gap', 'test_manifest'],
    isIndexable: true
  },
  '09_SOURCES': {
    name: '09_SOURCES',
    responsibility: 'External source catalogs, trust tier ledgers, scraping manifests, API registries',
    allowedTypes: ['source_entry', 'catalog_manifest', 'provenance_ledger'],
    isIndexable: true
  },
  '10_PROMPTS': {
    name: '10_PROMPTS',
    responsibility: 'Production system meta-prompts, pair-programming instructions, review guidelines',
    allowedTypes: ['system_prompt', 'instruction_template', 'review_prompt'],
    isIndexable: true
  },
  '11_INBOX': {
    name: '11_INBOX',
    responsibility: 'Pre-promotion staging buffer, candidate directives, unverified discoveries, review queue',
    allowedTypes: ['candidate_directive', 'unverified_discovery', 'staged_proposal'],
    isIndexable: false
  },
  '12_DECISIONS': {
    name: '12_DECISIONS',
    responsibility: 'Architecture Decision Records (ADRs), structural trade-offs, design choices',
    allowedTypes: ['architecture_decision', 'adr', 'tradeoff_analysis'],
    isIndexable: true
  },
  '13_GOVERNANCE': {
    name: '13_GOVERNANCE',
    responsibility: 'Change control protocols, human approval workflows, release procedures, safety gates',
    allowedTypes: ['governance_policy', 'approval_gate', 'change_protocol'],
    isIndexable: true
  },
  '14_EVOLUTION': {
    name: '14_EVOLUTION',
    responsibility: 'System capability roadmaps, historical milestones, schema migration logs',
    allowedTypes: ['roadmap_milestone', 'evolution_metric', 'migration_log'],
    isIndexable: true
  },
  '15_METADATA': {
    name: '15_METADATA',
    responsibility: 'Machine-readable capability registries, system taxonomy schemas, Zod definitions',
    allowedTypes: ['capability_contract', 'system_schema', 'metadata_registry'],
    isIndexable: true
  }
};

/**
 * Knowledge Type to Folder Resolution Mapping
 */
const TYPE_ROUTING_MAP = {
  // Core & Laws
  'core_law': '01_CORE',
  'system_invariant': '01_CORE',
  'operating_protocol': '01_CORE',

  // Agent Intelligence
  'agent_contract': '02_AGENT_INTELLIGENCE',
  'fleet_roster': '02_AGENT_INTELLIGENCE',
  'subagent_spec': '02_AGENT_INTELLIGENCE',

  // Skills & Playbooks
  'skill_playbook': '03_SKILLS',
  'procedural_guide': '03_SKILLS',
  'execution_recipe': '03_SKILLS',

  // Automation & Workflows
  'automation_engine': '04_WORKFLOWS',
  'factory_workflow': '04_WORKFLOWS',
  'test_suite': '04_WORKFLOWS',

  // Knowledge & Patterns
  'engineering_pattern': '05_KNOWLEDGE',
  'domain_fact': '05_KNOWLEDGE',
  'discipline_profile': '05_KNOWLEDGE',
  'taxonomy_def': '05_KNOWLEDGE',

  // Dossiers
  'raw_dossier': '07_PROJECT_LEARNING',
  'commit_forensic': '07_PROJECT_LEARNING',

  // Verification & Gaps
  'audit_report': '08_VERIFICATION',
  'verification_contract': '08_VERIFICATION',
  'knowledge_gap': '08_VERIFICATION',
  'test_manifest': '08_VERIFICATION',

  // Sources
  'source_entry': '09_SOURCES',
  'catalog_manifest': '09_SOURCES',

  // Prompts
  'system_prompt': '10_PROMPTS',
  'instruction_template': '10_PROMPTS',

  // Staging
  'candidate_directive': '11_INBOX',
  'unverified_discovery': '11_INBOX',

  // Architecture Decisions (ADRs)
  'architecture_decision': '12_DECISIONS',
  'adr': '12_DECISIONS',
  'tradeoff_analysis': '12_DECISIONS',

  // Governance
  'governance_policy': '13_GOVERNANCE',
  'approval_gate': '13_GOVERNANCE',
  'change_protocol': '13_GOVERNANCE',

  // Evolution & Roadmaps
  'roadmap_milestone': '14_EVOLUTION',
  'evolution_metric': '14_EVOLUTION',

  // Metadata & Schemas
  'capability_contract': '15_METADATA',
  'system_schema': '15_METADATA'
};

/**
 * Determines whether an item requires Human Approval Gate
 */
export function requiresHumanApproval(knowledgeType, primaryDomainLetter) {
  // Engineering patterns, skills, agent contracts, and dossiers never require human approval
  if (['engineering_pattern', 'skill_playbook', 'agent_contract', 'raw_dossier', 'commit_forensic', 'verification_contract'].includes(knowledgeType)) {
    return false;
  }
  // Changes to Core, Governance, or sensitive evolutionary policies mandate human approval
  if (['core_law', 'system_invariant', 'governance_policy', 'approval_gate'].includes(knowledgeType)) {
    return true;
  }
  // Tier-1 feedback and system self-modification (Domain M) require human signature ONLY for core laws or governance
  if (primaryDomainLetter === 'M' && ['core_law', 'system_invariant', 'governance_policy'].includes(knowledgeType)) {
    return true;
  }
  return false;
}

/**
 * Resolves destination folder and relative file path for a knowledge item
 *
 * @param {object} item - Knowledge item { title, knowledgeType, content, tags, domain }
 * @returns {object} Destination routing resolution
 */
export function resolveDestination(item) {
  if (!item || typeof item !== 'object') {
    throw new Error('resolveDestination: Invalid item object provided');
  }

  // 1. Inspect any attached rules or candidate items
  const firstRule = (Array.isArray(item.validated_rules) && item.validated_rules[0]) ||
                    (Array.isArray(item.candidate_rules) && item.candidate_rules[0]) ||
                    (Array.isArray(item.extracted_rules) && item.extracted_rules[0]) || {};

  // 2. Classify domain if not already explicitly provided
  let classification = null;
  let primaryLetter = item.domain || item.primary_domain || item.primaryDomain?.letter || null;

  if (!primaryLetter || primaryLetter === 'UNASSIGNED') {
    classification = classifyKnowledgeContent(item);
    primaryLetter = classification.primaryDomain ? classification.primaryDomain.letter : 'H';
  }

  // 3. Resolve primary folder based on knowledgeType
  const isRuleCandidate = Boolean(item.is_rule || (item.body && /\*\*RULE\*\*:?/i.test(item.body)) || (firstRule.body && /\*\*RULE\*\*:?/i.test(firstRule.body)));
  const kType = String(item.knowledgeType || firstRule.knowledgeType || (isRuleCandidate ? 'engineering_pattern' : '') || item.metadata?.knowledgeType || '').toLowerCase().trim();
  let targetFolder = TYPE_ROUTING_MAP[kType] || null;

  const effectiveTitle = item.title || firstRule.title || item.metadata?.title || item.repository || 'unnamed-item';

  // If knowledgeType is missing or unknown, infer based on domain and role
  if (!targetFolder) {
    if (isRuleCandidate) {
      targetFolder = '05_KNOWLEDGE';
    } else if (primaryLetter === 'G' && (effectiveTitle.toLowerCase().includes('decision') || effectiveTitle.toLowerCase().includes('adr'))) {
      targetFolder = '12_DECISIONS';
    } else if (primaryLetter === 'K' && effectiveTitle.toLowerCase().includes('gap')) {
      targetFolder = '08_VERIFICATION';
    } else if (kType.includes('skill') || effectiveTitle.toLowerCase().includes('playbook')) {
      targetFolder = '03_SKILLS';
    } else {
      // Default to Domain Knowledge
      targetFolder = '05_KNOWLEDGE';
    }
  }

  // 4. Determine secondary cross-reference folders
  const secondaryFolders = new Set();
  if (targetFolder === '12_DECISIONS') {
    secondaryFolders.add('05_KNOWLEDGE');
  } else if (targetFolder === '03_SKILLS') {
    secondaryFolders.add('05_KNOWLEDGE');
  } else if (targetFolder === '08_VERIFICATION') {
    secondaryFolders.add('05_KNOWLEDGE');
  }

  // 5. Construct safe destination relative path
  const slug = (item.slug || effectiveTitle)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);

  let suggestedRelativePath = '';
  switch (targetFolder) {
    case '01_CORE':
      suggestedRelativePath = '01_CORE/operating-rules.md';
      break;
    case '02_AGENT_INTELLIGENCE':
      suggestedRelativePath = `02_AGENT_INTELLIGENCE/${slug}.md`;
      break;
    case '03_SKILLS':
      suggestedRelativePath = `03_SKILLS/${slug}.md`;
      break;
    case '05_KNOWLEDGE':
      if (kType === 'engineering_pattern' || item.type === 'engineering_pattern' || item.is_rule || isRuleCandidate) {
        suggestedRelativePath = '05_KNOWLEDGE/engineering-patterns.md';
      } else {
        suggestedRelativePath = `05_KNOWLEDGE/domain-intelligence/DOM-${primaryLetter}-${slug}.md`;
      }
      break;
    case '08_VERIFICATION':
      suggestedRelativePath = `08_VERIFICATION/${slug}.md`;
      break;
    case '11_INBOX':
      suggestedRelativePath = `11_INBOX/candidate-directives/${slug}.md`;
      break;
    case '12_DECISIONS':
      suggestedRelativePath = `12_DECISIONS/ADR-${slug}.md`;
      break;
    case '13_GOVERNANCE':
      suggestedRelativePath = `13_GOVERNANCE/${slug}.md`;
      break;
    case '15_METADATA':
      suggestedRelativePath = `15_METADATA/capabilities/${slug}.json`;
      break;
    default:
      suggestedRelativePath = `${targetFolder}/${slug}.md`;
  }

  const needsHuman = requiresHumanApproval(kType, primaryLetter) || item.requires_human_approval === true;

  return {
    targetFolder,
    suggestedRelativePath,
    primaryDomainLetter: primaryLetter,
    secondaryFolders: Array.from(secondaryFolders),
    requiresHumanApproval: needsHuman,
    classificationDetails: classification
  };
}

/**
 * Creates a standardized Universal Knowledge Package
 */
export function buildUniversalKnowledgePackage(rawInput) {
  const content = rawInput.content || rawInput.body || rawInput.rule || '';
  const hash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  const routing = resolveDestination(rawInput);

  return {
    id: rawInput.id || `KNOW-${Date.now()}-${hash.slice(0, 8)}`,
    title: rawInput.title || 'Untitled Knowledge Artifact',
    knowledgeType: rawInput.knowledgeType || 'domain_fact',
    primaryDomain: routing.primaryDomainLetter,
    secondaryDomains: rawInput.secondaryDomains || [],
    destinationFolder: routing.targetFolder,
    destinationPath: routing.suggestedRelativePath,
    contentHash: hash,
    content,
    provenance: {
      sourceUrl: rawInput.sourceUrl || rawInput.source_repo || 'internal://ai-builder-brain',
      sourceCommit: rawInput.sourceCommit || rawInput.source_commit || null,
      trustTier: rawInput.trustTier || 'COMMUNITY_VERIFIED',
      license: rawInput.license || 'UNSPECIFIED'
    },
    validationStatus: rawInput.validationStatus || 'STAGED',
    confidence: rawInput.confidence || (routing.classificationDetails?.confidence ?? 0.5),
    requiresHumanApproval: routing.requiresHumanApproval,
    crossReferences: routing.secondaryFolders,
    timestamp: new Date().toISOString()
  };
}

/**
 * Verifies that a persisted file exactly matches the expected SHA-256 hash
 */
export function verifyReadBackParity(filePath, expectedHash) {
  if (!fs.existsSync(filePath)) {
    return { verified: false, reason: `File does not exist: ${filePath}` };
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const actualHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  if (actualHash !== expectedHash) {
    return {
      verified: false,
      reason: `Hash mismatch. Expected: ${expectedHash}, Actual: ${actualHash}`
    };
  }
  return {
    verified: true,
    bytes: Buffer.byteLength(content, 'utf8'),
    hash: actualHash
  };
}

