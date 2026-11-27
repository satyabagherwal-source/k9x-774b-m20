# Candidate Directive: [CD-DW06] bump polars-readstat-rs to 0.27.1 (rebased fork)

<!-- PROVENANCE_START
{
  "source_repository": "dathere/qsv",
  "source_url": "https://github.com/dathere/qsv",
  "source_version": "5feb8f1e",
  "license": "NOASSERTION",
  "timestamp": "2026-11-27T20:20:03.270Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-dathere-qsv",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dathere/qsv](https://github.com/dathere/qsv) (Revision: `5feb8f1e`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-27T20:20:03.270Z`  
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
  "validated_at": "2026-11-27T20:20:03.267Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795810803267",
    "title": "bump polars-readstat-rs to 0.27.1 (rebased fork)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dathere/qsv",
    "source_uri": "https://github.com/dathere/qsv",
    "source_version": "HEAD",
    "content_hash": "9b45c6cb8c166fa15400c1833569453386e8c064a2631843557c8cffea9b7694"
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
        "Harvested/verified timestamp recorded: 2026-11-27T20:20:03.267Z"
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
  "auth_token": "57aa7d7ae31e0d1de334e1283d0603c439aaf3415451b4e2b5dd9f26f4ad79f4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
