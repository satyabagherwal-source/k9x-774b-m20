# Candidate Directive: [CD-AR4K] Inversion of Lock Acquisition via Lazy Evaluation in Component Graphs

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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T08:08:44.754Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794989324754",
    "title": "Inversion of Lock Acquisition via Lazy Evaluation in Component Graphs",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "crosspaste-crosspaste-desktop-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "6c3dc8f36f379aa17f923133c26519c90a952fbd89e5b3221aaa99b12b526b51"
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
        "Harvested/verified timestamp recorded: 2026-11-18T08:08:44.755Z"
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
  "auth_token": "22ca43e24f732f306eb2911e373de2f8a6d3453cd7a59fbfc730bed5ca706f24"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
