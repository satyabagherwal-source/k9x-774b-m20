# Candidate Directive: [CD-7I6P] fix macOS Service Unit timeouts (reuse e2e build, warm cache)

<!-- PROVENANCE_START
{
  "source_repository": "freenet/freenet-core",
  "source_url": "https://github.com/freenet/freenet-core",
  "source_version": "fdc05210",
  "license": "NOASSERTION",
  "timestamp": "2026-11-15T20:51:01.969Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-freenet-freenet-core",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet/freenet-core](https://github.com/freenet/freenet-core) (Revision: `fdc05210`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-15T20:51:01.969Z`  
> **Learning ID**: `learn-github-freenet-freenet-core`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/scripts/check_cache_warm_parity.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `66b4a932`: ci: fix macOS Service Unit timeouts (reuse e2e build, warm cache). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/scripts/check_cache_warm_parity.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
6. the warm job runs on the same kind of runner as its twin: a Ubicloud
   runner with the same label suffix (architecture, OS variant), or, for a
   GitHub-hosted twin (macOS), the identical label, since GitHub's cache
   backend is only written by GitHub-hosted runners; its display name starts with
It also DISCOVERS which ci.yml jobs need a twin: a job (Ubicloud or macOS) whose
    """A job that restores a cache it can never write itself.
    own. The runner may be Ubicloud or GitHub-hosted (macOS): each has its own
    cache backend, so the warm job must run on the same kind of runner (see the
    runner check in ``check``).
    # windows_unit has the same shape (#6236) and no warm twin yet; widen this
    # to GitHub-hosted runners generally when one is added.
    ro = _runs_on(job)
    if "ubicloud" not in ro and not ro.startswith("macos-"):
            f"{ci_name}: no job looks like it needs a warm twin (Ubicloud or macOS runner, "
                f"a Ubicloud or macOS runner. Delete the warm job, or restore the twin's shape."
        if "ubicloud" not in _runs_on(ci_job):
            # GitHub-hosted twin: its cache lives in GitHub's backend, which
            # only a GitHub
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
6. the warm job runs on a Ubicloud runner with the same label suffix
   (architecture, OS variant), and its display name starts with
It also DISCOVERS which ci.yml jobs need a twin: a Ubicloud job whose
    """A Ubicloud job that restores a cache it can never write itself.
    own; a GitHub-hosted job uses a different cache backend, which a Ubicloud
    warm job could not fill.
    if "ubicloud" not in _runs_on(job):
            f"{ci_name}: no job looks like it needs a warm twin (Ubicloud, "
                f"Ubicloud. Delete the warm job, or restore the twin's shape."
        if "ubicloud" not in warm_ro:
                f"{warm_name}: job `{job_id}` runs on `{warm_ro}`. Ubicloud "
                f"serves its own cache backend, so an entry saved from any other "
                f"runner is invisible to the Ubicloud PR job. Use a "
                f"`ubicloud-standard-*` label."
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `66b4a932` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T20:51:01.967Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794775861967",
    "title": "fix macOS Service Unit timeouts (reuse e2e build, warm cache)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "freenet/freenet-core",
    "source_uri": "https://github.com/freenet/freenet-core",
    "source_version": "HEAD",
    "content_hash": "4e7fca83294b035487231540e5c5ee834833a25aa4afa9d7afffbc089af1d788"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Harvested/verified timestamp recorded: 2026-11-15T20:51:01.967Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "049a6e4b46562c6bbb33f1fae0e3920af107b4555bfd5b9a2a50ba36cde1b688"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
