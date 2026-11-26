# Candidate Directive: [CD-SP56] finish removing source comments

<!-- PROVENANCE_START
{
  "source_repository": "sozercan/kaset",
  "source_url": "https://github.com/sozercan/kaset",
  "source_version": "49c8bb52",
  "license": "MIT",
  "timestamp": "2026-11-26T06:44:05.322Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-sozercan-kaset",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sozercan/kaset](https://github.com/sozercan/kaset) (Revision: `49c8bb52`).  
> **License**: MIT | **Timestamp**: `2026-11-26T06:44:05.322Z`  
> **Learning ID**: `learn-github-sozercan-kaset`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-26T06:44:05.320Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795675445320",
    "title": "finish removing source comments",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "sozercan/kaset",
    "source_uri": "https://github.com/sozercan/kaset",
    "source_version": "HEAD",
    "content_hash": "00be07b3a23ca2ba25bf9cd6f17064926f1038f98e15304c9e3e965d111f346b"
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
        "Harvested/verified timestamp recorded: 2026-11-26T06:44:05.320Z"
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
  "auth_token": "aeef28bef5ac36a89bf5d1084f2aafa6cc11dc06a246724ca6e311ab4cefcb29"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
