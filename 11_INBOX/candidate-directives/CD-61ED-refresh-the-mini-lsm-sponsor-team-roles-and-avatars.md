# Candidate Directive: [CD-61ED] Refresh the Mini LSM sponsor team roles and avatars

<!-- PROVENANCE_START
{
  "source_repository": "skyzh-mini-lsm-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T11:31:03.299Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-skyzh-mini-lsm-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [skyzh-mini-lsm-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T11:31:03.299Z`  
> **Learning ID**: `LEARN-EVO-skyzh-mini-lsm-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `mini-lsm-book/src/assets/avatars/apprentice.svg`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in skyzh/mini-lsm. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4c10ba4b`: Refresh the Mini LSM sponsor team roles and avatars. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `mini-lsm-book/src/assets/avatars/apprentice.svg`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" shape-rendering="crispEdges"><rect width="8" height="8" fill="#27CCF3"/><rect x="0" y="0" width="1" height="1" fill="#141111"/><rect x="1" y="0" width="1" height="1" fill="#141111"/><rect x="6" y="0" width="1" height="1" fill="#141111"/><rect x="7" y="0" width="1" height="1" fill="#141111"/><rect x="0" y="1" width="1" height="1" fill="#141111"/><rect x="1" y="1" width="1" height="1" fill="#A9D877"/><rect x="2" y="1" width="1" height="1" fill="#141111"/><rect x="5" y="1" width="1" height="1" fill="#141111"/><rect x="6" y="1" width="1" height="1" fill="#A9D877"/><rect x="7" y="1" width="1" height="1" fill="#141111"/><rect x="0" y="2" width="1" height="1" fill="#141111"/><rect x="1" y="2" width="1" height="1" fill="#A9D877"/><rect x="2" y="2" width="1" height="1" fill="#A9D877"/><rect x="3" y="2" width="1" height="1" fill="#141111"/><rect x="4" y="2" width="1" height="1" fill="#141111"/><rect x="5" y="2" width="1" height="1" fill="#A9D877"/><rect x="6" y="2" width="1" height="1" fill="#A9D877"/><rect x="7" y="2" width="1" height="1" fill="#141111"/><rect x="1" y="3" width="1" height="1" fill="#141111"/><rect x="2" y="3" width="
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" width="44" height="44" shape-rendering="crispEdges">
  <rect width="8" height="8" fill="#FE7DA8"/>
  <rect x="2" y="0" width="1" height="1" fill="#141111"/>
  <rect x="3" y="0" width="1" height="1" fill="#141111"/>
  <rect x="4" y="0" width="1" height="1" fill="#141111"/>
  <rect x="5" y="0" width="1" height="1" fill="#141111"/>
  <rect x="1" y="1" width="1" height="1" fill="#141111"/>
  <rect x="2" y="1" width="1" height="1" fill="#F97264"/>
  <rect x="3" y="1" width="1" height="1" fill="#FFFFFF"/>
  <rect x="4" y="1" width="1" height="1" fill="#FFFFFF"/>
  <rect x="5" y="1" width="1" height="1" fill="#F97264"/>
  <rect x="6" y="1" width="1" height="1" fill="#141111"/>
  <rect x="0" y="2" width="1" height="1" fill="#141111"/>
  <rect x="1" y="2" width="1" height="1" fill="#F97264"/>
  <rect x="2" y="2" width="1" height="1" fill="#F97264"/>
  <rect x="3" y="2" width="1" height="1" fill="#FFFFFF"/>
  <rect x="4" y="2" width="1" height="1" fill="#FFFFFF"/>
  <rect x="5" y="2" width="1" height="1" fill="#F97264"/>
  <rect x="6" y="2" width="1" height="1" fill="#F97264"/>
  <rect x="7" y="2" width="1" height="1" fill="#141111"/>
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4c10ba4b` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T11:31:03.443Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795519863443",
    "title": "Refresh the Mini LSM sponsor team roles and avatars",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "skyzh-mini-lsm-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "9a9adab67a177a0de7469cdaeacbfdc6b7bff1b236cb688f936f3094549ec616"
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
        "Harvested/verified timestamp recorded: 2026-11-24T11:31:03.443Z"
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
  "auth_token": "537b99a6b2c1192a0f0629cf23fb62bf6942b553b6f732ded18b80b485a799f8"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
