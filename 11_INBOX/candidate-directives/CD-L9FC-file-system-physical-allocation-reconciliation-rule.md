# Candidate Directive: [CD-L9FC] File System Physical Allocation Reconciliation Rule

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
When an application monitors free volume headroom on copy-on-write (CoW) or journaling filesystems (e.g., NTFS, APFS, Btrfs) while performing sequential chunk truncations or hole-punching, the engine **MUST NOT** rely exclusively on volume-level free-space system APIs (`GetDiskFreeSpaceExW`, `statvfs`). If volume free space fails to reflect recently freed bytes, the engine **MUST** compute effective headroom by reconciling volume free space with file-level compressed/allocated size queries (`GetCompressedFileSizeW` or `stat.st_blocks * 512`) taken before and after the modification.

**WHY**:
Modern filesystems perform deferred metadata updates and asynchronous cluster reallocation. On Windows NTFS, calling `SetEndOfFile` immediately truncates the logical file length, but volume-level cluster bitmap updates can lag by tens of seconds if handles remain active or the filesystem worker queue is saturated. Relying purely on volume-level free space checks causes false positive `ENOSPC` errors during multi-stage batch processing.

**WHEN TO APPLY**:
Apply to storage daemons, installer engines, database compactors, and archive extractors running on Windows NTFS, Linux Btrfs/XFS, or macOS APFS where operations operate near the physical capacity limits of the block device.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::fs::File;
use std::io::Result;
use std::path::Path;

pub struct AllocationReconciler {
    last_known_allocated_file_bytes: u64,
}

impl AllocationReconciler {
    pub fn new(file_path: &Path) -> Result<Self> {
        let initial_allocated = get_physical_allocated_bytes(file_path)?;
        Ok(Self {
            last_known_allocated_file_bytes: initial_allocated,
        })
    }

    /// Calculates safe headroom accounting for filesystem accounting lag
    pub fn verify_headroom(
        &mut self,
        file_path: &Path,
        volume_path: &Path,
        required_bytes: u64,
        reserved_safety_margin: u64,
    ) -> Result<bool> {
        let volume_free = get_volume_free_bytes(volume_path)?;
        let current_file_allocated = get_physical_allocated_bytes(file_path)?;

        // Credit the physical delta freed from our own file that the volume bitmap may not yet reflect
        let freed_since_last = self.last_known_allocated_file_bytes.saturating_sub(current_file_allocated);
        self.last_known_allocated_file_bytes = current_file_allocated;

        // Effective free is raw volume free + unreconciled freed bytes
        let effective_free = volume_free.saturating_add(freed_since_last);

        // Invariant: Must satisfy required write plus safety margin
        let total_needed = required_bytes.saturating_add(reserved_safety_margin);
        Ok(effective_free >= total_needed)
    }

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T00:12:02.424Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795219922424",
    "title": "File System Physical Allocation Reconciliation Rule",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "xevrion-hatchzip-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "afd93da68a59c0bd801cf26fb11a41355c21b5f17fc7e076e9b6e494c20e2d52"
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
        "Harvested/verified timestamp recorded: 2026-11-21T00:12:02.424Z"
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
  "auth_token": "df3507a937384dc6639cf42992fd92e5b92cd88aabe61b555d2629708f4adbfd"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
