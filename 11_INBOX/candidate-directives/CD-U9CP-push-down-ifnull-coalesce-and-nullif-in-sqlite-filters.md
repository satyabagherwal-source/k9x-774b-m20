# Candidate Directive: [CD-U9CP] Push down IFNULL, COALESCE, and NULLIF in SQLite filters

<!-- PROVENANCE_START
{
  "source_repository": "gluesql-gluesql-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T12:45:52.571Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-gluesql-gluesql-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [gluesql-gluesql-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T12:45:52.571Z`  
> **Learning ID**: `LEARN-EVO-gluesql-gluesql-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `storages/sqlite-storage/src/planner/native_filter.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in gluesql/gluesql. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c91cbdd6`: Push down IFNULL, COALESCE, and NULLIF in SQLite filters. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `storages/sqlite-storage/src/planner/native_filter.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    self::condition::ConditionPlan,
        plan::{FilterInputPlan, FilterPlan, ProjectInputPlan, QueryPlan, SchemaMap, SourcePlan},
            && let Some(input) = plan_filter(filter, self.schemas)
            project.input = input;
fn plan_filter(filter: &FilterPlan, schemas: &SchemaMap) -> Option<ProjectInputPlan> {
        return None;
    let schema = schemas.get(&table.name)?;
    let columns = schema.column_defs.as_ref()?;
    let projection = table_read::scan_projection(table, columns)?;
        return None;
    let ScanOrder::Sqlite(order) = table_read::scan_order(&table.name, columns) else {
        return None;
    let condition = condition::plan(&filter.expr, &table.name, alias, columns, column_aliases);
    let native_source = |sql, params| {
        let mut source = table_read::native_select(table, projection);
        source.query = format!("{} WHERE {sql} {order}", source.query);
        source.params = params;
        SourcePlan::Native(source)
    let input = match condition {
        ConditionPlan::Unchanged => return None,
        ConditionPlan::Full { sql, params } => ProjectInputPlan::Source(native_source(sql, params)),
        ConditionPlan::Partial {
      
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        plan::{
            ExprPlan, FilterInputPlan, FilterPlan, NativeSourcePlan, ProjectInputPlan, QueryPlan,
            SchemaMap, SourcePlan,
        },
enum NativeFilterRewrite {
    Unchanged,
    Full {
        source: NativeSourcePlan,

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T12:45:52.728Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795524352728",
    "title": "Push down IFNULL, COALESCE, and NULLIF in SQLite filters",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "gluesql-gluesql-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "870056838b4069af6f12126468cfb48c376b0d2ba5dedb17de2e5df211c6fd7b"
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
        "Harvested/verified timestamp recorded: 2026-11-24T12:45:52.728Z"
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
  "auth_token": "3836b85c7a27b0bb083fa2c5cfe342e966571d0a152204db4a136fe4a55dae27"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
