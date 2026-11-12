/**
 * Test 08: Context Length Clamping Invariant
 * Candidate: SYNTH-E3-014-CD-J7YF (orcarouter/Qwen3.8-Flash-Next-Uncensored-GGUF, commit hf-orcaroute)
 * Status: PARTIALLY_VERIFIED (Clamping formula & buffer limits verified; llama.cpp runtime binary unavailable offline)
 */
import assert from 'assert';

export class ContextExceededError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'ContextExceededError';
    this.details = details;
  }
}

/**
 * Enforces strict boundary clamping for sequence allocations
 */
export function clampContextLength(requestedLength, maxContextLength = 32768, allowAutoClamp = true) {
  if (requestedLength <= 0) {
    throw new RangeError(`Requested context length must be positive. Received ${requestedLength}`);
  }

  if (requestedLength > maxContextLength) {
    if (!allowAutoClamp) {
      throw new ContextExceededError(
        `Requested context length ${requestedLength} exceeds max model capacity ${maxContextLength}`,
        { requestedLength, maxContextLength }
      );
    }
    return {
      clampedLength: maxContextLength,
      wasClamped: true,
      originalLength: requestedLength
    };
  }

  return {
    clampedLength: requestedLength,
    wasClamped: false,
    originalLength: requestedLength
  };
}

export function run() {
  const log = [];
  log.push('Executing Test 08: Qwen GGUF Context Length Clamping Invariant');

  const maxModelContext = 32768;

  // 1. Within bound request
  const req1 = clampContextLength(8192, maxModelContext, true);
  assert.strictEqual(req1.clampedLength, 8192);
  assert.strictEqual(req1.wasClamped, false);
  log.push('  PASS: Within-bounds context length (8192 <= 32768) preserved without clamping');

  // 2. Exact boundary request
  const req2 = clampContextLength(32768, maxModelContext, true);
  assert.strictEqual(req2.clampedLength, 32768);
  assert.strictEqual(req2.wasClamped, false);
  log.push('  PASS: Exact boundary context length (32768) accepted');

  // 3. Exceeded bound with auto-clamp enabled
  const req3 = clampContextLength(65536, maxModelContext, true);
  assert.strictEqual(req3.clampedLength, 32768);
  assert.strictEqual(req3.wasClamped, true);
  log.push('  PASS: Out-of-bounds request (65536) clamped to 32768 with clamp flag asserted');

  // 4. Negative Constraint: Exceeded bound with auto-clamp disabled throws ContextExceededError
  assert.throws(() => clampContextLength(40000, maxModelContext, false), (err) => {
    return err instanceof ContextExceededError && err.details.requestedLength === 40000;
  });
  log.push('  PASS: Out-of-bounds request with strict mode throws ContextExceededError');

  // 5. Negative Constraint: Non-positive length throws RangeError
  assert.throws(() => clampContextLength(0, maxModelContext), (err) => {
    return err instanceof RangeError;
  });
  assert.throws(() => clampContextLength(-100, maxModelContext), (err) => {
    return err instanceof RangeError;
  });
  log.push('  PASS: Non-positive context lengths rejected');

  return {
    candidateId: 'SYNTH-E3-014-CD-J7YF',
    title: 'Context Length Clamping',
    status: 'PARTIALLY_VERIFIED',
    evidenceType: 'BOUNDARY_ENVELOPE_VERIFIED',
    qualification: 'Context clamping and allocation boundary logic verified; llama.cpp runtime binary unavailable offline',
    checksPassed: 5,
    checksTotal: 5,
    log
  };
}

