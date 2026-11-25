# Candidate Directive: [CD-AJGS] State-Decoupled Immediate-Mode Widget Invariant

<!-- PROVENANCE_START
{
  "source_repository": "ratatui-ratatui-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-25T10:26:14.507Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-ratatui-ratatui-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [ratatui-ratatui-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-25T10:26:14.507Z`  
> **Learning ID**: `LEARN-EVO-ratatui-ratatui-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
Reusable UI components MUST NOT encapsulate internal mutable state inside an owned widget struct when implementing rendering pipelines. Components requiring state mutation across frames MUST implement the `StatefulWidget` contract separating the ephemeral widget descriptor (`self`) from the long-lived mutable state reference (`&mut State`).

**WHY**:
Binding mutable state directly to an owned widget (`Widget for &mut CustomWidget`) forces the entire component tree to retain exclusive mutable borrows during draw routines. This prevents clean hierarchical tree composition, violates the Single Responsibility Principle, and causes borrow-checker conflicts when parent widgets coordinate state between siblings.

**WHEN TO APPLY**:
Apply to all interactive TUI, GUI, or canvas components (e.g., scrollable lists, paginated tables, tree views, multi-input forms) where render loops must reflect external state without invalidating parent frame lifecycles.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use ratatui::buffer::Buffer;
use ratatui::layout::Rect;
use ratatui::widgets::StatefulWidget;

pub struct TableWidget {
    pub row_height: u16,
    pub border_style: bool,
}

#[derive(Default, Debug)]
pub struct TableState {
    pub selected_index: usize,
    pub offset_y: usize,
}

impl StatefulWidget for TableWidget {
    type State = TableState;

    fn render(self, area: Rect, buf: &mut Buffer, state: &mut Self::State) {
        if area.width == 0 || area.height == 0 {
            return;
        }

        // State normalization: protect against out-of-bounds mutation
        let total_items = 100; // Invariant check against backing data length
        if state.selected_index >= total_items {
            state.selected_index = total_items.saturating_sub(1);
        }

        // Render purely according to resolved state
        for y in 0..area.height {
            let row_idx = state.offset_y + y as usize;
            if row_idx >= total_items {
                break;
            }
            let is_selected = row_idx == state.selected_index;
            let symbol = if is_selected { ">" } else { " " };
            buf.set_string(area.x, area.y + y, symbol, ratatui::style::Style::default());

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T10:26:14.667Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795602374667",
    "title": "State-Decoupled Immediate-Mode Widget Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "ratatui-ratatui-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "2c6a6da19ab0c2978612c09371326ce132982578fc3a955d114149008696575a"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-25T10:26:14.667Z"
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
  "auth_token": "1ffe17177430803d8d4f4e811196adbd3c36e77917e0ee46a7d205ec86c2aaff"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
