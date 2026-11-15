# Candidate Directive: [CD-07B6] Adaptive Multi-Pane Navigation Stack Invariant

<!-- PROVENANCE_START
{
  "source_repository": "simonschubert-linuxcommandlibrary-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T08:09:31.553Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-simonschubert-linuxcommandlibrary-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [simonschubert-linuxcommandlibrary-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T08:09:31.553Z`  
> **Learning ID**: `LEARN-EVO-simonschubert-linuxcommandlibrary-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing hierarchical deep-dive navigation inside an adaptive split-pane layout (such as Material 3 `ListDetailPaneScaffoldNavigator`), the back-navigation behavior MUST be configured to `BackNavigationBehavior.PopUntilContentChange`. Systems MUST NOT rely on default scaffold-value popping (`PopUntilScaffoldValueChange`) when successive views occupy the same pane role.

**WHY**:
The default `PopUntilScaffoldValueChange` compares the pane scaffold's structural layout state (e.g., `List` vs `Detail`). When a user deep-links or traverses sequentially through related entities in the detail pane (e.g., from command `ls` to `rm` via inline links), both entries have the identical pane scaffold value (`Role.Detail`). When the back action fires under default behavior, the navigator collapses the entire detail pane back to the list in a single step, dropping the intermediate historical stack. `PopUntilContentChange` evaluates content identity rather than layout structure, ensuring linear back-stack integrity.

**WHEN TO APPLY**:
Apply to any Compose Multiplatform, Jetpack Compose, or declarative dual-pane navigation architecture where detail-to-detail cross-linking occurs within an adaptive scaffold.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// composeApp/src/commonMain/kotlin/com/linuxcommandlibrary/app/nav/LinuxNavState.kt
import androidx.compose.material3.adaptive.navigation.BackNavigationBehavior
import androidx.compose.material3.adaptive.navigation.ThreePaneScaffoldNavigator

// Explicitly define pop strategy at module level to prevent scaffold collapsing
private val backBehavior = BackNavigationBehavior.PopUntilContentChange

internal class LinuxNavState(
    private val navigator: ThreePaneScaffoldNavigator<String>,
    private val scope: CoroutineScope,
    private val searchState: SearchState,
) {
    fun onBack() {
        if (navigator.canNavigateBack(backBehavior)) {
            scope.launch {
                // Must pass explicit content-change behavior on every pop invocation
                navigator.navigateBack(backBehavior)
                if (searchState.searchText.isNotEmpty()) {
                    searchState.requestFocus()
                }
            }
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Default scaffold behavior drops deep-linked detail history
fun onBackDefaultFailure(navigator: ThreePaneScaffoldNavigator<String>) {
    // Calling parameterless navigateBack() defaults to PopUntilScaffoldValueChange
    // DETAIL("cat") -> DETAIL("grep") -> Back => Returns straight to LIST, dropping "cat"
    navigator.navigateBack() 
}
```

**VERIFICATION METHOD**:
Execute an automated UI back-stack simulation test verifying that moving `Detail(A) -> Detail(B)` requires exactly two back invocations to reach `List`.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T08:09:31.649Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794730171649",
    "title": "Adaptive Multi-Pane Navigation Stack Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "simonschubert-linuxcommandlibrary-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "1267fb7df18b0ff2c912f826193b7c7c8c3a12f0cf5ad772d497e73000b93498"
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
        "Harvested/verified timestamp recorded: 2026-11-15T08:09:31.649Z"
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
  "auth_token": "4bfc6ba66b142ad9b8943c76d2e6fd6efe24f9e613fc599b92fb1f498cb84aef"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
