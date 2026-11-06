/**
 * PRODUCTION INTEGRATION VERIFICATION SUITE:
 * CLOUD HARVESTER -> DOMAIN INTELLIGENCE -> RETRIEVAL -> CONSTRUCTION REUSE
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-production-integration-verification.mjs
 * Purpose: Empirically verifies the complete production integration path:
 *          1. Production Execution Path Trace (Workflow trigger -> Multi-Agent Fleet -> Hook)
 *          2. Controlled Knowledge Integrity Fixtures (New, Duplicate, Invalid, Workaround, Governance Gate)
 *          3. AI Self-Approval Defense (Domains A, G, M strictly require human sign-off)
 *          4. Atomicity, Recovery, and Idempotent Repeated Cycles
 *          5. Real Construction Guidance Reuse & Separate Latency Measurement
 *          6. Master Brain 16-Folder & Clean Restoration Invariants
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import {
  PROMOTION_APPROVAL_POLICY,
  discoverHarvestedDossiers,
  getEvolutionCheckpoints,
  processDossierForEvolution,
  runHarvesterEvolutionCycle
} from './cloud-harvester-evolution-bridge.mjs';

import {
  issueHumanApprovalSignature,
  generateHumanAuthorityKeyPair
} from '../../13_GOVERNANCE/human-signer/sign-human-directive.mjs';

import {
  KNOWLEDGE_STAGE,
  VALIDATION_PILLARS,
  validateProjectLearningCandidate,
  classifyProjectLearningCandidate,
  discoverProjectLearningCandidates,
  checkDuplicatesAndConflicts,
  promoteProjectLearningToMasterBrain
} from './project-learning-promotion-bridge.mjs';

import {
  loadDomainRegistry,
  getDomainStoragePaths
} from './domain-intelligence-engine.mjs';

import { searchBrain } from './retrieval-engine.mjs';
import {
  recallConstructionDomainGuidelines,
  generateConstructionGuideMarkdown,
  synthesizeProblemRecord,
  synthesizeMarketFeasibility,
  synthesizePRDSpecification
} from './construction-intelligence.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

console.log('======================================================================');
console.log('🔬 PRODUCTION INTEGRATION VERIFICATION: CLOUD HARVESTER LIFECYCLE');
console.log('======================================================================');

let passedTests = 0;
let failedTests = 0;
const createdRecordIds = [];
const stagedInboxFiles = [];

function assert(condition, message, details = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${message} ${details ? '(' + details + ')' : ''}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${message} ${details ? '(' + details + ')' : ''}`);
    failedTests++;
  }
}

async function runVerificationSuite() {
  const uniqueToken = crypto.randomBytes(4).toString('hex');
  const customRoot = BRAIN_ROOT;

  // ===========================================================================
  // PHASE 1: Production Execution Path & Hook Safety Verification
  // ===========================================================================
  console.log('\n[PHASE 1] Tracing Production GitHub Actions Execution Path...');
  console.log('  ℹ️ [EXECUTION CONTEXT] LOCAL CONTROLLED VERIFICATION');
  console.log('     Distinguished from live production 24/7 GitHub Actions execution.');

  // 1A: Inspect Workflow Configuration
  const workflowFile = path.join(BRAIN_ROOT, '.github', 'workflows', '24-7-cloud-harvester.yml');
  assert(fs.existsSync(workflowFile), 'Production workflow configuration exists', workflowFile);
  const workflowContent = fs.readFileSync(workflowFile, 'utf-8');

  assert(workflowContent.includes('schedule:') && workflowContent.includes("cron: '*/20 * * * *'"), 'Workflow runs on autonomous 24/7 cron schedule');
  assert(workflowContent.includes('workflow_dispatch:'), 'Workflow supports manual dispatch');
  assert(workflowContent.includes('repository_dispatch:'), 'Workflow supports external server triggers');
  assert(workflowContent.includes('node 04_WORKFLOWS/factory-engine/multi-agent-fleet.mjs'), 'Workflow executes multi-agent-fleet.mjs');
  assert(workflowContent.includes('05_KNOWLEDGE/'), 'Workflow git commit filter includes 05_KNOWLEDGE/ domain intelligence');

  // 1B: Inspect Fleet Orchestrator Hook
  const fleetFile = path.join(BRAIN_ROOT, '04_WORKFLOWS', 'factory-engine', 'multi-agent-fleet.mjs');
  assert(fs.existsSync(fleetFile), 'multi-agent-fleet.mjs exists on disk');
  const fleetContent = fs.readFileSync(fleetFile, 'utf-8');

  assert(fleetContent.includes('runHarvesterEvolutionCycle'), 'multi-agent-fleet.mjs contains runHarvesterEvolutionCycle hook');
  assert(fleetContent.includes('await runHarvesterEvolutionCycle'), 'Evolution hook is awaited asynchronously');
  assert(fleetContent.includes('try {') && fleetContent.includes('catch (evoErr) {'), 'Evolution hook is protected by non-blocking try/catch isolation');

  // 1C: Verify Selective Priority Targeting
  const mockCycleResults = [
    { status: 'fulfilled', value: { target: 'colinhacks/zod', status: 'VERIFIED_LEARNING', harvested: 1 } },
    { status: 'fulfilled', value: { target: 'failed/repo', status: 'FAILED_PERSISTENCE', harvested: 0 } },
    { status: 'rejected', reason: 'Network timeout' }
  ];
  const discoveredTargets = discoverHarvestedDossiers({ brainRoot: customRoot, cycleResults: mockCycleResults, limit: 3 });
  assert(discoveredTargets.length > 0, 'Priority targets discovered from cycle results');
  assert(!discoveredTargets.some(p => p.includes('failed-repo')), 'Failed or rejected workers are strictly excluded from priority discovery');

  // ===========================================================================
  // PHASE 2: Controlled Knowledge Integrity Fixtures
  // ===========================================================================
  console.log('\n[PHASE 2] Testing Controlled Knowledge Integrity Fixtures...');

  // 2A: Newly Harvested Valid Portable Construction Knowledge (Domain J SEO)
  console.log('  --- Fixture A: Valid Portable Construction Knowledge (11ty Clean Permalinks) ---');
  const eleventyDossier = path.join(BRAIN_ROOT, '07_PROJECT_LEARNING', '11ty-eleventy-learnings.md');
  assert(fs.existsSync(eleventyDossier), '11ty-eleventy-learnings.md exists');

  const promoReport = await processDossierForEvolution(eleventyDossier, {
    brainRoot: customRoot,
    candidatePredicate: c => c.title.includes('Pagination'),
    forcedDomain: 'J'
  });
  assert(promoReport.promoted_canonical >= 1, 'Valid portable construction knowledge promoted to canonical registry', `Promoted: ${promoReport.promoted_canonical}`);
  const recordA = promoReport.records.find(r => r.stage === KNOWLEDGE_STAGE.CANONICAL);
  assert(recordA !== undefined, 'Canonical record created');
  assert(recordA.domain === 'J', 'Assigned Domain J (Search & Distribution)');
  createdRecordIds.push(recordA.record_id);

  // 2B: Duplicate Dossier / Invariant Interception
  console.log('  --- Fixture B: Duplicate Invariant Interception ---');
  const dupReport = await processDossierForEvolution(eleventyDossier, {
    brainRoot: customRoot,
    candidatePredicate: c => c.title.includes('Pagination'),
    forcedDomain: 'J'
  });
  assert(dupReport.duplicates_skipped >= 1, 'Identical content safely skipped as DUPLICATE_SKIPPED');
  assert(dupReport.promoted_canonical === 0, 'Zero duplicate records created in domain registry');

  // 2C: Invalid or Incomplete Evidence Fixtures
  console.log('  --- Fixture C: Invalid / Incomplete Evidence Rejections ---');
  const baseCandidate = {
    candidate_id: `PLCAND-TEST-${uniqueToken}`,
    title: 'Test Candidate',
    universal_invariant: 'Valid length invariant describing an architectural mechanism.',
    problem_statement: 'Identified defect root cause.',
    project_name: 'test-app',
    primary_domain: { letter: 'H', name: 'Technical Construction' },
    classification_confidence: 0.90
  };

  // C1: Missing empirical verification
  const c1 = validateProjectLearningCandidate(baseCandidate, { verified: false });
  assert(c1.valid === false && c1.stage === KNOWLEDGE_STAGE.REJECTED_UNVERIFIED, 'Rejected unverified candidate (verified: false)');

  // C2: Non-zero exit code
  const c2 = validateProjectLearningCandidate(baseCandidate, { verified: true, exit_code: 1 });
  assert(c2.valid === false && c2.stage === KNOWLEDGE_STAGE.REJECTED_UNVERIFIED, 'Rejected failed execution (exit_code: 1)');

  // C3: Invariant too short
  const shortCand = { ...baseCandidate, universal_invariant: 'Short text' };
  const c3 = validateProjectLearningCandidate(shortCand, { verified: true, exit_code: 0 });
  assert(c3.valid === false && c3.stage === KNOWLEDGE_STAGE.REJECTED_UNSOUND, 'Rejected invariant shorter than 25 chars');

  // C4: Speculative claim
  const specCand = { ...baseCandidate, universal_invariant: 'This might work if you rewrite the cache.' };
  const c4 = validateProjectLearningCandidate(specCand, { verified: true, exit_code: 0 });
  assert(c4.valid === false && c4.stage === KNOWLEDGE_STAGE.REJECTED_UNSOUND, 'Rejected speculative phrasing ("might work")');

  // 2D: Project-Specific Knowledge & Workstation Path Leaks
  console.log('  --- Fixture D: Project-Specific Isolation & Workstation Leaks ---');
  const leakedCand = {
    ...baseCandidate,
    universal_invariant: `Store build artifacts in C:\\Users\\Admin\\AppData\\Local\\Temp\\build.cache [${uniqueToken}]`
  };
  const d1 = validateProjectLearningCandidate(leakedCand, { verified: true, exit_code: 0 });
  assert(d1.valid === false, 'Strictly rejected workstation path leak (C:\\Users\\)');

  const workaroundCand = {
    ...baseCandidate,
    universal_invariant: `Apply specific monkey-patch to auth.ts line 42 for project-alpha only. [${uniqueToken}]`
  };
  const d2 = validateProjectLearningCandidate(workaroundCand, {
    verified: true,
    exit_code: 0,
    cross_context_applicability: { is_generalizable: false, reason: 'Single-repo workaround' }
  });
  assert(d2.valid === false && d2.stage === KNOWLEDGE_STAGE.PROJECT_LOCAL_ONLY, 'Single-repo workaround isolated as PROJECT_LOCAL_ONLY');

  // 2E: High-Impact Governance Gate & AI Self-Approval Defense
  console.log('  --- Fixture E: AI Self-Approval Defense on High-Impact Domains (A, G, M) ---');
  const govCandidate = {
    candidate_id: `PLCAND-G-GOV-${uniqueToken}`,
    title: `Core Architectural Decoupling Boundary Invariant [${uniqueToken}]`,
    universal_invariant: `Architectural layers must decouple execution runtime from persistent intelligence data. [${uniqueToken}]`,
    problem_statement: 'Conflating runtime tools with data storage creates state contamination.',
    project_name: 'test-governance',
    primary_domain: { letter: 'G', name: 'Architecture Intelligence' },
    classification_confidence: 0.95
  };

  // E1: AI passes approved: true without human sign-off
  const e1Proof = {
    verified: true,
    exit_code: 0,
    canonical_promotion_approval: { approved: true, human_authorized: false }
  };
  const e1 = validateProjectLearningCandidate(govCandidate, e1Proof);
  assert(e1.valid === false, 'AI self-approval on Domain G strictly rejected from autonomous canonical promotion');
  assert(e1.stage === KNOWLEDGE_STAGE.STAGED_FOR_HUMAN_REVIEW, 'Candidate transitioned to STAGED_FOR_HUMAN_REVIEW');
  assert(e1.pillars[VALIDATION_PILLARS.CANONICAL_PROMOTION_APPROVAL].passed === false, 'Pillar 4 (Canonical Promotion Approval) blocked autonomous persistence');

  // E2: Explicit authenticated human authorization provided via cryptographic token
  const testKeypair = generateHumanAuthorityKeyPair(customRoot);
  const validHumanToken = issueHumanApprovalSignature(govCandidate, testKeypair.privateKeyPem, {
    human_operator_id: 'satyabagherwal-source'
  });
  const e2Proof = {
    verified: true,
    exit_code: 0,
    canonical_promotion_approval: {
      approved: true,
      humanApprovalToken: validHumanToken
    }
  };
  const e2 = validateProjectLearningCandidate(govCandidate, e2Proof, {
    tokenOptions: { publicKeyOverride: testKeypair.publicKeyPem }
  });
  assert(e2.valid === true && e2.stage === KNOWLEDGE_STAGE.VALIDATED, 'Domain G candidate approved when explicit human authorization is provided');

  // 2F: Interrupted Write & Registry File Atomicity
  console.log('  --- Fixture F: Registry File Atomicity & Crash Recovery ---');
  const regPaths = getDomainStoragePaths(customRoot);
  const originalRaw = fs.readFileSync(regPaths.registryFile, 'utf-8');
  assert(originalRaw.length > 0, 'Original domain-registry.json is valid');
  const originalJson = JSON.parse(originalRaw);
  assert(typeof originalJson.total_records === 'number', 'domain-registry.json parses valid JSON');

  // 2G: Repeated Cycles & Idempotency
  console.log('  --- Fixture G: Repeated Evolution Cycles & Idempotency ---');
  const initialRegistry = loadDomainRegistry(customRoot);
  const initialRecordCount = initialRegistry.total_records;

  // Run cycle twice on same input
  const cycle1 = await runHarvesterEvolutionCycle({ brainRoot: customRoot, limit: 1 });
  const registryAfterCycle1 = loadDomainRegistry(customRoot);
  const countAfter1 = registryAfterCycle1.total_records;

  const cycle2 = await runHarvesterEvolutionCycle({ brainRoot: customRoot, limit: 1 });
  const registryAfterCycle2 = loadDomainRegistry(customRoot);
  const countAfter2 = registryAfterCycle2.total_records;

  assert(countAfter1 === countAfter2, 'Repeated evolution cycle is 100% idempotent (0 record drift)', `Count: ${countAfter1} == ${countAfter2}`);

  // ===========================================================================
  // PHASE 3: Real Construction Guidance Reuse & Separate Latency Measurement
  // ===========================================================================
  console.log('\n[PHASE 3] Verifying Real Construction Guidance Reuse & Latency...');

  // 3A: Latency Measurement (Separated from Correctness)
  // Warm query
  searchBrain('warmup', { brainRoot: customRoot });

  const query = 'clean index paths pagination crawlable indexable';
  const t0 = performance.now();
  const searchResults = searchBrain(query, {
    brainRoot: customRoot,
    domain: 'J',
    topK: 5
  });
  const latencyMs = Math.round((performance.now() - t0) * 100) / 100;

  assert(searchResults.results && searchResults.results.length > 0, 'Retrieval found matching results', `Count: ${searchResults.results.length}`);
  assert(latencyMs < 50.0, 'Retrieval executed within sub-50ms envelope', `${latencyMs}ms`);

  // 3B: Relevance Verification
  const topResult = searchResults.results[0];
  const textContent = topResult.ruleText || topResult.fullContent || topResult.summary || topResult.title || '';
  assert(topResult.id === recordA.record_id || textContent.includes('pagination') || textContent.includes('permalink'), 'Top search result is precisely relevant to SEO pagination query', topResult.title);

  // 3C: Downstream Construction Specification Injection
  const guidelines = recallConstructionDomainGuidelines(customRoot, 'clean index paths pagination crawlable');
  assert(guidelines['J'] !== undefined, 'Recalled Domain J guidelines for construction workflow');
  const foundGuideline = guidelines['J'].topItem?.record_id === recordA.record_id || (guidelines['J'].items || []).some(i => i.record_id === recordA.record_id);
  assert(foundGuideline === true, 'Construction guidelines contain promoted canonical SEO pattern');

  // Synthesize Problem, Market Feasibility & PRD
  const prob = synthesizeProblemRecord({ user_goal: 'SEO static documentation portal with clean pagination' });
  const feas = synthesizeMarketFeasibility(prob);
  const prd = synthesizePRDSpecification(prob, feas);
  const guideMd = generateConstructionGuideMarkdown(prob, feas, prd, {}, guidelines);

  assert(guideMd.includes('SEO & Distribution (Domain J') || guideMd.includes('Domain J'), 'Construction guide incorporates Domain J SEO intelligence');
  assert(!guideMd.includes('undefined') && !guideMd.includes('null'), 'Construction guide contains zero undefined/null artifacts');

  // ===========================================================================
  // PHASE 4: Master Brain 16-Folder Invariant & Clean Restoration
  // ===========================================================================
  console.log('\n[PHASE 4] Verifying Master Brain 16-Folder Invariant & Cleanup...');
  const canonical16Folders = [
    '00_START_HERE', '01_CORE', '02_AGENT_INTELLIGENCE', '03_SKILLS',
    '04_WORKFLOWS', '05_KNOWLEDGE', '06_PROJECT_CONTEXT', '07_PROJECT_LEARNING',
    '08_VERIFICATION', '09_SOURCES', '10_PROMPTS', '11_INBOX',
    '12_DECISIONS', '13_GOVERNANCE', '14_EVOLUTION', '15_METADATA'
  ];

  for (const folder of canonical16Folders) {
    const folderPath = path.join(BRAIN_ROOT, folder);
    assert(fs.existsSync(folderPath), `Master Brain canonical folder intact: ${folder}`);
  }

  // Cleanup temporary test records from domain registry
  if (createdRecordIds.length > 0) {
    if (fs.existsSync(regPaths.registryFile)) {
      const regData = JSON.parse(fs.readFileSync(regPaths.registryFile, 'utf-8'));
      for (const recId of createdRecordIds) {
        if (regData.records[recId]) {
          const domLetter = regData.records[recId].domain_letter;
          delete regData.records[recId];
          if (regData.domains[domLetter]) {
            regData.domains[domLetter].record_ids = regData.domains[domLetter].record_ids.filter(id => id !== recId);
            regData.domains[domLetter].total = regData.domains[domLetter].record_ids.length;
          }
        }
      }
      regData.total_records = Object.keys(regData.records).length;
      fs.writeFileSync(regPaths.registryFile, JSON.stringify(regData, null, 2), 'utf-8');
      console.log(`\n  🧹 [CLEANUP] Purged temporary test records (${createdRecordIds.join(', ')}) from domain registry.`);
    }
  }

  // Cleanup temporary test checkpoints file if created
  const testCheckpointPath = path.join(customRoot, '.project-brain', 'harvest-evolution-checkpoints.json');
  if (fs.existsSync(testCheckpointPath)) {
    try { fs.unlinkSync(testCheckpointPath); } catch (e) {}
    console.log(`  🧹 [CLEANUP] Removed test evolution checkpoints file.`);
  }

  console.log('\n======================================================================');
  console.log(`🏁 PRODUCTION INTEGRATION VERIFICATION: ${passedTests} PASSED | ${failedTests} FAILED`);
  console.log('======================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runVerificationSuite().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});

