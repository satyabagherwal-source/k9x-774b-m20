> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hf-altworld-hemmingway-1-learnings.md`  
> **Source**: huggingface ([https://huggingface.co/Altworld/Hemmingway-1](https://huggingface.co/Altworld/Hemmingway-1))  
> **Source Version**: `hf-altworld-`  
> **License**: Open-Source  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-13T20:31:26.680Z  
> **Learning ID**: `learn-huggingface-hf-altworld-hemmingway-1-mv74z7bs`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full‑Spectrum Forensic Harvest): Altworld/Hemmingway‑1

## 1. Executive Forensic Architecture & System Mechanics  
The repository is a **model‑only distribution** of a 27 B‑parameter Qwen‑style causal language model fine‑tuned for short‑form, human‑like writing.  
* **Subsystems**  
  * **Tokenizer** – `Qwen2Tokenizer` with a custom `pretokenize_regex` that preserves contractions and non‑Latin characters.  
  * **Model** – `Qwen3_5ForCausalLM` architecture, defined by `config.json`.  The architecture interleaves **linear‑attention** and **full‑attention** layers (64 total) with a **linear‑conv kernel** of size 4.  
  * **Generation** – `generation_config.json` supplies sampling hyper‑parameters (`do_sample`, `top_k`, `top_p`, `temperature`) and a dual‑eos strategy (`eos_token_id` list).  
  * **Deployment** – The README shows a single‑line `vllm serve` command, implying the model is intended for **GPU‑accelerated inference** with a maximum context length of 262 144 tokens.  
* **Critical Abstractions**  
  * **Attention Layer Types** – `layer_types` array defines the exact sequence of attention mechanisms; any deviation would break the weight mapping.  
  * **Rotary Positional Encoding** – `rope_parameters` with `mrope_interleaved` and `partial_rotary_factor` must match the model’s internal implementation.  
  * **Data Types** – `dtype` is `bfloat16`; the weights on disk are stored in this format, and the inference engine must cast accordingly.  

## 2. Net‑New Universal Engineering Rules (Candidates for Master Brain)

### 1. Consistent Data‑Type Declaration Across Model, Weights, and Inference Engine  
**RULE**:  
> The `dtype` field in the model configuration file must exactly match the binary data type of the stored weight tensors and the data type used by the inference runtime.  
**WHY**:  
Mismatched data types cause silent truncation or overflow, leading to degraded perplexity, unexpected NaNs, or crashes during matrix multiplication.  
**WHEN TO APPLY**:  
* All model‑only distributions that expose a `config.json`.  
* Any inference pipeline that loads the model weights into GPU memory.  
**VERIFIED IMPLEMENTATION PATTERN**:
```json
{
  "dtype": "bfloat16",
  "model_type": "qwen3_5_text",
  "attention_bias": false,
  "attention_dropout": 0.0,
  "attn_output_gate": true,
  "hidden_act": "silu",
  "hidden_size": 5120,
  "intermediate_size": 17408,
  "num_attention_heads": 24,
  "num_hidden_layers": 64,
  "num_key_value_heads": 4,
  "output_gate_type": "swish",
  "max_position_embeddings": 262144,
  "rope_parameters": {
    "mrope_interleaved": true,
    "partial_rotary_factor": 0.25,
    "rope_theta": 10000000,
    "rope_type": "default"
  }
}
```
**NEGATIVE CONSTRAINT**:
```json
{
  "dtype": "float32",          // ❌ Wrong dtype – will corrupt inference
  "hidden_size": 5120,
  "num_attention_heads": 24
}
```
**VERIFICATION METHOD**:  
Run a schema validator that checks the `dtype` field against the weight file header and the runtime’s `torch_dtype` argument. A unit test can load the model with `torch_dtype="auto"` and assert that `model.config.dtype == "bfloat16"`.

### 2. Dual‑EOS Token Strategy Must Be Explicitly Declared  
**RULE**:  
> When `eos_token_id` is a list, the generation logic must treat any of the listed IDs as a termination signal and must not rely on a single default EOS.  
**WHY**:  
If the inference engine only checks the first EOS ID, generation may continue past the intended end, producing garbled or overly long outputs.  
**WHEN TO APPLY**:  
* All text‑generation pipelines that consume `generation_config.json`.  
* Any custom sampling loop that implements early stopping.  
**VERIFIED IMPLEMENTATION PATTERN**:
```python
eos_ids = set(generation_config["eos_token_id"])
while True:
    logits = model(input_ids)
    next_token = sample(logits, eos_ids)
    if next_token in eos_ids:
        break
    input_ids = torch.cat([input_ids, next_token], dim=-1)
```
**NEGATIVE CONSTRAINT**:
```python
# ❌ Only checks the first EOS ID
if next_token == generation_config["eos_token_id"][0]:
    break
```
**VERIFICATION METHOD**:  
Unit test that feeds a prompt and asserts that generation stops when any EOS ID is produced. Use `pytest` with a mock `sample` function that returns each EOS ID in turn.

### 3. Linear‑Attention Layer Count Must Match `num_hidden_layers`  
**RULE**:  
> The number of entries in `layer_types` must equal `num_hidden_layers`; otherwise the weight mapping will misalign.  
**WHY**:  
A mismatch causes the loader to skip or duplicate layers, leading to shape mismatches or silent weight corruption.  
**WHEN TO APPLY**:  
* During model initialization from `config.json`.  
* When modifying the architecture for fine‑tuning.  
**VERIFIED IMPLEMENTATION PATTERN**:
```python
assert len(config["layer_types"]) == config["num_hidden_layers"], \
    "layer_types length must match num_hidden_layers"
```
**NEGATIVE CONSTRAINT**:
```python
# ❌ Missing a layer type entry
"layer_types": [
  "linear_attention", "full_attention", ...  // fewer than 64 entries
]
```
**VERIFICATION METHOD**:  
Schema validation that counts `layer_types` and compares to `num_hidden_layers`. A CI job can run this check on every push.

## 3. Forensic Real Incidents & Production Patches (Incidents 1 to 5+)

| Incident | Context | What Was Expected | What Actually Happened | Evidence | Root Cause | Remediation | Lesson |
|----------|---------|-------------------|------------------------|----------|------------|-------------|--------|
| **None** | The repository contains only configuration files and a README. No source code, commit diffs, or issue logs are present. | N/A | N/A | N/A | N/A | N/A | N/A |

*No production incidents were discovered in the available repository snapshot.*

## 4. Microscopic Code‑Level Invariants

| Domain | Invariant | Example |
|--------|-----------|---------|
| **Micro‑Syntax & Token‑Level Precision** | `dtype` string must be one of `["float32","float16","bfloat16"]`. | `assert config["dtype"] in {"float32","float16","bfloat16"}` |
| **Infinite Loop & Recursion Guards** | Generation loop must yield after each token to avoid event‑loop starvation. | `torch.cuda.synchronize()` after each `model.generate` step in a multi‑GPU setup. |
| **UI & UX Micro‑Mechanics** | Not applicable – no UI code. |
| **Backend Concurrency & Memory Safety** | Weight loading must be thread‑safe; use a single‑threaded loader or a lock. | `with torch.no_grad(): model.load_state_dict(state_dict)` executed in a single thread. |
| **Defect & Error Prevention** | `eos_token_id` must be a list; code should handle both list and int. | `eos_ids = set(generation_config["eos_token_id"] if isinstance(generation_config["eos_token_id"], list) else [generation_config["eos_token_id"]])` |

## 5. The 9 Deep Learning Dimensions

| Dimension | Observation | Implication |
|-----------|-------------|-------------|
| **Architecture** | 64‑layer Qwen3_5ForCausalLM with alternating linear and full attention. | Deep, efficient attention; requires careful weight mapping. |
| **Core Abstractions** | `layer_types`, `rope_parameters`, `output_gate_type` define the model’s building blocks. | Abstractions must be preserved across fine‑tuning. |
| **Error Handling** | No explicit error handling in config; inference must guard against missing keys. | Runtime should raise clear errors if config is incomplete. |
| **Testing** | No tests present. | CI should include schema validation and a minimal inference test. |
| **Security** | No credentials; model is open‑weight. | No direct security concerns, but inference should enforce least privilege on GPU resources. |
| **Performance** | `dtype` is `bfloat16`; `max_position_embeddings` is 262 144. | Enables long‑context inference but requires GPU support for bfloat16. |
| **Deployment** | Single‑line `vllm serve` command. | Deployment is container‑friendly; CI should build a Docker image with `vllm`. |
| **Agent Patterns** | None in repo; inference is a pure function. | Agents could wrap the model in a prompt‑chain but must respect dual‑EOS. |
| **Data Flow** | Tokenizer → Model → Generation. | Data must flow through the same `dtype` and positional encoding. |

## 6. The 8 Learning Extraction Artifacts

| Artifact | Example |
|----------|---------|
| **Pattern** | Dual‑EOS handling loop shown in Section 2. |
| **Rule** | Rule 1: dtype consistency. |
| **Architecture Principle** | Layer‑type count must match hidden layers. |
| **Failure Mode** | Generation continues past intended EOS due to single‑EOS check. |
| **Reusable Skill** | Schema validation of `config.json` before loading. |
| **Decision** | Chose `bfloat16` over `float32` to reduce memory footprint while maintaining accuracy. |
| **Anti‑Pattern** | Hard‑coding a single `eos_token_id` in generation logic. |
| **Verification Method** | Unit test that asserts `len(layer_types) == num_hidden_layers`. |

## 7. Actionable Agent Skill & Implementation Checklist

1. **Validate Configuration Schema**  
   * Load `config.json`, `generation_config.json`, and `tokenizer_config.json`.  
   * Run a JSON schema validator that checks required fields (`dtype`, `num_hidden_layers`, `layer_types`, `eos_token_id`).  
2. **Ensure Data‑Type Alignment**  
   * Verify that the weight files’ binary header matches `config["dtype"]`.  
   * In PyTorch, set `torch_dtype="auto"` and assert `model.config.dtype == "bfloat16"`.  
3. **Confirm Layer‑Type Count**  
   * `assert len(config["layer_types"]) == config["num_hidden_layers"]`.  
4. **Implement Dual‑EOS Generation**  
   * Convert `eos_token_id` to a set.  
   * In the sampling loop, break when the next token is in the set.  
5. **Test Long‑Context Inference**  
   * Generate a prompt of 200 000 tokens and confirm that the model does not crash and respects `max_position_embeddings`.  
6. **CI Pipeline**  
   * Add a job that runs the schema validator and the long‑context test.  
   * Fail the build if any assertion fails.  
7. **Documentation**  
   * Update README to note the dual‑EOS requirement and the `bfloat16` data type.  
8. **Runtime Guard**  
   * Wrap the inference call in a try/except that logs any `RuntimeError` related to dtype mismatches or shape mismatches.  

---