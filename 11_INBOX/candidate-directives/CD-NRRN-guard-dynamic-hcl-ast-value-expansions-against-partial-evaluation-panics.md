# Candidate Directive: [CD-NRRN] Guard Dynamic HCL/AST Value Expansions Against Partial Evaluation Panics

<!-- PROVENANCE_START
{
  "source_repository": "aquasecurity/trivy",
  "source_url": "https://github.com/aquasecurity/trivy",
  "source_version": "00b73947",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T08:31:11.699Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-aquasecurity-trivy",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aquasecurity/trivy](https://github.com/aquasecurity/trivy) (Revision: `00b73947`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T08:31:11.699Z`  
> **Learning ID**: `learn-github-aquasecurity-trivy`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**: When traversing or expanding abstract syntax tree structures or dynamic property maps (such as `cty.Value` in HashiCorp HCL2/Terraform or CEL/Rego ASTs) during static analysis, you MUST verify `.IsKnown()` and `.IsNull()` on both the collection and every nested member before invoking value-extraction methods (`AsValueMap()`, `ElementIterator()`, or native primitive casts). If a value is unknown, static evaluation MUST gracefully defer expansion or register an unresolvable sentinel rather than assuming map completeness.

**WHY**: During static code analysis (e.g., CI pipelines running without deployed cloud state or terraform backend initializations), module outputs, cross-resource references, and environment-dependent conditionals evaluate to "unknown" dynamic values. Invoking iterators or map deserializers on an unknown `cty.Value` triggers a direct runtime panic (`panic: can't use ElementIterator on unknown value`), crashing the entire scanning process and terminating CI/CD pipelines.

**WHEN TO APPLY**: Any HCL, Terraform, CloudFormation, or dynamic expression evaluator handling un-applied, un-templated, or partially resolved configuration trees.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package evaluator

import (
	"github.com/zclconf/go-cty/cty"
)

// SafeForEachExpansion verifies complete knowledge of values before map traversal
func (e *Evaluator) ShouldDeferForEachExpansion(targetVal cty.Value) bool {
	// Root guard: If the collection itself is unknown or null, defer immediately
	if !targetVal.IsKnown() || targetVal.IsNull() {
		return true
	}

	// Guard against non-traversable types
	if !targetVal.Type().IsMapType() && !targetVal.Type().IsObjectType() {
		return false
	}

	// Deep inspection: verify all nested elements without triggering ElementIterator panic
	it := targetVal.ElementIterator()
	for it.Next() {
		k, v := it.Element()
		
		// If key or value is unknown, map expansion cannot be safely statically resolved
		if !k.IsKnown() || !v.IsKnown() {
			return true
		}
		
		// Check for nested dynamic structures
		if (v.Type().IsMapType() || v.Type().IsObjectType()) && e.containsUnknownNested(v) {
			return true
		}
	}
	return false
}

func (e *Evaluator) containsUnknownNested(val cty.Value) bool {
	if !val.IsKnown() || val.IsNull() {
		return true
	}
	if !val.Type().IsMapType() && !val.Type().IsObjectType() {
		return false
	}
	it := val.ElementIterator()
	for it.Next() {
		_, v := it.Element()
		if !v.IsKnown() || e.containsUnknownNested(v) {
			return true
		}
	}
	return false
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Blindly converting cty.Value to map without checking IsKnown()
func (e *Evaluator) BadLocalHasDynamicValues(val cty.Value) bool {
	// CRASH HAZARD: If val is unknown or contains an unknown field, AsValueMap panics!
	valMap := val.AsValueMap() // panic: can't use ElementIterator on unknown value
	for _, v := range valMap {
		if v.IsUnknown() {
			return true
		}
	}
	return false
}
```

**VERIFICATION METHOD**:
Run unit tests with synthetic `cty.UnknownVal` values simulating unresolved module dependencies:
```go
func TestUnknownValueHandling(t *testing.T) {
	unknownMap := cty.MapVal(map[string]cty.Value{
		"unresolved_module_ref": cty.UnknownVal(cty.String),
	})
	eval := &Evaluator{}
	require.NotPanics(t, func() {
		deferExpansion := eval.ShouldDeferForEachExpansion(unknownMap)
		require.True(t, deferExpansion)
	})
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:31:11.697Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.66,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 66%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794904271697",
    "title": "Guard Dynamic HCL/AST Value Expansions Against Partial Evaluation Panics",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "aquasecurity/trivy",
    "source_uri": "https://github.com/aquasecurity/trivy",
    "source_version": "HEAD",
    "content_hash": "31a3fe9f7fe02f780e54be819ca0373ba429120005cd08434c91c404be86c6a4"
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:31:11.697Z"
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
  "auth_token": "67425a00838de579faf42aab93368dfd7d14f5d7e485686cc51ddb0e8807948f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
