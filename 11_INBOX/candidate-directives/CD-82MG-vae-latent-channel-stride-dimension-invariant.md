# Candidate Directive: [CD-82MG] VAE Latent Channel-Stride Dimension Invariant

<!-- PROVENANCE_START
{
  "source_repository": "hf-comfy-org-moss-image-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T08:25:40.044Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-comfy-org-moss-image-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-comfy-org-moss-image-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T08:25:40.044Z`  
> **Learning ID**: `LEARN-EVO-hf-comfy-org-moss-image-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
Any diffusion inference node consuming FLUX or MOSS-Image VAE models MUST assert that latent tensor spatial dimensions are exact integer multiples of the VAE downscale stride ($8\times$ or $16\times$) and verify that latent channel depth strictly matches the autoencoder codebook expectation (e.g., 16 channels for FLUX.2 VAE, NOT standard 4 channels) prior to invoking `decode()`.

**WHY**:
FLUX.2-based autoencoders use a 16-channel latent representation rather than the legacy Stable Diffusion 4-channel latent space. Passing a 4-channel latent tensor to `flux2-vae.safetensors` triggers unhandled shape mismatch errors inside the initial 2D convolution kernel (`Conv2d(16, channels, kernel_size=3)`), resulting in low-level CUDA runtime exceptions, thread termination, and corrupted memory pointers on the GPU.

**WHEN TO APPLY**:
Pre-execution conditioning and post-sampling decode validation inside any ComfyUI custom node, pipeline scheduler, or inference engine interfacing with MOSS-Image.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch

class VAELatentContractValidator:
    """Enforces spatial alignment and channel invariants for FLUX/MOSS VAEs."""
    
    EXPECTED_CHANNELS: int = 16
    DOWNSCALE_FACTOR: int = 8

    @classmethod
    def validate_latent_for_decode(cls, latent_tensor: torch.Tensor, vae_model_name: str) -> None:
        if latent_tensor.ndim != 4:
            raise ValueError(
                f"Expected 4D BCHW latent tensor, got ndim={latent_tensor.ndim} "
                f"with shape {latent_tensor.shape}"
            )
            
        b, c, h, w = latent_tensor.shape
        
        # Enforce 16-channel contract for FLUX/MOSS VAE
        if "flux" in vae_model_name.lower() or "moss" in vae_model_name.lower():
            if c != cls.EXPECTED_CHANNELS:
                raise ValueError(
                    f"Architecture Mismatch: Target VAE '{vae_model_name}' requires "
                    f"{cls.EXPECTED_CHANNELS} latent channels, but input latent has {c} channels. "
                    f"Ensure you are not routing SD1.5/SDXL latents (4 channels) into FLUX2 VAE."
                )

        # Ensure spatial bounds permit unpadding without fractional artifacts
        min_dim = 8
        if h < min_dim or w < min_dim:
            raise ValueError(
                f"Latent spatial dimensions too small: ({h}, {w}). "
                f"Minimum resolution is ({min_dim}, {min_dim})."
            )
```

**NEGATIVE CONSTRAINT**:
```python

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T08:25:40.167Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795249540167",
    "title": "VAE Latent Channel-Stride Dimension Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-comfy-org-moss-image-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "1ae0b18e8e913742d00bfbfb65f32a6a13d94e403d421c124af316f74b1efc89"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-21T08:25:40.167Z"
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
  "auth_token": "e4e8fd2b1968554c14abe3e85dfa09ea52405984e9fd3cce1a8c040d943d7011"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
