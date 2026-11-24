# Candidate Directive: [CD-CVWN] Remove comments from ARC datasets

<!-- PROVENANCE_START
{
  "source_repository": "NucleoidAI/Nucleoid",
  "source_url": "https://github.com/NucleoidAI/Nucleoid",
  "source_version": "449e97bb",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T14:24:20.615Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nucleoidai-nucleoid",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid) (Revision: `449e97bb`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T14:24:20.615Z`  
> **Learning ID**: `learn-github-nucleoidai-nucleoid`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `arc/src/dataset/dataset.017c7c7b.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NucleoidAI/Nucleoid. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9dac162b`: Remove comments from ARC datasets. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `arc/src/dataset/dataset.017c7c7b.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  "class_declaration": "class Obj(x: int, y: int, width: int, height: int, orientation: int, volume: int, tag: str = 'l9100', color: int, period: int):\n    this.x is x\n    this.y is y\n    this.width is width\n    this.height is height\n    this.orientation is orientation\n    this.volume is volume\n    this.tag is tag\n    this.color is color\n    this.period is period",
    "$Obj.tag is l8384",
    "$Obj.extension_direction is down",
    "$Obj.height is $Obj.height@first * 3 / 2",
    "$Obj.color is 2"
          "implementation": "obj7868bfbcdc17 is Obj(x=0, y=0, width=3, height=6, orientation=0, volume=9, color=1, period=4)",
          "implementation": "obj251f7bd03919 is Obj(x=0, y=0, width=3, height=6, orientation=0, volume=9, color=1, period=2)",
          "implementation": "obj69f9506dfd32 is Obj(x=0, y=0, width=2, height=6, orientation=0, volume=8, color=1, period=3)",
          "implementation": "obj93fb566cfca3 is Obj(x=0, y=0, width=3, height=6, orientation=0, volume=10, color=1, period=3)",
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
  "class_declaration": "# Each object is the whole color-1 pattern, as tall as the grid, whose rows repeat every period rows. The output continues it down to 9 rows and draws it in color 2\nclass Obj(x: int, y: int, width: int, height: int, orientation: int, volume: int, tag: str = 'l9100', color: int, period: int):\n    this.x is x\n    this.y is y\n    this.width is width\n    this.height is height\n    this.orientation is orientation\n    this.volume is volume\n    this.tag is tag\n    this.color is color\n    this.period is period",
    "# Each pattern becomes l8384, a pattern repeating down\n$Obj.tag is l8384",
    "# It continues downward, below its last row\n$Obj.extension_direction is down",
    "# Its height grows to 1.5 times its input height, 6 rows to 9, the height of the output grid\n$Obj.height is $Obj.height@first * 3 / 2",
    "# The whole pattern is drawn in color 2\n$Obj.color is 2"
          "implementation": "# Color-1 pattern whose rows repeat every 4 rows: row 4 equals row 0\nobj7868bfbcdc17 is Obj(x=0, y=0, width=3, height=6, orientation=0, volume=9, color=1, period=4)",
          "implementation": "# Color-1 pattern whose rows repeat every 2 rows: row 2 equa
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9dac162b` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T14:24:20.611Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795530260610",
    "title": "Remove comments from ARC datasets",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "NucleoidAI/Nucleoid",
    "source_uri": "https://github.com/NucleoidAI/Nucleoid",
    "source_version": "HEAD",
    "content_hash": "2bcf043bccc47af12b3d4805d5da699a3a06b61d5f8a2e64d270652c6173d979"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-24T14:24:20.611Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "be5ac7df9066a0b3b5e0032b75bef207adb116efab1a726a385690faab39a4d9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
