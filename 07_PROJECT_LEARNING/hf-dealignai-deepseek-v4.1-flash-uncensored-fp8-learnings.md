> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hf-dealignai-deepseek-v4.1-flash-uncensored-fp8-learnings.md`  
> **Source**: huggingface ([https://huggingface.co/dealignai/DeepSeek-V4.1-Flash-UNCENSORED-FP8](https://huggingface.co/dealignai/DeepSeek-V4.1-Flash-UNCENSORED-FP8))  
> **Source Version**: `hf-dealignai`  
> **License**: Open-Source  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-15T02:16:10.309Z  
> **Learning ID**: `learn-huggingface-dealignai-deepseek-v4-1-flash-uncensored-fp8`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

Based on the provided repository configuration and metadata for `dealignai/DeepSeek-V4.1-Flash-UNCENSORED-FP8`, here is a concise architectural and forensic breakdown of the system components and configurations.

---

### 1. Architectural Summary & Model Mechanics

The repository contains configuration files and evaluation metrics for a modified causal language model derived from `deepseek-ai/DeepSeek-V4.1-Flash`.

* **Base Architecture**: 40-layer Transformer incorporating Mixture of Experts (MoE) and Hyper-Connections (`hc_mult: 4`).
* **MoE Design**:
  * 384 routed experts with Top-6 routing per token (`num_experts_per_tok: 6`).
  * 1 shared expert.
  * Routing mechanism uses `sqrtsoftplus` scoring with `noaux_tc` (no auxiliary loss, top-choice/threshold routing).
* **Attention & Context**:
  * Context window configured up to 1,048,576 tokens (1M tokens) via YaRN RoPE scaling (`factor: 16`, base limit 65,536).
  * 64 attention heads with head dimension of 512, paired with a single Key-Value head (`num_key_value_heads: 1`), indicative of severe multi-query / multi-head latent attention (MLA) projection.
  * Layer-specific KV-sharing/indexing (`kv_source_layer_ids`, `index_source_layer_ids`) to reduce memory footprint at extreme context lengths.
* **Engram & Multi-scale Memory**:
  * Dedicated n-gram embedding layers (`engram_layer_ids: [1, 14]`) with lookup vocabularies supporting up to 4-grams to augment local token context.
* **Quantization Scheme**:
  * Weights stored in FP8 dynamic scheme with `[32, 32]` block scales (`ue8m0`).
  * Routed experts quantized down to FP4 (`expert_dtype: "fp4"`).

---

### 2. Core Engineering Invariants & Configuration Constraints

#### Invariant 1: Attention Compression Consistency
* **Rule**: When configuring cross-layer Key-Value sharing (`kv_source_layer_ids`), reference layers must precede dependent layers, and compression ratios must match downstream attention dimensions.
* **Context in Manifest**: `kv_source_layer_ids: [2, 8, 14, 20]`. Later layers reuse computed key-value states from these specific anchoring layers rather than allocating new KV caches.

#### Invariant 2: YaRN Context Scaling Bounds
* **Rule**: Extension factors in YaRN (`rope_scaling`) must define `beta_fast` and `beta_slow` boundaries to prevent high-frequency rotational component degradation.
* **Configuration**:
  ```json
  "rope_scaling": {
    "rope_type": "yarn",
    "factor": 16,
    "beta_fast": 32,
    "beta_slow": 1,
    "original_max_position_embeddings": 65536
  }
  ```
  Interpolation occurs between $\beta_{\text{slow}}$ and $\beta_{\text{fast}}$ frequencies to maintain locality while scaling max positions to $65536 \times 16 = 1,048,576$.

---

### 3. Analysis of Reported Modifications (Abliteration)

The repository README outlines a weight-level modification termed "abliteration":
* **Mechanism**: The refusal behavior was targeted by identifying refusal direction vectors within hidden representations and projecting them out of specific linear layers.
* **Structural Preservation**: The core computation graph, MoE routing weights, and attention configurations remain structurally identical to the base architecture, enabling loading via standard inference engines without custom execution code.
* **Evaluation Data**: The documentation reports an increase in Attack Success Rate (ASR) across HarmBench categories (reaching 100% across the benchmark suite), showing the suppression of safety interventions without altering base model vocabulary or dimension manifests.

---

### 4. Implementation Checklist for MoE/MLA Inference Runtimes

1. **Verify Block-Scale Alignment**: Ensure the inference kernel supports block-wise FP8/FP4 dequantization with non-standard block sizes (`[32, 32]`) and scale formats (`ue8m0`).
2. **Implement Source Layer Caching**: Support layer-to-layer KV forwarding based on `kv_source_layer_ids` to prevent allocating 40 distinct KV cache buffers.
3. **Handle Engram Lookup Layers**: Allocate auxiliary tables for the specialized n-gram embeddings defined at layers 1 and 14 before executing standard Transformer blocks.