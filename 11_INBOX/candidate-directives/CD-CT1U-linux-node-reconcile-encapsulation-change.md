# Candidate Directive: [CD-CT1U] linux/node: reconcile encapsulation change

<!-- PROVENANCE_START
{
  "source_repository": "cilium/cilium",
  "source_url": "https://github.com/cilium/cilium",
  "source_version": "ed48557d",
  "license": "Apache-2.0",
  "timestamp": "2026-11-23T15:04:36.114Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-cilium-cilium",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [cilium/cilium](https://github.com/cilium/cilium) (Revision: `ed48557d`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-23T15:04:36.114Z`  
> **Learning ID**: `learn-github-cilium-cilium`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain B

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `pkg/datapath/linux/node.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in cilium/cilium. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ec154768`: linux/node: reconcile encapsulation change. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/datapath/linux/node.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	if !prefix.IsValid() || !n.familyEnabled(prefix) {
		rt, err := n.lookupNodeRoute(prefix, isLocalNode)
		if err != nil {
			errs = errors.Join(errs, fmt.Errorf("failed to look up node route %q: %w", prefix, err))
			continue
		}
		if rt != nil {
	_, recovering := n.pendingNodes[newNode.Identity()]
	oldEncapsulation := oldNode != nil && n.enableEncapsulation(oldNode)
		added4, removed4 := diffPrefixes(oldAllIP4AllocCidrs, newAllIP4AllocCidrs)
		added6, removed6 := diffPrefixes(oldAllIP6AllocCidrs, newAllIP6AllocCidrs)
		// Unchanged prefixes need routes when entering tunnel mode or recovering
		// from a failed update that may have removed them.
		if !oldEncapsulation || recovering {
			added4, added6 = newAllIP4AllocCidrs, newAllIP6AllocCidrs
		errs = errors.Join(errs,
			n.addNodeRoutes(added4, isLocalNode),
			n.addNodeRoutes(added6, isLocalNode),
			n.removeNodeRoutes(removed4, isLocalNode),
			n.removeNodeRoutes(removed6, isLocalNode),
		)
	} else if firstAddition || oldEncapsulation || recovering {
		// Clean up stale tunnel routes only on discovery, mode transitions,
		// or recovery. Include both versions when prefixes also changed.
		errs = errors.Join(errs,
			n.removeNod
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	if !prefix.IsValid() {
		if rt, _ := n.lookupNodeRoute(prefix, isLocalNode); rt != nil {
		if err := n.updateOrRemoveNodeRoutes(oldAllIP4AllocCidrs, newAllIP4AllocCidrs, isLocalNode); err != nil {
			errs = errors.Join(errs, fmt.Errorf("failed to enable encapsulation: single cluster routes: ipv4: %w", err))
		}
		if err := n.updateOrRemoveNodeRoutes(oldAllIP6AllocCidrs, newAllIP6AllocCidrs, isLocalNode); err != nil {
			errs = errors.Join(errs, fmt.Errorf("failed to enable encapsulation: single cluster routes: ipv6: %w", err))
		}
	} else if firstAddition {
		for _, ipv4AllocCIDR := range newAllIP4AllocCidrs {
			if rt, _ := n.lookupNodeRoute(ipv4AllocCIDR, isLocalNode); rt != nil {
				if err := n.deleteNodeRoute(ipv4AllocCIDR, isLocalNode); err != nil {
					errs = errors.Join(errs, fmt.Errorf("failed to clean up stale tunnel route for ipv4: %w", err))
				}
			}
		}
		for _, ipv6AllocCIDR := range newAllIP6AllocCidrs {
			if rt, _ := n.lookupNodeRoute(ipv6AllocCIDR, isLocalNode); rt != nil {
				if err := n.deleteNodeRoute(ipv6AllocCIDR, isLocalNode); err != nil {
					errs = errors.Join(errs, fmt.Errorf("failed to clean up stale tunnel route for ipv6: %w", err))
				}
			}
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ec154768` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T15:04:36.111Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795446276111",
    "title": "linux/node: reconcile encapsulation change",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "cilium/cilium",
    "source_uri": "https://github.com/cilium/cilium",
    "source_version": "HEAD",
    "content_hash": "d92c914760880be35d034116a1d89a5b2256666be79b4345d824fbd1fe0905b6"
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
        "Harvested/verified timestamp recorded: 2026-11-23T15:04:36.111Z"
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
  "auth_token": "1da83b5c042a4a3fea4534fe8b7444606568c39d9e8a89ba5e5d470f11ea537a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
