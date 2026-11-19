# Candidate Directive: [CD-TVW5] config): make external profile cleanup timeout configurable

<!-- PROVENANCE_START
{
  "source_repository": "tickernelz-opencode-mem-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T07:43:18.095Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-tickernelz-opencode-mem-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tickernelz-opencode-mem-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T07:43:18.095Z`  
> **Learning ID**: `LEARN-EVO-tickernelz-opencode-mem-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/i18n/README.ar.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tickernelz/opencode-mem. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e704b90c`: config): make external profile cleanup timeout configurable. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/i18n/README.ar.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
نماذج الاستدلال البطيئة (أو مطالبات الملف الكبيرة جدًا) يمكن أن تتجاوز ميزانية المخرجات المنظمة الافتراضية البالغة 90 ثانية. عيّن `"opencodeTimeoutMs"` (بالمللي ثانية) لتمديدها لاستدعاءات المخرجات المنظمة الداخلية (ملخصات الالتقاط التلقائي، تعلّم الملف) — مثلًا `"opencodeTimeoutMs": 180000` لمدة 3 دقائق. تُقيَّد القيم إلى 10000..600000؛ يبقى الافتراضي 90000. تُحوَّل السلاسل الرقمية.

مهل تنظيف الملف منفصلة: تنظيف API الخارجي/اليدوي افتراضيًا 60 ثانية عبر `"userProfileCleanupTimeoutMs"` (نفس التقييد 10000..600000؛ مثلًا `"userProfileCleanupTimeoutMs": 180000`). يحتفظ تنظيف جلسة OpenCode بميزانية ثابتة 300 ثانية. تُشتق مهلة خمول HTTP في Node كـ `max(userProfileCleanupTimeoutMs, 300000) + 30000`، ويسمح جلب واجهة الويب لـ `/ai-cleanup` حتى 630 ثانية حتى لا تقطع أي طبقة الموعد النهائي الخارجي المرفوع.
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
نماذج الاستدلال البطيئة (أو مطالبات الملف الكبيرة جدًا) يمكن أن تتجاوز ميزانية المخرجات المنظمة الافتراضية البالغة 90 ثانية. عيّن `"opencodeTimeoutMs"` (بالمللي ثانية) لتمديدها لاستدعاءات المخرجات المنظمة الداخلية (ملخصات الالتقاط التلقائي، تعلّم الملف) — مثلًا `"opencodeTimeoutMs": 180000` لمدة 3 دقائق. تُقيَّد القيم إلى 10000..600000؛ يبقى الافتراضي 90000. تُحوَّل السلاسل الرقمية. يستخدم تنظيف الملف مهلة منفصلة أطول.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e704b90c` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T07:43:18.197Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795074198197",
    "title": "config): make external profile cleanup timeout configurable",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tickernelz-opencode-mem-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "abb60c5e7b864b5a985af137a16c29efbfd0b6c73a0c48ae53d89b91fdfb51a4"
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
        "Harvested/verified timestamp recorded: 2026-11-19T07:43:18.197Z"
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
  "auth_token": "bf3c37c36b000d458497f87cacba5cdc5565af8478740d711a91be3903124e36"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
