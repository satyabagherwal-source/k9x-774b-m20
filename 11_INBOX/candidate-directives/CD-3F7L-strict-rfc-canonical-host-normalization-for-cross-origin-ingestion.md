# Candidate Directive: [CD-3F7L] Strict RFC Canonical Host Normalization for Cross-Origin Ingestion

<!-- PROVENANCE_START
{
  "source_repository": "CrawlCove/xml-sitemap-validator",
  "source_url": "https://github.com/CrawlCove/crawlcove-sitemap-validator",
  "source_version": "e6b51cd7",
  "license": "MIT",
  "timestamp": "2026-11-16T03:47:45.729Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-crawlcove-xml-sitemap-validator",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [CrawlCove/xml-sitemap-validator](https://github.com/CrawlCove/crawlcove-sitemap-validator) (Revision: `e6b51cd7`).  
> **License**: MIT | **Timestamp**: `2026-11-16T03:47:45.729Z`  
> **Learning ID**: `learn-github-crawlcove-xml-sitemap-validator`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain J

## Original Learning Payload (100% Preserved)
**RULE**:
When validating resource boundaries where a parent document asserts authority over child URIs (e.g., a sitemap asserting URLs, or a cookie domain match), the matching algorithm **MUST NOT** perform simple substring checks or naive host equality. The validator **MUST** strip protocol default configurations, normalize host casing, parse through standard URL parsers, and strip prefix aliases (`www.`) symmetrically across both base host and target host before asserting domain isolation.

**WHY**:
Search engines enforce domain-level ownership boundaries: a sitemap at `https://example.com/sitemap.xml` cannot assert URLs for `https://subdomain.example.com/` unless explicitly delegated via `robots.txt`. However, `www.example.com` and `example.com` are routinely conflated or interchanged in CMS routing. 
Naive string checks (`targetUrl.includes(sitemapUrl)`) introduce critical security and validation flaws:
- `targetUrl = "https://example.com.attacker.org"` matches `targetUrl.includes("example.com")`.
- `targetUrl = "https://www.example.com/item"` fails strict equality against `sitemapHost = "example.com"`.

**WHEN TO APPLY**:
All SEO auditors, sitemap linters, web crawlers, security origin verifiers, and multi-tenant URL ingress validators.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export function safeParseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl)
  } catch {
    return null
  }
}

export function normalizeComparableHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '')
}

export function isCrossHostViolation(sitemapUrl: string, locUrl: string): boolean {
  const base = safeParseUrl(sitemapUrl)
  const target = safeParseUrl(locUrl)
  if (!base || !target) return true // Unparseable URLs are invalid boundaries

  const baseNorm = normalizeComparableHost(base.host)
  const targetNorm = normalizeComparableHost(target.host)

  return baseNorm !== targetNorm
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Substring matching or raw hostname comparison
export function badHostCheck(sitemapUrl: string, locUrl: string): boolean {
  // Vulnerable to subdomain spoofing: https://example.com vs https://example.com.evil.com
  return !locUrl.startsWith(sitemapUrl)
}
```

**VERIFICATION METHOD**:
Test with cross-host edge cases:
```typescript
import { test, expect } from 'vitest'

test('Host matching correctly handles www-aliasing and flags actual cross-host', () => {
  expect(isCrossHostViolation('https://example.com/sitemap.xml', 'https://www.example.com/page')).toBe(false)
  expect(isCrossHostViolation('https://www.example.com/sitemap.xml', 'https://example.com/page')).toBe(false)
  expect(isCrossHostViolation('https://example.com/sitemap.xml', 'https://blog.example.com/page')).toBe(true)
  expect(isCrossHostViolation('https://example.com/sitemap.xml', 'https://example.com.attacker.com/page')).toBe(true)
})
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T03:47:45.728Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794800865728",
    "title": "Strict RFC Canonical Host Normalization for Cross-Origin Ingestion",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "CrawlCove/xml-sitemap-validator",
    "source_uri": "https://github.com/CrawlCove/crawlcove-sitemap-validator",
    "source_version": "HEAD",
    "content_hash": "0d8e38cfa4df59a92b85c8f982ca1ac87261c4ff876f4fddd2bfd02635b4e29f"
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
        "Harvested/verified timestamp recorded: 2026-11-16T03:47:45.728Z"
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
  "auth_token": "aa1a659491bd09fb167fc6f122a4dec4c2645a6a6c33b098b345e7a2610795e3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
