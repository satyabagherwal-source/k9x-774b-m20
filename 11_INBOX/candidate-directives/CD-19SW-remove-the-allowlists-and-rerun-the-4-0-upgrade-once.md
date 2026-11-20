# Candidate Directive: [CD-19SW] Remove the allowlists and rerun the 4.0 upgrade once

<!-- PROVENANCE_START
{
  "source_repository": "0xCUB3/wBlock",
  "source_url": "https://github.com/0xCUB3/wBlock",
  "source_version": "71f06abb",
  "license": "GPL-3.0",
  "timestamp": "2026-11-20T16:56:35.552Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-0xcub3-wblock",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [0xCUB3/wBlock](https://github.com/0xCUB3/wBlock) (Revision: `71f06abb`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-20T16:56:35.552Z`  
> **Learning ID**: `learn-github-0xcub3-wblock`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `scripts/test_filter_catalog_migrations.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in 0xCUB3/wBlock. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0612d643`: filters): Remove the allowlists and rerun the 4.0 upgrade once. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `scripts/test_filter_catalog_migrations.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
        // Online Malicious URL Blocklist and the two allowlists go even when on, with the custom copies earlier
        // releases kept (#1088).
        for (url, name) in [
            ("https://curbengh.github.io/malware-filter/urlhaus-filter-vivaldi-online.txt", "Online Malicious URL Blocklist"),
            ("\(registry)/extension/safari/filters/208_optimized.txt", "Online Malicious URL Blocklist"),
            ("\(registry)/extension/safari/filters/10_optimized.txt", "AdGuard Allowlist"),
            ("\(registry)/extension/safari/filters/10.txt", "AdGuard Allowlist"),
            ("https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/whitelist-referral.txt", "HaGeZi Referral Allowlist"),
        ] {
                let filter = FilterList(name: name, url: URL(string: url)!, category: .security,
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
            ("\(registry)/extension/safari/filters/10_optimized.txt", "AdGuard Allowlist"),
            ("\(registry)/extension/safari/filters/10.txt", "AdGuard Allowlist"),
            ("https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/whitelist-referral.txt", "HaGeZi Referral Allowlist"),
        // Online Malicious URL Blocklist goes even when on, with the custom copy 3.2.3 kept (#1088).
        for url in ["https://curbengh.github.io/malware-filter/urlhaus-filter-vivaldi-online.txt",
                    "\(registry)/extension/safari/filters/208_optimized.txt"] {
                let filter = FilterList(name: "Online Malicious URL Blocklist", url: URL(string: url)!, category: .security,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0612d643` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T16:56:35.550Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795193795549",
    "title": "Remove the allowlists and rerun the 4.0 upgrade once",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "0xCUB3/wBlock",
    "source_uri": "https://github.com/0xCUB3/wBlock",
    "source_version": "HEAD",
    "content_hash": "d407cd8a1fd03ceeadc37242321cee5803fbda3969968e09b3d39bce39ccf784"
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
        "Harvested/verified timestamp recorded: 2026-11-20T16:56:35.550Z"
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
  "auth_token": "e51c3029e63db0f8b641dc1d446e86ec0806ac7327d8807b4bfb41c558db8ad4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
