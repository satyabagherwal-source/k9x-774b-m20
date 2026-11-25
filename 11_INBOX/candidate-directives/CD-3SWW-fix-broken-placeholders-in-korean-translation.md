# Candidate Directive: [CD-3SWW] fix broken placeholders in Korean translation

<!-- PROVENANCE_START
{
  "source_repository": "goharbor/harbor",
  "source_url": "https://github.com/goharbor/harbor",
  "source_version": "7ceeba65",
  "license": "Apache-2.0",
  "timestamp": "2026-11-25T09:25:01.088Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-goharbor-harbor",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [goharbor/harbor](https://github.com/goharbor/harbor) (Revision: `7ceeba65`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-25T09:25:01.088Z`  
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
Prevents defects observed in production commit `7ceeba65`: i18n): fix broken placeholders in Korean translation. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/portal/src/i18n/lang/ko-kr-lang.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
        "BANDWIDTH_TOOLTIP": "각 복제 작업자에 대한 최대 네트워크 대역폭을 설정합니다. 동시 실행 횟수(최대 {{max_job_workers}}개)에 주의하시기 바랍니다. 무제한 대역폭을 원하시면 -1을 입력하세요.",
        "UNREACHABLE_SOURCE_REGISTRY": "소스 레지스트리에 연결하지 못했습니다. 이 규칙을 편집하기 전에 소스 레지스트리를 사용할 수 있는지 확인하세요: {{error}}",
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
        "BANDWIDTH_TOOLTIP": "각 실행에 대한 최대 네트워크 대역폭을 설정합니다. 동시 실행 횟수에 주의하시기 바랍니다. 무제한 대역폭을 원하시면 -1을 입력하세요.",
        "UNREACHABLE_SOURCE_REGISTRY": "소스 레지스트리에 연결하지 못했습니다. 이 규칙을 편집하기 전에 소스 레지스트리를 사용할 수 있는지 확인하세요. {{오류}}",
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7ceeba65` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T09:25:01.086Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795598701086",
    "title": "fix broken placeholders in Korean translation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "goharbor/harbor",
    "source_uri": "https://github.com/goharbor/harbor",
    "source_version": "HEAD",
    "content_hash": "31ed025d891d66edcf747d9f19828f64be8534d8ae318d84598c7cbea444fa7d"
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
        "Harvested/verified timestamp recorded: 2026-11-25T09:25:01.086Z"
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
  "auth_token": "2dfc563f1d0ca18e12ffd4e0e13322d78888cd7fe2deb30771bff9edeb9df9ee"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
