# Candidate Directive: [CD-4KVA] Skip absent page slots when verifying snapshots

<!-- PROVENANCE_START
{
  "source_repository": "clockworklabs/SpacetimeDB",
  "source_url": "https://github.com/clockworklabs/SpacetimeDB",
  "source_version": "340dc085",
  "license": "NOASSERTION",
  "timestamp": "2026-11-22T23:06:25.318Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-clockworklabs-spacetimedb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [clockworklabs/SpacetimeDB](https://github.com/clockworklabs/SpacetimeDB) (Revision: `340dc085`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-22T23:06:25.318Z`  
> **Learning ID**: `learn-github-clockworklabs-spacetimedb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/snapshot/src/remote.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in clockworklabs/SpacetimeDB. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `340dc085`: Skip absent page slots when verifying snapshots. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/snapshot/src/remote.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use crate::{table_present_pages, ObjectType, Snapshot, SnapshotError, SnapshotRepository};
            .flat_map(|entry| table_present_pages(&entry.pages))
            .map(|hash| self.fetch_page(hash))
    use crate::{
        Snapshot, SnapshotError, SnapshotRepository, TableEntry, CURRENT_MODULE_ABI_VERSION, CURRENT_SNAPSHOT_VERSION,
        MAGIC, ZERO_HASH_DENOTING_ABSENT_PAGE,
    };
    #[tokio::test]
    async fn verifies_snapshot_with_absent_page_slot() -> anyhow::Result<()> {
        let temp = tempdir()?;
        let snapshots = SnapshotsPath::from_path_unchecked(temp.path());
        let repo = SnapshotRepository::open(snapshots, Identity::ZERO, DUMMY_SNAPSHOT.replica_id)?;

        let tx_offset = DUMMY_SNAPSHOT.tx_offset + 1;
        let sparse = Snapshot {
            tx_offset,
            tables: vec![TableEntry {
                table_id: 0.into(),
                pages: vec![ZERO_HASH_DENOTING_ABSENT_PAGE],
            }],
            ..DUMMY_SNAPSHOT
        };

        for snapshot in [DUMMY_SNAPSHOT, sparse] {
            let dir = repo.snapshot_dir_path(snapshot.tx_offset);
            dir.create()?;
            repo.write_snapshot_file(&dir, snapshot)?;
    
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
use crate::{ObjectType, Snapshot, SnapshotError, SnapshotRepository};
            .flat_map(|entry| entry.pages.iter().copied().map(|hash| self.fetch_page(hash)))
    use crate::{Snapshot, SnapshotError, CURRENT_MODULE_ABI_VERSION, CURRENT_SNAPSHOT_VERSION, MAGIC};
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `340dc085` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T23:06:25.316Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795388785316",
    "title": "Skip absent page slots when verifying snapshots",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "clockworklabs/SpacetimeDB",
    "source_uri": "https://github.com/clockworklabs/SpacetimeDB",
    "source_version": "HEAD",
    "content_hash": "0379cd5777b7ef109b98ae283f033b035be7fbe444c05764ba4bd2a45f38c7db"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Harvested/verified timestamp recorded: 2026-11-22T23:06:25.317Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "c55315d7097365dc807c5cf4296ae4191bd5c9f0b57f854f825020efd210cee4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
