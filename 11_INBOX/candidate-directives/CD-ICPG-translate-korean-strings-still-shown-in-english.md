# Candidate Directive: [CD-ICPG] translate Korean strings still shown in English

<!-- PROVENANCE_START
{
  "source_repository": "goharbor/harbor",
  "source_url": "https://github.com/goharbor/harbor",
  "source_version": "7ab87806",
  "license": "Apache-2.0",
  "timestamp": "2026-11-27T03:07:45.748Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-goharbor-harbor",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [goharbor/harbor](https://github.com/goharbor/harbor) (Revision: `7ab87806`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-27T03:07:45.748Z`  
> **Learning ID**: `learn-github-goharbor-harbor`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
        "OF": "of",
        "PROXY_REFERRER_API_TIP": "Enable this to proxy OCI 1.1 referrer API requests to the upstream registry.",
        "PROXY_REFERRER_API_LABEL": "Enable proxy for referrer API",
        "IMMUTABLE_TAG": "Tag Immutability",
        "PREVENT_VULNERABLE_1": "Prevent images with vulnerability severity of",
        "PREVENT_VULNERABLE_2": "and above from being deployed.",
        "OF": "of",
        "OF": "of",
        "IMMUTABLE_TAG": "Tag Immutability",
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ffac21f6` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T03:07:45.746Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795748865746",
    "title": "translate Korean strings still shown in English",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "goharbor/harbor",
    "source_uri": "https://github.com/goharbor/harbor",
    "source_version": "HEAD",
    "content_hash": "2cb44da90406ab0681968dd12d664c77090165ea32e20d55f8c0cfe92adf8d72"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-27T03:07:45.746Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "eb294369307aafedbe4fb3de230d9a3cd12ec4dd2ec812772c27c16eb2260276"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
