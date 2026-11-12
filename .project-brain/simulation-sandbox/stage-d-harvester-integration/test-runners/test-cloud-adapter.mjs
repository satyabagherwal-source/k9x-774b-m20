/**
 * test-cloud-adapter.mjs
 * 
 * Verifies that Cloud Harvester input flows cleanly through the CloudHarvesterAdapter,
 * executes the full shared pipeline, persists approved candidates with read-back verification,
 * indexes and retrieves candidates, preserves provenance, and logs auditable traces.
 */

import fs from 'fs';
import path from 'path';
import { SharedHarvestingPipeline } from '../src/shared-pipeline.mjs';
import { CloudHarvesterAdapter } from '../src/cloud-adapter.mjs';

const SANDBOX_ROOT = '.project-brain/simulation-sandbox/stage-d-harvester-integration';
const FIXTURES_DIR = path.join(SANDBOX_ROOT, 'fixtures');

export async function runCloudAdapterTest() {
  console.log('\n--- TEST SUITE 1: CLOUD HARVESTER ADAPTER & INTEGRATION ---');

  const pipeline = new SharedHarvestingPipeline({ sandboxRoot: SANDBOX_ROOT });
  const cloudAdapter = new CloudHarvesterAdapter(pipeline);

  const rawCloudInput = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'cloud-harvest-input.json'), 'utf8'));

  console.log(`[SUBMIT] Submitting Cloud harvest payload for: ${rawCloudInput.repository}...`);
  const result = await cloudAdapter.submitHarvest(rawCloudInput);

  console.log(`  Pipeline Status: ${result.status}`);
  console.log(`  Domain: ${result.domain_classification.letter} (${result.domain_classification.name})`);
  console.log(`  Destination: ${result.destination_routing.target_folder}`);
  console.log(`  Persisted Candidates: ${result.metrics.candidates_persisted}`);
  console.log(`  Retrieval Verified: ${result.metrics.retrieval_verified_count}`);

  const passedReq1 = result.harvest_origin === 'CLOUD_HARVESTER';
  const passedReq7 = result.metrics.candidates_persisted === 1;
  const passedReq8 = result.persisted_records.length === 1 && Boolean(result.persisted_records[0].hash);
  const passedReq9 = result.retrieval_verifications.length > 0 && result.retrieval_verifications[0].retrieved === true;
  const passedReq13 = result.source_revision === rawCloudInput.sourceVersion;

  const testPassed = passedReq1 && passedReq7 && passedReq8 && passedReq9 && passedReq13;

  console.log(`  Test Result: ${testPassed ? 'ALL CHECKS PASSED' : 'FAILURES DETECTED'}`);

  return {
    test_id: 'STAGE-D-TEST-1-CLOUD-ADAPTER',
    passed: testPassed,
    requirements_verified: ['REQ-1-CLOUD-INPUT-REACHES-PIPELINE', 'REQ-7-APPROVED-PERSISTS', 'REQ-8-READBACK-VERIFIED', 'REQ-9-INDEXING-RETRIEVAL', 'REQ-13-PROVENANCE-PRESERVED'],
    result
  };
}

if (process.argv[1]?.endsWith('test-cloud-adapter.mjs')) {
  runCloudAdapterTest();
}

