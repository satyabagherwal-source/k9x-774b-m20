# Candidate Directive: [CD-03BP] Adaptive Multi-Pane Navigation Stack Invariant

<!-- PROVENANCE_START
{
  "source_repository": "SimonSchubert/LinuxCommandLibrary",
  "source_url": "https://github.com/SimonSchubert/LinuxCommandLibrary",
  "source_version": "6641ebf0",
  "license": "Apache-2.0",
  "timestamp": "2026-11-15T08:09:26.485Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-simonschubert-linuxcommandlibrary",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [SimonSchubert/LinuxCommandLibrary](https://github.com/SimonSchubert/LinuxCommandLibrary) (Revision: `6641ebf0`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-15T08:09:26.485Z`  
> **Learning ID**: `learn-github-simonschubert-linuxcommandlibrary`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T08:09:26.482Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794730166482",
    "title": "Adaptive Multi-Pane Navigation Stack Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "SimonSchubert/LinuxCommandLibrary",
    "source_uri": "https://github.com/SimonSchubert/LinuxCommandLibrary",
    "source_version": "HEAD",
    "content_hash": "fd3ef733ab12edd40cfd177bf0ba20c48e7f087d3bc798a18596a6f7e47dcf1c"
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
        "Harvested/verified timestamp recorded: 2026-11-15T08:09:26.482Z"
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
  "auth_token": "f5c9a1da75ceb47ba21e75086b0656f35ca6219bfa198d0a24104c9390bbc053"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
