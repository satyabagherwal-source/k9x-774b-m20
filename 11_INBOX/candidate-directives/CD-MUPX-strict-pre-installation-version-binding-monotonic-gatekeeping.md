# Candidate Directive: [CD-MUPX] Strict Pre-Installation Version Binding & Monotonic Gatekeeping

<!-- PROVENANCE_START
{
  "source_repository": "freenet/freenet-core",
  "source_url": "https://github.com/freenet/freenet-core",
  "source_version": "eb8f4fc3",
  "license": "NOASSERTION",
  "timestamp": "2026-11-28T09:30:50.757Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-freenet-freenet-core",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet/freenet-core](https://github.com/freenet/freenet-core) (Revision: `eb8f4fc3`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-28T09:30:50.757Z`  
> **Learning ID**: `learn-github-freenet-freenet-core`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
Any self-updating executable or software distribution system MUST statically extract, verify, and semantically compare target binary versions against the currently running version before staging or swapping binaries. The target version MUST be strictly monotonically newer than the current version ($V_{\text{target}} > V_{\text{current}}$) unless an explicit `--force` flag is provided. The update process MUST verify that the downloaded binary is a regular executable file (not a symlink or hardlink), matches the exact release tag, and reports identical semver strings via `--version`. Failures MUST distinguish between deterministic verification rejections (counted against an install-failure circuit breaker) and transient network errors.

**WHY**:
Without monotonic version verification and asset tag checks:
1. An attacker or corrupted CDN can serve an outdated, vulnerable release binary (downgrade/rollback attack).
2. Archive unpacking could introduce symlink traversal exploits (`tar` symlink pointing outside staging root), allowing arbitrary file overwrite upon chmod/execution.
3. Silent binary mismatches or failed runs will enter continuous crash loops, repeatedly downloading and restarting failed installations.

**WHEN TO APPLY**:
Apply to client-side self-updaters, daemon update managers, and automated background deployment agents across all desktop and server platforms.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// In crates/core/src/bin/commands/update.rs
use semver::Version;
use std::fs;
use std::path::Path;

#[derive(Debug)]
pub struct ReleaseVerificationError(pub String);
impl std::fmt::Display for ReleaseVerificationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Verification failed: {}", self.0)
    }
}
impl std::error::Error for ReleaseVerificationError {}

pub fn validate_and_gate_version(
    current_version_str: &str,
    target_tag: &str,
    force: bool,
) -> Result<Version, ReleaseVerificationError> {
    let current_ver = Version::parse(current_version_str)
        .map_err(|e| ReleaseVerificationError(format!("Invalid current semver: {e}")))?;
    
    // Normalize release tag (e.g., "v0.1.5" -> "0.1.5")
    let raw_tag = target_tag.strip_prefix('v').unwrap_or(target_tag);
    let expected_version = Version::parse(raw_tag)
        .map_err(|e| ReleaseVerificationError(format!("Invalid release tag semver {target_tag}: {e}")))?;

    if !force && expected_version <= current_ver {
        return Err(ReleaseVerificationError(format!(
            "Refusing non-upgrade install: target version {expected_version} is not newer than current version {current_ver}."
        )));
    }

    Ok(expected_version)
}

pub fn ensure_regular_binary_in_root(binary_path: &Path, staging_root: &Path) -> Result<(), ReleaseVerificationError> {
    let canonical_root = staging_root.canonicalize()
        .map_err(|e| ReleaseVerificationError(format!("Invalid staging root: {e}")))?;
    let canonical_bin = binary_path.canonicalize()
        .map_err(|e| ReleaseVerificationError(format!("Invalid binary path: {e}")))?;

    // Reject symlinks outside staging root
    if !canonical_bin.starts_with(&canonical_root) {
        return Err(ReleaseVerificationError(format!(
            "Binary path escapes staging root: {} outside {}",
            canonical_bin.display(),
            canonical_root.display()
        )));
    }

    let meta = fs::symlink_metadata(binary_path)
        .map_err(|e| ReleaseVerificationError(format!("Metadata read failed: {e}")))?;

    if meta.file_type().is_symlink() {
        return Err(ReleaseVerificationError("Extracted binary must not be a symlink".into()));
    }
    if !meta.file_type().is_file() {
        return Err(ReleaseVerificationError("Extracted binary must be a regular file".into()));
    }

    Ok(())
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER download and install without verifying that the target tag is strictly newer
let release = fetch_latest_release().await?;
replace_binary(&release.asset_url).await?; // VULNERABILITY: Can downgrade to older compromised version

// NEVER extract binaries directly from tar archives without symlink validation
for entry in archive.entries()? {
    entry?.unpack_in(staging_dir)?; // VULNERABILITY: Symlink "../../../../bin/target" permits file overwrite
}
```

**VERIFICATION METHOD**:
Write integration tests where a mock updater attempts:
1. Upgrading from version `0.2.0` to `0.1.9` without `--force`. Ensure it returns `ReleaseVerificationError` and exits.
2. Unpacking a tarball containing a symlinked binary pointing to `/usr/bin/touch`. Ensure `ensure_regular_binary_in_root` halts before `chmod +x` or execution.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T09:30:50.756Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.66,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 66%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795858250756",
    "title": "Strict Pre-Installation Version Binding & Monotonic Gatekeeping",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "freenet/freenet-core",
    "source_uri": "https://github.com/freenet/freenet-core",
    "source_version": "HEAD",
    "content_hash": "a0d133dc567a869be399212d948acc5b5d4964bec8dcfbfea596f464539c8ab8"
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
      "score": 0.8,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
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
        "Harvested/verified timestamp recorded: 2026-11-28T09:30:50.756Z"
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
  "auth_token": "91fc86e93a861ab1f26dc33d29a6050f00d6830f727a71697f214701655b3f1b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
