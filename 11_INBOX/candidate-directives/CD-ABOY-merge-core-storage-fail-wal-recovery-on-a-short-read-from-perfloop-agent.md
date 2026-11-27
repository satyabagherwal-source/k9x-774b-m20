# Candidate Directive: [CD-ABOY] Merge 'core/storage: fail WAL recovery on a short read' from Perfloop Agent

<!-- PROVENANCE_START
{
  "source_repository": "tursodatabase/turso",
  "source_url": "https://github.com/tursodatabase/turso",
  "source_version": "df7ba30c",
  "license": "MIT",
  "timestamp": "2026-11-27T12:21:23.506Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tursodatabase-turso",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tursodatabase/turso](https://github.com/tursodatabase/turso) (Revision: `df7ba30c`).  
> **License**: MIT | **Timestamp**: `2026-11-27T12:21:23.506Z`  
> **Learning ID**: `learn-github-tursodatabase-turso`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `core/storage/sqlite3_ondisk.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tursodatabase/turso. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `71ae9708`: Merge 'core/storage: fail WAL recovery on a short read' from Perfloop Agent. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `core/storage/sqlite3_ondisk.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
                    if let Some(err) = c.get_error() {
                        return Err(err.into());
                    }
                    if let Some(err) = completion.get_error() {
                        return Err(err.into());
                    }
            _reader.handle_header_read(res)
            reader.handle_chunk_read(offset, res)
    fn handle_header_read(
        self: Arc<Self>,
        res: Result<(Arc<Buffer>, i32), CompletionError>,
    ) -> Option<CompletionError> {
            return None;
        // The file is at least as long as the header, so a read that returns
        // fewer bytes does not mean that the WAL has no header. If recovery
        // treated it that way, the committed frames would not be visible and
        // the next write would overwrite them.
            return Some(CompletionError::ShortReadWalFrame {
                offset: 0,
                expected: WAL_HEADER_SIZE,
                actual: bytes_read as usize,
            });
            return None;
        None
    fn handle_chunk_read(
        self: Arc<Self>,
        offset: u64,
        res: Result<(Arc<Buffer>, i32), CompletionError>,
    ) -> Option<CompletionError> {
 
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
            _reader.handle_header_read(res);
            None
            reader.handle_chunk_read(res);
            None
    fn handle_header_read(self: Arc<Self>, res: Result<(Arc<Buffer>, i32), CompletionError>) {
            return;
            self.finalize_loading();
            return;
            return;
    fn handle_chunk_read(self: Arc<Self>, res: Result<(Arc<Buffer>, i32), CompletionError>) {
            return;
        let buf_slice = &buf.as_slice()[..bytes_read as usize];
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `71ae9708` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T12:21:23.504Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795782083504",
    "title": "Merge 'core/storage: fail WAL recovery on a short read' from Perfloop Agent",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tursodatabase/turso",
    "source_uri": "https://github.com/tursodatabase/turso",
    "source_version": "HEAD",
    "content_hash": "501442368c1a207036fda060037eec3e08395c97013fa9f55e877764463e71c9"
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
        "Harvested/verified timestamp recorded: 2026-11-27T12:21:23.504Z"
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
  "auth_token": "11c5f9cfb4e655f506e6080a85349e8860a0fb4415126302c780aff1f763a9b4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
