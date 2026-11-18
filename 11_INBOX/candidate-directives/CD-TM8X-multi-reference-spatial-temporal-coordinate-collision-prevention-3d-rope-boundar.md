# Candidate Directive: [CD-TM8X] Multi-Reference Spatial-Temporal Coordinate Collision Prevention (3D-RoPE Boundary Invariant)

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
When unrolling multiple independent 2D reference images and 2D target latents into a 1D sequence for 3D Rotary Position Embeddings (3D-RoPE), each reference frame **MUST** occupy a strictly disjoint temporal coordinate index $T_i$, and target latents **MUST NOT** share spatial $(H, W)$ coordinates with reference tokens unless the temporal/channel coordinate explicitly decouples them.

**WHY**:
3D-RoPE computes relative positional frequencies based on $(T, H, W)$. If multiple reference images are assigned the same frame index $T=0$ without unique frame identifiers, the transformer's attention kernel cannot distinguish relative distance within Reference 1 from relative distance within Reference 2. This creates spatial superposition artifacts, "ghosting", or bleeding of Reference 1's features directly into Reference 2.

**WHEN TO APPLY**:
Multi-image conditioning pipelines, multi-turn visual editing, and video/spatial transformer backbones using rotary positional encodings.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch

def compute_multimodal_3d_rope_grid(
    text_len: int,
    ref_image_shapes: list[Tuple[int, int]], # [(H1, W1), (H2, W2), ...]
    target_latent_shape: Tuple[int, int]     # (H_tgt, W_tgt)
) -> torch.Tensor:
    """
    Constructs an explicit 3D coordinate tensor [T, H, W] for text, multi-ref, and target.
    Guarantees zero overlap across independent visual references.
    """
    coords = []
    
    # 1. Text Tokens: Bound to Temporal T=0, Spatial H=0, W=index
    for i in range(text_len):
        coords.append((0, 0, i))
        
    # 2. Reference Images: Each assigned a unique temporal frame T >= 1
    for ref_idx, (h_ref, w_ref) in enumerate(ref_image_shapes, start=1):
        for h in range(h_ref):
            for w in range(w_ref):
                coords.append((ref_idx, h, w))
                
    # 3. Target Latent: Bound to Temporal T = len(ref_images) + 1
    target_frame_idx = len(ref_image_shapes) + 1
    h_tgt, w_tgt = target_latent_shape
    for h in range(h_tgt):
        for w in range(w_tgt):
            coords.append((target_frame_idx, h, w))
            
    coord_tensor = torch.tensor(coords, dtype=torch.long)
    return coord_tensor # Shape: (L_total, 3) where each token has unique [T, H, W]
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Assigning all references and target to flat 2D grids at T=0
# Causes RoPE to calculate identical positional similarities between unrelated images

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
    "title": "Multi-Reference Spatial-Temporal Coordinate Collision Prevention (3D-RoPE Boundary Invariant)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-qwen-qwen-image-2.1-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "fc904690bee75c548ffd710fb95d943cbc75e19fd65e53428f6dc0d1a40cb5ce"
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
  "auth_token": "5ace886f9dbfbbc286f423002e7e03bdab9db4b7ae56c1229a25d0a091f2fd66"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
