# Candidate Directive: [CD-4IIN] terraform): parse TF_VAR_ values for variables of complex types as HCL

<!-- PROVENANCE_START
{
  "source_repository": "aquasecurity-trivy-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T18:33:06.859Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-aquasecurity-trivy-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aquasecurity-trivy-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T18:33:06.859Z`  
> **Learning ID**: `LEARN-EVO-aquasecurity-trivy-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `pkg/iac/scanners/terraform/parser/load_vars.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in aquasecurity/trivy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f94c2ef2`: terraform): parse TF_VAR_ values for variables of complex types as HCL. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/iac/scanners/terraform/parser/load_vars.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"github.com/zclconf/go-cty/cty/convert"

	"github.com/aquasecurity/trivy/pkg/iac/terraform"
	"github.com/aquasecurity/trivy/pkg/log"
func parseEnvVar(name, val string, ty cty.Type) (cty.Value, error) {
	if ty == cty.NilType || ty.IsPrimitiveType() {
		return cty.StringVal(val), nil
	}
	expr, diags := hclsyntax.ParseExpression([]byte(val), "<TF_VAR_"+name+">", hcl.InitialPos)
	if diags.HasErrors() {
		return cty.NilVal, fmt.Errorf("parse HCL expression: %w", diags)
	}
	v, diags := expr.Value(nil)
	if diags.HasErrors() {
		return cty.NilVal, fmt.Errorf("evaluate HCL expression: %w", diags)
	}
	v, err := convert.Convert(v, ty)
	if err != nil {
		return cty.NilVal, fmt.Errorf("convert to %s: %w", ty.FriendlyName(), err)
	}
	return v, nil
}

func loadEnvVars(logger *log.Logger, blocks terraform.Blocks) map[string]cty.Value {
	envVars := make(map[string]cty.Value)
	varTypes := make(map[string]cty.Type)

	for _, block := range blocks.OfType("variable") {
		varTypes[block.TypeLabel()] = inputVariableType(block)
	}
		key, val, _ := strings.Cut(env, "=")
		name, ok := strings.CutPrefix(key, "TF_VAR_")
		if !ok {
		v, err := parseEnvVar(name, val, varTypes[name])
		if err != nil {
			logger.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T18:33:07.003Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795717987002",
    "title": "terraform): parse TF_VAR_ values for variables of complex types as HCL",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "aquasecurity-trivy-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "df404dd0ca33810961479f752cc90076015dcc4e5f33fa3734a5623e465b71e5"
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
        "Harvested/verified timestamp recorded: 2026-11-26T18:33:07.003Z"
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
  "auth_token": "83fe4f4121c3d4faed06eb6bb676e102828f7aeddbd541a1a426b0b5670bb3f7"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
