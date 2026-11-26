# Candidate Directive: [CD-SVED] finish removing source comments

<!-- PROVENANCE_START
{
  "source_repository": "sozercan-kaset-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T06:44:13.306Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-sozercan-kaset-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sozercan-kaset-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T06:44:13.306Z`  
> **Learning ID**: `LEARN-EVO-sozercan-kaset-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.agents/skills/delete-comment/SKILL.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sozercan/kaset. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `49c8bb52`: finish removing source comments. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `.agents/skills/delete-comment/SKILL.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
Preserve required headers, generated metadata, vendored code, active lint or formatter directives, and exact `# vX.Y.Z` release annotations on SHA-pinned GitHub Actions `uses:` entries. Verify the annotation against the tag without changing the pin. Remove a directive only after verifying its target no longer needs it. The ratchet still rejects new directives, so the inventory can be nonzero even when no prose remains. For an exhaustive audit, check embedded JavaScript, CSS, shell, and heredoc source separately; preserve comment-like string content such as help text and parser fixtures. For a large audit, work in reviewable batches and distinguish the locations inventoried from those actually classified. If issue filing isn't authorized or cannot be completed, report the candidate and leave the comment until the follow-up is recorded.
Run `python3 Scripts/comment_lint.py --base <merge-base>` and relevant checks. For a `main`-bound branch, find the merge base with `git merge-base HEAD origin/main`. Use `--list` to confirm what remains. Report before/after comment-only lines, any manually counted embedded removals, documents and issues created or reused, and retained exceptions. Mixe
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
Preserve syntax-required headers. Leave unverified or tooling-sensitive comments for a later ratchet pass rather than stripping them mechanically. For a large audit, work in reviewable batches and distinguish the locations inventoried from those actually classified. If issue filing isn't authorized or cannot be completed, report the candidate and leave the comment until the follow-up is recorded.
Run `python3 Scripts/comment_lint.py --base <merge-base>` and relevant checks. For a `main`-bound branch, find the merge base with `git merge-base HEAD origin/main`. Report before/after comment-only lines, documents and issues created or reused, and deferred areas. Mixed code/comment lines and new ADR text are not source-line savings.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `49c8bb52` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T06:44:13.429Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795675453428",
    "title": "finish removing source comments",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "sozercan-kaset-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "00be07b3a23ca2ba25bf9cd6f17064926f1038f98e15304c9e3e965d111f346b"
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
        "Harvested/verified timestamp recorded: 2026-11-26T06:44:13.429Z"
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
  "auth_token": "3f7a1e5e8553914141a5af8946e7ac0bc325c1900b74780ceff1de226926c5c7"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
