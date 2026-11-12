/**
 * test-admission-and-persistence.mjs
 * 
 * Verifies candidate admission gates, schema rules, domain/destination boundaries,
 * duplicate detection, atomic file persistence, read-back equality, and SHA-256 hash integrity.
 */

import fs from 'fs';
import path from 'path';
import { StageCPersistenceEngine } from '../src/persistence-engine.mjs';

const STORE_DIR = '.project-brain/simulation-sandbox/stage-c-persistence-retrieval/test-store';
const FIXTURES_DIR = '.project-brain/simulation-sandbox/stage-c-persistence-retrieval/fixtures';
const RESULTS_DIR = '.project-brain/simulation-sandbox/stage-c-persistence-retrieval/results';

export function runAdmissionAndPersistenceTests() {
  console.log('\n--- RUNNING ADMISSION & PERSISTENCE TEST SUITE ---');

  // Reset store directory for clean run
  if (fs.existsSync(STORE_DIR)) {
    fs.rmSync(STORE_DIR, { recursive: true, force: true });
  }
  const engine = new StageCPersistenceEngine(STORE_DIR);

  const testResults = [];
  const readbackResults = [];

  // Helper to load fixture
  const loadFixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8'));

  // Test 1: Valid Approved Candidate 1 (CMTP)
  console.log('[TEST 1] Persisting Approved CMTP Candidate...');
  const cmtp = loadFixture('candidate-cmtp-approved.json');
  const res1 = engine.persistCandidate(cmtp);
  const pass1 = res1.success && res1.status === 'PERSISTED_AND_READBACK_VERIFIED';
  testResults.push({
    test_id: 'TEST-1-VALID-APPROVED-CMTP',
    fixture: 'candidate-cmtp-approved.json',
    expected_status: 'PERSISTED_AND_READBACK_VERIFIED',
    actual_status: res1.status,
    passed: pass1,
    details: res1
  });
  console.log(`  Result: ${pass1 ? 'PASSED' : 'FAILED'} (status: ${res1.status})`);

  // Test 2: Valid Approved Candidate 2 (MHUP)
  console.log('[TEST 2] Persisting Approved MHUP Candidate...');
  const mhup = loadFixture('candidate-mhup-approved.json');
  const res2 = engine.persistCandidate(mhup);
  const pass2 = res2.success && res2.status === 'PERSISTED_AND_READBACK_VERIFIED';
  testResults.push({
    test_id: 'TEST-2-VALID-APPROVED-MHUP',
    fixture: 'candidate-mhup-approved.json',
    expected_status: 'PERSISTED_AND_READBACK_VERIFIED',
    actual_status: res2.status,
    passed: pass2,
    details: res2
  });
  console.log(`  Result: ${pass2 ? 'PASSED' : 'FAILED'} (status: ${res2.status})`);

  // Test 3: Valid Approved Candidate 3 (Tokenizer Boundary)
  console.log('[TEST 3] Persisting Approved Tokenizer Candidate...');
  const tokenizer = loadFixture('candidate-tokenizer-approved.json');
  const res3 = engine.persistCandidate(tokenizer);
  const pass3 = res3.success && res3.status === 'PERSISTED_AND_READBACK_VERIFIED';
  testResults.push({
    test_id: 'TEST-3-VALID-APPROVED-TOKENIZER',
    fixture: 'candidate-tokenizer-approved.json',
    expected_status: 'PERSISTED_AND_READBACK_VERIFIED',
    actual_status: res3.status,
    passed: pass3,
    details: res3
  });
  console.log(`  Result: ${pass3 ? 'PASSED' : 'FAILED'} (status: ${res3.status})`);

  // Test 4: Unapproved Candidate Rejection (Pending GGUF)
  console.log('[TEST 4] Rejecting Unapproved Candidate (GGUF Header - Pending)...');
  const gguf = loadFixture('candidate-gguf-pending.json');
  const res4 = engine.persistCandidate(gguf);
  const pass4 = !res4.success && res4.status === 'UNAPPROVED_RECORD_REJECTED';
  testResults.push({
    test_id: 'TEST-4-REJECT-UNAPPROVED-GGUF',
    fixture: 'candidate-gguf-pending.json',
    expected_status: 'UNAPPROVED_RECORD_REJECTED',
    actual_status: res4.status,
    passed: pass4,
    details: res4
  });
  console.log(`  Result: ${pass4 ? 'PASSED' : 'FAILED'} (status: ${res4.status})`);

  // Test 5: Unapproved Candidate Rejection (Pending Ternary LUT)
  console.log('[TEST 5] Rejecting Unapproved Candidate (Ternary LUT - Pending)...');
  const ternary = loadFixture('candidate-ternary-pending.json');
  const res5 = engine.persistCandidate(ternary);
  const pass5 = !res5.success && res5.status === 'UNAPPROVED_RECORD_REJECTED';
  testResults.push({
    test_id: 'TEST-5-REJECT-UNAPPROVED-TERNARY',
    fixture: 'candidate-ternary-pending.json',
    expected_status: 'UNAPPROVED_RECORD_REJECTED',
    actual_status: res5.status,
    passed: pass5,
    details: res5
  });
  console.log(`  Result: ${pass5 ? 'PASSED' : 'FAILED'} (status: ${res5.status})`);

  // Test 6: Synthetic Unapproved Rejection
  console.log('[TEST 6] Rejecting Synthetic Unapproved Candidate...');
  const synUnapp = loadFixture('synthetic-unapproved.json');
  const res6 = engine.persistCandidate(synUnapp);
  const pass6 = !res6.success && res6.status === 'UNAPPROVED_RECORD_REJECTED';
  testResults.push({
    test_id: 'TEST-6-REJECT-SYNTHETIC-UNAPPROVED',
    fixture: 'synthetic-unapproved.json',
    expected_status: 'UNAPPROVED_RECORD_REJECTED',
    actual_status: res6.status,
    passed: pass6,
    details: res6
  });
  console.log(`  Result: ${pass6 ? 'PASSED' : 'FAILED'} (status: ${res6.status})`);

  // Test 7: Missing Evidence Rejection
  console.log('[TEST 7] Rejecting Record with Missing Evidence...');
  const synNoEv = loadFixture('synthetic-missing-evidence.json');
  const res7 = engine.persistCandidate(synNoEv);
  const pass7 = !res7.success && res7.status === 'VALIDATION_FAILED';
  testResults.push({
    test_id: 'TEST-7-REJECT-MISSING-EVIDENCE',
    fixture: 'synthetic-missing-evidence.json',
    expected_status: 'VALIDATION_FAILED',
    actual_status: res7.status,
    passed: pass7,
    details: res7
  });
  console.log(`  Result: ${pass7 ? 'PASSED' : 'FAILED'} (status: ${res7.status})`);

  // Test 8: Duplicate Candidate ID Rejection
  console.log('[TEST 8] Rejecting Duplicate Candidate ID (CMTP again)...');
  const res8 = engine.persistCandidate(cmtp);
  const pass8 = !res8.success && res8.status === 'DUPLICATE_ID_REJECTED';
  testResults.push({
    test_id: 'TEST-8-REJECT-DUPLICATE-ID',
    fixture: 'candidate-cmtp-approved.json',
    expected_status: 'DUPLICATE_ID_REJECTED',
    actual_status: res8.status,
    passed: pass8,
    details: res8
  });
  console.log(`  Result: ${pass8 ? 'PASSED' : 'FAILED'} (status: ${res8.status})`);

  // Test 9: Duplicate Reference Collision Rejection
  console.log('[TEST 9] Rejecting Record with Conflicting Duplicate Reference...');
  const synDupeRef = loadFixture('synthetic-duplicate-reference.json');
  const res9 = engine.persistCandidate(synDupeRef);
  const pass9 = !res9.success && res9.status === 'DUPLICATE_REFERENCE_DETECTED';
  testResults.push({
    test_id: 'TEST-9-REJECT-DUPLICATE-REFERENCE',
    fixture: 'synthetic-duplicate-reference.json',
    expected_status: 'DUPLICATE_REFERENCE_DETECTED',
    actual_status: res9.status,
    passed: pass9,
    details: res9
  });
  console.log(`  Result: ${pass9 ? 'PASSED' : 'FAILED'} (status: ${res9.status})`);

  // Test 10: Invalid Domain Rejection
  console.log('[TEST 10] Rejecting Record with Invalid Domain (Z)...');
  const synBadDomain = loadFixture('synthetic-invalid-domain.json');
  const res10 = engine.persistCandidate(synBadDomain);
  const pass10 = !res10.success && res10.status === 'VALIDATION_FAILED';
  testResults.push({
    test_id: 'TEST-10-REJECT-INVALID-DOMAIN',
    fixture: 'synthetic-invalid-domain.json',
    expected_status: 'VALIDATION_FAILED',
    actual_status: res10.status,
    passed: pass10,
    details: res10
  });
  console.log(`  Result: ${pass10 ? 'PASSED' : 'FAILED'} (status: ${res10.status})`);

  // Test 11: Invalid Destination Rejection
  console.log('[TEST 11] Rejecting Record with Invalid Destination (99_NONEXISTENT_FOLDER)...');
  const synBadDest = loadFixture('synthetic-invalid-destination.json');
  const res11 = engine.persistCandidate(synBadDest);
  const pass11 = !res11.success && res11.status === 'VALIDATION_FAILED';
  testResults.push({
    test_id: 'TEST-11-REJECT-INVALID-DESTINATION',
    fixture: 'synthetic-invalid-destination.json',
    expected_status: 'VALIDATION_FAILED',
    actual_status: res11.status,
    passed: pass11,
    details: res11
  });
  console.log(`  Result: ${pass11 ? 'PASSED' : 'FAILED'} (status: ${res11.status})`);

  // Read-Back Verification for All Successfully Persisted Records
  console.log('[TEST 12] Performing Independent Read-Back Integrity Audit...');
  const persistedIds = ['CD-ZNND-CMTP', 'CD-ZNND-MHUP', 'CD-HE9Q-TOKENIZER'];
  for (const id of persistedIds) {
    const read = engine.readRecord(id);
    const pass = read.found && read.valid && !read.tampered;
    readbackResults.push({
      candidate_id: id,
      found_on_disk: read.found,
      integrity_valid: read.valid,
      tampered: read.tampered,
      stored_hash: read.stored_hash,
      computed_hash: read.current_hash,
      passed: pass
    });
    console.log(`  Read-back '${id}': ${pass ? 'PASSED (Bitwise Hash Verified)' : 'FAILED'}`);
  }

  // Save Results
  fs.writeFileSync(path.join(RESULTS_DIR, 'persistence-results.json'), JSON.stringify(testResults, null, 2), 'utf8');
  fs.writeFileSync(path.join(RESULTS_DIR, 'readback-integrity-results.json'), JSON.stringify(readbackResults, null, 2), 'utf8');

  const allPassed = testResults.every(t => t.passed) && readbackResults.every(r => r.passed);
  console.log(`\nADMISSION & PERSISTENCE SUITE COMPLETE: ${allPassed ? 'ALL PASSED' : 'FAILURES DETECTED'}`);
  return { allPassed, testResults, readbackResults, engine };
}

if (process.argv[1]?.endsWith('test-admission-and-persistence.mjs')) {
  runAdmissionAndPersistenceTests();
}

