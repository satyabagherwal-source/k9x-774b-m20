# Candidate Directive: [CD-U1GS] preview): skip delegation check when a zone is pending creation

<!-- PROVENANCE_START
{
  "source_repository": "dnscontrol-dnscontrol-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T09:19:43.750Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-dnscontrol-dnscontrol-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dnscontrol-dnscontrol-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T09:19:43.750Z`  
> **Learning ID**: `LEARN-EVO-dnscontrol-dnscontrol-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `commands/ppreviewPush.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in DNSControl/dnscontrol. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c3db94d0`: preview): skip delegation check when a zone is pending creation. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `commands/ppreviewPush.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	var delegationCorrections []*models.Correction
	var dcCount int
	var err error
	if existing, pending := splitPendingCreation(zone, push, args.PopulateOnPreview); len(pending) != 0 {
		// Some providers can't report the nameservers of a zone that does not
		// exist yet (GetNameservers fails), so the delegation can't be
		// determined until the zone is created on push.
		delegationCorrections, err = generatePendingDelegationCorrections(zone, existing, pending)
	} else {
		delegationCorrections, dcCount, err = generateDelegationCorrections(zone, zone.DNSProviderInstances, zone.RegistrarInstance)
	}
// splitPendingCreation partitions the zone's DNS providers into those where
// the zone exists and those where this run will report it as pending creation
// (see reportZonePendingCreation).
func splitPendingCreation(zone *models.DomainConfig, push, populateOnPreview bool) (existing, pending []*models.DNSProviderInstance) {
	for _, provider := range zone.DNSProviderInstances {
		if reportZonePendingCreation(zone, provider.Name, push, populateOnPreview) {
			pending = append(pending, provider)
		} else {
			existing = append(existing, provider)
		}
	}
	return existing, pending
}

// dete
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	delegationCorrections, dcCount, err := generateDelegationCorrections(zone, zone.DNSProviderInstances, zone.RegistrarInstance)
func generateDelegationCorrections(zone *models.DomainConfig, providers []*models.DNSProviderInstance, _ *models.RegistrarInstance) ([]*models.Correction, int, error) {
	// fmt.Printf("DEBUG: generateDelegationCorrections start zone=%q nsList = %v\n", zone.Name, zone.Nameservers)
		return msg(fmt.Sprintf("DetermineNS: zone %q; Error: %s", zone.Name, err)), 0, err
```

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T09:19:43.851Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794993583851",
    "title": "preview): skip delegation check when a zone is pending creation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dnscontrol-dnscontrol-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "e492be8d78f5d7b3c4fc4b7d72d2163936bb9e9bb83d50a4a58ebcbacbd49431"
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
        "Harvested/verified timestamp recorded: 2026-11-18T09:19:43.851Z"
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
  "auth_token": "550a48741a66150c04a3d5140a6c52b44bd5fcb31964331eeb2aece94cfa3188"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
