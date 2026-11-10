/**
 * AI-Builder-Brain Universal Semantic Requirements Decomposition & Cross-Domain Intelligence Test Suite
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-semantic-requirements-decomposition.mjs
 * Purpose: Verifies PAC-004 Phase 1C.1:
 *          1. Semantic Goal Understanding across 7 distinct product scenarios
 *          2. Hierarchical Requirements Decomposition (Goal -> Problem -> Need -> Requirement)
 *          3. Cross-Domain Intelligence Orchestration across all 13 Domains (A–M)
 *          4. Epistemic Separation & Uncertainty Tracking (Known Facts, Assumptions, Unknowns, Conflicts)
 *          5. Dependency-Aware DAG Execution Plan compliant with validatePlanDAG and validateSubtask
 *          6. Elimination of Regex Archetype Traps (P2P mesh chat correctly recognized without CAD false-positive)
 *          7. Disk Emission & Artifact Integrity in isolated sandbox
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  analyzeCompositionalIntent,
  classifyEpistemicDimensions,
  synthesizeHierarchicalRequirements,
  orchestrateCrossDomainIntelligence,
  generateConstructionPlanDAG,
  decomposeSemanticRequirements,
  emitSemanticConstructionArtifacts
} from './semantic-decomposer.mjs';

import {
  classifyProductArchetype,
  synthesizeConstructionPackage,
  emitConstructionIntelligence
} from './construction-intelligence.mjs';

import { validatePlanDAG } from './task-planner.mjs';
import { validateSubtask, CAPABILITY_ID_REGEX } from './task-contract.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');
const SANDBOX_DIR = path.join(BRAIN_ROOT, '.project-brain', 'simulation-sandbox', 'semantic-decomp-test-sandbox');

console.log('======================================================================');
console.log('🧪 TEST SUITE: SEMANTIC REQUIREMENTS DECOMPOSITION & 13-DOMAIN ORCHESTRATION (PAC-004 1C.1)');
console.log('======================================================================\n');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName} ${details ? '(' + details + ')' : ''}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${details ? ': ' + details : ''}`);
    failedTests++;
  }
}

try {
  // ---------------------------------------------------------------------------
  // SCENARIO 1: Simple Website (Local Artisan Bakery)
  // ---------------------------------------------------------------------------
  console.log('[SCENARIO 1] Simple Website: Local Artisan Bakery & Cafe...');
  const siteGoal = "Build a responsive website for a local artisan bakery showcasing daily fresh bread menus, store hours, and click-to-call contact";
  const sitePkg = decomposeSemanticRequirements(siteGoal, { name: "Crumb & Crust Bakery", category: "website" }, { brainRoot: BRAIN_ROOT });

  assert(sitePkg.intentAnalysis.interactionParadigm === 'GUI_WEB_APPLICATION', 'Identified GUI web application paradigm');
  assert(sitePkg.intentAnalysis.domainAffinities.F >= 6, 'Domain F (Design) identified as primary driver');
  assert(sitePkg.hierarchicalReqs.requirements.length >= 4, 'Derived hierarchical requirements', `Count: ${sitePkg.hierarchicalReqs.requirements.length}`);
  assert(sitePkg.constructionPlan.dag_valid === true, 'Generated valid DAG construction plan');
  assert(sitePkg.constructionPlan.tasks.length === 7, 'Generated complete 7-step construction DAG');

  // ---------------------------------------------------------------------------
  // SCENARIO 2: SaaS Application (Small Business Inventory & Sales Management)
  // ---------------------------------------------------------------------------
  console.log('\n[SCENARIO 2] SaaS Application: Small Business Inventory and Sales Management (User Master Prompt)...');
  const saasGoal = "Build an application that helps small businesses manage inventory and sales with low stock alerts and daily revenue reports";
  const saasPkg = decomposeSemanticRequirements(saasGoal, { name: "StockPulse SaaS", category: "saas" }, { brainRoot: BRAIN_ROOT });

  assert(saasPkg.intentAnalysis.isBusinessCritical === true, 'Identified as business-critical transactional workload');
  assert(saasPkg.intentAnalysis.persistenceModel === 'PERSISTENT_BUSINESS_DATASTORE', 'Identified persistent business datastore need');
  assert(saasPkg.intentAnalysis.domainAffinities.C >= 8, 'Domain C (Market & Business) scored high affinity');
  assert(saasPkg.hierarchicalReqs.requirements.some(r => r.req_id === 'REQ-05' && r.title.includes('Transactional Integrity')), 'Synthesized transactional integrity requirement (REQ-05)');
  assert(saasPkg.epistemicData.assumptions.some(a => a.dimension === 'DATA_PERSISTENCE'), 'Tracked explicit persistence assumption with rationale');
  assert(saasPkg.epistemicData.unknowns.some(u => u.dimension === 'DEPLOYMENT_HOSTING_TARGET'), 'Tracked unspecified hosting target as UNKNOWN');

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Headless API Service (VaultKeeper Microservice)
  // ---------------------------------------------------------------------------
  console.log('\n[SCENARIO 3] Headless API Service: High-throughput microservice...');
  const apiGoal = "High-concurrency headless JSON REST API microservice with strict schema validation, deterministic router, and RFC 7807 problem details errors";
  const apiPkg = decomposeSemanticRequirements(apiGoal, { name: "VaultKeeper API", category: "api" }, { brainRoot: BRAIN_ROOT });

  assert(apiPkg.intentAnalysis.interactionParadigm === 'HEADLESS_API_OR_SDK', 'Recognized headless API paradigm');
  assert(apiPkg.intentAnalysis.executionEnvironment === 'HEADLESS_SERVER_OR_EDGE', 'Recognized headless server execution environment');
  assert(apiPkg.crossDomainIntel.G.applicability === 'APPLICABLE', 'Domain G (Architecture) applicable');
  assert(apiPkg.crossDomainIntel.H.applicability === 'APPLICABLE', 'Domain H (Technical Construction) applicable');

  // ---------------------------------------------------------------------------
  // SCENARIO 4: AI Developer Tool (Local Code Assistant CLI)
  // ---------------------------------------------------------------------------
  console.log('\n[SCENARIO 4] AI Developer Tool: Local CLI with embedded vector indexing...');
  const cliGoal = "Embedded in-memory HNSW vector search CLI tool with Float32 SIMD distance math and sub-5ms cosine ranking";
  const cliPkg = decomposeSemanticRequirements(cliGoal, { name: "EdgeVector CLI", category: "developer-tool" }, { brainRoot: BRAIN_ROOT });

  assert(cliPkg.intentAnalysis.interactionParadigm === 'CLI_TERMINAL', 'Recognized CLI terminal paradigm');
  assert(cliPkg.intentAnalysis.isHighPerformance === true, 'Recognized high-performance requirement');
  assert(cliPkg.intentAnalysis.persistenceModel === 'VECTOR_EMBEDDINGS_STORE', 'Recognized vector embeddings persistence model');

  // ---------------------------------------------------------------------------
  // SCENARIO 5: Content Publishing Product (The Sovereign Chronicle)
  // ---------------------------------------------------------------------------
  console.log('\n[SCENARIO 5] Content Publishing Product: Editorial publication...');
  const pubGoal = "High-integrity investigative editorial publishing website with clean typography, reading modes, fast full-text article search, and RSS";
  const pubPkg = decomposeSemanticRequirements(pubGoal, { name: "The Sovereign Chronicle", category: "editorial" }, { brainRoot: BRAIN_ROOT });

  assert(pubPkg.intentAnalysis.interactionParadigm === 'EDITORIAL_CONTENT_SURFACE', 'Recognized editorial content surface paradigm');
  assert(pubPkg.crossDomainIntel.I.applicability === 'APPLICABLE', 'Domain I (Content & Info) is active');
  assert(pubPkg.crossDomainIntel.J.applicability === 'APPLICABLE', 'Domain J (Search & Distribution) is active');

  // ---------------------------------------------------------------------------
  // SCENARIO 6: Creative / Media Product (Generative Audio Synthesizer)
  // ---------------------------------------------------------------------------
  console.log('\n[SCENARIO 6] Creative & Media Product: Generative Audio Synthesizer...');
  const mediaGoal = "Acoustic resonance analyzer and procedural audio synthesizer with interactive canvas waveform visualizer and dynamic harmonics";
  const mediaPkg = decomposeSemanticRequirements(mediaGoal, { name: "HarmonicWave", category: "audio" }, { brainRoot: BRAIN_ROOT });

  assert(mediaPkg.intentAnalysis.interactionParadigm === 'HIGH_FREQUENCY_CANVAS_DASHBOARD', 'Recognized canvas visualization paradigm');
  assert(mediaPkg.intentAnalysis.domainAffinities.E >= 6, 'Domain E (Creative Intelligence) affinity elevated');
  assert(mediaPkg.crossDomainIntel.E.applicability === 'APPLICABLE', 'Domain E marked APPLICABLE');

  // ---------------------------------------------------------------------------
  // SCENARIO 7: Multi-Domain Hybrid Product (P2P Mesh Messenger - Regression Defense)
  // ---------------------------------------------------------------------------
  console.log('\n[SCENARIO 7] Multi-Domain Hybrid: Encrypted P2P Mesh Chat (Verification against 3D CAD trap)...');
  const meshGoal = "Decentralized P2P mesh chat messenger using WebRTC data channels, local SQLite message vault, and client-side zero-knowledge encryption";
  const meshPkg = decomposeSemanticRequirements(meshGoal, { name: "SovereignMesh", category: "communication" }, { brainRoot: BRAIN_ROOT });

  assert(meshPkg.intentAnalysis.executionEnvironment === 'P2P_DISTRIBUTED_NODE', 'Classified as P2P distributed node');
  assert(meshPkg.intentAnalysis.interactionParadigm === 'PEER_COMMUNICATION_SURFACE', 'Classified as peer communication surface');
  assert(meshPkg.intentAnalysis.isHighPrivacy === true, 'Recognized high-privacy sovereignty invariant');
  
  // VERIFY REGEX CAD TRAP ELIMINATION
  const legacyArchetype = classifyProductArchetype(meshGoal, { name: "SovereignMesh", category: "communication" });
  assert(legacyArchetype !== 'geometric-cad', 'P2P mesh chat is NOT misclassified as geometric-cad (Regex trap eliminated!)', `Got: ${legacyArchetype}`);
  assert(legacyArchetype === 'custom-hybrid', 'P2P mesh chat gracefully falls back to custom-hybrid in legacy classifier');

  // ---------------------------------------------------------------------------
  // GROUP 8: TRACEABILITY & DAG PLAN DETERMINISM
  // ---------------------------------------------------------------------------
  console.log('\n[GROUP 8] Verifying Requirements Traceability and DAG Contract Invariants...');
  const plan = saasPkg.constructionPlan;
  
  // Validate DAG using canonical validator
  const dagValidation = validatePlanDAG(plan.tasks);
  assert(dagValidation.valid === true, 'validatePlanDAG confirms valid Acyclic Graph (DAG) with zero cycles');

  // Validate every subtask using canonical validator
  for (const step of plan.tasks) {
    const subValidation = validateSubtask(step);
    assert(subValidation.valid === true, `validateSubtask passed on ${step.step_id}`, step.objective.slice(0, 40) + '...');
    assert(step.originating_requirement_id !== undefined, `${step.step_id} preserves originating_requirement_id traceability`);
    assert(step.domain_letter !== undefined && step.domain_id !== undefined, `${step.step_id} preserves domain mapping`);
    assert(Array.isArray(step.required_capabilities) && step.required_capabilities.length > 0, `${step.step_id} requires valid CAP capability`);
    assert(step.required_capabilities.every(c => CAPABILITY_ID_REGEX.test(c)), `${step.step_id} capability ID matches CAP- format`);
  }

  // ---------------------------------------------------------------------------
  // GROUP 9: 13-DOMAIN COVERAGE AUDIT
  // ---------------------------------------------------------------------------
  console.log('\n[GROUP 9] Auditing 13-Domain Coverage in Orchestration...');
  const domains = saasPkg.crossDomainIntel;
  const letters = Object.keys(domains);
  assert(letters.length === 13, 'All 13 domains A through M represented in orchestration', `Found: ${letters.join(', ')}`);
  assert(domains.A.letter === 'A' && domains.M.letter === 'M', 'Domain letters A to M span complete boundary');

  // ---------------------------------------------------------------------------
  // GROUP 10: DISK EMISSION & ARTIFACT INTEGRITY IN SANDBOX
  // ---------------------------------------------------------------------------
  console.log('\n[GROUP 10] Verifying Disk Emission & Backward Compatibility...');
  if (fs.existsSync(SANDBOX_DIR)) {
    fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(SANDBOX_DIR, { recursive: true });

  const testUnifiedPkg = synthesizeConstructionPackage(saasGoal, { name: "StockPulse SaaS" }, { brainRoot: BRAIN_ROOT });
  assert(testUnifiedPkg.semanticRequirements !== undefined, 'Unified construction package contains semanticRequirements');
  assert(testUnifiedPkg.constructionPlan !== undefined, 'Unified construction package contains constructionPlan');

  // Emit using emitConstructionIntelligence
  const emittedCore = emitConstructionIntelligence(SANDBOX_DIR, testUnifiedPkg);
  assert(emittedCore.length === 4, 'emitConstructionIntelligence returns 4 core files by default (strict test parity)', `Count: ${emittedCore.length}`);
  assert(emittedCore.extendedArtifacts !== undefined && emittedCore.extendedArtifacts.length === 2, 'Extended artifacts attached without breaking array length');

  const semFile = path.join(SANDBOX_DIR, '.project-brain', 'construction', 'semantic-requirements.json');
  const planFile = path.join(SANDBOX_DIR, '.project-brain', 'construction', 'construction-plan.json');

  assert(fs.existsSync(semFile), 'semantic-requirements.json exists on disk');
  assert(fs.existsSync(planFile), 'construction-plan.json exists on disk');

  const diskPlan = JSON.parse(fs.readFileSync(planFile, 'utf-8'));
  assert(diskPlan.dag_valid === true, 'Disk construction plan preserves DAG validity');
  assert(diskPlan.tasks.length === 7, 'Disk construction plan preserves all 7 subtasks');

  // Cleanup sandbox
  fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
  console.log('  🧹 [CLEANUP] Sandbox directory purged cleanly.');

} catch (err) {
  console.error('\n❌ Unexpected error in test suite:', err);
  failedTests++;
}

console.log('\n======================================================================');
console.log(`🏁 SEMANTIC REQUIREMENTS TEST SUITE: ${passedTests} PASSED | ${failedTests} FAILED`);
console.log('======================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
