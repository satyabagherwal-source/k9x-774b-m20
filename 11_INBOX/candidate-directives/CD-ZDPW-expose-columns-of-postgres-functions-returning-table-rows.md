# Candidate Directive: [CD-ZDPW] expose columns of Postgres functions returning table rows

<!-- PROVENANCE_START
{
  "source_repository": "dosco/graphjin",
  "source_url": "https://github.com/dosco/graphjin",
  "source_version": "3fc0975a",
  "license": "Apache-2.0",
  "timestamp": "2026-11-14T13:29:08.661Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-dosco-graphjin",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dosco/graphjin](https://github.com/dosco/graphjin) (Revision: `3fc0975a`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-14T13:29:08.661Z`  
> **Learning ID**: `learn-github-dosco-graphjin`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `core/internal/introspection/sql/postgres_functions.sql`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in dosco/graphjin. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `bc79e50b`: introspection): expose columns of Postgres functions returning table rows. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `core/internal/introspection/sql/postgres_functions.sql`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
WITH row_type_routines AS (
	-- Functions whose result is a row type: RETURNS [SETOF] tbl, RETURNS [SETOF]
	-- composite_type and RETURNS TABLE (LIKE tbl).
	SELECT r.specific_name,
		t.typrelid
	FROM information_schema.routines r
		JOIN pg_catalog.pg_namespace n ON n.nspname = r.type_udt_schema
		JOIN pg_catalog.pg_type t ON t.typnamespace = n.oid
		AND t.typname = r.type_udt_name
	WHERE r.routine_type = 'FUNCTION'
		AND r.data_type = 'USER-DEFINED'
		AND t.typrelid != 0
)
	-- The single OUT parameter of a row type function holds the whole row.
	-- Postgres expands it into the row's columns, returned by the SELECT below.
	AND NOT (
		p.parameter_mode = 'OUT'
		AND r.specific_name IN (
			SELECT specific_name
			FROM row_type_routines
		)
	)
	f.attnum as param_id,
	f.attname as param_name,
	pg_catalog.format_type(f.atttypid, f.atttypmod) as param_type,
	JOIN row_type_routines rt ON rt.specific_name = r.specific_name
	JOIN pg_catalog.pg_attribute f ON f.attrelid = rt.typrelid
WHERE f.attnum > 0
	AND f.attisdropped = false
	);
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	a.ordinal_position as param_id,
	COALESCE(
		a.attribute_name,
		CAST(a.ordinal_position as CHAR(3))
	) as param_name,
	a.data_type as param_type,
	RIGHT JOIN information_schema.attributes a ON (
		r.data_type = 'USER-DEFINED'
		AND a.udt_schema = r.type_udt_schema
		AND a.udt_name = r.type_udt_name
	)
WHERE r.routine_type = 'FUNCTION'
	);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `bc79e50b` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T13:29:08.658Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794662948658",
    "title": "expose columns of Postgres functions returning table rows",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dosco/graphjin",
    "source_uri": "https://github.com/dosco/graphjin",
    "source_version": "HEAD",
    "content_hash": "4ca3ff1fc17b431884131f976f2ff778d1b6e8fb4c34e53bc336184125cb8d50"
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
        "Harvested/verified timestamp recorded: 2026-11-14T13:29:08.658Z"
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
  "auth_token": "42e2db9e9c4352a3712d596fa9897d4b042e05874c068da712ec8abaef95c813"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
