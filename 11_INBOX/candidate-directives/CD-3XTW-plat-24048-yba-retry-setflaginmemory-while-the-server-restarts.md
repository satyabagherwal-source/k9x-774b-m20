# Candidate Directive: [CD-3XTW] [PLAT-24048] YBA: Retry SetFlagInMemory while the server restarts

<!-- PROVENANCE_START
{
  "source_repository": "yugabyte-yugabyte-db-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-23T18:41:39.212Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-yugabyte-yugabyte-db-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [yugabyte-yugabyte-db-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-23T18:41:39.212Z`  
> **Learning ID**: `LEARN-EVO-yugabyte-yugabyte-db-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `managed/src/main/java/com/yugabyte/yw/commissioner/tasks/subtasks/SetFlagInMemory.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in yugabyte/yugabyte-db. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8c5ff0f2`: [PLAT-24048] YBA: Retry SetFlagInMemory while the server restarts. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C data structures, boundary deserialization, API parsing, or resource lifecycles matching `managed/src/main/java/com/yugabyte/yw/commissioner/tasks/subtasks/SetFlagInMemory.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c
// Verified production-grade fix pattern:
import java.time.Duration;
  private static final Duration RETRY_DELAY = Duration.ofSeconds(5);

  // Whether a failed setFlag RPC is retried, and until when.
  private boolean retryRpcFailures;
  private long retryDeadlineMs;

    retryDeadlineMs = System.currentTimeMillis() + retryTimeout().toMillis();
      // A K8s pod can restart at any time, e.g. when the cluster autoscaler moves it, and comes
      // back on its own; a VM server that is down usually does not. A best-effort push is often
      // to a server that is down for good. VM callers that push best effort without ignoreErrors
      // (master failover) rely on the first failure, so they must not wait either.
      retryRpcFailures = !taskParams().ignoreErrors && Util.isKubernetesBasedUniverse(universe);
  // Package-private so tests can stub the timeout and the wait.
  Duration retryTimeout() {
    return config.getDuration("yb.wait_for_server_timeout");
  }

  void waitBeforeRetry(Duration delay) {
    waitFor(delay);
  }

    boolean setSuccess;
    while (true) {
      try {
        setSuccess = client.setFlag(hp, gflag, value, taskParams().force);
        break;
      } catch (Exception e) {
        // A server t
```

**NEGATIVE CONSTRAINT**:
```c
// Induced defect failure mode:
    boolean setSuccess = client.setFlag(hp, gflag, value, taskParams().force);
```

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T18:41:39.330Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795459299330",
    "title": "[PLAT-24048] YBA: Retry SetFlagInMemory while the server restarts",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "yugabyte-yugabyte-db-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "167a3021f86868b2821b527b352ac9e493b28ea2186dcbc6525430566ddae8d9"
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
        "Harvested/verified timestamp recorded: 2026-11-23T18:41:39.331Z"
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
  "auth_token": "3ed40f9d2f8a25029c2ed1ddb25447eee7c06d9df5c6e27f155efe15c6b00080"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
