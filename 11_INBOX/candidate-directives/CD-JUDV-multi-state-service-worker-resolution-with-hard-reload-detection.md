# Candidate Directive: [CD-JUDV] Multi-State Service Worker Resolution with Hard-Reload Detection

<!-- PROVENANCE_START
{
  "source_repository": "mswjs/msw",
  "source_url": "https://github.com/mswjs/msw",
  "source_version": "b3df8504",
  "license": "MIT",
  "timestamp": "2026-11-21T01:34:55.123Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-mswjs-msw",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mswjs/msw](https://github.com/mswjs/msw) (Revision: `b3df8504`).  
> **License**: MIT | **Timestamp**: `2026-11-21T01:34:55.123Z`  
> **Learning ID**: `learn-github-mswjs-msw`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When coordinating with browser Service Workers for network interception, the host application MUST inspect all three worker lifecycle states (`active`, `installing`, and `waiting`) and MUST trigger a targeted programmatic page reload (`location.reload()`) if registrations exist but `navigator.serviceWorker.controller` evaluates to `null`.

**WHY**:
Browsers bypass the Service Worker controller during "Force Reload" / "Hard Reload" (`Ctrl+F5` / `Shift+Reload`). If an application proceeds under the assumption that an existing registration controls network traffic, initial requests immediately bypass the interception proxy and hit the live backend, causing erratic race conditions, leakages of mock state, and intermittent E2E test failures.

**WHEN TO APPLY**:
Any browser-based interception framework, offline PWA coordinator, or local test harness managing Service Worker registrations where control over initial network calls is mandatory.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import { until } from 'until-async'

export interface FindWorkerPredicate {
  (scriptURL: string, absoluteWorkerUrl: string): boolean
}

export async function resolveOrRegisterWorker(
  workerUrl: string,
  options: RegistrationOptions = {},
  findWorker: FindWorkerPredicate = (url, target) => url === target,
): Promise<[ServiceWorker, ServiceWorkerRegistration]> {
  const absoluteWorkerUrl = new URL(workerUrl, location.href).href

  const registrations = await navigator.serviceWorker.getRegistrations()
  const matchingRegistrations = registrations.filter((reg) => {
    const states = [reg.active, reg.installing, reg.waiting].filter(
      (w): w is ServiceWorker => w !== null,
    )
    return states.some((w) => findWorker(w.scriptURL, absoluteWorkerUrl))
  })

  // Hard-reload invariant: registrations present but page un-controlled
  if (!navigator.serviceWorker.controller && matchingRegistrations.length > 0) {
    location.reload()
    // Halt execution flow while browser reloads context
    return new Promise(() => {})
  }

  const [existing] = matchingRegistrations
  if (existing) {
    // Non-blocking background update to verify integrity
    existing.update()
    const worker = [existing.active, existing.installing, existing.waiting]
      .filter((w): w is ServiceWorker => w !== null)
      .find((w) => findWorker(w.scriptURL, absoluteWorkerUrl))

    if (!worker) {
      throw new Error(`Worker missing in registered scope: ${existing.scope}`)
    }
    return [worker, existing]
  }

  const [regError, registration] = await until(() =>
    navigator.serviceWorker.register(workerUrl, options),
  )

  if (regError) {
    throw new Error(`Service Worker registration failed: ${regError.message}`)
  }

  const registeredWorker = [
    registration.active,
    registration.installing,
    registration.waiting,
  ]
    .filter((w): w is ServiceWorker => w !== null)
    .find((w) => findWorker(w.scriptURL, absoluteWorkerUrl))

  if (!registeredWorker) {
    throw new Error('Service Worker failed to enter a usable lifecycle state.')
  }

  return [registeredWorker, registration]
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Blindly reading controller or active worker
async function badWorkerResolution(workerUrl: string) {
  // FAILS on hard reload: controller is null even if worker is registered
  if (!navigator.serviceWorker.controller) {
    await navigator.serviceWorker.register(workerUrl)
  }
  // FAILS: registration.active is null while worker is still in 'installing' or 'waiting'
  const reg = await navigator.serviceWorker.ready
  return reg.active // Type error or null runtime dereference
}
```

**VERIFICATION METHOD**:
Automated integration test using Playwright/Puppeteer:
1. Navigate to target URL with MSW enabled.
2. Dispatch DevTools protocol command `Page.reload({ ignoreCache: true })`.
3. Assert that `navigator.serviceWorker.controller` is re-established prior to any subsequent `fetch()` dispatches.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T01:34:55.121Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795224895121",
    "title": "Multi-State Service Worker Resolution with Hard-Reload Detection",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "mswjs/msw",
    "source_uri": "https://github.com/mswjs/msw",
    "source_version": "HEAD",
    "content_hash": "6492b4c80ab04aa45a7be7238dffb5bba5f4b5761c41f8a67a604490ab2c6a0b"
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
        "Harvested/verified timestamp recorded: 2026-11-21T01:34:55.121Z"
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
  "auth_token": "7a7e0d81caf2e55d7165a035f0aa777d66d5e8e72fd68249c85667e74e33fac8"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
