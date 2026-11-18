# Candidate Directive: [CD-AR4L] Asymmetric Window Visibility Minimum Hold Durations for Flapping UI Indicators

<!-- PROVENANCE_START
{
  "source_repository": "crosspaste-crosspaste-desktop-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T08:08:44.660Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-crosspaste-crosspaste-desktop-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [crosspaste-crosspaste-desktop-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T08:08:44.660Z`  
> **Learning ID**: `LEARN-EVO-crosspaste-crosspaste-desktop-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
UI status indicators derived from volatile, transient states (such as fast-failing network connection probes or sub-100ms IPC handshakes) MUST enforce an asymmetric minimum visible duration (`hold duration >= 1.0s`) using monotonic time elapsed calculations prior to reverting to idle or disconnected states.

**WHY**:
Network reconnect attempts against unreachable local-area peers or closed sockets fail within milliseconds (e.g., immediate TCP `RST` or `ECONNREFUSED` in 2–5ms). If the UI binds raw connection state directly to layout trees, the indicator will flicker instantaneously. This causes UI frame thrashing, accessibility screen-reader spam, and visual artifacts where users perceive a glitch rather than a failed connection attempt.

**WHEN TO APPLY**:
Apply to all reactive desktop/mobile UI components that display loading spinners, "Connecting..." state badges, and synchronization icons bound to coroutine network flows.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified Pattern: Monotonic Elapsed Hold Invariant for Asynchronous Status
@Composable
fun DeviceScope.rememberConnectingIndicator(
    minVisibleDuration: Duration = 1.seconds
): ConnectingIndicator {
    var refreshing by remember { mutableStateOf(false) }
    val isConnecting = refreshing || syncRuntimeInfo.connectState == SyncState.CONNECTING
    var visible by remember { mutableStateOf(isConnecting) }
    var sinceEpochMs by remember { mutableStateOf(0L) }

    LaunchedEffect(isConnecting) {
        if (isConnecting) {
            sinceEpochMs = DateUtils.nowEpochMilliseconds()
            visible = true
        } else if (visible) {
            val elapsed = (DateUtils.nowEpochMilliseconds() - sinceEpochMs).milliseconds
            val remaining = minVisibleDuration - elapsed
            if (remaining.isPositive()) {
                delay(remaining) // Enforce minimum visual threshold
            }
            visible = false
        }
    }

    return ConnectingIndicator(visible) { refreshing = it }
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Direct binding of transient network state causing visual flickering
@Composable
fun BuggyDeviceTag(syncState: SyncState) {
    // If syncState flips CONNECTING -> DISCONNECTED in 3ms, UI flickers violently
    val isConnecting = syncState == SyncState.CONNECTING
    if (isConnecting) {
        CircularProgressIndicator()
        Text("Connecting...")

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T08:08:44.756Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794989324756",
    "title": "Asymmetric Window Visibility Minimum Hold Durations for Flapping UI Indicators",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "crosspaste-crosspaste-desktop-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "9afcb6f8014a7fbd65e1d6c863dadf9da39ac0f508bcace94ff6d8c6722aa4da"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-18T08:08:44.756Z"
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
  "auth_token": "95fb4aeda5693b60af4933ae3118f91b6010f6a57cc78d2ff020080b6ed2c680"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
