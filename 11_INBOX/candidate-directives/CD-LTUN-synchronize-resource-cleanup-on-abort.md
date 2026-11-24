# Candidate Directive: [CD-LTUN] Synchronize resource cleanup on abort

<!-- PROVENANCE_START
{
  "source_repository": "paradedb-paradedb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T23:51:10.020Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-paradedb-paradedb-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [paradedb-paradedb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T23:51:10.020Z`  
> **Learning ID**: `LEARN-EVO-paradedb-paradedb-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/scripts/check_impl_drop.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in paradedb/paradedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3db63451`: Synchronize resource cleanup on abort. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/scripts/check_impl_drop.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
`impl_safe_drop!`, or any direct `IsTransactionState()` call inside `impl_safe_drop!` that does
not say why it skips `ResourceOwnerStamp`.
words: "We intentionally do NOT use `impl_safe_drop!` here because ...".

Inside `impl_safe_drop!`, checking `IsTransactionState()` alone is not enough when a scan state
lives in a `MemoryContext` whose `ResourceOwner` has already been released (#7609); wrappers
should gate cleanup with `ResourceOwnerStamp` from common/src/postgres/resowner.rs, or opt out
directly above the call with "We intentionally call `IsTransactionState()` here because ...".
Every workspace crate that depends on `pgrx` is scanned.
SAFE_DROP_START = re.compile(r"^[ \t]*(?:[A-Za-z0-9_]+::)*impl_safe_drop!\s*\(")
IS_TX_STATE = re.compile(r"\bIsTransactionState\s*\(")
STRING_LITERAL = re.compile(r'"(?:\\.|[^"\\])*"')
TX_STATE_OVERRIDE = re.compile(
    r"\bnot\s+us(?:e|ing)\W+ResourceOwnerStamp\b|\bintentionally\b.*\bIsTransactionState\b",
    re.IGNORECASE,
)
    (
        "crate::impl_safe_drop!(Foo, |self| {\n    if unsafe { IsTransactionState() } {}\n});",
        1,
    ),
    (
        (
            "crate::impl_safe_drop!([T] Foo<T>, |self| {\n"
            "    // TODO
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
`impl_safe_drop!`.
words: "We intentionally do NOT use `impl_safe_drop!` here because ...". Every workspace crate
that depends on `pgrx` is scanned.
    """Return (line, header) for every unexcused `impl Drop` or `DropGuard`."""
```

**VERIFICATION METHOD**:

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T23:51:10.174Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795564270174",
    "title": "Synchronize resource cleanup on abort",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "paradedb-paradedb-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "74399f1820f2bb495bdd3439dfc953a9ec9d8f9b0085e74b03bd62a1534624d4"
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
        "Harvested/verified timestamp recorded: 2026-11-24T23:51:10.174Z"
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
  "auth_token": "06327375da09b2510c6f482539ce588c4aba31d1f1a861147bd309493131670c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
