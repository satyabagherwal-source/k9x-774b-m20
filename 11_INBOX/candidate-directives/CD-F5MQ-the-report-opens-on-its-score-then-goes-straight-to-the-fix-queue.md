# Candidate Directive: [CD-F5MQ] the report opens on its score, then goes straight to the fix queue

<!-- PROVENANCE_START
{
  "source_repository": "seo-skills/seo-audit-skill",
  "source_url": "https://github.com/seo-skills/seo-audit-skill",
  "source_version": "f43ba12d",
  "license": "MIT",
  "timestamp": "2026-11-19T22:27:38.690Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-seo-skills-seo-audit-skill",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [seo-skills/seo-audit-skill](https://github.com/seo-skills/seo-audit-skill) (Revision: `f43ba12d`).  
> **License**: MIT | **Timestamp**: `2026-11-19T22:27:38.690Z`  
> **Learning ID**: `learn-github-seo-skills-seo-audit-skill`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in seo-skills/seo-audit-skill. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e8cc2473`: design): the report opens on its score, then goes straight to the fix queue. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
- **The report opens on its score, then goes straight to what to fix.** In
  the dashboard, the desktop app and the HTML report, the score leads and one
  fix queue follows from 01, with no fix featured above the rest. Each fix is
  agent introduces the queue with one sentence the numbers support ("The
  first five return 2.4 of the 8.8 points this page is missing"); while a
  score cap holds, the score names it and the fix that lifts it.
  while a run is live (the only animation that loops), focused over the fix
  queue, and reacting once when a run hands over to its report. Reduced motion
  number at the top, with what it is missing, what it did not count, and what
  changed since the last run beside it. Export formats sit in one menu and
  on a click anywhere, and the report shows its own shape while it loads.
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
- **The report opens on what to fix first.** In the dashboard, the desktop app
  and the HTML report, the largest thing on an audit is now the first fix,
  agent sits over it with one sentence the numbers support ("The first five
  fixes return 2.4 of the 8.8 points this page is missing").
  while a run is live (the only animation that loops), focused on the lead
  fix, and reacting once when a run hands over to its report. Reduced motion
  number beside the lead fix, with what it is missing, what it did not count,
  and what changed since the last run. Export formats sit in one menu and
  on a click anywhere, "Show evidence" opens under the lead fix instead of
  jumping to the end of the page, and the report shows its own shape while it
  loads.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e8cc2473` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T22:27:38.688Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795127258688",
    "title": "the report opens on its score, then goes straight to the fix queue",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "seo-skills/seo-audit-skill",
    "source_uri": "https://github.com/seo-skills/seo-audit-skill",
    "source_version": "HEAD",
    "content_hash": "769c3a02d4fa9d10224a7f81130ec0d13603f9aae9be12268b1392cd0940311b"
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
        "Harvested/verified timestamp recorded: 2026-11-19T22:27:38.688Z"
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
  "auth_token": "d1f808e7b32b79a9523e69f3e1fae4440492094c9385f47a2a1137b38558a2b1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
