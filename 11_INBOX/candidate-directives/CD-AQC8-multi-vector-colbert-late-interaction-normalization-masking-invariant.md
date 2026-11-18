# Candidate Directive: [CD-AQC8] Multi-Vector (ColBERT) Late-Interaction Normalization & Masking Invariant

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
In multi-vector late-interaction retrieval ($S_{Q, D} = \sum_{i} \max_j (q_i \cdot d_j^T)$), vector embeddings for query tokens and document tokens MUST be $L_2$-normalized along the projection dimension ($d'=128$) BEFORE computing the cross-attention dot product matrix. Document padding tokens MUST be masked with $-\infty$ (or $-1 \times 10^4$ in half-precision) before computing row-wise maxima; query padding tokens MUST be zeroed out in the final token summation.

**WHY**:
Omission of normalization allows norm-inflation: outlier tokens with high $L_2$ norms dominate the score, causing punctuation tokens (like `.` or `,`) or common stopwords to skew the sum. Omitting the document mask causes padding representations (which have arbitrary non-zero dot products) to win the $\max$ selection over real content tokens. Omitting the query mask causes empty padding steps to add spurious bias into the total score.

**WHEN TO APPLY**:
Every retrieval head, re-ranker, or vector database plugin evaluating token-level multi-vector late interaction (ColBERT, BGE-M3 multi-vector head).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn.functional as F

def colbert_score(
    q_reps: torch.Tensor,      # Shape: [B, L_q, D]
    d_reps: torch.Tensor,      # Shape: [B, L_d, D]
    q_mask: torch.Tensor,      # Shape: [B, L_q], 1 for valid, 0 for pad
    d_mask: torch.Tensor       # Shape: [B, L_d], 1 for valid, 0 for pad
) -> torch.Tensor:
    """
    Computes numerically stable multi-vector Late Interaction (MaxSim).
    """
    # Invariant 1: Unit L2 normalization across the representation dimension
    q_reps = F.normalize(q_reps, p=2, dim=-1)
    d_reps = F.normalize(d_reps, p=2, dim=-1)

    # Invariant 2: Pairwise cosine similarity matrix -> [B, L_q, L_d]
    similarity_matrix = torch.bmm(q_reps, d_reps.transpose(1, 2))

    # Invariant 3: Mask document padding tokens so they cannot win the max operation
    d_mask_expanded = d_mask.unsqueeze(1).bool()  # [B, 1, L_d]
    fill_value = -1e4 if similarity_matrix.dtype in (torch.float16, torch.bfloat16) else -1e9
    similarity_matrix = similarity_matrix.masked_fill(~d_mask_expanded, fill_value)

    # Invariant 4: Token-wise maximum across document tokens -> [B, L_q]
    max_sim, _ = similarity_matrix.max(dim=-1)

    # Invariant 5: Zero out masked query tokens before aggregating sum
    max_sim = max_sim * q_mask.float()

    # Sum along query sequence length
    scores = max_sim.sum(dim=-1)
    return scores
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Computing raw unnormalized dot product without document masking

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T08:08:43.735Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794989323735",
    "title": "Multi-Vector (ColBERT) Late-Interaction Normalization & Masking Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-baai-bge-m3-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "7e7614ddebc28a52bcc78da41e735614d5856cf6bc6f7dbc25ce8d42d1485141"
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
        "Harvested/verified timestamp recorded: 2026-11-18T08:08:43.735Z"
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
  "auth_token": "125e940aa70915ba3da9f374239ee5e77be26540ae0effc4e70b1459defe9ef4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
