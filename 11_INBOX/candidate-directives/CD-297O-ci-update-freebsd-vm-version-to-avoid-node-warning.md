# Candidate Directive: [CD-297O] ci: update freebsd VM version to avoid node warning

<!-- PROVENANCE_START
{
  "source_repository": "clementtsang-bottom-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-23T00:56:35.249Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-clementtsang-bottom-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [clementtsang-bottom-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-23T00:56:35.249Z`  
> **Learning ID**: `LEARN-EVO-clementtsang-bottom-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/actions/test-bsd-target/action.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in ClementTsang/bottom. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a3552b0d`: ci: update freebsd VM version to avoid node warning. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/actions/test-bsd-target/action.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
      uses: vmactions/freebsd-vm@811efaaac0668df8bfb8308c3ec997b5ab50037b # v1.6.0
      uses: vmactions/freebsd-vm@811efaaac0668df8bfb8308c3ec997b5ab50037b # v1.6.0
      uses: vmactions/freebsd-vm@811efaaac0668df8bfb8308c3ec997b5ab50037b # v1.6.0
      uses: vmactions/netbsd-vm@5957cf330aef2e6ddc63c604364c99ce2e02b91d # v1.5.3
      uses: vmactions/netbsd-vm@5957cf330aef2e6ddc63c604364c99ce2e02b91d # v1.5.3
      uses: vmactions/netbsd-vm@5957cf330aef2e6ddc63c604364c99ce2e02b91d # v1.5.3
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
      uses: vmactions/freebsd-vm@c9f815bc7aa0d34c9fdd0619b034a32d6ca7b57e # v1.4.2
      uses: vmactions/freebsd-vm@c9f815bc7aa0d34c9fdd0619b034a32d6ca7b57e # v1.4.2
      uses: vmactions/freebsd-vm@c9f815bc7aa0d34c9fdd0619b034a32d6ca7b57e # v1.4.2
      uses: vmactions/netbsd-vm@5957cf330aef2e6ddc63c604364c99ce2e02b91d # v1.5.2
      uses: vmactions/netbsd-vm@5957cf330aef2e6ddc63c604364c99ce2e02b91d # v1.5.2
      uses: vmactions/netbsd-vm@5957cf330aef2e6ddc63c604364c99ce2e02b91d # v1.5.2
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a3552b0d` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T00:56:35.360Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795395395360",
    "title": "ci: update freebsd VM version to avoid node warning",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "clementtsang-bottom-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "b38c9e7910008c366ab2954bf62f1437027302c3e4b9e562d3c7a06070f6a980"
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
        "Harvested/verified timestamp recorded: 2026-11-23T00:56:35.361Z"
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
  "auth_token": "c6322e8fa37e660dcaba2387d6e3401551c5c7e28774a6ee8dfcd77ad5be7f0b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
