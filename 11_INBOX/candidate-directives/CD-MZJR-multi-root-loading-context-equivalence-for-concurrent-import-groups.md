# Candidate Directive: [CD-MZJR] Multi-Root Loading Context Equivalence for Concurrent Import Groups

<!-- PROVENANCE_START
{
  "source_repository": "parcel-bundler-parcel-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T00:13:22.792Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-parcel-bundler-parcel-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [parcel-bundler-parcel-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T00:13:22.792Z`  
> **Learning ID**: `LEARN-EVO-parcel-bundler-parcel-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T00:13:22.932Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795220002932",
    "title": "Multi-Root Loading Context Equivalence for Concurrent Import Groups",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "parcel-bundler-parcel-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "ec78e553efcfd5a2db8bf0d5814b69d5f7a496380e7d53ea084e0041330dc4e0"
  },
  "evidence_fingerprint": "NO_EVIDENCE",
  "dimensions": {
    "source_reliability": {
      "status": "FAIL",
      "score": 0,
      "tier": "UNTRUSTED_EXTERNAL",
      "findings": [
        "MISSING_SOURCE_URI: Knowledge has no source URL or locator"
      ],
      "details": [
        "Source is completely untraceable; origin cannot be verified."
      ]
    },
    "evidence_quality": {
      "status": "WARN",
      "score": 0.2,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [
        "NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records"
      ],
      "details": [
        "Claim is uncorroborated; relies solely on raw unverified source text."
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
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-21T00:13:22.933Z"
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
    "Source provenance",
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [],
  "auth_token": "b5b516fb30bc5e599b48130119c3ce26e742d5ed1505f9596d2e91c9ee88b420"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
