# Candidate Directive: [CD-CWL1] linux/node: reconcile encapsulation change

<!-- PROVENANCE_START
{
  "source_repository": "cilium-cilium-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-23T15:04:40.537Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-cilium-cilium-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [cilium-cilium-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-23T15:04:40.537Z`  
> **Learning ID**: `LEARN-EVO-cilium-cilium-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T15:04:40.687Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795446280687",
    "title": "linux/node: reconcile encapsulation change",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "cilium-cilium-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "faf9d2096616b9d67636bc5814c4aca1402ea51293621060658240b78a88f539"
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
        "Harvested/verified timestamp recorded: 2026-11-23T15:04:40.688Z"
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
  "auth_token": "a2b5ff027a451c659f4c384567a60fc435b1a123d4407183e0a59fd764ca7054"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
