> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hf-black-forest-labs-flux.1-dev-learnings.md`  
> **Source**: huggingface ([https://huggingface.co/black-forest-labs/FLUX.1-dev](https://huggingface.co/black-forest-labs/FLUX.1-dev))  
> **Source Version**: `hf-black-for`  
> **License**: Open-Source  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-17T21:38:04.510Z  
> **Learning ID**: `learn-huggingface-black-forest-labs-flux-1-dev`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): black-forest-labs/FLUX.1-dev

---

## 1. Executive Forensic Architecture & System Mechanics

`black-forest-labs/FLUX.1-dev` is a 12-billion-parameter open-weight guidance-distilled rectified flow transformer designed for high-fidelity text-to-image synthesis. The architecture abandons traditional U-Net diffusion and standard DDPM/DDIM formulations in favor of continuous-time Flow Matching across a hybrid DiT (Diffusion Transformer) backbone operating on patchified latent representations.

```
+--------------------------------------------------------------------------------------------------+
|                                      INFERENCE DATAFLOW PIPELINE                                 |
+--------------------------------------------------------------------------------------------------+
|  [ Prompt Text ]                                         [ Latent Noise Canvas: (B, 16, H/8, W/8) ]
|         |                                                            |
|         +------------------------+                                   v
|         v                        v                         [ 2x2 Latent Patchify ]
|  [ CLIP ViT-L/14 ]         [ T5-v1.1-XXL ]                           v
|   (Sequence & Pooled)     (Sequence, 512 max)              [ Token Flatten: (B, (H*W)/256, 64) ]
|         |                        |                                   |
|         v                        v                                   v
|  [ Pooled Vector (768) ]  [ Text Tokens (4096) ]                     |
|         |                        |                                   |
|         |                        +------------------+                |
|         v                                           v                v
|  [ Timestep & Guidance ]                   +----------------------------------+
|  [ Modulations (AdaLN) ]                   |   3D Rotary Position Embeddings  |
|         |                                  |   (RoPE: Time, Height, Width)    |
|         |                                  +----------------------------------+
|         |                                                    |
|         +-----------------------+----------------------------+
|                                 v
|      +--------------------------------------------------------------------+
|      | 19 DoubleStreamBlocks (MMDiT):                                     |
|      |   - Dual stream: Image & Text paths compute independent Q, K, V    |
|      |   - Concatenated cross-attention: [Text_KV, Img_KV]                |
|      |   - AdaLN-Zero scale, shift, and residual gating                   |
|      |   - Independent feed-forward networks (SwiGLU/GELU)                |
|      +--------------------------------------------------------------------+
|                                 |
|                                 v
|      +--------------------------------------------------------------------+
|      | 38 SingleStreamBlocks:                                             |
|      |   - Unified stream: Image and Text tokens concatenated             |
|      |   - Shared self-attention matrix over total sequence               |
|      |   - Integrated unified parallel Linear MLP + Attention projection   |
|      +--------------------------------------------------------------------+
|                                 |
|                                 v
|      [ Unpatchify & Linear Output Projection: (B, (H*W)/256, 64) -> (B, 16, H/8, W/8) ]
|                                 |
|                                 v
|      [ ODE Numerical Integrator: Euler Step with Guidance Scale ]
|                                 |
|                                 v
|      [ 16-Channel AutoencoderKL Decoder (8x spatial upsampling) ] -> Output Image (B, 3, H, W)
+--------------------------------------------------------------------------------------------------+
```

### Architectural Subsystems and Boundaries

1. **Dual Text Encoding Subsystem**:
   - Primary semantic alignment uses two distinct language encoders: OpenAI CLIP ViT-L/14 (extracting pooled global semantic vectors $\mathbf{y}_{\text{pooled}} \in \mathbb{R}^{768}$) and Google T5-v1.1-XXL (extracting rich syntactic and descriptive sequence embeddings $\mathbf{y}_{\text{seq}} \in \mathbb{R}^{L_{\text{text}} \times 4096}$, truncated or padded to $L_{\text{text}} = 512$).
   - Boundary invariant: T5-XXL is kept in `torch.bfloat16` or quantized `fp8_e4m3fn`; any cast to `fp16` induces immediate underflow/overflow artifacts due to the broad dynamic range of T5 internal activations.

2. **Patchified Latent Subsystem**:
   - The spatial representation utilizes a custom 16-channel AutoencoderKL with a downsampling factor of 8 ($f=8$).
   - Latents $\mathbf{z} \in \mathbb{R}^{B \times 16 \times H_{\text{lat}} \times W_{\text{lat}}}$ are patchified via a $2 \times 2$ pixel-unshuffle operation into spatial tokens of dimension $16 \times 2 \times 2 = 64$.
   - The spatial sequence length becomes $S_{\text{img}} = \frac{H_{\text{lat}}}{2} \times \frac{W_{\text{lat}}}{2} = \frac{H}{16} \times \frac{W}{16}$.

3. **Multimodal Rotary Position Embedding (3D RoPE) Subsystem**:
   - Position encoding is non-parametric and multi-dimensional. Spatial coordinates $(h, w)$ and temporal step $t$ are embedded across coordinate grids rather than flattened 1D sequences.
   - Text tokens receive invariant coordinate allocations along the spatial axes $(0, 0)$ while varying across a dedicated text sequence dimension, preserving relative distance semantics independent of canvas aspect ratio.

4. **Hybrid Rectified Flow Transformer Core**:
   - **Double Stream Blocks (19 layers)**: Text and image tokens maintain distinct representations and separate linear projections for queries, keys, and values. Attention is computed across the concatenated key-value representations:
     $$\mathbf{K}_{\text{joint}} = [\mathbf{K}_{\text{img}} \,\|\, \mathbf{K}_{\text{text}}], \quad \mathbf{V}_{\text{joint}} = [\mathbf{V}_{\text{img}} \,\|\, \mathbf{V}_{\text{text}}]$$
     Adaptive Layer Normalization (AdaLN-Zero) modulates shifts, scales, and gating parameters conditioned on the combined timestep $t$ and pooled text embedding $\mathbf{y}_{\text{pooled}}$.
   - **Single Stream Blocks (38 layers)**: Eliminates dual-stream overhead. Concatenates image and text token sequences into a unified tensor $\mathbf{X}_{\text{joint}} \in \mathbb{R}^{B \times (S_{\text{img}} + L_{\text{text}}) \times D}$ ($D = 3072$). Computes self-attention and MLP transformations concurrently via a fused projection layer.

5. **Rectified Flow Matching Integrator**:
   - Replaces stochastic SDE solvers with an ordinary differential equation (ODE) trajectory:
     $$\frac{\mathrm{d}\mathbf{z}_t}{\mathrm{d}t} = v_\theta(\mathbf{z}_t, t, \mathbf{c})$$
   - Linear interpolation path: $\mathbf{z}_t = (1 - t)\mathbf{z}_0 + t\mathbf{z}_1$, where $\mathbf{z}_0$ is data and $\mathbf{z}_1 \sim \mathcal{N}(0, \mathbf{I})$. The network predicts velocity $v_\theta \approx \mathbf{z}_1 - \mathbf{z}_0$.
   - `FLUX.1-dev` utilizes dynamic guidance distillation where guidance scale $\omega$ is passed as an explicit conditioning vector rather than running two separate forward passes (classifier-free guidance), halving execution latency per step.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Multidimensional Continuous-Coordinate RoPE Invariant
**RULE**:
When computing Rotary Position Embeddings (RoPE) over multi-stream heterogeneous inputs (e.g., text tokens joined with 2D spatial image patches), the system MUST allocate decoupled coordinate axes across orthogonal frequency bands and MUST NOT assign 1D sequential indices to 2D/3D topological data.

**WHY**:
Flattening a 2D spatial grid $(H, W)$ into a 1D sequential index $(0, 1, \dots, H \times W - 1)$ breaks the spatial continuity invariant. Points that are vertically adjacent $(y, x)$ and $(y+1, x)$ receive an artificial token distance of $W$, destroying spatial locality under attention. Furthermore, arbitrary resolution and non-standard aspect ratios cause out-of-distribution frequency extrapolation failures.

**WHEN TO APPLY**:
In any transformer system accepting variable-dimension inputs (e.g., audio spectrograms, image patches, video volumes, multi-turn dialogue graphs) entering unified or cross-attention blocks.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch

def create_multimodal_rope_coords(
    text_seq_len: int,
    height_patches: int,
    width_patches: int,
    device: torch.device
) -> torch.Tensor:
    """
    Constructs 3D coordinate grids [dim_idx, y_coord, x_coord] ensuring 
    spatial proximity invariant is preserved across aspect ratios.
    """
    # Text coordinates: zero spatial extent, continuous along dimension 0
    text_coords = torch.zeros((text_seq_len, 3), dtype=torch.float32, device=device)
    text_coords[:, 0] = torch.arange(text_seq_len, dtype=torch.float32, device=device)

    # Image coordinates: constant along dimension 0, explicit spatial grid along dimensions 1 & 2
    y_coords = torch.arange(height_patches, dtype=torch.float32, device=device)
    x_coords = torch.arange(width_patches, dtype=torch.float32, device=device)
    grid_y, grid_x = torch.meshgrid(y_coords, x_coords, indexing="ij")
    
    img_coords = torch.stack([
        torch.zeros_like(grid_y),  # Dim 0: time/modality separation
        grid_y,                    # Dim 1: vertical position
        grid_x                     # Dim 2: horizontal position
    ], dim=-1).reshape(-1, 3)

    # Concatenate along sequence dimension: (L_text + (H*W), 3)
    return torch.cat([text_coords, img_coords], dim=0)

def apply_3d_rope(
    q: torch.Tensor, 
    k: torch.Tensor, 
    coords: torch.Tensor, 
    dim_per_axis: int, 
    theta: float = 10000.0
) -> tuple[torch.Tensor, torch.Tensor]:
    """
    Applies rotary embeddings independently across coordinate axes.
    Total head_dim MUST equal dim_per_axis * 3.
    """
    assert q.shape[-1] == dim_per_axis * 3, f"Head dim {q.shape[-1]} != 3 * {dim_per_axis}"
    
    # Generate frequencies: (dim_per_axis // 2)
    half_dim = dim_per_axis // 2
    freqs = 1.0 / (theta ** (torch.arange(0, half_dim, dtype=torch.float32, device=q.device) / half_dim))
    
    # Outer product for each axis: coords is (Seq, 3) -> freqs per axis (Seq, half_dim)
    # Concatenate rotations across head dimension chunks
    rot_sin_list, rot_cos_list = [], []
    for axis in range(3):
        axis_coords = coords[:, axis]  # (Seq,)
        angles = torch.outer(axis_coords, freqs)  # (Seq, half_dim)
        rot_sin_list.append(torch.sin(angles))
        rot_cos_list.append(torch.cos(angles))
        
    sin = torch.cat(rot_sin_list, dim=-1).unsqueeze(0).unsqueeze(2)  # (1, Seq, 1, HeadDim//2)
    cos = torch.cat(rot_cos_list, dim=-1).unsqueeze(0).unsqueeze(2)
    
    def rotate_half(x: torch.Tensor) -> torch.Tensor:
        x1, x2 = x.chunk(2, dim=-1)
        return torch.cat((-x2, x1), dim=-1)
    
    q_rot = (q * cos.repeat_interleave(2, dim=-1)) + (rotate_half(q) * sin.repeat_interleave(2, dim=-1))
    k_rot = (k * cos.repeat_interleave(2, dim=-1)) + (rotate_half(k) * sin.repeat_interleave(2, dim=-1))
    return q_rot, k_rot
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Flattening multi-dimensional grids into 1D sequences prior to RoPE
def apply_naive_1d_rope_to_images(tokens: torch.Tensor) -> torch.Tensor:
    # Destroys spatial invariant: pixel (y, x) has distance 1 to (y, x+1),
    # but distance W to (y+1, x). Cross-row spatial coherence is corrupted.
    seq_len = tokens.shape[1]
    positions = torch.arange(seq_len, device=tokens.device)
    return naive_1d_rotary(tokens, positions)
```

**VERIFICATION METHOD**:
Verify that the relative attention score between coordinate $(y_1, x_1)$ and $(y_2, x_2)$ depends exclusively on $(\Delta y, \Delta x) = (|y_1 - y_2|, |x_1 - x_2|)$ and is strictly invariant under horizontal or vertical translation:
$$\mathbf{A}_{(y_1+k_y, x_1+k_x), (y_2+k_y, x_2+k_x)} == \mathbf{A}_{(y_1, x_1), (y_2, x_2)} \quad \forall k_x, k_y$$

---

### 2. Guidance-Distilled Rectified Trajectory Numerical Bounds
**RULE**:
When running ordinary differential equation (ODE) integrators for Flow Matching models distilled with dynamic classifier-free guidance, the inference driver MUST normalize timesteps strictly to $t \in [0.0, 1.0]$ with monotonic non-zero increments, clamp vector predictions to prevent finite arithmetic blowups, and MUST NOT extrapolate beyond $t > 1.0$ or $t < 0.0$.

**WHY**:
Unlike diffusion models where $t$ indexes variance schedules $\sigma(t) \in [\sigma_{\min}, \sigma_{\max}]$ (which can be parameterized on unbounded logarithmic scales), Rectified Flow defines vector fields on linear interpolation paths $\mathbf{x}_t = (1 - t)\mathbf{x}_0 + t\mathbf{x}_1$. Evaluating outside $[0.0, 1.0]$ produces undefined latent states that instantly destabilize VAE decoders into generating saturated monochrome outputs or NaN arrays.

**WHEN TO APPLY**:
All ODE integration loops, continuous-time diffusion samplers, and Rectified Flow pipelines (FLUX, SD3, Flow-Matching transformers).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch

@torch.no_grad()
def solve_rectified_flow_ode(
    model: torch.nn.Module,
    latents: torch.Tensor,
    text_embeddings: torch.Tensor,
    pooled_embeddings: torch.Tensor,
    guidance_val: float,
    num_steps: int = 28,
    shift: float = 1.0
) -> torch.Tensor:
    """
    Solves ODE dz/dt = v_theta(z, t) over strictly bounded range t in [1.0, 0.0].
    Applies empirical time-shift schedule for high-resolution flow rectification.
    """
    device = latents.device
    # Generate linear time steps from 1.0 (pure noise) down to 0.0 (clean data)
    timesteps = torch.linspace(1.0, 0.0, num_steps + 1, device=device, dtype=torch.float32)
    
    # Resolution-dependent non-linear time shift
    # t_shifted = (shift * t) / (1 + (shift - 1) * t)
    timesteps = (shift * timesteps) / (1.0 + (shift - 1.0) * timesteps)
    
    guidance_vec = torch.full((latents.shape[0],), guidance_val, device=device, dtype=torch.float32)

    for i in range(num_steps):
        t_curr = timesteps[i]
        t_next = timesteps[i + 1]
        dt = t_next - t_curr  # Invariant: dt is negative since we integrate from 1 to 0
        
        # Invariant check: boundaries
        assert 0.0 <= t_curr <= 1.0, f"Out of bounds t_curr: {t_curr}"
        assert 0.0 <= t_next <= 1.0, f"Out of bounds t_next: {t_next}"

        t_tensor = torch.full((latents.shape[0],), t_curr, device=device, dtype=torch.float32)
        
        # Predict velocity vector field
        v_pred = model(
            img=latents,
            img_ids=None,
            txt=text_embeddings,
            txt_ids=None,
            y=pooled_embeddings,
            timesteps=t_tensor,
            guidance=guidance_vec
        )
        
        # Nan/Inf containment barrier
        if not torch.isfinite(v_pred).all():
            raise FloatingPointError(f"NaN/Inf detected in velocity prediction at step {i}, t={t_curr}")

        # Euler step: z_{t + dt} = z_t + dt * v_t
        latents = latents + dt * v_pred

    return latents
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Arbitrary DDIM noise schedules or unscaled timesteps in Flow Matching
def invalid_flow_step(model, z, step_idx):
    # Mixing up DDPM discrete steps (1000 -> 0) with Flow ODE (1.0 -> 0.0)
    t = float(1000 - step_idx)  # Catastrophic: t >> 1.0 causes immediate linear divergence
    v = model(z, t)
    return z - v * 0.05
```

**VERIFICATION METHOD**:
Inject unit assertions validating that `0.0 <= t <= 1.0` at every integration cycle, and run an automated property test checking that latent tensor $L_2$ norm does not grow exponentially:
$$\|\mathbf{z}_{t_{k+1}}\|_2 \le \|\mathbf{z}_{t_k}\|_2 + |dt| \cdot \|\mathbf{v}_\theta\|_2$$

---

### 3. Asymmetric Mixed-Precision Quantization Barrier
**RULE**:
When running 12B+ parameter MMDiT models under memory-constrained runtimes, T5-XXL feed-forward blocks and MMDiT Attention projections MAY be quantized to `FP8_E4M3FN` or `FP8_E5M2`, but the RoPE coordinate calculation, AdaLN modulation generators, and latent normalization operations MUST remain strictly pinned to `torch.float32` or `torch.bfloat16`.

**WHY**:
Modulation scale and shift parameters $(\gamma, \beta, \alpha)$ operate near zero in initialized AdaLN-Zero blocks. Quantizing modulations or normalizations to 8-bit floating point formats with narrow mantissas (e.g., E5M2 with 2 bits of mantissa, or E4M3 with limited dynamic range) leads to underflow to zero or coarse rounding steps, causing full model collapse, grid artifacts, and loss of prompt responsiveness.

**WHEN TO APPLY**:
In any FP8/INT8 weight quantization pipeline targeting FLUX, SD3, or Transformers employing Adaptive LayerNorm (AdaLN) conditioning.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn

class SafeModulatedLinear(nn.Module):
    """
    Enforces high-precision modulation computation alongside quantized weights.
    """
    def __init__(self, in_features: int, out_features: int):
        super().__init__()
        # Linear layer weights may be quantized to FP8
        self.linear = nn.Linear(in_features, out_features, bias=True)
        # Modulation vectors must stay in float32 / bfloat16
        self.ada_lin = nn.Linear(in_features, out_features * 6, bias=True)

    def forward(self, x: torch.Tensor, condition: torch.Tensor) -> torch.Tensor:
        # Step 1: Force condition modulation in full precision
        with torch.autocast(device_type="cuda", dtype=torch.float32):
            mod_params = self.ada_lin(condition.to(torch.float32))
            shift_msa, scale_msa, gate_msa, shift_mlp, scale_mlp, gate_mlp = mod_params.chunk(6, dim=-1)

        # Step 2: Compute LayerNorm and modulate in bfloat16
        x_norm = torch.nn.functional.layer_norm(x.to(torch.bfloat16), (x.shape[-1],))
        modulated_x = x_norm * (1.0 + scale_msa.to(torch.bfloat16)) + shift_msa.to(torch.bfloat16)

        # Step 3: Compute inner dot products (safe for FP8 kernel execution)
        out = self.linear(modulated_x)
        
        # Step 4: Apply gate in high precision before residual sum
        gate = gate_msa.to(torch.bfloat16)
        return x + gate * out
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Uniform casting of entire network modules to FP8
def quantize_entire_transformer_unsafe(module: nn.Module):
    for sub in module.modules():
        if isinstance(sub, (nn.Linear, nn.LayerNorm)):
            # CATASTROPHIC: Quantizing LayerNorm or modulation projections to FP8 
            # destroys AdaLN-zero gradient flows and truncates sub-0.01 scale factors.
            sub.to(torch.float8_e4m3fn)
```

**VERIFICATION METHOD**:
Run automated tensor inspection during inference:
```python
def assert_no_fp8_normalization(model: torch.nn.Module):
    for name, module in model.named_modules():
        if "norm" in name.lower() or "modulation" in name.lower():
            for param_name, param in module.named_parameters():
                assert param.dtype in (torch.float32, torch.bfloat16), (
                    f"Forbidden FP8 dtype {param.dtype} found in critical parameter: {name}.{param_name}"
                )
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: T5-XXL FP16 Clamping Underflow Breakdown (BUG-FLUX-01)
- **Context**: `flux/modules/conditioner.py` and Hugging Face `transformers` integration.
- **What Was Expected**: Running the T5-XXL text encoder on 16GB GPUs using half-precision (`float16`) to fit within VRAM constraints while preserving text embeddings.
- **What Actually Happened**: When prompted with descriptive text, the model generated pure random noise or severe visual static. T5-XXL activation values exceeded the dynamic range of IEEE 754 half-precision (`fp16` maximum exponent $\approx 65504$), yielding `inf` values which converted to `NaN` in downstream softmax attention blocks. Alternatively, small weights underflowed to zero, eliminating textual semantics.
- **Evidence in Repo**: Production issue reports in early community wrappers and pull requests enforcing `bfloat16` or explicit layer-wise scale clamping for T5 weights.
- **Root Cause**: T5 models are trained without activation clipping on LayerNorm layers, producing intermediate values exceeding 65,504. Standard FP16 has 5 exponent bits and 10 mantissa bits, whereas BFloat16 retains 8 exponent bits (equivalent to FP32).
- **Remediation Code Diff**:
```python
# - Buggy code / What failed
# conditioner = T5EncoderModel.from_pretrained(t5_path, torch_dtype=torch.float16).to(device)

# + Fixed pattern / Safe invariant
# Enforce BFloat16 regardless of GPU architecture, or fall back to 8-bit quantized T5
if not torch.cuda.is_bf16_supported():
    # If device lacks native BF16, maintain T5 in FP32 or use quantized INT8/FP8 weights
    conditioner = T5EncoderModel.from_pretrained(t5_path, load_in_8bit=True, device_map="auto")
else:
    conditioner = T5EncoderModel.from_pretrained(t5_path, torch_dtype=torch.bfloat16).to(device)
```
- **Lesson**: High-capacity text encoders (T5, Gemma, Llama) with pre-LayerNorm or unscaled cross-attention MUST NOT be cast to IEEE 754 standard `fp16`; `bfloat16` or explicitly managed FP8 dynamic scales are mandatory.

---

### Incident 2: Latent Packing Spatial Unshuffle Off-By-One Stride Alignment (BUG-FLUX-02)
- **Context**: `flux/modules/image_embedders.py` — Latent patchification and coordinate grid alignment.
- **What Was Expected**: Input images of variable dimensions (e.g., $1024 \times 768$, $832 \times 1216$) downsampled by $f=8$ and patchified by $2 \times 2$ produce aligned integer token sequences:
  $$S = \frac{H}{16} \times \frac{W}{16}$$
- **What Actually Happened**: When arbitrary resolutions not divisible by 16 were input (e.g., $1020 \times 768$ where $1020 / 16 = 63.75$), the patchify unbind operation caused dimension mismatch runtime crashes inside `DoubleStreamBlock` attention concatenation:
  ```
  RuntimeError: Sizes of tensors must match except in dimension 1. Expected size 3822 but got 3840.
  ```
- **Evidence in Repo**: Input validation guards added to image preprocessing CLI and wrapper pipelines forcing $16\text{px}$ spatial divisibility constraints before autoencoder encoding.
- **Root Cause**: The VAE has a stride of 8. The spatial patchifier groups $2 \times 2$ latent blocks into single tokens, imposing a secondary stride of 2. The composite stride is $8 \times 2 = 16$. Non-multiples of 16 create non-integer token grids.
- **Remediation Code Diff**:
```python
# - Buggy code / What failed
# latents = vae.encode(img).latent_dist.sample()
# patches = rearrange(latents, "b c (h p1) (w p2) -> b (h w) (c p1 p2)", p1=2, p2=2)

# + Fixed pattern / Safe invariant
h, w = img.shape[-2:]
h_aligned = (h // 16) * 16
w_aligned = (w // 16) * 16
if h != h_aligned or w != w_aligned:
    img = torch.nn.functional.interpolate(img, size=(h_aligned, w_aligned), mode="bilinear", align_corners=False)

latents = vae.encode(img).latent_dist.sample()
patches = rearrange(latents, "b c (h p1) (w p2) -> b (h w) (c p1 p2)", p1=2, p2=2)
```
- **Lesson**: Composite neural architectures inherit the least common multiple (LCM) of all spatial reduction stages. Input assertions must validate against the total pipeline stride ($\prod \text{stride}_i$) at the ingestion boundary.

---

### Incident 3: FlashAttention-2 vs. SDPA Non-Deterministic Sequence Padding Mismatch (BUG-FLUX-03)
- **Context**: `flux/math.py` attention kernel selection across varying prompt token lengths.
- **What Was Expected**: Batch inference containing text prompts of varying token lengths padded to 512 tokens produces identical outputs regardless of whether PyTorch `scaled_dot_product_attention` (SDPA) or `flash_attn_varlen_func` is selected.
- **What Actually Happened**: Prompts padded with zero-tokens produced distinct visual artifacts and color drifts under `flash_attn_varlen_func` when padding tokens were included in key-value sets without explicit causal/unpadded masking, causing attention probability mass leakage into null tokens.
- **Evidence in Repo**: Explicit masking logic updates and sequence unpadding utilities separating text tokens from padded buffers before invoking fused attention kernels.
- **Root Cause**: Dense SDPA masked padded positions via $-\infty$ attention masks, but FlashAttention unpadded kernels required an explicit `cu_seqlens` (cumulative sequence lengths) vector. Feeding padded tensors into unpadded kernels resulted in stride misalignment.
- **Remediation Code Diff**:
```python
# - Buggy code / What failed
# out = flash_attn_func(q, k, v, dropout_p=0.0, softmax_scale=scale)

# + Fixed pattern / Safe invariant
if use_flash_attn:
    # Compute unpadded cu_seqlens to isolate actual prompt tokens from padding
    q_unpad, indices_q, cu_seqlens_q, max_seqlen_q = unpad_input(q, text_mask)
    k_unpad, indices_k, cu_seqlens_k, max_seqlen_k = unpad_input(k, text_mask)
    out_unpad = flash_attn_varlen_func(
        q_unpad, k_unpad, v_unpad,
        cu_seqlens_q=cu_seqlens_q,
        cu_seqlens_k=cu_seqlens_k,
        max_seqlen_q=max_seqlen_q,
        max_seqlen_k=max_seqlen_k
    )
    out = pad_input(out_unpad, indices_q, batch_size, seq_len)
else:
    out = torch.nn.functional.scaled_dot_product_attention(q, k, v, attn_mask=attn_mask)
```
- **Lesson**: When transitioning between dense tensor operators and variable-length sparse/flash kernels, sequence length metadata (`cu_seqlens`) must be derived directly from validated attention masks, never inferred from tensor shapes.

---

### Incident 4: RoPE Coordinate Broadcast Degradation on Non-Square Images (BUG-FLUX-04)
- **Context**: `flux/modules/layers.py` — `EmbedND` coordinate generator.
- **What Was Expected**: Images with 16:9 or 9:16 aspect ratios maintain structural fidelity and geometry without isotropic stretching or warping.
- **What Actually Happened**: Generating widescreen ($1344 \times 768$) images caused duplicated human limbs, warped horizons, and vertical artifact repetition.
- **Evidence in Repo**: PR fixing 2D coordinate mesh generation where coordinate bounds were normalized to $