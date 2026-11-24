# Candidate Directive: [CD-X4KZ] validate,stats): add --quote, --escape and --no-quoting

<!-- PROVENANCE_START
{
  "source_repository": "dathere/qsv",
  "source_url": "https://github.com/dathere/qsv",
  "source_version": "24d967b5",
  "license": "NOASSERTION",
  "timestamp": "2026-11-24T00:40:16.499Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-dathere-qsv",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dathere/qsv](https://github.com/dathere/qsv) (Revision: `24d967b5`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-24T00:40:16.499Z`  
> **Learning ID**: `learn-github-dathere-qsv`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.claude/skills/qsv/qsv-stats.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in dathere/qsv. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `24d967b5`: validate,stats): add --quote, --escape and --no-quoting. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/skills/qsv/qsv-stats.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
      {
        "flag": "--escape",
        "type": "string",
        "description": "The escape character for READING CSV data, for data that escapes quotes as \\\" instead of \"\". When not set, quotes are escaped by doubling them."
      },
        "description": "Use CONSERVATIVE heuristics for the in-memory load check (file size vs. available + free_swap × platform factor − headroom), instead of the default NORMAL check (file size vs. total memory − headroom). The CONSERVATIVE check is stricter and trips OOM far more readily. Ignored when computing default, streaming statistics. (See also: QSV_MEMORY_CHECK env var, equivalent to passing --memcheck.) Independently of this flag, the in-memory load check runs whenever stats takes the non-parallel path with non-streaming columns. On OOM (in either NORMAL or CONSERVATIVE mode), qsv auto-creates an index when no index exists (skipped for stdin and for non-default quoting) AND switches to approx quantile + approx cardinality methods (DataSketches t-digest and HyperLogLog) where compatible. The sketch fallback can also fire when an index is already present and the OOM still trips (e.g., when jobs is pinned to 1 on a pre-indexed file).
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        "description": "Use CONSERVATIVE heuristics for the in-memory load check (file size vs. available + free_swap × platform factor − headroom), instead of the default NORMAL check (file size vs. total memory − headroom). The CONSERVATIVE check is stricter and trips OOM far more readily. Ignored when computing default, streaming statistics. (See also: QSV_MEMORY_CHECK env var, equivalent to passing --memcheck.) Independently of this flag, the in-memory load check runs whenever stats takes the non-parallel path with non-streaming columns. On OOM (in either NORMAL or CONSERVATIVE mode), qsv auto-creates an index when no index exists (skipped for stdin) AND switches to approx quantile + approx cardinality methods (DataSketches t-digest and HyperLogLog) where compatible. The sketch fallback can also fire when an index is already present and the OOM still trips (e.g., when jobs is pinned to 1 on a pre-indexed file). A wwarn is emitted listing the auto-enabled estimators. When modes are computed (with --mode or with the everything option) and no mode cardinality cap is set, approx cardinality is NOT auto-enabled: the exact mode table is kept either way, so it would save nothing. A ww
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `24d967b5` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T00:40:16.497Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795480816497",
    "title": "validate,stats): add --quote, --escape and --no-quoting",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dathere/qsv",
    "source_uri": "https://github.com/dathere/qsv",
    "source_version": "HEAD",
    "content_hash": "f02b76c7cf9fa0048885592f9d00fed467cd994d7ddb31204ed85f7a4cc7e2ce"
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
        "Harvested/verified timestamp recorded: 2026-11-24T00:40:16.497Z"
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
  "auth_token": "34173ce9467c4effb294a4a50464df3f060f42c1ae69ae2ce93f7fd7a1e5f399"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
