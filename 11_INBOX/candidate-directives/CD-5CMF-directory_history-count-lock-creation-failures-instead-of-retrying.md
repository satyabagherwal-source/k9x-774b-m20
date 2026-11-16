# Candidate Directive: [CD-5CMF] directory_history): count lock creation failures instead of retrying

<!-- PROVENANCE_START
{
  "source_repository": "kuddev-pebrel-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-16T23:52:59.076Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-kuddev-pebrel-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [kuddev-pebrel-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-16T23:52:59.076Z`  
> **Learning ID**: `LEARN-EVO-kuddev-pebrel-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `architecture/notes/pebrel_app/directory_history/2026-11-13-background-flush.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Kuddev/pebrel. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3ab8fb31`: directory_history): count lock creation failures instead of retrying. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `architecture/notes/pebrel_app/directory_history/2026-11-13-background-flush.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- 锁争用、建锁失败或写盘失败时都把批次放回队列头等待下一轮。争用不是失败，
  重试即可；建锁失败（只读盘、父路径不可创建等）与写盘失败由 worker 连续计数，
  并丢弃 `pending` 与迁移种子，避免按去抖节奏无限重试。
- `try_lock` 先创建锁文件父目录并原样上报错误，再判定锁文件是否已存在。Windows
  上 `create_dir_all` 对“父级/祖先被普通文件占据”返回 `AlreadyExists`，不能与
  跨进程争用混为一谈，否则永久失败会被当成锁忙而无限重试。
- 连续 3 次落盘失败（含建锁失败，约 1.5 s）后持久化自动关闭，内存 frecency 与
  补全继续工作，重启后重新启用；丢弃的只是尚未落盘的那批观察，已写入文件的历史
  不受影响。争用不计入失败次数；锁被长期占用时仍会按去抖节奏重试。
后台最终落盘、多次记录合并为一次数据库、锁竞争保留待写批次且不计失败、建锁失败
（直接父目录与祖先是普通文件）按失败上报并在连续 3 次后关闭持久化、版本不受支持
时不覆盖文件且不回退内存。异步断言使用轮询或文件锁；“争用不计失败”是负向断言，
额外跨过多个去抖窗口确认仍保持启用。
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
- 抢锁失败或写盘失败时把批次放回队列头等待下一轮；写盘错误由 worker 连续计数，
  并丢弃 `pending` 与迁移种子，避免按去抖节奏无限重试整库写入。
- 连续 3 次写盘失败（约 1.5 s）后持久化自动关闭，内存 frecency 与补全继续工作，
  重启后重新启用；丢弃的只是尚未落盘的那批观察，已写入文件的历史不受影响。
后台最终落盘、多次记录合并为一次数据库、锁竞争保留待写批次、版本不受支持时
不覆盖文件且不回退内存，以及持久化关闭后丢弃待写批次而内存记录仍可用。异步断言
使用轮询或文件锁，不依赖固定睡眠。
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3ab8fb31` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T23:52:59.172Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794873179172",
    "title": "directory_history): count lock creation failures instead of retrying",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "kuddev-pebrel-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "987122c3aee056aa96caf901ab55dee45fe6f35abbe4b4f0c055e3480f7e420a"
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
        "Harvested/verified timestamp recorded: 2026-11-16T23:52:59.172Z"
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
  "auth_token": "00f705ebf5da9ab7865f926d5df64e355a94e63038ef1eb056ce59935cdb4c9e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
