/**
 * ISOLATED TEST FIXTURE: LUT 2-bit Trit Unpacking
 * Candidate ID: CD-UV2I
 * Origin: prism-ml/Ternary-Bonsai-2-27B-gguf
 * Purpose: Verify constant-time lookup table unpacking of ternary weights {-1, 0, 1}
 *          avoiding GPU/CPU branch divergence.
 */

import assert from 'assert';

console.log('--- RUNNING ISOLATED RUNTIME TEST FIXTURE: TERNARY LUT UNPACKING ---');

const TRIT_LUT = new Float32Array([-1.0, 0.0, 1.0, 0.0]); // 00 -> -1, 01 -> 0, 10 -> 1, 11 -> Padding

function dequantTrit2BitLUT(packedByte, index) {
  const val = (packedByte >> (index * 2)) & 0b11;
  return TRIT_LUT[val];
}

// Packed byte: 0b10_01_00_10 (trit3=2->1.0, trit2=1->0.0, trit1=0->-1.0, trit0=2->1.0)
const packed = 0b10010010;

const t0 = dequantTrit2BitLUT(packed, 0); // 0b10 -> 1.0
const t1 = dequantTrit2BitLUT(packed, 1); // 0b00 -> -1.0
const t2 = dequantTrit2BitLUT(packed, 2); // 0b01 -> 0.0
const t3 = dequantTrit2BitLUT(packed, 3); // 0b10 -> 1.0

console.log('Dequantized trits:', [t0, t1, t2, t3]);
assert.strictEqual(t0, 1.0);
assert.strictEqual(t1, -1.0);
assert.strictEqual(t2, 0.0);
assert.strictEqual(t3, 1.0);
console.log('✅ Test 1 PASSED: Constant-time LUT correctly unpacks ternary slots without branching.');

console.log('ALL TERNARY LUT UNPACKING TESTS PASSED IN ISOLATION.');

