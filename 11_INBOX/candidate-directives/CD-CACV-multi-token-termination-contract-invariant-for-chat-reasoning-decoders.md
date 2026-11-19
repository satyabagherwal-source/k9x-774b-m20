# Candidate Directive: [CD-CACV] Multi-Token Termination Contract Invariant for Chat/Reasoning Decoders

<!-- PROVENANCE_START
{
  "source_repository": "hf-autotrust-jev-27b-vl-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T06:33:37.829Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-autotrust-jev-27b-vl-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-autotrust-jev-27b-vl-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T06:33:37.829Z`  
> **Learning ID**: `LEARN-EVO-hf-autotrust-jev-27b-vl-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When serving or querying models configured with ChatML/Specialized delimiter formats where `<|im_end|>` and `<|endoftext|>` coexist, generation runners MUST specify `eos_token_id` as a discrete set containing all valid terminating tokens, and the stopping criteria evaluator MUST perform constant-time membership checking on this set. Downstream stream processors MUST NOT unilaterally treat `<|endoftext|>` as the sole string delimiter.

**WHY**:
In models fine-tuned with conversation/instruction wrappers, `<|im_end|>` (e.g., ID 248046) terminates an assistant turn, while `<|endoftext|>` (e.g., ID 248044) terminates the entire pre-training context. If an inference harness only listens for scalar token 248044, generation runs past `<|im_end|>` and enters a hallucinatory loop, simulating artificial user prompts or emitting ungrounded spatial tokens until reaching `max_new_tokens`.

**WHEN TO APPLY**:
Every serving configuration, tokenizer pipeline, or evaluation harness consuming models derived from Qwen-style tokenizers with multi-turn chat templates and special bounding tokens (`<|object_ref_start|>`, `<|box_start|>`).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import Set, Union, List
import torch

class StructuredStoppingCriteria:
    def __init__(self, eos_token_ids: Union[int, List[int], Set[int]]):
        if isinstance(eos_token_ids, int):
            self.eos_token_set = {eos_token_ids}
        else:
            self.eos_token_set = set(eos_token_ids)

    def is_terminal(self, next_token_id: int) -> bool:
        return next_token_id in self.eos_token_set

    def filter_terminal_logits(self, logits: torch.Tensor, prompt_length: int, current_length: int, min_tokens: int) -> torch.Tensor:
        """
        Guards against premature termination during deliberate System 2 thinking passes.
        """
        if (current_length - prompt_length) < min_tokens:
            for eos_id in self.eos_token_set:
                logits[..., eos_id] = -float("inf")
        return logits
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Relying on a single integer eos_token_id or string equality on raw output.
eos_token = tokenizer.eos_token_id # Returns 248044 only!
# Result: Assistant finishes reply with <|im_end|> (248046), inference engine fails to match,
# and generates garbage System 1 / System 2 continuation loops.
if generated_token == eos_token:
    break
```

**VERIFICATION METHOD**:
Execute deterministic stopping test with synthetic prompt:
```python
def test_eos_token_termination(model, tokenizer):
    eos_set = {248046, 248044}

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T06:33:37.903Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795070017903",
    "title": "Multi-Token Termination Contract Invariant for Chat/Reasoning Decoders",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-autotrust-jev-27b-vl-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "64a6467b7fec1366832d5361b0b967eae065a0db2617ecd908463e94d0186f26"
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
        "Harvested/verified timestamp recorded: 2026-11-19T06:33:37.903Z"
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
  "auth_token": "f836b5c9fbe4003f7475489ab20fa04281b81529d7043ca19dc1c9a68e4df2e4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
