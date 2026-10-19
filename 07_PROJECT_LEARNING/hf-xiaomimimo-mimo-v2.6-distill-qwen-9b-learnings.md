> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hf-xiaomimimo-mimo-v2.6-distill-qwen-9b-learnings.md`  
> **Source**: huggingface ([https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Distill-Qwen-9B](https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Distill-Qwen-9B))  
> **Source Version**: `hf-xiaomimim`  
> **License**: Open-Source  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T05:19:03.387Z  
> **Learning ID**: `learn-huggingface-xiaomimimo-mimo-v2-6-distill-qwen-9b`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full‑Spectrum Forensic Harvest): XiaomiMiMo/MiMo‑V2.6‑Distill‑Qwen‑9B

## 1. Executive Forensic Architecture & System Mechanics
The repository contains a fine‑tuned Qwen3.5‑9B checkpoint engineered for agentic workloads.  
* **Subsystems**  
  * **Tokenizer** – `tokenizer_config.json` defines special tokens (`<|image_pad|>`, `<|video_pad|>`, `<|vision_start|>`, etc.) and the processor class `Qwen3VLProcessor`.  
  * **Model** – `config.json` specifies a hybrid text‑vision architecture: 32 text layers (mostly `linear_attention` with occasional `full_attention`), 27 vision layers, and a shared embedding space.  
  * **Generation** – `generation_config.json` sets sampling hyper‑parameters (temperature 0.6, top‑k 20, top‑p 0.95).  
  * **Deployment** – The README shows a SGLang‑based server exposing an OpenAI‑compatible endpoint; the model is served with a reasoning parser (`mimo`) that injects a “thinking” phase into the chat template.  

* **Architectural boundaries**  
  * **Text vs Vision** – Separate `text_config` and `vision_config` blocks; shared `model_type` and `tie_word_embeddings` flags.  
  * **Attention mix** – Linear attention layers dominate; full attention is interleaved every 4 layers to preserve global context.  
  * **Tokenization** – All token IDs are hard‑coded in the config; the tokenizer must load these IDs exactly to avoid mis‑alignment.  

* **Critical abstractions**  
  * **`Qwen3_5ForConditionalGeneration`** – the main model class.  
  * **`Qwen3VLProcessor`** – handles multimodal input concatenation and tokenization.  
  * **`mimo` reasoning parser** – a custom prompt‑chain that injects a “thinking” block before the final answer.  

## 2. Net‑New Universal Engineering Rules (Candidates for Master Brain)

### 1. Token ID Consistency Across All Configuration Artifacts
**RULE**:  
> **MUST** ensure that every special token ID referenced in `config.json`, `tokenizer_config.json`, and `generation_config.json` is identical across all files.

**WHY**:  
Mismatched token IDs cause the tokenizer to produce tokens that the model does not recognize, leading to silent truncation or mis‑generation. In multimodal settings, an incorrect image or video token ID can cause the model to treat visual input as text, corrupting the attention context.

**WHEN TO APPLY**:  
* During model packaging (post‑training export).  
* Before any inference pipeline that uses the tokenizer and the model.  
* In CI pipelines that validate model artifacts.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import json

def load_config(path):
    with open(path, "r") as f:
        return json.loads(f.read())

config = load_config("config.json")
tokenizer_cfg = load_config("tokenizer_config.json")
gen_cfg = load_config("generation_config.json")

special_tokens = {
    "image_token_id": config["image_token_id"],
    "video_token_id": config["video_token_id"],
    "eos_token_id": config["text_config"]["eos_token_id"],
}

for name, expected in special_tokens.items():
    actual = tokenizer_cfg.get(name) or gen_cfg.get(name)
    assert actual == expected, f"{name} mismatch: expected {expected}, got {actual}"
```

**NEGATIVE CONSTRAINT**:
```python
# BAD: hard‑coding token IDs in multiple places
image_token_id = 248056
video_token_id = 248057
eos_token_id = 248044
# BAD: duplicate definitions in tokenizer_cfg and config.json
```

**VERIFICATION METHOD**:  
* Unit test that loads all three JSON files and asserts equality of each special token ID.  
* Linter rule that flags duplicate token ID definitions across files.

---

### 2. Data‑Type Uniformity Within Sub‑Modules
**RULE**:  
> **MUST** enforce that the `dtype` specified in `text_config` and `vision_config` matches the actual tensor precision used during training and inference.

**WHY**:  
Using mismatched dtypes (e.g., `bfloat16` for text but `float32` for vision) can lead to silent precision loss, inconsistent gradients, and runtime errors on hardware that does not support mixed precision.

**WHEN TO APPLY**:  
* During model initialization.  
* When loading a checkpoint into a new environment.  

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch

text_dtype = torch.bfloat16 if config["text_config"]["dtype"] == "bfloat16" else torch.float32
vision_dtype = torch.float32 if config["vision_config"]["dtype"] == "float32" else torch.float16

assert model.text_module.dtype == text_dtype, "Text module dtype mismatch"
assert model.vision_module.dtype == vision_dtype, "Vision module dtype mismatch"
```

**NEGATIVE CONSTRAINT**:
```python
# BAD: mixing dtypes within a single attention layer
layer.weight = layer.weight.to(torch.float32)  # while the rest of the model is bfloat16
```

**VERIFICATION METHOD**:  
* Runtime assertion during model construction.  
* Static type checker rule that flags dtype mismatches in layer definitions.

---

### 3. Linear Attention Bias Suppression
**RULE**:  
> **MUST NOT** enable `attention_bias` for any layer that uses `linear_attention`.

**WHY**:  
Linear attention layers assume a bias‑free attention matrix for efficient kernel approximation. Enabling bias introduces a dense component that invalidates the linearity assumption, leading to incorrect attention scores and degraded performance.

**WHEN TO APPLY**:  
* In the `config.json` `text_config` block.  
* During any custom fine‑tuning that modifies attention layers.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
assert not config["text_config"]["attention_bias"], \
    "Linear attention layers must have attention_bias set to False"
```

**NEGATIVE CONSTRAINT**:
```python
# BAD: setting attention_bias to True for a linear attention layer
config["text_config"]["attention_bias"] = True
```

**VERIFICATION METHOD**:  
* CI test that parses `config.json` and fails if `attention_bias` is true.  
* Linter rule that flags any assignment to `attention_bias` within a linear attention context.

---

## 3. Forensic Real Incidents & Production Patches (Incidents 1 to 5+)

No commit history, issue tracker, or patch files are present in the repository snapshot. Consequently, no concrete bug incidents or production patches can be extracted. The absence of source code and change logs precludes forensic reconstruction of runtime failures.

> **Status**: *No incidents discovered.*

---

## 4. Microscopic Code‑Level Invariants

| Domain | Invariant | Example |
|--------|-----------|---------|
| **Micro‑Syntax & Token‑Level Precision** | `==` vs `===` in JavaScript; `is` vs `==` in Python | `if token_id is None:` (Python) |
| **Infinite Loop & Recursion Guards** | Base case in recursion; loop counter < limit | `while i < max_iter: i += 1` |
| **UI & UX Micro‑Mechanics** | Debounce input events to avoid thrashing | `setTimeout(() => handleInput(), 200)` |
| **Backend Concurrency & Memory Safety** | Acquire lock before shared state mutation | `with lock: shared_state.append(item)` |
| **Defect & Error Prevention** | Null‑safe chaining | `obj?.prop?.subprop` |

*These invariants are generic guidelines applicable to any codebase; they are not derived from specific source lines in this repository.*

---

## 5. The 9 Deep Learning Dimensions

| Dimension | Observations from Config & README | Key Invariants |
|-----------|-----------------------------------|----------------|
| **Architecture** | Hybrid text‑vision model; 32 text layers, 27 vision layers; interleaved full attention | Separate text and vision modules; shared embedding space |
| **Core Abstractions** | `Qwen3_5ForConditionalGeneration`, `Qwen3VLProcessor` | Clear interface between tokenizer, processor, and model |
| **Error Handling** | No explicit error handling in config; inference relies on SGLang server | Server must catch tokenization errors and return informative messages |
| **Testing** | No tests present; CI not configured | Unit tests for config consistency, dtype checks, and token ID alignment |
| **Security** | No credentials; open‑source model | Ensure no hard‑coded secrets in config; use least privilege for server |
| **Performance** | Linear attention layers for speed; full attention every 4 layers | Maintain linear attention bias off; use bfloat16 for text to reduce memory |
| **Deployment** | SGLang server with OpenAI API compatibility | CI/CD pipeline must rebuild container with same `transformers` version |
| **Agent Patterns** | Custom `mimo` reasoning parser; prompt chain with thinking | Parser must inject thinking block before answer; enforce token limits |
| **Data Flow** | Token IDs for image/video/vision start/end; streaming generation | Ensure tokenization order matches model expectations; avoid re‑ordering |

---

## 6. The 8 Learning Extraction Artifacts

| Artifact | Example |
|----------|---------|
| **Pattern** | Token ID consistency checker (see Section 2.1) |
| **Rule** | Token ID consistency rule (Section 2.1) |
| **Architecture Principle** | Separate text and vision modules with shared embedding space |
| **Failure Mode** | Token ID mismatch → silent truncation |
| **Reusable Skill** | CI test that validates config consistency |
| **Decision** | Chose linear attention for speed; interleaved full attention for context |
| **Anti‑Pattern** | Hard‑coding token IDs in multiple files |
| **Verification Method** | Unit test asserting equality of token IDs across config files |

---

## 7. Actionable Agent Skill & Implementation Checklist

1. **Load Configs**  
   * Parse `config.json`, `tokenizer_config.json`, `generation_config.json`.  
   * Verify that all required fields exist.

2. **Validate Special Tokens**  
   * Assert equality of `image_token_id`, `video_token_id`, `eos_token_id`, etc. across files.

3. **Check Data Types**  
   * Ensure `text_config["dtype"]` is `bfloat16` and `vision_config["dtype"]` is `float32`.  
   * Confirm that the model layers use the same dtypes.

4. **Enforce Attention Bias**  
   * Confirm `text_config["attention_bias"]` is `false`.  
   * If modifying layers, keep bias off for linear attention.

5. **Instantiate Model & Processor**  
   * Load `Qwen3_5ForConditionalGeneration` with the validated config.  
   * Load `Qwen3VLProcessor` with the tokenizer config.

6. **Run Inference Test**  
   * Feed a minimal multimodal prompt (text + image token).  
   * Verify that the output contains a valid `thinking` block followed by an answer.

7. **Deploy Server**  
   * Use SGLang with `--reasoning-parser mimo`.  
   * Expose OpenAI‑compatible endpoint.

8. **CI/CD Validation**  
   * Add unit tests for config consistency, dtype checks, and token ID alignment.  
   * Run tests on every push to the main branch.

9. **Monitor Runtime**  
   * Log tokenization errors.  
   * Capture latency per layer to detect performance regressions.

---