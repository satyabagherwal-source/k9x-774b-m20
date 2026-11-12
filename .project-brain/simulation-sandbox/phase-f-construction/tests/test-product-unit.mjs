/**
 * Unit Test Suite for Agentic Knowledge Gateway Core Library
 */
import assert from 'assert';
import {
  extractJSON,
  stripFences,
  sliceFirstBalancedObject,
  ExtractJSONError,
  slugifyHeading,
  generateTableOfContents,
  validateAnchorLink,
  inspectModelBinaryEnvelope,
  CorruptedArtifactError,
  HeaderOverflowError,
  clampContext,
  validateExtractionConfig,
  ContextExceededError,
  NonDeterministicConfigError
} from '../src/index.mjs';

export function runUnitTests() {
  const log = [];
  log.push('--- RUNNING AGENTIC-KGW UNIT TESTS ---');

  // --- 1. JSON Extractor Tests ---
  // Fast path
  const fast = extractJSON('{"name": "agent", "ready": true}');
  assert.strictEqual(fast.name, 'agent');
  log.push('  PASS: extractJSON fast path parsed valid JSON');

  // Strip fences
  const fenced = extractJSON('```json\n{"items": [1, 2, 3]}\n```');
  assert.deepStrictEqual(fenced.items, [1, 2, 3]);
  log.push('  PASS: extractJSON stripped code fences');

  // Preamble & postscript
  const preamble = 'Here is the output:\n{"decision": "approve"}\nThank you!';
  const sliced = extractJSON(preamble);
  assert.strictEqual(sliced.decision, 'approve');
  log.push('  PASS: extractJSON sliced first balanced object from conversational text');

  // Braces in string
  const inner = '{"sql": "WHERE col = \'{val}\'", "ok": true}';
  const parsedInner = extractJSON(inner);
  assert.strictEqual(parsedInner.sql, "WHERE col = '{val}'");
  log.push('  PASS: extractJSON preserved inner braces inside string literals');

  // Empty input throws
  assert.throws(() => extractJSON(''), (err) => err instanceof ExtractJSONError);
  log.push('  PASS: extractJSON threw ExtractJSONError on empty input');

  // --- 2. Anchor Engine Tests ---
  const s1 = slugifyHeading('## 1. Quick Start Guide!');
  assert.strictEqual(s1, '1-quick-start-guide');
  log.push('  PASS: slugifyHeading stripped hashes, punctuation, and downcased');

  const seen = new Set();
  const s2a = slugifyHeading('Overview', seen);
  const s2b = slugifyHeading('Overview', seen);
  assert.strictEqual(s2a, 'overview');
  assert.strictEqual(s2b, 'overview-1');
  log.push('  PASS: slugifyHeading disambiguated duplicate headings');

  const mdDoc = '# Title\nSome text\n## Section One\nMore text\n## Section One';
  const toc = generateTableOfContents(mdDoc);
  assert.strictEqual(toc.length, 3);
  assert.strictEqual(toc[1].anchor, '#section-one');
  assert.strictEqual(toc[2].anchor, '#section-one-1');
  log.push('  PASS: generateTableOfContents parsed document and generated unique anchors');

  // --- 3. Binary Inspector Tests ---
  const gguf = Buffer.alloc(32);
  gguf.write('GGUF', 0, 4, 'ascii');
  gguf.writeUInt32LE(3, 4); // version 3
  gguf.writeBigUInt64LE(100n, 8); // 100 tensors
  gguf.writeBigUInt64LE(15n, 16); // 15 metadata keys
  const ggufReport = inspectModelBinaryEnvelope(gguf);
  assert.strictEqual(ggufReport.format, 'GGUF');
  assert.strictEqual(ggufReport.version, 3);
  assert.strictEqual(ggufReport.tensorCount, 100);
  log.push('  PASS: inspectModelBinaryEnvelope parsed GGUF v3 header and counts');

  // Safetensors header
  const meta = JSON.stringify({ "tensor1": { "dtype": "F32", "shape": [10, 10] } });
  const metaBuf = Buffer.from(meta, 'utf8');
  const safeBuf = Buffer.alloc(8 + metaBuf.length + 32);
  safeBuf.writeBigUInt64LE(BigInt(metaBuf.length), 0);
  metaBuf.copy(safeBuf, 8);
  const safeReport = inspectModelBinaryEnvelope(safeBuf);
  assert.strictEqual(safeReport.format, 'SAFETENSORS');
  assert.strictEqual(safeReport.tensorNames[0], 'tensor1');
  log.push('  PASS: inspectModelBinaryEnvelope parsed Safetensors header metadata');

  // Small buffer error
  assert.throws(() => inspectModelBinaryEnvelope(Buffer.from('TINY')), (err) => err instanceof CorruptedArtifactError);
  log.push('  PASS: inspectModelBinaryEnvelope rejected truncated buffer under 8 bytes');

  // --- 4. Context Guard Tests ---
  const c1 = clampContext(5000, 32768, false);
  assert.strictEqual(c1.wasClamped, false);
  assert.strictEqual(c1.effectiveLength, 5000);
  log.push('  PASS: clampContext allowed within-bounds sequence length');

  const c2 = clampContext(40000, 32768, false);
  assert.strictEqual(c2.wasClamped, true);
  assert.strictEqual(c2.effectiveLength, 32768);
  log.push('  PASS: clampContext clamped out-of-bounds length to max limit');

  assert.throws(() => clampContext(40000, 32768, true), (err) => err instanceof ContextExceededError);
  log.push('  PASS: clampContext strict mode raised ContextExceededError');

  // Deterministic config
  const cfg = validateExtractionConfig({ temperature: 0.0, do_sample: false });
  assert.strictEqual(cfg.isDeterministic, true);
  log.push('  PASS: validateExtractionConfig approved T=0 greedy config');

  assert.throws(() => validateExtractionConfig({ temperature: 0.8 }), (err) => err instanceof NonDeterministicConfigError);
  log.push('  PASS: validateExtractionConfig rejected stochastic temperature');

  return { passed: 16, total: 16, log };
}

