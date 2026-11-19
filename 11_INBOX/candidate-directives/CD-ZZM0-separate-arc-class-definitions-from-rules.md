# Candidate Directive: [CD-ZZM0] Separate ARC class definitions from rules

<!-- PROVENANCE_START
{
  "source_repository": "nucleoidai-nucleoid-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T17:07:55.152Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-nucleoidai-nucleoid-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nucleoidai-nucleoid-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T17:07:55.152Z`  
> **Learning ID**: `LEARN-EVO-nucleoidai-nucleoid-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `arc/README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NucleoidAI/Nucleoid. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e737db35`: Separate ARC class definitions from rules. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `arc/README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
| `analyzer.declarations` | `class_declaration`, `declarations`, `output_canvas`, and each pair's `input_matrix` and `output_matrix` |
| `analyzer.instances`, `visualizer.instances` | `class_declaration`, `declarations`, and each pair's `input_matrix`, `output_matrix`, and `instances` with `input_instance_matrix` and `output_instance_matrix` |
| `analyzer.value` | `class_declaration`, and each pair's `instances` with `instance_name`, `input_instance_matrix`, and `implementation` |
| `visualizer.value` | `class_declaration`, and the instances of every pair in one list, with `implementation`, `input_value`, and `input_instance_matrix` |
The class declaration goes in `class_declaration`, a string, and
`declarations` holds the declarations that follow it.
  "class_declaration": "class Obj(x: int, y: int, width: int, height: int, orientation: int, volume: int, vertex_color: int, vertical_segment_color: int, horizontal_segment_color: int):\n    this.x is x\n    this.y is y\n    this.width is width\n    this.height is height\n    this.orientation is orientation\n    this.volume is volume\n    this.tag is l6747\n    this.vertex_color is vertex_color\n    this.vertical_segment_color is vert
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
| `analyzer.declarations` | `declarations`, `output_canvas`, and each pair's `input_matrix` and `output_matrix` |
| `analyzer.instances`, `visualizer.instances` | `declarations`, and each pair's `input_matrix`, `output_matrix`, and `instances` with `input_instance_matrix` and `output_instance_matrix` |
| `analyzer.value` | `declarations`, and each pair's `instances` with `instance_name`, `input_instance_matrix`, and `implementation` |
| `visualizer.value` | `declarations`, and the instances of every pair in one list, with `implementation`, `input_value`, and `input_instance_matrix` |
    "class Obj(x: int, y: int, width: int, height: int, orientation: int, volume: int, vertex_color: int, vertical_segment_color: int, horizontal_segment_color: int):\n    this.x is x\n    this.y is y\n    this.width is width\n    this.height is height\n    this.orientation is orientation\n    this.volume is volume\n    this.tag is l6747\n    this.vertex_color is vertex_color\n    this.vertical_segment_color is vertical_segment_color\n    this.horizontal_segment_color is horizontal_segment_color",
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e737db35` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T17:07:55.270Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795108075270",
    "title": "Separate ARC class definitions from rules",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "nucleoidai-nucleoid-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "3abac85edc0abdb96db28183b26f58a7e912c2c49fcc8444f508cfdbd13b7924"
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
        "Harvested/verified timestamp recorded: 2026-11-19T17:07:55.270Z"
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
  "auth_token": "7e05eab76cf87c2738e06de7f1e20d37afdd1af9def1c5f2375d00aec6f854b4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
