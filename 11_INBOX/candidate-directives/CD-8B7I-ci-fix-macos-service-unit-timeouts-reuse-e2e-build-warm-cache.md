# Candidate Directive: [CD-8B7I] ci: fix macOS Service Unit timeouts (reuse e2e build, warm cache)

<!-- PROVENANCE_START
{
  "source_repository": "freenet-freenet-core-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T20:51:39.464Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-freenet-freenet-core-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet-freenet-core-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T20:51:39.464Z`  
> **Learning ID**: `LEARN-EVO-freenet-freenet-core-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T20:51:39.580Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794775899580",
    "title": "ci: fix macOS Service Unit timeouts (reuse e2e build, warm cache)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "freenet-freenet-core-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "1c6549cf176137abf4712443a9b49e8717b707d8f7bd43596771f98c12ca18c7"
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
        "Harvested/verified timestamp recorded: 2026-11-15T20:51:39.580Z"
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
  "auth_token": "abc3b02b16030a50e25f69015628f7a4aa58374c5f662ca04030a8a4dc98856f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
