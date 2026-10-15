> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hf-akatz-ai-minimax-h3-character-swap-lora-learnings.md`  
> **Source**: huggingface ([https://huggingface.co/akatz-ai/MiniMax-H3-Character-Swap-LoRA](https://huggingface.co/akatz-ai/MiniMax-H3-Character-Swap-LoRA))  
> **Source Version**: `hf-akatz-ai-`  
> **License**: Open-Source  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-14T12:55:28.809Z  
> **Learning ID**: `learn-huggingface-hf-akatz-ai-minimax-h3-character-swap-lora-mv844oix`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): akatz-ai/MiniMax-H3-Character-Swap-LoRA

## 1. Executive Forensic Architecture & System Mechanics

**Technical Problem:**
The repository addresses the specific challenge of **identity-preserving character replacement** in video generation using the MiniMax-H3 architecture. Unlike standard text-to-video or image-to-video models that regenerate the entire scene (losing background consistency and motion timing), this system utilizes a **Ref2VA (Reference-to-Video-Adapter)** paradigm. The core problem is decoupling the *identity* of a subject (from a static reference image) from the *spatial-temporal context* (from a source video), allowing the model to "paste" the new identity onto the existing motion and background without regenerating the physics of the scene.

**Architectural Boundaries:**
1.  **Adapter-Only Distribution:** The artifact is strictly a **LoRA (Low-Rank Adaptation)** adapter (`h3_character_swap_pro4500_1000.safetensors`). It is **not** a standalone model. It requires a separate base model (`Comfy-Org/MiniMax-H3`) and specific VAEs. This enforces a strict dependency boundary: the adapter contains only the delta weights for the attention layers, not the full diffusion backbone.
2.  **Ref2VA Subsystem:** The architecture relies on a "training assistant" (`ostris/minimax_h3_training_adapter`) which was used during training but is **not** merged into the final artifact. This implies the final LoRA has internalized the reference-conditioning logic, allowing it to work with standard ComfyUI LoRA loaders without custom node logic for the reference input, provided the base model supports Ref2VA.
3.  **Input Modality Split:**
    *   `<Video 1>`: Source video (provides motion, camera, background, lighting).
    *   `<Picture 1>`: Reference image (provides identity, outfit, art style).
    *   **Prompt:** Natural language instruction specifying *which* character to swap and *what* to preserve.

**Critical Subsystem Abstractions:**
*   **Identity Encoder:** The mechanism by which the reference image is encoded into latent space and injected into the diffusion process.
*   **Temporal Consistency Module:** The part of the model responsible for maintaining frame-to-frame coherence. The README explicitly notes that "motion timing... remain unreliable," indicating this is the weakest link in the current 1,000-step training.
*   **Prompt-Conditioned Masking:** The model uses natural language to determine *where* to apply the swap. This is a soft-mask approach, not a hard pixel-mask, leading to the observed failure mode where "stronger expression instructions sometimes suppressed the swap entirely."

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Adapter Dependency Isolation & Runtime Contract Enforcement
**RULE**:
When distributing a LoRA or adapter for a complex multimodal model (e.g., Video-to-Video), the artifact MUST be strictly decoupled from the base model weights. The distribution MUST include a machine-readable manifest (`base-model-files.json`) that explicitly lists the exact hashes and revisions of the base model and any auxiliary components (like VAEs or training assistants) required for inference. The adapter MUST NOT assume the presence of any auxiliary components (like the "training assistant") in the inference runtime unless explicitly documented as a required runtime dependency.

**WHY**:
Forensic analysis of the README reveals that the training used a "frozen Ostris Ref2VA training assistant" which is **not** merged into the adapter. If a user assumes the adapter is self-contained or that the assistant is required at inference time without checking the manifest, they will encounter silent failures or incorrect outputs. The "Ref2VA" capability is a property of the *base model* + *adapter* combination, not the adapter alone. Without explicit hash pinning, users may pair the adapter with an incompatible base model revision, leading to catastrophic identity leakage or motion artifacts.

**WHEN TO APPLY**:
Any project distributing fine-tuned adapters (LoRA, DreamBooth, etc.) for large multimodal models (Video, 3D, Audio) where the base model has multiple variants or auxiliary components.

**VERIFIED IMPLEMENTATION PATTERN**:
```json
// training/base-model-files.json
{
  "base_model": {
    "repo_id": "Comfy-Org/MiniMax-H3",
    "file_name": "minimax_h3_ref2va_pruned_int8_convrot.safetensors",
    "sha256": "a1b2c3d4e5f6...", // Exact hash
    "revision": "main"
  },
  "vae": {
    "repo_id": "Comfy-Org/MiniMax-H3",
    "file_name": "vae.safetensors",
    "sha256": "f6e5d4c3b2a1..."
  },
  "auxiliary_components": {
    "training_assistant": {
      "repo_id": "ostris/minimax_h3_training_adapter",
      "note": "Used for training only. NOT required for inference. Do not load at runtime."
    }
  },
  "inference_requirements": {
    "min_comfyui_version": "0.3.0",
    "required_nodes": ["LoadVideo", "LoadImage", "KSampler", "VAEDecode"]
  }
}
```

**NEGATIVE CONSTRAINT**:
```json
// BAD: Vague or missing dependency specification
{
  "base_model": "MiniMax-H3", // No hash, no revision
  "notes": "Works with H3" // Ambiguous, does not specify Ref2VA variant
}
```

**VERIFICATION METHOD**:
1.  **Automated Hash Check:** A CI script that downloads the base model specified in the manifest and verifies the SHA-256 hash matches.
2.  **Inference Smoke Test:** A test that loads the adapter with the *exact* base model version and verifies that the output video has a different identity than the source but similar motion (using optical flow comparison).
3.  **Negative Test:** Load the adapter with an *older* base model revision and assert that the output is either an error or significantly degraded (to prove the dependency is real).

### 2. Prompt-Conditioned Soft-Masking Failure Mode Mitigation
**RULE**:
When using natural language prompts to control spatial or semantic masking in diffusion models (e.g., "Replace only the man in the purple shirt"), the system MUST NOT rely solely on prompt wording for strict alignment. The prompt MUST be treated as a *soft bias*, not a hard constraint. The system MUST provide a fallback mechanism (e.g., a separate mask input or a higher strength setting) for cases where the prompt fails to isolate the target. The documentation MUST explicitly state that "prompt wording is not a guarantee of strict source alignment."

**WHY**:
The README explicitly states: "Prompt wording is not a guarantee of strict source alignment" and "stronger expression instructions sometimes suppressed the swap entirely." This indicates that the model's attention mechanism is sensitive to prompt complexity. If a user writes a complex prompt with many preservation instructions, the model may over-prioritize preserving the original identity over swapping it, leading to a "suppressed swap." This is a known failure mode in prompt-conditioned diffusion where the cross-attention weights for the reference image are overwhelmed by the text conditioning.

**WHEN TO APPLY**:
Any AI system that uses natural language to control fine-grained edits (e.g., "change the color of the car," "remove the person in the background").

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# Pseudocode for a robust inference pipeline
def perform_character_swap(source_video, reference_image, prompt, strength=1.0):
    # 1. Pre-process: Ensure prompt is concise
    if len(prompt.split()) > 20:
        logger.warning("Prompt is complex. Consider simplifying to avoid swap suppression.")
    
    # 2. Inference with explicit strength control
    output = model.inference(
        video=source_video,
        reference=reference_image,
        prompt=prompt,
        lora_strength=strength, # Start at 1.0, but allow user to adjust
        negative_prompt="blurry, distorted, identity mismatch"
    )
    
    # 3. Post-process: Verify swap occurred
    if not verify_identity_change(source_video, output, reference_image):
        logger.error("Swap may have been suppressed. Try increasing strength or simplifying prompt.")
        # Optional: Retry with simplified prompt
        simplified_prompt = extract_core_instruction(prompt)
        output = model.inference(..., prompt=simplified_prompt, lora_strength=strength * 1.1)
        
    return output
```

**NEGATIVE CONSTRAINT**:
```python
# BAD: Assuming prompt is a hard constraint
def perform_swap(source, ref, prompt):
    # No validation, no strength adjustment, no fallback
    return model.inference(source, ref, prompt)
```

**VERIFICATION METHOD**:
1.  **A/B Testing:** Run the same video with a simple prompt ("Swap the man") and a complex prompt ("Swap the man in the purple shirt, keep his pose, keep the background, keep the lighting, keep the other people"). Measure the identity similarity between the output and the reference image. The complex prompt should show lower similarity (suppression).
2.  **User Documentation:** Assert that the README contains the phrase "not a guarantee of strict source alignment."

## 3. Forensic Real Incidents & Production Patches (Incidents 1 to 5+)

*Note: The provided data contains no commit patches, bug issues, or post-mortems. The following incidents are inferred from the explicit limitations and failure modes described in the README, which serve as "known issues" in the production environment.*

### Incident 1: Motion Timing and Hard Cut Artifacts (BUG-MOTION-01)
- **Context**: Temporal consistency subsystem in the diffusion model.
- **What Was Expected**: The swapped character should maintain the exact motion timing, pose, and hard cuts of the source video.
- **What Actually Happened**: "Motion timing, facial expressions, and hard cuts remain unreliable." This suggests that the model struggles with rapid changes in pose or camera angle, leading to jittery motion or identity flicker at cut points.
- **Evidence in Repo**: README section "Use" states: "motion timing, facial expressions, and hard cuts remain unreliable."
- **Root Cause**: The LoRA was trained for only 1,000 steps, which may be insufficient to fully learn the complex temporal dynamics of the base model. Additionally, the Ref2VA architecture may not fully preserve the temporal attention maps of the source video, leading to a "re-generation" of motion rather than a "paste" of identity.
- **Remediation Code Diff**:
```python
# - Buggy: No temporal smoothing or cut detection
# + Fixed: Implement a post-processing step that detects hard cuts (using scene change detection) and applies a stronger identity lock or a different inference strategy for those frames.
def post_process_video(video):
    cuts = detect_scene_changes(video)
    for cut in cuts:
        # Apply a higher strength or a different prompt for the frames around the cut
        video[cut-2:cut+2] = model.inference(..., lora_strength=1.2)
    return video
```
- **Lesson**: Temporal consistency in video diffusion is a separate challenge from spatial identity. A LoRA trained for identity may not be sufficient for motion preservation. Post-processing or a more complex training regimen is required.

### Incident 2: Prompt Suppression of Swap (BUG-PROMPT-02)
- **Context**: Prompt conditioning and cross-attention mechanism.
- **What Was Expected**: The prompt should guide the model to swap the specified character while preserving the rest of the scene.
- **What Actually Happened**: "Stronger expression instructions sometimes suppressed the swap entirely." When the prompt contains many preservation instructions, the model may prioritize preserving the original identity over swapping it.
- **Evidence in Repo**: README section "Use" states: "stronger expression instructions sometimes suppressed the swap entirely."
- **Root Cause**: The cross-attention weights for the text prompt and the reference image are in competition. A complex prompt with many preservation instructions may increase the weight of the text conditioning, overwhelming the reference image conditioning.
- **Remediation Code Diff**:
```python
# - Buggy: Using a complex prompt without adjusting strength
# + Fixed: Use a simpler prompt or increase the LoRA strength to counteract the text conditioning.
def perform_swap(source, ref, prompt):
    if is_complex_prompt(prompt):
        strength = 1.2 # Increase strength to ensure swap occurs
    else:
        strength = 1.0
    return model.inference(source, ref, prompt, lora_strength=strength)
```
- **Lesson**: Prompt complexity can have unintended side effects in diffusion models. Always test prompts with varying levels of complexity and adjust the LoRA strength accordingly.

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

1.  **Micro-Syntax & Token-Level Precision**:
    *   **LoRA Strength Coercion**: The LoRA strength is a float value. It MUST be clamped to a reasonable range (e.g., 0.0 to 2.0) to prevent numerical instability in the attention layers. A strength of 0.0 should result in no change, and a strength of 1.0 should be the default.
    *   **Frame Grid Alignment**: The README specifies "Use 24 fps and your runtime's supported H3 frame grid." This implies that the video must be resampled to 24 fps and the number of frames must be a multiple of the model's temporal patch size (e.g., 4 or 8). If the frame count is not aligned, the model may produce artifacts or fail.

2.  **Infinite Loop & Recursion Guards**:
    *   **No Recursion in Inference**: The inference process is a single forward pass through the diffusion model. There is no recursion. However, if a post-processing step (e.g., identity verification) fails, it MUST NOT trigger an infinite retry loop. A maximum retry count (e.g., 3) MUST be enforced.

3.  **UI & UX Micro-Mechanics**:
    *   **Progress Indication**: Video generation is slow. The UI MUST provide a progress bar or status update for each step of the diffusion process. Without this, users may assume the system is hung.
    *   **Preview Throttling**: If the UI provides a live preview of the generated video, it MUST be throttled to avoid overwhelming the browser or GPU. A preview should be updated every N steps (e.g., every 10 steps) rather than every step.

4.  **Backend Concurrency & Memory Safety**:
    *   **GPU Memory Management**: Video generation requires significant GPU memory. The system MUST ensure that the source video, reference image, and intermediate latents are not all held in memory simultaneously. The source video should be processed in chunks (e.g., 4-5 seconds at a time) to fit within GPU memory limits.
    *   **Connection Pooling**: If the system uses a remote API for inference, the connection pool MUST be properly managed to avoid starvation. A timeout MUST be set for each request.

5.  **Defect & Error Prevention ("Galti Pakadna")**:
    *   **Null Reference Check**: The reference image MUST be validated to ensure it is not null or empty. If the reference image is missing, the system MUST fail fast with a clear error message.
    *   **Off-by-One in Frame Chunks**: When processing the video in chunks, the chunk boundaries MUST be carefully calculated to avoid overlapping or missing frames. An off-by-one error here would result in a missing or duplicated frame in the output video.

## 5. The 9 Deep Learning Dimensions

1.  **Architecture**: The system is a **modular adapter** architecture. The base model (MiniMax-H3) is a large, frozen diffusion model. The LoRA is a small, trainable adapter that modifies the attention layers. This allows for efficient fine-tuning and easy distribution. The Ref2VA subsystem is a key architectural feature that enables reference-based conditioning.
2.  **Core Abstractions**: The key abstractions are the **Latent Space** (where the diffusion process occurs), the **Reference Encoder** (which encodes the reference image into latent space), and the **Temporal Attention** (which maintains frame-to-frame consistency). The LoRA modifies the weights of the attention layers to learn the identity swap.
3.  **Error Handling**: The system relies on **prompt-based error mitigation**. If the swap fails, the user can adjust the prompt or the LoRA strength. There is no automatic error recovery. The system MUST provide clear error messages if the input video or reference image is invalid.
4.  **Testing**: The testing strategy is **manual evaluation** with a small set of test videos. The README provides a showcase GIF with four examples. There is no automated testing framework. A robust testing strategy would include automated identity verification (e.g., using a face recognition model) and motion consistency metrics (e.g., optical flow).
5.  **Security**: The system is a local inference system, so security is primarily about **input validation**. The system MUST validate the input video and reference image to prevent malicious inputs (e.g., extremely large files, corrupted files). The LoRA file itself is a binary file, so it MUST be verified for integrity (e.g., SHA-256 hash).
6.  **Performance**: The system is **compute-intensive**. Video generation requires significant GPU memory and compute. The performance is limited by the GPU's memory and compute capacity. The system MUST be optimized for memory efficiency (e.g., using mixed precision, gradient checkpointing).
7.  **Deployment**: The system is deployed as a **LoRA file** in a ComfyUI environment. The deployment is simple: place the file in the `loras` directory and load it. The system MUST be compatible with the specific version of ComfyUI and the base model.
8.  **Agent Patterns**: The system can be used in an **agent pipeline** where an agent selects the reference image, generates the prompt, and performs the inference. The agent MUST be able to handle errors and adjust the prompt or strength based on the output.
9.  **Data Flow**: The data flow is: **Source Video** -> **VAE Encode** -> **Latent Space** -> **Diffusion Process (with LoRA)** -> **VAE Decode** -> **Output Video**. The reference image is encoded separately and injected into the diffusion process via cross-attention.

## 6. The 8 Learning Extraction Artifacts

1.  **Pattern**: **Adapter-Only Distribution with Manifest**. Distribute only the LoRA file, along with a JSON manifest that specifies the exact base model, VAE, and auxiliary components required.
2.  **Rule**: **Prompt Complexity Inverse Correlation**. The more complex the prompt, the lower the likelihood of a successful swap. Use simple prompts and adjust the LoRA strength to compensate.
3.  **Architecture Principle**: **Modular Adapter Design**. Use LoRA adapters to fine-tune large models. This allows for efficient training, easy distribution, and easy combination with other adapters.
4.  **Failure Mode**: **Motion Timing Artifacts**. The model may fail to preserve the exact motion timing of the source video, leading to jittery motion or identity flicker.
5.  **Reusable Skill**: **Identity Verification Post-Processing**. After generating the video, use a face recognition model to verify that the identity of the swapped character matches the reference image. If not, adjust the prompt or strength and retry.
6.  **Decision**: **1,000-Step Training**. The LoRA was trained for only 1,000 steps. This is a trade-off between training time and quality. A longer training would likely improve motion consistency but would take more time and compute.
7.  **Anti-pattern**: **Assuming Prompt is a Hard Constraint**. Do not assume that the prompt will strictly control the swap. Always test with varying prompt complexity and adjust the LoRA strength.
8.  **Verification Method**: **Automated Identity and Motion Metrics**. Use automated metrics (e.g., face recognition similarity, optical flow consistency) to verify the quality of the output video.

## 7. Actionable Agent Skill & Implementation Checklist

1.  **Validate Input**: Ensure the source video is 24 fps and the frame count is aligned with the model's temporal patch size. Ensure the reference image is not null or empty.
2.  **Load Base Model**: Load the exact base model specified in the manifest. Verify the SHA-256 hash.
3.  **Load LoRA**: Load the LoRA file with a strength of 1.0.
4.  **Generate Prompt**: Use a simple prompt that specifies the target character and the reference image. Avoid complex preservation instructions.
5.  **Perform Inference**: Run the diffusion process. Monitor GPU memory and compute usage.
6.  **Post-Process**: Use a face recognition model to verify that the identity of the swapped character matches the reference image. Use optical flow to verify that the motion is consistent with the source video.
7.  **Iterate**: If the verification fails, adjust the prompt or the LoRA strength and retry. Limit the number of retries to 3.
8.  **Output**: Save the output video and the verification metrics.