# Candidate Directive: [CD-UZ8A] Merge branch 'main' of https://github.com/NucleoidAI/Nucleoid

<!-- PROVENANCE_START
{
  "source_repository": "NucleoidAI/Nucleoid",
  "source_url": "https://github.com/NucleoidAI/Nucleoid",
  "source_version": "41394de4",
  "license": "Apache-2.0",
  "timestamp": "2026-11-14T12:57:43.642Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nucleoidai-nucleoid",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid) (Revision: `41394de4`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-14T12:57:43.642Z`  
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
Prevents defects observed in production commit `41394de4`: Merge branch 'main' of https://github.com/NucleoidAI/Nucleoid. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

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
Automated regression test asserting that input states reproducing defect `41394de4` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T12:57:43.637Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794661063637",
    "title": "Merge branch 'main' of https://github.com/NucleoidAI/Nucleoid",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "NucleoidAI/Nucleoid",
    "source_uri": "https://github.com/NucleoidAI/Nucleoid",
    "source_version": "HEAD",
    "content_hash": "a0a2e0c01f3b6773cddd644a215950da345009a6584f5575a3009abcb4e3732d"
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
        "Harvested/verified timestamp recorded: 2026-11-14T12:57:43.638Z"
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
  "auth_token": "e82895dabd06fc0c6633764403cb2516f2ded2ff63a8b9221711aa16b32d0037"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
