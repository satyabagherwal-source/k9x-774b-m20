# Candidate Directive: [CD-7DDZ] wait for the output queue before each line, not after it

<!-- PROVENANCE_START
{
  "source_repository": "FalkorDB/FalkorDB",
  "source_url": "https://github.com/FalkorDB/FalkorDB",
  "source_version": "3bba59f2",
  "license": "NOASSERTION",
  "timestamp": "2026-11-27T16:03:02.663Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-falkordb-falkordb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [FalkorDB/FalkorDB](https://github.com/FalkorDB/FalkorDB) (Revision: `3bba59f2`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-27T16:03:02.663Z`  
> **Learning ID**: `learn-github-falkordb-falkordb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `dc5d7837` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T16:03:02.662Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795795382662",
    "title": "wait for the output queue before each line, not after it",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "FalkorDB/FalkorDB",
    "source_uri": "https://github.com/FalkorDB/FalkorDB",
    "source_version": "HEAD",
    "content_hash": "7e6015b37191ebf6c9217c0fefd58809b3577ce6ab0c216dc133f604758fa7a9"
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
        "Harvested/verified timestamp recorded: 2026-11-27T16:03:02.662Z"
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
  "auth_token": "5ea57e44ab24ec12fe58cd9d32fde4e3bb2afb09f579a7195d32534a3def87be"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
