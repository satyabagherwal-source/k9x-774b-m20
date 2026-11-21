# Candidate Directive: [CD-LE07] Multi-EOS Disjunction Termination Invariant

<!-- PROVENANCE_START
{
  "source_repository": "hf-openbmb-minicpm-ocr-1.0-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T19:47:52.145Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-openbmb-minicpm-ocr-1.0-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-openbmb-minicpm-ocr-1.0-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T19:47:52.145Z`  
> **Learning ID**: `LEARN-EVO-hf-openbmb-minicpm-ocr-1.0-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When serving or running decoding loops on language models that specify multiple end-of-sequence token IDs (`eos_token_id: List[int]`), generation loops and post-processing filters MUST evaluate EOS conditions using set-containment disjunction on every generated token. The loop MUST NOT cast `eos_token_id` to a single scalar or evaluate solely `token_id == eos_token_id[0]`.

**WHY**:
MiniCPM-OCR defines `eos_token_id: [248044, 248046]`. In modern conversational and vision-language tokenizers, one token corresponds to the structural turn marker `<|im_end|>` (248044), while the other corresponds to an end-of-text/padding marker `<|endoftext|>` (248046). If a runtime monitors only `eos_token_id[0]`, the model generating `248046` will bypass stop conditions, trigger runaway token generation, exceed context budgets, consume GPU compute in an unbounded loop, and return corrupted trailing garbage tokens.

**WHEN TO APPLY**:
All text and multimodal generation loops (PyTorch custom generation, TensorRT-LLM, ONNX Runtime, llama.cpp, vLLM worker backends).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import Union, List, Set
import torch

class GenerationTerminationMonitor:
    def __init__(self, eos_ids: Union[int, List[int], Set[int]]):
        if isinstance(eos_ids, int):
            self.eos_token_ids: Set[int] = {eos_ids}
        else:
            self.eos_token_ids: Set[int] = set(eos_ids)

    def is_eos(self, token_tensor: torch.Tensor) -> torch.Tensor:
        """
        Evaluates whether current step output tokens match any valid EOS marker.
        Returns a boolean tensor of shape [batch_size].
        """
        assert token_tensor.ndim == 1, f"Expected [batch_size], got {token_tensor.shape}"
        # Vectorized check across batch for all registered EOS tokens
        is_terminated = torch.zeros(token_tensor.shape, dtype=torch.bool, device=token_tensor.device)
        for eos_id in self.eos_token_ids:
            is_terminated |= (token_tensor == eos_id)
        return is_terminated

    def mask_completed_sequences(
        self, current_tokens: torch.Tensor, active_mask: torch.Tensor
    ) -> torch.Tensor:
        """Updates sequence activity mask: once stopped, remains stopped."""
        new_terminations = self.is_eos(current_tokens)
        return active_mask & (~new_terminations)
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Unsafe assumption of single scalar EOS token ID
def generate_tokens(model, input_ids, eos_token_id):
    # FATAL BUG: If eos_token_id is [248044, 248046], this evaluates as an int comparison
    # or takes eos_token_id[0], allowing 248046 to run endlessly until max_tokens!
    for _ in range(max_new_tokens):
        out = model(input_ids)

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T19:47:52.231Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795290472231",
    "title": "Multi-EOS Disjunction Termination Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-openbmb-minicpm-ocr-1.0-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "a79c59b7122a6d03d67839837ec4dab6979d22a4313707327b117a9e1edbe4b7"
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
        "Harvested/verified timestamp recorded: 2026-11-21T19:47:52.231Z"
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
  "auth_token": "781578e69f46f0563f19259958ea58d3a42b310e29a9c9b93c531d6b293a4465"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
