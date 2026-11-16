# Candidate Directive: [CD-3F7J] Magic-Byte Content Sniffing Over Transport Headers for Compressed Streams

<!-- PROVENANCE_START
{
  "source_repository": "CrawlCove/xml-sitemap-validator",
  "source_url": "https://github.com/CrawlCove/crawlcove-sitemap-validator",
  "source_version": "e6b51cd7",
  "license": "MIT",
  "timestamp": "2026-11-16T03:47:45.728Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-crawlcove-xml-sitemap-validator",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [CrawlCove/xml-sitemap-validator](https://github.com/CrawlCove/crawlcove-sitemap-validator) (Revision: `e6b51cd7`).  
> **License**: MIT | **Timestamp**: `2026-11-16T03:47:45.728Z`  
> **Learning ID**: `learn-github-crawlcove-xml-sitemap-validator`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When ingesting binary payloads from untrusted or misconfigured external HTTP servers, an engine **MUST NOT** rely exclusively on HTTP `Content-Encoding`, `Content-Type`, or file path extensions to determine compression format. The engine **MUST** inspect the byte-level magic header (`0x1F 0x8B` for Gzip) directly on the raw buffer prior to string decoding.

**WHY**:
External web servers, CDNs, and S3 buckets routinely misconfigure headers when serving `.xml.gz` sitemaps:
- Serving a `.gz` file with `Content-Type: application/xml` without `Content-Encoding: gzip` causes UTF-8 decoders to crash or ingest corrupted binary bytes (`\x1f\x8b...`).
- Serving a pre-gzipped file with `Content-Encoding: gzip` causes reverse proxies or client fetch libraries to decompress automatically, leaving a raw XML buffer while the URL still ends in `.gz`. Inspecting headers or file extensions alone results in either redundant decompressions or fatal `Z_DATA_ERROR` exceptions.

**WHEN TO APPLY**:
Apply in any data ingestion pipeline, crawler, web scraper, or archive processor ingesting payloads that may be compressed via gzip, zlib, or brotli.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import { gunzipSync } from 'node:zlib'

export interface DecodedPayload {
  text: string
  gzipped: boolean
}

/**
 * Sniffs the first 2 bytes of the buffer for the standard GZIP magic number (0x1F, 0x8B).
 * Safely falls back to UTF-8 decoding if magic bytes do not match.
 */
export function decodeBufferPayload(body: Buffer): DecodedPayload {
  // GZIP specification (RFC 1952): ID1 = 31 (0x1f), ID2 = 139 (0x8b)
  if (body.length >= 2 && body[0] === 0x1f && body[1] === 0x8b) {
    try {
      const decompressed = gunzipSync(body)
      return { text: decompressed.toString('utf8'), gzipped: true }
    } catch (err) {
      throw new Error(`Corrupted gzip stream: ${(err as Error).message}`, { cause: err })
    }
  }
  return { text: body.toString('utf8'), gzipped: false }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Blindly trusting HTTP headers or URL extensions
export function decodePayloadBroken(res: Response, url: string, body: Buffer): string {
  // FAILS when server sends .gz without content-encoding or vice-versa
  if (url.endsWith('.gz') || res.headers.get('content-encoding') === 'gzip') {
    return gunzipSync(body).toString('utf8') // Throws Z_DATA_ERROR if already decompressed by HTTP client!
  }
  return body.toString('utf8') // Produces corrupted mojibake if server forgot headers!
}
```

**VERIFICATION METHOD**:
Verify using synthetic byte buffers:
```typescript
import { describe, it, expect } from 'vitest'
import { gzipSync } from 'node:zlib'

describe('decodeBufferPayload Invariant', () => {
  it('correctly decompresses raw gzipped buffer regardless of metadata', () => {
    const rawXml = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'
    const compressed = gzipSync(Buffer.from(rawXml, 'utf8'))
    const result = decodeBufferPayload(compressed)
    expect(result.gzipped).toBe(true)
    expect(result.text).toBe(rawXml)
  })

  it('safely handles non-gzipped buffer starting with arbitrary bytes', () => {
    const rawXml = '<?xml version="1.0" encoding="UTF-8"?><urlset></urlset>'
    const plainBuffer = Buffer.from(rawXml, 'utf8')
    const result = decodeBufferPayload(plainBuffer)
    expect(result.gzipped).toBe(false)
    expect(result.text).toBe(rawXml)
  })
})
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T03:47:45.726Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794800865726",
    "title": "Magic-Byte Content Sniffing Over Transport Headers for Compressed Streams",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "CrawlCove/xml-sitemap-validator",
    "source_uri": "https://github.com/CrawlCove/crawlcove-sitemap-validator",
    "source_version": "HEAD",
    "content_hash": "7d5f9ce87d48c4e4bf5cbab45d830402d82240108142726fecf4658a27c4748f"
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
        "Harvested/verified timestamp recorded: 2026-11-16T03:47:45.726Z"
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
  "auth_token": "546164545fc6d7fb329a3667810c48e8366693c7b54ae3611653d599700d946f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
