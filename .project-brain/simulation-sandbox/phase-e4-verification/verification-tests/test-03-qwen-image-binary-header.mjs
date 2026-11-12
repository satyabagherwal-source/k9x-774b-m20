/**
 * Test 03: Binary Model Artifact Magic Header & Format Verification
 * Candidate: SYNTH-E3-113-CD-8KGR (abenzerps/Qwen-Image-2.1-Uncensored-Quantized, commit hf-abenzerps)
 * Status: VERIFIED_INDEPENDENTLY (Executes actual binary header parsing on mock binary buffers)
 */
import assert from 'assert';

export class CorruptedArtifactError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CorruptedArtifactError';
  }
}

export class HeaderOverflowError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HeaderOverflowError';
  }
}

/**
 * Inspects a binary model buffer to identify format and validate envelope integrity.
 * GGUF Magic: 0x46554747 (little-endian "GGUF")
 * Safetensors Header: 8-byte uint64 LE header size, followed by valid JSON metadata
 */
export function inspectModelBinaryEnvelope(buffer, maxHeaderBytes = 25 * 1024 * 1024) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('Input must be a valid Buffer');
  }

  if (buffer.length < 8) {
    throw new CorruptedArtifactError(`Buffer too small to contain valid header envelope (length: ${buffer.length})`);
  }

  // 1. Check GGUF Magic
  const magicStr = buffer.toString('ascii', 0, 4);
  if (magicStr === 'GGUF') {
    const version = buffer.readUInt32LE(4);
    if (version < 1 || version > 3) {
      throw new CorruptedArtifactError(`Unsupported GGUF version: ${version}`);
    }
    return {
      format: 'GGUF',
      version,
      headerBytes: 8,
      status: 'VALID'
    };
  }

  // 2. Check Safetensors Format
  const headerSize = Number(buffer.readBigUInt64LE(0));
  if (headerSize <= 0) {
    throw new CorruptedArtifactError(`Invalid Safetensors header size: ${headerSize}`);
  }

  if (headerSize > maxHeaderBytes) {
    throw new HeaderOverflowError(`Safetensors header size (${headerSize} bytes) exceeds safety envelope limit (${maxHeaderBytes} bytes)`);
  }

  if (buffer.length < 8 + headerSize) {
    throw new CorruptedArtifactError(`Truncated Safetensors artifact: Expected ${8 + headerSize} bytes, found ${buffer.length}`);
  }

  // Parse header JSON
  const headerJsonStr = buffer.toString('utf8', 8, 8 + headerSize);
  let metadata;
  try {
    metadata = JSON.parse(headerJsonStr);
  } catch (err) {
    throw new CorruptedArtifactError(`Corrupted Safetensors JSON header: ${err.message}`);
  }

  return {
    format: 'SAFETENSORS',
    headerSize,
    metadataKeys: Object.keys(metadata),
    status: 'VALID'
  };
}

export function run() {
  const log = [];
  log.push('Executing Test 03: Binary Model Artifact Header & Format Verification');

  // 1. Valid GGUF v3 buffer
  const ggufBuf = Buffer.alloc(16);
  ggufBuf.write('GGUF', 0, 4, 'ascii');
  ggufBuf.writeUInt32LE(3, 4); // version 3
  const ggufRes = inspectModelBinaryEnvelope(ggufBuf);
  assert.strictEqual(ggufRes.format, 'GGUF');
  assert.strictEqual(ggufRes.version, 3);
  log.push('  PASS: Valid GGUF v3 header envelope recognized');

  // 2. Valid Safetensors buffer
  const jsonHeader = JSON.stringify({ "__metadata__": { "format": "pt" }, "model.embed_tokens.weight": { "dtype": "F16", "shape": [100, 128] } });
  const jsonBytes = Buffer.from(jsonHeader, 'utf8');
  const safeBuf = Buffer.alloc(8 + jsonBytes.length + 64);
  safeBuf.writeBigUInt64LE(BigInt(jsonBytes.length), 0);
  jsonBytes.copy(safeBuf, 8);
  const safeRes = inspectModelBinaryEnvelope(safeBuf);
  assert.strictEqual(safeRes.format, 'SAFETENSORS');
  assert.strictEqual(safeRes.metadataKeys.includes('__metadata__'), true);
  log.push('  PASS: Valid Safetensors header parsed and validated');

  // 3. Negative Constraint: Buffer < 8 bytes
  assert.throws(() => inspectModelBinaryEnvelope(Buffer.from('TINY')), (err) => {
    return err instanceof CorruptedArtifactError && err.message.includes('too small');
  });
  log.push('  PASS: Truncated buffer under 8 bytes rejected');

  // 4. Negative Constraint: Unsupported GGUF version (e.g. version 99)
  const badGguf = Buffer.alloc(16);
  badGguf.write('GGUF', 0, 4, 'ascii');
  badGguf.writeUInt32LE(99, 4);
  assert.throws(() => inspectModelBinaryEnvelope(badGguf), (err) => {
    return err instanceof CorruptedArtifactError && err.message.includes('Unsupported GGUF version');
  });
  log.push('  PASS: Unsupported GGUF version caught');

  // 5. Negative Constraint: Header Overflow attack prevention (> 25MB header)
  const overflowBuf = Buffer.alloc(16);
  overflowBuf.writeBigUInt64LE(BigInt(50 * 1024 * 1024), 0); // 50MB header claim
  assert.throws(() => inspectModelBinaryEnvelope(overflowBuf), (err) => {
    return err instanceof HeaderOverflowError && err.message.includes('exceeds safety envelope');
  });
  log.push('  PASS: Memory exhaustion attack via header overflow rejected immediately');

  // 6. Negative Constraint: Truncated Safetensors payload
  const truncSafeBuf = Buffer.alloc(16);
  truncSafeBuf.writeBigUInt64LE(BigInt(1024), 0); // claims 1024 bytes header, but buffer is only 16 bytes
  assert.throws(() => inspectModelBinaryEnvelope(truncSafeBuf), (err) => {
    return err instanceof CorruptedArtifactError && err.message.includes('Truncated Safetensors artifact');
  });
  log.push('  PASS: Truncated Safetensors buffer caught before reading memory');

  return {
    candidateId: 'SYNTH-E3-113-CD-8KGR',
    title: 'Binary Artifact Versioning & Format Compatibility Invariant',
    status: 'VERIFIED_INDEPENDENTLY',
    evidenceType: 'BINARY_ENVELOPE_EXECUTION',
    checksPassed: 6,
    checksTotal: 6,
    log
  };
}

