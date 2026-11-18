# Candidate Directive: [CD-TV84] Viewport-Driven Mutation Coalescing Rule

<!-- PROVENANCE_START
{
  "source_repository": "msasikanth/twine",
  "source_url": "https://github.com/msasikanth/twine",
  "source_version": "a741d94b",
  "license": "GPL-3.0",
  "timestamp": "2026-11-18T08:51:36.148Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-msasikanth-twine",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [msasikanth/twine](https://github.com/msasikanth/twine) (Revision: `a741d94b`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-18T08:51:36.148Z`  
> **Learning ID**: `learn-github-msasikanth-twine`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
High-frequency layout or scroll events MUST NOT trigger immediate disk or network mutations. Any event-driven state mutation originating from user gestures (such as scrolling past an item to mark it read) MUST pass through an in-memory thread-safe buffer that debounces and flushes mutations in batches. The buffer MUST expose synchronous and asynchronous flushes that are guaranteed to execute before lifecycle teardown, screen transition, or manual content refresh.

**WHY**:
Triggering transactional database writes or network calls directly from scroll listeners (e.g., in a LazyColumn or RecyclerView) produces severe main-thread stutter (jank), database connection pool contention, and time-of-check to time-of-use (TOCTOU) race conditions. If the user flings a list past 50 items, uncoalesced architecture fires 50 discrete SQLite update queries, locking the database and causing dropped frames.

**WHEN TO APPLY**:
Apply to any list, feed, or viewport listener where element traversal implicitly mutates state (marking items read, logging impression analytics, pre-fetching deep assets).

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
package dev.sasikanth.rss.reader.home

import kotlin.time.Duration
import kotlin.time.Duration.Companion.milliseconds
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class ScrollReadPostsBuffer(
  private val scope: CoroutineScope,
  private val flushInterval: Duration = 300.milliseconds,
  private val markAsReadOnProvider: suspend () -> MarkAsReadOn,
  private val markPostsAsRead: suspend (Set<String>) -> Unit,
) {
  private val mutex = Mutex()
  private val bufferedPostIds = mutableSetOf<String>()
  private var debounceJob: Job? = null
  private var previousVisibleItems: Map<String, Int> = emptyMap()

  fun onVisiblePostsChanged(visiblePosts: Map<String, Int>, firstVisibleItemIndex: Int) {
    val newlyHiddenIds = previousVisibleItems.keys - visiblePosts.keys
    if (newlyHiddenIds.isNotEmpty()) {
      val itemsHiddenFromTop = newlyHiddenIds.filter { id ->
        val previousIndex = previousVisibleItems[id]
        previousIndex != null && previousIndex < firstVisibleItemIndex
      }.toSet()

      if (itemsHiddenFromTop.isNotEmpty()) {
        enqueue(itemsHiddenFromTop)
      }
    }
    previousVisibleItems = visiblePosts
  }

  fun enqueue(postIds: Set<String>) {
    scope.launch {
      mutex.withLock {
        bufferedPostIds.addAll(postIds)
        scheduleFlushLocked()
      }
    }
  }

  private fun scheduleFlushLocked() {
    debounceJob?.cancel()
    debounceJob = scope.launch {
      delay(flushInterval)
      flush()
    }
  }

  suspend fun flush() {
    val idsToMark: Set<String>
    mutex.withLock {
      debounceJob?.cancel()
      debounceJob = null
      if (bufferedPostIds.isEmpty()) return
      idsToMark = bufferedPostIds.toSet()
      bufferedPostIds.clear()
    }

    if (markAsReadOnProvider() == MarkAsReadOn.Scroll) {
      markPostsAsRead(idsToMark)
    }
  }

  fun flushAsync() {
    scope.launch { flush() }
  }
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Direct, un-debounced dispatch from viewport callback
private fun onVisiblePostsChanged(visiblePosts: Map<String, Int>, firstVisibleItemIndex: Int) {
  val newlyHiddenIds = previousVisibleItems.keys - visiblePosts.keys
  newlyHiddenIds.forEach { id ->
    // Triggers N individual coroutines and N individual database write transactions per scroll delta
    viewModelScope.launch {
      rssRepository.updatePostReadStatus(read = true, id = id)
    }
  }
  previousVisibleItems = visiblePosts
}
```

**VERIFICATION METHOD**:
1. Unit test validating that 100 consecutive enqueue calls within `flushInterval` trigger `markPostsAsRead` exactly once with all 100 IDs combined.
2. Stress test verifying that calling `flush()` immediately clears `bufferedPostIds` under concurrent `enqueue` invocations without dropped IDs.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T08:51:36.146Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794991896146",
    "title": "Viewport-Driven Mutation Coalescing Rule",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "msasikanth/twine",
    "source_uri": "https://github.com/msasikanth/twine",
    "source_version": "HEAD",
    "content_hash": "93c50f784e2f069ccac94cefae90721ba9c0a4ae3f28a6905503d954b1a96ce1"
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
        "Harvested/verified timestamp recorded: 2026-11-18T08:51:36.146Z"
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
  "auth_token": "05f97e3ec62e80995377b980f284a2f82a64dcf8540e2d3261405780e5c68b38"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
