# Candidate Directive: [CD-7ECZ] Spatial Patch Coordinate Projection Invariant

<!-- PROVENANCE_START
{
  "source_repository": "hf-openai-clip-vit-large-patch14-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T08:25:08.608Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-openai-clip-vit-large-patch14-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-openai-clip-vit-large-patch14-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T08:25:08.608Z`  
> **Learning ID**: `LEARN-EVO-hf-openai-clip-vit-large-patch14-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When decomposing multidimensional continuous imagery into discrete sequence vectors using 2D strided convolutions, the input spatial height ($H$) and width ($W$) MUST be integer multiples of the patch kernel stride ($P$), and positional embedding tensors MUST be dynamically interpolated via 2D bicubic alignment if spatial input bounds diverge from the pre-trained grid size ($H \ne H_0$ or $W \ne W_0$).

**WHY**:
Vision Transformers with patch size $P=14$ divide spatial dimensions into grids $\frac{H}{P} \times \frac{W}{P}$. If $H \pmod{14} \ne 0$, standard convolution rounds dimensions down or fails tensor assertions, creating trailing spatial artifact truncation. Furthermore, ViT architectures bind a static learned 1D positional tensor $\mathbb{R}^{1 \times (N+1) \times D}$ where $N = (H_0/P) \times (W_0/P)$. Ingesting arbitrary resolutions without bicubic spatial positional re-interpolation triggers tensor shape mismatch crashes at runtime: `RuntimeError: The size of tensor a (257) must match the size of tensor b (N)`.

**WHEN TO APPLY**:
Vision Transformers (ViT, CLIP-Vision, Swin, DINO) receiving dynamic image resolutions or arbitrary crops in inference/pipeline services.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import math
import torch
import torch.nn.functional as F

def interpolate_positional_embeddings(
    pos_embed: torch.Tensor, 
    target_patch_h: int, 
    target_patch_w: int, 
    num_extra_tokens: int = 1
) -> torch.Tensor:
    """
    pos_embed: [1, N_orig + num_extra_tokens, D]
    target_patch_h: Target grid height (H_img // patch_size)
    target_patch_w: Target grid width (W_img // patch_size)
    """
    num_patches = pos_embed.shape[1] - num_extra_tokens
    dim = pos_embed.shape[-1]
    
    if num_patches == target_patch_h * target_patch_w:
        return pos_embed # Resolution matches pre-trained configuration

    extra_tokens = pos_embed[:, :num_extra_tokens, :]
    spatial_pos = pos_embed[:, num_extra_tokens:, :] # [1, N_orig, D]

    orig_h = orig_w = int(math.sqrt(num_patches))
    assert orig_h * orig_w == num_patches, \
        f"Original positional embedding patch count ({num_patches}) is not a square grid"

    # Reshape to [1, D, H_orig, W_orig] for 2D spatial interpolation
    spatial_pos = spatial_pos.reshape(1, orig_h, orig_w, dim).permute(0, 3, 1, 2)
    
    # Micro-mechanical guarantee: Bicubic interpolation with explicit antialiasing
    interpolated_pos = F.interpolate(
        spatial_pos,
        size=(target_patch_h, target_patch_w),
        mode='bicubic',
        align_corners=False
    )

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T08:25:08.723Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795249508723",
    "title": "Spatial Patch Coordinate Projection Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-openai-clip-vit-large-patch14-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "a91cd20b319c21931dfb0fe03ade713258e16512f19c172868e611cfd26aa77a"
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
        "Harvested/verified timestamp recorded: 2026-11-21T08:25:08.723Z"
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
  "auth_token": "2e083bf42fdb89be92992dba6a96a0cf8a7f325691452785038d0b9cdf03f228"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
