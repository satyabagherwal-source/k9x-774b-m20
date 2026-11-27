# Candidate Directive: [CD-IKIB] i18n): translate Korean strings still shown in English

<!-- PROVENANCE_START
{
  "source_repository": "goharbor-harbor-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T03:07:55.709Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-goharbor-harbor-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [goharbor-harbor-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T03:07:55.709Z`  
> **Learning ID**: `LEARN-EVO-goharbor-harbor-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/portal/src/i18n/lang/ko-kr-lang.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in goharbor/harbor. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ffac21f6`: i18n): translate Korean strings still shown in English. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/portal/src/i18n/lang/ko-kr-lang.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
        "OR": "또는",
        "TITLE": "환경 설정",
        "LANGUAGE": "언어",
        "DATE_TIME_FORMAT": "날짜/시간 형식",
        "PULL_CMD_PREFIX": "풀(Pull) 명령어 접두사"
        "PREFERENCES": "환경 설정",
        "ABOUT": "정보",
        "OF": "/",
        "PROXY_CACHE_BANDWIDTH": "프록시 캐시가 업스트림에서 이미지를 가져올 때 쓸 최대 네트워크 대역폭을 설정합니다. 무제한 대역폭을 원하시면 -1을 입력하세요. ",
        "BANDWIDTH": "대역폭",
        "SPEED_LIMIT_TIP": "-1 또는 0보다 큰 정수를 입력하세요. ",
        "OF": "/",
        "PROXY_REFERRER_API_TIP": "OCI 1.1 referrer API 요청을 업스트림 레지스트리로 프록시하려면 이 옵션을 활성화하세요.",
        "PROXY_REFERRER_API_LABEL": "referrer API 프록시 활성화",
        "IMMUTABLE_TAG": "태그 불변성",
        "PREVENT_VULNERABLE_1": "취약점 심각도가",
        "PREVENT_VULNERABLE_2": "이상인 이미지가 배포되지 않도록 방지합니다.",
        "OF": "/",
        "OF": "/",
        "IMMUTABLE_TAG": "태그 불변성",
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
        "OR": "OR",
        "TITLE": "Preferences",
        "LANGUAGE": "Language",
        "DATE_TIME_FORMAT": "Date/Time Format",
        "PULL_CMD_PREFIX": "Pull Command Prefix"
        "PREFERENCES": "Preferences",
        "ABOUT": "About",
        "OF": "of",
        "PROXY_CACHE_BANDWIDTH": "Set the maximum network bandwidth to pull image from upstream for proxy-cache. For unlimited bandwidth, please enter -1. ",
        "BANDWIDTH": "Bandwidth",
        "SPEED_LIMIT_TIP": "Please enter -1 or an integer greater than 0. ",

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T03:07:55.854Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795748875853",
    "title": "i18n): translate Korean strings still shown in English",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "goharbor-harbor-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "664bb7af96f308b61ccf9ea7f1d919e93d93e406069cb1e74649e1756716c0a9"
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
        "Harvested/verified timestamp recorded: 2026-11-27T03:07:55.854Z"
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
  "auth_token": "3035c0693f90b4269966dc5d3f917f1d32e77166095fb0937bc42d5c351f43c1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
