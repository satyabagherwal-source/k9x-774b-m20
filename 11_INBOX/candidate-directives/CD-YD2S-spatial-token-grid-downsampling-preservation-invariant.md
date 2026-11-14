# Candidate Directive: [CD-YD2S] Spatial Token Grid Downsampling Preservation Invariant

<!-- PROVENANCE_START
{
  "source_repository": "hf-openbmb-minicpm-ocr-1.0-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T06:28:26.836Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-openbmb-minicpm-ocr-1.0-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-openbmb-minicpm-ocr-1.0-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T06:28:26.836Z`  
> **Learning ID**: `LEARN-EVO-hf-openbmb-minicpm-ocr-1.0-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When spatial downsampling is performed on 2D vision patches prior to sequence injection (e.g., `downsample_mode: "4x"`), the downsampler MUST preserve 2D topological adjacency invariants. Downsampling MUST group spatial neighbors across height and width grids prior to linear channel projection, rather than collapsing or slicing along an arbitrary flattened 1D token sequence dimension.

**WHY**:
Vision transformers process images as a flattened 1D array of 2D patches: $L = (H/P) \times (W/P)$. A naive $4\times$ downsampling implemented via 1D pooling (`stride=4` along sequence dim) concatenates tokens from completely unrelated spatial regions across subsequent rows of the document image. This destroys OCR line continuity, table row boundaries, and bounding box spatial alignment.

**WHEN TO APPLY**:
Multimodal projection layers converting high-resolution visual tokens ($H \times W \ge 980 \times 980$) into compressed embedding sequences for LLM insertion.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn

class Spatial2DDownsampler4x(nn.Module):
    """
    Preserves 2D spatial locality when reducing patch resolution by 4x (2x downsample on H and W).
    """
    def __init__(self, in_features: int, out_features: int):
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features
        # Downsample 2x2 spatial window -> 4 * in_features
        self.proj = nn.Linear(in_features * 4, out_features, bias=False)
        self.norm = nn.LayerNorm(out_features, eps=1e-6)

    def forward(self, x: torch.Tensor, grid_h: int, grid_w: int) -> Tuple[torch.Tensor, int, int]:
        """
        x: [Batch, SeqLen, InFeatures] where SeqLen == grid_h * grid_w
        grid_h, grid_w: patch dimensions before downsampling (must be even)
        """
        B, L, C = x.shape
        if L != grid_h * grid_w:
            raise ValueError(f"Sequence length {L} does not match grid dimensions {grid_h}x{grid_w}")
        if grid_h % 2 != 0 or grid_w % 2 != 0:
            raise ValueError(f"Grid dimensions ({grid_h}, {grid_w}) must be divisible by 2 for 4x downsampling")

        # 1. Reshape to explicit 2D spatial grid: [B, H, W, C]
        x_2d = x.view(B, grid_h, grid_w, C)

        # 2. Deconstruct into 2x2 spatial blocks
        # [B, H/2, 2, W/2, 2, C] -> permute -> [B, H/2, W/2, 2, 2, C]
        x_blocks = x_2d.view(B, grid_h // 2, 2, grid_w // 2, 2, C)
        x_permuted = x_blocks.permute(0, 1, 3, 2, 4, 5).contiguous()
        
        # 3. Flatten 2x2 spatial neighbors into channel dimension
        # [B, H/2, W/2, 4 * C]
        downsampled_2d = x_permuted.view(B, grid_h // 2, grid_w // 2, 4 * C)

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T06:28:26.931Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794637706931",
    "title": "Spatial Token Grid Downsampling Preservation Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-openbmb-minicpm-ocr-1.0-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "a2ac09d1a51cad7f0a4bbbc26ce72955e01705477e7f2f0d30ba0cda1123d0ee"
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
        "Harvested/verified timestamp recorded: 2026-11-14T06:28:26.931Z"
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
  "auth_token": "8a312ef22484bd4e1883641b423cbc5eb51145a32ea2568928a1eaa14c559ad8"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
