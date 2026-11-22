# Candidate Directive: [CD-4Z8O] Left-Padding Invariant for Causal Decoder Batch Inference

<!-- PROVENANCE_START
{
  "source_repository": "hf-akhilaaa3-jev-omni-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T21:14:45.359Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-akhilaaa3-jev-omni-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-akhilaaa3-jev-omni-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T21:14:45.359Z`  
> **Learning ID**: `LEARN-EVO-hf-akhilaaa3-jev-omni-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When running batch inference on causal decoder-only models (whether for generation or pooled classification), input batches MUST be configured with `padding_side = "left"`. The padding token MUST NOT be equal to the EOS token if loss or end-of-sequence detection relies on token identity.

**WHY**:
In causal attention masks (lower triangular), right-padding creates intermediate pad tokens between the end of prompt tokens and subsequent positions. If position IDs increment over right-padded positions, subsequent operations or pooled tokens point to PAD tokens instead of the actual final state. Left-padding guarantees that the true terminal token of every sequence in the batch aligns precisely at position index `-1`, preserving valid causal masking without attention pollution.

**WHEN TO APPLY**:
Universal for any transformer-based causal batch inference in Hugging Face / PyTorch.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
def configure_causal_tokenizer(tokenizer, pad_token_id: int = 0):
    """
    Configures tokenizer padding side and verifies causal alignment.
    """
    tokenizer.padding_side = "left"
    tokenizer.pad_token_id = pad_token_id
    
    # Assert EOS is distinct from PAD to prevent unmasked sequence truncation
    assert tokenizer.pad_token_id != tokenizer.eos_token_id, (
        f"Critical config error: pad_token_id ({tokenizer.pad_token_id}) "
        f"cannot equal eos_token_id ({tokenizer.eos_token_id})"
    )
    return tokenizer
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Using default right-padding on causal architectures
tokenizer.padding_side = "right"  # BREAKS pooled classification & causal batch generation!
outputs = model(tokenizer(["Hi", "A much longer sentence"], padding=True, return_tensors="pt").input_ids)
# outputs.last_hidden_state[:, -1, :] will point to <pad> for shorter sequences!
```

**VERIFICATION METHOD**:
```python
def test_tokenizer_left_padding(tokenizer):
    batch = tokenizer(["Short", "A substantially longer sentence"], padding=True, return_tensors="pt")
    # For the shorter sequence, the first token must be PAD
    assert batch.input_ids[0, 0] == tokenizer.pad_token_id, "Batch position [0, 0] must be padded on the left"
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T21:14:45.480Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795382085480",
    "title": "Left-Padding Invariant for Causal Decoder Batch Inference",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-akhilaaa3-jev-omni-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "85acfc7a30aec32eca995b6763894778d8edf881b2fa380c61a424c215d031f8"
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
        "Harvested/verified timestamp recorded: 2026-11-22T21:14:45.480Z"
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
  "auth_token": "4be67bf29f089090f8b247f5d2f90c97fc6cc83dd6c41735cac197d8e38c46d3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
