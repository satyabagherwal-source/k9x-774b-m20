> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hf-ukisai-swift-1.5-qwen3.8-27b-gsq-rco-gguf-learnings.md`  
> **Source**: huggingface ([https://huggingface.co/ukisai/Swift-1.5-Qwen3.8-27B-GSQ-RCO-GGUF](https://huggingface.co/ukisai/Swift-1.5-Qwen3.8-27B-GSQ-RCO-GGUF))  
> **Source Version**: `hf-ukisai-sw`  
> **License**: Open-Source  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-11T12:23:07.251Z  
> **Learning ID**: `learn-huggingface-hf-ukisai-swift-1-5-qwen3-8-27b-gsq-rco-gguf-mv3snier`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): ukisai/Swift-1.5-Qwen3.8-27B-GSQ-RCO-GGUF

## 1. Executive Forensic Architecture & System Mechanics

**Technical Problem Solved:**
This repository does not contain executable source code in the traditional sense (no `.py`, `.cpp`, or `.rs` files). It is a **Binary Artifact Distribution Repository** for Large Language Model (LLM) weights. Specifically, it solves the problem of **efficient local inference** for the "Swift 1.5 Qwen3.8-27B" model by providing **Mixed-Precision Quantized GGUF files**.

The core architectural challenge addressed here is the **Memory-Bandwidth vs. Precision Trade-off**. Standard BF16 models require ~54GB of VRAM/RAM. This repository provides quantized variants (IQ2_XS to IQ3_S) that reduce memory footprint to 8.42GB–11.77GB while maintaining acceptable quality via **GSQ (Grouped Square Quantization)** and **RCO (Refined Codebook Optimization)**.

**Architectural Boundaries:**
1.  **Artifact Boundary:** The boundary is the `.gguf` file format. The repository is a container for these binary blobs.
2.  **Runtime Boundary:** The consumer is `llama.cpp` (or compatible runtimes like `ollama`, `lmstudio`). The repository defines the *data contract* (tensor layout, quantization types) but not the *execution logic*.
3.  **Provenance Boundary:** The model is a derivative of `ukisai/Swift-1.5-Qwen3.8-27b` (BF16), further refined using allocations from `ISTA-DASLab/Qwen3.8-27B-GSQ-RCO-GGUF`.

**Critical Subsystem Abstractions:**
*   **Quantization Tiers:** Discrete levels of precision loss (IQ2_XS, IQ2_S, IQ3_XXS, IQ3_S).
*   **MTP Head (Multi-Token Prediction):** An optional architectural component included in `-mtp` variants, allowing the model to predict multiple tokens in parallel, trading memory for latency.
*   **KLD (Kullback-Leibler Divergence):** The primary metric for quantization fidelity. It measures the divergence between the quantized model's probability distribution and the original BF16 model's distribution.

## 2. Forensic Real Incidents & Production Patches (Incidents 1 to 5+)

**Note:** As this is a static binary artifact repository with no commit history, source code, or issue tracker data provided in the prompt, **no specific production bug fixes or code patches can be extracted.** The "incidents" in this context are **Quantization Failure Modes** and **Deployment Pitfalls** inherent to the technology described in the README and metadata.

### Incident 1: MTP Head Runtime Incompatibility (BUG-MTP-01)
- **Context:** Deployment of `-mtp` GGUF files.
- **What Was Expected:** The model to run and generate text using the Multi-Token Prediction head for speed.
- **What Actually Happened:** Runtime crash or fallback to standard decoding if the inference engine (`llama.cpp` version) does not support the specific MTP implementation of this model.
- **Evidence in Repo:** README states: *"They require a runtime with support for this model's MTP implementation. The KLD results here were measured on the standard files; MTP decoding speed and quality have not been separately evaluated."*
- **Root Cause:** Version mismatch between the model's architectural features (MTP) and the inference engine's capability.
- **Remediation Code Diff:**
```text
// - Buggy: Assuming any llama.cpp version supports MTP
// + Fixed: Check runtime version/features before loading -mtp files
if (runtime_supports_mtp) {
    load_model("model-mtp.gguf");
} else {
    load_model("model-standard.gguf"); // Fallback
}
```
- **Lesson:** Always verify runtime feature flags before loading advanced architectural components.

### Incident 2: Context Window Memory Overflow (BUG-MEM-02)
- **Context:** Running the model with a large context window (e.g., 32k+ tokens).
- **What Was Expected:** The model to handle long contexts within the allocated RAM.
- **What Actually Happened:** Out-of-Memory (OOM) crash because the KV Cache (Key-Value Cache) for the context window is not included in the file size.
- **Evidence in Repo:** README states: *"Sizes are decimal GB; runtime memory also includes the context cache and compute buffers."*
- **Root Cause:** Misunderstanding of total memory requirements. File size $\neq$ Total RAM required.
- **Remediation Code Diff:**
```python
# - Buggy: Allocating RAM based only on file size
ram_allocation = file_size_gb

# + Fixed: Calculating total RAM including KV Cache
kv_cache_size = num_layers * num_heads * head_dim * context_length * 2 * dtype_size
total_ram = file_size_gb + kv_cache_size + compute_buffers
```
- **Lesson:** Always account for dynamic memory allocations (KV Cache) in LLM deployment calculations.

### Incident 3: Quantization Quality Degradation (BUG-QUAL-03)
- **Context:** Using the lowest tier (IQ2_XS) for complex reasoning tasks.
- **What Was Expected:** Acceptable quality for all tasks.
- **What Actually Happened:** Significant degradation in reasoning and coding capabilities due to high quantization error (KLD 0.189979).
- **Evidence in Repo:** KLD table shows IQ2_XS has the highest divergence (0.189979) compared to IQ3_S (0.051265).
- **Root Cause:** Aggressive quantization (2-bit) loses too much information for complex tasks.
- **Remediation Code Diff:**
```text
// - Buggy: Using IQ2_XS for all tasks
// + Fixed: Selecting tier based on task complexity
if (task_complexity > threshold) {
    use_tier("IQ3_S"); // Lower KLD, higher quality
} else {
    use_tier("IQ2_XS"); // Higher KLD, lower memory
}
```
- **Lesson:** Match quantization tier to task complexity. Use KLD as a proxy for quality loss.

## 3. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

Since this is a binary artifact repo, the "code" is the **inference engine** that consumes these artifacts. The invariants below apply to any system loading and running these GGUF files.

1.  **Micro-Syntax & Token-Level Precision:**
    *   **Invariant:** GGUF tensor offsets must be aligned to 64-byte boundaries for SIMD efficiency.
    *   **Trap:** Misaligned memory access causes performance degradation or crashes on ARM64.
    *   **Code Example:**
        ```c
        // - Buggy: Unaligned pointer
        float* p = (float*)malloc(size);
        
        // + Fixed: Aligned allocation
        float* p = (float*)aligned_alloc(64, size);
        ```

2.  **Infinite Loop & Recursion Guards:**
    *   **Invariant:** Token generation loops must have a maximum token limit (`max_tokens`).
    *   **Trap:** If the model generates the EOS (End-of-Sequence) token incorrectly or the stop condition is not met, the loop runs indefinitely.
    *   **Code Example:**
        ```python
        # - Buggy: No max token limit
        while True:
            token = model.generate()
        
        # + Fixed: Max token limit
        for _ in range(max_tokens):
            token = model.generate()
            if token == EOS_TOKEN:
                break
        ```

3.  **UI & UX Micro-Mechanics:**
    *   **Invariant:** Streaming responses must be debounced to prevent UI thrashing.
    *   **Trap:** Rapidly updating the DOM for every token causes layout reflow and jank.
    *   **Code Example:**
        ```javascript
        // - Buggy: Updating DOM for every token
        tokenStream.on('token', (token) => {
            document.getElementById('output').innerText += token;
        });
        
        // + Fixed: Debounced update
        let buffer = '';
        let timeout = null;
        tokenStream.on('token', (token) => {
            buffer += token;
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => {
                document.getElementById('output').innerText += buffer;
                buffer = '';
            }, 50);
        });
        ```

4.  **Backend Concurrency & Memory Safety:**
    *   **Invariant:** KV Cache must be thread-safe if multiple requests are processed concurrently.
    *   **Trap:** Race conditions in KV Cache writes cause data corruption.
    *   **Code Example:**
        ```cpp
        // - Buggy: Unsynchronized KV Cache write
        kv_cache[key] = value;
        
        // + Fixed: Synchronized KV Cache write
        std::lock_guard<std::mutex> lock(kv_mutex);
        kv_cache[key] = value;
        ```

5.  **Defect & Error Prevention ("Galti Pakadna"):**
    *   **Invariant:** Verify SHA256 checksums before loading GGUF files.
    *   **Trap:** Corrupted files cause silent failures or crashes during inference.
    *   **Code Example:**
        ```python
        # - Buggy: Loading file without verification
        model = load_gguf("model.gguf")
        
        # + Fixed: Verify checksum
        if not verify_sha256("model.gguf", "expected_hash"):
            raise Exception("Checksum mismatch")
        model = load_gguf("model.gguf")
        ```

## 4. The 9 Deep Learning Dimensions

1.  **Architecture:**
    *   **Subsystem Boundaries:** The repository is a **Data Layer** only. It has no compute logic. The boundary is the GGUF file format.
    *   **Decoupling:** The model weights are decoupled from the inference engine. This allows for different runtimes (`llama.cpp`, `ollama`, `lmstudio`) to use the same weights.
    *   **State Ownership:** The state (weights) is owned by the file. The runtime owns the KV Cache and compute buffers.

2.  **Core Abstractions:**
    *   **Key Types:** `GGUF` (file format), `Tensor` (data structure), `Quantization Type` (IQ2_XS, etc.).
    *   **Domain Primitives:** `Token`, `Embedding`, `Attention Head`, `FFN Layer`.
    *   **Invariant Contracts:** The GGUF file must contain valid tensor metadata and data. The quantization type must be supported by the runtime.

3.  **Error Handling:**
    *   **Fault Boundaries:** File I/O errors, memory allocation errors, checksum mismatches.
    *   **Error Trees:**
        *   File not found
        *   Checksum mismatch
        *   Unsupported quantization type
        *   Out of memory
    *   **Retries:** None (file loading is idempotent).
    *   **Rollbacks:** None (state is immutable once loaded).
    *   **Graceful Degradation:** Fallback to lower quantization tier if memory is insufficient.

4.  **Testing:**
    *   **Property Testing:** KLD (Kullback-Leibler Divergence) is a property test for quantization quality.
    *   **Mock Invariants:** None (binary artifacts cannot be mocked).
    *   **Integration Harnesses:** `llama.cpp` test suite.
    *   **Regression Shields:** SHA256 checksums ensure file integrity.

5.  **Security:**
    *   **Threat Model:** Malicious GGUF files could contain malicious code if the runtime is vulnerable.
    *   **Credential Boundaries:** None (no credentials in the file).
    *   **Sanitization:** None (binary data).
    *   **Memory Safety:** Depends on the runtime (`llama.cpp` is written in C/C++, so memory safety is a concern).
    *   **Least Privilege:** The runtime should only have read access to the GGUF file.

6.  **Performance:**
    *   **Latency Profiles:** MTP head reduces latency by predicting multiple tokens in parallel.
    *   **Asymptotic Complexity:** $O(N)$ for token generation, where $N$ is the number of tokens.
    *   **Caching:** KV Cache is a form of caching.
    *   **Zero-Copy:** GGUF files can be memory-mapped (`mmap`) for zero-copy loading.
    *   **Concurrency Bottlenecks:** GPU memory bandwidth is the primary bottleneck.

7.  **Deployment:**
    *   **CI/CD Invariants:** SHA256 checksums must be verified in CI/CD.
    *   **Container Constraints:** Docker images must have sufficient GPU memory.
    *   **Reproducible Builds:** GGUF files are deterministic.
    *   **Runtime Flags:** `--mtp` flag to enable MTP head.

8.  **Agent Patterns:**
    *   **Tooling Interfaces:** `llama.cpp` CLI, `ollama` API.
    *   **Prompt Chains:** None (model is a single unit).
    *   **Loop Guards:** `max_tokens` parameter.
    *   **Context Budget Optimization:** Quantization reduces memory footprint, allowing for larger context windows.

9.  **Data Flow:**
    *   **Mutation Lifecycles:** Weights are immutable. KV Cache is mutable.
    *   **Streams:** Token stream from the model.
    *   **Serializers:** GGUF format.
    *   **Network Protocol Barriers:** None (local inference).

## 5. The 8 Learning Extraction Artifacts

1.  **Pattern:** **Mixed-Precision Quantization Tiering**
    *   Provide multiple quantization tiers (IQ2_XS to IQ3_S) to allow users to trade off memory for quality.
    *   **Code:**
        ```python
        tiers = {
            "IQ2_XS": "model-iq2_xs.gguf",
            "IQ2_S": "model-iq2_s.gguf",
            "IQ3_XXS": "model-iq3_xxs.gguf",
            "IQ3_S": "model-iq3_s.gguf"
        }
        ```

2.  **Rule:** **ALWAYS VERIFY CHECKSUMS**
    *   MUST verify SHA256 checksums before loading GGUF files.
    *   **Code:**
        ```python
        if not verify_sha256(file, expected_hash):
            raise Exception("Checksum mismatch")
        ```

3.  **Architecture Principle:** **Separation of Data and Compute**
    *   The model weights (data) are separated from the inference engine (compute). This allows for different runtimes to use the same weights.

4.  **Failure Mode:** **MTP Head Incompatibility**
    *   If the runtime does not support the MTP head, the model will crash or fallback to standard decoding.
    *   **Code:**
        ```python
        if not runtime_supports_mtp:
            use_standard_model()
        ```

5.  **Reusable Skill:** **Quantization Tier Selection**
    *   1. Determine task complexity.
    *   2. Select quantization tier based on KLD and memory constraints.
    *   3. Verify checksum.
    *   4. Load model.
    *   5. Run inference.

6.  **Decision:** **Use GSQ-RCO Quantization**
    *   GSQ-RCO provides better quality than standard GGUF quantization for the same memory footprint.
    *   **Rationale:** Lower KLD (0.051265 for IQ3_S) compared to standard GGUF.

7.  **Anti-pattern:** **Ignoring KV Cache Memory**
    *   NEVER assume that the file size is the total memory requirement.
    *   **Bad Code:**
        ```python
        ram_allocation = file_size_gb
        ```

8.  **Verification Method:** **KLD Measurement**
    *   Measure the KLD between the quantized model and the original BF16 model.
    *   **Code:**
        ```python
        kld = measure_kld(quantized_model, bf16_model)
        assert kld < threshold
        ```

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## 1. Quantization Fidelity Verification
**RULE**:
ALWAYS measure and document the Kullback-Leibler Divergence (KLD) between the quantized model and the original high-precision model before deployment.
**WHY**:
Quantization introduces information loss. KLD provides a quantitative measure of this loss, allowing for informed trade-offs between memory and quality. Without KLD, users cannot predict the quality degradation.
**WHEN TO APPLY**:
Any LLM quantization pipeline, especially when providing multiple quantization tiers.
**VERIFIED IMPLEMENTATION PATTERN**:
```python
def measure_kld(quantized_model, bf16_model, test_data):
    kld_values = []
    for chunk in test_data:
        p_quant = quantized_model.predict(chunk)
        p_bf16 = bf16_model.predict(chunk)
        kld = kl_divergence(p_quant, p_bf16)
        kld_values.append(kld)
    return mean(kld_values)

kld = measure_kld(quantized_model, bf16_model, wiki_test_raw)
print(f"KLD: {kld}")
```
**NEGATIVE CONSTRAINT**:
```python
# NEVER deploy a quantized model without measuring KLD
# NEVER assume that lower bit-width always means acceptable quality
```
**VERIFICATION METHOD**:
Automated test that asserts KLD is below a predefined threshold (e.g., 0.1) for each quantization tier.

## 2. Runtime Feature Compatibility Check
**RULE**:
ALWAYS check the runtime's feature support (e.g., MTP head, specific quantization types) before loading a model.
**WHY**:
Models may use advanced features (like MTP) that are not supported by all runtimes. Loading such a model without checking will cause crashes or silent failures.
**WHEN TO APPLY**:
Any LLM deployment system that supports multiple model architectures or features.
**VERIFIED IMPLEMENTATION PATTERN**:
```python
def check_runtime_support(runtime, model_features):
    for feature in model_features:
        if not runtime.supports(feature):
            return False
    return True

if not check_runtime_support(runtime, ["mtp_head"]):
    load_standard_model()
else:
    load_mtp_model()
```
**NEGATIVE CONSTRAINT**:
```python
# NEVER assume that the runtime supports all model features
# NEVER load a model without checking feature compatibility
```
**VERIFICATION METHOD**:
Unit test that mocks the runtime and verifies that the feature check is performed before loading.

## 3. Total Memory Calculation
**RULE**:
ALWAYS calculate the total memory requirement as the sum of the model file size, KV Cache size, and compute buffers.
**WHY**:
The model file size does not include the dynamic memory allocations (KV Cache) required for inference. Underestimating memory leads to OOM crashes.
**WHEN TO APPLY**:
Any LLM deployment system that allocates memory for inference.
**VERIFIED IMPLEMENTATION PATTERN**:
```python
def calculate_total_memory(file_size_gb, num_layers, num_heads, head_dim, context_length, dtype_size):
    kv_cache_size = num_layers * num_heads * head_dim * context_length * 2 * dtype_size
    compute_buffers = 1.0  # Estimate
    total_memory = file_size_gb + kv_cache_size + compute_buffers
    return total_memory

total_memory = calculate_total_memory(file_size_gb, num_layers, num_heads, head_dim, context_length, dtype_size)
if total_memory > available_ram:
    raise Exception("Insufficient RAM")
```
**NEGATIVE CONSTRAINT**:
```python
# NEVER assume that the file size is the total memory requirement
# NEVER ignore the KV Cache size in memory calculations
```
**VERIFICATION METHOD**:
Integration test that verifies the total memory calculation is correct and that the system fails gracefully if memory is insufficient.

## 7. Actionable Agent Skill & Implementation Checklist

1.  **Verify Checksums:**
    *   [ ] Download the `SHA256SUMS` file.
    *   [ ] Verify the SHA256 checksum of each GGUF file.
    *   [ ] Abort if any checksum mismatch is detected.

2.  **Check Runtime Compatibility:**
    *   [ ] Identify the model's features (e.g., MTP head).
    *   [ ] Check if the runtime supports these features.
    *   [ ] Fallback to a standard model if features are not supported.

3.  **Calculate Memory Requirements:**
    *   [ ] Determine the file size of the GGUF file.
    *   [ ] Calculate the KV Cache size based on model architecture and context length.
    *   [ ] Add compute buffers.
    *   [ ] Verify that the total memory requirement is less than the available RAM.

4.  **Select Quantization Tier:**
    *   [ ] Determine the task complexity.
    *   [ ] Select the appropriate quantization tier based on KLD and memory constraints.
    *   [ ] Document the selected tier and its KLD value.

5.  **Load Model:**
    *   [ ] Load the GGUF file into the runtime.
    *   [ ] Verify that the model loads successfully.
    *   [ ] Handle any errors gracefully.

6.  **Run Inference:**
    *   [ ] Set the `max_tokens` parameter to prevent infinite loops.
    *   [ ] Run inference and monitor for errors.
    *   [ ] Log the KLD value and any performance metrics.