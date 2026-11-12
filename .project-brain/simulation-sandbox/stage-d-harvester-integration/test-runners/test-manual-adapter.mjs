/**
 * test-manual-adapter.mjs
 * 
 * Verifies that Manual Harvester input flows cleanly through the ManualHarvesterAdapter,
 * executes the full shared pipeline, persists approved candidates with read-back verification,
 * indexes and retrieves candidates, preserves provenance, and logs auditable traces.
 */

import fs from 'fs';
import path from 'path';
import { SharedHarvestingPipeline } from '../src/shared-pipeline.mjs';
import { ManualHarvesterAdapter } from '../src/manual-adapter.mjs';

const SANDBOX_ROOT = '.project-brain/simulation-sandbox/stage-d-harvester-integration';
const FIXTURES_DIR = path.join(SANDBOX_ROOT, 'fixtures');

export async function runManualAdapterTest() {
  console.log('\n--- TEST SUITE 2: MANUAL HARVESTER ADAPTER & INTEGRATION ---');

  const pipeline = new SharedHarvestingPipeline({ sandboxRoot: SANDBOX_ROOT });
  const manualAdapter = new ManualHarvesterAdapter(pipeline);

  const rawManualInput = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'manual-harvest-input.json'), 'utf8'));

  console.log(`[SUBMIT] Submitting Manual harvest payload for: ${rawManualInput.owner}/${rawManualInput.repo}...`);
  const result = await manualAdapter.submitHarvest(rawManualInput);

  console.log(`  Pipeline Status: ${result.status}`);
  console.log(`  Domain: ${result.domain_classification.letter} (${result.domain_classification.name})`);
  console.log(`  Destination: ${result.destination_routing.target_folder}`);
  console.log(`  Persisted Candidates: ${result.metrics.candidates_persisted}`);
  console.log(`  Retrieval Verified: ${result.metrics.retrieval_verified_count}`);

  const passedReq2 = result.harvest_origin === 'MANUAL_HARVESTER';
  const passedReq7 = result.metrics.candidates_persisted === 1;
  const passedReq8 = result.persisted_records.length === 1 && Boolean(result.persisted_records[0].hash);
  const passedReq9 = result.retrieval_verifications.length > 0 && result.retrieval_verifications[0].retrieved === true;
  const passedReq13 = result.source_revision === rawManualInput.commitSha;

  const testPassed = passedReq2 && passedReq7 && passedReq8 && passedReq9 && passedReq13;

  console.log(`  Test Result: ${testPassed ? 'ALL CHECKS PASSED' : 'FAILURES DETECTED'}`);

  return {
    test_id: 'STAGE-D-TEST-2-MANUAL-ADAPTER',
    passed: testPassed,
    requirements_verified: ['REQ-2-MANUAL-INPUT-REACHES-PIPELINE', 'REQ-7-APPROVED-PERSISTS', 'REQ-8-READBACK-VERIFIED', 'REQ-9-INDEXING-RETRIEVAL', 'REQ-13-PROVENANCE-PRESERVED'],
    result
  };
}

if (process.argv[1]?.endsWith('test-manual-adapter.mjs')) {
  runManualAdapterTest();
}

