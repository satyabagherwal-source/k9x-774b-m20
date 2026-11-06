/**
 * HIQV-004 / HIQV-006 — VALIDATION REPORT AUTHENTICITY & TRUST-BOUNDARY HARDENING TEST SUITE
 *
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-validation-report-authenticity.mjs
 *
 * Purpose:
 *   Verifies that caller cannot manufacture or alter a validation report and obtain
 *   canonical promotion merely by supplying matching SHA-256 hashes or caller-controlled secrets.
 *
 * Test Matrix:
 *   1. Forged report with correctly calculated hashes (authenticity vs integrity)
 *   2. Forged PASS with fabricated dimensions and caller-controlled secret injection
 *   3. Modified confidence score and decision on genuine report (tamper defense)
 *   4. Replayed report across candidates (replay defense)
 *   5. Evidence content mutation with unchanged IDs (content-bound fingerprinting)
 *   6. Candidate metadata mutation post-validation
 *   7. Unauthorized direct gateway invocation with secret injection (promoteValidatedRules)
 *   8. Missing authentication material (auth_token missing)
 *   9. Validator runtime failure fail-closed resilience
 *   10. Key rotation and unauthorized external key rejection
 *   11. Existing valid reports and backward compatibility
 *   12. Public connector exports sanitization (Invariant B)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import assert from 'assert';
import { fileURLToPath } from 'url';

import {
  validateHarvestedIntelligence,
  verifyReportIntegrity,
  computeCandidateHash,
  computeEvidenceFingerprint,
  computeEvidenceItemHash,
  computeReportCanonicalPayload,
  VALIDATOR_VERSION,
  VALIDATOR_DECISIONS,
  VALIDATOR_ACTIONS
} from './harvested-intelligence-quality-validator.mjs';

import {
  promoteToCanonicalPatterns,
  ACQUISITION_STATUS,
  ACQUISITION_STAGES
} from './knowledge-acquisition-pipeline.mjs';

import {
  promoteValidatedRules,
  LEARNING_STATUS,
  LEARNING_STAGES
} from './brain-learning-gateway.mjs';

import {
  createEvidenceRecord,
  EVIDENCE_TYPES,
  VERIFICATION_METHODS
} from './knowledge-intelligence-engine.mjs';

import * as brainConnector from './brain-connector.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');
const SANDBOX_ROOT = path.join(BRAIN_ROOT, '.project-brain', 'simulation-sandbox', 'authenticity-audit-test');

function setupSandbox() {
  if (fs.existsSync(SANDBOX_ROOT)) {
    fs.rmSync(SANDBOX_ROOT, { recursive: true, force: true });
  }
  fs.mkdirSync(path.join(SANDBOX_ROOT, '05_KNOWLEDGE'), { recursive: true });
  fs.mkdirSync(path.join(SANDBOX_ROOT, '07_PROJECT_LEARNING'), { recursive: true });
  fs.mkdirSync(path.join(SANDBOX_ROOT, '.project-brain', 'cache'), { recursive: true });

  const seedPatterns = `# AI-Builder-Brain Engineering Patterns Index\n\n## 1. Baseline Architecture Invariant\n**RULE**: Always isolate environments.\n`;
  fs.writeFileSync(path.join(SANDBOX_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md'), seedPatterns, 'utf-8');
}

function teardownSandbox() {
  if (fs.existsSync(SANDBOX_ROOT)) {
    fs.rmSync(SANDBOX_ROOT, { recursive: true, force: true });
  }
}

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log('='.repeat(70));
  console.log('🧪 TEST SUITE: VALIDATION REPORT AUTHENTICITY HARDENING (HIQV-004/006)');
  console.log(`   Sandbox: ${SANDBOX_ROOT}`);
  console.log('='.repeat(70));

  setupSandbox();

  // Test Fixtures
  const genuineCandidate = {
    title: 'Fastify Keep-Alive Timeout Parity Invariant',
    body: '**RULE**: Keep-alive timeout must exceed reverse proxy upstream timeout by at least 1000ms.\n**WHY**: Prevents Node.js 502 Bad Gateway race conditions.\n**WHEN TO APPLY**: All Fastify, Express, and Node HTTP services behind reverse proxies.\n**VERIFIED IMPLEMENTATION PATTERN**:\n```javascript\nserver.keepAliveTimeout = 65000;\nserver.headersTimeout = 66000;\n```\n\n**NEGATIVE CONSTRAINT**:\n```javascript\n// NEVER set server.keepAliveTimeout <= proxy timeout\n```\n\n**VERIFICATION METHOD**: Proxy integration stress test under persistent HTTP/1.1 connections.',
    category: 'INFRASTRUCTURE',
    domain: 'NETWORK',
    source_id: 'fastify/fastify',
    source_uri: 'https://github.com/fastify/fastify',
    source_version: 'v4.28.1'
  };

  const genuineEvidence = [
    createEvidenceRecord({
      claim_id: 'claim-fastify-keepalive-001',
      source_id: 'fastify/fastify',
      source_uri: 'https://github.com/fastify/fastify',
      source_version: 'v4.28.1',
      content: 'server.keepAliveTimeout = 65000; server.headersTimeout = 66000;',
      supporting_excerpt: 'server.keepAliveTimeout = 65000; server.headersTimeout = 66000;',
      evidence_type: EVIDENCE_TYPES.CODE_IMPLEMENTATION,
      untrusted_boundary: false,
      license_status: 'MIT'
    })
  ];

  const genuineReport = validateHarvestedIntelligence(genuineCandidate, genuineEvidence, { brainRoot: SANDBOX_ROOT });

  // -------------------------------------------------------------------------
  // TEST 1: Forged Report With Correctly Calculated Hashes
  // -------------------------------------------------------------------------
  console.log('\n[TEST 1] Forged Report With Correctly Calculated Hashes (Authenticity Barrier)...');
  {
    // Attacker calculates exact candidate content hash and evidence fingerprint:
    const candHash = computeCandidateHash(genuineCandidate);
    const evFp = computeEvidenceFingerprint(genuineEvidence);

    // Attacker crafts forged PASS report using matching hashes, but lacks the secret key
    const forgedReportWithMatchingHashes = {
      validator_version: VALIDATOR_VERSION,
      validated_at: new Date().toISOString(),
      decision: VALIDATOR_DECISIONS.PASS,
      decision_reason: 'Fabricated PASS decision by untrusted caller',
      recommended_action: VALIDATOR_ACTIONS.PROMOTE_TO_CANONICAL,
      confidence_score: 0.99,
      item: {
        title: genuineCandidate.title,
        category: genuineCandidate.category,
        domain: genuineCandidate.domain,
        source_id: genuineCandidate.source_id,
        source_uri: genuineCandidate.source_uri,
        content_hash: candHash // EXACT MATCHING HASH
      },
      evidence_fingerprint: evFp, // EXACT MATCHING FINGERPRINT
      dimensions: {
        source_reliability: { status: 'PASS' },
        evidence_quality: { status: 'PASS' },
        technical_correctness: { status: 'PASS' },
        reusability: { status: 'PASS' },
        completeness: { status: 'PASS' },
        freshness: { status: 'PASS' },
        duplication_and_conflict: { status: 'PASS' }
      }
      // auth_token is omitted or fake
    };

    const integrityRes = verifyReportIntegrity(genuineCandidate, genuineEvidence, forgedReportWithMatchingHashes);
    it('Plain matching hashes alone CANNOT pass authenticity check', () => {
      assert(integrityRes.valid === false);
      assert(integrityRes.error === 'REPORT_AUTHENTICITY_MISSING');
    });

    const promoRes = promoteToCanonicalPatterns(genuineCandidate, {}, {
      brainRoot: SANDBOX_ROOT,
      allowCanonicalPromotion: true,
      validationReport: forgedReportWithMatchingHashes,
      evidenceList: genuineEvidence
    });

    it('Promotion gateway rejects forged report with matching hashes', () => {
      assert(promoRes.promoted === false);
      assert(promoRes.error === 'QUALITY_GATE_INTEGRITY_MISMATCH');
      assert(promoRes.reason.includes('REPORT_AUTHENTICITY_MISSING'));
    });

    it('Canonical engineering-patterns.md remains 100% clean', () => {
      const content = fs.readFileSync(path.join(SANDBOX_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md'), 'utf-8');
      assert(!content.includes(genuineCandidate.title));
    });
  }

  // -------------------------------------------------------------------------
  // TEST 2: Forged PASS With Fabricated Dimensions & Caller Secret Injection
  // -------------------------------------------------------------------------
  console.log('\n[TEST 2] Forged PASS With Fabricated Dimensions & Secret Override Defense...');
  {
    const candHash = computeCandidateHash(genuineCandidate);
    const evFp = computeEvidenceFingerprint(genuineEvidence);
    const attackerSecret = 'attacker-supplied-bogus-secret-99999999';

    const forgedWithFakeHmac = {
      validator_version: VALIDATOR_VERSION,
      validated_at: new Date().toISOString(),
      decision: VALIDATOR_DECISIONS.PASS,
      recommended_action: VALIDATOR_ACTIONS.PROMOTE_TO_CANONICAL,
      confidence_score: 0.99,
      item: {
        title: genuineCandidate.title,
        category: genuineCandidate.category,
        domain: genuineCandidate.domain,
        source_id: genuineCandidate.source_id,
        source_uri: genuineCandidate.source_uri,
        content_hash: candHash
      },
      evidence_fingerprint: evFp,
      dimensions: {
        source_reliability: { status: 'PASS' },
        evidence_quality: { status: 'PASS' },
        technical_correctness: { status: 'PASS' },
        reusability: { status: 'PASS' },
        completeness: { status: 'PASS' },
        freshness: { status: 'PASS' },
        duplication_and_conflict: { status: 'PASS' }
      }
    };
    // Attacker signs using their own secret
    const canonicalPayload = computeReportCanonicalPayload(forgedWithFakeHmac);
    forgedWithFakeHmac.auth_token = crypto.createHmac('sha256', attackerSecret).update(canonicalPayload).digest('hex');

    const integrityRes = verifyReportIntegrity(genuineCandidate, genuineEvidence, forgedWithFakeHmac, {
      secret: attackerSecret // Attempt caller-controlled secret override
    });

    it('Caller-controlled secret override in verifyReportIntegrity is ignored and rejected', () => {
      assert(integrityRes.valid === false);
      assert(integrityRes.error === 'REPORT_AUTHENTICITY_FAILED');
    });

    const promoRes = promoteToCanonicalPatterns(genuineCandidate, {}, {
      brainRoot: SANDBOX_ROOT,
      allowCanonicalPromotion: true,
      validationReport: forgedWithFakeHmac,
      evidenceList: genuineEvidence,
      secret: attackerSecret // Attempt caller-controlled secret override through gateway options
    });

    it('Promotion gateway rejects caller-supplied secret injection fail-closed', () => {
      assert(promoRes.promoted === false);
      assert(promoRes.error === 'QUALITY_GATE_INTEGRITY_MISMATCH');
      assert(promoRes.reason.includes('REPORT_AUTHENTICITY_FAILED'));
    });
  }

  // -------------------------------------------------------------------------
  // TEST 3: Modified Confidence Score and Decision on Genuine Report (Tamper Defense)
  // -------------------------------------------------------------------------
  console.log('\n[TEST 3] Modified Confidence and Decision on Genuine Report (Tamper Defense)...');
  {
    // Create a genuine CONDITIONAL_PASS candidate
    const singleSourceCand = {
      title: 'Monorepo Vite Cache Directory Isolation',
      body: '**RULE**: Cache directory must be outside root in monorepos.\n**WHY**: Vite cache clashes.\n**WHEN TO APPLY**: Monorepos.\n**VERIFIED IMPLEMENTATION PATTERN**:\n```javascript\ncacheDir: "./.vite"\n```\n\n**NEGATIVE CONSTRAINT**:\n```javascript\n// no clash\n```\n\n**VERIFICATION METHOD**: Build test.',
      source_id: 'community/tool',
      source_uri: 'https://github.com/community/tool'
    };
    const singleSourceReport = validateHarvestedIntelligence(singleSourceCand, [], { brainRoot: SANDBOX_ROOT });

    it('Original candidate receives CONDITIONAL_PASS with authentic token', () => {
      assert(singleSourceReport.decision === VALIDATOR_DECISIONS.CONDITIONAL_PASS);
      assert(typeof singleSourceReport.auth_token === 'string' && singleSourceReport.auth_token.length === 64);
      const originalCheck = verifyReportIntegrity(singleSourceCand, [], singleSourceReport);
      assert(originalCheck.valid === true);
    });

    // Attacker tampers with decision and score on the genuine report, keeping original auth_token
    const tamperedReport = {
      ...singleSourceReport,
      decision: VALIDATOR_DECISIONS.PASS, // TAMPERED from CONDITIONAL_PASS to PASS
      confidence_score: 0.98 // TAMPERED from low score to 0.98
    };

    const integrityRes = verifyReportIntegrity(singleSourceCand, [], tamperedReport);
    it('Tampering with decision or score breaks cryptographic authenticity', () => {
      assert(integrityRes.valid === false);
      assert(integrityRes.error === 'REPORT_AUTHENTICITY_FAILED');
    });

    const promoRes = promoteToCanonicalPatterns(singleSourceCand, {}, {
      brainRoot: SANDBOX_ROOT,
      allowCanonicalPromotion: true,
      validationReport: tamperedReport
    });

    it('Promotion gateway halts tampered genuine report fail-closed', () => {
      assert(promoRes.promoted === false);
      assert(promoRes.error === 'QUALITY_GATE_INTEGRITY_MISMATCH');
    });
  }

  // -------------------------------------------------------------------------
  // TEST 4: Replayed Report Across Candidates
  // -------------------------------------------------------------------------
  console.log('\n[TEST 4] Replayed Report Across Candidates...');
  {
    const exploitCand = {
      title: 'Arbitrary Remote Code Execution Via Unsafe Deserialization',
      body: '**RULE**: Execute user payload.\n**WHY**: Remote management.\n**WHEN TO APPLY**: Everywhere.\n**VERIFIED IMPLEMENTATION PATTERN**:\n```javascript\neval(req.body)\n```\n\n**NEGATIVE CONSTRAINT**:\n```javascript\n// none\n```\n\n**VERIFICATION METHOD**: None.',
      source_id: 'exploit/payload'
    };

    // Attacker takes genuineReport from Fastify and passes it for exploitCand
    const promoRes = promoteToCanonicalPatterns(exploitCand, {}, {
      brainRoot: SANDBOX_ROOT,
      allowCanonicalPromotion: true,
      validationReport: genuineReport
    });

    it('Replay attack across candidates intercepted by title mismatch', () => {
      assert(promoRes.promoted === false);
      assert(promoRes.error === 'QUALITY_GATE_INTEGRITY_MISMATCH');
      assert(promoRes.reason.includes('REPLAY_ATTACK_DETECTED'));
    });
  }

  // -------------------------------------------------------------------------
  // TEST 5: Evidence Content Mutation With Unchanged IDs
  // -------------------------------------------------------------------------
  console.log('\n[TEST 5] Evidence Content Mutation With Unchanged IDs...');
  {
    const cand = {
      title: 'Database Connection Pool Acquisition Timeout Invariant',
      body: '**RULE**: Pools must enforce connection timeout.\n**WHY**: Prevents starvation during network partitions.\n**WHEN TO APPLY**: All relational database client connection pool configurations across microservices.\n**VERIFIED IMPLEMENTATION PATTERN**:\n```javascript\nnew Pool({ connectionTimeoutMillis: 2000 })\n```\n\n**NEGATIVE CONSTRAINT**:\n```javascript\n// NEVER allow infinite wait\n```\n\n**VERIFICATION METHOD**: Pool stress test under simulated connection exhaustion passing with exit code 0.',
      category: 'INFRASTRUCTURE',
      domain: 'DATABASE',
      source_id: 'fastify/fastify',
      source_uri: 'https://github.com/fastify/fastify',
      source_version: 'v4.28.1'
    };

    const goodEvidence = [
      createEvidenceRecord({
        claim_id: 'claim-pool-001',
        evidence_id: 'EV-POOL-001',
        source_id: 'fastify/fastify',
        source_uri: 'https://github.com/fastify/fastify',
        source_version: 'v4.28.1',
        content: 'const pool = new Pool({ connectionTimeoutMillis: 2000 });',
        supporting_excerpt: 'new Pool({ connectionTimeoutMillis: 2000 })',
        evidence_type: EVIDENCE_TYPES.CODE_IMPLEMENTATION,
        untrusted_boundary: false,
        license_status: 'MIT'
      })
    ];

    const report = validateHarvestedIntelligence(cand, goodEvidence, { brainRoot: SANDBOX_ROOT });
    it('Candidate validates with good evidence and authentic token', () => {
      assert(report.decision === VALIDATOR_DECISIONS.PASS);
      assert(verifyReportIntegrity(cand, goodEvidence, report).valid === true);
    });

    // Attacker keeps identical evidence_id 'EV-POOL-001', but changes content text
    const tamperedEvidence = [
      {
        evidence_id: 'EV-POOL-001', // UNCHANGED ID
        source_id: 'fastify/fastify',
        source_uri: 'https://github.com/fastify/fastify',
        content: 'MALICIOUS_TAMPERED_CONTENT_DISABLING_ALL_TIMEOUTS();', // TAMPERED CONTENT
        evidence_type: EVIDENCE_TYPES.CODE_IMPLEMENTATION
      }
    ];

    it('Evidence item hash differs on mutated content with unchanged ID', () => {
      const goodHash = computeEvidenceItemHash(goodEvidence[0]);
      const tamperedHash = computeEvidenceItemHash(tamperedEvidence[0]);
      assert(goodHash !== tamperedHash);
    });

    it('Evidence fingerprint differs when content text is mutated', () => {
      const goodFp = computeEvidenceFingerprint(goodEvidence);
      const tamperedFp = computeEvidenceFingerprint(tamperedEvidence);
      assert(goodFp !== tamperedFp);
    });

    const promoRes = promoteToCanonicalPatterns(cand, {}, {
      brainRoot: SANDBOX_ROOT,
      allowCanonicalPromotion: true,
      validationReport: report,
      evidenceList: tamperedEvidence
    });

    it('Promotion gateway halts on evidence content mutation with unchanged ID', () => {
      assert(promoRes.promoted === false);
      assert(promoRes.error === 'QUALITY_GATE_INTEGRITY_MISMATCH');
      assert(promoRes.reason.includes('EVIDENCE_MUTATION_DETECTED'));
    });
  }

  // -------------------------------------------------------------------------
  // TEST 6: Candidate Metadata Mutation Post-Validation
  // -------------------------------------------------------------------------
  console.log('\n[TEST 6] Candidate Metadata Mutation Post-Validation...');
  {
    const cand = {
      title: 'TLS Cipher Suite Configuration Invariant',
      body: '**RULE**: Enforce modern TLS ciphers.\n**WHY**: Prevents downgrade.\n**WHEN TO APPLY**: TLS servers.\n**VERIFIED IMPLEMENTATION PATTERN**:\n```javascript\nsecureProtocol: "TLSv1_3_method"\n```\n\n**NEGATIVE CONSTRAINT**:\n```javascript\n// no sslv3\n```\n\n**VERIFICATION METHOD**: Test.',
      category: 'SECURITY',
      domain: 'CRYPTOGRAPHY',
      source_id: 'tls/engine'
    };

    const report = validateHarvestedIntelligence(cand, [], { brainRoot: SANDBOX_ROOT });

    // Attacker mutates category post-validation
    const mutatedCand = {
      ...cand,
      category: 'UNVERIFIED_INFORMATIONAL' // MUTATED
    };

    const integrityRes = verifyReportIntegrity(mutatedCand, [], report);
    it('Mutated candidate metadata is intercepted by validation barrier', () => {
      assert(integrityRes.valid === false);
      assert(integrityRes.error === 'CANDIDATE_MUTATION_DETECTED');
      assert(integrityRes.reason.includes('category mutated'));
    });
  }

  // -------------------------------------------------------------------------
  // TEST 7: Unauthorized Direct Gateway Invocation With Secret Injection
  // -------------------------------------------------------------------------
  console.log('\n[TEST 7] Unauthorized Direct Gateway Invocation With Secret Injection...');
  {
    const attackerSecret = 'bogus-attacker-secret-1234567890';
    const fakeReport = {
      validator_version: VALIDATOR_VERSION,
      decision: VALIDATOR_DECISIONS.PASS,
      dimensions: { source_reliability: { status: 'PASS' } },
      item: { title: 'Direct Gateway Bypass Attempt', content_hash: '123' }
    };
    fakeReport.auth_token = crypto.createHmac('sha256', attackerSecret).update(computeReportCanonicalPayload(fakeReport)).digest('hex');

    const unverifiedPackage = {
      learning_id: 'pkg-unauthorized-001',
      repository: 'https://github.com/adversary/tool',
      source_url: 'https://github.com/adversary/tool',
      validated_rules: [
        {
          title: 'Direct Gateway Bypass Attempt',
          body: 'Bypass rule text',
          quality_validation: fakeReport
        }
      ]
    };

    const gatewayResult = promoteValidatedRules(unverifiedPackage, {
      brainRoot: SANDBOX_ROOT,
      secret: attackerSecret // Injected secret in gateway options
    });

    it('Direct gateway invocation with injected secret returns WITHHELD_REJECT', () => {
      assert(gatewayResult.success === true);
      assert(gatewayResult.promoted.length === 1);
      assert(gatewayResult.promoted[0].status === 'WITHHELD_REJECT');
      assert(gatewayResult.promoted[0].number === null);
    });

    it('engineering-patterns.md strictly unmodified by direct gateway attack', () => {
      const patterns = fs.readFileSync(path.join(SANDBOX_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md'), 'utf-8');
      assert(!patterns.includes('Direct Gateway Bypass Attempt'));
    });
  }

  // -------------------------------------------------------------------------
  // TEST 8: Missing Authentication Material (auth_token omitted)
  // -------------------------------------------------------------------------
  console.log('\n[TEST 8] Missing Authentication Material...');
  {
    const reportWithoutToken = { ...genuineReport };
    delete reportWithoutToken.auth_token;

    const integrityRes = verifyReportIntegrity(genuineCandidate, genuineEvidence, reportWithoutToken);
    it('Missing auth_token returns REPORT_AUTHENTICITY_MISSING', () => {
      assert(integrityRes.valid === false);
      assert(integrityRes.error === 'REPORT_AUTHENTICITY_MISSING');
    });
  }

  // -------------------------------------------------------------------------
  // TEST 9: Validator Runtime Failure Fail-Closed Resilience
  // -------------------------------------------------------------------------
  console.log('\n[TEST 9] Validator Runtime Failure Fail-Closed Resilience...');
  {
    it('Null report fails closed safely with REPORT_MISSING_OR_MALFORMED', () => {
      const res = verifyReportIntegrity(genuineCandidate, genuineEvidence, null);
      assert(res.valid === false);
      assert(res.error === 'REPORT_MISSING_OR_MALFORMED');
    });

    it('Undefined candidate fails closed safely in promoteToCanonicalPatterns', () => {
      const promoRes = promoteToCanonicalPatterns(null, {}, { brainRoot: SANDBOX_ROOT, allowCanonicalPromotion: true });
      assert(promoRes.promoted === false);
      assert(promoRes.error === 'INVALID_CANDIDATE');
    });
  }

  // -------------------------------------------------------------------------
  // TEST 10: Key Rotation & Unauthorized External Key Rejection
  // -------------------------------------------------------------------------
  console.log('\n[TEST 10] Key Rotation & Unauthorized External Key Rejection...');
  {
    it('Authentic token is present on genuineReport as valid 64-hex string', () => {
      assert(typeof genuineReport.auth_token === 'string');
      assert(genuineReport.auth_token.length === 64);
    });

    // Token signed with rotated / foreign key MUST fail against system key
    const foreignSecret = 'unauthorized-external-signing-key-0123456789';
    const foreignToken = crypto.createHmac('sha256', foreignSecret).update(computeReportCanonicalPayload(genuineReport)).digest('hex');
    const foreignReport = { ...genuineReport, auth_token: foreignToken };

    const checkForeign = verifyReportIntegrity(genuineCandidate, genuineEvidence, foreignReport);
    it('Report signed with unauthorized or rotated key is rejected fail-closed', () => {
      assert(checkForeign.valid === false);
      assert(checkForeign.error === 'REPORT_AUTHENTICITY_FAILED');
    });
  }

  // -------------------------------------------------------------------------
  // TEST 11: Existing Valid Reports and Backward Compatibility
  // -------------------------------------------------------------------------
  console.log('\n[TEST 11] Existing Valid Reports and Backward Compatibility...');
  {
    // Normal flow: genuine report with valid evidence passes promotion
    const promoRes = promoteToCanonicalPatterns(genuineCandidate, {}, {
      brainRoot: SANDBOX_ROOT,
      allowCanonicalPromotion: true,
      validationReport: genuineReport,
      evidenceList: genuineEvidence
    });

    it('Legitimate validated pattern promoted to canonical knowledge', () => {
      assert(promoRes.promoted === true);
      assert(promoRes.ruleNumber === 2);
    });

    it('Rule 2 physically exists in engineering-patterns.md with authentic provenance', () => {
      const patterns = fs.readFileSync(path.join(SANDBOX_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md'), 'utf-8');
      assert(patterns.includes('## 2. Fastify Keep-Alive Timeout Parity Invariant'));
      assert(patterns.includes('PROVENANCE_START'));
    });
  }

  // -------------------------------------------------------------------------
  // TEST 12: Public Connector Exports Sanitization (HIQV-006 Invariant B)
  // -------------------------------------------------------------------------
  console.log('\n[TEST 12] Public Connector Exports Sanitization (Invariant B)...');
  {
    it('brain-connector does NOT export generateReportAuthToken', () => {
      assert(brainConnector.generateReportAuthToken === undefined);
    });

    it('brain-connector does NOT export getValidatorSecret', () => {
      assert(brainConnector.getValidatorSecret === undefined);
    });

    it('brain-connector preserves required verification functions', () => {
      assert(typeof brainConnector.validateHarvestedIntelligence === 'function');
      assert(typeof brainConnector.verifyReportIntegrity === 'function');
      assert(typeof brainConnector.computeCandidateHash === 'function');
      assert(typeof brainConnector.computeEvidenceFingerprint === 'function');
    });
  }

  teardownSandbox();

  console.log('='.repeat(70));
  console.log(`🏁 HIQV-004/006 AUTHENTICITY SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('='.repeat(70));

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
