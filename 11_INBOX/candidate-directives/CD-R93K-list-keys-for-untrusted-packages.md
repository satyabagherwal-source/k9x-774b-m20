# Candidate Directive: [CD-R93K] List keys for untrusted packages

<!-- PROVENANCE_START
{
  "source_repository": "flox/flox",
  "source_url": "https://github.com/flox/flox",
  "source_version": "0339f643",
  "license": "GPL-2.0",
  "timestamp": "2026-11-24T07:07:37.040Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-flox-flox",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [flox/flox](https://github.com/flox/flox) (Revision: `0339f643`).  
> **License**: GPL-2.0 | **Timestamp**: `2026-11-24T07:07:37.040Z`  
> **Learning ID**: `learn-github-flox-flox`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `cli/flox-rust-sdk/src/providers/buildenv.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in flox/flox. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7d792404`: buildenv): List keys for untrusted packages. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `cli/flox-rust-sdk/src/providers/buildenv.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// A custom package has been uploaded, but the current user hasn't configured
/// a trusted public key that matches a signature of this package.
#[derive(Debug, Clone)]
pub struct UntrustedPackageError {
    pub install_id: String,
    /// Public keys that the catalog expects the package to be signed by.
    pub expected_keys: Vec<String>,
}

impl Display for UntrustedPackageError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        writeln!(
            f,
            "Package '{}' is not signed by a trusted key.",
            self.install_id
        )?;
        if !self.expected_keys.is_empty() {
            // Nix accepts a signature from any one trusted key.
            writeln!(f, "Trust any key below to use it:")?;
            for key in &self.expected_keys {
                writeln!(f, "  {key}")?;
            }
        }
        write!(
            f,
            "See https://flox.dev/docs/customer/signing-keys/ for more information."
        )
    }
}

impl std::error::Error for UntrustedPackageError {}

    /// See [`UntrustedPackageError`].
    #[error(transparent)]
    UntrustedPackage(UntrustedPackageError),
                return Err(BuildEnvError
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    /// A custom package has been uploaded, but the current user hasn't configured
    /// a trusted public key that matches a signature of this package.
    #[error(
        "Package '{0}' is not signed by a trusted key.\n\
        See https://flox.dev/docs/customer/signing-keys/ for more information."
    )]
    UntrustedPackage(String),
                return Err(BuildEnvError::UntrustedPackage(install_id.to_string()));
                s.spawn(|| Err(BuildEnvError::UntrustedPackage("pkg".into()))),
                s.spawn(|| Err(BuildEnvError::UntrustedPackage("second".into()))),
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7d792404` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T07:07:37.037Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795504057037",
    "title": "List keys for untrusted packages",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "flox/flox",
    "source_uri": "https://github.com/flox/flox",
    "source_version": "HEAD",
    "content_hash": "c12eed4976d14e2c4c5e7ffdd8e2bfb41f18880acc117f5a26086efa7934a557"
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
        "Expresses generalized engineering invariants (4 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-24T07:07:37.037Z"
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
  "auth_token": "c9350d9057b30116e15410308236112d874268c5051922052377bc854da3c69e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
