# Candidate Directive: [CD-AGDX] Cross-Language Panic Boundary Containment Invariant

<!-- PROVENANCE_START
{
  "source_repository": "sfu-db-connector-x-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T23:41:17.186Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-sfu-db-connector-x-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sfu-db-connector-x-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T23:41:17.186Z`  
> **Learning ID**: `LEARN-EVO-sfu-db-connector-x-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
Any native thread, background task, or asynchronous worker executing within a Rust or C++ extension library bound to a host language (Python, Node.js, Go) **MUST NOT** panic or terminate without capturing the unwinding panic via `std::panic::catch_unwind` and explicitly piping the resulting error into the host language's error marshaling channel. Asynchronous streams and iterators **MUST** transmit terminating error sentinels rather than dropping channels silently.

**WHY**:
When a Rust worker thread spawned inside an FFI boundary encounters a panic (e.g., an unexpected `Option::unwrap()` on an unsupported temporal value such as `0001-04-17 21:12:06.000000 DATETIME(6)`), the default behavior terminates the thread. If the error is not captured and transmitted across the IPC/FFI stream, the consumer stream simply perceives a premature `None` or EOF. This causes silent data truncation, data corruption, and dropped batches without raising an exception in the caller's execution environment. The client application marks the query as successfully finished with incomplete rows.

**WHEN TO APPLY**:
Every FFI boundary, native stream, C-API callback, PyO3 generator, or background multithreaded worker returning data to a caller runtime.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::panic::{catch_unwind, AssertUnwindSafe};
use tokio::sync::mpsc::Sender;

pub struct StreamPayload<T> {
    pub data: Option<T>,
    pub error: Option<String>,
}

pub async fn safe_stream_producer<T, F>(
    tx: Sender<StreamPayload<T>>,
    mut producer_fn: F,
) where
    F: FnMut() -> Result<Option<T>, String> + Send + 'static,
    T: Send + 'static,
{
    loop {
        // Enforce panic containment barrier inside worker loop
        let outcome = catch_unwind(AssertUnwindSafe(|| {
            producer_fn()
        }));

        match outcome {
            Ok(Ok(Some(item))) => {
                if tx.send(StreamPayload { data: Some(item), error: None }).await.is_err() {
                    break; // Receiver dropped
                }
            }
            Ok(Ok(None)) => {
                // Legitimate EOF
                break;
            }
            Ok(Err(err_msg)) => {
                // Domain error: push down to host stream
                let _ = tx.send(StreamPayload { data: None, error: Some(err_msg) }).await;
                break;
            }
            Err(panic_err) => {
                // Caught panic: extract string or payload

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T23:41:17.300Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794786077300",
    "title": "Cross-Language Panic Boundary Containment Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "sfu-db-connector-x-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "538d3e6c1d6900c2c53ce472e048b3a06b8901e11c9575227bc5c6e87cf277da"
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
        "Harvested/verified timestamp recorded: 2026-11-15T23:41:17.300Z"
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
  "auth_token": "83477df0421ad06d9dec15298bf60390bb506c4ad1e4d1b2eb82e9b284cd64a9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
