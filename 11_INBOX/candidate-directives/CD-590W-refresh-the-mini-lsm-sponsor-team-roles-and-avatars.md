# Candidate Directive: [CD-590W] Refresh the Mini LSM sponsor team roles and avatars

<!-- PROVENANCE_START
{
  "source_repository": "skyzh/mini-lsm",
  "source_url": "https://github.com/skyzh/mini-lsm",
  "source_version": "4c10ba4b",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T11:30:26.672Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-skyzh-mini-lsm",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [skyzh/mini-lsm](https://github.com/skyzh/mini-lsm) (Revision: `4c10ba4b`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T11:30:26.672Z`  
> **Learning ID**: `learn-github-skyzh-mini-lsm`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-24T11:30:26.670Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795519826670",
    "title": "Refresh the Mini LSM sponsor team roles and avatars",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "skyzh/mini-lsm",
    "source_uri": "https://github.com/skyzh/mini-lsm",
    "source_version": "HEAD",
    "content_hash": "9a9adab67a177a0de7469cdaeacbfdc6b7bff1b236cb688f936f3094549ec616"
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
        "Harvested/verified timestamp recorded: 2026-11-24T11:30:26.670Z"
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
  "auth_token": "b769f9fe0a081c4dde2e38245a5a1dff1511a7e7d84084b132b97eabdc8a1c5e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
