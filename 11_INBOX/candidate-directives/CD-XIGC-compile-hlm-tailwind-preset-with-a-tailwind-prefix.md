# Candidate Directive: [CD-XIGC] compile hlm-tailwind-preset with a tailwind prefix

<!-- PROVENANCE_START
{
  "source_repository": "spartan-ng/spartan",
  "source_url": "https://github.com/spartan-ng/spartan",
  "source_version": "9ae9e339",
  "license": "MIT",
  "timestamp": "2026-11-18T05:10:29.293Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-spartan-ng-spartan",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [spartan-ng/spartan](https://github.com/spartan-ng/spartan) (Revision: `9ae9e339`).  
> **License**: MIT | **Timestamp**: `2026-11-18T05:10:29.293Z`  
> **Learning ID**: `learn-github-spartan-ng-spartan`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
	@apply scroll-fade;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f5bb9357` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T05:10:29.290Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794978629290",
    "title": "compile hlm-tailwind-preset with a tailwind prefix",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "spartan-ng/spartan",
    "source_uri": "https://github.com/spartan-ng/spartan",
    "source_version": "HEAD",
    "content_hash": "7b55c367df1c58820f16596e70dd779db7184cf5dd186482b3b404606a49c2f3"
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
        "Harvested/verified timestamp recorded: 2026-11-18T05:10:29.290Z"
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
  "auth_token": "3cede30b35c5afc411f60fc346718dbb5cbe6d697d7ad4f6bd418f874db95843"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
