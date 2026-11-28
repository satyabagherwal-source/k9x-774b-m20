# Candidate Directive: [CD-OHFG] ci(tessl): add PR steward, groom-ready digest and more maintainer loops

<!-- PROVENANCE_START
{
  "source_repository": "agent-of-empires/agent-of-empires",
  "source_url": "https://github.com/agent-of-empires/agent-of-empires",
  "source_version": "13db8d17",
  "license": "MIT",
  "timestamp": "2026-11-28T07:40:08.380Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-agent-of-empires-agent-of-empires",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [agent-of-empires/agent-of-empires](https://github.com/agent-of-empires/agent-of-empires) (Revision: `13db8d17`).  
> **License**: MIT | **Timestamp**: `2026-11-28T07:40:08.380Z`  
> **Learning ID**: `learn-github-agent-of-empires-agent-of-empires`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `tessl-plugins/aoe-maintainer/skills/groom-ready/SKILL.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in agent-of-empires/agent-of-empires. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a53f1334`: ci(tessl): add PR steward, groom-ready digest and more maintainer loops. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `tessl-plugins/aoe-maintainer/skills/groom-ready/SKILL.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
description: "Scan open agent-of-empires issues that lack the ready-for-agent label, pick up to 10 that are well specified, and record a Tessl finding per candidate recommending that a maintainer add ready-for-agent or tessl, listing any missing information, then post one weekly digest comment that mentions the maintainers in the Maintainer digest issue. On GitHub it writes only that issue and its comment; it never labels, assigns, or comments on the issues it assesses. Use when the weekly grooming runs, or when asked which issues are ready for an agent."
candidate, then post a digest for maintainers. This runs unattended with a
token that can write issues. On GitHub, write only the `Maintainer digest`
issue and one comment on it per run (step 4). Never label, assign, or comment
on the issues you assess.
Never copy issue text, titles included, into the digest: name an issue by its
number only and name missing information only with the fixed reasons in
step 4.
After every `tessl finding create` or `tessl finding update` in this run,
retirements included, read the finding back with
`tessl finding view <id> --json`. Compare each field with what you intended.
If one differs, fix it onc
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
description: "Scan open agent-of-empires issues that lack the ready-for-agent label, pick up to 10 that are well specified, and record a Tessl finding per candidate recommending that a maintainer add ready-for-agent or tessl, listing any missing information. Read-only: never writes to GitHub. Use when the weekly grooming runs, or when asked which issues are ready for an agent."
candidate. This runs unattended with a read-only GitHub token. Do not label,
comment, or assign.
End with one sentence giving how many issues you assessed and the finding ids.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a53f1334` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T07:40:08.378Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795851608378",
    "title": "ci(tessl): add PR steward, groom-ready digest and more maintainer loops",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "agent-of-empires/agent-of-empires",
    "source_uri": "https://github.com/agent-of-empires/agent-of-empires",
    "source_version": "HEAD",
    "content_hash": "241b3cd5bd216c94ff0ab0a29dfbbe2a3791fdcace1a9bed21c9605952d6e769"
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
        "Harvested/verified timestamp recorded: 2026-11-28T07:40:08.378Z"
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
  "auth_token": "560fc52cf700bcf598c8294e75813b587f390e97aee803ff56f2f9c1943a2275"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
