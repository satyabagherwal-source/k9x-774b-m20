# Candidate Directive: [CD-3C8Q] send the hardening headers on every response

<!-- PROVENANCE_START
{
  "source_repository": "t8y2/dbx",
  "source_url": "https://github.com/t8y2/dbx",
  "source_version": "0c30c6ea",
  "license": "Apache-2.0",
  "timestamp": "2026-11-22T23:33:27.098Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-t8y2-dbx",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [t8y2/dbx](https://github.com/t8y2/dbx) (Revision: `0c30c6ea`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-22T23:33:27.098Z`  
> **Learning ID**: `learn-github-t8y2-dbx`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/dbx-web/src/main.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in t8y2/dbx. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c7c57cd5`: web): send the hardening headers on every response. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/dbx-web/src/main.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// Response headers a security scanner expects on the browser build (#15439).
///
/// The bundle is served over whatever TLS the operator terminates in front of
/// it, so the headers are unconditional: `Strict-Transport-Security` is ignored
/// by browsers on plain HTTP and takes effect as soon as the client sees HTTPS.
/// `X-XSS-Protection: 0` is the current recommendation (the legacy auditor is
/// itself an XSS vector) while still answering scanners that only look for the
/// header's presence.
const SECURITY_RESPONSE_HEADERS: [(&str, &str); 7] = [
    ("x-content-type-options", "nosniff"),
    ("x-frame-options", "SAMEORIGIN"),
    ("referrer-policy", "strict-origin-when-cross-origin"),
    ("x-xss-protection", "0"),
    ("x-download-options", "noopen"),
    ("x-permitted-cross-domain-policies", "none"),
    ("strict-transport-security", "max-age=31536000"),
];

/// Applies [`SECURITY_RESPONSE_HEADERS`] to every response, API and assets alike.
async fn security_headers(request: Request<axum::body::Body>, next: middleware::Next) -> Response {
    use axum::http::header::{HeaderName, HeaderValue};

    let mut response = next.run(request).await;
    for (name, value) in SECURI
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        mount_static_assets, normalize_public_base_path, password_viewer_enabled_from_env, web_agent_dir_from_env,
        web_body_limit_bytes_from_value, web_compression_predicate, StaticSource, XLSX_CONTENT_TYPE,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c7c57cd5` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T23:33:27.096Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795390407096",
    "title": "send the hardening headers on every response",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "t8y2/dbx",
    "source_uri": "https://github.com/t8y2/dbx",
    "source_version": "HEAD",
    "content_hash": "52633492122897eb6c18e4c98f36e2ce7b1e12079b83677c706f006179434149"
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
        "Harvested/verified timestamp recorded: 2026-11-22T23:33:27.096Z"
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
  "auth_token": "8c7ec0b122dd965ae9b1f7f2131478111f045ee130f4fa992e40818f0bde4d4d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
