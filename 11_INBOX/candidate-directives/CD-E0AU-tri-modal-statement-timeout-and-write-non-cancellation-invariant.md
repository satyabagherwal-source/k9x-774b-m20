# Candidate Directive: [CD-E0AU] Tri-Modal Statement Timeout and Write Non-Cancellation Invariant

<!-- PROVENANCE_START
{
  "source_repository": "t8y2/dbx",
  "source_url": "https://github.com/t8y2/dbx",
  "source_version": "cf1293f6",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T21:53:06.822Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-t8y2-dbx",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [t8y2/dbx](https://github.com/t8y2/dbx) (Revision: `cf1293f6`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T21:53:06.822Z`  
> **Learning ID**: `learn-github-t8y2-dbx`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
A database client or proxy MUST NOT issue statement cancellation directives (`KILL QUERY`, connection drop, or wire cancel packets) when an explicit timeout expires on write statements (DML) or schema alterations (DDL). Timeouts MUST be modeled as a tri-modal discriminated union:
1. `Cancel`: Applied strictly to read operations (`SELECT`, `EXPLAIN`, `SHOW`); triggers active server cancellation upon deadline.
2. `Detach`: Applied to mutating writes (`INSERT`, `UPDATE`, `DELETE`); drops client-side wait loops and returns an ambiguous-execution result to the caller without dispatching server cancellation signals.
3. `Unlimited`: Applied to schema mutations (`CREATE`, `ALTER`, `DROP`) and procedural packages; runs without an automated deadline.

**WHY**:
In distributed and replicated database clusters, `KILL QUERY` only sets an interrupt flag; the statement may still partially commit on the primary while rolling back on replicas, causing non-healing binlog and replication drift. Furthermore, cancelling in-flight DDL triggers metadata lock deadlocks and prolonged cascading rollbacks that starve the entire database instance.

**WHEN TO APPLY**:
Applies to all database clients, ORM query executors, proxy layers, migration engines, and agentic database tool executors across any language (Rust, Go, TypeScript, Java, Python).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::time::Duration;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StatementScope {
    Read,
    Write,
    SchemaChange,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StatementDeadline {
    Cancel(Duration),
    Detach(Duration),
    Unlimited,
}

impl StatementDeadline {
    pub fn for_statement(scope: StatementScope, read_timeout: Option<Duration>, write_timeout: Option<Duration>) -> Self {
        match scope {
            StatementScope::SchemaChange => StatementDeadline::Unlimited,
            StatementScope::Write => match write_timeout {
                Some(dur) if !dur.is_zero() => StatementDeadline::Detach(dur),
                _ => StatementDeadline::Unlimited,
            },
            StatementScope::Read => match read_timeout {
                Some(dur) if !dur.is_zero() => StatementDeadline::Cancel(dur),
                _ => StatementDeadline::Unlimited,
            },
        }
    }

    pub fn server_cancellation_budget(&self) -> Option<Duration> {
        match self {
            StatementDeadline::Cancel(d) => Some(*d),
            StatementDeadline::Detach(_) | StatementDeadline::Unlimited => None,
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER apply a single uniform cancel-capable timeout to all SQL executions
async fn execute_query_bad(client: &Client, sql: &str, timeout_secs: u64) -> Result<ExecutionResult> {
    tokio::select! {
        res = client.execute(sql) => res,
        _ = tokio::time::sleep(Duration::from_secs(timeout_secs)) => {
            // CATASTROPHIC: Sending cancel on ALTER or bulk UPDATE leaves server
            // in undefined lock state and induces replication drift!
            client.send_kill_query().await?;
            Err(anyhow::anyhow!("Query timed out"))
        }
    }
}
```

**VERIFICATION METHOD**:
Implement a property-based test asserting that for any classified `StatementScope::Write` or `StatementScope::SchemaChange`, `server_cancellation_budget()` strictly yields `None`. Verify through an integration test against a slow `UPDATE` that client timeout returns status `DetachedUnknownResult` while the database connection pool confirms no cancellation packet was sent.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T21:53:06.820Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795557186820",
    "title": "Tri-Modal Statement Timeout and Write Non-Cancellation Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "t8y2/dbx",
    "source_uri": "https://github.com/t8y2/dbx",
    "source_version": "HEAD",
    "content_hash": "2d48077ebd2926c76740db5e2f59815bb7fc22501368958dcc8cf4fd094a119b"
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
        "Harvested/verified timestamp recorded: 2026-11-24T21:53:06.820Z"
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
  "auth_token": "6486791f33db87160e6503dde73a4cb20ae09f36c90f5578e6c384a237d3b52b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
