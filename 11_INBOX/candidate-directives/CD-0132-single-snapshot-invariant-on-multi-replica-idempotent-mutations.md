# Candidate Directive: [CD-0132] Single-Snapshot Invariant on Multi-Replica Idempotent Mutations

<!-- PROVENANCE_START
{
  "source_repository": "agent-field-agentfield-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T06:20:45.459Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-agent-field-agentfield-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [agent-field-agentfield-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T06:20:45.459Z`  
> **Learning ID**: `LEARN-EVO-agent-field-agentfield-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When performing differential operations (such as detecting whether child resources need to be generated or allocated) against an existing entity, the differential analysis MUST run against the identical entity snapshot used to formulate the base response. The orchestrator MUST NOT perform a secondary read from the database between diffing and responding, and MUST preserve concurrently issued sub-components without re-allocating or discarding cryptographic keys.

**WHY**:
In multi-replica distributed systems, reading state at $T_1$, analyzing at $T_2$, and querying again at $T_3$ introduces a Time-Of-Check to Time-Of-Use (TOCTOU) race condition. A concurrent worker issuing a sub-resource will cause the secondary read to diverge from the primary diff, resulting in partial registration drops, key overwrites, or duplicate identity minting.

**WHEN TO APPLY**:
All idempotent registration handlers, resource allocation engines, and identity-derivation services managing nested child collections (e.g., agent sub-skills, reasoner keys, dynamic endpoints).

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Pure functional differential analysis: accepts an immutable snapshot
func (s *IdentityService) PerformDifferentialAnalysis(
	existing *AgentSnapshot,
	requestedReasoners []string,
	requestedSkills []string,
) *DiffResult {
	existingReasoners := make(map[string]struct{}, len(existing.Reasoners))
	for _, r := range existing.Reasoners {
		existingReasoners[r.ID] = struct{}{}
	}

	diff := &DiffResult{
		NewReasonerIDs: setDifference(requestedReasoners, existingReasoners),
		RequiresUpdate: false,
	}
	if len(diff.NewReasonerIDs) > 0 {
		diff.RequiresUpdate = true
	}
	return diff
}

func (s *IdentityService) RegisterAgentOnce(ctx context.Context, req *RegistrationRequest) (*RegistrationResponse, error) {
	existingAgent, err := s.storage.GetAgent(ctx, req.AgentNodeID)
	if err != nil {
		return nil, err
	}

	// CRITICAL: Diff directly against the retrieved snapshot
	diff := s.PerformDifferentialAnalysis(existingAgent, req.Reasoners, req.Skills)
	if !diff.RequiresUpdate {
		// Return package strictly mapped from the exact snapshot verified
		return &RegistrationResponse{
			Success:         true,
			IdentityPackage: s.buildExistingPackage(existingAgent),
		}, nil
	}

	// Handle partial additions, merging newly allocated and existing child keys

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T06:20:45.566Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794896445566",
    "title": "Single-Snapshot Invariant on Multi-Replica Idempotent Mutations",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "agent-field-agentfield-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "3dbe6ac135e4d3f4da50f76b0f17aaaa3ad19993e334a3cace23c817ef77ccec"
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
        "Expresses generalized engineering invariants (5 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T06:20:45.566Z"
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
  "auth_token": "3919fb163611e879076baaaccf2ae98a747b64b992a1957ba1c534318de45a61"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
