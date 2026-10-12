> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hf-taichuai-zdtaichu5.0-9b-learnings.md`  
> **Source**: huggingface ([https://huggingface.co/TaichuAI/ZDTaichu5.0-9B](https://huggingface.co/TaichuAI/ZDTaichu5.0-9B))  
> **Source Version**: `hf-taichuai-`  
> **License**: Open-Source  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-12T21:47:16.083Z  
> **Learning ID**: `learn-huggingface-hf-taichuai-zdtaichu5-0-9b-mv5s8v03`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full‑Spectrum Forensic Harvest): TaichuAI/ZDTaichu5.0‑9B

## 1. Executive Forensic Architecture & System Mechanics  
The repository implements a multimodal foundation model that fuses a **Qwen3.5‑9B** language backbone with a **C‑RADIOv4‑H** vision encoder.  The system is exposed through the Hugging‑Face `AutoModel`/`AutoProcessor` API, supporting text, single or multiple images, and video inputs of arbitrary resolution.  The architecture is a *causal language model* that interleaves vision tokens (`<|vision_start|> … <|vision_end|>`) with textual tokens, allowing the model to reason over visual content and generate text.  Subsystem boundaries are:

| Subsystem | Responsibility | Key Files / Configs |
|-----------|----------------|---------------------|
| **Tokenizer** | Maps raw text and image tokens to integer IDs. | `tokenizer_config.json` |
| **Vision Encoder** | Processes images/video into embeddings. | `config.json` (`image_tag_type`, `downsample_ratio`, `force_image_size`) |
| **Language Decoder** | Generates text conditioned on vision embeddings. | `config.json` (`llm_config`), `generation_config.json` |
| **Pipeline** | Orchestrates tokenization, encoding, decoding, and post‑processing. | `AutoModel`, `AutoProcessor` mapping in `config.json` |

The system is designed for **any‑resolution visual input** (forced to 512px internally) and a **context length of up to 128K tokens**.  The model’s `llm_config` enumerates a mix of linear and full attention layers, enabling efficient scaling while preserving long‑range dependencies.

## 2. Net‑New Universal Engineering Rules (Candidates for Master Brain)

### 1. **Token ID Uniqueness Rule**  
**RULE**:  
> **MUST** guarantee that every special token ID (e.g., `<|image_pad|>`, `<|vision_start|>`, `<|vision_end|>`, `<|im_end|>`, `<|endoftext|>`) is unique and does not collide with any vocabulary ID or other special token ID.

**WHY**:  
A collision causes the model to misinterpret visual tokens as text or vice‑versa, leading to garbled outputs or silent failures.  In the provided config, `image_token_id` is `248056`, `pad_token_id` is `248040`, and `eos_token_id` is `248046`.  All are distinct, but a developer could inadvertently reuse an ID.

**WHEN TO APPLY**:  
During tokenizer construction, vocabulary expansion, or when adding new modalities.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# tokenizer_config.json
{
  "image_token_id": 248056,
  "pad_token_id": 248040,
  "eos_token_id": 248046,
  "bos_token_id": null,
  "unk_token_id": null,
  "special_tokens": {
    "<|image_pad|>": 248056,
    "<|vision_start|