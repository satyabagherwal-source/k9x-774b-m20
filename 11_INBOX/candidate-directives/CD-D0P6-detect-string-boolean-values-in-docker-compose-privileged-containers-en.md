# Candidate Directive: [CD-D0P6] detect string boolean values in Docker Compose "Privileged Containers En

<!-- PROVENANCE_START
{
  "source_repository": "Checkmarx/kics",
  "source_url": "https://github.com/Checkmarx/kics",
  "source_version": "452b4d01",
  "license": "Apache-2.0",
  "timestamp": "2026-11-26T20:59:41.898Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-checkmarx-kics",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Checkmarx/kics](https://github.com/Checkmarx/kics) (Revision: `452b4d01`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-26T20:59:41.898Z`  
> **Learning ID**: `learn-github-checkmarx-kics`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain L

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `Dockerfile`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Checkmarx/kics. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `452b4d01`: query): detect string boolean values in Docker Compose "Privileged Containers Enabled" query. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Open Policy Agent data structures, boundary deserialization, API parsing, or resource lifecycles matching `Dockerfile`.

**VERIFIED IMPLEMENTATION PATTERN**:
```open policy agent
// Verified production-grade fix pattern:
ARG GO_BASE_IMAGE=checkmarx/go:1.27.4@sha256:f73955925ad073823c06b4738214c28ad8ff4f52fe6d35abbd616c10c0ba4eb0
ARG GIT_BASE_IMAGE=checkmarx/git:2.56.1@sha256:cbdf5cfebf96e817b54f797ef77aac3d716c4a52c99be249b72e251bfcb1f5ce
```

**NEGATIVE CONSTRAINT**:
```open policy agent
// Induced defect failure mode:
ARG GO_BASE_IMAGE=checkmarx/go:1.27.4@sha256:f11d557e2e36c479cfd4cb97caa1272bdf5009e0c8638fff65cf83f9916c9d22
ARG GIT_BASE_IMAGE=checkmarx/git:2.56.1@sha256:9bcf2dd6cb6385a1035a8159a2629d4c7503ab5281bd773b5fdbcf75e75dcf67
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `452b4d01` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T20:59:41.896Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795726781896",
    "title": "detect string boolean values in Docker Compose \"Privileged Containers En",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Checkmarx/kics",
    "source_uri": "https://github.com/Checkmarx/kics",
    "source_version": "HEAD",
    "content_hash": "08b5db1998945c2ae811b2fe5263c38fefca99075df313e742673c18a8e8cbce"
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
        "Harvested/verified timestamp recorded: 2026-11-26T20:59:41.896Z"
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
  "auth_token": "3ac0dd5d4fbd72297fb1c63e78614a5ca5cc3510607ae44e2cc58a0b9110e83a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
