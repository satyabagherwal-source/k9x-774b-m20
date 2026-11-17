# Candidate Directive: [CD-ZVQ8] Single-Snapshot Invariant on Multi-Replica Idempotent Mutations

<!-- PROVENANCE_START
{
  "source_repository": "Agent-Field/agentfield",
  "source_url": "https://github.com/Agent-Field/agentfield",
  "source_version": "161cab6a",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T06:20:38.624Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-agent-field-agentfield",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Agent-Field/agentfield](https://github.com/Agent-Field/agentfield) (Revision: `161cab6a`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T06:20:38.624Z`  
> **Learning ID**: `learn-github-agent-field-agentfield`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
	return s.handlePartialRegistration(ctx, req, existingAgent, diff)
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Double-reading the database invites TOCTOU race bugs
func (s *IdentityService) Register(ctx context.Context, req *RegistrationRequest) (*Response, error) {
    existingAgent, _ := s.storage.GetAgent(ctx, req.ID)
    // Secondary database read inside helper introduces divergence
    diff, _ := s.performDiffByQueryingDBAgain(ctx, req.ID, req.Skills)
    ...
}
```

**VERIFICATION METHOD**:
Inject a synchronization barrier (`store.afterRead`) immediately following the first database read in an integration test. Run a competing thread that registers a new skill during this pause. Assert that both threads complete without clobbering keys and that both client responses contain valid, non-colliding key material.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T06:20:38.623Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794896438623",
    "title": "Single-Snapshot Invariant on Multi-Replica Idempotent Mutations",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Agent-Field/agentfield",
    "source_uri": "https://github.com/Agent-Field/agentfield",
    "source_version": "HEAD",
    "content_hash": "abc4fdaf9d4f04287f757ef483702e3508dc578b8089dc806b0f1265802defe9"
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
        "Expresses generalized engineering invariants (5 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T06:20:38.623Z"
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
  "auth_token": "68d210a3ba5e1872b898dfd05b22ca205c3e88d09b58bd05cc5f8aadc0e27d52"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
