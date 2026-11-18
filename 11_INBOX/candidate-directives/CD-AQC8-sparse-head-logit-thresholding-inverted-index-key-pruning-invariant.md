# Candidate Directive: [CD-AQC8] Sparse Head Logit Thresholding & Inverted Index Key Pruning Invariant

<!-- PROVENANCE_START
{
  "source_repository": "hf-baai-bge-m3-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T08:08:43.619Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-baai-bge-m3-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-baai-bge-m3-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T08:08:43.619Z`  
> **Learning ID**: `LEARN-EVO-hf-baai-bge-m3-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When generating sparse representations (token lexical weights) from a transformer output:
1. The projection layer logit output MUST pass through a strict zero-lower-bound non-linearity ($\text{ReLU}(W_{\text{sparse}} \cdot h)$) or log-saturation function ($\log(1 + \text{ReLU}(z))$).
2. All weights below a defined noise floor threshold $\tau \le 0.0$ MUST be pruned prior to serialization or inverted-index ingestion.
3. Multiple occurrences of the same token ID $t \in V$ across sequence positions $1 \dots L$ MUST be aggregated using an explicit reduction operator ($\max$ pooling: $w_t = \max_{i, \text{token}_i = t} w_i$).

**WHY**:
Raw logits contain negative outputs and floating-point noise on background tokens. If negative or near-zero weights are stored in an inverted index (e.g., Lucene, Vespa, Milvus), index size balloons by $10\times$ to $50\times$, posting list traversal hits cache lines for meaningless tokens, and BM25/dot-product scoring semantics break down due to negative weight subtractions.

**WHEN TO APPLY**:
Any model producing learned sparse vectors (BGE-M3, SPLADE, LexMAE, uniCOIL) feeding vector search engines or inverted indices.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import Dict
import torch
import torch.nn as nn

class SparseHead(nn.Module):
    def __init__(self, hidden_size: int):
        super().__init__()
        self.linear = nn.Linear(hidden_size, 1)

    def forward(
        self,
        hidden_states: torch.Tensor,     # [B, L, H]
        input_ids: torch.Tensor,        # [B, L]
        attention_mask: torch.Tensor,   # [B, L]
        threshold: float = 1e-4
    ) -> list[dict[int, float]]:
        # Compute scalar weight per token
        logits = self.linear(hidden_states).squeeze(-1)  # [B, L]
        weights = torch.relu(logits) * attention_mask.float()  # [B, L]

        batch_sparse_dicts: list[dict[int, float]] = []
        for b in range(input_ids.size(0)):
            seq_ids = input_ids[b].tolist()
            seq_weights = weights[b].tolist()
            token_dict: dict[int, float] = {}

            for tid, w in zip(seq_ids, seq_weights):
                if w > threshold:
                    # Invariant: Max pooling across identical subword tokens in the same document
                    if tid not in token_dict or w > token_dict[tid]:
                        token_dict[tid] = float(w)
            
            batch_sparse_dicts.append(token_dict)
            
        return batch_sparse_dicts

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T08:08:43.736Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794989323736",
    "title": "Sparse Head Logit Thresholding & Inverted Index Key Pruning Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-baai-bge-m3-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "f0f4e61c37929cbd4340f59699e93116e9da6fe0c07698e6aecee353f7ff14f7"
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
        "Harvested/verified timestamp recorded: 2026-11-18T08:08:43.736Z"
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
  "auth_token": "881e60de02a1a63c803f56b6386ac6e13a27937e22c1b11adbfdffe8d055d310"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
