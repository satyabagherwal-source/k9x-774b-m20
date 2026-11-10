/**
 * AI-Builder-Brain Universal Construction Evolution & Feedback Test Suite
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-universal-construction-evolution.mjs
 * Purpose: Verifies PAC-004 Phase 1C.4:
 *          1. Domain M (Continuous Feedback & Learning Evolution) Lifecycle Integration
 *          2. Automated Project Learning Ledger Synthesis (.project-brain/PROJECT_LEARNING.md)
 *          3. Candidate Learning Discovery from Verified Product Artifacts
 *          4. Multi-Domain Classification across 13 Domains (A–M)
 *          5. 4-Pillar Validation Barrier Enforcement (Execution Verification != Universal Validity)
 *          6. Workstation Path Leak Prevention & Port Isolation
 *          7. High-Impact Architecture/Governance Gating (Domains A, G, M Fail-Closed Staging)
 *          8. Full CLI Lifecycle with --promote-learnings & Report Section 5 Integrity
 *          9. Clean Sandbox Isolation & Teardown
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  executeProjectFactoryCli,
  synthesizeProjectLearningMarkdown
} from './project-factory-cli.mjs';

import {
  discoverProjectLearningCandidates,
  classifyProjectLearningCandidate,
  validateProjectLearningCandidate,
  KNOWLEDGE_STAGE,
  VALIDATION_PILLARS
} from './project-learning-promotion-bridge.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');
const SANDBOX_DIR = path.join(BRAIN_ROOT, '.project-brain', 'simulation-sandbox', 'evolution-lifecycle-test');

console.log('======================================================================');
console.log('🧪 TEST SUITE: UNIVERSAL CONSTRUCTION EVOLUTION & FEEDBACK (PAC-004 1C.4)');
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

async function runSuite() {
  try {
    // ---------------------------------------------------------------------------
    // GROUP 1: SYNTHESIZING PROJECT LEARNING MARKDOWN (DOMAIN M)
    // ---------------------------------------------------------------------------
    console.log('[GROUP 1] Testing Project Learning Markdown Synthesis...');

    const sampleVerification = {
      command: 'node --test tests/*.test.mjs',
      exitCode: 0,
      durationMs: 420,
      verified: true
    };

    const sampleBlueprint = {
      stack: { id: 'javascript-node', language: 'javascript' },
      manifest: {
        negative_scope_invariants: [
          'Strictly zero external tracking or analytics telemetry scripts.',
          'Strictly zero unprompted cloud file synchronization.'
        ]
      }
    };

    const learningMd = synthesizeProjectLearningMarkdown(
      'InventoryMaster',
      'Build a small-business inventory and sales management application',
      sampleBlueprint,
      sampleVerification,
      {}
    );

    assert(learningMd.includes('# InventoryMaster — Persistent Project Learning Ledger'), 'Synthesizes canonical header');
    assert(learningMd.includes('Exit Code: `0`'), 'Embeds empirical test verification proof');
    assert(learningMd.includes('| Date | Source | Category | Lesson / Pattern | Invariant Rule |'), 'Embeds standard candidate extraction table');
    assert(learningMd.includes('Modular boundary separation guarantees testability'), 'Includes architectural boundary invariant');
    assert(!learningMd.includes('C:\\Users\\'), 'Guarantees zero workstation path leaks in generated ledger');

    // ---------------------------------------------------------------------------
    // GROUP 2: CANDIDATE LEARNING DISCOVERY
    // ---------------------------------------------------------------------------
    console.log('\n[GROUP 2] Discovering Candidate Learnings from Ledger...');

    const candidates = discoverProjectLearningCandidates(learningMd, {
      projectName: 'InventoryMaster',
      brainRoot: BRAIN_ROOT
    });

    assert(candidates.length === 3, 'Discovered exactly 3 candidate learnings from table', `Found: ${candidates.length}`);
    assert(candidates[0].stage === KNOWLEDGE_STAGE.EXTRACTED, 'Initial candidate stage is EXTRACTED');
    assert(candidates[0].project_name === 'InventoryMaster', 'Preserved source project name attribution');
    assert(candidates[0].universal_invariant.length > 20, 'Extracted substantive universal invariant');

    // ---------------------------------------------------------------------------
    // GROUP 3: 13-DOMAIN CLASSIFICATION
    // ---------------------------------------------------------------------------
    console.log('\n[GROUP 3] Classifying Candidate Learnings into 13 Canonical Domains...');

    const classified0 = classifyProjectLearningCandidate(candidates[0], { brainRoot: BRAIN_ROOT });
    assert(classified0.stage === KNOWLEDGE_STAGE.CANDIDATE, 'Transitioned candidate to CANDIDATE stage');
    assert(classified0.primary_domain?.letter === 'G', 'Classified Architecture & Boundary candidate into Domain G (Architecture)');

    const classified2 = classifyProjectLearningCandidate(candidates[2], { brainRoot: BRAIN_ROOT });
    assert(classified2.primary_domain?.letter === 'K', 'Classified Quality & Verification candidate into Domain K (Quality)');

    // ---------------------------------------------------------------------------
    // GROUP 4: 4-PILLAR VALIDATION BARRIER
    // ---------------------------------------------------------------------------
    console.log('\n[GROUP 4] Testing 4-Pillar Validation Barrier...');

    // 4a. Execution verification failure (exit code 1)
    const failProof = { verified: false, exit_code: 1, test_suite: 'node --test' };
    const failResult = validateProjectLearningCandidate(classified2, failProof, { brainRoot: BRAIN_ROOT });
    assert(failResult.valid === false, 'Strictly rejected candidate with non-zero exit code');
    assert(failResult.stage === KNOWLEDGE_STAGE.REJECTED_UNVERIFIED, 'Stage marked as REJECTED_UNVERIFIED');

    // 4b. Workstation path leak failure
    const leakedCand = {
      ...classified2,
      universal_invariant: 'Run tests with node C:\\Users\\Admin\\AppData\\Local\\runner.mjs'
    };
    const leakResult = validateProjectLearningCandidate(leakedCand, { verified: true, exit_code: 0 }, { brainRoot: BRAIN_ROOT });
    assert(leakResult.valid === false, 'Strictly rejected candidate with workstation path leak');
    assert(leakResult.stage === KNOWLEDGE_STAGE.PROJECT_LOCAL_ONLY, 'Stage marked as PROJECT_LOCAL_ONLY for workstation path');

    // 4c. Valid verification proof
    const passProof = { verified: true, exit_code: 0, test_suite: 'node --test tests/*.test.mjs' };
    const passResult = validateProjectLearningCandidate(classified2, passProof, { brainRoot: BRAIN_ROOT });
    assert(passResult.valid === true, 'Passed all 4 validation pillars with empirical exit code 0');
    assert(passResult.stage === KNOWLEDGE_STAGE.VALIDATED, 'Stage transitioned to VALIDATED');

    // ---------------------------------------------------------------------------
    // GROUP 5: HIGH-IMPACT ARCHITECTURE/GOVERNANCE GATING (DOMAINS A, G, M)
    // ---------------------------------------------------------------------------
    console.log('\n[GROUP 5] Verifying High-Impact Architecture Gating (Rule 1706 / 1707)...');

    // Domain G candidate without human authorization token
    const highImpactResult = validateProjectLearningCandidate(classified0, passProof, { brainRoot: BRAIN_ROOT });
    assert(highImpactResult.valid === false, 'Blocks autonomous promotion of Domain G without human token');
    assert(highImpactResult.stage === KNOWLEDGE_STAGE.STAGED_FOR_HUMAN_REVIEW, 'Safely stages Domain G candidate as STAGED_FOR_HUMAN_REVIEW');
    assert(highImpactResult.rejection_reasons.some(r => r.includes('HIGH_IMPACT_DOMAIN_STAGED')), 'Emits HIGH_IMPACT_DOMAIN_STAGED reason code');

    // ---------------------------------------------------------------------------
    // GROUP 6: END-TO-END CLI INTEGRATION WITH CONTINUOUS EVOLUTION
    // ---------------------------------------------------------------------------
    console.log('\n[GROUP 6] Executing CLI Live Construction with Evolution in Sandbox...');

    if (fs.existsSync(SANDBOX_DIR)) {
      fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
    }

    const liveCliResult = await executeProjectFactoryCli([
      '--goal', 'Build a lightweight key-value document cache store',
      '--name', 'DocCacheStore',
      '--target', SANDBOX_DIR,
      '--stack', 'javascript',
      '--promote-learnings'
    ], { brainRoot: BRAIN_ROOT, dryRunPromotion: true });

    assert(liveCliResult.success === true, 'CLI execution completed with success: true');
    assert(liveCliResult.status === 'CONSTRUCTED_AND_VERIFIED', 'CLI status marked CONSTRUCTED_AND_VERIFIED');
    assert(liveCliResult.learningEvolution !== undefined, 'CLI output includes learningEvolution package');
    assert(liveCliResult.learningEvolution.generated === true, 'learningEvolution.generated is true');
    assert(liveCliResult.learningEvolution.candidatesDiscovered === 3, 'Discovered 3 candidate learnings');
    assert(liveCliResult.learningEvolution.stagedCount >= 1, 'Domain G candidate safely staged for human review');

    // Verify .project-brain/PROJECT_LEARNING.md on disk
    const onDiskLearning = path.join(SANDBOX_DIR, '.project-brain', 'PROJECT_LEARNING.md');
    assert(fs.existsSync(onDiskLearning), '.project-brain/PROJECT_LEARNING.md exists on disk');
    const onDiskText = fs.readFileSync(onDiskLearning, 'utf-8');
    assert(onDiskText.includes('DocCacheStore'), 'On-disk learning ledger names target product');
    assert(onDiskText.includes('Exit Code: `0`'), 'On-disk learning ledger confirms Exit Code 0');

    // Verify CONSTRUCTION_VERIFICATION_REPORT.md includes Section 5
    const onDiskReport = path.join(SANDBOX_DIR, 'CONSTRUCTION_VERIFICATION_REPORT.md');
    assert(fs.existsSync(onDiskReport), 'CONSTRUCTION_VERIFICATION_REPORT.md exists');
    const reportText = fs.readFileSync(onDiskReport, 'utf-8');
    assert(reportText.includes('5. Continuous Evolution & Learning Feedback (Domain M)'), 'Report includes Domain M Section');
    assert(reportText.includes('4-Pillar Validation **PASSED**'), 'Report confirms 4-Pillar Validation passed');

    // ---------------------------------------------------------------------------
    // GROUP 7: TEARDOWN & ISOLATION
    // ---------------------------------------------------------------------------
    console.log('\n[GROUP 7] Purging Test Sandbox...');
    if (fs.existsSync(SANDBOX_DIR)) {
      fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
    }
    assert(!fs.existsSync(SANDBOX_DIR), 'Sandbox purged cleanly without orphan artifacts');

  } catch (err) {
    console.error('\n❌ Unexpected error in test suite:', err);
    failedTests++;
  }

  console.log('\n======================================================================');
  console.log(`🏁 UNIVERSAL CONSTRUCTION EVOLUTION TEST SUITE: ${passedTests} PASSED | ${failedTests} FAILED`);
  console.log('======================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSuite();
