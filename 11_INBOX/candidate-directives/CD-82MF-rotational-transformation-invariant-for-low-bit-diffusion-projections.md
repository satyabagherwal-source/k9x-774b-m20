# Candidate Directive: [CD-82MF] Rotational Transformation Invariant for Low-Bit Diffusion Projections

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
When quantizing cross-attention projection layers of diffusion backbones to 8-bit or lower precisions (`INT8`/`INT4`), the quantization pipeline MUST apply an orthogonal rotational transformation (e.g., Hadamard or randomized orthogonal matrix $R$) such that $Y = (X R)(R^T W)$ to eliminate channel-specific outlier magnitudes before uniform quantization.

**WHY**:
Diffusion transformer layers generate high-magnitude activation spikes on specific latent coordinate channels. Uniform quantization of these activations without rotation forces an excessively wide quantization scale factor $\Delta = \frac{x_{\max} - x_{\min}}{2^b - 1}$, driving smaller informational channels to numerical zero, resulting in catastrophic latent collapse, blank image generation, or severe color banding.

**WHEN TO APPLY**:
Applies to post-training quantization (PTQ) and weight/activation packaging pipelines for Diffusion Transformers (DiT), FLUX variants, MOSS-Image, and high-capacity attention networks.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch

class ConvRotQuantizer:
    """Applies orthogonal rotation to activations and weights to eliminate outliers."""
    
    @staticmethod
    def generate_hadamard_matrix(dim: int, device: torch.device) -> torch.Tensor:
        """Constructs a normalized Walsh-Hadamard Matrix for dimension 2^k."""
        if (dim & (dim - 1)) != 0:
            raise ValueError(f"Hadamard dimension must be a power of 2, got {dim}")
            
        H = torch.tensor([[1.0]], device=device)
        while H.shape[0] < dim:
            H = torch.cat([
                torch.cat([H, H], dim=1),
                torch.cat([H, -H], dim=1)
            ], dim=0) / torch.sqrt(torch.tensor(2.0, device=device))
        return H

    @classmethod
    def quantize_linear_convrot(
        cls, 
        weight: torch.Tensor, 
        hadamard_dim: int = None
    ) -> Dict[str, torch.Tensor]:
        """
        Rotates weight matrix W: W_rot = R^T @ W
        Returns quantized INT8 weight and rotation operator.
        """
        out_features, in_features = weight.shape
        if hadamard_dim is None:
            hadamard_dim = in_features

        R = cls.generate_hadamard_matrix(hadamard_dim, weight.device).to(weight.dtype)
        
        # Transform weight: (Out, In) x (In, In) -> Out, In
        rotated_weight = torch.matmul(weight, R)

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
    "title": "Rotational Transformation Invariant for Low-Bit Diffusion Projections",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-comfy-org-moss-image-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "0f26ea3618ed71016c12e0966efda60ced4e8a77b3174f57dbe3cee0dedb76b6"
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
  "auth_token": "3a59271159b11073d74f4a0ef14bf0e3b4faa51507c6f870ea85fbf960d04b23"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
