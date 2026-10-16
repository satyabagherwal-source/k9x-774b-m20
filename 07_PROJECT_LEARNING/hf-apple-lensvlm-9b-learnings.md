> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hf-apple-lensvlm-9b-learnings.md`  
> **Source**: huggingface ([https://huggingface.co/apple/LensVLM-9B](https://huggingface.co/apple/LensVLM-9B))  
> **Source Version**: `hf-apple-len`  
> **License**: Open-Source  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-16T23:11:52.326Z  
> **Learning ID**: `learn-huggingface-apple-lensvlm-9b`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full‑Spectrum Forensic Harvest): apple/LensVLM‑9B

## 1. Executive Forensic Architecture & System Mechanics
LensVLM‑9B is a 9‑billion‑parameter vision‑language model that augments the Qwen3.5‑9B backbone with a **selective context expansion** mechanism.  
The system is split into three logical subsystems:

| Subsystem | Responsibility | Key Files / Configs |
|-----------|----------------|---------------------|
| **Tokenizer** | Handles multimodal tokenization (text, image, video, audio). | `tokenizer_config.json` |
| **Vision Encoder** | Compresses images into a compact representation and expands relevant pages on demand. | `vision_config` section in `config.json` |
| **Text Decoder** | Generates text conditioned on the expanded visual context. | `text_config` section in `config.json` |

The architecture is a **single‑stage encoder‑decoder** that interleaves *linear* and *full* attention layers to keep memory usage low while preserving global context. The model is deployed as a Hugging Face `transformers` pipeline (`image‑text‑to‑text`) and relies on the `Qwen3VLProcessor` to fuse modalities.

### Critical Subsystem Abstractions
* **`Qwen3VLProcessor`** – a composite processor that concatenates image, video, and audio tokens with text tokens, ensuring that special tokens (`<|image_pad|>`, `<|video_pad|>`, `<|audio_start|>`, etc.) are correctly positioned.
* **`Qwen3_5ForConditionalGeneration`** – the core generation head that accepts a multimodal `input_ids` tensor and produces a `generated_ids` tensor.  
* **`VisionEncoder`** – a lightweight CNN (depth = 27, hidden_size = 1152) that outputs a sequence of image tokens.  
* **`LinearAttentionLayer`** – a memory‑efficient attention variant that is interleaved with full attention layers every 4 layers.

The system’s **state ownership** is centralized: the `model` object owns all weights, while the `processor` owns tokenization state. No external mutable state is shared across threads.

---

## 2. Net‑New Universal Engineering Rules (Candidates for Master Brain)

### 1. **Special‑Token Consistency Rule**
**RULE**:  
All special tokens (image, video, audio, vision start/end) must be defined in *both* the tokenizer configuration and the model configuration, and the token IDs must match exactly.

**WHY**:  
Mismatched token IDs cause the processor to inject wrong tokens, leading to mis‑aligned attention and catastrophic generation failures (e.g., the model treats an image token as a text token).

**WHEN TO APPLY**:  
During model initialization, tokenizer loading, and any custom tokenizer extension.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# tokenizer_config.json
{
  "image_token": "<|image_pad|>",
  "video_token": "<|video_pad|>",
  "audio_bos_token": "<|audio_start|>",
  "audio_eos_token": "<|audio_end|>"
}

# config.json
{
  "image_token_id": 248056,
  "video_token_id": 248057,
  "audio_bos_token_id": 248058,
  "audio_eos_token_id": 248059
}
```

**NEGATIVE CONSTRAINT**:
```python
# BAD: mismatched IDs
{
  "image_token_id": 248056,   # correct
  "video_token_id": 999999    # wrong
}
```

**VERIFICATION METHOD**:  
Unit test that loads the tokenizer and model, then asserts:
```python
assert tokenizer.convert_tokens_to_ids("<|image_pad|>") == model.config.image_token_id
assert tokenizer.convert_tokens_to_ids("<|video_pad|>") == model.config.video_token_id
```

---

### 2. **Modality‑Independent Dtype Rule**
**RULE**: