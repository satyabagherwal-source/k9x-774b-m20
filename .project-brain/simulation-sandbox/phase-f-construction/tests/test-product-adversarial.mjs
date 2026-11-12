/**
 * Adversarial Test Suite for Agentic Knowledge Gateway
 */
import assert from 'assert';
import {
  extractJSON,
  ExtractJSONError,
  slugifyHeading,
  generateTableOfContents,
  inspectModelBinaryEnvelope,
  CorruptedArtifactError,
  HeaderOverflowError,
  clampContext
} from '../src/index.mjs';

export function runAdversarialTests() {
  const log = [];
  log.push('--- RUNNING AGENTIC-KGW ADVERSARIAL TESTS ---');

  // 1. Deeply nested JSON object
  let deepStr = '{"val": 1}';
  for (let i = 0; i < 8; i++) {
    deepStr = `{"level_${i}": ${deepStr}}`;
  }
  const deepRes = extractJSON(`Preamble before deep: ${deepStr} Postscript after deep.`);
  assert.strictEqual(deepRes.level_7.level_6.level_5.level_4.level_3.level_2.level_1.level_0.val, 1);
  log.push('  PASS: Deeply nested JSON object (8 levels) successfully sliced and parsed');

  // 2. Multiple JSON objects in conversational output
  const multiStr = 'Here is the config: {"primary": true} and here is the fallback: {"fallback": true}';
  const firstParsed = extractJSON(multiStr);
  assert.strictEqual(firstParsed.primary, true);
  assert.strictEqual(firstParsed.fallback, undefined);
  log.push('  PASS: Multiple consecutive JSON objects parsed first balanced object without greedy run-on');

  // 3. String with complex escaped JSON syntax
  const complexStr = '{"escaped": "{\\\"inner\\\": \\\"value\\\"}", "status": "ok"}';
  const complexRes = extractJSON(complexStr);
  assert.strictEqual(complexRes.status, 'ok');
  assert.strictEqual(complexRes.escaped, '{"inner": "value"}');
  log.push('  PASS: Complex escaped quotes and braces inside string handled without balance corruption');

  // 4. Safetensors 50MB Header Overflow Attack
  const overflowBuf = Buffer.alloc(16);
  overflowBuf.writeBigUInt64LE(50n * 1024n * 1024n, 0); // 50MB declared header
  assert.throws(() => inspectModelBinaryEnvelope(overflowBuf, 25 * 1024 * 1024), (err) => {
    return err instanceof HeaderOverflowError && err.message.includes('exceeds safety envelope limit');
  });
  log.push('  PASS: Safetensors 50MB header overflow attack rejected before buffer allocation');

  // 5. Safetensors Corrupted JSON in Header
  const badJsonMeta = Buffer.from('{ "not_json": [missing_quotes] }', 'utf8');
  const badJsonBuf = Buffer.alloc(8 + badJsonMeta.length);
  badJsonBuf.writeBigUInt64LE(BigInt(badJsonMeta.length), 0);
  badJsonMeta.copy(badJsonBuf, 8);
  assert.throws(() => inspectModelBinaryEnvelope(badJsonBuf), (err) => {
    return err instanceof CorruptedArtifactError && err.message.includes('Corrupted Safetensors JSON');
  });
  log.push('  PASS: Corrupted JSON header rejected with CorruptedArtifactError');

  // 6. Unicode Headings with Emojis & CJK
  const unicodeSlug = slugifyHeading('### 🚀 Quick Start (快速入门) & FAQ!');
  // Emojis and punctuation stripped, spaces to hyphens
  assert.strictEqual(unicodeSlug, 'quick-start-快速入门--faq');
  log.push('  PASS: Unicode headings with emojis and CJK characters slugified cleanly');

  // 7. Non-finite / Infinite Context Limits
  assert.throws(() => clampContext(Infinity), (err) => err instanceof RangeError);
  assert.throws(() => clampContext(-500), (err) => err instanceof RangeError);
  assert.throws(() => clampContext(NaN), (err) => err instanceof RangeError);
  log.push('  PASS: Non-finite, negative, and NaN context limits strictly rejected');

  return { passed: 7, total: 7, log };
}

