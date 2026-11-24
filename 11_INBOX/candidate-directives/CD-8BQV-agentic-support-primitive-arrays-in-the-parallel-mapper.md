# Candidate Directive: [CD-8BQV] agentic): support primitive arrays in the parallel mapper

<!-- PROVENANCE_START
{
  "source_repository": "langchain4j-langchain4j-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T02:12:57.716Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-langchain4j-langchain4j-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [langchain4j-langchain4j-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T02:12:57.716Z`  
> **Learning ID**: `LEARN-EVO-langchain4j-langchain4j-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `langchain4j-agentic/src/main/java/dev/langchain4j/agentic/workflow/impl/ParallelMapperPlanner.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in langchain4j/langchain4j. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `fc45d349`: agentic): support primitive arrays in the parallel mapper. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `langchain4j-agentic/src/main/java/dev/langchain4j/agentic/workflow/impl/ParallelMapperPlanner.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
import java.lang.reflect.Array;
    private final Class<?> arrayClass;
        this(itemsProvider, isArrayResult ? arrayclass : null);
    }

    /**
     * @param itemsProvider the name of the state holding the items to map
     * @param arrayClass the type of the array to return the results in, which can be an array of a primitive type,
     *        like {@code int[]}, or {@code null} to return them in a list
     */
    public ParallelMapperPlanner(String itemsProvider, Class<?> arrayClass) {
        this.isArrayResult = arrayClass != null;
        this.arrayClass = arrayClass;
            // read through reflection, since an array of a primitive type, like int[], is not an Object[]
            int length = Array.getLength(collectionObj);
            List<Object> elements = new ArrayList<>(length);
            for (int i = 0; i < length; i++) {
                elements.add(Array.get(collectionObj, i));
            }
            items = elements;
        Object result = isArrayResult ? toArray(results) : results;
    private Object toArray(List<Object> results) {
        // filled through reflection, which unboxes each result when the array is of a primitive type, like int[]
   
```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
import static java.util.Arrays.copyOf;

    private final Class<? extends Object[]> arrayclass;
        this.isArrayResult = isArrayResult;
        this.arrayclass = arrayclass;
            items = java.util.Arrays.asList((Object[]) collectionObj);
        Object result = isArrayResult ? copyOf(results.toArray(), results.size(), arrayclass) : results;

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T02:12:57.845Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795486377845",
    "title": "agentic): support primitive arrays in the parallel mapper",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "langchain4j-langchain4j-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "a0d3c68e2d32e3bfcf4c8c90813b5ac6185c0ab6d45dbad880c894e6d295be10"
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
        "Harvested/verified timestamp recorded: 2026-11-24T02:12:57.846Z"
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
  "auth_token": "05f23e572dc6220cd9e8aa564ebe272400f672d8c3d554c597c0fb00ddf39537"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
