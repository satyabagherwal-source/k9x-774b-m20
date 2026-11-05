/**
 * Automated Verification Suite for Retrieval Engine Cache Persistence Reliability (DIB-003)
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-cache-persistence-reliability.mjs
 * Purpose: Verifies atomic persistence, async completion signals, observable failure recovery,
 *          fresh-process cache loading, and separated end-to-end timing metrics.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  buildSearchIndex,
  waitForCachePersistence,
  getCachePersistenceStatus,
  searchBrain,
  getRetrievalPaths
} from './retrieval-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

console.log('======================================================================');
console.log('🧪 TEST SUITE: CACHE PERSISTENCE RELIABILITY & ATOMICITY (DIB-003)');
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

const sandboxDir = path.join(BRAIN_ROOT, '.project-brain', 'simulation-sandbox', 'test-persistence-dib003');
fs.mkdirSync(sandboxDir, { recursive: true });

async function runSuite() {
  try {
    // ---------------------------------------------------------------------------
    // TEST 1: Index Generation & Non-Blocking Synchronous Return
    // ---------------------------------------------------------------------------
    console.log('[TEST 1] Testing In-Memory Index Computation & Persistence Scheduling...');
    const t0 = Date.now();
    const index = buildSearchIndex(true);
    const returnLatency = Date.now() - t0;

    assert(index.totalDocuments > 250, 'Corpus indexed successfully', `Total docs: ${index.totalDocuments}`);
    assert(returnLatency < 2000, 'buildSearchIndex() returns within 2000ms threshold', `${returnLatency}ms`);
    assert(index.persistencePromise instanceof Promise, 'Persistence promise attached to indexPackage');

    const initialStatus = getCachePersistenceStatus();
    assert(initialStatus.status === 'persisting' || initialStatus.status === 'persisted',
      'Persistence status is observable immediately', `Status: ${initialStatus.status}`);

    // ---------------------------------------------------------------------------
    // TEST 2: Asynchronous Persistence Completion & Detailed Metric Logging
    // ---------------------------------------------------------------------------
    console.log('\n[TEST 2] Testing Observable Persistence Completion & Timing Metrics...');
    const persistenceResult = await waitForCachePersistence(null, 15000);

    assert(persistenceResult.success === true, 'waitForCachePersistence resolves successfully');
    assert(fs.existsSync(persistenceResult.filePath), 'Physical cache file exists on disk', persistenceResult.filePath);

    const postStatus = getCachePersistenceStatus();
    assert(postStatus.status === 'persisted', 'Cache persistence status marked persisted');
    assert(postStatus.stats !== null, 'Persistence stats recorded');

    const stats = postStatus.stats;
    console.log('  📊 [METRICS BREAKDOWN]');
    console.log(`     A. Index Computation Time:     ${stats.computationMs} ms`);
    console.log(`     B. JSON Serialization Time:    ${stats.serializationMs} ms`);
    console.log(`     C. Disk Persistence Time:      ${stats.diskWriteMs} ms`);
    console.log(`     D. Total End-to-End Readiness: ${stats.totalReadinessMs} ms`);
    console.log(`     E. Disk Payload Size:          ${(stats.payloadSizeBytes / 1024 / 1024).toFixed(2)} MB`);

    assert(stats.computationMs > 0, 'Computation time measured');
    assert(stats.serializationMs > 0, 'Serialization time measured');
    assert(stats.diskWriteMs > 0, 'Disk write time measured');
    assert(stats.totalReadinessMs >= stats.computationMs, 'Total readiness encompasses computation + persistence');
    assert(stats.payloadSizeBytes > 10 * 1024 * 1024, 'Full corpus serialized (> 10MB)', `${(stats.payloadSizeBytes / 1024 / 1024).toFixed(2)} MB`);

    // ---------------------------------------------------------------------------
    // TEST 3: Fresh Process Cold-Start from Persisted Cache
    // ---------------------------------------------------------------------------
    console.log('\n[TEST 3] Testing Fresh Process Startup from Persisted Disk Cache...');
    const engineUrl = pathToFileURL(path.join(BRAIN_ROOT, '04_WORKFLOWS', 'factory-engine', 'retrieval-engine.mjs')).href;
    const subprocessScript = path.join(sandboxDir, 'subprocess-cache-loader.mjs');
    fs.writeFileSync(subprocessScript, `
      import { performance } from 'perf_hooks';
      import { buildSearchIndex, searchBrain } from '${engineUrl}';

      const t0 = performance.now();
      const index = buildSearchIndex(false); // Should load from disk cache
      const loadMs = performance.now() - t0;

      const searchRes = searchBrain('Rule 15 canonical trailing-slash');
      const topMatch = searchRes.results.length > 0 ? searchRes.results[0].id : 'NONE';

      console.log(JSON.stringify({
        totalDocuments: index.totalDocuments,
        loadMs: Math.round(loadMs),
        topMatch
      }));
    `);

    const rawOutput = execSync(`node "${subprocessScript}"`, { encoding: 'utf-8' }).trim();
    const subResult = JSON.parse(rawOutput);

    assert(subResult.totalDocuments === index.totalDocuments, 'Fresh process reloaded all documents from cache', `Docs: ${subResult.totalDocuments}`);
    assert(subResult.loadMs < 1000, 'Fresh process cache load is fast (< 1000ms, no full rebuild)', `${subResult.loadMs}ms`);
    assert(subResult.topMatch === 'Rule 15', 'Search accuracy preserved after fresh process cache reload', `Match: ${subResult.topMatch}`);

    // ---------------------------------------------------------------------------
    // TEST 4: Atomic Disk Persistence Guarantee (Zero Partial Files)
    // ---------------------------------------------------------------------------
    console.log('\n[TEST 4] Testing Atomic Temporary-File & Clean Replace Invariant...');
    const cacheDir = path.dirname(persistenceResult.filePath);
    const tmpFiles = fs.readdirSync(cacheDir).filter(f => f.startsWith('retrieval-index.tmp.'));
    assert(tmpFiles.length === 0, 'All temporary staging files cleaned up after atomic rename', `Orphan tmp count: ${tmpFiles.length}`);

    // ---------------------------------------------------------------------------
    // TEST 5: Corrupted Cache Quarantine & Self-Healing Rebuild
    // ---------------------------------------------------------------------------
    console.log('\n[TEST 5] Testing Corrupted/Truncated Cache Detection & Quarantine...');
    const testSandboxRoot = path.join(sandboxDir, 'isolated-brain');
    const sandboxPaths = getRetrievalPaths(testSandboxRoot);
    fs.mkdirSync(sandboxPaths.cacheDir, { recursive: true });

    // Inject intentionally corrupt/truncated JSON on disk
    fs.writeFileSync(sandboxPaths.cacheIndexFile, '{"sourceHash":"bad-hash","truncated":true', 'utf-8');

    // Run buildSearchIndex: should detect corruption, quarantine it, and rebuild
    const healedIndex = buildSearchIndex(false, testSandboxRoot, { sync: true });
    assert(healedIndex !== null, 'Rebuild succeeded despite corrupted cache on disk');

    const quarantinedFiles = fs.readdirSync(sandboxPaths.cacheDir).filter(f => f.includes('.corrupt.'));
    assert(quarantinedFiles.length >= 1, 'Corrupted cache safely quarantined without crashing', `Quarantined: ${quarantinedFiles[0]}`);

    const healedStatus = getCachePersistenceStatus(testSandboxRoot);
    assert(healedStatus.status === 'persisted', 'Fresh healthy cache persisted after corruption quarantine');

    // ---------------------------------------------------------------------------
    // TEST 6: Observable Persistence Error Handling
    // ---------------------------------------------------------------------------
    console.log('\n[TEST 6] Testing Observable Persistence Failure Behavior...');
    // Simulate failure by pointing cacheDir to an illegal path (e.g. invalid filename chars on Windows)
    const invalidSandboxRoot = path.join(sandboxDir, 'invalid:dir*path?');
    const invalidIndex = buildSearchIndex(true, invalidSandboxRoot);
    assert(invalidIndex !== null, 'In-memory index still returns even if disk persistence path is invalid');

    try {
      await waitForCachePersistence(invalidSandboxRoot, 3000);
      assert(false, 'Expected persistence to fail on illegal directory path');
    } catch (err) {
      assert(err !== null, 'Persistence error caught and observable via waitForCachePersistence', err.code || err.message);
    }

    const failureStatus = getCachePersistenceStatus(invalidSandboxRoot);
    assert(failureStatus.status === 'failed', 'getCachePersistenceStatus reports failed status');
    assert(failureStatus.error !== null, 'Failure error message preserved in status');

    // ---------------------------------------------------------------------------
    // TEST 7: Concurrent Rebuild Deduplication
    // ---------------------------------------------------------------------------
    console.log('\n[TEST 7] Testing Concurrent Rebuild Persistence De-duplication...');
    const rebuildA = buildSearchIndex(true);
    const rebuildB = buildSearchIndex(true);

    const promiseA = rebuildA.persistencePromise;
    const promiseB = rebuildB.persistencePromise;

    const [resA, resB] = await Promise.all([promiseA, promiseB]);
    assert(resA.success && resB.success, 'Both concurrent persistence promises resolved successfully');
    assert(resA.filePath === resB.filePath, 'Both writes targeted identical canonical cache');

    // ---------------------------------------------------------------------------
    // TEST 8: Full BM25 & Exact Intent Invariance
    // ---------------------------------------------------------------------------
    console.log('\n[TEST 8] Testing BM25 Search & Token Budget Invariance...');
    const rule15 = searchBrain('Rule 15');
    assert(rule15.results[0].id === 'Rule 15', 'Exact Rule 15 search returns correct rule');

    const tailwind = searchBrain('Tailwind CSS v4 theme');
    assert(tailwind.results.length > 0 && tailwind.results[0].title.toLowerCase().includes('tailwind'),
      'Semantic keyword query returns Tailwind pattern');

    // ---------------------------------------------------------------------------
    // CLEANUP
    // ---------------------------------------------------------------------------
    try {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    } catch (e) {}

    // ---------------------------------------------------------------------------
    // SUMMARY
    // ---------------------------------------------------------------------------
    console.log('\n======================================================================');
    console.log(`🏁 DIB-003 VERIFICATION SUMMARY: ${passedTests} PASSED | ${failedTests} FAILED`);
    console.log('======================================================================\n');

    if (failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Unhandled test suite error:', err);
    process.exit(1);
  }
}

runSuite();
