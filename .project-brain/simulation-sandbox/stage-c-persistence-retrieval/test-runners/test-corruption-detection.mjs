/**
 * test-corruption-detection.mjs
 * 
 * Verifies detection of disk tampering, bitflip content corruption,
 * broken JSON syntax, and integrity check enforcement during retrieval.
 */

import fs from 'fs';
import path from 'path';
import { StageCPersistenceEngine } from '../src/persistence-engine.mjs';
import { StageCIndexingEngine } from '../src/indexing-engine.mjs';
import { StageCRetrievalEngine } from '../src/retrieval-engine.mjs';

const STORE_DIR = '.project-brain/simulation-sandbox/stage-c-persistence-retrieval/test-store';
const INDEX_DIR = '.project-brain/simulation-sandbox/stage-c-persistence-retrieval/test-index';
const RESULTS_DIR = '.project-brain/simulation-sandbox/stage-c-persistence-retrieval/results';

export function runCorruptionDetectionTests() {
  console.log('\n--- RUNNING CORRUPTION DETECTION TEST SUITE ---');

  const persistence = new StageCPersistenceEngine(STORE_DIR);
  const indexing = new StageCIndexingEngine(INDEX_DIR);
  const retrieval = new StageCRetrievalEngine(indexing, persistence);

  const corruptionResults = [];

  // 1. Create a synthetic valid candidate to be tampered with
  const tamperId = "FIXTURE-SYNTHETIC-TAMPER-TARGET";
  const candidateToTamper = {
    fixture_type: "SYNTHETIC_TEST_FIXTURE",
    synthetic_label: "DO_NOT_TREAT_AS_REAL_WORLD_KNOWLEDGE",
    candidate_id: tamperId,
    title: "Synthetic Tamper Target Invariant",
    content: "Original clean content prior to unauthorized tampering modification.",
    summary: "Synthetic target for bitflip integrity test.",
    domain_classification: "H",
    proposed_canonical_destination: "05_KNOWLEDGE",
    duplicate_references: [],
    approval_status: "APPROVED",
    implementation_evidence_status: "CONFIGURATION_CONTRACT_TESTED",
    knowledge_transferability_status: "TRANSFERABLE_PATTERN_CANDIDATE",
    provenance: {
      upstream_repository: "https://example.com/tamper-test",
      target_source_file: "test.js"
    },
    evidence: {
      evidence_type: "SYNTHETIC_TEST",
      verification_status: "CONTRACT_VERIFIED"
    }
  };

  console.log('[STEP 1] Persisting clean tamper target candidate...');
  const persistRes = persistence.persistCandidate(candidateToTamper);
  const filePath = persistRes.file_path;
  indexing.indexRecord(persistRes.record);

  // Assert initially clean
  const preCheck = persistence.readRecord(tamperId);
  const passPre = preCheck.found && preCheck.valid && !preCheck.tampered;
  console.log(`  Pre-tamper verification: ${passPre ? 'PASSED (Clean)' : 'FAILED'}`);

  // 2. Perform unauthorized mutation on disk (change 1 word in content without recomputing hash)
  console.log('[STEP 2] Simulating silent disk tampering (payload mutation)...');
  const diskRaw = fs.readFileSync(filePath, 'utf8');
  const diskObj = JSON.parse(diskRaw);
  diskObj.content = "TAMPERED MALICIOUS CONTENT INJECTED ON DISK";
  fs.writeFileSync(filePath, JSON.stringify(diskObj, null, 2), 'utf8');

  // 3. Test Read-Back Detection of Tampering
  console.log('[STEP 3] Verifying readRecord catches hash mismatch...');
  const postCheck = persistence.readRecord(tamperId);
  const passPost = postCheck.found && !postCheck.valid && postCheck.tampered;
  console.log(`  Tamper detection: ${passPost ? 'PASSED (Detected Tampering)' : 'FAILED'}`);
  corruptionResults.push({
    test_id: "CORRUPTION-1-PAYLOAD-TAMPERING-DETECTED",
    description: "Detect unauthorized content alteration via cryptographic SHA-256 mismatch",
    passed: passPost,
    stored_hash: postCheck.stored_hash,
    computed_hash: postCheck.current_hash
  });

  // 4. Test Retrieval Verification flags tampered record
  console.log('[STEP 4] Verifying search flags hit as FAILED_INTEGRITY_TAMPERED...');
  const searchTamper = retrieval.search("tamper target invariant");
  const hit = searchTamper.hits.find(h => h.candidate_id === tamperId);
  const passSearch = hit && hit.verification_status === 'FAILED_INTEGRITY_TAMPERED';
  console.log(`  Retrieval verification flag: ${passSearch ? 'PASSED (FAILED_INTEGRITY_TAMPERED flagged)' : 'FAILED'}`);
  corruptionResults.push({
    test_id: "CORRUPTION-2-RETRIEVAL-FLAGS-TAMPERING",
    description: "Ensure search engine rejects/flags tampered record during query execution",
    passed: passSearch,
    verification_status: hit?.verification_status,
    anomalies: hit?.verification_anomalies
  });

  // 5. Test Broken JSON Syntax Detection
  console.log('[STEP 5] Testing malformed/broken JSON syntax on disk...');
  fs.writeFileSync(filePath, '{ "candidate_id": "BROKEN_JSON, missing quote and bracket', 'utf8');
  const brokenCheck = persistence.readRecord(tamperId);
  const passBroken = brokenCheck.found && !brokenCheck.valid && brokenCheck.error.includes('Corrupted JSON');
  console.log(`  Broken JSON detection: ${passBroken ? 'PASSED (Syntax Error Caught)' : 'FAILED'}`);
  corruptionResults.push({
    test_id: "CORRUPTION-3-BROKEN-JSON-SYNTAX",
    description: "Ensure store gracefully catches and flags unparseable disk corruption",
    passed: passBroken,
    error: brokenCheck.error
  });

  // 6. Cleanup: Remove temporary tampered record from store and index
  console.log('[STEP 6] Cleaning up test tampered file and index entry...');
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  const reg = persistence.getRegistry();
  delete reg.records[tamperId];
  persistence.saveRegistry(reg);
  indexing.rebuildIndex(persistence.listAllRecords());
  console.log('  Cleaned up tamper target cleanly.');

  const allPassed = corruptionResults.every(r => r.passed);
  console.log(`\nCORRUPTION DETECTION SUITE COMPLETE: ${allPassed ? 'ALL PASSED' : 'FAILURES DETECTED'}`);
  return { allPassed, corruptionResults };
}

if (process.argv[1]?.endsWith('test-corruption-detection.mjs')) {
  runCorruptionDetectionTests();
}

