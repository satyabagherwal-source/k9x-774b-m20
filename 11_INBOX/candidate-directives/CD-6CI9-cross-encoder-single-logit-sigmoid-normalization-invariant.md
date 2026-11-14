# Candidate Directive: [CD-6CI9] Cross-Encoder Single-Logit Sigmoid Normalization Invariant

<!-- PROVENANCE_START
{
  "source_repository": "hf-baai-bge-reranker-v2-m3-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T08:54:37.426Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-baai-bge-reranker-v2-m3-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-baai-bge-reranker-v2-m3-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T08:54:37.426Z`  
> **Learning ID**: `LEARN-EVO-hf-baai-bge-reranker-v2-m3-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
Binary sequence classification models used for relevance scoring with `num_labels = 1` MUST be decoded via univariate Logistic Sigmoid $\sigma(x) = \frac{1}{1 + e^{-x}}$ over the raw scalar logit. Rerankers MUST NOT apply Softmax across the label dimension when `num_labels == 1`.

**WHY**:
In `config.json`, the model defines `id2label: {"0": "LABEL_0"}`. The classification head outputs a tensor of shape `(batch_size, 1)`. Applying Softmax across dimension `-1` on a 1D scalar logit mathematically yields a constant tensor of `1.0` ($\frac{e^z}{e^z} = 1.0$), completely destroying all ranking order across documents and degrading reranker precision to 0.

**WHEN TO APPLY**:
All reranker backbones (BGE-Reranker, Cohere-style cross-encoders, MonoBERT, MonoT5 single-logit variants) where sequence classification outputs raw logits representing relevance affinity.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch

def extract_relevance_scores(logits: torch.Tensor) -> torch.Tensor:
    """
    Computes valid [0.0, 1.0] relevance scores from cross-encoder output logits.
    Enforces shape contracts and rejects incorrect softmax usage.
    """
    # Guard against invalid shapes
    if logits.ndim == 1:
        logits = logits.unsqueeze(-1)
    
    batch_size, num_classes = logits.shape
    if num_classes != 1:
        raise ValueError(
            f"Expected num_classes == 1 for scalar reranker, got {num_classes}. "
            f"If using a multi-class model, explicit class indexing is required."
        )

    # Invariant: Single scalar logit -> Sigmoid
    scores = torch.sigmoid(logits.squeeze(-1))
    return scores
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Blindly applying softmax to model_output.logits
def unsafe_extract_scores(logits: torch.Tensor) -> torch.Tensor:
    # CRITICAL BUG: softmax on dimension -1 when dim_size == 1 returns 1.0 for every sample
    probs = torch.softmax(logits, dim=-1) 
    return probs[:, 0]  # Every query-document score becomes 1.0000!
```

**VERIFICATION METHOD**:
```python
def test_reranker_sigmoid_gradient_and_spread():
    raw_logits = torch.tensor([[-5.2], [0.0], [4.8]], dtype=torch.float32)
    scores = extract_relevance_scores(raw_logits)

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T08:54:37.521Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794646477521",
    "title": "Cross-Encoder Single-Logit Sigmoid Normalization Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-baai-bge-reranker-v2-m3-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "036d1c4d45d4d25205051f09fdc093fb57035df721118948cc5dc0a1a833946c"
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
        "Harvested/verified timestamp recorded: 2026-11-14T08:54:37.521Z"
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
  "auth_token": "48be838082fe937074f51dcc17da3bb9058bc379a0c088e9c0c817247df4e535"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
