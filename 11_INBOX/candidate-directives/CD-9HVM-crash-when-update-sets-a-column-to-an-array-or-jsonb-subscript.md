# Candidate Directive: [CD-9HVM] crash when UPDATE sets a column to an array or jsonb subscript

<!-- PROVENANCE_START
{
  "source_repository": "citusdata/citus",
  "source_url": "https://github.com/citusdata/citus",
  "source_version": "5290ba9e",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-26T10:41:05.987Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-citusdata-citus",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [citusdata/citus](https://github.com/citusdata/citus) (Revision: `5290ba9e`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-26T10:41:05.987Z`  
> **Learning ID**: `learn-github-citusdata-citus`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/backend/distributed/deparser/citus_ruleutils.c`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in citusdata/citus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5290ba9e`: crash when UPDATE sets a column to an array or jsonb subscript. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/backend/distributed/deparser/citus_ruleutils.c`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c
// Verified production-grade fix pattern:
 * isSubsRef checks if a given node is a SubscriptingRef assignment or can be
	if (!IsA(node, SubscriptingRef))
	{
		return false;
	}

	/*
	 * A SubscriptingRef without refassgnexpr fetches from a container, as in
	 * "SET col = arr[1]", so it is the value that is assigned to the column.
	 */
	return ((SubscriptingRef *) node)->refassgnexpr != NULL;
 * SubscriptingRef assignment or can be reached through an implicit coercion.
 * Used by ExpandMergedSubscriptingRefEntries() to identify if any target entries
		/* no SubscriptingRef assignments found, return original list */
			/* return original entry since it holds no SubscriptingRef assignment */
 * (e.g.: behind some level of coercions) holds a SubscriptingRef node that
 * assigns to elements of a container.
			SubscriptingRef *subsRef = (SubscriptingRef *) node;

			/*
			 * A SubscriptingRef without refassgnexpr fetches from a container,
			 * as in "SET col = arr[1]", so it is the value that is assigned to
			 * the column, and its refexpr must be kept.
			 */
			if (subsRef->refassgnexpr == NULL)
			{
				break;
			}

			return subsRef;
```

**NEGATIVE CONSTRAINT**:
```c
// Induced defect failure mode:
 * isSubsRef checks if a given node is a SubscriptingRef or can be
	return (IsA(node, SubscriptingRef));
 * SubscriptingRef or can be reached through an implicit coercion. Used by
 * ExpandMergedSubscriptingRefEntries() to identify if any target entries
		/* No subscripting refs found, return original list */
			/* return original entry since it doesn't hold a SubscriptingRef node */
 * (e.g.: behind some level of coercions) holds a SubscriptingRef node.
			return (SubscriptingRef *) node;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5290ba9e` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T10:41:05.984Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795689665984",
    "title": "crash when UPDATE sets a column to an array or jsonb subscript",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "citusdata/citus",
    "source_uri": "https://github.com/citusdata/citus",
    "source_version": "HEAD",
    "content_hash": "5e4ec765cc8b683d56be64d5ed05eec1c164845c9a4b059cda2b355c2b278ae8"
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
        "Harvested/verified timestamp recorded: 2026-11-26T10:41:05.984Z"
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
  "auth_token": "174760a9529a9a5a279901be8283357de305fe9d411b4888c1a021a37e0478f8"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
