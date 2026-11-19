# Candidate Directive: [CD-TUHY] Zero-Allocation Reusable Serialization Buffer Invariant

<!-- PROVENANCE_START
{
  "source_repository": "medialab-xan-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T07:43:16.294Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-medialab-xan-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [medialab-xan-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T07:43:16.294Z`  
> **Learning ID**: `LEARN-EVO-medialab-xan-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
Inner loops serializing heterogeneous numeric or dynamic fields to byte streams MUST NEVER allocate intermediate heap strings (`to_string()`, `format!()`). They MUST format directly into a cleared, pre-allocated thread-local or stack-bound scratch buffer (such as `zmij::Buffer`, `itoa::Buffer`, or `ryu::Buffer`) and pass the resulting borrowed byte slice (`&[u8]`) directly to the destination field writer.

**WHY**:
Invoking `.to_string()` inside a nested record-processing loop triggers heap allocations (`malloc`/`free`) per row, per column. When processing $10^7$ rows with 20 columns, this introduces $2 \times 10^8$ allocation cycles, causing severe allocator lock contention, cache-line invalidation, and throughput degradation.

**WHEN TO APPLY**:
Apply to any data pipeline, serializing agent, CSV/JSON parser, or telemetry emitter iterating over data structures at rates $>10,000\text{ items/sec}$.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Production Pattern from src/cmd/from.rs using zmij::Buffer
use std::io::Write;
use std::num::NonZeroUsize;

pub fn write_matrix_to_csv<W: Write, T: zmij::Format>(
    wtr: &mut simd_csv::Writer<W>,
    data: &[T],
    columns: usize,
) -> Result<(), std::io::Error> {
    let mut fields_writer = wtr.fields_writer();
    let mut buffer = zmij::Buffer::new(); // Allocated ONCE outside the loop

    for chunk in data.chunks(columns) {
        for &cell_val in chunk {
            // buffer.format() writes directly to stack-allocated internal byte storage
            // as_bytes() returns a borrowed slice without allocating a heap String
            fields_writer.write_field_no_quoting(buffer.format(cell_val).as_bytes())?;
        }
        fields_writer.finalize_record()?;
    }
    Ok(())
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Heap churn per cell serialization
for chunk in data.chunks(columns) {
    // Allocates a new String on the heap for every column of every row
    wtr.write_record_no_quoting(
        chunk.iter().map(|cell| cell.to_string())
    )?;
}
```

**VERIFICATION METHOD**:
Verify using a memory profiling harness (`dhat` or `valgrind --tool=massif`) and assert that heap allocations during the serialization loop are zero ($0\text{ bytes alloc/free}$):
```rust

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T07:43:16.387Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795074196387",
    "title": "Zero-Allocation Reusable Serialization Buffer Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "medialab-xan-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "dcf10a558d9de0dfc70ae032d63cfd11a2903ec56c470beff12fa1db1402c39a"
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
        "Harvested/verified timestamp recorded: 2026-11-19T07:43:16.388Z"
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
  "auth_token": "0b95e2a55165275b58910a7895f350d15c131897f20b2f53c42ed43c34143caf"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
