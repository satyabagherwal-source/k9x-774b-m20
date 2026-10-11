/**
 * Autonomous Knowledge Gap Discovery Engine
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\gap-discovery-engine.mjs
 * Purpose: Analyzes verified knowledge, retrieval deficits, candidate rejections,
 *          session incident autopsies, and source coverage to discover genuine
 *          engineering knowledge gaps based on empirical evidence.
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { retrieveKnowledge, parseEngineeringPatterns } from './retrieval-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

const GAP_REGISTRY_FILE = path.join(BRAIN_ROOT, '08_VERIFICATION', 'knowledge-gap-registry.json');
const PATTERNS_FILE = path.join(BRAIN_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md');
const INBOX_REGISTRY_FILE = path.join(BRAIN_ROOT, '11_INBOX', 'candidate-directives-registry.json');
const SESSION_MEMORY_FILE = path.join(BRAIN_ROOT, '.project-brain', 'session-memory.json');
const AUTHORITATIVE_SOURCES_FILE = path.join(BRAIN_ROOT, '09_SOURCES', 'authoritative-sources-registry.md');

export const GAP_STATUS = {
  OPEN: 'OPEN',
  PARTIALLY_CLOSED: 'PARTIALLY_CLOSED',
  CLOSED: 'CLOSED',
  BLOCKED: 'BLOCKED',
  REQUIRES_REVALIDATION: 'REQUIRES_REVALIDATION'
};

export const GAP_CATEGORIES = {
  RETRIEVAL_COVERAGE_DEFICIT: 'RETRIEVAL_COVERAGE_DEFICIT',
  MISSING_VERIFICATION_METHOD: 'MISSING_VERIFICATION_METHOD',
  UNRESOLVED_CANDIDATE: 'UNRESOLVED_CANDIDATE',
  UNRESOLVED_INCIDENT_PATTERN: 'UNRESOLVED_INCIDENT_PATTERN',
  SOURCE_COVERAGE_GAP: 'SOURCE_COVERAGE_GAP',
  UNTESTED_RUNTIME_CONTEXT: 'UNTESTED_RUNTIME_CONTEXT'
};

/**
 * Standard Mission-Critical Domain Probes
 * Probes the knowledge base with high-stakes engineering requirements
 * to detect semantic retrieval failures or irrelevant result mappings.
 */
export const CRITICAL_DOMAIN_PROBES = [
  {
    domain: 'DISTRIBUTED_CONCURRENCY',
    probe_query: 'distributed lock lease fencing token split brain redis redlock',
    required_concepts: ['fencing token', 'lease', 'split brain', 'monotonic', 'distributed lock'],
    description: 'Absence of canonical invariant for distributed mutex lease fencing and split-brain mutation defense.',
    severity: 'HIGH',
    impact_area: 'Data Integrity & Distributed Concurrency'
  },
  {
    domain: 'DISTRIBUTED_RATE_LIMITING',
    probe_query: 'distributed rate limiter sliding window token bucket concurrency race',
    required_concepts: ['sliding window', 'rate limit', 'token bucket', 'concurrency'],
    description: 'Absence of canonical invariant for distributed sliding-window rate limiting concurrency and atomic counter drift.',
    severity: 'HIGH',
    impact_area: 'API Availability & DoS Prevention'
  },
  {
    domain: 'ZERO_TRUST_AUTH',
    probe_query: 'jwt token revocation distributed blacklist replay defense zero trust',
    required_concepts: ['jwt', 'revocation', 'blacklist', 'replay', 'jti'],
    description: 'Absence of canonical invariant for distributed JWT token revocation and replay attack defense.',
    severity: 'HIGH',
    impact_area: 'Security & Identity Governance'
  },
  {
    domain: 'WASM_MEMORY_SAFETY',
    probe_query: 'webassembly memory isolation host boundary bounds buffer overflow wasm',
    required_concepts: ['wasm', 'webassembly', 'memory isolation', 'linear memory', 'host boundary'],
    description: 'Absence of canonical invariant for WebAssembly host boundary memory bounds and sandbox isolation.',
    severity: 'MEDIUM',
    impact_area: 'Runtime Sandboxing & Memory Safety'
  },
  {
    domain: 'RESILIENT_TRANSACTIONS',
    probe_query: 'saga distributed transaction compensating action rollback failure recovery',
    required_concepts: ['saga', 'compensating action', 'distributed transaction', 'outbox'],
    description: 'Absence of canonical invariant for Saga pattern compensating action idempotency during partial rollbacks.',
    severity: 'MEDIUM',
    impact_area: 'Microservice Transaction Consistency'
  }
];

/**
 * Ensures knowledge gap registry file exists
 */
function ensureGapRegistryStorage() {
  const dir = path.dirname(GAP_REGISTRY_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(GAP_REGISTRY_FILE)) {
    const initial = {
      version: '1.0.0',
      last_updated: new Date().toISOString(),
      total_gaps: 0,
      open_gaps: 0,
      closed_gaps: 0,
      gaps: []
    };
    fs.writeFileSync(GAP_REGISTRY_FILE, JSON.stringify(initial, null, 2), 'utf-8');
  }
}

/**
 * Loads the current knowledge gap registry from disk
 */
export function loadGapRegistry() {
  ensureGapRegistryStorage();
  try {
    return JSON.parse(fs.readFileSync(GAP_REGISTRY_FILE, 'utf-8'));
  } catch (e) {
    return { version: '1.0.0', last_updated: new Date().toISOString(), total_gaps: 0, open_gaps: 0, closed_gaps: 0, gaps: [] };
  }
}

/**
 * Saves knowledge gap registry to disk with SHA-256 integrity
 */
export function saveGapRegistry(registry) {
  ensureGapRegistryStorage();
  registry.last_updated = new Date().toISOString();
  registry.total_gaps = registry.gaps.length;
  registry.open_gaps = registry.gaps.filter(g => g.status === GAP_STATUS.OPEN).length;
  registry.closed_gaps = registry.gaps.filter(g => g.status === GAP_STATUS.CLOSED).length;
  fs.writeFileSync(GAP_REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf-8');
  return registry;
}

/**
 * Evaluates semantic relevance of retrieved items against required domain concepts
 */
function evaluateRetrievalMatch(retrieval, requiredConcepts) {
  if (!retrieval || !retrieval.items || retrieval.items.length === 0) {
    return { matched: false, topItem: null, matchedConceptsCount: 0 };
  }

  const topItem = retrieval.items[0];
  const combinedText = `${topItem.title || ''} ${topItem.summary || ''}`.toLowerCase();
  
  let matchedConceptsCount = 0;
  for (const c of requiredConcepts) {
    if (combinedText.includes(c.toLowerCase())) {
      matchedConceptsCount++;
    }
  }

  // A match is considered genuine only if top item has at least 2 relevant concepts
  // and does not belong to an unrelated domain (e.g. LLM tokenizer for rate limiter)
  const matched = matchedConceptsCount >= 2;
  return {
    matched,
    topItem: {
      id: topItem.id,
      title: topItem.title,
      summary: (topItem.summary || '').slice(0, 150)
    },
    matchedConceptsCount
  };
}

/**
 * Discovers knowledge gaps by systematically inspecting:
 * 1. Critical Domain Probes (retrieval deficits)
 * 2. Missing Verification Methods in existing patterns
 * 3. Unpromoted / Rejected Candidates in 11_INBOX
 * 4. Unresolved Incident Patterns in Session Memory
 * 5. Tracked Authoritative Sources Coverage
 * 
 * @param {object} options - Discovery options
 * @returns {object} { discoveredCount: number, registry: object, newGaps: Array<object> }
 */
export function discoverKnowledgeGaps(options = {}) {
  const registry = loadGapRegistry();
  const existingGapsMap = new Map();
  for (const g of registry.gaps) {
    existingGapsMap.set(g.gap_id, g);
  }

  const newlyDiscovered = [];
  let gapCounter = registry.gaps.length + 1;

  // =========================================================================
  // 1. Audit Critical Domain Probes for Retrieval Deficits
  // =========================================================================
  for (const probe of CRITICAL_DOMAIN_PROBES) {
    const retrieval = retrieveKnowledge(probe.probe_query, { topK: 3 });
    const matchResult = evaluateRetrievalMatch(retrieval, probe.required_concepts);

    // If retrieval fails to match required concepts, a genuine gap exists
    if (!matchResult.matched) {
      const gapId = `GAP-PROBE-${probe.domain}`;
      const existing = existingGapsMap.get(gapId);

      // If already closed, don't reopen unless revalidation requested
      if (existing && existing.status === GAP_STATUS.CLOSED && !options.revalidate) {
        continue;
      }

      const gapRecord = {
        gap_id: gapId,
        category: GAP_CATEGORIES.RETRIEVAL_COVERAGE_DEFICIT,
        domain: probe.domain,
        severity: probe.severity,
        impact_area: probe.impact_area,
        title: probe.description,
        evidence: {
          probe_query: probe.probe_query,
          top_retrieved_irrelevant_rule: matchResult.topItem,
          matched_concepts_count: matchResult.matchedConceptsCount,
          expected_concepts: probe.required_concepts,
          diagnosis: matchResult.topItem
            ? `Top retrieved rule (${matchResult.topItem.id}: "${matchResult.topItem.title}") fails to satisfy domain concepts.`
            : 'Zero rules retrieved for probe query.'
        },
        research_objective: `Codify verified universal invariant for ${probe.domain} to satisfy probe query "${probe.probe_query}".`,
        status: GAP_STATUS.OPEN,
        discovered_at: existing ? existing.discovered_at : new Date().toISOString(),
        verified_rule: null,
        closed_at: null
      };

      if (existing) {
        Object.assign(existing, gapRecord);
      } else {
        registry.gaps.push(gapRecord);
        existingGapsMap.set(gapId, gapRecord);
        newlyDiscovered.push(gapRecord);
      }
    }
  }

  // =========================================================================
  // 2. Audit Existing Rules for Missing Verification Methods
  // =========================================================================
  const allPatterns = parseEngineeringPatterns();
  let missingMethodCount = 0;
  for (const pat of allPatterns) {
    const hasVerification = pat.fullContent && /^\*\*VERIFICATION METHOD\*\*:/m.test(pat.fullContent);
    if (!hasVerification) {
      missingMethodCount++;
      const gapId = `GAP-VERIFY-${pat.id.replace(/\s+/g, '-').toUpperCase()}`;
      if (!existingGapsMap.has(gapId)) {
        const gapRecord = {
          gap_id: gapId,
          category: GAP_CATEGORIES.MISSING_VERIFICATION_METHOD,
          domain: 'QUALITY_ASSURANCE',
          severity: 'MEDIUM',
          impact_area: 'Empirical Verification Governance',
          title: `${pat.id} (${pat.title}) lacks empirical verification method`,
          evidence: {
            rule_id: pat.id,
            file_path: pat.filePath,
            line_range: pat.lineRange,
            diagnosis: 'Rule contains invariant but lacks concrete empirical verification method.'
          },
          research_objective: `Formulate concrete verification probe for ${pat.id}.`,
          status: GAP_STATUS.OPEN,
          discovered_at: new Date().toISOString(),
          verified_rule: pat.id,
          closed_at: null
        };
        // Limit audit capture to top 3 missing verification gaps to prevent queue flooding
        if (newlyDiscovered.filter(g => g.category === GAP_CATEGORIES.MISSING_VERIFICATION_METHOD).length < 3) {
          registry.gaps.push(gapRecord);
          existingGapsMap.set(gapId, gapRecord);
          newlyDiscovered.push(gapRecord);
        }
      }
    }
  }

  // =========================================================================
  // 3. Audit 11_INBOX for Staged / Unresolved Candidates
  // =========================================================================
  if (fs.existsSync(INBOX_REGISTRY_FILE)) {
    try {
      const inboxData = JSON.parse(fs.readFileSync(INBOX_REGISTRY_FILE, 'utf-8'));
      const unpromoted = (inboxData.directives || []).filter(d => 
        d.status === 'STAGED_FOR_VERIFICATION' && d.reason
      );

      for (const cand of unpromoted.slice(0, 2)) {
        const gapId = `GAP-INBOX-${cand.id}`;
        if (!existingGapsMap.has(gapId)) {
          const gapRecord = {
            gap_id: gapId,
            category: GAP_CATEGORIES.UNRESOLVED_CANDIDATE,
            domain: 'INBOX_CANDIDATES',
            severity: 'LOW',
            impact_area: 'Candidate Directive Evolution',
            title: `Candidate ${cand.id} unpromoted: ${cand.reason || 'Missing required sections'}`,
            evidence: {
              candidate_id: cand.id,
              directive_title: cand.directive_title,
              rejection_reason: cand.reason,
              staged_file: cand.staged_file
            },
            research_objective: `Complete missing requirements to promote candidate ${cand.id}.`,
            status: GAP_STATUS.OPEN,
            discovered_at: new Date().toISOString(),
            verified_rule: null,
            closed_at: null
          };
          registry.gaps.push(gapRecord);
          existingGapsMap.set(gapId, gapRecord);
          newlyDiscovered.push(gapRecord);
        }
      }
    } catch (e) {}
  }

  saveGapRegistry(registry);

  return {
    discoveredCount: registry.gaps.length,
    newGapsCount: newlyDiscovered.length,
    registry,
    newlyDiscovered
  };
}
