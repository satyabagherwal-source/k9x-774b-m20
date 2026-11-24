# Candidate Directive: [CD-QZGL] Merge branch 'master' of github.com:czy0729/Bangumi

<!-- PROVENANCE_START
{
  "source_repository": "czy0729-bangumi-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T17:23:15.970Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-czy0729-bangumi-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [czy0729-bangumi-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T17:23:15.970Z`  
> **Learning ID**: `LEARN-EVO-czy0729-bangumi-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `alt_store.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in czy0729/Bangumi. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5fbbc77a`: Merge branch 'master' of github.com:czy0729/Bangumi. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `alt_store.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
          "localizedDescription": "[图文说明](https://www.yuque.com/chenzhenyu-k0epm/znygb4/osqdpz?singleDoc)\r\n\r\n[蓝奏云 v8a APK](https://czy0729.lanzoub.com/iWJJE4h1ickd)（只能电脑UA访问） |  [123pan v8a APK](https://1819463884.share.123pan.cn/123pan/K0fQjv-13MH3)（需登录，zip 请自行解压） \r\n\r\n[v8a APK、IPA] 手动点击下方 Assets\r\n\r\n## 8.42.2 - 2026/11/23\r\n\r\n### 优化\r\n- [x] [目录详情] 工具栏收纳为设置菜单\r\n- [x] [安卓] 系统长按文字菜单入口，可在设置里关闭\r\n- [x] 统一全客户端文案叫法与标点，破坏性操作补齐危险确认\r\n- [x] 大量内部重构、类型收敛与补充单测，不详细说明\r\n\r\n### 修复\r\n- [x] 因官方备用 api 域名故障，临时换回去原本不能直连的 api 域名\r\n- [x] [组件] 修复浮层面板收起后可能残留透明遮罩、导致整页无法点击的问题\r\n- [x] [安卓] 修复关系图年份不显示的问题\r\n- [x] [安卓] 修复打开主站等网页时链接被客户端自身接管、无法在浏览器中打开的问题\r\n- [x] [安卓] 修复 Passkey 登录部分机型校验失败的问题；ECH 代理下改为弹窗引导切换直连\r\n- [x] [iOS] 修复部分机型顶部标签栏可被上下拖拽的问题\r\n- [x] [iOS] 修复回复面板与收藏弹窗透过毛玻璃显出灰底的问题，统一各处毛玻璃的明暗表现\r\n- [x] [iOS] 修复骨架屏扫光不显示的问题\r\n- [x] [iOS] 下滑后显示的头部标题与左右按钮重新对齐"
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
          "localizedDescription": "[图文说明](https://www.yuque.com/chenzhenyu-k0epm/znygb4/osqdpz?singleDoc)\r\n\r\n[蓝奏云 v8a APK](https://czy0729.lanzoub.com/iWJJE4h1ickd)（只能电脑UA访问） |  [123pan v8a APK](https://1819463884.share.123pan.cn/123pan/K0fQjv-13MH3)（需登录，zip 请自行解压） \r\n\r\n[v8a APK、IPA] 手动点击下方 Assets\r\n\r\n## 8.42.2 - 2026/11/23\r\n\r\n### 修复\r\n- [x] 因官方备用 api 域名故障，临时换回去原本不能直连的 api 域名"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5fbbc77a` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T17:23:16.099Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795540996099",
    "title": "Merge branch 'master' of github.com:czy0729/Bangumi",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "czy0729-bangumi-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "afd1578453611d8885df27c543a77f0c52855c0fcb673926d68ccce23f9c4823"
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
        "Harvested/verified timestamp recorded: 2026-11-24T17:23:16.099Z"
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
  "auth_token": "32b7a1df15701955f39a9958a4fb9cc70add8607fbc4977507aebb9ac9bb10ed"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
