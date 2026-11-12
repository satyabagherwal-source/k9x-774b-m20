# Source Evidence Dossier: SYNTH-E3-108-CD-YKUY
- **Title**: Patch Size Divisibility for Vision Encoder
- **Repository**: openbmb/MiniCPM-V-4.7-1B
- **Source Commit**: hf-openbmb-m
- **Parent Dossier**: 07_PROJECT_LEARNING/hf-openbmb-minicpm-v-4.7-1b-learnings.md
- **Primary Domain**: H (Technical Construction Intelligence)
- **Mechanism**: Vision Transformer Patch Divisibility & Spatial Clamping

---

## Forensic Source Excerpt

```
             ▼
┌────────────────────────────────────────────────────────┐
│     Vision Transformer Subsystem (minicpmv4_7_vision)  │
│  - 27 Transformer Layers (dim=1152, heads=16)         │
│  - Patch size: 14x14 -> 70x70 = 4900 Patches           │
│  - Intra-ViT Early Token Compression at Layer 6        │
│    (Downsample Mode: 16x Reduction -> 306 tokens)      │
└───────────────────┬────────────────────────────────────┘
                    │ Projected Feature Map
                    ▼
┌────────────────────────────────────────────────────────┐
│    Multimodal Resampler & Slice/Canvas Boundary Tokens │
│  - Spatial Tokens: <image>, <slice>, </slice>, </image>│
│  - 3D MRoPE Injection (Canvas mode: [11, 11, 10] dims) │
└───────────────────┬────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│      Hybrid LLM Backbone Subsystem (qwen3_5_text)      │
│  - 24 Transformer/SSM Layers (Hidden Dim: 1024)        │
│  - 3:1 Hybrid Ratio: 3x Linear Attention (Mamba SSM)   │
│                      1x Full Self-Attention (GQA: 8/2) │
│  - SSM State Dtype: float32 (SSM numerical stability)  │
│  - Output Gate Activation: SiLU                        │
│  - Multi-Token Prediction (MTP) Layer: 1 Hidden Layer  │
│  - Context Window: 262,144 tokens (256k context)       │
└───────────────────┬────────────────────────────────────┘
                    │
                    ▼
[ Output Vocabulary Head: 248,094 tokens, Untied Embeddings ]
```

### Subsystem Boundaries & Decoupling Invariants
1. **Intra-ViT Compression Isolation (`insert_layer_id: 6`)**: Unlike traditional visual backbones (CLIP/SigLIP) that pass all spatial tokens through all encoder layers and downsample solely at the projector bridge, MiniCPM-V 4.7 terminates full token resolution at layer 6 of 27. From layer 7 through 27, the ViT processes visual features at a 16x spatial reduction factor ($H/4 \time
```
