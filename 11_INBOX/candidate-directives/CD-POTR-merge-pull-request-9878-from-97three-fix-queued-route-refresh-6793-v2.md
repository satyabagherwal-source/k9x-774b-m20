# Candidate Directive: [CD-POTR] Merge pull request #9878 from 97Three/fix/queued-route-refresh-6793-v2

<!-- PROVENANCE_START
{
  "source_repository": "makecindy-cindy-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T16:49:53.287Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-makecindy-cindy-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [makecindy-cindy-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T16:49:53.287Z`  
> **Learning ID**: `LEARN-EVO-makecindy-cindy-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records; DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `apps/desktop/src/main/maker-ipc/__tests__/agent-input-coordinator.test.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in makecindy/cindy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0bbf1dc8`: Merge pull request #9878 from 97Three/fix/queued-route-refresh-6793-v2. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/desktop/src/main/maker-ipc/__tests__/agent-input-coordinator.test.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
  it('refreshes a queued route and its crash snapshot after a model switch (#6793)', async () => {
    const sid = 'queued-route-switch';
    const h = createHarness();
    await h.coordinator.ensureQueueRestored(sid);
    h.setRunning(true);
    const queued = makeItem('queued', 'Send on the selected route');
    queued.createOpts.providerId = 'old-provider';
    h.coordinator.enqueue(sid, queued);
    await flush();

    h.coordinator.refreshQueuedRoute(sid, { model: 'new-model', providerId: 'new-provider' });
    const snapshot = h.persistQueueSnapshot.mock.calls.at(-1)?.[1][0];
    expect(snapshot?.createOpts).toMatchObject({ model: 'new-model', providerId: 'new-provider' });
    const restarted = createHarness();
    restarted.setLoadQueueSnapshot(async () => JSON.parse(JSON.stringify([snapshot])));
    await restarted.coordinator.ensureQueueRestored(sid);
    expect(restarted.coordinator.getQueueControlSnapshot(sid).pendingQueue[0]?.createOpts)
      .toMatchObject({ model: 'new-model', providerId: 'new-provider' });

    h.setRunning(false);
    h.coordinator.onTurnEvent(sid, 'done');
    await flush();
    expect(h.sendToAgent.mock.calls[0]?.[2]).toMatchObject({ model: 'new
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0bbf1dc8` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-13T16:49:53.387Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records; DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=FAIL, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=FAIL.",
  "item": {
    "id": "cand-1794588593387",
    "title": "Merge pull request #9878 from 97Three/fix/queued-route-refresh-6793-v2",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "makecindy-cindy-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "dc7550ab1c590a1353238f4e51d9eae8df584cea58bb5d8572323a10aeb7bedb"
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
        "Harvested/verified timestamp recorded: 2026-11-13T16:49:53.387Z"
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
    "Source provenance",
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [],
  "auth_token": "45d1bf35692355b8799403b20ca2a87852f28429f18f8b884ea937b39d2ead1a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
