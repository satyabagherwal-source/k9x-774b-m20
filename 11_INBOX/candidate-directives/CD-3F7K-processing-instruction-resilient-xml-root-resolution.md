# Candidate Directive: [CD-3F7K] Processing-Instruction-Resilient XML Root Resolution

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
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When parsing structured XML documents where the root node determines the schema contract (e.g., `<urlset>` vs `<sitemapindex>`), an application **MUST NOT** assume that the first top-level key returned by an AST parser is the root element. The parser traversal **MUST** explicitly skip XML prolog declarations (`?xml`), processing instructions (`?xml-stylesheet`), comments, and metadata keys.

**WHY**:
Modern CMS sitemap generators (WordPress core, Yoast SEO, RankMath) prepend XSLT processing instructions (`<?xml-stylesheet type="text/xsl" href="..."?>`) so that raw XML sitemaps render cleanly as HTML tables in consumer browsers. 
Fast XML parsers (e.g., `fast-xml-parser`) map processing instructions to top-level object keys prefixed with `?`. Naive root extraction logic (e.g., `Object.keys(doc)[0]`) picks `?xml-stylesheet` as the root element instead of `<urlset>`, triggering catastrophic false-positive validation errors (`wrong-root: root element is <?xml-stylesheet>`).

**WHEN TO APPLY**:
Apply whenever evaluating XML payloads using JavaScript/TypeScript dynamic object deserializers (`fast-xml-parser`, `xml2js`, `fxp`) that surface pre-root nodes as top-level keys.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
type NodeMap = Record<string, unknown>

/**
 * Traverses root keys in an XML AST object, bypassing prologs, processing
 * instructions, and internal parser metadata fields.
 */
export function resolveXmlRoot(doc: NodeMap): { rootName: string | undefined; rootNode: NodeMap } {
  const rootName = Object.keys(doc).find((key) => {
    // fast-xml-parser uses '?' prefix for prologs and processing instructions
    // fast-xml-parser uses '#' prefix for comments, cdata, or text nodes
    return !key.startsWith('?') && !key.startsWith('#')
  })

  if (!rootName || typeof doc[rootName] !== 'object' || doc[rootName] === null) {
    return { rootName: undefined, rootNode: {} }
  }

  return { rootName, rootNode: doc[rootName] as NodeMap }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Naively indexing the first key of the parsed object
export function getRootBad(doc: Record<string, any>) {
  const rootName = Object.keys(doc)[0] // Yields "?xml" or "?xml-stylesheet"!
  return { rootName, rootNode: doc[rootName] }
}
```

**VERIFICATION METHOD**:
Unit-test with WordPress-style XSLT stylesheets:
```typescript
import { test, expect } from 'vitest'
import { XMLParser } from 'fast-xml-parser'

test('resolveXmlRoot correctly skips processing instructions', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <?xml-stylesheet type="text/xsl" href="/wp-content/plugins/yoast/css/main-sitemap.xsl"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://example.com/</loc></url>
  </urlset>`
  
  const parser = new XMLParser({ ignoreAttributes: false })
  const doc = parser.parse(xml)
  const { rootName } = resolveXmlRoot(doc)
  expect(rootName).toBe('urlset')
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
    "title": "Processing-Instruction-Resilient XML Root Resolution",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "CrawlCove/xml-sitemap-validator",
    "source_uri": "https://github.com/CrawlCove/crawlcove-sitemap-validator",
    "source_version": "HEAD",
    "content_hash": "fff32d1eba6e3eb9bb46a1cfaa9129ad31bb549bb2d759666baf579d10cd04c1"
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
  "auth_token": "0fbbdd8edb865737863b215927bc4bf1933db70666e7f4ab8ec5573caf849ff6"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
