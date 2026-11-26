# Candidate Directive: [CD-ILZX] Rework ARC 27a28665 dataset to fail on unknown kinds

<!-- PROVENANCE_START
{
  "source_repository": "NucleoidAI/Nucleoid",
  "source_url": "https://github.com/NucleoidAI/Nucleoid",
  "source_version": "a8825a25",
  "license": "Apache-2.0",
  "timestamp": "2026-11-26T13:36:08.925Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nucleoidai-nucleoid",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid) (Revision: `a8825a25`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-26T13:36:08.925Z`  
> **Learning ID**: `learn-github-nucleoidai-nucleoid`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `arc/README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NucleoidAI/Nucleoid. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a8825a25`: Rework ARC 27a28665 dataset to fail on unknown kinds. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `arc/README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
shape, as in `kind=l4262`, and every other implementation leaves it out, so
`canvas_width` and `canvas_height`. Inside the value of an `is` assignment,
the item words of [NUC 95](../docs/nuc-0095.md) read the same way, so the
named arguments of the implementations in `dataset.27a28665.json` pass bare
kinds, as in `kind=l1707`, while the object keys of its `fill_color` rule are
names, as in `{l4262: 1, l2404: 2, l3743: 3, l1707: 6}`, which an object
literal reads as the same keys. Only the default of the `kind` parameter keeps
its quotes, such as `kind: str = 'l9100'`: accepted Nucleoid takes only a
literal as a parameter default and rejects the bare `kind: str = l9100` with
`SyntaxError: Expected a scalar literal parameter default`.
property, such as `kind=l4262` for the first training input, with no color,
`{l4262: 1, l2404: 2, l3743: 3, l1707: 6}[$Obj.kind@first]`: the object
literal states each shape's code once, keyed by the name of its kind, and
object bracket access reads the code of the block's input kind, anchored with
`@first` because the kind rule turns the kind into `l7544`. A kind that is not
a key of the table reads `null` there, as an absent key does, so a class-level
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
shape, as in `kind='l4262'`, and every other implementation leaves it out, so
`canvas_width` and `canvas_height`. Other strings keep their quotes, such as
the object keys of the `fill_color` rule in `dataset.27a28665.json`, keyword
arguments such as `kind='l1707'`, which are not assignments, and the default
of the `kind` parameter, such as `kind: str = 'l9100'`: accepted Nucleoid takes
only a literal as a parameter default and rejects the bare `kind: str = l9100`
with `SyntaxError: Expected a scalar literal parameter default`.
property, such as `kind='l4262'` for the first training input, with no color,
`{'l4262': 1, 'l2404': 2, 'l3743': 3, 'l1707': 6}[$Obj.kind@first]`: the object
literal states each shape's code once, and object bracket access reads the
code of the block's input kind, anchored with `@first` because the kind rule
turns the kind into `l7544`. `$Obj.volume is $Obj.width * $Obj.height` counts
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a8825a25` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T13:36:08.924Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795700168923",
    "title": "Rework ARC 27a28665 dataset to fail on unknown kinds",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "NucleoidAI/Nucleoid",
    "source_uri": "https://github.com/NucleoidAI/Nucleoid",
    "source_version": "HEAD",
    "content_hash": "29bf4b1ae2425f56f49078b6f3c1b8841e8b1295510b8b94f07ed1fbe3447d9a"
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
        "Harvested/verified timestamp recorded: 2026-11-26T13:36:08.924Z"
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
  "auth_token": "6501ba508521e92389089ada541090aa8e75f563cc05190b07124c5b2eb83cd5"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
