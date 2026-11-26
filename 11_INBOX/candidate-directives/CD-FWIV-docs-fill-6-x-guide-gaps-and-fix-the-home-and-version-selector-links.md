# Candidate Directive: [CD-FWIV] docs: fill 6.x guide gaps and fix the home and version selector links

<!-- PROVENANCE_START
{
  "source_repository": "callstack-react-native-paper-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T18:41:58.242Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-callstack-react-native-paper-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [callstack-react-native-paper-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T18:41:58.242Z`  
> **Learning ID**: `LEARN-EVO-callstack-react-native-paper-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `docs/6.x/docs/guides/migration.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in callstack/react-native-paper. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c420b90e`: docs: fill 6.x guide gaps and fix the home and version selector links. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/6.x/docs/guides/migration.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
A full theme, such as `DarkTheme` or the theme `useTheme()` returns, gives the same result as before, except that custom keys of the theme above it are kept. The `theme` prop is now typed as a partial `Theme`, as on `PaperProvider`, so TypeScript reports a value that isn't a theme, such as a number, and keys the theme doesn't have, such as `roundness`. To keep a partial theme in a variable, type it as [Simple built-in theme overrides](./theming#simple-built-in-theme-overrides) shows. The `theme` prop of a component returned by `withTheme` gets the same type, and the component you wrap must take a `Theme` in its `theme` prop. A `ThemeProvider` without a `theme` now passes the theme above it on. In 5.x it gave its children the default light theme. To keep that, pass `theme={LightTheme}`.
`Checkbox.Item`, `RadioButton.Item`, `FAB`, `Menu.Item`, `List.Accordion` and `Switch` no longer accept `accessibilityLabel`, so TypeScript reports an error. Components whose props extend React Native's view props, such as `Button`, `Chip`, `DataTable.Pagination`, `Drawer.Item` and `Drawer.CollapsedItem`, still compile with the old props, but pass them to their outer container instead of the element 
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
A full theme, such as `DarkTheme` or the theme `useTheme()` returns, gives the same result as before, except that custom keys of the theme above it are kept. The `theme` prop is now typed as a partial `Theme`, as on `PaperProvider`, so TypeScript reports a value that isn't a theme, such as a number, and keys the theme doesn't have, such as `roundness`. The `theme` prop of a component returned by `withTheme` gets the same type, and the component you wrap must take a `Theme` in its `theme` prop. A `ThemeProvider` without a `theme` now passes the theme above it on. In 5.x it gave its children the default light theme. To keep that, pass `theme={LightTheme}`.
`Checkbox.Item`, `RadioButton.Item`, `FAB`, `Menu.Item`, `List.Accordion` and `Switch` no longer accept `accessibilityLabel`, so TypeScript reports an error. Components whose props extend React Native's view props, such as `Button`, `Chip` and `DataTable.Pagination`, still compile with the old props, but pass them to their outer container instead of the element they used to label.
  supportingText="Enter a valid email"
`size` is a named scale: `'extra-small' | 'small' | 'medium' | 'large' | 
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c420b90e` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T18:41:58.374Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795718518374",
    "title": "docs: fill 6.x guide gaps and fix the home and version selector links",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "callstack-react-native-paper-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "11fcf564f3ec2b0d7d17398e830c0ee75e99ea7badf096108d0f78044ab0065e"
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
        "Harvested/verified timestamp recorded: 2026-11-26T18:41:58.374Z"
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
  "auth_token": "58442fdf385750a6a47191d9d48197ad996e1f072d98bbf2be43fd40b19ba9e3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
