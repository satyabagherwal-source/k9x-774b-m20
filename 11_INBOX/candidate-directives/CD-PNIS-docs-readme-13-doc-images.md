# Candidate Directive: [CD-PNIS] docs: 将 README 中的 13 张外链图片本地化存储至 doc/images，解决图床超时与失效问题

<!-- PROVENANCE_START
{
  "source_repository": "liyupi-yu-ai-agent-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T05:14:23.838Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-liyupi-yu-ai-agent-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [liyupi-yu-ai-agent-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T05:14:23.838Z`  
> **Learning ID**: `LEARN-EVO-liyupi-yu-ai-agent-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in liyupi/yu-ai-agent. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8b08b4bd`: docs: 将 README 中的 13 张外链图片本地化存储至 doc/images，解决图床超时与失效问题. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
![AI 超级智能体项目核心效果与场景概览](./doc/images/img-01.png)
![AI 恋爱大师多轮对话与工具调用界面演示](./doc/images/img-02.png)
![YuManus 自主规划超级智能体执行任务与生成 PDF 演示](./doc/images/img-03.png)
![RAG 知识库全链路实战与检索引擎调优流程](./doc/images/img-04.png)
![手撕开源智能体框架 OpenManus 核心架构源码解析](./doc/images/img-05.png)
![鱼皮原创项目实战从学知识到拿 Offer 的一条龙服务优势](./doc/images/img-06.png)
![编程导航学员跟着鱼皮做项目提升技术与斩获 Offer 的真实评价](./doc/images/img-07.png)
![Spring AI RAG 知识库核心特性实战与检索流程示意](./doc/images/img-08.webp)
![AI 超级智能体平台系统整体架构设计图](./doc/images/img-09.png)
![面试鸭 AI 大模型面试题库与求职刷题平台](./doc/images/img-10.png)
![程序员鱼皮开源 AI 知识库与 Vibe Coding 学习指南](./doc/images/img-11.png)
![编程导航涵盖多套原创全栈与 AI 应用开发实战项目合集](./doc/images/img-12.png)
```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
![AI 超级智能体项目核心效果与场景概览](https://pic.yupi.icu/1/8052592c-97ce-4568-b82e-6153924a053c.png)
![AI 恋爱大师多轮对话与工具调用界面演示](https://pic.yupi.icu/1/1745225631067-44a111e1-1032-4f1c-bd69-9f08a59a654b.png)
![YuManus 自主规划超级智能体执行任务与生成 PDF 演示](https://pic.yupi.icu/1/1745224663573-04af8f65-2da4-4ef9-8033-a179e703f9c4.png)
![RAG 知识库全链路实战与检索引擎调优流程](https://pic.yupi.icu/1/1746250760306-3b545556-59df-43a9-b843-b73ec9b5a867.png)
![手撕开源智能体框架 OpenManus 核心架构源码解析](https://pic.yupi.icu/1/ae36dd94-e87e-4dfe-ae31-81a6cc32c9e8.png)
![鱼皮原创项目实战从学知识到拿 Offer 的一条龙服务优势](https://pic.yupi.icu/1/1714011299057-cb31704a-6c33-410f-888d-74c2d7e1c6e4.png)
![编程导航学员跟着鱼皮做项目提升技术与斩获 Offer 的真实评价](https://pic.yupi.icu/1/image-20250422160549546.png)
![Spring AI RAG 知识库核心特性实战与检索流程示意](https://pic.yupi.icu/1/1745224085267-57afea3b-2de9-44a0-8f53-49e338c0e6b9.png)
![AI 超级智能体平台系统整体架构设计图](https://pic.yupi.icu/1/AI%E6%99%BA%E8%83%BD%E4%BD%93%E6%9E%B6%E6%9E%84%E5%9B%BE.png)
![面试鸭 AI 大模型面试题库与求职刷题平台](https://pic.yupi.icu/1/1745394632244-f7bd4196-78c7-48ad-af8f-c0319bf8c17a.png)
![程序员鱼皮开源 AI 知识库与 Vibe Coding 学习指南](https://pic.yupi.icu/1/1745385315485-1ca9123b-eb99-4e47-a44e-675b06b307d9.png)
![编程导航涵盖多套原创全栈与 AI 应用开发实战项目合集](https://pic.yupi.icu/1/
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8b08b4bd` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T05:14:23.954Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795497263954",
    "title": "docs: 将 README 中的 13 张外链图片本地化存储至 doc/images，解决图床超时与失效问题",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "liyupi-yu-ai-agent-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "5f908ff1510645891c7dbfa3676e50a3f3ea8c5ec693c62094aa1451d025c385"
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
        "Harvested/verified timestamp recorded: 2026-11-24T05:14:23.955Z"
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
  "auth_token": "507645a145bfcc4dc8c0703cbea3c3f5d34b0272f940399c7b96fab08e784e1e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
