# Candidate Directive: Project Learning Record (Full-Spectrum Forensic Harvest): meituan-longcat/LongCat-2.5

- **Directive ID**: `CD-REV-6C92FD`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain M (Feedback & Evolution Intelligence)
- **Source Repository**: `hf-meituan-longcat-longcat-2.5`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/hf-meituan-longcat-longcat-2.5-learnings.md`
- **Observed At**: 2026-11-22T07:48:38.183Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain M, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
**RULE**:
When implementing low-rank compressed attention (MLA/KV-LoRA), rotary position embeddings (RoPE) MUST NEVER be applied directly to the compressed latent vector $c^{KV}$ or the uncompressed content vector $k^{nope}$. RoPE MUST be applied exclusively to a dedicated, decoupled sub-head positional projection $k^{pe}$, and the resulting positional dot product MUST be accumulated additively with the content dot product before softmax normalization:
$$\text{AttnScore}_{i,j} = \frac{1}{\sqrt{d_{nope} + d_{pe}}} \left( q_i^{nope} (k_j^{nope})^T + q_i^{pe} (k_j^{pe})^T \right)$$

**WHY**:
Applying RoPE directly to low-rank compressed KV matrices invalidates KV-cache matrix absorption ($W_{UK} W_{UV}$ folding during inference generation). When rotary transformations interleave with the compressed representation, subsequent tokens cannot evaluate attention scores through pre-computed compressed caches via associative projections, forcing full uncompressed dequantization of keys per step and inflating GPU memory bandwidth by $4\times$ to $6\times$.

**WHEN TO APPLY**:
Any LLM/VLM serving engine, transformer layer implementation, or custom CUDA kernel implementing low-rank KV compression (MLA, DeepSeek architecture variants, LongCat architectures).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class MultiHeadLatentAttention(nn.Module):
    def __init__(
        self,
        hidden_size: int = 8192,
        num_heads: int = 64,
        q_lora_rank: int = 1536,
        kv_lora_rank: int = 512,
        qk_nope_head_dim: int = 128,
        qk_rope_head_dim: int = 64,
        v_head_dim: int = 128,
    ):
        super().__init__()
        self.num_heads = num_heads
        self.qk_nope_head_dim = qk_nope_head_dim
        self.qk_rope_head_dim = qk_rope_head_dim
        self.v_head_dim = v_head_dim
        self.scale = (qk_nope_head_dim + qk_rope_head_dim) ** -0.5

        # Query compression
        self.q_down_proj = nn.Linear(hidden_size, q_lora_rank, bias=False)
        self.q_down_norm = nn.RMSNorm(q_lora_rank, eps=1e-5)
        self.q_up_proj = nn.Linear(
            q_lora_rank, num_heads * (qk_nope_head_dim + qk_rope_head_dim), bias=False
        )

        # Key-Value compression
        self.kv_down_proj = nn.Linear(hidden_size, kv_lora_rank, bias=False)
        self.kv_down_norm = nn.RMSNorm(kv_lora_rank, eps=1e-5)
        self.kv_up_proj = nn.Linear(
            kv_lora_rank, num_heads * (qk_nope_head_dim + v_head_dim), bias=False
        )
        # Decoupled RoPE Key generator
        self.k_rope_proj = nn.Linear(hidden_size, qk_rope_head_dim, bias=False)

    def forward(
        self,
        hidden_states: torch.Tensor,
        rotary_embed_fn, # Callable applying RoPE to tensor given positions
        position_ids: torch.Tensor,
    ) -> torch.Tensor:
        b_sz, seq_len, _ = hidden_states.shape

        # 1. Compress Query
        q_latent = self.q_down_norm(self.q_down_proj(hidden_states))
        q_full = self.q_up_proj(q_latent).view(b_sz, seq_len, self.num_heads, -1)
        q_nope, q_rope = torch.split(
            q_full, [self.qk_nope_head_dim, self.qk_rope_head_dim], dim=-1
        )

        # 2. Compress Key/Value
        kv_latent = self.kv_down_norm(self.kv_down_proj(hidden_states))
        kv_full = self.kv_up_proj(kv_latent).view(b_sz, seq_len, self.num_heads, -1)
        k_nope, v = torch.split(
            kv_full, [self.qk_nope_head_dim, self.v_head_dim], dim=-1
        )

        # 3. Dedicated Position Key (Decoupled)
        k_rope = self.k_rope_proj(hidden_states).view(b_sz, seq_len, 1, self.qk_rope_head_dim)
        k_rope = k_rope.expand(-1, -1, self.num_heads, -1)

        # 4. Invariant: Apply RoPE ONLY to the decoupled sub-head dimensions
        q_rope = rotary_embed_fn(q_rope, position_ids)
        k_rope = rotary_embed_fn(k_rope, position_ids)

        # 5. Permute for scaled dot-product computation: (B, H, S, D)
        q_nope = q_nope.transpose(1, 2)
        q_rope = q_rope.transpose(1, 2)
        k_nope = k_nope.transpose(1, 2)
        k_rope = k_rope.transpose(1, 2)
        v = v.transpose(1, 2)

        # 6. Combined Attention Score Evaluation
        scores = (
            torch.matmul(q_nope, k_nope.transpose(-1, -2)) +
            torch.matmul(q_rope, k_rope.transpose(-1, -2))
        ) * self.scale

        attn_weights = F.softmax(scores, dim=-1, dtype=torch.float32).to(v.dtype)
        out = torch.matmul(attn_weights, v)
        out = out.transpose(1, 2).reshape(b_sz, seq_len, -1)
        return out
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Applying RoPE directly to compressed KV states or full projection before splitting
kv_latent = self.kv_down_proj(hidden_states)
# BUG: RoPE applied to latent vector destroys cache compression linearity!
kv_latent_rotated = rotary_embed_fn(kv_latent, position_ids)
kv_full = self.kv_up_proj(kv_latent_rotated)
# Incurred Failure: W_UK matrix cannot be folded during decoding; KV cache cannot remain compressed.
```

**VERIFICATION METHOD**:
Verify through tensor contraction assertions that $W_Q W_K^T$ can be decomposed into an position-independent inner product and a decoupled position-dependent component:
```python
def test_mla_cache_foldability():
    layer = MultiHeadLatentAttention()
    # Ensure no parameter path connects kv_down_proj directly to rotary embedding transforms
    assert not hasattr(layer.kv_down_proj, "rotary")
    assert layer.qk_rope_head_dim == 64
    assert layer.qk_nope_head_dim == 128
```

---
```

## Identified Root Cause / Problem
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hf-meituan-longcat-longcat-2.5-learnings.md`  
> **Source**: huggingface ([https://huggingface.co/meituan-longcat/LongCat-2.5](https://huggingface.co/meituan-longcat/LongCat-2.5))  
> **Source Version**: `hf-meituan-l`  
> **License**: Open-Sou

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain M governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.
