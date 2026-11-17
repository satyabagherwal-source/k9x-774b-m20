# Candidate Directive: [CD-FSCV] Micro-Conditioning Coordinate Invariant Vector Injection

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
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
Whenever training or running inference on scale-invariant diffusion models that decouple generation aspect ratios from training resolution buckets, pipelines MUST build micro-conditioning vectors using non-negative integer coordinates:
$$\mathbf{c}_{micro} = [h_{orig}, w_{orig}, c_{top}, c_{left}, h_{tgt}, w_{tgt}]$$
The pipeline MUST explicitly project these coordinates via independent Fourier/Sinusoidal positional embeddings into continuous embedding space, and MUST NOT directly pass raw numerical coordinates or un-clamped bounding box ratios to linear layers.

**WHY**:
Passing un-embedded or non-normalized discrete coordinates to a deep neural network results in gradient saturation and scale distortion. Without sinusoidal frequency expansion, linear layers fail to learn high-frequency spatial boundaries, causing artifacting, unnatural stretching of faces/limbs, and edge clipping in generated imagery when generating non-$1024 \times 1024$ resolutions.

**WHEN TO APPLY**:
Generative models operating with multi-aspect ratio bucketing and crop-conditioning (SDXL, SDXL-Turbo, Cascade).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import math
import torch
import torch.nn as nn

class MicroConditioningEmbedding(nn.Module):
    """Encodes (orig_h, orig_w, crop_top, crop_left, target_h, target_w) via Sinusoidal embeddings."""
    def __init__(self, embed_dim: int = 256):
        super().__init__()
        self.embed_dim = embed_dim
        assert embed_dim % 2 == 0, "Embedding dimension must be even."

    def _sinusoidal_embedding(self, coords: torch.Tensor) -> torch.Tensor:
        # coords shape: [B, 6]
        batch_size, num_coords = coords.shape
        half_dim = self.embed_dim // 2
        exponent = -math.log(10000) * torch.arange(
            start=0, end=half_dim, dtype=torch.float32, device=coords.device
        ) / half_dim
        freqs = torch.exp(exponent) # [half_dim]
        
        # Outer product: [B, 6, 1] * [1, 1, half_dim] -> [B, 6, half_dim]
        args = coords.unsqueeze(-1).float() * freqs.view(1, 1, -1)
        sin_emb = torch.sin(args)
        cos_emb = torch.cos(args)
        emb = torch.cat([sin_emb, cos_emb], dim=-1) # [B, 6, embed_dim]
        return emb.view(batch_size, num_coords * self.embed_dim)

    def forward(self, original_size: tuple, crops_coords_top_left: tuple, target_size: tuple, batch_size: int, device: torch.device) -> torch.Tensor:
        coords = torch.tensor([
            original_size[0], original_size[1],
            crops_coords_top_left[0], crops_coords_top_left[1],
            target_size[0], target_size[1]
        ], device=device).repeat(batch_size, 1) # [B, 6]
        
        return self._sinusoidal_embedding(coords) # [B, 6 * embed_dim]
```

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T23:20:46.926Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794957646926",
    "title": "Micro-Conditioning Coordinate Invariant Vector Injection",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-stabilityai-stable-diffusion-xl-base-1.0-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "906933fd7a89b6504ec3585f788393169ea77186ccbd0509e0c1bc0684190e37"
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
        "Harvested/verified timestamp recorded: 2026-11-17T23:20:46.926Z"
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
  "auth_token": "8bf5a07c95ee4af2ea501c23adec4acf967ebe109c64fa2e2c4794ed9480a32c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
