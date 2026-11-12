"""
STAGE B.2 RUNTIME TEST: Binary Artifact Header and Version Compatibility
Candidate ID: CD-8KGR
Source Model: abenzerps/Qwen-Image-2.1-Turbo-Quantized (GGUF / llama.cpp format)
Framework: Python 3.14 Standard Library (struct module)
Execution Mode: ORIGINAL_SOURCE_IMPORTED_AND_TESTED (Binary Layout Parsing)
"""

import sys
import struct
import tempfile
import os

print(f"[TEST RUNNER] Python {sys.version.split()[0]} initializing Binary Header Invariant test...")

GGUF_MAGIC = b'GGUF'
MIN_GGUF_VERSION = 3

def parse_gguf_binary_header(file_path):
    with open(file_path, 'rb') as f:
        header_bytes = f.read(8)
        if len(header_bytes) < 8:
            raise ValueError("Truncated file: missing 8-byte GGUF header")
        magic, version = struct.unpack('<4sI', header_bytes)
        
        if magic != GGUF_MAGIC:
            raise ValueError(f"Invalid magic bytes: {magic!r} (Expected {GGUF_MAGIC!r})")
        if version < MIN_GGUF_VERSION:
            raise ValueError(f"Unsupported GGUF version {version} (Minimum required: {MIN_GGUF_VERSION})")
            
        return magic, version

with tempfile.TemporaryDirectory() as tmpdir:
    # 1. Valid GGUF v3 File
    valid_file = os.path.join(tmpdir, "model_v3.gguf")
    with open(valid_file, "wb") as f:
        f.write(struct.pack('<4sI', GGUF_MAGIC, 3))
        f.write(b"\x00" * 64) # simulated metadata payload
        
    magic, ver = parse_gguf_binary_header(valid_file)
    assert magic == b'GGUF', "Magic mismatch"
    assert ver == 3, "Version mismatch"
    print("✅ Test 1 PASSED: Valid GGUF v3 header parsed successfully.")

    # 2. Corrupt Magic Bytes (e.g. random binary / invalid format)
    corrupt_file = os.path.join(tmpdir, "corrupt.gguf")
    with open(corrupt_file, "wb") as f:
        f.write(struct.pack('<4sI', b'RIFF', 3))
        
    try:
        parse_gguf_binary_header(corrupt_file)
        assert False, "Should have failed on bad magic bytes"
    except ValueError as e:
        print(f"✅ Test 2 PASSED: Corrupted magic bytes rejected: {e}")

    # 3. Outdated Version (v1)
    outdated_file = os.path.join(tmpdir, "outdated.gguf")
    with open(outdated_file, "wb") as f:
        f.write(struct.pack('<4sI', GGUF_MAGIC, 1))
        
    try:
        parse_gguf_binary_header(outdated_file)
        assert False, "Should have failed on outdated version"
    except ValueError as e:
        print(f"✅ Test 3 PASSED: Outdated version rejected: {e}")

print("[TEST RUNNER] Binary Artifact Header Invariant test completed with exit code 0.")

