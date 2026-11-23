# Candidate Directive: [CD-5PUE] Rename Cookie::match_domain to Cookie::match_host and fix the method matching an

<!-- PROVENANCE_START
{
  "source_repository": "Orange-OpenSource/hurl",
  "source_url": "https://github.com/Orange-OpenSource/hurl",
  "source_version": "d3f1771a",
  "license": "Apache-2.0",
  "timestamp": "2026-11-23T00:31:17.270Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-orange-opensource-hurl",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Orange-OpenSource/hurl](https://github.com/Orange-OpenSource/hurl) (Revision: `d3f1771a`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-23T00:31:17.270Z`  
> **Learning ID**: `learn-github-orange-opensource-hurl`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
        url.path().starts_with(&self.path)
        let cookie = Cookie {
            domain: "example.com".to_string(),
            include_subdomain: false,
            path: "/".to_string(),
            https: true,
            expires: 0,
            name: String::new(),
            value: String::new(),
            http_only: false,
        };
        assert!(cookie.match_domain(&Url::from_str("http://example.com/toto").unwrap()));
        assert!(!cookie.match_domain(&Url::from_str("http://sub.example.com/tata").unwrap()));
        assert!(!cookie.match_domain(&Url::from_str("http://toto/tata").unwrap()));

        let cookie = Cookie {
            domain: "example.com".to_string(),
            include_subdomain: true,
            path: "/toto".to_str
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d3f1771a` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T00:31:17.268Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795393877268",
    "title": "Rename Cookie::match_domain to Cookie::match_host and fix the method matching an",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Orange-OpenSource/hurl",
    "source_uri": "https://github.com/Orange-OpenSource/hurl",
    "source_version": "HEAD",
    "content_hash": "2ed7264642da3e407a2e162bbc310d88a0214f56801e0b81708015cb91e55be3"
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
        "Harvested/verified timestamp recorded: 2026-11-23T00:31:17.268Z"
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
  "auth_token": "84bcf08e49122fa780c5dc2b9819073a831d1ba25e93264d142970ed43700a58"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
