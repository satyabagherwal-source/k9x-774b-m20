# Source Evidence Dossier: SYNTH-E3-029-CD-BKS6
- **Title**: Deterministic Decoding for Extraction Tasks
- **Repository**: XingChen-AGI/TeleOCR
- **Source Commit**: hf-xingchen-
- **Parent Dossier**: 07_PROJECT_LEARNING/hf-xingchen-agi-teleocr-learnings.md
- **Primary Domain**: M (Feedback & Evolution Intelligence)
- **Mechanism**: Deterministic Decoding Configuration for Structured Extraction

---

## Forensic Source Excerpt

```
Language Decoding Core (Qwen2.5-VL Core)
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
M-RoPE operates by decomposing rotary frequency channels into orthogonal spatial and temporal sub-spaces. If `sum(mrope_section) != head_dim / 2`, rotary coordinate tensors cannot be broadcast or packed into the complex frequency matrices, leading to shape mismatch exceptions during query/key rotary transformation (`RuntimeError: The size of tensor a (N) must match the size of tensor b (M) at non-si
```
