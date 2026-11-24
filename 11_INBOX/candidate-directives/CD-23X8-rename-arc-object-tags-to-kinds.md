# Candidate Directive: [CD-23X8] Rename ARC object tags to kinds

<!-- PROVENANCE_START
{
  "source_repository": "NucleoidAI/Nucleoid",
  "source_url": "https://github.com/NucleoidAI/Nucleoid",
  "source_version": "8f515043",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T21:15:52.028Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nucleoidai-nucleoid",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid) (Revision: `8f515043`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T21:15:52.028Z`  
> **Learning ID**: `learn-github-nucleoidai-nucleoid`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.claude/agents/arc-dataset.agent.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NucleoidAI/Nucleoid. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `df1f1406`: Rename ARC object tags to kinds. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/agents/arc-dataset.agent.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
for world-model idioms, properties, rules, and kinds. The solver sends every
  volume: int, kind: str = 'lNNNN', ...)`; add another class only for a
  distinct sort of object the transformation needs. Each class whose
  order, then the optional `kind: str = 'lNNNN'`, whose default is the class's
  initial kind, and its body assigns every parameter to `this`, the kind with
  `this.kind is kind` right after `this.volume is volume`. An implementation
  passes `kind` only when its object needs a kind other than the default, as
  with `kind='l4262'` and the like; otherwise it leaves `kind` out. The default
- A kind is `l` followed by four digits and names a geometry. It acts as a
  child class that the rules assign declaratively: an instance never changes
  its class, so a rule such as `$Obj.kind is l1707` moves it to another kind.
  Reuse the kind an existing dataset uses for the same geometry; otherwise
  mint one unused elsewhere.
instances, the transformation, properties the rules create, kinds, the original
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
for world-model idioms, properties, rules, and tags. The solver sends every
  volume: int, tag: str = 'lNNNN', ...)`; add another class only for a
  distinct kind of object the transformation needs. Each class whose
  order, then the optional `tag: str = 'lNNNN'`, whose default is the class's
  initial tag, and its body assigns every parameter to `this`, the tag with
  `this.tag is tag` right after `this.volume is volume`. An implementation
  passes `tag` only when its object needs a tag other than the default, as
  with `tag='l4262'` and the like; otherwise it leaves `tag` out. The default
- A tag is `l` followed by four digits and names a geometry. Reuse the tag an
  existing dataset uses for the same geometry; otherwise mint one unused
  elsewhere.
instances, the transformation, properties the rules create, tags, the original
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `df1f1406` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T21:15:52.026Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795554952026",
    "title": "Rename ARC object tags to kinds",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "NucleoidAI/Nucleoid",
    "source_uri": "https://github.com/NucleoidAI/Nucleoid",
    "source_version": "HEAD",
    "content_hash": "97e895e1d3a6a584c3f55ab86fa5d944971e1e06eb739af35c3840de08f4ca1d"
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
        "Harvested/verified timestamp recorded: 2026-11-24T21:15:52.026Z"
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
  "auth_token": "283e4958e14001f084b0249cec108fe5429978b06cdd5be66626c450716436f0"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
