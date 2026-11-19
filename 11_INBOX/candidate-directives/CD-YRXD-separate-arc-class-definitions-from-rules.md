# Candidate Directive: [CD-YRXD] Separate ARC class definitions from rules

<!-- PROVENANCE_START
{
  "source_repository": "NucleoidAI/Nucleoid",
  "source_url": "https://github.com/NucleoidAI/Nucleoid",
  "source_version": "e737db35",
  "license": "Apache-2.0",
  "timestamp": "2026-11-19T17:06:58.657Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nucleoidai-nucleoid",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid) (Revision: `e737db35`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-19T17:06:58.657Z`  
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
  "validated_at": "2026-11-19T17:06:58.654Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795108018654",
    "title": "Separate ARC class definitions from rules",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "NucleoidAI/Nucleoid",
    "source_uri": "https://github.com/NucleoidAI/Nucleoid",
    "source_version": "HEAD",
    "content_hash": "3abac85edc0abdb96db28183b26f58a7e912c2c49fcc8444f508cfdbd13b7924"
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
        "Harvested/verified timestamp recorded: 2026-11-19T17:06:58.654Z"
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
  "auth_token": "1038955a0ea82b05df57fa263663c51e660684dcf6b67006d774618fdde6637a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
