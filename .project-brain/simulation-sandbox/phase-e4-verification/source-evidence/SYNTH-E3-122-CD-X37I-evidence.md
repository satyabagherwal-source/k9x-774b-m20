# Source Evidence Dossier: SYNTH-E3-122-CD-X37I
- **Title**: Insight III: **Partial RoPE Application**
- **Repository**: openbmb/MiniCPM-V-4.7-1B
- **Source Commit**: hf-openbmb-m
- **Parent Dossier**: 07_PROJECT_LEARNING/hf-openbmb-minicpm-v-4.7-1b-learnings.md
- **Primary Domain**: M (Feedback & Evolution Intelligence)
- **Mechanism**: Partial Rotary Positional Embedding (Partial RoPE) Head Splitting

---

## Forensic Source Excerpt

```
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hf-openbmb-minicpm-v-4.7-1b-learnings.md`  
> **Source**: huggingface ([https://huggingface.co/openbmb/MiniCPM-V-4.7-1B](https://huggingface.co/openbmb/MiniCPM-V-4.7-1B))  
> **Source Version**: `hf-openbmb-m`  
> **License**: Open-Source  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-09T12:52:41.265Z  
> **Learning ID**: `learn-huggingface-openbmb-minicpm-v-4-7-1b`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): openbmb/MiniCPM-V-4.7-1B

---

## 1. Executive Forensic Architecture & System Mechanics

MiniCPM-V-4.7-1B represents an edge-optimized, high-density multimodal large language model (MLLM) architecture combining an intra-ViT early-compressed vision transformer, a hybrid linear-attention/full-attention autoregressive backbone (`qwen3_5_text`), and Canvas-style 3D Multimodal Rotary Position Embeddings (MRoPE).

```
[ Input Resolution: 980x980 Native / Multi-Slice Canvas ]
                    │
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
│  - Spatial Tokens: <image>, <slice>, </slice
```
