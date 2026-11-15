# Candidate Directive: [CD-8RSS] Cross-Language Panic Boundary Containment Invariant

<!-- PROVENANCE_START
{
  "source_repository": "sfu-db/connector-x",
  "source_url": "https://github.com/sfu-db/connector-x",
  "source_version": "ac243a1b",
  "license": "MIT",
  "timestamp": "2026-11-15T23:39:58.780Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-sfu-db-connector-x",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sfu-db/connector-x](https://github.com/sfu-db/connector-x) (Revision: `ac243a1b`).  
> **License**: MIT | **Timestamp**: `2026-11-15T23:39:58.780Z`  
> **Learning ID**: `learn-github-sfu-db-connector-x`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
                let panic_msg = if let Some(s) = panic_err.downcast_ref::<&str>() {
                    s.to_string()
                } else if let Some(s) = panic_err.downcast_ref::<String>() {
                    s.clone()
                } else {
                    "Unknown native panic occurred inside stream worker".to_string()
                };
                
                // Transmit error sentinel before terminating thread
                let _ = tx.send(StreamPayload {
                    data: None, 
                    error: Some(format!("FATAL NATIVE WORKER PANIC: {}", panic_msg))
                }).await;
                break;
            }
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER allow thread panic or silent worker drop to act as stream termination!
pub fn BAD_stream_producer<T>(tx: std::sync::mpsc::Sender<T>) {
    std::thread::spawn(move || {
        // If this unwraps on an out-of-range date (e.g. year 0001), 
        // the thread dies instantly, tx is dropped, and the Python client
        // receives an empty stream with ZERO error raised!
        let row = fetch_next_database_row().unwrap(); 
        tx.send(row).unwrap();
    });
}
```

**VERIFICATION METHOD**:
Implement integration test harnesses that inject poison payloads (e.g., date ranges outside chrono/arrow bounds) and assert that an explicit Python `ConnectorXError` exception is thrown instead of returning an empty or truncated DataFrame.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T23:39:58.779Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794785998779",
    "title": "Cross-Language Panic Boundary Containment Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "sfu-db/connector-x",
    "source_uri": "https://github.com/sfu-db/connector-x",
    "source_version": "HEAD",
    "content_hash": "90be7ee20c24e912200699f1218ec21f87a452ac9063f6403f4241243c573dea"
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
        "Harvested/verified timestamp recorded: 2026-11-15T23:39:58.779Z"
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
  "auth_token": "a6bb885c6d599473a5a01d4c8c10832e5453315ddca0a0d0adb6dc0817a0b45c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
