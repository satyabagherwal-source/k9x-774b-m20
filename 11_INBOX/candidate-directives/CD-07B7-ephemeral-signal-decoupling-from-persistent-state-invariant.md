# Candidate Directive: [CD-07B7] Ephemeral Signal Decoupling from Persistent State Invariant

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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T08:09:31.650Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794730171650",
    "title": "Ephemeral Signal Decoupling from Persistent State Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "simonschubert-linuxcommandlibrary-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "c0af863be2773a84f19d8238a9d2cd1bfb142199aa68380ef4f1282477b508ae"
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
        "Harvested/verified timestamp recorded: 2026-11-15T08:09:31.650Z"
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
  "auth_token": "4bcba85421d9ae4af34b2de84c34671b1f1725fa80e8d48fe4e000db69938884"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
