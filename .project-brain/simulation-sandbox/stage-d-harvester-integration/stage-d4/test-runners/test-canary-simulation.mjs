/**
 * Test Suite 5: Proposed Canary Settings Simulation (Sandbox Only)
 * 
 * Evaluates the proposed Canary Phase 1 parameter matrix:
 * - Sampling: 1% (sampleRate: 0.01)
 * - Repository Pinning: 'tiangolo/fastapi'
 * - Timeout: 3000ms
 * - Max Batch Size: 5 items
 * - Circuit Breaker: 3 consecutive failures
 * - Dry-Run: true
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { ShadowGatewayWrapper } from '../src/shadow-gateway-wrapper.mjs';
import { createLearningPackage } from '../../../../../04_WORKFLOWS/factory-engine/brain-learning-gateway.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runCanarySimulationTests() {
  const results = {
    suite: 'STAGE_D4_PROPOSED_CANARY_SIMULATION',
    passed: 0,
    failed: 0,
    tests: []
  };

  console.log('\n=== RUNNING SECTION 5: PROPOSED CANARY SETTINGS SIMULATION ===');

  const canaryConfig = {
    enabled: true,
    sampleRate: 0.01,
    canaryTargetRepository: 'tiangolo/fastapi',
    maxBatchSize: 5,
    timeoutMs: 3000,
    dryRun: true
  };

  // -------------------------------------------------------------
  // Test S.1: Target Repository Pinning Isolation
  // -------------------------------------------------------------
  try {
    let shadowRan = false;
    const wrapper = new ShadowGatewayWrapper({
      legacyGatewayFn: async () => ({ success: true }),
      config: canaryConfig
    });
    wrapper.shadowExecutor.execute = async () => { shadowRan = true; };

    // 1. Submit non-canary repository (tokio-rs/tokio)
    const otherPkg = createLearningPackage({
      repository: 'tokio-rs/tokio',
      platform: 'github',
      sourceUrl: 'https://github.com/tokio-rs/tokio',
      dossierText: '# Tokio test'
    });
    await wrapper.submit(otherPkg);
    const nonTargetBypassed = shadowRan === false;

    // 2. Submit canary target repository (tiangolo/fastapi) with 100% sample override for deterministic test
    const canaryPkg = createLearningPackage({
      repository: 'tiangolo/fastapi',
      platform: 'github',
      sourceUrl: 'https://github.com/tiangolo/fastapi',
      dossierText: '# FastAPI test'
    });
    await wrapper.submit(canaryPkg, { shadowMode: { sampleRate: 1.0 } });
    const targetAdmitted = shadowRan === true;

    const s1Passed = nonTargetBypassed && targetAdmitted;
    results.tests.push({
      test_id: 'TEST-S1-REPOSITORY-PINNING-FILTER',
      name: 'Single Repository Pinning Filter (tiangolo/fastapi Only)',
      passed: s1Passed,
      details: {
        non_target_bypassed: nonTargetBypassed,
        target_admitted: targetAdmitted,
        pinned_repo: canaryConfig.canaryTargetRepository
      }
    });
    if (s1Passed) results.passed++; else results.failed++;
    console.log(`  ${s1Passed ? '✅' : '❌'} Test S.1 (Repository Pinning): Non-target bypassed; tiangolo/fastapi admitted`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-S1-REPOSITORY-PINNING-FILTER', passed: false, error: err.message });
    console.error(`  ❌ Test S.1 Failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test S.2: Maximum Batch Size Cap (<= 5 items)
  // -------------------------------------------------------------
  try {
    let shadowRan = false;
    const wrapper = new ShadowGatewayWrapper({
      legacyGatewayFn: async () => ({ success: true }),
      config: { ...canaryConfig, sampleRate: 1.0 }
    });
    wrapper.shadowExecutor.execute = async () => { shadowRan = true; };

    // Batch with 7 items (> 5 cap)
    const largePkg = createLearningPackage({
      repository: 'tiangolo/fastapi',
      platform: 'github',
      sourceUrl: 'https://github.com/tiangolo/fastapi',
      dossierText: '# FastAPI large batch test',
      candidateRules: Array.from({ length: 7 }).map((_, i) => ({ title: `Rule ${i}`, body: 'body' }))
    });

    await wrapper.submit(largePkg);
    const largeBatchBypassed = shadowRan === false;

    // Batch with 3 items (<= 5 cap)
    const smallPkg = createLearningPackage({
      repository: 'tiangolo/fastapi',
      platform: 'github',
      sourceUrl: 'https://github.com/tiangolo/fastapi',
      dossierText: '# FastAPI small batch test',
      candidateRules: Array.from({ length: 3 }).map((_, i) => ({ title: `Rule ${i}`, body: 'body' }))
    });

    await wrapper.submit(smallPkg);
    const smallBatchAdmitted = shadowRan === true;

    const s2Passed = largeBatchBypassed && smallBatchAdmitted;
    results.tests.push({
      test_id: 'TEST-S2-MAX-BATCH-SIZE-CAP',
      name: 'Maximum Candidate Batch Size Enforcement (<= 5 items)',
      passed: s2Passed,
      details: {
        large_batch_capped: largeBatchBypassed,
        small_batch_allowed: smallBatchAdmitted,
        max_batch_size: canaryConfig.maxBatchSize
      }
    });
    if (s2Passed) results.passed++; else results.failed++;
    console.log(`  ${s2Passed ? '✅' : '❌'} Test S.2 (Batch Cap): 7-item batch bypassed; 3-item batch admitted`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-S2-MAX-BATCH-SIZE-CAP', passed: false, error: err.message });
    console.error(`  ❌ Test S.2 Failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test S.3: 1% Sampling Statistical Distribution Simulation
  // -------------------------------------------------------------
  try {
    let shadowCount = 0;
    const trials = 1000;
    const wrapper = new ShadowGatewayWrapper({
      legacyGatewayFn: async () => ({ success: true }),
      config: canaryConfig // sampleRate: 0.01
    });
    wrapper.shadowExecutor.execute = async () => { shadowCount++; };

    const canaryPkg = createLearningPackage({
      repository: 'tiangolo/fastapi',
      platform: 'github',
      sourceUrl: 'https://github.com/tiangolo/fastapi',
      dossierText: '# Statistical sampling test'
    });

    for (let i = 0; i < trials; i++) {
      await wrapper.submit(canaryPkg);
    }

    // Over 1000 trials with p=0.01, expected count is ~10 (binomial 99.9% within 2 to 25)
    const sampleRateObserved = shadowCount / trials;
    const withinStatisticalBounds = shadowCount >= 2 && shadowCount <= 25;

    const s3Passed = withinStatisticalBounds;
    results.tests.push({
      test_id: 'TEST-S3-ONE-PERCENT-SAMPLING-DISTRIBUTION',
      name: '1% Canary Sampling Statistical Distribution (1000 Trials)',
      passed: s3Passed,
      details: {
        trials,
        shadow_executions: shadowCount,
        observed_sample_rate: sampleRateObserved.toFixed(4),
        expected_rate: 0.01,
        within_bounds: withinStatisticalBounds
      }
    });
    if (s3Passed) results.passed++; else results.failed++;
    console.log(`  ${s3Passed ? '✅' : '❌'} Test S.3 (1% Sampling): ${shadowCount}/${trials} runs executed (${(sampleRateObserved * 100).toFixed(1)}%)`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-S3-ONE-PERCENT-SAMPLING-DISTRIBUTION', passed: false, error: err.message });
    console.error(`  ❌ Test S.3 Failed: ${err.message}`);
  }

  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCanarySimulationTests().then(res => {
    console.log(`\nSection 5 Complete: ${res.passed}/${res.passed + res.failed} Passed`);
  });
}

