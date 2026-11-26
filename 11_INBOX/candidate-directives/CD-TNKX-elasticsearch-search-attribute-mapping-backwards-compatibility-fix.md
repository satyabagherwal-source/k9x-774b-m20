# Candidate Directive: [CD-TNKX] Elasticsearch search attribute mapping backwards compatibility fix

<!-- PROVENANCE_START
{
  "source_repository": "temporalio-temporal-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T05:48:50.563Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-temporalio-temporal-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [temporalio-temporal-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T05:48:50.563Z`  
> **Learning ID**: `LEARN-EVO-temporalio-temporal-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain J

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `common/searchattribute/mapper.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in temporalio/temporal. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `fd06a49a`: Elasticsearch search attribute mapping backwards compatibility fix. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `common/searchattribute/mapper.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
// GetAlias returns the alias of fieldName. A legacy custom search attribute (registered
// through cluster metadata) always maps to itself. A namespace alias that has the same name as a
// legacy custom search attribute is not used: GetFieldName resolves that name to the legacy
// attribute. The field has no alias in that case, so that two fields never get the same alias.
	if m.isLegacyCustomSearchAttribute(fieldName) {
	alias, err := m.mapper.GetAlias(fieldName, namespaceName)
	if err != nil {
		return "", err
	}
	// TODO: Remove this check once custom search attributes of Elasticsearch visibility stores
	// are only registered as namespace aliases and no cluster-level custom search attribute is left.
	if m.isLegacyCustomSearchAttribute(alias) {
		return "", serviceerror.NewInvalidArgumentf(
			"search attribute field %s is aliased to %s, which is already a cluster-level custom search attribute",
			fieldName,
			alias,
		)
	}
// GetFieldName returns the field name of alias. A legacy custom search attribute (registered
// through cluster metadata) takes precedence over a namespace alias with the same name: its
// existing documents are stored under its own name, so resolving it t
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	alias, firstErr := m.mapper.GetAlias(fieldName, namespaceName)
	if firstErr != nil {
		if !m.isLegacyCustomSearchAttribute(fieldName) {
			return "", firstErr
		}
		// this is a custom search attribute registered through cluster metadata.
	fieldName, firstErr := m.mapper.GetFieldName(alias, namespaceName)
	if firstErr != nil {
		if !m.isLegacyCustomSearchAttribute(alias) {
			return "", firstErr

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T05:48:50.715Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795672130715",
    "title": "Elasticsearch search attribute mapping backwards compatibility fix",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "temporalio-temporal-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "87bee9481284d3c5fdb95d28d7bfe1363406788f68bae7ee9f767b53a34bf4b7"
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
        "Harvested/verified timestamp recorded: 2026-11-26T05:48:50.716Z"
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
  "auth_token": "b3e8247cd2efe72b9e8aa5949f67681d7e4612062acd06eb1dc3efed43bd958b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
