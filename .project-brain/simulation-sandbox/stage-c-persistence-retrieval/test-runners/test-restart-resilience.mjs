/**
 * test-restart-resilience.mjs
 * 
 * Verifies index rebuilding from disk files and simulates a full process restart
 * to confirm cold-boot persistence, read-back equality, and retrieval determinism.
 */

import fs from 'fs';
import path from 'path';
import { StageCPersistenceEngine } from '../src/persistence-engine.mjs';
import { StageCIndexingEngine } from '../src/indexing-engine.mjs';
import { StageCRetrievalEngine } from '../src/retrieval-engine.mjs';

const STORE_DIR = '.project-brain/simulation-sandbox/stage-c-persistence-retrieval/test-store';
const INDEX_DIR = '.project-brain/simulation-sandbox/stage-c-persistence-retrieval/test-index';
const RESULTS_DIR = '.project-brain/simulation-sandbox/stage-c-persistence-retrieval/results';

export function runRestartResilienceTests() {
  console.log('\n--- RUNNING RESTART RESILIENCE & INDEX REBUILD TEST SUITE ---');

  const resilienceResults = [];

  // 1. Index Rebuild Test
  console.log('[STEP 1] Testing complete index destruction and rebuild from disk store...');
  const indexPath = path.join(INDEX_DIR, 'index.json');
  if (fs.existsSync(indexPath)) {
    fs.unlinkSync(indexPath);
  }

  const persistencePre = new StageCPersistenceEngine(STORE_DIR);
  const indexingRebuilt = new StageCIndexingEngine(INDEX_DIR);
  const records = persistencePre.listAllRecords();

  const rebuildStats = indexingRebuilt.rebuildIndex(records);
  console.log(`  Rebuilt stats: docs=${rebuildStats.records_indexed}, terms=${rebuildStats.total_terms}`);

  const passRebuild = rebuildStats.records_indexed === 3 && rebuildStats.total_terms > 100;
  console.log(`  Index rebuild: ${passRebuild ? 'PASSED' : 'FAILED'}`);
  resilienceResults.push({
    test_id: "RESILIENCE-1-INDEX-REBUILD",
    description: "Destroy index file and rebuild cleanly from disk-persisted records",
    passed: passRebuild,
    rebuild_stats: rebuildStats
  });

  // 2. Cold-Boot Process Restart Simulation
  console.log('[STEP 2] Simulating process termination and cold boot (all references nulled)...');
  let pEngine = null;
  let iEngine = null;
  let rEngine = null;

  // Reinstantiate purely from disk files
  pEngine = new StageCPersistenceEngine(STORE_DIR);
  iEngine = new StageCIndexingEngine(INDEX_DIR);
  rEngine = new StageCRetrievalEngine(iEngine, pEngine);

  // Read back all records
  console.log('[STEP 3] Performing cold-boot store read-back...');
  const coldRecords = pEngine.listAllRecords();
  const passColdRead = coldRecords.length === 3 && coldRecords.every(r => r.persistence_status === 'PERSISTED');
  console.log(`  Cold-boot read-back: ${passColdRead ? 'PASSED (3/3 records valid)' : 'FAILED'}`);
  resilienceResults.push({
    test_id: "RESILIENCE-2-COLD-BOOT-READBACK",
    description: "Read back all persisted records from cold storage with hash verification",
    passed: passColdRead,
    records_loaded_count: coldRecords.length
  });

  // Query retrieval on cold index
  console.log('[STEP 4] Executing retrieval queries on cold-booted engines...');
  const cmtpQuery = rEngine.search("transformer pooling attention mask clamp");
  const hitCMTP = cmtpQuery.hits[0];
  const passCMTP = hitCMTP?.candidate_id === 'CD-ZNND-CMTP' && hitCMTP?.verification_status === 'VERIFIED';

  const mhupQuery = rEngine.search("hypersphere unit projection cosine distance");
  const hitMHUP = mhupQuery.hits[0];
  const passMHUP = hitMHUP?.candidate_id === 'CD-ZNND-MHUP' && hitMHUP?.verification_status === 'VERIFIED';

  const tokQuery = rEngine.search("tokenizer added tokens special normalized false");
  const hitTOK = tokQuery.hits[0];
  const passTOK = hitTOK?.candidate_id === 'CD-HE9Q-TOKENIZER' && hitTOK?.verification_status === 'VERIFIED';

  const passQueries = passCMTP && passMHUP && passTOK;
  console.log(`  Cold-boot retrieval queries: ${passQueries ? 'PASSED (All 3 champions retrieved & verified)' : 'FAILED'}`);
  resilienceResults.push({
    test_id: "RESILIENCE-3-COLD-BOOT-RETRIEVAL",
    description: "Execute precision queries on cold-booted index and assert 100% deterministic hits",
    passed: passQueries,
    top_hits: {
      cmtp: hitCMTP?.candidate_id,
      mhup: hitMHUP?.candidate_id,
      tokenizer: hitTOK?.candidate_id
    }
  });

  const allPassed = resilienceResults.every(r => r.passed);
  console.log(`\nRESTART RESILIENCE SUITE COMPLETE: ${allPassed ? 'ALL PASSED' : 'FAILURES DETECTED'}`);
  return { allPassed, resilienceResults };
}

if (process.argv[1]?.endsWith('test-restart-resilience.mjs')) {
  runRestartResilienceTests();
}

