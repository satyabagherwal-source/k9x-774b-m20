# Candidate Directive: [CD-W0MR] File Creation Mask and Privilege Containment Invariant

<!-- PROVENANCE_START
{
  "source_repository": "rustls-rustls-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T20:52:07.206Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-rustls-rustls-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rustls-rustls-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T20:52:07.206Z`  
> **Learning ID**: `LEARN-EVO-rustls-rustls-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When creating or opening files destined to store cryptographic secrets, session tickets, private keys, or trace dumps (e.g., `SSLKEYLOGFILE`), you MUST open the file atomically with owner-only access permissions (`0o600` on POSIX systems: read/write by owner only, zero permissions for group and others) BEFORE any secret bytes are staged or written. You MUST NOT rely on process-level `umask`.

**WHY**:
The ambient `umask` of a process is often set to `0o022` or `0o002`, which results in files created with `0o644` (world-readable) or `0o664` (group-readable). If a system writes ephemeral session keys (pre-master secrets, client traffic secrets) to a file readable by other local accounts or containers sharing the volume, the TLS forward secrecy is broken. Attenders can intercept and decrypt all captured traffic. Setting permissions after file creation exposes a TOCTOU race window where the file exists with permissive attributes before being restricted.

**WHEN TO APPLY**:
Apply in any module writing credentials, token caches, auth caches, private keys, or debug logs containing decrypted material on POSIX/Unix environments.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::fs::{File, OpenOptions};
use std::path::Path;
#[cfg(unix)]
use std::os::unix::fs::OpenOptionsExt;

pub fn open_sensitive_secret_sink(path: &Path) -> std::io::Result<File> {
    let mut options = OpenOptions::new();
    options.append(true).create(true);

    #[cfg(unix)]
    {
        // Enforce owner-only (rw-------) atomically during creation
        options.mode(0o600);
    }

    options.open(path)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Relying on default ambient umask or changing permissions after open
pub fn unsafe_open_secret_sink(path: &Path) -> std::io::Result<File> {
    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)?; // TOCTOU GAP: Created with world-readable permissions (0o644) under standard umask!

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = file.metadata()?.permissions();
        perms.set_mode(0o600);
        file.set_permissions(perms)?; // Too late: malicious processes could open an fd during the gap
    }

    Ok(file)
}

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T20:52:07.346Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795294327346",
    "title": "File Creation Mask and Privilege Containment Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rustls-rustls-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "cd8c8f9258dcab73df38fb09a93843def72edcca694fd5649f7cdb81aca8b52e"
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
        "Harvested/verified timestamp recorded: 2026-11-21T20:52:07.346Z"
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
  "auth_token": "dfc619f8ddf4a7fdbd0931e24ba2f94926fb098620a8500b0569344d6d2e3af4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
