# Candidate Directive: [CD-5L9V] Orthogonal Feature Projection Invariant in Safety Abliteration

<!-- PROVENANCE_START
{
  "source_repository": "hf-davidau-qwen3.5-9b-the-defiant-fable-uncensored-heretic-neo-imatrix-max-mtp-gguf-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T08:54:02.123Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-davidau-qwen3.5-9b-the-defiant-fable-uncensored-heretic-neo-imatrix-max-mtp-gguf-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-davidau-qwen3.5-9b-the-defiant-fable-uncensored-heretic-neo-imatrix-max-mtp-gguf-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T08:54:02.123Z`  
> **Learning ID**: `LEARN-EVO-hf-davidau-qwen3.5-9b-the-defiant-fable-uncensored-heretic-neo-imatrix-max-mtp-gguf-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain B

## Original Learning Payload (100% Preserved)
**RULE**:
When abliterating refusal directions from intermediate transformer residual layers, the operator MUST project out only the specific refusal subspace $\mathbf{v}_{\text{refusal}}$ while preserving the orthogonal complement of the activation space. The modification to weight tensor $\mathbf{W}$ MUST strictly follow $\mathbf{W}' = \mathbf{W} - (\mathbf{W}\mathbf{\hat{v}})\mathbf{\hat{v}}^T$ where $\|\mathbf{\hat{v}}\|_2 = 1$, and MUST NOT be performed by ad-hoc weight zeroing, rank truncation, or uniform weight scaling.

**WHY**:
Ad-hoc weight zeroing or unnormalized rank degradation destroys non-target functional representations, such as programming language syntax trees, complex mathematical reasoning, and instruction-following schemas that share partial semantic overlap with alignment boundaries. Projecting strictly along the unit normal vector $\mathbf{\hat{v}}$ guarantees that any activation orthogonal to the refusal direction ($\mathbf{a}^T \mathbf{\hat{v}} = 0$) remains bit-for-bit mathematically identical to the base model.

**WHEN TO APPLY**:
Fine-tuning, model merging, and post-training interventions designed to produce uncensored/heretic checkpoints or remove alignment bias without degrading benchmarks.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch

def orthogonal_ablation_projection(
    weight_tensor: torch.Tensor, 
    refusal_direction: torch.Tensor,
    eps: float = 1e-12
) -> torch.Tensor:
    """
    Applies exact orthogonal projection to remove refusal subspace.
    Weight shape: [out_features, in_features]
    refusal_direction shape: [in_features] or [out_features]
    """
    assert refusal_direction.dim() == 1, "Direction must be a 1D unit vector"
    v_norm = refusal_direction / (torch.norm(refusal_direction, p=2) + eps)
    
    # Ensure computation occurs in float32 or bfloat16 without precision loss
    orig_dtype = weight_tensor.dtype
    w_fp32 = weight_tensor.to(torch.float32)
    v_fp32 = v_norm.to(torch.float32)
    
    # Project: W' = W - (W . v) (x) v^T
    # Compute projection of rows along direction
    projection = torch.matmul(w_fp32, v_fp32).unsqueeze(1) * v_fp32.unsqueeze(0)
    w_purified = w_fp32 - projection
    
    # Verify orthogonality invariant: W' . v must be approximately zero
    max_leakage = torch.max(torch.abs(torch.matmul(w_purified, v_fp32))).item()
    assert max_leakage < 1e-4, f"Orthogonal projection failed: leakage {max_leakage}"
    
    return w_purified.to(orig_dtype)
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Uniform attenuation or naive masking of refusal layers
def naive_refusal_mask(weight_tensor: torch.Tensor, threshold: float):
    # Truncates or zeros weights directly, destroying reasoning representations
    weight_tensor[weight_tensor.abs() < threshold] = 0.0

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T08:54:02.226Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794646442226",
    "title": "Orthogonal Feature Projection Invariant in Safety Abliteration",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-davidau-qwen3.5-9b-the-defiant-fable-uncensored-heretic-neo-imatrix-max-mtp-gguf-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "a24b3e357e574943bed2c736f93fedcc682d1d93965f5851cccced4aa63b2a5b"
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
        "Harvested/verified timestamp recorded: 2026-11-14T08:54:02.226Z"
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
  "auth_token": "a02fe02a46c7ae618ad141e2cdfe4d2addb83d0f2003dfbe3fc0b9c51be6e2c1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
