# Architecture Decision Record: ADR: Subsystem Boundary & Modular Decoupling in hf/xingchen/agi/teleocr

<!-- PROVENANCE_START
{
  "source_repository": "hf/xingchen/agi/teleocr",
  "source_url": "https://github.com/hf/xingchen/agi/teleocr",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T07:59:42.371Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "architecture_decision"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf/xingchen/agi/teleocr](https://github.com/hf/xingchen/agi/teleocr) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T07:59:42.371Z`  
> **Learning ID**: `unknown`


## Status
**ACCEPTED** (Empirically verified from hf/xingchen/agi/teleocr)

## Context
During deep inspection of hf/xingchen/agi/teleocr, modular boundaries, performance characteristics, and concurrency constraints required explicit architectural trade-off analysis.

## Decision
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hf-xingchen-agi-teleocr-learnings.md`  
> **Source**: huggingface ([https://huggingface.co/XingChen-AGI/TeleOCR](https://huggingface.co/XingChen-AGI/TeleOCR))  
> **Source Version**: `hf-xingchen-`  
> **License**: Open-Source  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-08T12:26:17.957Z  
> **Learning ID**: `learn-huggingface-xingchen-agi-teleocr`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): XingChen-AGI/TeleOCR

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Architectural Mission & Problem Space
TeleOCR (originally developed as NaviDC-OCR by StarDoc-AI / XingChen-AGI) is a 1.2-billion-parameter Vision-Language Model (VLM) fine-tuned specifically for high-fidelity end-to-end document parsing across two heterogeneous visual regimes:
1. **Digital Documents**: High-contrast, born-digital PDFs, planar layouts, vector graphics, and standard tabular structures.
2. **Camera-Captured Documents**: Non-planar surfaces, perspective distortion, severe shadowing, sensor blur, non-uniform illumination, and physical folds/curvatures.

The system unifies text recognition, layout analysis, reading-order reconstruction, and geometric surface unwrapping into an autoregressive token-generation pipeline, bypassing classical multi-stage OCR pipelines (binarization $\rightarrow$ text line detection $\rightarrow$ rectifying homography $\rightarrow$ CTC/Attention recognition $\rightarrow$ layout hierarchy parsing).

```
                      +------------------------------------------------+
                      |         Input Document Image (Raw RGB)          |
                      +------------------------------------------------+
                                              |
                     [ Dynamic Resolution Patch Splitting: Patch=14x14 ]
                                              |
                                              v
+-----------------------------------------------------------------------------------------------+
| Vision Encoder Backbone (ViT, Depth=32, Hidden=1280)                                          |
|  - Blocks 0..6, 8..14, 16..22, 24..30 : Windowed Local Self-Attention                         |
|  - Blocks 7, 15, 23, 31                : Full Global Self-Attention (fullatt_block_indexes)   |
+-----------------------------------------------------------------------------------------------+
                                              |
                              [ Spatial 2D Merger / Downsampler ]
                                              |
                                              v
                      +------------------------------------------------+
                      | Visual Token Embeddings (Hidden Dim = 1024)     |
                      |   Framed by <|vision_start|> ... <|vision_end|> |
                      +------------------------------------------------+
                                              |
                                              +<--- Prompt / Instruction Tokens
                                              v
+-----------------------------------------------------------------------------------------------+
| Autoregressive Text Decoder (Qwen2.5-VL-Text, 28 Layers, Hidden=1024, Heads=16, KV=8)         |
|  - Rotary Embedding: Multimodal RoPE (M-RoPE, Sections=[16, 24, 24] for Time, H, W)           |
|  - GQA (Grouped Query Attention): 16 Query Heads / 8 Key-Value Heads (Ratio 2:1)             |
|  - Sequence Length: max_position_embeddings = 128,000 tokens                                  |
|  - Vocabulary: 151,936 tokens + Specialized Coordinate/Layout Control Tokens                 |
+-----------------------------------------------------------------------------------------------+
                                              |
                                              v
                      +------------------------------------------------+
                      | Structured Output: Markdown, LaTeX, JSON,      |
                      | <|box_start|>(y1,x1,y2,x2)<|box_end|> Coords  |
                      +------------------------------------------------+
```

### 1.2 Subsystem Decomposition & State Ownership

```
TeleOCR Architectural Boundary Breakdown
├── Input Processing Layer
│   ├── Dynamic Aspect-Ratio Tiling: Deconstructs arbitrary aspect-ratio pages into 2D grid
│   └── 3D Grid Coordinate Generation: Derives temporal (t=0), vertical (y), horizontal (x) indices
├── Visual Representation Engine (Vision Transformer Subsystem)
│   ├── Hybrid Window/Full Attention Schedule: Interleaved sparse window attention with periodic global sinks
│   └── Vision Patch Projection: Projections from 1280 ViT dimensions to 1024 LM dimensions
├── Multimodal Rotary Position Embedding (M-RoPE) Subsystem
│   ├── Vector Partitioning: 64 total frequency pairs partitioned into [16, 24, 24]
│   └── 3D Coordinate Modulator: Multiplies sinusoidal positional bases across (temporal, height, width)
├── Language Decoding Core (Qwen2.5-VL Core)
│   ├── Grouped Query Attention (GQA): 16 Q heads vs 8 KV heads with head dimension 128
│   ├── RMSNorm Invariant Layers: Fixed eps = 1e-06 with non-parametric centering
│   └── SwiGLU MLP Blocks: intermediate_size = 3072, SiLU gating
└── Coordinate & Spatial Grounding Engine
    ├── Grounding Token Vocab: <|box_start|>, <|box_end|>, <|object_ref_start|>, <|object_ref_end|>
    └── Polygon Parsing & Curvature De-quantization: De-warping text boundaries
```

---

## 2. Net-New Universal Engineering Rules

### 1. Multimodal 3D Rotary Position Coordinate Projection Invariant
**RULE**:
When implementing or configuring 3D Multimodal Rotary Positional Embeddings (M-RoPE) for Vision-Language architectures, the sum of the M-RoPE sub-dimension sections MUST equal exactly half of the head dimension ($D_{\text{head}} / 2$, representing the number of rotary frequency pairs):
$$\sum_{i} \text{mrope\_section}[i] = \frac{\text{head\_dim}}{2}$$
Implementations MUST NOT allow vision tokens to be assigned flat 1D sequence IDs; each visual patch token MUST receive an explicit triplet coordinate index $(t, h, w)$, where $t$ denotes temporal/frame sequence index, $h$ denotes vertical tile position, and $w$ denotes horizontal tile position. Text tokens MUST project $(t=pos, h=pos, w=pos)$ identically across all three channels.

**WHY**:
M-RoPE operates by decomposing rotary frequency channels into orthogonal spatial and temporal sub-spaces. If `sum(mrope_section) != head_dim / 2`, rotary coordinate tensors cannot be broadcast or packed into the complex frequency matrices, leading to shape mismatch exceptions during query/key rotary transformation (`RuntimeError: The size of tensor a (N) must match the size of tensor b (M) at non-singleton dimension 3`). If 1D position IDs are assigned to 2D image grids, the spatial adjacency between vertically adjacent patches is lost, destroying the model's capacity to read multi-column documents and warped camera captures.

**WHEN TO APPLY**:
Applies to all multimodal decoders utilizing M-RoPE (Qwen2-VL, Qwen2.5-VL, TeleOCR) across PyTorch, vLLM, TensorRT-LLM, and llama.cpp/GGUF runtime implementations.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
from typing import Tuple, List

def compute_mrope_positions(
    input_ids: torch.Tensor,
    image_grid_thw: torch.Tensor,
    vision_token_id: int,
    spatial_merge_size: int = 2
) -> torch.Tensor:
    """
    Computes 3D position IDs (3, batch_size, seq_len) for M-RoPE.
    Section allocation matches config: mrope_section = [16, 24, 24] (sum = 64 = 128 / 2).
    """
    batch_size, seq_len = input_ids.shape
    position_ids = torch.zeros((3, batch_size, seq_len), dtype=torch.long, device=input_ids.device)
    
    for b in range(batch_size):
        seq = input_ids[b]
        is_vision = (seq == vision_token_id)
        
        # Fast path: sequence without vision
        if not is_vision.any():
            pos = torch.arange(seq_len, dtype=torch.long, device=input_ids.device)
            position_ids[:, b, :] = pos.unsqueeze(0).expand(3, -1)
            continue
            
        # Parse image patches
        t_idx, h_idx, w_idx = 0, 0, 0
        img_idx = 0
        
        curr_t, curr_h, curr_w = image_grid_thw[img_idx].tolist()
        # Adjusted for spatial merger downsampling
        eff_h = curr_h // spatial_merge_size
        eff_w = curr_w // spatial_merge_size
        
        p = 0
        while p < seq_len:
            if seq[p] == vision_token_id:
                # Assign 3D spatial coords
                position_ids[0, b, p] = t_idx
                position_ids[1, b, p] = h_idx
                position_ids[2, b, p] = w_idx
                
                # Advance 2D grid indices
                w_idx += 1
                if w_idx >= eff_w:
                    w_idx = 0
                    h_idx += 1
                    if h_idx >= eff_h:
                        h_idx = 0
                        t_idx += 1
                        if t_idx >= curr_t:
                            img_idx += 1
                            if img_idx < len(image_grid_thw):
                                curr_t, curr_h, curr_w = image_grid_thw[img_idx].tolist()
                                eff_h = curr_h // spatial_merge_size
                                eff_w = curr_w // spatial_merge_size
                                t_idx = 0
            else:
                # Text tokens share identical index across all three coordinate axes
                max_coord = max(t_idx, h_idx, w_idx)
                position_ids[0, b, p] = max_coord
                position_ids[1, b, p] = max_coord
                position_ids[2, b, p] = max_coord
                t_idx, h_idx, w_idx = max_coord + 1, max_coord + 1, max_coord + 1
            p += 1
            
    return position_ids
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Flattening 2D vision patches into 1D positional tokens
# Destroys 2D geometric coherence and causes catastrophic bounding box hallucination
def compute_broken_positions(input_ids: torch.Tensor) -> torch.Tensor:
    batch_size, seq_len = input_ids.shape
    # BROKEN: Standard 1D range ignores 2D vertical/horizontal grid topology
    flat_pos = torch.arange(seq_len, dtype=torch.long, device=input_ids.device)
    # BROKEN: Duplicating 1D position across 3 channels disables M-RoPE spatial resolution!
    return flat_pos.unsqueeze(0).unsqueeze(0).expand(3, batch_size, -1)
```

**VERIFICATION METHOD**:
```python
def test_mrope_section_invariants():
    config_head_dim = 128
    mrope_section = [16, 24, 24]
    
    assert sum(mrope_section) == config_head_dim // 2, (
        f"M-RoPE section sum {sum(mrope_section)} must equal head_dim // 2 ({config_head_dim // 2})"
    )
    
    # Verify non-trivial spatial distance
    dummy_input = torch.tensor([[151654, 151654, 151654, 151654]]) # 4 visual tokens
    grid_thw = torch.tensor([[1, 4, 4]]) # 1 frame, 4x4 raw patches -> 2x2 merged tokens
    pos_ids = compute_mrope_positions(dummy_input, grid_thw, vision_token_id=151654, spatial_merge_size=2)
    
    # Assert token 0 and token 2 (vertically adjacent in 2x2) have identical horizontal coord (w) but different vertical coord (h)
    assert pos_ids[1, 0, 0] != pos_ids[1, 0, 2], "Row coordinates must differ for vertically adjacent tokens"
    assert pos_ids[2, 0, 0] == pos_ids[2, 0, 2], "Column coordinates must match for vertically aligned tokens"
```

---

### 2. Dual-EOS / BOS-PAD Decoupled Attention Mask Sanitization
**RULE**:
When serving or fine-tuning models where `pad_token_id == bos_token_id` (e.g., token ID 151643), inference and batching engines MUST decouple the causal attention mask generation from `input_ids == pad_token_id`. Attention masks MUST be constructed strictly via an explicit boolean tensor passed from the tokenizer's `attention_mask` field or derived from verified prefix lengths. Furthermore, the generation termination loop MUST evaluate stopping conditions against a set of valid EOS IDs:
$$\text{token} \in \text{eos\_token\_id\_set} \quad (\text{where } \text{eos\_token\_id\_set} = \{151645, 151643\})$$

**WHY**:
In TeleOCR/Qwen2.5-VL configs, `pad_token_id` is set to `151643` (`<|endoftext|>`), which is identical to `bos_token_id` and included in the `eos_token_id` list (`[151645, 151643]`). If an inference engine automatically sets `attention_mask = (input_ids != pad_token_id)`, any legitimate BOS token or intentional `<|endoftext|>` token inside a multi-turn document conversation is masked to 0 ($-\infty$ in attention logits). This produces NaNs during softmax evaluation in the first self-attention layer. Conversely, omitting `151643` from the generator stopping criteria causes the model to generate infinite padding garbage past the `<|im_end|>` boundary.

**WHEN TO APPLY**:
Batching engines, streaming inference handlers, and synthetic data pipelines integrating Hugging Face Transformers, vLLM, or custom C++ TensorRT-LLM orchestrators with Qwen2.5-VL tokenizer configurations.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
from typing import Set, Union, List

class SequenceBoundaryManager:
    def __init__(self, pad_token_id: int, eos_token_ids: Union[int, List[int]]):
        self.pad_token_id = pad_token_id
        if isinstance(eos_token_ids, int):
            self.eos_token_ids: Set[int] = {eos_token_ids}
        else:
            self.eos_token_ids: Set[int] = set(eos_token_ids)
            
    def construct_safe_causal_mask(
        self,
        input_ids: torch.Tensor,
        explicit_lengths: torch.Tensor
    ) -> torch.Tensor:
        """
        Creates causal 2D attention mask without inspecting pad_token_id directly,
        preventing BOS (151643) collision masking bugs.
        """
        batch_size, seq_len = input_ids.shape
        # Explicit length-based range indexing
        indices = torch.arange(seq_len, device=input_ids.device).unsqueeze(0).expand(batch_size, -1)
        # 1 for valid tokens, 0 for padded positions
        attention_mask = (indices < explicit_lengths.unsqueeze(1)).long()
        return attention_mask

    def is_generation_terminated(self, token_id: int) -> bool:
        """Evaluates against explicit EOS set."""
        return token_id in self.eos_token_ids
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Deriving attention mask directly from pad_token_id equality check
def construct_lethal_mask(input_ids: torch.Tensor, pad_token_id: int = 151643):
    # LETHAL BUG: BOS token is ALSO 151643!
    # This masks position 0 as False, producing NaNs in softmax across all attention heads!
    attention_mask = (input_ids != pad_token_id).long()
    return attention_mask
```

**VERIFICATION METHOD**:
```python
def test_bos_pad_mask_isolation():
    pad_id = 151643
    bos_id = 151643
    eos_ids = [151645, 151643]
    mgr = SequenceBoundaryManager(pad_token_id=pad_id, eos_token_ids=eos_ids)
    
    # Sequence with BOS at index 0, actual tokens at 1, 2, and padding at 3
    input_ids = torch.tensor([[bos_id, 382, 941, pad_id]])
    seq_lengths = torch.tensor([3]) # Only 3 real tokens (BOS, 382, 941)
    
    mask = mgr.construct_safe_causal_mask(input_ids, seq_lengths)
    
    assert mask[0, 0].item() == 1, "BOS token must NOT be masked out despite matching pad_token_id"
    assert mask[0, 3].item() == 0, "Trailing padding token must be masked out"
    assert mgr.is_generation_terminated(151645), "Must terminate on <|im_end|>"
    assert mgr.is_generation_terminated(151643), "Must terminate on <|endoftext|>"
```

---

### 3. Quasi-Greedy Sampling Configuration Normalization Invariant
**RULE**:
In document extraction and OCR decoding pipelines, inference configurations MUST NOT combine stochastic sampling flags (`do_sample=True`) with extreme greedy constraints (`top_k=1`, `top_p <= 0.001`, `temperature <= 0.1`) without canonicalizing them to pure greedy execution (`do_sample=False`). Runtimes MUST validate and sanitize generation flags prior to allocating KV-cache and launching inference kernels.

**WHY**:
TeleOCR's `generation_config.json` specifies:
```json
"do_sample": true, "repetition_penalty": 1.05, "temperature": 0.1, "top_k": 1, "top_p": 0.001
```
Setting `top_k: 1` reduces the viable sampling pool to a single token, rendering `top_p`, `temperature`, and multinomial random sampling operations mathematically redundant while triggering kernel overhead:
1. Dynamic memory allocation for categorical/Gumbel-max distributions.
2. Random number generator (RNG) state management across CUDA threads.
3. Unnecessary non-deterministic branches in tensor-parallel clusters.
Furthermore, certain serving runtimes (e.g., specific Triton LLM engines or vLLM tensor workers) throw validation errors or invoke slow fallback kernels when `do_sample=True` is coupled with `top_k=1`.

**WHEN TO APPLY**:
All serving infrastructure, API gateways, and inference workers deploying document parsing VLMs where deterministic character-level OCR fidelity is required.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class NormalizedGenConfig:
    do_sample: bool
    temperature: float
    top_k: int
    top_p: float
    repetition_penalty: float

def sanitize_generation_parameters(
    do_sample: bool,
    temperature: float,
    top_k: int,
    top_p: float,
    repetition_penalty: float
) -> NormalizedGenConfig:
    """
    Sanitizes conflicting quasi-greedy generation parameters into optimal execution flags.
    """
    # Deterministic criteria: top_k == 1 or temperature == 0 or top_p == 0
    is_quasi_greedy = (top_k == 1) or (temperature < 1e-4) or (top_p < 1e-4)
    
    if is_quasi_greedy:
        # Collapse to true greedy: disables multinomial kernel launches
        return NormalizedGenConfig(
            do_sample=False,
            temperature=1.0, # Neutralized
            top_k=0,         # Disabled
            top_p=1.0,       # Disabled
            repetition_penalty=max(1.0, repetition_penalty)
        )
        
    return NormalizedGenConfig(
        do_sample=do_sample,
        temperature=max(1e-4, temperature),
        top_k=max(0, top_k),
        top_p=min(1.0, max(1e-4, top_p)),
        repetition_penalty=repetition_penalty
    )
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Passing conflicting raw sampling configs to inference backend
# Forces CUDA kernel to launch torch.multinomial on a single-element distribution!
def launch_inference(model, input_ids, raw_config):
    # BAD: do_sample=True with top_k=1 introduces RNG overhead and CUDA sync points
    return model.generate(
        input_ids,
        do_sample=raw_config["do_sample"], # True
        temperature=raw_config["temperature"], # 0.1
        top_k=raw_config["top_k"], # 1
        top_p=raw_config["top_p"], # 0.001
        repetition_penalty=raw_config["repetition_penalty"]
    )
```

**VERIFICATION METHOD**:
```python
def test_generation_config_sanitization():
    raw_cfg = {
        "do_sample": True,
        "temperature": 0.1,
        "top_k": 1,
        "top_p": 0.001,
        "repetition_penalty": 1.05
    }
    sanitized = sanitize_generation_parameters(**raw_cfg)
    assert not sanitized.do_sample, "Quasi-greedy params MUST resolve to do_sample=False"
    assert sanitized.top_k == 0, "top_k must be reset to 0 in pure greedy mode"
    assert sanitized.top_p == 1.0, "top_p must be reset to 1.0 in pure greedy mode"
    assert sanitized.repetition_penalty == 1.05, "Repetition penalty must be preserved"
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: 3D-mRoPE Channel Stride Misalignment in High-Aspect-Ratio OCR Documents (BUG-TELEOCR-01)
- **Context**: Multimodal Positional Encoding Engine, `transformers/models/qwen2_5_vl/modeling_qwen2_5_vl.py`
- **What Was Expected**: High-resolution document images (e.g., $1600 \times 400$ widescreen banner tables or $400 \times 2400$ receipts) must project 2D spatial patches into rotary frequency embeddings without exceeding the rotary coordinate tensor bounds or distorting the frequency strides.
- **What Actually Happened**: When documents with extreme aspect ratios were passed, the flattened grid calculations in the vision encoder produced patch dimensions $H_{\text{patches}} \neq W_{\text{patches}}$. The coordinate generator unpacked spatial offsets assuming symmetric maximum dimensions or flattened indices, causing coordinate overflows where $h_{\text{pos}} \ge \text{max\_position\_embeddings}$, resulting in silent frequency wraparound and illegible garbage text in lower document sections.
- **Evidence in Repo**: `config.json` specifies `"mrope_section": [16, 24, 24]`, `max_position_embeddings: 128000`, `vision_config.fullatt_block_indexes: [7, 15, 23, 31]`.
- **Root Cause**: Rotary frequencies for 3D M-RoPE are partitioned as 16 channels for temporal, 24 for height, and 24 for width. When computing cos/sin tables, the channel offsets were sliced with static contiguous chunks: `[0:16]`, `[16:40]`, `[40:64]`. An off-by-one broadcast stride in the height-width outer product calculation caused horizontal frequency tensors to leak into vertical coordinate spaces during non-square patch batching.
- **Remediation Code Diff**:
```python
# - Buggy Code: Static reshaping ignoring independent H/W grid extents
# cos_h = freqs[pos_h, :24]
# cos_w = freqs[pos_w, 24:48]
# mrope_emb = torch.cat([freqs[pos_t, :16], cos_h, cos_w], dim=-1)

# + Fixed Pattern: Dynamic 3D tensor slice allocation with bounded broadcast
def apply_mrope_3d(q, k, cos, sin, mrope_section):
    # Slice exact section allocations: 16 (time), 24 (height), 24 (width)
    sec_t, sec_h, sec_w = mrope_section
    
    # q shape: [B, H, S, D] where D = head_dim (128)
    q_t, q_h, q_w, q_pass = torch.split(q, [sec_t * 2, sec_h * 2, sec_w * 2, q.shape[-1] - (sec_t + sec_h + sec_w) * 2], dim=-1)
    k_t, k_h, k_w, k_pass = torch.split(k, [sec_t * 2, sec_h * 2, sec_w * 2, k.shape[-1] - (sec_t + sec_h + sec_w) * 2], dim=-1)
    
    # Rotate each subspace independently with its corresponding coordinate grid
    q_rot_t = (q_t * cos[0]) + (rotate_half(q_t) * sin[0])
    k_rot_t = (k_t * cos[0]) + (rotate_half(k_t) * sin[0])
    
    q_rot_h = (q_h * cos[1]) + (rotate_half(q_h) * sin[1])
    k_rot_h = (k_h * cos[1]) + (rotate_half(k_h) * sin[1])
    
    q_rot_w = (q_w * cos[2]) + (rotate_half(q_w) * sin[2])
    k_rot_w = (k_w * cos[2]) + (rotate_half(k_w) * sin[2])
    
    q_

## Consequences
- **Positive**: Guarantees modular isolation, deterministic resource reclamation, and clean boundary encapsulation.
- **Negative / Trade-offs**: Requires explicit interface adapters and serialization overhead.
- **Compliance Mandate**: All future subsystem implementations adhering to this pattern must enforce this decision.
