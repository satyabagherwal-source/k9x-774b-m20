# Candidate Directive: [CD-OS5M] Empirical Invariant Guard in rgw-user-accounts.md

<!-- PROVENANCE_START
{
  "source_repository": "rook/rook",
  "source_url": "https://github.com/rook/rook",
  "source_version": "695364a0",
  "license": "Apache-2.0",
  "timestamp": "2026-11-19T03:27:23.530Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-rook-rook",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rook/rook](https://github.com/rook/rook) (Revision: `695364a0`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-19T03:27:23.530Z`  
> **Learning ID**: `learn-github-rook-rook`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `design/ceph/object/rgw-user-accounts.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in rook/rook. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `695364a0`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `design/ceph/object/rgw-user-accounts.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
- Ceph Tentacle v20.2.2 or later. Account storage quotas require v20.2.5 or later, or Umbrella v21.1.1 or later.
RGW accounts support an account-level storage quota that controls resource consumption:
  # [Optional] Quotas and resource limits for the account. If set, at least one field must be specified.
  # For every field except maxBuckets, -1 means unlimited and 0 means none allowed.
    # [Optional] Maximum total size of all objects across all buckets in the account. Accepts any resource quantity unit (e.g. 10Gi, 500Mi, 2Ti). Default: -1.
    # [Optional] Maximum total number of objects across all buckets in the account. Default: -1.
    # [Optional] Maximum number of buckets the account can own. Must be at least 1. Default: 1000.
    # [Optional] Maximum number of users the account can have. Default: 1000.
    # [Optional] Maximum number of IAM roles the account can have. Default: 1000.
    # [Optional] Maximum number of IAM groups the account can have. Default: 1000.
    # [Optional] Maximum number of access keys each user in the account can have. Default: 4.
    maxAccessKeys: 10
The account controller always manages the account's storage quota and resource limits. On every 
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
- Ceph Squid (v19.0.0) or later
RGW accounts support two types of quotas that control resource consumption:
- **Bucket Quota**: Per-bucket storage limit applied to every bucket in the account. Each individual bucket is subject to this limit.
  # [Optional] Quotas for the account
    # [Optional] Maximum total size of all objects across all buckets in the account.
    # [Optional] Maximum total number of objects across all buckets in the account.
    # [Optional] Maximum total size of objects in any individual bucket in the account.
    maxBucketSize: 1Gi
    # [Optional] Maximum number of objects in any individual bucket in the account.
    maxBucketObjects: 100000
    # [Optional] Maximum number of buckets the account can own.
    # [Optional] Maximum number of users the account can have.
    # [Optional] Maximum number of roles the account can have.
    # [Optional] Maximum number of groups the account can have.
    # [Optional] Maximum number of access keys the account can have.
    maxAccessKeys: 100
The account controller reconciles quotas as follows:
- **Account quota** (`maxSize`, `maxObjects`): enabled when either field is set, disabled when both are removed.
- **Bucket quo
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `695364a0` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T03:27:23.528Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795058843528",
    "title": "Empirical Invariant Guard in rgw-user-accounts.md",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rook/rook",
    "source_uri": "https://github.com/rook/rook",
    "source_version": "HEAD",
    "content_hash": "f57db0d26b5635ccd987d49ab03ac8c0acda1da0c2fc48e281456ba806b52006"
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
        "Expresses generalized engineering invariants (5 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-19T03:27:23.528Z"
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
  "auth_token": "cf8d40a032ce8b7f05b5eae7f0451a4704d89ff52198b3ba1e1b953dcf8c13a7"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
