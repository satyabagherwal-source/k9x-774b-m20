# Candidate Directive: [CD-053S] Hypersphere Unit Normalization Metric Invariant

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
Dense sentence embeddings trained under cosine-distance contrastive objectives (such as MultipleNegativesRankingLoss) MUST be explicitly normalized to unit L2 length ($||v||_2 = 1.0$) immediately following the pooling stage before indexing, persistence, or distance calculations. Downstream vector search indexes MUST use inner product (dot product) rather than Euclidean distance when consuming normalized vectors.

**WHY**:
Without explicit L2 normalization, vectors retain varying magnitudes determined by token lengths and gradient variance. This breaks cosine similarity approximations in maximum inner product search (MIPS) engines (FAISS, HNSWLib, Qdrant). When $||u||_2 = 1$ and $||v||_2 = 1$, the Euclidean distance squared simplifies directly to $||u - v||^2 = 2 - 2(u \cdot v)$. Inner product calculation reduces computational complexity from $O(D)$ floating point subtraction, squaring, and accumulation to a single SIMD fused multiply-add (FMA) dot product.

**WHEN TO APPLY**:
Production embedding pipelines using bi-encoder architectures for vector databases, clustering, retrieval-augmented generation (RAG), or semantic caching.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn.functional as F

def generate_normalized_embeddings(model, tokenizer, texts: list[str], max_length: int = 512) -> torch.Tensor:
    encoded_input = tokenizer(
        texts,
        padding=True,
        truncation=True,
        max_length=max_length,
        return_tensors="pt"
    )
    with torch.no_grad():
        model_output = model(**encoded_input)
        
    token_embeddings = model_output[0]
    attention_mask = encoded_input["attention_mask"]
    
    input_mask_expanded = attention_mask.unsqueeze(-1).expand_as(token_embeddings).float()
    sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, dim=1)
    sum_mask = torch.clamp(input_mask_expanded.sum(dim=1), min=1e-9)
    pooled = sum_embeddings / sum_mask
    
    # Mandatory L2 Normalization onto unit hypersphere
    return F.normalize(pooled, p=2, dim=1, eps=1e-12)
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Emitting unnormalized embeddings.
# Vector database inner-product queries will return completely invalid rankings!
def unnormalized_pipeline(model, tokenizer, texts):
    # ... pooling ...
    return pooled # Magnitude varies arbitrarily from 3.0 to 25.0
```

**VERIFICATION METHOD**:
```python
def test_unit_hypersphere_norm():

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T09:37:50.296Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795685870296",
    "title": "Hypersphere Unit Normalization Metric Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-sentence-transformers-all-minilm-l6-v2-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "f7632a147ad5b9da0c4fd629033a287eb990e3547d5b17aa3ed0f0803d9e92e9"
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
        "Harvested/verified timestamp recorded: 2026-11-26T09:37:50.296Z"
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
  "auth_token": "37c04cbca4249aa3a88c23bc16c552264487c226b2e898b5271967c0c3ac3e0d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
