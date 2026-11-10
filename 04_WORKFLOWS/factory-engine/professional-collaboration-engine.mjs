/**
 * UNIVERSAL PROFESSIONAL COLLABORATION ENGINE (UPCE)
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\professional-collaboration-engine.mjs
 * Purpose: Evolve AI-Builder-Brain into a Universal, Model-Independent, Evidence-Based
 *          Construction Intelligence System containing the collective knowledge, methods,
 *          skills, workflows, tools, decision patterns, and verification practices of
 *          multidisciplinary professionals (Disciplines A through Z).
 * 
 * Invariants:
 * 1. AI THINKS. BRAIN STORES AND SUPPLIES INTELLIGENCE DATA. TOOLS EXECUTE. PRODUCTS CREATE OUTCOMES.
 * 2. 26 Disciplines (A-Z) map additively and modularly into the 13 Canonical Domains (A-M).
 * 3. Roles are structured capability models (responsibilities, skills, tools, decision frameworks,
 *    deliverables, collaboration interfaces, failure modes, security, verification).
 * 4. Deterministic cross-discipline conflict resolution engine balances speed, security,
 *    performance, accessibility, and business viability.
 * 5. Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');
const REGISTRY_DEFAULT_PATH = path.resolve(BRAIN_ROOT, '05_KNOWLEDGE/professional-intelligence/professional-registry.json');

// ---------------------------------------------------------------------------
// 1. Bidirectional Domain <-> Discipline Mapping Taxonomy
// ---------------------------------------------------------------------------

export const DOMAIN_TO_DISCIPLINE_MAP = Object.freeze({
  A: ['P', 'V', 'X'],           // Human & Need -> Psychology/HCI, Accessibility/i18n, Customer Experience
  B: ['A'],                     // Product -> Product & Strategy
  C: ['W'],                     // Market & Business -> Legal & Compliance
  D: ['K', 'L', 'Q', 'Y'],      // Research & Knowledge -> Math, Data, Scientific Research, Industry Verticals
  E: ['H'],                     // Creative -> Graphic Design, Art, Animation
  F: ['G'],                     // Design -> UI/UX, Interaction Design
  G: ['D', 'E', 'F'],           // Architecture -> Systems/Kernel, Distributed Systems, Datastore/Infra
  H: ['B', 'C', 'I', 'J', 'M', 'N'], // Technical Construction -> Fullstack, Mobile/Desktop, 3D, Game, AI, Robotics
  I: ['O'],                     // Content & Information -> Tech Writing & Content Architecture
  J: ['U'],                     // Search & Distribution -> SEO, ASO, Growth
  K: ['R', 'S'],                // Quality & Verification -> Cybersecurity, QA & Reliability
  L: ['T'],                     // Deployment & Operations -> DevOps, SRE, Cloud
  M: ['Z']                      // Feedback & Evolution -> Emerging Disciplines
});

// ---------------------------------------------------------------------------
// 2. Registry Loader & Cache
// ---------------------------------------------------------------------------

let cachedRegistry = null;

export function loadProfessionalRegistry(customPath = null) {
  const filePath = customPath || REGISTRY_DEFAULT_PATH;
  if (cachedRegistry && !customPath) {
    return cachedRegistry;
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`[UPCE] Professional registry not found at: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);

  if (!data.disciplines || typeof data.disciplines !== 'object') {
    throw new Error(`[UPCE] Invalid professional registry format: missing disciplines dictionary.`);
  }

  const disciplineCodes = Object.keys(data.disciplines);
  if (disciplineCodes.length < 26) {
    throw new Error(`[UPCE] Registry incomplete: expected 26 disciplines (A-Z), found ${disciplineCodes.length}`);
  }

  if (!customPath) {
    cachedRegistry = data;
  }
  return data;
}

export function getDisciplineByCode(code, customPath = null) {
  const reg = loadProfessionalRegistry(customPath);
  const upper = String(code || '').toUpperCase().trim();
  const disc = reg.disciplines[upper];
  if (!disc) {
    throw new Error(`[UPCE] Discipline code '${upper}' not recognized in 26-discipline taxonomy.`);
  }
  return disc;
}

export function getDisciplineByName(name, customPath = null) {
  const reg = loadProfessionalRegistry(customPath);
  const lower = String(name || '').toLowerCase().trim();
  for (const [code, disc] of Object.entries(reg.disciplines)) {
    if (disc.name.toLowerCase() === lower || disc.name.toLowerCase().includes(lower)) {
      return disc;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 3. Automated Discipline Inference Engine
// ---------------------------------------------------------------------------

export const BASELINE_UNIVERSAL_DISCIPLINES = Object.freeze(['A', 'B', 'G', 'S', 'O']);

const DISCIPLINE_TRIGGERS = [
  { code: 'A', keywords: ['product', 'business', 'strategy', 'roadmap', 'revenue', 'monetize', 'saas', 'user', 'value', 'kpi', 'okr'] },
  { code: 'B', keywords: ['web', 'frontend', 'backend', 'fullstack', 'api', 'server', 'database', 'rest', 'graphql', 'app', 'code', 'ui'] },
  { code: 'C', keywords: ['mobile', 'ios', 'android', 'react native', 'flutter', 'desktop', 'electron', 'tauri', 'native app'] },
  { code: 'D', keywords: ['os', 'kernel', 'embedded', 'compiler', 'driver', 'firmware', 'c++', 'rust', 'c99', 'assembly', 'posix', 'rtos', 'systems'] },
  { code: 'E', keywords: ['microservices', 'distributed', 'event-driven', 'kafka', 'consensus', 'raft', 'sharding', 'high-throughput', 'cluster', 'p2p'] },
  { code: 'F', keywords: ['database', 'postgres', 'sql', 'nosql', 'redis', 'cache', 'storage', 'schema', 'replication', 'acid', 'indexing', 'sqlite'] },
  { code: 'G', keywords: ['ui', 'ux', 'user experience', 'interaction', 'figma', 'design system', 'wireframe', 'workflow', 'ergonomics', 'prototype'] },
  { code: 'H', keywords: ['brand', 'graphic', 'logo', 'illustration', 'vector', 'animation', 'typography', 'visual asset', 'iconography', 'identity'] },
  { code: 'I', keywords: ['3d', 'webgl', 'three.js', 'shader', 'physics', 'simulation', 'opengl', 'vulkan', 'rendering', 'cad', 'gpu', 'mesh', 'blender'] },
  { code: 'J', keywords: ['game', 'gameplay', 'mechanics', 'level design', 'game ai', 'npc', 'unity', 'unreal', 'godot', 'roguelike', 'arcade', 'rpg'] },
  { code: 'K', keywords: ['algorithm', 'math', 'statistics', 'optimization', 'linear algebra', 'numerical', 'cryptography', 'scientific computing', 'solver'] },
  { code: 'L', keywords: ['data pipeline', 'etl', 'elt', 'analytics', 'warehouse', 'snowflake', 'spark', 'dbt', 'lakehouse', 'bi', 'telemetry', 'dashboards'] },
  { code: 'M', keywords: ['ai', 'llm', 'machine learning', 'deep learning', 'embeddings', 'rag', 'neural network', 'inference', 'fine-tuning', 'prompt', 'model'] },
  { code: 'N', keywords: ['robotics', 'automation', 'ros', 'sensors', 'actuator', 'lidar', 'computer vision', 'slam', 'hardware-in-the-loop', 'iot'] },
  { code: 'O', keywords: ['documentation', 'technical writing', 'api docs', 'guides', 'manual', 'release notes', 'architecture overview', 'tutorials'] },
  { code: 'P', keywords: ['psychology', 'behavior', 'habit', 'cognitive', 'nudge', 'gamification', 'mental model', 'retention mechanics', 'motivation'] },
  { code: 'Q', keywords: ['research', 'scientific method', 'hypothesis', 'experiment', 'literature review', 'knowledge graph', 'ontology', 'corroboration'] },
  { code: 'R', keywords: ['security', 'cybersecurity', 'privacy', 'auth', 'oauth', 'jwt', 'encryption', 'vulnerability', 'owasp', 'threat model', 'penetration', 'secret'] },
  { code: 'S', keywords: ['qa', 'test', 'testing', 'unit test', 'integration test', 'end-to-end', 'playwright', 'reliability', 'performance benchmark', 'chaos'] },
  { code: 'T', keywords: ['devops', 'sre', 'ci/cd', 'docker', 'kubernetes', 'cloud', 'aws', 'gcp', 'terraform', 'monitoring', 'observability', 'uptime', 'helm'] },
  { code: 'U', keywords: ['seo', 'aso', 'growth', 'marketing', 'conversion', 'acquisition', 'social share', 'open graph', 'sitemap', 'viral loop'] },
  { code: 'V', keywords: ['accessibility', 'a11y', 'wcag', 'screen reader', 'aria', 'i18n', 'internationalization', 'l10n', 'translation', 'rtl'] },
  { code: 'W', keywords: ['legal', 'license', 'compliance', 'gdpr', 'ccpa', 'hipaa', 'soc2', 'pci-dss', 'terms of service', 'copyright', 'privacy policy'] },
  { code: 'X', keywords: ['customer experience', 'support', 'help desk', 'ticketing', 'community', 'customer journey', 'onboarding', 'csat', 'feedback loop'] },
  { code: 'Y', keywords: ['healthcare', 'fintech', 'edtech', 'proptech', 'logistics', 'biotech', 'automotive', 'telecom', 'defense', 'retail', 'vertical'] },
  { code: 'Z', keywords: ['emerging', 'future tech', 'quantum', 'spatial computing', 'bci', 'decentralized autonomous', 'meta-discipline'] }
];

/**
 * Automatically infers all required multidisciplinary disciplines based on the product goal and intent.
 * 
 * @param {string} productGoal - High-level intent or product description
 * @param {object} intentAnalysis - Optional parsed intent (executionEnvironment, etc.)
 * @returns {Array<object>} List of activated disciplines with assigned roles and weights
 */
export function inferRequiredDisciplines(productGoal = '', intentAnalysis = {}) {
  const reg = loadProfessionalRegistry();
  const text = `${productGoal} ${JSON.stringify(intentAnalysis || {})}`.toLowerCase();

  const activatedCodes = new Set(BASELINE_UNIVERSAL_DISCIPLINES);

  // Trigger matching
  for (const trigger of DISCIPLINE_TRIGGERS) {
    for (const kw of trigger.keywords) {
      const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(text)) {
        activatedCodes.add(trigger.code);
        break;
      }
    }
  }

  // Domain & archetype hints
  if (intentAnalysis.executionEnvironment === 'CLIENT_BROWSER_ONLY') {
    activatedCodes.add('B'); // Frontend
    activatedCodes.add('G'); // UI/UX
  } else if (intentAnalysis.executionEnvironment === 'CLI_LOCAL_RUNTIME') {
    activatedCodes.add('D'); // Systems/CLI
    activatedCodes.add('O'); // Tech writing
  } else if (intentAnalysis.executionEnvironment === 'HEADLESS_SERVER_OR_EDGE') {
    activatedCodes.add('B'); // Backend
    activatedCodes.add('E'); // Distributed / API
    activatedCodes.add('R'); // Security
  } else if (intentAnalysis.executionEnvironment === 'FULLSTACK_CLOUD_MANAGED') {
    activatedCodes.add('B'); // Fullstack
    activatedCodes.add('F'); // Database
    activatedCodes.add('T'); // DevOps/Cloud
    activatedCodes.add('R'); // Security
  }

  // Regulated / High-risk domain inferences
  if (/\b(health|patient|medical|hipaa|doctor|clinic)\b/i.test(text)) {
    activatedCodes.add('W'); // Legal/Compliance
    activatedCodes.add('R'); // Security/Privacy
    activatedCodes.add('Y'); // Industry Vertical
  }
  if (/\b(finance|payment|wallet|ledger|bank|crypto|stripe|transaction|money)\b/i.test(text)) {
    activatedCodes.add('W'); // Compliance/PCI
    activatedCodes.add('R'); // Security/Crypto
    activatedCodes.add('K'); // Math/Algorithms
    activatedCodes.add('Y'); // FinTech Vertical
  }
  if (/\b(3d|game|canvas|gl|simulation|engine)\b/i.test(text)) {
    activatedCodes.add('I'); // 3D/Graphics
    activatedCodes.add('J'); // Game Dev
    activatedCodes.add('K'); // Math/Physics
  }

  // Compile full discipline models
  const result = [];
  for (const code of Array.from(activatedCodes).sort()) {
    const disc = reg.disciplines[code];
    if (disc) {
      result.push({
        code: disc.code,
        name: disc.name,
        primary_domain: disc.primary_domain,
        secondary_domains: disc.secondary_domains,
        selected_role: disc.roles[0] || null,
        is_baseline: BASELINE_UNIVERSAL_DISCIPLINES.includes(code)
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// 4. Multidisciplinary Workstream Decomposition (DAG)
// ---------------------------------------------------------------------------

export const WORKSTREAM_PHASES = Object.freeze([
  '01_DISCOVERY_AND_FEASIBILITY',
  '02_DESIGN_AND_COGNITIVE_EXPERIENCE',
  '03_SYSTEM_AND_DATA_ARCHITECTURE',
  '04_TECHNICAL_IMPLEMENTATION',
  '05_QUALITY_SECURITY_COMPLIANCE_GATE',
  '06_DEPLOYMENT_GROWTH_OPERATIONS'
]);

/**
 * Decomposes required disciplines into sequential, dependency-aware workstreams.
 * 
 * @param {Array<object>} activeDisciplines - Inferred discipline list
 * @param {object} semanticPackage - Optional context/package
 * @returns {Array<object>} Ordered workstream tasks with inputs/outputs
 */
export function decomposeMultidisciplinaryWorkstreams(activeDisciplines = [], semanticPackage = {}) {
  const codes = new Set(activeDisciplines.map(d => d.code));
  const workstreams = [];

  // Phase 1: Discovery & Feasibility
  if (codes.has('A')) {
    workstreams.push({
      id: 'WS-01-PRODUCT-STRATEGY',
      phase: '01_DISCOVERY_AND_FEASIBILITY',
      discipline_code: 'A',
      discipline_name: 'Product, Business, Strategy and Management',
      role: 'Principal Product Manager',
      action: 'Formulate comprehensive Product Requirements Document (PRD) with negative scope',
      inputs_required: ['User Need & Raw Concept'],
      deliverables: ['PRD.md', 'KPI-Dashboard-Spec.md', 'Negative-Scope-Register.md'],
      dependencies: []
    });
  }
  if (codes.has('Q')) {
    workstreams.push({
      id: 'WS-01-SCIENTIFIC-RESEARCH',
      phase: '01_DISCOVERY_AND_FEASIBILITY',
      discipline_code: 'Q',
      discipline_name: 'Research, Scientific Methods and Knowledge Engineering',
      role: 'Principal Knowledge Engineer & Scientific Methodologist',
      action: 'Conduct state-of-the-art literature and competitive algorithm survey',
      inputs_required: ['User Need & Domain Concept'],
      deliverables: ['Research-Dossier.md', 'State-Of-The-Art-Summary.md'],
      dependencies: []
    });
  }
  if (codes.has('W')) {
    workstreams.push({
      id: 'WS-01-LEGAL-COMPLIANCE-PREFLIGHT',
      phase: '01_DISCOVERY_AND_FEASIBILITY',
      discipline_code: 'W',
      discipline_name: 'Legal, Licensing, Compliance and Regulatory Expertise',
      role: 'Principal Technology Compliance & Licensing Counsel',
      action: 'Establish regulatory requirements (GDPR/HIPAA/PCI) and licensing guardrails',
      inputs_required: ['PRD.md'],
      deliverables: ['Compliance-Matrix.md', 'Data-Privacy-Impact-Assessment.md'],
      dependencies: ['WS-01-PRODUCT-STRATEGY']
    });
  }

  // Phase 2: Design & Cognitive Experience
  if (codes.has('G')) {
    workstreams.push({
      id: 'WS-02-UX-DESIGN',
      phase: '02_DESIGN_AND_COGNITIVE_EXPERIENCE',
      discipline_code: 'G',
      discipline_name: 'UI/UX, Interaction and Product Design',
      role: 'Lead Product & Interaction Designer',
      action: 'Design user journey maps, interaction patterns, and design system tokens',
      inputs_required: ['PRD.md'],
      deliverables: ['User-Journey-Flow.md', 'Design-Tokens.json', 'Wireframe-Spec.md'],
      dependencies: ['WS-01-PRODUCT-STRATEGY']
    });
  }
  if (codes.has('P')) {
    workstreams.push({
      id: 'WS-02-BEHAVIORAL-HCI',
      phase: '02_DESIGN_AND_COGNITIVE_EXPERIENCE',
      discipline_code: 'P',
      discipline_name: 'Psychology, Sociology, Human Behaviour and Human-Computer Interaction',
      role: 'Staff Behavioral Scientist & Cognitive Ergonomist',
      action: 'Optimize cognitive load, onboarding ergonomics, and behavioral retention mechanics',
      inputs_required: ['User-Journey-Flow.md'],
      deliverables: ['Cognitive-Ergonomics-Assessment.md'],
      dependencies: ['WS-02-UX-DESIGN']
    });
  }
  if (codes.has('H')) {
    workstreams.push({
      id: 'WS-02-BRAND-VISUAL',
      phase: '02_DESIGN_AND_COGNITIVE_EXPERIENCE',
      discipline_code: 'H',
      discipline_name: 'Graphic Design, Digital Art, Illustration and Animation',
      role: 'Creative Brand & Visual Director',
      action: 'Produce design identity, brand iconography, and typography standards',
      inputs_required: ['PRD.md'],
      deliverables: ['Brand-Guidelines.md', 'Asset-Manifest.json'],
      dependencies: ['WS-01-PRODUCT-STRATEGY']
    });
  }
  if (codes.has('V')) {
    workstreams.push({
      id: 'WS-02-ACCESSIBILITY-PREFLIGHT',
      phase: '02_DESIGN_AND_COGNITIVE_EXPERIENCE',
      discipline_code: 'V',
      discipline_name: 'Accessibility, Localization and Internationalization',
      role: 'Staff Accessibility (a11y) & Internationalization (i18n) Lead',
      action: 'Establish WCAG 2.1 AA/AAA compliance checklist and RTL/i18n strings architecture',
      inputs_required: ['Design-Tokens.json'],
      deliverables: ['Accessibility-Guidelines.md', 'i18n-Locale-Registry.json'],
      dependencies: ['WS-02-UX-DESIGN']
    });
  }

  // Phase 3: System & Data Architecture
  if (codes.has('E')) {
    workstreams.push({
      id: 'WS-03-DISTRIBUTED-ARCHITECTURE',
      phase: '03_SYSTEM_AND_DATA_ARCHITECTURE',
      discipline_code: 'E',
      discipline_name: 'Software Architecture and Distributed Systems',
      role: 'Staff Distributed Systems Architect',
      action: 'Synthesize system topology, service boundaries, and event/RPC communication protocols',
      inputs_required: ['PRD.md', 'Design-Tokens.json'],
      deliverables: ['System-Architecture-RFC.md', 'Service-Topology.json'],
      dependencies: ['WS-01-PRODUCT-STRATEGY']
    });
  }
  if (codes.has('F')) {
    workstreams.push({
      id: 'WS-03-DATASTORE-ARCHITECTURE',
      phase: '03_SYSTEM_AND_DATA_ARCHITECTURE',
      discipline_code: 'F',
      discipline_name: 'Database, Storage, Networking and Infrastructure',
      role: 'Principal Datastore & Infrastructure Engineer',
      action: 'Architect relational schema, index layouts, caching topologies, and migration scripts',
      inputs_required: ['System-Architecture-RFC.md'],
      deliverables: ['Database-Schema.sql', 'Cache-Strategy.md'],
      dependencies: ['WS-03-DISTRIBUTED-ARCHITECTURE']
    });
  }
  if (codes.has('K')) {
    workstreams.push({
      id: 'WS-03-ALGORITHM-ENGINEERING',
      phase: '03_SYSTEM_AND_DATA_ARCHITECTURE',
      discipline_code: 'K',
      discipline_name: 'Mathematics, Statistics, Algorithms and Scientific Computing',
      role: 'Principal Algorithm & Optimization Scientist',
      action: 'Formulate core computational algorithms, mathematical invariants, and complexity proofs',
      inputs_required: ['PRD.md'],
      deliverables: ['Algorithm-Specification.md', 'Complexity-Analysis.md'],
      dependencies: ['WS-01-PRODUCT-STRATEGY']
    });
  }

  // Phase 4: Technical Implementation
  if (codes.has('B')) {
    workstreams.push({
      id: 'WS-04-FULLSTACK-CONSTRUCTION',
      phase: '04_TECHNICAL_IMPLEMENTATION',
      discipline_code: 'B',
      discipline_name: 'Frontend, Backend and Full-Stack Engineering',
      role: 'Staff Full-Stack Software Engineer',
      action: 'Construct type-safe application surfaces, backend controllers, and responsive views',
      inputs_required: ['Design-Tokens.json', 'Database-Schema.sql', 'Service-Topology.json'],
      deliverables: ['src/app.mjs', 'src/controllers.mjs', 'src/views.mjs'],
      dependencies: ['WS-02-UX-DESIGN', 'WS-03-DISTRIBUTED-ARCHITECTURE', 'WS-03-DATASTORE-ARCHITECTURE']
    });
  }
  if (codes.has('C')) {
    workstreams.push({
      id: 'WS-04-MOBILE-DESKTOP-CONSTRUCTION',
      phase: '04_TECHNICAL_IMPLEMENTATION',
      discipline_code: 'C',
      discipline_name: 'Mobile, Desktop, Web and Application Engineering',
      role: 'Lead Mobile & Desktop Application Engineer',
      action: 'Construct cross-platform client package, native bindings, and local state sync',
      inputs_required: ['Design-Tokens.json', 'Service-Topology.json'],
      deliverables: ['client/mobile-client.mjs', 'client/offline-cache.mjs'],
      dependencies: ['WS-02-UX-DESIGN', 'WS-03-DISTRIBUTED-ARCHITECTURE']
    });
  }
  if (codes.has('D')) {
    workstreams.push({
      id: 'WS-04-SYSTEMS-KERNEL-CONSTRUCTION',
      phase: '04_TECHNICAL_IMPLEMENTATION',
      discipline_code: 'D',
      discipline_name: 'Systems, OS, Kernel, Compiler and Embedded Engineering',
      role: 'Principal Systems & Kernel Engineer',
      action: 'Construct low-level runtime engine, POSIX adapters, and memory-safe abstractions',
      inputs_required: ['Service-Topology.json'],
      deliverables: ['sys/runtime-core.mjs', 'sys/memory-manager.mjs'],
      dependencies: ['WS-03-DISTRIBUTED-ARCHITECTURE']
    });
  }
  if (codes.has('I')) {
    workstreams.push({
      id: 'WS-04-GRAPHICS-SIMULATION',
      phase: '04_TECHNICAL_IMPLEMENTATION',
      discipline_code: 'I',
      discipline_name: '2D/3D Graphics, Rendering, Physics and Simulation',
      role: 'Staff Graphics & Simulation Engineer',
      action: 'Construct WebGL rendering pipeline, scene graphs, particle shaders, and physics loop',
      inputs_required: ['Design-Tokens.json', 'Algorithm-Specification.md'],
      deliverables: ['src/rendering/scene-engine.mjs', 'src/rendering/shaders.mjs'],
      dependencies: ['WS-02-UX-DESIGN', 'WS-03-ALGORITHM-ENGINEERING']
    });
  }
  if (codes.has('J')) {
    workstreams.push({
      id: 'WS-04-GAME-SYSTEMS',
      phase: '04_TECHNICAL_IMPLEMENTATION',
      discipline_code: 'J',
      discipline_name: 'Game Design, Game Development and Game AI',
      role: 'Lead Game Designer & Systems Engineer',
      action: 'Construct game loop, ECS (Entity Component System), input mappings, and game AI state machine',
      inputs_required: ['Algorithm-Specification.md', 'src/rendering/scene-engine.mjs'],
      deliverables: ['src/game/ecs-world.mjs', 'src/game/state-machine.mjs'],
      dependencies: ['WS-04-GRAPHICS-SIMULATION']
    });
  }
  if (codes.has('M')) {
    workstreams.push({
      id: 'WS-04-AI-LLM-INTEGRATION',
      phase: '04_TECHNICAL_IMPLEMENTATION',
      discipline_code: 'M',
      discipline_name: 'Artificial Intelligence, Machine Learning and LLM Engineering',
      role: 'Principal AI & LLM Systems Engineer',
      action: 'Construct multi-provider LLM connector, prompt orchestrator, and semantic embedding store',
      inputs_required: ['Service-Topology.json'],
      deliverables: ['src/ai/llm-orchestrator.mjs', 'src/ai/vector-store.mjs'],
      dependencies: ['WS-03-DISTRIBUTED-ARCHITECTURE']
    });
  }
  if (codes.has('O')) {
    workstreams.push({
      id: 'WS-04-TECHNICAL-DOCUMENTATION',
      phase: '04_TECHNICAL_IMPLEMENTATION',
      discipline_code: 'O',
      discipline_name: 'Content Strategy, Technical Writing, Editing and Storytelling',
      role: 'Staff Technical Writer & Content Architect',
      action: 'Author API specifications, operator manuals, getting-started guides, and release notes',
      inputs_required: ['PRD.md', 'src/app.mjs'],
      deliverables: ['README.md', 'API-REFERENCE.md', 'USER-GUIDE.md'],
      dependencies: ['WS-01-PRODUCT-STRATEGY']
    });
  }

  // Phase 5: Quality, Security & Compliance Gate
  if (codes.has('R')) {
    workstreams.push({
      id: 'WS-05-SECURITY-PRIVACY-AUDIT',
      phase: '05_QUALITY_SECURITY_COMPLIANCE_GATE',
      discipline_code: 'R',
      discipline_name: 'Cybersecurity, Privacy and Safety Engineering',
      role: 'Principal Cybersecurity & Privacy Architect',
      action: 'Execute STRIDE threat modeling, dependency vulnerability scan, and SAST penetration tests',
      inputs_required: ['src/app.mjs', 'Service-Topology.json'],
      deliverables: ['Threat-Model-Audit.md', 'Security-Attestation.json'],
      dependencies: ['WS-04-FULLSTACK-CONSTRUCTION']
    });
  }
  if (codes.has('S')) {
    workstreams.push({
      id: 'WS-05-QA-RELIABILITY-TESTING',
      phase: '05_QUALITY_SECURITY_COMPLIANCE_GATE',
      discipline_code: 'S',
      discipline_name: 'QA, Testing, Reliability and Performance Engineering',
      role: 'Staff QA & Reliability Systems Engineer',
      action: 'Execute unit, integration, and end-to-end regression suites asserting 0 defect tolerance',
      inputs_required: ['src/app.mjs', 'PRD.md'],
      deliverables: ['test-results.json', 'Test-Ledger.md', 'Performance-Benchmark.json'],
      dependencies: ['WS-04-FULLSTACK-CONSTRUCTION']
    });
  }

  // Phase 6: Deployment, Growth & Operations
  if (codes.has('T')) {
    workstreams.push({
      id: 'WS-06-DEVOPS-SRE-OPERATIONS',
      phase: '06_DEPLOYMENT_GROWTH_OPERATIONS',
      discipline_code: 'T',
      discipline_name: 'DevOps, SRE, Cloud and Deployment Operations',
      role: 'Principal Site Reliability & Cloud Architect',
      action: 'Formulate immutable container definition, CI/CD pipeline, and observability telemetry',
      inputs_required: ['src/app.mjs', 'Security-Attestation.json'],
      deliverables: ['Dockerfile', 'ci-workflow.yml', 'Healthcheck-Spec.json'],
      dependencies: ['WS-05-SECURITY-PRIVACY-AUDIT', 'WS-05-QA-RELIABILITY-TESTING']
    });
  }
  if (codes.has('U')) {
    workstreams.push({
      id: 'WS-06-GROWTH-DISTRIBUTION',
      phase: '06_DEPLOYMENT_GROWTH_OPERATIONS',
      discipline_code: 'U',
      discipline_name: 'SEO, ASO, Growth and Distribution',
      role: 'Director of Growth & Technical Distribution',
      action: 'Verify OpenGraph tags, dynamic sitemaps, structured data markup, and conversion funnel tags',
      inputs_required: ['src/app.mjs', 'PRD.md'],
      deliverables: ['sitemap.xml', 'SEO-Metadata-Spec.json'],
      dependencies: ['WS-04-FULLSTACK-CONSTRUCTION']
    });
  }

  // Topological sorting verification: ensure all declared dependencies exist or are gracefully pruned
  const registeredIds = new Set(workstreams.map(w => w.id));
  for (const ws of workstreams) {
    ws.dependencies = ws.dependencies.filter(depId => registeredIds.has(depId));
  }

  return workstreams;
}

// ---------------------------------------------------------------------------
// 5. Cross-Discipline Conflict Resolution Engine
// ---------------------------------------------------------------------------

export const RESOLUTION_POLICIES = Object.freeze({
  SECURITY_OVER_SPEED: {
    name: 'Security & Safety First',
    rule: 'Never bypass cryptographic validation, sanitized inputs, or permission checks for time-to-market.'
  },
  EMPIRICAL_TESTING_OVER_ASSUMPTION: {
    name: 'Empirical Proof Invariant',
    rule: 'Claims of correctness without automated test execution (Exit Code 0) are strictly rejected.'
  },
  ACCESSIBILITY_OVER_AESTHETICS: {
    name: 'Universal Usability Invariant',
    rule: 'Visual design choices that violate WCAG 2.1 AA minimum contrast or keyboard navigability must be modified.'
  },
  DATA_MINIMIZATION_OVER_ANALYTICS: {
    name: 'Privacy by Design',
    rule: 'Telemetry must collect the minimal necessary metrics with zero PII leakage.'
  },
  PRESERVATION_OVER_DESTRUCTION: {
    name: 'Repository Safety Invariant',
    rule: 'Never overwrite unrequested user modifications or execute destructive repository operations.'
  }
});

/**
 * Resolves standard trade-offs between competing multidisciplinary priorities.
 * 
 * @param {Array<object>} activeDisciplines - Participating disciplines
 * @param {object} context - Project context
 * @returns {Array<object>} Resolved conflicts with trade-off rationale
 */
export function resolveCrossDisciplineConflicts(activeDisciplines = [], context = {}) {
  const codes = new Set(activeDisciplines.map(d => d.code));
  const resolutions = [];

  // Trade-off 1: Security (R) vs Development Velocity (B)
  if (codes.has('R') && codes.has('B')) {
    resolutions.push({
      conflict_id: 'CONF-01-SEC-VS-VELOCITY',
      topic: 'Rapid Delivery vs Security Auditing',
      disciplines_involved: ['B', 'R'],
      competing_claims: {
        'B': 'Wants rapid deployment and minimal friction in package dependencies.',
        'R': 'Requires strict dependency locking, SAST scans, and zero high/critical CVEs.'
      },
      resolved_decision: 'Automated CI Security Gate with cached lockfile audits.',
      policy_applied: RESOLUTION_POLICIES.SECURITY_OVER_SPEED.name,
      residual_risk: 'Minor developer friction during new package additions; completely mitigates supply-chain risks.',
      governing_action: 'Enforce npm audit / cargo audit in build phase with zero-bypass policy.'
    });
  }

  // Trade-off 2: UI/UX & Graphics (G, I, H) vs Performance & Bundle Size (B, S)
  if ((codes.has('G') || codes.has('I') || codes.has('H')) && (codes.has('B') || codes.has('S'))) {
    resolutions.push({
      conflict_id: 'CONF-02-VISUAL-VS-PERFORMANCE',
      topic: 'Visual Richness / 3D Fidelity vs Web Vitals Performance',
      disciplines_involved: ['G', 'I', 'H', 'B', 'S'],
      competing_claims: {
        'G/I/H': 'Desires high-resolution textures, rich animations, and complex shaders.',
        'B/S': 'Requires Sub-100ms LCP, <50KB initial payload, and stable 60fps on mobile.'
      },
      resolved_decision: 'Progressive LOD (Level of Detail), lazy-loading of 3D assets, and WebP/AVIF asset optimization.',
      policy_applied: 'Adaptive Degradation & Performance Budgets',
      residual_risk: 'Older devices render simplified fallback visuals; ensures zero crash rate.',
      governing_action: 'Automated bundle size checks in test suite (assert max initial bundle <= 150KB).'
    });
  }

  // Trade-off 3: Growth / Telemetry (U, A) vs Privacy & Compliance (W, R)
  if ((codes.has('U') || codes.has('A')) && (codes.has('W') || codes.has('R'))) {
    resolutions.push({
      conflict_id: 'CONF-03-TELEMETRY-VS-PRIVACY',
      topic: 'Aggressive Product Analytics vs Data Privacy Compliance',
      disciplines_involved: ['A', 'U', 'W', 'R'],
      competing_claims: {
        'A/U': 'Desires granular user tracking, session replays, and attribution data.',
        'W/R': 'Mandates GDPR/CCPA compliance, zero third-party cookie trackers, and user consent gates.'
      },
      resolved_decision: 'Cookieless, anonymized event tracking with explicit opt-in for telemetry.',
      policy_applied: RESOLUTION_POLICIES.DATA_MINIMIZATION_OVER_ANALYTICS.name,
      residual_risk: 'Loss of cross-site re-targeting capability; 100% legal immunity against regulatory fines.',
      governing_action: 'Anonymize IP addresses and salt hashed session identifiers client-side.'
    });
  }

  // Trade-off 4: Feature Richness (A, B) vs Accessibility (V)
  if ((codes.has('A') || codes.has('B')) && codes.has('V')) {
    resolutions.push({
      conflict_id: 'CONF-04-COMPLEX-WIDGETS-VS-A11Y',
      topic: 'Custom Interactive Canvas Widgets vs Screen-Reader Accessibility',
      disciplines_involved: ['B', 'V'],
      competing_claims: {
        'B': 'Custom interactive canvas/WebGL controls offer sleek proprietary UX.',
        'V': 'Screen readers cannot parse raw canvas pixels without semantic DOM mirrors.'
      },
      resolved_decision: 'Accessible DOM fallback mirror alongside canvas rendering.',
      policy_applied: RESOLUTION_POLICIES.ACCESSIBILITY_OVER_AESTHETICS.name,
      residual_risk: 'Additional 10-15% code footprint for semantic shadow DOM; achieves WCAG AA rating.',
      governing_action: 'Ensure aria-live regions and keyboard focus traps are empirically tested.'
    });
  }

  return resolutions;
}

// ---------------------------------------------------------------------------
// 6. Collaboration Manifest Synthesis
// ---------------------------------------------------------------------------

/**
 * Synthesizes the full Multidisciplinary Professional Collaboration Manifest.
 * 
 * @param {string} productGoal - High level goal
 * @param {Array<object>} activeDisciplines - Participating disciplines
 * @param {Array<object>} workstreams - Planned workstreams
 * @param {Array<object>} conflictResolutions - Resolved conflicts
 * @param {object} options - Extra parameters
 * @returns {object} Manifest specification
 */
export function synthesizeProfessionalCollaborationManifest(
  productGoal = '',
  activeDisciplines = [],
  workstreams = [],
  conflictResolutions = [],
  options = {}
) {
  const reg = loadProfessionalRegistry();
  const timestamp = new Date().toISOString();
  const manifestId = `MANIFEST-UPI-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  // Compute 13-Domain representation summary
  const domainCoverage = {};
  for (const d of activeDisciplines) {
    const dom = d.primary_domain;
    if (!domainCoverage[dom]) domainCoverage[dom] = [];
    domainCoverage[dom].push(d.code);
  }

  // Compute all deliverables
  const expectedDeliverables = [];
  for (const ws of workstreams) {
    for (const del of ws.deliverables) {
      expectedDeliverables.push({
        workstream_id: ws.id,
        discipline_code: ws.discipline_code,
        role: ws.role,
        deliverable_name: del,
        phase: ws.phase
      });
    }
  }

  return {
    manifest_id: manifestId,
    mission: 'UPI-001: Universal Professional Intelligence Expansion',
    product_goal: productGoal,
    generated_at: timestamp,
    governing_axiom: 'AI THINKS. BRAIN STORES AND SUPPLIES INTELLIGENCE DATA. TOOLS EXECUTE. PRODUCTS CREATE OUTCOMES.',
    version: '1.0.0',
    metrics: {
      total_active_disciplines: activeDisciplines.length,
      total_workstreams: workstreams.length,
      total_expected_deliverables: expectedDeliverables.length,
      total_conflicts_resolved: conflictResolutions.length,
      canonical_domains_covered: Object.keys(domainCoverage).sort()
    },
    active_disciplines: activeDisciplines,
    domain_coverage_map: domainCoverage,
    workstream_dag: workstreams,
    cross_discipline_conflict_resolutions: conflictResolutions,
    expected_deliverables: expectedDeliverables
  };
}

/**
 * Emits the Collaboration Manifest to disk as JSON and Markdown.
 * 
 * @param {object} manifest - The synthesized manifest
 * @param {string} targetDir - Destination directory
 * @returns {object} Emitted paths
 */
export function emitProfessionalCollaborationManifest(manifest, targetDir = BRAIN_ROOT) {
  const constructionDir = path.resolve(targetDir, '.project-brain', 'construction');
  if (!fs.existsSync(constructionDir)) {
    fs.mkdirSync(constructionDir, { recursive: true });
  }

  const jsonPath = path.resolve(constructionDir, 'professional-collaboration-manifest.json');
  fs.writeFileSync(jsonPath, JSON.stringify(manifest, null, 2), 'utf8');

  // Generate readable Markdown report
  const mdLines = [
    `# Universal Professional Collaboration Manifest`,
    ``,
    `**Manifest ID**: \`${manifest.manifest_id}\`  `,
    `**Mission**: ${manifest.mission}  `,
    `**Generated**: ${manifest.generated_at}  `,
    `**Axiom**: *${manifest.governing_axiom}*  `,
    ``,
    `## 1. Executive Summary`,
    `- **Product Goal**: ${manifest.product_goal}`,
    `- **Active Professional Disciplines**: ${manifest.metrics.total_active_disciplines} / 26`,
    `- **Canonical Domains Covered**: ${manifest.metrics.canonical_domains_covered.join(', ')} (out of A-M)`,
    `- **Workstream Tasks**: ${manifest.metrics.total_workstreams}`,
    `- **Expected Multidisciplinary Deliverables**: ${manifest.metrics.total_expected_deliverables}`,
    `- **Cross-Discipline Trade-Offs Resolved**: ${manifest.metrics.total_conflicts_resolved}`,
    ``,
    `## 2. Active Multidisciplinary Disciplines & Roles`,
    `| Code | Discipline | Primary Domain | Assigned Professional Role | Baseline |`,
    `|:---:|:---|:---:|:---|:---:|`
  ];

  for (const d of manifest.active_disciplines) {
    mdLines.push(`| **${d.code}** | ${d.name} | **Domain ${d.primary_domain}** | ${d.selected_role?.role_title || 'Lead Specialist'} | ${d.is_baseline ? 'Yes' : 'Dynamic'} |`);
  }

  mdLines.push(``, `## 3. Multidisciplinary Workstream DAG (Phase Ordered)`);
  for (const ws of manifest.workstream_dag) {
    mdLines.push(`### ${ws.id} (${ws.phase})`);
    mdLines.push(`- **Role**: ${ws.role} (\`Discipline ${ws.discipline_code}\`)`);
    mdLines.push(`- **Action**: ${ws.action}`);
    mdLines.push(`- **Dependencies**: ${ws.dependencies.length > 0 ? ws.dependencies.map(d => `\`${d}\``).join(', ') : '*(None - Root)*'}`);
    mdLines.push(`- **Deliverables**: ${ws.deliverables.map(d => `\`${d}\``).join(', ')}`);
    mdLines.push(``);
  }

  mdLines.push(`## 4. Cross-Discipline Trade-Off Resolutions`);
  for (const conf of manifest.cross_discipline_conflict_resolutions) {
    mdLines.push(`### ${conf.conflict_id}: ${conf.topic}`);
    mdLines.push(`- **Disciplines Involved**: ${conf.disciplines_involved.join(', ')}`);
    mdLines.push(`- **Resolved Decision**: **${conf.resolved_decision}**`);
    mdLines.push(`- **Policy Applied**: \`${conf.policy_applied}\``);
    mdLines.push(`- **Governing Action**: ${conf.governing_action}`);
    mdLines.push(`- **Residual Risk**: ${conf.residual_risk}`);
    mdLines.push(``);
  }

  const mdPath = path.resolve(constructionDir, 'professional-collaboration-manifest.md');
  fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf8');

  return { jsonPath, mdPath };
}

// ---------------------------------------------------------------------------
// 7. Deliverable Quality Gate Verifier
// ---------------------------------------------------------------------------

/**
 * Verifies that the multidisciplinary deliverables declared in the manifest exist
 * and conform to non-empty file integrity standards in the target repository.
 * 
 * @param {string} targetDir - Directory of the constructed project
 * @param {object} manifest - The collaboration manifest
 * @returns {object} Detailed verification scorecard
 */
export function verifyMultidisciplinaryDeliverables(targetDir, manifest) {
  if (!manifest || !Array.isArray(manifest.expected_deliverables)) {
    throw new Error('[UPCE] Invalid manifest passed to verifier: missing expected_deliverables.');
  }

  const results = [];
  let passedCount = 0;
  let failedCount = 0;

  for (const item of manifest.expected_deliverables) {
    const fullPath = path.resolve(targetDir, item.deliverable_name);
    const exists = fs.existsSync(fullPath);
    let size = 0;
    let isValid = false;

    if (exists) {
      try {
        const stat = fs.statSync(fullPath);
        size = stat.size;
        isValid = stat.isFile() && size > 10; // Must be non-trivial
      } catch (e) {
        isValid = false;
      }
    }

    if (isValid) {
      passedCount++;
      results.push({
        deliverable: item.deliverable_name,
        role: item.role,
        discipline_code: item.discipline_code,
        status: 'PASSED',
        size_bytes: size
      });
    } else {
      failedCount++;
      results.push({
        deliverable: item.deliverable_name,
        role: item.role,
        discipline_code: item.discipline_code,
        status: exists ? 'INVALID_EMPTY_FILE' : 'MISSING',
        size_bytes: size
      });
    }
  }

  const overallStatus = failedCount === 0 ? 'VERIFIED' : (passedCount > 0 ? 'PARTIALLY_VERIFIED' : 'FAILED');

  return {
    status: overallStatus,
    target_dir: targetDir,
    total_expected: manifest.expected_deliverables.length,
    passed_count: passedCount,
    failed_count: failedCount,
    pass_rate: manifest.expected_deliverables.length > 0 ? (passedCount / manifest.expected_deliverables.length) : 1,
    deliverable_scorecard: results
  };
}

// ---------------------------------------------------------------------------
// 8. High-Level Orchestrator
// ---------------------------------------------------------------------------

/**
 * One-call multidisciplinary team orchestrator.
 * 
 * @param {string} productGoal - Product intent
 * @param {object} options - Execution parameters
 * @returns {object} Execution summary and manifest
 */
export function orchestrateMultidisciplinaryTeam(productGoal, options = {}) {
  const intentAnalysis = options.intentAnalysis || {};
  const targetDir = options.targetDir || BRAIN_ROOT;

  // 1. Infer disciplines
  const activeDisciplines = inferRequiredDisciplines(productGoal, intentAnalysis);

  // 2. Decompose workstreams
  const workstreams = decomposeMultidisciplinaryWorkstreams(activeDisciplines, options.semanticPackage || {});

  // 3. Resolve conflicts
  const conflictResolutions = resolveCrossDisciplineConflicts(activeDisciplines, options);

  // 4. Synthesize manifest
  const manifest = synthesizeProfessionalCollaborationManifest(
    productGoal,
    activeDisciplines,
    workstreams,
    conflictResolutions,
    options
  );

  // 5. Optionally emit
  let emission = null;
  if (options.emitArtifacts !== false) {
    emission = emitProfessionalCollaborationManifest(manifest, targetDir);
  }

  return {
    manifest,
    emission,
    metrics: manifest.metrics
  };
}

