/**
 * UNIVERSAL 13-DOMAIN INTELLIGENCE ENGINE (UDIE)
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\domain-intelligence-engine.mjs
 * Purpose: Provides canonical classification, structured normalization, relationship mapping,
 *          provenance preservation, and domain-targeted delivery across the 13 Co-Equal
 *          Intelligence Domains (A through M):
 * 
 *   Domain A: Human & Need Intelligence (human_need)
 *   Domain B: Product Intelligence (product)
 *   Domain C: Market & Business Intelligence (market_business)
 *   Domain D: Research & Knowledge Intelligence (research_knowledge)
 *   Domain E: Creative Intelligence (creative)
 *   Domain F: Design Intelligence (design)
 *   Domain G: Architecture Intelligence (architecture)
 *   Domain H: Technical Construction Intelligence (technical_construction)
 *   Domain I: Content & Information Intelligence (content_information)
 *   Domain J: Search & Distribution Intelligence (search_distribution)
 *   Domain K: Quality & Verification Intelligence (quality_verification)
 *   Domain L: Deployment & Operations Intelligence (deployment_operations)
 *   Domain M: Feedback & Evolution Intelligence (feedback_evolution)
 * 
 * INVARIANT:
 * AI THINKS. BRAIN STORES AND SUPPLIES INTELLIGENCE DATA. TOOLS EXECUTE. PRODUCTS CREATE OUTCOMES.
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import {
  HIGH_IMPACT_DOMAINS,
  verifyHumanApprovalToken,
  recordHumanApprovalAudit,
  recordConsumedNonce,
  acquireRegistryLock,
  releaseRegistryLock
} from './human-approval-authority.mjs';

import { syncRecordToKnowledgeGraph } from './knowledge-relationship-graph.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// 1. Canonical 13-Domain Taxonomy Definition
// ---------------------------------------------------------------------------

export const INTELLIGENCE_DOMAINS = Object.freeze({
  A: {
    letter: 'A',
    id: 'human_need',
    name: 'Human & Need Intelligence',
    description: 'Human needs, problems, user personas, friction points, accessibility, and intended outcomes.',
    keywords: ['need', 'problem', 'user', 'persona', 'pain', 'painpoint', 'accessibility', 'friction', 'outcome', 'privacy', 'empathy', 'urgency', 'workflow', 'mental-model', 'consent', 'cognition', 'disability']
  },
  B: {
    letter: 'B',
    id: 'product',
    name: 'Product Intelligence',
    description: 'Product definitions, PRD intelligence, MVP scoping, negative scope exclusions, and user stories.',
    keywords: ['prd', 'product', 'mvp', 'feature', 'scope', 'negative-scope', 'story', 'acceptance-criteria', 'roadmap', 'milestone', 'prioritization', 'backlog', 'specification', 'user-story']
  },
  C: {
    letter: 'C',
    id: 'market_business',
    name: 'Market & Business Intelligence',
    description: 'Competitor landscape, value proposition, pricing, gross margin, hurdle rates, and commercial viability.',
    keywords: ['market', 'competitor', 'business', 'pricing', 'viability', 'margin', 'monetization', 'value-prop', 'hurdle', 'ltv', 'cac', 'differentiation', 'commercial', 'roi', 'tam', 'revenue']
  },
  D: {
    letter: 'D',
    id: 'research_knowledge',
    name: 'Research & Knowledge Intelligence',
    description: 'Evidence extraction, primary source verification, cross-corroboration, and uncertainty mapping.',
    keywords: ['research', 'evidence', 'provenance', 'corroboration', 'source', 'citation', 'scientific', 'investigation', 'uncertainty', 'literature', 'empirical', 'benchmark', 'methodology', 'validity']
  },
  E: {
    letter: 'E',
    id: 'creative',
    name: 'Creative Intelligence',
    description: 'Originality, creative problem solving, aesthetic tone, visual metaphors, and brand uniqueness.',
    keywords: ['creative', 'originality', 'aesthetic', 'metaphor', 'concept', 'art', 'voice', 'brand', 'uniqueness', 'imagination', 'storytelling', 'narrative', 'tone', 'visual-identity', 'branding']
  },
  F: {
    letter: 'F',
    id: 'design',
    name: 'Design Intelligence',
    description: 'UI/UX design systems, typography, color palettes, responsive layouts, Tailwind tokens, and micro-interactions.',
    keywords: ['design', 'ui', 'ux', 'tailwind', 'typography', 'color', 'palette', 'layout', 'responsive', 'viewport', 'css', 'oklch', 'theme', 'tokens', 'spacing', 'contrast', 'wcag', 'a11y', 'dark-mode', 'wireframe']
  },
  G: {
    letter: 'G',
    id: 'architecture',
    name: 'Architecture Intelligence',
    description: 'System boundaries, modularity, IPC, state management, worker concurrency, and zero-copy bridges.',
    keywords: ['architecture', 'boundary', 'modular', 'component', 'ipc', 'state', 'concurrency', 'mutex', 'worker', 'data-flow', 'zero-copy', 'coupling', 'dag', 'saga', 'subtask', 'contract', 'state-machine', 'modularity']
  },
  H: {
    letter: 'H',
    id: 'technical_construction',
    name: 'Technical Construction Intelligence',
    description: 'Executable algorithms, framework idioms, DOM manipulation, client-side canvas/WASM pipelines, and memory safety.',
    keywords: ['algorithm', 'code', 'javascript', 'typescript', 'astro', 'react', 'wasm', 'canvas', 'dom', 'memory', 'performance', 'stream', 'pipeline', 'parser', 'async', 'transpiler', 'runtime', 'buffer', 'compiler', 'memory-leak']
  },
  I: {
    letter: 'I',
    id: 'content_information',
    name: 'Content & Information Intelligence',
    description: 'Information architecture, clear technical writing, micro-copy, educational clarity, and documentation.',
    keywords: ['content', 'documentation', 'copy', 'information', 'hierarchy', 'writing', 'guide', 'explanation', 'micro-copy', 'manual', 'schema', 'readme', 'api-docs', 'technical-writing', 'glossary', 'markdown']
  },
  J: {
    letter: 'J',
    id: 'search_distribution',
    name: 'Search & Distribution Intelligence',
    description: 'Technical SEO, OpenGraph tags, JSON-LD structured data, sitemaps, canonical links, and distribution channels.',
    keywords: ['seo', 'opengraph', 'json-ld', 'sitemap', 'canonical', 'meta', 'crawl', 'indexation', 'distribution', 'organic', 'search', 'schema-org', 'robots', 'discoverability', 'rss', 'social-card', 'structured-data']
  },
  K: {
    letter: 'K',
    id: 'quality_verification',
    name: 'Quality & Verification Intelligence',
    description: 'Automated test contracts, regression shields, invariant assertions, zero-network probes, and verification barriers.',
    keywords: ['test', 'verification', 'assertion', 'invariant', 'quality', 'regression', 'e2e', 'unit', 'probe', 'barrier', 'pass', 'audit', 'compliance', 'fuzzing', 'property-based', 'sandbox-test', 'zero-network', 'exit-code']
  },
  L: {
    letter: 'L',
    id: 'deployment_operations',
    name: 'Deployment & Operations Intelligence',
    description: 'CI/CD workflows, static hosting, edge runtime, disaster recovery vault backups, and health monitoring.',
    keywords: ['deployment', 'hosting', 'ci-cd', 'vault', 'backup', 'disaster-recovery', 'docker', 'vercel', 'pages', 'monitoring', 'uptime', 'chunking', 'container', 'healthcheck', 'sre', 'devops', 'zero-downtime']
  },
  M: {
    letter: 'M',
    id: 'feedback_evolution',
    name: 'Feedback & Evolution Intelligence',
    description: 'Forensic defect autopsies, incident logs, continuous learning extraction, and rule promotion pipelines.',
    keywords: ['feedback', 'learning', 'autopsy', 'incident', 'evolution', 'promotion', 'retrospective', 'harvest', 'adaptation', 'refinement', 'telemetry', 'defect', 'drift', 'continuous-improvement', 'post-mortem']
  }
});

// Domain aliases mapping external subsystem IDs and aliases to canonical 13 domains
const DOMAIN_ALIASES = {
  // Capability Registry & Subsystem Domains
  'accessibility_a11y': 'F',
  'a11y': 'F',
  'accessibility': 'F',
  'software_architecture': 'G',
  'architecture_system': 'G',
  'system_architecture': 'G',
  'security_threat_modeling': 'G',
  'threat_modeling': 'G',
  'developer_tools_ides': 'H',
  'tools_ides': 'H',
  'operating_systems_system_interfaces': 'H',
  'content_intelligence_information_architecture': 'I',
  'information_architecture': 'I',
  'technical_documentation': 'I',
  'seo_intelligence': 'J',
  'seo_distribution': 'J',
  'search_engine_optimization': 'J',
  'testing_reliability': 'K',
  'qa_testing': 'K',
  'test_automation': 'K',
  'infrastructure_deployment': 'L',
  'operations_monitoring_sre': 'L',
  'devops': 'L',
  'sre': 'L',
  'evolution_continuous_improvement': 'M',
  'continuous_evolution': 'M',
  'legal_compliance': 'C',
  'business_model': 'C',
  'user_research': 'A',
  'human_factors': 'A',
  'product_management': 'B',
  'creative_direction': 'E',
  'branding': 'E'
};

// Domain lookup map for letter, id, or alias
const DOMAIN_LOOKUP = new Map();
for (const [letter, info] of Object.entries(INTELLIGENCE_DOMAINS)) {
  DOMAIN_LOOKUP.set(letter.toUpperCase(), info);
  DOMAIN_LOOKUP.set(info.id.toLowerCase(), info);
}
for (const [alias, targetLetter] of Object.entries(DOMAIN_ALIASES)) {
  const targetDomain = INTELLIGENCE_DOMAINS[targetLetter];
  if (targetDomain) {
    DOMAIN_LOOKUP.set(alias.toLowerCase(), targetDomain);
  }
}

/**
 * Resolves a domain identifier (e.g. 'F', 'design', 'Domain F') to the canonical domain record.
 */
export function resolveDomain(identifier) {
  if (!identifier) return null;
  const clean = String(identifier).trim().replace(/^domain\s+/i, '').toUpperCase();
  if (DOMAIN_LOOKUP.has(clean)) return DOMAIN_LOOKUP.get(clean);
  const lower = String(identifier).trim().toLowerCase().replace(/^domain\s+/i, '');
  if (DOMAIN_LOOKUP.has(lower)) return DOMAIN_LOOKUP.get(lower);
  return null;
}

// ---------------------------------------------------------------------------
// 2. Automated Domain Classification
// ---------------------------------------------------------------------------

/**
 * Classifies text content or an intelligence item into Primary and Secondary Domains.
 * 
 * @param {string} text - Title, body, or excerpt to classify
 * @param {object} metadata - Optional hints (category, tags, filePath)
 * @returns {object} { primaryDomain, secondaryDomains, confidence, domainScores }
 */
export function classifyIntelligenceDomain(text, metadata = {}) {
  const content = `${metadata.title || ''} ${metadata.category || ''} ${metadata.filePath || ''} ${text || ''}`.toLowerCase();
  const domainScores = {};

  for (const [letter, domain] of Object.entries(INTELLIGENCE_DOMAINS)) {
    let score = 0;
    for (const kw of domain.keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'gi');
      const matches = content.match(regex);
      if (matches) {
        score += matches.length * 1.0;
      }
    }
    domainScores[letter] = score;
  }

  // Explicit category overrides if unambiguous
  if (metadata.category === 'SEO_INTELLIGENCE' || /sitemap|opengraph|schema\.org/i.test(metadata.title || '')) {
    domainScores['J'] += 10;
  }
  if (metadata.category === 'VERIFICATION_PROTOCOL' || /verification|assert|test-suite/i.test(metadata.filePath || '')) {
    domainScores['K'] += 10;
  }
  if (/design-tokens|tailwind|styling/i.test(content)) {
    domainScores['F'] += 8;
  }
  if (/disaster-recovery|backup|vault|ci-cd/i.test(content)) {
    domainScores['L'] += 8;
  }
  if (/problem-record|persona|pain-point/i.test(content)) {
    domainScores['A'] += 8;
  }
  if (/prd-specification|mvp-scope|negative-scope/i.test(content)) {
    domainScores['B'] += 8;
  }
  if (/business-feasibility|gross-margin|competitor-matrix/i.test(content)) {
    domainScores['C'] += 8;
  }

  const sortedDomains = Object.entries(domainScores).sort((a, b) => b[1] - a[1]);
  const primaryEntry = sortedDomains[0];
  const primaryLetter = primaryEntry && primaryEntry[1] > 0 ? primaryEntry[0] : 'H'; // Default to Technical Construction
  const primaryDomain = INTELLIGENCE_DOMAINS[primaryLetter];

  const secondaryDomains = sortedDomains
    .slice(1, 3)
    .filter(entry => entry[1] >= 2)
    .map(entry => INTELLIGENCE_DOMAINS[entry[0]]);

  const totalScore = Object.values(domainScores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? Math.min(1.0, Math.round(((primaryEntry[1] / totalScore) * 1.5) * 100) / 100) : 0.5;

  return {
    primaryDomain,
    secondaryDomains,
    confidence,
    domainScores
  };
}

// ---------------------------------------------------------------------------
// 3. Structured Domain Intelligence Record Creation & Storage
// ---------------------------------------------------------------------------

/**
 * Computes an idempotent, normalized semantic content hash for domain intelligence records.
 * Strips explicitly recognized non-semantic test and trace annotations while preserving
 * meaningful technical substance, formatting, and domain identity.
 */
export function computeNormalizedSemanticHash(domainLetter, title, rawContent) {
  if (!rawContent || typeof rawContent !== 'string') {
    throw new Error('INVALID_CONTENT: Content must be a non-empty string.');
  }

  // 1. Remove only explicitly recognized non-semantic trace token artifacts
  let cleanContent = rawContent
    .replace(/\r?\n\r?\n--- \[Trace Token: [^\]]+\]/gi, '')
    .replace(/\r?\n--- \[Trace Token: [^\]]+\]/gi, '')
    .replace(/--- \[Trace Token: [^\]]+\]/gi, '')
    .replace(/\[Trace Token: [^\]]+\]/gi, '')
    .replace(/\[Token: [^\]]+\]/gi, '');

  // 2. Normalize CRLF to LF
  cleanContent = cleanContent.replace(/\r\n/g, '\n');

  // 3. Normalize horizontal whitespace runs (spaces and tabs) without collapsing paragraph breaks
  cleanContent = cleanContent
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .trim();

  const cleanTitle = String(title || '').trim().toLowerCase();
  const cleanDomain = String(domainLetter || '').trim().toUpperCase();

  return crypto.createHash('sha256')
    .update(`${cleanDomain}:${cleanTitle}:${cleanContent}`)
    .digest('hex');
}

/**
 * Creates an immutable, structured Domain Intelligence Record with verified provenance and SHA-256 evidence.
 */
export function createDomainIntelligenceRecord(params = {}) {
  const title = String(params.title || '').trim();
  if (!title) throw new Error('MISSING_TITLE: Domain intelligence record requires a non-empty title.');

  const content = String(params.content || params.ruleText || '').trim();
  if (!content) throw new Error('MISSING_CONTENT: Domain intelligence record requires non-empty content.');

  const classification = classifyIntelligenceDomain(`${title} ${content}`, params);
  const primaryDomain = params.forcedDomain ? (resolveDomain(params.forcedDomain) || classification.primaryDomain) : classification.primaryDomain;

  const contentHash = params.content_hash || computeNormalizedSemanticHash(primaryDomain.letter, title, content);

  const recordId = params.id || `DOM-${primaryDomain.letter}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const now = new Date().toISOString();

  const record = {
    record_id: recordId,
    domain_letter: primaryDomain.letter,
    domain_id: primaryDomain.id,
    domain_name: primaryDomain.name,
    secondary_domains: classification.secondaryDomains.map(d => ({ letter: d.letter, id: d.id, name: d.name })),
    title,
    content,
    content_hash: contentHash,
    summary: params.summary || content.slice(0, 280),
    provenance: {
      source_uri: params.source_uri || 'internal://AI-Builder-Brain',
      source_version: params.source_version || '1.0',
      observed_at: params.observed_at || now,
      author_or_entity: params.author_or_entity || 'AI-Builder-Brain',
      license: params.license || 'Proprietary-Universal'
    },
    evidence: {
      evidence_type: params.evidence_type || 'EMPIRICAL_CODE_PATTERN',
      verification_status: params.verification_status || 'VERIFIED',
      verification_reference: params.verification_reference || null
    },
    relationships: {
      prerequisite_rules: Array.isArray(params.prerequisite_rules) ? params.prerequisite_rules : [],
      related_domains: classification.secondaryDomains.map(d => d.letter),
      applied_in_blueprints: Array.isArray(params.blueprints) ? params.blueprints : ['astro-tailwind-v4', 'universal']
    },
    confidence: classification.confidence,
    created_at: now
  };

  return Object.freeze(record);
}

/**
 * Resolves the domain registry storage paths.
 */
export function getDomainStoragePaths(customRoot = null) {
  const root = customRoot || BRAIN_ROOT;
  const domainDir = path.join(root, '05_KNOWLEDGE', 'domain-intelligence');
  return {
    domainDir,
    registryFile: path.join(domainDir, 'domain-registry.json')
  };
}

/**
 * Loads the canonical Domain Registry from disk.
 */
export function loadDomainRegistry(customRoot = null) {
  const { domainDir, registryFile } = getDomainStoragePaths(customRoot);
  if (!fs.existsSync(registryFile)) {
    return {
      version: '1.0.0',
      description: 'AI-Builder-Brain 13-Domain Universal Intelligence Registry',
      last_updated: new Date().toISOString(),
      total_records: 0,
      domains: Object.fromEntries(Object.keys(INTELLIGENCE_DOMAINS).map(k => [k, { total: 0, record_ids: [] }])),
      records: {}
    };
  }
  try {
    return JSON.parse(fs.readFileSync(registryFile, 'utf-8'));
  } catch (err) {
    return {
      version: '1.0.0',
      description: 'AI-Builder-Brain 13-Domain Universal Intelligence Registry',
      last_updated: new Date().toISOString(),
      total_records: 0,
      domains: Object.fromEntries(Object.keys(INTELLIGENCE_DOMAINS).map(k => [k, { total: 0, record_ids: [] }])),
      records: {}
    };
  }
}

/**
 * Saves a Domain Intelligence Record into the registry with atomic persistence.
 * Enforces strict cryptographic human authorization at the final persistence boundary
 * for high-impact domains (A, G, M) to prevent AI self-approval and unauthorized mutations.
 */
export function persistDomainIntelligenceRecord(record, customRoot = null, authContext = {}) {
  const domainLetter = String(record.domain_letter || '').trim().toUpperCase();

  // -------------------------------------------------------------------------
  // 1. Mandatory Persistence Boundary Enforcement for High-Impact Domains
  // -------------------------------------------------------------------------
  let verifiedToken = null;
  if (HIGH_IMPACT_DOMAINS.includes(domainLetter)) {
    const token = authContext.humanApprovalToken || authContext.human_approval_token;
    if (!token) {
      return {
        persisted: false,
        code: 'PERSISTENCE_REJECTED_UNAUTHORIZED_DOMAIN',
        domain_letter: domainLetter,
        reason: `Domain ${domainLetter} governs core architecture, governance, or human need. Cryptographic human authorization is mandatory; direct persistence blocked.`
      };
    }

    const verification = verifyHumanApprovalToken(record, token, customRoot, {
      ...(authContext.tokenOptions || {}),
      consumeNonce: false
    });
    if (!verification.valid) {
      return {
        persisted: false,
        code: 'PERSISTENCE_REJECTED_UNAUTHORIZED_DOMAIN',
        verification_code: verification.code,
        domain_letter: domainLetter,
        reason: `Cryptographic human authorization verification failed: ${verification.reason}`
      };
    }
    verifiedToken = token;
  }

  // -------------------------------------------------------------------------
  // 2. Concurrency Lock & Atomic Storage Mutation
  // -------------------------------------------------------------------------
  let lockAcquired = false;
  try {
    acquireRegistryLock(customRoot);
    lockAcquired = true;

    const { domainDir, registryFile } = getDomainStoragePaths(customRoot);
    if (!fs.existsSync(domainDir)) {
      fs.mkdirSync(domainDir, { recursive: true });
    }

    const registry = loadDomainRegistry(customRoot);

    // Check for duplicates via content hash or normalized semantic hash
    const recordSemanticHash = record.content ? computeNormalizedSemanticHash(record.domain_letter, record.title, record.content) : null;
    const existingRecords = Object.values(registry.records || {});
    const existingDuplicate = existingRecords.find(r => {
      if (r.content_hash === record.content_hash) return true;
      if (recordSemanticHash && r.content) {
        try {
          return computeNormalizedSemanticHash(r.domain_letter, r.title, r.content) === recordSemanticHash;
        } catch (e) {
          return false;
        }
      }
      return false;
    });
    if (existingDuplicate) {
      return {
        persisted: false,
        code: 'DUPLICATE_CONTENT_HASH',
        reason: 'DUPLICATE_CONTENT_HASH',
        existing_record_id: existingDuplicate.record_id
      };
    }

    // Insert record
    registry.records[record.record_id] = record;
    registry.total_records = Object.keys(registry.records).length;
    registry.last_updated = new Date().toISOString();

    if (!registry.domains[record.domain_letter]) {
      registry.domains[record.domain_letter] = { total: 0, record_ids: [] };
    }
    if (!registry.domains[record.domain_letter].record_ids.includes(record.record_id)) {
      registry.domains[record.domain_letter].record_ids.push(record.record_id);
      registry.domains[record.domain_letter].total = registry.domains[record.domain_letter].record_ids.length;
    }

    // Atomic write via temporary file
    const tmpFile = `${registryFile}.tmp.${process.pid}.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(registry, null, 2), 'utf-8');
    try {
      fs.renameSync(tmpFile, registryFile);
    } catch (err) {
      fs.copyFileSync(tmpFile, registryFile);
      try { fs.unlinkSync(tmpFile); } catch (e) {}
    }

    // -----------------------------------------------------------------------
    // 3. Durable Audit Logging & Nonce Consumption for High-Impact Approvals
    // -----------------------------------------------------------------------
    if (HIGH_IMPACT_DOMAINS.includes(domainLetter) && verifiedToken) {
      // Nonce is consumed strictly AFTER successful disk write (crash-safe ordering)
      recordConsumedNonce(verifiedToken.nonce, customRoot);

      recordHumanApprovalAudit({
        candidate_id: verifiedToken.candidate_id || record.record_id,
        record_id: record.record_id,
        domain_letter: record.domain_letter,
        human_operator_id: verifiedToken.human_operator_id,
        content_hash: record.content_hash,
        approval_timestamp: verifiedToken.approval_timestamp,
        signature: verifiedToken.signature,
        nonce: verifiedToken.nonce,
        promotion_result: 'CANONICAL_PERSISTED'
      }, customRoot);
    }

    // -----------------------------------------------------------------------
    // 4. Synchronize with Knowledge Relationship Graph (System B)
    // -----------------------------------------------------------------------
    try {
      if (typeof syncRecordToKnowledgeGraph === 'function') {
        syncRecordToKnowledgeGraph(record, customRoot);
      }
    } catch (graphSyncErr) {
      console.warn(`[WARN] Knowledge Graph synchronization non-fatal error: ${graphSyncErr.message}`);
    }

    return {
      persisted: true,
      record_id: record.record_id,
      domain_letter: record.domain_letter,
      total_records: registry.total_records
    };
  } finally {
    if (lockAcquired) {
      releaseRegistryLock(customRoot);
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Domain-Targeted Retrieval Helper
// ---------------------------------------------------------------------------

/**
 * Retrieves intelligence targeted specifically for a domain or set of domains.
 */
export function queryDomainIntelligence(domainIdentifier, query = '', options = {}) {
  const targetDomain = resolveDomain(domainIdentifier);
  const customRoot = typeof options === 'string' ? options : (options?.brainRoot || null);
  const registry = loadDomainRegistry(customRoot);

  const queryTerms = String(query).toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const results = [];

  for (const record of Object.values(registry.records)) {
    if (targetDomain && record.domain_letter !== targetDomain.letter) {
      // Check if it matches secondary domains
      const isSecondary = record.secondary_domains.some(s => s.letter === targetDomain.letter);
      if (!isSecondary) continue;
    }

    let matchScore = 0;
    const combinedText = `${record.title} ${record.summary} ${record.content}`.toLowerCase();

    for (const term of queryTerms) {
      if (combinedText.includes(term)) {
        matchScore += 2.0;
        if (record.title.toLowerCase().includes(term)) matchScore += 3.0;
      }
    }

    if (queryTerms.length === 0 || matchScore > 0) {
      results.push({
        record_id: record.record_id,
        domain_letter: record.domain_letter,
        domain_name: record.domain_name,
        title: record.title,
        summary: record.summary,
        content: record.content,
        provenance: record.provenance,
        confidence: record.confidence,
        score: matchScore
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return {
    domain: targetDomain ? targetDomain.name : 'ALL_DOMAINS',
    domain_letter: targetDomain ? targetDomain.letter : 'ALL',
    total_found: results.length,
    results: options.limit ? results.slice(0, options.limit) : results
  };
}

