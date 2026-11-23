# Candidate Directive: [CD-QNR9] Invariant Coordinate Alignment in Multimodal 3D RoPE

<!-- PROVENANCE_START
{
  "source_repository": "hf-black-forest-labs-flux.1-schnell-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-23T05:27:30.393Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-black-forest-labs-flux.1-schnell-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-black-forest-labs-flux.1-schnell-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-23T05:27:30.393Z`  
> **Learning ID**: `LEARN-EVO-hf-black-forest-labs-flux.1-schnell-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing multidimensional Rotary Positional Embeddings (RoPE) across heterogeneous modalities (e.g., text sequences joined with 2D spatial patches), rotary frequencies MUST be computed using double-precision floating-point arithmetic (`float64`) prior to downcasting, and coordinate grids MUST be explicitly bounded by coordinate-specific bounding intervals rather than unified sequential indices.

**WHY**:
In single-precision (`float32`) or half-precision (`float16`/`bfloat16`), high-frequency base exponentiation ($\Theta = 10000^{-2k/D}$) incurs non-negligible rounding drift at sequence lengths $> 4096$ or high spatial coordinates. In unified single-stream transformer blocks where text tokens ($L \in [0, 512]$) and image patches ($H \times W \in [0, 4096]$) share rotary operators, single-precision frequency calculation causes spatial aliasing, phase cancellation, and checkerboard grid artifacts in the generated image.

**WHEN TO APPLY**:
Applies to all multimodal Vision-Language and Diffusion Transformers (MMDiT, FLUX, SD3) where spatial latents and linguistic tokens are processed within the same self-attention context.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch


def compute_multimodal_rope_coords(
    spatial_height: int,
    spatial_width: int,
    text_len: int,
    head_dim: int,
    theta: float = 10000.0,
    device: torch.device = torch.device("cpu"),
) -> torch.Tensor:
    """Computes precision-safe 3D Rotary Position Embeddings for image-text concatenation.

    Allocates distinct coordinate channels: (dim 0: Text index, dim 1: H
    index, dim 2: W index).
    """
    assert (
        head_dim % 6 == 0
    ), "Head dimension must be divisible by 6 (2 dims per 3D coordinate axis)."
    axis_dim = head_dim // 6

    # Invariant: Compute frequency exponents in float64 to eliminate rounding phase drift
    omega = 1.0 / (
        theta
        ** (
            torch.arange(0, axis_dim, dtype=torch.float64, device=device)
            / axis_dim
        )
    )

    # Spatial coordinates for image patches
    grid_h = torch.arange(spatial_height, dtype=torch.float64, device=device)
    grid_w = torch.arange(spatial_width, dtype=torch.float64, device=device)
    grid_t = torch.zeros(
        text_len, dtype=torch.float64, device=device
    )  # Image tokens have zero text coordinate

    # Meshgrid indexing 'ij' guarantees strict matrix-row/column ordering

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T05:27:30.498Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795411650497",
    "title": "Invariant Coordinate Alignment in Multimodal 3D RoPE",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-black-forest-labs-flux.1-schnell-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "7c9de446f4f582b0ab1fba11f9ab24894c9125963f1db9e9a108d8e2f780b0dc"
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
        "Harvested/verified timestamp recorded: 2026-11-23T05:27:30.498Z"
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
  "auth_token": "105f1fc0ddde2012eb0a2b802817b09da0c7b4d902b2629b8814f80953cd9624"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
