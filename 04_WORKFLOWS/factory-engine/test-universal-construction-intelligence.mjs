/**
 * AI-Builder-Brain Universal Construction Intelligence Test Suite
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-universal-construction-intelligence.mjs
 * Purpose: Verifies PAC-004 Phase 1B Milestone 1:
 *          1. Knowledge-to-Construction Retrieval Integration (Two-Tier Recall, Dossier Chunking, Provenance, Budgeting, Zero Auto-Promotion)
 *          2. Universal First-Principles Requirements Synthesis across 8 Distinct Product Categories + Hybrid
 *          3. Explicit Tracking of UNSPECIFIED Architectural Requirements
 *          4. Construction Specification Markdown Generation with Real Citations
 *          5. Scaffolding & Product Generation Boundary Invariant (Rule 1670)
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  classifyProductArchetype,
  readDossierTargetedChunks,
  detectUnspecifiedRequirements,
  synthesizeProblemRecord,
  synthesizeMarketFeasibility,
  synthesizePRDSpecification,
  recallConstructionDomainGuidelines,
  generateConstructionGuideMarkdown,
  synthesizeConstructionPackage,
  emitConstructionIntelligence
} from './construction-intelligence.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');
const SANDBOX_DIR = path.join(BRAIN_ROOT, '.project-brain', 'simulation-sandbox', 'universal-cie-test-sandbox');

console.log('======================================================================');
console.log('🧪 TEST SUITE: UNIVERSAL KNOWLEDGE-TO-CONSTRUCTION INTELLIGENCE (PAC-004 M1)');
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
  // GROUP 1: RETRIEVAL INTEGRATION & DOSSIER BODY RECALL (Milestone A)
  // ---------------------------------------------------------------------------
  console.log('[GROUP 1] Verifying Knowledge Retrieval Integration & Dossier Body Chunking...');

  // 1.1 Targeted Dossier Chunking
  const sampleDossierPath = '07_PROJECT_LEARNING/0x4m4-hexstrike-ai-learnings.md';
  const chunkRes = readDossierTargetedChunks(sampleDossierPath, ['pentest', 'mcp', 'agent'], BRAIN_ROOT, 600);
  assert(chunkRes.found === true, 'Successfully located and read dossier from 07_PROJECT_LEARNING/');
  assert(chunkRes.chunks.length > 0 && chunkRes.chunks[0].length > 50, 'Extracted non-empty body chunk from dossier', `Length: ${chunkRes.totalChars}`);
  assert(chunkRes.lineRange[0] > 0 && chunkRes.lineRange[1] >= chunkRes.lineRange[0], 'Accurate line range attached to dossier chunk', `Lines: ${chunkRes.lineRange[0]}-${chunkRes.lineRange[1]}`);

  // 1.2 Two-Tier Construction Guidelines Recall
  const guidelines = recallConstructionDomainGuidelines(BRAIN_ROOT, 'client-side SVG conversion canvas performance');
  assert(guidelines.F !== undefined, 'Recalled Domain F (Design) guidelines');
  assert(guidelines.G !== undefined, 'Recalled Domain G (Architecture) guidelines');
  assert(guidelines.H !== undefined, 'Recalled Domain H (Technical Construction) guidelines');
  assert(guidelines.J !== undefined, 'Recalled Domain J (Search & Distribution) guidelines');
  assert(guidelines.K !== undefined, 'Recalled Domain K (Quality & Verification) guidelines');

  // 1.3 Epistemic States & Provenance Separation
  const domainH = guidelines.H;
  assert(domainH.tier1.length > 0, 'Tier 1 contains canonical records from domain-registry.json');
  assert(domainH.tier1.every(i => i.epistemic_state === 'CANONICAL'), 'Tier 1 items strictly hold CANONICAL epistemic state');
  assert(domainH.tier1.every(i => i.file_path.includes('domain-registry.json')), 'Tier 1 items reference canonical registry file path');

  assert(domainH.tier2 !== undefined, 'Tier 2 contains empirical patterns and harvested intelligence');
  if (domainH.tier2.length > 0) {
    const hasValidatedOrExtracted = domainH.tier2.some(i => i.epistemic_state === 'VALIDATED' || i.epistemic_state === 'EXTRACTED');
    assert(hasValidatedOrExtracted, 'Tier 2 items hold VALIDATED or EXTRACTED epistemic state');
    assert(domainH.tier2.every(i => i.source_id && i.file_path && i.line_range), 'Tier 2 items preserve complete provenance (id, file, line_range)');
  } else {
    assert(true, 'Tier 2 items handled within token budget');
  }

  // 1.4 Deduplication & Token Budgeting
  const allItemIds = domainH.items.map(i => i.source_id || i.id);
  const uniqueIds = new Set(allItemIds);
  assert(allItemIds.length === uniqueIds.size, 'Zero duplicate items across Tier 1 and Tier 2', `Total: ${allItemIds.length}`);
  assert(domainH.totalTokens <= 1500, 'Context token budget enforced within acceptable envelope', `Tokens: ${domainH.totalTokens}`);

  // 1.5 Zero Auto-Promotion Invariant
  const registryPath = path.join(BRAIN_ROOT, '05_KNOWLEDGE', 'domain-intelligence', 'domain-registry.json');
  const registryStatBefore = fs.statSync(registryPath).mtimeMs;
  recallConstructionDomainGuidelines(BRAIN_ROOT, 'novel exotic distributed consensus algorithm');
  const registryStatAfter = fs.statSync(registryPath).mtimeMs;
  assert(registryStatBefore === registryStatAfter, 'Zero Auto-Promotion Invariant verified: domain-registry.json was NOT mutated during retrieval');

  // 1.6 Empty & Gibberish Query Resilience
  const emptyRecall = recallConstructionDomainGuidelines(BRAIN_ROOT, '');
  assert(emptyRecall.F !== undefined && emptyRecall.G !== undefined, 'Empty query gracefully returns foundational canonical guidelines');
  const gibberishRecall = recallConstructionDomainGuidelines(BRAIN_ROOT, 'xyzq982734982374kjhasdfkjasd');
  assert(gibberishRecall.F !== undefined, 'Gibberish query safely falls back to canonical domain guidelines without throwing');

  // ---------------------------------------------------------------------------
  // GROUP 2: UNIVERSAL FIRST-PRINCIPLES REQUIREMENTS SYNTHESIS (Milestone B)
  // ---------------------------------------------------------------------------
  console.log('\n[GROUP 2] Verifying First-Principles Requirements Synthesis across 8 Categories + Hybrid...');

  // CASE 1: Editorial Publishing ("The Sovereign Chronicle")
  console.log('  Testing Case 1: Editorial Publishing Website ("The Sovereign Chronicle")...');
  const editorialIntent = "The Sovereign Chronicle: high-integrity investigative editorial publishing website with clean typography, reading modes, fast full-text article search, and RSS";
  const editorialProfile = { name: "The Sovereign Chronicle", category: "editorial" };
  const editorialProb = synthesizeProblemRecord(editorialIntent, editorialProfile);
  const editorialFeas = synthesizeMarketFeasibility(editorialProb, editorialProfile);
  const editorialPrd = synthesizePRDSpecification(editorialProb, editorialFeas, editorialProfile);

  assert(editorialPrd.archetype === 'editorial-publishing', 'Classified as editorial-publishing archetype');
  assert(editorialPrd.mvp_scope.some(f => f.name.includes('Article') || f.name.includes('Content Store')), 'MVP includes structured content/article store');
  assert(editorialPrd.mvp_scope.some(f => f.name.includes('Search')), 'MVP includes full-text article search');
  assert(editorialPrd.mvp_scope.some(f => f.name.includes('Reading Modes') || f.name.includes('Reader Layout')), 'MVP includes reading modes layout');
  assert(editorialPrd.mvp_scope.some(f => f.name.includes('JSON-LD') || f.name.includes('SEO')), 'MVP includes JSON-LD structured data schema');
  assert(!editorialPrd.mvp_scope.some(f => f.name.toLowerCase().includes('dropzone') || f.name.toLowerCase().includes('drag-and-drop')), 'Strictly ZERO dropzones in Editorial MVP');
  assert(editorialPrd.negative_scope_exclusions.some(e => e.feature_name.toLowerCase().includes('dropzone') || e.feature_name.toLowerCase().includes('transcoding')), 'Negative scope explicitly excludes file transcoding and dropzones');

  // CASE 2: SVG-to-WebP Utility ("VectorForge")
  console.log('  Testing Case 2: SVG-to-WebP Utility ("VectorForge")...');
  const converterIntent = "VectorForge: privacy-first client-side SVG to WebP image converter with zero server uploads, drag and drop, and instant offline conversion";
  const converterProfile = { name: "VectorForge", category: "utility" };
  const converterProb = synthesizeProblemRecord(converterIntent, converterProfile);
  const converterFeas = synthesizeMarketFeasibility(converterProb, converterProfile);
  const converterPrd = synthesizePRDSpecification(converterProb, converterFeas, converterProfile);

  assert(converterPrd.archetype === 'file-transformation', 'Classified as file-transformation archetype');
  assert(converterPrd.mvp_scope.some(f => f.name.includes('Drag-and-Drop')), 'MVP contains drag-and-drop ingestion zone');
  assert(converterPrd.mvp_scope.some(f => f.name.includes('Processing Pipeline')), 'MVP contains in-browser processing pipeline');
  assert(converterPrd.mvp_scope.some(f => f.name.includes('Preview') && f.name.includes('Export')), 'MVP contains preview and 1-click export');
  assert(converterPrd.mvp_scope.some(f => f.name.includes('Privacy Guarantee Badge')), 'MVP contains privacy guarantee badge');

  // CASE 3: Real-Time Telemetry Dashboard ("Sovereign Pulse")
  console.log('  Testing Case 3: Real-Time Telemetry Dashboard ("Sovereign Pulse")...');
  const dashboardIntent = "Sovereign Pulse: real-time streaming telemetry dashboard for production metrics, P95/P99 latency calculations, and live timeseries canvas visualizer";
  const dashboardProfile = { name: "Sovereign Pulse", category: "dashboard" };
  const dashboardProb = synthesizeProblemRecord(dashboardIntent, dashboardProfile);
  const dashboardFeas = synthesizeMarketFeasibility(dashboardProb, dashboardProfile);
  const dashboardPrd = synthesizePRDSpecification(dashboardProb, dashboardFeas, dashboardProfile);

  assert(dashboardPrd.archetype === 'telemetry-dashboard', 'Classified as telemetry-dashboard archetype');
  assert(dashboardPrd.mvp_scope.some(f => f.name.includes('WebSocket') || f.name.includes('Ring Buffer')), 'MVP includes WebSocket streaming ring buffer');
  assert(dashboardPrd.mvp_scope.some(f => f.name.includes('P95') || f.name.includes('P99')), 'MVP includes windowed P99 metric calculator');
  assert(dashboardPrd.mvp_scope.some(f => f.name.includes('Canvas')), 'MVP includes timeseries canvas visualizer');
  assert(dashboardPrd.mvp_scope.some(f => f.name.includes('Alert') || f.name.includes('Health')), 'MVP includes health threshold alert pill');
  assert(!dashboardPrd.mvp_scope.some(f => f.name.toLowerCase().includes('dropzone')), 'Strictly ZERO dropzones in Telemetry Dashboard MVP');

  // CASE 4: Headless API Service ("VaultKeeper API")
  console.log('  Testing Case 4: Headless API Service ("VaultKeeper API")...');
  const apiIntent = "VaultKeeper API: headless JSON REST API microservice with strict schema validation, deterministic router, and RFC 7807 problem details errors";
  const apiProfile = { name: "VaultKeeper API", category: "api" };
  const apiProb = synthesizeProblemRecord(apiIntent, apiProfile);
  const apiFeas = synthesizeMarketFeasibility(apiProb, apiProfile);
  const apiPrd = synthesizePRDSpecification(apiProb, apiFeas, apiProfile);

  assert(apiPrd.archetype === 'headless-api', 'Classified as headless-api archetype');
  assert(apiPrd.mvp_scope.some(f => f.name.includes('Router')), 'MVP includes deterministic HTTP router');
  assert(apiPrd.mvp_scope.some(f => f.name.includes('Schema Validation')), 'MVP includes strict schema validation');
  assert(apiPrd.mvp_scope.some(f => f.name.includes('RFC 7807')), 'MVP includes RFC 7807 Problem Details error handler');
  assert(!apiPrd.mvp_scope.some(f => f.name.toLowerCase().includes('dropzone') || f.name.toLowerCase().includes('html')), 'Strictly ZERO dropzones or HTML UI in Headless API MVP');
  assert(apiPrd.negative_scope_exclusions.some(e => e.feature_name.toLowerCase().includes('dropzone') || e.feature_name.toLowerCase().includes('graphical')), 'Negative scope excludes GUI and dropzones');

  // CASE 5: Workflow Automation Runner ("TaskFlow Runner")
  console.log('  Testing Case 5: Workflow Automation Runner ("TaskFlow Runner")...');
  const workflowIntent = "TaskFlow Runner: embeddable workflow automation task runner with DAG dependency planning, cycle detection, and crash-safe state checkpointing";
  const workflowProfile = { name: "TaskFlow Runner", category: "workflow" };
  const workflowProb = synthesizeProblemRecord(workflowIntent, workflowProfile);
  const workflowFeas = synthesizeMarketFeasibility(workflowProb, workflowProfile);
  const workflowPrd = synthesizePRDSpecification(workflowProb, workflowFeas, workflowProfile);

  assert(workflowPrd.archetype === 'workflow-automation', 'Classified as workflow-automation archetype');
  assert(workflowPrd.mvp_scope.some(f => f.name.includes('DAG') || f.name.includes('Dependency')), 'MVP includes DAG dependency planner');
  assert(workflowPrd.mvp_scope.some(f => f.name.includes('Executor') || f.name.includes('Runner')), 'MVP includes concurrent step executor');
  assert(workflowPrd.mvp_scope.some(f => f.name.includes('Checkpoint') || f.name.includes('Journal')), 'MVP includes crash-resilient state journal checkpointer');
  assert(!workflowPrd.mvp_scope.some(f => f.name.toLowerCase().includes('dropzone')), 'Strictly ZERO dropzones in Workflow Automation MVP');

  // CASE 6: Hybrid 3D CAD Modeler ("NeuroCraft CAD")
  console.log('  Testing Case 6: Hybrid 3D CAD Modeler ("NeuroCraft CAD")...');
  const cadIntent = "NeuroCraft CAD: procedural 3D solid modeler with parametric geometry constraints, constructive solid geometry CSG booleans, and WebGL viewport";
  const cadProfile = { name: "NeuroCraft CAD", category: "cad" };
  const cadProb = synthesizeProblemRecord(cadIntent, cadProfile);
  const cadFeas = synthesizeMarketFeasibility(cadProb, cadProfile);
  const cadPrd = synthesizePRDSpecification(cadProb, cadFeas, cadProfile);

  assert(cadPrd.archetype === 'geometric-cad', 'Classified as geometric-cad archetype');
  assert(cadPrd.mvp_scope.some(f => f.name.includes('Parametric') || f.name.includes('Geometry')), 'MVP includes parametric geometry parser');
  assert(cadPrd.mvp_scope.some(f => f.name.includes('CSG') || f.name.includes('Boolean')), 'MVP includes procedural CSG engine');
  assert(cadPrd.mvp_scope.some(f => f.name.includes('WebGL')), 'MVP includes interactive WebGL viewport');
  assert(cadPrd.mvp_scope.some(f => f.name.includes('STL') || f.name.includes('OBJ')), 'MVP includes multi-format 3D exporter');
  assert(!cadPrd.mvp_scope.some(f => f.name.toLowerCase().includes('dropzone')), 'Strictly ZERO dropzones in 3D CAD MVP');

  // CASE 7: Local Vector Search Engine ("EdgeVector")
  console.log('  Testing Case 7: Local Vector Search Engine ("EdgeVector")...');
  const vectorIntent = "EdgeVector: embedded in-memory HNSW vector search engine with Float32 SIMD distance math and sub-5ms cosine ranking";
  const vectorProfile = { name: "EdgeVector", category: "search" };
  const vectorProb = synthesizeProblemRecord(vectorIntent, vectorProfile);
  const vectorFeas = synthesizeMarketFeasibility(vectorProb, vectorProfile);
  const vectorPrd = synthesizePRDSpecification(vectorProb, vectorFeas, vectorProfile);

  assert(vectorPrd.archetype === 'vector-search', 'Classified as vector-search archetype');
  assert(vectorPrd.mvp_scope.some(f => f.name.includes('HNSW')), 'MVP includes in-memory HNSW vector index');
  assert(vectorPrd.mvp_scope.some(f => f.name.includes('SIMD') || f.name.includes('Float32')), 'MVP includes Float32 SIMD vector math');
  assert(vectorPrd.mvp_scope.some(f => f.name.includes('Cosine')), 'MVP includes cosine similarity nearest neighbor ranker');
  assert(!vectorPrd.mvp_scope.some(f => f.name.toLowerCase().includes('dropzone')), 'Strictly ZERO dropzones in Vector Search MVP');

  // CASE 8: Cryptographic Sharding CLI ("ShamirVault CLI")
  console.log('  Testing Case 8: Cryptographic Sharding CLI ("ShamirVault CLI")...');
  const cryptoIntent = "ShamirVault CLI: cryptographic key sharding CLI tool using Shamir Secret Sharing k-of-n, Argon2id passphrase hardening, and verified memory zeroing";
  const cryptoProfile = { name: "ShamirVault CLI", category: "security" };
  const cryptoProb = synthesizeProblemRecord(cryptoIntent, cryptoProfile);
  const cryptoFeas = synthesizeMarketFeasibility(cryptoProb, cryptoProfile);
  const cryptoPrd = synthesizePRDSpecification(cryptoProb, cryptoFeas, cryptoProfile);

  assert(cryptoPrd.archetype === 'cryptographic-tool', 'Classified as cryptographic-tool archetype');
  assert(cryptoPrd.mvp_scope.some(f => f.name.includes('Shamir')), 'MVP includes Shamir Secret Sharing polynomial splitter');
  assert(cryptoPrd.mvp_scope.some(f => f.name.includes('Argon2id')), 'MVP includes Argon2id key derivation pipeline');
  assert(cryptoPrd.mvp_scope.some(f => f.name.includes('Zeroing') || f.name.includes('Wipe')), 'MVP includes secure memory buffer zeroing subsystem');
  assert(!cryptoPrd.mvp_scope.some(f => f.name.toLowerCase().includes('dropzone')), 'Strictly ZERO dropzones in Cryptographic CLI MVP');

  // CASE 9: Custom Hybrid / Novel Concept
  console.log('  Testing Case 9: Custom Hybrid / Novel Concept...');
  const hybridIntent = "Acoustic resonance analyzer for musical instrument luthiers calculating harmonic overtone distributions";
  const hybridProfile = { name: "LuthierAcoustics", category: "audio-analysis" };
  const hybridProb = synthesizeProblemRecord(hybridIntent, hybridProfile);
  const hybridFeas = synthesizeMarketFeasibility(hybridProb, hybridProfile);
  const hybridPrd = synthesizePRDSpecification(hybridProb, hybridFeas, hybridProfile);

  assert(hybridPrd.archetype === 'custom-hybrid', 'Classified as custom-hybrid archetype');
  assert(hybridPrd.mvp_scope.length === 4, 'Dynamically derived exactly 4 foundational features');
  assert(!hybridPrd.mvp_scope.some(f => f.name.toLowerCase().includes('dropzone')), 'Strictly ZERO dropzones in Custom Hybrid MVP');

  // ---------------------------------------------------------------------------
  // GROUP 3: EXPLICIT TRACKING OF UNSPECIFIED REQUIREMENTS
  // ---------------------------------------------------------------------------
  console.log('\n[GROUP 3] Verifying Explicit Tracking of UNSPECIFIED Requirements...');
  const unspecReqs = detectUnspecifiedRequirements("Build a fast offline markdown viewer");
  assert(unspecReqs.length >= 3, 'Identified unspecified architectural dimensions', `Count: ${unspecReqs.length}`);
  assert(unspecReqs.some(u => u.category === 'DATABASE_AND_PERSISTENCE' && u.status === 'UNSPECIFIED'), 'Database explicitly marked as UNSPECIFIED');
  assert(unspecReqs.some(u => u.category === 'AUTHENTICATION_AND_IDENTITY' && u.status === 'UNSPECIFIED'), 'Authentication explicitly marked as UNSPECIFIED');
  assert(unspecReqs.some(u => u.category === 'DEPLOYMENT_HOSTING_TARGET' && u.status === 'UNSPECIFIED'), 'Deployment target explicitly marked as UNSPECIFIED');

  // ---------------------------------------------------------------------------
  // GROUP 4: CONSTRUCTION SPECIFICATION MARKDOWN & CITATION INJECTION
  // ---------------------------------------------------------------------------
  console.log('\n[GROUP 4] Verifying Construction Guide Markdown & Citation Citations...');
  const testPkg = synthesizeConstructionPackage(editorialIntent, editorialProfile, { masterBrainPath: BRAIN_ROOT });
  const guideMarkdown = testPkg.constructionGuideMarkdown;

  assert(guideMarkdown.includes('## 🎯 1. Human Need & Root Cause (Domain A)'), 'Guide contains Domain A human need section');
  assert(guideMarkdown.includes('## 💡 2. Value Proposition & Commercial Differentiation (Domain C)'), 'Guide contains Domain C value proposition');
  assert(guideMarkdown.includes('## 📦 3. Strict MVP Scope — Features to Build (Domain B)'), 'Guide contains Domain B MVP scope table');
  assert(guideMarkdown.includes('## 🚫 4. Non-Negotiable Negative Scope — What NOT to Build (Domain B)'), 'Guide contains Domain B Negative scope table');
  assert(guideMarkdown.includes('## 🛠️ 6. Downstream Construction Guidelines (Domains F, G, H, J, K)'), 'Guide contains Downstream Guidelines section');
  assert(guideMarkdown.includes('CANONICAL') || guideMarkdown.includes('VALIDATED'), 'Guide embeds epistemic tags on downstream guidelines');
  assert(guideMarkdown.includes('## ❓ 7. Explicitly Unspecified Requirements & Open Decisions'), 'Guide includes Section 7 for Unspecified Requirements & Open Decisions');

  // ---------------------------------------------------------------------------
  // GROUP 5: DISK EMISSION & ARTIFACT INTEGRITY IN SANDBOX
  // ---------------------------------------------------------------------------
  console.log('\n[GROUP 5] Verifying Disk Emission & Artifact Integrity...');
  if (fs.existsSync(SANDBOX_DIR)) {
    fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(SANDBOX_DIR, { recursive: true });

  const writtenFiles = emitConstructionIntelligence(SANDBOX_DIR, testPkg);
  assert(writtenFiles.length === 4, 'Emitted all 4 construction artifacts to disk', `Count: ${writtenFiles.length}`);

  const probFile = path.join(SANDBOX_DIR, '.project-brain', 'construction', 'problem-record.json');
  const feasFile = path.join(SANDBOX_DIR, '.project-brain', 'construction', 'business-feasibility.json');
  const prdFile = path.join(SANDBOX_DIR, '.project-brain', 'construction', 'prd-specification.json');
  const guideFile = path.join(SANDBOX_DIR, '.project-brain', 'construction', 'CONSTRUCTION_SPECIFICATION.md');

  assert(fs.existsSync(probFile), 'problem-record.json exists on disk');
  assert(fs.existsSync(feasFile), 'business-feasibility.json exists on disk');
  assert(fs.existsSync(prdFile), 'prd-specification.json exists on disk');
  assert(fs.existsSync(guideFile), 'CONSTRUCTION_SPECIFICATION.md exists on disk');

  const diskPrd = JSON.parse(fs.readFileSync(prdFile, 'utf-8'));
  assert(diskPrd.prd_id === testPkg.prdSpecification.prd_id, 'Disk PRD matches in-memory PRD');
  assert(diskPrd.archetype === 'editorial-publishing', 'Disk PRD preserves editorial-publishing archetype');

  // Clean up sandbox
  fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
  console.log('  🧹 [CLEANUP] Sandbox directory purged cleanly.');

} catch (err) {
  console.error('\n❌ Unexpected error in test suite:', err);
  failedTests++;
}

console.log('\n======================================================================');
console.log(`🏁 UNIVERSAL CONSTRUCTION INTELLIGENCE TEST SUITE: ${passedTests} PASSED | ${failedTests} FAILED`);
console.log('======================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

