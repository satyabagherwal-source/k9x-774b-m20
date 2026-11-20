# Candidate Directive: [CD-ZWL0] Hexagonal H3 Spatial Tokenizer Boundary Non-Overlapping Invariant

<!-- PROVENANCE_START
{
  "source_repository": "hf-sentinel7-h3-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T14:07:33.948Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-sentinel7-h3-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-sentinel7-h3-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T14:07:33.948Z`  
> **Learning ID**: `LEARN-EVO-hf-sentinel7-h3-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When utilizing Uber H3 spatial index encodings as token inputs for transformer or SSM embedding layers, the spatial discretization tokenizer MUST enforce bijective index validation, canonical resolution clamping ($0 \le \text{res} \le 15$), and pentagon orientation parity guards. Any input coordinate resolving to an invalid 64-bit integer index or crossing an unpadded pentagon discontinuity MUST be mapped to a dedicated topological boundary token (`<H3_PENTAGON_DISCONTINUITY>`), NOT silently dropped or truncated.

**WHY**:
The H3 discrete global grid contains exactly 12 pentagons per resolution tier that lack standard hexagonal 6-fold symmetry, introducing topological distortion (icosahedron vertices). In spatial transformers/SSMs, feeding unvalidated 64-bit integer representations of H3 cells directly into standard embedding tables leads to hash collisions, out-of-bounds integer overflow during embedding lookup, and spatial disorientation across icosahedron face seams.

**WHEN TO APPLY**:
Applies to geospatial ML pipelines, spatio-temporal SSM encoders, and trajectory tokenizers using H3 indexing libraries.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
"""
Defensive Geospatial H3 Cell Tokenizer with Pentagon Boundary Guards.
Converts raw coordinates or H3 indices into bounded token vocabulary keys.
"""

from typing import Union, Final

H3_MAX_RESOLUTION: Final[int] = 15
H3_MIN_RESOLUTION: Final[int] = 0
PAD_TOKEN_ID: Final[int] = 0
UNK_TOKEN_ID: Final[int] = 1
PENTAGON_TOKEN_ID: Final[int] = 2
VOCAB_OFFSET: Final[int] = 3


class DefensiveH3Tokenizer:
    def __init__(self, target_resolution: int, base_vocab_size: int = 100_000):
        if not (H3_MIN_RESOLUTION <= target_resolution <= H3_MAX_RESOLUTION):
            raise ValueError(f"Target resolution {target_resolution} outside valid [0, 15] range.")
        self.resolution = target_resolution
        self.base_vocab_size = base_vocab_size

    def is_valid_h3_index(self, h3_int: int) -> bool:
        """Bitwise validation of a 64-bit H3 index structure."""
        if not (0 < h3_int <= 0x7FFFFFFFFFFFFFFF):
            return False
        # Extract mode bits (bits 59-62)
        mode = (h3_int >> 59) & 0x0F
        if mode != 1:  # Mode 1 represents standard H3 Cell
            return False
        # Extract resolution bits (bits 52-55)
        res = (h3_int >> 52) & 0x0F
        return res == self.resolution

    def is_pentagon(self, h3_int: int) -> bool:
        """Determines if the cell represents one of the 12 icosahedron pentagon poles."""
        # Bits 56-58 indicate leading base cell (0-121)
        base_cell = (h3_int >> 45) & 0x7F

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T14:07:34.067Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795183654067",
    "title": "Hexagonal H3 Spatial Tokenizer Boundary Non-Overlapping Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-sentinel7-h3-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "8b1f7b801f278131c9c8c26c0a3f3005460776433eb0147db6674c2c965f9a31"
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
        "Harvested/verified timestamp recorded: 2026-11-20T14:07:34.067Z"
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
  "auth_token": "03e372821ed1f597a6381fa2243e7a86393e45839aa6c9347b1ef58a14d688fa"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
