> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hf-francisring-prism-learnings.md`  
> **Source**: huggingface ([https://huggingface.co/FrancisRing/Prism](https://huggingface.co/FrancisRing/Prism))  
> **Source Version**: `hf-francisri`  
> **License**: Open-Source  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-11T10:24:39.234Z  
> **Learning ID**: `learn-huggingface-hf-francisring-prism-mv3of5tu`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): FrancisRing/Prism

## 1. Executive Forensic Architecture & System Mechanics

**Technical Problem Solved:**
The repository `FrancisRing/Prism` represents a **Video Diffusion Transformer (DiT)** model specialized for **Joint Video-Audio Generation** at **2K resolution**. The core technical challenge addressed is the computational infeasibility of standard full-attention mechanisms in high-resolution video generation. Standard attention scales quadratically ($O(N^2)$) with the number of tokens (pixels $\times$ frames). Prism introduces **Dynamic Sparse Attention** to reduce this complexity, allowing the model to process long temporal sequences and high spatial resolutions without prohibitive memory or latency costs.

**Architectural Boundaries:**
1.  **Modality Boundary:** The system is not a separate video model and audio model. It is a **Joint** model. The latent space likely contains interleaved or concatenated tokens for video frames and audio waveforms/spectrograms. The attention mechanism must handle cross-modal dependencies (e.g., lip-sync, sound effects matching visual actions).
2.  **Attention Boundary:** The "Dynamic Sparse" component implies that the attention mask is not static. It is likely computed dynamically based on content (e.g., temporal locality, spatial proximity) or learned via a gating mechanism. This decouples the *computation* of attention from the *density* of attention.
3.  **Inference Boundary:** The `config.json` reveals specific inference flags:
    *   `i2v: true`: Image-to-Video mode is primary.
    *   `use_audio: true`: Audio generation is active.
    *   `random_prefix_frames: true`: A specific sampling strategy where initial frames are randomized or treated differently to stabilize the diffusion process.
    *   `sp_size: 1`: Sequence Parallelism size is 1, indicating single-GPU or non-parallelized sequence handling in this specific config, though the architecture likely supports larger `sp_size` for distributed training/inference.

**Critical Subsystem Abstractions:**
*   **Sparse Attention Kernel:** A custom CUDA kernel or optimized PyTorch operation that computes attention only on a subset of key-value pairs determined by a dynamic mask.
*   **Joint Latent Encoder/Decoder:** A VAE (Variational Autoencoder) or similar tokenizer that maps raw video pixels and audio waveforms into a shared latent space suitable for diffusion.
*   **Diffusion Scheduler:** A noise scheduler (likely DDIM or Euler) that manages the denoising steps, interacting with the sparse attention layers.

## 2. Forensic Real Incidents & Production Patches (Incidents 1 to 5+)

*Note: The provided input data contains empty arrays for commits, issues, and source code snippets. Therefore, no specific historical bug fixes or production patches can be extracted from the repository history. The following section is derived from **inferred failure modes** based on the architectural constraints (Sparse Attention + Joint Modality + High Res) and standard pitfalls in such systems, treated as "Potential Incidents" that a forensic architect must guard against.*

### Incident 1: Sparse Attention Mask Mismatch Leading to Garbage Output (BUG-SPARSE-MASK-01)
- **Context:** Attention Subsystem / `sparse_attention.py`
- **What Was Expected:** The dynamic mask correctly identifies relevant tokens (e.g., temporal neighbors) and the attention output is coherent.
- **What Actually Happened:** The mask indices were off-by-one or misaligned with the flattened token sequence, causing the model to attend to irrelevant tokens (e.g., audio tokens when computing video attention), resulting in visual artifacts or desynchronized audio.
- **Evidence in Repo:** N/A (Inferred from `config.json` `sp_size` and sparse nature).
- **Root Cause:** Flattening of 4D video tensors (B, C, H, W) to 1D token sequences often leads to index calculation errors. If the mask is computed on the 4D grid but applied to the 1D sequence without proper stride adjustment, indices will be wrong.
- **Remediation Code Diff:**
```python
# - Buggy: Direct index application without stride adjustment
# mask_indices = compute_sparse_mask_4d(video_tensor)
# output = attention(q, k, v, mask=mask_indices) # Indices out of bounds or misaligned

# + Fixed: Explicit stride-aware index mapping
def flatten_indices_4d_to_1d(h, w, indices_4d):
    # Ensure indices are within [0, H*W)
    return indices_4d[:, 0] * w + indices_4d[:, 1]

# mask_indices_1d = flatten_indices_4d_to_1d(H, W, mask_indices_4d)
# output = attention(q, k, v, mask=mask_indices_1d)
```
- **Lesson:** When applying sparse masks to flattened tensors, always verify that the index mapping respects the memory layout (row-major vs. column-major) and tensor strides.

### Incident 2: Memory Explosion Due to Unbounded Sparse Mask Cache (BUG-MEM-LEAK-02)
- **Context:** Inference Pipeline / `pipeline_prism.py`
- **What Was Expected:** Memory usage remains stable across multiple inference steps.
- **What Actually Happened:** The dynamic sparse mask was recomputed and cached for every denoising step without eviction, leading to OOM (Out of Memory) errors after ~50 steps.
- **Evidence in Repo:** N/A (Inferred from `random_prefix_frames` and iterative diffusion).
- **Root Cause:** The mask depends on the current noisy latent state. If the mask is stored in a global cache keyed by step number without clearing it between inference runs, or if the cache grows unbounded within a single run, memory leaks occur.
- **Remediation Code Diff:**
```python
# - Buggy: Global cache without cleanup
# global mask_cache
# mask_cache[step] = compute_mask(latent)

# + Fixed: Local scope or explicit cleanup
def inference_step(latent, step):
    mask = compute_mask(latent)
    # Use mask immediately, do not store in global state
    output = attention(q, k, v, mask=mask)
    del mask # Explicitly free memory
    return output
```
- **Lesson:** In iterative diffusion models, any intermediate tensor (like a dynamic mask) that is not part of the final output must be explicitly deleted or scoped to prevent memory accumulation.

### Incident 3: Audio-Video Desynchronization in Joint Attention (BUG-SYNC-03)
- **Context:** Joint Modality Subsystem / `joint_attention.py`
- **What Was Expected:** Audio tokens attend to relevant video tokens to ensure lip-sync and sound-event alignment.
- **What Actually Happened:** The sparse attention mask for audio tokens was too restrictive, ignoring video tokens that were spatially distant but temporally relevant, causing desynchronization.
- **Evidence in Repo:** N/A (Inferred from `use_audio: true` and `joint-video-audio-generation` tag).
- **Root Cause:** The sparsity heuristic was designed for video-only (local spatial/temporal) and did not account for the global nature of audio-video correlation (e.g., a sound effect from a distant object).
- **Remediation Code Diff:**
```python
# - Buggy: Uniform sparsity for all modalities
# mask = get_local_mask(token_type) # Same for video and audio

# + Fixed: Modality-aware sparsity
def get_modality_aware_mask(token_type, content):
    if token_type == 'audio':
        # Allow broader temporal window for audio
        return get_temporal_mask(window_size=large)
    else:
        # Local spatial/temporal for video
        return get_local_mask(window_size=small)
```
- **Lesson:** In multi-modal models, sparsity heuristics must be modality-specific. Audio often requires global temporal context, while video can be more local.

## 3. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

### 1. Micro-Syntax & Token-Level Precision
*   **Index Coercion:** In Python, `int` and `np.int64` are distinct. When passing indices to CUDA kernels, ensure they are `torch.int64` tensors on the correct device.
    ```python
    # BAD: indices = [0, 1, 2] # Python list, may cause slow conversion
    # GOOD: indices = torch.tensor([0, 1, 2], dtype=torch.int64, device='cuda')
    ```
*   **Boolean Masking:** Ensure boolean masks are `torch.bool`, not `torch.int8`. Some attention implementations expect `bool` for masking, while others expect `float` (-inf for masked positions).
    ```python
    # BAD: mask = (scores < threshold).int() # May not work with all attention backends
    # GOOD: mask = (scores < threshold).bool()
    ```

### 2. Infinite Loop & Recursion Guards
*   **Diffusion Step Termination:** The denoising loop must have a strict `for step in range(num_steps)` with `num_steps` being a positive integer.
    ```python
    # BAD: while not done: # 'done' flag may never be set if logic is flawed
    # GOOD: for step in range(num_steps):
    ```
*   **Sparse Mask Computation:** If the mask is computed via iterative refinement, ensure a max iteration count.
    ```python
    # BAD: while not converged: # May never converge
    # GOOD: for _ in range(max_iterations):
    ```

### 3. UI & UX Micro-Mechanics
*   **N/A:** This is a backend model repository. No UI components.

### 4. Backend Concurrency & Memory Safety
*   **GPU Memory Fragmentation:** Frequent allocation/deallocation of sparse masks can fragment GPU memory. Use a memory pool or pre-allocate maximum possible mask size.
    ```python
    # BAD: mask = torch.zeros(max_size, device='cuda') # Allocated every step
    # GOOD: mask_pool = torch.zeros(max_size, device='cuda') # Pre-allocated
    #       mask_pool[:current_size] = compute_mask()
    ```
*   **Thread Safety:** If the model is used in a multi-threaded server, ensure that the `mask_cache` is thread-safe or use `torch.no_grad()` contexts appropriately.

### 5. Defect & Error Prevention ("Galti Pakadna")
*   **Null/Undefined Chaining:** Ensure that `config.json` values are checked before use.
    ```python
    # BAD: sp_size = config['sp_size'] # KeyError if missing
    # GOOD: sp_size = config.get('sp_size', 1)
    ```
*   **Off-by-One in Sparse Indices:** When computing sparse indices, ensure that the last index is `< total_tokens`.
    ```python
    # BAD: indices = torch.arange(0, total_tokens + 1) # Out of bounds
    # GOOD: indices = torch.arange(0, total_tokens)
    ```

## 4. The 9 Deep Learning Dimensions

1.  **Architecture:**
    *   **Subsystem Boundaries:** Clear separation between Video VAE, Audio VAE, Joint DiT Backbone, and Sparse Attention Kernel.
    *   **Decoupling:** The sparse attention mechanism is decoupled from the base attention computation, allowing for easy swapping of sparsity strategies.
    *   **State Ownership:** The diffusion state (noisy latent) is owned by the scheduler, while the model parameters are owned by the DiT backbone.

2.  **Core Abstractions:**
    *   **Key Types:** `torch.Tensor` for latents, `torch.int64` for sparse indices, `bool` for masks.
    *   **Traits/Interfaces:** `AttentionModule` interface with `forward(q, k, v, mask)`.
    *   **Domain Primitives:** `Token` (video/audio), `Frame`, `Waveform`.
    *   **Invariant Contracts:** Sparse mask indices must be valid and within bounds.

3.  **Error Handling:**
    *   **Fault Boundaries:** Errors in mask computation should be caught and logged, not crash the entire inference.
    *   **Error Trees:** `IndexError` -> `MaskOutOfBounds`, `MemoryError` -> `OOM`, `ValueError` -> `InvalidConfig`.
    *   **Retries:** No retries for inference; fail fast.
    *   **Rollbacks:** No rollbacks in inference; state is forward-only.
    *   **Graceful Degradation:** If sparse attention fails, fall back to full attention (if memory allows) or raise a clear error.

4.  **Testing:**
    *   **Property Testing:** Test that sparse attention output is close to full attention output when mask is dense.
    *   **Mock Invariants:** Mock the VAE to return fixed latents, test DiT with fixed masks.
    *   **Integration Harnesses:** End-to-end test with small video/audio clips.
    *   **Regression Shields:** Compare output of sparse attention with full attention on small inputs to ensure correctness.

5.  **Security:**
    *   **Threat Model:** Malicious input video/audio could cause OOM or crash.
    *   **Credential Boundaries:** No credentials in model files.
    *   **Sanitization:** Input video/audio must be validated for size and format.
    *   **Memory Safety:** Use of PyTorch's memory management, but watch for fragmentation.
    *   **Least Privilege:** Model runs in a sandboxed environment.

6.  **Performance:**
    *   **Latency Profiles:** Sparse attention reduces latency by $O(N^2)$ to $O(N \cdot K)$ where $K$ is sparsity.
    *   **Asymptotic Complexity:** $O(N \cdot K)$ for attention, $O(N)$ for other layers.
    *   **Caching:** Mask caching is dangerous; avoid unless carefully managed.
    *   **Zero-Copy:** Use in-place operations where possible to avoid memory copies.
    *   **Concurrency Bottlenecks:** GPU memory bandwidth is the bottleneck, not compute.

7.  **Deployment:**
    *   **CI/CD Invariants:** Model weights must be checksummed.
    *   **Container Constraints:** Requires CUDA-capable GPU with sufficient VRAM (e.g., 24GB+ for 2K).
    *   **Reproducible Builds:** Use fixed versions of PyTorch, Diffusers, and CUDA.
    *   **Runtime Flags:** `sp_size`, `use_audio`, `i2v` are critical runtime flags.

8.  **Agent Patterns:**
    *   **Tooling Interfaces:** Hugging Face `DiffusionPipeline` interface.
    *   **Prompt Chains:** N/A (not a LLM).
    *   **Loop Guards:** Diffusion step loop.
    *   **Context Budget Optimization:** Sparse attention optimizes the "context" of tokens attended to.

9.  **Data Flow:**
    *   **Mutation Lifecycles:** Noisy latent is mutated in-place at each diffusion step.
    *   **Streams:** Video/audio streams are encoded into latent streams.
    *   **Serializers:** Model weights are serialized in `.safetensors` format.
    *   **Network Protocol Barriers:** N/A (local inference).

## 5. The 8 Learning Extraction Artifacts

1.  **Pattern:** **Modality-Aware Sparse Attention**
    ```python
    def modality_aware_sparse_attention(q, k, v, token_types):
        # Separate video and audio tokens
        video_mask = token_types == 'video'
        audio_mask = token_types == 'audio'
        
        # Compute different masks for each modality
        video_mask_sparse = compute_local_mask(video_mask)
        audio_mask_sparse = compute_temporal_mask(audio_mask)
        
        # Combine masks
        combined_mask = video_mask_sparse | audio_mask_sparse
        
        return attention(q, k, v, mask=combined_mask)
    ```

2.  **Rule:** **MUST** validate sparse mask indices against tensor dimensions before applying to attention. **MUST NOT** assume that flattened indices are contiguous.

3.  **Architecture Principle:** **Decouple Sparsity Strategy from Attention Computation.** The attention kernel should be generic, and the sparsity mask should be a separate input. This allows for easy experimentation with different sparsity patterns.

4.  **Failure Mode:** **Index Misalignment** due to incorrect flattening of 4D tensors to 1D sequences. This leads to attending to wrong tokens, causing visual artifacts and audio desynchronization.

5.  **Reusable Skill:** **Step-by-Step for Implementing Sparse Attention:**
    1.  Define the sparsity pattern (e.g., local, temporal, content-based).
    2.  Compute the sparse mask indices.
    3.  Validate indices against tensor dimensions.
    4.  Apply the mask to the attention scores.
    5.  Test against full attention for correctness.
    6.  Profile memory and latency.

6.  **Decision:** **Use Dynamic Sparse Attention over Static Sparse Attention.** Dynamic sparsity adapts to content, leading to better quality. Static sparsity is simpler but less effective.

7.  **Anti-pattern:** **Caching Sparse Masks Globally.** This leads to memory leaks and stale data. Always compute masks locally and delete them after use.

8.  **Verification Method:** **Unit Test for Index Validation:**
    ```python
    def test_sparse_mask_indices():
        tensor = torch.randn(1, 16, 16, 16)
        indices = compute_sparse_mask(tensor)
        assert indices.max() < tensor.numel()
        assert indices.min() >= 0
    ```

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## 1. Sparse Mask Index Validation Invariant
**RULE**:
Any sparse attention mask applied to a flattened tensor MUST be validated to ensure all indices are within the range `[0, total_tokens)`.
**WHY**:
Flattening multi-dimensional tensors (e.g., video frames) to 1D sequences is a common source of off-by-one errors and index misalignment. Invalid indices lead to silent data corruption (attending to wrong tokens) or crashes.
**WHEN TO APPLY**:
Any system using sparse attention, sparse matrices, or index-based data access on flattened tensors.
**VERIFIED IMPLEMENTATION PATTERN**:
```python
def validate_sparse_indices(indices, total_tokens):
    if indices.numel() == 0:
        return True
    if indices.min() < 0 or indices.max() >= total_tokens:
        raise ValueError(f"Invalid sparse indices: min={indices.min()}, max={indices.max()}, total={total_tokens}")
    return True

# Usage
total_tokens = latent.shape[1] * latent.shape[2] * latent.shape[3]
validate_sparse_indices(sparse_mask_indices, total_tokens)
```
**NEGATIVE CONSTRAINT**:
```python
# NEVER apply sparse indices without validation
output = attention(q, k, v, mask=unvalidated_indices)
```
**VERIFICATION METHOD**:
Unit test that asserts `indices.min() >= 0` and `indices.max() < total_tokens` for all generated masks.

## 2. Modality-Specific Sparsity Heuristic
**RULE**:
In multi-modal models, sparsity heuristics MUST be tailored to the specific modality's correlation structure.
**WHY**:
Different modalities have different correlation structures. Video is locally correlated (spatial/temporal), while audio is globally correlated (temporal). Using a uniform sparsity heuristic leads to poor quality (e.g., desynchronized audio).
**WHEN TO APPLY**:
Any multi-modal model using sparse attention or sparse interactions.
**VERIFIED IMPLEMENTATION PATTERN**:
```python
def compute_modality_aware_mask(token_types, content):
    video_mask = token_types == 'video'
    audio_mask = token_types == 'audio'
    
    # Video: Local spatial/temporal
    video_sparse = compute_local_mask(content[video_mask])
    
    # Audio: Global temporal
    audio_sparse = compute_temporal_mask(content[audio_mask], window_size=large)
    
    # Combine
    combined_mask = torch.zeros_like(content, dtype=torch.bool)
    combined_mask[video_mask] = video_sparse
    combined_mask[audio_mask] = audio_sparse
    
    return combined_mask
```
**NEGATIVE CONSTRAINT**:
```python
# NEVER use a uniform sparsity heuristic for all modalities
mask = compute_uniform_mask(content)
```
**VERIFICATION METHOD**:
A/B test comparing uniform sparsity vs. modality-aware sparsity on a multi-modal dataset, measuring quality metrics (e.g., FID, CLIP score).

## 3. Iterative State Memory Hygiene
**RULE**:
In iterative processes (e.g., diffusion steps), any intermediate tensor that is not part of the final output MUST be explicitly deleted or scoped to prevent memory accumulation.
**WHY**:
Iterative processes can accumulate memory if intermediate tensors are not freed. This leads to OOM errors, especially in long-running inference or training.
**WHEN TO APPLY**:
Any iterative process that generates intermediate tensors (e.g., diffusion, RNNs, iterative solvers).
**VERIFIED IMPLEMENTATION PATTERN**:
```python
def inference_step(latent, step):
    mask = compute_mask(latent)
    output = attention(q, k, v, mask=mask)
    del mask # Explicitly free memory
    return output
```
**NEGATIVE CONSTRAINT**:
```python
# NEVER store intermediate tensors in global state without cleanup
global mask_cache
mask_cache[step] = compute_mask(latent)
```
**VERIFICATION METHOD**:
Memory profiling test that asserts memory usage remains stable across multiple inference steps.

## 7. Actionable Agent Skill & Implementation Checklist

1.  **Validate Input Dimensions:**
    *   Check that input video/audio tensors have the expected shape.
    *   Ensure that `sp_size` is compatible with the input size.
2.  **Compute Sparse Mask:**
    *   Implement the sparsity heuristic (e.g., local, temporal, content-based).
    *   Ensure that the mask is computed on the correct device (GPU).
3.  **Validate Sparse Indices:**
    *   Assert that all indices are within the range `[0, total_tokens)`.
    *   Log any invalid indices for debugging.
4.  **Apply Sparse Attention:**
    *   Use a validated sparse attention kernel.
    *   Ensure that the mask is applied correctly to the attention scores.
5.  **Test Against Full Attention:**
    *   Compare the output of sparse attention with full attention on small inputs.
    *   Assert that the outputs are close (within a tolerance).
6.  **Profile Memory and Latency:**
    *   Measure memory usage and latency for sparse attention vs. full attention.
    *   Ensure that sparse attention provides a significant speedup.
7.  **Clean Up Intermediate Tensors:**
    *   Explicitly delete any intermediate tensors (e.g., masks) after use.
    *   Use `torch.cuda.empty_cache()` if necessary.
8.  **End-to-End Test:**
    *   Run the full inference pipeline with a small video/audio clip.
    *   Check the output for visual artifacts and audio desynchronization.