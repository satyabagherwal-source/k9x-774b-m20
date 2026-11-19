# Candidate Directive: [CD-5NZ6] Empirical Invariant Guard in global_chunks.rs

<!-- PROVENANCE_START
{
  "source_repository": "lioensky-vcptoolbox-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T21:24:16.575Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-lioensky-vcptoolbox-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lioensky-vcptoolbox-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T21:24:16.575Z`  
> **Learning ID**: `LEARN-EVO-lioensky-vcptoolbox-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `rust-vexus-lite/src/global_chunks.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lioensky/VCPToolBox. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a2c33d06`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `rust-vexus-lite/src/global_chunks.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
    pub(crate) fn prepare_checkpoint_in_tx(
        &self,
        connection: &Connection,
        directory: &Path,
        threshold: f64,
        allow_initial: bool,
    ) -> Result<Option<(i64, &'static str, Vec<u8>, String, Vec<ChunkHeader>)>, String> {
        if !self.legacy_enabled { return Ok(None); }
        let (generation, active, allowed) = (|| -> Result<(i64, String, bool), String> {
            if facts(connection)? != self.facts {
                return Err("LIGHTMEMO_CHECKPOINT_GENERATION_CONFLICT".into());
            }
            let manifest: Option<(i64, String, i64, String, i64)> = connection.query_row(
                "SELECT generation,slot,dimension,model_sig,member_versions
                 FROM global_chunk_index_baselines ORDER BY generation DESC LIMIT 1", [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
            ).optional().map_err(|e| e.to_string())?;
            let Some((generation, slot, dimension, model, versions)) = manifest else {
                let mut has_file = false;
                for slot in ["a", "b"] {
                    match std::fs::metadata(slot_path(directory, slot)) {
       
```

**NEGATIVE CONSTRAINT**:
```javascript
// Induced defect failure mode:
    /// Caller holds the Runtime table mutex and shared facts gate. Publication
    /// is separate from queries; SQL member versions survive eviction/restart.
    pub fn checkpoint(&mut self, db_path: &str, directory: &Path, database_generation: u64,
        threshold: f64, allow_initial: bool) -> Result<bool, String> {
        if !self.legacy_enabled { return Ok(false); }
        let (generation, active, allowed) =
            crate::storage::with_registered_read_transaction(db_path, |connection| {
                if facts(connection)? != self.facts {
                    return Err("LIGHTMEMO_CHECKPOINT_GENERATION_CONFLICT".into());

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T21:24:16.673Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795123456673",
    "title": "Empirical Invariant Guard in global_chunks.rs",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lioensky-vcptoolbox-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "8862b1d3e1b7bba583dbb9b9526e0834a01e60d5c2f2496499acda097def87a7"
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
        "Expresses generalized engineering invariants (5 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-19T21:24:16.673Z"
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
  "auth_token": "7b54750051a90b5bf7114598b4b90522e270eed1c9bdef5751ab0c9ca28e8972"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
