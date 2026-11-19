# Candidate Directive: [CD-2S34] retry background merges without blocking the sweep or VACUUM

<!-- PROVENANCE_START
{
  "source_repository": "paradedb/paradedb",
  "source_url": "https://github.com/paradedb/paradedb",
  "source_version": "98188786",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-19T17:38:05.104Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-paradedb-paradedb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [paradedb/paradedb](https://github.com/paradedb/paradedb) (Revision: `98188786`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-19T17:38:05.104Z`  
> **Learning ID**: `learn-github-paradedb-paradedb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `index_write/src/postgres/merge.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in paradedb/paradedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `534617a6`: retry background merges without blocking the sweep or VACUUM. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `index_write/src/postgres/merge.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    /// Only schedule a background merge; skip busy indexes.
    Background,
/// Returns true only for an empty background selection with no temporary exclusions.
pub unsafe fn do_merge(index: &PgSearchRelation, style: MergeStyle) -> anyhow::Result<bool> {
        return Ok(false);
    if matches!(style, MergeStyle::Background)
        && index.options().background_layer_sizes().is_empty()
    {
        return Ok(false);
    }
    let (merge_pins, merge_lock) = if matches!(style, MergeStyle::Background) {
        if VacuumSignal::new(index.oid()).wants_cancel() {
            return Ok(false);
        }
        let Some(locks) = metadata.try_pin_and_lock_merge() else {
            return Ok(false);
        };
        locks
    } else {
        (metadata.pin_merge(), metadata.acquire_merge_lock())
    };
    let no_candidates = matches!(style, MergeStyle::Background)
        && candidates.is_empty()
        && merge_lock.merge_list().list_segment_ids().next().is_none()
        && metadata.vacuum_list().read_list().is_empty();
        return Ok(false);
    Ok(no_candidates)
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    /// VACUUM finished; only a background merge may follow.
    Vacuum,
pub unsafe fn do_merge(index: &PgSearchRelation, style: MergeStyle) -> anyhow::Result<()> {
        return Ok(());
    let merge_pins = metadata.pin_merge();
    let merge_lock = metadata.acquire_merge_lock();
        return Ok(());
    Ok(())
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `534617a6` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T17:38:05.102Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795109885102",
    "title": "retry background merges without blocking the sweep or VACUUM",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "paradedb/paradedb",
    "source_uri": "https://github.com/paradedb/paradedb",
    "source_version": "HEAD",
    "content_hash": "6ae97790dc13111681605b23477917ec2a75cd2d06fc83318e5dac3704d58fec"
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
        "Harvested/verified timestamp recorded: 2026-11-19T17:38:05.102Z"
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
  "auth_token": "b8c2d595fb6730b96e244277cb2b4fbf041b09f8b406962fae3e32f5919be377"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
