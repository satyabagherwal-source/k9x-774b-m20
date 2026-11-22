# Candidate Directive: [CD-4Z8O] Bidirectional Boundary Invariant for Multimodal Sequence Masking

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
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When interleaving heterogeneous multimodal tokens (audio, vision, tool payloads) within a common causal text sequence, every continuous media sequence MUST be explicitly delimited by paired directional control tokens (e.g., `<|image>` $\dots$ `<image|>`, `<|audio>` $\dots$ `<audio|>`), and the downstream token generator or classification head MUST explicitly suppress these boundary termination tokens from candidate prediction targets.

**WHY**:
Unbounded or unilaterally delimited multimodal embeddings leak sequence context across modalities, causing positional embedding drift and attention degradation. Furthermore, if generation suppression lists (`suppress_tokens`) omit these structural delimiters, models can emit dangling closing brackets or cross-modal collapse tokens, terminating evaluation or corrupting internal state.

**WHEN TO APPLY**:
Applies to any hybrid transformer processing multi-channel tokens (text, audio, vision, tool calls) with unified token indices.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import List
import torch

class MultimodalBoundaryEnforcer:
    """
    Enforces paired structural boundaries around multimodal token insertions
    and sets up generation config suppression invariants.
    """
    def __init__(self, token_map: dict[str, int]):
        self.BOI = token_map["boi_token_id"]  # <|image>
        self.EOI = token_map["eoi_token_id"]  # <image|>
        self.BOA = token_map["boa_token_id"]  # <|audio>
        self.EOA = token_map["eoa_token_id"]  # <audio|>
        self.IMG_PATCH = token_map["image_token_id"]  # <|image|>
        self.AUD_PATCH = token_map["audio_token_id"]  # <|audio|>

    def construct_audio_sequence(self, num_audio_tokens: int) -> torch.Tensor:
        """Surrounds raw acoustic tokens with explicit begin/end boundary markers."""
        assert num_audio_tokens > 0, "Audio token stream cannot be empty"
        tokens = [self.BOA] + [self.AUD_PATCH] * num_audio_tokens + [self.EOA]
        return torch.tensor(tokens, dtype=torch.long)

    def validate_generation_config(self, suppress_tokens: List[int]) -> bool:
        """Verifies that closure tokens are strictly suppressed from generation."""
        required_suppressions = {self.EOI, self.EOA}
        missing = required_suppressions - set(suppress_tokens)
        if missing:
            raise ValueError(f"GenerationConfig violation: Boundary tokens {missing} must be in suppress_tokens")
        return True
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Never insert raw multimodal tokens without bounded sandwich delimiters
def inject_audio_bad(audio_tokens: list[int]) -> list[int]:
    # Lacks BOA (<|audio>) and EOA (<audio|>) boundaries!
    # Attention layers cannot discern modality phase transitions
    return audio_tokens

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T21:14:45.479Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795382085479",
    "title": "Bidirectional Boundary Invariant for Multimodal Sequence Masking",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-akhilaaa3-jev-omni-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "915edefa6b0302d309de6e120fa527e6eeb9c66e17bb3aeea31ea5f0104c600f"
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
        "Harvested/verified timestamp recorded: 2026-11-22T21:14:45.479Z"
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
  "auth_token": "926a5d242be566fd1f2e67d97ea6021d8e071558167ec362d3ab158f3699cf89"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
