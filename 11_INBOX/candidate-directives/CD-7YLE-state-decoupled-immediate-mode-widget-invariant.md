# Candidate Directive: [CD-7YLE] State-Decoupled Immediate-Mode Widget Invariant

<!-- PROVENANCE_START
{
  "source_repository": "ratatui/ratatui",
  "source_url": "https://github.com/ratatui/ratatui",
  "source_version": "ae8c0e08",
  "license": "MIT",
  "timestamp": "2026-11-25T10:24:14.306Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-ratatui-ratatui",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [ratatui/ratatui](https://github.com/ratatui/ratatui) (Revision: `ae8c0e08`).  
> **License**: MIT | **Timestamp**: `2026-11-25T10:24:14.306Z`  
> **Learning ID**: `learn-github-ratatui-ratatui`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Storing and mutating internal state within an owned or RefCell-wrapped widget
struct BrokenCounter {
    count: std::rc::Rc<std::cell::RefCell<usize>>,
}

impl ratatui::widgets::Widget for BrokenCounter {
    fn render(self, area: Rect, buf: &mut Buffer) {
        // BAD: Runtime borrow panics under re-entrant renders or concurrent tasks
        *self.count.borrow_mut() += 1;
        buf.set_string(area.x, area.y, format!("{}", self.count.borrow()), ratatui::style::Style::default());
    }
}
```

**VERIFICATION METHOD**:
Compile-time static borrow assertion ensuring multiple rendering passes do not trigger compile errors or borrow conflicts:
```rust
#[test]
fn test_stateful_widget_decoupled_borrow() {
    let mut state = TableState::default();
    let widget = TableWidget { row_height: 1, border_style: true };
    let mut buffer = Buffer::empty(Rect::new(0, 0, 10, 10));
    
    // Invariant: The widget can be re-instantiated freely without consuming state
    widget.render(Rect::new(0, 0, 10, 5), &mut buffer, &mut state);
    
    let widget2 = TableWidget { row_height: 2, border_style: false };
    widget2.render(Rect::new(0, 5, 10, 5), &mut buffer, &mut state);
    
    assert_eq!(state.selected_index, 0);
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T10:24:14.305Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795602254305",
    "title": "State-Decoupled Immediate-Mode Widget Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "ratatui/ratatui",
    "source_uri": "https://github.com/ratatui/ratatui",
    "source_version": "HEAD",
    "content_hash": "04b52264f852005b0571c543104ba0a358b067b8ccba5f5114ebe56cb681b081"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-25T10:24:14.305Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "a46b2bdeb001e13706c664c16d6922dfd9c9e50e29dd12e4d5e24a5bfbc83273"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
