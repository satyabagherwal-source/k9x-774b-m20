# Candidate Directive: [CD-MJAJ] Release v1.0.4: non-blocking PosterBoard cold start + Camlo guide & Splash Ad Bl

<!-- PROVENANCE_START
{
  "source_repository": "kianuni-erosion-cn-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T11:09:12.491Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-kianuni-erosion-cn-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [kianuni-erosion-cn-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T11:09:12.491Z`  
> **Learning ID**: `LEARN-EVO-kianuni-erosion-cn-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Kianuni/Erosion-CN. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `afe8d7df`: Release v1.0.4: non-blocking PosterBoard cold start + Camlo guide & Splash Ad Blocker card layout fix. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
19. **「自定义锁屏壁纸」冷启动零阻塞与 Camlo 引导、去广告概览卡片排版修复（`v1.0.4`）**
    - **修复 iPad / 新装设备打开「自定义锁屏壁纸」白屏卡死的问题（`PosterBoardView`，感谢 [@iiichika](https://github.com/iiichika) 在 #51 的详细排查）**：取消 `isReady` 对整页内容、`.tendies` 壁纸包列表及底部/菜单导入按钮的阻塞，页面打开即刻可用；`com.apple.PosterBoard` 容器定位改为后台异步执行，顶部仅展示非阻塞进度/重试状态条，点击「应用」或前往「壁纸设置」时均可随时触发「重新定位」；
    - **加入同系列动态锁屏工坊「Camlo · 开幕」引导卡片 (`PosterBoardView`)**：在「自定义锁屏壁纸」页顶展示 `Camlo · 开幕` 中英双语推荐卡片，支持免电脑将相册视频与实况照片制作成上滑揭幕变身、裸眼 3D 景深动态锁屏（含 385+ 款云端与馆藏壁纸及 `.tendies` 导出），并提供 GitHub 直达与 SideStore / AltStore / Feather 一键订阅/复制软件源入口；
    - **修复去广告「防重建精准锁死概览」卡片水平溢出显示不全（`AdCacheBlockerView`，感谢 [@wvcq6xxvkj-star](https://github.com/wvcq6xxvkj-star) 在 #52 的反馈）**：重构概览卡片与条目操作栏布局，移除导致宽度撑破的 `.fixedSize()` 按钮约束，将 `一键全锁 (N)` 升级为卡片内全宽醒目按钮，并在单条广告路径操作栏引入 `ViewThatFits` 自适应换行，彻底解决小屏、放大显示或大字体模式下卡片左右裁切的问题。
19. **Non-Blocking Lock-Screen Tweaks Cold Start + Camlo Guide & Ad Blocker Overflow Fix (`v1.0.4`)**
    - **Fixed Blank UI Freeze in Custom Lock Screen Wallpapers on iPad / Fresh Installs (`PosterBoardView`, special thanks to [@iiichika](https://github.com/iiichika) for the root-cause analysis in #51)**: Removed the full-view `isReady` gate so the `.tendies` library and import buttons load in
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `afe8d7df` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T11:09:12.614Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795172952613",
    "title": "Release v1.0.4: non-blocking PosterBoard cold start + Camlo guide & Splash Ad Bl",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "kianuni-erosion-cn-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "db429a63283abb96ea3d7323753a435f5683dcdc1699ea4dde7dff91080d9f1d"
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
        "Harvested/verified timestamp recorded: 2026-11-20T11:09:12.614Z"
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
  "auth_token": "18a43c9afbc4f4dd8462ec444339b6c6ffe6ca9d34054d9b10041e04c1006b1b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
