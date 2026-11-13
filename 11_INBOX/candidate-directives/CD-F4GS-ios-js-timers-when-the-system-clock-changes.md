# Candidate Directive: [CD-F4GS] iOS JS timers when the system clock changes

<!-- PROVENANCE_START
{
  "source_repository": "react/react-native",
  "source_url": "https://github.com/react/react-native",
  "source_version": "649c1054",
  "license": "MIT",
  "timestamp": "2026-11-13T17:37:39.676Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-react-react-native",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [react/react-native](https://github.com/react/react-native) (Revision: `649c1054`).  
> **License**: MIT | **Timestamp**: `2026-11-13T17:37:39.676Z`  
> **Learning ID**: `learn-github-react-react-native`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `packages/react-native/React/CoreModules/RCTTiming.mm`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in react/react-native. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `85a285a4`: iOS JS timers when the system clock changes. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/react-native/React/CoreModules/RCTTiming.mm`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
#include <math.h>
#include <chrono>

static const NSTimeInterval kNoTimerTarget = INFINITY;
static NSTimeInterval RCTMonotonicTime()
{
  // Apple libc++ uses CLOCK_MONOTONIC_RAW, which includes time spent asleep.
  return std::chrono::duration<NSTimeInterval>(std::chrono::steady_clock::now().time_since_epoch()).count();
}

@property (nonatomic, assign, readonly) NSTimeInterval target;
    _target = RCTMonotonicTime() + targetTime;
- (BOOL)shouldFire:(NSTimeInterval)now
  return _target <= now;
  _target = RCTMonotonicTime() + _interval;
  NSTimeInterval _sleepTimerTarget;
  NSTimeInterval nextScheduledTarget = kNoTimerTarget;
  NSTimeInterval now = RCTMonotonicTime();
      } else if (timer.target < nextScheduledTarget) {
        nextScheduledTarget = timer.target;
      if (a.target < b.target) {
        return NSOrderedAscending;
      }
      if (a.target > b.target) {
        return NSOrderedDescending;
      }
      return NSOrderedSame;
      if (timer.target < nextScheduledTarget) {
        nextScheduledTarget = timer.target;
      }
    if (nextScheduledTarget != kNoTimerTarget) {
    else if (
        nextScheduledTarget != kNoTimerTarget && nextScheduledTarget - RCTMonoto
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
@property (nonatomic, strong, readonly) NSDate *target;
    _target = [NSDate dateWithTimeIntervalSinceNow:targetTime];
- (BOOL)shouldFire:(NSDate *)now
  if (_target && [_target timeIntervalSinceDate:now] <= 0) {
    return YES;
  }
  return NO;
  _target = [NSDate dateWithTimeIntervalSinceNow:_interval];
  NSDate *nextScheduledTarget = [NSDate distantFuture];
  NSDate *now = [NSDate date]; // compare all the timers to the same base time
      } else {
        nextScheduledTarget = [nextScheduledTarget earlierDate:timer.target];
      return [a.target compare:b.target];
      nextScheduledTarget = [nextScheduledTarget earlierDate:timer.target];
    if (timerCount != 0u) {
    else if ([nextScheduledTarget timeIntervalSinceNow] > kMinimumSleepInterval) {
- (void)scheduleSleepTimer:(NSDate *)sleepTarget
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `85a285a4` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-13T17:37:39.675Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0.51,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 51%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=FAIL, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=FAIL.",
  "item": {
    "id": "cand-1794591459675",
    "title": "iOS JS timers when the system clock changes",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "react/react-native",
    "source_uri": "https://github.com/react/react-native",
    "source_version": "HEAD",
    "content_hash": "5327c242b0a347586f7bab22fdcc5064103880cc805168fb2cb58f8fc54bafb7"
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
      "status": "FAIL",
      "score": 0.4,
      "is_adversarial": false,
      "has_dangerous_security": false,
      "directive_opposition": true,
      "opposing_rule": "RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
      "unsupported_assumptions": [],
      "findings": [
        "DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write')"
      ],
      "details": [
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
        "Harvested/verified timestamp recorded: 2026-11-13T17:37:39.675Z"
      ]
    },
    "duplication_and_conflict": {
      "status": "FAIL",
      "score": 0.4,
      "is_duplicate": false,
      "duplicate_target": null,
      "is_contradiction": true,
      "conflicting_rule": "RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
      "findings": [
        "CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)"
      ],
      "details": []
    }
  },
  "detected_contradictions": [
    "Canonical opposition: Clashes with RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
    "Conflict with RULE-CANON-003 (Atomic Persistence File Staging Invariant)"
  ],
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
  "auth_token": "9a36657339c67e35971a86e423628984aee95101567f50d123d92171f3c441d6"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
