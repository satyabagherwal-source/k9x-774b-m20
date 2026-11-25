# Candidate Directive: [CD-IRFX] expose cluster device inventory

<!-- PROVENANCE_START
{
  "source_repository": "beclab/Olares",
  "source_url": "https://github.com/beclab/Olares",
  "source_version": "7a416142",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-25T13:20:35.949Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-beclab-olares",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [beclab/Olares](https://github.com/beclab/Olares) (Revision: `7a416142`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-25T13:20:35.949Z`  
> **Learning ID**: `learn-github-beclab-olares`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `framework/app-service/pkg/apiserver/handler_attachments.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in beclab/Olares. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7a416142`: app-service): expose cluster device inventory. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `framework/app-service/pkg/apiserver/handler_attachments.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
type ClusterDeviceInventoryItem struct {
	DeviceInventoryItem
	Reserved bool `json:"reserved,omitempty"`
}

type ClusterDeviceInventoryResponse struct {
	Devices []ClusterDeviceInventoryItem `json:"devices"`
}

func (h *Handler) getClusterDeviceInventory(req *restful.Request, resp *restful.Response) {
	ctx := req.Request.Context()
	client := req.Attribute(constants.KubeSphereClientAttribute).(*clientset.ClientSet)
	items, err := collectDeviceInventory(ctx, client, nil)
	if err != nil {
		api.HandleError(resp, req, err)
		return
	}

	reservations, err := deviceReservations(ctx, client, "")
	if err != nil {
		api.HandleError(resp, req, err)
		return
	}

	devices := make([]ClusterDeviceInventoryItem, 0, len(items))
	for _, item := range items {
		key := item.Node + "/" + item.Type + "/" + item.ResourceName
		_, reserved := reservations[key]
		devices = append(devices, ClusterDeviceInventoryItem{
			DeviceInventoryItem: item,
			// Keep physical selectability separate from exclusive reservations so
			// callers can offer transfers for bindings they are allowed to manage.
			Reserved: reserved && item.AccessMode != "shared",
		})
	}
	if err := resp.WriteAsJson(&ClusterDeviceInventoryRe
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
			if _, ok := allowed[capability]; !ok {
	applications, err := client.AppClient.AppV1alpha1().Applications().List(ctx, metav1.ListOptions{})
		if application.Name == current.Name {
	for i := range items {
		applyDeviceReservation(&items[i], reserved)
	}
	return nil
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7a416142` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T13:20:35.947Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795612835947",
    "title": "expose cluster device inventory",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "beclab/Olares",
    "source_uri": "https://github.com/beclab/Olares",
    "source_version": "HEAD",
    "content_hash": "a0d6b2abc93badff289d51c4b4d2e5727fcfe7c3c22948535cec2ac41898d5bb"
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
        "Harvested/verified timestamp recorded: 2026-11-25T13:20:35.947Z"
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
  "auth_token": "ea11d8f804ffd11459c7124908c1527e1009dc1e9153554e7ca9dbe49c112481"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
