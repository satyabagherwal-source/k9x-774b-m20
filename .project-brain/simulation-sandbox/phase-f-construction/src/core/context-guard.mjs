/**
 * Agentic Knowledge Gateway: Context & Extraction Safety Guard
 * Grounded in Brain Patterns:
 * - SYNTH-E3-014-CD-J7YF: Context Length Clamping Invariant (PARTIALLY_VERIFIED in Phase E.4)
 * - SYNTH-E3-029-CD-BKS6: Deterministic Extraction Configuration Invariant (PARTIALLY_VERIFIED in Phase E.4)
 */

export class ContextExceededError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'ContextExceededError';
    this.details = details;
  }
}

export class NonDeterministicConfigError extends Error {
  constructor(message, violations) {
    super(message);
    this.name = 'NonDeterministicConfigError';
    this.violations = violations;
  }
}

/**
 * Enforces boundary clamping on input length / token counts to prevent context overflow crashes.
 */
export function clampContext(inputLength, maxAllowed = 32768, strictMode = false) {
  if (typeof inputLength !== 'number' || inputLength <= 0 || !Number.isFinite(inputLength)) {
    throw new RangeError(`Input length must be a finite positive number. Received: ${inputLength}`);
  }

  if (inputLength > maxAllowed) {
    if (strictMode) {
      throw new ContextExceededError(
        `Input length (${inputLength}) exceeds strict maximum allowed limit (${maxAllowed})`,
        { inputLength, maxAllowed }
      );
    }
    return {
      effectiveLength: maxAllowed,
      wasClamped: true,
      originalLength: inputLength,
      reduction: inputLength - maxAllowed
    };
  }

  return {
    effectiveLength: inputLength,
    wasClamped: false,
    originalLength: inputLength,
    reduction: 0
  };
}

/**
 * Validates that generation parameters for an extraction task satisfy determinism invariants.
 */
export function validateExtractionConfig(config = {}) {
  const violations = [];

  // 1. Temperature must be 0.0
  if (config.temperature !== undefined && config.temperature !== 0.0) {
    violations.push(`temperature must be 0.0 for deterministic extraction (received: ${config.temperature}). Non-zero temperature induces token drift`);
  }

  // 2. do_sample must be false
  if (config.do_sample === true) {
    violations.push(`do_sample must be false for deterministic extraction`);
  }

  // 3. top_p sampling with non-zero temperature is prohibited
  if (config.top_p !== undefined && config.top_p < 1.0 && config.temperature !== 0.0) {
    violations.push(`top_p sampling (${config.top_p}) conflicts with deterministic decoding`);
  }

  // 4. repetition_penalty cannot be < 1.0
  if (config.repetition_penalty !== undefined && config.repetition_penalty < 1.0) {
    violations.push(`repetition_penalty cannot be < 1.0 (received: ${config.repetition_penalty})`);
  }

  if (violations.length > 0) {
    throw new NonDeterministicConfigError(
      `Extraction configuration violated determinism invariants:\n- ${violations.join('\n- ')}`,
      violations
    );
  }

  return {
    isDeterministic: true,
    normalizedConfig: {
      temperature: 0.0,
      do_sample: false,
      top_p: config.top_p ?? 1.0,
      repetition_penalty: config.repetition_penalty ?? 1.05
    }
  };
}

