# Candidate Directive: [CD-NGCM] Ephemeral Asynchronous Initialization with Self-Resetting Fault Erasure

<!-- PROVENANCE_START
{
  "source_repository": "QwikDev/qwik",
  "source_url": "https://github.com/QwikDev/qwik",
  "source_version": "cfa0e890",
  "license": "MIT",
  "timestamp": "2026-11-17T06:10:58.822Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-qwikdev-qwik",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [QwikDev/qwik](https://github.com/QwikDev/qwik) (Revision: `cfa0e890`).  
> **License**: MIT | **Timestamp**: `2026-11-17T06:10:58.822Z`  
> **Learning ID**: `learn-github-qwikdev-qwik`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
Asynchronous initialization singletons that cache loading promises MUST clear their cached promise reference inside an error catch-handler before re-throwing the error. They MUST NOT cache a rejected promise permanently across subsequent consumer requests.

**WHY**:
If an asynchronous operation (such as loading dynamic WASM, fetching a native toolchain binding, or loading network modules) fails due to a transient failure (network timeout, temporary file lock, CDN outage), caching the rejected promise freezes the system in a permanently broken state. All future calls to `ensure()` will instantly reject with the original stale error without attempting a retry.

**WHEN TO APPLY**:
Apply to any lazy initialization cache, module loader, WebWorker bundler, connection pooling mechanism, or service locator where an initialization promise is cached via nullish assignment (`cache ??= load()`).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
let initializationPromise: Promise<WorkerBinding> | null = null;
let useNativeEngine = false;

export function ensureInitialized(): Promise<WorkerBinding> {
  // Forget a failed load so the next execution cycle retries it.
  initializationPromise ??= loadEngineBinding(useNativeEngine).catch((error: unknown) => {
    initializationPromise = null;
    throw error;
  });
  return initializationPromise;
}

export async function executeWork(payload: WorkPayload): Promise<WorkResult> {
  // Guaranteed fresh attempt if previous initialization encountered a network blip
  const binding = await ensureInitialized();
  return binding.process(payload);
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// NEVER cache a promise without un-setting it on failure:
let cachedPromise: Promise<WorkerBinding> | null = null;

export function ensureInitializedAntiPattern(): Promise<WorkerBinding> {
  // DEFECT: Once loadEngineBinding rejects, cachedPromise remains permanently
  // in a rejected state. Subsequent retries can never succeed without restarting the process.
  if (!cachedPromise) {
    cachedPromise = loadEngineBinding();
  }
  return cachedPromise;
}
```

**VERIFICATION METHOD**:
Inject a mock network fault that forces the first execution of `loadEngineBinding` to reject. Assert that the consumer catches the error. Immediately retry the operation with the mock network fault resolved. Assert that `ensureInitialized()` executes `loadEngineBinding` a second time and resolves successfully.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T06:10:58.820Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794895858820",
    "title": "Ephemeral Asynchronous Initialization with Self-Resetting Fault Erasure",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "QwikDev/qwik",
    "source_uri": "https://github.com/QwikDev/qwik",
    "source_version": "HEAD",
    "content_hash": "f5a980414962a1dcc0ed0ce81784c0db15e170d9347f17e45b1a7fdaa1a3a307"
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
        "Harvested/verified timestamp recorded: 2026-11-17T06:10:58.820Z"
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
  "auth_token": "83c2b8e4918ab1052f4c1fad381035293734371341a1d5085cdc57640e38597c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
