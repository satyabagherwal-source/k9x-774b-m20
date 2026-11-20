# Candidate Directive: [CD-BZXD] Non-Text Catch-All Route Detection on Default HTTP 200 Responses

<!-- PROVENANCE_START
{
  "source_repository": "CrawlCove/robots-txt-tester",
  "source_url": "https://github.com/CrawlCove/crawlcove-robots-txt-tester",
  "source_version": "cf5ba27f",
  "license": "MIT",
  "timestamp": "2026-11-20T05:53:05.185Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-crawlcove-robots-txt-tester",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [CrawlCove/robots-txt-tester](https://github.com/CrawlCove/crawlcove-robots-txt-tester) (Revision: `cf5ba27f`).  
> **License**: MIT | **Timestamp**: `2026-11-20T05:53:05.185Z`  
> **Learning ID**: `learn-github-crawlcove-robots-txt-tester`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
HTTP consumers fetching plain-text configuration files (e.g., `robots.txt`, `.well-known/*`, `security.txt`) MUST NOT rely solely on `response.ok` or `status === 200`. The consumer MUST inspect the leading payload buffer for HTML, XML, or JSON signatures (`<html`, `<!doctype`, `<?xml`, `{`) to detect SPA framework catch-all routing traps.

**WHY**:
Modern Single-Page Application (SPA) servers (Next.js, Cloudflare Pages, S3/CloudFront redirects) are frequently configured to return the default `index.html` with an HTTP 200 status code for unmapped paths. A robots.txt parser encountering an HTML body parses markup tags as directives or invalid tokens, quietly failing open ("no rules applied") and leaving production internal routes exposed to indexing.

**WHEN TO APPLY**:
Any automated crawler, SEO auditor, security scanner, or client consuming text endpoints from third-party or SPA-backed hosts.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified pattern from crawlcove-robots-txt-tester/src/robots.ts
export function validateTextPayload(rawBuffer: Buffer): { isValidText: boolean; errorReason?: string } {
  // Read initial slice or full utf-8 string
  const text = rawBuffer.toString('utf8');
  
  // Fast check for common catch-all markup signatures
  const isMarkupOrJson = /^\s*(<!doctype|<html|<\?xml|{)/i.test(text);
  if (isMarkupOrJson) {
    return {
      isValidText: false,
      errorReason: 'Response is HTML/XML/JSON catch-all route, not a valid plain-text file'
    };
  }
  
  return { isValidText: true };
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Trusting HTTP 200 and parsing HTML as REP directives
async function unsafeLoadRobots(url: string) {
  const res = await fetch(url);
  if (res.ok) {
    const text = await res.text();
    // If text is "<html><body>404 Not Found</body></html>", parser treats it as 0 disallow rules!
    return parseRobotsRules(text);
  }
}
```

**VERIFICATION METHOD**:
```typescript
import { describe, it, expect } from 'vitest';

describe('Catch-All HTML Detection Guard', () => {
  it('flags HTML 200 catch-all error pages as invalid plain-text', () => {
    const mockHtml = Buffer.from('<!DOCTYPE html><html><head><title>App</title></head></html>');
    const result = validateTextPayload(mockHtml);
    expect(result.isValidText).toBe(false);
    expect(result.errorReason).toContain('HTML/XML/JSON');
  });

  it('permits valid robots.txt text payload', () => {
    const mockRobots = Buffer.from('User-agent: *\nDisallow: /admin');
    const result = validateTextPayload(mockRobots);
    expect(result.isValidText).toBe(true);
  });
});
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T05:53:05.184Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795153985184",
    "title": "Non-Text Catch-All Route Detection on Default HTTP 200 Responses",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "CrawlCove/robots-txt-tester",
    "source_uri": "https://github.com/CrawlCove/crawlcove-robots-txt-tester",
    "source_version": "HEAD",
    "content_hash": "474c1a189efbf0a3741a34ce76283005e9cdfeef53948581ed1178ead60ee7b2"
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
        "Harvested/verified timestamp recorded: 2026-11-20T05:53:05.184Z"
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
  "auth_token": "20580972cadd7eda782625c57e859589fffe77ffa3e46c97f0dfd9da2654839a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
