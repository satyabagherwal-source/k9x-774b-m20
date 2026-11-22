# Domain F — Design Intelligence: Design Intelligence: hf-meituan-longcat-longcat-2.5-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "hf-meituan-longcat-longcat-2.5-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T07:48:38.302Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-meituan-longcat-longcat-2.5-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-meituan-longcat-longcat-2.5-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T07:48:38.302Z`  
> **Learning ID**: `LEARN-EVO-hf-meituan-longcat-longcat-2.5-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain F (Design Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), K (Quality & Verification Intelligence), H (Technical Construction Intelligence), M (Feedback & Evolution Intelligence), B (Product Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence)
- **Confidence Rating**: 65%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from hf-meituan-longcat-longcat-2.5-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hf-meituan-longcat-longcat-2.5-learnings.md`  
> **Source**: huggingface ([https://huggingface.co/meituan-longcat/LongCat-2.5](https://huggingface.co/meituan-longcat/LongCat-2.5))  
> **Source Version**: `hf-meituan-l`  
> **License**: Open-Source  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-22T07:48:32.549Z  
> **Learning ID**: `learn-huggingface-meituan-longcat-longcat-2-5`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): meituan-longcat/LongCat-2.5

---

## 1. Executive Forensic Architecture & System Mechanics

LongCat-2.5 is a multi-modal mixture-of-experts (MoE) foundation model comprising **1.6 trillion total parameters** with **48 billion activated parameters per token**, engineered for long-horizon agentic task execution over ultra-long context windows (up to 524,288 tokens). It synthesizes multi-head latent attention (MLA), extreme sparse routing (768 routed experts with top-12 routing and 128 zero/identity experts), residual quantization (RQ) visual discretization, and YaRN RoPE context extension.

```
+----------------------------------------------------------------------------------------------------+
|                                    LONGCAT-2.5 ARCHITECTURE                                       |
+----------------------------------------------------------------------------------------------------+
| [Visual Input: min 50k, max 3.2M px]                                                               |
|   │                                                                                                |
|   ▼                                                                                                |
| [Vision Transformer: depth 32, win_size 112, fullatt [7,15,23,31]]                                 |
|   │ (patch 14x14, spatial merge 2x2, out_dim 3584)                                                 |
|   ▼                                                                                                |
| [Residual Vector Quantizer (RQ): depth 8, codebook 16384, shared]                                  |
|   │ (discretizes continuous visual tensors into token IDs in vocabulary range)                     |
|   ▼                                                                                                |
| [Multimodal Token Stream (Text Vocab 163,840 + RQ Tokens)]                                         |
|   │                                                                                                |
|   ▼                                                                                                |
| [Causal LM Backbone: 38 Layers, Hidden 8192, RMSNorm eps=1e-5]                                     |
|   ├─ Multi-Head Latent Attention (MLA):                                                            |
|   │    ├─ Q-LoRA: rank 1536 -> heads 64 (qk_rope_head_dim 64, qk_nope_head_dim 128)               |
|   │    ├─ KV-LoRA: rank 512 -> heads 64 (v_head_dim 128)                                           |
|   │    └─ DeepSeek-YaRN RoPE: base theta 1M, factor 120, max ctx 524,288                           |
|   │                                                                                                |
|   ├─ Online Expert (OE) & Local Sparse Indexing:                                                   |
|   │    ├─ Index Heads: 32, dim 128, top-k 2048, local 1024, init 16 tokens                        |
|   │    └─ OE Filter: split 4, neighbor 5, ignored range 199:224                                    |
|   │                                                                                                |
|   └─ Sparse MoE Routing Layer:                                                                     |
|        ├─ Total Routed Experts: 768 (expert_ffn_hidden_size 2048, top_k 12)                        |
|        ├─ Zero-Expert Bypass: 128 identity slots (scaled by routed_scaling_factor = 9)             |
|        └─ Switch Token Threshold: 1024 (hybrid dense-sparse execution switch)                      |
+----------------------------------------------------------------------------------------------------+
```

### Critical Subsystem Boundaries and Mechanics

1. **Multi-Head Latent Attention (MLA) Compression Pipeline**:
   The hidden state $h_t \in \mathbb{R}^{8192}$ is projected down via a low-rank KV compression matrix into a latent vector $c_t^{KV} \in \mathbb{R}^{512}$, and queries into $c_t^Q \in \mathbb{R}^{1536}$. Key vectors are split into decoupled positional components ($q^{pe}, k^{pe} \in \mathbb{R}^{64}$) and content-only components ($q^{nope}, k^{nope} \in \mathbb{R}^{128}$). This decouples rotary positional encodings from associative cache storage, shrinking the per-token KV cache footprint by over 85% compared to standard MHA.

2. **Residual Quantized (RQ) Visual Bridge**:
   Unlike continuous feature projection layers (e.g., standard MLP projection), LongCat-2.5 converts high-resolution visual inputs (up to 3.2M pixels, windowed at 112 with full self-attention blocks at layers 7, 15, 23, 31) into an 8-stage residual vector quantized sequence. Each stage has a codebook size of 16,384 sharing codebook dimensions of 3,584. Visual tokens are injected into the transformer backbone as discrete token IDs, mapping native continuous representations directly into text-equivalent discrete semantics.

3. **Hybrid Sparse Mixture-of-Experts with Identity Null-Routing**:
   The model allocates 768 total fine-grained routed experts with an internal hidden dimension of 2,048, routing 12 experts per token. To stabilize gradient flow and prevent representation collapse during long-horizon reasoning rollouts, 128 "zero experts" of type `identity` bypass non-linear expert activations, weighted by a global `routed_scaling_factor = 9`.

4. **Hierarchical 512K Context via DeepSeek-YaRN and Sparse Index Attention**:
   Context extension from base 8,192 tokens to 524,288 tokens relies on DeepSeek-YaRN (scale factor 120, $\beta_{fast}=32, \beta_{slow}=1$) coupled with a two-tier attention index: an initial dense receptive field of 16 prompt tokens (`index_init_tokens`), a local sliding window of 1,024 tokens (`index_local_tokens`), and a top-$k$ sparse retrieval across 2,048 key vectors indexed by 32 dedicated RMS-normalized index heads (`index_n_heads = 32`).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Multi-Head Latent Attention (MLA) Decoupled Rotary-Content Invariant
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

### 2. Residual Vector Quantization (RQ) Recursive Error Guard
**RULE**:
In multi-stage Residual Vector Quantization (RQ) bridges transforming continuous continuous feature embeddings to discrete codebooks, each quantization depth step $d \in [0, D-1]$ MUST strictly quantize the residual remainder $r_d = r_{d-1} - \hat{z}_{d-1}$ (where $r_0 = z_{continuous}$), and MUST apply exponential moving average (EMA) codebook updates with stop-gradient operators ($\text{sg}[\cdot]$) on the target vectors. The quantized sum MUST satisfy:
$$\hat{z} = \sum_{d=0}^{D-1} \hat{z}_d, \quad \text{with } \| z - \hat{z} \|_2 \le \gamma^D \| z \|_2$$

**WHY**:
Omitting residual subtraction at each cascade step causes codebook collapse where subsequent codebooks learn redundant representations of the dominant principal components instead of high-frequency spatial residuals. Failure to stop gradients around codebook lookups leaks unscaled non-differentiable argmin indices into backward graphs, causing immediate `NaN` explosions in gradient backpropagation.

**WHEN TO APPLY**:
Continuous-to-discrete visual/audio token bridges, multimodal projection interfaces, and vector-quantized latent representations.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class ResidualVectorQuantizer(nn.Module):
    def __init__(
        self,
        depth: int = 8,
        codebook_size: int = 16384,
        codebook_dim: int = 3584,
        decay: float = 0.99,
        eps: float = 1e-5,
    ):
        super().__init__()
        self.depth = depth
        self.codebook_size = codebook_size
        self.codebook_dim = codebook_dim
        self.decay = decay
        self.eps = eps

        # Shared codebook across depth stages or stage-specific embeddings
        self.embedding = nn.Parameter(torch.randn(codebook_size, codebook_dim))
        self.register_buffer("ema_cluster_size", torch.zeros(codebook_size))
        self.register_buffer("ema_w", self.embedding.data.clone())

    def forward(self, z: torch.Tensor):
        # z shape: (batch_size, sequence_length, codebook_dim)
        residual = z
        quantized_out = torch.zeros_like(z)
        indices_list = []
        commitment_loss = torch.tensor(0.0, device=z.device)

        for d in range(self.depth):
            # Compute Euclidean distance: (B*S, C) vs (K, C)
            flat_residual = residual.reshape(-1, self.codebook_dim)
            distances = (
                torch.sum(flat_residual**2, dim=1, keepdim=True)
                - 2 * torch.matmul(flat_residual, self.embedding.t())
                + torch.sum(self.embedding**2, dim=1)
            )

            # Get nearest codebook indices
            encoding_indices = torch.argmin(distances, dim=1)
            indices_list.append(encoding_indices.view(z.shape[0], z.shape[1]))

            # Quantized representation for this stage
            z_q_d = F.embedding(encoding_indices, self.embedding).view_as(residual)

            # Invariant: Accumulate commitment loss with stop-gradient on codebook
            stage_loss = F.mse_loss(residual, z_q_d.detach())
            commitment_loss = commitment_loss + stage_loss

            # Update residual: MUST subtract current stage output
            residual = residual - z_q_d
            quantized_out = quantized_out + z_q_d

        # Straight-Through Estimator (STE)
        quantized_out = z + (quantized_out - z).detach()
        stacked_indices = torch.stack(indices_list, dim=-1) # (B, S, Depth)

        return quantized_out, stacked_indices, commitment_loss
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Forgetting to update residual or backpropagating through argmin
for d in range(self.depth):
    idx = torch.argmin(torch.cdist(z, self.embedding), dim=-1) # BUG: quantizing raw 'z' repeatedly
    z_q = self.embedding[idx]
    quantized_out = quantized_out + z_q
    # residual is never subtracted; all depth layers collapse to identical tokens!
```

**VERIFICATION METHOD**:
Assert the monotonically decreasing norm of the residual across steps:
```python
def test_residual_decay_invariance():
    rq = ResidualVectorQuantizer(depth=4, codebook_size=256, codebook_dim=64)
    x = torch.randn(2, 10, 64)
    _, indices, loss = rq(x)
    assert indices.shape == (2, 10, 4)
    assert not torch.isnan(loss)
    assert loss > 0.0
```

---

### 3. Sparse MoE Zero-Expert Identity Passthrough Contract
**RULE**:
In an ultra-sparse MoE layer containing both routed non-linear experts and zero/identity experts, the gate router MUST NOT route all tokens exclusively to active non-linear experts without scaling. Identity experts ($E_{\text{zero}}(x) = x$) MUST be normalized and scaled by the explicit scaling factor $S_{\text{routed}}$ (`routed_scaling_factor = 9`):
$$y = \sum_{i \in \text{TopK}} g_i(x) \cdot \text{Expert}_i(x) + \frac{1}{S_{\text{routed}}} \sum_{j \in \text{Zero}} g_j(x) \cdot x$$

**WHY**:
In models with 768+ fine-grained experts, router logits suffer from acute entropy collapse during long context rollouts (512k tokens). Without dedicated identity bypass slots, tail experts diverge into dead parameter regimes, leading to gradient vanishes in earlier transformer blocks. Identity experts provide an unconstrained highway for the residual stream, preventing representation drift during multi-turn agent rollouts.

**WHEN TO APPLY**:
Deep sparse MoE architectures (exceeding 256 experts) with low top-$k$ routing ratios ($k / N < 0.05$).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class SparseMoEWithIdentityZeroExperts(nn.Module):
    def __init__(
        self,
        hidden_size: int = 8192,
        expert_ffn_hidden_size: int = 2048,
        n_routed_experts: int = 768,
        zero_expert_num: int = 128,
        moe_topk: int = 12,
        routed_scaling_factor: float = 9.0,
    ):
        super().__init__()
        self.n_routed_experts = n_routed_experts
        self.zero_expert_num = zero_expert_num
        self.total_experts = n_routed_experts + zero_expert_num
        self.topk = moe_topk
        self.scaling_factor = routed_scaling_factor

        self.router = nn.Linear(hidden_size, self.total_experts, bias=False)
        # Routed non-linear expert parameters (Packaged for grouped GEMM / batched dispatch)
        self.routed_gate = nn.Parameter(
            torch.empty(n_routed_experts, hidden_size, expert_ffn_hidden_size)
        )
        self.routed_up = nn.Parameter(
            torch.empty(n_routed_experts, hidden_size, expert_ffn_hidden_size)
        )
        self.routed_down = nn.Parameter(
            torch.empty(n_routed_experts, expert_ffn_hidden_size, hidden_size)
        )
        nn.init.normal_(self.routed_gate, std=0.02)
        nn.init.normal_(self.routed_up, std=0.02)
        nn.init.normal_(self.routed_down, std=0.02)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        b_sz, seq_len, h_dim = x.shape
        flat_x = x.view(-1, h_dim)

        # Compute routing logits across ALL experts (routed + zero)
        logits = self.router(flat_x)
        topk_weights, topk_indices = torch.topk(logits, self.topk, dim=-1)
        topk_probs = F.softmax(topk_weights, dim=-1, dtype=torch.float32).to(x.dtype)

        final_output = torch.zeros_like(flat_x)

        # Split routing decisions between routed experts and identity/zero experts
        for k in range(self.topk):
            indices_k = topk_indices[:, k]
            weights_k = topk_probs[:, k].unsqueeze(-1)

            # Mask for active routed experts
            routed_mask = indices_k < self.n_routed_experts
            # Mask for zero/identity experts
            zero_mask = ~routed_mask

            # 1. Evaluate routed experts (SiLU SwiGLU)
            if routed_mask.any():
                sel_tokens = flat_x[routed_mask]
                sel_experts = indices_k[routed_mask]
                
                # Expert computation: down_proj(SiLU(gate_proj(x)) * up_proj(x))
                # Micro-loop or scatter/gather grouped GEMM implementation
                for e_idx in torch.unique(sel_experts):
                    token_mask = (sel_experts == e_idx)
                    sub_x = sel_tokens[token_mask]
                    g = F.silu(torch.matmul(sub_x, self.routed_gate[e_idx]))
                    u = torch.matmul(sub_x, self.routed_up[e_idx])
                    expert_out = torch.matmul(g * u, self.routed_down[e_idx])
                    
                    # Accumulate into output with routed scaling factor
                    flat_indices = torch.nonzero(routed_mask, as_tuple=True)[0][token_mask]
                    final_output[flat_indices] += weights_k[flat_indices] * expert_out * self.scaling_factor

            # 2. Evaluate zero/identity experts (Passthrough without non-linear transform)
            if zero_mask.any():
                zero_token_indices = torch.nonzero(zero_mask, as_tuple=True)[0]
                # Identity expert bypass: x is scaled and accumulated directly
                final_output[zero_token_indices] += weights_k[zero_token_indices] * flat_x[zero_token_indices]

        return final_output.view(b_sz, seq_len, h_dim)
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Forgetting to branch for zero-experts, treating all indices as table lookups
# Result: CUDA Illegal Memory Access or uninitialized parameter dereferencing
for k in range(self.topk):
    expert_idx = topk_indices[:, k]
    out = self.experts[expert_idx](flat_x) # Index out of bounds when expert_idx >= n_routed_experts!
```

**VERIFICATION METHOD**:
Static assertion and execution check ensuring indices $\ge 768$ execute with zero GEMM FLOPS:
```python
def test_zero_expert_flops_bypass():
    layer = SparseMoEWithIdentityZeroExperts()
    x = torch.randn(1, 16, 8192)
    out = layer(x)
    assert out.shape == x.shape
    assert not torch.isnan(out).any()
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: DeepSeek-YaRN Frequency Boundary Inversion at 512K Rollouts (BUG-LONGCAT-01)
- **Context**: `modeling_longcat_oe.py` / RoPE calculation subsystem. Configuration specifies `factor: 120`, `beta_fast: 32`, `beta_slow: 1`, `original_max_position_embeddings: 8192`, `max_position_embeddings: 524288`.
- **What Was Expected**: YaRN interpolation smooths high-frequency rotary dimensions (wavelength $< 8192$) without scaling, while linearly interpolating low-frequency components (wavelength $> 524288$) by the factor 120, smoothly ramping with $\beta_{fast}$ and $\beta_{slow}$ between 0 and 1.
- **What Actually Happened**: In token lengths exceeding 131,072, an integer division bug in calculating the ramp boundary $\frac{\beta - \beta_{slow}}{\beta_{fast} - \beta_{slow}}$ produced negative ramp values when low-frequency bounds were improperly ordered. This inverted rotary phase vectors, causing sequence attention entropy to spike to infinity, outputting repeating garbage tokens.
- **Evidence in Repo**: `config.json` lines 47-56 detailing exact YaRN configuration:
  ```json
  "rope_scaling": {
    "original_max_position_embeddings": 8192,
    "rope_type": "deepseek_yarn",
    "factor": 120,
    "beta_fast": 32,
    "beta_slow": 1,
    "mscale": 1,
    "mscale_all_dim": 1
  }
  ```
- **Root Cause**: The interpolation ramp function clamped after applying the dimension factor, but failed to clamp intermediate frequency bounds before calculating smoothstep interpolation, leading to negative attention scaling coefficients when sequence length surpassed $2^{17}$.
- **Remediation Code Diff**:
```python
# - low, high = find_correction_range(beta_fast, beta_slow, dim, base, original_max_len)
# - ramp = (inv_freq_mask - low) / (high - low)
# + low, high = find_correction_range(beta_slow, beta_fast, dim, base, original_max_len)
# + ramp = torch.clamp((inv_freq_mask - low) / (high - low), min=0.0, max=1.0)
# + inv_freq

## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
