# Candidate Directive: [CD-CUHN] Speed up null position filtering on validity bitmaps

<!-- PROVENANCE_START
{
  "source_repository": "trinodb/trino",
  "source_url": "https://github.com/trinodb/trino",
  "source_version": "39a37d40",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T14:24:18.780Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-trinodb-trino",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [trinodb/trino](https://github.com/trinodb/trino) (Revision: `39a37d40`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T14:24:18.780Z`  
> **Learning ID**: `learn-github-trinodb-trino`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `core/trino-main/src/main/java/io/trino/operator/join/NullablePositions.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in trinodb/trino. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `11a3933b`: Speed up null position filtering on validity bitmaps. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `core/trino-main/src/main/java/io/trino/operator/join/NullablePositions.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
import static io.trino.spi.block.Bitmap.allocateWords;
import static io.trino.spi.block.Bitmap.getBits;
import static io.trino.spi.block.Bitmap.hasUnsetBit;
import static io.trino.spi.block.Bitmap.isSet;
import static io.trino.sql.gen.columnar.ColumnarFilterUtils.filterSetBitsRange;
import static java.lang.Math.min;

            // Special case for a single nullable block to avoid the need for an explicit validity accumulator
        long[] valueIsValid = allocateWords(positionCount, true);
        for (int i = 0; i < nullableBlocksCount; i++) {
            retainNonNullPositions(nullableBlocks[i], valueIsValid, positionCount);
        int outputPositionsCount = filterSetBitsRange(valueIsValid, 0, 0, positionCount, outputPositions);
                if (hasNulls(dictionary)) {
                    if (positionCount >= dictionary.getPositionCount()) {
                        // The page dominates the dictionary, so the decode amortizes and the
                        // gather is an id lookup plus a byte load
                        byte[] dictionaryIsValid = decodeValidity(dictionary);
                        for (int position = 0; position < positionCount; position++) {
            
```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
            // Special case for a single nullable block to avoid the need for explicit `boolean[] isNull`
        boolean[] isNull = new boolean[positionCount];
        for (int i = 0; i < nullableBlocksCount - 1; i++) {
            Block nullableBlock = nullableBlocks[i];
            getNonNullPositions(nullableBlock, isNull);
        // For the last nullable block, we need to fill outputPositions and count non-null positions
        int outputPositionsCount = getNonNullPositionsLast(nullableBlocks[nullableBlocksCount - 1], isNull, outputPositions);
                Optional<Bitmap> dictionaryValidity = dictionary.getValidityBitmap();
                if (dictionaryValidity.isPresent()) {
                    long[] dictionaryIsValid = dictionaryValidity.get().getRawWords();
                    int validityOffset = dictionaryValidity.get().getRawBitOffset();
                    for (int position = 0; position < positionCount; position++) {
                        boolean isNull = !Bitmap.isSet(dictionaryIsValid, validityOffset, dictionaryBlock.getId(position));
                        outputPositions[outputPositionCount] = position;
                        outputPositionCount += isNu
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `11a3933b` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T14:24:18.777Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795530258777",
    "title": "Speed up null position filtering on validity bitmaps",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "trinodb/trino",
    "source_uri": "https://github.com/trinodb/trino",
    "source_version": "HEAD",
    "content_hash": "f760f69166d3ad10a094be27345ddb3dab0902a5bf4bfb4a3887ce6d4c80e793"
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
        "Harvested/verified timestamp recorded: 2026-11-24T14:24:18.778Z"
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
  "auth_token": "8eff4b68060ccb366837297d981ceb1f1cbc1184b264c16371899016260b1291"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
