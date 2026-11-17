# Candidate Directive: [CD-FSCT] Mixed-Precision VAE Latent Normalization Guard

<!-- PROVENANCE_START
{
  "source_repository": "hf-stabilityai-stable-diffusion-xl-base-1.0-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T23:20:46.799Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-stabilityai-stable-diffusion-xl-base-1.0-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-stabilityai-stable-diffusion-xl-base-1.0-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T23:20:46.799Z`  
> **Learning ID**: `LEARN-EVO-hf-stabilityai-stable-diffusion-xl-base-1.0-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When running latent autoencoders (e.g., `AutoencoderKL`) in downstream inference pipelines under IEEE 754 half-precision (`torch.float16`), the VAE decoder and encoder MUST NOT execute intermediate convolutions or attention ops in `fp16` if the dynamic range of activations exceeds $[-65504, 65504]$. Inference runtimes MUST explicitly upcast the VAE decoder modules to `torch.float32` or enforce clamped scale factors before decoding latents.

**WHY**:
The latent space distribution $\mathcal{N}(\mu, \sigma)$ produced by the SDXL 32-channel downsampling UNet yields out-of-distribution activation spikes in the VAE's group normalization and 3D residual blocks. When calculated in `fp16`, variance calculations in `GroupNorm` cause instantaneous numerical underflow/overflow (producing `NaN` or `Inf`), resulting in completely black image outputs (silent catastrophic inference failure).

**WHEN TO APPLY**:
Apply to all latent diffusion autoencoders (SD 1.5, SD 2.1, SDXL, Stable Video Diffusion, Flux) whenever host pipeline memory optimizations cast the global pipeline to `torch.float16` or `torch.bfloat16` on GPUs with compute capabilities $\le 8.9$.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn
from typing import Optional

class RobustVAEDecoderRunner:
    """Enforces FP32 execution isolation for AutoencoderKL to eliminate NaN/Black frames."""
    def __init__(self, vae: nn.Module, force_upcast: bool = True):
        self.vae = vae
        self.force_upcast = force_upcast
        if self.force_upcast:
            # Pin the VAE explicitly in float32 regardless of parent pipeline dtype
            self.vae.to(dtype=torch.float32)

    @torch.no_grad()
    def decode_latents(self, latents: torch.Tensor, scaling_factor: float = 0.13025) -> torch.Tensor:
        # Check for un-denoised or corrupt NaN inputs prior to VAE decode
        if torch.isnan(latents).any() or torch.isinf(latents).any():
            raise FloatingPointError("Corrupted latents encountered: latents contain NaN or Inf values.")

        # Rescale latents using model-specific constant
        scaled_latents = latents / scaling_factor

        # Isolate precision transition
        if self.force_upcast and scaled_latents.dtype != torch.float32:
            scaled_latents = scaled_latents.to(dtype=torch.float32)

        # Execute forward pass within float32 scope
        image = self.vae.decode(scaled_latents).sample

        # Clamp output to valid normalized pixel range [-1, 1] before uint8 mapping
        image = torch.clamp(image, -1.0, 1.0)
        # Shift to [0, 1] range
        image = (image / 2.0) + 0.5
        return image
```

**NEGATIVE CONSTRAINT**:
```python

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T23:20:46.922Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794957646922",
    "title": "Mixed-Precision VAE Latent Normalization Guard",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-stabilityai-stable-diffusion-xl-base-1.0-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "a28041d92e890e98c8b62a36797dedb9cf7af293a97aa1fed7e46c28024a7ba8"
  },
  "evidence_fingerprint": "NO_EVIDENCE",
  "dimensions": {
    "source_reliability": {
      "status": "FAIL",
      "score": 0,
      "tier": "UNTRUSTED_EXTERNAL",
      "findings": [
        "MISSING_SOURCE_URI: Knowledge has no source URL or locator"
      ],
      "details": [
        "Source is completely untraceable; origin cannot be verified."
      ]
    },
    "evidence_quality": {
      "status": "WARN",
      "score": 0.2,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [
        "NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records"
      ],
      "details": [
        "Claim is uncorroborated; relies solely on raw unverified source text."
      ]
    },
    "technical_correctness": {
      "status": "PASS",
      "score": 1,
      "is_adversarial": false,
      "has_dangerous_security": false,
      "directive_opposition": false,
      "opposing_rule": null,
      "unsupported_assumptions": [],
      "findings": [],
      "details": [
        "No direct opposition with canonical operating directives",
        "Substantive technical content verified (> 40 chars)"
      ]
    },
    "reusability": {
      "status": "PASS",
      "score": 1,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
        "Expresses generalized engineering invariants (3 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 1,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)",
        "Includes explicit negative example / anti-pattern contrast"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-17T23:20:46.923Z"
      ]
    },
    "duplication_and_conflict": {
      "status": "PASS",
      "score": 1,
      "is_duplicate": false,
      "duplicate_target": null,
      "is_contradiction": false,
      "conflicting_rule": null,
      "findings": [],
      "details": []
    }
  },
  "detected_contradictions": [],
  "missing_information": [
    "Source provenance",
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [],
  "auth_token": "9fe107619a1b89395467ad106859894282c297567fcd3e5d9e4a56c6a0da5876"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
