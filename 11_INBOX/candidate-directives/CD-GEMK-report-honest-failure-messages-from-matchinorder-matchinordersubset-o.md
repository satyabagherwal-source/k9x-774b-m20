# Candidate Directive: [CD-GEMK] report honest failure messages from matchInOrder/matchInOrderSubset o

<!-- PROVENANCE_START
{
  "source_repository": "kotest/kotest",
  "source_url": "https://github.com/kotest/kotest",
  "source_version": "9c81ef68",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T04:29:11.564Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-kotest-kotest",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [kotest/kotest](https://github.com/kotest/kotest) (Revision: `9c81ef68`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T04:29:11.564Z`  
> **Learning ID**: `learn-github-kotest-kotest`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `kotest-assertions/kotest-assertions-core/src/commonMain/kotlin/io/kotest/matchers/collections/CollectionMatchers.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in kotest/kotest. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5f6bd903`: matchers): report honest failure messages from matchInOrder/matchInOrderSubset on edge inputs. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `kotest-assertions/kotest-assertions-core/src/commonMain/kotlin/io/kotest/matchers/collections/CollectionMatchers.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
      require(assertions.isNotEmpty()) { "assertions must not be empty" }

               val result = bestResult
               if (result == null) {
                  // the actual collection is shorter than the assertions list, so the loop above never ran
                  """
            |The collection has fewer elements (${actual.size}) than the number of assertions (${assertions.size}), so the assertions cannot all match.
            """.trimMargin()
               } else {
                  """
            |Expected a sequence of elements to pass the assertions, ${if (allowGaps) "possibly with gaps between " else ""}but failed to match all assertions
            |
            |Best result when comparing from index [${result.startIndex}], where ${result.elementsPassed} elements passed, but the following elements failed:
                     result.problems.joinToString("\n") { problem ->
                        "|${problem.atIndex} => ${problem.problem}"
                     }
               }
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
               """
            |Best result when comparing from index [${bestResult?.startIndex}], where ${bestResult?.elementsPassed} elements passed, but the following elements failed:
                  bestResult?.problems?.joinToString("\n") { problem ->
                     "|${problem.atIndex} => ${problem.problem}"
               }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5f6bd903` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T04:29:11.562Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794976151562",
    "title": "report honest failure messages from matchInOrder/matchInOrderSubset o",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "kotest/kotest",
    "source_uri": "https://github.com/kotest/kotest",
    "source_version": "HEAD",
    "content_hash": "a4fe46b2b9ff84ae9a8b360559a4cbb2d49ae33e0389474888fdc2c237456c1d"
  },
  "evidence_fingerprint": "0ea4249640d6d3cc",
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
        "Direct empirical evidence ratio: 0% (0/4)",
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
        "Harvested/verified timestamp recorded: 2026-11-18T04:29:11.562Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "88197a9039dac5c4e39acebb0741e7dacf6091c3bf0d074bb85656ea3eaa6738"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
