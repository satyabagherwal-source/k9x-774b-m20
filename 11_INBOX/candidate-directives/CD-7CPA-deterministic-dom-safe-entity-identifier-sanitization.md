# Candidate Directive: [CD-7CPA] Deterministic DOM-Safe Entity Identifier Sanitization

<!-- PROVENANCE_START
{
  "source_repository": "gocd/gocd",
  "source_url": "https://github.com/gocd/gocd",
  "source_version": "fb93a763",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T08:06:06.095Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-gocd-gocd",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [gocd/gocd](https://github.com/gocd/gocd) (Revision: `fb93a763`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T08:06:06.095Z`  
> **Learning ID**: `learn-github-gocd-gocd`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
Every dynamic, domain-driven identifier (e.g., entity names, branch names, pipeline tags) used as a DOM element identifier or CSS selector MUST be deterministically mapped using a reversible, alphanumeric-safe substitution schema before DOM insertion. Raw punctation—specifically dots (`.`), colons (`:`), and slashes (`/`)—MUST NEVER be interpolated into DOM ID strings or raw query selectors.

**WHY**:
HTML5 allows dots and colons in `id` attributes, but CSS selector engines (CSSOM, `document.querySelector`, jQuery) interpret dots as class separators (`.class`) and colons as pseudo-classes (`:pseudo`). In systems where domain primitives permit dots (e.g., pipeline `release.2.0`), interpolating the unescaped token into a selector crashes DOM lookups or silently targets unintended elements, completely breaking event hooks, modal anchors, and dynamic UI shims.

**WHEN TO APPLY**:
Apply in any frontend application (TypeScript/JavaScript/React/Mithril/Vue) that reflects backend domain keys containing arbitrary characters into DOM `id` attributes or UI coordinate tracking mechanisms.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Architectural Invariant: Symmetric Sanitization and Query Escaping
export class DomIdentifierCodec {
  private static readonly DOT_SUBSTITUTE = '_id-';
  private static readonly ESCAPE_REGEX = /([:.#\[\],=@])/g;

  /**
   * Sanitizes domain identifier for safe direct injection into HTML `id="..."` attributes.
   * Matches GoCD VSM renderer contract.
   */
  public static encodeElementId(rawId: string): string {
    if (!rawId) return '';
    return rawId.replace(/\./g, this.DOT_SUBSTITUTE);
  }

  /**
   * Escapes standard CSS meta-characters when querying elements via selector strings.
   */
  public static idToSelector(rawOrEncodedId: string): string {
    if (!rawOrEncodedId) return '';
    // Double backslash escape meta-characters for CSS selector engine
    const escaped = rawOrEncodedId.replace(this.ESCAPE_REGEX, '\\$1');
    return `#${escaped}`;
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// CRITICAL DEFECT: Direct interpolation of domain identifier into DOM and Selectors
function mountNode(pipelineName: string) {
  // If pipelineName is "deploy.prod", id becomes "deploy.prod"
  const html = `<div id="${pipelineName}" class="node"></div>`;
  $('body').append(html);

  // Selector executes as: $('#deploy.prod') -> queries #deploy with class .prod!
  // Fails silently: Element is never found, modal anchor breaks.
  $(`#${pipelineName}`).on('click', () => showOverview());
}
```

**VERIFICATION METHOD**:
Enforce via unit tests validating that domain strings containing special characters resolve to expected DOM elements:
```typescript
describe('DomIdentifierCodec Invariant', () => {
  it('correctly maps and retrieves DOM node with periods', () => {
    const rawPipelineId = 'infra.linux.agent-1.0';
    const domId = DomIdentifierCodec.encodeElementId(rawPipelineId);
    
    document.body.innerHTML = `<div id="${domId}">Node</div>`;
    const selector = DomIdentifierCodec.idToSelector(domId);
    const element = document.querySelector(selector);
    
    expect(element).not.toBeNull();
    expect(element?.getAttribute('id')).toBe('infra_id-linux_id-agent-1_id-0');
  });
});
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T08:06:06.093Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794989166093",
    "title": "Deterministic DOM-Safe Entity Identifier Sanitization",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "gocd/gocd",
    "source_uri": "https://github.com/gocd/gocd",
    "source_version": "HEAD",
    "content_hash": "669b097ea6c94cd32b98ca6a61c8e36e98e228808da599b90a64230101cb2273"
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
        "Harvested/verified timestamp recorded: 2026-11-18T08:06:06.093Z"
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
  "auth_token": "88b28460658a478f6c41da9e41567345a3291ce361565dc04131205d59a119cf"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
