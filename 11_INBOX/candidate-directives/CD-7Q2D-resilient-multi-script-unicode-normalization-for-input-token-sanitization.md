# Candidate Directive: [CD-7Q2D] Resilient Multi-Script Unicode Normalization for Input Token Sanitization

<!-- PROVENANCE_START
{
  "source_repository": "searchsolved/search-solved-public-seo",
  "source_url": "https://github.com/searchsolved/search-solved-public-seo",
  "source_version": "591fa023",
  "license": "NOASSERTION",
  "timestamp": "2026-11-20T03:01:48.085Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-searchsolved-search-solved-public-seo",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [searchsolved/search-solved-public-seo](https://github.com/searchsolved/search-solved-public-seo) (Revision: `591fa023`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-20T03:01:48.085Z`  
> **Learning ID**: `learn-github-searchsolved-search-solved-public-seo`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
Before passing arbitrary user strings or scraped keywords to regex parsers, clustering tokenizers, or external API query parameters, pipelines MUST sanitize characters against an explicitly permitted Unicode script block whitelist while maintaining valid punctuation, Latin, Arabic, and Indic ranges. Raw replacement MUST NOT delete whitespace boundaries or trigger string slicing anomalies.

**WHY**:
SEO keyword lists scraped from global search engines regularly feature invisible control codes, zero-width joiners, terminal control characters (`\r\n`), and adversarial token sequences. Indiscriminately applying ASCII-only regex (`[^a-zA-Z0-9]`) destroys international search volume (Arabic, Hindi, etc.), while leaving strings unsanitized causes downstream JSON serialization failures or silent empty keys in Pandas DataFrame indexing.

**WHEN TO APPLY**:
Apply in keyword tokenization, entity extraction, URL path slicing, and DataFrame column creation where multilingual user input or web-scraped strings are normalized.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import re
from typing import Any

# Preserves printable ASCII, Arabic (\u0600-\u06FF), and Devanagari (\u0900-\u097F)
UNICODE_CLEAN_PATTERN = re.compile(r'[^\x20-\x7E\u0600-\u06FF\u0900-\u097F]+')

def sanitize_keyword_token(raw_input: Any) -> str:
    """Sanitize input preserving multi-lingual semantic tokens while stripping controls."""
    if raw_input is None:
        return ""
    
    # Enforce string conversion and collapse carriage returns
    text = str(raw_input).strip()
    text = re.sub(r'[\r\n\t]+', ' ', text)
    
    # Strip illegal controls and non-whitelisted script points
    cleaned = UNICODE_CLEAN_PATTERN.sub('', text)
    
    # Normalize multiple spaces into single space
    return re.sub(r'\s+', ' ', cleaned).strip()
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Naive ASCII stripping or unsafe slicing
def unsafe_sanitize(keyword):
    # Destroys all non-English keywords completely (returns "" for Arabic/Hindi)
    clean = re.sub(r'[^a-zA-Z0-9 ]', '', str(keyword))
    # Unsafe slicing might split multi-byte characters or leave trailing broken tokens
    return clean[:255]
```

**VERIFICATION METHOD**:
```python
def test_unicode_sanitizer_preserves_multilingual_targets():
    arabic = "أفضل حذاء للجري\n\r\t"
    hindi = "दौड़ने के लिए सबसे अच्छे जूते"
    english = "best running shoes! @#$% \x00\x1f"
    
    assert sanitize_keyword_token(arabic) == "أفضل حذاء للجري"
    assert sanitize_keyword_token(hindi) == "दौड़ने के लिए सबसे अच्छे जूते"
    assert sanitize_keyword_token(english) == "best running shoes! @#$%"
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T03:01:48.085Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795143708085",
    "title": "Resilient Multi-Script Unicode Normalization for Input Token Sanitization",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "searchsolved/search-solved-public-seo",
    "source_uri": "https://github.com/searchsolved/search-solved-public-seo",
    "source_version": "HEAD",
    "content_hash": "4f6a73e7fba16831889aa5653edfd887fc2b24c325fc7067bb8716f40564589d"
  },
  "evidence_fingerprint": "0ea4249640d6d3cc",
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
        "Direct empirical evidence ratio: 0% (0/4)",
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
        "Harvested/verified timestamp recorded: 2026-11-20T03:01:48.085Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "00898379e084a93428f6a992e11334a39991e4d360ba6731c5b48bfed03c774d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
