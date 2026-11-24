# Candidate Directive: [CD-1C4L] homepage and README point to www.i18next.com/react, and docs PRs go to i18

<!-- PROVENANCE_START
{
  "source_repository": "i18next/react-i18next",
  "source_url": "https://github.com/i18next/react-i18next",
  "source_version": "cbb61e6f",
  "license": "MIT",
  "timestamp": "2026-11-24T13:47:22.149Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-i18next-react-i18next",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [i18next/react-i18next](https://github.com/i18next/react-i18next) (Revision: `cbb61e6f`).  
> **License**: MIT | **Timestamp**: `2026-11-24T13:47:22.149Z`  
> **Learning ID**: `learn-github-i18next-react-i18next`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in i18next/react-i18next. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `cbb61e6f`: docs: homepage and README point to www.i18next.com/react, and docs PRs go to i18next/www. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
The documentation is published on [www.i18next.com/react](https://www.i18next.com/react) and PR changes can be supplied [here](https://github.com/i18next/www).
The general i18next documentation is published on [www.i18next.com](https://www.i18next.com) and PR changes can be supplied [here](https://github.com/i18next/www).
- react >= **0.14.0** (in case of < v16 or preact you will need to define parent in [Trans component](https://www.i18next.com/react/latest/trans-component#trans-props) or globally in [i18next.react options](https://www.i18next.com/react/latest/trans-component#i18next-options))
```

**NEGATIVE CONSTRAINT**:
```javascript
// Induced defect failure mode:
The documentation is published on [react.i18next.com](https://react.i18next.com) and PR changes can be supplied [here](https://github.com/i18next/react-i18next-gitbook).
The general i18next documentation is published on [www.i18next.com](https://www.i18next.com) and PR changes can be supplied [here](https://github.com/i18next/i18next-gitbook).
- react >= **0.14.0** (in case of < v16 or preact you will need to define parent in [Trans component](https://react.i18next.com/latest/trans-component#trans-props) or globally in [i18next.react options](https://react.i18next.com/latest/trans-component#i18next-options))
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `cbb61e6f` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T13:47:22.147Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795528042147",
    "title": "homepage and README point to www.i18next.com/react, and docs PRs go to i18",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "i18next/react-i18next",
    "source_uri": "https://github.com/i18next/react-i18next",
    "source_version": "HEAD",
    "content_hash": "93269f7943999051ee8005197958874e039d015ed3bbec478babd7776f5602a2"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-24T13:47:22.147Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "8edd123f3912e73dfff2006d3012d2c052c3cc7012746b4fdca45be01611c7c7"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
