# Candidate Directive: [CD-G9GK] hold syntax fixtures to scaling, async and module behavior, mangling, resi

<!-- PROVENANCE_START
{
  "source_repository": "webpack/webpack",
  "source_url": "https://github.com/webpack/webpack",
  "source_version": "82b8a937",
  "license": "MIT",
  "timestamp": "2026-11-17T04:13:24.836Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-webpack-webpack",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [webpack/webpack](https://github.com/webpack/webpack) (Revision: `82b8a937`).  
> **License**: MIT | **Timestamp**: `2026-11-17T04:13:24.836Z`  
> **Learning ID**: `learn-github-webpack-webpack`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `TESTING_DOCS.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in webpack/webpack. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2aa70aa7`: test: hold syntax fixtures to scaling, async and module behavior, mangling, residue and agreement. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `TESTING_DOCS.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
- **Syntax fixtures**: `fixtures/<css|html|xml|javascript>/<name>/index.<ext>` is one input to `unitCases/<lang>/invariants.unittest.js`, which snapshots its tokens, parse, errors and prints, and holds it to the relations in `helpers/syntaxInvariants/`: `spans`, `slices` and `purity` for the parser, each cut short inside a construct held to `spans` and `slices` as well (reported as `cut spans` and `cut slices`); idempotence (cuts included), respellings, `notices` and `meaning` for the printer; `behavior` for JavaScript; and `scaling` for a fixture built at a size. `notices` asks that the comments a minifier must keep survive (CSS and JavaScript legal notices, HTML conditional comments, server-side includes and `<?…?>`); `meaning` that the output reparses to what its source says (HTML and XML under every preset, CSS under `beautify`, JavaScript under the presets printing alone). XML's notices are the comments its minifier keeps (conditional comments, server-side includes and `<![`), and a compressing JavaScript preset owes only the banner's. Each CSS fixture is also held to `agreement` with css-tree. Which relation holds where, and why: [COMPARE_TOOLS.md](tooling/COMPARE_TOOLS.md). 
```

**NEGATIVE CONSTRAINT**:
```javascript
// Induced defect failure mode:
- **Syntax fixtures**: `fixtures/<css|html|xml|javascript>/<name>/index.<ext>` is one input to `unitCases/<lang>/invariants.unittest.js`, which snapshots its tokens, parse, errors and prints, and holds it to the relations in `helpers/syntaxInvariants/`: `spans`, `slices` and `purity` for the parser; idempotence (cuts included), respellings, `notices` and `meaning` for the printer; and `behavior` for JavaScript. `notices` asks that the comments a minifier must keep survive (CSS and JavaScript legal notices, HTML conditional comments, server-side includes and `<?…?>`); `meaning` that the output reparses to what its source says (HTML and XML under every preset, CSS under `beautify`, JavaScript under the presets printing alone). XML carries no notices, and a compressing JavaScript preset owes only the banner's. Which relation holds where, and why: [COMPARE_TOOLS.md](tooling/COMPARE_TOOLS.md). Beside it, read by `helpers/fixture.js`:
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2aa70aa7` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T04:13:24.834Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794888804834",
    "title": "hold syntax fixtures to scaling, async and module behavior, mangling, resi",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "webpack/webpack",
    "source_uri": "https://github.com/webpack/webpack",
    "source_version": "HEAD",
    "content_hash": "2ee279017d8fe315b6aa752325660dc93ae3f038e5f630378569e59e290a2429"
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
        "Harvested/verified timestamp recorded: 2026-11-17T04:13:24.834Z"
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
  "auth_token": "8a4d174a48345700a265245f8f6ebfa864c74f90cc142d671397b58d56e05333"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
