> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hf-dealignai-deepseek-v4.1-flash-uncensored-fp8-learnings.md`  
> **Source**: huggingface ([https://huggingface.co/dealignai/DeepSeek-V4.1-Flash-UNCENSORED-FP8](https://huggingface.co/dealignai/DeepSeek-V4.1-Flash-UNCENSORED-FP8))  
> **Source Version**: `hf-dealignai`  
> **License**: Open-Source  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-20T17:38:53.325Z  
> **Learning ID**: `learn-huggingface-dealignai-deepseek-v4-1-flash-uncensored-fp8`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

Based on the configuration manifests and metadata provided for `dealignai/DeepSeek-V4.1-Flash-UNCENSORED-FP8`, here is a concise forensic architectural analysis of the system and its technical specifications.

---

### 1. Architectural System Overview

The repository hosts an abliterated variant of the DeepSeek-V4.1-Flash architecture. The core modifications target directional weight representations associated with refusal behavior, leaving the underlying execution graph, tokenizer, and hyperparameter structures intact.

* **Backbone Dimensions**: 40 transformer layers, hidden dimension of 5,120, and multi-latent attention configuration (64 query heads, 1 KV head, `head_dim` 512, with low-rank projection ranks: `q_lora_rank = 1280`, `o_lora_rank = 1024`).
* **Mixture of Experts (MoE)**: 384 routed experts with 1 shared expert, routing top-6 experts per token using `sqrtsoftplus` gating and `noaux_tc` load-balancing.
* **Context Extension**: Native context length of 1,048,576 tokens enabled via YaRN RoPE scaling (`factor: 16`, `beta_fast: 32`, `beta_slow: 1`) over a base window of 65,536 tokens.
* **Engram Memory & Routing**: Embedded n-gram lookup layers at indices 1 and 14 with an expanded n-gram vocabulary ($1.6 \times 10^7$) to cache local token combinations without passing through standard feed-forward computation.
* **Sparse Indexing & Hyper-Connections**: Multi-channel residual pathways (`hc_mult = 4`) balanced using Sinkhorn iterations (`hc_sinkhorn_iters = 20`) paired with block-sparse candidate retrieval (`candidate_block_size = 8`, `index_topk = 512`).

---

### 2. Core Technical Invariants & Verification Rules

#### Rule 1: Precision-Preserving Block Dequantization
* **Invariant**: When executing matrix operations across heterogeneous precision boundaries (FP8 base weights with FP4 routed experts), scale transformations MUST be computed dynamically per block to prevent dynamic range collapse.
* **Mechanism**: The configuration defines `scale_fmt: "ue8m0"` with `weight_block_size: [32, 32]`. Dequantization kernels must align memory strides to 32-element boundaries before applying activation scaling.

```python
# Example: Verification of block alignment for FP8/FP4 tensors
def verify_quant_blocks(tensor_shape: tuple[int, int], block_size: tuple[int, int] = (32, 32)) -> bool:
    rows, cols = tensor_shape
    return (rows % block_size[0] == 0) and (cols % block_size[1] == 0)

assert verify_quant_blocks((5120, 2304), (32, 32))
```

#### Rule 2: MoE Gate Probability Normalization
* **Invariant**: With `norm_topk_prob: true` and non-standard scoring functions (`sqrtsoftplus`), expert gating weights MUST be normalized across the selected top-$k$ indices prior to computing the routed hidden state.
* **Failure Mode Avoided**: Disabling normalization under non-softmax scoring causes magnitude drift in residual streams proportional to routing density.

---

### 3. Key Architectural Dimensions

| Dimension | Implementation Details |
| :--- | :--- |
| **Quantization** | Mixed FP8 (`e4m3fn`) / FP4 routing with `ue8m0` scaling; dynamic activation calibration. |
| **Memory Mechanics** | Multi-Head Latent Attention (MLA) reduces KV-cache footprint by compressing queries and keys/values into low-rank latent spaces (`qk_rope_head_dim: 64`). |
| **Sparse Attention** | Layer-specific compression ratios (`compress_ratios`) coupled with candidate block indexing at layer 20 to restrict attention computation to relevant history blocks over the 1M token window. |
| **Token Handling** | FastTokenizer configuration with explicit control tokens (`<｜begin of sentence｜>`, `<｜end of sentence｜>`), avoiding automatic BOS/EOS injection to maintain raw input fidelity. |
| **Routing / Gating** | Sinkhorn-based hyper-connections ensure balanced gradients across parallel compute streams (`hc_sinkhorn_iters: 20`, $\epsilon = 10^{-6}$). |

---

### 4. Implementation & Deployment Checklist

1. **Kernel Alignment**: Ensure hardware runtime supports FP8 (`e4m3fn`) compute capabilities and native FP4 tensor-core dequantization with 32-element block granularity.
2. **Context Window Buffering**: Configure KV-cache allocators to respect the YaRN scaling parameters (`max_position_embeddings: 1048576`) to avoid out-of-bound rotary embedding calculations.
3. **Engram Layer Cache**: Allocate separate lookup tables for layers `[1, 14]` to accommodate the sparse n-gram embedding table (`vocab_size: 16000000`).
4. **Tokenization Boundary Invariant**: Enforce `add_bos_token = false` and `add_eos_token = false` in runtime inference wrappers to prevent token drift in chat and multi-turn interfaces.