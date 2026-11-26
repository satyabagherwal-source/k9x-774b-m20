# Candidate Directive: [CD-T0R5] Allow toggling network throttler IPC via node dynamic config

<!-- PROVENANCE_START
{
  "source_repository": "ytsaurus/ytsaurus",
  "source_url": "https://github.com/ytsaurus/ytsaurus",
  "source_version": "4fc0fe7e",
  "license": "Apache-2.0",
  "timestamp": "2026-11-26T12:20:15.761Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-ytsaurus-ytsaurus",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [ytsaurus/ytsaurus](https://github.com/ytsaurus/ytsaurus) (Revision: `4fc0fe7e`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-26T12:20:15.761Z`  
> **Learning ID**: `learn-github-ytsaurus-ytsaurus`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `yt/yt/core/concurrency/fair_throttler.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in ytsaurus/ytsaurus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9981fd4e`: YT-23401: Allow toggling network throttler IPC via node dynamic config. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `yt/yt/core/concurrency/fair_throttler.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
#include <library/cpp/yt/memory/atomic_intrusive_ptr.h>

        auto sharedBucket = SharedBucket_.Acquire();
            : std::max<i64>(0, sharedBucket->Limit.GetValue());
        sharedBucket->Limit.Acquire(globalConsumed);
        auto sharedBucket = SharedBucket_.Acquire();
            : std::max<i64>(0, sharedBucket->Limit.GetValue());
        sharedBucket->Limit.Acquire(globalConsumed);
        auto sharedBucket = SharedBucket_.Acquire();
            : std::max<i64>(0, sharedBucket->Limit.GetValue());
        sharedBucket->Limit.Acquire(globalConsumed);
        auto sharedBucket = SharedBucket_.Acquire();
        auto globalAvailable = IsLimited() ? 0 : sharedBucket->Limit.GetValue();
    void SetSharedBucket(const TSharedBucketPtr& sharedBucket)
    {
        SharedBucket_.Store(sharedBucket);
    }

    TAtomicIntrusivePtr<TSharedBucket> SharedBucket_;
            GetSharedBucketValue(Ipc_)))
        IsLeader_ = !Ipc_;
        Profiler_.AddFuncGauge("/leader", MakeStrong(this), [this] {
            return IsLeader_.load();
        });
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
            : std::max<i64>(0, SharedBucket_->Limit.GetValue());
        SharedBucket_->Limit.Acquire(globalConsumed);
            : std::max<i64>(0, SharedBucket_->Limit.GetValue());
        SharedBucket_->Limit.Acquire(globalConsumed);
            : std::max<i64>(0, SharedBucket_->Limit.GetValue());
        SharedBucket_->Limit.Acquire(globalConsumed);
        auto globalAvailable = IsLimited() ? 0 : SharedBucket_->Limit.GetValue();
    const TSharedBucketPtr SharedBucket_;
            GetSharedBucketValue()))
        if (Ipc_) {
            Profiler_.AddFuncGauge("/leader", MakeStrong(this), [this] {
                return IsLeader_.load();
            });
        } else {
            IsLeader_ = true;
        }
        if (!config) {
            config = New<TFairThrottlerBucketConfig>();
        }

        if (auto it = Buckets_.find(name); it != Buckets_.end()) {
            it->second.Throttler->Update(Config_, config);

            it->second.Config = std::move(config);

            return it->second.Throttler;
        }

        auto throttler = New<TBucketThrottler>(
            Logger().WithTag("Bucket", name),
            Profiler_.WithTag("bucket", name),
            S
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9981fd4e` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T12:20:15.759Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795695615759",
    "title": "Allow toggling network throttler IPC via node dynamic config",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "ytsaurus/ytsaurus",
    "source_uri": "https://github.com/ytsaurus/ytsaurus",
    "source_version": "HEAD",
    "content_hash": "094098a69e9d5f47cb0be81f89c33c811f0a30e1e6a56a2f8e517b7cb29dc8d8"
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
        "Harvested/verified timestamp recorded: 2026-11-26T12:20:15.759Z"
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
  "auth_token": "6a5b2109b9bf02aef11fc7b892b7ef8f818f21e19e326fb650d620092dc76e90"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
