> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hf-xiaomimimo-mimo-v2.6-distill-qwen-9b-learnings.md`  
> **Source**: huggingface ([https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Distill-Qwen-9B](https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Distill-Qwen-9B))  
> **Source Version**: `hf-xiaomimim`  
> **License**: Open-Source  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-13T12:53:38.751Z  
> **Learning ID**: `learn-huggingface-hf-xiaomimimo-mimo-v2-6-distill-qwen-9b-mv6omgxr`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full‑Spectrum Forensic Harvest): XiaomiMiMo/MiMo‑V2.6‑Distill‑Qwen‑9B

---

## 1. Executive Forensic Architecture & System Mechanics  

The repository is a **fine‑tuned Qwen3.5‑9B** checkpoint tailored for *agentic* workloads (coding, visual coding, cybersecurity, tool‑use).  
The artifact is a **single‑model package** that contains:

| Subsystem | File(s) | Responsibility |
|-----------|---------|----------------|
| **Tokenizer** | `tokenizer_config.json` | Defines special tokens, BOS/EOS, padding, and the processor class (`Qwen3VLProcessor`). |
| **Model Configuration** | `config.json` | Holds the architecture definition (`Qwen3_5ForConditionalGeneration`), layer topology, attention types, hidden dimensions, and token IDs. |
| **Generation Settings** | `generation_config.json` | Sampling hyper‑parameters (temperature, top‑k/p, eos tokens). |
| **Metadata** | `README.md` | Describes training data, evaluation, and deployment instructions. |

### Architectural Boundaries  

1. **Model Layer Stack** – 32 hidden layers, each defined by `layer_types` (mix of `linear_attention` and `full_attention`).  
2. **Tokenization Layer** – Separate text and vision tokenizers share a unified vocabulary (`vocab_size: 248320`).  
3. **Vision Backbone** – Vision encoder (`vision_config`) is a 27‑layer Conv‑Transformer with 16 heads and 1152 hidden size.  
4. **Cross‑Modal Fusion** – The processor (`Qwen3VLProcessor`) merges image/video tokens into the text stream via special pad tokens (`<|image_pad|>`, `<|video_pad|>`).  
5. **Inference Engine** – Exposed through SGLang’s `serve` command; the model is wrapped in a `Qwen3_5ForConditionalGeneration` class that handles caching and beam search.

### Critical Subsystem Abstractions  

| Abstraction | Core Types | Invariant Contracts |
|-------------|------------|---------------------|
| **Tokenizer** | `Qwen2Tokenizer`, `Qwen3VLProcessor` | `add_prefix_space` must be `false`; `model_max_length` must match `max_position_embeddings`. |
| **Attention** | `LinearAttention`, `FullAttention` | `num_attention_heads` must divide `hidden_size`; `num_key_value_heads` must be ≤ `num_attention_heads`. |
| **Vision Encoder** | `VisionTransformer` | `patch_size` must divide image dimensions; `num_position_embeddings` must equal `patch_grid_size`. |
| **Generation** | `GenerationConfig` | `eos_token_id` list must contain all EOS tokens used by the tokenizer. |

---

## 2. Net‑New Universal Engineering Rules (Candidates for Master Brain)

### 1. Consistent Token ID Alignment Across All Subsystems  
**RULE**:  
> **MUST** ensure that every special token ID referenced in `config.json` (e.g., `image_token_id`, `video_token_id`, `eos_token_id`) is defined in `tokenizer_config.json` and that the IDs are unique across the entire vocabulary.  
**WHY**:  
Mismatched or duplicate token IDs cause the model to misinterpret padding or EOS signals, leading to truncated outputs or infinite loops during decoding.  
**WHEN TO APPLY**:  
During any change to the tokenizer or model config in a text‑vision multimodal system.  
**VERIFIED IMPLEMENTATION PATTERN**:
```json
// tokenizer_config.json
{
  "image_token_id": 248056,
  "video_token_id": 248057,
  "eos_token_id": 248044,
  "pad_token_id": 0,
  "vocab_size": 248320
}

// config.json
{
  "image_token_id": 248056,
  "video_token_id": 248057,
  "text_config": {
    "eos_token_id": 248044,
    "pad_token_id": 0
  }
}
```
**NEGATIVE CONSTRAINT**:
```json
// BAD: duplicate EOS token
{
  "eos_token_id": 248044,
  "pad_token_id": 248044   // collision
}
```
**VERIFICATION METHOD**:  
Run a unit test that parses both JSON files and asserts that all token IDs are distinct and present in the tokenizer’s `vocab` mapping.

### 2. Layer‑Type Count Must Match Hidden Layer Count  
**RULE**:  
> **MUST** guarantee that the length of the `layer_types` array equals the value of `num_hidden_layers`.  
**WHY**:  
A mismatch leads to an incomplete or over‑extended transformer stack, causing shape mismatches during forward passes and silent failures.  
**WHEN TO APPLY**:  
When adding or removing layers in the architecture.  
**VERIFIED IMPLEMENTATION PATTERN**:
```json
{
  "num_hidden_layers": 32,
  "layer_types": [
    "linear_attention", "linear_attention", /* ... 30 more ... */ "full_attention"
  ]
}
```
**NEGATIVE CONSTRAINT**:
```json
{
  "num_hidden_layers": 32,
  "layer_types": ["linear_attention", "full_attention"] // too few
}
```
**VERIFICATION METHOD**:  
A lint rule that compares the two fields and fails if `len(layer_types) != num_hidden_layers`.

### 3. Attention Head Dimensionality Consistency  
**RULE**:  
> **MUST** ensure that `hidden_size` is divisible by `num_attention_heads` and that `num_key_value_heads` divides `num_attention_heads`.  
**WHY**:  
Non‑divisible dimensions break the linear projection matrices, causing runtime errors or degraded performance.  
**WHEN TO APPLY**:  
During any change to `hidden_size`, `num_attention_heads`, or `num_key_value_heads`.  
**VERIFIED IMPLEMENTATION PATTERN**:
```json
{
  "hidden_size": 4096,
  "num_attention_heads": 16,
  "num_key_value_heads": 4
}
```
**NEGATIVE CONSTRAINT**:
```json
{
  "hidden_size": 4096,
  "num_attention_heads": 15   // 4096 % 15 != 0
}
```
**VERIFICATION METHOD**:  
A pre‑commit hook that checks the divisibility constraints and aborts the commit if violated.

---

## 3. Forensic Real Incidents & Production Patches (Incidents 1 to 5+)

> **No production incidents or bug fixes were found in the public commit history or issue tracker for this repository.**  
> The repository contains only the final checkpoint artifacts and a README; therefore, the forensic record for incidents is empty.

---

## 4. Microscopic Code‑Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

| Domain | Invariant | Example |
|--------|-----------|---------|
| **Micro‑Syntax & Token‑Level Precision** | **No stringified numeric values** – numeric fields must be numbers, not quoted strings. | `\"hidden_size\": 4096` **vs** `\"hidden_size\": \"4096\"` |
| | **Consistent quoting** – all keys and string values must use double quotes per JSON spec. | `\"model_type\": \"qwen3_5_text\"` |
| | **No duplicate keys** – each key appears once per object. | `\"eos_token_id\": 248044` appears only once. |
| **Infinite Loop & Recursion Guards** | **No recursive references in config** – `layer_types` must not contain a reference to itself. | Not applicable; config is flat. |
| **UI & UX Micro‑Mechanics** | **Not applicable** – repository contains no UI code. |
| **Backend Concurrency & Memory Safety** | **No shared mutable state** – config files are immutable at runtime. | The model loads config once; no global mutation. |
| **Defect & Error Prevention (“Galti Pakadna”)** | **Null/undefined checks** – `eos_token_id` must be defined; fallback to default if missing. | `eos_token_id = config.text_config.eos_token_id ?? 50256;` |
| | **Boundary checks** – `max_position_embeddings` must be ≥ `model_max_length`. | `assert(config.text_config.max_position_embeddings >= tokenizer_config.model_max_length);` |

---

## 5. The 9 Deep Learning Dimensions

| Dimension | Key Findings | Implications |
|-----------|--------------|--------------|
| **Architecture** | 32‑layer Qwen3.5 backbone with mixed linear/full attention; vision encoder 27 layers; cross‑modal fusion via pad tokens. | Enables efficient multimodal inference with linear attention for long contexts. |
| **Core Abstractions** | `Qwen3_5ForConditionalGeneration`, `Qwen2Tokenizer`, `Qwen3VLProcessor`. | Clear separation of text, vision, and processing logic. |
| **Error Handling** | No explicit error handling in config; relies on downstream frameworks (SGLang). | Potential silent failures if config mismatches; requires validation. |
| **Testing** | No tests present. | High risk of undiscovered regressions. |
| **Security** | Token IDs and vocab size are public; no credentials. | Minimal attack surface; however, misuse of special tokens could lead to injection attacks. |
| **Performance** | Linear attention layers reduce complexity to O(n). Vision encoder uses patch embeddings. | Scales to 262k tokens; suitable for long‑form generation. |
| **Deployment** | Exposed via SGLang `serve`; uses `reasoning-parser mimo`. | Requires SGLang runtime; containerized deployment recommended. |
| **Agent Patterns** | `reasoning-parser mimo` indicates a prompt‑chain with explicit thinking. | Supports tool‑use and step‑by‑step reasoning. |
| **Data Flow** | Tokenization → Processor → Model → Generation. | Clear data pipeline; no hidden state mutations. |

---

## 6. The 8 Learning Extraction Artifacts

| Artifact | Example |
|----------|---------|
| **Pattern** | The `layer_types` list must match `num_hidden_layers`. |
| **Rule** | `hidden_size` must be divisible by `num_attention_heads`. |
| **Architecture Principle** | *Layer‑type consistency*: the transformer stack must be fully specified. |
| **Failure Mode** | Mismatched `eos_token_id` leading to truncated outputs. |
| **Reusable Skill** | Validate JSON config against a schema before loading. |
| **Decision** | Chose linear attention for most layers to reduce memory; full attention reserved for key layers. |
| **Anti‑pattern** | Defining duplicate special token IDs. |
| **Verification Method** | Schema validation test that asserts all invariants. |

---

## 7. Actionable Agent Skill & Implementation Checklist

1. **Schema Definition**  
   *Create a JSON schema that captures all required fields and constraints (divisibility, uniqueness).*

2. **Pre‑Commit Validation**  
   *Add a linting hook that parses `config.json` and `tokenizer_config.json` and checks:*
   - `len(layer_types) == num_hidden_layers`
   - `hidden_size % num_attention_heads == 0`
   - `num_key_value_heads <= num_attention_heads`
   - All special token IDs are unique and present in the tokenizer.

3. **Runtime Assertion**  
   *During model initialization, assert that `max_position_embeddings >= tokenizer.model_max_length`.*

4. **Unit Tests**  
   *Write tests that load the config, instantiate the tokenizer, and verify that tokenization of a sample image/video sequence yields the expected token IDs.*

5. **Documentation**  
   *Document the invariant rules in the README and link to the schema.*

6. **Continuous Integration**  
   *Configure CI to run the schema validator and unit tests on every push.*

7. **Monitoring**  
   *Add runtime logging for tokenization errors (e.g., unknown token IDs) and surface them as warnings.*

8. **Rollback Strategy**  
   *Maintain a baseline checkpoint; if a config change breaks inference, revert to the last known good config.*

---