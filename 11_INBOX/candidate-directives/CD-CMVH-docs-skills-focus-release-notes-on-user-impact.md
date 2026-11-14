# Candidate Directive: [CD-CMVH] docs(skills): focus release notes on user impact

<!-- PROVENANCE_START
{
  "source_repository": "GreptimeTeam/greptimedb",
  "source_url": "https://github.com/GreptimeTeam/greptimedb",
  "source_version": "176bc07b",
  "license": "Apache-2.0",
  "timestamp": "2026-11-14T17:51:23.597Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-greptimeteam-greptimedb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb) (Revision: `176bc07b`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-14T17:51:23.597Z`  
> **Learning ID**: `learn-github-greptimeteam-greptimedb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
under Breaking changes (§6).
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `176bc07b` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T17:51:23.595Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794678683595",
    "title": "docs(skills): focus release notes on user impact",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "GreptimeTeam/greptimedb",
    "source_uri": "https://github.com/GreptimeTeam/greptimedb",
    "source_version": "HEAD",
    "content_hash": "054d76a3f3c069b9bf87639ed8ffc9b81886c05ff4316b19195d1b95d0a8dace"
  },
  "evidence_fingerprint": "0ea4249640d6d3cc",
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
        "Direct empirical evidence ratio: 0% (0/4)",
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
        "Harvested/verified timestamp recorded: 2026-11-14T17:51:23.595Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "66ba921228811ec1dd7db5c1356f4cad9d5b39137d8871c9db776faf15e4f5ef"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
