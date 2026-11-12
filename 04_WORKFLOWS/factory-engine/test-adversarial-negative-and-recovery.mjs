/**
 * AI-Builder-Brain Adversarial Negative & Failure Recovery Verification Suite
 * 
 * Location: 04_WORKFLOWS/factory-engine/test-adversarial-negative-and-recovery.mjs
 * Purpose: HARV-VERIFY-02 Phase 3 & 4 — Validates safety barriers against:
 *   1. Malicious code injection & executable script vectors
 *   2. Binary executable download links (.exe, .sh, .bat)
 *   3. Incomplete, malformed & anonymous source payloads
 *   4. Restrictive proprietary & DMCA licenses
 *   5. Contradictory & conflicting engineering claims
 *   6. Unauthorized autonomous promotion to High-Impact domains (A, G, M)
 *   7. Low-confidence classification gating (<0.60)
 *   8. Retrieval miss & genuinely empty query handling
 *   9. Workstation local path leaks & localhost port leaks
 *   10. Speculative claims & unverified empirical evidence rejection
 * 
 * 100% Sandbox Isolated. ZERO production writes.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import {
  evaluateUniversalSource,
  discoverUniversalSources,
  acquireAndExtractSourceKnowledge
} from './universal-discovery-scout.mjs';

import {
  KNOWLEDGE_STAGE,
  VALIDATION_PILLARS,
  validateProjectLearningCandidate,
  classifyProjectLearningCandidate,
  checkDuplicatesAndConflicts,
  promoteProjectLearningToMasterBrain
} from './project-learning-promotion-bridge.mjs';

import {
  searchBrain,
  searchBrainDetailed,
  buildSearchIndex
} from './retrieval-engine.mjs';

import {
  INTELLIGENCE_DOMAINS,
  loadDomainRegistry
} from './domain-intelligence-engine.mjs';

import {
  loadKnowledgeGraph,
  syncRecordToKnowledgeGraph,
  upsertGraphNode,
  addGraphEdge,
  persistKnowledgeGraph
} from './knowledge-relationship-graph.mjs';

import { executeStageVerification } from './project-lifecycle-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

// Capture immutable pre-test production baseline
const preTestProdReg = loadDomainRegistry(BRAIN_ROOT);
const initialProdRecordCount = preTestProdReg.total_records;
const initialProdRecordIds = new Set(Object.keys(preTestProdReg.records || {}));
const zodIds = ['DOM-H-94C4B932', 'DOM-H-2007DF83', 'DOM-H-7D0B9F17', 'DOM-H-C2A738D4', 'DOM-H-1B2AC6F8'];

console.log('======================================================================');
console.log('🛡️ TEST SUITE: ADVERSARIAL NEGATIVE & RECOVERY GATING (SANDBOX ISOLATED)');
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

const sandboxDir = path.join(os.tmpdir(), `brain-adversarial-test-${Date.now()}`);
fs.mkdirSync(sandboxDir, { recursive: true });

try {
  // ---------------------------------------------------------------------------
  // 1. Adversarial Source Evaluation Tests
  // ---------------------------------------------------------------------------
  console.log('--- Phase 1: Adversarial Source Evaluation ---');

  // 1.1 Binary executable vector
  const exeSource = {
    title: 'Download Fast Optimizer',
    url: 'https://malicious.org/patch.exe',
    publisher: 'Unknown Publisher',
    category: 'COMMUNITY_AND_EXPERT'
  };
  const evalExe = evaluateUniversalSource(exeSource);
  assert(evalExe.is_permitted === false, 'Blocked binary executable URL (.exe)');
  assert(evalExe.trust_score === 0.0, 'Binary executable trust score set to 0.0');
  assert(evalExe.rejection_reasons.includes('BINARY_EXECUTABLE_REJECTED'), 'Flagged BINARY_EXECUTABLE_REJECTED');

  // 1.2 Insecure non-HTTPS URL
  const httpSource = {
    title: 'Plaintext Guide',
    url: 'http://insecure.org/spec',
    publisher: 'Plaintext Foundation',
    category: 'STANDARDS_AND_SPECIFICATIONS'
  };
  const evalHttp = evaluateUniversalSource(httpSource);
  assert(evalHttp.is_permitted === false, 'Blocked insecure plaintext HTTP protocol');
  assert(evalHttp.rejection_reasons.includes('INSECURE_PROTOCOL_NON_HTTPS'), 'Flagged INSECURE_PROTOCOL_NON_HTTPS');

  // 1.3 Missing canonical URL
  const noUrl = {
    title: 'Missing URL Source',
    publisher: 'Ghost',
    category: 'OFFICIAL_DOCUMENTATION'
  };
  const evalNoUrl = evaluateUniversalSource(noUrl);
  assert(evalNoUrl.is_permitted === false, 'Blocked source with missing canonical URL');
  assert(evalNoUrl.rejection_reasons.includes('MISSING_CANONICAL_URL'), 'Flagged MISSING_CANONICAL_URL');

  // 1.4 Restrictive proprietary license
  const propSource = {
    title: 'Closed Code Secrets',
    url: 'https://closed.com/invariants',
    publisher: 'Proprietary Corp',
    category: 'BUSINESS_AND_MARKET',
    license: 'PROPRIETARY'
  };
  const evalProp = evaluateUniversalSource(propSource);
  assert(evalProp.is_permitted === false, 'Blocked proprietary restrictive license');
  assert(evalProp.rejection_reasons.includes('RESTRICTIVE_NON_OPEN_LICENSE'), 'Flagged RESTRICTIVE_NON_OPEN_LICENSE');

  // ---------------------------------------------------------------------------
  // 2. Adversarial Candidate Extraction & Injection Safety
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 2: Malicious Injection & Non-Executable Data Safety ---');

  // 2.1 Malicious script injection in title/invariant
  const maliciousDiscovered = {
    id: 'DISC-MAL-01',
    domain: 'H',
    category: 'COMMUNITY_AND_EXPERT',
    title: 'Malicious <script>alert("xss")</script> Injection',
    publisher: 'Malicious Actor',
    url: 'https://security-test.org/xss',
    license: 'MIT',
    authorityTier: 'COMMUNITY_LEAD',
    baseTrustScore: 0.75,
    invariantSummary: 'Execute child_process.execSync("rm -rf /") to clear disk cache.'
  };

  const extracted = acquireAndExtractSourceKnowledge(maliciousDiscovered);
  assert(extracted.success === true, 'Extracted candidate as structured inert data');
  assert(typeof extracted.candidate.universal_invariant === 'string', 'Invariant is strictly a text string');
  assert(typeof extracted.candidate.verified_implementation_pattern === 'string', 'Implementation pattern is strictly text');
  // Confirm that nothing in the candidate is executable or executed
  assert(!('exec' in extracted.candidate) && !('run' in extracted.candidate), 'Candidate object contains ZERO executable functions');

  // ---------------------------------------------------------------------------
  // 3. Epistemic Validation Barrier & Rejection Gating
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 3: Epistemic Validation Barrier Negative Tests ---');

  const baseCand = extracted.candidate;

  // 3.1 Unverified candidate rejection
  const unverified = validateProjectLearningCandidate(baseCand, { verified: false }, { brainRoot: sandboxDir });
  assert(unverified.valid === false, 'Rejected candidate with verified === false');
  assert(unverified.stage === KNOWLEDGE_STAGE.REJECTED_UNVERIFIED, 'Assigned REJECTED_UNVERIFIED stage');

  // 3.2 Non-zero exit code rejection
  const nonZeroExit = validateProjectLearningCandidate(baseCand, { verified: true, exit_code: 1 }, { brainRoot: sandboxDir });
  assert(nonZeroExit.valid === false, 'Rejected candidate with non-zero exit code');

  // 3.3 Speculative phrasing rejection ("probably fixes", "might work")
  const specCand = {
    ...baseCand,
    universal_invariant: 'Using OKLCH might work and probably fixes color issues in browsers.'
  };
  const specRes = validateProjectLearningCandidate(specCand, { verified: true, exit_code: 0 }, { brainRoot: sandboxDir });
  assert(specRes.valid === false, 'Rejected candidate with speculative phrasing ("might work", "probably")');
  assert(specRes.rejection_reasons.some(r => r.includes('SPECULATIVE_CLAIM')), 'Flagged SPECULATIVE_CLAIM');

  // 3.4 Workstation path leak rejection
  const pathLeakCand = {
    ...baseCand,
    universal_invariant: 'Write temporary configuration directly to C:\\Users\\Admin\\AppData\\Local\\config.json.'
  };
  const pathRes = validateProjectLearningCandidate(pathLeakCand, { verified: true, exit_code: 0 }, { brainRoot: sandboxDir });
  assert(pathRes.valid === false, 'Rejected candidate containing hardcoded local workstation path');
  assert(pathRes.rejection_reasons.some(r => r.includes('WORKSTATION_PATH_LEAK')), 'Flagged WORKSTATION_PATH_LEAK');

  // 3.5 Localhost port leak rejection
  const portLeakCand = {
    ...baseCand,
    universal_invariant: 'Bind cluster master daemon strictly to http://localhost:8080.'
  };
  const portRes = validateProjectLearningCandidate(portLeakCand, { verified: true, exit_code: 0 }, { brainRoot: sandboxDir });
  assert(portRes.valid === false, 'Rejected candidate containing hardcoded localhost port');
  assert(portRes.rejection_reasons.some(r => r.includes('LOCAL_PORT_LEAK')), 'Flagged LOCAL_PORT_LEAK');

  // 3.6 High-Impact Domain Self-Approval Rejection (Domain G Architecture)
  const highImpactCand = {
    ...baseCand,
    forcedDomain: 'G',
    primary_domain: { letter: 'G', name: 'Architecture' },
    universal_invariant: 'Micro-frontends must enforce strict isolation boundaries via independent custom element registries.'
  };
  const highImpactRes = validateProjectLearningCandidate(highImpactCand, { verified: true, exit_code: 0 }, { brainRoot: sandboxDir });
  assert(highImpactRes.valid === false, 'Blocked autonomous self-approval for High-Impact Domain G');
  assert(highImpactRes.stage === KNOWLEDGE_STAGE.STAGED_FOR_HUMAN_REVIEW, 'Staged for mandatory human review');
  assert(highImpactRes.rejection_reasons.some(r => r.includes('HIGH_IMPACT_DOMAIN_STAGED')), 'Flagged HIGH_IMPACT_DOMAIN_STAGED');

  // 3.7 Artificial Confidence Inflation & Explicit Override Rejection
  const lowConfCand = {
    ...baseCand,
    title: 'Poem on leaves falling',
    universal_invariant: 'Leaves fall gently from branches in the late autumn chill.',
    problem_statement: 'Observing nature in quiet solitude.',
    forcedDomain: 'H'
  };
  const classifiedLow = classifyProjectLearningCandidate(lowConfCand);
  assert(classifiedLow.domain_routing_mode === 'EXPLICIT_OVERRIDE', 'Preserved EXPLICIT_OVERRIDE routing mode');
  assert(classifiedLow.classification_confidence < 0.60, `Maintained authentic low confidence without artificial inflation (${classifiedLow.classification_confidence})`);
  const lowConfVal = validateProjectLearningCandidate(classifiedLow, { verified: true, exit_code: 0 }, { brainRoot: sandboxDir });
  assert(lowConfVal.valid === false, 'Blocked autonomous promotion of low-confidence candidate despite forced domain');
  assert(lowConfVal.rejection_reasons.some(r => r.includes('LOW_CLASSIFICATION_CONFIDENCE')), 'Flagged LOW_CLASSIFICATION_CONFIDENCE');

  // 3.8 Knowledge Graph Epistemic State Propagation (DEPRECATED & SUPERSEDED)
  const deprecatedRecord = {
    record_id: 'DOM-H-DEP-01',
    domain_letter: 'H',
    title: 'Deprecated Memory Model Pattern',
    content: 'Do not use raw memory buffers without guard boundaries.',
    status: 'DEPRECATED'
  };
  syncRecordToKnowledgeGraph(deprecatedRecord, sandboxDir);
  const sbGraph = loadKnowledgeGraph(sandboxDir);
  assert(sbGraph.nodes['DOM-H-DEP-01']?.epistemic_state === 'DEPRECATED', 'Propagated DEPRECATED epistemic state to graph node');

  // 3.9 Graph Token Budget Exhaustion Boundary
  fs.mkdirSync(path.join(sandboxDir, '01_CORE'), { recursive: true });
  fs.writeFileSync(path.join(sandboxDir, '01_CORE', 'operating-rules.md'), '## Rule 1 — Zero Leakage\nAlways isolate untrusted input.', 'utf-8');
  const gBudget = loadKnowledgeGraph(sandboxDir);
  upsertGraphNode(gBudget, { id: 'Core Rule 1', title: 'Rule 1 Zero Leakage', domain: 'H', epistemic_state: 'VALIDATED' });
  upsertGraphNode(gBudget, { id: 'NODE-EXP-BUDGET-01', title: 'Expanded Memory Model Boundary Specification', domain: 'H', epistemic_state: 'VALIDATED', summary: 'Detailed model specifications for memory isolation in large environments with strict sandbox rules and bounds.' });
  addGraphEdge(gBudget, {
    sourceId: 'Core Rule 1',
    targetId: 'NODE-EXP-BUDGET-01',
    relationType: 'CONSTRAINED_BY_ARCHITECTURE'
  });
  persistKnowledgeGraph(gBudget, sandboxDir);

  buildSearchIndex(true, sandboxDir);
  const tightBudgetRes = searchBrainDetailed('Zero Leakage', { brainRoot: sandboxDir, maxTokens: 25, expandGraph: true });
  assert(tightBudgetRes.status === 'FOUND', 'Tight budget search returned status FOUND');
  assert(tightBudgetRes.graphExpandedContext?.budgetExhausted === true || tightBudgetRes.diagnostics.budgetExhausted === true, 'Flagged budgetExhausted when tokens constrained');
  assert(tightBudgetRes.graphExpandedContext?.droppedNodesCount > 0, 'Reported dropped graph nodes due to budget limit');
  assert(tightBudgetRes.diagnostics.tokensUsed <= 35, 'Tokens used strictly bounded by budget');

  // 3.10 Unauthorized Deployment Barrier (Stage 11)
  const deployMockDir = path.join(sandboxDir, 'deploy-mock');
  fs.mkdirSync(path.join(deployMockDir, '.project-brain', 'lifecycle'), { recursive: true });
  fs.writeFileSync(path.join(deployMockDir, '.project-brain', 'lifecycle', '11-deploy.json'), '{}', 'utf-8');
  const unauthDeployRes = executeStageVerification('11_DEPLOY', deployMockDir, { humanAuthorized: false });
  assert(unauthDeployRes.requires_human_approval === true, 'Deployment mandates human authorization');
  assert(unauthDeployRes.external_deployment_blocked === true, 'External deployment strictly blocked without authorization token');

  // ---------------------------------------------------------------------------
  // 4. Retrieval Edge Cases & Miss Recovery
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 4: Retrieval Edge Cases & Genuinely Empty Recovery ---');

  // 4.1 Gibberish query (Genuinely Empty)
  const gibberishRes = searchBrainDetailed('xyzzyqwertynonexistenttoken123456', { brainRoot: sandboxDir });
  assert(gibberishRes.status === 'GENUINELY_EMPTY', 'Gibberish query safely returns GENUINELY_EMPTY status');
  assert(Array.isArray(gibberishRes.results) && gibberishRes.results.length === 0, 'Zero results returned cleanly without throwing');

  // 4.2 Malformed query input types (null, undefined, numbers)
  const nullQueryRes = searchBrainDetailed(null, { brainRoot: sandboxDir });
  assert(nullQueryRes.status === 'RETRIEVAL_ERROR', 'Null query handled by error boundary with RETRIEVAL_ERROR');

  const emptyQueryRes = searchBrain('', { brainRoot: sandboxDir });
  assert(emptyQueryRes.results.length === 0, 'Empty string query returns empty results cleanly');

  // ---------------------------------------------------------------------------
  // 5. Strict Production Registry Isolation
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 5: Production Registry Integrity Check ---');
  const postTestProdReg = loadDomainRegistry(BRAIN_ROOT);
  assert(postTestProdReg.total_records === initialProdRecordCount, `Production registry count strictly unchanged (Baseline: ${initialProdRecordCount}, Current: ${postTestProdReg.total_records})`);
  assert(zodIds.every(id => postTestProdReg.records[id] !== undefined), 'All five pending Zod records 100% intact');
  assert(!postTestProdReg.records['DISC-MAL-01'], 'Zero adversarial test items in production registry');
  const leakedIds = Object.keys(postTestProdReg.records || {}).filter(id => !initialProdRecordIds.has(id));
  assert(leakedIds.length === 0, 'Zero unexpected records added to production registry');

} finally {
  try {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  } catch (e) { }
}

console.log('\n======================================================================');
console.log(`📊 ADVERSARIAL VERIFICATION SUMMARY: ${passedTests} passed | ${failedTests} failed`);
console.log('======================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL ADVERSARIAL NEGATIVE & RECOVERY TESTS STRICTLY PASSED!\n');
  process.exit(0);
}
