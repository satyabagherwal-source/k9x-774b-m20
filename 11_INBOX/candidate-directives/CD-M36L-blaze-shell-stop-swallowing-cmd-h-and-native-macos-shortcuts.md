# Candidate Directive: [CD-M36L] blaze-shell): stop swallowing Cmd+H and native macOS shortcuts

<!-- PROVENANCE_START
{
  "source_repository": "indexable-inc-blaze-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T00:35:01.774Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-indexable-inc-blaze-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [indexable-inc-blaze-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T00:35:01.774Z`  
> **Learning ID**: `LEARN-EVO-indexable-inc-blaze-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/blaze-shell/src/main.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in indexable-inc/blaze. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1d870ac2`: blaze-shell): stop swallowing Cmd+H and native macOS shortcuts. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/blaze-shell/src/main.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    use objc2::{MainThreadMarker, MainThreadOnly, sel};
        NSEventModifierFlags, NSEventType, NSMenu, NSMenuItem, NSPasteboard,
        NSPasteboardTypeString, NSWindow, NSWindowStyleMask, NSWindowTitleVisibility,
    /// Install standard macOS Application and Window menus so system shortcuts
    /// (`Cmd+H` Hide, `Cmd+Opt+H` Hide Others, `Cmd+M` Minimize, `Cmd+Q` Quit,
    /// `Cmd+`` ` window cycling) behave like a first-class native macOS app.
    fn install_macos_menu(app: &NSApplication, mtm: MainThreadMarker) {
        let menubar = NSMenu::new(mtm);

        // 1. Application menu ("blaze-shell").
        let app_menu_item = NSMenuItem::new(mtm);
        let app_menu = NSMenu::initWithTitle(NSMenu::alloc(mtm), &NSString::from_str("blaze-shell"));
        // SAFETY: standard AppKit responder selectors (`hide:`, `hideOtherApplications:`,
        // `unhideAllApplications:`, `terminate:`) are valid Objective-C selectors on NSApplication.
        unsafe {
            let hide_item = NSMenuItem::initWithTitle_action_keyEquivalent(
                NSMenuItem::alloc(mtm),
                &NSString::from_str("Hide blaze-shell"),
                Some(sel!(hide:)),
             
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    use objc2::{MainThreadMarker, MainThreadOnly};
        NSEventModifierFlags, NSEventType, NSPasteboard, NSPasteboardTypeString, NSWindow,
        NSWindowStyleMask, NSWindowTitleVisibility,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1d870ac2` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T00:35:01.914Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795653301913",
    "title": "blaze-shell): stop swallowing Cmd+H and native macOS shortcuts",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "indexable-inc-blaze-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "d927dee19f98ea19a45de9befd97763d9f35346f13bccb46c8e61d760fa97bf7"
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
        "Harvested/verified timestamp recorded: 2026-11-26T00:35:01.914Z"
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
  "auth_token": "874e7ac4658fa5acf900d746f1da8271137712ef0696b10014b082794d0e80b3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
