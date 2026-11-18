# Candidate Directive: [CD-79E1] Inversion of Lock Acquisition via Lazy Evaluation in Component Graphs

<!-- PROVENANCE_START
{
  "source_repository": "CrossPaste/crosspaste-desktop",
  "source_url": "https://github.com/CrossPaste/crosspaste-desktop",
  "source_version": "a38884fa",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-18T08:06:01.801Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-crosspaste-crosspaste-desktop",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [CrossPaste/crosspaste-desktop](https://github.com/CrossPaste/crosspaste-desktop) (Revision: `a38884fa`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-18T08:06:01.801Z`  
> **Learning ID**: `learn-github-crosspaste-crosspaste-desktop`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
Components in a dependency-injected system that perform synchronous file I/O, IPC locks, or database lock acquisitions during initialization MUST accept lock dependencies wrapped in deferred proxies (`Lazy<T>` or provider lambdas `() -> T`). Subsystem constructors MUST NOT invoke `.value` on locks or IO-bound handles during dependency graph construction.

**WHY**:
Injecting realized lock-bound singletons forces dependency injection frameworks (e.g., Koin, Dagger) to resolve IO locks synchronously on whatever thread creates the component graph. On mobile and desktop environments, DI root compilation frequently executes on the UI/Main dispatcher. Acquiring a file-system lock or database handle during DI construction causes Application Not Responding (ANR) watchdog aborts, UI micro-stutters (jank > 16.6ms), or deadlocks if another process holds the shared lock.

**WHEN TO APPLY**:
Apply in any multi-platform desktop/mobile framework where services are declared as singletons in DI modules but access disk-backed mutexes, OS lock files (`.lock`), or SQLite WAL master locks.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified Pattern: Deferring realization of disk-locked state to background coroutine
abstract class GuidePasteDataService(
    private val appInfo: AppInfo,
    private val appLaunchState: Lazy<AppLaunchState>, // Lazy wrapper prevents eager disk IO
    private val pasteDao: PasteDao,
) {
    // Pure accessor, defers resolution until called
    fun isFirstLaunch(): Boolean = appLaunchState.value.firstLaunch

    suspend fun initData() = withContext(Dispatchers.IO) {
        // AppLaunchState resolved here on IO dispatcher, reading lock file safely
        if (appLaunchState.value.firstLaunch) {
            if (pasteDao.getSize(activeOnly = true) == 0L) {
                seedInitialData()
            }
        }
    }
    
    protected abstract suspend fun seedInitialData()
}

// DI Module definition using deferred evaluation
val pasteModule = module {
    single<GuidePasteDataService> {
        DesktopGuidePasteDataService(
            appInfo = get(),
            appLaunchState = lazy { get<AppLaunchState>() }, // Evaluation decoupled from module load
            pasteDao = get()
        )
    }
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Eagerly passing locked state forces immediate file IO on the caller's thread
class BuggyGuidePasteDataService(
    private val appInfo: AppInfo,
    private val appLaunchState: AppLaunchState, // Eager! get() resolves lock synchronously in DI
    private val pasteDao: PasteDao,
) {
    // If constructed on Main Thread, this constructor triggers file locks and risks an ANR
    init {
        if (appLaunchState.firstLaunch) {
            // Unsafe initialization leak
        }
    }
}
```

**VERIFICATION METHOD**:
Verify using a unit test asserting that constructing the service does not trigger lazy evaluation:
```kotlin
@Test
fun `verify constructing service does not trigger file IO lock`() {
    var lockResolved = false
    val deferredLock = lazy {
        lockResolved = true
        MockAppLaunchState(acquiredLock = true, firstLaunch = true)
    }
    
    // Construct service
    val service = DesktopGuidePasteDataService(mockk(), deferredLock, mockk())
    
    // Invariant: Factory instantiation must not touch the lock
    assertFalse(lockResolved, "Violation: DI factory resolved the lock during instantiation!")
    assertFalse(deferredLock.isInitialized())
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T08:06:01.799Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794989161799",
    "title": "Inversion of Lock Acquisition via Lazy Evaluation in Component Graphs",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "CrossPaste/crosspaste-desktop",
    "source_uri": "https://github.com/CrossPaste/crosspaste-desktop",
    "source_version": "HEAD",
    "content_hash": "f4dca8cba65ce8432cb473940ce0dda4cac801d19d0fe609df1c6b1f56b8909a"
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
        "Harvested/verified timestamp recorded: 2026-11-18T08:06:01.800Z"
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
  "auth_token": "1b969e372868144d2ddd96b131cdf86882e13ae57a8ef745d63531fd6abbb79c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
