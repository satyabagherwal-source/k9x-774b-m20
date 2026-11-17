# Candidate Directive: [CD-IY82] Strict Semantic Error Classification over Opaque Propagation

<!-- PROVENANCE_START
{
  "source_repository": "gitoxidelabs-gitoxide-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T02:51:31.273Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-gitoxidelabs-gitoxide-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [gitoxidelabs-gitoxide-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T02:51:31.273Z`  
> **Learning ID**: `LEARN-EVO-gitoxidelabs-gitoxide-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T02:51:31.393Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794883891393",
    "title": "Strict Semantic Error Classification over Opaque Propagation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "gitoxidelabs-gitoxide-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "3a2cf70fe904a3d4023ecb07beddad5ce2d270a2f0f697298387fc6e0ffb9b4b"
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
        "Harvested/verified timestamp recorded: 2026-11-17T02:51:31.393Z"
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
  "auth_token": "9c41272309184a0ff9625a2a2a6f595554e347be0943a151999b281073011e83"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
