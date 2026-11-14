# Candidate Directive: [CD-YD2R] Multi-EOS Token Termination & Disjunction Invariant

<!-- PROVENANCE_START
{
  "source_repository": "hf-openbmb-minicpm-ocr-1.0-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T06:28:26.836Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-openbmb-minicpm-ocr-1.0-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-openbmb-minicpm-ocr-1.0-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T06:28:26.836Z`  
> **Learning ID**: `LEARN-EVO-hf-openbmb-minicpm-ocr-1.0-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When an inference engine or generation orchestrator consumes a language or multimodal model with multiple End-Of-Sequence tokens (e.g., `eos_token_id: [248044, 248046]`), the termination logic MUST evaluate token termination as a set-containment or bitmask disjunction operation across the entire sequence batch. A generation loop MUST NOT assume `eos_token_id` is an integer scalar, nor compare with a simple equality `token == model.config.eos_token_id`.

**WHY**:
Modern tokenizers reserve discrete EOS tokens for differing structural boundaries (e.g., standard text end `<|im_end|>` vs structured document turn boundary `<|endoftext|>`). If the generation harness treats `eos_token_id` as a scalar, one of two critical failures occurs:
1. Runtime type crash: `TypeError: unhashable type: 'list'` or `ValueError: The truth value of an array with more than one element is ambiguous`.
2. Infinite output generation: The model emits the alternative EOS token (e.g., `248046`), the single scalar equality check evaluates to `False`, and decoding runs endlessly until context limit (`max_position_embeddings: 262144`) is exhausted, crashing memory buffers.

**WHEN TO APPLY**:
All autoregressive decoding loops, streaming tokenizers, vLLM/SGLang model adapters, and custom inference workers handling chat or structured OCR output templates.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import Set, Union, List
import torch

class SafeGenerationTerminator:
    """
    Guarantees robust EOS boundary checking across arbitrary scalar/list token definitions.
    """
    def __init__(self, raw_eos_token_id: Union[int, List[int], Set[int], None]):
        if raw_eos_token_id is None:
            self.eos_token_ids: Set[int] = set()
        elif isinstance(raw_eos_token_id, int):
            self.eos_token_ids = {raw_eos_token_id}
        elif isinstance(raw_eos_token_id, (list, tuple, set)):
            self.eos_token_ids = set(int(t) for t in raw_eos_token_id)
        else:
            raise TypeError(f"Invalid type for eos_token_id: {type(raw_eos_token_id)}")
            
        self.eos_tensor: Optional[torch.Tensor] = None

    def _get_eos_tensor(self, device: torch.device) -> torch.Tensor:
        if self.eos_tensor is None or self.eos_tensor.device != device:
            self.eos_tensor = torch.tensor(
                list(self.eos_token_ids), 
                dtype=torch.long, 
                device=device
            )
        return self.eos_tensor

    def is_terminated(self, next_tokens: torch.Tensor) -> torch.Tensor:
        """
        Evaluates boolean mask of terminated sequences.
        next_tokens: Shape [BatchSize] or [BatchSize, 1]
        Returns: Boolean Tensor [BatchSize]
        """
        if not self.eos_token_ids:
            return torch.zeros(next_tokens.shape[0], dtype=torch.bool, device=next_tokens.device)

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T06:28:26.931Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794637706931",
    "title": "Multi-EOS Token Termination & Disjunction Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-openbmb-minicpm-ocr-1.0-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "041564c21bc1f6fc623ae432deff9b6c3d4238e81571e2547377bf38fdfa5fe1"
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
        "Expresses generalized engineering invariants (4 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-14T06:28:26.931Z"
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
  "auth_token": "b8fb8e980d3ffeb39b2802b4d19774e149c0bf87b55d9f1fe1b13d399f22787f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
