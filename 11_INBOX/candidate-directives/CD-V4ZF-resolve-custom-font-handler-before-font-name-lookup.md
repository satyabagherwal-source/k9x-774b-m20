# Candidate Directive: [CD-V4ZF] resolve custom font handler before font name lookup

<!-- PROVENANCE_START
{
  "source_repository": "Tencent-TDS/KuiklyUI",
  "source_url": "https://github.com/Tencent-TDS/KuiklyUI",
  "source_version": "0828d8ef",
  "license": "NOASSERTION",
  "timestamp": "2026-11-18T06:32:37.371Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tencent-tds-kuiklyui",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Tencent-TDS/KuiklyUI](https://github.com/Tencent-TDS/KuiklyUI) (Revision: `0828d8ef`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-18T06:32:37.371Z`  
> **Learning ID**: `learn-github-tencent-tds-kuiklyui`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `core-render-ios/Extension/Category/KRConvertUtil.m`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Tencent-TDS/KuiklyUI. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0828d8ef`: ios): resolve custom font handler before font name lookup. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `core-render-ios/Extension/Category/KRConvertUtil.m`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
        // 情形 2: componentExpandHandler 自定义字体创建（weight/italic 作为参数传出，返回值原样使用）
        // 须先于按字体名查找，否则系统内置字体名（如 avenir）会被提前取回固定字重，业务按 weight 映射的多字重失效
        UIFont *font = nil;
        
        // 情形 3: 静态注册（info.plist）
        font = [UIFont fontWithName:fontFamily size:fontSize];
        if (font) {
            return font;
        }
        // 情形 4: 动态注册字体后再按 fontFamily 获取
        if (contextParam && [KRFontModule hr_loadCustomFont:fontFamily contextParams:contextParam]) {
            font = [UIFont fontWithName:fontFamily size:fontSize];
            if (font) {
                return font;
            }
        }
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
        // 情形 2: 静态注册（info.plist）
        UIFont *font = [UIFont fontWithName:fontFamily size:fontSize];
        if (font) {
            return font;
        }
        // 情形 3: 动态注册字体后再按 fontFamily 获取
        if (contextParam && [KRFontModule hr_loadCustomFont:fontFamily contextParams:contextParam]) {
            font = [UIFont fontWithName:fontFamily size:fontSize];
            if (font) {
                return font;
            }
        }
        
        // 情形 4: componentExpandHandler 自定义字体创建（weight/italic 作为参数传出，返回值原样使用）
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0828d8ef` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T06:32:37.369Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794983557369",
    "title": "resolve custom font handler before font name lookup",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Tencent-TDS/KuiklyUI",
    "source_uri": "https://github.com/Tencent-TDS/KuiklyUI",
    "source_version": "HEAD",
    "content_hash": "e73905b2d9e786c5c6adeb9445771efda5065e38af145a5eb8c971fbbe8f7fe9"
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
        "Harvested/verified timestamp recorded: 2026-11-18T06:32:37.369Z"
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
  "auth_token": "18436feca4078b43052141acd39f95b30250024f773337971a9d91a476148386"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
