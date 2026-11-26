# Candidate Directive: [CD-053S] Zero-Padding Masked Reduction Invariant

<!-- PROVENANCE_START
{
  "source_repository": "hf-sentence-transformers-all-minilm-l6-v2-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T09:37:50.166Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-sentence-transformers-all-minilm-l6-v2-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-sentence-transformers-all-minilm-l6-v2-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T09:37:50.166Z`  
> **Learning ID**: `LEARN-EVO-hf-sentence-transformers-all-minilm-l6-v2-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When aggregating variable-length sequential representations across a sequence dimension using reduction operations (Mean, Sum, Softmax), engineers MUST explicitly broadcast and multiply by the sequence attention mask, and MUST clamp the reduction denominator to a strictly positive non-zero epsilon ($\epsilon \ge 10^{-9}$). Unmasked reductions or naive `tensor.mean(dim=1)` reductions MUST NOT be used.

**WHY**:
Applying unmasked `tensor.mean(dim=1)` averages padding tokens ($0$ or embedding noise) into the pooled vector. This corrupts the dense representation by introducing length-dependent bias: identical sentences with different padding lengths yield completely different vector representations, destroying cosine similarity. Clamping the divisor to $\epsilon$ prevents division-by-zero runtime exceptions or `NaN` outputs when an empty sequence (all padding) passes through the pipeline.

**WHEN TO APPLY**:
Any neural pipeline, attention mechanism, or pooling block in PyTorch, JAX, or TensorFlow where batched variable-length sequences are padded to a common tensor dimension.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn.functional as F

def masked_mean_pooling(token_embeddings: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
    """
    Computes masked mean pooling over sequence dimension.
    token_embeddings: [batch_size, seq_len, hidden_dim]
    attention_mask:   [batch_size, seq_len] (binary integer/boolean)
    """
    # 1. Cast mask to float and expand to match embedding dimensions: [B, S, H]
    input_mask_expanded = attention_mask.unsqueeze(-1).expand_as(token_embeddings).float()
    
    # 2. Zero-out all pad tokens
    sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, dim=1)
    
    # 3. Sum mask counts per sequence and clamp to prevent div-by-zero [B, H]
    sum_mask = torch.clamp(input_mask_expanded.sum(dim=1), min=1e-9)
    
    # 4. Safe broadcasted division
    return sum_embeddings / sum_mask
```

**NEGATIVE CONSTRAINT**:
```python
# CRITICAL DEFECT: Includes padding tokens in mean calculation.
# Yields corrupt vectors and sequence-length dependent drift.
def broken_mean_pooling(token_embeddings: torch.Tensor) -> torch.Tensor:
    return torch.mean(token_embeddings, dim=1)

# CRITICAL DEFECT: Vulnerable to NaN on completely padded inputs
def zero_div_mean_pooling(token_embeddings: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
    mask = attention_mask.unsqueeze(-1).float()
    return torch.sum(token_embeddings * mask, dim=1) / mask.sum(dim=1) # Crash/NaN if sum == 0
```

**VERIFICATION METHOD**:
```python
def test_masked_mean_pooling_padding_invariance():

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T09:37:50.292Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795685870292",
    "title": "Zero-Padding Masked Reduction Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-sentence-transformers-all-minilm-l6-v2-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "c4ccc3e2f0ceec2e44502cf0fc8e7cfeb807b3e229fed3cff12d950a0fafe200"
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
        "Harvested/verified timestamp recorded: 2026-11-26T09:37:50.293Z"
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
  "auth_token": "fd9b6faa0bb8069019ad9d7eb66d048bace1a4c2b5c9f47f0cdef2640a2c3496"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
