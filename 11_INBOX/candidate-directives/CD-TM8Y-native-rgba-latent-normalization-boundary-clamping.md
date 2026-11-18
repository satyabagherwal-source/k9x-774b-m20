# Candidate Directive: [CD-TM8Y] Native RGBA Latent Normalization & Boundary Clamping

<!-- PROVENANCE_START
{
  "source_repository": "hf-qwen-qwen-image-2.1-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T00:27:31.318Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-qwen-qwen-image-2.1-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-qwen-qwen-image-2.1-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T00:27:31.318Z`  
> **Learning ID**: `LEARN-EVO-hf-qwen-qwen-image-2.1-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When processing RGBA transparent images through continuous latent diffusion models, the alpha channel latent representation **MUST** be decoded with an explicit non-saturating normalization boundary, and the Alpha channel in pixel space **MUST** be clamped to $[0.0, 1.0]$ prior to premultiplication. Systems **MUST NOT** perform RGB color loss or diffusion guidance across zero-alpha pixels without background compositing regularizers.

**WHY**:
In transparent images, fully transparent pixels ($A=0$) often contain random, unconstrained RGB garbage values (color bleed / zero-alpha noise). If the model attempts to learn or denoise RGB pixels where $A=0$, gradients oscillate wildly, destabilizing the DiT flow matching vector fields and producing noisy halos around transparent borders.

**WHEN TO APPLY**:
All RGBA / transparent diffusion models, matting pipelines, and multi-layer compositional generative models.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch

def sanitize_rgba_latent_and_pixels(
    decoded_pixel_tensor: torch.Tensor,
    alpha_threshold: float = 1e-4
) -> torch.Tensor:
    """
    Enforces pixel-space transparency boundaries and prevents color bleed in empty regions.
    Args:
        decoded_pixel_tensor: (B, 4, H, W) where channels are R, G, B, A in range [-1, 1] or [0, 1]
    """
    # Assuming decoded values normalized to [0, 1]
    rgb = decoded_pixel_tensor[:, :3, :, :]
    alpha = decoded_pixel_tensor[:, 3:4, :, :]
    
    # Invariant 1: Clamp alpha strictly between 0 and 1
    alpha_clamped = torch.clamp(alpha, min=0.0, max=1.0)
    
    # Invariant 2: Mask out RGB hallucination where alpha is functionally zero
    # Prevents latent noise from polluting the transparent regions
    is_transparent = (alpha_clamped < alpha_threshold)
    rgb_sanitized = torch.where(is_transparent.expand_as(rgb), torch.zeros_like(rgb), rgb)
    
    return torch.cat([rgb_sanitized, alpha_clamped], dim=1)
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Directly returning raw un-clamped VAE output as RGBA image
def decode_raw(latents, vae):
    pixels = vae.decode(latents) # Returns (B, 4, H, W)
    # BUG: pixels[:, 3] can contain negative numbers or values > 1.0
    # BUG: pixels[:, :3] has noisy gradients in regions where alpha is near 0!
    return pixels 
```

**VERIFICATION METHOD**:
```python

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T00:27:31.425Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794961651425",
    "title": "Native RGBA Latent Normalization & Boundary Clamping",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-qwen-qwen-image-2.1-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "7a6eeb4f5b75a939a166a731dc6033c212e706029b5e25ed7e8e5cfb955d2261"
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
        "Harvested/verified timestamp recorded: 2026-11-18T00:27:31.425Z"
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
  "auth_token": "611cc00bef053464e2eb66f48aa564ea8b8375d617ffdce954fea21cb102aa47"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
