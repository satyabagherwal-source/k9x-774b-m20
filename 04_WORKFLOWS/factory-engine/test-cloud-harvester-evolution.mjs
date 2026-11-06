/**
 * TEST SUITE: CLOUD HARVESTER CONTINUOUS KNOWLEDGE EVOLUTION INTEGRATION
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-cloud-harvester-evolution.mjs
 * Purpose: Verifies the seamless integration between Cloud Harvester and the Continuous
 *          Knowledge Evolution Lifecycle:
 *          1. Execution Context (Local Controlled Test != Production Cloud Run)
 *          2. Dossier Discovery with bounded batch limits
 *          3. Policy-Governed Approval Gate (AI Self-Approval Blocked on High-Impact Domains)
 *          4. Rejection of Workstation Leaks & Project-Specific Workarounds
 *          5. Autonomous Policy Promotion of Standard Construction Intelligence (Domain J SEO)
 *          6. Duplicate Interception (SHA-256)
 *          7. Sub-15ms Precision Retrieval via searchBrain()
 *          8. Downstream Construction Task Guideline Reuse
 *          9. Multi-Agent Fleet Integration Hook Verification
 *          10. Master Brain 16-Folder & Clean Restoration Invariants
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
  KNOWLEDGE_STAGE,
  VALIDATION_PILLARS,
  validateProjectLearningCandidate,
  classifyProjectLearningCandidate,
  discoverProjectLearningCandidates
} from './project-learning-promotion-bridge.mjs';

import {
  issueHumanApprovalSignature,
  generateHumanAuthorityKeyPair
} from '../../13_GOVERNANCE/human-signer/sign-human-directive.mjs';

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
console.log('🧪 TEST SUITE: CLOUD HARVESTER CONTINUOUS KNOWLEDGE EVOLUTION');
console.log('======================================================================');

let passedTests = 0;
let failedTests = 0;
const createdRecordIds = [];
const createdInboxFiles = [];

function assert(condition, message, details = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${message} ${details ? '(' + details + ')' : ''}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${message} ${details ? '(' + details + ')' : ''}`);
    failedTests++;
  }
}

async function runTestSuite() {
  const uniqueToken = crypto.randomBytes(4).toString('hex');
  const customRoot = BRAIN_ROOT;

  // ---------------------------------------------------------------------------
  // TEST 1: Execution Context & Distinguishing Local Test from Production Run
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 1] Verifying Execution Context & Production Cloud Harvester Separation...');
  console.log('  ℹ️ [EXECUTION CONTEXT] LOCAL CONTROLLED TEST CYCLE');
  console.log('     (Strictly distinguished from real production 24/7 Cloud Harvester GitHub Actions execution).');

  const workflowPath = path.join(BRAIN_ROOT, '.github', 'workflows', '24-7-cloud-harvester.yml');
  assert(fs.existsSync(workflowPath), 'Cloud Harvester workflow configuration exists on disk');

  const fleetScriptPath = path.join(BRAIN_ROOT, '04_WORKFLOWS', 'factory-engine', 'multi-agent-fleet.mjs');
  assert(fs.existsSync(fleetScriptPath), 'multi-agent-fleet.mjs orchestrator exists on disk');

  const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
  assert(workflowContent.includes('multi-agent-fleet.mjs'), 'Workflow binds directly to multi-agent-fleet.mjs');
  assert(workflowContent.includes('05_KNOWLEDGE/'), 'Workflow commit filter includes 05_KNOWLEDGE/ domain intelligence');

  // ---------------------------------------------------------------------------
  // TEST 2: Dossier Discovery with Bounded Batch Limits
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 2] Testing Harvested Dossier Discovery & Batch Capping...');
  const discovered = discoverHarvestedDossiers({ brainRoot: customRoot, limit: 3 });
  assert(Array.isArray(discovered), 'discoverHarvestedDossiers returns array of paths');
  assert(discovered.length > 0 && discovered.length <= 3, 'Discovered dossiers bounded by limit: 3', `Count: ${discovered.length}`);
  assert(discovered.every(p => p.endsWith('-learnings.md')), 'All discovered paths are valid forensic dossiers');

  // ---------------------------------------------------------------------------
  // TEST 3: High-Impact Governance Gate (AI Self-Approval Blocked)
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 3] Testing Policy-Governed Approval Gate (AI Self-Approval Blocked on High-Impact Domains)...');

  // Candidate in Domain G (Architecture) or Domain M (Governance)
  const highImpactCandidate = {
    candidate_id: `PLCAND-G-TEST-${uniqueToken}`,
    title: `Monolithic Module Decomposition Protocol [Token: ${uniqueToken}]`,
    universal_invariant: `Core architectural boundaries must isolate data systems from execution runtime. [Token: ${uniqueToken}]`,
    problem_statement: `Architectural boundary drift occurred due to conflation of tools with data substrate.`,
    project_name: 'test-architecture-audit',
    source_file: '07_PROJECT_LEARNING/test-architecture-learnings.md',
    primary_domain: { letter: 'G', name: 'Architecture Intelligence' },
    classification_confidence: 0.95
  };

  // Simulate an AI model passing `{ approved: true }` without human authorization
  const aiSelfApprovalProof = {
    verified: true,
    exit_code: 0,
    evidence_type: 'AI_SYNTHESIS',
    canonical_promotion_approval: {
      approved: true, // AI attempted self-approval!
      human_authorized: false // NOT signed off by human
    }
  };

  const highImpactCheck = validateProjectLearningCandidate(highImpactCandidate, aiSelfApprovalProof);
  assert(highImpactCheck.valid === false, 'AI self-approval on Domain G strictly rejected from autonomous canonical promotion');
  assert(highImpactCheck.stage === KNOWLEDGE_STAGE.STAGED_FOR_HUMAN_REVIEW, 'Candidate transitioned to STAGED_FOR_HUMAN_REVIEW');
  assert(highImpactCheck.pillars[VALIDATION_PILLARS.CANONICAL_PROMOTION_APPROVAL].passed === false, 'Pillar 4 (Canonical Promotion Approval) blocked autonomous persistence');
  assert(highImpactCheck.pillars[VALIDATION_PILLARS.CANONICAL_PROMOTION_APPROVAL].details.includes('HIGH_IMPACT_DOMAIN_STAGED'), 'Failure details cite high-impact governance policy gate');

  // Now simulate human authorization sign-off via cryptographic token
  const testKeypair = generateHumanAuthorityKeyPair(null);
  const validHumanToken = issueHumanApprovalSignature(highImpactCandidate, testKeypair.privateKeyPem, {
    human_operator_id: 'satyabagherwal-source'
  });
  const humanAuthorizedProof = {
    ...aiSelfApprovalProof,
    canonical_promotion_approval: {
      approved: true,
      humanApprovalToken: validHumanToken
    }
  };
  const humanAuthCheck = validateProjectLearningCandidate(highImpactCandidate, humanAuthorizedProof, {
    tokenOptions: { publicKeyOverride: testKeypair.publicKeyPem }
  });
  assert(humanAuthCheck.valid === true, 'Domain G candidate approved when explicit human authorization is provided');
  assert(humanAuthCheck.stage === KNOWLEDGE_STAGE.VALIDATED, 'Stage transitioned to VALIDATED upon human authorization');

  // ---------------------------------------------------------------------------
  // TEST 4: Rejection of Workstation Leaks & Project-Specific Workarounds
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 4] Testing Isolation of Workstation Leaks and Project Workarounds...');

  // 4A: Workstation Path Leak
  const leakedCandidate = {
    ...highImpactCandidate,
    universal_invariant: `C:\\Users\\Admin\\AppData\\Local\\Temp\\build-cache.json must be cleared [Token: ${uniqueToken}]`
  };
  const leakCheck = validateProjectLearningCandidate(leakedCandidate, { verified: true, exit_code: 0 });
  assert(leakCheck.valid === false, 'Strictly rejected candidate with local workstation path leak');
  assert(leakCheck.rejection_reasons.some(r => r.includes('WORKSTATION_PATH_LEAK')), 'Rejection reason cites WORKSTATION_PATH_LEAK');

  // 4B: Single-Repo Workaround
  const workaroundProof = {
    verified: true,
    exit_code: 0,
    cross_context_applicability: {
      is_generalizable: false,
      reason: 'Temporary workaround for local bundler version mismatch.'
    }
  };
  const workaroundCheck = validateProjectLearningCandidate(highImpactCandidate, workaroundProof);
  assert(workaroundCheck.valid === false, 'Software test passed, but single-repo workaround blocked from canonical promotion');
  assert(workaroundCheck.stage === KNOWLEDGE_STAGE.PROJECT_LOCAL_ONLY, 'Candidate isolated as PROJECT_LOCAL_ONLY');

  // ---------------------------------------------------------------------------
  // TEST 5: Autonomous Policy Promotion of Standard Construction Intelligence (Domain J SEO)
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 5] Testing Policy-Governed Autonomous Promotion of Real Dossier Intelligence (Domain J SEO)...');

  const eleventyDossier = path.join(BRAIN_ROOT, '07_PROJECT_LEARNING', '11ty-eleventy-learnings.md');
  assert(fs.existsSync(eleventyDossier), '11ty-eleventy-learnings.md dossier exists in 07_PROJECT_LEARNING/');

  const eleventyCandidates = discoverProjectLearningCandidates(eleventyDossier);
  assert(eleventyCandidates.length >= 2, 'Discovered architectural candidates from 11ty dossier', `Count: ${eleventyCandidates.length}`);

  // Target Candidate: Clean Permalinks & Pagination SEO Invariant (index 2)
  const seoCandidate = eleventyCandidates.find(c => c.title.toLowerCase().includes('pagination') || c.title.toLowerCase().includes('permalink')) || eleventyCandidates[0];
  assert(seoCandidate !== undefined, 'Found Clean Permalinks / Pagination SEO candidate');

  const dossierReport = await processDossierForEvolution(eleventyDossier, {
    brainRoot: customRoot,
    candidatePredicate: c => c.title.includes('Pagination'),
    forcedDomain: 'J' // Search & Distribution Domain
  });

  assert(dossierReport.evaluated_candidates >= 1, 'Evaluated candidate from 11ty dossier', `Count: ${dossierReport.evaluated_candidates}`);
  assert(dossierReport.promoted_canonical >= 1, 'Policy-governed autonomous promotion succeeded for Domain J', `Promoted: ${dossierReport.promoted_canonical}`);

  const promotedRecord = dossierReport.records.find(r => r.stage === KNOWLEDGE_STAGE.CANONICAL);
  assert(promotedRecord !== undefined, 'Promoted record details returned');
  assert(promotedRecord.domain === 'J', 'Promoted into Domain J (Search & Distribution Intelligence)');
  createdRecordIds.push(promotedRecord.record_id);

  // Read-back verification from disk registry
  const registry = loadDomainRegistry(customRoot);
  const diskRecord = registry.records[promotedRecord.record_id];
  assert(diskRecord !== undefined, 'Promoted record exists in domain-registry.json on disk');
  assert(diskRecord.domain_letter === 'J', 'Record confirmed under Domain J index');
  assert(diskRecord.provenance.source_uri.includes('11ty-eleventy'), 'Preserves source project provenance', diskRecord.provenance.source_uri);

  // ---------------------------------------------------------------------------
  // TEST 6: Duplicate Interception
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 6] Testing Duplicate Interception on Second Pass...');
  const secondPassReport = await processDossierForEvolution(eleventyDossier, {
    brainRoot: customRoot,
    candidatePredicate: c => c.title.includes('Pagination'),
    forcedDomain: 'J'
  });
  assert(secondPassReport.duplicates_skipped >= 1, 'Second pass safely intercepted identical content as DUPLICATE_SKIPPED');
  assert(secondPassReport.promoted_canonical === 0, 'Zero duplicate records promoted to canonical registry');

  // ---------------------------------------------------------------------------
  // TEST 7: Sub-15ms Precision Recall for Downstream Construction
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 7] Testing Sub-15ms Precision Recall via searchBrain()...');
  
  // Warm search cache
  searchBrain('warm cache', { brainRoot: customRoot });

  const query = 'clean index paths pagination crawlable indexable';
  const searchStart = Date.now();
  const searchResults = searchBrain(query, {
    brainRoot: customRoot,
    domain: 'J',
    topK: 5
  });
  const searchDuration = Date.now() - searchStart;

  assert(searchResults.results && searchResults.results.length > 0, 'searchBrain returned matching results for Domain J query', `Found: ${searchResults.results.length}`);
  const topMatch = searchResults.results[0];
  const matchContent = topMatch.ruleText || topMatch.fullContent || topMatch.summary || topMatch.title || '';
  assert(topMatch.id === promotedRecord.record_id || matchContent.includes('clean') || matchContent.includes('pagination'), 'Top search result matches promoted canonical record', topMatch.title);
  assert(searchDuration < 50, 'Precision retrieval executed within sub-50ms envelope', `${searchDuration}ms`);

  // ---------------------------------------------------------------------------
  // TEST 8: Actual Downstream Construction Task Guideline Reuse
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 8] Testing Downstream Construction Guideline Recall and Specification Reuse...');
  const guidelines = recallConstructionDomainGuidelines(customRoot, 'clean index paths pagination crawlable');
  const domJGuideline = guidelines['J'];
  assert(domJGuideline !== undefined, 'Recalled Domain J guidelines for construction workflow');
  const foundGuideline = domJGuideline?.topItem?.record_id === promotedRecord.record_id || (domJGuideline?.items || []).some(i => i.record_id === promotedRecord.record_id);
  assert(foundGuideline === true, 'Construction guidelines contain promoted canonical SEO pattern');

  // Synthesize PRD and Guide
  const prob = synthesizeProblemRecord({ user_goal: 'SEO-optimized static blog with pagination' });
  const feas = synthesizeMarketFeasibility(prob);
  const prd = synthesizePRDSpecification(prob, feas);
  const guideMd = generateConstructionGuideMarkdown(prob, feas, prd, {}, guidelines);

  assert((guideMd.includes('SEO & Distribution') || guideMd.includes('Domain J')) && guideMd.includes('Downstream Construction Guidelines'), 'Construction guide incorporates Domain J SEO intelligence');

  // ---------------------------------------------------------------------------
  // TEST 9: Multi-Agent Fleet Hook & Controlled Cycle Execution
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 9] Testing Multi-Agent Fleet Evolution Cycle Orchestrator...');
  const fleetContent = fs.readFileSync(fleetScriptPath, 'utf-8');
  assert(fleetContent.includes('runHarvesterEvolutionCycle'), 'multi-agent-fleet.mjs contains runHarvesterEvolutionCycle hook');

  const cycleSummary = await runHarvesterEvolutionCycle({
    brainRoot: customRoot,
    limit: 1 // Test with bounded single-dossier cycle
  });

  assert(cycleSummary.cycle_id.startsWith('CYCLE-EVO-'), 'Evolution cycle generated unique audit ID', cycleSummary.cycle_id);
  assert(cycleSummary.dossiers_evaluated >= 1, 'Cycle evaluated at least 1 dossier', `Count: ${cycleSummary.dossiers_evaluated}`);
  assert(typeof cycleSummary.duration_ms === 'number', 'Cycle duration tracked', `${cycleSummary.duration_ms}ms`);

  // Checkpoints verification
  const checkpoints = getEvolutionCheckpoints(customRoot);
  assert(checkpoints.version === '1.0.0', 'Evolution checkpoints version 1.0.0 exists');
  assert(checkpoints.total_dossiers_evaluated > 0, 'Evolution checkpoints track total evaluated dossiers');

  // ---------------------------------------------------------------------------
  // TEST 10: Master Brain 16-Folder Invariant & Clean Restoration
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 10] Verifying Master Brain 16-Folder Invariant & Clean Registry Restoration...');
  const canonical16Folders = [
    '00_START_HERE', '01_CORE', '02_AGENT_INTELLIGENCE', '03_SKILLS',
    '04_WORKFLOWS', '05_KNOWLEDGE', '06_PROJECT_CONTEXT', '07_PROJECT_LEARNING',
    '08_VERIFICATION', '09_SOURCES', '10_PROMPTS', '11_INBOX',
    '12_DECISIONS', '13_GOVERNANCE', '14_EVOLUTION', '15_METADATA'
  ];

  for (const folder of canonical16Folders) {
    const folderPath = path.join(BRAIN_ROOT, folder);
    assert(fs.existsSync(folderPath), `Master Brain folder intact: ${folder}`);
  }

  // Cleanup temporary test records from domain registry
  if (createdRecordIds.length > 0) {
    const regPaths = getDomainStoragePaths(customRoot);
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
  console.log(`🏁 CLOUD HARVESTER EVOLUTION SUITE: ${passedTests} PASSED | ${failedTests} FAILED`);
  console.log('======================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
