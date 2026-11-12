/**
 * Test 09: Deterministic Decoding Configuration for Structured Extraction
 * Candidate: SYNTH-E3-029-CD-BKS6 (XingChen-AGI/TeleOCR, commit hf-xingchen-)
 * Status: PARTIALLY_VERIFIED (Configuration validation contracts verified; TeleOCR vision-language runtime unavailable offline)
 */
import assert from 'assert';

export class NonDeterministicConfigError extends Error {
  constructor(message, violations) {
    super(message);
    this.name = 'NonDeterministicConfigError';
    this.violations = violations;
  }
}

/**
 * Validates that generation config satisfies deterministic decoding invariant
 * required for OCR bounding-box / coordinate extraction tasks.
 */
export function validateExtractionConfig(config) {
  const violations = [];

  // 1. Temperature must be strictly 0.0 for deterministic decoding
  if (config.temperature !== undefined && config.temperature !== 0.0) {
    violations.push(`temperature must be 0.0 (received ${config.temperature}). Non-zero temperature induces bounding box token drift`);
  }

  // 2. top_p should be 1.0 (or disabled) when temperature is 0.0
  if (config.top_p !== undefined && config.top_p < 1.0 && config.temperature !== 0.0) {
    violations.push(`top_p sampling (${config.top_p}) is incompatible with deterministic extraction`);
  }

  // 3. do_sample must be false
  if (config.do_sample === true) {
    violations.push(`do_sample must be false for extraction tasks`);
  }

  // 4. repetition_penalty should be >= 1.0
  if (config.repetition_penalty !== undefined && config.repetition_penalty < 1.0) {
    violations.push(`repetition_penalty cannot be < 1.0 (received ${config.repetition_penalty})`);
  }

  if (violations.length > 0) {
    throw new NonDeterministicConfigError(
      `Extraction configuration violated determinism invariants:\n- ${violations.join('\n- ')}`,
      violations
    );
  }

  return {
    isDeterministic: true,
    effectiveConfig: {
      temperature: 0.0,
      do_sample: false,
      top_p: config.top_p ?? 1.0,
      repetition_penalty: config.repetition_penalty ?? 1.05
    }
  };
}

export function run() {
  const log = [];
  log.push('Executing Test 09: TeleOCR Deterministic Decoding Invariant');

  // 1. Valid deterministic configuration
  const valid = validateExtractionConfig({
    temperature: 0.0,
    do_sample: false,
    top_p: 1.0,
    repetition_penalty: 1.05
  });
  assert.strictEqual(valid.isDeterministic, true);
  assert.strictEqual(valid.effectiveConfig.temperature, 0.0);
  log.push('  PASS: Deterministic configuration (T=0, do_sample=false) validated');

  // 2. Negative Constraint: Non-zero temperature (T=0.7) throws NonDeterministicConfigError
  assert.throws(() => validateExtractionConfig({ temperature: 0.7 }), (err) => {
    return err instanceof NonDeterministicConfigError && err.violations.some(v => v.includes('temperature must be 0.0'));
  });
  log.push('  PASS: Stochastic temperature (T=0.7) rejected for extraction tasks');

  // 3. Negative Constraint: do_sample = true throws
  assert.throws(() => validateExtractionConfig({ do_sample: true }), (err) => {
    return err instanceof NonDeterministicConfigError && err.violations.some(v => v.includes('do_sample must be false'));
  });
  log.push('  PASS: do_sample=true rejected');

  // 4. Negative Constraint: Invalid repetition penalty (< 1.0) throws
  assert.throws(() => validateExtractionConfig({ temperature: 0.0, repetition_penalty: 0.8 }), (err) => {
    return err instanceof NonDeterministicConfigError && err.violations.some(v => v.includes('repetition_penalty'));
  });
  log.push('  PASS: Repetition penalty < 1.0 rejected');

  return {
    candidateId: 'SYNTH-E3-029-CD-BKS6',
    title: 'Deterministic Decoding for Extraction Tasks',
    status: 'PARTIALLY_VERIFIED',
    evidenceType: 'CONFIGURATION_CONTRACT_VERIFIED',
    qualification: 'Generation configuration contract verified; TeleOCR vision-language runtime unavailable offline',
    checksPassed: 4,
    checksTotal: 4,
    log
  };
}

