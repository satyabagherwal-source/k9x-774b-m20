# Candidate Directive: [CD-V3QM] File Creation Mask and Privilege Containment Invariant

<!-- PROVENANCE_START
{
  "source_repository": "rustls/rustls",
  "source_url": "https://github.com/rustls/rustls",
  "source_version": "10bb7f9c",
  "license": "NOASSERTION",
  "timestamp": "2026-11-21T20:51:24.718Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-rustls-rustls",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rustls/rustls](https://github.com/rustls/rustls) (Revision: `10bb7f9c`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-21T20:51:24.718Z`  
> **Learning ID**: `learn-github-rustls-rustls`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
```

**VERIFICATION METHOD**:
```rust
#[cfg(unix)]
#[test]
fn test_secret_sink_permissions_strictly_0o600() {
    use std::os::unix::fs::PermissionsExt;
    let temp = std::env::temp_dir().join("secret_test.log");
    let _ = std::fs::remove_file(&temp);

    let _file = open_sensitive_secret_sink(&temp).expect("File must open");
    let meta = std::fs::metadata(&temp).expect("Metadata retrieval failed");
    let mode = meta.permissions().mode() & 0o777;
    let _ = std::fs::remove_file(&temp);

    assert_eq!(mode, 0o600, "File permissions must be exactly 0o600; found {mode:#o}");
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T20:51:24.717Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795294284717",
    "title": "File Creation Mask and Privilege Containment Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rustls/rustls",
    "source_uri": "https://github.com/rustls/rustls",
    "source_version": "HEAD",
    "content_hash": "a4026446a9c521f9e2cf3fe84fe5e05a0059dff87de0bd9eb0de77bdde4928a9"
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
        "Harvested/verified timestamp recorded: 2026-11-21T20:51:24.717Z"
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
  "auth_token": "fdf3f9ddc4a307b04272424258a824d394e5c40f0c85d558580a592c52b70d30"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
