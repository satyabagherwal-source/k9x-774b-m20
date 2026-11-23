# Candidate Directive: [CD-360M] [PLAT-24048] YBA: Retry SetFlagInMemory while the server restarts

<!-- PROVENANCE_START
{
  "source_repository": "yugabyte/yugabyte-db",
  "source_url": "https://github.com/yugabyte/yugabyte-db",
  "source_version": "80c1ffc3",
  "license": "NOASSERTION",
  "timestamp": "2026-11-23T18:41:03.286Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-yugabyte-yugabyte-db",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [yugabyte/yugabyte-db](https://github.com/yugabyte/yugabyte-db) (Revision: `80c1ffc3`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-23T18:41:03.286Z`  
> **Learning ID**: `learn-github-yugabyte-yugabyte-db`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8c5ff0f2` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T18:41:03.284Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795459263284",
    "title": "[PLAT-24048] YBA: Retry SetFlagInMemory while the server restarts",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "yugabyte/yugabyte-db",
    "source_uri": "https://github.com/yugabyte/yugabyte-db",
    "source_version": "HEAD",
    "content_hash": "85bdecaa2cfbbb049bbb001bf33d6f822b48a1d9667459318d14d1bc0fb5b5fa"
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
        "Harvested/verified timestamp recorded: 2026-11-23T18:41:03.284Z"
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
  "auth_token": "4f0ded268c3c74416a622e9a3da1cddfcbd3e9bff6a54f1fab9d3a3d1ed9cd9a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
