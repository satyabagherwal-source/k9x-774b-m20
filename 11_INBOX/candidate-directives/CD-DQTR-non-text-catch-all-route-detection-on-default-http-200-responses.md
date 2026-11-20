# Candidate Directive: [CD-DQTR] Non-Text Catch-All Route Detection on Default HTTP 200 Responses

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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T05:54:26.703Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795154066703",
    "title": "Non-Text Catch-All Route Detection on Default HTTP 200 Responses",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "crawlcove-crawlcove-robots-txt-tester-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "ce534cb875de6513692bf48b755e55781ae2f312e02512fd27fed0613d0aaa27"
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
        "Harvested/verified timestamp recorded: 2026-11-20T05:54:26.703Z"
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
  "auth_token": "3ff6e4ebbfb53dd3c299af8cd89fdf141659665afc50904082585812cf087e57"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
