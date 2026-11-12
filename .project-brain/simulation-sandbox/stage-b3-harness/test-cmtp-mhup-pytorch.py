"""
STAGE B.3 REPRODUCIBLE TEST: Sentence Transformers Mean Pooling (CMTP) & Hypersphere Normalization (MHUP)
Target: UKPLab/sentence-transformers (sentence_transformers/models/Pooling.py & Normalize.py)
Runtime: PyTorch CPU in isolated virtual environment
"""

import sys
import os
import time

log_file_path = os.path.join(os.path.dirname(__file__), "actual-execution-logs", "cmtp-mhup-pytorch-execution.log")

def log(msg):
    print(msg)
    with open(log_file_path, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

# Ensure log directory exists
os.makedirs(os.path.dirname(log_file_path), exist_ok=True)
with open(log_file_path, "w", encoding="utf-8") as f:
    f.write(f"=== CMTP & MHUP PYTORCH CPU TEST EXECUTION LOG ===\nDate: {time.strftime('%Y-%m-%d %H:%M:%S')}\nPython: {sys.version}\n\n")

log(f"[INIT] Python {sys.version.split()[0]} loading PyTorch CPU runtime...")

try:
    import torch
    import torch.nn.functional as F
    log(f"[SUCCESS] PyTorch version: {torch.__version__} (Device: cpu)")
except ImportError as e:
    log(f"[FATAL] PyTorch import failed: {e}")
    sys.exit(1)

# TEST SUITE 1: Clamped Masked Temporal Pooling (CMTP Invariant)
log("\n--- TEST SUITE 1: Clamped Masked Temporal Pooling (CMTP) ---")

def execute_sentence_transformers_mean_pooling(token_embeddings: torch.Tensor, attention_mask: torch.Tensor, epsilon: float = 1e-9):
    """
    Executes the exact mean pooling logic implemented in sentence_transformers.models.Pooling
    """
    input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
    sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, 1)
    sum_mask = input_mask_expanded.sum(1)
    # The Invariant under test: clamping divisor before division
    sum_mask = torch.clamp(sum_mask, min=epsilon)
    return sum_embeddings / sum_mask

# Case 1: Standard multi-sequence batch with variable padding
tokens_c1 = torch.tensor([
    [[1.0, 2.0], [3.0, 4.0], [0.0, 0.0]], # seq 1: 2 tokens + 1 pad
    [[5.0, 6.0], [7.0, 8.0], [9.0, 10.0]] # seq 2: 3 tokens
], dtype=torch.float32)

mask_c1 = torch.tensor([
    [1, 1, 0],
    [1, 1, 1]
], dtype=torch.int64)

out_c1 = execute_sentence_transformers_mean_pooling(tokens_c1, mask_c1)
expected_c1 = torch.tensor([[2.0, 3.0], [7.0, 8.0]], dtype=torch.float32)

log(f"Case 1 Output:\n{out_c1}")
assert torch.allclose(out_c1, expected_c1, atol=1e-6), f"Case 1 mismatch: {out_c1} vs {expected_c1}"
log("✅ Case 1 PASSED: Valid tokens correctly averaged, padding tokens masked out to zero.")

# Case 2: Extreme Boundary - All tokens masked / zero sequence
tokens_c2 = torch.tensor([
    [[10.0, 20.0], [30.0, 40.0]]
], dtype=torch.float32)
mask_c2 = torch.tensor([
    [0, 0]
], dtype=torch.int64)

out_c2 = execute_sentence_transformers_mean_pooling(tokens_c2, mask_c2)
log(f"Case 2 Output (All-Masked):\n{out_c2}")
assert not torch.isnan(out_c2).any(), "NaN detected in Case 2!"
assert not torch.isinf(out_c2).any(), "Inf detected in Case 2!"
assert torch.allclose(out_c2, torch.zeros_like(out_c2)), f"Expected zeros, got {out_c2}"
log("✅ Case 2 PASSED: Clamping epsilon successfully prevented division-by-zero NaN.")

# Case 3: Anti-Pattern Comparison (Unclamped division yields NaN)
def unsafe_mean_pooling(token_embeddings: torch.Tensor, attention_mask: torch.Tensor):
    input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
    sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, 1)
    sum_mask = input_mask_expanded.sum(1)
    return sum_embeddings / sum_mask # No clamp!

unsafe_out = unsafe_mean_pooling(tokens_c2, mask_c2)
log(f"Anti-Pattern Output (Unclamped):\n{unsafe_out}")
assert torch.isnan(unsafe_out).any(), "Expected unclamped division to yield NaN!"
log("✅ Case 3 PASSED: Anti-pattern empirically produced NaN, proving necessity of clamp invariant.")


# TEST SUITE 2: Metric Hypersphere Unit Projection (MHUP Invariant)
log("\n--- TEST SUITE 2: Metric Hypersphere Unit Projection (MHUP) ---")

def execute_sentence_transformers_normalize(embeddings: torch.Tensor):
    """
    Executes the exact normalization logic implemented in sentence_transformers.models.Normalize
    """
    return F.normalize(embeddings, p=2, dim=1)

# Case 4: Standard Euclidean projection
unnormalized = torch.tensor([
    [3.0, 4.0, 0.0],
    [1.0, 1.0, 1.0]
], dtype=torch.float32)

normalized = execute_sentence_transformers_normalize(unnormalized)
norms = torch.norm(normalized, p=2, dim=1)
log(f"Normalized Embeddings:\n{normalized}")
log(f"Computed L2 Norms:\n{norms}")

assert torch.allclose(norms, torch.ones_like(norms), atol=1e-6), f"Norms deviation: {norms}"
log("✅ Case 4 PASSED: Embeddings strictly projected onto unit Euclidean hypersphere (||v||_2 = 1.0).")

# Case 5: Cosine Distance Equivalence
# For unit vectors: cosine_similarity(u, v) == dot_product(u, v)
u = normalized[0]
v = normalized[1]
dot_product = torch.dot(u, v)
cosine_sim = F.cosine_similarity(u.unsqueeze(0), v.unsqueeze(0))[0]

log(f"Dot Product: {dot_product.item():.6f}, Cosine Sim: {cosine_sim.item():.6f}")
assert abs(dot_product.item() - cosine_sim.item()) < 1e-6, "Dot product != Cosine similarity on unit sphere!"
log("✅ Case 5 PASSED: Inner product exactly equals cosine distance on hypersphere.")

log("\n[SUMMARY] ALL CMTP & MHUP TESTS COMPLETED SUCCESSFULLY WITH EXIT CODE 0.")

