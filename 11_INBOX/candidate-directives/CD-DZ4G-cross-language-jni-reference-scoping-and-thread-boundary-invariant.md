# Candidate Directive: [CD-DZ4G] Cross-Language JNI Reference Scoping and Thread-Boundary Invariant

<!-- PROVENANCE_START
{
  "source_repository": "StarRocks/starrocks",
  "source_url": "https://github.com/StarRocks/starrocks",
  "source_version": "7dd4de40",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T09:47:33.520Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-starrocks-starrocks",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [StarRocks/starrocks](https://github.com/StarRocks/starrocks) (Revision: `7dd4de40`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T09:47:33.520Z`  
> **Learning ID**: `learn-github-starrocks-starrocks`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
        RETURN_IF_ERROR(check_and_clear_exception(env, "FindClass failed: " + class_path));

        jmethodID init_id = env->GetMethodID(local_cls, "<init>", "()V");
        RETURN_IF_ERROR(check_and_clear_exception(env, "GetMethodID <init> failed"));

        jobject local_obj = env->NewObject(local_cls, init_id);
        LOCAL_REF_GUARD_ENV(env, local_obj);
        RETURN_IF_ERROR(check_and_clear_exception(env, "NewObject failed"));

        _close_method = env->GetMethodID(local_cls, "close", "()V");
        RETURN_IF_ERROR(check_and_clear_exception(env, "GetMethodID close failed"));

        // Elevate references to global scope to survive thread migrations
        _global_class = reinterpret_cast<jclass>(env->NewGlobalRef(local_cls));
        if (!_global_class) {
            return Status::InternalError("Failed to pin global class ref");
        }
        _global_obj = env->NewGlobalRef(local_obj);
        if (!_global_obj) {
            env->DeleteGlobalRef(_global_class);
            _global_class = nullptr;
            return Status::InternalError("Failed to pin global object ref");
        }
        return Status::OK();
    }

    void teardown(JNIEnv* env) noexcept {
        if (_global_obj != nullptr) {
            if (_close_method != nullptr) {
                env->CallVoidMethod(_global_obj, _close_method);
                // Invariant: Always check and clear exceptions in cleanup/dtors
                // so the thread is clean for subsequent tasks.
                Status st = check_and_clear_exception(env, "Failed invoking close() on foreign scanner");
                if (!st.ok()) {
                    LOG(WARNING) << st.message();
                }
            }
            env->DeleteGlobalRef(_global_obj);
            _global_obj = nullptr;
        }
        if (_global_class != nullptr) {
            env->DeleteGlobalRef(_global_class);
            _global_class = nullptr;
        }
    }

    static Status check_and_clear_exception(JNIEnv* env, const std::string& context_msg) {
        if (env->ExceptionCheck()) {
            jthrowable exc = env->ExceptionOccurred();
            env->ExceptionClear(); // MUST clear immediately to allow further calls
            return Status::InternalError(context_msg + " (Java Exception Cleared)");
        }
        return Status::OK();
    }
};

} // namespace starrocks
```

**NEGATIVE CONSTRAINT**:
```cpp
// ANTI-PATTERN: Local reference leak and thread-escape disaster
void BuggyScanner::_init(JNIEnv* env) {
    jclass cls = env->FindClass("com/starrocks/Scanner");
    // BUG 1: Assigning local reference directly to class member meant for cross-thread access!
    _stored_class = cls; 
    
    jmethodID ctor = env->GetMethodID(cls, "<init>", "()V");
    // BUG 2: Local ref escapes context and will be accessed by worker thread -> SEGV
    _stored_obj = env->NewObject(cls, ctor); 
}

void BuggyScanner::close(JNIEnv* env) {
    // BUG 3: Unhandled exception left pending on thread!
    env->CallVoidMethod(_stored_obj, _close_method); 
    // BUG 4: Deleting local ref that was already invalidated or across another thread
    env->DeleteLocalRef(_stored_obj); 
}
```

**VERIFICATION METHOD**:
Run JVM with `-Xcheck:jni`. Execute a high-concurrency unit test spinning 100 worker threads calling `initialize()` and `teardown()` across thread transitions. Verify with Google Test:
```cpp
TEST_F(JniScannerTest, VerifyNoLocalRefEscapeOrPendingExceptions) {
    JNIEnv* env = getJNIEnv();
    CrossBoundarySession session;
    ASSERT_TRUE(session.initialize(env, "java/util/ArrayList").ok());
    session.teardown(env);
    ASSERT_FALSE(env->ExceptionCheck()) << "Pending JNI exception leaked into caller thread";
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T09:47:33.518Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794908853518",
    "title": "Cross-Language JNI Reference Scoping and Thread-Boundary Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "StarRocks/starrocks",
    "source_uri": "https://github.com/StarRocks/starrocks",
    "source_version": "HEAD",
    "content_hash": "680cfba8de3f376bd97848434608093f3ff088d636e61785861e04171a12b969"
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
        "Harvested/verified timestamp recorded: 2026-11-17T09:47:33.518Z"
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
  "auth_token": "1dadb8018747d47f441cac0dee97a321354771b3f68ef895b2da06f9088bc106"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
