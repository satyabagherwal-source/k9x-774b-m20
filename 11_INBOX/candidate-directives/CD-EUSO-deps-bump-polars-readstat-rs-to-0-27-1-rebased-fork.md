# Candidate Directive: [CD-EUSO] deps: bump polars-readstat-rs to 0.27.1 (rebased fork)

<!-- PROVENANCE_START
{
  "source_repository": "dathere-qsv-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T20:20:48.187Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-dathere-qsv-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dathere-qsv-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T20:20:48.187Z`  
> **Learning ID**: `LEARN-EVO-dathere-qsv-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in dathere/qsv. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5feb8f1e`: deps: bump polars-readstat-rs to 0.27.1 (rebased fork). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- `writestat`: numbers very close to 0 were lost without a warning. A SAS transport (`.xpt`) file wrote a non-zero number closer to 0 than ±5.4e-79 (16^-65, the smallest IBM float) as missing, or as 0 below ±2.2e-308, and `writestat` checked only the ±7.2e75 end of the range. Such numbers are now refused like the large ones, and with `--lossy` the warning names them. An SPSS portable (`.por`) file can hold them, but its writer lost precision from about 1e-56 and wrote numbers below about 4e-73 as 0 (or -0). It now writes every finite number so that it reads back exactly. The `.por` writer and reader fixes come from `polars-readstat-rs` 0.27.1 ([jrothbaum/polars_readstat@ace0caa](https://github.com/jrothbaum/polars_readstat/commit/ace0caafe6fb734ef533d7fbfcdb13148a9cda9c)), after our fix was offered upstream in [jrothbaum/polars_readstat#72](https://github.com/jrothbaum/polars_readstat/pull/72). Fixes [#5094](https://github.com/dathere/qsv/issues/5094). ([#5103](https://github.com/dathere/qsv/pull/5103), [#5121](https://github.com/dathere/qsv/pull/5121))
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
- `writestat`: numbers very close to 0 were lost without a warning. A SAS transport (`.xpt`) file wrote a non-zero number closer to 0 than ±5.4e-79 (16^-65, the smallest IBM float) as missing, or as 0 below ±2.2e-308, and `writestat` checked only the ±7.2e75 end of the range. Such numbers are now refused like the large ones, and with `--lossy` the warning names them. An SPSS portable (`.por`) file can hold them, but its writer lost precision from about 1e-56 and wrote numbers below about 4e-73 as 0 (or -0). It now writes them as a mantissa and a negative power of 30, and its reader rebuilds values below about 1e-292 without losing digits. The `.por` writer and reader fixes are in our `polars-readstat-rs` fork, [dathere/polars_readstat@18551f9](https://github.com/dathere/polars_readstat/commit/18551f90697b23e677c5e17a0fe8f03ad710d90b), also offered upstream in [jrothbaum/polars_readstat#72](https://github.com/jrothbaum/polars_readstat/pull/72). Fixes [#5094](https://github.com/dathere/qsv/issues/5094). ([#5103](https://github.com/dathere/qsv/pull/5103))
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5feb8f1e` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T20:20:48.357Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795810848357",
    "title": "deps: bump polars-readstat-rs to 0.27.1 (rebased fork)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dathere-qsv-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "5ff339d47bd706fb52f4ddfca4d40012f32e15ed231b49738b50575fcfdfbc05"
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
        "Harvested/verified timestamp recorded: 2026-11-27T20:20:48.357Z"
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
  "auth_token": "571190820aa563377c9dc19beb8fc1fcd588991daa32124c7f1cdf512c37fcc8"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
