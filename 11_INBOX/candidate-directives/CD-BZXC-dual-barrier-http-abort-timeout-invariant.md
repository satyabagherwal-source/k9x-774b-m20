# Candidate Directive: [CD-BZXC] Dual-Barrier HTTP Abort Timeout Invariant

<!-- PROVENANCE_START
{
  "source_repository": "CrawlCove/robots-txt-tester",
  "source_url": "https://github.com/CrawlCove/crawlcove-robots-txt-tester",
  "source_version": "cf5ba27f",
  "license": "MIT",
  "timestamp": "2026-11-20T05:53:05.184Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-crawlcove-robots-txt-tester",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [CrawlCove/robots-txt-tester](https://github.com/CrawlCove/crawlcove-robots-txt-tester) (Revision: `cf5ba27f`).  
> **License**: MIT | **Timestamp**: `2026-11-20T05:53:05.184Z`  
> **Learning ID**: `learn-github-crawlcove-robots-txt-tester`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    throw new Error("Network failed"); // Destroys distinction between timeout vs DNS failure
  }
}
```

**VERIFICATION METHOD**:
```typescript
import { describe, it, expect, vi } from 'vitest';

describe('Fetch Timeout & Handle Teardown Invariant', () => {
  it('clears timeout handle upon successful HTTP response', async () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const mockFetch = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
    
    await executeGuardedFetch('https://example.com/robots.txt', 5000, mockFetch as unknown as typeof fetch);
    
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T05:53:05.183Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795153985183",
    "title": "Dual-Barrier HTTP Abort Timeout Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "CrawlCove/robots-txt-tester",
    "source_uri": "https://github.com/CrawlCove/crawlcove-robots-txt-tester",
    "source_version": "HEAD",
    "content_hash": "202151efe533d32b5f437ba60e45376b3de8b2bc59e8d905e3855589016b134a"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Harvested/verified timestamp recorded: 2026-11-20T05:53:05.183Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "68ce2bd6d1d8df2a8c97689080ccf9fb54a485b4b66948a3e919e95c2300494b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
