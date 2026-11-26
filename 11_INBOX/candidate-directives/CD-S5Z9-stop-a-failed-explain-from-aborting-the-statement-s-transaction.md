# Candidate Directive: [CD-S5Z9] Stop a failed EXPLAIN from aborting the statement's transaction

<!-- PROVENANCE_START
{
  "source_repository": "pixeltable-pixeltable-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T05:19:41.478Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-pixeltable-pixeltable-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pixeltable-pixeltable-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T05:19:41.478Z`  
> **Learning ID**: `LEARN-EVO-pixeltable-pixeltable-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `pixeltable/exec/sql_node.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pixeltable/pixeltable. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `704c8dc3`: Stop a failed EXPLAIN from aborting the statement's transaction. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `pixeltable/exec/sql_node.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
from pixeltable.utils.sql import log_explain
                    _logger.debug(f'SqlNode stmt:\n{stmt_str}')
                    _logger.debug(f'SqlNode proto-stmt:\n{stmt}')
                log_explain(_logger, stmt, get_runtime().conn, self.bound_args)
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
    def _log_explain(self, stmt: sql.Select) -> None:
        try:
            # don't set dialect=Env.get().engine.dialect: x % y turns into x %% y -> syntax error
            if len(self.bound_args) > 0:
                # the stmt has bindparams without statement-level values; render SQL with
                # placeholders and skip EXPLAIN (it would fail type inference on unknown params)
                stmt_str = str(stmt.compile(compile_kwargs={'literal_binds': False}))
                _logger.debug(f'SqlScanNode parameterized stmt:\n{stmt_str}')
                return
            stmt_str = str(stmt.compile(compile_kwargs={'literal_binds': True}))
            explain_result = get_runtime().conn.execute(sql.text(f'EXPLAIN {stmt_str}'))
            explain_str = '\n'.join([str(row) for row in explain_result])
            _logger.debug(f'SqlScanNode explain:\n{explain_str}')
        except Exception as e:
            _logger.warning(f'EXPLAIN failed with error: {e}')

                    _logger.debug(f'SqlLookupNode stmt:\n{stmt_str}')
                    _logger.debug(f'SqlLookupNode proto-stmt:\n{stmt}')
                self._log_explain(stmt)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `704c8dc3` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T05:19:41.636Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795670381636",
    "title": "Stop a failed EXPLAIN from aborting the statement's transaction",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "pixeltable-pixeltable-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "a1f65faf3640f5bd46c06dc2b7e91ea29ae385369fd622c4ff9043f61429f645"
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
        "Harvested/verified timestamp recorded: 2026-11-26T05:19:41.636Z"
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
  "auth_token": "0df4c4c12a315b35f485ccee20dd64eb1b38100c1bc675d5133af82c3d572be0"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
