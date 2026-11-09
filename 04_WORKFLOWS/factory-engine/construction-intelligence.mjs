/**
 * AI-Builder-Brain Universal Construction Intelligence Engine (CIE)
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\construction-intelligence.mjs
 * Purpose: Bridges the real construction gap between:
 *          - Domain A: Human & Need Intelligence (ProblemRecord)
 *          - Domain B: Product Intelligence (PRDSpecification & Negative Scope)
 *          - Domain C: Market & Business Intelligence (BusinessFeasibility)
 *          and downstream technical construction (Domains F, G, H, J, K, L).
 * 
 * Operational Invariant:
 * 1. AI THINKS. BRAIN STORES AND SUPPLIES INTELLIGENCE DATA. TOOLS EXECUTE. PRODUCTS CREATE OUTCOMES.
 * 2. Model-Independent, First-Principles Compositional Requirements Reasoning for ANY legitimate digital product.
 * 3. Two-Tier Evidence-Grounded Knowledge Recall:
 *    - Tier 1: Canonical Domain Intelligence Records (domain-registry.json) -> CANONICAL (Confidence 0.90 - 1.00)
 *    - Tier 2: Validated Engineering Patterns (engineering-patterns.md) -> VALIDATED (Confidence 0.80)
 *              Harvested Intelligence Dossiers (07_PROJECT_LEARNING/) -> EXTRACTED (Confidence 0.65)
 * 4. Zero Auto-Promotion Invariant: Retrieved content is NEVER promoted to canonical knowledge without human approval.
 * 5. Strict Deduplication, Token Budgeting, and Explicit Tracking of UNSPECIFIED requirements.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { queryDomainIntelligence } from './domain-intelligence-engine.mjs';
import { searchBrain } from './retrieval-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Normalizes text to a clean slug identifier
 */
export function slugify(text) {
  return String(text || 'product')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 32);
}

/**
 * Classifies product intent into a first-principles archetype or custom hybrid.
 */
export function classifyProductArchetype(intent, profile = {}) {
  const combined = `${intent || ''} ${profile.name || ''} ${profile.category || ''} ${profile.blueprint || ''}`.toLowerCase();

  if (/shamir|secret sharing|k-of-n|sharding|cryptograph|key split|passphrase harden|argon2/i.test(combined)) {
    return 'cryptographic-tool';
  }
  if (/convert|converter|svg|webp|png|transcode|transform|image-converter|drag and drop/i.test(combined)) {
    return 'file-transformation';
  }
  if (/(?:vector\s*(?:search|index|db|database|engine|store|embedding|math|distance)|embedding|hnsw|cosine\s*similarity|nearest\s*neighbor|semantic\s*search|edgevector)/i.test(combined)) {
    return 'vector-search';
  }
  if (/cad|3d|geometry|csg|mesh|stl|obj|solid modeling|parametric|viewport|neurocraft/i.test(combined)) {
    return 'geometric-cad';
  }
  if (/workflow|dag|runner|pipeline|orchestrat|taskflow|task-runner|cron job/i.test(combined)) {
    return 'workflow-automation';
  }
  if (/headless|rest api|http router|api endpoint|rfc 7807|microservice|vaultkeeper api/i.test(combined)) {
    return 'headless-api';
  }
  if (/dashboard|telemetry|metrics|real-time|pulse|p99|timeseries|observability|websocket stream/i.test(combined)) {
    return 'telemetry-dashboard';
  }
  if (/chronicle|editorial|publishing|article|blog|reader|magazine|journalism|content site|seo portal|adsense/i.test(combined) && !/convert|svg|webp/i.test(combined)) {
    return 'editorial-publishing';
  }

  return 'custom-hybrid';
}

/**
 * Reads targeted body chunks from a harvested intelligence dossier on disk.
 * Extracts Section 2 (Architectural Mechanisms) and Section 3 (Failure Modes / Anti-Patterns).
 */
export function readDossierTargetedChunks(relPath, queryKeywords = [], customRoot = null, maxChars = 800) {
  const root = customRoot || BRAIN_ROOT;
  const fullPath = path.isAbsolute(relPath) ? relPath : path.join(root, relPath);

  if (!fs.existsSync(fullPath)) {
    return {
      chunks: [],
      totalChars: 0,
      lineRange: [1, 1],
      found: false
    };
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split(/\r?\n/);

  const keywords = (Array.isArray(queryKeywords) ? queryKeywords : [String(queryKeywords)])
    .flatMap(k => String(k).toLowerCase().split(/[\s,._-]+/))
    .filter(k => k.length > 2);

  // Identify matching lines
  const matchingIndices = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toLowerCase();
    if (keywords.some(kw => l.includes(kw))) {
      matchingIndices.push(i);
    }
  }

  let startLine = 0;
  let endLine = 0;
  let chunkText = '';

  if (matchingIndices.length > 0) {
    // Pick the best match index (preferably in Section 2 or 3)
    let bestIdx = matchingIndices[0];
    for (const idx of matchingIndices) {
      if (idx > 15) {
        bestIdx = idx;
        break;
      }
    }
    startLine = Math.max(0, bestIdx - 1);
    endLine = startLine;
    for (let i = startLine; i < lines.length; i++) {
      if (chunkText.length + lines[i].length + 1 > maxChars && chunkText.length > 100) {
        break;
      }
      chunkText += (chunkText ? '\n' : '') + lines[i];
      endLine = i;
    }
  } else {
    // Fallback: extract from lines 10-35 (Context & Overview)
    startLine = Math.min(10, lines.length - 1);
    endLine = startLine;
    for (let i = startLine; i < lines.length; i++) {
      if (chunkText.length + lines[i].length + 1 > maxChars && chunkText.length > 100) {
        break;
      }
      chunkText += (chunkText ? '\n' : '') + lines[i];
      endLine = i;
    }
  }

  return {
    chunks: [chunkText],
    totalChars: chunkText.length,
    lineRange: [startLine + 1, endLine + 1],
    found: true
  };
}

/**
 * Detects unspecified aspects in user intent and profile.
 */
export function detectUnspecifiedRequirements(intent, profile = {}) {
  const combined = `${intent || ''} ${profile.name || ''} ${profile.blueprint || ''}`.toLowerCase();
  const unspecified = [];

  if (!/postgres|mysql|sqlite|indexeddb|mongo|redis|database|storage engine|dynamo/i.test(combined)) {
    unspecified.push({
      category: 'DATABASE_AND_PERSISTENCE',
      status: 'UNSPECIFIED',
      guidance: 'No persistent database engine specified in user intent. Defaulting to local memory/ephemeral storage unless explicitly requested.'
    });
  }

  if (!/oauth|jwt|session|auth0|login|cognito|credentials|authentication|rbac/i.test(combined)) {
    unspecified.push({
      category: 'AUTHENTICATION_AND_IDENTITY',
      status: 'UNSPECIFIED',
      guidance: 'No authentication provider or identity model specified in user intent. Preserving zero-auth friction for MVP scope.'
    });
  }

  if (!/vercel|cloudflare|aws|azure|gcp|netlify|docker|k8s|kubernetes|fly\.io|serverless|deployment/i.test(combined)) {
    unspecified.push({
      category: 'DEPLOYMENT_HOSTING_TARGET',
      status: 'UNSPECIFIED',
      guidance: 'Deployment hosting infrastructure not explicitly bound. Project remains portable across standard web/cloud targets.'
    });
  }

  if (!/analytics|telemetry|posthog|mixpanel|ga4|google analytics|datadog|prometheus/i.test(combined)) {
    unspecified.push({
      category: 'ANALYTICS_AND_TRACKING',
      status: 'UNSPECIFIED',
      guidance: 'No telemetry or analytics pipeline requested. Preserving zero-tracker privacy boundary.'
    });
  }

  return unspecified;
}

/**
 * Domain A: Human & Need Intelligence Synthesizer
 * Formulates a structured ProblemRecord from raw intent using first-principles decomposition.
 */
export function synthesizeProblemRecord(intent, profile = {}, options = {}) {
  const cleanIntent = String(intent || '').trim();
  const archetype = classifyProductArchetype(cleanIntent, profile);
  const slug = slugify(profile.name || cleanIntent || archetype);
  const now = new Date().toISOString();

  // Sensitivity checks
  const isPrivacySensitive = /privacy|sensitive|secret|confidential|client|local-only|offline|browser-only/i.test(cleanIntent);
  const isPerformanceSensitive = /fast|performance|high-speed|latency|instant|sub-millisecond|wasm|zero-copy|p99/i.test(cleanIntent);

  const problemStatement = cleanIntent.length > 10 
    ? cleanIntent 
    : `Users need a reliable, high-performance, and accessible ${profile.name || archetype} that solves core domain workflows without unnecessary friction.`;

  let primaryPersona = 'Modern digital professional / developer / end-user';
  let contextOfUse = 'Fast-paced daily workflow requiring instant, friction-free outcomes';
  let severity = isPrivacySensitive ? 'CRITICAL_SECURITY_RISK' : 'HIGH_OPERATIONAL_FRICTION';
  let rootCause = 'Legacy monolithic tools monetize user data or rely on costly server compute, forcing an architectural mismatch between user privacy/speed needs and vendor profit models.';
  const painPoints = [];
  const constraints = [
    'Zero unnecessary dependencies: Keep bundle lean and runtime responsive.',
    'Accessibility: Semantic HTML5 / standard compliant I/O with clear operational feedback.'
  ];

  if (archetype === 'editorial-publishing') {
    primaryPersona = 'Digital publisher, investigative journalist, or independent editorial creator';
    contextOfUse = 'Long-form reading and knowledge discovery across desktop and mobile devices';
    severity = 'HIGH_OPERATIONAL_FRICTION';
    rootCause = 'Monolithic CMS architectures tightly couple editorial content with heavy rendering runtimes and invasive trackers.';
    painPoints.push('Legacy CMS platforms are plagued with bloated JavaScript bundles, sluggish page loads, and poor Core Web Vitals.');
    painPoints.push('Intrusive layout shifts, aggressive tracker scripts, and paywall popups ruin the editorial reading experience.');
    painPoints.push('Poor structured metadata prevents content from indexing accurately in search engines and AI knowledge graphs.');
    constraints.unshift('Sub-second First Contentful Paint (FCP) and zero cumulative layout shift (CLS == 0).');
    constraints.push('100% semantic HTML5 article markup with valid JSON-LD metadata for search engine indexing.');
  } else if (archetype === 'file-transformation') {
    primaryPersona = isPrivacySensitive 
      ? 'Privacy-conscious professional / enterprise designer / security engineer' 
      : 'Modern digital professional / developer';
    contextOfUse = 'Converting sensitive assets locally without round-trip cloud latency or leaks';
    severity = isPrivacySensitive ? 'CRITICAL_SECURITY_RISK' : 'HIGH_OPERATIONAL_FRICTION';
    rootCause = 'Legacy tools force server-side uploads to monetize user files or offset client-side compute limitations.';
    if (isPrivacySensitive) {
      painPoints.push('Existing cloud-based tools force users to upload confidential data to untrusted remote servers.');
      painPoints.push('Data privacy regulations (GDPR/HIPAA/internal infosec) strictly prohibit server-side file transmission.');
    }
    painPoints.push('Legacy conversion tools enforce arbitrary file size caps, aggressive watermarking, or predatory paywalls.');
    painPoints.push('Multi-step upload and download workflows interrupt productive developer and designer flow.');
    if (isPrivacySensitive) {
      constraints.unshift('Strict Client-Side Boundary: All processing must occur 100% in-browser via WebAssembly, Web Workers, or Canvas APIs with zero server transmission.');
    }
  } else if (archetype === 'telemetry-dashboard') {
    primaryPersona = 'Site Reliability Engineer (SRE), DevOps lead, or platform telemetry analyst';
    contextOfUse = 'Real-time production infrastructure and service health monitoring under high event volume';
    severity = 'CRITICAL_OPERATIONAL_VISIBILITY';
    rootCause = 'Enterprise APM tools enforce closed data silos, heavy browser agents, and costly per-host licensing.';
    painPoints.push('Expensive enterprise APM tools cost thousands of dollars per host and suffer from telemetry lag.');
    painPoints.push('Heavy monitoring dashboards freeze the browser tab when processing high-frequency streaming events.');
    painPoints.push('Complex query languages slow down root cause diagnosis during critical incident response.');
    constraints.unshift('Zero main-thread blocking: Streaming data buffering must handle >= 10,000 events/sec without dropped frames.');
    constraints.push('Strict 60 FPS hardware-accelerated canvas/WebGL rendering for high-density timeseries visualization.');
  } else if (archetype === 'headless-api') {
    primaryPersona = 'Backend systems engineer, integration developer, or distributed system architect';
    contextOfUse = 'High-concurrency microservice or headless backend API contract integration';
    severity = 'HIGH_SYSTEM_RELIABILITY';
    rootCause = 'Bloated web frameworks introduce undocumented middleware chains, irregular errors, and slow serialization.';
    painPoints.push('Monolithic API frameworks add heavy middleware latency and fragile dependency trees.');
    painPoints.push('Inconsistent error response formats across endpoints complicate client error handling and retry logic.');
    painPoints.push('Unvalidated request payloads lead to runtime crashes and remote injection vulnerabilities.');
    constraints.unshift('Zero UI assets: Strictly headless JSON API contract with zero client-side DOM dependencies.');
    constraints.push('100% compliant RFC 7807 Problem Details specification for all error responses.');
  } else if (archetype === 'workflow-automation') {
    primaryPersona = 'Platform automation engineer, DevOps practitioner, or data workflow developer';
    contextOfUse = 'Multi-step automated task orchestration and batch pipeline execution with dependency tracking';
    severity = 'HIGH_EXECUTION_INTEGRITY';
    rootCause = 'Ad-hoc shell scripts lack DAG cycle validation, state journals, and deterministic crash recovery.';
    painPoints.push('Heavy orchestrators (Airflow/Temporal) require complex clusters and dedicated infrastructure maintenance.');
    painPoints.push('Script-based pipelines fail silently or leave dirty partial states upon unexpected crashes.');
    painPoints.push('Circular dependencies and race conditions are difficult to detect before runtime execution.');
    constraints.unshift('Deterministic DAG execution with static cycle detection before pipeline invocation.');
    constraints.push('Crash-resilient state checkpointing: every step output is committed to an atomic persistent journal.');
  } else if (archetype === 'geometric-cad') {
    primaryPersona = 'Mechanical engineer, computational designer, or 3D fabrication specialist';
    contextOfUse = 'Procedural 3D solid modeling and parametric part fabrication in lightweight environments';
    severity = 'HIGH_CREATIVE_PRODUCTIVITY';
    rootCause = 'Proprietary CAD software locks geometry in closed binary formats and requires expensive workstation hardware.';
    painPoints.push('Proprietary CAD software costs thousands per seat and locks part designs in proprietary binary formats.');
    painPoints.push('Heavy desktop CAD requires high-end workstations and cannot run in portable lightweight environments.');
    painPoints.push('Lack of programmatic geometry synthesis limits automated generative design workflows.');
    constraints.unshift('Parametric precision: Geometry calculations must maintain exact floating-point tolerances.');
    constraints.push('Browser-native 3D rendering via WebGL/WebGPU with 60 FPS viewport orbit navigation.');
  } else if (archetype === 'vector-search') {
    primaryPersona = 'Machine learning engineer, AI search developer, or local retrieval specialist';
    contextOfUse = 'Low-latency in-memory semantic search and document retrieval at the edge';
    severity = 'HIGH_RETRIEVAL_EFFICIENCY';
    rootCause = 'Cloud vector databases introduce recurring subscription costs, high API latency, and data privacy leakage.';
    painPoints.push('Cloud vector databases introduce recurring subscription costs, high API latency, and data leakage risks.');
    painPoints.push('Heavy vector search engines require Python runtimes and massive C++ native build dependencies.');
    painPoints.push('Lack of lightweight embedded vector indexers makes local client/edge AI retrieval difficult.');
    constraints.unshift('Sub-5ms cosine similarity search latency over 10,000 vectors.');
    constraints.push('Zero native build dependencies: Pure JavaScript / WebAssembly portable execution.');
  } else if (archetype === 'cryptographic-tool') {
    primaryPersona = 'Cryptographic security engineer, key custodian, or high-assurance system administrator';
    contextOfUse = 'Zero-trust key management, disaster recovery secret splitting, and credential protection';
    severity = 'CRITICAL_SECURITY_ASSURANCE';
    rootCause = 'Single master keys create catastrophic single points of failure, while cloud key vaults risk remote subpoena.';
    painPoints.push('Single points of failure in private key storage lead to catastrophic data loss or insider compromise.');
    painPoints.push('Closed-source cloud secret managers require blind trust and risk remote breaches or subpoenas.');
    painPoints.push('Complex threshold cryptography implementations are error-prone and leak side-channel secrets.');
    constraints.unshift('Zero plaintext memory leaks: Strict memory buffer zeroing/wiping immediately after cryptographic operations.');
    constraints.push('Information-theoretically secure Shamir Secret Sharing over GF(2^8) with Argon2id passphrase hardening.');
  } else {
    // Custom Hybrid / Novel Concept
    primaryPersona = 'Modern digital professional / developer / creator';
    contextOfUse = 'Streamlined, friction-free workflow execution tailored to domain requirements';
    severity = isPrivacySensitive ? 'CRITICAL_SECURITY_RISK' : 'HIGH_OPERATIONAL_FRICTION';
    painPoints.push('Current market alternatives are either overly bloated, slow, or enforce steep subscription paywalls.');
    painPoints.push('Lack of streamlined, zero-friction workflows for daily operational tasks.');
    if (isPrivacySensitive) {
      constraints.unshift('Strict Local Execution Boundary: Process data without unnecessary external transmissions.');
    }
  }

  // Detect explicit unspecified aspects
  const unspecifiedRequirements = detectUnspecifiedRequirements(cleanIntent, profile);

  return {
    problem_id: `PROB-${slug}-${crypto.randomBytes(3).toString('hex')}`,
    created_at: now,
    archetype,
    problem_statement: problemStatement,
    target_user: {
      primary_persona: primaryPersona,
      technical_proficiency: 'Intermediate to beginner',
      context_of_use: contextOfUse
    },
    context_and_environment: {
      platform: profile.runtime || 'Modern Web Browser / Node.js (Cross-Platform)',
      network_dependency: isPrivacySensitive ? 'Offline-Capable / Client-Side' : 'Standard Network / Standalone',
      viewport_range: archetype === 'headless-api' ? 'N/A (Headless)' : 'Mobile (360px) to Desktop (4K)'
    },
    pain_points: painPoints,
    urgency_evaluation: {
      severity,
      status_quo_failure: 'Existing workarounds either violate operational compliance, lack performance, or waste manual time.'
    },
    root_cause_analysis: rootCause,
    constraints,
    unspecified_requirements: unspecifiedRequirements,
    desired_outcomes_and_success_criteria: [
      'Immediate task completion with zero friction and intuitive feedback.',
      isPrivacySensitive ? '100% verified zero outbound network requests for user file payloads.' : 'Instant visual or programmatic confirmation of success.',
      'Target performance budgets satisfied under expected production workloads.'
    ]
  };
}

/**
 * Domain C: Market & Business Intelligence Synthesizer
 * Formulates commercial feasibility, competitive gap analysis, and viability verdict.
 */
export function synthesizeMarketFeasibility(problemRecord, profile = {}, options = {}) {
  const isClientSidePrivate = problemRecord.constraints.some(c => c.toLowerCase().includes('client-side'));
  const archetype = problemRecord.archetype || 'custom-hybrid';
  const now = new Date().toISOString();

  let competitorMatrix = [];
  let valueProposition = '';
  let primaryModel = 'Open-source core with micro-SaaS / enterprise utility tier';
  let grossMargin = '90%+ (Client-side / zero-backend compute eliminates recurring server costs)';

  if (archetype === 'editorial-publishing') {
    competitorMatrix = [
      {
        competitor_type: 'Monolithic Ad-Heavy CMS (WordPress, Medium)',
        key_strengths: 'Vast plugin ecosystem, existing creator networks',
        critical_weaknesses: 'Sluggish performance, heavy tracker scripts, poor Core Web Vitals, intrusive popups'
      },
      {
        competitor_type: 'Headless Static Generators',
        key_strengths: 'Fast page loads, developer control',
        critical_weaknesses: 'High technical barrier for non-technical writers, lack of out-of-the-box in-browser search'
      }
    ];
    valueProposition = 'Lightning-Fast, High-Fidelity Editorial Platform with Pure Typography, Instant Full-Text Search, and Zero Tracker Bloat.';
    primaryModel = 'AdSense-optimized high-intent search traffic + optional reader sponsorship / premium subscriptions';
  } else if (archetype === 'file-transformation') {
    competitorMatrix = [
      {
        competitor_type: 'Legacy Ad-Supported Web Utilities',
        key_strengths: 'High SEO visibility, established domain authority',
        critical_weaknesses: 'Server-side file uploads, heavy advertising clutter, intrusive trackers, slow page load, privacy risks'
      },
      {
        competitor_type: 'Enterprise Desktop Software',
        key_strengths: 'Offline processing, robust feature set',
        critical_weaknesses: 'Expensive licensing, heavy install footprint, poor cross-device portability'
      }
    ];
    valueProposition = isClientSidePrivate
      ? 'Zero-Server In-Browser Execution: Instant, 100% private processing with zero file uploads and zero cloud latency.'
      : 'Frictionless, Lightning-Fast Digital Utility with Clean Aesthetic and Zero Bloat.';
  } else if (archetype === 'telemetry-dashboard') {
    competitorMatrix = [
      {
        competitor_type: 'Enterprise APM Suites (Datadog, Dynatrace)',
        key_strengths: 'Comprehensive enterprise integrations, hosted infrastructure',
        critical_weaknesses: 'Extremely expensive per-host billing, heavy browser frontend, sluggish query response during outages'
      },
      {
        competitor_type: 'Basic Open-Source Metric Viewers',
        key_strengths: 'Low cost, open source',
        critical_weaknesses: 'Complex setup, dropped frames under high event streaming throughput'
      }
    ];
    valueProposition = 'Zero-Lag Real-Time Streaming Telemetry Dashboard handling 10,000+ events/sec at 60 FPS with instant windowed P99 analytics.';
  } else if (archetype === 'headless-api') {
    competitorMatrix = [
      {
        competitor_type: 'Heavy Enterprise Web Frameworks',
        key_strengths: 'Large batteries-included ecosystem',
        critical_weaknesses: 'High memory footprint, bloated middleware latency, inconsistent RFC 7807 error responses'
      },
      {
        competitor_type: 'Custom Node.js Express APIs',
        key_strengths: 'Familiar developer API',
        critical_weaknesses: 'Manual schema validation boilerplates, lack of standardized error serialization'
      }
    ];
    valueProposition = 'Ultra-Lean, Sub-Millisecond Headless API Dispatcher with Strict Schema Validation and 100% RFC 7807 Compliance.';
  } else if (archetype === 'workflow-automation') {
    competitorMatrix = [
      {
        competitor_type: 'Distributed DAG Orchestrators (Airflow, Prefect)',
        key_strengths: 'Distributed scale, extensive plugin ecosystem',
        critical_weaknesses: 'Heavy cluster operational overhead, slow startup latency, overkill for standalone tasks'
      },
      {
        competitor_type: 'Ad-hoc Bash / Python Shell Scripts',
        key_strengths: 'Simple single-file execution',
        critical_weaknesses: 'Zero crash recovery, no cycle detection, brittle error handling'
      }
    ];
    valueProposition = 'Embeddable, Crash-Resilient DAG Automation Runner with Static Cycle Detection and Atomic Step Journaling.';
  } else if (archetype === 'geometric-cad') {
    competitorMatrix = [
      {
        competitor_type: 'Commercial CAD Suites (Fusion 360, SolidWorks)',
        key_strengths: 'Full industrial feature set, CAM integration',
        critical_weaknesses: 'Extremely high seat license, heavy desktop install, closed file formats'
      },
      {
        competitor_type: 'Basic CSG Libraries',
        key_strengths: 'Open source, programmatic API',
        critical_weaknesses: 'Slow boolean operations, non-manifold geometry leaks, poor browser rendering'
      }
    ];
    valueProposition = 'Lightweight Procedural Web CAD with Sub-100ms Parametric CSG Booleans and 60 FPS WebGL Interactive Inspection.';
  } else if (archetype === 'vector-search') {
    competitorMatrix = [
      {
        competitor_type: 'Cloud Hosted Vector DBs (Pinecone, Qdrant Cloud)',
        key_strengths: 'Managed scaling, enterprise cloud integrations',
        critical_weaknesses: 'Recurring monthly cost, network latency (20-100ms), privacy concerns for sensitive embeddings'
      },
      {
        competitor_type: 'Heavy Native Vector Engines (FAISS, Milvus)',
        key_strengths: 'High billion-scale throughput',
        critical_weaknesses: 'Complex native compilation, heavy memory footprint, not embeddable in lightweight environments'
      }
    ];
    valueProposition = 'Zero-Dependency In-Memory HNSW Vector Search with Sub-5ms Cosine Ranking and Pure WebAssembly/JS Portability.';
  } else if (archetype === 'cryptographic-tool') {
    competitorMatrix = [
      {
        competitor_type: 'Cloud Key Management Services (AWS KMS, HashiCorp Vault)',
        key_strengths: 'Centralized enterprise compliance, managed hardware security modules (HSM)',
        critical_weaknesses: 'Requires network connectivity, recurring costs, vulnerable to remote vendor subpoena or account lockout'
      },
      {
        competitor_type: 'Legacy Secret Splitting Scripts',
        key_strengths: 'Lightweight CLI implementation',
        critical_weaknesses: 'Lacks Argon2id passphrase hardening, leaves plaintext secrets in unzeroed RAM buffers'
      }
    ];
    valueProposition = 'Information-Theoretically Secure Shamir Secret Sharing with Argon2id Key Derivation and Verified Memory Zeroing.';
  } else {
    competitorMatrix = [
      {
        competitor_type: 'Status Quo Commercial Solutions',
        key_strengths: 'Broad brand awareness',
        critical_weaknesses: 'Feature bloat, high cost, poor responsiveness'
      },
      {
        competitor_type: 'Ad-hoc Open Source Scripts',
        key_strengths: 'Low cost',
        critical_weaknesses: 'Poor documentation, lack of automated verification'
      }
    ];
    valueProposition = 'Frictionless, High-Performance Digital Tool with Clean Architecture and Zero Bloat.';
  }

  return {
    feasibility_id: `FEAS-${slugify(problemRecord.problem_id)}`,
    evaluated_at: now,
    archetype,
    commercial_subject: profile.name || problemRecord.target_user.primary_persona,
    market_sizing_estimate: {
      market_tier: 'Targeted Productivity & Technical Infrastructure',
      addressable_audience: 'Global developers, engineers, creators, and data-conscious teams',
      growth_driver: 'Demand for edge-first, zero-telemetry, lightweight digital products'
    },
    competitor_matrix: competitorMatrix,
    market_gaps: [
      `Absence of transparent, lean, high-performance tools in the ${archetype} domain without predatory paywalls.`,
      'Poor mobile responsiveness and heavy ad/telemetry clutter in status-quo alternatives.'
    ],
    value_proposition: valueProposition,
    monetization_and_distribution: {
      primary_model: primaryModel,
      distribution_channels: [
        'Organic Technical SEO (Long-Tail High Intent)',
        'Developer Communities (GitHub, ProductHunt, Hacker News, Reddit)',
        'Word-of-mouth referral'
      ]
    },
    hurdle_rate_evaluation: {
      gross_margin_potential: grossMargin,
      payback_period_months: 1,
      estimated_ltv_cac_ratio: 5.0,
      moat_defensibility_score: 0.85
    },
    feasibility_verdict: 'FEASIBLE'
  };
}

/**
 * Domain B: Product Intelligence Synthesizer
 * Compiles an implementation-ready PRDSpecification with first-principles MVP Scope and strict Negative Scope.
 */
export function synthesizePRDSpecification(problemRecord, marketFeasibility, profile = {}, options = {}) {
  const now = new Date().toISOString();
  const slug = slugify(problemRecord.problem_id);
  const archetype = problemRecord.archetype || 'custom-hybrid';
  const isClientSidePrivate = problemRecord.constraints.some(c => c.toLowerCase().includes('client-side'));

  let mvpScope = [];
  let negativeScope = [];
  let userStories = [];
  let techSpecs = {};
  let successMetrics = [];

  if (archetype === 'editorial-publishing') {
    mvpScope = [
      {
        feature_id: 'FEAT-CORE-01',
        name: 'Structured Content Store & Indexed Article Repository',
        priority: 'P0_CRITICAL',
        description: 'Static-first markdown article ingestion engine with frontmatter parsing, tag indexing, and slug resolution.',
        acceptance_criteria: 'Parses article collections within 50ms at build time; provides typed content schema and slug routing.'
      },
      {
        feature_id: 'FEAT-CORE-02',
        name: 'High-Speed Full-Text Search Engine',
        priority: 'P0_CRITICAL',
        description: 'Client-side inverted index or BM25-based fast full-text article search across titles, summaries, and body text.',
        acceptance_criteria: 'Returns ranked search results within 15ms across 1,000 articles with highlight matches.'
      },
      {
        feature_id: 'FEAT-CORE-03',
        name: 'Semantic Reader Layout & Reading Modes',
        priority: 'P0_CRITICAL',
        description: 'WCAG 2.1 AA accessible long-form reading view with Dark, Light, and Sepia reading modes and responsive typography.',
        acceptance_criteria: 'Fluid reading view adapts across 360px to 4K viewports with zero layout shift (CLS == 0).'
      },
      {
        feature_id: 'FEAT-CORE-04',
        name: 'Comprehensive SEO & JSON-LD Structured Data Schema',
        priority: 'P0_CRITICAL',
        description: 'Automated injection of Schema.org Article JSON-LD markup, OpenGraph cards, canonical tags, and RSS/Atom feeds.',
        acceptance_criteria: 'Generates valid Schema.org Article metadata verified by standard structured data linters.'
      }
    ];

    negativeScope = [
      {
        exclusion_id: 'EXCL-01',
        feature_name: 'Drag-and-Drop Ingestion Zone & File Transcoding Pipeline',
        rationale: 'Editorial publishing sites publish structured text and articles; binary media transcoding pipelines are strictly excluded.'
      },
      {
        exclusion_id: 'EXCL-02',
        feature_name: 'User Account Registration & Password Login',
        rationale: 'Public editorial content requires zero authentication friction; reader accounts add database liabilities and spam vectors.'
      },
      {
        exclusion_id: 'EXCL-03',
        feature_name: 'Heavy Monolithic CMS Database Overhead',
        rationale: 'Static SSG and in-browser indexing eliminate ongoing relational database maintenance and security patch overhead.'
      },
      {
        exclusion_id: 'EXCL-04',
        feature_name: 'Third-Party Ad Trackers & Invasive Analytics Popups',
        rationale: 'Strict privacy stance ensures clean, fast reading flow with zero tracking bloat and optimal Core Web Vitals.'
      }
    ];

    userStories = [
      {
        story_id: 'US-01',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'Read long-form investigative articles with comfortable typography and dark/sepia reading modes',
        so_that: 'I can absorb in-depth content without visual fatigue or jarring UI elements',
        acceptance_criteria: [
          'Given any article, when opened, it renders immediately with zero layout shift.',
          'Given the reading mode toggle, when clicked, theme updates instantly without page reload.'
        ]
      },
      {
        story_id: 'US-02',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'Instantly search across all published articles by topic or keyword',
        so_that: 'I can discover relevant analysis within milliseconds',
        acceptance_criteria: [
          'Given a search query, matching article cards appear in under 15ms.',
          'Search highlights matched keywords in article titles and summaries.'
        ]
      },
      {
        story_id: 'US-03',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'Ensure my published articles contain pristine Schema.org JSON-LD structured data',
        so_that: 'Search engines and AI discovery tools index content accurately and prominently',
        acceptance_criteria: [
          'HTML head contains valid Schema.org Article JSON-LD script tag.',
          'OpenGraph and Twitter meta cards validate cleanly in previews.'
        ]
      }
    ];

    techSpecs = {
      architecture_blueprint: profile.blueprint || 'astro-tailwind-v4',
      processing_location: 'STATIC_SSG_AND_CLIENT_SEARCH',
      supported_formats: ['text/markdown', 'text/html', 'application/json', 'application/rss+xml'],
      ui_states_required: ['ARTICLE_LIST', 'ARTICLE_READING', 'SEARCH_ACTIVE', 'SEARCH_EMPTY']
    };

    successMetrics = [
      'Article search latency < 15ms across 1,000 articles',
      'Lighthouse Performance & SEO score >= 95',
      'Zero client hydration overhead for static content (CLS == 0)'
    ];

  } else if (archetype === 'file-transformation') {
    mvpScope = [
      {
        feature_id: 'FEAT-CORE-01',
        name: 'Intuitive Drag-and-Drop Ingestion Zone',
        priority: 'P0_CRITICAL',
        description: 'Accessible, interactive dropzone supporting file selection, paste from clipboard, and mobile file picker.',
        acceptance_criteria: 'Files load into memory within 100ms with visual feedback and MIME-type validation.'
      },
      {
        feature_id: 'FEAT-CORE-02',
        name: 'Core In-Browser Processing Pipeline',
        priority: 'P0_CRITICAL',
        description: 'Direct transformation engine executed locally via browser APIs (Canvas, WASM, Web Workers).',
        acceptance_criteria: 'Transformation completes without freezing main thread; zero outbound network requests emitted.'
      },
      {
        feature_id: 'FEAT-CORE-03',
        name: 'Instant Result Preview & 1-Click Export',
        priority: 'P0_CRITICAL',
        description: 'Side-by-side or immediate before/after preview with instant download action.',
        acceptance_criteria: 'Download triggers immediately with sanitized filename; file size and format verified.'
      },
      {
        feature_id: 'FEAT-CORE-04',
        name: 'Responsive Shell & Privacy Guarantee Badge',
        priority: 'P0_CRITICAL',
        description: 'Tailwind styled layout displaying verified privacy badge and zero-server guarantee.',
        acceptance_criteria: 'Fully responsive on viewports from 360px to 4K; 100% keyboard navigable.'
      }
    ];

    negativeScope = [
      {
        exclusion_id: 'EXCL-01',
        feature_name: 'User Account Registration & Password Login',
        rationale: 'Unnecessary barrier for utility tools; increases friction and introduces user database liability.'
      },
      {
        exclusion_id: 'EXCL-02',
        feature_name: 'Cloud File Storage & Multi-Device Sync',
        rationale: 'Violates the strict privacy guarantee; adds recurring database/storage costs.'
      },
      {
        exclusion_id: 'EXCL-03',
        feature_name: 'Complex Enterprise Role-Based Access Control (RBAC)',
        rationale: 'Premature optimization for MVP; slows initial delivery without proven demand.'
      },
      {
        exclusion_id: 'EXCL-04',
        feature_name: 'Heavy Client-Side Frameworks with Hydration Overhead',
        rationale: 'Astro static defaults provide zero-hydration performance and faster First Contentful Paint (FCP).'
      }
    ];

    userStories = [
      {
        story_id: 'US-01',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'Drag and drop my local files into the browser tool',
        so_that: 'I can process them instantly without installing heavy native software',
        acceptance_criteria: [
          'Given a supported file format, when dropped, it is accepted immediately.',
          'Given an unsupported format, when dropped, an accessible error toast explains accepted MIME types.'
        ]
      },
      {
        story_id: 'US-02',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'Be 100% confident that my confidential files are never uploaded to a cloud server',
        so_that: 'I comply with enterprise security and data privacy mandates',
        acceptance_criteria: [
          'Network tab confirms 0 POST/PUT requests during processing.',
          'Privacy badge and clear explanatory disclosure visible above the fold.'
        ]
      },
      {
        story_id: 'US-03',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'Download the finished output in one click',
        so_that: 'I can resume my primary workflow without delay',
        acceptance_criteria: [
          'Clicking download immediately triggers the native browser save dialog.',
          'Output file retains high fidelity and expected format specifications.'
        ]
      }
    ];

    techSpecs = {
      architecture_blueprint: profile.blueprint || 'astro-tailwind-v4',
      processing_location: isClientSidePrivate ? 'CLIENT_BROWSER_ONLY' : 'CLIENT_PRIMARY_OPTIONAL_EDGE',
      supported_formats: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
      ui_states_required: ['EMPTY_IDLE', 'DRAG_HOVER', 'PROCESSING_ACTIVE', 'SUCCESS_PREVIEW', 'ERROR_FEEDBACK']
    };

    successMetrics = [
      'Client-side processing latency < 500ms for standard payloads',
      'Zero server payload transmission',
      'Lighthouse Accessibility & SEO score == 100'
    ];

  } else if (archetype === 'telemetry-dashboard') {
    mvpScope = [
      {
        feature_id: 'FEAT-CORE-01',
        name: 'High-Throughput WebSocket Stream Ingestion & Ring Buffer',
        priority: 'P0_CRITICAL',
        description: 'Zero-copy event consumer buffering telemetry packets into a fixed-size ring buffer without allocations.',
        acceptance_criteria: 'Ingests >= 10,000 events/sec without memory expansion or dropped events.'
      },
      {
        feature_id: 'FEAT-CORE-02',
        name: 'Windowed Metric Aggregator & P50/P95/P99 Calculator',
        priority: 'P0_CRITICAL',
        description: 'Real-time sliding-window statistics calculator evaluating min, mean, P95, and P99 percentiles over 60s windows.',
        acceptance_criteria: 'Recalculates windowed percentiles within 5ms of tick arrival.'
      },
      {
        feature_id: 'FEAT-CORE-03',
        name: 'Zero-Lag Timeseries Canvas Visualizer',
        priority: 'P0_CRITICAL',
        description: 'Hardware-accelerated HTML5 Canvas chart renderer plotting dynamic multi-metric graphs at 60 FPS.',
        acceptance_criteria: 'Maintains consistent 60 FPS frame rate under full 10k events/sec stream.'
      },
      {
        feature_id: 'FEAT-CORE-04',
        name: 'System Health & Threshold Alert Pill',
        priority: 'P0_CRITICAL',
        description: 'Contextual visual health indicators with configurable SLA threshold breach alerts.',
        acceptance_criteria: 'Transitions alert pill to WARNING/CRITICAL within 50ms of threshold breach.'
      }
    ];

    negativeScope = [
      {
        exclusion_id: 'EXCL-01',
        feature_name: 'Drag-and-Drop File Ingestion Dropzone',
        rationale: 'Real-time telemetry dashboards ingest streaming network events; file dropzone ingestion is strictly excluded.'
      },
      {
        exclusion_id: 'EXCL-02',
        feature_name: 'User Account Registration & Password Login',
        rationale: 'Standalone telemetry dashboard connects to local/edge telemetry agents without requiring user account databases.'
      },
      {
        exclusion_id: 'EXCL-03',
        feature_name: 'Historical Multi-Year Long-Term Data Archiving',
        rationale: 'Out of scope for real-time edge monitoring; focuses strictly on active sliding-window operational metrics.'
      },
      {
        exclusion_id: 'EXCL-04',
        feature_name: 'Heavy DOM-Based Charting Libraries',
        rationale: 'SVG/DOM charting creates severe layout thrashing at high frequencies; Canvas rendering is mandatory.'
      }
    ];

    userStories = [
      {
        story_id: 'US-01',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'Connect the dashboard to my telemetry WebSocket stream',
        so_that: 'I can monitor live production throughput without latency',
        acceptance_criteria: [
          'Given an active stream URL, connection establishes within 200ms.',
          'Visual connection status indicator reflects STREAM_ACTIVE.'
        ]
      },
      {
        story_id: 'US-02',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'View instantaneous P95 and P99 latency percentiles',
        so_that: 'I can spot performance degradation before user impact',
        acceptance_criteria: [
          'Sliding window percentiles refresh smoothly on every tick.',
          'P99 outliers are highlighted visually on the timeseries canvas.'
        ]
      },
      {
        story_id: 'US-03',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'Receive immediate visual notification if error rate exceeds threshold',
        so_that: 'I can initiate incident triage immediately',
        acceptance_criteria: [
          'Alert pill switches color and pulses upon threshold breach.',
          'Hover reveals exact breach timestamp and offending metric value.'
        ]
      }
    ];

    techSpecs = {
      architecture_blueprint: profile.blueprint || 'standalone-canvas-dashboard',
      processing_location: 'CLIENT_STREAM_BUFFER',
      supported_formats: ['application/json', 'application/x-ndjson', 'text/event-stream'],
      ui_states_required: ['DISCONNECTED', 'STREAM_CONNECTING', 'STREAM_ACTIVE', 'THRESHOLD_ALERT']
    };

    successMetrics = [
      'Rendering frame rate >= 60 FPS under 10,000 events/sec',
      'P99 aggregation computation latency < 5ms',
      'Memory usage capped strictly under 100MB'
    ];

  } else if (archetype === 'headless-api') {
    mvpScope = [
      {
        feature_id: 'FEAT-CORE-01',
        name: 'Deterministic HTTP Request Router & Middleware Dispatcher',
        priority: 'P0_CRITICAL',
        description: 'Zero-overhead route matcher with deterministic path parametrization and middleware pipeline execution.',
        acceptance_criteria: 'Dispatches requests in < 1ms with strict HTTP method and header validation.'
      },
      {
        feature_id: 'FEAT-CORE-02',
        name: 'Strict Schema Validation & Payload Sanitizer',
        priority: 'P0_CRITICAL',
        description: 'Input boundary guard verifying request bodies against strict schemas (Zod/JSON Schema) before execution.',
        acceptance_criteria: 'Rejects malformed payloads with 422 Unprocessable Entity in < 2ms.'
      },
      {
        feature_id: 'FEAT-CORE-03',
        name: 'Isolated Business Logic & Vault State Processor',
        priority: 'P0_CRITICAL',
        description: 'Pure function business logic kernel operating with idempotency guarantees and isolated state bounds.',
        acceptance_criteria: 'Executes core domain operations deterministically without side-channel leaks.'
      },
      {
        feature_id: 'FEAT-CORE-04',
        name: 'RFC 7807 Standardized Problem Details Error Subsystem',
        priority: 'P0_CRITICAL',
        description: 'Uniform error serialization emitting type, title, status, detail, and instance fields on every failure.',
        acceptance_criteria: 'All non-2xx responses conform 100% to application/problem+json specification.'
      }
    ];

    negativeScope = [
      {
        exclusion_id: 'EXCL-01',
        feature_name: 'Graphical User Interface & Drag-and-Drop Dropzone',
        rationale: 'Headless API has zero frontend or dropzone components; HTML presentation layers are strictly excluded.'
      },
      {
        exclusion_id: 'EXCL-02',
        feature_name: 'Interactive HTML Dashboard & Static Web Pages',
        rationale: 'API strictly serves machine-readable JSON contracts to programmatic clients.'
      },
      {
        exclusion_id: 'EXCL-03',
        feature_name: 'User Account Registration & Password Login Form',
        rationale: 'Auth handled via cryptographically signed tokens or API keys, not session cookie forms.'
      },
      {
        exclusion_id: 'EXCL-04',
        feature_name: 'Heavy ORM Abstractions with Dynamic Reflection',
        rationale: 'Lean typed query functions prevent memory bloat and eliminate unpredictable query plan latency.'
      }
    ];

    userStories = [
      {
        story_id: 'US-01',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'Send structured JSON payloads to API endpoints',
        so_that: 'I can execute backend domain operations programmatically',
        acceptance_criteria: [
          'Given a valid JSON request, server returns 200 OK with expected schema.',
          'P99 response time remains under 20ms.'
        ]
      },
      {
        story_id: 'US-02',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'Receive structured RFC 7807 error responses upon invalid input',
        so_that: 'My client application can handle error states programmatically without guessing',
        acceptance_criteria: [
          'Response Content-Type is application/problem+json.',
          'Payload includes type, title, status, detail, and invalid-params array.'
        ]
      },
      {
        story_id: 'US-03',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'Verify API idempotency on retried operations',
        so_that: 'Network retries do not result in duplicated state changes',
        acceptance_criteria: [
          'Given identical Idempotency-Key header, repeated requests return cached outcome without re-execution.'
        ]
      }
    ];

    techSpecs = {
      architecture_blueprint: profile.blueprint || 'node-clean-api',
      processing_location: 'HEADLESS_SERVER_RUNTIME',
      supported_formats: ['application/json', 'application/problem+json'],
      ui_states_required: ['N/A_HEADLESS_API']
    };

    successMetrics = [
      'P99 API response latency < 20ms',
      '100% RFC 7807 compliance on all error payloads',
      'Zero unhandled exceptions or process panics'
    ];

  } else if (archetype === 'workflow-automation') {
    mvpScope = [
      {
        feature_id: 'FEAT-CORE-01',
        name: 'Directed Acyclic Graph (DAG) Dependency Planner & Cycle Detector',
        priority: 'P0_CRITICAL',
        description: 'Topological sort dependency resolver verifying graph acyclicity and computing optimal execution waves.',
        acceptance_criteria: 'Detects cycles and rejects invalid DAGs in < 5ms before task execution.'
      },
      {
        feature_id: 'FEAT-CORE-02',
        name: 'Concurrent Step Executor & Task Runner',
        priority: 'P0_CRITICAL',
        description: 'Asynchronous task runner dispatching independent steps concurrently with worker concurrency limits.',
        acceptance_criteria: 'Executes independent steps in parallel; honors prerequisite step dependencies strictly.'
      },
      {
        feature_id: 'FEAT-CORE-03',
        name: 'Crash-Resilient State Checkpointer & Journal Log',
        priority: 'P0_CRITICAL',
        description: 'Persistent append-only journal capturing step state transitions (PENDING, RUNNING, COMPLETED, FAILED).',
        acceptance_criteria: 'Allows seamless resumption from exact point of failure without duplicate step execution.'
      },
      {
        feature_id: 'FEAT-CORE-04',
        name: 'Execution Status Reporter & Summary Formatter',
        priority: 'P0_CRITICAL',
        description: 'Structured reporter emitting complete execution telemetry, duration per step, and exit codes.',
        acceptance_criteria: 'Outputs clean machine-readable execution manifest upon run completion.'
      }
    ];

    negativeScope = [
      {
        exclusion_id: 'EXCL-01',
        feature_name: 'Drag-and-Drop File Ingestion Dropzone',
        rationale: 'Workflow runners execute structured step manifests via CLI/API, not interactive file dropzones.'
      },
      {
        exclusion_id: 'EXCL-02',
        feature_name: 'User Account Registration & Password Login',
        rationale: 'Automation engine runs in headless CI/CD, batch cron, or developer environments without login forms.'
      },
      {
        exclusion_id: 'EXCL-03',
        feature_name: 'Multi-Node Distributed Consensus Cluster',
        rationale: 'Single-node embedded runner avoids Raft/ZooKeeper cluster complexity and operational overhead.'
      },
      {
        exclusion_id: 'EXCL-04',
        feature_name: 'Dynamic Code Injection via Untrusted Strings',
        rationale: 'Tasks must be pre-declared pure functions; arbitrary string evaluation (eval) is forbidden.'
      }
    ];

    userStories = [
      {
        story_id: 'US-01',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'Declare tasks with explicit dependencies and execute them',
        so_that: 'Independent tasks run concurrently while ordered tasks run in sequence',
        acceptance_criteria: [
          'DAG validates acyclicity before any step launches.',
          'Dependent steps wait until prerequisite steps complete successfully.'
        ]
      },
      {
        story_id: 'US-02',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'Resume an interrupted workflow run after a transient failure',
        so_that: 'I do not have to re-execute expensive completed steps',
        acceptance_criteria: [
          'Given a persisted state journal, resume command picks up directly from failed task.',
          'Already completed tasks are skipped with cached outputs preserved.'
        ]
      },
      {
        story_id: 'US-03',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'Inspect execution duration and status for every task',
        so_that: 'I can identify workflow bottlenecks and verify success',
        acceptance_criteria: [
          'Execution summary outputs clear tabular status and millisecond durations.',
          'Exit code matches aggregate run outcome (0 for success, non-zero for failure).'
        ]
      }
    ];

    techSpecs = {
      architecture_blueprint: profile.blueprint || 'node-dag-runner',
      processing_location: 'LOCAL_TASK_RUNNER',
      supported_formats: ['application/json', 'text/yaml'],
      ui_states_required: ['N/A_HEADLESS_RUNNER']
    };

    successMetrics = [
      'DAG cycle detection executes in < 5ms',
      '100% crash recovery accuracy from state journal',
      'Zero orphaned worker threads or unhandled rejections'
    ];

  } else if (archetype === 'geometric-cad') {
    mvpScope = [
      {
        feature_id: 'FEAT-CORE-01',
        name: 'Parametric Geometry Intent Parser & Constraint Solver',
        priority: 'P0_CRITICAL',
        description: 'Mathematical evaluator parsing dimensional parameters, sketches, and geometric constraints into shape vectors.',
        acceptance_criteria: 'Computes parametric dimensions within exact floating-point tolerances (< 0.0001).'
      },
      {
        feature_id: 'FEAT-CORE-02',
        name: 'Procedural Constructive Solid Geometry (CSG) Engine',
        priority: 'P0_CRITICAL',
        description: 'Binary space partitioning (BSP) tree based boolean operator performing union, difference, and intersection.',
        acceptance_criteria: 'Executes boolean solid operations in < 100ms for standard part primitives.'
      },
      {
        feature_id: 'FEAT-CORE-03',
        name: 'Interactive WebGL Viewport & Orbit Controller',
        priority: 'P0_CRITICAL',
        description: 'Hardware-accelerated 3D viewport with smooth arcball/orbit navigation, wireframe toggle, and normal shading.',
        acceptance_criteria: 'Renders 3D part geometry at steady 60 FPS across viewports.'
      },
      {
        feature_id: 'FEAT-CORE-04',
        name: 'Multi-Format 3D Exporter (STL, OBJ)',
        priority: 'P0_CRITICAL',
        description: 'Manifold mesh serializer generating verified watertight STL and OBJ files ready for 3D printing and fabrication.',
        acceptance_criteria: 'Exported STL validates as 100% manifold with zero degenerate faces.'
      }
    ];

    negativeScope = [
      {
        exclusion_id: 'EXCL-01',
        feature_name: 'Drag-and-Drop File Ingestion Dropzone',
        rationale: 'Procedural CAD generates geometry from code and parametric parameters, not image/media dropzones.'
      },
      {
        exclusion_id: 'EXCL-02',
        feature_name: 'User Account Registration & Password Login',
        rationale: 'Local procedural CAD operates client-side without requiring user authentication.'
      },
      {
        exclusion_id: 'EXCL-03',
        feature_name: 'Cloud-Based Geometry Rendering Farms',
        rationale: 'Client-side WebGL handles geometry computation locally; eliminates cloud compute costs.'
      },
      {
        exclusion_id: 'EXCL-04',
        feature_name: 'Complex Animation & Physics Simulation',
        rationale: 'Focuses strictly on solid geometry and fabrication parts; character animation is out of scope.'
      }
    ];

    userStories = [
      {
        story_id: 'US-01',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'Define parametric 3D solid shapes using mathematical constraints',
        so_that: 'Changing a single dimension recalculates the entire model accurately',
        acceptance_criteria: [
          'Updating a dimension parameter recalculates part geometry in < 50ms.',
          'Mesh preserves exact geometric constraints without distortion.'
        ]
      },
      {
        story_id: 'US-02',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'Inspect my 3D solid model interactively from any angle in WebGL',
        so_that: 'I can verify geometry features, clearances, and intersections visually',
        acceptance_criteria: [
          'Orbit, pan, and zoom controls respond fluidly at 60 FPS.',
          'Wireframe overlay toggles on and off seamlessly.'
        ]
      },
      {
        story_id: 'US-03',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'Export the finished solid part to a watertight STL file',
        so_that: 'I can fabricate the physical part directly via 3D printing or CNC',
        acceptance_criteria: [
          'STL download triggers instantly in browser.',
          'Exported file passes manifold geometry validation checks.'
        ]
      }
    ];

    techSpecs = {
      architecture_blueprint: profile.blueprint || 'webgl-csg-cad',
      processing_location: 'CLIENT_WEBGL_ENGINE',
      supported_formats: ['model/stl', 'model/obj', 'application/json'],
      ui_states_required: ['CANVAS_EMPTY', 'GEOMETRY_READY', 'PROCESSING_BOOLEAN', 'EXPORT_READY']
    };

    successMetrics = [
      'CSG boolean operation latency < 100ms for standard models',
      'Viewport rendering maintained at 60 FPS',
      '100% watertight manifold check pass on exported STL files'
    ];

  } else if (archetype === 'vector-search') {
    mvpScope = [
      {
        feature_id: 'FEAT-CORE-01',
        name: 'In-Memory Hierarchical Navigable Small World (HNSW) Index',
        priority: 'P0_CRITICAL',
        description: 'Graph-based approximate nearest neighbor index supporting multi-layer proximity search with configurable M and efSearch.',
        acceptance_criteria: 'Builds index over 10,000 vectors in < 500ms; achieves > 0.95 recall.'
      },
      {
        feature_id: 'FEAT-CORE-02',
        name: 'Float32 SIMD Vector Math & Distance Calculator',
        priority: 'P0_CRITICAL',
        description: 'Optimized dot product, Euclidean, and Cosine distance kernels leveraging Float32Array typed buffers.',
        acceptance_criteria: 'Computes 10,000 vector distances in < 3ms.'
      },
      {
        feature_id: 'FEAT-CORE-03',
        name: 'Cosine Similarity Nearest Neighbor Ranker & Filter',
        priority: 'P0_CRITICAL',
        description: 'Top-K search query pipeline with predicate attribute filtering over attached metadata.',
        acceptance_criteria: 'Returns ranked Top-K items in < 5ms with similarity scores.'
      },
      {
        feature_id: 'FEAT-CORE-04',
        name: 'Batch Embedding Ingestion & Binary Index Serializer',
        priority: 'P0_CRITICAL',
        description: 'Zero-copy binary index serialization and deserialization for instant loading and saving.',
        acceptance_criteria: 'Serializes/deserializes index to/from Uint8Array buffer in < 50ms.'
      }
    ];

    negativeScope = [
      {
        exclusion_id: 'EXCL-01',
        feature_name: 'Drag-and-Drop File Ingestion Dropzone',
        rationale: 'Vector search engines ingest embedding arrays via API/memory buffers, not image dropzones.'
      },
      {
        exclusion_id: 'EXCL-02',
        feature_name: 'User Account Registration & Password Login',
        rationale: 'Embedded vector index library requires zero user authentication or session management.'
      },
      {
        exclusion_id: 'EXCL-03',
        feature_name: 'Cloud Vector Cluster Replication & Sharding',
        rationale: 'Designed as a lean embedded single-node / edge engine, avoiding cluster synchronization overhead.'
      },
      {
        exclusion_id: 'EXCL-04',
        feature_name: 'Heavy Machine Learning Training Runtimes',
        rationale: 'Consumes pre-computed embeddings; model training runtimes are out of scope.'
      }
    ];

    userStories = [
      {
        story_id: 'US-01',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'Ingest thousands of dense embedding vectors into an in-memory index',
        so_that: 'I can prepare fast local semantic search without cloud dependencies',
        acceptance_criteria: [
          'Given 10,000 vectors (1536-dim), index builds in under 500ms.',
          'Memory footprint remains strictly under 50MB.'
        ]
      },
      {
        story_id: 'US-02',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'Execute Top-K nearest neighbor queries with metadata filtering',
        so_that: 'I receive highly relevant semantic results within milliseconds',
        acceptance_criteria: [
          'Top-10 nearest neighbors returned in < 5ms.',
          'Metadata filter predicates match expected subset.'
        ]
      },
      {
        story_id: 'US-03',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'Save and load the complete vector index to a compact binary file',
        so_that: 'The application boots instantly without rebuilding the index from scratch',
        acceptance_criteria: [
          'Serialized binary buffer reloads in < 50ms.',
          'Search recall on reloaded index matches original index 100%.'
        ]
      }
    ];

    techSpecs = {
      architecture_blueprint: profile.blueprint || 'embedded-hnsw-vector-engine',
      processing_location: 'IN_MEMORY_TYPED_ARRAYS',
      supported_formats: ['application/octet-stream', 'application/json'],
      ui_states_required: ['INDEX_EMPTY', 'INDEX_BUILDING', 'SEARCH_READY', 'SEARCH_EVALUATING']
    };

    successMetrics = [
      'Cosine similarity search latency < 5ms for 10k vectors',
      'Memory footprint < 50MB for standard dataset',
      'Zero external network calls'
    ];

  } else if (archetype === 'cryptographic-tool') {
    mvpScope = [
      {
        feature_id: 'FEAT-CORE-01',
        name: 'Shamir Secret Sharing (k-of-n) Polynomial Splitter & Reconstructor',
        priority: 'P0_CRITICAL',
        description: 'Information-theoretically secure threshold secret sharing implementing Lagrange interpolation over finite Galois Field GF(2^8).',
        acceptance_criteria: 'Splits secret into n shares requiring exactly k to reconstruct; k-1 shares reveal zero information.'
      },
      {
        feature_id: 'FEAT-CORE-02',
        name: 'Argon2id Key Derivation & Passphrase Hardening Pipeline',
        priority: 'P0_CRITICAL',
        description: 'Memory-hard key derivation function with configurable time cost, memory cost, and parallelism to defend against GPU/ASIC attacks.',
        acceptance_criteria: 'Generates hardened 256-bit encryption key with verified Argon2id parameters.'
      },
      {
        feature_id: 'FEAT-CORE-03',
        name: 'Secure Memory Buffer Zeroing & Wipe Subsystem',
        priority: 'P0_CRITICAL',
        description: 'Deterministic memory wiping overwriting sensitive keys, passphrases, and shares with zeros immediately after operation.',
        acceptance_criteria: 'Buffer inspection confirms all intermediate key arrays are zero-filled upon completion.'
      },
      {
        feature_id: 'FEAT-CORE-04',
        name: 'Cryptographic Share Formatter & Checksum Verifier',
        priority: 'P0_CRITICAL',
        description: 'Share serialization with Bech32/Base64 encoding and CRC32 checksum verification to prevent manual transcription errors.',
        acceptance_criteria: 'Rejects corrupted or altered shares with clear integrity error before reconstruction.'
      }
    ];

    negativeScope = [
      {
        exclusion_id: 'EXCL-01',
        feature_name: 'Drag-and-Drop File Ingestion Dropzone',
        rationale: 'Cryptographic CLI tools operate via secure standard input, arguments, or memory pipes, not browser dropzones.'
      },
      {
        exclusion_id: 'EXCL-02',
        feature_name: 'User Account Registration & Password Login',
        rationale: 'Stateless cryptographic utility operates entirely offline; does not persist user accounts or credentials.'
      },
      {
        exclusion_id: 'EXCL-03',
        feature_name: 'Cloud Secret Synchronization & Remote Key Escrow',
        rationale: 'Zero cloud interaction guarantees that cryptographic secrets never leave the local air-gapped machine.'
      },
      {
        exclusion_id: 'EXCL-04',
        feature_name: 'Dynamic Eval or Third-Party Analytics Telemetry',
        rationale: 'Strictly zero telemetry and zero external network calls ensure cryptographic secrecy and auditability.'
      }
    ];

    userStories = [
      {
        story_id: 'US-01',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'Split a sensitive root key into 5 shares with a 3-of-5 recovery threshold',
        so_that: 'No single custodian can compromise the key and disaster recovery is assured',
        acceptance_criteria: [
          'Given a secret string and threshold k=3, n=5, 5 formatted shares are emitted.',
          'Each share contains its index and valid checksum.'
        ]
      },
      {
        story_id: 'US-02',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'Reconstruct the original secret by supplying any 3 valid shares',
        so_that: 'The key is recovered reliably even if 2 shares are lost',
        acceptance_criteria: [
          'Supplying 3 valid shares restores exact original secret string.',
          'Supplying only 2 shares is rejected with threshold deficit error.'
        ]
      },
      {
        story_id: 'US-03',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'Verify that secret memory buffers are wiped immediately from RAM',
        so_that: 'Subsequent heap dumps or memory forensics cannot extract the secret',
        acceptance_criteria: [
          'Memory zeroing routine executes in finally block.',
          'Internal secret Uint8Array memory contains all zeros post-execution.'
        ]
      }
    ];

    techSpecs = {
      architecture_blueprint: profile.blueprint || 'node-crypto-cli',
      processing_location: 'LOCAL_AIRGAPPED_MEMORY',
      supported_formats: ['text/plain', 'application/json'],
      ui_states_required: ['N/A_CLI_TOOL']
    };

    successMetrics = [
      'Secret split and reconstruction execution latency < 50ms',
      '100% memory buffer zeroing verification',
      'Zero network traffic or disk cache residue'
    ];

  } else {
    // Custom Hybrid / Novel Concept
    mvpScope = [
      {
        feature_id: 'FEAT-CORE-01',
        name: 'Structured Ingress & Input Contract Interface',
        priority: 'P0_CRITICAL',
        description: 'Robust input boundary accepting and validating operational parameters matching target user intent.',
        acceptance_criteria: 'Validates input schema and establishes working context in < 100ms.'
      },
      {
        feature_id: 'FEAT-CORE-02',
        name: 'Core Computational Transformation Engine',
        priority: 'P0_CRITICAL',
        description: 'Deterministic computational kernel executing the primary business logic or transformation.',
        acceptance_criteria: 'Executes core transformation deterministically without blocking the runtime.'
      },
      {
        feature_id: 'FEAT-CORE-03',
        name: 'Output Presentation & Result Delivery Surface',
        priority: 'P0_CRITICAL',
        description: 'Clear, accessible delivery of computation results with status feedback and export actions.',
        acceptance_criteria: 'Delivers actionable output with immediate confirmation to the user.'
      },
      {
        feature_id: 'FEAT-CORE-04',
        name: 'State Integrity & Error Boundary Guard',
        priority: 'P0_CRITICAL',
        description: 'Resilient state manager handling unexpected input, network disruptions, or execution errors gracefully.',
        acceptance_criteria: 'Catches runtime anomalies and surfaces accessible, actionable feedback.'
      }
    ];

    negativeScope = [
      {
        exclusion_id: 'EXCL-01',
        feature_name: 'User Account Registration & Password Login',
        rationale: 'Avoids premature user management overhead; focuses strictly on core MVP utility.'
      },
      {
        exclusion_id: 'EXCL-02',
        feature_name: 'Cloud File Storage & Multi-Device Sync',
        rationale: 'Keeps architecture lean and avoids recurring database and storage maintenance liabilities.'
      },
      {
        exclusion_id: 'EXCL-03',
        feature_name: 'Complex Enterprise Role-Based Access Control (RBAC)',
        rationale: 'Premature optimization for initial delivery; adds complexity without proven demand.'
      },
      {
        exclusion_id: 'EXCL-04',
        feature_name: 'Heavy Client Framework Hydration Overhead',
        rationale: 'Zero-hydration or lean client architecture provides faster load times and cleaner performance.'
      }
    ];

    userStories = [
      {
        story_id: 'US-01',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'Initiate core operational workflow with minimal setup',
        so_that: 'I can achieve my objective without navigating through bloated interfaces',
        acceptance_criteria: [
          'Workflow starts immediately upon user action.',
          'Clear visual or machine-readable feedback indicates progress.'
        ]
      },
      {
        story_id: 'US-02',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'Execute computational tasks with deterministic correctness',
        so_that: 'Output results are trustworthy and reproducible',
        acceptance_criteria: [
          'Output matches expected domain criteria.',
          'Execution latency satisfies performance constraints.'
        ]
      },
      {
        story_id: 'US-03',
        as_a: problemRecord.target_user.primary_persona,
        i_want_to: 'Receive clear, actionable feedback if an invalid parameter is provided',
        so_that: 'I can correct the error quickly without guessing',
        acceptance_criteria: [
          'Error details pinpoint the exact issue and suggest correction.',
          'System remains in a stable, recoverable state.'
        ]
      }
    ];

    techSpecs = {
      architecture_blueprint: profile.blueprint || 'lean-modular-architecture',
      processing_location: isClientSidePrivate ? 'CLIENT_BROWSER_ONLY' : 'LOCAL_OR_EDGE_RUNTIME',
      supported_formats: ['application/json', 'text/plain'],
      ui_states_required: ['IDLE', 'RUNNING', 'COMPLETED', 'ERROR']
    };

    successMetrics = [
      'Core task execution latency < 500ms',
      'Zero unnecessary external network transmissions',
      'Lighthouse Performance / Runtime Health score >= 90'
    ];
  }

  return {
    prd_id: `PRD-${slug}`,
    created_at: now,
    archetype,
    product_name: profile.name || problemRecord.problem_statement.slice(0, 32),
    anchored_problem_id: problemRecord.problem_id,
    anchored_feasibility_id: marketFeasibility.feasibility_id,
    core_thesis: marketFeasibility.value_proposition,
    target_persona: problemRecord.target_user.primary_persona,
    mvp_scope: mvpScope,
    negative_scope_exclusions: negativeScope,
    user_stories: userStories,
    technical_specifications: techSpecs,
    success_metrics: successMetrics,
    unspecified_requirements: problemRecord.unspecified_requirements || []
  };
}

/**
 * Recalls active construction intelligence across Domains F, G, H, J, K from the Brain substrate.
 * Implements a Two-Tier Evidence-Grounded recall:
 * - Tier 1: Canonical Domain Intelligence Records (domain-registry.json) -> CANONICAL (Confidence 0.90 - 1.00)
 * - Tier 2: Validated Engineering Patterns (engineering-patterns.md) -> VALIDATED (Confidence 0.80)
 *           Harvested Intelligence Dossiers (07_PROJECT_LEARNING/) -> EXTRACTED (Confidence 0.65)
 * 
 * Strict Invariants:
 * - Zero Auto-Promotion: Does NOT mutate domain-registry.json.
 * - Deduplication across IDs and hashes.
 * - Context token budgeting per domain.
 * - Backward-compatible return structure: guidelines[letter].topItem, .items, .name, .totalFound.
 */
export function recallConstructionDomainGuidelines(customRoot = null, query = '', options = {}) {
  const domainsToQuery = [
    { letter: 'F', name: 'Design' },
    { letter: 'G', name: 'Architecture' },
    { letter: 'H', name: 'Technical Construction' },
    { letter: 'J', name: 'Search & Distribution' },
    { letter: 'K', name: 'Quality & Verification' }
  ];

  const maxTokensPerDomain = options.maxTokensPerDomain || 1200;
  const topK = options.topK || 4;
  const guidelines = {};

  for (const d of domainsToQuery) {
    const seenIds = new Set();
    const tier1Items = [];
    const tier2Items = [];
    let domainTokens = 0;

    // 1. Tier 1: Canonical Domain Intelligence Records (from domain-registry.json)
    let tier1Res = queryDomainIntelligence(d.letter, query, { brainRoot: customRoot });
    if (!tier1Res.results || tier1Res.results.length === 0) {
      tier1Res = queryDomainIntelligence(d.letter, '', { brainRoot: customRoot });
    }
    if (tier1Res.results && tier1Res.results.length > 0) {
      for (const rec of tier1Res.results) {
        const id = rec.record_id || rec.id;
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);

        const estTokens = Math.ceil(((rec.summary || '').length + (rec.title || '').length) / 4);
        const itemObj = {
          ...rec,
          source_id: id,
          record_id: id,
          file_path: '05_KNOWLEDGE/domain-intelligence/domain-registry.json',
          line_range: rec.line_range || [1, 50],
          source_version: rec.source_version || '1.0.0',
          epistemic_state: 'CANONICAL',
          confidence: rec.confidence_score || 0.95,
          applicability: 'MANDATORY_FOUNDATION',
          tier: 1,
          estimated_tokens: estTokens
        };
        tier1Items.push(itemObj);
        domainTokens += estTokens;
      }
    }

    // 2. Tier 2: Empirical Patterns & Harvested Dossiers (via searchBrain)
    try {
      const searchQuery = query && String(query).trim().length > 0 
        ? String(query).trim() 
        : d.name;

      const searchRes = searchBrain(searchQuery, {
        domain: d.letter,
        topK,
        brainRoot: customRoot
      });

      if (searchRes.results && searchRes.results.length > 0) {
        for (const sr of searchRes.results) {
          const id = sr.id || sr.learningId;
          if (!id || seenIds.has(id)) continue;

          let itemObj = null;

          if (sr.category === 'ENGINEERING_PATTERN') {
            const patternText = sr.ruleText || sr.summary || sr.fullContent || '';
            const estTokens = Math.ceil(patternText.length / 4);
            if (domainTokens + estTokens > maxTokensPerDomain && tier2Items.length > 0) {
              continue;
            }

            itemObj = {
              ...sr,
              source_id: sr.id,
              record_id: sr.id,
              title: sr.title,
              summary: sr.summary || sr.ruleText || sr.title,
              content: sr.fullContent || sr.ruleText,
              ruleText: sr.ruleText,
              whyText: sr.whyText,
              whenText: sr.whenText,
              file_path: sr.filePath || '05_KNOWLEDGE/engineering-patterns.md',
              line_range: sr.lineRange || [1, 10],
              source_version: 'CANONICAL_INDEX',
              epistemic_state: 'VALIDATED',
              confidence: 0.80,
              applicability: 'EMPIRICAL_GUIDELINE',
              tier: 2,
              estimated_tokens: estTokens
            };
            seenIds.add(id);
            tier2Items.push(itemObj);
            domainTokens += estTokens;
          } else if (sr.category === 'HARVESTED_INTELLIGENCE_DOSSIER') {
            const relPath = sr.filePath || `07_PROJECT_LEARNING/${sr.slug}-learnings.md`;
            const chunkRes = readDossierTargetedChunks(relPath, query, customRoot);
            const chunkBody = chunkRes.chunks[0] || sr.summary || '';
            const estTokens = Math.ceil(chunkBody.length / 4);
            if (domainTokens + estTokens > maxTokensPerDomain && tier2Items.length > 0) {
              continue;
            }

            itemObj = {
              ...sr,
              source_id: sr.id,
              record_id: sr.id,
              title: sr.title,
              summary: sr.summary,
              content: chunkBody,
              targeted_chunk: chunkBody,
              file_path: relPath,
              line_range: chunkRes.lineRange,
              source_version: 'HARVESTED_DOSSIER',
              epistemic_state: 'EXTRACTED',
              confidence: 0.65,
              applicability: 'REFERENCE_EVIDENCE',
              tier: 2,
              estimated_tokens: estTokens
            };
            seenIds.add(id);
            tier2Items.push(itemObj);
            domainTokens += estTokens;
          } else if (sr.category === 'DOMAIN_INTELLIGENCE') {
            const estTokens = Math.ceil(((sr.summary || '').length + (sr.title || '').length) / 4);
            if (domainTokens + estTokens > maxTokensPerDomain && tier2Items.length > 0) {
              continue;
            }
            itemObj = {
              ...sr,
              source_id: sr.id,
              record_id: sr.id,
              file_path: '05_KNOWLEDGE/domain-intelligence/domain-registry.json',
              line_range: sr.lineRange || [1, 50],
              source_version: '1.0.0',
              epistemic_state: 'CANONICAL',
              confidence: 0.90,
              applicability: 'MANDATORY_FOUNDATION',
              tier: 1,
              estimated_tokens: estTokens
            };
            seenIds.add(id);
            tier1Items.push(itemObj);
            domainTokens += estTokens;
          }
        }
      }
    } catch (err) {
      // Non-blocking retrieval fallback
    }

    const combinedItems = [...tier1Items, ...tier2Items];
    if (combinedItems.length > 0) {
      guidelines[d.letter] = {
        name: d.name,
        letter: d.letter,
        topItem: combinedItems[0],
        totalFound: combinedItems.length,
        items: combinedItems,
        tier1: tier1Items,
        tier2: tier2Items,
        totalTokens: domainTokens
      };
    }
  }

  return guidelines;
}

/**
 * Generates an implementation-ready markdown guide for the AI coder / builder.
 * Incorporates citations for Tier 1 (canonical) and Tier 2 (empirical patterns + dossiers).
 */
export function generateConstructionGuideMarkdown(problemRecord, marketFeasibility, prdSpecification, profile = {}, domainGuidelines = {}) {
  const fDoc = domainGuidelines.F?.topItem;
  const gDoc = domainGuidelines.G?.topItem;
  const hDoc = domainGuidelines.H?.topItem;
  const jDoc = domainGuidelines.J?.topItem;
  const kDoc = domainGuidelines.K?.topItem;

  const fLine = fDoc 
    ? `1. **Design (Domain F — ${fDoc.title})**: ${fDoc.summary} \`[${fDoc.epistemic_state || 'CANONICAL'} | ${fDoc.file_path || 'domain-registry.json'}#L${fDoc.line_range ? fDoc.line_range[0] : 1}]\``
    : `1. **Design (Domain F)**: Apply Tailwind CSS tokens. Enforce mobile-first responsive layout, dark-mode styling, and semantic HTML5 tags.`;

  const gLine = gDoc 
    ? `2. **Architecture (Domain G — ${gDoc.title})**: ${gDoc.summary} \`[${gDoc.epistemic_state || 'CANONICAL'} | ${gDoc.file_path || 'domain-registry.json'}#L${gDoc.line_range ? gDoc.line_range[0] : 1}]\``
    : `2. **Architecture (Domain G)**: Follow Master Brain Engineering Patterns (Rules 1-68+). Ensure clean modular boundaries.`;

  const hLine = hDoc 
    ? `3. **Technical Construction (Domain H — ${hDoc.title})**: ${hDoc.summary} \`[${hDoc.epistemic_state || 'CANONICAL'} | ${hDoc.file_path || 'domain-registry.json'}#L${hDoc.line_range ? hDoc.line_range[0] : 1}]\``
    : `3. **Technical Construction (Domain H)**: Construct deterministic, zero-latency execution pipelines matching product specifications.`;

  const jLine = jDoc 
    ? `4. **SEO & Distribution (Domain J — ${jDoc.title})**: ${jDoc.summary} \`[${jDoc.epistemic_state || 'CANONICAL'} | ${jDoc.file_path || 'domain-registry.json'}#L${jDoc.line_range ? jDoc.line_range[0] : 1}]\``
    : `4. **SEO & Distribution (Domain J)**: Inject OpenGraph metadata, structured JSON-LD schema, canonical URL tags, and self-referential tags.`;

  const kLine = kDoc 
    ? `5. **Verification (Domain K — ${kDoc.title})**: ${kDoc.summary} \`[${kDoc.epistemic_state || 'CANONICAL'} | ${kDoc.file_path || 'domain-registry.json'}#L${kDoc.line_range ? kDoc.line_range[0] : 1}]\``
    : `5. **Verification (Domain K)**: Verify build exit code 0 (\`npm run build\`). Test zero network leaks and runtime assertions.`;

  // Empirical citations section
  const empiricalCitations = [];
  for (const letter of ['F', 'G', 'H', 'J', 'K']) {
    const dGuideline = domainGuidelines[letter];
    if (dGuideline && dGuideline.tier2 && dGuideline.tier2.length > 0) {
      for (const t2 of dGuideline.tier2.slice(0, 2)) {
        empiricalCitations.push(`- **[${t2.epistemic_state}]** \`${t2.source_id}\`: ${t2.title} — *${t2.file_path}#L${t2.line_range[0]}-L${t2.line_range[1]}*`);
      }
    }
  }

  const citationsBlock = empiricalCitations.length > 0
    ? `\n### Empirical Patterns & Harvested Intelligence Citations (Tier 2):\n${empiricalCitations.join('\n')}\n`
    : '';

  // Unspecified requirements section
  const unspecified = prdSpecification.unspecified_requirements || problemRecord.unspecified_requirements || [];
  const unspecifiedBlock = unspecified.length > 0
    ? `\n---\n\n## ❓ 7. Explicitly Unspecified Requirements & Open Decisions\n\n` +
      `The following architectural dimensions were not explicitly bound in the user intent and are tracked as \`UNSPECIFIED\`:\n\n` +
      unspecified.map(u => `- **\`${u.category}\`**: \`${u.status}\` — ${u.guidance}`).join('\n') + '\n'
    : '';

  return `# 🏗️ Construction Intelligence Specification & Blueprint

> **Generated by AI-Builder-Brain Construction Intelligence Engine (CIE)**  
> **Problem ID**: \`${problemRecord.problem_id}\`  
> **PRD ID**: \`${prdSpecification.prd_id}\`  
> **Product Archetype**: \`${prdSpecification.archetype || 'custom-hybrid'}\`  
> **Commercial Feasibility**: **${marketFeasibility.feasibility_verdict}**  
> **Target Profile**: \`${profile.name || 'General Product'}\` (\`${profile.id || 'default'}\`)

---

## 🎯 1. Human Need & Root Cause (Domain A)
- **Problem Statement**: ${problemRecord.problem_statement}
- **Primary Persona**: ${problemRecord.target_user.primary_persona}
- **Context of Use**: ${problemRecord.target_user.context_of_use}

### Identified Pain Points:
${problemRecord.pain_points.map(p => `- ⚠️ ${p}`).join('\n')}

### Hard Invariants & Constraints:
${problemRecord.constraints.map(c => `- 🔒 **Constraint**: ${c}`).join('\n')}

---

## 💡 2. Value Proposition & Commercial Differentiation (Domain C)
- **Core Value Proposition**: ${marketFeasibility.value_proposition}
- **Market Gap**: ${marketFeasibility.market_gaps.join('; ')}
- **Gross Margin Potential**: ${marketFeasibility.hurdle_rate_evaluation.gross_margin_potential}
- **Feasibility Verdict**: **${marketFeasibility.feasibility_verdict}**

---

## 📦 3. Strict MVP Scope — Features to Build (Domain B)

Every developer or AI agent building this product MUST implement ONLY these P0 features:

| Feature ID | Feature Name | Priority | Core Requirement & Acceptance Criteria |
| :--- | :--- | :---: | :--- |
${prdSpecification.mvp_scope.map(f => `| **\`${f.feature_id}\`** | ${f.name} | \`${f.priority}\` | ${f.description} *(${f.acceptance_criteria})* |`).join('\n')}

---

## 🚫 4. Non-Negotiable Negative Scope — What NOT to Build (Domain B)

> [!WARNING]
> **ANTI-BLOAT & ANTI-SCOPE-CREEP MANDATE**:  
> The following features are **STRICTLY EXCLUDED** from the MVP. Implementing any of these without explicit human instruction is a direct specification violation:

| Exclusion ID | Forbidden Feature | Architectural Rationale for Exclusion |
| :--- | :--- | :--- |
${prdSpecification.negative_scope_exclusions.map(e => `| **\`${e.exclusion_id}\`** | **${e.feature_name}** | ${e.rationale} |`).join('\n')}

---

## 👤 5. User Stories & Test Scenarios

${prdSpecification.user_stories.map(u => `### User Story: \`${u.story_id}\`
- **As a**: ${u.as_a}
- **I want to**: ${u.i_want_to}
- **So that**: ${u.so_that}
- **Acceptance Criteria**:
${u.acceptance_criteria.map(a => `  - [ ] ${a}`).join('\n')}
`).join('\n')}

---

## 🛠️ 6. Downstream Construction Guidelines (Domains F, G, H, J, K)
${fLine}
${gLine}
${hLine}
${jLine}
${kLine}
${citationsBlock}${unspecifiedBlock}`;
}

/**
 * Unified Pipeline: Synthesizes the complete construction intelligence package.
 */
export function synthesizeConstructionPackage(intent, profile = {}, options = {}) {
  const masterRoot = options.masterBrainPath || options.brainRoot || null;
  const domainGuidelines = recallConstructionDomainGuidelines(masterRoot, intent, options);
  const problemRecord = synthesizeProblemRecord(intent, profile, options);
  const marketFeasibility = synthesizeMarketFeasibility(problemRecord, profile, options);
  const prdSpecification = synthesizePRDSpecification(problemRecord, marketFeasibility, profile, options);
  const constructionGuideMarkdown = generateConstructionGuideMarkdown(problemRecord, marketFeasibility, prdSpecification, profile, domainGuidelines);

  return {
    problemRecord,
    marketFeasibility,
    prdSpecification,
    constructionGuideMarkdown,
    domainGuidelines
  };
}

/**
 * Emits the construction intelligence package to the project's .project-brain/construction/ directory.
 */
export function emitConstructionIntelligence(targetDir, constructionPackage) {
  const root = path.resolve(targetDir);
  const constructionDir = path.join(root, '.project-brain', 'construction');

  if (!fs.existsSync(constructionDir)) {
    fs.mkdirSync(constructionDir, { recursive: true });
  }

  const writtenFiles = [];

  // 1. problem-record.json (Domain A)
  const probPath = path.join(constructionDir, 'problem-record.json');
  fs.writeFileSync(probPath, JSON.stringify(constructionPackage.problemRecord, null, 2), 'utf-8');
  writtenFiles.push(probPath);

  // 2. business-feasibility.json (Domain C)
  const feasPath = path.join(constructionDir, 'business-feasibility.json');
  fs.writeFileSync(feasPath, JSON.stringify(constructionPackage.marketFeasibility, null, 2), 'utf-8');
  writtenFiles.push(feasPath);

  // 3. prd-specification.json (Domain B)
  const prdPath = path.join(constructionDir, 'prd-specification.json');
  fs.writeFileSync(prdPath, JSON.stringify(constructionPackage.prdSpecification, null, 2), 'utf-8');
  writtenFiles.push(prdPath);

  // 4. CONSTRUCTION_SPECIFICATION.md (Bridge to Domains F, G, H)
  const guidePath = path.join(constructionDir, 'CONSTRUCTION_SPECIFICATION.md');
  fs.writeFileSync(guidePath, constructionPackage.constructionGuideMarkdown, 'utf-8');
  writtenFiles.push(guidePath);

  return writtenFiles;
}
