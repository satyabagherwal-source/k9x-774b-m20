# Candidate Directive: [CD-64OG] Rename Cookie::match_domain to Cookie::match_host and fix the method matching an

<!-- PROVENANCE_START
{
  "source_repository": "orange-opensource-hurl-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-23T00:31:36.366Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-orange-opensource-hurl-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [orange-opensource-hurl-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-23T00:31:36.366Z`  
> **Learning ID**: `LEARN-EVO-orange-opensource-hurl-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `packages/hurl/src/http/cookie_store.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Orange-OpenSource/hurl. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d3f1771a`: Rename Cookie::match_domain to Cookie::match_host and fix the method matching any IPs.. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/hurl/src/http/cookie_store.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    /// Returns `true` if this cookie applies to `url`, based on the host and the path of the URL.
    pub fn match_url(&self, url: &Url) -> bool {
        self.match_host(url) && url.path().starts_with(&self.path)
    }

    /// Returns `true` if the host of `url` matches this cookie domain.
    fn match_host(&self, url: &Url) -> bool {
        // The host of `url` must be equal to the cookie domain (case-insensitive) or, if the cookie
        // includes subdomains, be a subdomain of the cookie domain. Subdomain matching is only done
        // for domain names: an IP address must be strictly equal to the cookie domain. The path of
        // `url` must start with the cookie path.

        let cookie_domain = self.domain.strip_prefix('.').unwrap_or(&self.domain);
        let cookie_domain = cookie_domain.to_ascii_lowercase();
        // The host of an IPv6 URL is bracketed, while libcurl stores (and only matches) the
        // cookie domain without brackets.
        let host = url.host();
        let host = trim_brackets(&host).to_ascii_lowercase();
        if host == cookie_domain {
            return true;
        // Subdomain matching only applies to domain names, never to IP
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    pub fn match_domain(&self, url: &Url) -> bool {
        let cookie_domain = self.domain.strip_prefix(".").unwrap_or(&self.domain);
        if let Some(url_domain) = url.domain() {
            if !self.include_subdomain() {
                if url_domain != cookie_domain {
                    return false;
                }
            } else if !url_domain.ends_with(&cookie_domain) {
                return false;
            }

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T00:31:36.491Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795393896490",
    "title": "Rename Cookie::match_domain to Cookie::match_host and fix the method matching an",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "orange-opensource-hurl-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "38fb74013d8fb26a6c9330a5b6577fe4af5105a7564cf01b83416430fb88591f"
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
        "Harvested/verified timestamp recorded: 2026-11-23T00:31:36.491Z"
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
  "auth_token": "335493b650a6eb51e6817a99125929ed5d67595848556510aa911190c16b79ed"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
