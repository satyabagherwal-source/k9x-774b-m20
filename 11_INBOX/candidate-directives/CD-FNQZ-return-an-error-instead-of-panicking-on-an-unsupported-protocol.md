# Candidate Directive: [CD-FNQZ] return an error instead of panicking on an unsupported protocol

<!-- PROVENANCE_START
{
  "source_repository": "sfu-db/connector-x",
  "source_url": "https://github.com/sfu-db/connector-x",
  "source_version": "4a7baf31",
  "license": "MIT",
  "timestamp": "2026-11-22T11:35:11.867Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-sfu-db-connector-x",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sfu-db/connector-x](https://github.com/sfu-db/connector-x) (Revision: `4a7baf31`).  
> **License**: MIT | **Timestamp**: `2026-11-22T11:35:11.867Z`  
> **Learning ID**: `learn-github-sfu-db-connector-x`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `connectorx-python/connectorx/tests/test_errors.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sfu-db/connector-x. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `fbfaeb99`: return an error instead of panicking on an unsupported protocol. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `connectorx-python/connectorx/tests/test_errors.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
"""Errors raised for bad arguments, before any database is contacted."""

import pytest

import connectorx as cx

# Nothing listens on port 1: the protocol is rejected before connecting.
POSTGRES_URL = "postgresql://user:pass@127.0.0.1:1/db"
MYSQL_URL = "mysql://user:pass@127.0.0.1:1/db"


@pytest.mark.parametrize("return_type", ["pandas", "arrow", "polars", "arrow_stream"])
def test_unsupported_postgres_protocol_raises(return_type: str) -> None:
    if return_type == "polars":
        pytest.importorskip("polars")
    with pytest.raises(
        RuntimeError, match=r'Protocol "text" is not supported for Postgres'
    ):
        cx.read_sql(POSTGRES_URL, "SELECT 1", protocol="text", return_type=return_type)


@pytest.mark.parametrize("return_type", ["pandas", "arrow"])
def test_unsupported_mysql_protocol_raises(return_type: str) -> None:
    with pytest.raises(
        RuntimeError,
        match=r'Protocol "cursor" is not supported for MySQL; supported protocols: binary, text',
    ):
        cx.read_sql(MYSQL_URL, "SELECT 1", protocol="cursor", return_type=return_type)


def test_unsupported_protocol_in_get_meta_raises() -> None:
    with pytest.raises(
        RuntimeError, matc
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `fbfaeb99` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T11:35:11.864Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795347311864",
    "title": "return an error instead of panicking on an unsupported protocol",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "sfu-db/connector-x",
    "source_uri": "https://github.com/sfu-db/connector-x",
    "source_version": "HEAD",
    "content_hash": "f3266d536050780a921ecc3047ad2166f95d4d58027dd129db769857d2624f5b"
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
        "Harvested/verified timestamp recorded: 2026-11-22T11:35:11.864Z"
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
  "auth_token": "e59ce148adc8d6e88e45e25ea4de1eb5fa63da493466c220fbd5363dbc3c2bfa"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
