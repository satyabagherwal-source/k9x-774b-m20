# Candidate Directive: [CD-L9FB] Reverse-Unit Monotonic Truncation Invariant

<!-- PROVENANCE_START
{
  "source_repository": "xevrion-hatchzip-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T00:12:02.298Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-xevrion-hatchzip-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [xevrion-hatchzip-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T00:12:02.298Z`  
> **Learning ID**: `LEARN-EVO-xevrion-hatchzip-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When transforming or extracting discrete multi-file container formats in-place under strict storage constraints, the engine **MUST** process container units in reverse file-offset order (highest physical byte offset to lowest physical byte offset). The central structural metadata at the container tail **MUST** be snapshotted to a durable auxiliary structure prior to the first truncation, and container length reductions **MUST** occur strictly via monotonic truncation calls (`ftruncate` / `SetEndOfFile`) matching the unit's start boundary.

**WHY**:
Container headers typically index payload data via absolute byte offsets from the start of the file ($Offset_0$). If extraction proceeds front-to-back, truncating or modifying the front of the file invalidates all downstream absolute offsets and corrupts file header tables. Furthermore, operating systems natively support $O(1)$ file truncation from the end of a file descriptor, whereas shifting blocks from the front requires $O(K)$ disk rewrites. Processing from highest to lowest offset ensures all remaining unextracted payloads maintain valid, untouched absolute byte offsets relative to offset 0.

**WHEN TO APPLY**:
Apply to any system implementing in-place migration, in-place archive conversion, or zero-headroom unpacking of formats featuring tail-located or offset-indexed catalogs (ZIP, 7z, ISO 9660, TAR indexes).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::fs::File;
use std::io::{Result, Seek, SeekFrom};
use std::path::Path;

pub struct TruncatingContainerEngine {
    container_file: File,
    tail_snapshot: Vec<u8>,
    units_reverse: Vec<ContainerUnit>, // Sorted by .start ascending, popped from back
}

pub struct ContainerUnit {
    pub start_offset: u64,
    pub packed_len: u64,
    pub payload_id: usize,
}

impl TruncatingContainerEngine {
    pub fn process_next_unit<F>(&mut self, mut extract_fn: F) -> Result<bool>
    where
        F: FnMut(&ContainerUnit, &mut File) -> Result<()>,
    {
        let Some(unit) = self.units_reverse.pop() else {
            return Ok(false); // Finished
        };

        // 1. Extract payload reading from unit.start_offset
        self.container_file.seek(SeekFrom::Start(unit.start_offset))?;
        extract_fn(&unit, &mut self.container_file)?;

        // 2. Ensure payload is flushed and synced on destination filesystem
        // (Handled by extract_fn caller)

        // 3. Monotonically truncate container to unit start offset
        // This instantly frees packed_len on disk while keeping lower offsets 100% valid
        self.container_file.set_len(unit.start_offset)?;
        self.container_file.sync_data()?;

        Ok(true)

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T00:12:02.418Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795219922417",
    "title": "Reverse-Unit Monotonic Truncation Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "xevrion-hatchzip-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "62bb16868220c1d12f17e62f1378c4fff1de32e06a51f94e29ae087af826951f"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-21T00:12:02.418Z"
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
  "auth_token": "fe77267226ef7078c44914e73605476199317270e1a19a1cfffd4b96ad668a97"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
