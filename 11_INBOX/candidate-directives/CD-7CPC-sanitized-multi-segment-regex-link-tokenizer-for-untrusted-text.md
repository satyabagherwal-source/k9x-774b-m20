# Candidate Directive: [CD-7CPC] Sanitized Multi-Segment Regex Link Tokenizer for Untrusted Text

<!-- PROVENANCE_START
{
  "source_repository": "gocd/gocd",
  "source_url": "https://github.com/gocd/gocd",
  "source_version": "fb93a763",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T08:06:06.096Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-gocd-gocd",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [gocd/gocd](https://github.com/gocd/gocd) (Revision: `fb93a763`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T08:06:06.096Z`  
> **Learning ID**: `learn-github-gocd-gocd`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: PROMPT_INJECTION_DETECTED: Adversarial prompt injection pattern detected: "<script>"
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When transforming user-supplied or SCM-generated text containing dynamic issue tracking tokens into safe HTML, the tokenization engine MUST execute strict escaping on every interstitial non-token substring before concatenating with escaped attribute anchor tags, and MUST NEVER rely on loose regex string replacement without URL-encoding capture groups.

**WHY**:
Interpolating unescaped commit messages or package tracking IDs directly into HTML strings allows cross-site scripting (XSS) via SCM branch names or commit headers. Conversely, over-escaping entire blocks breaks tracking tool anchor tags. Regex replacements that replace unescaped capture groups directly into URL templates allow URI-scheme injection (e.g., `javascript:`, payload escapes) inside tracking tool configurations.

**WHEN TO APPLY**:
Any text rendering pipeline that bridges raw text and HTML rendering (e.g., Git/SVN/Perforce changelogs, markdown previewers, Jira/GitHub cross-linkers).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import _ from "lodash";

export interface TrackingToolConfig {
  regex: string;
  link: string;
}

export class SafeCommentTokenizer {
  /**
   * Safely tokenizes plain text into sanitized HTML with tracking tool links.
   * Guarantees zero unescaped HTML characters while preserving link structure.
   */
  public static renderToHtml(text: string, trackingTool?: TrackingToolConfig): string {
    if (!text) return '';
    if (!trackingTool || !trackingTool.regex) {
      return _.escape(text);
    }

    try {
      const regex = new RegExp(trackingTool.regex);
      const parts: string[] = [];
      let remainingText = text;
      let match = remainingText.match(regex);

      while (match !== null && match.index !== undefined) {
        // 1. Escape literal text preceding match
        const prefix = remainingText.substring(0, match.index);
        parts.push(_.escape(prefix));

        // 2. Extract match tokens and groups
        const fullMatch = match[0];
        const capturedGroup = this.extractFirstValidGroup(match);
        const trackingId = capturedGroup || fullMatch;

        // 3. Construct safe URL and safe anchor tag
        const safeHref = trackingTool.link.replace("${ID}", encodeURIComponent(trackingId));
        parts.push(`<a href="${_.escape(safeHref)}" target="story_tracker" rel="noreferrer noopener">${_.escape(fullMatch)}</a>`);

        // 4. Advance buffer strictly by match length
        remainingText = remainingText.substring(match.index + fullMatch.length);
        match = remainingText.match(regex);
      }

      // 5. Escape and append terminal text
      parts.push(_.escape(remainingText));
      return parts.join("");
    } catch (e) {
      // Degrade gracefully to fully escaped text on malformed regex
      return _.escape(text);
    }
  }

  private static extractFirstValidGroup(match: RegExpMatchArray): string | null {
    for (let i = 1; i < match.length; i++) {
      if (match[i] !== undefined) {
        return match[i];
      }
    }
    return null;
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// CRITICAL VULNERABILITY: Raw regex replacement into HTML
function unsafeRenderTracking(text: string, trackingTool: { regex: string; link: string }) {
  // If commit comment is: "<script>alert(1)</script> Fix #123"
  // Replaces #123 with a link, but leaves <script> tag unescaped in output!
  // Results in catastrophic Stored XSS inside CI/CD dashboard.
  return text.replace(new RegExp(trackingTool.regex, 'g'), (match) => {
    return `<a href="${trackingTool.link.replace('${ID}', match)}">${match}</a>`;
  });
}
```

**VERIFICATION METHOD**:
Automated tests with malicious and boundary-case strings:
```typescript
describe('SafeCommentTokenizer Security Contract', () => {
  it('escapes XSS payloads while correctly establishing anchor tags', () => {
    const maliciousInput = '<img src=x onerror=alert(1)> closes #1042';
    const config = { regex: '#(\\d+)', link: 'https://issues.internal.org?id=${ID}' };
    const html = SafeCommentTokenizer.renderToHtml(maliciousInput, config);

    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; closes ');
    expect(html).toContain('<a href="https://issues.internal.org?id=1042" target="story_tracker" rel="noreferrer noopener">#1042</a>');
  });
});
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T08:06:06.096Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: PROMPT_INJECTION_DETECTED: Adversarial prompt injection pattern detected: \"<script>\"",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=FAIL, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794989166096",
    "title": "Sanitized Multi-Segment Regex Link Tokenizer for Untrusted Text",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "gocd/gocd",
    "source_uri": "https://github.com/gocd/gocd",
    "source_version": "HEAD",
    "content_hash": "008bb9b78b871079150eb96f6bd2186e8766d3469df39ca7c25223c9a9884a8a"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
        "Evidence-to-claim lexical alignment: 0%"
      ]
    },
    "technical_correctness": {
      "status": "FAIL",
      "score": 0,
      "directive_opposition": false,
      "opposing_rule": null,
      "is_adversarial": true,
      "has_dangerous_security": false,
      "unsupported_assumptions": [],
      "findings": [
        "PROMPT_INJECTION_DETECTED: Adversarial prompt injection pattern detected: \"<script>\""
      ],
      "details": [
        "External instructions attempting to override AI constraints rejected fail-closed."
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
        "Harvested/verified timestamp recorded: 2026-11-18T08:06:06.096Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "60fd4d28bcd9b9e74314965b808f7c3bb531dc2293101d7214f289958b0669d0"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
