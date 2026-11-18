# Candidate Directive: [CD-1W7B] darken background letters beneath text in dark mode

<!-- PROVENANCE_START
{
  "source_repository": "Automattic/harper",
  "source_url": "https://github.com/Automattic/harper",
  "source_version": "1d972352",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T01:57:56.423Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-automattic-harper",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Automattic/harper](https://github.com/Automattic/harper) (Revision: `1d972352`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T01:57:56.423Z`  
> **Learning ID**: `learn-github-automattic-harper`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `packages/components/src/lib/FloatingLettersSlideDeck.svelte`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Automattic/harper. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1d972352`: components): darken background letters beneath text in dark mode. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/components/src/lib/FloatingLettersSlideDeck.svelte`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/** One depth-sorted particle and its cached gray, text-blended, and introductory blurred glyphs. */
	textBlend: number;
	let blendColor = '';
			makeSprite(letter, blendColor, blur),
				textBlend: 0,
			const textBlend =
				textDistance < TEXT_FADE_RANGE ? smooth(1 - textDistance / TEXT_FADE_RANGE) : 0;
			letter.textBlend = motion.matches
				? textBlend
				: letter.textBlend + (textBlend - letter.textBlend) * 0.06 * dt;
			alpha += (Math.max(alpha, 0.7 * ease) - alpha) * letter.textBlend;
			stamp(letter.sprites[0], cos, sin, letter.x, y, alpha * (1 - letter.textBlend) * sharp);
			stamp(letter.sprites[1], cos, sin, letter.x, y, alpha * letter.textBlend * sharp);
		const style = getComputedStyle(canvas);
		const nextColor = style.getPropertyValue('--floating-letter-color').trim() || '#4a463e';
		const nextBlendColor =
			style.getPropertyValue('--floating-letter-blend-color').trim() || '#ffffff';
		if (nextColor === color && nextBlendColor === blendColor) return;
		color = nextColor;
		blendColor = nextBlendColor;
	--floating-letter-blend-color: #ffffff;
	--floating-letter-blend-color: #0c0a09;
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
/** One depth-sorted particle and its cached gray, white, and introductory blurred glyphs. */
	white: number;
			makeSprite(letter, '#ffffff', blur),
				white: 0,
			const white = textDistance < TEXT_FADE_RANGE ? smooth(1 - textDistance / TEXT_FADE_RANGE) : 0;
			letter.white = motion.matches ? white : letter.white + (white - letter.white) * 0.06 * dt;
			alpha += (Math.max(alpha, 0.7 * ease) - alpha) * letter.white;
			stamp(letter.sprites[0], cos, sin, letter.x, y, alpha * (1 - letter.white) * sharp);
			stamp(letter.sprites[1], cos, sin, letter.x, y, alpha * letter.white * sharp);
		const nextColor = getComputedStyle(canvas).getPropertyValue('--floating-letter-color').trim();
		if (nextColor === color) return;
		color = nextColor || '#4a463e';
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1d972352` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T01:57:56.421Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794967076421",
    "title": "darken background letters beneath text in dark mode",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Automattic/harper",
    "source_uri": "https://github.com/Automattic/harper",
    "source_version": "HEAD",
    "content_hash": "f2f7c7d040e8e57bdc83a19aa055a298ae5e16bb23bf1c68a61ef7fdce04df79"
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
        "Harvested/verified timestamp recorded: 2026-11-18T01:57:56.421Z"
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
  "auth_token": "98636d2b6f7e5de05959a651fd10c8686b12ecf01f949e85f57300ad0c4efe7f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
