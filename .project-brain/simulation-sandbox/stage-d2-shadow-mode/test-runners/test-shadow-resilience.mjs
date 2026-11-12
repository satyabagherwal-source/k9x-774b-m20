/**
 * Test Suite 3: Shadow Resilience, Security & Resource Limits (Tests 5, 9, 10, 12)
 * 
 * Verifies:
 * - Test 5: Shadow Exception Isolation (Legacy unaffected by shadow crashes)
 * - Test 9: Resource Limits & Circuit Breaker (Timeout, batch size, breaker trip)
 * - Test 10: Secret Sanitizer (Zero credential leakage into shadow traces)
 * - Test 12: Retry Idempotency (Deterministic outcome across repeated runs)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { ShadowGatewayWrapper } from '../src/shadow-gateway-wrapper.mjs';
import { ShadowCircuitBreaker } from '../src/shadow-circuit-breaker.mjs';
import { ShadowPipelineExecutor } from '../src/shadow-pipeline-executor.mjs';
import { sanitizeData } from '../src/secret-sanitizer.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SANDBOX_DIR = path.resolve(__dirname, '..');
const FIXTURES_DIR = path.join(SANDBOX_DIR, 'fixtures');
const TRACES_DIR = path.join(SANDBOX_DIR, 'shadow-traces');

export async function runResilienceTests() {
  const results = {
    suite: 'SHADOW_MODE_RESILIENCE_SECURITY_LIMITS',
    passed: 0,
    failed: 0,
    tests: []
  };

  console.log('\n=== RUNNING SUITE 3: SHADOW RESILIENCE & LIMITS ===');

  // Simulated Legacy Gateway Function
  const simulatedLegacy = async (pkg, options = {}) => {
    return {
      success: true,
      repository: pkg.repository || 'unknown',
      learning_id: pkg.learning_id || 'test',
      status: 'VERIFIED_LEARNING',
      errors: []
    };
  };

  // -------------------------------------------------------------
  // TEST 5: Shadow Exception Isolation
  // -------------------------------------------------------------
  try {
    const cloudFixture = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'cloud-standard-payload.json'), 'utf8'));

    // Build wrapper where shadow pipeline throws a fatal intentional exception
    const faultyWrapper = new ShadowGatewayWrapper({
      legacyGatewayFn: simulatedLegacy,
      config: { enabled: true, traceDir: TRACES_DIR },
      traceDir: TRACES_DIR
    });

    // Sabotage shadow executor to simulate runtime error
    faultyWrapper.shadowExecutor.execute = async () => {
      throw new Error('FATAL_SIMULATED_SHADOW_RUNTIME_PANIC');
    };

    // Execute wrapped gateway
    const res = await faultyWrapper.submit(cloudFixture, {
      shadowMode: { enabled: true }
    });

    // Legacy must still succeed 100% without throwing or failing
    const t5Passed = res && res.success === true && res.status === 'VERIFIED_LEARNING';

    results.tests.push({
      test_id: 'TEST-5-EXCEPTION-ISOLATION',
      name: 'Shadow Exception Isolation',
      passed: t5Passed,
      details: {
        legacy_succeeded: res?.success,
        legacy_status: res?.status,
        exception_suppressed: true
      }
    });
    if (t5Passed) results.passed++; else results.failed++;
    console.log(`  ${t5Passed ? '✅' : '❌'} Test 5 (Exception Isolation): Legacy succeeded despite shadow throw`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-5-EXCEPTION-ISOLATION', passed: false, error: err.message });
    console.error(`  ❌ Test 5 Failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // TEST 9: Resource Limits & Circuit Breaker
  // -------------------------------------------------------------
  try {
    const cb = new ShadowCircuitBreaker({
      maxConsecutiveFailures: 3,
      cooldownMs: 10000,
      timeoutMs: 100, // Short timeout for testing
      maxBatchSize: 5
    });

    // A. Batch limit check (> 5 items)
    const largeBatchFixture = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'large-stress-payload.json'), 'utf8'));
    const batchCheck = cb.validateBatchSize(largeBatchFixture.candidates);
    const batchLimited = batchCheck.allowed === false;

    // B. Timeout check
    const timeoutExecution = await cb.execute(async () => {
      await new Promise(r => setTimeout(r, 200)); // 200ms > 100ms timeout
      return 'done';
    });
    const timedOut = timeoutExecution.success === false && timeoutExecution.error === 'TIMEOUT';

    // C. Circuit breaker trip (trigger 2 more failures to reach threshold 3)
    await cb.execute(async () => { throw new Error('fail-1'); });
    await cb.execute(async () => { throw new Error('fail-2'); });
    const isTripped = cb.isOpen();

    const t9Passed = batchLimited && timedOut && isTripped;

    results.tests.push({
      test_id: 'TEST-9-RESOURCE-LIMITS-CIRCUIT-BREAKER',
      name: 'Resource Limits & Circuit Breaker',
      passed: t9Passed,
      details: {
        batch_limit_enforced: batchLimited,
        timeout_enforced: timedOut,
        circuit_breaker_tripped: isTripped,
        circuit_state: cb.state,
        consecutive_failures: cb.consecutiveFailures
      }
    });
    if (t9Passed) results.passed++; else results.failed++;
    console.log(`  ${t9Passed ? '✅' : '❌'} Test 9 (Resource Limits): Batch capped, timeout caught, breaker tripped`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-9-RESOURCE-LIMITS-CIRCUIT-BREAKER', passed: false, error: err.message });
    console.error(`  ❌ Test 9 Failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // TEST 10: Secret Sanitizer & Redaction
  // -------------------------------------------------------------
  try {
    const credFixture = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'credential-bearing-payload.json'), 'utf8'));

    // Execute shadow executor with credential-bearing payload
    const executor = new ShadowPipelineExecutor({ traceDir: TRACES_DIR });
    const shadowResult = await executor.execute(credFixture, {
      origin: 'CLOUD_HARVESTER',
      writeTrace: true
    });

    // Locate the written trace file
    const traceFile = path.join(TRACES_DIR, `${shadowResult.trace_id}.json`);
    const traceContent = fs.readFileSync(traceFile, 'utf8');

    // Verify all secrets are redacted
    const rawTokens = [
      'ghp_1111222233334444555566667777888899990000',
      'gho_secret12345678901234567890123456789012345',
      'hf_abcdef1234567890abcdef1234567890abcdef',
      'AIzaSyD-79182371923871923871923871923812',
      'AKIAIOSFODNN7EXAMPLE'
    ];

    const leakedTokens = rawTokens.filter(t => traceContent.includes(t));
    const redactedPresent = traceContent.includes('[REDACTED_GITHUB_PAT]') &&
                            traceContent.includes('[REDACTED_HF_TOKEN]') &&
                            traceContent.includes('[REDACTED_GOOGLE_API_KEY]') &&
                            traceContent.includes('[REDACTED_AWS_ACCESS_KEY]') &&
                            traceContent.includes('[REDACTED_SENSITIVE_FIELD]');

    const t10Passed = leakedTokens.length === 0 && redactedPresent;

    results.tests.push({
      test_id: 'TEST-10-SECRET-SANITIZER',
      name: 'Secret Sanitization & Redaction',
      passed: t10Passed,
      details: {
        leaked_tokens_count: leakedTokens.length,
        redaction_masks_present: redactedPresent,
        trace_file: path.basename(traceFile)
      }
    });
    if (t10Passed) results.passed++; else results.failed++;
    console.log(`  ${t10Passed ? '✅' : '❌'} Test 10 (Secret Sanitizer): 0 leaked secrets, all redacted`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-10-SECRET-SANITIZER', passed: false, error: err.message });
    console.error(`  ❌ Test 10 Failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // TEST 12: Retry Idempotency
  // -------------------------------------------------------------
  try {
    const cloudFixture = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'cloud-standard-payload.json'), 'utf8'));
    const executor = new ShadowPipelineExecutor({ traceDir: TRACES_DIR });

    const run1 = await executor.execute(cloudFixture, { origin: 'CLOUD_HARVESTER', writeTrace: false });
    const run2 = await executor.execute(cloudFixture, { origin: 'CLOUD_HARVESTER', writeTrace: false });

    const statusMatch = run1.shadow_status === run2.shadow_status;
    const domainMatch = run1.classification.primary_domain === run2.classification.primary_domain;
    const folderMatch = run1.routing.destination_folder === run2.routing.destination_folder;
    const hashMatch = run1.content_hash === run2.content_hash;

    const t12Passed = statusMatch && domainMatch && folderMatch && hashMatch;

    results.tests.push({
      test_id: 'TEST-12-RETRY-IDEMPOTENCY',
      name: 'Retry Execution Idempotency',
      passed: t12Passed,
      details: {
        status_match: statusMatch,
        domain_match: domainMatch,
        folder_match: folderMatch,
        hash_match: hashMatch,
        run1_status: run1.shadow_status,
        run2_status: run2.shadow_status
      }
    });
    if (t12Passed) results.passed++; else results.failed++;
    console.log(`  ${t12Passed ? '✅' : '❌'} Test 12 (Retry Idempotency): Bitwise identical decisions across runs`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-12-RETRY-IDEMPOTENCY', passed: false, error: err.message });
    console.error(`  ❌ Test 12 Failed: ${err.message}`);
  }

  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runResilienceTests().then(res => {
    console.log(`\nSuite 3 Complete: ${res.passed}/${res.passed + res.failed} Passed`);
  });
}

