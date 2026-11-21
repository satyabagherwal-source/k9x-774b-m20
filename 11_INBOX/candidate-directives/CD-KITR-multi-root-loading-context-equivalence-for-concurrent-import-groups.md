# Candidate Directive: [CD-KITR] Multi-Root Loading Context Equivalence for Concurrent Import Groups

<!-- PROVENANCE_START
{
  "source_repository": "parcel-bundler/parcel",
  "source_url": "https://github.com/parcel-bundler/parcel",
  "source_version": "c0396a56",
  "license": "MIT",
  "timestamp": "2026-11-21T00:11:27.951Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-parcel-bundler-parcel",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [parcel-bundler/parcel](https://github.com/parcel-bundler/parcel) (Revision: `c0396a56`).  
> **License**: MIT | **Timestamp**: `2026-11-21T00:11:27.951Z`  
> **Learning ID**: `learn-github-parcel-bundler-parcel`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When building topological orderings or dependency cascades (such as CSS cascade order or script execution order) for asynchronously loaded targets, compilers MUST NOT select an arbitrary single representative node from concurrent import sets (e.g., `Promise.all([import('a'), import('b')])`). Compilers MUST evaluate the loading context across ALL concurrently requested roots simultaneously.

**WHY**:
Selecting a single arbitrary node (e.g., only `a` in `Promise.all([import('a'), import('b')])`) omits CSS assets uniquely reachable via peer roots (e.g., `b.css` from `b`). When code splitters place both assets into the same shared bundle context, downstream cascade checks fail to register dependencies of the omitted roots. This produces missing styles, unhandled rule conflicts, or incorrect source order in production stylesheets.

**WHEN TO APPLY**:
- In asset bundling, module linkers, and code-splitting algorithms where asynchronous edges execute simultaneously.
- When generating static HTML layouts or head preloads for dynamic import boundaries.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// crates/css/src/bundling.rs & crates/parcel/src/bundler/style_order.rs
impl OrderAnalysis {
    /// Determines CSS order across ALL root assets belonging to a concurrent loading context.
    pub fn for_context(
        &mut self,
        roots: &[AssetIndex],
        required: impl Fn(AssetIndex) -> bool,
    ) -> OrderedContent {
        self.for_context_with_imports(roots, required, |_, _| {})
    }

    pub fn for_context_with_imports(
        &mut self,
        roots: &[AssetIndex],
        required: impl Fn(AssetIndex) -> bool,
        mut import: impl FnMut(AssetIndex, AssetIndex),
    ) -> OrderedContent {
        // Fast path: bail if no root contains CSS
        if !roots
            .iter()
            .any(|root| self.nodes[root.index()].flags.contains(OrderFlags::HAS_CSS))
        {
            return OrderedContent::default();
        }

        self.scratch.seen.grow(self.nodes.len());
        let mut walk = OrderingWalk {
            analysis: self,
            required,
            import: &mut import,
            last_layer_position: None,
            output: OrderedContent::default(),
        };

        // Must collect entries from ALL roots in the concurrent group
        for &root in roots {
            walk.collect_entries(root);
        }

        walk.scratch.clear_seen();
        while let Some(entry) = walk.scratch.entries.pop() {
            walk.visit(entry);
        }
        walk.output
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Selecting a single representative member causes incomplete context trees
pub fn for_context_buggy(
    &mut self,
    representative_root: AssetIndex,
    required: impl Fn(AssetIndex) -> bool,
) -> OrderedContent {
    // BUG: Assets imported solely by sibling concurrent roots are dropped entirely
    // from this context, causing specificity and rule inversion bugs in the bundle.
    if !self.nodes[representative_root.index()].flags.contains(OrderFlags::HAS_CSS) {
        return OrderedContent::default();
    }
    let mut walk = OrderingWalk::new(self, required);
    walk.collect_entries(representative_root);
    // ...
    walk.output
}
```

**VERIFICATION METHOD**:
Verify with property tests feeding multi-root DAGs with cross-linked dependencies:
```rust
#[test]
fn test_concurrent_css_multi_root_inclusion() {
    let mut analysis = OrderAnalysis::new(vec![css(&[1]), css(&[]), css(&[3]), css(&[])]);
    // Asset 0 imports 1; Asset 2 imports 3. Both are roots of the same concurrent group.
    let roots = vec![AssetIndex(0), AssetIndex(2)];
    let ordered = analysis.for_context(&roots, |_| true);
    assert!(ordered.assets.contains(&AssetIndex(1)));
    assert!(ordered.assets.contains(&AssetIndex(3)));
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T00:11:27.948Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795219887948",
    "title": "Multi-Root Loading Context Equivalence for Concurrent Import Groups",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "parcel-bundler/parcel",
    "source_uri": "https://github.com/parcel-bundler/parcel",
    "source_version": "HEAD",
    "content_hash": "3a3fcba8635499a519c6fd13b4144714bcf9db96c0c680bcd06765d036800b7b"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-21T00:11:27.948Z"
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
  "auth_token": "4a5861fa2719de8da14b64d0d18d931c6929e052fc65fcd3443e671ff9dc969a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
