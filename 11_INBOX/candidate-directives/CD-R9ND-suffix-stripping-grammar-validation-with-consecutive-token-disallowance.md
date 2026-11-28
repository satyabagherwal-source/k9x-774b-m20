# Candidate Directive: [CD-R9ND] Suffix-Stripping Grammar Validation with Consecutive Token Disallowance

<!-- PROVENANCE_START
{
  "source_repository": "biomejs-biome-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T09:34:16.598Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-biomejs-biome-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [biomejs-biome-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T09:34:16.598Z`  
> **Learning ID**: `LEARN-EVO-biomejs-biome-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When parsing, linting, or verifying token identifiers that permit unary or post-fix modification operators (e.g., SPDX `+` "or later" operator, regex repetitions `*`, `+`), the parser MUST strip the suffix and verify that the remaining base identifier does NOT terminate with the same operator character before validating the base identifier against the known registry.

**WHY**:
Failure to assert `!base.ends_with(OPERATOR)` when handling post-fix operators creates two failure modes:
1. **Invalid Grammar Acceptance**: `MIT++` or `GPL-2.0++` has its last `+` stripped, leaving `MIT+` or `GPL-2.0+`. If the base lookup allows recursion or if the registry itself includes legacy IDs with trailing operators (such as deprecated `GPL-2.0+`), malformed syntax will parse successfully.
2. **False Trust Evaluation**: A double-operator could match an existing deprecated or legacy identifier in the specification dictionary, bypassing strict licensing compliance checks.

**WHEN TO APPLY**:
Lexers, AST parsers, and policy engines implementing domain-specific micro-grammars (SPDX expressions, SemVer ranges, query modifiers, cron expressions).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// crates/biome_package/src/license/expression.rs

pub fn resolve_spdx_identifier<'a>(id: &'a str, license_list: &LicenseList) -> Result<LicenseRef, RejectReason> {
    // 1. Exact match against authorized canonical SPDX license dictionary
    if let Some(license) = license_list.find(id) {
        return Ok(license);
    }

    // 2. Trailing '+' "or-later" operator handling
    let stripped = id.strip_suffix('+')
        .filter(|base| !base.ends_with('+')) // INVARIANT: Disallow repeated operators ("++")
        .and_then(|base| license_list.find(base));

    if let Some(license) = stripped {
        if license.is_deprecated() {
            return Err(RejectReason::Deprecated);
        }
        return Ok(license);
    }

    Err(RejectReason::Untrusted)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER do single suffix trimming without checking the new boundary condition
let license = license_list.find(id).or_else(|| {
    let base = id.strip_suffix('+')?;
    // BUG: If id is "GPL-2.0++", base is "GPL-2.0+", which exists as a deprecated ID in LICENSE_LIST!
    // Result: "GPL-2.0++" falsely evaluates to a recognized license instead of Syntax/Untrusted error.
    license_list.find(base)
});
```

**VERIFICATION METHOD**:

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T09:34:16.728Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795858456728",
    "title": "Suffix-Stripping Grammar Validation with Consecutive Token Disallowance",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "biomejs-biome-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "a125e538a3e6eb415e2020edb51b16822426fb40e4f554f142f3deac4f24b092"
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
        "Harvested/verified timestamp recorded: 2026-11-28T09:34:16.728Z"
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
  "auth_token": "05669c1b148da8fcfffd8c2b0ad1749da645ca705cf3050ad444f73a0b5ad8e9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
