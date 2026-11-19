# Candidate Directive: [CD-DN0W] High-Entropy Base64 Character-Class Validation Guard

<!-- PROVENANCE_START
{
  "source_repository": "rtk-ai-rtk-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T20:34:29.344Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-rtk-ai-rtk-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rtk-ai-rtk-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T20:34:29.344Z`  
> **Learning ID**: `LEARN-EVO-rtk-ai-rtk-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T20:34:29.456Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795120469456",
    "title": "High-Entropy Base64 Character-Class Validation Guard",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rtk-ai-rtk-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "5732976f2d551a51bb20da980372a48ddfbc143bbf1ef8659731a947a815b957"
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
        "Harvested/verified timestamp recorded: 2026-11-19T20:34:29.456Z"
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
  "auth_token": "a8b6833d30f13e99070dd0012dbe31d38713318f855a69827431b928fa6201b1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
