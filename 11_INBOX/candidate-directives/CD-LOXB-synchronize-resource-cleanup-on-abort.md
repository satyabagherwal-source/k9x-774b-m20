# Candidate Directive: [CD-LOXB] Synchronize resource cleanup on abort

<!-- PROVENANCE_START
{
  "source_repository": "paradedb/paradedb",
  "source_url": "https://github.com/paradedb/paradedb",
  "source_version": "3db63451",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-24T23:51:03.792Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-paradedb-paradedb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [paradedb/paradedb](https://github.com/paradedb/paradedb) (Revision: `3db63451`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-24T23:51:03.792Z`  
> **Learning ID**: `learn-github-paradedb-paradedb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
Automated regression test asserting that input states reproducing defect `3db63451` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T23:51:03.789Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795564263789",
    "title": "Synchronize resource cleanup on abort",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "paradedb/paradedb",
    "source_uri": "https://github.com/paradedb/paradedb",
    "source_version": "HEAD",
    "content_hash": "a1b18cbf8b8d568ce693c3e8d9c71ac308369c9fd1eb9e82788e856be81ad586"
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
        "Harvested/verified timestamp recorded: 2026-11-24T23:51:03.789Z"
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
  "auth_token": "953fe344abc3d85a930bb7d7fe2f4e52fbec01803e92993797ec98ed15dd2c73"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
