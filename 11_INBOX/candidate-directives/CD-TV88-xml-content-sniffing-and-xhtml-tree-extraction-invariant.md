# Candidate Directive: [CD-TV88] XML Content Sniffing and XHTML Tree Extraction Invariant

<!-- PROVENANCE_START
{
  "source_repository": "msasikanth/twine",
  "source_url": "https://github.com/msasikanth/twine",
  "source_version": "a741d94b",
  "license": "GPL-3.0",
  "timestamp": "2026-11-18T08:51:36.152Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-msasikanth-twine",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [msasikanth/twine](https://github.com/msasikanth/twine) (Revision: `a741d94b`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-18T08:51:36.152Z`  
> **Learning ID**: `learn-github-msasikanth-twine`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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

**VERIFICATION METHOD**:
Integration test serving an Atom feed with `Content-Type: text/plain` containing `<content type="xhtml">` to ensure the feed parses successfully with full HTML markup preserved.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T08:51:36.149Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794991896149",
    "title": "XML Content Sniffing and XHTML Tree Extraction Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "msasikanth/twine",
    "source_uri": "https://github.com/msasikanth/twine",
    "source_version": "HEAD",
    "content_hash": "e9417243c7ed6dc13b5c4e942431acd3b9640d0731df717f23667e562e40154a"
  },
  "evidence_fingerprint": "5c7fbcc97293e38f",
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
        "Direct empirical evidence ratio: 0% (0/5)",
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
        "Harvested/verified timestamp recorded: 2026-11-18T08:51:36.149Z"
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
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "b1ff6189d34bf021f82119279a1d554bd348827e490333405bbe58d2605e776d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
