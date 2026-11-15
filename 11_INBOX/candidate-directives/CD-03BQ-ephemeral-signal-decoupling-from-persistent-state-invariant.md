# Candidate Directive: [CD-03BQ] Ephemeral Signal Decoupling from Persistent State Invariant

<!-- PROVENANCE_START
{
  "source_repository": "SimonSchubert/LinuxCommandLibrary",
  "source_url": "https://github.com/SimonSchubert/LinuxCommandLibrary",
  "source_version": "6641ebf0",
  "license": "Apache-2.0",
  "timestamp": "2026-11-15T08:09:26.486Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-simonschubert-linuxcommandlibrary",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [SimonSchubert/LinuxCommandLibrary](https://github.com/SimonSchubert/LinuxCommandLibrary) (Revision: `6641ebf0`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-15T08:09:26.486Z`  
> **Learning ID**: `learn-github-simonschubert-linuxcommandlibrary`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
Transient UI trigger signals (such as focus acquisition requests, one-time animations, or toast events) MUST NOT be modeled as persistent or saveable boolean states. They MUST be modeled as monotonically increasing epoch counters (`Int`) using purely volatile memory (`remember { mutableIntStateOf(0) }`), completely separated from process-death persistence (`rememberSaveable`).

**WHY**:
Storing a focus request or single-shot event in `rememberSaveable` causes a "zombie trigger" bug: upon process recreation or configuration change, the saved `true` flag is re-read by composition observers, triggering unintended keyboard popups, scroll resets, or focus captures when the user expected cold UI defaults. Decoupling the epoch counter guarantees that process revival restores the data payload (`TextFieldValue`) without firing the transient behavioral effect.

**WHEN TO APPLY**:
Any declarative UI architecture (Compose, React, SwiftUI) managing text inputs, search overlays, modal dismiss triggers, or programmatic focus management across process recreation and navigation transitions.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// composeApp/src/commonMain/kotlin/com/linuxcommandlibrary/app/ui/composables/SearchState.kt
class SearchState(
    private val textFieldValue: MutableState<TextFieldValue>,
    private val isVisibleState: MutableState<Boolean>,
    private val focusEpochState: MutableState<Int>,
) {
    val searchText: String get() = textFieldValue.value.text
    val focusEpoch: Int get() = focusEpochState.value

    fun requestFocus() {
        // Monotonic increment guarantees observer recomposition without latching
        focusEpochState.value += 1
    }
}

@Composable
fun rememberSearchState(initialText: String = ""): SearchState {
    // Payload and visibility survive process death
    val textFieldValue = rememberSaveable(stateSaver = TextFieldValue.Saver) {
        mutableStateOf(TextFieldValue(text = initialText, selection = TextRange(initialText.length)))
    }
    val isVisible = rememberSaveable { mutableStateOf(initialText.isNotEmpty()) }

    // Transient trigger signal strictly remembered in-memory only; resets to 0 on recreation
    val focusEpoch = remember { mutableIntStateOf(0) }
    
    return remember { SearchState(textFieldValue, isVisible, focusEpoch) }
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Storing transient boolean trigger in rememberSaveable
@Composable
fun rememberBrokenSearchState(): MutableState<Boolean> {
    // BUG: Upon process restoration or back navigation, shouldFocus persists as true,
    // violently popping up the soft keyboard over search results
    val shouldFocus = rememberSaveable { mutableStateOf(false) }
    return shouldFocus
}
```

**VERIFICATION METHOD**:
Simulate activity kill/restore via Android `SavedStateRegistryController` or Jetpack Compose `StateRestorationTester`. Assert that after restoration, `searchState.focusEpoch == 0` while `searchState.searchText` retains its serialized string value.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T08:09:26.485Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794730166485",
    "title": "Ephemeral Signal Decoupling from Persistent State Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "SimonSchubert/LinuxCommandLibrary",
    "source_uri": "https://github.com/SimonSchubert/LinuxCommandLibrary",
    "source_version": "HEAD",
    "content_hash": "933ffd68f6ab6e99c7034e2899f02cf099dc1ee783f47f6af07da2e49c45567d"
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
        "Harvested/verified timestamp recorded: 2026-11-15T08:09:26.485Z"
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
  "auth_token": "bfd69c14847bd380c4ff17c40aaed146337604806b324520ce9140df4596e08a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
