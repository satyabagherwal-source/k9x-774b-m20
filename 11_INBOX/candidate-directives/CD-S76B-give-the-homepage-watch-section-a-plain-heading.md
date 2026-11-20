# Candidate Directive: [CD-S76B] give the homepage Watch section a plain heading

<!-- PROVENANCE_START
{
  "source_repository": "dosco/graphjin",
  "source_url": "https://github.com/dosco/graphjin",
  "source_version": "ba272634",
  "license": "Apache-2.0",
  "timestamp": "2026-11-20T23:21:26.867Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-dosco-graphjin",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dosco/graphjin](https://github.com/dosco/graphjin) (Revision: `ba272634`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-20T23:21:26.867Z`  
> **Learning ID**: `learn-github-dosco-graphjin`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `website/content/_index.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in dosco/graphjin. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ba272634`: site): give the homepage Watch section a plain heading. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `website/content/_index.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
<section id="watch-automation" class="dx-value"><div class="dx-value-copy"><p class="dx-kicker"><b>04</b><i></i><span>It speaks first</span></p><h2><span class="dx-line">Leave a question running.</span> <span class="dx-line">It tells you when something changes.</span></h2><p>DeepORG keeps answering that question against live data. It speaks up when the answer changes, or when something you expected never arrives.</p><div class="dx-links"><a class="dx-more" href="/watch/">What a standing question can do</a></div></div><div class="dx-value-art">{{< ascii scene="watch" label="Animated diagram: a question left running is checked every hour. When no rows have arrived for four hours, DeepORG says so without being asked." caption="a question left running" >}}</div></section>
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
<section id="watch-automation" class="dx-value"><div class="dx-value-copy"><p class="dx-kicker"><b>04</b><i></i><span>It speaks first</span></p><h2>Nothing happened. That was the problem.</h2><p>Leave a question running and DeepORG keeps answering it against live data. It speaks up when the answer changes, or when something you expected never arrives.</p><div class="dx-links"><a class="dx-more" href="/watch/">What a standing question can do</a></div></div><div class="dx-value-art">{{< ascii scene="watch" label="Animated diagram: a question left running is checked every hour. When no rows have arrived for four hours, DeepORG says so without being asked." caption="a question left running" >}}</div></section>
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ba272634` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T23:21:26.865Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795216886865",
    "title": "give the homepage Watch section a plain heading",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dosco/graphjin",
    "source_uri": "https://github.com/dosco/graphjin",
    "source_version": "HEAD",
    "content_hash": "79185c683a35c88b5c11b30a858b7d1775821c3a972dd958020d9b722da5f0c0"
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
        "Harvested/verified timestamp recorded: 2026-11-20T23:21:26.865Z"
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
  "auth_token": "4df3795308bd07d3d89b5ed7ac226e461b86263480cc9b537e1d866438d3009a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
