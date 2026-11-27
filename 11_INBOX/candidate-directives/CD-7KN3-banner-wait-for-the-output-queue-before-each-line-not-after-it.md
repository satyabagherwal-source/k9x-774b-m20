# Candidate Directive: [CD-7KN3] banner): wait for the output queue before each line, not after it

<!-- PROVENANCE_START
{
  "source_repository": "falkordb-falkordb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T16:03:11.920Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-falkordb-falkordb-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [falkordb-falkordb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T16:03:11.920Z`  
> **Learning ID**: `LEARN-EVO-falkordb-falkordb-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/banner/mod.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in FalkorDB/FalkorDB. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `dc5d7837`: banner): wait for the output queue before each line, not after it. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/banner/mod.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        fd::{AsFd, AsRawFd, BorrowedFd, RawFd},
/// Writes `text` to `tty` a line at a time. Before each line it waits up to
/// `wait` for the output queue to empty, and it stops at the first line it
/// cannot send. Returns whether all of `text` was written.
///
/// Waiting before each line rather than after it means `tty` is not touched
/// after the last line: if the terminal closes as soon as it has read all of
/// `text`, the result is still true.
    tty: &mut (impl Write + AsFd),
        .all(|line| drained(tty.as_fd(), wait) && tty.write_all(line.as_bytes()).is_ok())
    tty: BorrowedFd<'_>,
        io::{self, Read, Write},
        os::fd::{AsFd, AsRawFd, BorrowedFd, FromRawFd, OwnedFd},
    /// A terminal that reads every write at once and closes as soon as it has
    /// the whole banner, before `write_bounded` returns. The reader thread in
    /// `whole_banner_reaches_a_draining_terminal` does the same when it beats
    /// the writer on a busy machine (#4073). On Linux, closing the master end
    /// hangs up the slave end, and every later call on it fails with EIO. macOS
    /// still answers TIOCOUTQ after that, so this test guards Linux only.
    struct ClosesOnceI
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        fd::{AsRawFd, RawFd},
/// Writes `text` to `tty` a line at a time, each line only once the previous
/// one has left the output queue; stops at the first line the terminal does
/// not take within `wait`. Returns whether all of `text` was written.
    tty: &mut File,
        .all(|line| tty.write_all(line.as_bytes()).is_ok() && drained(tty, wait))
    tty: &File,
        io::Read,
        os::fd::{FromRawFd, OwnedFd},
```

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T16:03:12.059Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795795392059",
    "title": "banner): wait for the output queue before each line, not after it",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "falkordb-falkordb-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "a59ad556144615c19b0e910383183ba0de8dc37d63ba20d604b7a07b48c85005"
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
        "Harvested/verified timestamp recorded: 2026-11-27T16:03:12.060Z"
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
  "auth_token": "024f332ef4b2bd03fd4f29abd0061e3ec5651088d8de9a367627ae4d9ca76f23"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
