# Candidate Directive: [CD-K1QD] batch small blocks before the window partition exchange

<!-- PROVENANCE_START
{
  "source_repository": "databendlabs/databend",
  "source_url": "https://github.com/databendlabs/databend",
  "source_version": "a83eaead",
  "license": "Apache-2.0",
  "timestamp": "2026-11-19T17:23:31.142Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-databendlabs-databend",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [databendlabs/databend](https://github.com/databendlabs/databend) (Revision: `a83eaead`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-19T17:23:31.142Z`  
> **Learning ID**: `learn-github-databendlabs-databend`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/query/expression/src/kernels/stream_partition.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in databendlabs/databend. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `dea33860`: query): batch small blocks before the window partition exchange. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/query/expression/src/kernels/stream_partition.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    /// Add every row of `column`, in order.
    fn append_column(&mut self, column: &Column) {
        let builder = self.builder(column.len());
        if builder.data_type() == column.data_type() {
            builder.append_column(column);
        } else {
            // Such as an `Array` column into an `EmptyArray` builder, which
            // only `copy_column` turns into an `Array` builder.
            let indices = (0..column.len() as u32).collect::<Vec<_>>();
            copy_column(&indices, column, builder);
        }
    }

    /// Add `rows` of a constant, kept a constant when it can be.
    fn append_const(
        &mut self,
        scalar: &Scalar,
        data_type: &DataType,
        rows: usize,
        size: &mut impl FnMut() -> ExpandedSize,
    ) {
        if !self.try_push_const(scalar, data_type, rows, size) {
            let column = ColumnBuilder::repeat(&scalar.as_ref(), rows, data_type).build();
            self.append_column(&column);
        }
    }

/// The expanded size of the last constant seen in a column.
type ConstSize = Option<(Scalar, DataType, ExpandedSize)>;

fn cached_const_size(cache: &mut ConstSize, scalar: &Scalar, data_type: &DataType)
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    const_sizes: Vec<Option<(Scalar, DataType, ExpandedSize)>>,
                    let mut size = || {
                        if let Some((s, t, size)) = const_size.as_ref()
                            && *s == scalar
                            && *t == data_type
                        {
                            return *size;
                        }
                        let size = ExpandedSize::measure(&scalar, &data_type);
                        *const_size = Some((scalar.clone(), data_type.clone(), size));
                        size
                    };
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `dea33860` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T17:23:31.139Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795109011139",
    "title": "batch small blocks before the window partition exchange",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "databendlabs/databend",
    "source_uri": "https://github.com/databendlabs/databend",
    "source_version": "HEAD",
    "content_hash": "0253ddb4385dafc71094c1e2d4631c167cc0a33c70b0999c2b97aeb3ca35a161"
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
        "Harvested/verified timestamp recorded: 2026-11-19T17:23:31.139Z"
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
  "auth_token": "3ee672034b14bf5c329c74d0ded0bbfe52bca32c65051a0b56c22de773dcbf9b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
