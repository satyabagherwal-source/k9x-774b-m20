/**
 * Test Suite 2: Shadow Comparator & Semantic Equivalence (Tests 6, 7, 8, 11)
 * 
 * Verifies:
 * - Test 6: Cloud Standard Payload Equivalence (MATCH)
 * - Test 7: Manual Standard Payload Equivalence (MATCH)
 * - Test 8: Duplicate Candidate Detection & Reconciliation (MATCH on duplicate)
 * - Test 11: Unapproved Candidate Staging Gate (SHADOW_STAGED_UNAPPROVED)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { ShadowPipelineExecutor } from '../src/shadow-pipeline-executor.mjs';
import { ShadowComparator, COMPARISON_STATUS } from '../src/shadow-comparator.mjs';
import { classifyKnowledgeContent } from '../../../../04_WORKFLOWS/factory-engine/domain-classifier.mjs';
import { resolveDestination } from '../../../../04_WORKFLOWS/factory-engine/destination-router.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SANDBOX_DIR = path.resolve(__dirname, '..');
const FIXTURES_DIR = path.join(SANDBOX_DIR, 'fixtures');
const TRACES_DIR = path.join(SANDBOX_DIR, 'shadow-traces');

export async function runComparatorTests() {
  const results = {
    suite: 'SHADOW_MODE_COMPARATOR_AND_EQUIVALENCE',
    passed: 0,
    failed: 0,
    tests: []
  };

  console.log('\n=== RUNNING SUITE 2: SHADOW COMPARATOR & EQUIVALENCE ===');

  const executor = new ShadowPipelineExecutor({
    traceDir: TRACES_DIR,
    existingIndex: {
      items: {
        'existing-zod-pkg': {
          repository: 'colinhacks/zod',
          content_hash: 'c1b48b64e0310705a2e6fca78e8b6b0b5c7e098492040b2d6a7d18861cf1f92e',
          verification_status: 'VERIFIED_LEARNING'
        }
      }
    }
  });

  const comparator = new ShadowComparator();

  // -------------------------------------------------------------
  // TEST 6: Equivalence on Standard Cloud Payload
  // -------------------------------------------------------------
  try {
    const cloudFixture = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'cloud-standard-payload.json'), 'utf8'));
    const classification = classifyKnowledgeContent(cloudFixture);
    const routing = resolveDestination(cloudFixture);

    // Exact legacy gateway simulation using identical legacy classifier & router
    const legacyCloud = {
      success: true,
      repository: cloudFixture.repository,
      learning_id: cloudFixture.learning_id,
      content_hash: cloudFixture.content_hash,
      status: 'VERIFIED_LEARNING',
      primary_domain: classification.primaryDomain ? classification.primaryDomain.letter : 'H',
      destination_folder: routing.targetFolder,
      already_indexed: false,
      requires_human_approval: routing.requiresHumanApproval,
      errors: []
    };

    const shadowCloud = await executor.execute(cloudFixture, { origin: 'CLOUD_HARVESTER' });
    const compCloud = comparator.compare(legacyCloud, shadowCloud);

    const t6Passed = compCloud.overall_status === COMPARISON_STATUS.MATCH &&
                     compCloud.facets.domain_classification?.match === true &&
                     compCloud.facets.destination_routing?.match === true;

    results.tests.push({
      test_id: 'TEST-6-CLOUD-EQUIVALENCE',
      name: 'Cloud Standard Payload Semantic Parity',
      passed: t6Passed,
      details: {
        overall_status: compCloud.overall_status,
        domain_match: compCloud.facets.domain_classification?.match,
        routing_match: compCloud.facets.destination_routing?.match,
        shadow_status: shadowCloud.shadow_status,
        discrepancies: compCloud.discrepancies
      }
    });
    if (t6Passed) results.passed++; else results.failed++;
    console.log(`  ${t6Passed ? '✅' : '❌'} Test 6 (Cloud Equivalence): ${compCloud.overall_status}`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-6-CLOUD-EQUIVALENCE', passed: false, error: err.message });
    console.error(`  ❌ Test 6 Failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // TEST 7: Equivalence on Standard Manual Payload
  // -------------------------------------------------------------
  try {
    const manualFixture = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'manual-standard-payload.json'), 'utf8'));
    const classification = classifyKnowledgeContent(manualFixture);
    const routing = resolveDestination(manualFixture);

    const legacyManual = {
      success: true,
      repository: manualFixture.repository,
      learning_id: manualFixture.learning_id,
      content_hash: manualFixture.content_hash,
      status: 'VERIFIED_LEARNING',
      primary_domain: classification.primaryDomain ? classification.primaryDomain.letter : 'G',
      destination_folder: routing.targetFolder,
      already_indexed: false,
      requires_human_approval: routing.requiresHumanApproval,
      errors: []
    };

    const shadowManual = await executor.execute(manualFixture, { origin: 'MANUAL_HARVESTER' });
    const compManual = comparator.compare(legacyManual, shadowManual);

    const t7Passed = compManual.overall_status === COMPARISON_STATUS.MATCH &&
                     compManual.facets.status?.match === true &&
                     compManual.facets.destination_routing?.match === true;

    results.tests.push({
      test_id: 'TEST-7-MANUAL-EQUIVALENCE',
      name: 'Manual Standard Payload Semantic Parity',
      passed: t7Passed,
      details: {
        overall_status: compManual.overall_status,
        domain_match: compManual.facets.domain_classification?.match,
        routing_match: compManual.facets.destination_routing?.match,
        shadow_status: shadowManual.shadow_status,
        discrepancies: compManual.discrepancies
      }
    });
    if (t7Passed) results.passed++; else results.failed++;
    console.log(`  ${t7Passed ? '✅' : '❌'} Test 7 (Manual Equivalence): ${compManual.overall_status}`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-7-MANUAL-EQUIVALENCE', passed: false, error: err.message });
    console.error(`  ❌ Test 7 Failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // TEST 8: Duplicate Candidate Detection
  // -------------------------------------------------------------
  try {
    const dupeFixture = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'duplicate-test-payload.json'), 'utf8'));
    const classification = classifyKnowledgeContent(dupeFixture);
    const routing = resolveDestination(dupeFixture);

    const legacyDupe = {
      success: true,
      repository: dupeFixture.repository,
      learning_id: dupeFixture.learning_id,
      content_hash: dupeFixture.content_hash,
      status: 'VERIFIED_LEARNING',
      already_indexed: true,
      primary_domain: classification.primaryDomain ? classification.primaryDomain.letter : 'H',
      destination_folder: routing.targetFolder,
      requires_human_approval: false,
      errors: []
    };

    const shadowDupe = await executor.execute(dupeFixture, { origin: 'CLOUD_HARVESTER' });
    const compDupe = comparator.compare(legacyDupe, shadowDupe);

    const t8Passed = compDupe.facets.duplicate_detection?.match === true &&
                     shadowDupe.shadow_status === 'SHADOW_DUPLICATE' &&
                     shadowDupe.duplicate_detection.is_duplicate === true;

    results.tests.push({
      test_id: 'TEST-8-DUPLICATE-DETECTION',
      name: 'Duplicate Detection Alignment',
      passed: t8Passed,
      details: {
        shadow_status: shadowDupe.shadow_status,
        is_duplicate: shadowDupe.duplicate_detection?.is_duplicate,
        duplicate_type: shadowDupe.duplicate_detection?.duplicate_type,
        duplicate_match: compDupe.facets.duplicate_detection?.match,
        overall_status: compDupe.overall_status,
        discrepancies: compDupe.discrepancies
      }
    });
    if (t8Passed) results.passed++; else results.failed++;
    console.log(`  ${t8Passed ? '✅' : '❌'} Test 8 (Duplicate Detection): ${shadowDupe.shadow_status} detected`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-8-DUPLICATE-DETECTION', passed: false, error: err.message });
    console.error(`  ❌ Test 8 Failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // TEST 11: Unapproved Candidate Staging Gate
  // -------------------------------------------------------------
  try {
    const unapprovedFixture = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'unapproved-candidate-payload.json'), 'utf8'));
    const classification = classifyKnowledgeContent(unapprovedFixture);
    const routing = resolveDestination(unapprovedFixture);

    const legacyUnapproved = {
      success: true,
      repository: unapprovedFixture.repository,
      learning_id: unapprovedFixture.learning_id,
      content_hash: unapprovedFixture.content_hash,
      status: 'STAGED_INBOX',
      requires_human_approval: true,
      primary_domain: classification.primaryDomain ? classification.primaryDomain.letter : 'G',
      destination_folder: routing.targetFolder,
      errors: []
    };

    const shadowUnapproved = await executor.execute(unapprovedFixture, { origin: 'CLOUD_HARVESTER' });
    const compUnapproved = comparator.compare(legacyUnapproved, shadowUnapproved);

    const t11Passed = shadowUnapproved.shadow_status === 'SHADOW_STAGED_UNAPPROVED' &&
                      compUnapproved.facets.approval_decision?.match === true &&
                      shadowUnapproved.approval_evaluation[0]?.eval.admitted_to_canonical === false;

    results.tests.push({
      test_id: 'TEST-11-UNAPPROVED-STAGING-GATE',
      name: 'Unapproved Candidate Staging Gate',
      passed: t11Passed,
      details: {
        shadow_status: shadowUnapproved.shadow_status,
        admitted_to_canonical: shadowUnapproved.approval_evaluation[0]?.eval.admitted_to_canonical,
        routing_action: shadowUnapproved.approval_evaluation[0]?.eval.routing_action,
        approval_match: compUnapproved.facets.approval_decision?.match,
        overall_status: compUnapproved.overall_status,
        discrepancies: compUnapproved.discrepancies
      }
    });
    if (t11Passed) results.passed++; else results.failed++;
    console.log(`  ${t11Passed ? '✅' : '❌'} Test 11 (Unapproved Gate): Staged as ${shadowUnapproved.shadow_status}`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-11-UNAPPROVED-STAGING-GATE', passed: false, error: err.message });
    console.error(`  ❌ Test 11 Failed: ${err.message}`);
  }

  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runComparatorTests().then(res => {
    console.log(`\nSuite 2 Complete: ${res.passed}/${res.passed + res.failed} Passed`);
  });
}
