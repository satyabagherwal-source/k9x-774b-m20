# Candidate Directive: [CD-90R5] Thread-Isolated Connections for High-Throughput Scoped SQLite Pipelines

<!-- PROVENANCE_START
{
  "source_repository": "gitoxidelabs-gitoxide-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T08:07:23.825Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-gitoxidelabs-gitoxide-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [gitoxidelabs-gitoxide-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T08:07:23.825Z`  
> **Learning ID**: `LEARN-EVO-gitoxidelabs-gitoxide-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When running concurrent multi-threaded worker pools accessing an embedded SQLite database, the system MUST NOT share a `rusqlite::Connection` behind a shared lock (such as `Arc<Mutex<Connection>>`) inside the worker thread execution loop. Instead, the orchestrator MUST configure the database with `PRAGMA journal_mode = WAL;` during startup, open an independent `rusqlite::Connection` per worker thread, and restrict any cross-thread shared connections strictly to out-of-band asynchronous sinks (e.g., telemetry/trace flushing).

**WHY**:
Sharing a single `Mutex<Connection>` across $N$ worker threads forces thread serialization on every SQL execution (`INSERT`, `UPDATE`), transforming a multi-threaded parallel scan into a lock-contended bottleneck. Under high thread counts, threads spend over 80% of their CPU quantum spinning on mutex acquisition. In contrast, SQLite WAL mode permits concurrent readers and concurrent distinct connections with serialized write transactions handled via OS-level file locking.

**WHEN TO APPLY**:
- Multi-threaded batch workers, data indexers, or fuzzing harnesses persisting state to SQLite.
- Microservices using embedded local SQLite storage processing concurrent pipeline jobs.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Source derived from gitoxide-core/src/corpus/engine.rs
let db_path = self.con.path().expect("database has path").to_owned();

gix::parallel::in_parallel_with_slice(
    &mut repos,
    Some(threads),
    {
        // Thread initialization factory closure:
        let db_path = db_path.clone();
        move |tid| {
            // Allocate an independent, unshared connection for this thread's lifecycle
            let thread_local_con = rusqlite::Connection::open(&db_path);
            (tid, thread_local_con)
        }
    },
    |repo, (_tid, con), _threads_left, should_interrupt| -> Result<()> {
        let con = match con {
            Ok(c) => c,
            Err(e) => {
                should_interrupt.store(true, Ordering::SeqCst);
                return Err(e.into());
            }
        };
        // Perform updates using the thread-local connection without Mutex locking
        Self::insert_run(con, gitoxide_id, runner_id, task_id, repo.id)?;
        Ok(())
    },
    || (!gix::interrupt::is_triggered()).then(|| Duration::from_millis(100)),
    drop,
)?;
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Wrapping a single SQLite connection in an Arc<Mutex> and passing
// it to concurrent workers. Every query serializes all worker threads.
let shared_con = Arc::new(Mutex::new(rusqlite::Connection::open(&db_path)?));

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T08:07:23.921Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794989243921",
    "title": "Thread-Isolated Connections for High-Throughput Scoped SQLite Pipelines",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "gitoxidelabs-gitoxide-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "af08dcd6bc2be38518e63210aca5b5078c447a33dda0a56412cbf7b10a9d4d1e"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-18T08:07:23.921Z"
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
  "auth_token": "95a01bad444e066b76a85c207712f8256b5f9e53969bfba0b5d100e13bb23f31"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
