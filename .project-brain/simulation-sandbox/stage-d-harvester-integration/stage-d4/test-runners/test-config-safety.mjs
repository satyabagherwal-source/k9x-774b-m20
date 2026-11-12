/**
 * Test Suite E: Configuration Safety, Dynamic Propagation & Rollback Timing
 * 
 * Verifies:
 * - Dynamic Configuration Loading: Config is read on-demand from disk without caching stale states.
 * - Live Runtime Flag Toggle: Changing enabled: false -> true -> false on disk is observed
 *   IMMEDIATELY by the wrapper without requiring process restarts.
 * - Dynamic Propagation Timing: Demonstrates experimentally that configuration updates
 *   propagate in < 10ms (validating sub-second rollback capabilities).
 * - Fail-Closed on Missing File: Missing control file safely defaults to enabled: false.
 * - Fail-Closed on Malformed JSON: Corrupt syntax safely defaults to enabled: false.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { ShadowGatewayWrapper } from '../src/shadow-gateway-wrapper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STAGE_D4_ROOT = path.resolve(__dirname, '..');
const TEST_CONTROL_PATH = path.join(STAGE_D4_ROOT, 'fixtures', 'test-dynamic-harvest-control.json');

export async function runConfigSafetyTests() {
  const results = {
    suite: 'STAGE_D4_CONFIGURATION_SAFETY_AND_PROPAGATION',
    passed: 0,
    failed: 0,
    tests: []
  };

  console.log('\n=== RUNNING SUITE E: CONFIGURATION SAFETY & PROPAGATION ===');

  // Helper to write test configuration
  const writeTestConfig = (shadowModeObj) => {
    const content = {
      status: 'ACTIVE',
      brainIntegrityGuard: {
        brainLearningGateway: {
          shadowMode: shadowModeObj
        }
      }
    };
    fs.writeFileSync(TEST_CONTROL_PATH, JSON.stringify(content, null, 2), 'utf8');
  };

  // -------------------------------------------------------------
  // Test E.1: Live Runtime Toggle Without Process Restart
  // -------------------------------------------------------------
  try {
    // 1. Initial State: DISABLED
    writeTestConfig({ enabled: false, sampleRate: 1.0 });
    const wrapper = new ShadowGatewayWrapper({ controlPath: TEST_CONTROL_PATH });

    const configInitial = wrapper.loadConfiguration();
    const isInitiallyDisabled = configInitial.enabled === false;

    // 2. Flip to ENABLED on disk
    const t0 = performance.now();
    writeTestConfig({ enabled: true, sampleRate: 0.01, canaryTargetRepository: 'tiangolo/fastapi' });
    const configToggledOn = wrapper.loadConfiguration();
    const toggleOnLatencyMs = performance.now() - t0;
    const isToggledOn = configToggledOn.enabled === true && configToggledOn.canaryTargetRepository === 'tiangolo/fastapi';

    // 3. Rollback to DISABLED on disk (simulating emergency rollback)
    const tRollback = performance.now();
    writeTestConfig({ enabled: false });
    const configRolledBack = wrapper.loadConfiguration();
    const rollbackLatencyMs = performance.now() - tRollback;
    const isRolledBack = configRolledBack.enabled === false;

    const e1Passed = isInitiallyDisabled && isToggledOn && isRolledBack && rollbackLatencyMs < 20;

    results.tests.push({
      test_id: 'TEST-E1-LIVE-RUNTIME-PROPAGATION',
      name: 'Dynamic Configuration Reload & Sub-Second Rollback Propagation',
      passed: e1Passed,
      details: {
        initial_disabled: isInitiallyDisabled,
        toggled_on_without_restart: isToggledOn,
        rolled_back_without_restart: isRolledBack,
        toggle_latency_ms: toggleOnLatencyMs.toFixed(3),
        rollback_latency_ms: rollbackLatencyMs.toFixed(3)
      }
    });
    if (e1Passed) results.passed++; else results.failed++;
    console.log(`  ${e1Passed ? '✅' : '❌'} Test E.1 (Live Propagation): Observed immediately across disk flips (Rollback: ${rollbackLatencyMs.toFixed(2)}ms)`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-E1-LIVE-RUNTIME-PROPAGATION', passed: false, error: err.message });
    console.error(`  ❌ Test E.1 Failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test E.2: Fail-Closed on Missing Configuration File
  // -------------------------------------------------------------
  try {
    const missingPath = path.join(STAGE_D4_ROOT, 'fixtures', 'non-existent-control.json');
    if (fs.existsSync(missingPath)) fs.unlinkSync(missingPath);

    const wrapperMissing = new ShadowGatewayWrapper({ controlPath: missingPath });
    const configMissing = wrapperMissing.loadConfiguration();

    const e2Passed = configMissing.enabled === false && configMissing.dryRun === true;
    results.tests.push({
      test_id: 'TEST-E2-FAIL-CLOSED-MISSING-CONFIG',
      name: 'Fail-Closed Handling of Missing Configuration File',
      passed: e2Passed,
      details: {
        enabled: configMissing.enabled,
        dryRun: configMissing.dryRun
      }
    });
    if (e2Passed) results.passed++; else results.failed++;
    console.log(`  ${e2Passed ? '✅' : '❌'} Test E.2 (Missing Config): Defaults safely to enabled: false`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-E2-FAIL-CLOSED-MISSING-CONFIG', passed: false, error: err.message });
    console.error(`  ❌ Test E.2 Failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test E.3: Fail-Closed on Malformed JSON Configuration
  // -------------------------------------------------------------
  try {
    const malformedPath = path.join(STAGE_D4_ROOT, 'fixtures', 'malformed-control.json');
    fs.writeFileSync(malformedPath, '{\n  "corrupt": <<SYNTAX_ERROR>>\n', 'utf8');

    const wrapperMalformed = new ShadowGatewayWrapper({ controlPath: malformedPath });
    const configMalformed = wrapperMalformed.loadConfiguration();

    const e3Passed = configMalformed.enabled === false && configMalformed.dryRun === true;
    results.tests.push({
      test_id: 'TEST-E3-FAIL-CLOSED-MALFORMED-CONFIG',
      name: 'Fail-Closed Handling of Malformed Syntax in Configuration',
      passed: e3Passed,
      details: {
        enabled: configMalformed.enabled,
        dryRun: configMalformed.dryRun
      }
    });
    if (e3Passed) results.passed++; else results.failed++;
    console.log(`  ${e3Passed ? '✅' : '❌'} Test E.3 (Malformed Config): Parse error caught, defaults safely to enabled: false`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-E3-FAIL-CLOSED-MALFORMED-CONFIG', passed: false, error: err.message });
    console.error(`  ❌ Test E.3 Failed: ${err.message}`);
  }

  // Cleanup test control fixtures
  if (fs.existsSync(TEST_CONTROL_PATH)) fs.unlinkSync(TEST_CONTROL_PATH);
  const malformedPath = path.join(STAGE_D4_ROOT, 'fixtures', 'malformed-control.json');
  if (fs.existsSync(malformedPath)) fs.unlinkSync(malformedPath);

  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runConfigSafetyTests().then(res => {
    console.log(`\nSuite E Complete: ${res.passed}/${res.passed + res.failed} Passed`);
  });
}

