/**
 * SECURITY VERIFICATION SUITE: PAB-003
 * ISOLATED HUMAN APPROVAL & TRUSTED SIGNING ARCHITECTURE
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-pab-003-isolated-signing-architecture.mjs
 * Purpose: Empirically tests all 18 security invariants defined in PAB-003:
 * 
 *  1. Invariant 1: Automated Agent Signing Elimination (zero signing exports in Brain runtime)
 *  2. Invariant 2: Harvester Worker Environment Sanitization (allowlist strips human secrets)
 *  3. Invariant 3: Verification-Only Public Boundary (public key only in Brain boundary)
 *  4. Invariant 4: Standalone Signer Interactive TTY Check (headless signing fails closed)
 *  5. Invariant 5: Human Denial Rejection (operator abort produces no signature)
 *  6. Invariant 6: Valid Asymmetric Ed25519 Token Verification
 *  7. Invariant 7: Candidate Tampering / Content-Hash Mutation Invalidation
 *  8. Invariant 8: Domain Mismatch Rejection
 *  9. Invariant 9: Nonce Replay Barrier
 * 10. Invariant 10: Expired Token Rejection
 * 11. Invariant 11: Mismatched / Forged Signature Rejection
 * 12. Invariant 12: Direct Storage Bypass Rejection (Domain A, G, M)
 * 13. Invariant 13: Crash-Safe Transaction Ordering (Nonce Unconsumed on Write Failure)
 * 14. Invariant 14: Safe Mutex File Locking & Lost Update Prevention
 * 15. Invariant 15: PID-Liveness Lock Theft Defense (live processes never stolen from)
 * 16. Invariant 16: Autonomous Non-High-Impact Promotion (Domains F, H, J, K continue working)
 * 17. Invariant 17: Durable Audit Logging in 11_INBOX/human-approval-audit-ledger.json
 * 18. Invariant 18: Master Brain 16-Directory Invariant & Sub-50ms Precision Retrieval
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fork, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

import * as BrainApprovalAuthority from './human-approval-authority.mjs';
import {
  HIGH_IMPACT_DOMAINS,
  verifyHumanApprovalToken,
  recordHumanApprovalAudit,
  recordConsumedNonce,
  loadConsumedNonces,
  acquireRegistryLock,
  releaseRegistryLock,
  isProcessPidAlive,
  getHumanAuthorityPublicKey
} from './human-approval-authority.mjs';

import {
  getSanitizedWorkerEnv
} from './multi-agent-fleet.mjs';

import {
  generateHumanAuthorityKeyPair,
  resolveHumanPrivateKey,
  issueHumanApprovalSignature,
  runSignerCli
} from '../../13_GOVERNANCE/human-signer/sign-human-directive.mjs';

import {
  KNOWLEDGE_STAGE,
  VALIDATION_PILLARS,
  validateProjectLearningCandidate,
  promoteProjectLearningToMasterBrain
} from './project-learning-promotion-bridge.mjs';

import {
  createDomainIntelligenceRecord,
  persistDomainIntelligenceRecord,
  loadDomainRegistry,
  getDomainStoragePaths
} from './domain-intelligence-engine.mjs';

import { searchBrain } from './retrieval-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    totalPassed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    totalFailed++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTestSuite() {
  console.log('======================================================================');
  console.log('🛡️  SECURITY TEST SUITE: PAB-003 ISOLATED SIGNING ARCHITECTURE');
  console.log('   Canonical Identity: AI THINKS. BRAIN STORES. TOOLS EXECUTE.');
  console.log('   Timestamp: ' + new Date().toISOString());
  console.log('======================================================================\n');

  // Setup isolated temporary test directory
  const testRunId = `PAB003-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const tempTestRoot = path.join(BRAIN_ROOT, '.project-brain', 'simulation-sandbox', testRunId);
  fs.mkdirSync(tempTestRoot, { recursive: true });

  const tempPbDir = path.join(tempTestRoot, '.project-brain');
  const tempKnowledgeDir = path.join(tempTestRoot, '05_KNOWLEDGE', 'domain-intelligence');
  const tempInboxDir = path.join(tempTestRoot, '11_INBOX');
  fs.mkdirSync(tempPbDir, { recursive: true });
  fs.mkdirSync(tempKnowledgeDir, { recursive: true });
  fs.mkdirSync(tempInboxDir, { recursive: true });

  // Generate test Ed25519 keypair for the test run
  const testKeypair = generateHumanAuthorityKeyPair(tempTestRoot);

  try {
    // -------------------------------------------------------------------------
    // INVARIANT 1: Automated Agent Signing Elimination
    // -------------------------------------------------------------------------
    console.log('[INVARIANT 1] Automated Agent Signing Elimination from Brain Runtime...');
    assert(
      typeof BrainApprovalAuthority.createHumanApprovalToken === 'undefined',
      'human-approval-authority.mjs exports zero signing functions (createHumanApprovalToken is eliminated)'
    );
    assert(
      typeof BrainApprovalAuthority.sign === 'undefined' &&
      typeof BrainApprovalAuthority.issueSignature === 'undefined',
      'Brain runtime possesses zero signing capabilities'
    );

    // -------------------------------------------------------------------------
    // INVARIANT 2: Harvester Worker Environment Sanitization
    // -------------------------------------------------------------------------
    console.log('\n[INVARIANT 2] Harvester Worker Environment Sanitization...');
    const dirtyEnv = {
      AI_BUILDER_BRAIN_HUMAN_PRIVATE_KEY: 'test-private-key-leak',
      HUMAN_SIGNING_KEY: 'secret-signing-key',
      MY_SECRET_TOKEN: 'top-secret',
      GITHUB_TOKEN: 'ghp_valid_token_123',
      HF_TOKEN: 'hf_valid_token_456',
      GEMINI_API_KEY: 'gemini_valid_key_789',
      PATH: process.env.PATH || '',
      SYSTEMROOT: process.env.SYSTEMROOT || ''
    };
    const sanitized = getSanitizedWorkerEnv(dirtyEnv);
    assert(typeof sanitized.AI_BUILDER_BRAIN_HUMAN_PRIVATE_KEY === 'undefined', 'Human private key stripped from child worker environment');
    assert(typeof sanitized.HUMAN_SIGNING_KEY === 'undefined', 'HUMAN_SIGNING_KEY stripped from child worker environment');
    assert(typeof sanitized.MY_SECRET_TOKEN === 'undefined', 'Generic secret stripped by allowlist');
    assert(sanitized.GITHUB_TOKEN === 'ghp_valid_token_123', 'Worker allowlist preserves GITHUB_TOKEN');
    assert(sanitized.HF_TOKEN === 'hf_valid_token_456', 'Worker allowlist preserves HF_TOKEN');
    assert(sanitized.GEMINI_API_KEY === 'gemini_valid_key_789', 'Worker allowlist preserves GEMINI_API_KEY');

    // -------------------------------------------------------------------------
    // INVARIANT 3: Verification-Only Public Boundary
    // -------------------------------------------------------------------------
    console.log('\n[INVARIANT 3] Verification-Only Public Boundary in Master Brain...');
    const loadedPubKey = getHumanAuthorityPublicKey(tempTestRoot);
    assert(loadedPubKey !== null && loadedPubKey.includes('BEGIN PUBLIC KEY'), 'Public verification key loaded cleanly from disk');
    assert(!loadedPubKey.includes('PRIVATE KEY'), 'Verification boundary possesses strictly public key, NEVER private key');

    // -------------------------------------------------------------------------
    // INVARIANT 4: Standalone Signer Interactive TTY Check
    // -------------------------------------------------------------------------
    console.log('\n[INVARIANT 4] Standalone Signer Interactive TTY Rejection Check...');
    const dummyCandidatePath = path.join(tempTestRoot, 'test-candidate.json');
    fs.writeFileSync(dummyCandidatePath, JSON.stringify({
      candidate_id: 'PLCAND-TEST01',
      title: 'Structural Architecture Boundary Invariant',
      domain_letter: 'G',
      universal_invariant: 'Architecture boundaries must enforce unidirectional data flow.'
    }), 'utf8');

    const cliPath = path.join(BRAIN_ROOT, '13_GOVERNANCE', 'human-signer', 'sign-human-directive.mjs');
    const headlessRun = spawnSync(process.execPath, [cliPath, '--candidate', dummyCandidatePath], {
      stdio: ['pipe', 'pipe', 'pipe'] // headless stdin/stdout
    });
    const stdout = headlessRun.stdout ? headlessRun.stdout.toString() : '';
    const stderr = headlessRun.stderr ? headlessRun.stderr.toString() : '';
    assert(
      stderr.includes('SIGNER_NON_INTERACTIVE_REJECTED') || stderr.includes('interactive human TTY'),
      'Headless invocation without authorized flag fails closed (SIGNER_NON_INTERACTIVE_REJECTED)'
    );

    // -------------------------------------------------------------------------
    // INVARIANT 5: Human Denial Rejection
    // -------------------------------------------------------------------------
    console.log('\n[INVARIANT 5] Human Denial Rejection...');
    // Explicit operator rejection via CLI
    const deniedRun = spawnSync(process.execPath, [cliPath, '--candidate', dummyCandidatePath, '--reject'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const deniedStdout = deniedRun.stdout ? deniedRun.stdout.toString() : '';
    assert(
      deniedStdout.includes('HUMAN_REJECTED_APPROVAL'),
      'Operator refusal produces zero signature (HUMAN_REJECTED_APPROVAL)'
    );
    assert(deniedRun.status === 1, 'Signer process exits with exit code 1 on operator rejection');

    // -------------------------------------------------------------------------
    // INVARIANT 6: Valid Asymmetric Ed25519 Token Verification
    // -------------------------------------------------------------------------
    console.log('\n[INVARIANT 6] Valid Asymmetric Ed25519 Token Verification...');
    const candidateG = {
      candidate_id: 'PLCAND-ARCH01',
      domain_letter: 'G',
      title: 'Hexagonal Architecture Storage Decoupling',
      universal_invariant: 'All storage engines must be decoupled from domain entities via repository contracts.',
      problem_statement: 'Direct coupling to SQLite creates vendor lock-in and prevents memory testing.'
    };
    const validTokenG = issueHumanApprovalSignature(candidateG, testKeypair.privateKeyPem, {
      human_operator_id: 'satyabagherwal-governance',
      customRoot: tempTestRoot
    });
    assert(typeof validTokenG.signature === 'string' && validTokenG.signature.length > 64, 'Token contains cryptographic Ed25519 hex signature');
    
    const verifG = verifyHumanApprovalToken(candidateG, validTokenG, tempTestRoot, {
      publicKeyOverride: testKeypair.publicKeyPem
    });
    assert(verifG.valid === true, 'Valid Ed25519 human signature verified successfully');
    assert(verifG.code === 'APPROVAL_VERIFIED', 'Verification code is APPROVAL_VERIFIED');

    // -------------------------------------------------------------------------
    // INVARIANT 7: Candidate Tampering / Content-Hash Mutation Invalidation
    // -------------------------------------------------------------------------
    console.log('\n[INVARIANT 7] Candidate Tampering / Content-Hash Mutation Invalidation...');
    const tamperedCandidateG = {
      ...candidateG,
      universal_invariant: 'Tampered invariant injected after human operator signed the directive.'
    };
    const verifTampered = verifyHumanApprovalToken(tamperedCandidateG, validTokenG, tempTestRoot, {
      publicKeyOverride: testKeypair.publicKeyPem
    });
    assert(verifTampered.valid === false, 'Tampered candidate content rejected');
    assert(verifTampered.code === 'CONTENT_HASH_MISMATCH', 'Rejection code confirms CONTENT_HASH_MISMATCH');

    // -------------------------------------------------------------------------
    // INVARIANT 8: Domain Mismatch Rejection
    // -------------------------------------------------------------------------
    console.log('\n[INVARIANT 8] Domain Mismatch Rejection...');
    const candidateA = {
      candidate_id: 'PLCAND-HUMAN01',
      domain_letter: 'A', // Candidate is Domain A, but token was issued for Domain G
      title: 'Human Intent Boundary',
      universal_invariant: candidateG.universal_invariant,
      content_hash: validTokenG.content_hash
    };
    const verifDomainMismatch = verifyHumanApprovalToken(candidateA, validTokenG, tempTestRoot, {
      publicKeyOverride: testKeypair.publicKeyPem
    });
    assert(verifDomainMismatch.valid === false, 'Cross-domain token reuse strictly rejected');
    assert(verifDomainMismatch.code === 'DOMAIN_MISMATCH', 'Rejection code confirms DOMAIN_MISMATCH');

    // -------------------------------------------------------------------------
    // INVARIANT 9: Nonce Replay Barrier
    // -------------------------------------------------------------------------
    console.log('\n[INVARIANT 9] Nonce Replay Barrier...');
    const candidateReplay = {
      candidate_id: 'PLCAND-REPLAY01',
      domain_letter: 'M',
      title: 'Governance Evolution Invariant',
      universal_invariant: 'Governance changes require cryptographic human ratification.'
    };
    const replayToken = issueHumanApprovalSignature(candidateReplay, testKeypair.privateKeyPem, {
      human_operator_id: 'satyabagherwal-governance',
      customRoot: tempTestRoot
    });

    const verifFirstPass = verifyHumanApprovalToken(candidateReplay, replayToken, tempTestRoot, {
      publicKeyOverride: testKeypair.publicKeyPem,
      consumeNonce: true
    });
    assert(verifFirstPass.valid === true, 'First verification of token passes and consumes nonce');

    const verifSecondPass = verifyHumanApprovalToken(candidateReplay, replayToken, tempTestRoot, {
      publicKeyOverride: testKeypair.publicKeyPem,
      consumeNonce: true
    });
    assert(verifSecondPass.valid === false, 'Second presentation of same nonce is blocked');
    assert(verifSecondPass.code === 'REPLAY_ATTACK_DETECTED', 'Replay attack blocked with REPLAY_ATTACK_DETECTED');

    // -------------------------------------------------------------------------
    // INVARIANT 10: Expired Token Rejection
    // -------------------------------------------------------------------------
    console.log('\n[INVARIANT 10] Expired Token Rejection...');
    const expiredToken = issueHumanApprovalSignature(candidateG, testKeypair.privateKeyPem, {
      human_operator_id: 'satyabagherwal-governance',
      validity_seconds: -10 // expired in the past
    });
    const verifExpired = verifyHumanApprovalToken(candidateG, expiredToken, tempTestRoot, {
      publicKeyOverride: testKeypair.publicKeyPem
    });
    assert(verifExpired.valid === false, 'Expired approval token rejected');
    assert(verifExpired.code === 'TOKEN_EXPIRED', 'Rejection code confirms TOKEN_EXPIRED');

    // -------------------------------------------------------------------------
    // INVARIANT 11: Mismatched / Forged Signature Rejection
    // -------------------------------------------------------------------------
    console.log('\n[INVARIANT 11] Forged / Rogue Key Signature Rejection...');
    // Generate an unauthorized rogue keypair
    const rogueKeypair = generateHumanAuthorityKeyPair(null);
    const rogueSignedToken = issueHumanApprovalSignature(candidateG, rogueKeypair.privateKeyPem, {
      human_operator_id: 'rogue-attacker'
    });
    const verifRogue = verifyHumanApprovalToken(candidateG, rogueSignedToken, tempTestRoot, {
      publicKeyOverride: testKeypair.publicKeyPem // verified against genuine public key
    });
    assert(verifRogue.valid === false, 'Signature signed by rogue keypair is rejected');
    assert(verifRogue.code === 'SIGNATURE_INVALID', 'Rejection code confirms SIGNATURE_INVALID');

    // -------------------------------------------------------------------------
    // INVARIANT 12: Direct Storage Bypass Rejection
    // -------------------------------------------------------------------------
    console.log('\n[INVARIANT 12] Direct Storage Bypass Rejection on High-Impact Domains...');
    const highImpactRecordM = createDomainIntelligenceRecord({
      title: 'Direct Bypass Attempt on Domain M',
      content: 'Autonomous processes must not bypass human verification boundary.',
      forcedDomain: 'M'
    });
    const bypassResult = persistDomainIntelligenceRecord(highImpactRecordM, tempTestRoot, {
      humanApprovalToken: null // direct persistence attempt without token
    });
    assert(bypassResult.persisted === false, 'Direct write to Domain M without human token rejected');
    assert(bypassResult.code === 'PERSISTENCE_REJECTED_UNAUTHORIZED_DOMAIN', 'Rejection code confirms PERSISTENCE_REJECTED_UNAUTHORIZED_DOMAIN');

    // -------------------------------------------------------------------------
    // INVARIANT 13: Crash-Safe Transaction Ordering (Nonce Unconsumed on Write Failure)
    // -------------------------------------------------------------------------
    console.log('\n[INVARIANT 13] Crash-Safe Transaction Ordering (Nonce Unconsumed on Pre-Commit Failure)...');
    const crashTestCandidate = {
      candidate_id: 'PLCAND-CRASH01',
      domain_letter: 'G',
      title: 'Crash Safety Protocol',
      universal_invariant: 'Write transactions must decouple validation from state modification.'
    };
    const crashToken = issueHumanApprovalSignature(crashTestCandidate, testKeypair.privateKeyPem, {
      human_operator_id: 'satyabagherwal-governance',
      customRoot: tempTestRoot
    });

    const crashRecord1 = createDomainIntelligenceRecord({
      title: crashTestCandidate.title,
      content: crashTestCandidate.universal_invariant,
      forcedDomain: 'G'
    });

    // 1st persistence: succeeds cleanly
    const persist1 = persistDomainIntelligenceRecord(crashRecord1, tempTestRoot, {
      humanApprovalToken: crashToken,
      tokenOptions: { publicKeyOverride: testKeypair.publicKeyPem }
    });
    assert(persist1.persisted === true, 'First persistence with valid token succeeds');

    // Verify nonce is consumed now that write succeeded
    const noncesAfterSuccess = loadConsumedNonces(tempTestRoot);
    assert(noncesAfterSuccess.has(crashToken.nonce), 'Nonce marked as consumed AFTER successful persistence');

    // Now test retry preservation: create a SECOND token
    const retryCandidate = {
      candidate_id: 'PLCAND-RETRY01',
      domain_letter: 'G',
      title: 'Crash Safety Invariant 2',
      universal_invariant: 'Pre-commit failure must not burn human approval token.'
    };
    const retryToken = issueHumanApprovalSignature(retryCandidate, testKeypair.privateKeyPem, {
      human_operator_id: 'satyabagherwal-governance',
      customRoot: tempTestRoot
    });

    // Pre-seed registry with duplicate content hash to simulate a collision during commit phase
    const regPaths = getDomainStoragePaths(tempTestRoot);
    const reg = loadDomainRegistry(tempTestRoot);
    reg.records['DOM-G-PREEXISTING'] = {
      record_id: 'DOM-G-PREEXISTING',
      content_hash: retryToken.content_hash,
      domain_letter: 'G'
    };
    fs.writeFileSync(regPaths.registryFile, JSON.stringify(reg, null, 2), 'utf8');

    // Create record matching retryToken exactly
    const duplicateRecord = createDomainIntelligenceRecord({
      title: retryCandidate.title,
      content: retryCandidate.universal_invariant,
      forcedDomain: 'G'
    });

    const persistDup = persistDomainIntelligenceRecord(duplicateRecord, tempTestRoot, {
      humanApprovalToken: retryToken,
      tokenOptions: { publicKeyOverride: testKeypair.publicKeyPem }
    });
    assert(persistDup.persisted === false && persistDup.code === 'DUPLICATE_CONTENT_HASH', 'Persistence rejected due to duplicate content hash before commit');

    // CRITICAL: verify that retryToken.nonce was NOT consumed!
    const noncesAfterDup = loadConsumedNonces(tempTestRoot);
    assert(!noncesAfterDup.has(retryToken.nonce), 'Nonce remained UNCONSUMED because disk commit did not happen (crash safety)');

    // -------------------------------------------------------------------------
    // INVARIANT 14: Safe Mutex File Locking & Lost Update Prevention
    // -------------------------------------------------------------------------
    console.log('\n[INVARIANT 14] Safe Mutex File Locking & Lost Update Prevention...');
    const lock1 = acquireRegistryLock(tempTestRoot);
    assert(lock1.acquired === true, 'First lock acquired cleanly');

    let lock2Threw = false;
    try {
      acquireRegistryLock(tempTestRoot, { timeoutMs: 300, staleMs: 10000 });
    } catch (err) {
      lock2Threw = true;
    }
    assert(lock2Threw === true, 'Concurrent lock acquisition blocked while lock is held');

    releaseRegistryLock(tempTestRoot);
    const lock3 = acquireRegistryLock(tempTestRoot);
    assert(lock3.acquired === true, 'Lock re-acquired after release');
    releaseRegistryLock(tempTestRoot);

    // -------------------------------------------------------------------------
    // INVARIANT 15: PID-Liveness Lock Theft Defense
    // -------------------------------------------------------------------------
    console.log('\n[INVARIANT 15] PID-Liveness Lock Theft Defense...');
    // Create an artificial lock file belonging to the CURRENT LIVING process with an old mtime
    const lockFilePath = path.join(tempPbDir, 'domain-registry.lock');
    fs.writeFileSync(lockFilePath, JSON.stringify({
      pid: process.pid,
      acquired_at: new Date(Date.now() - 30000).toISOString() // 30s ago
    }), 'utf8');

    // Set mtime to 30 seconds ago
    const pastTime = (Date.now() - 30000) / 1000;
    fs.utimesSync(lockFilePath, pastTime, pastTime);

    // Attempting to acquire with staleMs: 500ms should FAIL because process.pid IS ALIVE!
    let liveLockStolen = false;
    try {
      acquireRegistryLock(tempTestRoot, { timeoutMs: 400, staleMs: 500 });
      liveLockStolen = true;
    } catch (err) {
      // Expected timeout: lock held by live process is never stolen!
    }
    assert(liveLockStolen === false, 'Stale lock held by LIVING PID is NEVER stolen (process liveness check enforced)');

    // Now set PID to a guaranteed dead process (e.g. 99999999)
    fs.writeFileSync(lockFilePath, JSON.stringify({
      pid: 99999999,
      acquired_at: new Date(Date.now() - 30000).toISOString()
    }), 'utf8');
    fs.utimesSync(lockFilePath, pastTime, pastTime);

    // Now acquire should succeed by safely breaking orphaned dead lock
    const deadLockAcquired = acquireRegistryLock(tempTestRoot, { timeoutMs: 1000, staleMs: 500 });
    assert(deadLockAcquired.acquired === true, 'Orphaned lock held by DEAD PID safely broken and re-acquired');
    releaseRegistryLock(tempTestRoot);

    // -------------------------------------------------------------------------
    // INVARIANT 16: Autonomous Non-High-Impact Promotion (Domains F, H, J, K)
    // -------------------------------------------------------------------------
    console.log('\n[INVARIANT 16] Autonomous Non-High-Impact Promotion (Domains F, H, J, K)...');
    const technicalCandidate = {
      candidate_id: 'PLCAND-TECH01',
      stage: KNOWLEDGE_STAGE.EXTRACTED,
      project_name: 'astro-build',
      title: 'Astro Content Collections Schema Validation',
      problem_statement: 'Unvalidated frontmatter in content collections causes silent build-time page omission.',
      universal_invariant: 'All content collection schemas must define explicit Zod validation rules with fail-fast defaults.',
      forcedDomain: 'H' // Technical Construction Domain
    };
    const proofPillar = {
      verified: true,
      exit_code: 0,
      canonical_promotion_approval: { approved: true, human_authorized: false } // autonomous
    };
    const promoResult = promoteProjectLearningToMasterBrain(technicalCandidate, proofPillar, {
      brainRoot: tempTestRoot,
      forcedDomain: 'H'
    });
    assert(promoResult.success === true, 'Domain H candidate promoted autonomously without human approval token');
    assert(promoResult.persisted_record !== null, 'Domain H record persisted to domain registry');

    // -------------------------------------------------------------------------
    // INVARIANT 17: Durable Audit Logging
    // -------------------------------------------------------------------------
    console.log('\n[INVARIANT 17] Durable Audit Logging for Human Approvals...');
    const auditLedgerPath = path.join(tempInboxDir, 'human-approval-audit-ledger.json');
    assert(fs.existsSync(auditLedgerPath), 'Audit ledger file created in 11_INBOX/human-approval-audit-ledger.json');
    const auditData = JSON.parse(fs.readFileSync(auditLedgerPath, 'utf8'));
    assert(auditData.total_approvals >= 1, 'Audit ledger records verified human approval events');
    const lastAudit = auditData.approvals[auditData.approvals.length - 1];
    assert(lastAudit.human_operator_id === 'satyabagherwal-governance', 'Audit entry captures verified human operator');
    assert(lastAudit.signature_fingerprint.length > 0, 'Audit entry captures cryptographic signature fingerprint');
    assert(lastAudit.promotion_result === 'CANONICAL_PERSISTED', 'Audit entry confirms CANONICAL_PERSISTED');

    // -------------------------------------------------------------------------
    // INVARIANT 18: Master Brain 16-Directory Invariant & Precision Retrieval
    // -------------------------------------------------------------------------
    console.log('\n[INVARIANT 18] Master Brain 16-Directory Invariant & Precision Retrieval...');
    const canonicalDirs = [
      '00_START_HERE', '01_CORE', '02_AGENT_INTELLIGENCE', '03_SKILLS',
      '04_WORKFLOWS', '05_KNOWLEDGE', '06_PROJECT_CONTEXT', '07_PROJECT_LEARNING',
      '08_VERIFICATION', '09_SOURCES', '10_PROMPTS', '11_INBOX',
      '12_DECISIONS', '13_GOVERNANCE', '14_EVOLUTION', '15_METADATA'
    ];
    for (const dir of canonicalDirs) {
      assert(fs.existsSync(path.join(BRAIN_ROOT, dir)), `Canonical Master Brain directory intact: ${dir}`);
    }

    const t0 = Date.now();
    const searchRes = searchBrain('Content Collections Schema Validation', {
      brainRoot: tempTestRoot,
      topK: 3
    });
    const searchDuration = Date.now() - t0;
    assert(searchRes.results.length > 0, 'searchBrain retrieved newly promoted construction intelligence');
    assert(searchDuration < 50, `Retrieval executed within sub-50ms latency SLA (${searchDuration}ms)`);

    console.log('\n======================================================================');
    console.log(`🏁 PAB-003 ISOLATED SIGNING ARCHITECTURE: ${totalPassed} PASSED | ${totalFailed} FAILED`);
    console.log('======================================================================\n');
  } finally {
    // Clean up temporary test sandbox
    try {
      fs.rmSync(tempTestRoot, { recursive: true, force: true });
    } catch (e) {}
  }
}

runTestSuite().catch(err => {
  console.error('Fatal Test Failure:', err);
  process.exit(1);
});
