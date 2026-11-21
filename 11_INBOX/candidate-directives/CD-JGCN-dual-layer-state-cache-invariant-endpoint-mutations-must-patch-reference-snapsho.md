# Candidate Directive: [CD-JGCN] Dual-Layer State Cache Invariant: Endpoint Mutations Must Patch Reference Snapshots

<!-- PROVENANCE_START
{
  "source_repository": "tailscale-tailscale-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T23:30:18.794Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-tailscale-tailscale-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tailscale-tailscale-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T23:30:18.794Z`  
> **Learning ID**: `LEARN-EVO-tailscale-tailscale-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**: In distributed state replication systems receiving both fine-grained field-level patches (deltas) and full coarse-grained snapshots, any mutation applied directly to an active operational handle (e.g., active network endpoint) MUST simultaneously update or invalidate the underlying local snapshot/shadow copy used by fast-path comparison routines (`c.peersByID`).  
**WHY**: If a delta mutation updates only the active runtime state (`ep.setDERPHome(B)`) but bypasses the reference snapshot (`snapshot.DERPHome` remains `A`), a subsequent full snapshot arriving containing state `A` will trigger an equality fast-path bypass (`snapshot.Equal(fullNetmapNode)` evaluates to `true`). The runtime endpoint will retain the stale delta state (`B`) indefinitely, completely desynchronizing routing paths until an unrelated netmap mutation forces an eviction.  
**WHEN TO APPLY**: Any event-driven distributed client maintaining local caches, network topology maps, or CRDTs where partial delta updates interleave with periodic full snapshot synchronization.  
**VERIFIED IMPLEMENTATION PATTERN**:
```go
package state

import (
	"sync"
)

type Node struct {
	ID       uint64
	DERPHome int
	Endpoints []string
}

func (n *Node) Clone() *Node {
	cp := *n
	cp.Endpoints = append([]string(nil), n.Endpoints...)
	return &cp
}

func (n *Node) Equal(other *Node) bool {
	if n.ID != other.ID || n.DERPHome != other.DERPHome || len(n.Endpoints) != len(other.Endpoints) {
		return false
	}
	for i := range n.Endpoints {
		if n.Endpoints[i] != other.Endpoints[i] {
			return false
		}
	}
	return true
}

type RouterState struct {
	mu        sync.RWMutex
	activeEP  map[uint64]*EndpointRuntime
	snapshots map[uint64]*Node // Invariant: Must always reflect current baseline
}

type EndpointRuntime struct {
	derpHome int
}

// ApplyDelta safely mutates runtime AND reference snapshot atomically.
func (r *RouterState) ApplyDelta(nodeID uint64, newDERP int) {
	r.mu.Lock()
	defer r.mu.Unlock()

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T23:30:18.887Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795303818887",
    "title": "Dual-Layer State Cache Invariant: Endpoint Mutations Must Patch Reference Snapshots",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tailscale-tailscale-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "5dcb54385afe47d13f3d27104173135438f458caf6fe735aca39e9452882d1bc"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-21T23:30:18.887Z"
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
  "auth_token": "346d82e3c56da08888ed9f7f829404aff813b725e9537b15dd4d0aae3c7134ab"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
