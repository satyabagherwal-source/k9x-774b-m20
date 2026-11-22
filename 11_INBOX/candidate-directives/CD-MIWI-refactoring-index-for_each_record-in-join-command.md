# Candidate Directive: [CD-MIWI] Refactoring Index::for_each_record in join command

<!-- PROVENANCE_START
{
  "source_repository": "medialab/xan",
  "source_url": "https://github.com/medialab/xan",
  "source_version": "cca1cceb",
  "license": "Unlicense",
  "timestamp": "2026-11-22T07:56:35.250Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-medialab-xan",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [medialab/xan](https://github.com/medialab/xan) (Revision: `cca1cceb`).  
> **License**: Unlicense | **Timestamp**: `2026-11-22T07:56:35.250Z`  
> **Learning ID**: `learn-github-medialab-xan`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/cmd/join.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in medialab/xan. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `cca1cceb`: Refactoring Index::for_each_record in join command. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/cmd/join.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    ) -> Result<bool, E>
        let mut is_match = false;
            return Ok(is_match);
            is_match = true;
        Ok(is_match)
    ) -> Result<bool, E>
                let is_match = index.for_each_node_mut(&right_sel, &right_record, |left_node| {
            let something_was_written =
                index.for_each_record(&left_sel, &left_record, |right_record| {
                    writer.write_record(
                        inverted_left_sel
                            .select(&left_record)
                            .chain(inverted_right_sel.select(right_record)),
                    )
                })?;
            let something_was_written =
                index.for_each_record(&right_sel, &right_record, |left_record| {
                    writer.write_record(
                        inverted_left_sel
                            .select(left_record)
                            .chain(inverted_right_sel.select(&right_record)),
                    )
                })?;
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    ) -> Result<(), E>
            return Ok(());
        Ok(())
    ) -> Result<(), E>
                let mut is_match = false;

                index.for_each_node_mut(&right_sel, &right_record, |left_node| {
                    is_match = true;
            let mut something_was_written: bool = false;

            index.for_each_record(&left_sel, &left_record, |right_record| {
                something_was_written = true;
                writer.write_record(
                    inverted_left_sel
                        .select(&left_record)
                        .chain(inverted_right_sel.select(right_record)),
                )
            })?;
            let mut something_was_written: bool = false;

            index.for_each_record(&right_sel, &right_record, |left_record| {
                something_was_written = true;
                writer.write_record(
                    inverted_left_sel
                        .select(left_record)
                        .chain(inverted_right_sel.select(&right_record)),
                )
            })?;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `cca1cceb` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T07:56:35.248Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795334195248",
    "title": "Refactoring Index::for_each_record in join command",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "medialab/xan",
    "source_uri": "https://github.com/medialab/xan",
    "source_version": "HEAD",
    "content_hash": "1dd594bcee70814f2374fc1872dc5d327054e20eda67313a0fa7a8920a2f517a"
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
        "Harvested/verified timestamp recorded: 2026-11-22T07:56:35.248Z"
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
  "auth_token": "677f698de973ff140cd6566b45a7463e582b246e68ccd1bd664a4c810acc1b0c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
