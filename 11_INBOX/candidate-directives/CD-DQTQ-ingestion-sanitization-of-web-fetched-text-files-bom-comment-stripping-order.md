# Candidate Directive: [CD-DQTQ] Ingestion Sanitization of Web-Fetched Text Files (BOM & Comment Stripping Order)

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
When parsing raw text payloads fetched over HTTP (such as `robots.txt`, CSV, YAML, or ENV files), parsers MUST strip Unicode Byte Order Marks (BOM `\uFEFF`) before line splitting, and MUST strip inline comments (`#.*$`) prior to whitespace trimming and field-delimiter matching.

**WHY**:
An unstripped UTF-8 BOM (`\uFEFF`) on line 1 corrupts the directive key token (e.g., `\uFEFFUser-agent` fails regex `/^([A-Za-z-]+)\s*:/`), causing parsers to ignore the primary user-agent rule group. Furthermore, trimming whitespace before stripping comments risks trailing token concatenation or failing regex anchors.

**WHEN TO APPLY**:
Apply in all text parsers, config loaders, REP parsers, and custom file deserializers across Node.js, Go, Rust, and Python.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified pattern from crawlcove-robots-txt-tester/src/robots.ts
export function sanitizeAndTokenizeLines(body: string): Array<{ lineNo: number; raw: string; clean: string }> {
  // 1. Strip BOM at index 0 prior to any split
  const cleanBody = body.replace(/^\uFEFF/, '');
  
  // 2. Split strictly on CRLF or LF
  const rawLines = cleanBody.split(/\r?\n/);
  
  const tokenized: Array<{ lineNo: number; raw: string; clean: string }> = [];
  
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    // 3. Strip inline comment before trimming whitespace
    const clean = raw.replace(/#.*$/, '').trim();
    if (clean.length === 0) {
      continue; // Skip blank or comment-only lines
    }
    tokenized.push({ lineNo: i + 1, raw, clean });
  }
  
  return tokenized;
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Trimming before comment removal, missing BOM strip, split on \n only
function badParse(body: string) {
  // FAILS on Windows \r\n, FAILS on UTF-8 BOM, FAILS if comment has leading space
  const lines = body.split('\n');
  return lines.map(line => {
    const trimmed = line.trim(); // Comment `#` still attached!
    const parts = trimmed.split(':');
    return { key: parts[0], value: parts[1] }; // Corrupted key if BOM present: "\uFEFFUser-agent"
  });
}
```

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T05:54:26.697Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795154066697",
    "title": "Ingestion Sanitization of Web-Fetched Text Files (BOM & Comment Stripping Order)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "crawlcove-crawlcove-robots-txt-tester-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "af75bf1405483783df0541c9dd1f66d2cb29590b80ff07dabe04da517503ea9b"
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
      "score": 0.8,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
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
        "Harvested/verified timestamp recorded: 2026-11-20T05:54:26.698Z"
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
  "auth_token": "94d76715366dddb47b1d15df0964627e3c4f0e8538e77c367b8e2aafa2e2e9f4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
