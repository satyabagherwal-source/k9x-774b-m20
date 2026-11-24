# Candidate Directive: [CD-EUUZ] Tri-Modal Statement Timeout and Write Non-Cancellation Invariant

<!-- PROVENANCE_START
{
  "source_repository": "t8y2-dbx-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T21:53:46.273Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-t8y2-dbx-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [t8y2-dbx-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T21:53:46.273Z`  
> **Learning ID**: `LEARN-EVO-t8y2-dbx-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T21:53:46.422Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795557226422",
    "title": "Tri-Modal Statement Timeout and Write Non-Cancellation Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "t8y2-dbx-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "f3eb1bdee538ebf1cc071092ab2d2903d9d1e563e4d5488d409dbc94ffd9c2c3"
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
        "Harvested/verified timestamp recorded: 2026-11-24T21:53:46.423Z"
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
  "auth_token": "87be550ab959252819fbea8971a260c129b742c597ed3ad2349fff977b45666e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
