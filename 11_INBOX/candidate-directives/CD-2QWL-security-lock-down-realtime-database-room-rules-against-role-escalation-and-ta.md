# Candidate Directive: [CD-2QWL] security): lock down realtime database room rules against role escalation and ta

<!-- PROVENANCE_START
{
  "source_repository": "ahmadhassan-bted-jantt-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-23T07:28:52.784Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-ahmadhassan-bted-jantt-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [ahmadhassan-bted-jantt-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-23T07:28:52.784Z`  
> **Learning ID**: `LEARN-EVO-ahmadhassan-bted-jantt-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `database.rules.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in AhmadHassan-BTed/Jantt. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `52ec345e`: security): lock down realtime database room rules against role escalation and takeover. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `database.rules.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
          "$roomId": {
            ".write": "auth != null && (auth.uid === $uid || root.child('rooms').child($roomId).child('meta/ownerUid').val() === auth.uid || root.child('rooms').child($roomId).child('members/' + auth.uid + '/role').val() === 'owner')"
          }
        ".write": "auth != null && ((!data.exists() && newData.child('meta/ownerUid').val() === auth.uid) || data.child('meta/ownerUid').val() === auth.uid || (data.child('members/' + auth.uid + '/role').val() === 'editor' && (!newData.exists() ? false : (newData.child('members').val() === data.child('members').val() && (!data.child('teams').exists() || newData.child('teams').val() === data.child('teams').val()) && newData.child('meta/ownerUid').val() === data.child('meta/ownerUid').val()))))",
          ".write": "auth != null && ((!data.exists() && newData.child('ownerUid').val() === auth.uid) || data.child('ownerUid').val() === auth.uid || (data.parent().child('members/' + auth.uid + '/role').val() === 'editor' && newData.child('ownerUid').val() === data.child('ownerUid').val() && (!data.child('secretKey').exists() || newData.child('secretKey').val() === data.child('secretKey').val())))",
          "ownerUid": {
 
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
          ".write": "auth != null"
        ".write": "auth != null && (!data.exists() && newData.child('meta/ownerUid').val() === auth.uid || data.child('meta/ownerUid').val() === auth.uid || data.child('members/' + auth.uid + '/role').val() === 'owner' || data.child('members/' + auth.uid + '/role').val() === 'editor')",
          ".write": "auth != null && (!data.exists() || data.parent().child('meta/ownerUid').val() === auth.uid || data.parent().child('members/' + auth.uid + '/role').val() === 'editor')"
            ".write": "auth != null && (!data.parent().parent().exists() || data.parent().parent().child('meta/ownerUid').val() === auth.uid || auth.uid === $memberUid)"
          ".write": "auth != null && (!data.parent().exists() || data.parent().child('meta/ownerUid').val() === auth.uid || data.parent().child('members/' + auth.uid + '/role').val() === 'editor')"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `52ec345e` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T07:28:52.912Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795418932911",
    "title": "security): lock down realtime database room rules against role escalation and ta",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "ahmadhassan-bted-jantt-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "869c7c29f333be7ca2def51468db4fd03a4e53f036cfa6a4370067f7f297c828"
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
        "Harvested/verified timestamp recorded: 2026-11-23T07:28:52.912Z"
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
    "Source provenance",
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [],
  "auth_token": "e391e466d70af94a89eded1bb10c101a70155b5aac911fe91a35f6dc4d9d22f3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
