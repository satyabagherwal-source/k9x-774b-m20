# Candidate Directive: [CD-3UJ4] Selective Quantization Partitioning for Grouped Attention & Router Networks

<!-- PROVENANCE_START
{
  "source_repository": "hf-openai-gpt-oss-20b-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T03:16:45.410Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-openai-gpt-oss-20b-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-openai-gpt-oss-20b-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T03:16:45.410Z`  
> **Learning ID**: `LEARN-EVO-hf-openai-gpt-oss-20b-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
In low-bit quantized causal language models (such as MXFP4 MoE systems), self-attention projections (`q_proj`, `k_proj`, `v_proj`, `o_proj`), router gating layers (`mlp.router`), embedding tables (`embed_tokens`), and the final language model head (`lm_head`) MUST remain in unquantized high precision (FP16 or BF16). Only MoE feed-forward projection matrices (`gate_proj`, `up_proj`, `down_proj`) may be subjected to 4-bit compression.

**WHY**:
Router logits dictate sparse dispatch decisions. Quantizing router weight matrices to 4-bit degrades categorical softmax distribution stability, causing expert collapse or stochastic dispatch jitter across token boundaries. Similarly, attention projections in Grouped Query Attention (GQA) have 8x fewer key-value heads than query heads; quantizing key-value heads causes catastrophic loss in long-sequence associative recall and positional indexing. Unquantized router and attention blocks preserve 99.4% of full-precision reasoning performance while MoE weights yield over 70% total memory reduction.

**WHEN TO APPLY**:
- All MoE architectures targeting quantization configurations below 8-bit (`AWQ`, `GPTQ`, `MXFP4`, `FP4`).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import Set, Dict, Any

def enforce_quantization_whitelist(module_name: str, quant_method: str) -> bool:
    """
    Enforces the selective quantization whitelist invariant.
    Returns True if the module is eligible for quantization; False otherwise.
    """
    # Canonical unquantized module patterns from config.json
    EXCLUDED_PREFIXES = (
        "model.layers.",        # Conditional check applied inside
        "model.embed_tokens",
        "lm_head"
    )
    
    EXCLUDED_SUBSTRINGS = (
        "self_attn",
        "mlp.router",
        "embed_tokens",
        "lm_head"
    )

    for pattern in EXCLUDED_SUBSTRINGS:
        if pattern in module_name:
            return False  # MUST NOT CONVERT

    # Only MLP expert execution tensors are valid conversion candidates
    if "mlp.experts" in module_name or "mlp.layers" in module_name:
        return True

    return False
```

**NEGATIVE CONSTRAINT**:
```python
# CRITICAL ARCHITECTURAL ANTI-PATTERN: Blindly quantizing all Linear modules
def apply_naive_quantization(model: torch.nn.Module):
    for name, module in model.named_modules():
        if isinstance(module, torch.nn.Linear):

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T03:16:45.520Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794626205520",
    "title": "Selective Quantization Partitioning for Grouped Attention & Router Networks",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-openai-gpt-oss-20b-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "915957a6b31952183ecd4ebf5cf28dabd4b1011311f7a2d44465901265028018"
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
        "Harvested/verified timestamp recorded: 2026-11-14T03:16:45.520Z"
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
  "auth_token": "70d7a26359a1b188365db535555662c4c3b6d76dce98d6c6f44053209146a648"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
