"""
STAGE B.2 RUNTIME TEST: Ternary LUT Unpacking Reference Implementation
Candidate ID: CD-UV2I
Source Model: prism-ml/Ternary-Bonsai-2-27B-gguf
Framework: Python 3.14 Standard Library (array module)
Execution Mode: INDEPENDENT_REFERENCE_IMPLEMENTATION_TESTED
NOTE: Original CUDA kernel execution BLOCKED_BY_DEPENDENCY (nvcc / GPU not available in host environment).
"""

import sys
import array

print(f"[TEST RUNNER] Python {sys.version.split()[0]} initializing Ternary LUT Reference test...")

# Lookup Table: 00 -> -1.0, 01 -> 0.0, 10 -> 1.0, 11 -> 0.0 (padding)
TRIT_LUT = array.array('f', [-1.0, 0.0, 1.0, 0.0])

def dequant_trit_lut(packed_byte, index):
    code = (packed_byte >> (index * 2)) & 0b11
    return TRIT_LUT[code]

# Packed byte: 0b10_01_00_10 (trit3=2->1.0, trit2=1->0.0, trit1=0->-1.0, trit0=2->1.0)
packed = 0b10010010

t0 = dequant_trit_lut(packed, 0)
t1 = dequant_trit_lut(packed, 1)
t2 = dequant_trit_lut(packed, 2)
t3 = dequant_trit_lut(packed, 3)

assert t0 == 1.0, f"Expected 1.0, got {t0}"
assert t1 == -1.0, f"Expected -1.0, got {t1}"
assert t2 == 0.0, f"Expected 0.0, got {t2}"
assert t3 == 1.0, f"Expected 1.0, got {t3}"

print(f"✅ Test 1 PASSED: LUT correctly unpacked byte 0x{packed:02X} into trits [{t0}, {t1}, {t2}, {t3}].")
print("[TEST RUNNER] Ternary LUT Reference Implementation test completed with exit code 0.")

