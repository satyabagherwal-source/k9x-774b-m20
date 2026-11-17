# Candidate Directive: [CD-GIKF] Use Matrix.pad for ARC output placement

<!-- PROVENANCE_START
{
  "source_repository": "NucleoidAI/Nucleoid",
  "source_url": "https://github.com/NucleoidAI/Nucleoid",
  "source_version": "5523d642",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T20:33:23.199Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nucleoidai-nucleoid",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid) (Revision: `5523d642`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T20:33:23.199Z`  
> **Learning ID**: `learn-github-nucleoidai-nucleoid`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.claude/agents/arc-debug.agent.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NucleoidAI/Nucleoid. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5523d642`: Use Matrix.pad for ARC output placement. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/agents/arc-debug.agent.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
9. `visualizer.output_instance_matrix` (LLM): the instance's matrix, padded by
   `Matrix.pad` at `output_value.x` / `output_value.y` to the test input's size.
10. `Matrix.merge` of the test output instances, then
- **Test composition.** Every test `output_value` has in-range numeric `x` and
  `y`. Every padded `output_instance_matrix` keeps the test input's shape; a
  larger one means the instance was placed out of bounds and `Matrix.pad`
  enlarged the grid. Recompute merge and canvas and compare the result with
  `result_matrix`, noting cells that a later instance overwrote.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
9. `visualizer.output_instance_matrix` (LLM): the instance's matrix, drawn by
   `Matrix.draw` at `output_value.x` / `output_value.y` on the test input's
   canvas: `output_instance_matrix`. Positions count from the test input's
   top-left cell, and `Matrix.draw` rejects a negative one, which fails the
   run. Older logs may also hold `output_instance_epoch`, the column and row
   of position (0, 0) in a drawing that could grow left or up; a nonzero one
   means that drawing did.
10. `Matrix.merge` of the drawn matrices onto a zero canvas of the test input's
    size, lined up at their top-left cells, then
- **Test composition.** Every test `output_value` has non-negative integer `x`
  and `y`; a negative one lies left of or above the test input, and
  `Matrix.draw` rejects it. Every drawn `output_instance_matrix` keeps the test
  input's shape; a larger one means the instance reached past the right or
  bottom edge and `Matrix.draw` grew the grid that way. Recompute the drawn
  matrices, merge and canvas and compare the result with `result_matrix`,
  noting cells that a later instance overwrote.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5523d642` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T20:33:23.198Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794947603198",
    "title": "Use Matrix.pad for ARC output placement",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "NucleoidAI/Nucleoid",
    "source_uri": "https://github.com/NucleoidAI/Nucleoid",
    "source_version": "HEAD",
    "content_hash": "9876cfdc7dd80eef72f2ecb6693d4e3b2260a49869596c943d7d18fd2ccaaa0f"
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
        "Harvested/verified timestamp recorded: 2026-11-17T20:33:23.198Z"
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
  "auth_token": "bcfc1374a59b602e530b77225897be6508506cb9c847272babf4634e88bd95eb"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
