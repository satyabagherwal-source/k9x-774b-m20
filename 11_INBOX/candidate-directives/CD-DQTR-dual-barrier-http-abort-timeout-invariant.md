# Candidate Directive: [CD-DQTR] Dual-Barrier HTTP Abort Timeout Invariant

<!-- PROVENANCE_START
{
  "source_repository": "crawlcove-crawlcove-robots-txt-tester-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T05:54:26.583Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-crawlcove-crawlcove-robots-txt-tester-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [crawlcove-crawlcove-robots-txt-tester-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T05:54:26.583Z`  
> **Learning ID**: `LEARN-EVO-crawlcove-crawlcove-robots-txt-tester-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
Every outbound HTTP client invocation MUST combine an explicit `AbortController` timeout mechanism with a `try...finally` block that invokes `clearTimeout()`. The caught error MUST distinguish between an intentional client abort (`AbortError`) and standard transport failures (DNS, TLS, connection resets).

**WHY**:
Without `clearTimeout(timer)` inside `finally`, pending Node.js timer handles prevent the JavaScript event loop from draining naturally during CLI execution or ephemeral container runs. Additionally, failing to intercept and classify `AbortError` causes timeout exceptions to surface as generic network socket crashes, misleading observability and retry loops.

**WHEN TO APPLY**:
All outbound HTTP requests, fetch clients, webhook dispatchers, and crawler fetchers in Node.js 18+ and edge runtime environments.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified pattern from crawlcove-robots-txt-tester/src/robots.ts
export async function executeGuardedFetch(
  url: string,
  timeoutMs: number,
  customFetch: typeof fetch = fetch
): Promise<{ res?: Response; fetchError?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const res = await customFetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'Accept': 'text/plain,text/*;q=0.9,*/*;q=0.1' }
    });
    return { res };
  } catch (err: unknown) {
    const isError = err instanceof Error;
    const name = isError ? err.name : String(err);
    const message = isError ? err.message : String(err);
    const fetchError = name === 'AbortError' ? 'TIMEOUT' : (message || name);
    return { fetchError };
  } finally {
    clearTimeout(timer); // MANDATORY: Drains event loop handle
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Leaks active timers and swallows abort categorization
async function leakyFetch(url: string, timeoutMs: number) {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs); // LEAK: Active handle survives request completion!
  
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (err) {

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T05:54:26.702Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795154066702",
    "title": "Dual-Barrier HTTP Abort Timeout Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "crawlcove-crawlcove-robots-txt-tester-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "8d14a1c0178d63a833a4d8971d8e2fb1fc8d05e011e7ce3ab811292a9c375ab3"
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
        "Harvested/verified timestamp recorded: 2026-11-20T05:54:26.702Z"
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
  "auth_token": "4c8cb957facf33daa98be4408feb5833609429c0d3d0297993d59a774fe56489"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
