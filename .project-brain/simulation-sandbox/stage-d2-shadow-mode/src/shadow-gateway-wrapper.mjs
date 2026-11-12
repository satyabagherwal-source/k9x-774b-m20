/**
 * Shadow Gateway Wrapper
 * 
 * Non-invasive wrapper around BrainLearningGateway.submitToBrainGateway().
 * 
 * CORE INVARIANTS:
 * 1. Disabled by Default: If config.enabled is not explicitly true, zero shadow code runs.
 * 2. Fail-Closed Isolation: Any failure, rejection, or timeout in shadow mode is caught;
 *    it NEVER affects the legacy harvester or disrupts legacy return values.
 * 3. Exact Legacy Return: The caller always receives the exact untouched legacy result.
 * 4. Zero Production Writes: Shadow mode suppresses writes to canonical brain stores.
 */

import { ShadowCircuitBreaker } from './shadow-circuit-breaker.mjs';
import { ShadowPipelineExecutor } from './shadow-pipeline-executor.mjs';
import { ShadowComparator } from './shadow-comparator.mjs';
import { sanitizeData } from './secret-sanitizer.mjs';

export class ShadowGatewayWrapper {
  constructor(options = {}) {
    this.legacyGatewayFn = options.legacyGatewayFn;
    this.config = {
      enabled: false,
      sampleRate: 1.0,
      maxBatchSize: 5,
      timeoutMs: 3000,
      traceDir: options.traceDir || null,
      ...options.config
    };

    this.circuitBreaker = new ShadowCircuitBreaker({
      maxConsecutiveFailures: this.config.maxConsecutiveFailures || 3,
      cooldownMs: this.config.cooldownMs || 60000,
      timeoutMs: this.config.timeoutMs || 3000,
      maxBatchSize: this.config.maxBatchSize || 5
    });

    this.shadowExecutor = new ShadowPipelineExecutor({
      traceDir: this.config.traceDir,
      existingIndex: options.existingIndex,
      existingRegistry: options.existingRegistry
    });

    this.comparator = new ShadowComparator();
  }

  /**
   * Main entry point wrapping submitToBrainGateway.
   * @param {object} learningPackage - Raw learning package
   * @param {object} options - Gateway options (e.g. brainRoot)
   * @returns {Promise<object>} Exactly the legacy submitToBrainGateway result
   */
  async submit(learningPackage, options = {}) {
    // 1. Check if shadow mode is enabled
    const shadowEnabled = options.shadowMode?.enabled ?? this.config.enabled ?? false;

    // Path A: Shadow mode OFF -> Pure legacy pass-through
    if (!shadowEnabled) {
      if (this.legacyGatewayFn) {
        return await this.legacyGatewayFn(learningPackage, options);
      }
      return { success: true, passthrough: true };
    }

    // Path B: Shadow mode ON
    // 1. Run legacy function first (or in parallel) to guarantee caller SLA
    let legacyResult = null;
    let legacyError = null;

    try {
      if (this.legacyGatewayFn) {
        legacyResult = await this.legacyGatewayFn(learningPackage, options);
      } else {
        legacyResult = { success: true, simulated_legacy: true };
      }
    } catch (err) {
      legacyError = err;
    }

    // 2. Execute Shadow Pipeline under fail-closed protection
    let shadowResult = null;
    let comparisonResult = null;

    try {
      // Validate batch size
      const batchCheck = this.circuitBreaker.validateBatchSize(learningPackage.candidates || [learningPackage]);
      if (!batchCheck.allowed) {
        shadowResult = {
          success: false,
          error: 'BATCH_SIZE_EXCEEDED',
          reason: batchCheck.reason
        };
      } else {
        // Execute inside circuit breaker with timeout
        const cbExecution = await this.circuitBreaker.execute(async () => {
          return await this.shadowExecutor.execute(learningPackage, {
            origin: options.origin || 'CLOUD_HARVESTER',
            writeTrace: true,
            traceDir: this.config.traceDir
          });
        }, this.config.timeoutMs);

        if (cbExecution.success) {
          shadowResult = cbExecution.result;
        } else {
          shadowResult = {
            success: false,
            error: cbExecution.error,
            message: cbExecution.message
          };
        }
      }

      // 3. Compare Legacy vs Shadow if both produced outputs
      if (legacyResult && shadowResult) {
        comparisonResult = this.comparator.compare(legacyResult, shadowResult);
      }
    } catch (shadowErr) {
      // STRICT INVARIANT: Shadow exceptions must NEVER leak or break legacy execution
      console.warn(`[SHADOW GATEWAY WRAPPER] Non-fatal shadow exception caught: ${shadowErr.message}`);
      this.circuitBreaker.recordFailure('unexpected_exception');
    }

    // 4. If legacy threw an error originally, re-throw to preserve legacy semantics
    if (legacyError) {
      throw legacyError;
    }

    // 5. Return untouched legacy result to caller
    return legacyResult;
  }
}

