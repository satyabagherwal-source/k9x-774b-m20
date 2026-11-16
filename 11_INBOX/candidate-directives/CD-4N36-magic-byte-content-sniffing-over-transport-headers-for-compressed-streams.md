# Candidate Directive: [CD-4N36] Magic-Byte Content Sniffing Over Transport Headers for Compressed Streams

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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T03:48:42.591Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794800922591",
    "title": "Magic-Byte Content Sniffing Over Transport Headers for Compressed Streams",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "crawlcove-crawlcove-sitemap-validator-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "1539ac3899088bbddfb976ae169570b1f6e6fbab6ab1011ba293d96987c5fc31"
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
        "Harvested/verified timestamp recorded: 2026-11-16T03:48:42.592Z"
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
  "auth_token": "d157201e3d5238773502c64966715b424569663b97d0647d1a0ba9b9574ea179"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
