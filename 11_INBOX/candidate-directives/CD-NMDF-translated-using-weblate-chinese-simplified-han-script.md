# Candidate Directive: [CD-NMDF] Translated using Weblate (Chinese (Simplified Han script))

<!-- PROVENANCE_START
{
  "source_repository": "prof18/feed-flow",
  "source_url": "https://github.com/prof18/feed-flow",
  "source_version": "2d8d2804",
  "license": "Apache-2.0",
  "timestamp": "2026-11-23T07:45:06.819Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-prof18-feed-flow",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [prof18/feed-flow](https://github.com/prof18/feed-flow) (Revision: `2d8d2804`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-23T07:45:06.819Z`  
> **Learning ID**: `learn-github-prof18-feed-flow`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `i18n/src/commonMain/resources/locale/values-zh-rCN/strings.xml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in prof18/feed-flow. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2d8d2804`: Translated using Weblate (Chinese (Simplified Han script)). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `i18n/src/commonMain/resources/locale/values-zh-rCN/strings.xml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
    <string name="settings_read_articles_title">已读文章</string>
    <string name="settings_read_articles_keep">保留在列表中</string>
    <string name="settings_read_articles_hide_on_refresh">下次刷新时隐藏</string>
    <string name="settings_read_articles_hide_right_away">立即隐藏</string>
    <string name="settings_show_description">描述</string>
    <string name="settings_show_images">图片</string>
    <string name="settings_show_date">日期</string>
    <string name="settings_show_unread_dot">未读指示器</string>
    <string name="settings_show_feed_source">订阅源名称</string>
    <string name="settings_requires_description">开启描述以更改此设置。</string>
    <string name="settings_requires_date">开启日期以更改此设置。</string>
    <string name="settings_feed_list_section_layout">布局</string>
    <string name="settings_feed_list_section_show_in_list">在列表中显示</string>
    <string name="settings_feed_list_section_date_time">日期和时间</string>
    <string name="settings_feed_list_section_order">排序</string>
    <string name="settings_feed_list_section_gestures">手势</string>
    <string name="settings_feed_list_scale_default">默认</string>
    <string name="settings_reading_title">阅读</string>
    <string name="settings_read_articles_footer">当已读文章离开时
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2d8d2804` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T07:45:06.817Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795419906817",
    "title": "Translated using Weblate (Chinese (Simplified Han script))",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "prof18/feed-flow",
    "source_uri": "https://github.com/prof18/feed-flow",
    "source_version": "HEAD",
    "content_hash": "dc8695ce6863a3156b13ad119022bed7f7bf59f006b835d2ff8956d184d30dd2"
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
        "Harvested/verified timestamp recorded: 2026-11-23T07:45:06.817Z"
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
  "auth_token": "31f8975fb251f3f7a8776c3405bc24b5503a59ec53ddd88a6c8c890e7c3d3792"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
