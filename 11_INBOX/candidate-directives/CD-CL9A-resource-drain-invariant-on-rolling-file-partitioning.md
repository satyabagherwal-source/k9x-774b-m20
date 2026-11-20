# Candidate Directive: [CD-CL9A] Resource Drain Invariant on Rolling File Partitioning

<!-- PROVENANCE_START
{
  "source_repository": "dathere/qsv",
  "source_url": "https://github.com/dathere/qsv",
  "source_version": "588d2c40",
  "license": "NOASSERTION",
  "timestamp": "2026-11-20T00:45:37.054Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-dathere-qsv",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dathere/qsv](https://github.com/dathere/qsv) (Revision: `588d2c40`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-20T00:45:37.054Z`  
> **Learning ID**: `learn-github-dathere-qsv`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    
    if let Some(mut writer) = self.current_writer.take() {
        writer.finish()?; // Unreachable on new_file error
    }
    self.current_writer = Some(ParquetWriter::new(new_file));
    Ok(())
}
```

**VERIFICATION METHOD**:
Inject an artificial fault (e.g., targeting a read-only directory or exceeding open file limits) on the $k$-th slice in an automated unit test. Assert that slices 0 through $k-1$ can be read and parsed by the format's decoder without encountering missing metadata footer errors.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T00:45:37.052Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795135537052",
    "title": "Resource Drain Invariant on Rolling File Partitioning",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dathere/qsv",
    "source_uri": "https://github.com/dathere/qsv",
    "source_version": "HEAD",
    "content_hash": "38837eb7e8e17f824b9b4af4e40bbf34ccd2ae1e1516432c687a38f0885f660c"
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
        "Harvested/verified timestamp recorded: 2026-11-20T00:45:37.052Z"
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
  "auth_token": "d5fce069cdd912bddac072a1a81d42531565117557147ed1e223548c8d5d408d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
