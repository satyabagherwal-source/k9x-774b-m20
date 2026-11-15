# Candidate Directive: [CD-RCAT] Platform Quota Pre-emptive Accounting Rule

<!-- PROVENANCE_START
{
  "source_repository": "meshtastic/Meshtastic-Android",
  "source_url": "https://github.com/meshtastic/Meshtastic-Android",
  "source_version": "fd407372",
  "license": "GPL-3.0",
  "timestamp": "2026-11-15T09:26:37.061Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-meshtastic-meshtastic-android",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [meshtastic/Meshtastic-Android](https://github.com/meshtastic/Meshtastic-Android) (Revision: `fd407372`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-15T09:26:37.061Z`  
> **Learning ID**: `learn-github-meshtastic-meshtastic-android`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When interacting with OS-level hardware daemons that impose rolling rate-limits or quotas (e.g., Android `BluetoothLeScanner.startScan()`), client software **MUST** track and account for resource reservations in-memory prior to executing the platform system call. If the system call would breach the threshold, the client **MUST NOT** make the platform call and **MUST** fail immediately with a deterministic quota error specifying the backoff duration.

**WHY**:
Android's `BluetoothManager` enforces an undocumented rate-limit (e.g., a maximum of 5 BLE scan starts within a rolling 30-second window). If an application breaches this quota, the OS framework silences the callback without returning an error or advertisement results. The app remains indefinitely suspended in a `Scanning` state without an advertisement arriving or an exception being raised, inducing complete radio desynchronization.

**WHEN TO APPLY**:
Apply to all mobile, embedded, or desktop hardware driver interfaces where the underlying operating system enforces undocumented, silent-suppression rate ceilings (Bluetooth LE scans, Wi-Fi RTT scans, Camera open requests, GNSS batch requests).

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
package org.meshtastic.core.ble

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds
import kotlin.time.TimeMark
import kotlin.time.TimeSource

internal const val ANDROID_BLE_SCAN_START_LIMIT = 5
internal val ANDROID_BLE_SCAN_START_WINDOW: Duration = 30.seconds

class AndroidBleScanStartLimiter(
    private val timeSource: TimeSource = TimeSource.Monotonic,
    private val maxStarts: Int = ANDROID_BLE_SCAN_START_LIMIT,
    private val window: Duration = ANDROID_BLE_SCAN_START_WINDOW,
) : BleScanStartLimiter {
    private val mutex = Mutex()
    private val scanStarts = ArrayDeque<TimeMark>()

    init {
        require(maxStarts > 0) { "maxStarts must be positive" }
        require(window.isPositive()) { "window must be positive" }
    }

    override suspend fun reserveStart() {
        mutex.withLock {
            discardExpiredStarts()
            if (scanStarts.size >= maxStarts) {
                val oldest = scanStarts.first()
                val retryAfter = (window - oldest.elapsedNow()).coerceAtLeast(Duration.ZERO)
                throw BleScanStartException(
                    reason = BleScanStartFailureReason.ScanningTooFrequently,
                    cause = IllegalStateException("Android BLE scan-start quota exhausted"),
                    retryAfter = retryAfter,
                )
            }
            scanStarts.add(timeSource.markNow())
        }
    }

    private fun discardExpiredStarts() {
        while (scanStarts.firstOrNull()?.elapsedNow()?.let { it >= window } == true) {
            scanStarts.removeFirst()
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Blindly delegating scan requests directly to the Android Framework
suspend fun startScanUnsafe(scanner: BluetoothLeScanner, callback: ScanCallback) {
    // If called 6 times within 30 seconds, Android OS drops the scan silently.
    // The coroutine or subscriber hangs forever waiting for onScanResult().
    scanner.startScan(callback)
}
```

**VERIFICATION METHOD**:
Instantiate `AndroidBleScanStartLimiter` with a `TestTimeSource`. Fire `maxStarts` calls sequentially and assert success. Fire the `(maxStarts + 1)`-th call and assert that `BleScanStartException` is thrown with the exact delta time remaining on the oldest timestamp. Advance test time past `window` and assert scan permits can be acquired again.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T09:26:37.059Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794734797059",
    "title": "Platform Quota Pre-emptive Accounting Rule",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "meshtastic/Meshtastic-Android",
    "source_uri": "https://github.com/meshtastic/Meshtastic-Android",
    "source_version": "HEAD",
    "content_hash": "ac407e2a01d045b968daa7aa4d503a239aff2dc3a5fbad25459a58dfadf4194e"
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
        "Harvested/verified timestamp recorded: 2026-11-15T09:26:37.059Z"
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
  "auth_token": "bd001d9c6d581b0093d47f6a5427e6bbbd481244fdd2ca00041aa35290cf5665"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
