# Candidate Directive: [CD-0WK2] keep foreign bridge ports enslaved across settings changes

<!-- PROVENANCE_START
{
  "source_repository": "siderolabs/talos",
  "source_url": "https://github.com/siderolabs/talos",
  "source_version": "95d1059a",
  "license": "MPL-2.0",
  "timestamp": "2026-11-18T13:09:01.010Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-siderolabs-talos",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [siderolabs/talos](https://github.com/siderolabs/talos) (Revision: `95d1059a`).  
> **License**: MPL-2.0 | **Timestamp**: `2026-11-18T13:09:01.010Z`  
> **Learning ID**: `learn-github-siderolabs-talos`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `internal/app/machined/pkg/controllers/network/link_spec.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in siderolabs/talos. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d29d9863`: keep foreign bridge ports enslaved across settings changes. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `internal/app/machined/pkg/controllers/network/link_spec.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
// setLinkMaster enslaves link under the master with the given index; zero unslaves it.
func setLinkMaster(conn *rtnetlink.Conn, link rtnetlink.LinkMessage, masterIndex uint32) error {
	return conn.Link.Set(&rtnetlink.LinkMessage{
		Family: link.Family,
		Type:   link.Type,
		Index:  link.Index,
		Attributes: &rtnetlink.LinkAttributes{
			Master: new(masterIndex),
		},
	})
}

				// unslave all slaves, remembering them: ports this controller does not manage (e.g.
				// virtual machine taps) would otherwise never be put back
				var unslaved []int

						if err = setLinkMaster(conn, slave, 0); err != nil {
							return fmt.Errorf("error unslaving link %q under %q: %w", slave.Attributes.Name, link.TypedSpec().Name, err)
						unslaved = append(unslaved, i)
				// re-enslave the ports removed above
				for _, i := range unslaved {
					slave := (*links)[i]

					if err = setLinkMaster(conn, slave, existing.Index); err != nil {
						return fmt.Errorf("error re-enslaving link %q under %q: %w", slave.Attributes.Name, link.TypedSpec().Name, err)
					}

					(*links)[i].Attributes.Master = new(existing.Index)
				}

```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
				// unslave all slaves
						if err = conn.Link.Set(&rtnetlink.LinkMessage{
							Family: slave.Family,
							Type:   slave.Type,
							Index:  slave.Index,
							Attributes: &rtnetlink.LinkAttributes{
								Master: new(uint32(0)),
							},
						}); err != nil {
							return fmt.Errorf("error unslaving link %q under %q: %w", slave.Attributes.Name, link.TypedSpec().BridgeSlave.MasterName, err)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d29d9863` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T13:09:01.007Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795007341007",
    "title": "keep foreign bridge ports enslaved across settings changes",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "siderolabs/talos",
    "source_uri": "https://github.com/siderolabs/talos",
    "source_version": "HEAD",
    "content_hash": "c04b036b0ac9d5114c81d36601db2220023b7b16235656b1c5eb4a6c9cfe6bb4"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-18T13:09:01.007Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "3d89ef7f3fe510e22a5c63bd6b6e911856419385b8f9ea2fea71f4a580e80ebf"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
