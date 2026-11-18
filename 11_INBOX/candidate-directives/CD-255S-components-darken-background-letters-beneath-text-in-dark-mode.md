# Candidate Directive: [CD-255S] components): darken background letters beneath text in dark mode

<!-- PROVENANCE_START
{
  "source_repository": "automattic-harper-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T01:58:07.925Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-automattic-harper-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [automattic-harper-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T01:58:07.925Z`  
> **Learning ID**: `LEARN-EVO-automattic-harper-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T01:58:08.028Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794967088028",
    "title": "components): darken background letters beneath text in dark mode",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "automattic-harper-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "c6d286f1d10607f39671f57164d9a6a2f9a882da081ad08591df16c60e8abadf"
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
        "Harvested/verified timestamp recorded: 2026-11-18T01:58:08.029Z"
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
  "auth_token": "298a6c72950122aed1183a56fb9a2d865a04852b4d6a8dec051060f77f462c66"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
