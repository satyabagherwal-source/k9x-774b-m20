# Candidate Directive: [CD-L6A6] Reverse-Unit Monotonic Truncation Invariant

<!-- PROVENANCE_START
{
  "source_repository": "xevrion/hatchzip",
  "source_url": "https://github.com/xevrion/hatchzip",
  "source_version": "2489b928",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T00:11:58.350Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-xevrion-hatchzip",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [xevrion/hatchzip](https://github.com/xevrion/hatchzip) (Revision: `2489b928`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T00:11:58.350Z`  
> **Learning ID**: `learn-github-xevrion-hatchzip`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER do in-place front-to-back truncation or shift-writes
pub fn bad_inplace_extract(file: &mut File, units: Vec<ContainerUnit>) {
    for unit in units {
        extract_payload(file, unit.start_offset, unit.packed_len);
        // WRONG: Modifying or zeroing the front invalidates subsequent offsets,
        // or requires shifting the entire remainder of the multi-gigabyte file forward!
        shift_remaining_file_bytes_forward(file, unit.packed_len);
    }
}
```

**VERIFICATION METHOD**:
Verify using a synthetic container containing 100 random blocks. Implement an automated integration test that asserts:
1. `file.metadata()?.len() == current_unit.start_offset` after each step.
2. An injected crash at step $K$ leaves the container readable from $0$ to $K$'s offset via `tail_snapshot`.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T00:11:58.348Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795219918348",
    "title": "Reverse-Unit Monotonic Truncation Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "xevrion/hatchzip",
    "source_uri": "https://github.com/xevrion/hatchzip",
    "source_version": "HEAD",
    "content_hash": "1c78ac1786ad170d978d8033c32ac3da0afa3b3ed78cc4bb8a233fd08c834278"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-21T00:11:58.348Z"
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
  "auth_token": "937f6a1425b08c5a10cc0ba5121b55108f7afe2e8e045c67754ec0583d4d3145"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
