# Candidate Directive: [CD-ZRGA] Invariant Progress Guarantee in Threshold-Based Iterative Denoising

<!-- PROVENANCE_START
{
  "source_repository": "hf-diffuspace-clover-35b-a3b-preview-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T21:23:01.567Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-diffuspace-clover-35b-a3b-preview-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-diffuspace-clover-35b-a3b-preview-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T21:23:01.567Z`  
> **Learning ID**: `LEARN-EVO-hf-diffuspace-clover-35b-a3b-preview-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
Every iterative parallel de-masking or diffusion language decoding loop MUST enforce an atomic, guaranteed single-token progress fallback whenever all candidates fail the acceptance threshold ($\max(P) < \tau$). The decoding loop MUST NOT terminate or re-iterate on an unchanged mask tensor without forcing at least one token mutation.

**WHY**:
In high-entropy zones (such as creative tokens, rare syntax, or unpredictable identifiers), model confidence at all masked positions can stay strictly below the threshold $\tau$ (e.g., $0.95$). Without a strictly enforced fallback, the iteration halts progress while leaving `<|mask|>` tokens unresolved, inducing either an infinite forward-pass spin lock, buffer starvation, or a corrupted prompt prefix containing raw mask tokens.

**WHEN TO APPLY**:
In all Discrete Diffusion Language Models (dLLMs), speculative multi-token verifiers, Non-Autoregressive Translation (NAT) decoders, and parallel iterative infilling engines.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch

def resolve_mask_block_progress_guaranteed(
    model: torch.nn.Module,
    input_ids: torch.Tensor,
    mask_indices: torch.Tensor,
    mask_token_id: int,
    confidence_threshold: float = 0.95
) -> tuple[torch.Tensor, torch.Tensor]:
    """
    Guarantees deterministic forward progress per diffusion iteration.
    
    Args:
        input_ids: Tensor of shape (batch_size, sequence_length)
        mask_indices: 1D boolean tensor indicating active mask locations
        mask_token_id: Special token id used for masking
        confidence_threshold: Minimum probability threshold for parallel acceptance
    """
    if not mask_indices.any():
        return input_ids, mask_indices

    # Forward pass over current sequence
    with torch.no_grad():
        outputs = model(input_ids)
        logits = outputs.logits  # (batch_size, seq_len, vocab_size)

    # Extract logits strictly at the active mask locations
    mask_pos = torch.where(mask_indices)[0]
    target_logits = logits[0, mask_pos, :]
    probs = torch.softmax(target_logits, dim=-1)
    
    max_probs, predicted_tokens = torch.max(probs, dim=-1)
    
    # 1. Primary vector selection: positions exceeding confidence threshold
    accepted_mask = max_probs >= confidence_threshold
    
    # 2. Invariant Guard: If no positions qualify, force the single highest confidence position
    if not accepted_mask.any():

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T21:23:01.684Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795296181683",
    "title": "Invariant Progress Guarantee in Threshold-Based Iterative Denoising",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-diffuspace-clover-35b-a3b-preview-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "9d44c2955944106863293e080c91ecf48eaa082568d4938bd9eb2e239d3e82bc"
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
        "Harvested/verified timestamp recorded: 2026-11-21T21:23:01.684Z"
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
  "auth_token": "c15818281d30842cf9a1e5d7e7304191a971ee93a20212be715cf2bc932e3096"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
