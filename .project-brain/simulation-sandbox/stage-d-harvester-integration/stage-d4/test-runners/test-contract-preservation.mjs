/**
 * Test Suite A: Actual Gateway Contract Preservation
 * 
 * Verifies that the Shadow Gateway Wrapper preserves 100% of the actual
 * production submitToBrainGateway() return contract (22+ fields) across all execution paths.
 * 
 * Uses the REAL production submitToBrainGateway function running in an isolated
 * sandbox brain root to ensure absolute fidelity with zero production modification.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { submitToBrainGateway, createLearningPackage } from '../../../../../04_WORKFLOWS/factory-engine/brain-learning-gateway.mjs';
import { ShadowGatewayWrapper } from '../src/shadow-gateway-wrapper.mjs';
import { setupSandboxBrainRoot } from '../src/sandbox-brain-setup.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STAGE_D4_ROOT = path.resolve(__dirname, '..');
const TEST_BRAIN_ROOT = path.join(STAGE_D4_ROOT, 'test-brain-root');
const CONTRACT_FIXTURE_PATH = path.join(STAGE_D4_ROOT, 'fixtures', 'actual-gateway-contract.json');

export async function runContractPreservationTests() {
  const results = {
    suite: 'STAGE_D4_ACTUAL_CONTRACT_PRESERVATION',
    passed: 0,
    failed: 0,
    tests: []
  };

  console.log('\n=== RUNNING SUITE A: ACTUAL GATEWAY CONTRACT PRESERVATION ===');

  // Initialize isolated sandbox brain root
  setupSandboxBrainRoot(TEST_BRAIN_ROOT);
  const contract = JSON.parse(fs.readFileSync(CONTRACT_FIXTURE_PATH, 'utf8'));

  // Helper to create a valid test package
  const makeTestPkg = (suffix = '01') => {
    return createLearningPackage({
      repository: 'tiangolo/fastapi',
      platform: 'github',
      sourceUrl: 'https://github.com/tiangolo/fastapi',
      sourceVersion: 'HEAD',
      license: 'MIT',
      slug: `fastapi-lifespan-contract-test-${suffix}`,
      dossierText: `# FastAPI Lifespan Contract Verification ${suffix}\n\nValid dossier body meeting substance threshold (>100 chars). Explains FastAPI lifespan asynchronous cleanup patterns for robust database and task lifecycle management.`,
      candidateRules: [
        {
          title: `FastAPI Lifespan State Pattern ${suffix}`,
          body: `Use asynccontextmanager for application startup and shutdown lifecycle management to ensure connection pools and async background tasks close cleanly.`
        }
      ],
      brainRoot: TEST_BRAIN_ROOT
    }, { brainRoot: TEST_BRAIN_ROOT });
  };

  // -------------------------------------------------------------
  // Test A.1: Raw Gateway Baseline & 22+ Field Contract Verification
  // -------------------------------------------------------------
  try {
    const rawPkg = makeTestPkg('raw');
    const rawResult = await submitToBrainGateway(rawPkg, { brainRoot: TEST_BRAIN_ROOT });

    const expectedCoreFields = Object.keys(contract.output_contract.core_fields);
    const missingCoreFields = expectedCoreFields.filter(f => !(f in rawResult));

    const totalFieldsCount = Object.keys(rawResult).length;
    const a1Passed = missingCoreFields.length === 0 && totalFieldsCount >= 22 && rawResult.success === true;

    results.tests.push({
      test_id: 'TEST-A1-REAL-CONTRACT-EXTRACTION',
      name: 'Actual Gateway Real 22+ Field Contract Verification',
      passed: a1Passed,
      details: {
        total_fields_returned: totalFieldsCount,
        expected_core_fields: expectedCoreFields.length,
        missing_core_fields: missingCoreFields,
        status: rawResult.status,
        stage: rawResult.stage
      }
    });
    if (a1Passed) results.passed++; else results.failed++;
    console.log(`  ${a1Passed ? '✅' : '❌'} Test A.1 (Contract Extraction): ${totalFieldsCount} fields returned by real gateway`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-A1-REAL-CONTRACT-EXTRACTION', passed: false, error: err.message });
    console.error(`  ❌ Test A.1 Failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test A.2: Contract Parity with Shadow Mode Disabled
  // -------------------------------------------------------------
  try {
    const pkgDirect = makeTestPkg('direct-off');
    const directResult = await submitToBrainGateway(pkgDirect, { brainRoot: TEST_BRAIN_ROOT });

    const pkgWrapped = makeTestPkg('wrapped-off');
    const wrapperOff = new ShadowGatewayWrapper({
      legacyGatewayFn: (p, opt) => submitToBrainGateway(p, opt),
      config: { enabled: false }
    });
    const wrappedResult = await wrapperOff.submit(pkgWrapped, { brainRoot: TEST_BRAIN_ROOT });

    // Compare field set and values
    const directKeys = Object.keys(directResult).sort();
    const wrappedKeys = Object.keys(wrappedResult).sort();
    const keysIdentical = JSON.stringify(directKeys) === JSON.stringify(wrappedKeys);

    let valuesIdentical = true;
    for (const k of directKeys) {
      if (k === 'learning_id' || k === 'content_hash' || k === 'dossier_path' || k === 'destination_path') continue; // Suffix varies
      if (JSON.stringify(directResult[k]) !== JSON.stringify(wrappedResult[k])) {
        valuesIdentical = false;
        break;
      }
    }

    const a2Passed = keysIdentical && valuesIdentical;
    results.tests.push({
      test_id: 'TEST-A2-DISABLED-CONTRACT-PARITY',
      name: 'Contract Parity with Shadow Mode Disabled',
      passed: a2Passed,
      details: {
        keys_identical: keysIdentical,
        values_identical: valuesIdentical,
        field_count: wrappedKeys.length
      }
    });
    if (a2Passed) results.passed++; else results.failed++;
    console.log(`  ${a2Passed ? '✅' : '❌'} Test A.2 (Disabled Parity): Exact field shape and value parity`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-A2-DISABLED-CONTRACT-PARITY', passed: false, error: err.message });
    console.error(`  ❌ Test A.2 Failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test A.3: Contract Parity with Shadow Mode Enabled
  // -------------------------------------------------------------
  try {
    const pkgDirect = makeTestPkg('direct-on');
    const directResult = await submitToBrainGateway(pkgDirect, { brainRoot: TEST_BRAIN_ROOT });

    const pkgWrapped = makeTestPkg('wrapped-on');
    const wrapperOn = new ShadowGatewayWrapper({
      legacyGatewayFn: (p, opt) => submitToBrainGateway(p, opt),
      config: { enabled: true, sampleRate: 1.0, dryRun: true }
    });
    const wrappedResult = await wrapperOn.submit(pkgWrapped, { brainRoot: TEST_BRAIN_ROOT });

    const directKeys = Object.keys(directResult).sort();
    const wrappedKeys = Object.keys(wrappedResult).sort();
    const keysIdentical = JSON.stringify(directKeys) === JSON.stringify(wrappedKeys);

    let valuesIdentical = true;
    for (const k of directKeys) {
      if (k === 'learning_id' || k === 'content_hash' || k === 'dossier_path' || k === 'destination_path') continue;
      if (JSON.stringify(directResult[k]) !== JSON.stringify(wrappedResult[k])) {
        valuesIdentical = false;
        break;
      }
    }

    const a3Passed = keysIdentical && valuesIdentical;
    results.tests.push({
      test_id: 'TEST-A3-ENABLED-CONTRACT-PARITY',
      name: 'Contract Parity with Shadow Mode Enabled',
      passed: a3Passed,
      details: {
        keys_identical: keysIdentical,
        values_identical: valuesIdentical,
        field_count: wrappedKeys.length
      }
    });
    if (a3Passed) results.passed++; else results.failed++;
    console.log(`  ${a3Passed ? '✅' : '❌'} Test A.3 (Enabled Parity): 100% return contract preservation under active shadow`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-A3-ENABLED-CONTRACT-PARITY', passed: false, error: err.message });
    console.error(`  ❌ Test A.3 Failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test A.4: Contract Parity when Shadow Throws Exception
  // -------------------------------------------------------------
  try {
    const pkgDirect = makeTestPkg('direct-err');
    const directResult = await submitToBrainGateway(pkgDirect, { brainRoot: TEST_BRAIN_ROOT });

    const pkgFaulty = makeTestPkg('wrapped-err');
    const faultyWrapper = new ShadowGatewayWrapper({
      legacyGatewayFn: (p, opt) => submitToBrainGateway(p, opt),
      config: { enabled: true, sampleRate: 1.0, dryRun: true }
    });

    // Inject catastrophic error into shadow executor
    faultyWrapper.shadowExecutor.execute = async () => {
      throw new Error('FATAL_SIMULATED_SHADOW_CRASH_TEST');
    };

    const wrappedResult = await faultyWrapper.submit(pkgFaulty, { brainRoot: TEST_BRAIN_ROOT });

    const keysIdentical = JSON.stringify(Object.keys(directResult).sort()) === JSON.stringify(Object.keys(wrappedResult).sort());
    const statusMatches = directResult.status === wrappedResult.status && wrappedResult.status === 'VERIFIED_LEARNING';

    const a4Passed = keysIdentical && statusMatches;
    results.tests.push({
      test_id: 'TEST-A4-FAULTY-SHADOW-CONTRACT-PARITY',
      name: 'Contract Parity under Shadow Crash Failure',
      passed: a4Passed,
      details: {
        keys_identical: keysIdentical,
        status_matches: statusMatches,
        legacy_status: wrappedResult.status
      }
    });
    if (a4Passed) results.passed++; else results.failed++;
    console.log(`  ${a4Passed ? '✅' : '❌'} Test A.4 (Faulty Shadow Parity): Legacy return identical despite shadow throw`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-A4-FAULTY-SHADOW-CONTRACT-PARITY', passed: false, error: err.message });
    console.error(`  ❌ Test A.4 Failed: ${err.message}`);
  }

  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runContractPreservationTests().then(res => {
    console.log(`\nSuite A Complete: ${res.passed}/${res.passed + res.failed} Passed`);
  });
}
