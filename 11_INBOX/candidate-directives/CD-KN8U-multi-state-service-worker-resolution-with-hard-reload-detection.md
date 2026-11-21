# Candidate Directive: [CD-KN8U] Multi-State Service Worker Resolution with Hard-Reload Detection

<!-- PROVENANCE_START
{
  "source_repository": "mswjs-msw-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T01:35:32.401Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-mswjs-msw-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mswjs-msw-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T01:35:32.401Z`  
> **Learning ID**: `LEARN-EVO-mswjs-msw-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T01:35:32.522Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795224932521",
    "title": "Multi-State Service Worker Resolution with Hard-Reload Detection",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "mswjs-msw-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "9c73887b2cf06c8146303dc2e5ea7e945be9b30a6f0a1f67c02d747c722409b6"
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
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-21T01:35:32.522Z"
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
  "auth_token": "611f21599cdcf7ec38f90726443574066e4593228b85b2d82b5827eb73bfbaf0"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
