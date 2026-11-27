# Candidate Directive: [CD-1E4N] Rework ARC 27a28665 dataset to give unknown kinds color 0

<!-- PROVENANCE_START
{
  "source_repository": "NucleoidAI/Nucleoid",
  "source_url": "https://github.com/NucleoidAI/Nucleoid",
  "source_version": "2889b681",
  "license": "Apache-2.0",
  "timestamp": "2026-11-27T04:18:33.287Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nucleoidai-nucleoid",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid) (Revision: `2889b681`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-27T04:18:33.287Z`  
> **Learning ID**: `learn-github-nucleoidai-nucleoid`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `arc/README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NucleoidAI/Nucleoid. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2889b681`: Rework ARC 27a28665 dataset to give unknown kinds color 0. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `arc/README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
`{l4262: 1, l2404: 2, l3743: 3, l1707: 6}[$Obj.kind@first] ?? 0`: the object
a key of the table reads `null` there, as an absent key does, and the nullish
coalescing `?? 0` of [NUC 60](../docs/nuc-0060.md) turns that `null` into the
background color 0 while it keeps every code the table holds. An
implementation that leaves out `kind`, so that its object takes the default
`l9100`, or that names a kind the table lacks, such as `l5555`, therefore gives
its point color 0, which is no cell, and the rules raise no error, so the run
goes on; the input state, built from the class and the implementation alone,
still carries that kind. The default never applies to the ten pairs, whose
blocks all take one of the table's four kinds.
`$Obj.volume is 0 if $Obj.fill_color is 0 else $Obj.width * $Obj.height`, a
conditional expression of [NUC 59](../docs/nuc-0059.md) whose condition uses
the comparison `is` of [NUC 86](../docs/nuc-0086.md), counts a colored point's
single cell and gives a point of color 0 none, as `dataset.25d8a9c8.json`
empties a cleared row: such a point has the `volume` 0 that `Matrix.measure`
counts in its all-zero output mask, and it keeps its `x`, `y`, and 1 by 1
`width` and 
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
`{l4262: 1, l2404: 2, l3743: 3, l1707: 6}[$Obj.kind@first]`: the object
a key of the table reads `null` there, as an absent key does, so a class-level
validation rule, `if $Obj.fill_color is null:` with the body
`throw $Obj.kind@first`, throws that input kind. An implementation that leaves
out `kind`, so that its object takes the default `l9100`, or that names a kind
the table lacks, therefore fails visibly instead of giving the point no color:
the runtime exits with status 1 and an error that names the kind and the
implementation's line, such as `l9100 (line 27, column 1)`. The input state,
built from the class and the implementation alone, still carries the kind; the
failure comes when the rules run on the pair's world. The rule never fires on
the ten pairs, and it is Nucleoid's class-level validation, a `throw` in a
class-level `if`, as the specification's rules that reject an invalid
instance write it. `$Obj.volume is $Obj.width * $Obj.height` counts
the filled point's single cell. The rules create no other properties, so each
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2889b681` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T04:18:33.285Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795753113285",
    "title": "Rework ARC 27a28665 dataset to give unknown kinds color 0",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "NucleoidAI/Nucleoid",
    "source_uri": "https://github.com/NucleoidAI/Nucleoid",
    "source_version": "HEAD",
    "content_hash": "ac9ae2c9974bc3e2950ee206f7edd38ae4b4db7c6c87cd0657eeb88890375882"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Harvested/verified timestamp recorded: 2026-11-27T04:18:33.285Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "a01352e5d035c44873e8ad0227584ee672558906646fdd4e7309e8ee39798b7d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
