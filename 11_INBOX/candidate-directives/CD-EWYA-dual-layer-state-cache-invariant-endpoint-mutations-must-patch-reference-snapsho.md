# Candidate Directive: [CD-EWYA] Dual-Layer State Cache Invariant: Endpoint Mutations Must Patch Reference Snapshots

<!-- PROVENANCE_START
{
  "source_repository": "tailscale/tailscale",
  "source_url": "https://github.com/tailscale/tailscale",
  "source_version": "1db8e79a",
  "license": "BSD-3-Clause",
  "timestamp": "2026-11-21T23:26:47.122Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tailscale-tailscale",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tailscale/tailscale](https://github.com/tailscale/tailscale) (Revision: `1db8e79a`).  
> **License**: BSD-3-Clause | **Timestamp**: `2026-11-21T23:26:47.122Z`  
> **Learning ID**: `learn-github-tailscale-tailscale`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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

	if ep, ok := r.activeEP[nodeID]; ok {
		ep.derpHome = newDERP
	}

	// CRITICAL INVARIANT: The reference snapshot MUST NOT remain stale.
	// Either update snapshot or invalidate it so next full netmap does not false-match.
	if snap, ok := r.snapshots[nodeID]; ok {
		cloned := snap.Clone()
		cloned.DERPHome = newDERP
		r.snapshots[nodeID] = cloned
	}
}

// UpdateFullNetmap checks equality against reference snapshots.
func (r *RouterState) UpdateFullNetmap(nodes []*Node) {
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, incoming := range nodes {
		snap, exists := r.snapshots[incoming.ID]
		if exists && snap.Equal(incoming) {
			// Fast path safe: snap is guaranteed to reflect both prior full syncs AND interim deltas
			continue
		}

		// Reconfigure runtime endpoint and re-record snapshot
		if ep, ok := r.activeEP[incoming.ID]; ok {
			ep.derpHome = incoming.DERPHome
		}
		r.snapshots[incoming.ID] = incoming.Clone()
	}
}
```
**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Patching the live runtime endpoint while leaving the snapshot stale.
func (r *RouterState) BuggyApplyDelta(nodeID uint64, newDERP int) {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Direct mutation of runtime endpoint
	r.activeEP[nodeID].derpHome = newDERP
	// COMMENT: "per-field NodeMutation patches are never applied to snapshots"
	// DISASTER: Next incoming full netmap with derpHome matching old snapshot
	// will be skipped by snap.Equal(incoming), leaving activeEP permanently corrupted.
}
```
**VERIFICATION METHOD**: Property-based delta-to-snapshot sequencing test:
1. Initialize node with `DERPHome = A`.
2. Apply delta mutation `DERPHome = B`.
3. Apply full netmap with `DERPHome = A`.
4. Assert that `runtimeEndpoint.DERPHome == A`. Any failure proves snapshot-desync short-circuiting.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T23:26:47.121Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795303607121",
    "title": "Dual-Layer State Cache Invariant: Endpoint Mutations Must Patch Reference Snapshots",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tailscale/tailscale",
    "source_uri": "https://github.com/tailscale/tailscale",
    "source_version": "HEAD",
    "content_hash": "bd2bc3be7751fe9b5e44d8df839479142e8b8d9124c1817f6f289cb8ad7fd750"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-21T23:26:47.121Z"
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
  "auth_token": "56809e3dc7b9cb1bfa64228068027c6ff0446d8e378b5091214aef424e27b1f6"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
