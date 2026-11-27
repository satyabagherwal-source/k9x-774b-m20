# Candidate Directive: [CD-LTNL] mito2): require a region to own its files before a remap

<!-- PROVENANCE_START
{
  "source_repository": "greptimeteam-greptimedb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T05:30:25.622Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-greptimeteam-greptimedb-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [greptimeteam-greptimedb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T05:30:25.622Z`  
> **Learning ID**: `LEARN-EVO-greptimeteam-greptimedb-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/common/meta/src/instruction.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GreptimeTeam/greptimedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0127d638`: mito2): require a region to own its files before a remap. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/common/meta/src/instruction.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
    /// Only verify that the remap would be accepted instead of writing staging manifests.
    ///
    /// The repartition procedure sends such a request to each *source leader* before it publishes
    /// the new routes; the datanode then reads the region's persisted manifest and reports whether
    /// the region holds a file it did not create itself. Nothing is staged and nothing is written.
    ///
    /// An older datanode ignores this unknown field (it is `#[serde(default)]`, so it simply
    /// deserializes as `false`) and performs an ordinary remap. That is still safe: an ordinary
    /// remap requires the region to be in staging state, and these sources are not staged yet, so
    /// the datanode answers with the structured stage-required error
    /// (`mito2::worker::handle_remap` → `InvalidRequest` "region is not in staging state"). Metasrv
    /// therefore sees an error rather than a silent success, and aborts the group before the
    /// routes are published.
    #[serde(default)]
    pub validate_only: bool,
            "RemapManifest(region_id={}, input_regions={:?}, region_mapping={:?}, new_part
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
            "RemapManifest(region_id={}, input_regions={:?}, region_mapping={:?}, new_partition_exprs={:?})",
            self.region_id, self.input_regions, self.region_mapping, self.new_partition_exprs
    use std::collections::HashSet;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0127d638` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T05:30:25.759Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795757425759",
    "title": "mito2): require a region to own its files before a remap",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "greptimeteam-greptimedb-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "eed4e7688a917824bb4798c15ff3745bccf0d1bbc35b4ee72ac6ab5322e76d36"
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
        "Harvested/verified timestamp recorded: 2026-11-27T05:30:25.759Z"
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
  "auth_token": "b323d0c93029a2361a4d56c8d4a6c2fe0b2958dfc73126a93f6efaa118c812ff"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
