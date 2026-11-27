# Candidate Directive: [CD-70WW] Create partition page builders on first use

<!-- PROVENANCE_START
{
  "source_repository": "trinodb/trino",
  "source_url": "https://github.com/trinodb/trino",
  "source_version": "1a278de9",
  "license": "Apache-2.0",
  "timestamp": "2026-11-27T23:30:40.352Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-trinodb-trino",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [trinodb/trino](https://github.com/trinodb/trino) (Revision: `1a278de9`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-27T23:30:40.352Z`  
> **Learning ID**: `learn-github-trinodb-trino`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `core/trino-main/src/main/java/io/trino/operator/output/PagePartitioner.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in trinodb/trino. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5d1c3146`: Create partition page builders on first use. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `core/trino-main/src/main/java/io/trino/operator/output/PagePartitioner.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
import com.google.common.collect.ImmutableList;
import static java.lang.Math.clamp;
    private final List<Type> sourceTypes;
    private final PositionsAppenderFactory positionsAppenderFactory;
    private final int maxPageSizeInBytes;
    // A partition has no page builder until it receives its first row.
        this.sourceTypes = ImmutableList.copyOf(requireNonNull(sourceTypes, "sourceTypes is null"));
        this.positionsAppenderFactory = requireNonNull(positionsAppenderFactory, "positionsAppenderFactory is null");
        this.maxPageSizeInBytes = clamp(maxMemory.toBytes() / partitionCount, 1, DEFAULT_MAX_PAGE_SIZE_IN_BYTES);
    private PositionsAppenderPageBuilder getOrCreatePageBuilder(int partition)
    {
        PositionsAppenderPageBuilder pageBuilder = positionsAppenders[partition];
        if (pageBuilder == null) {
            pageBuilder = PositionsAppenderPageBuilder.withMaxPageSize(maxPageSizeInBytes, sourceTypes, positionsAppenderFactory);
            positionsAppenders[partition] = pageBuilder;
        }
        return pageBuilder;
    }

            getOrCreatePageBuilder(0).appendToOutputPartition(page);
            if (positionsAppender == null) {
         
```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
import static java.lang.Math.max;
import static java.lang.Math.toIntExact;
        requireNonNull(positionsAppenderFactory, "positionsAppenderFactory is null");
        int pageSize = toIntExact(min(DEFAULT_MAX_PAGE_SIZE_IN_BYTES, maxMemory.toBytes() / partitionCount));
        pageSize = max(1, pageSize);

        for (int i = 0; i < partitionCount; i++) {
            positionsAppenders[i] = PositionsAppenderPageBuilder.withMaxPageSize(pageSize, requireNonNull(sourceTypes, "sourceTypes is null"), positionsAppenderFactory);
        }
            positionsAppenders[0].appendToOutputPartition(page);
            for (PositionsAppenderPageBuilder pageBuilder : positionsAppenders) {
                pageBuilder.appendToOutputPartiti
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5d1c3146` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T23:30:40.351Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795822240351",
    "title": "Create partition page builders on first use",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "trinodb/trino",
    "source_uri": "https://github.com/trinodb/trino",
    "source_version": "HEAD",
    "content_hash": "91f4f497e43ea019c624b976062c22f0d742ebfbfe53db6f8f657b5a2c49b7f5"
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
        "Harvested/verified timestamp recorded: 2026-11-27T23:30:40.351Z"
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
  "auth_token": "1a606240787bc014bf74f585fed55ef091bf2a89e69f6471b03ff4812d4e0bc5"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
