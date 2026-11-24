# Candidate Directive: [CD-7VC9] arm): read NSG rules from the securityRules property and child resources

<!-- PROVENANCE_START
{
  "source_repository": "aquasecurity-trivy-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T05:28:33.750Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-aquasecurity-trivy-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aquasecurity-trivy-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T05:28:33.750Z`  
> **Learning ID**: `LEARN-EVO-aquasecurity-trivy-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `pkg/iac/adapters/arm/network/adapt.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in aquasecurity/trivy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f320e692`: arm): read NSG rules from the securityRules property and child resources. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/iac/adapters/arm/network/adapt.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
const (
	securityGroupType = "Microsoft.Network/networkSecurityGroups"
	securityRuleType  = "securityRules"
)

	for _, resource := range deployment.GetResourcesByType(securityGroupType) {
	if orphans := deployment.GetOrphanResources(securityGroupType, securityRuleType); len(orphans) > 0 {
		sgs = append(sgs, network.SecurityGroup{
			Metadata: iacTypes.NewUnmanagedMetadata(),
			Rules:    adaptSecurityRuleResources(orphans),
		})
	}
	var rules []network.SecurityGroupRule
	for _, rule := range resource.Properties.GetMapValue("securityRules").AsList() {
		rules = append(rules, adaptSecurityGroupRule(rule.GetMapValue("properties"), rule.GetMetadata()))
	}
		Rules:    append(rules, adaptSecurityRuleResources(deployment.GetChildResources(resource, securityRuleType))...),
func adaptSecurityRuleResources(resources []azure.Resource) []network.SecurityGroupRule {
	var rules []network.SecurityGroupRule
	for _, resource := range resources {
		rules = append(rules, adaptSecurityGroupRule(resource.Properties, resource.Metadata))
func adaptSecurityGroupRule(properties azure.Value, metadata iacTypes.Metadata) network.SecurityGroupRule {
	sourceAddressPrefixes := properties.GetMapValue("sourceAddr
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	for _, resource := range deployment.GetResourcesByType("Microsoft.Network/networkSecurityGroups") {

		Rules:    adaptSecurityGroupRules(deployment),
func adaptSecurityGroupRules(deployment azure.Deployment) (rules []network.SecurityGroupRule) {
	for _, resource := range deployment.GetResourcesByType("Microsoft.Network/networkSecurityGroups/securityRules") {
		rules = append(rules, adaptSecurityGroupRule(resource))
func adaptSecurityGroupRule(resource azure.Resource) network.SecurityGroupRule {
	sourceAddressPrefixes := resource.Properties.GetMapValue("sourceAddressPrefixes").AsStringValuesList("")

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T05:28:33.896Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795498113896",
    "title": "arm): read NSG rules from the securityRules property and child resources",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "aquasecurity-trivy-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "bec50922b950bba0ed5d52a41da64ae047052abed5be0e278b5ac8cad2fc27d7"
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
        "Harvested/verified timestamp recorded: 2026-11-24T05:28:33.896Z"
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
  "auth_token": "29ca9230ad896139983450502589cc22a45fad7d05854d08c0bea4f2e2719ff2"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
