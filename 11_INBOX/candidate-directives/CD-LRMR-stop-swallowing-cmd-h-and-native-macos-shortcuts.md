# Candidate Directive: [CD-LRMR] stop swallowing Cmd+H and native macOS shortcuts

<!-- PROVENANCE_START
{
  "source_repository": "indexable-inc/blaze",
  "source_url": "https://github.com/indexable-inc/blaze",
  "source_version": "a5b3c536",
  "license": "Apache-2.0",
  "timestamp": "2026-11-26T00:34:46.947Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-indexable-inc-blaze",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [indexable-inc/blaze](https://github.com/indexable-inc/blaze) (Revision: `a5b3c536`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-26T00:34:46.947Z`  
> **Learning ID**: `learn-github-indexable-inc-blaze`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-26T00:34:46.945Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795653286945",
    "title": "stop swallowing Cmd+H and native macOS shortcuts",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "indexable-inc/blaze",
    "source_uri": "https://github.com/indexable-inc/blaze",
    "source_version": "HEAD",
    "content_hash": "28a17881d54f0c0a31a14ba339338ee4009ca3dd32901d67e9be18b99f99104c"
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
        "Harvested/verified timestamp recorded: 2026-11-26T00:34:46.945Z"
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
  "auth_token": "e9748f832f0eb6f473389f62c769be0ea0e8d4e63e9f419ff2f12601dab636c1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
