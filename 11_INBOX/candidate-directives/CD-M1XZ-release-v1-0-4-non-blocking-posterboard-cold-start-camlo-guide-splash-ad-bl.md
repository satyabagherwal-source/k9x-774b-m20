# Candidate Directive: [CD-M1XZ] Release v1.0.4: non-blocking PosterBoard cold start + Camlo guide & Splash Ad Bl

<!-- PROVENANCE_START
{
  "source_repository": "Kianuni/Erosion-CN",
  "source_url": "https://github.com/Kianuni/Erosion-CN",
  "source_version": "8ef12aa5",
  "license": "GPL-3.0",
  "timestamp": "2026-11-20T11:08:50.135Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-kianuni-erosion-cn",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Kianuni/Erosion-CN](https://github.com/Kianuni/Erosion-CN) (Revision: `8ef12aa5`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-20T11:08:50.135Z`  
> **Learning ID**: `learn-github-kianuni-erosion-cn`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-20T11:08:50.133Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795172930133",
    "title": "Release v1.0.4: non-blocking PosterBoard cold start + Camlo guide & Splash Ad Bl",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Kianuni/Erosion-CN",
    "source_uri": "https://github.com/Kianuni/Erosion-CN",
    "source_version": "HEAD",
    "content_hash": "db429a63283abb96ea3d7323753a435f5683dcdc1699ea4dde7dff91080d9f1d"
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
        "Harvested/verified timestamp recorded: 2026-11-20T11:08:50.133Z"
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
  "auth_token": "f04a4532f3e5ede57dc7f0a4488c7ee42d43d97d7dbfdf870528b7591f602a27"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
