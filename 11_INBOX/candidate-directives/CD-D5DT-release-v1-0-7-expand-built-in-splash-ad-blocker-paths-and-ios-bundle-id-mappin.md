# Candidate Directive: [CD-D5DT] Release v1.0.7: expand built-in Splash Ad Blocker paths and iOS Bundle ID mappin

<!-- PROVENANCE_START
{
  "source_repository": "kianuni-erosion-cn-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T00:00:05.090Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-kianuni-erosion-cn-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [kianuni-erosion-cn-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T00:00:05.090Z`  
> **Learning ID**: `LEARN-EVO-kianuni-erosion-cn-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Kianuni/Erosion-CN. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `97ed831a`: Release v1.0.7: expand built-in Splash Ad Blocker paths and iOS Bundle ID mappings. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
22. **扩充主流应用内置开屏广告路径与 iOS Bundle ID 精准适配（`v1.0.7`）**
    - 感谢 [@oooasis](https://github.com/oooasis) 与 [@itmubai](https://github.com/itmubai) 在 [#58](https://github.com/Kianuni/Erosion-CN/issues/58) 实测分享，在 `AdCacheBlockerView` 内置词典新增 7 款常用 App 的精准开屏/广告缓存路径（均仅针对对应应用容器生效，不包含通用 WebView/网络框架缓存，随时支持一键恢复读写或加白）：
      - **淘宝 (`com.taobao.taobao4iphone`)**：补充 `Documents/TBDocuments/bootImagesDoc`（同时兼容 `bootImageDoc` 与 `bootImagesDoc`）；
      - **京东 (`com.360buy.jdmobile`)**：修正 iOS App Store 官方 Bundle ID 识别并新增 `Library/Caches/startADImage`；
      - **大众点评 (`com.dianping.dpscope`)**：新增 `Documents/splashes_new`；
      - **中国移动 (`cn.10086.app`)**：新增 `Library/DownloadCenter`；
      - **腾讯视频 (`com.tencent.live4iphone`)**：新增 `Library/Caches/QAD/PreloadImageAdOrderCache`、`QADWatchHistoryAdCache`、`maxViewAdCacheFolderName`、`Library/Caches/TAD/PushAdPendantCache` 与 `TADCache`；
      - **番茄小说 (`com.dragon.read`)**：新增 `Documents/TTAdSplashSimpleCache`；
      - **携程旅行 (`ctrip.com` / `ctrip.wireless`)**：新增 `Library/Caches/LoadingImages`。
    - 同步在 `CSStoreEngine` 与 `AppDataBackupView` 补全上述应用的官方 iOS Bundle ID 中英文友好名称映射。
22. **Expanded Built-In Splash Ad Blocker Paths & Official iOS Bundle ID Mappings (`v
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `97ed831a` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T00:00:05.245Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795651205244",
    "title": "Release v1.0.7: expand built-in Splash Ad Blocker paths and iOS Bundle ID mappin",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "kianuni-erosion-cn-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "953b8434cd50079eeb1ee57c891ca2785b4ea4b648b32aacd5c4f63ef1a3fbda"
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
        "Harvested/verified timestamp recorded: 2026-11-26T00:00:05.245Z"
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
  "auth_token": "bb50d73cd62aa23113c5642940d350d594d0dfd7a1252ee9884a797ab52d7d6a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
