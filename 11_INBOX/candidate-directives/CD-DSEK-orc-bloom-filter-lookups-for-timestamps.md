# Candidate Directive: [CD-DSEK] ORC bloom filter lookups for timestamps

<!-- PROVENANCE_START
{
  "source_repository": "trinodb-trino-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T05:54:28.615Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-trinodb-trino-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [trinodb-trino-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T05:54:28.615Z`  
> **Learning ID**: `LEARN-EVO-trinodb-trino-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `lib/trino-orc/src/main/java/io/trino/orc/TupleDomainOrcPredicate.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in trinodb/trino. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4bff3c02`: ORC bloom filter lookups for timestamps. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `lib/trino-orc/src/main/java/io/trino/orc/TupleDomainOrcPredicate.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
import static java.lang.Math.floorMod;
        if (sqlType.equals(TIMESTAMP_MILLIS) || sqlType.equals(TIMESTAMP_MICROS)) {
            long epochMicros = ((Number) predicateValue).longValue();
            long epochMillis = floorDiv(epochMicros, MICROSECONDS_PER_MILLISECOND);
            boolean onMillisecondBoundary = floorMod(epochMicros, MICROSECONDS_PER_MILLISECOND) == 0;
            return testMillisOrPreviousOnBoundary(bloomFilter, epochMillis, onMillisecondBoundary);
            return testMillisOrPreviousOnBoundary(bloomFilter, unpackMillisUtc(((Number) predicateValue).longValue()), true);
        if (sqlType.equals(TIMESTAMP_TZ_MICROS)) {
            LongTimestampWithTimeZone timestamp = (LongTimestampWithTimeZone) predicateValue;
            return testMillisOrPreviousOnBoundary(bloomFilter, timestamp.getEpochMillis(), timestamp.getPicosOfMilli() == 0);
        }
        if (sqlType.equals(TIMESTAMP_TZ_NANOS)) {
    // Reads below nanosecond precision round half up, so a value on a millisecond boundary may be stored under the previous millisecond
    private static boolean testMillisOrPreviousOnBoundary(BloomFilter bloomFilter, long epochMillis, boolean onMillisecondBound
```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
        if (sqlType.equals(TIMESTAMP_MILLIS)) {
            return bloomFilter.testLong(((Number) predicateValue).longValue());
        }
        if (sqlType.equals(TIMESTAMP_MICROS)) {
            return bloomFilter.testLong(floorDiv(((Number) predicateValue).longValue(), MICROSECONDS_PER_MILLISECOND));
            return bloomFilter.testLong(unpackMillisUtc(((Number) predicateValue).longValue()));
        if (sqlType.equals(TIMESTAMP_TZ_MICROS) || sqlType.equals(TIMESTAMP_TZ_NANOS)) {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4bff3c02` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T05:54:28.745Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795154068745",
    "title": "ORC bloom filter lookups for timestamps",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "trinodb-trino-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "ea18bea0cfe3c3ed61459eec1e35d61a0c09f4c6e5d3d5cf23a65614cb47e122"
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
        "Harvested/verified timestamp recorded: 2026-11-20T05:54:28.746Z"
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
  "auth_token": "a97d9e52d3d699646c2ea84471a6af6cabc8c0713f08cd41bf2b48a7f8bd2f7c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
