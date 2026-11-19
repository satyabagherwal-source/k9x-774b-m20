# Candidate Directive: [CD-5JYI] Empirical Invariant Guard in global_chunks.rs

<!-- PROVENANCE_START
{
  "source_repository": "lioensky/VCPToolBox",
  "source_url": "https://github.com/lioensky/VCPToolBox",
  "source_version": "a2c33d06",
  "license": "NOASSERTION",
  "timestamp": "2026-11-19T21:24:11.466Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-lioensky-vcptoolbox",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lioensky/VCPToolBox](https://github.com/lioensky/VCPToolBox) (Revision: `a2c33d06`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-19T21:24:11.466Z`  
> **Learning ID**: `learn-github-lioensky-vcptoolbox`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
                }
                let manifest: Option<(i64, String, i64, String, i64)> = connection.query_row(
                    "SELECT generation,slot,dimension,model_sig,member_versions
                     FROM global_chunk_index_baselines ORDER BY generation DESC LIMIT 1", [],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
                ).optional().map_err(|e| e.to_string())?;
                let Some((generation, slot, dimension, model, versions)) = manifest else {
                    let m
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a2c33d06` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T21:24:11.464Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795123451464",
    "title": "Empirical Invariant Guard in global_chunks.rs",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lioensky/VCPToolBox",
    "source_uri": "https://github.com/lioensky/VCPToolBox",
    "source_version": "HEAD",
    "content_hash": "4088e4d15ee986f55c1c698ddfc6c847d9d0a47b9a32c6ac1ca882183521e9bf"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Harvested/verified timestamp recorded: 2026-11-19T21:24:11.464Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "aa537b0420a5267f38e7b99b074dc0c29fc7014e45dff9e928ad9c5b120ef380"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
