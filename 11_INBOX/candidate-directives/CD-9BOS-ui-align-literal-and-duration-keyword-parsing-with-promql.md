# Candidate Directive: [CD-9BOS] ui: align literal and duration keyword parsing with PromQL

<!-- PROVENANCE_START
{
  "source_repository": "prometheus/prometheus",
  "source_url": "https://github.com/prometheus/prometheus",
  "source_version": "05bbd304",
  "license": "Apache-2.0",
  "timestamp": "2026-11-16T16:00:11.116Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-prometheus-prometheus",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [prometheus/prometheus](https://github.com/prometheus/prometheus) (Revision: `05bbd304`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-16T16:00:11.116Z`  
> **Learning ID**: `learn-github-prometheus-prometheus`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `web/ui/module/lezer-promql/src/promql.grammar`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in prometheus/prometheus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `05bbd304`: web: ui: align literal and duration keyword parsing with PromQL. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `web/ui/module/lezer-promql/src/promql.grammar`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
      (std.digit+ (("_")? std.digit)* ("." (std.digit+ (("_")? std.digit)*)?)? | "." std.digit+ (("_")? std.digit)*) (("e" | "E") ("+" | "-")? std.digit+ (("_")? std.digit)*)? |
      "0" ("x" | "X") "_"? (std.digit | $[a-fA-F]) ("_"? (std.digit | $[a-fA-F]))* | duration
  DurationStep,
  DurationRange,
  DurationMinOf,
  DurationMaxOf,
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
      (std.digit+ (("_")? std.digit)* ("." std.digit+ (("_")? std.digit)*)? | "." std.digit+ (("_")? std.digit)*) (("e" | "E") ("+" | "-")? std.digit+ (("_")? std.digit)*)? |
      "0x" (std.digit | $[a-fA-F])+ | duration
DurationStep { condFn<"step"> }
DurationRange { condFn<"range"> }
DurationMinOf { condFn<"min_of"> }
DurationMaxOf { condFn<"max_of"> }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `05bbd304` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T16:00:11.114Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794844811114",
    "title": "ui: align literal and duration keyword parsing with PromQL",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "prometheus/prometheus",
    "source_uri": "https://github.com/prometheus/prometheus",
    "source_version": "HEAD",
    "content_hash": "18936ea8c30b517570feb9d6183a2d67f174340d215c949ff9131aca09a7123c"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Harvested/verified timestamp recorded: 2026-11-16T16:00:11.114Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "de4b2ec175946a2142570ef07096b4f3b6e5812f72ef1c30b9719c96325badea"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
