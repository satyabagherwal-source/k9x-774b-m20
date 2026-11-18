# Candidate Directive: [CD-UF8S] 出站请求中降级无法投递的 Markdown data: 图片

<!-- PROVENANCE_START
{
  "source_repository": "lioensky-vcptoolbox-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T15:51:56.221Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-lioensky-vcptoolbox-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lioensky-vcptoolbox-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T15:51:56.221Z`  
> **Learning ID**: `LEARN-EVO-lioensky-vcptoolbox-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `modules/markdownDataImageGuard.js`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lioensky/VCPToolBox. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `40ef8cba`: 出站请求中降级无法投递的 Markdown data: 图片. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `modules/markdownDataImageGuard.js`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
'use strict';

/**
 * 出站守卫：文本里的 Markdown data: 图片。
 *
 * 部分上游网关在把 OpenAI 格式转成 Gemini 原生格式时，会扫描文本中的
 * `![alt](data:...)` 并把它转成内联图片。网页抓取带进来的 1x1 GIF 占位图、
 * 残缺的 base64、甚至讨论这种语法的普通文字，都会让整轮请求以 415/500 失败，
 * 而且这段内容留在历史里之后每一轮都会失败。
 *
 * 这里只处理发往上游的请求副本里的文本：
 *   - 格式受支持、base64 完整、体积不是占位级别的真图原样保留；
 *   - 其余降级成 `[图片: alt]`；
 *   - 零散的 `](data:` 片段插入一个空格，避免被网关误配对。
 * image_url 等多模态 part、工具参数和其他字段都不触碰。
 */

const MARKER = '](data:';
const KEEP_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
// 小于这个体积的内联图基本只会是占位图或跟踪像素。
const MIN_KEEP_BYTES = 1024;
const DATA_URL_RE = /^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/;
const MARKDOWN_DATA_IMAGE_RE = /!\[([^\]\n]{0,300})\]\((data:[^)\s]*)\)/g;

function isGuardEnabled() {
    return String(process.env.EnableMarkdownDataImageGuard || 'true').toLowerCase() !== 'false';
}

function isDeliverableImage(dataUrl) {
    const match = DATA_URL_RE.exec(dataUrl);
    if (!match) return false;
    if (!KEEP_MIME.has(match[1].toLowerCase())) return false;
    const base64 = match[2];
    if (base64.length % 4 !== 0) return false;
    return Math.floor(base64.length * 3 / 4) >= MIN_KEEP_BYTES;
}

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T15:51:56.332Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795017116332",
    "title": "出站请求中降级无法投递的 Markdown data: 图片",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lioensky-vcptoolbox-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "95f9c7d3d243947aa2c11584fd8c37f52e98cb122f1f00e639f78d7cb8b30487"
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
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-18T15:51:56.332Z"
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
  "auth_token": "cd86cbc21ae664c8462f5f2cd8fc70caf7d90ce637e4720b1adb5555810daa16"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
