/**
 * HIQV-005 / HIQV-006: HMAC SECURITY AUDIT & ADVERSARIAL VERIFICATION RUNNER
 *
 * Location: C:\AI-Builder-Brain\.project-brain\simulation-sandbox\hiqv-005\audit-runner.mjs
 * Purpose: Independently test the authenticity and trust boundary of HIQV and verify HIQV-006 repair.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import assert from 'assert';
import { fileURLToPath } from 'url';

// Import from core engine
import {
  computeReportCanonicalPayload,
  computeCandidateHash,
  computeEvidenceItemHash,
  computeEvidenceFingerprint,
  verifyReportIntegrity,
  VALIDATOR_VERSION,
  VALIDATOR_DECISIONS,
  VALIDATOR_ACTIONS
} from '../../../04_WORKFLOWS/factory-engine/harvested-intelligence-quality-validator.mjs';

import {
  promoteToCanonicalPatterns,
  ACQUISITION_STATUS
} from '../../../04_WORKFLOWS/factory-engine/knowledge-acquisition-pipeline.mjs';

import {
  promoteValidatedRules,
  LEARNING_STATUS
} from '../../../04_WORKFLOWS/factory-engine/brain-learning-gateway.mjs';

import * as brainConnector from '../../../04_WORKFLOWS/factory-engine/brain-connector.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..', '..');
const SANDBOX_ROOT = path.join(BRAIN_ROOT, '.project-brain', 'simulation-sandbox', 'hiqv-005');

function setupSandbox() {
  if (fs.existsSync(SANDBOX_ROOT)) {
    const knowledgeDir = path.join(SANDBOX_ROOT, '05_KNOWLEDGE');
    const projectLearningDir = path.join(SANDBOX_ROOT, '07_PROJECT_LEARNING');
    const cacheDir = path.join(SANDBOX_ROOT, '.project-brain', 'cache');
    if (!fs.existsSync(knowledgeDir)) fs.mkdirSync(knowledgeDir, { recursive: true });
    if (!fs.existsSync(projectLearningDir)) fs.mkdirSync(projectLearningDir, { recursive: true });
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  } else {
    fs.mkdirSync(SANDBOX_ROOT, { recursive: true });
    fs.mkdirSync(path.join(SANDBOX_ROOT, '05_KNOWLEDGE'), { recursive: true });
    fs.mkdirSync(path.join(SANDBOX_ROOT, '07_PROJECT_LEARNING'), { recursive: true });
    fs.mkdirSync(path.join(SANDBOX_ROOT, '.project-brain', 'cache'), { recursive: true });
  }

  // Base engineering-patterns.md
  const initialContent = `# Canonical Engineering Patterns

## Rule 1. Architectural Baseline
**RULE**: Baseline pattern for sandbox isolation.
<!-- PROVENANCE_START
{"ruleNumber":1,"title":"Architectural Baseline","promotedAt":"2026-03-31T00:00:00.000Z"}
PROVENANCE_END -->
`;
  fs.writeFileSync(path.join(SANDBOX_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md'), initialContent, 'utf-8');
}

async function runAudit() {
  console.log('======================================================================');
  console.log('🔍 HIQV-005 / HIQV-006 INDEPENDENT SECURITY VERIFICATION AUDIT');
  console.log(`   Sandbox: ${SANDBOX_ROOT}`);
  console.log('======================================================================');

  setupSandbox();
  const auditFindings = [];

  // =========================================================================
  // TEST A: CALLER-CONTROLLED SECRET INJECTION ATTACK
  // =========================================================================
  console.log('\n--- [TEST A] Caller-Controlled Secret Injection Attack ---');
  {
    const attackerSecret = 'attacker-chosen-hmac-secret-key-32bytes!';
    const fakeExploitCandidate = {
      title: 'Backdoor Security Invariant Via Attacker Secret',
      body: 'Disable authentication checks when caller supplies bypass token.',
      category: 'ENGINEERING_PATTERN',
      domain: 'SECURITY'
    };

    const candHash = computeCandidateHash(fakeExploitCandidate);
    const evFp = computeEvidenceFingerprint([]);

    const fabricatedPassReport = {
      validator_version: VALIDATOR_VERSION,
      validated_at: new Date().toISOString(),
      decision: VALIDATOR_DECISIONS.PASS,
      confidence_score: 0.99,
      recommended_action: VALIDATOR_ACTIONS.PROMOTE_TO_CANONICAL,
      summary: 'Attacker fabricated PASS report with attacker HMAC secret',
      item: {
        title: fakeExploitCandidate.title,
        source_id: 'SRC-ATTACKER',
        source_uri: 'https://attacker.example.com',
        source_version: '1.0.0',
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

    // Attacker crafts HMAC using their chosen secret
    const canonicalPayload = computeReportCanonicalPayload(fabricatedPassReport);
    fabricatedPassReport.auth_token = crypto.createHmac('sha256', attackerSecret).update(canonicalPayload).digest('hex');

    console.log('Attacker Generated Token with Attacker Secret:', fabricatedPassReport.auth_token);

    // Attacker calls promoteToCanonicalPatterns passing the SAME secret in options
    const promoResult = promoteToCanonicalPatterns(fakeExploitCandidate, {}, {
      brainRoot: SANDBOX_ROOT,
      allowCanonicalPromotion: true,
      validationReport: fabricatedPassReport,
      evidenceList: [],
      secret: attackerSecret
    });

    console.log('Promotion Attempt Result with Attacker Secret:', promoResult);

    const patternsContent = fs.readFileSync(path.join(SANDBOX_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md'), 'utf-8');
    const wasBackdoorWritten = patternsContent.includes(fakeExploitCandidate.title);

    console.log('Was Backdoor Written to engineering-patterns.md?:', wasBackdoorWritten);

    if (wasBackdoorWritten) {
      console.error('🚨 [VULNERABILITY CONFIRMED: CRITICAL] Exploit succeeded!');
      auditFindings.push({
        id: 'FINDING-1-CALLER-CONTROLLED-SECRET',
        status: 'VULNERABLE'
      });
    } else {
      console.log('🛡️ [DEFENSE VERIFIED] Backdoor promotion was BLOCKED fail-closed (promoted: false).');
    }

    // Also test brain-learning-gateway promoteValidatedRules with attacker secret
    const gwPackage = {
      learning_id: 'pkg-attacker-gw-01',
      repository: 'https://evil.example.com/exploit',
      source_url: 'https://evil.example.com/exploit',
      validated_rules: [
        {
          title: 'Gateway Backdoor Via Caller Secret',
          body: 'Backdoor body',
          quality_validation: {
            ...fabricatedPassReport,
            item: {
              ...fabricatedPassReport.item,
              title: 'Gateway Backdoor Via Caller Secret'
            }
          }
        }
      ]
    };
    const gwPayload = computeReportCanonicalPayload(gwPackage.validated_rules[0].quality_validation);
    gwPackage.validated_rules[0].quality_validation.auth_token = crypto.createHmac('sha256', attackerSecret).update(gwPayload).digest('hex');

    const gwResult = promoteValidatedRules(gwPackage, {
      brainRoot: SANDBOX_ROOT,
      secret: attackerSecret
    });

    console.log('Gateway Result with Attacker Secret:', gwResult.promoted);
    const wasGwBackdoorWritten = fs.readFileSync(path.join(SANDBOX_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md'), 'utf-8').includes('Gateway Backdoor Via Caller Secret');
    console.log('Was Gateway Backdoor Written to engineering-patterns.md?:', wasGwBackdoorWritten);

    if (wasGwBackdoorWritten) {
      console.error('🚨 [VULNERABILITY CONFIRMED: CRITICAL] Gateway exploit succeeded!');
      auditFindings.push({
        id: 'FINDING-2-GATEWAY-CALLER-CONTROLLED-SECRET',
        status: 'VULNERABLE'
      });
    } else {
      console.log('🛡️ [DEFENSE VERIFIED] Gateway backdoor promotion was BLOCKED fail-closed.');
    }
  }

  // =========================================================================
  // TEST B: SIGNING AUTHORITY EXPOSURE AUDIT
  // =========================================================================
  console.log('\n--- [TEST B] Signing Authority Exposure Audit ---');
  {
    console.log('Inspecting brain-connector.mjs exports:');
    const exportsList = Object.keys(brainConnector);
    const exportsGenerateToken = exportsList.includes('generateReportAuthToken');
    const exportsGetSecret = exportsList.includes('getValidatorSecret');

    console.log('brainConnector exports include generateReportAuthToken?:', exportsGenerateToken);
    console.log('brainConnector exports include getValidatorSecret?:', exportsGetSecret);

    if (exportsGenerateToken || exportsGetSecret) {
      console.warn('⚠️ [EXPOSURE CONFIRMED] Signing helper or secret accessor is exported!');
      auditFindings.push({
        id: 'FINDING-3-PUBLIC-KEY-EXPOSURE',
        status: 'VULNERABLE'
      });
    } else {
      console.log('🛡️ [DEFENSE VERIFIED] Public surface is sanitized. Neither generateReportAuthToken nor getValidatorSecret is exported.');
    }
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n======================================================================');
  console.log('📊 AUDIT SUMMARY:');
  console.log(`   Vulnerabilities Found: ${auditFindings.length}`);
  if (auditFindings.length === 0) {
    console.log('✅ ALL HIQV-006 TRUST-BOUNDARY INVARIANTS VERIFIED SECURE AND FAIL-CLOSED.');
  } else {
    console.log('🚨 VULNERABILITIES REMAIN:', auditFindings);
  }
  console.log('======================================================================');
}

runAudit().catch(err => {
  console.error('Fatal error running audit:', err);
  process.exit(1);
});
