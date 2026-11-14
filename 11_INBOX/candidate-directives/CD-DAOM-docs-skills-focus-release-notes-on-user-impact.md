# Candidate Directive: [CD-DAOM] docs(skills): focus release notes on user impact

<!-- PROVENANCE_START
{
  "source_repository": "greptimeteam-greptimedb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T17:51:54.349Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-greptimeteam-greptimedb-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [greptimeteam-greptimedb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T17:51:54.349Z`  
> **Learning ID**: `LEARN-EVO-greptimeteam-greptimedb-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain A

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.agents/skills/greptimedb-release-note/SKILL.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GreptimeTeam/greptimedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `176bc07b`: docs(skills): focus release notes on user impact. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.agents/skills/greptimedb-release-note/SKILL.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
For every release type, use the release tag's commit as `<tip>` when the tag exists.
Resolve the exact tag from the remote (use the peeled `^{}` commit for annotated tags)
and exclude commits added to the release branch afterward. Before tagging, pin the
intended release commit and record its SHA. Pass that SHA as `--target` when creating
the release, then verify the resulting tag before publishing the docs copy.

Base = the **previous minor tag** (e.g. `v1.1.0`); tip = the release commit resolved above.
Split the range at the point where `release/vX.Y` left `main`:
GITHUB_TOKEN=$(gh auth token) git cliff <prev-patch-tag>..<tip> --tag vX.Y.Z -o ...
(`git log -1 --format=%B <tip>`) — each `* fix: ... (#NN)` line is a picked PR.
group by the `cliff.toml` parsers (first match wins), order by `merged_at`, and review `!` titles
for user-visible compatibility impact (§6) before assigning a category.
Review generated breaking-change bullets using the same user-impact criteria as §6. Move
internal-only entries to ordinary groups, preserving genuine incompatibilities, PR links,
and authors.

```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
Base = the **previous minor tag** (e.g. `v1.1.0`); tip = the tagged `vX.Y.0` commit, resolved as
in "Pre-release" below. Split the range at the point where `release/vX.Y` left `main`:
GITHUB_TOKEN=$(gh auth token) git cliff <prev-patch-tag>..<release-branch-tip> --tag vX.Y.Z -o ...
(`git log -1 --format=%B <release-branch-tip>`) — each `* fix: ... (#NN)` line is a picked PR.
**The tip is the tagged commit, not the release branch tip.** Resolve it from the remote and
write this SHA in the docs PR body (§8) as what the note was checked against:
```
git ls-remote --tags <remote> 'vX.Y.Z-beta.N*'
```
Use the `refs/tags/vX.Y.Z-beta.N` line (its `^{}` line if the tag is annotated), not the
build-suffixed tags it also lists. PRs that land on `release/vX.Y` after the tag
(`git log --oneline <tag>..<remote>/release/vX.Y`) belong to the next release, even if they are
already merged when you write the note.

group by the `cliff.toml` parsers (first match wins), order by `merged_at`, and put `!` titles

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T17:51:54.452Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794678714452",
    "title": "docs(skills): focus release notes on user impact",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "greptimeteam-greptimedb-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "bb73d672560a3a6b3812e7988249097c9bada5eabab02213180275725c10ef02"
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
        "Harvested/verified timestamp recorded: 2026-11-14T17:51:54.452Z"
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
  "auth_token": "9204538f4fc42fdcc768a7f8cee3dc4a5ff03055ca4b5003bbd4b239367a66f9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
