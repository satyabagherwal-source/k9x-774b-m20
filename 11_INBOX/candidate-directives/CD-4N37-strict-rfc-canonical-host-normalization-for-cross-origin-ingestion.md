# Candidate Directive: [CD-4N37] Strict RFC Canonical Host Normalization for Cross-Origin Ingestion

<!-- PROVENANCE_START
{
  "source_repository": "crawlcove-crawlcove-sitemap-validator-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-16T03:48:42.510Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-crawlcove-crawlcove-sitemap-validator-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [crawlcove-crawlcove-sitemap-validator-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-16T03:48:42.510Z`  
> **Learning ID**: `LEARN-EVO-crawlcove-crawlcove-sitemap-validator-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T03:48:42.595Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794800922595",
    "title": "Strict RFC Canonical Host Normalization for Cross-Origin Ingestion",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "crawlcove-crawlcove-sitemap-validator-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "585e5d3c35a624b3595c776295975db5b00b010edc25a862aa266c3a411e73f3"
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
        "Harvested/verified timestamp recorded: 2026-11-16T03:48:42.595Z"
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
  "auth_token": "0b16d77161e49ff65463943d6e7d57639ccdb2bc836254b61d78f744cbfdf1dc"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
