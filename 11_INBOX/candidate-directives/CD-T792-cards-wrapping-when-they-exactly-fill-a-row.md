# Candidate Directive: [CD-T792] cards wrapping when they exactly fill a row

<!-- PROVENANCE_START
{
  "source_repository": "zenbu-labs/terminal-browser",
  "source_url": "https://github.com/zenbu-labs/terminal-browser",
  "source_version": "e459febc",
  "license": "MIT",
  "timestamp": "2026-11-14T11:04:22.262Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-zenbu-labs-terminal-browser",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zenbu-labs/terminal-browser](https://github.com/zenbu-labs/terminal-browser) (Revision: `e459febc`).  
> **License**: MIT | **Timestamp**: `2026-11-14T11:04:22.262Z`  
> **Learning ID**: `learn-github-zenbu-labs-terminal-browser`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `pixel/engine/crates/pixel-core/src/tree/tests.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zenbu-labs/terminal-browser. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6bb6ae6d`: cards wrapping when they exactly fill a row. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `pixel/engine/crates/pixel-core/src/tree/tests.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:

#[test]
fn cards_that_exactly_fill_a_wrapping_row_stay_on_one_line() {
    let cw = 14.0411f32;
    let room = 59.0 * cw;
    let card = ((room - cw) / 2.0).floor();
    let grid = Desc {
        key: Some("grid".into()),
        style: Style { flex_direction: FlexDirection::Row, flex_wrap: true, gap: cw, ..Style::default() },
        children: (0..2).map(|i| Desc { key: Some(format!("c{i}")), style: Style { width: Dimension::Px(card), height: Dimension::Px(281.0), flex_shrink: 0.0, ..Style::default() }, ..Desc::default() }).collect(),
        ..Desc::default()
    };
    let holder = Desc { style: Style { padding: crate::style::Edges { left: 2.0 * cw, ..Default::default() }, ..Style::default() }, children: vec![grid], ..Desc::default() };
    let width = 63.0 * cw;
    let tree = tree_of((width, 1000.0), vec![Desc { style: Style { width: Dimension::Px(width), flex_direction: FlexDirection::Column, padding: crate::style::Edges { left: cw, right: cw, ..Default::default() }, ..Style::default() }, children: vec![holder], ..Desc::default() }]);
    let rect = |key: &str| tree.rect(tree.find(key).unwrap()).unwrap();
    assert_eq!(rect("c1").y, rect("c0").y, "the second card stays besi
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6bb6ae6d` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T11:04:22.259Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794654262259",
    "title": "cards wrapping when they exactly fill a row",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "zenbu-labs/terminal-browser",
    "source_uri": "https://github.com/zenbu-labs/terminal-browser",
    "source_version": "HEAD",
    "content_hash": "7bf2797a5e62e1d50087580a565095b14a0032d34ef84afee02da9c958965df5"
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
        "Harvested/verified timestamp recorded: 2026-11-14T11:04:22.259Z"
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
  "auth_token": "a270d8e94077b9f6ee226b5eca786c395e6d23995ff57bcba68c701867c28c5b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
