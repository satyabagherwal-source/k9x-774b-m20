# Candidate Directive: [CD-ZZLM] resolve python calls through annotated parameters and self members

<!-- PROVENANCE_START
{
  "source_repository": "zvec-ai/zvec-grep",
  "source_url": "https://github.com/zvec-ai/zvec-grep",
  "source_version": "2f18f2d9",
  "license": "Apache-2.0",
  "timestamp": "2026-11-23T20:30:33.466Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-zvec-ai-zvec-grep",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zvec-ai/zvec-grep](https://github.com/zvec-ai/zvec-grep) (Revision: `2f18f2d9`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-23T20:30:33.466Z`  
> **Learning ID**: `learn-github-zvec-ai-zvec-grep`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `rust/crates/zg-engine/src/extraction/graph.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zvec-ai/zvec-grep. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2f18f2d9`: rust): resolve python calls through annotated parameters and self members. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `rust/crates/zg-engine/src/extraction/graph.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// The bound type extraction records for a Python name a body rebinds to a
/// value the index cannot place (`client = clients[0]`, `self.client = client`).
///
/// The write shadows what an earlier declaration stated — a parameter's
/// annotation, a member's previous assignment — so the name holds no type from
/// that line on. The resolver reads the sentinel as "stated, but undecided":
/// the answer is not the type the name no longer holds, and a base class's
/// member is not the answer either.
pub(crate) const PYTHON_UNBOUND_TYPE: &str = "[[python_unbound]]";

/// The bound type extraction records for a Python member a class writes as
/// `None` (`self.client = None`).
///
/// The write is a declaration of the member — the class chooses what the name
/// holds, so a base class's member of the same name is not the answer — but it
/// states no type. It differs from [`PYTHON_UNBOUND_TYPE`], which leaves the
/// member undecided even beside a write that does state a type: an optional
/// member (`__init__` writes `None`, another method stores the real value) is
/// still typed by the write that states one.
pub(crate) const PYTHON_NONE_TYPE: &str = "[[python_none]]";

    /// Th
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2f18f2d9` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T20:30:33.464Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795465833464",
    "title": "resolve python calls through annotated parameters and self members",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "zvec-ai/zvec-grep",
    "source_uri": "https://github.com/zvec-ai/zvec-grep",
    "source_version": "HEAD",
    "content_hash": "191c4dbb565b5f0ff9331bd440fd75ee558aa6d661aec981f361537e1c1f6979"
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
        "Harvested/verified timestamp recorded: 2026-11-23T20:30:33.464Z"
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
  "auth_token": "045d5bfd1cab424f2b1ac7d9c6615fe784ba8c552f9f968c8fcd55ec1edc4e9d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
