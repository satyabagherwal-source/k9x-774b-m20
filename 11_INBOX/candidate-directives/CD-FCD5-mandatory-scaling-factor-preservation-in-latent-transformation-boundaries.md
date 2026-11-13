# Candidate Directive: [CD-FCD5] Mandatory Scaling Factor Preservation in Latent Transformation Boundaries

<!-- PROVENANCE_START
{
  "source_repository": "hf-compvis-stable-diffusion-v1-4-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T22:45:45.619Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-compvis-stable-diffusion-v1-4-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-compvis-stable-diffusion-v1-4-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T22:45:45.619Z`  
> **Learning ID**: `LEARN-EVO-hf-compvis-stable-diffusion-v1-4-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When interfacing with an autoencoded latent variable representation in diffusion processes, developers **MUST NOT** feed the raw mean/sample of the autoencoder directly into the score/denoising network, and **MUST** explicitly apply the architecture's empirical variance-normalization factor both post-encoding and pre-decoding:
$$z = \text{scaling\_factor} \times \mathcal{E}(x) \quad \text{and} \quad \hat{x} = \mathcal{D}\left(\frac{1}{\text{scaling\_factor}} \times z\right)$$

**WHY**:
The latent space of AutoencoderKL was trained with a KL divergence loss penalty that does not enforce unit variance ($\mathbb{V}[z] \neq 1$). The downstream UNet assumes isotropic standard Gaussian noise $\mathcal{N}(0, \mathbf{I})$ at initial timestep $t=T$. For Stable Diffusion v1-4, omitting the scaling factor $0.18215$ drops the signal variance by a factor of $\approx 30$ ($0.18215^2 \approx 0.033$). This causes catastrophic signal attenuation, preventing cross-attention convergence and yielding high-contrast static or uniform gray outputs.

**WHEN TO APPLY**:
Apply at every boundary where pixel arrays transition to latents via an encoder, or latents transition to pixel arrays via a decoder, across any Latent Diffusion Architecture (Stable Diffusion, Stable Diffusion XL, Flux, Continuous Flow Matchers).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn

class StableDiffusionLatentBridge(nn.Module):
    # Stable Diffusion v1-4 empirical VAE latent standard deviation scaling factor
    VAE_SCALE_FACTOR: float = 0.18215

    def __init__(self, vae: nn.Module):
        super().__init__()
        self.vae = vae

    def encode_pixels_to_latents(
        self, pixel_tensor: torch.Tensor, generator: torch.Generator | None = None
    ) -> torch.Tensor:
        """
        Encodes RGB pixel tensor [-1, 1] to UNet normalized latent space.
        Invariant: output variance must match standard normal distribution prior.
        """
        if pixel_tensor.ndim != 4 or pixel_tensor.shape[1] != 3:
            raise ValueError(f"Expected [B, 3, H, W] tensor, got {pixel_tensor.shape}")

        posterior = self.vae.encode(pixel_tensor).latent_dist
        # Sample or mode extraction
        latents = posterior.sample(generator=generator) if generator is not None else posterior.mode()
        
        # INVARIANT ENFORCEMENT: Scale down to match unit variance
        scaled_latents = latents * self.VAE_SCALE_FACTOR
        return scaled_latents

    def decode_latents_to_pixels(self, latents: torch.Tensor) -> torch.Tensor:
        """
        Decodes UNet normalized latent space back to pixel space [-1, 1].
        Invariant: input latents must be descaled prior to passing into VAE decoder.
        """
        if latents.ndim != 4 or latents.shape[1] != 4:
            raise ValueError(f"Expected [B, 4, H_lat, W_lat] tensor, got {latents.shape}")

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-13T22:45:45.686Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794609945685",
    "title": "Mandatory Scaling Factor Preservation in Latent Transformation Boundaries",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-compvis-stable-diffusion-v1-4-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "a9ecd6c234c20420ad9a67830f908a875bd9b5638e52e908034098dc51949a46"
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
        "Expresses generalized engineering invariants (4 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-13T22:45:45.686Z"
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
  "auth_token": "6d88602d7b203757794ccb87ab3907aee20fb6a9c0434296d49c5ce9f3cdbe07"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
