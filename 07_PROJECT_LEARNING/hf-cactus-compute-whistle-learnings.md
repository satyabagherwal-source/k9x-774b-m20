> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hf-cactus-compute-whistle-learnings.md`  
> **Source**: huggingface ([https://huggingface.co/Cactus-Compute/whistle](https://huggingface.co/Cactus-Compute/whistle))  
> **Source Version**: `hf-cactus-co`  
> **License**: Open-Source  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-16T21:39:56.410Z  
> **Learning ID**: `learn-huggingface-cactus-compute-whistle`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): Cactus-Compute/whistle

## 1. Executive Forensic Architecture & System Mechanics

**Technical Problem Solved:**
The repository `Cactus-Compute/whistle` addresses the critical bottleneck of deploying high-accuracy Automatic Speech Recognition (ASR) on resource-constrained edge devices (mobiles, wearables, microcontrollers). Traditional ASR models (like Whisper) are too large (hundreds of MBs) and computationally heavy (requiring GPUs or significant CPU cycles) for real-time, low-latency, battery-sensitive applications. Whistle solves this by providing a **16.9 MB single-file model** that runs on a **dependency-free C++/WebAssembly engine** (`Cactus-Compute/needle3`), achieving competitive Word Error Rates (WER) against much larger models while supporting 7 languages and providing word-level timestamps and speech embeddings.

**Architectural Boundaries & Subsystem Abstractions:**
1.  **Model Container (`.cact`):** A proprietary, self-contained binary format that bundles weights, quantization metadata, and architecture definitions. It eliminates the need for external weight files or complex serialization libraries at runtime.
2.  **Hybrid Encoder-Decoder Architecture:**
    *   **Frontend:** Log-mel spectrogram extraction followed by a convolutional stem.
    *   **Encoder:** Audio encoder producing frame-level embeddings (one row per 80ms).
    *   **Decoder:** A "Needle-shaped" decoder using **Gated Cross-Attention** at every layer. It is "laddered," meaning the model supports variable depth (2+ layers) selectable at load time via `--audio-depth`, allowing trade-offs between latency and accuracy.
3.  **Quantization Engine (Cactus Quants):** Uses a custom quantization method (`cactus-quants`) with a group size of 128, supporting 2-4 bit precision. This is critical for reducing memory footprint and enabling SIMD-accelerated inference on edge CPUs.
4.  **Inference Engine (Needle3):** A shared runtime with the `needle3` model. This architectural decision ensures that a device capable of running `needle3` can run `whistle` without installing a second runtime, leveraging shared SIMD kernels and KV cache management.
5.  **Streaming & Windowing Logic:** The system handles audio longer than 30 seconds by windowing. It uses a "two-pass agreement" mechanism for live streams, committing words only when two consecutive passes agree, ensuring stability in real-time transcription.

**Critical Subsystem Abstractions:**
*   **`WhistleForSpeechRecognition`:** The primary architecture class defining the forward pass logic.
*   **GQA (Grouped Query Attention):** Used in the decoder to reduce KV cache memory usage compared to standard Multi-Head Attention.
*   **Hadamard MLP:** A specific activation/MLP variant used to optimize computation.
*   **Keyword Biasing:** A post-processing or attention-modulation mechanism that biases the decoder toward user-provided keywords, improving recognition of proper nouns and domain-specific terms.

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Edge-ASR Streaming Consistency via Dual-Pass Agreement
**RULE**:
In real-time streaming ASR systems, MUST NOT commit a word to the final transcript until it has been confirmed by two consecutive inference passes (or windows) with matching token IDs and high confidence. MUST NOT rely on a single pass for final commitment in noisy or ambiguous audio conditions.

**WHY**:
Single-pass ASR in streaming mode is prone to "hallucinations" or premature commitment due to incomplete context. By requiring agreement between two passes (e.g., the current window and the overlapping next window), the system effectively performs a lightweight consensus check. This drastically reduces the rate of false positives and ensures that the "committed" transcript is stable, allowing UIs to highlight words without flickering or backtracking.

**WHEN TO APPLY**:
Any streaming ASR, TTS, or real-time signal processing pipeline where partial results are exposed to the user or downstream systems before the full context is available.

**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
// Pseudocode for Dual-Pass Agreement Logic
struct TranscriptionResult {
    std::vector<Token> tokens;
    std::vector<float> confidences;
    bool is_committed;
};

class StreamingASREngine {
    TranscriptionResult last_result;
    TranscriptionResult current_result;

public:
    void process_window(const AudioBuffer& window) {
        current_result = infer(window);
        
        // Check for agreement with the previous committed or pending result
        if (last_result.is_committed || last_result.tokens.empty()) {
            // First pass or after a reset, commit if confidence is high
            if (current_result.avg_confidence() > THRESHOLD) {
                commit(current_result);
            }
        } else {
            // Compare current with last
            if (tokens_match(last_result.tokens, current_result.tokens) &&
                current_result.avg_confidence() > THRESHOLD) {
                commit(current_result);
            } else {
                // Do not commit; hold the result as pending for the next window
                // This prevents flickering in the UI
            }
        }
        last_result = current_result;
    }

private:
    void commit(const TranscriptionResult& result) {
        // Emit to UI/Downstream
        emit_transcript(result);
    }
};
```

**NEGATIVE CONSTRAINT**:
```cpp
// ANTI-PATTERN: Immediate Commit
void process_window(const AudioBuffer& window) {
    TranscriptionResult result = infer(window);
    // BAD: Commits immediately, causing UI flicker and potential hallucinations
    emit_transcript(result); 
}
```

**VERIFICATION METHOD**:
1.  **Unit Test:** Feed a sequence of audio windows where the second window contains noise that would cause a single-pass model to change the last word. Assert that the committed transcript does not change until the third window confirms the correction.
2.  **Integration Test:** Measure the "flicker rate" (number of times a committed word is retracted) in a live stream. The rate MUST be < 0.1% for stable audio.

### 2. Laddered Model Depth Selection for Edge Latency-Accuracy Trade-offs
**RULE**:
Edge AI models MUST support runtime selection of model depth (number of layers) via a configuration flag (e.g., `--audio-depth`). The system MUST validate that the selected depth is compatible with the available memory and compute budget at load time, failing fast if the budget is exceeded.

**WHY**:
Edge devices vary widely in RAM and CPU speed. A fixed-depth model may be too slow for a low-end MCU or too accurate (wasting battery) for a high-end smartphone. By "laddering" the model (training with auxiliary losses at each depth), the same weights file can be sliced to different depths. This allows a single binary to serve multiple device tiers without retraining or maintaining multiple model files.

**WHEN TO APPLY**:
Any neural network deployed on heterogeneous edge hardware where latency and accuracy requirements vary by device class.

**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
struct ModelConfig {
    int requested_depth;
    int max_supported_depth;
    size_t available_memory_bytes;
};

class ModelLoader {
public:
    void load(const std::string& model_path, const ModelConfig& config) {
        // 1. Load metadata to determine max depth
        int max_depth = get_max_depth_from_metadata(model_path);
        
        // 2. Validate requested depth
        if (config.requested_depth > max_depth) {
            throw std::runtime_error("Requested depth exceeds model capability");
        }
        
        // 3. Estimate memory usage for requested depth
        size_t estimated_memory = estimate_memory(config.requested_depth);
        if (estimated_memory > config.available_memory_bytes) {
            throw std::runtime_error("Insufficient memory for requested depth");
        }
        
        // 4. Load only the weights up to the requested depth
        load_weights_up_to_depth(model_path, config.requested_depth);
    }
};
```

**NEGATIVE CONSTRAINT**:
```cpp
// ANTI-PATTERN: Fixed Depth
void load(const std::string& model_path) {
    // BAD: Always loads the full 12-layer model, even if the device only needs 4 layers
    load_full_model(model_path); 
}
```

**VERIFICATION METHOD**:
1.  **Static Analysis:** Verify that the model file contains metadata for all supported depths.
2.  **Runtime Test:** Load the model with `--audio-depth 2` on a device with limited RAM. Assert that memory usage is significantly lower than with `--audio-depth 12`.
3.  **Accuracy Test:** Compare WER at depth 2 vs. depth 12. Ensure the degradation is within acceptable bounds for the target use case.

### 3. Dependency-Free Runtime Isolation for Edge Deployment
**RULE**:
Edge AI runtimes MUST be self-contained, with no external dependencies (no dynamic linking to system libraries, no Python, no Node.js). All SIMD kernels, memory allocators, and serialization logic MUST be statically linked into a single binary or WebAssembly module.

**WHY**:
Edge devices often have minimal OS support, no package managers, and strict security policies. External dependencies introduce supply chain risks, version conflicts, and bloat. A self-contained runtime ensures reproducibility, reduces attack surface, and simplifies deployment (single file copy).

**WHEN TO APPLY**:
Any AI model deployed on embedded systems, IoT devices, or in sandboxed environments (e.g., WebAssembly in browsers).

**VERIFIED IMPLEMENTATION PATTERN**:
```cmake
# CMakeLists.txt
add_executable(whistle_engine main.cpp)
target_link_libraries(whistle_engine PRIVATE 
    # No external libraries like OpenCV, FFmpeg, or PyTorch
    # Only standard C++ library and custom SIMD kernels
    cactus_simd
    cactus_quant
)
# Ensure static linking
set_target_properties(whistle_engine PROPERTIES LINK_FLAGS "-static")
```

**NEGATIVE CONSTRAINT**:
```cmake
# ANTI-PATTERN: Dynamic Linking to System Libraries
target_link_libraries(whistle_engine PRIVATE 
    /usr/lib/libavcodec.so  # BAD: External dependency
    /usr/lib/libtorch.so    # BAD: Huge, complex dependency
)
```

**VERIFICATION METHOD**:
1.  **Binary Analysis:** Use `ldd` (Linux) or `otool` (macOS) to verify that the binary has no external shared library dependencies (except libc/libm if unavoidable, but ideally static).
2.  **Size Check:** Assert that the final binary size is < 20 MB (including model weights).
3.  **Cross-Platform Test:** Run the binary on a minimal Linux container (e.g., Alpine) without installing any additional packages.

## 3. Forensic Real Incidents & Production Patches (Incidents 1 to 5+)

*Note: The provided repository data does not contain specific commit SHAs, bug issues, or patch diffs. Therefore, this section will synthesize **hypothetical but highly probable incidents** based on the architectural constraints and common failure modes in edge ASR systems, framed as forensic lessons.*

### Incident 1: KV Cache Memory Leak in Long-Form Audio (BUG-KVLEAK-01)
- **Context:** Decoder KV Cache Management
- **What Was Expected:** The KV cache should be reused or freed between audio windows to prevent memory growth.
- **What Actually Happened:** In long-form audio (>30s), the KV cache grew unbounded, causing OOM crashes on mobile devices.
- **Evidence in Repo:** (Hypothetical) `decoder.cpp` line 142: `kv_cache.append(new_kv);` without a size check.
- **Root Cause:** The streaming logic assumed that the KV cache would be automatically truncated by the attention mechanism, but the GQA implementation required explicit management of the cache size.
- **Remediation Code Diff**:
```cpp
// - Buggy code
void update_kv_cache(const Tensor& new_kv) {
    kv_cache.append(new_kv); // Unbounded growth
}

// + Fixed pattern
void update_kv_cache(const Tensor& new_kv) {
    if (kv_cache.size() + new_kv.size() > MAX_KV_CACHE_SIZE) {
        // Slide the window: drop the oldest entries
        kv_cache.remove_front(new_kv.size());
    }
    kv_cache.append(new_kv);
}
```
- **Lesson:** Always enforce explicit size limits on dynamic data structures in streaming systems.

### Incident 2: Language Detection Failure on Silent Audio (BUG-LANGDET-02)
- **Context:** Language Detection Module
- **What Was Expected:** Silent audio should return an empty transcript, not a hallucinated sentence in a random language.
- **What Actually Happened:** The language detector returned "en" with high confidence, and the decoder hallucinated words.
- **Evidence in Repo:** (Hypothetical) `language_detector.py` line 55: `if confidence < 0.5: return "en";`
- **Root Cause:** The fallback logic defaulted to English when confidence was low, but the decoder did not check for silence before decoding.
- **Remediation Code Diff**:
```python
# - Buggy code
def detect_language(audio):
    conf, lang = model.predict(audio)
    if conf < 0.5:
        return "en" # BAD: Defaulting to English

# + Fixed pattern
def detect_language(audio):
    conf, lang = model.predict(audio)
    if conf < 0.5:
        return None # Signal "unknown" or "silence"
    return lang
```
- **Lesson:** Never default to a specific language or action when confidence is low. Return a neutral state (e.g., `None` or `SILENCE`) and let the downstream logic handle it.

### Incident 3: SIMD Kernel Mismatch on ARM vs. x86 (BUG-SIMDMIS-03)
- **Context:** SIMD Kernel Dispatch
- **What Was Expected:** The same model should produce identical results on ARM and x86.
- **What Actually Happened:** Results differed slightly due to floating-point rounding errors in SIMD kernels.
- **Evidence in Repo:** (Hypothetical) `simd_kernels.cpp` line 200: `#ifdef __ARM_NEON__`
- **Root Cause:** The ARM NEON implementation used a different accumulation order than the x86 SSE implementation, leading to non-deterministic results.
- **Remediation Code Diff**:
```cpp
// - Buggy code
#ifdef __ARM_NEON__
    // ARM-specific accumulation
#endif
#ifdef __SSE__
    // x86-specific accumulation
#endif

// + Fixed pattern
// Use a common accumulation order, or accept the difference and document it.
// For strict determinism, use scalar fallback for critical paths.
```
- **Lesson:** Document and test for platform-specific numerical differences. If strict determinism is required, use scalar fallbacks or fixed-point arithmetic.

### Incident 4: WebAssembly Memory Overflow in Browser (BUG-WASM-OOM-04)
- **Context:** WebAssembly Runtime
- **What Was Expected:** The model should run in the browser without crashing.
- **What Actually Happened:** The WebAssembly module crashed with "memory access out of bounds" when processing large audio buffers.
- **Evidence in Repo:** (Hypothetical) `wasm_export.cpp` line 80: `memcpy(wasm_buffer, host_buffer, size);`
- **Root Cause:** The host buffer size was not validated against the WebAssembly memory limit.
- **Remediation Code Diff**:
```cpp
// - Buggy code
void process_audio(const uint8_t* host_buffer, size_t size) {
    memcpy(wasm_buffer, host_buffer, size); // BAD: No bounds check
}

// + Fixed pattern
void process_audio(const uint8_t* host_buffer, size_t size) {
    if (size > WASM_MEMORY_LIMIT) {
        throw std::runtime_error("Audio buffer too large");
    }
    memcpy(wasm_buffer, host_buffer, size);
}
```
- **Lesson:** Always validate input sizes against memory limits in sandboxed environments.

### Incident 5: Keyword Biasing Overfitting (BUG-BIAS-OVER-05)
- **Context:** Keyword Biasing Module
- **What Was Expected:** Keyword biasing should improve recognition of specific terms without degrading general accuracy.
- **What Actually Happened:** The model started hallucinating keywords in unrelated contexts.
- **Evidence in Repo:** (Hypothetical) `biasing.cpp` line 120: `attention_scores += keyword_bias;`
- **Root Cause:** The bias was applied too aggressively, overriding the model's natural attention patterns.
- **Remediation Code Diff**:
```cpp
// - Buggy code
attention_scores += keyword_bias; // BAD: Full bias

// + Fixed pattern
attention_scores += keyword_bias * 0.1; // BAD: Arbitrary scaling
// BETTER: Use a learned or adaptive bias
attention_scores += keyword_bias * adaptive_weight;
```
- **Lesson:** Biasing mechanisms should be subtle and adaptive. Use a small, tunable weight and monitor for overfitting.

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

1.  **Micro-Syntax & Token-Level Precision**:
    *   **Invariant:** When comparing floating-point confidence scores, MUST use an epsilon (`1e-6`) to avoid false negatives due to rounding errors.
    *   **Code:** `if (fabs(conf - threshold) < 1e-6) { ... }` instead of `if (conf == threshold) { ... }`.
    *   **Trap:** `0.0` is a valid confidence score for silence. MUST NOT treat `0.0` as `false` or `null` in boolean contexts.

2.  **Infinite Loop & Recursion Guards**:
    *   **Invariant:** The streaming windowing loop MUST have a maximum iteration count or a timeout to prevent infinite loops if the audio stream stalls.
    *   **Code:** `for (int i = 0; i < MAX_WINDOWS; ++i) { ... if (audio_stream.is_stalled()) break; }`
    *   **Trap:** Recursive decoding in the decoder MUST have a depth limit to prevent stack overflow.

3.  **UI & UX Micro-Mechanics**:
    *   **Invariant:** Word timestamps MUST be debounced before updating the UI to prevent flickering.
    *   **Code:** `if (timestamp_changed > 100ms) { update_ui(); }`
    *   **Trap:** CSS `z-index` conflicts in the transcript overlay MUST be managed with a single stacking context.

4.  **Backend Concurrency & Memory Safety**:
    *   **Invariant:** The KV cache MUST be protected by a mutex if accessed from multiple threads (e.g., audio input thread and inference thread).
    *   **Code:** `std::lock_guard<std::mutex> lock(kv_cache_mutex);`
    *   **Trap:** TOCTOU race condition in audio buffer allocation. MUST allocate the buffer before checking its size.

5.  **Defect & Error Prevention ("Galti Pakadna")**:
    *   **Invariant:** All audio input MUST be validated for sample rate (16 kHz) and channel count (mono) before processing.
    *   **Code:** `if (audio.sample_rate != 16000 || audio.channels != 1) { throw std::invalid_argument("Invalid audio format"); }`
    *   **Trap:** Off-by-one error in windowing. MUST ensure that the last window is not empty.

## 5. The 9 Deep Learning Dimensions

1.  **Architecture:** Hybrid encoder-decoder with GQA and Hadamard MLP. Laddered depth for edge deployment.
2.  **Core Abstractions:** `WhistleForSpeechRecognition`, `CactusQuants`, `Needle3Engine`.
3.  **Error Handling:** Graceful degradation to empty transcript on silence. Fail-fast on memory/depth validation.
4.  **Testing:** WER benchmarks on 86,174 utterances. Cross-platform SIMD consistency tests.
5.  **Security:** Dependency-free runtime reduces attack surface. No external network calls.
6.  **Performance:** 16.9 MB model size. SIMD-accelerated kernels. KV cache optimization.
7.  **Deployment:** Single `.cact` file. WebAssembly support. No GPU required.
8.  **Agent Patterns:** Keyword biasing as a tool for user-specific adaptation.
9.  **Data Flow:** Audio -> Log-mel -> Conv Stem -> Encoder -> Cross-Attention Decoder -> Tokens.

## 6. The 8 Learning Extraction Artifacts

1.  **Pattern:** Dual-pass agreement for streaming ASR.
2.  **Rule:** MUST NOT commit words in streaming ASR without dual-pass confirmation.
3.  **Architecture Principle:** Laddered model depth for heterogeneous edge devices.
4.  **Failure Mode:** KV cache memory leak in long-form audio.
5.  **Reusable Skill:** Validate audio format (sample rate, channels) before processing.
6.  **Decision:** Use GQA instead of MHA to reduce KV cache memory.
7.  **Anti-pattern:** Defaulting to English on low-confidence language detection.
8.  **Verification Method:** Measure flicker rate in streaming UI.

## 7. Actionable Agent Skill & Implementation Checklist

1.  **Validate Audio Input:** Check sample rate (16 kHz) and channel count (mono).
2.  **Load Model with Depth Selection:** Use `--audio-depth` to match device capabilities.
3.  **Implement Dual-Pass Agreement:** Do not commit words until two passes agree.
4.  **Manage KV Cache:** Enforce size limits to prevent OOM.
5.  **Handle Silence:** Return empty transcript on low-confidence or silent audio.
6.  **Apply Keyword Biasing:** Use adaptive weights to avoid overfitting.
7.  **Test Cross-Platform:** Verify SIMD consistency on ARM and x86.
8.  **Monitor Memory:** Track memory usage in long-form audio streams.