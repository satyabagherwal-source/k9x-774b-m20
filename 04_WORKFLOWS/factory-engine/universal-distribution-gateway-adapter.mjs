/**
 * 04_WORKFLOWS/factory-engine/universal-distribution-gateway-adapter.mjs
 *
 * Additive Integration Gateway Adapter for Universal Multi-Artifact Distribution
 * Governing Architecture: AI-Builder-Brain Continuous Intelligence
 *
 * Wraps canonical `submitToBrainGateway` non-destructively:
 * - 100% preserves existing primary persistence (07_PROJECT_LEARNING & engineering-patterns.md).
 * - Runs UniversalMultiArtifactDistributor additively.
 * - Defaults to SHADOW_OBSERVATION mode (Feature flag OFF by default for safe zero-disruption live harvest).
 * - Enables active multi-artifact distribution when explicitly authorized.
 * - Eliminates the "silent vanishing" defect by capturing HIQV-withheld rules into 11_INBOX.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { submitToBrainGateway, LEARNING_STATUS } from './brain-learning-gateway.mjs';
import {
  UniversalMultiArtifactDistributor,
  DISTRIBUTION_MODES,
  DEFAULT_BRAIN_ROOT,
  calculateContentHash
} from './universal-multi-artifact-distributor.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Universal Gateway Submission with Multi-Artifact Distribution
 */
export async function submitWithUniversalDistribution(learningPackage, options = {}) {
  const brainRoot = options.brainRoot || learningPackage.metadata?.brainRoot || DEFAULT_BRAIN_ROOT;
  const enableLive = options.enableLiveMultiDistribution !== false &&
                     options.mode !== DISTRIBUTION_MODES.SHADOW_OBSERVATION;
  const mode = options.mode || (enableLive ? DISTRIBUTION_MODES.CANONICAL_LIVE : DISTRIBUTION_MODES.SHADOW_OBSERVATION);

  // Ensure content_hash is populated for backward compatibility with canonical gateway
  if (!learningPackage.content_hash) {
    const raw = learningPackage.raw_dossier_text || learningPackage.dossier_content || '';
    learningPackage.content_hash = calculateContentHash(raw || JSON.stringify(learningPackage));
  }

  // 1. Primary Gateway Persistence Execution (100% Backward Compatible)
  let primaryGatewayResult;
  try {
    primaryGatewayResult = await submitToBrainGateway(learningPackage, options);
  } catch (primaryErr) {
    console.error(`❌ [PRIMARY GATEWAY ERROR] Canonical submitToBrainGateway failed: ${primaryErr.message}`);
    throw primaryErr;
  }

  // If primary gateway was not successful, return immediately
  if (!primaryGatewayResult.success && primaryGatewayResult.status !== LEARNING_STATUS.VERIFIED_LEARNING) {
    return {
      ...primaryGatewayResult,
      success: false,
      primaryGatewayResult,
      distributionResult: null,
      mode
    };
  }

  // 2. Additive Multi-Artifact Distribution Execution
  let distributionResult = null;
  const distributor = new UniversalMultiArtifactDistributor({
    brainRoot,
    mode,
    enableLiveMultiDistribution: enableLive
  });

  try {
    distributionResult = await distributor.distributeLearningPackage(learningPackage, options);
  } catch (distErr) {
    console.error(`⚠️ [DISTRIBUTION ADAPTER WARNING] Multi-artifact distribution error isolated: ${distErr.message}`);
    distributionResult = {
      success: false,
      error: distErr.message,
      isIsolatedFault: true
    };
  }

  return {
    ...primaryGatewayResult,
    success: true,
    learning_id: learningPackage.learning_id,
    repository: learningPackage.repository,
    mode,
    primaryGatewayResult,
    distributionResult,
    isShadowObservation: mode === DISTRIBUTION_MODES.SHADOW_OBSERVATION,
    isCanonicalLive: mode === DISTRIBUTION_MODES.CANONICAL_LIVE
  };
}
