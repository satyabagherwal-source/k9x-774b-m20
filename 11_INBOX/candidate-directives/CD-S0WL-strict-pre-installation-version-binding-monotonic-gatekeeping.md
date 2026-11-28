# Candidate Directive: [CD-S0WL] Strict Pre-Installation Version Binding & Monotonic Gatekeeping

<!-- PROVENANCE_START
{
  "source_repository": "freenet-freenet-core-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T09:34:51.926Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-freenet-freenet-core-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet-freenet-core-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T09:34:51.926Z`  
> **Learning ID**: `LEARN-EVO-freenet-freenet-core-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T09:34:52.052Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795858492052",
    "title": "Strict Pre-Installation Version Binding & Monotonic Gatekeeping",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "freenet-freenet-core-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "e4e15f1d468f604693b1a347bebfb6683339381f6b1d98948dd63a34d06a58b9"
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
        "Harvested/verified timestamp recorded: 2026-11-28T09:34:52.052Z"
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
  "auth_token": "9c97a8b29d98afbcf4d703e918cc36b98b1b704ae0fe87a0f5240264e9862967"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
