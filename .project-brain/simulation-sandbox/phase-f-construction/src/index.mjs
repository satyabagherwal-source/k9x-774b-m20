/**
 * Agentic Knowledge Gateway (agentic-kgw) — Reusable Core Library
 * Unified Entry Point
 */

export {
  extractJSON,
  stripFences,
  sliceFirstBalancedObject,
  ExtractJSONError
} from './core/json-extractor.mjs';

export {
  slugifyHeading,
  generateTableOfContents,
  validateAnchorLink
} from './core/anchor-engine.mjs';

export {
  inspectModelBinaryEnvelope,
  CorruptedArtifactError,
  HeaderOverflowError
} from './core/binary-inspector.mjs';

export {
  clampContext,
  validateExtractionConfig,
  ContextExceededError,
  NonDeterministicConfigError
} from './core/context-guard.mjs';

export const VERSION = '1.0.0';

