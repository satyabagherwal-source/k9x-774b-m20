# Candidate Directive: [CD-E43F] Resource Drain Invariant on Rolling File Partitioning

<!-- PROVENANCE_START
{
  "source_repository": "dathere-qsv-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T00:46:48.013Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-dathere-qsv-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dathere-qsv-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T00:46:48.013Z`  
> **Learning ID**: `LEARN-EVO-dathere-qsv-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When streaming data into partition-sliced sinks (e.g., rolling CSV/Parquet writers created via pattern templates like `out_{}.csv`), the active sink MUST be explicitly flushed and cleanly finalized (e.g., writing Parquet metadata footers, flushing inner buffers, transferring file descriptor ownership) BEFORE the next partition sink is opened or any subsequent fallible operation is evaluated.

**WHY**:
In columnar formats like Apache Parquet, structural footers (file metadata, schema definition, row-group pointers, and dictionary pages) are appended strictly during writer finalization (`into_inner()` or `close()`). If an application attempts to open partition $N+1$ before partition $N$ is finalized, an I/O failure (such as `ENOSPC`, permission denial, or directory traversal rejection) on $N+1$ causes an early return via the `?` operator. This leaves partition $N$ unclosed and missing its footer, corrupting the generated dataset. Furthermore, overlapping open handles across large chunk counts exhaust the operating system's file descriptor limit (`EMFILE`).

**WHEN TO APPLY**:
Apply in any data-streaming subsystem that shards output based on record counts, byte thresholds, or key boundaries across file systems, object stores, or network streams.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::fs::File;
use std::path::Path;
use polars::prelude::*;

pub struct RollingColumnarWriter {
    template: String,
    current_writer: Option<ParquetWriter<File>>,
    schema: SchemaRef,
}

impl RollingColumnarWriter {
    pub fn rotate_sink(&mut self, next_path: &Path) -> Result<(), Box<dyn std::error::Error>> {
        // Step 1: Explicitly flush, seal, and drop the current sink
        if let Some(mut writer) = self.current_writer.take() {
            // Force write the footer and flush internal page buffers.
            // DO NOT leave this to a trailing Drop guard!
            writer.finish()?;
        }

        // Step 2: Open the subsequent sink strictly AFTER partition N is sealed
        let new_file = File::create(next_path)?;
        let new_writer = ParquetWriter::new(new_file)
            .with_compression(ParquetCompression::Snappy);
            
        self.current_writer = Some(new_writer);
        Ok(())
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Opening next sink before sealing previous sink
pub fn rotate_sink_leaky(&mut self, next_path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    // BUG: If File::create fails, self.current_writer is never cleanly finished!
    // Its Parquet footer is skipped, and two file descriptors remain open concurrently.
    let new_file = File::create(next_path)?;

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T00:46:48.121Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795135608121",
    "title": "Resource Drain Invariant on Rolling File Partitioning",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dathere-qsv-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "e1c8574cbc6d0748f5ce23c10bab1e550cf350116b9bab712e491ade1f99efd3"
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
        "Harvested/verified timestamp recorded: 2026-11-20T00:46:48.122Z"
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
  "auth_token": "91fe2e2e9555f5760fd9cde82057e86f9f62b17fcdebf230c1fa9783c3edb667"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
