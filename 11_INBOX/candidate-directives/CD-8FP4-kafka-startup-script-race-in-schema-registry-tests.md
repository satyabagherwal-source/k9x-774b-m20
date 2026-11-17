# Candidate Directive: [CD-8FP4] Kafka startup script race in schema registry tests

<!-- PROVENANCE_START
{
  "source_repository": "apache-pinot-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T10:11:14.584Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-apache-pinot-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [apache-pinot-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T10:11:14.584Z`  
> **Learning ID**: `LEARN-EVO-apache-pinot-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `pinot-integration-tests/src/test/java/org/apache/pinot/integration/tests/kafka/schemaregistry/SchemaRegistryStarter.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in apache/pinot. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a9192dc3`: Kafka startup script race in schema registry tests. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `pinot-integration-tests/src/test/java/org/apache/pinot/integration/tests/kafka/schemaregistry/SchemaRegistryStarter.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
import com.github.dockerjava.api.command.InspectContainerResponse;
import org.testcontainers.images.builder.Transferable;
      _kafkaContainer = new KafkaContainerWithStartupBarrier()

  /// Waits for the startup script upload to complete before executing it. Used by a single fixture startup thread.
  // Keep the existing ZooKeeper-based Confluent fixture while working around Testcontainers' startup race.
  @SuppressWarnings("deprecation")
  private static class KafkaContainerWithStartupBarrier extends KafkaContainer {
    private static final String STARTUP_READY_FILE = "/tmp/pinot_kafka_startup_ready";

    private KafkaContainerWithStartupBarrier() {
      super(KAFKA_DOCKER_IMAGE_NAME);
      withCommand("-c", "while [ ! -f " + STARTUP_READY_FILE
          + " ]; do sleep 0.1; done; exec /tmp/testcontainers_start.sh");
    }

    @Override
    protected void containerIsStarting(InspectContainerResponse containerInfo) {
      // The script becomes visible before Docker closes its write handle. Executing it then can fail with ETXTBSY.
      super.containerIsStarting(containerInfo);
      copyFileToContainer(Transferable.of(new byte[0]), STARTUP_READY_FILE);
    }
  }
```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
      _kafkaContainer = new KafkaContainer(KAFKA_DOCKER_IMAGE_NAME)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a9192dc3` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T10:11:14.677Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794910274677",
    "title": "Kafka startup script race in schema registry tests",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "apache-pinot-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "1da753e537dd9b1277eb659dd2dd7a82929a2f460c041c504ff753ad6f4856c9"
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
        "Harvested/verified timestamp recorded: 2026-11-17T10:11:14.678Z"
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
  "auth_token": "aa4335d1cd54ddae8932b36cd6828ed87c84beb566c4dfaf30efcd29eb1cf55b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
