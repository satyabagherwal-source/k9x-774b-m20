# Candidate Directive: [CD-I9XK] Strict Semantic Error Classification over Opaque Propagation

<!-- PROVENANCE_START
{
  "source_repository": "GitoxideLabs/gitoxide",
  "source_url": "https://github.com/GitoxideLabs/gitoxide",
  "source_version": "ab7c5dc0",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T02:50:59.912Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-gitoxidelabs-gitoxide",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [GitoxideLabs/gitoxide](https://github.com/GitoxideLabs/gitoxide) (Revision: `ab7c5dc0`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T02:50:59.912Z`  
> **Learning ID**: `learn-github-gitoxidelabs-gitoxide`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
Low-level I/O, parsing, and system-call errors **MUST NOT** be surfaced directly to callers as untyped errors or generic strings. System boundaries **MUST** classify raw failures into formal failure archetypes (`conflict`, `corruption`, `validation`, `allocation_limit`, `not_found`, `resource_exhausted`) while preserving the downcastable source cause chain.

**WHY**:
Without semantic classification, outer control loops cannot distinguish between:
1. Malformed caller arguments (`validation` error: do not retry, fail fast).
2. Transient filesystem race conditions (`conflict` error: reset caches, reload metadata, retry).
3. On-disk corruption (`corruption` error: mark pack/ref corrupt, abort operation).
4. Memory budget exhaustion (`allocation_limit` error: back off concurrency).
Blind retries or misidentifying disk corruption as validation errors creates hard-to-diagnose operational failures.

**WHEN TO APPLY**:
All systems programming libraries handling I/O, binary decoding, OS IPC, and network transactions.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Production Pattern from gix-notify/src/backend/inotify/mounts.rs & fsevents/mounts.rs
pub(super) fn snapshot(watches: &BTreeMap<PathBuf, bool>) -> Result<Snapshot> {
    let mut data = Vec::new();
    let read_result = std::fs::File::open("/proc/self/mountinfo")
        .and_then(|file| file.take(MAX_BYTES + 1).read_to_end(&mut data))
        .or_raise(|| message("could not read mount table for filesystem notification coverage"))?;

    // Hard ceiling safety checks with semantic classification
    if data.len() as u64 > MAX_BYTES {
        return Err(allocation_limit("mount table exceeds the certification budget").raise());
    }

    from_bytes(&data, watches)
        .or_raise(|| message("could not parse mount table for filesystem notification coverage"))
}

// Internal parser mapping:
fn invalid(msg: &'static str) -> std::io::Error {
    std::io::Error::new(std::io::ErrorKind::InvalidData, corruption(msg))
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Opaque I/O or String mapping losing error semantics
fn parse_mount_data(data: &[u8]) -> Result<Snapshot, String> {
    if data.len() > 65536 {
        return Err("too big".into()); // Stringly typed: caller cannot handle programmatically
    }
    // Losing OS error code or remapping everything into std::io::ErrorKind::Other
    parse(data).map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))
}
```

**VERIFICATION METHOD**:
Assertion tests verifying downcasting fidelity and semantic predicate correctness:
```rust
#[test]
fn native_error_classification_preserves_root_cause() {
    let err = is_local(Path::new("/invalid\0path")).unwrap_err();
    assert!(err.is_validation(), "NUL byte in path must be classified as validation error");
    assert!(err.downcast_any_ref::<std::ffi::NulError>().is_some(), "Inner NulError must be recoverable");
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T02:50:59.912Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794883859912",
    "title": "Strict Semantic Error Classification over Opaque Propagation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "GitoxideLabs/gitoxide",
    "source_uri": "https://github.com/GitoxideLabs/gitoxide",
    "source_version": "HEAD",
    "content_hash": "74e7820eeccca6cd4077fbc9ceef46ed23e0e040c20c2a81f4ac070f7a14f86e"
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
        "Harvested/verified timestamp recorded: 2026-11-17T02:50:59.912Z"
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
  "auth_token": "346b3efc6ac0d479c7c75cb6c9e45eaeb6e394a7ec447034cd2dbccd021a2c37"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
