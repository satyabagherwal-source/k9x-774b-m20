# Candidate Directive: [CD-EOMV] Cross-Language JNI Reference Scoping and Thread-Boundary Invariant

<!-- PROVENANCE_START
{
  "source_repository": "starrocks-starrocks-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T09:48:06.482Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-starrocks-starrocks-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [starrocks-starrocks-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T09:48:06.482Z`  
> **Learning ID**: `LEARN-EVO-starrocks-starrocks-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When crossing native-to-managed boundaries (e.g., C/C++ to Java via JNI), any object or class reference that escapes the lexical scope of the allocating function or is accessed across thread boundaries MUST be upgraded to a Global Reference (`env->NewGlobalRef()`), and all local references MUST be deterministically released using RAII guards. Furthermore, every invocation across the boundary MUST explicitly check and clear pending exceptions prior to invoking subsequent foreign methods or executing thread returns.

**WHY**:
Local references (`jobject`, `jclass`) are allocated from a fixed-size per-thread JNI local reference frame (typically 512 entries). If stored across asynchronous task executions or pipeline iterations running on worker pools, these references point to garbage memory or invalid table slots, causing catastrophic memory corruption (JVM SIGSEGV). 

Additionally, leaving an unhandled pending exception on an active JNI thread poisons subsequent unrelated JNI calls, causing silent crashes or immediate JVM termination (`FatalError: JNI call made with pending exception`).

**WHEN TO APPLY**:
Apply to any polyglot runtime architecture where native threads (C++, Rust, Go via cgo) hold handles to managed objects (Java, C#, Node V8) across event loops, fiber yields, thread-pool task dispatches, or destructors.

**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
// verified_jni_bridge.h
#pragma once
#include <jni.h>
#include <string>
#include "common/status.h"

namespace starrocks {

class ScopedLocalRef {
public:
    ScopedLocalRef(JNIEnv* env, jobject ref) : _env(env), _ref(ref) {}
    ~ScopedLocalRef() {
        if (_ref != nullptr && _env != nullptr) {
            _env->DeleteLocalRef(_ref);
        }
    }
    jobject get() const { return _ref; }
    ScopedLocalRef(const ScopedLocalRef&) = delete;
    ScopedLocalRef& operator=(const ScopedLocalRef&) = delete;
private:
    JNIEnv* _env;
    jobject _ref;
};

#define LOCAL_REF_GUARD_ENV(env, ref) ScopedLocalRef VARNAME_LINENUM(local_ref_guard_)(env, ref)

class CrossBoundarySession {
private:
    jclass _global_class = nullptr;
    jobject _global_obj = nullptr;
    jmethodID _close_method = nullptr;

public:
    Status initialize(JNIEnv* env, const std::string& class_path) {
        jclass local_cls = env->FindClass(class_path.c_str());
        LOCAL_REF_GUARD_ENV(env, local_cls);

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T09:48:06.579Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794908886579",
    "title": "Cross-Language JNI Reference Scoping and Thread-Boundary Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "starrocks-starrocks-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "330e2301d541cb9b4f57fa09c97992bda8c184d42908868e4f4c49cf175474c0"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T09:48:06.580Z"
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
  "auth_token": "679292e3d4f23664553b960dcec03370c52483f810b707cd645e01fa2c4c3ff2"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
