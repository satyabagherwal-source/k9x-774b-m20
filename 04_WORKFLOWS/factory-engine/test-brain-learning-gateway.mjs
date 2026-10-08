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
  assert(gatewayResult.status === LEARNING_STATUS.VERIFIED, `Status is VERIFIED`);
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
  assert(indexedRecord?.status === LEARNING_STATUS.VERIFIED, `Index record status is VERIFIED`);
  assert(indexedRecord?.content_hash === testPkg.content_hash, `Index content_hash matches`);
  assert(indexedRecord?.brain_readback === true, `Index brain_readback is true`);

  const lookupStatus = getLearningStatus(testPkg.repository);
  assert(lookupStatus.status === LEARNING_STATUS.VERIFIED, `getLearningStatus() reports VERIFIED`);

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
  assert(failedResult.status === LEARNING_STATUS.FAILED_READBACK, `Status is FAILED_READBACK, not COMPLETED or SUCCESS`);

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
    cleanIndex.total_verified_learnings = Object.keys(cleanIndex.items).length;
    fs.writeFileSync(INDEX_PATH, JSON.stringify(cleanIndex, null, 2), 'utf-8');
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
