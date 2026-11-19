# Candidate Directive: [CD-EUJ3] close the gaps left after the compare sweep (#173 follow-up)

<!-- PROVENANCE_START
{
  "source_repository": "bahdotsh/wrkflw",
  "source_url": "https://github.com/bahdotsh/wrkflw",
  "source_version": "b0fdd8df",
  "license": "MIT",
  "timestamp": "2026-11-19T14:03:31.215Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-bahdotsh-wrkflw",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [bahdotsh/wrkflw](https://github.com/bahdotsh/wrkflw) (Revision: `b0fdd8df`).  
> **License**: MIT | **Timestamp**: `2026-11-19T14:03:31.215Z`  
> **Learning ID**: `learn-github-bahdotsh-wrkflw`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain A

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in bahdotsh/wrkflw. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b0fdd8df`: close the gaps left after the compare sweep (#173 follow-up). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- The built-in image is the base image plus tools the hosted Ubuntu runner has and steps call without installing: `sudo`, `jq`, `gh`, `unzip`, `zip`, `wget`, `xz`, `zstd`, `file`, `ssh`, `rsync`, `git-lfs`, `python3` with `pip`, a C toolchain and Node.js. It is built once and shared by every job. `gh` comes from cli.github.com in a layer of its own: when that can't be reached the job runs without it, with a warning, and the next run tries again. When the tools can't be installed at all, a job with nothing else to set up runs on the bare base image.
- Steps of a job in the built-in image run as `runner`, as on GitHub: a user with `/home/runner` for its home and `sudo` without a password, so a test that expects a permission error gets one. rustup and cargo are in its home, and it owns what `pip install` and `npm install -g` write to. On Linux the user has your uid, so what a step writes in the workspace stays yours; elsewhere it has GitHub's, 1001. Files an earlier run left in the workspace or the `--dep-cache` directories as root's are handed to that user before the first step. Steps run as root instead, with one warning per run, where that user can't write the job's files: under a 
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
- The built-in image is the base image plus tools the hosted Ubuntu runner has and steps call without installing: `sudo`, `jq`, `gh`, `unzip`, `zip`, `wget`, `xz`, `zstd`, `file`, `ssh`, `rsync`, `git-lfs`, `python3` with `pip`, a C toolchain and Node.js. It is built once and shared by every job. `gh` comes from cli.github.com in a layer of its own: when that can't be reached the job runs without it, with a warning, and the next run tries again. When the tools can't be installed at all, a job with nothing else to set up runs on the bare base image. Steps still run as root, where GitHub's run as the `runner` user, so a test that expects a permission error passes on GitHub and fails here.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b0fdd8df` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T14:03:31.213Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795097011213",
    "title": "close the gaps left after the compare sweep (#173 follow-up)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "bahdotsh/wrkflw",
    "source_uri": "https://github.com/bahdotsh/wrkflw",
    "source_version": "HEAD",
    "content_hash": "6e0afff6cdd8ee0c319cfa2251133fce0e63efdbc184e4612cb6d8d7e1e0fdc6"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-19T14:03:31.213Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "426d44d9fe1315aef5d9227562beb015a970a2759ab87975b19b4aa9e692ee50"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
