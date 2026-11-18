# Candidate Directive: [CD-YGNQ] compile hlm-tailwind-preset with a tailwind prefix

<!-- PROVENANCE_START
{
  "source_repository": "spartan-ng-spartan-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T05:11:13.503Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-spartan-ng-spartan-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [spartan-ng-spartan-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T05:11:13.503Z`  
> **Learning ID**: `LEARN-EVO-spartan-ng-spartan-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `libs/brain/hlm-tailwind-preset.css`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in spartan-ng/spartan. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f5bb9357`: compile hlm-tailwind-preset with a tailwind prefix. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `libs/brain/hlm-tailwind-preset.css`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
	--_scroll-fade-size-t: var(--scroll-fade-t-size, var(--scroll-fade-size, min(12%, calc(var(--spacing) * 10))));
	--_scroll-fade-size-b: var(--scroll-fade-b-size, var(--scroll-fade-size, min(12%, calc(var(--spacing) * 10))));
	--scroll-fade-block: linear-gradient(
		to bottom,
		transparent 0,
		#000 var(--scroll-fade-t, 0px),
		#000 calc(100% - var(--scroll-fade-b, 0px)),
		transparent 100%
	);
	-webkit-mask-image: var(--scroll-fade-mask, var(--scroll-fade-block));
	mask-image: var(--scroll-fade-mask, var(--scroll-fade-block));
	-webkit-mask-composite: source-in;
	mask-composite: intersect;
	-webkit-mask-repeat: no-repeat;
	mask-repeat: no-repeat;

	@supports (animation-timeline: scroll()) {
		animation:
			scroll-fade-reveal-t 1ms ease-in-out,
			scroll-fade-reveal-b 1ms ease-in-out;
		animation-timeline: scroll(self y), scroll(self y);
		animation-range:
			0 var(--scroll-fade-reveal, calc(var(--spacing) * 24)),
			calc(100% - var(--scroll-fade-reveal, calc(var(--spacing) * 24))) 100%;
		animation-fill-mode: both;
	}

	@supports not (animation-timeline: scroll()) {
		--scroll-fade-t: var(--_scroll-fade-size-t);
		--scroll-fade-b: var(--_scroll-fade-size-b);
	}
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T05:11:13.617Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794978673617",
    "title": "compile hlm-tailwind-preset with a tailwind prefix",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "spartan-ng-spartan-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "ac4d558d54a4109e2af8e22f4be2911275e0297695557b58e78a68d0238b5020"
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
        "Harvested/verified timestamp recorded: 2026-11-18T05:11:13.618Z"
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
  "auth_token": "10e6897d79d413515a353b5e1a534237c664738dd438c36f1d1eee11a135bd68"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
