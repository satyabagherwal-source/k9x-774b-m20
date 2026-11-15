# Candidate Directive: [CD-AGDW] URL Preservation Invariant Under Parameter Stripping

<!-- PROVENANCE_START
{
  "source_repository": "sfu-db-connector-x-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T23:41:17.186Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-sfu-db-connector-x-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sfu-db-connector-x-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T23:41:17.186Z`  
> **Learning ID**: `LEARN-EVO-sfu-db-connector-x-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When filtering, stripping, or modifying query parameters in connection strings or URIs forwarded to downstream database drivers, systems **MUST NOT** parse and re-serialize the entire query string using standard `application/x-www-form-urlencoded` formatters. Instead, parameter stripping **MUST** be performed via raw byte/string slice decomposition that selectively excises matched key-value pairs while keeping all untouched parameters, original separators, and percent-encodings byte-for-byte identical.

**WHY**:
Standard URI query mutators (such as Rust's `url::Url::query_pairs_mut()` or Python's `urllib.parse.urlencode()`) convert spaces (`%20`) into plus signs (`+`) under standard HTML form conventions. Downstream database engines and network drivers (e.g., `libpq`, `rust-postgres`, `tiberius`, `prusto`) adhere strictly to RFC 3986 percent-decoding rules. If an engine passes connection parameters (such as `options=-c statement_timeout=1s` or password salts) through an HTML form serializer, `-c%20statement_timeout=1s` becomes `-c+statement_timeout=1s`. The target database server then receives the literal parameter `+statement_timeout=1s`, fails option parsing, and aborts the connection.

**WHEN TO APPLY**:
Apply in any proxy, gateway, driver wrapper, microservice, or ETL engine that intercepts, validates, or rewrites database connection strings, S3/blob store URIs, or webhook endpoints before passing them to low-level native network drivers.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use url::{form_urlencoded, Url};

/// Strips targeted parameters from a URL's query string while leaving 
/// untouched parameters completely identical at the raw byte/slice level.
pub fn excise_query_params(url: &Url, params_to_remove: &[&str]) -> Url {
    let mut sanitized_url = url.clone();
    let query_str = match url.query() {
        Some(q) if !q.is_empty() => q,
        _ => return sanitized_url,
    };

    let preserved_segments: Vec<&str> = query_str
        .split('&')
        .filter(|segment| !segment.is_empty())
        .filter(|segment| {
            // Extract the raw key up to the first '=' delimiter
            let raw_key = segment.split('=').next().unwrap_or_default();
            
            // Decode ONLY the key slice to compare against target removal tokens
            let decoded_key = form_urlencoded::parse(raw_key.as_bytes())
                .next()
                .map(|(k, _)| k)
                .unwrap_or_default();
            
            // Retain segment only if it does not match any targeted removal keys
            !params_to_remove.contains(&&*decoded_key)
        })
        .collect();

    let new_query = preserved_segments.join("&");
    sanitized_url.set_query(if new_query.is_empty() {
        None
    } else {
        Some(&new_query)
    });

    sanitized_url
}

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T23:41:17.295Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794786077295",
    "title": "URL Preservation Invariant Under Parameter Stripping",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "sfu-db-connector-x-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "5dd12cf311343d733b28f0c61c6fa4826a956d7d472603627c8ee86b30531ef0"
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
        "Harvested/verified timestamp recorded: 2026-11-15T23:41:17.296Z"
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
  "auth_token": "1c50781cd3c0d9e663d90b8ff020a69328beef6e6dbcd1caa4f49dcd52f78f60"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
