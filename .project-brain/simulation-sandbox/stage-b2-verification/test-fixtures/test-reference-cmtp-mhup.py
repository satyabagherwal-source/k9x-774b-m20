"""
STAGE B.2 RUNTIME TEST: CMTP & MHUP Reference Implementation
Candidate ID: CD-ZNND
Source Model: sentence-transformers/all-MiniLM-L6-v2
Framework: Python 3.14 Standard Library (math module)
Execution Mode: INDEPENDENT_REFERENCE_IMPLEMENTATION_TESTED
NOTE: Original PyTorch source execution BLOCKED_BY_DEPENDENCY (torch not installed in host environment).
"""

import sys
import math

print(f"[TEST RUNNER] Python {sys.version.split()[0]} initializing CMTP & MHUP Reference test...")

def mean_pooling_clamped(token_embeddings, attention_mask, epsilon=1e-9):
    # token_embeddings: List of token vectors [SeqLen][Dim]
    # attention_mask: List of integers [SeqLen] (1=token, 0=pad)
    dim = len(token_embeddings[0])
    sum_embeddings = [0.0] * dim
    sum_mask = 0.0

    for token, mask in zip(token_embeddings, attention_mask):
        sum_mask += float(mask)
        for i in range(dim):
            sum_embeddings[i] += token[i] * float(mask)

    # Clamping divisor invariant: max(sum_mask, epsilon)
    clamped_divisor = max(sum_mask, epsilon)
    return [v / clamped_divisor for v in sum_embeddings]

def l2_normalize(vector, epsilon=1e-12):
    norm = math.sqrt(sum(v * v for v in vector))
    safe_norm = max(norm, epsilon)
    return [v / safe_norm for v in vector]

# Test 1: Normal sequence pooling
tokens = [
    [1.0, 2.0, 3.0],
    [4.0, 5.0, 6.0],
    [0.0, 0.0, 0.0] # padding
]
mask = [1, 1, 0]

pooled = mean_pooling_clamped(tokens, mask)
expected = [(1.0 + 4.0) / 2.0, (2.0 + 5.0) / 2.0, (3.0 + 6.0) / 2.0]
for a, b in zip(pooled, expected):
    assert abs(a - b) < 1e-6, f"Mismatch: {a} vs {b}"
print("✅ Test 1 PASSED: Valid tokens correctly aggregated, padded tokens excluded.")

# Test 2: Extreme Boundary - All tokens padded / zero sequence
empty_tokens = [[10.0, 20.0, 30.0], [40.0, 50.0, 60.0]]
empty_mask = [0, 0]

pooled_empty = mean_pooling_clamped(empty_tokens, empty_mask)
for val in pooled_empty:
    assert not math.isnan(val), "NaN detected in empty sequence pooling!"
    assert not math.isinf(val), "Inf detected in empty sequence pooling!"
    assert val == 0.0, f"Expected 0.0, got {val}"
print("✅ Test 2 PASSED: Clamping divisor prevented IEEE 754 division-by-zero NaN.")

# Test 3: MHUP L2 Hypersphere Normalization
vec = [3.0, 4.0, 0.0]
norm_vec = l2_normalize(vec)
norm = math.sqrt(sum(v * v for v in norm_vec))
assert abs(norm - 1.0) < 1e-6, f"Norm is not 1.0: {norm}"
print(f"✅ Test 3 PASSED: Hypersphere projection enforces ||v||_2 = {norm:.6f} == 1.0.")

print("[TEST RUNNER] CMTP & MHUP Reference Implementation test completed with exit code 0.")

