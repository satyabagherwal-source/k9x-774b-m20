# Candidate Directive: [CD-ZUWP] record replicated idempotency keys on the secondary

<!-- PROVENANCE_START
{
  "source_repository": "milvus-io/milvus",
  "source_url": "https://github.com/milvus-io/milvus",
  "source_version": "72e14334",
  "license": "Apache-2.0",
  "timestamp": "2026-11-23T23:18:25.081Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-milvus-io-milvus",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [milvus-io/milvus](https://github.com/milvus-io/milvus) (Revision: `72e14334`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-23T23:18:25.081Z`  
> **Learning ID**: `learn-github-milvus-io-milvus`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `docs/design-docs/design_docs/20260604-idempotent_write.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in milvus-io/milvus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f81b4bca`: record replicated idempotency keys on the secondary. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/design-docs/design_docs/20260604-idempotent_write.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
- Cross-cluster dedup of replicated writes. A replicated write is never deduplicated
  against the local window; it is only recorded there, so that a client retry after a
  planned switchover can reuse the result while the secondary retains the key (see
  [Replication and CDC](#replication-and-cdc)). Keys that replication had not delivered
  before a force promote are not recovered.
Replicated messages are **recorded in the window but never checked against it**.

The window is never read for a replicated message. The replicate stream has its own
and a client legally re-issued it. So a replicated message is appended unconditionally.

The window is written after the append. A replicated Insert carries the source's key and
its `idempotent_result` header; a replicated transaction carries them on its bodies and
its commit, and the interceptor merges the body results on the commit exactly as it does
for a native transaction. The recorded entry replaces an entry already held for the key:
when the source evicted the key and a client legally reused it, the newer write is the one
a retry must see. The recovery observer applies the same rule, so a window rebuilt from
Summary carries the repli
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
- Cross-cluster dedup. Replicated writes bypass the window entirely (see
  [Replication and CDC](#replication-and-cdc)).
Replicated messages **bypass the window entirely**. The replicate stream has its own
and a client legally re-issued it.

The recovery observer applies the same rule: a replicated write becomes a *keyless*
committed write in Summary, so a foreign key can never materialize a local dedup
entry. Its local WAL positions still participate in Summary persistence and
checkpoint gating.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f81b4bca` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T23:18:25.080Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795475905080",
    "title": "record replicated idempotency keys on the secondary",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "milvus-io/milvus",
    "source_uri": "https://github.com/milvus-io/milvus",
    "source_version": "HEAD",
    "content_hash": "8812f23007c63a4b962fd66deafc4e70032a51758fa69c8f8d9f09a81bc04f08"
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
        "Harvested/verified timestamp recorded: 2026-11-23T23:18:25.080Z"
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
  "auth_token": "764045ef131f5b42250a3ff25d60cb097cf398902b919293fdd243f740abb74c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
