# Candidate Directive: [CD-A62Y] :bug: Add WS pause gating, inbound business queue budget, and extension heartbea

<!-- PROVENANCE_START
{
  "source_repository": "CrossPaste/crosspaste-desktop",
  "source_url": "https://github.com/CrossPaste/crosspaste-desktop",
  "source_version": "9498f76d",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-25T02:02:04.234Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-crosspaste-crosspaste-desktop",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [CrossPaste/crosspaste-desktop](https://github.com/CrossPaste/crosspaste-desktop) (Revision: `9498f76d`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-25T02:02:04.234Z`  
> **Learning ID**: `learn-github-crosspaste-crosspaste-desktop`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain C

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `app/src/commonMain/kotlin/com/crosspaste/net/routing/WsRouting.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in CrossPaste/crosspaste-desktop. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9498f76d`: :bug: Add WS pause gating, inbound business queue budget, and extension heartbeat_ack support. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `app/src/commonMain/kotlin/com/crosspaste/net/routing/WsRouting.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
        if (!wsSessionManager.isAcceptingSessions()) {
            logger.info { "WS connection rejected: $appInstanceId while session manager paused" }
            close(CloseReason(CloseReason.Codes.GOING_AWAY, "Session manager paused"))
            return@webSocket
        }

        if (!wsSessionManager.registerSession(appInstanceId, wsSession)) {
            return@webSocket
        }
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
        wsSessionManager.registerSession(appInstanceId, wsSession)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9498f76d` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T02:02:04.232Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795572124232",
    "title": ":bug: Add WS pause gating, inbound business queue budget, and extension heartbea",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "CrossPaste/crosspaste-desktop",
    "source_uri": "https://github.com/CrossPaste/crosspaste-desktop",
    "source_version": "HEAD",
    "content_hash": "58fdb246dc03bb87de09eecacc18782764bf2f1aad1e1eef1ca0f9129730b9ca"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-25T02:02:04.232Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "8dafa7e04a16527229ba7e8c287a7efcee0e615fcb4dd788b159c4fa71979bc9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
