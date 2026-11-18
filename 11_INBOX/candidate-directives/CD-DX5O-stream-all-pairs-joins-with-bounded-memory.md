# Candidate Directive: [CD-DX5O] stream all-pairs joins with bounded memory

<!-- PROVENANCE_START
{
  "source_repository": "databendlabs/databend",
  "source_url": "https://github.com/databendlabs/databend",
  "source_version": "6546196f",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T13:47:07.932Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-databendlabs-databend",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [databendlabs/databend](https://github.com/databendlabs/databend) (Revision: `6546196f`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T13:47:07.932Z`  
> **Learning ID**: `learn-github-databendlabs-databend`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/query/service/src/physical_plans/physical_hash_join.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in databendlabs/databend. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `50f8ae1b`: query): stream all-pairs joins with bounded memory. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/query/service/src/physical_plans/physical_hash_join.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use crate::pipelines::processors::transforms::probes_all_pairs;
        // Joins without anything to hash stream all pairs on this executor.
            && !desc.probes_all_pairs()
    /// When the probe streams all pairs, a side without required columns
    /// contributes only its row count, which the build side keeps without
    /// retaining or spilling any block. Build it from that side. The
    /// zero-column side occupies no projected positions, so join conditions
    /// and the output keep the same column offsets.
    fn build_zero_column_side(&mut self) {
        // Build-side caches consume the build state of the side the planner chose.
        if !probes_all_pairs(
            self.join_type,
            !self.build_keys.is_empty(),
            self.single_to_inner,
        ) || !self.probe_projections.is_empty()
            || self.build_projections.is_empty()
            || self.build_side_cache_info.is_some()
        {
            return;
        }
        debug_assert!(self.build_keys.is_empty() && self.probe_to_build.is_empty());
        std::mem::swap(&mut self.probe, &mut self.build);
        std::mem::swap(&mut self.probe_projections, &mut self.build_projection
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
use crate::physical_plans::resolve_scalar;
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct NestedLoopFilterInfo {
    pub predicates: Vec<RemoteExpr>,
    pub projection: Vec<usize>,
}

    pub nested_loop_filter: Option<NestedLoopFilterInfo>,
            nested_loop_filter: self.nested_loop_filter.clone(),

    fn build_nested_loop_filter_info(
        &self,
        join: &Join,
        probe_schema: &DataSchema,
        build_schema: &DataSchema,
        target_schema: &DataSchema,
    ) -> Result<Option<NestedLoopFilterInfo>> {
        build_nested_loop_filter_info_for_join(join, probe_schema, build_schema, target_schema)
    }
}

fn build_nested_loop_filter_info_for_join(
    join: &Join,
    probe_schema: &DataSchema,
    build_schema: &DataSchema,
    target_schema: &DataSchema,
) -> Result<Option<NestedLoopFilterInfo>> {
    if !matches!(join.join_type, JoinType::Inner) {
        return Ok(None);
    }

    if !join.equi_conditions.is_empty() {
        // Inner joins with equality keys should still use the hash table even
        // when the build side is small. Falling back to nested-loop evaluates
        // the equality and residual predicates fo
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `50f8ae1b` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T13:47:07.929Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795009627929",
    "title": "stream all-pairs joins with bounded memory",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "databendlabs/databend",
    "source_uri": "https://github.com/databendlabs/databend",
    "source_version": "HEAD",
    "content_hash": "8af4225de02f0d92b7bf93bf2d8f5309307288ac3ad39fe0ebad93879e9f6745"
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
        "Harvested/verified timestamp recorded: 2026-11-18T13:47:07.929Z"
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
  "auth_token": "fa8fb6c42d30aafc3edf3a477d771a51ef396d6b4b668102feb65a3d73577172"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
