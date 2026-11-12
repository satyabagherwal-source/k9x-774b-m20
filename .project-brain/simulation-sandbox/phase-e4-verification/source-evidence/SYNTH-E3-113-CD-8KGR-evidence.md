# Source Evidence Dossier: SYNTH-E3-113-CD-8KGR
- **Title**: Binary Artifact Versioning & Format Compatibility Invariant
- **Repository**: abenzerps/Qwen-Image-2.1-Uncensored-Quantized
- **Source Commit**: hf-abenzerps
- **Parent Dossier**: 07_PROJECT_LEARNING/hf-abenzerps-qwen-image-2.1-uncensored-quantized-learnings.md
- **Primary Domain**: M (Feedback & Evolution Intelligence)
- **Mechanism**: Binary Model Artifact Magic Header & Format Verification

---

## Forensic Source Excerpt

```
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hf-abenzerps-qwen-image-2.1-uncensored-quantized-learnings.md`  
> **Source**: huggingface ([https://huggingface.co/abenzerps/Qwen-Image-2.1-Uncensored-Quantized](https://huggingface.co/abenzerps/Qwen-Image-2.1-Uncensored-Quantized))  
> **Source Version**: `hf-abenzerps`  
> **License**: Open-Source  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-09T12:17:28.660Z  
> **Learning ID**: `learn-huggingface-abenzerps-qwen-image-2-1-uncensored-quantized`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): abenzerps/Qwen-Image-2.1-Turbo-Quantized

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Problem Statement & Architectural Mission
`abenzerps/Qwen-Image-2.1-Turbo-Quantized` addresses the extreme compute and memory footprint of the **Qwen-Image-2.1-Turbo** 7-billion-parameter text-to-image foundation model. At unquantized 16-bit precision (`bfloat16`/`float16`), weights alone consume ~14–15 GB of high-bandwidth VRAM, before factoring in activation memory, text encoder overhead (e.g., Qwen2-VL or T5/CLIP backbones), cross-attention caches, and VAE decode buffers. In single-GPU consumer deployments (e.g., 8 GB RTX 4060, 12 GB RTX 3060/4070, or Apple Silicon unified memory), raw FP16 inference causes out-of-memory (OOM) faults or paging thrash.

The repository provides cross-runtime, low-bit quantized artifacts targeting three primary execution runtimes:
1. **ComfyUI / ComfyUI-GGUF / `llama.cpp`**: GGUF format quantization variants (`Q8_0`, `Q6_K`, `Q5_K_M`, `Q4_K_M`, `Q4_0`).
2. **Native PyTorch / Diffusers / TensorRT / ComfyUI FP8**: Raw Safetensors quantized using `FP8` (e4m3fn / e5m2), `INT8 ConvRot` (Rotation-matrix Hadamard transformation to suppress activation channel outliers), and `NVFP4` (NVIDIA 4-bit Floating Point).
3. **Apple Silicon / Metal Execution (MLX)**: MLX Safetensors formats (4-bit, 6-bit, and 8-bit quantized linear layers).

### 1.2 System Boundary & Decoupling Topology

```
+---------------------------------------------------------------------------------------------------+
|                                  Ba
```
