> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hf-openbmb-minicpm-v-4.7-35b-a3b-learnings.md`  
> **Source**: huggingface ([https://huggingface.co/openbmb/MiniCPM-V-4.7-35B-A3B](https://huggingface.co/openbmb/MiniCPM-V-4.7-35B-A3B))  
> **Source Version**: `hf-openbmb-m`  
> **License**: Open-Source  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-13T19:48:05.877Z  
> **Learning ID**: `learn-huggingface-hf-openbmb-minicpm-v-4-7-35b-a3b-mv73fgj9`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full‑Spectrum Forensic Harvest): openbmb/MiniCPM‑V‑4.7‑35B‑A3B

## 1. Executive Forensic Architecture & System Mechanics
The repository implements a 35 B‑parameter multimodal language model that is engineered for **on‑device inference**.  
* **Problem solved** – Deliver a single‑image, multi‑image, and video understanding pipeline that can run deterministically on mobile CPUs/GPUs with < 3 GB RAM while preserving MoE‑level performance.  
* **Subsystem boundaries**  
  * **Tokenizer** – Handles text, image, audio, and video special tokens; exposes a `tokenizer_config.json` that maps token strings to IDs.  
  * **Vision Encoder** – Early‑compression ViT that reduces visual tokens to 4× or 16× resolution (`downsample_mode`).  
  * **Text Encoder** – 40‑layer transformer with a repeating pattern of 3 linear‑attention layers followed by a full‑attention layer.  
  * **MoE Router** – Sparse expert selection (`num_experts=256`, `num_experts_per_tok=8`) with auxiliary loss (`router_aux_loss_coef=0.001`).  
  * **Mamba‑SSM** – Optional