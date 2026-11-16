# Candidate Directive: [CD-4P2M] resend without zero copy when a zero copy write fails

<!-- PROVENANCE_START
{
  "source_repository": "meta/folly",
  "source_url": "https://github.com/facebook/folly",
  "source_version": "f416c5d1",
  "license": "Apache-2.0",
  "timestamp": "2026-11-16T15:00:35.950Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-meta-folly",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [meta/folly](https://github.com/facebook/folly) (Revision: `f416c5d1`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-16T15:00:35.950Z`  
> **Learning ID**: `learn-github-meta-folly`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `folly/io/async/AsyncIoUringSocket.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in meta/folly. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f416c5d1`: AsyncIoUringSocket: resend without zero copy when a zero copy write fails. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `folly/io/async/AsyncIoUringSocket.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
namespace {

// Errors from a zero copy send that a copying send of the same data would
// not necessarily hit, e.g. failing to pin the pages or allocate zero copy
// state, or the socket not supporting zero copy at all.
bool isZeroCopySendError(int err) {
  switch (err) {
    case ENOMEM:
    case EOPNOTSUPP:
      return true;
    default:
      return false;
  }
}

} // namespace

  } else if (res < 0 && zcOptions_.zeroCopy && isZeroCopySendError(-res)) {
    // a failed send transmits nothing, so resend the whole message without
    // zero copy rather than failing the write. The notification for the
    // failed send still arrives and is accounted for in refs_.
    VLOG(2) << "zero copy write failed, retrying without zero copy: "
            << folly::errnoStr(-res) << " (" << res << ")";
    zcOptions_.zeroCopy = false;
    parent_->zeroCopySuspended_ = true;
    parent_->zeroCopyReenableCounter_ = parent_->zeroCopyReenableThreshold_;

    // must make inflight false even if MORE is set
    prepareForReuse();
    parent_->doReSubmitWrite();
bool AsyncIoUringSocket::canZC(std::unique_ptr<IOBuf> const& buf) {
  if (zeroCopySuspended_) {
    if (zeroCopyReenableCounter_ == 0 ||
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
bool AsyncIoUringSocket::canZC(std::unique_ptr<IOBuf> const& buf) const {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f416c5d1` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T15:00:35.948Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.71,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 71%). Source=PASS (TIER_2_OFFICIAL_ECOSYSTEM), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794841235948",
    "title": "resend without zero copy when a zero copy write fails",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "meta/folly",
    "source_uri": "https://github.com/facebook/folly",
    "source_version": "HEAD",
    "content_hash": "3b3a26f89a323a3d6072380f53c2de0aa31e56d71d36fa87c44e3fc3672fe3ad"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
  "dimensions": {
    "source_reliability": {
      "status": "PASS",
      "score": 0.75,
      "tier": "TIER_2_OFFICIAL_ECOSYSTEM",
      "findings": [],
      "details": [
        "Source belongs to recognized official ecosystem (TIER_2_OFFICIAL_ECOSYSTEM)",
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
        "Harvested/verified timestamp recorded: 2026-11-16T15:00:35.948Z"
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
  "auth_token": "d277a041ea4b0fd6ba68a0469b2c323568d930310a4c232748e5fd344bc7618f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
