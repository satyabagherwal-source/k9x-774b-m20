/**
 * ISOLATED TEST FIXTURE: CMTP & MHUP Numerical Invariants
 * Candidate ID: CD-ZNND
 * Origin: sentence-transformers/all-MiniLM-L6-v2
 * Purpose: Empirically verify that clamped mask temporal pooling avoids NaN/Inf on empty/padded sequences
 *          and that L2 hypersphere normalization enforces ||v||_2 = 1.0.
 */

import assert from 'assert';

console.log('--- RUNNING ISOLATED RUNTIME TEST FIXTURE: CMTP & MHUP ---');

// 1. CMTP: Clamped Masked Temporal Pooling
function extractMeanPooledEmbedding(tokenEmbeddings, attentionMask, epsilon = 1e-9) {
  // tokenEmbeddings: Array of shape [SeqLen, HiddenDim]
  // attentionMask: Array of length [SeqLen] (1 = keep, 0 = pad)
  const seqLen = tokenEmbeddings.length;
  const hiddenDim = tokenEmbeddings[0].length;
  
  const sumEmbeddings = new Array(hiddenDim).fill(0);
  let sumMask = 0;

  for (let s = 0; s < seqLen; s++) {
    const mask = attentionMask[s];
    sumMask += mask;
    for (let d = 0; d < hiddenDim; d++) {
      sumEmbeddings[d] += tokenEmbeddings[s][d] * mask;
    }
  }

  // Clamped divisor invariant
  const clampedDivisor = Math.max(sumMask, epsilon);
  const pooled = sumEmbeddings.map(v => v / clampedDivisor);
  return pooled;
}

// 2. MHUP: Metric Hypersphere Unit Projection (L2 normalization)
function enforceHypersphereProjection(vector, epsilon = 1e-12) {
  let normSq = 0;
  for (let i = 0; i < vector.length; i++) {
    normSq += vector[i] * vector[i];
  }
  const norm = Math.sqrt(normSq);
  const safeNorm = Math.max(norm, epsilon);
  return vector.map(v => v / safeNorm);
}

// TEST 1: Standard valid sequence
const normalTokens = [
  [1.0, 2.0, 3.0],
  [4.0, 5.0, 6.0],
  [0.0, 0.0, 0.0] // padding token
];
const normalMask = [1, 1, 0];

const pooledNormal = extractMeanPooledEmbedding(normalTokens, normalMask);
console.log('Test 1 - Normal Pooled Output:', pooledNormal);
assert.strictEqual(pooledNormal[0], (1.0 + 4.0) / 2);
assert.strictEqual(pooledNormal[1], (2.0 + 5.0) / 2);
assert.strictEqual(pooledNormal[2], (3.0 + 6.0) / 2);
console.log('✅ Test 1 PASSED: Valid tokens correctly aggregated, padded tokens excluded.');

// TEST 2: Boundary Case - ALL TOKENS PADDED / EMPTY SEQUENCE (attention_mask = [0, 0, 0])
const emptyTokens = [
  [10.0, 20.0, 30.0],
  [40.0, 50.0, 60.0],
  [70.0, 80.0, 90.0]
];
const emptyMask = [0, 0, 0];

const pooledEmpty = extractMeanPooledEmbedding(emptyTokens, emptyMask);
console.log('Test 2 - Empty Sequence Output (sumMask=0):', pooledEmpty);

for (const val of pooledEmpty) {
  assert(!Number.isNaN(val), 'NaN detected in pooled output!');
  assert(Number.isFinite(val), 'Inf detected in pooled output!');
  assert.strictEqual(val, 0.0, 'Expected zero vector for all-padding input');
}
console.log('✅ Test 2 PASSED: Clamping epsilon successfully prevented division-by-zero NaN/Inf.');

// TEST 3: MHUP Unit Norm Verification
const unnormalizedVector = [3.0, 4.0, 0.0]; // Norm is 5.0
const projected = enforceHypersphereProjection(unnormalizedVector);
const norm = Math.sqrt(projected.reduce((acc, v) => acc + v * v, 0));

console.log('Test 3 - Hypersphere Projection Norm:', norm);
assert(Math.abs(norm - 1.0) < 1e-6, 'L2 Norm is not 1.0!');
console.log('✅ Test 3 PASSED: Hypersphere projection enforces ||v||_2 = 1.0.');

console.log('ALL CMTP & MHUP RUNTIME TESTS PASSED IN ISOLATION.');

