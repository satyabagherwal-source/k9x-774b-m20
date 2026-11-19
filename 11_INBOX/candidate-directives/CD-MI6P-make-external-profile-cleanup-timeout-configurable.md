# Candidate Directive: [CD-MI6P] make external profile cleanup timeout configurable

<!-- PROVENANCE_START
{
  "source_repository": "tickernelz/opencode-mem",
  "source_url": "https://github.com/tickernelz/opencode-mem",
  "source_version": "94a849ca",
  "license": "MIT",
  "timestamp": "2026-11-19T07:37:33.841Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tickernelz-opencode-mem",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tickernelz/opencode-mem](https://github.com/tickernelz/opencode-mem) (Revision: `94a849ca`).  
> **License**: MIT | **Timestamp**: `2026-11-19T07:37:33.841Z`  
> **Learning ID**: `learn-github-tickernelz-opencode-mem`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-19T07:37:33.839Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795073853839",
    "title": "make external profile cleanup timeout configurable",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tickernelz/opencode-mem",
    "source_uri": "https://github.com/tickernelz/opencode-mem",
    "source_version": "HEAD",
    "content_hash": "6ebdd8b50ecb860dce398e1d51348b8840f554b65f8d767a0c2b9a67f53c1e10"
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
        "Harvested/verified timestamp recorded: 2026-11-19T07:37:33.839Z"
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
  "auth_token": "e7bef62f0387a091c3a4b48b7e7f0616fae2b7dda371a1c728106ad52044932a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
