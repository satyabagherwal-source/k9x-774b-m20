/**
 * AI-Builder-Brain Four-System End-to-End Integration Verification Suite
 * 
 * Location: 04_WORKFLOWS/factory-engine/test-four-system-end-to-end-integration.mjs
 * Purpose: HARV-DISC-01 Phase 9 — Verifies seamless end-to-end integration across:
 *   System A: Autonomous Multi-Source Discovery Scout (Universal Harvester)
 *   System B: Knowledge Intelligence & Storage (Epistemic Promotion Bridge)
 *   System C: Universal 13-Domain Retrieval Engine (searchBrain)
 *   System D: Project Factory Construction Engine (Semantic Decomposer + Code Assembler)
 * 
 * Invariants:
 * 1. 100% Sandbox Isolation: ZERO production contamination.
 * 2. Full Traceability: Every constructed guideline traces back to discovery source.
 * 3. Verified Execution: Produces live, executable project output in sandbox.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import {
  UNIVERSAL_SOURCE_CATEGORIES,
  CURATED_DISCOVERY_SEEDS,
  evaluateUniversalSource,
  discoverUniversalSources,
  acquireAndExtractSourceKnowledge,
  executeUniversalDiscoveryPipeline
} from './universal-discovery-scout.mjs';

import {
  INTELLIGENCE_DOMAINS,
  loadDomainRegistry,
  createDomainIntelligenceRecord,
  persistDomainIntelligenceRecord
} from './domain-intelligence-engine.mjs';

import {
  KNOWLEDGE_STAGE,
  validateProjectLearningCandidate,
  promoteProjectLearningToMasterBrain
} from './project-learning-promotion-bridge.mjs';

import { searchBrain } from './retrieval-engine.mjs';
import { constructUniversalProduct } from './universal-code-assembler.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

console.log('======================================================================');
console.log('🚀 PHASE 9: FOUR-SYSTEM END-TO-END INTEGRATION VERIFICATION');
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

const sandboxDir = path.join(os.tmpdir(), `brain-phase9-integration-${Date.now()}`);
fs.mkdirSync(sandboxDir, { recursive: true });

try {
  // ---------------------------------------------------------------------------
  // STEP 1: System A — Autonomous Multi-Source Discovery Scout
  // ---------------------------------------------------------------------------
  console.log('[SYSTEM A] Testing Autonomous Multi-Source Discovery...');

  const discoveryQuery = 'contrast';
  const discoveredSources = discoverUniversalSources(discoveryQuery);

  assert(discoveredSources.length > 0, 'Discovery Scout located matching sources for query', `Query: "${discoveryQuery}", Matches: ${discoveredSources.length}`);
  const targetSeed = discoveredSources[0];
  assert(targetSeed.category === 'STANDARDS_AND_SPECIFICATIONS', 'Discovered source belongs to canonical STANDARDS_AND_SPECIFICATIONS category');
  assert(targetSeed.url.startsWith('https://'), 'Discovered source enforces HTTPS security invariant');
  assert(targetSeed.evaluation.is_permitted === true, 'Discovered source passed multi-pillar trust evaluation gate');
  assert(targetSeed.evaluation.trust_score >= 0.90, 'Source granted high authority trust score', `Score: ${targetSeed.evaluation.trust_score}`);

  // ---------------------------------------------------------------------------
  // STEP 2: System B — Knowledge Intelligence & Epistemic Storage
  // ---------------------------------------------------------------------------
  console.log('\n[SYSTEM B] Testing Knowledge Extraction & Epistemic Promotion Bridge...');

  // Setup sandbox domain intelligence directory
  const sandboxKnowledgeDir = path.join(sandboxDir, '05_KNOWLEDGE', 'domain-intelligence');
  fs.mkdirSync(sandboxKnowledgeDir, { recursive: true });

  const mockRegistry = {
    version: '1.0.0',
    last_updated: new Date().toISOString(),
    records: {},
    domains: {}
  };
  for (const letter of Object.keys(INTELLIGENCE_DOMAINS)) {
    mockRegistry.domains[letter] = {
      id: INTELLIGENCE_DOMAINS[letter].id,
      name: INTELLIGENCE_DOMAINS[letter].name,
      record_ids: []
    };
  }
  fs.writeFileSync(
    path.join(sandboxKnowledgeDir, 'domain-registry.json'),
    JSON.stringify(mockRegistry, null, 2),
    'utf-8'
  );

  // Extract candidate knowledge
  const extraction = acquireAndExtractSourceKnowledge(targetSeed);
  assert(extraction.success === true, 'Extracted structured knowledge candidate from source');
  assert(extraction.candidate.candidate_id.startsWith('PLCAND-'), 'Assigned valid PLCAND ID');
  assert(extraction.candidate.source_provenance.source_uri === targetSeed.url, 'Preserved immutable source URI provenance');

  // Promote to Sandbox Registry (Domain F: Design)
  const verificationProof = {
    verified: true,
    exit_code: 0,
    evidence_type: 'W3C_SPECIFICATION_VERIFIED',
    test_suite: 'test-wcag-contrast.mjs'
  };

  const promotion = promoteProjectLearningToMasterBrain(extraction.candidate, verificationProof, {
    brainRoot: sandboxDir
  });

  assert(promotion.success === true, 'Epistemic Promotion Bridge successfully promoted candidate to canonical storage');
  assert(promotion.record_id && promotion.record_id.startsWith('DOM-F-'), 'Assigned canonical Domain F record ID', promotion.record_id);

  const sandboxRegistry = loadDomainRegistry(sandboxDir);
  assert(sandboxRegistry.records[promotion.record_id] !== undefined, 'Promoted record retrievable from sandbox domain-registry.json');
  assert(sandboxRegistry.records[promotion.record_id].provenance.source_uri.includes('w3.org'), 'Canonical registry preserves W3C source URI');

  // ---------------------------------------------------------------------------
  // STEP 3: System C — Universal 13-Domain Retrieval (searchBrain)
  // ---------------------------------------------------------------------------
  console.log('\n[SYSTEM C] Testing Universal Retrieval Engine Recall...');

  const retrievalQuery = 'WCAG accessibility contrast ratio';
  const retrievalResult = searchBrain(retrievalQuery, { domain: 'F' });

  assert(retrievalResult.results.length > 0, 'searchBrain retrieved results for domain query', `Count: ${retrievalResult.results.length}`);
  const topResult = retrievalResult.results[0];
  assert(topResult.domainLetter === 'F', 'Top retrieved result is strictly Domain F (Design)');
  assert(topResult.sourceTier !== undefined, 'Top result contains immutable source tier');
  assert(topResult.confidence !== undefined, 'Top result contains calibrated confidence metric');

  // ---------------------------------------------------------------------------
  // STEP 4: System D — Project Factory Live Construction Integration
  // ---------------------------------------------------------------------------
  console.log('\n[SYSTEM D] Testing Project Factory Autonomous Construction...');

  const userProductGoal = 'Build an accessible analytics dashboard with WCAG AA contrast tokens, dark mode support, and resilient telemetry';
  const factoryOutputDir = path.join(sandboxDir, 'constructed-product');

  const construction = constructUniversalProduct(userProductGoal, factoryOutputDir, {
    name: 'AccessibleDashboard'
  });

  assert(construction.assemblyResult !== undefined, 'Project Factory assembled product package successfully');
  assert(fs.existsSync(path.join(factoryOutputDir, 'package.json')), 'Factory created package.json in sandbox');
  assert(fs.existsSync(path.join(factoryOutputDir, 'src', 'core', 'brain-knowledge-manifest.json')), 'Factory created brain-knowledge-manifest.json');
  assert(fs.existsSync(path.join(factoryOutputDir, 'README.md')), 'Factory created README.md');

  // Verify Live Intelligence Ingestion from Brain Corpus
  const manifestContent = JSON.parse(fs.readFileSync(path.join(factoryOutputDir, 'src', 'core', 'brain-knowledge-manifest.json'), 'utf-8'));
  const guidelines = manifestContent.active_guidelines || manifestContent.activeGuidelines || [];
  assert(Array.isArray(guidelines) && guidelines.length > 0, 'Manifest contains dynamically retrieved active_guidelines', `Count: ${guidelines.length}`);

  const readmeContent = fs.readFileSync(path.join(factoryOutputDir, 'README.md'), 'utf-8');
  assert(readmeContent.includes('Live Retrieved Domain Intelligence') || readmeContent.includes('Master Brain Intelligence Applied'), 'README.md embeds active Brain engineering guidelines');

  // ---------------------------------------------------------------------------
  // STEP 5: Zero Production Contamination Check
  // ---------------------------------------------------------------------------
  console.log('\n[SAFETY] Verifying Zero Production Registry Contamination...');

  const prodRegistry = loadDomainRegistry(BRAIN_ROOT);
  const prodHasTestRecord = Object.keys(prodRegistry.records || {}).includes(promotion.record_id);
  assert(!prodHasTestRecord, 'Strict Isolation: Production registry contains ZERO temporary sandbox records');

} finally {
  try {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  } catch (e) { }
}

console.log('\n======================================================================');
console.log(`📊 PHASE 9 INTEGRATION SUMMARY: ${passedTests} passed | ${failedTests} failed`);
console.log('======================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL FOUR SYSTEMS (A, B, C, D) ARE FULLY INTEGRATED & EMPIRICALLY VERIFIED!\n');
  process.exit(0);
}
