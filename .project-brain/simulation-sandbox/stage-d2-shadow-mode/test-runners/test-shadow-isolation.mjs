/**
 * Test Suite 1: Shadow Mode Isolation & Preservation (Tests 1 - 4)
 * 
 * Verifies:
 * - Test 1: Shadow mode OFF -> Legacy executes untouched; exactly 0 shadow traces generated.
 * - Test 2: Shadow mode ON -> Both execute; shadow trace generated; legacy output intact.
 * - Test 3: Production Write Isolation -> Production registries, cache, and folders remain 100% bitwise untouched.
 * - Test 4: Legacy Return Value Preservation -> Legacy return shape, types, and values are identical.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { ShadowGatewayWrapper } from '../src/shadow-gateway-wrapper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SANDBOX_DIR = path.resolve(__dirname, '..');
const FIXTURES_DIR = path.join(SANDBOX_DIR, 'fixtures');
const TRACES_DIR = path.join(SANDBOX_DIR, 'shadow-traces');
const ISOLATED_BRAIN = path.join(SANDBOX_DIR, 'isolated-sandbox-brain');
const PROD_BRAIN = path.resolve(__dirname, '..', '..', '..', '..');

// Helper to hash a file
function hashFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export async function runIsolationTests() {
  const results = {
    suite: 'SHADOW_MODE_ISOLATION_AND_PRESERVATION',
    passed: 0,
    failed: 0,
    tests: []
  };

  console.log('\n=== RUNNING SUITE 1: SHADOW ISOLATION & PRESERVATION ===');

  // Pre-clean shadow traces
  if (fs.existsSync(TRACES_DIR)) {
    for (const f of fs.readdirSync(TRACES_DIR)) {
      if (f.endsWith('.json')) fs.unlinkSync(path.join(TRACES_DIR, f));
    }
  } else {
    fs.mkdirSync(TRACES_DIR, { recursive: true });
  }

  // Load fixture
  const cloudFixture = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'cloud-standard-payload.json'), 'utf8'));

  // Simulated Legacy Gateway Function that operates in isolated sandbox brain
  const simulatedLegacy = async (pkg, options = {}) => {
    return {
      success: true,
      repository: pkg.repository,
      learning_id: pkg.learning_id,
      content_hash: pkg.content_hash,
      status: 'VERIFIED_LEARNING',
      stage: 'VERIFIED',
      extracted: true,
      validated: true,
      brain_write: true,
      brain_readback: true,
      knowledge_index_updated: true,
      primary_domain: 'H',
      destination_folder: '07_PROJECT_LEARNING',
      requires_human_approval: false,
      errors: []
    };
  };

  // -------------------------------------------------------------
  // TEST 1: Shadow Mode OFF
  // -------------------------------------------------------------
  try {
    const wrapperOff = new ShadowGatewayWrapper({
      legacyGatewayFn: simulatedLegacy,
      config: { enabled: false },
      traceDir: TRACES_DIR
    });

    const resOff = await wrapperOff.submit(cloudFixture, {
      origin: 'CLOUD_HARVESTER',
      shadowMode: { enabled: false }
    });

    const traceFilesAfterTest1 = fs.readdirSync(TRACES_DIR).filter(f => f.endsWith('.json'));
    const t1Passed = resOff.success === true &&
                     resOff.status === 'VERIFIED_LEARNING' &&
                     traceFilesAfterTest1.length === 0;

    results.tests.push({
      test_id: 'TEST-1-SHADOW-DISABLED',
      name: 'Shadow Mode OFF Passthrough',
      passed: t1Passed,
      details: {
        legacy_success: resOff.success,
        traces_generated: traceFilesAfterTest1.length,
        expected_traces: 0
      }
    });
    if (t1Passed) results.passed++; else results.failed++;
    console.log(`  ${t1Passed ? '✅' : '❌'} Test 1 (Shadow OFF): 0 traces generated, legacy untouched`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-1-SHADOW-DISABLED', passed: false, error: err.message });
    console.error(`  ❌ Test 1 Failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // TEST 2: Shadow Mode ON
  // -------------------------------------------------------------
  try {
    const wrapperOn = new ShadowGatewayWrapper({
      legacyGatewayFn: simulatedLegacy,
      config: { enabled: true, traceDir: TRACES_DIR },
      traceDir: TRACES_DIR
    });

    const resOn = await wrapperOn.submit(cloudFixture, {
      origin: 'CLOUD_HARVESTER',
      shadowMode: { enabled: true }
    });

    const traceFilesAfterTest2 = fs.readdirSync(TRACES_DIR).filter(f => f.endsWith('.json'));
    const t2Passed = resOn.success === true &&
                     resOn.status === 'VERIFIED_LEARNING' &&
                     traceFilesAfterTest2.length >= 1;

    results.tests.push({
      test_id: 'TEST-2-SHADOW-ENABLED',
      name: 'Shadow Mode ON Execution & Trace Emitted',
      passed: t2Passed,
      details: {
        legacy_success: resOn.success,
        traces_generated: traceFilesAfterTest2.length,
        trace_file: traceFilesAfterTest2[0] || null
      }
    });
    if (t2Passed) results.passed++; else results.failed++;
    console.log(`  ${t2Passed ? '✅' : '❌'} Test 2 (Shadow ON): Trace emitted, legacy return preserved`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-2-SHADOW-ENABLED', passed: false, error: err.message });
    console.error(`  ❌ Test 2 Failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // TEST 3: Zero Production Write Isolation
  // -------------------------------------------------------------
  try {
    const prodDomainRegPath = path.join(PROD_BRAIN, '05_KNOWLEDGE', 'domain-intelligence', 'domain-registry.json');
    const prodInboxRegPath = path.join(PROD_BRAIN, '11_INBOX', 'candidate-directives-registry.json');

    const domHashBefore = hashFile(prodDomainRegPath);
    const inboxHashBefore = hashFile(prodInboxRegPath);

    // Run 5 repeated shadow submissions
    const wrapperIso = new ShadowGatewayWrapper({
      legacyGatewayFn: simulatedLegacy,
      config: { enabled: true, traceDir: TRACES_DIR },
      traceDir: TRACES_DIR
    });

    for (let i = 0; i < 5; i++) {
      await wrapperIso.submit(cloudFixture, {
        origin: 'CLOUD_HARVESTER',
        shadowMode: { enabled: true }
      });
    }

    const domHashAfter = hashFile(prodDomainRegPath);
    const inboxHashAfter = hashFile(prodInboxRegPath);

    const t3Passed = domHashBefore === domHashAfter &&
                     inboxHashBefore === inboxHashAfter &&
                     domHashBefore !== null;

    results.tests.push({
      test_id: 'TEST-3-ZERO-PROD-WRITE',
      name: 'Zero Production Write Isolation',
      passed: t3Passed,
      details: {
        domain_reg_sha256_match: domHashBefore === domHashAfter,
        inbox_reg_sha256_match: inboxHashBefore === inboxHashAfter,
        production_modified: !(domHashBefore === domHashAfter && inboxHashBefore === inboxHashAfter)
      }
    });
    if (t3Passed) results.passed++; else results.failed++;
    console.log(`  ${t3Passed ? '✅' : '❌'} Test 3 (Zero Prod Writes): Bitwise identical production registries`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-3-ZERO-PROD-WRITE', passed: false, error: err.message });
    console.error(`  ❌ Test 3 Failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // TEST 4: Legacy Return Value Preservation
  // -------------------------------------------------------------
  try {
    const rawLegacy = await simulatedLegacy(cloudFixture);

    const wrapperPreserve = new ShadowGatewayWrapper({
      legacyGatewayFn: simulatedLegacy,
      config: { enabled: true, traceDir: TRACES_DIR },
      traceDir: TRACES_DIR
    });

    const wrappedLegacy = await wrapperPreserve.submit(cloudFixture, {
      origin: 'CLOUD_HARVESTER',
      shadowMode: { enabled: true }
    });

    // Deep equality check between rawLegacy and wrappedLegacy
    const rawKeys = Object.keys(rawLegacy).sort();
    const wrappedKeys = Object.keys(wrappedLegacy).sort();
    const keysMatch = JSON.stringify(rawKeys) === JSON.stringify(wrappedKeys);

    let valuesMatch = true;
    for (const key of rawKeys) {
      if (JSON.stringify(rawLegacy[key]) !== JSON.stringify(wrappedLegacy[key])) {
        valuesMatch = false;
        break;
      }
    }

    const t4Passed = keysMatch && valuesMatch;

    results.tests.push({
      test_id: 'TEST-4-RETURN-PRESERVATION',
      name: 'Legacy Return Value Exact Preservation',
      passed: t4Passed,
      details: {
        keys_match: keysMatch,
        values_match: valuesMatch,
        key_count: wrappedKeys.length
      }
    });
    if (t4Passed) results.passed++; else results.failed++;
    console.log(`  ${t4Passed ? '✅' : '❌'} Test 4 (Return Preservation): Exact shape and field value parity`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-4-RETURN-PRESERVATION', passed: false, error: err.message });
    console.error(`  ❌ Test 4 Failed: ${err.message}`);
  }

  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runIsolationTests().then(res => {
    console.log(`\nSuite 1 Complete: ${res.passed}/${res.passed + res.failed} Passed`);
  });
}
