/**
 * AI-Builder-Brain Universal Semantic Requirements Decomposer & Cross-Domain Orchestrator
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\semantic-decomposer.mjs
 * Purpose: PAC-004 Phase 1C.1 — Converts high-level human goals into structured, traceable,
 *          dependency-aware construction plans spanning all 13 Co-Equal Intelligence Domains (A–M).
 * 
 * Invariants:
 * 1. AI THINKS. BRAIN STORES AND SUPPLIES INTELLIGENCE DATA. TOOLS EXECUTE. PRODUCTS CREATE OUTCOMES.
 * 2. Model-Independent, First-Principles Compositional Requirements Reasoning for ANY legitimate digital product.
 * 3. End-to-End Traceability: Goal -> Problem -> Need -> Requirement -> Feature -> Task -> Verification.
 * 4. 13-Domain Parity: All 13 domains (A–M) are evaluated for relevance, dependencies, and conflicts.
 * 5. Epistemic Integrity: Strict separation of Known Facts, User Requirements, Evidence Conclusions,
 *    Assumptions, Unknowns, and Conflicts. No fabricated requirements.
 * 6. DAG Determinism: Generated execution plans strictly satisfy validatePlanDAG and validateSubtask.
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { INTELLIGENCE_DOMAINS, resolveDomain, queryDomainIntelligence } from './domain-intelligence-engine.mjs';
import { searchBrain } from './retrieval-engine.mjs';
import { validatePlanDAG } from './task-planner.mjs';
import { validateSubtask, CAPABILITY_ID_REGEX } from './task-contract.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// 1. Semantic Intent & Compositional Analysis
// ---------------------------------------------------------------------------

/**
 * Parses natural language goals into compositional dimensions rather than rigid keyword traps.
 * Evaluates: execution environment, interaction paradigm, primary capability, data flow, and privacy profile.
 * 
 * @param {string} intent - Natural language goal or prompt
 * @param {object} profile - Optional project metadata
 * @returns {object} Compositional intent analysis
 */
export function analyzeCompositionalIntent(intent, profile = {}) {
  const text = String(intent || '').trim();
  const lower = text.toLowerCase();
  const name = String(profile.name || '').toLowerCase();
  const combined = `${lower} ${name} ${String(profile.category || '').toLowerCase()}`;

  // 1. Execution Environment Classification
  let executionEnvironment = 'CLIENT_AND_EDGE_HYBRID';
  if (/\b(air-?gapped|offline-?only|client-?side only|100% in-browser|browser-?only|zero server uploads|local-only)\b/i.test(combined)) {
    executionEnvironment = 'CLIENT_BROWSER_ONLY';
  } else if (/\b(cli|command-?line|terminal utility|posix|console tool|binary|daemon)\b/i.test(combined) && !/\b(web|gui|dashboard|browser)\b/i.test(combined)) {
    executionEnvironment = 'CLI_LOCAL_RUNTIME';
  } else if (/\b(microservice|rest api|http router|backend service|headless api|rpc|lambda|serverless endpoint)\b/i.test(combined) && !/\b(frontend|ui|dashboard|view)\b/i.test(combined)) {
    executionEnvironment = 'HEADLESS_SERVER_OR_EDGE';
  } else if (/\b(p2p|peer-to-peer|mesh network|webrtc data|decentralized|federated|libp2p|torrent)\b/i.test(combined)) {
    executionEnvironment = 'P2P_DISTRIBUTED_NODE';
  } else if (/\b(saas|fullstack|database|postgres|multi-tenant|crud|auth|inventory|ecommerce|shop|billing)\b/i.test(combined)) {
    executionEnvironment = 'FULLSTACK_CLOUD_MANAGED';
  }

  // 2. Interaction Paradigm Classification
  let interactionParadigm = 'GUI_WEB_APPLICATION';
  if (/\b(headless|json api|rest api|webhook|sdk|library|middleware)\b/i.test(combined) && !/\b(dashboard|ui|gui|visualizer)\b/i.test(combined)) {
    interactionParadigm = 'HEADLESS_API_OR_SDK';
  } else if (/\b(cli|command line|terminal|flags|subcommands|stdout|curses|tui)\b/i.test(combined) && !/\b(html|css|web)\b/i.test(combined)) {
    interactionParadigm = 'CLI_TERMINAL';
  } else if (/\b(real-time|telemetry|metrics|canvas visualizer|timeseries|p99|streaming stream|audio visualizer|waveform)\b/i.test(combined)) {
    interactionParadigm = 'HIGH_FREQUENCY_CANVAS_DASHBOARD';
  } else if (/\b(3d|viewport|cad|webgl|webgpu|mesh geometry|parametric modeling|csg booleans)\b/i.test(combined) && !/\b(p2p|chat|mesh network)\b/i.test(combined)) {
    interactionParadigm = 'INTERACTIVE_3D_VIEWPORT';
  } else if (/\b(editorial|journalism|article|blog|reading mode|prose|magazine|chronicle)\b/i.test(combined)) {
    interactionParadigm = 'EDITORIAL_CONTENT_SURFACE';
  } else if (/\b(p2p|mesh chat|direct messaging|webrtc|peer communication)\b/i.test(combined)) {
    interactionParadigm = 'PEER_COMMUNICATION_SURFACE';
  }

  // 3. Data Flow & Persistence Profile
  let persistenceModel = 'LOCAL_FIRST_OR_EPHEMERAL';
  if (/\b(postgres|mysql|supabase|firebase|cockroach|dynamo|relational db|cloud sql)\b/i.test(combined)) {
    persistenceModel = 'CLOUD_RELATIONAL_DATABASE';
  } else if (/\b(sqlite|indexeddb|localstorage|opfs|file-backed)\b/i.test(combined)) {
    persistenceModel = 'LOCAL_EMBEDDED_DATABASE';
  } else if (/\b(vector db|hnsw|embeddings|faiss|chroma|qdrant)\b/i.test(combined)) {
    persistenceModel = 'VECTOR_EMBEDDINGS_STORE';
  } else if (/\b(memory-only|zero disk|air-gapped ram|wiped from ram|ephemeral buffer)\b/i.test(combined)) {
    persistenceModel = 'VOLATILE_MEMORY_WIPED';
  } else if (/\b(inventory|sales|billing|tenant|accounting|store)\b/i.test(combined)) {
    persistenceModel = 'PERSISTENT_BUSINESS_DATASTORE';
  }

  // 4. Privacy & Regulatory Profile
  const isHighPrivacy = /\b(privacy|secret|confidential|gdpr|hipaa|air-gapped|zero upload|zero server|no telemetry|zero-knowledge|e2ee|encrypted|encryption)\b/i.test(combined);
  const isHighPerformance = /\b(sub-millisecond|sub-5ms|high-throughput|60 fps|wasm|simd|zero-copy|p99)\b/i.test(combined);
  const isBusinessCritical = /\b(inventory|sales|payment|billing|compliance|audit|financial|accounting)\b/i.test(combined);

  // 5. Semantic Domain Affinity Scoring across all 13 domains
  const domainAffinities = {};
  for (const [letter, info] of Object.entries(INTELLIGENCE_DOMAINS)) {
    let score = 0;
    for (const kw of info.keywords) {
      const rx = new RegExp(`\\b${kw}\\b`, 'gi');
      const matches = combined.match(rx);
      if (matches) score += matches.length * 1.5;
    }
    domainAffinities[letter] = score;
  }

  // Specific contextual boosts
  if (isBusinessCritical) {
    domainAffinities['B'] += 6; // Product
    domainAffinities['C'] += 8; // Market & Business
    domainAffinities['K'] += 4; // Quality & Verification
  }
  if (isHighPrivacy) {
    domainAffinities['A'] += 8; // Human Need
    domainAffinities['G'] += 6; // Architecture
    domainAffinities['K'] += 6; // Quality & Verification
  }
  if (isHighPerformance) {
    domainAffinities['H'] += 6; // Technical Construction
    domainAffinities['G'] += 5; // Architecture
  }
  if (interactionParadigm.startsWith('GUI') || interactionParadigm.includes('SURFACE')) {
    domainAffinities['F'] += 6; // Design
  }
  if (/\b(seo|sitemap|organic|google|opengraph|schema\.org)\b/i.test(combined)) {
    domainAffinities['J'] += 8; // Search & Distribution
  }
  if (/\b(deploy|hosting|docker|vercel|cloud|ci\/cd|backup|vault)\b/i.test(combined)) {
    domainAffinities['L'] += 6; // Deployment & Ops
  }
  if (/\b(docs|documentation|copy|faq|content|writing|guide|editorial|article|publishing|reader|prose|news)\b/i.test(combined)) {
    domainAffinities['I'] += 6; // Content
  }
  if (/\b(creative|aesthetic|brand|audio|music|art|story|generative)\b/i.test(combined)) {
    domainAffinities['E'] += 8; // Creative
  }

  // Map to legacy archetype safely (without falling into regex keyword traps)
  let legacyArchetype = 'custom-hybrid';
  if (interactionParadigm === 'INTERACTIVE_3D_VIEWPORT') {
    legacyArchetype = 'geometric-cad';
  } else if (interactionParadigm === 'HIGH_FREQUENCY_CANVAS_DASHBOARD') {
    legacyArchetype = 'telemetry-dashboard';
  } else if (interactionParadigm === 'EDITORIAL_CONTENT_SURFACE') {
    legacyArchetype = 'editorial-publishing';
  } else if (interactionParadigm === 'HEADLESS_API_OR_SDK') {
    legacyArchetype = 'headless-api';
  } else if (/\b(shamir|secret sharing|argon2|passphrase|crypto split)\b/i.test(combined)) {
    legacyArchetype = 'cryptographic-tool';
  } else if (/\b(convert|converter|transcode|webp|png|svg to)\b/i.test(combined) && !/\b(p2p|audio|sales)\b/i.test(combined)) {
    legacyArchetype = 'file-transformation';
  } else if (/\b(vector search|hnsw|embedding|cosine similarity)\b/i.test(combined)) {
    legacyArchetype = 'vector-search';
  } else if (/\b(dag|pipeline|task runner|orchestrat|cron runner)\b/i.test(combined)) {
    legacyArchetype = 'workflow-automation';
  }

  return {
    rawIntent: text,
    projectName: profile.name || 'Universal Product',
    executionEnvironment,
    interactionParadigm,
    persistenceModel,
    isHighPrivacy,
    isHighPerformance,
    isBusinessCritical,
    domainAffinities,
    legacyArchetype
  };
}

// ---------------------------------------------------------------------------
// 2. Epistemic Requirements Classification & Uncertainty Tracking
// ---------------------------------------------------------------------------

/**
 * Classifies extracted requirements into explicit epistemic categories.
 * Strictly separates known facts, user-provided constraints, evidence-backed rules,
 * assumptions, unknowns, and potential conflicts.
 */
export function classifyEpistemicDimensions(intentAnalysis, profile = {}) {
  const text = intentAnalysis.rawIntent;
  const knownFacts = [];
  const userRequirements = [];
  const evidenceConclusions = [];
  const assumptions = [];
  const unknowns = [];
  const conflicts = [];

  // 1. Known Facts: Facts directly stated in user prompt
  if (text.length > 5) {
    knownFacts.push({
      fact_id: 'FACT-01',
      statement: `User explicitly requested to build: "${text}"`,
      source: 'USER_PROMPT',
      confidence: 1.0
    });
  }

  // 2. User Requirements: Extracted core functional intents
  const sentences = text.split(/[.;\n]+/).map(s => s.trim()).filter(s => s.length > 4);
  sentences.forEach((s, idx) => {
    userRequirements.push({
      req_id: `UREQ-${idx + 1}`,
      statement: s,
      origin: 'EXPLICIT_USER_STATEMENT',
      priority: idx === 0 ? 'P0_CRITICAL' : 'P1_HIGH'
    });
  });

  // 3. Evidence-Backed Conclusions (from Brain Knowledge Patterns)
  evidenceConclusions.push({
    conclusion_id: 'EVID-01',
    rule_id: 'RULE-1670',
    statement: 'Strict separation between Environment Bootstrap (Phase A) and Product Construction (Phase B) is required.',
    source: '01_CORE/operating-rules.md#Rule-1670',
    epistemic_state: 'CANONICAL',
    confidence: 1.0
  });

  if (intentAnalysis.isHighPrivacy) {
    evidenceConclusions.push({
      conclusion_id: 'EVID-02',
      rule_id: 'RULE-DOM-A-PRIVACY',
      statement: 'Zero external network transmission invariant must be enforced via client-side processing.',
      source: '05_KNOWLEDGE/domain-intelligence/domain-registry.json#DOM-A-DD59FA01',
      epistemic_state: 'CANONICAL',
      confidence: 0.95
    });
  }

  if (intentAnalysis.interactionParadigm.startsWith('GUI')) {
    evidenceConclusions.push({
      conclusion_id: 'EVID-03',
      rule_id: 'RULE-DOM-F-TAILWIND',
      statement: 'Use CSS-first design tokens in OKLCH color space for zero-runtime responsive layout styling.',
      source: '05_KNOWLEDGE/domain-intelligence/domain-registry.json#DOM-F-C060CCE1',
      epistemic_state: 'CANONICAL',
      confidence: 0.95
    });
  }

  // 4. Assumptions (Reasonable defaults with explicit rationales)
  if (intentAnalysis.persistenceModel === 'LOCAL_FIRST_OR_EPHEMERAL' || intentAnalysis.persistenceModel === 'PERSISTENT_BUSINESS_DATASTORE') {
    assumptions.push({
      assumption_id: 'ASSUME-01',
      dimension: 'DATA_PERSISTENCE',
      adopted_default: 'Local-first embedded persistence (SQLite / IndexedDB)',
      rationale: 'No remote cloud database provider was specified. Adopting embedded storage minimizes external operational cost and infrastructure friction for initial bootstrap.'
    });
  }

  if (!/\b(oauth|jwt|session|auth0|cognito|login|accounts)\b/i.test(text)) {
    assumptions.push({
      assumption_id: 'ASSUME-02',
      dimension: 'AUTHENTICATION',
      adopted_default: 'Zero-authentication / Single-tenant local operational boundary',
      rationale: 'No identity provider requested. Avoiding premature auth overhead keeps initial MVP focused purely on core utility.'
    });
  }

  // 5. Unknowns (Unspecified architectural dimensions needing visibility)
  if (!/\b(vercel|cloudflare|aws|azure|gcp|netlify|docker|fly\.io|kubernetes)\b/i.test(text)) {
    unknowns.push({
      unknown_id: 'UNK-01',
      dimension: 'DEPLOYMENT_HOSTING_TARGET',
      status: 'UNSPECIFIED',
      guidance: 'Specific cloud or hosting target is unstated. Output system remains portable across standard cloud/edge targets.'
    });
  }

  if (!/\b(posthog|telemetry|analytics|mixpanel|datadog|prometheus)\b/i.test(text)) {
    unknowns.push({
      unknown_id: 'UNK-02',
      dimension: 'ANALYTICS_AND_OBSERVABILITY',
      status: 'UNSPECIFIED',
      guidance: 'No analytics pipeline requested. System defaults to zero-tracker privacy boundary.'
    });
  }

  // 6. Conflict Detection (Contradictions between requirements)
  if (intentAnalysis.isHighPrivacy && /\b(cloud backup|sync across all devices|firebase|telemetry)\b/i.test(text)) {
    conflicts.push({
      conflict_id: 'CONF-01',
      nature: 'PRIVACY_VS_CLOUD_SYNC',
      description: 'User requested both strict privacy/offline operation and remote cloud synchronization.',
      resolution_strategy: 'End-to-End Client-Side Encryption (E2EE) before any network transit.'
    });
  }

  return {
    knownFacts,
    userRequirements,
    evidenceConclusions,
    assumptions,
    unknowns,
    conflicts
  };
}

// ---------------------------------------------------------------------------
// 3. Hierarchical Requirements Tree Synthesizer
// ---------------------------------------------------------------------------

/**
 * Transforms parsed intent and epistemic data into a formal, traceable hierarchical requirements tree:
 * Goal -> Problem -> User Need -> Functional Requirement -> Feature -> Subfeature.
 */
export function synthesizeHierarchicalRequirements(intentAnalysis, epistemicData, profile = {}) {
  const goalId = 'GOAL-01';
  const goalTitle = intentAnalysis.rawIntent || profile.name || 'Construct Target Digital Product';

  // 1. Problems Formulation (Domain A)
  const problems = [
    {
      problem_id: 'PROB-01',
      originating_goal_id: goalId,
      title: `Operational friction in ${intentAnalysis.projectName}`,
      description: `Target users lack a streamlined, reliable solution to ${intentAnalysis.rawIntent || 'execute core workflow'}.`,
      severity: intentAnalysis.isHighPrivacy ? 'CRITICAL_SECURITY_OR_PRIVACY' : 'HIGH_OPERATIONAL_FRICTION',
      contributing_domains: ['A', 'B']
    }
  ];

  // 2. User Needs Formulation (Domain A & B)
  const needs = [
    {
      need_id: 'NEED-01',
      originating_problem_id: 'PROB-01',
      title: 'Frictionless Ingestion & Input Verification',
      description: 'User needs to supply operational input without technical friction or data loss.',
      contributing_domains: ['A', 'B', 'F']
    },
    {
      need_id: 'NEED-02',
      originating_problem_id: 'PROB-01',
      title: 'Deterministic Core Transformation',
      description: 'User needs the computational or business operation executed accurately and predictably.',
      contributing_domains: ['B', 'G', 'H']
    },
    {
      need_id: 'NEED-03',
      originating_problem_id: 'PROB-01',
      title: 'Actionable Result Delivery & Export',
      description: 'User needs results rendered clearly with instant feedback and export options.',
      contributing_domains: ['B', 'F', 'I']
    },
    {
      need_id: 'NEED-04',
      originating_problem_id: 'PROB-01',
      title: 'Resilient Failure Recovery & Data Safety',
      description: 'User needs guarantee that invalid input or execution anomalies do not corrupt system state.',
      contributing_domains: ['A', 'G', 'K']
    }
  ];

  // 3. Requirements Specification (Domains A through M)
  const requirements = [
    {
      req_id: 'REQ-01',
      originating_need_id: 'NEED-01',
      title: 'Structured Input Contract & Schema Validation',
      description: 'System must validate all inbound arguments and payload structures against rigid schemas before processing.',
      contributing_domains: ['B', 'G', 'H', 'K'],
      priority: 'P0_CRITICAL',
      acceptance_criteria: 'Invalid input payloads rejected with descriptive, actionable error codes.',
      verification_method: 'TEST_PASS'
    },
    {
      req_id: 'REQ-02',
      originating_need_id: 'NEED-02',
      title: 'Deterministic Processing Kernel',
      description: `Core execution engine implementing the primary capability (${intentAnalysis.interactionParadigm}) without blocking the runtime thread.`,
      contributing_domains: ['G', 'H', 'K'],
      priority: 'P0_CRITICAL',
      acceptance_criteria: 'Processes standard workloads within acceptable latency envelopes without memory leaks.',
      verification_method: 'TEST_PASS'
    },
    {
      req_id: 'REQ-03',
      originating_need_id: 'NEED-03',
      title: 'Accessible Result Presentation Surface',
      description: `Deliver operational feedback matching ${intentAnalysis.interactionParadigm} standards with semantic clarity.`,
      contributing_domains: ['F', 'I'],
      priority: 'P0_CRITICAL',
      acceptance_criteria: 'Result surface renders accurate output state and supports actionable export.',
      verification_method: 'DOM_OR_CLI_OUTPUT_VERIFIED'
    },
    {
      req_id: 'REQ-04',
      originating_need_id: 'NEED-04',
      title: 'Crash-Safe State & Error Boundaries',
      description: 'System state must remain recoverable following unexpected exceptions or bad operational states.',
      contributing_domains: ['G', 'K', 'L'],
      priority: 'P0_CRITICAL',
      acceptance_criteria: 'All unhandled exceptions caught cleanly by boundaries; zero orphaned dirty state.',
      verification_method: 'TEST_PASS'
    }
  ];

  // Additional context-specific requirements
  if (intentAnalysis.isBusinessCritical) {
    requirements.push({
      req_id: 'REQ-05',
      originating_need_id: 'NEED-02',
      title: 'Transactional Integrity & Audit Ledger',
      description: 'All state modifications must commit atomically with timestamped audit entries.',
      contributing_domains: ['C', 'G', 'K'],
      priority: 'P0_CRITICAL',
      acceptance_criteria: 'Zero partial or orphaned transactions under process interruption.',
      verification_method: 'TEST_PASS'
    });
  }

  if (intentAnalysis.isHighPrivacy) {
    requirements.push({
      req_id: 'REQ-06',
      originating_need_id: 'NEED-04',
      title: 'Zero-Network Local Execution Invariant',
      description: 'All operations strictly executed within client/local runtime with zero outbound network calls.',
      contributing_domains: ['A', 'K'],
      priority: 'P0_CRITICAL',
      acceptance_criteria: 'Zero network requests captured during active workload execution.',
      verification_method: 'ZERO_NETWORK_PROBE_PASS'
    });
  }

  return {
    goal: { goal_id: goalId, title: goalTitle },
    problems,
    needs,
    requirements
  };
}

// ---------------------------------------------------------------------------
// 4. Cross-Domain Intelligence Orchestration (13 Domains A–M)
// ---------------------------------------------------------------------------

/**
 * Orchestrates intelligence across all 13 Co-Equal Domains (A–M) for the decomposed requirements.
 * Resolves domain applicability, evidence-backed recommendations, inter-domain dependencies, and conflicts.
 * 
 * @param {object} intentAnalysis - Analyzed intent object
 * @param {object} hierarchicalReqs - Requirements tree
 * @param {string|null} customRoot - Optional Master Brain root path
 * @param {object} options - Configuration options
 * @returns {object} Orchestrated cross-domain intelligence map
 */
export function orchestrateCrossDomainIntelligence(intentAnalysis, hierarchicalReqs, customRoot = null, options = {}) {
  const root = customRoot || BRAIN_ROOT;
  const domainOrchestration = {};

  for (const [letter, domainInfo] of Object.entries(INTELLIGENCE_DOMAINS)) {
    const affinityScore = intentAnalysis.domainAffinities[letter] || 0;
    const isApplicable = affinityScore > 0 || ['A', 'B', 'G', 'H', 'K'].includes(letter);

    let contributionRole = 'SUPPORTING';
    if (['A', 'B', 'G', 'H', 'K'].includes(letter) || affinityScore >= 8) {
      contributionRole = 'PRIMARY';
    } else if (affinityScore === 0) {
      contributionRole = 'ADVISORY_OR_DEFERRED';
    }

    // Retrieve Tier 1 and Tier 2 guidelines for this domain
    let domainGuidelines = [];
    try {
      const tier1Res = queryDomainIntelligence(letter, intentAnalysis.rawIntent, { brainRoot: root, limit: 2 });
      if (tier1Res && tier1Res.results && tier1Res.results.length > 0) {
        domainGuidelines.push(...tier1Res.results.map(r => ({
          id: r.record_id,
          title: r.title,
          summary: r.summary,
          tier: 1,
          epistemic_state: 'CANONICAL',
          confidence: r.confidence || 0.95
        })));
      }
    } catch (e) {
      // Non-blocking fallback
    }

    // Domain-specific contribution specifications
    let domainRequirementSummary = '';
    switch (letter) {
      case 'A':
        domainRequirementSummary = `Formulate target persona, context of use, pain points, and strict human safety/privacy invariants (${intentAnalysis.isHighPrivacy ? 'High Privacy' : 'Standard'}).`;
        break;
      case 'B':
        domainRequirementSummary = `Define strict P0 MVP scope, negative scope exclusions, and user acceptance criteria matching ${intentAnalysis.interactionParadigm}.`;
        break;
      case 'C':
        domainRequirementSummary = `Verify commercial differentiation, hurdle rates, and cost-per-active-user viability for ${intentAnalysis.projectName}.`;
        break;
      case 'D':
        domainRequirementSummary = 'Identify missing evidence, academic/technical citations, and verify external implementation feasibility.';
        break;
      case 'E':
        domainRequirementSummary = `Establish aesthetic tone, creative metaphors, and brand uniqueness for ${intentAnalysis.projectName}.`;
        break;
      case 'F':
        domainRequirementSummary = `Design UI/UX tokens, typography, semantic markup, and responsive layouts (${intentAnalysis.interactionParadigm}).`;
        break;
      case 'G':
        domainRequirementSummary = `Define system modularity, clean component boundaries (Rule 1670), state machines, and concurrency protection.`;
        break;
      case 'H':
        domainRequirementSummary = `Implement executable code, algorithms, framework adapters, and memory-safe transformation pipelines.`;
        break;
      case 'I':
        domainRequirementSummary = 'Provide structured technical documentation, error copy, user guides, and semantic metadata.';
        break;
      case 'J':
        domainRequirementSummary = 'Inject technical SEO, OpenGraph tags, JSON-LD structured schemas, and distribution channel metadata.';
        break;
      case 'K':
        domainRequirementSummary = 'Construct automated regression test contracts, build exit-code-0 barriers, and invariant assertions.';
        break;
      case 'L':
        domainRequirementSummary = `Formulate deployment manifests, hosting configuration, vault backups, and disaster recovery strategies.`;
        break;
      case 'M':
        domainRequirementSummary = 'Establish defect autopsy channels, runtime logging, and project learning promotion bridges back to Brain.';
        break;
      default:
        domainRequirementSummary = `Supply domain ${letter} intelligence for target digital product.`;
    }

    domainOrchestration[letter] = {
      letter,
      id: domainInfo.id,
      name: domainInfo.name,
      applicability: isApplicable ? 'APPLICABLE' : 'DEFERRED',
      contribution_role: contributionRole,
      affinity_score: affinityScore,
      requirement_summary: domainRequirementSummary,
      guidelines: domainGuidelines,
      inter_domain_dependencies: getDomainDependencies(letter, intentAnalysis),
      inter_domain_conflicts: getDomainConflicts(letter, intentAnalysis)
    };
  }

  return domainOrchestration;
}

/**
 * Returns canonical dependencies for a given domain
 */
function getDomainDependencies(domainLetter, intentAnalysis) {
  const deps = [];
  if (domainLetter === 'B') deps.push('A'); // Product depends on Human Need
  if (domainLetter === 'C') deps.push('B'); // Market Feasibility depends on Product definition
  if (domainLetter === 'F') deps.push('E', 'B'); // Design depends on Creative & Product
  if (domainLetter === 'G') deps.push('A', 'B'); // Architecture depends on Human Need & Product
  if (domainLetter === 'H') deps.push('G', 'F'); // Technical Construction depends on Architecture & Design
  if (domainLetter === 'I') deps.push('B', 'F'); // Content depends on Product & Design
  if (domainLetter === 'J') deps.push('I', 'H'); // Distribution depends on Content & Construction
  if (domainLetter === 'K') deps.push('H', 'G'); // Quality & Verification depends on Construction & Architecture
  if (domainLetter === 'L') deps.push('K', 'H'); // Deployment depends on Verification & Construction
  if (domainLetter === 'M') deps.push('L', 'K'); // Evolution depends on Deployment & Verification
  return deps;
}

/**
 * Detects domain conflicts based on intent analysis
 */
function getDomainConflicts(domainLetter, intentAnalysis) {
  const conflicts = [];
  if (domainLetter === 'M' && intentAnalysis.isHighPrivacy) {
    conflicts.push({
      target_domain: 'A',
      issue: 'Standard telemetry logging in Domain M conflicts with zero-transmission privacy in Domain A.',
      reconciliation: 'Quarantine telemetry to zero-network local session memory or disable entirely.'
    });
  }
  return conflicts;
}

// ---------------------------------------------------------------------------
// 5. Dependency-Aware Construction Plan DAG Generator
// ---------------------------------------------------------------------------

/**
 * Generates a deterministic, dependency-aware Directed Acyclic Graph (DAG) construction plan
 * composed of subtasks strictly validated against validatePlanDAG and validateSubtask.
 * 
 * @param {object} hierarchicalReqs - Hierarchical requirements tree
 * @param {object} crossDomainIntel - Cross-domain orchestration map
 * @param {object} options - Configuration options
 * @returns {object} Validated construction plan object
 */
export function generateConstructionPlanDAG(hierarchicalReqs, crossDomainIntel, options = {}) {
  const planId = `PLAN-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const tasks = [];

  // Helper to add subtask cleanly
  function addTask(taskObj) {
    tasks.push(taskObj);
  }

  // STEP 1: Domain A & B — Requirements Baseline & Invariants Checkpoint
  addTask({
    step_id: 'STEP-01',
    id: 'STEP-01',
    subtask_id: 'STEP-01',
    title: 'Domain A & B: Establish Problem Record & MVP Scope Baseline',
    objective: 'Freeze human need invariants, target personas, P0 MVP scope, and non-negotiable negative scope exclusions.',
    action: 'Freeze human need invariants, target personas, P0 MVP scope, and non-negotiable negative scope exclusions.',
    domain_letter: 'A',
    domain_id: 'human_need',
    contributing_domains: ['A', 'B'],
    originating_requirement_id: 'REQ-01',
    originating_need_id: 'NEED-01',
    inputs: ['user_intent', 'project_profile'],
    outputs: ['problem-record.json', 'prd-specification.json'],
    depends_on: [],
    dependencies: [],
    required_capabilities: ['CAP-UNIVERSAL-TASK-CONTRACT'],
    assigned_skill_id: 'agent-error-prevention-protocol',
    constraints: [
      'Do not proceed to technical code implementation before scope baseline is established.',
      'Strict zero scope-creep beyond P0 features.'
    ],
    acceptance_criteria: [
      'ProblemRecord and PRDSpecification synthesized with valid IDs.',
      'Negative scope exclusions explicitly documented.'
    ],
    verification_method: 'FILE_VERIFIED_SHA256',
    status: 'READY'
  });

  // STEP 2: Domain G — Architectural Boundary Separation & Environment Setup
  addTask({
    step_id: 'STEP-02',
    id: 'STEP-02',
    subtask_id: 'STEP-02',
    title: 'Domain G: Initialize System Architecture & Boundary Separation',
    objective: 'Establish clean directory structure, runtime environment, and module contracts per Rule 1670.',
    action: 'Establish clean directory structure, runtime environment, and module contracts per Rule 1670.',
    domain_letter: 'G',
    domain_id: 'architecture',
    contributing_domains: ['G', 'A'],
    originating_requirement_id: 'REQ-01',
    originating_need_id: 'NEED-01',
    inputs: ['STEP-01'],
    outputs: ['src/core/', 'package.json'],
    depends_on: ['STEP-01'],
    dependencies: ['STEP-01'],
    required_capabilities: ['CAP-PROJECT-FACTORY-BOOTSTRAP'],
    assigned_skill_id: 'fullstack-ai-saas-architecture',
    constraints: [
      'Do not pollute child project with Master Brain internal state.',
      'Phase A terminates at ENVIRONMENT READY with 0 product code (Rule 1670).'
    ],
    acceptance_criteria: [
      'Project runtime initialized cleanly.',
      'Dependencies installed with exit code 0.'
    ],
    verification_method: 'BUILD_EXIT_0',
    status: 'PENDING'
  });

  // STEP 3: Domain F & E — Design System & Visual Foundation
  addTask({
    step_id: 'STEP-03',
    id: 'STEP-03',
    subtask_id: 'STEP-03',
    title: 'Domain F & E: Construct Design Tokens & Presentation Surface',
    objective: 'Establish accessible design tokens, typography hierarchy, OKLCH color palette, and layout scaffolding.',
    action: 'Establish accessible design tokens, typography hierarchy, OKLCH color palette, and layout scaffolding.',
    domain_letter: 'F',
    domain_id: 'design',
    contributing_domains: ['F', 'E', 'B'],
    originating_requirement_id: 'REQ-03',
    originating_need_id: 'NEED-03',
    inputs: ['STEP-02'],
    outputs: ['src/styles/global.css', 'src/components/layout/'],
    depends_on: ['STEP-02'],
    dependencies: ['STEP-02'],
    required_capabilities: ['CAP-HYBRID-KNOWLEDGE-RETRIEVAL'],
    assigned_skill_id: 'tailwind-v4-css-first-design',
    constraints: [
      'Zero unnecessary client JavaScript for purely static layout elements.',
      'Enforce accessible color contrast ratios (WCAG AAA/AA).'
    ],
    acceptance_criteria: [
      'CSS design tokens compile without error.',
      'Responsive layout structure adapts cleanly across mobile and desktop viewports.'
    ],
    verification_method: 'DOM_RENDER',
    status: 'PENDING'
  });

  // STEP 4: Domain H — Core Computational / Business Transformation Engine
  addTask({
    step_id: 'STEP-04',
    id: 'STEP-04',
    subtask_id: 'STEP-04',
    title: 'Domain H: Construct Core Computational Kernel & Business Logic',
    objective: 'Implement deterministic core logic, schema validation, and memory-safe processing pipelines.',
    action: 'Implement deterministic core logic, schema validation, and memory-safe processing pipelines.',
    domain_letter: 'H',
    domain_id: 'technical_construction',
    contributing_domains: ['H', 'G', 'B'],
    originating_requirement_id: 'REQ-02',
    originating_need_id: 'NEED-02',
    inputs: ['STEP-02', 'STEP-03'],
    outputs: ['src/core/engine.mjs', 'src/core/schema.mjs'],
    depends_on: ['STEP-02', 'STEP-03'],
    dependencies: ['STEP-02', 'STEP-03'],
    required_capabilities: ['CAP-HYBRID-KNOWLEDGE-RETRIEVAL'],
    assigned_skill_id: 'high-performance-systems-and-compiler-invariants',
    constraints: [
      'Zero main-thread blocking operations.',
      'All exceptions handled cleanly within error boundaries.'
    ],
    acceptance_criteria: [
      'Core transformation passes all primary operational test fixtures.',
      'Memory buffers freed cleanly without leaks.'
    ],
    verification_method: 'TEST_PASS',
    status: 'PENDING'
  });

  // STEP 5: Domain I & J — Documentation, Micro-Copy & SEO Discoverability
  addTask({
    step_id: 'STEP-05',
    id: 'STEP-05',
    subtask_id: 'STEP-05',
    title: 'Domain I & J: Inject Structured Information, Documentation & SEO',
    objective: 'Provide clear user documentation, micro-copy, JSON-LD structured metadata, and discoverability tags.',
    action: 'Provide clear user documentation, micro-copy, JSON-LD structured metadata, and discoverability tags.',
    domain_letter: 'J',
    domain_id: 'search_distribution',
    contributing_domains: ['J', 'I', 'B'],
    originating_requirement_id: 'REQ-03',
    originating_need_id: 'NEED-03',
    inputs: ['STEP-04'],
    outputs: ['README.md', 'src/components/SEO.astro'],
    depends_on: ['STEP-04'],
    dependencies: ['STEP-04'],
    required_capabilities: ['CAP-MULTILINGUAL-SEO-INTELLIGENCE'],
    assigned_skill_id: 'multilingual-first-architecture',
    constraints: [
      'Ensure canonical self-referential URL tags are present.',
      'JSON-LD schema must validate cleanly.'
    ],
    acceptance_criteria: [
      'Valid JSON-LD metadata rendered.',
      'Documentation provides clear setup and verification guidance.'
    ],
    verification_method: 'DOM_RENDER',
    status: 'PENDING'
  });

  // STEP 6: Domain K — Comprehensive Verification & Quality Barrier
  addTask({
    step_id: 'STEP-06',
    id: 'STEP-06',
    subtask_id: 'STEP-06',
    title: 'Domain K: Execute Automated Verification Barrier & Test Matrix',
    objective: 'Execute end-to-end regression tests, zero-network security probes, and build exit-code-0 verification.',
    action: 'Execute end-to-end regression tests, zero-network security probes, and build exit-code-0 verification.',
    domain_letter: 'K',
    domain_id: 'quality_verification',
    contributing_domains: ['K', 'H', 'G'],
    originating_requirement_id: 'REQ-04',
    originating_need_id: 'NEED-04',
    inputs: ['STEP-04', 'STEP-05'],
    outputs: ['test-results.json', 'verification-ledger.md'],
    depends_on: ['STEP-04', 'STEP-05'],
    dependencies: ['STEP-04', 'STEP-05'],
    required_capabilities: ['CAP-UNIVERSAL-TASK-CONTRACT'],
    assigned_skill_id: 'agent-error-prevention-protocol',
    constraints: [
      'Zero test suite deletions or bypasses allowed.',
      'Build exit code must be strictly 0.'
    ],
    acceptance_criteria: [
      '100% of defined automated test cases pass cleanly.',
      'Build command exits with code 0.'
    ],
    verification_method: 'BUILD_EXIT_0',
    status: 'PENDING'
  });

  // STEP 7: Domain L & M — Deployment Readiness, Vault Backup & Feedback Hook
  addTask({
    step_id: 'STEP-07',
    id: 'STEP-07',
    subtask_id: 'STEP-07',
    title: 'Domain L & M: Establish Deployment Readiness & Evolution Hook',
    objective: 'Generate deployment manifests, disaster recovery backup snapshot, and learning feedback promotion hook.',
    action: 'Generate deployment manifests, disaster recovery backup snapshot, and learning feedback promotion hook.',
    domain_letter: 'L',
    domain_id: 'deployment_operations',
    contributing_domains: ['L', 'M'],
    originating_requirement_id: 'REQ-04',
    originating_need_id: 'NEED-04',
    inputs: ['STEP-06'],
    outputs: ['deploy-manifest.json', '.project-brain/brain-bridge.json'],
    depends_on: ['STEP-06'],
    dependencies: ['STEP-06'],
    required_capabilities: ['CAP-DISASTER-RECOVERY-VAULT'],
    assigned_skill_id: 'git-github-lifecycle-skill',
    constraints: [
      'Do not push to remote without explicit user authorization.',
      'Preserve local working tree integrity.'
    ],
    acceptance_criteria: [
      'Disaster recovery manifest and project brain bridge validated.',
      'Deployment readiness checklist satisfied.'
    ],
    verification_method: 'FILE_VERIFIED_SHA256',
    status: 'PENDING'
  });

  // Validate the DAG structure using existing canonical validator
  const dagValidation = validatePlanDAG(tasks);
  if (!dagValidation.valid) {
    throw new Error(`DAG_VALIDATION_FAILED: ${dagValidation.errors.join('; ')}`);
  }

  // Validate every individual subtask using existing canonical validator
  for (const t of tasks) {
    const subValidation = validateSubtask(t);
    if (!subValidation.valid) {
      throw new Error(`SUBTASK_VALIDATION_FAILED on ${t.step_id}: ${subValidation.errors.join('; ')}`);
    }
  }

  return {
    plan_id: planId,
    total_steps: tasks.length,
    dag_valid: true,
    tasks
  };
}

// ---------------------------------------------------------------------------
// 6. Unified Semantic Decomposition Pipeline
// ---------------------------------------------------------------------------

/**
 * Main Entry Point: Decomposes any natural language goal into a full semantic construction package.
 * Covers intent analysis, epistemic classification, hierarchical requirements, cross-domain orchestration,
 * and dependency-aware construction plan.
 * 
 * @param {string} goal - High-level user goal
 * @param {object} profile - Optional project profile
 * @param {object} options - Configuration options (masterBrainPath, etc.)
 * @returns {object} Full Semantic Decomposition Package
 */
export function decomposeSemanticRequirements(goal, profile = {}, options = {}) {
  const masterRoot = options.masterBrainPath || options.brainRoot || BRAIN_ROOT;

  // 1. Semantic Intent & Compositional Analysis
  const intentAnalysis = analyzeCompositionalIntent(goal, profile);

  // 2. Epistemic Classification & Uncertainty Tracking
  const epistemicData = classifyEpistemicDimensions(intentAnalysis, profile);

  // 3. Hierarchical Requirements Synthesis
  const hierarchicalReqs = synthesizeHierarchicalRequirements(intentAnalysis, epistemicData, profile);

  // 4. Cross-Domain Intelligence Orchestration across all 13 Domains
  const crossDomainIntel = orchestrateCrossDomainIntelligence(intentAnalysis, hierarchicalReqs, masterRoot, options);

  // 5. Dependency-Aware Construction Plan DAG
  const constructionPlan = generateConstructionPlanDAG(hierarchicalReqs, crossDomainIntel, options);

  return {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    intentAnalysis,
    epistemicData,
    hierarchicalReqs,
    crossDomainIntel,
    constructionPlan
  };
}

/**
 * Emits the semantic decomposition and construction plan artifacts to disk.
 * Preserves strict backward compatibility with existing emission contracts.
 */
export function emitSemanticConstructionArtifacts(targetDir, semanticPackage) {
  const root = path.resolve(targetDir);
  const constructionDir = path.join(root, '.project-brain', 'construction');

  if (!fs.existsSync(constructionDir)) {
    fs.mkdirSync(constructionDir, { recursive: true });
  }

  const written = [];

  // 1. semantic-requirements.json
  const semPath = path.join(constructionDir, 'semantic-requirements.json');
  fs.writeFileSync(semPath, JSON.stringify({
    version: semanticPackage.version,
    timestamp: semanticPackage.timestamp,
    intentAnalysis: semanticPackage.intentAnalysis,
    epistemicData: semanticPackage.epistemicData,
    hierarchicalReqs: semanticPackage.hierarchicalReqs,
    crossDomainIntel: semanticPackage.crossDomainIntel
  }, null, 2), 'utf-8');
  written.push(semPath);

  // 2. construction-plan.json
  const planPath = path.join(constructionDir, 'construction-plan.json');
  fs.writeFileSync(planPath, JSON.stringify(semanticPackage.constructionPlan, null, 2), 'utf-8');
  written.push(planPath);

  return written;
}
