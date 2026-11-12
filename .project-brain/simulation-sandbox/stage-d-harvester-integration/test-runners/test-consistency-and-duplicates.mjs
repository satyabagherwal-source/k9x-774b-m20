/**
 * test-consistency-and-duplicates.mjs
 * 
 * Verifies cross-harvester classification consistency on equivalent inputs,
 * duplicate candidate detection, and idempotent retry behavior without duplicate record creation.
 */

import fs from 'fs';
import path from 'path';
import { SharedHarvestingPipeline } from '../src/shared-pipeline.mjs';
import { CloudHarvesterAdapter } from '../src/cloud-adapter.mjs';
import { ManualHarvesterAdapter } from '../src/manual-adapter.mjs';

const SANDBOX_ROOT = '.project-brain/simulation-sandbox/stage-d-harvester-integration';
const FIXTURES_DIR = path.join(SANDBOX_ROOT, 'fixtures');

export async function runConsistencyAndDuplicateTests() {
  console.log('\n--- TEST SUITE 3: CONSISTENCY, DUPLICATE COLLISION & RETRY BEHAVIOR ---');

  const pipeline = new SharedHarvestingPipeline({ sandboxRoot: SANDBOX_ROOT });
  const cloudAdapter = new CloudHarvesterAdapter(pipeline);
  const manualAdapter = new ManualHarvesterAdapter(pipeline);

  const equivCloud = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'equivalent-cloud-sample.json'), 'utf8'));
  const equivManual = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'equivalent-manual-sample.json'), 'utf8'));
  const dupeInput = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'synthetic-duplicate-input.json'), 'utf8'));

  // Test 3.1: Equivalent input consistency
  console.log('[STEP 1] Testing classification consistency across Cloud vs Manual payloads...');
  const resCloud = await cloudAdapter.submitHarvest(equivCloud);
  const resManual = await manualAdapter.submitHarvest(equivManual);

  const domainConsistent = resCloud.domain_classification.letter === resManual.domain_classification.letter;
  const destinationConsistent = resCloud.destination_routing.target_folder === resManual.destination_routing.target_folder;

  console.log(`  Cloud Domain: ${resCloud.domain_classification.letter} | Manual Domain: ${resManual.domain_classification.letter} (Match: ${domainConsistent})`);
  console.log(`  Cloud Dest: ${resCloud.destination_routing.target_folder} | Manual Dest: ${resManual.destination_routing.target_folder} (Match: ${destinationConsistent})`);

  const passedConsistency = domainConsistent && destinationConsistent;

  // Test 3.2: Duplicate Candidate Detection
  console.log('[STEP 2] Submitting duplicate candidate payload (collision test)...');
  const resDupe = await cloudAdapter.submitHarvest(dupeInput);
  const dupeCaught = resDupe.rejected_records.some(r => r.candidate_id === 'CD-D-CLOUD-CMTP' && r.reason === 'DUPLICATE_ID_REJECTED');
  console.log(`  Duplicate detection result: ${dupeCaught ? 'PASSED (Duplicate caught)' : 'FAILED'}`);

  // Test 3.3: Idempotent Retry Behavior
  console.log('[STEP 3] Simulating workflow retry (re-submitting identical payload)...');
  const storeBefore = pipeline.persistenceEngine.getRegistry().records_count;
  const resRetry = await cloudAdapter.submitHarvest(equivCloud);
  const storeAfter = pipeline.persistenceEngine.getRegistry().records_count;

  const retryIdempotent = (storeBefore === storeAfter) && resRetry.rejected_records.length > 0;
  console.log(`  Retry store count before: ${storeBefore}, after: ${storeAfter} (Zero duplicates created: ${retryIdempotent})`);

  const allPassed = passedConsistency && dupeCaught && retryIdempotent;
  console.log(`  Test Result: ${allPassed ? 'ALL CHECKS PASSED' : 'FAILURES DETECTED'}`);

  return {
    test_id: 'STAGE-D-TEST-3-CONSISTENCY-DUPLICATES-RETRY',
    passed: allPassed,
    requirements_verified: [
      'REQ-3-EQUIVALENT-CONSISTENT-CLASSIFICATION',
      'REQ-4-DOMAIN-DESTINATION-CONSISTENT',
      'REQ-5-DUPLICATE-DETECTED',
      'REQ-12-RETRY-NO-DUPLICATES'
    ],
    details: {
      consistency: { domainConsistent, destinationConsistent },
      duplicate_detected: dupeCaught,
      retry_idempotent: retryIdempotent
    }
  };
}

if (process.argv[1]?.endsWith('test-consistency-and-duplicates.mjs')) {
  runConsistencyAndDuplicateTests();
}

