# Candidate Directive: [CD-FLT9] fill 6.x guide gaps and fix the home and version selector links

<!-- PROVENANCE_START
{
  "source_repository": "callstack/react-native-paper",
  "source_url": "https://github.com/callstack/react-native-paper",
  "source_version": "63a3d5ac",
  "license": "MIT",
  "timestamp": "2026-11-26T18:41:44.493Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-callstack-react-native-paper",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [callstack/react-native-paper](https://github.com/callstack/react-native-paper) (Revision: `63a3d5ac`).  
> **License**: MIT | **Timestamp**: `2026-11-26T18:41:44.493Z`  
> **Learning ID**: `learn-github-callstack-react-native-paper`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-26T18:41:44.491Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795718504491",
    "title": "fill 6.x guide gaps and fix the home and version selector links",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "callstack/react-native-paper",
    "source_uri": "https://github.com/callstack/react-native-paper",
    "source_version": "HEAD",
    "content_hash": "dbc097d2ca5a65e6cc2f650a461486a6c9602d1c12f5f082691bed599874e7dd"
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
        "Harvested/verified timestamp recorded: 2026-11-26T18:41:44.491Z"
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
  "auth_token": "603a2d5dc53d49d41aa0aec96c9173d4e765a13951ba83e3ff6268af8651d63b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
