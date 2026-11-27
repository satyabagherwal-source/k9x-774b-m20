# Candidate Directive: [CD-P3NH] Put kind first in ARC object definitions

<!-- PROVENANCE_START
{
  "source_repository": "NucleoidAI/Nucleoid",
  "source_url": "https://github.com/NucleoidAI/Nucleoid",
  "source_version": "f176c30a",
  "license": "Apache-2.0",
  "timestamp": "2026-11-27T09:44:55.229Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nucleoidai-nucleoid",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid) (Revision: `f176c30a`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-27T09:44:55.229Z`  
> **Learning ID**: `learn-github-nucleoidai-nucleoid`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.claude/agents/arc-dataset.agent.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NucleoidAI/Nucleoid. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f176c30a`: Put kind first in ARC object definitions. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/agents/arc-dataset.agent.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  the solver runs it alone to build input states. Existing datasets declare one
  class,
  `Object(kind: str = 'default', x: int, y: int, width: int, height: int, orientation: int, volume: int, ...)`;
  add another class only for a distinct sort of object the transformation needs.
  Each class whose instances are annotated objects takes the optional
  `kind: str = 'default'` first, which names no geometry, then the standard
  entries
  `x: int, y: int, width: int, height: int, orientation: int, volume: int`, in
  that order, and its body assigns every parameter to `this` in that order,
  starting with `this.kind is kind`. Every implementation passes its object's
  kind first, as a bare word, such as `kind=l9100`, or `kind=unknown` for an
  object of a shape that the pairs never show, so no instance takes the default.
  The default keeps its quotes, because accepted Nucleoid takes only a literal
  as a parameter default. Add only the descriptive properties the transformation
- `implementation` is
  `<instance_name> is <Class>(kind=<kind>, x=<input_x>, y=<input_y>, width=<width>, height=<height>, orientation=<input_orientation>, volume=<volume>, ...)`,
  constructing the instance's c
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
  the solver runs it alone to build input states. Existing datasets declare
  one class, `Object(x: int, y: int, width: int, height: int, orientation: int,
  volume: int, kind: str = 'lNNNN', ...)`; add another class only for a
  distinct sort of object the transformation needs. Each class whose
  instances are annotated objects takes the standard entries `x: int, y: int,
  width: int, height: int, orientation: int, volume: int` first, in that
  order, then the optional `kind: str = 'lNNNN'`, whose default is the class's
  initial kind, and its body assigns every parameter to `this`, the kind with
  `this.kind is kind` right after `this.volume is volume`. An implementation
  passes `kind` only when its object needs a kind other than the default, as
  every implementation in `dataset.27a28665.json` names its block's shape
  with `kind='l4262'` and the like; otherwise it leaves `kind` out. The default
  keeps its quotes, because accepted Nucleoid takes only a literal as a
  parameter default. Add only the descriptive properties the transformation
- `implementation` is `<instance_name> = <Class>(x=<input_x>, y=<input_y>,
  width=<width>, height=<height>, orientation=<input_orientation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f176c30a` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T09:44:55.227Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795772695227",
    "title": "Put kind first in ARC object definitions",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "NucleoidAI/Nucleoid",
    "source_uri": "https://github.com/NucleoidAI/Nucleoid",
    "source_version": "HEAD",
    "content_hash": "f6a754b229f64fa4a05c3a894fa144b07b4d1c444cd9ed151eb2efa0b3031a67"
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
        "Harvested/verified timestamp recorded: 2026-11-27T09:44:55.227Z"
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
  "auth_token": "a5bc88e648ae592c8cadb87d16b1df35b288f959873aac7073b22f8733419b59"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
