# Candidate Directive: [CD-YGTS] Turn panics in Arrow C stream callbacks into stream errors

<!-- PROVENANCE_START
{
  "source_repository": "pola-rs/polars",
  "source_url": "https://github.com/pola-rs/polars",
  "source_version": "e02c237a",
  "license": "MIT",
  "timestamp": "2026-11-19T17:06:44.272Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-pola-rs-polars",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pola-rs/polars](https://github.com/pola-rs/polars) (Revision: `e02c237a`).  
> **License**: MIT | **Timestamp**: `2026-11-19T17:06:44.272Z`  
> **Learning ID**: `learn-github-pola-rs-polars`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/polars-arrow/src/ffi/stream.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pola-rs/polars. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `60a4ec62`: Turn panics in Arrow C stream callbacks into stream errors. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/polars-arrow/src/ffi/stream.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use std::panic::AssertUnwindSafe;
    iter: Box<dyn Iterator<Item = PolarsResult<Box<dyn Array>>> + Send>,
    /// Whether a callback panicked, which ends the stream as `iter` is left in an unknown state.
    panicked: bool,
/// The status of a failed callback, as no status of the interface itself is ever this.
const CALLBACK_ERROR: i32 = 2001;

fn error_cstring(message: &str) -> CString {
    CString::new(message.replace('\0', "\\0")).unwrap()
}

/// Run the body of a stream callback, storing a panic as the stream's error, as unwinding out of
/// an `extern "C"` function aborts the process.
unsafe fn catch_callback(
    iter: *mut ArrowArrayStream,
    body: impl FnOnce(&mut PrivateData) -> i32,
) -> i32 {
        return CALLBACK_ERROR;
    let private = (*iter).private_data as *mut PrivateData;
    if (*private).panicked {
        return CALLBACK_ERROR;
    }
    match std::panic::catch_unwind(AssertUnwindSafe(|| body(&mut *private))) {
        Ok(status) => status,
        Err(payload) => {
            let message = payload
                .downcast_ref::<&str>()
                .copied()
                .or_else(|| payload.downcast_ref::<String>().map(String::as_str))
         
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    iter: Box<dyn Iterator<Item = PolarsResult<Box<dyn Array>>>>,
unsafe extern "C" fn get_next(iter: *mut ArrowArrayStream, array: *mut ArrowArray) -> i32 {
        return 2001;
    let private = &mut *((*iter).private_data as *mut PrivateData);
    match private.iter.next() {
                private.error = Some(CString::new(format!("The iterator produced an item of data type {item_dt:?} but the producer expects data type {expected_dt:?}").as_bytes().to_vec()).unwrap());
                return 2001; // custom application specific error (since this is never a result of this interface)
            // A NUL would end the C string: without it, `CString::new` can't fail (and a panic
            // here can't unwind out of this `extern "C"` function).
            let message = err.to_string().replace('\0', "\\0");
            private.error = Some(CString::new(message).unwrap());
            2001 // custom application specific error (since this is never a result of this interface)
    }
    if iter.is_null() {
        return 2001;
    }
    let private = &mut *((*iter).private_data as *mut PrivateData);

    std::ptr::write(schema, export_field_to_c(&private.field));
    0
    iter: Box
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `60a4ec62` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T17:06:44.270Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795108004270",
    "title": "Turn panics in Arrow C stream callbacks into stream errors",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "pola-rs/polars",
    "source_uri": "https://github.com/pola-rs/polars",
    "source_version": "HEAD",
    "content_hash": "7b332373ed85f39ecff4693c754dd0292a110a018719ad4d52677598dad21175"
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
        "Harvested/verified timestamp recorded: 2026-11-19T17:06:44.270Z"
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
  "auth_token": "00e91220528e3dfb1de7a0d19edc56967d5d9f607b7eea5a14840d53a89f01d9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
