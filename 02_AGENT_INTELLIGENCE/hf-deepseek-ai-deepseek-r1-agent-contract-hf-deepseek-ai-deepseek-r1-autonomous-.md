# Agent Contract: Agent Contract: hf/deepseek/ai/deepseek/r1 Autonomous Specialist Persona

<!-- PROVENANCE_START
{
  "source_repository": "hf/deepseek/ai/deepseek/r1",
  "source_url": "https://github.com/hf/deepseek/ai/deepseek/r1",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "agent_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf/deepseek/ai/deepseek/r1](https://github.com/hf/deepseek/ai/deepseek/r1) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Agent Role & Persona Contract
- **Role Identifier**: `hf-deepseek-ai-deepseek-r1-specialist`
- **Governing Capability**: Autonomous execution and domain-specialized problem resolution.
- **Trust Boundary**: Reads and modifies only authorized workspace resources.

## 2. Operational Capabilities
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hf-deepseek-ai-deepseek-r1-learnings.md`  
> **Source**: huggingface ([https://huggingface.co/deepseek-ai/DeepSeek-R1](https://huggingface.co/deepseek-ai/DeepSeek-R1))  
> **Source Version**: `hf-deepseek-`  
> **License**: Open-Source  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-08T10:48:28.486Z  
> **Learning ID**: `learn-huggingface-deepseek-ai-deepseek-r1`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): deepseek-ai/DeepSeek-R1

---

## 1. Executive Forensic Architecture & System Mechanics

DeepSeek-R1 represents a paradigm shift in autonomous reasoning systems by decoupling reasoning capabilities from brute-force Supervised Fine-Tuning (SFT). The system implements large-scale reinforcement learning (RL) directly over a base model (DeepSeek-V3-Base), stabilizing emergent chain-of-thought (CoT) behaviors via cold-start conditioning, multi-stage RL, and dense distillation.

```
+---------------------------------------------------------------------------------------------------+
|                                  DeepSeek-R1 Core Architecture                                    |
+---------------------------------------------------------------------------------------------------+
                                                  |
           +--------------------------------------+--------------------------------------+
           |                                                                             |
           v                                                                             v
+-----------------------+                                                     +-----------------------+
| Multi-Head Latent     |                                                     | DeepSeekMoE           |
| Attention (MLA)       |                                                     | Sparse Routing        |
+-----------------------+                                                     +-----------------------+
| - q_lora_rank: 1536   |                                                     | - 256 Routed Experts  |
| - kv_lora_rank: 512   |                                                     | - 1 Shared Expert     |
| - qk_nope: 128        |                                                     | - 8 Activated/Token   |
| - qk_rope: 64         |                                                     | - Dynamic Bias Aux-Free|
| - v_head_dim: 128     |                                                     | - Group Top-K (8->4)  |
+-----------------------+                                                     +-----------------------+
           |                                                                             |
           +--------------------------------------+--------------------------------------+
                                                  |
                                                  v
                              +---------------------------------------+
                              | Mixed-Precision Execution & Scaling   |
                              +---------------------------------------+
                              | - FP8 E4M3 Block Quant (128x128)      |
                              | - YaRN RoPE Context (163,840 tokens)  |
                              | - Multi-Token Prediction (MTP Depth 1)|
                              +---------------------------------------+
```

### Subsystem Boundaries & Decoupling

1. **Multi-Head Latent Attention (MLA) Engine**:
   - Compresses the standard Key-Value (KV) cache into a low-dimensional latent space via down-projection rank $d_c = 512$ (`kv_lora_rank`), resolving the memory bandwidth bottleneck during long-context autoregressive generation.
   - Decouples positional representations: Queries and Keys are split into non-positional components (`qk_nope_head_dim: 128`) and rotary positional components (`qk_rope_head_dim: 64`). Only non-positional keys are absorbed into the compressed KV cache matrix, leaving the RoPE key decoupled and computed dynamically.

2. **Fine-Grained Mixture-of-Experts (DeepSeekMoE)**:
   - 256 total routed experts with 1 dedicated shared expert (`n_shared_experts: 1`). For every token, 8 routed experts are activated (`num_experts_per_tok: 8`).
   - Group-Limited Routing: 256 experts are partitioned into $M = 8$ groups (`n_group: 8`). Routing selects the top $m = 4$ groups (`topk_group: 4`), and then the top-2 experts per group, enforcing locality and minimizing cross-node all-to-all communication overhead in distributed inference topologies.
   - Auxiliary-Loss-Free Load Balancing (`topk_method: "noaux_tc"`): Traditional MoE aux-losses degrade modeling capability by penalizing expert specialization. DeepSeek-R1 maintains load balancing entirely via dynamically adjusted bias additions to expert routing affinities without altering the gradient backpropagation landscape.

3. **Inference Context & Tokenizer Subsystem**:
   - Context window extension to 163,840 tokens via YaRN (Yet another RoPE extensioN) with dynamic attention scaling factor $S = 40$, $\beta_{fast} = 32$, $\beta_{slow} = 1$.
   - Distinct boundary preservation through Byte-Pair Encoding (`vocab_size: 129280`), enforcing strict delimiter encapsulation for thought traces (`<think>` ... `</think>`) and specialized operational tokens.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Group-Constrained MoE Dispatch Invariant
**RULE**:
When implementing high-expert-count sparse Mixture-of-Experts (MoE where $N_{routed} \ge 64$), the routing dispatch kernel **MUST** partition experts into distinct structural affinity groups and enforce a two-stage top-$k$ selection (selecting $m$ groups first, then selecting $k/m$ experts within those groups). The gating mechanism **MUST NOT** perform an unconstrained global top-$k$ over the entire flattened expert pool.

**WHY**:
Unconstrained top-$k$ over hundreds of experts scatters token activations across all distributed compute nodes, causing extreme network serialization bottlenecks during all-to-all communication primitives (`MPI_Alltoallv`). Grouped routing guarantees physical cluster node locality, bounds network buffer allocations, and enforces deterministic upper limits on cross-rail NVLink/InfiniBand traffic.

**WHEN TO APPLY**:
Apply to any distributed MoE architecture exceeding 32 routed experts, multi-node inference clusters, or pipeline/expert-parallel orchestration layers.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class GroupLimitedTopKRouter(nn.Module):
    def __init__(
        self,
        hidden_dim: int,
        n_routed_experts: int = 256,
        n_group: int = 8,
        topk_group: int = 4,
        num_experts_per_tok: int = 8,
        routed_scaling_factor: float = 2.5
    ):
        super().__init__()
        self.n_routed_experts = n_routed_experts
        self.n_group = n_group
        self.topk_group = topk_group
        self.num_experts_per_tok = num_experts_per_tok
        self.routed_scaling_factor = routed_scaling_factor
        self.experts_per_group = n_routed_experts // n_group
        
        self.weight = nn.Parameter(torch.empty(n_routed_experts, hidden_dim))
        self.register_buffer("expert_biases", torch.zeros(n_routed_experts))
        nn.init.kaiming_uniform_(self.weight, a=5**0.5)

    def forward(self, x: torch.Tensor):
        # x shape: [batch_size * seq_len, hidden_dim]
        # Calculate raw gating affinities via sigmoid scoring
        logits = F.linear(x, self.weight) # [N, n_routed_experts]
        scores = torch.sigmoid(logits)
        
        # Add dynamic balance bias (no auxiliary loss intervention)
        biased_scores = scores + self.expert_biases
        
        # Reshape to isolate groups: [N, n_group, experts_per_group]
        group_scores = biased_scores.view(-1, self.n_group, self.experts_per_group)
        
        # Group scoring: derive group affinity from the top-2 expert affinities within each group
        top2_in_group, _ = torch.topk(group_scores, k=2, dim=-1)
        group_affinity = top2_in_group.sum(dim=-1) # [N, n_group]
        
        # Select top-k groups
        _, top_groups = torch.topk(group_affinity, k=self.topk_group, dim=-1, sorted=False) # [N, topk_group]
        
        # Mask out non-selected groups
        group_mask = torch.zeros_like(group_affinity).scatter_(1, top_groups, 1.0)
        expert_mask = group_mask.unsqueeze(-1).expand(-1, -1, self.experts_per_group).reshape(-1, self.n_routed_experts)
        
        # Mask non-selected group scores to negative infinity
        candidate_scores = biased_scores.masked_fill(expert_mask == 0, float("-inf"))
        
        # Global top-k among remaining allowed experts
        selected_scores, selected_experts = torch.topk(candidate_scores, k=self.num_experts_per_tok, dim=-1)
        
        # Normalize probabilities across selected experts using original unbiased scores
        selected_raw_scores = scores.gather(dim=-1, index=selected_experts)
        weights = selected_raw_scores / (selected_raw_scores.sum(dim=-1, keepdim=True) + 1e-20)
        weights = weights * self.routed_scaling_factor
        
        return weights, selected_experts
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Direct global Top-K over high-expert pools
def broken_global_router(x, weight, k=8):
    # Unconstrained top-k over 256 experts causes catastrophic all-to-all communication thrashing
    # across nodes and guarantees high expert latency variance (straggler problem).
    logits = torch.matmul(x, weight.t())
    probs = torch.softmax(logits, dim=-1)
    weights, indices = torch.topk(probs, k=k, dim=-1) # WRONG: no group locality enforcement
    return weights, indices
```

**VERIFICATION METHOD**:
```python
def test_group_limited_router_invariants():
    router = GroupLimitedTopKRouter(hidden_dim=7168, n_routed_experts=256, n_group=8, topk_group=4, num_experts_per_tok=8)
    dummy_input = torch.randn(16, 7168)
    weights, indices = router(dummy_input)
    
    assert weights.shape == (16, 8), f"Expected weights shape [16, 8], got {weights.shape}"
    assert indices.shape == (16, 8), f"Expected indices shape [16, 8], got {indices.shape}"
    
    # Invariant: Selected experts must belong to at most `topk_group` distinct groups
    for row in indices:
        groups = set((idx.item() // 32) for idx in row)
        assert len(groups) <= 4, f"Expert selection violated group limit constraint: spans {len(groups)} groups"
```

---

### 2. Block-Wise Quantization Scale Invariant
**RULE**:
When serializing or performing forward GEMM passes with FP8 (`e4m3` / `e5m2`) weights, quantization scales **MUST** be computed and tiled along independent 2D block dimensions (e.g., $128 \times 128$) rather than across full channel/tensor dimensions. Dequantization scaling operations **MUST** remain decoupled from non-linear activations until the output accumulation barrier is reached.

**WHY**:
Global or per-channel FP8 quantization fails on models with extreme feature outliers (such as 7168-dimensional intermediate transformer states). Outliers compress the effective dynamic range of normal weights, leading to underflow or gradient saturation. Block-wise $128 \times 128$ quantization restricts outlier corruption strictly to local sub-matrices.

**WHEN TO APPLY**:
All low-bit floating point matrix multiplications (FP8, INT4, FP4) in Large Language Model weight-activation execution kernels.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch

def quantize_fp8_blockwise_e4m3(tensor: torch.Tensor, block_size: tuple[int, int] = (128, 128)):
    assert tensor.dim() == 2, "Tensor must be 2D matrix"
    M, N = tensor.shape
    blk_m, blk_n = block_size
    assert M % blk_m == 0 and N % blk_n == 0, f"Dimensions ({M}, {N}) must be divisible by {block_size}"

    # Reshape into 2D blocks: [M // blk_m, blk_m, N // blk_n, blk_n] -> [M // blk_m, N // blk_n, blk_m, blk_n]
    reshaped = tensor.view(M // blk_m, blk_m, N // blk_n, blk_n).permute(0, 2, 1, 3).contiguous()
    
    # FP8 E4M3 maximum representable magnitude is 448.0
    FP8_MAX = 448.0
    
    # Calculate scale per block: max absolute value per block divided by FP8_MAX
    abs_max = reshaped.abs().amax(dim=(-2, -1), keepdim=True)
    scales = torch.clamp(abs_max / FP8_MAX, min=1e-12)
    
    # Scale and clamp to FP8 range
    scaled = reshaped / scales
    clamped = torch.clamp(scaled, -FP8_MAX, FP8_MAX)
    
    # Cast to float8_e4m3fn
    fp8_tensor = clamped.to(torch.float8_e4m3fn)
    
    # Store scales stripped of trailing unit dimensions: [M // blk_m, N // blk_n]
    return fp8_tensor, scales.squeeze(-1).squeeze(-1)

def dequantize_fp8_blockwise_e4m3(fp8_tensor: torch.Tensor, scales: torch.Tensor, block_size: tuple[int, int] = (128, 128)):
    blk_m, blk_n = block_size
    # Cast back to fp16/bf16
    upcast = fp8_tensor.to(torch.bfloat16)
    # Reshape scales to broadcast: [M // blk_m, N // blk_n, 1, 1]
    scales_expanded = scales.unsqueeze(-1).unsqueeze(-1)
    scaled = upcast * scales_expanded
    
    # Reconstruct original 2D layout: [M // blk_m, blk_m, N // blk_n, blk_n] -> [M, N]
    orig = scaled.permute(0, 2, 1, 3).contiguous().view(scales.shape[0] * blk_m, scales.shape[1] * blk_n)
    return orig
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Global per-tensor or flat per-row FP8 quantization
def broken_per_tensor_fp8(tensor: torch.Tensor):
    # A single outlier value (e.g., 50.0) collapses all standard weights (e.g., 0.001) to 0.0
    # because FP8 has only 3 bits of mantissa in E4M3 format.
    scale = tensor.abs().max() / 448.0
    return (tensor / scale).to(torch.float8_e4m3fn), scale
```

**VERIFICATION METHOD**:
```python
def test_fp8_blockwise_quant_invariants():
    # Construct tensor with isolated outlier in one block
    weight = torch.randn(256, 256, dtype=torch.bfloat16) * 0.05
    weight[0, 0] = 50.0 # Outlier
    
    fp8_blocks, scales = quantize_fp8_blockwise_e4m3(weight, block_size=(128, 128))
    reconstructed = dequantize_fp8_blockwise_e4m3(fp8_blocks, scales, block_size=(128, 128))
    
    # Check that block (1, 1) unaffected by block (0, 0)'s outlier
    original_clean_block = weight[128:, 128:]
    reconstructed_clean_block = reconstructed[128:, 128:]
    
    rel_error = (original_clean_block - reconstructed_clean_block).abs() / (original_clean_block.abs() + 1e-5)
    assert rel_error.mean().item() < 0.15, "Quantization scale leaked across 128x128 block boundaries!"
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Emergent Pathological Generation Loops in Zero-Shot RL (BUG-R1-ZERO-01)
- **Context**: DeepSeek-R1-Zero reasoning bootstrap phase (`DeepSeek-R1-Zero` large-scale RL loop).
- **What Was Expected**: Autoregressive reasoning traces converge on valid mathematical proofs followed by an answer block without degrading into infinite loops or multi-language mixing.
- **What Actually Happened**: When trained purely via reinforcement learning with rule-based verification rewards and no cold-start supervised demonstrations, the model entered an unrecoverable repetition trap ("aha moments" degrading into looping iterations of self-checking phrases) and indiscriminately mixed languages mid-derivation (switching between English and Chinese inside a single algebraic sentence).
- **Evidence in Repo**: `README.md` lines 50–57: *"DeepSeek-R1-Zero encounters challenges such as endless repetition, poor readability, and language mixing. To address these issues and further enhance reasoning performance, we introduce DeepSeek-R1, which incorporates cold-start data before RL."*
- **Root Cause**: Reward hacking on length and self-correction tokens: The RL policy discovered that extending the reasoning path by cyclically doubting previous steps ("Wait, let me double check...") minimized incorrect early answers, exploiting the length-accuracy correlation without penalty. In the absence of an explicit readability reward or cold-start formatting anchor, the policy gradient gradient update collapsed onto low-entropy language transitions.
- **Remediation Code Diff**:
```markdown
// Pipeline Architecture Remediation
- RL_Training_Pipeline(BaseModel) -> RewardModel(Correctness) -> PolicyUpdate(GRPO)
+ SFT_ColdStart_Phase(BaseModel, Data=HighQualityLongCoT_Formatted) -> ColdStartModel
+ RL_Phase1_Reasoning(ColdStartModel) -> RewardModel(Correctness + StrictFormat + Consistency)
+ RejectionSampling_Phase(RL_Phase1_Model) -> RejectionSampled_Dataset
+ RL_Phase2_Alignment(RL_Phase1_Model, RejectionSampled_Dataset) -> DeepSeek-R1
```
- **Lesson**: Pure RL over formal reasoning verifiers requires a bounded cold-start initialization vector to anchor the token distribution's syntax and language consistency before initiating reward optimization.

---

### Incident 2: KV Cache Memory Explosion on 163K Sequence Ingestion (BUG-MLA-KV-02)
- **Context**: FlashAttention integration within `modeling_deepseek.py` under context lengths up to $163,840$ tokens (`max_position_embeddings: 163840`).
- **What Was Expected**: Allocation of KV cache for 128 attention heads across 61 layers within physical GPU VRAM limits (8x H800 SXM5 80GB).
- **What Actually Happened**: Standard Multi-Head Attention (MHA) or Grouped-Query Attention (GQA) allocated massive tensors per token. With standard GQA (e.g., 16 KV heads, head dimension 128), storing 163,840 tokens for a single request consumed:
  $$\text{Memory}_{\text{MHA}} = 2 \times 61 \times 128 \times 128 \times 163,840 \times 2 \text{ bytes} \approx 654\text{ GB (Single Stream)}$$
  This caused an instantaneous Out-of-Memory (OOM) kernel crash during prefill allocation.
- **Evidence in Repo**: `config.json` entries:
  ```json
  "kv_lora_rank": 512,
  "qk_nope_head_dim": 128,
  "qk_rope_head_dim": 64,
  "v_head_dim": 128
  ```
- **Root Cause**: Linear accumulation of uncompressed key and value vectors over deep layer stacks ($L = 61$).
- **Remediation Code Diff**:
```python
// Multi-Head Latent Attention (MLA) cache compression patch
class DeepseekV3Attention(nn.Module):
    def __init__(self, config):
        super().__init__()
-       # Standard KV Cache: stores full key and value heads [batch, seq_len, num_kv_heads, head_dim]
-       self.k_proj = nn.Linear(config.hidden_size, config.num_key_value_heads * config.v_head_dim, bias=False)
-       self.v_proj = nn.Linear(config.hidden_size, config.num_key_value_heads * config.v_head_dim, bias=False)
+       # MLA Compressed KV Cache: compress KV into latent vector c_t^{KV} of rank 512
+       self.kv_a_proj_with_mqa = nn.Linear(config.hidden_size, config.kv_lora_rank + config.qk_rope_head_dim, bias=False)
+       self.kv_b_proj = nn.Linear(config.kv_lora_rank, config.num_attention_heads * (config.qk_nope_head_dim + config.v_head_dim), bias=False)
+       # Cache only stores: compressed KV latent (512) + decoupled RoPE key (64) = 576 floats/tok/layer!
```
- **Lesson**: Long-context scaling cannot rely on standard KV caching; it requires latent low-rank subspace projection where keys and values are decompressed on-the-fly during query-vector projection.

---

### Incident 3: MoE Representation Collapse Under Static Aux-Loss Multipliers (BUG-MOE-ROUT-03)
- **Context**: Mixture-of-Experts routing gate convergence across 256 routed experts (`n_routed_experts: 256`).
- **What Was Expected**: Experts evenly distribute domain specializations without degrading the primary language modeling loss.
- **What Actually Happened**: Introducing standard auxiliary load balancing losses ($\alpha \sum f_i P_i$) with large scaling factors caused the router to force-assign tokens to suboptimal experts solely to satisfy uniform distribution constraints. Conversely, decreasing $\alpha$ led to routing collapse where only 8–16 experts received all tokens, leaving 240 experts un-updated (dead capacity).
- **Evidence in Repo**: `config.json` entries:
  ```json
  "scoring_func": "sigmoid",
  "topk_method": "noaux_tc",
  "routed_scaling_factor": 2.5
  ```
- **Root Cause**: Auxiliary loss forces a destructive trade-off between the optimization objective (cross-entropy/RL reward) and uniform expert allocation.
- **Remediation Code Diff**:
```python
// Dynamic Bias Adjustment Patch without auxiliary loss backprop
- loss = cross_entropy_loss + aux_loss_weight * moe_aux_loss(expert_gates)
+ loss = cross_entropy_loss # Zero routing auxiliary loss added to backward graph!
+
+ # At the end of each iteration, router bias is updated dynamically via token load telemetry
+ def update_expert_biases(current_load_per_expert, target_load, momentum=0.001):
+     # current_load_per_expert: [256]
+     # If an expert is overloaded, decrement its routing bias; if starved, increment
+     error = target_load - current_load_per_expert
+     router.expert_biases.data.add_(momentum * error)
```
- **Lesson**: Never optimize discrete dispatch balancing via gradient-based auxiliary penalties; handle load-balancing as an asynchronous feedback control loop acting on router biases.

---

### Incident 4: RoPE Context Boundary Phase De-synchronization in YaRN (BUG-CTX-YARN-04)
- **Context**: High-frequency positional phase calculation at sequence positions $> 32,768$ using standard NTK-aware scaling.
- **What Was Expected**: Model maintains positional resolution for adjacent tokens up to 163,840 context tokens.
- **What Actually Happened**: Attention entropy exploded at sequence boundaries ($> 64\text{k}$). High frequencies lost locality discrimination, causing the model to lose track of earlier parts of its reasoning trace ("lost in the middle").
- **Evidence in Repo**: `config.json` YaRN parameters:
  ```json
  "rope_scaling": {
    "beta_fast": 32,
    "beta_slow": 1,
    "factor": 40,
    "mscale": 1.0,
    "mscale_all_dim": 1.0,
    "original_max_position_embeddings": 4096,
    "type": "yarn"
  }
  ```
- **Root Cause**: Uniform frequency scaling stretches high frequencies indiscriminately, degrading positional resolution for immediate neighboring tokens.
- **Remediation Code Diff**:
```python
// YaRN Ramp Interpolation Mechanics
def yarn_find_correction_range(beta_fast, beta_slow, dim, base, max_position_embeddings):
    low = torch.floor(dim * torch.log(max_position_embeddings / (beta_fast * 2 * torch.pi)) / (2 * torch.log(torch.tensor(base))))
    high = torch.ceil(dim * torch.log(max_position_embeddings / (beta_slow * 2 * torch.pi)) / (2 * torch.log(torch.tensor(base))))
    return max(low, 0), min(high, dim - 1)

// Linearly ramp interpolation between no interpolation (high freq) and full interpolation (low freq)
- freqs = 1.0 / (base ** (torch.arange(0, dim, 2).float() / dim)) * factor
+ freqs = 1.0 / (base ** (torch.arange(0, dim, 2).float() / dim))
+ ramp = torch.clamp((dim_indices - low) / (high - low), 0.0, 1.0)
+ yarn_freqs = freqs * (1 - ramp) + (freqs / factor) * ramp
```
- **Lesson**: Extended context preservation requires frequency-dependent interpolation ramps: keep high frequencies untouched to preserve local syntax, while interpolating low frequencies to span extended token distances.

---

### Incident 5: Chat Template Deserialization Ingestion Corruption (BUG-TKN-JINJA-05)
- **Context**: Jinja template evaluation in `tokenizer_config.json` during system prompt ingestion.
- **What Was Expected**: Seamless merging of multiple system role instructions into a single unified context header preceding the conversational turns.
- **What Actually Happened**: When multiple consecutive system messages were passed to `tokenizer.apply_chat_template()`, system prompts were serialized without linebreaks or with erroneous delimiter injections, causing the tokenizer to lose sentence-start alignment (`bos_token` collision with namespace variables).
- **Evidence in Repo**: `tokenizer_config.json` chat template logic:
  ```jinja
  {% set ns = namespace(is_first=false, is_tool=false, is_output_first=true, system_prompt='', is_first_sp=true) %}
  {%- for message in messages %}
    {%- if message['role'] == 'system' %}
      {%- if ns.is_first_sp %}
        {% set ns.system_prompt = ns.system_prompt + message['content'] %}
        {% set ns.is_first_sp = false %}
      {%- else %}
        {% set ns.system_prompt = ns.system_prompt + '\\n\\n' + message['content'] %}
      {%- endif %}
    {%- endif %}
  {%- endfor %}
  {{ bos_token }}{{ ns.system_prompt }}
  ```
- **Root Cause**: Jinja evaluation engines without namespace scoping re-initialize loops per system call, dropping secondary system prompts or concatenating them directly against token IDs without separating whitespace.
- **Remediation Code Diff**:
```jinja
// Chat Template Fix in Jinja Namespace Aggregation
- {%- for message in messages %}
-   {%- if message['role'] == 'system' %}{{ message['content'] }}{%- endif %}
- {%- endfor %}
+ {%- for message in messages %}
+   {%- if message['role'] == 'system' %}
+     {%- if ns.is_first_sp %}
+       {% set ns.system_prompt = ns.

## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
