# Candidate Directive: [CD-W3NA] XML Content Sniffing and XHTML Tree Extraction Invariant

<!-- PROVENANCE_START
{
  "source_repository": "msasikanth-twine-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T08:53:20.260Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-msasikanth-twine-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [msasikanth-twine-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T08:53:20.260Z`  
> **Learning ID**: `LEARN-EVO-msasikanth-twine-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
Syndication feed parsers MUST NOT rely exclusively on HTTP `Content-Type` headers to validate feed documents, nor assume feed body strings contain simple escaped text.
1. When content types are generic (`text/plain`, `application/octet-stream`), the parser MUST sniff the first 512 bytes for root elements: `<rss`, `<feed`, `<rdf:RDF`.
2. When parsing Atom `<content>` elements with `type="xhtml"`, the parser MUST NOT call plain-text extraction methods (e.g. `getText()`). It MUST traverse and serialize the child XML element hierarchy (RFC 4287 §4.1.3 mandates an XML `<div>` child node).

**WHY**:
Popular servers (such as GitHub raw endpoints) serve XML documents as `text/plain`. Strict header validation fails valid feeds. Furthermore, Atom XHTML content contains raw unescaped child elements without CDATA wrappers. Reading text nodes directly results in an empty string, breaking content rendering for users.

**WHEN TO APPLY**:
All feed ingestion, syndication parser modules, and webhook listeners processing RSS/Atom/XHTML payloads.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
import okio.BufferedSource
import okio.ByteString.Companion.encodeUtf8

object FeedSniffer {
  private val RSS_TAG = "<rss".encodeUtf8()
  private val FEED_TAG = "<feed".encodeUtf8()
  private val RDF_TAG = "<rdf:RDF".encodeUtf8()

  fun isLikelyFeed(source: BufferedSource, contentType: String?): Boolean {
    val normalizedType = contentType?.lowercase()?.split(";")?.firstOrNull()?.trim()
    if (normalizedType in setOf("application/rss+xml", "application/atom+xml", "application/xml", "text/xml")) {
      return true
    }
    // Sniff prefix up to 512 bytes for XML declarations and root feed tags
    val peekSource = source.peek()
    val prefix = peekSource.readUtf8(minOf(peekSource.buffer.size, 512)).lowercase()
    return prefix.contains("<rss") || prefix.contains("<feed") || prefix.contains("<rdf:rdf")
  }
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Rejecting feeds based purely on MIME type, and treating XHTML as text
fun parseResponse(contentType: String, xmlText: String) {
  if (contentType != "application/xml" && contentType != "application/rss+xml") {
    throw InvalidFeedContentTypeException("Not a valid feed")
  }
}

fun parseAtomContent(xmlNode: XmlNode): String {
  // FAILS on <content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"><p>Body</p></div></content>
  // Returns empty string because the text is inside child elements!
  return xmlNode.text ?: ""
}
```

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T08:53:20.374Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794992000374",
    "title": "XML Content Sniffing and XHTML Tree Extraction Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "msasikanth-twine-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "05fc53e7402b2abbd3297567173aaddb32c5cd3809456bcc9bb23430b7fc62b5"
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
        "Harvested/verified timestamp recorded: 2026-11-18T08:53:20.374Z"
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
  "auth_token": "cf7ebfd8e1aa579be15ab419a1dbeaf0c851d295ec188263871666fd700a0425"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
