# Candidate Directive: [CD-C89B] ordered relationship members keep their own blanks

<!-- PROVENANCE_START
{
  "source_repository": "dathere/qsv",
  "source_url": "https://github.com/dathere/qsv",
  "source_version": "1d985194",
  "license": "NOASSERTION",
  "timestamp": "2026-11-21T20:36:44.111Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-dathere-qsv",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dathere/qsv](https://github.com/dathere/qsv) (Revision: `1d985194`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-21T20:36:44.111Z`  
> **Learning ID**: `learn-github-dathere-qsv`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in dathere/qsv. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1d985194`: synthesize): ordered relationship members keep their own blanks. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- `synthesize`: new `--discover-relationships <file>` finds `joint`, `correlated` and `ordered` groups in the source, uses them in the same run, and writes them, each with a score, to `<file>` for review. `<file>` is the `--dictionary` (or the `--infer-content-type` dictionary, or `{"fields": []}` without one) with the groups appended to its `relationships`, so a rerun with `--dictionary <file>` writes the same bytes, as does a `--model` saved from the run. Relationships the dictionary declares win, and discovery leaves their columns alone. Pairs score by bias-corrected Cramér's V for `joint` (raw V is near 1 for any many-valued column) and by Spearman's rho for `correlated` (numeric columns) and `ordered` (dates), at 0.7 or more. Only columns that would sample an enumerated pool of 2 to 50 values can join a `joint` group, and it must keep 80% of rows in tuples seen at least `--min-count` times. An `ordered` pair also needs the later date to come first in at most 1% of the sampled rows holding both (the fit clamps those, as for a declared group), overlapping ranges, and the same dictionary date format, or none on either (it writes every member in its anchor's format). Columns with 
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
- `synthesize`: new `--discover-relationships <file>` finds `joint`, `correlated` and `ordered` groups in the source, uses them in the same run, and writes them, each with a score, to `<file>` for review. `<file>` is the `--dictionary` (or the `--infer-content-type` dictionary, or `{"fields": []}` without one) with the groups appended to its `relationships`, so a rerun with `--dictionary <file>` writes the same bytes, as does a `--model` saved from the run. Relationships the dictionary declares win, and discovery leaves their columns alone. Pairs score by bias-corrected Cramér's V for `joint` (raw V is near 1 for any many-valued column) and by Spearman's rho for `correlated` (numeric columns) and `ordered` (dates), at 0.7 or more. Only columns that would sample an enumerated pool of 2 to 50 values can join a `joint` group, and it must keep 80% of rows in tuples seen at least `--min-count` times. An `ordered` pair also needs the later date to come first in at most 1% of the sampled rows holding both (the fit clamps those, as for a declared group), overlapping ranges, one blank and not the other in at most 5% of the sampled rows, and blank rates over the whole input within 5 percenta
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1d985194` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T20:36:44.109Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795293404109",
    "title": "ordered relationship members keep their own blanks",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dathere/qsv",
    "source_uri": "https://github.com/dathere/qsv",
    "source_version": "HEAD",
    "content_hash": "c97fea19916892e0b3579cd882dd5711f74712dcc5a746da86a38defa1f4074e"
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
        "Harvested/verified timestamp recorded: 2026-11-21T20:36:44.109Z"
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
  "auth_token": "f7144b74d907e0749c7b29716397587f09a6322abe66f823b85bdd41d75f23bf"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
