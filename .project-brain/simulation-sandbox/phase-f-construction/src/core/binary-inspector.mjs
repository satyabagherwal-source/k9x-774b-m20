/**
 * Agentic Knowledge Gateway: Safe Binary Artifact Inspector Module
 * Grounded in Brain Pattern SYNTH-E3-113-CD-8KGR (from abenzerps/Qwen-Image-2.1-Uncensored-Quantized, commit hf-abenzerps)
 * Re-verified in Phase E.4 (VERIFIED_INDEPENDENTLY)
 */

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
 * Inspects binary buffers to determine whether they represent valid GGUF or Safetensors model artifacts.
 * Enforces strict memory bounds checking: never attempts unconstrained allocations on untrusted buffers.
 */
export function inspectModelBinaryEnvelope(buffer, maxHeaderBytes = 25 * 1024 * 1024) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('Input must be a valid Node.js Buffer');
  }

  if (buffer.length < 8) {
    throw new CorruptedArtifactError(`Buffer too small to contain valid model header (length: ${buffer.length} bytes, minimum required: 8 bytes)`);
  }

  // 1. Check GGUF Magic Header ("GGUF" in ASCII, little-endian: 0x46554747)
  const magicStr = buffer.toString('ascii', 0, 4);
  if (magicStr === 'GGUF') {
    const version = buffer.readUInt32LE(4);
    if (version < 1 || version > 3) {
      throw new CorruptedArtifactError(`Unsupported or invalid GGUF version: ${version} (expected version 1, 2, or 3)`);
    }

    let tensorCount = null;
    let metadataKvCount = null;
    if (buffer.length >= 24) {
      tensorCount = Number(buffer.readBigUInt64LE(8));
      metadataKvCount = Number(buffer.readBigUInt64LE(16));
    }

    return {
      format: 'GGUF',
      version,
      tensorCount,
      metadataKvCount,
      status: 'VALID',
      headerBytes: 8
    };
  }

  // 2. Check Safetensors Format
  // First 8 bytes is an unsigned 64-bit little-endian integer specifying header JSON byte length
  const headerSize = Number(buffer.readBigUInt64LE(0));
  if (headerSize <= 0) {
    throw new CorruptedArtifactError(`Invalid Safetensors header size: ${headerSize}`);
  }

  // Anti-Pattern Defense: Disallow unbounded allocation attempts from malicious payloads
  if (headerSize > maxHeaderBytes) {
    throw new HeaderOverflowError(
      `Safetensors header size (${headerSize} bytes) exceeds safety envelope limit (${maxHeaderBytes} bytes)`
    );
  }

  if (buffer.length < 8 + headerSize) {
    throw new CorruptedArtifactError(
      `Truncated Safetensors artifact: Declared header requires ${8 + headerSize} bytes, but buffer has only ${buffer.length} bytes`
    );
  }

  // Parse header JSON
  const headerJsonStr = buffer.toString('utf8', 8, 8 + headerSize);
  let metadata;
  try {
    metadata = JSON.parse(headerJsonStr);
  } catch (err) {
    throw new CorruptedArtifactError(`Corrupted Safetensors JSON header metadata: ${err.message}`);
  }

  return {
    format: 'SAFETENSORS',
    headerSize,
    metadataKeys: Object.keys(metadata),
    tensorNames: Object.keys(metadata).filter(k => k !== '__metadata__'),
    userMetadata: metadata['__metadata__'] || null,
    status: 'VALID'
  };
}

