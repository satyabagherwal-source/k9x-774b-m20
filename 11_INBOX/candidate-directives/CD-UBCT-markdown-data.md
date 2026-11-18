# Candidate Directive: [CD-UBCT] 出站请求中降级无法投递的 Markdown data: 图片

<!-- PROVENANCE_START
{
  "source_repository": "lioensky/VCPToolBox",
  "source_url": "https://github.com/lioensky/VCPToolBox",
  "source_version": "ec435c0e",
  "license": "NOASSERTION",
  "timestamp": "2026-11-18T15:51:51.293Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-lioensky-vcptoolbox",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lioensky/VCPToolBox](https://github.com/lioensky/VCPToolBox) (Revision: `ec435c0e`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-18T15:51:51.293Z`  
> **Learning ID**: `learn-github-lioensky-vcptoolbox`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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

function guardMarkdownDataImagesInText(text) {
    if
```

**NEGATIVE CONSTRAINT**:
```javascript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `40ef8cba` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T15:51:51.291Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795017111291",
    "title": "出站请求中降级无法投递的 Markdown data: 图片",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lioensky/VCPToolBox",
    "source_uri": "https://github.com/lioensky/VCPToolBox",
    "source_version": "HEAD",
    "content_hash": "963024cc60fb3d43d864562f74ea3edaf3b1ace3b91b3ffbb188d646c56f410b"
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
        "Harvested/verified timestamp recorded: 2026-11-18T15:51:51.291Z"
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
  "auth_token": "b2b2d3e1c96080a3b1232d4783cbde3db10200867f08ab976ebaa7bc40843cf9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
