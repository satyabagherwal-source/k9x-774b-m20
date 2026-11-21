# Candidate Directive: [CD-1F6A] incorrect cell size report

<!-- PROVENANCE_START
{
  "source_repository": "zenbu-labs/terminal-browser",
  "source_url": "https://github.com/zenbu-labs/terminal-browser",
  "source_version": "fa9e5eb0",
  "license": "MIT",
  "timestamp": "2026-11-21T00:24:36.370Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-zenbu-labs-terminal-browser",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zenbu-labs/terminal-browser](https://github.com/zenbu-labs/terminal-browser) (Revision: `fa9e5eb0`).  
> **License**: MIT | **Timestamp**: `2026-11-21T00:24:36.370Z`  
> **Learning ID**: `learn-github-zenbu-labs-terminal-browser`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `pixel/engine/crates/pixel-terminal/src/terminal.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zenbu-labs/terminal-browser. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b0935ef2`: incorrect cell size report. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `pixel/engine/crates/pixel-terminal/src/terminal.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:

    // its possible that the cell size and the reported window size are in different units (like iterm)
    pub fn contradicts_cell(&self, cell: (u32, u32)) -> bool {
        self.cell_size()
            .is_some_and(|(w, h)| w * 2 >= cell.0 * 3 && h * 2 >= cell.1 * 3)
    }
                        let Some(cell) = self.accept_cell_report(cell) else {
                            continue;
                        };
            self.cell = self
                .read_report(300, parse_cell_size_report)?
                .and_then(|cell| self.accept_cell_report(cell));
    fn accept_cell_report(&self, cell: (u32, u32)) -> Option<(u32, u32)> {
        let ws = self.size().ok()?;
        if ws.contradicts_cell(cell) {
            pixel_core::logging::warn(
                "terminal",
                format!("ignoring reported cell {cell:?}, the window's pixels imply {:?}", ws.cell_size()),
            );
            return None;
        }
        Some(cell)
    }

    #[test]
    fn a_cell_reported_in_points_contradicts_a_window_in_device_pixels() {
        let ws = WindowSize {
            cols: 100,
            rows: 40,
            width_px: 1640,
            height_px: 1360,
       
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
            self.cell = self.read_report(300, parse_cell_size_report)?;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b0935ef2` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T00:24:36.368Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795220676368",
    "title": "incorrect cell size report",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "zenbu-labs/terminal-browser",
    "source_uri": "https://github.com/zenbu-labs/terminal-browser",
    "source_version": "HEAD",
    "content_hash": "2c6bdb0a22c7c7e843d1c34963dbedce6f159e59f2ebe45b3dc1cd7985029bde"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-21T00:24:36.368Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "2c03d01e5660b89b3cf0a154e09464e5b4d8f65ad0a4bcd7a81c420208ff7fd5"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
