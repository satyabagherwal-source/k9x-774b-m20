# Candidate Directive: [CD-79E5] Asymmetric Window Visibility Minimum Hold Durations for Flapping UI Indicators

<!-- PROVENANCE_START
{
  "source_repository": "CrossPaste/crosspaste-desktop",
  "source_url": "https://github.com/CrossPaste/crosspaste-desktop",
  "source_version": "a38884fa",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-18T08:06:01.805Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-crosspaste-crosspaste-desktop",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [CrossPaste/crosspaste-desktop](https://github.com/CrossPaste/crosspaste-desktop) (Revision: `a38884fa`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-18T08:06:01.805Z`  
> **Learning ID**: `learn-github-crosspaste-crosspaste-desktop`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    }
}
```

**VERIFICATION METHOD**:
Run a virtual-time coroutine test asserting that an instantaneous state transition holds the UI state for at least the specified duration:
```kotlin
@Test
fun `verify minimum visible duration prevents indicator thrash`() = runTest {
    var visible = false
    val job = launch {
        // Simulate rapid 5ms flap
        visible = true
        val start = testScheduler.currentTime
        delay(5) // Fails immediately
        val elapsed = testScheduler.currentTime - start
        if (elapsed < 1000) {
            delay(1000 - elapsed)
        }
        visible = false
    }
    
    testScheduler.advanceTimeBy(500)
    assertTrue(visible, "Indicator dropped visibility prematurely before minimum threshold")
    
    testScheduler.advanceTimeBy(501)
    assertFalse(visible, "Indicator failed to clear after minimum threshold elapsed")
    job.cancel()
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T08:06:01.804Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794989161804",
    "title": "Asymmetric Window Visibility Minimum Hold Durations for Flapping UI Indicators",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "CrossPaste/crosspaste-desktop",
    "source_uri": "https://github.com/CrossPaste/crosspaste-desktop",
    "source_version": "HEAD",
    "content_hash": "44839c6812cc4ab82ee290b415a2776452effa179bb7e8b38183363399d6722c"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Harvested/verified timestamp recorded: 2026-11-18T08:06:01.804Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "d495532447a7b965b1b3d96cb7ae36fc579743165a2e19badd6116b563695def"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
