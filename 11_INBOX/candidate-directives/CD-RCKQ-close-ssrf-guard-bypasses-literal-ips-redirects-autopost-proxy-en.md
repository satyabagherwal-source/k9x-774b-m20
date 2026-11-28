# Candidate Directive: [CD-RCKQ] close SSRF guard bypasses (literal IPs, redirects, autopost, proxy en

<!-- PROVENANCE_START
{
  "source_repository": "gitroomhq/postiz-app",
  "source_url": "https://github.com/gitroomhq/postiz-app",
  "source_version": "6086870d",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-28T13:18:17.450Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-gitroomhq-postiz-app",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app) (Revision: `6086870d`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-28T13:18:17.450Z`  
> **Learning ID**: `learn-github-gitroomhq-postiz-app`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `libraries/nestjs-libraries/src/database/prisma/autopost/autopost.service.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in gitroomhq/postiz-app. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ad57f595`: security): close SSRF guard bypasses (literal IPs, redirects, autopost, proxy env). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `libraries/nestjs-libraries/src/database/prisma/autopost/autopost.service.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
import { getSsrfSafeDispatcher } from '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher';
      // fetched through the SSRF guard (every redirect hop is checked), only
      // the parsing is left to rss-parser
      const response = await fetch(url, {
        // @ts-ignore — undici option, not in lib.dom fetch types
        dispatcher: getSsrfSafeDispatcher(),
        signal: AbortSignal.timeout(60000),
        // same headers rss-parser's parseURL sent, some feed hosts need them
        headers: {
          'User-Agent': 'rss-parser',
          Accept: 'application/rss+xml',
        },
      });
      if (!response.ok) {
        throw new Error('Status code ' + response.status);
      }

      // response.text() is always utf-8, parseURL honoured the feed's charset
      const charset = /charset\s*=\s*"?([^\s;"]+)/i.exec(
        response.headers.get('content-type') || ''
      )?.[1];
      let decoder: TextDecoder;
      try {
        decoder = new TextDecoder(charset || 'utf-8');
      } catch (err) {
        decoder = new TextDecoder('utf-8');
      }

      const { items } = await parser.parseString(
        decoder.decode(await response.arrayBuffer())
      );
 
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
      const { items } = await parser.parseURL(url);
      const loadDom = new JSDOM(await (await fetch(url)).text());
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ad57f595` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T13:18:17.448Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795871897448",
    "title": "close SSRF guard bypasses (literal IPs, redirects, autopost, proxy en",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "gitroomhq/postiz-app",
    "source_uri": "https://github.com/gitroomhq/postiz-app",
    "source_version": "HEAD",
    "content_hash": "b8dc48a3b75b199875d86a1d72a35e504b81f6f9562ad9f1dca837e637db14aa"
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
        "Expresses generalized engineering invariants (4 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-28T13:18:17.448Z"
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
  "auth_token": "108d91c284536e4d231eed9a1c7ed71315279f9839436536628ee353ff323e9e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
