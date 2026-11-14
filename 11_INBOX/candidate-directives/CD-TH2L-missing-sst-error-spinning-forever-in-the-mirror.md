# Candidate Directive: [CD-TH2L] missing SST error spinning forever in the mirror

<!-- PROVENANCE_START
{
  "source_repository": "slatedb/slatedb",
  "source_url": "https://github.com/slatedb/slatedb",
  "source_version": "0a6a032b",
  "license": "Apache-2.0",
  "timestamp": "2026-11-14T11:04:34.989Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-slatedb-slatedb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [slatedb/slatedb](https://github.com/slatedb/slatedb) (Revision: `0a6a032b`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-14T11:04:34.989Z`  
> **Learning ID**: `learn-github-slatedb-slatedb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `rfcs/0034-local-object-mirroring.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in slatedb/slatedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3e3043c3`: missing SST error spinning forever in the mirror. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `rfcs/0034-local-object-mirroring.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- **Reads.** The mirror returns `MirrorError::Policy`, with the policy's error
  as its source. This error can come from a different object than the one
  that the caller read. For example, `observe` of a manifest fails with
  `NotFound` when an SST that the manifest references is missing. If the
  mirror returned that `NotFound` unchanged, the caller would think that the
  manifest is missing. `Policy` is not retryable, because the mirror already
  retried the remote calls in `observe`. Nothing was written, so the caller
  can safely read the object again, and that read runs `observe` again.
- **Writes.** The mirror returns `MirrorError::WriteCommitted`. The object is
  durable, but the policy's follow-up work didn't finish, so the caller has to
  treat the write as having happened. SlateDB treats it as fatal: `Db` and the
  compactor close with a `Data` error, the same as local disk errors. On reopen,
  the manifest is read again and `observe` runs again.
- An `observe` error on a read becomes `MirrorError::Policy`. Before, the
  mirror returned it unchanged, so a missing SST looked like a missing
  manifest ([#2255](https://github.com/slatedb/slatedb/issues/2255)).
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
- **Reads.** The error goes to the caller. Nothing was committed, so a caller
  that retries the read runs `observe` again.
- **Writes.** The mirror returns `WriteCommitted`. The object is durable, but
  the policy's follow-up work didn't finish, so the caller has to treat the
  write as having happened. SlateDB treats it as fatal: `Db` and the compactor
  close with a `Data` error, the same as local disk errors. On reopen, the
  manifest is read again and `observe` runs again.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3e3043c3` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T11:04:34.986Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794654274986",
    "title": "missing SST error spinning forever in the mirror",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "slatedb/slatedb",
    "source_uri": "https://github.com/slatedb/slatedb",
    "source_version": "HEAD",
    "content_hash": "a84bac91c2f31f0357d8f3d0edcfc51b6a0f80c6eefac520ef92938557484abe"
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
        "Harvested/verified timestamp recorded: 2026-11-14T11:04:34.987Z"
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
  "auth_token": "98bbc0d70b6e909a54c84bc4cfb3fbf6708197e03a1ad10e5a07c34803259e02"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
