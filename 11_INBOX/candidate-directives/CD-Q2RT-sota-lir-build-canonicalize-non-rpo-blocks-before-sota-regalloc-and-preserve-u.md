# Candidate Directive: [CD-Q2RT] sota,lir,build): canonicalize non-RPO blocks before SOTA regalloc and preserve u

<!-- PROVENANCE_START
{
  "source_repository": "indexable-inc/blaze",
  "source_url": "https://github.com/indexable-inc/blaze",
  "source_version": "06036d58",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T16:54:34.121Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-indexable-inc-blaze",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [indexable-inc/blaze](https://github.com/indexable-inc/blaze) (Revision: `06036d58`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T16:54:34.121Z`  
> **Learning ID**: `learn-github-indexable-inc-blaze`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/blaze-build/src/layout.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in indexable-inc/blaze. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `382168c3`: sota,lir,build): canonicalize non-RPO blocks before SOTA regalloc and preserve unsizable generic struct tail order. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/blaze-build/src/layout.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// Whether `adt`'s last field (in its unsubstituted definition) can be unsized via a structural
/// `Unsize` coercion (`&S<SizedTail> -> &S<UnsizedTail>`, e.g. `PolymorphicIter<[MaybeUninit<T>; N]>`
/// -> `PolymorphicIter<[MaybeUninit<T>]>`, `ArcInner<T>`, `Mutex<T>`, `UnsafeCell<T>`).
///
/// Rust requires unsizing a struct to preserve the byte offsets of every field preceding the tail,
/// so a potentially-unsized tail field must stay last even when monomorphized with a sized,
/// higher-alignment type (such as `u128` or `[MaybeUninit<(u64, BlobParams)>; 2]`).
fn struct_tail_may_unsize<'a>(adt: &Adt<'a>, facts: &'a dyn LayoutFacts) -> bool {
    if adt.generics == 0 {
        return false;
    }
    let [variant] = adt.variants else { return false };
    let Some(last) = adt.fields.get(variant.fields.range()).and_then(|fs| fs.last()) else {
        return false;
    };
    ty_may_unsize(last.ty, adt.types, facts, 16)
}

fn ty_may_unsize<'a>(mut ty: PTy, mut tys: blaze_typeck::PTys<'a>, facts: &'a dyn LayoutFacts, mut budget: u8) -> bool {
    loop {
        if budget == 0 {
            return true;
        }
        budget -= 1;
        let Ok(node) = tys.node(ty) else { return
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
                let u = self.univariant(parts, Order::Decreasing, ReprAttrs::RUST, 0, 0, cx.scratch)?;
                    let u = self.univariant(parts, Order::Decreasing, ReprAttrs::RUST, 0, 0, cx.scratch)?;
                let u = self.univariant(parts, Order::Decreasing, ReprAttrs::RUST, 0, 0, cx.scratch)?;
    fn univariant(&mut self, parts: &[PTy], order: Order, attrs: ReprAttrs, start: u64, min_align: u8, scratch: Alloc<'_>
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `382168c3` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T16:54:34.119Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795539274119",
    "title": "sota,lir,build): canonicalize non-RPO blocks before SOTA regalloc and preserve u",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "indexable-inc/blaze",
    "source_uri": "https://github.com/indexable-inc/blaze",
    "source_version": "HEAD",
    "content_hash": "717ce4353802fda8f1e1c6ab3a491755e68fb850a7e13ca1063200d866324c20"
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
        "Harvested/verified timestamp recorded: 2026-11-24T16:54:34.119Z"
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
  "auth_token": "ff986bbe4aa212a5e16f6d3505aaa6cc8f80583aa0bab19d53306d27e891eee0"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
