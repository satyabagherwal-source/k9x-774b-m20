/**
 * Stage D.4 Shadow Gateway Wrapper
 * 
 * Non-invasive safety wrapper wrapping BrainLearningGateway.submitToBrainGateway().
 * 
 * HARD SAFETY INVARIANTS:
 * 1. Disabled by Default: If config is missing, unreadable, malformed, or enabled !== true,
 *    zero shadow processing occurs. Fail-closed on any configuration anomaly.
 * 2. Deep-Clone Reference Isolation: Input is cloned via structuredClone() after clone-compatibility
 *    verification. Shadow code operates exclusively on the cloned object, preventing in-place
 *    mutations (e.g. validated_rules, rejected_rules) from colliding.
 * 3. Exact Legacy Return Preservation: The caller receives the exact, unmodified return value,
 *    types, and status from the legacy gateway function across all return paths (22+ fields).
 * 4. Fail-Closed Error Boundary: Any failure, exception, or timeout in shadow mode is trapped
 *    silently; it never disrupts the legacy harvester or alters legacy return values.
 * 5. Dependency Injection: Shadow code never accesses live production paths, registries, or caches.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { ShadowCircuitBreaker } from './shadow-circuit-breaker.mjs';
import { ShadowPipelineExecutor } from './shadow-pipeline-executor.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_CONTROL_PATH = path.resolve(__dirname, '..', '..', '..', '..', '..', 'harvest-control.json');
const DEFAULT_TRACE_DIR = path.resolve(__dirname, '..', 'shadow-traces');

export class ShadowGatewayWrapper {
  constructor(options = {}) {
    this.legacyGatewayFn = options.legacyGatewayFn || null;
    this.controlPath = options.controlPath || DEFAULT_CONTROL_PATH;
    this.traceDir = options.traceDir || DEFAULT_TRACE_DIR;

    // Direct config override for testing
    this.staticConfig = options.config || null;

    this.circuitBreaker = new ShadowCircuitBreaker({
      maxConsecutiveFailures: options.config?.circuitBreaker?.maxConsecutiveFailures || 3,
      cooldownMs: options.config?.circuitBreaker?.cooldownMs || 60000,
      timeoutMs: options.config?.timeoutMs || 3000,
      maxBatchSize: options.config?.maxBatchSize || 5
    });

    this.shadowExecutor = new ShadowPipelineExecutor({
      traceDir: this.traceDir,
      existingIndex: options.existingIndex || null,
      existingRegistry: options.existingRegistry || null
    });
  }

  /**
   * Loads configuration dynamically with strict fail-closed safety.
   * If file is missing, unreadable, or contains invalid JSON, returns safe disabled defaults.
   */
  loadConfiguration() {
    if (this.staticConfig) {
      return this.staticConfig;
    }

    const defaultDisabled = {
      enabled: false,
      sampleRate: 0.01,
      canaryTargetRepository: null,
      maxBatchSize: 5,
      timeoutMs: 3000,
      dryRun: true
    };

    if (!fs.existsSync(this.controlPath)) {
      return defaultDisabled;
    }

    try {
      const raw = fs.readFileSync(this.controlPath, 'utf8');
      const parsed = JSON.parse(raw);
      const shadowBlock = parsed?.brainIntegrityGuard?.brainLearningGateway?.shadowMode;

      if (!shadowBlock || typeof shadowBlock !== 'object') {
        return defaultDisabled;
      }

      return {
        enabled: Boolean(shadowBlock.enabled),
        sampleRate: typeof shadowBlock.sampleRate === 'number' ? shadowBlock.sampleRate : 0.01,
        canaryTargetRepository: shadowBlock.canaryTargetRepository || null,
        maxBatchSize: typeof shadowBlock.maxBatchSize === 'number' ? shadowBlock.maxBatchSize : 5,
        timeoutMs: typeof shadowBlock.timeoutMs === 'number' ? shadowBlock.timeoutMs : 3000,
        dryRun: shadowBlock.dryRun !== false,
        circuitBreaker: shadowBlock.circuitBreaker || { maxConsecutiveFailures: 3, cooldownMs: 60000 }
      };
    } catch (err) {
      // Malformed JSON -> Fail Closed!
      console.warn(`[SHADOW WRAPPER D.4] Malformed configuration at ${this.controlPath}: ${err.message}. Defaulting to DISABLED.`);
      return defaultDisabled;
    }
  }

  /**
   * Safely clones input using structuredClone.
   * Returns { success: true, cloned } or { success: false, error }
   */
  safelyCloneInput(input) {
    try {
      const cloned = structuredClone(input);
      return { success: true, cloned };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Main entry point wrapping submitToBrainGateway.
   */
  async submit(learningPackage, options = {}) {
    const config = this.loadConfiguration();
    const shadowEnabled = options.shadowMode?.enabled ?? config.enabled ?? false;

    // Path A: Shadow mode Disabled -> Pure pass-through
    if (!shadowEnabled) {
      if (this.legacyGatewayFn) {
        return await this.legacyGatewayFn(learningPackage, options);
      }
      return { success: true, passthrough: true };
    }

    // Path B: Shadow mode Enabled -> Perform pre-execution filter checks
    const targetRepo = options.shadowMode?.canaryTargetRepository ?? config.canaryTargetRepository;
    const sampleRate = options.shadowMode?.sampleRate ?? config.sampleRate ?? 0.01;

    let shouldRunShadow = true;

    // Filter 1: Canary Target Repository Pinning
    if (targetRepo && learningPackage.repository !== targetRepo) {
      shouldRunShadow = false;
    }

    // Filter 2: Sampling Rate Check
    if (shouldRunShadow && sampleRate < 1.0) {
      if (Math.random() > sampleRate) {
        shouldRunShadow = false;
      }
    }

    // Filter 3: Circuit Breaker State Check
    if (shouldRunShadow && this.circuitBreaker.isOpen()) {
      shouldRunShadow = false;
    }

    // Filter 4: Batch Size Limits
    const candidateCount = Array.isArray(learningPackage.candidate_rules || learningPackage.candidates)
      ? (learningPackage.candidate_rules || learningPackage.candidates).length
      : 1;
    if (shouldRunShadow && candidateCount > config.maxBatchSize) {
      shouldRunShadow = false;
    }

    // Filter 5: StructuredClone Compatibility Check
    let clonedInput = null;
    if (shouldRunShadow) {
      const cloneResult = this.safelyCloneInput(learningPackage);
      if (!cloneResult.success) {
        console.warn(`[SHADOW WRAPPER D.4] Input not clone-compatible (${cloneResult.error}). Skipping shadow.`);
        shouldRunShadow = false;
      } else {
        clonedInput = cloneResult.cloned;
      }
    }

    // Execute Legacy First to guarantee caller SLA & preserve exact return object
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

    // Execute Shadow under Fail-Closed Circuit Breaker Isolation
    if (shouldRunShadow && clonedInput) {
      try {
        const timeoutMs = options.shadowMode?.timeoutMs || config.timeoutMs || 3000;
        await this.circuitBreaker.execute(async () => {
          return await this.shadowExecutor.execute(clonedInput, {
            origin: options.origin || 'CLOUD_HARVESTER',
            writeTrace: true,
            traceDir: this.traceDir
          });
        }, timeoutMs);
      } catch (shadowErr) {
        console.warn(`[SHADOW WRAPPER D.4] Non-fatal shadow execution exception caught: ${shadowErr.message}`);
        this.circuitBreaker.recordFailure('unexpected_exception');
      }
    }

    // Re-throw legacy error if legacy originally failed
    if (legacyError) {
      throw legacyError;
    }

    // Return exact, unmodified legacy result object
    return legacyResult;
  }
}

