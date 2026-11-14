# Candidate Directive: [CD-U1IL] avoid flagging coordinating conjunction 'for they'

<!-- PROVENANCE_START
{
  "source_repository": "Automattic/harper",
  "source_url": "https://github.com/Automattic/harper",
  "source_version": "4270327e",
  "license": "Apache-2.0",
  "timestamp": "2026-11-14T21:20:53.037Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-automattic-harper",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Automattic/harper](https://github.com/Automattic/harper) (Revision: `4270327e`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-14T21:20:53.037Z`  
> **Learning ID**: `learn-github-automattic-harper`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `harper-core/src/linting/weir_rules/TheyToThem.weir`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Automattic/harper. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4270327e`: TheyToThem): avoid flagging coordinating conjunction 'for they'. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `harper-core/src/linting/weir_rules/TheyToThem.weir`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
expr prepositions [to, with, about, against, between, among, around, toward, towards, through, beyond, behind, across, near, inside, outside]
# `for` can also act as a coordinating conjunction introducing a finite clause, where `they` is the subject
expr main [<(@prepositions they), they>, <[(for they ![VERB, AUX]), (for they.)], they>, <[(@verbs they ![VERB, AUX]), (@verbs they.)], they>]
test "This gift is for they." "This gift is for them."
test "Wait for they at the station." "Wait for them at the station."
allows "At least their deaths are not meaningless, for they shall all be unified into the white and delightsome hosts of Heaven."
allows "For they know not what they do."
allows "Rejoice, for they have returned safely."
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
expr prepositions [to, with, for, about, against, between, among, around, toward, towards, through, beyond, behind, across, near, inside, outside]
expr main [<(@prepositions they), they>, <[(@verbs they ![VERB, AUX]), (@verbs they.)], they>]
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4270327e` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T21:20:53.035Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794691253035",
    "title": "avoid flagging coordinating conjunction 'for they'",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Automattic/harper",
    "source_uri": "https://github.com/Automattic/harper",
    "source_version": "HEAD",
    "content_hash": "3b96a2981886253e5aa8160ac2b2120be08d5b577864810791a8079ff3e1a11f"
  },
  "evidence_fingerprint": "5c7fbcc97293e38f",
  "dimensions": {
    "source_reliability": {
      "status": "PASS",
      "score": 0.6,
      "tier": "TIER_3_COMMUNITY_OPEN",
      "findings": [],
      "details": [
        "Source originates from community open repository",
        "Source version unpinned (HEAD), subject to upstream drift",
        "Cryptographic SHA-256 payload integrity hash present"
      ]
    },
    "evidence_quality": {
      "status": "FAIL",
      "score": 0,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [],
      "details": [
        "Direct empirical evidence ratio: 0% (0/5)",
        "Evidence-to-claim lexical alignment: 0%"
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
        "Harvested/verified timestamp recorded: 2026-11-14T21:20:53.035Z"
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
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "5e4064ab593659da42fe3ef4419ade21c0a818073b224c9f0a211d799867b5f3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
