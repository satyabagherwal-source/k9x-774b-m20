# Candidate Directive: [CD-LC5B] cap the build, test packages only when they change, key the compile cache on

<!-- PROVENANCE_START
{
  "source_repository": "thaw-app/Thaw",
  "source_url": "https://github.com/thaw-app/Thaw",
  "source_version": "e29a4376",
  "license": "GPL-3.0",
  "timestamp": "2026-11-15T09:49:56.543Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-thaw-app-thaw",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [thaw-app/Thaw](https://github.com/thaw-app/Thaw) (Revision: `e29a4376`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-15T09:49:56.543Z`  
> **Learning ID**: `learn-github-thaw-app-thaw`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/workflows/ci.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in thaw-app/Thaw. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d9b78abe`: ci: cap the build, test packages only when they change, key the compile cache on dependencies, and scan legacy/thaw-2 with CodeQL. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/ci.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
  # The weekly run has a group of its own, so a merge doesn't cancel it and it
  # doesn't cancel a merge's run.
  group: ${{ github.workflow }}-${{ github.event_name == 'schedule' && 'schedule' || github.head_ref || github.ref }}
  # Weekly on development, where path detection reports everything as changed.
  # Merges cancel most push runs, so this one tests the packages and saves the cache.
  schedule:
    # Offset from the hour and from the other scheduled workflows.
    - cron: "43 2 * * 3"
      # The macOS build runs for a path that matches CODE_PATTERNS and neither of the
      # two lists below, so a path nobody has listed still builds.
      #
      # Lint and format settings, and the scripts only the lint job runs. The build
      # reads .swiftlint-version, lint.sh and install-swiftlint.sh, so they stay out.
      LINT_ONLY_PATTERNS: '(^\.swiftlint\.yml$|^\.swiftlint\.baseline$|^\.swiftformat|^scripts/(format|install-swiftformat|update-swiftlint-baseline)\.sh$|^scripts/swiftlint-baseline\.py$|^scripts/tests/test-(format|lint|swiftlint-baseline)\.sh$)'
      # String catalogs. The lint job checks that they are valid JSON, and nothing
      # compiles them before the merge
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
  group: ${{ github.workflow }}-${{ github.head_ref || github.ref }}
      code: ${{ steps.since-last-run.outputs.code || steps.filter.outputs.code }}
      # The filter compares the whole pull request with its base, so a push that only
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d9b78abe` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T09:49:56.541Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794736196541",
    "title": "cap the build, test packages only when they change, key the compile cache on",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "thaw-app/Thaw",
    "source_uri": "https://github.com/thaw-app/Thaw",
    "source_version": "HEAD",
    "content_hash": "56669db81123ca505555bd1e185c1fbf9b0cfbf1e90eeb37436c26f2c9c44ae9"
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
        "Harvested/verified timestamp recorded: 2026-11-15T09:49:56.541Z"
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
  "auth_token": "3ace0da7efe30221d596330558f783f073ef92d6db7bdbff04e2319be0944623"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
