# Candidate Directive: [CD-S50I] Linear Resource Guard for FFI-Bridged Consuming Builders

<!-- PROVENANCE_START
{
  "source_repository": "lancedb/lancedb",
  "source_url": "https://github.com/lancedb/lancedb",
  "source_version": "9e3af362",
  "license": "Apache-2.0",
  "timestamp": "2026-11-28T08:38:58.146Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-lancedb-lancedb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lancedb/lancedb](https://github.com/lancedb/lancedb) (Revision: `9e3af362`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-28T08:38:58.146Z`  
> **Learning ID**: `learn-github-lancedb-lancedb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When exposing Rust consuming-builder patterns (`fn build(self) -> T`) to garbage-collected host environments (PyO3, NAPI-RS, JNI), the native wrapper **MUST** enclose the builder in a `Mutex<Option<T>>` and extract the value via `take()`. It **MUST NOT** rely on raw pointers or assume the GC will prevent second-time invocation.

**WHY**:
In Rust, consuming methods enforce compile-time single-use guarantees. When passed to Python or JavaScript, the reference to the underlying native wrapper can be retained and re-invoked from user scripts. Without an explicit extraction guard, re-invoking a method on an already moved/freed struct results in memory corruption, null dereferences, or panic panics that crash the host runtime.

**WHEN TO APPLY**:
Any cross-language FFI bridge where the Rust layer requires ownership transfer or builder finalization, but the consumer language has dynamic object lifetimes.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::sync::Mutex;
use pyo3::{exceptions::PyRuntimeError, PyResult};

pub struct BuilderWrapper<T> {
    name: String,
    inner: Mutex<Option<T>>,
}

impl<T> BuilderWrapper<T> {
    pub fn new(name: impl AsRef<str>, inner: T) -> Self {
        Self {
            name: name.as_ref().to_string(),
            inner: Mutex::new(Some(inner)),
        }
    }

    pub fn consume<O>(&self, mod_fn: impl FnOnce(T) -> O) -> PyResult<O> {
        let mut inner = self.inner.lock().map_err(|e| {
            PyRuntimeError::new_err(format!("Lock poisoned during consume on {}: {}", self.name, e))
        })?;
        let inner_builder = inner.take().ok_or_else(|| {
            PyRuntimeError::new_err(format!("{} has already been consumed", self.name))
        })?;
        Ok(mod_fn(inner_builder))
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER store raw inner builders directly and clone or dereference them 
// without checking lifecycle ownership across FFI boundaries.
pub struct UnsafeBuilderWrapper<T> {
    inner: Option<T>, // Non-atomic, prone to data races or panic on double-execution
}
impl<T: Clone> UnsafeBuilderWrapper<T> {
    pub fn consume(&mut self) -> T {
        self.inner.clone().unwrap() // Anti-pattern: forces costly deep clones or crashes
    }
}
```

**VERIFICATION METHOD**:
Run an automated concurrency unit test invoking `consume()` concurrently or sequentially from multiple threads or simulated script calls:
```rust
#[test]
fn verify_double_consume_fails_gracefully() {
    let wrapper = BuilderWrapper::new("TestBuilder", vec![1, 2, 3]);
    assert!(wrapper.consume(|v| v.len()).is_ok());
    let err = wrapper.consume(|v| v.len()).unwrap_err();
    assert!(err.to_string().contains("already been consumed"));
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T08:38:58.144Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795855138144",
    "title": "Linear Resource Guard for FFI-Bridged Consuming Builders",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lancedb/lancedb",
    "source_uri": "https://github.com/lancedb/lancedb",
    "source_version": "HEAD",
    "content_hash": "48fe13632b600aaa35db3a8997df9812a01bbb18aa20341b7469fbb382436707"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-28T08:38:58.144Z"
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
  "auth_token": "3c023681bed0ff37606309a62b16f2ec1376a0d62c8d204591ba319c5d5df804"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
