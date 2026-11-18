# Candidate Directive: [CD-UIVV] Dual-Identity Token Index Disambiguation

<!-- PROVENANCE_START
{
  "source_repository": "hf-google-t5-t5-small-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T08:52:06.695Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-google-t5-t5-small-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-google-t5-t5-small-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T08:52:06.695Z`  
> **Learning ID**: `LEARN-EVO-hf-google-t5-t5-small-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**:
When an autoregressive sequence-to-sequence model config defines `decoder_start_token_id == pad_token_id`, the generation runtime MUST enforce an explicit split between input token preparation (where index 0 is valid content) and target loss calculation (where index 0 is masked to `-100`). Systems MUST NEVER rely on implicit truthiness or non-zero checks to detect padding tokens.

**WHY**:
Treating token `0` as implicitly false or automatically masking all zeros in input sequences zeroes out valid prefix tokens and initial start tokens. Conversely, failing to mask target padding indices causes the model's loss landscape to optimize for predicting infinite padding sequences, degrading generation into immediate sequence truncation.

**WHEN TO APPLY**:
All sequence-to-sequence Transformer runtimes, tokenization pipelines, model serialization engines, and inference serving loops handling T5, ByT5, or any architecture where special tokens alias index 0.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch

def prepare_t5_decoder_inputs_and_labels(
    input_ids: torch.Tensor,
    pad_token_id: int = 0,
    decoder_start_token_id: int = 0,
    ignore_index: int = -100
) -> tuple[torch.Tensor, torch.Tensor]:
    """
    Safely shifts target tokens right for T5 autoregressive generation
    while isolating decoder_start_token_id from loss evaluation targets.
    """
    # 1. Labels must mask padding with ignore_index
    labels = input_ids.clone()
    labels[labels == pad_token_id] = ignore_index

    # 2. Shift right: prepend decoder_start_token_id, truncate last token
    shifted_decoder_input_ids = torch.full(
        (input_ids.shape[0], 1),
        fill_value=decoder_start_token_id,
        dtype=input_ids.dtype,
        device=input_ids.device
    )
    shifted_decoder_input_ids = torch.cat(
        [shifted_decoder_input_ids, input_ids[:, :-1]], dim=-1
    )

    # 3. Guard against -100 leaking into decoder inputs (replace back with pad_token_id)
    shifted_decoder_input_ids.masked_fill_(
        shifted_decoder_input_ids == ignore_index, pad_token_id
    )

    return shifted_decoder_input_ids, labels
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Direct shift without ignore_index isolation or using falsy check

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T08:52:06.808Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794991926808",
    "title": "Dual-Identity Token Index Disambiguation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-google-t5-t5-small-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "46839fbf895eead71d8091298dbd77f6d79a11af8e5459f5b2aa5b0ba815996c"
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
        "Harvested/verified timestamp recorded: 2026-11-18T08:52:06.808Z"
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
  "auth_token": "f68442447edfcba449023e14b584703928be5baf4bfa3624e7e663b18e1c5516"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
