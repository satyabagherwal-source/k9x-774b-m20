# Candidate Directive: [CD-6OJR] resume Passport recovery after transient failure

<!-- PROVENANCE_START
{
  "source_repository": "makecindy/cindy",
  "source_url": "https://github.com/makecindy/cindy",
  "source_version": "559ad18c",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T03:44:39.111Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-makecindy-cindy",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [makecindy/cindy](https://github.com/makecindy/cindy) (Revision: `559ad18c`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T03:44:39.111Z`  
> **Learning ID**: `learn-github-makecindy-cindy`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `apps/desktop/src/main/__tests__/authColdStartRecovery.test.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in makecindy/cindy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9f9c0a86`: auth): resume Passport recovery after transient failure. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/desktop/src/main/__tests__/authColdStartRecovery.test.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
const pendingResourcePassportRecoveries = new Map();
  it.each(['runtime', 'cold-start'] as const)('resumes pending Passport recovery without replaying a dead Resource (%s)', async phase => {
    const { h } = recoverySetup();
    const fresh = phase === 'runtime' ? h : setup();
    if (phase === 'cold-start') {
      fresh.vault.resources[ORIGINAL_KEY].metadata = h.vault.resources[ORIGINAL_KEY].metadata;
      fresh.vault.passports = h.vault.passports;
    }
    fresh.deps.refreshPassportSessionSingleFlight.mockRejectedValueOnce(
      new AuthApiError('AUTH_REQUEST_FAILED', 503, 'busy', Date.now() + 180_000),
    );
    if (phase === 'runtime') await rejectAfterLoss(fresh);
    else {
      void fresh.start();
      await vi.advanceTimersByTimeAsync(1);
      fresh.request.mockResolvedValue({ ok: false, status: 401,
        data: { error: { code: 'INVALID_REFRESH_TOKEN' } } });
      await vi.advanceTimersByTimeAsync(61_250);
    }
    expect(fresh.deps.refreshPassportSessionSingleFlight).toHaveBeenCalledTimes(1);
    const resourceRequests = fresh.request.mock.calls.length;
    // A redundant refresh would now hit a transport outage and postpone Passport.
    fresh.request.mockR
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9f9c0a86` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T03:44:39.109Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795232679109",
    "title": "resume Passport recovery after transient failure",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "makecindy/cindy",
    "source_uri": "https://github.com/makecindy/cindy",
    "source_version": "HEAD",
    "content_hash": "2e7aff8581afd64364ecdc6213b41f8dbab6a5d776aa143619f728622d6dd08b"
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
        "Harvested/verified timestamp recorded: 2026-11-21T03:44:39.109Z"
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
  "auth_token": "ecfacf0cd0c17e9e7f3a1e522ec01f3c997d2d5157329e56eb4f97a722e457dc"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
