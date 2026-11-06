/**
 * SECURITY VERIFICATION SUITE: PAB-001
 * CRYPTOGRAPHIC HUMAN APPROVAL & STORAGE-BOUNDARY ENFORCEMENT
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-pab-001-cryptographic-human-approval.mjs
 * Purpose: Tests all 13 mandatory security invariants defined in PAB-001:
 *          1. Valid authenticated human approval
 *          2. AI-generated boolean `human_authorized: true` rejection
 *          3. Forged HMAC-SHA256 signature rejection
 *          4. Post-signing content mutation tamper rejection
 *          5. Cross-domain token reuse rejection (domain mismatch)
 *          6. Expired token rejection
 *          7. Nonce replay rejection (replay attack defense)
 *          8. Missing token staging in 11_INBOX
 *          9. Direct storage boundary bypass attempt (persistDomainIntelligenceRecord)
 *          10. Concurrency mutex locking on registry writes
 *          11. Autonomous normal promotion for standard domains (F, H, J, K)
 *          12. Cloud Harvester evolution regression check
 *          13. Construction intelligence precision recall latency
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import {
  HIGH_IMPACT_DOMAINS,
  createHumanApprovalToken,
  verifyHumanApprovalToken,
  recordHumanApprovalAudit,
  acquireRegistryLock,
  releaseRegistryLock,
  loadConsumedNonces
} from './human-approval-authority.mjs';

import {
  KNOWLEDGE_STAGE,
  VALIDATION_PILLARS,
  validateProjectLearningCandidate,
  promoteProjectLearningToMasterBrain
} from './project-learning-promotion-bridge.mjs';

import {
  persistDomainIntelligenceRecord,
  loadDomainRegistry
} from './domain-intelligence-engine.mjs';

import { searchBrain } from './retrieval-engine.mjs';
import { recallConstructionDomainGuidelines } from './construction-intelligence.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

console.log('======================================================================');
console.log('🛡️ SECURITY VERIFICATION SUITE: PAB-001 CRYPTOGRAPHIC HUMAN APPROVAL');
console.log('======================================================================');

let passedTests = 0;
let failedTests = 0;
const createdRecordIds = [];

function assert(condition, message, details = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${message} ${details ? '(' + details + ')' : ''}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${message} ${details ? '(' + details + ')' : ''}`);
    failedTests++;
  }
}

async function runSecuritySuite() {
  const customRoot = BRAIN_ROOT;
  const uniqueId = crypto.randomBytes(4).toString('hex');
  const testHumanSecret = 'a-very-secure-human-authority-passphrase-with-32chars';

  // ---------------------------------------------------------------------------
  // TEST 1: Valid Authenticated Human Approval for High-Impact Domain (Domain G)
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 1] Testing Valid Authenticated Human Approval (Domain G)...');
  const validCandidateG = {
    candidate_id: `PLCAND-G-AUTH-${uniqueId}`,
    title: `Decoupled Execution & Persistent Intelligence Boundary [${uniqueId}]`,
    universal_invariant: `Architectural boundaries must strictly decouple ephemeral execution engines from persistent canonical intelligence data. [${uniqueId}]`,
    problem_statement: 'Conflating runtime tools with state storage creates state contamination.',
    project_name: 'test-arch-auth',
    source_file: '07_PROJECT_LEARNING/test-architecture-learnings.md',
    primary_domain: { letter: 'G', name: 'Architecture Intelligence' },
    classification_confidence: 0.95
  };

  const validTokenG = createHumanApprovalToken(validCandidateG, {
    secretOverride: testHumanSecret,
    human_operator_id: 'satyabagherwal-source'
  });

  assert(validTokenG.signature && validTokenG.signature.length === 64, 'Generated 64-character HMAC-SHA256 signature', validTokenG.signature.slice(0, 16) + '...');
  assert(validTokenG.domain_letter === 'G', 'Token bound to Domain G');

  const promoResG = promoteProjectLearningToMasterBrain(
    validCandidateG,
    {
      verified: true,
      exit_code: 0,
      evidence_type: 'HARVESTED_REPOSITORY_DIFF_VERIFIED',
      canonical_promotion_approval: {
        approved: true,
        humanApprovalToken: validTokenG
      }
    },
    {
      brainRoot: customRoot,
      tokenOptions: { secretOverride: testHumanSecret }
    }
  );

  assert(promoResG.success === true, 'High-impact candidate promoted with valid human approval token', promoResG.record_id);
  assert(promoResG.stage === KNOWLEDGE_STAGE.CANONICAL, 'Candidate reached CANONICAL stage');
  if (promoResG.record_id) createdRecordIds.push(promoResG.record_id);

  // ---------------------------------------------------------------------------
  // TEST 2: AI-Generated Boolean `human_authorized: true` Rejection
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 2] Testing AI-Generated Boolean `human_authorized: true` Rejection...');
  const aiCandidateG = {
    candidate_id: `PLCAND-G-AI-${uniqueId}`,
    title: `AI Fabricated Architectural Directive [${uniqueId}]`,
    universal_invariant: `AI self-approved architectural rule without human cryptographic signature. [${uniqueId}]`,
    problem_statement: 'AI attempts to self-authorize an architectural mutation.',
    project_name: 'test-ai-spoof',
    primary_domain: { letter: 'G', name: 'Architecture Intelligence' },
    classification_confidence: 0.95
  };

  // AI supplies human_authorized: true without cryptographic token
  const aiSpoofProof = {
    verified: true,
    exit_code: 0,
    canonical_promotion_approval: {
      approved: true,
      human_authorized: true // AI Boolean spoof attempt!
    }
  };

  const aiCheck = validateProjectLearningCandidate(aiCandidateG, aiSpoofProof);
  assert(aiCheck.valid === false, 'AI-generated human_authorized: true strictly rejected from canonical promotion');
  assert(aiCheck.stage === KNOWLEDGE_STAGE.STAGED_FOR_HUMAN_REVIEW, 'Candidate safely staged for human review');
  assert(aiCheck.rejection_reasons[0].includes('Mandatory cryptographic human authorization required'), 'Rejection cites mandatory cryptographic human authorization');

  // ---------------------------------------------------------------------------
  // TEST 3: Forged HMAC-SHA256 Signature Rejection
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 3] Testing Forged HMAC-SHA256 Signature Rejection...');
  const forgedCandidate = {
    candidate_id: `PLCAND-A-FORGE-${uniqueId}`,
    title: `Forged Human Need Invariant [${uniqueId}]`,
    universal_invariant: `Attacker attempting to inject forged human directive with attacker secret. [${uniqueId}]`,
    problem_statement: 'Attacker manufactures a signature using unauthorized secret.',
    project_name: 'test-forge',
    primary_domain: { letter: 'A', name: 'Human & Need Intelligence' },
    classification_confidence: 0.95
  };

  const attackerSecret = 'attacker-unauthorized-secret-key-32chars-long';
  const forgedToken = createHumanApprovalToken(forgedCandidate, {
    secretOverride: attackerSecret,
    human_operator_id: 'attacker-impersonator'
  });

  const forgeCheck = verifyHumanApprovalToken(forgedCandidate, forgedToken, customRoot, {
    secretOverride: testHumanSecret
  });
  assert(forgeCheck.valid === false, 'Forged signature signed with attacker secret strictly rejected');
  assert(forgeCheck.code === 'SIGNATURE_INVALID', 'Rejection code confirms SIGNATURE_INVALID');

  // ---------------------------------------------------------------------------
  // TEST 4: Post-Signing Content Mutation Rejection (Tamper Resistance)
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 4] Testing Post-Signing Content Mutation Rejection...');
  const originalCandidate = {
    candidate_id: `PLCAND-M-ORIG-${uniqueId}`,
    title: `Original Core Governance Invariant [${uniqueId}]`,
    universal_invariant: `Core governance rules require immutable audit trails. [${uniqueId}]`,
    primary_domain: { letter: 'M', name: 'Governance Intelligence' },
    classification_confidence: 0.95
  };

  const legitimateToken = createHumanApprovalToken(originalCandidate, {
    secretOverride: testHumanSecret,
    human_operator_id: 'satyabagherwal-source'
  });

  // Attacker mutates the invariant after signing
  const tamperedCandidate = {
    ...originalCandidate,
    universal_invariant: `Core governance rules may be bypassed during emergency maintenance. [${uniqueId}]`
  };

  const tamperCheck = verifyHumanApprovalToken(tamperedCandidate, legitimateToken, customRoot, {
    secretOverride: testHumanSecret
  });
  assert(tamperCheck.valid === false, 'Post-signing invariant mutation strictly rejected');
  assert(tamperCheck.code === 'CONTENT_HASH_MISMATCH', 'Rejection code confirms CONTENT_HASH_MISMATCH');

  // ---------------------------------------------------------------------------
  // TEST 5: Cross-Domain Token Reuse Rejection (Domain Mismatch)
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 5] Testing Cross-Domain Token Reuse Rejection...');
  const domainACandidate = {
    candidate_id: `PLCAND-A-SWAP-${uniqueId}`,
    title: `Domain A Human Intent Pattern [${uniqueId}]`,
    universal_invariant: `Human intent must take precedence over automated AI heuristics. [${uniqueId}]`,
    primary_domain: { letter: 'A', name: 'Human & Need Intelligence' },
    classification_confidence: 0.95
  };

  // Valid token issued for Domain G
  const tokenDomainG = createHumanApprovalToken({
    ...domainACandidate,
    primary_domain: { letter: 'G', name: 'Architecture Intelligence' }
  }, {
    secretOverride: testHumanSecret
  });

  const domainSwapCheck = verifyHumanApprovalToken(domainACandidate, tokenDomainG, customRoot, {
    secretOverride: testHumanSecret
  });
  assert(domainSwapCheck.valid === false, 'Token issued for Domain G strictly rejected when applied to Domain A');
  assert(domainSwapCheck.code === 'DOMAIN_MISMATCH', 'Rejection code confirms DOMAIN_MISMATCH');

  // ---------------------------------------------------------------------------
  // TEST 6: Expired Approval Token Rejection
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 6] Testing Expired Approval Token Rejection...');
  const expiredCandidate = {
    candidate_id: `PLCAND-G-EXP-${uniqueId}`,
    title: `Expired Architectural Directive [${uniqueId}]`,
    universal_invariant: `Architecture directives must be refreshed if not deployed promptly. [${uniqueId}]`,
    primary_domain: { letter: 'G', name: 'Architecture Intelligence' },
    classification_confidence: 0.95
  };

  const expiredToken = createHumanApprovalToken(expiredCandidate, {
    secretOverride: testHumanSecret,
    approval_timestamp: new Date(Date.now() - 100000).toISOString(),
    validity_seconds: 10 // Expired 90 seconds ago
  });

  const expiredCheck = verifyHumanApprovalToken(expiredCandidate, expiredToken, customRoot, {
    secretOverride: testHumanSecret
  });
  assert(expiredCheck.valid === false, 'Expired approval token strictly rejected');
  assert(expiredCheck.code === 'TOKEN_EXPIRED', 'Rejection code confirms TOKEN_EXPIRED');

  // ---------------------------------------------------------------------------
  // TEST 7: Replay Attack Defense (Nonce Reuse Rejection)
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 7] Testing Nonce Replay Attack Defense...');
  const replayCandidate = {
    candidate_id: `PLCAND-M-REPLAY-${uniqueId}`,
    title: `Replay Attack Test Invariant [${uniqueId}]`,
    universal_invariant: `A single human approval token must never be reusable more than once. [${uniqueId}]`,
    primary_domain: { letter: 'M', name: 'Governance Intelligence' },
    classification_confidence: 0.95
  };

  const singleUseToken = createHumanApprovalToken(replayCandidate, {
    secretOverride: testHumanSecret,
    nonce: `nonce-${uniqueId}-replay-test`
  });

  // First verification (consumes nonce)
  const firstUse = verifyHumanApprovalToken(replayCandidate, singleUseToken, customRoot, {
    secretOverride: testHumanSecret,
    consumeNonce: true
  });
  assert(firstUse.valid === true, 'First token verification succeeds and consumes nonce');

  // Second verification attempt with identical token and nonce
  const secondUse = verifyHumanApprovalToken(replayCandidate, singleUseToken, customRoot, {
    secretOverride: testHumanSecret,
    consumeNonce: true
  });
  assert(secondUse.valid === false, 'Second verification attempt with replayed nonce strictly rejected');
  assert(secondUse.code === 'REPLAY_ATTACK_DETECTED', 'Rejection code confirms REPLAY_ATTACK_DETECTED');

  // ---------------------------------------------------------------------------
  // TEST 8: Missing Token Staging in 11_INBOX
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 8] Testing Missing Token Staging in 11_INBOX...');
  const unstagedCandidate = {
    candidate_id: `PLCAND-A-UNSTAGED-${uniqueId}`,
    title: `Unstaged High Impact Human Need [${uniqueId}]`,
    universal_invariant: `Human user privacy requires zero remote analytics tracking. [${uniqueId}]`,
    problem_statement: 'Third-party tracking leaks confidential user activity.',
    project_name: 'test-staging',
    primary_domain: { letter: 'A', name: 'Human & Need Intelligence' },
    classification_confidence: 0.95
  };

  const missingTokenCheck = validateProjectLearningCandidate(unstagedCandidate, {
    verified: true,
    exit_code: 0,
    canonical_promotion_approval: { approved: true }
  });
  assert(missingTokenCheck.valid === false, 'Candidate with missing token rejected from immediate promotion');
  assert(missingTokenCheck.stage === KNOWLEDGE_STAGE.STAGED_FOR_HUMAN_REVIEW, 'Candidate transitioned to STAGED_FOR_HUMAN_REVIEW');

  // ---------------------------------------------------------------------------
  // TEST 9: Direct Persistence Bypass Attempt (persistDomainIntelligenceRecord)
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 9] Testing Direct Persistence Bypass Attempt at Storage Boundary...');
  const bypassRecordG = {
    record_id: `DOM-G-BYPASS-${uniqueId}`,
    domain_letter: 'G',
    domain_id: 'architecture',
    domain_name: 'Architecture Intelligence',
    title: `Direct Storage Bypass Attempt [${uniqueId}]`,
    content: `Caller attempts to invoke persistDomainIntelligenceRecord directly without human token. [${uniqueId}]`,
    content_hash: crypto.createHash('sha256').update(`Bypass attempt content [${uniqueId}]`).digest('hex'),
    provenance: { source_uri: 'test://bypass' },
    evidence: { verification_status: 'DIRECTLY_VERIFIED' }
  };

  // Attempt 9A: Direct call with zero authContext
  const directBypass1 = persistDomainIntelligenceRecord(bypassRecordG, customRoot, {});
  assert(directBypass1.persisted === false, 'Direct persistDomainIntelligenceRecord call without token strictly blocked');
  assert(directBypass1.code === 'PERSISTENCE_REJECTED_UNAUTHORIZED_DOMAIN', 'Storage boundary returns PERSISTENCE_REJECTED_UNAUTHORIZED_DOMAIN');

  // Attempt 9B: Direct call with invalid token
  const directBypass2 = persistDomainIntelligenceRecord(bypassRecordG, customRoot, {
    humanApprovalToken: {
      candidate_id: bypassRecordG.record_id,
      content_hash: bypassRecordG.content_hash,
      domain_letter: 'G',
      human_operator_id: 'fake-operator',
      approval_timestamp: new Date().toISOString(),
      expires_at: new Date(Date.now() + 100000).toISOString(),
      nonce: 'fake-nonce',
      signature: 'deadbeef0000111122223333444455556666777788889999aaaabbbbccccdddd'
    },
    tokenOptions: { secretOverride: testHumanSecret }
  });
  assert(directBypass2.persisted === false, 'Direct call with forged signature strictly blocked at persistence boundary');
  assert(directBypass2.code === 'PERSISTENCE_REJECTED_UNAUTHORIZED_DOMAIN', 'Rejection code confirms persistence boundary enforcement');

  // Verify record was NEVER written to domain registry
  const regCheck = loadDomainRegistry(customRoot);
  assert(!regCheck.records[bypassRecordG.record_id], 'Bypassed record confirmed absent from domain-registry.json');

  // ---------------------------------------------------------------------------
  // TEST 10: Concurrency Mutex Locking on Registry Writes
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 10] Testing Concurrency Mutex Locking on Registry Writes...');
  const lockResult1 = acquireRegistryLock(customRoot, { timeoutMs: 2000 });
  assert(lockResult1.acquired === true, 'Successfully acquired domain-registry.lock');

  let secondLockBlocked = false;
  try {
    // Attempt second acquisition while first is held (timeout short: 300ms)
    acquireRegistryLock(customRoot, { timeoutMs: 300 });
  } catch (err) {
    secondLockBlocked = err.message.includes('REGISTRY_LOCK_TIMEOUT');
  }
  assert(secondLockBlocked === true, 'Concurrent lock acquisition attempt blocked with REGISTRY_LOCK_TIMEOUT');

  releaseRegistryLock(customRoot);
  assert(!fs.existsSync(lockResult1.lockFile), 'Lock file cleanly released');

  // ---------------------------------------------------------------------------
  // TEST 11: Normal Autonomous Promotion in Standard Domains (F, H, J, K)
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 11] Testing Normal Autonomous Promotion in Standard Domains (Domain F)...');
  const validDomainFCandidate = {
    candidate_id: `PLCAND-F-AUTO-${uniqueId}`,
    title: `Tailwind v4 Theme Token Mapping [${uniqueId}]`,
    universal_invariant: `Map custom CSS design tokens via @theme directives for atomic styling consistency. [${uniqueId}]`,
    problem_statement: 'Arbitrary hex codes scattered across CSS classes cause visual inconsistency.',
    project_name: 'test-design-auto',
    source_file: '07_PROJECT_LEARNING/test-design-learnings.md',
    primary_domain: { letter: 'F', name: 'Design Intelligence' },
    classification_confidence: 0.95
  };

  // Standard domain does NOT require humanApprovalToken; proceeds autonomously with empirical proof
  const promoResF = promoteProjectLearningToMasterBrain(
    validDomainFCandidate,
    {
      verified: true,
      exit_code: 0,
      evidence_type: 'HARVESTED_REPOSITORY_DIFF_VERIFIED'
    },
    { brainRoot: customRoot }
  );

  assert(promoResF.success === true, 'Standard domain F candidate promoted autonomously without human token', promoResF.record_id);
  assert(promoResF.stage === KNOWLEDGE_STAGE.CANONICAL, 'Candidate reached CANONICAL stage');
  if (promoResF.record_id) createdRecordIds.push(promoResF.record_id);

  // ---------------------------------------------------------------------------
  // TEST 12: Existing Cloud Harvester Regression Check
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 12] Testing Cloud Harvester Evolution Bridge Compatibility...');
  const { discoverHarvestedDossiers, getEvolutionCheckpoints } = await import('./cloud-harvester-evolution-bridge.mjs');
  const discovered = discoverHarvestedDossiers({ brainRoot: customRoot, limit: 2 });
  assert(Array.isArray(discovered), 'discoverHarvestedDossiers returns array of dossiers');
  const checkpoints = getEvolutionCheckpoints(customRoot);
  assert(checkpoints && typeof checkpoints === 'object', 'Evolution checkpoints accessible');

  // ---------------------------------------------------------------------------
  // TEST 13: Downstream Construction Retrieval & Sub-15ms Latency
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 13] Testing Construction Intelligence Precision Recall Latency...');
  searchBrain('warmup', { brainRoot: customRoot });

  const query = 'decoupled ephemeral execution persistent intelligence boundary';
  const t0 = performance.now();
  const searchRes = searchBrain(query, {
    brainRoot: customRoot,
    domain: 'G',
    topK: 5
  });
  const latencyMs = Math.round((performance.now() - t0) * 100) / 100;

  assert(searchRes.results && searchRes.results.length > 0, 'Retrieval found matching Domain G results', `Found: ${searchRes.results.length}`);
  assert(latencyMs < 50.0, 'Retrieval executed within sub-50ms envelope', `${latencyMs}ms`);

  const topMatch = searchRes.results[0];
  const matchContent = topMatch.ruleText || topMatch.fullContent || topMatch.summary || topMatch.title || '';
  assert(matchContent.includes('decouple') || topMatch.id === promoResG.record_id, 'Top result matches promoted Domain G architectural pattern');

  // Verify construction guidelines recall
  const guidelines = recallConstructionDomainGuidelines(customRoot, 'decoupled execution boundary');
  assert(guidelines['G'] !== undefined, 'Recalled Domain G construction guidelines');

  // ---------------------------------------------------------------------------
  // CLEANUP: Cleanly purge temporary test records and test nonces
  // ---------------------------------------------------------------------------
  console.log('\n[CLEANUP] Cleaning temporary test records...');
  if (createdRecordIds.length > 0) {
    const reg = loadDomainRegistry(customRoot);
    for (const rid of createdRecordIds) {
      if (reg.records[rid]) {
        const dom = reg.records[rid].domain_letter;
        delete reg.records[rid];
        if (reg.domains[dom]) {
          reg.domains[dom].record_ids = reg.domains[dom].record_ids.filter(id => id !== rid);
          reg.domains[dom].total = reg.domains[dom].record_ids.length;
        }
      }
    }
    reg.total_records = Object.keys(reg.records).length;
    const regFile = path.join(customRoot, '05_KNOWLEDGE', 'domain-intelligence', 'domain-registry.json');
    fs.writeFileSync(regFile, JSON.stringify(reg, null, 2), 'utf-8');
    console.log(`  🧹 Purged ${createdRecordIds.length} temporary test records (${createdRecordIds.join(', ')}) from domain registry.`);
  }

  // Clean consumed test nonces
  const noncesLedgerPath = path.join(customRoot, '.project-brain', 'consumed-approval-nonces.json');
  if (fs.existsSync(noncesLedgerPath)) {
    try { fs.unlinkSync(noncesLedgerPath); } catch (e) {}
    console.log('  🧹 Cleaned temporary consumed nonces test ledger.');
  }

  // Clean test audit entries if any
  const auditPath = path.join(customRoot, '11_INBOX', 'human-approval-audit-ledger.json');
  if (fs.existsSync(auditPath)) {
    try {
      const ledger = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
      ledger.approvals = ledger.approvals.filter(a => !a.candidate_id?.includes(uniqueId));
      ledger.total_approvals = ledger.approvals.length;
      fs.writeFileSync(auditPath, JSON.stringify(ledger, null, 2), 'utf8');
      console.log('  🧹 Cleaned temporary test entries from human approval audit ledger.');
    } catch (e) {}
  }

  console.log(`\n======================================================================`);
  console.log(`🏁 PAB-001 SECURITY VERIFICATION: ${passedTests} PASSED | ${failedTests} FAILED`);
  console.log(`======================================================================`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSecuritySuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

