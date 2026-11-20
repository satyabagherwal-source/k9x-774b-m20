# Candidate Directive: [CD-3CLF] filters): Remove the allowlists and rerun the 4.0 upgrade once

<!-- PROVENANCE_START
{
  "source_repository": "0xcub3-wblock-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T16:58:12.335Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-0xcub3-wblock-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [0xcub3-wblock-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T16:58:12.335Z`  
> **Learning ID**: `LEARN-EVO-0xcub3-wblock-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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
  "validated_at": "2026-11-20T16:58:12.478Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795193892478",
    "title": "filters): Remove the allowlists and rerun the 4.0 upgrade once",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "0xcub3-wblock-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "0ac260f2668b9dfc91d2cba10fbb3a433d42c5068678cdcee474352b175d8533"
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
        "Harvested/verified timestamp recorded: 2026-11-20T16:58:12.479Z"
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
  "auth_token": "72776558d04287bf30ecb3114692a1b09347940377d58327ede9b16b77db6f19"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
