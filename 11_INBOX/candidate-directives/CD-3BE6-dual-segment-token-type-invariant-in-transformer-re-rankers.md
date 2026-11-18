# Candidate Directive: [CD-3BE6] Dual-Segment Token Type Invariant in Transformer Re-Rankers

<!-- PROVENANCE_START
{
  "source_repository": "hf-cross-encoder-ms-marco-minilm-l6-v2-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T10:22:55.751Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-cross-encoder-ms-marco-minilm-l6-v2-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-cross-encoder-ms-marco-minilm-l6-v2-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T10:22:55.751Z`  
> **Learning ID**: `LEARN-EVO-hf-cross-encoder-ms-marco-minilm-l6-v2-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When running inference on pair-based cross-encoders backed by `BertForSequenceClassification` or similar multi-segment models, callers MUST explicitly generate and provide `token_type_ids` where query tokens are assigned $0$ and passage tokens are assigned $1$. Systems MUST NOT rely on tokenizers that silently default `token_type_ids` to all zeros or strip them during dictionary unpacking.

**WHY**:
BERT uses `token_type_embeddings` ($E_{T} \in \mathbb{R}^{2 \times d}$) added directly to the input token and positional embeddings before Layer 1. If `token_type_ids` are omitted or filled with constant zeros, the cross-attention layers cannot distinguish query constraints from passage context, degrading ranking performance (dropping NDCG@10 by up to 8.2 points on MS MARCO).

**WHEN TO APPLY**:
Any cross-encoder, NLI classifier, passage re-ranker, or extractive QA model utilizing an architecture with `type_vocab_size > 1` (such as BERT, Electra, ALBERT).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import Dict, List, Tuple
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

def encode_query_passage_pairs(
    pairs: List[Tuple[str, str]],
    model_name: str = "cross-encoder/ms-marco-MiniLM-L6-v2",
    max_length: int = 512,
    device: str = "cuda" if torch.cuda.is_available() else "cpu"
) -> torch.Tensor:
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(model_name).to(device)
    model.eval()

    queries = [pair[0] for pair in pairs]
    passages = [pair[1] for pair in pairs]

    # Explicitly ensure token_type_ids are generated
    features: Dict[str, torch.Tensor] = tokenizer(
        queries,
        passages,
        padding=True,
        truncation="longest_first",
        max_length=max_length,
        return_tensors="pt",
        return_token_type_ids=True
    ).to(device)

    # Invariant assertion: token_type_ids must exist and have multiple unique segment IDs
    if "token_type_ids" not in features:
        raise ValueError("Model requires token_type_ids but tokenizer failed to produce them.")
    
    unique_types = torch.unique(features["token_type_ids"])
    if len(pairs) > 0 and not (0 in unique_types and 1 in unique_types):
        raise ValueError("token_type_ids must contain both segment 0 (query) and segment 1 (passage).")

    with torch.no_grad():
        logits = model(**features).logits.squeeze(-1) # Output shape: (batch_size,)

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T10:22:55.851Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794997375851",
    "title": "Dual-Segment Token Type Invariant in Transformer Re-Rankers",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-cross-encoder-ms-marco-minilm-l6-v2-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "02cb1d13aa1e73cf01480914b30c0c069d212f215a626d74e7058f69e33402c9"
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
        "Harvested/verified timestamp recorded: 2026-11-18T10:22:55.851Z"
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
  "auth_token": "6723acc908622b4d9973561f601299f1bf1625116e567e013a3dc10df447b391"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
