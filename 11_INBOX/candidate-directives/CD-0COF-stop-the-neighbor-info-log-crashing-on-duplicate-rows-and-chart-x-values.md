# Candidate Directive: [CD-0COF] stop the neighbor info log crashing on duplicate rows and chart x-values

<!-- PROVENANCE_START
{
  "source_repository": "meshtastic/Meshtastic-Android",
  "source_url": "https://github.com/meshtastic/Meshtastic-Android",
  "source_version": "33098634",
  "license": "GPL-3.0",
  "timestamp": "2026-11-27T12:41:37.839Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-meshtastic-meshtastic-android",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [meshtastic/Meshtastic-Android](https://github.com/meshtastic/Meshtastic-Android) (Revision: `33098634`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-27T12:41:37.839Z`  
> **Learning ID**: `learn-github-meshtastic-meshtastic-android`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain B

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `feature/node/src/commonMain/kotlin/org/meshtastic/feature/node/model/MetricsState.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in meshtastic/Meshtastic-Android. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `41951f6c`: node): stop the neighbor info log crashing on duplicate rows and chart x-values. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `feature/node/src/commonMain/kotlin/org/meshtastic/feature/node/model/MetricsState.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
import org.meshtastic.core.model.util.TimeConstants.MS_PER_SEC
    // On our own node's page the results are every log our radio originated, so they hold our requests too.
    val reports = neighborInfoResults.filterNot { it.isOutgoingRequest() }
            reply = reports.find { it.fromRadio.packet?.decoded?.request_id == id },
    val received = reports.filter { it.uuid !in pairedReplies }.map { NeighborInfoEntry.Received(it) }
private fun MeshLog.isOutgoingRequest() =
    fromNum == MeshLog.NODE_NUM_LOCAL && fromRadio.packet?.decoded?.want_response == true

    /**
     * When the neighbor list arrived, or when the request went out if it never did, in whole seconds: the chart rejects
     * x-values finer than four decimal places.
     */
        get() = ((report ?: log).received_date / MS_PER_SEC).toDouble()
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
            reply = neighborInfoResults.find { it.fromRadio.packet?.decoded?.request_id == id },
    val received = neighborInfoResults.filter { it.uuid !in pairedReplies }.map { NeighborInfoEntry.Received(it) }
    /** When the neighbor list arrived, or when the request went out if it never did. */
        get() = (report ?: log).received_date / MS_PER_SEC_DOUBLE

private const val MS_PER_SEC_DOUBLE = 1000.0
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `41951f6c` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T12:41:37.837Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795783297837",
    "title": "stop the neighbor info log crashing on duplicate rows and chart x-values",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "meshtastic/Meshtastic-Android",
    "source_uri": "https://github.com/meshtastic/Meshtastic-Android",
    "source_version": "HEAD",
    "content_hash": "7ef8810b472fd5ef9b47b89368e0d9b2db608990dd43cb92fd698431a88945cd"
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
        "Harvested/verified timestamp recorded: 2026-11-27T12:41:37.838Z"
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
  "auth_token": "388302528454ec100d6aa72732215fee29a1889c1e1aacca4533bb04d9135064"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
