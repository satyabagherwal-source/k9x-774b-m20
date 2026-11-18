# Candidate Directive: [CD-RXM0] Multi-Token EOS Termination Array Invariant

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
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
Inference generation runtimes serving ChatML-derived or instruction-tuned models with multi-role conversation framing MUST register `eos_token_id` as an immutable integer set/array (e.g., `[151645, 151643]`) rather than a single scalar token ID, and token generation loops MUST evaluate early termination via exact set membership against the current active vocabulary IDs.

**WHY**:
Qwen3 employs `<|im_end|>` (`151645`) to signal the end of a ChatML conversational turn, and `<|endoftext|>` (`151643`) to signal absolute context termination and padding. If the inference loop only checks for a single scalar `eos_token_id` (e.g., default `151645`), raw base prompts terminating on `151643` will fail to stop, triggering runaway token generation, hallucination loops, and VRAM depletion.

**WHEN TO APPLY**:
All auto-regressive generation pipelines, vLLM / TensorRT-LLM / llama.cpp engines, and Hugging Face pipelines interfacing with models utilizing ChatML or dual-EOS tokenization.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import Union, Sequence, Set
import torch

class EOSTerminationValidator:
    """
    Guarantees strict multi-token EOS termination semantics across varying generation runtimes.
    """
    def __init__(self, eos_ids: Union[int, Sequence[int]]):
        if isinstance(eos_ids, int):
            self._eos_set: Set[int] = {eos_ids}
        else:
            self._eos_set: Set[int] = set(eos_ids)
            
    @property
    def eos_set(self) -> Set[int]:
        return self._eos_set

    def is_terminated(self, next_token_ids: torch.Tensor) -> torch.Tensor:
        """
        Evaluates whether newly generated tokens match ANY recognized EOS token ID.
        next_token_ids: 1D Tensor of shape [batch_size]
        Returns: Boolean Tensor of shape [batch_size]
        """
        if next_token_ids.ndim != 1:
            raise ValueError(f"Expected 1D tensor of shape [batch_size], got shape {next_token_ids.shape}")
        
        # Vectorized inclusion check across registered EOS set
        term_mask = torch.zeros_like(next_token_ids, dtype=torch.bool)
        for eos_id in self._eos_set:
            term_mask |= (next_token_ids == eos_id)
        return term_mask
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Scalar casting or checking only the primary config EOS token
def unsafe_generation_loop(model, input_ids, config):
    primary_eos = config.eos_token_id

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T08:22:06.311Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794990126311",
    "title": "Multi-Token EOS Termination Array Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-qwen-qwen3-0.6b-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "78f3055876a05b363241636b29eddd655006c06c7698c96a3880847d579e6e20"
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
        "Harvested/verified timestamp recorded: 2026-11-18T08:22:06.311Z"
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
  "auth_token": "01fd73b89c0de3a7e71f3084592b815f4a8facb34f4c28f8a78df26d2fefede0"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
