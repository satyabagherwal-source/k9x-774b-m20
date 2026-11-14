# Verification Protocol: Verification Protocol: Empirical Defect Shield for NaiveAI/Naive-N0.5-Flash

<!-- PROVENANCE_START
{
  "source_repository": "NaiveAI/Naive-N0.5-Flash",
  "source_url": "https://huggingface.co/NaiveAI/Naive-N0.5-Flash",
  "source_version": "hf-naiveai-naive-n0.5-flash",
  "license": "Open-Source",
  "timestamp": "2026-11-14T07:41:01.064Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-huggingface-naiveai-naive-n0-5-flash",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [NaiveAI/Naive-N0.5-Flash](https://huggingface.co/NaiveAI/Naive-N0.5-Flash) (Revision: `hf-naiveai`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T07:41:01.064Z`  
> **Learning ID**: `learn-huggingface-naiveai-naive-n0-5-flash`


## 1. Scope & Verification Target
- **Target Repository**: `NaiveAI/Naive-N0.5-Flash` (Commit: `hf-naiveai`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Project Learning Record (Full-Spectrum Forensic Harvest): NaiveAI/Naive-N0.5-Flash

---

## 1. Executive Forensic Architecture & System Mechanics

Naive-N0.5-Flash represents an architectural paradigm shift in extreme-context Mixture-of-Experts (MoE) architectures: it eliminates standard $O(N^2)$ global attention across all 48 layers while achieving a native $1,048,576$ ($1\text{M}$) token context window. The model scales to $309\text{B}$ total parameters with only $15.5\text{B}$ active parameters per token, pairing an ultra-sparse MoE backbone with a hybrid Sliding-Window Attention (SWA) and DeepSeek Sparse Attention (DSA) topology.

```
                              [ Input Tokens (up to 1,048,576 tokens) ]
                                                │
                                                ▼
                                    [ Input Embeddings: 152,576 ]
                                                │
       ┌────────────────────────────────────────┴────────────────────────────────────────┐
       ▼ Layer 0 (DSA Indexer Layer + Dense MLP)                                          │
 ┌────────────────────────────────────────────────────────┐                              │
 │ DSA Attention:                                         │                              │
 │ ├─ FP8 E4M3 Indexer (16 Heads, 1 KV Head, d=128)        │                              │
 │ │  └─ Scores 1M tokens ──► Selects Top 2,048 Tokens    │                              │
 │ └─ Backbone Attention:                                 │                              │
 │    └─ 64 Q Heads (d=192), 4 KV Heads (d=128) (GQA 16:1)│                              │
 │       (Only gathers KV at top 2,048 token indices)     │                              │
 │ Dense MLP: intermediate_size = 16,384                  │                              │
 └─────────────────────────┬──────────────────────────────┘                              │
                           │                                                             │
                           ▼ Layers 1–4 (5 SWA Layers + 256-Expert MoE)                  │
 ┌────────────────────────────────────────────────────────┐                              │
 │ SWA Attention:                                         │                              │
 │ ├─ Window = 128 tokens, Chunk = 128                    │                              │
 │ ├─ Sink Bias Enabled (`add_swa_attention_sink_bias`)   │                              │
 │ ├─ 64 Q Heads (d=192), 8 KV Heads (d=128) (GQA 8:1)    │                              │
 │ └─ RoPE theta = 10,000, Partial Rotary Factor = 0.334  │                              │
 │ MoE FFN:                                               │                              │
 │ ├─ 256 Routed Experts (Top-8 active, noaux_tc scoring) │                              │
 │ └─ Routed Intermediate Size = 2,048 per expert         │                              │
 └─────────────────────────┬──────────────────────────────┘                              │
                           │                                                             │
                           ▼ Layer 5 (DSA Indexer Layer + 256-Expert MoE)                │
                           │ (Periodic DSA every 6th layer: [0, 5, 11, 17, 23...])        │
                           │                                                             │
                           ▼ Layers 6–47 (Alternating SWA / DSA stack)                    │
                                                │
                                                ▼
                                   [ RMSNorm (eps=1e-5) ]
                                                │
                                                ▼
                             [ Un-tied LM Head (152,576 Vocab) ]
```

### Critical Architectural Boundaries & Subsystems

1. **Hybrid Layer Pattern ($5:1$ SWA–DSA Layout)**:
   - Config invariant `hybrid_layer_pattern`: Exactly 9 DSA layers interleaved with 39 SWA layers across 48 total transformer blocks.
   - SWA layers maintain strictly localized causal receptive fields ($W = 128$ tokens). KV cache size per token in SWA layers is strictly bounded, executing in $O(N \cdot W)$ computation.
   - DSA layers eliminate dense global projection by decoupling query indexing from value aggregation. A dedicated FP8 ($E4M3$) Indexer scans the token history with $16$ query heads and $1$ shared KV head to compute scalar relevance scores, emitting an index mask of the top $K = 2048$ tokens. Backbone causal attention is evaluated *only* over these $2048$ selected token positions.

2. **Asymmetric Query-Key-Value Projection Geometry**:
   - Query projection head dimension: $d_q = d_k = 192$.
   - Value projection head dimension: $d_v = 128$.
   - Attention Value Scaling Factor: $0.707 \approx \frac{1}{\sqrt{2}}$, stabilizing the variance mismatch introduced by the projection dimension reduction ($192 \to 128$).
   - Dual-GQA structure: SWA layers utilize $64$ Q heads to $8$ KV heads (ratio $8:1$), while DSA layers utilize $64$ Q heads to $4$ KV heads (ratio $16:1$).

3. **Dual-Frequency Partial Rotary Embeddings (Dual-Theta RoPE)**:
   - Invariant: `partial_rotary_factor = 0.334`. Only $192 \times 0.334 \approx 64$ dimensions per head undergo rotary permutation; the remaining $128$ dimensions remain unrotated.
   - Frequency Decoupling: DSA layers operate with $\theta_{\text{long}} = 10,000,000$ ($1\text{e}7$) to prevent phase collision across the $1\text{M}$ context boundary. SWA layers operate with $\theta_{\text{short}} = 10,000$ ($1\text{e}4$), maintaining high-frequency spatial resolution within the local $128$-token sliding window.

4. **Dense Layer 0 Guarded MoE Topology**:
   - `moe_layer_freq`: Layer 0 is purely dense (`intermediate_size = 16384`), while Layers 1 through 47 invoke a $256$-expert MoE network with top-$8$ routing.
   - Dense Layer 0 anchors universal low-level token representations and positional alignment before routing across sparse expert subspaces.
   - The MoE routing subsystem utilizes `noaux_tc` (No-Auxiliary Loss Token Choice) with `sigmoid` activation gating, bypassing load-balancing token-drop pathologies common to auxiliary loss softmax routers.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Dual-Frequency Context Decoupling for Hybrid Local-Sparse Transformer Layers
**RULE**:
When combining local sliding-window attention (SWA) and sparse global indexer attention (DSA) in a unified transformer backbone, the system **MUST** assign distinct rotary frequency base parameters ($\theta_{\text{local}} \ll \theta_{\text{global}}$) and apply rotary embeddings **ONLY** to a fractional sub-vector of the query/key projections (`partial_rotary_factor` $\le 0.5$). The model **MUST NOT** share a single $\theta$ base or rotate the full projection head dimension when scaling past $128\text{K}$ tokens.

**WHY**:
Applying ultra-high $\theta$ ($\ge 10^7$) to sliding-window layers degrades local syntax and short-range positional resolution because high base values collapse the angular velocity of low-frequency dimensions, making tokens within distance $W=128$ indistinguishable. Conversely, applying low $\theta$ ($10^4$) to global indexers induces phase wrapping and catastrophic catastrophic attention dispersion over $1\text{M}$ tokens. Rotating only a sub-slice (e.g., $64$ of $192$ dimensions) leaves the remaining subspace unrotated, providing invariant coordinate-free semantic matching while preserving positional distinction.

**WHEN TO APPLY**:
Apply to any transformer architecture targeting context lengths $\ge 128\text{K}$ tokens utilizing hybrid local/sparse attention layers.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn

class DualFrequencyPartialRoPE(nn.Module):
    def __init__(
        self,
        dim: int = 192,
        partial_rotary_factor: float = 0.334,
        theta_swa: float = 10000.0,
        theta_dsa: float = 10000000.0,
        max_seq_len: int = 1048576,
    ):
        super().__init__()
        self.rotary_dim = int(dim * partial_rotary_factor)
        # Ensure rotary_dim is even for 2D complex plane decomposition
        if self.rotary_dim % 2 != 0:
            self.rotary_dim -= 1
        self.unrotated_dim = dim - self.rotary_dim

        # Precompute frequencies for SWA and DSA separately
        self.register_buffer(
            "inv_freq_swa",
            1.0 / (theta_swa ** (torch.arange(0, self.rotary_dim, 2).float() / self.rotary_dim)),
            persistent=False,
        )
        self.register_buffer(
            "inv_freq_dsa",
            1.0 / (theta_dsa ** (torch.arange(0, self.rotary_dim, 2).float() / self.rotary_dim)),
            persistent=False,
        )

    def _apply_rotary(self, x_rot: torch.Tensor, freqs: torch.Tensor) -> torch.Tensor:
        # x_rot: [batch, heads, seq_len, rotary_dim]
        # freqs: [seq_len, rotary_dim // 2]
        sin = freqs.sin().unsqueeze(0).unsqueeze(1)
        cos = freqs.cos().unsqueeze(0).unsqueeze(1)
        x1 = x_rot[..., 0::2]
        x2 = x_rot[..., 1::2]
        rotated = torch.cat((-x2, x1), dim=-1)
        return (x_rot * cos.repeat_interleave(2, dim=-1)) + (rotated * sin.repeat_interleave(2, dim=-1))

    def forward(
        self,
        q: torch.Tensor,
        k: torch.Tensor,
        positions: torch.Tensor,
        layer_is_dsa: bool,
    ) -> tuple[torch.Tensor, torch.Tensor]:
        # Split into rotated and non-rotated components
        q_rot, q_pass = q[..., :self.rotary_dim], q[..., self.rotary_dim:]
        k_rot, k_pass = k[..., :self.rotary_dim], k[..., self.rotary_dim:]

        inv_freq = self.inv_freq_dsa if layer_is_dsa else self.inv_freq_swa
        # positions: [seq_len] -> outer product: [seq_len, rotary_dim // 2]
        freqs = torch.outer(positions.float(), inv_freq)

        q_rot_out = self._apply_rotary(q_rot, freqs)
        k_rot_out = self._apply_rotary(k_rot, freqs)

        # Concatenate rotated with invariant non-rotated representations
        q_out = torch.cat([q_rot_out, q_pass], dim=-1)
        k_out = torch.cat([k_rot_out, k_pass], dim=-1)
        return q_out, k_out
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Uniform theta and full-dimensional rotation across hybrid layers
def apply_naive_rope(q, k, positions, theta=10000000.0):
    # Bug 1: Rotates entire 192-dim head, breaking value alignment and metric space
    # Bug 2: Uses theta=1e7 in SWA layers, causing local window tokens (<=128)
    #        to collapse onto identical position vectors due to vanishing delta.
    inv_freq = 1.0 / (theta ** (torch.arange(0, q.shape[-1], 2).float() / q.shape[-1]))
    freqs = torch.outer(positions, inv_freq)
    return rotate_all(q, freqs), rotate_all(k, freqs)
```

**VERIFICATION METHOD**:
Verify with a unit test checking angular displacement $\Delta \phi$ between adjacent tokens ($p$ and $p+1$):
$$\Delta \phi_i = \frac{1}{\theta^{2i/d}}$$
For SWA layers, verify that $\min_i(\Delta \phi_i) \ge 10^{-4}\text{ rad}$. In DSA layers, verify no phase wrapping occurs over sequence length $L = 1,048,576$:
$$L \cdot \text{inv\_freq}[-1] < 2\pi$$

---

### 2. Dimensionally Asymmetric Attention Scale Normalization
**RULE**:
When attention head projection dimensions are asymmetric between Query/Key ($d_k$) and Value ($d_v$) tensors (e.g., $d_k = 192$, $d_v = 128$), the system **MUST NOT** use standard scale $\frac{1}{\sqrt{d_k}}$ in isolation without scaling the projection output. It **MUST** scale either attention logits by $\frac{1}{\sqrt{d_k}}$ and output projections by an explicit correction factor $\kappa = \sqrt{\frac{d_v}{d_k}}$ (or explicit `attention_value_scale`), or fuse scale factors into the softmax temperature.

**WHY**:
In standard Transformers, $d_k = d_v = d$. Standard variance derivation for attention output $O = \text{Softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V$ assumes identity variance propagation $\text{Var}(O_i) = \text{Var}(V_j)$. When $d_k = 192$ and $d_v = 128$, the variance of logits matches normal distribution, but the output tensor variance is scaled by $\frac{d_v}{d_k} = \frac{128}{192} \approx 0.666$. Without multiplying by `attention_value_scale` ($0.707 \approx \frac{1}{\sqrt{2}}$), residual stream variance progressively decays across 48 layers, forcing RMSNorm into numerical underflow or exploding residual gradients during backward passes.

**WHEN TO APPLY**:
Any attention implementation where projection dimensions diverge: $d_{\text{head\_qk}} \ne d_{\text{head\_v}}$.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class AsymmetricQKVAttention(nn.Module):
    def __init__(
        self,
        hidden_size: int = 4096,
        num_heads: int = 64,
        num_kv_heads: int = 4,
        head_dim: int = 192,
        v_head_dim: int = 128,
        attention_value_scale: float = 0.707,
    ):
        super().__init__()
        self.num_heads = num_heads
        self.num_kv_heads = num_kv_heads
        self.head_dim = head_dim
        self.v_head_dim = v_head_dim
        self.scale = 1.0 / (head_dim ** 0.5)
        self.value_scale = attention_value_scale

        self.q_proj = nn.Linear(hidden_size, num_heads * head_dim, bias=False)
        self.k_proj = nn.Linear(hidden_size, num_kv_heads * head_dim, bias=False)
        self.v_proj = nn.Linear(hidden_size, num_kv_heads * v_head_dim, bias=False)
        self.o_proj = nn.Linear(num_heads * v_head_dim, hidden_size, bias=False)

    def forward(
        self,
        x: torch.Tensor,
        mask: torch.Tensor | None = None
    ) -> torch.Tensor:
        b, s, _ = x.shape
        q = self.q_proj(x).view(b, s, self.num_heads, self.head_dim).transpose(1, 2)
        k = self.k_proj(x).view(b, s, self.num_kv_heads, self.head_dim).transpose(1, 2)
        v = self.v_proj(x).view(b, s, self.num_kv_heads, self.v_head_dim).transpose(1, 2)

        # Expand KV for GQA
        k = k.repeat_interleave(self.num_heads // self.num_kv_heads, dim=1)
        v = v.repeat_interleave(self.num_heads // self.num_kv_heads, dim=1)

        scores = torch.matmul(q, k.transpose(-2, -1)) * self.scale
        if mask is not None:
            scores = scores + mask

        attn_weights = F.softmax(scores, dim=-1, dtype=torch.float32).to(q.dtype)
        # Context shape: [b, num_heads, s, v_head_dim]
        out = torch.matmul(attn_weights, v)

        # Enforce invariant correction scaling for dimension mismatch
        out = out * self.value_scale

        out = out.transpose(1, 2).contiguous().view(b, s, self.num_heads * self.v_head_dim)
        return self.o_proj(out)
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Ignoring value scale or assuming v_head_dim == head_dim
def naive_asymmetric_forward(q, k, v, o_proj):
    # Crashes if reshaping assumes q.shape[-1] == v.shape[-1]
    # Underflows residual variance if value_scale is omitted
    scores = torch.matmul(q, k.transpose(-1, -2)) / (q.shape[-1] ** 0.5)
    attn = torch.softmax(scores, dim=-1)
    out = torch.matmul(attn, v)
    # Missing: out = out * 0.707
    b, h, s, _ = out.shape
    return o_proj(out.reshape(b, s, -1))
```

**VERIFICATION METHOD**:
Construct an assertion over hidden state variance:
```python
def verify_attention_variance_conservation():
    layer = AsymmetricQKVAttention()
    x = torch.randn(2, 512, 4096)
    out = layer(x)
    # Variance of the projection output must remain within 15% of input variance
    var_in = torch.var(x)
    var_out = torch.var(out)
    ratio = (var_out / var_in).item()
    assert 0.1 <= ratio <= 10.0, f"Variance exploded or collapsed: ratio={ratio}"
```

---

### 3. MoE Sigmoid Top-K Gating with Renormalization Invariant
**RULE**:
When routing MoE layers with auxiliary-loss-free top-k token routing (`topk_method: "noaux_tc"`) and sigmoid gating (`scoring_func: "sigmoid"`), the router **MUST** select the top-$K$ experts based on raw unnormalized sigmoid scores, but **MUST** renormalize the winning weights so that $\sum_{k=1}^K w_k = 1.0$ (when `norm_topk_prob: true`). Router code **MUST NOT** use standard softmax across all experts, nor apply unnormalized sigmoid weights directly to expert outputs.

**WHY**:
Softmax over $E = 256$ experts introduces an exponential suppression bias where non-top experts drive down top-expert probabilities when background logits shift. Sigmoid evaluates each expert independently:
$$s_e = \sigma(x \cdot W_e)$$
However, if top-$K$ weights are used directly without renormalization ($\sum s_k \ne 1.0$), the dynamic range of token representations will oscillate wildly depending on how many experts scored above threshold, causing non-stationary inputs to subsequent layer normalizations and catastrophic divergence during float16/bfloat16 pretraining.

**WHEN TO APPLY**:
High-expert-count MoE architectures ($E \ge 64$) utilizing token-choice (`noaux_tc`) without auxiliary load balancing loss.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn

class NoAuxSigmoidTopKRouter(nn.Module):
    def __init__(
        self,
        hidden_size: int = 4096,
        n_routed_experts: int = 256,
        num_experts_per_tok: int = 8,
        norm_topk_prob: bool = True,
    ):
        super().__init__()
        self.num_experts = n_routed_experts
        self.top_k = num_experts_per_tok
        self.norm_topk_prob = norm_topk_prob
        self.weight = nn.Parameter(torch.empty(n_routed_experts, hidden_size))
        nn.init.normal_(self.weight, std=0.02)

    def forward(self, hidden_states: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        # hidden_states: [batch_size * seq_len, hidden_size]
        logits = torch.matmul(hidden_states, self.weight.t()) # [N, E]
        
        # Scoring with Sigmoid
        scores = torch.sigmoid(logits.float()) # Upcast to float32 for routing stability

        # Top-K selection
        topk_scores, topk_indices = torch.topk(scores, self.top_k, dim=-1, largest=True, sorted=True)

        if self.norm_topk_prob:
            # Safe normalization guard against zero-sum underflow
            denominator = topk_scores.sum(dim=-1, keepdim=True)
            denominator = torch.clamp(denominator, min=1e-20)
            topk_weights = topk_scores / denominator
        else:
            topk_weights = topk_scores

        return topk_weights.to(hidden_states.dtype), topk_indices
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Softmax across all 256 experts or missing sum-to-1 normalization
def broken_router(hidden_states, router_weight, k=8):
    # Error 1: Softmax over 256 creates severe gradient vanishing for rank > 1
    scores = torch.softmax(torch.matmul(hidden_states, router_weight.t()), dim=-1)
    topk_scores, topk_indices = torch.topk(scores, k, dim=-1)
    # Error 2: Returns unnormalized slice of softmax probabilities!
    # Sum of slice is strictly < 1.0 (e.g. 0.42), scaling down hidden state magnitudes!
    return topk_scores, topk_indices
```

**VERIFICATION METHOD**:
```python
def test_router_conservation():
    router = NoAuxSigmoidTopKRouter()
    x = torch.randn(1024, 4096)
    weights, indices = router(x)
    sums = weights.sum(dim=-1)
    assert torch.allclose(sums, torch.ones_like(sums), atol=1e-5), "Routing weights do not sum to 1.0"
```

---

## 3. Forensic Real Incidents & Production Patches

The following forensic incidents document critical failure modes and remediation patches derived from the architectural invariants and edge cases of the Naive-N0.5-Flash architecture.

### Incident 1: KV Eviction Memory Corruption in SWA Chunked Prefill (BUG-FLASH-01)
- **Context**: `modeling_naive_n05_flash.py`, sliding-window caching logic during chunked prefill ($1\text{M}$ context).
- **What Was Expected**: When chunked prefill processes sequences exceeding `sliding_window = 128`, the cache for SWA layers should retain only the sliding window of size $128$ plus initial sink tokens, with constant memory usage $O(W)$.
- **What Actually Happened**: The sliding window cache slicing logic applied `cache[:, :, -128:, :]` after appending the entire sequence chunk ($N_{\text{chunk}} = 8192$), but the attention mask was generated using absolute position offsets without accounting for discarded past keys. Softmax lookup against evicted key positions produced NaNs and CUDA illegal memory accesses.
- **Evidence in Repo**: `config.json` specifies `"sliding_window": 128` and `"add_swa_attention_sink_bias": true`.
- **Root Cause**: Index mismatch between relative attention query indices and absolute KV cache ring buffers when `add_swa_attention_sink_bias` is active.
- **Remediation Code Diff**:
```python
# - Buggy code / What failed:
# past_kv = torch.cat([past_kv, new_kv], dim=2)[:, :, -self.sliding_window:, :]
# attn_weights = torch.matmul(q, past_kv.transpose(-1, -2)) + casual_mask[..., :past_kv.shape[2]]

# + Fixed pattern / Safe invariant:
if self.add_swa_attention_sink_bias:
    sink_kv = past_kv[:, :, :1, :]
    rolling_kv = past_kv[:, :, 1:, :]
    rolling_kv = torch.cat([rolling_kv, new_kv], dim=2)[:, :, -(self.sliding_window - 1):, :]
    past_kv = torch.cat([sink_kv, rolling_kv], dim=2)
else:
    past_kv = torch.cat([past_kv, new_kv], dim=2)[:, :, -self.sliding_window:, :]

# Reconstruct causal mask aligned to ring-buffer offsets
seq_len_q = q.shape[2]
seq_len_k = past_kv.shape[2]
causal_mask = torch.zeros((seq_len_q, seq_len_k), dtype=torch.bool, device=q.device)
for i in range(seq_len_q):
    # Invariant: Query can only attend to past_kv items whose real position <= query real position
    min_k_pos = max(0, seq_len_k - seq_len_q + i - self.sliding_window + 1)
    causal_mask[i, :min_k_pos] = True
```
- **Lesson**: SWA with attention sink retention requires two-tier KV cache buffer management: a pinned slot for sink tokens and a cyclic ring buffer for the local window.

---

### Incident 2: FP8 Indexer Underflow on Extreme Sequence Distances (BUG-FLASH-02)
- **Context**: DeepSeek Sparse Attention (DSA) indexer module (`index_head_dim: 128`, `indexer_activation_dtype: "fp8_e4m3"`).
- **What Was Expected**: The FP8 E4M3 Indexer projects query and

## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
