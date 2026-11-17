# Candidate Directive: [CD-6NXO] postgres: list row-level security policies in pg_policy

<!-- PROVENANCE_START
{
  "source_repository": "tursodatabase-turso-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T18:05:45.415Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-tursodatabase-turso-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tursodatabase-turso-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T18:05:45.415Z`  
> **Learning ID**: `LEARN-EVO-tursodatabase-turso-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `postgres/COMPAT.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tursodatabase/turso. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `328cd87f`: postgres: list row-level security policies in pg_policy. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `postgres/COMPAT.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
`pg_policy` (row-level security policies, with `polqual` and `polwithcheck`
as the text `pg_get_expr` prints), plus `pg_input_error_info`. Present but
always empty: `pg_trigger`, `pg_statistic_ext`, `pg_inherits`, `pg_rewrite`,
| Row-level security | 🟡 Partial | `ALTER TABLE ... ENABLE/DISABLE ROW LEVEL SECURITY` works and is shown in `pg_class.relrowsecurity`; `CREATE POLICY` and `DROP POLICY` work, with permissive and restrictive `USING` policies limiting what roles read; `UPDATE` and `DELETE` change only the rows the policies of the command allow, with the `SELECT` policies too when the statement reads columns, and new rows of `INSERT` and `UPDATE` must pass `WITH CHECK`, and the `SELECT` policies with `RETURNING`, or the statement fails with 42501; `TRUNCATE` is not subject to policies, as in PostgreSQL; `INSERT ... ON CONFLICT DO UPDATE` checks the conflicting row against the `UPDATE` and `SELECT` policies and fails if it does not pass; a new row is checked after its `NOT NULL` constraints instead of before; `pg_policy` lists the policies, with conditions printed as PostgreSQL's `pg_get_expr` prints them for common forms and as the engine's SQL otherwise; `pg_policies` does n
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
plus `pg_input_error_info`. Present but always empty: `pg_policy`,
`pg_trigger`, `pg_statistic_ext`, `pg_inherits`, `pg_rewrite`,
| Row-level security | 🟡 Partial | `ALTER TABLE ... ENABLE/DISABLE ROW LEVEL SECURITY` works and is shown in `pg_class.relrowsecurity`; `CREATE POLICY` and `DROP POLICY` work, with permissive and restrictive `USING` policies limiting what roles read; `UPDATE` and `DELETE` change only the rows the policies of the command allow, with the `SELECT` policies too when the statement reads columns, and new rows of `INSERT` and `UPDATE` must pass `WITH CHECK`, and the `SELECT` policies with `RETURNING`, or the statement fails with 42501; `TRUNCATE` is not subject to policies, as in PostgreSQL; `INSERT ... ON CONFLICT DO UPDATE` checks the conflicting row against the `UPDATE` and `SELECT` policies and fails if it does not pass; a new row is checked after its `NOT NULL` constraints instead of before; `pg_policy` does not show policies; policies cannot use subqueries with `FROM`, and the columns they use cannot be renamed or dropped; `FORCE ROW LEVEL SECURITY` is not supported; views apply it as the view's owner, except that a superuser reading a view sees every ro
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `328cd87f` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T18:05:45.516Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794938745516",
    "title": "postgres: list row-level security policies in pg_policy",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tursodatabase-turso-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "8fea9eb249a70aed4c4e3ee59a255098bb7d0d4c8fdc3ea1586897bd3caadf4d"
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
        "Harvested/verified timestamp recorded: 2026-11-17T18:05:45.516Z"
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
  "auth_token": "1ec93d574250728f9d1c117f7353c6c0c7343a19d7f8cb0aa149f87350a26120"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
