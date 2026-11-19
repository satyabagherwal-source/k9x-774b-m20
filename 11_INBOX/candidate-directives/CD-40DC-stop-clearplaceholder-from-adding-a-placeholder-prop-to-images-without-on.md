# Candidate Directive: [CD-40DC] stop clearPlaceholder from adding a placeholder prop to images without on

<!-- PROVENANCE_START
{
  "source_repository": "Tencent-TDS/KuiklyUI",
  "source_url": "https://github.com/Tencent-TDS/KuiklyUI",
  "source_version": "2ac8003f",
  "license": "NOASSERTION",
  "timestamp": "2026-11-19T07:51:10.560Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tencent-tds-kuiklyui",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Tencent-TDS/KuiklyUI](https://github.com/Tencent-TDS/KuiklyUI) (Revision: `2ac8003f`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-19T07:51:10.560Z`  
> **Learning ID**: `learn-github-tencent-tds-kuiklyui`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `core/src/commonMain/kotlin/com/tencent/kuikly/core/views/ImageView.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Tencent-TDS/KuiklyUI. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2ac8003f`: core): stop clearPlaceholder from adding a placeholder prop to images without one. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `core/src/commonMain/kotlin/com/tencent/kuikly/core/views/ImageView.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
        // 仅当节点下发过占位图属性时才清空：Compose 链路的网络图不调用 placeholderSrc，
        // 属性表中无 placeholder，无条件清空会在加载成功后凭空新增该属性，使节点属性集合
        // 随加载状态漂移，TurboDisplay 接管 Diff 因属性数量不一致判定节点不可复用。
        if (getViewAttr().getProp(ImageConst.PLACEHOLDER) == null) return
            getViewEvent().loadSuccess {}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
            getViewEvent().loadSuccess {
                clearPlaceholder()
            }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2ac8003f` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T07:51:10.558Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795074670558",
    "title": "stop clearPlaceholder from adding a placeholder prop to images without on",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Tencent-TDS/KuiklyUI",
    "source_uri": "https://github.com/Tencent-TDS/KuiklyUI",
    "source_version": "HEAD",
    "content_hash": "9d5f51338e593fd03f7fe8c8a58159468578af45659aaee0fa61af68330af1a4"
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
        "Harvested/verified timestamp recorded: 2026-11-19T07:51:10.558Z"
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
  "auth_token": "5655ed1e954a505139bc556d8031353c571ac638ca9b9803b71c1ebca5240eb3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
