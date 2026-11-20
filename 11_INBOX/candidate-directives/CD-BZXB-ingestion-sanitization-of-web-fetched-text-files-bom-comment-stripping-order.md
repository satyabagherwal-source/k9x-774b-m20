# Candidate Directive: [CD-BZXB] Ingestion Sanitization of Web-Fetched Text Files (BOM & Comment Stripping Order)

<!-- PROVENANCE_START
{
  "source_repository": "CrawlCove/robots-txt-tester",
  "source_url": "https://github.com/CrawlCove/crawlcove-robots-txt-tester",
  "source_version": "cf5ba27f",
  "license": "MIT",
  "timestamp": "2026-11-20T05:53:05.183Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-crawlcove-robots-txt-tester",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [CrawlCove/robots-txt-tester](https://github.com/CrawlCove/crawlcove-robots-txt-tester) (Revision: `cf5ba27f`).  
> **License**: MIT | **Timestamp**: `2026-11-20T05:53:05.183Z`  
> **Learning ID**: `learn-github-crawlcove-robots-txt-tester`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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

**VERIFICATION METHOD**:
```typescript
import { describe, it, expect } from 'vitest';
import { lint } from './robots.js';

describe('BOM and Comment Handling Invariant', () => {
  it('correctly parses line 1 User-agent when prepended with UTF-8 BOM', () => {
    const content = '\uFEFFUser-agent: Googlebot\nDisallow: /private';
    const report = lint(content);
    expect(report.groups.length).toBe(1);
    expect(report.groups[0].agents).toContain('Googlebot');
    expect(report.findings.filter(f => f.code === 'unknown-directive')).toHaveLength(0);
  });

  it('correctly strips inline comments without retaining trailing whitespace', () => {
    const content = 'User-agent: * # default crawler group\nDisallow: /admin # internal';
    const report = lint(content);
    expect(report.groups[0].rules).toBe(1);
    expect(report.findings).toHaveLength(1); // Only no-sitemap warning
  });
});
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T05:53:05.181Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795153985181",
    "title": "Ingestion Sanitization of Web-Fetched Text Files (BOM & Comment Stripping Order)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "CrawlCove/robots-txt-tester",
    "source_uri": "https://github.com/CrawlCove/crawlcove-robots-txt-tester",
    "source_version": "HEAD",
    "content_hash": "23ce1079499994f07d44ec92960fff4e21a989a5699ef23ce8f52faec338adcd"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Harvested/verified timestamp recorded: 2026-11-20T05:53:05.181Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "02319768b81484f4f4aaca4d927627f744a4a7ea3e6323d60917f6b0a6a0e6cc"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
