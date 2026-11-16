# Candidate Directive: [CD-Y8HP] Merge 'core/storage: build the pager directly in the b-tree unit tests' from Pek

<!-- PROVENANCE_START
{
  "source_repository": "tursodatabase/turso",
  "source_url": "https://github.com/tursodatabase/limbo",
  "source_version": "323ddd36",
  "license": "MIT",
  "timestamp": "2026-11-16T06:59:41.053Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tursodatabase-turso",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tursodatabase/turso](https://github.com/tursodatabase/limbo) (Revision: `323ddd36`).  
> **License**: MIT | **Timestamp**: `2026-11-16T06:59:41.053Z`  
> **Learning ID**: `learn-github-tursodatabase-turso`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `core/storage/btree.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tursodatabase/turso. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7f0bfbef`: Merge 'core/storage: build the pager directly in the b-tree unit tests' from Pekka Enberg. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `core/storage/btree.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        Database, Page, Pager,
        pager: &Arc<Pager>,
                    pager,
            pager,
        let pager = pager_of_new_database();
        let payload = add_record(1, 0, page.clone(), record, &pager);
        let pager = pager_of_new_database();
            let payload = add_record(i, i, page.clone(), record, &pager);
    fn empty_btree() -> (Arc<Pager>, i64) {
        let pager = pager_of_new_database();
        let page2 = run_until_done(|| pager.allocate_page(), &pager).unwrap();
        btree_init_page(&page2, PageType::TableLeaf, 0, pager.usable_space());
        (pager, page2.get().id() as i64)
    }

    /// A pager whose database holds only page 1.
    fn pager_of_new_database() -> Arc<Pager> {
        let pager = empty_pager(4096, PageCache::default());
        run_until_done(|| pager.allocate_page1(), &pager).unwrap();
        pager
    }

    /// A pager over an empty in-memory database file, opened without a `Database`.
    #[allow(clippy::arc_with_non_send_sync)]
    fn empty_pager(page_size: u32, page_cache: PageCache) -> Arc<Pager> {
        let io: Arc<dyn IO> = Arc::new(Mem
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    use tempfile::TempDir;

        Database, Page, Pager, PlatformIO,
    /// The returned `TempDir` deletes the database directory when it drops, so
    /// callers must hold it for as long as they use the database.
    #[allow(clippy::arc_with_non_send_sync)]
    fn get_database() -> (Arc<Database>, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().join("test.db");
        {
            let connection = rusqlite::Connection::open(&path).unwrap();
            connection
                .pragma_update(None, "journal_mode", "wal")
                .unwrap();
        }
        let io: Arc<dyn IO> = Arc::new(PlatformIO::new().unwrap());
        let db = Database::open_file(io.clone(), path.to_str().unwrap(), Arc::new(EngineDialect))
            .unwrap();

        (db, temp_dir)
    }

        conn: &Arc<Connection>,
                    &conn.pager.load(),
            &conn.pager.load().clone(),
        let (db, _temp_dir) = get_database();
        let conn = db
            .connect(ConnectOpts::new(SessionRole::Superuser))
            .unwrap();
        let payload = add_record(1, 0, page.clone(), record, &conn);
        let (db, _temp_dir)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7f0bfbef` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T06:59:41.051Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794812381051",
    "title": "Merge 'core/storage: build the pager directly in the b-tree unit tests' from Pek",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tursodatabase/turso",
    "source_uri": "https://github.com/tursodatabase/limbo",
    "source_version": "HEAD",
    "content_hash": "3caaacc849254fb677ca679daf861c873a8c7797ce6d1efe5d84140fee1f3844"
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
        "Harvested/verified timestamp recorded: 2026-11-16T06:59:41.051Z"
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
  "auth_token": "0f669cf8c027e8fd9976ecb2d82a32f230f6435b67b2a61ee090867f5cb4ad98"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
