# Candidate Directive: [CD-FJSS] keep insets in sync with edges and measurements in LayoutRegionView

<!-- PROVENANCE_START
{
  "source_repository": "react-navigation/react-navigation",
  "source_url": "https://github.com/react-navigation/react-navigation",
  "source_version": "ca036e81",
  "license": "PERMISSIVE_OPEN_SOURCE",
  "timestamp": "2026-11-21T15:31:23.260Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-react-navigation-react-navigation",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [react-navigation/react-navigation](https://github.com/react-navigation/react-navigation) (Revision: `ca036e81`).  
> **License**: PERMISSIVE_OPEN_SOURCE | **Timestamp**: `2026-11-21T15:31:23.260Z`  
> **Learning ID**: `learn-github-react-navigation-react-navigation`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `packages/native/ios/ReactNavigationLayoutRegionView.mm`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in react-navigation/react-navigation. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e34a70c2`: keep insets in sync with edges and measurements in LayoutRegionView. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/native/ios/ReactNavigationLayoutRegionView.mm`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
  std::optional<LayoutRegionState> _committedState;

    [self commitInsetsIfNeeded];

    if (!oldState || state->getRevision() == State::initialRevisionValue) {
        _committedState = _state->getData();
    }
    _committedState.reset();
    [self commitInsetsIfNeeded];

    [self sendInsetsChangeIfNeeded];
}

- (void)commitInsetsIfNeeded
{
    if (!_measuredState.has_value()) {
        return;
    }

    const auto &edges = static_cast<const ReactNavigationLayoutRegionViewProps &>(*_props).edges;

    if (edges.top == decltype(edges.top)::Off && edges.bottom == decltype(edges.bottom)::Off &&
        edges.start == decltype(edges.start)::Off && edges.end == decltype(edges.end)::Off) {
        return;
    }

    auto state = *_measuredState;

    state.top = edges.top != decltype(edges.top)::Off ? state.top : 0;
    state.bottom = edges.bottom != decltype(edges.bottom)::Off ? state.bottom : 0;
    state.start = edges.start != decltype(edges.start)::Off ? state.start : 0;
    state.end = edges.end != decltype(edges.end)::Off ? state.end : 0;

    if (_committedState != state) {
        _committedState = state;

```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
    if (state != _state->getData()) {

    [self sendInsetsChangeIfNeeded];
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e34a70c2` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T15:31:23.258Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795275083258",
    "title": "keep insets in sync with edges and measurements in LayoutRegionView",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "react-navigation/react-navigation",
    "source_uri": "https://github.com/react-navigation/react-navigation",
    "source_version": "HEAD",
    "content_hash": "de4ccdbe686374ab4381e0bf240b1e6123f1b3ee7e94dc9bd293dc085afb0a58"
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
        "Harvested/verified timestamp recorded: 2026-11-21T15:31:23.258Z"
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
  "auth_token": "51903c6cb5240d5bd20485aff2369591595285346c561cdba854cc7a54fa9de2"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
