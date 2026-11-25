# Candidate Directive: [CD-OMEK] Kullback-Leibler Divergence (KLD) Guarding for Quantized Model Distribution

<!-- PROVENANCE_START
{
  "source_repository": "hf-atomicchat-inkling-2-mini-uncensored-gguf-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-25T09:41:12.267Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-atomicchat-inkling-2-mini-uncensored-gguf-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-atomicchat-inkling-2-mini-uncensored-gguf-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-25T09:41:12.267Z`  
> **Learning ID**: `LEARN-EVO-hf-atomicchat-inkling-2-mini-uncensored-gguf-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain J

## Original Learning Payload (100% Preserved)
**RULE**:
Any pre-baked quantized model artifact (`Q4_K`, `IQ3_S`, `IQ2_M`) distributed for production MUST have its prediction distribution verified against the unquantized baseline (`BF16`/`FP16`) on a standardized, task-neutral calibration corpus of not less than $50 \times 4096$ tokens, and MUST NOT exceed a KLD bound of $0.05$ for medium-tier quants (3-4 bit) or $0.15$ for extreme-tier quants (2-bit), alongside retaining a Top-1 token agreement of at least $85\%$.

**WHY**:
Perplexity (PPL) alone obscures degenerate routing in MoE networks. An MoE can maintain an acceptable overall perplexity while specific expert branches collapse or experience severe routing drift, yielding catastrophic failures in uncensored behavioral alignment or multimodal cross-attention. KLD measures exact probability mass drift token-by-token across the full vocabulary.

**WHEN TO APPLY**:
Prior to publishing, baking, or committing quantized artifacts (`.gguf`) derived from base FP16/BF16 weights, especially when applying activation-aware or importance-matrix (`imatrix`) pruning.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# Complete automated verification harness for KLD and Top-1 token agreement
import torch
import torch.nn.functional as F
from typing import Tuple

def evaluate_quantization_divergence(
    base_logits_stream: torch.Tensor,       # Shape: [N_CHUNKS, SEQ_LEN, VOCAB_SIZE] in float32
    quant_logits_stream: torch.Tensor,      # Shape: [N_CHUNKS, SEQ_LEN, VOCAB_SIZE] in float32
    max_kld_threshold: float,
    min_top1_threshold: float
) -> Tuple[float, float, bool]:
    """
    Computes mean token-level Kullback-Leibler Divergence (P || Q) and Top-1 agreement.
    P: Ground-truth unquantized BF16 distribution.
    Q: Quantized candidate distribution.
    """
    assert base_logits_stream.shape == quant_logits_stream.shape, "Logit shape mismatch"
    
    total_tokens = base_logits_stream.shape[0] * base_logits_stream.shape[1]
    
    # Flatten across batch and sequence dimensions
    p_logits = base_logits_stream.view(-1, base_logits_stream.size(-1))
    q_logits = quant_logits_stream.view(-1, quant_logits_stream.size(-1))
    
    # Stabilized log-softmax and softmax
    p_probs = F.softmax(p_logits, dim=-1)
    p_log_probs = F.log_softmax(p_logits, dim=-1)
    q_log_probs = F.log_softmax(q_logits, dim=-1)
    
    # KL(P || Q) = sum(P * (log P - log Q))
    # kl_div computes: target * (log(target) - input), where input is q_log_probs
    kld_elementwise = F.kl_div(
        q_log_probs, 
        p_probs, 
        reduction='none', 
        log_target=False
    ).sum(dim=-1)

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T09:41:12.427Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795599672427",
    "title": "Kullback-Leibler Divergence (KLD) Guarding for Quantized Model Distribution",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-atomicchat-inkling-2-mini-uncensored-gguf-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "cedf5656215c2cbaf965d83561234d1c416abc37924b7b9aaab70e842a23d425"
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
        "Harvested/verified timestamp recorded: 2026-11-25T09:41:12.427Z"
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
  "auth_token": "4562ef63e8aeab232ce5155bb1d1e452501a162fa894fd98955e147f58d27f0a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
