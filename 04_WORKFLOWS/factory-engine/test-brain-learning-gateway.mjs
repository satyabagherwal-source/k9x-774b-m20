import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createLearningPackage,
  validateLearningPackage,
  submitToBrainGateway,
  readBackVerifyFile,
  loadKnowledgeIndex,
  getLearningStatus,
  LEARNING_STAGES,
  LEARNING_STATUS,
  INDEX_PATH
} from './brain-learning-gateway.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

async function runGatewayVerificationSuite() {
  console.log(`======================================================================`);
  console.log(`🧪 TEST SUITE: BRAIN LEARNING GATEWAY & READ-BACK VERIFICATION`);
  console.log(`======================================================================\n`);

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: Package Creation & State Flags
  // -------------------------------------------------------------------------
  console.log(`[TEST 1] Creating Immutable Learning Package...`);
  const mockDossier = `### Deep Architecture Analysis
This is an empirical forensic dossier extracted from test/repo.
Core abstractions, error handling, and resource lifecycles were inspected.
Substance threshold is met with extensive technical details and real patch diffs.`;

  const testPkg = createLearningPackage({
    repository: 'test-org/gateway-verifier',
    platform: 'github',
    slug: 'test-org-gateway-verifier',
    sourceUrl: 'https://github.com/test-org/gateway-verifier',
    sourceVersion: 'abc123456789',
    license: 'MIT',
    aiProvider: 'test-suite-agent',
    dossierText: mockDossier,
    candidateRules: [],
    auditEvidence: { fixesCount: 5, issuesCount: 3 }
  });

  assert(testPkg.stage === LEARNING_STAGES.EXTRACTED, `Initial stage is EXTRACTED`);
  assert(testPkg.status === LEARNING_STATUS.EXTRACTED_ONLY, `Initial status is EXTRACTED_ONLY (not stored in Brain)`);
  assert(testPkg.extracted === true, `extracted flag is true`);
  assert(testPkg.validated === false, `validated flag is false`);
  assert(testPkg.promoted_to_brain === false, `promoted_to_brain flag is false`);
  assert(testPkg.brain_write === false, `brain_write flag is false`);
  assert(testPkg.brain_readback === false, `brain_readback flag is false`);
  assert(testPkg.knowledge_index_updated === false, `knowledge_index_updated flag is false`);
  assert(typeof testPkg.content_hash === 'string' && testPkg.content_hash.length === 64, `Content hash is 64-char SHA-256`);

  // -------------------------------------------------------------------------
  // TEST 2: Validation Gate
  // -------------------------------------------------------------------------
  console.log(`\n[TEST 2] Testing Validation Gate...`);
  const valResult = validateLearningPackage(testPkg);
  assert(valResult.valid === true, `Valid package passes validation gate`);
  assert(testPkg.stage === LEARNING_STAGES.VALIDATED, `Stage advances to VALIDATED`);

  // Test rejection of empty dossier
  const invalidPkg = createLearningPackage({
    repository: 'invalid/empty-repo',
    dossierText: 'too short'
  });
  const invalidVal = validateLearningPackage(invalidPkg);
  assert(invalidVal.valid === false, `Invalid package (< 200 chars) is rejected by gate`);

  // -------------------------------------------------------------------------
  // TEST 3: Transactional Persistence Pipeline & Read-back Verification
  // -------------------------------------------------------------------------
  console.log(`\n[TEST 3] Executing Transactional Persistence Pipeline...`);
  const gatewayResult = await submitToBrainGateway(testPkg);

  assert(gatewayResult.success === true, `Gateway submission succeeded`);
  assert(gatewayResult.status === LEARNING_STATUS.VERIFIED_LEARNING, `Status is VERIFIED_LEARNING`);
  assert(gatewayResult.stage === LEARNING_STAGES.VERIFIED, `Stage is VERIFIED`);
  assert(gatewayResult.brain_write === true, `brain_write verified`);
  assert(gatewayResult.brain_readback === true, `brain_readback verified via SHA-256`);
  assert(gatewayResult.knowledge_index_updated === true, `knowledge_index_updated verified`);

  // -------------------------------------------------------------------------
  // TEST 4: Read-Back Verification from Disk
  // -------------------------------------------------------------------------
  console.log(`\n[TEST 4] Direct Disk Read-Back Verification...`);
  const dossierPath = path.join(BRAIN_ROOT, '07_PROJECT_LEARNING', `${testPkg.slug}-learnings.md`);
  assert(fs.existsSync(dossierPath), `Dossier file exists on disk: ${dossierPath}`);

  const diskVerify = readBackVerifyFile(dossierPath, testPkg.content_hash);
  assert(diskVerify.verified === true, `Disk read-back SHA-256 matches package content hash`);

  // -------------------------------------------------------------------------
  // TEST 5: Canonical Knowledge Index Query & Verification
  // -------------------------------------------------------------------------
  console.log(`\n[TEST 5] Verifying Knowledge Index Entry...`);
  const index = loadKnowledgeIndex();
  const indexedRecord = index.items[testPkg.learning_id];

  assert(Boolean(indexedRecord), `Index contains learning_id ${testPkg.learning_id}`);
  assert(indexedRecord?.verification_status === LEARNING_STATUS.VERIFIED_LEARNING, `Index record verification_status is VERIFIED_LEARNING`);
  assert(indexedRecord?.content_hash === testPkg.content_hash, `Index content_hash matches`);
  assert(indexedRecord?.brain_readback === true, `Index brain_readback is true`);

  const lookupStatus = getLearningStatus(testPkg.repository);
  assert(lookupStatus.status === LEARNING_STATUS.VERIFIED_LEARNING, `getLearningStatus() reports VERIFIED_LEARNING`);

  // -------------------------------------------------------------------------
  // TEST 6: Hard Invariant Negative Test (Tampered Content Read-back Failure)
  // -------------------------------------------------------------------------
  console.log(`\n[TEST 6] Testing Hard Invariant: Read-back Mismatch Rejection...`);
  const fakePkg = createLearningPackage({
    repository: 'test-org/tampered-repo',
    platform: 'github',
    slug: 'test-org-tampered-repo',
    dossierText: 'Valid length text with extensive architectural details that meets the substance threshold but will have its cryptographic hash deliberately corrupted to simulate a write corruption or disk fault.'
  });

  // Deliberately tamper with hash
  fakePkg.content_hash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
  fakePkg.validated = true;
  fakePkg.stage = LEARNING_STAGES.VALIDATED;

  const failedResult = await submitToBrainGateway(fakePkg);
  assert(failedResult.success === false, `Gateway rejects tampered package with hash mismatch`);
  assert(failedResult.status === LEARNING_STATUS.FAILED_PERSISTENCE, `Status is FAILED_PERSISTENCE, not COMPLETED or SUCCESS`);

  // -------------------------------------------------------------------------
  // TEST 7: Checkpoint Verification (Only VERIFIED is Durable Progress)
  // -------------------------------------------------------------------------
  console.log(`\n[TEST 7] Testing Harvest Checkpoint Persistence...`);
  const checkpointsPath = path.join(BRAIN_ROOT, '.project-brain', 'harvest-checkpoints.json');
  assert(fs.existsSync(checkpointsPath), `harvest-checkpoints.json exists`);
  const checkpoints = JSON.parse(fs.readFileSync(checkpointsPath, 'utf-8'));
  const testCheckpoint = checkpoints.checkpoints?.[testPkg.repository];
  assert(Boolean(testCheckpoint), `Checkpoint exists for ${testPkg.repository}`);
  assert(testCheckpoint?.stage === LEARNING_STAGES.VERIFIED, `Checkpoint stage is VERIFIED`);
  assert(testCheckpoint?.status === LEARNING_STATUS.VERIFIED_LEARNING, `Checkpoint status is VERIFIED_LEARNING`);
  assert(testCheckpoint?.content_hash === testPkg.content_hash, `Checkpoint records exact SHA-256 content hash`);
  assert(Boolean(testCheckpoint?.verified_at), `Checkpoint has valid verified_at timestamp`);

  // -------------------------------------------------------------------------
  // TEST 8: Rule Promotion Verification & ALREADY_PRESENT_VERIFIED Check
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // TEST 8: Rule Promotion Verification & ALREADY_PRESENT_VERIFIED Check
  // -------------------------------------------------------------------------
  console.log(`\n[TEST 8] Testing Rule Promotion & ALREADY_PRESENT_VERIFIED Handling...`);
  const candidateRuleBody = `### Transactional Verification Barrier Protocol
**RULE**: Never mark a candidate learning artifact as COMPLETED or SUCCESS until physical write-back and cryptographic SHA-256 validation succeed.
**WHY**: Ephemeral execution environments such as cloud CI runners lose state if data is not durably pushed.
**WHEN TO APPLY**: Every harvesting session across GitHub, Hugging Face, or local pipelines.
**VERIFIED IMPLEMENTATION PATTERN**:
\`\`\`javascript
const readBack = readBackVerifyFile(path, hash);
if (!readBack.verified) throw new Error('FAILED_PERSISTENCE');
\`\`\`
**NEGATIVE CONSTRAINT**: Do not trust stdout console strings like SUCCESS or ZERO-CLONE SAVED as proof of storage.`;

  const rulePkg = createLearningPackage({
    repository: 'test-org/rule-verifier',
    platform: 'github',
    slug: 'test-org-rule-verifier',
    dossierText: 'Deep structural analysis of error boundary lifecycles with extensive code diffs and real bug autopsies to meet the substance threshold easily.',
    candidateRules: [
      {
        title: 'Transactional Knowledge Gateway & Mandatory Read-Back Persistence Barrier',
        body: candidateRuleBody
      }
    ]
  });

  const ruleVal = validateLearningPackage(rulePkg);
  assert(ruleVal.valid === true, `Rule package validates successfully`);
  assert(rulePkg.validated_rules.length === 1, `Candidate rule is attached and validated`);

  // Test submitting rule package to gateway: Rule 259 already exists, so it must return ALREADY_PRESENT_VERIFIED!
  const ruleGatewayRes = await submitToBrainGateway(rulePkg);
  assert(ruleGatewayRes.success === true, `Gateway submission succeeded for rule package`);
  assert(ruleGatewayRes.status === LEARNING_STATUS.VERIFIED_LEARNING, `Gateway status is VERIFIED_LEARNING`);
  assert(ruleGatewayRes.promoted_rules.length === 1, `Rule was evaluated`);
  assert(ruleGatewayRes.promoted_rules[0].status === LEARNING_STATUS.ALREADY_PRESENT_VERIFIED, `Rule was correctly classified as ALREADY_PRESENT_VERIFIED (Rule 259)`);

  // -------------------------------------------------------------------------
  // TEST 9: Empty File (0 Bytes) Rejection in Read-Back Verification
  // -------------------------------------------------------------------------
  console.log(`\n[TEST 9] Testing Empty File (0 Bytes) Rejection in Read-Back...`);
  const emptyFilePath = path.join(BRAIN_ROOT, '07_PROJECT_LEARNING', 'temp-empty-test.md');
  fs.writeFileSync(emptyFilePath, '', 'utf-8');
  const emptyVerify = readBackVerifyFile(emptyFilePath, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert(emptyVerify.verified === false, `Empty file (0 bytes) is rejected by readBackVerifyFile`);
  assert(emptyVerify.reason.includes('0 bytes'), `Reason explains 0 bytes rejection`);
  if (fs.existsSync(emptyFilePath)) fs.unlinkSync(emptyFilePath);

  // -------------------------------------------------------------------------
  // Cleanup Test Artifacts
  // -------------------------------------------------------------------------
  try {
    if (fs.existsSync(dossierPath)) fs.unlinkSync(dossierPath);
    const tamperedPath = path.join(BRAIN_ROOT, '07_PROJECT_LEARNING', `${fakePkg.slug}-learnings.md`);
    if (fs.existsSync(tamperedPath)) fs.unlinkSync(tamperedPath);

    // Clean test entries from index
    const cleanIndex = loadKnowledgeIndex();
    delete cleanIndex.items[testPkg.learning_id];
    delete cleanIndex.items[fakePkg.learning_id];
    delete cleanIndex.items[rulePkg.learning_id];
    cleanIndex.total_verified_learnings = Object.keys(cleanIndex.items).length;
    fs.writeFileSync(INDEX_PATH, JSON.stringify(cleanIndex, null, 2), 'utf-8');

    // Clean test checkpoint
    delete checkpoints.checkpoints[testPkg.repository];
    delete checkpoints.checkpoints[fakePkg.repository];
    delete checkpoints.checkpoints[rulePkg.repository];
    fs.writeFileSync(checkpointsPath, JSON.stringify(checkpoints, null, 2), 'utf-8');
  } catch (cleanErr) {
    console.warn(`Cleanup note: ${cleanErr.message}`);
  }

  console.log(`\n======================================================================`);
  console.log(`🏁 GATEWAY TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log(`======================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runGatewayVerificationSuite();
