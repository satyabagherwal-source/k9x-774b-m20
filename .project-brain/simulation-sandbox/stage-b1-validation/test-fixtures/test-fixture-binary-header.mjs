/**
 * ISOLATED TEST FIXTURE: Binary Artifact Versioning & Format Header Invariant
 * Candidate ID: CD-8KGR
 * Origin: abenzerps/Qwen-Image-2.1-Uncensored-Quantized
 * Purpose: Empirically verify that binary weight files enforce magic bytes (GGUF)
 *          and minimum version checks before memory mapping.
 */

import assert from 'assert';

console.log('--- RUNNING ISOLATED RUNTIME TEST FIXTURE: BINARY HEADER INVARIANT ---');

const GGUF_MAGIC = 0x46554747; // 'GGUF' in little-endian uint32
const MIN_GGUF_VERSION = 3;

function validateGGUFHeader(buffer) {
  if (buffer.length < 8) {
    throw new Error('File too small to contain valid GGUF header');
  }

  const magic = buffer.readUInt32LE(0);
  const version = buffer.readUInt32LE(4);

  if (magic !== GGUF_MAGIC) {
    throw new Error(`Invalid magic bytes: 0x${magic.toString(16).toUpperCase()} (Expected GGUF)`);
  }

  if (version < MIN_GGUF_VERSION) {
    throw new Error(`Unsupported GGUF version: ${version} (Minimum supported: ${MIN_GGUF_VERSION})`);
  }

  return { valid: true, version };
}

// TEST 1: Valid GGUF v3 header
const validBuf = Buffer.alloc(16);
validBuf.writeUInt32LE(GGUF_MAGIC, 0);
validBuf.writeUInt32LE(3, 4);

const resValid = validateGGUFHeader(validBuf);
console.log('Test 1 - Valid Header Result:', resValid);
assert.strictEqual(resValid.valid, true);
assert.strictEqual(resValid.version, 3);
console.log('✅ Test 1 PASSED: Valid GGUF header accepted.');

// TEST 2: Corrupted Magic Bytes
const corruptBuf = Buffer.alloc(16);
corruptBuf.writeUInt32LE(0xDEADBEEF, 0);
corruptBuf.writeUInt32LE(3, 4);

assert.throws(() => validateGGUFHeader(corruptBuf), /Invalid magic bytes/);
console.log('✅ Test 2 PASSED: Corrupted magic bytes rejected before memory mapping.');

// TEST 3: Outdated Version (v1)
const outdatedBuf = Buffer.alloc(16);
outdatedBuf.writeUInt32LE(GGUF_MAGIC, 0);
outdatedBuf.writeUInt32LE(1, 4);

assert.throws(() => validateGGUFHeader(outdatedBuf), /Unsupported GGUF version/);
console.log('✅ Test 3 PASSED: Outdated version rejected.');

console.log('ALL BINARY HEADER INVARIANT TESTS PASSED IN ISOLATION.');

