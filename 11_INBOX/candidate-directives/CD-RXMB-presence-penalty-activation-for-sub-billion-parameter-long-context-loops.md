# Candidate Directive: [CD-RXMB] Presence Penalty Activation for Sub-Billion Parameter Long-Context Loops

<!-- PROVENANCE_START
{
  "source_repository": "hf-qwen-qwen3-0.6b-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T08:22:06.210Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-qwen-qwen3-0.6b-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-qwen-qwen3-0.6b-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T08:22:06.210Z`  
> **Learning ID**: `LEARN-EVO-hf-qwen-qwen3-0.6b-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**:
When serving sub-billion parameter dense models ($< 1.0\text{B}$) with long context capacity ($\ge 32\text{k}$) and high base RoPE frequencies ($\ge 10^6$), generation pipelines MUST support dynamic presence and frequency penalty adjustments (e.g., `presence_penalty >= 1.5` when degenerate repetition is detected), while simultaneously constraining decoding temperatures within $0.6 \le T \le 0.7$ and nucleus sampling to $p \le 0.95, k \le 20$.

**WHY**:
In compact models (such as Qwen3-0.6B with 28 layers and hidden dimension 1024), probability mass distribution over a 151k vocabulary can collapse into self-reinforcing attractor states during long-horizon generation, resulting in endless repetition loops of tokens or phrases. Standard $T=1.0$ or greedy search causes cyclic unrolling. Enforcing `presence_penalty = 1.5` penalizes previously emitted tokens globally across the context, breaking cyclic attractor basins without corrupting syntactic structure.

**WHEN TO APPLY**:
Text generation loops, agent execution traces, and coding workflows on models where $\text{Parameter Count} < 10^9$ and $\text{RoPE Base} \ge 100,000$.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch

def apply_presence_penalty_inplace(
    logits: torch.Tensor,
    generated_tokens: torch.Tensor,
    presence_penalty: float
) -> torch.Tensor:
    """
    Applies presence penalty to logits for tokens that have appeared at least once.
    logits: [batch_size, vocab_size]
    generated_tokens: [batch_size, current_seq_len]
    presence_penalty: float (e.g. 1.5)
    """
    if presence_penalty == 0.0:
        return logits
    
    batch_size, vocab_size = logits.shape
    for b in range(batch_size):
        unique_tokens = torch.unique(generated_tokens[b])
        # Mask out padding or invalid indices
        valid_tokens = unique_tokens[(unique_tokens >= 0) & (unique_tokens < vocab_size)]
        logits[b, valid_tokens] -= presence_penalty
    return logits
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Relying strictly on greedy decoding or temperature=0 on sub-billion models
def broken_edge_infer(model, tokens):
    # CRITICAL DEFECT: Sub-billion models collapse into repetitive loops under greedy decoding
    return model.generate(tokens, do_sample=False, max_new_tokens=2048)
```

**VERIFICATION METHOD**:
```python
def test_presence_penalty_suppression():
    batch_size = 1
    vocab_size = 1000

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T08:22:06.312Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794990126312",
    "title": "Presence Penalty Activation for Sub-Billion Parameter Long-Context Loops",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-qwen-qwen3-0.6b-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "dfae72d14f960fd6ec66368c2129ca42758a5a924f69dd60eea8e084048ae31d"
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
      "score": 0.8,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
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
        "Harvested/verified timestamp recorded: 2026-11-18T08:22:06.312Z"
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
  "auth_token": "7b5fbba43795726f4f11d8bd4d9b9c2d5783723b95a133036c21d9f9c7d8398e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
