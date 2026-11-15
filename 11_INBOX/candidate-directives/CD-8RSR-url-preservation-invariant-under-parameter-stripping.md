# Candidate Directive: [CD-8RSR] URL Preservation Invariant Under Parameter Stripping

<!-- PROVENANCE_START
{
  "source_repository": "sfu-db/connector-x",
  "source_url": "https://github.com/sfu-db/connector-x",
  "source_version": "ac243a1b",
  "license": "MIT",
  "timestamp": "2026-11-15T23:39:58.779Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-sfu-db-connector-x",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sfu-db/connector-x](https://github.com/sfu-db/connector-x) (Revision: `ac243a1b`).  
> **License**: MIT | **Timestamp**: `2026-11-15T23:39:58.779Z`  
> **Learning ID**: `learn-github-sfu-db-connector-x`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER use standard form-url-encoding builders to strip query parameters from database URIs!
pub fn BAD_strip_query_param(mut url: Url, param: &str) -> Url {
    // BUG: query_pairs_mut re-serializes spaces as '+'!
    // Result: "options=-c%20statement_timeout=1s" becomes "options=-c+statement_timeout=1s"
    // Downstream driver interprets the '+' as a syntax error in the configuration key.
    let pairs: Vec<(String, String)> = url
        .query_pairs()
        .filter(|(k, _)| k != param)
        .map(|(k, v)| (k.into_owned(), v.into_owned()))
        .collect();
    
    url.query_pairs_mut().clear().extend_pairs(pairs).finish();
    url
}
```

**VERIFICATION METHOD**:
Enforce property testing asserting zero byte-drift on unstripped parameters:
```rust
#[test]
fn test_query_preservation_invariant() {
    let raw = "postgresql://user:pass@host:5432/db?options=-c%20statement_timeout%3D1s&custom_flag=true";
    let url = Url::parse(raw).unwrap();
    let stripped = excise_query_params(&url, &["custom_flag"]);
    assert_eq!(
        stripped.as_str(),
        "postgresql://user:pass@host:5432/db?options=-c%20statement_timeout%3D1s"
    );
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T23:39:58.777Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794785998777",
    "title": "URL Preservation Invariant Under Parameter Stripping",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "sfu-db/connector-x",
    "source_uri": "https://github.com/sfu-db/connector-x",
    "source_version": "HEAD",
    "content_hash": "9d5102a60b8d9b0123172bb004bb99acfb31127b966af5056a68ace0d4ae9167"
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
        "Harvested/verified timestamp recorded: 2026-11-15T23:39:58.777Z"
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
  "auth_token": "893c1936bb70f6743e62a900b55697f3c8fe5463e8924cadd98d70e71871b91b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
