# Candidate Directive: [CD-CXWP] High-Entropy Base64 Character-Class Validation Guard

<!-- PROVENANCE_START
{
  "source_repository": "rtk-ai/rtk",
  "source_url": "https://github.com/rtk-ai/rtk",
  "source_version": "5f81080f",
  "license": "Apache-2.0",
  "timestamp": "2026-11-19T20:33:56.905Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-rtk-ai-rtk",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rtk-ai/rtk](https://github.com/rtk-ai/rtk) (Revision: `5f81080f`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-19T20:33:56.905Z`  
> **Learning ID**: `learn-github-rtk-ai-rtk`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
String scanning algorithms operating on unstructured payloads (JSON, YAML, HTML) MUST NOT classify character runs as Base64 purely based on regex character sets (`[A-Za-z0-9+/]`). Before triggering redaction or elision, the scanner MUST assert:
1. Length is an exact multiple of 4 (including valid `=` padding characters).
2. The character distribution contains high-entropy diversity: byte sets MUST concurrently contain uppercase (`A-Z`), lowercase (`a-z`), and numeric (`0-9`) ASCII values.
3. Long numeric literals (`111...`) and hex dumps (`deadbeef...`) MUST explicitly fail the validation pass.

**WHY**:
ELIDERS that replace raw strings inside JSON payloads will corrupt syntax if they match unquoted integer literals, big numbers, or machine hash dumps. Replacing a long unquoted integer literal (`{"size": 11111111...}`) with a marker (`{"size": [base64 data, 10 KB elided]}`) turns valid JSON into an unparseable syntax error, crashing downstream LLM JSON parsers.

**WHEN TO APPLY**:
Apply when designing prompt-scrubbers, log masks, secret filters, or data-URL eliders running ahead of AST/JSON decoders.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
/// Asserts that a candidate ASCII slice is genuine Base64 rather than a 
/// huge decimal number, hex dump, or repetitive identifier run.
pub fn looks_like_base64(run: &str) -> bool {
    // Standard Base64 requires strings to be aligned to 4-byte boundaries
    let body = run.trim_end_matches('=');
    if body.is_empty() || (run.len() % 4 != 0) {
        return false;
    }

    let mut has_upper = false;
    let mut has_lower = false;
    let mut has_digit = false;

    for &b in body.as_bytes() {
        match b {
            b'A'..=b'Z' => has_upper = true,
            b'a'..=b'z' => has_lower = true,
            b'0'..=b'9' => has_digit = true,
            b'+' | b'/' => {},
            _ => return false, // Illegal byte outside standard Base64 alphabet
        }
    }

    // High entropy check: real Base64 of sufficient length (>1KB) 
    // consistently traverses upper, lower, and digit byte classes.
    has_upper && has_lower && has_digit
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Relying strictly on regex match lengths.
// Corrupts numbers: {"num": 9999999999999999999999999999999999999999999999999999}
// Turns into:       {"num": [base64 data elided]} -> INVALID JSON
pub fn buggy_base64_scrub(json_str: &str) -> String {
    let re = regex::Regex::new(r"[A-Za-z0-9+/]{64,}").unwrap();
    re.replace_all(json_str, "[base64 elided]").to_string()
}
```

**VERIFICATION METHOD**:
```rust
#[test]
fn test_base64_validation_does_not_break_json_numbers() {
    let long_int = "9".repeat(1200);
    assert!(!looks_like_base64(&long_int));

    let hex_dump = "deadbeef".repeat(200);
    assert!(!looks_like_base64(&hex_dump));

    let valid_b64 = "QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkr".repeat(20);
    assert!(looks_like_base64(&valid_b64));
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T20:33:56.905Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795120436905",
    "title": "High-Entropy Base64 Character-Class Validation Guard",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rtk-ai/rtk",
    "source_uri": "https://github.com/rtk-ai/rtk",
    "source_version": "HEAD",
    "content_hash": "8c28f0aa0c1052274eb6d5183f5ac932bd5885a58b72b7e806368f462214f80c"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-19T20:33:56.905Z"
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
  "auth_token": "17c03b7dac1f444d7145a30712cea634d0a372a2ef79b27f8f833a58c582644a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
