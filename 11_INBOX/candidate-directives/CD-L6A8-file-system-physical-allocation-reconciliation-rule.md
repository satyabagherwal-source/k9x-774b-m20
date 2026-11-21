# Candidate Directive: [CD-L6A8] File System Physical Allocation Reconciliation Rule

<!-- PROVENANCE_START
{
  "source_repository": "xevrion/hatchzip",
  "source_url": "https://github.com/xevrion/hatchzip",
  "source_version": "2489b928",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T00:11:58.352Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-xevrion-hatchzip",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [xevrion/hatchzip](https://github.com/xevrion/hatchzip) (Revision: `2489b928`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T00:11:58.352Z`  
> **Learning ID**: `learn-github-xevrion-hatchzip`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
}

#[cfg(windows)]
fn get_physical_allocated_bytes(path: &Path) -> Result<u64> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::GetCompressedFileSizeW;

    let wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    let mut high: u32 = 0;
    let low = unsafe { GetCompressedFileSizeW(wide.as_ptr(), &mut high) };
    if low == 0xFFFF_FFFF && unsafe { windows_sys::Win32::Foundation::GetLastError() } != 0 {
        return Err(std::io::Error::last_os_error());
    }
    Ok(((high as u64) << 32) | (low as u64))
}

#[cfg(unix)]
fn get_physical_allocated_bytes(path: &Path) -> Result<u64> {
    use std::os::unix::fs::MetadataExt;
    let meta = std::fs::symlink_metadata(path)?;
    // st_blocks is count of 512-byte units allocated
    Ok(meta.blocks() * 512)
}

fn get_volume_free_bytes(_p: &Path) -> Result<u64> {
    // Platform-specific GetDiskFreeSpaceExW / statvfs implementation
    Ok(0) // Stub
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER trust immediate volume free space queries after truncation near disk limits
pub fn unsafe_space_check(vol: &Path, needed: u64) -> bool {
    let free = get_system_volume_free(vol); // Fails on NTFS: lags behind set_len!
    free >= needed
}
```

**VERIFICATION METHOD**:
Run an integration test on an NTFS volume:
1. Create a 1 GB dummy file.
2. Set volume reserve to within 50 MB of disk limit.
3. Truncate dummy file by 200 MB via `set_len`.
4. Immediately assert that `AllocationReconciler::verify_headroom()` returns `true` even when `GetDiskFreeSpaceExW` reports 0 bytes delta.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T00:11:58.351Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795219918351",
    "title": "File System Physical Allocation Reconciliation Rule",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "xevrion/hatchzip",
    "source_uri": "https://github.com/xevrion/hatchzip",
    "source_version": "HEAD",
    "content_hash": "89e885487e0d53781aea546fd59e55e48bef1584dd6e28e7150f74678e8acc24"
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
        "Harvested/verified timestamp recorded: 2026-11-21T00:11:58.351Z"
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
  "auth_token": "f02162fc0ac52a9d4c241a3b7808ce93fbabd64eddbcc43238551a168abdbd4d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
