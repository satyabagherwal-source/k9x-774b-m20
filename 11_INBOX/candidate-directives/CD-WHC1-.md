# Candidate Directive: [CD-WHC1] 修复周次选择器单双周标签误选中问题

<!-- PROVENANCE_START
{
  "source_repository": "ShiGuangSchedule/shiguangschedule",
  "source_url": "https://github.com/ShiGuangSchedule/shiguangschedule",
  "source_version": "790f3072",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T03:36:43.201Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-shiguangschedule-shiguangschedule",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [ShiGuangSchedule/shiguangschedule](https://github.com/ShiGuangSchedule/shiguangschedule) (Revision: `790f3072`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T03:36:43.201Z`  
> **Learning ID**: `learn-github-shiguangschedule-shiguangschedule`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `shared/src/commonMain/kotlin/com/xingheyuzhuan/shiguangschedule/ui/settings/course/CourseOtherSelectors.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in ShiGuangSchedule/shiguangschedule. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0ffb8d87`: 修复周次选择器单双周标签误选中问题. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `shared/src/commonMain/kotlin/com/xingheyuzhuan/shiguangschedule/ui/settings/course/CourseOtherSelectors.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
            val singleWeeks = remember(totalWeeks) { (1..totalWeeks).filter { it % 2 != 0 }.toSet() }
            val doubleWeeks = remember(totalWeeks) { (1..totalWeeks).filter { it % 2 == 0 }.toSet() }

                    selected = singleWeeks.isNotEmpty() && tempSelectedWeeks == singleWeeks,
                        tempSelectedWeeks = if (tempSelectedWeeks == singleWeeks) emptySet() else singleWeeks
                    selected = doubleWeeks.isNotEmpty() && tempSelectedWeeks == doubleWeeks,
                        tempSelectedWeeks = if (tempSelectedWeeks == doubleWeeks) emptySet() else doubleWeeks
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
                    selected = tempSelectedWeeks.isNotEmpty() && tempSelectedWeeks.all { it % 2 != 0 },
                        tempSelectedWeeks = (1..totalWeeks).filter { it % 2 != 0 }.toSet()
                    selected = tempSelectedWeeks.isNotEmpty() && tempSelectedWeeks.all { it % 2 == 0 },
                        tempSelectedWeeks = (1..totalWeeks).filter { it % 2 == 0 }.toSet()
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0ffb8d87` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T03:36:43.199Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795232203199",
    "title": "修复周次选择器单双周标签误选中问题",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "ShiGuangSchedule/shiguangschedule",
    "source_uri": "https://github.com/ShiGuangSchedule/shiguangschedule",
    "source_version": "HEAD",
    "content_hash": "f51d35d2794ad8959c1fea04783b62c5177aa9f4f52fc536f503f8698a158e7e"
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
        "Harvested/verified timestamp recorded: 2026-11-21T03:36:43.199Z"
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
  "auth_token": "153723049a99c84fb6012ac0cd33e08f60966205e1cb1b6aba229c6213041d20"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
