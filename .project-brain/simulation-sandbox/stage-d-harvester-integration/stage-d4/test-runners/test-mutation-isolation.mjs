/**
 * Test Suite B: Mutation & Object Reference Isolation
 * 
 * Verifies:
 * - StructuredClone deep-copy compatibility on actual learning packages.
 * - Complete isolation of nested objects, candidate arrays, and metadata.
 * - In-place mutations performed by the real gateway (validated_rules, rejected_rules, stage, status)
 *   cannot collide with or leak into shadow processing.
 * - Mutations on shadow data cannot alter legacy inputs or outputs.
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

export async function runMutationIsolationTests() {
  const results = {
    suite: 'STAGE_D4_MUTATION_AND_REFERENCE_ISOLATION',
    passed: 0,
    failed: 0,
    tests: []
  };

  console.log('\n=== RUNNING SUITE B: MUTATION & OBJECT REFERENCE ISOLATION ===');
  setupSandboxBrainRoot(TEST_BRAIN_ROOT);

  const makeTestPkg = (slug) => {
    return createLearningPackage({
      repository: 'tiangolo/fastapi',
      platform: 'github',
      sourceUrl: 'https://github.com/tiangolo/fastapi',
      sourceVersion: 'HEAD',
      license: 'MIT',
      slug,
      dossierText: `# FastAPI Lifespan Mutation Test\n\nValid dossier text explaining context manager patterns in modern asynchronous Python frameworks for safe connection pooling.`,
      candidateRules: [
        {
          title: 'FastAPI Lifespan Context Manager Pattern',
          body: 'Always use asynccontextmanager for application startup and shutdown lifecycle management.'
        }
      ],
      metadata: { initial_field: 'original_value', custom_flag: true },
      brainRoot: TEST_BRAIN_ROOT
    }, { brainRoot: TEST_BRAIN_ROOT });
  };

  // -------------------------------------------------------------
  // Test B.1: StructuredClone Compatibility on Actual Packages
  // -------------------------------------------------------------
  try {
    const pkg = makeTestPkg('fastapi-clone-compat-01');
    const wrapper = new ShadowGatewayWrapper();
    const cloneResult = wrapper.safelyCloneInput(pkg);

    const b1Passed = cloneResult.success === true &&
                     cloneResult.cloned !== pkg && // Different reference
                     cloneResult.cloned.repository === pkg.repository &&
                     cloneResult.cloned.content_hash === pkg.content_hash;

    results.tests.push({
      test_id: 'TEST-B1-STRUCTURED-CLONE-COMPATIBILITY',
      name: 'StructuredClone Compatibility on Actual Gateway Packages',
      passed: b1Passed,
      details: {
        success: cloneResult.success,
        reference_distinct: cloneResult.cloned !== pkg,
        field_count: Object.keys(cloneResult.cloned || {}).length
      }
    });
    if (b1Passed) results.passed++; else results.failed++;
    console.log(`  ${b1Passed ? '✅' : '❌'} Test B.1 (Clone Compatibility): Clean deep-clone on 26-field package`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-B1-STRUCTURED-CLONE-COMPATIBILITY', passed: false, error: err.message });
    console.error(`  ❌ Test B.1 Failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test B.2: Nested Array & Metadata Mutation Isolation
  // -------------------------------------------------------------
  try {
    const pkg = makeTestPkg('fastapi-nested-mut-01');
    const wrapper = new ShadowGatewayWrapper();
    const { cloned } = wrapper.safelyCloneInput(pkg);

    // Mutate nested object & array on the clone
    cloned.candidate_rules[0].title = 'TAMPERED_SHADOW_TITLE';
    cloned.metadata.initial_field = 'TAMPERED_SHADOW_VALUE';
    cloned.candidate_rules.push({ title: 'EXTRA_RULE', body: 'EXTRA_BODY' });

    // Assert original remains completely unaffected
    const originalUntouched = pkg.candidate_rules[0].title === 'FastAPI Lifespan Context Manager Pattern' &&
                             pkg.metadata.initial_field === 'original_value' &&
                             pkg.candidate_rules.length === 1;

    const b2Passed = originalUntouched;
    results.tests.push({
      test_id: 'TEST-B2-NESTED-REFERENCE-ISOLATION',
      name: 'Deep Reference Isolation of Nested Arrays & Metadata',
      passed: b2Passed,
      details: {
        original_title_preserved: pkg.candidate_rules[0].title,
        original_meta_preserved: pkg.metadata.initial_field,
        original_array_length: pkg.candidate_rules.length,
        clone_array_length: cloned.candidate_rules.length
      }
    });
    if (b2Passed) results.passed++; else results.failed++;
    console.log(`  ${b2Passed ? '✅' : '❌'} Test B.2 (Nested Isolation): Zero reference bleed across nested arrays`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-B2-NESTED-REFERENCE-ISOLATION', passed: false, error: err.message });
    console.error(`  ❌ Test B.2 Failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test B.3: Real Gateway In-Place Mutation Isolation
  // -------------------------------------------------------------
  try {
    const pkg = makeTestPkg('fastapi-live-mutation-01');

    // Verify properties do not exist before execution
    const hadValidatedRulesBefore = 'validated_rules' in pkg;

    let shadowReceivedPackage = null;
    const wrapper = new ShadowGatewayWrapper({
      legacyGatewayFn: (p, opt) => submitToBrainGateway(p, opt),
      config: { enabled: true, sampleRate: 1.0, dryRun: true }
    });

    // Intercept shadow execution to capture the exact input shadow operated on
    const origExecute = wrapper.shadowExecutor.execute.bind(wrapper.shadowExecutor);
    wrapper.shadowExecutor.execute = async (shadowInput, opts) => {
      shadowReceivedPackage = shadowInput;
      return await origExecute(shadowInput, opts);
    };

    const res = await wrapper.submit(pkg, { brainRoot: TEST_BRAIN_ROOT });

    // Real gateway mutated `pkg` in-place:
    const hasValidatedRulesAfter = 'validated_rules' in pkg;
    const hasStageAfter = pkg.stage === 'VALIDATED';

    // Shadow operated on isolated clone:
    const shadowRemainedIsolated = shadowReceivedPackage !== pkg &&
                                   shadowReceivedPackage.validated_rules === undefined;

    const b3Passed = !hadValidatedRulesBefore &&
                     hasValidatedRulesAfter &&
                     shadowRemainedIsolated &&
                     res.success === true;

    results.tests.push({
      test_id: 'TEST-B3-GATEWAY-MUTATION-ISOLATION',
      name: 'Real Gateway In-Place Mutation Isolation',
      passed: b3Passed,
      details: {
        gateway_mutated_original: hasValidatedRulesAfter,
        shadow_received_distinct_object: shadowReceivedPackage !== pkg,
        shadow_free_of_gateway_mutation: shadowReceivedPackage?.validated_rules === undefined,
        legacy_success: res.success
      }
    });
    if (b3Passed) results.passed++; else results.failed++;
    console.log(`  ${b3Passed ? '✅' : '❌'} Test B.3 (Gateway Mutation Isolation): Gateway in-place mutations isolated from shadow`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-B3-GATEWAY-MUTATION-ISOLATION', passed: false, error: err.message });
    console.error(`  ❌ Test B.3 Failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test B.4: Non-Cloneable Input Fail-Closed Graceful Degradation
  // -------------------------------------------------------------
  try {
    const pkg = makeTestPkg('fastapi-noncloneable-01');

    // Create intentional non-cloneable property (Functions cannot be cloned by structuredClone)
    pkg.non_cloneable_fn = () => { return 'cannot_clone_function'; };

    let shadowRan = false;
    const wrapper = new ShadowGatewayWrapper({
      legacyGatewayFn: async (p) => ({ success: true, legacy_unharmed: true }),
      config: { enabled: true, sampleRate: 1.0, dryRun: true }
    });

    wrapper.shadowExecutor.execute = async () => {
      shadowRan = true;
    };

    const res = await wrapper.submit(pkg);

    // Shadow must fail closed (not run), but legacy must complete unharmed!
    const b4Passed = shadowRan === false && res.legacy_unharmed === true;

    results.tests.push({
      test_id: 'TEST-B4-NON-CLONEABLE-FAIL-CLOSED',
      name: 'Non-Cloneable Input Graceful Fail-Closed Handling',
      passed: b4Passed,
      details: {
        shadow_aborted_safely: !shadowRan,
        legacy_succeeded: res.legacy_unharmed
      }
    });
    if (b4Passed) results.passed++; else results.failed++;
    console.log(`  ${b4Passed ? '✅' : '❌'} Test B.4 (Non-Cloneable Fail-Closed): Non-cloneable function caught, shadow safely bypassed`);
  } catch (err) {
    results.failed++;
    results.tests.push({ test_id: 'TEST-B4-NON-CLONEABLE-FAIL-CLOSED', passed: false, error: err.message });
    console.error(`  ❌ Test B.4 Failed: ${err.message}`);
  }

  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMutationIsolationTests().then(res => {
    console.log(`\nSuite B Complete: ${res.passed}/${res.passed + res.failed} Passed`);
  });
}
