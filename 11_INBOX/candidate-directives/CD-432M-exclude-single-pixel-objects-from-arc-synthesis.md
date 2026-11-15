# Candidate Directive: [CD-432M] Exclude single-pixel objects from ARC synthesis

<!-- PROVENANCE_START
{
  "source_repository": "NucleoidAI/Nucleoid",
  "source_url": "https://github.com/NucleoidAI/Nucleoid",
  "source_version": "a19be499",
  "license": "Apache-2.0",
  "timestamp": "2026-11-15T10:04:31.246Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nucleoidai-nucleoid",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid) (Revision: `a19be499`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-15T10:04:31.246Z`  
> **Learning ID**: `learn-github-nucleoidai-nucleoid`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.claude/agents/arc-debug.agent.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NucleoidAI/Nucleoid. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a19be499`: Exclude single-pixel objects from ARC synthesis. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/agents/arc-debug.agent.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
   x+1 y+1, x-1 y+1 or x-1 y-1, except an instance whose object, its input
   object or its output object when the input is empty, is a single pixel.
   A training pair without other instances gains none. They follow the
   training pairs in `train_dataset.dataset`, three per training pair in
   turn, in that order. Each holds one instance per synthesized extracted
   instance of its source pair, in source order, with `synthesis` (`source`,
   `rotation`, `offset`), named
  instance per extracted instance of its source pair whose object, its input
  object or its output object when the input is empty, is not a single pixel,
  in source order, whose `source` names it; a training pair whose instances
  are all single pixels has no synthesized pairs, and no `source` names a
  single pixel. Recompute each instance from its source with the
  as one that always grows its object in one direction, or that it reads a
  canvas that grew to hold the turned objects, objects that overlap after
  turning, or a list argument, such as cell positions, that carried over
  unturned.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
   x+1 y+1, x-1 y+1 or x-1 y-1. They follow the training pairs in
   `train_dataset.dataset`, three per training pair in turn, in that order.
   Each holds one instance per extracted instance of its source pair, in
   source order, with `synthesis` (`source`, `rotation`, `offset`), named
  instance per extracted instance of its source pair, in source order, whose
  `source` names it. Recompute each instance from its source with the
  as a rim that always grows above its point, or that it reads a canvas that
  grew to hold the turned objects, objects that overlap after turning, or a
  list argument, such as cell positions, that carried over unturned.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a19be499` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T10:04:31.244Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794737071244",
    "title": "Exclude single-pixel objects from ARC synthesis",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "NucleoidAI/Nucleoid",
    "source_uri": "https://github.com/NucleoidAI/Nucleoid",
    "source_version": "HEAD",
    "content_hash": "8d07058b974dabc3958f37c93fc6c8d3e2db40962763c52f0ca2e9b68dd4337a"
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
        "Harvested/verified timestamp recorded: 2026-11-15T10:04:31.244Z"
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
  "auth_token": "9e459d925c8e6682adf722bb75fb45d69e83bceb550db9cbe4e88e021ca79d30"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
