# Candidate Directive: [CD-FXBK] design): the report opens on its score, then goes straight to the fix queue

<!-- PROVENANCE_START
{
  "source_repository": "seo-skills-seo-audit-skill-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T22:28:14.466Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-seo-skills-seo-audit-skill-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [seo-skills-seo-audit-skill-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T22:28:14.466Z`  
> **Learning ID**: `LEARN-EVO-seo-skills-seo-audit-skill-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain F

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
  "validated_at": "2026-11-19T22:28:14.574Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795127294574",
    "title": "design): the report opens on its score, then goes straight to the fix queue",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "seo-skills-seo-audit-skill-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "ea084618cedbd00da4aa61bde5dc9941c3816d57eba2d3a2f3ef8aa74acbb3ea"
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
        "Harvested/verified timestamp recorded: 2026-11-19T22:28:14.575Z"
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
  "auth_token": "e729cf5b4166f768b079f4eaa9ef9a96485c10e5469498104c105bc2f5f1e6ba"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
