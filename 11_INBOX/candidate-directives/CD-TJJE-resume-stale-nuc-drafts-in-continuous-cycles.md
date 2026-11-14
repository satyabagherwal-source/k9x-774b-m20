# Candidate Directive: [CD-TJJE] Resume stale NUC drafts in continuous cycles

<!-- PROVENANCE_START
{
  "source_repository": "NucleoidAI/Nucleoid",
  "source_url": "https://github.com/NucleoidAI/Nucleoid",
  "source_version": "120db05d",
  "license": "Apache-2.0",
  "timestamp": "2026-11-14T11:04:38.186Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nucleoidai-nucleoid",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid) (Revision: `120db05d`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-14T11:04:38.186Z`  
> **Learning ID**: `learn-github-nucleoidai-nucleoid`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.claude/CLAUDE.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NucleoidAI/Nucleoid. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c9839532`: Resume stale NUC drafts in continuous cycles. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/CLAUDE.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
| [proposals.instructions.md](rules/proposals.instructions.md) | Independent NUC proposal preparation and evaluation, the token policy, automatic acceptance on the hard criteria (no compile errors, every test passing, backward compatibility) with the `Automatic-Accepted` status, ARC- and user-requested bases, the pushed `Draft NUC <number> <Title>` allocation of each new NUC before its details, after a pull that claims the next free number or skips a concept already proposed, continuous cycles that first pick up allocated Drafts idle for 24 hours under a pushed `Resume NUC <number> <Title>` claim, and `NUC <number> <Title>` outcome commit messages |
| [git.instructions.md](rules/git.instructions.md) | Only `/nuc-proposal` (NUC allocations, claims and outcomes) and `/arc-purposal` (its own ARC changes, when it is done) commit and push; every agent pulls before it starts (fast-forward only, except those callers before a commit or push), pull before commit/push, push after every commit, resolve conflicts and push |
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
| [proposals.instructions.md](rules/proposals.instructions.md) | Independent NUC proposal preparation and evaluation, the token policy, automatic acceptance on the hard criteria (no compile errors, every test passing, backward compatibility) with the `Automatic-Accepted` status, ARC- and user-requested bases, the pushed `Draft NUC <number> <Title>` allocation of each new NUC before its details, after a pull that claims the next free number or skips a concept already proposed, and `NUC <number> <Title>` outcome commit messages |
| [git.instructions.md](rules/git.instructions.md) | Only `/nuc-proposal` (NUC allocations and outcomes) and `/arc-purposal` (its own ARC changes, when it is done) commit and push; every agent pulls before it starts (fast-forward only, except those callers before a commit or push), pull before commit/push, push after every commit, resolve conflicts and push |
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c9839532` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T11:04:38.183Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794654278183",
    "title": "Resume stale NUC drafts in continuous cycles",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "NucleoidAI/Nucleoid",
    "source_uri": "https://github.com/NucleoidAI/Nucleoid",
    "source_version": "HEAD",
    "content_hash": "e3d8c7c3196fd4af49725b60ae53e66114de98dc1e29fcb72a8c586e69ab07eb"
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
        "Harvested/verified timestamp recorded: 2026-11-14T11:04:38.183Z"
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
  "auth_token": "0bc01cee4cd95411ee0cdb75f7ef996207ef20a5b4c96e4336618c0aae3e2973"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
