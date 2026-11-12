/**
 * Test 04: Vision Transformer Patch Size Divisibility Invariant
 * Candidate: SYNTH-E3-108-CD-YKUY (openbmb/MiniCPM-V-4.7-1B, commit hf-openbmb-m)
 * Status: PARTIALLY_VERIFIED (Mathematical invariant & spatial boundary logic verified; 1B weights unavailable offline)
 */
import assert from 'assert';

export class DimensionIncompatibleError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'DimensionIncompatibleError';
    this.details = details;
  }
}

export function computeVisionPatches(height, width, patchSize = 14) {
  if (height <= 0 || width <= 0) {
    throw new RangeError(`Dimensions must be positive integers. Received ${height}x${width}`);
  }

  const remH = height % patchSize;
  const remW = width % patchSize;

  if (remH !== 0 || remW !== 0) {
    throw new DimensionIncompatibleError(
      `Image resolution ${height}x${width} is not divisible by patch size ${patchSize} (remainders: H=${remH}, W=${remW})`,
      { height, width, patchSize, remH, remW }
    );
  }

  const gridH = height / patchSize;
  const gridW = width / patchSize;
  const numPatches = gridH * gridW;

  return { gridH, gridW, numPatches };
}

export function padOrCropToPatchDivisibility(height, width, patchSize = 14, mode = 'pad') {
  if (mode === 'pad') {
    const padH = (patchSize - (height % patchSize)) % patchSize;
    const padW = (patchSize - (width % patchSize)) % patchSize;
    return { newHeight: height + padH, newWidth: width + padW, padH, padW };
  } else if (mode === 'crop') {
    const cropH = height % patchSize;
    const cropW = width % patchSize;
    return { newHeight: height - cropH, newWidth: width - cropW, cropH, cropW };
  }
  throw new Error(`Unsupported mode: ${mode}`);
}

export function run() {
  const log = [];
  log.push('Executing Test 04: MiniCPM-V Patch Size Divisibility Invariant');

  // 1. Native MiniCPM-V resolution (980x980)
  const resNative = computeVisionPatches(980, 980, 14);
  assert.strictEqual(resNative.gridH, 70);
  assert.strictEqual(resNative.gridW, 70);
  assert.strictEqual(resNative.numPatches, 4900);
  log.push('  PASS: Native 980x980 yields exactly 4900 patches (70x70 grid)');

  // 2. Rectangular divisible resolution (448x224)
  const resRect = computeVisionPatches(448, 224, 14);
  assert.strictEqual(resRect.gridH, 32);
  assert.strictEqual(resRect.gridW, 16);
  assert.strictEqual(resRect.numPatches, 512);
  log.push('  PASS: Rectangular 448x224 yields exactly 512 patches (32x16 grid)');

  // 3. Negative Constraint: Non-divisible height (985x980) throws DimensionIncompatibleError
  assert.throws(() => computeVisionPatches(985, 980, 14), (err) => {
    return err instanceof DimensionIncompatibleError && err.details.remH === 5;
  });
  log.push('  PASS: Non-divisible height (985 % 14 = 5) correctly rejected');

  // 4. Negative Constraint: Non-divisible width (980x983) throws DimensionIncompatibleError
  assert.throws(() => computeVisionPatches(980, 983, 14), (err) => {
    return err instanceof DimensionIncompatibleError && err.details.remW === 3;
  });
  log.push('  PASS: Non-divisible width (983 % 14 = 3) correctly rejected');

  // 5. Boundary Clamping: Padding non-divisible 985x983 to valid grid
  const padded = padOrCropToPatchDivisibility(985, 983, 14, 'pad');
  assert.strictEqual(padded.newHeight, 994); // 994 % 14 === 0
  assert.strictEqual(padded.newWidth, 994);  // 994 % 14 === 0
  assert.strictEqual(computeVisionPatches(padded.newHeight, padded.newWidth, 14).numPatches, 71 * 71);
  log.push('  PASS: Automatic padding recovers patch divisibility (994x994)');

  return {
    candidateId: 'SYNTH-E3-108-CD-YKUY',
    title: 'Patch Size Divisibility for Vision Encoder',
    status: 'PARTIALLY_VERIFIED',
    evidenceType: 'MATHEMATICAL_INVARIANT_VERIFIED',
    qualification: 'Patch calculation and boundary padding verified; full 1B vision weights unavailable offline',
    checksPassed: 5,
    checksTotal: 5,
    log
  };
}

