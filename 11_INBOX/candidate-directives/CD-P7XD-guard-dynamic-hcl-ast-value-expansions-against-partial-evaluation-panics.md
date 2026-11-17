# Candidate Directive: [CD-P7XD] Guard Dynamic HCL/AST Value Expansions Against Partial Evaluation Panics

<!-- PROVENANCE_START
{
  "source_repository": "aquasecurity-trivy-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T08:32:19.198Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-aquasecurity-trivy-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aquasecurity-trivy-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T08:32:19.198Z`  
> **Learning ID**: `LEARN-EVO-aquasecurity-trivy-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:32:19.296Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794904339296",
    "title": "Guard Dynamic HCL/AST Value Expansions Against Partial Evaluation Panics",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "aquasecurity-trivy-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "a4c7b5610decc9880c3dc9e50a2e9be49cc7f6b526066107920b9d4d8d5a3804"
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
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-17T08:32:19.296Z"
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
  "auth_token": "78ca04ec870817cbacb1d8be257a329b1d1a265465f7ca65000ba05b38b12130"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
