/**
 * test-approval-and-persistence.mjs
 * 
 * Verifies that unapproved candidates cannot persist canonically,
 * unapproved records are staged safely in 11_INBOX without silent loss,
 * malformed payloads fail gracefully without uncaught exceptions,
 * and human approval decisions are strictly respected.
 */

import fs from 'fs';
import path from 'path';
import { SharedHarvestingPipeline } from '../src/shared-pipeline.mjs';
import { CloudHarvesterAdapter } from '../src/cloud-adapter.mjs';

const SANDBOX_ROOT = '.project-brain/simulation-sandbox/stage-d-harvester-integration';
const FIXTURES_DIR = path.join(SANDBOX_ROOT, 'fixtures');

export async function runApprovalAndPersistenceTests() {
  console.log('\n--- TEST SUITE 4: APPROVAL GATE, INBOX STAGING & ERROR HANDLING ---');

  const pipeline = new SharedHarvestingPipeline({ sandboxRoot: SANDBOX_ROOT });
  const cloudAdapter = new CloudHarvesterAdapter(pipeline);

  const unapprovedInput = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'synthetic-unapproved-input.json'), 'utf8'));
  const malformedInput = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'synthetic-malformed-input.json'), 'utf8'));

  // Test 4.1: Unapproved Candidate Gate & Inbox Staging
  console.log('[STEP 1] Submitting candidate with PENDING_APPROVAL status...');
  const resUnapproved = await cloudAdapter.submitHarvest(unapprovedInput);

  const zeroPersisted = resUnapproved.metrics.candidates_persisted === 0;
  const stagedCount = resUnapproved.metrics.candidates_staged_inbox === 1;
  const inboxFileExists = fs.existsSync(resUnapproved.staged_inbox_records[0]?.file_path || '');

  console.log(`  Canonical Persisted Count: ${resUnapproved.metrics.candidates_persisted} (Expected 0: ${zeroPersisted})`);
  console.log(`  Staged Inbox Count: ${resUnapproved.metrics.candidates_staged_inbox} (Expected 1: ${stagedCount})`);
  console.log(`  Inbox Staged File on Disk: ${inboxFileExists ? 'EXISTS (Preserved)' : 'MISSING'}`);

  const passApprovalGate = zeroPersisted && stagedCount && inboxFileExists;

  // Test 4.2: Malformed Input Graceful Failure
  console.log('[STEP 2] Submitting malformed payload lacking identity fields...');
  let passMalformed = false;
  try {
    const resMalformed = await cloudAdapter.submitHarvest(malformedInput);
    if (!resMalformed.success && (resMalformed.errors?.length > 0 || resMalformed.status === 'PROVENANCE_FAILED')) {
      passMalformed = true;
      console.log(`  Graceful Failure Handled: ${resMalformed.status} (${(resMalformed.errors || []).join(', ')})`);
    } else {
      console.log(`  Malformed payload was not rejected as expected: status=${resMalformed.status}`);
    }
  } catch (err) {
    console.error(`  Unhandled exception on malformed payload: ${err.message}`);
    passMalformed = false;
  }

  const allPassed = passApprovalGate && passMalformed;
  console.log(`  Test Result: ${allPassed ? 'ALL CHECKS PASSED' : 'FAILURES DETECTED'}`);

  return {
    test_id: 'STAGE-D-TEST-4-APPROVAL-INBOX-ERROR-HANDLING',
    passed: allPassed,
    requirements_verified: [
      'REQ-6-UNAPPROVED-CANNOT-PERSIST',
      'REQ-10-CORRUPTED-INPUTS-FAIL-SAFELY',
      'REQ-11-NO-SILENT-LOSS-STAGED-INBOX',
      'REQ-14-APPROVAL-DECISIONS-RESPECTED'
    ],
    details: {
      approval_gate_passed: passApprovalGate,
      malformed_handling_passed: passMalformed
    }
  };
}

if (process.argv[1]?.endsWith('test-approval-and-persistence.mjs')) {
  runApprovalAndPersistenceTests();
}
