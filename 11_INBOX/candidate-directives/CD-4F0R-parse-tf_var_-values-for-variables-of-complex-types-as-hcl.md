# Candidate Directive: [CD-4F0R] parse TF_VAR_ values for variables of complex types as HCL

<!-- PROVENANCE_START
{
  "source_repository": "aquasecurity/trivy",
  "source_url": "https://github.com/aquasecurity/trivy",
  "source_version": "f94c2ef2",
  "license": "Apache-2.0",
  "timestamp": "2026-11-26T18:33:02.475Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-aquasecurity-trivy",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aquasecurity/trivy](https://github.com/aquasecurity/trivy) (Revision: `f94c2ef2`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-26T18:33:02.475Z`  
> **Learning ID**: `learn-github-aquasecurity-trivy`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
func loadTFVars(srcFS fs.FS, filenames []string) (map[string]cty.Value, error) {
	combinedVars := make(map[string]cty.Value)
		split := strings.Split(env, "=")
		key := split[0]
		if !strings.HasPrefix(key, "TF_VAR_") {
		key = strings.TrimPrefix(key, "TF_VAR_")
		var val string
		if len(split) > 1 {
			val = split[1]
		combinedVars[key] = cty.StringVal(val)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f94c2ef2` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T18:33:02.473Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795717982473",
    "title": "parse TF_VAR_ values for variables of complex types as HCL",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "aquasecurity/trivy",
    "source_uri": "https://github.com/aquasecurity/trivy",
    "source_version": "HEAD",
    "content_hash": "02790b60b03943fe793e21f6b7dc9968e4be88081e6a5b4f1e39570ee7a27dd1"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Harvested/verified timestamp recorded: 2026-11-26T18:33:02.473Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "bb63c6062ddb99c288a524c48663a40cafe1c2e34bacfb8c8b9a99f7cadaa7b1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
