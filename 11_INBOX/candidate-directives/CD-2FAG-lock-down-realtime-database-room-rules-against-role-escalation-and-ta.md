# Candidate Directive: [CD-2FAG] lock down realtime database room rules against role escalation and ta

<!-- PROVENANCE_START
{
  "source_repository": "AhmadHassan-BTed/Jantt",
  "source_url": "https://github.com/AhmadHassan-BTed/Jantt",
  "source_version": "49407b4a",
  "license": "MIT",
  "timestamp": "2026-11-23T07:28:37.864Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-ahmadhassan-bted-jantt",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [AhmadHassan-BTed/Jantt](https://github.com/AhmadHassan-BTed/Jantt) (Revision: `49407b4a`).  
> **License**: MIT | **Timestamp**: `2026-11-23T07:28:37.864Z`  
> **Learning ID**: `learn-github-ahmadhassan-bted-jantt`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-23T07:28:37.862Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795418917862",
    "title": "lock down realtime database room rules against role escalation and ta",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "AhmadHassan-BTed/Jantt",
    "source_uri": "https://github.com/AhmadHassan-BTed/Jantt",
    "source_version": "HEAD",
    "content_hash": "f6850d39b7a7023693e14ab0e65b561a6c72681aff2f0d3fcb4760ba36df1eed"
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
        "Harvested/verified timestamp recorded: 2026-11-23T07:28:37.862Z"
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
  "auth_token": "01af16f803efedf8c0ed26adbbef553240c5f168602863bb7989730df541fdc8"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
